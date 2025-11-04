/**
 * Generic function type for functions that can be debounced/throttled
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DebouncableFunction = (...args: any[]) => any;

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last time it was invoked.
 */
export function debounce<T extends DebouncableFunction>(
    func: T, 
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    return function executedFunction(...args: Parameters<T>): void {
        const later = (): void => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every wait milliseconds.
 */
export function throttle<T extends DebouncableFunction>(
    func: T, 
    wait: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastCall = 0;

    return function (...args: Parameters<T>): ReturnType<T> | undefined {
        const now = new Date().getTime();
        if (now - lastCall < wait) return undefined;

        lastCall = now;
        return func(...args);
    };
}
