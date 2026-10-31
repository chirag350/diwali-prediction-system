import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { csv, files, num, ist } from "./io";
import {
  HOUR,
  bucket,
  features,
  names,
  solve,
  dot,
  predict,
  type Inputs,
  type Artifact,
} from "./model";
const base = process.env.DATA_ROOT ?? "/home/chirag/Documents";
const output = path.resolve(process.env.TRAINING_OUTPUT ?? "training/output");
const scope = process.argv.includes("--ncr") ? "ncr" : "national";
const roots = {
  aqi: path.join(base, "diwali-aqi-scraper/data"),
  weather: path.join(base, "diwali-weather-scraper/data"),
  fire: path.join(
    base,
    "diwali-nasafirms-crop-data/data/processed/daily_crop_burning_metrics.csv",
  ),
  traffic: path.join(
    base,
    "diwali-traffic-scraper/data/historical/diwali_traffic_india_2014_2026_30min.csv",
  ),
};
const cutoff = Date.now() / HOUR;
type Station = {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
};
type Row = { t: number; pm: number; weather: number[] | null };
type Cache = { station: Station; rows: Row[] };
async function main() {
  await mkdir(output, { recursive: true });
  await mkdir(path.join(output, "cache"), { recursive: true });
  const catalog: Station[] = JSON.parse(
    await readFile(path.join(roots.weather, "stations_catalog.json"), "utf8"),
  );
  const stations = new Map(
    catalog
      .filter(
        (s) =>
          scope === "national" ||
          (s.latitude >= 28.2 &&
            s.latitude <= 29.1 &&
            s.longitude >= 76.7 &&
            s.longitude <= 77.7),
      )
      .map((s) => [s.station_id, s]),
  );
  const audit = {
    scope,
    startedAt: new Date().toISOString(),
    cutoff: new Date(cutoff * HOUR).toISOString(),
    files: [] as { path: string; size: number; mtime: string }[],
    stations: 0,
    hourlyRows: 0,
    rejectedPm: 0,
    excludedFuture: 0,
    trafficSources: {} as Record<string, number>,
    notes: [
      "Traffic historical data are generated proxies. Weather is origin-time reanalysis, not archived forecasts. Daily fires delayed by 48h; missing coverage is not zero fires. AQI hours require >=3 valid quarter-hour readings.",
    ],
  };
  const fire = new Map<string, number>();
  for await (const r of csv(roots.fire)) {
    const v = num(r.total_frp);
    if (Number.isFinite(v) && v >= 0)
      fire.set(r.date, (fire.get(r.date) ?? 0) + v);
  }
  const traffic = new Map<string, number[]>();
  const canonical = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for await (const r of csv(roots.traffic)) {
    audit.trafficSources[r.data_source] =
      (audit.trafficSources[r.data_source] ?? 0) + 1;
    const t = ist(r.timestamp_ist),
      v = num(r.traffic_volume_index);
    if (Number.isInteger(t + 0.5) && Number.isFinite(v)) {
      const k = `${canonical(r.nearest_aqi_station)}:${t}`;
      const a = traffic.get(k) ?? [];
      a.push(v);
      traffic.set(k, a);
    }
  }
  const grouped = new Map<string, string[]>();
  for await (const f of files(roots.aqi)) {
    if (!f.endsWith(".csv")) continue;
    const id = f.match(/(site_\d+)_15Min\.csv$/)?.[1];
    if (id && stations.has(id)) {
      const a = grouped.get(id) ?? [];
      a.push(f);
      grouped.set(id, a);
    }
  }
  console.log(
    `Preparing ${grouped.size} stations (${scope}); immutable source files remain outside repo.`,
  );
  const caches: string[] = [];
  for (const [id, paths] of grouped) {
    const s = stations.get(id)!;
    const hourly = new Map<number, Map<number, number>>();
    for (const f of paths.sort()) {
      const meta = await stat(f);
      audit.files.push({
        path: f,
        size: meta.size,
        mtime: meta.mtime.toISOString(),
      });
      for await (const r of csv(f)) {
        const t = ist(r.Timestamp);
        if (!Number.isFinite(t)) continue;
        if (t >= cutoff) {
          audit.excludedFuture++;
          continue;
        }
        const p = num(r["PM2.5 (µg/m³)"]);
        if (!Number.isFinite(p) || p < 0 || p > 2000) {
          audit.rejectedPm++;
          continue;
        }
        const h = Math.floor(t + 0.5) - 0.5;
        const a = hourly.get(h) ?? new Map();
        a.set(t, p);
        hourly.set(h, a);
      }
    }
    const weather = new Map<number, number[]>();
    const wf = path.join(roots.weather, "csv", `${id}_weather_30m.csv`);
    try {
      const meta = await stat(wf);
      audit.files.push({
        path: wf,
        size: meta.size,
        mtime: meta.mtime.toISOString(),
      });
      for await (const r of csv(wf)) {
        const t = ist(r.timestamp_ist);
        if (!Number.isInteger(t + 0.5) || !hourly.has(t)) continue;
        const v = [
          num(r.temperature_2m),
          num(r.relative_humidity_2m),
          num(r.wind_speed_ms),
          num(r.wind_direction_10m),
        ];
        if (v.every(Number.isFinite)) weather.set(t, v);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const rows: Row[] = [];
    for (const [t, quarters] of hourly) {
      if (quarters.size >= 3 && t + 1 <= cutoff) {
        const vals = [...quarters.values()];
        rows.push({
          t,
          pm: vals.reduce((a, b) => a + b, 0) / vals.length,
          weather: weather.get(t) ?? null,
        });
      }
    }
    rows.sort((a, b) => a.t - b.t);
    const cache = path.join(output, "cache", `${id}.json`);
    await writeFile(cache, JSON.stringify({ station: s, rows }));
    caches.push(cache);
    audit.stations++;
    audit.hourlyRows += rows.length;
    console.log(
      `[${audit.stations}/${grouped.size}] ${id}: ${rows.length} valid hours`,
    );
    await writeFile(
      path.join(output, "progress.json"),
      JSON.stringify({
        stage: "prepare",
        stations: audit.stations,
        total: grouped.size,
        hourlyRows: audit.hourlyRows,
      }),
    );
  }
  for (const f of [roots.fire, roots.traffic]) {
    const m = await stat(f);
    audit.files.push({ path: f, size: m.size, mtime: m.mtime.toISOString() });
  }
  await writeFile(
    path.join(output, "data-audit.json"),
    JSON.stringify(audit, null, 2),
  );
  // Each origin contributes one deterministically rotated horizon (1..72); no recursive target leakage.
  async function* examples() {
    for (const file of caches) {
      const { station: s, rows }: Cache = JSON.parse(
        await readFile(file, "utf8"),
      );
      const map = new Map(rows.map((r) => [r.t, r]));
      for (const r of rows) {
        const h = 1 + (((Math.floor(r.t) % 72) + 72) % 72),
          target = map.get(r.t + h),
          lag = map.get(r.t - 24);
        if (!target || !lag) continue;
        const recent = rows24(map, r.t);
        if (recent.length < 18) continue;
        // All origin-hour values become available at the END of that hour. Target is h hours later.
        const fireDate = new Date((r.t - 48) * HOUR + 5.5 * HOUR)
            .toISOString()
            .slice(0, 10),
          frp = fire.get(fireDate);
        const tr = traffic.get(`${canonical(s.station_name)}:${r.t}`);
        const w = r.weather;
        const input: Inputs = {
          time: r.t,
          horizon: h,
          pm: r.pm,
          lag24: lag.pm,
          mean24: recent.reduce((a, b) => a + b, 0) / recent.length,
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
        const originYear = new Date(r.t * HOUR + 5.5 * HOUR).getUTCFullYear(),
          year = new Date(target.t * HOUR + 5.5 * HOUR).getUTCFullYear();
        if (originYear !== year) continue;
        yield { input, x: features(input), y: target.pm, year, b: bucket(h) };
      }
    }
  }
  const n = names.length;
  const fits = Array.from({ length: 4 }, () => ({
    g: Array.from({ length: n }, () => Array(n).fill(0) as number[]),
    rhs: Array(n).fill(0) as number[],
    count: 0,
  }));
  console.log(
    "Fitting ridge: training <=2023; calibration 2024; untouched test 2025; 2026 excluded from fit.",
  );
  for await (const e of examples()) {
    if (e.year > 2023 || e.x.some((v) => !Number.isFinite(v))) continue;
    const f = fits[e.b];
    f.count++;
    for (let i = 0; i < n; i++) {
      f.rhs[i] += e.x[i] * e.y;
      for (let j = 0; j < n; j++) f.g[i][j] += e.x[i] * e.x[j];
    }
  }
  if (fits.some((f) => f.count < 100))
    throw Error("Insufficient training examples per horizon bucket");
  const artifact: Artifact = {
    schema: 1,
    features: names,
    models: fits.map((f) => ({
      weights: solve(f.g, f.rhs, Math.max(10, f.count * 0.001)),
      radius: 0,
      count: f.count,
    })),
    createdAt: new Date().toISOString(),
    scope,
    promoted: false,
  };
  const residuals: number[][] = Array.from({ length: 4 }, () => []);
  for await (const e of examples()) {
    if (e.year === 2024)
      residuals[e.b].push(
        Math.abs(e.y - dot(e.x, artifact.models[e.b].weights)),
      );
  }
  for (let i = 0; i < 4; i++) {
    const r = residuals[i].sort((a, b) => a - b);
    if (r.length < 100) throw Error("Insufficient 2024 calibration data");
    artifact.models[i].radius =
      r[Math.min(r.length - 1, Math.ceil((r.length + 1) * 0.8) - 1)];
  }
  const metrics = Array.from({ length: 4 }, () => ({
    n: 0,
    absolute: 0,
    squared: 0,
    bias: 0,
    persistence: 0,
    covered: 0,
  }));
  for await (const e of examples()) {
    if (e.year !== 2025) continue;
    const p = predict(artifact, e.input),
      d = p.p50 - e.y,
      m = metrics[e.b];
    m.n++;
    m.absolute += Math.abs(d);
    m.squared += d * d;
    m.bias += d;
    m.persistence += Math.abs(e.input.pm - e.y);
    m.covered += Number(e.y >= p.p10 && e.y <= p.p90);
  }
  const report = metrics.map((m, i) => ({
    bucket: ["1–6", "7–24", "25–48", "49–72"][i],
    n: m.n,
    mae: m.n ? m.absolute / m.n : null,
    rmse: m.n ? Math.sqrt(m.squared / m.n) : null,
    bias: m.n ? m.bias / m.n : null,
    persistenceMae: m.n ? m.persistence / m.n : null,
    skill: m.persistence ? 1 - m.absolute / m.persistence : null,
    coverage: m.n ? m.covered / m.n : null,
    calibrationN: residuals[i].length,
  }));
  await writeFile(
    path.join(output, "candidate.json"),
    JSON.stringify(artifact, null, 2),
  );
  await writeFile(
    path.join(output, "metrics.json"),
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    path.join(output, "progress.json"),
    JSON.stringify({ stage: "complete", promoted: false }),
  );
  console.log(JSON.stringify(report, null, 2));
  console.log(
    "Candidate saved. Review metrics before promotion; no production model changed.",
  );
}
function rows24(map: Map<number, Row>, t: number) {
  const a: number[] = [];
  for (let i = 0; i < 24; i++) {
    const r = map.get(t - i);
    if (r) a.push(r.pm);
  }
  return a;
}
main().catch(async (e) => {
  console.error(e);
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "failure.json"),
    JSON.stringify({ message: String(e), at: new Date().toISOString() }),
  );
  process.exitCode = 1;
});
