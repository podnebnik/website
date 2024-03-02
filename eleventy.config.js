const path = require("path")
const fs = require("fs")

const Image = require("@11ty/eleventy-img")
const SolidPlugin = require('vite-plugin-solid')
const EleventyVitePlugin = require('@11ty/eleventy-plugin-vite')

async function photoAuthorShortcode(author, link) {
    return `<span class="photo-author inline-flex items-center gap-1.5 not-italic" title="Avtor fotografije">
        <img src="/assets/icons/camera.svg" alt="Ikona fotoaparata" class="size-5 inline opacity-30">
        ${author}
    </span>`
}

async function imageShortcode(src, alt, sizes) {
    // If src is a relative path, resolve it relative to the current page.
    const imagePath = src.startsWith('./') ? path.join(path.dirname(this.page.inputPath), src) : src;
    // preserve directory structure
    const imageDir = imagePath.replace(/^pages\/(.*)\/.*$/, '$1');

    let metadata = await Image(imagePath, {
        outputDir: "dist/img/" + imageDir,
        urlPath: "/img/" + imageDir,
        widths: [920, 1840],
        formats: ["webp"],
        filenameFormat: function (id, src, width, format, options) {
            // preserve original file name
            const extension = path.extname(src);
            const name = path.basename(src, extension);

            return `${name}-${width}w.${format}`;
        }
    })

    let imageAttributes = {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
    }

    let lowRes = metadata.webp[0];

    // responsive/retina images
    return `<picture>
        ${Object.values(metadata).map(imageFormat => {
            return `  <source type="${imageFormat[0].sourceType}" srcset="${imageFormat.map(entry => entry.srcset).join(", ")}">`;
        }).join("\n")}
            <img
                src="${lowRes.url}"
                width="${lowRes.width}"
                height="${lowRes.height}"
                alt="${alt}"
                loading="lazy"
                decoding="async">
            </picture>`;
}

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(EleventyVitePlugin, {
        viteOptions: {
            plugins: [SolidPlugin()]
        }
    })

    eleventyConfig.addPassthroughCopy('code')
    eleventyConfig.addPassthroughCopy('styles')
    eleventyConfig.addPassthroughCopy('assets')
    eleventyConfig.addPassthroughCopy('public')

    eleventyConfig.addAsyncShortcode("image", imageShortcode)
    eleventyConfig.addShortcode("photoAuthor", photoAuthorShortcode)

    return {
        dir: {
            input: 'pages',
            output: 'dist',
        },

        htmlTemplateEngine: 'liquid',
        markdownTemplateEngine: 'liquid',
    }
}
