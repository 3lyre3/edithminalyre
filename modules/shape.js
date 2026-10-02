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

/** The rim is drawn as a polygon of this many sides: the rock's top edge (island.js), and the sea's (sea.js). */
export const RIM_SEGMENTS = 144;

/** The golden sea-wall runs north–south near this x; the sea lies east of it. */
const WALL_BASE_X = 9;

/** Height of the Elysian Sea's surface on the island. */
export const SEA_LEVEL = -0.6;

/** How far the cliff drops below the rim, and how much deeper the rock's underside hangs (its belly's lowest point). */
export const CLIFF_DEPTH = 3.4;
export const UNDERSIDE_DEPTH = 17;

/**
 * The underside, as Elm draws her islands: below the cliff a curtain of rock
 * falls steeply, narrowing a little, to a ragged edge (lobed, scalloped, and
 * here and there a long drip); within the edge a broad belly bows down to its
 * lowest point under the middle. The edge stands in to this much of the rim's
 * radius, and falls at least CURTAIN_LEAST below the cliff's foot.
 */
export const CURTAIN_EDGE = 0.84;
export const CURTAIN_LEAST = 4.5;

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

/** Noise round the island that comes back to itself: the same at an angle as a full turn on (no seam). */
export function aroundNoise(angle, turns, seed) {
    return noise2(Math.cos(angle) * turns + seed, Math.sin(angle) * turns - seed * 0.7);
}

/** How far below the cliff's foot the curtain's ragged edge hangs, at an angle round the island. */
export function curtainDrop(angle) {
    const lobes = aroundNoise(angle, 0.9, 3.1);
    const scallops = aroundNoise(angle, 3.6, 7.7);
    const drip = aroundNoise(angle, 11, 1.3);
    return CURTAIN_LEAST + 5 * lobes + 1.6 * scallops + 8 * drip ** 4;
}

/**
 * How deep (below y = 0) the belly hangs at a fraction of the rim's radius, within the edge: from the edge's
 * own depth, bowing down toward UNDERSIDE_DEPTH below the cliff's foot at the middle.
 */
export function bellyDepth(angle, fraction) {
    const edge = curtainDrop(angle);
    const u = 1 - Math.pow(Math.min(1, fraction / CURTAIN_EDGE), 1 / 0.85);
    return CLIFF_DEPTH + edge + (UNDERSIDE_DEPTH - edge) * (1 - (1 - u) * (1 - u));
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

/**
 * The same ground in GLSL (ES 3.00), bit for bit the same noise: its hash is
 * done in 32-bit unsigned integers, as Math.imul and >>> do it here, so a
 * shader knows how high any point stands above the ground under it.
 */
export function groundYGLSL() {
    return [
        'float groundHash(float x, float y) {',
        '    // (Lifted clear of zero before the cast, then lowered again in unsigned arithmetic: the',
        '    // same bits as a negative int32, without leaning on how a driver casts one.)',
        '    uint h = (uint(int(x) + 4096) - 4096u) * 374761393u + (uint(int(y) + 4096) - 4096u) * 668265263u;',
        '    h = (h ^ (h >> 13u)) * 1274126177u;',
        '    h ^= h >> 16u;',
        '    return float(h) / 4294967296.0;',
        '}',
        'float groundNoise(vec2 p) {',
        '    vec2 i = floor(p);',
        '    vec2 f = p - i;',
        '    vec2 s = f * f * (3.0 - 2.0 * f);',
        '    float a = groundHash(i.x, i.y);',
        '    float b = groundHash(i.x + 1.0, i.y);',
        '    float c = groundHash(i.x, i.y + 1.0);',
        '    float d = groundHash(i.x + 1.0, i.y + 1.0);',
        '    return a + (b - a) * s.x + (c - a) * s.y + (a - b - c + d) * s.x * s.y;',
        '}',
        'float groundY(vec2 xz) {',
        '    vec2 p = vec2(xz.x * 0.08 + 3.1, xz.y * 0.08 - 1.7);',
        '    float fbm = (0.5 * groundNoise(p) + 0.25 * groundNoise(p * 2.0)) / 0.75;',
        '    return max(0.0, -xz.x - 4.0) * 0.055 + 0.25 * fbm - 0.12;',
        '}',
    ].join('\n');
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
