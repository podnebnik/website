import { cva } from "class-variance-authority";
import { createMemo } from "solid-js";
import { cn } from "../utils.mjs";

/**
 * @typedef {import('class-variance-authority').VariantProps<typeof dot>} DotVariants
 */



// Define your variants using cva
const dot = cva("rounded-full", {
    variants: {
        color: {
            p00: "bg-p00",
            p05: "bg-p05",
            p20: "bg-p20",
            p40: "bg-p40",
            p60: "bg-p60",
            p80: "bg-p80",
            p95: "bg-p95",
            initial: "bg-transparent",
        },
        size: {
            default: "px-9",
        },
    },
    defaultVariants: {
        color: "initial",
        size: "default",
    },
});


/**
 * IsItHotDot component renders a colored dot based on the provided color prop.
 * It uses class-variance-authority (cva) to manage styles.
 *
 * @param {Object} props - The component props.
 * @param {DotVariants["color"]} props.color - The color variant for the dot.
 * @param {import('solid-js').JSX.HTMLAttributes<HTMLSpanElement>["class"]} [props.class] - Additional class names to apply to the dot.
 */
export function IsItHotDot(props) {
    // Create a reactive memo that tracks the color prop
    const classNames = createMemo(() => {
        const { color, class: className } = props;
        return cn(dot({ color }), className);
    });

    return <span class={classNames()}></span>;
}
