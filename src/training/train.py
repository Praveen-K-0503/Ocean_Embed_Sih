from pathlib import Path
import sys
import argparse

# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import tensorflow as tf


# ---------------------------------------------------------
# Project root
# ---------------------------------------------------------

ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from src.datasets.ocean_dataset import (
    load_dataset,
    make_windows,
)

from src.models.convlstm_model import (
    build_convlstm_model,
)

from src.training.losses import (
    masked_mse,
)


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

CHECKPOINT_DIR = ROOT / "checkpoints"
CHECKPOINT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

BEST_MODEL_PATH = (
    CHECKPOINT_DIR
    / "best_convlstm.keras"
)


# ---------------------------------------------------------
# Prepare target + mask
# ---------------------------------------------------------

def pack_targets(y, mask):
    """
    Combine target and ocean mask.

    Output shape:
        (samples, lat, lon, 2)

    channel 0 = normalized temperature
    channel 1 = ocean validity mask
    """

    return np.stack(
        [y, mask],
        axis=-1,
    ).astype("float32")


# ---------------------------------------------------------
# Main training
# ---------------------------------------------------------

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--epochs",
        type=int,
        default=1,
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=2,
    )

    args = parser.parse_args()

    print("=" * 70)
    print("OceanEmbed — ConvLSTM Training")
    print("=" * 70)

    print("\nTensorFlow version:")
    print(tf.__version__)

    # -----------------------------------------------------
    # Load dataset
    # -----------------------------------------------------

    ds = load_dataset()

    print("\nPreparing training data...")

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

    print("Preparing validation data...")

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

    ds.close()

    # -----------------------------------------------------
    # Pack target + mask
    # -----------------------------------------------------

    y_train_packed = pack_targets(
        y_train,
        mask_train,
    )

    y_val_packed = pack_targets(
        y_val,
        mask_val,
    )

    print("\nTraining shapes:")

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

    # -----------------------------------------------------
    # Safety checks
    # -----------------------------------------------------

    assert not np.isnan(X_train).any()
    assert not np.isnan(y_train_packed).any()

    assert not np.isnan(X_val).any()
    assert not np.isnan(y_val_packed).any()

    # -----------------------------------------------------
    # Build model
    # -----------------------------------------------------

    print("\nBuilding ConvLSTM model...")

    model = build_convlstm_model()

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=1e-3,
        ),
        loss=masked_mse,
    )

    model.summary()

    # -----------------------------------------------------
    # Callbacks
    # -----------------------------------------------------

    callbacks = [

        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(BEST_MODEL_PATH),
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

    # -----------------------------------------------------
    # Train
    # -----------------------------------------------------

    print("\nStarting training...")
    print(
        f"Epochs     : {args.epochs}"
    )
    print(
        f"Batch size : {args.batch_size}"
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

    # -----------------------------------------------------
    # Final model
    # -----------------------------------------------------

    final_path = (
        CHECKPOINT_DIR
        / "final_convlstm.keras"
    )

    model.save(final_path)

    print("\n" + "=" * 70)
    print("TRAINING COMPLETED")
    print("=" * 70)

    print("\nBest checkpoint:")
    print(BEST_MODEL_PATH)

    print("\nFinal model:")
    print(final_path)

    print("\nFinal training loss:")
    print(history.history["loss"][-1])

    print("\nFinal validation loss:")
    print(history.history["val_loss"][-1])


if __name__ == "__main__":
    main()