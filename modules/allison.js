/**
 * allison.js — Allison the Sirenian, at the sea-wall's old plaque (a trial, trials.js; ?allison=off).
 *
 * Elm: "maybe just some actual ppl like allison the sirenian just standing next to plaques saying: i've been trying to
 * read this old plaque, it's all latin, what could it mean? and then you click and it's my bio"; and "There's actually
 * no need for any other characters than Allison as the bio is the only other thing that will be needed. I know
 * allison says it's all in Latin, but don't rewrite it please: keep it in the English."
 *
 * He's as Elm sees him ("bluish white and silver-veined skin (he's a sirenian) and bright luscious long sunny blonde
 * hair (he's first introduced as an actor in a shampoo commercial for example)") and as Numbers by Paint has him: a
 * Sirenian, "a young man now", come up from the sea, with "those astonishing, violet eyes of his, always open"
 * (ever-shining), the "webs of his toes", the "long, luxurious curls" of the commercial, his skin, calm, "a light and
 * neutral eggshell blue", and, glad, "pulsing wheat-yellow, blood-magenta: a common, Sirenian indicator for joy"; his
 * hand sweats "silver mildew", "bright silver against the dim gold of Elysicester's pavement". He works at the hostel (The
 * Door in the Floor): a white shirt, its sleeves rolled, a bar apron, his trousers rolled at the ankle, barefoot. He
 * stands at the plaque that reads "Amár" (the Danæam for ocean), his hand up to it, puzzling; when someone comes he
 * turns to them, his skin pulsing for joy, and says his line (main.js shows it, where a place's name would be). A tap
 * on him, or his line, gives Elm's bio, read from the site's own bio page, in English.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    CapsuleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshToonMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { alsoBeforeCompile, breathe, breatheDue, light, paint, pose, taperedTube } from './kit.js';
import { ball, band, cut, distanceOf, egg, limb, sculpt } from './sculpt.js';
import { trialOn } from './trials.js';

// =============================================================================
// Constants
// =============================================================================

/** His line, in Elm's words (as she set it out, 1 Oct: "please put allison's dialogue in normal case"). */
export const ALLISON_SAYS = 'I’ve been trying to read this old plaque. It’s all Latin. What could it mean?';

/** His height (the city's people are drawn a little smaller than life, as the walker is: walk.js FIGURE). */
const TALL = 1.36;
/** Where his head turns about (the top of his neck), over his feet. */
const NECK = new Vector3(0, 1.12, 0);
/** His skin: calm, bluish white (the book's "light and neutral eggshell blue"), veined with silver; glad, pulsing
 * wheat-yellow and blood-magenta. */
const EGGSHELL = new Color(0xdce9f4);
const VEINS = new Color(0.58, 0.64, 0.76);
const WHEAT = new Color(0xe8c46a);
const MAGENTA = new Color(0xb02860);
const SHIRT = 0xece5d8;
const APRON = 0x4a1e30;
const TROUSERS = 0x26304a;
/** His hair: bright, luscious, long and sunny blonde, a lighter gold where it catches the light. */
const HAIR = 0xf5c85a;
const HAIR_LIGHT = 0xffe28c;
const SILVER = 0xdfe6ee;
/** His eyes: violet, always open, shining (past 1: the ink's tone map makes it a glow). */
const EYES = light(0xa070ff, 2.4);
/** How near (metres) someone must come for him to turn to them. */
const NOTICE = 4;

// =============================================================================
// The figure
// =============================================================================

/** A piece of him: posed, painted, marked as skin (its colour moves with his mood) and as head (it turns). */
function piece(geometry, { at, color, skin = false, head = false }) {
    if (at) pose(geometry, at);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    paint(flat, color);
    const count = flat.attributes.position.count;
    flat.setAttribute('skin', new Float32BufferAttribute(new Float32Array(count).fill(skin ? 1 : 0), 1));
    flat.setAttribute('head', new Float32BufferAttribute(new Float32Array(count).fill(head ? 1 : 0), 1));
    for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'color', 'skin', 'head'].includes(name)) flat.deleteAttribute(name);
    return flat;
}

/**
 * Allison, standing on the origin, facing +z, his right hand raised (to the plaque, a little to his right and ahead),
 * his left at his side.
 */
