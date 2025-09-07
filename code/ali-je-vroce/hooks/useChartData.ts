/**
 * Custom hook for loading and processing chart data
 */

import { createSignal, createEffect, createMemo } from "solid-js";
import { requestHistoricalWindow } from "../helpers.js";
import { percentile, epanechnikovKernel } from "../utils/statistics.js";

export interface ChartDataHookParams {
  stationId: string | number;
  center_mmdd: string;
  todayTemp?: number | null;
  windowDays?: number;
}

export interface ProcessedChartData {
  rawData: any[];
  temperatures: number[];
  sortedTemperatures: number[];
  validDataCount: number;
  dateRange: {
    minYear: number;
    maxYear: number;
  };
}

export interface MemoizedCalculations {
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  kde: {
    points: Array<{ x: number; y: number }>;
    bandwidth: number;
  };
  temperatureRange: {
    min: number;
    max: number;
    range: number;
  };
}

export interface ChartDataHookResult {
  loading: () => boolean;
  error: () => string | null;
  data: () => any[] | null;
  processedData: () => ProcessedChartData | null;
  calculations: () => MemoizedCalculations | null;
  reload: () => Promise<void>;
}

/**
 * Validate and process raw temperature data
 */
function validateAndProcessData(rawData: any[]): ProcessedChartData {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    throw new Error("Invalid data format: expected non-empty array");
  }

  // Extract and validate temperature values
  const temperatures = rawData
    .map((item) => {
      const temp = Number(item.tavg);
      const year = Number(item.year);
      
      // Validate individual data points
      if (!Number.isFinite(temp)) {
        console.warn(`Invalid temperature value: ${item.tavg} for year ${item.year}`);
        return null;
      }
      
      if (!Number.isFinite(year) || year < 1800 || year > 2100) {
        console.warn(`Invalid year value: ${item.year}`);
        return null;
      }
      
      return temp;
    })
    .filter((temp): temp is number => temp !== null);

  if (temperatures.length === 0) {
    throw new Error("No valid temperature data found");
  }

  // Check for minimum data requirements
  if (temperatures.length < 5) {
    console.warn(`Low data count: only ${temperatures.length} valid temperatures`);
  }

  const sortedTemperatures = [...temperatures].sort((a, b) => a - b);
  
  // Calculate date range
  const years = rawData
    .map((item) => Number(item.year))
    .filter(Number.isFinite);
  
  const dateRange = {
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
  };

  return {
    rawData,
    temperatures,
    sortedTemperatures,
    validDataCount: temperatures.length,
    dateRange,
  };
}

/**
 * Validate input parameters
 */
function validateParams(params: ChartDataHookParams): void {
  const { stationId, center_mmdd, windowDays } = params;

  if (!stationId) {
    throw new Error("Station ID is required");
  }

  if (!center_mmdd) {
    throw new Error("Center date (MM-DD format) is required");
  }

  // Validate MM-DD format
  const mmddPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!mmddPattern.test(center_mmdd)) {
    throw new Error(`Invalid center_mmdd format: expected MM-DD, got ${center_mmdd}`);
  }

  if (windowDays !== undefined && (windowDays <= 0 || windowDays > 365)) {
    throw new Error(`Invalid window_days: must be between 1 and 365, got ${windowDays}`);
  }
}

/**
 * Custom hook for loading historical temperature data with reactive prop changes
 */
