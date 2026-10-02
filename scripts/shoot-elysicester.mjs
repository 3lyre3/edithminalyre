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
 * each panel is screenshotted and scanned with axe, and a reload (within the
 * same visit, so with no card: straight into the city) must keep read points
 * dim. Sound must stay off until the toggle turns it on (desktop),
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
 * The choice comes first, before anything else (a trial): every first visit
 * must find it worded as Elm worded it ("Explore", "Read": her words since 2 Oct), "Read"
 * leading to the texts (read.html), focus on "Explore", the card
 * not yet shown; each pass chooses to explore the way it begins (a click, a tap
 * or a key), the choice must go, and the Mega-Screen's card must follow, its way
 * in holding the focus, before the Intermaze.
 * The visit begins as the hum on the Cyclolite at the jetty's end (the dock and
 * cyclolite trials), so the passes above run with ?dock=off, from the whole
 * city, as they were written; and the desktop, mobile and reduced passes then
 * make a plain visit too: it must arrive flying, on the Cyclolite's deck, the
 * hum perched there and the camera close behind it, the jetty's signs standing,
 * and come back there on a reload; and the one option at the top of the screen
 * must go "zoom out" (drawn back, still flying), "zoom out" (let go, out to the
 * whole city), then "leave", to the choice and back; the hum's button recentres.
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
/**
 * The address the rounds load the city at: the local checks' readings (debug), and the way in not waited through (the
 * settle trial off), so a round can begin the card at once and skip the swirl, as it always did; the settle round
 * checks the way in waited through, as visitors meet it.
 */
const SKIPPABLE = 'debug=1&settle=off';
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
    desktop: { viewport: { width: 1280, height: 800 }, keyboard: true, begin: 'click', then: 'watch', expect: 'flight', sound: true, camera: true, dock: true, creatures: true, plants: true, failures: true, texts: true, settle: true },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, begin: 'tap', then: 'skip', expect: 'flight', dock: true, plants: true },
    reduced: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', checkStillness: true, keyboard: true, begin: 'key', expect: 'crossfade', sound: true, soundOn: true, dock: true },
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

