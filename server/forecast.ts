import modelJson from "../models/national-v1.json";
import registryJson from "../data/bundled/registry.json";
import { predict, type Artifact } from "../training/model";
import { bestWindow, clearBy, peak } from "../lib/air";
import type { Snapshot, Station, Registry } from "../lib/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const model = modelJson as Artifact;
export const registry = registryJson as Registry;
export async function getSnapshot(id = "latest"): Promise<Snapshot> {
  "use cache";
  if (!registry.snapshots.some((s) => s.id === id))
    throw Error("Unknown snapshot");
  return JSON.parse(
    await readFile(
      path.join(process.cwd(), "data/bundled/snapshots", `${id}.json`),
      "utf8",
    ),
  );
}
export function findStation(s: Snapshot, id: string | null, h3: string | null) {
  return (
    s.stations.find((s) => s.id === id || s.h3 === h3) ??
    (!id && !h3
      ? (s.stations.find((s) => s.id === "site_301") ?? s.stations[0])
      : undefined)
  );
}
export function summary(s: Station) {
  return {
    peak: peak(s.points),
    clearBy: clearBy(s.points),
    bestWindow: bestWindow(s.points),
    hoursAbove90: s.points.filter((p) => p.p50 > 90).length,
  };
}
export function scenario(s: Station, traffic: number, wind: number) {
  if (s.outlook)
    throw Error(
      "Historical analog outlooks do not support causal input scenarios",
    );
  return s.points.map((p) => ({
    ...p,
    ...predict(model, {
      ...s.input,
      horizon: p.hour,
      traffic: s.input.traffic * (1 + traffic / 100),
      wind: s.input.wind * wind,
    }),
  }));
}
export function attribution(s: Station, hour: number) {
  if (s.outlook)
    throw Error(
      "Historical analog outlooks do not have ridge feature attributions",
    );
  const p = predict(model, { ...s.input, horizon: hour });
  const groups: Record<string, number> = {
    Background: 0,
    "Recent pollution": 0,
    "Weather & wind": 0,
    "Regional fires": 0,
    "Traffic proxy": 0,
    "Time & festival": 0,
  };
  for (const [name, value] of Object.entries(p.contributions)) {
    const key =
      name === "intercept" || name === "latitude" || name === "longitude"
        ? "Background"
        : name.startsWith("pm_")
          ? "Recent pollution"
          : [
                "temperature",
                "humidity",
                "wind_speed",
                "wind_sin",
                "wind_cos",
                "weather_missing",
              ].includes(name)
            ? "Weather & wind"
            : name.startsWith("fire_")
              ? "Regional fires"
              : name.startsWith("traffic")
                ? "Traffic proxy"
                : "Time & festival";
    groups[key] += value;
  }
  return {
    ...p,
    groups,
    disclaimer:
      "Statistical feature contributions, not causal emissions shares.",
  };
}
