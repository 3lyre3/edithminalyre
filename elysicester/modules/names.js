/**
 * names.js — faint names for the places, while the camera is far out (a trial: the playtester's "faint labels
 * far out, or below"; ?names=off). Each name stands a little above its place, and fades in as the camera draws
 * back past a middle distance (close in, the lit point's own label is enough). From below the island, where
 * the rock hides the city, only the underside's name shows; from above, every name but the underside's.
 *
 * With the hint trial on (?hint=off), the places whose passages have all been read are named more faintly
 * than the ones still waiting, so the far view shows where there's still something to read.
 *
 * The names are drawn by the page, over the canvas: they take no touch (the city under them keeps it), and a
 * screen reader has the reading points' own list instead (aria-hidden).
 */

// =============================================================================
// Imports
// =============================================================================

import { MathUtils, Vector3 } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** The camera's distance from what it looks at: names begin to show past NEAR, and are full past FAR. */
const NEAR = 48;
const FAR = 76;

/** How strong a name is, at full: a place with something still to read, and one read through. */
const WAITING = 0.78;
const READ_THROUGH = 0.42;

/** Below this height the camera is under the island (only the underside's name then). */
const BELOW = -2.5;

/** A name stands this far above its place's anchor (world units). */
const LIFT = 1.4;

/** Names never crowd: one that would overlap a stronger (or, as strong, a nearer) one stands down (CSS px). */
const ROOM = 6;
const NAME_HEIGHT = 16;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {HTMLElement} options.container - an empty element over the stage (aria-hidden)
 * @param {object} options.stage - from createStage
 * @param {Map<string, object>} options.places - place data by id
 * @param {object[]} options.fragments - the readable fragments
 * @param {Set<string>} options.read - fragment ids read (kept up to date by main.js)
 * @param {boolean} options.hint - whether read-through places are named more faintly
 * @param {() => string | null} [options.litPlace] - the place whose point is lit (its own label shows instead)
 */
export function createNames({ container, stage, places, fragments, read, hint, litPlace = () => null }) {
    const { camera, canvas, rig } = stage;
    const ids = [...new Set(fragments.map((fragment) => fragment.place))].filter((id) => stage.anchors.has(id));
    const entries = ids.map((id) => {
        const element = document.createElement('span');
        element.className = 'place-name';
        element.textContent = places.get(id).label;
        element.style.opacity = '0';
        element.style.visibility = 'hidden';
        container.append(element);
        return {
            id,
            element,
            at: stage.anchors.get(id).clone().add(new Vector3(0, LIFT, 0)),
            under: id === 'underside',
            shown: 0,
            strength: 0,
            width: 0,
            x: 0,
            y: 0,
            depth: 0,
        };
    });
    const projected = new Vector3();

    const readThrough = (id) => fragments.every((fragment) => fragment.place !== id || read.has(fragment.id));
    let frames = 0;
    const standing = [];

    stage.onFrame(() => {
        const far = MathUtils.smoothstep(rig.now.radius, NEAR, FAR);
        const below = camera.position.y < BELOW;
        const rect = canvas.getBoundingClientRect();
        const lit = litPlace();
        // (Each name's width, measured once it's first drawn, and again now and then, as fonts arrive.)
        frames += 1;
        const measure = frames % 90 === 1;
        const wanted = [];
        for (const entry of entries) {
            entry.strength = far * (entry.under === below ? 1 : 0) * (entry.id === lit ? 0 : 1);
            if (entry.strength <= 0.01) continue;
            projected.copy(entry.at).project(camera);
            if (projected.z >= 1 || Math.abs(projected.x) > 1.05 || Math.abs(projected.y) > 1.05) {
                entry.strength = 0;
                continue;
            }
            entry.x = rect.left + ((projected.x + 1) / 2) * rect.width;
            entry.y = rect.top + ((1 - projected.y) / 2) * rect.height;
            entry.depth = projected.z;
            entry.strength *= hint && readThrough(entry.id) ? READ_THROUGH : WAITING;
            if (measure || !entry.width) entry.width = entry.element.offsetWidth || entry.width || 0;
            wanted.push(entry);
        }
        // The strongest first, and of those the nearest; each keeps its room, or stands down.
        wanted.sort((a, b) => b.strength - a.strength || a.depth - b.depth);
        standing.length = 0;
        for (const entry of wanted) {
            const half = entry.width / 2 + ROOM;
            const crowds = standing.some((other) => Math.abs(other.x - entry.x) < half + other.width / 2
                && Math.abs(other.y - entry.y) < NAME_HEIGHT + ROOM);
            if (crowds) {
                entry.strength = 0;
                continue;
            }
            standing.push(entry);
            entry.element.style.translate = `${Math.round(entry.x)}px ${Math.round(entry.y)}px`;
        }
        for (const entry of entries) {
            const rounded = Math.round(entry.strength * 50) / 50;
            if (rounded !== entry.shown) {
                entry.shown = rounded;
                entry.element.style.opacity = String(rounded);
                // (Kept laid out while faded, so its width can be measured; the page never touches it.)
                entry.element.style.visibility = rounded === 0 ? 'hidden' : 'visible';
            }
        }
    });

    return {
        /** For the local checks: each name, and how strongly it shows. */
        shown() {
            return entries.map((entry) => ({ id: entry.id, opacity: entry.shown }));
        },
    };
}
