"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudFog,
  Database,
  Download,
  ExternalLink,
  Flame,
  Heart,
  Leaf,
  MapPin,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  TrafficCone,
  Users,
  Wind,
} from "lucide-react";
import type { Registry, Snapshot, Station, Point } from "../lib/types";
import {
  airColor,
  pmSubindex,
  observedDayMean,
  clearBy,
  dateLabel,
  download,
  fullDate,
  hourLabel,
  peak,
} from "../lib/air";
import modelJson from "../models/national-v1.json";
import outlookBacktest from "../data/bundled/outlook-backtest.json";
import modelAudit from "../data/bundled/model-audit.json";
import { predict, type Artifact } from "../training/model";
import { ForecastChart } from "./forecast-chart";
import { AirStatus, Badge, CardHead, InfoNote, SectionLabel } from "./ui";
const AirMap = dynamic(() => import("./air-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading the map…</div>,
});
const model = modelJson as Artifact;
function groups(station: Station, hour: number) {
  const result = predict(model, { ...station.input, horizon: hour + 1 });
  const groups: Record<string, number> = {
    "Area and starting level": 0,
    "Recent pollution": 0,
    "Weather & wind": 0,
    "Regional fires": 0,
    "Estimated traffic": 0,
    "Time & festival": 0,
  };
  for (const [name, v] of Object.entries(result.contributions)) {
    const key = ["intercept", "latitude", "longitude"].includes(name)
      ? "Area and starting level"
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
              ? "Estimated traffic"
              : "Time & festival";
    groups[key] += v;
  }
  return { result, groups };
}
export function WhyView({ station, hour }: { station: Station; hour: number }) {
  const data = groups(station, hour),
    max = Math.max(...Object.values(data.groups).map(Math.abs));
  const descriptions: Record<string, string> = {
    "Area and starting level":
      "The model’s starting value and the area’s location.",
    "Recent pollution": "Recent pollution readings and the past day’s average.",
    "Weather & wind": station.weather.missing
      ? "Weather data is missing. The model uses a default value and records the gap."
      : "Temperature, humidity and wind when the forecast starts.",
    "Regional fires": station.input.fireMissing
      ? "Fire data is missing for this date."
      : "Earlier satellite fire reports. These do not measure smoke in this area.",
    "Estimated traffic": station.input.trafficMissing
      ? "No traffic data is available for this area."
      : "Past traffic estimates, not recorded vehicle emissions.",
    "Time & festival": "Time of day, season and days before or after Diwali.",
  };
  return (
    <>
      <div className="why-intro">
        <div>
          <SectionLabel>ESTIMATE DETAILS</SectionLabel>
          <h2>
            What affects
            <br />
            <em>this estimate</em>
          </h2>
          <p>
            For {station.name}, {dateLabel(station.points[hour].time)} at{" "}
            {hourLabel(station.points[hour].time)}. These contributions add up
            to the prediction.
          </p>
        </div>
        <div className="why-total">
          <Wind size={25} />
          <strong style={{ color: airColor(data.result.p50) }}>
            {Math.round(data.result.p50)}
            <span> µg/m³</span>
          </strong>
          <Badge>MODELLED</Badge>
        </div>
      </div>
      <div className="why-grid">
        <section className="card">
          <CardHead
            title="What affects the estimate"
            subtitle="How each part changes the estimate · µg/m³"
          />
          <div className="contribution-bars">
            {Object.entries(data.groups).map(([name, value], i) => (
              <div className="contribution-row" key={name}>
                <div>
                  <span className={`driver-dot driver-${i}`} />
                  <strong>{name}</strong>
                  <span>
                    {value >= 0 ? "+" : ""}
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="contribution-track">
                  <div
                    style={{
                      width: `${Math.max(1, (Math.abs(value) / max) * 100)}%`,
                      background: value >= 0 ? "#537d60" : "#c89667",
                    }}
                  />
                </div>
              </div>
            ))}
            {data.result.clippingAdjustment !== 0 && (
              <p>
                Adjustment to keep the estimate above zero:{" "}
                {data.result.clippingAdjustment.toFixed(1)}
              </p>
            )}
          </div>
          <div className="contribution-sum">
            <span>Total estimate</span>
            <strong>{data.result.p50.toFixed(1)} µg/m³</strong>
          </div>
        </section>
        <div className="driver-notes">
          {Object.entries(descriptions).map(([name, description], i) => (
            <div key={name}>
              <span className="note-number">0{i + 1}</span>
              <div>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <InfoNote>
        These values explain the model’s calculation. They do not prove how much
        pollution came from traffic, fires or crackers.
      </InfoNote>
    </>
  );
}
function modified(station: Station, traffic: number, wind: number): Point[] {
  return station.points.map((p) => {
    const out = predict(model, {
      ...station.input,
      horizon: p.hour,
      traffic: station.input.traffic * (1 + traffic / 100),
      wind: station.input.wind * wind,
    });
    const extra = (out.p90 - out.p10) * 0.1;
    return {
      ...p,
      p50: out.p50,
      p10: Math.max(0, out.p10 - extra),
      p90: out.p90 + extra,
    };
  });
}
export function LabView({
  snapshot,
  station,
  hour,
  onSelect,
  notify,
}: {
  snapshot: Snapshot;
  station: Station;
  hour: number;
  onSelect: (id: string) => void;
  notify: (s: string) => void;
}) {
  const [traffic, setTraffic] = useState(0),
    [wind, setWind] = useState(1);
  useEffect(() => {
    const raw = localStorage.getItem("shwasa-scenario");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (
        saved.station === station.id &&
        saved.snapshot === snapshot.id &&
        Number.isFinite(saved.traffic) &&
        saved.traffic >= -40 &&
        saved.traffic <= 20 &&
        Number.isFinite(saved.wind) &&
        saved.wind >= 0.5 &&
        saved.wind <= 2
      )
        queueMicrotask(() => {
          setTraffic(saved.traffic);
          setWind(saved.wind);
        });
    } catch {
      /* Ignore invalid browser-local preferences. */
    }
  }, [station.id, snapshot.id]);
  const points = useMemo(
    () => modified(station, traffic, wind),
    [station, traffic, wind],
  );
  const original = peak(station.points),
    changed = peak(points),
    clear = clearBy(points);
  const referenceTime = station.points[hour].time;
  const values = useMemo(
    () =>
      Object.fromEntries(
        snapshot.stations.map((s) => [
          s.id,
          modified(s, traffic, wind).find((p) => p.time === referenceTime)
            ?.p50 ?? null,
        ]),
      ),
    [snapshot.stations, traffic, wind, referenceTime],
  );
  return (
    <>
      <InfoNote>
        This is an example, not a forecast or proof of a policy’s effect. Only
        traffic and wind settings change. The displayed range is made 20% wider.
      </InfoNote>
      <div className="lab-grid">
        <section className="card lab-controls">
          <CardHead
            title="Change the settings"
            subtitle="Adjust traffic and wind below."
          />
          <div className="slider-control">
            <div>
              <TrafficCone size={20} />
              <strong>Estimated traffic</strong>
              <span>
                {traffic > 0 ? "+" : ""}
                {traffic}%
              </span>
            </div>
            <p>Change the estimated amount of traffic.</p>
            <input
              type="range"
              min="-40"
              max="20"
              step="5"
              value={traffic}
              onChange={(e) => setTraffic(Number(e.target.value))}
              aria-label="Traffic change percent"
              disabled={!!station.input.trafficMissing}
            />
            <div className="slider-extents">
              <span>−40% · lighter</span>
              <span>+20% · heavier</span>
            </div>
            {!!station.input.trafficMissing && (
              <small className="warning-text">
                No traffic estimate is available here. Try Anand Vihar.
              </small>
            )}
          </div>
          <div className="slider-control">
            <div>
              <Wind size={20} />
              <strong>Wind speed</strong>
              <span>{wind.toFixed(2)}×</span>
            </div>
            <p>Change the wind speed used by the model.</p>
            <input
              type="range"
              min=".5"
              max="2"
              step=".05"
              value={wind}
              onChange={(e) => setWind(Number(e.target.value))}
              aria-label="Wind speed multiplier"
              disabled={station.weather.missing}
            />
            <div className="slider-extents">
              <span>0.5× · calmer</span>
              <span>2× · breezier</span>
            </div>
            {station.weather.missing && (
              <small className="warning-text">
                Wind data is missing, so this setting is off.
              </small>
            )}
          </div>
          <div className="unavailable-control">
            <Flame size={19} />
            <div>
              <strong>Crackers, dust & sprinkling</strong>
              <p>
                The model cannot reliably show the effects of these changes yet.
              </p>
            </div>
            <Badge>Next model</Badge>
          </div>
          <div className="lab-buttons">
            <button
              className="secondary-button"
              onClick={() => {
                setTraffic(0);
                setWind(1);
              }}
            >
              <RotateCcw size={15} />
              Reset
            </button>
            <button
              className="primary-button"
              onClick={() => {
                localStorage.setItem(
                  "shwasa-scenario",
                  JSON.stringify({
                    traffic,
                    wind,
                    station: station.id,
                    snapshot: snapshot.id,
                  }),
                );
                notify("Scenario saved on this device.");
              }}
            >
              <Save size={15} />
              Save scenario
            </button>
          </div>
        </section>
        <div className="lab-result">
          <div className="scenario-stats">
            <div>
              <SectionLabel>ORIGINAL HIGHEST VALUE</SectionLabel>
              <strong>
                {Math.round(original.p50)}
                <small> µg/m³</small>
              </strong>
            </div>
            <div>
              <SectionLabel>NEW HIGHEST VALUE</SectionLabel>
              <strong>
                {Math.round(changed.p50)}
                <small> µg/m³</small>
              </strong>
            </div>
            <div>
              <SectionLabel>CHANGE</SectionLabel>
              <strong
                className={
                  changed.p50 <= original.p50 ? "green-text" : "warm-text"
                }
              >
                {changed.p50 > original.p50 ? "+" : ""}
                {(changed.p50 - original.p50).toFixed(1)}
                <small> µg/m³</small>
              </strong>
            </div>
          </div>
          <section className="card">
            <CardHead
              title="Original and changed estimates"
              subtitle={`${station.name} · solid: original · dashed: changed`}
            />
            <ForecastChart points={station.points} comparison={points} />
          </section>
          <div className="scenario-details">
            <span>
              <Sun size={16} />
              Lower pollution after:{" "}
              <strong>
                {clear
                  ? `${dateLabel(clear.time)}, ${hourLabel(clear.time)}`
                  : "Not indicated within 72h"}
              </strong>
            </span>
            <span>
              <Activity size={16} />
              <strong>{points.filter((p) => p.p50 > 90).length}</strong> hours
              above 90 µg/m³
            </span>
          </div>
        </div>
      </div>
      <section className="card map-card scenario-map">
        <CardHead
          title="Changes on the map"
          subtitle="The same settings are applied across the map."
        />
        <AirMap
          stations={snapshot.stations}
          selected={station.id}
          hour={hour}
          onSelect={onSelect}
          scenarioValues={values}
        />
      </section>
    </>
  );
}
export function CompareView({
  stations,
  station,
  hour,
  onHourChange,
}: {
  stations: Station[];
  station: Station;
  hour: number;
  onHourChange: (hour: number) => void;
}) {
  const [second, setSecond] = useState(
    stations.find((s) => s.id !== station.id)?.id ?? station.id,
  );
  const [preferredMode, setPreferredMode] = useState<"recorded" | "estimate">(
    "recorded",
  );
  const future = !!station.outlook;
  const recorded = !future && preferredMode === "recorded";
  const other =
    stations.find((s) => s.id === second) ??
    stations.find((s) => s.id !== station.id) ??
    station;
  const current = (s: Station) => {
    const index = s.points.findIndex(
      (p) => p.time === station.points[hour].time,
    );
    const p = index < 0 ? null : s.points[index];
    const mean =
      p === null
        ? null
        : recorded
          ? observedDayMean(s, index)
          : p.aqi === null
            ? null
            : p.mean24;
    return {
      p,
      mean,
      aqi: mean === null ? null : pmSubindex(mean),
      pm: p === null ? null : recorded ? p.actual : p.p50,
    };
  };
  return (
    <>
      <div className="compare-toolbar">
        <div className="segmented">
          <button
            className={recorded ? "active" : ""}
            disabled={future}
            title={
              future
                ? "There are no recorded readings for Diwali 2026 yet"
                : "Use station readings"
            }
            onClick={() => setPreferredMode("recorded")}
          >
            Recorded
          </button>
          <button
            className={!recorded ? "active" : ""}
            onClick={() => setPreferredMode("estimate")}
          >
            Estimated
          </button>
        </div>
        <div className="compare-time">
          <label htmlFor="compare-hour">Time shown · IST</label>
          <select
            id="compare-hour"
            value={hour}
            onChange={(e) => onHourChange(Number(e.target.value))}
          >
            {station.points.map((p, i) => (
              <option key={p.hour} value={i}>
                {fullDate(p.time)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <InfoNote>
        AQI below uses PM2.5 only, averaged over 24 hours. It is not the full
        official AQI.{" "}
        {future
          ? "2026 values are estimates from past Diwalis."
          : recorded
            ? "Recorded values use station readings. Missing readings are left blank."
            : "These are experimental estimates. Switch to Recorded to see station data."}
      </InfoNote>
      <div className="compare-grid">
        {[station, other].map((s, i) => {
          const data = current(s);
          const aligned = station.points.map((target) =>
            s.points.find((p) => p.time === target.time),
          );
          const available = aligned
            .map((p) => (p ? (recorded ? p.actual : p.p50) : null))
            .filter((v): v is number => v !== null);
          const first48 = aligned
            .slice(0, 48)
            .map((p) => (p ? (recorded ? p.actual : p.p50) : null))
            .filter((v): v is number => v !== null);
          return (
            <section
              className={`card compare-card ${i ? "comparison-warm" : ""}`}
              key={`${i}-${s.id}`}
              style={{
                borderTopColor:
                  data.mean === null ? "#737373" : airColor(data.mean),
              }}
            >
              <SectionLabel>{i ? "SECOND AREA" : "FIRST AREA"}</SectionLabel>
              {i ? (
                <select
                  aria-label="Second area"
                  value={other.id}
                  onChange={(e) => setSecond(e.target.value)}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h2>{s.name}</h2>
              )}
              <p className="compare-source">
                {recorded ? "From recorded PM2.5" : "Estimated from PM2.5"} ·{" "}
                {fullDate(station.points[hour].time)}
              </p>
              <div
                className="compare-number"
                style={{
                  color: data.mean === null ? "#737373" : airColor(data.mean),
                }}
              >
                {data.aqi ?? "—"}
                <span>/ 500</span>
              </div>
              <p className="compare-metric-label">24-hour AQI · PM2.5 only</p>
              <AirStatus pm={data.mean} />
              <div className="compare-row">
                <span>
                  Hourly PM2.5 · {recorded ? "recorded" : "estimated"}
                </span>
                <strong>
                  {data.pm === null
                    ? "No reading"
                    : `${Math.round(data.pm)} µg/m³`}
                </strong>
              </div>
              <div className="compare-row">
                <span>24-hour average PM2.5</span>
                <strong>
                  {data.mean === null
                    ? "Not enough readings"
                    : `${data.mean.toFixed(1)} µg/m³`}
                </strong>
              </div>
              <div className="compare-row">
                <span>Highest PM2.5 over 48 hours</span>
                <strong>
                  {first48.length
                    ? `${Math.round(Math.max(...first48))} µg/m³`
                    : "No readings"}
                </strong>
              </div>
              <div className="compare-row">
                <span>Hours above 90 µg/m³</span>
                <strong>
                  {available.filter((v) => v > 90).length} / {available.length}{" "}
                  {recorded ? "recorded hours" : "hours"}
                </strong>
              </div>
              <div className="compare-row">
                <span>
                  {future ? "Estimate period starts" : "Starting data"}
                </span>
                <strong>{fullDate(s.origin)}</strong>
              </div>
            </section>
          );
        })}
      </div>
      <section className="card">
        <CardHead
          title={recorded ? "Recorded hourly PM2.5" : "Estimated hourly PM2.5"}
          subtitle={`Solid line: ${station.name} · dashed line: ${other.name} · µg/m³`}
        />
        <ForecastChart
          points={station.points}
          comparison={station.points.map(
            (target) =>
              other.points.find((p) => p.time === target.time) ?? {
                ...target,
                p10: NaN,
                p50: NaN,
                p90: NaN,
                actual: null,
                aqi: null,
                mean24: NaN,
              },
          )}
          selected={hour}
          onSelect={onHourChange}
          historical={future}
          recorded={recorded}
        />
      </section>
      <InfoNote>
        Colours show pollution level. Dark red means Severe. The chart uses
        hourly PM2.5; the AQI cards use a 24-hour average.
      </InfoNote>
    </>
  );
}
export function ReportCardView({ registry }: { registry: Registry }) {
  const m = registry.model.metrics;
  const total = m.reduce((a, b) => a + b.n, 0),
    mae = m.reduce((a, b) => a + b.n * b.mae, 0) / total,
    coverage = m.reduce((a, b) => a + b.n * b.coverage, 0) / total;
  return (
    <>
      <section className="card table-card">
        <CardHead
          title="Errors during Diwali 2025"
          subtitle="Estimates compared with recorded PM2.5 · µg/m³. Some time periods overlap."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Observed PM2.5</th>
                <th>Readings checked</th>
                <th>Average estimate</th>
                <th>Average recorded value</th>
                <th>Average error</th>
                <th>Readings in expected range</th>
              </tr>
            </thead>
            <tbody>
              {modelAudit.results
                .filter((r) => r.snapshot === "2025-during")
                .map((r) => (
                  <tr key={r.stratum}>
                    <td>{r.stratum}</td>
                    <td>{r.n}</td>
                    <td>{r.predictedMean.toFixed(1)}</td>
                    <td>{r.observedMean.toFixed(1)}</td>
                    <td>{r.mae.toFixed(1)}</td>
                    <td>{(r.coverage * 100).toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card table-card">
        <CardHead
          title="Checks for the 2026 method"
          subtitle="For each past year, estimates used only earlier years. Some time periods overlap."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year checked</th>
                <th>Estimates checked</th>
                <th>Average error · µg/m³</th>
                <th>Last-reading error</th>
                <th>Error reduction</th>
                <th>Readings in past range</th>
              </tr>
            </thead>
            <tbody>
              {outlookBacktest.results
                .filter((r) => r.key.endsWith(":all"))
                .map((r) => (
                  <tr key={r.key}>
                    <td>{r.key.split(":")[0]}</td>
                    <td>{r.n.toLocaleString()}</td>
                    <td>{r.mae.toFixed(1)}</td>
                    <td>{r.persistenceMae.toFixed(1)}</td>
                    <td className="green-text">
                      {(r.skill * 100).toFixed(1)}%
                    </td>
                    <td>{(r.coverage * 100).toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="advice-foot">
          Each year is checked using earlier years only. Good past results do
          not guarantee good 2026 estimates. The range shows past readings, not
          guaranteed future limits.
        </div>
      </section>
      <div className="report-hero">
        <div>
          <Badge tone="green">
            <ShieldCheck size={12} />
            MODEL CHECKS
          </Badge>
          <h2>
            How accurate
            <br />
            is the <em>model?</em>
          </h2>
          <p>
            Built using data through 2023. Ranges checked in 2024. Results
            compared in 2025.
            <br />
            Errors are shown below.
          </p>
        </div>
        <div className="report-stamp">
          <span>YEAR CHECKED</span>
          <strong>2025</strong>
          <span>{(total / 1e6).toFixed(2)}M forecast pairs</span>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="AVERAGE ERROR"
          number={mae.toFixed(2)}
          unit="µg/m³"
          note="Across all forecast times"
        />
        <Metric
          label="LARGEST ERROR REDUCTION"
          number={`${(m[1].skill * 100).toFixed(1)}%`}
          note="Less error than keeping the last reading · 7–24h"
        />
        <Metric
          label="READINGS WITHIN THE RANGE"
          number={`${(coverage * 100).toFixed(1)}%`}
          note="Share of readings inside the expected range"
        />
        <Metric
          label="STATIONS USED"
          number={String(registry.model.stations)}
          note={`${(registry.model.hourlyRows / 1e6).toFixed(1)}M valid hourly readings`}
        />
      </div>
      <div className="report-charts">
        <section className="card">
          <CardHead
            title="Model versus the last reading"
            subtitle="Average error · µg/m³ · lower is better"
          />
          <div className="bar-legend">
            <span>
              <i style={{ background: "#496c53" }} />
              Our model
            </span>
            <span>
              <i style={{ background: "#ddd9c9" }} />
              Keep the last reading
            </span>
          </div>
          <div className="metric-bars">
            {m.map((x) => (
              <div key={x.bucket}>
                <span>{x.bucket}h</span>
                <div>
                  <div
                    style={{
                      width: `${(x.mae / 30) * 100}%`,
                      background: "#496c53",
                    }}
                  >
                    <b>{x.mae.toFixed(1)}</b>
                  </div>
                  <div
                    style={{
                      width: `${(x.persistenceMae / 30) * 100}%`,
                      background: "#ddd9c9",
                    }}
                  >
                    <b>{x.persistenceMae.toFixed(1)}</b>
                  </div>
                </div>
                <strong>
                  {(x.skill * 100).toFixed(1)}%<small>improvement</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section className="card calibration-card">
          <CardHead
            title="How often was the range right?"
            subtitle="Target: 80%. Result: 82.7%."
          />
          <div className="coverage-dots">
            {Array.from({ length: 100 }, (_, i) => (
              <span className={i < 83 ? "covered" : ""} key={i} />
            ))}
          </div>
          <p>About 83 out of 100 readings fell inside the expected range.</p>
          <Badge tone="green">
            <Check size={12} />
            Checked against recorded readings
          </Badge>
        </section>
      </div>
      <section className="card table-card">
        <CardHead
          title="Errors by forecast time"
          subtitle="All India · all seasons · checked against 2025 readings"
        >
          <a
            className="secondary-button"
            href="/api/v1/report-card"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={14} />
            Open JSON
          </a>
        </CardHead>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hours ahead</th>
                <th>Average error</th>
                <th>Large-error score</th>
                <th>Over/under estimate</th>
                <th>Last-reading error</th>
                <th>Error reduction</th>
                <th>Readings in range</th>
                <th>Estimates checked</th>
              </tr>
            </thead>
            <tbody>
              {m.map((x) => (
                <tr key={x.bucket}>
                  <td>
                    <strong>{x.bucket} hours</strong>
                  </td>
                  <td>{x.mae.toFixed(2)}</td>
                  <td>{x.rmse.toFixed(2)}</td>
                  <td>+{x.bias.toFixed(2)}</td>
                  <td>{x.persistenceMae.toFixed(2)}</td>
                  <td className="green-text">{(x.skill * 100).toFixed(2)}%</td>
                  <td>{(x.coverage * 100).toFixed(2)}%</td>
                  <td>{x.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card honest-card">
        <SectionLabel>KNOWN PROBLEMS</SectionLabel>
        <div>
          <article>
            <span>01</span>
            <h3>High pollution is often missed</h3>
            <p>
              Some errors are large, especially when pollution is very high.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Delhi needs separate checks</h3>
            <p>
              National results can hide local errors. The Diwali checks above
              show poor results at high pollution levels.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Areas without stations need checks</h3>
            <p>
              Areas between stations are estimated from nearby readings. Their
              accuracy has not been checked yet.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
function Metric({
  label,
  number,
  unit,
  note,
}: {
  label: string;
  number: string;
  unit?: string;
  note: string;
}) {
  return (
    <div className="metric-card">
      <SectionLabel>{label}</SectionLabel>
      <strong>
        {number}
        <small>{unit}</small>
      </strong>
      <span>{note}</span>
    </div>
  );
}
export function AuthorityView({
  snapshot,
  notify,
}: {
  snapshot: Snapshot;
  notify: (s: string) => void;
}) {
  const [units, setUnits] = useState(3),
    [tab, setTab] = useState("priority");
  const ranked = useMemo(
    () =>
      snapshot.stations
        .map((s) => ({
          ...s,
          peak: peak(s.points),
          hours: s.points.filter((p) => p.p50 > 90).length,
        }))
        .sort((a, b) => b.peak.p50 - a.peak.p50),
    [snapshot],
  );
  function exportPlan() {
    download(
      "shwasa-planning-worksheet.csv",
      [
        "rank,station,h3,modelled_peak_pm25,peak_time,hours_above_90,notes",
        ...ranked
          .slice(0, units)
          .map((s, i) =>
            [
              i + 1,
              s.id,
              s.h3,
              s.peak.p50.toFixed(2),
              s.peak.time,
              s.hours,
              "Advisory worksheet; no dispatch action",
            ].join(","),
          ),
      ].join("\n"),
    );
    notify("Planning worksheet downloaded.");
  }
  return (
    <>
      <div className="authority-banner">
        <div className="authority-emblem">
          <Users size={26} />
        </div>
        <div>
          <SectionLabel>CITY PLANNING</SectionLabel>
          <h2>Areas with high pollution estimates</h2>
          <p>
            View and download a list of areas to check. This page does not send
            teams.
          </p>
        </div>
        <Badge tone="green">Planning preview</Badge>
      </div>
      <div className="authority-toolbar">
        <div className="segmented">
          <button
            className={tab === "priority" ? "active" : ""}
            onClick={() => setTab("priority")}
          >
            Areas to check
          </button>
          <button
            className={tab === "planner" ? "active" : ""}
            onClick={() => setTab("planner")}
          >
            Team shortlist
          </button>
        </div>
        <div>
          <button className="secondary-button" onClick={() => window.print()}>
            <Download size={14} />
            Print briefing
          </button>
          <a
            className="primary-button"
            href={`/api/v1/export?snapshot=${snapshot.id}`}
          >
            <Download size={14} />
            Export forecast CSV
          </a>
        </div>
      </div>
      {tab === "planner" && (
        <section className="card planner-card">
          <div>
            <SectionLabel>PLANNING ONLY</SectionLabel>
            <h2>Choose how many areas to check</h2>
            <p>
              Choose the number of teams. The list ranks areas by estimated
              pollution, without travel times or population data.
            </p>
          </div>
          <div>
            <label htmlFor="teams">Monitoring teams</label>
            <input
              id="teams"
              type="number"
              min="1"
              max="20"
              value={units}
              onChange={(e) =>
                setUnits(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
              }
            />
            <button className="primary-button" onClick={exportPlan}>
              Download worksheet
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
      )}
      <section className="card table-card">
        <CardHead
          title={
            tab === "planner"
              ? `${units} places to review first`
              : "Areas ranked by estimated pollution"
          }
          subtitle="Highest estimated PM2.5 over 48 hours"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Area</th>
                <th>Peak PM2.5</th>
                <th>Peak time · IST</th>
                <th>Hours &gt;90</th>
                <th>Evidence</th>
                <th>Suggested next step</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, tab === "planner" ? units : 30).map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <span className={`rank ${i < 3 ? "top-rank" : ""}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <strong>{s.name}</strong>
                    <small className="table-sub">{s.h3}</small>
                  </td>
                  <td>
                    <strong style={{ color: airColor(s.peak.p50) }}>
                      {Math.round(s.peak.p50)} <small>µg/m³</small>
                    </strong>
                  </td>
                  <td>
                    {dateLabel(s.peak.time)}, {hourLabel(s.peak.time)}
                  </td>
                  <td>{s.hours} / 72h</td>
                  <td>
                    <Badge>Station data</Badge>
                  </td>
                  <td>
                    {s.peak.p50 > 250
                      ? "Review official advisories"
                      : "Verify local readings"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <InfoNote>
        These are station areas, not ward rankings. Use the list to plan checks.
        It does not send teams or estimate the benefits of their work.
      </InfoNote>
    </>
  );
}
export function CommunityView({
  station,
  notify,
}: {
  station: Station;
  notify: (s: string) => void;
}) {
  const [kind, setKind] = useState("haze"),
    [busy, setBusy] = useState(false),
    [reports, setReports] = useState<{ kind: string; count: number }[]>([]),
    [pledges, setPledges] = useState(0),
    [pledged, setPledged] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/reports?h3=${station.h3}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setReports(d.reports ?? []);
          setPledges(d.pledges ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [station.h3]);
  async function submit(type: "reports" | "pledge") {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ h3: station.h3, kind }),
      });
      const d = await res.json();
      if (!res.ok) throw Error(d.error ?? "Unable to save right now.");
      if (type === "pledge") {
        setPledged(true);
        if (!d.duplicate) setPledges((p) => p + 1);
        notify(
          d.duplicate
            ? "Your pledge is already counted. Thank you."
            : "Your clean Diwali pledge is recorded.",
        );
      } else {
        setSent(true);
        setReports((r) => {
          const existing = r.find((v) => v.kind === kind);
          return existing
            ? r.map((v) => (v.kind === kind ? { ...v, count: v.count + 1 } : v))
            : [...r, { kind, count: 1 }];
        });
        notify(
          "Report recorded as citizen evidence. It does not change the forecast.",
        );
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="community-grid">
        <section className="card report-form">
          <span className="large-icon">
            <MapPin size={26} />
          </span>
          <SectionLabel>REPORT AN OBSERVATION</SectionLabel>
          <h2>Report smoke or dust</h2>
          <p>
            Share an observation for {station.name}. Only the H3 cell is
            submitted, never an exact location or photo.
          </p>
          <div className="report-options">
            {[
              { id: "haze", name: "Heavy haze", icon: CloudFog },
              { id: "smoke", name: "Smoke in the air", icon: Wind },
              { id: "burning", name: "Visible burning", icon: Flame },
              { id: "dust", name: "Dust nearby", icon: TrafficCone },
            ].map((item) => (
              <button
                className={kind === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => {
                  setKind(item.id);
                  setSent(false);
                }}
              >
                <item.icon size={23} />
                <span>{item.name}</span>
                {kind === item.id && <Check size={14} />}
              </button>
            ))}
          </div>
          <InfoNote>
            Report only what you see now. Your report stays separate from the
            forecast.
          </InfoNote>
          <button
            className="primary-button full"
            disabled={busy || sent}
            onClick={() => submit("reports")}
          >
            {sent ? (
              <>
                <Check size={16} />
                Observation recorded
              </>
            ) : busy ? (
              "Saving…"
            ) : (
              <>
                Share observation
                <ArrowUpRight size={16} />
              </>
            )}
          </button>
          <small className="form-fine">
            One report per browser per hour. This is not an emergency service.
          </small>
        </section>
        <section className="pledge-card">
          <div className="pledge-leaf">
            <Leaf size={56} strokeWidth={1} />
            <span />
          </div>
          <SectionLabel>CLEAN DIWALI PLEDGE</SectionLabel>
          <h2>
            Celebrate with
            <br />
            <em>less smoke</em>
          </h2>
          <p>
            I will celebrate with less smoke, share reliable air-quality
            information and help my neighbors.
          </p>
          <button
            className="primary-button full"
            disabled={pledged || busy}
            onClick={() => submit("pledge")}
          >
            {pledged ? (
              <>
                <Check size={16} />
                You’re part of it
              </>
            ) : (
              <>
                Take the clean Diwali pledge
                <Heart size={16} />
              </>
            )}
          </button>
          <div className="pledge-count">
            <strong>{pledges.toLocaleString()}</strong>
            <span>
              {pledges === 1 ? "pledge" : "pledges"} recorded on this server
            </span>
          </div>
        </section>
      </div>
      <section className="card">
        <CardHead
          title="Recent reports"
          subtitle={`${station.name} · last 24 hours · CITIZEN evidence`}
        />
        <div className="community-stats">
          {["haze", "smoke", "burning", "dust"].map((k) => {
            const count = reports.find((r) => r.kind === k)?.count ?? 0;
            return (
              <div key={k}>
                <span>{k}</span>
                <strong>{count}</strong>
                <Badge tone={count >= 3 ? "green" : "neutral"}>
                  {count >= 3
                    ? "3+ browser reports · not verified"
                    : "Not verified"}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className="advice-foot">
          Reports are saved on this server. They do not change the forecast and
          have not been independently verified.
        </div>
      </section>
    </>
  );
}
export function AboutView({ registry }: { registry: Registry }) {
  return (
    <>
      <section className="about-hero">
        <SectionLabel>HOW IT WORKS</SectionLabel>
        <h2>
          How we make
          <br />
          <em>estimates</em>
        </h2>
        <p>
          We use past pollution readings to estimate air quality. Here are the
          methods, data sources and limits.
        </p>
      </section>
      <div className="method-flow">
        {[
          {
            n: "01",
            title: "Collect data",
            text: "Recorded pollution, weather, fire reports and traffic estimates.",
          },
          {
            n: "02",
            title: "Build the model",
            text: "Use data through 2023 to learn how pollution changes.",
          },
          {
            n: "03",
            title: "Estimate a range",
            text: "Use errors from 2024 to set a range around each prediction.",
          },
          {
            n: "04",
            title: "Check the results",
            text: "Compare estimates with 2025 readings and a simple last-reading estimate.",
          },
        ].map((s) => (
          <article key={s.n}>
            <span>{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <ArrowRight size={18} />
          </article>
        ))}
      </div>
      <div className="method-grid">
        <section className="card prose">
          <SectionLabel>THE FIRST MODEL</SectionLabel>
          <h2>
            How the model
            <br />
            uses data
          </h2>
          <p>
            The model learns how much each input affects the estimate. It
            combines those values to predict PM2.5.
          </p>

          <p>
            Four models cover up to 72 hours. They use recent pollution,
            weather, fire reports, traffic estimates, location and time. Missing
            data is marked as missing, not zero.
          </p>
          <p>
            The line shows the estimate. The shaded range is based on earlier
            errors. Future readings can fall outside it.
          </p>
          <p>
            Each map area uses the three nearest stations. Closer stations have
            more influence. We have not yet checked accuracy between stations.
          </p>
          <a
            href="/api/v1/report-card"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            View the results data
            <ArrowUpRight size={14} />
          </a>
        </section>
        <section className="card prose model-details">
          <SectionLabel>MODEL DETAILS</SectionLabel>
          <h2>Model details</h2>
          <dl>
            <div>
              <dt>Version</dt>
              <dd>{registry.model.version}</dd>
            </div>
            <div>
              <dt>Trained</dt>
              <dd>{dateLabel(registry.model.trainedAt, true)}</dd>
            </div>
            <div>
              <dt>Training examples</dt>
              <dd>{registry.model.trainingPairs.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Estimates checked</dt>
              <dd>{registry.model.testPairs.toLocaleString()}</dd>
            </div>
            <div>
              <dt>What it predicts</dt>
              <dd>PM2.5 · µg/m³</dd>
            </div>
            <div>
              <dt>Area covered</dt>
              <dd>Monitoring stations across India</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge tone="orange">Still being checked</Badge>
              </dd>
            </div>
          </dl>
          <InfoNote>
            The model used data through 2023. Ranges were checked in 2024 and
            results in 2025. New versions need new checks.
          </InfoNote>
        </section>
      </div>
      <section className="card sources-card">
        <CardHead title="Data sources" subtitle="What each source provides." />
        <div className="source-grid">
          {[
            {
              name: "CPCB",
              type: "MEASURED",
              text: "Recorded PM2.5 from official stations. Each hourly average needs at least three valid readings.",
              url: "https://app.cpcbccr.com/ccr",
            },
            {
              name: "Open-Meteo / ERA5",
              type: "REANALYSIS",
              text: "Past temperature, humidity and wind. These are not forecasts of future weather.",
              url: "https://open-meteo.com/en/docs/historical-weather-api",
            },
            {
              name: "NASA FIRMS",
              type: "SATELLITE-DERIVED",
              text: "Satellite fire reports. These show fire activity, not the amount of smoke in an area.",
              url: "https://firms.modaps.eosdis.nasa.gov/",
            },
            {
              name: "Historical traffic",
              type: "GENERATED PROXY",
              text: "Generated traffic estimates, not recorded vehicle counts or emissions.",
              url: null,
            },
          ].map((s) => (
            <article key={s.name}>
              <Database size={21} />
              <h3>{s.name}</h3>
              <Badge>{s.type}</Badge>
              <p>{s.text}</p>
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer">
                  Source
                  <ExternalLink size={12} />
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
      <div className="method-grid">
        <section className="card prose">
          <SectionLabel>AQI AND PM2.5</SectionLabel>
          <h2>AQI is not the same as PM2.5</h2>
          <p>
            The main card shows an AQI estimate based only on PM2.5 over 24
            hours. Hourly PM2.5 is shown separately in µg/m³. Official AQI also
            uses other pollutants, so our estimate is not an official AQI
            reading.
          </p>
          <a
            className="text-link"
            href="https://ies.gov.in/arthapedia/concept/national-air-quality-index"
            target="_blank"
            rel="noreferrer"
          >
            Indian National AQI reference
            <ExternalLink size={12} />
          </a>
        </section>
        <section className="card prose">
          <SectionLabel>HEALTH ADVICE</SectionLabel>
          <h2>Lower pollution does not mean safe air</h2>
          <p>
            Suggested times have lower estimated pollution, not guaranteed safe
            air. Follow official advice and your doctor’s guidance.
          </p>
          <a
            className="text-link"
            href="https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication"
            target="_blank"
            rel="noreferrer"
          >
            WHO exposure guidance
            <ExternalLink size={12} />
          </a>
        </section>
      </div>
      <InfoNote>
        This website does not replace official air-quality or medical advice.
        Local accuracy and the effects of pollution controls still need
        checking.
      </InfoNote>
    </>
  );
}
export function StatusView({
  snapshot,
  registry,
}: {
  snapshot: Snapshot;
  registry: Registry;
}) {
  const weather = snapshot.stations.filter((s) => !s.weather.missing).length,
    traffic = snapshot.stations.filter((s) => !s.input.trafficMissing).length,
    fire = snapshot.stations.filter((s) => !s.input.fireMissing).length;
  return (
    <>
      <div className="status-banner">
        <span className="status-ring">
          <Database size={27} />
        </span>
        <div>
          <SectionLabel>DATA STATUS</SectionLabel>
          <h2>
            {snapshot.kind === "outlook"
              ? "2026 estimates are ready. Live data is not connected."
              : "Past data is available. Live data is not connected."}
          </h2>
          <p>Charts use saved data, not live readings.</p>
        </div>
        <Badge tone="orange">Saved data</Badge>
      </div>
      <div className="metric-grid">
        <Metric
          label="AREAS WITH STATIONS"
          number={String(snapshot.stations.length)}
          note="Areas with usable past pollution readings"
        />
        <Metric
          label="WEATHER DATA"
          number={`${Math.round((weather / snapshot.stations.length) * 100)}%`}
          note={`${weather} areas with past weather data`}
        />
        <Metric
          label="TRAFFIC ESTIMATES"
          number={`${Math.round((traffic / snapshot.stations.length) * 100)}%`}
          note={`${traffic} areas with traffic estimates`}
        />
        <Metric
          label="FIRE DATA"
          number={`${Math.round((fire / snapshot.stations.length) * 100)}%`}
          note="Earlier satellite fire reports"
        />
      </div>
      <section className="card table-card">
        <CardHead
          title="Available data"
          subtitle={`Data: ${snapshot.id} · saved ${fullDate(snapshot.generatedAt)}`}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Used for</th>
                <th>Mode</th>
                <th>Readings in range</th>
                <th>Live status</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "CPCB station files",
                  "Past pollution readings",
                  "MEASURED",
                  `${snapshot.stations.length} places`,
                ],
                [
                  "Open-Meteo archive",
                  "Past weather",
                  "REANALYSIS",
                  `${weather} places`,
                ],
                [
                  "NASA FIRMS",
                  "Earlier fire reports",
                  "SATELLITE-DERIVED",
                  `${fire} places`,
                ],
                [
                  "Historical traffic",
                  "Traffic estimates",
                  "GENERATED PROXY",
                  `${traffic} places`,
                ],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>
                    <strong>{r[0]}</strong>
                  </td>
                  <td>{r[1]}</td>
                  <td>
                    <Badge>{r[2]}</Badge>
                  </td>
                  <td>{r[3]}</td>
                  <td>
                    <span className="status-label">
                      <i />
                      Not connected
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="method-grid">
        <section className="card prose">
          <SectionLabel>MODEL STATUS</SectionLabel>
          <h2>The model is still being checked</h2>
          <p>
            Version: {registry.model.version}. It has been checked against past
            readings but still misses high pollution levels. Live error checks
            and automatic model changes are not available yet.
          </p>
          <p>
            Missing data is marked clearly. If a page cannot load new data, the
            last selected data stays visible.
          </p>
          <a
            className="text-link"
            href="/api/v1/status"
            target="_blank"
            rel="noreferrer"
          >
            View data status
            <ArrowUpRight size={14} />
          </a>
        </section>
        <section className="card prose">
          <SectionLabel>SAVED DATA</SectionLabel>
          <h2>Where your settings are saved</h2>
          <p>
            Reports and pledges are saved on this server. Settings and saved
            examples stay in your browser. Email alerts and officer accounts are
            not available yet.
          </p>
          <p>
            Pages need an internet connection. If map tiles cannot load, a
            simple map is shown.
          </p>
          <a
            className="text-link"
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
          >
            View available data links
            <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
    </>
  );
}

export function OutlookEvidence({
  station,
  hour,
}: {
  snapshot: Snapshot;
  station: Station;
  hour: number;
}) {
  const point = station.points[hour];
  return (
    <>
      <section className="about-hero">
        <SectionLabel>2026 ESTIMATE METHOD</SectionLabel>
        <h2>
          How we estimate
          <br />
          <em>Diwali 2026</em>
        </h2>
        <p>
          For each hour, we compare the same station’s readings from at least
          three past Diwalis. The middle reading is the estimate.
        </p>
      </section>
      <div className="metric-grid">
        <Metric
          label="ESTIMATED PM2.5"
          number={Math.round(point.p50).toString()}
          unit="µg/m³"
          note={`${dateLabel(point.time)}, ${hourLabel(point.time)} IST`}
        />
        <Metric
          label="RANGE IN PAST YEARS"
          number={`${Math.round(point.p10)}–${Math.round(point.p90)}`}
          note="Future values may be outside this range."
        />
        <Metric
          label="PAST DIWALIS USED"
          number={String(station.outlook?.sourceYears.length ?? 0)}
          note={station.outlook?.sourceYears.join(", ") ?? ""}
        />
        <Metric
          label="MINIMUM YEARS PER HOUR"
          number={String(station.outlook?.minimumHourlySamples ?? 0)}
          note="Same station and time relative to Diwali"
        />
      </div>
      <section className="card prose">
        <SectionLabel>LIMITS</SectionLabel>
        <h2>These are estimates, not future readings</h2>
        <p>
          The 2026 estimate uses past Diwali readings only. It does not include
          future weather or pollution measurements.
        </p>
        <p>
          AQI uses 24 hours of estimated PM2.5. The 2026 method uses past
          readings only. It cannot show the effects of changes to traffic or
          wind.
        </p>
        <p>
          Years used: {station.outlook?.sourceYears.join(", ")}. Latest recorded
          reading:{" "}
          {station.outlook
            ? fullDate(station.outlook.latestObservedAt)
            : "unavailable"}
          ; this is not a Diwali-night reading.
        </p>
        <a className="text-link" href="/report-card">
          See checks against past years <ArrowUpRight size={14} />
        </a>
      </section>
    </>
  );
}
