@.github/copilot-instructions.md

# Repository Agent Instructions

The imported `.github/copilot-instructions.md` file is the canonical repository guidance for all agents working in this workspace.

Reusable project skills live in `.agents/skills/` — the canonical, tool-neutral location read by GitHub Copilot and Codex. `.claude/skills` is a committed symlink to it, because Claude Code only discovers skills from `.claude/skills/`. Edit skills in `.agents/skills/` only.

On Windows, Git checks out that symlink as a plain text file unless `core.symlinks` is enabled (requires Developer Mode or an elevated shell). If Claude Code finds no project skills, run `git config core.symlinks true && git checkout -- .claude/skills`.
