# Pyra — Solar Plant Intelligence

A digital-twin O&M console for utility-scale solar. Built for the Invertix Energy × AI Hackathon (EnerParc "Digital Twins of Solar Plants" challenge).

**Thesis:** don't just *detect* underperformance — **explain** it, **quantify** the euros lost (curtailment-adjusted), and turn it into an **O&M action**.

PyraOS is an OS-style desktop: Plant Map · Loss Ledger · Inverter Inspector · Fault Timeline · O&M Copilot · Executive Report.

> ⚠️ The EnerParc dataset is restricted to the event and is **not** committed (Data Use Policy). Generated artifacts are also gitignored. Both load locally.

## How it works

1. **Python pipeline** processes the restricted Plant A parquet/xlsx once and emits compact JSON artifacts.
2. **Per-inverter expected-power model** (HistGradientBoosting) trains on each inverter's first operating year, then benchmarks the full ~10-year history. Lost energy = (expected − actual) over daylight, **non-curtailed** intervals (EVU/DV availability < 100% excluded), valued at the per-week feed-in tariff.
3. **Next.js app** reads the artifacts; the **O&M Copilot** answers grounded on them via the Anthropic API (prompt-cached).

Plant A: 65 inverters · ~1.79 MWp · 12 module types · 2016→2026 · ~€122k / 944 MWh lost.

## Setup

```bash
# 1. Frontend deps
npm install

# 2. Python pipeline deps (one-time)
python3 -m venv .venv && . .venv/bin/activate
pip install pandas pyarrow duckdb openpyxl numpy scikit-learn pvlib scipy

# 3. Point at the local dataset (defaults to the hackathon Downloads path)
export PYRA_DATA="/path/to/EP-Challenge-Final/Plant A (start here)"

# 4. Generate artifacts → public/artifacts/*.json  (run in this order)
python pipeline/build.py        # tidy tables + meta/inverters
python pipeline/analytics.py    # expected-power model, loss ledger, degradation, daily_expected
python pipeline/faults.py       # fault timeline + tickets
python pipeline/dc_diag.py      # I_DC/U_DC string + disconnect diagnostics
python pipeline/fault_econ.py   # € per error-code category
python pipeline/risk.py         # failure-risk score + ticket links
python pipeline/simulator.py    # what-if recoverable-loss precompute
python pipeline/soiling.py      # Plant B soiling (optional; needs Plant B csv)

# 5. Copilot key (optional but recommended)
cp .env.example .env.local      # then add your ANTHROPIC_API_KEY

# 6. Run
npm run dev                     # http://localhost:3000
```

## Layout

- `pipeline/` — Python: `sources.py` (loaders), `build.py` (tidy tables), `analytics.py` (model + loss ledger), `faults.py` (timeline), `dc_diag.py` (DC/string), `fault_econ.py` (fault €), `risk.py` (risk score), `simulator.py` (what-if), `soiling.py` (Plant B)
- `app/`, `components/`, `hooks/`, `lib/` — Next.js 16 + Tailwind 4 PyraOS desktop (window manager/dock/boot cloned from the `aliquot` base, rebranded)
- `components/apps/` — the PyraOS windows (loss ledger, inspector, fault timeline, what-if simulator, fault economics, fleet risk, soiling, copilot, …)
- `app/api/copilot/` — Anthropic-backed O&M Copilot route
- `public/artifacts/` — generated JSON (gitignored)
