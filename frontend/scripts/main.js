import "../styles/main.sass"

// Slide menu

let menuToggle = document.getElementById("menuToggle")
let mobileMenu = document.getElementById("mainMenu")

menuToggle.addEventListener('click', function () {
    mobileMenu.classList.toggle("is-active")
})


import { emissionsChart } from "./components/src/Components/EmissionsChart.fs"

window.Components = {
    emissionsChart: emissionsChart
}
