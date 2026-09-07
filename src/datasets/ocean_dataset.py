from pathlib import Path

# pyrefly: ignore [missing-import]
import numpy as np

# pyrefly: ignore [missing-import]
import xarray as xr


ROOT = Path(__file__).resolve().parents[2]

DATA_PATH = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "nio_normalized_trainstats_1992-2021.nc"
)

INPUT_VARIABLES = [
    "sst",
    "ssh",
    "u_wind",
    "v_wind",
]

TARGET_VARIABLE = "subsurface_temperature"

SEQUENCE_LENGTH = 6


def load_dataset():

    print("=" * 70)
    print("OceanEmbed — Training Dataset Builder")
    print("=" * 70)

    print("\nReading:")
    print(DATA_PATH)

    ds = xr.open_dataset(DATA_PATH)

    print("\nDimensions:")
    print(dict(ds.sizes))

    return ds


def make_windows(
    ds,
    target_start,
    target_end,
):

    times = ds["time"].values

    x_list = []
    y_list = []
    mask_list = []
    target_times = []

    for target_idx in range(
        SEQUENCE_LENGTH - 1,
        len(times),
    ):

        target_time = int(times[target_idx])

        # Only keep targets belonging to this split
        if not (
            target_start
            <= target_time
            <= target_end
        ):
            continue

        start_idx = (
            target_idx
            - SEQUENCE_LENGTH
            + 1
        )

        # ---------------------------------------------
        # Input sequence
        # ---------------------------------------------

        window = ds[
            INPUT_VARIABLES
        ].isel(
            time=slice(
                start_idx,
                target_idx + 1,
            )
        )

        # Original:
        # channels, time, lat, lon
        x = window.to_array().values

        # Desired:
        # time, lat, lon, channels
        x = np.transpose(
            x,
            (1, 2, 3, 0),
        ).astype("float32")

        # Neural networks cannot consume NaNs.
        # In normalized space zero corresponds
        # approximately to the training mean.
        x = np.nan_to_num(
            x,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        # ---------------------------------------------
        # Target
        # ---------------------------------------------

        y_raw = ds[
            TARGET_VARIABLE
        ].isel(
            time=target_idx
        ).values.astype("float32")

        # 1 = valid target ocean pixel
        # 0 = invalid / land / missing
        target_mask = np.isfinite(
            y_raw
        ).astype("float32")

        # Placeholder zero where target is invalid.
        # Masked loss will ignore these pixels.
        y = np.nan_to_num(
            y_raw,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )

        x_list.append(x)
        y_list.append(y)
        mask_list.append(target_mask)
        target_times.append(target_time)

    X = np.stack(
        x_list
    ).astype("float32")

    y = np.stack(
        y_list
    ).astype("float32")

    masks = np.stack(
        mask_list
    ).astype("float32")

    target_times = np.asarray(
        target_times
    )

    return (
        X,
        y,
        masks,
        target_times,
    )


def print_split(
    name,
    X,
    y,
    masks,
    times,
):

    print(f"\n{name}:")
    print("X     :", X.shape)
    print("y     :", y.shape)
    print("mask  :", masks.shape)

    print(
        "time  :",
        times[0],
        "→",
        times[-1],
    )

    print(
        "X NaNs:",
        int(np.isnan(X).sum()),
    )

    print(
        "y NaNs:",
        int(np.isnan(y).sum()),
    )

    print(
        "Valid target pixels:",
        int(masks.sum()),
    )

    print(
        "Mask coverage:",
        round(
            float(masks.mean()) * 100,
            2,
        ),
        "%",
    )


def main():

    ds = load_dataset()

    print("\nBuilding TRAIN split...")

    (
        X_train,
        y_train,
        mask_train,
        time_train,
    ) = make_windows(
        ds,
        199201,
        201512,
    )

    print("\nBuilding VALIDATION split...")

    (
        X_val,
        y_val,
        mask_val,
        time_val,
    ) = make_windows(
        ds,
        201601,
        201812,
    )

    print("\nBuilding TEST split...")

    (
        X_test,
        y_test,
        mask_test,
        time_test,
    ) = make_windows(
        ds,
        201901,
        202112,
    )

    print("\n" + "=" * 70)
    print("FINAL MODEL-READY SHAPES")
    print("=" * 70)

    print_split(
        "TRAIN",
        X_train,
        y_train,
        mask_train,
        time_train,
    )

    print_split(
        "VALIDATION",
        X_val,
        y_val,
        mask_val,
        time_val,
    )

    print_split(
        "TEST",
        X_test,
        y_test,
        mask_test,
        time_test,
    )

    ds.close()

    print("\n" + "=" * 70)
    print("Dataset preparation successful.")
    print("=" * 70)


if __name__ == "__main__":
    main()