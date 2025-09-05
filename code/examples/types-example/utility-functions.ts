// Utility function examples with TypeScript

// 1. Date and time utilities
export function formatSlovenianDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("sl-SI", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function formatSlovenianDateTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString("sl-SI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// 2. Temperature conversion utilities
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5/9;
}

export function formatTemperature(temp: number, unit: "C" | "F" = "C"): string {
  return `${temp.toFixed(1)}°${unit}`;
}

// 3. Data processing utilities with generics
export function groupBy<T, K extends keyof T>(
  array: T[], 
  key: K
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(
  array: T[],
  selector: (item: T) => string | number | Date,
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aValue = selector(a);
    const bValue = selector(b);
    
    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

// 4. Array utilities with type safety
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function filterNotNull<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item != null);
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 5. Object utilities
export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

// 6. Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 7. Async utilities with proper typing
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), ms)
  );
  
  return Promise.race([promise, timeoutPromise]);
}

// 8. Math utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calculatePercentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

// 9. String utilities
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(str: string, length: number, suffix = "..."): string {
  return str.length > length ? str.substring(0, length) + suffix : str;
}

// 10. Local storage utilities with type safety
export function saveToLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function removeFromLocalStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// 11. Usage examples
export const utilityExamples = {
  // Working with temperature data
  processTemperatureData: (data: Array<{ date: string; temp: number }>) => {
    return data
      .filter(item => item.temp != null)
      .map(item => ({
        ...item,
        date: formatSlovenianDate(item.date),
        formattedTemp: formatTemperature(item.temp),
        tempF: celsiusToFahrenheit(item.temp)
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  // Grouping stations by region
  groupStationsByRegion: <T extends { region?: string }>(stations: T[]) => {
    return groupBy(stations.filter(s => s.region), "region");
  },

  // Data validation pipeline
  validateAndProcess: <T>(
    data: unknown[],
    validator: (item: unknown) => item is T
  ): T[] => {
    return filterNotNull(
      data.map(item => validator(item) ? item : null)
    );
  }
};
