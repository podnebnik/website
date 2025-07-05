import { Show } from "solid-js";

/**
 * ErrorMessage component displays error messages with a retry button.
 *
 * @param {Object} props - Component props
 * @param {string} props.error - The error message to display
 * @param {Function} props.onRetry - Callback function when retry is clicked
 * @returns {JSX.Element} The rendered component
 */
export function ErrorMessage(props) {
    return (
        <Show when={props.error}>
            <div class="mt-4 p-3 bg-red-100 rounded-md border border-red-300">
                <p class="text-red-600 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                    {props.error}
                </p>
                <Show when={props.onRetry}>
                    <button
                        class="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                        onClick={props.onRetry}
                    >
                        Poskusi znova
                    </button>
                </Show>
            </div>
        </Show>
    );
}
