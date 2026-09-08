"""
OceanEmbed Real-Time Inference Engine (SIH Problem 26066 — MoES / INCOIS).

Production-grade 3D subsurface ocean temperature predictor using OceanEmbedNet
on the official SIH_Final_Data (2022–2024 daily reanalysis, 1096 timesteps).

All 7 real satellite input channels:
  SST, SSS, SSH/SLA, Surface Current U, Surface Current V,
  10m Eastward Wind, 10m Northward Wind
Outputs:
  3D Subsurface Temperature Field (15 standard depths, 0–1000m)
  Derived Physical Diagnostics: D20 Thermocline, MLD, TCHP, OHC
"""

from datetime import datetime, timezone
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple
import h5py
import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.config import (
    SIH_FINAL_TRAINING_NC, ASSETS_DIR, LATS, LONS, STANDARD_DEPTHS,
    N_LAT, N_LON, N_DEPTHS, SURFACE_VARIABLES, MODEL_CHECKPOINT,
    LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, SPATIAL_RES
)
from src.models.ocean_embed_net import load_trained_ocean_embed_net
from src.data.preprocessor import OceanPreprocessor
from src.data.ocean_physics import (
    compute_physical_diagnostics, compute_d20_grid_2d,
    compute_mackenzie_sound_velocity, compute_profile_uncertainty
)


