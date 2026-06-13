"""Pyra pipeline — turn the raw Plant A dataset into clean tidy tables and
compact JSON artifacts the PyraOS app reads.

Run:  python pipeline/build.py
Outputs:
  pipeline/out/*.parquet        internal tidy tables (gitignored)
  app/public/artifacts/*.json   compact artifacts for the frontend (gitignored)

Analytics (expected-power model, loss ledger) build on these in analytics.py.
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb
import pandas as pd

import sources as S

OUT = S.OUT
ART = S.ART
OUT.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

SAMPLE_INTERVAL_H = S.interval_h()  # hours per sample (detected for sessions; 5 min for the demo)


def log(msg: str) -> None:
    print(f"[pyra] {msg}", flush=True)


def quoted(cols: list[str]) -> str:
    return ", ".join('"' + c.replace('"', '""') + '"' for c in cols)


def main() -> None:
    S.check_data_present()
    con = duckdb.connect()
    P = str(S.MONITORING_PARQUET)

    all_cols = [c[0] for c in con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{P}')"
    ).fetchall()]
    pac_cols = [c for c in all_cols if S.INV_RE.search(c) and "P_AC" in c]
    idc_cols = [c for c in all_cols if S.INV_RE.search(c) and "I_DC" in c]
    udc_cols = [c for c in all_cols if S.INV_RE.search(c) and "U_DC" in c]
    inv_ids = S.inverter_ids_from_monitoring(con)
    log(f"monitoring: {len(all_cols)} cols · {len(inv_ids)} inverters · {len(pac_cols)} P_AC series")

    # Parsed-timestamp view over the wide parquet.
    con.execute(f"""
        CREATE VIEW m AS
        SELECT *, strptime("timestamp", '{S.TS_FORMAT}') AS ts
        FROM read_parquet('{P}')
    """)

    # --- inverter_metadata -------------------------------------------------
    # Uploaded sessions: ingest.py pre-writes metadata (kWp estimated from peak
    # power when no system-overview was provided). Demo: build it from the xlsx.
    meta_path = OUT / "inverter_metadata.parquet"
    if S.SESSION and meta_path.exists():
        meta = pd.read_parquet(meta_path)
        meta = meta[meta["inverterId"].isin(inv_ids)].reset_index(drop=True)
    else:
        meta = S.load_system_overview().drop_duplicates("inverterId").reset_index(drop=True)
        meta = meta[meta["inverterId"].isin(inv_ids)].reset_index(drop=True)
        meta.to_parquet(meta_path, index=False)
    log(f"inverter_metadata: {len(meta)} rows")

    # --- plant_env (environment + grid + curtailment) ----------------------
    env_map = {
        '"Plant / Irradiation_average (W/m²)"': "irradiance",
        '"Plant / Altitude (°)"': "altitude",
        '"Temperature Sensor / Module (°C)"': "module_temp",
        '"Temperature Sensor / Ambient (°C)"': "ambient_temp",
        '"DRD11A / EVU (%)"': "evu",
        '"DRD11A / DV (%)"': "dv",
    }
    sel = ", ".join(f"{src} AS {dst}" for src, dst in env_map.items())
    con.execute(f"COPY (SELECT ts, {sel} FROM m ORDER BY ts) "
                f"TO '{OUT / 'plant_env.parquet'}' (FORMAT parquet)")
    log("plant_env: written")

    # --- daily per-inverter energy (basis for loss + degradation) ----------
    # UNPIVOT the 65 P_AC columns to long, then aggregate to daily kWh.
    # Curtailment fraction comes from the plant-wide EVU/DV at each timestamp.
    con.execute(f"""
        CREATE VIEW pac_long AS
        SELECT regexp_extract(name, 'INV \\d+\\.\\d+\\.\\d+') AS inverter_id,
               ts, p_ac
        FROM (UNPIVOT m ON {quoted(pac_cols)} INTO NAME name VALUE p_ac)
        WHERE p_ac IS NOT NULL
    """)
    daily = con.execute("""
        SELECT l.inverter_id,
               CAST(l.ts AS DATE)                       AS day,
               SUM(l.p_ac) * ?                          AS e_kwh,
               COUNT(*)                                 AS n_samples,
               AVG(e.irradiance)                        AS mean_irr,
               SUM(CASE WHEN (e.evu IS NOT NULL AND e.evu < 99.5)
                          OR (e.dv  IS NOT NULL AND e.dv  < 99.5)
                        THEN 1 ELSE 0 END)              AS n_curtailed
        FROM pac_long l
        JOIN read_parquet(?) e ON e.ts = l.ts
        GROUP BY 1, 2
        ORDER BY 1, 2
    """, [SAMPLE_INTERVAL_H, str(OUT / "plant_env.parquet")]).df()
    daily["year"] = pd.to_datetime(daily["day"]).dt.year
    daily.to_parquet(OUT / "daily_inverter.parquet", index=False)
    log(f"daily_inverter: {len(daily)} rows ({daily.inverter_id.nunique()} inverters)")

    # --- error_events ------------------------------------------------------
    build_error_events(con, inv_ids)

    # --- tariffs -----------------------------------------------------------
    build_tariffs()

    # --- tickets -----------------------------------------------------------
    build_tickets()

    # --- compact JSON artifacts for the app --------------------------------
    write_app_artifacts(con, meta, daily, inv_ids)

    log("done.")


def build_error_events(con, inv_ids: list[str]) -> None:
    # Datasets without an error track (common for uploads) → empty events.
    if not S.ERRORCODES_PARQUET.exists():
        pd.DataFrame(columns=["inverter_id", "ts", "code", "description"]).to_parquet(
            OUT / "error_events.parquet", index=False)
        log("error_events: no error track for this dataset → empty")
        return
    EP = str(S.ERRORCODES_PARQUET)
    cols = [c[0] for c in con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{EP}')"
    ).fetchall()]
    err_cols = [c for c in cols if c.endswith("/ Error")]
    con.execute(f"""
        CREATE VIEW err AS
        SELECT *, strptime("timestamp", '{S.TS_FORMAT}') AS ts
        FROM read_parquet('{EP}')
    """)
    # The Error track carries the current code at every timestamp (0 = normal).
    # Collapse to discrete fault ONSETS: non-zero codes where the code changed
    # from the previous sample for that inverter.
    events = con.execute(f"""
        WITH long AS (
            SELECT regexp_extract(name, 'INV \\d+\\.\\d+\\.\\d+') AS inverter_id,
                   ts, code
            FROM (UNPIVOT err ON {quoted(err_cols)} INTO NAME name VALUE code)
            WHERE code IS NOT NULL AND code <> 0
        ),
        flagged AS (
            SELECT *, LAG(code) OVER (PARTITION BY inverter_id ORDER BY ts) AS prev
            FROM long
        )
        SELECT inverter_id, ts, CAST(CAST(code AS BIGINT) AS VARCHAR) AS code
        FROM flagged
        WHERE prev IS NULL OR prev <> code
        ORDER BY ts
    """).df()

    # Code→description map (optional — without it codes read as "Unknown code").
    desc_map: dict[str, str] = {}
    hex_map: dict[str, str] = {}
    if S.ERRORCODES_DESC.exists():
        desc = pd.read_excel(S.ERRORCODES_DESC)
        desc.columns = ["component", "hex", "decimal", "description"][: len(desc.columns)]
        desc["decimal"] = pd.to_numeric(desc["decimal"], errors="coerce")
        desc_map = dict(zip(desc["decimal"].dropna().astype("int64").astype(str),
                            desc["description"]))
        hex_map = dict(zip(desc["hex"].astype(str), desc["description"]))

    def describe(code: str) -> str:
        c = str(code).strip()
        if c.endswith(".0"):
            c = c[:-2]
        return desc_map.get(c) or hex_map.get(c) or "Unknown code"

    events["description"] = events["code"].map(describe)
    events.to_parquet(OUT / "error_events.parquet", index=False)
    log(f"error_events: {len(events)} events ({events.inverter_id.nunique()} inverters)")


def build_tariffs() -> None:
    # Sessions: ingest.py pre-writes a flat tariffs.parquet; keep it.
    if not S.TARIFFS_XLSX.exists():
        if not (OUT / "tariffs.parquet").exists():
            pd.DataFrame(columns=["inverter_id", "week_start", "eurocent_per_kwh"]).to_parquet(
                OUT / "tariffs.parquet", index=False)
        log("tariffs: using provided/empty (no tariff sheet)")
        return
    raw = pd.read_excel(S.TARIFFS_XLSX, header=None)
    # row 0 = junk header, row 1 = weekly dates, rows 2+ = per-inverter tariffs.
    dates = pd.to_datetime(raw.iloc[1, 1:], errors="coerce")
    rows = []
    for i in range(2, len(raw)):
        inv_id = str(raw.iloc[i, 0]).strip()
        if not S.INV_RE.search(inv_id):
            continue
        vals = pd.to_numeric(raw.iloc[i, 1:], errors="coerce")
        for d, v in zip(dates, vals):
            if pd.notna(d) and pd.notna(v):
                rows.append((inv_id, d, float(v)))
    tf = pd.DataFrame(rows, columns=["inverter_id", "week_start", "eurocent_per_kwh"])
    tf.to_parquet(OUT / "tariffs.parquet", index=False)
    log(f"tariffs: {len(tf)} rows ({tf.inverter_id.nunique()} inverters)")


def build_tickets() -> None:
    # Sessions: ingest.py pre-writes tickets.parquet (often empty); keep it.
    if not S.TICKETS_XLSX.exists():
        if not (OUT / "tickets.parquet").exists():
            pd.DataFrame(columns=["start", "end", "component", "category"]).to_parquet(
                OUT / "tickets.parquet", index=False)
        log("tickets: using provided/empty (no tickets sheet)")
        return
    frames = []
    xl = pd.ExcelFile(S.TICKETS_XLSX)
    if "2020-2026" in xl.sheet_names:
        d = pd.read_excel(S.TICKETS_XLSX, sheet_name="2020-2026")
        frames.append(pd.DataFrame({
            "start": pd.to_datetime(d["startdate"], errors="coerce", utc=True),
            "end": pd.to_datetime(d["enddate"], errors="coerce", utc=True),
            "component": d["component"].astype(str),
            "category": d["category"].astype(str),
        }))
    if "2019-2020" in xl.sheet_names:
        d = pd.read_excel(S.TICKETS_XLSX, sheet_name="2019-2020")
        frames.append(pd.DataFrame({
            "start": pd.to_datetime(d["Start Date"], errors="coerce", utc=True),
            "end": pd.to_datetime(d["Datum Ende"], errors="coerce", utc=True),
            "component": d["Komponente"].astype(str),
            "category": d["Störungsart/ Beanstandung"].astype(str),
        }))
    tk = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    tk = tk[tk["start"].notna()].sort_values("start").reset_index(drop=True)
    tk.to_parquet(OUT / "tickets.parquet", index=False)
    log(f"tickets: {len(tk)} rows")


def write_app_artifacts(con, meta: pd.DataFrame, daily: pd.DataFrame, inv_ids: list[str]) -> None:
    span = con.execute("SELECT min(ts), max(ts) FROM m").fetchone()
    lifetime = daily.groupby("inverter_id")["e_kwh"].sum().to_dict()

    inverters = []
    for _, r in meta.iterrows():
        inverters.append({
            "inverterId": r["inverterId"],
            "area": r["area"],
            "moduleType": r["moduleType"],
            "kWp": round(float(r["kWp"]), 2) if pd.notna(r["kWp"]) else None,
            "strings": int(r["strings"]) if pd.notna(r["strings"]) else None,
            "modules": int(r["modules"]) if pd.notna(r["modules"]) else None,
            "lifetimeKwh": round(float(lifetime.get(r["inverterId"], 0.0)), 1),
        })

    plant_name = "Plant A"
    if S.SESSION:
        try:
            plant_name = json.loads((ART / "capabilities.json").read_text()).get("label") or "Uploaded dataset"
        except Exception:
            plant_name = "Uploaded dataset"
    meta_json = {
        "plant": plant_name,
        "inverterCount": len(inverters),
        "totalKwp": round(float(meta["kWp"].sum()), 1),
        "moduleTypes": int(meta["moduleType"].nunique()),
        "dateStart": str(span[0]),
        "dateEnd": str(span[1]),
        "generatedFrom": "uploaded dataset" if S.SESSION else "main_monitoring_data.parquet (restricted)",
    }
    (ART / "meta.json").write_text(json.dumps(meta_json, indent=2))
    (ART / "inverters.json").write_text(json.dumps(inverters, indent=2))
    log(f"artifacts: meta.json + inverters.json ({len(inverters)} inverters)")


if __name__ == "__main__":
    main()
