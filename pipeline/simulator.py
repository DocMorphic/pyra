"""What-if simulator precompute — the "optimise" half of the digital twin.

The frontend lets an operator toggle interventions and watch recovered € / kWh
update live, plus a 1–5 year "do nothing vs act now" production forecast. To
keep that interactive we precompute, per inverter, the building blocks here.

Each inverter's VALIDATED daily loss (analytics' daily_expected) is partitioned
into mutually-exclusive, recoverable buckets by priority so they sum to the
loss ledger (no double-counting):
  dc          · day falls inside a detected DC-disconnect episode
  outage      · near-total daylight loss (actual < 25% of expected)
  fault       · day attributed to an error onset (within the fault window)
  degradation · everything else — the slow chronic shortfall

Plus degradation rate, recent annual yield, mean tariff and kWp — enough for the
UI to run scenarios and a degradation forecast without touching raw data.

Run AFTER analytics.py + dc_diag.py + fault_econ.py:  python pipeline/simulator.py
Output: public/artifacts/simulator.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

import sources as S

OUT = S.OUT
ART = S.ART

FAULT_WINDOW_DAYS = 4
OUTAGE_FRAC = 0.25       # daylight loss this severe = an outage (near-total)
BUCKETS = ["dc", "outage", "fault", "degradation"]


def main() -> None:
    ledger = {r["inverterId"]: r for r in json.loads((ART / "loss_ledger.json").read_text())}
    dc = json.loads((ART / "dc_diag.json").read_text())["perInverter"]

    daily = pd.read_parquet(OUT / "daily_expected.parquet")
    daily["date"] = pd.to_datetime(daily["date"])
    now = daily["date"].max()
    yr_ago = now - pd.Timedelta(days=365)

    ev = pd.read_parquet(OUT / "error_events.parquet")
    ev["ts"] = pd.to_datetime(ev["ts"])
    ev["date"] = ev["ts"].dt.normalize()

    per = {}
    fleet = {b: {"kwh": 0.0, "eur": 0.0} for b in BUCKETS}

    for inv, g in daily.groupby("inverter_id"):
        g = g.sort_values("date")
        L = ledger.get(inv, {})
        loss = g[g["loss_kwh"] > 0].copy()

        # bucket assignment per loss-day (priority: dc → outage → fault → degr)
        dc_ranges = [(pd.Timestamp(e["start"]), pd.Timestamp(e["end"]))
                     for e in dc.get(inv, {}).get("episodes", [])]
        onsets = ev[ev["inverter_id"] == inv][["date"]].sort_values("date")

        bucket_eur = {b: 0.0 for b in BUCKETS}
        bucket_kwh = {b: 0.0 for b in BUCKETS}
        if not loss.empty:
            # nearest preceding onset within the window → fault flag
            if not onsets.empty:
                m = pd.merge_asof(loss[["date"]], onsets.assign(onset=onsets["date"]),
                                  on="date", direction="backward",
                                  tolerance=pd.Timedelta(days=FAULT_WINDOW_DAYS))
                has_fault = m["onset"].notna().to_numpy()
            else:
                has_fault = np.zeros(len(loss), dtype=bool)

            dates = loss["date"].to_numpy()
            in_dc = np.zeros(len(loss), dtype=bool)
            for s, e in dc_ranges:
                in_dc |= (dates >= np.datetime64(s)) & (dates <= np.datetime64(e))
            sev = (loss["act_e"] < OUTAGE_FRAC * loss["exp_e"]).to_numpy()

            for i in range(len(loss)):
                if in_dc[i]:
                    b = "dc"
                elif sev[i]:
                    b = "outage"
                elif has_fault[i]:
                    b = "fault"
                else:
                    b = "degradation"
                bucket_eur[b] += float(loss["loss_eur"].iloc[i])
                bucket_kwh[b] += float(loss["loss_kwh"].iloc[i])

        for b in BUCKETS:
            fleet[b]["eur"] += bucket_eur[b]
            fleet[b]["kwh"] += bucket_kwh[b]

        recoverable = bucket_eur["dc"] + bucket_eur["outage"] + bucket_eur["fault"]
        per[inv] = {
            "kWp": L.get("kWp"),
            "health": L.get("health"),
            "degradationRatePctYr": L.get("degradationRate"),
            "recentAnnualKwh": round(float(g[g["date"] >= yr_ago]["act_e"].sum()), 0),
            "avgTariff": round(float(g["eur_per_kwh"].mean()), 4) if len(g) else 0.115,
            "lossByCause": {b: {"kwh": round(bucket_kwh[b], 0), "eur": round(bucket_eur[b], 0)} for b in BUCKETS},
            "recoverableEur": round(recoverable, 0),
            "lostEur": L.get("lostEur"),
        }

    ranked = sorted(per.items(), key=lambda kv: kv[1]["recoverableEur"], reverse=True)
    payload = {
        "asOf": str(now)[:10],
        "perInverter": per,
        "rankedByRecoverable": [inv for inv, _ in ranked],
        "fleetByCause": {b: {"kwh": round(fleet[b]["kwh"], 0), "eur": round(fleet[b]["eur"], 0)} for b in BUCKETS},
        "fleetRecoverableEur": round(sum(fleet[b]["eur"] for b in ("dc", "outage", "fault")), 0),
        "fleetTotalLossEur": round(sum(fleet[b]["eur"] for b in BUCKETS), 0),
    }
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "simulator.json").write_text(json.dumps(payload, indent=2))

    fb = payload["fleetByCause"]
    print(f"[pyra:simulator] simulator.json — {len(per)} inverters · as of {payload['asOf']}")
    print(f"  fleet loss by cause:  " + " · ".join(f"{b} €{fb[b]['eur']:,.0f}" for b in BUCKETS))
    print(f"  fleet recoverable (dc+outage+fault): €{payload['fleetRecoverableEur']:,.0f} "
          f"of €{payload['fleetTotalLossEur']:,.0f} total")
    for inv, v in ranked[:5]:
        print(f"  {inv}: recoverable €{v['recoverableEur']:,.0f} · "
              f"degr {v['degradationRatePctYr']}%/yr · {v['recentAnnualKwh']:,.0f} kWh/yr")


if __name__ == "__main__":
    main()
