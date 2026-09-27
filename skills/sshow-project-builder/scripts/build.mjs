#!/usr/bin/env node
/**
 * Build a .sshow project from action-batch JSON files.
 *
 * Usage:
 *     node build.mjs <actions-file-or-dir> [--out <file.sshow>] [--bundle <path-or-url>]
 *
 * Drives the real SSHOW engine (headless Chromium, software WebGL) through
 * the same `buildActionBatch` compiler the editor's AI panel, the Studio MCP
 * server, and plugins use — so a document that builds here loads cleanly
 * everywhere, with no second implementation of the format. Pipeline:
 *
 *   1. Ingest every asset the actions reference (https URL, data: URI, or
 *      path relative to the actions folder) into the engine's
 *      content-addressed store and rewrite the references to `asset://` uris.
 *   2. Apply every action file, in filename order, as one atomic batch — an
 *      alias one file declares is live in every later one. Malformed actions
 *      are reported with per-action reasons and fail the build — never
 *      silently dropped into a broken document.
 *   3. Capture one screenshot per scene (long edge 1280) for visual review,
 *      plus editor-idiom scene thumbnails for dashboard previews.
 *   4. Pack via the engine's own `.sshow` writer (fonts settled/embedded,
 *      hashes and zip layout guaranteed by the engine, not this script).
 */

import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_FILE = join(__dirname, 'harness.html');
const VENDORED_BUNDLE = join(__dirname, '..', 'engine', 'sshow.min.js.gz');
const DEFAULT_BUNDLE = 'https://s.show/sshow/index.min.js';
const DEFAULT_OUT = 'out/project.sshow';
const SCREENSHOT_MAX_EDGE = 1280;
const CHROMIUM_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];

const MIME_BY_EXT = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
    aac: 'audio/aac', flac: 'audio/flac'
};

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
                out: { type: 'string', default: DEFAULT_OUT },
                bundle: { type: 'string' },
                check: { type: 'boolean', default: false }
            }
        });
    } catch (error) {
        fail(error.message);
    }
    if (parsed.values.check) return { check: true };
    if (parsed.positionals.length !== 1) {
        fail('usage: node build.mjs <actions-file-or-dir> [--out <file.sshow>] [--bundle <path-or-url>]\n         node build.mjs --check');
    }
    return { actionsPath: resolve(parsed.positionals[0]), out: resolve(parsed.values.out), bundle: parsed.values.bundle };
};

/**
 * Collect action files — a single .json file, or a folder's *.json in
 * filename order. `baseDir` anchors relative asset paths.
 */
const collectActionFiles = async (actionsPath) => {
    const stats = await stat(actionsPath).catch(() => null);
    if (!stats) fail(`not found: ${actionsPath}`);
    if (stats.isFile()) return { paths: [actionsPath], baseDir: dirname(actionsPath) };

    const names = (await readdir(actionsPath)).filter((name) => name.endsWith('.json')).sort();
    if (names.length === 0) fail(`no .json action files in ${actionsPath}`);
    return { paths: names.map((name) => join(actionsPath, name)), baseDir: actionsPath };
};

/** Parse one action file — `{ actions: [...] }` (canonical) or a bare array. */
const parseActionFile = async (file) => {
    let data;
    try {
        data = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
        fail(`${basename(file)}: not valid JSON — ${error.message}`);
    }
    const actions = Array.isArray(data) ? data : data?.actions;
    if (!Array.isArray(actions) || actions.length === 0) {
        fail(`${basename(file)}: expected { "actions": [ ... ] }`);
    }
    return actions;
};

//#endregion

//#region ---------- Assets ----------

/**
 * Deep-walk actions and visit every `src` string. The action vocabulary uses
 * `src` in exactly two places — media `data.src` and image-fill paints — and
 * `visit` may return a replacement value (used for the asset:// rewrite pass).
 */
const walkSrc = (node, visit) => {
    if (Array.isArray(node)) {
        node.forEach((item) => walkSrc(item, visit));
        return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
        if (key === 'src' && typeof value === 'string') {
            const replacement = visit(value);
            if (replacement !== undefined) node[key] = replacement;
        } else {
            walkSrc(value, visit);
        }
    }
};

const isRemote = (src) => src.startsWith('https://') || src.startsWith('http://');
const isDataUri = (src) => src.startsWith('data:');
const isIngestable = (src) => src.length > 0 && !src.startsWith('asset://');

/**
 * Fetch/read every referenced asset's bytes. Keyed by the literal src string.
 * The type comes from the file extension, else — a URL without one, a data:
 * URI — from the type the response or the URI declares.
 */
