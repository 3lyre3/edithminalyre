/**
 * ball.js — the people and pictures the charity ball wants (places.js buildBall; a trial, ?ball=off): Numbers by
 * Paint, Episode 5, pp. 77-78.
 *
 * - Cassandra, Princess of Troy, twice: at the podium, where she "climbed to his place on the podium and threw her hands
 *   wide, begging for hush"; and on the thin balcony, where "Cassandra lay, chairs tumbled about, back against the
 *   rails and a bottle of cognac at the feet, talking to herself". Her look follows Elm's drawing of her (long, dark,
 *   wavy hair; a long, loose gown, a sash at the waist), dressed for the night in her door's seeress' violet.
 * - "an old, bearded Greek" at the podium, muttering "incomprehensible sentences, each shaped like an aphorism": bald,
 *   white-bearded, in a long pale robe edged with gold, a finger raised.
 * - The seated crowd ("two hundred guests") and the band (The Kaitens) as silhouettes against the stage's lights.
 * - The balcony's "filigreed railing".
 *
 * The figures are drawn as the city's people are (allison.js): pieces of simple solids, each with its colour, merged
 * into one geometry, for the city's toon light; standing on the origin, facing +z. The pictures are drawn once on
 * canvases (no picture files).
 */

// =============================================================================
// Imports
// =============================================================================

import {
    CanvasTexture,
    Color,
    CapsuleGeometry,
    ConeGeometry,
    CylinderGeometry,
    LinearFilter,
    LinearMipmapLinearFilter,
    SphereGeometry,
    TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, paintBy, pose } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** The city's people are drawn a little smaller than life (allison.js is 1.36; she's a little shorter). */
const CASSANDRA_TALL = 1.32;
const GREEK_TALL = 1.34;
/** Built at this height, then scaled. */
const BUILT = 1.5;

const SKIN = 0xe9c6a6;
const GREEK_SKIN = 0xd9b08c;
const HAIR = 0x2a1a16;
const HAIR_LIGHT = 0x46302a;
/** Her gown: her door's violet, its folds deeper; a sash of gold. */
const GOWN = 0x4f2d6a;
const GOWN_DEEP = 0x3a1f50;
const SASH = 0xe2b452;
const EYES = 0x281820;
const ROBE = 0xe8dfcc;
const ROBE_SHADE = 0xcfc4ad;
const BORDER = 0xd6a640;
const BEARD = 0xf2eee6;

/** The silhouettes' atlas: cells across and their size. */
export const CROWD_CELLS = 4;
export const BAND_CELLS = 4;

// =============================================================================
// The figures
// =============================================================================

/** A piece of a figure: posed, painted, reduced to what the merge wants (position, normal, colour). */
function piece(geometry, at, color) {
    if (at) pose(geometry, at);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    paint(flat, color);
    for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'color'].includes(name)) flat.deleteAttribute(name);
    return flat;
}

/** Folds falling in a skirt: its colour deepened in soft stripes round it, more toward the hem. */
function folded(skirt, falls = 7) {
    const deep = new Color(GOWN_DEEP);
    const base = new Color(GOWN);
    return paintBy(skirt, (x, y, z, color) => {
        const stripe = 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * falls + y * 2.0);
        color.copy(base).lerp(deep, stripe * (0.35 + 0.45 * Math.max(0, 1 - y / 0.86)));
    });
}

/** A limb from a to b (a tapered cylinder between two points), as a piece. */
function limb(a, b, radiusA, radiusB, color, segments = 8) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const length = Math.hypot(dx, dy, dz);
    const geometry = new CylinderGeometry(radiusB, radiusA, length, segments);
    // (Stood along y, then tipped to lie from a to b: about x by the pitch, about y by the heading.)
    const flatLength = Math.hypot(dx, dz);
    const rx = Math.atan2(flatLength, dy);
    const ry = Math.atan2(dx, dz);
    geometry.rotateX(rx);
    geometry.rotateY(ry);
    geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return piece(geometry, null, color);
}

