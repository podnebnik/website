import { createSignal, Show, For } from "solid-js";
import { IsItHotDot } from "../components/is-it-hot-dot.jsx";

/**
 * @typedef {'p00' | 'p05' | 'p20' | 'p40' | 'p60' | 'p80' | 'p95'} ValidPercentile
 * @typedef { ValidPercentile | ''} PercentileKey
 */

const DEFAULT_STATION_ID = 1495; // Ljubljana

// URL
const baseUrl = 'https://stage-data.podnebnik.org'
// const baseUrl = 'http://localhost:8010'

/**
 * @type {Record<PercentileKey, string>} PercentileLabels
 */
const percentile_labels = {
    'p00': 'manj kot 5 %',
    'p05': '5 %',
    'p20': '20 %',
    'p40': '40 %',
    'p60': '60 %',
    'p80': '80 %',
    'p95': '95 %',
    '': '',
}

/**
 * @type {Record<PercentileKey, string>} PercentileValues
 */
const vrednosti = {
    'p00': 'Niti pod razno',
    'p05': 'Ne!',
    'p20': 'Ne.',
    'p40': 'Niti ne.',
    'p60': 'Ja.',
    'p80': 'Ja!',
    'p95': 'Ja, absolutno!',
    '': '',
}

/**
 * @type {Record<PercentileKey, string>} PercentileDescriptions
 */
const opisi = {
    'p00': 'Se hecaš?! Ful je mraz!',
    'p05': 'Pravzaprav je res mrzlo.',
    'p20': 'Dejansko je kar hladno.',
    'p40': 'Precej povprečno.',
    'p60': 'Je topleje kot običajno.',
    'p80': 'Res je vroče!',
    'p95': 'Peklensko vroče je!',
    '': '',
}

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
 * AliJeVroce is a Solid JS component that displays whether it is hot today in a selected location,
 * based on temperature statistics fetched from a remote API. It shows the minimum, average, and
 * maximum temperatures over the last 24 hours, their respective times, and compares the average
 * temperature to historical percentiles. The component also provides a textual and visual
 * representation of the result, along with the time of the last data update.
 *
 * @component
 * @returns {JSX.Element} The rendered component displaying temperature statistics and percentile comparison.
 */
