from pathlib import Path
import sys
import time

import numpy as np
import tensorflow as tf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.datasets.multidepth_dataset import load_multidepth_data
from src.models.convlstm_multidepth import build_multidepth_convlstm

CHECKPOINT_DIR = Path("checkpoints")
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

BEST_MODEL = CHECKPOINT_DIR / "best_convlstm_multidepth.keras"
FINAL_MODEL = CHECKPOINT_DIR / "final_convlstm_multidepth.keras"

BATCH_SIZE = 2


def pack_target(y, mask):
    return np.concatenate([y, mask], axis=-1).astype(np.float32)


def masked_mse(y_true_packed, y_pred):
    n_depths = tf.shape(y_pred)[-1]

    y_true = y_true_packed[..., :n_depths]
    mask = y_true_packed[..., n_depths:]

    error = tf.square(y_true - y_pred) * mask

    return tf.reduce_sum(error) / (
        tf.reduce_sum(mask) + tf.keras.backend.epsilon()
    )


def main():
    epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    print("Loading training dataset...", flush=True)
    X_train, y_train, m_train, _, _ = load_multidepth_data("train")

    print("\nLoading validation dataset...", flush=True)
    X_val, y_val, m_val, _, _ = load_multidepth_data("val")

    train_target = pack_target(y_train, m_train)
    val_target = pack_target(y_val, m_val)

    print("\nBuilding model...", flush=True)

    model = build_multidepth_convlstm()

    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=5e-4
        ),
        loss=masked_mse,
    )

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            BEST_MODEL,
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

    print(
        f"\nStarting training: epochs={epochs}, "
        f"batch_size={BATCH_SIZE}",
        flush=True,
    )

    start = time.time()

    history = model.fit(
        X_train,
        train_target,
        validation_data=(X_val, val_target),
        epochs=epochs,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        shuffle=True,
        verbose=1,
    )

    elapsed = time.time() - start

    model.save(FINAL_MODEL)

    print("\nTraining finished.", flush=True)
    print(
        f"Elapsed: {elapsed / 60:.2f} minutes",
        flush=True,
    )
    print(
        "Final train loss:",
        history.history["loss"][-1],
        flush=True,
    )
    print(
        "Final val loss:",
        history.history["val_loss"][-1],
        flush=True,
    )
    print("Saved:", FINAL_MODEL, flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