/** Her long, dark, wavy hair: the crown, the locks by her face, and the falls down her back (to about her waist). */
function cassandraHair(add, { head, tilt = 0, down = 0.42, forward = 0 }) {
    const [hx, hy, hz] = head;
    add(new SphereGeometry(1, 12, 8), { sx: 0.118, sy: 0.115, sz: 0.125, x: hx, y: hy + 0.035, z: hz - 0.018, rx: tilt }, HAIR);
    add(new SphereGeometry(1, 10, 6), { sx: 0.1, sy: 0.05, sz: 0.09, x: hx, y: hy + 0.1, z: hz + 0.02, rx: tilt - 0.3 }, HAIR_LIGHT);
    // (Down her back in wavy falls, each a little apart; by her face and over each shoulder.)
    const falls = [
        [0, -0.05, -0.1, 0.1, 0.15, 0.06, 0.06], [0, -0.22, -0.12, 0.11, 0.14, 0.055, -0.08], [0, -0.36, -0.12, 0.1, 0.11, 0.05, 0.1],
        [-0.075, -0.12, -0.1, 0.06, 0.17, 0.05, 0.14], [0.075, -0.12, -0.1, 0.06, 0.17, 0.05, -0.14],
        [-0.07, -0.3, -0.11, 0.055, 0.13, 0.045, -0.12], [0.07, -0.3, -0.11, 0.055, 0.13, 0.045, 0.12],
        [-0.11, -0.02, 0.0, 0.045, 0.13, 0.055, 0.1], [0.11, -0.02, 0.0, 0.045, 0.13, 0.055, -0.1],
        [-0.125, -0.19, 0.03 + forward, 0.045, 0.13, 0.05, 0.22], [0.125, -0.19, 0.03 + forward, 0.045, 0.13, 0.05, -0.22],
    ];
    falls.forEach(([x, y, z, sx, sy, sz, rz], index) => {
        if (y < -down) return;
        add(new SphereGeometry(1, 9, 6), { sx, sy, sz, x: hx + x, y: hy + y, z: hz + z, rz }, index % 3 === 1 ? HAIR_LIGHT : HAIR);
    });
}

/** Her face: the head, and two dark eyes. */
function cassandraHead(add, [hx, hy, hz], { look = 0, nod = 0 } = {}) {
    add(new SphereGeometry(0.1, 12, 9), { sy: 1.12, x: hx, y: hy, z: hz, rx: nod, ry: look }, SKIN);
    for (const side of [-1, 1]) {
        const ex = hx + side * 0.036 + Math.sin(look) * 0.09;
        add(new SphereGeometry(0.016, 6, 4), { x: ex, y: hy + 0.012 - nod * 0.05, z: hz + Math.cos(look) * 0.09 }, EYES);
    }
}

/**
 * Cassandra, Princess of Troy. 'podium': standing, her hands thrown wide, begging for hush. 'balcony': sitting on the
 * floor, her back against the rails (behind her, at -z), one knee up, her arm across it, her head back.
 */
