"""Pyra analytics — the EnerParc scientific core.

Per inverter:
  1. Expected-power ML model trained on the FIRST operating year
     (features: irradiance, module/ambient temp, altitude).
  2. Held-out validation of that model (R²/MAE/MBE, relative residual σ).
  3. Independent pvlib PVWatts physics expected-power cross-check.
  4. Lost energy = (expected − actual) over daylight, NON-CURTAILED intervals
     (EVU/DV availability < 100% excluded), valued at the per-week tariff,
     with a confidence interval from the model residual σ.
  5. IEC 61724 Performance Ratio (raw + temperature-corrected), per year.
  6. Degradation rate (%/yr) from year-over-year normalised yield.
  7. Failure-onset month (change-point on the monthly PR series).
  8. Cause attribution → recoverable vs permanent loss split.

Plant-wide: Σ inverter energy reconciled against the Janitza feed-in meter;
degradation + PR aggregated by module type; peer-residual anomaly per inverter.

Run AFTER build.py:  python pipeline/analytics.py
Outputs: public/artifacts/{loss_ledger,performance,causes,degradation,model_metrics}.json
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

import sources as S
import physics

warnings.filterwarnings("ignore")

OUT = Path(__file__).parent / "out"
ART = Path(__file__).parent.parent / "public" / "artifacts"

INTERVAL_H = 5.0 / 60.0
DAY_IRR = 20.0
CURTAIL_AVAIL = 99.5
G_REF = 1000.0           # W/m² reference irradiance for PR
FEATURES = ["irradiance", "module_temp", "ambient_temp", "altitude"]


def log(msg: str) -> None:
    print(f"[pyra:analytics] {msg}", flush=True)


def load_wide() -> tuple[pd.DataFrame, list[str]]:
    con = duckdb.connect()
    P = str(S.MONITORING_PARQUET)
    cols = [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{P}')").fetchall()]
    pac = {c: S.INV_RE.search(c).group(0) for c in cols if S.INV_RE.search(c) and "P_AC" in c}
    sel = ", ".join(f'"{c}" AS "{inv}"' for c, inv in pac.items())
    janitza = next((c for c in cols if c.startswith("Janitza") and "P_AC" in c), None)
    jsel = f', "{janitza}" AS plant_pac' if janitza else ""
    df = con.execute(f"""
        SELECT strptime("timestamp", '{S.TS_FORMAT}') AS ts,
               "Plant / Irradiation_average (W/m²)" AS irradiance,
               "Plant / Altitude (°)" AS altitude,
               "Temperature Sensor / Module (°C)" AS module_temp,
               "Temperature Sensor / Ambient (°C)" AS ambient_temp,
               "DRD11A / EVU (%)" AS evu,
               "DRD11A / DV (%)" AS dv{jsel},
               {sel}
        FROM read_parquet('{P}')
        ORDER BY ts
    """).df()
    inv_ids = sorted(pac.values())
    numeric = ["irradiance", "altitude", "module_temp", "ambient_temp", "evu", "dv", *inv_ids]
    if janitza:
        numeric.append("plant_pac")
    for c in numeric:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("float32")
    return df, inv_ids


def tariff_lookup() -> pd.DataFrame:
    tf = pd.read_parquet(OUT / "tariffs.parquet")
    tf["week_start"] = pd.to_datetime(tf["week_start"])
    return tf.sort_values("week_start")


def attach_tariff(rows: pd.DataFrame, inv_tf: pd.DataFrame) -> np.ndarray:
    if inv_tf.empty:
        return np.full(len(rows), 0.115)
    left = rows[["ts"]].copy()
    left["ts"] = left["ts"].astype("datetime64[ns]")
    right = inv_tf[["week_start", "eurocent_per_kwh"]].copy()
    right["week_start"] = right["week_start"].astype("datetime64[ns]")
    merged = pd.merge_asof(
        left.sort_values("ts"), right.sort_values("week_start"),
        left_on="ts", right_on="week_start", direction="backward",
    )
    return merged["eurocent_per_kwh"].to_numpy() / 100.0


def validate(train: pd.DataFrame) -> dict:
    """Time-split holdout (80/20) of the year-1 healthy data → model metrics."""
    if len(train) < 200:
        return {"r2": None, "mae": None, "mbe": None, "relSigma": 0.08}
    t = train.sort_values("ts")
    cut = int(len(t) * 0.8)
    tr, va = t.iloc[:cut], t.iloc[cut:]
    m = HistGradientBoostingRegressor(max_iter=200, max_depth=6, learning_rate=0.08, min_samples_leaf=40)
    m.fit(tr[FEATURES].to_numpy(), tr["actual"].to_numpy())
    pred = np.clip(m.predict(va[FEATURES].to_numpy()), 0, None)
    act = va["actual"].to_numpy()
    resid = pred - act
    mean_act = max(act.mean(), 1e-6)
    return {
        "r2": round(float(r2_score(act, pred)), 4),
        "mae": round(float(mean_absolute_error(act, pred)), 4),
        "mbe": round(float(resid.mean()), 4),               # bias
        "relSigma": round(float(resid.std() / mean_act), 4),  # for CI on energy
    }


def find_onset(mon: pd.DataFrame) -> str | None:
    """First month where the 3-month rolling PR drops >15% below the year-1 baseline."""
    if len(mon) < 18:
        return None
    pr = (mon["actual"] / mon["expected"].replace(0, np.nan)).clip(0, 1.2)
    roll = pr.rolling(3, min_periods=2).mean()
    base = roll.iloc[:12].median()
    if not np.isfinite(base) or base <= 0:
        return None
    below = roll < base * 0.85
    # require 3 consecutive months below to count as an onset
    for i in range(12, len(below) - 2):
        if below.iloc[i] and below.iloc[i + 1] and below.iloc[i + 2]:
            return mon.index[i].strftime("%Y-%m")
    return None


def main() -> None:
    S.check_data_present()
    log("loading wide monitoring frame…")
    df, inv_ids = load_wide()
    log(f"{len(df):,} rows · {len(inv_ids)} inverters in memory")

    loc = physics.derive_location(df[["ts", "altitude"]])
    log(f"plant location: {loc['lat']},{loc['lon']} (rmse {loc.get('rmse_deg')}° · {loc['source']})")

    meta = pd.read_parquet(OUT / "inverter_metadata.parquet").set_index("inverterId")
    errors = pd.read_parquet(OUT / "error_events.parquet")
    err_counts = errors.groupby("inverter_id").size().to_dict()
    tariffs = tariff_lookup()

    env = df[["ts", "irradiance", "altitude", "module_temp", "ambient_temp", "evu", "dv"]].copy()
    daylight = env["irradiance"] > DAY_IRR
    curtailed = ((env["evu"].notna()) & (env["evu"] < CURTAIL_AVAIL)) | \
                ((env["dv"].notna()) & (env["dv"] < CURTAIL_AVAIL))
    has_plant = "plant_pac" in df.columns

    ledger, performance, causes, metrics = [], {}, {}, {}
    daily_frames = []   # per-inverter daily expected/actual/loss → out/daily_expected.parquet
    plant_inv_kwh = 0.0
    total_lost_eur = 0.0

    for inv in inv_ids:
        actual = df[inv]
        present = actual.notna() & daylight
        if present.sum() < 500:
            continue
        sub = pd.DataFrame({
            "ts": env.loc[present, "ts"].values,
            "irradiance": env.loc[present, "irradiance"].values,
            "module_temp": env.loc[present, "module_temp"].values,
            "ambient_temp": env.loc[present, "ambient_temp"].values,
            "altitude": env.loc[present, "altitude"].values,
            "actual": actual[present].values,
            "curtailed": curtailed[present].values,
        }).dropna(subset=FEATURES)
        sub["year"] = pd.to_datetime(sub["ts"]).dt.year

        first_ts = sub.loc[sub["actual"] > 0.1, "ts"].min()
        if pd.isna(first_ts):
            continue
        y1 = sub[(sub["ts"] >= first_ts) & (sub["ts"] < first_ts + pd.Timedelta(days=365))]
        train = y1[~y1["curtailed"]]
        if len(train) < 300:
            train = sub[~sub["curtailed"]].head(5000)

        val = validate(train)
        rel_sigma = val["relSigma"] or 0.08

        model = HistGradientBoostingRegressor(max_iter=200, max_depth=6, learning_rate=0.08, min_samples_leaf=40)
        model.fit(train[FEATURES].to_numpy(), train["actual"].to_numpy())
        sub["expected"] = np.clip(model.predict(sub[FEATURES].to_numpy()), 0, None)

        kwp = float(meta.loc[inv, "kWp"]) if inv in meta.index and pd.notna(meta.loc[inv, "kWp"]) else None
        # Physics (PVWatts) expected — independent cross-check.
        if kwp:
            sub["physics"] = physics.pvwatts_expected(sub["irradiance"].values, sub["module_temp"].values, kwp)

        nc = sub[~sub["curtailed"]].copy()
        nc["date"] = pd.to_datetime(nc["ts"]).dt.normalize()
        nc["year"] = pd.to_datetime(nc["ts"]).dt.year

        # --- daily-aggregated loss with deadband ---
        day = nc.groupby("date").agg(act_e=("actual", "sum"), exp_e=("expected", "sum"))
        day[["act_e", "exp_e"]] *= INTERVAL_H
        gap = day["exp_e"] - day["act_e"]
        day["loss_kwh"] = np.where(day["act_e"] < 0.97 * day["exp_e"], gap.clip(lower=0), 0.0)
        day = day.reset_index()
        day["eur_per_kwh"] = attach_tariff(day.rename(columns={"date": "ts"}),
                                           tariffs[tariffs["inverter_id"] == inv])
        day["loss_eur"] = day["loss_kwh"] * day["eur_per_kwh"]
        lost_kwh = float(day["loss_kwh"].sum())
        lost_eur = float(day["loss_eur"].sum())
        # persist this inverter's daily expected/actual/loss for downstream
        # modules (fault economics, risk, simulator) — computed once, here.
        df_keep = day[["date", "act_e", "exp_e", "loss_kwh", "loss_eur", "eur_per_kwh"]].copy()
        df_keep.insert(0, "inverter_id", inv)
        daily_frames.append(df_keep)
        # CI on attributed lost energy: daily residuals are ~independent, so the
        # uncertainty on the multi-day sum scales with √(n_days), not n_days.
        n_days = max(len(day), 1)
        ci = 1.96 * rel_sigma * float(day["exp_e"].sum()) / np.sqrt(n_days)
        avg_tariff = float(day["eur_per_kwh"].mean()) if len(day) else 0.115
        ci_eur = ci * avg_tariff   # CI centered on the point estimate
        lost_eur_lo = max(0.0, lost_eur - ci_eur)
        lost_eur_hi = lost_eur + ci_eur
        total_lost_eur += lost_eur
        plant_inv_kwh += float(day["act_e"].sum())

        # --- yearly PR (IEC 61724) + normalised yield ---
        yg = nc.groupby("year").agg(
            act_e=("actual", "sum"), exp_e=("expected", "sum"),
            poa=("irradiance", "sum"), tmod=("module_temp", "mean"),
        )
        yg[["act_e", "exp_e"]] *= INTERVAL_H
        yg["h_poa"] = yg["poa"] * INTERVAL_H / 1000.0   # kWh/m²
        yg["pr"] = ((yg["act_e"] / kwp) / (yg["h_poa"] / (G_REF / 1000.0))) if kwp else np.nan
        # temperature-corrected PR (IEC 61724-1 Ck factor)
        yg["pr_tc"] = yg["pr"] / (1.0 + physics.GAMMA * (yg["tmod"] - physics.T_REF))
        yg["norm"] = (yg["act_e"] / yg["exp_e"]).clip(0, 1.2)
        base = yg["norm"].iloc[0] if len(yg) else 1.0
        yg["ny"] = yg["norm"] / base if base else yg["norm"]
        health = float(yg["norm"].iloc[-1]) if len(yg) else 1.0

        # degradation rate %/yr from year-over-year normalised yield
        degr_rate = None
        if len(yg) >= 3:
            yrs = np.array([int(y) for y in yg.index], dtype=float)
            slope = float(np.polyfit(yrs - yrs[0], yg["ny"].to_numpy(), 1)[0])
            degr_rate = round(slope * 100.0, 2)   # %/yr (negative = degrading)

        # monthly series (mean kW) for the chart
        sub["month"] = pd.to_datetime(sub["ts"]).dt.to_period("M").dt.to_timestamp()
        mon = sub.groupby("month").agg(actual=("actual", "mean"), expected=("expected", "mean"))
        onset = find_onset(mon)

        # physics vs ML agreement on healthy year-1 (energy ratio)
        phys_agree = None
        if kwp:
            ml_e = float(np.clip(model.predict(y1[FEATURES].to_numpy()), 0, None).sum())
            ph_e = float(physics.pvwatts_expected(y1["irradiance"].values, y1["module_temp"].values, kwp).sum())
            if ph_e > 0:
                phys_agree = round(ml_e / ph_e, 3)

        cause = attribute_cause(sub, yg, err_counts.get(inv, 0))
        permanent = lost_eur if cause == "degradation" else 0.0
        recoverable = 0.0 if cause == "degradation" else lost_eur
        m = meta.loc[inv] if inv in meta.index else None

        ledger.append({
            "inverterId": inv,
            "lostKwh": round(lost_kwh, 1),
            "lostEur": round(lost_eur, 1),
            "lostEurLo": round(lost_eur_lo, 1),
            "lostEurHi": round(lost_eur_hi, 1),
            "health": round(health, 3),
            "degradationRate": degr_rate,
            "topCause": cause,
            "onset": onset,
            "recoverableEur": round(recoverable, 1),
            "permanentEur": round(permanent, 1),
            "moduleType": (m["moduleType"] if m is not None else None),
            "kWp": (round(kwp, 1) if kwp else None),
            "errorCount": int(err_counts.get(inv, 0)),
            "modelR2": val["r2"],
        })
        performance[inv] = {
            "years": [{"year": int(y), "pr": _r(r.pr), "prTc": _r(r.pr_tc), "norm": _r(r.ny)}
                      for y, r in yg.iterrows()],
            "monthly": [{"t": t.strftime("%Y-%m"), "actual": round(float(a), 2), "expected": round(float(e), 2),
                         "lo": round(float(e) * (1 - 1.96 * rel_sigma), 2),
                         "hi": round(float(e) * (1 + 1.96 * rel_sigma), 2)}
                        for t, a, e in zip(mon.index, mon["actual"], mon["expected"])],
            "onset": onset,
        }
        metrics[inv] = {"r2": val["r2"], "mae": val["mae"], "mbe": val["mbe"],
                        "relSigma": rel_sigma, "physicsAgreement": phys_agree, "degradationRate": degr_rate}
        causes[inv] = cause

    ledger.sort(key=lambda r: r["lostEur"], reverse=True)

    # --- peer-residual: each inverter vs its module-type peer-median health ---
    by_type: dict[str, list[float]] = {}
    for r in ledger:
        by_type.setdefault(r["moduleType"], []).append(r["health"])
    type_median = {t: float(np.median(v)) for t, v in by_type.items()}
    for r in ledger:
        med = type_median.get(r["moduleType"], r["health"])
        r["peerDelta"] = round(r["health"] - med, 3)

    # --- module-type aggregates ---
    mt = {}
    for t in by_type:
        rows = [r for r in ledger if r["moduleType"] == t]
        rates = [r["degradationRate"] for r in rows if r["degradationRate"] is not None]
        mt[t] = {
            "count": len(rows),
            "medianHealth": round(type_median[t], 3),
            "medianDegradationRate": round(float(np.median(rates)), 2) if rates else None,
            "lostEur": round(sum(r["lostEur"] for r in rows), 0),
            "kWp": round(sum(r["kWp"] or 0 for r in rows), 1),
        }

    # --- plant-meter reconciliation ---
    reconciliation = None
    if has_plant:
        # Meter sign convention: grid feed-in is negative → flip to generation.
        pm = df[["ts", "plant_pac"]].dropna()
        plant_kwh = float((-pm["plant_pac"]).clip(lower=0).sum()) * INTERVAL_H
        if plant_kwh > 0:
            reconciliation = {
                "inverterSumKwh": round(plant_inv_kwh, 0),
                "plantMeterKwh": round(plant_kwh, 0),
                "ratio": round(plant_inv_kwh / plant_kwh, 3),
            }

    if daily_frames:
        daily_all = pd.concat(daily_frames, ignore_index=True)
        daily_all.to_parquet(OUT / "daily_expected.parquet", index=False)
        log(f"daily_expected: {len(daily_all):,} inverter-days persisted")

    ART.mkdir(parents=True, exist_ok=True)
    (ART / "loss_ledger.json").write_text(json.dumps(ledger, indent=2))
    (ART / "performance.json").write_text(json.dumps(performance))
    (ART / "causes.json").write_text(json.dumps(causes, indent=2))
    (ART / "degradation.json").write_text(json.dumps({"byModuleType": mt}, indent=2))

    valid_r2 = [m["r2"] for m in metrics.values() if m["r2"] is not None]
    agreements = [m["physicsAgreement"] for m in metrics.values() if m["physicsAgreement"]]
    model_metrics = {
        "location": loc,
        "perInverter": metrics,
        "meanR2": round(float(np.mean(valid_r2)), 4) if valid_r2 else None,
        "medianPhysicsAgreement": round(float(np.median(agreements)), 3) if agreements else None,
        "reconciliation": reconciliation,
    }
    (ART / "model_metrics.json").write_text(json.dumps(model_metrics, indent=2))

    # headline totals
    meta_path = ART / "meta.json"
    mj = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    mj["totalLostEur"] = round(total_lost_eur, 0)
    mj["totalLostKwh"] = round(sum(r["lostKwh"] for r in ledger), 0)
    mj["recoverableEur"] = round(sum(r["recoverableEur"] for r in ledger), 0)
    mj["permanentEur"] = round(sum(r["permanentEur"] for r in ledger), 0)
    mj["worstInverter"] = ledger[0]["inverterId"] if ledger else None
    mj["meanModelR2"] = model_metrics["meanR2"]
    mj["location"] = loc
    meta_path.write_text(json.dumps(mj, indent=2))

    log(f"loss_ledger: {len(ledger)} inverters · total lost €{total_lost_eur:,.0f} "
        f"(recoverable €{mj['recoverableEur']:,.0f})")
    log(f"mean model R²: {model_metrics['meanR2']} · physics agreement (median): {model_metrics['medianPhysicsAgreement']}")
    if reconciliation:
        log(f"plant-meter reconciliation: Σinv/meter = {reconciliation['ratio']}")
    if ledger:
        t = ledger[0]
        log(f"worst: {t['inverterId']} — €{t['lostEur']:,.0f} ({t['lostEurLo']:,.0f}–{t['lostEurHi']:,.0f}), "
            f"health {t['health']}, {t['topCause']}, onset {t['onset']}, degr {t['degradationRate']}%/yr")


def _r(x) -> float | None:
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), 3)


def attribute_cause(sub: pd.DataFrame, yg: pd.DataFrame, err_count: int) -> str:
    nc = sub[~sub["curtailed"]]
    if len(nc) == 0:
        return "curtailment"
    outage_frac = float(((nc["expected"] > 2.0) & (nc["actual"] < 0.1)).mean())
    curt_frac = float(sub["curtailed"].mean())
    decline = float(yg["ny"].iloc[0] - yg["ny"].iloc[-1]) if len(yg) >= 3 else 0.0
    health = float((nc["actual"].sum() / nc["expected"].sum())) if nc["expected"].sum() else 1.0

    if outage_frac > 0.04:
        return "outage"
    if err_count > 150 and outage_frac > 0.005:
        return "fault"
    if decline > 0.05:
        return "degradation"
    if curt_frac > 0.05:
        return "curtailment"
    if err_count > 150:
        return "fault"
    if health < 0.93:
        return "degradation"
    return "unknown"


if __name__ == "__main__":
    main()
