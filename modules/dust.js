/**
 * dust.js — the city comes apart into gold dust where the camera passes: a trial (trials.js), on unless ?dust=off.
 *
 * Elm: "doooo you think it might be not too difficultly possible to make it so the fade to transparent golden dust
 * effect with the bridges can be expanded to work on everything, the ribbons, the wall, the buildings, etc? that
 * the camera might try to go through?" And then: "Can we make the dust more expansive so that we never lose sight
 * of the shadow nor any part of the shadow, please?" And: "some objects are contained by other objects, and the dust
 * may sometimes dissolve the outmost object even as the inner objects remain stable".
 *
 * Everything in the city learns the golden bridges' opening, which this grew from: every wall, roof, step and post,
 * the rock, the bridges themselves, and whatever stands within anything else (never a floor at or below the
 * shadow's own level, where it lies, nor the sea or the sky). It opens close about the camera's lens, and, while
 * walking, about the lines from the camera to the whole of the shadow (walk.js aims them: the one casting it; the
 * shadow along the ground, from its feet to its tip, or to the wall that catches it; and up that wall). Each line
 * stops a little short of where it's aimed, so the wall the shadow climbs stays whole, with the shadow on it. At an
 * opening's edge the surface turns to gold, grain by grain; past it, the surface is gone, with a narrow grain at the
 * edge (so the ink draws one line round the opening, not one round every speck), and its dust lingers there in its
 * shape (Elm: "a light lingering of dust there, like not enough dust that it'd be hard to see through but enough to
 * recognise the shape that's been semi dissolved? that was my original vision for all of it"): a faint gold haze
 * where the surface was, brighter along its outline, motes glinting in it, as the golden bridges' dust always was.
 * So the walking camera never climbs over whatever's in the way (walk.js): it stays low behind the shadow, and the
 * way opens, and what opened is still there to be seen, in dust.
 *
 * (The lingering dust is the surfaces drawn again, in light only, and only in the squares of the city an opening
 * reaches (cull): from far, when nothing is open, it costs nothing at all.)
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AddEquation,
    BackSide,
    Box3,
    BufferAttribute,
    BufferGeometry,
    CustomBlending,
    DoubleSide,
    DynamicDrawUsage,
    FrontSide,
    Group,
    Mesh,
    OneFactor,
    OneMinusSrcAlphaFactor,
    ShaderMaterial,
    Sphere,
    Vector2,
    Vector3,
    Vector4,
    ZeroFactor,
} from 'three';
import { alsoBeforeCompile, breathe } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** About the camera's lens: open within this far, whole again from this far (world units; walk.js brings these in when it comes close). */
export const NEAR_OPEN = 1.1;
export const NEAR_FADE = 3.0;
/**
 * About each line from the camera to the shadow: open within this far of it, whole again from this far; narrowing
 * as it nears what it's aimed at, to this and this there (so the walls beside the shadow, or the hum, stay standing:
 * a wall that's there should look it, Elm found, stuck against ones that weren't).
 */
const SIGHT_OPEN = 0.95;
export const SIGHT_FADE = 1.75;
const SIGHT_OPEN_NEAR = 0.5;
const SIGHT_FADE_NEAR = 1.0;
/** How many lines to the shadow there may be (walk.js): its feet (and the one casting it), its middle, its tip, up a wall. */
export const DUST_TARGETS = 4;
/** Floors (facing up) at most this far above the floor the shadow's on never come apart (a step is at most 0.5). */
const FLOOR_KEPT = 0.9;
/**
 * Nor does anything at all below this far above it: the foot of every wall stays, as a cut-away model's does, so
 * it's seen where the walls stand; and a kerb, a step or a platform's side never opens into a hole with the water
 * showing through it (Elm: "this juncture here at the gate is still very treacherous").
 */
const LOW_KEPT = 0.4;
/** How wide the gilded band at an opening's edge is (in the opening's own measure, 0 to 1), and how gold. */
const GILT_BAND = 0.1;
const GILT = 0.75;
/**
 * The dust that lingers where something has come apart, in its shape (Elm: "a light lingering of dust there, like
 * not enough dust that it'd be hard to see through but enough to recognise the shape that's been semi dissolved"):
 * a faint haze of gold where its surface was (this much light, added), brighter where the surface turns edge-on to
 * the eye, so its outline reads (up to this many times), and motes glinting in it (the brightest tenth of the
 * grain), as the golden bridges' dust always was.
 */
const LINGER_HAZE = 0.012;
const LINGER_OUTLINE = 0.07;
/**
 * The motes: points of gold fixed where the surface was, one in a share of the squares of this size laid across it
 * (world units), each a pixel or so across, twinkling at its own pace; this bright at most.
 */
