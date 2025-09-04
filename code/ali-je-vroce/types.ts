/**
 * @description Represents a weather station's data.
 * @property rowid - The row ID of the station in the database.
 * @property station_id - The unique identifier for the weather station.
 * @property name - The name of the weather station.
 * @property name_locative - The name of the station in locative case (e.g., "v Ljubljani").
 */
export interface StationData {
    rowid: number;
    station_id: number;
    name: string;
    name_locative: string;
}

/**
 * @description Represents a single row of station data.
 */
export type StationRow = [number, number, string, string];

/**
 * @description Represents the response from the stations API.
 * @property database - The name of the database containing the stations data.
 * @property table - The name of the table containing the stations data.
 * @property is_view - Whether the table is a database view.
 * @property human_description_en - Human-readable description of the data in English.
 * @property rows - Array of station data rows. Each row contains [rowid, station_id, name, name_locative].
 * @property truncated - Whether the result set was truncated.
 * @property filtered_table_rows_count - The total number of rows in the filtered result.
 * @property expanded_columns - List of column names that are expanded.
 * @property expandable_columns - List of column names that can be expanded.
 * @property columns - List of column names in the result set.
 * @property primary_keys - List of primary key column names.
 * @property units - Mapping of columns to their units of measurement.
 * @property query - Information about the executed SQL query.
 * @property query.sql - The executed SQL query string.
 * @property query.params - Parameters passed to the SQL query.
 * @property facet_results - Results of facet queries, if any.
 * @property suggested_facets - Suggested facets for the result set.
 * @property next - Token for the next page of results, if available.
 * @property next_url - URL for the next page of results, if available.
 * @property private - Whether the data is private.
 * @property allow_execute_sql - Whether SQL execution is allowed on this data.
 * @property query_ms - Time taken to execute the query in milliseconds.
 */
export interface StationsResponse {
    database: string;
    table: string;
    is_view: boolean;
    human_description_en: string;
    rows: StationRow[];
    truncated: boolean;
    filtered_table_rows_count: number;
    expanded_columns: string[];
    expandable_columns: string[];
    columns: string[];
    primary_keys: string[];
    units: Record<string, string>;
    query: {
        sql: string;
        params: Record<string, unknown>;
    };
    facet_results: Record<string, unknown>;
    suggested_facets: Record<string, unknown>[];
    next: null | string;
    next_url: null | string;
    private: boolean;
    allow_execute_sql: boolean;
    query_ms: number;
}

/**
 * @description Represents a processed weather station with separated locative name and prefix.
 * @property station_id - The unique identifier for the weather station.
 * @property name_locative - The locative name of the station (excluding the prefix).
 * @property prefix - The prefix part of the locative name (e.g., "v", "na").
 */
export interface ProcessedStation {
    station_id: number;
    name_locative: string;
    prefix: string;
}

/**
 * @description Represents the result of a stations API request.
 * @property success - Whether the stations were successfully loaded.
 * @property data - Array of processed station objects (only present if success is true).
 */
export interface StationsResult {
    success: boolean;
    data?: ProcessedStation[];
}

/**
 * @description Represents the data for a specific weather station request.
 * @property resultValue - The percentile result of the current average temperature.
 * @property resultTemperatureValue - The temperature value corresponding to the percentile result.
 * @property tempMin - The minimum temperature recorded in the last 24 hours.
 * @property timeMin - The time when the minimum temperature was recorded, formatted as "danes ob HH:MM" or "včeraj ob HH:MM".
 * @property tempMax - The maximum temperature recorded in the last 24 hours.
 * @property timeMax - The time when the maximum temperature was recorded, formatted as "danes ob HH:MM" or "včeraj ob HH:MM".
 * @property tempAvg - The average temperature recorded in the last 24 hours.
 * @property timeUpdated - The last update time of the temperature data.
 */
export interface RequestStationData {
    resultValue: string;
    resultTemperatureValue: number;
    tempMin: number;
    timeMin: string;
    tempMax: number;
    timeMax: string;
    tempAvg: number;
    timeUpdated: string;
}