import { onMount, onCleanup, createEffect } from "solid-js";
import { enableChartA11y } from "../charts/highcharts-a11y.ts";
import type { SiteMeta } from "../types.ts";
import { t } from "../i18n/format.ts";

interface Props {
  meta: SiteMeta;
  loc:  string | null;
}

// Elevation → fill colour (matches the original Flask SPA palette)
function elevColor(elev: number): string {
  if (elev > 1500) return "#7bafd4";
  if (elev > 800)  return "#a3c4a0";
  if (elev > 400)  return "#c8b97a";
  return "#c25a2c";
}

// T-5.40 (B2/B3) — the 18 stations are a fixed, known set, and Highcharts' only
// built-in collision handling for mappoint labels is to HIDE whichever ones overlap
// (dataLabels.allowOverlap:false). That is forbidden here: a station whose name
// silently vanishes defeats the map's whole purpose (showing where the 18 stations
// are). So the labels are placed deterministically instead — `allowOverlap:true`
// keeps every one drawn, and these per-point offsets:
//   • steer the western-most and eastern-most labels INLAND so they are not clipped
//     at the card edge (B2 — "ova Gorica"); and
//   • spread the crowded central cluster apart (B3 — Ljubljana / Domžale / Kranj /
//     Trbovlje overlapping).
// A per-point object merges over the series-level dataLabels, so unlisted stations
// keep the default centred label above the point; listed ones override only the
// keys named. Keyed on era5_name (station.name).
const LABEL_PLACEMENT: Record<string,
  { align?: "left" | "center" | "right"; verticalAlign?: "top" | "middle" | "bottom"; x?: number; y?: number }
> = {
  // Western edge — label extends east (inland), so its start sits on the point and
  // nothing runs off the left of the card.
  Nova_Gorica: { align: "left",  x: 5 },
  // Koper is the coastal SW tip; its label extends WEST (open space) so it clears
  // Ilirska Bistrica, which sits at almost the same latitude just to the east.
  Koper:       { align: "right", x: -5 },
  Tolmin:      { align: "left",  x: 5 },
  Ratece:      { align: "left",  x: 5 },
  // Postojna extends WEST so it clears Ljubljana's dropped label to its north-east.
  Postojna:    { align: "right", x: -5 },
  // Eastern edge — label extends west (inland).
  Murska_Sobota: { align: "right", x: -5 },
  Ptuj:          { align: "right", x: -5 },
  Maribor:       { align: "right", x: -5 },
  // Central cluster — pull the four crowded labels apart.
  Kranj:     { align: "right", x: -5, y: -9 }, // west, lifted clear of Tolmin
  Ljubljana: { verticalAlign: "top", y: 12 },  // below its own point
  Domzale:   { align: "left",  x: 5 },         // east
  Trbovlje:  { align: "left",  x: 5, y: 2 },   // east, nudged down
  // Kredarica keeps the default (centred, above): the alpine outlier sits north of
  // the cluster with clear space above it.
};
// Verified with real Highcharts across card widths 290–600 px (the map card is
// min(460px, 44%) of the trend row, and drops to full width below the 700 px
// breakpoint): every one of the 18 labels renders in full with no overlap and no
// edge clip. See PROGRESS for the measurement.

