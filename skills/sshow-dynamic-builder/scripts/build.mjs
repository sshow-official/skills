#!/usr/bin/env node
/**
 * Build a .sshowdynamic dynamic pack and show what each dynamic draws.
 *
 * Usage:
 *     node build.mjs <pack-dir> [--out <file.sshowdynamic>] [--icon] [--previous <published.sshowdynamic>] [--bundle <path-or-url>]
 *     node build.mjs --check
 *
 * Drives the real SSHOW engine (headless Chromium, software WebGL) through
 * the editor's own install path, so a pack that builds here installs
 * cleanly everywhere. Pipeline:
 *
 *   1. Write each shaders/<name>.glsl into its declaration in dynamic.json —
 *      the .glsl files are the source, the editor reads only the manifest.
 *   2. Hold the manifest to the editor and server contract (pack.py --check).
 *   3. Compile every dynamic on its own, so one run names every shader that
 *      fails, each error at its line in shaders/<name>.glsl.
 *   4. Draw a preview sheet per dynamic into previews/ beside the package and
 *      check its pixels: a dynamic that draws nothing at its defaults fails
 *      the build; one that changes nothing, does not move although declared
 *      animated, or vanishes at a param's end is warned about.
 *   5. --icon: draw icon.png from the picker tiles of the first four
 *      dynamics, two by two, as SSHOW's own packs do.
 *   6. Pack (pack.py) and install the package through the editor's import —
 *      over --previous when given, so a version that would break documents
 *      made with the published one is refused here as the editor and the
 *      review refuse it. A refused package is not left behind.
 */

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile, stat, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_FILE = join(__dirname, 'harness.html');
const PACKER = join(__dirname, 'pack.py');
const VENDORED_BUNDLE = join(__dirname, '..', 'engine', 'sshow.min.js.gz');
const DEFAULT_BUNDLE = 'https://s.show/sshow/index.min.js';
const MANIFEST = 'dynamic.json';
const SHADERS = 'shaders';
const PYTHONS = ['python3', 'python'];
const CHROMIUM_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
// The pack icon SSHOW's own packs carry: the 64 px tile at 2x, a 7 px margin,
// 3 px gaps and 5 px cell corners there, each cell on white.
const ICON = { file: 'icon.png', size: 128, margin: 14, gap: 6, radius: 10 };
// What the engine's main calls, by slot — named when an error lands there.
const ENTRY = { paint: 'vec4 dynamicPaint(vec2 uv)', effect: 'vec4 dynamicEffect(vec2 uv, vec4 src)' };

const run = promisify(execFile);

const fail = (message) => {
    console.error(`  ✗ ${message}`);
    process.exit(1);
};

const warn = (message) => {
    console.error(`  ⚠ ${message}`);
};

//#region ---------- Inputs ----------

const parseCli = () => {
    let parsed;
    try {
        parsed = parseArgs({
            allowPositionals: true,
            options: {
                out: { type: 'string' },
                icon: { type: 'boolean', default: false },
                previous: { type: 'string' },
                bundle: { type: 'string' },
                check: { type: 'boolean', default: false }
            }
        });
    } catch (error) {
        fail(error.message);
    }
    if (parsed.values.check) return { check: true };
    if (parsed.positionals.length !== 1) {
        fail('usage: node build.mjs <pack-dir> [--out <file.sshowdynamic>] [--icon] [--previous <published.sshowdynamic>] [--bundle <path-or-url>]\n         node build.mjs --check');
    }
    const { out, icon, previous, bundle } = parsed.values;
    return { packDir: resolve(parsed.positionals[0]), out: out && resolve(out), icon, previous: previous && resolve(previous), bundle };
};

const readManifest = async (packDir) => {
    const text = await readFile(join(packDir, MANIFEST), 'utf8').catch(() => null);
    if (text === null) {
        const plugin = await stat(join(packDir, 'plugin.json')).catch(() => null);
        fail(`no ${MANIFEST} in ${packDir}${plugin ? ' — that is a plugin; build it with the sshow-plugin-builder skill' : ''}`);
    }
    try {
        return JSON.parse(text.replace(/^﻿/, ''));
    } catch (error) {
        fail(`${MANIFEST} is not valid JSON — ${error.message}`);
    }
};

