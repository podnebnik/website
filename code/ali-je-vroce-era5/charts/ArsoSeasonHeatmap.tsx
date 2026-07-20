import { createResource, Show, Suspense } from "solid-js";
import { fetchArsoSeasonHeatmap, isArsoLoc } from "../api.ts";
import { SeasonHeatmap } from "./SeasonHeatmap.tsx";

interface Props {
  loc:   string | null;
  label?: string;
}

export function ArsoSeasonHeatmap(props: Props) {
  const stationId = () => {
    const l = props.loc ?? "";
    return isArsoLoc(l) ? Number(l.replace("arso:", "")) : null;
  };

  const [data] = createResource(
    stationId,
    (id) => fetchArsoSeasonHeatmap(id),
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
