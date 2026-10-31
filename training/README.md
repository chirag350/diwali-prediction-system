> **Recheck:** The original modulo horizon sampler was clock-biased. See [AUDIT.md](./AUDIT.md). The code now hashes station and time so each bucket sees every clock hour. Original v1 national metrics do not establish general horizon or Delhi peak skill.

# Training Shwāsa AI

This directory implements the first custom station-level PM2.5 model, offline in TypeScript. It is the ridge baseline permitted by PRD §11, not the entire physics/ensemble/spatial stack. No Python service or paid training platform is required. The final site comes after evaluation.

## Run and monitor

Requirements: Bun and the four existing data directories. No new packages are needed.

```bash
bun run ml:test
bun run ml:train
# Optional Delhi-NCR-only experiment, isolated from national artifacts:
TRAINING_OUTPUT=training/output/ncr bun run ml:train --ncr
# Other dataset location:
DATA_ROOT=/path/to/parent bun run ml:train
```

The initial national run was launched with output redirected to `training/output-run.log`.

```bash
tail -f training/output-run.log
cat training/output/progress.json
```

Allow disk space for per-station hourly JSON caches. The source directories contain approximately 26 GB, including duplicate representations and nationwide observations. Processing runs on CPU, one station at a time; runtime depends on disk and CPU. Do not launch two runs into the same output directory. A fresh run rebuilds caches; automatic resume is not implemented.

## What happens, step by step

1. Discover CPCB CSV files by station ID and match the weather station catalog. Default: all matched stations nationwide, including all available historical years. `--ncr` restricts coordinates to 28.2–29.1 N, 76.7–77.7 E. Unmatched files are excluded, rather than assigned invented coordinates.
2. Read each annual AQI file once. Deduplicate timestamps; reject missing, negative or >2,000 µg/m³ PM2.5; ignore future timestamps. Aggregate into IST hours, requiring three valid quarter-hour readings. Keep the original data untouched. This is basic QC: stuck-sensor detection and provider quality flags remain to implement.
3. Join weather by exact station ID and origin hour, using non-interpolated top-of-hour observations. Temperature, RH, wind speed and circular wind direction enter the baseline. Missing weather gets fixed defaults and an explicit indicator. Reanalysis is retrospective; even origin-hour reanalysis is an availability limitation for a live operational evaluation. Do not use target-time historical weather as a forecast.
4. Read the canonical traffic CSV once, without also reading its JSON, NDJSON and yearly duplicates. Join exact normalized station names at the origin hour; retain missing indicators. Historical `empirical_calibrated` traffic is a generated proxy, not a measured emissions record. Do not call its coefficient causal traffic attribution.
5. Read the processed FIRMS daily table once. Sum FRP across regions/sensors and use the day 48 hours before the origin, allowing daily totals to complete. Missing dates are unknown, not observed zero fires. This is a regional fire-activity proxy, not an upwind plume model; sensors may overlap. Raw DB detections need deduplication and spatial/wind weighting in the next iteration. Regional features are less informative outside northern India.
6. Build current PM2.5, lag-24h PM2.5 and trailing-24h mean (minimum 18 valid hours). Add station coordinates, cyclic target hour/day, lunar-calendar event basis functions, and horizon. Do not use other target-time pollutants, AQI, interpolated PM targets or future actual weather.
7. For each eligible origin, deterministically hash station and time to horizons 1–72 and fit four ridge models for 1–6, 7–24, 25–48 and 49–72 hours. This samples horizon/origin pairs; it does not discard entire years or stations. Horizon remains an input, allowing any integer hour 1–72 at inference. Whole origin-hour measurements are assumed available at the end of the hour. Cross-year origin/target pairs are excluded.
8. Fit only through 2023. Solve regularized normal equations over bounded features in PM2.5 units. No random split or target-derived scaler. The shared code exports exact algebraic feature contributions and a separate clipping adjustment. These contributions are associations, not physical source apportionment. Calendar pulse basis widths are initial assumptions; fitting their shapes is future work.
9. Calibrate absolute residuals on 2024 with the finite-sample 80% conformal rank, separately per horizon bucket. These are symmetric nominal 80% bounds labelled `p10`/`p90` in the inference contract; the center is a ridge point estimate, not a trained conditional median. Time dependence and distribution shift can invalidate nominal coverage; report measured coverage.
10. Evaluate once on 2025: MAE, RMSE, bias, persistence MAE, skill vs persistence and interval coverage per bucket. 2026 is prepared but excluded from fit/calibration/test because its festival is not complete. Runs fail if training/calibration coverage is insufficient. Nothing is automatically promoted.

