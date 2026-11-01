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
  airCategory,
  pmSubindex,
  observedDayMean,
  bestWindow,
  clearBy,
  dateLabel,
  fullDate,
  hourLabel,
  peak,
} from "../lib/air";
import { ForecastChart } from "./forecast-chart";
import {
  AirStatus,
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
      Loading the map…
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
      { id: "map", label: "Air map", hi: "मानचित्र", icon: Map },
      { id: "my-air", label: "My Air", hi: "मेरी हवा", icon: Wind },
      {
        id: "time-machine",
        label: "Past Diwalis",
        hi: "समय यात्रा",
        icon: Clock3,
        tag: "PAST YEAR",
      },
    ],
  },
  {
    group: "EXPLORE",
    items: [
      {
        id: "why",
        label: "How estimates work",
        hi: "कारण जानें",
        icon: Activity,
      },
      {
        id: "lab",
        label: "Change conditions",
        hi: "परिदृश्य लैब",
        icon: FlaskConical,
      },
      {
        id: "compare",
        label: "Compare areas",
        hi: "स्थानों की तुलना",
        icon: GitCompareArrows,
      },
      { id: "authority", label: "City planning", hi: "शहर डेस्क", icon: Users },
    ],
  },
  {
    group: "ABOUT THE DATA",
    items: [
      {
        id: "report-card",
        label: "Model results",
        hi: "मॉडल रिपोर्ट",
        icon: BarChart3,
      },
      { id: "report", label: "Community", hi: "समुदाय", icon: Heart },
      {
        id: "about",
        label: "How it works",
        hi: "हमारी पद्धति",
        icon: BookOpen,
      },
      {
        id: "status",
        label: "Data sources",
        hi: "डेटा की स्थिति",
        icon: Radio,
      },
    ],
  },
];
const headings: Record<string, [string, string]> = {
  "": ["Delhi-NCR air quality", "Choose an area to see air quality estimates."],
  map: ["Air quality map", "Compare pollution across Delhi-NCR."],
  "my-air": ["Your area", "See hourly estimates for your area."],
  "time-machine": [
    "Past Diwalis",
    "See pollution before, during and after Diwali.",
  ],
  why: ["How estimates work", "See what the estimate is based on."],
  lab: [
    "Change traffic and wind",
    "Adjust the settings to see how the estimate changes.",
  ],
  compare: ["Compare areas", "Compare hourly estimates for two areas."],
  "report-card": [
    "Model results",
    "See how estimates compare with recorded pollution.",
  ],
  authority: ["City planning", "Find areas that may need attention."],
  report: ["Report smoke or dust", "Tell us what you see in your area."],
  pledge: ["Clean Diwali pledge", "Pledge to celebrate with less smoke."],
  about: [
    "How it works",
    "How we make estimates and where the data comes from.",
  ],
  status: ["Data sources", "Check which data is available."],
  embed: ["Share this forecast", "Add an area forecast to your website."],
};
const tourSteps = [
  {
    view: "",
    snapshot: "2026-during",
    title: "Diwali 2026 estimates",
    text: "The 2026 estimates use readings from past Diwalis. They are not live readings.",
  },
  {
    view: "time-machine",
    snapshot: "2025-during",
    title: "Past Diwali readings",
    text: "Choose a past year. Compare estimates with the pollution that was recorded.",
  },
  {
    view: "why",
    snapshot: "2025-during",
    title: "How the model makes estimates",
    text: "See how pollution history, weather and other data affect the estimate. This does not prove what caused the pollution.",
  },
  {
    view: "lab",
    snapshot: "2025-during",
    title: "Change traffic and wind",
    text: "Change the traffic and wind settings. These examples do not prove that a policy would have the same effect.",
  },
  {
    view: "report-card",
    snapshot: "2025-during",
    title: "Check the results",
    text: "Compare estimates with past readings. See the errors and known problems.",
  },
  {
    view: "authority",
    snapshot: "2026-during",
    title: "Choose areas to check",
    text: "See areas with high estimates and download the list. This page does not send teams or alerts.",
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
    [plotMode, setPlotMode] = useState(
      initial.kind === "outlook" ? "forecast" : "actual",
    ),
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
    plotMode: string;
    metric: "aqi" | "pm";
  } | null>(null);
  const initialQuery = useRef<string | null>(null);
  const readyForUrl = useRef(false);
  const activeView = tour === null ? view : tourSteps[tour].view;
  const isOutlook = snapshot.kind === "outlook";
  const station =
    snapshot.stations.find((s) => s.id === selected) ?? snapshot.stations[0];
  const point = station.points[hour];
  const concentrationValue =
    !isOutlook && plotMode !== "forecast"
      ? point.actual === null
        ? null
        : plotMode === "actual"
          ? point.actual
          : Math.abs(point.p50 - point.actual)
      : point.p50;
  const displayKind = isOutlook ? "forecast" : plotMode;
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
  const valueFor = (s: Station) => {
    const p = s.points.find((p) => p.time === point.time);
    if (!p) return null;
    return displayKind === "actual"
      ? p.actual
      : displayKind === "diff"
        ? p.actual === null
          ? null
          : Math.abs(p.p50 - p.actual)
        : p.p50;
  };
  const categoryMean =
    displayKind === "actual"
      ? observedMean
      : point.aqi === null
        ? null
        : point.mean24;

  const best = bestWindow(station.points),
    highest = peak(station.points),
    clear = clearBy(station.points);
  const recordedPeak = station.points
    .slice(0, 48)
    .filter((p) => p.actual !== null)
    .reduce<Station["points"][number] | null>(
      (best, p) => (best === null || p.actual! > best.actual! ? p : best),
      null,
    );
  const shownPeak = displayKind === "actual" ? recordedPeak : highest;
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
        setPlotMode(next.kind === "outlook" ? "forecast" : "actual");
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
      setPlotMode(saved.plotMode);
      setMetric(saved.metric);
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
    tourRestore.current = { snapshot, hour, selected, plotMode, metric };
    await goToTourStep(0);
  }, [busy, snapshot, hour, selected, plotMode, metric, goToTourStep]);
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
          title: "Air quality estimate",
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
        "Answers are unavailable. You can still use the charts and read How it works.",
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
        title={
          displayKind === "actual"
            ? "Recorded hourly pollution"
            : "Hourly pollution estimates"
        }
        subtitle={
          displayKind === "actual"
            ? "Recorded hourly PM2.5 · µg/m³"
            : isOutlook
              ? "2026 estimates from past Diwalis · µg/m³"
              : "Hourly PM2.5 estimates · µg/m³"
        }
      >
        <div className="chart-key">
          <span>
            <i className="key-line" />
            {displayKind === "actual" ? "Recorded" : "Estimated"}
          </span>
          {displayKind !== "actual" && (
            <span>
              <i className="key-band" />
              {isOutlook ? "Range in past years" : "Expected range (80%)"}
            </span>
          )}
          {activeView === "time-machine" &&
            displayKind !== "actual" &&
            !isOutlook && (
              <span>
                <i className="key-dot" />
                Recorded
              </span>
            )}
        </div>
      </CardHead>
      <ForecastChart
        points={station.points}
        historical={isOutlook}
        recorded={displayKind === "actual"}
        selected={hour}
        onSelect={setHour}
        actual={
          activeView === "time-machine" &&
          displayKind !== "actual" &&
          !isOutlook
        }
      />
      <div className="chart-footer">
        <span>
          <ShieldCheck size={13} />
          Estimates may be wrong.
        </span>
        <button onClick={() => navigate("about")}>
          How estimates work <ArrowUpRight size={13} />
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
          aria-label="Hour shown"
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
          <SectionLabel>DELHI-NCR</SectionLabel>
          <h2>Pollution map</h2>
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
            Range
          </button>
          <button
            className={layer === "confidence" ? "active" : ""}
            onClick={() => setLayer("confidence")}
          >
            Station coverage
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
              <strong style={{ color: airColor(valueFor(s) ?? NaN) }}>
                {valueFor(s) === null ? "No reading" : Math.round(valueFor(s)!)}{" "}
                µg/m³
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
        <SectionLabel>
          {displayKind === "actual"
            ? "RECORDED AIR QUALITY"
            : displayKind === "diff"
              ? "ESTIMATE ERROR"
              : "AIR QUALITY ESTIMATE"}
        </SectionLabel>
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
      {!isOutlook && (
        <div className="segmented air-source-toggle">
          <button
            className={displayKind === "actual" ? "active" : ""}
            onClick={() => setPlotMode("actual")}
          >
            Recorded
          </button>
          <button
            className={displayKind === "forecast" ? "active" : ""}
            onClick={() => setPlotMode("forecast")}
          >
            Estimated
          </button>
        </div>
      )}
      <p className="air-time">
        {fullDate(point.time)}{" "}
        <Badge>
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
          <div
            className="big-number"
            style={{
              color:
                displayValue === null
                  ? "#737373"
                  : displayKind === "diff"
                    ? "#5b21b6"
                    : airColor(
                        metric === "aqi"
                          ? (categoryMean ?? NaN)
                          : (concentrationValue ?? NaN),
                      ),
            }}
          >
            {displayValue === null ? "—" : Math.round(displayValue)}
            <span>{metric === "aqi" ? "/ 500" : "µg/m³"}</span>
          </div>
          <span className="reading-label">
            {displayValue === null
              ? "Not enough readings for 24 hours"
              : metric === "aqi"
                ? displayKind === "diff"
                  ? "AQI estimate error"
                  : "AQI estimate · PM2.5 only · 24 hours"
                : displayKind === "diff"
                  ? "PM2.5 estimate error"
                  : "Hourly PM2.5 concentration"}
          </span>
        </div>
        <div
          className="air-gauge"
          style={
            {
              "--air-color":
                categoryMean === null ? "#737373" : airColor(categoryMean),
              "--gauge": `${Math.min(95, (((displayKind === "actual" ? observedIndex : forecastIndex) ?? 0) / 500) * 100)}%`,
            } as React.CSSProperties
          }
        >
          <Wind size={30} />
        </div>
      </div>
      <div className="air-status">
        <AirStatus pm={categoryMean} />
        <span>24-hour PM2.5 level</span>
      </div>
      <div className="concentration-scale">
        <span
          style={{
            left: `${Math.min(98, ((categoryMean ?? 0) / 300) * 100)}%`,
          }}
        />
      </div>
      {displayKind === "forecast" && (
        <div className="interval-row">
          <span>
            {isOutlook ? "Past PM2.5 range" : "Estimated PM2.5 range"}{" "}
            <InfoCircle historical={isOutlook} />
          </span>
          <strong>
            {Math.round(point.p10)}–{Math.round(point.p90)} <span>µg/m³</span>
          </strong>
        </div>
      )}
      <div className="concentration-detail">
        <span>
          Hourly PM2.5 {displayKind === "actual" ? "recorded" : "estimated"}
        </span>
        <strong>
          {concentrationValue === null ? "—" : Math.round(concentrationValue)}{" "}
          µg/m³
        </strong>
      </div>
      <p className="aqi-fine">
        Uses PM2.5 only. This is not an official AQI reading.{" "}
        {isOutlook
          ? "Based on past Diwalis, not live readings."
          : "Past data, not today’s air."}
      </p>
      <div className="air-summary-row">
        <TrendingUp size={17} />
        <div>
          <span>
            {displayKind === "actual"
              ? "Highest recorded PM2.5 over 48 hours"
              : "Highest estimated PM2.5 over 48 hours"}
          </span>
          <strong>
            {shownPeak === null
              ? "No readings"
              : `${Math.round(displayKind === "actual" ? shownPeak.actual! : shownPeak.p50)} µg/m³`}{" "}
            {shownPeak && <small>· {fullDate(shownPeak.time)}</small>}
          </strong>
        </div>
      </div>
      {displayKind !== "actual" && (
        <div className="air-summary-row">
          <Sun size={17} />
          <div>
            <span>Hourly PM2.5 below 90 after the peak</span>
            <strong>
              {clear
                ? `${dateLabel(clear.time)}, ${hourLabel(clear.time)}`
                : "Not indicated within 72h"}
              <small>{clear ? " · model estimate" : ""}</small>
            </strong>
          </div>
        </div>
      )}
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
        {isOutlook ? "Past Diwali data" : "Experimental model"}{" "}
        <span>
          {isOutlook ? "Starts" : "Issued"} {fullDate(station.origin)}
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
            Website tour <kbd>J</kbd>
          </button>
          <div className="sidebar-caption">
            <Leaf size={12} />
            Air quality for Delhi-NCR
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
            <span>DELHI-NCR AIR QUALITY</span>
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
                {hindi ? "साँस लेने की जगह" : "AIR QUALITY"}
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
                <SectionLabel>6–12 NOVEMBER</SectionLabel>
                <h2>Diwali 2026 air quality</h2>
                <p>
                  Estimates for before, during and after Diwali. Based on past
                  readings, not live data.
                </p>
                <div>
                  <Badge tone="green">
                    {snapshot.stations.length} monitored places
                  </Badge>
                  <Badge>Data from 2014–2025</Badge>
                  <Badge>Checked against past years</Badge>
                </div>
              </div>
              <button
                className="festival-tour"
                onClick={() => void startTour()}
                disabled={busy}
              >
                <MonitorPlay size={21} />
                <span>
                  Start the tour<small>6 steps · at your pace</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </section>
          )}
          <div className="context-bar">
            <div>
              <Badge tone="orange">
                {isOutlook
                  ? "2026 ESTIMATE"
                  : snapshot.id === "latest"
                    ? "PAST DATA"
                    : "PAST YEAR"}
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
                {isOutlook ? "Past Diwali data · not live" : "Not a live feed"}
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
                ? "2026 estimates use past Diwali readings. Actual pollution may be outside the shown range."
                : "The first model often predicts too little pollution during Diwali peaks."}{" "}
              <Link href="/report-card">See known problems ↗</Link>
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
                        name: "Before Diwali",
                        label: "Two days before",
                        icon: Sun,
                      },
                      {
                        id: "during",
                        name: "Diwali night",
                        label: "Diwali evening",
                        icon: Activity,
                      },
                      {
                        id: "after",
                        name: "After Diwali",
                        label: "One day after",
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
                      Estimate
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
                      Recorded
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
                      Error
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
                          label="AQI from PM2.5 only"
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
                        ? "There are no recorded readings for Diwali 2026 yet. These estimates use past Diwalis, so recorded values and errors cannot be shown."
                        : snapshot.year <= 2023
                          ? "This year was used to build the model. It is not an independent accuracy check."
                          : snapshot.year === 2024
                            ? "This year was used to set the expected range. It is not an independent accuracy check."
                            : "These estimates were made later using saved 2025 data. The model was built using earlier years."}{" "}
                      Grey areas have no nearby recorded readings.
                    </InfoNote>
                  )}
                  <div className="lower-grid">
                    {chart}
                    <section
                      className="window-card"
                      style={{
                        borderColor: airColor(best.mean),
                        background: airCategory(best.mean).background,
                      }}
                    >
                      <div className="window-illustration">
                        <Sun size={36} strokeWidth={1} />
                        <span />
                        <span />
                      </div>
                      <SectionLabel>LOWER POLLUTION</SectionLabel>
                      <h2>When pollution may be lower</h2>
                      <p>
                        The three hours with the lowest estimated pollution.
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
                        View my area
                      </ArrowLink>
                      <span className="window-fine">
                        Lower pollution does not mean safe air.
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
                      <h3>How we make estimates</h3>
                      <p>See the data used.</p>
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
                      <h3>Change traffic and wind</h3>
                      <p>Try different settings.</p>
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
                      <h3>Check the model results</h3>
                      <p>See where estimates were wrong.</p>
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
              <SectionLabel>2026 ESTIMATES</SectionLabel>
              <h2>Change settings for a past year</h2>
              <p>
                The 2026 estimate uses past Diwali readings. To try traffic and
                wind settings, choose 2025.
              </p>
              <button
                className="primary-button"
                style={{ marginTop: 20 }}
                onClick={() => loadSnapshot("2025-during")}
              >
                Use 2025 data <ArrowUpRight size={14} />
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
            <CompareView
              stations={snapshot.stations}
              station={station}
              hour={hour}
              onHourChange={setHour}
            />
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
                <h2>Share this forecast</h2>
                <p>Copy this code to show the forecast on your website.</p>
                <code>{`<iframe src="${typeof window === "undefined" ? "" : window.location.origin}/embed?station=${station.id}" title="Shwāsa air forecast" width="380" height="640"></iframe>`}</code>
                <button className="secondary-button" onClick={share}>
                  Copy forecast link
                </button>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <Brand small />
              Air quality estimates for Delhi-NCR.
            </span>
            <div>
              <button
                onClick={() => {
                  setLite(!lite);
                  localStorage.setItem("shwasa-lite", !lite ? "1" : "0");
                }}
              >
                {lite ? "Show map" : "Low-data view"}
              </button>
              <Link href="/about">How it works</Link>
              <span>
                Diwali air quality <Leaf size={12} />
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
                placeholder="Search for an area"
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
              Use my location<span>On-device only</span>
            </button>
            <div className="command-label">AREAS · DELHI-NCR</div>
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
                    <b style={{ color: airColor(valueFor(s) ?? NaN) }}>
                      {valueFor(s) === null
                        ? "No reading"
                        : Math.round(valueFor(s)!)}
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
              Choose an area.<kbd>ESC to close</kbd>
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
            <SectionLabel>SAVED SETTINGS</SectionLabel>
            <h2 id="alert-title">Choose a pollution level</h2>
            <p>Save a PM2.5 level for {station.name} on this device.</p>
            <label className="field-label" htmlFor="threshold">
              PM2.5 level · µg/m³
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
              Saved on this device only. Email and phone alerts are not
              available.
            </InfoNote>
            <button
              className="primary-button full"
              onClick={() => {
                localStorage.setItem(
                  "shwasa-alert",
                  JSON.stringify({ station: station.id, threshold }),
                );
                setAlertOpen(false);
                notify("Saved on this device. Alerts are not available yet.");
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
                notify("Saved setting removed.");
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
            <SectionLabel>ASK A QUESTION</SectionLabel>
            <h2>
              Questions about
              <br />
              air quality
            </h2>
            <p>Ask about the estimate, pollution levels or the data used.</p>
            <Badge tone="green">Answers use this page’s data</Badge>
            <div className="suggestions">
              {[
                "When could I go outside?",
                "Why is this estimate high?",
                "When is pollution highest?",
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
            {asking && <p role="status">Checking the data…</p>}
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
              WEBSITE TOUR
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
          ? "The middle 80% of readings from past Diwalis. Future readings may fall outside this range."
          : "This range was set using errors from 2024. The results page shows how often 2025 readings fell inside it."
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
        title="Planning time outdoors"
        subtitle="Choose a group for general advice."
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
          <h3>Check the time</h3>
          <p>
            The lowest estimated pollution starts {dateLabel(best.start.time)},{" "}
            {hourLabel(best.start.time)}. Lower doesn’t mean safe.
          </p>
        </div>
        <div>
          <Wind size={22} />
          <h3>Avoid busy roads</h3>
          <p>
            Choose routes away from heavy traffic. Reduce hard outdoor exercise
            when pollution is high.
          </p>
        </div>
        <div>
          <Heart size={22} />
          <h3>
            {profile === "general"
              ? "Check official advice"
              : "Take extra care"}
          </h3>
          <p>
            {profile === "general"
              ? "Check official air-quality advice before hard outdoor exercise."
              : "Children, older adults and people with heart or lung conditions may need extra care. Follow your doctor’s advice."}
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
