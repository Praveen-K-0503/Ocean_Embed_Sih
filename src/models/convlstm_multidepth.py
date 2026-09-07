import tensorflow as tf
from tensorflow.keras import layers, Model

SEQ_LEN = 6
HEIGHT = 52
WIDTH = 121
CHANNELS = 4
DEPTHS = 19


def build_multidepth_convlstm():
    inputs = layers.Input(
        shape=(SEQ_LEN, HEIGHT, WIDTH, CHANNELS),
        name="surface_sequence",
    )

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=3,
        padding="same",
        return_sequences=True,
        activation="tanh",
        name="convlstm_1",
    )(inputs)

    x = layers.BatchNormalization()(x)

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=3,
        padding="same",
        return_sequences=False,
        activation="tanh",
        name="convlstm_2",
    )(x)

    x = layers.BatchNormalization()(x)

    x = layers.Conv2D(
        32,
        kernel_size=3,
        padding="same",
        activation="relu",
        name="spatial_decoder",
    )(x)

    outputs = layers.Conv2D(
        DEPTHS,
        kernel_size=1,
        padding="same",
        activation="linear",
        name="temperature_profile",
    )(x)

    return Model(
        inputs=inputs,
        outputs=outputs,
        name="OceanEmbed_MultiDepth_ConvLSTM",
    )


if __name__ == "__main__":
    model = build_multidepth_convlstm()
    model.summary()

    dummy = tf.zeros(
        (1, SEQ_LEN, HEIGHT, WIDTH, CHANNELS)
    )

    y = model(dummy)

    print("\nOutput shape:", y.shape)

    assert y.shape == (1, HEIGHT, WIDTH, DEPTHS)

    print("MODEL CHECK PASSED")
