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
    BufferGeometry,
    CatmullRomCurve3,
    Color,
    DataTexture,
    DoubleSide,
    Euler,
    Float32BufferAttribute,
    LinearFilter,
    LinearMipmapLinearFilter,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    NearestFilter,
    Quaternion,
    RGBAFormat,
    RedFormat,
    RepeatWrapping,
    TubeGeometry,
    UnsignedByteType,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =============================================================================
// The island's shape and the noise, from shape.js
// =============================================================================

import { CLIFF_DEPTH, UNDERSIDE_DEPTH } from './shape.js';

export {
    CLIFF_DEPTH,
    CURTAIN_EDGE,
    CURTAIN_LEAST,
    ISLAND_RADIUS,
    RIM_SEGMENTS,
    SEA_LEVEL,
    UNDERSIDE_DEPTH,
    aroundNoise,
    bellyDepth,
    createRandom,
    curtainDrop,
    fbm2,
    groundY,
    groundYGLSL,
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

/**
 * A box with every edge chamfered at 45° and every corner cut by a small
 * triangle, flat-shaded. Each chamfer is its own narrow face, so it catches
 * the dusk light (or loses it) as a strip along the edge, the way a made
 * thing's edge does, and the ink draws it as a pair of close lines. Centred on
 * the origin, like a BoxGeometry; 44 triangles.
 * @param {number} width
 * @param {number} height
 * @param {number} depth
 * @param {number} bevel - how far each edge is cut back (kept under half of each side)
 */
export function chamferedBox(width, height, depth, bevel) {
    const a = width / 2;
    const b = height / 2;
    const c = depth / 2;
    const e = Math.min(bevel, a * 0.45, b * 0.45, c * 0.45);
    const triangles = [];
    const quad = (p, q, r, s) => triangles.push([p, q, r], [p, r, s]);
    for (const s of [1, -1]) {
        quad([s * a, b - e, c - e], [s * a, -(b - e), c - e], [s * a, -(b - e), -(c - e)], [s * a, b - e, -(c - e)]);
        quad([a - e, s * b, c - e], [-(a - e), s * b, c - e], [-(a - e), s * b, -(c - e)], [a - e, s * b, -(c - e)]);
        quad([a - e, b - e, s * c], [-(a - e), b - e, s * c], [-(a - e), -(b - e), s * c], [a - e, -(b - e), s * c]);
    }
    for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
            quad([sx * a, sy * (b - e), c - e], [sx * a, sy * (b - e), -(c - e)], [sx * (a - e), sy * b, -(c - e)], [sx * (a - e), sy * b, c - e]);
        }
        for (const sz of [1, -1]) {
            quad([sx * a, b - e, sz * (c - e)], [sx * a, -(b - e), sz * (c - e)], [sx * (a - e), -(b - e), sz * c], [sx * (a - e), b - e, sz * c]);
        }
    }
    for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
            quad([a - e, sy * b, sz * (c - e)], [-(a - e), sy * b, sz * (c - e)], [-(a - e), sy * (b - e), sz * c], [a - e, sy * (b - e), sz * c]);
        }
    }
    for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
            for (const sz of [1, -1]) {
                triangles.push([[sx * a, sy * (b - e), sz * (c - e)], [sx * (a - e), sy * b, sz * (c - e)], [sx * (a - e), sy * (b - e), sz * c]]);
            }
        }
    }
    // Every face turned to look outward (the box is convex about its centre).
    const positions = [];
    const p = new Vector3();
    const q = new Vector3();
    const r = new Vector3();
    const normal = new Vector3();
    for (const [first, second, third] of triangles) {
        p.fromArray(first);
        q.fromArray(second);
        r.fromArray(third);
        normal.subVectors(q, p).cross(r.clone().sub(p));
        const centroid = p.clone().add(q).add(r);
        if (normal.dot(centroid) < 0) positions.push(...first, ...third, ...second);
        else positions.push(...first, ...second, ...third);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
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
    // (Each weathered as the years would have it: see weather(). The cafés' brick has its own, places.js.
    // ?ageing=off leaves the city as it was built, to compare.)
    const ageing = new URLSearchParams(globalThis.location?.search ?? '').get('ageing') !== 'off';
    const weathered = (material, look) => (ageing ? weather(material, look) : material);
    return {
        /** The halls and houses, the great golden trees: a tarnish in patches, moss where the sun never comes. */
        gold: weathered(toon({ emissive: 0x8a7424, emissiveIntensity: 0.3 }), {
            mottle: 0.8, streaks: 0.75, damp: 0.7, moss: 0.55, salt: 0.25, age: 0.38, tint: 0x6e6440, seed: 0.13,
        }),
        /** The golden bridges between the buildings (places.js): gold of their own, which comes apart into dust. */
        bridge: toon({ emissive: 0x8a7424, emissiveIntensity: 0.32, side: DoubleSide }),
        /** The sea-wall's golden bricking: salted and weeded low down, where the sea "erupts" against it. */
        bricking: weathered(bricks(toon({ emissive: 0x8a7424, emissiveIntensity: 0.28 })), {
            mottle: 0.6, streaks: 0.85, damp: 0.6, moss: 0.7, salt: 0.9, age: 0.3, tint: 0x6a6a48, seed: 0.41,
        }),
        /** The ground and its paving (streets, platforms, the jetty): flagstones, in the bricking's bond; stained. */
        dimGold: weathered(hatched(bricks(toon({ emissive: 0x3a2a0c, emissiveIntensity: 0.4 }), { length: 1.1, height: 0.5 })), {
            mottle: 0.75, salt: 0.2, age: 0.42, tint: 0x5a4a34, seed: 0.77,
        }),
        brick: toon({}),
        /** Stone: lichen in pale patches, damp at the foot. */
        stone: weathered(toon({}), {
            mottle: 0.7, streaks: 0.6, damp: 0.6, moss: 0.6, salt: 0.4, age: 0.4, tint: 0xb8b890, seed: 0.29,
        }),
        /** The island's underside (and the hanging mountain): rock striated top to bottom, as Elm draws her islands. */
        rock: striated(toon({}), {
            colors: [0x7c5e5c, 0x86665a, 0x76606a, 0x8e705e, 0x6e5c64],
            deep: 0x2e2438,
            reach: CLIFF_DEPTH + UNDERSIDE_DEPTH,
        }),
        /** Steel: caked here and there, as the Steel Garden's is, "all bluish-green". */
        steel: weathered(toon({}), {
            mottle: 0.5, streaks: 0.5, damp: 0.4, moss: 0.3, salt: 0.3, age: 0.3, tint: 0x4a7a70, seed: 0.53,
        }),
        turquoise: toon({ emissive: 0x1a8a84, emissiveIntensity: 0.6, side: DoubleSide }),
        /** Seaweed at the shore and the vines of the plazas: green things, swaying a little. */
        weed: toon({ emissive: 0x0e2a18, emissiveIntensity: 0.5, side: DoubleSide }),
        /** The amethystine trash chute. */
        amethyst: toon({ transparent: true, opacity: 0.78, emissive: 0x5a2496, emissiveIntensity: 0.6 }),
        glass: toon({ transparent: true, opacity: 0.3, emissive: 0x3a5a62, emissiveIntensity: 0.35, side: DoubleSide }),
        arch: toon({ emissive: 0x5a6878, emissiveIntensity: 0.45 }),
        /** The dressing's cloth (places.js): the market's awnings and skirts and goods, the halls' banners. */
        cloth: weathered(toon({ side: DoubleSide, emissive: 0x2a1c12, emissiveIntensity: 0.3 }), {
            mottle: 0.6, streaks: 0.3, damp: 0.3, age: 0.2, tint: 0x8a7a60, seed: 0.87,
        }),
        /** Green things that stand or lie still: the park's lawn and hedges, the plants in their pots; drawn shadows. */
        green: weathered(hatched(toon({ emissive: 0x0e2a18, emissiveIntensity: 0.35 })), {
            mottle: 0.9, age: 0.3, tint: 0x7a8a44, seed: 0.33,
        }),
        /** Copper: verdigris gathering in patches and running down from it. */
        copper: weathered(toon({ emissive: 0x4a1c08, emissiveIntensity: 0.4 }), {
            mottle: 0.5, streaks: 0.6, damp: 0.3, moss: 0.2, salt: 0.2, age: 0.75, tint: 0x5e9c88, seed: 0.61,
        }),
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
export function alsoBeforeCompile(material, name, change) {
    const before = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer);
        change(shader, renderer);
    };
    material.customProgramCacheKey = () => `${key}|${name}`;
}

