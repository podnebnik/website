const path = require("path")
const fs = require("fs")
const yaml = require("js-yaml")
const Image = require("@11ty/eleventy-img")
const SolidPlugin = require('vite-plugin-solid')
const EleventyVitePlugin = require('@11ty/eleventy-plugin-vite')

async function imageShortcode(src, alt, sizes) {
    // If src is a relative path, resolve it relative to the current page.
    const imagePath = src.startsWith('./') ? path.join(path.dirname(this.page.inputPath), src) : src

    let metadata = await Image(imagePath, {
        outputDir: "dist/img/",
        widths: [800],
        formats: ["webp"]
    })

    let imageAttributes = {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
    }

    return Image.generateHTML(metadata, imageAttributes, {
        whitespaceMode: "inline"
    })
}

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(EleventyVitePlugin, {
        viteOptions: {
            plugins: [SolidPlugin()]
        }
    })

    eleventyConfig.addDataExtension("yaml", contents => yaml.load(contents));

    eleventyConfig.addPassthroughCopy('code')
    eleventyConfig.addPassthroughCopy('styles')
    eleventyConfig.addPassthroughCopy('assets')
    eleventyConfig.addPassthroughCopy('public')

    eleventyConfig.addAsyncShortcode("image", imageShortcode)

    return {
        dir: {
            input: 'pages',
            output: 'dist',
        },

        htmlTemplateEngine: 'liquid',
        markdownTemplateEngine: 'liquid',
    }
}
