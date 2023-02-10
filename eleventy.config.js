const Path = require('path')

const Image = require("@11ty/eleventy-img")
const SolidPlugin = require('vite-plugin-solid')
const EleventyVitePlugin = require('@11ty/eleventy-plugin-vite')

async function imageShortcode(src, alt, sizes) {
    // If `src` is a relative path, resolve it relative to the current page.
    const path = src.startsWith('./') ? Path.join(Path.dirname(this.page.inputPath), src) : src

    let metadata = await Image(path, {
        outputDir: "./dist/img/",
        widths: [800],
        formats: ["webp"]
    })

    let imageAttributes = {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
    }

    // You bet we throw an error on missing alt in `imageAttributes` (alt="" works okay)
    return Image.generateHTML(metadata, imageAttributes, {
        whitespaceMode: "inline"
    })
}

module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy('code')
    eleventyConfig.addPassthroughCopy('styles')

    eleventyConfig.addPlugin(EleventyVitePlugin, {
        viteOptions: {
            plugins: [SolidPlugin()]
        }
    })

    eleventyConfig.addAsyncShortcode("image", imageShortcode)

    return {
        dir: {
            input: 'pages',
            output: 'dist',
            layouts: '_layouts',
            includes: '_includes',
        },

        htmlTemplateEngine: 'liquid',
        markdownTemplateEngine: 'liquid',
    }
}
