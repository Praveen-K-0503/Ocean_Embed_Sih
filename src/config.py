"""
Global configuration for OceanEmbed Real-Time System (SIH Problem 26066).
Domain: North Indian Ocean (5°N–30°N, 45°E–105°E) at 0.25° resolution.
Real data: Copernicus GLORYS12V1 + CMEMS satellite observations.
"""

from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Base Directories
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT    = Path(__file__).resolve().parents[1]
REALTIME_DIR    = PROJECT_ROOT / "data" / "realtime"
ASSETS_DIR      = PROJECT_ROOT / "ocean_embed_inference_assets"
OUTPUT_DIR      = PROJECT_ROOT / "data" / "realtime"

# ─────────────────────────────────────────────────────────────────────────────
# Geographic Domain: North Indian Ocean
# ─────────────────────────────────────────────────────────────────────────────
LAT_MIN: float = 5.0
LAT_MAX: float = 30.0
LON_MIN: float = 45.0
LON_MAX: float = 105.0
SPATIAL_RES: float = 0.25

LATS = np.arange(LAT_MIN, LAT_MAX + SPATIAL_RES / 2, SPATIAL_RES)
LONS = np.arange(LON_MIN, LON_MAX + SPATIAL_RES / 2, SPATIAL_RES)
N_LAT: int = len(LATS)   # 101
N_LON: int = len(LONS)   # 241

REGIONS = {
    "North Indian Ocean": {"lat": (5.0, 30.0), "lon": (45.0, 105.0)},
    "Arabian Sea":        {"lat": (8.0, 25.0), "lon": (50.0, 76.0)},
    "Bay of Bengal":      {"lat": (8.0, 23.0), "lon": (80.0, 98.0)},
    "Equatorial NIO":     {"lat": (5.0, 10.0), "lon": (55.0, 95.0)},
}

# ─────────────────────────────────────────────────────────────────────────────
# Vertical Standard Depth Levels (15 levels, 0–1000 m)
# ─────────────────────────────────────────────────────────────────────────────
STANDARD_DEPTHS: List[float] = [
    0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0,
    125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0
]
N_DEPTHS: int = len(STANDARD_DEPTHS)  # 15

# ─────────────────────────────────────────────────────────────────────────────
# Input Variables: 7 Surface Satellite Channels
# ─────────────────────────────────────────────────────────────────────────────
SURFACE_VARIABLES: List[str] = [
    "sst",     # Sea Surface Temperature (°C)
    "sss",     # Sea Surface Salinity (PSU)
    "ssh",     # Sea Surface Height / SLA (m)
    "u_curr",  # Surface eastward current (m/s)
    "v_curr",  # Surface northward current (m/s)
    "u_wind",  # 10m eastward wind (m/s)
    "v_wind",  # 10m northward wind (m/s)
]
N_INPUT_CHANNELS: int = len(SURFACE_VARIABLES)  # 7

TARGET_VARIABLE: str = "thetao"   # GLORYS12 potential temperature (°C)
N_OUTPUT_CHANNELS: int = N_DEPTHS  # 15

# ─────────────────────────────────────────────────────────────────────────────
# Climatological Normalization Statistics (from CMEMS NIO 2024)
# ─────────────────────────────────────────────────────────────────────────────
NORM_STATS: Dict[str, Tuple[float, float]] = {
    "sst":    (28.5,  1.8),   # Tropical warm pool ~28–30°C
    "sss":    (34.5,  1.6),   # Saline AS (~36) vs low-salinity BoB (~32)
    "ssh":    (0.05,  0.18),  # SLA dynamics (m)
    "u_curr": (0.0,   0.35),  # m/s
    "v_curr": (0.0,   0.35),  # m/s
    "u_wind": (1.2,   4.5),   # Monsoonal wind (m/s)
    "v_wind": (0.8,   4.2),   # Monsoonal wind (m/s)
    "thetao": (18.0,  8.5),   # Surface ~29°C → 1000m ~6°C
}

# ─────────────────────────────────────────────────────────────────────────────
# Model Checkpoint
# ─────────────────────────────────────────────────────────────────────────────
MODEL_CHECKPOINT = ASSETS_DIR / "oceanembed_best.pt"

# ─────────────────────────────────────────────────────────────────────────────
# Validation / Evaluation Paths
# ─────────────────────────────────────────────────────────────────────────────
ARGO_CSV_PATH     = REALTIME_DIR / "incois_argo_validation_samples.csv"
METRICS_JSON_PATH = REALTIME_DIR / "evaluation_metrics.json"
LAND_MASK_PATH    = REALTIME_DIR / "ocean_land_mask.nc"

# ─────────────────────────────────────────────────────────────────────────────
# Ocean Physics
# ─────────────────────────────────────────────────────────────────────────────
RHO_0: float = 1025.0    # Seawater reference density (kg/m³)
CP: float    = 3995.0    # Specific heat capacity (J/kg/K)
T_20_ISOTHERM: float = 20.0  # Thermocline proxy isotherm (°C)
