import { createResource, Show, Suspense, ErrorBoundary } from "solid-js";
import { fetchSeasonHeatmap, isArsoLoc } from "../api.ts";
import { sectionErrorFallback } from "../components/SectionError.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { SeasonHeatmap } from "./SeasonHeatmap.tsx";

interface Props {
  loc:   string | null;
  label?: string | undefined;
}

export function Era5SeasonHeatmap(props: Props) {
  const era5Loc = () => {
    const l = props.loc ?? "";
    return l && !isArsoLoc(l) ? l : null;
  };

  const [data, { refetch }] = createResource(
    era5Loc,
    (loc) => fetchSeasonHeatmap(loc),
  );

  const display = () => data() ?? data.latest;

  return (
    <ErrorBoundary fallback={sectionErrorFallback(refetch, "160px")}>
      <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
        <Show when={(display()?.length ?? 0) > 0}>
          {/* T-5.27 part (3) — the chart's station is set by the off-screen floating
              chooser, so it must name it here (previously the `label` prop was unused
              and the season chart showed no location at all). */}
          <Show when={props.label}>
            <div class="era5-chart-loc">{props.label}</div>
          </Show>
          <SeasonHeatmap data={display()!} />
        </Show>
        <Show when={data.loading && !display()}>
          <div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />
        </Show>
        {/* T-5.14 — resolved to no rows: message, not a heading over blank space.
            The !loading guard keeps it from flashing during a station refetch. */}
        <Show when={!data.loading && (display()?.length ?? 0) === 0}>
          <EmptyState minHeight="160px" />
        </Show>
      </Suspense>
    </ErrorBoundary>
  );
}
