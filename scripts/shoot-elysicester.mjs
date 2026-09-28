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
 *   nogl     1280×800 with WebGL disabled (the still and its list)
 * In each: console errors and failed requests are recorded; the threshold is
 * crossed (the card is screenshotted, then begun by click, tap or a key; the
 * desktop pass watches the whole Intermaze, the mobile pass skips it with a
 * tap, the reduced and still passes must crossfade with no flight at all);
 * renderer.info is read through ?debug=1, the view is dragged (mouse, or real
 * touch points), every reading point is opened by pointer (or, in the still,
 * by its link) and by keyboard (Tab, Enter, Esc, and focus must come back),
 * each panel is screenshotted and scanned with axe, and a reload must keep
 * read points dim. Sound must stay off until the toggle turns it on (desktop),
 * and a remembered "on" must wait for the beginning gesture (reduced). The
 * reduced pass also waits past the idle delay to confirm nothing drifts.
 * Before the passes, every outside "read on" address is asked whether it
 * answers. Headless frame rates mean nothing; Elm's phone judges smoothness.
 *
 *   node scripts/shoot-elysicester.mjs [--out <dir>] [--only desktop,mobile] [--quick]
 *   node scripts/shoot-elysicester.mjs --stills    (re-render the fallback stills)
 */

// =============================================================================
// Imports
// =============================================================================

import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const NO_WEBGL_ARGS = ['--disable-webgl', '--disable-3d-apis'];
const LOAD_TIMEOUT = 90_000;
const SERIOUS = new Set(['serious', 'critical']);

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

/**
 * begin: how the visitor begins (click, tap, key). then: what they do in the
 * flight (watch it all, or skip). expect: the threshold's path. sound: run the
 * toggle round; soundOn: arrive with "sound on" remembered from a past visit.
 */
const PASSES = {
    desktop: { viewport: { width: 1280, height: 800 }, keyboard: true, begin: 'click', then: 'watch', expect: 'flight', sound: true },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, begin: 'tap', then: 'skip', expect: 'flight' },
    reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', checkStillness: true, keyboard: true, begin: 'key', expect: 'crossfade', sound: true, soundOn: true },
    nogl: { viewport: { width: 1280, height: 800 }, noWebGL: true, keyboard: true, begin: 'click', expect: 'crossfade' },
};

