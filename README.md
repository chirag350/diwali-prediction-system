# Shwāsa — Air, understood.

A map-first Delhi-NCR air-quality app with a custom TypeScript model, 72-hour PM2.5 forecasts, five Diwali replays, and a public model report card.

The visual design uses warm paper, forest green, quiet typography and a muted cartographic palette. Day and night themes, mobile navigation, keyboard search and a low-data view are included.

[Full product requirements](./PRD.md) · [Training instructions](./training/README.md) · [Evaluation results](./training/RESULTS.md) · [Presentation notes](./training/PRESENTATION.md)

## Run with Bun

Requirements: Bun 1.4+ and Node.js 20.9+ for Next.js.

```bash
bun install
bun run dev
```

Open http://localhost:3000. Bundled forecasts and the trained artifact are included: the four source-data repositories are not needed to run the website. Map tiles require a network; an offline H3 schematic is the fallback.

```bash
bun run build
bun run start
```

The production build uses Next.js’s supported webpack option; Turbopack remains the development default. This avoids a CSS-worker port failure observed in the restricted build environment.

## Explore

| Route | Experience |
|---|---|
| `/` | Overview: neighborhood map, forecast card, timeline, 72-hour chart, lower-exposure window |
| `/map` | Expanded H3 map with concentration, band-width and sensor-coverage layers |
| `/my-air` | Local forecast, uncertainty, weather and profile-based general exposure guidance |
| `/time-machine` | 2021–2025 replays, before/during/after, forecast/actual/absolute error |
| `/why` | Exact additive regression contributions, with a causal-interpretation caveat |
| `/lab` | Actual model recomputation for traffic-proxy and wind changes, comparison curve and city map |
| `/compare` | Two monitored places, synchronized forecasts and summary metrics |
| `/report-card` | Held-out national test metrics, persistence comparison, coverage and model weaknesses |
| `/authority` | Public read-only monitoring priorities, team shortlist, CSV and printable briefing |
| `/report` | Cell-level citizen observations, recent browser-report counts and a clean Diwali pledge |
| `/about` | Model card, architecture, data attribution, AQI convention and limitations |
| `/status` | Archive/source coverage and the exact operational services still unconfigured |
| `/embed` | Shareable forecast widget |

Use **⌘/Ctrl K** to find a place, **J** for the guided tour, and **Escape** to close dialogs. Station, snapshot and forecast hour are reflected in shareable URLs. Location matching rounds coordinates to an H3 cell on the device before selecting a nearby monitored place.

The Hindi control currently translates primary navigation and the overview heading; full Hindi content translation remains work in progress.

## Model and data

The included `models/national-v1.json` is the trained, **unpromoted candidate**. It uses the same dependency-free `training/model.ts` inference code as offline evaluation. All visible forecasts carry archive/provenance labels.

- **Fit:** data through 2023; four ridge models covering 1–6, 7–24, 25–48 and 49–72 hours.
- **Calibrate:** nominal 80% conformal bands from 2024 errors.
- **Evaluate:** 2,921,283 held-out forecast pairs in 2025. National weighted MAE: **20.26 µg/m³**; coverage: **82.7%**. Each bucket improves on persistence.
- **Inputs:** observed CPCB PM2.5 history, origin-hour weather reanalysis, delayed regional fire totals, generated historical traffic proxies, coordinates, cyclic time and Diwali proximity.
- **Map:** real H3 resolution-8 cells; inverse-distance interpolation of the nearest three stations. Sensor coverage shows distance, not validated neighborhood accuracy.

Replays through 2023 are in-sample; 2024 is the calibration year. Replays are reconstructed retrospective forecasts, not archived forecasts actually issued on those dates. Origin-hour reanalysis availability remains a limitation.

```bash
bun run ml:test
bun run ml:train
bun run data:snapshots
```

Training reads all four sibling scraper repositories, leaves them unchanged and writes local ignored caches under `training/output/`. `data:snapshots` packages Delhi-NCR inputs and 72-hour outputs from those caches. Its data root defaults to `/home/chirag/Documents`; override `DATA_ROOT` if needed. It creates 15 festival snapshots plus latest-collected inputs, a registry and the model artifact.

The bundled data and model contain no API keys. Do not commit the large raw-data or training-cache directories.

## Server and API

The server loads bundled snapshots; requests never trigger training. Scenarios and feature attribution recompute the actual ridge model. Vayu uses a deterministic forecast-grounded template, so it works without an LLM key.

The `/api/v1/` API includes forecast, timeline, attribution, replay, heatmap source stations, monitoring priorities, safe-window, report-card, status, CSV/GeoJSON export, scenario and assistant endpoints. `/api/v1/openapi.json` provides an endpoint index. Parameters use `snapshot`, `station`, `h3` and `hour` as applicable.

Examples:

```text
/api/v1/forecast?snapshot=2025-during&station=site_301
/api/v1/attribution?snapshot=2025-during&station=site_301&hour=24
/api/v1/export?snapshot=2025-during&format=csv
/api/v1/report-card
```

Reports and pledges persist under `.local-data/` in a serialized, atomically written, single-instance JSON store. Override `LOCAL_DATA_DIR` to change its location. Reports collect a cell and one of four predefined kinds, use a hashed browser identifier and an hourly browser limit, and never alter the model. Browser identifiers do not establish independent people. A production database and stronger abuse controls are required before using reports in nowcasting.

Alert preferences and saved scenarios stay on the device. Remote push/email delivery, magic-link officer authentication, live ingestion, scheduled publication, drift rollback and production cloud storage are **not configured**. The city desk is public and read-only; its worksheet is a monitoring-priority shortlist, not an optimized dispatch plan. Cracker/dust/sprinkling scenario controls are unavailable because the model does not support defensible independent causal effects for them.

The app starts in 2025 replay because the collected files are not fresh enough for a live feed. “Latest collected” deliberately exposes station origin timestamps and does not imply current conditions.

## Checks

```bash
bun run typecheck
bun run lint
bun run ml:test
bun run test:e2e
bun run build
```

Browser tests cover desktop and mobile, route rendering, neighborhood search, timeline controls, replay phases, model scenarios, report-card values, API validation and interval/additive contracts. Run a dev server first. Tests use system Chrome at `/opt/google/chrome/chrome` when available, otherwise a Playwright-installed Chromium. Use `TEST_BASE_URL` to target a production preview.

The service worker caches visited app resources and forecast requests. It does not cache report writes or deliver notifications. The basemap credits OpenStreetMap contributors; the fallback is explicitly schematic.

## Before production

Evaluate Delhi-NCR festival windows, peak errors and high-pollution episodes; validate spatial interpolation on stations hidden from **all** model inputs. Implement production persistence/authentication, live-source availability and actual notification delivery. Review source licensing and model promotion with those results. Statistical feature contributions are not causal pollution shares, and the scenario lab is not evidence of real intervention benefits.

Hourly PM2.5 is the primary forecast. Categories and the PM2.5 sub-index use trailing-day concentration; they are not a complete official multi-pollutant AQI. General exposure guidance links to WHO; this app is not a medical device or a replacement for official CPCB advisories.

Built with Next.js, React, TypeScript, Bun, MapLibre GL, H3 and Lucide. Source data: CPCB, Open-Meteo/ERA5, NASA FIRMS and the local historical-traffic generator. See the methodology page for attribution and limits.
