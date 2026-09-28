/**
 * Elysicester — boot: capability check → threshold → stage.
 *
 * Tier 1 of the Elysicester diorama (a floating piece of the golden city from
 * Numbers by Paint). This file only decides what the visitor's browser can
 * carry and hands over to the modules that draw it.
 */

// =============================================================================
// Imports
// =============================================================================

import { REVISION } from 'three';

// =============================================================================
// Main Code
// =============================================================================

/** True when the browser can give us a WebGL context at all. */
function hasWebGL() {
    try {
        const probe = document.createElement('canvas');
        return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
    } catch {
        return false;
    }
}

const root = document.documentElement;
root.dataset.three = REVISION;
root.dataset.webgl = hasWebGL() ? 'yes' : 'no';
