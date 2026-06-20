---
name: debug-issue
description: "Use when diagnosing and fixing failing builds, broken pages, visualization errors, data import failures, TypeScript errors, or GitHub Actions failures in Podnebnik."
argument-hint: "error message, failing command, page, workflow, or bug description"
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/agents/debug.agent.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/diagnose/SKILL.md -->

# Debug Issue

Diagnose a bug before changing code, then fix the root cause with focused edits.

Ask for the failing command, page URL, workflow run, stack trace, or reproduction steps if none are provided.

## Requirements

- Reproduce or narrow the failure before editing.
- Form a concrete hypothesis and choose the cheapest check that can disprove it.
- Fix the root cause, not only the visible symptom.
- Keep changes scoped to the failing behavior.
- Add or identify a regression check when feasible.

## Procedure

1. Capture the expected behavior, actual behavior, environment, and failing command or page.
2. Reproduce with the smallest command or page path available.
3. Inspect nearby code, configuration, data, and recent changes relevant to the failure.
4. Test one hypothesis at a time with targeted instrumentation or commands.
5. Apply the minimal fix that addresses the confirmed root cause.
6. Run the original reproduction and relevant regression checks.
7. Summarize the cause, fix, and validation.

## Common Checks

- Static site or visualization: `yarn typecheck`, `yarn build`, and the affected page/component path.
- Data import or validation: Frictionless validation, `uv run --group=build invoke validate`, and Datasette import tasks.
- Fable/.NET: SDK version from `global.json`, Fable compilation, and generated output ownership.
- GitHub Actions: permissions, pinned actions, checkout behavior, runtime versions, and path filters.
