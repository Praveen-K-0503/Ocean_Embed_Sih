from pathlib import Path
import sys
import argparse

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

from src.models.convlstm_ablation import (
    build_convlstm_ablation,
)

from src.training.losses import (
    masked_mse,
)


CHECKPOINT_DIR = ROOT / "checkpoints"
CHECKPOINT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


EXPERIMENTS = {
    "sst": {
        "channels": 1,
        "name": "sst_only",
    },
    "sst_ssh": {
        "channels": 2,
        "name": "sst_ssh",
    },
    "full": {
        "channels": 4,
        "name": "full_4channel",
    },
}


def pack_targets(
    y,
    mask,
):
    return np.stack(
        [y, mask],
        axis=-1,
    ).astype("float32")


def select_channels(
    X,
    channels,
):
    """
    Original channel order:
        0 = SST
        1 = SSH
        2 = u-wind
        3 = v-wind
    """

    return X[
        ...,
        :channels
    ].astype("float32")


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--experiment",
        choices=[
            "sst",
            "sst_ssh",
            "full",
        ],
        required=True,
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=20,
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=2,
    )

    args = parser.parse_args()

    config = EXPERIMENTS[
        args.experiment
    ]

    channels = config[
        "channels"
    ]

    experiment_name = config[
        "name"
    ]

    best_model_path = (
        CHECKPOINT_DIR
        / f"best_ablation_{experiment_name}.keras"
    )

    final_model_path = (
        CHECKPOINT_DIR
        / f"final_ablation_{experiment_name}.keras"
    )

    print("=" * 70)
    print("OceanEmbed — Ablation Training")
    print("=" * 70)

    print(
        "\nExperiment:",
        args.experiment,
    )

    print(
        "Input channels:",
        channels,
    )

    # --------------------------------------------------
    # Dataset
    # --------------------------------------------------

    ds = load_dataset()

    print("\nPreparing train split...")

    (
        X_train,
        y_train,
        mask_train,
        _,
    ) = make_windows(
        ds,
        199201,
        201512,
    )

    print("Preparing validation split...")

    (
        X_val,
        y_val,
        mask_val,
        _,
    ) = make_windows(
        ds,
        201601,
        201812,
    )

    ds.close()

    # --------------------------------------------------
    # Channel selection
    # --------------------------------------------------

    X_train = select_channels(
        X_train,
        channels,
    )

    X_val = select_channels(
        X_val,
        channels,
    )

    y_train_packed = pack_targets(
        y_train,
        mask_train,
    )

    y_val_packed = pack_targets(
        y_val,
        mask_val,
    )

    print("\nShapes:")

    print(
        "X_train:",
        X_train.shape,
    )

    print(
        "y_train:",
        y_train_packed.shape,
    )

    print(
        "X_val  :",
        X_val.shape,
    )

    print(
        "y_val  :",
        y_val_packed.shape,
    )

    # --------------------------------------------------
    # Safety checks
    # --------------------------------------------------

    assert not np.isnan(
        X_train
    ).any()

    assert not np.isnan(
        X_val
    ).any()

    assert not np.isnan(
        y_train_packed
    ).any()

    assert not np.isnan(
        y_val_packed
    ).any()

    # --------------------------------------------------
    # Model
    # --------------------------------------------------

    print("\nBuilding model...")

    model = build_convlstm_ablation(
        channels=channels,
        model_name=(
            f"OceanEmbed_Ablation_{experiment_name}"
        ),
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=1e-3,
        ),
        loss=masked_mse,
    )

    # --------------------------------------------------
    # Callbacks
    # --------------------------------------------------

    callbacks = [

        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(
                best_model_path
            ),
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),

        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),

        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-6,
            verbose=1,
        ),
    ]

    # --------------------------------------------------
    # Training
    # --------------------------------------------------

    print("\nStarting training...")

    print(
        "Epochs     :",
        args.epochs,
    )

    print(
        "Batch size :",
        args.batch_size,
    )

    history = model.fit(
        X_train,
        y_train_packed,
        validation_data=(
            X_val,
            y_val_packed,
        ),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        shuffle=True,
        verbose=1,
    )

    # --------------------------------------------------
    # Save final model
    # --------------------------------------------------

    model.save(
        final_model_path
    )

    print(
        "\n"
        + "=" * 70
    )

    print(
        "ABLATION TRAINING COMPLETED"
    )

    print(
        "=" * 70
    )

    print(
        "\nExperiment:",
        args.experiment,
    )

    print(
        "\nBest checkpoint:"
    )

    print(
        best_model_path
    )

    print(
        "\nFinal model:"
    )

    print(
        final_model_path
    )

    print(
        "\nFinal train loss:"
    )

    print(
        history.history[
            "loss"
        ][-1]
    )

    print(
        "\nFinal validation loss:"
    )

    print(
        history.history[
            "val_loss"
        ][-1]
    )


if __name__ == "__main__":
    main()