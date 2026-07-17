import { createResource, Show, Suspense } from "solid-js";
import { fetchSeasonHeatmap, isArsoLoc } from "../api.ts";
import { SeasonHeatmap } from "./SeasonHeatmap.tsx";

interface Props {
  loc:   string | null;
  label?: string;
}

export function Era5SeasonHeatmap(props: Props) {
  const era5Loc = () => {
    const l = props.loc ?? "";
    return l && !isArsoLoc(l) ? l : null;
  };

  const [data] = createResource(
    era5Loc,
    (loc) => fetchSeasonHeatmap(loc),
  );

  const display = () => data() ?? data.latest;

  return (
    <Suspense fallback={<div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />}>
      <Show when={(display()?.length ?? 0) > 0}>
        <SeasonHeatmap data={display()!} />
      </Show>
      <Show when={data.loading && !display()}>
        <div class="h-40 animate-pulse bg-[var(--color-paper-2)] rounded-xl" />
      </Show>
    </Suspense>
  );
}
