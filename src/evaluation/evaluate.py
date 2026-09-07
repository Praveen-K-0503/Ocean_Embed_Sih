from pathlib import Path
import sys
import json

# pyrefly: ignore [missing-import]
import numpy as np

# pyrefly: ignore [missing-import]
import tensorflow as tf


ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from src.datasets.ocean_dataset import (
    load_dataset,
    make_windows,
)

from src.training.losses import masked_mse


MODEL_PATH = (
    ROOT
    / "checkpoints"
    / "best_convlstm.keras"
)

STATS_PATH = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "nio_normalization_stats.json"
)

OUTPUT_DIR = ROOT / "outputs" / "evaluation"
OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


def main():

    print("=" * 70)
    print("OceanEmbed — Test Evaluation")
    print("=" * 70)

    # --------------------------------------------------
    # Load model
    # --------------------------------------------------

    print("\nLoading model:")
    print(MODEL_PATH)

    model = tf.keras.models.load_model(
        MODEL_PATH,
        custom_objects={
            "masked_mse": masked_mse,
        },
    )

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

    print("\nTest shapes:")
    print("X:", X_test.shape)
    print("y:", y_test.shape)
    print("mask:", mask_test.shape)

    # --------------------------------------------------
    # Prediction
    # --------------------------------------------------

    print("\nGenerating predictions...")

    y_pred = model.predict(
        X_test,
        batch_size=2,
        verbose=1,
    )

    print("\nPrediction shape:")
    print(y_pred.shape)

    # --------------------------------------------------
    # Read normalization statistics
    # --------------------------------------------------

    with open(STATS_PATH, "r") as f:
        stats = json.load(f)

    target_mean = stats[
        "subsurface_temperature"
    ]["mean"]

    target_std = stats[
        "subsurface_temperature"
    ]["std"]

    print("\nTarget normalization:")
    print("mean:", target_mean)
    print("std :", target_std)

    # --------------------------------------------------
    # Convert normalized values back to Celsius
    # --------------------------------------------------

    y_test_c = (
        y_test * target_std
        + target_mean
    )

    y_pred_c = (
        y_pred * target_std
        + target_mean
    )

    # --------------------------------------------------
    # Ocean-only values
    # --------------------------------------------------

    valid = mask_test == 1

    actual = y_test_c[valid]
    predicted = y_pred_c[valid]

    # --------------------------------------------------
    # Metrics
    # --------------------------------------------------

    errors = predicted - actual

    mse = np.mean(
        errors ** 2
    )

    rmse = np.sqrt(mse)

    mae = np.mean(
        np.abs(errors)
    )

    bias = np.mean(
        errors
    )

    correlation = np.corrcoef(
        actual,
        predicted,
    )[0, 1]

    print("\n" + "=" * 70)
    print("TEST RESULTS — 2019-2021")
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
    # Save metrics
    # --------------------------------------------------

    metrics = {
        "test_period": "2019-2021",
        "rmse_celsius": float(rmse),
        "mae_celsius": float(mae),
        "bias_celsius": float(bias),
        "correlation": float(correlation),
        "valid_values": int(len(actual)),
    }

    metrics_path = (
        OUTPUT_DIR
        / "test_metrics.json"
    )

    with open(
        metrics_path,
        "w",
    ) as f:
        json.dump(
            metrics,
            f,
            indent=4,
        )

    # --------------------------------------------------
    # Save predictions
    # --------------------------------------------------

    predictions_path = (
        OUTPUT_DIR
        / "test_predictions.npz"
    )

    np.savez_compressed(
        predictions_path,
        predictions=y_pred_c.astype(
            "float32"
        ),
        targets=y_test_c.astype(
            "float32"
        ),
        masks=mask_test.astype(
            "float32"
        ),
        times=time_test,
    )

    print("\nSaved metrics:")
    print(metrics_path)

    print("\nSaved predictions:")
    print(predictions_path)

    print("\n" + "=" * 70)
    print("Evaluation completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()