function allisonGeometry() {
    const pieces = [];
    const add = (geometry, options) => pieces.push(piece(geometry, options));
    // Bare feet, their toes webbed (as the book has them; too small to see from the walk), and the rolled trousers.
    for (const side of [-1, 1]) {
        add(new SphereGeometry(1, 8, 5), { at: { sx: 0.045, sy: 0.03, sz: 0.09, x: side * 0.07, y: 0.03, z: 0.03 }, color: 0xffffff, skin: true });
        add(new CylinderGeometry(0.05, 0.045, 0.06, 8), { at: { x: side * 0.07, y: 0.09, z: 0 }, color: 0xffffff, skin: true });
        add(new CylinderGeometry(0.062, 0.058, 0.07, 8), { at: { x: side * 0.07, y: 0.15, z: 0 }, color: 0x3a4664 });
        add(new CylinderGeometry(0.07, 0.056, 0.52, 8), { at: { x: side * 0.07, y: 0.44, z: 0 }, color: TROUSERS });
    }
    // Hips, the shirt, the apron over it.
    add(new CapsuleGeometry(0.13, 0.08, 3, 10), { at: { sx: 1.05, sz: 0.75, y: 0.72 }, color: TROUSERS });
    add(new CapsuleGeometry(0.13, 0.26, 3, 10), { at: { sx: 1.08, sz: 0.72, y: 0.92 }, color: SHIRT });
    add(new CylinderGeometry(0.14, 0.17, 0.48, 10, 1, true, -1.1, 2.2), { at: { y: 0.6, z: 0.012, sz: 0.8 }, color: APRON });
    // His neck.
    add(new CylinderGeometry(0.04, 0.045, 0.1, 8), { at: { y: 1.12 }, color: 0xffffff, skin: true });
    // The left arm at his side, its sleeve rolled to the elbow.
    add(new CylinderGeometry(0.045, 0.04, 0.26, 8), { at: { x: -0.17, y: 0.95, z: 0, rz: -0.12 }, color: SHIRT });
    add(new CylinderGeometry(0.035, 0.03, 0.26, 8), { at: { x: -0.2, y: 0.71, z: 0.01, rz: -0.08 }, color: 0xffffff, skin: true });
    add(new SphereGeometry(0.038, 8, 5), { at: { x: -0.21, y: 0.56, z: 0.015 }, color: 0xffffff, skin: true });
    // The right arm raised, the hand up near his face, reaching to the plaque.
    add(new CylinderGeometry(0.045, 0.04, 0.26, 8), { at: { x: 0.2, y: 0.98, z: 0.06, rz: 0.9, rx: 0.5 }, color: SHIRT });
    add(new CylinderGeometry(0.035, 0.03, 0.26, 8), { at: { x: 0.3, y: 1.1, z: 0.17, rz: -0.4, rx: 0.7 }, color: 0xffffff, skin: true });
    // (His hand, sweating silver mildew.)
    add(new SphereGeometry(0.04, 8, 5), { at: { x: 0.34, y: 1.2, z: 0.26 }, color: SILVER });
    // His head: round, its nose flat, his violet eyes open.
    add(new SphereGeometry(0.105, 12, 9), { at: { sy: 1.1, y: 1.27 }, color: 0xffffff, skin: true, head: true });
    for (const side of [-1, 1]) {
        add(new SphereGeometry(0.022, 8, 6), { at: { x: side * 0.04, y: 1.29, z: 0.093 }, color: EYES, head: true });
    }
    // His hair: a full crown, parted and swept back from his brow, and long waves falling past his shoulders down his
    // back and over the front of each shoulder, sunny gold, lighter where they catch the light.
    add(new SphereGeometry(1, 12, 8), { at: { sx: 0.125, sy: 0.12, sz: 0.13, y: 1.33, z: -0.025 }, color: HAIR, head: true });
    add(new SphereGeometry(1, 10, 7), { at: { sx: 0.11, sy: 0.06, sz: 0.09, y: 1.4, z: 0.03, rx: -0.3 }, color: HAIR_LIGHT, head: true });
    const waves = [
        // Down his back, in three falls, each a little wavy.
        [0, 1.2, -0.11, 0.1, 0.16, 0.06, 0], [0, 1.0, -0.13, 0.11, 0.14, 0.055, 0.12], [0, 0.84, -0.12, 0.09, 0.1, 0.05, -0.1],
        [-0.08, 1.12, -0.1, 0.06, 0.16, 0.05, 0.1], [0.08, 1.12, -0.1, 0.06, 0.16, 0.05, -0.1],
        [-0.07, 0.92, -0.11, 0.055, 0.12, 0.045, -0.15], [0.07, 0.92, -0.11, 0.055, 0.12, 0.045, 0.15],
        // Either side of his face, and over the front of each shoulder.
        [-0.115, 1.24, -0.01, 0.045, 0.12, 0.06, 0.08], [0.115, 1.24, -0.01, 0.045, 0.12, 0.06, -0.08],
        [-0.13, 1.06, 0.02, 0.045, 0.12, 0.05, 0.2], [0.13, 1.06, 0.02, 0.045, 0.12, 0.05, -0.2],
    ];
    // (The falls below his neck hang from his shoulders: only the crown and the locks by his face turn as he does.)
    waves.forEach(([x, y, z, sx, sy, sz, rz], index) => {
        add(new SphereGeometry(1, 9, 7), { at: { sx, sy, sz, x, y, z, rz }, color: index % 3 === 1 ? HAIR_LIGHT : HAIR, head: y > 1.18 });
    });
    // Silver dripping from his hand to the pavement (as it did when he was a child, and still does when he's glad).
    for (const [x, y, z, r] of [[0.33, 0.004, 0.24, 0.035], [0.29, 0.004, 0.31, 0.022], [0.37, 0.004, 0.19, 0.018]]) {
        add(new ConeGeometry(r, 0.006, 8), { at: { x, y, z }, color: SILVER });
    }
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(TALL / 1.5, TALL / 1.5, TALL / 1.5);
    return geometry;
}