const writeManifest = (packDir, manifest) => writeFile(join(packDir, MANIFEST), `${JSON.stringify(manifest, null, 4)}\n`);

/**
 * Write each shaders/<name>.glsl into its declaration. A pack without a
 * shaders/ folder keeps its shaders inline in the manifest. Returns where
 * each shader came from and how many lines the trim took off the file's top,
 * so a compile error can name the file's own line.
 */
const syncShaders = async (packDir, manifest) => {
    const files = (await readdir(join(packDir, SHADERS)).catch(() => [])).filter((file) => file.endsWith('.glsl'));
    const origins = {};
    if (files.length === 0 || !Array.isArray(manifest.dynamics)) return origins;

    const names = new Set(manifest.dynamics.map((declaration) => declaration?.name));
    for (const file of files) {
        if (!names.has(basename(file, '.glsl'))) fail(`${SHADERS}/${file}: ${MANIFEST} declares no dynamic named "${basename(file, '.glsl')}"`);
    }
    let changed = false;
    for (const declaration of manifest.dynamics) {
        if (!declaration || typeof declaration.name !== 'string') continue;
        const file = `${declaration.name}.glsl`;
        if (!files.includes(file)) fail(`${MANIFEST}: "${declaration.name}" has no ${SHADERS}/${file}`);
        const text = await readFile(join(packDir, SHADERS, file), 'utf8');
        const glsl = text.trim();
        origins[declaration.name] = { file: `${SHADERS}/${file}`, skipped: text.slice(0, text.indexOf(glsl)).split('\n').length - 1 };
        if (declaration.glsl !== glsl) {
            declaration.glsl = glsl;
            changed = true;
        }
    }
    if (changed) await writeManifest(packDir, manifest);
    return origins;
};

//#endregion

//#region ---------- Packer ----------

let python = null;

/** The python that runs pack.py — python3, else python. */
const findPython = async () => {
    for (const candidate of PYTHONS) {
        if (await run(candidate, ['--version']).then(() => true, () => false)) return candidate;
    }
    fail('python3 is required — scripts/pack.py checks the manifest and writes the package');
};

/** Run pack.py on the pack; a refusal prints its reasons and fails the build. */
const pack = async (packDir, args) => {
    python ??= await findPython();
    try {
        await run(python, [PACKER, packDir, ...args]);
    } catch (error) {
        process.stderr.write(error.stderr || `${error.message}\n`);
        fail(`${MANIFEST} breaks the contract above — fix it and rebuild`);
    }
};

//#endregion

//#region ---------- Engine harness ----------

/** Playwright from beside the skill, else from the folder the build runs in. */
const importChromium = async () => {
    const local = createRequire(resolve('package.json'));
    for (const pkg of ['playwright', '@playwright/test']) {
        const mod = await import(pkg).catch(() => null)
            ?? await Promise.resolve().then(() => import(pathToFileURL(local.resolve(pkg)).href)).catch(() => null);
        const chromium = mod?.chromium ?? mod?.default?.chromium;
        if (chromium) return chromium;
    }
    fail('playwright is required — npm i playwright (here, or in a folder above the skill) && npx playwright install chromium');
};

/**
 * The engine needs a chromium runtime, not playwright's copy of one. Try
 * playwright's own build first (version-pinned), then a browser the machine
 * already has — an installed Chrome or Edge skips the download entirely.
 */
const BROWSERS = [
    { label: 'playwright chromium' },
    { label: 'system chrome', channel: 'chrome' },
    { label: 'system edge', channel: 'msedge' }
];

const launchBrowser = async () => {
    const chromium = await importChromium();
    const errors = [];
    for (const { label, channel } of BROWSERS) {
        const options = { args: CHROMIUM_ARGS };
        if (channel) options.channel = channel;
        try {
            return { browser: await chromium.launch(options), label };
        } catch (error) {
            errors.push(`      ${label}: ${error.message.split('\n')[0].trim()}`);
        }
    }
    fail(`no chromium runtime — install Chrome, or run npx playwright install chromium\n${errors.join('\n')}`);
};

/**
 * Prerequisite probe (`--check`) — node version, python, playwright, and a
 * real chromium launch. Run it before writing shaders anywhere the runner
 * might not be installable.
 */