export function useChartData({
  stationId,
  center_mmdd,
  todayTemp,
  windowDays = 14,
}: ChartDataHookParams): ChartDataHookResult {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [data, setData] = createSignal<any[] | null>(null);
  const [processedData, setProcessedData] = createSignal<ProcessedChartData | null>(null);

  let lastKey: string | null = null;

  // Memoized expensive calculations
  const calculations = createMemo<MemoizedCalculations | null>(() => {
    const processed = processedData();
    if (!processed || processed.validDataCount === 0) return null;

    const { sortedTemperatures, temperatures } = processed;

    // Calculate percentiles (commonly used by both charts)
    const percentiles = {
      p10: percentile(sortedTemperatures, 0.1),
      p25: percentile(sortedTemperatures, 0.25),
      p50: percentile(sortedTemperatures, 0.5), // median
      p75: percentile(sortedTemperatures, 0.75),
      p90: percentile(sortedTemperatures, 0.9),
    };

    // Calculate temperature range
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    const temperatureRange = {
      min,
      max,
      range: max - min,
    };

    // Calculate KDE for histogram visualization
    // Use Scott's rule for bandwidth estimation: n^(-1/5) * std * 1.06
    const n = temperatures.length;
    const mean = temperatures.reduce((sum, t) => sum + t, 0) / n;
    const variance = temperatures.reduce((sum, t) => sum + (t - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const bandwidth = Math.pow(n, -1/5) * std * 1.06;

    // Generate KDE points across temperature range with some padding
    const padding = temperatureRange.range * 0.1;
    const kdeMin = min - padding;
    const kdeMax = max + padding;
    const kdeSteps = 100; // Number of points for smooth curve
    const stepSize = (kdeMax - kdeMin) / (kdeSteps - 1);

    const kdePoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < kdeSteps; i++) {
      const x = kdeMin + i * stepSize;
      let y = 0;
      
      // Sum contributions from all data points
      for (const temp of temperatures) {
        y += epanechnikovKernel((x - temp) / bandwidth);
      }
      
      // Normalize by bandwidth and sample size
      y = y / (n * bandwidth);
      kdePoints.push({ x, y });
    }

    const kde = {
      points: kdePoints,
      bandwidth,
    };

    return {
      percentiles,
      kde,
      temperatureRange,
    };
  });

  // Reactive data loading with prop change detection
  createEffect(() => {
    // Capture all reactive props at the beginning of the effect
    // This ensures SolidJS tracking is established correctly
    const capturedStationId = stationId;
    const capturedCenterMmdd = center_mmdd;
    const capturedTodayTemp = todayTemp;
    const capturedWindowDays = windowDays;
    
    // Early return if required props are missing
    if (!capturedStationId || !capturedCenterMmdd) return;
    
    // Create a key for change detection
    const key = `${capturedStationId}|${capturedCenterMmdd}|${capturedTodayTemp ?? ""}|${capturedWindowDays}`;
    
    // Only trigger load if the key has changed
    if (key !== lastKey) {
      lastKey = key;
      
      // Call load with captured values to avoid accessing reactive props in async context
      loadWithCapturedProps({
        stationId: capturedStationId,
        center_mmdd: capturedCenterMmdd,
        ...(capturedTodayTemp !== undefined && { todayTemp: capturedTodayTemp }),
        windowDays: capturedWindowDays,
      });
    }
  });

  async function loadWithCapturedProps(capturedProps: {
    stationId: string | number;
    center_mmdd: string;
    todayTemp?: number | null;
    windowDays: number;
  }) {
    // All props are already captured, safe to use in async context
    const params = {
      stationId: capturedProps.stationId,
      center_mmdd: capturedProps.center_mmdd,
      ...(capturedProps.todayTemp !== undefined && { todayTemp: capturedProps.todayTemp }),
      windowDays: capturedProps.windowDays,
    };

    try {
      setLoading(true);
      setError(null);
      setProcessedData(null);

      // Validate input parameters
      validateParams(params);

      const rows = await requestHistoricalWindow({
        station_id: params.stationId,
        center_mmdd: params.center_mmdd,
        window_days: params.windowDays,
      });

      // Validate and process the raw data
      const processed = validateAndProcessData(rows);
      
      setData(rows);
      setProcessedData(processed);
    } catch (e) {
      console.error("Chart data loading failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
      setProcessedData(null);
    } finally {
      setLoading(false);
    }
  }

  // Public reload function that respects reactive prop capture
  async function reload() {
    // Capture current prop values for the reload
    const capturedStationId = stationId;
    const capturedCenterMmdd = center_mmdd;
    const capturedTodayTemp = todayTemp;
    const capturedWindowDays = windowDays;

    if (!capturedStationId || !capturedCenterMmdd) {
      console.warn("Cannot reload: missing required parameters");
      return;
    }

    await loadWithCapturedProps({
      stationId: capturedStationId,
      center_mmdd: capturedCenterMmdd,
      ...(capturedTodayTemp !== undefined && { todayTemp: capturedTodayTemp }),
      windowDays: capturedWindowDays,
    });
  }

  return {
    loading,
    error,
    data,
    processedData,
    calculations,
    reload,
  };
}
