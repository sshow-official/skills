---
name: sshow-dynamic-builder
description: >-
  Builds SSHOW dynamic packs — GLSL shader paints (animated fills and
  backgrounds for shapes) and effects (filters over an object's own pixels),
  declared in a dynamic.json manifest, compiled and previewed in the real
  engine by a bundled runner, and packaged as a .sshowdynamic zip. Use when
  the user wants to create, modify, test, package, or publish a dynamic pack,
  a shader fill, or a shader effect for SSHOW (s.show), or mentions
  .sshowdynamic files, dynamic.json, dynamicPaint, or dynamicEffect.
metadata:
  author: SSHOW
---

# Building SSHOW Dynamic Packs

A dynamic is a GLSL function the SSHOW editor runs for every pixel: a
**paint** draws a pattern into a shape's fill or stroke, an **effect**
reworks an object's own pixels. A dynamic pack declares one or more of them
and ships as a `.sshowdynamic` zip:

```
my-pack/
├─ dynamic.json         — manifest: identity + one declaration per dynamic
├─ shaders/<name>.glsl  — each dynamic's shader: the source you edit
└─ icon.png             — listing icon (optional; png/svg/jpg/jpeg/webp)
```

The editor reads shaders only from the manifest. Every build writes each
`shaders/<name>.glsl` into its declaration's `glsl`, so edit the `.glsl`
files and never the copy inside `dynamic.json`. Users find a pack's
dynamics in the editor's Dynamic picker (fills, strokes, effects) and set
their params with controls generated from your declarations.

## Workflow

Work in your own project folder and run the skill's scripts by their path
(`node <skill>/scripts/build.mjs …`); `--out` and the default `out/` are
relative to the folder you run in. Keep packs outside the skill folder.

1. **Check the environment**: `node scripts/build.mjs --check`. It probes
   node 20+, python3, playwright, and a real Chromium launch — settle this
   before writing shaders (see "Runner requirements").
2. **Scaffold** from `examples/starter/` (one paint, one effect): copy the
   folder, then change the `id`, `name`, `author`, `description` (and their
   `_localized` copies) and the declarations. Every `shaders/*.glsl` must
   match a declaration by name — rename or delete the starter's two — and
   the copy still carries the Starter's `icon.png`: replace it, or build
   with `--icon`.
3. **Write the shaders** to "The shader" below; the full contract, the
   GLSL dialect, and recipes are in
   [references/shaders.md](references/shaders.md).
4. **Build**: `node scripts/build.mjs my-pack/ --out out/my-pack/<id>-<version>.sshowdynamic`
   (the default `--out` is `out/<id>-<version>.sshowdynamic`).
5. **Fix every `✗`** and rebuild. Each shader error is named at its line
   in `shaders/<name>.glsl`, every dynamic in one run; the runner writes
   no package until all of them compile and draw, and a failed build
   removes the one an earlier build left at `--out`.
6. **Look at the previews.** `previews/<name>.png` beside the package
   holds one sheet per dynamic, over a checkerboard so transparency shows:
   - a paint fills a 1280×720 box (wider than the 1024 px a paint draws
     at — see rule 4) and a 720×720 one; an effect works over a 1280×720
     test card and over a line of text (thin strokes, holes, separate
     shapes);
   - at 0, 0.35 and 1.3 s if animated (the subjects are at 2 s);
   - every number param at its min and at its max, and every boolean
     flipped — colours stay at their defaults;
   - the picker tile, as the editor shows it (at 2 s).

   Open every sheet — a build that passes compiles and draws something;
   only your eye tells whether it looks right. Fix every `⚠` too. Give
   each pack its own `--out` folder: the sheets have fixed names.
7. **Icon**: add `--icon` to draw `icon.png` from the picker tiles of the
   first four dynamics, two by two, as SSHOW's own packs do (a pack of
   fewer shows its first) — or ship your own artwork. Make the frame at
   2 s a good one: the tile and the icon show it.
8. **Try it in the editor and publish** —
   [references/publishing.md](references/publishing.md). For a new version
   of a published pack, build with `--previous <published.sshowdynamic>`.

## Manifest (`dynamic.json`)