const loadAssetSources = async (files, baseDir) => {
    const sources = new Map();
    for (const { actions } of files) {
        walkSrc(actions, (src) => {
            if (isIngestable(src)) sources.set(src, null);
        });
    }

    for (const src of sources.keys()) {
        const label = isDataUri(src) ? `${src.slice(0, 40)}…` : src;
        let bytes;
        let declaredType;
        if (isRemote(src) || isDataUri(src)) {
            const response = await fetch(src).catch((error) => fail(`asset fetch failed: ${label} — ${error.message}`));
            if (!response.ok) fail(`asset fetch failed: ${label} — HTTP ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
            declaredType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        } else {
            bytes = await readFile(resolve(baseDir, src)).catch(() => fail(`asset not found: ${resolve(baseDir, src)}`));
        }

        // A data: URI carries no file name (the engine's own idiom: null).
        const name = isDataUri(src) ? null : basename(isRemote(src) ? new URL(src).pathname : src) || null;
        const mimeType = MIME_BY_EXT[extname(name ?? '').slice(1).toLowerCase()]
            ?? (Object.values(MIME_BY_EXT).includes(declaredType) ? declaredType : null);
        if (!mimeType) fail(`unsupported asset type: ${label} — use ${Object.keys(MIME_BY_EXT).join('/')}`);
        sources.set(src, { bytes, mimeType, originalName: name });
    }
    return sources;
};

//#endregion

//#region ---------- Engine harness ----------

const importChromium = async () => {
    for (const pkg of ['playwright', '@playwright/test']) {
        const mod = await import(pkg).catch(() => null);
        if (mod?.chromium) return mod.chromium;
    }
    fail('playwright is required — npm i playwright && npx playwright install chromium');
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
 * Prerequisite probe (`--check`) — node version, playwright, and a real
 * chromium launch. Run it before authoring anywhere the runner might not be
 * installable, so the deck is never written against an environment that
 * cannot build it.
 */
const preflight = async () => {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 20) fail(`node ${process.versions.node} — the runner needs node 20+`);
    const { browser, label } = await launchBrowser();
    await browser.close();
    console.error(`  ✓ node ${process.versions.node} + ${label} ready`);
};

/**
 * Resolve the engine bundle: explicit --bundle (path or url) wins, then the
 * vendored gzip shipped with the skill (offline-capable, pinned to the same
 * build the references were extracted from), then the production bundle.
 */
const loadBundle = async (bundle) => {
    if (!bundle) {
        const vendored = await readFile(VENDORED_BUNDLE).catch(() => null);
        if (vendored) return gunzipSync(vendored);
        bundle = DEFAULT_BUNDLE;
    }
    if (isRemote(bundle)) {
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
        // SwiftShader perf noise, and pixi noting a snapshot freed a texture it still had bound
        if (/GL Driver Message|\[BindGroup\]/.test(msg.text())) return;
        warn(`engine: ${msg.text()}`);
    });

    await page.goto(url);
    await page.waitForFunction(() => window.__sshowReady || window.__sshowError);
    const bootError = await page.evaluate(() => window.__sshowError);
    if (bootError) fail(`engine failed to boot: ${bootError}`);
    return page;
};

//#endregion

const main = async () => {
    const { actionsPath, out, bundle, check } = parseCli();
    if (check) return preflight();

    const { paths, baseDir } = await collectActionFiles(actionsPath);
    const files = [];
    for (const file of paths) {
        files.push({ file, actions: await parseActionFile(file) });
    }

    const sources = await loadAssetSources(files, baseDir);
    const bundleBytes = await loadBundle(bundle);
    const { server, url } = await serveHarness(bundleBytes);
    const { browser, label } = await launchBrowser();
    if (label !== BROWSERS[0].label) warn(`using ${label} — not the version-pinned chromium, so rendering can differ`);

    const page = await bootEngine(browser, url);

    try {
        // 1. Mint assets into the content-addressed store, rewrite src → asset://,
        //    and measure each picture and clip (null when the browser can't decode it).
        const uris = new Map();
        const pixels = new Map();
        for (const [src, { bytes, mimeType, originalName }] of sources) {
            const { uri, size } = await page.evaluate(async ({ b64, mimeType, originalName }) => {
                const bin = atob(b64);
                const data = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
                const { uri, url } = window.sshow.getAssets().register(data.buffer, { mimeType, originalName });
                const media = mimeType.startsWith('image/') ? new Image() : mimeType.startsWith('video/') ? document.createElement('video') : null;
                const size = media && await new Promise((done) => {
                    media.onload = media.onloadedmetadata = () => done({
                        width: media.naturalWidth || media.videoWidth,
                        height: media.naturalHeight || media.videoHeight
                    });
                    media.onerror = () => done(null);
                    media.src = url;
                });
                return { uri, size };
            }, { b64: bytes.toString('base64'), mimeType, originalName });
            uris.set(src, uri);
            if (size?.width && size?.height) pixels.set(uri, { src: isDataUri(src) ? 'its data: URI' : src, ...size });
        }
        for (const { actions } of files) {
            walkSrc(actions, (src) => uris.get(src));
        }

        // 2. Apply every file, in filename order, as ONE atomic batch — so an
        //    alias any file declares is live for every action after it. Any
        //    skipped action fails the build, named by its file and position.
        const origins = files.flatMap(({ file, actions }) => actions.map((_, index) => `${basename(file)} #${index + 1}`));
        const { applied, skipped, ids, error } = await page.evaluate((actions) => {
            const { batch, applied, skipped, ids } = window.buildActionBatch(window.sshow, actions, 'sshow-project-builder');
            try {
                if (applied > 0) window.sshow.getHistory().execute(batch);
            } catch (error) {
                return { applied, skipped, ids, error: error?.message ?? String(error) };
            }
            return { applied, skipped, ids };
        }, files.flatMap(({ actions }) => actions));
        if (skipped.length > 0) {
            for (const { index, op, reason } of skipped) console.error(`  ✗ ${origins[index]}: ${op} — ${reason}`);
            fail(`${skipped.length} action(s) rejected — fix the reasons above and rebuild`);
        }
        if (error) {
            // Only running the batch finds some mistakes (a sceneId that is not
            // the scene holding the object), and the engine names the id it
            // minted — name the author's alias beside it.
            const named = Object.entries({ ...ids.objects, ...ids.scenes, ...ids.variables })
                .filter(([, id]) => new RegExp(`\\b${id}\\b`).test(error))
                .map(([alias, id]) => `${id} is '${alias}'`);
            fail(`the actions could not be applied — ${error}${named.length > 0 ? ` (${named.join(', ')})` : ''}`);
        }
        if (applied === 0) fail('no actions applied');

        const sceneIds = await page.evaluate(() => window.sshow.getScenes()
            .getList({ clone: false }).filter((scene) => scene.isVisible()).map((scene) => scene.getId()));
        if (sceneIds.length === 0) {
            fail('document has no scenes — the engine boots empty; create_scene each slide with an alias of your own');
        }

        // Media draws stretched to its box (there is no fit or cover) — name
        // every picture or clip whose box does not keep its asset's ratio.
        const boxes = await page.evaluate(() => window.sshow.getScenes().getList({ clone: false }).flatMap((scene) =>
            [...scene.getObjects().getMap({ clone: false }).values()]
                .filter((object) => object.getType() === 'image' || object.getType() === 'video')
                .map((object) => ({ scene: scene.getName(), name: object.getName(), src: object.getData().src, ...object.getSize() }))));
        for (const { scene, name, src, width, height } of boxes) {
            const asset = pixels.get(src);
            const ratio = asset && asset.width / asset.height;
            if (!asset || Math.abs(height - width / ratio) <= Math.max(1, height * 0.01)) continue;
            warn(`${scene} › '${name}' is ${width}×${height} but ${asset.src} is ${asset.width}×${asset.height} — it draws stretched; keep the ratio (e.g. ${width}×${Math.round(width / ratio)})`);
        }

        // 3. Fonts: await every used family (catalog auto-register + load) so
        //    screenshots and the pack see final glyphs; surface what never
        //    loaded. waitForReady alone passes an unknown name (the browser
        //    vouches for a family it has no face for), so ask isLoaded.
        const unresolvedFonts = await page.evaluate(async () => {
            const fonts = window.sshow.getFonts();
            const missing = [];
            for (const family of fonts.collectUsedFonts()) {
                await fonts.waitForReady(family);
                if (!fonts.isLoaded(family)) missing.push(family);
            }
            if (missing.length === 0) return [];
            const reachable = (await fonts.getCatalog()).length > 0;
            return missing.map((family) => ({
                family,
                reason: fonts.has(family) ? 'its files did not load' : reachable ? 'it is not in the catalog' : 'the font catalog is unreachable'
            }));
        });
        for (const { family, reason } of unresolvedFonts) {
            warn(`font '${family}' did not resolve (${reason}) — it will render with a system fallback`);
        }

        // 4. Screenshots (visual review) + editor-idiom thumbnails, per visible scene.
        const canvas = await page.evaluate(() => window.sshow.getScenes().getSize());
        const resolution = Math.min(1, SCREENSHOT_MAX_EDGE / Math.max(canvas.width, canvas.height));
        const scenesDir = join(dirname(out), 'scenes');
        await mkdir(scenesDir, { recursive: true });
        await page.evaluate(() => window.sshow.getRenderer().setExportTime(0));
        const screenshots = [];
        for (const [index, sceneId] of sceneIds.entries()) {
            const dataUrl = await page.evaluate(async ({ sceneId, resolution }) => {
                const scenes = window.sshow.getScenes();
                const thumbnail = await scenes.getById(sceneId).getSnapshot({ format: 'webp', preview: true });
                scenes._setThumbnail(sceneId, thumbnail);
                return scenes.getById(sceneId).getSnapshot({ format: 'png', quality: 1, resolution, type: 'base64' });
            }, { sceneId, resolution });
            const path = join(scenesDir, `${String(index + 1).padStart(2, '0')}-${sceneId}.png`);
            await writeFile(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
            screenshots.push(path);
        }

        // 5. Pack through the engine's own writer.
        const packed = await page.evaluate(async () => {
            const buffer = await window.sshow.getIO().toSSHOW();
            const bytes = new Uint8Array(buffer);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 0x8000) {
                bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            }
            return btoa(bin);
        });
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, Buffer.from(packed, 'base64'));

        console.log(`  ✓ ${out} (${sceneIds.length} scenes, ${applied} actions, ${sources.size} assets)`);
        for (const path of screenshots) console.log(`    ${path}`);
    } finally {
        await browser.close();
        server.close();
    }
};

main();
