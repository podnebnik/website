import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { Show } from 'solid-js';

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
        staleTime: 0, // Always fetch fresh weather data
        retry: 2,
        refetchOnWindowFocus: "always",
        refetchOnMount: "always",
        refetchOnReconnect: "always",
        refetchOnStale: true,
        cacheTime: 1000 * 60 * 10, // 10 minutes
    }
);

/**
 * QueryProvider component that wraps children with TanStack Query's QueryClientProvider
 * 
 * @param {Object} props - Component props
 * @param {JSX.Element} props.children - Child components to be wrapped
 * @returns {JSX.Element} The wrapped component
 */
export function QueryProvider(props) {
    // Check if we're in development mode
    const isDev = () => import.meta.env?.DEV === true;

    return (
        <QueryClientProvider client={queryClient}>
            {props.children}
            <Show when={isDev()}>
                <SolidQueryDevtools initialIsOpen={false} />
            </Show>
        </QueryClientProvider>
    );
}
