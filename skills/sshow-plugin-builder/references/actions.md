# Action Reference — `document.applyActions`

Every action is `{ op, …fields }`. Malformed actions land in `skipped`
with a reason; valid ones commit atomically as one undo step.

This file covers the ops and how they merge. What goes **inside** a
config — object types and their `data`, paints and effects, the text
formulas, transitions, timeline tracks, interaction rules — is the engine's
own guide, [guide.md](guide.md) (generated from the engine, the same text
its AI panel and MCP server serve). The guide speaks to tool-calling
agents: "the state" is your `getState` and `get_object` is `getObject`.
Its `control_show` and import tool have no plugin equivalent, and where it
says asset ids cannot be minted, `assets.register` mints them.

## Contents

- [The 19 ops](#the-19-ops)
- [Per-op fields](#per-op-fields)
- [`set` keys and merge semantics](#set-keys-and-merge-semantics)
- [Normalization bridges](#normalization-bridges)
- [Media and interactions](#media-and-interactions)
- [Recipes](#recipes)

## The 19 ops

| Domain | Ops |
|---|---|
| Objects | `create_object` `update_object` `delete_object` `duplicate_object` `move_object` `group_objects` `ungroup` `convert_to_path` |
| Scenes | `create_scene` `update_scene` `delete_scene` `duplicate_scene` `move_scene` `set_scene_size` |
| Variables | `create_variable` `update_variable` `delete_variable` `move_variable` |
| Document | `set_document` |

## Per-op fields

`sceneId` omitted on any object/scene op means the **active scene** — the
one active when the call is read, before any of it runs.

| Op | Required | Optional | Notes |
|---|---|---|---|
| `create_object` | `type`, `config` | `sceneId`, `options` | `type` ∈ `rect` `circle` `path` `text` `image` `video` `audio` `group` `frame`. Give `config.id` an alias of your own to target it from later actions in the same call — the engine assigns the real id and `applyActions` returns the binding. `options.parentObjectId` creates inside a group/frame; `options.index` sets list position |
| `update_object` | `id`, `set` | `sceneId` | see set keys below |
| `delete_object` | `id` | `sceneId` | stale id → skipped |
| `duplicate_object` | `id` | `sceneId`, `options` | `options`: `index` (default: just above the source), `parentObjectId` (omitted = the source's parent, `null` = scene root), `name`. The copy's id is not returned |
| `move_object` | `id` | `sceneId`, `options` | `options.to`: `'front'` \| `'back'` \| `'forward'` \| `'backward'` (the last sibling draws on top). Or `index` + `parentObjectId` + `preserveWorldPosition` (default `true`) — **`parentObjectId` defaults to the scene root**, so an index-only move pulls a nested child out of its container; pass its current parent to reorder in place. `to` skips an object this same call created |
| `group_objects` | `ids` (≥ 2) | `config`, `sceneId` | ids may include this call's aliases; `config.id` aliases the new group |
| `ungroup` | `id` | `sceneId` | |
| `convert_to_path` | `id` | `sceneId` | |
| `create_scene` | `config` | `options` | `config.id` aliases the scene for this call, same as `create_object`. A scene is created empty (`config.objects` is refused) and becomes the active scene unless `options.active: false` |
| `update_scene` | `set` | `sceneId` | |
| `delete_scene` / `duplicate_scene` | — | `sceneId` | defaults to the active scene — `delete_scene` without `sceneId` deletes what the user is looking at. The copy is named `'<name> (Copy)'` and becomes active |
| `move_scene` | `sceneId`, `newIndex` | | |
| `set_scene_size` | `size: { width, height }` | | canvas size is document-global |
| `create_variable` | `config` | `options` | `config`: `id` (alias), `name`, `type` (`'string'` \| `'color'` \| `'number'` \| `'boolean'`), `value`, `description` |
| `update_variable` | `variableId`, `set` | | keys: `name` `description` `type` `value` |
| `delete_variable` | `variableId` | | |
| `move_variable` | `variableId`, `newIndex` | | |
| `set_document` | `set` | | keys: `name` `description` `notes` |

## `set` keys and merge semantics

Valid `update_object.set` keys: `name` `description` `size` `transform`
`distort` `layout` `style` `opacity` `blendMode` `locked` `visible`
`motion` `interaction` `data`.
Valid `update_scene.set` keys: `name` `description` `notes` `style`
`visible` `motion` `interaction` `data` `clip`.
An unknown set key skips the whole action.

Three merge behaviors — getting these wrong corrupts user work:

| Keys | Behavior |
|---|---|
| object `transform` `size` `data` `layout` | **Partial merge** — only the keys you send change (an array value such as `points` or `radius` is replaced whole) |
| `style` `distort` `interaction`, scene `data` | **Wholesale replace** — always send the complete value (`style` = full `{ fills, strokes, effects }`; `interaction` = every rule the node keeps) |
| `motion` | **Per-sub-container** — a sent `animations` map replaces all animations but keeps `transitions`, and vice versa. To edit one keyframe: read the whole sub-container from a snapshot, modify, send it back whole |

## Normalization bridges

- `transform.rotateX` / `rotateY` / `rotateZ` in a `config` or `set` are
  **degrees**, converted to radians for you; `rotate` is the pre-3D
  spelling of `rotateZ`. Reads return radians, so convert a value you read
  before sending it back. Motion-track `transform.rotate*` values are
  radians (engine units).
- Style paints with a `color` but no valid `type` become `'solid'`; a
  paint with neither is dropped, and so is an invalid effect.
- Literal `\n` / `\t` inside `data.text` become real newlines/tabs.

These bridges cover the top-level `config` / `set` only. Children written
inline in a group or frame `config` pass through as they are: their angles
are radians, and every paint needs its `type` (a read omits `'solid'`) or
the whole call rejects.

## Media and interactions

- **Media sources are project assets.** `data.src` (image, video, audio)
  and an image fill's `src` take only an `asset://` uri the project holds —
  the one `assets.register` returns, or one read from the document. A
  `data:` URI or a URL there is skipped with its reason.
- **Rules** (`interaction.rules` on a scene or an object — triggers,
  conditions, actions; guide §13) are written with `config.interaction` or
  `set.interaction`, which replaces the node's rules: read them with
  `getObject` / `getState` and send back every one you keep. A rule's
  `sceneId`, `declarerId`, and `variableId` must name something that exists
  — a live id, or an alias declared earlier in the same call; a rule that
  names nothing is skipped. Plugins cannot read variables, so a rule can
  reference only a variable your plugin created (its id comes back in
  `ids.variables`).
- **Web requests stay the user's.** A `fetch` action reads back masked and
  is written by hand in the Interactions panel. Send each one back where
  you read it (same rule `id`, same position in `actions`): the stored
  request is kept whatever you send. Add none, and don't move one — a
  fetch at a position where the node holds none skips the action.

## Recipes

Patterns from the plugins SSHOW tests its SDK with (chart, dummy-text,
keyframe-stagger). The official plugins users install, such as
`app.sshow.physics` and `app.sshow.typer`, come from the editor's plugin
catalog.

### Batch creation with layout math (chart)

Read canvas metrics from state, compute geometry, emit many
`create_object` actions, commit once:

```js
const { canvas } = await api.document.getState();
const actions = rows.flatMap(({ label, value }, index) => [
    { op: 'create_object', type: 'rect', config: {
        name: `chart-bar-${label}`,
        size: { width: barWidth, height },
        transform: { x: centerX, y: baseY - height, anchorX: 0.5, anchorY: 0 },
        style: { fills: [{ type: 'solid', color: '#8A8A8E' }], strokes: [], effects: [] }
    } },
    { op: 'create_object', type: 'text', config: {
        name: `chart-label-${label}`,
        data: { text: label, fontSize: 16, lineHeight: 24, textAlign: 'center', autoSize: true },
        transform: { x: centerX, y: labelY, anchorX: 0.5, anchorY: 0 }
    } }
]);
await api.document.applyActions(actions, 'Chart');   // whole chart = one undo
```

### Text sizing modes (dummy-text)

Every text sets `lineHeight` with its `fontSize`, and an anchor that
matches its alignment (guide F1, F11, F14):

```js
// Title — box grows with the text:
{ data: { text, fontSize: 40, lineHeight: 50, autoSize: true },
  transform: { x, y, anchorX: 0, anchorY: 0 } }

// Body copy — wraps inside a fixed box:
{ data: { text, fontSize: 16, lineHeight: 24, autoSize: false },
  size: { width: 360, height: 120 }, transform: { x, y, anchorX: 0, anchorY: 0 } }
```

Offset repeated inserts (`x: 120 + n * 24, y: 120 + n * 24`) so stacked
results stay visible.

### Motion read-modify-write (keyframe-stagger)

The shape of `motion.animations` and the whole-container write-back:

```js
// animations = { <name>: { …clock, keyframes: { <track>: [{ time, …value }, …] } } }
const shifted = Object.fromEntries(Object.entries(animations).map(([name, animation]) => [name, animation.state ? animation : {
    ...animation,
    keyframes: Object.fromEntries(Object.entries(animation.keyframes ?? {}).map(
        ([track, keys]) => [track, keys.map((key) => ({ ...key, time: key.time + delay }))]))
}]));

// Sending only `animations` leaves `transitions` intact (per-sub-container merge):
{ op: 'update_object', id: object.id, set: { motion: { animations: shifted } } }
```

Carry **every** animation and **every** keyframe through, even when you
only change `time` — the sub-container you send replaces that sub-container
entirely.

Keys moved past the end of their clock never play. An object's `default`
keys ride the scene's clock, declared in the active scene's
`motion.animations.default` from `getState` (its `duration` defaults to
5000 ms) — lengthen it with `update_scene` `set.motion`, resending the
scene's whole `animations` map. A frame's **named** animation with a `duration` is that
frame's own clock (guide §10): keep its `stops`, `workArea`, `autoplay`,
and `loop`, and lengthen its `duration` the same way. An entry marked
`state` is a pose the frame rests in or switches to, not an entrance, so
the snippet carries states through unshifted.
