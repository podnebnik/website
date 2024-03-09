module Chart

open Fable.Core
open Fable.Core.JsInterop

let url = "https://stage-data.podnebnik.org/emissions/historical_emissions.json"

open Podnebnik.Datasette

[<ImportDefault("highcharts")>]
let private highcharts: obj = jsNative

let config (data: SolidResource<option<float> array array>) =
    {| title = {| text = "Emisije" |}
       chart = {| ``type`` = "line" |}
       xAxis = {| title = {| text = "Leto" |} |}
       yAxis = {| title = {| text = "Tone" |} |}
       series = data.latest |}

[<JSX.Component>]
let Chart () =

    let (data, _) = Solid.createResource (fun () -> loadData url)

    let chart element =
        Solid.createEffect (fun () -> highcharts?chart (element, config data))

    JSX.html
        $"""
    <>
        <Switch>
            <Match when={data?loading}>Loading...</Match>
            <Match when={data}>
                <div use:chart></div>
            </Match>
        </Switch>
    </>
    """
