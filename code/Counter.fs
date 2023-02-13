module Counter

open Fable.Core

[<JSX.Component>]
let Counter () =
    let count, setCount = Solid.createSignal (0)

    JSX.html
        $"""
    <>
        <p>Count is {count ()}</p>
        <button class="btn" onclick={fun _ -> count () + 1 |> setCount}>
            Click me!
        </button>
    </>
    """
