# SIH Final Data Directory

This directory contains the official Ministry of Earth Sciences (MoES) / INCOIS datasets for **SIH Problem Statement 26066**:

1. **`Final_Training_Dataset_2022_2024.nc`** (~4.69 GB):
   - 1,096 daily timesteps (2022-01-01 to 2024-12-31) at 0.25° resolution across the North Indian Ocean (5°N–30°N, 45°E–105°E).
   - Contains 7 surface satellite channels (`sst`, `sss`, `ssh`, `u`, `v`, `eastward_wind`, `northward_wind`) and target 3D potential temperature (`thetao`) at 15 standard depths.

2. **`ARGO_15depths_validation.nc`** (~70.1 MB):
   - Official INCOIS In-Situ ARGO validation dataset across 15 standard depth levels (0m to 1000m).

> **Note**: Due to GitHub's 100 MB single-file limit, `.nc` NetCDF binaries are excluded from Git via `.gitignore`. Place the raw NetCDF files in this folder when setting up the environment.
