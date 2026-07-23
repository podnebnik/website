@.github/copilot-instructions.md

# Repository Agent Instructions

The imported `.github/copilot-instructions.md` file is the canonical repository guidance for all agents working in this workspace.

Reusable project skills live in `.agents/skills/` — this is the **canonical** location, shared across agent tools.

Claude Code only auto-discovers skills from `.claude/skills/`, so that directory holds a **copy** of `.agents/skills/`. Treat `.claude/skills/` as generated: edit skills only in `.agents/skills/`, then re-sync with `yarn sync-skills` (this also runs automatically on `yarn install` via `postinstall`).
