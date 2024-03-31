---
title: Temperatura in klimatski pasovi
date: git Last Modified
published: 1. januar 2024
topics: temperatura
authors:
 - Žiga Zaplotnik
 - Zarja Muršič
 - Tadej Novak
 - Matic Pikovnik
summary: TODO
---

## Temperatura v Sloveniji v zadnjih 60 letih

<div class="chart" id="heatmap-slovenia">
    <script type="module">
        import Lazy from '/code/lazy.jsx';
        import { render } from 'solid-js/web';
        import { TemperatureSloveniaHeatMap } from '/code/temperatura/heatmaps.jsx';
        render(() => Lazy(() => TemperatureSloveniaHeatMap()), document.getElementById('heatmap-slovenia'));
    </script>
</div>

## Temperatura v Evropi v zadnjih 60 letih

<div class="chart" id="heatmap-europe">
    <script type="module">
        import Lazy from '/code/lazy.jsx';
        import { render } from 'solid-js/web';
        import { TemperatureEuropeHeatMap } from '/code/temperatura/heatmaps.jsx';
        render(() => Lazy(() => TemperatureEuropeHeatMap()), document.getElementById('heatmap-europe'));
    </script>
</div>
