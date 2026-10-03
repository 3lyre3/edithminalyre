/**
 * frame.js — a passage's giver framed where its open passage leaves the city in view (a trial: ?frame=off).
 *
 * Elm, 4 Oct, choosing "B": "The fly-in to a giver frames the hum and its shade together". Looked at where the camera
 * came to as a passage opened (probe-hum-shades.mjs), the giver stood at the middle of the screen, which is where the
 * passage itself stands on a computer (on a phone it rises from the bottom over half the screen): not one hum's shade
 * was to be seen, nor a pug's board painting itself in. Now the camera frames the giver and its shade in the open part
 * of the screen (beside the passage on a computer, above it on a phone), as near as fits there: a hum from the side
 * its shade is seen along its whole length, never end on; a pug from its own side, as before, so its board faces the
 * eye. Nearer, where something solid would stand between (a hum indoors).
 */

// =============================================================================
// Imports
// =============================================================================

import { MathUtils, Raycaster, Vector3 } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** How much of the open part the giver and its shade take; the rest is room round them. */
const FILL = 0.74;
/** How near and how far the camera comes (metres). */
const NEAR = 2.4;
const FAR = 16;
/** Kept clear (CSS px) of the passage's edge and the screen's, and of the controls along the top. */
const MARGIN = 16;
const TOP = 60;
/** The narrowest open part worth framing in (CSS px); with none, the giver is centred as it was. */
const SMALLEST = 120;
/** How far down a hum and its shade are looked at (from straight down): about the walking camera's own look. */
const HUM_PHI = MathUtils.degToRad(57);
/** How near a solid the line from the giver to the camera may pass (metres), as the rig's own check has it. */
const CLEAR = 0.2;
/** And the room the eye itself needs round it (metres): no nearer a solid than the rig keeps the camera. */
const ROOM = 0.45;
/** Looking about, a view in open air that sees this much of what it must is better than a hint's in something solid. */
const FAIR = 0.6;
/** The turns from square to a hum's shade tried, in turn, for a clear view (radians: none, then about 26° and 52°). */
const TURNS = [0, 0.45, -0.45, 0.9, -0.9];
/** And from a pug's own side (radians: none, then about 20° and 40°), its board's picture facing the eye still. */
const PUG_TURNS = [0, 0.35, -0.35, 0.7, -0.7];
/** A wide screen (CSS px across), where a giver's passage stands to one side (style.css .reader.is-beside). */
const WIDE = 900;
/** How long the search for a clear view may take, where no hint was found beforehand (ms): a frame or two. */
const BUDGET = 30;

// =============================================================================
// Main Code
// =============================================================================

const along = new Vector3();
const probe = new Vector3();
const offset = new Vector3();
const sight = new Raycaster();
const toward = new Vector3();

/** Whether nothing of the city's (its solid surfaces, as hide a reading point: hotspots.js) stands between. */
function sees(occluders, eye, point) {
    if (!occluders?.length) return true;
    toward.subVectors(point, eye);
    const distance = toward.length();
    sight.set(eye, toward.divideScalar(distance || 1));
    // (Short of the point by a little: a shade's own floor isn't in its way.)
    sight.far = Math.max(0, distance - 0.3);
    return sight.intersectObjects(occluders, false).length === 0;
}

function shortest(angle) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

/** The camera's way out from what it looks at, its right and its up, for the rig's angles (orbit.js, three's lookAt). */
function axes(theta, phi) {
    const out = new Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const right = new Vector3(Math.cos(theta), 0, -Math.sin(theta));
    const up = new Vector3().crossVectors(out, right).normalize();
    return { out, right, up };
}

/** Whether nothing solid stands within CLEAR of the line from `from` to `to` (after its first stretch, as orbit.js). */
function clearLine(solids, from, to) {
    if (!solids?.available) return true;
    along.subVectors(to, from);
    const length = along.length();
    if (length < 1e-6) return true;
    along.divideScalar(length);
    let at = 0.8;
    for (let stride = 0; stride < 96 && at < length; stride += 1) {
        const gap = solids.distance(probe.copy(from).addScaledVector(along, at));
        if (gap < CLEAR) return false;
        at += Math.max(gap * 0.9, 0.15);
    }
    return true;
}

