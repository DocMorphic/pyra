"""Ingestion + normalization — the layer that turns ANY uploaded PV dataset
into the canonical schema the rest of the Pyra pipeline already expects.

This is what makes Pyra a *living* model rather than a fixed demo: a user
uploads their own monitoring export (CSV / Parquet / XLSX, any column names),
we auto-detect the role of each column, let them confirm the mapping, then
rewrite everything into the exact canonical column convention
(`INV aa.bb.ccc / P_AC (kW)`, `Plant / Irradiation_average (W/m²)`, …) so
build.py / analytics.py / dc_diag.py run unchanged on it.

Two modes:
  python ingest.py --detect <file>                 → prints a JSON role-detection
                                                       report to stdout (for the UI)
  python ingest.py --normalize <file> --mapping m.json
                                                    → writes the canonical session
                                                       dataset + capabilities.json
Always run with PYRA_SESSION set so sources.py points OUT/ART at the session.

What's emitted (into S.OUT, the session dir):
  canonical_monitoring.parquet  · inverter_metadata.parquet · tariffs.parquet
  tickets.parquet  · (capabilities.json into S.ART for the frontend)
Missing roles are filled with NULL columns (so downstream SQL never breaks) and
recorded in capabilities.json as missing_input / insufficient_data per analysis.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import warnings
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

import sources as S

warnings.filterwarnings("ignore")

CANON_IRR = "Plant / Irradiation_average (W/m²)"
CANON_ALT = "Plant / Altitude (°)"
CANON_TMOD = "Temperature Sensor / Module (°C)"
CANON_TAMB = "Temperature Sensor / Ambient (°C)"
CANON_EVU = "DRD11A / EVU (%)"
CANON_DV = "DRD11A / DV (%)"

TS_FORMATS = [
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M",
    "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
    "%d/%m/%Y %H:%M", "%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
]
MIN_YEARS_DEGRADATION = 3
MIN_SAMPLES_CORE = 500


def log(msg: str) -> None:
    print(f"[pyra:ingest] {msg}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- IO
def sniff_csv(path: Path) -> tuple[str, str]:
    with open(path, errors="replace") as f:
        head = f.readline()
    delim = ";" if head.count(";") > head.count(",") else ","
    return delim, ("," if delim == ";" else ".")


def source_sql(con, path: Path) -> str:
    ext = path.suffix.lower()
    if ext in (".parquet", ".pq"):
        return f"read_parquet('{path}')"
    if ext in (".csv", ".txt", ".tsv"):
        delim, dec = sniff_csv(path)
        return (f"read_csv('{path}', delim='{delim}', decimal_separator='{dec}', "
                f"header=true, sample_size=-1, ignore_errors=true, all_varchar=false)")
    if ext in (".xlsx", ".xls"):
        S.OUT.mkdir(parents=True, exist_ok=True)
        tmp = S.OUT / "_upload_src.parquet"
        pd.read_excel(path).to_parquet(tmp, index=False)
        return f"read_parquet('{tmp}')"
    raise SystemExit(f"Unsupported file type: {ext} (use CSV, Parquet or XLSX)")


def describe(con, src: str) -> list[str]:
    return [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM {src}").fetchall()]


def quoted(cols: list[str]) -> str:
    return ", ".join('"' + c.replace('"', '""') + '"' for c in cols)


# ------------------------------------------------------------------- detection
def detect_timestamp(con, src: str, cols: list[str]) -> tuple[str | None, str | None]:
    """Return (column, strptime-format|None). None format = already datetime."""
    sample = con.execute(f"SELECT * FROM {src} USING SAMPLE 3000 ROWS").df()
    best = (None, None, 0.0)
    for c in cols:
        s = sample[c]
        if np.issubdtype(s.dtype, np.datetime64):
            rate = s.notna().mean()
            if rate > best[2]:
                best = (c, None, rate)
            continue
        ss = s.astype(str)
        # generic parse first
        rate = pd.to_datetime(ss, errors="coerce").notna().mean()
        if rate > 0.9 and rate > best[2]:
            fmt = next((f for f in TS_FORMATS
                        if pd.to_datetime(ss, format=f, errors="coerce").notna().mean() > 0.9), None)
            best = (c, fmt, rate)
    return best[0], best[1]


def parse_ts(series: pd.Series, fmt: str | None) -> pd.Series:
    if fmt:
        return pd.to_datetime(series.astype(str), format=fmt, errors="coerce")
    return pd.to_datetime(series, errors="coerce")


# plant-level / aggregate channels that must NOT be grouped as inverters
_NOT_INVERTER = ["janitza", "meter", "cosphi", "s_ac", "kvar", "q_ac", "i_ac", "combiner", "trafo", "grid"]


def measure_of(name: str) -> str | None:
    n = name.lower()
    if any(k in n for k in _NOT_INVERTER):
        return None
    if any(k in n for k in ["i_dc", "idc"]) or ("current" in n and "dc" in n):
        return "idc"
    if any(k in n for k in ["u_dc", "udc"]) or ("voltage" in n and "dc" in n):
        return "udc"
    if "p_ac" in n or "pac" in n or ("power" in n and "dc" not in n):
        return "pac"
    return None


def device_key(name: str) -> str:
    n = re.sub(r"\([^)]*\)", "", name)            # drop units like (kW)
    for tok in ["i_dc_sum", "i_dc", "idc", "u_dc", "udc", "p_ac", "pac",
                "power", "current", "voltage", "ac", "dc", "sum", "/"]:
        n = re.sub(tok, " ", n, flags=re.I)
    return re.sub(r"[\s_\-\.]+", " ", n).strip().lower()


def find_first(cols: list[str], *needles: str) -> str | None:
    for c in cols:
        lc = c.lower()
        if any(nd in lc for nd in needles):
            return c
    return None


def detect(path: Path) -> dict:
    con = duckdb.connect()
    src = source_sql(con, path)
    cols = describe(con, src)
    notes: list[str] = []

    ts_col, ts_fmt = detect_timestamp(con, src, cols)
    if not ts_col:
        return {"error": "No timestamp column detected."}

    # interval + span from the full timestamp column (1 col → cheap)
    tser = parse_ts(con.execute(f'SELECT "{ts_col}" FROM {src}').df()[ts_col], ts_fmt).dropna().sort_values()
    diffs = tser.diff().dropna()
    interval_h = float(diffs.median().total_seconds() / 3600.0) if len(diffs) else 5 / 60
    span_days = int((tser.iloc[-1] - tser.iloc[0]).days) if len(tser) > 1 else 0
    row_count = int(len(tser))

    # plant-level roles by name
    used = {ts_col}
    irr = find_first(cols, "irrad", "ghi", "poa", "w/m", "insol", "einstrahl")
    alt = find_first(cols, "altitude", "elevation", "sun height", "sonnenh", "sun_elev")
    evu = find_first(cols, "evu", "avail")
    dv = find_first(cols, "/ dv", " dv", "_dv", "curtail", "limitation")
    meter = next((c for c in cols if ("janitza" in c.lower() or "grid meter" in c.lower()
                                       or "feed-in" in c.lower()) and "p_ac" in c.lower()), None)
    temp_cols = [c for c in cols if ("temp" in c.lower() or "°c" in c.lower()) and measure_of(c) is None]
    tmod = next((c for c in temp_cols if any(k in c.lower() for k in ["modul", "cell", "zelle", "panel"])), None)
    tamb = next((c for c in temp_cols if any(k in c.lower() for k in ["ambient", "umgeb", "air", "luft", "out"])), None)
    if not tmod and temp_cols:
        tmod = temp_cols[0]
    if not tamb and len(temp_cols) > 1:
        tamb = next((c for c in temp_cols if c not in (tmod,)), None)
    for c in (irr, alt, evu, dv, meter, tmod, tamb):
        if c:
            used.add(c)

    # per-device pac/idc/udc grouping
    groups: dict[str, dict[str, str]] = {}
    for c in cols:
        if c in used:
            continue
        m = measure_of(c)
        if not m:
            continue
        # avoid plant-level meter being grouped as an inverter
        if meter and c == meter:
            continue
        k = device_key(c)
        groups.setdefault(k, {})[m] = c
    inverters = []
    for i, (k, meas) in enumerate(sorted(g for g in groups.items() if "pac" in g[1]),):
        cid = f"INV 01.01.{i + 1:03d}"
        inverters.append({"id": cid, "key": k, "pac": meas["pac"],
                          "idc": meas.get("idc"), "udc": meas.get("udc")})

    # irradiance fallback by correlation with summed P_AC (daytime)
    irr_inferred = False
    if not irr and inverters:
        sample = con.execute(f"SELECT * FROM {src} USING SAMPLE 5000 ROWS").df()
        pac_sum = sum(pd.to_numeric(sample[iv["pac"]], errors="coerce").fillna(0) for iv in inverters)
        day = pac_sum > pac_sum.quantile(0.5)
        best_c, best_r = None, 0.0
        cand = [c for c in cols if c not in used and measure_of(c) is None
                and c not in [iv["pac"] for iv in inverters]]
        for c in cand:
            v = pd.to_numeric(sample[c], errors="coerce")
            if v.notna().mean() < 0.5:
                continue
            r = float(np.corrcoef(v[day].fillna(0), pac_sum[day])[0, 1]) if day.sum() > 10 else 0
            if np.isfinite(r) and r > best_r:
                best_c, best_r = c, r
        if best_c and best_r > 0.7:
            irr, irr_inferred = best_c, True
            notes.append(f"Irradiance inferred from '{best_c}' (corr {best_r:.2f} with AC power) — please confirm.")

    has_dc = any(iv["idc"] and iv["udc"] for iv in inverters)
    if not has_dc:
        notes.append("No DC telemetry (I_DC/U_DC) found → string/DC diagnostics will be unavailable.")
    if not irr:
        notes.append("No irradiance column found → core performance analysis needs one (map it manually).")
    notes.append("kWp will be estimated from peak AC power (no system-overview uploaded).")

    samples = {}
    head = con.execute(f"SELECT * FROM {src} LIMIT 3").df()
    for c in cols:
        samples[c] = [None if pd.isna(v) else str(v)[:24] for v in head[c].tolist()]

    return {
        "columns": [{"name": c, "samples": samples.get(c, [])} for c in cols],
        "proposed": {
            "timestamp": ts_col, "timestampFormat": ts_fmt,
            "irradiance": irr, "irradianceInferred": irr_inferred,
            "module_temp": tmod, "ambient_temp": tamb, "altitude": alt,
            "evu": evu, "dv": dv, "plant_meter": meter,
            "inverters": [{"id": iv["id"], "pac": iv["pac"], "idc": iv["idc"], "udc": iv["udc"]} for iv in inverters],
        },
        "intervalH": round(interval_h, 5),
        "intervalLabel": _interval_label(interval_h),
        "rowCount": row_count, "spanDays": span_days, "nInverters": len(inverters),
        "notes": notes,
    }


def _interval_label(h: float) -> str:
    m = h * 60
    if m < 1.5:
        return f"{round(m * 60)} s"
    if m < 90:
        return f"{round(m)} min"
    return f"{round(h, 1)} h"


# ------------------------------------------------------------------ normalize
def synth_altitude(ts: pd.Series, lat: float, lon: float) -> np.ndarray:
    import pvlib
    times = pd.DatetimeIndex(ts).tz_localize("UTC", ambiguous="NaT", nonexistent="NaT")
    sp = pvlib.solarposition.get_solarposition(times, lat, lon)
    return sp["apparent_elevation"].clip(lower=0).to_numpy()


def num(s: pd.Series) -> np.ndarray:
    return pd.to_numeric(s, errors="coerce").astype("float32").to_numpy()


def normalize(path: Path, mapping: dict) -> dict:
    con = duckdb.connect()
    src = source_sql(con, path)
    cols = describe(con, src)

    ts_col = mapping["timestamp"]
    ts_fmt = mapping.get("timestampFormat")
    invs = mapping.get("inverters", [])
    if not ts_col or not invs:
        raise SystemExit("mapping must include a timestamp and at least one inverter P_AC column")

    needed = {ts_col}
    for role in ("irradiance", "module_temp", "ambient_temp", "altitude", "evu", "dv", "plant_meter"):
        if mapping.get(role):
            needed.add(mapping[role])
    for iv in invs:
        for k in ("pac", "idc", "udc"):
            if iv.get(k):
                needed.add(iv[k])
    df = con.execute(f"SELECT {quoted([c for c in cols if c in needed])} FROM {src}").df()

    ts = parse_ts(df[ts_col], ts_fmt)
    keep = ts.notna()
    df, ts = df[keep].reset_index(drop=True), ts[keep].reset_index(drop=True)
    order = ts.argsort()
    df, ts = df.iloc[order].reset_index(drop=True), ts.iloc[order].reset_index(drop=True)

    out = pd.DataFrame()
    out["timestamp"] = ts.dt.strftime(S.TS_FORMAT)

    def env(role, canon):
        out[canon] = num(df[mapping[role]]) if mapping.get(role) else np.float32(np.nan)

    env("irradiance", CANON_IRR)
    env("module_temp", CANON_TMOD)
    env("ambient_temp", CANON_TAMB)
    env("evu", CANON_EVU)
    env("dv", CANON_DV)

    lat = float(mapping.get("lat", 51.0))
    lon = float(mapping.get("lon", 10.0))
    if mapping.get("altitude"):
        out[CANON_ALT] = num(df[mapping["altitude"]])
    else:
        out[CANON_ALT] = synth_altitude(ts, lat, lon).astype("float32")
        log(f"altitude synthesized via pvlib from ({lat},{lon})")

    if mapping.get("plant_meter"):
        out["Janitza / P_AC (kW)"] = num(df[mapping["plant_meter"]])

    interval_h = mapping.get("intervalH") or _detect_interval(ts)
    meta_rows = []
    tariff = float(mapping.get("tariffEurPerKwh") or 0.115)
    kwp_provided = bool(mapping.get("kWp"))
    for i, iv in enumerate(invs):
        cid = f"INV 01.01.{i + 1:03d}"
        pac = num(df[iv["pac"]])
        out[f"{cid} / P_AC (kW)"] = pac
        if iv.get("idc"):
            out[f"{cid} / I_DC_SUM (A)"] = num(df[iv["idc"]])
        if iv.get("udc"):
            out[f"{cid} / U_DC (V)"] = num(df[iv["udc"]])
        kwp = float(iv["kWp"]) if iv.get("kWp") else round(float(np.nanpercentile(pac, 99.9)) / 0.96, 1)
        meta_rows.append({"inverterId": cid, "area": "01", "kWp": kwp,
                          "moduleType": iv.get("moduleType", "unknown"),
                          "strings": iv.get("strings"), "modules": None, "location": None})

    S.OUT.mkdir(parents=True, exist_ok=True)
    S.ART.mkdir(parents=True, exist_ok=True)
    out.to_parquet(S.OUT / "canonical_monitoring.parquet", index=False)
    pd.DataFrame(meta_rows).to_parquet(S.OUT / "inverter_metadata.parquet", index=False)
    # flat tariff for every inverter, anchored at the first day
    first_day = ts.min().normalize()
    pd.DataFrame([{"inverter_id": r["inverterId"], "week_start": first_day,
                   "eurocent_per_kwh": tariff * 100.0} for r in meta_rows]
                 ).to_parquet(S.OUT / "tariffs.parquet", index=False)
    pd.DataFrame(columns=["start", "end", "component", "category"]).to_parquet(S.OUT / "tickets.parquet", index=False)
    if (S.OUT / "_upload_src.parquet").exists():
        (S.OUT / "_upload_src.parquet").unlink()

    n_inv = len(meta_rows)
    span_days = int((ts.max() - ts.min()).days)
    has_irr = bool(mapping.get("irradiance"))
    has_dc = any(iv.get("idc") and iv.get("udc") for iv in invs)
    caps = build_capabilities(interval_h, span_days, n_inv, has_irr, has_dc, kwp_provided,
                              label=mapping.get("label", path.stem))
    (S.ART / "capabilities.json").write_text(json.dumps(caps, indent=2))
    log(f"normalized → {n_inv} inverters · {len(out):,} rows · {span_days}d span · interval {interval_h:.4f}h")
    return caps


def _detect_interval(ts: pd.Series) -> float:
    d = ts.sort_values().diff().dropna()
    return float(d.median().total_seconds() / 3600.0) if len(d) else 5 / 60


def build_capabilities(interval_h, span_days, n_inv, has_irr, has_dc, kwp_provided, label) -> dict:
    def cap(status, reason, requires=None):
        return {"status": status, "reason": reason, "requires": requires or []}

    core = cap("ok", "")
    if not has_irr:
        core = cap("missing_input", "No irradiance channel — expected-power modelling needs one.", ["irradiance"])
    elif n_inv == 0:
        core = cap("missing_input", "No inverter P_AC channels mapped.", ["P_AC"])

    degr = cap("ok", "")
    if span_days < MIN_YEARS_DEGRADATION * 365:
        yrs = round(span_days / 365.0, 1)
        degr = cap("insufficient_data", f"Degradation needs ≥3 operating years; only {yrs} yr provided.")

    dc = cap("ok", "") if has_dc else cap("missing_input", "No DC telemetry (I_DC_SUM + U_DC) mapped.", ["I_DC_SUM", "U_DC"])
    faults = cap("missing_input", "No error-code track in this dataset.", ["error codes"])
    soiling = cap("missing_input", "Soiling needs a dedicated plant dataset with coordinates.", ["plant B dataset"])

    ok = core["status"] == "ok"
    return {
        "label": label,
        "intervalH": round(float(interval_h), 5),
        "intervalLabel": _interval_label(interval_h),
        "spanDays": span_days,
        "nInverters": n_inv,
        "kwpSource": "provided" if kwp_provided else "estimated",
        "analyses": {
            "core": core,
            "degradation": degr if ok else cap("missing_input", "Core analysis unavailable."),
            "pr": cap("ok", "Performance ratio is approximate (kWp estimated)." if not kwp_provided else "") if ok else cap("missing_input", "Core analysis unavailable."),
            "dc": dc if ok else cap("missing_input", "Core analysis unavailable."),
            "fault_econ": faults,
            "faults": faults,
            "risk": cap("ok", "") if ok else cap("missing_input", "Core analysis unavailable."),
            "simulator": cap("ok", "") if ok else cap("missing_input", "Core analysis unavailable."),
            "soiling": soiling,
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--detect", action="store_true")
    ap.add_argument("--normalize", action="store_true")
    ap.add_argument("--mapping", help="path to mapping JSON (for --normalize)")
    args = ap.parse_args()
    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"file not found: {path}")

    if args.detect:
        print(json.dumps(detect(path)))
    elif args.normalize:
        mapping = json.loads(Path(args.mapping).read_text())
        caps = normalize(path, mapping)
        print(json.dumps({"ok": True, "capabilities": caps}))
    else:
        raise SystemExit("specify --detect or --normalize")


if __name__ == "__main__":
    main()
