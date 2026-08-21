# SSHOW Plugin SDK Reference

The editor injects the SDK into the plugin's document before its own
scripts run. `window.SSHOWPlugin` is the only global. Every call returns a
Promise (postMessage RPC under the hood); a failed call rejects with a
reason string.

## Contents

- [Connecting](#connecting)
- [document — reads](#document--reads)
- [document — editor state](#document--editor-state)
- [document.applyActions — the only write path](#documentapplyactions--the-only-write-path)
- [assets](#assets)
- [events](#events)
- [ui and theme](#ui-and-theme)
- [Sandbox and limits](#sandbox-and-limits)

## Connecting

```js
const api = await SSHOWPlugin.connect();

api.apiVersion;     // 1 — the bridge contract this editor speaks
api.engineVersion;  // engine build string, for display only

api.document;       // getState() · getObject(id) · getSelection() · setSelection(ids)
                    // setActiveScene(sceneId) · getTimelineTime() · applyActions(actions, label)
api.assets;         // get(uri) · register(bytes, { mimeType, originalName })
api.events;         // on(type, callback) · off(type, callback)
api.ui;             // resize(size) · getTheme()
```

Connect once at startup and keep the handle. If the manifest's `api` is not
exactly `1`, the plugin is refused before your code ever runs.

## document — reads

All reads return **snapshots (copies)**. Mutating a returned object changes
nothing in the document.

### `document.getState() → Promise<state>`

The whole document, id-complete:

```js
{
    canvas: { width, height },          // scene size
    activeSceneId,
    scenes: [{
        id, name, active,
        objects: [/* ACTIVE scene: full compact objects; other scenes: {id, type, name} summaries */],
        motion  // active scene only
    }],
    fonts: [/* family names available in the document */]
}
```

### `document.getObject(id) → Promise<object | null>`

One object in compact serialized form.

### `document.getSelection() → Promise<object[]>`

The current edit-mode selection, compact serialized. A compact object looks
like:

```js
{ id, type, name, transform, size, style, data, motion?, /* … */ }
```

Two things make a snapshot smaller than the document:

- **Default values are omitted.** `opacity: 1`, `visible: true`, identity
  transform keys (`scaleX: 1`, `rotate: 0`, …), a paint's `type: 'solid'`,
  a keyframe's default tween — all absent. Absent means *the default*,
  never zero: a keyframe with no `tween` carries the engine's ease-out
  `[0.25, 0, 0.05, 1]`, so reading absence as linear misplays motion.
- **Asset bytes are elided.** A long `data.src` becomes a
  `<src len=… kind=…>` marker. Never copy a marker back into a `set` —
  read the real bytes with `assets.get` instead.

Geometry is never summarised: `data.points` and `data.text` reach a plugin
complete, however long, so trace a real path instead of falling back to its
bounding box.

## document — editor state

Two UI-state setters and one editor-state read round out the reads. None
of them touches the document or the undo history.

### `document.setSelection(ids) → Promise<void>`

Select the given **active-scene** object ids in the editor. Stale ids drop
silently. The canonical finish for a creation flow — hand the user what
you just made, selected:

```js
await api.document.applyActions([{ op: 'create_object', type: 'rect',
    config: { id: 'my-rect', size: { width: 100, height: 100 } } }]);
await api.document.setSelection(['my-rect']);
```

### `document.setActiveScene(sceneId) → Promise<void>`

Switch the active scene (scene navigators, per-scene batch tools). Unknown
ids reject — a plugin never keeps writing into the wrong scene.

### `document.getTimelineTime() → Promise<number>`

The editor's animation clock in ms — the time the canvas is posed at: the
playhead while Animation mode holds, `0` in Design mode (the document
pose). Start timeline work here — a bake, a preset — so it lands where the
user is looking. `motion:animation:timeUpdate` fires on every move: re-read
inside the callback, and re-read once more right before you write (leaving
Animation mode resets the clock without a signal).

## document.applyActions — the only write path

```js
const { applied, skipped } = await api.document.applyActions(actions, label);
```

- `actions` — an array of action objects; see
  [actions.md](actions.md) for the 19 ops and their fields.
- `label` — the undo-history label users see. Defaults to the plugin name.
  Never serialized into the document.
- `applied` — how many actions committed. The batch commits atomically:
  **one call = one undo step**.
- `skipped` — `[{ op, reason }]` for malformed/stale actions. The rest of
  the batch still applies. Always check this and surface failures.

Actions in one batch can reference each other: give `create_object` a
`config.id` of your choosing and target that id from a later action in the
same array.

## assets

### `assets.get(uri) → Promise<{ bytes, mimeType, originalName } | null>`

Read the raw bytes behind an `asset://` uri (e.g. a selected image's
`data.src`). `bytes` is an ArrayBuffer copy.

### `assets.register(bytes, { mimeType, originalName }) → Promise<uri>`

Mint bytes into the project's content-addressed store and get back an
`asset://<id>.<ext>` uri.

- `bytes` **must be an ArrayBuffer** — pass `typedArray.buffer` if you have
  a view. Max 10MB.
- Identical content dedupes to the same uri.
- Reference the uri in an action right away (e.g.
  `set: { data: { src: uri } }`) — unreferenced assets are eligible for
  garbage collection.

Full pixel-editing round trip:

```js
const [image] = await api.document.getSelection();
const { bytes, mimeType } = await api.assets.get(image.data.src);
const edited = await process(bytes);                       // your work
const uri = await api.assets.register(edited, { mimeType, originalName: 'edited.png' });
await api.document.applyActions([
    { op: 'update_object', id: image.id, set: { data: { src: uri } } }
], 'Edit image');
```

## events

```js
await api.events.on('history:update', callback);
await api.events.off('history:update', callback);
```

Exactly three event types exist; anything else rejects:

| Type | Fires when |
|---|---|
| `history:update` | the document changed (edits, undo, redo — yours or the user's) |
| `ui:modes:edit:changeSelectedObjects` | the selection changed |
| `motion:animation:timeUpdate` | the animation clock moved (a seek, or every playback frame — debounce) |

Callbacks receive **no arguments** — an event is a re-query signal. Read
fresh state through the document API inside the callback. All
subscriptions are torn down automatically when the plugin closes.

## ui and theme

### `ui.resize(size)`

Request a screen size in px. A number is a height request; an object
carries either axis:

```js
api.ui.resize(300);                          // height only
api.ui.resize({ width: 480, height: 520 }); // both axes
```

The host panel resizes so your screen gets the requested dimensions,
clamped to the panel's own bounds (about 280×240 up to 90% of the editor
window). Without a call the screen fills the default panel. Call it once
after connect (and again if your content grows). The user can still drag
the panel to any size afterwards — keep your layout fluid.

### Theme — CSS variables (preferred)

Every plugin document is injected with the editor's design tokens, wired
to the same light/dark media query the editor uses. Style with these and
a theme flip restyles your panel automatically:

```
--sshow-primary               accent (#2196F3)
--sshow-primary-strong        filled active/selected surface
--sshow-primary-soft          its hover
--sshow-primary-foreground    text over the accent
--sshow-secondary
--sshow-foreground            body text — follows light/dark
--sshow-background            panel surface (translucent)
--sshow-background-solid
--sshow-border-color
--sshow-radius                13px
--sshow-font-size             12px   panel-contents scale
```

```css
body { color: var(--sshow-foreground); font-size: var(--sshow-font-size); }
button { border: 1px solid var(--sshow-border-color); border-radius: var(--sshow-radius); }
button.primary { background: var(--sshow-primary); color: var(--sshow-primary-foreground); }
```

### `ui.getTheme() → Promise<{ mode, colors, borderRadius, fontSize }>`

For script logic (e.g. canvas drawing): `mode` is `'light' | 'dark'`,
`colors` carries the resolved values for the active mode
(`primary`, `primaryForeground`, `secondary`, `foreground`, `background`,
`backgroundSolid`, `borderColor`). To react to a flip in JS, watch the
media query inside your own document — styles via `var()` follow
automatically:

```js
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
```

## Sandbox and limits

- The screen runs in `sandbox="allow-scripts"` with CSP
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
  img-src data: blob:; font-src data:` — **all network is blocked**, both
  ways. Inline everything; images/fonts as `data:`/`blob:`.
- One plugin runs at a time; opening another (or closing the panel)
  deactivates yours and tears down listeners and the iframe. There is no
  persistence between runs — read what you need from the document.
- Plugins never serialize into the `.sshow` document. Objects you create
  are ordinary document objects; the document opens fine without the
  plugin.
- Package caps: ≤ 64 zip entries, ≤ 5MB per file (uncompressed), ≤ 10MB
  per package, ≤ 10MB per registered asset.