const MOTE_CELL = 0.05;
const MOTE_SHARE = 0.36;
const MOTE_BRIGHT = 1.15;
/** At the opening's edge, the ink draws no line (ink.js reads it): so a surface fades into its dust, not cut off. */
const RIM = 0.07;
/**
 * The insides, black (a trial: ?inside=off), show only while walking, and only so far about the openings (this many
 * times their own reach), thinning out in grains toward it: what's seen through an opening, and nothing far from one.
 */
const INSIDE_REACH = 2.0;
/**
 * And they're drawn a hair behind wherever they lie: an inside shares its planes with what it stands on and what it
 * stands against (a wall's floor is the paving's top; its far side, a neighbour's face), and the two flickered black
 * and back as the eye moved, a phone's depth too coarse to part them (Elm's clips, 2 Oct: "z-fighting, flickering
 * surfaces"). Pushed back this far in depth (a share of the depth range: a few millimetres at a few metres, a few
 * centimetres at twenty), the surface that's really there is always the one seen; nothing else moves on the screen.
 */
const INSIDE_BEHIND = 1e-4;
/** Nothing lingers on the lens itself: the dust is whole only this far out from it (world units). */
const LINGER_LENS = [0.3, 1.0];
/** The lingering dust is drawn only where it can be: the city in squares this wide, those near an opening. */
const LINGER_CELL = 12;
/**
 * The insides too are drawn only where they can show (Elm's ledger: whatever the visitor is to see "must pass through
 * the small machine in their hands"): each solid drawn again from behind, with its own shaders, in squares of the city
 * this wide (world units), and only in the squares an opening's insides reach (INSIDE_REACH times its own). Drawing
 * every solid from both sides while walking, as before, doubled the city's drawing on a weak graphics chip, and nearly
 * all of it was thrown away: the insides show only about the openings. What's seen is the same (but, now and then, a
 * grain or two at the very edge of where an inside thins out, whose own chance sits right on the line: a copy drawn
 * from behind is a program of its own, and its last digits fall a hair differently).
 */
const INSIDE_CELL = 6;
/**
 * What's drawn only for the insides is on a layer of its own: the city's camera draws it (stage.js), and nothing that
 * looks for the city along a ray (a touch, what hides a reading point) finds it.
 */
export const INSIDE_LAYER = 5;

/**
 * dustAt(world): how far into an opening a world point lies (0 whole, 1 wholly gone). dustNear: the lens's opening
 * (open, whole again). dustSight: the farthest any line reaches from the camera, squared (x: nothing further off
 * is looked at), the floor the one casting the shadow stands on (y), and 1 in w while walking. dustTargets: where the lines to the shadow are aimed (xyz),
 * each with how far short of it the line stops (w; below 0, no line). dustTime: seconds, for the glitter. (The
 * grain is a pixel's, two to a side.)
 */
const DUST_GLSL = /* glsl */ `
    uniform vec2 dustNear;
    uniform vec4 dustSight;
    uniform vec4 dustTargets[${DUST_TARGETS}];
    uniform float dustTime;
    varying vec3 vDustWorld;
    varying float vDustUp;
    float dustGrain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // (wide: the openings as they are, at 1, or that many times as wide, for what's seen through them.)
    float dustWithin(vec3 p, float wide) {
        float dust = 1.0 - smoothstep(dustNear.x * wide, dustNear.y * wide, distance(p, cameraPosition));
        vec3 fromLens = p - cameraPosition;
        if (dustSight.w > 0.5 && dot(fromLens, fromLens) < dustSight.x * wide * wide) {
            for (int i = 0; i < ${DUST_TARGETS}; i++) {
                vec4 target = dustTargets[i];
                if (target.w < 0.0) continue;
                vec3 ab = target.xyz - cameraPosition;
                float reach = max(length(ab), 1e-3);
                float t = clamp(dot(fromLens, ab) / (reach * reach), 0.0, 1.0);
                float off = distance(p, cameraPosition + ab * t);
                float stop = 1.0 - target.w / reach;
                float open = mix(${SIGHT_OPEN.toFixed(2)}, ${SIGHT_OPEN_NEAR.toFixed(2)}, t) * wide;
                float whole = mix(${SIGHT_FADE.toFixed(2)}, ${SIGHT_FADE_NEAR.toFixed(2)}, t) * wide;
                dust = max(dust, (1.0 - smoothstep(open, whole, off))
                    * smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(stop - 0.04, stop, t)));
            }
        }
        return dust;
    }
    float dustAt(vec3 p) { return dustWithin(p, 1.0); }
`;

