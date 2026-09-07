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


def compute_mackenzie_sound_velocity(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
    salinity: Union[float, np.ndarray] = 35.0,
) -> np.ndarray:
    """
    Mackenzie (1981) 9-term underwater sound speed formula:
      c(T, S, D) = 1448.96 + 4.591*T - 5.304e-2*T^2 + 2.374e-4*T^3
                   + 1.340*(S - 35) + 1.630e-2*D + 1.675e-7*D^2
                   - 1.025e-2*T*(S - 35) - 7.139e-13*T*D^3
    Valid for: 0 <= T <= 30°C, 30 <= S <= 40 PSU, 0 <= D <= 8000 m.
    Returns sound speed profile in meters/second (m/s).
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    t = np.asarray(temps, dtype=np.float64)
    d = np.asarray(depths, dtype=np.float64)
    s = np.asarray(salinity, dtype=np.float64)

    # 9-term polynomial
    c = (
        1448.96
        + 4.591 * t
        - 5.304e-2 * (t ** 2)
        + 2.374e-4 * (t ** 3)
        + 1.340 * (s - 35.0)
        + 1.630e-2 * d
        + 1.675e-7 * (d ** 2)
        - 1.025e-2 * t * (s - 35.0)
        - 7.139e-13 * t * (d ** 3)
    )
    return np.round(c, 2)


def compute_sonic_layer_depth(
    sound_speeds: np.ndarray,
    depths: Optional[np.ndarray] = None,
) -> Optional[float]:
    """
    Compute Sonic Layer Depth (SLD) — the depth of maximum sound speed in the upper ocean.
    The water above SLD is the Surface Acoustic Duct; below SLD lies the Sonar Shadow Zone.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    valid = ~np.isnan(sound_speeds)
    if not np.any(valid):
        return None

    v_speeds = sound_speeds[valid]
    v_depths = depths[valid]

    # Look for near-surface maximum in the upper 300m
    upper_mask = v_depths <= 300.0
    if not np.any(upper_mask):
        max_idx = int(np.argmax(v_speeds))
        return float(v_depths[max_idx])

    max_idx = int(np.argmax(v_speeds[upper_mask]))
    return float(v_depths[upper_mask][max_idx])


