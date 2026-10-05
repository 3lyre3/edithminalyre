/**
 * flowers.js — President Oedipus's flowers (a trial: trials.js, 'plants').
 *
 * Elm: "a succession of flowers around the city that wilt when you open them and they're all sections of president
 * oedipus, but you gotta click them in order". The essay divides itself into five parts with its own ". . ."
 * (essays/president-oedipus.html, #part-1 to #part-5, its note with the last), and each flower holds one, whole
 * (main.js reads them from that page). Only the flower in bloom opens: those still to come wait as buds, and a bud
 * that's touched shivers while the bloom glints, wherever it stands. Opened, a flower wilts (its petals droop and
 * darken, its stem bows), and the next bud along unfurls. Each is its own impossible bloom (the essay quotes Laboria
 * Cuboniks: "let a hundred sexes bloom"); the last floats on the bay at the edge, among the star fence's lanterns.
 *
 * All five are one mesh in the city's toon light (their petals turned in the vertex shader, so the ink outlines them
 * as they move), their shades one more, their glints a few points: three draw calls, some 1,800 triangles.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    Color,
    CustomBlending,
    DoubleSide,
    DstColorFactor,
    Float32BufferAttribute,
    BufferGeometry,
    CircleGeometry,
    Mesh,
    MeshToonMaterial,
    Points,
    ShaderMaterial,
    MathUtils,
    SphereGeometry,
    Vector2,
    Vector3,
    Vector4,
    ZeroFactor,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRAWN } from './ink.js';
import { alsoBeforeCompile, paint, pose, taperedTube } from './kit.js';
import { SWELL_GLSL } from './sea.js';
import { SEA_LEVEL, rimRadiusGLSL } from './shape.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * The five blooms, each its own (petals: how many; tilt: how far they rise from the heart when open, in radians, so
 * the bloom is a cup that shows its face; length and width in metres; cup: how much each petal cups across; lift: how
 * far its tip curves up; round: fuller toward 0, pointed toward 1; base/tip: its colours from the heart out; stem: the
 * bloom's height; leaves; inner: a second ring, the lotus's).
 */
const BLOOMS = {
    // The gas station's: five broad petals, coral going to pale gold.
    coral: { petals: 5, tilt: 0.42, length: 0.52, width: 0.43, cup: 0.35, lift: 0.3, round: 0.55, base: 0xe0654c, tip: 0xf6cd94, heart: 0xe2a12b, heartSize: 0.095, stem: 2.2, girth: 0.05, stemColor: 0x3c6b35, leaves: 2, leafColor: 0x4c8a3e },
    // The sun-dock's: nine slender petals, sun-white to honey, on a reed out of its light.
    sun: { petals: 9, tilt: 0.14, length: 0.55, width: 0.17, cup: 0.15, lift: 0.2, round: 0.45, base: 0xfff1c6, tip: 0xf0ad40, heart: 0xd57f26, heartSize: 0.09, stem: 1.85, girth: 0.04, stemColor: 0xa99a52, leaves: 1, leafColor: 0xb7a95c },
    // The Steel Garden's: six pointed petals, violet with silver tips, the tallest.
    steel: { petals: 6, tilt: 0.5, length: 0.58, width: 0.28, cup: 0.25, lift: 0.36, round: 0.85, base: 0x6b3d96, tip: 0xdcdfea, heart: 0x8ea2b6, heartSize: 0.1, stem: 2.45, girth: 0.05, stemColor: 0x55706a, leaves: 2, leafColor: 0x5f8c86 },
    // The cafés' quay's: seven crimson petals, ruffled, the cafés' roofs in flower.
    crimson: { petals: 7, tilt: 0.45, length: 0.5, width: 0.34, cup: 0.42, lift: 0.24, round: 0.6, ruffle: 0.05, base: 0xa62335, tip: 0xf3908a, heart: 0xf2e3b9, heartSize: 0.095, stem: 2.05, girth: 0.05, stemColor: 0x3f6a36, leaves: 2, leafColor: 0x4f8840 },
    // The edge's: a water flower on its own pad, two rings, the rim crystals' pink and cyan.
    lotus: { petals: 8, tilt: 0.32, length: 0.55, width: 0.28, cup: 0.45, lift: 0.55, round: 0.7, base: 0xf2b2cf, tip: 0xfffafc, heart: 0xe9b74a, heartSize: 0.1, stem: 0.3, leaves: 0, inner: { petals: 6, length: 0.4, width: 0.23, base: 0xaeeee8, tip: 0xfdfffe }, pad: 0x2e7a68, padSize: 1.05 },
};