// (Each pass shot once, and each of its files made from that frame: the stills, and the front page's card for link
// previews, a 1200 by 630 JPEG, which every preview draws (some don't draw WebP).)
const STILLS = [
    { pass: 'desktop', files: [{ file: 'fallback.webp', width: 1024 }, { file: 'images/elysicester-card.jpg', width: 1200, height: 630, type: 'image/jpeg', quality: 0.88, anchor: 'top' }] },
    { pass: 'mobile', files: [{ file: 'fallback-portrait.webp', height: 1024 }] },
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
 * Cross the threshold as a visitor would: choose to explore (where the choice
 * is on), wait for the card (screenshot it), begin (click, tap or a key), then
 * watch the flight, or skip it with a tap or Esc, and wait until the city (or
 * its still) has arrived. Returns what the threshold did, with timings in page
 * milliseconds.
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
    const { width, height } = pass.viewport;
    // The choice first (a trial, trials.js), unless the address turned it off, and nothing before it: both sides as Elm
    // worded them, "Read" leading to the texts (and answering), focus on "Explore", the card not yet
    // shown; explore is chosen the way the visitor begins (a click, a tap, or a key), and the Mega-Screen's card
    // follows it, its way in holding the focus.
    const expectChoice = await page.evaluate(() => !/[?&](choice|trials)=off\b/.test(window.location.search));
    await page.waitForFunction(() => ['choice', 'card'].includes(document.documentElement.dataset.threshold), null, { timeout: LOAD_TIMEOUT });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    let choice = null;
    if (await page.evaluate(() => document.documentElement.dataset.threshold === 'choice')) {
        choice = await page.evaluate(() => ({
            explore: document.getElementById('choice-explore').textContent.trim(),
            read: document.getElementById('choice-read').textContent.trim(),
            readTo: document.getElementById('choice-read').getAttribute('href'),
            focus: document.activeElement?.id || null,
            cardShown: getComputedStyle(document.getElementById('threshold')).display !== 'none',
            pointsInert: document.getElementById('points').inert,
        }));
        choice.readAnswers = await fetch(new URL(choice.readTo, page.url())).then((response) => response.status, (error) => `error: ${error.message}`);
        if (shots) {
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${shots}-choice.png` });
        }
        if (begin === 'tap') {
            const box = await page.locator('#choice-explore').boundingBox();
            await touch(context, page, [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]);
        } else if (begin === 'key') {
            await page.keyboard.press('Enter');
        } else {
            await page.click('#choice-explore');
        }
        await page.waitForFunction(() => document.documentElement.dataset.threshold === 'card', null, { timeout: 10_000 }).catch(() => {});
        // (The choice fades over the card, then is hidden.)
        await page.waitForFunction(() => document.getElementById('choice').hidden, null, { timeout: 5000 }).catch(() => {});
    }
    await page.waitForFunction(() => document.documentElement.dataset.threshold === 'card', null, { timeout: LOAD_TIMEOUT });
    const card = await page.evaluate(() => ({
        prompt: document.getElementById('threshold-prompt').innerHTML,
        pointsInert: document.getElementById('points').inert,
        focus: document.activeElement?.id || null,
        shown: getComputedStyle(document.getElementById('threshold')).display !== 'none',
    }));
    card.sound = await soundReading(page);
    if (shots) {
        await page.waitForTimeout(4500);
        await page.screenshot({ path: `${shots}-card.png` });
    }

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
            // (Only while it's still flying: on a slow machine it may have landed already, and a tap then lands in
            // the city instead, taking the focus with it.)
            skipAt = await page.evaluate(() => (document.documentElement.dataset.threshold === 'flight' ? performance.now() : null));
            if (skipAt !== null) {
                if (pass.hasTouch) await touch(context, page, [{ x: width / 2, y: height / 2 }]);
                else await page.keyboard.press('Escape');
            }
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
        choiceHidden: document.getElementById('choice').hidden,
        veilDark: document.getElementById('veil').classList.contains('is-dark'),
    }));
    const sequence = after.log.filter((entry) => entry.name === 'data-threshold').map((entry) => entry.value);
    // Where the passage lands: the city.
    const landedAt = after.log.find((entry) => entry.name === 'data-threshold' && entry.value === 'done')?.at ?? null;
    const result = {
        mode,
        sequence: sequence.join(' > '),
        passage: after.passage,
        began: begin,
        card,
        begun,
        choice,
        readyBeforeBegin: after.readyAt !== null && after.begunAt !== null ? after.readyAt < after.begunAt : null,
        beginToLanded: landedAt !== null && after.begunAt !== null ? Math.round(landedAt - after.begunAt) : null,
        skipToLanded: landedAt !== null && skipAt !== null ? Math.round(landedAt - Math.max(skipAt, after.readyAt ?? 0)) : null,
        focus: after.focus,
        pointsInertOnCard: card.pointsInert,
        pointsInertAfter: after.pointsInert,
        cardHidden: after.cardHidden,
        veilDark: after.veilDark,
    };
    const problems = [];
    if (result.sequence !== `${expectChoice ? 'choice > ' : ''}card > ${pass.expect} > done`) problems.push(`sequence was ${result.sequence}`);
    if (expectChoice && !choice) problems.push('the choice did not show');
    if (choice) {
        if (choice.explore !== 'Explore') problems.push(`the choice's explore side read ${JSON.stringify(choice.explore)}`);
        if (choice.read !== 'Read') problems.push(`the choice's read side read ${JSON.stringify(choice.read)}`);
        if (choice.readTo !== 'read.html') problems.push(`"Read" led to ${choice.readTo}`);
        if (choice.readAnswers !== 200) problems.push(`"Read" answered ${choice.readAnswers}`);
        if (choice.focus !== 'choice-explore') problems.push(`focus on the choice was on ${choice.focus}`);
        if (choice.cardShown) problems.push('the card showed before the choice was made');
        if (!choice.pointsInert) problems.push('the points were reachable behind the choice');
        if (!after.choiceHidden) problems.push('the choice is still there');
        if (!card.shown) problems.push('the card did not follow "Explore"');
        if (card.focus !== 'threshold-begin') problems.push(`focus on the card was on ${card.focus}`);
    }
    if (pass.expect === 'crossfade' && after.passage?.frames !== 0) problems.push('the tunnel drew frames under a crossfade');
    if (pass.expect === 'flight' && !(after.passage?.frames > 0)) problems.push('no flight frames');
    if (then === 'watch' && pass.expect === 'flight') {
        if (after.passage?.skipped) problems.push('the flight was skipped by itself');
        if (lines !== null && after.passage?.linesShown !== lines) problems.push(`${after.passage?.linesShown} of ${lines} lines surfaced`);
    }
    // (If it landed before the skip could be sent, there was nothing to skip: noted, not a problem.)
    result.landedBeforeSkip = then === 'skip' && pass.expect === 'flight' && skipAt === null;
    if (then === 'skip' && pass.expect === 'flight' && skipAt !== null) {
        if (!after.passage?.skipped) problems.push('the skip was not heard');
        if (result.skipToLanded === null || result.skipToLanded > 2500) problems.push(`skip took ${result.skipToLanded} ms to land`);
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
 * Coming back within the same visit (a reload): no card and no flight, only the
 * dark the city lifts out of; then the points are reachable, and nothing of the
 * threshold is left over.
 */
async function comeBack(page) {
    await page.waitForFunction(() => document.documentElement.dataset.threshold === 'done', null, { timeout: LOAD_TIMEOUT });
    const mode = await settle(page);
    const after = await page.evaluate(() => ({
        log: window.__elysicesterLog ?? [],
        pointsInert: document.getElementById('points').inert,
        cardHidden: document.getElementById('threshold').hidden,
        veilDark: document.getElementById('veil').classList.contains('is-dark'),
        returningLeft: document.documentElement.hasAttribute('data-returning'),
    }));
    const sequence = after.log.filter((entry) => entry.name === 'data-threshold').map((entry) => entry.value).join(' > ');
    const problems = [];
    if (sequence !== 'returning > done') problems.push(`sequence was ${sequence}`);
    if (after.pointsInert) problems.push('the points stayed inert');
    if (!after.cardHidden) problems.push('the card showed');
    if (after.veilDark) problems.push('the veil stayed dark');
    if (after.returningLeft) problems.push('the page still marks itself as returning');
    return { mode, sequence, problems, ok: problems.length === 0 };
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
        if (off.state !== 'off' || off.pressed !== 'false' || off.label !== 'sound: off') problems.push('the toggle did not turn it off');
    } else {
        const start = await soundReading(page);
        steps.push({ after: 'arrival', ...start });
        if (start.state !== 'off' || start.pressed !== 'false' || start.label !== 'sound: off') problems.push(`sound was ${start.state} before the toggle`);
        await page.click('#sound-toggle');
        const on = await soundState(page, 'running');
        steps.push({ after: 'toggle on', ...on });
        if (on.state !== 'running' || on.pressed !== 'true' || on.label !== 'sound: on' || on.stored !== '"on"') problems.push(`the toggle gave ${JSON.stringify(on)}`);
        await page.click('#sound-toggle');
        const off = await soundState(page, 'off');
        steps.push({ after: 'toggle off', ...off });
        if (off.state !== 'off' || off.pressed !== 'false' || off.label !== 'sound: off' || off.stored !== '"off"') problems.push(`the second toggle gave ${JSON.stringify(off)}`);
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
 * only between slow frames (a phone-sized frame can take more than a second there, where a phone draws
 * sixty); such a press is no tap at all, and the rounds press again. So a touch pass holds the city's
 * frames still for the moment of the tap (the tap itself is answered by the same handlers, as it is
 * between a phone's frames) and lets them run again at once.
 */
async function pressAt(page, context, pass, point) {
    await page.evaluate((hold) => {
        const canvas = document.getElementById('stage');
        window.__press = {};
        canvas.addEventListener('pointerdown', (event) => { window.__press.down = event.timeStamp; }, { once: true });
        canvas.addEventListener('pointerup', (event) => { window.__press.up = event.timeStamp; }, { once: true });
        if (hold) window.elysicesterDebug?.stage?.stop();
    }, Boolean(pass.hasTouch));
    try {
        if (pass.hasTouch) await touch(context, page, [point]);
        else await page.mouse.click(point.x, point.y);
    } finally {
        if (pass.hasTouch) await page.evaluate(() => window.elysicesterDebug?.stage?.start());
    }
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
    await page.addStyleTag({ content: '.plainly, .debug-readout, .controls, .one-button, .inventory-toggle, .sound-corner, .choice, .threshold-voice, .veil, .point-label, .sign-label, .place-names, .place-name, .whisper, .grain { visibility: hidden !important; }' });
}

/** Encode a PNG as a WebP of the given size, using the browser's own encoder. */
/**
 * A frame as an image file: scaled to the width or height asked (the other kept in proportion), or, given both, the
 * frame's middle cut to that shape; WebP unless another type is asked.
 */
async function encodeFrame(page, png, { width, height, type = 'image/webp', quality = 0.8, anchor = 'middle' }) {
    return page.evaluate(async ({ source, width: w, height: h, type: kind, quality: q, anchor: from }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const targetWidth = w ?? Math.round((image.width * h) / image.height);
        const targetHeight = h ?? Math.round((image.height * w) / image.width);
        // (Both given: the largest part of the frame of that shape, from its middle, or from its top: the card keeps the sky's
        // words whole, Elm's THIS IS NOT THE WORLD, and lets the roots under the island go.)
        const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
        const cropWidth = targetWidth / scale;
        const cropHeight = targetHeight / scale;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, (image.width - cropWidth) / 2, from === 'top' ? 0 : (image.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
        return canvas.toDataURL(kind, q).split(',')[1];
    }, { source: `data:image/png;base64,${png.toString('base64')}`, width, height, type, quality, anchor });
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
    const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'signs.json'), 'utf8'));
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
    const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'signs.json'), 'utf8'));
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
    const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'fragments.json'), 'utf8'));
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

/**
 * The dock start (the dock and cyclolite trials, trials.js): a plain visit must arrive flying at the end of the jetty,
 * on the Cyclolite (past the jetty's end, on its deck), the hum perched there, the camera close behind it, and the
 * jetty's signs standing; a reload (within the visit) must come back there; and the one option at the top of the
 * screen must go "zoom out" (the camera drawn back as far as it follows, still flying), "zoom out" (letting go, out to
 * the whole city, where it says "leave"), and "leave", to the choice, from which "Explore" comes back to the city
 * where it was. Beside the option, the hum's own button must be there only while the camera isn't close on the hum,
 * and bring it back in close (taking the hum again, once let go). Its own browser, as a first visit.
 */
