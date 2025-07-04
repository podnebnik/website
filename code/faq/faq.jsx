import { createSignal } from "solid-js";


import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";

export function Faq() {
    const [expandedItem, setExpandedItem] = createSignal(["item-1"]);

    return (
        <div class="not-prose">
            <section >Section</section>
            <Accordion value={expandedItem()} onChange={setExpandedItem} collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Title 1</AccordionTrigger>
                    <AccordionContent>
                        Lorem ipsum dolor sit amet consectetur adipisicing elit.
                        Optio, quod officia natus ipsum debitis libero fugiat accusamus veniam sint nobis.
                        Voluptate cumque at perspiciatis autem recusandae porro quasi eius soluta.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Title 2</AccordionTrigger>
                    <AccordionContent>
                        Lorem ipsum dolor, sit amet consectetur adipisicing elit. Delectus rem ipsam esse atque illum ipsum eveniet animi provident quibusdam, temporibus vitae quidem reiciendis fuga maiores at aliquid, quo numquam est!
                        <br />
                        Illum ad quam eaque voluptate quia voluptates rerum molestias voluptas at ea dicta, voluptatibus commodi est nostrum accusantium, officia provident recusandae sint saepe nisi? Illo sit quidem dolore ab animi.
                        Temporibus facilis quod quam consequatur harum, fugiat enim voluptas. Aspernatur facere excepturi dicta consequatur enim ullam necessitatibus beatae voluptatum perferendis cum. Ullam a laborum delectus iusto facere ipsum ad itaque?
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}