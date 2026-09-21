import h5py
import numpy as np
from pathlib import Path

# Create directories if not exist
data_dir = Path("SIH_Final_Data")
data_dir.mkdir(exist_ok=True)

print("Creating dummy Final_Training_Dataset_2022_2024.nc...")
with h5py.File(data_dir / "Final_Training_Dataset_2022_2024.nc", "w") as f:
    # Generate 11 daily timestamps starting from 2024-06-01
    start_ts = 1717200000.0 # 2024-06-01
    num_days = 11
    timestamps = [start_ts + i * 86400.0 for i in range(num_days)]
    f.create_dataset("time", data=np.array(timestamps))
    
    # Shapes
    shape_2d = (num_days, 101, 241)
    shape_3d = (num_days, 15, 101, 241)
    
    # We add some spatial variance for visual appeal in the frontend
    lat_grad = np.linspace(25, 30, 101)[:, None]
    lon_grad = np.linspace(-2, 2, 241)[None, :]
    dummy_sst = (lat_grad + lon_grad).astype(np.float32)
    # Broadcast across num_days
    dummy_sst_batch = np.repeat(dummy_sst[None, :, :], num_days, axis=0)
    
    # Add slight day-to-day variation
    for i in range(num_days):
        dummy_sst_batch[i] += i * 0.1
    
    f.create_dataset("sst", data=dummy_sst_batch)
    f.create_dataset("sss", data=np.full(shape_2d, 35.0, dtype=np.float32))
    f.create_dataset("ssh", data=np.full(shape_2d, 0.1, dtype=np.float32))
    f.create_dataset("u", data=np.full(shape_2d, 0.05, dtype=np.float32))
    f.create_dataset("v", data=np.full(shape_2d, 0.02, dtype=np.float32))
    f.create_dataset("eastward_wind", data=np.full(shape_2d, 3.0, dtype=np.float32))
    f.create_dataset("northward_wind", data=np.full(shape_2d, -1.0, dtype=np.float32))
    
    dummy_thetao = np.full(shape_3d, 20.0, dtype=np.float32)
    for i in range(15):
        dummy_thetao[:, i, :, :] = 28 - i * 1.5 # temperature decreases with depth
    f.create_dataset("thetao", data=dummy_thetao)

print("Creating dummy ARGO_15depths_validation.nc...")
with h5py.File(data_dir / "ARGO_15depths_validation.nc", "w") as f:
    # Argo script expects t_idx = 5, so we need at least 6 timesteps
    shape_argo = (6, 15, 101, 241)
    dummy_argo = np.full(shape_argo, 20.0, dtype=np.float32)
    for i in range(15):
        dummy_argo[:, i, :, :] = 28 - i * 1.5
    f.create_dataset("temperature", data=dummy_argo)

print("Dummy data files created successfully!")
