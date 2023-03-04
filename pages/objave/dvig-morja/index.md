---
title: Dvig morja v Sloveniji
date: git Last Modified
topics: dvig morja
summary: Consectetur consectetur do dolor amet ea et eiusmod enim proident proident officia adipisicing est do. Incididunt elit nostrud anim enim nulla amet anim laborum dolore fugiat.
---

<div id="seaRise">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="">
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/leaflet.fullscreen.css" integrity="sha512-Tbna5DrK+N26ZZczWjdHj7BHyU3vUAjA7JsGhIyTM/7jBiy4f4DbiScuLQxaxB51+Gh/+a+Z7AwQmh2FyafjLg==" crossorigin="">
    <script src="https://unpkg.com/leaflet-fullscreen@1.0.2/dist/Leaflet.fullscreen.min.js" integrity="sha512-N/rydaIg6KU3Pvy8M0RZTQoMBsgA3+oKZ5dWY3lvGoT7DeOyLI0rhNb12OGmu8zRixAOXJvs8QQ02zcbkjwx8g==" crossorigin=""></script>
    <script type="module">
        import SeaRise from '/code/dvig-morja/index.jsx'
        SeaRise(document.getElementById('seaRise'))
    </script>
    <label>
        <input class="parisAgreementCheckbox" type="checkbox"> Spoštovanje Pariškega sporazuma
    </label>
    <div>
        <span class="yearSelectionLabel"></span>
        <input class="yearSelectionSlider" type="range" min="2020" max="2100" value="2050">
    </div>
    <object class="svgGraph w-96" type="image/svg+xml"></object>
    <div class="chart map h-80"></div>
</div>
