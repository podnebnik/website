import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { Show, onMount } from 'solid-js';
import { prefetchPopularStations, prefetchStationsData } from './utils/prefetching.js';
import { createLocalStoragePersistor } from './utils/persistence.js';

// Create a client with specialized defaults for different query types
// Export the queryClient so it can be imported directly by other modules
export const queryClient = new QueryClient({
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

// Configure specific query defaults for weather data with more aggressive SWR pattern
queryClient.setQueryDefaults(
    ['weatherData'],
    {
        // Significantly increase staleTime to reduce immediate refetches
        staleTime: 1000 * 60 * 15, // 15 minutes - consider data fresh for longer

        retry: 2,

        // Always return cached data first (stale-while-revalidate pattern)
        refetchOnWindowFocus: true, // Changed from "always" to use the cached data first
        refetchOnMount: true, // Changed from "always" to use the cached data first
        refetchOnReconnect: true, // Changed from "always" to use the cached data first
        refetchOnStale: true,

        // Keep background refreshes for up-to-date data
        refetchInterval: 1000 * 60 * 15, // 15 minutes - less aggressive refreshing
        refetchIntervalInBackground: true, // Continue refreshing even when tab is not focused

        // Dramatically increase cache time for better offline support
        cacheTime: 1000 * 60 * 60 * 24, // 24 hours - keep data in cache much longer

        // This is key for SWR pattern - always keep previous data visible while fetching
        keepPreviousData: true,
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
// Create a persistor instance outside the component to ensure it's created only once
const persistor = createLocalStoragePersistor();

export function QueryProvider(props) {
    // Check if we're in development mode
    const isDev = () => import.meta.env?.DEV === true;

    // When the component mounts, set up persistence and start prefetching data
    onMount(() => {
        console.log('QueryProvider mounted, setting up persistence');

        // Clean up expired cache entries
        persistor.cleanupExpiredQueries();

        // Set up event listeners to save queries to localStorage
        queryClient.getQueryCache().subscribe(event => {
            // In TanStack Query v5, we should respond to the 'updated' event
            // which is fired when a query's data is updated with fresh data
            if (event.type === 'updated' && event.query?.state?.data) {
                // Only persist certain queries
                const queryKey = event.query.queryKey;

                // Don't persist empty data
                if (!event.query.state.data) return;

                // Determine if query should be persisted
                if (queryKey[0] === 'stations') {
                    // Always persist stations list
                    persistor.persistQuery(queryKey, event.query.state.data);
                } else if (queryKey[0] === 'weatherData') {
                    // Persist weather data for all stations
                    persistor.persistQuery(queryKey, event.query.state.data);
                }
            }
        });

        // Add hydration logic to restore queries from persistence
        setTimeout(() => {
            try {
                // Restore stations data
                const stationsData = persistor.getPersistedQuery(['stations']);
                if (stationsData) {
                    queryClient.setQueryData(['stations'], stationsData);
                }

                // For weather data, we'd need to know the specific station IDs
                // This could be expanded to handle more complex scenarios
            } catch (err) {
                console.warn('Error hydrating query client from persistence:', err);
            }
        }, 0);

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
