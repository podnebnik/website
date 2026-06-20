# Podnebnik - Copilot Instructions

## Project Overview

Podnebnik is the source repository for podnebnik.org, a statically generated climate website that keeps public content, data packages, visualizations, and deployment definitions together. Treat the repository as one source of truth: changes to data, narrative pages, visualization code, and build/deployment behavior should stay consistent with each other.

## Tech Stack

- Static site: Eleventy 3, Liquid templates, Vite, Tailwind CSS, and global CSS in `styles/`.
- Frontend visualizations: TypeScript, JavaScript, Solid JS, Highcharts, and shared types under `code/types/`.
- Fable visualizations: F# compiled to JavaScript with .NET 10 and Fable.
- Data pipeline: Frictionless Data packages under `data/`, Python 3.12 managed by `uv`, SQLite databases under `var/sqlite/`, and Datasette for data browsing/API access.
- Package/runtime tooling: Yarn 4 via Corepack, Node 24 in CI, .NET 10, Docker/Compose for production-like local development, and GitHub Actions for build, data validation, Docker images, workflow linting, and Copilot setup.

## Conventions

- Naming: use descriptive names. Prefer camelCase for JavaScript/TypeScript variables and functions, PascalCase for Solid components, kebab-case for route/content folders, and existing dataset/resource names for data package artifacts.
- Structure: keep public content in `pages/`, reusable visualization code in `code/`, shared UI in `code/components/`, shared types in `code/types/`, data packages in `data/<package>/`, static assets in `assets/`, CSS in `styles/`, and deployment files in `deployment/`.
- TypeScript: use strict types for new `.ts` and `.tsx` work. Keep existing JavaScript working during gradual migration unless the task calls for conversion.
- Solid and visualization code: prefer small, focused components, explicit props, accessible markup, and the existing lazy-rendering pattern for below-fold visualizations.
- Content: preserve the page language and tone already used nearby. Public pages are usually Slovenian; developer documentation is usually English.
- Data: keep Frictionless metadata, CSV schemas, and Datasette import expectations aligned. Validate package descriptors after changing data files or schemas.
- Error handling: fail fast with actionable messages in scripts and tasks. Do not hide invalid data, failed imports, missing DOM elements, or failed network calls.
- Generated output: do not hand-edit `dist/`, `var/sqlite/`, `code/bin/`, `code/obj/`, `code/fable_modules/`, or other generated build artifacts.

## Workflow

- Install dependencies with `yarn install`; it also restores .NET tools through the existing postinstall script.
- Use `yarn typecheck` for TypeScript checks and `yarn build` for the static site build.
- Use `yarn start` for local Eleventy/Fable watch mode. For production-like behavior, use `ELEVENTY_EMULATE_PRODUCTION=1` when needed.
- Use `uv run --group=build invoke validate` or the repository's existing Frictionless validation workflow when changing data packages.
- Use Docker Compose from `compose.yaml` when validating the website plus Datasette stack together.
- Keep GitHub Actions secure by following the existing pattern of least-privilege permissions, pinned actions with version comments, and `persist-credentials: false` on checkout unless a workflow explicitly needs write access.
- For pull requests and reviews, lead with correctness, data integrity, accessibility, security, performance, and missing validation. Keep refactors scoped to the behavior under change.

## Specialized Guidance

- Language and frontend guidelines: `.github/instructions/typescript-solid-eleventy.instructions.md`
- Testing and validation: `.github/instructions/testing.instructions.md`
- Security: `.github/instructions/security.instructions.md`
- Documentation and content: `.github/instructions/documentation.instructions.md`
- Performance: `.github/instructions/performance.instructions.md`
- Code review: `.github/instructions/code-review.instructions.md`
