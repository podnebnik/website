// dev-proxy.mjs
// Local development proxy.
//
// Special route: /api/staging/ali-je-vroce/historical_window
//   -> returns 15 * years points of {year, mmdd, tavg} for a station
//   -> pulled from Datasette table temperature/temperature~2Eslovenia_historical~2Edaily.json
//
// Everything else proxies to TARGET.

import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import os from "os";
import { createProxyMiddleware } from "http-proxy-middleware";

// ---------- Config ----------
const PORT = process.env.PORT ? Number(process.env.PORT) : 8090;
const HOST = "0.0.0.0"; // bind on all interfaces (LAN access)
const API_PREFIX = "/api";
const TARGET = process.env.TARGET || "https://podnebnik.vremenar.app";
const DATA_BASE = process.env.DATA_BASE || "https://stage-data.podnebnik.org";
const HISTORY_FROM_DATA = String(process.env.HISTORY_FROM_DATA || "")
  .toLowerCase()
  .startsWith("1");

// Datasette table endpoint (not /temperature.json?_sql=…)
const DATASETTE_TABLE_PATH =
  "temperature/temperature~2Eslovenia_historical~2Edaily.json";

// ---------- bootstrap ----------
const app = express();

// Global CORS & preflight (no '*' route to avoid path-to-regexp error)
app.use(cors({ origin: true, credentials: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(compression());
app.use(morgan("dev"));

// Helpers
function buildWindow(centerMMDD, windowDays) {
  const half = Math.floor(windowDays / 2);
  const [mm, dd] = centerMMDD.split("-").map((s) => Number(s));
  const base = new Date(Date.UTC(2001, mm - 1, dd)); // non-leap baseline
  const out = [];
  for (let k = -half; k <= half; k++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + k);
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${m}-${day}`);
  }
  return out;
}

async function fetchWithTimeout(url, { timeoutMs = 25000 } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const f =
    typeof fetch === "function"
      ? fetch
      : (await import("node-fetch")).default;

  try {
    return await f(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function numOrNull(x) {
  if (x == null) return null;
  const y = Number(x);
  return Number.isFinite(y) ? y : null;
}

// Build datasette URL; if withCols=false, do not request _col to avoid "invalid columns"
function buildDatasetteUrl({ sid, inList, withCols = true }) {
  const baseUrl = `${DATA_BASE}/${DATASETTE_TABLE_PATH}`;
  const common =
    `${baseUrl}` +
    `?_shape=array&_size=max` +
    `&station_id__exact=${encodeURIComponent(String(sid))}` +
    `&_where=${encodeURIComponent(`substr(date,6,5) IN (${inList})`)}` +
    `&_order_by=date`;

  if (!withCols) return common;

  // request only known-good columns
  return common + `&_col=station_id&_col=date&_col=temperature_average_2m`;
}

// ---------- Special route: 15 points per year (raw daily rows, no per-year averaging) ----------
app.get(
  `${API_PREFIX}/staging/ali-je-vroce/historical_window`,
  async (req, res, next) => {
    try {
      if (!HISTORY_FROM_DATA) return next(); // fallback to real API if flag off

      const stationRaw = req.query.station_id ?? req.query.sid ?? "";
      const center_mmdd = String(req.query.center_mmdd || "").trim();
      const window_days = Number(req.query.window_days || 14); // ±7 => 15 total

      if (!stationRaw || !/^\d+$/.test(String(stationRaw))) {
        return res.status(400).json({ ok: false, error: "Invalid station_id" });
      }
      if (!/^\d{2}-\d{2}$/.test(center_mmdd)) {
        return res.status(400).json({ ok: false, error: "Invalid center_mmdd" });
      }
      if (!Number.isFinite(window_days) || window_days < 0 || window_days > 120) {
        return res.status(400).json({ ok: false, error: "Invalid window_days" });
      }

      const sid = Number(stationRaw);
      const mmddList = buildWindow(center_mmdd, window_days);
      const inList = mmddList.map((d) => `'${d}'`).join(", ");

      // First attempt: request only specific columns (fast)
      let url = buildDatasetteUrl({ sid, inList, withCols: true });
      console.log("[dev-proxy] datasette TABLE URL ->", url);

      let r = await fetchWithTimeout(url, { timeoutMs: 30000 });

      // If Datasette complains about invalid columns, retry without _col filters
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        if (r.status === 400 && /invalid columns/i.test(text)) {
          url = buildDatasetteUrl({ sid, inList, withCols: false });
          console.log("[dev-proxy] retry (no _col) ->", url);
          r = await fetchWithTimeout(url, { timeoutMs: 30000 });
        } else {
          console.error(
            "[dev-proxy] datasette response error",
            r.status,
            text.slice(0, 200)
          );
          return res
            .status(502)
            .json({ ok: false, status: r.status, error: "Datasette query failed" });
        }
      }

      /** @type {Array<{station_id:number|string, date:string, temperature_average_2m?:number, temperature_avg?:number, temperature_average?:number}>} */
      const rows = await r.json();

      // Filter by station_id just in case
      const filtered = rows.filter(
        (row) => String(row.station_id) === String(sid)
      );

      // Map -> { year, mmdd, tavg } taking average-of-24h column
      const points = filtered
        .map((row) => {
          const date = String(row.date); // "YYYY-MM-DD"
          const year = Number(date.slice(0, 4));
          const mmdd = date.slice(5, 10);
          // coalesce possible average columns (even if we didn't request them explicitly)
          const tavg =
            numOrNull(row.temperature_average_2m) ??
            numOrNull(row.temperature_avg) ??
            numOrNull(row.temperature_average);

          return { year, mmdd, tavg };
        })
        .filter(
          (p) =>
            Number.isFinite(p.year) &&
            typeof p.mmdd === "string" &&
            Number.isFinite(p.tavg)
        );

      console.log(
        `[dev-proxy] historical_window -> ${points.length} points for station ${sid}`
      );

      return res.json(points);
    } catch (err) {
      console.error("[dev-proxy] historical_window error:", err);
      return res.status(500).json({
        ok: false,
        error: err?.message || String(err),
      });
    }
  }
);

// ---------- Generic proxy for everything else ----------
app.use(
  API_PREFIX,
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    logLevel: "warn",
    pathRewrite: { [`^${API_PREFIX}`]: "" },
    onProxyRes(proxyRes) {
      proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      proxyRes.headers["Access-Control-Allow-Headers"] =
        "Origin, X-Requested-With, Content-Type, Accept";
      proxyRes.headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";
    },
  })
);

// Helper to print LAN IPs
function getLanAddresses() {
  const ifaces = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === "IPv4" && !info.internal) addrs.push(info.address);
    }
  }
  return addrs;
}

app.listen(PORT, HOST, () => {
  console.log(`[dev-proxy] TARGET -> ${TARGET}`);
  console.log(
    `[dev-proxy] HISTORY_FROM_DATA = ${HISTORY_FROM_DATA ? "ON" : "OFF"}`
  );
  console.log(`[dev-proxy] DATA_BASE -> ${DATA_BASE}`);
  if (HISTORY_FROM_DATA) {
    console.log("[dev-proxy] Using stage-data daily table for historical_window");
  }
  console.log(`Dev proxy: http://${HOST}:${PORT}${API_PREFIX} -> ${TARGET}`);
  console.log(`Listening on http://${HOST}:${PORT}`);

  const lans = getLanAddresses();
  if (lans.length) {
    console.log(
      "[dev-proxy] LAN access URLs:",
      lans.map((ip) => `http://${ip}:${PORT}${API_PREFIX}`).join("  ")
    );
  }
});