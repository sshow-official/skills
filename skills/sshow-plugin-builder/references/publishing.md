# Packaging, Testing, and Publishing

## Package (`.sshowplugin`)

A `.sshowplugin` is a plain zip of the plugin folder's files at the
archive root (no wrapping directory — a zip of the folder itself, such as
Finder's Compress makes, is refused as missing `plugin.json`):

```
plugin.json    — required
ui.html        — required (whatever manifest.main names)
icon.svg       — required if the manifest declares an icon
```

Use the bundled packer — it validates the full contract first:

```bash
python3 scripts/pack.py my-plugin/            # → my-plugin/../<id>-<version>.sshowplugin
python3 scripts/pack.py my-plugin/ --check    # validate only, no zip
python3 scripts/pack.py my-plugin/ --out dist/plugin.sshowplugin
```

It packs every file in the folder except hidden ones (`.git`,
`.DS_Store`) and earlier `.sshowplugin` packages. `main` and `icon` must
name one of those files by its path inside the folder — the editor looks
them up by exactly that name.

Hard caps. The packer and the server enforce every row; the editor
checks only the entry count and the size of the files it reads
(`plugin.json`, `main`, the icon), and leaves the rest to submission — so
an over-long description imports fine locally and is refused at publish.
Text lengths count as JavaScript does: an emoji is 2 chars.

| Cap | Value |
|---|---|
| Zip entries | ≤ 64 |
| Per-file size (uncompressed) | ≤ 5MB |
| Whole package | ≤ 10MB |
| `id` length | ≤ 100 chars |
| `name` length | ≤ 100 chars |
| `description` length | ≤ 2000 chars |
| `author` length | ≤ 100 chars |
| Icon formats | png · svg · jpg · jpeg · webp |

## Test loops

**Editor import (web + desktop)** — Plugins panel → `+` → pick the file.
The row runs the plugin; the row's `−` removes it. Importing an id that is
already there replaces it in place — upgrade, rollback, and reinstall are
the same move; the panel says `X updated: 1.0.0 → 1.1.0` (or
`reinstalled`), and a running copy reopens with the new code. A file
imported this way lasts until the editor reloads. A refused file only says
it could not be read — run `pack.py --check` to see why.

**Studio desktop hot reload** — in Studio's `settings.json`:

```json
{ "plugins.devPath": "/absolute/path/to/my-plugin" }
```

Point it at the *folder* (not a zip), then relaunch Studio — settings are
read at launch. Every save of a file at the top of the folder
re-registers the plugin in all open editors; if it was running, its panel
reopens with the new code. Read failures surface in the developer console
as `[plugins-dev]` warnings. This is the fastest loop — no zipping until
you ship — but it skips the package checks, so run `pack.py --check`
before you publish.

## Publish

Submit at **https://s.show/developers** (sign in required): upload the
`.sshowplugin`, optionally add a note for reviewers (how to test, up to
500 chars), accept the guidelines, submit. Every version is human-reviewed
before it goes live; verdicts arrive in-app and by email, and rejection
feedback appears in the console next to the version.

Rules that gate a submission:

1. **Id ownership** — the first account to submit a manifest id owns it
   forever, from that first submission on, approved or not. Someone else's
   id → refused.
2. **One review at a time** — a new version can't be submitted while one
   is pending for the same plugin.
3. **Version monotonicity** — every submission must be strictly higher
   (`x.y.z`, numeric compare) than every earlier submission of that id,
   including rejected ones. Fixing a rejection means bumping the version.
4. **Reserved ids** — `installed`, `mine`, `submit` are refused.
5. **Immutable artifacts** — the reviewed zip is byte-for-byte what users
   receive; the server never rewrites a package.
6. **Rate limit** — 10 submissions and unlists per hour per account;
   refused attempts do not count.

After approval the plugin appears in the studio dashboard catalog.
Installs are per-account (up to 100 plugins each): users who install it get
it auto-loaded in every editor they sign in to (web, desktop, and tablet),
always at the latest published version — there is nothing to ship for
updates beyond submitting the next version.

**Unlist** in the console takes a published plugin out of the catalog and
out of every editor. The id stays yours, and the next approved version
lists it again — users who had installed it get it back.
