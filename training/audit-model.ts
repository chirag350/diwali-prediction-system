import { readFile, writeFile } from "node:fs/promises";
import { predict, type Artifact } from "./model";
import { sampleHorizon } from "./sampling";
import type { Snapshot } from "../lib/types";
const model: Artifact = JSON.parse(
  await readFile("models/national-v1.json", "utf8"),
);
const reports = [];
let maxDifference = 0;
for (const id of ["2025-before", "2025-during", "2025-after"]) {
  const snapshot: Snapshot = JSON.parse(
    await readFile(`data/bundled/snapshots/${id}.json`, "utf8"),
  );
  for (const filter of ["all", "observed>=250", "observed>=500"]) {
    let n = 0,
      pred = 0,
      actual = 0,
      absolute = 0,
      bias = 0,
      covered = 0,
      baseline = 0;
    for (const s of snapshot.stations)
      for (const p of s.points) {
        maxDifference = Math.max(
          maxDifference,
          Math.abs(predict(model, { ...s.input, horizon: p.hour }).p50 - p.p50),
        );
        if (
          p.actual === null ||
          (filter === "observed>=250" && p.actual < 250) ||
          (filter === "observed>=500" && p.actual < 500)
        )
          continue;
        n++;
        pred += p.p50;
        actual += p.actual;
        const error = p.p50 - p.actual;
        absolute += Math.abs(error);
        bias += error;
        covered += Number(p.actual >= p.p10 && p.actual <= p.p90);
        baseline += Math.abs((s.measured ?? s.input.pm) - p.actual);
      }
    reports.push({
      snapshot: id,
      stratum: filter,
      n,
      predictedMean: pred / n,
      observedMean: actual / n,
      mae: absolute / n,
      bias: bias / n,
      coverage: covered / n,
      persistenceMae: baseline / n,
    });
  }
}
const originHours = (sample: (t: number) => number) =>
  Array.from({ length: 4 }, () => new Set<number>()).map((set, b) => {
    for (let k = 0; k < 24 * 365; k++) {
      const time = Date.parse("2023-01-01T00:00:00+05:30") / 3600000 + k;
      const h = sample(time),
        bucket = h <= 6 ? 0 : h <= 24 ? 1 : h <= 48 ? 2 : 3;
      if (bucket === b) set.add(k % 24);
    }
    return [...set].sort((a, b) => a - b);
  });
const audit = {
  createdAt: new Date().toISOString(),
  model: "ridge-national-v1",
  maxBundledInferenceDifference: maxDifference,
  scope:
    "Delhi-NCR 2025 replay snapshots; overlapping origins, not independent new test sets",
  originHoursByBucket: {
    old: originHours((t) => 1 + (((Math.floor(t) % 72) + 72) % 72)),
    corrected: originHours((t) => sampleHorizon(t, "site_301")),
  },
  results: reports,
  decision:
    "Do not promote v1. Clock-aliased horizon sampling invalidates general claims about horizon skill. Severe-episode performance is poor. Retrain and re-evaluate; never inflate outputs.",
};
await writeFile(
  "data/bundled/model-audit.json",
  JSON.stringify(audit, null, 2),
);
const lines = [
  "# Model recheck: clock-hour sampling defect and severe-event errors",
  "",
  audit.scope + ".",
  "",
  `Bundled forecasts reproduce the model exactly (maximum difference ${maxDifference}). The bug is in sampling/model suitability, not an extra scaling factor during serving.`,
  "",
  "## Training sampler defect",
  "",
  `Old origin hours per horizon bucket (IST start of hour): ${JSON.stringify(audit.originHoursByBucket.old)}. Corrected hashing covers all 24 hours in every bucket.`,
  "",
  "## Replayed 2025 errors",
  "",
  "| Replay | Observation stratum (µg/m³) | n | Mean prediction | Mean observed | MAE | 80% coverage |",
  "|---|---|---:|---:|---:|---:|---:|",
  ...reports.map(
    (r) =>
      `| ${r.snapshot} | ${r.stratum} | ${r.n} | ${r.predictedMean.toFixed(1)} | ${r.observedMean.toFixed(1)} | ${r.mae.toFixed(1)} | ${(r.coverage * 100).toFixed(1)}% |`,
  ),
  "",
  "The original national test statistics remain a record of that flawed sampling protocol, not evidence of good Delhi Diwali peak forecasts. These diagnostic errors expose failure on severe episodes. 2025 has already been inspected; subsequent comparisons must be labelled retrospective diagnostics.",
  "",
  audit.decision,
  "",
  "## Display",
  "",
  "The prominent number was hourly PM2.5 (µg/m³). AQI is a dimensionless index based on a rolling day, not the same number. The hotfix makes the PM2.5-only index explicit and keeps concentration separate. It is not official multi-pollutant AQI.",
];
await writeFile("training/AUDIT.md", lines.join("\n") + "\n");
console.log(JSON.stringify(audit, null, 2));
