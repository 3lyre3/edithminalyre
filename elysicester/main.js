/**
 * Elysicester — boot: capability check → threshold → stage.
 *
 * Tier 1 of the Elysicester diorama: a floating piece of the golden city from
 * Numbers by Paint, orbited at Elysium's endless dusk, with reading points
 * where each passage belongs. This file decides what the visitor's browser can
 * carry. With WebGL 2 it builds the stage and its points; without, or if
 * anything fails, the city arrives as a still and the points as a list. The
 * reader and the list work either way.
 */

// =============================================================================
// Imports
// =============================================================================

import { createHotspots, createPointList } from './modules/hotspots.js';
import { createReader } from './modules/reader.js';
import { createStage } from './modules/stage.js';
import { markRead, readFragments } from './modules/state.js';

// =============================================================================
// Main Code
// =============================================================================

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const debug = params.has('debug');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const fallback = document.getElementById('fallback');
    fallback.querySelector('.fallback-note').append(document.getElementById('points'));
    fallback.hidden = false;
}

async function boot() {
    const [placeData, fragmentData, paper] = await Promise.all([loadData('places'), loadData('fragments'), loadData('paper')]);
    const places = new Map(placeData.places.map((place) => [place.id, place]));
    const readable = fragmentData.fragments.filter((fragment) => places.get(fragment.place)?.tier === 1);
    const read = readFragments();
    let stage = null;
    let hotspots = null;

    const reader = createReader({
        dialog: document.getElementById('reader'),
        places,
        onClose: () => stage?.rig.setDrifting(true),
    });

    /** Ease the camera toward a fragment's own point, from its side if it has one. */
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
        if (stage) {
            stage.rig.setDrifting(false);
            focusFragment(fragment);
        }
        reader.open(fragment, opener);
    };
    list = createPointList({
        nav: document.getElementById('points'),
        fragments: readable,
        places,
        read,
        onOpen: open,
        onFocusPoint: (fragment) => {
            hotspots?.light(fragment);
            if (fragment) focusFragment(fragment);
        },
    });

    const wanted = window.location.hash.startsWith('#read-')
        ? readable.find((fragment) => `#read-${fragment.id}` === window.location.hash)
        : null;

    if (!hasWebGL2()) {
        showStill();
        if (wanted) open(wanted, list.linkFor(wanted.id));
        return;
    }

    const canvas = document.getElementById('stage');
    stage = await createStage({ canvas, data: { places: placeData, paper }, reducedMotion, debug, onLost: showStill });
    hotspots = createHotspots({
        stage,
        fragments: readable,
        read,
        places,
        label: document.getElementById('point-label'),
        reducedMotion,
        onPick: (fragment) => open(fragment, null),
    });

    const home = document.getElementById('home-view');
    home.addEventListener('click', () => stage.rig.toHome());
    stage.onFrame(() => {
        const away = !stage.rig.atHome;
        if (home.hidden === away) home.hidden = !away;
    });

    if (debug) {
        Object.assign(window.elysicesterDebug, {
            hotspots,
            reader,
            fragments: readable,
            focusFragment: (id) => focusFragment(readable.find((fragment) => fragment.id === id)),
        });
    }
    root.dataset.mode = 'live';
    stage.start();
    if (wanted) open(wanted, list.linkFor(wanted.id));
}

boot().catch((error) => {
    showStill();
    console.error('Elysicester could not be drawn live:', error);
});
