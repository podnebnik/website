module Counter

open Fable.Core
open Elmish
open Elmish.Solid

type State = { Count: int }

type Message =
    | Increment
    | Decrement

let init () = { Count = 0 }, Cmd.none

let update (message: Message) (state: State) =
    match message with
    | Increment ->
        { state with
            Count = state.Count + 1 },
        Cmd.none
    | Decrement ->
        { state with
            Count = state.Count - 1 },
        Cmd.none

[<JSX.Component>]
let Counter () =
    let state, dispatch = Solid.createElmishStore (init, update)

    // The textColor value must be wrapped in a function because of the way the state works in SolidJS
    let textColor state =
        match state.Count with
        | x when x < 0 -> "text-red-600"
        | x when x > 0 -> "text-green-600"
        | _ -> ""

    JSX.html
        $"""
    <>
        <p>Count is <span class={sprintf $"font-bold text-xl {textColor state}"}>{state.Count}</span></p>
        <button class="btn" onclick={fun _ -> dispatch Increment}>
            Increment
        </button>
        <button class="btn ml-gap" onclick={fun _ -> dispatch Decrement}>
            Decrement
        </button>
    </>
    """