class OceanEmbedPredictor:
    """
    Production-grade predictor using OceanEmbedNet on SIH_Final_Data (2022–2024).
    Uses O(1) memory-efficient HDF5 slicing to support all 1096 daily timesteps
    without RAM saturation.
    """

    def __init__(self, dataset_path: Optional[Path] = None, device: str = "cpu"):
        print("=" * 68, flush=True)
        print("  OceanEmbed Production Predictor (SIH 26066 - MoES / INCOIS)", flush=True)
        print("  Primary Dataset: SIH_Final_Data (2022-01-01 to 2024-12-31)", flush=True)
        print("  Model: OceanEmbedNet (7-channel Surface Encoder + Depth Expansion)", flush=True)
        print("=" * 68, flush=True)

        self.ds_path = dataset_path or SIH_FINAL_TRAINING_NC
        if not self.ds_path.exists():
            raise FileNotFoundError(f"Primary dataset not found at: {self.ds_path}")

        self.device = device
        self.preprocessor = OceanPreprocessor()
        self.lats = LATS
        self.lons = LONS
        self.depths = np.array(STANDARD_DEPTHS, dtype=np.float32)

        # Open HDF5 file in read-only mode
        self._h5 = h5py.File(self.ds_path, "r")

        # Index all 1096 dates
        self.dates: List[str] = []
        self._date_to_idx: Dict[str, int] = {}
        self._index_dates()

        # Derive 2D ocean/land mask from valid SST pixels in the first timestep
        self.ocean_mask = self._build_ocean_mask()

        # Load trained PyTorch model
        self.model = load_trained_ocean_embed_net(MODEL_CHECKPOINT, device=self.device)

        # In-memory caches for fast responses (< 1ms after warm-up)
        self._pred_cache: Dict[str, np.ndarray] = {}       # date -> (15, 101, 241) °C
        self._surface_cache: Dict[str, Dict] = {}          # date -> raw 7-channel dict
        self._truth_cache: Dict[str, np.ndarray] = {}      # date -> (15, 101, 241) truth °C
        self._embed_cache: Dict[str, np.ndarray] = {}      # date -> (64, 101, 241)

        # Warm up cache on key representative dates
        warmup_dates = ["2024-06-01", "2024-01-15", "2023-07-15", "2022-06-01"]
        for d in warmup_dates:
            if d in self._date_to_idx:
                self._compute_or_get_prediction(d)

        print(
            f"[OK] Predictor ready:\n"
            f"  • Date Span: {len(self.dates)} daily timesteps ({self.dates[0]} to {self.dates[-1]})\n"
            f"  • Domain: North Indian Ocean ({LAT_MIN}°N–{LAT_MAX}°N, {LON_MIN}°E–{LON_MAX}°E) | Grid: {N_LAT}x{N_LON}\n"
            f"  • Standard Depths: {N_DEPTHS} levels (0 to 1000m)\n"
            f"  • Surface Channels: 7 physical variables (OSTIA SST, SSS, SSH, Currents U/V, Winds U/V)",
            flush=True
        )

    def _index_dates(self):
        """Map timestamps to YYYY-MM-DD format."""
        time_arr = self._h5["time"][:]
        for idx, ts in enumerate(time_arr):
            dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
            d_str = dt.strftime("%Y-%m-%d")
            self.dates.append(d_str)
            self._date_to_idx[d_str] = idx

    def _build_ocean_mask(self) -> np.ndarray:
        """Create binary ocean mask (True = ocean, False = land)."""
        sst_0 = self._h5["sst"][0]
        # Ocean pixels have valid finite values
        mask = np.isfinite(sst_0) & (sst_0 > 0.0)
        return mask

    def close(self):
        """Close HDF5 file handle cleanly."""
        if hasattr(self, "_h5") and self._h5:
            try:
                self._h5.close()
            except Exception:
                pass

    def _resolve_date(self, date: Optional[str]) -> str:
        """Resolve requested date or fallback to default operational date."""
        if date and date in self._date_to_idx:
            return date
        return "2024-06-01" if "2024-06-01" in self._date_to_idx else self.dates[-1]

    def _load_raw_surface_slice(self, t_idx: int) -> Dict[str, np.ndarray]:
        """Load single day 7-channel surface slice from HDF5."""
        raw = {
            "sst":            self._h5["sst"][t_idx].astype(np.float32),
            "sss":            self._h5["sss"][t_idx].astype(np.float32),
            "ssh":            self._h5["ssh"][t_idx].astype(np.float32),
            "u":              self._h5["u"][t_idx].astype(np.float32),
            "v":              self._h5["v"][t_idx].astype(np.float32),
            "eastward_wind":  self._h5["eastward_wind"][t_idx].astype(np.float32),
            "northward_wind": self._h5["northward_wind"][t_idx].astype(np.float32),
        }

        # Handle missing satellite wind dropouts using physical monsoonal wind climatology
        ew = raw["eastward_wind"]
        if np.all(np.isnan(ew)) or (np.isnan(ew).sum() > 0.8 * self.ocean_mask.sum()):
            dt = datetime.fromtimestamp(float(self._h5["time"][t_idx]), tz=timezone.utc)
            m = dt.month
            # SW Monsoon (Jun-Sep): strong south-westerlies
            # NE Monsoon (Nov-Feb): north-easterlies
            # Intermonsoon (Mar-May, Oct): light variable winds
            if 6 <= m <= 9:
                u_w, v_w = 4.8, 3.5
            elif m in [11, 12, 1, 2]:
                u_w, v_w = -2.4, -1.9
            else:
                u_w, v_w = 1.4, 0.9
            raw["eastward_wind"] = np.where(self.ocean_mask, u_w, np.nan).astype(np.float32)
            raw["northward_wind"] = np.where(self.ocean_mask, v_w, np.nan).astype(np.float32)

        # Mask out land values to prevent artifacts
        for k in raw:
            raw[k][~self.ocean_mask] = np.nan
        return raw

    def _compute_or_get_prediction(self, date_str: str) -> Tuple[Dict[str, np.ndarray], np.ndarray, np.ndarray, np.ndarray]:
        """
        Extract surface inputs, run OceanEmbedNet forward pass, and cache.
        Returns: (raw_surface_dict, pred_degc_3d, truth_degc_3d, z_surf_embedding)
        """
        if date_str in self._pred_cache:
            return (
                self._surface_cache[date_str],
                self._pred_cache[date_str],
                self._truth_cache[date_str],
                self._embed_cache[date_str],
            )

        t_idx = self._date_to_idx[date_str]
        raw_surface = self._load_raw_surface_slice(t_idx)
        truth_3d = self._h5["thetao"][t_idx].astype(np.float32)
        truth_3d[:, ~self.ocean_mask] = np.nan

        # Normalize 7 surface channels -> (7, 101, 241)
        norm_surf = self.preprocessor.normalize_surface_tensor(raw_surface, nan_fill=0.0)

        # Run model inference
        tensor_in = torch.from_numpy(norm_surf[np.newaxis]).float().to(self.device)
        with torch.no_grad():
            pred_norm, z_surf = self.model(tensor_in, return_embedding=True)

        pred_norm_np = pred_norm.cpu().numpy()[0]
        pred_degc = self.preprocessor.denormalize_prediction(pred_norm_np)
        pred_degc[:, ~self.ocean_mask] = np.nan

        z_surf_np = z_surf.cpu().numpy()[0]

        # Store in cache
        self._surface_cache[date_str] = raw_surface
        self._pred_cache[date_str] = pred_degc
        self._truth_cache[date_str] = truth_3d
        self._embed_cache[date_str] = z_surf_np

        return raw_surface, pred_degc, truth_3d, z_surf_np

    # ─────────────────────────────────────────────────────────────────────────
    # Public Inference APIs
    # ─────────────────────────────────────────────────────────────────────────

    def predict_profile(
        self,
        lat: float,
        lon: float,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Reconstruct vertical temperature profile at specified (lat, lon, date).
        Includes physics-derived diagnostics: D20, MLD, TCHP, and error metrics vs GLORYS.
        """
        date_str = self._resolve_date(date)
        raw_surf, pred_3d, truth_3d, _ = self._compute_or_get_prediction(date_str)

        # Find nearest grid coordinates
        i_lat = int(np.clip(np.round((lat - LAT_MIN) / SPATIAL_RES), 0, N_LAT - 1))
        j_lon = int(np.clip(np.round((lon - LON_MIN) / SPATIAL_RES), 0, N_LON - 1))

        grid_lat = float(self.lats[i_lat])
        grid_lon = float(self.lons[j_lon])
        is_ocean = bool(self.ocean_mask[i_lat, j_lon])

        profile_data = []
        pred_col = pred_3d[:, i_lat, j_lon]
        truth_col = truth_3d[:, i_lat, j_lon]

        # Sound velocity and uncertainty calculations
        sound_speeds = compute_mackenzie_sound_velocity(pred_col, self.depths, salinity=35.0)
        uncertainties = compute_profile_uncertainty(self.depths)

        for k, depth_m in enumerate(self.depths):
            p_val = pred_col[k]
            t_val = truth_col[k]
            is_valid = bool(is_ocean and np.isfinite(p_val) and np.isfinite(t_val))
            sigma = float(uncertainties[k])
            c_val = float(sound_speeds[k]) if k < len(sound_speeds) and np.isfinite(sound_speeds[k]) else None

            profile_data.append({
                "depth_m": float(depth_m),
                "temperature_c": round(float(p_val), 3) if is_valid else None,
                "truth_temperature_c": round(float(t_val), 3) if is_valid else None,
                "error_c": round(float(p_val - t_val), 3) if is_valid else None,
                "uncertainty_sigma_c": round(sigma, 3) if is_valid else None,
                "temp_upper_c": round(float(p_val + sigma), 3) if is_valid else None,
                "temp_lower_c": round(float(p_val - sigma), 3) if is_valid else None,
                "sound_velocity_ms": round(c_val, 2) if is_valid and c_val is not None else None,
                "valid": is_valid,
            })

        # Physical diagnostics
        if is_ocean:
            diagnostics = compute_physical_diagnostics(pred_col, self.depths)
            truth_diagnostics = compute_physical_diagnostics(truth_col, self.depths)
        else:
            diagnostics = {"status": "land_point"}
            truth_diagnostics = {"status": "land_point"}

        # Surface channel telemetry
        surface_obs = {}
        for var in SURFACE_VARIABLES:
            val = raw_surf[var][i_lat, j_lon]
            surface_obs[var] = round(float(val), 3) if np.isfinite(val) else None

        return {
            "status": "success",
            "date": date_str,
            "requested_latitude": lat,
            "requested_longitude": lon,
            "grid_latitude": grid_lat,
            "grid_longitude": grid_lon,
            "is_ocean": is_ocean,
            "profile": profile_data,
            "diagnostics": diagnostics,
            "truth_diagnostics": truth_diagnostics,
            "surface_observations": surface_obs,
            "model": "OceanEmbedNet (7-channel, SIH 26066)",
            "data_source": "Copernicus GLORYS12V1 Reanalysis (SIH_Final_Data 2022-2024)",
            "max_valid_depth_m": 1000.0,
        }

    def predict_transect(
        self,
        fixed_val: float,
        date: Optional[str] = None,
        axis: str = "lat",
    ) -> Dict[str, Any]:
        """
        Generate 2D vertical cross-section transect (Depth x Lon or Depth x Lat).
        """
        date_str = self._resolve_date(date)
        _, pred_3d, truth_3d, _ = self._compute_or_get_prediction(date_str)

        if axis == "lat":
            # Fixed latitude -> Depth x Longitude curtain
            i_lat = int(np.clip(np.round((fixed_val - LAT_MIN) / SPATIAL_RES), 0, N_LAT - 1))
            curtain_pred = pred_3d[:, i_lat, :]   # (15, 241)
            curtain_truth = truth_3d[:, i_lat, :]
            coords = [round(float(x), 2) for x in self.lons]
            fixed_name = f"Latitude {self.lats[i_lat]:.2f}°N"
        else:
            # Fixed longitude -> Depth x Latitude curtain
            j_lon = int(np.clip(np.round((fixed_val - LON_MIN) / SPATIAL_RES), 0, N_LON - 1))
            curtain_pred = pred_3d[:, :, j_lon]   # (15, 101)
            curtain_truth = truth_3d[:, :, j_lon]
            coords = [round(float(y), 2) for y in self.lats]
            fixed_name = f"Longitude {self.lons[j_lon]:.2f}°E"

        # Calculate D20 isotherm along the curtain
        d20_list = []
        for c_idx in range(curtain_pred.shape[1]):
            col = curtain_pred[:, c_idx]
            valid_col = col[np.isfinite(col)]
            if len(valid_col) == 0:
                d20_list.append(None)
                continue
            idx = np.where(col < 20.0)[0]
            if len(idx) == 0:
                d20_list.append(float(self.depths[-1]))
            elif idx[0] == 0:
                d20_list.append(float(self.depths[0]))
            else:
                k = idx[0]
                t1, t2 = float(col[k - 1]), float(col[k])
                z1, z2 = float(self.depths[k - 1]), float(self.depths[k])
                if t1 != t2:
                    d20_val = z1 + (20.0 - t1) * (z2 - z1) / (t2 - t1)
                else:
                    d20_val = z1
                d20_list.append(round(float(d20_val), 1))

        pred_matrix = np.where(np.isnan(curtain_pred), None, np.round(curtain_pred, 2)).tolist()
        truth_matrix = np.where(np.isnan(curtain_truth), None, np.round(curtain_truth, 2)).tolist()
        err_arr = np.abs(curtain_pred - curtain_truth)
        err_matrix = np.where(np.isnan(err_arr), None, np.round(err_arr, 2)).tolist()

        return {
            "status": "success",
            "date": date_str,
            "axis": axis,
            "fixed_location": fixed_name,
            "depths": [float(d) for d in self.depths],
            "coordinates": coords,
            "temperature_matrix": pred_matrix,
            "predicted_curtain": pred_matrix,
            "truth_curtain": truth_matrix,
            "error_curtain": err_matrix,
            "d20_isotherm": d20_list,
        }


    def _clean_wall_slice(self, slice_2d: np.ndarray, default_profile: np.ndarray) -> np.ndarray:
        """Interpolate across land NaNs to guarantee continuous, solid volumetric curtains."""
        out = slice_2d.copy()
        for k in range(len(default_profile)):
            row = out[k]
            valid = np.isfinite(row)
            if valid.sum() == 0:
                out[k] = default_profile[k]
            elif valid.sum() < len(row):
                indices = np.arange(len(row))
                out[k] = np.interp(indices, indices[valid], row[valid])
        return np.clip(out, 3.5, 32.0)

    def predict_volume_3d(
        self,
        lat: float,
        lon: float,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate complete 3D volumetric reconstruction package matching design template:
        - Southern boundary curtain (5°N, 45°E–105°E, 0–1000m)
        - Eastern boundary curtain (105°E, 5°N–30°N, 0–1000m)
        - Western boundary curtain (45°E, 5°N–30°N, 0–1000m)
        - Northern boundary curtain (30°N, 45°E–105°E, 0–1000m)
        - Intersecting Latitudinal & Longitudinal orthocuts at chosen probe point
        - Realistic Composite Top Surface (Ocean SST + Geographic Satellite Terrain of India & South Asia)
        - High-definition vector coastlines & country borders
        - 2D D20 thermocline depth topography
        - Local probe point telemetry and vertical profile
        """
        date_str = self._resolve_date(date)
        raw_surf, pred_3d, _, _ = self._compute_or_get_prediction(date_str)

        i_lat = int(np.clip(np.round((lat - LAT_MIN) / SPATIAL_RES), 0, N_LAT - 1))
        j_lon = int(np.clip(np.round((lon - LON_MIN) / SPATIAL_RES), 0, N_LON - 1))

        # Basin-wide vertical temperature profile baseline for wall continuity
        mean_profile = np.nanmean(pred_3d, axis=(1, 2))
        for k in range(len(mean_profile)):
            if np.isnan(mean_profile[k]):
                mean_profile[k] = 28.5 - 0.024 * float(self.depths[k])

        # 1. Continuous Boundary Curtains (Outer Block Walls)
        south_raw = pred_3d[:, 0, :]    # 5°N, shape (15, 241)
        north_raw = pred_3d[:, -1, :]   # 30°N, shape (15, 241)
        west_raw  = pred_3d[:, :, 0]    # 45°E, shape (15, 101)
        east_raw  = pred_3d[:, :, -1]   # 105°E, shape (15, 101)

        south_clean = self._clean_wall_slice(south_raw, mean_profile)
        north_clean = self._clean_wall_slice(north_raw, mean_profile)
        west_clean  = self._clean_wall_slice(west_raw, mean_profile)
        east_clean  = self._clean_wall_slice(east_raw, mean_profile)

        # 2. Intersecting Orthocuts at selected probe location
        lat_slice = self._clean_wall_slice(pred_3d[:, i_lat, :], mean_profile)
        lon_slice = self._clean_wall_slice(pred_3d[:, :, j_lon], mean_profile)

        # 3. Downsampled Grids for Top Face (step = 2 for 0.5° responsive streaming)
        step = 2
        lats_sub = self.lats[::step]
        lons_sub = self.lons[::step]
        sst_sub = raw_surf["sst"][::step, ::step].copy()
        mask_sub = self.ocean_mask[::step, ::step]

        # 4. Realistic Top Composite Surface (SST for ocean [0-30], Satellite Terrain [31-40] for land)
        H_sub, W_sub = mask_sub.shape
        top_composite = np.zeros((H_sub, W_sub), dtype=np.float32)
        for i_s in range(H_sub):
            lat_val = lats_sub[i_s]
            for j_s in range(W_sub):
                lon_val = lons_sub[j_s]
                if mask_sub[i_s, j_s]:
                    v = sst_sub[i_s, j_s]
                    top_composite[i_s, j_s] = 28.5 if (np.isnan(v) or v <= 0.0) else np.clip(v, 2.0, 30.0)
                else:
                    # Geographic satellite terrain values corresponding to compositeColorscale
                    if lat_val >= 27.5 and 74.0 <= lon_val <= 96.0:
                        # Himalayas and Tibetan snow peaks
                        elev_frac = min(1.0, (lat_val - 27.5) / 2.5)
                        top_composite[i_s, j_s] = 38.0 + elev_frac * 2.0
                    elif lon_val <= 60.0:
                        # Arabian Peninsula & Zagros
                        top_composite[i_s, j_s] = 36.4 + 0.5 * np.sin(lat_val * 0.4)
                    elif lon_val >= 92.0:
                        # Indochina & Myanmar lush vegetation
                        top_composite[i_s, j_s] = 32.5 + 0.4 * np.sin(lat_val * 0.5)
                    elif 8.0 <= lat_val <= 22.0 and 72.0 <= lon_val <= 78.0:
                        # Western Ghats lush tropical forest
                        top_composite[i_s, j_s] = 33.2
                    elif 8.0 <= lat_val <= 26.0 and 68.0 <= lon_val <= 90.0:
                        # Peninsular India & Deccan
                        if lat_val >= 24.0 and lon_val <= 74.0:
                            top_composite[i_s, j_s] = 36.2 # Thar Desert
                        else:
                            top_composite[i_s, j_s] = 34.0 + (lat_val - 12.0) * 0.08
                    else:
                        top_composite[i_s, j_s] = 34.2

        # 5. Extract High-Definition Coastline Vectors
        try:
            from scipy.ndimage import binary_dilation
            dilated = binary_dilation(self.ocean_mask)
            coast_mask = dilated & (~self.ocean_mask)
            c_idx = np.argwhere(coast_mask)
            coastlines = {
                "lats": [float(self.lats[idx[0]]) for idx in c_idx],
                "lons": [float(self.lons[idx[1]]) for idx in c_idx]
            }
        except Exception:
            coastlines = {"lats": [], "lons": []}

        # 6. D20 Thermocline Depth Map
        pred_sub = pred_3d[:, ::step, ::step]
        d20_grid = compute_d20_grid_2d(pred_sub, self.depths, mask_sub)
        d20_clean = np.where(np.isnan(d20_grid), 95.0, np.round(d20_grid, 1))

        # 7. Pointwise Telemetry and Vertical Profile at Probe Location
        sst_point = float(raw_surf["sst"][i_lat, j_lon]) if np.isfinite(raw_surf["sst"][i_lat, j_lon]) else 28.5
        sss_point = float(raw_surf["sss"][i_lat, j_lon]) if np.isfinite(raw_surf["sss"][i_lat, j_lon]) else 35.0
        ssh_point = float(raw_surf["ssh"][i_lat, j_lon]) if np.isfinite(raw_surf["ssh"][i_lat, j_lon]) else 0.05
        prof_point = [
            {"depth_m": float(d), "temperature_c": float(np.round(pred_3d[k, i_lat, j_lon], 2))}
            if np.isfinite(pred_3d[k, i_lat, j_lon]) else
            {"depth_m": float(d), "temperature_c": float(np.round(mean_profile[k], 2))}
            for k, d in enumerate(self.depths)
        ]

        # 8. Bottom Base Slice at 1000m Depth (fully encloses the 3D block underneath)
        bottom_raw = pred_3d[-1, ::step, ::step]  # (51, 121)
        bottom_clean = np.where(np.isnan(bottom_raw), 5.2, np.clip(bottom_raw, 3.5, 7.5))

        return {
            "status": "success",
            "date": date_str,
            "selected_lat": float(self.lats[i_lat]),
            "selected_lon": float(self.lons[j_lon]),
            "depths": [float(d) for d in self.depths],
            # Support both naming conventions to guarantee frontend compatibility
            "lats": [float(y) for y in self.lats],
            "lons": [float(x) for x in self.lons],
            "lats_all": [float(y) for y in self.lats],
            "lons_all": [float(x) for x in self.lons],
            "sub_lats": [float(y) for y in lats_sub],
            "sub_lons": [float(x) for x in lons_sub],
            "lats_sub": [float(y) for y in lats_sub],
            "lons_sub": [float(x) for x in lons_sub],
            # Wall Curtain Slices
            "south_slice": np.round(south_clean, 2).tolist(),
            "north_slice": np.round(north_clean, 2).tolist(),
            "west_slice": np.round(west_clean, 2).tolist(),
            "east_slice": np.round(east_clean, 2).tolist(),
            # Base floor
            "bottom_slice": np.round(bottom_clean, 2).tolist(),
            # Cross-section probe slices
            "lat_slice": np.round(lat_slice, 2).tolist(),
            "lon_slice": np.round(lon_slice, 2).tolist(),
            # Surfaces
            "surface_sst": np.where(np.isnan(sst_sub), 28.0, np.round(sst_sub, 2)).tolist(),
            "top_composite_surface": np.round(top_composite, 2).tolist(),
            "coastlines": coastlines,
            "d20_depth_map": d20_clean.tolist(),
            "d20_thermocline": d20_clean.tolist(),
            # Telemetry
            "surface_telemetry": {
                "sst_c": round(sst_point, 2),
                "sss_psu": round(sss_point, 2),
                "ssh_m": round(ssh_point, 3)
            },
            "profile_at_center": prof_point
        }

    def get_basin_map(
        self,
        date: Optional[str] = None,
        depth_m: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Return full-basin predicted 2D horizontal temperature map at selected depth.
        """
        date_str = self._resolve_date(date)
        _, pred_3d, _, _ = self._compute_or_get_prediction(date_str)

        # Find closest standard depth
        k_depth = int(np.argmin(np.abs(self.depths - depth_m)))
        actual_depth = float(self.depths[k_depth])

        field = pred_3d[k_depth]  # (101, 241)
        # Subsample for responsive web transmission
        step = 2
        field_sub = field[::step, ::step]

        return {
            "status": "success",
            "date": date_str,
            "depth_m": actual_depth,
            "lats": [float(y) for y in self.lats[::step]],
            "lons": [float(x) for x in self.lons[::step]],
            "temperatures": np.where(np.isnan(field_sub), None, np.round(field_sub, 2)).tolist(),
        }

    def get_latent_embeddings(self, date: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract compact 64-channel satellite spatial embedding and PCA RGB projection.
        Demonstrates representation learning under PS-26066.
        """
        date_str = self._resolve_date(date)
        _, _, _, z_surf = self._compute_or_get_prediction(date_str)

        z_tensor = torch.from_numpy(z_surf)
        pca_rgb = self.model.get_embedding_pca_rgb(z_tensor)  # (3, 101, 241)
        pca_rgb[:, ~self.ocean_mask] = np.nan

        step = 2
        rgb_sub = pca_rgb[:, ::step, ::step]

        return {
            "status": "success",
            "date": date_str,
            "embedding_dim": 64,
            "lats": [float(y) for y in self.lats[::step]],
            "lons": [float(x) for x in self.lons[::step]],
            "pca_r": np.where(np.isnan(rgb_sub[0]), None, np.round(rgb_sub[0], 3)).tolist(),
            "pca_g": np.where(np.isnan(rgb_sub[1]), None, np.round(rgb_sub[1], 3)).tolist(),
            "pca_b": np.where(np.isnan(rgb_sub[2]), None, np.round(rgb_sub[2], 3)).tolist(),
            "description": "Top 3 Principal Components of 64-channel latent satellite embedding."
        }

    def get_surface_observations(self, date: Optional[str] = None) -> Dict[str, Any]:
        """Return 7 real surface observation channels for the selected date."""
        date_str = self._resolve_date(date)
        raw_surf, _, _, _ = self._compute_or_get_prediction(date_str)
        stats = self.preprocessor.get_surface_raw_values(raw_surf)
        return {
            "status": "success",
            "date": date_str,
            "basin_means": stats,
            "variables": SURFACE_VARIABLES,
        }

    def get_datasets(self) -> Dict[str, Any]:
        """Return primary dataset metadata."""
        return {
            "active_mode": "2022_2024",
            "datasets": {
                "2022_2024": {
                    "source": "SIH_Final_Data (Copernicus GLORYS12V1 + OSTIA/DUACS/CCMP)",
                    "dates": self.dates,
                    "count": len(self.dates),
                }
            }
        }
