// setup HighCharts
import Highcharts from 'highcharts'
import Map from 'highcharts/modules/map'
import Heatmap from 'highcharts/modules/heatmap'
import GeoHeatmap from 'highcharts/modules/geoheatmap'
import Data from 'highcharts/modules/data'
import BoostCanvas from 'highcharts/modules/boost-canvas'
import Boost from 'highcharts/modules/boost'
import Accessibility from 'highcharts/modules/accessibility'
Map(Highcharts)
Heatmap(Highcharts)
GeoHeatmap(Highcharts)
Data(Highcharts)
BoostCanvas(Highcharts)
Boost(Highcharts)
Accessibility(Highcharts)

// World map
import topology from '@highcharts/map-collection/custom/world-highres.topo.json'

import { createEffect, createSignal } from "solid-js";

// URL
const baseUrl = 'https://stage-data.podnebnik.org'
// const baseUrl = 'http://localhost:8010'

// colors
const colors = [
    '#caeaf4',
    '#b7d2e5',
    '#8d9cbe',
    // '#8c2b8a',
    '#151352',
    '#132c86',
    '#1f4498',
    '#245da4',
    '#1d89b7',
    '#1ca2bb',
    '#78c8bf',
    '#90dfa5',
    '#d7f3c5',
    '#faf0b2',
    '#f8cb66',
    '#fb9647',
    // focused
    '#8c2b8a',
    //
    '#f74e27',
    '#e42026',
    '#980428',
    '#4b0219',
    '#18000b',
]

let colorCategoriesWide = []
let colorStepsWide = []
const colorCategoriesWideStart = -10
const colorStepsStart = -12
const colorCategoriesWideEnd = colorCategoriesWideStart + 2 * (colors.length - 2)
const colorStepsEnd = 30
for (let i = 0; i < colors.length; i++) {
    colorStepsWide.push([i / (colors.length - 1), colors[i]])

    if (i === 0) {
        colorCategoriesWide.push({
            to: colorCategoriesWideStart,
            color: colors[i]
        })
    } else if (i === colors.length - 1) {
        colorCategoriesWide.push({
            from: colorCategoriesWideStart + (i - 1) * 2,
            color: colors[i]
        })
    } else {
        colorCategoriesWide.push({
            from: colorCategoriesWideStart + (i - 1) * 2,
            to: colorCategoriesWideStart + i * 2,
            color: colors[i]
        })
    }
}

const configSlovenia = {
    data: {
        csvURL: `${baseUrl}/temperature/temperature~2Eslovenia_historical~2Emap_running_10year_average.csv?_stream=on&_sort=rowid&year_end__exact=2020&_size=max&_col=x&_col=y&_col=temperature_average`,
        parsed: function () {
            // TODO: figure out how to get rid of rowid in CSV
            this.columns.shift()
            this.rawColumns.shift()
        }
    },

    chart: {
        type: 'heatmap',
        height: '65%'
    },

    boost: {
        useGPUTranslations: true
    },

    title: {
        text: 'Desetletno povprečje temperature na dveh metrih'
    },

    xAxis: {
        visible: false
    },
    yAxis: {
        visible: false,
        startOnTick: false,
        endOnTick: false,
        tickPositions: [],
        min: 0,
        max: 165,
    },

    colorAxis: {
        stops: [
            [0, '#3060cf'],
            [0.5, '#fffbbc'],
            [0.9, '#c4463a'],
            [1, '#c4463a']
        ],
        min: 0,
        max: 20,
        startOnTick: false,
        endOnTick: false,
        labels: {
            format: '{value} °C'
        },
        reversed: false
    },

    legend: {
        align: 'right',
        layout: 'vertical',
        verticalAlign: 'top',
        margin: 0,
    },

    series: [{
        boostThreshold: 100,
        borderWidth: 0,
        tooltip: {
            headerFormat: '',
            pointFormat: '<b>{point.value:.2f} °C</b>'
        },
        turboThreshold: Number.MAX_VALUE // #3404, remove after 4.0.5 release
    }]
}

const geojson = Highcharts.topo2geo(topology);

