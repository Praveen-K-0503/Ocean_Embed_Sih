"""
Oceanographic Physics Diagnostics for OceanEmbed (MoES / INCOIS PS 26066).

Provides operational physical derivations from reconstructed 3D temperature fields:
  1. D20 Thermocline Depth (m) - 20°C isotherm proxy for upper-ocean dynamics.
  2. Mixed Layer Depth (MLD, m) - Depth at which temperature drops by ΔT (0.2°C) from SST.
  3. Tropical Cyclone Heat Potential (TCHP, kJ/cm² or MJ/m²) - Heat energy above 26°C,
     crucial for cyclone intensification in the Bay of Bengal & Arabian Sea.
  4. Upper Ocean Heat Content (OHC, GJ/m²) - Integrated thermal reservoir (0-300m / 0-700m).
"""

from typing import Dict, Optional, Tuple, Union
import numpy as np

from src.config import (
    STANDARD_DEPTHS, RHO_0, CP, T_20_ISOTHERM, T_26_ISOTHERM, MLD_DELTA_T
)


def compute_d20_profile(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
    target_temp: float = T_20_ISOTHERM,
) -> float:
    """
    Compute depth of target isotherm (default 20°C) along a 1D vertical profile.
    Uses linear interpolation between adjacent depth brackets.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    valid = ~np.isnan(temps)
    if not np.any(valid):
        return np.nan

    v_temps = temps[valid]
    v_depths = depths[valid]

    if len(v_temps) < 2:
        return np.nan

    # Surface already colder than target
    if v_temps[0] <= target_temp:
        return float(v_depths[0])

    # Search for first downward crossing from surface
    for i in range(len(v_temps) - 1):
        t_top, t_bot = v_temps[i], v_temps[i + 1]
        z_top, z_bot = v_depths[i], v_depths[i + 1]

        if t_top >= target_temp >= t_bot:
            if abs(t_bot - t_top) < 1e-5:
                return float(z_top)
            frac = (t_top - target_temp) / (t_top - t_bot)
            return float(z_top + frac * (z_bot - z_top))

    # If no downward crossing found, check if entire column warmer
    if v_temps[-1] > target_temp:
        return float(v_depths[-1])

    return np.nan


def compute_mld_profile(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
    delta_t: float = MLD_DELTA_T,
) -> float:
    """
    Compute Mixed Layer Depth (MLD) using temperature criterion: T(MLD) = SST - delta_t.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    valid = ~np.isnan(temps)
    if not np.any(valid):
        return np.nan

    v_temps = temps[valid]
    v_depths = depths[valid]

    sst = v_temps[0]
    target_mld_temp = sst - delta_t

    for i in range(len(v_temps) - 1):
        t_top, t_bot = v_temps[i], v_temps[i + 1]
        z_top, z_bot = v_depths[i], v_depths[i + 1]

        if t_top >= target_mld_temp >= t_bot:
            if abs(t_bot - t_top) < 1e-5:
                return float(z_top)
            frac = (t_top - target_mld_temp) / (t_top - t_bot)
            return float(z_top + frac * (z_bot - z_top))

    return float(v_depths[-1])


def compute_tchp_profile(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
    t_ref: float = T_26_ISOTHERM,
    rho: float = RHO_0,
    cp: float = CP,
) -> Dict[str, float]:
    """
    Compute Tropical Cyclone Heat Potential (TCHP) and D26 depth.
    TCHP = rho * cp * integral_0^D26 (T(z) - 26) dz
    Returned in kJ/cm² (standard cyclone forecasting unit) and MJ/m².
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    valid = ~np.isnan(temps)
    if not np.any(valid):
        return {"tchp_kj_cm2": 0.0, "tchp_mj_m2": 0.0, "d26_m": 0.0}

    v_temps = temps[valid]
    v_depths = depths[valid]

    d26 = compute_d20_profile(v_temps, v_depths, target_temp=t_ref)
    if np.isnan(d26) or d26 <= 0.0:
        return {"tchp_kj_cm2": 0.0, "tchp_mj_m2": 0.0, "d26_m": 0.0}

    # Integrate trapz from 0 to D26
    sub_z = []
    sub_t = []
    for z, t in zip(v_depths, v_temps):
        if z <= d26:
            sub_z.append(z)
            sub_t.append(t)
        else:
            break

    # Add exact D26 point
    if not sub_z or sub_z[-1] < d26:
        sub_z.append(d26)
        sub_t.append(t_ref)

    if len(sub_z) < 2:
        return {"tchp_kj_cm2": 0.0, "tchp_mj_m2": 0.0, "d26_m": float(d26)}

    # Numerical trapezoidal integration: integral (T - 26) dz (in °C * m)
    anomalies = np.maximum(0.0, np.array(sub_t) - t_ref)
    integral_c_m = float(np.trapz(anomalies, sub_z))

    # TCHP in J/m² = rho * cp * integral_c_m
    tchp_j_m2 = rho * cp * integral_c_m
    tchp_mj_m2 = tchp_j_m2 * 1e-6
    tchp_kj_cm2 = tchp_j_m2 * 1e-7  # 1 kJ/cm² = 10^7 J/m²

    return {
        "tchp_kj_cm2": round(tchp_kj_cm2, 2),
        "tchp_mj_m2":  round(tchp_mj_m2, 2),
        "d26_m":        round(float(d26), 1),
    }


def compute_physical_diagnostics(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
) -> Dict[str, Union[float, Dict]]:
    """
    Extract comprehensive oceanographic physics suite for a given temperature profile.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    d20 = compute_d20_profile(temps, depths, target_temp=T_20_ISOTHERM)
    mld = compute_mld_profile(temps, depths, delta_t=MLD_DELTA_T)
    tchp = compute_tchp_profile(temps, depths)

    # Upper Ocean Heat Content (0 to 300m) relative to 0°C
    valid = ~np.isnan(temps)
    v_temps = temps[valid]
    v_depths = depths[valid]

    mask_300 = v_depths <= 300.0
    if np.sum(mask_300) >= 2:
        z_300 = v_depths[mask_300]
        t_300 = v_temps[mask_300]
        ohc_300_gj_m2 = round(float(RHO_0 * CP * np.trapz(t_300, z_300) * 1e-9), 2)
    else:
        ohc_300_gj_m2 = np.nan

    return {
        "thermocline_d20_m": round(float(d20), 1) if not np.isnan(d20) else None,
        "mixed_layer_depth_m": round(float(mld), 1) if not np.isnan(mld) else None,
        "d26_isotherm_m": tchp["d26_m"],
        "tchp_kj_cm2": tchp["tchp_kj_cm2"],
        "tchp_mj_m2": tchp["tchp_mj_m2"],
        "ohc_300m_gj_m2": ohc_300_gj_m2,
    }


def compute_d20_grid_2d(
    temp_3d: np.ndarray,
    depths: Optional[np.ndarray] = None,
    ocean_mask: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Compute 2D D20 thermocline map from (15, H, W) 3D temperature volume.
    Returns (H, W) in meters.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    n_depths, n_lat, n_lon = temp_3d.shape
    d20_grid = np.full((n_lat, n_lon), np.nan, dtype=np.float32)

    for i in range(n_lat):
        for j in range(n_lon):
            if ocean_mask is not None and not ocean_mask[i, j]:
                continue
            col = temp_3d[:, i, j]
            d20_val = compute_d20_profile(col, depths, T_20_ISOTHERM)
            d20_grid[i, j] = d20_val

    return d20_grid
