from pathlib import Path
# pyrefly: ignore [missing-import]
import json

# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import xarray as xr


ROOT = Path(__file__).resolve().parents[2]

INPUT = (
    ROOT
    / "data"
    / "processed"
    / "aligned"
    / "ocean_aligned_1992-2021.nc"
)

MASK_PATH = (
    ROOT
    / "data"
    / "processed"
    / "masks"
    / "nio_valid_ocean_mask.nc"
)

OUTPUT_DIR = ROOT / "data" / "processed" / "normalized"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT = OUTPUT_DIR / "nio_normalized_trainstats_1992-2021.nc"
STATS_OUTPUT = OUTPUT_DIR / "nio_normalization_stats.json"


VARIABLES = [
    "sst",
    "ssh",
    "u_wind",
    "v_wind",
    "subsurface_temperature",
]


def main():

    print("=" * 70)
    print("OceanEmbed — Train-only NIO Normalization")
    print("=" * 70)

    print("\nReading aligned dataset:")
    print(INPUT)

    ds = xr.open_dataset(INPUT)

    # --------------------------------------------------
    # Crop North Indian Ocean
    # --------------------------------------------------

    nio = ds.sel(
        lat=slice(5.0, 30.0),
        lon=slice(45.0, 105.0),
    )

    print("\nNIO dimensions:")
    print(dict(nio.sizes))

    # --------------------------------------------------
    # Apply ocean mask
    # --------------------------------------------------

    mask_ds = xr.open_dataset(MASK_PATH)
    mask = mask_ds["valid_ocean_mask"]

    nio = nio.where(mask == 1)

    # --------------------------------------------------
    # Chronological split
    # Training statistics ONLY from 1992-2015
    # --------------------------------------------------

    train = nio.where(
        nio["time"] <= 201512,
        drop=True,
    )

    val = nio.where(
        (nio["time"] >= 201601)
        & (nio["time"] <= 201812),
        drop=True,
    )

    test = nio.where(
        nio["time"] >= 201901,
        drop=True,
    )

    print("\nSplit sizes:")
    print("Train      :", train.sizes["time"])
    print("Validation :", val.sizes["time"])
    print("Test       :", test.sizes["time"])

    # --------------------------------------------------
    # Normalize using TRAIN statistics only
    # --------------------------------------------------

    normalized = xr.Dataset(
        coords={
            "time": nio["time"],
            "lat": nio["lat"],
            "lon": nio["lon"],
        }
    )

    stats = {}

    for variable in VARIABLES:

        print(f"\nProcessing {variable}...")

        train_var = train[variable]

        mean = float(
            train_var.mean(
                skipna=True
            ).values
        )

        std = float(
            train_var.std(
                skipna=True
            ).values
        )

        if not np.isfinite(mean):
            raise ValueError(
                f"Invalid mean for {variable}: {mean}"
            )

        if not np.isfinite(std) or std == 0:
            raise ValueError(
                f"Invalid std for {variable}: {std}"
            )

        print("  train mean:", mean)
        print("  train std :", std)

        normalized[variable] = (
            (nio[variable] - mean) / std
        ).astype("float32")

        stats[variable] = {
            "mean": mean,
            "std": std,
        }

    # --------------------------------------------------
    # Metadata
    # --------------------------------------------------

    normalized.attrs["normalization"] = (
        "z-score using training period statistics only"
    )

    normalized.attrs["train_period"] = "199201-201512"
    normalized.attrs["validation_period"] = "201601-201812"
    normalized.attrs["test_period"] = "201901-202112"

    # --------------------------------------------------
    # Save normalization statistics
    # --------------------------------------------------

    with open(STATS_OUTPUT, "w") as f:
        json.dump(
            stats,
            f,
            indent=4,
        )

    # --------------------------------------------------
    # Save normalized dataset
    # --------------------------------------------------

    encoding = {
        variable: {
            "zlib": True,
            "complevel": 4,
            "dtype": "float32",
        }
        for variable in VARIABLES
    }

    print("\nWriting normalized NIO dataset:")
    print(OUTPUT)

    normalized.to_netcdf(
        OUTPUT,
        engine="netcdf4",
        encoding=encoding,
    )

    print("\nWriting normalization statistics:")
    print(STATS_OUTPUT)

    ds.close()
    mask_ds.close()

    print("\n" + "=" * 70)
    print("Train-only normalization completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()