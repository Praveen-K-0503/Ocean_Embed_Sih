from pathlib import Path
import numpy as np
import xarray as xr

SURFACE_FILE = Path(
    "data/processed/aligned/ocean_aligned_1992-2021.nc"
)

TARGET_FILE = Path(
    "data/processed/aligned/cora_temp_nio_multidepth_1992-2021.nc"
)

OUTPUT_FILE = Path(
    "data/processed/regridded/"
    "cora_temp_nio_multidepth_surfacegrid_1992-2021.nc"
)


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    print("Opening datasets...", flush=True)

    with xr.open_dataset(SURFACE_FILE) as surface:
        surface_nio = surface.sel(
            lat=slice(5, 30),
            lon=slice(45, 105),
        )

        target_lat = surface_nio.lat.values.astype(np.float32)
        target_lon = surface_nio.lon.values.astype(np.float32)

    with xr.open_dataset(TARGET_FILE) as cora:
        print("Original CORA dimensions:", dict(cora.sizes), flush=True)

        print("Interpolating CORA -> surface grid...", flush=True)

        regridded = cora.interp(
            lat=target_lat,
            lon=target_lon,
            method="linear",
        )

        regridded["subsurface_temperature"] = (
            regridded["subsurface_temperature"].astype(np.float32)
        )

        regridded.attrs["regridding"] = (
            "CORA temperature linearly interpolated "
            "onto OceanEmbed surface-input grid"
        )

        print(
            "Regridded dimensions:",
            dict(regridded.sizes),
            flush=True,
        )

        print("Writing:", OUTPUT_FILE, flush=True)

        regridded.to_netcdf(
            OUTPUT_FILE,
            encoding={
                "subsurface_temperature": {
                    "dtype": "float32",
                    "zlib": True,
                    "complevel": 4,
                }
            },
        )

        regridded.close()

    print("DONE", flush=True)


if __name__ == "__main__":
    main()