const preflight = async () => {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 20) fail(`node ${process.versions.node} — the runner needs node 20+`);
    const found = await findPython();
    const { browser, label } = await launchBrowser();
    await browser.close();
    console.error(`  ✓ node ${process.versions.node} + ${found} + ${label} ready`);
};

/**
 * Resolve the engine bundle: explicit --bundle (path or url) wins, then the
 * vendored gzip shipped with the skill (offline-capable), then the
 * production bundle.
 */
const loadBundle = async (bundle) => {
    if (!bundle) {
        const vendored = await readFile(VENDORED_BUNDLE).catch(() => null);
        if (vendored) return gunzipSync(vendored);
        bundle = DEFAULT_BUNDLE;
    }
    if (bundle.startsWith('https://') || bundle.startsWith('http://')) {
        const response = await fetch(bundle).catch((error) => fail(`engine bundle fetch failed: ${bundle} — ${error.message}`));
        if (!response.ok) fail(`engine bundle fetch failed: ${bundle} — HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    }
    return readFile(resolve(bundle)).catch(() => fail(`engine bundle not found: ${resolve(bundle)}`));
};

/** Serve the harness page + engine bundle on an ephemeral local port. */
const serveHarness = async (bundleBytes) => {
    const harness = await readFile(HARNESS_FILE);
    const server = createServer((req, res) => {
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(harness);
        } else if (req.url === '/sshow.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(bundleBytes);
        } else {
            res.writeHead(204).end();
        }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    return { server, url: `http://127.0.0.1:${server.address().port}/` };
};

const bootEngine = async (browser, url) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (error) => warn(`engine: ${error.message}`));
    page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return;
        // SwiftShader perf noise, pixi noting a snapshot freed a texture it
        // still had bound, and the compile failures step 3 reports itself
        if (/GL Driver Message|\[BindGroup\]|shader|program/i.test(msg.text())) return;
        warn(`engine: ${msg.text()}`);
    });

    await page.goto(url);
    await page.waitForFunction(() => window.__sshowReady || window.__sshowError);
    const bootError = await page.evaluate(() => window.__sshowError);
    if (bootError) fail(`engine failed to boot: ${bootError}`);
    if (!await page.evaluate(() => typeof window.sshow.getExtensions === 'function')) {
        fail('this engine build has no dynamic packs — pass a newer one with --bundle');
    }
    return page;
};

//#endregion

//#region ---------- In the page ----------
// These run inside the harness page (page.evaluate): self-contained, no Node.

/**
 * Register each declaration as a pack of its own, so every shader compiles
 * whatever the others do. A failure carries the engine's message and how many
 * lines of the compiled program come before the pack's function.
 */
const compileEach = (manifest) => {
    const extensions = window.sshow.getExtensions();
    return manifest.dynamics.map((declaration, index) => {
        const from = window.__shaderSources.length;
        try {
            extensions.register({ kind: 'dynamic', manifest: { ...manifest, id: `probe.${index}`, dynamics: [declaration] }, body: [declaration] });
            return null;
        } catch (error) {
            const program = window.__shaderSources.slice(from).find((source) => source.includes(declaration.glsl));
            return {
                message: error?.message ?? String(error),
                before: program ? program.slice(0, program.indexOf(declaration.glsl)).split('\n').length - 1 : null
            };
        }
    });
};

/**
 * The picture an effect is previewed over: sky, sun, hills, text and colour
 * bars on a card with clear rounded corners — colour, edges and alpha at once.
 */
const drawTestCard = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext('2d');
    context.beginPath();
    context.roundRect(0, 0, 1280, 720, 64);
    context.clip();
    const sky = context.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#5B9BFF');
    sky.addColorStop(1, '#FFD9A8');
    context.fillStyle = sky;
    context.fillRect(0, 0, 1280, 720);
    context.fillStyle = '#FFF6C9';
    context.beginPath();
    context.arc(980, 210, 110, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2F6B4F';
    context.beginPath();
    context.moveTo(0, 560);
    context.quadraticCurveTo(320, 380, 700, 520);
    context.quadraticCurveTo(1000, 620, 1280, 470);
    context.lineTo(1280, 720);
    context.lineTo(0, 720);
    context.fill();
    context.fillStyle = '#FFFFFF';
    context.font = 'bold 132px sans-serif';
    context.fillText('Aa 123', 88, 250);
    ['#E5484D', '#F5A524', '#F2E14C', '#46A758', '#3E8EED', '#8E4EC6'].forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(88 + index * 184, 610, 168, 64);
    });
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
    window.__card = window.sshow.getAssets().register(await blob.arrayBuffer(), { mimeType: 'image/png' }).uri;
};

