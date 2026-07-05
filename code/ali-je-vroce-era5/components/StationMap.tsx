import { onMount, onCleanup, createEffect } from "solid-js";
import type { SiteMeta } from "../types.ts";

interface Props {
  meta:     SiteMeta;
  loc:      string | null;
  onSelect: (loc: string | null) => void;
}

// Elevation → fill colour (matches the original Flask SPA palette)
function elevColor(elev: number): string {
  if (elev > 1500) return "#7bafd4";
  if (elev > 800)  return "#a3c4a0";
  if (elev > 400)  return "#c8b97a";
  return "#c25a2c";
}

export function StationMap(props: Props) {
  let container!: HTMLDivElement;
  let chart: any = null;

  function buildPoints(loc: string | null) {
    return props.meta.stations.map(s => ({
      name:  s.name,
      lat:   s.lat,
      lon:   s.lon,
      color: elevColor(s.elevation),
      marker: {
        radius:    s.name === loc ? 9 : 6,
        lineWidth: s.name === loc ? 2.5 : 1,
        lineColor: s.name === loc ? "#1a1a18" : "#fff",
        symbol:    "circle",
      },
    }));
  }

  onMount(async () => {
    try {
    const Highcharts = (await import("highcharts")).default;
    // modules/map registers mapChart on the Highcharts namespace (same pattern as highcharts-more)
    const mapMod = await import("highcharts/modules/map") as any;
    const initFn = mapMod.default ?? mapMod;
    if (typeof initFn === 'function') initFn(Highcharts);

    const topoUrl = `https://code.highcharts.com/mapdata/countries/${props.meta.country}/${props.meta.country}-all.topo.json`;
    const topo = await fetch(topoUrl).then(r => r.json());

    const mapChart = (Highcharts as any).mapChart;
    const currentLoc = props.loc;
    const points = buildPoints(currentLoc);

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
      mapNavigation: {
        enabled: true,
        buttonOptions: { verticalAlign: "bottom" },
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
          return `<span style="font-weight:600">${this.point.name.replace(/_/g, " ")}</span>`;
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
          data: points,
          cursor: "pointer",
          findNearestPointBy: "xy",
          stickyTracking: false,
          dataLabels: {
            enabled: true,
            formatter(this: any) { return this.point.name.replace(/_/g, " "); },
            style: {
              fontSize: "8px",
              fontWeight: "400",
              color: "#1a1a18",
              textOutline: "2px #fff",
              fontFamily: "'JetBrains Mono', monospace",
            },
            y: -2,
          },
          point: {
            events: {
              click(this: any) {
                const name: string = this.name;
                props.onSelect(props.loc === name ? null : name);
              },
            },
          },
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
