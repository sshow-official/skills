# SSHOW Agent Skills

This repository is a library of Agent Skills (https://agentskills.io) for
building on SSHOW (https://s.show). Each skill is a folder under `skills/`
containing a `SKILL.md` (YAML frontmatter `name` + `description`, then
Markdown instructions) plus optional `scripts/`, `references/`, and
`examples/`.

If your agent supports Agent Skills natively (Claude Code, Codex, Gemini
CLI, Cursor, Copilot, Windsurf, …) it already discovers these via
`.agents/skills/` or `.claude/skills/` — symlinks to `skills/`. Ignore the
rest of this file.

If your agent does NOT support Agent Skills:

1. List `skills/*/SKILL.md` and read each file's frontmatter `description`
   to build an index.
2. When a task matches a skill's description, read that skill's full
   SKILL.md before acting, and follow it.
3. Resolve relative paths inside a SKILL.md against that skill's folder.
4. Load only the skills the current task needs — never all at once.

## Skill index

- `skills/sshow-plugin-builder/SKILL.md` — Builds SSHOW editor plugins: a
  plugin.json manifest plus one self-contained HTML screen, packaged as a
  .sshowplugin zip. Use for creating, packaging, testing, or publishing
  SSHOW plugins.