const configEurope = {
    chart: {
        map: geojson,
        height: '100%'
    },

    title: {
        text: 'Povprečna letna temperatura na 2 metrih, 1850-1859',
        floating: true,
        align: 'left',
        x: 20,
        y: 30,
        style: {
            textOutline: '2px white',
        }
    },

    mapNavigation: {
        enabled: true,
        enableDoubleClickZoomTo: false,
        enableMouseWheelZoom: false,
        buttons: {
            zoomIn: {
                x: 20,
                y: -20
            },
            zoomOut: {
                x: 20,
                y: 10
            },
        },
        buttonOptions: {
            verticalAlign: 'bottom'
        }
    },

    legend: {
        align: 'right',
        floating: true,
        x: -10,
        y: -10,
    },

    mapView: {
        maxZoom: 6,
        fitToGeometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [-10, 30],
                    [-10, 60],
                    [45, 60],
                    [45, 30],
                    [-10, 30],
                ]
            ]
        }
    },

    colorAxis: {
        stops: colorStepsWide,
        min: colorStepsStart,
        max: colorStepsEnd,
        startOnTick: false,
        endOnTick: false,
        labels: {
            format: '{value} °C',
            style: {
                color: 'black',
                fontWeight: 'bold',
                textOutline: '1px white',
            }
        },
        reversed: false
    },

    series: [
    {
        type: 'geoheatmap',
        interpolation: {
            enabled: true
        },
        tooltip: {
            headerFormat: '',
            pointFormat: '<b>{point.value:.2f} °C</b>'
        },
    }, {
        nullColor: 'transparent',
        borderColor: '#222',
        states: {
            inactive: {
                enabled: false
            }
        },
        enableMouseTracking: false,
        joinBy: ['iso-a2', 'code'],
    }]
}

export function TemperatureSloveniaHeatMap() {
    const patternInput = createSignal(2020);
    const setYear = patternInput[1];
    const year = patternInput[0];

    let hm = null

    let temperature_data = {}

    function chart(element) {
        // Create a new chart every time the config changes
        createEffect(() => {
            hm = Highcharts.chart(element, configSlovenia)
        })
    }

    async function requestData(year, hm) {
        if (temperature_data[year] === undefined) {
            const result = await fetch(`${baseUrl}/temperature/temperature~2Eslovenia_historical~2Emap_running_10year_average.json?_sort=rowid&year_end__exact=${year}&_size=max&_col=x&_col=y&_col=temperature_average`);
            if (result.ok) {
                const data = await result.json();
                const rows = data['rows'];
                for (var row of rows) {
                    row.shift();
                }
                temperature_data[year] = rows;

                hm.hideLoading();
                hm.series[0].setData(rows);

                console.log(`Loaded ${year} data`);
            }
        } else {
            hm.hideLoading();
            hm.series[0].setData(temperature_data[year]);
        }
    }

    async function yearChanged(event) {
        const value = event.target.value
        console.log(value)

        hm.showLoading()

        await requestData(value, hm)

        setYear(value)
    }

    return <>
        <div use:chart></div>
        <div id="play-controls">
            <input id="range" type="range" min="1970" max="2020" step="1" value="2020" onInput={yearChanged} />
            <label id="value">{year}</label>
        </div>
    </>
}


export function TemperatureEuropeHeatMap() {
    const patternInputMode = createSignal('1850');
    const setMode = patternInputMode[1];
    const mode = patternInputMode[0];

    const patternInputYear = createSignal(1850);
    const setYear = patternInputYear[1];
    const year = patternInputYear[0];

    let hm = null

    let temperature_data = {}

    async function requestData(year, hm) {
        if (temperature_data[year] === undefined) {
            const result = await fetch(`${baseUrl}/temperature/temperature~2Eclimate_models~2Emap_running_10year_average.json?_sort=rowid&year_start__exact=${year}&_size=max&_col=longitude&_col=latitude&_col=temperature_ensemble_mean`);
            if (result.ok) {
                const data = await result.json();
                const rows = data['rows'];
                for (var row of rows) {
                    row.shift();
                }
                temperature_data[year] = rows;

                hm.hideLoading();
                hm.setTitle({text: `Povprečna letna temperatura na 2 metrih, ${year}-${year + 9}`})
                hm.series[0].setData(rows);

                console.log(`Loaded ${year} data`);
            }
        } else {
            hm.hideLoading();
            hm.setTitle({text: `Povprečna letna temperatura na 2 metrih, ${year}-${year + 9}`})
            hm.series[0].setData(temperature_data[year]);
        }
    }

    function chart(element) {
        // Create a new chart every time the config changes
        createEffect(() => {
            hm = Highcharts.mapChart(element, configEurope)
            hm.showLoading()
            requestData(1850, hm)
        })
    }

    function setModeAndYear(value) {
        hm.showLoading()

        setMode(value.toString())
        requestData(value, hm)
    }

    return <div className="lg:flex lg:flex-row">
        <div use:chart className="lg:basis-3/4"></div>
        <div className="lg:basis-1/4">
            <button class="btn btn-sm" disabled={mode() == '1850'} onClick={() => setModeAndYear(1850)}>1850</button>
            <button class="btn btn-sm ml-gap" disabled={mode() == '2020'} onClick={() => setModeAndYear(2020)}>2020</button>
            <button class="btn btn-sm ml-gap" disabled={mode() == '2090'} onClick={() => setModeAndYear(2090)}>2090</button>
            <button class="btn btn-sm ml-gap" disabled={mode() == 'slider'} onClick={() => setMode('slider')}>Drsnik</button>

            <input id="steps-range" type="range" min="0" max="5" value="2.5" step="0.5" className="input-range" disabled={mode() != 'slider'} />
        </div>
    </div>
}
