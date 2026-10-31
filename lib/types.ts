import type { Inputs } from "../training/model";
export type Point = {
  hour: number;
  time: string;
  p10: number;
  p50: number;
  p90: number;
  actual: number | null;
  mean24: number;
  aqi: number | null;
};
export type Station = {
  outlook?: {
    sourceYears: number[];
    minimumHourlySamples: number;
    latestObservedAt: string;
    latestObservedPm: number;
  };
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lon: number;
  h3: string;
  origin: string;
  measured: number;
  history: { time: string; pm: number }[];
  input: Inputs;
  points: Point[];
  weather: {
    temperature: number;
    humidity: number;
    wind: number;
    direction: number;
    missing: boolean;
  };
};
export type Snapshot = {
  kind?: "outlook";
  outlook?: {
    method: string;
    sourceYears: number[];
    minimumYears: number;
    interval: string;
    limitations: string;
  };
  id: string;
  title: string;
  year: number;
  phase: string;
  issuedAt: string;
  generatedAt: string;
  modelVersion: string;
  candidate: boolean;
  stations: Station[];
};
export type Metric = {
  bucket: string;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
  persistenceMae: number;
  skill: number;
  coverage: number;
  calibrationN: number;
};
export type Registry = {
  snapshots: {
    id: string;
    title: string;
    year: number;
    phase: string;
    issuedAt: string;
    stations: number;
  }[];
  model: {
    version: string;
    trainedAt: string;
    stations: number;
    hourlyRows: number;
    trainingPairs: number;
    testPairs: number;
    metrics: Metric[];
  };
};
