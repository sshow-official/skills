---
name: sshow-project-builder
description: >-
  Builds SSHOW projects — multi-scene .sshow documents with design, text,
  images, video, audio, and motion — by writing action-batch JSON that a
  bundled runner compiles through the real engine. Use when the user wants
  to create an SSHOW presentation, deck, or story, turn an outline or brief
  into a .sshow file, or bring AI-generated content into SSHOW (s.show).
metadata:
  author: SSHOW
---

# Building SSHOW Projects

A project build is a folder of action files plus the assets they reference,
compiled into a `.sshow` file by the bundled runner:

```
my-deck/
├─ 01-cover.json      — one action file per scene, applied in filename order
├─ 02-features.json
├─ 03-closing.json
└─ assets/            — images/video/audio the actions reference
```

```bash
node scripts/build.mjs my-deck/ --out out/my-deck.sshow
```

You never write the `.sshow` container, serialized document JSON, asset
hashes, or thumbnails — the runner drives the real SSHOW engine (headless
Chromium) through the same action compiler the editor's AI panel, the
Studio MCP server, and plugins use, and the engine packs the file. You
write **actions**; everything downstream is engine-guaranteed.

## The action document

Each file is one atomic batch in the engine's `apply_actions` vocabulary:

```json
{
    "actions": [
        { "op": "create_scene", "config": { "id": "s1", "name": "Cover" } },
        { "op": "create_object", "sceneId": "s1", "type": "text", "config": { "...": "..." } }
    ]
}
```

