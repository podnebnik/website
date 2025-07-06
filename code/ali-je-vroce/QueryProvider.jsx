import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { Show, onMount } from 'solid-js';
import { prefetchPopularStations, prefetchStationsData } from './utils/prefetching.js';

// Create a client with specialized defaults for different query types
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Global defaults
            retry: 1,
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },
    },
});

// Configure specific query defaults for stations
queryClient.setQueryDefaults(
    ['stations'],
    {
        staleTime: 1000 * 60 * 30, // 30 minutes - stations don't change often
        retry: 2,
        cacheTime: 1000 * 60 * 60, // 1 hour
    }
);

// Configure specific query defaults for weather data
queryClient.setQueryDefaults(
    ['weatherData'],
    {
        staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
        retry: 2,
        refetchOnWindowFocus: "always",
        refetchOnMount: "always",
        refetchOnReconnect: "always",
        refetchOnStale: true,
        refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
        refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused
        cacheTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
    }
);

/**
 * QueryProvider component that wraps children with TanStack Query's QueryClientProvider
 * Also handles initial data prefetching for better user experience
 * 
 * @param {Object} props - Component props
 * @param {JSX.Element} props.children - Child components to be wrapped
 * @returns {JSX.Element} The wrapped component
 */
export function QueryProvider(props) {
    // Check if we're in development mode
    const isDev = () => import.meta.env?.DEV === true;

    // When the component mounts, start prefetching data
    onMount(() => {
        // Prefetch stations list data immediately
        prefetchStationsData(queryClient);

        // Prefetch popular stations data with a small delay to prioritize visible UI
        setTimeout(() => {
            prefetchPopularStations(queryClient);
        }, 2000); // 2 second delay
    });

    return (
        <QueryClientProvider client={queryClient}>
            {props.children}
            <Show when={isDev()}>
                <SolidQueryDevtools initialIsOpen={false} />
            </Show>
        </QueryClientProvider>
    );
}
