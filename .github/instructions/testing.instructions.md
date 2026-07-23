---
applyTo: "**/*.{test,spec}.{ts,tsx,js,jsx,py,fs}"
description: "Use when adding tests, validation checks, regression coverage, or verification commands for Podnebnik code, data, content, or workflows."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/qa-engineering-best-practices.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/javascript-typescript-jest/SKILL.md -->

# Testing and Validation Standards

Apply the repository-wide guidance from `../copilot-instructions.md` to all test and validation work.

## Test Strategy

- Prefer meaningful coverage over line-count targets. Cover critical data transformations, visualization state, accessibility-sensitive UI behavior, and previously failing cases.
- Keep tests deterministic. Avoid real network dependencies, time-sensitive waits, shared mutable state, and production data.
- Test behavior and contracts rather than implementation details. UI tests should use user-visible roles, labels, text, and stable test identifiers when needed.
- When no test runner exists for a changed area, use the existing validation commands and discuss the smallest appropriate test harness before adding one.

## Repository Verification

- For TypeScript and frontend changes, run `yarn typecheck` and the narrowest build command that exercises the affected area.
- For static site changes, run `yarn build` when the change affects pages, templates, styles, visualizations, assets, or build configuration.
- For data package changes, validate Frictionless descriptors and schemas before considering the change complete.
- For Docker or deployment changes, prefer targeted build or lint checks that match the changed file rather than broad unrelated workflow changes.

## Regression Coverage

- Reproduce bugs before fixing them, then add or identify a regression check that would fail on the old behavior.
- Include edge cases for empty data, missing optional metadata, malformed API responses, boundary dates, unusual units, and charts with sparse series.
- Keep test names descriptive enough to explain the behavior without reading the implementation.
- If a validation gap remains, record it clearly in the final report with the reason it was not automated.

## CI Expectations

- Keep GitHub Actions checks simple, targeted, and consistent with existing workflows.
- Make failures actionable by choosing commands that produce clear output and by avoiding hidden state or implicit external services.
- Archive or summarize relevant artifacts only when they help diagnose a failure.
