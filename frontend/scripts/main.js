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

import { electricityChart } from "./fsharp/src/Visualisations/ElectricityChart.fs"
import { emissionsChart } from "./fsharp/src/Visualisations/EmissionsChart.fs"

window.Visualisations = {
    electricityChart: electricityChart,
    emissionsChart: emissionsChart
}
