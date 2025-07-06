import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { Show } from 'solid-js';

// Create a client with more aggressive refetch settings
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },
    },
});

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
