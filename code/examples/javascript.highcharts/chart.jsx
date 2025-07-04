import Highcharts from 'highcharts'
import { createSignal, createEffect, mergeProps } from "solid-js";

import data from '../data'

const config = {
    title: {
        text: 'Fruit Consumption in JavaScript'
    },
    xAxis: {
        categories: ['Apples', 'Bananas', 'Oranges']
    },
    yAxis: {
        title: {
            text: 'Fruit eaten'
        }
    },
    series: data
}

const config1 = mergeProps(config, { chart: { type: 'bar' } })
const config2 = mergeProps(config, { chart: { type: 'line' } })

export default function Chart(props) {
    const [config, setConfig] = createSignal(props.kind === 'bar' ? config1 : config2);

    function chart(element) {
        // Create a new chart every time the config changes
        createEffect(() => Highcharts.chart(element, config()))

        // Update the existing chart when the config changes
        // const chart = Highcharts.chart(element, config())
        // createEffect(() => chart.update(config()))
    }

    return <>
        <div>
            <button class="btn btn-sm" disabled={config() === config1} onClick={() => setConfig(config1)}>Bar chart</button>
            <button class="btn btn-sm ml-(--gap)" disabled={config() === config2} onClick={() => setConfig(config2)}>Line chart</button>
        </div>
        <div use:chart></div>
    </>
}
