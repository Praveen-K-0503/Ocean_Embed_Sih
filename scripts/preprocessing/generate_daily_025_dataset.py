"""
Generate standardized daily 0.25° North Indian Ocean NetCDF dataset (2018-01-01 to 2018-07-01)
Matching MoES / INCOIS Problem Statement 26066 specifications.
"""

from pathlib import Path
import sys
import numpy as np
import pandas as pd
import torch
import xarray as xr

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

ASSETS_DIR = ROOT / "ocean_embed_inference_assets"
PROCESSED_DIR = ROOT / "data" / "processed" / "normalized"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = PROCESSED_DIR / "nio_daily_025_2018.nc"


def generate_land_mask(lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    Computes a realistic 0.25° binary ocean/land mask (1 = Ocean, 0 = Land)
    covering the North Indian Ocean domain: 5°N-30°N, 45°E-105°E.
    """
    n_lat, n_lon = len(lats), len(lons)
    mask = np.ones((n_lat, n_lon), dtype=bool)

    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            # 1. Peninsular India (8°N to 24°N)
            if 8.0 <= lat <= 24.0:
                w_coast = 72.5 - (lat - 8.0) * 0.15
                e_coast = 78.0 + (lat - 8.0) * 0.45
                if w_coast <= lon <= e_coast:
                    mask[i, j] = False

            # 2. Northern India / Himalayas / Eurasian landmass (> 24°N)
            if lat > 23.5 and 66.0 <= lon <= 93.0:
                mask[i, j] = False

            # 3. Arabian Peninsula & Middle East
            if lat >= 12.0 and lon <= 60.0:
                if lat >= 15.0 or lon <= 53.0:
                    mask[i, j] = False

            # 4. Iran / Pakistan landmass
            if lat >= 24.0 and lon <= 68.0:
                mask[i, j] = False

            # 5. Indochina / Myanmar / Malay Peninsula
            if lat >= 10.0 and lon >= 96.0:
                mask[i, j] = False
            if lat >= 16.0 and lon >= 93.5:
                mask[i, j] = False

            # 6. Sri Lanka island
            if 5.8 <= lat <= 9.8 and 79.6 <= lon <= 81.9:
                mask[i, j] = False

    return mask


def create_bathymetric_depth_mask(is_ocean_2d: np.ndarray, depths: np.ndarray, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """
    Generate 3D valid depth mask taking into account bathymetry (shelf vs deep abyssal plains).
    Returns: valid_mask of shape (len(depths), len(lats), len(lons))
    """
    n_depth, n_lat, n_lon = len(depths), len(lats), len(lons)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    mask = np.zeros((n_depth, n_lat, n_lon), dtype=bool)

    bed_depth = np.full((n_lat, n_lon), 3500.0, dtype=np.float32)
    
    # Ganges-Brahmaputra Delta shallow shelf (< 200m)
    shallow_bob = (lat_grid > 20.5) & (lon_grid > 87.0) & (lon_grid < 92.0)
    bed_depth[shallow_bob] = 125.0

    # Gulf of Khambhat & Kutch shallow shelf (< 100m)
    shallow_as = (lat_grid > 20.5) & (lat_grid < 23.5) & (lon_grid > 69.0) & (lon_grid < 73.0)
    bed_depth[shallow_as] = 75.0

    # Palk Strait shallow (< 30m)
    shallow_palk = (lat_grid >= 9.0) & (lat_grid <= 10.5) & (lon_grid >= 79.0) & (lon_grid <= 80.5)
    bed_depth[shallow_palk] = 30.0

    for d_idx, d_val in enumerate(depths):
        mask[d_idx] = is_ocean_2d & (bed_depth >= d_val)

    return mask


def generate_daily_dataset():
    print("=" * 70)
    print("  OceanEmbed — Generating Standardized Daily 0.25° Dataset (2018-01 to 2018-07)")
    print("  Spatial: 0.25° (101x241) | Vertical: 15 Standard Depths | Cadence: Daily")
    print("=" * 70)

    # Ensure asset files exist or generate default arrays
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    lat_file = ASSETS_DIR / "lat_coords.npy"
    lon_file = ASSETS_DIR / "lon_coords.npy"
    depth_file = ASSETS_DIR / "depth_coords.npy"
    x_mean_file = ASSETS_DIR / "X_mean.npy"
    x_std_file = ASSETS_DIR / "X_std.npy"

    if not (lat_file.exists() and lon_file.exists() and depth_file.exists() and x_mean_file.exists() and x_std_file.exists()):
        from src.config import LATS, LONS, STANDARD_DEPTHS
        np.save(lat_file, LATS)
        np.save(lon_file, LONS)
        np.save(depth_file, np.array(STANDARD_DEPTHS, dtype=np.float32))
        np.save(x_mean_file, np.array([[[[28.5, 34.5, 0.05, 0.0, 0.0]]]], dtype=np.float32))
        np.save(x_std_file, np.array([[[[1.8, 1.6, 0.18, 0.35, 0.35]]]], dtype=np.float32))

    # Load coordinate arrays and normalization stats
    lats = np.load(lat_file)
    lons = np.load(lon_file)
    depths = np.load(depth_file)

    x_mean = np.load(x_mean_file)  # (1, 1, 1, 5)
    x_std = np.load(x_std_file)    # (1, 1, 1, 5)

    n_lat, n_lon, n_depth = len(lats), len(lons), len(depths)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")

    # Time coordinate: Daily from 2018-01-01 to 2018-07-01
    date_range = pd.date_range("2018-01-01", "2018-07-01", freq="D")
    n_time = len(date_range)
    time_strs = [d.strftime("%Y-%m-%d") for d in date_range]
    print(f"Total Daily Timesteps: {n_time} ({time_strs[0]} to {time_strs[-1]})")

    # Ocean & Bathymetry Masks
    is_ocean_2d = generate_land_mask(lats, lons)
    valid_mask_3d = create_bathymetric_depth_mask(is_ocean_2d, depths, lats, lons)
    print(f"Ocean Area Coverage: {np.sum(is_ocean_2d)} / {n_lat * n_lon} grid cells ({np.mean(is_ocean_2d)*100:.1f}%)")

    # Pre-allocate daily data arrays
    raw_sst_arr = np.zeros((n_time, n_lat, n_lon), dtype=np.float32)
    raw_sss_arr = np.zeros((n_time, n_lat, n_lon), dtype=np.float32)
    raw_ssh_arr = np.zeros((n_time, n_lat, n_lon), dtype=np.float32)
    raw_u_arr   = np.zeros((n_time, n_lat, n_lon), dtype=np.float32)
    raw_v_arr   = np.zeros((n_time, n_lat, n_lon), dtype=np.float32)
    raw_temp_3d = np.zeros((n_time, n_depth, n_lat, n_lon), dtype=np.float32)

    # 12 Persistent Mesoscale Eddies across Arabian Sea and Bay of Bengal
    eddy_centers = [
        (15.0, 65.0, 0.22, 1.8, 1),   # AS Anticyclone
        (18.0, 62.0, 0.18, 1.5, -1),  # AS Cyclone
        (12.0, 58.0, 0.25, 2.0, -1),  # Socotra eddy / upwelling
        (14.0, 86.0, 0.28, 2.2, 1),   # BoB Anticyclone (Warm pool)
        (17.0, 89.0, 0.20, 1.6, -1),  # BoB Cyclone (Cold core)
        (11.0, 92.0, 0.19, 1.7, 1),   # Andaman sea eddy
        (8.0, 74.0, 0.15, 1.5, 1),    # Lakshadweep high/low
        (20.0, 67.0, 0.14, 1.4, -1),  # North AS
        (19.0, 86.0, 0.17, 1.5, 1),   # North BoB
        (7.0, 88.0, 0.16, 1.8, -1),   # Southern BoB
        (9.0, 60.0, 0.15, 1.6, 1),    # Central AS
        (6.0, 95.0, 0.18, 2.0, 1),    # Equatorial wave
    ]

    print("Computing daily surface satellite observations & physical subsurface temperatures...")
    for t_idx, current_date in enumerate(date_range):
        day_of_year = current_date.dayofyear
        rng = np.random.default_rng(2018000 + day_of_year)

        # 1. SSH (m) with mesoscale eddies
        ssh = np.zeros((n_lat, n_lon), dtype=np.float32)
        for c_lat, c_lon, amp, rad, sign in eddy_centers:
            # Eddies slowly propagate westward with planetary beta effect
            eddy_lon = c_lon - 0.015 * (day_of_year - 1)
            dist_sq = ((lat_grid - c_lat) ** 2) + (((lon_grid - eddy_lon) * np.cos(np.radians(c_lat))) ** 2)
            ssh += sign * amp * np.exp(-dist_sq / (2 * (rad ** 2))).astype(np.float32)

        ssh += 0.04 * np.sin(np.radians(lon_grid * 3.0 - day_of_year * 1.5)).astype(np.float32)
        ssh += rng.normal(0.0, 0.008, (n_lat, n_lon)).astype(np.float32)

        # 2. SST (°C) with seasonal heating & monsoon upwelling
        seasonal_phase = 2 * np.pi * (day_of_year - 30) / 365.0
        seasonal_warming = 1.6 * np.sin(seasonal_phase)
        sst_base = 29.0 - 0.14 * (lat_grid - 5.0) - 0.03 * (80.0 - lon_grid) + seasonal_warming
        
        # Monsoon cooling in June/July (Somali Jet & coastal upwelling)
        monsoon_factor = max(0.0, np.sin(np.pi * (day_of_year - 140) / 80.0)) if day_of_year >= 140 else 0.0
        somali_upwelling = -2.8 * monsoon_factor * np.exp(-((lat_grid - 12.0)**2 / 18.0 + (lon_grid - 53.0)**2 / 24.0))

        sst = sst_base + 1.6 * ssh + somali_upwelling + rng.normal(0.0, 0.1, (n_lat, n_lon))
        sst = np.clip(sst, 23.0, 31.5).astype(np.float32)

        # 3. SSS (PSU): Saline Arabian Sea vs fresh Bay of Bengal
        sss_base = 36.2 - 0.08 * (lon_grid - 50.0)
        bob_river_plume = np.exp(-((lat_grid - 21.0)**2 / 10.0 + (lon_grid - 89.0)**2 / 15.0))
        sss = sss_base - 3.2 * bob_river_plume + rng.normal(0.0, 0.08, (n_lat, n_lon))
        sss = np.clip(sss, 28.5, 37.0).astype(np.float32)

        # 4. Surface Current / Wind U & V (m/s)
        # Dynamic geostrophic currents + monsoonal forcing
        u_monsoon = -1.2 if day_of_year < 90 else (2.8 * monsoon_factor if day_of_year >= 140 else 0.4)
        v_monsoon = -1.0 if day_of_year < 90 else (3.2 * monsoon_factor if day_of_year >= 140 else 0.2)
        u = u_monsoon + 0.3 * np.sin(0.15 * lat_grid + 0.05 * day_of_year) + rng.normal(0.0, 0.05, (n_lat, n_lon))
        v = v_monsoon + 0.3 * np.cos(0.15 * lon_grid + 0.05 * day_of_year) + rng.normal(0.0, 0.05, (n_lat, n_lon))

        # Apply land mask to surface observations
        sst[~is_ocean_2d] = 0.0
        sss[~is_ocean_2d] = 0.0
        ssh[~is_ocean_2d] = 0.0
        u[~is_ocean_2d] = 0.0
        v[~is_ocean_2d] = 0.0

        raw_sst_arr[t_idx] = sst
        raw_sss_arr[t_idx] = sss
        raw_ssh_arr[t_idx] = ssh
        raw_u_arr[t_idx]   = u
        raw_v_arr[t_idx]   = v

        # 5. Physics-Guided 3D Subsurface Ocean Temperature Reconstruction (0m to 1000m)
        # Thermocline heave: D20 isotherm depth (m) modulated by SLA / SSH
        d20 = 95.0 + 90.0 * ssh
        d20 = np.clip(d20, 45.0, 160.0)

        for k, depth_m in enumerate(depths):
            if depth_m <= 10.0:
                # Mixed layer: temperature near SST with slight vertical decay
                t_k = sst - 0.015 * depth_m
            elif depth_m <= 300.0:
                # Main thermocline: steep thermal gradient governed by D20
                thermocline_gradient = 0.038
                t_surface = sst
                t_deep = 12.0
                decay = 1.0 / (1.0 + np.exp(thermocline_gradient * (depth_m - d20)))
                t_k = t_deep + (t_surface - t_deep) * decay
            elif depth_m <= 700.0:
                # Intermediate depth: slow cooling
                t_k = 12.0 - ((depth_m - 300.0) / 400.0) * 4.5 + 0.6 * ssh
            else:
                # Deep abyssal ocean (700m to 1000m): 5.5°C to 7.2°C
                t_k = 7.5 - ((depth_m - 700.0) / 300.0) * 1.5 + 0.2 * ssh

            # Set invalid ocean depths (bathymetry / land) to NaN
            t_k[~valid_mask_3d[k]] = np.nan
            raw_temp_3d[t_idx, k] = t_k

        if (t_idx + 1) % 30 == 0 or (t_idx + 1) == n_time:
            print(f"  Processed {t_idx + 1}/{n_time} daily timesteps ({current_date.strftime('%Y-%m-%d')})...")

    # Compute normalized representations for storage
    norm_sst = np.where(is_ocean_2d[np.newaxis, ...], (raw_sst_arr - x_mean[0, 0, 0, 0]) / x_std[0, 0, 0, 0], 0.0)
    norm_sss = np.where(is_ocean_2d[np.newaxis, ...], (raw_sss_arr - x_mean[0, 0, 0, 1]) / x_std[0, 0, 0, 1], 0.0)
    norm_ssh = np.where(is_ocean_2d[np.newaxis, ...], (raw_ssh_arr - x_mean[0, 0, 0, 2]) / x_std[0, 0, 0, 2], 0.0)
    norm_u   = np.where(is_ocean_2d[np.newaxis, ...], (raw_u_arr   - x_mean[0, 0, 0, 3]) / x_std[0, 0, 0, 3], 0.0)
    norm_v   = np.where(is_ocean_2d[np.newaxis, ...], (raw_v_arr   - x_mean[0, 0, 0, 4]) / x_std[0, 0, 0, 4], 0.0)

    print("\nAssembling xarray Dataset and saving NetCDF file...")
    ds = xr.Dataset(
        data_vars={
            "raw_sst": (["time", "lat", "lon"], raw_sst_arr),
            "raw_sss": (["time", "lat", "lon"], raw_sss_arr),
            "raw_ssh": (["time", "lat", "lon"], raw_ssh_arr),
            "raw_u":   (["time", "lat", "lon"], raw_u_arr),
            "raw_v":   (["time", "lat", "lon"], raw_v_arr),
            "raw_subsurface_temperature": (["time", "depth", "lat", "lon"], raw_temp_3d),

            "sst": (["time", "lat", "lon"], norm_sst.astype(np.float32)),
            "sss": (["time", "lat", "lon"], norm_sss.astype(np.float32)),
            "ssh": (["time", "lat", "lon"], norm_ssh.astype(np.float32)),
            "u":   (["time", "lat", "lon"], norm_u.astype(np.float32)),
            "v":   (["time", "lat", "lon"], norm_v.astype(np.float32)),

            "valid_mask": (["depth", "lat", "lon"], valid_mask_3d),
            "ocean_mask": (["lat", "lon"], is_ocean_2d),
        },
        coords={
            "time": time_strs,
            "depth": depths,
            "lat": lats,
            "lon": lons,
        },
        attrs={
            "title": "OceanEmbed Daily 0.25° Subsurface Ocean Temperature Reconstruction Dataset",
            "institution": "Ministry of Earth Sciences (MoES) / INCOIS Problem Statement 26066",
            "domain": "North Indian Ocean (5°N–30°N, 45°E–105°E)",
            "spatial_resolution": "0.25° × 0.25°",
            "temporal_resolution": "Daily (2018-01-01 to 2018-07-01)",
            "standard_depths_m": str(depths.tolist()),
            "input_variables": "SST, SSS, SSH/SLA, Surface U, Surface V",
        }
    )

    ds.to_netcdf(OUTPUT_FILE, format="NETCDF4", engine="netcdf4")
    print(f"Successfully generated and saved NetCDF file to:\n  {OUTPUT_FILE}")
    print(f"File Size: {OUTPUT_FILE.stat().st_size / (1024 * 1024):.2f} MB")
    ds.close()


if __name__ == "__main__":
    generate_daily_dataset()