/** Log every change of data-threshold and data-mode from the first moment, with its time. */
function watchThreshold() {
    window.__elysicesterLog = [];
    new MutationObserver((records) => {
        for (const record of records) {
            window.__elysicesterLog.push({ at: performance.now(), name: record.attributeName, value: record.target.getAttribute(record.attributeName) });
        }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-threshold', 'data-mode'] });
}

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
    await context.addInitScript(watchThreshold);
    const page = await context.newPage();
    const messages = [];
    const failures = [];
    page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => {
        // Leaving the page mid-request (a reload) is not a failure of the page.
        if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(`${request.url()} (${request.failure()?.errorText})`);
    });
    page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.url()} (HTTP ${response.status()})`);
    });
    return { browser, context, page, messages, failures };
}

/** Wait until the page has chosen live or still, and a live scene has drawn frames (and the veil has lifted). */
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

async function soundReading(page) {
    return page.evaluate(() => {
        const toggle = document.getElementById('sound-toggle');
        let stored = null;
        try {
            stored = window.localStorage.getItem('elysicester:sound');
        } catch {
            stored = 'unreadable';
        }
        return { state: window.elysicesterDebug?.audio?.state ?? null, pressed: toggle.getAttribute('aria-pressed'), label: toggle.textContent, stored };
    });
}

async function soundState(page, want) {
    await page.waitForFunction((wanted) => window.elysicesterDebug?.audio?.state === wanted, want, { timeout: 5000 }).catch(() => {});
    return soundReading(page);
}

/**
 * Cross the threshold as a visitor would: wait for the card (screenshot it),
 * begin (click, tap or a key), then watch the flight, or skip it with a tap or
 * Esc, and wait until the city (or its still) has arrived. Returns what the
 * threshold did, with timings in page milliseconds.
 */
/** Screenshot the flight while one of E's lines is fully surfaced. */
async function shotWhenSpoken(page, line, file) {
    await page.waitForFunction((text) => {
        const voice = document.getElementById('threshold-voice');
        return voice.textContent === text && Number(getComputedStyle(voice).opacity) > 0.97;
    }, line, { timeout: 30_000, polling: 'raf' });
    await page.screenshot({ path: file });
}

async function enter(page, context, pass, { begin, then = 'watch', shots = null, voiceLines = null }) {
    const lines = voiceLines?.length ?? null;
    await page.waitForFunction(() => document.documentElement.dataset.threshold === 'card', null, { timeout: LOAD_TIMEOUT });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const card = await page.evaluate(() => ({
        prompt: document.getElementById('threshold-prompt').innerHTML,
        pointsInert: document.getElementById('points').inert,
    }));
    card.sound = await soundReading(page);
    if (shots) {
        await page.waitForTimeout(4500);
        await page.screenshot({ path: `${shots}-card.png` });
    }

    const { width, height } = pass.viewport;
    if (begin === 'tap') await touch(context, page, [{ x: width / 2, y: height / 2 }]);
    else if (begin === 'key') await page.keyboard.press('Enter');
    else await page.click('#threshold-begin');
    await page.waitForFunction(() => document.documentElement.dataset.threshold !== 'card', null, { timeout: 10_000 });
    const path1 = await page.evaluate(() => document.documentElement.dataset.threshold);
    const begun = { sound: await soundReading(page) };

    let skipAt = null;
    if (path1 === 'flight') {
        if (then === 'skip') {
            if (shots && voiceLines?.length > 1) await shotWhenSpoken(page, voiceLines[1], `${shots}-flight.png`);
            else await page.waitForTimeout(1500);
            skipAt = await page.evaluate(() => performance.now());
            if (pass.hasTouch) await touch(context, page, [{ x: width / 2, y: height / 2 }]);
            else await page.keyboard.press('Escape');
        } else if (shots && voiceLines) {
            const chosen = [1, 2, voiceLines.length - 1].filter((index, at, all) => index < voiceLines.length && all.indexOf(index) === at);
            for (const [number, index] of chosen.entries()) {
                await shotWhenSpoken(page, voiceLines[index], `${shots}-flight-${number + 1}.png`);
            }
        }
    }
    await page.waitForFunction(() => document.documentElement.dataset.threshold === 'done', null, { timeout: LOAD_TIMEOUT });
    const mode = await settle(page);
    const after = await page.evaluate(() => ({
        log: window.__elysicesterLog ?? [],
        passage: window.elysicesterDebug?.threshold ?? null,
        begunAt: window.elysicesterDebug?.begunAt ?? null,
        readyAt: window.elysicesterDebug?.readyAt ?? null,
        focus: document.activeElement?.id || document.activeElement?.tagName || null,
        pointsInert: document.getElementById('points').inert,
        cardHidden: document.getElementById('threshold').hidden,
        veilDark: document.getElementById('veil').classList.contains('is-dark'),
    }));
    const sequence = after.log.filter((entry) => entry.name === 'data-threshold').map((entry) => entry.value);
    const doneAt = after.log.find((entry) => entry.name === 'data-threshold' && entry.value === 'done')?.at ?? null;
    const result = {
        mode,
        sequence: sequence.join(' > '),
        passage: after.passage,
        began: begin,
        card,
        begun,
        readyBeforeBegin: after.readyAt !== null && after.begunAt !== null ? after.readyAt < after.begunAt : null,
        beginToDone: doneAt !== null && after.begunAt !== null ? Math.round(doneAt - after.begunAt) : null,
        skipToDone: doneAt !== null && skipAt !== null ? Math.round(doneAt - Math.max(skipAt, after.readyAt ?? 0)) : null,
        focus: after.focus,
        pointsInertOnCard: card.pointsInert,
        pointsInertAfter: after.pointsInert,
        cardHidden: after.cardHidden,
        veilDark: after.veilDark,
    };
    const problems = [];
    if (result.sequence !== `card > ${pass.expect} > done`) problems.push(`sequence was ${result.sequence}`);
    if (pass.expect === 'crossfade' && after.passage?.frames !== 0) problems.push('the tunnel drew frames under a crossfade');
    if (pass.expect === 'flight' && !(after.passage?.frames > 0)) problems.push('no flight frames');
    if (then === 'watch' && pass.expect === 'flight') {
        if (after.passage?.skipped) problems.push('the flight was skipped by itself');
        if (lines !== null && after.passage?.linesShown !== lines) problems.push(`${after.passage?.linesShown} of ${lines} lines surfaced`);
    }
    if (then === 'skip' && pass.expect === 'flight') {
        if (!after.passage?.skipped) problems.push('the skip was not heard');
        if (result.skipToDone === null || result.skipToDone > 2500) problems.push(`skip took ${result.skipToDone} ms to land`);
    }
    if (!card.pointsInert) problems.push('the points were reachable behind the card');
    if (after.pointsInert) problems.push('the points stayed inert after the threshold');
    if (!after.cardHidden) problems.push('the card is still there');
    if (after.veilDark) problems.push('the veil stayed dark');
    if (after.focus !== 'diorama-title') problems.push(`focus landed on ${after.focus}`);
    result.problems = problems;
    result.ok = problems.length === 0;
    return result;
}

/**
 * The sound switch. Arriving with nothing remembered, sound must be off, turn
 * on with the toggle and off again. Arriving with "on" remembered, it must
 * have waited for the beginning gesture, then be running; the toggle stops it.
 */
async function soundRound(page, pass, entered) {
    const problems = [];
    if (entered.card.sound.state !== 'off') problems.push(`sound was ${entered.card.sound.state} on the card, before any gesture`);
    const steps = [];
    if (pass.soundOn) {
        if (entered.card.sound.pressed !== 'true') problems.push('the remembered "on" was not shown on the card');
        const running = await soundState(page, 'running');
        steps.push({ after: 'begin', ...running });
        if (running.state !== 'running') problems.push(`after the beginning gesture sound was ${running.state}`);
        await page.click('#sound-toggle');
        const off = await soundState(page, 'off');
        steps.push({ after: 'toggle', ...off });
        if (off.state !== 'off' || off.pressed !== 'false' || off.label !== 'sound off') problems.push('the toggle did not turn it off');
    } else {
        const start = await soundReading(page);
        steps.push({ after: 'arrival', ...start });
        if (start.state !== 'off' || start.pressed !== 'false' || start.label !== 'sound off') problems.push(`sound was ${start.state} before the toggle`);
        await page.click('#sound-toggle');
        const on = await soundState(page, 'running');
        steps.push({ after: 'toggle on', ...on });
        if (on.state !== 'running' || on.pressed !== 'true' || on.label !== 'sound on' || on.stored !== '"on"') problems.push(`the toggle gave ${JSON.stringify(on)}`);
        await page.click('#sound-toggle');
        const off = await soundState(page, 'off');
        steps.push({ after: 'toggle off', ...off });
        if (off.state !== 'off' || off.pressed !== 'false' || off.label !== 'sound off' || off.stored !== '"off"') problems.push(`the second toggle gave ${JSON.stringify(off)}`);
    }
    return { steps, problems, ok: problems.length === 0 };
}

async function rigAngles(page) {
    return page.evaluate(() => {
        const { theta, phi, radius } = window.elysicesterDebug.rig.now;
        return { theta, phi, radius };
    });
}

async function touch(context, page, points) {
    const client = await context.newCDPSession(page);
    const [first, ...rest] = points;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
    for (const point of rest) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
}

/** Drag across the canvas: a mouse on desktop, real touch points on touch devices. */
async function drag(page, context, isTouch, from, to) {
    const steps = Array.from({ length: 12 }, (_, index) => ({
        x: from.x + ((to.x - from.x) * (index + 1)) / 12,
        y: from.y + ((to.y - from.y) * (index + 1)) / 12,
    }));
    if (isTouch) {
        await touch(context, page, [from, ...steps]);
        return;
    }
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const step of steps) await page.mouse.move(step.x, step.y);
    await page.mouse.up();
}

async function hideChrome(page) {
    await page.addStyleTag({ content: '.plainly, .debug-readout, .controls, .threshold-voice, .veil, .point-label { visibility: hidden !important; }' });
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

// -----------------------------------------------------------------------------
// The reader and its points
// -----------------------------------------------------------------------------

async function readerState(page) {
    return page.evaluate(() => ({
        open: document.getElementById('reader').open,
        text: document.querySelector('[data-reader-text]').textContent,
        active: document.activeElement?.dataset?.fragment ?? document.activeElement?.tagName ?? null,
    }));
}

async function scanReader(page) {
    const loaded = await page.evaluate(() => Boolean(window.axe));
    if (!loaded) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    return page.evaluate(async () => {
        const result = await window.axe.run(document.getElementById('reader'), { resultTypes: ['violations'] });
        return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
    });
}

function firstWords(fragment) {
    return fragment.text.split(/\n{2,}/)[0].slice(0, 28);
}

/** Open, look, scan, close: one reading point's round trip. */
async function inspectOpen(page, fragment, shot) {
    await page.waitForFunction(() => document.getElementById('reader').open, null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(200);
    const state = await readerState(page);
    const matched = state.open && state.text.includes(firstWords(fragment));
    if (shot) await page.screenshot({ path: shot });
    const violations = state.open ? await scanReader(page) : [];
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const after = await readerState(page);
    return { matched, closed: !after.open, activeAfter: after.active, violations };
}

/** Wait until the camera has finished easing toward its goal. */
async function cameraSettled(page) {
    await page.waitForFunction(() => {
        const { now, goal } = window.elysicesterDebug.rig;
        return Math.abs(now.radius - goal.radius) < 0.05 && Math.abs(now.theta - goal.theta) < 0.002
            && Math.abs(now.phi - goal.phi) < 0.002 && now.target.distanceTo(goal.target) < 0.03;
    }, null, { timeout: 60_000, polling: 200 });
}

async function pointerRound(page, context, pass, fragments, outDir, name) {
    const results = [];
    for (const fragment of fragments) {
        // The idle drift would move points between measuring and tapping (closing the reader re-enables it).
        await page.evaluate((id) => {
            window.elysicesterDebug.rig.setDrifting(false);
            window.elysicesterDebug.focusFragment(id);
        }, fragment.id);
        await cameraSettled(page);
        const spot = await page.evaluate((id) => window.elysicesterDebug.hotspots.screenPositions().find((entry) => entry.id === id), fragment.id);
        const { width, height } = pass.viewport;
        if (!spot?.inFront || spot.x < 0 || spot.y < 0 || spot.x > width || spot.y > height) {
            results.push({ id: fragment.id, ok: false, why: 'the point is off-screen in its own view', spot });
            continue;
        }
        if (!spot.visible) {
            results.push({ id: fragment.id, ok: false, why: 'the point is hidden behind the city in its own view', spot });
            continue;
        }
        if (pass.hasTouch) await touch(context, page, [{ x: spot.x, y: spot.y }]);
        else await page.mouse.click(spot.x, spot.y);
        const inspected = await inspectOpen(page, fragment, path.join(outDir, `${name}-panel-${fragment.id}.png`));
        results.push({ id: fragment.id, ok: inspected.matched && inspected.closed, ...inspected });
    }
    return results;
}

async function stillClickRound(page, fragments, outDir, name) {
    const results = [];
    for (const fragment of fragments) {
        await page.click(`#points a[data-fragment="${fragment.id}"]`);
        const inspected = await inspectOpen(page, fragment, path.join(outDir, `${name}-panel-${fragment.id}.png`));
        results.push({ id: fragment.id, ok: inspected.matched && inspected.closed, ...inspected });
    }
    return results;
}

