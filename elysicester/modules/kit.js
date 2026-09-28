/**
 * kit.js — small shared tools for drawing Elysicester in code.
 *
 * A seeded random generator (so the city is the same city on every visit),
 * smooth value noise, the island's outline and waterfront (shared by the land,
 * the sea and the rock, in JavaScript and in GLSL), helpers for building
 * vertex-coloured pieces and merging them, and the toon palette.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    Color,
    DataTexture,
    DoubleSide,
    Euler,
    Float32BufferAttribute,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    NearestFilter,
    Quaternion,
    RedFormat,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// =============================================================================
// Geometry helpers
// =============================================================================

const scratchMatrix = new Matrix4();
const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();
const scratchPosition = new Vector3();
const scratchScale = new Vector3();

/**
 * Move, turn and scale a geometry in place.
 * @param {object} at - { x, y, z, rx, ry, rz, sx, sy, sz } (all optional)
 */
export function pose(geometry, at = {}) {
    scratchEuler.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0, 'YXZ');
    scratchQuaternion.setFromEuler(scratchEuler);
    scratchPosition.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    const uniform = at.s ?? 1;
    scratchScale.set(at.sx ?? uniform, at.sy ?? uniform, at.sz ?? uniform);
    geometry.applyMatrix4(scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale));
    return geometry;
}

/** Give every vertex of a geometry one colour (for merged, vertex-coloured meshes). */
export function paint(geometry, color) {
    const tint = new Color(color);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        colors[index * 3] = tint.r;
        colors[index * 3 + 1] = tint.g;
        colors[index * 3 + 2] = tint.b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return geometry;
}

/** Colour each vertex by a function of its position: (x, y, z, color) => void. */
export function paintBy(geometry, painter) {
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new Color();
    for (let index = 0; index < position.count; index += 1) {
        painter(position.getX(index), position.getY(index), position.getZ(index), color);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return geometry;
}

/** Bring a geometry to the shape every merged bucket shares. */
function normalise(geometry, keep) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const name of Object.keys(flat.attributes)) {
        if (!['position', 'normal', 'color', ...keep].includes(name)) flat.deleteAttribute(name);
    }
    if (!flat.attributes.normal) flat.computeVertexNormals();
    if (!flat.attributes.color) paint(flat, 0xffffff);
    return flat;
}

/**
 * Collects painted pieces by material and merges each collection into a single
 * mesh, so the whole city costs only a handful of draw calls.
 */
export class Buckets {
    constructor() {
        this.pieces = new Map();
    }

    add(key, geometry) {
        if (!this.pieces.has(key)) this.pieces.set(key, []);
        this.pieces.get(key).push(geometry);
        return geometry;
    }

    /** @returns {Map<string, Mesh>} one mesh per material key */
    build(materials, keepAttributes = {}) {
        const meshes = new Map();
        for (const [key, geometries] of this.pieces) {
            const material = materials[key];
            if (!material) throw new Error(`No material for bucket "${key}"`);
            const keep = keepAttributes[key] ?? [];
            const merged = mergeGeometries(geometries.map((geometry) => normalise(geometry, keep)), false);
            merged.computeBoundingSphere();
            const mesh = new Mesh(merged, material);
            mesh.name = key;
            meshes.set(key, mesh);
        }
        return meshes;
    }
}

// =============================================================================
// Palette
// =============================================================================

/** A four-step light ramp: shading falls in bands, as if laid in with a brush. */
function toonRamp() {
    const steps = [0.28, 0.52, 0.78, 1];
    const texture = new DataTexture(new Uint8Array(steps.map((value) => Math.round(value * 255))), steps.length, 1, RedFormat);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

/**
 * A colour for something that gives off light. Vertex colours may run past 1,
 * and the tone map in the ink pass turns the excess into glow.
 */
export function light(hex, strength) {
    return new Color(hex).multiplyScalar(strength);
}

/** The materials every piece of the city is drawn with; one draw call each. */
export function createMaterials() {
    const gradientMap = toonRamp();
    const toon = (options) => new MeshToonMaterial({ gradientMap, vertexColors: true, color: 0xffffff, ...options });
    return {
        gold: toon({ emissive: 0x8a7424, emissiveIntensity: 0.4 }),
        dimGold: toon({ emissive: 0x3a2a0c, emissiveIntensity: 0.4 }),
        brick: toon({}),
        stone: toon({}),
        steel: toon({}),
        turquoise: toon({ emissive: 0x1a8a84, emissiveIntensity: 0.6, side: DoubleSide }),
        glass: toon({ transparent: true, opacity: 0.3, emissive: 0x3a5a62, emissiveIntensity: 0.35, side: DoubleSide }),
        arch: toon({ emissive: 0x5a6878, emissiveIntensity: 0.45 }),
        copper: toon({ emissive: 0x4a1c08, emissiveIntensity: 0.4 }),
        glow: new MeshBasicMaterial({ vertexColors: true }),
    };
}
