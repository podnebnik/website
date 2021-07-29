module ElectricityChart

open Feliz
open Browser.Dom
open Fable.SimpleJson

open Utils

type DataPoint = {
    Year : int
    Total : float
    EnergetikaLjubljana : float option
    EnergetikaMaribor : float option
    Teb : float option
    Test : float option
    Tetol : float option
    Tet : float option
    EnergetikaCelje : float option
    Enos : float option
    MEnergetika : float option
    PetrolEnergetika : float option
    Other : float option
    TotalIndividual : float option
    Residual : float option
    Target2030 : float option
}

type Metric = {
    Name : string
    Color : string
    Selector : DataPoint -> float option
}

let metrics = [|
    { Name = "Energetika Ljubljana" ; Color = "" ; Selector = fun dp -> dp.EnergetikaLjubljana }
    { Name = "Energetika Maribor" ; Color = "" ; Selector = fun dp -> dp.EnergetikaMaribor }
    { Name = "Teb" ; Color = "" ; Selector = fun dp -> dp.Teb }
    { Name = "Test" ; Color = "" ; Selector = fun dp -> dp.Test }
    { Name = "Tetol" ; Color = "" ; Selector = fun dp -> dp.Tetol }
    { Name = "Tet" ; Color = "" ; Selector = fun dp -> dp.Tet }
    { Name = "Energetika Celje" ; Color = "" ; Selector = fun dp -> dp.EnergetikaCelje }
    { Name = "Enos" ; Color = "" ; Selector = fun dp -> dp.Enos }
    { Name = "M-Energetika" ; Color = "" ; Selector = fun dp -> dp.MEnergetika }
    { Name = "Petrol Energetika" ; Color = "" ; Selector = fun dp -> dp.PetrolEnergetika }
    { Name = "Other" ; Color = "" ; Selector = fun dp -> dp.Other }
    { Name = "Total Individual" ; Color = "" ; Selector = fun dp -> dp.TotalIndividual }
    { Name = "Residual" ; Color = "" ; Selector = fun dp -> dp.Residual }
    { Name = "Target 2030" ; Color = "" ; Selector = fun dp -> dp.Target2030 }
|]

let electricityChart elementId chartKind height dataId =

    let data =
        getDataFromScriptElement dataId
        |> Json.parseNativeAs<(int * float * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option ) array>
        |> Array.map (fun (year, total, energetika_ljubljana, energetika_maribor, teb, test, tetol, tet, energetika_celje, enos, m_energetika, petrol_energetika, other, total_individual, residual, target_2030) ->
            { Year = year
              Total = total
              Other = other
            } )

    let series =
        metrics
        |> Array.map (fun metric ->
            pojo
                {| name = metric.Name
                   data = data |> Array.map (fun dp -> metric.Selector dp)
                |})

    let chartOptions =
        {| Highcharts.baseOptions with
            chart = pojo
                {| ``type`` = "column"
                   height = height
                |}
            title = null
            plotOptions = pojo
                {| column = pojo
                    {| stacking = "normal" |}
                   series = pojo
                    {| marker = pojo
                        {| enabled = false
                        |}
                    |}
                |}
            xAxis = pojo
                {| categories = data |> Array.map (fun dp -> dp.Year)
                   tickmarkPlacement = "on"
                |}
            yAxis = pojo
                {| title = pojo
                    {| text = "Emisije [kt CO<sub>2</sub>]" ; useHTML = true |} |}
            series = series
        |}

    let content =
        match chartKind with
        | "columns" -> Highcharts.chart chartOptions
        | _ -> failwith (sprintf "Unknown chart kind: %s" chartKind)

    ReactDOM.render(content, document.getElementById elementId)
