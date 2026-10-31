"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Leaf,
  Map,
  MapPin,
  Menu,
  MonitorPlay,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TrendingUp,
  Users,
  Wind,
  X,
  BarChart3,
  Clock3,
  Activity,
  GitCompareArrows,
  BookOpen,
  Radio,
  LocateFixed,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Registry, Snapshot, Station } from "../lib/types";
import {
  airColor,
  pmSubindex,
  observedDayMean,
  bestWindow,
  categories,
  clearBy,
  dateLabel,
  fullDate,
  hourLabel,
  level,
  peak,
} from "../lib/air";
import { ForecastChart } from "./forecast-chart";
import {
  ArrowLink,
  Badge,
  Brand,
  CardHead,
  InfoNote,
  SectionLabel,
} from "./ui";
import {
  AboutView,
  AuthorityView,
  CompareView,
  CommunityView,
  LabView,
  ReportCardView,
  StatusView,
  WhyView,
  OutlookEvidence,
} from "./views";
const AirMap = dynamic(() => import("./air-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <span className="loading-orbit" />
      Preparing your neighborhood map…
    </div>
  ),
});
const navigation: {
  group: string;
  items: {
    id: string;
    label: string;
    hi: string;
    icon: LucideIcon;
    tag?: string;
  }[];
}[] = [
  {
    group: "YOUR AIR",
    items: [
      { id: "", label: "Overview", hi: "अवलोकन", icon: LayoutDashboard },
      { id: "map", label: "Explore the map", hi: "मानचित्र", icon: Map },
      { id: "my-air", label: "My Air", hi: "मेरी हवा", icon: Wind },
      {
        id: "time-machine",
        label: "Time Machine",
        hi: "समय यात्रा",
        icon: Clock3,
        tag: "REPLAY",
      },
    ],
  },
  {
    group: "A LITTLE MORE INSIGHT",
    items: [
      {
        id: "why",
        label: "Understand the why",
        hi: "कारण जानें",
        icon: Activity,
      },
      {
        id: "lab",
        label: "What-if Lab",
        hi: "परिदृश्य लैब",
        icon: FlaskConical,
      },
      {
        id: "compare",
        label: "Compare places",
        hi: "स्थानों की तुलना",
        icon: GitCompareArrows,
      },
      { id: "authority", label: "City desk", hi: "शहर डेस्क", icon: Users },
    ],
  },
  {
    group: "BUILT ON TRUST",
    items: [
      {
        id: "report-card",
        label: "Model report card",
        hi: "मॉडल रिपोर्ट",
        icon: BarChart3,
      },
      { id: "report", label: "Community", hi: "समुदाय", icon: Heart },
      {
        id: "about",
        label: "Our methodology",
        hi: "हमारी पद्धति",
        icon: BookOpen,
      },
      { id: "status", label: "Data health", hi: "डेटा की स्थिति", icon: Radio },
    ],
  },
];
const headings: Record<string, [string, string]> = {
  "": [
    "The air, a little ahead.",
    "A clearer picture of your neighborhood. A little more room to breathe.",
  ],
  map: [
    "Every neighborhood tells a story.",
    "Explore how air changes from one street to the next.",
  ],
  "my-air": [
    "A breath closer to home.",
    "Your neighborhood’s next 72 hours, with the uncertainty left in.",
  ],
  "time-machine": [
    "Go back. See what comes next.",
    "Replay the build-up, the burst, and the air that lingered.",
  ],
  why: [
    "There’s a reason in the air.",
    "Follow the inputs behind your forecast.",
  ],
  lab: [
    "What if we did things differently?",
    "Explore how changing inputs changes the model’s estimate.",
  ],
  compare: [
    "Two places. One clearer picture.",
    "Compare the next 72 hours, side by side.",
  ],
  "report-card": [
    "The numbers behind the numbers.",
    "A public report card. Including the parts we need to improve.",
  ],
  authority: [
    "A city-wide point of view.",
    "A read-only planning desk for a better-informed response.",
  ],
  report: [
    "Good air is a shared effort.",
    "Help us understand what you’re seeing, one neighborhood at a time.",
  ],
  pledge: [
    "A smaller footprint. A shared breath.",
    "Make a little room for cleaner celebrations.",
  ],
  about: [
    "Built to be understood.",
    "Our model, our sources, and the limits we won’t hide.",
  ],
  status: [
    "Good forecasts start here.",
    "A transparent look at the data behind this experience.",
  ],
  embed: [
    "A little air, on your website.",
    "A compact, shareable view of your neighborhood forecast.",
  ],
};
const tourSteps = [
  {
    view: "",
    snapshot: "2026-during",
    title: "2026, with the evidence in view",
    text: "Start with the 2026 festival outlook: historical-analog medians, a real H3 map, and explicit uncertainty limits. This is not a live forecast.",
  },
  {
    view: "time-machine",
    snapshot: "2025-during",
    title: "Before, during, after",
    text: "Replay five Diwalis. Compare the model with measured PM2.5 at the selected future hour.",
  },
  {
    view: "why",
    snapshot: "2025-during",
    title: "Open the black box",
    text: "Exact regression contributions add up to the forecast. They are statistical associations, not emissions shares.",
  },
  {
    view: "lab",
    snapshot: "2025-during",
    title: "Ask a better what-if",
    text: "Perturb traffic and wind inputs and recompute the same model. Scenario estimates are not causal policy forecasts.",
  },
  {
    view: "report-card",
    snapshot: "2025-during",
    title: "Show the evidence",
    text: "Inspect the analog member’s rolling historical backtests, then the ridge model’s audit. Errors and interval coverage are visible, including where the model fails.",
  },
  {
    view: "authority",
    snapshot: "2026-during",
    title: "Turn insight into a plan",
    text: "Rank monitored places and export a briefing. Operational deployment and remote alerts require configured services.",
  },
];
export default function Dashboard({
  view = "",
  initial,
  registry,
  initialStation,
}: {
  view?: string;
  initial: Snapshot;
  registry: Registry;
  initialStation?: string;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial),
    [selected, setSelected] = useState(
      initialStation ??
        initial.stations.find((s) => s.id === "site_301")?.id ??
        initial.stations[0].id,
    ),
    [hour, setHour] = useState(0),
    [layer, setLayer] = useState("pm"),
    [plotMode, setPlotMode] = useState("forecast"),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [year, setYear] = useState(initial.year),
    [phase, setPhase] = useState("during"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(false),
    [hindi, setHindi] = useState(false),
    [lite, setLite] = useState(false),
    [toast, setToast] = useState(""),
    [alertOpen, setAlertOpen] = useState(false),
    [threshold, setThreshold] = useState(120),
    [profile, setProfile] = useState("general"),
    [metric, setMetric] = useState<"aqi" | "pm">("aqi"),
    [assistant, setAssistant] = useState(false),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [asking, setAsking] = useState(false),
    [tour, setTour] = useState<number | null>(null);
  const requestId = useRef(0);
  const tourRestore = useRef<{
    snapshot: Snapshot;
    hour: number;
    selected: string;
  } | null>(null);
  const initialQuery = useRef<string | null>(null);
  const readyForUrl = useRef(false);
  const activeView = tour === null ? view : tourSteps[tour].view;
  const isOutlook = snapshot.kind === "outlook";
  const station =
    snapshot.stations.find((s) => s.id === selected) ?? snapshot.stations[0];
  const point = station.points[hour];
  const concentrationValue =
    activeView === "time-machine" && plotMode !== "forecast"
      ? point.actual === null
        ? null
        : plotMode === "actual"
          ? point.actual
          : Math.abs(point.p50 - point.actual)
      : point.p50;
  const displayKind = activeView === "time-machine" ? plotMode : "forecast";
  const observedMean = observedDayMean(station, hour);
  const forecastIndex = point.aqi === null ? null : pmSubindex(point.mean24);
  const observedIndex = observedMean === null ? null : pmSubindex(observedMean);
  const displayIndex =
    displayKind === "forecast"
      ? forecastIndex
      : displayKind === "actual"
        ? observedIndex
        : forecastIndex === null || observedIndex === null
          ? null
          : Math.abs(forecastIndex - observedIndex);
  const displayValue = metric === "aqi" ? displayIndex : concentrationValue;

  const best = bestWindow(station.points),
    highest = peak(station.points),
    clear = clearBy(station.points);
  const label = headings[activeView] ?? headings[""];
  const notify = useCallback((text: string) => setToast(text), []);
  const loadSnapshot = useCallback(async (id: string, preserveHour = false) => {
    const request = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/v1/replay?snapshot=${encodeURIComponent(id)}`,
      );
      if (!res.ok)
        throw Error(
          "This replay is unavailable. Your last forecast is still visible.",
        );
      const next: Snapshot = await res.json();
      if (!next.stations.length)
        throw Error("No valid station history for this period.");
      if (request === requestId.current) {
        setSnapshot(next);
        if (next.id !== "latest") {
          setYear(next.year);
          setPhase(next.id.split("-")[1]);
        }
        if (next.kind === "outlook") setPlotMode("forecast");
        if (!preserveHour) setHour(0);
        setPlaying(false);
        return true;
      }
      return false;
    } catch (e) {
      if (request === requestId.current)
        setError(
          e instanceof Error ? e.message : "Unable to load this forecast.",
        );
      return false;
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }, []);
  const endTour = useCallback(() => {
    requestId.current++;
    setBusy(false);
    setTour(null);
    setPlaying(false);
    setError("");
    const saved = tourRestore.current;
    if (saved) {
      setSnapshot(saved.snapshot);
      setHour(saved.hour);
      setSelected(saved.selected);
      setYear(saved.snapshot.year);
      setPhase(saved.snapshot.id.split("-")[1] ?? "during");
      tourRestore.current = null;
    }
  }, []);
  const goToTourStep = useCallback(
    async (step: number) => {
      if (step < 0 || step >= tourSteps.length) return;
      setPlaying(false);
      const required = tourSteps[step].snapshot;
      if (snapshot.id !== required && !(await loadSnapshot(required))) return;
      setSearchOpen(false);
      setAlertOpen(false);
      setAssistant(false);
      setMobile(false);
      setTour(step);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [snapshot.id, loadSnapshot],
  );
  const startTour = useCallback(async () => {
    if (busy) return;
    tourRestore.current = { snapshot, hour, selected };
    await goToTourStep(0);
  }, [busy, snapshot, hour, selected, goToTourStep]);
  useEffect(() => {
    if (initialQuery.current === null)
      initialQuery.current = window.location.search;
    const q = new URLSearchParams(initialQuery.current);
    const savedTheme = localStorage.getItem("shwasa-theme");
    Promise.resolve().then(() => {
      readyForUrl.current = true;
      const id = q.get("station"),
        snap = q.get("snapshot"),
        h = Number(q.get("hour") ?? 0);
      if (id) setSelected(id);
      if (h >= 0 && h < 72) setHour(h);
      if (snap && snap !== initial.id) {
        const parts = snap.split("-");
        if (parts.length === 2) {
          setYear(Number(parts[0]));
          setPhase(parts[1]);
        }
        void loadSnapshot(snap, true);
      }
      if (savedTheme === "dark") setDark(true);
      if (localStorage.getItem("shwasa-lite") === "1") setLite(true);
    });
    if ("serviceWorker" in navigator) {
      // Remove the legacy worker which returned home HTML for unrelated routes.
      void navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          await Promise.all(
            registrations
              .filter((r) => r.scope === new URL("/", location.href).href)
              .map((r) => r.update()),
          );
          if ("caches" in window)
            await Promise.all(
              (await caches.keys())
                .filter((k) => k.startsWith("shwasa-"))
                .map((k) => caches.delete(k)),
            );
        })
        .catch(() => {});
    }
  }, [initial.id, loadSnapshot]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("shwasa-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setAssistant(false);
        setAlertOpen(false);
        if (tour !== null) endTour();
      }
      if (
        e.key.toLowerCase() === "j" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        e.preventDefault();
        if (tour === null) void startTour();
        else endTour();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tour, startTour, endTour]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setHour((h) => (h + 1) % 72), 1300 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!readyForUrl.current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("station", station.id);
    url.searchParams.set("snapshot", snapshot.id);
    url.searchParams.set("hour", String(hour));
    window.history.replaceState(null, "", url);
  }, [station.id, snapshot.id, hour]);
  useEffect(() => {
    if (!searchOpen && !alertOpen && !assistant) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>(
      searchOpen
        ? ".command-modal"
        : alertOpen
          ? ".modal-card"
          : ".assistant-panel",
    );
    if (!panel) return;
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select, a[href]",
        ),
      );
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [searchOpen, alertOpen, assistant]);
  const filtered = useMemo(
    () =>
      snapshot.stations.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [snapshot.stations, search],
  );
  const href = (id: string) =>
    `/${id}?snapshot=${snapshot.id}&station=${station.id}&hour=${hour}`;
  const changeReplay = (y: number, p: string) => {
    setYear(y);
    setPhase(p);
    void loadSnapshot(`${y}-${p}`);
  };
  const navigate = (id: string) => {
    setMobile(false);
    if (tour !== null) setTour(null);
    router.push(href(id));
  };
  async function share() {
    const text = `${station.name}: ${Math.round(point.p50)} µg/m³, modelled for ${fullDate(point.time)}. Archived candidate forecast via Shwāsa.`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Your air, a little ahead",
          text,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        notify("Forecast link copied.");
      }
    } catch {
      notify("Sharing cancelled or unavailable.");
    }
  }
  async function locate() {
    if (!navigator.geolocation) {
      notify("Location is unavailable. Choose a monitored place instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latLngToCell, cellToLatLng } = await import("h3-js");
        const h3 = latLngToCell(
          position.coords.latitude,
          position.coords.longitude,
          8,
        );
        const [lat, lon] = cellToLatLng(h3);
        if (lat < 28.2 || lat > 29.1 || lon < 76.7 || lon > 77.7) {
          notify("Our pilot covers Delhi-NCR. Choose a place on the map.");
          return;
        }
        const nearest = [...snapshot.stations].sort(
          (a, b) =>
            Math.hypot(a.lat - lat, a.lon - lon) -
            Math.hypot(b.lat - lat, b.lon - lon),
        )[0];
        setSelected(nearest.id);
        notify(
          `Nearest monitored place: ${nearest.name}. Exact location was kept on your device.`,
        );
      },
      () =>
        notify(
          "Location access unavailable. You can still search for a neighborhood.",
        ),
      { timeout: 10000 },
    );
  }
  async function ask(q = question) {
    if (!q.trim()) return;
    setQuestion(q);
    setAsking(true);
    try {
      const res = await fetch("/api/v1/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          station: station.id,
          snapshot: snapshot.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setAnswer(data.answer);
    } catch {
      setAnswer(
        "The assistant is unavailable. You can read the forecast and methodology directly.",
      );
    } finally {
      setAsking(false);
    }
  }
  const selector = (
    <button
      className="place-picker"
      onClick={() => {
        setSearch("");
        setSearchOpen(true);
      }}
    >
      <MapPin size={15} />
      <span>{station.name}, Delhi-NCR</span>
      <ChevronDown size={14} />
    </button>
  );
  const chart = (
    <section className="card forecast-chart-card">
      <CardHead
        title="A little foresight goes a long way."
        subtitle={
          isOutlook
            ? "72-hour festival outlook · historical analogs · µg/m³"
            : "72-hour PM2.5 forecast · µg/m³"
        }
      >
        <div className="chart-key">
          <span>
            <i className="key-line" />
            Modelled
          </span>
          <span>
            <i className="key-band" />
            {isOutlook ? "Historical P10–P90 spread" : "80% interval"}
          </span>
          {activeView === "time-machine" && !isOutlook && (
            <span>
              <i className="key-dot" />
              Measured
            </span>
          )}
        </div>
      </CardHead>
      <ForecastChart
        points={station.points}
        historical={isOutlook}
        selected={hour}
        onSelect={setHour}
        actual={activeView === "time-machine" && !isOutlook}
      />
      <div className="chart-footer">
        <span>
          <ShieldCheck size={13} />
          Uncertainty is part of the forecast.
        </span>
        <button onClick={() => navigate("about")}>
          How we model your air <ArrowUpRight size={13} />
        </button>
      </div>
    </section>
  );
  const timeControls = (
    <div className="time-controls">
      <button
        className="play-button"
        aria-label={playing ? "Pause timeline" : "Play timeline"}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button
        className="speed-button"
        onClick={() => setSpeed((s) => (s === 1 ? 4 : s === 4 ? 12 : 1))}
        aria-label="Change playback speed"
      >
        {speed}×
      </button>
      <div className="timeline-range">
        <input
          type="range"
          min="0"
          max="71"
          value={hour}
          onChange={(e) => {
            setHour(Number(e.target.value));
            setPlaying(false);
          }}
          aria-label="Forecast hour"
        />
        <div>
          <span>
            {dateLabel(station.points[0].time)} ·{" "}
            {hourLabel(station.points[0].time)}
          </span>
          <strong>
            {hourLabel(point.time)} IST <span>+{hour + 1}h</span>
          </strong>
          <span>
            {dateLabel(station.points[71].time)} ·{" "}
            {hourLabel(station.points[71].time)}
          </span>
        </div>
      </div>
      <button
        className="icon-button"
        aria-label="Previous hour"
        onClick={() => setHour((h) => Math.max(0, h - 1))}
      >
        <ChevronLeft size={15} />
      </button>
      <button
        className="icon-button"
        aria-label="Next hour"
        onClick={() => setHour((h) => Math.min(71, h + 1))}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
  const mapCard = (
    <section
      className={`card map-card ${activeView === "map" || activeView === "time-machine" ? "expanded-map" : ""}`}
    >
      <div className="map-card-header">
        <div>
          <SectionLabel>THE NEIGHBORHOOD PICTURE</SectionLabel>
          <h2>Different streets. Shared air.</h2>
        </div>
        <div className="segmented small">
          <button
            className={layer === "pm" ? "active" : ""}
            onClick={() => setLayer("pm")}
          >
            PM2.5
          </button>
          <button
            className={layer === "uncertainty" ? "active" : ""}
            onClick={() => setLayer("uncertainty")}
          >
            Uncertainty
          </button>
          <button
            className={layer === "confidence" ? "active" : ""}
            onClick={() => setLayer("confidence")}
          >
            Coverage
          </button>
        </div>
      </div>
      {!lite ? (
        <AirMap
          stations={snapshot.stations}
          selected={station.id}
          hour={hour}
          onSelect={setSelected}
          layer={layer}
          mode={plotMode}
        />
      ) : (
        <div className="lite-list">
          {snapshot.stations.slice(0, 12).map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)}>
              <span>{s.name}</span>
              <strong style={{ color: airColor(s.points[hour].p50) }}>
                {Math.round(s.points[hour].p50)} µg/m³
              </strong>
            </button>
          ))}
        </div>
      )}
      {timeControls}
    </section>
  );
  const airCard = (
    <section className="card air-card">
      <div className="air-card-top">
        <SectionLabel>YOUR AIR, AT A GLANCE</SectionLabel>
        <button
          className="icon-button"
          title="Share forecast"
          aria-label="Share forecast"
          onClick={share}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <h2>{station.name}</h2>
      <div
        className="segmented air-metric-toggle"
        aria-label="Air quality metric"
      >
        <button
          className={metric === "aqi" ? "active" : ""}
          onClick={() => setMetric("aqi")}
        >
          AQI estimate
        </button>
        <button
          className={metric === "pm" ? "active" : ""}
          onClick={() => setMetric("pm")}
        >
          PM2.5
        </button>
      </div>
      <p className="air-time">
        {dateLabel(point.time)} · {hourLabel(point.time)} IST{" "}
        <Badge tone="green">
          {isOutlook
            ? "OUTLOOK"
            : displayKind === "actual"
              ? "MEASURED"
              : displayKind === "diff"
                ? "ABS. ERROR"
                : "MODELLED"}
        </Badge>
      </p>
      <div className="air-reading">
        <div>
          <div className="big-number">
            {displayValue === null ? "—" : Math.round(displayValue)}
            <span>{metric === "aqi" ? "/ 500" : "µg/m³"}</span>
          </div>
          <span className="reading-label">
            {displayValue === null
              ? "Insufficient rolling-day measurements"
              : metric === "aqi"
                ? displayKind === "diff"
                  ? "Absolute PM2.5 sub-index error"
                  : "AQI estimate · PM2.5 only · 24h"
                : displayKind === "diff"
                  ? "Absolute PM2.5 forecast error"
                  : "Hourly PM2.5 concentration"}
          </span>
        </div>
        <div
          className="air-gauge"
          style={
            {
              "--air-color": airColor(point.mean24),
              "--gauge": `${Math.min(95, ((forecastIndex ?? 0) / 500) * 100)}%`,
            } as React.CSSProperties
          }
        >
          <Wind size={30} />
        </div>
      </div>
      <div className="air-status">
        <span style={{ background: airColor(point.mean24) }} />
        <strong>{categories[level(point.mean24)]}</strong>
        <span>24h PM2.5 band</span>
      </div>
      <div className="concentration-scale">
        <span
          style={{ left: `${Math.min(98, (point.mean24 / 300) * 100)}%` }}
        />
      </div>
      <div className="interval-row">
        <span>
          {isOutlook ? "Historical PM2.5 spread" : "PM2.5 forecast range"}{" "}
          <InfoCircle historical={isOutlook} />
        </span>
        <strong>
          {Math.round(point.p10)}–{Math.round(point.p90)} <span>µg/m³</span>
        </strong>
      </div>
      <div className="concentration-detail">
        <span>
          Hourly PM2.5 {displayKind === "actual" ? "measured" : "modelled"}
        </span>
        <strong>
          {concentrationValue === null ? "—" : Math.round(concentrationValue)}{" "}
          µg/m³
        </strong>
      </div>
      <p className="aqi-fine">
        PM2.5 sub-index, not the official multi-pollutant AQI.{" "}
        {isOutlook
          ? "Historical-analog outlook, not live conditions."
          : "Archived replay, not today’s air."}
      </p>
      <div className="air-summary-row">
        <TrendingUp size={17} />
        <div>
          <span>Forecast peak</span>
          <strong>
            {Math.round(highest.p50)} µg/m³{" "}
            <small>
              · {dateLabel(highest.time)}, {hourLabel(highest.time)}
            </small>
          </strong>
        </div>
      </div>
      <div className="air-summary-row">
        <Sun size={17} />
        <div>
          <span>Below Poor after peak</span>
          <strong>
            {clear
              ? `${dateLabel(clear.time)}, ${hourLabel(clear.time)}`
              : "Not indicated within 72h"}
            <small>{clear ? " · model estimate" : ""}</small>
          </strong>
        </div>
      </div>
      <button
        className="primary-button full"
        onClick={() => setAlertOpen(true)}
      >
        <Bell size={15} />
        Set an air preference
        <ArrowUpRight size={15} />
      </button>
      <div className="air-card-foot">
        <span className="tiny-dot" />
        {isOutlook ? "Historical analogs" : "Candidate model"}{" "}
        <span>
          {isOutlook ? "Starts" : "Issued"} {dateLabel(station.origin)},{" "}
          {hourLabel(station.origin)}
        </span>
      </div>
    </section>
  );
  return (
    <div
      className={`app-shell ${lite ? "lite-mode" : ""} ${tour !== null ? "tour-active" : ""}`}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <Link href="/" className="brand-link" aria-label="Shwāsa home">
          <Brand />
        </Link>
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <Search size={15} />
          <span>Find a neighborhood</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <span className="nav-group-label">{group.group}</span>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={href(item.id)}
                  className={`nav-link ${activeView === item.id ? "active" : ""}`}
                  onClick={() => {
                    setMobile(false);
                    setTour(null);
                    tourRestore.current = null;
                  }}
                >
                  <item.icon size={17} />
                  <span>{hindi ? item.hi : item.label}</span>
                  {item.tag && <small>{item.tag}</small>}
                  {activeView === item.id && <i />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="city-mini">
            <div className="city-icon">
              <MapPin size={17} />
            </div>
            <div>
              <strong>Delhi-NCR</strong>
              <span>Our first shared breath</span>
            </div>
            <span className="tiny-dot" />
          </div>
          <button
            className="judge-link"
            onClick={() => void startTour()}
            disabled={busy}
          >
            <MonitorPlay size={16} />
            Take the guided tour <kbd>J</kbd>
          </button>
          <div className="sidebar-caption">
            <Leaf size={12} />A little foresight. A better breath.
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>YOUR NEIGHBORHOOD, UNDERSTOOD</span>
            <span className="breadcrumb-divider">/</span>
            <strong>
              {navigation
                .flatMap((n) => n.items)
                .find((n) => n.id === activeView)?.label ?? "Overview"}
            </strong>
          </div>
          <div className="top-actions">
            <button className="locale-button" onClick={() => setHindi(!hindi)}>
              {hindi ? "EN" : "हिं"}
              <span>{hindi ? "English" : "हिन्दी"}</span>
            </button>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Use day theme" : "Use night theme"}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="notification-button"
              onClick={() => setAlertOpen(true)}
              aria-label="Air preferences"
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className="avatar"
              onClick={() => navigate("my-air")}
              aria-label="Open My Air"
            >
              S
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <div className="heading-eyebrow">
                <span className="tiny-dot" />
                {hindi ? "साँस लेने की जगह" : "MAKE ROOM TO BREATHE"}
              </div>
              <h1>
                {hindi && activeView === ""
                  ? "हवा को थोड़ा पहले जानें।"
                  : label[0]}
              </h1>
              <p>{label[1]}</p>
            </div>
            <div className="heading-controls">
              {selector}
              <button className="secondary-button share-button" onClick={share}>
                <ArrowUpRight size={15} />
                Share
              </button>
            </div>
          </div>
          {activeView === "" && isOutlook && (
            <section className="festival-banner">
              <div className="festival-date">
                <span>NOVEMBER</span>
                <strong>08</strong>
                <span>DIWALI 2026</span>
              </div>
              <div className="festival-copy">
                <SectionLabel>THE FESTIVAL, A LITTLE AHEAD</SectionLabel>
                <h2>More light. A little more foresight.</h2>
                <p>
                  Explore the build-up, Diwali night, and the days after.
                  Grounded in past festivals. Honest about the future.
                </p>
                <div>
                  <Badge tone="green">
                    {snapshot.stations.length} monitored places
                  </Badge>
                  <Badge>2014–2025 historical evidence</Badge>
                  <Badge>Rolling historical backtest</Badge>
                </div>
              </div>
              <button
                className="festival-tour"
                onClick={() => void startTour()}
                disabled={busy}
              >
                <MonitorPlay size={21} />
                <span>
                  Show me the story<small>6 steps · at your pace</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </section>
          )}
          <div className="context-bar">
            <div>
              <Badge tone="orange">
                {isOutlook
                  ? "2026 OUTLOOK"
                  : snapshot.id === "latest"
                    ? "ARCHIVED INPUTS"
                    : "REPLAY"}
              </Badge>
              <strong>
                {snapshot.id === "latest"
                  ? "Latest collected data"
                  : `Diwali ${snapshot.year}`}
              </strong>
              <span className="context-dot">·</span>
              <span>{snapshot.phase}</span>
              <span className="context-dot">·</span>
              <span>{snapshot.stations.length} monitored places</span>
            </div>
            <div className="context-actions">
              <span>
                {isOutlook
                  ? "Historical analogs · not live"
                  : "Not a live feed"}
              </span>
              <select
                aria-label="Choose data period"
                value={snapshot.id === "latest" ? "latest" : year}
                onChange={(e) =>
                  e.target.value === "latest"
                    ? void loadSnapshot("latest")
                    : changeReplay(Number(e.target.value), phase)
                }
              >
                <option value="latest">Latest collected</option>
                {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                  <option key={y} value={y}>
                    Diwali {y}
                    {y === 2026 ? " · Outlook" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="model-caution">
            <ShieldCheck size={13} />
            <span>
              {isOutlook
                ? "2026 is an analog-based seasonal outlook. Historical spread is not a calibrated prediction interval."
                : "Experimental v1: severe Diwali peaks are underestimated."}{" "}
              <Link href="/report-card">See the model recheck ↗</Link>
            </span>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => loadSnapshot(snapshot.id)}>Retry</button>
            </div>
          )}
          {busy && (
            <div className="loading-bar" role="status">
              Loading archived station inputs…
            </div>
          )}
          {(activeView === "" ||
            activeView === "map" ||
            activeView === "time-machine" ||
            activeView === "my-air") && (
            <>
              {(activeView === "time-machine" ||
                (isOutlook && ["", "map", "my-air"].includes(activeView))) && (
                <div className="replay-toolbar">
                  <div className="phase-tabs">
                    {[
                      {
                        id: "before",
                        name: "Build-up",
                        label: "T−48h",
                        icon: Sun,
                      },
                      {
                        id: "during",
                        name: "The burst",
                        label: "Diwali evening",
                        icon: Activity,
                      },
                      {
                        id: "after",
                        name: "Hangover",
                        label: "T+24h",
                        icon: Wind,
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        className={phase === p.id ? "active" : ""}
                        onClick={() => changeReplay(year, p.id)}
                      >
                        <p.icon size={17} />
                        <span>
                          {p.name}
                          <small>{p.label}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="segmented">
                    <button
                      onClick={() => setPlotMode("forecast")}
                      className={plotMode === "forecast" ? "active" : ""}
                    >
                      Forecast
                    </button>
                    <button
                      disabled={isOutlook}
                      title={
                        isOutlook
                          ? "2026 has no future observations"
                          : "Show measurements"
                      }
                      onClick={() => setPlotMode("actual")}
                      className={plotMode === "actual" ? "active" : ""}
                    >
                      Actual
                    </button>
                    <button
                      disabled={isOutlook}
                      title={
                        isOutlook
                          ? "2026 cannot yet be scored"
                          : "Show forecast error"
                      }
                      onClick={() => setPlotMode("diff")}
                      className={plotMode === "diff" ? "active" : ""}
                    >
                      Difference
                    </button>
                  </div>
                </div>
              )}
              {activeView === "my-air" ? (
                <>
                  <div className="my-air-grid">
                    {airCard}
                    <div className="my-air-chart">
                      {chart}
                      <div className="weather-strip">
                        <Weather
                          icon={Thermometer}
                          label="Temperature"
                          value={
                            station.weather.missing
                              ? "Unavailable"
                              : `${station.weather.temperature.toFixed(0)}°C`
                          }
                        />
                        <Weather
                          icon={Wind}
                          label="Wind speed"
                          value={
                            station.weather.missing
                              ? "Unavailable"
                              : `${station.weather.wind.toFixed(1)} m/s`
                          }
                        />
                        <Weather
                          icon={Activity}
                          label="Relative humidity"
                          value={
                            station.weather.missing
                              ? "Unavailable"
                              : `${Math.round(station.weather.humidity)}%`
                          }
                        />
                        <Weather
                          icon={ShieldCheck}
                          label="PM2.5 sub-index"
                          value={
                            point.aqi === null
                              ? "Unavailable"
                              : String(point.aqi)
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <Advice
                    station={station}
                    profile={profile}
                    setProfile={setProfile}
                  />
                </>
              ) : (
                <>
                  <div className="overview-grid">
                    {mapCard}
                    <div className="overview-aside">
                      {airCard}
                      <div className="weather-mini">
                        <div>
                          <Wind size={18} />
                          <span>At the forecast origin</span>
                        </div>
                        <strong>
                          {station.weather.missing
                            ? "Weather unavailable"
                            : `${station.weather.wind.toFixed(1)} m/s wind · ${Math.round(station.weather.temperature)}°C`}
                        </strong>
                        <button
                          onClick={() => navigate("status")}
                          aria-label="View weather source"
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {activeView === "time-machine" && (
                    <InfoNote>
                      {isOutlook
                        ? "2026 observations do not exist yet. This curve uses festival-aligned historical medians, not future measurements or weather. Actual and difference views are disabled."
                        : snapshot.year <= 2023
                          ? "This replay uses years included in fitting; it is an in-sample demonstration."
                          : snapshot.year === 2024
                            ? "This replay uses the uncertainty-calibration year; it is not an untouched test."
                            : "2025 was held out from fitting and calibration. These are retrospective forecasts, reconstructed from archived inputs."}{" "}
                      Actual and error layers use only available measurements.
                      Cells without nearby measurements are grey; consult the
                      station chart for gaps.
                    </InfoNote>
                  )}
                  <div className="lower-grid">
                    {chart}
                    <section className="window-card">
                      <div className="window-illustration">
                        <Sun size={36} strokeWidth={1} />
                        <span />
                        <span />
                      </div>
                      <SectionLabel>A LITTLE LESS EXPOSURE</SectionLabel>
                      <h2>Find your breathing room.</h2>
                      <p>
                        The lowest modelled three-hour window for this forecast.
                      </p>
                      <div className="window-time">
                        {hourLabel(best.start.time)}
                        <ArrowRight size={19} />
                        {hourLabel(best.end.time)}
                      </div>
                      <span className="window-date">
                        {dateLabel(best.start.time)} · {Math.round(best.mean)}{" "}
                        µg/m³ average
                      </span>
                      <ArrowLink
                        onClick={() => {
                          setHour(best.start.hour - 1);
                          navigate("my-air");
                        }}
                      >
                        See my air
                      </ArrowLink>
                      <span className="window-fine">
                        Lower exposure doesn’t mean risk-free.
                      </span>
                    </section>
                  </div>
                </>
              )}
              {activeView === "" && (
                <div className="insight-grid">
                  <button
                    className="insight-card"
                    onClick={() => navigate("why")}
                  >
                    <span className="insight-icon">
                      <Activity size={20} />
                    </span>
                    <div>
                      <h3>A forecast with an explanation.</h3>
                      <p>See what goes into the number.</p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="insight-card"
                    onClick={() => navigate("lab")}
                  >
                    <span className="insight-icon warm">
                      <SlidersHorizontal size={20} />
                    </span>
                    <div>
                      <h3>Small changes. Different air?</h3>
                      <p>Explore a traffic or wind scenario.</p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="insight-card"
                    onClick={() => navigate("report-card")}
                  >
                    <span className="insight-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <h3>Our model, on the record.</h3>
                      <p>Real errors. An open report card.</p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
          {activeView === "why" &&
            (isOutlook ? (
              <OutlookEvidence
                snapshot={snapshot}
                station={station}
                hour={hour}
              />
            ) : (
              <WhyView station={station} hour={hour} />
            ))}
          {activeView === "lab" && isOutlook && (
            <section className="card prose">
              <SectionLabel>CHOOSE THE RIGHT TOOL</SectionLabel>
              <h2>An outlook is not a policy experiment.</h2>
              <p>
                The 2026 curve is a historical-analog median. Traffic and wind
                changes cannot be applied as causal effects to this curve. The
                regression scenario lab remains available for historical replay.
              </p>
              <button
                className="primary-button"
                style={{ marginTop: 20 }}
                onClick={() => loadSnapshot("2025-during")}
              >
                Open the 2025 scenario lab <ArrowUpRight size={14} />
              </button>
            </section>
          )}
          {activeView === "lab" && !isOutlook && (
            <LabView
              snapshot={snapshot}
              station={station}
              hour={hour}
              onSelect={setSelected}
              notify={notify}
            />
          )}
          {activeView === "compare" && (
            <CompareView stations={snapshot.stations} station={station} />
          )}
          {activeView === "report-card" && (
            <ReportCardView registry={registry} />
          )}
          {activeView === "authority" && (
            <AuthorityView snapshot={snapshot} notify={notify} />
          )}
          {(activeView === "report" || activeView === "pledge") && (
            <CommunityView station={station} notify={notify} />
          )}
          {activeView === "about" && <AboutView registry={registry} />}
          {activeView === "status" && (
            <StatusView snapshot={snapshot} registry={registry} />
          )}
          {activeView === "embed" && (
            <div className="embed-page">
              {airCard}
              <div className="card prose">
                <h2>A forecast worth sharing.</h2>
                <p>
                  Embed a read-only neighborhood forecast. The archive and model
                  labels travel with it.
                </p>
                <code>{`<iframe src="${typeof window === "undefined" ? "" : window.location.origin}/embed?station=${station.id}" title="Shwāsa air forecast" width="380" height="640"></iframe>`}</code>
                <button className="secondary-button" onClick={share}>
                  Copy forecast link
                </button>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Brand small />A breath of fresh air, one neighborhood at a time.
            </span>
            <div>
              <button
                onClick={() => {
                  setLite(!lite);
                  localStorage.setItem("shwasa-lite", !lite ? "1" : "0");
                }}
              >
                {lite ? "Full experience" : "Lite mode"}
              </button>
              <Link href="/about">Sources & methodology</Link>
              <span>
                Made for a cleaner Diwali <Leaf size={12} />
              </span>
            </div>
          </footer>
        </main>
        <button className="assistant-launch" onClick={() => setAssistant(true)}>
          <span className="assistant-symbol">
            <Wind size={18} />
          </span>
          <span>Ask Vayu</span>
          <Plus size={15} />
        </button>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {searchOpen && (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <div
            className="command-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Find a neighborhood"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="command-input">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Where would you like to breathe easier?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered[0]) {
                    setSelected(filtered[0].id);
                    setSearchOpen(false);
                  }
                }}
              />
              <button
                className="icon-button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <button
              className="location-command"
              onClick={() => {
                void locate();
                setSearchOpen(false);
              }}
            >
              <LocateFixed size={17} />
              Use my approximate location<span>On-device only</span>
            </button>
            <div className="command-label">MONITORED PLACES · DELHI-NCR</div>
            <div className="command-results">
              {filtered.length ? (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelected(s.id);
                      setSearchOpen(false);
                    }}
                  >
                    <MapPin size={16} />
                    <div>
                      <strong>{s.name}</strong>
                      <span>Station-supported · {s.h3}</span>
                    </div>
                    <b style={{ color: airColor(s.points[hour].p50) }}>
                      {Math.round(s.points[hour].p50)}
                      <small> µg/m³</small>
                    </b>
                    {s.id === station.id ? (
                      <Check size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </button>
                ))
              ) : (
                <p className="empty-state">
                  No monitored place matches. Try “Anand”, “Dwarka”, or “Noida”.
                </p>
              )}
            </div>
            <div className="command-footer">
              Choose a place to update every view.<kbd>ESC to close</kbd>
            </div>
          </div>
        </div>
      )}
      {alertOpen && (
        <div className="modal-backdrop" onClick={() => setAlertOpen(false)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close preferences"
              onClick={() => setAlertOpen(false)}
            >
              <X size={19} />
            </button>
            <span className="large-icon">
              <Bell size={25} />
            </span>
            <SectionLabel>MY AIR PREFERENCES</SectionLabel>
            <h2 id="alert-title">A little heads-up.</h2>
            <p>
              Save your preferred PM2.5 threshold for {station.name} on this
              device.
            </p>
            <label className="field-label" htmlFor="threshold">
              My threshold · µg/m³
            </label>
            <select
              id="threshold"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            >
              {[30, 60, 90, 120, 250].map((v) => (
                <option key={v} value={v}>
                  {v} µg/m³
                </option>
              ))}
            </select>
            <InfoNote>
              Push and email delivery are not configured. This saves a local
              preference; it won’t send remote notifications.
            </InfoNote>
            <button
              className="primary-button full"
              onClick={() => {
                localStorage.setItem(
                  "shwasa-alert",
                  JSON.stringify({ station: station.id, threshold }),
                );
                setAlertOpen(false);
                notify(
                  "Preference saved on this device. Remote alerts are not active.",
                );
              }}
            >
              Save preference
              <Check size={16} />
            </button>
            <button
              className="text-link centered"
              onClick={() => {
                localStorage.removeItem("shwasa-alert");
                setAlertOpen(false);
                notify("Local alert preference removed.");
              }}
            >
              Remove saved preference
            </button>
          </section>
        </div>
      )}
      {assistant && (
        <div
          className="assistant-panel"
          role="dialog"
          aria-label="Vayu forecast assistant"
        >
          <div className="assistant-head">
            <Brand small />
            <button
              className="icon-button"
              aria-label="Close assistant"
              onClick={() => setAssistant(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="assistant-body">
            <SectionLabel>MEET VAYU</SectionLabel>
            <h2>
              A little clarity,
              <br />
              on the air.
            </h2>
            <p>
              I can explain this forecast, find a lower-exposure window, or tell
              you about the model.
            </p>
            <Badge tone="green">Grounded template · no LLM</Badge>
            <div className="suggestions">
              {[
                "When is exposure lowest?",
                "Why is my air like this?",
                "What is the forecast peak?",
              ].map((q) => (
                <button key={q} onClick={() => ask(q)}>
                  {q}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            {answer && (
              <div className="assistant-answer">
                <Wind size={18} />
                <p>{answer}</p>
                <small>
                  Source: {station.name} · {snapshot.id} · MODELLED
                </small>
              </div>
            )}
            {asking && <p role="status">Reading your forecast…</p>}
          </div>
          <form
            className="assistant-input"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <input
              aria-label="Ask about this forecast"
              placeholder="Ask about your air…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
            />
            <button
              type="submit"
              className="primary-button"
              disabled={asking}
              aria-label="Send question"
            >
              <ArrowUpRight size={18} />
            </button>
          </form>
          <small className="assistant-fine">
            Archived model estimates. Not medical advice.
          </small>
        </div>
      )}
      {tour !== null && (
        <div
          className="tour-card"
          role="dialog"
          aria-labelledby="tour-title"
          aria-describedby="tour-description"
        >
          <div className="tour-top">
            <span>
              <MonitorPlay size={14} />
              THE SHWĀSA WALKTHROUGH
            </span>
            <button
              className="icon-button"
              aria-label="End tour"
              onClick={endTour}
            >
              <X size={16} />
            </button>
          </div>
          <div className="tour-dots">
            {tourSteps.map((_, i) => (
              <button
                key={i}
                aria-label={`Tour step ${i + 1}`}
                className={i === tour ? "active" : ""}
                disabled={busy}
                aria-current={i === tour ? "step" : undefined}
                onClick={() => void goToTourStep(i)}
              />
            ))}
          </div>
          <h3 id="tour-title">{tourSteps[tour].title}</h3>
          <p id="tour-description" aria-live="polite">
            {tourSteps[tour].text}
          </p>
          <div className="tour-bottom">
            <span>
              Step {tour + 1} of {tourSteps.length}
            </span>
            <div className="tour-navigation">
              <button
                className="tour-previous"
                disabled={busy || tour === 0}
                onClick={() => void goToTourStep(tour - 1)}
              >
                Back
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (tour === tourSteps.length - 1) endTour();
                  else void goToTourStep(tour + 1);
                }}
              >
                {busy
                  ? "Loading…"
                  : tour === tourSteps.length - 1
                    ? "Finish"
                    : "Next"}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function InfoCircle({ historical = false }: { historical?: boolean }) {
  return (
    <span
      title={
        historical
          ? "Historical 10th to 90th percentile range across earlier Diwali seasons. Not a calibrated prediction interval."
          : "Nominal 80% prediction interval, calibrated on 2024. Actual coverage is measured on 2025."
      }
      className="info-circle"
    >
      i
    </span>
  );
}
function Weather({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Advice({
  station,
  profile,
  setProfile,
}: {
  station: Station;
  profile: string;
  setProfile: (p: string) => void;
}) {
  const best = bestWindow(station.points);
  return (
    <section className="card advice-card">
      <CardHead
        title="Make a little room for better air."
        subtitle="General exposure guidance, adapted to your selected profile."
      >
        <select
          aria-label="Health profile"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
        >
          <option value="general">General</option>
          <option value="child">Children</option>
          <option value="older">Older adults</option>
          <option value="sensitive">Heart or lung conditions</option>
          <option value="outdoor">Outdoor workers</option>
        </select>
      </CardHead>
      <div className="advice-columns">
        <div>
          <Sun size={22} />
          <h3>Choose your moment.</h3>
          <p>
            The model’s lowest three-hour window starts{" "}
            {dateLabel(best.start.time)}, {hourLabel(best.start.time)}. Lower
            doesn’t mean safe.
          </p>
        </div>
        <div>
          <Wind size={22} />
          <h3>Give busy roads some space.</h3>
          <p>
            Consider a route away from heavy traffic and adjust the time or
            intensity of outdoor activity during polluted periods.
          </p>
        </div>
        <div>
          <Heart size={22} />
          <h3>
            {profile === "general"
              ? "Keep official guidance close."
              : "A little extra care."}
          </h3>
          <p>
            {profile === "general"
              ? "Check official local air-quality advisories before planning strenuous outdoor activity."
              : "Children, older adults and people with heart or lung conditions can be more vulnerable. Follow your clinician’s individual advice."}
          </p>
        </div>
      </div>
      <div className="advice-foot">
        General information, not medical advice.{" "}
        <a
          href="https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication"
          target="_blank"
          rel="noreferrer"
        >
          WHO exposure guidance <ExternalLink size={11} />
        </a>
      </div>
    </section>
  );
}