/**
 * One dynamic's preview sheet: its two subjects at its defaults (a paint
 * fills a wide and a square box; an effect works over the test card and over
 * a line of text — thin strokes, holes, separate shapes), three moments of an
 * animated one, every number param at its min and at its max, every boolean
 * flipped, and its picker tile — each over a checkerboard so what it leaves
 * transparent shows. Notes say what the pixels show wrong.
 */
const drawPreview = async ({ source, declaration }) => {
    const sshow = window.sshow;
    const objects = sshow.getScenes().getActive().getObjects();
    const paint = declaration.slot === 'paint';
    const defaults = Object.fromEntries(declaration.params.map((param) => [param.key, param.default]));
    const numbers = declaration.params.filter((param) => param.type === 'number');
    const booleans = declaration.params.filter((param) => param.type === 'boolean');
    const shapeFill = {
        type: 'linearGradient', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, opacity: 1, visible: true,
        colors: [{ offset: 0, color: '#7FB2FF', alpha: 1 }, { offset: 1, color: '#FFC58A', alpha: 1 }]
    };
    const subjects = paint
        ? [{ type: 'rect', width: 1280, height: 720, caption: 'wide box 1280×720 — drawn at 1024×720, then stretched' }, { type: 'rect', width: 720, height: 720, caption: 'square box 720×720' }]
        : [{ type: 'image', width: 1280, height: 720, caption: 'over the test card' }, { type: 'text', caption: 'over text' }];

    // How far an effect draws past its object at these params — the export keeps that margin.
    const reach = (params) => {
        if (!declaration.padding) return 0;
        const values = { ...defaults, ...params };
        const { plus = 0, scale = {} } = declaration.padding;
        return Math.ceil(Object.entries(scale).reduce((sum, [key, factor]) => sum + values[key] * factor, plus));
    };
    const frame = () => new Promise((done) => requestAnimationFrame(done));
    const render = async (subject, { params = {}, time = 2, applied = true } = {}) => {
        sshow.getRenderer().setExportTime(time);
        const dynamics = applied ? [{ type: 'dynamic', source, name: declaration.name, params, opacity: 1, visible: true }] : [];
        const config = {
            transform: { x: 0, y: 0, anchorX: 0, anchorY: 0 },
            style: { fills: paint ? dynamics : subject.type === 'text' ? [shapeFill] : [], strokes: [], effects: paint ? [] : dynamics }
        };
        if (subject.width) config.size = { width: subject.width, height: subject.height };
        if (subject.type === 'image') config.data = { src: window.__card };
        if (subject.type === 'text') config.data = { text: 'Ag', fontSize: 360, lineHeight: 400, fontWeight: 800, autoSize: true };
        const id = objects.create(subject.type, config);
        const object = objects.getById(id);
        // A picture draws once its texture is up.
        for (let wait = 0; subject.type === 'image' && !(object.getLayers().sprite?.texture.source.pixelWidth > 0) && wait < 300; wait++) await frame();
        await frame();
        await frame();
        const canvas = await sshow.getIO().exportObject(object, { type: 'canvas', padding: paint ? 0 : reach(params) });
        objects.delete(id);
        return canvas;
    };

    const pixels = (canvas) => {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        context.drawImage(canvas, 0, 0);
        return context.getImageData(0, 0, copy.width, copy.height).data;
    };
    const drawn = (canvas) => pixels(canvas).some((value, index) => index % 4 === 3 && value > 2);
    const differs = (a, b) => {
        if (a.width !== b.width || a.height !== b.height) return true;
        const [one, two] = [pixels(a), pixels(b)];
        let total = 0;
        for (let index = 0; index < one.length; index++) total += Math.abs(one[index] - two[index]);
        return total / one.length > 0.25;
    };

    // Nothing drawn at the defaults is the one failure; the other notes would only repeat it.
    const main = await render(subjects[0]);
    const second = await render(subjects[1]);
    const blank = !drawn(main);
    const notes = blank ? [{ error: true, text: 'draws nothing at its defaults' }] : [];
    if (!blank && !paint && !differs(main, await render(subjects[0], { applied: false }))) notes.push({ text: 'changes nothing over the test card at its defaults' });

    // Moments off whole seconds, so motion that repeats every second still shows.
    const smalls = [];
    if (declaration.animated) {
        for (const time of [0, 0.35, 1.3]) smalls.push({ canvas: await render(subjects[0], { time }), caption: `at ${time} s` });
        if (!blank && !smalls.some(({ canvas }) => differs(canvas, smalls[0].canvas))) {
            notes.push({ text: 'is declared animated but looks the same at 0, 0.35 and 1.3 s — let uTime move it at the defaults (a speed above 0), or stop reading uTime and set "animated": false' });
        }
    }
    for (const end of numbers.length > 0 ? ['min', 'max'] : []) {
        const canvas = await render(subjects[0], { params: Object.fromEntries(numbers.map((param) => [param.key, param[end]])) });
        if (!blank && !drawn(canvas)) notes.push({ text: `draws nothing with every number param at its ${end}` });
        smalls.push({ canvas, caption: `every number at its ${end}` });
    }
    if (booleans.length > 0) {
        const canvas = await render(subjects[0], { params: Object.fromEntries(booleans.map((param) => [param.key, !param.default])) });
        if (!blank && !drawn(canvas)) notes.push({ text: 'draws nothing with every boolean flipped' });
        smalls.push({ canvas, caption: booleans.length > 1 ? 'every boolean flipped' : `${booleans[0].key} ${booleans[0].default ? 'off' : 'on'}` });
    }
    sshow.getRenderer().setExportTime(null);

    const tileURL = sshow.getRenderer().getDynamicThumbnail(source, declaration.name);
    const tile = tileURL && await new Promise((done) => {
        const image = new Image();
        image.onload = () => done(image);
        image.onerror = () => done(null);
        image.src = tileURL;
    });

    // Sheet: a title, the two subjects, then the small row and the tile.
    const margin = 24, gap = 24, caption = 24, title = 32, rowGap = 12, tileSide = 96;
    const big = { width: 640, height: 360 }, side = 360;
    const small = { width: Math.min(170, Math.floor((big.width + gap + side - tileSide - smalls.length * rowGap) / Math.max(1, smalls.length))), height: tileSide };
    const sheet = document.createElement('canvas');
    sheet.width = margin + big.width + gap + side + margin;
    sheet.height = margin + title + big.height + caption + gap + small.height + caption + margin;
    const context = sheet.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, sheet.width, sheet.height);
    context.textBaseline = 'top';
    context.fillStyle = '#111111';
    context.font = '600 17px sans-serif';
    context.fillText(`${declaration.label} — ${declaration.name} · ${declaration.slot}${declaration.animated ? ' · animated' : ''}`, margin, margin);

    const cell = (image, x, y, width, height, text) => {
        if (image) {
            const fit = Math.min(width / image.width, height / image.height);
            const [w, h] = [image.width * fit, image.height * fit];
            const [left, top] = [x + (width - w) / 2, y + (height - h) / 2];
            context.save();
            context.beginPath();
            context.rect(left, top, w, h);
            context.clip();
            for (let row = 0; row * 8 < h; row++) {
                for (let column = 0; column * 8 < w; column++) {
                    context.fillStyle = (row + column) % 2 ? '#E4E4E4' : '#F7F7F7';
                    context.fillRect(left + column * 8, top + row * 8, 8, 8);
                }
            }
            context.drawImage(image, left, top, w, h);
            context.restore();
        }
        context.fillStyle = '#666666';
        context.font = '12px sans-serif';
        context.fillText(text, x, y + height + 6);
    };
    const top = margin + title;
    cell(main, margin, top, big.width, big.height, `${subjects[0].caption}${declaration.animated ? ' · at 2 s' : ''}`);
    cell(second, margin + big.width + gap, top, side, side, subjects[1].caption);
    const row = top + big.height + caption + gap;
    smalls.forEach(({ canvas, caption: text }, index) => cell(canvas, margin + index * (small.width + rowGap), row, small.width, small.height, text));
    cell(tile, margin + smalls.length * (small.width + rowGap), row, tileSide, tileSide, 'picker tile · at 2 s');

    return { sheet: sheet.toDataURL('image/png'), notes };
};