/**
 * Where the camera stands to frame a passage's giver with its shade in the open part of the screen beside its passage.
 * @param {object} options
 * @param {{ points: Vector3[], body: Vector3, shade: import('three').Box3|null, kind: string, hasShade: boolean }} options.framing -
 *   what's kept in view (creatures.js)
 * @param {import('three').Mesh[]} [options.occluders] - what of the city hides a thing behind it (hotspots.js)
 * @param {Vector3} options.way - the way the shades run (creatures.js shadeWay)
 * @param {object} options.rig - the camera rig (rigs/orbit.js): its angles now, its solids
 * @param {import('three').PerspectiveCamera} options.camera
 * @param {HTMLElement} options.canvas
 * @param {HTMLDialogElement} options.dialog - the passage, open
 * @param {number|null} [options.facing] - the passage's own side (degrees), for a pug
 * @param {{ focus: { distance: number, height: number, azimuth?: number } }|null} [options.place] - its place's view
 * @param {{ wide?: [number, number], narrow?: [number, number] }|null} [options.hints] - its side (degrees) and
 *   nearness, found beforehand for a wide screen and a narrow one (data/creatures.json "frames")
 * @param {number} [options.budget] - how long the search may take without a hint (ms; the hints tool: Infinity)
 * @param {boolean} [options.flying] - whether the visitor is flying (the camera goes where it's sent, through walls the
 *   dust opens) or looking about (the rig keeps it out of anything solid)
 * @returns {{ target: Vector3, centre: Vector3, theta: number, phi: number, distance: number, nearer: number } | null}
 *   null where there's no open part worth it (the caller centres the giver as before)
 */