- Op list and exact parameter shapes: [references/actions.md](references/actions.md).
  Values, units, defaults, and design rules: [references/guide.md](references/guide.md)
  — read the sections relevant to what you are building, and follow its
  text formulas and motion budgets exactly. The F-numbering has gaps and
  jumps (there is no F12; F13 comes last) — follow the rules as written,
  not the count. Where the type scale conflicts (F6's derived caps vs
  F1's ranges), the F1 ranges and the example deck win.
- **The document boots empty — there are no scenes.** Create every scene
  with `create_scene` and a self-assigned `config.id` (`"s1"`, `"s2"`, …),
  and put that id in `sceneId` on **every** object op. An object op without
  `sceneId` targets the active scene — in a multi-file build that is a bug
  waiting to happen, so always be explicit.
- Self-assigned ids (`config.id` on scenes and objects) can be targeted by
  later actions in the same file and in later files.
- One scene per file keeps each file small enough to write reliably and
  makes build errors easy to localize. Order is the filename sort
  (`01-`, `02-`, …). Document-level ops (`set_document`, `set_scene_size`)
  go once, at the top of the first file.

## Assets

Reference binaries by `src` — media objects (`data.src` of image/video/
audio) and image fills:

- `"assets/logo.png"` — path relative to the actions folder, or
- `"https://…/photo.jpg"` — fetched at build time.

The runner ingests the bytes into the engine's content-addressed store and
rewrites every reference to an `asset://` uri, so the `.sshow` is fully
self-contained (the same bytes referenced twice are stored once). Never
write `asset://` uris yourself. Keep individual media files sensible
(tens of MB, not hundreds) — everything is embedded in the output file.

## Workflow

1. **Author** the action files, one scene per file, with the schema and
   guide open. Design to the guide's §11 defaults unless the user gave a
   direction (palette, spacing, hierarchy, whitespace).
2. **Build**: `node scripts/build.mjs <dir> --out <file>.sshow`.
3. **Fix rejections.** Any malformed action fails the build with a
   per-action reason (`file: op — reason`). Fix exactly what each reason
   names and rebuild. Zero rejections is the bar — the runner writes no
   output otherwise.
4. **Look at the screenshots.** The runner writes one PNG per scene into
   a `scenes/` folder beside the output file (fixed names — give each
   deck its own `--out` folder or a rebuild overwrites them). They render
   the **authored document state**: entrance transitions and timeline
   tracks are not applied, so an object that fades in from opacity 0
   still shows fully. Actually open and inspect them — overflowing text,
   overlaps, and bad contrast pass validation but fail the eye. Fix,
   rebuild, look again.
5. **Deliver** the `.sshow` (see below).

## Rules that break projects silently

1. **Text needs explicit `anchorX`/`anchorY` matching its alignment —
   always** (guide F11/F14), and `lineHeight` set alongside every
   `fontSize` (F1). Centered text without `anchorX: 0.5` lands
   left-shifted by half its width.
2. **Body copy in a box must be `autoSize: false` + explicit `size`**;
   standalone titles/labels `autoSize: true` without `size` (guide §4
   text decision rule). autoSize text never wraps — break lines with `\n`.
3. **`style` replaces wholesale** — always send the full
   `{ fills, strokes, effects }`. `transform`, `size`, `data`, and
   `layout` merge per key.
4. **`motion` merges per sub-container** — a sent `animations` map
   replaces the whole animations map but keeps `transitions`, and vice
   versa.
5. **Rotation units**: `set.transform.rotateX/rotateY/rotateZ` are degrees
   (auto-converted; `rotate` is the pre-3D spelling of `rotateZ`), while
   motion-track `transform.rotate*` values are raw radians.
6. **`(x, y)` is where the anchor lands** — with the default 0.5/0.5
   anchor it is the object's center, not its top-left.
7. **Fonts come from the catalog** by `fontFamily` name (auto-loaded and
   embedded). A family the catalog cannot resolve renders as a system
   fallback — the build warns; treat the warning as an error unless the
   fallback was intended.
8. **Respect the motion budgets** (guide §12 and §10 restraint): ≤6
   animated objects per scene, 2–3 keys per track, one curve family per
   deck, reveals ≤ 1500ms. For card grids, stagger the card surfaces
   only and let their text ride the scene transition (as the example
   does) — animating every child blows the budget. More motion reads as
   less quality.
9. **Interaction is out of scope** — `interaction` is a reserved stub in
   the engine; do not author it.

## Runner requirements

- Node 20+ and Playwright with Chromium
  (`npm i playwright && npx playwright install chromium`).
- The engine ships with the skill (`engine/sshow.min.js.gz`, the same
  build the references were extracted from) — no network is needed for
  the engine. Network is used only for the font catalog and remote
  (https) assets: without it, unresolved fonts render as system
  fallbacks (the build warns) and remote assets fail the build. Pass
  `--bundle <path-or-url>` to build against a different engine build.

## If the environment cannot run the runner

Sandboxed agent environments sometimes cannot install Chromium. Do not
improvise a different pipeline — package the build for the user to run
locally instead: put your deck folder, the skill's `scripts/` and
`engine/` folders (side by side, so `scripts/` finds `../engine/`), and
a `package.json` with `{ "dependencies": { "playwright": "^1" } }` into
one directory, then tell the user to run:

```bash
npm install && npx playwright install chromium
node scripts/build.mjs <deck-dir> --out out/<name>.sshow
```

## Getting the .sshow into SSHOW

- **SSHOW Studio (desktop)**: File → Open, or double-click the `.sshow` —
  edits locally, no account needed.
- **s.show (web/cloud)**: dashboard → New project → upload the `.sshow`
  (also available in Studio's dashboard) — creates a cloud project with
  the file's scenes, assets, and thumbnails intact.

## References

- [references/actions.md](references/actions.md) — the machine contract:
  all ops and the exact `apply_actions` parameter schema (generated from
  the engine, do not edit).
- [references/guide.md](references/guide.md) — the engine's authoring
  reference: types, styles, effects, text formulas, variables, motion
  recipes, timeline tracks, design defaults (generated from the engine).
- [examples/launch-deck/](examples/launch-deck/) — a working three-scene
  deck: document setup, gradients, an image asset used twice, per-object
  transitions, and a staggered timeline. Build it as a smoke test.
