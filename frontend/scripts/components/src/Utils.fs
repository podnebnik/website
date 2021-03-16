module Utils

open Fable.Core
let inline pojo obj = JsInterop.toPlainJsObj obj

[<Emit """Array.prototype.slice.call($0)""">]
let poja (a: 'T[]) : obj = jsNative

type JsTimestamp = int64

[<Emit("$0.getTime()")>]
let jsTime (x: System.DateTime) : JsTimestamp = jsNative
