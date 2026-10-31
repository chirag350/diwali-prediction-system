import type { Point } from "./types";
export const colors = [
  "#6d9b73",
  "#a4ac58",
  "#dbb653",
  "#d78650",
  "#b85d52",
  "#854551",
];
export const categories = [
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very poor",
  "Severe",
];
export function level(pm: number) {
  return pm <= 30
    ? 0
    : pm <= 60
      ? 1
      : pm <= 90
        ? 2
        : pm <= 120
          ? 3
          : pm <= 250
            ? 4
            : 5;
}
export function airColor(pm: number) {
  return colors[level(pm)];
}
export function pmSubindex(pm: number) {
  const p = Math.round(pm);
  const lo = [0, 31, 61, 91, 121, 251],
    hi = [30, 60, 90, 120, 250, 500],
    il = [0, 51, 101, 201, 301, 401],
    ih = [50, 100, 200, 300, 400, 500];
  const i = level(p);
  return Math.round(
    Math.min(500, il[i] + ((p - lo[i]) / (hi[i] - lo[i])) * (ih[i] - il[i])),
  );
}
export function hourLabel(t: string) {
  return new Date(t)
    .toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: true,
    })
    .replace(":00", "")
    .toLowerCase();
}
export function dateLabel(t: string, year = false) {
  return new Date(t).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  });
}
export function fullDate(t: string) {
  return `${dateLabel(t, true)}, ${hourLabel(t)} IST`;
}
export function peak(points: Point[]) {
  return points
    .slice(0, 48)
    .reduce((a, b) => (b.p50 > a.p50 ? b : a), points[0]);
}
export function clearBy(points: Point[]) {
  const p = peak(points);
  return (
    points.find((x) => x.hour > p.hour && x.p50 < 90 && x.p90 <= 250) ?? null
  );
}
export function bestWindow(points: Point[]) {
  let best = 0,
    score = Infinity;
  for (let i = 0; i < points.length - 2; i++) {
    const s = points.slice(i, i + 3).reduce((a, b) => a + b.p50, 0);
    if (s < score) {
      score = s;
      best = i;
    }
  }
  return { start: points[best], end: points[best + 2], mean: score / 3 };
}
export function download(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Observed rolling-day concentration for replay, using only measured slots. */
export function observedDayMean(
  station: import("./types").Station,
  hour: number,
): number | null {
  const target = Date.parse(station.points[hour].time),
    measured = new Map(station.history.map((p) => [Date.parse(p.time), p.pm]));
  for (const point of station.points.slice(0, hour + 1))
    if (point.actual !== null)
      measured.set(Date.parse(point.time), point.actual);
  const values = Array.from({ length: 24 }, (_, j) =>
    measured.get(target - j * 3600000),
  ).filter((v): v is number => v !== undefined);
  return values.length >= 18
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
