---
title: Temperatura in klimatski pasovi
date: git Last Modified
topics: temperatura
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
