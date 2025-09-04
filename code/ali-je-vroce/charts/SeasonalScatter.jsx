// code/ali-je-vroce/charts/SeasonalScatter.jsx
import { onMount, createSignal, createEffect, Show } from "solid-js";
import { Highchart } from "./Highchart.jsx";
import { requestHistoricalWindow } from "../helpers";

const WINDOW_DAYS = 14;               // server understands as ±7; we expect 15 points/year
const TODAY_LABEL = "TODAY";

// ---------- utils ----------
function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}
function linreg(xs, ys) {
  const n = xs.length;
  if (!n) return { a: 0, b: 0 };
  const sx = xs.reduce((s, v) => s + v, 0);
  const sy = ys.reduce((s, v) => s + v, 0);
  const sxx = xs.reduce((s, v) => s + v * v, 0);
  const sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return { a: sy / n, b: 0 };
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  return { a, b };
}
function colorFor(z, zmin, zmax) {
  if (!isFinite(z)) return "#aaaaaa";
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const mid = 0.5;
  const u = clamp((z - zmin) / (zmax - zmin || 1));
  let r, g, b;
  if (u <= mid) {
    const k = u / mid;
    r = 0 + (240 - 0) * k; g = 70 + (240 - 70) * k; b = 170 + (240 - 170) * k;
  } else {
    const k = (u - mid) / (1 - mid);
    r = 240 + (200 - 240) * k; g = 240 + (50 - 240) * k; b = 240 + (50 - 240) * k;
  }
  const c = (x) => Math.round(x).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Props:
 *  - stationId: number|string (required)
 *  - center_mmdd: "MM-DD" string (required)
 *  - todayTemp: number (required, live from API)
 *  - title?: string
 */
export default function SeasonalScatter(props) {
  const [opts, setOpts] = createSignal();
  const [loading, setLoading] = createSignal(true);
  const [err, setErr] = createSignal(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const data = await requestHistoricalWindow({
        station_id: props.stationId,
        center_mmdd: props.center_mmdd,
        window_days: WINDOW_DAYS
      });

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No historic data");
      }

      // Expect 15 points per year: {year, day_offset, tavg}
      const years = data.map(d => +d.year);
      const temps = data.map(d => +d.tavg);

      // Percentiles across *all* points in the window (all years * 15 days)
      const sorted = [...temps].sort((a, b) => a - b);
      const p05 = percentile(sorted, 5);
      const p95 = percentile(sorted, 95);
      const med = percentile(sorted, 50);

      // Color by anomaly vs overall median
      const anomalies = temps.map(v => v - med);
      const zmin = Math.min(...anomalies), zmax = Math.max(...anomalies);

      const scatter = data.map((d, i) => ({
        x: +d.year,                   // stack by year on x-axis
        y: +d.tavg,
        // optional: keep offset if we later want to jitter or show tooltip
        day_offset: d.day_offset ?? null,
        marker: { radius: 4, fillColor: colorFor(anomalies[i], zmin, zmax) }
      }));

      // Linear regression across ALL points (years * 15)
      const { a, b } = linreg(years, temps);
      const x0 = Math.min(...years), x1 = Math.max(...years);
      const y0 = a + b * x0, y1 = a + b * x1;
      const trendPerCentury = b * 100;

      // "Today" label plotted slightly to the right of the newest year
      const todayX = x1 + 2;
      const todayPoint = {
        x: todayX,
        y: props.todayTemp,
        marker: { radius: 7, lineWidth: 2, lineColor: "#333" }
      };

      const yMin = Math.floor(Math.min(...temps, props.todayTemp) - 1);
      const yMax = Math.ceil(Math.max(...temps, props.todayTemp) + 1);

      setOpts({
        chart: { type: "scatter", spacingRight: 80, backgroundColor: "transparent" },
        title: { text: props.title || "Daily average temperatures — two weeks window" },
        xAxis: {
          title: { text: null },
          tickInterval: 20,
          min: x0 - 1,
          max: todayX + 1,
          labels: { formatter() { return String(this.value); } }
        },
        yAxis: {
          min: yMin, max: yMax,
          title: { text: "Daily average temperature (°C)" },
          tickAmount: 6,
          plotLines: [
            { value: p95, color: "#666", dashStyle: "Dash", width: 1, zIndex: 3,
              label: { text: `95th percentile: ${p95.toFixed(1)}°C`, align: "right", x: 60 } },
            { value: p05, color: "#666", dashStyle: "Dash", width: 1, zIndex: 3,
              label: { text: `5th percentile: ${p05.toFixed(1)}°C`, align: "right", x: 60 } },
          ]
        },
        legend: { enabled: false },
        tooltip: {
          useHTML: true,
          formatter() {
            if (this.series.name === "Trend") return false;
            if (this.series.name === TODAY_LABEL) {
              return `<b>${TODAY_LABEL}</b>: ${this.y.toFixed(1)}°C`;
            }
            const off = this.point?.day_offset;
            const offTxt = (off || off === 0) ? ` (offset ${off >= 0 ? "+" : ""}${off}d)` : "";
            return `Year: <b>${this.x}</b>${offTxt}<br/>Tavg: <b>${this.y.toFixed(1)}°C</b>`;
          }
        },
        annotations: [{
          labels: [{
            point: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, xAxis: 0, yAxis: 0 },
            text: `Trend: ${(trendPerCentury >= 0 ? "+" : "")}${trendPerCentury.toFixed(1)}°C / century`,
            backgroundColor: "rgba(255,255,255,0.7)",
            borderColor: "#333",
            style: { fontSize: "12px" }
          }]
        }],
        series: [
          { name: "History", type: "scatter", data: scatter,
            marker: { symbol: "circle", states: { hover: { enabled: true } } } },
          { name: "Trend", type: "line", data: [{ x: x0, y: y0 }, { x: x1, y: y1 }],
            color: "#333", enableMouseTracking: false },
          { name: TODAY_LABEL, type: "scatter", data: [todayPoint],
            marker: { symbol: "circle", fillColor: "#fff", lineWidth: 2, lineColor: "#333" },
            dataLabels: [{ enabled: true, align: "left", format: `${TODAY_LABEL}<br/>{point.y:.1f}°C`, x: 8, y: 4, style: { fontWeight: 600 } }] }
        ],
        credits: { enabled: false }
      });
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  // reload when station, center date or today temp change
  let lastKey = null;
  createEffect(() => {
    const sid = props.stationId;
    const mmdd = props.center_mmdd;
    const today = props.todayTemp;
    if (!sid || !mmdd || today == null) return;
    const key = `${sid}|${mmdd}|${today}`;
    if (key !== lastKey) {
      lastKey = key;
      load();
    }
  });

  return (
    <Show when={!loading()} fallback={<div>Nalaganje…</div>}>
      <Show when={!err()} fallback={<div style="color:#b00;background:#fee;padding:8px;border-radius:8px;">Napaka: {String(err())}</div>}>
        <Highchart
          key={`${props.stationId}-${props.center_mmdd}`}
          options={opts()}
          height="360px"
        />
      </Show>
    </Show>
  );
}