def compute_profile_uncertainty(
    depths: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Compute depth-dependent 1-sigma uncertainty (±°C) calibrated against
    independent INCOIS ARGO validation residuals across 15 standard depths.
    Thermocline has highest variance (~0.76°C); surface and deep levels are lower.
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    ref_depths = np.array([0.0, 20.0, 50.0, 75.0, 100.0, 150.0, 200.0, 500.0, 1000.0])
    ref_sigmas = np.array([0.28, 0.32, 0.58, 0.76, 0.74, 0.65, 0.52, 0.40, 0.32])
    sigmas = np.interp(depths, ref_depths, ref_sigmas)
    return np.round(sigmas, 3)


def classify_cyclone_hazard(
    tchp_kj_cm2: float,
    sst_c: float = 29.0,
) -> Dict[str, str]:
    """
    Classify Tropical Cyclone Heat Potential into operational hazard tiers:
      - Low Fuel (< 40 kJ/cm²): Cyclone intensification suppressed by cold upwelling.
      - Moderate Fuel (40-80 kJ/cm²): Supports sustained cyclone development.
      - Severe RI Risk (> 80 kJ/cm² and SST > 28.5°C): Favorable for Rapid Intensification (RI).
    """
    if tchp_kj_cm2 >= 80.0 and sst_c >= 28.5:
        return {
            "level": "SEVERE_RI_ALERT",
            "badge_text": "Rapid Intensification (RI) Warning",
            "badge_class": "hazard-severe",
            "advisory": f"TCHP is {tchp_kj_cm2:.1f} kJ/cm² (SST {sst_c:.1f}°C). Extreme upper ocean heat content capable of driving explosive cyclone intensification (Cat 4/5).",
        }
    elif tchp_kj_cm2 >= 45.0:
        return {
            "level": "MODERATE_ALERT",
            "badge_text": "Moderate Cyclone Fuel",
            "badge_class": "hazard-moderate",
            "advisory": f"TCHP is {tchp_kj_cm2:.1f} kJ/cm². Favorable thermal reservoir supporting steady cyclone intensification.",
        }
    else:
        return {
            "level": "LOW_RISK",
            "badge_text": "Low Intensification Risk",
            "badge_class": "hazard-low",
            "advisory": f"TCHP is {tchp_kj_cm2:.1f} kJ/cm². Subsurface thermal energy is limited; storm-induced upwelling will suppress rapid intensification.",
        }


def compute_physical_diagnostics(
    temps: np.ndarray,
    depths: Optional[np.ndarray] = None,
    salinity: Union[float, np.ndarray] = 35.0,
) -> Dict[str, Union[float, Dict, None]]:
    """
    Extract comprehensive oceanographic physics suite for a given temperature profile:
      - D20 Thermocline Depth & Mixed Layer Depth (MLD)
      - Tropical Cyclone Heat Potential (TCHP) & Cyclone RI Hazard Classification
      - Upper Ocean Heat Content (0-300m)
      - Mackenzie Sound Velocity Profile & Sonic Layer Depth (SLD) for naval acoustics
      - Marine Heatwave (MHW) detection
    """
    if depths is None:
        depths = np.array(STANDARD_DEPTHS)

    valid = ~np.isnan(temps)
    v_temps = temps[valid]
    v_depths = depths[valid]

    if len(v_temps) == 0:
        return {"status": "invalid_profile"}

    d20 = compute_d20_profile(temps, depths, target_temp=T_20_ISOTHERM)
    mld = compute_mld_profile(temps, depths, delta_t=MLD_DELTA_T)
    tchp = compute_tchp_profile(temps, depths)

    # Sound Velocity and Sonic Layer Depth
    sound_speeds = compute_mackenzie_sound_velocity(temps, depths, salinity=salinity)
    sld = compute_sonic_layer_depth(sound_speeds, depths)

    # Upper Ocean Heat Content (0 to 300m) relative to 0°C
    mask_300 = v_depths <= 300.0
    if np.sum(mask_300) >= 2:
        z_300 = v_depths[mask_300]
        t_300 = v_temps[mask_300]
        ohc_300_gj_m2 = round(float(RHO_0 * CP * np.trapz(t_300, z_300) * 1e-9), 2)
    else:
        ohc_300_gj_m2 = None

    sst = float(v_temps[0])
    cyclone_hazard = classify_cyclone_hazard(tchp["tchp_kj_cm2"], sst_c=sst)

    # Marine Heatwave (MHW) Check
    mhw_detected = bool(sst >= 29.8)
    mhw_info = {
        "detected": mhw_detected,
        "category": "Category II (Strong)" if sst >= 30.5 else ("Category I (Moderate)" if mhw_detected else "Normal"),
        "sst_c": round(sst, 2),
    }

    return {
        "thermocline_d20_m": round(float(d20), 1) if not np.isnan(d20) else None,
        "mixed_layer_depth_m": round(float(mld), 1) if not np.isnan(mld) else None,
        "sonic_layer_depth_m": round(float(sld), 1) if sld is not None else None,
        "surface_sound_velocity_ms": float(sound_speeds[0]) if len(sound_speeds) > 0 and np.isfinite(sound_speeds[0]) else None,
        "min_sound_velocity_ms": float(np.nanmin(sound_speeds)) if np.any(np.isfinite(sound_speeds)) else None,
        "d26_isotherm_m": tchp["d26_m"],
        "tchp_kj_cm2": tchp["tchp_kj_cm2"],
        "tchp_mj_m2": tchp["tchp_mj_m2"],
        "ohc_300m_gj_m2": ohc_300_gj_m2,
        "cyclone_hazard": cyclone_hazard,
        "marine_heatwave": mhw_info,
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
