"use client";
import { useId } from "react";
import { hourLabel, dateLabel } from "../lib/air";
import type { Point } from "../lib/types";
export function ForecastChart({
  points,
  selected = 0,
  onSelect,
  comparison,
  actual = false,
  compact = false,
}: {
  points: Point[];
  selected?: number;
  onSelect?: (n: number) => void;
  comparison?: Point[];
  actual?: boolean;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const W = 860,
    H = compact ? 180 : 240,
    L = 42,
    R = 18,
    T = 18,
    B = 35;
  const max =
    Math.ceil(
      Math.max(
        ...points.map((p) => p.p90),
        ...(actual ? points.map((p) => p.actual ?? 0) : []),
        ...(comparison ?? []).map((p) => p.p50),
      ) / 100,
    ) * 100 || 100;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R),
    y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (get: (p: Point) => number) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(get(p))}`).join(" ");
  const area =
    path((p) => p.p90) +
    " " +
    [...points]
      .reverse()
      .map((p, j) => `L${x(points.length - 1 - j)},${y(p.p10)}`)
      .join(" ") +
    " Z";
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="72-hour PM2.5 forecast. Green line is the model prediction; shading is the nominal 80 percent uncertainty band."
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5e886b" stopOpacity=".22" />
            <stop offset="100%" stopColor="#5e886b" stopOpacity=".025" />
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
        <path d={area} fill={`url(#${id})`} />
        <path
          d={path((p) => p.p50)}
          fill="none"
          stroke="#37684c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {comparison && (
          <path
            d={comparison
              .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.p50)}`)
              .join(" ")}
            fill="none"
            stroke="#d18d4c"
            strokeWidth="2.3"
            strokeDasharray="5 4"
          />
        )}
        {actual &&
          points.map((p, i) =>
            p.actual === null ? null : (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.actual)}
                r="2.3"
                fill="#bf7849"
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
          stroke="#37684c"
          opacity=".35"
          strokeDasharray="3 4"
        />
        <circle
          cx={x(selected)}
          cy={y(points[selected].p50)}
          r="5"
          fill="#37684c"
          stroke="var(--surface)"
          strokeWidth="3"
        />
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
              <title>{`${hourLabel(p.time)}: ${Math.round(p.p50)} µg/m³`}</title>
            </rect>
          ))}
      </svg>
    </div>
  );
}
