"""Pyra analytics — the EnerParc deliverables.

For each inverter:
  1. Train an expected-power model on its FIRST YEAR of operation
     (features: irradiance, module/ambient temp, altitude).
  2. Predict expected power across the whole 10-year history.
  3. Attribute lost energy = max(expected - actual, 0) over daylight,
     NON-CURTAILED intervals (EVU/DV excluded), and value it with the
     per-week feed-in tariff → lost €.
  4. Track year-over-year normalized yield (degradation) vs year 1.
  5. Attribute a coarse top cause (outage / fault / degradation / curtailment).

Run AFTER build.py:  python pipeline/analytics.py
Outputs: app/public/artifacts/{loss_ledger,performance,causes}.json (+ updates meta.json)
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

import sources as S

OUT = Path(__file__).parent / "out"
ART = Path(__file__).parent.parent / "app" / "public" / "artifacts"

INTERVAL_H = 5.0 / 60.0
DAY_IRR = 20.0           # W/m² — above this we treat as productive daylight
CURTAIL_AVAIL = 99.5     # EVU/DV availability % below this = curtailed
FEATURES = ["irradiance", "module_temp", "ambient_temp", "altitude"]


def log(msg: str) -> None:
    print(f"[pyra:analytics] {msg}", flush=True)


def load_wide() -> tuple[pd.DataFrame, list[str]]:
    """One pass: ts + 65 P_AC columns (renamed to inverter id) + env, in memory."""
    con = duckdb.connect()
    P = str(S.MONITORING_PARQUET)
    cols = [c[0] for c in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{P}')").fetchall()]
    pac = {c: S.INV_RE.search(c).group(0) for c in cols if S.INV_RE.search(c) and "P_AC" in c}
    sel = ", ".join(f'"{c}" AS "{inv}"' for c, inv in pac.items())
    df = con.execute(f"""
        SELECT strptime("timestamp", '{S.TS_FORMAT}') AS ts,
               "Plant / Irradiation_average (W/m²)" AS irradiance,
               "Plant / Altitude (°)" AS altitude,
               "Temperature Sensor / Module (°C)" AS module_temp,
               "Temperature Sensor / Ambient (°C)" AS ambient_temp,
               "DRD11A / EVU (%)" AS evu,
               "DRD11A / DV (%)" AS dv,
               {sel}
        FROM read_parquet('{P}')
        ORDER BY ts
    """).df()
    inv_ids = sorted(pac.values())
    for c in ["irradiance", "altitude", "module_temp", "ambient_temp", "evu", "dv", *inv_ids]:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("float32")
    return df, inv_ids


def tariff_lookup() -> pd.DataFrame:
    tf = pd.read_parquet(OUT / "tariffs.parquet")
    tf["week_start"] = pd.to_datetime(tf["week_start"])
    return tf.sort_values("week_start")


def attach_tariff(rows: pd.DataFrame, inv_tf: pd.DataFrame) -> pd.Series:
    """€/kWh for each row via as-of merge on the weekly tariff steps."""
    if inv_tf.empty:
        return pd.Series(np.full(len(rows), 0.115), index=rows.index)  # fallback 11.5 ct
    left = rows[["ts"]].copy()
    left["ts"] = left["ts"].astype("datetime64[ns]")
    right = inv_tf[["week_start", "eurocent_per_kwh"]].copy()
    right["week_start"] = right["week_start"].astype("datetime64[ns]")
    merged = pd.merge_asof(
        left.sort_values("ts"),
        right.sort_values("week_start"),
        left_on="ts", right_on="week_start", direction="backward",
    )
    return (merged["eurocent_per_kwh"].to_numpy() / 100.0)


def main() -> None:
    S.check_data_present()
    log("loading wide monitoring frame…")
    df, inv_ids = load_wide()
    log(f"{len(df):,} rows · {len(inv_ids)} inverters in memory")

    meta = pd.read_parquet(OUT / "inverter_metadata.parquet").set_index("inverterId")
    errors = pd.read_parquet(OUT / "error_events.parquet")
    err_counts = errors.groupby("inverter_id").size().to_dict()
    tariffs = tariff_lookup()

    env = df[["ts", "irradiance", "altitude", "module_temp", "ambient_temp", "evu", "dv"]].copy()
    env["day_date"] = env["ts"].dt.normalize()
    daylight = env["irradiance"] > DAY_IRR
    # EVU/DV are AVAILABILITY % (100 = fully available; null = normal).
    # Curtailment = availability dips below ~100 from grid (EVU) or operator (DV).
    curtailed = ((env["evu"].notna()) & (env["evu"] < CURTAIL_AVAIL)) | \
                ((env["dv"].notna()) & (env["dv"] < CURTAIL_AVAIL))

    ledger, performance, causes = [], {}, {}
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

        # First year of operation = 365 days from first productive day.
        first_ts = sub.loc[sub["actual"] > 0.1, "ts"].min()
        if pd.isna(first_ts):
            continue
        y1 = sub[(sub["ts"] >= first_ts) & (sub["ts"] < first_ts + pd.Timedelta(days=365))]
        train = y1[~y1["curtailed"]]
        if len(train) < 300:
            train = sub[~sub["curtailed"]].head(5000)

        model = HistGradientBoostingRegressor(
            max_iter=200, max_depth=6, learning_rate=0.08, min_samples_leaf=40
        )
        model.fit(train[FEATURES].to_numpy(), train["actual"].to_numpy())
        sub["expected"] = np.clip(model.predict(sub[FEATURES].to_numpy()), 0, None)

        # Aggregate to DAILY energy over non-curtailed daylight BEFORE differencing
        # — per-sample clipping would turn model noise into a spurious loss floor.
        nc = sub[~sub["curtailed"]].copy()
        nc["date"] = pd.to_datetime(nc["ts"]).dt.normalize()
        day = nc.groupby("date").agg(act_e=("actual", "sum"), exp_e=("expected", "sum"))
        day[["act_e", "exp_e"]] *= INTERVAL_H
        gap = day["exp_e"] - day["act_e"]
        # Deadband: only count days where actual falls >3% below expected (model tol).
        day["loss_kwh"] = np.where(day["act_e"] < 0.97 * day["exp_e"], gap.clip(lower=0), 0.0)
        day = day.reset_index()
        day["eur_per_kwh"] = attach_tariff(day.rename(columns={"date": "ts"}),
                                           tariffs[tariffs["inverter_id"] == inv])
        day["loss_eur"] = day["loss_kwh"] * day["eur_per_kwh"]

        lost_kwh = float(day["loss_kwh"].sum())
        lost_eur = float(day["loss_eur"].sum())
        total_lost_eur += lost_eur

        # Yearly normalized yield (actual/expected) on non-curtailed daylight,
        # baseline = year 1.
        nc["year"] = pd.to_datetime(nc["ts"]).dt.year
        yr = nc.groupby("year").agg(actual_e=("actual", "sum"), expected_e=("expected", "sum"))
        yr["pr"] = (yr["actual_e"] / yr["expected_e"]).clip(0, 1.2)
        base = yr["pr"].iloc[0] if len(yr) else 1.0
        yr["norm"] = yr["pr"] / base if base else yr["pr"]
        health = float(yr["pr"].iloc[-1]) if len(yr) else 1.0

        # Monthly actual vs expected (mean kW) for the Inspector chart.
        sub["month"] = pd.to_datetime(sub["ts"]).dt.to_period("M").dt.to_timestamp()
        mon = sub.groupby("month").agg(actual=("actual", "mean"), expected=("expected", "mean"))

        cause = attribute_cause(sub, yr, err_counts.get(inv, 0))
        m = meta.loc[inv] if inv in meta.index else None

        ledger.append({
            "inverterId": inv,
            "lostKwh": round(lost_kwh, 1),
            "lostEur": round(lost_eur, 1),
            "health": round(health, 3),
            "topCause": cause,
            "moduleType": (m["moduleType"] if m is not None else None),
            "kWp": (round(float(m["kWp"]), 1) if m is not None and pd.notna(m["kWp"]) else None),
            "errorCount": int(err_counts.get(inv, 0)),
        })
        performance[inv] = {
            "years": [{"year": int(y), "pr": round(float(r.pr), 3), "norm": round(float(r.norm), 3)}
                      for y, r in yr.iterrows()],
            "monthly": [{"t": t.strftime("%Y-%m"), "actual": round(float(a), 2), "expected": round(float(e), 2)}
                        for t, a, e in zip(mon.index, mon["actual"], mon["expected"])],
        }
        causes[inv] = cause

    ledger.sort(key=lambda r: r["lostEur"], reverse=True)
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "loss_ledger.json").write_text(json.dumps(ledger, indent=2))
    (ART / "performance.json").write_text(json.dumps(performance))
    (ART / "causes.json").write_text(json.dumps(causes, indent=2))

    # Fold headline totals into meta.json.
    meta_path = ART / "meta.json"
    meta_json = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta_json["totalLostEur"] = round(total_lost_eur, 0)
    meta_json["totalLostKwh"] = round(sum(r["lostKwh"] for r in ledger), 0)
    meta_json["worstInverter"] = ledger[0]["inverterId"] if ledger else None
    meta_path.write_text(json.dumps(meta_json, indent=2))

    log(f"loss_ledger: {len(ledger)} inverters · total lost €{total_lost_eur:,.0f}")
    if ledger:
        top = ledger[0]
        log(f"worst: {top['inverterId']} — €{top['lostEur']:,.0f} lost, health {top['health']}, cause {top['topCause']}")


def attribute_cause(sub: pd.DataFrame, yr: pd.DataFrame, err_count: int) -> str:
    """Coarse driver attribution for an inverter's losses."""
    nc = sub[~sub["curtailed"]]
    if len(nc) == 0:
        return "curtailment"
    # Outage: daylight, non-curtailed, model expects power but actual ~0.
    outage_frac = float(((nc["expected"] > 2.0) & (nc["actual"] < 0.1)).mean())
    curt_frac = float(sub["curtailed"].mean())
    decline = 0.0
    if len(yr) >= 3:
        decline = float(yr["norm"].iloc[0] - yr["norm"].iloc[-1])

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
    # Sustained underperformance with no acute signal → gradual degradation.
    if health < 0.93:
        return "degradation"
    return "unknown"


if __name__ == "__main__":
    main()
