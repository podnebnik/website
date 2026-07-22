#!/usr/bin/env node
// T-1.2 — network fixture recorder.
//
// Records the raw JSON response for every network call the ERA5 page can make,
// into tests/fixtures/http/. Run with:
//
//     yarn fixtures:record
//
// The set of query SHAPES below was derived by READING code/ali-je-vroce-era5,
// not by observing traffic: several shapes never fire on a default page load
// (they need a station selected, a slider moved, or a date inside/outside the
// reanalysis lag). Every shape carries a file:line citation to its call site,
// and each URL template is a character-for-character copy of the template in
// that call site — if one drifts, the fixture stops matching and the offline
// run fails loudly rather than silently rendering an empty chart.
//
// The PARAMETERS (dates, stations, variables, thresholds) live in
// tests/fixtures/manifest.json so coverage can be extended without touching
// this file.
//
// Deliberately NOT recorded, with reasons, in manifest.json `_uncapturable`:
// OpenTopoMap raster tiles, the arso-si datasette, Vremenar, and the sidecar.
//
// Responses are stored byte-for-byte as the server sent them, with ONE
// deliberate exception: Open-Meteo's `generationtime_ms` is stripped. See
// stripGenerationTime below and manifest.json `_normalised`.

import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE_DIR = join(ROOT, "tests", "fixtures");
const HTTP_DIR = join(FIXTURE_DIR, "http");

const manifest = JSON.parse(
  await import("node:fs/promises").then((fs) => fs.readFile(join(FIXTURE_DIR, "manifest.json"), "utf8")),
);

const DS_BASE = manifest.bases.datasette;
const DS = `${DS_BASE}/climate-si`; // api.ts:12
const OM = manifest.bases.openmeteo; // api.ts:248
const HC = manifest.bases.highcharts;

const enc = encodeURIComponent;

// ── Shape planning ────────────────────────────────────────────────────────────

/** @type {Array<{shape: string, cite: string, url: string, file: string, normalise?: (v: any) => any}>} */
const plan = [];
const seenUrls = new Set();
const seenFiles = new Map();

function add(shape, cite, url, file, normalise) {
  if (seenUrls.has(url)) return; // same request reached from two shapes — record once
  seenUrls.add(url);
  const prior = seenFiles.get(file);
  if (prior && prior !== url) {
    throw new Error(
      `fixture filename collision: ${file}\n  already: ${prior}\n  now:     ${url}\n` +
        `Two different URLs slugged to one name — fix the naming in record.mjs.`,
    );
  }
  seenFiles.set(file, url);
  plan.push({ shape, cite, url, file, normalise });
}

// ── Normalisation ─────────────────────────────────────────────────────────────
//
// A fixture set is only useful as a control if re-recording an UNCHANGED
// upstream produces an unchanged working tree: that is what lets `git status`
// after `yarn fixtures:record` distinguish "the published data moved" from
// "the recorder is noisy". Open-Meteo breaks that on its own, because every
// response carries `generationtime_ms` — the server's timing for that one
// request, different on every call for identical data. It is the sole reason
// the 19 Open-Meteo files diffed on the 2026-07-22 re-record.
//
// It is DROPPED, not preserved: the app never reads it. The only Open-Meteo
// consumers are openMeteoMax (api.ts:255-256) and openMeteoNationalMax
// (api.ts:274-277), and both touch exactly `daily.temperature_2m_max[0]`.
// Response shape is otherwise untouched — this is a deletion, not a rewrite.
// Declared in manifest.json `_normalised` so the omission is discoverable from
// the fixture set and not only from this file.
function stripGenerationTime(parsed) {
  for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
    if (obj && typeof obj === "object") delete obj.generationtime_ms;
  }
  return parsed;
}

