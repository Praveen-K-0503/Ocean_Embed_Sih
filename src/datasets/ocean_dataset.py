"""
PyTorch Dataset Pipeline for OceanEmbed (SIH Problem 26066 — MoES / INCOIS).
Directly loads SIH_Final_Data (Final_Training_Dataset_2022_2024.nc).
Provides 7-channel surface inputs and 15-depth target temperature fields.
"""

from pathlib import Path
import sys
from typing import Dict, List, Optional, Tuple
import h5py
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.config import SIH_FINAL_TRAINING_NC, SURFACE_VARIABLES, STANDARD_DEPTHS, N_LAT, N_LON
from src.data.preprocessor import OceanPreprocessor


class SIHOceanDataset(Dataset):
    """
    PyTorch Dataset directly streaming from SIH_Final_Data (1,096 daily timesteps).
    Split options:
      - 'train': 2022-01-01 to 2023-12-31 (730 timesteps)
      - 'val':   2024-01-01 to 2024-06-30 (182 timesteps)
      - 'test':  2024-07-01 to 2024-12-31 (184 timesteps)
      - 'all':   All 1,096 timesteps
    """

    def __init__(
        self,
        nc_path: Optional[Path] = None,
        split: str = "train",
        val_ratio: float = 0.2,
    ):
        super().__init__()
        self.nc_path = nc_path or SIH_FINAL_TRAINING_NC
        if not self.nc_path.exists():
            raise FileNotFoundError(f"SIH Training Dataset not found at: {self.nc_path}")

        self.split = split
        self.preprocessor = OceanPreprocessor()
        self._h5 = None  # Lazy opened per-worker for multi-process safety

        # Read time dimension to determine indices
        with h5py.File(self.nc_path, "r") as f:
            total_times = len(f["time"])
            sst_sample = f["sst"][0]
            self.ocean_mask = (np.isfinite(sst_sample) & (sst_sample > 0.0)).astype(bool)

        # 2022-2023: train (730 days), 2024: val/test (366 days)
        if split == "train":
            self.indices = list(range(0, 730))
        elif split == "val":
            self.indices = list(range(730, 912))   # 2024-01-01 to 2024-06-30
        elif split == "test":
            self.indices = list(range(912, total_times)) # 2024-07-01 to 2024-12-31
        else:
            self.indices = list(range(0, total_times))

    def _ensure_open(self):
        if self._h5 is None:
            self._h5 = h5py.File(self.nc_path, "r")

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        self._ensure_open()
        t_idx = self.indices[idx]

        # Read 7 surface channels
        raw_surface = {
            "sst":            self._h5["sst"][t_idx].astype(np.float32),
            "sss":            self._h5["sss"][t_idx].astype(np.float32),
            "ssh":            self._h5["ssh"][t_idx].astype(np.float32),
            "u":              self._h5["u"][t_idx].astype(np.float32),
            "v":              self._h5["v"][t_idx].astype(np.float32),
            "eastward_wind":  self._h5["eastward_wind"][t_idx].astype(np.float32),
            "northward_wind": self._h5["northward_wind"][t_idx].astype(np.float32),
        }

        # Wind seasonal fallback if NaN
        if np.all(np.isnan(raw_surface["eastward_wind"])):
            raw_surface["eastward_wind"] = np.where(self.ocean_mask, 3.05, 0.0).astype(np.float32)
            raw_surface["northward_wind"] = np.where(self.ocean_mask, -1.12, 0.0).astype(np.float32)

        # Target 3D temperature (15, 101, 241)
        raw_thetao = self._h5["thetao"][t_idx].astype(np.float32)

        # Normalize inputs (7, 101, 241) and targets (15, 101, 241)
        norm_inputs = self.preprocessor.normalize_surface_tensor(raw_surface, nan_fill=0.0)
        norm_target = self.preprocessor.normalize_target_tensor(raw_thetao, nan_fill=0.0)

        x_tensor = torch.from_numpy(norm_inputs).float()
        y_tensor = torch.from_numpy(norm_target).float()
        mask_tensor = torch.from_numpy(self.ocean_mask).bool()

        return x_tensor, y_tensor, mask_tensor

    def close(self):
        if self._h5 is not None:
            try:
                self._h5.close()
            except Exception:
                pass
            self._h5 = None


def create_dataloaders(
    batch_size: int = 4,
    nc_path: Optional[Path] = None,
    num_workers: int = 0,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """Factory creating train, val, and test DataLoaders."""
    train_ds = SIHOceanDataset(nc_path=nc_path, split="train")
    val_ds   = SIHOceanDataset(nc_path=nc_path, split="val")
    test_ds  = SIHOceanDataset(nc_path=nc_path, split="test")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,  num_workers=num_workers)
    val_loader   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader  = DataLoader(test_ds,  batch_size=batch_size, shuffle=False, num_workers=num_workers)

    return train_loader, val_loader, test_loader