// =============================================================================
// The figure, sculpted (a trial, trials.js: ?sculpted=off, the figure above)
// =============================================================================

/**
 * Elm (3 Oct): "Allison's model could do with some more love. He could be a lot more fully developed. He doesn't need
 * to move around or walk anywhere so I think there's a lot of room for a more aesthetically pleasant and tasteful
 * model." So he's modelled as clay is (sculpt.js), at a person's proportions (worked out at 1.75 m, then drawn at TALL as
 * the city's people are): one smooth body, his head (the skull, the face beneath it, cheekbones, a straight nose, the
 * chin), his neck, his forearms and hands, his ankles and bare feet, the toes webbed; over it, crisply, his white
 * shirt (its sleeves rolled to the elbow, a collar), his trousers (rolled at the ankle) and his bar apron, tied at the
 * waist; his hair, a crown swept back from his brow over his ears, and long curls falling past his shoulders down his
 * back and over the front of each shoulder; golden brows; his violet eyes. One hand hangs at his side; the other is up
 * flat on the plaque (as he puzzles over it), sweating silver.
 */
const H = 1.75;
/** His joints (the 1.75 m figure's, feet at the origin, facing +z): the arm at his side, and the arm up at the plaque. */
const SIDE = { shoulder: [-0.19, 1.39, 0], elbow: [-0.228, 1.13, 0.012], wrist: [-0.245, 0.885, 0.045], hand: [-0.251, 0.83, 0.056] };
const UP = { shoulder: [0.19, 1.39, 0], elbow: [0.31, 1.2, 0.12], wrist: [0.39, 1.36, 0.28], hand: [0.4, 1.43, 0.305] };
const SHIRT_HUE = new Color(SHIRT);
const LIPS = new Color(0xe6c8d4);
/** His lids, and the line of his mouth. */
const LID = 0x3a2436;
const MOUTH = 0x9a6478;
const WHITE = new Color(0xffffff);
const SILVER_HUE = new Color(SILVER);

const toward = (from, to, share) => from.map((value, axis) => value + (to[axis] - value) * share);
const between = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];

/** How much of a point turns with his head (0 below the neck, 1 above, eased through it; never his raised hand). */
function headShare(x, y, z) {
    if (Math.abs(x) > 0.15 || z > 0.16) return 0;
    const t = Math.min(1, Math.max(0, (y - 1.45) / 0.09));
    return t * t * (3 - 2 * t);
}

/** His skin's own colour (his mood colours it in the shader): white, his lips a little rose, his hand's palm silver. */
function skinColour(x, y, z) {
    if (Math.hypot(x - UP.hand[0], y - UP.hand[1], z - UP.hand[2]) < 0.05) return SILVER_HUE;
    const lips = Math.hypot(x / 0.026, (y - 1.552) / 0.009, 0) < 1 && z > 0.06;
    return lips ? LIPS : WHITE;
}

