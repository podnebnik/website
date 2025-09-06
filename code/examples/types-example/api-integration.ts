import { DatasetteResponse } from "../../types/api";
import { WeatherStation, Result, AppError } from "./types";

// 1. Type-safe API client class
class WeatherApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = "http://localhost:8001/data") {
    this.baseUrl = baseUrl;
  }

  // 2. Typed API method with proper error handling
  async fetchWeatherStations(): Promise<Result<WeatherStation[], AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/temperature_stations.json`);
      
      if (!response.ok) {
        return {
          success: false,
          error: {
            category: "network" as const,
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: `Failed to fetch from ${this.baseUrl}`
          }
        };
      }

      const data: DatasetteResponse = await response.json();
      
      // 3. Basic type validation (simplified for example)
      if (!Array.isArray(data.rows)) {
        return {
          success: false,
          error: {
            category: "validation" as const,
            message: "Invalid weather station data format",
            details: "Expected array in data.rows"
          }
        };
      }

      // Transform raw data to WeatherStation objects
      const stations: WeatherStation[] = data.rows.map((row: any) => ({
        id: String(row[0] || row.id),
        name: String(row[1] || row.name || "Unknown Station"),
        coordinates: {
          latitude: Number(row[2] || row.latitude || 0),
          longitude: Number(row[3] || row.longitude || 0)
        },
        elevation: row[4] || row.elevation || null,
        active: Boolean(row[5] ?? row.active ?? true)
      }));

      return {
        success: true,
        data: stations
      };

    } catch (error) {
      return {
        success: false,
        error: {
          category: "network" as const,
          message: error instanceof Error ? error.message : "Network error",
          details: "Failed to fetch weather stations"
        }
      };
    }
  }

  // 4. Generic API method with type parameters
  async fetchData<T = any[]>(endpoint: string): Promise<Result<T, AppError>> {
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`);

      if (!response.ok) {
        return {
          success: false,
          error: {
            category: "network" as const,
            message: `Failed to fetch data from ${endpoint}`,
            details: `HTTP ${response.status}`
          }
        };
      }

      const data: DatasetteResponse = await response.json();
      
      return {
        success: true,
        data: data.rows as T
      };

    } catch (error) {
      return {
        success: false,
        error: {
          category: "network" as const,
          message: error instanceof Error ? error.message : "Failed to fetch data",
          details: `Error fetching from ${endpoint}`
        }
      };
    }
  }
}

// 5. Usage examples with proper typing
export const apiClient = new WeatherApiClient();

// Example: Fetching stations with error handling
export async function loadWeatherStations(): Promise<WeatherStation[]> {
  const result = await apiClient.fetchWeatherStations();
  
  if (!result.success) {
    console.error("Failed to load weather stations:", result.error.message);
    throw new Error(result.error.message);
  }
  
  return result.data;
}

// Example: Generic data fetching
export async function loadTemperatureData(
  stationId: string,
  limit = 100
): Promise<any[]> {
  const endpoint = `temperature_data.json?station_id=${stationId}&_size=${limit}`;
  const result = await apiClient.fetchData(endpoint);
  
  if (!result.success) {
    console.error(`Failed to load temperature data:`, result.error.message);
    return [];
  }
  
  return result.data;
}

// 6. Type-safe data transformation
export function transformRawData<T, R>(
  rawData: T[],
  transformer: (item: T) => R | null
): R[] {
  return rawData
    .map(transformer)
    .filter((item): item is R => item !== null);
}

// Example transformer
export const temperatureDataTransformer = (rawRow: any[]) => {
  if (rawRow.length < 3) return null;
  
  return {
    date: new Date(rawRow[0]),
    temperature: Number(rawRow[1]),
    stationId: String(rawRow[2])
  };
};

export { WeatherApiClient };
