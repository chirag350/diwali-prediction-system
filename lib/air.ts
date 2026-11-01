import type { Point } from "./types";
// Health-category colours are shared by every air-quality view.
export const colors = [
  "#15803d",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7f1d1d",
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
  if (!Number.isFinite(pm) || pm < 0) return -1;
  const index = pmSubindex(pm);
  return index <= 50
    ? 0
    : index <= 100
      ? 1
      : index <= 200
        ? 2
        : index <= 300
          ? 3
          : index <= 400
            ? 4
            : 5;
}
export function airColor(pm: number) {
  return colors[level(pm)] ?? "#737373";
}
/** Exact piecewise PM2.5 formula from CPCB's AQI-Calculator.xls (cell D10).
 * Input is the unrounded 24-hour concentration. Round only the final index.
 * The display is capped at 500; hourly concentrations remain visible above it.
 * https://cpcb.nic.in/upload/national-air-quality-index/AQI-Calculator.xls
 */
export function pmSubindex(pm: number) {
  if (!Number.isFinite(pm) || pm < 0)
    throw new RangeError("PM2.5 must be a non-negative number");
  const index =
    pm <= 30
      ? (pm * 50) / 30
      : pm <= 60
        ? 50 + ((pm - 30) * 50) / 30
        : pm <= 90
          ? 100 + ((pm - 60) * 100) / 30
          : pm <= 120
            ? 200 + ((pm - 90) * 100) / 30
            : pm <= 250
              ? 300 + ((pm - 120) * 100) / 130
              : 400 + ((pm - 250) * 100) / 130;
  return Math.round(Math.min(500, index));
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

export function airCategory(pm: number | null | undefined) {
  const index = pm === null || pm === undefined ? -1 : level(pm);
  return {
    index,
    label: index < 0 ? "No data" : categories[index],
    color: index < 0 ? "#525252" : colors[index],
    background:
      index < 0
        ? "#f5f5f5"
        : ["#dcfce7", "#ecfccb", "#fef9c3", "#ffedd5", "#fee2e2", "#fecaca"][
            index
          ],
  };
}
