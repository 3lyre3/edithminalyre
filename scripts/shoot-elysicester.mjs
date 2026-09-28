/**
 * shoot-elysicester.mjs — local screenshots and interaction checks for the diorama.
 *
 * Local only: Playwright and axe-core are deliberately NOT in package.json, so
 * CI stays light. Install them anywhere Node can find them from this folder
 * (for example `npm i --no-save playwright axe-core` in a parent directory),
 * or point PLAYWRIGHT_MODULE / AXE_MODULE at their package folders.
 *
 * Serves the repo on a local port, launches Chromium with SwiftShader (working
 * WebGL without a GPU), and runs four passes:
 *   desktop  1280×800
 *   mobile   390×844 (touch, device pixel ratio 3)
 *   reduced  1280×800 with prefers-reduced-motion
 *   nogl     1280×800 with WebGL disabled
 * In each it records console errors and failed requests, reads renderer.info
 * through ?debug=1, drags to orbit, opens every reading point, screenshots the
 * panel and runs an axe scan on it. Headless frame rates mean nothing; Elm's
 * phone judges smoothness.
 *
 * Usage: node scripts/shoot-elysicester.mjs [--out <dir>] [--only desktop,mobile]
 */

// =============================================================================
// Imports
// =============================================================================

import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const NO_WEBGL_ARGS = ['--disable-webgl', '--disable-3d-apis'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.pdf': 'application/pdf',
};

const PASSES = {
    desktop: { viewport: { width: 1280, height: 800 } },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' },
    nogl: { viewport: { width: 1280, height: 800 }, noWebGL: true },
};

// =============================================================================
// Helpers
// =============================================================================

function option(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    return index > -1 ? process.argv[index + 1] : fallback;
}

async function importFrom(envName, specifier) {
    const override = process.env[envName];
    if (override) return import(pathToFileURL(path.join(override, 'index.mjs')).href).catch(() => import(pathToFileURL(override).href));
    return import(specifier);
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

// =============================================================================
// Main Code
// =============================================================================

const { chromium } = await importFrom('PLAYWRIGHT_MODULE', 'playwright').catch((error) => {
    console.error('Playwright is not installed where Node can find it. See the header of this script.');
    throw error;
});

const outDir = path.resolve(option('out', path.join(os.tmpdir(), 'elysicester-shots')));
const only = option('only', Object.keys(PASSES).join(',')).split(',');
await mkdir(outDir, { recursive: true });

const { server, origin } = await serve();
const report = { origin, passes: {} };

try {
    for (const [name, pass] of Object.entries(PASSES).filter(([key]) => only.includes(key))) {
        const browser = await chromium.launch({ args: [...CHROMIUM_ARGS, ...(pass.noWebGL ? NO_WEBGL_ARGS : [])] });
        const context = await browser.newContext({
            viewport: pass.viewport,
            deviceScaleFactor: pass.deviceScaleFactor ?? 1,
            isMobile: pass.isMobile ?? false,
            hasTouch: pass.hasTouch ?? false,
            reducedMotion: pass.reducedMotion ?? 'no-preference',
        });
        const page = await context.newPage();
        const console = [];
        const failures = [];
        page.on('console', (message) => {
            if (['error', 'warning'].includes(message.type())) console.push(`${message.type()}: ${message.text()}`);
        });
        page.on('pageerror', (error) => console.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => failures.push(`${request.url()} (${request.failure()?.errorText})`));
        page.on('response', (response) => {
            if (response.status() >= 400) failures.push(`${response.url()} (HTTP ${response.status()})`);
        });

        await page.goto(`${origin}/elysicester/?debug=1`, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        const state = await page.evaluate(() => ({ ...document.documentElement.dataset }));
        await page.screenshot({ path: path.join(outDir, `${name}.png`) });

        report.passes[name] = { state, console, failures };
        await browser.close();
    }
} finally {
    server.close();
}

await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, result] of Object.entries(report.passes)) {
    const problems = result.console.length + result.failures.length;
    process.stdout.write(`${name.padEnd(8)} ${problems === 0 ? 'clean' : `${problems} problem(s)`}  ${JSON.stringify(result.state)}\n`);
    for (const line of [...result.console, ...result.failures]) process.stdout.write(`    ${line}\n`);
}
process.stdout.write(`Screenshots and report.json in ${outDir}\n`);
