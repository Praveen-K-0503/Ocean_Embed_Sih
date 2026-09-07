from pathlib import Path
import sys
import json

# pyrefly: ignore [missing-import]
import numpy as np



# ============================================================
# Project root
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ============================================================
# Project imports
# ============================================================

from src.datasets.ocean_dataset import (
    load_dataset,
    make_windows,
)

from src.models.convlstm_residual import (
    build_residual_convlstm,
)


# ============================================================
# Paths
# ============================================================

MODEL_PATH = (
    ROOT
    / "checkpoints"
    / "best_convlstm_v2.keras"
)

STATS_PATH = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "nio_normalization_stats.json"
)

OUTPUT_DIR = (
    ROOT
    / "outputs"
    / "evaluation"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

METRICS_PATH = (
    OUTPUT_DIR
    / "test_metrics_v2.json"
)

PREDICTIONS_PATH = (
    OUTPUT_DIR
    / "test_predictions_v2.npz"
)


# ============================================================
# Utilities
# ============================================================

def load_target_stats():
    """
    Load training-only normalization statistics
    for subsurface temperature.
    """

    with open(
        STATS_PATH,
        "r",
        encoding="utf-8",
    ) as f:
        stats = json.load(f)

    target_stats = stats[
        "subsurface_temperature"
    ]

    mean = float(
        target_stats["mean"]
    )

    std = float(
        target_stats["std"]
    )

    return mean, std


def denormalize(
    values,
    mean,
    std,
):
    """
    Convert normalized values back to degrees Celsius.
    """

    return (
        values * std
        + mean
    )


def calculate_metrics(
    targets,
    predictions,
    masks,
):
    """
    Calculate metrics only over valid ocean pixels.
    """

    valid = masks > 0.5

    y_true = targets[valid]
    y_pred = predictions[valid]

    if y_true.size == 0:
        raise ValueError(
            "No valid ocean pixels found in test mask."
        )

    error = (
        y_pred
        - y_true
    )

    rmse = float(
        np.sqrt(
            np.mean(
                np.square(error)
            )
        )
    )

    mae = float(
        np.mean(
            np.abs(error)
        )
    )

    bias = float(
        np.mean(error)
    )

    if (
        np.std(y_true) > 0
        and np.std(y_pred) > 0
    ):
        correlation = float(
            np.corrcoef(
                y_true,
                y_pred,
            )[0, 1]
        )

    else:
        correlation = float("nan")

    return {
        "rmse_celsius": rmse,
        "mae_celsius": mae,
        "bias_celsius": bias,
        "correlation": correlation,
        "valid_values": int(
            valid.sum()
        ),
    }


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 70)
    print(
        "OceanEmbed — Residual ConvLSTM V2 Evaluation"
    )
    print("=" * 70)

    # --------------------------------------------------------
    # Check required files
    # --------------------------------------------------------

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"V2 checkpoint not found:\n{MODEL_PATH}"
        )

    if not STATS_PATH.exists():
        raise FileNotFoundError(
            f"Normalization statistics not found:\n{STATS_PATH}"
        )

    # --------------------------------------------------------
    # Load test dataset
    # --------------------------------------------------------

    print("\nLoading dataset...")

    ds = load_dataset()

    (
        X_test,
        y_test,
        mask_test,
        test_times,
    ) = make_windows(
        ds,
        201901,
        202112,
    )

    ds.close()

    X_test = np.asarray(
        X_test,
        dtype=np.float32,
    )

    y_test = np.asarray(
        y_test,
        dtype=np.float32,
    )

    mask_test = np.asarray(
        mask_test,
        dtype=np.float32,
    )

    print("\nTest shapes:")

    print(
        "X_test   :",
        X_test.shape,
    )

    print(
        "y_test   :",
        y_test.shape,
    )

    print(
        "mask_test:",
        mask_test.shape,
    )

    print("\nTest period:")

    print(
        test_times[0],
        "to",
        test_times[-1],
    )

    # --------------------------------------------------------
    # Sanity checks
    # --------------------------------------------------------

    if np.isnan(X_test).any():
        raise ValueError(
            "NaN values detected in X_test."
        )

    if np.isnan(y_test).any():
        raise ValueError(
            "NaN values detected in y_test."
        )

    # --------------------------------------------------------
    # Rebuild architecture
    # --------------------------------------------------------

    print("\nRebuilding Residual ConvLSTM V2 architecture...")

    model = build_residual_convlstm()

    print(
        "Architecture rebuilt successfully."
    )

    # --------------------------------------------------------
    # Load trained checkpoint weights
    # --------------------------------------------------------

    print("\nLoading trained V2 weights from:")

    print(MODEL_PATH)

    model.load_weights(
        MODEL_PATH
    )

    print(
        "V2 weights loaded successfully."
    )

    # --------------------------------------------------------
    # Predictions
    # --------------------------------------------------------

    print("\nRunning predictions...")

    predictions_norm = model.predict(
        X_test,
        batch_size=2,
        verbose=1,
    )

    predictions_norm = np.asarray(
        predictions_norm,
        dtype=np.float32,
    )

    print(
        "\nPrediction shape:",
        predictions_norm.shape,
    )

    if (
        predictions_norm.shape
        != y_test.shape
    ):
        raise ValueError(
            "Prediction and target shapes do not match: "
            f"{predictions_norm.shape} "
            f"vs "
            f"{y_test.shape}"
        )

    if np.isnan(predictions_norm).any():
        raise ValueError(
            "NaN values detected in model predictions."
        )

    # --------------------------------------------------------
    # Denormalization
    # --------------------------------------------------------

    target_mean, target_std = (
        load_target_stats()
    )

    print(
        "\nTarget normalization stats:"
    )

    print(
        "Mean:",
        target_mean,
    )

    print(
        "Std :",
        target_std,
    )

    predictions_celsius = denormalize(
        predictions_norm,
        target_mean,
        target_std,
    )

    targets_celsius = denormalize(
        y_test,
        target_mean,
        target_std,
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    metrics = calculate_metrics(
        targets_celsius,
        predictions_celsius,
        mask_test,
    )

    metrics["model"] = (
        "Residual ConvLSTM V2"
    )

    metrics["test_period"] = (
        "2019-2021"
    )

    # --------------------------------------------------------
    # Print results
    # --------------------------------------------------------

    print(
        "\n"
        + "=" * 70
    )

    print(
        "V2 TEST RESULTS"
    )

    print(
        "=" * 70
    )

    print(
        f"RMSE        : "
        f"{metrics['rmse_celsius']:.4f} °C"
    )

    print(
        f"MAE         : "
        f"{metrics['mae_celsius']:.4f} °C"
    )

    print(
        f"Bias        : "
        f"{metrics['bias_celsius']:.4f} °C"
    )

    print(
        f"Correlation : "
        f"{metrics['correlation']:.4f}"
    )

    print(
        f"Valid values: "
        f"{metrics['valid_values']:,}"
    )

    # --------------------------------------------------------
    # Save metrics
    # --------------------------------------------------------

    with open(
        METRICS_PATH,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            metrics,
            f,
            indent=2,
        )

    # --------------------------------------------------------
    # Save predictions
    # --------------------------------------------------------

    np.savez_compressed(
        PREDICTIONS_PATH,
        predictions=predictions_celsius.astype(
            np.float32
        ),
        targets=targets_celsius.astype(
            np.float32
        ),
        masks=mask_test.astype(
            np.float32
        ),
        times=np.asarray(
            test_times
        ),
    )

    print("\nSaved metrics:")

    print(
        METRICS_PATH
    )

    print("\nSaved predictions:")

    print(
        PREDICTIONS_PATH
    )

    print(
        "\n"
        + "=" * 70
    )

    print(
        "V2 evaluation completed."
    )

    print(
        "=" * 70
    )


if __name__ == "__main__":
    main()