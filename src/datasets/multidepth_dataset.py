from pathlib import Path
import numpy as np
import xarray as xr

DATA_FILE = Path(
    "data/processed/normalized/"
    "nio_multidepth_normalized_trainstats_1992-2021.nc"
)

INPUT_VARS = ["sst", "ssh", "u_wind", "v_wind"]

SEQUENCE_LENGTH = 6

SPLITS = {
    "train": (0, 288),
    "val": (288, 324),
    "test": (324, 360),
}


def load_multidepth_data(split="train"):
    if split not in SPLITS:
        raise ValueError(
            f"split must be one of {list(SPLITS)}"
        )

    print(f"Loading {split} data...", flush=True)

    with xr.open_dataset(DATA_FILE) as ds:
        inputs = np.stack(
            [ds[v].values for v in INPUT_VARS],
            axis=-1,
        ).astype(np.float32)

        target = ds[
            "subsurface_temperature"
        ].values.astype(np.float32)

        # (time, depth, lat, lon)
        # -> (time, lat, lon, depth)
        target = np.transpose(
            target,
            (0, 2, 3, 1),
        )

        mask = ds["valid_mask"].values.astype(np.float32)

        # (depth, lat, lon)
        # -> (lat, lon, depth)
        mask = np.transpose(
            mask,
            (1, 2, 0),
        )

        times = ds.time.values
        depths = ds.depth.values.astype(np.float32)

    start, end = SPLITS[split]

    X = []
    y = []
    masks = []
    target_times = []

    # Validation/test may use preceding months as input context.
    first_target = max(start, SEQUENCE_LENGTH - 1)

    for t in range(first_target, end):
        seq_start = t - SEQUENCE_LENGTH + 1

        x_seq = inputs[seq_start:t + 1].copy()
        y_t = target[t].copy()

        # Dynamic finite mask + static depth mask.
        finite_target = np.isfinite(y_t)
        valid = finite_target & (mask > 0)

        # Missing normalized inputs are filled with zero,
        # corresponding approximately to training mean.
        x_seq = np.nan_to_num(
            x_seq,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        y_t = np.nan_to_num(
            y_t,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        X.append(x_seq)
        y.append(y_t)
        masks.append(valid.astype(np.float32))
        target_times.append(times[t])

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.float32)
    masks = np.asarray(masks, dtype=np.float32)
    target_times = np.asarray(target_times)

    print("X:", X.shape, flush=True)
    print("y:", y.shape, flush=True)
    print("mask:", masks.shape, flush=True)
    print("targets:", len(target_times), flush=True)

    return X, y, masks, target_times, depths


if __name__ == "__main__":
    for split in ["train", "val", "test"]:
        print(f"\n--- {split.upper()} ---")
        load_multidepth_data(split)