/** The figure's layers (sculpt.js): skin, shirt, trousers, apron, the crown of his hair. */
function layers() {
    const skin = [
        // The skull, the face beneath it (its jaw a little square), his cheekbones.
        egg([0, 1.625, -0.006], [0.077, 0.097, 0.09]),
        egg([0, 1.568, 0.014], [0.063, 0.064, 0.07]),
        ball([0.045, 1.612, 0.04], 0.021),
        ball([-0.045, 1.612, 0.04], 0.021),
        // His neck.
        limb([0, 1.43, -0.014], [0, 1.55, -0.004], 0.045, 0.041),
        // His forearms (the sleeves rolled to the elbow) and hands, open: the palm, the fingers together (a little
        // apart from the palm, as a hand's are), the thumb: one at his side, relaxed; one flat on the plaque.
        limb(SIDE.elbow, SIDE.wrist, 0.037, 0.027),
        egg(SIDE.hand, [0.02, 0.042, 0.036], [0.12, 0, 0.05]),
        egg([-0.255, 0.765, 0.06], [0.016, 0.042, 0.033], [0.2, 0, 0.06]),
        limb([-0.238, 0.848, 0.08], [-0.236, 0.806, 0.09], 0.01, 0.008),
        limb(UP.elbow, UP.wrist, 0.037, 0.027),
        egg(UP.hand, [0.035, 0.044, 0.016], [-0.25, -0.2, 0]),
        egg([0.405, 1.49, 0.318], [0.032, 0.046, 0.012], [-0.25, -0.2, 0]),
        limb([0.37, 1.4, 0.298], [0.352, 1.44, 0.315], 0.0105, 0.0085),
    ];
    for (const side of [-1, 1]) {
        const x = side * 0.088;
        // An ankle below the rolled trousers, a bare foot, its toes melted together (webbed).
        skin.push(limb([x, 0.05, -0.008], [x, 0.26, -0.004], 0.037, 0.043));
        skin.push(egg([x, 0.034, 0.045], [0.046, 0.032, 0.112]));
        [[-0.026, 0.019, 0.152], [-0.008, 0.015, 0.149], [0.008, 0.014, 0.144], [0.022, 0.012, 0.136]].forEach(([dx, r, z]) => {
            skin.push(ball([x - side * dx, 0.022, z], r));
        });
    }
    // His shirt: the body of it, broad at the shoulders and taken in at the waist, tucked in; the collar.
    const shirt = [
        egg([0, 1.31, -0.004], [0.158, 0.135, 0.1], [0.08, 0, 0]),
        egg([0, 1.15, -0.01], [0.132, 0.12, 0.088]),
        egg([0, 1.01, -0.006], [0.142, 0.07, 0.096]),
        limb([-0.15, 1.418, -0.012], [0.15, 1.418, -0.012], 0.05),
        band([0, 1.452, -0.006], [0, 1, 0.18], 0.055, 0.011),
    ];
    // Its sleeves (a seam where they meet it), rolled up to the elbow.
    const sleeves = [
        ball([-0.178, 1.402, -0.008], 0.054),
        ball([0.178, 1.402, -0.008], 0.054),
        limb(SIDE.shoulder, SIDE.elbow, 0.047, 0.041),
        limb(UP.shoulder, UP.elbow, 0.047, 0.041),
        band(toward(SIDE.elbow, SIDE.shoulder, 0.1), between(SIDE.shoulder, SIDE.elbow), 0.042, 0.012),
        band(toward(UP.elbow, UP.shoulder, 0.1), between(UP.shoulder, UP.elbow), 0.042, 0.012),
    ];
    const trousers = [egg([0, 0.925, -0.006], [0.163, 0.11, 0.108])];
    for (const side of [-1, 1]) {
        const x = side * 0.088;
        trousers.push(limb([x, 0.9, 0], [side * 0.093, 0.5, 0.014], 0.082, 0.058));
        trousers.push(limb([side * 0.093, 0.5, 0.014], [x, 0.272, 0.0], 0.056, 0.05));
        // Rolled at the ankle.
        trousers.push(band([side * 0.089, 0.27, 0.002], [0, 1, 0], 0.05, 0.013));
    }
    // The bar apron, hanging from the waist to above the knees over the front (the front of a solid, the rest of it
    // within the trousers: a sheet thinner than the sculpting's cubes would come apart), and its tie.
    const apron = [
        cut(egg([0, 0.82, -0.004], [0.176, 0.31, 0.124]), (x, y, z) => Math.max(0.57 - y, y - 1.03, 0.04 - z)),
        egg([0, 1.012, -0.006], [0.15, 0.016, 0.1]),
    ];
    // The crown of his hair, swept back from his brow (cut by a plane leaning back from his forehead), over his ears,
    // and full behind his neck.
    const brow = (x, y, z) => (z - 0.035 - 0.55 * (y - 1.655)) / 1.141;
    const hair = [
        cut(egg([0, 1.648, -0.018], [0.088, 0.103, 0.1]), brow),
        cut(egg([0.07, 1.585, -0.022], [0.03, 0.062, 0.056]), brow),
        cut(egg([-0.07, 1.585, -0.022], [0.03, 0.062, 0.056]), brow),
        egg([0, 1.555, -0.072], [0.084, 0.09, 0.058]),
    ];
    // His face's own shapes, melted finely (the skin's melt is broader than they are, and would smooth them away): a
    // straight nose, his chin, the ridge of his brow.
    const features = [
        limb([0, 1.636, 0.08], [0, 1.597, 0.1], 0.0085, 0.0115),
        ball([0, 1.509, 0.041], 0.021),
        egg([0, 1.655, 0.066], [0.054, 0.011, 0.02]),
    ];
    return [
        { shapes: skin, melt: 0.03, colour: skinColour, skin: true },
        { shapes: features, melt: 0.01, colour: skinColour, skin: true },
        { shapes: shirt, melt: 0.045, colour: SHIRT_HUE },
        { shapes: sleeves, melt: 0.03, colour: SHIRT_HUE },
        { shapes: trousers, melt: 0.035, colour: new Color(TROUSERS) },
        { shapes: apron, melt: 0, colour: new Color(APRON) },
        { shapes: hair, melt: 0.025, colour: new Color(HAIR), hair: true },
    ];
}