export function cassandraGeometry(pose = 'podium') {
    const pieces = [];
    const add = (geometry, at, color) => pieces.push(piece(geometry, at, color));
    const push = (built) => pieces.push(built);
    if (pose === 'podium') {
        // The gown, long to the floor, its folds falling in it; the bodice; the sash.
        pieces.push(folded(piece(new CylinderGeometry(0.13, 0.33, 0.86, 24), { y: 0.43 }, GOWN)));
        add(new CapsuleGeometry(0.115, 0.22, 3, 12), { sx: 1.02, sz: 0.74, y: 1.0 }, GOWN);
        add(new TorusGeometry(0.118, 0.022, 5, 16), { y: 0.86, rx: Math.PI / 2, sz: 1, sy: 0.74 }, SASH);
        add(new CylinderGeometry(0.038, 0.044, 0.1, 8), { y: 1.17 }, SKIN);
        // Her arms thrown wide: sleeves to the elbow, then up and out, palms to the crowd.
        for (const side of [-1, 1]) {
            const shoulder = [side * 0.15, 1.1, 0];
            const elbow = [side * 0.35, 1.12, 0.07];
            const hand = [side * 0.57, 1.19, 0.12];
            push(limb(shoulder, elbow, 0.046, 0.042, GOWN));
            push(limb(elbow, hand, 0.034, 0.028, SKIN));
            add(new SphereGeometry(0.036, 8, 5), { sx: 0.8, sy: 1.25, sz: 0.55, x: hand[0] + side * 0.025, y: hand[1] + 0.03, z: hand[2] + 0.01, rz: -side * 0.35 }, SKIN);
        }
        cassandraHead(add, [0, 1.3, 0.005]);
        cassandraHair(add, { head: [0, 1.3, 0] });
    } else {
        // Sitting: her hips on the floor, her back leant against the rails behind her.
        const lean = -0.42;
        const hips = [0, 0.12, 0];
        const chest = [0, 0.12 + Math.cos(lean) * 0.36, Math.sin(lean) * 0.36];
        add(new CapsuleGeometry(0.12, 0.08, 3, 10), { sx: 1.05, sz: 0.8, x: hips[0], y: hips[1] + 0.02, z: hips[2] }, GOWN);
        add(new CapsuleGeometry(0.11, 0.2, 3, 12), { sx: 1.0, sz: 0.74, x: (hips[0] + chest[0]) / 2, y: (hips[1] + chest[1]) / 2 + 0.04, z: (hips[2] + chest[2]) / 2, rx: lean }, GOWN);
        add(new TorusGeometry(0.11, 0.02, 5, 16), { y: 0.2, z: -0.02, rx: Math.PI / 2 + lean * 0.4, sy: 0.76 }, SASH);
        // Her legs out along the floor under the gown: the left knee up, the right leg long.
        const leftKnee = [-0.08, 0.3, 0.32];
        const leftFoot = [-0.08, 0.04, 0.58];
        const rightKnee = [0.09, 0.11, 0.42];
        const rightFoot = [0.1, 0.05, 0.8];
        push(limb([-0.07, 0.13, 0.02], leftKnee, 0.085, 0.065, GOWN));
        push(limb(leftKnee, leftFoot, 0.07, 0.085, GOWN));
        push(limb([0.07, 0.12, 0.02], rightKnee, 0.085, 0.07, GOWN));
        push(limb(rightKnee, rightFoot, 0.07, 0.08, GOWN_DEEP));
        // (Her bare feet out from the hem.)
        add(new SphereGeometry(1, 8, 5), { sx: 0.035, sy: 0.03, sz: 0.07, x: leftFoot[0], y: 0.035, z: leftFoot[2] + 0.06 }, SKIN);
        add(new SphereGeometry(1, 8, 5), { sx: 0.035, sy: 0.03, sz: 0.07, x: rightFoot[0], y: 0.035, z: rightFoot[2] + 0.06 }, SKIN);
        // The gown's skirt over her legs and on the floor about her.
        add(new CylinderGeometry(0.16, 0.3, 0.5, 14, 1, true), { y: 0.11, z: 0.3, rx: Math.PI / 2 - 0.08, sx: 1.1, sz: 0.4 }, GOWN_DEEP);
        add(new CylinderGeometry(0.32, 0.36, 0.04, 14), { y: 0.02, z: 0.1, sx: 1.1 }, GOWN_DEEP);
        const neck = [chest[0], chest[1] + 0.07, chest[2] - 0.02];
        add(new CylinderGeometry(0.037, 0.043, 0.1, 8), { x: neck[0], y: neck[1], z: neck[2], rx: lean }, SKIN);
        // Her left arm across the raised knee; her right down at her side, its hand on the floor by the bottle.
        const leftShoulder = [chest[0] - 0.15, chest[1] - 0.02, chest[2]];
        const leftElbow = [-0.2, 0.3, 0.16];
        const leftHand = [-0.02, 0.36, 0.36];
        push(limb(leftShoulder, leftElbow, 0.044, 0.04, GOWN));
        push(limb(leftElbow, leftHand, 0.033, 0.028, SKIN));
        add(new SphereGeometry(0.034, 8, 5), { sx: 1.2, sy: 0.7, x: leftHand[0] + 0.02, y: leftHand[1], z: leftHand[2] + 0.01 }, SKIN);
        const rightShoulder = [chest[0] + 0.15, chest[1] - 0.02, chest[2]];
        const rightElbow = [0.24, 0.26, -0.02];
        const rightHand = [0.3, 0.05, 0.14];
        push(limb(rightShoulder, rightElbow, 0.044, 0.04, GOWN));
        push(limb(rightElbow, rightHand, 0.033, 0.028, SKIN));
        add(new SphereGeometry(0.034, 8, 5), { sx: 1.1, sy: 0.6, x: rightHand[0], y: 0.035, z: rightHand[2] }, SKIN);
        // Her head back against the rails, turned a little, as she talks to herself.
        const head = [chest[0] + 0.01, chest[1] + 0.2, chest[2] - 0.06];
        cassandraHead(add, head, { look: 0.25, nod: -0.25 });
        cassandraHair(add, { head, tilt: lean * 0.5, down: 0.3, forward: 0.02 });
    }
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(CASSANDRA_TALL / BUILT, CASSANDRA_TALL / BUILT, CASSANDRA_TALL / BUILT);
    geometry.computeBoundingSphere();
    return geometry;
}

