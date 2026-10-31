# First national model evaluation

Training completed successfully across 600 stations and 22,501,667 valid hourly observations. Fitting used 9,651,410 origin/target pairs through 2023; calibration used 2024; testing used 2,921,283 pairs from 2025.

| Horizon | MAE (µg/m³) | Persistence MAE | MAE reduction | 80% interval coverage |
|---|---:|---:|---:|---:|
| 1–6 h | 14.31 | 14.82 | 3.44% | 82.52% |
| 7–24 h | 18.96 | 20.94 | 9.47% | 82.21% |
| 25–48 h | 20.87 | 22.47 | 7.11% | 83.37% |
| 49–72 h | 22.19 | 24.27 | 8.56% | 82.53% |

The candidate beats persistence in each national horizon bucket. Coverage falls within the PRD’s proposed 75–85% range. Bias is positive in every bucket (approximately +0.94 to +4.10 µg/m³). RMSE is substantially larger than MAE, indicating that large misses still matter.

These are retrospective national, all-season metrics. They do not establish Delhi Diwali performance, exact 24-hour skill, peak-time accuracy, or neighborhood spatial accuracy. Reanalysis availability and generated traffic proxies remain limitations. The 2025 test is now observed: future tuning requires a fresh validation/test protocol.

Decision: retain as an unpromoted baseline candidate. Next evaluate Delhi-NCR, festival windows and phases, high-pollution episodes, interval widths and station-held-out spatial performance before production promotion.

Detailed local artifacts: `output/metrics.json`, `output/data-audit.json`, `output/candidate.json`.
