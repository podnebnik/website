import './Leaflet.TileLayer.GL'

import svgGraphData from '/assets/objave/dvig-morja/graph.svg'

const fragmentShader = `
void main(void) {
    highp vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));

    // Height is represented in TENTHS of a meter
    highp float height = (
        texelColour.r * 255.0 * 256.0 * 256.0 +
        texelColour.g * 255.0 * 256.0 +
        texelColour.b * 255.0 )
    -1000.0;

    if (height > -900.0 && height < uTargetHeight) {
        if(uTargetHeight > 0.0){
            gl_FragColor = vec4(0,0.2+ height/uTargetHeight, 1, 0.5);
        }else{
            gl_FragColor = vec4(0,0, 1, 0.5);
        }
    } else {
        // Over ground but somewhat close to sea level, yellow
        gl_FragColor = vec4(0, 0, 0, 0);
    }
}`

export default function SeaRise(container, svgGraph, parisAgreement, flooding) {

    const yearSelectionSlider = container.querySelector('.yearSelectionSlider')

    if (svgGraph != null) {
        svgGraph.data = svgGraphData
    }
    const map = L.map(container.querySelector('.map'), {
        center: [45.5449, 13.7269],
        zoom: 16,
        minZoom: 12,
        maxZoom: 18,
        zoomControl: false
    })

    L.control.zoom({
        zoomInTitle: 'Povečava',
        zoomOutTitle: 'Pomanjšava'
    }).addTo(map);

    map.addControl(new L.Control.Fullscreen({
        title: {
            'false': 'Celozaslonski način',
            'true': 'Izhod iz celozaslonskega načina'
        }
    }));

    var svgGraphMarker = document.createElementNS("http://www.w3.org/2000/svg", 'circle') // Create a path in SVG's namespace
    svgGraphMarker.setAttribute("r", "0")

    var yOf00 = 1
    var yOf10 = 1
    var xOf2020 = 1
    var xOf2100 = 1
    var path = null
    var elevationLayer = null

    function updatePath() {
        if (isSvgGraphLoaded()) {
            path = parisAgreement ? svgGraph.contentDocument.getElementById('line2d_34') : svgGraph.contentDocument.getElementById('line2d_32')
            svgGraphMarker.setAttribute("style", parisAgreement ? "fill: #4682b4" : "fill: #ff4500")
        }
    }

    function calcLevel() {
        if (isSvgGraphLoaded()) {
            return (flooding ? 120 : 0) + (svgGraphMarker.getAttribute("cy") - yOf00) / (yOf10 - yOf00) * 100
        } else {
            return (flooding ? 120 : 0) + (parisAgreement ? seaLevelRiseData.RCP45[String(yearSelectionSlider.value)] : seaLevelRiseData.RCP85[String(yearSelectionSlider.value)]);
        }
    }

    function findY(path, x) {
        const pathLength = path.getTotalLength()
        var start = 0
        var end = pathLength
        var target = (start + end) / 2

        // Ensure that x is within the range of the path
        x = Math.max(x, path.getPointAtLength(0).x)
        x = Math.min(x, path.getPointAtLength(pathLength).x)

        // Walk along the path using binary search
        // to locate the point with the supplied x value
        while (target >= start && target <= pathLength) {
            var pos = path.getPointAtLength(target)

            // use a threshold instead of strict equality
            // to handle javascript floating point precision
            if (Math.abs(pos.x - x) < 0.001) {
                return pos.y
            } else if (pos.x > x) {
                end = target
            } else {
                start = target
            }
            target = (start + end) / 2
        }
    }

    function isSvgGraphLoaded() {
        return svgGraph != null && svgGraph.contentDocument.getElementById('line2d_34') !== null
    }

    function updateUI() {
        if (isSvgGraphLoaded()) {
            svgGraphMarker.setAttribute("cx", xOf2020 + (xOf2100 - xOf2020) * ((yearSelectionSlider.value - 2020) / 80.0))
            svgGraphMarker.setAttribute("cy", findY(path.children[0], svgGraphMarker.getAttribute("cx")))
        }

        const levelValue = calcLevel()
        elevationLayer.setUniform('uTargetHeight', levelValue)
        elevationLayer.reRender()
        container.querySelector('.levelLabel').innerHTML = 'Dvig gladine: ' + levelValue.toFixed(2) + ' cm'
        container.querySelector('.yearLabel').innerHTML = 'Leto: ' + yearSelectionSlider.value
    }

    function init() {
        updatePath()

        if (isSvgGraphLoaded()) {
            yOf00 = svgGraph.contentDocument.getElementById('ytick_1').children[0].children[0].getPointAtLength(0).y
            yOf10 = svgGraph.contentDocument.getElementById('ytick_6').children[0].children[0].getPointAtLength(0).y
            xOf2020 = svgGraph.contentDocument.getElementById('xtick_4').children[0].children[0].getPointAtLength(0).x
            xOf2100 = svgGraph.contentDocument.getElementById('xtick_8').children[0].children[0].getPointAtLength(0).x
            path.appendChild(svgGraphMarker)
        }
        yearSelectionSlider.oninput = updateUI

        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            minZoom: 1,
            maxZoom: 18
        })
        osm.on('tileloadstart', function (e) {
            e.tile.classList.add("m-0", "sm:m-0");
        });
        osm.addTo(map)

        elevationLayer = L.tileLayer.gl({
            fragmentShader: fragmentShader,
            uniforms: { uTargetHeight: Number(0) },
            attribution: '<a href="https://www.arso.gov.si/">ARSO</a>, <a href="https://gitlab.com/IvanSanchez/Leaflet.TileLayer.GL">Leaflet.TileLayer.GL</a>',
            tileLayers: [L.tileLayer('https://davidupload.blob.core.windows.net/data/tiles/{z}/{x}/{y}.png', { tms: true })]
        })
        elevationLayer.addTo(map)

        const command = L.control({ position: 'topright' })
        command.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'command')
            div.innerHTML = '<div class="font-bold text-white bg-black p-2 levelLabel"></div>' +
                '<div class="font-bold text-white bg-black p-2 yearLabel"></div>';
            return div
        }
        command.addTo(map)

        updateUI()
    }

    if (svgGraph == null || isSvgGraphLoaded()) {
        init()
    } else {
        svgGraph.addEventListener('load', init);
    }
}

