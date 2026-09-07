"""
OceanPreprocessor: Normalization utilities for OceanEmbed real-data pipeline.
SIH Problem 26066 — MoES / INCOIS

Handles 7-channel surface normalization and 15-depth subsurface denormalization
using climatological statistics from CMEMS North Indian Ocean data.
"""

import numpy as np
from typing import Dict, Optional


class OceanPreprocessor:
    """
    Normalizes 7-channel satellite surface inputs and denormalizes
    15-depth subsurface temperature predictions back to °C.
    """

    # Climatological statistics (mean, std) for each surface variable
    SURFACE_STATS = {
        "sst":    (28.5,  1.8),
        "sss":    (34.5,  1.6),
        "ssh":    (0.05,  0.18),
        "u_curr": (0.0,   0.35),
        "v_curr": (0.0,   0.35),
        "u_wind": (1.2,   4.5),
        "v_wind": (0.8,   4.2),
    }

    SURFACE_VARIABLES = ["sst", "sss", "ssh", "u_curr", "v_curr", "u_wind", "v_wind"]

    # Subsurface temperature stats
    SUBSURFACE_STATS = (18.0, 8.5)  # (mean_°C, std_°C) averaged over all depths

    def normalize_surface_tensor(
        self,
        surface_dict: Dict[str, np.ndarray],
        nan_fill: float = 0.0,
    ) -> np.ndarray:
        """
        Normalizes a dict of 7 surface arrays to a stacked (7, H, W) tensor.

        Args:
            surface_dict: dict mapping variable name → (H, W) numpy array
            nan_fill: Value to use for NaN/land pixels (default 0.0 = mean)
        Returns:
            norm_array: (7, H, W) float32 normalized array
        """
        channels = []
        for var in self.SURFACE_VARIABLES:
            arr = surface_dict.get(var)
            if arr is None:
                raise KeyError(f"Missing surface variable: '{var}'")
            mean, std = self.SURFACE_STATS[var]
            normed = (arr - mean) / (std + 1e-8)
            normed = np.where(np.isfinite(normed), normed, nan_fill)
            channels.append(normed.astype(np.float32))
        return np.stack(channels, axis=0)  # (7, H, W)

    def normalize_target_tensor(
        self,
        target: np.ndarray,
        nan_fill: float = 0.0,
    ) -> np.ndarray:
        """
        Normalizes (15, H, W) subsurface temperature array.

        Args:
            target: (15, H, W) temperature in °C (may contain NaNs over land)
            nan_fill: fill for NaN/land pixels
        Returns:
            normed: (15, H, W) float32 normalized array
        """
        mean, std = self.SUBSURFACE_STATS
        normed = (target - mean) / (std + 1e-8)
        return np.where(np.isfinite(normed), normed, nan_fill).astype(np.float32)

    def denormalize_prediction(self, pred_norm: np.ndarray) -> np.ndarray:
        """
        Converts normalized model output back to real temperature values (°C).

        Args:
            pred_norm: (15, H, W) or (B, 15, H, W) normalized prediction
        Returns:
            temp_degc: same shape in °C
        """
        mean, std = self.SUBSURFACE_STATS
        return pred_norm * std + mean

    def get_surface_raw_values(
        self,
        surface_dict: Dict[str, np.ndarray],
    ) -> Dict[str, float]:
        """Returns basin-mean surface values for telemetry display."""
        out = {}
        for var in self.SURFACE_VARIABLES:
            arr = surface_dict.get(var, np.array([np.nan]))
            valid = arr[np.isfinite(arr)]
            out[var] = round(float(valid.mean()), 4) if len(valid) > 0 else None
        return out
