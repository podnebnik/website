---
name: setup-component
description: "Use when creating a new Solid visualization, reusable UI component, page-embedded widget, Fable example, or frontend module for Podnebnik."
argument-hint: "component or visualization name, target page, data source"
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/react-container-presentation-component/SKILL.md -->

# Setup Component

Create frontend components and visualization modules that fit Podnebnik's Eleventy, Solid, TypeScript, Fable, and data-package structure.

Ask for the component purpose, target page or route, data source, and expected interaction model if not provided.

## Requirements

- Use existing design, folder, and import conventions.
- Prefer TypeScript and Solid for new interactive browser modules unless nearby code clearly uses JavaScript or Fable.
- Keep rendering, data fetching, and transformation responsibilities easy to follow.
- Reuse shared types from `code/types/` when available.
- Prefer existing UI primitives under `code/components/` before creating new ones.
- Preserve accessibility, responsive layout, and performance guidance from `.github/instructions/`.

## Procedure

1. Inspect nearby examples in `code/`, `code/components/`, `code/examples/`, and the target `pages/` entry.
2. Choose the owner folder: feature visualization under `code/<feature>/`, reusable UI under `code/components/`, shared helpers under `code/utils` or the relevant feature folder.
3. Decide whether data should come from local `data/` files, generated page data, or the Datasette API.
4. Implement the smallest complete component/module that matches the existing style.
5. Use the lazy-render wrapper for below-fold visualizations unless immediate rendering is required.
6. Update page markup, documentation, or types only when the new component changes those contracts.
7. Validate with `yarn typecheck` and `yarn build` when the change touches TypeScript, JavaScript, pages, styles, or Eleventy configuration.

## Output

- List created or changed files.
- Explain where rendering, data loading, and transformation responsibilities live.
- State the validation commands run and any remaining gaps.