/** The shade under each (a soft dark on what it stands on, multiplied in): how wide, how dark. */
const SHADE_RADIUS = 0.75;
const SHADE_DARK = 0.42;

/** How long a wilt, an unfurling, a shiver and a glint take (seconds). */
const WILT_SECONDS = 2.4;
const UNFURL_SECONDS = 2.8;
const UNFURL_AFTER = 1.2;
const SHIVER_SECONDS = 0.9;
const GLINT_SECONDS = 2.2;

/** The kinds of vertex the shader moves differently. */
const STEM = 0;
const PETAL = 1;
const INNER = 2;
const HEART = 3;
const PAD = 4;

// =============================================================================
// Geometry
// =============================================================================

/**
 * One petal (or a leaf), lying out along +x from the bloom's middle at the origin: cupped across, its tip curving up.
 * Carries `aT`, how far along it each vertex is (0 at its base, 1 at its tip).
 */
function bladeGeometry({ length, width, cup = 0.3, lift = 0.3, round = 0.6, ruffle = 0, base, tip }) {
    const ALONG = 5;
    const positions = [];
    const colors = [];
    const along = [];
    const from = new Color(base);
    const to = new Color(tip);
    const color = new Color();
    const point = (u, v) => {
        const half = (width / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), round);
        const x = length * u;
        const z = v * half;
        const y = lift * length * u * u + cup * half * v * v + ruffle * Math.sin(v * 3 * Math.PI + u * 5) * u;
        return [x, y, z];
    };
    for (let i = 0; i < ALONG; i += 1) {
        const u0 = i / ALONG;
        const u1 = (i + 1) / ALONG;
        for (const [v0, v1] of [[-1, 0], [0, 1]]) {
            const quad = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
                for (const [u, v] of [quad[a], quad[b], quad[c]]) {
                    positions.push(...point(u, v));
                    color.copy(from).lerp(to, Math.pow(u, 1.4));
                    colors.push(color.r, color.g, color.b);
                    along.push(u);
                }
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aT', new Float32BufferAttribute(along, 1));
    geometry.computeVertexNormals();
    return geometry;
}

/** Give every vertex of a piece the attributes the flowers' shader reads (the same for the whole piece). */
function tag(geometry, { flower, kind, axis = [0, 0, 0], pivot, base, droop, tilt = 0, floats = false }) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const count = flat.attributes.position.count;
    const fill = (size, values) => {
        const array = new Float32Array(count * size);
        for (let index = 0; index < count; index += 1) array.set(values, index * size);
        return new Float32BufferAttribute(array, size);
    };
    if (!flat.attributes.aT) flat.setAttribute('aT', fill(1, [0]));
    // (Which flower, what kind of piece, how far its petal is tilted up when open (the hinge's rest), and whether it
    // floats on the water.)
    flat.setAttribute('aWhat', fill(4, [flower, kind, tilt, floats ? 1 : 0]));
    flat.setAttribute('aAxis', fill(3, axis));
    flat.setAttribute('aPivot', fill(3, pivot));
    flat.setAttribute('aBase', fill(3, base));
    flat.setAttribute('aDroop', fill(3, droop));
    for (const name of Object.keys(flat.attributes)) {
        if (!['position', 'normal', 'color', 'aT', 'aWhat', 'aAxis', 'aPivot', 'aBase', 'aDroop'].includes(name)) flat.deleteAttribute(name);
    }
    if (!flat.attributes.normal) flat.computeVertexNormals();
    return flat;
}

