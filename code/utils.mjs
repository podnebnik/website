
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @typedef {import('clsx').ClassValue} ClassValue
 */

/**
 * Combines multiple class values into a single string, intelligently merging Tailwind CSS classes.
 *
 * @param {...ClassValue[]} inputs - The class values to combine. Can be strings, arrays, or objects.
 * @returns {string} The merged class string with Tailwind CSS classes deduplicated.
 */
export function cn(...inputs) {
    return twMerge(clsx(...inputs));
}