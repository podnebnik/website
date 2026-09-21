---
applyTo: "code/**/*.{ts,tsx,js,jsx,mjs},*.config.mjs,*.config.js,eleventy.config.mjs,dev-proxy.mjs"
description: "Use when writing TypeScript, JavaScript, Solid components, Eleventy configuration, Vite setup, or visualization code for Podnebnik."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/nodejs-javascript-vitest.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/csharp.instructions.md -->

# TypeScript, Solid, and Eleventy Standards

Apply the repository-wide guidance from `../copilot-instructions.md` to all frontend and visualization code.

## General Guidelines

- Follow the existing ES module style and repository folder structure.
- Prefer clear functions and small modules over broad utility files.
- Use existing dependencies before proposing a new package. If a new dependency is needed, explain why the current stack is insufficient.
- Keep code self-explanatory. Add comments only for non-obvious domain rules, performance trade-offs, or build/runtime constraints.

## TypeScript and JavaScript

- Use TypeScript for new shared utilities, API/data models, and Solid components unless the surrounding feature is intentionally JavaScript-only.
- Preserve the gradual migration approach: existing `.js` and `.jsx` files can remain JavaScript unless the task requires conversion.
- Keep strict TypeScript happy for new code. Avoid `any` unless the value truly crosses an unknown external boundary and is narrowed before use.
- Import shared API and data types from `code/types/` when they already model the concept. Add shared types only when they will be reused across modules.

## Solid Components

- Treat Solid components as rendering surfaces with explicit props and minimal side effects.
- Keep data loading, query setup, and visualization rendering responsibilities separated when that makes the component easier to test and reason about.
- Use accessible HTML elements first, then ARIA only when native semantics cannot express the interaction.
- Ensure chart and map components expose useful text alternatives, labels, legends, or nearby summaries for readers who cannot use the visual rendering.

## Eleventy and Content Integration

- Keep Eleventy configuration focused on build behavior, shortcodes, passthrough assets, and Vite integration.
- Preserve Liquid as the preferred template language for content pages.
- Avoid embedding large custom logic directly in Markdown or HTML pages. Move reusable rendering logic into `code/` or an Eleventy shortcode.
- Prefer the existing lazy rendering pattern for below-fold visualizations so content can load before heavy charts execute.

## Fable and .NET Interop

- Keep Fable examples and generated JavaScript outputs aligned with `code/Components.fsproj`.
- Do not edit compiled Fable output when the source F# file is the real owner of the behavior.
- Use the .NET 10 SDK expectations from `global.json` and existing CI workflows.
