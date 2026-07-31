import { describe, expect, it } from "vitest";

import { regressionTooltipHtml } from "../../code/ali-je-vroce-era5/charts/regression-tooltip.ts";

// T-5.23 — RegressionChart's tooltip formatter used to close over `const d = props.data`
// and read `d.unit`, the same frozen-closure shape T-5.22 fixed in DistributionChart.
// It was unreachable in the current app (the unit is an invariant "°C" and the chart
// remounts on every data change via a keyed <Show>), so it is proven here rather than by
// a live location switch: the fix passes a getter and the helper reads the unit through
// it at render time. The snapshot cannot see this — its harness stubs Highcharts and
// never renders a tooltip.
describe("regressionTooltipHtml", () => {
  const point = { seriesName: "Ljubljana", x: 2024, y: 1.234 };

  it("interpolates loc, x, y and the current unit", () => {
    const html = regressionTooltipHtml(() => ({ unit: "°C" }), point);
    expect(html).toContain("Ljubljana");
    expect(html).toContain("2024");
    expect(html).toContain("°C");
  });

  it("turns underscores in the series name into spaces", () => {
    const html = regressionTooltipHtml(() => ({ unit: "°C" }), { ...point, seriesName: "Murska_Sobota" });
    expect(html).toContain("Murska Sobota");
    expect(html).not.toContain("Murska_Sobota");
  });

  // The liveness property this ticket exists for: the unit is read from the getter when
  // the tooltip renders, not captured when the formatter was built. A mutable holder
  // stands in for the data prop; changing it between renders must change the output. The
  // pre-fix shape (`const d = props.data; … d.unit`) would freeze on the first value and
  // fail this test.
  it("tracks a unit that changes between renders — no frozen capture", () => {
    let data = { unit: "°C" };
    const getData = () => data;

    const first = regressionTooltipHtml(getData, point);
    data = { unit: "mm" }; // the data behind the chart changes
    const second = regressionTooltipHtml(getData, point);

    expect(first).toContain("°C");
    expect(second).toContain("mm");
    expect(second).not.toContain("°C");
  });
});
