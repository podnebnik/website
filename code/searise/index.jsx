import './leaflet-hash'
import './Leaflet.TileLayer.GL'

export default function SeaRise(containerId) {

    var map = L.map(containerId, {
        center: [45.5449, 13.7269],
        zoom: 16,
        minZoom: 12,
        maxZoom: 18
    });

    var radio1 = document.getElementById('radio1');
    var yearSlider = document.getElementById('yearSlider');

    var hash = L.hash(map, [radio1.checked ? 1 : 0, yearSlider.value]);

    hash.OnParse = function () {
        switch (hash.arr[0]) {
            case '1':
                radio1.checked = true;
                break;
            default:
                radio1.checked = false;
                break;
        }
        yearSlider.value = hash.arr[1];
        updateUI();
    };

    function updatePath() {
        path = radio1.checked ? svg.contentDocument.getElementById('line2d_34') : svg.contentDocument.getElementById('line2d_32');
        newElement.setAttribute("style", radio1.checked ? "fill: #4682b4;" : "fill: #ff4500;")
    }

    function checkboxChecked() {
        updatePath();
        updateUI();
    }

    var svg = document.getElementById('svg_graph');
    var isSvgLoaded = false;
    var newElement = document.createElementNS("http://www.w3.org/2000/svg", 'circle'); //Create a path in SVG's namespace
    newElement.setAttribute("r", "10");

    var yOf00 = 1;
    var yOf10 = 1;
    var xOf2020 = 1;
    var xOf2100 = 1;
    var path = null;

    var calcLevel = function () {
        return 120 + (newElement.getAttribute("cy") - yOf00) / (yOf10 - yOf00) * 100;
    }

    function findY(path, x) {
        var pathLength = path.getTotalLength()
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

    var updateUI = function () {
        if (!isSvgLoaded)
            return;

        newElement.setAttribute("cx", xOf2020 + (xOf2100 - xOf2020) * ((yearSlider.value - 2020) / 80.0));
        newElement.setAttribute("cy", findY(path.children[0], newElement.getAttribute("cx")));

        levelValue = calcLevel();
        elevationLayer.setUniform('uTargetHeight', levelValue);
        elevationLayer.reRender();
        document.getElementById('yearLabel').innerHTML = 'Leto: ' + yearSlider.value;
        document.getElementById('levelLabel').innerHTML = 'Dvig gladine: ' + levelValue.toFixed(2) + ' cm';
        hash.setArr([radio1.checked ? 1 : 0, yearSlider.value]);
    }

    svg.onload = function () {
        if (isSvgLoaded)
            return;
        isSvgLoaded = true;
        updatePath();
        yOf00 = svg.contentDocument.getElementById('ytick_1').children[0].children[0].getPointAtLength(0).y;
        yOf10 = svg.contentDocument.getElementById('ytick_6').children[0].children[0].getPointAtLength(0).y;
        xOf2020 = svg.contentDocument.getElementById('xtick_4').children[0].children[0].getPointAtLength(0).x;
        xOf2100 = svg.contentDocument.getElementById('xtick_8').children[0].children[0].getPointAtLength(0).x;
        path.appendChild(newElement);
        updateUI();
    };

    yearSlider.oninput = updateUI;

    var fragmentShader = `
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
}
`
    var osm = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', { attribution: '<a href="http://osm.org/copyright">OpenStreetMap</a>', minZoom: 1, maxZoom: 18 });

    var elevationLayer = L.tileLayer.gl({
        fragmentShader: fragmentShader,
        uniforms: {
            uTargetHeight: Number(0),
        },
        attribution: '<a href="http://gis.arso.gov.si">ARSO</a>, <a href="https://gitlab.com/IvanSanchez/Leaflet.TileLayer.GL">Leaflet.TileLayer.GL</a>',
        tileLayers: [L.tileLayer('https://davidupload.blob.core.windows.net/data/tiles/{z}/{x}/{y}.png', { tms: true })]
    });

    osm.addTo(map);
    elevationLayer.addTo(map);

    // var command = L.control({ position: 'topright' });
    // command.onAdd = function (map) {
    //     var div = L.DomUtil.create('div', 'command');

    //     div.innerHTML = '<h4 id="levelLabel"></h4>';
    //     return div;
    // };
    // command.addTo(map);

    // return <>
    //     <div>Sea rises</div>
    // </>
}
