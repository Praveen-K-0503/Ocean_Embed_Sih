from tensorflow import keras
from tensorflow.keras import layers


SEQUENCE_LENGTH = 6
HEIGHT = 52
WIDTH = 121
CHANNELS = 4

SST_MEAN = 28.115177154541016
SST_STD = 1.6453204154968262
TARGET_MEAN = 28.11151695251465
TARGET_STD = 1.6232924461364746


def build_residual_convlstm():

    inputs = keras.Input(
        shape=(
            SEQUENCE_LENGTH,
            HEIGHT,
            WIDTH,
            CHANNELS,
        ),
        name="surface_sequence",
    )

    # --------------------------------------------------
    # ConvLSTM feature extractor
    # --------------------------------------------------

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=(3, 3),
        padding="same",
        return_sequences=True,
        activation="tanh",
        name="convlstm_1",
    )(inputs)

    x = layers.BatchNormalization(
        name="batchnorm_1",
    )(x)

    x = layers.ConvLSTM2D(
        filters=32,
        kernel_size=(3, 3),
        padding="same",
        return_sequences=False,
        activation="tanh",
        name="convlstm_2",
    )(x)

    x = layers.BatchNormalization(
        name="batchnorm_2",
    )(x)

    x = layers.Conv2D(
        filters=16,
        kernel_size=(3, 3),
        padding="same",
        activation="relu",
        name="spatial_refinement",
    )(x)

    # --------------------------------------------------
    # Learn correction / residual
    # --------------------------------------------------

    residual = layers.Conv2D(
        filters=1,
        kernel_size=(1, 1),
        padding="same",
        activation="linear",
        name="temperature_residual",
    )(x)

    # --------------------------------------------------
    # Current-month normalized SST
    #
    # inputs[:, -1, :, :, 0]
    # --------------------------------------------------

    current_sst = layers.Lambda(
        lambda t: (
            (
                t[:, -1, :, :, 0:1] * SST_STD
                + SST_MEAN
            )
               - TARGET_MEAN
        ) / TARGET_STD,
        output_shape=(HEIGHT, WIDTH, 1),
        name="current_sst_target_scale",
    )(inputs)

    # SST + learned correction
    output = layers.Add(
        name="sst_plus_residual",
    )(
        [
            current_sst,
            residual,
        ]
    )

    output = layers.Reshape(
        (HEIGHT, WIDTH),
        name="temperature_map",
    )(output)

    model = keras.Model(
        inputs=inputs,
        outputs=output,
        name="OceanEmbed_Residual_ConvLSTM",
    )

    return model


if __name__ == "__main__":

    model = build_residual_convlstm()

    model.summary()