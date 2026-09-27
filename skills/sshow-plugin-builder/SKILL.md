---
name: sshow-plugin-builder
description: >-
  Builds SSHOW editor plugins — a plugin.json manifest plus one self-contained
  HTML screen, packaged as a .sshowplugin zip. Use when the user wants to
  create, modify, package, test, or publish a plugin for SSHOW (s.show), or
  mentions .sshowplugin files, the SSHOWPlugin SDK, or extending the SSHOW
  editor.
metadata:
  author: SSHOW
---

# Building SSHOW Plugins

An SSHOW plugin is a folder of three files, zipped as `.sshowplugin`:

```
my-plugin/
├─ plugin.json    — manifest (identity + entry document)
├─ ui.html        — the whole plugin: one self-contained HTML screen
└─ icon.svg       — listing icon (optional; png/svg/jpg/jpeg/webp)
```

The editor opens `ui.html` in a sandboxed panel, injects the `SSHOWPlugin`
SDK ahead of your scripts, and everything the plugin can do goes through
that one global. There is no build step and no dependency install.

## Workflow

1. **Scaffold** the three files (start from `examples/hello/`).
2. **Write the screen** following the rules below; look up exact API and
   action shapes in [references/api.md](references/api.md) and
   [references/actions.md](references/actions.md), and what goes inside an
   object, style, text, motion, or rule in the engine's own
   [references/guide.md](references/guide.md), as needed.
3. **Package** with `python3 scripts/pack.py <plugin-dir>` — it validates
   the full contract, then zips.
4. **Test** in the editor (import) or with Studio's hot reload.
5. **Publish** via the developer console — see
   [references/publishing.md](references/publishing.md).

## Manifest (`plugin.json`)

```json
{
    "id": "com.example.hello",
    "name": "Hello",
    "version": "1.0.0",
    "api": 1,
    "main": "ui.html",
    "description": "Inserts a greeting card.",
    "author": "SSHOW",
    "icon": "icon.svg"
}
```

- `id` — lowercase reverse-domain, `[a-z0-9.-]` only, no `..`, ≤ 100 chars.
  Pick a domain you control: the first person to publish an id owns it
  forever. Never reuse `installed`, `mine`, or `submit`.
- `version` — exact `x.y.z`. Every submission must be strictly higher than
  every earlier one, so bump before repackaging for publish.
- `api` — must be the integer `1`. Anything else is refused at load.
- `main` — the entry document filename inside the zip.
- `description` / `author` / `icon` — optional but all three drive the
  listing; always provide them for anything you intend to publish. In the
  catalog the author line shows the verified submitter account — the
  manifest `author` is what the editor's plugin list displays.

Unknown manifest fields are silently dropped — do not invent fields.

## The screen (`ui.html`)

```html
<!doctype html>
<button id="insert">Insert</button>
<script>
    (async () => {
        const api = await SSHOWPlugin.connect();
        api.ui.resize(160);

        document.querySelector('#insert').addEventListener('click', async () => {
            const { skipped, ids } = await api.document.applyActions([{
                op: 'create_object', type: 'text', config: {
                    id: 'greeting',
                    name: 'greeting',
                    data: { text: 'Hello, SSHOW!', fontSize: 48, lineHeight: 60, autoSize: true },
                    transform: { x: 200, y: 200, anchorX: 0, anchorY: 0 }
                }
            }], 'Hello plugin');
            if (!skipped.length) await api.document.setSelection([ids.objects.greeting]);
        });
    })();
</script>
```

The core loop is always: **connect → read snapshots → build an action
array → one `applyActions` call**. Batch related edits into a single call —
each call is exactly one undo step for the user. Finish creation flows
with `document.setSelection(...)` on the ids the call returned so the user
gets the result selected.

Style the panel with the injected theme variables
(`var(--sshow-foreground)`, `var(--sshow-primary)`, `var(--sshow-border-color)`,
…) — they follow the editor's light/dark mode automatically. See
[references/api.md](references/api.md) for the full token list and
`ui.getTheme()`.

## Rules that break plugins silently

1. **Self-contained or nothing.** The panel is a sandboxed iframe with all
   network blocked by CSP, and only the `main` document is served from
   the package.
   Inline every script and style; embed images and fonts as `data:` URIs.
   No `fetch`, no CDN tags, no relative asset paths. WebAssembly compiles;
   `eval` and `new Function` do not.
2. **Reads are copies.** Snapshots from `getState`/`getObject`/
   `getSelection` are inert — mutating them does nothing. The only write
   path is `applyActions`.
3. **`style`, `distort`, and `interaction` replace wholesale.** When
   setting style, always send the full `{ fills, strokes, effects }`; when
   setting rules, send every rule the node keeps. By contrast `transform`,
   `size`, `data`, and `layout` merge per key.
4. **`motion` merges per sub-container.** Sending `{ animations }` replaces
   all animations but keeps `transitions`, and vice versa. To change one
   keyframe, read the whole container, modify it, send it back whole.
