"""String/DC-side diagnostics — the half of the digital twin that finally uses
the per-inverter DC telemetry (I_DC_SUM, U_DC) the rest of the pipeline ignores.

For every inverter we ask three physical questions:
  1. How efficiently does it convert DC→AC? (η = P_AC / (U_DC·I_DC), per year.)
  2. Is a string missing? DC current scales with irradiance; calibrate the
     healthy ratio r = I_DC/irradiance on year-1, then divide each inverter's
     daily ratio by the FLEET-MEDIAN ratio that day. That common-mode division
     removes the shared drift (temperature, spectrum, plant-wide soiling) that
     would otherwise flag every inverter — what's left is each unit's own
     deviation. A sustained drop to ≈(k−1)/k of its peers, with DC voltage still
     healthy, means one of k strings is down. ≈0 with voltage present = a DC
     disconnect; both ≈0 in daylight = the inverter is offline.
  3. How much energy did those DC faults cost? (current deficit × voltage × η.)

Loads ONLY irradiance + per-inverter I_DC/U_DC/P_AC for daytime rows (keeps the
frame well under the full 1 GB parquet). Run AFTER build.py:
    python pipeline/dc_diag.py
Output: public/artifacts/dc_diag.json
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

import sources as S

warnings.filterwarnings("ignore")

OUT = S.OUT
ART = S.ART

INTERVAL_H = 5.0 / 60.0
DAY_IRR = 50.0           # W/m² — daylight floor for loading rows
CAL_LO, CAL_HI = 150.0, 750.0   # irradiance band for I_DC calibration (avoid clipping)
CURTAIL_AVAIL = 99.5
STRING_THRESH = 0.90     # smoothed corrected ratio below this = candidate string loss
DISCONNECT_THRESH = 0.15 # corrected ratio below this (voltage present) = DC disconnect
STEP_DROP = 0.12         # required drop vs the inverter's own recent baseline (a real step)
MIN_EPISODE_DAYS = 10    # ignore shorter dips (weather / noise)
CHRONIC_THRESH = 0.90    # lifetime corrected ratio below this = persistent DC shortfall


def log(msg: str) -> None:
    print(f"[pyra:dc_diag] {msg}", flush=True)


def load_dc() -> tuple[pd.DataFrame, list[str]]:
    con = duckdb.connect()
    P = str(S.MONITORING_PARQUET)
    cols = [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{P}')").fetchall()]

    def find(suffix_key: str) -> dict[str, str]:
        out = {}
        for c in cols:
            m = S.INV_RE.search(c)
            if m and suffix_key in c:
                out[c] = m.group(0)
        return out

    pac = find("P_AC")
    idc = find("I_DC")
    udc = find("U_DC")
    inv_ids = sorted(set(pac.values()) & set(idc.values()) & set(udc.values()))

    sel = []
    for inv in inv_ids:
        p = next(c for c, i in pac.items() if i == inv)
        i_ = next(c for c, i in idc.items() if i == inv)
        u = next(c for c, i in udc.items() if i == inv)
        sel.append(f'"{p}" AS "{inv}__pac"')
        sel.append(f'"{i_}" AS "{inv}__idc"')
        sel.append(f'"{u}" AS "{inv}__udc"')

    df = con.execute(f"""
        SELECT strptime("timestamp", '{S.TS_FORMAT}') AS ts,
               "Plant / Irradiation_average (W/m²)" AS irradiance,
               "DRD11A / EVU (%)" AS evu,
               "DRD11A / DV (%)" AS dv,
               {", ".join(sel)}
        FROM read_parquet('{P}')
        WHERE "Plant / Irradiation_average (W/m²)" > {DAY_IRR}
        ORDER BY ts
    """).df()
    for c in df.columns:
        if c != "ts":
            df[c] = pd.to_numeric(df[c], errors="coerce").astype("float32")
    return df, inv_ids


def find_step_episodes(d: pd.DataFrame, k: int | None, eff: float) -> list[dict]:
    """Detect discrete DC-current STEP faults on the corrected daily ratio.

    A string loss is a sudden, sustained drop from this inverter's own recent
    healthy plateau — not a slow decline (that's degradation) and not noise.
    For each day we compare a 7-day smoothed ratio against a trailing 40-day
    baseline; a day is faulted only if it sits low AND stepped down materially
    from where it just was. Episodes = runs of such days (short gaps bridged).
    """
    if len(d) < 30:
        return []
    d = d.reset_index(drop=True)
    rc = d["ratio"].to_numpy(dtype=float)
    rc7 = pd.Series(rc).rolling(7, min_periods=4, center=True).median().to_numpy()
    # trailing baseline that excludes the recent week (so a step shows as a gap)
    base = pd.Series(rc7).rolling(40, min_periods=12).median().shift(7).to_numpy()
    udc = d["udc"].to_numpy()

    kind = np.full(len(d), "ok", dtype=object)
    for i in range(len(d)):
        if not np.isfinite(rc7[i]) or not np.isfinite(base[i]):
            continue
        if udc[i] < d["healthy_v"].iloc[0]:
            kind[i] = "offline"
            continue
        step = base[i] - rc7[i]
        # Only DC DISCONNECTS are flagged as discrete events: I_DC collapses to
        # ~zero while U_DC stays healthy, stepping down from a healthy plateau.
        # (Partial-ratio dips are confounded by seasonal inter-row shading that
        # recurs every autumn — those are NOT string faults; persistent partial
        # loss is reported separately via the chronic ratio instead.)
        if base[i] < 0.92:
            continue
        if rc7[i] < DISCONNECT_THRESH and step > 0.4:
            kind[i] = "disconnect"
    d = d.assign(_kind=kind, _base=base, _rc7=rc7)

    # group runs of non-ok (string/disconnect) days, bridging ≤2-day gaps
    fault = d[d["_kind"].isin(["string", "disconnect"])]
    if fault.empty:
        return []
    eps: list[dict] = []
    run: list[int] = []
    prev = None
    for idx in fault.index:
        if prev is not None and (idx - prev) > 2:
            eps.append(_close(d, run, k, eff))
            run = []
        run.append(idx)
        prev = idx
    if run:
        eps.append(_close(d, run, k, eff))
    return [e for e in eps if e and e["days"] >= MIN_EPISODE_DAYS]


def _close(d: pd.DataFrame, run: list[int], k: int | None, eff: float) -> dict | None:
    if not run:
        return None
    g = d.loc[run]
    kind = g["_kind"].value_counts().idxmax()
    base_rc = float(np.nanmedian(g["_base"]))
    dur_rc = float(np.nanmedian(g["_rc7"]))
    drop = max(base_rc - dur_rc, 0.0)
    # loss = actual DC energy scaled up to the pre-fault baseline, → AC kWh
    udc = g["udc"].to_numpy()
    act_dc = g["sum_idc"].to_numpy() * udc / 1000.0 * INTERVAL_H   # band-limited kWh
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio_ok = np.clip(g["_rc7"].to_numpy(), 0.05, None)
        lost = np.nansum(act_dc * np.clip(base_rc / ratio_ok - 1.0, 0, None)) * eff
    strings_down = None
    if k:
        strings_down = int(np.clip(round(drop * k), 1, k)) if kind == "disconnect" \
            else int(np.clip(round(drop * k), 1, max(k - 1, 1)))
    return {
        "start": str(g["date"].iloc[0])[:10],
        "end": str(g["date"].iloc[-1])[:10],
        "days": int(len(g)),
        "kind": kind,
        "baselineRatio": round(base_rc, 3),
        "duringRatio": round(dur_rc, 3),
        "estStringsDown": strings_down,
        "lostKwh": round(float(lost), 1),
    }


def main() -> None:
    S.check_data_present()
    log("loading daytime DC frame (I_DC/U_DC/P_AC per inverter)…")
    df, inv_ids = load_dc()
    log(f"{len(df):,} daytime rows · {len(inv_ids)} inverters")

    meta = pd.read_parquet(OUT / "inverter_metadata.parquet").set_index("inverterId")
    irr = df["irradiance"].to_numpy()
    curtailed = ((df["evu"].notna()) & (df["evu"] < CURTAIL_AVAIL)) | \
                ((df["dv"].notna()) & (df["dv"] < CURTAIL_AVAIL))
    curt = curtailed.to_numpy()
    date = pd.to_datetime(df["ts"]).dt.normalize()
    year = pd.to_datetime(df["ts"]).dt.year.to_numpy()
    band_irr = (irr >= CAL_LO) & (irr <= CAL_HI)

    # ---- pass 1: per-inverter daily DC ratio (vs its own year-1 baseline) ----
    base: dict[str, dict] = {}      # inv → static facts (eff, k, r_healthy, nom_udc)
    daily_by_inv: dict[str, pd.DataFrame] = {}

    for inv in inv_ids:
        pac = df[f"{inv}__pac"].to_numpy()
        idc = df[f"{inv}__idc"].to_numpy()
        udc = df[f"{inv}__udc"].to_numpy()
        k = int(meta.loc[inv, "strings"]) if inv in meta.index and pd.notna(meta.loc[inv, "strings"]) else None

        present = np.isfinite(idc) & np.isfinite(udc) & np.isfinite(pac) & ~curt
        op = present & (idc > 0.3) & (pac > 0.05)
        if op.sum() < 200:
            continue
        nom_udc = float(np.nanmedian(udc[op]))
        healthy_v = nom_udc * 0.6

        # Conversion efficiency η = P_AC / P_DC over solid-load samples.
        pdc = udc * idc / 1000.0
        eff_mask = op & (pdc > 0.5) & (pac > 0.5)
        eff_vals = pac[eff_mask] / pdc[eff_mask]
        eff_vals = eff_vals[(eff_vals > 0.5) & (eff_vals < 1.05)]
        mean_eff = float(np.median(eff_vals)) if len(eff_vals) else 0.95
        eff_by_year = []
        for y in sorted(set(year[eff_mask].tolist())):
            ym = eff_mask & (year == y)
            ev = pac[ym] / pdc[ym]
            ev = ev[(ev > 0.5) & (ev < 1.05)]
            if len(ev) > 100:
                eff_by_year.append({"year": int(y), "eff": round(float(np.median(ev)), 4)})

        # Calibrate healthy I_DC ∝ irradiance on year-1, mid-irradiance band.
        first_day = date[op].min()
        y1 = present & (date <= first_day + pd.Timedelta(days=365))
        cal = y1 & band_irr & (udc > healthy_v) & (idc > 0.1)
        if cal.sum() < 200:
            cal = present & band_irr & (udc > healthy_v) & (idc > 0.1)
        if cal.sum() < 100:
            continue
        r_healthy = float(np.median(idc[cal] / irr[cal]))
        if r_healthy <= 0:
            continue

        band = present & band_irr
        exp_idc = r_healthy * irr
        with np.errstate(divide="ignore", invalid="ignore"):
            ratio = np.where(exp_idc > 0.1, idc / exp_idc, np.nan)

        sub = pd.DataFrame({
            "date": date[band].values,
            "ratio": ratio[band],
            "udc": udc[band],
            "exp_idc": exp_idc[band],
            "idc": idc[band],
        })
        daily = sub.groupby("date").agg(
            ratio=("ratio", "median"),
            udc=("udc", "median"),
            n=("ratio", "size"),
            sum_exp=("exp_idc", "sum"),
            sum_idc=("idc", "sum"),
        )
        daily = daily[daily["n"] >= 6]
        if daily.empty:
            continue
        daily_by_inv[inv] = daily
        base[inv] = {
            "k": k, "nom_udc": nom_udc, "healthy_v": healthy_v,
            "mean_eff": mean_eff, "eff_by_year": eff_by_year, "r_healthy": r_healthy,
        }

    # ---- common-mode: fleet-median daily ratio (shared weather/seasonal/soiling) ----
    fleet = pd.concat({inv: d["ratio"] for inv, d in daily_by_inv.items()}, axis=1)
    fleet_median = fleet.median(axis=1).clip(lower=0.2)   # F_day, guard against 0

    # ---- pass 2: corrected ratio Rc = R_day / F_day → classify + episodes ----
    result: dict[str, dict] = {}
    total_dc_lost = 0.0

    for inv, daily in daily_by_inv.items():
        b = base[inv]
        k, mean_eff = b["k"], b["mean_eff"]
        d = daily.copy().reset_index()
        f = fleet_median.reindex(daily.index).to_numpy()
        d["ratio"] = d["ratio"].to_numpy() / f              # common-mode-corrected
        d["healthy_v"] = b["healthy_v"]
        eps = find_step_episodes(d, k, mean_eff)
        dc_eps = [e for e in eps if e["kind"] in ("string", "disconnect")]
        dc_lost = float(sum(e["lostKwh"] for e in dc_eps))
        fault_days = int(sum(e["days"] for e in dc_eps))
        est_down = max([e["estStringsDown"] or 0 for e in dc_eps], default=0)
        total_dc_lost += dc_lost

        # Chronic state: lifetime corrected ratio (a low value = strings missing
        # the whole time / module mismatch — explains low health, NOT re-charged
        # as loss here since the AC-side ledger already books it).
        chronic_ratio = float(np.nanmedian(d["ratio"].to_numpy()))
        chronic_down = None
        if k and np.isfinite(chronic_ratio) and chronic_ratio < CHRONIC_THRESH:
            chronic_down = int(np.clip(round((1.0 - chronic_ratio) * k), 1, max(k - 1, 1)))

        result[inv] = {
            "nStrings": k,
            "nominalUdc": round(b["nom_udc"], 1),
            "meanEff": round(mean_eff, 4),
            "effByYear": b["eff_by_year"],
            "rHealthy": round(b["r_healthy"], 5),
            "chronicRatio": round(chronic_ratio, 3) if np.isfinite(chronic_ratio) else None,
            "chronicStringsDown": chronic_down,
            "disconnectDays": fault_days,
            "estStringsDown": est_down or None,
            "dcLostKwh": round(dc_lost, 1),
            "episodes": dc_eps[:40],
        }

    ART.mkdir(parents=True, exist_ok=True)
    payload = {
        "perInverter": result,
        "totalDcLostKwh": round(total_dc_lost, 0),
        "invertersWithDisconnects": sum(1 for v in result.values() if v["disconnectDays"] > 0),
        "totalDisconnectEpisodes": sum(len(v["episodes"]) for v in result.values()),
        "chronicShortfallInverters": sum(1 for v in result.values() if v.get("chronicStringsDown")),
    }
    (ART / "dc_diag.json").write_text(json.dumps(payload))
    log(f"dc_diag.json — {len(result)} inverters · "
        f"{payload['totalDisconnectEpisodes']} DC-disconnect events on "
        f"{payload['invertersWithDisconnects']} inverters · DC loss {total_dc_lost:,.0f} kWh")
    # sanity peek
    ranked = sorted(result.items(), key=lambda kv: kv[1]["dcLostKwh"], reverse=True)[:6]
    for inv, v in ranked:
        log(f"  {inv}: eff {v['meanEff']*100:.1f}% · {len(v['episodes'])} disconnect(s) · "
            f"{v['disconnectDays']}d · {v['dcLostKwh']:,.0f} kWh")


if __name__ == "__main__":
    main()
