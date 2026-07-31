// T-5.23 — the regression-chart tooltip string. Pure logic, split out of
// RegressionChart.tsx so it can be unit-tested without the solid/Highcharts import
// chain (CLAUDE.md: put pure logic in a helper and test the helper directly), and so
// the UNIT is read through a getter — the component passes `() => props.data`, so the
// formatter reads the CURRENT unit at hover time rather than a value captured when the
// chart was built.
//
// The rule this encodes (from T-5.22's chart audit): capturing props into a local
// `const` inside a formatter is unsafe (it freezes at mount), reading it through props
// at call time is safe. RegressionChart used to close over `const d = props.data` and
// read `d.unit`. That was latent-only — `unit` is an invariant "°C" (api.ts) and the
// chart remounts on every data change (a `keyed` <Show> in RegressionPanel) — but it
// is the same shape T-5.22 had to fix in DistributionChart, so it is neutralised here
// by construction rather than left to a future contributor.

import type { RegressionResponse } from "../types.ts";
import { t, fmtNum } from "../i18n/format.ts";

// The hovered point's identity (series name, x, y) comes from the Highcharts Point;
// the unit comes from the chart's data, read live through `getData`.
export interface RegressionTooltipPoint {
  seriesName: string;
  x:          number;
  y:          number;
}

export function regressionTooltipHtml(
  getData: () => Pick<RegressionResponse, "unit">,
  point:   RegressionTooltipPoint,
): string {
  const loc = (point.seriesName ?? "").replace(/_/g, " ");
  return t("regchart.tooltip", { loc, x: point.x, y: fmtNum(point.y, 2), unit: getData().unit });
}
