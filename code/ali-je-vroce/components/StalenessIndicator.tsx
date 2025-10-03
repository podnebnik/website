import { Show } from "solid-js";
import { StalenessIndicatorProps } from "../../types/components.js";

/**
 * A component to indicate when displayed data is stale and being refreshed
 * This provides a subtle visual cue that the data is being updated in the background
 * without blocking the UI or requiring a loading state
 * 
 * @param props - Component properties with TypeScript typing
 * @returns The rendered component
 */
export function StalenessIndicator(props: StalenessIndicatorProps) {
    return (
        <Show when={props.isStale}>
            <span
                class={`inline-flex items-center ${props.className || ''}`}
                aria-live="polite"
                role="status"
                title="Podatki se osvežujejo"
            >
                <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1" aria-hidden="true" />
                <span class="sr-only">Podatki se osvežujejo v ozadju</span>
            </span>
        </Show>
    );
}
