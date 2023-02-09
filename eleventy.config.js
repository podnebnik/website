const SolidPlugin = require('vite-plugin-solid')
const EleventyVitePlugin = require('@11ty/eleventy-plugin-vite')

module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy('scripts')
    eleventyConfig.addPassthroughCopy('styles')

    eleventyConfig.addPlugin(EleventyVitePlugin, {
        viteOptions: {
            plugins: [SolidPlugin()]
        }
    })

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
