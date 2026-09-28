/**
 * Elysicester — boot: capability check → threshold → stage.
 *
 * Tier 1 of the Elysicester diorama: a floating piece of the golden city from
 * Numbers by Paint, orbited at Elysium's endless dusk. This file decides what
 * the visitor's browser can carry. With WebGL 2 it builds the stage and
 * starts it; without, or if anything fails, the city arrives as a still.
 */

// =============================================================================
// Imports
// =============================================================================

import { createStage } from './modules/stage.js';

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

/** Hold the city still: the drawn plate instead of the live scene. */
function showStill() {
    root.dataset.mode = 'still';
    document.getElementById('fallback').hidden = false;
}

async function boot() {
    if (!hasWebGL2()) {
        showStill();
        return;
    }
    const canvas = document.getElementById('stage');
    const [places, paper] = await Promise.all([loadData('places'), loadData('paper')]);
    const stage = await createStage({ canvas, data: { places, paper }, reducedMotion, debug, onLost: showStill });
    root.dataset.mode = 'live';
    stage.start();
}

boot().catch((error) => {
    showStill();
    console.error('Elysicester could not be drawn live:', error);
});