/** A piece made apart from the sculpted body (a lock, a brow, an eye): its attributes as the body's. */
function apart(geometry, skinValue = 0, turns = headShare) {
    // (Kept indexed, as the body is: its vertices shared.)
    const flat = geometry;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    const position = flat.attributes.position;
    const skin = new Float32Array(position.count).fill(skinValue);
    const head = new Float32Array(position.count);
    for (let v = 0; v < position.count; v += 1) head[v] = turns(position.getX(v), position.getY(v), position.getZ(v));
    flat.setAttribute('skin', new Float32BufferAttribute(skin, 1));
    flat.setAttribute('head', new Float32BufferAttribute(head, 1));
    for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'color', 'skin', 'head'].includes(name)) flat.deleteAttribute(name);
    return flat;
}

/**
 * A tapering tube (kit.js), closed at both ends by a ball of its own width there: an open end, seen into, is a hole,
 * and the ink draws a hole as a speck.
 */
function closedTube(points, fromRadius, toRadius, colour, segments, radial) {
    const ends = [[points[0], fromRadius], [points.at(-1), toRadius]].map(([at, radius]) => paint(pose(new SphereGeometry(radius, radial + 1, Math.max(3, radial - 1)), { x: at.x, y: at.y, z: at.z }), colour));
    return mergeGeometries([taperedTube(points, fromRadius, toRadius, colour, segments, radial), ...ends], false);
}

/**
 * Lay a curl on him (hair drapes; it never passes into him): each point past its roots that's within the curl's own
 * width of his surface is pushed out along the way his surface faces there, to rest just on it. (Through him, the ink
 * would outline each sliver of curl showing between as a speck.)
 */
function drape(points, radiusAt, touch) {
    const e = 0.004;
    points.forEach((point, index) => {
        if (index < 2) return;
        const rest = radiusAt(index / (points.length - 1)) + 0.004;
        for (let pass = 0; pass < 3; pass += 1) {
            const d = touch(point.x, point.y, point.z);
            if (d >= rest) break;
            const gx = touch(point.x + e, point.y, point.z) - touch(point.x - e, point.y, point.z);
            const gy = touch(point.x, point.y + e, point.z) - touch(point.x, point.y - e, point.z);
            const gz = touch(point.x, point.y, point.z + e) - touch(point.x, point.y, point.z - e);
            const length = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
            point.x += (gx / length) * (rest - d);
            point.y += (gy / length) * (rest - d);
            point.z += (gz / length) * (rest - d);
        }
    });
    return points;
}

