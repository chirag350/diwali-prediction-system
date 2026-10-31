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
  categories,
  clearBy,
  dateLabel,
  download,
  fullDate,
  hourLabel,
  level,
  peak,
} from "../lib/air";
import modelJson from "../models/national-v1.json";
import outlookBacktest from "../data/bundled/outlook-backtest.json";
import modelAudit from "../data/bundled/model-audit.json";
import { predict, type Artifact } from "../training/model";
import { ForecastChart } from "./forecast-chart";
import { Badge, CardHead, InfoNote, SectionLabel } from "./ui";
const AirMap = dynamic(() => import("./air-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparing the scenario map…</div>,
});
const model = modelJson as Artifact;
function groups(station: Station, hour: number) {
  const result = predict(model, { ...station.input, horizon: hour + 1 });
  const groups: Record<string, number> = {
    "Baseline & location": 0,
    "Recent pollution": 0,
    "Weather & wind": 0,
    "Regional fires": 0,
    "Traffic proxy": 0,
    "Time & festival": 0,
  };
  for (const [name, v] of Object.entries(result.contributions)) {
    const key = ["intercept", "latitude", "longitude"].includes(name)
      ? "Baseline & location"
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
    groups[key] += v;
  }
  return { result, groups };
}
export function WhyView({ station, hour }: { station: Station; hour: number }) {
  const data = groups(station, hour),
    max = Math.max(...Object.values(data.groups).map(Math.abs));
  const descriptions: Record<string, string> = {
    "Baseline & location":
      "The shared regression intercept and geographical features.",
    "Recent pollution":
      "The current reading, yesterday’s reading, and trailing-day average.",
    "Weather & wind": station.weather.missing
      ? "Weather defaults are active; the missing-data indicator also contributes."
      : "Origin temperature, humidity and the speed and direction of wind.",
    "Regional fires": station.input.fireMissing
      ? "No fire total for this date. A missing-data feature is active."
      : "A delayed, regional satellite fire-activity proxy, not local smoke measurements.",
    "Traffic proxy": station.input.trafficMissing
      ? "No matched corridor. The missing-data indicator contributes."
      : "A generated historical corridor-traffic proxy, not measured emissions.",
    "Time & festival":
      "The forecast hour, season, horizon and Diwali proximity.",
  };
  return (
    <>
      <div className="why-intro">
        <div>
          <SectionLabel>OPEN THE MODEL</SectionLabel>
          <h2>
            Every number has
            <br />
            <em>a few things behind it.</em>
          </h2>
          <p>
            For {station.name}, {dateLabel(station.points[hour].time)} at{" "}
            {hourLabel(station.points[hour].time)}. These contributions add up
            to the prediction.
          </p>
        </div>
        <div className="why-total">
          <Wind size={25} />
          <strong>
            {Math.round(data.result.p50)}
            <span> µg/m³</span>
          </strong>
          <Badge tone="green">MODELLED</Badge>
        </div>
      </div>
      <div className="why-grid">
        <section className="card">
          <CardHead
            title="The forecast, taken apart."
            subtitle="Exact additive regression contributions · µg/m³"
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
                Nonnegative clipping adjustment:{" "}
                {data.result.clippingAdjustment.toFixed(1)}
              </p>
            )}
          </div>
          <div className="contribution-sum">
            <span>Sum of contributions</span>
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
        These explain how the regression calculates its answer. They do not
        measure the fraction of pollution caused by crackers, traffic, or fires.
        Correlated inputs are not causal evidence.
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
  const values = useMemo(
    () =>
      Object.fromEntries(
        snapshot.stations.map((s) => [
          s.id,
          modified(s, traffic, wind)[hour].p50,
        ]),
      ),
    [snapshot.stations, traffic, wind, hour],
  );
  return (
    <>
      <InfoNote>
        Scenario estimate, not a forecast. We change inputs to the fitted
        regression, keeping other inputs fixed. This does not establish an
        intervention’s real-world effect. Bands are heuristically widened by
        20%.
      </InfoNote>
      <div className="lab-grid">
        <section className="card lab-controls">
          <CardHead
            title="A different set of possibilities."
            subtitle="Start with the conditions you can explore."
          />
          <div className="slider-control">
            <div>
              <TrafficCone size={20} />
              <strong>Traffic proxy</strong>
              <span>
                {traffic > 0 ? "+" : ""}
                {traffic}%
              </span>
            </div>
            <p>Change the generated traffic-volume input.</p>
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
                No matched traffic corridor for this place. Choose Anand Vihar
                or another covered station.
              </small>
            )}
          </div>
          <div className="slider-control">
            <div>
              <Wind size={20} />
              <strong>Ventilation</strong>
              <span>{wind.toFixed(2)}×</span>
            </div>
            <p>Scale the origin wind-speed input.</p>
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
                Origin weather is missing; this control is unavailable.
              </small>
            )}
          </div>
          <div className="unavailable-control">
            <Flame size={19} />
            <div>
              <strong>Crackers, dust & sprinkling</strong>
              <p>
                The baseline has no independently validated causal controls for
                these drivers.
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
              <SectionLabel>BASELINE PEAK</SectionLabel>
              <strong>
                {Math.round(original.p50)}
                <small> µg/m³</small>
              </strong>
            </div>
            <div>
              <SectionLabel>SCENARIO PEAK</SectionLabel>
              <strong>
                {Math.round(changed.p50)}
                <small> µg/m³</small>
              </strong>
            </div>
            <div>
              <SectionLabel>ESTIMATED CHANGE</SectionLabel>
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
              title="The same place. A different input."
              subtitle={`${station.name} · green: baseline · orange: scenario`}
            />
            <ForecastChart points={station.points} comparison={points} />
          </section>
          <div className="scenario-details">
            <span>
              <Sun size={16} />
              Scenario clear-by:{" "}
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
          title="See the change across the city."
          subtitle="The same input adjustments applied to each station, then interpolated to H3 cells."
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
}: {
  stations: Station[];
  station: Station;
}) {
  const [second, setSecond] = useState(
    stations.find((s) => s.id !== station.id)?.id ?? station.id,
  );
  const other = stations.find((s) => s.id === second) ?? stations[0];
  const firstPeak = peak(station.points),
    secondPeak = peak(other.points);
  return (
    <>
      <div className="compare-grid">
        {[station, other].map((s, i) => (
          <section
            className={`card compare-card ${i ? "comparison-warm" : ""}`}
            key={`${i}-${s.id}`}
          >
            <SectionLabel>
              {i ? "THE OTHER SIDE OF TOWN" : "YOUR SELECTED PLACE"}
            </SectionLabel>
            {i ? (
              <select
                aria-label="Second neighborhood"
                value={second}
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
            <div className="compare-number">
              {Math.round(s.points[0].p50)}
              <span>µg/m³ · +1h</span>
            </div>
            <Badge tone={i ? "orange" : "green"}>
              {categories[level(s.points[0].mean24)]} · 24h PM2.5 band
            </Badge>
            <div className="compare-row">
              <span>48h peak</span>
              <strong>{Math.round(peak(s.points).p50)} µg/m³</strong>
            </div>
            <div className="compare-row">
              <span>Hours above 90 µg/m³</span>
              <strong>{s.points.filter((p) => p.p50 > 90).length} / 72h</strong>
            </div>
            <div className="compare-row">
              <span>Origin</span>
              <strong>{fullDate(s.origin)}</strong>
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <CardHead
          title="Their next three days, together."
          subtitle={`Green: ${station.name} · Orange: ${other.name}`}
        />
        <ForecastChart
          points={station.points}
          comparison={other.points}
          historical={!!station.outlook}
        />
      </section>
      <InfoNote>
        {firstPeak.p50 >= secondPeak.p50 ? station.name : other.name} has the
        higher modelled peak by{" "}
        {Math.round(Math.abs(firstPeak.p50 - secondPeak.p50))} µg/m³. This is a
        comparison of archived model predictions, not a measured neighborhood
        ranking.
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
      <div className="error-banner" role="status">
        <span>
          <strong>Model recheck: peak forecasts are unreliable.</strong> The v1
          horizon sampler is biased by time of day. Below are historical
          national metrics, not validation of Delhi Diwali peaks.
        </span>
      </div>
      <section className="card table-card">
        <CardHead
          title="What the Diwali recheck found"
          subtitle="2025 burst replay · measured targets, in µg/m³ · overlapping replay pairs"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Observed PM2.5</th>
                <th>Pairs</th>
                <th>Mean prediction</th>
                <th>Mean measured</th>
                <th>MAE</th>
                <th>80% band coverage</th>
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
          title="The 2026 outlook has its own test."
          subtitle="Historical-analog member · rolling prior-year-only backtests · overlapping phase windows"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Target festival</th>
                <th>Forecast pairs</th>
                <th>MAE · µg/m³</th>
                <th>Persistence MAE</th>
                <th>MAE improvement</th>
                <th>Historical spread coverage</th>
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
          No target year is used in its own analog set. These are retrospective
          checks, not a guarantee for 2026. The band is empirical historical
          spread and is not calibrated to 80% coverage.
        </div>
      </section>
      <div className="report-hero">
        <div>
          <Badge tone="green">
            <ShieldCheck size={12} />
            ON THE RECORD
          </Badge>
          <h2>
            Useful is something
            <br />
            we have to <em>prove.</em>
          </h2>
          <p>
            Train through 2023. Calibrate on 2024. Test on 2025.
            <br />
            No random splits. No invented accuracy percentage.
          </p>
        </div>
        <div className="report-stamp">
          <span>HELD-OUT TEST</span>
          <strong>2025</strong>
          <span>{(total / 1e6).toFixed(2)}M forecast pairs</span>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="MEAN ABSOLUTE ERROR"
          number={mae.toFixed(2)}
          unit="µg/m³"
          note="Across all forecast horizons"
        />
        <Metric
          label="BEST BUCKET SKILL"
          number={`${(m[1].skill * 100).toFixed(1)}%`}
          note="Lower MAE than persistence · 7–24h"
        />
        <Metric
          label="80% BAND COVERAGE"
          number={`${(coverage * 100).toFixed(1)}%`}
          note="Actual observations inside the band"
        />
        <Metric
          label="TRAINING NETWORK"
          number={String(registry.model.stations)}
          note={`${(registry.model.hourlyRows / 1e6).toFixed(1)}M valid hourly readings`}
        />
      </div>
      <div className="report-charts">
        <section className="card">
          <CardHead
            title="A little better than ‘same as now’."
            subtitle="MAE in µg/m³ · lower is better"
          />
          <div className="bar-legend">
            <span>
              <i style={{ background: "#496c53" }} />
              Custom ridge model
            </span>
            <span>
              <i style={{ background: "#ddd9c9" }} />
              Persistence baseline
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
            title="Leaving room for uncertainty."
            subtitle="Expected 80%. Observed 82.7%."
          />
          <div className="coverage-dots">
            {Array.from({ length: 100 }, (_, i) => (
              <span className={i < 83 ? "covered" : ""} key={i} />
            ))}
          </div>
          <p>
            About 83 in 100 observations fell within our prediction band.
            Coverage is within our initial 75–85% evaluation target.
          </p>
          <Badge tone="green">
            <Check size={12} />
            Measured on held-out data
          </Badge>
        </section>
      </div>
      <section className="card table-card">
        <CardHead
          title="Every horizon, in full."
          subtitle="National · all seasons · retrospective 2025 evaluation"
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
                <th>Forecast horizon</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>Bias</th>
                <th>Baseline MAE</th>
                <th>Skill</th>
                <th>Coverage</th>
                <th>Test pairs</th>
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
        <SectionLabel>WHERE WE NEED TO DO BETTER</SectionLabel>
        <div>
          <article>
            <span>01</span>
            <h3>Peaks are harder.</h3>
            <p>
              RMSE is considerably larger than MAE. Large misses still matter,
              especially during severe episodes.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>A national average isn’t Delhi.</h3>
            <p>
              Festival-only, city-specific and high-pollution metrics remain to
              be evaluated. These figures do not prove Diwali peak skill.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Streets need their own test.</h3>
            <p>
              The map uses inverse-distance interpolation. Station-held-out
              spatial tests are needed before neighborhood accuracy claims.
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
          <SectionLabel>INFORMATION BEFORE ACTION</SectionLabel>
          <h2>A shared view of what needs attention.</h2>
          <p>
            Public, read-only monitoring priorities. Operational dispatch and
            officer sign-in are not configured.
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
            Monitoring priorities
          </button>
          <button
            className={tab === "planner" ? "active" : ""}
            onClick={() => setTab("planner")}
          >
            Planning worksheet
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
            <SectionLabel>ADVISORY, NOT A DISPATCH</SectionLabel>
            <h2>Where would you start?</h2>
            <p>
              Choose the number of monitoring teams to shortlist the highest
              predicted station peaks. No population, intervention
              effectiveness, or route optimization is assumed.
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
              : "Places to keep an eye on."
          }
          subtitle="Ranked by the highest modelled PM2.5 in the first 48 forecast hours"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Monitored place</th>
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
                    <Badge>Station inputs</Badge>
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
        These are monitored places, not administrative ward roll-ups. Forecast
        ranks are not population-weighted benefits. This view supports awareness
        and verification; it does not issue instructions or enforcement actions.
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
          <SectionLabel>WHAT ARE YOU NOTICING?</SectionLabel>
          <h2>You’re closer to the street.</h2>
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
            This observation is for now, not the replay date. Citizen reports
            remain separate from the archived forecast. Please report only what
            you actually observe.
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
            One report per browser per hour. Browser identifiers do not prove
            independent people. No emergency response is provided.
          </small>
        </section>
        <section className="pledge-card">
          <div className="pledge-leaf">
            <Leaf size={56} strokeWidth={1} />
            <span />
          </div>
          <SectionLabel>CELEBRATE A LITTLE LIGHTER</SectionLabel>
          <h2>
            More light.
            <br />
            <em>Less smoke.</em>
          </h2>
          <p>
            I’ll choose celebrations with fewer emissions, share credible
            air-quality information, and look out for my neighbors.
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
          title="What neighbors have shared."
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
                  {count >= 3 ? "3+ browser reports" : "Unconfirmed"}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className="advice-foot">
          Stored on this local server. Model influence is disabled. A production
          database, stronger abuse controls and independent confirmation are
          required before nowcasting integration.
        </div>
      </section>
    </>
  );
}
export function AboutView({ registry }: { registry: Registry }) {
  return (
    <>
      <section className="about-hero">
        <SectionLabel>THE SHWĀSA FIELD NOTES · MODEL 01</SectionLabel>
        <h2>
          A forecast you can
          <br />
          <em>look inside.</em>
        </h2>
        <p>
          We believe a useful forecast should show its work. Here is what we
          trained, what the map means, and where the evidence ends.
        </p>
      </section>
      <div className="method-flow">
        {[
          {
            n: "01",
            title: "Read the air",
            text: "Observed CPCB PM2.5, weather, delayed fire activity and traffic proxies.",
          },
          {
            n: "02",
            title: "Learn the pattern",
            text: "Four ridge models, fitted on historical observations through 2023.",
          },
          {
            n: "03",
            title: "Leave room for error",
            text: "2024 residuals set nominal 80% prediction intervals by horizon.",
          },
          {
            n: "04",
            title: "Test, then share",
            text: "Untouched 2025 predictions compared with measurements and persistence.",
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
          <SectionLabel>WHAT’S UNDER THE HOOD</SectionLabel>
          <h2>
            Simple enough to explain.
            <br />
            Useful enough to test.
          </h2>
          <p>
            The custom model is regularized linear regression. Each feature
            contributes its value multiplied by a learned weight. The weights
            minimize squared prediction error plus a penalty on large
            coefficients.
          </p>
          <div className="formula">PM2.5 = baseline + Σ (feature × weight)</div>
          <p>
            Four models cover 1–6, 7–24, 25–48 and 49–72 hours. Features include
            recent PM2.5, origin weather, lagged fire totals, a traffic proxy,
            location, time, Diwali proximity and horizon. Missing-source
            indicators distinguish unavailable values from measured zeros.
          </p>
          <p>
            The center is a point prediction, not a trained conditional median.
            Bands use split-conformal absolute residuals; temporal dependence
            and changing conditions mean nominal coverage is not guaranteed.
          </p>
          <p>
            The map interpolates the nearest three station predictions onto real
            H3 resolution-8 cells. It uses inverse squared distance, not
            validated kriging or a physical smoke transport simulation.
          </p>
          <a
            href="/api/v1/report-card"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Read the evaluation artifact
            <ArrowUpRight size={14} />
          </a>
        </section>
        <section className="card prose model-details">
          <SectionLabel>THE MODEL CARD</SectionLabel>
          <h2>Candidate, with context.</h2>
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
              <dt>Training pairs</dt>
              <dd>{registry.model.trainingPairs.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Test pairs</dt>
              <dd>{registry.model.testPairs.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Primary target</dt>
              <dd>PM2.5 · µg/m³</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>Station-level · nationwide</dd>
            </div>
            <div>
              <dt>Promotion</dt>
              <dd>
                <Badge tone="orange">Experimental candidate</Badge>
              </dd>
            </div>
          </dl>
          <InfoNote>
            2025 is now an observed test result. Future tuning needs a fresh
            evaluation protocol. Replay years through 2023 are in-sample; 2024
            is calibration.
          </InfoNote>
        </section>
      </div>
      <section className="card sources-card">
        <CardHead
          title="The people and data behind the picture."
          subtitle="Four local datasets, with their provenance intact."
        />
        <div className="source-grid">
          {[
            {
              name: "CPCB",
              type: "MEASURED",
              text: "Official monitoring-station PM2.5 observations. Hourly averages require at least three valid quarter-hour readings.",
              url: "https://app.cpcbccr.com/ccr",
            },
            {
              name: "Open-Meteo / ERA5",
              type: "REANALYSIS",
              text: "Origin-hour temperature, humidity and wind. Historical reanalysis is not an archived operational weather forecast.",
              url: "https://open-meteo.com/en/docs/historical-weather-api",
            },
            {
              name: "NASA FIRMS",
              type: "SATELLITE-DERIVED",
              text: "Delayed daily fire radiative power, summed regionally. It is a proxy for fire activity, not local smoke concentration.",
              url: "https://firms.modaps.eosdis.nasa.gov/",
            },
            {
              name: "Historical traffic",
              type: "GENERATED PROXY",
              text: "Empirically calibrated corridor patterns. These are not measured historical traffic flows or emissions.",
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
          <SectionLabel>WHAT THE NUMBERS MEAN</SectionLabel>
          <h2>Concentration comes first.</h2>
          <p>
            The main number is hourly modelled PM2.5. The category uses a
            trailing 24-hour PM2.5 mean, combining available observations and
            predictions. The PM2.5 sub-index uses the Indian AQI concentration
            breakpoints. It is not a complete official AQI, which requires
            additional pollutant and availability rules.
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
          <SectionLabel>HEALTH, WITHOUT OVERCLAIMING</SectionLabel>
          <h2>Lower exposure, with care.</h2>
          <p>
            Our lowest-window suggestions compare modelled concentrations. They
            do not certify safe air. General advice follows WHO guidance on
            choosing lower-exposure times and places. Individual vulnerability
            and medical advice matter.
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
        Not a medical device or a replacement for CPCB advisories. Neighborhood
        accuracy, causal source shares, and intervention benefits have not yet
        been validated. Offline forecasts are archived estimates, never a live
        measurement.
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
          <SectionLabel>THE PIPELINE, IN PLAIN SIGHT</SectionLabel>
          <h2>
            {snapshot.kind === "outlook"
              ? "Outlook ready. Live feeds unconfigured."
              : "Archive healthy. Live feeds unconfigured."}
          </h2>
          <p>
            All charts use bundled snapshots. No current observation is implied.
          </p>
        </div>
        <Badge tone="orange">Archive mode</Badge>
      </div>
      <div className="metric-grid">
        <Metric
          label="MONITORED PLACES"
          number={String(snapshot.stations.length)}
          note="Valid PM history for this archive"
        />
        <Metric
          label="WEATHER COVERAGE"
          number={`${Math.round((weather / snapshot.stations.length) * 100)}%`}
          note={`${weather} places with origin weather`}
        />
        <Metric
          label="TRAFFIC PROXY COVERAGE"
          number={`${Math.round((traffic / snapshot.stations.length) * 100)}%`}
          note={`${traffic} matched historical corridors`}
        />
        <Metric
          label="FIRE FEATURE COVERAGE"
          number={`${Math.round((fire / snapshot.stations.length) * 100)}%`}
          note="Delayed regional activity proxy"
        />
      </div>
      <section className="card table-card">
        <CardHead
          title="Source by source."
          subtitle={`Selected snapshot: ${snapshot.id} · generated ${fullDate(snapshot.generatedAt)}`}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Used for</th>
                <th>Mode</th>
                <th>Coverage</th>
                <th>Live status</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "CPCB station files",
                  "PM2.5 targets & lag features",
                  "MEASURED",
                  `${snapshot.stations.length} places`,
                ],
                [
                  "Open-Meteo archive",
                  "Origin weather",
                  "REANALYSIS",
                  `${weather} places`,
                ],
                [
                  "NASA FIRMS",
                  "Delayed fire-activity proxy",
                  "SATELLITE-DERIVED",
                  `${fire} places`,
                ],
                [
                  "Historical traffic",
                  "Corridor traffic input",
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
                      Not configured
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
          <SectionLabel>MODEL OPERATIONS</SectionLabel>
          <h2>A candidate, never silently promoted.</h2>
          <p>
            Current version: {registry.model.version}. Training and held-out
            evaluation completed successfully. Promotion, live drift detection
            and automatic rollback remain unconfigured.
          </p>
          <p>
            Missing weather uses defaults plus indicators. Missing traffic and
            fire activity are marked unknown. The server retains the selected
            archive when a new replay fails to load.
          </p>
          <a
            className="text-link"
            href="/api/v1/status"
            target="_blank"
            rel="noreferrer"
          >
            Inspect status JSON
            <ArrowUpRight size={14} />
          </a>
        </section>
        <section className="card prose">
          <SectionLabel>LOCAL-FIRST SERVICES</SectionLabel>
          <h2>Know where things live.</h2>
          <p>
            Reports and pledges are persisted in a local single-instance JSON
            store. Alert preferences and saved scenarios live on this browser.
            Remote notifications, officer authentication and cloud persistence
            require configuration.
          </p>
          <p>
            Offline navigation caching is disabled. The legacy service worker is
            retired so failed routes cannot be replaced by the home page. Map
            tiles still need a network; an H3 schematic remains available when
            the base map cannot load.
          </p>
          <a
            className="text-link"
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noreferrer"
          >
            API endpoint index
            <ArrowUpRight size={14} />
          </a>
        </section>
      </div>
    </>
  );
}

export function OutlookEvidence({
  snapshot,
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
        <SectionLabel>2026 · AN OUTLOOK WITH A MEMORY</SectionLabel>
        <h2>
          The past has a pattern.
          <br />
          <em>The future has a range.</em>
        </h2>
        <p>
          For each station and festival-relative hour, we take the median of at
          least three previous Diwali seasons. No future observations are
          invented.
        </p>
      </section>
      <div className="metric-grid">
        <Metric
          label="HISTORICAL MEDIAN"
          number={Math.round(point.p50).toString()}
          unit="µg/m³"
          note={`${dateLabel(point.time)}, ${hourLabel(point.time)} IST`}
        />
        <Metric
          label="HISTORICAL P10–P90"
          number={`${Math.round(point.p10)}–${Math.round(point.p90)}`}
          note="Empirical spread, not calibrated confidence"
        />
        <Metric
          label="SOURCE FESTIVALS"
          number={String(station.outlook?.sourceYears.length ?? 0)}
          note={station.outlook?.sourceYears.join(", ") ?? ""}
        />
        <Metric
          label="MINIMUM HOURLY ANALOGS"
          number={String(station.outlook?.minimumHourlySamples ?? 0)}
          note="Same station, same festival-relative hour"
        />
      </div>
      <section className="card prose">
        <SectionLabel>WHAT CHANGES — AND WHAT DOESN’T</SectionLabel>
        <h2>A seasonal view. Not future measurements.</h2>
        <p>{snapshot.outlook?.limitations}</p>
        <p>
          The rolling-day PM2.5 index uses the analog median curve, including
          the preceding 24 hours. Traffic and weather perturbations are not
          applied to these empirical curves. The ridge model’s causal-looking
          contribution bars are intentionally unavailable here.
        </p>
        <p>
          Station evidence years: {station.outlook?.sourceYears.join(", ")}.
          Latest actual reading was{" "}
          {station.outlook
            ? fullDate(station.outlook.latestObservedAt)
            : "unavailable"}
          ; it is not treated as the Diwali-night observation.
        </p>
        <a className="text-link" href="/report-card">
          Inspect the rolling backtest <ArrowUpRight size={14} />
        </a>
      </section>
    </>
  );
}