/**
 * The old, bearded Greek at the podium, between his aphorisms: bald, his white hair long at the sides, his beard long
 * and white; a pale robe edged with gold, over one shoulder; his left hand on the lectern, his right raised, a finger up.
 */
export function greekGeometry() {
    const pieces = [];
    const add = (geometry, at, color) => pieces.push(piece(geometry, at, color));
    const push = (built) => pieces.push(built);
    add(new CylinderGeometry(0.15, 0.3, 0.98, 14), { y: 0.49 }, ROBE);
    add(new TorusGeometry(0.29, 0.018, 4, 18), { y: 0.03, rx: Math.PI / 2 }, BORDER);
    add(new CapsuleGeometry(0.13, 0.2, 3, 12), { sx: 1.05, sz: 0.78, y: 1.02 }, ROBE);
    // (The himation's drape over his left shoulder, edged with gold.)
    add(new CylinderGeometry(0.05, 0.09, 0.7, 8), { x: -0.08, y: 0.86, z: 0.05, rz: -0.38, sx: 1.6, sz: 0.6 }, ROBE_SHADE);
    add(new CylinderGeometry(0.012, 0.012, 0.66, 4), { x: -0.02, y: 0.86, z: 0.115, rz: -0.38 }, BORDER);
    add(new CylinderGeometry(0.04, 0.046, 0.09, 8), { y: 1.18 }, GREEK_SKIN);
    // His left forearm forward to the lectern; his right raised, a finger up.
    push(limb([-0.16, 1.1, 0], [-0.2, 0.92, 0.12], 0.05, 0.045, ROBE));
    push(limb([-0.2, 0.92, 0.12], [-0.12, 0.86, 0.32], 0.035, 0.03, GREEK_SKIN));
    add(new SphereGeometry(0.036, 8, 5), { x: -0.11, y: 0.85, z: 0.35 }, GREEK_SKIN);
    push(limb([0.16, 1.1, 0], [0.3, 1.0, 0.1], 0.05, 0.045, ROBE));
    push(limb([0.3, 1.0, 0.1], [0.3, 1.25, 0.2], 0.035, 0.03, GREEK_SKIN));
    add(new SphereGeometry(0.034, 8, 5), { x: 0.3, y: 1.28, z: 0.21 }, GREEK_SKIN);
    push(limb([0.3, 1.3, 0.21], [0.3, 1.38, 0.22], 0.01, 0.008, GREEK_SKIN, 5));
    // His head: bald, his brow furrowed (bushy brows), his white hair at the sides and back, the long beard.
    add(new SphereGeometry(0.102, 12, 9), { sy: 1.1, y: 1.31 }, GREEK_SKIN);
    for (const side of [-1, 1]) {
        add(new SphereGeometry(1, 7, 4), { sx: 0.03, sy: 0.012, sz: 0.015, x: side * 0.036, y: 1.345, z: 0.09 }, BEARD);
        add(new SphereGeometry(0.014, 6, 4), { x: side * 0.036, y: 1.322, z: 0.093 }, EYES);
        add(new SphereGeometry(1, 8, 6), { sx: 0.045, sy: 0.07, sz: 0.07, x: side * 0.085, y: 1.3, z: -0.03 }, BEARD);
    }
    add(new SphereGeometry(1, 9, 6), { sx: 0.09, sy: 0.06, sz: 0.05, y: 1.29, z: -0.07 }, BEARD);
    add(new ConeGeometry(0.075, 0.3, 9), { y: 1.13, z: 0.07, rx: Math.PI + 0.25, sz: 0.7 }, BEARD);
    add(new SphereGeometry(1, 9, 6), { sx: 0.07, sy: 0.05, sz: 0.05, y: 1.255, z: 0.08 }, BEARD);
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(GREEK_TALL / BUILT, GREEK_TALL / BUILT, GREEK_TALL / BUILT);
    geometry.computeBoundingSphere();
    return geometry;
}

