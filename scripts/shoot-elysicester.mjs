/**
 * shoot-elysicester.mjs — local screenshots and interaction checks for the diorama.
 *
 * Local only: Playwright and axe-core are deliberately NOT in package.json, so
 * CI stays light. Install them anywhere Node can find them from this folder
 * (for example `npm i --no-save playwright axe-core` in a parent directory).
 *
 * Serves the repo on a local port and launches Chromium with SwiftShader
 * (working WebGL without a GPU). Five passes:
 *   desktop  1280×800
 *   mobile   390×844 (touch, device pixel ratio 3)
 *   reduced  1280×800 with prefers-reduced-motion
 *   nogl     1280×800 with WebGL disabled (the still and its list)
 *   extras   1280×800 with every optional extra on (?extras=all,door-open): the
 *            words round the sky, the café shadow, the door opening, the
 *            console's voice and the hums must all appear, with no problems
 *            besides
 * In each: console errors and failed requests are recorded; the threshold is
 * crossed (the card is screenshotted, then begun by click, tap or a key; the
 * desktop pass watches the whole Intermaze, the mobile pass skips it with a
 * tap, the reduced and still passes must crossfade with no flight at all);
 * renderer.info is read through ?debug=1, the view is dragged (mouse, or real
 * touch points), every reading point is opened by pointer (or, in the still,
 * by its link) and by keyboard (Tab, Enter, Esc, and focus must come back),
 * each panel is screenshotted and scanned with axe, and a reload must keep
 * read points dim. Sound must stay off until the toggle turns it on (desktop),
 * and a remembered "on" must wait for the beginning gesture (reduced). Every
 * sign is read: its fonts must hold every letter it needs, the camera must find
 * a clear view of its whole face (desktop and reduced reach it from the list,
 * touch taps the plate), and its words must show over it marked as Danæam, with
 * the site's gloss or none; the still lists them as plain words; the list is
 * scanned with axe. A close-up of each plate is kept. The
 * reduced pass also waits past the idle delay to confirm nothing drifts. The
 * desktop pass drives the camera hard at three places, tilted all the way
 * down, as close as it comes, round and round, and it must keep clear of
 * every surface.
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
import { loadRedirects, matchRedirect } from './redirects.mjs';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const NO_WEBGL_ARGS = ['--disable-webgl', '--disable-3d-apis'];
const LOAD_TIMEOUT = 90_000;
/** The rig's own tap limit (rigs/orbit.js TAP_TIME): a longer press is no tap. */
const TAP_LIMIT = 800;
/** How many times a round presses again after a press too slow to be a tap (the phone pass draws ~1 frame a second). */
const PRESSES = 6;
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
    desktop: { viewport: { width: 1280, height: 800 }, keyboard: true, begin: 'click', then: 'watch', expect: 'flight', sound: true, camera: true },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, begin: 'tap', then: 'skip', expect: 'flight' },
    reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', checkStillness: true, keyboard: true, begin: 'key', expect: 'crossfade', sound: true, soundOn: true },
    nogl: { viewport: { width: 1280, height: 800 }, noWebGL: true, keyboard: true, begin: 'click', expect: 'crossfade' },
    // The optional extras, every one on (and the door made to open now): each must appear, and nothing else change.
    extras: { viewport: { width: 1280, height: 800 }, begin: 'click', then: 'skip', expect: 'flight', query: 'extras=all,door-open', signs: false, extras: true },
};

/**
 * The site's paper grain (an feTurbulence background, as on every page of the
 * site) never finishes rasterising under SwiftShader: the site's own homepage
 * stalls a screenshot the same way, and loads in well under a second without
 * these flags. Real GPUs draw it; the tests lift it. Stills are shot without it
 * anyway, since the page lays it over them live.
 */
function liftGrain() {
    document.addEventListener('DOMContentLoaded', () => document.querySelector('.grain')?.remove());
}

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

