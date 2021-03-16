module Components

open Feliz
open Browser.Dom
open Fable.SimpleJson

open Utils

let private getDataFromElement elementId =
    document.getElementById(elementId).textContent
