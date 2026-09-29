/**
 * touch.js — what else a tap may find in the city.
 *
 * A first-time visitor tapped the Steel Garden's sycamore, a statue and the
 * rock's underside, and nothing answered; Elm asked that such things answer,
 * with her words where the books have them. So a tap that no reading point,
 * sign or shadow has taken is felt for along the line of sight: the steel
 * sycamore, the bird statues and the small dogs (places.js says where each
 * stands, and which of the garden's passages tells of it), and, seen from
 * below, the rock's underside and its roots (Numbers by Paint's view of the
 * city from far beneath it). The nearest one the city doesn't hide is found;
 * main.js answers it (a ring of light, a sound of its own, then the words).
 */

// =============================================================================
// Imports
// =============================================================================

import { Raycaster, Sphere, Vector2, Vector3 } from 'three';
import { CLIFF_DEPTH } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** The words the underside opens: the city from Blue Beach, far below it. */
export const UNDERSIDE_FRAGMENT = 'nbp-e1-underside-1';

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {object} options.stage - from createStage (its camera, canvas and touch targets)
 * @param {import('three').Object3D[]} options.occluders - the city's solid surfaces
 */
export function createTouch({ stage, occluders }) {
    const { camera, canvas } = stage;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const hit = new Vector3();
    const targets = (stage.touch ?? []).map((target) => ({ ...target, sphere: new Sphere(target.center, target.radius) }));

    return {
        /**
         * What lies under a tap at (x, y), if anything answers there: { kind, fragment, point }, or null. The
         * first surface along the line of sight decides: a target counts if it's no further than that surface
         * (give or take its own size, since it is that surface).
         */
        find(x, y) {
            const rect = canvas.getBoundingClientRect();
            pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
            raycaster.setFromCamera(pointer, camera);
            const { ray } = raycaster;
            const first = raycaster.intersectObjects(occluders, false)[0] ?? null;
            const blocked = first?.distance ?? Infinity;
            let best = null;
            for (const target of targets) {
                if (!ray.intersectSphere(target.sphere, hit)) continue;
                const distance = hit.distanceTo(ray.origin);
                if (distance > blocked + target.radius) continue;
                if (!best || distance < best.distance) best = { kind: target.kind, fragment: target.fragment, point: hit.clone(), distance };
            }
            if (best) return best;
            // From below, the rock itself: its curtain, its belly, its roots (anything under the cliff's foot).
            if (first && camera.position.y < -CLIFF_DEPTH && first.point.y < -CLIFF_DEPTH - 0.5) {
                return { kind: 'underside', fragment: UNDERSIDE_FRAGMENT, point: first.point.clone(), distance: first.distance };
            }
            return null;
        },
    };
}
