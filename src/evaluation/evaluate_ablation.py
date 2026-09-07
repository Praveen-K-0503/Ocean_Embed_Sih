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


# ============================================================
# Experiment configuration
# ============================================================

EXPERIMENTS = {
    "sst": {
        "channels": 1,
        "checkpoint": "best_ablation_sst_only.keras",
        "label": "SST only",
    },

    "sst_ssh": {
        "channels": 2,
        "checkpoint": "best_ablation_sst_ssh.keras",
        "label": "SST + SSH",
    },

    "full": {
        "channels": 4,
        "checkpoint": "best_ablation_full_4channel.keras",
        "label": "SST + SSH + Wind",
    },
}


CHECKPOINT_DIR = (
    ROOT
    / "checkpoints"
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

RESULT_PATH = (
    OUTPUT_DIR
    / "ablation_results.json"
)


# ============================================================
# Utilities
# ============================================================

def load_target_stats():

    with open(
        STATS_PATH,
        "r",
        encoding="utf-8",
    ) as f:
        stats = json.load(f)

    target = stats[
        "subsurface_temperature"
    ]

    return (
        float(target["mean"]),
        float(target["std"]),
    )


def denormalize(
    values,
    mean,
    std,
):

    return (
        values * std
        + mean
    )


def calculate_metrics(
    targets,
    predictions,
    masks,
):

    valid = masks > 0.5

    y_true = targets[valid]
    y_pred = predictions[valid]

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

    correlation = float(
        np.corrcoef(
            y_true,
            y_pred,
        )[0, 1]
    )

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

    print("=" * 72)
    print(
        "OceanEmbed — Input Ablation Evaluation"
    )
    print("=" * 72)

    # --------------------------------------------------------
    # Test dataset
    # --------------------------------------------------------

    print("\nLoading untouched test dataset...")

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

    print(
        "\nTest period:",
        test_times[0],
        "to",
        test_times[-1],
    )

    print(
        "Full input shape:",
        X_test.shape,
    )

    # --------------------------------------------------------
    # Target physical units
    # --------------------------------------------------------

    target_mean, target_std = (
        load_target_stats()
    )

    targets_celsius = denormalize(
        y_test,
        target_mean,
        target_std,
    )

    results = {}

    # --------------------------------------------------------
    # Evaluate each experiment
    # --------------------------------------------------------

    for key, config in EXPERIMENTS.items():

        print(
            "\n"
            + "=" * 72
        )

        print(
            "Evaluating:",
            config["label"],
        )

        print(
            "=" * 72
        )

        checkpoint_path = (
            CHECKPOINT_DIR
            / config["checkpoint"]
        )

        if not checkpoint_path.exists():
            raise FileNotFoundError(
                f"Checkpoint not found: "
                f"{checkpoint_path}"
            )

        channels = config[
            "channels"
        ]

        X_exp = X_test[
            ...,
            :channels
        ]

        print(
            "Input shape:",
            X_exp.shape,
        )

        print(
            "Checkpoint:",
            checkpoint_path,
        )

        # These ablation models contain no Lambda layer,
        # so normal Keras loading is safe.
        model = tf.keras.models.load_model(
            checkpoint_path,
            custom_objects={
                "masked_mse": masked_mse,
            },
        )

        predictions_norm = model.predict(
            X_exp,
            batch_size=2,
            verbose=1,
        )

        predictions_norm = np.asarray(
            predictions_norm,
            dtype=np.float32,
        )

        if (
            predictions_norm.shape
            != y_test.shape
        ):
            raise ValueError(
                "Prediction shape mismatch: "
                f"{predictions_norm.shape} "
                f"vs {y_test.shape}"
            )

        predictions_celsius = denormalize(
            predictions_norm,
            target_mean,
            target_std,
        )

        metrics = calculate_metrics(
            targets_celsius,
            predictions_celsius,
            mask_test,
        )

        metrics[
            "input_channels"
        ] = channels

        metrics[
            "label"
        ] = config["label"]

        results[key] = metrics

        print(
            f"\nRMSE        : "
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

    # --------------------------------------------------------
    # Improvements
    # --------------------------------------------------------

    sst_rmse = results[
        "sst"
    ]["rmse_celsius"]

    ssh_rmse = results[
        "sst_ssh"
    ]["rmse_celsius"]

    full_rmse = results[
        "full"
    ]["rmse_celsius"]

    ssh_gain = (
        (sst_rmse - ssh_rmse)
        / sst_rmse
        * 100.0
    )

    wind_gain = (
        (ssh_rmse - full_rmse)
        / ssh_rmse
        * 100.0
    )

    results["summary"] = {
        "ssh_rmse_improvement_percent":
            float(ssh_gain),

        "wind_rmse_improvement_percent":
            float(wind_gain),

        "test_period":
            "2019-2021",
    }

    # --------------------------------------------------------
    # Final comparison
    # --------------------------------------------------------

    print(
        "\n"
        + "=" * 72
    )

    print(
        "ABLATION COMPARISON"
    )

    print(
        "=" * 72
    )

    print(
        f"\nSST only RMSE       : "
        f"{sst_rmse:.4f} °C"
    )

    print(
        f"SST + SSH RMSE      : "
        f"{ssh_rmse:.4f} °C"
    )

    print(
        f"Full + Wind RMSE    : "
        f"{full_rmse:.4f} °C"
    )

    print(
        f"\nSSH contribution    : "
        f"{ssh_gain:+.2f}%"
    )

    print(
        f"Wind contribution   : "
        f"{wind_gain:+.2f}%"
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    with open(
        RESULT_PATH,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            results,
            f,
            indent=2,
        )

    print(
        "\nSaved:"
    )

    print(
        RESULT_PATH
    )

    print(
        "\n"
        + "=" * 72
    )

    print(
        "Ablation evaluation completed."
    )

    print(
        "=" * 72
    )


if __name__ == "__main__":
    main()