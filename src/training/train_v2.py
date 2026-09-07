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

from src.models.convlstm_residual import (
    build_residual_convlstm,
)

from src.training.losses import (
    masked_mse,
)


CHECKPOINT_DIR = ROOT / "checkpoints"
CHECKPOINT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

BEST_MODEL_PATH = (
    CHECKPOINT_DIR
    / "best_convlstm_v2.keras"
)

FINAL_MODEL_PATH = (
    CHECKPOINT_DIR
    / "final_convlstm_v2.keras"
)


def pack_targets(y, mask):

    return np.stack(
        [y, mask],
        axis=-1,
    ).astype("float32")


def main():

    parser = argparse.ArgumentParser()

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

    print("=" * 70)
    print("OceanEmbed — Residual ConvLSTM V2 Training")
    print("=" * 70)

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

    y_train_packed = pack_targets(
        y_train,
        mask_train,
    )

    y_val_packed = pack_targets(
        y_val,
        mask_val,
    )

    print("\nShapes:")
    print("X_train:", X_train.shape)
    print("y_train:", y_train_packed.shape)
    print("X_val  :", X_val.shape)
    print("y_val  :", y_val_packed.shape)

    assert not np.isnan(X_train).any()
    assert not np.isnan(y_train_packed).any()
    assert not np.isnan(X_val).any()
    assert not np.isnan(y_val_packed).any()

    print("\nBuilding Residual ConvLSTM V2...")

    model = build_residual_convlstm()

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=5e-4,
        ),
        loss=masked_mse,
    )

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

    print("\nStarting V2 training...")
    print("Epochs     :", args.epochs)
    print("Batch size :", args.batch_size)

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

    model.save(
        FINAL_MODEL_PATH
    )

    print("\n" + "=" * 70)
    print("V2 TRAINING COMPLETED")
    print("=" * 70)

    print("\nBest V2 model:")
    print(BEST_MODEL_PATH)

    print("\nFinal V2 model:")
    print(FINAL_MODEL_PATH)

    print("\nFinal train loss:")
    print(history.history["loss"][-1])

    print("\nFinal validation loss:")
    print(history.history["val_loss"][-1])


if __name__ == "__main__":
    main()