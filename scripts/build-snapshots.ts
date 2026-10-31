import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { latLngToCell } from "h3-js";
import { csv, num, ist } from "../training/io";
import {
  predict,
  HOUR,
  dates,
  type Artifact,
  type Inputs,
} from "../training/model";
import { pmSubindex } from "../lib/air";
import type { Snapshot, Station, Registry } from "../lib/types";
const model: Artifact = JSON.parse(
  await readFile("training/output/candidate.json", "utf8"),
);
const audit = JSON.parse(
  await readFile("training/output/data-audit.json", "utf8"),
);
const metrics = JSON.parse(
  await readFile("training/output/metrics.json", "utf8"),
);
const root = process.env.DATA_ROOT ?? "/home/chirag/Documents";
await mkdir("models", { recursive: true });
await mkdir("data/bundled/snapshots", { recursive: true });
await writeFile("models/national-v1.json", JSON.stringify(model));
const fire = new Map<string, number>();
for await (const r of csv(
  `${root}/diwali-nasafirms-crop-data/data/processed/daily_crop_burning_metrics.csv`,
)) {
  const v = num(r.total_frp);
  if (Number.isFinite(v) && v >= 0)
    fire.set(r.date, (fire.get(r.date) ?? 0) + v);
}
const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const traffic = new Map<string, number[]>();
for await (const r of csv(
  `${root}/diwali-traffic-scraper/data/historical/diwali_traffic_india_2014_2026_30min.csv`,
)) {
  const t = ist(r.timestamp_ist),
    v = num(r.traffic_volume_index);
  if (Number.isInteger(t + 0.5) && Number.isFinite(v)) {
    const k = `${canonical(r.nearest_aqi_station)}:${t}`;
    const a = traffic.get(k) ?? [];
    a.push(v);
    traffic.set(k, a);
  }
}
const specs = [
  {
    id: "latest",
    title: "Latest collected",
    year: 2026,
    phase: "Build-up",
    target: Date.parse(audit.cutoff) / HOUR,
  },
  ...[2021, 2022, 2023, 2024, 2025].flatMap((year) =>
    [
      { offset: -48, phase: "Build-up", key: "before" },
      { offset: 0, phase: "Burst", key: "during" },
      { offset: 24, phase: "Hangover", key: "after" },
    ].map((p) => ({
      id: `${year}-${p.key}`,
      title: `Diwali ${year}`,
      year,
      phase: p.phase,
      target: Date.parse(`${dates[year]}T17:00:00+05:30`) / HOUR + p.offset,
    })),
  ),
];
const generatedAt = new Date().toISOString();
const snapshots: Snapshot[] = specs.map((s) => ({
  id: s.id,
  title: s.title,
  year: s.year,
  phase: s.phase,
  issuedAt: "",
  generatedAt,
  modelVersion: "ridge-national-v1",
  candidate: true,
  stations: [],
}));
for (const file of await readdir("training/output/cache")) {
  const cache = JSON.parse(
    await readFile(`training/output/cache/${file}`, "utf8"),
  );
  const s = cache.station;
  if (!(
    s.latitude >= 28.2 &&
    s.latitude <= 29.1 &&
    s.longitude >= 76.7 &&
    s.longitude <= 77.7
  ))
    continue;
  const rows = cache.rows as {
    t: number;
    pm: number;
    weather: number[] | null;
  }[];
  const map = new Map(rows.map((r) => [r.t, r]));
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const r = rows.findLast(
      (r) =>
        r.t + 1 <= spec.target &&
        (spec.id === "latest" || r.t + 1 >= spec.target - 48) &&
        map.has(r.t - 24),
    );
    if (!r) continue;
    const recent = Array.from({ length: 24 }, (_, j) =>
      map.get(r.t - j),
    ).filter((x) => !!x);
    if (recent.length < 18) continue;
    const frp = fire.get(
        new Date((r.t - 48) * HOUR + 5.5 * HOUR).toISOString().slice(0, 10),
      ),
      tr = traffic.get(`${canonical(s.station_name)}:${r.t}`),
      w = r.weather;
    const input: Inputs = {
      time: r.t,
      horizon: 1,
      pm: r.pm,
      lag24: map.get(r.t - 24)!.pm,
      mean24: recent.reduce((a, b) => a + b.pm, 0) / recent.length,
      temperature: w?.[0] ?? 20,
      humidity: w?.[1] ?? 60,
      wind: w?.[2] ?? 2,
      direction: w?.[3] ?? 0,
      weatherMissing: w ? 0 : 1,
      fire: frp ?? 0,
      fireMissing: frp === undefined ? 1 : 0,
      traffic: tr ? tr.reduce((a, b) => a + b, 0) / tr.length : 0,
      trafficMissing: tr ? 0 : 1,
      lat: s.latitude,
      lon: s.longitude,
    };
    const station: Station = {
      id: s.station_id,
      name: s.station_name.split(",")[0].replace(/^Delhi - /, ""),
      fullName: s.station_name,
      lat: s.latitude,
      lon: s.longitude,
      h3: latLngToCell(s.latitude, s.longitude, 8),
      origin: new Date((r.t + 1) * HOUR).toISOString(),
      measured: r.pm,
      history: recent
        .map((x) => ({
          time: new Date((x.t + 1) * HOUR).toISOString(),
          pm: x.pm,
        }))
        .reverse(),
      input,
      weather: {
        temperature: input.temperature,
        humidity: input.humidity,
        wind: input.wind,
        direction: input.direction,
        missing: !!input.weatherMissing,
      },
      points: [],
    };
    for (let h = 1; h <= 72; h++) {
      const p = predict(model, { ...input, horizon: h });
      const preceding = Array.from({ length: 24 }, (_, j) => {
        const rel = h - j;
        return rel > 0
          ? (station.points[rel - 1]?.p50 ?? (rel === h ? p.p50 : undefined))
          : map.get(r.t + rel)?.pm;
      }).filter((x): x is number => x !== undefined);
      const mean = preceding.reduce((a, b) => a + b, 0) / preceding.length;
      station.points.push({
        hour: h,
        time: new Date((r.t + h + 1) * HOUR).toISOString(),
        p10: p.p10,
        p50: p.p50,
        p90: p.p90,
        actual: map.get(r.t + h)?.pm ?? null,
        mean24: mean,
        aqi: preceding.length >= 18 ? pmSubindex(mean) : null,
      });
    }
    snapshots[i].stations.push(station);
  }
}
for (const snap of snapshots) {
  snap.stations.sort((a, b) => a.name.localeCompare(b.name));
  snap.issuedAt =
    snap.stations
      .map((s) => s.origin)
      .sort()
      .at(-1) ?? generatedAt;
  await writeFile(
    `data/bundled/snapshots/${snap.id}.json`,
    JSON.stringify(snap),
  );
}
const registry: Registry = {
  snapshots: snapshots.map((s) => ({
    id: s.id,
    title: s.title,
    year: s.year,
    phase: s.phase,
    issuedAt: s.issuedAt,
    stations: s.stations.length,
  })),
  model: {
    version: "ridge-national-v1",
    trainedAt: model.createdAt,
    stations: audit.stations,
    hourlyRows: audit.hourlyRows,
    trainingPairs: model.models.reduce((a, b) => a + b.count, 0),
    testPairs: metrics.reduce((a: number, b: { n: number }) => a + b.n, 0),
    metrics,
  },
};
await writeFile(
  "data/bundled/registry.json",
  JSON.stringify(registry, null, 2),
);
console.log(
  snapshots.map((s) => `${s.id}: ${s.stations.length} stations`).join("\n"),
);