5. **Rotation: degrees in, radians out.** `set.transform.rotateX/rotateY/
   rotateZ` take degrees (auto-converted — `rotate` is the pre-3D spelling
   of `rotateZ`). Reads return radians, and motion-track
   `transform.rotate*` values are raw radians — convert a read value
   before sending it back.
6. **Text sizing.** Default `autoSize: true` grows the box and only wraps
   on real newlines. Body copy that should wrap needs `autoSize: false`
   plus an explicit `size: { width, height }`. Give every text a
   `lineHeight` with its `fontSize` and an anchor that matches its
   alignment (guide F1, F14), or it drifts from where you placed it.
7. **Media goes through `assets.register`.** `data.src` and image fills
   take only the `asset://` uri it returns — a `data:` URI or URL there is
   skipped. Put the uri into an action in the same flow — an unreferenced
   asset is eligible for garbage collection.
8. **Events carry no payload.** A callback firing means "re-query": call
   the read API again. Only three event types exist (`history:update`,
   `ui:modes:edit:changeSelectedObjects`, `motion:animation:timeUpdate`).
   Never write from a `timeUpdate` callback — the write fires it again.
9. **Check `skipped`.** `applyActions` returns `{ applied, skipped, ids }`;
   malformed actions are skipped with reasons (and their position in your
   array) instead of failing the call. Surface a message when
   `skipped.length > 0` — silent no-ops are the top source of "the plugin
   does nothing" reports — and wrap the call in `try`/`catch`: a failure
   that only shows while the batch runs rejects the whole call.
10. **Ids are the engine's — yours are aliases.** The `config.id` you put on a
    create is an alias for that one call. The engine assigns the real id (they
    carry a per-session scope, so collaborators never mint the same one) and
    returns the binding in `ids`. Reference the alias from later actions in the
    same call, read `ids` to address the object afterwards (selection
    included), and never store the alias. An alias is a word (`'card'`),
    never an engine-shaped id like `o7` — see
    [references/api.md](references/api.md).
11. **`assets.register` needs an `ArrayBuffer`** (not a Uint8Array), 10MB
    max per asset.
12. **Remember the user's settings.** The panel is destroyed on close, so
    every option resets unless you persist it — which users experience as a
    bug. Restore from `api.storage?.get()` right after connect and
    `api.storage?.set()` on change; it is JSON, 64KB per plugin, and scoped to
    the app rather than the document. Keep the `?.` — an older editor has no
    `storage` at all, and without the guard the panel dies before it draws.
13. **Absent means default, not zero.** Reads trim default values inside
    objects — a paint's `type: 'solid'` and `opacity: 1`, text defaults,
    zero radii, a keyframe's default tween. A keyframe with no `tween` is
    the engine's ease-out, not linear; treating absence as zero/linear
    silently misplays motion.
14. **A write can become a keyframe.** In Animation mode, a pose write
    (`transform`, `size`, `opacity`, `style`, …) at a playhead above 0
    lands as a keyframe there when the user's autokey is on or the track
    is already animated. `getTimelineTime()` is the only signal (above 0 ⇒
    Animation mode) — see api.md, "Where a write lands".
15. **Keys you don't claim reach the editor.** Outside a text field every
    editor shortcut fires: arrows nudge the user's selection (even while
    your `<select>` changes option), letters switch tools, Delete deletes,
    and Tab cycles the edit mode. Keep a key with `stopPropagation()` (or
    `preventDefault()`) in a listener on the element or `document` — a
    plain `window` listener runs too late.

## Package and test

```bash
python3 scripts/pack.py my-plugin/            # validate + zip
python3 scripts/pack.py my-plugin/ --check    # validate only
```

`python3` is the only prerequisite — the packer is standard library only,
nothing to install.

Caps: ≤ 64 zip entries, ≤ 5MB per file uncompressed, ≤ 10MB per package —
the packer and the server check all three; the editor checks the entry
count and the files it reads.

- **Editor (web + desktop):** Plugins panel → `+` button → pick the
  `.sshowplugin`. Importing an id that is already there replaces it in
  place — upgrade, rollback, or reinstall — and reopens it if it was
  running. A plugin imported this way lasts until the editor reloads.
- **Studio desktop hot reload:** set `"plugins.devPath"` in Studio's
  `settings.json` to the plugin *folder* and relaunch Studio. Every file
  save re-registers the plugin in open editors and reopens it if it was
  running — no zipping during iteration.

## References

- [references/api.md](references/api.md) — the full SDK: connect handle,
  every method's params and returns, events, limits.
- [references/actions.md](references/actions.md) — all 19 action ops,
  per-op required fields, valid `set` keys, merge semantics.
- [references/guide.md](references/guide.md) — the engine's own authoring
  reference: object types, styles and effects, text formulas, motion,
  timeline tracks, interaction rules (generated from the engine, do not
  edit).
- [references/publishing.md](references/publishing.md) — packaging rules,
  the developer console, review, versioning.
- [examples/hello/](examples/hello/) — the minimal working plugin above,
  ready to pack.
