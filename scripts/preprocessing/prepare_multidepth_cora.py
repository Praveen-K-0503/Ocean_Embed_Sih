from pathlib import Path
# pyrefly: ignore [missing-import]
import numpy as np

# pyrefly: ignore [missing-import]
import xarray as xr

RAW = Path("data/raw/CORA")
OUT = Path("data/processed/aligned/cora_temp_nio_multidepth_1992-2021.nc")

DEPTHS = [
    1, 3, 5, 10, 20, 30, 50, 75,
    100, 150, 200, 300, 400, 500,
    600, 700, 800, 900, 1000
]

def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)

    files = sorted(RAW.glob("cora_temp_nio_*_1-1000m.nc"))
    print("Files found:", len(files), flush=True)

    if len(files) != 30:
        raise RuntimeError(f"Expected 30 files, found {len(files)}")

    parts = []

    for i, f in enumerate(files, 1):
        print(f"[{i:02d}/30] {f.name}", flush=True)

        with xr.open_dataset(f) as ds:
            part = ds["TEMP"].sel(depth=DEPTHS).load()
            parts.append(part)

    print("Combining...", flush=True)

    temp = xr.concat(parts, dim="time").sortby("time")

    temp = temp.rename({
        "latitude": "lat",
        "longitude": "lon"
    }).astype(np.float32)

    result = temp.to_dataset(
        name="subsurface_temperature"
    )

    result.attrs["source"] = "Copernicus Marine CORA"
    result.attrs["period"] = "1992-2021"

    print("Dimensions:", dict(result.sizes), flush=True)
    print("Depths:", result.depth.values, flush=True)

    result.to_netcdf(
        OUT,
        encoding={
            "subsurface_temperature": {
                "dtype": "float32",
                "zlib": True,
                "complevel": 4
            }
        }
    )

    result.close()

    print("Saved:", OUT, flush=True)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
