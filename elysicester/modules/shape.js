/**
 * shape.js — the island's shape and the city's noise, in plain numbers.
 *
 * No three.js here, so the worker that works out the camera's solids can share
 * it with the page: the island's outline and waterfront (in JavaScript and in
 * GLSL), the ground's gentle rise, the depth of the rock beneath, and the
 * seeded randomness and smooth noise that shape them all. kit.js passes all of
 * it on, so every piece of the city still finds it there.
 */

// =============================================================================
// Constants
// =============================================================================

/** Mean radius of the floating island. */
export const ISLAND_RADIUS = 30;

/** The rim wanders around the mean radius: [frequency, amplitude, phase]. */
const RIM_WAVES = [
    [3, 0.045, 0.7],
    [5, 0.03, 2.1],
    [9, 0.014, 4.0],
];

/** The golden sea-wall runs north–south near this x; the sea lies east of it. */
const WALL_BASE_X = 9;

/** Height of the Elysian Sea's surface on the island. */
export const SEA_LEVEL = -0.6;

/** How far the cliff drops below the rim, and how much deeper the rock's underside hangs. */
export const CLIFF_DEPTH = 3.4;
export const UNDERSIDE_DEPTH = 22;

// =============================================================================
// Outline and waterfront
// =============================================================================

/** Radius of the island's rim at a given angle (radians, atan2(z, x)). */
export function rimRadius(angle) {
    let factor = 1;
    for (const [frequency, amplitude, phase] of RIM_WAVES) factor += amplitude * Math.sin(frequency * angle + phase);
    return ISLAND_RADIUS * factor;
}

/** The same rim, as a GLSL function for the sea's shader. */
export function rimRadiusGLSL() {
    const terms = RIM_WAVES
        .map(([frequency, amplitude, phase]) => `${amplitude.toFixed(4)} * sin(${frequency.toFixed(1)} * angle + ${phase.toFixed(4)})`)
        .join(' + ');
    return `float rimRadius(float angle) { return ${ISLAND_RADIUS.toFixed(1)} * (1.0 + ${terms}); }`;
}

/** x of the sea-wall's face at a given z. */
export function wallX(z) {
    return WALL_BASE_X + 0.8 * Math.sin(z * 0.11 + 0.4);
}

/** The same wall line in GLSL. */
export function wallXGLSL() {
    return `float wallX(float z) { return ${WALL_BASE_X.toFixed(1)} + 0.8 * sin(z * 0.11 + 0.4); }`;
}

/** True when (x, z) lies on the island's land, west of the wall and inside the rim. */
export function onLand(x, z, margin = 0) {
    return x < wallX(z) - margin && Math.hypot(x, z) < rimRadius(Math.atan2(z, x)) - margin;
}

/** Height of the ground: flat at the waterfront, rising gently toward the western rim. */
export function groundY(x, z) {
    const rise = Math.max(0, -x - 4) * 0.055;
    return rise + 0.25 * fbm2(x * 0.08 + 3.1, z * 0.08 - 1.7, 2) - 0.12;
}

// =============================================================================
// Randomness and noise
// =============================================================================

/** mulberry32: a small, fast, seeded generator returning values in [0, 1). */
export function createRandom(seed) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (min, max) => min + (max - min) * next();
    next.pick = (list) => list[Math.floor(next() * list.length)];
    return next;
}

function hash2(ix, iy) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [0, 1]. */
export function noise2(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal (layered) value noise in [0, 1]. */
export function fbm2(x, y, octaves = 4) {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let norm = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
        sum += amplitude * noise2(x * frequency, y * frequency);
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    return sum / norm;
}
