
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single string, intelligently merging Tailwind CSS classes.
 *
 * @param inputs - The class values to combine. Can be strings, arrays, or objects.
 * @returns The merged class string with Tailwind CSS classes deduplicated.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(...inputs));
}