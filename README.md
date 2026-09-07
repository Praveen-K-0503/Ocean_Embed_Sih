## Results

OceanEmbed was evaluated on a chronologically held-out test period from
2019 to 2021. Training data covered 1992–2015, while 2016–2018 was used
for validation.

All reported metrics were calculated only over valid ocean pixels.

### Model Comparison

| Model | RMSE (°C) | MAE (°C) | Bias (°C) | Correlation |
|---|---:|---:|---:|---:|
| SST Baseline | 0.5219 | 0.3512 | -0.0017 | 0.9518 |
| ConvLSTM V1 | 0.3871 | 0.2941 | 0.0372 | 0.9727 |
| Residual ConvLSTM V2 | 0.3869 | 0.2825 | -0.0113 | 0.9730 |
| SST-only ConvLSTM | 0.3763 | 0.2750 | -0.0172 | 0.9740 |
| **SST + SSH ConvLSTM** | **0.3711** | **0.2671** | **0.0112** | **0.9750** |
| SST + SSH + Wind ConvLSTM | 0.3915 | 0.2998 | -0.0958 | 0.9734 |

### Best Model

The best-performing configuration was the **SST + SSH ConvLSTM**, which
achieved an RMSE of **0.3711 °C**, MAE of **0.2671 °C**, and correlation
of **0.9750** on the held-out 2019–2021 test period.

Compared with using SST directly as a subsurface-temperature estimate,
the best ConvLSTM reduced RMSE by approximately **28.90%**.

### Ablation Study

Input ablation experiments were performed to examine the contribution
of different surface variables.

Adding SSH to SST reduced test RMSE from **0.3763 °C to 0.3711 °C**,
indicating that SSH provided additional useful information for the
reconstruction task.

Adding zonal and meridional surface wind components did not improve
performance in the current experimental configuration. The four-channel
SST + SSH + Wind model obtained an RMSE of **0.3915 °C**.

This result should not be interpreted as evidence that wind forcing is
physically unimportant. Rather, under the current monthly dataset,
six-month input sequence, 3 m target depth, and ConvLSTM architecture,
the additional wind channels did not improve generalization on the
held-out test period.

## Current Scope and Limitations

The current OceanEmbed experiments should be considered a
proof-of-concept for data-driven ocean-temperature reconstruction.

The present dataset uses monthly observations from 1992–2021 and
contains a subsurface-temperature target at approximately 3 m depth.
Therefore, the current results should not yet be interpreted as
multi-depth or deep-ocean temperature reconstruction.

Future work will extend the framework to multiple subsurface depth
levels, investigate higher-temporal-resolution datasets, and explore
more physically informed representations of atmospheric forcing.ls -lh data/raw/CORA/