var seaLevelRiseData = {
    "RCP45": {
        "2020": 6.34,
        "2021": 6.48,
        "2022": 6.55,
        "2023": 6.84,
        "2024": 7.33,
        "2025": 7.20,
        "2026": 6.94,
        "2027": 7.13,
        "2028": 7.76,
        "2029": 8.19,
        "2030": 8.45,
        "2031": 8.62,
        "2032": 8.79,
        "2033": 8.99,
        "2034": 9.19,
        "2035": 9.58,
        "2036": 10.22,
        "2037": 10.92,
        "2038": 11.35,
        "2039": 11.72,
        "2040": 12.04,
        "2041": 12.72,
        "2042": 12.56,
        "2043": 12.29,
        "2044": 12.45,
        "2045": 12.63,
        "2046": 12.93,
        "2047": 13.71,
        "2048": 14.74,
        "2049": 15.28,
        "2050": 16.22,
        "2051": 17.32,
        "2052": 18.13,
        "2053": 19.44,
        "2054": 20.16,
        "2055": 21.24,
        "2056": 21.60,
        "2057": 22.38,
        "2058": 23.57,
        "2059": 24.42,
        "2060": 24.84,
        "2061": 25.49,
        "2062": 25.82,
        "2063": 25.80,
        "2064": 26.60,
        "2065": 27.03,
        "2066": 27.22,
        "2067": 27.71,
        "2068": 27.60,
        "2069": 28.03,
        "2070": 28.20,
        "2071": 29.26,
        "2072": 30.08,
        "2073": 30.77,
        "2074": 31.78,
        "2075": 33.03,
        "2076": 34.33,
        "2077": 35.64,
        "2078": 37.15,
        "2079": 37.70,
        "2080": 38.45,
        "2081": 38.97,
        "2082": 39.29,
        "2083": 39.87,
        "2084": 40.28,
        "2085": 41.13,
        "2086": 41.52,
        "2087": 42.83,
        "2088": 43.86,
        "2089": 44.48,
        "2090": 45.22,
        "2091": 45.23,
        "2092": 45.66,
        "2093": 46.26,
        "2094": 46.87,
        "2095": 47.41,
        "2096": 47.94,
        "2097": 48.48,
        "2098": 48.94,
        "2099": 49.70,
        "2100": 50.32
    },
    "RCP85": {
        "2020": 6.35,
        "2021": 6.40,
        "2022": 6.75,
        "2023": 6.97,
        "2024": 7.13,
        "2025": 7.86,
        "2026": 8.60,
        "2027": 9.48,
        "2028": 10.51,
        "2029": 11.36,
        "2030": 12.17,
        "2031": 13.00,
        "2032": 13.75,
        "2033": 15.03,
        "2034": 15.99,
        "2035": 16.58,
        "2036": 17.35,
        "2037": 17.43,
        "2038": 17.86,
        "2039": 18.47,
        "2040": 19.36,
        "2041": 20.03,
        "2042": 20.77,
        "2043": 21.11,
        "2044": 22.06,
        "2045": 22.87,
        "2046": 23.99,
        "2047": 25.05,
        "2048": 25.74,
        "2049": 26.43,
        "2050": 27.52,
        "2051": 28.10,
        "2052": 29.57,
        "2053": 30.81,
        "2054": 32.15,
        "2055": 33.38,
        "2056": 34.54,
        "2057": 35.52,
        "2058": 36.50,
        "2059": 37.65,
        "2060": 38.79,
        "2061": 39.74,
        "2062": 41.44,
        "2063": 43.15,
        "2064": 44.85,
        "2065": 46.55,
        "2066": 48.41,
        "2067": 49.47,
        "2068": 50.60,
        "2069": 51.43,
        "2070": 51.87,
        "2071": 52.81,
        "2072": 53.84,
        "2073": 54.78,
        "2074": 55.49,
        "2075": 56.77,
        "2076": 58.35,
        "2077": 60.30,
        "2078": 62.30,
        "2079": 64.23,
        "2080": 65.58,
        "2081": 66.92,
        "2082": 68.17,
        "2083": 69.55,
        "2084": 71.43,
        "2085": 73.25,
        "2086": 74.86,
        "2087": 75.60,
        "2088": 77.05,
        "2089": 78.92,
        "2090": 80.79,
        "2091": 82.93,
        "2092": 84.69,
        "2093": 86.33,
        "2094": 87.69,
        "2095": 89.46,
        "2096": 91.24,
        "2097": 93.29,
        "2098": 95.34,
        "2099": 96.75,
        "2100": 98.05
    }
}