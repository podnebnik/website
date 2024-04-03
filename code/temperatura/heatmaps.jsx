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

const colorsNoFocus = [
    '#caeaf4',
    '#b7d2e5',
    '#8d9cbe',
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
    '#f74e27',
    '#e42026',
    '#980428',
    '#4b0219',
    '#18000b',
]

let colorStepsWide = []
let colorStepsNarrow = []
const colorStepsStartWide = -10
const colorStepsEndWide = 30
const colorStepsStartNarrow = -1
const colorStepsEndNarrow = 18
for (let i = 0; i < colors.length; i++) {
    colorStepsWide.push([i / (colors.length - 1), colors[i]])
}
for (let i = 0; i < colorsNoFocus.length; i++) {
    colorStepsNarrow.push([i / (colorsNoFocus.length - 1), colorsNoFocus[i]])
}

const configSlovenia = {
    chart: {
        type: 'heatmap',
        height: '65%'
    },

    title: {
        text: 'Povprečna letna temperatura',
        floating: true,
        align: 'left',
        x: 0,
        y: 10,
        style: {
            textOutline: '2px white',
        },
        widthAdjust: 0
    },
    subtitle: {
        text: '',
        floating: true,
        align: 'left',
        x: 0,
        y: 30,
        style: {
            color: 'black',
            fontSize: '1em',
            textOutline: '1.5px white',
        },
        widthAdjust: 0
    },

    boost: {
        useGPUTranslations: true
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
        stops: colorStepsNarrow,
        min: colorStepsStartNarrow,
        max: colorStepsEndNarrow,
        startOnTick: false,
        endOnTick: false,
        labels: {
            format: '{value}',
            style: {
                color: 'black',
                fontWeight: 'bold',
                textOutline: '1px white',
            }
        },
        reversed: false
    },

    legend: {
        align: 'right',
        layout: 'vertical',
        verticalAlign: 'bottom',
        floating: true,
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
        text: 'Povprečna letna temperatura',
        floating: true,
        align: 'left',
        x: 20,
        y: 30,
        style: {
            textOutline: '2px white',
        },
        widthAdjust: 0
    },
    subtitle: {
        text: '',
        floating: true,
        align: 'left',
        x: 20,
        y: 50,
        style: {
            color: 'black',
            fontSize: '1em',
            textOutline: '1.5px white',
        },
        widthAdjust: 0
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
        min: colorStepsStartWide,
        max: colorStepsEndWide,
        startOnTick: false,
        endOnTick: false,
        labels: {
            format: '{value}',
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
    const patternInputMode = createSignal('2020');
    const setMode = patternInputMode[1];
    const mode = patternInputMode[0];

    const patternInputYear = createSignal(2020);
    const setYear = patternInputYear[1];
    const year = patternInputYear[0];

    let hm = null

    let temperature_data = {}

    function chart(element) {
        // createEffect(() => {
        hm = Highcharts.chart(element, configSlovenia)
        hm.showLoading()

        requestData(year(), hm)
        // })
    }

    async function requestData(year, hm) {
        console.log(`Requesting temperature for ${year}`)
        if (temperature_data[year] === undefined) {
            console.log(`Loading ${year} data`)

            const result = await fetch(`${baseUrl}/temperature/temperature~2Eslovenia_historical~2Emap_running_10year_average.json?_sort=rowid&year_end__exact=${year}&_size=max&_col=x&_col=y&_col=temperature_average`);
            if (result.ok) {
                const data = await result.json();
                const rows = data['rows'];
                for (var row of rows) {
                    row.shift();
                }
                temperature_data[year] = rows;

                hm.hideLoading();
                hm.setSubtitle({text: `${year-9}-${year}`})
                hm.series[0].setData(rows);

                console.log(`Loaded ${year} data`);
            }
        } else {
            hm.hideLoading();
            hm.setSubtitle({text: `${year-9}-${year}`})
            hm.series[0].setData(temperature_data[year]);
        }
    }

    function setModeAndYear(value) {
        console.log(`Setting mode to ${value}`)
        hm.showLoading()

        setMode(value.toString())
        setYear(value)
        requestData(value, hm)
    }

    return <>
        <div use:chart></div>
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap text-sm items-center gap-1">
                <span>Leto:</span>
                <button class="btn-control btn-sm" disabled={mode() == '1970'} onClick={() => setModeAndYear(1970)}>1970</button>
                <button class="btn-control btn-sm" disabled={mode() == '1990'} onClick={() => setModeAndYear(1990)}>1990</button>
                <button class="btn-control btn-sm" disabled={mode() == '2000'} onClick={() => setModeAndYear(2000)}>2000</button>
                <button class="btn-control btn-sm" disabled={mode() == '2010'} onClick={() => setModeAndYear(2010)}>2010</button>
                <button class="btn-control btn-sm" disabled={mode() == '2020'} onClick={() => setModeAndYear(2020)}>2020</button>
                <button class="btn-control btn-sm" disabled={mode() == 'slider'} onClick={() => setMode('slider')}>Drsnik</button>

                <input id="steps-range" type="range" min="0" max="5" value="2.5" step="0.5" className="input-range" disabled={mode() != 'slider'} />
            </div>
            <div className="text-sm italic">
                Lorem ipsum ...
            </div>
        </div>
    </>
}


export function TemperatureEuropeHeatMap() {
    const patternInputPercentile = createSignal('50');
    const setPercentile = patternInputPercentile[1];
    const percentile = patternInputPercentile[0];

    const patternInputMode = createSignal('2020');
    const setMode = patternInputMode[1];
    const mode = patternInputMode[0];

    const patternInputYear = createSignal(2020);
    const setYear = patternInputYear[1];
    const year = patternInputYear[0];

    let hm = null

    let temperature_data = {
        '50': {},
        '10': {},
        '25': {},
        '75': {},
        '90': {}
    }

    async function requestData(percentile, year, hm) {
        console.log(`Requesting ${percentile} percentile for ${year}`)
        let percentileLabel = 'srednja vrednost'
        if (percentile != '50') {
            percentileLabel = `${percentile}. percentil`
        }

        if (temperature_data[percentile][year] === undefined) {
            console.log(`Loading ${year} data for ${percentile} percentile`)

            let variable = 'temperature_ensemble_mean'
            if (percentile != '50') {
                variable = `temperature_percentile_${percentile}`
            }
            const result = await fetch(`${baseUrl}/temperature/temperature~2Eclimate_models~2Emap_running_10year_average.json?_sort=rowid&year_start__exact=${year}&_size=max&_col=longitude&_col=latitude&_col=${variable}`);
            if (result.ok) {
                const data = await result.json();
                const rows = data['rows'];
                for (var row of rows) {
                    row.shift();
                }
                temperature_data[percentile][year] = rows;

                hm.hideLoading();
                hm.setSubtitle({text: `${year}-${year + 9}, ${percentileLabel}`})
                hm.series[0].setData(rows);

                console.log(`Loaded ${year} data for ${percentile} percentile`);
            }
        } else {
            hm.hideLoading();
            hm.setSubtitle({text: `${year}-${year + 9}, ${percentileLabel}`})
            hm.series[0].setData(temperature_data[percentile][year]);
        }
    }

    function chart(element) {
        // createEffect(() => {
        hm = Highcharts.mapChart(element, configEurope)
        hm.showLoading()

        requestData(percentile(), year(), hm)
        // })
    }

    function setPercentileClick(value) {
        console.log(`Setting percentile to ${value}`)

        hm.showLoading()

        setPercentile(value)
        requestData(value, year(), hm)
    }

    function setModeAndYear(value) {
        console.log(`Setting mode to ${value}`)
        hm.showLoading()

        setMode(value.toString())
        setYear(value)
        requestData(percentile(), value, hm)
    }

    return <>
        <div use:chart></div>
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap text-sm items-center gap-1">
                <span>Vrednost temperature:</span>
                <button class="btn-control btn-sm" disabled={percentile() == '50'} onClick={() => setPercentileClick('50')}>Srednja vrednost</button>
                <button class="btn-control btn-sm" disabled={percentile() == '10'} onClick={() => setPercentileClick('10')}>10. percentil</button>
                <button class="btn-control btn-sm" disabled={percentile() == '25'} onClick={() => setPercentileClick('25')}>25. percentil</button>
                <button class="btn-control btn-sm" disabled={percentile() == '75'} onClick={() => setPercentileClick('75')}>75. percentil</button>
                <button class="btn-control btn-sm" disabled={percentile() == '90'} onClick={() => setPercentileClick('90')}>90. percentil</button>
            </div>
            <div className="flex flex-wrap text-sm items-center gap-1">
                <span>Leto:</span>
                <button class="btn-control btn-sm" disabled={mode() == '1850'} onClick={() => setModeAndYear(1850)}>1850</button>
                <button class="btn-control btn-sm" disabled={mode() == '2020'} onClick={() => setModeAndYear(2020)}>2020</button>
                <button class="btn-control btn-sm" disabled={mode() == '2090'} onClick={() => setModeAndYear(2090)}>2090</button>
                <button class="btn-control btn-sm" disabled={mode() == 'slider'} onClick={() => setMode('slider')}>Drsnik</button>

                <input id="steps-range" type="range" min="0" max="5" value="2.5" step="0.5" className="input-range" disabled={mode() != 'slider'} />
            </div>
            <div className="text-sm italic">
                Lorem ipsum ...
            </div>
        </div>
    </>
}