/** His long curls: from the crown down his back past his shoulders, and over the front of each shoulder. */
async function curls(touch) {
    const locks = [];
    // [round the head (radians from straight behind), where it starts (height), where it ends (height), its fall's
    // lean outward, front: over the shoulder]
    const falls = [
        [0, 1.6, 1.2, 0], [0.32, 1.61, 1.22, 0.01], [-0.32, 1.61, 1.21, 0.01], [0.64, 1.62, 1.25, 0.02], [-0.64, 1.62, 1.24, 0.02],
        [0.95, 1.6, 1.28, 0.03], [-0.95, 1.6, 1.27, 0.03], [0.16, 1.58, 1.17, 0], [-0.16, 1.58, 1.18, 0], [0.48, 1.57, 1.2, 0.02],
        [-0.48, 1.57, 1.19, 0.02], [0.8, 1.57, 1.24, 0.03], [-0.8, 1.57, 1.23, 0.03],
    ];
    // (Breathing between locks, by the clock: kit.js breathe. Each is laid on him by asking his surface, and the whole
    // head of them ran long on a phone.)
    for (const [index, [round, top, end, lean]] of falls.entries()) {
        if (breatheDue()) await breathe();
        const points = [];
        const steps = 9;
        for (let s = 0; s <= steps; s += 1) {
            const t = s / steps;
            const y = top + (end - top) * t;
            // Round the back of the head, then down over the back, falling a little outward; waved, and curling at the end.
            const out = 0.09 + 0.03 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) + lean * t;
            const wave = Math.sin(t * Math.PI * 3 + index * 1.7) * 0.012 * t + (t > 0.85 ? Math.sin((t - 0.85) * 20) * 0.01 : 0);
            const x = Math.sin(round) * out + Math.cos(round) * wave;
            const z = -Math.cos(round) * out - 0.012 - Math.sin(round) * wave * 0.5;
            points.push(new Vector3(x, y, z));
        }
        locks.push(closedTube(drape(points, (t) => 0.022 - 0.015 * t, touch), 0.022, 0.007, index % 3 === 1 ? HAIR_LIGHT : HAIR, 26, 7));
    }
    // Framing his face, and falling over the front of each shoulder: fine strands, three apiece, waved.
    for (const side of [-1, 1]) {
        for (const [ahead, end, phase, spread] of [[0.0, 1.33, 0.4, 0.0], [0.02, 1.3, 2.2, 0.012], [0.035, 1.35, 4.1, 0.024]]) {
            if (breatheDue()) await breathe();
            const points = [];
            const steps = 10;
            for (let s = 0; s <= steps; s += 1) {
                const t = s / steps;
                // (From within the crown at the temple: its root never shows.)
                const y = 1.64 + (end - 1.64) * t;
                const x = side * (0.068 + spread * t + 0.06 * Math.sin(Math.min(1, t * 1.8) * Math.PI * 0.5) + Math.sin(t * Math.PI * 3 + phase) * 0.007 * t);
                const z = 0.012 + (0.055 + ahead) * Math.min(1, t * 1.5);
                points.push(new Vector3(x, y, z));
            }
            locks.push(closedTube(drape(points, (t) => 0.009 - 0.006 * t, touch), 0.009, 0.003, phase > 3 ? HAIR : HAIR_LIGHT, 26, 6));
        }
    }
    // (A curl turns with his head toward its root, not where it lies on his back.)
    return locks.map((lock) => apart(lock, 0, (x, y, z) => headShare(x, Math.min(1.53, 1.45 + Math.max(0, y - 1.5) * 0.9), z) * Math.min(1, Math.max(0, (y - 1.42) / 0.16))));
}

/** His brows (golden), his violet eyes set under dark lids, and his mouth, a fine line. */
function features() {
    const pieces = [];
    for (const side of [-1, 1]) {
        // (On the brow ridge: the skull's own front there, a little proud of it.)
        const brow = [new Vector3(side * 0.012, 1.659, 0.086), new Vector3(side * 0.033, 1.667, 0.075), new Vector3(side * 0.054, 1.662, 0.061)];
        pieces.push(apart(closedTube(brow, 0.005, 0.003, HAIR_LIGHT, 8, 5)));
        // An eye, a little almond (wider than tall), set in the face; its upper lid a dark line over it.
        pieces.push(apart(paint(pose(new SphereGeometry(0.0088, 12, 9), { x: side * 0.03, y: 1.634, z: 0.077, sx: 1.25, sy: 0.85 }), EYES)));
        const lid = [new Vector3(side * 0.018, 1.636, 0.083), new Vector3(side * 0.03, 1.6425, 0.085), new Vector3(side * 0.042, 1.6375, 0.079)];
        pieces.push(apart(closedTube(lid, 0.0024, 0.0016, LID, 8, 5)));
    }
    const mouth = [new Vector3(-0.019, 1.5515, 0.083), new Vector3(0, 1.5535, 0.0875), new Vector3(0.019, 1.5515, 0.083)];
    pieces.push(apart(closedTube(mouth, 0.0026, 0.0026, MOUTH, 8, 5)));
    return pieces;
}

