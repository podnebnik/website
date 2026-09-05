---
applyTo:
  - "code/**/*.{ts,tsx,js,jsx,mjs,fs}"
  - "**/*.py"
  - ".github/workflows/*.{yml,yaml}"
  - "deployment/**"
  - "compose.yaml"
  - "pages/**/*.{md,html}"
  - "data/**/*.yaml"
description: "Use when changing code, data pipelines, workflows, Docker files, public content, or configuration with security, secrets, input validation, or supply-chain implications."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/security-and-owasp.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/github-actions-ci-cd-best-practices.instructions.md -->

# Security Standards

Apply the repository-wide guidance from `../copilot-instructions.md` to all security-sensitive work.

## Secure Defaults

- Treat external data, CSV contents, query parameters, API responses, and Liquid-rendered content as untrusted until validated or escaped.
- Avoid raw HTML injection and dynamic script construction. If rich content is necessary, validate its structure and accessibility.
- Keep secrets out of source files, logs, pages, generated metadata, Docker images, and workflow output.
- Use environment variables for runtime configuration and document required names without including values.

## Data and API Safety

- Validate Frictionless schemas when resource structure changes.
- Keep Datasette import assumptions explicit: CSV format, field names, units, and metadata should match the package descriptors.
- Avoid constructing shell commands, SQL, or file paths from untrusted input. Prefer structured APIs and allowlists.
- Bound expensive operations where possible, especially data imports, API calls, image processing, and chart data transformations.

## Frontend and Content Safety

- Preserve Eleventy and browser escaping unless there is a deliberate, reviewed need to render trusted HTML.
- Do not expose server-only environment values to client-side modules.
- Keep CORS, proxy, and local development changes scoped to the intended origins.
- For maps, charts, and external assets, avoid third-party requests that leak sensitive context unless the dependency is intentional and documented.

## Supply Chain and CI

- Use the existing package managers and lockfiles. Do not mix package managers.
- Review new dependencies for maintenance, size, license, and install scripts before adding them.
- Keep GitHub Actions permissions least-privilege and actions pinned to immutable SHAs with version comments, matching the existing workflows.
- Use `persist-credentials: false` for checkout unless a workflow explicitly needs to write back to the repository.
