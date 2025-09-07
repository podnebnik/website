/**
 * Shared styling constants for chart components
 */

// Colors
export const COLORS = {
  // Basic colors
  GRAY: "#666",
  DARK_GRAY: "#333",
  BLACK: "#111",
  LIGHT_GRAY: "#aaaaaa",
  LIGHT_BLUE_GRAY: "#ccc",
  WHITE: "#fff",
  
  // Error/warning colors
  ERROR_TEXT: "#b00",
  ERROR_BACKGROUND: "#fee",
  
  // Chart-specific colors
  PERCENTILE_LINE: "#666",
  TODAY_MARKER: "#333",
  TREND_LINE: "#333",
  
  // Histogram area colors
  COLD_AREA: "rgba(40, 120, 220, 0.65)",
  NORMAL_AREA: "rgba(255, 140, 80, 0.85)",
  HOT_AREA: "rgba(180, 30, 40, 0.75)",
  
  // Backgrounds and overlays
  ANNOTATION_BACKGROUND: "rgba(255,255,255,0.7)",
  GRID_LINE: "rgba(0,0,0,0.06)",
} as const;

// Chart dimensions and spacing
export const DIMENSIONS = {
  // Default chart height
  DEFAULT_HEIGHT: "400px",
  SCATTER_HEIGHT: "360px",
  
  // Chart spacing
  SPACING_TOP: 52,
  SPACING_RIGHT: 80,
  SPACING_RIGHT_SMALL: 20,
  SPACING_LEFT: 10,
  
  // Line widths
  THIN_LINE: 1,
  MEDIUM_LINE: 2,
  THICK_LINE: 3,
  
  // Marker sizes
  SMALL_MARKER: 4,
  MEDIUM_MARKER: 7,
  
  // Border radius
  ERROR_BORDER_RADIUS: "8px",
  
  // Padding
  ERROR_PADDING: "8px",
} as const;

// Chart styling options
export const CHART_STYLES = {
  // Opacity values
  FILL_OPACITY_HIGH: 0.35,
  FILL_OPACITY_MEDIUM: 0.25,
  
  // Z-index values
  PLOT_LINE_Z: 4,
  TODAY_LINE_Z: 5,
  ANNOTATION_Z: 3,
  
  // Font sizes
  FONT_SIZE_SMALL: "12px",
  FONT_SIZE_MEDIUM: "13px",
  
  // Dash styles
  DASH_STYLE: "Dash" as const,
  SOLID_STYLE: "Solid" as const,
} as const;

// Common chart configuration defaults
export const CHART_DEFAULTS = {
  BACKGROUND_COLOR: "transparent",
  CREDITS_ENABLED: false,
  LEGEND_ENABLED: false,
  TICK_AMOUNT: 6,
  HISTOGRAM_TICK_AMOUNT: 8,
} as const;
