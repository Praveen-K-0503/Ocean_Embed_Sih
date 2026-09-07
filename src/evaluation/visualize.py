from pathlib import Path

# pyrefly: ignore [missing-import]
import numpy as np


# pyrefly: ignore [missing-import]
import matplotlib.pyplot as plt

# pyrefly: ignore [missing-import]
import xarray as xr


ROOT = Path(__file__).resolve().parents[2]

PREDICTIONS_PATH = (
    ROOT
    / "outputs"
    / "evaluation"
    / "test_predictions.npz"
)

DATA_PATH = (
    ROOT
    / "data"
    / "processed"
    / "normalized"
    / "nio_normalized_trainstats_1992-2021.nc"
)

OUTPUT_DIR = (
    ROOT
    / "outputs"
    / "evaluation"
    / "figures"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


def main():

    print("=" * 70)
    print("OceanEmbed — Result Visualization")
    print("=" * 70)

    # --------------------------------------------------
    # Load predictions
    # --------------------------------------------------

    data = np.load(PREDICTIONS_PATH)

    predictions = data["predictions"]
    targets = data["targets"]
    masks = data["masks"]
    times = data["times"]

    print("\nPredictions:", predictions.shape)
    print("Targets    :", targets.shape)
    print("Masks      :", masks.shape)
    print("Times      :", times.shape)

    # --------------------------------------------------
    # Coordinates
    # --------------------------------------------------

    ds = xr.open_dataset(DATA_PATH)

    lat = ds["lat"].values
    lon = ds["lon"].values

    ds.close()

    # --------------------------------------------------
    # Pick last test month
    # --------------------------------------------------

    idx = -1

    actual = targets[idx].copy()
    predicted = predictions[idx].copy()
    mask = masks[idx]

    valid = mask == 1

    actual[~valid] = np.nan
    predicted[~valid] = np.nan

    error = predicted - actual
    absolute_error = np.abs(error)

    current_time = int(times[idx])

    print("\nVisualizing month:")
    print(current_time)

    # Same temperature scale for fair comparison
    temp_min = np.nanmin(
        [np.nanmin(actual), np.nanmin(predicted)]
    )

    temp_max = np.nanmax(
        [np.nanmax(actual), np.nanmax(predicted)]
    )

    # --------------------------------------------------
    # Actual temperature
    # --------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.pcolormesh(
        lon,
        lat,
        actual,
        shading="auto",
        vmin=temp_min,
        vmax=temp_max,
    )

    plt.colorbar(
        label="Temperature (°C)"
    )

    plt.xlabel("Longitude")
    plt.ylabel("Latitude")

    plt.title(
        f"Actual Subsurface Temperature — {current_time}"
    )

    plt.tight_layout()

    actual_path = (
        OUTPUT_DIR
        / f"actual_{current_time}.png"
    )

    plt.savefig(
        actual_path,
        dpi=200,
    )

    plt.close()

    # --------------------------------------------------
    # Predicted temperature
    # --------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.pcolormesh(
        lon,
        lat,
        predicted,
        shading="auto",
        vmin=temp_min,
        vmax=temp_max,
    )

    plt.colorbar(
        label="Temperature (°C)"
    )

    plt.xlabel("Longitude")
    plt.ylabel("Latitude")

    plt.title(
        f"ConvLSTM Reconstruction — {current_time}"
    )

    plt.tight_layout()

    prediction_path = (
        OUTPUT_DIR
        / f"predicted_{current_time}.png"
    )

    plt.savefig(
        prediction_path,
        dpi=200,
    )

    plt.close()

    # --------------------------------------------------
    # Signed error
    # --------------------------------------------------

    max_error = np.nanmax(
        np.abs(error)
    )

    plt.figure(figsize=(10, 5))

    plt.pcolormesh(
        lon,
        lat,
        error,
        shading="auto",
        vmin=-max_error,
        vmax=max_error,
    )

    plt.colorbar(
        label="Prediction − Actual (°C)"
    )

    plt.xlabel("Longitude")
    plt.ylabel("Latitude")

    plt.title(
        f"Reconstruction Error — {current_time}"
    )

    plt.tight_layout()

    error_path = (
        OUTPUT_DIR
        / f"error_{current_time}.png"
    )

    plt.savefig(
        error_path,
        dpi=200,
    )

    plt.close()

    # --------------------------------------------------
    # Absolute error
    # --------------------------------------------------

    plt.figure(figsize=(10, 5))

    plt.pcolormesh(
        lon,
        lat,
        absolute_error,
        shading="auto",
    )

    plt.colorbar(
        label="Absolute Error (°C)"
    )

    plt.xlabel("Longitude")
    plt.ylabel("Latitude")

    plt.title(
        f"Absolute Reconstruction Error — {current_time}"
    )

    plt.tight_layout()

    absolute_error_path = (
        OUTPUT_DIR
        / f"absolute_error_{current_time}.png"
    )

    plt.savefig(
        absolute_error_path,
        dpi=200,
    )

    plt.close()

    # --------------------------------------------------
    # Summary
    # --------------------------------------------------

    print("\nSaved:")

    print(actual_path)
    print(prediction_path)
    print(error_path)
    print(absolute_error_path)

    print("\nMonth statistics:")

    month_rmse = np.sqrt(
        np.nanmean(error ** 2)
    )

    month_mae = np.nanmean(
        absolute_error
    )

    print(
        f"RMSE: {month_rmse:.4f} °C"
    )

    print(
        f"MAE : {month_mae:.4f} °C"
    )

    print("\n" + "=" * 70)
    print("Visualization completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    main()