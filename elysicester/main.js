/**
 * Elysicester — boot: capability check → threshold → stage.
 *
 * Tier 1 of the Elysicester diorama: a floating piece of the golden city from
 * Numbers by Paint, orbited at Elysium's endless dusk, with reading points
 * where each passage belongs.
 *
 * The Mega-Screen's card shows at once. Behind it, straight away, the city is
 * built (with WebGL 2) or the still is readied (without). The first tap or
 * keypress begins: sound starts if the visitor has chosen it, then the
 * Intermaze flies until the city is ready and a minimum passage has played
 * (under reduced motion, the card crossfades instead), and the city lifts out
 * of a dark veil. Coming back within the same visit (Back, a reload) skips
 * the card and the flight: the city lifts from the dark as soon as it's ready.
 * On trial (dock, trials.js), the visitor arrives as the shadow, walking, at
 * the end of the jetty; "the whole city" (or ?dock=off) is the view from far.
 * If anything fails, the city arrives as a still and its points as a list;
 * the reader works either way, and each passage leads on to the nearest place
 * not yet read. The optional extras (extras.js) appear only when the address
 * asks for them.
 */

// =============================================================================
// Imports
// =============================================================================

import { createAudio } from './modules/audio.js';
import { speak, wantedExtras } from './modules/extras.js';
import { createHotspots, createPointList } from './modules/hotspots.js';
import { createNames } from './modules/names.js';
import { WORKS, createReader } from './modules/reader.js';
import { createSignList, createSignOverlay } from './modules/signs.js';
import { createRenderer, createStage, fitRenderer } from './modules/stage.js';
import { crossedThisVisit, markRead, readFragments, rememberCrossed, rememberSound, soundWanted } from './modules/state.js';
import { createThreshold } from './modules/threshold.js';
import { createTouch } from './modules/touch.js';
import { trialOn } from './modules/trials.js';
import { createWhisper } from './modules/whisper.js';

// =============================================================================
// Constants
// =============================================================================

const PROMPT_FRAGMENT = 'nbp-e1-mega-screen-1';
/** E's lines in the Intermaze (Elm, 1 Oct, cut "They?" and the rail, so they end on "You never remember the dreams."). */
const VOICE_FRAGMENTS = ['nbp-e3-intermaze-1'];
/** Where "Stay - Read" and the one option's "back" go: the city's text, plainly (Elm: "back can take you to the text interface"). */
const TEXT_PAGE = 'plainly.html';

/** Walking as the shadow, a reading point within this of its head names its place. */
const NEAR_POINT = 3.2;

/** A touched thing answers (its ring, its sound), and this long after, its words open (ms). */
const TOUCH_PAUSE = 450;

/** The hint (a trial, trials.js): once no more than this many passages are left unread, the count says where. */
const HINT_FEW = 3;
/** And their points glint this often (seconds; else hotspots.js's own pace). */
const HINT_GLINT = 3.5;

// =============================================================================
// Main Code
// =============================================================================

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const debug = params.has('debug');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The optional extras (extras.js): none, unless the address asks, as ?extras=sky,shadow,door,voice. */
const extras = wantedExtras();
const byId = (id) => document.getElementById(id);
if (debug) window.elysicesterDebug = {};

