---
description: "Use when reviewing pull requests, changed files, Copilot output, workflow changes, data package updates, visualizations, or refactors in Podnebnik."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/code-review-generic.instructions.md -->

# Code Review Standards

Apply the repository-wide guidance from `../copilot-instructions.md` when reviewing changes.

## Review Priorities

- Lead with bugs, data integrity risks, security issues, accessibility regressions, performance regressions, broken builds, and missing validation.
- Treat content, data, and code as connected. A change to one layer may require updates to pages, charts, metadata, tests, docs, or workflows.
- Distinguish blocking defects from suggestions. Do not bury correctness issues under style feedback.
- Keep comments specific, actionable, and grounded in the changed files.

## Project-Specific Checks

- Frontend: verify TypeScript strictness, Solid component behavior, chart/map lifecycle, accessible names, keyboard paths, and layout stability.
- Content: verify Liquid syntax, heading hierarchy, links, image alt text, and preservation of the existing public language and tone.
- Data: verify CSV schema alignment, units, licenses, resource names, metadata, and validation coverage.
- Build: verify Yarn/Corepack, .NET/Fable, Eleventy/Vite, and `uv` workflows remain consistent with CI.
- Deployment: verify Docker and GitHub Actions changes use least privilege, pinned actions, clear triggers, and no leaked secrets.

## Output Style

- Findings come first, ordered by severity.
- Include file paths and precise context for each finding.
- Include open questions only when they affect review confidence.
- Keep summaries brief and secondary to the findings.
