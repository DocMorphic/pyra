"""Source paths + raw loaders for the EnerParc Plant A dataset.

The raw data is RESTRICTED (see Data Use Policy) and never committed. Point
PYRA_DATA at the local dataset root; defaults to the hackathon Downloads path.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pandas as pd

DATA_ROOT = Path(
    os.environ.get(
        "PYRA_DATA",
        "/Users/dharmaydave/Downloads/EP-Challenge-Final -/Plant A (start here)",
    )
)

# --- session-aware output/location roots -------------------------------------
# When PYRA_SESSION is set, the whole pipeline reads/writes under that session
# (an uploaded dataset normalized by ingest.py); otherwise it uses the default
# locations so the bundled EnerParc demo is byte-for-byte unchanged.
_PIPELINE = Path(__file__).parent
_PROJECT = _PIPELINE.parent
SESSION = os.environ.get("PYRA_SESSION") or None

if SESSION:
    OUT = _PIPELINE / "out" / "sessions" / SESSION
    ART = _PROJECT / "public" / "artifacts" / "sessions" / SESSION
    # ingest.py writes a canonical monitoring parquet here; downstream SQL reads it.
    MONITORING_PARQUET = OUT / "canonical_monitoring.parquet"
    ERRORCODES_PARQUET = OUT / "canonical_errorcodes.parquet"
    ERRORCODES_DESC = OUT / "errorcode_desc.xlsx"   # may be absent → guarded
    SYSTEM_OVERVIEW = OUT / "system_overview.xlsx"  # ingest pre-writes metadata instead
    TARIFFS_XLSX = OUT / "tariffs.xlsx"
    TICKETS_XLSX = OUT / "tickets.xlsx"
else:
    OUT = _PIPELINE / "out"
    ART = _PROJECT / "public" / "artifacts"
    MONITORING_PARQUET = DATA_ROOT / "1. Main-monitoring-data" / "main_monitoring_data.parquet"
    SYSTEM_OVERVIEW = DATA_ROOT / "2. Additional Data" / "System_Overview.xlsx"
    TARIFFS_XLSX = DATA_ROOT / "2. Additional Data" / "feed-in-tarrifs.xlsx"
    TICKETS_XLSX = DATA_ROOT / "2. Additional Data" / "Tickets.xlsx"
    ERRORCODES_PARQUET = DATA_ROOT / "3. Errorcodes" / "errorcodes.parquet"
    ERRORCODES_DESC = DATA_ROOT / "3. Errorcodes" / "errorcodes description (important).xlsx"

# Timestamps are stored as strings like "2016.12.31 22:00".
TS_FORMAT = "%Y.%m.%d %H:%M"
INV_RE = re.compile(r"INV \d{2}\.\d{2}\.\d{3}")


def check_data_present() -> None:
    if not MONITORING_PARQUET.exists():
        raise SystemExit(
            f"Dataset not found at {DATA_ROOT}.\n"
            "Set PYRA_DATA to the local 'Plant A (start here)' folder."
        )


def inverter_ids_from_monitoring(con) -> list[str]:
    """Distinct inverter ids, ordered, parsed from the wide parquet columns."""
    cols = [c[0] for c in con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{MONITORING_PARQUET}')"
    ).fetchall()]
    ids = sorted({m.group(0) for c in cols for m in [INV_RE.search(c)] if m})
    return ids


def load_system_overview() -> pd.DataFrame:
    """Per-inverter metadata: inverter id, module type, kWp (DC), strings, modules.

    The sheet stacks a partial header, a plant summary row, then the real
    per-unit header (3rd row → header=2). Per-unit rows are either AC-combiners
    (WR-Type '-') or inverters (WR-Type 'Inverter'); we keep the inverters and
    map their Description ('WR 01 .01 .001') to the canonical 'INV 01.01.001'.
    """
    raw = pd.read_excel(SYSTEM_OVERVIEW, header=2)
    raw.columns = [str(c).strip() for c in raw.columns]

    def col(*names):
        for n in names:
            for c in raw.columns:
                if c.lower() == n.lower():
                    return c
        return None

    c_type = col("WR-Type")
    c_desc = col("Description")
    c_pdc = col("PDC (kWp)")
    c_mod = col("Module Type")
    c_str = col("Strings")
    c_modules = col("Modules")
    c_loc = col("Location")

    df = raw[raw[c_type].astype(str).str.strip().str.lower() == "inverter"].copy()

    def to_inv_id(desc: str) -> str | None:
        nums = re.findall(r"\d+", str(desc))
        if len(nums) < 3:
            return None
        return f"INV {int(nums[0]):02d}.{int(nums[1]):02d}.{int(nums[2]):03d}"

    df["inverterId"] = df[c_desc].map(to_inv_id)
    df = df[df["inverterId"].notna()]

    out = pd.DataFrame({
        "inverterId": df["inverterId"].values,
        "area": df["inverterId"].str.slice(4, 6).values,
        "kWp": pd.to_numeric(df[c_pdc], errors="coerce").values,
        "moduleType": df[c_mod].astype(str).str.strip().values if c_mod else "unknown",
        "strings": pd.to_numeric(df[c_str], errors="coerce").values if c_str else None,
        "modules": pd.to_numeric(df[c_modules], errors="coerce").values if c_modules else None,
        "location": df[c_loc].astype(str).str.strip().values if c_loc else None,
    })
    return out.sort_values("inverterId").reset_index(drop=True)
