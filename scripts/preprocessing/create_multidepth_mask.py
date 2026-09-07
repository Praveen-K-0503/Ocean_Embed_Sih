from pathlib import Path
import numpy as np
import xarray as xr

INPUT = Path(
    "data/processed/regridded/"
    "cora_temp_nio_multidepth_surfacegrid_1992-2021.nc"
)

OUTPUT = Path(
    "data/processed/masks/nio_multidepth_valid_mask.nc"
)

TRAIN_END = "2015-12-31"


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    print("Opening multi-depth target...", flush=True)

    with xr.open_dataset(INPUT) as ds:
        temp = ds["subsurface_temperature"]

        train = temp.sel(time=slice(None, TRAIN_END))

        print("Training months:", train.sizes["time"], flush=True)

        # Pixel is valid when at least one finite observation
        # exists during the training period.
        mask = np.isfinite(train).any(dim="time")

        mask = mask.astype(np.int8)
        mask.name = "valid_mask"

        result = mask.to_dataset()

        result.attrs["description"] = (
            "Depth-specific valid-ocean mask derived "
            "from CORA training period 1992-2015"
        )

        print("Mask dimensions:", dict(result.sizes), flush=True)

        print("\nDEPTH-WISE MASK COVERAGE")

        for depth in result.depth.values:
            m = result["valid_mask"].sel(depth=depth)
            valid = int(m.sum().item())
            total = m.size
            pct = 100.0 * valid / total

            print(
                f"{float(depth):7.0f} m : "
                f"{valid:4d}/{total} = {pct:6.2f}%"
            )

        result.to_netcdf(
            OUTPUT,
            encoding={
                "valid_mask": {
                    "dtype": "int8",
                    "zlib": True,
                    "complevel": 4,
                }
            },
        )

    print("\nSaved:", OUTPUT, flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
