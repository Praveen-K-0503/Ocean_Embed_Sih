from pathlib import Path
import sys
import json

# pyrefly: ignore [missing-import]
import numpy as np



ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from src.datasets.ocean_dataset import (
    load_dataset,
    make_windows,
)


STATS_PATH = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "nio_normalization_stats.json"
)


def main():

    print("=" * 70)
    print("OceanEmbed — SST Baseline Evaluation")
    print("=" * 70)

    # --------------------------------------------------
    # Load test data
    # --------------------------------------------------

    ds = load_dataset()

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

    ds.close()

    # --------------------------------------------------
    # Load normalization statistics
    # --------------------------------------------------

    with open(STATS_PATH, "r") as f:
        stats = json.load(f)

    sst_mean = stats["sst"]["mean"]
    sst_std = stats["sst"]["std"]

    target_mean = stats[
        "subsurface_temperature"
    ]["mean"]

    target_std = stats[
        "subsurface_temperature"
    ]["std"]

    # --------------------------------------------------
    # Baseline prediction
    #
    # Last month SST is channel 0.
    # Use SST directly as estimate of 3 m temperature.
    # --------------------------------------------------

    sst_normalized = X_test[
        :,
        -1,
        :,
        :,
        0,
    ]

    sst_celsius = (
        sst_normalized * sst_std
        + sst_mean
    )

    target_celsius = (
        y_test * target_std
        + target_mean
    )

    # --------------------------------------------------
    # Ocean-only evaluation
    # --------------------------------------------------

    valid = mask_test == 1

    actual = target_celsius[valid]
    predicted = sst_celsius[valid]

    errors = predicted - actual

    rmse = np.sqrt(
        np.mean(errors ** 2)
    )

    mae = np.mean(
        np.abs(errors)
    )

    bias = np.mean(errors)

    correlation = np.corrcoef(
        actual,
        predicted,
    )[0, 1]

    print("\n" + "=" * 70)
    print("SST BASELINE — TEST 2019-2021")
    print("=" * 70)

    print(
        f"Valid values : {len(actual):,}"
    )

    print(
        f"RMSE         : {rmse:.4f} °C"
    )

    print(
        f"MAE          : {mae:.4f} °C"
    )

    print(
        f"Bias         : {bias:.4f} °C"
    )

    print(
        f"Correlation  : {correlation:.4f}"
    )

    # --------------------------------------------------
    # ConvLSTM reference
    # --------------------------------------------------

    convlstm_rmse = 0.3870709240436554
    convlstm_mae = 0.29407572746276855

    rmse_improvement = (
        (rmse - convlstm_rmse)
        / rmse
        * 100
    )

    mae_improvement = (
        (mae - convlstm_mae)
        / mae
        * 100
    )

    print("\n" + "=" * 70)
    print("ConvLSTM vs SST BASELINE")
    print("=" * 70)

    print(
        f"RMSE improvement: "
        f"{rmse_improvement:.2f}%"
    )

    print(
        f"MAE improvement : "
        f"{mae_improvement:.2f}%"
    )


if __name__ == "__main__":
    main()