/** A ring of petals round a bloom's middle, each with the hinge it turns on (the bud closes them up, a wilt lets them
 * down). */
function petalRing(pieces, { flower, kind, blade, count, spin, pivot, base, droop, tilt = 0, floats = false }) {
    for (let index = 0; index < count; index += 1) {
        const theta = spin + (index / count) * Math.PI * 2;
        const petal = bladeGeometry(blade);
        // (Tilted up from the heart, so the bloom is a cup that shows its face to an eye above it.)
        pose(petal, { rz: tilt, ry: theta, x: pivot[0], y: pivot[1], z: pivot[2] });
        pieces.push(tag(petal, { flower, kind, axis: [Math.sin(theta), 0, Math.cos(theta)], pivot, base, droop, tilt, floats }));
    }
}

/** One flower, standing on (or floating at) `at`, in the city's own coordinates. */
function flowerPieces(flower, index) {
    const bloom = BLOOMS[flower.bloom] ?? BLOOMS.coral;
    const base = flower.floats ? [flower.at[0], SEA_LEVEL, flower.at[2]] : flower.at;
    const pivot = [base[0], base[1] + bloom.stem, base[2]];
    const droop = [Math.sin(flower.droop ?? 0), 0, Math.cos(flower.droop ?? 0)];
    const spin = index * 0.9;
    const pieces = [];
    const common = { flower: index, pivot, base, droop, floats: Boolean(flower.floats) };
    if (flower.floats) {
        // Its pad, on the water (riding the swell: the shader), a notch let into it as a lily pad has.
        const pad = new CircleGeometry(bloom.padSize, 18, 0.35, Math.PI * 2 - 0.7);
        pose(pad, { rx: -Math.PI / 2, x: base[0], y: base[1] + 0.03, z: base[2] });
        paint(pad, bloom.pad);
        pieces.push(tag(pad, { ...common, kind: PAD }));
    } else {
        // Its stem, a little crooked, and its leaves.
        const lean = (flower.droop ?? 0) + 0.6;
        const points = [
            new Vector3(0, 0, 0),
            new Vector3(Math.sin(lean) * 0.03, bloom.stem * 0.36, Math.cos(lean) * 0.03),
            new Vector3(-Math.sin(lean) * 0.025, bloom.stem * 0.72, -Math.cos(lean) * 0.025),
            new Vector3(0, bloom.stem, 0),
        ];
        const stem = taperedTube(points, bloom.girth, bloom.girth * 0.55, bloom.stemColor, 7, 5);
        pose(stem, { x: base[0], y: base[1], z: base[2] });
        pieces.push(tag(stem, { ...common, kind: STEM }));
        for (let leaf = 0; leaf < bloom.leaves; leaf += 1) {
            const blade = bladeGeometry({ length: bloom.stem * 0.2, width: bloom.stem * 0.062, cup: 0.4, lift: 0.5, round: 0.7, base: bloom.leafColor, tip: new Color(bloom.leafColor).offsetHSL(0.03, 0, 0.12).getHex() });
            const theta = spin + 1.3 + leaf * 2.6;
            pose(blade, { rz: 0.45, ry: theta, x: base[0], y: base[1] + bloom.stem * (0.3 + leaf * 0.22), z: base[2] });
            pieces.push(tag(blade, { ...common, kind: STEM }));
        }
    }
    petalRing(pieces, { ...common, kind: PETAL, blade: bloom, count: bloom.petals, spin, tilt: bloom.tilt });
    if (bloom.inner) {
        petalRing(pieces, { ...common, kind: INNER, blade: { ...bloom, ...bloom.inner, lift: bloom.lift * 1.5 }, count: bloom.inner.petals, spin: spin + Math.PI / bloom.inner.petals, tilt: bloom.tilt + 0.3 });
    }
    // Its heart, a low dome of gold.
    const heart = new SphereGeometry(bloom.heartSize, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    pose(heart, { sy: 0.7, x: pivot[0], y: pivot[1] + 0.01, z: pivot[2] });
    paint(heart, bloom.heart);
    pieces.push(tag(heart, { ...common, kind: HEART }));
    return pieces;
}

// =============================================================================
// Materials
// =============================================================================

/** The flowers' material: the city's toon light; each flower's petals turned by its state (uFlowers: open, wilt,
 * shiver, glint), its stem bowed as it wilts, its colours darkened as it does, and its bloom breathing faintly. */
function flowerMaterial(gradientMap, uniforms) {
    const material = new MeshToonMaterial({ gradientMap, vertexColors: true, color: 0xffffff, side: DoubleSide });
    alsoBeforeCompile(material, 'flowers', (shader) => {
        shader.uniforms.uFlowers = uniforms.uFlowers;
        shader.uniforms.uTime = uniforms.uTime;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
attribute float aT;
attribute vec4 aWhat;
attribute vec3 aAxis;
attribute vec3 aPivot;
attribute vec3 aBase;
attribute vec3 aDroop;
uniform vec4 uFlowers[5];
uniform float uTime;
varying float vWilt;
varying float vGlow;
${rimRadiusGLSL()}
${SWELL_GLSL}
vec3 flowerTurn(vec3 v, vec3 k, float a) {
    return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
}
// How far a petal turns on its hinge from where it rests open (tilted up by aWhat.z): up into the bud, which is
// closed the same however the bloom cups, and down as it wilts, to the same droop.
float flowerHinge(vec4 state) {
    bool inner = aWhat.y > 1.5 && aWhat.y < 2.5;
    return (1.0 - state.x) * ((inner ? 1.15 : 1.4) - aWhat.z) - state.y * ((inner ? 0.95 : 1.3) + aWhat.z);
}`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float aFlower = aWhat.x;
float aKind = aWhat.y;
vec4 flowerState = uFlowers[int(aFlower + 0.5)];
bool flowerPetal = aKind > 0.5 && aKind < 2.5;
if (flowerPetal) objectNormal = flowerTurn(objectNormal, aAxis, flowerHinge(flowerState));`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
if (flowerPetal) {
    vec3 fromMiddle = transformed - aPivot;
    fromMiddle = flowerTurn(fromMiddle, aAxis, flowerHinge(flowerState));
    // (A wilting petal's tip curls under; a bud is held tight.)
    fromMiddle.y -= flowerState.y * 0.13 * aT * aT;
    fromMiddle *= mix(0.5, 1.0, flowerState.x) * mix(1.0, 0.86, flowerState.y);
    transformed = aPivot + fromMiddle;
}
// The stem bows as it wilts, the higher the more, carrying the bloom down with it.
float flowerTall = max(0.05, aPivot.y - aBase.y);
float flowerUp = clamp((transformed.y - aBase.y) / flowerTall, 0.0, 1.25);
transformed += aDroop * (flowerState.y * 0.42 * flowerTall * flowerUp * flowerUp);
transformed.y -= flowerState.y * 0.3 * flowerTall * flowerUp * flowerUp;
// A bud touched out of turn shivers, about its foot.
float flowerSway = flowerState.z * sin(uTime * 37.0 + aFlower * 1.7) * 0.07 * flowerUp;
transformed.xz += vec2(cos(aFlower * 2.1), sin(aFlower * 2.1)) * flowerSway;
vWilt = aKind > 3.5 ? flowerState.y * 0.35 : flowerState.y * (aKind < 0.5 ? 0.6 : 1.0);
// The bloom breathes (open, not yet wilted), and glints when it's called.
float flowerOpen = flowerState.x * (1.0 - flowerState.y);
vGlow = aKind > 0.5 && aKind < 3.5 ? flowerOpen * (0.62 + 0.38 * sin(uTime * 1.7 + aFlower)) * 0.24 + flowerState.w : 0.0;
// A flower on the water rides the swell (the sea's own, sea.js): its pad lies on it everywhere, its bloom rises and
// falls with the pad's middle.
if (aWhat.w > 0.5) {
    float flowerSea;
    vec2 flowerSlope;
    seaSwell(aKind > 3.5 ? transformed.xz : aBase.xz, uTime, flowerSea, flowerSlope);
    transformed.y += flowerSea;
}`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
varying float vWilt;
varying float vGlow;`)
            .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.36, 0.42) + vec3(0.03, 0.015, 0.0), vWilt);`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// (Its own colours lit from within, and warmed: a lamp's light, on the petals' own shape.)
totalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.3 + vec3(1.0, 0.8, 0.5) * vGlow * 0.22 + vec3(1.0, 0.84, 0.56) * max(0.0, vGlow - 0.3) * 0.3;`);
    });
    return material;
}

