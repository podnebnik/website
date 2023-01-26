[<RequireQualifiedAccessAttribute>]
module Highcharts

open Feliz
open Fable.Core.JsInterop

type private Highcharts =
    static member inline highcharts (highcharts : obj) = prop.custom ("highcharts", highcharts)

    static member inline constructorType (constructorType : string) = prop.custom ("constructorType", constructorType)

    static member inline options (options : obj) = prop.custom ("options", options)

    static member inline chart props = Interop.reactApi.createElement (import "default" "highcharts-react-official", createObj !!props)

let private highcharts : obj = importAll "highcharts"

let private highchartsHighstock : obj = importAll "highcharts/highstock"

let globalOptions = {|
    credits = {| enabled = false |}
    scrollbar = {| enabled = true |}
    rangeSelector =
        {| selected = 1
           buttonTheme = {| width = 50 |}
           buttons = [|
               {| ``type`` = "day"
                  count = 1
                  text = "Dan"
                  title = "Prikaži en dan"
               |}
               {| ``type`` = "week"
                  count = 1
                  text = "Teden"
                  title = "Prikaži en teden"
               |}
               {| ``type`` = "week"
                  count = 4
                  text = "Mesec"
                  title = "Prikaži en mesec"
               |}
               {| ``type`` = "year"
                  count = 1
                  text = "Leto"
                  title = "Prikaži eno leto"
               |}
               {| ``type`` = "all"
                  count = 1
                  text = "Vse"
                  title = "Prikaži vse"
               |}
            |]
        |}
    navigator =
        {| maskFill = "rgba(0, 0, 0, 0.07)"
           series = {| ``type`` = "line" |}
        |}
    lang =
        {| decimalPoint = ","
           thousandsSep = "."
           months = [| "Januar" ; "Februar" ; "Marec" ; "April" ; "Maj" ; "Junij" ; "Julij" ; "Avgust" ; "September" ; "Oktober" ; "November" ; "December" |]
           shortMonths = [| "Jan" ; "Feb" ; "Mar" ; "Apr" ; "Maj" ; "Jun" ; "Jul" ; "Avg" ; "Sep" ; "Okt" ; "Nov" ; "Dec" |]
           weekdays = [| "Nedelja" ; "Ponedeljek" ; "Torek" ; "Sreda" ; "Četrtek" ; "Petek" ; "Sobota" |]
           shortWeekdays = [| "Ned" ; "Pon" ; "Tor" ; "Sre" ; "Čet" ; "Pet" ; "Sob" |]
           rangeSelectorZoom = "Obdobje"
        |}
    |}

highcharts?setOptions(globalOptions)
highchartsHighstock?setOptions(globalOptions)

let baseOptions = {||}

let chart options =
    Highcharts.chart [
        Highcharts.options options
        Highcharts.highcharts highcharts
        Highcharts.constructorType "chart"
    ]

let stockChart options =
    Highcharts.chart [
        Highcharts.options options
        Highcharts.highcharts highchartsHighstock
        Highcharts.constructorType "stockChart"
    ]