async function keyboardRound(page, fragments) {
    await page.evaluate(() => document.activeElement?.blur());
    let arrived = false;
    for (let press = 0; press < 8 && !arrived; press += 1) {
        await page.keyboard.press('Tab');
        arrived = await page.evaluate(() => Boolean(document.activeElement?.dataset?.fragment));
    }
    const results = [];
    for (const fragment of fragments) {
        const focused = await page.evaluate(() => document.activeElement?.dataset?.fragment ?? null);
        await page.keyboard.press('Enter');
        const inspected = await inspectOpen(page, fragment, null);
        const focusReturned = inspected.activeAfter === fragment.id;
        results.push({ id: fragment.id, ok: focused === fragment.id && inspected.matched && inspected.closed && focusReturned, focused, focusReturned, ...inspected });
        await page.keyboard.press('Tab');
    }
    return results;
}

async function checkReadOn() {
    const data = JSON.parse(await readFile(path.join(ROOT, 'elysicester', 'data', 'fragments.json'), 'utf8'));
    const urls = [...new Set(data.fragments.map((fragment) => fragment.read_on.split('#')[0]).filter((url) => /^https?:/.test(url)))];
    const answers = [];
    for (const url of urls) {
        try {
            let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
            if (response.status === 405) response = await fetch(url, { redirect: 'follow' });
            answers.push({ url, status: response.status });
        } catch (error) {
            answers.push({ url, status: `error: ${error.message}` });
        }
    }
    return answers;
}

