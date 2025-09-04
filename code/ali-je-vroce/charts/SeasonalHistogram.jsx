// code/ali-je-vroce/charts/SeasonalHistogram.jsx
import { createSignal, createEffect, Show } from "solid-js";
import { Highchart } from "./Highchart.jsx";
import { requestHistoricalWindow } from "../helpers";

/**
 * Non-Gaussian smoothed histogram (Epanechnikov KDE) for the 15-day window.
 * Props:
 *  - stationId: number|string
 *  - center_mmdd: "MM-DD"
 *  - todayTemp?: number | null
 *  - title?: string
 */
export default function SeasonalHistogram(props) {
  const [loading, setLoading] = createSignal(true);
  const [err, setErr] = createSignal("");
  const [options, setOptions] = createSignal(null);

  let lastKey = null;

  createEffect(() => {
    const sid = props.stationId;
    const mmdd = props.center_mmdd;
    const today = props.todayTemp ?? "";
    if (!sid || !mmdd) return;
    const key = `${sid}|${mmdd}|${today}`;
    if (key !== lastKey) {
      lastKey = key;
      load();
    }
  });

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const rows = await requestHistoricalWindow({
        station_id: props.stationId,
        center_mmdd: props.center_mmdd,
        window_days: 14,
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Ni podatkov za krivuljo.");
      }

      const temps = rows.map(r => Number(r.tavg)).filter(Number.isFinite);
      if (temps.length === 0) throw new Error("Ni veljavnih vrednosti temperature.");

      // percentiles from the raw data
      const sorted = [...temps].sort((a, b) => a - b);
      const p05 = percentile(sorted, 5);
      const p50 = percentile(sorted, 50);
      const p95 = percentile(sorted, 95);

      // ---- Epanechnikov KDE (non-Gaussian) ----
      const minT = Math.min(...temps);
      const maxT = Math.max(...temps);
      const padding = 0.5; // °C
      const xMin = Math.floor(minT - padding);
      const xMax = Math.ceil(maxT + padding);

      // Robust bandwidth
      const IQR = percentile(sorted, 75) - percentile(sorted, 25);
      const robustBW = IQR > 0
        ? (2 * IQR) / Math.cbrt(temps.length)
        : (stddev(temps) * 1.06) / Math.cbrt(temps.length);
      const h = clamp(robustBW, 0.2, 2.5);

      const step = 0.1; // °C resolution of the curve
      const xs = [];
      for (let x = xMin; x <= xMax + 1e-9; x += step) xs.push(x);

      const K = (u) => (Math.abs(u) >= 1 ? 0 : 0.75 * (1 - u * u));

      const N = temps.length;
      const density = xs.map(x => {
        let s = 0;
        for (let i = 0; i < N; i++) s += K((x - temps[i]) / h);
        return s / (N * h);
      });

      // scale density to approximate counts
      const areaApprox = density.reduce((a, b) => a + b, 0) * step;
      const scale = areaApprox > 0 ? (N / areaApprox) : 1;
      const ys = density.map(d => d * scale);

      // split by percentile ranges for fill styling
      const left = [];
      const mid = [];
      const right = [];
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i], y = ys[i];
        left.push(x <= p05 ? [x, y] : [x, null]);
        mid.push(x >= p05 && x <= p95 ? [x, y] : [x, null]);
        right.push(x >= p95 ? [x, y] : [x, null]);
      }

      const yMax = Math.max(...ys) * 1.12; // a bit of headroom
      const todayVal = (props.todayTemp != null && Number.isFinite(Number(props.todayTemp))) ? Number(props.todayTemp) : null;

      setOptions(makeOptions({
        left, mid, right,
        p05, p50, p95,
        today: todayVal,
        yMax,
        title: props.title || `Distribution around ${props.center_mmdd}`,
      }));
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Show when={!loading()} fallback={<div class="text-sm text-gray-500">Nalagam …</div>}>
      <Show when={!err()} fallback={<div class="text-red-600 text-sm">Napaka: {err()}</div>}>
        <Highchart options={options()} />
      </Show>
    </Show>
  );
}

/* ---------------- helpers ---------------- */

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return NaN;
  const idx = (sortedAsc.length - 1) * (p / 100);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function stddev(a) {
  const m = mean(a);
  const v = a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1);
  return Math.sqrt(v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* --------------- chart options --------------- */

function makeOptions({ left, mid, right, p05, p50, p95, today, yMax, title }) {
  // Build label-only scatter “points” (works without annotations module)
  const labelPoint = (x, text, cfg = {}) => ({
    x,
    y: yMax * (cfg.topFrac ?? 0.96),
    marker: { enabled: false },
    dataLabels: {
      enabled: true,
      rotation: -90,
      align: "center",
      verticalAlign: "top",
      y: 0,
      x: cfg.dx ?? 0,        // small horizontal nudge
      style: {
        color: cfg.color ?? "#666",
        fontWeight: cfg.bold ? "700" : "500",
        fontSize: cfg.size ?? "12px",
        textOutline: "none",
      },
      crop: false,
      overflow: "allow",
      formatter() { return text; },
    }
  });

  const labelSeries = {
    name: "labels",
    type: "scatter",
    data: [
      labelPoint(p05, "5th percentile", { dx: -10 }),
      labelPoint(p50, "50th percentile"),
      labelPoint(p95, "95th percentile", { dx: 10 }),
      ...(Number.isFinite(today)
        ? [labelPoint(today, `TODAY: ${today.toFixed(1)}°C`, { dx: 12, color: "#111", bold: true, size: "13px" })]
        : [])
    ],
    enableMouseTracking: false,
    showInLegend: false
  };

  return {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      spacingTop: 52,   // room for title
      spacingRight: 20,
      spacingLeft: 10
    },
    title: { text: title, y: 10 },
    xAxis: {
      title: { text: "Povprečna dnevna temperatura (°C)" },
      lineColor: "#ccc",
      tickAmount: 8,
      plotLines: [
        { color: "#666", width: 1, value: p05, dashStyle: "Dash", zIndex: 4 },
        { color: "#666", width: 1, value: p50, dashStyle: "Dash", zIndex: 4 },
        { color: "#666", width: 1, value: p95, dashStyle: "Dash", zIndex: 4 },
        ...(Number.isFinite(today) ? [{ color: "#111", width: 3, value: today, dashStyle: "Solid", zIndex: 5 }] : [])
      ],
    },
    yAxis: {
      title: { text: "Frekvenca (štetje)" },
      min: 0,
      max: yMax,
      gridLineColor: "rgba(0,0,0,0.06)"
    },
    legend: { enabled: false },
    tooltip: {
      shared: false,
      headerFormat: "",
      pointFormat: "<b>{point.x:.1f}°C</b><br/>Ocena frekvence: {point.y:.0f}"
    },
    series: [
      {
        name: "≤ 5th",
        data: left,
        color: "rgba(40, 120, 220, 0.65)",
        fillOpacity: 0.35,
        lineWidth: 2,
        marker: { enabled: false },
        enableMouseTracking: true
      },
      {
        name: "5th–95th",
        data: mid,
        color: "rgba(255, 140, 80, 0.85)",
        fillOpacity: 0.25,
        lineWidth: 2,
        marker: { enabled: false },
        enableMouseTracking: true
      },
      {
        name: "≥ 95th",
        data: right,
        color: "rgba(180, 30, 40, 0.75)",
        fillOpacity: 0.25,
        lineWidth: 2,
        marker: { enabled: false },
        enableMouseTracking: true
      },
      // label-only series (always on top)
      labelSeries
    ],
    credits: { enabled: false }
  };
}