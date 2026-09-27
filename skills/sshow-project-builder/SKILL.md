---
name: sshow-project-builder
description: >-
  Builds SSHOW projects — multi-scene .sshow documents with design, text,
  images, video, audio, motion, and interactivity (buttons, hover states,
  quizzes, clickable prototypes) — by writing action-batch JSON that a
  bundled runner compiles through the real engine. Use when the user wants
  to create an SSHOW presentation, deck, story, or interactive prototype,
  turn an outline or brief into a .sshow file, or bring AI-generated
  content into SSHOW (s.show).
metadata:
  author: SSHOW
---

# Building SSHOW Projects

A project build is a folder of action files plus the assets they reference,
compiled into a `.sshow` file by the bundled runner:

```
my-deck/
├─ 01-cover.json      — one action file per scene, in filename order
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

Each file holds actions in the engine's `apply_actions` vocabulary, and the
runner applies **every file, in filename order, as one atomic batch**:

```json
{
    "actions": [
        { "op": "create_scene", "config": { "id": "cover", "name": "Cover" } },
        { "op": "create_object", "sceneId": "cover", "type": "text", "config": { "...": "..." } }
    ]
}
```

- Op list and exact parameter shapes: [references/actions.md](references/actions.md).
  Values, units, defaults, and design rules: [references/guide.md](references/guide.md)
  — read the sections relevant to what you are building, and follow its
  text formulas and motion budgets exactly. The F-numbering has gaps and
  jumps (there is no F12; F13 comes last) — follow the rules as written,
  not the count.
- **The document boots empty — there are no scenes.** Create every scene
  with `create_scene` and a `config.id` you choose, and put that alias in
  `sceneId` on **every** object and scene op. An op without `sceneId` is
  refused: the build reads every action before any scene exists, so there
  is no active scene to fall back on.
- **An alias is a word** — `"cover"`, `"pricing"`, `"cta"` — never an
  engine-shaped id like `s2` or `o7`: the engine mints exactly those ids as
  it builds, so such an alias is refused once that id is taken, or quietly
  points at whatever the engine mints it for later. The real ids are always
  the engine's; aliases only name things inside the build.
- **An alias works from the action that declares it to the end of the
  build** — later in the same file or in any later file, never before. A
  reference that points forward (a cover button that jumps to the last
  slide) goes in a final file such as `99-links.json`, as an `update_object`
  with `set.interaction`, once every scene exists.
- **Each word names one thing for the whole build.** Declare it once — a
  second `"title"` in another file is refused — and never give a scene,
  an object, and a variable the same word: rules look every alias up in
  one table, so a clash quietly points a reference at the wrong one.
- One scene per file keeps each file small enough to write reliably and
  makes build errors easy to localize. Order is the filename sort
  (`01-`, `02-`, …). Document-level ops (`set_document`, `set_scene_size`)
  and variables (`create_variable`) go once, at the top of the first file.
- Build each object **whole in its `create_object`** — style, data, motion,
  and rules all in `config` — instead of creating it and updating it
  after. Round `x`, `y`, and `size` values to multiples of 8 (4 for
  fine-tuning).

## Assets

Reference binaries by `src` — media objects (`data.src` of image/video/
audio) and image fills:

- `"assets/logo.png"` — path relative to the actions folder,
- `"https://…/photo.jpg"` — fetched at build time (a URL without a file
  extension is typed by what the server sends), or
- `"data:image/png;base64,…"` — decoded.

The runner is the import step: it ingests the bytes into the engine's
content-addressed store and rewrites every reference to an `asset://` uri.
That is what satisfies the guide's rule that `src` must be the `asset://`
of a project asset — never write `asset://` uris yourself. The `.sshow` is
fully self-contained (the same bytes referenced twice are stored once), so
keep individual media files sensible (tens of MB, not hundreds).

**Give every image and video a `size` with its asset's aspect ratio.** The
engine stretches media to its box — there is no fit or cover — and an
omitted `size` is 100×100. The build warns about each stretched one and
names the size that keeps the ratio.

## Interactivity

Rules (guide §13) make a deck clickable: buttons that jump between slides,
hover lifts, toggles, quizzes that count into variables, keyboard
shortcuts. A rule lives in `interaction.rules` on a scene or an object:

- **A button is a frame** that holds its label as a child
  (`options.parentObjectId`) and the click rule. Rules for empty space and
  keys go on the scene. In a show a click no rule takes advances the deck,
  so a clickable prototype gives every scene the empty click rule (guide
  §13, Prototype).
- `config.interaction` on a create, or `set.interaction` on an update,
  **replaces** that node's rules — give each node all of its rules in one
  place.
- A rule's `sceneId` and `variableId` name an alias declared earlier in
  the build (see above); a rule naming an alias not yet declared fails the
  build. An object a rule names (a `media` target, a `declarerId` frame)
  must be in the rule's own scene — SSHOW drops the rest when the file
  opens.
- **An invisible hotspot is a rect with `fills: []`.** An object at
  opacity 0, or hidden, never receives a click in a show.
- `fetch` actions are refused here — the user adds web requests in SSHOW's
  Interactions panel.
- **Rules run only in a show** (Play, a shared view, or the editor's
  Preview tool), never while editing. The runner checks each rule's shape
  and the ids it names — not that a `play` / `stop` / `setState` name
  matches an animation the frame declares — and it cannot click anything;
  the screenshots show none of it. When you deliver an interactive deck,
  tell the user to try it with Play.

## Workflow

1. **Check the environment**: `node scripts/build.mjs --check`. It probes
   node 20+, playwright, and a real Chromium launch. Settle this before
   authoring anything — see "Runner requirements" below for what to do
   when it fails.
