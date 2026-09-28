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
 * of a dark veil. If anything fails, the city arrives as a still and its
 * points as a list; the reader works either way.
 */

// =============================================================================
// Imports
// =============================================================================

import { createAudio } from './modules/audio.js';
import { createHotspots, createPointList } from './modules/hotspots.js';
import { createReader } from './modules/reader.js';
import { createSignList, createSignOverlay } from './modules/signs.js';
import { createRenderer, createStage, fitRenderer } from './modules/stage.js';
import { markRead, readFragments, rememberSound, soundWanted } from './modules/state.js';
import { createThreshold } from './modules/threshold.js';

// =============================================================================
// Constants
// =============================================================================

const PROMPT_FRAGMENT = 'nbp-e1-mega-screen-1';
const VOICE_FRAGMENTS = ['nbp-e3-intermaze-1', 'nbp-e3-intermaze-2'];

// =============================================================================
// Main Code
// =============================================================================

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const debug = params.has('debug');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/** The sound switch: off unless chosen; the choice is remembered. */
function wireSound(audio) {
    const toggle = byId('sound-toggle');
    const show = (on) => {
        toggle.setAttribute('aria-pressed', String(on));
        toggle.textContent = on ? 'sound on' : 'sound off';
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

/** Let the city lift out of the dark after the flight, whichever city it is. */
function liftVeil(arrive) {
    const veil = byId('veil');
    veil.classList.add('is-dark');
    arrive();
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-dark')));
}

async function boot() {
    const audio = createAudio();
    wireSound(audio);
    if (debug) window.elysicesterDebug.audio = audio;
    const threshold = createThreshold({
        root,
        card: byId('threshold'),
        begin: byId('threshold-begin'),
        voice: byId('threshold-voice'),
        onBegin: () => {
            if (debug) window.elysicesterDebug.begunAt = performance.now();
            if (soundWanted()) audio.start();
        },
    });
    // Until the city is entered, its reading points wait behind the card.
    const pointsNav = byId('points');
    pointsNav.inert = true;

    const [placeData, fragmentData, paper, signData] = await Promise.all([
        loadData('places'), loadData('fragments'), loadData('paper'), loadData('signs'),
    ]);
    const places = new Map(placeData.places.map((place) => [place.id, place]));
    const fragmentById = new Map(fragmentData.fragments.map((fragment) => [fragment.id, fragment]));
    const readable = fragmentData.fragments.filter((fragment) => places.get(fragment.place)?.tier === 1);
    const lines = VOICE_FRAGMENTS.map((id) => fragmentById.get(id)).filter(Boolean).flatMap((fragment, index) => (
        index === 0 ? fragment.text.split(/\n{2,}/) : [fragment.text]
    ));
    fillPrompt(fragmentById.get(PROMPT_FRAGMENT));

    const read = readFragments();
    let stage = null;
    let hotspots = null;
    let signOverlay = null;
    const reader = createReader({ dialog: byId('reader'), places, onClose: () => stage?.rig.setDrifting(true) });
    createSignList({
        list: byId('signs-list'),
        signs: signData.signs,
        places,
        onFocusSign: (sign) => {
            if (sign) hotspots?.light(null);
            signOverlay?.focusSign(sign);
        },
    });

    const focusFragment = (fragment) => {
        if (!stage) return;
        stage.rig.focus(fragment.place, hotspots?.positionOf(fragment.id), fragment.facing ?? null);
    };
    let list = null;
    const open = (fragment, opener) => {
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
            if (fragment) focusFragment(fragment);
        },
    });

    // Build the city now, behind the card, while the visitor reads the Mega-Screen.
    const canvas = byId('stage');
    let renderer = null;
    let building;
    if (hasWebGL2()) {
        renderer = createRenderer(canvas);
        building = createStage({ renderer, canvas, data: { places: placeData, paper, signs: signData }, reducedMotion, debug, onLost: showStill })
            .then((built) => {
                stage = built;
                hotspots = createHotspots({
                    stage,
                    fragments: readable,
                    read,
                    places,
                    label: byId('point-label'),
                    reducedMotion,
                    onPick: (fragment) => open(fragment, null),
                    yieldTap: (x, y, pointDistance) => signOverlay?.claimsTap(x, y, pointDistance) ?? false,
                });
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
    // Arrive: the live city if it was built, else the still (unless it's already showing).
    const arrive = () => {
        if (stage) {
            stage.start();
            root.dataset.mode = 'live';
        } else if (root.dataset.mode !== 'still') {
            showStill();
        }
    };
    let passage;
    if (renderer && !reducedMotion) {
        passage = await threshold.fly({ renderer, ready: built, lines, fit: () => fitRenderer(renderer, canvas) });
        liftVeil(arrive);
    } else {
        passage = await threshold.crossfade({ ready: built.then(arrive) });
    }
    if (debug) window.elysicesterDebug.threshold = passage;
    pointsNav.inert = false;

    if (stage) {
        const home = byId('home-view');
        home.addEventListener('click', () => stage.rig.toHome());
        stage.onFrame(() => {
            const away = !stage.rig.atHome;
            if (home.hidden === away) home.hidden = !away;
        });
    }
    // If the card held focus (it has gone now), land it on the city's name.
    const focused = document.activeElement;
    if (!focused || focused === document.body || byId('threshold').contains(focused)) {
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

    const wanted = window.location.hash.startsWith('#read-')
        ? readable.find((fragment) => `#read-${fragment.id}` === window.location.hash)
        : null;
    if (wanted) open(wanted, list.linkFor(wanted.id));
}

boot().catch((error) => {
    showStill();
    byId('threshold').hidden = true;
    byId('points').inert = false;
    root.dataset.threshold = 'done';
    console.error('Elysicester could not begin:', error);
});
