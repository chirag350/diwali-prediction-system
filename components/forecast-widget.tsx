"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Snapshot } from "../lib/types";
import { airColor, pmSubindex, dateLabel, hourLabel, peak } from "../lib/air";
import { AirStatus, Brand, Badge } from "./ui";
import { ForecastChart } from "./forecast-chart";
export default function ForecastWidget({ initial }: { initial: Snapshot }) {
  const [id, setId] = useState("site_301");
  useEffect(() => {
    const station = new URLSearchParams(window.location.search).get("station");
    if (station) queueMicrotask(() => setId(station));
  }, []);
  const s = initial.stations.find((s) => s.id === id) ?? initial.stations[0],
    p = s.points[0],
    high = peak(s.points);
  return (
    <main className="widget-shell">
      <div className="widget-heading">
        <Brand small />
        <Badge tone="orange">
          {initial.kind === "outlook"
            ? `${initial.year} estimate`
            : `Past year ${initial.year}`}
        </Badge>
      </div>
      <h1>{s.name}</h1>
      <p>
        {dateLabel(p.time)} · {hourLabel(p.time)} IST · estimated
      </p>
      <div className="widget-number" style={{ color: airColor(p.mean24) }}>
        {p.aqi === null ? "—" : pmSubindex(p.mean24)}
        <span> / 500</span>
      </div>
      <AirStatus pm={p.aqi === null ? null : p.mean24} />
      <p>
        AQI estimate · PM2.5 only · 24-hour average
        <br />
        Hourly PM2.5: {Math.round(p.p50)} µg/m³ ·{" "}
        {initial.kind === "outlook" ? "range in past years" : "range"}{" "}
        {Math.round(p.p10)}–{Math.round(p.p90)}
      </p>
      <ForecastChart
        points={s.points}
        compact
        historical={initial.kind === "outlook"}
      />
      <div className="widget-summary">
        <span>Highest estimated PM2.5 over 48 hours</span>
        <strong>{Math.round(high.p50)} µg/m³</strong>
      </div>
      <Link
        className="primary-button full"
        target="_blank"
        href={`/my-air?station=${s.id}&snapshot=${initial.id}`}
      >
        View this area ↗
      </Link>
      <small>
        {initial.kind === "outlook"
          ? "Based on past Diwalis. Not a live reading."
          : "Experimental model. Not a live reading."}
        <br />
        {initial.kind === "outlook" ? "Window starts" : "Issued"}{" "}
        {dateLabel(s.origin, true)}, {hourLabel(s.origin)} IST.
      </small>
    </main>
  );
}
