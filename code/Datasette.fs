module Podnebnik.Datasette

open Thoth.Json
open Thoth.Fetch

module private Decode =

    let floatOptionDecoder: Decoder<float option> =
        // Datasette serves NULL as empty string (""), which we need to convert to Option
        // See https://github.com/simonw/sqlite-utils/issues/488
        Decode.oneOf
            [ Decode.float |> Decode.map (fun x -> Some x) // try to decode it as a float
              Decode.int |> Decode.map float |> Decode.map (fun x -> Some x) // try to decode it as an int and convert it to a float
              Decode.string // try to decode it as an empty string and return 0.0
              |> Decode.andThen (fun s ->
                  match s with
                  | "" -> Decode.succeed None
                  | _ -> Decode.fail "Invalid float format") ]

type private Data = (float option array) array

module private Data =

    let decoder =
        // Decode the data rows and remove the first column of each row which is a row index
        Decode.field
            "rows"
            (Decode.array (Decode.array Decode.floatOptionDecoder |> Decode.map (fun values -> values[1..])))

let loadData url =
    promise {
        let! data = Fetch.get (url, decoder = Data.decoder, caseStrategy = SnakeCase)
        return data
    }
