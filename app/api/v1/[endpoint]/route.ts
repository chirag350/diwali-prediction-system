import {
  getSnapshot,
  registry,
  findStation,
  summary,
  scenario,
  attribution,
} from "../../../../server/forecast";
import { community, contribute, device } from "../../../../server/community";
import { isValidCell, cellToLatLng } from "h3-js";
import modelAudit from "../../../../data/bundled/model-audit.json";
import { bestWindow } from "../../../../lib/air";
const response = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: { "X-Content-Type-Options": "nosniff", ...headers },
  });
export async function GET(
  request: Request,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint } = await params;
  const url = new URL(request.url);
  const id = url.searchParams.get("snapshot") ?? "latest";
  if (endpoint === "report-card")
    return response({
      ...registry.model,
      scope: "National, all-season, 2025 held-out test",
      promoted: false,
      audit: modelAudit,
      warning:
        "Horizon sampling has a clock-hour bias. Severe Diwali peak skill and interval coverage are poor.",
    });
  if (endpoint === "status")
    return response({
      mode: "archived",
      model: registry.model.version,
      candidate: true,
      liveConfigured: false,
      snapshots: registry.snapshots,
      communityStorage: "local-single-instance",
    });
  if (endpoint === "openapi.json")
    return response({
      openapi: "3.1.0",
      info: { title: "Shwāsa forecast API", version: "1.0.0" },
      paths: Object.fromEntries(
        [
          "forecast",
          "heatmap",
          "timeline",
          "attribution",
          "replay",
          "report-card",
          "status",
          "safe-window",
          "wards",
          "export",
          "reports",
          "leaderboard",
        ].map((x) => [
          `/api/v1/${x}`,
          {
            get: {
              summary: x,
              responses: {
                200: { description: "JSON; archived data with provenance" },
              },
            },
          },
        ]),
      ),
    });
  try {
    const snap = await getSnapshot(id);
    const s = findStation(
      snap,
      url.searchParams.get("station"),
      url.searchParams.get("h3"),
    );
    const headers = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    };
    if (endpoint === "replay" || endpoint === "heatmap")
      return response(snap, 200, headers);
    if (endpoint === "wards")
      return response(
        snap.stations.map((s) => ({
          id: s.id,
          name: s.name,
          h3: s.h3,
          ...summary(s),
          confidence: "Station-supported; spatial validation pending",
        })),
        200,
        headers,
      );
    if (endpoint === "leaderboard")
      return response(await community(s?.h3 ?? snap.stations[0].h3));
    if (!s)
      return response({ error: "Station or monitored H3 cell not found" }, 404);
    if (endpoint === "forecast")
      return response(
        {
          station: s,
          snapshot: snap.id,
          model: snap.modelVersion,
          candidate: true,
          provenance: "MODELLED",
          ...summary(s),
        },
        200,
        headers,
      );
    if (endpoint === "timeline") return response(summary(s), 200, headers);
    if (endpoint === "safe-window")
      return response(
        {
          window: bestWindow(s.points),
          label: "Lowest modelled exposure, not a guarantee of safety",
        },
        200,
        headers,
      );
    if (endpoint === "attribution") {
      const h = Number(url.searchParams.get("hour") ?? 1);
      if (!Number.isInteger(h) || h < 1 || h > 72)
        return response({ error: "hour must be 1–72" }, 400);
      return response(attribution(s, h), 200, headers);
    }
    if (endpoint === "reports") return response(await community(s.h3));
    if (endpoint === "export") {
      const format = url.searchParams.get("format") ?? "csv";
      if (format === "geojson")
        return response({
          type: "FeatureCollection",
          features: snap.stations.map((s) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [s.lon, s.lat] },
            properties: {
              id: s.id,
              name: s.name,
              h3: s.h3,
              pm25: s.points[0].p50,
              provenance: "MODELLED",
              issued_at: s.origin,
            },
          })),
        });
      const csv = [
        "station,h3,issued_at,valid_at,pm25,p10,p90,actual,provenance",
        ...snap.stations.flatMap((s) =>
          s.points.map((p) =>
            [
              s.id,
              s.h3,
              s.origin,
              p.time,
              p.p50,
              p.p10,
              p.p90,
              p.actual ?? "",
              "MODELLED",
            ].join(","),
          ),
        ),
      ].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="shwasa-${id}.csv"`,
        },
      });
    }
    return response({ error: "Endpoint not found" }, 404);
  } catch {
    return response({ error: "Snapshot unavailable" }, 404);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint } = await params;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return response({ error: "Cross-origin submission rejected" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return response({ error: "Request too large" }, 413);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return response({ error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    if (endpoint === "subscribe")
      return response(
        {
          error:
            "Remote alert delivery is not configured. Save a local alert preference in the app instead.",
        },
        503,
      );
    if (endpoint === "reports" || endpoint === "pledge") {
      if (typeof body.h3 !== "string" || !isValidCell(body.h3))
        return response(
          { error: "A valid Delhi-NCR H3 cell is required" },
          400,
        );
      const [lat, lon] = cellToLatLng(body.h3);
      if (lat < 28.2 || lat > 29.1 || lon < 76.7 || lon > 77.7)
        return response({ error: "Outside pilot area" }, 400);
      if (
        endpoint === "reports" &&
        !["haze", "smoke", "burning", "dust"].includes(body.kind)
      )
        return response({ error: "Unknown report kind" }, 400);
      const d = device(request);
      try {
        const result = await contribute(
          endpoint === "reports" ? "reports" : "pledges",
          body.h3,
          body.kind ?? "clean-diwali",
          d.hash,
        );
        return response(
          { ...result, provenance: "CITIZEN", modelInfluence: false },
          201,
          { "Set-Cookie": d.cookie },
        );
      } catch (e) {
        return response(
          { error: e instanceof Error ? e.message : "Storage unavailable" },
          429,
        );
      }
    }
    const snap = await getSnapshot(body.snapshot ?? "latest");
    const station = findStation(snap, body.station ?? null, body.h3 ?? null);
    if (!station) return response({ error: "Unknown station" }, 404);
    if (endpoint === "scenario") {
      const traffic = Number(body.traffic ?? 0),
        wind = Number(body.wind ?? 1);
      if (
        !Number.isFinite(traffic) ||
        traffic < -40 ||
        traffic > 20 ||
        !Number.isFinite(wind) ||
        wind < 0.5 ||
        wind > 2
      )
        return response(
          { error: "Traffic range −40…20%; wind multiplier 0.5…2" },
          400,
        );
      return response({
        points: scenario(station, traffic, wind),
        label: "Scenario estimate, not a forecast",
        causal: false,
      });
    }
    if (endpoint === "assistant") {
      const q = String(body.question ?? "")
          .slice(0, 300)
          .toLowerCase(),
        sum = summary(station);
      const answer = /why|driver|cause/.test(q)
        ? `${station.name}: the regression combines recent pollution, weather, fires, traffic proxies and timing. These statistical contributions do not establish causal source shares.`
        : /safe|walk|outside|window/.test(q)
          ? `The lowest modelled 3-hour window for ${station.name} starts at ${sum.bestWindow.start.time}, averaging ${Math.round(sum.bestWindow.mean)} µg/m³. Lower exposure does not mean risk-free. Follow official local guidance.`
          : `${station.name} has a modelled peak of ${Math.round(sum.peak.p50)} µg/m³ at ${sum.peak.time}. The candidate model forecasts from archived inputs issued ${station.origin}.`;
      return response({
        answer,
        source: {
          station: station.id,
          h3: station.h3,
          issuedAt: station.origin,
          snapshot: snap.id,
          provenance: "MODELLED",
        },
        mode: "grounded-template",
      });
    }
    return response({ error: "Endpoint not found" }, 404);
  } catch {
    return response(
      { error: "Invalid request or unavailable local storage" },
      400,
    );
  }
}
