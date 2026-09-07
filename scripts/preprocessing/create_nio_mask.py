from pathlib import Path

# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr


ROOT = Path(__file__).resolve().parents[2]

INPUT = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "ocean_normalized_1992-2021.nc"
)

MASK_DIR = ROOT / "data" / "processed" / "masks"
ALIGNED_DIR = ROOT / "data" / "processed" / "aligned"

MASK_DIR.mkdir(parents=True, exist_ok=True)
ALIGNED_DIR.mkdir(parents=True, exist_ok=True)

MASK_OUTPUT = MASK_DIR / "nio_valid_ocean_mask.nc"
CROP_OUTPUT = ALIGNED_DIR / "nio_normalized_1992-2021.nc"


def main():

    print("=" * 70)
    print("OceanEmbed — North Indian Ocean Crop + Mask")
    print("=" * 70)

    ds = xr.open_dataset(INPUT)

    # --------------------------------------------------------
    # PS geographical domain
    # 5°N–30°N, 45°E–105°E
    # --------------------------------------------------------

    nio = ds.sel(
        lat=slice(5.0, 30.0),
        lon=slice(45.0, 105.0),
    )

    print("\nNIO dimensions:")
    print(dict(nio.sizes))

    # --------------------------------------------------------
    # Valid ocean mask
    #
    # A pixel is valid when surface predictors and target
    # contain at least one finite observation through time.
    # --------------------------------------------------------

    required = [
        "sst",
        "ssh",
        "subsurface_temperature",
    ]

    valid_mask = None

    for variable in required:

        variable_valid = np.isfinite(nio[variable]).any(dim="time")

        if valid_mask is None:
            valid_mask = variable_valid
        else:
            valid_mask = valid_mask & variable_valid

    valid_mask = valid_mask.rename("valid_ocean_mask")
    valid_mask = valid_mask.astype("int8")

    total_pixels = valid_mask.size
    valid_pixels = int(valid_mask.sum().values)

    print("\nMask statistics:")
    print("Total pixels :", total_pixels)
    print("Valid ocean :", valid_pixels)
    print(
        "Valid %      :",
        round((valid_pixels / total_pixels) * 100, 2),
    )

    # --------------------------------------------------------
    # Apply mask
    # --------------------------------------------------------

    nio_masked = nio.where(valid_mask == 1)

    # Wind exists over land too.
    # Masking prevents land winds entering training.
    nio_masked["u_wind"] = nio["u_wind"].where(valid_mask == 1)
    nio_masked["v_wind"] = nio["v_wind"].where(valid_mask == 1)

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    print("\nSaving mask:")
    print(MASK_OUTPUT)

    valid_mask.to_dataset().to_netcdf(
        MASK_OUTPUT,
        engine="netcdf4",
    )

    print("\nSaving NIO dataset:")
    print(CROP_OUTPUT)

    nio_masked.to_netcdf(
        CROP_OUTPUT,
        engine="netcdf4",
    )

    ds.close()
    nio.close()
    nio_masked.close()

    print("\n" + "=" * 70)
    print("NIO crop + ocean mask completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()