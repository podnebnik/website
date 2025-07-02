import path from "path";
import Image from "@11ty/eleventy-img";
import SolidPlugin from "vite-plugin-solid";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";

function monthToNumber(date) {
    return date.replace('januar', '1.')
        .replace('februar', '2.')
        .replace('marec', '3.')
        .replace('april', '4.')
        .replace('maj', '5.')
        .replace('junij', '6.')
        .replace('julij', '7.')
        .replace('avgust', '8.')
        .replace('september', '9.')
        .replace('oktober', '10.')
        .replace('november', '11.')
        .replace('december', '12.')
}

async function photoAuthorShortcode(author, link) {
    return `<span class="photo-author inline-flex items-center gap-1.5 not-italic" title="Avtor fotografije">
        <img src="/assets/icons/camera.svg" alt="Ikona fotoaparata" class="size-5 inline opacity-30">
        ${author}
    </span>`
}

async function articleAuthorsShortcode(authors) {
    if (typeof authors === 'undefined') {
        return
    }

    let authorsFormatted = ''
    if (authors.length == 1) {
        authorsFormatted = `avtor: <span class="author">${authors[0]}</span>`
    } else if (authors.length == 2) {
        authorsFormatted = `avtorja: <span class="author">${authors[0]}</span> in <span class="author">${authors[1]}</span>`
    } else {
        authorsFormatted = `avtorji: <span class="author">${authors.slice(0, -1).join('</span>, <span class="author">')}</span> in <span class="author">${authors.slice(-1)}</span>`
    }

    return `<span class="article-metadata not-italic not-prose" title="Avtorji">
        <img src="/assets/icons/authors.svg" alt="Avtorji">

        <span>${authorsFormatted}</span>
    </span>`
}

async function publishedShortcode(published, short) {
    if (typeof published === 'undefined') {
        return
    }

    if (short) {
        published = monthToNumber(published)
    }

    return `<span class="article-metadata not-italic not-prose" title="Objavljeno">
        <img src="/assets/icons/published.svg" alt="Objavljeno">
        ${published}
    </span>`
}

async function editedShortcode(edited, short) {
    let value
    if (short) {
        value = `${edited.getDate()}. ${edited.getMonth() + 1}. ${edited.getFullYear()}`
    } else {
        value = `zadnja sprememba: ${edited.getDate()}. ${edited.getMonth() + 1}. ${edited.getFullYear()} ob ${edited.getHours()}:${edited.getMinutes()}`
    }

    return `<span class="article-metadata not-italic not-prose" title="Urejeno">
        <img src="/assets/icons/edited.svg" alt="Urejeno">
        ${value}
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

export default function (eleventyConfig) {
    eleventyConfig.addPlugin(EleventyVitePlugin, {
        viteOptions: {
            plugins: [
                SolidPlugin()
            ]
        }
    })




    eleventyConfig.addPassthroughCopy('code')
    eleventyConfig.addPassthroughCopy('styles')
    eleventyConfig.addPassthroughCopy('assets')
    eleventyConfig.addPassthroughCopy('public')

    eleventyConfig.addAsyncShortcode("image", imageShortcode)
    eleventyConfig.addShortcode("photoAuthor", photoAuthorShortcode)
    eleventyConfig.addShortcode("articleAuthors", articleAuthorsShortcode)
    eleventyConfig.addShortcode("publishedAt", publishedShortcode)
    eleventyConfig.addShortcode("editedAt", editedShortcode)

    return {
        dir: {
            input: 'pages',
            output: 'dist',


        },
        htmlTemplateEngine: 'liquid',
        markdownTemplateEngine: 'liquid',
    }
}
