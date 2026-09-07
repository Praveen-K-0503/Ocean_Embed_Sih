"""
Global configuration for OceanEmbed Real-Time System (SIH Problem 26066 - MoES / INCOIS).
Domain: North Indian Ocean (5°N–30°N, 45°E–105°E) at 0.25° resolution.
Primary Dataset: SIH_Final_Data (Final_Training_Dataset_2022_2024.nc, 1096 daily timesteps)
Validation Dataset: SIH_Final_Data (ARGO_15depths_validation.nc, INCOIS gridded ARGO)
"""

from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# Base Directories
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT     = Path(__file__).resolve().parents[1]
SIH_DATA_DIR     = PROJECT_ROOT / "SIH_Final_Data"
REALTIME_DIR     = PROJECT_ROOT / "data" / "realtime"
REALTIME_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR       = PROJECT_ROOT / "ocean_embed_inference_assets"
OUTPUT_DIR       = REALTIME_DIR

# ─────────────────────────────────────────────────────────────────────────────
# Primary Production Datasets (SIH_Final_Data)
# ─────────────────────────────────────────────────────────────────────────────
SIH_FINAL_TRAINING_NC = SIH_DATA_DIR / "Final_Training_Dataset_2022_2024.nc"
SIH_FINAL_ARGO_NC     = SIH_DATA_DIR / "ARGO_15depths_validation.nc"

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
# Vertical Standard Depth Levels (15 levels, 0–1000 m) - MoES/INCOIS Spec
# ─────────────────────────────────────────────────────────────────────────────
STANDARD_DEPTHS: List[float] = [
    0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0,
    125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0
]
N_DEPTHS: int = len(STANDARD_DEPTHS)  # 15

# ─────────────────────────────────────────────────────────────────────────────
# Input Variables: 7 Surface Satellite Channels (Matching SIH_Final_Data keys)
# ─────────────────────────────────────────────────────────────────────────────
SURFACE_VARIABLES: List[str] = [
    "sst",             # Sea Surface Temperature (°C) - UKMO OSTIA
    "sss",             # Sea Surface Salinity (PSU) - SMAP/SMOS
    "ssh",             # Sea Surface Height / SLA (m) - DUACS
    "u",               # Surface eastward current (m/s) - OSCAR
    "v",               # Surface northward current (m/s) - OSCAR
    "eastward_wind",   # 10m eastward wind (m/s) - CCMP/ASCAT
    "northward_wind",  # 10m northward wind (m/s) - CCMP/ASCAT
]
N_INPUT_CHANNELS: int = len(SURFACE_VARIABLES)  # 7

TARGET_VARIABLE: str = "thetao"   # Copernicus GLORYS12 potential temperature (°C)
N_OUTPUT_CHANNELS: int = N_DEPTHS  # 15

# ─────────────────────────────────────────────────────────────────────────────
# Climatological Normalization Statistics (Computed from 2022–2024 NIO dataset)
# ─────────────────────────────────────────────────────────────────────────────
NORM_STATS: Dict[str, Tuple[float, float]] = {
    "sst":            (28.64, 1.75),   # (°C)
    "sss":            (34.52, 2.07),   # (PSU)
    "ssh":            (0.107, 0.098),  # (m)
    "u":              (0.030, 0.273),  # (m/s)
    "v":              (0.009, 0.227),  # (m/s)
    "eastward_wind":  (3.054, 1.581),  # (m/s)
    "northward_wind": (-1.116, 2.494), # (m/s)
    "thetao":         (21.69, 7.66),   # Full-column (°C)
}

DEPTH_NORM_STATS: Dict[float, Tuple[float, float]] = {
    0.0:    (28.72, 1.83),
    5.0:    (28.64, 1.81),
    10.0:   (28.62, 1.74),
    20.0:   (28.52, 1.70),
    30.0:   (28.28, 1.71),
    50.0:   (27.43, 1.90),
    75.0:   (25.77, 2.20),
    100.0:  (23.41, 2.30),
    125.0:  (20.78, 2.31),
    150.0:  (18.50, 2.25),
    200.0:  (15.64, 1.97),
    300.0:  (13.11, 1.57),
    500.0:  (11.21, 1.23),
    700.0:  (9.78,  1.24),
    1000.0: (7.69,  1.03),
}

# ─────────────────────────────────────────────────────────────────────────────
# Model Checkpoint
# ─────────────────────────────────────────────────────────────────────────────
MODEL_CHECKPOINT = ASSETS_DIR / "oceanembed_best.pt"

# ─────────────────────────────────────────────────────────────────────────────
# Validation / Evaluation Paths
# ─────────────────────────────────────────────────────────────────────────────
METRICS_JSON_PATH = REALTIME_DIR / "evaluation_metrics.json"

# ─────────────────────────────────────────────────────────────────────────────
# Ocean Physics Constants
# ─────────────────────────────────────────────────────────────────────────────
RHO_0: float = 1025.0          # Seawater reference density (kg/m³)
CP: float    = 3995.0          # Specific heat capacity (J/kg/K)
T_20_ISOTHERM: float = 20.0    # Thermocline depth proxy isotherm (°C)
T_26_ISOTHERM: float = 26.0    # Tropical Cyclone Heat Potential isotherm (°C)
MLD_DELTA_T: float = 0.2       # Mixed Layer Depth threshold (°C from surface)
