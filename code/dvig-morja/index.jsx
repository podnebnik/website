import './leaflet-hash'
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

export default function SeaRise(container) {

    const parisAgreementCheckbox = container.querySelector('.parisAgreementCheckbox')
    const yearSelectionSlider = document.querySelector('.yearSelectionSlider')
    const yearSelectionLabel = document.querySelector('.yearSelectionLabel')

    const svgGraph = document.querySelector('.svgGraph')
    svgGraph.data = svgGraphData

    const map = L.map(container.querySelector('.map'), {
        center: [45.5449, 13.7269],
        zoom: 16,
        minZoom: 12,
        maxZoom: 18,
        fullscreenControl: true
    })

    const hash = L.hash(map, [parisAgreementCheckbox.checked ? 1 : 0, yearSelectionSlider.value])

    var svgGraphMarker = document.createElementNS("http://www.w3.org/2000/svg", 'circle') // Create a path in SVG's namespace
    svgGraphMarker.setAttribute("r", "10")

    var yOf00 = 1
    var yOf10 = 1
    var xOf2020 = 1
    var xOf2100 = 1
    var path = null
    var elevationLayer = null

    function updatePath() {
        path = parisAgreementCheckbox.checked ? svgGraph.contentDocument.getElementById('line2d_34') : svgGraph.contentDocument.getElementById('line2d_32')
        svgGraphMarker.setAttribute("style", parisAgreementCheckbox.checked ? "fill: #4682b4" : "fill: #ff4500")
    }

    function calcLevel() {
        return 120 + (svgGraphMarker.getAttribute("cy") - yOf00) / (yOf10 - yOf00) * 100
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
        return svgGraph.contentDocument.getElementById('line2d_34') !== null
    }

    function updateUI() {
        if (!isSvgGraphLoaded()) return

        svgGraphMarker.setAttribute("cx", xOf2020 + (xOf2100 - xOf2020) * ((yearSelectionSlider.value - 2020) / 80.0))
        svgGraphMarker.setAttribute("cy", findY(path.children[0], svgGraphMarker.getAttribute("cx")))

        const levelValue = calcLevel()
        elevationLayer.setUniform('uTargetHeight', levelValue)
        elevationLayer.reRender()
        yearSelectionLabel.innerHTML = 'Leto: ' + yearSelectionSlider.value
        document.getElementById('levelLabel').innerHTML = 'Dvig gladine: ' + levelValue.toFixed(2) + ' cm'
        hash.setArr([parisAgreementCheckbox.checked ? 1 : 0, yearSelectionSlider.value])
    }

    function init() {
        updatePath()

        yOf00 = svgGraph.contentDocument.getElementById('ytick_1').children[0].children[0].getPointAtLength(0).y
        yOf10 = svgGraph.contentDocument.getElementById('ytick_6').children[0].children[0].getPointAtLength(0).y
        xOf2020 = svgGraph.contentDocument.getElementById('xtick_4').children[0].children[0].getPointAtLength(0).x
        xOf2100 = svgGraph.contentDocument.getElementById('xtick_8').children[0].children[0].getPointAtLength(0).x
        path.appendChild(svgGraphMarker)

        yearSelectionSlider.oninput = updateUI

        parisAgreementCheckbox.onchange = () => {
            updatePath()
            updateUI()
        }

        hash.OnParse = function () {
            if (hash.arr[0] === 1) {
                parisAgreementCheckbox.checked = true
            } else {
                parisAgreementCheckbox.checked = false
            }
            yearSelectionSlider.value = hash.arr[1]
            updateUI()
        }

        const osm = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '<a href="http://osm.org/copyright">OpenStreetMap</a>',
            minZoom: 1,
            maxZoom: 18
        })
        osm.addTo(map)

        elevationLayer = L.tileLayer.gl({
            fragmentShader: fragmentShader,
            uniforms: { uTargetHeight: Number(0) },
            attribution: '<a href="http://gis.arso.gov.si">ARSO</a>, <a href="https://gitlab.com/IvanSanchez/Leaflet.TileLayer.GL">Leaflet.TileLayer.GL</a>',
            tileLayers: [L.tileLayer('https://davidupload.blob.core.windows.net/data/tiles/{z}/{x}/{y}.png', { tms: true })]
        })
        elevationLayer.addTo(map)

        const command = L.control({ position: 'topright' })
        command.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'command')
            div.innerHTML = '<div class="font-bold text-white bg-black p-2" id="levelLabel"></div>'
            return div
        }
        command.addTo(map)

        updateUI()
    }

    if (isSvgGraphLoaded()) {
        init()
    } else {
        svgGraph.onload = init
    }
}