/**
 * Whether the surface at a point has come apart (the city's own materials and the lingering dust decide it alike,
 * pixel for pixel): never a floor at or just above the shadow's level while walking, nor, not walking, any floor;
 * elsewhere, where the dust runs past an edge with a pixel's grain in it.
 */
const DUST_EDGE_GLSL = /* glsl */ `
    bool dustFloor() {
        // (Not walking, every floor stays. Walking, so does everything below the shadow's floor, and a little above
        // it: the camera is always above it, so nothing down there can stand between it and the shadow, and the foot
        // of each wall shows where it stands: the jetty's end, a platform's sides, a step.)
        if (dustSight.w < 0.5) return vDustUp > 0.6;
        return vDustWorld.y < dustSight.y + ${LOW_KEPT.toFixed(2)} || (vDustUp > 0.6 && vDustWorld.y < dustSight.y + ${FLOOR_KEPT.toFixed(2)});
    }
    float dustEdge(vec2 cell) { return 0.42 + 0.03 * dustGrain(cell); }
`;

/**
 * Toward an opening's edge, more and more of the surface is gold grains (gilt, 0 to 1), each coming and going at a
 * pace of its own, a few of them bright.
 */
const GILD_GLSL = /* glsl */ `
    vec3 dustGild(vec3 light, vec2 cell, float gilt) {
        float grain = dustGrain(cell);
        float phase = dustGrain(cell + 7.31);
        float shows = step(fract(phase + dustTime * (0.35 + 0.5 * grain)), gilt * 0.85);
        vec3 gold = vec3(1.0, 0.72, 0.3) * (0.8 + 0.9 * step(0.92, grain));
        return mix(light, gold, shows * ${GILT.toFixed(2)});
    }
`;

/**
 * The lingering dust: the surfaces drawn again, in light only (added, no depth, so the ink draws none of it), and
 * only where they've come apart. (Flags and weed sway, as their surfaces do: kit.js's flutter.)
 */
const LINGER_VERTEX = /* glsl */ `
    #ifdef LINGER_SWAY
    uniform float flutterTime;
    attribute float sway;
    #endif
    varying vec3 vDustWorld;
    varying float vDustUp;
    varying vec3 vLingerNormal;
    varying vec3 vLingerColor;
    void main() {
        vec3 transformed = position;
        vDustWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vLingerNormal = normalize(mat3(modelMatrix) * normal);
        vDustUp = vLingerNormal.y;
        #ifdef LINGER_SWAY
        float flutter = sin(flutterTime * 3.1 + position.x * 1.7 + position.z * 1.3) * 0.6
            + sin(flutterTime * 5.3 + position.y * 2.1) * 0.3;
        transformed += vec3(0.1, 0.04, 0.1) * flutter * sway;
        #endif
        #ifdef USE_COLOR
        vLingerColor = min(color, vec3(1.0));
        #else
        vLingerColor = vec3(1.0, 0.78, 0.4);
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);
    }
`;

