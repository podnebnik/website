import { render } from "solid-js/web";
import { QueryClientProvider, QueryClient } from "@tanstack/solid-query";
import { AliJeVroceERA5 } from "./AliJeVroceERA5.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 60 },
  },
});

// T-1.2: the fixture layer has to be installed before the first fetch, so
// mounting moves into an async boot. `import.meta.env.VITE_FIXTURES` is
// statically replaced at build time, so in a production build the branch is dead
// and ./fixtures/install.ts is never pulled into the graph.
async function boot() {
  if (import.meta.env.VITE_FIXTURES === "1") {
    const { installFixtures } = await import("./fixtures/install.ts");
    await installFixtures();
  }

  const root = document.getElementById("ali-je-vroce-era5");
  if (root) {
    render(
      () => (
        <QueryClientProvider client={queryClient}>
          <AliJeVroceERA5 />
        </QueryClientProvider>
      ),
      root
    );
  }
}

void boot();
