// dev-proxy.mjs
// Local development proxy that forwards /api/* to TARGET.
// (Historical-window special route removed.)

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

// ---------- Generic proxy for everything under /api ----------
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