/** three.js r163 and later draw with WebGL 2 only. */
function hasWebGL2() {
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

async function loadData(name) {
    const response = await fetch(new URL(`./data/${name}.json`, import.meta.url));
    if (!response.ok) throw new Error(`data/${name}.json answered ${response.status}`);
    return response.json();
}

/** Hold the city still: the drawn plate instead of the live scene, the points as a list. */
function showStill() {
    root.dataset.mode = 'still';
    const fallback = byId('fallback');
    fallback.querySelector('.fallback-note').append(byId('points'));
    fallback.hidden = false;
    // With no camera to turn, a sign in the list is simply its words.
    for (const button of byId('signs-list').querySelectorAll('button')) {
        const words = document.createElement('span');
        words.className = button.className;
        words.dataset.sign = button.dataset.sign;
        words.append(...button.childNodes);
        button.replaceWith(words);
    }
}

/** The sound switch: off unless chosen; the choice is remembered. It says what the sound is now ("sound: off"). */
function wireSound(audio) {
    const toggle = byId('sound-toggle');
    const show = (on) => {
        toggle.setAttribute('aria-pressed', String(on));
        toggle.textContent = on ? 'sound: on' : 'sound: off';
    };
    show(soundWanted());
    toggle.addEventListener('click', () => {
        const on = !soundWanted();
        rememberSound(on);
        show(on);
        if (on) audio.start();
        else audio.stop();
    });
}

/** Fill the Mega-Screen's prompt from its fragment, keeping its italics (else it stays "enter"). */
function fillPrompt(fragment) {
    const prompt = byId('threshold-prompt');
    prompt.classList.add('is-ready');
    if (!fragment) return;
    prompt.replaceChildren();
    let rest = fragment.text;
    for (const run of fragment.italic ?? []) {
        const at = rest.indexOf(run);
        if (at < 0) continue;
        prompt.append(rest.slice(0, at));
        const emphasis = document.createElement('em');
        emphasis.textContent = run;
        prompt.append(emphasis);
        rest = rest.slice(at + run.length);
    }
    prompt.append(rest);
}

/**
 * Out of the Intermaze, the choice (a trial, trials.js; Elm: "a screen that offers 'Explore - Win' on one side and
 * 'Stay - Read' on the other. Right as we come out of the ascii portal"). "Stay - Read" is a link, to the city's text;
 * this resolves once the visitor chooses to explore (their tap may start the sound, if it's wanted and isn't on yet).
 */
function choose({ audio }) {
    const choice = byId('choice');
    const explore = byId('choice-explore');
    byId('veil').classList.add('is-dark');
    choice.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => choice.classList.add('is-shown')));
    explore.focus({ preventScroll: true });
    return new Promise((resolve) => {
        explore.addEventListener('click', () => {
            if (soundWanted() && audio.state !== 'running') audio.start();
            choice.classList.remove('is-shown');
            root.dataset.threshold = 'done';
            window.setTimeout(() => {
                choice.hidden = true;
            }, reducedMotion ? 0 : 900);
            resolve();
        }, { once: true });
    });
}

/**
 * One option at the top of the screen (a trial, trials.js; Elm: "there can just be one option at the top of the
 * screen: zoom out, zoom out, back. And back can take you to the text interface anyway"). Flying close, it draws the
 * camera back as far as it follows; flying drawn back, it lets the hum hover where it is and goes out to the whole
 * city (looking about, it goes there too); at the whole city, "back" goes to the city's text. Taking the hum again
 * (a tap on it) brings the camera back in close, and the round begins again.
 */
function wireOneButton(stage) {
    const one = byId('one-button');
    one.hidden = false;
    const step = () => {
        const walk = stage.walk;
        if (walk?.state.walking) return walk.followDistance < walk.followFar - 0.05 ? 'closer' : 'far';
        return stage.rig.atHome ? 'home' : 'away';
    };
    stage.onFrame(() => {
        const words = step() === 'home' ? 'back' : 'zoom out';
        if (one.textContent !== words) one.textContent = words;
    });
    one.addEventListener('click', () => {
        const now = step();
        if (now === 'closer') {
            stage.walk.zoomTo(stage.walk.followFar);
        } else if (now === 'far') {
            stage.walk.letGo();
            stage.rig.toHome();
        } else if (now === 'away') {
            stage.rig.toHome();
        } else {
            window.location.href = TEXT_PAGE;
        }
    });
    return one;
}

/** Let the city lift out of the dark after the flight, whichever city it is. */
function liftVeil(arrive) {
    const veil = byId('veil');
    veil.classList.add('is-dark');
    arrive();
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-dark')));
}

