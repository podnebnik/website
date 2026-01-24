/**
 * Shared chart container component with standardized loading and error states
 */
import { Show, JSX } from "solid-js";
import { LoadingSkeleton } from "./Skeletons.tsx";
import { ErrorMessage } from "./ErrorMessage.tsx";
import { ERROR_MESSAGES, FALLBACK_MESSAGES } from "../utils/uiConstants.ts";

export interface ChartContainerProps {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  chartType?: "chart" | "scatter" | "histogram";
  loadingMessage?: string;
  errorMessage?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  children: JSX.Element;
  class?: string;
}

/**
 * ChartContainer provides consistent loading, error, and fallback states for chart components
 */
export function ChartContainer(props: ChartContainerProps) {
  const chartType = () => props.chartType || "chart";
  const errorMsg = () => props.errorMessage || ERROR_MESSAGES.GENERIC;
  const fallbackMsg = () =>
    props.fallbackMessage || FALLBACK_MESSAGES.NO_CHART_DATA;

  return (
    <div class={props.class}>
      <Show
        when={!props.loading}
        fallback={<LoadingSkeleton type={chartType()} />}
      >
        <Show
          when={!props.error}
          fallback={
            <ErrorMessage
              error={`${errorMsg()}: ${props.error}`}
              {...(props.onRetry && { onRetry: props.onRetry })}
            />
          }
        >
          <Show
            when={props.hasData}
            fallback={
              <div class="flex justify-center items-center h-64 text-gray-600">
                {fallbackMsg()}
              </div>
            }
          >
            {props.children}
          </Show>
        </Show>
      </Show>
    </div>
  );
}

export default ChartContainer;
