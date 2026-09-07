"""
OceanPreprocessor: Normalization utilities for OceanEmbed real-data pipeline.
SIH Problem 26066 — MoES / INCOIS

Handles 7-channel surface normalization and 15-depth subsurface denormalization
using climatological statistics from SIH_Final_Data (2022–2024 NIO reanalysis).
"""

from typing import Dict, List, Optional
import numpy as np
from src.config import NORM_STATS, SURFACE_VARIABLES, STANDARD_DEPTHS, DEPTH_NORM_STATS


class OceanPreprocessor:
    """
    Normalizes 7-channel satellite surface inputs and denormalizes
    15-depth subsurface temperature predictions back to °C.
    """

    # Exact climatological statistics (mean, std) for the 7 surface variables
    SURFACE_STATS = NORM_STATS

    SURFACE_VARIABLES = SURFACE_VARIABLES

    # Subsurface column-mean temperature stats
    SUBSURFACE_STATS = NORM_STATS["thetao"]  # (21.69, 7.66)
    DEPTH_STATS = DEPTH_NORM_STATS

    # Alias mapping to ensure compatibility across modules
    ALIAS_MAP = {
        "u_curr": "u",
        "v_curr": "v",
        "u_wind": "eastward_wind",
        "v_wind": "northward_wind",
    }

    def normalize_surface_tensor(
        self,
        surface_dict: Dict[str, np.ndarray],
        nan_fill: float = 0.0,
    ) -> np.ndarray:
        """
        Normalizes a dict of 7 surface arrays to a stacked (7, H, W) tensor.

        Args:
            surface_dict: dict mapping variable name -> (H, W) numpy array
            nan_fill: Value to use for NaN/land pixels (default 0.0 = mean)
        Returns:
            norm_array: (7, H, W) float32 normalized array
        """
        channels = []
        for var in self.SURFACE_VARIABLES:
            # Check canonical name or aliases
            arr = surface_dict.get(var)
            if arr is None:
                # Check reverse alias
                for k, v in self.ALIAS_MAP.items():
                    if v == var and k in surface_dict:
                        arr = surface_dict[k]
                        break
                    elif k == var and v in surface_dict:
                        arr = surface_dict[v]
                        break

            if arr is None:
                raise KeyError(f"Missing surface variable: '{var}' in provided surface dictionary.")

            mean, std = self.SURFACE_STATS.get(var, (0.0, 1.0))
            normed = (arr - mean) / (std + 1e-8)
            normed = np.where(np.isfinite(normed), normed, nan_fill)
            channels.append(normed.astype(np.float32))

        return np.stack(channels, axis=0)  # (7, H, W)

    def normalize_target_tensor(
        self,
        target: np.ndarray,
        nan_fill: float = 0.0,
        per_depth: bool = False,
    ) -> np.ndarray:
        """
        Normalizes (15, H, W) subsurface temperature array.

        Args:
            target: (15, H, W) temperature in °C (may contain NaNs over land)
            nan_fill: fill for NaN/land pixels
            per_depth: If True, uses depth-specific (mean, std)
        Returns:
            normed: (15, H, W) float32 normalized array
        """
        if not per_depth:
            mean, std = self.SUBSURFACE_STATS
            normed = (target - mean) / (std + 1e-8)
            return np.where(np.isfinite(normed), normed, nan_fill).astype(np.float32)
        else:
            normed_layers = []
            for k, d in enumerate(STANDARD_DEPTHS):
                mean_d, std_d = self.DEPTH_STATS.get(d, self.SUBSURFACE_STATS)
                layer = (target[k] - mean_d) / (std_d + 1e-8)
                layer = np.where(np.isfinite(layer), layer, nan_fill)
                normed_layers.append(layer.astype(np.float32))
            return np.stack(normed_layers, axis=0)

    def denormalize_prediction(
        self,
        pred_norm: np.ndarray,
        per_depth: bool = False,
    ) -> np.ndarray:
        """
        Converts normalized model output back to real temperature values (°C).

        Args:
            pred_norm: (15, H, W) or (B, 15, H, W) normalized prediction
            per_depth: If True, uses depth-specific (mean, std)
        Returns:
            temp_degc: same shape in °C
        """
        if not per_depth:
            mean, std = self.SUBSURFACE_STATS
            return pred_norm * std + mean
        else:
            is_batched = pred_norm.ndim == 4
            work = pred_norm if is_batched else pred_norm[np.newaxis, ...]
            b, c, h, w = work.shape
            denorm = np.zeros_like(work)
            for k, d in enumerate(STANDARD_DEPTHS):
                mean_d, std_d = self.DEPTH_STATS.get(d, self.SUBSURFACE_STATS)
                denorm[:, k, :, :] = work[:, k, :, :] * std_d + mean_d
            return denorm if is_batched else denorm[0]

    def get_surface_raw_values(
        self,
        surface_dict: Dict[str, np.ndarray],
    ) -> Dict[str, Optional[float]]:
        """Returns basin-mean surface values for telemetry display."""
        out = {}
        for var in self.SURFACE_VARIABLES:
            arr = surface_dict.get(var)
            if arr is None:
                continue
            valid = arr[np.isfinite(arr)]
            out[var] = round(float(valid.mean()), 4) if len(valid) > 0 else None
        return out