const LINGER_FRAGMENT = /* glsl */ `
    ${DUST_GLSL}
    ${DUST_EDGE_GLSL}
    varying vec3 vLingerNormal;
    varying vec3 vLingerColor;
    float moteHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
        // The motes lie on the surface where it was, laid out across its broadest face. (How big a pixel is there
        // is worked out first, before anything is discarded or differs from square to square.)
        vec3 normal = normalize(vLingerNormal);
        vec3 facing = abs(normal);
        vec2 onFace = facing.y > max(facing.x, facing.z) ? vDustWorld.xz : (facing.x > facing.z ? vDustWorld.zy : vDustWorld.xy);
        float pixel = length(fwidth(onFace)) / ${MOTE_CELL.toFixed(3)};
        if (dustFloor()) discard;
        float dustHere = dustAt(vDustWorld);
        float edge = dustEdge(floor(gl_FragCoord.xy / 2.0));
        // (Where the surface is still whole, it's drawn itself.)
        if (dustHere <= edge) discard;
        vec3 toEye = cameraPosition - vDustWorld;
        float away = length(toEye);
        float lens = smoothstep(${LINGER_LENS[0].toFixed(2)}, ${LINGER_LENS[1].toFixed(2)}, away);
        // Faint on the faces, a little gold along the outline, where the surface turns edge-on to the eye.
        float turned = 1.0 - abs(dot(normal, toEye / max(away, 1e-4)));
        float haze = ${LINGER_HAZE.toFixed(3)} + ${LINGER_OUTLINE.toFixed(3)} * turned * turned * turned;
        // The motes, a pixel or so each, twinkling each at its own pace.
        vec2 square = floor(onFace / ${MOTE_CELL.toFixed(3)});
        vec2 within = fract(onFace / ${MOTE_CELL.toFixed(3)});
        float seed = moteHash(square);
        float mote = 0.0;
        if (seed < ${MOTE_SHARE.toFixed(2)}) {
            vec2 centre = vec2(moteHash(square + 17.3), moteHash(square + 41.9)) * 0.6 + 0.2;
            float radius = clamp(pixel * 0.9, 0.04, 0.3);
            float twinkle = 0.55 + 0.45 * sin(dustTime * (1.3 + 2.6 * moteHash(square + 5.1)) + seed * 60.0);
            // (Edge-on, a mote would smear across its squashed square: there the outline's haze is the shape.)
            mote = (1.0 - smoothstep(radius * 0.5, radius, length(within - centre))) * twinkle * (1.0 - smoothstep(0.55, 0.9, turned));
        }
        // Just come apart, at the opening's edge, a little thicker; further in, lighter; gold, with a little of
        // the colour it was.
        float past = dustHere - edge;
        float fresh = 1.0 - 0.35 * smoothstep(0.0, 0.5, past);
        vec3 gold = mix(vec3(1.0, 0.78, 0.4), vLingerColor, 0.3);
        // (Its alpha tells the ink where the rim is: ink.js draws no line there.)
        gl_FragColor = vec4(gold * (mote * ${MOTE_BRIGHT.toFixed(2)} + haze) * fresh * lens, 1.0 - smoothstep(0.0, ${RIM.toFixed(2)}, past));
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * Split a mesh's triangles into squares of the city (LINGER_CELL, or as wide as asked), each a geometry of its own
 * that shares the mesh's attributes (nothing is copied but an index), with its bounds in the world.
 * @param {Mesh} mesh
 * @param {number} [size] - how wide the squares are (world units)
 * @param {string[] | null} [names] - the attributes shared (null: all the mesh has)
 * @returns {{ geometry: BufferGeometry, box: Box3 }[]}
 */
function cellsOf(mesh, size = LINGER_CELL, names = ['position', 'normal', 'color', 'sway']) {
    const source = mesh.geometry;
    const position = source.attributes.position;
    const index = source.index;
    const count = index ? index.count : position.count;
    mesh.updateMatrixWorld();
    const cells = new Map();
    const corner = new Vector3();
    for (let first = 0; first + 2 < count; first += 3) {
        const a = index ? index.getX(first) : first;
        const b = index ? index.getX(first + 1) : first + 1;
        const c = index ? index.getX(first + 2) : first + 2;
        const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
        const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
        const key = (Math.floor(x / size) + 512) * 1024 + (Math.floor(z / size) + 512);
        let cell = cells.get(key);
        if (!cell) {
            cell = { list: [], box: new Box3() };
            cells.set(key, cell);
        }
        cell.list.push(a, b, c);
        for (const vertex of [a, b, c]) cell.box.expandByPoint(corner.fromBufferAttribute(position, vertex));
    }
    const wide = position.count > 65535;
    return [...cells.values()].map(({ list, box }) => {
        const geometry = new BufferGeometry();
        for (const name of names ?? Object.keys(source.attributes)) {
            if (source.attributes[name]) geometry.setAttribute(name, source.attributes[name]);
        }
        geometry.setIndex(new BufferAttribute(wide ? new Uint32Array(list) : new Uint16Array(list), 1));
        geometry.boundingBox = box.clone();
        geometry.boundingSphere = box.getBoundingSphere(new Sphere());
        return { geometry, box: box.clone().applyMatrix4(mesh.matrixWorld) };
    });
}

const AXES = ['x', 'y', 'z'];

/** Whether the segment from a to b passes within reach of a box (the box grown by reach; the slab test). */
function segmentNear(a, b, box, reach, grown) {
    grown.copy(box).expandByScalar(reach);
    let enter = 0;
    let leave = 1;
    for (const axis of AXES) {
        const from = a[axis];
        const way = b[axis] - from;
        const low = grown.min[axis];
        const high = grown.max[axis];
        if (Math.abs(way) < 1e-9) {
            if (from < low || from > high) return false;
            continue;
        }
        let t0 = (low - from) / way;
        let t1 = (high - from) / way;
        if (t0 > t1) [t0, t1] = [t1, t0];
        enter = Math.max(enter, t0);
        leave = Math.min(leave, t1);
        if (enter > leave) return false;
    }
    return true;
}

/**
 * @param {object} options
 * @param {boolean} options.reducedMotion - the glitter holds still
 * @param {boolean} [options.inside] - what comes apart shows its inside pure black, not empty (a trial: ?inside=off)
 */
export function createDust({ reducedMotion, inside = false }) {
    const uniforms = {
        dustNear: { value: new Vector2(NEAR_OPEN, NEAR_FADE) },
        dustSight: { value: new Vector4(0, 0, 0, 0) },
        dustTargets: { value: Array.from({ length: DUST_TARGETS }, () => new Vector4(0, 0, 0, -1)) },
        dustTime: { value: 0 },
        // (1 while the insides are drawn: showInsides.)
        dustInsides: { value: 0 },
    };
    /** The squares of lingering dust (linger), and what cull reckons with. */
    const lingering = [];
    /**
     * The insides, drawn from behind (insides): each of the city's still pieces as one copy, standing where it stands,
     * drawing only its squares within reach (its index rebuilt from theirs whenever which are within reach changes:
     * one draw for each piece, however many squares); and each of the places' own pieces (a door that swings, the
     * ball's hall) as a whole, going where its piece goes.
     */
    const backSquares = [];
    const backPieces = [];
    /** Rebuild a still piece's copy's index from its squares within reach; what it draws, and whether anything. */
    function gather(entry) {
        const { array } = entry.index;
        let at = 0;
        for (let square = 0; square < entry.squares.length; square += 1) {
            if (!entry.near[square]) continue;
            array.set(entry.squares[square].index, at);
            at += entry.squares[square].index.length;
        }
        // (Only what it draws is sent again; with nothing to draw, nothing is: it isn't drawn.)
        if (at) {
            entry.index.clearUpdateRanges();
            entry.index.addUpdateRange(0, at);
            entry.index.needsUpdate = true;
        }
        entry.back.geometry.setDrawRange(0, at);
        entry.count = at;
    }
    /** Each material's copy drawn from behind: the same shaders, its back faces only. */
    const backs = new Map();
    const reachOf = new Vector3();
    const grown = new Box3();
    const pieceBox = new Box3();
    /**
     * The box round everything an opening can reach this frame, with its lens reaching this far about the camera and
     * its lines this far about themselves: what lies wholly outside it is out of reach, found at a glance.
     */
    const lingerReach = new Box3();
    const insidesBox = new Box3();
    const lineBox = new Box3();
    function within(into, from, lens, line, walking) {
        into.min.copy(from).subScalar(lens);
        into.max.copy(from).addScalar(lens);
        if (!walking) return into;
        for (const target of uniforms.dustTargets.value) {
            if (target.w < 0) continue;
            lineBox.min.set(Math.min(from.x, target.x), Math.min(from.y, target.y), Math.min(from.z, target.z)).subScalar(line);
            lineBox.max.set(Math.max(from.x, target.x), Math.max(from.y, target.y), Math.max(from.z, target.z)).addScalar(line);
            into.union(lineBox);
        }
        return into;
    }
    /** Whether a box lies within reach of the insides about the openings (the lens's, the lines' to the shadow). */
    function insidesReach(box, from) {
        if (!box.intersectsBox(insidesBox)) return false;
        const away = box.distanceToPoint(from);
        if (away < uniforms.dustNear.value.y * INSIDE_REACH + 0.25) return true;
        // (No line to the shadow reaches further from the lens than this: dustWithin.)
        if (away > Math.sqrt(uniforms.dustSight.value.x) * INSIDE_REACH + 0.25) return false;
        for (const target of uniforms.dustTargets.value) {
            if (target.w < 0) continue;
            if (segmentNear(from, reachOf.set(target.x, target.y, target.z), box, SIGHT_FADE * INSIDE_REACH + 0.25, grown)) return true;
        }
        return false;
    }
    function backOf(material) {
        let back = backs.get(material);
        if (!back) {
            back = material.clone();
            back.side = BackSide;
            back.name = `${material.name || material.type}-back`;
            // (Its shaders are the material's own, whatever is added to them later: asked of it each time.)
            back.onBeforeCompile = (shader, renderer) => material.onBeforeCompile(shader, renderer);
            back.customProgramCacheKey = () => material.customProgramCacheKey();
            if (material.isShaderMaterial) back.uniforms = material.uniforms;
            back.userData.dustBack = true;
            backs.set(material, back);
        }
        return back;
    }

    return {
        uniforms,
        /**
         * How far the lines reach from the camera, squared (x), the floor the one casting the shadow stands on (y), and
         * 1 in w while walking (walk.js sets it).
         */
        sight: uniforms.dustSight.value,
        /** Where the lines to the shadow are aimed, and how far short of each they stop (walk.js aims them). */
        targets: uniforms.dustTargets.value,
        /** The opening about the lens: open within x, whole again from y (walk.js brings it in when it comes close). */
        near: uniforms.dustNear.value,

        /**
         * Teach a material to come apart where the camera passes, its edges gilded. (Any of three's own materials:
         * it needs their common, begin_vertex and opaque_fragment chunks.)
         * @param {import('three').Material} material
         * @param {{ solid?: boolean }} [options] - solid: whether what it draws is the city's, whose insides show
         *   black while walking (inside); the givers and Allison aren't buildings, and keep theirs unseen
         */
        dissolve(material, { solid = true } = {}) {
            // (A material the city's pieces share may be found again among what's drawn with materials of its own:
            // taught once is enough, and twice would say everything twice over in its shader.)
            if (material.userData.dust) return material;
            material.userData.dust = true;
            // Where something comes apart while walking, its inside shows pure black (a trial, ?inside=off: a friend's
            // idea, through Elm, "make all backfaces render as pure black ... in the edge case where the dissolve shows
            // bits of the inside of a building the building looks empty currently - if the backfaces are pure black
            // then it'll look neater visually"). A solid's inner faces are drawn then (insides, showInsides: its own
            // copy, from behind), black, near the openings; whole, they lie hidden behind its outside, so they show only
            // through an opening. (What was already drawn from both sides, a flag, a ribbon, a bridge, keeps its own
            // two faces; what's see-through stays as it was; and the city's long shadows fall as they did.)
            const blackInside = inside && solid && material.side === FrontSide && !material.transparent;
            if (blackInside) {
                material.shadowSide = BackSide;
                material.userData.dustInside = true;
            }
            // (Named apart, so a material with insides never shares a compiled program with one without.)
            alsoBeforeCompile(material, blackInside ? 'dust-inside' : 'dust', (shader) => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', `#include <common>\nvarying vec3 vDustWorld;\nvarying float vDustUp;${blackInside ? '\nuniform float dustInsides;' : ''}`)
                    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDustWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDustUp = normalize(mat3(modelMatrix) * normal).y;');
                // (An inside, a hair behind wherever it lies (INSIDE_BEHIND): a face turned away from the eye is
                // pushed back in depth only, so it stays just where it was on the screen. Flat faces turn away whole;
                // where a rounded one turns, a corner or two may go back by the hair, which nothing shows.)
                if (blackInside) {
                    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', [
                        `if (dustInsides > 0.5 && dot(mat3(modelMatrix) * normal, cameraPosition - vDustWorld) < 0.0) gl_Position.z += ${INSIDE_BEHIND.toExponential(1)} * gl_Position.w;`,
                        '#include <fog_vertex>',
                    ].join('\n'));
                }
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', `#include <common>\n${DUST_GLSL}\n${DUST_EDGE_GLSL}\n${GILD_GLSL}`)
                    // (Nothing is worked out for the grain where there's no dust at all, which is almost everywhere.)
                    .replace('void main() {', [
                        'void main() {',
                        // (A floor, facing up, no higher than a step or so above the shadow's own level, stays whole, so the
                        // shadow always has somewhere to lie and nothing opens under the camera where it steps down: a
                        // platform the shadow has just left stood 0.38 above it; and, the camera not walking, every floor does.)
                        '    float dustHere = dustFloor() ? 0.0 : dustAt(vDustWorld);',
                        '    vec2 dustCell = floor(gl_FragCoord.xy / 2.0);',
                        '    float dustGilt = 0.0;',
                        '    if (dustHere > 0.0) {',
                        '        float edgeHere = dustEdge(dustCell);',
                        // (Past the edge it has come apart, and its dust lingers there instead: linger.)
                        '        if (dustHere > edgeHere) discard;',
                        `        dustGilt = smoothstep(edgeHere - ${GILT_BAND.toFixed(2)}, edgeHere, dustHere);`,
                        '    }',
                        // (Its inside, seen through an opening: black, and its edge gilded as the outside's is, thinning
                        // out in grains away from the openings; nothing more is worked out for it, so the inner faces cost
                        // almost nothing where they're hidden.)
                        // (The copy drawn from behind (insides) draws nothing but the inner faces; and three.js draws
                        // a material from behind by turning which way round counts as the front, so there they'd
                        // read as front faces: there, every face is an inside.)
                        ...(blackInside ? [
                            '    #ifdef FLIP_SIDED',
                            '    if (true) {',
                            '    #else',
                            '    if (!gl_FrontFacing) {',
                            '    #endif',
                            `        if (dustSight.w < 0.5 || dustWithin(vDustWorld, ${INSIDE_REACH.toFixed(2)}) <= 0.5 * dustGrain(dustCell + 3.7)) discard;`,
                            '        gl_FragColor = vec4(dustGilt > 0.0 ? dustGild(vec3(0.0), dustCell, dustGilt) : vec3(0.0), 1.0);',
                            '        #include <tonemapping_fragment>',
                            '        #include <colorspace_fragment>',
                            '        #include <fog_fragment>',
                            '        return;',
                            '    }',
                        ] : []),
                    ].join('\n'))
                    // (Toward the edge, more and more of the surface is gold grains, each coming and going at a
                    // pace of its own, a few of them bright.)
                    .replace('#include <opaque_fragment>', [
                        '    if (dustGilt > 0.0) outgoingLight = dustGild(outgoingLight, dustCell, dustGilt);',
                        '#include <opaque_fragment>',
                    ].join('\n'));
            });
            return material;
        },

        /**
         * Let the dust linger where these meshes come apart, in their shape (LINGER_*), as a group to add to the
         * scene. Each mesh is split into squares of the city that share its attributes, and a square is drawn only
         * while an opening is near it (cull), so the whole city seen from far costs nothing more.
         * @param {Mesh[]} meshes - already dissolving (dissolve), and standing where they'll stay
         * @param {{ value: number }} clock - the flags' and the weed's wind (kit.js's flutter), for those that sway
         * @returns {Promise<Group>} (made a mesh at a time, letting the way in move between: kit.js breathe)
         */
        async linger(meshes, clock) {
            const group = new Group();
            group.name = 'dust-linger';
            const kinds = new Map();
            const materialFor = (geometry) => {
                const sway = Boolean(geometry.attributes.sway);
                const color = Boolean(geometry.attributes.color);
                const key = `${sway}|${color}`;
                if (!kinds.has(key)) {
                    kinds.set(key, new ShaderMaterial({
                        uniforms: sway ? { ...uniforms, flutterTime: clock } : uniforms,
                        defines: sway ? { LINGER_SWAY: '' } : {},
                        vertexShader: LINGER_VERTEX,
                        fragmentShader: LINGER_FRAGMENT,
                        vertexColors: color,
                        transparent: true,
                        // (Its light is added; its alpha marks the rim for the ink, taken from what's there.)
                        blending: CustomBlending,
                        blendEquation: AddEquation,
                        blendSrc: OneFactor,
                        blendDst: OneFactor,
                        blendEquationAlpha: AddEquation,
                        blendSrcAlpha: ZeroFactor,
                        blendDstAlpha: OneMinusSrcAlphaFactor,
                        depthWrite: false,
                        side: DoubleSide,
                    }));
                }
                return kinds.get(key);
            };
            for (const mesh of meshes) {
                for (const { geometry, box } of cellsOf(mesh)) {
                    const cell = new Mesh(geometry, materialFor(geometry));
                    cell.name = `${mesh.name}-dust`;
                    cell.matrixAutoUpdate = false;
                    cell.matrix.copy(mesh.matrixWorld);
                    cell.renderOrder = 3;
                    cell.visible = false;
                    cell.userData.box = box;
                    lingering.push(cell);
                    group.add(cell);
                }
                await breathe();
            }
            return group;
        },

        /**
         * The insides (inside, a trial), drawn only where they can show: every solid that shows its inside black, drawn
         * again from behind, in squares of the city (the still pieces given) or whole (each of the places' own, found in
         * the scene), on a layer of their own (INSIDE_LAYER). Call once everything that comes apart is in the scene.
         * @param {Mesh[]} still - the city's pieces that stand where they'll stay (as lingering: linger)
         * @param {import('three').Object3D} scene
         * @returns {Promise<Group>} the squares, to add to the scene (the places' own are added to their pieces); made a
         *   piece at a time, letting the way in move between (kit.js breathe)
         */
        async insides(still, scene) {
            const group = new Group();
            group.name = 'dust-insides';
            if (!inside) return group;
            // (A piece drawn many times over, or bending on bones, would need its copy to know how: none shows an inside.)
            const showsInside = (object) => object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh
                && !Array.isArray(object.material) && object.material?.userData.dustInside;
            const own = [];
            scene.traverse((object) => {
                if (showsInside(object) && !still.includes(object)) own.push(object);
            });
            // (Each made ready as it's made, unseen until an opening is near it, on its own layer.)
            const ready = (back) => {
                back.layers.set(INSIDE_LAYER);
                back.visible = false;
                back.userData.dustBack = true;
                back.userData.near = false;
                return back;
            };
            for (const mesh of still) {
                if (!showsInside(mesh)) continue;
                const squares = cellsOf(mesh, INSIDE_CELL, []).map(({ geometry, box }) => ({ box, index: geometry.index.array }));
                const total = squares.reduce((sum, square) => sum + square.index.length, 0);
                const geometry = new BufferGeometry();
                for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) geometry.setAttribute(name, attribute);
                const wide = mesh.geometry.attributes.position.count > 65535;
                const index = new BufferAttribute(wide ? new Uint32Array(total) : new Uint16Array(total), 1);
                index.setUsage(DynamicDrawUsage);
                geometry.setIndex(index);
                geometry.setDrawRange(0, 0);
                // (Its bounds are the whole piece's, so it's never left out for being off the screen when it isn't.)
                geometry.boundingBox = new Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
                geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
                const back = ready(new Mesh(geometry, backOf(mesh.material)));
                back.name = `${mesh.name}-back`;
                back.matrixAutoUpdate = false;
                back.matrix.copy(mesh.matrixWorld);
                back.renderOrder = mesh.renderOrder;
                back.receiveShadow = mesh.receiveShadow;
                group.add(back);
                backSquares.push({ back, squares, index, near: new Uint8Array(squares.length), count: 0 });
                await breathe();
            }
            for (const mesh of own) {
                const back = ready(new Mesh(mesh.geometry, backOf(mesh.material)));
                back.name = `${mesh.name || mesh.parent?.name || 'piece'}-back`;
                back.renderOrder = mesh.renderOrder;
                back.receiveShadow = mesh.receiveShadow;
                // (Its own bounds, from its points as they are now: a geometry's kept bounds may be older than them.)
                back.userData.bounds = new Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
                mesh.add(back);
                backPieces.push(back);
                await breathe();
            }
            return group;
        },

        /**
         * Every frame, once the camera has moved: draw the lingering dust only in the squares an opening reaches (the
         * lens's, and while walking, the lines to the shadow's); and, walking, find which of the insides can show.
         * @param {import('three').Camera} camera
         */
        cull(camera) {
            const lens = uniforms.dustNear.value.y + 0.25;
            const walking = uniforms.dustSight.value.w > 0.5;
            const from = camera.position;
            within(lingerReach, from, lens, SIGHT_FADE + 0.25, walking);
            for (const cell of lingering) {
                const box = cell.userData.box;
                if (!box.intersectsBox(lingerReach)) {
                    cell.visible = false;
                    continue;
                }
                let near = box.distanceToPoint(from) < lens;
                if (!near && walking) {
                    for (const target of uniforms.dustTargets.value) {
                        if (target.w < 0) continue;
                        if (segmentNear(from, reachOf.set(target.x, target.y, target.z), box, SIGHT_FADE + 0.25, grown)) {
                            near = true;
                            break;
                        }
                    }
                }
                cell.visible = near;
            }
            // (Not walking, no inside shows: showInsides.)
            if (!walking) return;
            within(insidesBox, from, uniforms.dustNear.value.y * INSIDE_REACH + 0.25, SIGHT_FADE * INSIDE_REACH + 0.25, true);
            for (const entry of backSquares) {
                let changed = false;
                for (let square = 0; square < entry.squares.length; square += 1) {
                    const near = insidesReach(entry.squares[square].box, from) ? 1 : 0;
                    if (entry.near[square] !== near) {
                        entry.near[square] = near;
                        changed = true;
                    }
                }
                if (changed) gather(entry);
                entry.back.userData.near = entry.count > 0;
            }
            for (const back of backPieces) {
                pieceBox.copy(back.userData.bounds).applyMatrix4(back.parent.matrixWorld);
                back.userData.near = insidesReach(pieceBox, from);
            }
        },

        /** How many squares of lingering dust are drawn this frame, of how many (for the local checks). */
        get lingeringShown() {
            return { shown: lingering.filter((cell) => cell.visible).length, of: lingering.length };
        },

        /**
         * Around drawing the city, every frame: its insides drawn (on, while walking: those within reach of an
         * opening, cull), then not (off), so nothing else that looks at the city (a touch, what hides a reading point)
         * ever finds an inside. (Nothing is compiled anew either way: the insides are drawn by their own copies of the
         * city's materials, from behind, and the city's own are drawn from the front as always.)
         * @param {boolean} on
         */
        showInsides(on) {
            for (const entry of backSquares) entry.back.visible = on && entry.back.userData.near;
            for (const back of backPieces) back.visible = on && back.userData.near;
            uniforms.dustInsides.value = on ? 1 : 0;
        },

        /** Every frame: the glitter's clock. */
        update(elapsed) {
            if (!reducedMotion) uniforms.dustTime.value = elapsed;
        },
    };
}
