"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapType,
} from "maplibre-gl";
import { polygonToCells, cellToBoundary, cellToLatLng } from "h3-js";
import { Plus, Minus, LocateFixed, Layers, Compass, Wind } from "lucide-react";
import { airColor } from "../lib/air";
import { delhiNcr } from "../cities/delhi-ncr";
import type { Station } from "../lib/types";
import "maplibre-gl/dist/maplibre-gl.css";
type Cell = {
  id: string;
  lat: number;
  lon: number;
  boundary: number[][];
  nearest: string;
  weights: { id: string; weight: number }[];
  distance: number;
};
const polygon = delhiNcr.map.polygon;
function value(stations: Station[], hour: number, layer: string, mode: string) {
  return Object.fromEntries(
    stations.map((s) => {
      const p = s.points[hour];
      return [
        s.id,
        layer === "uncertainty"
          ? p.p90 - p.p10
          : mode === "actual"
            ? p.actual
            : mode === "diff"
              ? p.actual === null
                ? null
                : Math.abs(p.p50 - p.actual)
              : p.p50,
      ];
    }),
  );
}
export default function AirMap({
  stations,
  selected,
  hour,
  onSelect,
  layer = "pm",
  mode = "forecast",
  scenarioValues,
}: {
  stations: Station[];
  selected: string;
  hour: number;
  onSelect: (id: string) => void;
  layer?: string;
  mode?: string;
  scenarioValues?: Record<string, number>;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<MapType | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [showStations, setShowStations] = useState(true),
    [fallbackZoom, setFallbackZoom] = useState(1),
    [fallbackCenter, setFallbackCenter] = useState<[number, number]>([
      450, 310,
    ]);
  const click = useRef(onSelect);
  const current = useRef(stations);
  useEffect(() => {
    click.current = onSelect;
    current.current = stations;
  }, [onSelect, stations]);
  const cells = useMemo(
    () =>
      polygonToCells([polygon], delhiNcr.h3Resolution).map((id) => {
        const [lat, lon] = cellToLatLng(id);
        const nearest = stations
          .map((s) => ({
            id: s.id,
            d: Math.hypot((s.lat - lat) * 111, (s.lon - lon) * 98),
          }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 3);
        const total = nearest.reduce(
          (a, s) => a + 1 / Math.max(0.2, s.d) ** 2,
          0,
        );
        return {
          id,
          lat,
          lon,
          boundary: cellToBoundary(id, true),
          nearest: nearest[0]?.id,
          distance: nearest[0]?.d ?? 100,
          weights: nearest.map((s) => ({
            id: s.id,
            weight: 1 / Math.max(0.2, s.d) ** 2 / total,
          })),
        } as Cell;
      }),
    [stations],
  );
  const data = useMemo(() => {
    const values = scenarioValues ?? value(stations, hour, layer, mode);
    return {
      type: "FeatureCollection" as const,
      features: cells.map((c) => {
        const available = c.weights.filter(
          (s) => values[s.id] !== null && values[s.id] !== undefined,
        );
        const weight = available.reduce((a, s) => a + s.weight, 0);
        const v = weight
          ? available.reduce((a, s) => a + (values[s.id] ?? 0) * s.weight, 0) /
            weight
          : null;
        return {
          type: "Feature" as const,
          geometry: { type: "Polygon" as const, coordinates: [c.boundary] },
          properties: {
            station: c.nearest,
            pm: v,
            color:
              layer === "confidence"
                ? c.distance < 2
                  ? "#789a70"
                  : c.distance < 5
                    ? "#b6b172"
                    : "#c49775"
                : v === null
                  ? "#d2d5cc"
                  : airColor(v),
            h3: c.id,
          },
        };
      }),
    };
  }, [cells, stations, hour, layer, mode, scenarioValues]);
  useEffect(() => {
    if (!host.current) return;
    let m: MapType;
    try {
      setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
      m = new MapLibreMap({
        container: host.current,
        center: delhiNcr.map.center,
        zoom: delhiNcr.map.zoom,
        minZoom: 8,
        maxZoom: 15,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            base: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "base",
              type: "raster",
              source: "base",
              paint: { "raster-saturation": -0.65, "raster-opacity": 0.57 },
            },
          ],
        },
      });
      map.current = m;
      m.on("load", () => {
        setReady(true);
        m.addSource("cells", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: "hexes",
          type: "fill",
          source: "cells",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.34,
            "fill-outline-color": "rgba(255,255,255,.3)",
          },
        });
        m.addSource("stations", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: "dots",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["case", ["get", "selected"], 7, 3.5],
            "circle-color": ["case", ["get", "selected"], "#244d39", "#fafaf4"],
            "circle-stroke-width": 1.7,
            "circle-stroke-color": "#244d39",
          },
        });
        m.on("click", "hexes", (e) => {
          const id = e.features?.[0].properties?.station;
          if (id) click.current(id);
        });
        m.on("mouseenter", "hexes", () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "hexes", () => {
          m.getCanvas().style.cursor = "";
        });
      });
      m.on("error", () => setFailed(true));
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      m?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current?.getSource("cells")) return;
    (map.current.getSource("cells") as GeoJSONSource).setData(data);
    (map.current.getSource("stations") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: stations.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: { selected: s.id === selected },
      })),
    });
    map.current.setLayoutProperty(
      "dots",
      "visibility",
      showStations ? "visible" : "none",
    );
  }, [ready, data, stations, selected, showStations]);
  const s = stations.find((s) => s.id === selected) ?? stations[0];
  const px = (lon: number) => ((lon - 76.88) / 0.65) * 900,
    py = (lat: number) => ((28.93 - lat) / 0.57) * 620;
  return (
    <div className={`air-map ${ready && !failed ? "has-basemap" : ""}`}>
      <div
        ref={host}
        className={`map-canvas ${ready && !failed ? "is-ready" : ""}`}
        aria-label="Interactive Delhi-NCR pollution map"
      />
      {(!ready || failed) && (
        <svg
          className="map-fallback"
          viewBox={`${fallbackCenter[0] - 450 / fallbackZoom} ${fallbackCenter[1] - 310 / fallbackZoom} ${900 / fallbackZoom} ${620 / fallbackZoom}`}
          role="img"
          aria-label="Offline Delhi-NCR H3 map"
        >
          <defs>
            <pattern
              id="mapGrid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#d6dbd0"
                strokeWidth=".5"
              />
            </pattern>
          </defs>
          <rect width="900" height="620" fill="#e9eddf" />
          <rect width="900" height="620" fill="url(#mapGrid)" />
          <path
            d="M550,-20 C470,120 600,170 560,270 S510,420 620,650"
            fill="none"
            stroke="#d2e0de"
            strokeWidth="26"
          />
          {data.features.map((f, i) => (
            <path
              key={cells[i].id}
              d={
                f.geometry.coordinates[0]
                  .map(
                    ([lon, lat], i) => `${i ? "L" : "M"}${px(lon)},${py(lat)}`,
                  )
                  .join(" ") + "Z"
              }
              fill={f.properties.color}
              fillOpacity=".28"
              stroke="#fafbf4"
              strokeWidth=".5"
              onClick={() => onSelect(cells[i].nearest)}
            />
          ))}
          {[
            "M80 240 Q350 100 590 270 T850 390",
            "M170 650 Q200 400 400 320 T650 -50",
            "M250 150 Q550 80 600 380 Q420 530 250 350 Z",
          ].map((d) => (
            <path key={d} d={d} fill="none" stroke="#faf9ef" strokeWidth="5" />
          ))}
          {showStations &&
            stations.map((p) => (
              <circle
                key={p.id}
                cx={px(p.lon)}
                cy={py(p.lat)}
                r={p.id === selected ? 7 : 3}
                fill={p.id === selected ? "#244d39" : "#fffdf6"}
                stroke="#244d39"
                strokeWidth="1.5"
                onClick={() => onSelect(p.id)}
              />
            ))}
        </svg>
      )}
      <div className="map-place-label label-rohini">ROHINI</div>
      <div className="map-place-label label-delhi">NEW DELHI</div>
      <div className="map-place-label label-noida">NOIDA</div>
      <div className="map-place-label label-ghaziabad">GHAZIABAD</div>
      <div className="map-place-label label-gurgaon">GURUGRAM</div>
      <span className="river-label">Yamuna</span>
      <div className="map-top">
        <span className="map-tag">
          <span className="tiny-dot" /> {cells.length.toLocaleString()} H3 cells{" "}
          <span className="muted">· res 8</span>
        </span>
        <button
          className={`map-tag ${showStations ? "selected-tag" : ""}`}
          onClick={() => setShowStations(!showStations)}
        >
          <Layers size={14} /> Stations {showStations ? "on" : "off"}
        </button>
      </div>
      <div className="map-controls">
        <button
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => {
            if (ready && !failed) map.current?.zoomIn();
            else setFallbackZoom((z) => Math.min(3, z + 0.3));
          }}
        >
          <Plus size={17} />
        </button>
        <button
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => {
            if (ready && !failed) map.current?.zoomOut();
            else setFallbackZoom((z) => Math.max(0.7, z - 0.3));
          }}
        >
          <Minus size={17} />
        </button>
        <button
          title="Center selected station"
          aria-label="Center selected station"
          onClick={() => {
            if (ready && !failed)
              map.current?.flyTo({ center: [s.lon, s.lat], zoom: 11 });
            else {
              setFallbackCenter([px(s.lon), py(s.lat)]);
              setFallbackZoom(1.6);
            }
          }}
        >
          <LocateFixed size={17} />
        </button>
        <button
          title="Reset map bearing"
          aria-label="Reset map bearing"
          onClick={() => {
            map.current?.resetNorth();
            setFallbackCenter([450, 310]);
            setFallbackZoom(1);
          }}
        >
          <Compass size={17} />
        </button>
      </div>
      <div className="map-selected">
        <span className="pulse-dot" />
        <div>
          <strong>{s.name}</strong>
          <span>
            {s.outlook
              ? "Historical-analog outlook"
              : "Station-supported estimate"}
          </span>
        </div>
      </div>
      <div className="map-wind">
        <Wind size={19} />
        <span>
          {s.weather.missing
            ? "Weather unavailable"
            : `${s.weather.wind.toFixed(1)} m/s`}
        </span>
      </div>
      <div className="map-legend">
        <div className="legend-title">
          <strong>
            {layer === "confidence"
              ? "Distance to station"
              : layer === "uncertainty"
                ? "Band width"
                : mode === "diff"
                  ? "Absolute forecast error"
                  : "PM2.5"}
          </strong>
          <span>{layer === "confidence" ? "km" : "µg/m³"}</span>
        </div>
        <div
          className="legend-gradient"
          style={
            layer === "confidence"
              ? {
                  background:
                    "linear-gradient(to right,#789a70,#b6b172,#c49775)",
                }
              : undefined
          }
        />
        <div className="legend-values">
          {(layer === "confidence"
            ? ["<2", "2–5", ">5"]
            : ["0", "30", "60", "90", "120", "250+"]
          ).map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>
      <div className="map-attribution">
        {!ready || failed ? "Offline schematic · " : ""}IDW interpolation ·
        spatial validation pending{" "}
        <span>
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OSM
          </a>{" "}
        </span>
      </div>
    </div>
  );
}
