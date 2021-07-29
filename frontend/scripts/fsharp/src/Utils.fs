module Utils

open Fable.Core
open Browser.Dom

let getDataFromScriptElement elementId =
    document.getElementById(elementId).textContent

let inline pojo obj = JsInterop.toPlainJsObj obj

[<Emit """Array.prototype.slice.call($0)""">]
let poja (a: 'T []) : obj = jsNative

type JsTimestamp = int64

[<Emit("$0.getTime()")>]
let jsTime (x: System.DateTime) : JsTimestamp = jsNative

let valueOrNull value =
    match value with
    | Some value -> value :> obj // cast to object to satisfy the typechecking of null below
    | None -> null