export function AliJeVroce() {
    const vremenarBaseUrl = 'https://podnebnik.vremenar.app/staging'
    // const vremenarBaseUrl = 'http://localhost:8000'

    const [stations, setStations] = createSignal([{ 'station_id': 1495, 'name_locative': 'Ljubljani' }]);
    const [stationPrefix, setStationPrefix] = createSignal('v')

    /**
     * Signal to hold the result of the temperature percentile comparison.
     * It indicates how the current average temperature compares to historical data.
     * Possible values are 'p00', 'p05', 'p20', 'p40', 'p60', 'p80', 'p95', or an empty string if no data is available.
     * @type {import('solid-js').Signal<PercentileKey>}
     * @see {@link https://solidjs.com/docs/api#createsignal}
     */
    const [result, setResult] = createSignal('');
    const [resultTemperature, setResultTemperature] = createSignal('');

    // TODO: most likely we can join next 
    const [tempMin, setTempMin] = createSignal('');
    const [timeMin, setTimeMin] = createSignal('');
    const [tempMax, setTempMax] = createSignal('');
    const [timeMax, setTimeMax] = createSignal('');
    const [tempAvg, setTempAvg] = createSignal('');
    const [timeUpdated, setTimeUpdated] = createSignal('');

    async function loadStations() {
        const resultStations = await fetch(`${baseUrl}/temperature/temperature~2Eslovenia_stations.json?&_col=station_id&_col=name&_col=name_locative&_sort=name`);
        if (resultStations.ok) {
            let stationsList = [];
            const dataStations = await resultStations.json();
            for (let row of dataStations["rows"]) {
                console.log(row);
                let name_list = row[3].split(' ')
                stationsList.push({
                    'station_id': row[1],
                    'name_locative': name_list.slice(1).join(" "),
                    'prefix': name_list[0],
                })
            }
            setStations(stationsList);
        }
        document.getElementById("locations").value = 1495 // Ljubljana
    }

    async function requestData(stationID) {
        console.log(`Loading ${stationID} data`)

        const resultAverage = await fetch(`${vremenarBaseUrl}/stations/details/METEO-${stationID}?country=si`);
        if (resultAverage.ok) {
            const dataAverage = await resultAverage.json();
            const averageTemperature = dataAverage.statistics.temperature_average_24h;

            console.log(`Average temperature: ${averageTemperature}`)

            let timeUpdated = new Date(Number(dataAverage.statistics.timestamp))

            const date = formatDateForQuery(timeUpdated)
            console.log(`Date: ${timeUpdated} ${date}`)

            let timeMinDate = new Date(Number(dataAverage.statistics.timestamp_temperature_min_24h))
            let timeMaxDate = new Date(Number(dataAverage.statistics.timestamp_temperature_max_24h))
            setTempMin(dataAverage.statistics.temperature_min_24h)
            setTimeMin(formatTime(timeMinDate, timeUpdated))
            setTempMax(dataAverage.statistics.temperature_max_24h)
            setTimeMax(formatTime(timeMaxDate, timeUpdated))
            setTempAvg(averageTemperature)
            setTimeUpdated(new Intl.DateTimeFormat('sl-SI', {
                dateStyle: 'long',
                timeStyle: 'short',
            }).format(timeUpdated));



            const resultPercentile = await fetch(`${baseUrl}/temperature/temperature~2Eslovenia_historical~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&station_id__exact=${stationID}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`);
            if (resultPercentile.ok) {
                const dataPercentile = await resultPercentile.json();

                console.log(`Loaded ${stationID} data`);

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

                console.log(`Rezultat: ${vrednosti[resultValue]} (${opisi[resultValue]})`)

                setResult(resultValue)
                setResultTemperature(`${resultTemperatureValue} °C`)
            }
        }
    }

    function changedValue(event) {
        let newID = event.target.value;
        for (let station of stations()) {
            if (station.station_id == newID) {
                setStationPrefix(station.prefix);
                break;
            }
        }
        requestData(newID);
    }

    loadStations()
    requestData(DEFAULT_STATION_ID)
    const colorKey = result() === "" ? "initial" : result();


    return <div class="text-center">
        <p class="font-normal text-5xl font-sans">
            Ali je danes vroče {stationPrefix()}&nbsp;
            <label for="locations" class="sr-only">Izberite lokacijo</label>
            <select id="locations"
                class="select max-fit font-bold appearance-none inline-block bg-transparent rounded-none focus:outline-hidden leading-[64px] hover:cursor-pointer transition-all duration-300"
                onChange={changedValue}>
                <For each={stations()}>{(item) => <option value={item.station_id}>{item.name_locative}</option>}</For>
            </select>
            ?
        </p>
        <p class="font-black text-6xl">
            <Show when={colorKey !== "initial"} fallback={<span class="text-muted">Trenutno ni podatka!</span>}>
                <IsItHotDot color={colorKey} class="mr-8" />{" "}
                {vrednosti[result()]}
            </Show>
        </p>
        <p class="text-4xl font-semibold">{opisi[result()]}</p>

        <p class="flex justify-center gap-12 text-xl">
            <span class="flex flex-col">
                <span class="text-gray-400 text-sm leading-6">minimum</span>
                <span>{tempMin()} °C</span>
                <span class="text-gray-400 text-sm leading-6">{timeMin()}</span>
            </span>
            <span class="flex flex-col">
                <span class="text-gray-400 text-sm leading-6">&nbsp;</span>
                <span class="font-bold">{tempAvg()} °C</span>
                <span class="text-gray-400 text-sm leading-6">povprečje zadnjih 24h</span>
            </span>
            <span class="flex flex-col">
                <span class="text-gray-400 text-sm leading-6">maksimum</span>
                <span>{tempMax()} °C</span>
                <span class="text-gray-400 text-sm leading-6">{timeMax()}</span>
            </span>
        </p>

        <p class="text-normal font-sans">V <span class="font-semibold">{percentile_labels[result()]}</span> vseh
            zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot{" "}
            <span class="font-semibold">{resultTemperature()}</span>.</p>

        <p class="text-gray-400 text-sm leading-6 italic">Zadnja posodobitev: {timeUpdated()}</p>
    </div>;
}