/** SSHOW's pack icon: the first four dynamics' picker tiles two by two (a pack of fewer shows its first). */
const drawIcon = async ({ names, size, margin, gap, radius }) => {
    const renderer = window.sshow.getRenderer();
    const stills = names.map((name, index) => renderer.getDynamicThumbnail(`probe.${index}`, name));
    const cells = stills.length >= 4 ? 2 : 1;
    const side = (size - 2 * margin - (cells - 1) * gap) / cells;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    for (const [index, still] of stills.slice(0, cells * cells).entries()) {
        const image = new Image();
        image.src = still;
        await image.decode();
        const x = margin + (index % cells) * (side + gap);
        const y = margin + Math.floor(index / cells) * (side + gap);
        context.save();
        context.beginPath();
        context.roundRect(x, y, side, side, radius);
        context.clip();
        // A paint's clear parts show white, so a pale still keeps its cell's edge.
        context.fillStyle = '#FFFFFF';
        context.fillRect(x, y, side, side);
        context.drawImage(image, x, y, side, side);
        context.restore();
    }
    return canvas.toDataURL('image/png');
};

/**
 * Install the package the way the editor does — over the published one when
 * given, which holds the new version to the compatibility rule.
 */
const installPackage = ({ id, next, previous }) => {
    const extensions = window.sshow.getExtensions();
    const bytes = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const reason = (error) => error?.context?.reason ?? error?.message ?? String(error);
    let published = null;
    if (previous) {
        let record;
        try {
            record = extensions.getById(extensions.importPackage(bytes(previous)));
        } catch (error) {
            return { error: `--previous does not install: ${reason(error)}` };
        }
        if (record.kind !== 'dynamic') return { error: `--previous is a ${record.kind}, not a dynamic pack` };
        if (record.id !== id) return { error: `--previous is ${record.id}, not ${id}` };
        published = record.manifest;
    }
    try {
        extensions.importPackage(bytes(next), { replace: true });
    } catch (error) {
        // Every shader compiled on its own already: over a published version, what is left is its rule.
        return { error: published ? `this version would break documents made with ${published.version}: ${reason(error)}` : reason(error) };
    }
    return { published: published && published.version };
};

