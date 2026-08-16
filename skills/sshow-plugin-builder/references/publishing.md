# Packaging, Testing, and Publishing

## Package (`.sshowplugin`)

A `.sshowplugin` is a plain zip of the plugin folder's files at the
archive root (no wrapping directory):

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

Hard caps (enforced by the packer, the editor, and the server alike):

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
already registered is refused — remove first, then re-import.

**Studio desktop hot reload** — in Studio's `settings.json`:

```json
{ "plugins.devPath": "/absolute/path/to/my-plugin" }
```

Point it at the *folder* (not a zip). Every file save re-registers the
plugin in all open editors; if it was running, its panel reopens with the
new code. Read failures surface in the editor console as `[plugins-dev]`
warnings. This is the fastest loop — no zipping until you ship.

## Publish

Submit at **https://s.show/developers** (sign in required): upload the
`.sshowplugin`, optionally add a note for reviewers (how to test), accept
the guidelines, submit. Every version is human-reviewed before it goes
live; verdicts arrive in-app and by email, and rejection feedback appears
in the console next to the version.

Rules that gate a submission:

1. **Id ownership** — the first account to submit a manifest id owns it
   forever. Someone else's id → refused.
2. **One review at a time** — a new version can't be submitted while one
   is pending for the same plugin.
3. **Version monotonicity** — every submission must be strictly higher
   (`x.y.z`, numeric compare) than every earlier submission of that id,
   including rejected ones. Fixing a rejection means bumping the version.
4. **Reserved ids** — `installed`, `mine`, `submit` are refused.
5. **Immutable artifacts** — the reviewed zip is byte-for-byte what users
   receive; the server never rewrites a package.

After approval the plugin appears in the studio dashboard catalog.
Installs are per-account: users who install it get it auto-loaded in every
editor they sign in to (web and desktop), always at the latest published
version — there is nothing to ship for updates beyond submitting the next
version.