async function dockRound(chromium, pass, shots) {
    const { browser, context, page, messages, failures } = await openPass(chromium, pass);
    const problems = [];
    const where = () => page.evaluate(() => {
        const { walk, stage } = window.elysicesterDebug;
        const one = document.getElementById('one-button');
        return {
            walking: walk?.state.walking ?? null,
            at: walk ? walk.state.position.toArray().map((n) => Number(n.toFixed(2))) : null,
            // How high the hum hovers over its shadow: perched, a little; flying, at a body's height.
            perch: walk?.humAt ? Number((walk.humAt.y - walk.state.position.y).toFixed(2)) : null,
            cameraToWalker: walk ? Number(stage.camera.position.distanceTo(walk.state.position).toFixed(2)) : null,
            follow: walk ? Number(walk.followDistance.toFixed(2)) : null,
            followFar: walk?.followFar ?? null,
            atHome: stage?.rig.atHome ?? null,
            // (Fixed to the screen, so seen if it has a box at all: hidden, or stepped away, it has none.)
            one: one && one.getClientRects().length > 0 ? one.textContent : null,
            hum: (document.getElementById('hum-button')?.getClientRects().length ?? 0) > 0,
            choice: Boolean(document.getElementById('choice')?.classList.contains('is-shown') && !document.getElementById('choice').hidden),
            boat: Boolean(stage?.scene.getObjectByName('cyclolite-light')),
            signs: Boolean(stage?.scene.getObjectByName('guides')),
        };
    });
    // (The option's words follow the camera frame by frame: under SwiftShader a frame can take a second.)
    const oneSays = (words) => page.waitForFunction((wanted) => document.getElementById('one-button')?.textContent === wanted, words, { timeout: 15_000 }).catch(() => {});
    const arrived = (seen, when) => {
        if (!seen.walking) problems.push(`${when}: not flying as the hum`);
        if (!seen.boat) problems.push(`${when}: no Cyclolite at the jetty's end`);
        else if (!(seen.at?.[0] > 23.5) || !(Math.abs(seen.at[1] - 0.19) < 0.15)) problems.push(`${when}: not on the Cyclolite's deck (${seen.at})`);
        if (seen.perch === null || !(seen.perch < 0.8)) problems.push(`${when}: the hum is not perched (it hovers ${seen.perch} over its shadow)`);
        if (!(seen.cameraToWalker < 8)) problems.push(`${when}: the camera is ${seen.cameraToWalker} from it, not close behind`);
        if (!seen.signs) problems.push(`${when}: the jetty's signs are not standing`);
        if (seen.one !== 'zoom out') problems.push(`${when}: the one option says ${JSON.stringify(seen.one)}, not "zoom out"`);
        if (seen.hum) problems.push(`${when}: the hum's button is showing while the camera is close on the hum`);
    };
    const followFor = (wanted) => page.waitForFunction((distance) => Math.abs(window.elysicesterDebug.walk.followDistance - distance) < 0.06, wanted, { timeout: 10_000 }).catch(() => {});
    // (The hum's button follows the camera frame by frame too: waited for, not read at a fixed delay.)
    const humShows = (extra = 'true') => page.waitForFunction((also) => (document.getElementById('hum-button')?.getClientRects().length ?? 0) > 0
        && (also === 'home' ? window.elysicesterDebug.stage.rig.atHome : true), extra, { timeout: 15_000 }).catch(() => {});
    const result = {};
    try {
        await page.goto(`${origin}/?${SKIPPABLE}`, { waitUntil: 'load' });
        const entered = await enter(page, context, pass, { begin: pass.begin, then: 'skip' });
        if (entered.mode !== 'live') problems.push(`the city did not go live (${entered.mode})`);
        for (const line of entered.problems) problems.push(`threshold: ${line}`);
        await oneSays('zoom out');
        result.arrival = await where();
        arrived(result.arrival, 'arriving');
        await page.screenshot({ path: `${shots}-dock.png` });
        await page.reload({ waitUntil: 'load' });
        const back = await comeBack(page);
        for (const line of back.problems) problems.push(`on return: ${line}`);
        await oneSays('zoom out');
        result.reload = await where();
        arrived(result.reload, 'on return');
        // The one option, round. "zoom out": the camera draws back as far as it follows, still flying...
        await page.click('#one-button');
        await page.waitForFunction(() => {
            const { walk } = window.elysicesterDebug;
            return walk.followDistance >= walk.followFar - 0.05;
        }, null, { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(pass.reducedMotion ? 800 : 3000);
        await humShows();
        result.zoomed = await where();
        if (!result.zoomed.walking) problems.push('the first "zoom out" let go of the hum');
        if (!(result.zoomed.follow >= result.zoomed.followFar - 0.05)) problems.push(`the first "zoom out" drew back to ${result.zoomed.follow}, not ${result.zoomed.followFar}`);
        if (result.zoomed.one !== 'zoom out') problems.push(`after the first "zoom out" the option says ${JSON.stringify(result.zoomed.one)}`);
        if (!result.zoomed.hum) problems.push('drawn back, the hum\'s button is not there');
        await page.screenshot({ path: `${shots}-dock-zoomed.png` });
        // (The hum's button brings the camera back in close; the option draws it back again.)
        const followStart = await page.evaluate(() => window.elysicesterDebug.walk.followStart);
        await page.click('#hum-button');
        await followFor(followStart);
        result.recentred = await where();
        if (!result.recentred.walking || Math.abs(result.recentred.follow - followStart) > 0.06) problems.push(`the hum's button did not bring the camera back in close (${result.recentred.follow}, not ${followStart})`);
        if (result.recentred.hum) problems.push('back in close, the hum\'s button is still showing');
        await page.click('#one-button');
        await followFor(result.zoomed.followFar);
        // ... "zoom out" again: it lets go, out to the whole city, where the option says "leave" ...
        await page.click('#one-button');
        await oneSays('leave');
        await page.waitForTimeout(pass.reducedMotion ? 800 : 4000);
        await humShows('home');
        result.whole = await where();
        if (result.whole.walking) problems.push('the second "zoom out" left it flying');
        if (!result.whole.atHome) problems.push('the second "zoom out" did not draw back to the whole city');
        if (result.whole.one !== 'leave') problems.push(`at the whole city the option says ${JSON.stringify(result.whole.one)}, not "leave"`);
        if (!result.whole.hum) problems.push('out at the whole city, the hum\'s button is not there');
        await page.screenshot({ path: `${shots}-dock-whole.png` });
        // ... "leave" brings the choice back (the city's options stepping away), and "Explore" comes back to the
        // city where it was ...
        await page.click('#one-button');
        // (The choice comes in from the next frame: under SwiftShader a frame can take a second.)
        await page.waitForFunction(() => document.getElementById('choice')?.classList.contains('is-shown'), null, { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(pass.reducedMotion ? 300 : 1300);
        result.left = await where();
        if (!result.left.choice) problems.push('"leave" did not bring the choice back');
        if (result.left.one !== null || result.left.hum) problems.push('with the choice back, the city\'s options are still showing');
        const focused = await page.evaluate(() => document.activeElement?.id ?? null);
        if (focused !== 'choice-explore') problems.push(`with the choice back, focus is on ${focused}, not "Explore"`);
        await page.screenshot({ path: `${shots}-dock-left.png` });
        await page.click('#choice-explore');
        await oneSays('leave');
        await page.waitForTimeout(pass.reducedMotion ? 300 : 1300);
        result.returned = await where();
        if (result.returned.choice) problems.push('"Explore" left the choice up');
        if (!result.returned.atHome || result.returned.one !== 'leave') problems.push(`"Explore" did not come back to the whole city (at home ${result.returned.atHome}, option ${JSON.stringify(result.returned.one)})`);
        // ... and the hum's button takes the hum again, close.
        await page.click('#hum-button');
        await page.waitForFunction(() => window.elysicesterDebug.walk.state.walking, null, { timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(pass.reducedMotion ? 800 : 3000);
        result.taken = await where();
        if (!result.taken.walking) problems.push('the hum\'s button did not take the hum again');
        if (result.taken.one !== 'zoom out') problems.push(`taken again, the option says ${JSON.stringify(result.taken.one)}, not "zoom out"`);
    } catch (error) {
        problems.push(`the round broke off: ${error.message.split('\n')[0]}`);
    } finally {
        await browser.close();
    }
    for (const line of [...messages, ...failures]) problems.push(line);
    return { ...result, problems, ok: problems.length === 0 };
}

/**
 * The givers (creatures.js), Allison (allison.js) and the win (inventory.js), on trial: every passage of Numbers by
 * Paint has a giver (a pug or a hum) and no other passage does; a pug says "squur" and a hum "chirp" where a place's
 * name would be; Allison says his line (Elm's words) and gives the bio, in English, from the site's bio page; the lost
 * pages are counted (data/lost-pages.json: Numbers by Paint's from the givers, President Oedipus's five parts from its
 * flowers), each found one in the inventory leading to its mark in the texts; with all but the last gathered (remembered
 * from an earlier visit), the last one given brings the win, once its passage is closed, and the win writes the whole
 * of it by hand (Elm's engine) as a page to take away, which must hold every lost page. Its own browser, as a
 * returning reader.
 */
async function creaturesRound(chromium, pass, outDir, name) {
    const { browser, context, page, messages, failures } = await openPass(chromium, pass);
    const problems = [];
    const result = {};
    try {
        const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'creatures.json'), 'utf8'));
        const pieces = JSON.parse(await readFile(path.join(ROOT, 'data', 'lost-pages.json'), 'utf8')).lost;
        const texts = await readFile(path.join(ROOT, 'read.html'), 'utf8');
        const last = pieces[pieces.length - 1];
        // Every piece but the last gathered on an earlier visit (remembered on this origin before the city loads).
        await page.goto(`${origin}/data/places.json`);
        await page.evaluate((seen) => window.localStorage.setItem('elysicester:read', JSON.stringify(seen)), pieces.slice(0, -1));
        await page.goto(`${origin}/?${SKIPPABLE}&dock=off`, { waitUntil: 'load' });
        const entered = await enter(page, context, pass, { begin: pass.begin, then: 'skip' });
        for (const line of entered.problems) problems.push(`threshold: ${line}`);
        result.city = await page.evaluate(() => {
            const { creatures, allison, fragments, stage } = window.elysicesterDebug;
            const toggle = document.getElementById('inventory-toggle');
            // (All of them: those far from the camera aren't drawn, creatures.js.)
            const counts = creatures?.counts() ?? { pugs: null, hums: null };
            return {
                built: Boolean(creatures),
                pugs: counts.pugs,
                hums: counts.hums,
                shades: stage.scene.getObjectByName('giver-shades')?.geometry.attributes.position.count ?? 0,
                allison: Boolean(allison) && Boolean(stage.scene.getObjectByName('allison')),
                nbp: fragments.filter((fragment) => fragment.work === 'nbp').map((fragment) => ({ id: fragment.id, giver: creatures?.kindOf(fragment.id) ?? null })),
                others: fragments.filter((fragment) => fragment.work !== 'nbp' && creatures?.has(fragment.id)).map((fragment) => fragment.id),
                toggle: toggle.hidden ? null : toggle.querySelector('[data-inventory-count]').textContent,
            };
        });
        const { city } = result;
        // (Each lost page's words as the city has them: President Oedipus's parts are read from its page, not the data.)
        const cityTexts = new Map(await page.evaluate(() => window.elysicesterDebug.fragments.map((fragment) => [fragment.id, fragment.text])));
        if (!city.built) problems.push('no givers');
        const kinds = data.creatures.reduce((sum, creature) => ({ ...sum, [creature.kind]: (sum[creature.kind] ?? 0) + 1 }), {});
        if (city.pugs !== (kinds.pug ?? 0)) problems.push(`${city.pugs} pugs drawn, ${kinds.pug} meant`);
        if (city.hums !== (kinds.hum ?? 0)) problems.push(`${city.hums} hums drawn, ${kinds.hum} meant`);
        if (!(city.shades > 0)) problems.push('no shades beneath them');
        for (const piece of city.nbp) if (!piece.giver) problems.push(`${piece.id} has no giver`);
        if (city.others.length) problems.push(`passages not of Numbers by Paint have givers: ${city.others.join(', ')}`);
        if (!city.allison) problems.push('no Allison');
        if (city.toggle !== `${pieces.length - 1} / ${pieces.length}`) problems.push(`the count said ${JSON.stringify(city.toggle)}`);
        // What they say.
        result.speech = await page.evaluate((wanted) => {
            const { hotspots, fragments } = window.elysicesterDebug;
            const said = {};
            for (const id of wanted) {
                hotspots.light(fragments.find((fragment) => fragment.id === id));
                const label = document.getElementById('point-label');
                said[id] = { words: label.textContent, speech: label.classList.contains('is-speech') };
            }
            hotspots.light(null);
            return said;
        }, [data.creatures.find((creature) => creature.kind === 'pug')?.fragment, data.creatures.find((creature) => creature.kind === 'hum')?.fragment, 'allison-bio'].filter(Boolean));
        for (const [id, said] of Object.entries(result.speech)) {
            const kind = id === 'allison-bio' ? 'allison' : data.creatures.find((creature) => creature.fragment === id)?.kind;
            const want = { pug: 'squur', hum: 'chirp', allison: 'I’ve been trying to read this old plaque. It’s all Latin. What could it mean?' }[kind];
            if (said.words !== want || !said.speech) problems.push(`${id} said ${JSON.stringify(said.words)}`);
        }
        // The inventory: every lost page numbered in the texts' order; each found one leads to its mark in the texts.
        await page.click('#inventory-toggle');
        await page.waitForFunction(() => document.getElementById('inventory').open, null, { timeout: 8000 }).catch(() => {});
        result.inventory = await page.evaluate(() => ({
            items: document.querySelectorAll('[data-inventory-list] > li').length,
            links: [...document.querySelectorAll('[data-inventory-list] a.inventory-texts')].map((link) => link.getAttribute('href')),
        }));
        await page.screenshot({ path: path.join(outDir, `${name}-inventory.png`) });
        if (result.inventory.items !== pieces.length) problems.push(`the inventory lists ${result.inventory.items} lost pages, not ${pieces.length}`);
        if (result.inventory.links.length !== pieces.length - 1) problems.push(`${result.inventory.links.length} found pages lead to the texts, not ${pieces.length - 1}`);
        for (const href of result.inventory.links) {
            const id = /^read\.html#(lost-[a-z0-9-]+)$/.exec(href)?.[1];
            if (!id || !texts.includes(`id="${id}"`)) problems.push(`the inventory's ${JSON.stringify(href)} leads nowhere in the texts`);
        }
        // A found page of Numbers by Paint, read again from the inventory, is read whole (a trial, whole): its stretch
        // of the thesis, from the texts, its own passage within it.
        const wholeAt = await page.evaluate(() => [...document.querySelectorAll('[data-inventory-list] > li.is-found .inventory-piece')]
            .findIndex((button) => button.querySelector('.inventory-where')?.textContent.includes('Numbers by Paint')));
        if (wholeAt < 0) {
            problems.push('no found page of Numbers by Paint in the inventory to read whole');
            await page.keyboard.press('Escape');
        } else {
            await page.locator('[data-inventory-list] > li.is-found .inventory-piece').nth(wholeAt).click();
            await page.waitForFunction(() => document.getElementById('reader').open && document.querySelector('[data-reader-text]').classList.contains('is-whole'), null, { timeout: 15_000 }).catch(() => {});
            result.whole = await page.evaluate(() => ({
                open: document.getElementById('reader').open,
                whole: document.querySelector('[data-reader-text]').classList.contains('is-whole'),
                letters: document.querySelector('[data-reader-text]').textContent.replace(/\s+/g, '').length,
                text: document.querySelector('[data-reader-text]').textContent.replace(/\s+/g, ' '),
                source: document.querySelector('[data-reader-source]')?.textContent ?? '',
            }));
            await page.screenshot({ path: path.join(outDir, `${name}-whole.png`) });
            // (The found pages, in the inventory's order: every lost page but the last, which waits.)
            const wholeId = pieces.filter((id) => id !== last)[wholeAt];
            const opening = (cityTexts.get(wholeId) ?? '').replace(/^…\s*/, '').split(/\s+/).slice(0, 5).join(' ');
            if (!result.whole.whole) problems.push('a found page of Numbers by Paint did not read whole from the inventory');
            else {
                if (result.whole.letters < 1000) problems.push(`the whole lost page held only ${result.whole.letters} letters`);
                if (!/its lost page whole \(thesis pp?\. \d+(–\d+)?\)/.test(result.whole.source)) problems.push(`the whole lost page's source read ${JSON.stringify(result.whole.source)}`);
                if (opening && !result.whole.text.includes(opening.replace(/\s+/g, ' '))) problems.push(`the whole lost page didn't hold its passage ("${opening}")`);
            }
            delete result.whole.text;
            await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(400);
        // Allison's bio, from the site's own page, in English. (From the reading points' list, as keys reach it: it
        // shows only while it holds the focus.)
        await page.focus('#points a[data-fragment="allison-bio"]');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.getElementById('reader').open, null, { timeout: 8000 }).catch(() => {});
        result.bio = await page.evaluate(() => ({
            heading: document.querySelector('[data-reader-place]').textContent,
            text: document.querySelector('[data-reader-text]').textContent,
        }));
        await page.screenshot({ path: path.join(outDir, `${name}-bio.png`) });
        const bioPage = await readFile(path.join(ROOT, 'bio.html'), 'utf8');
        if (result.bio.heading !== 'Bio') problems.push(`the bio's heading was ${JSON.stringify(result.bio.heading)}`);
        for (const words of ['President Oedipus', 'False Cows']) {
            if (!bioPage.includes(words)) problems.push(`(bio.html itself lacks "${words}": the check needs updating)`);
            else if (!result.bio.text.includes(words)) problems.push(`the bio lacks "${words}"`);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        // The last piece, given: when its passage closes, the win.
        const downloading = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
        await page.focus(`#points a[data-fragment="${last}"]`);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.getElementById('reader').open, null, { timeout: 8000 }).catch(() => {});
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.getElementById('inventory').open, null, { timeout: 8000 }).catch(() => {});
        result.win = await page.evaluate(() => ({
            open: document.getElementById('inventory').open,
            won: !document.querySelector('[data-inventory-win]').hidden,
            toggle: document.querySelector('#inventory-toggle [data-inventory-count]').textContent,
            focus: document.activeElement?.dataset?.inventoryWrite !== undefined ? 'write' : document.activeElement?.tagName ?? null,
        }));
        await page.screenshot({ path: path.join(outDir, `${name}-win.png`) });
        if (!result.win.open) problems.push('the win did not show');
        if (!result.win.won) problems.push('the inventory did not say it was won');
        if (result.win.toggle !== `${pieces.length} / ${pieces.length}`) problems.push(`the count said ${JSON.stringify(result.win.toggle)} at the end`);
        if (result.win.focus !== 'write') problems.push(`focus on the win was on ${result.win.focus}`);
        // The page the win writes.
        await page.click('[data-inventory-write]');
        const download = await downloading;
        if (!download) {
            problems.push('nothing was written to take away');
        } else {
            const file = path.join(outDir, `${name}-${download.suggestedFilename()}`);
            await download.saveAs(file);
            const html = await readFile(file, 'utf8');
            // (Each lost page's first words, as the page writes them: its own escaping aside.)
            const plain = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            const missing = pieces.filter((id) => !cityTexts.has(id) || !plain.includes(cityTexts.get(id).replace(/^…\s*/, '').split(/\s+/).slice(0, 4).join(' ')));
            if (missing.length) problems.push(`the written page lacks ${missing.join(', ')}`);
            if (!html.includes('handToggle') || !html.includes('const G = {')) problems.push('the written page lacks the handwrite engine');
            result.written = { file: path.basename(file), bytes: html.length, missing };
            // And it writes itself by hand, as it's scrolled.
            const reading = await context.newPage();
            await reading.goto(`file://${file.replace(/\\/g, '/')}`);
            await reading.waitForTimeout(2500);
            await reading.mouse.wheel(0, 900);
            await reading.waitForTimeout(2500);
            result.written.strokes = await reading.evaluate(() => document.querySelectorAll('.hand-svg path').length);
            await reading.screenshot({ path: path.join(outDir, `${name}-written.png`) });
            await reading.close();
            if (!(result.written.strokes > 0)) problems.push('the written page drew no handwriting');
        }
    } catch (error) {
        problems.push(`the round broke off: ${error.message.split('\n')[0]}`);
    } finally {
        await browser.close();
    }
    for (const line of [...messages, ...failures]) problems.push(line);
    return { ...result, problems, ok: problems.length === 0 };
}

/**
 * President Oedipus's five parts as its page has them (essays/president-oedipus.html, each marked id="part-N"; the
 * first takes in its own paragraph, the rest begin after their ". . ."; the note goes with the last): id → its words,
 * tags, entities and spaces aside (as check-elysicester.mjs cuts them).
 */
function essayParts(essay) {
    const words = (html) => html.replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/[\s ­]+/g, '');
    const marks = [1, 2, 3, 4, 5].map((number) => {
        const found = new RegExp(`<p[^>]*\\bid="part-${number}"[^>]*>[\\s\\S]*?</p>`).exec(essay);
        return found ? { number, start: found.index, end: found.index + found[0].length } : null;
    });
    const parts = new Map();
    if (marks.some((mark) => mark === null)) return parts;
    const bodyEnd = essay.lastIndexOf('</div>', essay.indexOf('<div class="related">', marks[4].end));
    for (const { number, start, end } of marks) parts.set(`po-part-${number}`, words(essay.slice(number === 1 ? start : end, number < 5 ? marks[number].start : bodyEnd)));
    return parts;
}

/**
 * President Oedipus's flowers (flowers.js), on trial (plants): on a first visit there are five, the first part in
 * bloom and the rest in bud; a bud touched out of its turn doesn't open, and says where the bloom is (for a reader who
 * can't see it glint); each, touched in its turn, opens its part whole, word for word as the essay's page has it, and
 * wilts as the next comes into bloom; the lost pages count up as they're found. Its own browser, a first visit.
 */
async function plantsRound(chromium, pass, outDir, name) {
    const { browser, context, page, messages, failures } = await openPass(chromium, pass);
    const problems = [];
    const result = { opened: [] };
    try {
        const flowerData = JSON.parse(await readFile(path.join(ROOT, 'data', 'flowers.json'), 'utf8'));
        const parts = essayParts(await readFile(path.join(ROOT, flowerData.page), 'utf8'));
        if (parts.size !== 5) problems.push(`${flowerData.page} doesn't mark its five parts`);
        const pieces = JSON.parse(await readFile(path.join(ROOT, 'data', 'lost-pages.json'), 'utf8')).lost;
        await page.goto(`${origin}/?${SKIPPABLE}&dock=off`, { waitUntil: 'load' });
        const entered = await enter(page, context, pass, { begin: pass.begin, then: 'skip' });
        for (const line of entered.problems) problems.push(`threshold: ${line}`);
        const states = () => page.evaluate(() => window.elysicesterDebug.flowers?.snapshot().map((flower) => flower.state) ?? null);
        result.first = await states();
        if (!result.first) throw new Error('no flowers');
        if (result.first.join(' ') !== 'bloom bud bud bud bud') problems.push(`at first the flowers were ${result.first.join(', ')}`);
        // The camera brought to a flower, still, and the flower pressed (again, if the press was too slow to be a tap).
        const pressFlower = async (id) => {
            await page.evaluate((wanted) => {
                window.elysicesterDebug.walk?.letGo?.();
                window.elysicesterDebug.rig.setDrifting(false);
                window.elysicesterDebug.focusFragment(wanted);
            }, id);
            await cameraSettled(page);
            const spot = await page.evaluate((wanted) => window.elysicesterDebug.hotspots.screenPositions().find((entry) => entry.id === wanted), id);
            if (!spot?.inFront || !spot.visible) return { pressed: false, spot };
            for (let attempt = 0; attempt < PRESSES; attempt += 1) {
                const press = await pressAt(page, context, pass, { x: spot.x, y: spot.y });
                await page.waitForTimeout(600);
                if (press < TAP_LIMIT || await page.evaluate(() => document.getElementById('reader').open)) break;
            }
            await page.waitForFunction(() => document.getElementById('reader').open, null, { timeout: 4000 }).catch(() => {});
            return { pressed: true, spot };
        };
        // A bud, out of its turn.
        const bud = await pressFlower('po-part-3');
        result.bud = await page.evaluate(() => ({
            open: document.getElementById('reader').open,
            status: document.getElementById('city-status')?.textContent ?? '',
        }));
        await page.screenshot({ path: path.join(outDir, `${name}-plants-bud.png`) });
        if (!bud.pressed) problems.push('the bud at the Steel Garden is hidden in its own view');
        if (result.bud.open) {
            problems.push('a bud opened out of its turn');
            await page.keyboard.press('Escape');
        }
        if (!/won't open yet\. The flower in bloom is at the gas station\./.test(result.bud.status)) problems.push(`a bud said ${JSON.stringify(result.bud.status)}`);
        // Each in its turn.
        for (let number = 1; number <= 5; number += 1) {
            const id = `po-part-${number}`;
            const pressed = await pressFlower(id);
            const reader = await page.evaluate(() => ({
                open: document.getElementById('reader').open,
                words: document.querySelector('[data-reader-text]').textContent.replace(/[\s ­]+/g, ''),
                source: document.querySelector('[data-reader-source]').textContent,
                count: document.querySelector('[data-reader-count]')?.textContent ?? '',
            }));
            const whole = reader.words === parts.get(id);
            result.opened.push({ id, pressed: pressed.pressed, open: reader.open, whole, source: reader.source, count: reader.count });
            if (number === 1) await page.screenshot({ path: path.join(outDir, `${name}-plants-part-1.png`) });
            if (!pressed.pressed) problems.push(`${id}'s flower is hidden in its own view`);
            else if (!reader.open) problems.push(`${id} didn't open in its turn`);
            else {
                if (!whole) problems.push(`${id} didn't hold its part word for word (${reader.words.length} letters, the page's ${parts.get(id)?.length})`);
                if (!reader.source.includes(`part of five`)) problems.push(`${id}'s source said ${JSON.stringify(reader.source)}`);
                if (reader.count !== `${number} of ${pieces.length} lost pages found`) problems.push(`${id}'s count said ${JSON.stringify(reader.count)}`);
            }
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.getElementById('reader').open, null, { timeout: 4000 }).catch(() => {});
            // (It's begun to wilt, and the next is the one in bloom. Its animation isn't waited out: under SwiftShader a
            // frame takes a second or so and each steps the flowers 0.05 s, so a wilt takes the best part of a minute.)
            await page.waitForFunction((index) => {
                const flowers = window.elysicesterDebug.flowers.snapshot();
                return flowers[index].state === 'wilted' && flowers[index].wilt > 0 && (index === 4 || flowers[index + 1].state === 'bloom');
            }, number - 1, { timeout: 30_000, polling: 250 }).catch(() => problems.push(`${id} didn't begin to wilt, or the next didn't come into bloom`));
        }
        result.last = await states();
        await page.screenshot({ path: path.join(outDir, `${name}-plants-wilted.png`) });
        if (result.last.join(' ') !== 'wilted wilted wilted wilted wilted') problems.push(`at last the flowers were ${result.last.join(', ')}`);
    } catch (error) {
        problems.push(`the round broke off: ${error.message.split('\n')[0]}`);
    } finally {
        await browser.close();
    }
    for (const line of [...messages, ...failures]) problems.push(line);
    return { ...result, problems, ok: problems.length === 0 };
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
/**
 * When what the city needs doesn't come (a review of the site, 2 Oct, its C1 and C2): one of its modules blocked, so
 * its code can never begin, "Explore" must still lead somewhere (the still, its line, the way to the texts) and "Read"
 * still read; one of its data files failing, the city begins but can't be built, and the still must say so (not promise
 * a list that isn't there); and the code merely slow to come, "Explore" pressed early must be taken up when it comes.
 */
async function failureRound(chromium, pass, outDir, name) {
    const problems = [];
    const result = {};
    const stillState = (page) => page.evaluate(() => ({
        mode: document.documentElement.dataset.mode ?? null,
        fallback: !document.getElementById('fallback').hidden,
        failedLine: !document.querySelector('.fallback-failed').hidden,
        webglLine: !document.querySelector('.fallback-webgl').hidden,
        points: !document.getElementById('points').hidden,
        textsLink: document.querySelector('.fallback-failed a')?.getAttribute('href') ?? null,
        threshold: document.documentElement.dataset.threshold ?? null,
    }));
    // A module that can't be fetched: the city's code never begins.
    {
        const session = await openPass(chromium, pass);
        await session.context.route('**/modules/whisper.js', (route) => route.abort());
        await session.page.goto(`${origin}/?${SKIPPABLE}`, { waitUntil: 'load' });
        await session.page.waitForSelector('#choice-explore', { state: 'visible', timeout: 20_000 });
        await session.page.waitForTimeout(3000);
        const readTo = await session.page.getAttribute('#choice-read', 'href');
        await session.page.click('#choice-explore');
        await session.page.waitForFunction(() => document.documentElement.dataset.mode === 'still', null, { timeout: 15_000 }).catch(() => {});
        result.module = { ...(await stillState(session.page)), readTo };
        await session.page.screenshot({ path: path.join(outDir, `${name}-failure-module.png`) });
        if (result.module.mode !== 'still' || !result.module.fallback) problems.push('a module blocked: "Explore" did not lead to the still');
        if (!result.module.failedLine || result.module.webglLine) problems.push('a module blocked: the still did not say the city stays in the book');
        if (result.module.textsLink !== 'read.html#numbers-by-paint') problems.push(`a module blocked: the still's way to the texts went to ${result.module.textsLink}`);
        if (readTo !== 'read.html') problems.push(`a module blocked: "Read" led to ${readTo}`);
        await session.browser.close();
    }
    // A data file that fails: the city's code begins, but can't build the city.
    {
        const session = await openPass(chromium, pass);
        await session.context.route('**/data/places.json', (route) => route.fulfill({ status: 404, body: '' }));
        await session.page.goto(`${origin}/?${SKIPPABLE}`, { waitUntil: 'load' });
        await session.page.waitForSelector('#choice-explore', { state: 'visible', timeout: 20_000 });
        await session.page.waitForTimeout(3000);
        if (await session.page.isVisible('#choice-explore')) await session.page.click('#choice-explore').catch(() => {});
        await session.page.waitForFunction(() => document.documentElement.dataset.mode === 'still', null, { timeout: 20_000 }).catch(() => {});
        await session.page.waitForTimeout(1200);
        result.data = await stillState(session.page);
        await session.page.screenshot({ path: path.join(outDir, `${name}-failure-data.png`) });
        if (result.data.mode !== 'still' || !result.data.fallback) problems.push('a data file failing: the still did not show');
        if (!result.data.failedLine || result.data.webglLine) problems.push('a data file failing: the still promised its reading points, with none to list');
        if (result.data.points) problems.push('a data file failing: an empty list of reading points showed');
        await session.browser.close();
    }
    // The code slow to come: "Explore" pressed before it's here is taken up when it is.
    {
        const session = await openPass(chromium, pass);
        await session.context.route('**/main.js', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            await route.continue();
        });
        // (Not waiting for DOMContentLoaded: a module script runs before it fires, so the code would be here by then.)
        await session.page.goto(`${origin}/?${SKIPPABLE}`, { waitUntil: 'commit' });
        await session.page.waitForSelector('#choice-explore', { state: 'visible', timeout: 20_000 });
        // (Once the page is read, so its own little script is listening: before the code comes, as a visitor would.)
        await session.page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 20_000 });
        const early = await session.page.evaluate(() => document.documentElement.dataset.booted === undefined);
        await session.page.click('#choice-explore');
        await session.page.waitForFunction(() => ['card', 'flight', 'crossfade', 'done'].includes(document.documentElement.dataset.threshold), null, { timeout: LOAD_TIMEOUT }).catch(() => {});
        result.slow = { pressedEarly: early, threshold: await session.page.evaluate(() => document.documentElement.dataset.threshold ?? null) };
        if (!early) problems.push('the slow code arrived before "Explore" could be pressed early (the check proved nothing)');
        else if (!['card', 'flight', 'crossfade', 'done'].includes(result.slow.threshold)) problems.push(`"Explore" pressed while the code was coming was not taken up (the threshold: ${result.slow.threshold})`);
        await session.browser.close();
    }
    return { ...result, problems, ok: problems.length === 0 };
}

