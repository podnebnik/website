import Highcharts from 'highcharts'
import { createSignal } from "solid-js";
import { customElement } from 'solid-element';

const config1 = {
    chart: {
        type: 'bar'
    },
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

const config2 = {
    chart: {
        type: 'line'
    },
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

customElement("my-chart", { default: 1 }, (props, { element }) => {
    const [config, setConfig] = createSignal(props.default === 1 ? config1 : config2);

    const container = <div></div>;

    Highcharts.chart(container, config());

    return <>
        <button disabled={config() === config1} onClick={() => {setConfig(config1) ; Highcharts.chart(container, config())}}>Chart 1</button>
        <button disabled={config() === config2} onClick={() => {setConfig(config2) ; Highcharts.chart(container, config())}}>Chart 2</button>
        {container}
    </>
})
