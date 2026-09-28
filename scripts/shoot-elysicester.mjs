/**
 * shoot-elysicester.mjs — local screenshots and interaction checks for the diorama.
 *
 * Local only: Playwright and axe-core are deliberately NOT in package.json, so
 * CI stays light. Install them anywhere Node can find them from this folder
 * (for example `npm i --no-save playwright axe-core` in a parent directory).
 *
 * Serves the repo on a local port and launches Chromium with SwiftShader
 * (working WebGL without a GPU). Four passes:
 *   desktop  1280×800
 *   mobile   390×844 (touch, device pixel ratio 3)
 *   reduced  1280×800 with prefers-reduced-motion
 *   nogl     1280×800 with WebGL disabled
 * Each records console errors and failed requests, reads renderer.info through
 * ?debug=1, drags to orbit (mouse or real touch events) and screenshots before
 * and after. The reduced pass also waits past the idle delay to confirm the
 * view doesn't drift. Headless frame rates mean nothing; Elm's phone judges
 * smoothness.
 *
 *   node scripts/shoot-elysicester.mjs [--out <dir>] [--only desktop,mobile]
 *   node scripts/shoot-elysicester.mjs --stills    (re-render the fallback stills)
 */

// =============================================================================
// Imports
// =============================================================================

import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const NO_WEBGL_ARGS = ['--disable-webgl', '--disable-3d-apis'];
const LOAD_TIMEOUT = 90_000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
};

const PASSES = {
    desktop: { viewport: { width: 1280, height: 800 } },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', checkStillness: true },
    nogl: { viewport: { width: 1280, height: 800 }, noWebGL: true },
};

const STILLS = [
    { pass: 'desktop', file: 'fallback.webp', width: 1024 },
    { pass: 'mobile', file: 'fallback-portrait.webp', height: 1024 },
];

// =============================================================================
// Helpers
// =============================================================================

function option(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index > -1 ? process.argv[index + 1] : fallback;
}

