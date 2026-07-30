// T-5.16 — proof that the Slovenian screen-reader strings actually reach Highcharts.
//
// `enableChartA11y` builds a `lang` object from the catalogue and hands it to
// `HC.setOptions`. This test captures that exact object (the same one real
// Highcharts would deep-merge over its English defaults) and asserts the
// Slovenian values are present, at the correct nested `lang.accessibility.*`
// paths, and sourced through `t()`. A translation that is wired but not verified
// is not known to work (T-5.16 Step 4).
//
// The three side-effect module imports inside enableChartA11y are mocked: they
// are browser-oriented and irrelevant here — we only care about the lang object.

import { describe, expect, it, vi } from "vitest";

vi.mock("highcharts/modules/exporting", () => ({ default: {} }));
vi.mock("highcharts/modules/export-data", () => ({ default: {} }));
vi.mock("highcharts/modules/accessibility", () => ({ default: {} }));

import { enableChartA11y } from "../../code/ali-je-vroce-era5/charts/highcharts-a11y.ts";
import { t } from "../../code/ali-je-vroce-era5/i18n/format.ts";

describe("T-5.16 — Highcharts a11y lang strings", () => {
  it("merges the Slovenian accessibility strings into HC.setOptions at the right paths", async () => {
    let captured: any;
    const fakeHC = { setOptions: (o: any) => { captured = o; } };

    await enableChartA11y(fakeHC);

    const lang = captured.lang;
    const a11y = lang.accessibility;

    // Group A — the strings a screen reader actually reaches (lang.accessibility.*).
    expect(a11y.defaultChartTitle).toBe("Graf");
    expect(a11y.chartContainerLabel).toBe("{title}. Interaktivni prikaz podatkov.");
    expect(a11y.svgContainerLabel).toBe("Interaktivni graf");
    expect(a11y.table.viewAsDataTableButtonText).toBe("Prikaži kot podatkovno tabelo, {chartTitle}");
    expect(a11y.table.tableSummary).toBe("Tabelarni prikaz grafa.");
    expect(a11y.screenReaderSection.endOfChartMarker).toBe("Konec interaktivnega grafa.");
    expect(a11y.series.nullPointValue).toBe("Ni vrednosti");
    expect(a11y.axis.defaultAxisNames.categories).toBe("kategorije");
    expect(a11y.axis.defaultAxisNames.time).toBe("čas");
    expect(a11y.axis.defaultAxisNames.values).toBe("vrednosti");

    // Group B — the (currently unreachable) export-menu strings, still translated.
    expect(lang.viewData).toBe("Prikaži podatkovno tabelo");
    expect(lang.hideData).toBe("Skrij podatkovno tabelo");
    expect(lang.downloadCSV).toBe("Prenesi CSV");
    expect(lang.downloadXLS).toBe("Prenesi XLS");

    // The values genuinely flow through the catalogue via t(), not hardcoded here.
    expect(a11y.table.viewAsDataTableButtonText).toBe(t("hc.a11y.viewAsDataTableButtonText"));
    expect(a11y.chartContainerLabel).toBe(t("hc.a11y.chartContainerLabel"));
    expect(lang.viewData).toBe(t("hc.viewData"));

    // And none of the translated surface is still English.
    expect(a11y.chartContainerLabel).not.toMatch(/interactive chart/i);
    expect(a11y.table.viewAsDataTableButtonText).not.toMatch(/view as data table/i);
    expect(lang.downloadCSV).not.toMatch(/download/i);
  });
});
