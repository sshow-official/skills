# Testing, Versions, and Publishing

## Contents

- [Try it in the editor](#try-it-in-the-editor)
- [How a document stores a dynamic](#how-a-document-stores-a-dynamic)
- [New versions](#new-versions)
- [Package caps](#package-caps)
- [Publish](#publish)

## Try it in the editor

**Editor (web and desktop)** — drag the `.sshowdynamic` onto the editor's
canvas. The pack is installed for this session; a pack with the same id
is replaced in place, so dropping a new build is the update — unless,
compared with the build this editor already holds (an earlier drop, a
hot-reload save, or the published version), it removes or renames a
dynamic or a param, changes a slot or a param's type, or narrows a range.
The editor refuses that one and keeps drawing the old build, so reload the
editor before dropping such a build. Then select a shape and press `+`
beside **Fills** (or **Strokes**) → **Dynamic** for a paint, or `+` beside
**Effects** → **Dynamic** for an effect: the picker shows each pack's
dynamics under the pack's name, as the stills the build drew as picker
tiles. The controls under it are your params. An object takes one dynamic
paint in its fills and one in its strokes, and text takes none (it shows
grey); effects stack like any other. A dropped pack lasts until the editor
reloads. A refused package leaves no message on screen — only a `Dynamic
pack refused` warning in the developer console — so build with the
runner first: what it accepts, a freshly loaded editor accepts.

**Studio hot reload (Windows app)** — choose File › Settings › Edit
settings.json… and set:

```json
{ "dynamics.devPath": "C:/Users/me/my-pack" }
```

Point it at the pack *folder*, written with `/`, and relaunch Studio —
settings are read at launch. Every save of `dynamic.json` re-registers the
pack in every open editor. Studio reads the shaders from the manifest and
does not watch `shaders/`, so after changing a `.glsl` file run the build
(it writes `dynamic.json`). The Mac app's sandbox can't read a folder
named here, and the desktop app has no developer tools to show a refusal
— the build's messages are the ones to read.

## How a document stores a dynamic

A paint lives in an object's `fills` or `strokes`, an effect in its
`effects`, as:

```json
{ "type": "dynamic", "source": "com.example.starter", "name": "stripes", "params": { "size": 32 }, "opacity": 1, "visible": true }
```

- `source` is your pack `id`, `name` the dynamic's `name`; `params` keeps
  the user's values by key — a key missing from it takes the default you
  declare now, and a stored number is held to your current `min…max`.
- The editor writes every param's value into `params` when a user adds the
  dynamic, so a changed default reaches only later uses (and params you
  add later); a changed shader redraws every document that uses it.
- A document names the pack, not a copy: an editor that opens it and
  lacks the pack fetches it from the catalog — published, or unlisted but
  still served to the documents that use it. A `.sshow` file also carries
  the packs it uses that came in as a package (dropped, installed or
  published — not one Studio hot-reloads from a folder); a document saved
  in the cloud carries none.
- Plugins and AI tools write the same object — that is all it takes to
  use your dynamic from code.

## New versions

Documents made with a published version must keep drawing with the next
one, so the review refuses — and the editor will not install over the
published one — a version that:

- removes or renames a dynamic,
- changes a dynamic's `slot`,
- removes or renames a param, or changes its `type`,
- narrows a number param's range (raises `min` or lowers `max`).

Everything else is free: add dynamics and params, change defaults,
labels, translations, steps, units, `animated`, `padding`, and the
shaders, and widen ranges. A changed idea is a new dynamic under a new
name — keep the old one so the documents that use it still draw.

Build every new version against the published package:

```bash
node scripts/build.mjs my-pack/ --previous com.example.starter-1.0.0.sshowdynamic
```

It refuses a version that breaks the rule above, a different id, and a
version number that is not higher (`x.y.z`, compared numerically — every
submission must outrank every earlier one, rejected ones included). Keep
each published package; it is the one to compare against.

## Package caps

The runner and `pack.py` check every row; the server checks them again.

| Cap | Value |
|---|---|
| Package | ≤ 10 MB, ≤ 64 zip entries — a dynamic pack holds `dynamic.json` and its icon |
| `dynamic.json` (uncompressed) | ≤ 256 KB — the shaders ride inside it |
| Icon | png · svg · jpg · jpeg · webp, ≤ 5 MB |
| `id` / `name` / `author` | ≤ 100 chars each |
| `description` | ≤ 2000 chars |
| `name_localized` / `description_localized` | `en` · `ko` keys, each within its field's cap |
| Dynamics per pack | ≤ 32 |
| Params per dynamic | ≤ 24 |
| `label` (dynamic, param) | ≤ 48 chars |
| `unit` | ≤ 8 chars |
| `padding` reach | ≤ 256 px with every scaled param at its max |

Text lengths count as JavaScript does: an emoji is 2 chars.

## Publish

At **https://s.show/developers** (sign in), drop or choose the
`.sshowdynamic`. The console checks it with the submit's own rules and
shows whether it is a new extension or the next version after the
published one. Add a note to the reviewer if it helps (up to 500 chars:
what changed, how to try it), confirm you have the right to distribute
everything in the package under the SSHOW Terms of Use, and **Send for
review**. The server has no GPU: a reviewer installs the pack in the editor
and looks at what your previews show, then publishes it or asks for
changes. The answer comes as a notification and an email; feedback shows
next to the version in the console.

Rules a submission must pass:

1. **The id** — the first account to submit an id owns it, as a dynamic
   pack. `installed`, `mine`, `submit`, `check` and `builtin` are refused,
   and ids under `app.sshow.` belong to SSHOW.
2. **One review at a time.** **Cancel review** takes back the version in
   review: its package is deleted and its version number is free again, so
   a fix goes out without waiting (cancelling a first submission frees the
   id too).
3. **A higher version** than every earlier submission, rejected ones
   included.
4. **[Compatibility](#new-versions)** with the published version.
5. **Limits** — 10 accepted submissions or unlists an hour per account
   (refused ones do not count), and 60 package checks an hour.
6. **What you send is what users get** — the reviewed zip, byte for byte;
   the server never rewrites a package.

Once approved, the pack is listed under **Dynamics** in Studio's
Extensions list. A user who installs it (up to 100 extensions per
account) gets it in every editor they sign in to — web, desktop and
tablet — always at the latest published version; publishing the next
version is the whole update.

**Unlist** takes a published pack out of the list and out of installs.
Documents that already use it keep drawing with its last published
version, the id stays yours, and the next approved version lists it
again.