export function frameGiver({ framing, way, rig, camera, canvas, dialog, facing = null, place = null, occluders = [], hints = null, budget = BUDGET, flying = true }) {
    if (!framing?.points.length || !canvas || !dialog?.open) return null;
    const screen = canvas.getBoundingClientRect();
    const page = dialog.getBoundingClientRect();
    if (!screen.width || !screen.height) return null;
    // The open parts: either side of the passage, above it, below it.
    const bands = [
        { x0: screen.left + MARGIN, x1: page.left - MARGIN, y0: screen.top + TOP, y1: screen.bottom - MARGIN },
        { x0: page.right + MARGIN, x1: screen.right - MARGIN, y0: screen.top + TOP, y1: screen.bottom - MARGIN },
        { x0: screen.left + MARGIN, x1: screen.right - MARGIN, y0: screen.top + TOP, y1: page.top - MARGIN },
        { x0: screen.left + MARGIN, x1: screen.right - MARGIN, y0: page.bottom + MARGIN, y1: screen.bottom - MARGIN },
    ].map((band) => ({ ...band, w: band.x1 - band.x0, h: band.y1 - band.y0 })).filter((band) => band.w >= SMALLEST && band.h >= SMALLEST);
    if (!bands.length) return null;

    // Its middle: the middle of the box round all it keeps in view.
    const low = framing.points[0].clone();
    const high = framing.points[0].clone();
    for (const point of framing.points) {
        low.min(point);
        high.max(point);
    }
    const centre = low.clone().add(high).multiplyScalar(0.5);

    // The sides it's seen from: a hum's, either side of its shade's run, the camera's own side first (the shorter way
    // round); a pug's, its passage's own side (its board facing the eye), else its place's, else from the island's
    // middle out, as before.
    let thetas;
    let phi;
    if (framing.kind === 'hum' && framing.hasShade && way) {
        // (Either side square to its shade first, then a little round from each, then more: its shade still seen long.)
        const side = Math.atan2(-way.z, way.x);
        const sides = [side, side + Math.PI].sort((a, b) => Math.abs(shortest(a - rig.now.theta)) - Math.abs(shortest(b - rig.now.theta)));
        thetas = [];
        for (const turn of TURNS) for (const base of sides) thetas.push(base + turn);
        phi = HUM_PHI;
    } else {
        // (A pug's own side, then a little round from it either way: its board's picture still faces the eye.)
        const azimuth = facing ?? place?.focus.azimuth;
        const own = azimuth === undefined || azimuth === null ? Math.atan2(centre.x, centre.z) : MathUtils.degToRad(azimuth);
        thetas = PUG_TURNS.map((turn) => own + turn);
        phi = place ? Math.acos(MathUtils.clamp(place.focus.height / place.focus.distance, -0.95, 0.95)) : HUM_PHI;
    }

    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov) / 2);
    const aspect = screen.width / screen.height;
    /** The frame from a side, the camera `nearer` times as far as fits (1: as fits the open part). */
    const plan = (theta, nearer = 1) => {
        const { out, right, up } = axes(theta, phi);
        // How broad and how tall it stands from there (metres, round its middle).
        let broad = 0;
        let tall = 0;
        for (const point of framing.points) {
            offset.subVectors(point, centre);
            broad = Math.max(broad, Math.abs(offset.dot(right)));
            tall = Math.max(tall, Math.abs(offset.dot(up)));
        }
        broad = Math.max(broad * 2, 0.6);
        tall = Math.max(tall * 2, 0.6);
        // The open part it would show biggest in, and how near that brings the camera.
        let chosen = null;
        for (const band of bands) {
            const perMetre = Math.min((FILL * band.w) / broad, (FILL * band.h) / tall);
            if (!chosen || perMetre > chosen.perMetre) chosen = { band, perMetre };
        }
        const distance = MathUtils.clamp((nearer * screen.height) / (2 * tanHalf * chosen.perMetre), NEAR, FAR);
        // Its middle set in the open part's middle: the camera looks at a point off it by just as much. (Nearer than
        // fits, it's no longer all in the open part: the giver itself is set there instead, little by little, its shade
        // running out from it as it may.)
        const middle = centre.clone().lerp(framing.body, MathUtils.clamp((1 - nearer) / 0.7, 0, 1));
        const u = (((chosen.band.x0 + chosen.band.x1) / 2 - screen.left) / screen.width) * 2 - 1;
        const v = 1 - (((chosen.band.y0 + chosen.band.y1) / 2 - screen.top) / screen.height) * 2;
        const target = middle.clone().addScaledVector(right, -u * distance * tanHalf * aspect).addScaledVector(up, -v * distance * tanHalf);
        const eye = target.clone().addScaledVector(out, distance);
        return { target, centre: middle, theta, phi, distance, eye, nearer, right, up, out };
    };
    /** Whether a point stands on the screen, from a frame's eye, and not under the open passage. */
    const inView = (frame, point) => {
        offset.subVectors(point, frame.eye);
        const depth = -offset.dot(frame.out);
        if (depth <= 0.1) return false;
        const x = screen.left + ((offset.dot(frame.right) / (depth * tanHalf * aspect) + 1) / 2) * screen.width;
        const y = screen.top + ((1 - offset.dot(frame.up) / (depth * tanHalf)) / 2) * screen.height;
        if (x < screen.left || x > screen.right || y < screen.top + TOP / 2 || y > screen.bottom) return false;
        return !(x > page.left && x < page.right && y > page.top && y < page.bottom);
    };
    // Its side and nearness already found for this kind of screen (the mission's frame-hints tool, as each giver stands
    // in the city as built; data/creatures.json): taken as they are, at no cost. The search below costs a ray a few
    // milliseconds through the city's merged meshes, too many on a phone.
    // (Found for a visitor flying, as most are. Looking about instead, an eye it would set in something solid isn't
    // taken: the search below finds one in open air, within its budget, if it can.)
    const buried = (eye) => Boolean(rig.solids?.available) && rig.solids.distance(eye) < ROOM;
    const hint = hints?.[screen.width >= WIDE ? 'wide' : 'narrow'];
    const hinted = hint ? plan(MathUtils.degToRad(hint[0]), hint[1]) : null;
    if (hinted && (flying || !buried(hinted.eye))) return hinted;
    // What must be seen from there: the giver, and its shade, at spots down its middle as it lies (on the floor, or up
    // the wall that caught it); else where its box begins, its middle and where it ends.
    const keys = [framing.body];
    if (framing.spots?.length) {
        keys.push(...framing.spots);
    } else if (framing.shade) {
        const middle = framing.shade.getCenter(new Vector3());
        const half = way ? Math.abs((framing.shade.max.x - framing.shade.min.x) * way.x) / 2 + Math.abs((framing.shade.max.z - framing.shade.min.z) * way.z) / 2 : 0;
        keys.push(middle);
        if (way && half > 0.2) keys.push(middle.clone().addScaledVector(way, -half * 0.8), middle.clone().addScaledVector(way, half * 0.8));
    }
    // How well a frame does: all it must see seen, and nothing solid on the way to the camera (the rig's own field), is
    // all; else how many are seen.
    // (An eye in something solid is a poor one when looking about, not flying: the rig moves it out to open air, off the
    // frame (orbit.js keepClear). Flying, the camera goes just where it's sent, and the dust opens round it.)
    // (Seen is on the screen, beside the passage, with nothing in the way.)
    const score = (frame) => {
        const penalty = !flying && buried(frame.eye) ? 2 : 0;
        return keys.filter((key) => inView(frame, key) && sees(occluders, frame.eye, key)).length + (clearLine(rig.solids, centre, frame.eye) ? 0.5 : 0) - penalty;
    };
    const whole = keys.length + 0.5;
    // Every side at the distance that fits, then nearer (a hum indoors, the ball's: the open part filled more than it
    // should be); the first that sees all is it, else the one that sees most, of those tried within the budget.
    const started = performance.now();
    let best = null;
    for (const nearer of [1, 0.75, 0.55, 0.4, 0.3]) {
        let nearest = Infinity;
        for (const theta of thetas) {
            const frame = plan(theta, nearer);
            nearest = Math.min(nearest, frame.distance);
            frame.seen = score(frame) / whole;
            if (frame.seen >= 1) return frame;
            if (!best || frame.seen > best.seen) best = frame;
            if (performance.now() - started > budget) return hinted && best.seen < FAIR ? hinted : best;
        }
        // (No nearer to come.)
        if (nearest <= NEAR) break;
    }
    return hinted && best.seen < FAIR ? hinted : best;
}
