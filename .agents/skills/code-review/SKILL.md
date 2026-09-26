---
name: code-review
description: "Use when reviewing Podnebnik changes for correctness, data integrity, security, accessibility, performance, testing, or workflow regressions."
argument-hint: "diff scope, branch, PR, or files to review"
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/code-review-generic.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/security-review/SKILL.md -->

# Code Review

Review changes with a bias toward concrete defects and missing validation.

Ask for the diff base, PR link, or file scope if not provided.

## Requirements

- Findings first, ordered by severity.
- Focus on changed lines and their immediate context, then broaden only when dependencies or data flow require it.
- Verify behavior against repository conventions and specialized instructions.
- Include precise file references, impact, and a suggested fix direction.
- Do not rewrite code during review unless the user explicitly asks for fixes.

## Review Checklist

- Build and type safety: `yarn typecheck`, `yarn build`, Fable/.NET assumptions, and generated output boundaries.
- Data integrity: Frictionless schema, CSV format, units, licensing, Datasette metadata, and import behavior.
- Frontend quality: Solid lifecycle, chart/map cleanup, accessible markup, responsive layout, and Core Web Vitals impact.
- Security: secrets, unsafe HTML, command/file path construction, CORS/proxy changes, dependency additions, and GitHub Actions permissions.
- Documentation: README, docs, public pages, and data package descriptors updated when behavior changes.

## Output

- Findings with severity and file references.
- Open questions or assumptions that affect confidence.
- Brief summary of what was reviewed and any validation gaps.