async function boot() {
    const audio = createAudio();
    // With one option at the top of the screen (a trial), the rest stands aside (style.css), and the sound switch
    // keeps a quiet corner of its own.
    const oneButton = trialOn('onebutton');
    if (oneButton) {
        root.dataset.onebutton = '';
        const toggle = byId('sound-toggle');
        toggle.classList.add('sound-corner');
        document.body.append(toggle);
    }
    wireSound(audio);
    if (debug) window.elysicesterDebug.audio = audio;
    const returning = crossedThisVisit();
    // Out of the Intermaze, a choice (a trial): not when coming back within the visit, nor for an address that came to
    // read a passage (#read-…), which goes straight to it.
    const choosing = trialOn('choice') && !returning && !window.location.hash.startsWith('#read-');
    const threshold = createThreshold({
        root,
        card: byId('threshold'),
        begin: byId('threshold-begin'),
        voice: byId('threshold-voice'),
        onBegin: () => {
            if (debug) window.elysicesterDebug.begunAt = performance.now();
            if (soundWanted()) audio.start();
        },
        returning,
        choosing,
    });
    // Until the city is entered, its reading points wait behind the card.
    const pointsNav = byId('points');
    pointsNav.inert = true;
    if (returning) {
        // Back within the same visit: no card, only the dark the city will lift out of (held by the veil
        // now, rather than by the page's first paint). Sound, if chosen, starts at the visitor's first touch
        // (browsers ask for one).
        byId('veil').classList.add('is-dark');
        delete root.dataset.returning;
        if (soundWanted()) {
            const wake = () => {
                window.removeEventListener('pointerdown', wake, true);
                window.removeEventListener('keydown', wake, true);
                if (soundWanted()) audio.start();
            };
            window.addEventListener('pointerdown', wake, true);
            window.addEventListener('keydown', wake, true);
        }
    }

    const [placeData, fragmentData, paper, signData] = await Promise.all([
        loadData('places'), loadData('fragments'), loadData('paper'), loadData('signs'),
    ]);
    const places = new Map(placeData.places.map((place) => [place.id, place]));
    const fragmentById = new Map(fragmentData.fragments.map((fragment) => [fragment.id, fragment]));
    // (A passage on trial, trials.js, is read only while its trial is on.)
    const readable = fragmentData.fragments.filter((fragment) => places.get(fragment.place)?.tier === 1
        && (!fragment.trial || trialOn(fragment.trial)));
    const lines = VOICE_FRAGMENTS.map((id) => fragmentById.get(id)).filter(Boolean).flatMap((fragment, index) => (
        index === 0 ? fragment.text.split(/\n{2,}/) : [fragment.text]
    ));
    // E's own lines, of those (the first passage's), are the ones a long stillness whispers again (whisper.js).
    const whispered = fragmentById.get(VOICE_FRAGMENTS[0])?.text.split(/\n{2,}/) ?? [];
    fillPrompt(fragmentById.get(PROMPT_FRAGMENT));

    const read = readFragments();
    const hinting = trialOn('hint');
    const unreadCount = () => readable.filter((fragment) => !read.has(fragment.id)).length;
    let stage = null;
    let hotspots = null;
    let signOverlay = null;

    // The thread on from a passage: the nearest place none of whose passages has been read yet; failing
    // that, the nearest unread passage at another place, then here; once every one has been read, simply the
    // nearest other place. It never ends, and nothing leads off first (Elm: nothing definite yet, no opening
    // or closing).
    const whereIs = (fragment) => {
        const point = hotspots?.positionOf(fragment.id);
        return point ? [point.x, point.y, point.z] : places.get(fragment.place).position;
    };
    const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const onward = (fragment) => {
        const from = whereIs(fragment);
        const others = readable.filter((candidate) => candidate.id !== fragment.id);
        const unread = others.filter((candidate) => !read.has(candidate.id));
        const visited = new Set(readable.filter((candidate) => read.has(candidate.id)).map((candidate) => candidate.place));
        const pools = [
            unread.filter((candidate) => !visited.has(candidate.place)),
            unread.filter((candidate) => candidate.place !== fragment.place),
            unread,
            others.filter((candidate) => candidate.place !== fragment.place),
        ];
        const pool = pools.find((candidates) => candidates.length) ?? [];
        let next = null;
        for (const candidate of pool) {
            if (!next || apart(from, whereIs(candidate)) < apart(from, whereIs(next))) next = candidate;
        }
        // (A place read at before is gone "back to", so a thread that comes round again says so.)
        const returning = Boolean(next) && next.place !== fragment.place && visited.has(next.place);
        // (The hint, on trial: the last few left unread, and where they are.)
        const left = readable.filter((candidate) => !read.has(candidate.id));
        const lastAt = hinting && left.length > 0 && left.length <= HINT_FEW ? [...new Set(left.map((candidate) => candidate.place))] : null;
        return { next, returning, read: readable.length - left.length, total: readable.length, lastAt };
    };
    let open = null;
    const reader = createReader({
        dialog: byId('reader'),
        places,
        // (Walking, the camera is the shadow's: it doesn't drift off when a passage closes.)
        onClose: () => {
            if (!stage?.walk?.state.walking) stage?.rig.setDrifting(true);
        },
        onward,
        onOnward: (next) => open(next, undefined),
        // "walk from here": the shadow set down at the passage's place (the nearest floor to its point), and taken.
        canWalk: () => Boolean(stage?.walk),
        onWalkFrom: (fragment) => {
            const point = hotspots?.positionOf(fragment.id);
            const [x, , z] = point ? [point.x, point.y, point.z] : places.get(fragment.place).position;
            stage?.walk?.walkFrom(x, z);
        },
    });
    // (Flying as a hum, a trial: it flies from there.)
    if (trialOn('hum')) document.querySelector('[data-reader-walk]')?.replaceChildren('fly from here');
    createSignList({
        list: byId('signs-list'),
        signs: signData.signs,
        places,
        onFocusSign: (sign) => {
            if (sign) {
                hotspots?.light(null);
                stage?.walk?.letGo();
            }
            signOverlay?.focusSign(sign);
        },
    });

    const focusFragment = (fragment) => {
        if (!stage) return;
        stage.rig.focus(fragment.place, hotspots?.positionOf(fragment.id), fragment.facing ?? null);
    };
    let list = null;
    open = (fragment, opener) => {
        read.add(fragment.id);
        markRead(fragment.id);
        list.markRead(fragment.id);
        hotspots?.markRead(fragment.id);
        signOverlay?.hide();
        if (stage) {
            stage.rig.setDrifting(false);
            focusFragment(fragment);
        }
        reader.open(fragment, opener);
    };
    list = createPointList({
        nav: byId('points'),
        fragments: readable,
        places,
        read,
        onOpen: open,
        onFocusPoint: (fragment) => {
            hotspots?.light(fragment);
            if (!fragment) return;
            // (Looking about by the list, the camera is the list's: the shadow is let go, and stays where it stands.)
            stage?.walk?.letGo();
            focusFragment(fragment);
        },
    });

    // Build the city now, behind the card, while the visitor reads the Mega-Screen.
    const canvas = byId('stage');
    let renderer = null;
    let building;
    if (hasWebGL2()) {
        renderer = createRenderer(canvas);
        building = createStage({ renderer, canvas, data: { places: placeData, paper, signs: signData }, reducedMotion, debug, onLost: showStill, extras })
            .then((built) => {
                stage = built;
                let touch = null;
                hotspots = createHotspots({
                    stage,
                    fragments: readable,
                    read,
                    places,
                    label: byId('point-label'),
                    reducedMotion,
                    // (The hint, on trial: the last few unread glint more often.)
                    glintEvery: () => (hinting && unreadCount() <= HINT_FEW ? HINT_GLINT : null),
                    onPick: (fragment) => open(fragment, null),
                    // A tap on the shadow is the shadow's (walk.js); one squarely on a sign is the sign's.
                    yieldTap: (x, y, pointDistance) => (stage.walk?.claimsTap(x, y) ?? false)
                        || (signOverlay?.claimsTap(x, y, pointDistance) ?? false),
                    // A tap no point took may have found something else that answers (touch.js): a ring where
                    // it was touched, its own sound, then its words. Walking as the shadow, a tap nothing
                    // answers walks it there.
                    onMiss: (x, y) => {
                        if (!touch || stage.walk?.claimsTap(x, y) || signOverlay?.claimsTap(x, y, Infinity)) return;
                        const found = touch.find(x, y);
                        const fragment = found ? readable.find((candidate) => candidate.id === found.fragment) : null;
                        if (!fragment) {
                            stage.walk?.walkToward(x, y);
                            return;
                        }
                        if (!reducedMotion) hotspots.ripple(found.point);
                        audio.answer(found.kind);
                        window.setTimeout(() => open(fragment, null), TOUCH_PAUSE);
                    },
                });
                touch = createTouch({ stage, occluders: hotspots.occluders });
                // The shadow hears a tap first; a reading point nearer the tap than the shadow keeps it, and so
                // does a sign the tap lands squarely on.
                stage.walk?.yieldsTo((x, y, pointerType) => (signOverlay?.claimsTap(x, y, Infinity)
                    ? 0
                    : hotspots.nearestDistance(x, y, pointerType)));
                signOverlay = createSignOverlay({
                    stage,
                    label: byId('sign-label'),
                    isBusy: () => !byId('point-label').hidden || byId('reader').open,
                });
                if (debug) window.elysicesterDebug.readyAt = performance.now();
                return stage;
            });
    } else {
        showStill();
        building = Promise.resolve(null);
    }

    await threshold.begun;
    const built = building.catch((error) => {
        console.error('Elysicester could not be drawn live:', error);
        return null;
    });
    // A passage asked for by the address (#read-…) opens once the city has arrived.
    const wanted = window.location.hash.startsWith('#read-')
        ? readable.find((fragment) => `#read-${fragment.id}` === window.location.hash)
        : null;
    // Arrive: the live city if it was built, else the still (unless it's already showing). On trial (dock,
    // trials.js), the visit begins as the shadow, walking, at the end of the jetty (unless it came to read).
    const arrive = () => {
        if (stage) {
            if (trialOn('dock') && !wanted) stage.walk?.arrive();
            stage.start();
            root.dataset.mode = 'live';
        } else if (root.dataset.mode !== 'still') {
            showStill();
        }
    };
    let passage;
    if (returning) {
        passage = await threshold.comeBack({ ready: built });
        liftVeil(arrive);
    } else if (renderer && !reducedMotion) {
        passage = await threshold.fly({ renderer, ready: built, lines, fit: () => fitRenderer(renderer, canvas) });
        if (choosing) {
            // (Crossed: a visitor who stays to read and comes back to the city comes straight in.)
            rememberCrossed();
            await choose({ audio });
        }
        liftVeil(arrive);
    } else if (choosing) {
        passage = await threshold.crossfade({ ready: built });
        rememberCrossed();
        await choose({ audio });
        // (The choice darkened the veil behind it: the city lifts out of that dark, as after a flight.)
        liftVeil(arrive);
    } else {
        passage = await threshold.crossfade({ ready: built.then(arrive) });
    }
    rememberCrossed();
    hotspots?.welcome();
    if (debug) window.elysicesterDebug.threshold = passage;
    pointsNav.inert = false;
    if (extras.has('voice')) speak(readable.filter((fragment) => fragment.status === 'approved'), WORKS);

    // The trials (trials.js): a whisper after a long stillness, taken up where the flight's lines left off;
    // and the places' faint names from far out.
    if (stage && trialOn('whisper')) {
        const whisper = createWhisper({
            element: byId('whisper'),
            lines: whispered,
            from: (passage?.linesShown ?? 0) < whispered.length ? passage?.linesShown ?? 0 : 0,
            isBusy: () => reader.isOpen,
            onFrame: (listener) => stage.onFrame(listener),
        });
        if (debug) window.elysicesterDebug.whisper = whisper;
    }
    if (stage && trialOn('names')) {
        const pointLabel = byId('point-label');
        const names = createNames({
            container: byId('place-names'),
            stage,
            places,
            fragments: readable,
            read,
            hint: hinting,
            litPlace: () => (pointLabel.hidden ? null : readable.find((fragment) => fragment.id === pointLabel.dataset.fragment)?.place ?? null),
        });
        if (debug) window.elysicesterDebug.names = names;
    }

    if (stage) {
        if (oneButton) wireOneButton(stage);
        const home = byId('home-view');
        home.addEventListener('click', () => {
            stage.walk?.letGo();
            stage.rig.toHome();
        });
        stage.onFrame(() => {
            const away = !stage.rig.atHome;
            if (home.hidden === away) home.hidden = !away;
        });

        // Walking as the shadow, a reading point close by names its place (a tap on it reads it, as ever).
        if (stage.walk && hotspots) {
            let near = null;
            stage.onFrame(() => {
                const walker = stage.walk.state;
                let found = null;
                if (walker.walking) {
                    let best = NEAR_POINT;
                    for (const fragment of readable) {
                        const point = hotspots.positionOf(fragment.id);
                        if (!point) continue;
                        const head = walker.position.y + 1.2;
                        const away = Math.hypot(point.x - walker.position.x, point.y - head, point.z - walker.position.z);
                        if (away < best) {
                            best = away;
                            found = fragment;
                        }
                    }
                }
                if (found !== near) {
                    near = found;
                    hotspots.light(found, { pin: true });
                    // (The banshee, on trial, turns its hood to the passage it's beside.)
                    stage.walk.attend?.(found ? hotspots.positionOf(found.id) : null);
                }
            });
            // Its name, while the shadow stands beside it, is a way in too: a click reads it (the list is the
            // way for keys, as ever).
            const pointLabel = byId('point-label');
            pointLabel.addEventListener('click', () => {
                if (!pointLabel.classList.contains('is-near')) return;
                const fragment = readable.find((candidate) => candidate.id === pointLabel.dataset.fragment);
                if (fragment) open(fragment, null);
            });
            // (And a thumb set down on it to steer, as a phone's thumb is, low on the screen, steers: walk.js.)
            stage.walk.steersFrom(pointLabel);
        }
    }
    // If the card or the choice held focus (they've gone now), land it on the city's name.
    const focused = document.activeElement;
    if (!focused || focused === document.body || byId('threshold').contains(focused) || byId('choice').contains(focused)) {
        byId('diorama-title').focus({ preventScroll: true });
    }

    if (debug) {
        Object.assign(window.elysicesterDebug, {
            hotspots,
            signs: signOverlay,
            signCoverage: stage?.signs.coverage ?? null,
            reader,
            fragments: readable,
            focusFragment: (id) => focusFragment(readable.find((fragment) => fragment.id === id)),
        });
    }

    if (wanted) open(wanted, list.linkFor(wanted.id));
}

boot().catch((error) => {
    showStill();
    byId('threshold').hidden = true;
    byId('points').inert = false;
    root.dataset.threshold = 'done';
    console.error('Elysicester could not begin:', error);
});