function slug(s) {
  return String(s).replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Human-readable fixture name for a datasette query. */
function dsFile(table, parts) {
  const tail = parts.map(([k, v]) => `${slug(k)}-${slug(v)}`).join("__");
  return `climate-si/${slug(table)}${tail ? `__${tail}` : ""}.json`;
}

const dates = manifest.dates.map((d) => d.date);
const primaryDate = manifest.primary_date;
const stations = manifest.stations;
const snapshotStations = manifest.snapshot_stations;
const variables = manifest.variables;

/** D6's URL, shared with the second-pass planner below so the two cannot drift. */
function last7Url(name, date) {
  return (
    `${DS}/daily.json?_shape=array&era5_name__exact=${enc(name)}&date__lte=${date}` +
    `&_sort_desc=date&_size=7&_col=date&_col=temperature_max_2m&_col=month&_col=day`
  );
}

/**
 * The doy round-trip the analysis panel performs, reproduced exactly:
 * dateToDoy (AliJeVroceERA5.tsx:28-32) on the real calendar, then doyToMonthDay
 * (api.ts:102-104) on a fixed NON-LEAP 2001 calendar.
 *
 * The two calendars disagree after Feb 28 of a leap year, so selecting
 * 2024-03-01 makes the regression panel and the hero cards query MARCH 2. That
 * is the T-4.5 leap-year defect, and the fixtures have to cover it for the
 * snapshot to be able to freeze it.
 */
function doyRoundTrip(date) {
  const d = new Date(date + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = Math.floor((d.getTime() - start) / 86_400_000);
  const back = new Date(Date.UTC(2001, 0, 1));
  back.setUTCDate(back.getUTCDate() + doy - 1);
  return { month: back.getUTCMonth() + 1, day: back.getUTCDate() };
}

/** month/day pairs implied by the date matrix, deduplicated. */
const monthDays = [];
{
  const seen = new Set();
  for (const date of dates) {
    const [, m, d] = date.split("-");
    const key = `${Number(m)}-${Number(d)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    monthDays.push({ month: Number(m), day: Number(d) });
  }
}

// D1 — fetchMeta station list. api.ts:292
const D1_URL =
  `${DS}/stations.json?_shape=array&_col=era5_name&_col=name&_col=lat&_col=lon` +
  `&_col=elevation&_col=station_id&_size=30`;
add("D1 stations", "api.ts:292", D1_URL, "climate-si/stations.json");

for (const { month, day } of monthDays) {
  // D3 — national +/-window climatology. api.ts:214-216
  add(
    "D3 daily_window national",
    "api.ts:214-216",
    `${DS}/daily_window.json?_shape=array&month__exact=${month}&day__exact=${day}&_size=50`,
    dsFile("daily_window", [["national", "all"], ["month", month], ["day", day]]),
  );
  // D10 — national annual trend row. api.ts:1390-1392
  add(
    "D10 annual_trend national",
    "api.ts:1390-1392",
    `${DS}/annual_trend.json?_shape=array&variable__exact=temperature_max&month__exact=${month}&day__exact=${day}&_size=50`,
    dsFile("annual_trend", [["national", "all"], ["variable", "temperature_max"], ["month", month], ["day", day]]),
  );
}

for (const date of dates) {
  // D4 — national today temp, all stations for one date. api.ts:353-355
  add(
    "D4 daily national",
    "api.ts:353-355",
    `${DS}/daily.json?_shape=array&date__exact=${date}&_col=temperature_max_2m&_size=50`,
    dsFile("daily", [["national", "all"], ["date", date]]),
  );
}

for (const name of stations) {
  // D7 — season heatmap. api.ts:624-626
  add(
    "D7 season_heatmap",
    "api.ts:624-626",
    `${DS}/season_heatmap.json?_shape=array&era5_name__exact=${enc(name)}` +
      `&_col=x&_col=y&_col=season&_col=avg&_col=percentile&_col=cat&_col=rank&_col=total&_col=color&_col=n_days&_size=500`,
    dsFile("season_heatmap", [["era5_name", name]]),
  );

  // D9 — year-round calendar. api.ts:1378-1380
  // Default variable for every station; all three only for the snapshot stations.
  const calVars = snapshotStations.includes(name) ? variables : ["temperature_max"];
  for (const v of calVars) {
    add(
      "D9 annual_trend calendar",
      "api.ts:1378-1380",
      `${DS}/annual_trend.json?_shape=array&era5_name__exact=${enc(name)}&variable__exact=${enc(v)}` +
        `&_col=month&_col=day&_col=trend10&_col=p_val&_size=400`,
      dsFile("annual_trend", [["calendar", "1"], ["era5_name", name], ["variable", v]]),
    );
  }

  for (const date of dates) {
    const [, mm, dd] = date.split("-");
    const month = Number(mm);
    const day = Number(dd);

    // D2 — per-station +/-window climatology. api.ts:204-206 (also api.ts:600-602, identical URL)
    add(
      "D2 daily_window station",
      "api.ts:204-206, api.ts:600-602",
      `${DS}/daily_window.json?_shape=array&era5_name__exact=${enc(name)}&month__exact=${month}&day__exact=${day}`,
      dsFile("daily_window", [["era5_name", name], ["month", month], ["day", day]]),
    );

    // D5 — per-station today temp. api.ts:457-459
    add(
      "D5 daily station",
      "api.ts:457-459",
      `${DS}/daily.json?_shape=array&era5_name__exact=${enc(name)}&date__exact=${date}&_col=temperature_max_2m&_size=1`,
      dsFile("daily", [["era5_name", name], ["date", date]]),
    );

    // D6 — last 7 days strip. api.ts:553-557
    add(
      "D6 daily last7",
      "api.ts:553-557",
      last7Url(name, date),
      dsFile("daily", [["last7", "1"], ["era5_name", name], ["date_lte", date]]),
    );

    // D8 — regression scatter. api.ts:661-663
    // HeroCards (HeroCards.tsx:235) and RegressionPanel's default both use
    // temperature_max; the other two variables only for snapshot stations.
    const regVars = snapshotStations.includes(name) ? variables : ["temperature_max"];
    for (const v of regVars) {
      add(
        "D8 annual_trend regression",
        "api.ts:661-663",
        `${DS}/annual_trend.json?_shape=array&era5_name__exact=${enc(name)}&variable__exact=${enc(v)}` +
          `&month__exact=${month}&day__exact=${day}&_size=1`,
        dsFile("annual_trend", [["era5_name", name], ["variable", v], ["month", month], ["day", day]]),
      );
    }

    // D11 — per-station annual trend with projection. api.ts:1429-1431
    add(
      "D11 annual_trend today",
      "api.ts:1429-1431",
      `${DS}/annual_trend.json?_shape=array&era5_name__exact=${enc(name)}&variable__exact=temperature_mean` +
        `&month__exact=${month}&day__exact=${day}&_size=1`,
      dsFile("annual_trend", [["era5_name", name], ["variable", "temperature_mean"], ["month", month], ["day", day]]),
    );
  }

  // D12 — tropical days/nights. api.ts:1054-1057
  const full = snapshotStations.includes(name);
  for (const kind of ["days", "nights"]) {
    const cfg = manifest.tropical[kind];
    const thresholds = full
      ? Array.from({ length: cfg.max - cfg.min + 1 }, (_, i) => cfg.min + i)
      : [cfg.default];
    const streaks = full ? manifest.tropical.streaks : [manifest.tropical.default_streak];
    for (const threshold of thresholds) {
      for (const streak of streaks) {
        add(
          "D12 tropical",
          "api.ts:1054-1057",
          `${DS}/tropical.json?_shape=array&era5_name__exact=${enc(name)}` +
            `&kind__exact=${kind}&threshold__exact=${threshold}&streak__exact=${streak}&_size=1`,
          dsFile("tropical", [
            ["era5_name", name], ["kind", kind], ["threshold", threshold], ["streak", streak],
          ]),
        );
      }
    }
  }
}

// D8b — regression scatter at the DOY-ROUND-TRIPPED month/day. api.ts:661-663
//
// fetchRegression (api.ts:642) does not use the selected date's month/day: it
// converts the panel's doy back through the fixed non-leap table at api.ts:102.
// On a leap-year date after Feb 28 those disagree — 2024-03-01 is analysed as
// March 2 — so without these the offline run misses on a date that is in the
// matrix. Same variable rules as D8. Overlaps with D8 are deduplicated by add().
{
  const seen = new Set();
  for (const date of dates) {
    const { month, day } = doyRoundTrip(date);
    const key = `${month}-${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const name of stations) {
      const regVars = snapshotStations.includes(name) ? variables : ["temperature_max"];
      for (const v of regVars) {
        add(
          "D8b annual_trend regression (doy round-trip)",
          "api.ts:642 -> api.ts:661-663",
          `${DS}/annual_trend.json?_shape=array&era5_name__exact=${enc(name)}&variable__exact=${enc(v)}` +
            `&month__exact=${month}&day__exact=${day}&_size=1`,
          dsFile("annual_trend", [["era5_name", name], ["variable", v], ["month", month], ["day", day]]),
        );
      }
    }
  }
}

// D13 — SPEI national heatmap. api.ts:1310
add(
  "D13 spei",
  "api.ts:1306-1311",
  `${DS}/spei.json?_shape=array&_col=y&_col=spei&_col=balance&_col=cat&_col=rank&_col=total&_col=color&_col=season&_col=n_days&_size=2000`,
  "climate-si/spei.json",
);

// D14 — SPEI per-station series. api.ts:1335
add(
  "D14 spei_station",
  "api.ts:1332-1336",
  `${DS}/spei_station.json?_shape=array&_col=era5_name&_col=series&_col=years_json&_col=spei_json&_col=trend_json&_size=1000`,
  "climate-si/spei_station.json",
);

// N1 — Highcharts Slovenia map topology. StationMap.tsx:45-46
add(
  "N1 highcharts topo",
  "components/StationMap.tsx:45-46",
  `${HC}/mapdata/countries/si/si-all.topo.json`,
  "highcharts/si-all.topo.json",
);

// ── Open-Meteo needs the real station coordinates, in the order fetchMeta sees
// them, because openMeteoNationalMax joins them into one comma-separated URL
// (api.ts:264-270). So fetch D1 first and derive from the response.

console.log(`Fetching station list to build Open-Meteo URLs…`);
const stationRows = await (await fetch(D1_URL)).json();
const coords = stationRows.map((s) => ({
  name: s.era5_name,
  lat: s.lat,
  lon: s.lon,
  elevation: Math.round(s.elevation),
}));

// O1 — per-station live forecast. api.ts:250-252
// Only for the primary date: for every other date in the matrix the datasette
// has a `daily` row, so api.ts:460 short-circuits and Open-Meteo is never called.
for (const c of coords) {
  add(
    "O1 open-meteo station",
    "api.ts:250-252",
    `${OM}?latitude=${c.lat}&longitude=${c.lon}&elevation=${c.elevation}` +
      `&daily=temperature_2m_max&timezone=UTC&start_date=${primaryDate}&end_date=${primaryDate}`,
    `open-meteo/forecast__${slug(c.name)}__${primaryDate}.json`,
    stripGenerationTime,
  );
}

// O2 — national live forecast, all coordinates in one call. api.ts:263-270
add(
  "O2 open-meteo national",
  "api.ts:263-270",
  `${OM}?latitude=${coords.map((c) => c.lat).join(",")}` +
    `&longitude=${coords.map((c) => c.lon).join(",")}` +
    `&elevation=${coords.map((c) => c.elevation).join(",")}` +
    `&daily=temperature_2m_max&timezone=UTC&start_date=${primaryDate}&end_date=${primaryDate}`,
  `open-meteo/forecast__national__${primaryDate}.json`,
  stripGenerationTime,
);

// ── Fetch ─────────────────────────────────────────────────────────────────────
//
// TWO PASSES. Pass 1 fetches everything planned above. Pass 2 plans and fetches
// the last-7 climatology lookback, which cannot be planned in advance:
//
//   fetchLast7 (api.ts:561-567) calls fetchEra5WindowRow for the month/day of
//   EVERY row the D6 query returns, not just the selected date — so picking a
//   station in the today card fires seven daily_window requests, six of which
//   are for days that are not in the matrix at all.
//
//   Those month/days are NOT derivable arithmetically. Outside the reanalysis
//   lag they are the six preceding calendar days; inside it (the primary date,
//   which is the whole point of that date) the seven most recent rows are weeks
//   earlier. The only honest source is what the D6 query actually returned, so
//   pass 2 reads the responses pass 1 just wrote.
//
// This gap was invisible to T-1.2 because the page opens on the national average
// and fetchLast7 returns early for it (api.ts:494) — the strip only appears once
// a station is selected. T-1.1 found it on the first station case.

console.log(`Planned ${plan.length} requests across ${new Set(plan.map((p) => p.shape)).size} shapes.`);

await rm(HTTP_DIR, { recursive: true, force: true });

const CONCURRENCY = 6;
const results = [];
let done = 0;
let failed = 0;
let total = plan.length;

async function worker(queue) {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const resp = await fetch(item.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.text();
        const parsed = JSON.parse(body); // fail here rather than at runtime if it is not JSON
        // Only normalised shapes are re-serialised; everything else is written
        // through byte-for-byte, exactly as the server sent it.
        const out = item.normalise ? JSON.stringify(item.normalise(parsed)) : body;
        const abs = join(HTTP_DIR, item.file);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, out);
        results.push({ ...item, status: resp.status, bytes: out.length, normalised: !!item.normalise });
        break;
      } catch (err) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
        failed++;
        results.push({ ...item, status: "ERROR", error: String(err && err.message ? err.message : err) });
        console.error(`  ! ${item.shape} ${item.url}\n    ${err}`);
        break;
      }
    }
    done++;
    if (done % 50 === 0) console.log(`  … ${done}/${total}`);
  }
}

