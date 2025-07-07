/**
 * @typedef {Object} StationData
 * @property {number} rowid - The row ID of the station in the database.
 * @property {number} station_id - The unique identifier for the weather station.
 * @property {string} name - The name of the weather station.
 * @property {string} name_locative - The name of the station in locative case (e.g., "v Ljubljani").
 */

/**
 * @typedef {[number, number, string, string]} StationRow
 * @description Represents a single row of station data.
 */

/**
 * @typedef {Object} StationsResponse
 * @property {string} database - The name of the database containing the stations data.
 * @property {string} table - The name of the table containing the stations data.
 * @property {boolean} is_view - Whether the table is a database view.
 * @property {string} human_description_en - Human-readable description of the data in English.
 * @property {Array<StationRow>} rows - Array of station data rows. Each row contains [rowid, station_id, name, name_locative].
 * @property {boolean} truncated - Whether the result set was truncated.
 * @property {number} filtered_table_rows_count - The total number of rows in the filtered result.
 * @property {Array<string>} expanded_columns - List of column names that are expanded.
 * @property {Array<string>} expandable_columns - List of column names that can be expanded.
 * @property {Array<string>} columns - List of column names in the result set.
 * @property {Array<string>} primary_keys - List of primary key column names.
 * @property {Object} units - Mapping of columns to their units of measurement.
 * @property {Object} query - Information about the executed SQL query.
 * @property {string} query.sql - The executed SQL query string.
 * @property {Object} query.params - Parameters passed to the SQL query.
 * @property {Object} facet_results - Results of facet queries, if any.
 * @property {Array<Object>} suggested_facets - Suggested facets for the result set.
 * @property {null|string} next - Token for the next page of results, if available.
 * @property {null|string} next_url - URL for the next page of results, if available.
 * @property {boolean} private - Whether the data is private.
 * @property {boolean} allow_execute_sql - Whether SQL execution is allowed on this data.
 * @property {number} query_ms - Time taken to execute the query in milliseconds.
 */

/**
 * @typedef {Object} ProcessedStation
 * @property {number} station_id - The unique identifier for the weather station.
 * @property {string} name_locative - The locative name of the station (excluding the prefix).
 * @property {string} prefix - The prefix part of the locative name (e.g., "v", "na").
 */

/**
 * @typedef {Object} StationsResult
 * @property {boolean} success - Whether the stations were successfully loaded.
 * @property {Array<ProcessedStation>} data - Array of processed station objects (only present if success is true).
 */

/**
 * @typedef {Object} RequestStationData
 * @property {string} resultValue - The percentile result of the current average temperature.
 * @property {number} resultTemperatureValue - The temperature value corresponding to the percentile result.
 * @property {number} tempMin - The minimum temperature recorded in the last 24 hours.
 * @property {string} timeMin - The time when the minimum temperature was recorded, formatted as "danes ob HH:MM" or "včeraj ob HH:MM".
 * @property {number} tempMax - The maximum temperature recorded in the last 24 hours.
 * @property {string} timeMax - The time when the maximum temperature was recorded, formatted as "danes ob HH:MM" or "včeraj ob HH:MM".
 * @property {number} tempAvg - The average temperature recorded in the last 24 hours.
 * @property {string} timeUpdated - The last update time of the temperature data,
 */

// We export an empty object to ensure this file is treated as a module
export default {}