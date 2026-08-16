# Action Reference — `document.applyActions`

Every action is `{ op, …fields }`. Malformed actions land in `skipped`
with a reason; valid ones commit atomically as one undo step.

## Contents

- [The 19 ops](#the-19-ops)
- [Per-op fields](#per-op-fields)
- [`set` keys and merge semantics](#set-keys-and-merge-semantics)
- [Normalization bridges](#normalization-bridges)
- [Recipes from the official demo plugins](#recipes-from-the-official-demo-plugins)

## The 19 ops

| Domain | Ops |
|---|---|
| Objects | `create_object` `update_object` `delete_object` `duplicate_object` `move_object` `group_objects` `ungroup` `convert_to_path` |
| Scenes | `create_scene` `update_scene` `delete_scene` `duplicate_scene` `move_scene` `set_scene_size` |
| Variables | `create_variable` `update_variable` `delete_variable` `move_variable` |
| Document | `set_document` |

## Per-op fields

`sceneId` omitted on any object/scene op means the **active scene**.

| Op | Required | Optional | Notes |
|---|---|---|---|
| `create_object` | `type`, `config` | `sceneId`, `options` | `type` ∈ `rect` `circle` `path` `text` `image` `video` `audio` `group` `frame`. Give `config.id` your own id to target it from later actions in the same batch. `options.parentObjectId` creates inside a group/frame; `options.index` sets list position |
| `update_object` | `id`, `set` | `sceneId` | see set keys below |
| `delete_object` | `id` | `sceneId` | stale id → skipped |
| `duplicate_object` | `id` | `sceneId`, `options` | |
| `move_object` | `id` | `sceneId`, `options` | `options.parentObjectId` reparents into a container; `options.index` reorders |
| `group_objects` | `ids` (≥ 2) | `config`, `sceneId` | ids may include pending in-batch ids |
| `ungroup` | `id` | `sceneId` | |
| `convert_to_path` | `id` | `sceneId` | |
| `create_scene` | `config` | `options` | `config.id` self-assign supported |
| `update_scene` | `set` | `sceneId` | |
| `delete_scene` / `duplicate_scene` | — | `sceneId` | defaults to active scene |
| `move_scene` | `sceneId`, `newIndex` | | |
| `set_scene_size` | `size: { width, height }` | | canvas size is document-global |
| `create_variable` | `config` | `options` | |
| `update_variable` | `variableId`, `set` | | |
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
| `transform` `size` `data` `layout` | **Partial merge** — only the keys you send change |
| `style` `distort` | **Wholesale replace** — always send the complete value (`style` = full `{ fills, strokes, effects }`) |
| `motion` | **Per-sub-container** — a sent `animations` map replaces all animations but keeps `transitions`, and vice versa. To edit one keyframe: read the whole sub-container from a snapshot, modify, send it back whole |

## Normalization bridges

- `transform.rotate` (**degrees**) is converted to `rotation` (**radians**)
  for you. A raw `transform.rotation` you send is taken as radians as-is.
  Motion-track rotation values are radians (engine units).
- Style paints with a `color` but missing `type` default to `'solid'`;
  invalid effects entries are dropped.
- Literal `\n` / `\t` inside `data.text` become real newlines/tabs.

## Recipes from the official demo plugins

These three ship with SSHOW and are the canonical SDK usage patterns.

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
        data: { text: label, fontSize: 16, textAlign: 'center', autoSize: true },
        transform: { x: centerX, y: labelY, anchorX: 0.5, anchorY: 0 }
    } }
]);
await api.document.applyActions(actions, 'Chart');   // whole chart = one undo
```

### Text sizing modes (dummy-text)

```js
// Title — box grows with the text:
{ data: { text, fontSize: 40, autoSize: true } }

// Body copy — wraps inside a fixed box:
{ data: { text, fontSize: 16, autoSize: false }, size: { width: 360, height: 120 } }
```

Offset repeated inserts (`x: 120 + n * 24, y: 120 + n * 24`) so stacked
results stay visible.

### Motion read-modify-write (keyframe-stagger)

The shape of `motion.animations` and the whole-container write-back:

```js
// animations = { <name>: { …clock, keyframes: { <track>: [{ time, …value }, …] } } }
const shifted = Object.fromEntries(Object.entries(animations).map(([name, animation]) => [name, {
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
