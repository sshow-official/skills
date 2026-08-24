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
   [references/actions.md](references/actions.md) as needed.
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
            const { applied, skipped } = await api.document.applyActions([{
                op: 'create_object', type: 'text', config: {
                    name: 'greeting',
                    data: { text: 'Hello, SSHOW!', fontSize: 48, autoSize: true },
                    transform: { x: 200, y: 200 }
                }
            }], 'Hello plugin');
        });
    })();
</script>
```

The core loop is always: **connect → read snapshots → build an action
array → one `applyActions` call**. Batch related edits into a single call —
each call is exactly one undo step for the user. Finish creation flows
with `document.setSelection([...ids])` so the user gets the result
selected.

Style the panel with the injected theme variables
(`var(--sshow-foreground)`, `var(--sshow-primary)`, `var(--sshow-border-color)`,
…) — they follow the editor's light/dark mode automatically. See
[references/api.md](references/api.md) for the full token list and
`ui.getTheme()`.

## Rules that break plugins silently

1. **Self-contained or nothing.** The panel is a sandboxed iframe with all
   network blocked by CSP. Inline every script and style; embed images and
   fonts as `data:` URIs. No `fetch`, no CDN tags, no relative asset paths.
2. **Reads are copies.** Snapshots from `getState`/`getObject`/
   `getSelection` are inert — mutating them does nothing. The only write
   path is `applyActions`.
3. **`style` replaces wholesale.** When setting style, always send the full
   `{ fills, strokes, effects }`. By contrast `transform`, `size`, `data`,
   and `layout` merge per key.
4. **`motion` merges per sub-container.** Sending `{ animations }` replaces
   all animations but keeps `transitions`, and vice versa. To change one
   keyframe, read the whole container, modify it, send it back whole.
5. **Rotation is radians.** `set.transform.rotateX/rotateY/rotateZ` (degrees)
   are auto-converted — `rotate` is the pre-3D spelling of `rotateZ`.
   Motion-track `transform.rotate*` values are raw radians.
6. **Text sizing.** Default `autoSize: true` grows the box and only wraps
   on real newlines. Body copy that should wrap needs `autoSize: false`
   plus an explicit `size: { width, height }`.
7. **Reference minted assets immediately.** After `assets.register`, put
   the returned `asset://` uri into an action in the same flow — an
   unreferenced asset is eligible for garbage collection.
8. **Events carry no payload.** A callback firing means "re-query": call
   the read API again. Only three event types exist (`history:update`,
   `ui:modes:edit:changeSelectedObjects`, `motion:animation:timeUpdate`).
9. **Check `skipped`.** `applyActions` returns `{ applied, skipped }`;
   malformed actions are skipped with reasons instead of failing the call.
   Surface a message when `skipped.length > 0` — silent no-ops are the top
   source of "the plugin does nothing" reports.
10. **`assets.register` needs an `ArrayBuffer`** (not a Uint8Array), 10MB
    max per asset.
11. **Absent means default, not zero.** Reads omit default-valued fields —
    `opacity: 1`, identity transform keys, a keyframe's default tween. A
    keyframe with no `tween` is the engine's ease-out, not linear; treating
    absence as zero/linear silently misplays motion.

## Package and test

```bash
python3 scripts/pack.py my-plugin/            # validate + zip
python3 scripts/pack.py my-plugin/ --check    # validate only
```

Caps enforced everywhere (script, editor, server): ≤ 64 zip entries,
≤ 5MB per file uncompressed, ≤ 10MB per package.

- **Editor (web + desktop):** Plugins panel → `+` button → pick the
  `.sshowplugin`. To re-import the same id, remove it first with the row's
  `−` button (a duplicate id is refused).
- **Studio desktop hot reload:** set `"plugins.devPath"` in Studio's
  `settings.json` to the plugin *folder*. Every file save re-registers the
  plugin in open editors and reopens it if it was running — no zipping
  during iteration.

## References

- [references/api.md](references/api.md) — the full SDK: connect handle,
  every method's params and returns, events, limits.
- [references/actions.md](references/actions.md) — all 19 action ops,
  per-op required fields, valid `set` keys, merge semantics.
- [references/publishing.md](references/publishing.md) — packaging rules,
  the developer console, review, versioning.
- [examples/hello/](examples/hello/) — the minimal working plugin above,
  ready to pack.
