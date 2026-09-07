from pathlib import Path
import json

# pyrefly: ignore [missing-import]
import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[2]

EVAL_DIR = ROOT / "outputs" / "evaluation"
FIG_DIR = EVAL_DIR / "figures"

FIG_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


CONVLSTM_METRICS = EVAL_DIR / "test_metrics.json"

OUTPUT_JSON = EVAL_DIR / "model_comparison.json"

OUTPUT_FIGURE = (
    FIG_DIR
    / "convlstm_vs_sst_baseline.png"
)


# ---------------------------------------------------------
# Baseline results already measured on 2019-2021
# ---------------------------------------------------------

SST_BASELINE = {
    "rmse_celsius": 0.5219,
    "mae_celsius": 0.3512,
    "bias_celsius": -0.0017,
    "correlation": 0.9518,
}


def main():

    print("=" * 70)
    print("OceanEmbed — Model Comparison")
    print("=" * 70)

    # -----------------------------------------------------
    # Load ConvLSTM results
    # -----------------------------------------------------

    with open(
        CONVLSTM_METRICS,
        "r",
    ) as f:
        convlstm = json.load(f)

    # -----------------------------------------------------
    # Improvements
    # -----------------------------------------------------

    rmse_improvement = (
        (
            SST_BASELINE["rmse_celsius"]
            - convlstm["rmse_celsius"]
        )
        / SST_BASELINE["rmse_celsius"]
        * 100
    )

    mae_improvement = (
        (
            SST_BASELINE["mae_celsius"]
            - convlstm["mae_celsius"]
        )
        / SST_BASELINE["mae_celsius"]
        * 100
    )

    comparison = {
        "test_period": "2019-2021",

        "sst_baseline": SST_BASELINE,

        "convlstm": {
            "rmse_celsius":
                convlstm["rmse_celsius"],

            "mae_celsius":
                convlstm["mae_celsius"],

            "bias_celsius":
                convlstm["bias_celsius"],

            "correlation":
                convlstm["correlation"],
        },

        "improvement_percent": {
            "rmse": rmse_improvement,
            "mae": mae_improvement,
        },
    }

    # -----------------------------------------------------
    # Save JSON
    # -----------------------------------------------------

    with open(
        OUTPUT_JSON,
        "w",
    ) as f:
        json.dump(
            comparison,
            f,
            indent=4,
        )

    # -----------------------------------------------------
    # Print comparison
    # -----------------------------------------------------

    print("\nSST baseline:")

    print(
        f"RMSE        : "
        f"{SST_BASELINE['rmse_celsius']:.4f} °C"
    )

    print(
        f"MAE         : "
        f"{SST_BASELINE['mae_celsius']:.4f} °C"
    )

    print(
        f"Correlation : "
        f"{SST_BASELINE['correlation']:.4f}"
    )

    print("\nConvLSTM:")

    print(
        f"RMSE        : "
        f"{convlstm['rmse_celsius']:.4f} °C"
    )

    print(
        f"MAE         : "
        f"{convlstm['mae_celsius']:.4f} °C"
    )

    print(
        f"Correlation : "
        f"{convlstm['correlation']:.4f}"
    )

    print("\nImprovement:")

    print(
        f"RMSE: {rmse_improvement:.2f}%"
    )

    print(
        f"MAE : {mae_improvement:.2f}%"
    )

    # -----------------------------------------------------
    # Bar chart
    # -----------------------------------------------------

    labels = [
        "RMSE (°C)",
        "MAE (°C)",
    ]

    baseline_values = [
        SST_BASELINE["rmse_celsius"],
        SST_BASELINE["mae_celsius"],
    ]

    convlstm_values = [
        convlstm["rmse_celsius"],
        convlstm["mae_celsius"],
    ]

    x = range(len(labels))

    width = 0.35

    plt.figure(
        figsize=(8, 5)
    )

    plt.bar(
        [i - width / 2 for i in x],
        baseline_values,
        width=width,
        label="SST baseline",
    )

    plt.bar(
        [i + width / 2 for i in x],
        convlstm_values,
        width=width,
        label="ConvLSTM",
    )

    plt.xticks(
        list(x),
        labels,
    )

    plt.ylabel(
        "Error"
    )

    plt.title(
        "OceanEmbed: ConvLSTM vs SST Baseline"
    )

    plt.legend()

    plt.tight_layout()

    plt.savefig(
        OUTPUT_FIGURE,
        dpi=200,
    )

    plt.close()

    # -----------------------------------------------------
    # Done
    # -----------------------------------------------------

    print("\nSaved comparison JSON:")
    print(OUTPUT_JSON)

    print("\nSaved comparison figure:")
    print(OUTPUT_FIGURE)

    print("\n" + "=" * 70)
    print("Model comparison completed.")
    print("=" * 70)


if __name__ == "__main__":
    main()