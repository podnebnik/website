module ElectricityChart

open Feliz
open Browser.Dom
open Fable.SimpleJson

open Utils

type DataPoint =
    { Year: int
      EnergetikaLjubljana: float option
      EnergetikaMaribor: float option
      Teb: float option
      Test: float option
      Tetol: float option
      Tet: float option
      EnergetikaCelje: float option
      Enos: float option
      MEnergetika: float option
      PetrolEnergetika: float option
      Other: float option
      TotalIndividual: float option
      Residual: float option
      Total: float option
      Target2030: float option }

type Metric =
    { Name: string
      Color: string
      DataSelector: DataPoint -> float option }

let metrics =
    [| { Name = "Energetika Ljubljana"
         Color = ""
         DataSelector = fun dp -> dp.EnergetikaLjubljana }
       { Name = "Energetika Maribor"
         Color = ""
         DataSelector = fun dp -> dp.EnergetikaMaribor }
       { Name = "Teb"
         Color = ""
         DataSelector = fun dp -> dp.Teb }
       { Name = "Test"
         Color = ""
         DataSelector = fun dp -> dp.Test }
       { Name = "Tetol"
         Color = ""
         DataSelector = fun dp -> dp.Tetol }
       { Name = "Tet"
         Color = ""
         DataSelector = fun dp -> dp.Tet }
       { Name = "Energetika Celje"
         Color = ""
         DataSelector = fun dp -> dp.EnergetikaCelje }
       { Name = "Enos"
         Color = ""
         DataSelector = fun dp -> dp.Enos }
       { Name = "M-Energetika"
         Color = ""
         DataSelector = fun dp -> dp.MEnergetika }
       { Name = "Petrol Energetika"
         Color = ""
         DataSelector = fun dp -> dp.PetrolEnergetika }
       { Name = "Other"
         Color = ""
         DataSelector = fun dp -> dp.Other }
       { Name = "Total Individual"
         Color = ""
         DataSelector = fun dp -> dp.TotalIndividual }
       { Name = "Residual"
         Color = ""
         DataSelector = fun dp -> dp.Residual }
       { Name = "Total"
         Color = ""
         DataSelector = fun dp -> dp.Total }
       { Name = "Target 2030"
         Color = ""
         DataSelector = fun dp -> dp.Target2030 } |]

let electricityChart elementId chartKind height dataId =

    let data =
        getDataFromScriptElement dataId
        |> Json.parseNativeAs<(int * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option * float option) array>
        |> Array.map
            (fun (year,
                  total,
                  energetika_ljubljana,
                  energetika_maribor,
                  teb,
                  test,
                  tetol,
                  tet,
                  energetika_celje,
                  enos,
                  m_energetika,
                  petrol_energetika,
                  other,
                  total_individual,
                  residual,
                  target_2030) ->
                { Year = year
                  Total = total
                  EnergetikaLjubljana = energetika_ljubljana
                  EnergetikaMaribor = energetika_maribor
                  Teb = teb
                  Test = test
                  Tetol = tetol
                  Tet = tet
                  EnergetikaCelje = energetika_celje
                  Enos = enos
                  MEnergetika = m_energetika
                  PetrolEnergetika = petrol_energetika
                  Other = other
                  TotalIndividual = total_individual
                  Residual = residual
                  Target2030 = target_2030 })

    let series =
        metrics
        |> Array.map
            (fun metric ->
                {| name = metric.Name
                   data =
                       data
                       |> Array.map (fun dp -> metric.DataSelector dp |> valueOrNull) |})

    let chartOptions =
        {| Highcharts.baseOptions with
               chart =
                   pojo
                       {| ``type`` = "column"
                          height = height |}
               title = null
               plotOptions =
                   pojo
                       {| column = pojo {| stacking = "normal" |}
                          series = pojo {| marker = pojo {| enabled = false |} |} |}
               xAxis =
                   pojo
                       {| categories = data |> Array.map (fun dp -> dp.Year)
                          tickmarkPlacement = "on" |}
               yAxis =
                   pojo
                       {| title =
                              pojo
                                  {| text = "Emisije [kt CO<sub>2</sub>]"
                                     useHTML = true |} |}
               series = series |}

    let content =
        match chartKind with
        | "columns" -> Highcharts.chart chartOptions
        | _ -> failwith (sprintf "Unknown chart kind: %s" chartKind)

    ReactDOM.render (content, document.getElementById elementId)