export function StationMap(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  function buildPoints(loc: string | null) {
    return props.meta.stations.map(s => ({
      name:  s.name,
      label: s.label ?? s.name,
      lat:   s.lat,
      lon:   s.lon,
      color: elevColor(s.elevation),
      marker: {
        radius:    s.name === loc ? 9 : 6,
        lineWidth: s.name === loc ? 2.5 : 1,
        lineColor: s.name === loc ? "#1a1a18" : "#fff",
        symbol:    "circle",
      },
      dataLabels: LABEL_PLACEMENT[s.name],
    }));
  }

  onMount(async () => {
    try {
    const Highcharts = (await import("highcharts")).default;
    const mapMod = await import("highcharts/modules/map") as any;
    const initFn = mapMod.default ?? mapMod;
    if (typeof initFn === 'function') initFn(Highcharts);
    await enableChartA11y(Highcharts);

    const topoUrl = `https://code.highcharts.com/mapdata/countries/${props.meta.country}/${props.meta.country}-all.topo.json`;
    const topo = await fetch(topoUrl).then(r => r.json());

    const mapChart = (Highcharts as any).mapChart;
    const currentLoc = props.loc;

    chart = mapChart(container, {
      chart: {
        backgroundColor: "#F5F2EC",
        style: { fontFamily: "'Space Grotesk', system-ui, sans-serif" },
        animation: false,
        margin: [4, 4, 4, 4],
      },
      title:    { text: null },
      subtitle: { text: null },
      credits:  { enabled: false },
      legend:   { enabled: false },
      // T-5.4a — screen-reader summary (Slovenian copy awaiting operator review)
      accessibility: {
        enabled: true,
        description: t("map.a11y"),
      },
      mapNavigation: {
        enabled: true,
        // T-5.40 — bottom-RIGHT (the Adriatic/Croatia corner, no station near it) so
        // the zoom buttons do not sit on top of Koper's label in the south-west.
        buttonOptions: { verticalAlign: "bottom", align: "right" },
      },
      plotOptions: {
        series: { states: { inactive: { opacity: 1 } } },
      },
      tooltip: {
        useHTML: true,
        backgroundColor: "#ffffff",
        borderColor: "rgba(14,14,12,0.14)",
        style: { fontSize: "13px", fontFamily: "'Space Grotesk', sans-serif" },
        formatter(this: any) {
          return `<span style="font-weight:600">${this.point.label ?? this.point.name}</span>`;
        },
      },
      series: [
        {
          type: "map",
          mapData: topo,
          color: "#EFEBE2",
          borderColor: "rgba(14,14,12,0.18)",
          borderWidth: 1.25,
          enableMouseTracking: false,
          nullColor: "#EFEBE2",
          states: { hover: { enabled: false }, inactive: { opacity: 1 } },
        },
        {
          type: "mappoint",
          name: "Postaje",
          data: buildPoints(currentLoc),
          findNearestPointBy: "xy",
          stickyTracking: false,
          dataLabels: {
            enabled: true,
            // T-5.40 — keep every station's name visible (never drop a label) and let
            // labels draw past the plot edge; LABEL_PLACEMENT (above) keeps them from
            // colliding or clipping.
            allowOverlap: true,
            crop: false,
            overflow: "allow",
            formatter(this: any) { return this.point.label ?? this.point.name; },
            style: {
              fontSize: "8px",
              fontWeight: "400",
              color: "#1a1a18",
              textOutline: "2px #fff",
              fontFamily: "'JetBrains Mono', monospace",
            },
            y: -2,
          },
          // T-5.39 — the map is an orientation aid, not a chooser: no click handler,
          // no pointer cursor. The floating chooser is the single location control.
        },
      ],
    } as any);
    } catch(err) {
      console.error("[StationMap] onMount error:", err);
    }
  });

  // Update marker styles on loc change without rebuilding the chart
  createEffect(() => {
    if (!chart) return;
    const loc = props.loc;
    const series = chart.series?.[1];
    if (!series) return;
    series.data.forEach((pt: any) => {
      const sel = pt.name === loc;
      pt.update({
        marker: {
          radius:    sel ? 9 : 6,
          lineWidth: sel ? 2.5 : 1,
          lineColor: sel ? "#1a1a18" : "#fff",
        },
      }, false);
    });
    chart.redraw(false);
  });

  onCleanup(() => {
    chart?.destroy();
    chart = null;
  });

  return (
    <div
      ref={container}
      class="w-full rounded-xl overflow-hidden border border-[var(--color-rule)]"
      style={{ height: "280px" }}
    />
  );
}
