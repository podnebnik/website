/** @import * as Types "./types" */

import { BASE_URL, VREMENAR_BASE_URL } from "./constants.mjs"

/**
 * Returns a string representation of a number, prefixing it with a zero if it is less than 10.
 *
 * @param {number} number - The number to format.
 * @returns {string} The zero-prefixed number as a string if less than 10, otherwise the number as a string.
 */
function zeroPrefix(number) {
    if (number < 10) {
        return `0${number}`
    }
    return `${number}`
}

/**
 * Formats a JavaScript Date object into a string suitable for queries (YYYY-MM-DD).
 *
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string in 'YYYY-MM-DD' format.
 */
function formatDateForQuery(date) {
    let year = `${date.getFullYear()}`
    let month = `${zeroPrefix(date.getMonth() + 1)}`
    let day = `${zeroPrefix(date.getDate())}`
    return `${year}-${month}-${day}`
}

/**
 * Formats a given date as a human-readable string indicating whether the date is today or yesterday,
 * and includes the time in HH:MM format.
 *
 * @param {Date} date - The date to format.
 * @param {Date} updated - The reference date to compare against for determining "today" or "yesterday".
 * @returns {string} A formatted string such as "danes ob 14:30" or "včeraj ob 09:15".
 */
function formatTime(date, updated) {
    let day = date.getDate() == updated.getDate() ? 'danes' : 'včeraj'
    let time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`

    return `${day} ob ${time}`
}

/**
 * Asynchronously loads a list of temperature stations from a remote JSON endpoint.
 *
 * Fetches station data, processes each station row, and returns an array of station objects.
 * Each object contains the station's ID, the locative name (excluding the prefix), and the prefix itself.
 *
 * @async
 * @function loadStations
 * @returns {Promise<{ success: true, stations: Array<Types.ProcessedStation> } | { success: false, error: Error | string }>}
 *   Resolves to an array of station objects, or an empty array if the fetch fails.
 */
export async function loadStations() {
    const resultStations = await fetch(`${BASE_URL}/temperature/temperature~2Eslovenia_stations.json?&_col=station_id&_col=name&_col=name_locative&_sort=name`);

    if (resultStations.ok) {
        try {

            /** @type {Array<Types.ProcessedStation>} */
            let stationsList = [];
            /** @type {Types.StationsResponse} */
            const dataStations = await resultStations.json();
            for (let row of dataStations["rows"]) {
                let name_list = row[3].split(' ')
                stationsList.push({
                    'station_id': row[1],
                    'name_locative': name_list.slice(1).join(" "),
                    'prefix': name_list[0],
                })
            }
            return { success: true, stations: stationsList };
        } catch (error) {
            console.error('Error processing station data:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }

    }
    console.error('Failed to load stations');
    return { success: false, error: 'Failed to load stations' };
}

/**
 * Fetches and processes temperature data for a given weather station.
 *
 * Retrieves the latest average, minimum, and maximum temperatures, as well as historical percentile data,
 * for the specified station. Determines the percentile bucket for the current average temperature.
 *
 * @async
 * @param {string} stationID - The ID of the weather station to fetch data for.
 * @param {Object} options - Additional options for the request
 * @param {AbortSignal} options.signal - AbortController signal for request cancellation
 * @returns {Promise<Types.RequestStationData | {success: false, error: Error | string}>} An object containing temperature statistics and percentile results. If the request fails, returns an error object.
 */
export async function requestData(stationID, options = {}) {
    try {
        const resultAverage = await fetch(`${VREMENAR_BASE_URL}/stations/details/METEO-${stationID}?country=si`, {
            signal: options.signal
        });
        if (resultAverage.ok) {
            const dataAverage = await resultAverage.json();
            const averageTemperature = dataAverage.statistics.temperature_average_24h;

            let timeUpdated = new Date(Number(dataAverage.statistics.timestamp))

            const date = formatDateForQuery(timeUpdated)

            let timeMinDate = new Date(Number(dataAverage.statistics.timestamp_temperature_min_24h))
            let timeMaxDate = new Date(Number(dataAverage.statistics.timestamp_temperature_max_24h))

            const resultPercentile = await fetch(`${BASE_URL}/temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&station_id__exact=${stationID}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`, {
                signal: options.signal
            });
            if (resultPercentile.ok) {
                const dataPercentile = await resultPercentile.json();

                let columns = dataPercentile['columns'];
                let values = dataPercentile['rows'][0];
                columns.shift();
                values.shift();

                let resultValue = -1
                let resultTemperatureValue = -1
                if (averageTemperature < values[0]) {
                    resultValue = 'p00'
                    resultTemperatureValue = values[0]
                } else {
                    for (let i = 0; i < values.length; i++) {
                        if (i == values.length - 1) {
                            resultValue = 'p95'
                            resultTemperatureValue = values[i]
                        } else if (averageTemperature >= values[i] && averageTemperature < values[i + 1]) {
                            resultValue = columns[i]
                            resultTemperatureValue = values[i]
                            break
                        }
                    }
                }

                return {
                    success: true,
                    data: {
                        resultValue,
                        resultTemperatureValue,
                        tempMin: dataAverage.statistics.temperature_min_24h,
                        timeMin: formatTime(timeMinDate, timeUpdated),
                        tempMax: dataAverage.statistics.temperature_max_24h,
                        timeMax: formatTime(timeMaxDate, timeUpdated),
                        tempAvg: averageTemperature,
                        timeUpdated: new Intl.DateTimeFormat('sl-SI', {
                            dateStyle: 'long',
                            timeStyle: 'short',
                        }).format(timeUpdated),
                    }
                }
            }
        }
    } catch (error) {
        // If the request was aborted, propagate the abort error
        if (error.name === 'AbortError') {
            throw error;
        }

        console.error(`Error fetching data for station ${stationID}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    console.error(`Failed to load data for station ${stationID}`);
    return {
        success: false,
        error: 'Failed to load data for station ' + stationID,
    };
}