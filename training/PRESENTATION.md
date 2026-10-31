# Presenting the first Shwāsa model

## A 60-second explanation

“We train a custom model to forecast PM2.5 concentration up to 72 hours ahead. We combine CPCB pollution history with station weather, satellite fire activity, historical traffic proxies and the Diwali calendar. The model learns a weighted relationship between these inputs and later measured PM2.5. We use four regularized regression models for different forecast ranges, because tomorrow's pollution behaves differently from the next hour's pollution.

“We separate fitting, uncertainty calibration and testing by year. Data through 2023 fits the weights; 2024 errors set uncertainty bands; 2025 tests the model against observations it did not train on. Our simplest competitor assumes pollution stays at its current level. We report whether our model improves on that baseline, and whether its uncertainty bands cover observations as intended.

“This first version forecasts at monitoring stations. Validated neighborhood downscaling and the final website are subsequent stages. The website will serve precomputed forecasts with model versions, freshness and uncertainty.”

## What the model actually learns

For a future hour:

`predicted PM2.5 = intercept + sum(feature value × learned weight)`

Features use fixed scales to keep numbers manageable. Ridge regularization penalizes large weights, reducing instability when inputs are correlated. Training minimizes squared prediction error plus that weight penalty. It is supervised regression: the label is future measured PM2.5, not an AQI category.

Inputs include current pollution, yesterday's pollution and the recent mean; temperature, humidity and wind at the forecast origin; delayed regional fire radiative power; traffic proxy; coordinates; cyclic time features; festival proximity; and forecast horizon. Missing-source indicators tell the model where defaults replaced unavailable inputs.

The four horizon buckets are 1–6, 7–24, 25–48 and 49–72 hours. Each origin is paired with one deterministically rotated horizon to control training volume. At inference, the horizon input allows predictions for all integer horizons from 1 through 72. This is direct forecasting: a 72-hour prediction does not repeatedly feed earlier predictions into itself.

Calendar pulse shapes are initial basis functions; their amplitudes are learned. We have not yet learned a full firecracker-emission profile. The national model shares weights across stations and uses coordinates; it does not yet learn a separate model for every neighborhood.

## How uncertainty works

After fitting, we predict 2024 and measure absolute errors. An approximately 80th-percentile error radius, with a finite-sample conformal rank correction, defines a symmetric band around each forecast, separately per horizon bucket. PM2.5 predictions and bounds are clipped at zero.

The code calls the center `p50`, but it is a ridge point prediction, not a fitted conditional median. The lower and upper bounds are nominal 80% prediction bounds, not a guarantee for each individual hour. Serial correlation and year-to-year changes can reduce coverage; that is why we measure coverage in 2025.

## Evaluation slide

Fill numerical results from `output/metrics.json` only after completion:

| Measure | Meaning | Better direction |
|---|---|---|
| MAE, µg/m³ | Average absolute concentration error | Lower |
| RMSE, µg/m³ | Error measure that penalizes large misses more | Lower |
| Bias, µg/m³ | Average prediction minus observation | Near zero |
| Persistence MAE | Error if we simply keep current pollution unchanged | Compare against model MAE |
| Skill | `1 − model MAE / persistence MAE` | Positive; 0.20 means 20% lower MAE |
| Interval coverage | Fraction of observations inside the nominal 80% band | Near 80% |
| Test examples | Number of valid origin/target pairs in the bucket | Disclose |

Do not call `1 − MAE` accuracy, or report one percentage as overall model accuracy. The training target is a continuous concentration with physical units.

A favorable national result alone does not establish Delhi Diwali or street-level skill. Additional festival, city, station and spatial holdout evaluation remains necessary. Strong persistence at short horizons can be difficult to beat; a negative skill score is a finding to investigate and report.

## Questions judges may ask

**Why ridge instead of a neural network?** It is a transparent, low-compute baseline with JavaScript inference. We should add a more complex model only after it beats this model on separate validation data.

**Did you use future data?** Targets are future observations, but features use the origin or earlier. We exclude cross-year origin/target pairs and keep fit/calibration/test years separate. Origin-hour reanalysis is retrospective and may not have been available in real time, so this is an initial retrospective backtest, not a complete operational forecast-vintage evaluation.

**Are all inputs measured?** No. CPCB is observed PM2.5; historical traffic is generated from calibrated patterns; weather is reanalysis; fires are satellite-derived daily totals. We preserve those distinctions. Missing data are flagged.

**Can you say 30% of the pollution came from crackers?** No. Exact additive feature contributions explain the regression calculation; correlated features do not establish causal source shares. Physical source apportionment requires further modeling and validation.

**Is this already a neighborhood model?** It is currently station-level. H3 downscaling, sensor-distance uncertainty and station-held-out tests must precede neighborhood skill claims.

**Will the website train on every request?** No. A scheduled server job will load a reviewed artifact, compute forecasts, and publish snapshots. The app will read those snapshots.

**Why omit 2026 from training?** The current Diwali season is incomplete. It is prepared but excluded from fitting, calibration and the 2025 test. It can support later prospective monitoring once forecasts and observations are archived.
