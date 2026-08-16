# SSHOW Skills

Agent Skills for building on [SSHOW](https://s.show) — the all-in-one
platform for stories with design, animation, interactivity, and
prototyping. Skills are folders of instructions, scripts, and resources
that AI agents load on demand to do specialized work well; this repository
follows the open [Agent Skills](https://agentskills.io) standard, so the
same skill works in Claude Code, OpenAI Codex, Gemini CLI, Cursor, GitHub
Copilot, and any other agent that speaks the format.

# Skills

| Skill | Description |
|---|---|
| [sshow-plugin-builder](skills/sshow-plugin-builder) | Build SSHOW editor plugins — manifest, sandboxed HTML screen, `.sshowplugin` packaging, testing, and publishing to the catalog |

More are planned — next up: building SSHOW projects (documents) themselves.

# Use with your agent

**Claude Code**

```
/plugin marketplace add sshow-official/skills
/plugin install sshow-skills@sshow-skills
```

Or copy a skill folder into `~/.claude/skills/` (all projects) or
`.claude/skills/` (one project).

**OpenAI Codex · Gemini CLI · Cursor · GitHub Copilot**

These agents discover skills through `.agents/skills/`, which this
repository provides (as a symlink to `skills/`) — cloning the repo into
your workspace is enough. To install into another project or your user
scope, the cross-agent installer also works:

```
npx skills add sshow-official/skills
```

**Any other agent**

Everything is plain Markdown. Point your agent at
[AGENTS.md](AGENTS.md) — it explains how to index and load the skills.

> Windows note: this repo uses symlinks (`.agents/skills`,
> `.claude/skills`). Enable Developer Mode or `git config core.symlinks
> true` before cloning, or use `npx skills add` instead.

# Creating a skill

A skill is a folder with a `SKILL.md`: YAML frontmatter (`name` matching
the folder, a `description` that says what it does *and when to use it*),
then Markdown instructions. Keep the body lean and push detail into
`references/` files loaded on demand. Start from
[template/SKILL.md](template/SKILL.md).

```yaml
---
name: my-skill
description: Does X for Y files. Use when the user asks for X or mentions Y.
---
```
