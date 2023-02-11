module Chart

open Fable.Core
open Fable.Core.JsInterop

let private data: obj = importDefault "./data"

let private config =
    {| title = {| text = "Fruit Consumption in F#" |}
       chart = {| ``type`` = "bar" |}
       xAxis = {| categories = [ "Apples", "Bananas", "Oranges" ] |}
       yAxis = {| title = {| text = "Fruit eaten" |} |}
       series = data |}

let private config1 =
    {| config with
        chart = {| config.chart with ``type`` = "bar" |} |}

let private config2 =
    {| config with
        chart =
            {| config.chart with
                ``type`` = "line" |} |}

[<ImportDefault("highcharts")>]
let private highcharts: obj = jsNative

type Foo = { Bar: string; Baz: string }

type private Kind =
    | Bar
    | Line

[<JSX.Component>]
let Chart (kind: string) =
    let defaultConfig =
        match kind with
        | "bar" -> config1
        | "line" -> config2
        | _ -> config1

    let config, setConfig = Solid.createSignal defaultConfig

    let chart element =
        Solid.createEffect (fun () -> highcharts?chart (element, config ()))

    JSX.html
        $"""
    <>
        <div>
            <button disabled={config () = config1} onClick={fun () -> setConfig (config1)}>Chart 1</button>
            <button disabled={config () = config2} onClick={fun () -> setConfig (config2)}>Chart 2</button>
        </div>
        <div use:chart></div>
    </>
    """
