/** Recalculate derived indices; never change measured or predicted PM2.5. */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { pmSubindex, observedDayMean, airCategory } from "../lib/air";
import { HOUR, predict, type Artifact } from "../training/model";
import type { Snapshot } from "../lib/types";
const root = "data/bundled/snapshots";
const snapshots: Snapshot[] = [];
let points = 0,
  indicesChanged = 0,
  missing = 0;
const model: Artifact = JSON.parse(
  await readFile("models/national-v1.json", "utf8"),
);
for (const file of await readdir(root)) {
  if (!file.endsWith(".json")) continue;
  const data: Snapshot = JSON.parse(await readFile(`${root}/${file}`, "utf8"));
  for (const s of data.stations) {
    if (s.points.length !== 72)
      throw Error(`Wrong number of hours: ${data.id}/${s.id}`);
    for (const p of s.points) {
      points++;
      if (
        ![p.p10, p.p50, p.p90, p.mean24].every(
          (v) => Number.isFinite(v) && v >= 0,
        ) ||
        p.p10 > p.p50 ||
        p.p50 > p.p90
      )
        throw Error(
          `Invalid concentration or range: ${data.id}/${s.id}/${p.hour}`,
        );
      if (
        data.kind === "outlook" &&
        (p.actual !== null ||
          !s.outlook ||
          s.outlook.sourceYears.some((y) => y >= 2026))
      )
        throw Error("Future observations or source years found");
      const next = p.aqi === null ? null : pmSubindex(p.mean24);
      indicesChanged += Number(p.aqi !== next);
      p.aqi = next;
      if (p.actual === null) missing++;
      if (data.kind !== "outlook") {
        const inferred = predict(model, { ...s.input, horizon: p.hour }).p50;
        if (Math.abs(inferred - p.p50) > 1e-7)
          throw Error(
            `Stored prediction differs from the model: ${data.id}/${s.id}`,
          );
      }
    }
  }
  snapshots.push(data);
  await writeFile(`${root}/${file}`, JSON.stringify(data));
}
// Audit recorded PM2.5 against the prepared CPCB station/hour source cache.
let checked = 0;
for (const id of new Set(
  snapshots
    .filter((s) => s.kind !== "outlook")
    .flatMap((s) => s.stations.map((s) => s.id)),
)) {
  const cache = JSON.parse(
    await readFile(`training/output/cache/${id}.json`, "utf8"),
  );
  const rows = new Map<number, number>(
    cache.rows.map((r: { t: number; pm: number }) => [r.t, r.pm]),
  );
  for (const snap of snapshots.filter((s) => s.kind !== "outlook")) {
    const station = snap.stations.find((s) => s.id === id);
    if (!station) continue;
    for (const p of station.points) {
      if (p.actual === null) continue;
      const source = rows.get(Date.parse(p.time) / HOUR - 1);
      if (source === undefined || Math.abs(source - p.actual) > 1e-7)
        throw Error(
          `Recorded value/source mismatch: ${snap.id}/${id}/${p.hour}`,
        );
      checked++;
    }
  }
}
const s = snapshots
  .find((s) => s.id === "2025-during")!
  .stations.find((s) => s.id === "site_301")!;
const mean = observedDayMean(s, 0)!;
const report = {
  snapshots: snapshots.length,
  hourlyPoints: points,
  derivedIndicesUpdated: indicesChanged,
  recordedValuesMatchedToSourceCache: checked,
  missingValuesKeptMissing: missing,
  observationsAltered: 0,
  predictionsAltered: 0,
  anandVihar2025: {
    time: s.points[0].time,
    hourlyPredictedPm: s.points[0].p50,
    hourlyRecordedPm: s.points[0].actual,
    predictedDayMean: s.points[0].mean24,
    predictedPmAqi: s.points[0].aqi,
    recordedDayMean: mean,
    recordedPmAqi: pmSubindex(mean),
    category: airCategory(mean).label,
    severityColor: airCategory(mean).color,
  },
  aqiFormulaSource:
    "https://cpcb.nic.in/upload/national-air-quality-index/AQI-Calculator.xls",
  aqiFormula:
    "Cell D10; continuous piecewise formula; unrounded 24-hour concentration; final rounded display capped at 500",
  limits:
    "Indices use PM2.5 only, not official multi-pollutant AQI. Recorded values are checked against the prepared CPCB cache, not independently certified. Model predictions remain uncertain.",
};
await writeFile(
  "data/bundled/data-check.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
