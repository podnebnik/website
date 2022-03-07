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
      Type: string
      DataSelector: DataPoint -> float option }

let metrics =
    [|
       { Name = "TE Šoštanj"
         Color = "#662506"
         Type = "column"
         DataSelector = fun dp -> dp.Test }
       { Name = "TE Trbovlje"
         Color = "#cc4c02"
         Type = "column"
         DataSelector = fun dp -> dp.Tet }
       { Name = "TE Brestanica"
         Color = "#993404"
         Type = "column"
         DataSelector = fun dp -> dp.Teb }
       { Name = "TE Toplarna Ljubljana"
         Color = "#ec7014"
         Type = "column"
         DataSelector = fun dp -> dp.Tetol }
       { Name = "Energetika Ljubljana"
         Color = "#3f007d"
         Type = "column"
         DataSelector = fun dp -> dp.EnergetikaLjubljana }
       { Name = "Energetika Maribor"
         Color = "#54278f"
         Type = "column"
         DataSelector = fun dp -> dp.EnergetikaMaribor }
       { Name = "Energetika Celje"
         Color = "#6a51a3"
         Type = "column"
         DataSelector = fun dp -> dp.EnergetikaCelje }
       { Name = "Petrol Energetika"
         Color = "#807dba"
         Type = "column"
         DataSelector = fun dp -> dp.PetrolEnergetika }
       { Name = "M-energetika"
         Color = "#9e9ac8"
         Type = "column"
         DataSelector = fun dp -> dp.MEnergetika }
       { Name = "ENOS"
         Color = "#bcbddc"
         Type = "column"
         DataSelector = fun dp -> dp.Enos }
       { Name = "Ostalo"
         Color = "#dadaeb"
         Type = "column"
         DataSelector = fun dp -> dp.Residual }  // TODO: temporary until renamed
       { Name = "Skupaj"
         Color = "#00441b"
         Type = "line"
         DataSelector = fun dp -> dp.Total }
       { Name = "Cilj 2030"
         Color = "#66c2a4"
         Type = "line"
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
                {| ``type`` = metric.Type
                   name = metric.Name
                   color = metric.Color
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
                                     useHTML = true |}
                          reversedStacks = false |}
               tooltip = pojo {| shared = true
                                 split = false
                                 valueDecimals = 1 |}
               series = series |}

    let content =
        match chartKind with
        | "columns" -> Highcharts.chart chartOptions
        | "totals" -> Highcharts.chart chartOptions
        | _ -> failwith (sprintf "Unknown chart kind: %s" chartKind)

    ReactDOM.render (content, document.getElementById elementId)
