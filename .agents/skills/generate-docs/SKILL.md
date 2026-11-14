---
name: generate-docs
description: "Use when creating or updating Podnebnik developer docs, README sections, content authoring guidance, data package docs, or workflow documentation."
argument-hint: "doc type, audience, and topic"
---

<!-- Based on: https://github.com/github/awesome-copilot/blob/main/skills/documentation-writer/SKILL.md -->

# Generate Docs

Create clear documentation for the repository, website content, data packages, and development workflows.

Ask for the document type, audience, and scope if not provided.

## Requirements

- Match the language and tone of nearby documentation.
- Use developer docs for setup, reference, and maintenance guidance; use public content pages for reader-facing climate narratives.
- Keep instructions accurate to existing commands and files.
- Do not include private reasoning, prompt text, terminal transcripts, or invented facts.
- Prefer concise links to existing repository docs over duplicated long explanations.

## Procedure

1. Determine whether the document is a tutorial, how-to guide, reference, or explanation.
2. Inspect nearby docs and relevant code/data files.
3. Draft the smallest useful structure for the audience and task.
4. Write or update the target Markdown, Liquid, YAML, or HTML content.
5. Validate links, commands, headings, and language consistency.
6. Run build or data validation when documentation is embedded in the generated site or data package metadata.

## Output

- List changed files.
- State the target audience and document type.
- Note validation performed and any assumptions.
