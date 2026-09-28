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
    CatmullRomCurve3,
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
    TubeGeometry,
    Vector2,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =============================================================================
// The island's shape and the noise, from shape.js
// =============================================================================

import { CLIFF_DEPTH, UNDERSIDE_DEPTH } from './shape.js';

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

/** A tube that narrows along its length, for trunks, branches and roots. */
export function taperedTube(points, fromRadius, toRadius, color, segments = 24, radial = 6) {
    const curve = new CatmullRomCurve3(points);
    const geometry = new TubeGeometry(curve, segments, 1, radial, false);
    const position = geometry.attributes.position;
    const centre = new Vector3();
    const vertex = new Vector3();
    for (let ring = 0; ring <= segments; ring += 1) {
        curve.getPointAt(ring / segments, centre);
        const radius = fromRadius + (toRadius - fromRadius) * (ring / segments);
        for (let side = 0; side <= radial; side += 1) {
            const index = ring * (radial + 1) + side;
            vertex.fromBufferAttribute(position, index).sub(centre).multiplyScalar(radius).add(centre);
            position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
    }
    geometry.computeVertexNormals();
    return paint(geometry, color);
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
        gold: toon({ emissive: 0x8a7424, emissiveIntensity: 0.3 }),
        /** The sea-wall's golden bricking. */
        bricking: bricks(toon({ emissive: 0x8a7424, emissiveIntensity: 0.28 })),
        dimGold: toon({ emissive: 0x3a2a0c, emissiveIntensity: 0.4 }),
        brick: toon({}),
        stone: toon({}),
        /** The island's underside: striated rock, like the floating islands in Elm's cosmology plate. */
        rock: strata(toon({}), {
            strata: [0x7c5e5c, 0x8a6a58, 0x6e5a66, 0x94765e, 0x66545f],
            deep: 0x2e2438,
            reach: CLIFF_DEPTH + UNDERSIDE_DEPTH,
        }),
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
 * Dusk light for a material. The toon ramp gives the light from the key and
 * the sky; this adds what a dusk adds: a warm edge wherever a surface turns
 * toward the sunken sun, a glint where gold would catch it, and the last of
 * the light on whatever stands tallest. Every strength is a uniform, so one
 * compiled program serves every material that uses it.
 * @param {import('three').Material} material
 * @param {object} options
 * @param {import('three').Vector3} options.sun - the way to the sunken sun (world)
 * @param {number} [options.rim] - how strongly edges facing the sun are lit
 * @param {number} [options.shine] - how brightly faces glint where they mirror the sun
 * @param {number} [options.tip] - how warmly the tallest things are lit
 * @param {number} [options.tipFrom] - the height (world y) the last light begins at
 * @param {number} [options.tipTo] - the height it is full at
 */
export function duskLight(material, { sun, rim = 0, shine = 0, tip = 0, tipFrom = 10, tipTo = 32 }) {
    const uniforms = {
        duskSun: { value: sun.clone().normalize() },
        duskRim: { value: new Color(0xffa060).multiplyScalar(rim) },
        duskShine: { value: new Color(0xfff0c8).multiplyScalar(shine) },
        duskTip: { value: new Color(0xff9a78).multiplyScalar(tip) },
        duskTipRange: { value: new Vector2(tipFrom, tipTo) },
    };
    alsoBeforeCompile(material, 'dusk', (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vDuskHeight;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDuskHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', [
                '#include <common>',
                'uniform vec3 duskSun;',
                'uniform vec3 duskRim;',
                'uniform vec3 duskShine;',
                'uniform vec3 duskTip;',
                'uniform vec2 duskTipRange;',
                'varying float vDuskHeight;',
            ].join('\n'))
            .replace('#include <opaque_fragment>', [
                '{',
                '    vec3 toEye = normalize(vViewPosition);',
                '    vec3 sunView = normalize((viewMatrix * vec4(duskSun, 0.0)).xyz);',
                '    float facing = clamp(dot(normal, toEye), 0.0, 1.0);',
                '    float sunward = clamp(dot(normal, sunView) * 0.6 + 0.4, 0.0, 1.0);',
                '    // A warm edge, laid in as a band, like the rest of the shading.',
                '    outgoingLight += duskRim * diffuseColor.rgb * smoothstep(0.55, 0.75, 1.0 - facing) * sunward;',
                '    float mirror = max(dot(reflect(-sunView, normal), toEye), 0.0);',
                '    outgoingLight += duskShine * diffuseColor.rgb * smoothstep(0.84, 0.92, mirror);',
                '    outgoingLight += duskTip * diffuseColor.rgb * smoothstep(duskTipRange.x, duskTipRange.y, vDuskHeight);',
                '}',
                '#include <opaque_fragment>',
            ].join('\n'));
    });
    return material;
}

/**
 * Add a change to a material's shaders on top of any it already has. Each
 * change is named in the program's cache key, so materials changed in
 * different ways never share a compiled program by mistake (three.js keys a
 * program by its onBeforeCompile's source, and a wrapper's source is always
 * the same).
 */
function alsoBeforeCompile(material, name, change) {
    const before = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer);
        change(shader, renderer);
    };
    material.customProgramCacheKey = () => `${key}|${name}`;
}