2. **Author** the action files, one scene per file, with the schema and
   guide open. Design to the guide's §11 defaults unless the user gave a
   direction (palette, spacing, hierarchy, whitespace).
3. **Build**: `node scripts/build.mjs <dir> --out <file>.sshow`.
4. **Fix rejections.** Any malformed action fails the build with a reason
   that names its file and position (`02-features.json #7: create_object
   — reason`). Fix exactly what each reason names and rebuild. Zero
   rejections is the bar — the runner writes no output otherwise. A
   `sceneId` that names no scene, or that is not the scene holding the
   object an action targets, stops the build with the engine's own message
   instead — it names the alias involved; check the `sceneId` of the
   actions that use it.
5. **Look at the screenshots.** The runner writes one PNG per scene into
   a `scenes/` folder beside the output file (fixed names — give each
   deck its own `--out` folder or a rebuild overwrites them). They render
   the **authored document state**: entrance transitions, timeline
   tracks, and frame states are not applied, so an object that fades in
   from opacity 0 still shows fully. Actually open and inspect them —
   overflowing text, overlaps, and bad contrast pass validation but fail
   the eye. Fix, rebuild, look again. Treat every build warning (a
   stretched image, a font that did not resolve) as something to fix.
6. **Deliver** the `.sshow` (see below).

## Rules that break projects silently

1. **Text needs explicit `anchorX`/`anchorY` matching its alignment —
   always** (guide F11/F14), and `lineHeight` set alongside every
   `fontSize` (F1). Left-aligned text left on the default 0.5 anchor
   drifts about (-50, -25); centered text given `anchorX: 0` lands
   right-shifted by half its width.
2. **Body copy in a box must be `autoSize: false` + explicit `size`**;
   standalone titles/labels `autoSize: true` without `size` (guide §4
   text decision rule). autoSize text never wraps — break lines with `\n`.
3. **`style`, `distort`, and `interaction` replace wholesale** — always
   send the full value (`style` = `{ fills, strokes, effects }`).
   `transform`, `size`, `data`, and `layout` merge per key.
4. **`motion` merges per sub-container** — a sent `animations` map
   replaces the whole animations map but keeps `transitions`, and vice
   versa.
5. **Rotation units**: `transform.rotateX/rotateY/rotateZ` in a create's
   `config` or an update's `set` are degrees (auto-converted; `rotate` is
   the pre-3D spelling of `rotateZ`), while motion-track
   `transform.rotate*` values are raw radians.
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

## Runner requirements

- Node 20+, the `playwright` package, and a chromium runtime. Probe with
  `node scripts/build.mjs --check` — it reports which browser it resolved.
  The runner tries playwright's own chromium first, then an installed
  Chrome, then Edge, so a machine that already has Chrome needs no browser
  download at all (`npm i playwright` is enough). Only when none of the
  three is present does it ask for `npx playwright install chromium` —
  a few hundred MB. In a desktop session (Cowork, or any session running
  on the user's own computer) ask before downloading it; it is their disk.
  If they decline, or the environment cannot install a browser at all,
  take the packaged handoff below instead.
- The engine ships with the skill (`engine/sshow.min.js.gz`, the same
  build the references were extracted from) — no network is needed for
  the engine. Network is used only for the font catalog and remote
  (https) assets: without it, catalog fonts render as system fallbacks
  (the build warns) and remote assets fail the build. Pass
  `--bundle <path-or-url>` to build against a different engine build.

## If the runner cannot be installed

`--check` fails and installing playwright is not an option (a sandbox with
no network, or the user declined). Do not improvise a different pipeline
and do not author a deck you cannot build — package the build for the user
to run themselves instead: put your deck folder, the skill's `scripts/` and
`engine/` folders (side by side, so `scripts/` finds `../engine/`), and
a `package.json` with `{ "dependencies": { "playwright": "^1" } }` into
one directory, then tell the user to run:

```bash
npm install
node scripts/build.mjs --check   # if this fails: npx playwright install chromium
node scripts/build.mjs <deck-dir> --out out/<name>.sshow
```

## Getting the .sshow into SSHOW

- **SSHOW Studio (desktop)**: File → Open, or double-click the `.sshow` —
  edits locally, no account needed.
- **s.show (web/cloud)**: dashboard → New project → upload the `.sshow`
  (also available in Studio's dashboard) — creates a cloud project with
  the file's scenes, assets, and thumbnails intact.
- **PDF, PowerPoint, video, and other formats** are exported from SSHOW
  once the file is open — the runner writes `.sshow` only.

If this agent is connected to SSHOW itself (the SSHOW connector), its
`apply_actions` takes the same action vocabulary straight into a project
the user has open. There each call is its own batch — an alias lasts one
call, and later calls use the `ids` it returns — and media goes through
its `import_asset` first, whose `asset://` is the `src`. Its
`control_show` / `simulate_event` can try the rules.

## References

- [references/actions.md](references/actions.md) — the machine contract:
  all ops and the exact `apply_actions` parameter schema (generated from
  the engine, do not edit).
- [references/guide.md](references/guide.md) — the engine's authoring
  reference: types, styles, effects, text formulas, variables, motion
  recipes, timeline tracks, frames and pin layout, 3D and distort,
  interactions, design defaults (generated from the engine).
- [examples/launch-deck/](examples/launch-deck/) — a working three-scene
  deck: document setup, word aliases, gradients, an image asset used
  twice, scene transitions, a staggered timeline, and a frame button
  whose rules jump back to the cover (an alias from another file) and lift
  on hover. Build it as a smoke test.
