import { createSignal, createEffect, onCleanup } from "solid-js";

export default function Lazy(element) {
    let observedElement
    const [isInView, setIsInView] = createSignal(false)

    function onIntersection(entries) {
        entries.forEach(observerEntry => {
            if (observerEntry.target === observedElement && observerEntry.isIntersecting) {
                setIsInView(true)
            }
        })
    }

    createEffect(() => {
        const observer = new IntersectionObserver(onIntersection, {})
        observer.observe(observedElement)
        onCleanup(() => observer.disconnect())
    })

    return <div ref={observedElement}>{isInView() ? element() : null}</div>
}
