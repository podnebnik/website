import { Show } from "solid-js";

/**
 * A component to indicate when displayed data is stale and being refreshed
 * This provides a subtle visual cue that the data is being updated in the background
 * without blocking the UI or requiring a loading state
 * 
 * @param {Object} props - Component properties
 * @param {boolean} props.isStale - Whether the data is stale and being refreshed
 * @param {string} [props.className] - Additional CSS classes to apply
 * @returns {JSX.Element} The rendered component
 */
export function StalenessIndicator(props) {
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
