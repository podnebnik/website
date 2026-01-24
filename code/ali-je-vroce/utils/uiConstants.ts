/**
 * Shared UI messages and constants for consistent user interface across chart components
 */

// Loading messages in Slovenian
export const LOADING_MESSAGES = {
  CHART: "Nalaganje grafa...",
  HISTOGRAM: "Nalaganje histograma...", 
  DATA: "Nalaganje podatkov...",
  GENERIC: "Nalaganje...",
} as const;

// Error messages in Slovenian
export const ERROR_MESSAGES = {
  GENERIC: "Napaka pri nalaganju podatkov",
  NETWORK: "Ni povezave z internetom",
  DATA_PROCESSING: "Napaka pri obdelavi podatkov",
  CHART_RENDER: "Napaka pri izrisu grafa",
  NO_DATA: "Ni podatkov za prikaz",
} as const;

// Fallback content messages
export const FALLBACK_MESSAGES = {
  NO_CHART_DATA: "Ni podatkov za graf",
  DATA_UNAVAILABLE: "Podatki niso na voljo",
} as const;

// Chart-specific loading skeleton types
export const CHART_SKELETON_TYPES = {
  SCATTER: "scatter",
  HISTOGRAM: "histogram", 
  GENERIC: "chart",
} as const;

// Accessibility labels
export const A11Y_LABELS = {
  LOADING_ANNOUNCEMENT: "Nalagam podatke za graf",
  ERROR_ANNOUNCEMENT: "Napaka pri nalaganju grafa",
  RETRY_BUTTON: "Poskusi znova naložiti podatke",
} as const;
