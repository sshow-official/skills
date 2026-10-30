# Shader Reference

What the engine does with a dynamic's GLSL, and how to write one that
compiles everywhere and draws the same picture on every device.

## Contents

- [The program around your function](#the-program-around-your-function)
- [GLSL ES 1.00](#glsl-es-100)
- [Uniforms](#uniforms)
- [Coordinates and units](#coordinates-and-units)
- [Colour and alpha](#colour-and-alpha)
- [Time](#time)
- [Padding](#padding)
- [Cost and sameness](#cost-and-sameness)
- [Recipes](#recipes)
- [Build messages](#build-messages)

## The program around your function

Your `shaders/<name>.glsl` is pasted into a program the engine writes. For
an effect with params `distance` (number) and `color` (color), marked
`"animated": true`, the whole fragment program is:

```glsl
precision highp float;
in vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform vec4 uOutputFrame;
uniform vec4 uGlobalFrame;
uniform vec4 uOutputTexture;
uniform sampler2D uTexture;      // effect only
uniform float uOpacity;          // effect only
uniform float uViewportScale;    // effect only
uniform float uTime;             // "animated": true only
uniform float uDistance;         // one per param, in declaration order
uniform vec3 uColor;
// ---- your shaders/<name>.glsl goes here ----
void main(void)
{
    vec4 src = texture(uTexture, vTextureCoord);
    finalColor = mix(src, dynamicEffect(vTextureCoord, src), uOpacity);
}
```

A paint gets the same head without the three effect uniforms, and its
`main` is:

```glsl
finalColor = dynamicPaint(vTextureCoord * uInputSize.xy / uOutputFrame.zw);
```

There is no `#version` line, so WebGL compiles the program as GLSL ES
1.00, with the renderer's own defines on top: `texture` is `texture2D`,
`in` is `varying`, and `finalColor` is `gl_FragColor`. Never name anything
`texture`, `finalColor`, `main`, or a `u…` name the engine or a param
already uses. Precision is `highp` for floats.

## GLSL ES 1.00

Works: helper functions, `const` globals, structs, `#define`, arrays
declared and then filled one element at a time, `for` loops with constant
bounds (int or float counters, `break` and `continue`), `texture()` and
`texture2D()`, `mat2`/`mat3`/`mat4` arithmetic, and the usual built-ins
(`mod`, `fract`, `floor`, `ceil`, `step`, `smoothstep`, `mix`, `clamp`,
`pow`, `exp`, `log`, `sqrt`, `atan(y, x)`, `length`, `distance`, `dot`,
`normalize`, `reflect`, `radians`, the trigonometry).

Not there, and what to write instead:

| GLSL ES 3.00 | Write |
|---|---|
| `fwidth`, `dFdx`, `dFdy` | You know a pixel's size: 1 px is 1 unit of `uv * uOutputFrame.zw` in a paint, `uInputSize.zw` in `uv` in an effect. Soften an edge at signed distance `d` px with `clamp(0.5 - d, 0.0, 1.0)`. |
| `round(x)` | `floor(x + 0.5)` |
| `trunc(x)` | `sign(x) * floor(abs(x))` |
| `tanh(x)` | `x = clamp(x, -10.0, 10.0); (exp(2.0 * x) - 1.0) / (exp(2.0 * x) + 1.0)` |
| integer `%` | `mod(a, b)` on floats |
| `uint`, `&`, `|`, `^`, `<<` | float arithmetic with `floor`, `mod`, `fract` |
| `switch` | `if` / `else if` |
| `float[3](…)` array constructors | `float a[3];` then `a[0] = …;` |
| `while`, `do … while` | a `for` loop with a constant bound and `break` |
| a loop bound from a param, `i < int(uCount)` | `for (int i = 0; i < 9; i++) { if (float(i) >= uCount) break; … }` |
| `a[k]` with a computed `k` | constants or the loop index only — loop and compare, or `if` chains |
| `inverse`, `transpose`, `determinant` | write the 2×2 case out |
| `isnan`, `isinf` | keep values finite: guard divisions (`max(x, 1e-4)`), `sqrt` and `pow` bases |
| `texelFetch`, `textureSize`, `textureLod` | `texture(uTexture, (pixel + 0.5) * uInputSize.zw)`; the size is `uInputSize.xy` |
| `in` on a parameter, `float f(in vec2 p)` | leave it out — parameters are `in` already (`out` and `inout` work); the engine's defines turn `in` into `varying` |

## Uniforms

| Uniform | Type | Slot | Value |
|---|---|---|---|
| `u<Key>` | `float` / `vec3` | both | each param: a number as stored (held to `min…max`), a boolean as 1.0 or 0.0, a colour 0–1 per channel |
| `uTime` | `float` | animated only | seconds on the engine clock — see [Time](#time) |
| `uOutputFrame` | `vec4` | both | `.zw` = the size in pixels of the area drawn: a paint's box (at most 1024 per side), an effect's object plus its padding |
| `uInputSize` | `vec4` | both | `.xy` = the input texture's size in pixels — often larger than the frame — and `.zw` = 1 / `.xy` |
| `uInputClamp` | `vec4` | both | the `uv` rectangle that holds this object's input, inset half a pixel: `.xy` min, `.zw` max |
| `uInputPixel` | `vec4` | both | `uInputSize` in device pixels (screen density included) |
| `uGlobalFrame`, `uOutputTexture` | `vec4` | both | renderer internals — no use to a pack |
| `uTexture` | `sampler2D` | effect | the object's own pixels, premultiplied |
| `uViewportScale` | `float` | effect | input pixels per document pixel: the editor's zoom, 1 in exports |
| `uOpacity` | `float` | effect | the effect's opacity — the engine's `main` applies it |

## Coordinates and units

**Paint.** `uv` is 0 → 1 across the object's box, top-left origin, y down,
whatever the box's shape. `uv * uOutputFrame.zw` is in pixels — the box's
own pixels up to 1024 per side. The paint is drawn into a texture that
size and then stretched over the box, each axis on its own: a 2048 × 512
box draws at 1024 × 512 and doubles horizontally. So measure in pixels,
keep lines and dots at least 2 px, and expect patterns on very large
boxes to scale up. Centring and scaling by the shorter side keeps shapes
round ([recipe](#paint-centred-and-round)) on boxes up to 1024 px a side;
past that, circles become ellipses and angles skew by the stretch, and no
uniform carries the box's real size. The engine clips the paint to the
shape (fills and strokes alike); text and arrowheads fall back to grey.

**Effect.** `uv` is not 0 → 1 over the object: it addresses `uTexture`,
which holds the object plus its padding and is often larger. Useful
spaces:

- input pixels: `uv * uInputSize.xy`
- 0 → 1 across the object plus its padding: `uv * uInputSize.xy / uOutputFrame.zw`
- a document-pixel offset as a `uv` offset: `px * uViewportScale * uInputSize.zw`

A size param in document pixels must be multiplied by `uViewportScale` or
the effect grows and shrinks as the user zooms. Every neighbour read must
be clamped to `uInputClamp` — past it lie other objects' pixels.

**Angles** are degrees in params (`"unit": "°"`); convert with
`radians()`. y points down, so a positive angle turns clockwise on screen.

## Colour and alpha

Colours are premultiplied by alpha everywhere: `src`, every `uTexture`
read, and what you return. A colour param is plain 0–1 RGB, not
premultiplied.

- A paint with transparency returns `vec4(color * a, a)`, never
  `vec4(color, a)` — that one shows as a too-bright fringe.
- An effect that changes colour divides by alpha, changes, and multiplies
  back, leaving alpha as it was ([recipe](#effect-change-colour-keep-alpha)).
  A pixel with alpha 0 has no colour to change: return it as it is.
- Laying one premultiplied colour over another is
  `top + bottom * (1.0 - top.a)`.
- A paint's `bgAlpha`-style param (as SSHOW's packs use it) is the alpha of
  the background the pattern sits on.

## Time

`uTime` is seconds on the engine clock, declared only for `"animated":
true`. The clock runs whenever the editor or a show draws the document —
it is not the timeline's playhead, so a dynamic keeps moving while the
timeline is stopped. It wraps to 0 every 3600 s. A video or GIF export
sets it frame by frame, so those are exact; PDF and PowerPoint exports
draw it at 0 s, and an image export at whatever moment it is taken. The
picker tile, the pack icon and the previews' two subjects stop it at 2 s,
and the previews add 0, 0.35 and 1.3 s — make 2 s a representative frame,
and 0 s a good one for PDF and PowerPoint.

An animated dynamic redraws every frame; a still one only when its params
or its box change. Keep `animated` false unless the shader reads `uTime` —
the build warns when an animated dynamic does not move. Scale motion by a
`speed` param so users can slow it down, and let `speed` reach 0.

## Padding

An effect draws only inside its object's bounds unless it declares how
far it reaches:

```json
"padding": { "plus": 2, "scale": { "distance": 1, "blur": 2 } }
```

Reach = `plus` + Σ (param value × factor), in document pixels on every
side, at the values the user set. `scale` may name only that dynamic's
number params. With every scaled param at its max the reach must be ≤ 256
px. Keep it tight — the area the effect works on grows by it on all four
sides. The build's effect previews include exactly the reach: an effect
cut off at the edge there is cut off in the editor too.

## Cost and sameness

A dynamic runs for every pixel it covers; an animated one every frame — a
full-screen paint at 60 frames a second, on a phone too. SSHOW's own packs
keep to 9 texture reads of their own (the engine's read for `src` comes
free) and loops of 9 iterations; stay in that budget. A wide soft blur or
glow takes many passes, which a dynamic does not get: the editor's own
Blur, Drop Shadow and Outer Glow effects do that work. Keep dynamics to
looks a few reads can make ([outline recipe](#effect-outline-in-nine-reads)).

The same params and time must draw the same picture on every GPU and in
every export:

- Hash with arithmetic, not `sin` — `fract(sin(x) * 43758.5)` differs
  between GPUs. Use Dave Hoskins' hashes ([recipe](#hash-without-sine)).
- Use `uv`, never `gl_FragCoord` — it is the position in whatever is being
  drawn, which changes with the view and the export.
- Keep values finite: division by zero, `sqrt` or `pow` of a negative, and
  `normalize(vec2(0.0))` give NaN, which draws differently everywhere.

## Recipes

### Paint: centred and round

```glsl
vec4 dynamicPaint(vec2 uv) {
    vec2 size = uOutputFrame.zw;
    vec2 p = (uv - 0.5) * size / min(size.x, size.y);  // 0 at the centre, the shorter side spans 1
    float d = (length(p) - 0.3) * min(size.x, size.y);  // signed distance in pixels
    float a = clamp(0.5 - d, 0.0, 1.0);                 // one-pixel soft edge
    return vec4(uColor * a, a);
}
```

### Hash without sine

```glsl
// Dave Hoskins, "Hash without Sine" (MIT): the same values on every GPU.
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}
```

### Effect: read a neighbour

```glsl
// The object's pixel px document pixels away from uv.
vec4 neighbour(vec2 uv, vec2 px) {
    vec2 at = uv + px * uViewportScale * uInputSize.zw;
    return texture(uTexture, clamp(at, uInputClamp.xy, uInputClamp.zw));
}
```

### Effect: outline in nine reads

With `"padding": { "plus": 1, "scale": { "width": 1 } }` and params
`width` (number, 1–12) and `color`:

```glsl
// The object's silhouette grown by width px, in a colour, behind its own pixels.
// Eight reads on a ring at the full width: clean around shapes, photos and
// display text; beside a stroke thinner than the width the ring can step
// over it, so keep the max width near the thinnest stroke it should follow.
vec4 dynamicEffect(vec2 uv, vec4 src) {
    vec2 reach = uWidth * uViewportScale * uInputSize.zw;
    float cover = src.a;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;   // 45° apart
        vec2 at = clamp(uv + vec2(cos(a), sin(a)) * reach, uInputClamp.xy, uInputClamp.zw);
        cover = max(cover, texture(uTexture, at).a);
    }
    vec4 line = vec4(uColor * cover, cover);
    return src + line * (1.0 - src.a);
}
```

### Effect: change colour, keep alpha

```glsl
vec4 dynamicEffect(vec2 uv, vec4 src) {
    if (src.a <= 0.0) return src;
    vec3 rgb = src.rgb / src.a;                               // un-premultiply
    float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(rgb, vec3(grey), uAmount);
    return vec4(rgb * src.a, src.a);                          // premultiply back
}
```

### A loop count from a param

```glsl
float total = 0.0;
for (int i = 0; i < 9; i++) {         // the bound must be a constant
    if (float(i) >= uLayers) break;   // the param decides where it stops
    total += 1.0 / float(i + 1);
}
```

## Build messages

| The build says | Why | Fix |
|---|---|---|
| `'dynamicPaint' : no matching overloaded function found — in the engine's main …` | the entry function is missing, misnamed, or has another signature | `vec4 dynamicPaint(vec2 uv)` / `vec4 dynamicEffect(vec2 uv, vec4 src)` |
| `'fwidth' : no matching overloaded function found` (`round`, `trunc`, `tanh`, `inverse`, `isnan` …) | a GLSL ES 3.00 function | the [table above](#glsl-es-100) |
| `'%' : integer modulus operator supported in GLSL ES 3.00 and above only` | integer `%` | `mod()` on floats |
| `Loop index cannot be compared with non-constant expression` | a loop bound from a param | a constant bound and `break` |
| `This type of loop is not allowed` | `while` or `do` | `for` with a constant bound |
| `Index expression can only contain const or loop symbols` | an array index computed from data | constants or the loop index |
| `'varying' : only allowed at global scope` / `Invalid parameter qualifier` | `in` before a function parameter — the engine's defines turn it into `varying` | delete the `in` |
| `'uTime' : undeclared identifier` | time read in a still dynamic | `"animated": true` |
| `'uTexture' : undeclared identifier` | a paint reading pixels | only effects get the object's pixels |
| `'uSize' : undeclared identifier` | the uniform does not match a param key | `u` + the key capitalised: `size` → `uSize` |
| `'uSize' : redefinition` | the shader declares a uniform | delete the declaration — params become uniforms |
| `glsl — no #version / #extension / #include, not even in a comment` | a directive, even inside a comment | remove it |
| `glsl — missing: the shader, as a string …` (from `pack.py --check`) | `dynamic.json` has no shader yet — only the build writes `shaders/<name>.glsl` into it | run the build |
| `draws nothing at its defaults` | alpha 0 or NaN everywhere at the default params | check alpha, premultiplication, divisions |
| `changes nothing over the test card at its defaults` | the effect's defaults make no visible change | pick defaults that show the effect |
| `is declared animated but looks the same at 0, 0.35 and 1.3 s` | `uTime` unused, or the param that scales it (`speed`) is 0 at its default | let `uTime` move it at the defaults, or stop reading it and set `"animated": false` |
| `draws nothing with every number param at its min` (or `max`) | the pattern vanishes at a range end | narrow the range before publishing, or handle the end |
| `draws nothing with every boolean flipped` | a boolean's other state blanks it | fix that branch |
