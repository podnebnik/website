import { Skeleton } from "@kobalte/core/skeleton";
import { cn } from "../../utils.js";

/**
 * LoadingSkeleton component renders skeleton placeholders for loading states.
 * Accepts props to customize the type of skeleton.
 * 
 * @component LoadingSkeleton
 * @param {Object} props - Component props
 * @param {'main'|'description'|'stats'|'context'|'lastUpdated'} props.type - The skeleton variation to display
 * @returns {JSX.Element} The rendered skeleton component
 */
export function LoadingSkeleton({ type }) {
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
                        class={cn(classNameSkeletonColor, "inline-block", classNameDefaultAnimate)}
                        visible={true}
                        circle
                        animate
                        aria-hidden="true"
                    />
                    <Skeleton
                        as="span"
                        height={60}
                        width={144}
                        class={cn(classNameSkeletonColor, "inline-block", classNameDefaultAnimate)}
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
                    <Skeleton as="span" width={192} height={36} class={cn(classNameSkeletonColor, classNameDefaultAnimate, "inline-block")} animate visible={true} radius={10} aria-hidden="true" />
                </p>
            );
        case "stats":
            return (
                <>
                    <div class="flex flex-col items-center" role="listitem">
                        <span class="text-gray-400 text-sm leading-6">minimum</span>
                        <Skeleton as="span" width={60} height={28} class={cn(classNameSkeletonColor, classNameDefaultAnimate)} visible={true} animate radius={10} aria-hidden="true" />
                        <Skeleton as="span" width={90} height={18} class={cn(classNameSkeletonColor, "animate-pulse mt-1")} visible={true} animate radius={10} aria-hidden="true" />
                    </div>
                    <div class="flex flex-col items-center" role="listitem">
                        <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
                        <Skeleton as="span" width={60} height={28} class={cn(classNameSkeletonColor, classNameDefaultAnimate)} visible={true} animate radius={10} aria-hidden="true" />
                        <Skeleton as="span" width={120} height={18} class={cn(classNameSkeletonColor, "animate-pulse mt-1")} visible={true} animate radius={10} aria-hidden="true" />
                    </div>
                    <div class="flex flex-col items-center" role="listitem">
                        <span class="text-gray-400 text-sm leading-6">maksimum</span>
                        <Skeleton as="span" width={60} height={28} class={cn(classNameSkeletonColor, classNameDefaultAnimate)} visible={true} animate radius={10} aria-hidden="true" />
                        <Skeleton as="span" width={90} height={18} class={cn(classNameSkeletonColor, "animate-pulse mt-1")} visible={true} animate radius={10} aria-hidden="true" />
                    </div>
                </>
            );
        case "context":
            return (
                <div
                    class="text-normal font-sans mt-4"
                    role="contentinfo"
                >
                    <Skeleton as="p" height={24} width="90%" class={cn(classNameSkeletonColor, classNameDefaultAnimate)} visible={true} animate radius={10} aria-hidden="true" />
                    <Skeleton as="p" height={24} width="95%" class={cn(classNameSkeletonColor, classNameDefaultAnimate, "mt-1")} visible={true} animate radius={10} aria-hidden="true" />
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
                    <Skeleton as="span" height={14} width={200} class={cn(classNameSkeletonColor, classNameDefaultAnimate, "inline-block")} visible={true} animate radius={10} aria-hidden="true" />
                </p>
            );
        default:
            return null;
    }
}