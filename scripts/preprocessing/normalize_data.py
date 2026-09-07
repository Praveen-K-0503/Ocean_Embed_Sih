

from pathlib import Path
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr

ROOT = Path(__file__).resolve().parents[2]

INPUT = ROOT / "data" / "processed" / "aligned" / "ocean_aligned_1992-2021.nc"
OUTPUT_DIR = ROOT / "data" / "processed" / "normalized"
OUTPUT = OUTPUT_DIR / "ocean_normalized_1992-2021.nc"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 70)
print("OceanEmbed normalization")
print("=" * 70)

print(f"Reading: {INPUT}")

ds = xr.open_dataset(INPUT)

print("Variables:", list(ds.data_vars))

normalized = {}

for name, da in ds.data_vars.items():
    print(f"\nProcessing {name}...")

    mean = da.mean(dim=("time", "lat", "lon"), skipna=True)
    std = da.std(dim=("time", "lat", "lon"), skipna=True)

    print("  mean:", float(mean.values))
    print("  std :", float(std.values))

    normalized[name] = (da - mean) / (std + 1e-8)

out = xr.Dataset(normalized, coords=ds.coords)

print("\nWriting:")
print(OUTPUT)

out.to_netcdf(OUTPUT)

ds.close()
out.close()

print("\nNormalization completed successfully.")
print(f"Output: {OUTPUT}")