/** A tiny static server for the repo root; the diorama needs http for modules. It follows _redirects, as Pages does. */
async function serve() {
    const redirects = await loadRedirects(ROOT);
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url, 'http://localhost');
            const found = matchRedirect(redirects, url.pathname);
            if (found && found.status !== 200) {
                response.writeHead(found.status, { Location: `${found.location}${url.search}` });
                response.end();
                return;
            }
            let pathname = decodeURIComponent(found ? found.location : url.pathname);
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
    await context.addInitScript(liftGrain);
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
        // The hollows' map is laid by a worker and its darkness comes in over a second: pictures wait for it.
        await page.waitForFunction(() => window.elysicesterDebug?.hollows?.settled ?? true, null, { timeout: LOAD_TIMEOUT }).catch(() => {});
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

/**
 * Press once at a point (a tap, or a click) and say how long the canvas held it, in ms. Under
 * SwiftShader a simulated press can outlast the rig's tap limit (TAP_LIMIT), since input is answered
 * only between slow frames; such a press is no tap at all, and the rounds press again.
 */
async function pressAt(page, context, pass, point) {
    await page.evaluate(() => {
        const canvas = document.getElementById('stage');
        window.__press = {};
        canvas.addEventListener('pointerdown', (event) => { window.__press.down = event.timeStamp; }, { once: true });
        canvas.addEventListener('pointerup', (event) => { window.__press.up = event.timeStamp; }, { once: true });
    });
    if (pass.hasTouch) await touch(context, page, [point]);
    else await page.mouse.click(point.x, point.y);
    return page.evaluate(() => (window.__press.up ?? Infinity) - (window.__press.down ?? 0));
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
    // The page lays the site's grain over the still as over the scene, so the still itself is shot without it.
    await page.addStyleTag({ content: '.plainly, .debug-readout, .controls, .threshold-voice, .veil, .point-label, .sign-label, .grain { visibility: hidden !important; }' });
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

async function scanElement(page, id) {
    const loaded = await page.evaluate(() => Boolean(window.axe));
    if (!loaded) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    return page.evaluate(async (target) => {
        const result = await window.axe.run(document.getElementById(target), { resultTypes: ['violations'] });
        return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length }));
    }, id);
}

async function scanReader(page) {
    return scanElement(page, 'reader');
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
    // The dialog's close (and the focus it hands back) comes in a queued task: wait for it, then settle.
    await page.waitForFunction(() => !document.getElementById('reader').open, null, { timeout: 4000 }).catch(() => {});
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
        // A press too slow to be a tap (see pressAt) is tried again, and said so; a press that was a tap
        // and still opened nothing fails at once.
        let inspected = null;
        let slowPresses = 0;
        for (let attempt = 0; attempt < PRESSES; attempt += 1) {
            const press = await pressAt(page, context, pass, { x: spot.x, y: spot.y });
            inspected = await inspectOpen(page, fragment, path.join(outDir, `${name}-panel-${fragment.id}.png`));
            if (inspected.matched || press < TAP_LIMIT) break;
            slowPresses += 1;
        }
        results.push({ id: fragment.id, ok: inspected.matched && inspected.closed, ...inspected, ...(slowPresses ? { slowPresses } : {}) });
    }
    return results;
}

/**
 * Every sign: its fonts hold every letter it needs; the camera comes round to
 * read it; its words show over it, marked as Danæam, with the site's gloss (or
 * none). Desktop reaches each sign from its entry in the list (keyboard focus);
 * touch passes tap the plate itself. A close-up of each plate is kept.
 */