/**
 * The rock, striated top to bottom, as Elm's pencil draws her islands'
 * undersides: fine strokes falling down the rock, each broken and pressed in
 * its own way, a darker cleft now and then, the rock's colours laid in long
 * vertical streaks, and all of it darkening toward the belly's lowest point.
 * The strokes are counted round the island's middle, so they fall straight
 * down the curtain and gather toward the middle of the belly, as a pencil's
 * would; and they're let go before they crowd, so from far off the rock is a
 * wash, not a moiré. Laid per pixel; the vertex colour still tints it, so a
 * piece can be warmer or cooler than the rest.
 * @param {import('three').Material} material
 * @param {object} options
 * @param {number[]} options.colors - the streaks' colours (hex), repeating
 * @param {number} options.deep - the colour the deepest rock goes to
 * @param {number} options.reach - how deep (below y = 0) the rock goes
 */
export function striated(material, { colors, deep, reach }) {
    const streaks = colors.map((hex) => new Color(hex));
    // Streaks and strokes are counted in whole numbers per turn (multiples of the colours), so a turn closes.
    const count = streaks.length;
    const mean = streaks.reduce((sum, color) => sum.add(color), new Color(0, 0, 0)).multiplyScalar(1 / count);
    alsoBeforeCompile(material, `striae${count}`, (shader) => {
        shader.uniforms.striaeColors = { value: streaks };
        shader.uniforms.striaeMean = { value: mean };
        shader.uniforms.striaeDeep = { value: new Color(deep) };
        shader.uniforms.striaeReach = { value: reach };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vStriaePosition;\nvarying vec3 vStriaeNormal;')
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                'vStriaePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
                'vStriaeNormal = mat3(modelMatrix) * objectNormal;',
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', [
                '#include <common>',
                `uniform vec3 striaeColors[${count}];`,
                'uniform vec3 striaeMean;',
                'uniform vec3 striaeDeep;',
                'uniform float striaeReach;',
                'varying vec3 vStriaePosition;',
                'varying vec3 vStriaeNormal;',
                'float striaeHash(vec2 p) {',
                '    vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
                '    p3 += dot(p3, p3.yzx + 33.33);',
                '    return fract((p3.x + p3.y) * p3.z);',
                '}',
                'float striaeNoise(vec2 p) {',
                '    vec2 i = floor(p);',
                '    vec2 f = fract(p);',
                '    vec2 u = f * f * (3.0 - 2.0 * f);',
                '    return mix(mix(striaeHash(i), striaeHash(i + vec2(1.0, 0.0)), u.x),',
                '        mix(striaeHash(i + vec2(0.0, 1.0)), striaeHash(i + vec2(1.0, 1.0)), u.x), u.y);',
                '}',
                '/** Strokes counted round the middle: how much ink a family of them lays here (0 to 1). */',
                'float striaeStrokes(float around, float turnWidth, float perTurn, vec3 p, float wanders, float sway, float nib, float breaks, float seed) {',
                '    // They waver with the rock (a noise of where they are, so a turn closes with no seam).',
                '    float u = around * perTurn + (striaeNoise(p.xz * 0.35 + vec2(p.y * wanders, seed)) - 0.5) * sway;',
                '    float id = floor(u);',
                '    float h = striaeHash(vec2(id, seed));',
                '    float pixel = max(turnWidth * perTurn, 1e-4);',
                '    float width = nib * (0.7 + 0.6 * h);',
                '    float line = 1.0 - smoothstep(width, width + pixel, abs(fract(u) - 0.5));',
                '    // Each is broken along its length, into strokes of its own length.',
                '    float present = smoothstep(breaks, breaks + 0.22, striaeNoise(vec2(id * 0.53 + seed, p.y * (0.1 + 0.28 * h) + h * 19.0)));',
                '    // Let go before they crowd (under about three pixels apart).',
                '    float drawn = 1.0 - smoothstep(0.22, 0.45, pixel);',
                '    return line * present * drawn * (0.55 + 0.45 * h);',
                '}',
            ].join('\n'))
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                '{',
                '    vec3 p = vStriaePosition;',
                '    float depth = -p.y;',
                '    float around = atan(p.z, p.x) / 6.28318530718;',
                '    // How far a pixel reaches round the middle (across the half-turn seam, the short way round).',
                '    vec2 stride = vec2(dFdx(around), dFdy(around));',
                '    stride -= floor(stride + 0.5);',
                '    float turnWidth = abs(stride.x) + abs(stride.y);',
                '    // Long vertical streaks of the rock\'s colours, meeting softly.',
                `    float streak = around * ${count * 18}.0 + striaeNoise(p.xz * 0.12 + vec2(p.y * 0.05, 3.0)) * 1.6;`,
                '    float band = floor(streak);',
                `    int index = int(mod(band, ${count}.0));`,
                `    int next = int(mod(band + 1.0, ${count}.0));`,
                '    vec3 rock = mix(striaeColors[index], striaeColors[next], smoothstep(0.55, 1.0, fract(streak)));',
                '    // Fine strokes, many; and a darker cleft now and then, longer and wandering further.',
                '    float ink = striaeStrokes(around, turnWidth, 520.0, p, 0.3, 0.4, 0.1, 0.4, 3.7) * 0.3;',
                '    ink = max(ink, striaeStrokes(around, turnWidth, 65.0, p, 0.09, 1.0, 0.022, 0.5, 11.3) * 0.55);',
                '    // The pencil falls down the rock\'s sides; on faces turned to the ground it lies quieter.',
                '    float hanging = smoothstep(0.35, 0.85, -normalize(vStriaeNormal).y);',
                '    rock = mix(rock, striaeMean, hanging * 0.7);',
                '    ink *= 1.0 - 0.65 * hanging;',
                '    rock = mix(rock, striaeDeep, min(0.72, max(depth, 0.0) / striaeReach * 0.85));',
                '    diffuseColor.rgb *= rock * (1.0 - ink);',
                '}',
            ].join('\n'));
    });
    return material;
}

