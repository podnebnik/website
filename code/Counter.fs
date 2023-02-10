module Counter

open Fable.Core

[<JSX.Component>]
let Counter () =
    printfn "Evaluating function..."
    let count, setCount = Solid.createSignal (0)

    JSX.html
        $"""
    <>
        <p>Count is {let _ = printfn "Evaluating expression..." in count ()}</p>
        <button class="button" onclick={fun _ -> count () + 1 |> setCount}>
            Click me!
        </button>
    </>
    """