/** The shades: a soft dark under each flower standing on land, multiplied into what's beneath (the givers' shades are
 * made so too). (One on the water has its pad.) */
function shadeMesh(flowers) {
    const pieces = flowers.filter((flower) => !flower.floats).map((flower) => {
        const radius = SHADE_RADIUS;
        const disc = new CircleGeometry(radius, 20);
        const y = flower.at[1] + 0.008;
        pose(disc, { rx: -Math.PI / 2, x: flower.at[0], y, z: flower.at[2] });
        const flat = disc.toNonIndexed();
        const count = flat.attributes.position.count;
        const fade = new Float32Array(count);
        const centre = new Vector3(flower.at[0], y, flower.at[2]);
        const at = new Vector3();
        for (let index = 0; index < count; index += 1) {
            at.fromBufferAttribute(flat.attributes.position, index);
            fade[index] = 1 - Math.min(1, at.distanceTo(centre) / radius);
        }
        flat.setAttribute('aDark', new Float32BufferAttribute(fade, 1));
        for (const name of Object.keys(flat.attributes)) if (!['position', 'aDark'].includes(name)) flat.deleteAttribute(name);
        return flat;
    });
    const mesh = new Mesh(mergeGeometries(pieces, false), new ShaderMaterial({
        uniforms: { dark: { value: SHADE_DARK } },
        vertexShader: `attribute float aDark; varying float vDark;
void main() { vDark = aDark; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float dark; varying float vDark;
void main() { float shade = dark * smoothstep(0.0, 0.85, vDark); gl_FragColor = vec4(vec3(1.0 - shade), 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: DstColorFactor,
        blendDst: ZeroFactor,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    }));
    mesh.name = 'flower-shades';
    mesh.renderOrder = 1;
    return mesh;
}

/** The glints: a four-pointed star of light at a bloom when it's called, drawn no smaller than a few pixels however
 * far off, so it's seen across the city. */
function glintPoints(pivots, floating, uniforms) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(pivots.flatMap((pivot) => [pivot[0], pivot[1] + 0.05, pivot[2]]), 3));
    geometry.setAttribute('aFlower', new Float32BufferAttribute(pivots.map((_, index) => index), 1));
    geometry.setAttribute('aFloats', new Float32BufferAttribute(floating.map((floats) => (floats ? 1 : 0)), 1));
    const points = new Points(geometry, new ShaderMaterial({
        uniforms: { uFlowers: uniforms.uFlowers, uTime: uniforms.uTime, scale: uniforms.scale, uDrawn: uniforms.uDrawn },
        vertexShader: `attribute float aFlower; attribute float aFloats; uniform vec4 uFlowers[5]; uniform float uTime; uniform float scale; uniform float uDrawn; varying float vGlint;
${rimRadiusGLSL()}
${SWELL_GLSL}
void main() {
    vGlint = uFlowers[int(aFlower + 0.5)].w;
    vec3 at = position;
    // (On the water, it rides the swell with its bloom.)
    if (aFloats > 0.5) {
        float sea;
        vec2 slope;
        seaSwell(at.xz, uTime, sea, slope);
        at.y += sea;
    }
    vec4 view = modelViewMatrix * vec4(at, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = vGlint > 0.001 ? max(26.0 * uDrawn, 1.6 * scale / -view.z) * (0.6 + 0.6 * vGlint) : 0.0;
}`,
        fragmentShader: `varying float vGlint;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float rays = max(0.0, 1.0 - abs(p.x) * 7.0 - abs(p.y) * 0.9) + max(0.0, 1.0 - abs(p.y) * 7.0 - abs(p.x) * 0.9);
    float core = max(0.0, 1.0 - length(p) * 2.4);
    float light = (rays * 0.9 + core) * vGlint;
    if (light < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * light, light);
}`,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
    }));
    points.name = 'flower-glints';
    points.frustumCulled = false;
    points.renderOrder = 3;
    return points;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {object[]} options.flowers - from data/flowers.json: { part, place, at, droop, bloom, floats }
 * @param {Set<string>} options.read - the passages already read: a part read is a flower already wilted
 * @param {import('three').Texture} options.gradientMap - the city's toon steps
 * @param {object} options.stage - its renderer and camera, so a glint keeps its size on screen
 * @param {boolean} options.reducedMotion
 */
export function createFlowers({ flowers, read, gradientMap, stage, reducedMotion }) {
    const ordered = [...flowers].sort((a, b) => a.part - b.part);
    const idOf = (flower) => `po-part-${flower.part}`;
    const uniforms = {
        uFlowers: { value: ordered.map(() => new Vector4()) },
        uTime: { value: 0 },
        scale: { value: 400 },
        // (The city's picture over the screen's: ink.js DRAWN.)
        uDrawn: { value: 1 },
    };
    const pieces = ordered.flatMap((flower, index) => flowerPieces(flower, index));
    const mesh = new Mesh(mergeGeometries(pieces, false), flowerMaterial(gradientMap, uniforms));
    mesh.name = 'flowers';
    mesh.frustumCulled = false;
    const pivots = ordered.map((flower) => {
        const bloom = BLOOMS[flower.bloom] ?? BLOOMS.coral;
        const y = (flower.floats ? SEA_LEVEL : flower.at[1]) + bloom.stem;
        return [flower.at[0], y, flower.at[2]];
    });
    // Where each bloom is now (a wilting stem bows it down and over, as the shader does), and its body for a touch:
    // live, so the reading point and the touch follow a flower as it wilts.
    const heads = pivots.map((pivot) => new Vector3().fromArray(pivot));
    const bodies = ordered.map((flower, index) => ({
        center: new Vector3().fromArray(pivots[index]).add(new Vector3(0, flower.floats ? 0 : -0.3, 0)),
        radius: flower.floats ? 0.95 : 0.72,
    }));
    const bow = (index, wilt) => {
        const flower = ordered[index];
        const tall = Math.max(0.05, pivots[index][1] - (flower.floats ? SEA_LEVEL : flower.at[1]));
        const droop = flower.droop ?? 0;
        const head = heads[index].fromArray(pivots[index]);
        head.x += Math.sin(droop) * wilt * 0.42 * tall;
        head.z += Math.cos(droop) * wilt * 0.42 * tall;
        head.y -= wilt * 0.3 * tall;
        // (The bloom's middle hangs below its head once wilted; before, its body takes in the top of the stem.)
        bodies[index].center.copy(head);
        if (!flower.floats) bodies[index].center.y += -0.3 + wilt * 0.1;
    };
    const shades = ordered.some((flower) => !flower.floats) ? shadeMesh(ordered) : null;
    const glints = glintPoints(pivots, ordered.map((flower) => Boolean(flower.floats)), uniforms);

    // Each flower's state, eased toward where it's going: open (0 bud, 1 bloom), wilt (0..1), shiver, glint.
    const states = ordered.map((flower) => {
        const wilted = read.has(idOf(flower));
        return { flower, id: idOf(flower), open: wilted ? 1 : 0, wilt: wilted ? 1 : 0, shiver: 0, glint: 0, unfurlAt: null, wiltFrom: null };
    });
    const blooming = () => states.find((state) => !read.has(state.id)) ?? null;
    // (The first not yet read is in bloom from the start.)
    const first = blooming();
    if (first) first.open = 1;
    const byId = new Map(states.map((state) => [state.id, state]));
    const buffer = new Vector2();
    let clock = 0;

    const write = () => {
        states.forEach((state, index) => {
            uniforms.uFlowers.value[index].set(state.open, state.wilt, state.shiver, state.glint);
            bow(index, state.wilt);
        });
    };
    write();

    return {
        objects: [mesh, shades, glints].filter(Boolean),
        materials: [mesh.material],
        /** Whether a passage is one of the flowers' parts. */
        has: (id) => byId.has(id),
        /** Where a part's bloom is now (its point: hotspots.js reads it, as it reads a giver's, and follows it). */
        pointOf(id) {
            const index = states.findIndex((state) => state.id === id);
            return index >= 0 ? heads[index] : null;
        },
        /** Its body, for a touch anywhere on it: the bloom and the top of its stem (live: it follows the wilt). */
        bodyOf(id) {
            const index = states.findIndex((state) => state.id === id);
            return index >= 0 ? bodies[index] : null;
        },
        /** The part in bloom: the only one that opens, if any is left. */
        blooming: () => blooming()?.id ?? null,
        /** Whether a part opens now: it's in bloom, or it was opened before (a wilted flower can be read again). */
        opens: (id) => read.has(id) || blooming()?.id === id,
        /** What a flower is now: 'bud', 'bloom' or 'wilted' (for the list's words, and for tests). */
        stateOf(id) {
            if (read.has(id)) return 'wilted';
            return blooming()?.id === id ? 'bloom' : 'bud';
        },
        /** A bud touched out of turn: it shivers. */
        refuse(id) {
            const state = byId.get(id);
            if (state && !reducedMotion) state.shiver = 1;
        },
        /** The bloom glints, wherever it is (so a bud's refusal shows where to go). */
        glint(id) {
            const state = byId.get(id);
            if (state) state.glint = 1;
        },
        /**
         * A part has been opened: its flower wilts, and the next along unfurls (and glints as it opens). Call once the
         * part has been read (main.js marks it read first).
         */
        wilt(id) {
            const state = byId.get(id);
            if (!state || state.wiltFrom !== null || state.wilt >= 1) return;
            state.wiltFrom = clock;
            const next = blooming();
            if (next && next.open < 1) next.unfurlAt = clock + UNFURL_AFTER;
        },
        /**
         * Each frame: ease every flower toward its state. (Their own clock, from dt: the stage's `elapsed` stands still
         * for reduced motion, and the next flower must still come into bloom. `elapsed` is the water's time and the
         * breathing's.)
         */
        update(elapsed, dt) {
            clock += dt;
            uniforms.uTime.value = elapsed;
            stage.renderer.getDrawingBufferSize(buffer);
            // (In the city's picture's pixels, drawn smaller than the screen when the governor asks: ink.js DRAWN.)
            uniforms.scale.value = buffer.y * DRAWN.scale / (2 * Math.tan(MathUtils.degToRad(stage.camera.fov) / 2));
            uniforms.uDrawn.value = DRAWN.scale;
            for (const state of states) {
                if (state.wiltFrom !== null) {
                    state.wilt = reducedMotion ? 1 : Math.min(1, (clock - state.wiltFrom) / WILT_SECONDS);
                    if (state.wilt >= 1) state.wiltFrom = null;
                }
                if (state.unfurlAt !== null && clock >= state.unfurlAt) {
                    const t = reducedMotion ? 1 : Math.min(1, (clock - state.unfurlAt) / UNFURL_SECONDS);
                    state.open = t * t * (3 - 2 * t);
                    // (Opened out, it glints: the next is here.)
                    if (t >= 1) {
                        state.unfurlAt = null;
                        state.glint = Math.max(state.glint, 1);
                    }
                }
                state.shiver = Math.max(0, state.shiver - dt / SHIVER_SECONDS);
                state.glint = Math.max(0, state.glint - dt / GLINT_SECONDS);
            }
            write();
        },
        /** For tests: each flower's id, state and numbers. */
        snapshot: () => states.map((state) => ({ id: state.id, state: read.has(state.id) ? 'wilted' : blooming()?.id === state.id ? 'bloom' : 'bud', open: Number(state.open.toFixed(2)), wilt: Number(state.wilt.toFixed(2)) })),
    };
}
