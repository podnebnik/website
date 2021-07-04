from django.db import models

from wagtail.core import blocks
from wagtail.core.models import Page
from wagtail.core.fields import RichTextField, StreamField
from wagtail.admin.edit_handlers import StreamFieldPanel, FieldPanel, MultiFieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.embeds.blocks import EmbedBlock
from wagtail.contrib.table_block.blocks import TableBlock
from wagtail.images.blocks import ImageChooserBlock

import podnebnik.visualisations


ALIGNMENT_CHOICES = [
    ("left", "Left"),
    ("right", "Right"),
    ("center", "Center"),
]


# -----------------------------------------------------------------------------
# Blocks
class ImageBlock(blocks.StructBlock):

    image = ImageChooserBlock()
    caption = blocks.CharBlock(required=False)
    alignment = blocks.ChoiceBlock(choices=ALIGNMENT_CHOICES, required=False)

    class Meta:
        icon = "image"
        template = "website/blocks/image.html"


class VisualisationBlock(blocks.StructBlock):

    visualisation = blocks.ChoiceBlock(choices=podnebnik.visualisations.VISUALISATIONS)

    class Meta:
        icon = "image"


class MixedContentBlock(blocks.StreamBlock):

    text = blocks.RichTextBlock(features=['h2', 'h3', 'h4', 'bold', 'italic', 'ol', 'ul', 'blockquote', 'hr', 'link', 'document-link', 'image'])
    visualisation = VisualisationBlock()
    image = ImageBlock()
    video = EmbedBlock()
    table = TableBlock()
    references = blocks.RichTextBlock()
    raw_html = blocks.RawHTMLBlock(help_text="Use only when all else fails")

    class Meta:
        template = "website/blocks/mixed-content.html"


# -----------------------------------------------------------------------------
# Pages

class HomePage(Page):

    lead = RichTextField()

    template = "website/pages/home.html"

    content_panels = Page.content_panels + [
        FieldPanel("lead"),
    ]

    def get_context(self, request):
        context = super().get_context(request)

        context["articles"] = ArticlePage.objects.live()
        return context


class ArticlePage(Page):

    lead = RichTextField(null=True, blank=True)

    body = StreamField(MixedContentBlock(null=True, blank=True))

    main_image = models.ForeignKey(
        "wagtailimages.Image",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )

    blurb = RichTextField()

    template = "website/pages/article.html"

    content_panels = Page.content_panels + [
        FieldPanel("lead"),
        StreamFieldPanel("body"),
        MultiFieldPanel([
            FieldPanel("blurb"),
            ImageChooserPanel("main_image"),
        ], heading="Promote on homepages"),
    ]

    def get_context(self, request):
        context = super().get_context(request)

        context["visualisations_data"] = podnebnik.visualisations.get_visualisations_data(set([el.value["visualisation"] for el in self.body if el.block_type == "visualisation"]))
        context["visualisations"] = [{'id': i, 'name': el.value["visualisation"]} for (i, el) in enumerate(self.body) if el.block_type == "visualisation"]

        return context


class GeneralPage(Page):

    body = StreamField(MixedContentBlock())

    template = "website/pages/general.html"

    content_panels = Page.content_panels + [
        StreamFieldPanel("body"),
    ]