/**
 * The way in waited through (the settle trial; Elm, 3 Oct: "let's try making it compulsory to wait for the mega screen
 * to settle and then for the swirling to resolve"): from "Explore", the card takes no press while the Mega-Screen rolls
 * in (its prompt unseen, its button marked unavailable), the prompt comes once it stands, and focus with it; then
 * begun, the swirl takes no Esc and no click, plays all E's lines, and lands once the city is ready.
 */
async function settleRound(chromium, pass, outDir, name) {
    const problems = [];
    const result = {};
    const session = await openPass(chromium, pass);
    const { page } = session;
    const state = () => page.evaluate(() => ({
        threshold: document.documentElement.dataset.threshold ?? null,
        settling: document.documentElement.dataset.settling !== undefined,
        unavailable: document.getElementById('threshold-begin')?.getAttribute('aria-disabled') === 'true',
        prompt: Number(getComputedStyle(document.getElementById('threshold-prompt')).opacity),
    }));
    try {
        await page.goto(`${origin}/?debug=1`, { waitUntil: 'load' });
        await page.waitForSelector('#choice-explore', { state: 'visible', timeout: LOAD_TIMEOUT });
        await page.click('#choice-explore');
        await page.waitForFunction(() => document.documentElement.dataset.threshold === 'card', null, { timeout: LOAD_TIMEOUT });
        const cardAt = Date.now();
        await page.waitForTimeout(1500);
        result.early = await state();
        if (!result.early.settling) problems.push('at the card, the way in was not being waited through');
        if (!result.early.unavailable) problems.push('while the Mega-Screen settles, the card\'s button is not marked unavailable');
        if (result.early.prompt > 0.05) problems.push(`while the Mega-Screen settles, its prompt shows (${result.early.prompt})`);
        await page.click('#threshold-begin', { force: true }).catch(() => {});
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        if ((await state()).threshold !== 'card') problems.push('pressed while the Mega-Screen settles, the card began');
        await page.waitForFunction(() => document.documentElement.dataset.settling === undefined, null, { timeout: 45_000 }).catch(() => {});
        result.settledAfter = Date.now() - cardAt;
        // (The prompt fades in: waited for, as anything drawn frame by frame.)
        await page.waitForFunction(() => Number(getComputedStyle(document.getElementById('threshold-prompt')).opacity) > 0.95, null, { timeout: 5000 }).catch(() => {});
        result.settled = { ...(await state()), focus: await page.evaluate(() => document.activeElement?.id ?? null) };
        if (result.settled.settling) problems.push('the Mega-Screen never settled (45 s)');
        if (result.settled.prompt < 0.95) problems.push(`settled, the prompt is at ${result.settled.prompt}`);
        if (result.settled.unavailable) problems.push('settled, the card\'s button is still marked unavailable');
        if (result.settled.focus !== 'threshold-begin') problems.push(`settled, focus is on ${result.settled.focus}, not the card's button`);
        await page.screenshot({ path: path.join(outDir, `${name}-settled.png`) });
        await page.click('#threshold-begin');
        await page.waitForFunction(() => document.documentElement.dataset.threshold === 'flight', null, { timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.mouse.click(300, 300);
        await page.waitForTimeout(1500);
        result.afterSkip = (await state()).threshold;
        if (result.afterSkip !== 'flight') problems.push(`Esc or a click cut the swirl short (${result.afterSkip})`);
        await page.waitForFunction(() => document.documentElement.dataset.threshold === 'done', null, { timeout: 120_000 }).catch(() => {});
        result.passage = await page.evaluate(() => window.elysicesterDebug?.threshold ?? null);
        if (!result.passage || result.passage.skipped) problems.push('the swirl was skipped');
        else if (result.passage.linesShown < 5) problems.push(`the swirl landed after ${result.passage.linesShown} of E's lines`);
    } catch (error) {
        problems.push(`the round broke off: ${error.message.split('\n')[0]}`);
    } finally {
        await session.browser.close();
    }
    return { ...result, problems, ok: problems.length === 0 };
}

/**
 * The texts' sidebar and their faint text, readable (a review of the site, 2 Oct, its R1, R2 and R5): by night and by
 * day, the sidebar on a ground of its own, whole (nothing showing through), its links and the page numbers and notes
 * at 4.5 to 1 or more against what's behind them.
 */
async function textsRound(chromium, pass, outDir, name) {
    const problems = [];
    const themes = {};
    for (const theme of ['night', 'day']) {
        const session = await openPass(chromium, pass);
        await session.context.addInitScript((wanted) => { try { localStorage.setItem('theme', wanted); } catch (error) { /* none */ } }, theme);
        await session.page.goto(`${origin}/read.html`, { waitUntil: 'load' });
        await session.page.evaluate(() => document.body.classList.add('rail-open'));
        await session.page.waitForTimeout(900);
        const measured = await session.page.evaluate(() => {
            const rgb = (text) => (text.match(/[\d.]+/g) ?? []).map(Number);
            const lum = ([r, g, b]) => [r, g, b].map((value) => {
                const c = value / 255;
                return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
            const ratio = (a, b) => {
                const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
                return (x + 0.05) / (y + 0.05);
            };
            // (The ground behind an element: its own, or the nearest ancestor's that isn't see-through; the page's at last.)
            const ground = (element) => {
                for (let at = element; at; at = at.parentElement) {
                    const colour = rgb(getComputedStyle(at).backgroundColor);
                    if (colour.length === 3 || (colour.length === 4 && colour[3] >= 0.99)) return colour.slice(0, 3);
                }
                return rgb(getComputedStyle(document.body).backgroundColor).slice(0, 3);
            };
            const rail = document.getElementById('rail');
            const railGround = rgb(getComputedStyle(rail).backgroundColor);
            const sample = (selector) => {
                const element = document.querySelector(selector);
                if (!element) return null;
                return Number(ratio(rgb(getComputedStyle(element).color).slice(0, 3), ground(element)).toFixed(2));
            };
            return {
                railOpaque: railGround.length === 3 || railGround[3] >= 0.99,
                railLink: sample('.rail-sections a'),
                railTitle: sample('.rail-lost-title'),
                lostMeta: sample('.lost-meta'),
                pageMark: sample('.pg'),
            };
        });
        themes[theme] = measured;
        await session.page.screenshot({ path: path.join(outDir, `${name}-texts-${theme}.png`) });
        if (!measured.railOpaque) problems.push(`${theme}: the sidebar's ground shows what's behind it`);
        for (const [what, value] of Object.entries(measured)) {
            if (what === 'railOpaque') continue;
            if (value === null) problems.push(`${theme}: ${what} wasn't found`);
            else if (value < 4.5) problems.push(`${theme}: ${what} reads at ${value}:1 (under 4.5:1)`);
        }
        await session.browser.close();
    }
    return { themes, problems, ok: problems.length === 0 };
}

const { server, origin } = await serve();

try {
    if (process.argv.includes('--stills')) {
        for (const still of STILLS) {
            const session = await openPass(chromium, PASSES[still.pass]);
            // (The still is the whole island, as a visit that doesn't begin at the jetty's end sees it first; drawn in
            // full on any screen, the phone's still too: nimble=off.)
            await session.page.goto(`${origin}/?${SKIPPABLE}&dock=off&nimble=off`, { waitUntil: 'load' });
            const { mode } = await enter(session.page, session.context, PASSES[still.pass], { begin: 'click', then: 'skip' });
            if (mode !== 'live') throw new Error(`${still.pass}: the scene did not go live (${mode})`);
            await hideChrome(session.page);
            // (Once the arrival's glints have run their course, and before any glints again: hotspots.welcome.)
            await session.page.waitForTimeout(9000);
            const png = await session.page.locator('#stage').screenshot();
            for (const made of still.files) {
                const bytes = Buffer.from(await encodeFrame(session.page, png, made), 'base64');
                await writeFile(path.join(ROOT, made.file), bytes);
                process.stdout.write(`${made.file}: ${bytes.length} bytes\n`);
            }
            await session.browser.close();
        }
    } else {
        const outDir = path.resolve(option('out', path.join(os.tmpdir(), 'elysicester-shots')));
        const only = option('only', Object.keys(PASSES).join(',')).split(',');
        const quick = process.argv.includes('--quick');
        await mkdir(outDir, { recursive: true });
        const report = { origin, readOn: await checkReadOn(), passes: {} };
        const data = JSON.parse(await readFile(path.join(ROOT, 'data', 'fragments.json'), 'utf8'));
        // (As main.js's VOICE_FRAGMENTS: E's lines, which the flight surfaces one by one.)
        const voice = ['nbp-e3-intermaze-1'].map((id) => data.fragments.find((fragment) => fragment.id === id));
        const voiceLines = voice.filter(Boolean).flatMap((fragment, index) => (index === 0 ? fragment.text.split(/\n{2,}/) : [fragment.text]));

        for (const [name, pass] of Object.entries(PASSES).filter(([key]) => only.includes(key))) {
            const { browser, context, page, messages, failures } = await openPass(chromium, pass);
            if (pass.soundOn) {
                // A past visit that chose sound: remembered on this origin before the diorama loads.
                await page.goto(`${origin}/data/places.json`);
                await page.evaluate(() => window.localStorage.setItem('elysicester:sound', JSON.stringify('on')));
            }
            const spoken = [];
            if (pass.extras) page.on('console', (message) => { if (message.type() === 'log') spoken.push(message.text()); });
            // (From the whole city, as these checks were written: the dock start has its own round, dockRound.)
            await page.goto(`${origin}/?${SKIPPABLE}&dock=off${pass.query ? `&${pass.query}` : ''}`, { waitUntil: 'load' });
            const threshold = await enter(page, context, pass, { begin: pass.begin, then: pass.then, shots: path.join(outDir, name), voiceLines });
            const { mode } = threshold;
            const result = { mode, threshold, messages, failures };
            await page.screenshot({ path: path.join(outDir, `${name}.png`) });
            if (pass.sound) result.sound = await soundRound(page, pass, threshold);
            // (The city's own list of what it reads: Allison's bio, a trial, isn't among the data's passages. President
            // Oedipus's flowers open only in their turn, so where the list has them, they're taken in their order.)
            const listed = await page.evaluate(() => {
                const readable = window.elysicesterDebug?.fragments ?? [];
                return [...document.querySelectorAll('#points a')].map((link) => readable.find((fragment) => fragment.id === link.dataset.fragment) ?? { id: link.dataset.fragment });
            });
            const isPart = (fragment) => /^po-part-\d$/.test(fragment.id);
            const inTurn = listed.filter(isPart).sort((a, b) => a.id.localeCompare(b.id));
            const ordered = listed.map((fragment) => (isPart(fragment) ? inTurn.shift() : fragment));

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
                result.reentered = await comeBack(page);
                result.persisted = await page.evaluate(() => ({
                    list: [...document.querySelectorAll('#points a')].filter((link) => link.dataset.read === 'yes').length,
                    total: document.querySelectorAll('#points a').length,
                    points: window.elysicesterDebug?.hotspots?.readIds().length ?? null,
                }));
            }
            await browser.close();
            if (pass.dock) result.dock = await dockRound(chromium, pass, path.join(outDir, name));
            if (pass.creatures) result.creatures = await creaturesRound(chromium, pass, outDir, name);
            if (pass.plants) result.plants = await plantsRound(chromium, pass, outDir, name);
            if (pass.failures) result.fallbacks = await failureRound(chromium, pass, outDir, name);
            if (pass.texts) result.texts = await textsRound(chromium, pass, outDir, name);
            if (pass.settle) result.settle = await settleRound(chromium, pass, outDir, name);
            report.passes[name] = result;
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
            const back = result.reentered ? (result.reentered.ok ? 'reload lands in the city' : 'RELOAD NOT OK') : '';
            const passage = result.threshold.passage;
            const crossing = `threshold ${result.threshold.sequence}${passage?.frames ? ` (${passage.frames} frames, ${passage.linesShown} lines${passage.skipped ? `, skipped, landed ${result.threshold.skipToLanded} ms after skip` : ''}${result.threshold.landedBeforeSkip ? ', landed before the skip' : ''})` : ''} ${result.threshold.ok ? 'ok' : 'NOT OK'}`;
            const sound = result.sound ? `sound ${result.sound.ok ? 'ok' : 'NOT OK'}` : '';
            const navSerious = (result.signs?.navViolations ?? []).filter((violation) => SERIOUS.has(violation.impact)).length;
            const slowSigns = result.signs?.results.reduce((sum, entry) => sum + (entry.slowPresses ?? 0), 0) ?? 0;
            const signs = result.signs
                ? `signs ${summarise(result.signs.results)}${slowSigns ? ` (${slowSigns} tap${slowSigns === 1 ? '' : 's'} too slow under SwiftShader, tapped again)` : ''}${result.signs.coverage ? `, glyphs ${result.signs.glyphProblems.length ? 'MISSING' : 'all held'}` : ''}${result.signs.navScanned ? `, list axe serious ${navSerious}` : ''}`
                : '';
            const extras = result.extras ? `extras ${result.extras.ok ? 'sky, shadow, door, voice and hums all there' : 'NOT OK'}` : '';
            const camera = result.camera ? `camera ${result.camera.ok ? `kept clear (closest ${Math.min(...result.camera.rows.map((row) => row.closest))})` : 'WENT INTO SOMETHING'}` : '';
            const dock = result.dock ? `dock ${result.dock.ok ? 'arrives perched on the Cyclolite by the signs, again on reload; zoom out, zoom out, leave to the choice and back; the hum recentres' : 'NOT OK'}` : '';
            const givers = result.creatures
                ? `givers ${result.creatures.ok ? `${result.creatures.city.pugs} pugs, ${result.creatures.city.hums} hums, Allison; squur, chirp, his line, the bio; ${result.creatures.inventory.items} lost pages${result.creatures.whole?.whole ? `, one read whole (${result.creatures.whole.letters} letters)` : ''}; won, written by hand (${result.creatures.written?.strokes ?? 0} strokes)` : 'NOT OK'}`
                : '';
            const plants = result.plants
                ? `flowers ${result.plants.ok ? 'a bud refused (the bloom named), five parts whole in their turn, each wilting as the next blooms' : 'NOT OK'}`
                : '';
            const failing = result.fallbacks ? `when things fail ${result.fallbacks.ok ? 'a module blocked, the still and its line, Read reads; a data file failing, no empty list; slow code, Explore taken up' : 'NOT OK'}` : '';
            const texts = result.texts ? `texts ${result.texts.ok ? `sidebar whole; links and faint text ${['night', 'day'].map((theme) => `${theme} ${Math.min(...['railLink', 'railTitle', 'lostMeta', 'pageMark'].map((what) => result.texts.themes[theme][what]))}:1`).join(', ')} at least` : 'NOT OK'}` : '';
            const waited = result.settle ? `waited through ${result.settle.ok ? `the card took no early press, its prompt came as the Mega-Screen stood (${Math.round(result.settle.settledAfter / 100) / 10} s), the swirl took no Esc or click and played all ${result.settle.passage?.linesShown} lines` : 'NOT OK'}` : '';
            process.stdout.write(`${name.padEnd(8)} ${result.mode.padEnd(6)} ${problems === 0 ? 'clean' : `${problems} problem(s)`}  ${[crossing, sound, info, orbit, still, camera, signs, extras, pointer, keys, axe, back, kept, dock, givers, plants, failing, texts, waited].filter(Boolean).join(' · ')}\n`);
            for (const line of result.settle?.problems ?? []) process.stdout.write(`    waited through not ok: ${line}\n`);
            for (const line of [...result.messages, ...result.failures]) process.stdout.write(`    ${line}\n`);
            for (const line of result.dock?.problems ?? []) process.stdout.write(`    dock not ok: ${line}\n`);
            for (const line of result.creatures?.problems ?? []) process.stdout.write(`    givers not ok: ${line}\n`);
            for (const line of result.plants?.problems ?? []) process.stdout.write(`    flowers not ok: ${line}\n`);
            for (const line of result.fallbacks?.problems ?? []) process.stdout.write(`    failures not ok: ${line}\n`);
            for (const line of result.texts?.problems ?? []) process.stdout.write(`    texts not ok: ${line}\n`);
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
