from tensorflow import keras
from tensorflow.keras import layers


SEQUENCE_LENGTH = 6
HEIGHT = 52
WIDTH = 121


def build_convlstm_ablation(
    channels,
    model_name="OceanEmbed_Ablation_ConvLSTM",
):
    """
    ConvLSTM model for input-channel ablation experiments.

    channels:
        1 -> SST only
        2 -> SST + SSH
        4 -> SST + SSH + u-wind + v-wind
    """

    inputs = keras.Input(
        shape=(
            SEQUENCE_LENGTH,
            HEIGHT,
            WIDTH,
            channels,
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

    x = layers.Conv2D(
        filters=1,
        kernel_size=(1, 1),
        padding="same",
        activation="linear",
        name="temperature_output",
    )(x)

    outputs = layers.Reshape(
        (HEIGHT, WIDTH),
        name="temperature_map",
    )(x)

    model = keras.Model(
        inputs=inputs,
        outputs=outputs,
        name=model_name,
    )

    return model


if __name__ == "__main__":

    print("\nSST-only model")
    print("=" * 70)

    model_sst = build_convlstm_ablation(
        channels=1,
        model_name="OceanEmbed_SST_Only",
    )

    model_sst.summary()

    print("\nSST + SSH model")
    print("=" * 70)

    model_sst_ssh = build_convlstm_ablation(
        channels=2,
        model_name="OceanEmbed_SST_SSH",
    )

    model_sst_ssh.summary()

    print("\nFull 4-channel model")
    print("=" * 70)

    model_full = build_convlstm_ablation(
        channels=4,
        model_name="OceanEmbed_Full",
    )

    model_full.summary()