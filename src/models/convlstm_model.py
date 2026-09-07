from tensorflow import keras
from tensorflow.keras import layers


SEQUENCE_LENGTH = 6
HEIGHT = 52
WIDTH = 121
CHANNELS = 4


def build_convlstm_model():

    inputs = keras.Input(
        shape=(
            SEQUENCE_LENGTH,
            HEIGHT,
            WIDTH,
            CHANNELS,
        ),
        name="surface_sequence",
    )

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=(3, 3),
        padding="same",
        return_sequences=True,
        activation="tanh",
        name="convlstm_1",
    )(inputs)

    x = layers.BatchNormalization()(x)

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=(3, 3),
        padding="same",
        return_sequences=False,
        activation="tanh",
        name="convlstm_2",
    )(x)

    x = layers.BatchNormalization()(x)

    x = layers.Conv2D(
        filters=16,
        kernel_size=(3, 3),
        padding="same",
        activation="relu",
        name="spatial_refinement",
    )(x)

    outputs = layers.Conv2D(
        filters=1,
        kernel_size=(1, 1),
        padding="same",
        activation="linear",
        name="temperature_output",
    )(x)

    outputs = layers.Reshape(
        (HEIGHT, WIDTH),
        name="temperature_map",
    )(outputs)

    model = keras.Model(
        inputs=inputs,
        outputs=outputs,
        name="OceanEmbed_ConvLSTM",
    )

    return model


if __name__ == "__main__":

    model = build_convlstm_model()

    model.summary()