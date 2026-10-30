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
them up by exactly that name. A dynamic pack (`dynamic.json`) packs just
its manifest and icon into a `.sshowdynamic` — its shaders ride in the
manifest, and the sshow-dynamic-builder skill compiles them in the real
engine before it packs.

Hard caps. The packer and the server enforce every row; the editor
checks only the entry count and the size of the files it reads
(`plugin.json` or `dynamic.json`, `main`, the icon), and leaves the rest to submission — so
an over-long description imports fine locally and is refused at publish.
Text lengths count as JavaScript does: an emoji is 2 chars.

| Cap | Value |
|---|---|
| Zip entries | ≤ 64 |
| Per-file size (uncompressed) | ≤ 5MB |
| Manifest (`plugin.json` · `dynamic.json`, uncompressed) | ≤ 256KB |
| Whole package | ≤ 10MB |
| `id` length | ≤ 100 chars |
| `name` length | ≤ 100 chars |
| `name_localized` | `en` · `ko` keys, each ≤ 100 chars |
| `description` length | ≤ 2000 chars |
| `description_localized` | `en` · `ko` keys, each ≤ 2000 chars |
| `author` length | ≤ 100 chars |
| Icon formats | png · svg · jpg · jpeg · webp |

## Test loops

**Editor import (web + desktop)** — Plugins panel → `+` → pick the file.
The row runs the plugin; the row's `−` removes it. Importing an id that is
already there replaces it in place — upgrade, rollback, and reinstall are
the same move; the panel says `X updated: 1.0.0 → 1.1.0` (or
`reinstalled`), and a running copy reopens with the new code. A file
imported this way lasts until the editor reloads. A refused file only says
it could not be read, or that it was built for a different plugin API
version — run `pack.py --check` to see why.

**Studio hot reload (Windows app)** — choose File › Settings › Edit
settings.json… and set:

```json
{ "plugins.devPath": "C:/Users/me/my-plugin" }
```

Point it at the *folder* (not a zip) and write the path with `/` — single
backslashes make the file unreadable and reset your other settings too.
Then relaunch Studio, because settings are read at launch. Every save of a
file at the top of the folder re-registers the plugin in all open editors;
if it was running, its panel reopens with the new code. Set it back to
`null` to turn it off. The Mac app's sandbox can't read a folder named
here, so on macOS import again instead. The desktop app has no developer
tools: if the plugin doesn't show up or misbehaves, pack the same files and
import them in the web editor, where the browser's developer tools show the
error. This is the fastest loop — no zipping until you ship — but it skips
the package checks, so run `pack.py --check` before you publish.

## Publish

Submit at **https://s.show/developers** (sign in required). In **Send for
review**, choose or drop the `.sshowplugin`: the console checks it right
away against the rules below and shows its name, version and id, and
whether it is a new extension or which version it follows — or names the
rule it breaks, so you can fix it before sending. Optionally add a note to
the reviewer (what changed or how to try it, up to 500 chars), confirm you
have the right to distribute everything in the package under the SSHOW
Terms of Use, and send. Every version is human-reviewed before it goes
live. Verdicts arrive in-app and by email and open the plugin's row in
**Your extensions**, where reviewer feedback shows next to the version.

Rules that gate a submission:

1. **Id ownership** — the first account to send a manifest id owns it
   from that submission on, approved or not, and as a plugin: the same id
   can't come back as a dynamic pack. Someone else's id → refused.
   Cancelling the review of an id's first version frees the id again.
2. **One review at a time** — a new version can't be sent while one is in
   review. To send a fix sooner, **Cancel review** on the plugin's row:
   the package in review is deleted.
3. **Version monotonicity** — every submission must be strictly higher
   (`x.y.z`, numeric compare) than every earlier submission of that id,
   including rejected ones. A cancelled version doesn't count, so its fix
   can go out under the same number. Fixing a rejection means bumping the
   version.
4. **Reserved ids** — `installed`, `mine`, `submit`, `check`, `builtin`
   and every id under `app.sshow.` are refused.
5. **Immutable artifacts** — the reviewed zip is byte-for-byte what users
   receive; the server never rewrites a package.
6. **Rate limit** — 10 submissions and unlists per hour per account;
   refused attempts do not count, and cancelling a review is free. The
   console checks up to 60 chosen packages an hour, refused ones included.

After approval the plugin appears in Studio's **Extensions** list.
Installs are per-account, up to 100 extensions with plugins and dynamic
packs counted together: users who install it get it auto-loaded in every
editor they sign in to (web, desktop, and tablet), always at the latest
published version — there is nothing to ship for updates beyond
submitting the next version.

**Unlist** in the console takes a published plugin out of the catalog and
out of every editor. The id stays yours, and the next approved version
lists it again — users who had installed it get it back.
