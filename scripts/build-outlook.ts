import { readFile, writeFile } from "node:fs/promises";
import { dates, HOUR } from "../training/model";
import { pmSubindex } from "../lib/air";
import type { Snapshot, Station, Registry } from "../lib/types";
const latest: Snapshot = JSON.parse(
  await readFile("data/bundled/snapshots/latest.json", "utf8"),
);
const registry: Registry = JSON.parse(
  await readFile("data/bundled/registry.json", "utf8"),
);
const generatedAt = new Date().toISOString();
const phases = [
  { key: "before", name: "Build-up", offset: -48 },
  { key: "during", name: "Burst", offset: 0 },
  { key: "after", name: "Hangover", offset: 24 },
];
const snapshots: Snapshot[] = phases.map((p) => ({
  id: `2026-${p.key}`,
  title: "Diwali 2026 outlook",
  year: 2026,
  phase: p.name,
  issuedAt: generatedAt,
  generatedAt,
  modelVersion: "festival-analog-v1",
  candidate: true,
  kind: "outlook",
  outlook: {
    method: "Festival-aligned historical median",
    sourceYears: [],
    minimumYears: 3,
    interval:
      "Historical 10th–90th percentile spread; not a calibrated prediction interval",
    limitations:
      "No 2026 festival observations or future weather are used. This is a long-range seasonal outlook, not an operational 72-hour forecast.",
  },
  stations: [],
}));
const quantile = (values: number[], p: number) => {
  const a = [...values].sort((a, b) => a - b);
  const index = (a.length - 1) * p,
    lo = Math.floor(index);
  return a[lo] + (a[Math.ceil(index)] - a[lo]) * (index - lo);
};
type Metrics = {
  n: number;
  absolute: number;
  squared: number;
  bias: number;
  covered: number;
  persistence: number;
};
const results: Record<string, Metrics> = {};
for (const seed of latest.stations) {
  const cache = JSON.parse(
    await readFile(`training/output/cache/${seed.id}.json`, "utf8"),
  );
  const rows = cache.rows as { t: number; pm: number }[];
  const map = new Map(rows.map((r) => [r.t, r.pm]));
  const samples = (year: number, offset: number, h: number) => {
    const available = [];
    for (let source = 2014; source < year; source++) {
      const origin =
        Date.parse(`${dates[source]}T17:00:00+05:30`) / HOUR + offset;
      const value = map.get(origin + h - 1);
      if (value !== undefined) available.push({ year: source, value });
    }
    return available;
  };
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i],
      snap = snapshots[i];
    const origin =
      Date.parse(`${dates[2026]}T17:00:00+05:30`) / HOUR + phase.offset;
    const byHour = Array.from({ length: 96 }, (_, i) =>
      samples(2026, phase.offset, i - 23),
    );
    if (byHour.some((v) => v.length < 3)) continue;
    const years = [
      ...new Set(byHour.flatMap((a) => a.map((s) => s.year))),
    ].sort();
    const station: Station = {
      ...seed,
      origin: new Date(origin * HOUR).toISOString(),
      history: [],
      input: { ...seed.input, time: origin - 1 },
      weather: { ...seed.weather, missing: true },
      outlook: {
        sourceYears: years,
        minimumHourlySamples: Math.min(...byHour.map((a) => a.length)),
        latestObservedAt: seed.origin,
        latestObservedPm: seed.measured,
      },
      points: [],
    };
    for (let h = 1; h <= 72; h++) {
      const values = byHour[h + 23].map((s) => s.value),
        p50 = quantile(values, 0.5);
      const mean24 =
        byHour.slice(h, h + 24).reduce(
          (a, v) =>
            a +
            quantile(
              v.map((s) => s.value),
              0.5,
            ),
          0,
        ) / 24;
      station.points.push({
        hour: h,
        time: new Date((origin + h) * HOUR).toISOString(),
        p50,
        p10: quantile(values, 0.1),
        p90: quantile(values, 0.9),
        actual: null,
        mean24,
        aqi: pmSubindex(mean24),
      });
    }
    snap.stations.push(station);
    snap.outlook!.sourceYears = [
      ...new Set([...snap.outlook!.sourceYears, ...years]),
    ].sort();
  }
  // Rolling historical festival backtest: a target year never enters its own analog set.
  for (const year of [2023, 2024, 2025])
    for (const phase of phases) {
      const origin =
        Date.parse(`${dates[year]}T17:00:00+05:30`) / HOUR + phase.offset;
      const current = map.get(origin - 1);
      for (let h = 1; h <= 72; h++) {
        const actual = map.get(origin + h - 1),
          history = samples(year, phase.offset, h);
        if (actual === undefined || history.length < 3 || current === undefined)
          continue;
        const values = history.map((s) => s.value),
          p = quantile(values, 0.5);
        for (const key of [`${year}:${phase.key}`, `${year}:all`]) {
          const m = results[key] ?? {
            n: 0,
            absolute: 0,
            squared: 0,
            bias: 0,
            covered: 0,
            persistence: 0,
          };
          m.n++;
          m.absolute += Math.abs(p - actual);
          m.squared += (p - actual) ** 2;
          m.bias += p - actual;
          m.covered += Number(
            actual >= quantile(values, 0.1) && actual <= quantile(values, 0.9),
          );
          m.persistence += Math.abs(current - actual);
          results[key] = m;
        }
      }
    }
}
for (const snap of snapshots) {
  if (!snap.stations.length)
    throw Error("Insufficient complete historical station coverage");
  await writeFile(
    `data/bundled/snapshots/${snap.id}.json`,
    JSON.stringify(snap),
  );
  console.log(
    `${snap.id}: ${snap.stations.length} places, source years ${snap.outlook!.sourceYears.join(", ")}`,
  );
}
registry.snapshots = registry.snapshots.filter(
  (s) => !s.id.startsWith("2026-"),
);
registry.snapshots.push(
  ...snapshots.map((s) => ({
    id: s.id,
    title: s.title,
    year: s.year,
    phase: s.phase,
    issuedAt: s.issuedAt,
    stations: s.stations.length,
  })),
);
await writeFile(
  "data/bundled/registry.json",
  JSON.stringify(registry, null, 2),
);
await writeFile(
  "data/bundled/outlook-backtest.json",
  JSON.stringify(
    {
      method: "Festival-aligned historical median",
      protocol:
        "Rolling target-year exclusion; only years earlier than each target year; minimum three prior years per station/hour. Overlapping phase windows are not independent.",
      generatedAt,
      results: Object.entries(results).map(([key, m]) => ({
        key,
        n: m.n,
        mae: m.absolute / m.n,
        rmse: Math.sqrt(m.squared / m.n),
        bias: m.bias / m.n,
        coverage: m.covered / m.n,
        persistenceMae: m.persistence / m.n,
        skill: 1 - m.absolute / m.persistence,
      })),
      promoted: false,
      intervalInterpretation:
        "Empirical historical spread, not nominally calibrated forecast coverage.",
    },
    null,
    2,
  ),
);