async function signRound(page, context, pass, outDir, name) {
    const data = JSON.parse(await readFile(path.join(ROOT, 'elysicester', 'data', 'signs.json'), 'utf8'));
    const coverage = await page.evaluate(() => window.elysicesterDebug.signCoverage);
    const results = [];
    let navViolations = [];
    for (const sign of data.signs) {
        if (pass.hasTouch) {
            await page.evaluate((wanted) => {
                window.elysicesterDebug.rig.setDrifting(false);
                window.elysicesterDebug.signs.focusSign(wanted);
            }, sign);
        } else {
            await page.evaluate((id) => {
                window.elysicesterDebug.rig.setDrifting(false);
                document.querySelector(`#signs-list button[data-sign="${id}"]`).focus();
            }, sign.id);
        }
        await cameraSettled(page);
        await page.waitForTimeout(250);
        // While a sign's entry has focus, the whole list is showing: scan it once.
        if (!pass.hasTouch && !results.length) navViolations = await scanElement(page, 'points');
        let spot = await page.evaluate((id) => window.elysicesterDebug.signs.screenPositions().find((entry) => entry.id === id), sign.id);
        let slowPresses = 0;
        if (pass.hasTouch && spot) {
            // Let go of the programmatic focus, then tap the plate like a visitor (again, if the press was
            // too slow to be a tap: see pressAt).
            const tapped = { x: spot.x, y: spot.y };
            for (let attempt = 0; attempt < PRESSES; attempt += 1) {
                await page.evaluate(() => window.elysicesterDebug.signs.hide());
                const press = await pressAt(page, context, pass, tapped);
                await page.waitForTimeout(300);
                const shown = await page.evaluate(() => window.elysicesterDebug.signs.shownId());
                if (shown === sign.id || press < TAP_LIMIT) break;
                slowPresses += 1;
            }
            spot = await page.evaluate((id) => window.elysicesterDebug.signs.screenPositions().find((entry) => entry.id === id), sign.id);
        }
        const state = await page.evaluate(() => {
            const label = document.getElementById('sign-label');
            const words = label.querySelector('.sign-words');
            return {
                shown: window.elysicesterDebug.signs.shownId(),
                readerOpen: document.getElementById('reader').open,
                words: words?.textContent ?? null,
                lang: words?.getAttribute('lang') ?? null,
                gloss: label.querySelector('.sign-gloss')?.textContent ?? null,
            };
        });
        const { width, height } = pass.viewport;
        if (spot?.inFront) {
            const clip = {
                x: Math.max(0, Math.min(width - 460, spot.x - 230)),
                y: Math.max(0, Math.min(height - 300, spot.y - 170)),
                width: Math.min(460, width),
                height: 300,
            };
            await page.screenshot({ path: path.join(outDir, `${name}-sign-${sign.id}.png`), clip });
        }
        if (state.readerOpen) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
        }
        const problems = [];
        if (!spot?.inFront || !spot.visible) problems.push('the plate is hidden in its own view');
        if (state.shown !== sign.id) problems.push(`the words shown were ${state.shown}${state.readerOpen ? ' (a reading point took the tap)' : ''}`);
        if (state.words !== (sign.danaeam ?? '· · ·')) problems.push(`the words read ${JSON.stringify(state.words)}`);
        if (state.lang !== (sign.danaeam === null ? null : 'art-x-danaeam')) problems.push(`lang was ${state.lang}`);
        if (state.gloss !== (sign.gloss ?? null)) problems.push(`the gloss read ${JSON.stringify(state.gloss)}`);
        results.push({ id: sign.id, ok: problems.length === 0, problems, spot, ...(slowPresses ? { slowPresses } : {}) });
    }
    await page.evaluate(() => {
        document.activeElement?.blur();
        window.elysicesterDebug.signs.hide();
    });
    const glyphProblems = [];
    if (!coverage?.fontsLoaded) glyphProblems.push('the fonts did not load');
    for (const font of coverage?.fonts ?? []) {
        if (font.missing.length) glyphProblems.push(`${font.font} lacks ${font.missing.join(' ')}`);
    }
    return { coverage, glyphProblems, results, navViolations, navScanned: !pass.hasTouch };
}

