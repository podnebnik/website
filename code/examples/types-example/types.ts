/**
 * Local example types for the `code/examples/types-example` folder.
 *
 * These mirror a small subset of the original `code/types/weather.ts`
 * used only by the examples so we can safely remove the heavy `weather`
 * module from the main `code/types` barrel without breaking examples.
 */

export interface ExampleCoordinates {
  latitude: number;
  longitude: number;
}

export interface WeatherStation {
  id: string;
  name: string;
  coordinates: ExampleCoordinates;
  elevation?: number | null;
  active: boolean;
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface AppError {
  category: string;
  message: string;
  details?: string;
}
