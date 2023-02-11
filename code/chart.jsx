import Highcharts from 'highcharts'
import { createSignal, createEffect, mergeProps } from "solid-js";
import { customElement } from 'solid-element';

import data from './data'

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

import style from './Chart.sass?inline'

export function Chart(props) {
    const [config, setConfig] = createSignal(props.default === 1 ? config1 : config2);

    function chart(element) {
        // Create a new chart every time the config changes
        createEffect(() => Highcharts.chart(element, config()))

        // Update the existing chart when the config changes
        // const chart = Highcharts.chart(element, config())
        // createEffect(() => chart.update(config()))
    }

    return <>
        <style>{style}</style>
        <div>
            <button disabled={config() === config1} onClick={() => setConfig(config1)}>Chart 1</button>
            <button disabled={config() === config2} onClick={() => setConfig(config2)}>Chart 2</button>
        </div>
        <div use:chart></div>
    </>
}

customElement("my-chart", { default: 1 }, (props, { element }) => Chart(props))
