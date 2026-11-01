"use client";
import { useId } from "react";
import { hourLabel, dateLabel, airColor, colors } from "../lib/air";
import type { Point } from "../lib/types";
export function ForecastChart({
  points,
  selected = 0,
  onSelect,
  comparison,
  actual = false,
  compact = false,
  historical = false,
  recorded = false,
}: {
  points: Point[];
  selected?: number;
  onSelect?: (hour: number) => void;
  comparison?: Point[];
  actual?: boolean;
  compact?: boolean;
  historical?: boolean;
  recorded?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const W = 860,
    H = compact ? 180 : 240,
    L = 42,
    R = 18,
    T = 18,
    B = 35;
  const value = (p: Point) => (recorded ? p.actual : p.p50);
  const valid = (v: number | null): v is number =>
    v !== null && Number.isFinite(v);
  const numbers = [
    ...points.map((p) => (recorded ? p.actual : p.p90)),
    ...(comparison ?? []).map(value),
    ...(actual ? points.map((p) => p.actual) : []),
  ].filter(valid);
  const max = Math.ceil(Math.max(0, ...numbers) / 100) * 100 || 100;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R),
    y = (v: number) => T + (1 - v / max) * (H - T - B);
  function line(series: Point[], get: (p: Point) => number | null) {
    let drawing = false;
    return series
      .map((p, i) => {
        const v = get(p);
        if (!valid(v)) {
          drawing = false;
          return "";
        }
        const command = drawing ? "L" : "M";
        drawing = true;
        return `${command}${x(i)},${y(v)}`;
      })
      .join(" ");
  }
  const area =
    line(points, (p) => p.p90) +
    " " +
    [...points]
      .reverse()
      .map((p, j) => `L${x(points.length - 1 - j)},${y(p.p10)}`)
      .join(" ") +
    " Z";
  const selectedValue = value(points[selected]);
  const boundaries = [30, 60, 90, 120, 250];
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          recorded
            ? "Recorded hourly PM2.5. Gaps mean missing readings. Solid and dashed lines show the two areas. Colours show pollution level."
            : historical
              ? "Estimated hourly PM2.5 from past Diwalis. Shading shows the range of past readings, not guaranteed future values."
              : "Estimated hourly PM2.5. Shading shows the expected range. Colours show pollution level."
        }
      >
        <defs>
          <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity=".16" />
            <stop offset="100%" stopColor="#64748b" stopOpacity=".025" />
          </linearGradient>
          <linearGradient
            id={`${id}-health`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={y(0)}
            x2="0"
            y2={y(max)}
          >
            <stop offset="0%" stopColor={colors[0]} />
            {boundaries.flatMap((v, i) =>
              v < max
                ? [
                    <stop
                      key={`${i}-low`}
                      offset={`${(v / max) * 100}%`}
                      stopColor={colors[i]}
                    />,
                    <stop
                      key={`${i}-high`}
                      offset={`${(v / max) * 100}%`}
                      stopColor={colors[i + 1]}
                    />,
                  ]
                : [],
            )}
            <stop offset="100%" stopColor={airColor(max)} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={L}
              x2={W - R}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="currentColor"
              opacity=".08"
              strokeDasharray="3 5"
            />
            <text
              x={L - 12}
              y={y(max * f) + 4}
              textAnchor="end"
              className="chart-label"
            >
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {!recorded && <path d={area} fill={`url(#${id}-shade)`} />}
        <path
          d={line(points, value)}
          fill="none"
          stroke={`url(#${id}-health)`}
          strokeWidth="2.7"
          strokeLinejoin="round"
        />
        {comparison && (
          <path
            d={line(comparison, value)}
            fill="none"
            stroke={`url(#${id}-health)`}
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
        )}
        {actual &&
          points.map((p, i) =>
            p.actual === null ? null : (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.actual)}
                r="2.8"
                fill={airColor(p.actual)}
              />
            ),
          )}
        {[0, 12, 24, 36, 48, 60, 71].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            className="chart-label"
          >
            {i === 0 || i === 24 || i === 48
              ? dateLabel(points[i].time)
              : hourLabel(points[i].time)}
          </text>
        ))}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={T}
          y2={H - B}
          stroke="#64748b"
          opacity=".5"
          strokeDasharray="3 4"
        />
        {valid(selectedValue) && (
          <circle
            cx={x(selected)}
            cy={y(selectedValue)}
            r="5"
            fill={airColor(selectedValue)}
            stroke="var(--surface)"
            strokeWidth="3"
          />
        )}
        {onSelect &&
          points.map((p, i) => (
            <rect
              key={i}
              x={x(i) - 6}
              y={T}
              width="12"
              height={H - T - B}
              fill="transparent"
              onClick={() => onSelect(i)}
            >
              <title>{`${hourLabel(p.time)}: ${value(p) === null ? "No recorded reading" : `${Math.round(value(p) ?? 0)} µg/m³`}`}</title>
            </rect>
          ))}
      </svg>
    </div>
  );
}
