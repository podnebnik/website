---
applyTo: "**/*.{md,html,yml,yaml}"
description: "Use when writing or updating README files, docs, public pages, data package metadata, Markdown, Liquid templates, or GitHub configuration text."
---

<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/markdown-gfm.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/documentation-writer/SKILL.md -->

# Documentation and Content Standards

Apply the repository-wide guidance from `../copilot-instructions.md` to all documentation and content work.

## Audience and Language

- Match the language and tone of nearby files. Public website content is usually Slovenian; developer documentation is usually English.
- Keep public climate explanations accurate, plain, and tied to the data shown on the page.
- Keep developer documentation task-oriented: explain the goal, prerequisites, commands, expected outputs, and where related files live.

## Markdown and Liquid

- Use GitHub-flavored Markdown for developer docs and repository files.
- Use Liquid consistently for Eleventy page templates and shortcodes.
- Keep headings hierarchical and descriptive. Do not skip heading levels for visual styling.
- Use fenced code blocks with language identifiers in docs when examples are truly needed.
- Avoid raw HTML in Markdown unless the existing page pattern requires it or Eleventy/Liquid needs it.

## Data Package Metadata

- Keep dataset titles, descriptions, licenses, resource names, units, and schema fields synchronized with the actual CSV resources.
- Use clear field titles and units so generated Datasette metadata remains useful to readers.
- Do not invent source, license, or methodology details. Preserve uncertainty when the source material is incomplete.

## Change Discipline

- Update documentation when setup commands, build behavior, content structure, data workflow, or public-facing behavior changes.
- Do not paste prompt instructions, private reasoning, or tool transcripts into documentation.
- Prefer linking to existing repository docs over duplicating long explanations across files.
