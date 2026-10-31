import { test, expect } from "bun:test";
import { parse, ist } from "./io";
import { features, solve, predict, names, bucket } from "./model";
const input = {
  time: ist("2025-10-20 19:00:00"),
  horizon: 1,
  pm: 100,
  lag24: 80,
  mean24: 90,
  temperature: 20,
  humidity: 60,
  wind: 2,
  direction: 359,
  weatherMissing: 0,
  fire: 100,
  fireMissing: 0,
  traffic: 200,
  trafficMissing: 0,
  lat: 28.6,
  lon: 77.2,
};
test("CSV keeps quoted station names and empty measurements", () => {
  expect(parse('a,"Delhi, India",,"a""b"')).toEqual([
    "a",
    "Delhi, India",
    "",
    'a"b',
  ]);
});
test("IST is explicit and has half-hour UTC offset", () => {
  expect(ist("2025-01-01 00:00:00")).toBe(
    Date.parse("2024-12-31T18:30:00Z") / 3600000,
  );
});
test("ridge solver recovers a known system", () => {
  const b = solve(
    [
      [3, 3],
      [3, 5],
    ],
    [9, 13],
    0,
  );
  expect(b[0]).toBeCloseTo(1);
  expect(b[1]).toBeCloseTo(2);
});
test("features and inference stay finite and additive", () => {
  expect(features(input)).toHaveLength(names.length);
  const model = {
    schema: 1,
    features: names,
    models: Array.from({ length: 4 }, () => ({
      weights: names.map((_, i) => (i === 1 ? 500 : 0)),
      radius: 20,
      count: 100,
    })),
    createdAt: "test",
    scope: "test",
    promoted: false,
  };
  const p = predict(model, input);
  expect([p.p10, p.p50, p.p90]).toEqual([80, 100, 120]);
  expect(
    Object.values(p.contributions).reduce((a, b) => a + b, 0) +
      p.clippingAdjustment,
  ).toBe(p.p50);
  expect(() => predict(model, { ...input, horizon: 73 })).toThrow();
  expect([6, 7, 24, 25, 48, 49, 72].map(bucket)).toEqual([0, 1, 1, 2, 2, 3, 3]);
});
