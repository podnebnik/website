import { Show } from "solid-js";

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
    return (
        <Show when={props.isLoading}>
            <div class={`p-3 bg-gray-100 rounded-md animate-pulse ${props.class || ''}`}>
                <div class="flex items-center justify-center">
                    <div class="w-6 h-6 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-3"></div>
                    <p class="text-gray-700">{props.message || 'Nalaganje...'}</p>
                </div>
            </div>
        </Show>
    );
}