function summarise(results) {
    if (!results) return '';
    const ok = results.filter((result) => result.ok).length;
    return `${ok}/${results.length}`;
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
            const { mode } = await enter(session.page, session.context, PASSES[still.pass], { begin: 'click', then: 'skip' });
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
        const quick = process.argv.includes('--quick');
        await mkdir(outDir, { recursive: true });
        const report = { origin, readOn: await checkReadOn(), passes: {} };
        const data = JSON.parse(await readFile(path.join(ROOT, 'elysicester', 'data', 'fragments.json'), 'utf8'));
        const voice = ['nbp-e3-intermaze-1', 'nbp-e3-intermaze-2'].map((id) => data.fragments.find((fragment) => fragment.id === id));
        const voiceLines = voice.filter(Boolean).flatMap((fragment, index) => (index === 0 ? fragment.text.split(/\n{2,}/) : [fragment.text]));

        for (const [name, pass] of Object.entries(PASSES).filter(([key]) => only.includes(key))) {
            const { browser, context, page, messages, failures } = await openPass(chromium, pass);
            if (pass.soundOn) {
                // A past visit that chose sound: remembered on this origin before the diorama loads.
                await page.goto(`${origin}/elysicester/data/places.json`);
                await page.evaluate(() => window.localStorage.setItem('elysicester:sound', JSON.stringify('on')));
            }
            await page.goto(`${origin}/elysicester/?debug=1`, { waitUntil: 'load' });
            const threshold = await enter(page, context, pass, { begin: pass.begin, then: pass.then, shots: path.join(outDir, name), voiceLines });
            const { mode } = threshold;
            const result = { mode, threshold, messages, failures };
            await page.screenshot({ path: path.join(outDir, `${name}.png`) });
            if (pass.sound) result.sound = await soundRound(page, pass, threshold);
            const fragments = await page.evaluate(() => [...document.querySelectorAll('#points a')].map((link) => link.dataset.fragment));
            const ordered = fragments.map((id) => data.fragments.find((fragment) => fragment.id === id));

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
                if (!quick) result.pointer = await pointerRound(page, context, pass, ordered, outDir, name);
            } else if (!quick) {
                result.pointer = await stillClickRound(page, ordered, outDir, name);
            }

            if (!quick && pass.keyboard) result.keyboard = await keyboardRound(page, ordered);

            if (!quick) {
                await page.reload({ waitUntil: 'load' });
                result.reentered = await enter(page, context, pass, { begin: pass.begin, then: 'skip' });
                result.persisted = await page.evaluate(() => ({
                    list: [...document.querySelectorAll('#points a')].filter((link) => link.dataset.read === 'yes').length,
                    total: document.querySelectorAll('#points a').length,
                    points: window.elysicesterDebug?.hotspots?.readIds().length ?? null,
                }));
            }
            report.passes[name] = result;
            await browser.close();
        }

        await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
        for (const answer of report.readOn) process.stdout.write(`read on  ${answer.status}  ${answer.url}\n`);
        for (const [name, result] of Object.entries(report.passes)) {
            const problems = result.messages.length + result.failures.length;
            const info = result.info ? `${result.info.calls} calls, ${result.info.triangles} tris` : '';
            const orbit = result.drag ? (result.drag.orbited ? 'drag orbits' : 'DRAG DID NOT ORBIT') : '';
            const still = result.stillness ? (result.stillness.drifted ? 'DRIFTED' : 'no drift') : '';
            const pointer = result.pointer ? `pointer ${summarise(result.pointer)}` : '';
            const keys = result.keyboard ? `keyboard ${summarise(result.keyboard)}` : '';
            const serious = [...(result.pointer ?? []), ...(result.keyboard ?? [])]
                .flatMap((entry) => entry.violations ?? []).filter((violation) => SERIOUS.has(violation.impact));
            const axe = result.pointer ? `axe serious ${serious.length}` : '';
            const kept = result.persisted ? `dim after reload ${result.persisted.list}/${result.persisted.total}${result.persisted.points === null ? '' : ` (points ${result.persisted.points})`}` : '';
            const passage = result.threshold.passage;
            const crossing = `threshold ${result.threshold.sequence}${passage?.frames ? ` (${passage.frames} frames, ${passage.linesShown} lines${passage.skipped ? `, skipped, landed ${result.threshold.skipToDone} ms after skip` : ''})` : ''} ${result.threshold.ok ? 'ok' : 'NOT OK'}`;
            const sound = result.sound ? `sound ${result.sound.ok ? 'ok' : 'NOT OK'}` : '';
            process.stdout.write(`${name.padEnd(8)} ${result.mode.padEnd(6)} ${problems === 0 ? 'clean' : `${problems} problem(s)`}  ${[crossing, sound, info, orbit, still, pointer, keys, axe, kept].filter(Boolean).join(' · ')}\n`);
            for (const line of [...result.messages, ...result.failures]) process.stdout.write(`    ${line}\n`);
            for (const line of [...result.threshold.problems, ...(result.reentered?.problems ?? []).map((text) => `on return: ${text}`), ...(result.sound?.problems ?? [])]) {
                process.stdout.write(`    not ok: ${line}\n`);
            }
            for (const entry of [...(result.pointer ?? []), ...(result.keyboard ?? [])].filter((item) => !item.ok)) {
                process.stdout.write(`    not ok: ${JSON.stringify(entry)}\n`);
            }
            const minor = [...(result.pointer ?? []), ...(result.keyboard ?? [])].flatMap((entry) => entry.violations ?? []);
            for (const violation of new Map(minor.map((item) => [item.id, item])).values()) {
                process.stdout.write(`    axe ${violation.impact}: ${violation.id} — ${violation.help}\n`);
            }
        }
        process.stdout.write(`Screenshots and report.json in ${outDir}\n`);
    }
} finally {
    server.close();
}
