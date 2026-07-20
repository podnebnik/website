import { Show, For, createSignal, lazy, Suspense } from "solid-js";
import type { TodayStatus, Last7, SiteMeta, RankInfo } from "../types.ts";
import { isArsoLoc } from "../api.ts";
import { TodayFlag } from "./TodayFlag.tsx";
import { TodayGauge } from "../charts/TodayGauge.tsx";

const TodayLast7Chart = lazy(() => import("./TodayLast7Chart.tsx").then(m => ({ default: m.TodayLast7Chart })));

const CATEGORIES: Record<string, string> = {
  freezing: "Zmrzujoče",
  cold:     "Hladno",
  nope:     "Normalno",
  hot:      "Vroče",
  hell:     "Peklensko",
};

const CAT_DESCS: Record<string, string> = {
  freezing: "Med najhladnejšimi {d} v naših zapisih ARSO.",
  cold:     "Hladneje od večine izmerjenih {d}.",
  nope:     "Točno takšno, kot {d} v {country} ponavadi je.",
  hot:      "Med najtoplejšimi {d} v naših zapisih.",
  hell:     "Izjemna vročina — vrh 5 % vseh {d} glede na meritve ARSO.",
};

const CAT_DESCS_ERA5: Record<string, string> = {
  freezing: "Med najhladnejšimi {d} v naših {record_years} letih zapisov.",
  cold:     "Hladneje od večine izmerjenih {d}.",
  nope:     "Točno takšno, kot {d} v {country} ponavadi je.",
  hot:      "Med najtoplejšimi {d} v naših zapisih.",
  hell:     "Izjemna vročina — vrh 5 % vseh {d} od {year_min}.",
};

function catDesc(catKey: string, r: TodayStatus): string {
  const isArso = r.loc ? isArsoLoc(r.loc) : false;
  const tpl = (isArso ? CAT_DESCS : CAT_DESCS_ERA5)[catKey] ?? "";
  const d = fmtDayLabel(r.day_label ?? "");
  const yearMin = r.year_min ?? 1950;
  const yearMax = r.year_max ?? new Date().getFullYear();
  return tpl
    .replace("{d}", d)
    .replace("{year_min}", String(yearMin))
    .replace("{country}", "Slovenija")
    .replace("{record_years}", String(yearMax - yearMin + 1));
}

function fmtDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}.${parts[1]}.`;
}

const EN_MONTHS: Record<string, string> = {
  Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06",
  Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12",
};
function fmtDayLabel(dl: string): string {
  const [mon, day] = dl.split(" ");
  return `${(day ?? "").padStart(2, "0")}.${EN_MONTHS[mon ?? ""] ?? "??"}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Props {
  data:         TodayStatus;
  last7:        Last7 | undefined;
  meta:         SiteMeta;
  date:         string;
  today:        string;
  loading:      boolean;
  onDateChange: (d: string) => void;
  onLocChange:  (v: string) => void;
  nationalLoc?: string;  // loc key for the "Slovenija" option (e.g. "arso:national")
}

