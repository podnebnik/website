import feather from "feather-icons"
import "../styles/main.sass"

// Slide menu

let menuToggle = document.getElementById("menuToggle")
let mobileMenu = document.getElementById("mainMenu")

menuToggle.addEventListener('click', function () {
    mobileMenu.classList.toggle("is-active")
})

// Feather icons

feather.replace()

// Visualisations

import { electricityChart } from "../fable/Visualisations/ElectricityChart.fs.js"
import { emissionsChart } from "../fable/Visualisations/EmissionsChart.fs.js"

window.Visualisations = {
    electricityChart: electricityChart,
    emissionsChart: emissionsChart
}