//#endregion

//#region ---------- Reports ----------

/** Name each compile error at its line in the shader file (or in the inline glsl). */
const describeFailures = (failures, manifest, origins) => failures.flatMap((failure, index) => {
    if (!failure) return [];
    const { name, slot, glsl } = manifest.dynamics[index];
    const origin = origins[name];
    const where = origin?.file ?? `${MANIFEST} "${name}"`;
    const errors = [...failure.message.matchAll(/ERROR: \d+:(\d+): ([^\n]+?)(?=\s*ERROR:|\s*\)\.?$|\n|$)/g)]
        .map(([, number, reason]) => ({ line: Number(number) - failure.before, reason: reason.trim() }));
    if (failure.before === null || errors.length === 0) return [`${where}: ${failure.message}`];

    const lines = glsl.split('\n');
    const own = errors.filter(({ line }) => line >= 1 && line <= lines.length);
    if (own.length === 0) {
        // The engine's main could not call the pack's function: its first reason is the cause.
        const [{ line, reason }] = errors;
        return [line > lines.length ? `${where}: ${reason} — in the engine's main, which calls ${ENTRY[slot]}; check your function's name and signature` : `${where}: ${reason}`];
    }
    const at = (line) => origin ? `${origin.file}:${line + origin.skipped}` : `${MANIFEST} "${name}" glsl line ${line}`;
    return [...new Set(own.map(({ line, reason }) => `${at(line)}: ${reason}\n        ${lines[line - 1].trim()}`))];
});

/** Numeric x.y.z ordering — is `next` strictly newer than `prev`? */
const isNewer = (next, prev) => {
    const [a, b] = [next.split('.').map(Number), prev.split('.').map(Number)];
    for (let index = 0; index < 3; index++) {
        if (a[index] !== b[index]) return a[index] > b[index];
    }
    return false;
};

//#endregion