/** Silver dripped from his hand to the pavement below it (as it did when he was a child, and does when he's glad). */
function drips() {
    return [[0.4, 0.004, 0.31, 0.04], [0.36, 0.004, 0.36, 0.025], [0.44, 0.004, 0.27, 0.02]].map(([x, y, z, r]) => apart(paint(pose(new ConeGeometry(r, 0.006, 10), { x, y, z }), SILVER), 0, () => 0));
}

/** Allison, sculpted: the body (sculpt.js) and what's made apart from it, as one geometry, drawn at TALL. */
async function sculptedAllison() {
    const body = await sculpt({
        layers: layers(),
        from: [-0.33, -0.012, -0.21],
        to: [0.48, 1.79, 0.4],
        cell: 0.013,
        extra: {
            skin: (x, y, z, layer) => (layer.skin && skinColour(x, y, z) !== SILVER_HUE ? 1 : 0),
            head: (x, y, z) => headShare(x, y, z),
        },
    });
    const pieces = [body, ...(await curls(distanceOf(layers()))), ...features(), ...drips()];
    await breathe();
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(TALL / H, TALL / H, TALL / H);
    return geometry;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {[number, number, number]} options.at - where he stands
 * @param {number} options.facing - the way he faces (radians, 0 = +z): to the plaque
 * @param {import('three').Texture} options.gradientMap - the city's toon steps
 * @param {boolean} options.reducedMotion
 */
export async function createAllison({ at, facing, gradientMap, reducedMotion }) {
    // (Sculpted, a trial: ?sculpted=off, the figure he was.)
    const sculpted = trialOn('sculpted');
    const geometry = sculpted ? await sculptedAllison() : allisonGeometry();
    const uniforms = {
        allisonJoy: { value: 0 },
        allisonTime: { value: 0 },
        allisonTurn: { value: 0 },
        allisonCalm: { value: EGGSHELL.clone() },
        allisonWheat: { value: WHEAT.clone() },
        allisonMagenta: { value: MAGENTA.clone() },
        allisonVeins: { value: VEINS.clone() },
    };
    const material = new MeshToonMaterial({ gradientMap, vertexColors: true, color: 0xffffff });
    const neck = sculpted ? new Vector3(0, (1.47 * TALL) / H, 0) : NECK.clone().multiplyScalar(TALL / 1.5);
    alsoBeforeCompile(material, 'allison', (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', [
                '#include <common>',
                'attribute float skin;',
                'attribute float head;',
                'uniform float allisonJoy;',
                'uniform float allisonTime;',
                'uniform float allisonTurn;',
                'uniform vec3 allisonCalm;',
                'uniform vec3 allisonWheat;',
                'uniform vec3 allisonMagenta;',
                'varying float vAllisonSkin;',
                'varying vec3 vAllisonVein;',
            ].join('\n'))
            .replace('#include <beginnormal_vertex>', [
                '#include <beginnormal_vertex>',
                '// His head turns about his neck, the neck easing through the turn (head: how much of a point turns).',
                'float allisonAngle = allisonTurn * head;',
                'mat3 allisonLook = mat3(cos(allisonAngle), 0.0, -sin(allisonAngle), 0.0, 1.0, 0.0, sin(allisonAngle), 0.0, cos(allisonAngle));',
                'objectNormal = allisonLook * objectNormal;',
            ].join('\n'))
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                `transformed = allisonLook * (transformed - vec3(0.0, ${neck.y.toFixed(4)}, 0.0)) + vec3(0.0, ${neck.y.toFixed(4)}, 0.0);`,
            ].join('\n'))
            .replace('#include <color_vertex>', [
                '#include <color_vertex>',
                '// Calm, bluish white; glad, pulsing wheat-yellow and blood-magenta, in waves up from his feet.',
                'float allisonPulse = 0.5 + 0.5 * sin(allisonTime * 5.0 - position.y * 6.0);',
                'vec3 allisonGlad = mix(allisonWheat, allisonMagenta, allisonPulse);',
                'vColor.rgb = mix(vColor.rgb, vColor.rgb * mix(allisonCalm, allisonGlad, allisonJoy), skin);',
                'vAllisonSkin = skin;',
                'vAllisonVein = position * 11.0;',
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 allisonVeins;\nvarying float vAllisonSkin;\nvarying vec3 vAllisonVein;')
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                '// His skin veined with silver: fine lines, wandering and branching (two weaves of them), over all his skin.',
                'vec3 allisonAt = vAllisonVein;',
                'float allisonA = abs(sin(allisonAt.x * 3.1 + sin(allisonAt.y * 2.3 + allisonAt.z * 1.7) * 1.9 + allisonAt.y * 0.7));',
                'float allisonB = abs(sin(allisonAt.z * 2.7 + sin(allisonAt.x * 1.9 - allisonAt.y * 2.9) * 2.1 - allisonAt.y * 1.1));',
                'float allisonVein = max(1.0 - smoothstep(0.0, 0.09, allisonA), 0.7 * (1.0 - smoothstep(0.0, 0.06, allisonB))) * vAllisonSkin;',
                'diffuseColor.rgb = mix(diffuseColor.rgb, allisonVeins, allisonVein * 0.8);',
            ].join('\n'));
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'allison';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(...at);
    mesh.rotation.y = facing;
    const where = new Vector3(...at);
    /** Where his line is shown and a tap finds him: just above his head. */
    const point = new Vector3(at[0], at[1] + TALL + 0.12, at[2]);
    let visitor = null;
    let joy = 0;
    let turn = 0;
    let greeted = -Infinity;
    let last = 0;

    return {
        object: mesh,
        material,
        point,
        /** His body, as a ball (a tap anywhere on him finds him). */
        body: { center: new Vector3(at[0], at[1] + TALL * 0.55, at[2]), radius: 0.42 },
        /** He's spoken to (someone's near, or the pointer's over him): he's glad. */
        greet(elapsed) {
            greeted = elapsed;
        },
        /** Where the one who's come is, or null: he turns to them. */
        notice(position) {
            visitor = position;
        },
        update(elapsed) {
            const dt = Math.min(0.1, Math.max(0, elapsed - last));
            last = elapsed;
            uniforms.allisonTime.value = reducedMotion ? 0.3 : elapsed;
            let want = reducedMotion ? 0 : Math.sin(elapsed * 0.4) * 0.15 - 0.1;
            let glad = elapsed - greeted < 6 ? 1 : 0;
            if (visitor) {
                const dx = visitor.x - where.x;
                const dz = visitor.z - where.z;
                if (Math.hypot(dx, dz) < NOTICE) {
                    const toward = Math.atan2(dx, dz) - facing;
                    want = Math.max(-1.3, Math.min(1.3, Math.atan2(Math.sin(toward), Math.cos(toward))));
                    glad = 1;
                }
            }
            const ease = reducedMotion ? 1 : 1 - Math.exp(-3 * dt);
            turn += (want - turn) * ease;
            joy += (glad - joy) * (reducedMotion ? 1 : 1 - Math.exp(-1.5 * dt));
            uniforms.allisonTurn.value = turn;
            uniforms.allisonJoy.value = joy;
        },
    };
}

