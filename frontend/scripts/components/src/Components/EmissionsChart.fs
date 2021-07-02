module EmissionsChart

open Feliz
open Browser.Dom
open Fable.SimpleJson

open Utils

type DataPoint = {
    Year : int
    Total : float
    Transportation : float
    Energy : float
    Industrial : float
    IndustrialFuels : float
    HouseholdFuels : float
    Agriculture : float
    Waste : float
    Other : float
}

type Metric = {
    Name : string
    Color : string
    Selector : DataPoint -> float
}

let metrics = [|
    { Name = "Other" ; Color = "" ; Selector = fun dp -> dp.Other }
    { Name = "Waste" ; Color = "" ; Selector = fun dp -> dp.Waste }
    { Name = "Industrial" ; Color = "" ; Selector = fun dp -> dp.Industrial }
    { Name = "Agriculture" ; Color = "" ; Selector = fun dp -> dp.Agriculture }
    { Name = "Household fuels" ; Color = "" ; Selector = fun dp -> dp.HouseholdFuels }
    { Name = "Industrial fuels" ; Color = "" ; Selector = fun dp -> dp.IndustrialFuels }
    { Name = "Transportation" ; Color = "" ; Selector = fun dp -> dp.Transportation }
    { Name = "Energy" ; Color = "" ; Selector = fun dp -> dp.Energy }
|]

let emissionsChart elementId height emissionsDataId =

    let data =
        getDataFromScriptElement emissionsDataId
        |> Json.parseNativeAs<(int * float * float * float * float * float * float * float * float * float) array>
        |> Array.map (fun (year, total, transportation, energy, industrial, industrial_fuels, household_fuels, agriculture, waste, other) ->
            { Year = year
              Total = total
              Transportation = transportation
              Energy = energy
              Industrial = industrial
              IndustrialFuels = industrial_fuels
              HouseholdFuels = household_fuels
              Agriculture = agriculture
              Waste = waste
              Other = other
            } )

    let series =
        metrics
        |> Array.map (fun metric ->
            pojo
                {| name = metric.Name
                   data = data |> Array.map (fun dp -> metric.Selector dp)
                |})

    let columnChartOptions =
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

    let areaChartOptions =
        {| Highcharts.baseOptions with
            chart = pojo
                {| ``type`` = "area"
                   height = height
                |}
            title = null
            plotOptions = pojo
                {| area = pojo
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
        React.fragment [
            Highcharts.chart columnChartOptions
            Highcharts.chart areaChartOptions
        ]

    ReactDOM.render(content, document.getElementById elementId)
