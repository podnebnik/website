---
name: write-tests
description: "Use when adding regression tests, validation checks, data quality checks, frontend verification, or CI coverage for Podnebnik changes."
argument-hint: "scope or bug/feature to cover"
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/javascript-typescript-jest/SKILL.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/qa-engineering-best-practices.instructions.md -->

# Write Tests

Add or identify the right verification for changes to Podnebnik's data, content, visualization code, and build workflows.

Ask for the behavior to verify and the acceptance criteria if not provided.

## Requirements

- Prefer existing validation commands before adding new test infrastructure.
- Do not introduce a new test runner or dependency without confirming the need and documenting the maintenance cost.
- Cover behavior, contracts, edge cases, and regressions rather than implementation details.
- Keep tests deterministic and free of production data, external network dependencies, or hardcoded local paths.

## Procedure

1. Identify the affected layer: frontend, Eleventy content, data package, Python import task, Fable module, Docker, or GitHub Actions.
2. Look for existing tests or validation scripts near that layer.
3. For bugs, reproduce the old failure before adding coverage.
4. Add the smallest useful check at the appropriate level.
5. Validate the changed layer with the repository commands from `.github/instructions/testing.instructions.md`.
6. Report any area that still lacks automated coverage and why.

## Output

- Summarize what behavior is covered.
- List changed files and commands run.
- State whether coverage is automated, manual, or still missing.