const main = async () => {
    const cli = parseCli();
    if (cli.check) return preflight();

    const { packDir, icon, bundle } = cli;
    const manifest = await readManifest(packDir);
    const origins = await syncShaders(packDir, manifest);
    // --icon writes the icon this build will name: one not drawn yet must not stop the check first.
    if (icon && manifest.icon && !await stat(join(packDir, manifest.icon)).catch(() => null)) {
        delete manifest.icon;
        await writeManifest(packDir, manifest);
    }
    await pack(packDir, ['--check']);

    const out = cli.out ?? resolve('out', `${manifest.id}-${manifest.version}.sshowdynamic`);
    const previous = cli.previous && await readFile(cli.previous).catch(() => fail(`--previous not found: ${cli.previous}`));
    // A rebuild under the same name must not leave the last build there if this one fails.
    if (out !== cli.previous) await unlink(out).catch(() => {});
    const bundleBytes = await loadBundle(bundle);
    const { server, url } = await serveHarness(bundleBytes);
    const { browser, label } = await launchBrowser();
    if (label !== BROWSERS[0].label) warn(`using ${label} — not the version-pinned chromium, so rendering can differ`);

    const page = await bootEngine(browser, url);

    try {
        // 1. Compile every dynamic on its own — one run names every broken shader.
        const errors = describeFailures(await page.evaluate(compileEach, manifest), manifest, origins);
        if (errors.length > 0) {
            for (const error of errors) console.error(`  ✗ ${error}`);
            fail('the shaders above do not compile — fix them and rebuild');
        }

        // 2. A preview sheet per dynamic, checked by its pixels.
        const previewsDir = join(dirname(out), 'previews');
        await mkdir(previewsDir, { recursive: true });
        await page.evaluate(drawTestCard);
        const sheets = [];
        let broken = 0;
        for (const [index, declaration] of manifest.dynamics.entries()) {
            const { sheet, notes } = await page.evaluate(drawPreview, { source: `probe.${index}`, declaration });
            const path = join(previewsDir, `${declaration.name}.png`);
            await writeFile(path, Buffer.from(sheet.slice(sheet.indexOf(',') + 1), 'base64'));
            sheets.push(path);
            for (const { error, text } of notes) {
                if (error) {
                    broken++;
                    console.error(`  ✗ ${declaration.name} ${text} — see ${path}`);
                } else {
                    warn(`${declaration.name} ${text} — see ${path}`);
                }
            }
        }
        if (broken > 0) fail('fix the dynamics above and rebuild');

        // 3. The pack icon, drawn from the dynamics themselves.
        if (icon) {
            const names = manifest.dynamics.slice(0, 4).map(({ name }) => name);
            const dataUrl = await page.evaluate(drawIcon, { names, ...ICON });
            await writeFile(join(packDir, ICON.file), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
            if (manifest.icon !== ICON.file) {
                // Named ahead of the declarations, where SSHOW's own packs keep it.
                const { dynamics } = manifest;
                delete manifest.dynamics;
                manifest.icon = ICON.file;
                manifest.dynamics = dynamics;
                await writeManifest(packDir, manifest);
            }
        }

        // 4. Pack, then install the package as the editor does.
        await mkdir(dirname(out), { recursive: true });
        await pack(packDir, ['--out', out]);
        const bytes = await readFile(out);
        const installed = await page.evaluate(installPackage, {
            id: manifest.id,
            next: bytes.toString('base64'),
            previous: previous ? previous.toString('base64') : null
        });
        if (!installed.error && installed.published && !isNewer(manifest.version, installed.published)) {
            installed.error = `version ${manifest.version} must be higher than the published ${installed.published} — every submission outranks every earlier one`;
        }
        if (installed.error) {
            await unlink(out).catch(() => {});
            fail(installed.error);
        }

        const count = manifest.dynamics.length;
        console.log(`  ✓ ${out} (${count} ${count === 1 ? 'dynamic' : 'dynamics'}, ${bytes.length.toLocaleString('en-US')} bytes)`);
        if (installed.published) console.log(`  ✓ installs over ${installed.published} — documents made with it keep drawing`);
        if (icon) console.log(`    ${join(packDir, ICON.file)}`);
        for (const path of sheets) console.log(`    ${path}`);
    } finally {
        await browser.close();
        server.close();
    }
};

main();
