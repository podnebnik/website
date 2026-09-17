---
applyTo:
  - "code/**/*.{ts,tsx,js,jsx,mjs,fs}"
  - "styles/**/*.css"
  - "pages/**/*.{md,html}"
  - "eleventy.config.mjs"
  - "assets/**"
description: "Use when optimizing Core Web Vitals, chart rendering, images, CSS, Solid components, Eleventy output, or asset loading for Podnebnik."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/performance-optimization.instructions.md -->

# Performance Standards

Apply the repository-wide guidance from `../copilot-instructions.md` to all performance-sensitive work.

## Site Performance Priorities

- Optimize for Core Web Vitals: fast largest contentful paint, responsive interactions, and stable layout.
- Keep initial content useful without requiring heavy chart JavaScript to execute first.
- Use the existing lazy visualization wrapper for below-fold charts and maps unless immediate rendering is part of the user experience.
- Reserve layout space for images, charts, maps, and embeds to prevent content shifts.

## Assets and Images

- Prefer the existing Eleventy image shortcode for responsive generated image output.
- Set accurate alt text and dimensions for meaningful images. Decorative assets should not create noise for assistive technology.
- Keep image processing changes compatible with local development mode and CI, including the `ELEVENTY_DISABLE_IMG` behavior.
- Avoid large unoptimized assets in first-viewport content.

## JavaScript and Rendering

- Keep visualization bundles focused. Avoid broad imports when a direct import is available.
- Move expensive transformations out of render hot paths when they can be precomputed, memoized, cached, or handled at build time.
- Avoid synchronous work in event handlers that can block interactions.
- Clean up event listeners, timers, observers, and chart/map instances when components unmount.

## CSS and Layout

- Use stable layout constraints for charts, maps, grids, and repeated UI elements.
- Animate compositor-friendly properties when motion is necessary, and respect reduced-motion preferences.
- Avoid fixed widths that break content reflow on narrow screens.
- Keep Tailwind and custom CSS consistent with the existing design instead of adding one-off styling systems.
