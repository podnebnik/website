---
name: refactor-code
description: "Use when safely refactoring Podnebnik code, visualizations, scripts, data helpers, or build configuration without changing behavior."
argument-hint: "file, module, or behavior-preserving refactor goal"
---

<!-- Based on: https://github.com/github/awesome-copilot/blob/main/skills/refactor/SKILL.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/refactor-plan/SKILL.md -->

# Refactor Code

Improve maintainability while preserving existing behavior.

Ask for the target module and intended improvement if not provided.

## Requirements

- Preserve behavior. Do not combine refactors with unrelated features.
- Read nearby code before changing structure.
- Prefer small steps and verify after meaningful changes.
- Keep public page behavior, data contracts, exported types, and visualization APIs stable unless the user explicitly asks for a breaking change.
- Do not edit generated outputs owned by Fable, Eleventy, builds, or SQLite import tasks.

## Procedure

1. Identify the current responsibility boundaries and callers.
2. Check whether tests or validation commands already protect the behavior.
3. If the refactor is multi-file or risky, produce a short plan before editing.
4. Make the smallest structure change that improves clarity, type safety, duplication, or ownership.
5. Update tests, docs, or types only where the refactor changes a supported contract.
6. Run focused verification, then broader verification if the change touches shared paths.

## Output

- State what behavior was preserved.
- List files changed and verification run.
- Note any risk that remains uncovered by tests.
