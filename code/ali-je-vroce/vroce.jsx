import { createSignal, For } from "solid-js";

// URL
const baseUrl = 'https://stage-data.podnebnik.org'
// const baseUrl = 'http://localhost:8010'

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

const barve = {
    'p00': '#2166ac',
    'p05': '#67a9cf',
    'p20': '#d1e5f0',
    'p40': '#ebebeb',
    'p60': '#f7cfb7',
    'p80': '#fc946a',
    'p95': '#b2182b',
    '': 'transparent',
}

function zeroPrefix(number) {
    if (number < 10) {
        return `0${number}`
    }
    return `${number}`
}

function formatDateForQuery(date) {
    let year = `${date.getFullYear()}`
    let month = `${zeroPrefix(date.getMonth() + 1)}`
    let day = `${zeroPrefix(date.getDate())}`
    return `${year}-${month}-${day}`
}

function formatTime(date, updated) {
    let day = date.getDate() == updated.getDate() ? 'danes' : 'včeraj'
    let time = `${zeroPrefix(date.getHours())}:${zeroPrefix(date.getMinutes())}`

    return `${day} ob ${time}`
}

export function AliJeVroce() {
    const vremenarBaseUrl = 'https://podnebnik.vremenar.app/staging'
    // const vremenarBaseUrl = 'http://localhost:8000'

    const [stations, setStations] = createSignal([{'station_id': 1495, 'name_locative': 'Ljubljani'}]);
    const [stationPrefix, setStationPrefix] = createSignal('v')
    const [result, setResult] = createSignal('');
    const [resultTemperature, setResultTemperature] = createSignal('');
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
            setTimeUpdated(timeUpdated.toLocaleString())

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
    requestData(1495)

    return <div class="text-center">
        <p class="font-normal text-5xl font-sans">
            Ali je danes vroče {stationPrefix()}&nbsp;
            <select id="locations"
                class="select font-bold appearance-none inline-block bg-transparent rounded-none focus:outline-none leading-[64px] hover:cursor-pointer transition-all duration-300"
                onChange={changedValue}>
            <For each={stations()}>{(item) => <option value={item.station_id}>{item.name_locative}</option>}</For>
            </select>
            ?
        </p>
        <p class="font-black text-6xl">
            <span class="inline-text rounded-[36px] px-9 mr-8" style={"background-color: " + barve[result()] + ";"}></span>
            {vrednosti[result()]}
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
        zabeleženih dni od leta 1950 v 15-dnevnem obdobju okoli današnjega dneva je bila povprečna dnevna temperatura nižja kot 
        <span class="font-semibold">{resultTemperature()}</span>.</p>

        <p class="text-gray-400 text-sm leading-6 italic">Zadnja posodobitev: {timeUpdated()}</p>
    </div>;
}
