import { createSignal } from "solid-js";
import { IsItHotDot } from "../components/is-it-hot-dot.jsx";

// URL
const baseUrl = 'https://stage-data.podnebnik.org'
// const baseUrl = 'http://localhost:8010'

const percentile_labels = {
    'p0': 'manj kot 5 %',
    'p05': '5 %',
    'p20': '20 %',
    'p40': '40 %',
    'p60': '60 %',
    'p80': '80 %',
    'p95': '95 %',
    '': '',
}

const vrednosti = {
    'p0': 'Niti pod razno',
    'p05': 'Ne!',
    'p20': 'Ne.',
    'p40': 'Niti ne.',
    'p60': 'Ja.',
    'p80': 'Ja!',
    'p95': 'Ja, absolutno!',
    '': '',
}

const opisi = {
    'p0': 'Se hecaš?! Ful je mraz!',
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
    const station = {
        vremenarID: 'METEO-1495',
        localID: 'LJU',
    }

    const [result, setResult] = createSignal('');
    const [tempMin, setTempMin] = createSignal('');
    const [timeMin, setTimeMin] = createSignal('');
    const [tempMax, setTempMax] = createSignal('');
    const [timeMax, setTimeMax] = createSignal('');
    const [tempAvg, setTempAvg] = createSignal('');
    const [timeUpdated, setTimeUpdated] = createSignal('');

    async function requestData(station) {
        console.log(`Loading ${station.localID} data`)

        const resultAverage = await fetch(`${vremenarBaseUrl}/stations/details/${station.vremenarID}?country=si`);
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



            const resultPercentile = await fetch(`${baseUrl}/temperature/temperature~2Edaily~2Eaverage_percentiles.json?date__exact=${date}&_col=p05&_col=p20&_col=p40&_col=p60&_col=p80&_col=p95`);
            if (resultPercentile.ok) {
                const dataPercentile = await resultPercentile.json();

                console.log(`Loaded ${station.localID} data`);

                let columns = dataPercentile['columns'];
                let rows = dataPercentile['rows'][0];
                columns.shift();
                rows.shift();

                let resultValue = -1
                if (averageTemperature < rows[0]) {
                    resultValue = 'p0'
                } else {
                    for (let i = 0; i < rows.length; i++) {
                        if (i == rows.length - 1) {
                            resultValue = 'p95'
                        } else if (averageTemperature >= rows[i] && averageTemperature < rows[i + 1]) {
                            resultValue = columns[i]
                            break
                        }
                    }
                }

                console.log(`Rezultat: ${vrednosti[resultValue]} (${opisi[resultValue]})`)

                setResult(resultValue)
            }
        }
    }

    requestData(station)

    return <div class="text-center">
        <p class="font-normal text-5xl font-sans">
            Ali je danes vroče v{" "}
            <select id="locations"
                class="select font-bold appearance-none inline-block bg-transparent rounded-none focus:outline-hidden leading-[64px] hover:cursor-pointer transition-all duration-300">
                <option value="LJU">Ljubljani</option>
            </select>
            ?
        </p>
        <p class="font-black text-6xl">
            <IsItHotDot color={result()} class="mr-8" />{vrednosti[result()]}
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
            zabeleženih dni v tem obdobju je bila temperatura nižja.</p>

        <p class="text-gray-400 text-sm leading-6 italic">Zadnja posodobitev: {timeUpdated()}</p>
    </div>;
}