// =============================================================================
// The pictures
// =============================================================================

function canvasOf(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, context: canvas.getContext('2d') };
}

function textureOf(canvas) {
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
}

/**
 * The seated crowd, from behind (they face the podium), as silhouettes against the stage's lights: white on nothing
 * (the material darkens them), four to an atlas, each 128 across and 192 down, sitting on the bottom: a woman with
 * her hair up and her shoulders bare; a man in a dinner jacket; a woman with long hair; someone in a tall hat.
 */
export function crowdAtlas() {
    const { canvas, context } = canvasOf(128 * CROWD_CELLS, 192);
    context.fillStyle = '#ffffff';
    const chair = (x0) => {
        // The chair's back above the seat, its legs.
        context.fillRect(x0 + 36, 108, 56, 10);
        context.fillRect(x0 + 40, 118, 7, 74);
        context.fillRect(x0 + 81, 118, 7, 74);
    };
    const shoulders = (x0, wide, top) => {
        context.beginPath();
        context.moveTo(x0 + 64 - wide, 150);
        context.bezierCurveTo(x0 + 64 - wide, top + 22, x0 + 64 - wide * 0.55, top, x0 + 64, top);
        context.bezierCurveTo(x0 + 64 + wide * 0.55, top, x0 + 64 + wide, top + 22, x0 + 64 + wide, 150);
        context.closePath();
        context.fill();
    };
    // 1: hair up, shoulders bare.
    chair(0);
    shoulders(0, 34, 70);
    context.beginPath();
    context.ellipse(64, 54, 15, 19, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(64, 30, 11, 10, 0, 0, Math.PI * 2);
    context.fill();
    // 2: a dinner jacket, broad, a short crop.
    chair(128);
    shoulders(128, 40, 72);
    context.beginPath();
    context.ellipse(192, 52, 16, 19, 0, 0, Math.PI * 2);
    context.fill();
    // 3: long hair down her back.
    chair(256);
    shoulders(256, 32, 74);
    context.beginPath();
    context.ellipse(320, 54, 16, 19, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(304, 52);
    context.bezierCurveTo(298, 90, 302, 120, 308, 140);
    context.lineTo(332, 140);
    context.bezierCurveTo(338, 120, 342, 90, 336, 52);
    context.closePath();
    context.fill();
    // 4: a tall hat.
    chair(384);
    shoulders(384, 36, 76);
    context.beginPath();
    context.ellipse(448, 58, 15, 18, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(433, 14, 30, 34);
    context.fillRect(424, 44, 48, 6);
    return textureOf(canvas);
}

/**
 * The band, The Kaitens, as silhouettes on the stage: white on nothing, four to an atlas, each 128 across and 256 down,
 * standing on the bottom: a double bass and its player; a drummer behind the kit; a singer at the microphone; a
 * saxophone.
 */
export function bandAtlas() {
    const { canvas, context } = canvasOf(128 * BAND_CELLS, 256);
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';
    context.lineCap = 'round';
    const body = (x, top, wide = 22) => {
        context.beginPath();
        context.ellipse(x, top + 16, 12, 15, 0, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(x - wide, 256);
        context.lineTo(x - wide + 4, top + 48);
        context.bezierCurveTo(x - wide + 6, top + 34, x + wide - 6, top + 34, x + wide - 4, top + 48);
        context.lineTo(x + wide, 256);
        context.closePath();
        context.fill();
    };
    // The double bass, taller than its player beside it.
    body(40, 50);
    context.beginPath();
    context.ellipse(84, 196, 26, 40, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(84, 146, 20, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(84, 128);
    context.lineTo(84, 26);
    context.stroke();
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(52, 110);
    context.lineTo(78, 150);
    context.stroke();
    // The drummer, seated behind the kit: the bass drum, the snare, the cymbals on their stands.
    body(192, 96, 20);
    context.beginPath();
    context.arc(192, 214, 40, 0, Math.PI * 2);
    context.fill();
    context.fillRect(140, 168, 26, 24);
    context.lineWidth = 3;
    for (const [x, y, w] of [[146, 120, 30], [238, 108, 34]]) {
        context.beginPath();
        context.moveTo(x, y + 4);
        context.lineTo(x + 4, 256);
        context.stroke();
        context.beginPath();
        context.ellipse(x, y, w / 2, 3, -0.2, 0, Math.PI * 2);
        context.fill();
    }
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(176, 150);
    context.lineTo(152, 166);
    context.moveTo(208, 150);
    context.lineTo(232, 118);
    context.stroke();
    // The singer at the microphone, her hand up to it.
    body(320, 40, 20);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(346, 70);
    context.lineTo(346, 256);
    context.stroke();
    context.beginPath();
    context.ellipse(346, 66, 6, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(334, 100);
    context.lineTo(344, 78);
    context.stroke();
    // The saxophone: its player bent to it, the horn's curve and bell.
    body(448, 46, 21);
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(452, 74);
    context.bezierCurveTo(476, 92, 478, 150, 470, 172);
    context.bezierCurveTo(466, 186, 448, 186, 446, 168);
    context.stroke();
    context.beginPath();
    context.ellipse(447, 160, 9, 6, 0.4, 0, Math.PI * 2);
    context.fill();
    return textureOf(canvas);
}

/**
 * A panel of the balcony's "filigreed railing": gold scrollwork between its two rails, on nothing; 256 across, 128
 * down. Coloured in the material (white here).
 */
export function filigreePanel() {
    const { canvas, context } = canvasOf(256, 128);
    context.strokeStyle = '#ffffff';
    context.fillStyle = '#ffffff';
    context.lineCap = 'round';
    // The rails, top and bottom, and the uprights at the ends.
    context.fillRect(0, 2, 256, 8);
    context.fillRect(0, 118, 256, 8);
    context.fillRect(0, 2, 7, 124);
    context.fillRect(249, 2, 7, 124);
    // Between them, scrolls: pairs of S-curves meeting at a heart, a spiral at each end.
    context.lineWidth = 4;
    for (let cell = 0; cell < 4; cell += 1) {
        const cx = 32 + cell * 64;
        context.beginPath();
        context.moveTo(cx, 116);
        context.bezierCurveTo(cx - 28, 96, cx - 28, 56, cx - 6, 50);
        context.bezierCurveTo(cx + 8, 46, cx + 12, 62, cx + 2, 66);
        context.stroke();
        context.beginPath();
        context.moveTo(cx, 12);
        context.bezierCurveTo(cx + 28, 32, cx + 28, 72, cx + 6, 78);
        context.bezierCurveTo(cx - 8, 82, cx - 12, 66, cx - 2, 62);
        context.stroke();
        context.beginPath();
        context.arc(cx, 64, 5, 0, Math.PI * 2);
        context.fill();
        // (A little leaf at each scroll's turn.)
        for (const [x, y, turn] of [[cx - 20, 88, -0.6], [cx + 20, 40, 2.5]]) {
            context.beginPath();
            context.ellipse(x, y, 7, 3, turn, 0, Math.PI * 2);
            context.fill();
        }
    }
    return textureOf(canvas);
}
