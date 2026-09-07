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


V1_METRICS = EVAL_DIR / "test_metrics.json"
V2_METRICS = EVAL_DIR / "test_metrics_v2.json"
ABLATION_METRICS = EVAL_DIR / "ablation_results.json"

OUTPUT_JSON = EVAL_DIR / "final_model_comparison.json"
OUTPUT_FIGURE = FIG_DIR / "final_model_comparison.png"


SST_BASELINE = {
    "rmse_celsius": 0.5219,
    "mae_celsius": 0.3512,
    "bias_celsius": -0.0017,
    "correlation": 0.9518,
}


def load_json(path):
    with open(
        path,
        "r",
        encoding="utf-8",
    ) as f:
        return json.load(f)


def main():

    print("=" * 72)
    print("OceanEmbed — Final Model Comparison")
    print("=" * 72)

    v1 = load_json(
        V1_METRICS
    )

    v2 = load_json(
        V2_METRICS
    )

    ablation = load_json(
        ABLATION_METRICS
    )

    models = {
        "SST Baseline": SST_BASELINE,

        "ConvLSTM V1": v1,

        "Residual ConvLSTM V2": v2,

        "SST-only ConvLSTM": ablation[
            "sst"
        ],

        "SST + SSH ConvLSTM": ablation[
            "sst_ssh"
        ],

        "SST + SSH + Wind ConvLSTM": ablation[
            "full"
        ],
    }

    print()

    header = (
        f"{'Model':32s}"
        f"{'RMSE':>10s}"
        f"{'MAE':>10s}"
        f"{'Bias':>10s}"
        f"{'Corr':>10s}"
    )

    print(header)
    print("-" * len(header))

    for name, metrics in models.items():

        print(
            f"{name:32s}"
            f"{metrics['rmse_celsius']:10.4f}"
            f"{metrics['mae_celsius']:10.4f}"
            f"{metrics['bias_celsius']:10.4f}"
            f"{metrics['correlation']:10.4f}"
        )

    best_model = min(
        models,
        key=lambda name: models[name][
            "rmse_celsius"
        ],
    )

    best_rmse = models[
        best_model
    ]["rmse_celsius"]

    baseline_rmse = SST_BASELINE[
        "rmse_celsius"
    ]

    improvement = (
        (
            baseline_rmse
            - best_rmse
        )
        / baseline_rmse
        * 100.0
    )

    result = {
        "test_period": "2019-2021",
        "models": models,
        "best_model": best_model,
        "best_rmse_celsius": best_rmse,
        "rmse_improvement_vs_sst_percent":
            improvement,
    }

    with open(
        OUTPUT_JSON,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            result,
            f,
            indent=2,
        )

    # --------------------------------------------------
    # RMSE figure
    # --------------------------------------------------

    names = list(
        models.keys()
    )

    rmse_values = [
        models[name][
            "rmse_celsius"
        ]
        for name in names
    ]

    plt.figure(
        figsize=(11, 6)
    )

    bars = plt.bar(
        names,
        rmse_values,
    )

    plt.ylabel(
        "RMSE (°C)"
    )

    plt.title(
        "OceanEmbed Model Comparison — Test Period 2019–2021"
    )

    plt.xticks(
        rotation=30,
        ha="right",
    )

    plt.grid(
        axis="y",
        alpha=0.25,
    )

    for bar, value in zip(
        bars,
        rmse_values,
    ):
        plt.text(
            bar.get_x()
            + bar.get_width() / 2,
            bar.get_height(),
            f"{value:.3f}",
            ha="center",
            va="bottom",
        )

    plt.tight_layout()

    plt.savefig(
        OUTPUT_FIGURE,
        dpi=200,
        bbox_inches="tight",
    )

    plt.close()

    print(
        "\nBest model:"
    )

    print(
        best_model
    )

    print(
        f"\nBest RMSE: "
        f"{best_rmse:.4f} °C"
    )

    print(
        f"Improvement vs SST baseline: "
        f"{improvement:.2f}%"
    )

    print(
        "\nSaved JSON:"
    )

    print(
        OUTPUT_JSON
    )

    print(
        "\nSaved figure:"
    )

    print(
        OUTPUT_FIGURE
    )

    print(
        "\n"
        + "=" * 72
    )

    print(
        "Final comparison completed."
    )

    print(
        "=" * 72
    )


if __name__ == "__main__":
    main()