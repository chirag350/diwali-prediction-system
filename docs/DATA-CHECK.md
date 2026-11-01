# Data and display corrections

The value 124 shown for Anand Vihar was an **hourly PM2.5 prediction in µg/m³**, not AQI. It must not be presented as recorded AQI.

For **20 October 2025, 6 pm IST**, the saved station data shows:

| Value | Result |
|---|---:|
| Recorded hourly PM2.5 | 79 µg/m³ |
| Recorded 24-hour average PM2.5 | 254.75 µg/m³ |
| AQI calculated from recorded PM2.5 | 404 — Severe |
| Model’s hourly PM2.5 prediction | 124.19 µg/m³ |
| AQI calculated from the model’s 24-hour PM2.5 estimate | 405 — Severe |

These indices use **PM2.5 only**. They are not the full official AQI, which uses other pollutants too.

## Formula source

The formula was read directly from cell D10 of [CPCB’s AQI calculator spreadsheet](https://cpcb.nic.in/upload/national-air-quality-index/AQI-Calculator.xls). The code now uses its continuous piecewise formula, without rounding the concentration first. Above 250 µg/m³, the formula is `400 + (PM2.5 − 250) × 100 / 130`. The displayed index is rounded and capped at 500. The PM2.5 concentration is still shown separately, including values above the AQI display limit.

The previous conversion used a wrong upper concentration for the Severe band. The derived AQI fields in all 19 saved datasets were recalculated. No recorded or predicted PM2.5 values were increased or reduced to change their appearance.

## Source check

The check covers 74,880 saved hourly entries. All 55,830 available recorded PM2.5 values match the prepared CPCB station/hour cache. The 19,050 missing values stay missing. This checks the app’s saved data against its prepared source; it does not independently certify the sensors or downloads.

2026 has no recorded Diwali observations. Its `actual` and `measured` values are null. The latest known past reading stays separately dated, and past input data keeps its original timestamp.

## Display rules

- Past-year views default to Recorded. Estimated values can be selected separately.
- Compare shows AQI first, hourly PM2.5 separately, and the selected date and time.
- Comparisons and map values use matching timestamps. Missing hours are not borrowed from other times.
- Recorded charts leave gaps. They do not draw invented readings across missing hours.
- All health categories share one colour rule: Good is green; Moderate is yellow; Poor is orange; Very poor is red; Severe is dark red.
- Uncertainty and error map layers use separate blue and purple scales.
- Model errors and limits remain visible. No forecast is guaranteed to be accurate.

See `data/bundled/data-check.json` for the machine-readable check. Re-run with `bun scripts/refresh-air-data.ts` when source caches are present.
