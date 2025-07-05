import { Show, createUniqueId, onMount } from "solid-js";
import { announce } from "../utils/a11y.js";

/**
 * ErrorMessage component displays error messages with a retry button.
 *
 * @param {Object} props - Component props
 * @param {string} props.error - The error message to display
 * @param {Function} props.onRetry - Callback function when retry is clicked
 * @returns {JSX.Element} The rendered component
 */
export function ErrorMessage(props) {
    // Generate unique IDs for accessibility
    const errorId = createUniqueId();
    const retryButtonId = createUniqueId();

    // Announce error when it appears
    onMount(() => {
        if (props.error) {
            announce(`Napaka: ${props.error}`, 'assertive');
        }
    });

    return (
        <Show when={props.error}>
            <div
                class="mt-4 p-3 bg-red-100 rounded-md border border-red-300 hc-border"
                role="alert"
                aria-labelledby={errorId}
                aria-live="assertive"
                aria-atomic="true"
            >
                <p id={errorId} class="text-red-600 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 forced-colors:border forced-colors:border-current" aria-hidden="true"></span>
                    <span>{props.error}</span>
                </p>
                <Show when={props.onRetry}>
                    <button
                        id={retryButtonId}
                        class="mt-2 text-sm text-blue-600 hover:text-blue-800 underline 
                               focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2
                               forced-colors:hc-interactive"
                        onClick={() => {
                            props.onRetry();
                            announce('Poskušam znova naložiti podatke...', 'polite');
                        }}
                        aria-label="Poskusi znova naložiti podatke"
                        type="button"
                    >
                        Poskusi znova
                    </button>
                </Show>
            </div>
        </Show>
    );
}