async function runPlan(items) {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
}

// ── Pass 1 ────────────────────────────────────────────────────────────────────

await runPlan(plan);

// ── Pass 2 — D2b, the last-7 climatology lookback ─────────────────────────────

{
  const { readFile } = await import("node:fs/promises");
  const before = plan.length;

  for (const name of stations) {
    const lookback = new Set();
    for (const date of dates) {
      const file = dsFile("daily", [["last7", "1"], ["era5_name", name], ["date_lte", date]]);
      let rows;
      try {
        rows = JSON.parse(await readFile(join(HTTP_DIR, file), "utf8"));
      } catch {
        // Pass 1 failed for this URL; it is already counted in `failed` and the
        // index will refuse to load. Nothing useful to plan from.
        continue;
      }
      for (const r of rows) lookback.add(`${r.month}-${r.day}`);
    }
    for (const key of [...lookback].sort()) {
      const [month, day] = key.split("-").map(Number);
      add(
        "D2b daily_window last7 lookback",
        "api.ts:561-567 -> api.ts:204-206",
        `${DS}/daily_window.json?_shape=array&era5_name__exact=${enc(name)}&month__exact=${month}&day__exact=${day}`,
        dsFile("daily_window", [["era5_name", name], ["month", month], ["day", day]]),
      );
    }
  }

  const pass2 = plan.slice(before);
  total = plan.length;
  if (pass2.length) {
    console.log(`Pass 2: ${pass2.length} last-7 climatology lookback request(s).`);
    await runPlan(pass2);
  }
}

