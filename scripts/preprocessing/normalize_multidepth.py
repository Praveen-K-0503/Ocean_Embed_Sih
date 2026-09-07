from pathlib import Path
import json

import numpy as np
import xarray as xr

SURFACE_FILE = Path(
    "data/processed/aligned/ocean_aligned_1992-2021.nc"
)

TARGET_FILE = Path(
    "data/processed/regridded/"
    "cora_temp_nio_multidepth_surfacegrid_1992-2021.nc"
)

MASK_FILE = Path(
    "data/processed/masks/nio_multidepth_valid_mask.nc"
)

OUTPUT_FILE = Path(
    "data/processed/normalized/"
    "nio_multidepth_normalized_trainstats_1992-2021.nc"
)

STATS_FILE = Path(
    "data/processed/normalized/"
    "nio_multidepth_normalization_stats.json"
)

TRAIN_MONTHS = 288

INPUT_VARS = ["sst", "ssh", "u_wind", "v_wind"]


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    print("Opening datasets...", flush=True)

    surface = xr.open_dataset(SURFACE_FILE)
    target = xr.open_dataset(TARGET_FILE)
    mask_ds = xr.open_dataset(MASK_FILE)

    surface = surface.sel(
        lat=slice(5, 30),
        lon=slice(45, 105)
    )

    if surface.sizes["time"] != 360:
        raise RuntimeError("Surface dataset must contain 360 months.")

    if target.sizes["time"] != 360:
        raise RuntimeError("Target dataset must contain 360 months.")

    if target.sizes["depth"] != 19:
        raise RuntimeError("Expected 19 target depths.")

    # Use CORA datetime coordinate for the final combined dataset.
    surface = surface.assign_coords(time=target.time.values)

    print("Surface dimensions:", dict(surface.sizes), flush=True)
    print("Target dimensions :", dict(target.sizes), flush=True)

    stats = {
        "train_months": TRAIN_MONTHS,
        "train_period": "1992-2015",
        "inputs": {},
        "target_by_depth": {},
    }

    output = xr.Dataset(
        coords={
            "time": target.time,
            "lat": target.lat,
            "lon": target.lon,
            "depth": target.depth,
        }
    )

    print("\nINPUT NORMALIZATION", flush=True)

    for var in INPUT_VARS:
        data = surface[var].astype(np.float32)
        train = data.isel(time=slice(0, TRAIN_MONTHS))

        values = train.values
        finite = np.isfinite(values)

        mean = float(values[finite].mean())
        std = float(values[finite].std())

        if std <= 0:
            raise RuntimeError(f"Invalid std for {var}: {std}")

        output[var] = ((data - mean) / std).astype(np.float32)

        stats["inputs"][var] = {
            "mean": mean,
            "std": std,
        }

        print(
            f"{var:8s} mean={mean:.6f} std={std:.6f}",
            flush=True,
        )

    print("\nTARGET NORMALIZATION BY DEPTH", flush=True)

    temp = target["subsurface_temperature"].astype(np.float32)
    valid_mask = mask_ds["valid_mask"].astype(bool)

    normalized_depths = []

    for depth in target.depth.values:
        d = float(depth)

        data_d = temp.sel(depth=depth)
        mask_d = valid_mask.sel(depth=depth)

        train_d = data_d.isel(time=slice(0, TRAIN_MONTHS))

        values = train_d.where(mask_d).values
        finite = np.isfinite(values)

        mean = float(values[finite].mean())
        std = float(values[finite].std())

        if std <= 0:
            raise RuntimeError(
                f"Invalid target std at depth {d}: {std}"
            )

        norm_d = ((data_d - mean) / std).astype(np.float32)
        normalized_depths.append(norm_d)

        stats["target_by_depth"][str(int(d))] = {
            "mean": mean,
            "std": std,
        }

        print(
            f"{d:7.0f} m  mean={mean:8.4f}  std={std:7.4f}",
            flush=True,
        )

    normalized_target = xr.concat(
        normalized_depths,
        dim=target.depth,
    ).transpose("time", "depth", "lat", "lon")

    output["subsurface_temperature"] = normalized_target
    output["valid_mask"] = valid_mask.astype(np.int8)

    output.attrs["description"] = (
        "OceanEmbed NIO multi-depth training dataset; "
        "normalization statistics derived from 1992-2015 only"
    )

    print("\nWriting normalized dataset...", flush=True)

    output.to_netcdf(
        OUTPUT_FILE,
        encoding={
            "sst": {"dtype": "float32", "zlib": True},
            "ssh": {"dtype": "float32", "zlib": True},
            "u_wind": {"dtype": "float32", "zlib": True},
            "v_wind": {"dtype": "float32", "zlib": True},
            "subsurface_temperature": {
                "dtype": "float32",
                "zlib": True,
                "complevel": 4,
            },
            "valid_mask": {
                "dtype": "int8",
                "zlib": True,
            },
        },
    )

    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2)

    surface.close()
    target.close()
    mask_ds.close()
    output.close()

    print("Saved:", OUTPUT_FILE, flush=True)
    print("Stats:", STATS_FILE, flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
