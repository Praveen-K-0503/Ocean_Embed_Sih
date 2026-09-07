from pathlib import Path
import sys
import json

import numpy as np
import tensorflow as tf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.datasets.multidepth_dataset import load_multidepth_data
from src.models.convlstm_multidepth import build_multidepth_convlstm

MODEL_FILE = Path("checkpoints/best_convlstm_multidepth.keras")

STATS_FILE = Path(
    "data/processed/normalized/"
    "nio_multidepth_normalization_stats.json"
)

OUTPUT_FILE = Path(
    "outputs/evaluation/multidepth_test_metrics.json"
)


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    print("Loading test data...", flush=True)

    X, y, mask, times, depths = load_multidepth_data("test")

    print("Loading best model...", flush=True)

    model = build_multidepth_convlstm()
    model.load_weights(MODEL_FILE)

    print("Predicting...", flush=True)

    pred = model.predict(
        X,
        batch_size=2,
        verbose=1,
    )

    with open(STATS_FILE) as f:
        stats = json.load(f)

    results = {}
    all_true = []
    all_pred = []

    print("\nDEPTH-WISE TEST METRICS")
    print("-" * 58)

    for i, depth in enumerate(depths):
        key = str(int(depth))

        mean = stats["target_by_depth"][key]["mean"]
        std = stats["target_by_depth"][key]["std"]

        true_c = y[..., i] * std + mean
        pred_c = pred[..., i] * std + mean

        valid = mask[..., i] > 0

        true_valid = true_c[valid]
        pred_valid = pred_c[valid]

        error = pred_valid - true_valid

        rmse = float(np.sqrt(np.mean(error ** 2)))
        mae = float(np.mean(np.abs(error)))
        bias = float(np.mean(error))

        if len(true_valid) > 1:
            corr = float(
                np.corrcoef(true_valid, pred_valid)[0, 1]
            )
        else:
            corr = float("nan")

        results[key] = {
            "depth_m": float(depth),
            "rmse_c": rmse,
            "mae_c": mae,
            "bias_c": bias,
            "correlation": corr,
            "valid_values": int(valid.sum()),
        }

        all_true.append(true_valid)
        all_pred.append(pred_valid)

        print(
            f"{depth:7.0f} m | "
            f"RMSE {rmse:6.3f} C | "
            f"MAE {mae:6.3f} C | "
            f"Bias {bias:+6.3f} C | "
            f"Corr {corr:6.3f}"
        )

    all_true = np.concatenate(all_true)
    all_pred = np.concatenate(all_pred)

    error = all_pred - all_true

    overall = {
        "rmse_c": float(np.sqrt(np.mean(error ** 2))),
        "mae_c": float(np.mean(np.abs(error))),
        "bias_c": float(np.mean(error)),
        "correlation": float(
            np.corrcoef(all_true, all_pred)[0, 1]
        ),
        "valid_values": int(len(all_true)),
    }

    final = {
        "overall": overall,
        "by_depth": results,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(final, f, indent=2)

    print("\nOVERALL")
    print(f"RMSE: {overall['rmse_c']:.4f} C")
    print(f"MAE : {overall['mae_c']:.4f} C")
    print(f"Bias: {overall['bias_c']:+.4f} C")
    print(f"Corr: {overall['correlation']:.4f}")

    print("\nSaved:", OUTPUT_FILE)
    print("DONE")


if __name__ == "__main__":
    main()
