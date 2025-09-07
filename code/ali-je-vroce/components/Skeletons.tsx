import { Skeleton } from "@kobalte/core/skeleton";
import { cn } from "../../utils.ts";
import { LoadingSkeletonProps } from "../../types/components.js";

/**
 * LoadingSkeleton component renders skeleton placeholders for loading states.
 * Accepts props to customize the type of skeleton.
 *
 * @component LoadingSkeleton
 * @param props - Component props with type specification
 * @returns The rendered skeleton component
 */
export function LoadingSkeleton({ type }: LoadingSkeletonProps) {
  // if you are using tailwindcss extension add  "className[A-Za-z0-9_]*" "tailwindCSS.classAttributes" property in vscode settings
  // to get tailwindcss intellisense
  const classNameSkeletonColor = "bg-primary/30";
  const classNameDefaultAnimate = "animate-pulse";

  switch (type) {
    case "main":
      return (
        <p class="text-6xl flex items-center justify-center gap-8">
          <Skeleton
            as="span"
            width={72}
            height={72}
            class={cn(
              classNameSkeletonColor,
              "inline-block",
              classNameDefaultAnimate
            )}
            visible={true}
            circle
            animate
            aria-hidden="true"
          />
          <Skeleton
            as="span"
            height={60}
            width={144}
            class={cn(
              classNameSkeletonColor,
              "inline-block",
              classNameDefaultAnimate
            )}
            visible
            animate
            radius={10}
            aria-hidden="true"
          />
        </p>
      );
    case "description":
      return (
        <p class="flex items-center justify-center">
          <Skeleton
            as="span"
            width={192}
            height={36}
            class={cn(
              classNameSkeletonColor,
              classNameDefaultAnimate,
              "inline-block"
            )}
            animate
            visible={true}
            radius={10}
            aria-hidden="true"
          />
        </p>
      );
    case "stats":
      return (
        <>
          <div class="flex flex-col items-center" role="listitem">
            <span class="text-gray-400 text-sm leading-6">minimum</span>
            <Skeleton
              as="span"
              width={60}
              height={28}
              class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
            <Skeleton
              as="span"
              width={90}
              height={18}
              class={cn(classNameSkeletonColor, "animate-pulse mt-1")}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
          </div>
          <div class="flex flex-col items-center" role="listitem">
            <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
            <Skeleton
              as="span"
              width={60}
              height={28}
              class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
            <Skeleton
              as="span"
              width={120}
              height={18}
              class={cn(classNameSkeletonColor, "animate-pulse mt-1")}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
          </div>
          <div class="flex flex-col items-center" role="listitem">
            <span class="text-gray-400 text-sm leading-6">maksimum</span>
            <Skeleton
              as="span"
              width={60}
              height={28}
              class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
            <Skeleton
              as="span"
              width={90}
              height={18}
              class={cn(classNameSkeletonColor, "animate-pulse mt-1")}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />
          </div>
        </>
      );
    case "context":
      return (
        <div class="text-normal font-sans mt-4" role="contentinfo">
          <Skeleton
            as="p"
            height={24}
            width={300}
            class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
            visible={true}
            animate
            radius={10}
            aria-hidden="true"
          />
          <Skeleton
            as="p"
            height={24}
            width={320}
            class={cn(classNameSkeletonColor, classNameDefaultAnimate, "mt-1")}
            visible={true}
            animate
            radius={10}
            aria-hidden="true"
          />
        </div>
      );
    case "lastUpdated":
      return (
        <p
          class=" text-gray-400 text-sm leading-6 italic mt-2"
          role="contentinfo"
          aria-label="Čas zadnje posodobitve"
          aria-live="polite"
        >
          <Skeleton
            as="span"
            height={14}
            width={200}
            class={cn(
              classNameSkeletonColor,
              classNameDefaultAnimate,
              "inline-block"
            )}
            visible={true}
            animate
            radius={10}
            aria-hidden="true"
          />
        </p>
      );
    case "chart":
    case "scatter":
    case "histogram":
      return (
        <div
          class="flex justify-center items-center h-96 w-full"
          role="img"
          aria-label="Nalaganje grafa"
        >
          <div class="space-y-4 w-full max-w-md">
            {/* Chart title skeleton */}
            <Skeleton
              as="div"
              height={24}
              width={240}
              class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
              visible={true}
              animate
              radius={10}
              aria-hidden="true"
            />

            {/* Chart area skeleton */}
            <div class="relative bg-gray-50 rounded-lg h-80 flex items-center justify-center">
              <Skeleton
                as="div"
                height={320}
                width={480}
                class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
                visible={true}
                animate
                radius={10}
                aria-hidden="true"
              />
            </div>

            {/* Legend/axis labels skeleton */}
            <div class="flex justify-between items-center">
              <Skeleton
                as="span"
                height={16}
                width={80}
                class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
                visible={true}
                animate
                radius={8}
                aria-hidden="true"
              />
              <Skeleton
                as="span"
                height={16}
                width={60}
                class={cn(classNameSkeletonColor, classNameDefaultAnimate)}
                visible={true}
                animate
                radius={8}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
