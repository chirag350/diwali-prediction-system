# Model recheck: clock-hour sampling defect and severe-event errors

Delhi-NCR 2025 replay snapshots; overlapping origins, not independent new test sets.

Bundled forecasts reproduce the model exactly (maximum difference 0). The bug is in sampling/model suitability, not an extra scaling factor during serving.

## Training sampler defect

Old origin hours per horizon bucket (IST start of hour): [[6,7,8,9,10,11],[0,1,2,3,4,5,12,13,14,15,16,17,18,19,20,21,22,23],[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]]. Corrected hashing covers all 24 hours in every bucket.

## Replayed 2025 errors

| Replay | Observation stratum (µg/m³) | n | Mean prediction | Mean observed | MAE | 80% coverage |
|---|---|---:|---:|---:|---:|---:|
| 2025-before | all | 3770 | 119.8 | 188.6 | 86.1 | 34.2% |
| 2025-before | observed>=250 | 738 | 156.7 | 414.4 | 257.7 | 0.1% |
| 2025-before | observed>=500 | 163 | 186.7 | 706.8 | 520.2 | 0.0% |
| 2025-during | all | 4024 | 154.1 | 191.8 | 80.1 | 36.4% |
| 2025-during | observed>=250 | 844 | 179.9 | 407.2 | 227.4 | 0.9% |
| 2025-during | observed>=500 | 175 | 185.3 | 704.6 | 519.3 | 0.0% |
| 2025-after | all | 3110 | 184.9 | 145.6 | 65.1 | 26.4% |
| 2025-after | observed>=250 | 281 | 216.3 | 317.5 | 102.5 | 15.7% |
| 2025-after | observed>=500 | 10 | 249.5 | 583.1 | 333.6 | 0.0% |

The original national test statistics remain a record of that flawed sampling protocol, not evidence of good Delhi Diwali peak forecasts. These diagnostic errors expose failure on severe episodes. 2025 has already been inspected; subsequent comparisons must be labelled retrospective diagnostics.

Do not promote v1. Clock-aliased horizon sampling invalidates general claims about horizon skill. Severe-episode performance is poor. Retrain and re-evaluate; never inflate outputs.

## Display

The prominent number was hourly PM2.5 (µg/m³). AQI is a dimensionless index based on a rolling day, not the same number. The hotfix makes the PM2.5-only index explicit and keeps concentration separate. It is not official multi-pollutant AQI.

## Corrected sampler retraining completed

A Delhi-NCR candidate was fitted from 78 prepared station caches with hash-based horizon sampling. It covers all 24 origin hours in each horizon bucket. Fitting used data through 2023, calibration 2024, and a previously examined 2025 diagnostic set.

| Horizon | MAE µg/m³ | Persistence MAE | Skill | Coverage |
|---|---:|---:|---:|---:|
| 1–6 | 28.16 | 29.59 | 4.8% | 80.9% |
| 7–24 | 36.32 | 44.17 | 17.8% | 81.7% |
| 25–48 | 40.43 | 47.74 | 15.3% | 81.1% |
| 49–72 | 42.07 | 50.13 | 16.1% | 80.8% |

This does not resolve peak forecasting. On the same 2025 burst replay, severe observations ≥500 µg/m³ averaged 704.6: v1 predicts 185.3 and the corrected NCR candidate predicts 243.1. Severe-event interval coverage is still 0%. The post-event replay MAE worsens from 65.1 to 71.6 µg/m³. The candidate is therefore **not promoted** and the app exposes the v1 audit warning. A festival-specific model and phase-stratified calibration are still required. The change in dataset scope means national-v1 and NCR-v2 all-season metrics are not a controlled sampler-only comparison.
