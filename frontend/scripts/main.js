import feather from "feather-icons"
import "../styles/main.sass"

// Language selector

let languageSelector = document.getElementById("language-selector")

languageSelector.addEventListener('click', function () {
    languageSelector.classList.toggle("is-active")
})

// Slide menu

let menuToggle = document.getElementById("menuToggle")
let mobileMenu = document.getElementById("mainMenu")

menuToggle.addEventListener('click', function () {
    mobileMenu.classList.toggle("is-active")
})

// Feather icons

feather.replace()

// Visualisations

import { emissionsChart } from "./components/src/Components/EmissionsChart.fs"

window.Components = {
    emissionsChart: emissionsChart
}