export function TodayCard(props: Props) {
  const r = () => props.data;
  const catKey = () => r().category_key ?? "nope";

  return (
    <div class="today-card">

      {/* ── Date + location controls — always fully visible ── */}
      <div class="today-date-control">
        <button
          class="today-nav-btn"
          aria-label="Previous day"
          disabled={props.date <= "1950-01-01"}
          onClick={() => props.onDateChange(addDays(props.date, -1))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="today-date-badge">{fmtDate(props.date)}</div>
        <button
          class="today-nav-btn"
          aria-label="Next day"
          disabled={props.date >= props.today}
          onClick={() => props.onDateChange(addDays(props.date, 1))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <select
          class="today-loc-select"
          value={r().loc === props.nationalLoc ? (props.nationalLoc ?? "") : r().loc ?? ""}
          onChange={(e) => props.onLocChange(e.currentTarget.value)}
        >
          <option value={props.nationalLoc ?? ""}>Slovenija</option>
          <Show when={props.meta.stations.some(s => s.source === "arso")}>
            <optgroup label="ARSO postaje">
              <For each={props.meta.stations.filter(s => s.source === "arso")}>
                {(s) => <option value={s.name}>{s.label}</option>}
              </For>
            </optgroup>
          </Show>
          <Show when={props.meta.stations.some(s => s.source === "era5")}>
            <optgroup label="ERA5 postaje">
              <For each={props.meta.stations.filter(s => s.source === "era5")}>
                {(s) => <option value={s.name}>{s.label ?? s.name}</option>}
              </For>
            </optgroup>
          </Show>
        </select>
      </div>

      {/* ── Data content — dims while loading to cover stale→fresh transition ── */}
      <Show when={r().available} fallback={<UnavailableCard />}>
        <div class="today-card-data" classList={{ "today-card-data--loading": props.loading }}>

          {/* Main row: gauge | divider | body | divider | percentile */}
          <div class="today-main-row">

            <TodayGauge data={r()} />

            <div class="today-divider" />

            <div class="today-body">
              <div class="today-text">
                <div class="today-cat-row">
                  <TodayFlag catKey={catKey()} />
                  <span class="today-cat" style={{ color: r().color }}>
                    {CATEGORIES[catKey()] ?? catKey()}
                  </span>
                  <Show when={r().rank_info}>
                    {(ri) => <RankBadge info={ri()} dayLabel={fmtDayLabel(r().day_label ?? "")} />}
                  </Show>
                </div>
                <span class="today-desc">{catDesc(catKey(), r())}</span>
              </div>
            </div>

            <div class="today-divider" />

            <div class="today-pct-wrap">
              <span class="today-pct-num">{(r().percentile ?? 0).toFixed(0)}</span>
              <span class="today-pct-label">percentil</span>
              <Show when={r().loc && isArsoLoc(r().loc!)}>
                <span class="today-pct-samples">ARSO meritve</span>
              </Show>
              <Show when={!r().loc || !isArsoLoc(r().loc ?? "")}>
                <Show when={(r().n_samples ?? 0) > 0}>
                  <span class="today-pct-samples">{(r().n_samples ?? 0).toLocaleString()} vzorcev</span>
                </Show>
              </Show>
              <Show when={r().is_preliminary}>
                <span style={{
                  "font-family": "var(--font-mono)", "font-size": "9px",
                  "letter-spacing": "0.06em", "text-transform": "uppercase",
                  color: "var(--color-ink-soft)",
                  background: "var(--color-paper-2)",
                  border: "1px solid var(--color-rule)",
                  "border-radius": "4px", padding: "2px 6px",
                  "margin-top": "4px", display: "inline-block",
                }}>
                  ERA5T · preliminarno
                </span>
              </Show>
            </div>

          </div>

          {/* Explain */}
          <p class="today-explain">
            {r().loc
              ? r().loc === props.nationalLoc
                ? `Povprečna najvišja temperatura vseh ARSO postaj v Sloveniji, razvrstena glede na percentilne zapise ARSO meritev (${r().year_min}–${r().year_max}).`
                : isArsoLoc(r().loc!)
                  ? `Temperatura na ARSO postaji ${props.meta.stations.find(s => s.name === r().loc)?.label ?? r().loc!.replace("arso:", "")}, razvrstena glede na percentilne zapise ARSO meritev.`
                  : `Temperatura na postaji ${r().loc!.replace(/_/g, " ")}, razvrstena glede na zapise ERA5-Land od leta ${r().year_min} za isto ±7-dnevno okno.`
              : `Današnji vrh je najvišja napovedana temperatura, razvrstena glede na zapise ERA5-Land od leta ${r().year_min} za isto ±7-dnevno okno.`
            }
          </p>

          {/* Climate context */}
          <p class="today-context">
            Slovenija leži na stičišču štirih podnebnih con — alpske, sredozemske, celinsko in panonske — stisnjenih v eno izmed podnebno najbolj raznolikih držav v Evropi. Srednja Evropa se segreva približno 1,5-krat hitreje od svetovnega povprečja. Temperature so v zadnjih 70 letih narasle za skoraj 2 °C. Pomlad v Alpah prihaja vse prej, sredozemske suše segajo vse globlje v notranjost, severovzhodni panonski del pa se sooča z vedno hujšimi vročinskimi vali. Kar je bilo leta 1980 tipično poletje, danes sodi med hladnejšo polovico nedavnih desetletij.
          </p>

          {/* Last 7 days */}
          <Show when={props.last7?.available && (props.last7?.days.length ?? 0) > 0}>
            <div class="today-last7-row">
              <div class="today-last7-card">
                <div class="today-chart-title">Zadnjih 7 dni</div>
                <Suspense fallback={<div style={{ height: "190px" }} class="animate-pulse bg-[var(--color-paper-2)] rounded" />}>
                  <TodayLast7Chart days={props.last7!.days} />
                </Suspense>
              </div>
            </div>
          </Show>

          {/* Footer */}
          <div class="today-foot">
            {(r().today_temp ?? 0).toFixed(1)} °C · {(r().percentile ?? 0).toFixed(0)}. percentil
            {r().loc && isArsoLoc(r().loc!)
              ? ` · ${(r().n_samples ?? 0).toLocaleString()} vzorcev (${r().year_min}–${r().year_max}) · vir: ARSO`
              : (r().n_samples ?? 0) > 0
                ? ` · ${(r().n_samples ?? 0).toLocaleString()} vzorcev (${r().year_min}–${r().year_max})`
                : ""
            }
          </div>

        </div>
      </Show>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RankBadge(props: { info: RankInfo; dayLabel: string }) {
  const [open, setOpen] = createSignal(false);
  const isHot = () => props.info.direction === "hot";

  const label = () =>
    isHot()
      ? `#${props.info.rank} najtoplejši ${props.dayLabel}`
      : `#${props.info.rank} najhladnejši ${props.dayLabel}`;

  return (
    <div class="relative">
      <button
        class={`today-rank-badge today-rank-badge--${isHot() ? "hot" : "cold"}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label()}
      </button>

      <Show when={open()}>
        <div class="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div class="absolute top-full mt-2 left-0 z-20 bg-[var(--color-card)] border border-[var(--color-rule)] rounded-xl shadow-lg p-4 min-w-[220px]">
          <div class="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-soft)] mb-3">
            {isHot() ? `Najtoplejši ${props.dayLabel}` : `Najhladnejši ${props.dayLabel}`}
          </div>
          <div class="space-y-2">
            <For each={props.info.top5}>
              {(entry) => (
                <div
                  class="flex justify-between items-center text-sm gap-4"
                  classList={{ "font-semibold": !!entry.is_today }}
                >
                  <span class={entry.is_today ? "text-[var(--color-ink)]" : "text-[var(--color-ink-soft)]"}>
                    {entry.date.slice(0, 4)}
                    <Show when={entry.is_today}>
                      {" "}
                      <span class="text-[10px] font-normal text-[var(--color-accent)]">danes</span>
                    </Show>
                  </span>
                  <span class="font-mono text-[var(--color-ink)]">{entry.temp.toFixed(1)} °C</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

function UnavailableCard() {
  return (
    <div class="today-card">
      <p class="today-explain">Podatki za ta dan niso na voljo.</p>
    </div>
  );
}
