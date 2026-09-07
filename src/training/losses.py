import tensorflow as tf


def masked_mse(y_true, y_pred):
    """
    Mean Squared Error calculated only over valid ocean pixels.

    y_true contains:
        channel 0: target temperature
        channel 1: mask (1 = valid, 0 = invalid/land)
    """

    y_target = y_true[:, :, :, 0]
    mask = y_true[:, :, :, 1]

    squared_error = tf.square(y_pred - y_target)

    masked_error = squared_error * mask

    total_error = tf.reduce_sum(masked_error)

    valid_pixels = tf.reduce_sum(mask)

    return total_error / tf.maximum(valid_pixels, 1.0)