// ── Index ─────────────────────────────────────────────────────────────────────

results.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

const ok = results.filter((r) => r.status !== "ERROR");
const routes = Object.fromEntries(ok.map((r) => [r.url, r.file]));

await writeFile(
  join(FIXTURE_DIR, "index.json"),
  JSON.stringify(
    {
      _readme:
        "Generated by scripts/fixtures/record.mjs (T-1.2). `routes` maps the exact " +
        "request URL to a file under tests/fixtures/http/. Do not hand-edit; re-run " +
        "`yarn fixtures:record` instead. Bodies are stored verbatim except where an " +
        "entry carries `normalised` — see manifest.json `_normalised`. NOTE that " +
        "`recorded_at` below changes on every run BY DESIGN, so this file always " +
        "diffs; the byte-identity property is a claim about tests/fixtures/http/ only.",
      ticket: "T-1.2",
      recorded_at: new Date().toISOString(),
      bases: manifest.bases,
      primary_date: primaryDate,
      counts: { planned: plan.length, recorded: ok.length, failed },
      routes,
      entries: results.map((r) => ({
        shape: r.shape, cite: r.cite, file: r.file, status: r.status,
        bytes: r.bytes ?? null, url: r.url,
        ...(r.normalised ? { normalised: "generationtime_ms stripped" } : {}),
        ...(r.error ? { error: r.error } : {}),
      })),
    },
    null,
    2,
  ) + "\n",
);

const totalBytes = ok.reduce((s, r) => s + (r.bytes ?? 0), 0);
console.log(
  `\nRecorded ${ok.length}/${plan.length} responses ` +
    `(${(totalBytes / 1_048_576).toFixed(1)} MB) → tests/fixtures/http/`,
);
if (failed) {
  console.error(`${failed} request(s) FAILED — see tests/fixtures/index.json`);
  process.exitCode = 1;
}
