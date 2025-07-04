import { Accordion as AccordionPrimitive } from "@kobalte/core/accordion"
import { cva, } from "class-variance-authority"
import { splitProps } from "solid-js"

import { cn } from "../../utils.mjs"


const accordionVariants = cva("w-full font-sans",
    {
        variants: {
            variant: {
                default: "",
                outline: "border border-border rounded-md",
            },

        },
        defaultVariants: {
            variant: "default",
        },
    }
)


export const Accordion = (props) => {
    const [local, others] = splitProps(props, ["class", "variant"])

    return (
        <AccordionPrimitive
            class={cn(accordionVariants({ variant: local.variant }), local.class)}
            {...others}
        />
    )
}

export const AccordionItem = (props) => {
    const [local, others] = splitProps(props, ["class"])

    return (
        <AccordionPrimitive.Item
            class={cn("border-b border-border", local.class)}
            {...others}
        />
    )
}

export const AccordionTrigger = (props) => {
    const [local, others] = splitProps(props, ["class", "children"])

    return (
        <AccordionPrimitive.Header class="flex">
            <AccordionPrimitive.Trigger
                class={cn(
                    "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left [&[data-expanded]>svg]:rotate-180",
                    local.class
                )}
                {...others}
            >
                {local.children}
                <ChevronDownIcon class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    )
}

export const AccordionContent = (props) => {
    const [local, others] = splitProps(props, ["class", "children"])

    return (
        <AccordionPrimitive.Content
            class="overflow-hidden text-sm data-expanded:animate-accordion-down data-closed:animate-accordion-up"
            {...others}
        >
            <div class={cn("pb-4 pt-0", local.class)}>
                {local.children}
            </div>
        </AccordionPrimitive.Content>
    )
}

// Simple ChevronDown icon component
const ChevronDownIcon = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class={props.class}
    >
        <path d="m6 9 6 6 6-6" />
    </svg>
)