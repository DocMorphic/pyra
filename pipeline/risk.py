"""Failure-risk scoring + ticket intelligence — "which inverter do we service
next, and why?"

Blends the signals the other modules already validated into a transparent
0–100 risk score per inverter, each contribution kept as a named driver so the
score is explainable (no black box):

  health  · current normalised yield (lower = worse)
  degr    · degradation rate %/yr
  errors  · fault-onset rate in the last 12 months vs the fleet
  trend   · is the error rate rising (recent 6 mo vs prior 6 mo)?
  dc      · recent DC-disconnect events / chronic string shortfall
  peer    · health vs same-module-type peers
  ticket  · recent O&M tickets naming this inverter

It also links the 83 O&M tickets to inverters (many name an INV id directly)
and checks whether our error onsets LEAD the tickets — i.e. could the twin have
flagged the failure before the truck rolled.

Run AFTER build.py + analytics.py + dc_diag.py:  python pipeline/risk.py
Output: public/artifacts/risk.json
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).parent / "out"
ART = Path(__file__).parent.parent / "public" / "artifacts"
INV_RE = re.compile(r"INV \d{2}\.\d{2}\.\d{3}")

WEIGHTS = {
    "health": 0.24, "degr": 0.18, "errors": 0.16,
    "trend": 0.10, "dc": 0.14, "peer": 0.10, "ticket": 0.08,
}
DRIVER_LABEL = {
    "health": "Low health",
    "degr": "Degrading",
    "errors": "High fault rate",
    "trend": "Rising faults",
    "dc": "DC / string fault",
    "peer": "Below peers",
    "ticket": "Recent tickets",
}


def clip01(x: float) -> float:
    return float(min(max(x, 0.0), 1.0))


def main() -> None:
    ledger = {r["inverterId"]: r for r in json.loads((ART / "loss_ledger.json").read_text())}
    dc = json.loads((ART / "dc_diag.json").read_text())["perInverter"]

    ev = pd.read_parquet(OUT / "error_events.parquet")
    ev["ts"] = pd.to_datetime(ev["ts"])
    now = ev["ts"].max()
    w12, w6 = now - pd.Timedelta(days=365), now - pd.Timedelta(days=182)
    w24 = now - pd.Timedelta(days=730)

    recent12 = ev[ev["ts"] >= w12].groupby("inverter_id").size()
    recent6 = ev[ev["ts"] >= w6].groupby("inverter_id").size()
    prior6 = ev[(ev["ts"] >= w12) & (ev["ts"] < w6)].groupby("inverter_id").size()
    fleet_p90 = float(np.percentile(recent12.values, 90)) if len(recent12) else 1.0
    fleet_p90 = max(fleet_p90, 1.0)

    # --- tickets: link to inverters + lead-time vs our error onsets ---
    tk = pd.read_parquet(OUT / "tickets.parquet")
    tk["start"] = pd.to_datetime(tk["start"], utc=True).dt.tz_localize(None)
    tk["inv"] = tk["component"].astype(str).str.extract(r"(INV \d{2}\.\d{2}\.\d{3})")[0]
    linked = tk[tk["inv"].notna()].copy()
    tickets_by_inv = linked.groupby("inv").size().to_dict()
    recent_tickets_by_inv = linked[linked["start"] >= w24].groupby("inv").size().to_dict()

    # lead-time: errors in the 30 days before each inverter-linked ticket
    leads = []
    for _, t in linked.iterrows():
        pre = ev[(ev["inverter_id"] == t["inv"]) &
                 (ev["ts"] < t["start"]) & (ev["ts"] >= t["start"] - pd.Timedelta(days=30))]
        if len(pre):
            leads.append((t["start"] - pre["ts"].max()).days)
    ticket_link = {
        "linkedTickets": int(len(linked)),
        "totalTickets": int(len(tk)),
        "withPrecedingErrors": int(len(leads)),
        "medianLeadDays": int(np.median(leads)) if leads else None,
        "topCategories": [
            {"category": str(c), "count": int(n)}
            for c, n in tk["category"].value_counts().head(6).items() if str(c) != "nan"
        ],
    }

    per = {}
    for inv, L in ledger.items():
        health = L.get("health", 1.0)
        degr = L.get("degradationRate")
        peer = L.get("peerDelta", 0.0)
        d = dc.get(inv, {})
        recent_dc = sum(1 for e in d.get("episodes", []) if e["end"] >= str(w24)[:10])
        chronic = d.get("chronicStringsDown")

        s = {
            "health": clip01((0.96 - health) / 0.12),
            "degr": clip01(-(degr or 0) / 2.5),
            "errors": clip01(float(recent12.get(inv, 0)) / fleet_p90),
            "trend": clip01((float(recent6.get(inv, 0)) - float(prior6.get(inv, 0))) /
                            (float(prior6.get(inv, 0)) + 5.0)),
            "dc": clip01(0.6 * recent_dc + (0.5 if chronic else 0.0)),
            "peer": clip01(-peer / 0.08),
            "ticket": clip01(float(recent_tickets_by_inv.get(inv, 0)) / 2.0),
        }
        score = sum(WEIGHTS[k] * s[k] for k in WEIGHTS)
        risk = round(100.0 * score, 1)
        drivers = sorted(
            [{"key": k, "label": DRIVER_LABEL[k], "contribution": round(WEIGHTS[k] * s[k] * 100, 1)}
             for k in WEIGHTS if s[k] > 0.15],
            key=lambda x: x["contribution"], reverse=True,
        )[:4]
        per[inv] = {
            "risk": risk,
            "health": health,
            "degradationRate": degr,
            "recentErrors12mo": int(recent12.get(inv, 0)),
            "errorTrend": round(s["trend"], 2),
            "recentDcEvents": int(recent_dc),
            "tickets": int(tickets_by_inv.get(inv, 0)),
            "drivers": drivers,
        }

    ranked = sorted(per.items(), key=lambda kv: kv[1]["risk"], reverse=True)
    payload = {
        "asOf": str(now)[:10],
        "perInverter": per,
        "ranked": [inv for inv, _ in ranked],
        "ticketLink": ticket_link,
        "weights": WEIGHTS,
    }
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "risk.json").write_text(json.dumps(payload, indent=2))

    print(f"[pyra:risk] risk.json — {len(per)} inverters scored · as of {payload['asOf']}")
    print(f"[pyra:risk] tickets: {ticket_link['linkedTickets']}/{ticket_link['totalTickets']} "
          f"name an inverter · {ticket_link['withPrecedingErrors']} preceded by our error onsets "
          f"(median lead {ticket_link['medianLeadDays']}d)")
    for inv, v in ranked[:8]:
        drv = ", ".join(x["label"] for x in v["drivers"])
        print(f"  {inv}: risk {v['risk']:>5} · health {v['health']} · "
              f"{v['recentErrors12mo']} errs/12mo · {v['tickets']} tix · [{drv}]")


if __name__ == "__main__":
    main()
