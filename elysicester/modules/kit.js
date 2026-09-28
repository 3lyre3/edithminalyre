/**
 * kit.js — small shared tools for drawing Elysicester in code.
 *
 * A seeded random generator (so the city is the same city on every visit),
 * smooth value noise, the island's outline and waterfront (shared by the land,
 * the sea and the rock, in JavaScript and in GLSL; these live in shape.js,
 * which the camera's solids worker shares, and are passed on from here),
 * helpers for building vertex-coloured pieces and merging them, and the toon
 * palette.
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
// The island's shape and the noise, from shape.js
// =============================================================================

export {
    CLIFF_DEPTH,
    ISLAND_RADIUS,
    SEA_LEVEL,
    UNDERSIDE_DEPTH,
    createRandom,
    fbm2,
    groundY,
    noise2,
    onLand,
    rimRadius,
    rimRadiusGLSL,
    wallX,
    wallXGLSL,
} from './shape.js';

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
 *
 * A piece added as passable (a wire, a string of flags, a trailing root) is
 * drawn like any other, but the camera may pass through it: each mesh keeps,
 * in userData.solidRanges, the [first vertex, count] runs of everything else.
 */
export class Buckets {
    constructor() {
        this.pieces = new Map();
        this.passable = new Set();
    }

    add(key, geometry, { passable = false } = {}) {
        if (!this.pieces.has(key)) this.pieces.set(key, []);
        this.pieces.get(key).push(geometry);
        if (passable) this.passable.add(geometry);
        return geometry;
    }

    /** @returns {Map<string, Mesh>} one mesh per material key */
    build(materials, keepAttributes = {}) {
        const meshes = new Map();
        for (const [key, geometries] of this.pieces) {
            const material = materials[key];
            if (!material) throw new Error(`No material for bucket "${key}"`);
            const keep = keepAttributes[key] ?? [];
            const flats = geometries.map((geometry) => normalise(geometry, keep));
            const merged = mergeGeometries(flats, false);
            merged.computeBoundingSphere();
            const mesh = new Mesh(merged, material);
            mesh.name = key;
            const solidRanges = [];
            let first = 0;
            flats.forEach((flat, index) => {
                const count = flat.attributes.position.count;
                if (!this.passable.has(geometries[index])) {
                    const last = solidRanges[solidRanges.length - 1];
                    if (last && last[0] + last[1] === first) last[1] += count;
                    else solidRanges.push([first, count]);
                }
                first += count;
            });
            mesh.userData.solidRanges = solidRanges;
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

/**
 * The materials every piece of the city is drawn with; one draw call each.
 * "sign" has no picture yet: signs.js gives it the atlas of Danæam signs.
 */
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
        sign: toon({ vertexColors: false, emissive: 0xffffff, emissiveIntensity: 0.3 }),
        glow: new MeshBasicMaterial({ vertexColors: true }),
    };
}

/**
 * Teach a material to flutter in the wind, by each vertex's "sway" (0 stays
 * still). The flags and the banner among them share one clock.
 * @param {import('three').Material} material
 * @param {{ value: number }} clock - seconds, shared as a uniform
 */
export function flutter(material, clock) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.flutterTime = clock;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float flutterTime;\nattribute float sway;')
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                'float flutter = sin(flutterTime * 3.1 + position.x * 1.7 + position.z * 1.3) * 0.6',
                '    + sin(flutterTime * 5.3 + position.y * 2.1) * 0.3;',
                'transformed += vec3(0.1, 0.04, 0.1) * flutter * sway;',
            ].join('\n'));
    };
}