```json
{
    "id": "com.example.starter",
    "name": "Starter",
    "name_localized": { "ko": "시작" },
    "version": "1.0.0",
    "api": 1,
    "description": "Sliding stripes for fills and a hard shadow for any object.",
    "author": "SSHOW",
    "icon": "icon.png",
    "dynamics": [
        {
            "name": "stripes",
            "label": "Stripes",
            "label_localized": { "ko": "줄무늬" },
            "slot": "paint",
            "animated": true,
            "params": [
                { "key": "color1", "label": "Color 1", "type": "color", "default": "#6366f1" },
                { "key": "size", "label": "Size", "type": "number", "default": 24, "min": 4, "max": 200, "step": 1 },
                { "key": "rotation", "label": "Rotation", "type": "number", "default": 45, "min": 0, "max": 360, "step": 1, "unit": "°" }
            ]
        },
        {
            "name": "shadow",
            "label": "Hard Shadow",
            "slot": "effect",
            "padding": { "plus": 0, "scale": { "distance": 1 } },
            "params": [
                { "key": "distance", "label": "Distance", "type": "number", "default": 16, "min": 0, "max": 64, "step": 1 }
            ]
        }
    ]
}
```

Pack fields:

- `id` — lowercase reverse-domain, `[a-z0-9.-]` only, no `..`, ≤ 100 chars.
  Pick a domain you control: the first account to submit an id owns it.
  Never `installed`, `mine`, `submit`, `check` or `builtin`, and leave ids
  under `app.sshow.` to SSHOW.
- `name` (≤ 100), `version` (exact `x.y.z`, strictly higher on every
  submission), `api` (the integer `1`).
- `description` (≤ 2000), `author`, `icon` — optional, but they make the
  listing; always give them for anything you publish.
- `name_localized`, `description_localized`, and each `label_localized`
  below — `{ "ko": "…" }` translations (`ko` or `en`; not `kr`, not
  `ko-KR`). Write the base fields in English.
- Unknown fields are dropped — do not invent any. Leave out `wgsl`: the
  engine draws with WebGL and never reads it.

A declaration (≤ 32 per pack):