## Outputs

Under `training/output/` (git-ignored):

- `progress.json`: preparation progress or completion.
- `data-audit.json`: source paths, sizes/mtimes, counts, rejection counts and traffic provenance. This is a local manifest, not a cryptographic dataset snapshot.
- `cache/<station>.json`: hourly normalized data for this run.
- `candidate.json`: schema version, ordered features, coefficients, calibration radii and sample counts; `promoted: false`.
- `metrics.json`: untouched 2025 evaluation.
- `failure.json`: failure details if the run stops. Check log timestamps when reusing an output directory.

Source directories are read-only inputs. `model.ts` exports the same `features()` and `predict()` functions for offline evaluation and later server inference.

## Acceptance and next training iterations

Review national AND Delhi-NCR results before selecting the app model. National averages can hide poor Delhi festival performance. Require positive skill near 24h, compare 80% interval coverage with the PRD's 75–85% hypothesis, and inspect festival peak errors before making claims. Do not repeatedly tune against 2025 and still call it untouched.

Before production, add rolling chronological validation within training years, festival-weighted fitting, hyperparameter selection on training-only folds, leave-one-Diwali-out tests, and station-held-out spatial tests. Station-held-out spatial tests must also remove that station's PM lags, since these would be unavailable in a sensor desert. Report festival/phase/city/station metrics and peak timing. Add climatology/same-hour-last-year baselines; CAMS requires collecting historical forecast vintages first. Preserve the final chronological test set.

Next add forecast-vintage weather, PBL/ventilation with missingness checks, deduplicated upwind FIRMS features, static road/land-use features, and the physics/event residual model. Add boosted trees or TF.js GRU only when validation beats ridge. More complexity is not evidence of better forecasts.

## App implementation after training

1. Review `metrics.json`, inspect Delhi Diwali errors and publish an honest model card. Version the accepted model with the source manifest and evaluation; retain the last good version. The current script deliberately leaves the artifact unpromoted.
2. Import `predict()` from `training/model.ts` into a server-only forecast job. Supply inputs from the same normalization contract; load the approved JSON artifact from server storage. No browser-side training or separate ML server.
3. Ingest current station observations, live weather and measured/proxy traffic with freshness and provenance. Construct 1–72h station predictions. Fail visibly or fall back when required PM history is absent. The current model uses origin weather; adding forecast weather requires retraining with matching historical forecast availability.
4. Build the Delhi H3 city pack. Add regression-kriging and wind transport; validate on stations hidden from all spatial inputs. Broaden uncertainty with distance and missingness. Do not label station interpolation as validated street-level accuracy.
5. Precompute immutable station/hex snapshots via a secret-protected scheduled Next.js route, hourly and every 15 minutes on Diwali night. Store in blob/CDN with issuance time, model version, freshness, interval and `MODELLED` provenance. Requests read snapshots rather than train or forecast on demand.
6. Build `/api/v1/forecast`, `/api/v1/report-card` and attribution responses over approved snapshots. Translate rolling 24h pollutant concentrations into the specified Indian AQI convention; an instantaneous PM2.5 value is not official AQI. Attribution initially exposes statistical features; physical cracker/traffic shares need additional validated structure. What-if outputs remain illustrative, not proven intervention effects.
7. Build the final site: map + Time Machine, My Air with uncertainty, peak/clear-by, Why, report card/methodology, then scenario tools and authority console. Replay uses archived issued forecasts; demo data gets a visible SYNTHETIC banner. Run forecast-contract, replay/leakage, spatial-validation and app checks before publishing.

Current implementation does not yet provide downscaling, a physical emissions decomposition, forecast snapshots, API routes or the final UI. Those depend on the training results and subsequent validation.
