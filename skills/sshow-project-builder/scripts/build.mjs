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
 *   1. Ingest every asset the actions reference (https URL or path relative
 *      to the actions folder) into the engine's content-addressed store and
 *      rewrite the references to `asset://` uris.
 *   2. Apply each action file, in filename order, as one atomic batch.
 *      Malformed actions are reported with per-action reasons and fail the
 *      build — never silently dropped into a broken document.
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_FILE = join(__dirname, 'harness.html');
const DEFAULT_BUNDLE = 'https://s.show/statics/sshow/index.min.js';
const DEFAULT_OUT = 'out/project.sshow';
const SCREENSHOT_MAX_EDGE = 1280;

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
                bundle: { type: 'string', default: DEFAULT_BUNDLE }
            }
        });
    } catch (error) {
        fail(error.message);
    }
    if (parsed.positionals.length !== 1) {
        fail('usage: node build.mjs <actions-file-or-dir> [--out <file.sshow>] [--bundle <path-or-url>]');
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
const isIngestable = (src) => src.length > 0 && !src.startsWith('asset://') && !src.startsWith('data:');

/** Fetch/read every referenced asset's bytes. Keyed by the literal src string. */
const loadAssetSources = async (files, baseDir) => {
    const sources = new Map();
    for (const { actions } of files) {
        walkSrc(actions, (src) => {
            if (isIngestable(src)) sources.set(src, null);
        });
    }

    for (const src of sources.keys()) {
        const name = basename(new URL(src, 'file:///').pathname) || 'asset';
        const ext = extname(name).slice(1).toLowerCase();
        const mimeType = MIME_BY_EXT[ext];
        if (!mimeType) fail(`unsupported asset extension '.${ext}': ${src}`);

        let bytes;
        if (isRemote(src)) {
            const response = await fetch(src).catch((error) => fail(`asset fetch failed: ${src} — ${error.message}`));
            if (!response.ok) fail(`asset fetch failed: ${src} — HTTP ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
        } else {
            bytes = await readFile(resolve(baseDir, src)).catch(() => fail(`asset not found: ${resolve(baseDir, src)}`));
        }
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

const loadBundle = async (bundle) => {
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

const bootEngine = async (chromium, url) => {
    const browser = await chromium.launch({
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (error) => warn(`engine: ${error.message}`));
    page.on('console', (msg) => {
        if (msg.type() !== 'error' && msg.type() !== 'warning') return;
        if (msg.text().includes('GL Driver Message')) return; // SwiftShader perf noise
        warn(`engine: ${msg.text()}`);
    });

    await page.goto(url);
    await page.waitForFunction(() => window.__sshowReady || window.__sshowError);
    const bootError = await page.evaluate(() => window.__sshowError);
    if (bootError) fail(`engine failed to boot: ${bootError}`);
    return { browser, page };
};

//#endregion

const main = async () => {
    const { actionsPath, out, bundle } = parseCli();

    const { paths, baseDir } = await collectActionFiles(actionsPath);
    const files = [];
    for (const file of paths) {
        files.push({ file, actions: await parseActionFile(file) });
    }

    const sources = await loadAssetSources(files, baseDir);
    const bundleBytes = await loadBundle(bundle);
    const chromium = await importChromium();

    const { server, url } = await serveHarness(bundleBytes);
    const { browser, page } = await bootEngine(chromium, url);

    try {
        // 1. Mint assets into the content-addressed store, rewrite src → asset://
        const uris = new Map();
        for (const [src, { bytes, mimeType, originalName }] of sources) {
            const uri = await page.evaluate(({ b64, mimeType, originalName }) => {
                const bin = atob(b64);
                const data = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
                return window.sshow.getAssets().register(data.buffer, { mimeType, originalName }).uri;
            }, { b64: bytes.toString('base64'), mimeType, originalName });
            uris.set(src, uri);
        }
        for (const { actions } of files) {
            walkSrc(actions, (src) => uris.get(src));
        }

        // 2. Apply each file as one atomic batch; any skipped action fails the build.
        let applied = 0;
        const skipped = [];
        for (const { file, actions } of files) {
            const result = await page.evaluate((actions) => {
                const { batch, applied, skipped } = window.buildActionBatch(window.sshow, actions, 'sshow-project-builder');
                if (applied > 0) window.sshow.getHistory().execute(batch);
                return { applied, skipped };
            }, actions);
            applied += result.applied;
            skipped.push(...result.skipped.map((entry) => ({ file: basename(file), ...entry })));
        }
        if (skipped.length > 0) {
            for (const { file, op, reason } of skipped) console.error(`  ✗ ${file}: ${op} — ${reason}`);
            fail(`${skipped.length} action(s) rejected — fix the reasons above and rebuild`);
        }
        if (applied === 0) fail('no actions applied');

        const sceneIds = await page.evaluate(() => window.sshow.getScenes()
            .getList({ clone: false }).filter((scene) => scene.isVisible()).map((scene) => scene.getId()));
        if (sceneIds.length === 0) {
            fail('document has no scenes — the engine boots empty; create_scene each slide with a self-assigned id');
        }

        // 3. Fonts: await every used family (catalog auto-register + load) so
        //    screenshots and the pack see final glyphs; surface what never resolved.
        const unresolvedFonts = await page.evaluate(async () => {
            const fonts = window.sshow.getFonts();
            const missing = [];
            for (const family of fonts.collectUsedFonts()) {
                if (!(await fonts.waitForReady(family))) missing.push(family);
            }
            return missing;
        });
        for (const family of unresolvedFonts) {
            warn(`font '${family}' did not resolve (not in the catalog / unreachable) — it will render with a system fallback`);
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
                const thumbnail = await scenes.getById(sceneId).getSnapshot({ format: 'webp' });
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
