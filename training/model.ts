/** Shared, dependency-free training and server inference contract. Hours use UTC epoch. */
export const HOUR = 3600000;
export const dates: Record<number, string> = {
  2009: "2009-10-17",
  2010: "2010-11-05",
  2011: "2011-10-26",
  2012: "2012-11-13",
  2013: "2013-11-03",
  2014: "2014-10-23",
  2015: "2015-11-11",
  2016: "2016-10-30",
  2017: "2017-10-19",
  2018: "2018-11-07",
  2019: "2019-10-27",
  2020: "2020-11-14",
  2021: "2021-11-04",
  2022: "2022-10-24",
  2023: "2023-11-12",
  2024: "2024-10-31",
  2025: "2025-10-20",
  2026: "2026-11-08",
};
export const names = [
  "intercept",
  "pm_now",
  "pm_lag24",
  "pm_mean24",
  "temperature",
  "humidity",
  "wind_speed",
  "wind_sin",
  "wind_cos",
  "weather_missing",
  "fire_log",
  "fire_missing",
  "traffic_proxy",
  "traffic_missing",
  "latitude",
  "longitude",
  "hour_sin",
  "hour_cos",
  "year_sin",
  "year_cos",
  "festival_pre",
  "festival_night",
  "festival_post",
  "horizon",
];
export type Inputs = {
  time: number;
  horizon: number;
  pm: number;
  lag24: number;
  mean24: number;
  temperature: number;
  humidity: number;
  wind: number;
  direction: number;
  weatherMissing: number;
  fire: number;
  fireMissing: number;
  traffic: number;
  trafficMissing: number;
  lat: number;
  lon: number;
};
export type Artifact = {
  schema: 1;
  features: string[];
  models: { weights: number[]; radius: number; count: number }[];
  createdAt: string;
  scope: string;
  promoted: boolean;
};
export function bucket(h: number) {
  return h <= 6 ? 0 : h <= 24 ? 1 : h <= 48 ? 2 : 3;
}
export function features(a: Inputs): number[] {
  const local = new Date((a.time + a.horizon) * HOUR + 5.5 * HOUR);
  const y = local.getUTCFullYear();
  const hour = local.getUTCHours(),
    day = (local.getTime() - Date.UTC(y, 0, 1)) / 86400000;
  const delta = (local.getTime() - Date.parse(`${dates[y]}T20:00:00Z`)) / HOUR;
  return [
    1,
    a.pm / 500,
    a.lag24 / 500,
    a.mean24 / 500,
    a.temperature / 40,
    a.humidity / 100,
    a.wind / 10,
    Math.sin((a.direction * Math.PI) / 180),
    Math.cos((a.direction * Math.PI) / 180),
    a.weatherMissing,
    Math.log1p(a.fire) / 10,
    a.fireMissing,
    a.traffic / 300,
    a.trafficMissing,
    (a.lat - 28) / 10,
    (a.lon - 77) / 10,
    Math.sin((hour * Math.PI) / 12),
    Math.cos((hour * Math.PI) / 12),
    Math.sin((day * 2 * Math.PI) / 365.25),
    Math.cos((day * 2 * Math.PI) / 365.25),
    Math.exp(-Math.abs(delta + 48) / 72),
    Math.exp(-Math.pow(delta / 8, 2)),
    delta > 0 ? Math.exp(-delta / 48) : 0,
    a.horizon / 72,
  ];
}
export function dot(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}
export function predict(model: Artifact, input: Inputs) {
  if (
    input.horizon < 1 ||
    input.horizon > 72 ||
    !Number.isInteger(input.horizon)
  )
    throw Error("Horizon must be an integer 1–72");
  const x = features(input);
  if (x.some((v) => !Number.isFinite(v))) throw Error("Nonfinite features");
  const member = model.models[bucket(input.horizon)];
  const raw = dot(x, member.weights),
    p50 = Math.max(0, raw);
  return {
    p10: Math.max(0, raw - member.radius),
    p50,
    p90: Math.max(p50, raw + member.radius),
    provenance: "MODELLED",
    contributions: Object.fromEntries(
      names.map((name, i) => [name, x[i] * member.weights[i]]),
    ),
    clippingAdjustment: p50 - raw,
  };
}
export function solve(gram: number[][], rhs: number[], lambda = 10) {
  const n = rhs.length,
    a = gram.map((r, i) => [
      ...r.map((v, j) => v + (i === j && i > 0 ? lambda : 0)),
      rhs[i],
    ]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    [a[i], a[p]] = [a[p], a[i]];
    if (Math.abs(a[i][i]) < 1e-12) throw Error("Singular system");
    const d = a[i][i];
    for (let j = i; j <= n; j++) a[i][j] /= d;
    for (let k = 0; k < n; k++)
      if (k !== i) {
        const f = a[k][i];
        for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j];
      }
  }
  return a.map((r) => r[n]);
}
