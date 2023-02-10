import Highcharts from 'highcharts'
import { createSignal, createEffect, mergeProps } from "solid-js";
import { customElement } from 'solid-element';

const config = {
    title: {
        text: 'Fruit Consumption'
    },
    xAxis: {
        categories: ['Apples', 'Bananas', 'Oranges']
    },
    yAxis: {
        title: {
            text: 'Fruit eaten'
        }
    },
    series: [{
        name: 'Fred',
        data: [1, 0, 4]
    }, {
        name: 'Lydia',
        data: [5, 7, 3]
    }]
}

const config1 = mergeProps(config, { chart: { type: 'bar'}})
const config2 = mergeProps(config, { chart: { type: 'line'}})

import style from './Chart.sass?inline'

export function Chart(props) {
    const [config, setConfig] = createSignal(props.default === 1 ? config1 : config2);

    function chart(element) {
        createEffect(() => Highcharts.chart(element, config()))
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