/** In the still, the signs are plain words in the list: each marked as Danæam, glossed only where the site glosses it. */
async function stillSignCheck(page) {
    const data = JSON.parse(await readFile(path.join(ROOT, 'elysicester', 'data', 'signs.json'), 'utf8'));
    const shown = await page.evaluate(() => [...document.querySelectorAll('#signs-list [data-sign]')].map((node) => ({
        id: node.dataset.sign,
        tag: node.tagName,
        words: node.querySelector('.sign-words')?.textContent ?? null,
        lang: node.querySelector('.sign-words')?.getAttribute('lang') ?? null,
        gloss: node.querySelector('.sign-gloss')?.textContent ?? null,
    })));
    const results = data.signs.map((sign) => {
        const entry = shown.find((candidate) => candidate.id === sign.id);
        const problems = [];
        if (!entry) problems.push('not in the list');
        else {
            if (entry.tag === 'BUTTON') problems.push('still a button with nothing to do');
            if (entry.words !== (sign.danaeam ?? '· · ·')) problems.push(`the words read ${JSON.stringify(entry.words)}`);
            if (entry.lang !== (sign.danaeam === null ? null : 'art-x-danaeam')) problems.push(`lang was ${entry.lang}`);
            if (entry.gloss !== (sign.gloss ?? null)) problems.push(`the gloss read ${JSON.stringify(entry.gloss)}`);
        }
        return { id: sign.id, ok: problems.length === 0, problems };
    });
    return { results, glyphProblems: [], navViolations: await scanElement(page, 'points'), navScanned: true };
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
        // The focus comes home in a queued task, which slow frames can hold back: wait for it (a little) before
        // judging, and before the next Tab, which would otherwise be undone by it.
        await page.waitForFunction((id) => document.activeElement?.dataset?.fragment === id, fragment.id, { timeout: 4000 }).catch(() => {});
        inspected.activeAfter = await page.evaluate(() => document.activeElement?.dataset?.fragment ?? document.activeElement?.tagName ?? null);
        const focusReturned = inspected.activeAfter === fragment.id;
        results.push({ id: fragment.id, ok: focused === fragment.id && inspected.matched && inspected.closed && focusReturned, focused, focusReturned, ...inspected });
        await page.keyboard.press('Tab');
        // Under SwiftShader's slow frames the Tab can be answered late: wait until focus has moved on
        // (a visitor's next key never comes within milliseconds of the last).
        await page.waitForFunction((id) => (document.activeElement?.dataset?.fragment ?? null) !== id, fragment.id, { timeout: 4000 }).catch(() => {});
    }
    return results;
}

/**
 * The camera never enters anything solid: at three places where it once did
 * (under the sun-dock's water, into the Steel Garden's floor, the hanging
 * mountain), tilt all the way down, come as close as the rig allows and go
 * round, watching every frame's distance from the nearest surface.
 */
async function cameraRound(page) {
    return page.evaluate(async () => {
        const { rig, solids, stage } = window.elysicesterDebug;
        await solids.ready;
        if (!solids.available) return { ok: false, problems: ['the solids never arrived'] };
        let closest = Infinity;
        stage.onFrame(() => {
            closest = Math.min(closest, solids.distance(stage.camera.position));
        });
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const rows = [];
        for (const place of ['sun-dock', 'steel-garden', 'sky-grottos']) {
            rig.focus(place);
            const until = performance.now() + 20_000;
            while (rig.gliding && performance.now() < until) await wait(150);
            closest = Infinity;
            rig.goal.phi = 1.95;
            rig.zoomBy(0.01);
            for (let step = 0; step < 30; step += 1) {
                rig.goal.theta += 0.2;
                await wait(80);
            }
            await wait(1200);
            rows.push({ place, closest: Number(closest.toFixed(2)) });
        }
        rig.toHome();
        const problems = rows.filter((row) => row.closest < 0.65).map((row) => `${row.place}: came within ${row.closest} of a surface`);
        return { rows, ok: problems.length === 0, problems };
    });
}

/**
 * The optional extras, all on: the words round the sky, the shadow on its
 * café wall, the yellow door (made to open now) turning on its hinge, and the
 * voice in the console. Each must be there; the door is pictured, and the
 * whole city with the sky's words.
 */
