"""Plant B soiling analysis — the second plant in the challenge is irradiance-
rich and soiling-focused, so here we isolate the soiling signal.

Method (IEC 61724-1 style soiling ratio):
  1. duckdb aggregates the 407 MB Plant B csv (semicolon / decimal-comma) to a
     daily table: plant yield, plane-of-array insolation, module temp.
  2. pvlib clear-sky (Ineichen) at the plant coordinates gives each day a
     clarity index; we keep CLEAR days only, so weather doesn't masquerade as
     soiling.
  3. Daily temperature-corrected performance ratio PR. The recently-cleaned
     performance is the rolling upper envelope; soilingRatio = PR / envelope is
     the classic sawtooth — a slow decline as dust builds, snapped back up by
     rain or a cleaning.
  4. Decline segments → soiling rate (%/day); the mean deficit → annual soiling
     loss (% and €).

Plant B coords: 53.269 °N, 12.121 °E.  Run:  python pipeline/soiling.py
Output: public/artifacts/soiling.json
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import pvlib

warnings.filterwarnings("ignore")

ART = Path(__file__).parent.parent / "public" / "artifacts"
PLANT_B = Path(
    "/Users/dharmaydave/Downloads/EP-Challenge-Final -"
    "/Plant B  (optional, only plant A is sufficient too)"
    "/1. Main-monitoring-data/main_monitoring_data_plant_b.csv"
)
LAT, LON, ALT = 53.269, 12.121, 60.0
KWP = 7872.48           # inverter-only DC (the overview's 15745 double-counts AC combiners)
INTERVAL_H = 5.0 / 60.0
GAMMA, T_REF = -0.0037, 25.0
TARIFF = 0.085           # €/kWh (Plant B feed-in, approximate)
SOIL_MIN, SOIL_MAX = 0.02, 0.12   # plausible soiling-dip depth (deeper = fault/snow)


def log(msg: str) -> None:
    print(f"[pyra:soiling] {msg}", flush=True)


def daily_table() -> pd.DataFrame:
    con = duckdb.connect()
    P = str(PLANT_B)
    cols = [c[0] for c in con.execute(
        f"DESCRIBE SELECT * FROM read_csv('{P}', delim=';', decimal_separator=',', header=true, sample_size=-1)"
    ).fetchall()]
    import re
    pac = [c for c in cols if re.search(r"INV \d", c) and "P_AC" in c]
    pac_sum = " + ".join(f'COALESCE("{c}", 0)' for c in pac)
    irr = "Plant / Irradiation_average (W/m²)"
    tmod = "Temperatur / Module (°C)"
    df = con.execute(f"""
        SELECT CAST("timestamp" AS DATE) AS date,
               SUM(({pac_sum})) * {INTERVAL_H}            AS yield_kwh,
               SUM("{irr}") * {INTERVAL_H} / 1000.0       AS poa_insol,
               AVG("{tmod}")                              AS tmod,
               COUNT(*)                                   AS n
        FROM read_csv('{P}', delim=';', decimal_separator=',', header=true, sample_size=-1)
        WHERE "{irr}" IS NOT NULL
        GROUP BY 1 ORDER BY 1
    """).df()
    df["date"] = pd.to_datetime(df["date"])
    return df


def clearsky_daily(start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    times = pd.date_range(start, end + pd.Timedelta(days=1), freq="5min", tz="UTC")
    loc = pvlib.location.Location(LAT, LON, tz="UTC", altitude=ALT)
    cs = loc.get_clearsky(times, model="ineichen")["ghi"]
    daily = cs.resample("1D").sum() * INTERVAL_H / 1000.0   # kWh/m² clear-sky
    daily.index = daily.index.tz_localize(None).normalize()
    return daily


def main() -> None:
    if not PLANT_B.exists():
        raise SystemExit(f"Plant B csv not found at {PLANT_B}")
    log("aggregating Plant B daily (407 MB csv via duckdb)…")
    d = daily_table()
    log(f"{len(d)} days · {d['date'].min().date()} → {d['date'].max().date()}")

    cs = clearsky_daily(d["date"].min(), d["date"].max())
    d = d.set_index("date")
    d["cs_insol"] = cs.reindex(d.index)
    d["clarity"] = d["poa_insol"] / d["cs_insol"]
    d["pr"] = d["yield_kwh"] / (KWP * d["poa_insol"])
    d["pr_tc"] = d["pr"] / (1.0 + GAMMA * (d["tmod"] - T_REF))

    # Clear days only: enough sun, clarity near clear-sky, plausible PR.
    clear = d[(d["cs_insol"] > 1.5) & (d["clarity"].between(0.6, 1.08)) &
              (d["pr_tc"].between(0.3, 1.0))].copy()
    if len(clear) < 60:
        raise SystemExit("too few clear days to assess soiling")

    # "Recently-cleaned" reference = TRAILING 90th-pct of clear-day PR over the
    # last ~21 clear days. Because it trails, it resets up after every rain and
    # drifts down with degradation in lock-step with the numerator — so the
    # soiling ratio isolates the dust-then-rain sawtooth from slow degradation.
    clear["envelope"] = clear["pr_tc"].rolling(21, min_periods=6).quantile(0.90)
    clear["soiling_ratio"] = (clear["pr_tc"] / clear["envelope"]).clip(0.5, 1.03)
    clear["sr_smooth"] = clear["soiling_ratio"].rolling(5, center=True, min_periods=2).median()

    # --- soiling episodes: a dip below ~0.97 that later recovers (rain/clean) ---
    sr = clear["sr_smooth"].to_numpy()
    dates = clear.index
    episodes = []
    i, n = 0, len(sr)
    while i < n:
        if not np.isfinite(sr[i]) or sr[i] >= 0.975:
            i += 1
            continue
        start = i
        trough, tj = sr[i], i
        j = i
        while j < n - 1 and (not np.isfinite(sr[j + 1]) or sr[j + 1] < 0.99):
            j += 1
            if np.isfinite(sr[j]) and sr[j] < trough:
                trough, tj = sr[j], j
        depth = 1.0 - trough
        decline_days = max((dates[tj] - dates[start]).days, 1)
        span = (dates[j] - dates[start]).days
        # A soiling dip is shallow (≤ SOIL_MAX) and rain-reset within weeks;
        # deeper/longer dips are faults, snow or outages — not dust.
        if SOIL_MIN < depth <= SOIL_MAX and 7 <= span <= 60 and decline_days <= 45:
            episodes.append({
                "start": str(dates[start].date()),
                "trough": str(dates[tj].date()),
                "end": str(dates[j].date()),
                "days": int(span),
                "depthPct": round(depth * 100, 1),
                "ratePctPerDay": round(-depth / decline_days * 100.0, 3),
            })
        i = j + 1

    # Representative accumulation rate from gradual episodes (≥14-day decline);
    # short steep dips reflect weather, not dust buildup.
    grad = [e["ratePctPerDay"] for e in episodes
            if (pd.Timestamp(e["trough"]) - pd.Timestamp(e["start"])).days >= 14]
    rates = grad or [e["ratePctPerDay"] for e in episodes]
    soiling_rate = round(float(np.median(rates)), 3) if rates else None
    # Attribute only the shallow part of each deficit to soiling (deep dips are
    # faults/snow, booked elsewhere) so the soiling-loss figure isn't inflated.
    deficit = (1.0 - clear["soiling_ratio"]).clip(lower=0, upper=SOIL_MAX)
    total_loss_pct = round(float(deficit.mean()) * 100, 2)
    annual_yield = float(d[d.index >= d.index.max() - pd.Timedelta(days=365)]["yield_kwh"].sum())
    annual_loss_kwh = round(annual_yield * total_loss_pct / 100.0, 0)
    annual_loss_eur = round(annual_loss_kwh * TARIFF, 0)

    # Downsample the soiling-ratio series for the chart (weekly clear-day median).
    weekly = clear["soiling_ratio"].resample("1W").median().dropna()
    series = [{"t": str(t.date()), "v": round(float(v), 3)} for t, v in weekly.items()]

    payload = {
        "plant": "Plant B",
        "coords": {"lat": LAT, "lon": LON},
        "kWp": KWP,
        "clearDays": int(len(clear)),
        "soilingRatePctPerDay": soiling_rate,
        "totalSoilingLossPct": total_loss_pct,
        "annualSoilingLossKwh": annual_loss_kwh,
        "annualSoilingLossEur": annual_loss_eur,
        "meanPR": round(float(clear["pr_tc"].median()), 3),
        "episodes": sorted(episodes, key=lambda e: e["depthPct"], reverse=True)[:30],
        "series": series,
    }
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "soiling.json").write_text(json.dumps(payload))

    log(f"soiling.json — {len(clear)} clear days · median PR {payload['meanPR']}")
    log(f"  soiling rate {soiling_rate} %/day · {len(episodes)} episodes · "
        f"avg deficit {total_loss_pct}% → ~{annual_loss_kwh:,.0f} kWh/yr (€{annual_loss_eur:,.0f})")
    for e in payload["episodes"][:5]:
        log(f"  {e['start']}→{e['trough']} {e['days']}d depth {e['depthPct']}% ({e['ratePctPerDay']}%/day)")


if __name__ == "__main__":
    main()
