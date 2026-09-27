# SSHOW Plugin SDK Reference

The editor injects the SDK into the plugin's document before its own
scripts run. `window.SSHOWPlugin` is the only global. Every call returns a
Promise (postMessage RPC under the hood); a failed call rejects with an
`Error` whose message is the engine's `[SSHOW][CODE] …` string — read the
code from the message, nothing else crosses the bridge.

## Contents

- [Connecting](#connecting)
- [document — reads](#document--reads)
- [document — editor state](#document--editor-state)
- [document.applyActions — the only write path](#documentapplyactions--the-only-write-path)
- [assets](#assets)
- [storage](#storage)
- [events](#events)
- [ui and theme](#ui-and-theme)
- [Keyboard](#keyboard)
- [Sandbox and limits](#sandbox-and-limits)

## Connecting

```js
const api = await SSHOWPlugin.connect();

api.apiVersion;     // 1 — the bridge contract this editor speaks
api.engineVersion;  // engine build string, for display only

api.document;       // getState() · getObject(id) · getSelection() · getTextLayout(id)
                    // setSelection(ids) · setActiveScene(sceneId) · getTimelineTime()
                    // applyActions(actions, label)
api.assets;         // get(uri) · register(bytes, { mimeType, originalName })
api.storage;        // get(key) · set(key, value) · remove(key) · keys()
api.events;         // on(type, callback) · off(type, callback)
api.ui;             // resize(size) · getTheme()
```

Connect once at startup and keep the handle. If the manifest's `api` is not
exactly `1`, the plugin is refused before your code ever runs.

## document — reads

All reads return **snapshots (copies)**. Mutating a returned object changes
nothing in the document. Object reads see the **active scene only** —
switch with `setActiveScene` to read another.

### `document.getState() → Promise<state>`

The whole document, id-complete:

```js
{
    canvas: { width, height },          // one canvas size for every scene
    activeSceneId,
    scenes: [{
        id, name, active,
        objects: [/* ACTIVE scene: full objects, children nested; other scenes: {id, type, name} */],
        motion,       // active scene only, when it has transitions or a clock
        interaction   // active scene only, when it has rules — its own rules, not its objects'
    }],
    fonts: [/* family names registered in the document */]
}
```

There is no read for variables, the scene background, or the editor's mode
— a plugin can address only the variables it created itself (from `ids`).

### `document.getObject(id) → Promise<object | null>`

One active-scene object (at any nesting depth), or `null`.

### `document.getSelection() → Promise<object[]>`

The current edit-mode selection. An object read looks like:

```js
{ id, type, name, description, size, transform, layout, distort, style,
  opacity, visible, blendMode, locked, interaction, data?, motion?, children? }
```

Top-level fields are always there, and `transform` carries all 13 keys
(`x`, `y`, `z`, `rotateX`, `rotateY`, `rotateZ`, `scaleX`, …) — angles in
**radians**. Inside the values, defaults are trimmed:

- **Absent means the default, never zero.** A paint without `type` is
  `'solid'`; paints drop `opacity: 1`, `visible: true`, and a stroke's
  `align: 0.5`; empty `fills`/`strokes`/`effects` arrays drop; text data
  drops its defaults (`textAlign: 'left'`, `verticalAlign: 'top'`,
  `autoSize: true`, `letterSpacing: 0`, …); a zero `radius` or
  `innerRadius` and `closed: false` drop, and a `data` or `motion` left
  empty disappears. A keyframe with no `tween` carries the engine's
  ease-out `[0.25, 0, 0.05, 1]` — reading absence as linear misplays motion.
- **Asset bytes are elided.** A `data.src` longer than 120 characters
  becomes a `<src len=… kind=…>` marker (an `asset://` uri is short and
  stays). Never copy a marker back into a `set` — read the real bytes with
  `assets.get` instead.
- **Web requests are masked.** A rule's `fetch` action reads back with
  every header value and URL query value as `***`. Sending it back
  unchanged is safe — the stored one is kept.

Geometry is never summarised: `data.points` and `data.text` reach a plugin
complete, however long, so trace a real path instead of falling back to its
bounding box.

### `document.getTextLayout(id) → Promise<{ char, word, line } | null>`

Where each glyph, word, and line of a text object sits — the layout the
canvas actually drew (variables resolved, kerning and wrapping included):

```js
const { char, word, line } = await api.document.getTextLayout(textId);
// each entry: { text, line, word?, localX, localY, width, height }
```

Coordinates are px in the object's own box, before its transform: (0, 0)
is the top-left of its `size`, and `height` is the line height. `line` is
the drawn (wrapped) line index; `word` is present on `char` and `word`
entries. Whitespace is never an entry. `null` for an id that is not a text
object in the active scene; empty arrays before the text has laid out.

## document — editor state

Two UI-state setters and one editor-state read round out the reads. None
of them touches the document or the undo history.

### `document.setSelection(ids) → Promise<void>`

Select the given **active-scene** object ids in the editor — engine ids,
never your aliases. Stale ids and locked objects drop, and the selection
is replaced, so ids that resolve to nothing clear it. The canonical finish
for a creation flow — hand the user what you just made, selected:

```js
const { skipped, ids } = await api.document.applyActions([{ op: 'create_object', type: 'rect',
    config: { id: 'box', size: { width: 100, height: 100 } } }]);
if (!skipped.length) await api.document.setSelection([ids.objects.box]);
```

It fires `ui:modes:edit:changeSelectedObjects`, so never call it
unconditionally from that event's callback.

### `document.setActiveScene(sceneId) → Promise<void>`

Switch the active scene (scene navigators, per-scene batch tools). Unknown
ids reject — a plugin never keeps writing into the wrong scene.

### `document.getTimelineTime() → Promise<number>`

The editor's animation clock in ms — the time the canvas is posed at: the
playhead while Animation mode holds, `0` in Design mode (the document
pose). Start timeline work here — a bake, a preset — so it lands where the
user is looking. `motion:animation:timeUpdate` fires on every move: re-read
inside the callback, and re-read once more right before you write (leaving
Animation mode resets the clock to `0` without a signal). A value above `0`
means Animation mode; `0` can be either. When the user has stepped into a
frame, this is that frame's named clock, not the scene's — and the value
does not say which.

## document.applyActions — the only write path

```js
const { applied, skipped, ids } = await api.document.applyActions(actions, label);
```

- `actions` — an array of action objects; see
  [actions.md](actions.md) for the 19 ops and their fields.
- `label` — the undo-history label users see. Defaults to the plugin name.
  Never serialized into the document.
- `applied` — how many actions committed. The batch commits atomically:
  **one call = one undo step**.
- `skipped` — `[{ index, op, id?, code?, reason }]` for malformed or stale
  actions: `index` is the action's position in your array, `id` the target
  as you wrote it (for a create, its `sceneId`), `reason` the engine's
  message. The rest of the batch still applies. Always check this and
  surface failures.
- `ids` — `{ objects, scenes, variables }`, each a `{ alias: id }` map of
  the aliases this call declared. A create that was skipped can still be
  listed, so use `ids` only for creates that are not in `skipped`. See
  below.

A failure that only shows while the batch runs — an
`options.parentObjectId` that names nothing or a non-container, an inline
child's paint without `type`, a later action on a create that was skipped
— rolls the whole call back and **rejects** instead of listing a skip, so
wrap the call in `try`/`catch`. The `history:update` your own call causes
reaches your callback before the promise resolves.

### Ids are the engine's — yours are aliases

The `config.id` you put on a create is an **alias for that one call**, not the
document id. The engine assigns the real id (and only the engine can: ids
carry a per-session scope, so two people editing together never mint the same
one) and returns the binding in `ids`.

So: alias a create to reference it from a later action **in the same call**,
and read `ids` to keep addressing it **after** the call. Never store the alias.

```js
const { ids } = await api.document.applyActions([
    { op: 'create_object', type: 'frame', config: { id: 'card', size: { width: 300, height: 200 } } },
    { op: 'create_object', type: 'text', options: { parentObjectId: 'card' }, config: {
        data: { text: 'Hi', fontSize: 24, lineHeight: 34 }, transform: { x: 24, y: 24, anchorX: 0, anchorY: 0 } } }
]);
const cardId = ids.objects.card;          // the id the engine assigned
await api.document.setSelection([cardId]);  // 'card' would select nothing
```

- **An alias is a word** (`'card'`, `'title'`) — never an engine-shaped id
  like `o7`. One already declared in the call, or equal to an id already
  in the target scene (any scene or variable id, for those), is skipped
  (`create id '…' already exists — choose a new id`); an engine-shaped one
  that matches an object in another scene is taken and quietly redirects
  that id for the rest of the call.
- `group_objects` takes an alias in `config.id`, and so do the children
  written inline in a group or frame create — all come back in `ids`.
- A create without an alias, and every `duplicate_object` /
  `duplicate_scene` copy, gets no entry: find it by re-reading
  (`getState`, `getObject`).

### Where a write lands

A pose write — `transform`, `size`, `opacity`, `distort`, `style`, and the
animatable `data` keys (`points`, `radius`, `innerRadius`, `volume`,
`text`) — can become a keyframe:

- In **Design mode** it goes to the document, and on a track that is
  already animated it also sets the track's key at time `0` (Design mode
  is the frame-0 pose).
- In **Animation mode**, at a time above `0`, it becomes a **keyframe** at
  that time when the user's autokey is on or the track is already
  animated — so the same `set.transform` means two different things. At
  time `0` it writes the document as well.

A plugin cannot read the mode or autokey — only `getTimelineTime()` (above
`0` ⇒ Animation mode). Creates, deletes, `set.motion`, and
`set.interaction` are always plain document writes.

## assets

### `assets.get(uri) → Promise<{ bytes, mimeType, originalName } | null>`

Read the raw bytes behind an `asset://` uri (e.g. a selected image's
`data.src`). `bytes` is an ArrayBuffer copy.

### `assets.register(bytes, { mimeType, originalName }) → Promise<uri>`

Mint bytes into the project's content-addressed store and get back an
`asset://<id>.<ext>` uri.

- `bytes` **must be an ArrayBuffer** — pass `typedArray.buffer` if you have
  a view. Max 10MB. `mimeType` is required; the engine checks the bytes and
  corrects a wrong one.
- Identical content dedupes to the same uri.
- Reference the uri in an action right away (e.g.
  `set: { data: { src: uri } }`) — unreferenced assets are eligible for
  garbage collection.
- This uri is the only thing `data.src` and an image fill's `src` accept —
  a `data:` URI or a URL there is skipped. Encode generated pixels
  (`canvas.toBlob` → `arrayBuffer()`) and register them first.

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

## storage

```js
await api.storage.set('options', { duration: 450, direction: 'left' });
const options = await api.storage.get('options');   // null when unset
await api.storage.remove('options');
const keys = await api.storage.keys();
```

Your panel is destroyed every time the user closes it, so anything you keep
in a JS variable is gone on reopen. `storage` is where settings live instead
— the editor holds one record per plugin id and your entries are the only
thing you can address in it. (`window.localStorage` is not available — the
sandbox has no origin of its own.)

- **Values are JSON.** Objects, arrays, numbers, strings, booleans, null.
  No ArrayBuffer, no Map/Set, no functions. Storing `undefined` clears the
  entry.
- **64KB per plugin**, for the whole record. An over-cap `set` throws and
  leaves what was already stored intact.
- **Scope is the app, not the document.** The same record shows up in every
  project the user opens here, and it does not travel inside a `.sshow`
  file. Web, Studio and tablet each keep their own. Put user preferences
  here — anything that belongs to the document has to become objects via
  `applyActions`.
- **Survives reinstall and hot reload**, so iterating on your plugin does
  not wipe the user's settings.
- **Guard the calls: `api.storage?.get(...)`.** The namespace shipped in
  2026-09, and a desktop install can pick up your new package while its own
  engine is still older — `api.storage` is simply absent there. With the `?.`
  the call short-circuits and your plugin runs on its defaults; without it the
  panel dies on a `TypeError` before it draws.

Restore on connect and save on change:

```js
const api = await SSHOWPlugin.connect();
const config = { duration: 300, direction: 'up', ...(await api.storage?.get('options')) };
render(config);

input.addEventListener('change', () => {
    config.duration = Number(input.value);
    api.storage?.set('options', config);     // fire and forget
});
```

Spread your saved values **over** your defaults, as above: a setting you add
in a later version is simply absent from an old record, and the default
fills it in.

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

- `await` each `on()` — two unawaited subscriptions to the same type race
  and the first callback is lost.
- Your own writes fire `history:update` too, and `setSelection` fires the
  selection event — a callback that writes or selects every time loops.
- **Never write from a `timeUpdate` callback.** While the clock is loaded,
  a document write re-poses the canvas and fires `timeUpdate` again.

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
--sshow-scrollbar-size        6px
--sshow-scrollbar-radius      3px
```

Scrollbars come styled to match the editor; the injected rules sit before
yours, so your own `::-webkit-scrollbar` rules win. Nothing else is
injected — style your own `body`.

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

## Keyboard

Keys your screen does not claim go on to the editor, so every canvas
shortcut fires while your panel has focus: Ctrl/Cmd+Z, Delete/Backspace
(deletes the user's selection), arrow keys (nudge it), tool letters, Enter
(edits the selected text, path, or image), Esc, Tab (cycles Design →
Animation → Interaction mode), and Space (hold to pan; in Animation mode a
tap plays or pauses). Outside a text field, Tab and Space never reach your
controls: Tab does not move focus between them, and Space does not press a
focused button.

- A focused `<input>` (any type), `<textarea>`, or contenteditable keeps
  every key. A `<select>` or a button does not: arrow keys on a focused
  `<select>` change its option **and** nudge the user's selection.
- To keep a key, call `event.stopPropagation()` (your control keeps its
  own behavior) or `event.preventDefault()` (it does not) — in a listener
  on the element, on `document`, or on `window` with `{ capture: true }`.
  The SDK's relay is a `window` listener registered before your scripts,
  so a plain `window` listener of yours runs too late.

## Sandbox and limits

- The screen runs in `sandbox="allow-scripts"` with CSP
  `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval';
  style-src 'unsafe-inline'; img-src data: blob:; font-src data:` —
  **all network is blocked**, both ways: no `fetch`, XHR, or WebSocket, not
  even to a `data:` or `blob:` URL, and no `data:`/`blob:` audio or video.
  Inline everything; images as `data:`/`blob:`, fonts as `data:` only.
  WebAssembly compiles (codecs, solvers); `eval` and `new Function` do
  not.
- **One HTML file.** Only `plugin.json`, the `main` document, and the icon
  are ever read out of the package — sibling scripts, styles, or images
  in the zip are never served.
- One plugin runs at a time; opening another (or closing the panel)
  deactivates yours and tears down listeners and the iframe. Nothing in
  memory survives a close — keep settings in [storage](#storage) and read
  everything else from the document.
- Plugins never serialize into the `.sshow` document. Objects you create
  are ordinary document objects; the document opens fine without the
  plugin.
- Package caps: ≤ 64 zip entries, ≤ 5MB per file (uncompressed), and ≤
  10MB per package — the packer and the server check all three; the editor
  checks the entry count and the size of the files it reads. ≤ 10MB per
  registered asset.