| Field | Rule |
|---|---|
| `name` | lower camel case `[a-z][a-zA-Z0-9]*`, ≤ 32 chars, unique in the pack. Documents store it — never rename a published one. |
| `label` | ≤ 48 chars — the name in the picker. |
| `slot` | `"paint"` or `"effect"`. |
| `animated` | `true` when the shader reads `uTime` (default `false`). Only an animated dynamic gets `uTime`, and it redraws every frame. |
| `params` | ≤ 24 controls, below (`[]` for none). |
| `padding` | effects only — how far the effect draws past its object ([shaders.md](references/shaders.md#padding)). |
| `glsl` | written by the build from `shaders/<name>.glsl`. |

A param:

- `key` — lower camel case, ≤ 32 chars, unique in its dynamic. It reaches
  the shader as `u` + the key capitalised: `size` → `uSize`. Not `time`,
  `texture`, `opacity`, `viewportScale`, `inputSize`, `inputPixel`,
  `inputClamp`, `outputFrame`, `globalFrame` or `outputTexture` — the
  engine declares those uniforms itself.
- `type` and `default`:
  - `"number"` → `float`. Needs `default`, `min`, `max` and `step > 0`,
    with `min ≤ default ≤ max`; optional `unit` (≤ 8 chars) after the
    value. The editor holds stored values to `min…max`.
  - `"color"` → `vec3`, each channel 0–1. `default` is `"#rrggbb"`.
  - `"boolean"` → `float`, 1.0 or 0.0 (test `> 0.5`). `default` is
    `true` or `false`.
- `label` (≤ 48) + `label_localized`.
- Reuse the keys and labels SSHOW's own packs use where they fit, so a
  control means the same thing in every pack. Only angles carry a unit:

| Key | Label · `ko` | Usual range · step | Means |
|---|---|---|---|
| `speed` | Speed · 속도 | 0–5 · 0.1 | how fast `uTime` moves it; 0 stops it |
| `scale` | Scale · 배율 | 0.1–5 · 0.05 | the pattern's size; 1 is as designed |
| `size` | Size · 크기 | in pixels | one feature's size |
| `amount` | Amount · 양 | 0–1 · 0.01 | how strongly it applies |
| `angle` | Angle · 각도 | 0–360 · 1, `°` | a direction (effects) |
| `rotation` | Rotation · 회전 | 0–360 · 1, `°` | the pattern's turn (paints) |
| `color` | Color · 색상 | — | the one colour |
| `color1`…`color4` | Color 1 · 색상 1 … | — | a palette, in order |
| `bgAlpha` | BG Alpha · 배경 알파 | 0–1 · 0.01 | the alpha of the background behind a pattern |
| `lightX`, `lightY` | Light X · 광원 X, Light Y · 광원 Y | 0–1 · 0.01 | a light's place, as a fraction of the box |

## The shader

Each `shaders/<name>.glsl` defines its slot's entry function, plus any
helper functions, `const`s, structs or `#define`s it needs above it:

```glsl
vec4 dynamicPaint(vec2 uv)             // slot "paint"
vec4 dynamicEffect(vec2 uv, vec4 src)  // slot "effect"
```

The engine writes the rest of the program around it — precision, every
uniform, and a `main` that calls your function — so the file never holds
`main`, `#version`, `#extension` or `#include` (not even in a comment),
and never declares a uniform.

- **Paint**: `uv` runs 0 → 1 across the object's box, top-left origin,
  y down. In pixels it is `uv * uOutputFrame.zw`. Return the colour
  premultiplied by its alpha; the engine clips it to the shape and applies
  the paint's opacity.
- **Effect**: `src` is the object's own pixel at `uv`, premultiplied. `uv`
  addresses `uTexture`, the object's rendered pixels — read a neighbour
  `px` document pixels away with
  `texture(uTexture, clamp(uv + px * uViewportScale * uInputSize.zw, uInputClamp.xy, uInputClamp.zw))`.
  Return the new pixel, premultiplied; the engine mixes it over `src` by
  the effect's opacity.

What the engine declares for you:

| Uniform | Type | Slot | Meaning |
|---|---|---|---|
| `u<Key>` | `float` / `vec3` | both | each param |
| `uTime` | `float` | animated only | seconds on the engine clock |
| `uOutputFrame` | `vec4` | both | `.zw` = the drawn area in pixels |
| `uInputSize` | `vec4` | both | `.xy` = input texture size in pixels, `.zw` = 1 / that |
| `uInputClamp` | `vec4` | both | valid `uv` range of the input: `.xy` min, `.zw` max |
| `uTexture` | `sampler2D` | effect | the object's own pixels |
| `uViewportScale` | `float` | effect | input pixels per document pixel (the editor's zoom; 1 in exports) |
| `uOpacity` | `float` | effect | the effect's opacity — applied for you |

## Rules that break dynamics silently

1. **GLSL ES 1.00, not 3.00.** The engine compiles your code as WebGL 1
   GLSL; `texture()` works because it maps to `texture2D()`. There is no
   `fwidth`/`dFdx`, `round`, `trunc`, `tanh`, `inverse`, `isnan`, integer
   `%`, `uint`, bit operators, `switch`, array constructors or `while`, and
   no `in` before a parameter (`float f(in vec2 p)` — the engine defines
   `in` as `varying`; write `float f(vec2 p)`). A `for` loop needs a
   constant bound — for a param-driven count, loop to a constant and
   `break`. Index an array only with constants or the loop index.
   [shaders.md](references/shaders.md#glsl-es-100) lists the replacements;
   the build names any of these at its line.
2. **Premultiplied alpha in and out.** `src` and `uTexture` reads are
   premultiplied, and so must be what you return: a paint with
   transparency returns `vec4(color * a, a)`. An effect that changes colour
   divides by alpha, changes it, multiplies back, and leaves alpha alone.
3. **Work in pixels, not raw `uv`.** A paint's `uv` is 0 → 1 on both axes
   whatever the box, so shapes drawn in `uv` stretch with the box. Draw in
   `uv * uOutputFrame.zw`, or centre and scale by the shorter side.
4. **A paint draws at most 1024 px per side**, then stretches over a larger
   box — each axis on its own. On a box wider or taller than 1024 px,
   circles turn into ellipses and angles skew by that axis's stretch, and
   nothing the shader reads tells it the box's real size (the previews'
   1280×720 box shows it). Keep lines and dots at least 2 px, and expect a
   2048-px box to show them twice as big.
5. **Scale an effect's pixel params by `uViewportScale`**, or the effect
   changes size as the user zooms.
6. **Clamp every neighbour read to `uInputClamp`** — past it the input
   texture holds other objects' pixels.
7. **Give an effect that draws outside its object a `padding`** (a shadow,
   a glow, a displacement) — without one it is cut at the object's bounds.
   Its reach with every scaled param at its max must stay ≤ 256 px.
8. **`uTime` exists only with `"animated": true`.** Reading it in a still
   dynamic fails to compile; declaring `animated` without reading it
   redraws every frame for nothing — the build warns.
9. **The same picture on every device and every export**: use `uv` and
   `uTime`, never `gl_FragCoord` (it moves with the view), and hash without
   `sin` (Hoskins' hashes, as in shaders.md).
10. **Every pixel, every frame.** SSHOW's own packs keep to 9 texture
    reads of their own (the engine's read for `src` comes free) and 9 loop
    iterations; stay in that budget. A wide soft blur or glow does not fit
    one pass — the editor's own Blur, Drop Shadow and Outer Glow do that
    work; see the outline recipe in shaders.md for what nine reads can do.
11. **Published names, slots, param keys and types are forever.**
    Documents store them: a new version may add and widen, never remove,
    rename, retype or narrow ([publishing.md](references/publishing.md#new-versions)).

## Build options

```bash
node scripts/build.mjs my-pack/ --out out/my-pack/com.example.pack-1.0.0.sshowdynamic
node scripts/build.mjs my-pack/ --icon                   # also draw icon.png
node scripts/build.mjs my-pack/ --previous 1.0.0.sshowdynamic   # a new version
python3 scripts/pack.py my-pack/ --check                 # dynamic.json as the last build left it, no engine
```

The build writes `shaders/*.glsl` into `dynamic.json` (rewriting the file
in its own four-space format), checks the manifest with `scripts/pack.py`
(the contract the editor and the server enforce), compiles every dynamic,
draws the preview sheets, and only then packs and installs the package
through the editor's own import — over `--previous` when given, so a
version that would break documents made with the published one, or that
is not numbered higher, is refused here exactly as the review refuses it.
A refused build leaves no package behind.

## Runner requirements

- Node 20+, python3, the `playwright` package, and a Chromium runtime.
  `node scripts/build.mjs --check` reports what it found. The runner tries
  playwright's own Chromium, then an installed Chrome, then Edge, so a
  machine with Chrome needs no browser download (`npm i playwright` in the
  folder you build from is enough); only when none is present does it ask for
  `npx playwright install chromium` — a few hundred MB. On the user's own
  computer, ask before downloading it.
- The engine ships with the skill (`engine/sshow.min.js.gz`) — no network
  is needed. `--bundle <path-or-url>` builds against another engine build.

## If the runner cannot be installed

Do not hand over shaders that never compiled. Package the work for the
user instead: put the pack folder, the skill's `scripts/` and `engine/`
folders (side by side, so `scripts/` finds `../engine/`), and a
`package.json` with `{ "dependencies": { "playwright": "^1" } }` into one
directory, and tell the user to run:

```bash
npm install
node scripts/build.mjs --check   # if this fails: npx playwright install chromium
node scripts/build.mjs <pack-dir> --out out/<id>-<version>.sshowdynamic   # add --icon only for a pack without its own icon: it overwrites icon.png
```

## References

- [references/shaders.md](references/shaders.md) — the program the engine
  builds around your function, GLSL ES 1.00 and its replacements,
  coordinates and units, alpha, time, padding, cost, recipes, and what
  build errors mean.
- [references/publishing.md](references/publishing.md) — trying a pack in
  the editor, how documents store a dynamic, the rules for new versions,
  package caps, and the developer console's review.
- [examples/starter/](examples/starter/) — an animated paint (Stripes) and
  an effect with padding (Hard Shadow), built with `--icon`. Build it as a
  smoke test.