/**
 * The rock's strata, laid per pixel rather than per triangle, so the bands
 * wander smoothly across the facets (a band per triangle drew saw-teeth). The
 * bands follow a slow noise, run through five rock colours, and darken toward
 * the underside's deepest point; the vertex colour still tints them, so a
 * piece can be warmer or cooler than the rest.
 * @param {import('three').Material} material
 * @param {object} options
 * @param {number[]} options.strata - the bands' colours (hex), top down, repeating
 * @param {number} options.deep - the colour the deepest rock goes to
 * @param {number} options.reach - how deep (below y = 0) the rock goes
 */
export function strata(material, { strata: colors, deep, reach }) {
    const bands = colors.map((hex) => new Color(hex));
    alsoBeforeCompile(material, `strata${bands.length}`, (shader) => {
        shader.uniforms.strataColors = { value: bands };
        shader.uniforms.strataDeep = { value: new Color(deep) };
        shader.uniforms.strataReach = { value: reach };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vStrataPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrataPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', [
                '#include <common>',
                `uniform vec3 strataColors[${bands.length}];`,
                'uniform vec3 strataDeep;',
                'uniform float strataReach;',
                'varying vec3 vStrataPosition;',
                'float strataHash(vec2 p) {',
                '    vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
                '    p3 += dot(p3, p3.yzx + 33.33);',
                '    return fract((p3.x + p3.y) * p3.z);',
                '}',
                'float strataNoise(vec2 p) {',
                '    vec2 i = floor(p);',
                '    vec2 f = fract(p);',
                '    vec2 u = f * f * (3.0 - 2.0 * f);',
                '    return mix(mix(strataHash(i), strataHash(i + vec2(1.0, 0.0)), u.x),',
                '        mix(strataHash(i + vec2(0.0, 1.0)), strataHash(i + vec2(1.0, 1.0)), u.x), u.y);',
                '}',
            ].join('\n'))
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                '{',
                '    float depth = -vStrataPosition.y;',
                '    float wander = strataNoise(vStrataPosition.xz * 0.18) * 2.4 + strataNoise(vStrataPosition.xz * 0.6 + 7.0) * 0.6;',
                '    float laid = (depth + wander) / 1.7;',
                '    // Bands of uneven thickness, as rock lays them down.',
                '    laid += 0.32 * sin(laid * 2.3 + 1.1);',
                '    float band = floor(laid);',
                `    int index = int(mod(band, ${bands.length}.0));`,
                `    int next = int(mod(band + 1.0, ${bands.length}.0));`,
                '    // Each band meets the next along a soft line a nib wide, never a stair of facets.',
                '    float edge = smoothstep(1.0 - max(fwidth(laid), 0.02) * 1.5, 1.0, fract(laid));',
                '    vec3 rock = mix(strataColors[index], strataColors[next], edge);',
                '    rock = mix(rock, strataDeep, min(0.7, max(depth, 0.0) / strataReach * 0.8));',
                '    diffuseColor.rgb *= rock;',
                '}',
            ].join('\n'));
    });
    return material;
}

/**
 * Golden bricking ("the sea erupts in bursts of silver and violet, tumbling
 * up the golden bricking", Numbers by Paint, Episode 1): a running bond laid
 * over whatever the material draws, each brick its own gold, the mortar a
 * darker line. The courses run the way each face does (along the wall on its
 * faces, paving on its top), and the joints keep an even width on screen and
 * are let go before they crowd, so they never shimmer from far off.
 * @param {import('three').Material} material
 * @param {object} [options]
 * @param {number} [options.length] - a brick's length, in world units
 * @param {number} [options.height] - a course's height
 */
export function bricks(material, { length = 0.72, height = 0.3 } = {}) {
    alsoBeforeCompile(material, 'bricks', (shader) => {
        shader.uniforms.brickSize = { value: new Vector2(length, height) };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vBrickPosition;\nvarying vec3 vBrickNormal;')
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                'vBrickPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
                'vBrickNormal = normalize(mat3(modelMatrix) * objectNormal);',
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec2 brickSize;\nvarying vec3 vBrickPosition;\nvarying vec3 vBrickNormal;')
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                '{',
                '    vec3 facing = abs(normalize(vBrickNormal));',
                '    vec2 laid = facing.y > 0.6 ? vBrickPosition.xz / vec2(brickSize.x, brickSize.x * 0.5)',
                '        : (facing.x > facing.z ? vBrickPosition.zy : vBrickPosition.xy) / brickSize;',
                '    laid.x += mod(floor(laid.y), 2.0) * 0.5;',
                '    vec2 within = fract(laid);',
                '    vec2 width = max(fwidth(laid), vec2(1e-4));',
                '    float drawn = 1.0 - smoothstep(0.14, 0.34, max(width.x, width.y));',
                '    float tone = fract(sin(dot(floor(laid), vec2(12.9898, 78.233))) * 43758.5453);',
                '    vec3 brick = diffuseColor.rgb * mix(1.0, 0.88 + 0.22 * tone, drawn);',
                '    vec2 fromJoint = min(within, 1.0 - within);',
                '    vec2 joint = vec2(0.035, 0.08);',
                '    vec2 line = 1.0 - smoothstep(joint - width * 0.5, joint + width * 0.5, fromJoint);',
                '    float mortar = max(line.x, line.y) * drawn;',
                '    diffuseColor.rgb = mix(brick, diffuseColor.rgb * vec3(0.58, 0.5, 0.44), mortar * 0.85);',
                '}',
            ].join('\n'));
    });
    return material;
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
