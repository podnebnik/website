---
title: Dvig morja v Sloveniji
date: git Last Modified
topics: dvig morja
summary: Consectetur consectetur do dolor amet ea et eiusmod enim proident proident officia adipisicing est do. Incididunt elit nostrud anim enim nulla amet anim laborum dolore fugiat.
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>

<script type="module">
    // import Lazy from '/code/lazy.jsx'
    // import { render } from 'solid-js/web'
    import SeaRise from '/code/searise/index.jsx'
    // // render(() => Lazy(() => Chart({kind: 'bar'})), document.getElementById('sea-rise'))
    SeaRise('searise')
</script>

<div>
    <div class="checkbox">
        <label><input id="radio1" onchange="checkboxChecked()" type="checkbox">Spoštovanje Pariškega sporazuma</label>
    </div>
    <div class="slidecontainer">
        <span id="yearLabel"></span>
        <input type="range" min="2020" max="2100" value="2050" class="form-range" id="yearSlider">
    </div>
    <img id="svg_graph" src="/assets/pages/searise/graph.svg">
</div>

<div class="chart h-80" id="searise"></div>
