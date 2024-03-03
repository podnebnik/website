import Highcharts from 'highcharts'
import Heatmap from 'highcharts/modules/heatmap'
import Data from 'highcharts/modules/data'
import BoostCanvas from 'highcharts/modules/boost-canvas'
import Boost from 'highcharts/modules/boost'
import Accessibility from 'highcharts/modules/accessibility'
Heatmap(Highcharts)
Data(Highcharts)
BoostCanvas(Highcharts)
Boost(Highcharts)
Accessibility(Highcharts)

import { createEffect, createSignal } from "solid-js";

const config = {
    data: {
        csvURL: 'https://stage-data.podnebnik.org/temperature/temperature~2Eslovenia~2Ehistorical~2Emap_running_10year_average.csv?_stream=on&_sort=rowid&year_end__exact=2020&_size=max&_col=x&_col=y&_col=temperature_average',
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

export function TemperatureSloveniaHeatMap() {
    const patternInput = createSignal(2020);
    const setYear = patternInput[1];
    const year = patternInput[0];

    let hm = null

    let temperature_data = {}

    function chart(element) {
        // Create a new chart every time the config changes
        createEffect(() => {
            hm = Highcharts.chart(element, config)
        })
    }

    async function requestData(year, hm) {
        if (temperature_data[year] === undefined) {
            const result = await fetch(`https://stage-data.podnebnik.org/temperature/temperature~2Eslovenia~2Ehistorical~2Emap_running_10year_average.json?_sort=rowid&year_end__exact=${year}&_size=max&_col=x&_col=y&_col=temperature_average`);
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
