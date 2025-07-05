import { Show, createUniqueId, createEffect } from "solid-js";
import { announce } from "../utils/a11y.js";

/**
 * LoadingIndicator component displays a loading spinner with an optional message.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isLoading - Whether content is currently loading
 * @param {string} props.message - Message to display next to the spinner
 * @param {string} [props.class] - Additional CSS classes for styling
 * @returns {JSX.Element} The rendered component
 */
export function LoadingIndicator(props) {
    const loadingId = createUniqueId();

    // Announce loading state changes
    createEffect((prevLoading) => {
        const isLoading = props.isLoading;

        // Only announce when loading state changes
        if (prevLoading === undefined) {
            // First render
            if (isLoading) {
                announce(props.message || 'Nalaganje...', 'polite');
            }
        } else if (prevLoading !== isLoading) {
            if (isLoading) {
                // Started loading
                announce(props.message || 'Nalaganje...', 'polite');
            } else {
                // Finished loading
                announce('Nalaganje zaključeno', 'polite');
            }
        }

        return isLoading;
    }, props.isLoading);

    return (
        <Show when={props.isLoading}>
            <div
                class={`p-3 bg-gray-100 rounded-md animate-pulse ${props.class || ''}`}
                role="status"
                aria-live="polite"
                aria-busy="true"
                id={loadingId}
                aria-atomic="true"
            >
                <div class="flex items-center justify-center">
                    <div
                        class="w-6 h-6 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3
                               forced-color-adjust-none"
                        aria-hidden="true"
                    ></div>
                    <p class="text-gray-700">
                        {props.message || 'Nalaganje...'}
                        <span class="sr-only">Prosimo počakajte</span>
                    </p>
                </div>
            </div>
        </Show>
    );
}
