import { createSignal, createMemo, createEffect, onMount, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Projection data (IPCC AR6, localised for northern Adriatic / DRSV 2023) ──

type ProjTable = Record<number, number>;
interface Scenario { median: ProjTable; low: ProjTable; high: ProjTable; }

const DATA = {
  projections: {
    ssp245: {
      median: { 2030:9,  2040:15, 2050:23, 2060:31, 2070:39, 2080:47, 2090:54, 2100:60 },
      low:    { 2030:6,  2040:10, 2050:16, 2060:22, 2070:28, 2080:34, 2090:39, 2100:45 },
      high:   { 2030:12, 2040:20, 2050:30, 2060:40, 2070:50, 2080:60, 2090:68, 2100:75 },
    },
    ssp585: {
      median: { 2030:11, 2040:19, 2050:28, 2060:40, 2070:53, 2080:66, 2090:75, 2100:84  },
      low:    { 2030:8,  2040:14, 2050:21, 2060:30, 2070:40, 2080:50, 2090:58, 2100:66  },
      high:   { 2030:14, 2040:24, 2050:36, 2060:52, 2070:70, 2080:88, 2090:100,2100:108 },
    },
  } as Record<string, Scenario>,
  surcharge: { p70: 58, p20: 76, p01: 98 } as Record<string, number>,
};

const FLOOD_RISK_ZONES = [
  L.latLngBounds(L.latLng(45.462, 13.582), L.latLng(45.491, 13.636)),
  L.latLngBounds(L.latLng(45.538, 13.716), L.latLng(45.552, 13.752)),
];

const SCHEMATIC_POLYS: L.LatLngTuple[][] = [
  [[45.462, 13.582],[45.491, 13.582],[45.491, 13.636],[45.462, 13.636]],
  [[45.538, 13.716],[45.552, 13.716],[45.552, 13.752],[45.538, 13.752]],
];

const GAUGE_MAX = 200;

// ── Math helpers ──────────────────────────────────────────────────────────────

function interp(obj: ProjTable, year: number): number {
  const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
  if (year <= keys[0]) return obj[keys[0]];
  if (year >= keys[keys.length - 1]) return obj[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (year >= keys[i] && year <= keys[i + 1])
      return obj[keys[i]] + ((year - keys[i]) / (keys[i + 1] - keys[i])) * (obj[keys[i + 1]] - obj[keys[i]]);
  }
  return obj[keys[0]];
}

const getMeanRise = (scn: string, year: number) => interp(DATA.projections[scn].median, year);
const getRange    = (scn: string, year: number) => ({
  lo: interp(DATA.projections[scn].low, year),
  hi: interp(DATA.projections[scn].high, year),
});
const gaugeY    = (cm: number) => Math.max(10, 175 - Math.min(cm, 206) * 0.8);
const snapLevel = (cm: number) => Math.max(10, Math.min(250, Math.round(cm / 10) * 10));
const floodUrl  = (lvl: number) => `/data/flood/flood-${String(lvl).padStart(3, '0')}cm.png`;
const fmt       = (n: number)   => n.toLocaleString('sl-SI');

interface FloodStats { levels: Record<string, { ha: number; buildings: number }>; }

// ── Component ─────────────────────────────────────────────────────────────────

export function SeaLevelWidget() {
  const [scn,     setScn]     = createSignal("ssp245");
  const [prob,    setProb]    = createSignal("p70");
  const [year,    setYear]    = createSignal(2050);
  const [playing, setPlaying] = createSignal(false);
  const [divPct,  setDivPct]  = createSignal(50);
  const [viewFrac, setViewFrac] = createSignal(1);

  let floodStats: FloodStats | null = null;
  const imgCache: Record<number, HTMLImageElement> = {};
  let leafletMap: L.Map | null = null;
  let schematicLayers: L.Polygon[] = [];
  let rafId: number | null = null;
  let renderVer = 0;

  let mapContainerEl!: HTMLDivElement;
  let mapWrapEl!:      HTMLDivElement;
  let canvasEl!:       HTMLCanvasElement;
  let divLineEl!:      HTMLDivElement;
  let divHandleEl!:    HTMLDivElement;
  let futureLblEl!:    HTMLDivElement;

  // ── Derived values ────────────────────────────────────────────────────────

  const meanRise  = createMemo(() => getMeanRise(scn(), year()));
  const rangeVals = createMemo(() => getRange(scn(), year()));
  const surcharge = createMemo(() => DATA.surcharge[prob()]);
  const total     = createMemo(() => meanRise() + surcharge());

  const gFillY = createMemo(() => gaugeY(total()));
  const gFillH = createMemo(() => Math.max(0, 175 - gFillY()));
  const gBandY = createMemo(() => gaugeY(rangeVals().hi + surcharge()));
  const gBandH = createMemo(() => Math.max(0, gaugeY(rangeVals().lo + surcharge()) - gBandY()));

  const gHPct   = createMemo(() => Math.min(100, total() / GAUGE_MAX * 100));
  const gHBandL = createMemo(() => Math.min(100, (rangeVals().lo + surcharge()) / GAUGE_MAX * 100));
  const gHBandW = createMemo(() => Math.min(100 - gHBandL(), (rangeVals().hi - rangeVals().lo) / GAUGE_MAX * 100));

  function getImpacts(totalCm: number) {
    if (floodStats) {
      const row = floodStats.levels[String(snapLevel(totalCm))];
      if (row) return { ha: row.ha, buildings: row.buildings };
    }
    const over = Math.max(0, totalCm - 40);
    return { ha: Math.round(over * 20.77), buildings: Math.round(over * 14.13) };
  }

  const impactStats = createMemo(() => getImpacts(total()));
  const visHa    = createMemo(() => viewFrac() === 0 ? '—' : fmt(Math.round(impactStats().ha    * viewFrac())));
  const visBuild = createMemo(() => viewFrac() === 0 ? '—' : fmt(Math.round(impactStats().buildings * viewFrac())));

  function calcViewFrac(): number {
    if (!leafletMap) return 1;
    const vb = leafletMap.getBounds();
    let vis = 0, tot = 0;
    for (const fz of FLOOD_RISK_ZONES) {
      tot += (fz.getNorth() - fz.getSouth()) * (fz.getEast() - fz.getWest());
      const latLo = Math.max(vb.getSouth(), fz.getSouth()), latHi = Math.min(vb.getNorth(), fz.getNorth());
      const lngLo = Math.max(vb.getWest(),  fz.getWest()),  lngHi = Math.min(vb.getEast(),  fz.getEast());
      if (latHi > latLo && lngHi > lngLo) vis += (latHi - latLo) * (lngHi - lngLo);
    }
    return tot > 0 ? Math.min(1, vis / tot) : 0;
  }

  // ── PNG flood rendering ───────────────────────────────────────────────────

  function loadImg(lvl: number): Promise<HTMLImageElement> {
    if (imgCache[lvl]) return Promise.resolve(imgCache[lvl]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { imgCache[lvl] = img; resolve(img); };
      img.onerror = reject;
      img.src = floodUrl(lvl);
    });
  }

  function tintImg(src: HTMLImageElement, colour: string): HTMLCanvasElement {
    const tmp = document.createElement('canvas');
    tmp.width = src.naturalWidth || src.width;
    tmp.height = src.naturalHeight || src.height;
    const c = tmp.getContext('2d')!;
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = colour;
    c.fillRect(0, 0, tmp.width, tmp.height);
    return tmp;
  }

  function clearSchematic() {
    schematicLayers.forEach(l => leafletMap?.removeLayer(l));
    schematicLayers = [];
  }

  async function renderFloodCanvas() {
    if (!leafletMap || !canvasEl || !mapWrapEl) return;
    const ver = ++renderVer;

    canvasEl.width  = mapWrapEl.offsetWidth;
    canvasEl.height = mapWrapEl.offsetHeight;
    const ctx = canvasEl.getContext('2d')!;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    const curScn = scn(), curYear = year(), curProb = prob(), curDiv = divPct();
    const divX     = canvasEl.width * curDiv / 100;
    const todayCm  = DATA.surcharge[curProb];
    const futureCm = getMeanRise(curScn, curYear) + DATA.surcharge[curProb];
    const tL = snapLevel(todayCm), fL = snapLevel(futureCm);

    let todayImg: HTMLImageElement | null = null;
    let futureImg: HTMLImageElement | null = null;
    try { [todayImg, futureImg] = await Promise.all([loadImg(tL), loadImg(fL)]); } catch (_) {}

    if (ver !== renderVer) return; // superseded

    const nw = leafletMap.latLngToContainerPoint(L.latLng(45.605, 13.535));
    const se = leafletMap.latLngToContainerPoint(L.latLng(45.425, 13.795));
    const rx = nw.x, ry = nw.y, rw = se.x - nw.x, rh = se.y - nw.y;

    if (todayImg && futureImg && rw > 0 && rh > 0) {
      clearSchematic();
      const todayCyan   = tintImg(todayImg,  'rgba(60,30,200,0.82)');
      const futureCoral = tintImg(futureImg, 'rgba(210,30,45,0.83)');

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, divX, canvasEl.height); ctx.clip();
      ctx.drawImage(todayCyan, rx, ry, rw, rh);
      ctx.restore();

      ctx.save();
      ctx.beginPath(); ctx.rect(divX, 0, canvasEl.width - divX, canvasEl.height); ctx.clip();
      ctx.drawImage(futureCoral, rx, ry, rw, rh);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(todayImg, rx, ry, rw, rh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(todayCyan, rx, ry, rw, rh);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      clearSchematic();
      const divLng = leafletMap.containerPointToLatLng(L.point(divX, canvasEl.height / 2)).lng;
      for (const coords of SCHEMATIC_POLYS) {
        const lngs   = coords.map(c => c[1]);
        const center = (Math.max(...lngs) + Math.min(...lngs)) / 2;
        const isToday = center < divLng;
        const fill   = isToday ? '#3c1ec8' : (futureCm > todayCm ? '#d21e2d' : '#3c1ec8');
        const border = isToday ? '#6655ff' : (futureCm > todayCm ? '#ff4455' : '#6655ff');
        schematicLayers.push(
          L.polygon(coords, { color: border, weight: 1.5, fillColor: fill, fillOpacity: 0.65, opacity: 0.9, interactive: false })
           .addTo(leafletMap!)
        );
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(divX, 0); ctx.lineTo(divX, canvasEl.height); ctx.stroke();
      ctx.restore();
    }
  }

  // ── Divider drag ──────────────────────────────────────────────────────────

  function updateDividerPos() {
    const pct = divPct();
    if (!divLineEl || !divHandleEl || !futureLblEl) return;
    divLineEl.style.left   = pct + '%';
    divHandleEl.style.left = pct + '%';
    const rem = 100 - pct;
    futureLblEl.style.right = rem < 12 ? 'auto' : (100 - Math.min(pct + 1, 98)) + '%';
    futureLblEl.style.left  = rem < 12 ? (pct + 1) + '%' : 'auto';
  }

  function wireDivider() {
    divHandleEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      (e as PointerEvent).target && divHandleEl.setPointerCapture((e as PointerEvent).pointerId);
      const onMove = (me: Event) => {
        const pe = me as PointerEvent;
        const rect = mapWrapEl.getBoundingClientRect();
        setDivPct(Math.max(5, Math.min(95, (pe.clientX - rect.left) / rect.width * 100)));
      };
      divHandleEl.addEventListener('pointermove', onMove);
      divHandleEl.addEventListener('pointerup', () =>
        divHandleEl.removeEventListener('pointermove', onMove), { once: true });
    });
  }

  // ── Play animation ────────────────────────────────────────────────────────

  function startPlay() {
    if (year() >= 2100) setYear(2024);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setYear(2100); setPlaying(false); return;
    }
    const SPEED = 13;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(year() + (now - last) / 1000 * SPEED, 2100);
      setYear(next); last = now;
      if (next >= 2100) { stopPlay(); return; }
      rafId = requestAnimationFrame(tick);
    };
    setPlaying(true);
    rafId = requestAnimationFrame(tick);
  }

  function stopPlay() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    setPlaying(false);
  }

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId);
    clearSchematic();
    leafletMap?.remove();
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  createEffect(() => {
    const _ = [scn(), year(), prob(), divPct()];  // track all state
    if (leafletMap) { updateDividerPos(); renderFloodCanvas(); }
  });

  // ── Mount ─────────────────────────────────────────────────────────────────

  onMount(() => {
    leafletMap = L.map(mapContainerEl, {
      center: [45.51, 13.645], zoom: 11, minZoom: 9, maxZoom: 16,
      zoomControl: true, scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) | © <a href="https://www.openstreetmap.org">OSM</a>',
      maxZoom: 17,
    }).addTo(leafletMap);

    leafletMap.getPane('tilePane')!.style.filter = 'grayscale(1) contrast(0.88) brightness(0.82)';

    const onUpdate = () => { renderFloodCanvas(); setViewFrac(calcViewFrac()); };
    leafletMap.on('move zoom moveend zoomend viewreset resize', onUpdate);
    const resizeObserver = new ResizeObserver(onUpdate);
    resizeObserver.observe(mapWrapEl);
    onCleanup(() => resizeObserver.disconnect());

    wireDivider();
    updateDividerPos();

    fetch('/data/flood-stats.json').then(r => r.json()).then((d: FloodStats) => {
      floodStats = d;
      setViewFrac(calcViewFrac()); // trigger recalc with loaded stats
    }).catch(() => {});

    renderFloodCanvas();
    [58,60,70,76,80,90,98,100,110,120,130,140,150,160].forEach(cm =>
      loadImg(snapLevel(cm)).catch(() => {})
    );
  });

  // ── Template ──────────────────────────────────────────────────────────────

  return (
    <div class="sl-widget">

      {/* Controls bar */}
      <div class="sl-ctrl">
        <div class="sl-ctrl-group">
          <span class="sl-lbl">Scenarij</span>
          <div class="sl-btn-row">
            {([
              { key: "ssp245", label: "SSP2-4.5", sub: "Srednja pot" },
              { key: "ssp585", label: "SSP5-8.5", sub: "Vožnja po avtocesti" },
            ] as const).map(s => (
              <button class={"sl-btn" + (scn() === s.key ? " sl-btn--active" : "")} onClick={() => setScn(s.key)}>
                {s.label}<span class="sl-btn-sub">{s.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="sl-ctrl-group">
          <span class="sl-lbl">Verjetnost ekstremov</span>
          <div class="sl-btn-row">
            {([
              { key: "p70", label: "pogost (70 %)" },
              { key: "p20", label: "redek (20 %)" },
              { key: "p01", label: "ekstrem (1 %)" },
            ] as const).map(p => (
              <button class={"sl-btn" + (prob() === p.key ? " sl-btn--active" : "")} onClick={() => setProb(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div class="sl-ctrl-group sl-ctrl-group--year">
          <div class="sl-year-header">
            <span class="sl-lbl">Leto: <strong style={{ color: "var(--sl-txt)" }}>{Math.round(year())}</strong></span>
            <span class="sl-inline-stats">
              {visHa()} ha<span class="sl-inline-sep">·</span>{visBuild()} stavb
            </span>
          </div>
          <div class="sl-year-row">
            <input type="range" min="2024" max="2100" step="1" value={Math.round(year())}
              onInput={(e) => { stopPlay(); setYear(+e.currentTarget.value); }} />
            <button class="sl-play-btn" aria-label={playing() ? "Ustavi" : "Predvajaj"}
              onClick={() => playing() ? stopPlay() : startPlay()}>
              {playing() ? "⏸" : "▶"}
            </button>
          </div>
        </div>
      </div>

      {/* Map + stats stage */}
      <div class="sl-stage">

        {/* Map */}
        <div class="sl-map-wrap" ref={mapWrapEl}>
          <div ref={mapContainerEl} style={{ position: "absolute", inset: "0", "z-index": "0" }} />
          <canvas ref={canvasEl}
            style={{ position: "absolute", inset: "0", width: "100%", height: "100%", "pointer-events": "none", "z-index": "410" }} />
          <div ref={divLineEl}   class="sl-div-line" />
          <div ref={divHandleEl} class="sl-div-handle" aria-label="Premakni ločnico">⟺</div>
          <div class="sl-lbl-today">DANES</div>
          <div ref={futureLblEl} class="sl-future-lbl">{Math.round(year())}</div>
        </div>

        {/* Stats card */}
        <div class="sl-stats-card">
          <div class="sl-stats-label">Skupni dvig gladine</div>
          <div class="sl-rise-big">
            <span class="sl-rise-val">+{Math.round(meanRise())}</span>
            <span class="sl-rise-unit"> cm</span>
          </div>
          <div class="sl-stats-sub">srednja vrednost · {scn() === 'ssp245' ? 'SSP2-4.5' : 'SSP5-8.5'}</div>

          {/* Vertical gauge (desktop) */}
          <div class="sl-gauge-wrap">
            <svg viewBox="0 0 60 220" xmlns="http://www.w3.org/2000/svg" width="72" aria-hidden="true">
              <rect x="22" y="10" width="16" height="180" rx="3" fill="#0e3340"/>
              <rect x="22" y={gBandY()} width="16" height={gBandH()} rx="2" fill="#34c7d4" opacity="0.28"/>
              <rect x="22" y={gFillY()} width="16" height={gFillH()} rx="2" fill="#34c7d4"/>
              <rect x="18" y="175" width="24" height="1.5" fill="#8fb0b4" rx="1"/>
              <text x="14" y="178" text-anchor="end" font-size="7" font-family="'JetBrains Mono',monospace" fill="#8fb0b4">0</text>
              <text x="14" y="138" text-anchor="end" font-size="7" font-family="'JetBrains Mono',monospace" fill="#8fb0b4">50</text>
              <text x="14" y="98"  text-anchor="end" font-size="7" font-family="'JetBrains Mono',monospace" fill="#8fb0b4">100</text>
              <text x="14" y="58"  text-anchor="end" font-size="7" font-family="'JetBrains Mono',monospace" fill="#8fb0b4">150</text>
              <text x="30" y="204" text-anchor="middle" font-size="7" font-family="'JetBrains Mono',monospace" fill="#8fb0b4">cm</text>
            </svg>
          </div>

          {/* Horizontal gauge (mobile only) */}
          <div class="sl-gauge-h">
            <div class="sl-gauge-h-fill" style={{ width: gHPct() + "%" }} />
            <div class="sl-gauge-h-band" style={{ left: gHBandL() + "%", width: gHBandW() + "%" }} />
          </div>
          <div class="sl-gauge-h-labels">
            <span class="sl-lbl">0 cm</span>
            <span class="sl-gauge-h-val">+{Math.round(total())} cm</span>
            <span class="sl-lbl">200 cm</span>
          </div>

          {/* Impacts */}
          <div class="sl-impacts">
            <div class="sl-impact-row">
              <span class="sl-impact-val">{visHa()}</span>
              <span class="sl-impact-lbl">ha poplavljenih</span>
            </div>
            <div class="sl-impact-row">
              <span class="sl-impact-val">{visBuild()}</span>
              <span class="sl-impact-lbl">ogroženih stavb</span>
            </div>
          </div>

          {/* Legend */}
          <div class="sl-legend">
            <span class="sl-leg-swatch" style={{ background: "rgba(60,30,200,0.82)" }}/>
            <span class="sl-leg-txt">Danes in prihodnost</span>
          </div>
          <div class="sl-legend">
            <span class="sl-leg-swatch" style={{ background: "rgba(210,30,45,0.83)" }}/>
            <span class="sl-leg-txt">Novo v prihodnosti</span>
          </div>

          {/* Sources */}
          <details class="sl-src">
            <summary>Viri podatkov</summary>
            <p>Projekcije: IPCC AR6 (Fox-Kemper et al. 2021), lokalizirano za severni Jadran — DRSV 2023.</p>
            <p>Posledice: Kovačič et al. 2016/2019.</p>
            <p>Karta: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), © <a href="https://www.openstreetmap.org">OpenStreetMap</a>.</p>
            <p class="sl-src-warn">⚠ Poplavne cone so shematske — zamenjava z LIDAR DEM poligoni sledi.</p>
          </details>
        </div>

      </div>
    </div>
  );
}