/**
 * Shadows drawn, not only darkened: where the key light's shadow falls on
 * this material, the pen hatches it in fine parallel strokes, as an engraver
 * shades (the shadow itself is drawn once, by stage.js). The strokes keep an
 * even width on screen and are let go before they crowd, so far off the shadow
 * is a plain wash; near, it is lines. Only the first directional light's
 * shadow is read (the key: three.js puts shadow-casting lights first).
 * @param {import('three').Material} material
 * @param {object} [options]
 * @param {number} [options.spacing] - between strokes, in world units
 * @param {number} [options.angle] - the strokes' direction across the ground (radians)
 * @param {number} [options.ink] - how dark a stroke is laid (0 to 1)
 */
export function hatched(material, { spacing = 0.2, angle = 0.8, ink = 0.55 } = {}) {
    alsoBeforeCompile(material, 'hatched', (shader) => {
        shader.uniforms.hatchAcross = { value: new Vector2(Math.cos(angle), Math.sin(angle)).divideScalar(spacing) };
        shader.uniforms.hatchInk = { value: ink };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vHatchPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHatchPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec2 hatchAcross;\nuniform float hatchInk;\nvarying vec3 vHatchPosition;')
            .replace('#include <opaque_fragment>', [
                '#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0',
                '{',
                '    float inLight = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, 1.0,',
                '        directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );',
                '    float shade = smoothstep(0.75, 0.25, inLight) * float( receiveShadow );',
                '    float across = dot(vHatchPosition.xz, hatchAcross);',
                '    // A stroke wavers a little along its length, as a hand-laid line does.',
                '    across += sin(dot(vHatchPosition.xz, vec2(-hatchAcross.y, hatchAcross.x)) * 1.7) * 0.08;',
                '    float width = max(fwidth(across), 1e-4);',
                '    float stroke = 1.0 - smoothstep(0.0, width * 1.2 + 0.12, abs(fract(across) - 0.5));',
                '    float drawn = 1.0 - smoothstep(0.18, 0.4, width);',
                '    outgoingLight *= 1.0 - shade * stroke * drawn * hatchInk;',
                '}',
                '#endif',
                '#include <opaque_fragment>',
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

// =============================================================================
// Weathering: the city as the years have left it
// =============================================================================

let wornMapTexture = null;

/**
 * The weathering's noise, made once: four tiling noises in one small texture,
 * read a few times a pixel (cheaper than working noise out in the shader).
 * r: broad mottling; g: streaks (fine across, long up, for grime running down
 * a wall); b: fine tufts; a: patches.
 */
function wornMap() {
    if (wornMapTexture) return wornMapTexture;
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    // Value noise on a lattice that wraps (period cells across the texture), so the texture tiles seamlessly.
    const lattice = (ix, iy, period, seed) => {
        const x = ((ix % period.x) + period.x) % period.x;
        const y = ((iy % period.y) + period.y) % period.y;
        let h = Math.imul(x + seed * 131, 374761393) ^ Math.imul(y + seed * 71, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const noise = (u, v, period, seed) => {
        const x = u * period.x;
        const y = v * period.y;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const a = lattice(ix, iy, period, seed);
        const b = lattice(ix + 1, iy, period, seed);
        const c = lattice(ix, iy + 1, period, seed);
        const d = lattice(ix + 1, iy + 1, period, seed);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const fbm = (u, v, base, octaves, seed) => {
        let sum = 0;
        let weight = 0;
        for (let octave = 0, amount = 1, cells = base; octave < octaves; octave += 1, amount *= 0.5, cells *= 2) {
            sum += amount * noise(u, v, { x: cells, y: cells }, seed + octave * 17);
            weight += amount;
        }
        return sum / weight;
    };
    const channels = [new Float32Array(size * size), new Float32Array(size * size), new Float32Array(size * size), new Float32Array(size * size)];
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            const u = col / size;
            const v = row / size;
            const at = row * size + col;
            channels[0][at] = fbm(u, v, 4, 3, 1);
            // Streaks: narrow ones across, each long up the texture, broken along its length, some finer beside.
            channels[1][at] = noise(u, v, { x: 16, y: 2 }, 5) * 0.7 + noise(u, v, { x: 32, y: 5 }, 9) * 0.3;
            channels[2][at] = fbm(u, v, 16, 2, 23);
            channels[3][at] = fbm(u, v, 3, 3, 41);
        }
    }
    // Each stretched to the whole range, so a threshold in the shader means the same share of the surface.
    channels.forEach((channel, index) => {
        let low = Infinity;
        let high = -Infinity;
        for (const value of channel) {
            low = Math.min(low, value);
            high = Math.max(high, value);
        }
        for (let at = 0; at < channel.length; at += 1) data[at * 4 + index] = Math.round(((channel[at] - low) / Math.max(high - low, 1e-6)) * 255);
    });
    const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    wornMapTexture = texture;
    return texture;
}

/**
 * Weather a material, as the years would (Elm: "spread the ageing", after the
 * cafés): laid on its colour before the light falls on it, as a painter
 * weathers a wall, with the world's own place for every mark, so it runs on
 * across pieces as one surface does. A brush's mottling, warmer and cooler;
 * grime in streaks down the walls; damp rising at their feet; moss on the
 * faces turned north, in fine tufts at the foot, and in patches on ledges and
 * roofs; a bloom of salt low over the sea; and patches of the material's own
 * ageing (a tarnish on gold, verdigris on copper, lichen on stone, stains on
 * the paving), darkening its colour rather than painting over it, so a dark
 * window stays dark. Nothing is added to what a vertex hands on: the place
 * and the facing are found again from the view (the pixel's view position,
 * and its normal, turned back into the world).
 * @param {import('three').Material} material
 * @param {object} look - each 0 to 1
 * @param {number} [look.mottle]
 * @param {number} [look.streaks]
 * @param {number} [look.damp]
 * @param {number} [look.moss]
 * @param {number} [look.salt]
 * @param {number} [look.age] - how much of the material's own ageing
 * @param {number} look.tint - its colour (hex): where it gathers, the colour goes toward this, kept as dark
 * @param {number} [look.seed] - so no two materials weather alike
 */
export function weather(material, { mottle = 0, streaks = 0, damp = 0, moss = 0, salt = 0, age = 0, tint = 0x807060, seed = 0 }) {
    const uniforms = {
        wornMap: { value: wornMap() },
        wornLook: { value: new Vector4(mottle, streaks, damp, moss) },
        wornMore: { value: new Vector4(salt, age, seed, 0) },
        wornTint: { value: new Color(tint) },
    };
    alsoBeforeCompile(material, 'weathered', (shader) => {
        Object.assign(shader.uniforms, uniforms);
        // (Laid just before main, where the view position and the normal have been declared.)
        shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', `${WORN_GLSL}\nvoid main() {`)
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = cityWorn(diffuseColor.rgb);');
    });
    return material;
}

const WORN_GLSL = /* glsl */ `
    uniform sampler2D wornMap;
    uniform vec4 wornLook;
    uniform vec4 wornMore;
    uniform vec3 wornTint;
    vec3 cityWorn(vec3 albedo) {
        // Where this pixel is in the world, and which way it faces there, found again from the view.
        mat3 back = transpose(mat3(viewMatrix));
        vec3 p = cameraPosition + back * (-vViewPosition);
        #ifdef FLAT_SHADED
            vec3 n = normalize(back * cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        #else
            vec3 n = normalize(back * vNormal);
        #endif
        float upright = 1.0 - smoothstep(0.4, 0.7, abs(n.y));
        // Along a wall's run and up it; across a roof or the ground.
        float along = abs(n.x) > abs(n.z) ? p.z : p.x;
        vec2 face = upright > 0.5 ? vec2(along, p.y) : p.xz;
        // How high above the ground (as the ground rises gently to the west; near enough for a wall's foot).
        float h = p.y - max(0.0, -p.x - 4.0) * 0.055;
        float seed = wornMore.z;
        vec4 broad = texture2D(wornMap, face * 0.085 + seed);
        float streaked = texture2D(wornMap, vec2(face.x * 0.16, face.y * 0.05) + seed * 1.7).g;
        vec4 close = texture2D(wornMap, face * 0.55 + seed * 2.3);
        float tuft = close.b;
        vec3 base = albedo;
        // A brush's mottling, lighter and darker, warmer and cooler: fine over broad, as a painter's is.
        float m = 0.6 * close.r + 0.4 * broad.r;
        albedo *= 1.0 + wornLook.x * (m - 0.5) * 0.5;
        albedo *= mix(vec3(1.0), mix(vec3(0.92, 0.99, 1.1), vec3(1.08, 0.99, 0.86), m), wornLook.x);
        // Grime running down the walls in streaks from each ledge (a hall's storey line, 1.5 apart from 2.25
        // up), strongest just beneath it and fading as it runs; gathered in a band under the ledge itself; and
        // more where the patches are.
        float hang = fract((h - 0.75) / 1.5);
        float streak = smoothstep(0.6, 0.88, streaked) * upright * (0.25 + 0.75 * hang * hang) * (0.45 + 0.55 * broad.a);
        float under = smoothstep(0.82, 1.0, hang) * upright * step(1.5, h);
        albedo *= 1.0 - wornLook.y * (0.5 * streak + 0.22 * under);
        // Damp rising at a wall's foot, to a height that wanders.
        float rise = 0.35 + 0.6 * broad.b;
        albedo *= 1.0 - wornLook.z * 0.34 * upright * (1.0 - smoothstep(rise * 0.35, rise, h));
        // Moss: in fine tufts at the foot of the faces turned north, and in patches on ledges and roofs.
        float north = max(0.0, -n.z);
        float tufts = smoothstep(0.55, 0.78, tuft) * (1.0 - smoothstep(0.1, 1.2, h));
        float ledge = smoothstep(0.75, 0.95, n.y) * smoothstep(0.5, 0.9, h) * smoothstep(0.6, 0.8, broad.b * 0.5 + tuft * 0.5);
        float moss = clamp(north * upright * tufts + ledge * (0.45 + 0.55 * north), 0.0, 0.85);
        albedo = mix(albedo, vec3(0.27, 0.34, 0.19) * (0.8 + 0.4 * broad.r), wornLook.w * moss);
        // Salt, low over the sea: a pale bloom in the tufts' pattern.
        float low = 1.0 - smoothstep(0.2, 2.0, p.y + 0.6);
        albedo = mix(albedo, vec3(0.9, 0.88, 0.82), wornMore.x * upright * low * smoothstep(0.45, 0.8, tuft) * 0.65);
        // Its own ageing, in patches: toward the tint, kept as dark as it was.
        float patches = smoothstep(0.6, 0.85, broad.a) * (0.6 + 0.4 * tuft);
        float lightness = dot(base, vec3(0.3, 0.59, 0.11));
        vec3 aged = wornTint * lightness / max(dot(wornTint, vec3(0.3, 0.59, 0.11)), 1e-3);
        albedo = mix(albedo, aged, wornMore.y * patches);
        return albedo;
    }
`;

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
