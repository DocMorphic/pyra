"""Fault & error-code economics — what each kind of fault actually COSTS.

The error track gives us 14k discrete fault onsets with German descriptions but
no euros. This module:
  1. Categorises every code by German keyword → grid / dc_link / isolation /
     overtemp / power_stage / comms / other (priority-ordered so an ENS grid
     trip tagged "(…,Leistungsteil)" still books as grid, not power_stage).
  2. Attributes the *validated* daily loss (from analytics' daily_expected) to
     the most-recent preceding onset within a short window — so each lost-kWh
     is charged to one cause and the totals stay ≤ the loss ledger (no
     double-counting). Days with loss but no recent code → "unattributed".
  3. Rolls up € + kWh per category and per code, plus the mean power drop a
     code causes in the day after it fires.

Run AFTER build.py + analytics.py:  python pipeline/fault_econ.py
Output: public/artifacts/fault_econ.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

import sources as S

OUT = S.OUT
ART = S.ART

ATTRIB_WINDOW_DAYS = 4   # a loss-day is charged to an onset within this many days before it

# German keyword → category, checked in this ORDER (first, most-specific hit
# wins). The "(ENS,…)" tag only names the subsystem that DETECTED the fault and
# rides on grid, isolation and other faults alike — so we key on the actual
# fault word (Isolationsfehler, Netzspannung, Zwischenkreis…), not on "ENS".
CATEGORY_RULES: list[tuple[str, str]] = [
    ("isolation", "isolation"),    # Isolationsprüfung / Isolationsfehler
    ("temperatur", "overtemp"),    # (Über)temperatur
    ("kühler", "overtemp"),
    ("zwischenkreis", "dc_link"),  # DC-link asymmetry / voltage
    ("hochsetzsteller", "dc_link"),
    ("netz", "grid"),              # Netzunter/überspannung, Netzfrequenz
    ("kommunikation", "comms"),
    ("leistungsteil", "power_stage"),  # generic power-stage fault (fallback)
]

CATEGORY_LABEL = {
    "grid": "Grid / ENS",
    "dc_link": "DC-link",
    "isolation": "Isolation",
    "overtemp": "Over-temperature",
    "power_stage": "Power stage",
    "comms": "Communication",
    "other": "Other / unknown",
}


def categorize(desc: str) -> str:
    d = str(desc).lower()
    for kw, cat in CATEGORY_RULES:
        if kw in d:
            return cat
    return "other"


def main() -> None:
    ev = pd.read_parquet(OUT / "error_events.parquet")
    ev["ts"] = pd.to_datetime(ev["ts"])
    ev["date"] = ev["ts"].dt.normalize()
    ev["category"] = ev["description"].map(categorize)

    daily = pd.read_parquet(OUT / "daily_expected.parquet")
    daily["date"] = pd.to_datetime(daily["date"])

    # --- attribute each loss-day to the most-recent onset within the window ---
    attributed = []   # rows: inv, date, loss_kwh, loss_eur, code, category
    for inv, g in daily.groupby("inverter_id"):
        loss_days = g[g["loss_kwh"] > 0].sort_values("date")
        if loss_days.empty:
            continue
        onsets = ev[ev["inverter_id"] == inv][["date", "code", "description", "category"]] \
            .sort_values("date")
        if onsets.empty:
            for _, r in loss_days.iterrows():
                attributed.append((inv, r["date"], r["loss_kwh"], r["loss_eur"], None, "unattributed"))
            continue
        merged = pd.merge_asof(
            loss_days[["date", "loss_kwh", "loss_eur"]], onsets,
            on="date", direction="backward",
            tolerance=pd.Timedelta(days=ATTRIB_WINDOW_DAYS),
        )
        for _, r in merged.iterrows():
            cat = r["category"] if pd.notna(r["category"]) else "unattributed"
            code = r["code"] if pd.notna(r["code"]) else None
            attributed.append((inv, r["date"], r["loss_kwh"], r["loss_eur"], code, cat))

    at = pd.DataFrame(attributed, columns=["inv", "date", "loss_kwh", "loss_eur", "code", "category"])

    # --- per-category rollup (every category that has events OR attributed loss;
    # a category with many events but ~€0 loss is itself a finding, e.g. isolation
    # alarms that don't interrupt production) ---
    all_cats = sorted(set(ev["category"]) | set(at["category"]) - {"unattributed"})
    all_cats = [c for c in all_cats if c != "unattributed"] + (["unattributed"] if (at["category"] == "unattributed").any() else [])
    cats = []
    for cat in all_cats:
        g = at[at["category"] == cat]
        n_events = int((ev["category"] == cat).sum()) if cat != "unattributed" else 0
        cats.append({
            "category": cat,
            "label": CATEGORY_LABEL.get(cat, cat.title()),
            "events": n_events,
            "invertersAffected": int(g["inv"].nunique()),
            "lostKwh": round(float(g["loss_kwh"].sum()), 0),
            "lostEur": round(float(g["loss_eur"].sum()), 0),
        })
    cats.sort(key=lambda c: c["lostEur"], reverse=True)

    # --- per-code rollup (top codes by attributed loss) ---
    desc_by_code = ev.drop_duplicates("code").set_index("code")["description"].to_dict()
    cat_by_code = ev.drop_duplicates("code").set_index("code")["category"].to_dict()
    count_by_code = ev.groupby("code").size().to_dict()
    code_loss = at[at["code"].notna()].groupby("code").agg(
        lostKwh=("loss_kwh", "sum"), lostEur=("loss_eur", "sum"), lossDays=("date", "nunique"))
    codes = []
    for code, r in code_loss.iterrows():
        cnt = int(count_by_code.get(code, 0))
        loss_days = max(int(r["lossDays"]), 1)
        # mean power drop ≈ attributed lost kWh per loss-day spread over daylight (~10h)
        mean_drop_kw = float(r["lostKwh"]) / loss_days / 10.0
        codes.append({
            "code": str(code),
            "description": str(desc_by_code.get(code, "Unknown code")),
            "category": cat_by_code.get(code, "other"),
            "count": cnt,
            "meanDropKw": round(mean_drop_kw, 2),
            "lostKwh": round(float(r["lostKwh"]), 0),
            "lostEur": round(float(r["lostEur"]), 0),
        })
    codes.sort(key=lambda c: c["lostEur"], reverse=True)

    total_attr_eur = float(at[at["category"] != "unattributed"]["loss_eur"].sum())
    total_loss_eur = float(daily["loss_eur"].sum())

    payload = {
        "categories": cats,
        "topCodes": codes[:20],
        "totalAttributedEur": round(total_attr_eur, 0),
        "totalLossEur": round(total_loss_eur, 0),
        "attributedFraction": round(total_attr_eur / total_loss_eur, 3) if total_loss_eur else 0,
        "totalOnsets": int(len(ev)),
        "attribWindowDays": ATTRIB_WINDOW_DAYS,
    }
    ART.mkdir(parents=True, exist_ok=True)
    (ART / "fault_econ.json").write_text(json.dumps(payload, indent=2))

    print(f"[pyra:fault_econ] fault_econ.json — {len(cats)} categories · "
          f"€{total_attr_eur:,.0f} of €{total_loss_eur:,.0f} attributed "
          f"({payload['attributedFraction']*100:.0f}%)")
    for c in cats:
        print(f"  {c['label']:<18} {c['events']:>5} events · {c['invertersAffected']:>2} inv · "
              f"€{c['lostEur']:>8,.0f} · {c['lostKwh']:>10,.0f} kWh")


if __name__ == "__main__":
    main()