/**
 * Elm's bio, as her site's bio page has it (its first part: who she is, in her words), read from the page itself so
 * it's always as she has it there: the title line, the paragraphs, the italics, and the links (as links to go on to).
 * @param {string} html - bio.html
 * @returns {{ text: string, italic: string[], links: { href: string, label: string }[] } | null}
 */
export function bioFrom(html) {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const block = page.querySelector('.bio-text');
    if (!block) return null;
    const paragraphs = [];
    const italic = [];
    const links = [];
    for (const paragraph of block.querySelectorAll('p')) {
        const words = paragraph.textContent.replace(/\s+/g, ' ').trim();
        const linked = [...paragraph.querySelectorAll('a')];
        for (const link of linked) {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('mailto:') || /google\./.test(href)) continue;
            // (Compared once resolved: an address with its closing slash and the same without are one place, listed once.)
            const resolved = new URL(href, new URL('../', window.location.href)).href;
            if (!links.some((known) => known.href === resolved)) links.push({ href: resolved, label: link.textContent.trim() });
        }
        // (The line of links alone, and the search link at its foot, are links to go on to, not words of the bio.)
        const bare = paragraph.cloneNode(true);
        for (const link of bare.querySelectorAll('a')) link.remove();
        const own = bare.textContent.replace(/[—–\s]+/g, ' ').trim();
        if (!paragraph.classList.contains('bio-title') && own.split(' ').filter(Boolean).length < 3) continue;
        paragraphs.push(words);
        for (const emphasis of paragraph.querySelectorAll('em, i, cite')) italic.push(emphasis.textContent.trim());
    }
    return paragraphs.length ? { text: paragraphs.join('\n\n'), italic, links } : null;
}