async function extrasRound(page, spoken, outDir, name) {
    const found = await page.evaluate(async () => {
        const { scene } = window.elysicesterDebug.stage;
        const sky = scene.getObjectByName('sky');
        const door = scene.getObjectByName('yellow-door');
        const until = performance.now() + 25_000;
        while (door && door.rotation.y > -0.3 && performance.now() < until) await new Promise((resolve) => setTimeout(resolve, 200));
        return {
            inscription: 'INSCRIPTION' in (sky?.material.defines ?? {}),
            shadow: Boolean(scene.getObjectByName('cafe-shadow')),
            door: Boolean(door),
            doorOpened: door ? door.rotation.y < -0.3 : false,
            hums: scene.getObjectByName('hums')?.count ?? 0,
        };
    });
    const glide = () => page.waitForFunction(() => !window.elysicesterDebug.rig.gliding, null, { timeout: 30_000 }).catch(() => {});
    await page.evaluate(() => {
        const { stage, signs } = window.elysicesterDebug;
        signs.focusSign(stage.signs.entries.find((entry) => entry.sign.id === 'sky-grottos-notice').sign);
    });
    await glide();
    await page.screenshot({ path: path.join(outDir, `${name}-door.png`) });
    await page.evaluate(() => {
        window.elysicesterDebug.signs.focusSign(null);
        window.elysicesterDebug.rig.toHome();
    });
    await glide();
    await page.screenshot({ path: path.join(outDir, `${name}-sky.png`) });
    const voice = spoken.length >= 3 && spoken[0].includes('Elysicester') && spoken[0].includes('Êlyscaíniy');
    const problems = [];
    if (!found.inscription) problems.push('no words round the sky');
    if (!found.shadow) problems.push('no shadow on the café wall');
    if (!found.door) problems.push('the door cannot open');
    else if (!found.doorOpened) problems.push('the door did not open');
    if (!voice) problems.push(`the console said ${JSON.stringify(spoken.slice(0, 3))}`);
    if (!found.hums) problems.push('no hums in the bridgework');
    return { ...found, voice, spoken: spoken.slice(0, 3), ok: problems.length === 0, problems };
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
            // (The still is for those who can't walk the city: its shadow keeps to the café wall there.)
            await session.page.goto(`${origin}/elysicester/?debug=1&walk=off`, { waitUntil: 'load' });
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
            const spoken = [];
            if (pass.extras) page.on('console', (message) => { if (message.type() === 'log') spoken.push(message.text()); });
            await page.goto(`${origin}/elysicester/?debug=1${pass.query ? `&${pass.query}` : ''}`, { waitUntil: 'load' });
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
                if (pass.signs !== false) result.signs = await signRound(page, context, pass, outDir, name);
                if (pass.camera) result.camera = await cameraRound(page);
                if (pass.extras) result.extras = await extrasRound(page, spoken, outDir, name);
                if (!quick && !pass.extras) result.pointer = await pointerRound(page, context, pass, ordered, outDir, name);
            } else {
                result.signs = await stillSignCheck(page);
                if (!quick) result.pointer = await stillClickRound(page, ordered, outDir, name);
            }

            if (!quick && pass.keyboard) result.keyboard = await keyboardRound(page, ordered);

            if (!quick && !pass.extras) {
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
            const slow = result.pointer?.reduce((sum, entry) => sum + (entry.slowPresses ?? 0), 0) ?? 0;
            const pointer = result.pointer ? `pointer ${summarise(result.pointer)}${slow ? ` (${slow} press${slow === 1 ? '' : 'es'} too slow to be a tap under SwiftShader, pressed again)` : ''}` : '';
            const keys = result.keyboard ? `keyboard ${summarise(result.keyboard)}` : '';
            const serious = [...(result.pointer ?? []), ...(result.keyboard ?? [])]
                .flatMap((entry) => entry.violations ?? []).filter((violation) => SERIOUS.has(violation.impact));
            const axe = result.pointer ? `axe serious ${serious.length}` : '';
            const kept = result.persisted ? `dim after reload ${result.persisted.list}/${result.persisted.total}${result.persisted.points === null ? '' : ` (points ${result.persisted.points})`}` : '';
            const passage = result.threshold.passage;
            const crossing = `threshold ${result.threshold.sequence}${passage?.frames ? ` (${passage.frames} frames, ${passage.linesShown} lines${passage.skipped ? `, skipped, landed ${result.threshold.skipToDone} ms after skip` : ''})` : ''} ${result.threshold.ok ? 'ok' : 'NOT OK'}`;
            const sound = result.sound ? `sound ${result.sound.ok ? 'ok' : 'NOT OK'}` : '';
            const navSerious = (result.signs?.navViolations ?? []).filter((violation) => SERIOUS.has(violation.impact)).length;
            const slowSigns = result.signs?.results.reduce((sum, entry) => sum + (entry.slowPresses ?? 0), 0) ?? 0;
            const signs = result.signs
                ? `signs ${summarise(result.signs.results)}${slowSigns ? ` (${slowSigns} tap${slowSigns === 1 ? '' : 's'} too slow under SwiftShader, tapped again)` : ''}${result.signs.coverage ? `, glyphs ${result.signs.glyphProblems.length ? 'MISSING' : 'all held'}` : ''}${result.signs.navScanned ? `, list axe serious ${navSerious}` : ''}`
                : '';
            const extras = result.extras ? `extras ${result.extras.ok ? 'sky, shadow, door, voice and hums all there' : 'NOT OK'}` : '';
            const camera = result.camera ? `camera ${result.camera.ok ? `kept clear (closest ${Math.min(...result.camera.rows.map((row) => row.closest))})` : 'WENT INTO SOMETHING'}` : '';
            process.stdout.write(`${name.padEnd(8)} ${result.mode.padEnd(6)} ${problems === 0 ? 'clean' : `${problems} problem(s)`}  ${[crossing, sound, info, orbit, still, camera, signs, extras, pointer, keys, axe, kept].filter(Boolean).join(' · ')}\n`);
            for (const line of [...result.messages, ...result.failures]) process.stdout.write(`    ${line}\n`);
            for (const line of result.extras?.problems ?? []) process.stdout.write(`    extras not ok: ${line}\n`);
            for (const line of result.camera?.problems ?? []) process.stdout.write(`    camera not ok: ${line}\n`);
            for (const line of [...result.threshold.problems, ...(result.reentered?.problems ?? []).map((text) => `on return: ${text}`), ...(result.sound?.problems ?? [])]) {
                process.stdout.write(`    not ok: ${line}\n`);
            }
            for (const line of result.signs?.glyphProblems ?? []) process.stdout.write(`    glyphs: ${line}\n`);
            for (const entry of (result.signs?.results ?? []).filter((item) => !item.ok)) {
                process.stdout.write(`    sign not ok: ${entry.id} — ${entry.problems.join('; ')}\n`);
            }
            for (const font of result.signs?.coverage?.fonts ?? []) {
                if (font.probeMissing.length) process.stdout.write(`    note: ${font.font} lacks ${font.probeMissing.join(' ')} (no sign uses them)\n`);
            }
            for (const entry of [...(result.pointer ?? []), ...(result.keyboard ?? [])].filter((item) => !item.ok)) {
                process.stdout.write(`    not ok: ${JSON.stringify(entry)}\n`);
            }
            const minor = [...(result.pointer ?? []), ...(result.keyboard ?? [])].flatMap((entry) => entry.violations ?? [])
                .concat(result.signs?.navViolations ?? []);
            for (const violation of new Map(minor.map((item) => [item.id, item])).values()) {
                process.stdout.write(`    axe ${violation.impact}: ${violation.id} — ${violation.help}\n`);
            }
        }
        process.stdout.write(`Screenshots and report.json in ${outDir}\n`);
    }
} finally {
    server.close();
}