/** A tiny static server for the repo root; the diorama needs http for modules. */
async function serve() {
    const server = createServer(async (request, response) => {
        try {
            let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            if (pathname.endsWith('/')) pathname += 'index.html';
            const file = path.join(ROOT, pathname);
            if (!file.startsWith(ROOT)) throw new Error('outside root');
            const info = await stat(file);
            if (!info.isFile()) throw new Error('not a file');
            response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
            response.end(await readFile(file));
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain' });
            response.end('not found');
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function openPass(chromium, pass) {
    const browser = await chromium.launch({ args: [...CHROMIUM_ARGS, ...(pass.noWebGL ? NO_WEBGL_ARGS : [])] });
    const context = await browser.newContext({
        viewport: pass.viewport,
        deviceScaleFactor: pass.deviceScaleFactor ?? 1,
        isMobile: pass.isMobile ?? false,
        hasTouch: pass.hasTouch ?? false,
        reducedMotion: pass.reducedMotion ?? 'no-preference',
    });
    const page = await context.newPage();
    const messages = [];
    const failures = [];
    page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => failures.push(`${request.url()} (${request.failure()?.errorText})`));
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.url()} (HTTP ${response.status()})`);
    });
    return { browser, context, page, messages, failures };
}

/** Wait until the page has chosen live or still, and a live scene has drawn frames. */
async function settle(page) {
    await page.waitForFunction(() => ['live', 'still'].includes(document.documentElement.dataset.mode), null, { timeout: LOAD_TIMEOUT });
    const mode = await page.evaluate(() => document.documentElement.dataset.mode);
    if (mode === 'live') {
        await page.waitForFunction(() => (window.elysicesterDebug?.info().calls ?? 0) > 0, null, { timeout: LOAD_TIMEOUT });
        await page.waitForTimeout(1500);
    } else {
        await page.waitForTimeout(500);
    }
    return mode;
}

async function rigAngles(page) {
    return page.evaluate(() => {
        const { theta, phi, radius } = window.elysicesterDebug.rig.now;
        return { theta, phi, radius };
    });
}

/** Drag across the canvas: a mouse on desktop, real touch points on touch devices. */
async function drag(page, context, touch, from, to) {
    if (!touch) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        for (let step = 1; step <= 12; step += 1) {
            await page.mouse.move(from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
        }
        await page.mouse.up();
        return;
    }
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let step = 1; step <= 12; step += 1) {
        await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: from.x + ((to.x - from.x) * step) / 12, y: from.y + ((to.y - from.y) * step) / 12 }],
        });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function hideChrome(page) {
    await page.addStyleTag({ content: '.plainly, .debug-readout { visibility: hidden !important; }' });
}

/** Encode a PNG as a WebP of the given size, using the browser's own encoder. */
async function toWebP(page, png, width, height) {
    return page.evaluate(async ({ source, width: w, height: h }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const targetWidth = w ?? Math.round((image.width * h) / image.height);
        const targetHeight = h ?? Math.round((image.height * w) / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        return canvas.toDataURL('image/webp', 0.8).split(',')[1];
    }, { source: `data:image/png;base64,${png.toString('base64')}`, width, height });
}

// =============================================================================
// Main Code
// =============================================================================

const { chromium } = await import('playwright').catch((error) => {
    console.error('Playwright is not installed where Node can find it. See the header of this script.');
    throw error;
});
const { server, origin } = await serve();

try {
    if (process.argv.includes('--stills')) {
        for (const still of STILLS) {
            const session = await openPass(chromium, PASSES[still.pass]);
            await session.page.goto(`${origin}/elysicester/?debug=1`, { waitUntil: 'load' });
            const mode = await settle(session.page);
            if (mode !== 'live') throw new Error(`${still.pass}: the scene did not go live (${mode})`);
            await hideChrome(session.page);
            await session.page.waitForTimeout(400);
            const png = await session.page.locator('#stage').screenshot();
            const webp = Buffer.from(await toWebP(session.page, png, still.width, still.height), 'base64');
            await writeFile(path.join(ROOT, 'elysicester', still.file), webp);
            process.stdout.write(`${still.file}: ${webp.length} bytes\n`);
            await session.browser.close();
        }
    } else {
        const outDir = path.resolve(option('out', path.join(os.tmpdir(), 'elysicester-shots')));
        const only = option('only', Object.keys(PASSES).join(',')).split(',');
        await mkdir(outDir, { recursive: true });
        const report = { origin, passes: {} };

        for (const [name, pass] of Object.entries(PASSES).filter(([key]) => only.includes(key))) {
            const { browser, context, page, messages, failures } = await openPass(chromium, pass);
            await page.goto(`${origin}/elysicester/?debug=1`, { waitUntil: 'load' });
            const mode = await settle(page);
            const result = { mode, messages, failures };
            await page.screenshot({ path: path.join(outDir, `${name}.png`) });

            if (mode === 'live') {
                result.info = await page.evaluate(() => window.elysicesterDebug.info());
                const before = await rigAngles(page);
                const { width, height } = pass.viewport;
                await drag(page, context, Boolean(pass.hasTouch), { x: width * 0.5, y: height * 0.55 }, { x: width * 0.75, y: height * 0.5 });
                await page.waitForTimeout(1200);
                const after = await rigAngles(page);
                result.drag = { before, after, orbited: Math.abs(after.theta - before.theta) > 0.05 };
                await page.screenshot({ path: path.join(outDir, `${name}-dragged.png`) });

                if (pass.checkStillness) {
                    const start = await rigAngles(page);
                    await page.waitForTimeout(10_000);
                    const end = await rigAngles(page);
                    result.stillness = { drifted: Math.abs(end.theta - start.theta) > 1e-4 };
                }
            }
            report.passes[name] = result;
            await browser.close();
        }

        await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
        for (const [name, result] of Object.entries(report.passes)) {
            const problems = result.messages.length + result.failures.length;
            const info = result.info ? `${result.info.calls} calls, ${result.info.triangles} tris` : '';
            const orbit = result.drag ? (result.drag.orbited ? 'drag orbits' : 'DRAG DID NOT ORBIT') : '';
            const still = result.stillness ? (result.stillness.drifted ? 'DRIFTED under reduced motion' : 'no drift') : '';
            process.stdout.write(`${name.padEnd(8)} ${result.mode.padEnd(6)} ${problems === 0 ? 'clean' : `${problems} problem(s)`}  ${[info, orbit, still].filter(Boolean).join(' · ')}\n`);
            for (const line of [...result.messages, ...result.failures]) process.stdout.write(`    ${line}\n`);
        }
        process.stdout.write(`Screenshots and report.json in ${outDir}\n`);
    }
} finally {
    server.close();
}
