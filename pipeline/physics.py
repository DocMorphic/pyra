"""Physics-based expected-power cross-check (pvlib).

Two jobs:
  1. derive_location() — recover the plant's latitude/longitude purely from the
     provided "Altitude" (solar-elevation) telemetry, by fitting pvlib's solar
     position to it. No external coordinate file needed.
  2. pvwatts_expected() — an independent, first-principles expected-power model
     (PVWatts) to cross-check the ML model. Uses the *measured* module
     temperature as cell temperature, so it needs no thermal modeling.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pvlib
from scipy.optimize import minimize

TZ = "UTC"          # monitoring timestamps are UTC (peak solar elevation lands at solar-noon UTC)
GAMMA = -0.0037     # power temp coefficient, /°C (typical c-Si)
INV_EFF = 0.86      # PVWatts standard total system derate (14% losses)
G_REF = 1000.0      # reference irradiance, W/m²
T_REF = 25.0        # reference cell temp, °C


def derive_location(env: pd.DataFrame, n_sample: int = 1500, seed: int = 0) -> dict:
    """Fit (lat, lon) so pvlib solar elevation matches the measured Altitude track.

    env must have columns: ts (naive local), altitude (solar elevation °).
    Returns {lat, lon, rmse_deg, source}.
    """
    df = env[["ts", "altitude"]].dropna()
    df = df[df["altitude"] > 5.0]              # daytime only
    if len(df) > n_sample:
        df = df.sample(n_sample, random_state=seed)
    times = pd.DatetimeIndex(pd.to_datetime(df["ts"])).tz_localize(
        TZ, ambiguous="NaT", nonexistent="NaT"
    )
    mask = ~times.isna()
    times = times[mask]
    meas = df["altitude"].to_numpy()[mask]

    def rmse(params: np.ndarray) -> float:
        lat, lon = params
        sp = pvlib.solarposition.get_solarposition(times, lat, lon)
        pred = sp["apparent_elevation"].to_numpy()
        return float(np.sqrt(np.nanmean((pred - meas) ** 2)))

    best = minimize(
        rmse, x0=np.array([50.0, 10.0]), method="Nelder-Mead",
        options={"xatol": 0.05, "fatol": 0.02, "maxiter": 200},
    )
    lat, lon = float(best.x[0]), float(best.x[1])
    r = float(best.fun)
    if not (40 <= lat <= 56 and -2 <= lon <= 20) or r > 3.0:
        # Poor fit — fall back to a central-Germany default.
        return {"lat": 48.5, "lon": 11.5, "rmse_deg": r, "source": "fallback"}
    return {"lat": round(lat, 3), "lon": round(lon, 3), "rmse_deg": round(r, 3), "source": "fitted"}


def pvwatts_expected(poa: np.ndarray, t_module: np.ndarray, kwp: float) -> np.ndarray:
    """PVWatts expected AC power (kW) from POA irradiance + measured module temp.

    P_dc = (POA/G_ref) * kWp * (1 + gamma*(T_cell - T_ref));  P_ac = P_dc * eff.
    """
    poa = np.asarray(poa, dtype=float)
    t = np.asarray(t_module, dtype=float)
    t = np.where(np.isnan(t), T_REF, t)
    p_dc = (poa / G_REF) * kwp * (1.0 + GAMMA * (t - T_REF))
    p_ac = np.clip(p_dc, 0, None) * INV_EFF
    return p_ac
