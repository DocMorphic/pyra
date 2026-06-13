"""Emit fault + ticket artifacts for the Fault Timeline window.

Reads the already-built pipeline/out parquets (fast — no monitoring re-scan).
Run AFTER build.py:  python pipeline/faults.py
Outputs: public/artifacts/{faults,tickets}.json
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

import sources as S

OUT = S.OUT
ART = S.ART
ART.mkdir(parents=True, exist_ok=True)


def main() -> None:
    ev = pd.read_parquet(OUT / "error_events.parquet")
    ev["ts"] = pd.to_datetime(ev["ts"])
    ev["month"] = ev["ts"].dt.to_period("M").astype(str)

    faults: dict[str, dict] = {}
    for inv, g in ev.groupby("inverter_id"):
        monthly = g.groupby("month").size()
        top = (
            g.groupby(["code", "description"]).size()
            .sort_values(ascending=False).head(6)
        )
        faults[inv] = {
            "total": int(len(g)),
            "monthly": [{"t": t, "count": int(c)} for t, c in monthly.items()],
            "topCodes": [
                {"code": str(code), "description": desc, "count": int(c)}
                for (code, desc), c in top.items()
            ],
        }
    (ART / "faults.json").write_text(json.dumps(faults))
    print(f"[pyra:faults] faults.json — {len(faults)} inverters")

    tk = pd.read_parquet(OUT / "tickets.parquet")
    tickets = [
        {
            "start": (None if pd.isna(r["start"]) else str(r["start"])[:16]),
            "end": (None if pd.isna(r["end"]) else str(r["end"])[:16]),
            "component": (None if pd.isna(r["component"]) else str(r["component"])),
            "category": (None if pd.isna(r["category"]) else str(r["category"])),
        }
        for _, r in tk.iterrows()
    ]
    (ART / "tickets.json").write_text(json.dumps(tickets, indent=2))
    print(f"[pyra:faults] tickets.json — {len(tickets)} tickets")


if __name__ == "__main__":
    main()
