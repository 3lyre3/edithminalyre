/**
 * creatures.js — the givers of Numbers by Paint (a trial, trials.js; ?creatures=off brings back the points of light).
 *
 * Elm: "The ones who gives you bits of Numbers by Paint when you interact with them should just be pugs and other hums
 * with their own custom shades/shadows underneath them. They should just say *chirp* and the pugs should just say
 * *squur* and - very important note - none of these pugs are dogs as we're familiar with them. They have human faces
 * and their bodies are those of tiny pug-sized bulls. They can stand in front of boards though."
 *
 * The pugs are Pug as Numbers by Paint has him (p. 57): "His squashed, pink nose snarls breath past a protruding lip …
 * Face of a man, body of a newborn calf … Pug the mini monster, half bull, half boy. Tiny hooves clattering like
 * stiletto tips." A bull calf no bigger than a pug, knobbly-kneed, with horn-buds, a pug's black ears and black mask,
 * a tail that curls over its back as a pug's does and ends in a bull's tuft, and tiny black hooves; and in the mask a
 * man's face, each its own, with a squashed pink nose and a protruding lip. Each stands in front of a board, a picture
 * to be painted by numbers: when it gives its passage, the paint goes in, number by number.
 *
 * The hums are the bridgework's (hums.js: "a loud, bronze hummingbird, dripping with steam"), kin to the one you fly
 * as (hum.js), each in a bronze of its own, hovering where its passage waits, wings a blur.
 *
 * Under each lies a shade of its own, as the wraith's lies under the hum you fly as: from just beneath it, away from
 * the light, about as long as the one who'd cast it is tall (the hum's sun: walk.js), laid over the floor as the
 * floor lies (down steps, fading where the floor ends). The hums' shades are wraiths, each its own; the pugs' are the
 * other half of what they are, boys with bulls' heads, each standing its own way.
 *
 * They're where data/creatures.json puts them (beside the passage each gives). Approached, or with the pointer over
 * them, they say their word (main.js shows it, where a place's name would be) and turn to the one who's come; given
 * their passage, a pug's board fills with its paint and the pug hops, a hum loops. A handful of draws for all of
 * them: the pugs and their faces, their boards, the hums, their wings' blur, their steam, and the shades.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    CircleGeometry,
    Color,
    ConeGeometry,
    CustomBlending,
    CylinderGeometry,
    DoubleSide,
    DstColorFactor,
    Euler,
    Float32BufferAttribute,
    InstancedBufferAttribute,
    InstancedMesh,
    LinearMipmapLinearFilter,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    Quaternion,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Vector3,
    ZeroFactor,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blurGeometry, humGeometry } from './hum.js';
import { birdMaterial, createSteam } from './hums.js';
import { alsoBeforeCompile, paint, pose, taperedTube } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** What each says (Elm's words). */
export const SPEECH = Object.freeze({ pug: 'squur', hum: 'chirp' });

/** The pug's parts, as its shader moves them: the body stands; the head (and its face) turns; the tail wags. */
const PART = { body: 0, head: 1, tail: 2, face: 3 };
/** Where the head turns about (the top of the neck), and the tail (its root), in the pug's own frame (+z ahead). */
const NECK = new Vector3(0, 0.27, 0.14);
const TAIL_ROOT = new Vector3(0, 0.25, -0.17);
/** How much bigger than drawn below the pug stands (about a pug's size, a calf's shape; big enough that its face reads). */
const PUG_SIZE = 1.3;
/** The flat front of its head, where the face is set (z, as drawn), and the face's radius there. */
const FACE_FRONT = 0.25;
const FACE_RADIUS = 0.076;
/** Its coat, before each pug's own colour is laid over it (pale, so the colour comes through); its mask and hooves. */
const COAT = 0xf2e2c8;
const MASK = 0x2a211c;
const HOOF = 0x15100d;
const HORN = 0xeee3c6;
/**
 * The pugs' coats, one each in turn (laid over the pale coat above; warm enough to read as a calf's in the dusk's
 * violet light): fawn, apricot, brindle, silver-fawn, chocolate, black, a deep fawn.
 */
const COATS = [0xd29a5a, 0xdc9050, 0x8e6444, 0xb4a08a, 0x6e4630, 0x2e2622, 0xc08048];

/** The faces' atlas: 4 × 4 cells of 256 px; the last cell is plain white, where the body's colours read through. */
const FACE_ATLAS = 1024;
const FACE_CELLS = 4;
const FACE_WHITE = [0.875, 0.125];

/**
 * The boards' atlas: cells 256 × 160, four across (each board's unpainted picture, then its painted one), six down.
 * (A picture is laid out 256 × 192, the board's own shape, and drawn into its cell squeezed; the board stretches it
 * back.)
 */
const BOARD_ATLAS = 1024;
const BOARD_CELL = [256, 160];
const BOARD_LAYOUT = [256, 192];
const BOARD_WHITE = [0.5, 0.03];
/** The board's paints, by number (1 to 7); the numbers paint in in order. */
const BOARD_PAINTS = ['#3b2a5c', '#c86b6f', '#f1c35a', '#3f6f8f', '#efe2c4', '#b0502c', '#6a4a2a'];
const BOARD_PAPER = '#efe6d2';
const BOARD_LINE = '#5a4a3a';
const WOOD = 0x8a5a32;
/** How long a board takes to paint itself in (seconds). */
const PAINT_SECONDS = 2.6;

/** The shades' atlas: cells 128 × 336, eight across, three down; each figure stands feet down in its cell. */
const SHADE_ATLAS = 1024;
const SHADE_CELL = [128, 336];
/** A shade's length and breadth on the floor, by the one who'd cast it (the hums' are a little taller). */
const SHADE_SIZE = { hum: [1.25, 0.5], pug: [1.05, 0.46] };
/** How dark a shade lies (the colour the floor is multiplied toward), and how much. */
const SHADE_TINT = new Color(0.3, 0.24, 0.42);
const SHADE_DEPTH = 0.72;

/** The hums: how big (over hum.js's bird), and their bronzes (laid over the bird's own colours). */
const HUM_SIZE = 1.5;
const PATINAS = [0xffffff, 0xd8f0e0, 0xffe0c8, 0xf0e8ff, 0xfff0b8, 0xe0ffe8, 0xffd8d0, 0xe8f4ff, 0xfff8e8];
const PUFFS = 3;
const LIFE = 1.7;

/** How near (metres) the one who's come must be for a creature to turn to them. */
const NOTICE = 4.5;

// =============================================================================
// Faces
// =============================================================================

/**
 * Each pug's face (a man's, each its own): skin, hair and how it's cut, brows, eyes, extras. All have Pug's squashed,
 * pink nose and protruding lip.
 */
const FACES = [
    { skin: '#e9c4a0', hair: '#5a3a22', cut: 'part', eyes: '#5b3a1e', brows: 'worried', extra: 'freckles' },
    { skin: '#c99a72', hair: '#1d1612', cut: 'curls', eyes: '#3a2414', brows: 'worried', extra: 'moustache' },
    { skin: '#8d5a3b', hair: '#18110d', cut: 'crop', eyes: '#2a1a10', brows: 'calm', extra: 'stubble' },
    { skin: '#f2d4bc', hair: '#b4562a', cut: 'fringe', eyes: '#3d6a8a', brows: 'worried', extra: 'freckles' },
    { skin: '#6b4228', hair: '#b8b2a8', cut: 'crop', eyes: '#2a1a10', brows: 'calm', extra: 'beard' },
    { skin: '#dcab84', hair: '#d9b25c', cut: 'mop', eyes: '#4a6a3a', brows: 'surprised', extra: 'cheeks' },
    { skin: '#a8714c', hair: '#120d0a', cut: 'slick', eyes: '#3a2414', brows: 'worried', extra: 'moustache' },
    { skin: '#e4b996', hair: '#e8e2d8', cut: 'bald', eyes: '#4a5a6a', brows: 'bushy', extra: 'cheeks' },
    { skin: '#b9825c', hair: '#2a1a12', cut: 'bowl', eyes: '#3a2414', brows: 'surprised', extra: null },
    { skin: '#9a6440', hair: '#0f0b09', cut: 'bun', eyes: '#2a1a10', brows: 'calm', extra: 'stubble' },
    { skin: '#d6a07a', hair: '#3a2a1e', cut: 'curls', eyes: '#2a4a2a', brows: 'calm', extra: 'freckles' },
    { skin: '#7a4a30', hair: '#2a1a12', cut: 'part', eyes: '#3a2414', brows: 'surprised', extra: 'moustache' },
];

function shadeOf(hex, amount) {
    const color = new Color(hex);
    return `#${(amount < 0 ? color.lerp(new Color(0x000000), -amount) : color.lerp(new Color(0xffffff), amount)).getHexString()}`;
}

function drawHair(context, cx, cy, r, look) {
    context.fillStyle = look.hair;
    const top = cy - r * 0.86;
    const cap = (low) => {
        context.beginPath();
        context.ellipse(cx, cy - r * 0.28, r * 0.84, r * 0.66, 0, Math.PI, 0);
        context.lineTo(cx + r * 0.84, cy - r * low);
        context.quadraticCurveTo(cx, cy - r * (low + 0.12), cx - r * 0.84, cy - r * low);
        context.closePath();
        context.fill();
    };
    switch (look.cut) {
        case 'part':
            cap(0.38);
            context.strokeStyle = shadeOf(look.hair, 0.25);
            context.lineWidth = r * 0.04;
            context.beginPath();
            context.moveTo(cx - r * 0.3, top + r * 0.06);
            context.quadraticCurveTo(cx - r * 0.34, cy - r * 0.6, cx - r * 0.42, cy - r * 0.42);
            context.stroke();
            break;
        case 'curls':
            for (let k = 0; k < 9; k += 1) {
                const a = Math.PI + (k / 8) * Math.PI;
                context.beginPath();
                context.arc(cx + Math.cos(a) * r * 0.66, cy - r * 0.3 + Math.sin(a) * r * 0.56, r * 0.2, 0, Math.PI * 2);
                context.fill();
            }
            cap(0.5);
            break;
        case 'crop':
            cap(0.56);
            break;
        case 'fringe':
            cap(0.36);
            context.fillRect(cx - r * 0.62, cy - r * 0.5, r * 1.24, r * 0.16);
            break;
        case 'mop':
            context.beginPath();
            context.ellipse(cx, cy - r * 0.36, r * 0.94, r * 0.62, 0, Math.PI, 0);
            context.lineTo(cx + r * 0.9, cy - r * 0.2);
            for (let k = 0; k <= 6; k += 1) context.lineTo(cx + r * 0.9 - (k / 6) * r * 1.8, cy - r * (k % 2 ? 0.34 : 0.26));
            context.closePath();
            context.fill();
            break;
        case 'slick':
            cap(0.48);
            context.strokeStyle = shadeOf(look.hair, 0.35);
            context.lineWidth = r * 0.035;
            context.beginPath();
            context.arc(cx, cy - r * 0.3, r * 0.6, Math.PI * 1.15, Math.PI * 1.6);
            context.stroke();
            break;
        case 'bald':
            // Tufts above the ears, white.
            for (const side of [-1, 1]) {
                context.beginPath();
                context.ellipse(cx + side * r * 0.74, cy - r * 0.22, r * 0.12, r * 0.2, side * 0.3, 0, Math.PI * 2);
                context.fill();
            }
            break;
        case 'bowl':
            context.beginPath();
            context.ellipse(cx, cy - r * 0.32, r * 0.88, r * 0.66, 0, Math.PI, 0);
            context.lineTo(cx + r * 0.88, cy - r * 0.26);
            context.lineTo(cx - r * 0.88, cy - r * 0.26);
            context.closePath();
            context.fill();
            break;
        case 'bun':
            cap(0.5);
            context.beginPath();
            context.arc(cx, top + r * 0.02, r * 0.2, 0, Math.PI * 2);
            context.fill();
            break;
        default:
            break;
    }
}

/** A man's face in the pug's mask, in a cell `size` square at (x0, y0). */
function drawFace(context, x0, y0, size, look) {
    const cx = x0 + size / 2;
    const cy = y0 + size / 2;
    const r = size / 2;
    // The mask is the cell's ground (the head's front carries it on round the face).
    context.fillStyle = `#${new Color(MASK).getHexString()}`;
    context.fillRect(x0, y0, size, size);
    // The face, broad and a little low in the mask, softly shaded at its edge.
    const skin = context.createRadialGradient(cx - r * 0.18, cy - r * 0.2, r * 0.1, cx, cy + r * 0.05, r * 0.95);
    skin.addColorStop(0, shadeOf(look.skin, 0.1));
    skin.addColorStop(0.72, look.skin);
    skin.addColorStop(1, shadeOf(look.skin, -0.3));
    context.fillStyle = skin;
    context.beginPath();
    context.ellipse(cx, cy + r * 0.06, r * 0.8, r * 0.88, 0, 0, Math.PI * 2);
    context.fill();
    drawHair(context, cx, cy, r, look);
    if (look.extra === 'beard') {
        context.fillStyle = look.hair;
        context.beginPath();
        context.ellipse(cx, cy + r * 0.5, r * 0.62, r * 0.42, 0, 0, Math.PI);
        context.fill();
    }
    if (look.extra === 'cheeks') {
        context.fillStyle = 'rgba(226, 110, 110, 0.35)';
        for (const side of [-1, 1]) {
            context.beginPath();
            context.arc(cx + side * r * 0.46, cy + r * 0.2, r * 0.15, 0, Math.PI * 2);
            context.fill();
        }
    }
    if (look.extra === 'freckles') {
        context.fillStyle = shadeOf(look.skin, -0.35);
        for (let k = 0; k < 14; k += 1) {
            const side = k % 2 ? 1 : -1;
            context.beginPath();
            context.arc(cx + side * r * (0.3 + ((k * 37) % 17) / 70), cy + r * (0.06 + ((k * 53) % 13) / 90), r * 0.022, 0, Math.PI * 2);
            context.fill();
        }
    }
    if (look.extra === 'stubble') {
        context.fillStyle = 'rgba(30, 22, 18, 0.28)';
        context.beginPath();
        context.ellipse(cx, cy + r * 0.48, r * 0.56, r * 0.34, 0, 0, Math.PI);
        context.fill();
    }
    // Brows: worried (their inner ends raised), calm, surprised (high), or bushy.
    context.strokeStyle = look.brows === 'bushy' ? '#e8e2d8' : shadeOf(look.hair === '#e8e2d8' || look.hair === '#b8b2a8' ? '#6a5a4a' : look.hair, 0);
    context.lineCap = 'round';
    context.lineWidth = r * (look.brows === 'bushy' ? 0.11 : 0.07);
    for (const side of [-1, 1]) {
        const inner = look.brows === 'worried' ? -0.4 : look.brows === 'surprised' ? -0.46 : -0.3;
        const outer = look.brows === 'worried' ? -0.28 : look.brows === 'surprised' ? -0.42 : -0.32;
        context.beginPath();
        context.moveTo(cx + side * r * 0.14, cy + r * inner);
        context.quadraticCurveTo(cx + side * r * 0.32, cy + r * (Math.min(inner, outer) - 0.06), cx + side * r * 0.5, cy + r * outer);
        context.stroke();
    }
    // Eyes: big and round, a little bulging, as a pug's are; each with its light.
    for (const side of [-1, 1]) {
        const ex = cx + side * r * 0.31;
        const ey = cy - r * 0.08;
        context.fillStyle = '#f7f1e6';
        context.beginPath();
        context.ellipse(ex, ey, r * 0.17, r * 0.15, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = look.eyes;
        context.beginPath();
        context.arc(ex + side * r * 0.01, ey + r * 0.01, r * 0.105, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#0d0907';
        context.beginPath();
        context.arc(ex + side * r * 0.01, ey + r * 0.01, r * 0.055, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(ex - r * 0.04, ey - r * 0.045, r * 0.03, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = shadeOf(look.skin, -0.55);
        context.lineWidth = r * 0.035;
        context.beginPath();
        context.ellipse(ex, ey, r * 0.17, r * 0.15, 0, Math.PI * 1.08, Math.PI * 1.92);
        context.stroke();
    }
    // The squashed, pink nose: a man's nose, short and broad and turned up, its bridge low, its tip round and flushed
    // pink, its nostrils small curves beneath the tip (a person's, not a snout's).
    const pink = `#${new Color(look.skin).lerp(new Color(0xf08a8a), 0.45).getHexString()}`;
    const bridge = context.createLinearGradient(cx, cy - r * 0.12, cx, cy + r * 0.2);
    bridge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bridge.addColorStop(1, 'rgba(90, 40, 30, 0.22)');
    context.fillStyle = bridge;
    context.beginPath();
    context.moveTo(cx - r * 0.05, cy - r * 0.1);
    context.quadraticCurveTo(cx - r * 0.09, cy + r * 0.08, cx - r * 0.15, cy + r * 0.2);
    context.lineTo(cx + r * 0.15, cy + r * 0.2);
    context.quadraticCurveTo(cx + r * 0.09, cy + r * 0.08, cx + r * 0.05, cy - r * 0.1);
    context.closePath();
    context.fill();
    // Its wings, either side of the tip, and the tip itself.
    context.fillStyle = shadeOf(pink, -0.08);
    for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(cx + side * r * 0.12, cy + r * 0.215, r * 0.075, r * 0.06, 0, 0, Math.PI * 2);
        context.fill();
    }
    context.fillStyle = pink;
    context.beginPath();
    context.ellipse(cx, cy + r * 0.19, r * 0.11, r * 0.085, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 235, 225, 0.6)';
    context.beginPath();
    context.ellipse(cx - r * 0.025, cy + r * 0.155, r * 0.04, r * 0.022, -0.3, 0, Math.PI * 2);
    context.fill();
    // Nostrils: small dark curves under the tip, turned up.
    context.strokeStyle = 'rgba(70, 25, 22, 0.85)';
    context.lineWidth = r * 0.03;
    for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(cx + side * r * 0.07, cy + r * 0.255, r * 0.035, r * 0.018, side * 0.35, Math.PI * 0.05, Math.PI * 0.95);
        context.stroke();
    }
    if (look.extra === 'moustache') {
        context.fillStyle = look.hair;
        context.beginPath();
        context.ellipse(cx - r * 0.14, cy + r * 0.34, r * 0.17, r * 0.06, 0.2, 0, Math.PI * 2);
        context.ellipse(cx + r * 0.14, cy + r * 0.34, r * 0.17, r * 0.06, -0.2, 0, Math.PI * 2);
        context.fill();
    }
    // The mouth: an upper lip with its bow, and the protruding lip, the lower one, full and pushed out, catching the
    // light, a shadow under it.
    const lip = `#${new Color(look.skin).lerp(new Color(0xb4504c), 0.55).getHexString()}`;
    context.fillStyle = 'rgba(60, 25, 20, 0.22)';
    context.beginPath();
    context.ellipse(cx, cy + r * 0.585, r * 0.17, r * 0.045, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = lip;
    context.beginPath();
    context.moveTo(cx - r * 0.19, cy + r * 0.43);
    context.quadraticCurveTo(cx - r * 0.08, cy + r * 0.385, cx - r * 0.03, cy + r * 0.4);
    context.quadraticCurveTo(cx, cy + r * 0.385, cx + r * 0.03, cy + r * 0.4);
    context.quadraticCurveTo(cx + r * 0.08, cy + r * 0.385, cx + r * 0.19, cy + r * 0.43);
    context.quadraticCurveTo(cx, cy + r * 0.445, cx - r * 0.19, cy + r * 0.43);
    context.fill();
    context.fillStyle = shadeOf(lip, 0.08);
    context.beginPath();
    context.moveTo(cx - r * 0.18, cy + r * 0.435);
    context.quadraticCurveTo(cx, cy + r * 0.45, cx + r * 0.18, cy + r * 0.435);
    context.quadraticCurveTo(cx + r * 0.16, cy + r * 0.555, cx, cy + r * 0.565);
    context.quadraticCurveTo(cx - r * 0.16, cy + r * 0.555, cx - r * 0.18, cy + r * 0.435);
    context.fill();
    context.strokeStyle = shadeOf(lip, -0.45);
    context.lineWidth = r * 0.022;
    context.beginPath();
    context.moveTo(cx - r * 0.19, cy + r * 0.432);
    context.quadraticCurveTo(cx, cy + r * 0.452, cx + r * 0.19, cy + r * 0.432);
    context.stroke();
    context.fillStyle = 'rgba(255, 228, 218, 0.5)';
    context.beginPath();
    context.ellipse(cx - r * 0.04, cy + r * 0.49, r * 0.07, r * 0.022, 0, 0, Math.PI * 2);
    context.fill();
}

function faceAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = FACE_ATLAS;
    canvas.height = FACE_ATLAS;
    const context = canvas.getContext('2d');
    const cell = FACE_ATLAS / FACE_CELLS;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, FACE_ATLAS, FACE_ATLAS);
    FACES.forEach((look, index) => drawFace(context, (index % FACE_CELLS) * cell, Math.floor(index / FACE_CELLS) * cell, cell, look));
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    return { texture, canvas };
}

/** Where face `index`'s cell begins in the atlas (uv, from its lower left). */
function faceCell(index) {
    const col = index % FACE_CELLS;
    const row = Math.floor(index / FACE_CELLS);
    return [col / FACE_CELLS, 1 - (row + 1) / FACE_CELLS];
}

// =============================================================================
// Boards
// =============================================================================

/**
 * The boards' pictures, each laid out as regions in a box of 256 × 192 (y down): a polygon or a circle, its number
 * (its paint), and where its number is written. Every picture has its sky in two bands, a sun or a moon, its sea or
 * its ground, and a thing of its own.
 */
const MOTIFS = {
    cup: [
        { number: 6, poly: [[96, 92], [160, 92], [152, 150], [104, 150]] },
        { number: 5, poly: [[160, 102], [178, 104], [176, 128], [156, 132], [158, 122], [168, 120], [168, 110], [158, 110]] },
        { number: 7, poly: [[80, 150], [176, 150], [168, 160], [88, 160]] },
    ],
    flag: [
        { number: 7, poly: [[92, 46], [98, 46], [98, 168], [92, 168]] },
        { number: 2, poly: [[98, 48], [176, 60], [150, 80], [178, 100], [98, 104]] },
    ],
    flower: [
        { number: 4, poly: [[126, 104], [132, 104], [132, 168], [126, 168]] },
        { number: 2, poly: [[129, 52], [146, 70], [168, 74], [150, 90], [154, 112], [129, 100], [104, 112], [108, 90], [90, 74], [112, 70]] },
        { number: 3, circle: [129, 84, 10] },
    ],
    door: [
        { number: 6, poly: [[104, 64], [154, 64], [154, 168], [104, 168]] },
        { number: 3, poly: [[112, 74], [146, 74], [146, 104], [112, 104]] },
        { number: 5, circle: [144, 124, 4] },
    ],
    wave: [
        { number: 5, poly: [[40, 132], [80, 104], [118, 96], [146, 110], [130, 120], [110, 116], [96, 130], [124, 150], [40, 150]] },
    ],
    boat: [
        { number: 6, poly: [[70, 138], [186, 138], [170, 156], [86, 156]] },
        { number: 5, poly: [[126, 60], [126, 134], [176, 134]] },
        { number: 2, poly: [[120, 70], [120, 134], [84, 134]] },
    ],
    arch: [
        { number: 3, poly: [[40, 150], [40, 118], [60, 92], [96, 78], [128, 74], [160, 78], [196, 92], [216, 118], [216, 150], [200, 150], [196, 124], [176, 102], [148, 92], [108, 92], [80, 102], [60, 124], [56, 150]] },
    ],
    pump: [
        { number: 2, poly: [[100, 70], [146, 70], [146, 160], [100, 160]] },
        { number: 5, poly: [[108, 80], [138, 80], [138, 104], [108, 104]] },
        { number: 7, poly: [[146, 92], [168, 98], [172, 132], [164, 132], [162, 104], [146, 102]] },
    ],
    spire: [
        { number: 3, poly: [[120, 28], [136, 28], [148, 150], [108, 150]] },
        { number: 6, poly: [[128, 12], [138, 30], [118, 30]] },
    ],
    star: [
        { number: 5, poly: [[128, 50], [138, 80], [170, 80], [144, 98], [154, 128], [128, 110], [102, 128], [112, 98], [86, 80], [118, 80]] },
    ],
    jug: [
        { number: 6, poly: [[104, 70], [146, 70], [142, 84], [156, 104], [156, 150], [94, 150], [94, 104], [108, 84]] },
        { number: 5, poly: [[156, 96], [176, 98], [180, 120], [172, 136], [156, 138], [156, 128], [168, 124], [168, 108], [156, 106]] },
        { number: 3, poly: [[104, 70], [146, 70], [146, 62], [104, 62]] },
    ],
};

/** A picture's whole set of regions: its sky in two bands, its sun or moon, its sea or ground, and its own thing. */
function boardRegions(motif) {
    return [
        { number: 1, poly: [[0, 0], [256, 0], [256, 64], [0, 64]], at: [22, 34] },
        { number: 2, poly: [[0, 64], [256, 64], [256, 118], [0, 118]], at: [22, 98] },
        { number: 3, circle: [200, 70, 22], at: [200, 74] },
        { number: 4, poly: [[0, 118], [256, 118], [256, 160], [0, 160]], at: [22, 146] },
        { number: 7, poly: [[0, 160], [256, 160], [256, 192], [0, 192]], at: [22, 182] },
        ...(MOTIFS[motif] ?? MOTIFS.star),
    ];
}

function regionPath(context, region, x0, y0) {
    context.beginPath();
    if (region.circle) {
        const [x, y, radius] = region.circle;
        context.arc(x0 + x, y0 + y, radius, 0, Math.PI * 2);
    } else {
        region.poly.forEach(([x, y], index) => (index ? context.lineTo(x0 + x, y0 + y) : context.moveTo(x0 + x, y0 + y)));
        context.closePath();
    }
}

function labelPoint(region) {
    if (region.at) return region.at;
    if (region.circle) return [region.circle[0], region.circle[1] + 4];
    const xs = region.poly.map(([x]) => x);
    const ys = region.poly.map(([, y]) => y);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2 + 4];
}

/** Draw a board's picture twice: as bought (outlines and numbers on bare paper) and as painted. */
function drawBoard(context, cellX, cellY, motif) {
    context.save();
    context.translate(cellX, cellY);
    context.scale(1, BOARD_CELL[1] / BOARD_LAYOUT[1]);
    paintBoard(context, 0, 0, motif);
    context.restore();
}

function paintBoard(context, x0, y0, motif) {
    const regions = boardRegions(motif);
    const [width, height] = BOARD_LAYOUT;
    // As bought.
    context.fillStyle = BOARD_PAPER;
    context.fillRect(x0, y0, width, height);
    context.strokeStyle = BOARD_LINE;
    context.lineWidth = 2;
    context.lineJoin = 'round';
    for (const region of regions) {
        regionPath(context, region, x0, y0);
        if (region.number !== 1 && region.number !== 2 && region.number !== 4 && region.number !== 7) {
            context.fillStyle = BOARD_PAPER;
            context.fill();
        }
        context.stroke();
    }
    context.fillStyle = BOARD_LINE;
    context.font = '600 15px Georgia, serif';
    context.textAlign = 'center';
    for (const region of regions) {
        const [x, y] = labelPoint(region);
        context.fillText(String(region.number), x0 + x, y0 + y);
    }
    // Painted, in the cell to its right: each region its number's paint (the shader knows the numbers by them).
    const px = x0 + width;
    for (const region of regions) {
        regionPath(context, region, px, y0);
        context.fillStyle = BOARD_PAINTS[region.number - 1];
        context.fill();
    }
    // The frame of the board, on both.
    context.strokeStyle = '#3a2618';
    context.lineWidth = 6;
    context.strokeRect(x0 + 3, y0 + 3, width - 6, height - 6);
    context.strokeRect(px + 3, y0 + 3, width - 6, height - 6);
}

function boardAtlas(motifs) {
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_ATLAS;
    canvas.height = BOARD_ATLAS;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, BOARD_ATLAS, BOARD_ATLAS);
    motifs.forEach((motif, index) => {
        const [x, y] = boardOrigin(index);
        drawBoard(context, x, y, motif);
    });
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    return { texture, canvas };
}

/** Where board `index`'s unpainted picture begins in the atlas (px, y down). */
function boardOrigin(index) {
    return [(index % 2) * 2 * BOARD_CELL[0], Math.floor(index / 2) * BOARD_CELL[1]];
}

/** The same, as uv from its lower left. */
function boardCell(index) {
    const [x, y] = boardOrigin(index);
    return [x / BOARD_ATLAS, 1 - (y + BOARD_CELL[1]) / BOARD_ATLAS];
}

// =============================================================================
// Shades
// =============================================================================

/**
 * The shades, each its own: wraiths for the hums (the hood, the robe to the ground, and what each holds or wears), and
 * for the pugs, boys with bulls' heads, each standing its own way.
 */
const WRAITHS = [
    { hold: 'lantern' }, { wear: 'crown' }, { wear: 'hair' }, { hold: 'parasol' }, { hold: 'book' },
    { arms: 'wave' }, { hold: 'flower' }, { wear: 'wings' }, { wear: 'small', hold: 'balloon' },
];
const BULL_BOYS = [
    { arms: 'down' }, { arms: 'wave' }, { arms: 'hips' }, { hold: 'brush' }, { arms: 'up' },
    { hold: 'bucket' }, { hold: 'flower' }, { hold: 'staff' }, { arms: 'crossed' }, { arms: 'dance' },
    { hold: 'lantern' }, { hold: 'balloon' },
];

/** Draw a limb as a tapering stroke from (x0, y0) to (x1, y1). */
function limb(context, x0, y0, x1, y1, width) {
    context.lineWidth = width;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
}

/** An arm from the shoulder at (sx, sy), on `side` (-1 left, 1 right), posed. Returns where the hand is. */
function arm(context, sx, sy, side, pose, unit) {
    const reach = {
        down: [0.18, 0.95], out: [0.95, 0.35], wave: [0.6, -0.8], up: [0.3, -1], hips: [0.42, 0.45],
        crossed: [-0.5, 0.42], hold: [0.62, 0.55], dance: [0.85, -0.45],
    }[pose] ?? [0.18, 0.95];
    const length = unit * 1.1;
    let hx = sx + side * reach[0] * length;
    let hy = sy + reach[1] * length;
    if (pose === 'hips') {
        // Elbow out, hand back on the hip.
        const ex = sx + side * length * 0.62;
        const ey = sy + length * 0.45;
        limb(context, sx, sy, ex, ey, unit * 0.22);
        hx = sx + side * length * 0.18;
        hy = sy + length * 0.86;
        limb(context, ex, ey, hx, hy, unit * 0.2);
        return [hx, hy];
    }
    limb(context, sx, sy, hx, hy, unit * 0.22);
    return [hx, hy];
}

function drawHeld(context, hold, hx, hy, unit) {
    context.lineWidth = unit * 0.08;
    switch (hold) {
        case 'lantern':
            limb(context, hx, hy, hx, hy + unit * 0.35, unit * 0.06);
            context.fillRect(hx - unit * 0.16, hy + unit * 0.35, unit * 0.32, unit * 0.4);
            break;
        case 'parasol':
            limb(context, hx, hy + unit * 0.6, hx, hy - unit * 1.2, unit * 0.07);
            context.beginPath();
            context.ellipse(hx, hy - unit * 1.2, unit * 0.95, unit * 0.45, 0, Math.PI, 0);
            context.fill();
            break;
        case 'book':
            context.fillRect(hx - unit * 0.42, hy - unit * 0.22, unit * 0.84, unit * 0.36);
            break;
        case 'flower':
            limb(context, hx, hy, hx + unit * 0.1, hy - unit * 0.9, unit * 0.06);
            for (let k = 0; k < 5; k += 1) {
                const a = (k / 5) * Math.PI * 2;
                context.beginPath();
                context.arc(hx + unit * 0.1 + Math.cos(a) * unit * 0.16, hy - unit * 0.95 + Math.sin(a) * unit * 0.16, unit * 0.13, 0, Math.PI * 2);
                context.fill();
            }
            break;
        case 'balloon':
            limb(context, hx, hy, hx + unit * 0.2, hy - unit * 1.3, unit * 0.04);
            context.beginPath();
            context.ellipse(hx + unit * 0.22, hy - unit * 1.62, unit * 0.32, unit * 0.4, 0, 0, Math.PI * 2);
            context.fill();
            break;
        case 'brush':
            limb(context, hx, hy, hx + unit * 0.35, hy - unit * 0.6, unit * 0.07);
            context.beginPath();
            context.ellipse(hx + unit * 0.4, hy - unit * 0.7, unit * 0.09, unit * 0.18, 0.5, 0, Math.PI * 2);
            context.fill();
            break;
        case 'bucket':
            limb(context, hx, hy, hx, hy + unit * 0.2, unit * 0.05);
            context.beginPath();
            context.moveTo(hx - unit * 0.3, hy + unit * 0.2);
            context.lineTo(hx + unit * 0.3, hy + unit * 0.2);
            context.lineTo(hx + unit * 0.22, hy + unit * 0.7);
            context.lineTo(hx - unit * 0.22, hy + unit * 0.7);
            context.closePath();
            context.fill();
            break;
        case 'staff':
            limb(context, hx, hy - unit * 1.1, hx, hy + unit * 1.9, unit * 0.09);
            break;
        default:
            break;
    }
}

/** A wraith: the hood, the robe falling to a ragged hem, its arms in their sleeves, and what it holds or wears. */
function drawWraith(context, x0, y0, look) {
    const [width, height] = SHADE_CELL;
    const scale = look.wear === 'small' ? 0.72 : 1;
    const unit = (height * 0.92 * scale) / 8;
    const cx = x0 + width / 2;
    const feet = y0 + height - 4;
    const head = feet - unit * 7.2;
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';
    // Hood.
    context.beginPath();
    context.ellipse(cx, head + unit * 0.55, unit * 0.62, unit * 0.75, 0, 0, Math.PI * 2);
    context.fill();
    // Robe: from the shoulders to a wide, ragged hem.
    context.beginPath();
    context.moveTo(cx - unit * 0.62, head + unit * 1.1);
    context.quadraticCurveTo(cx - unit * 0.95, head + unit * 4, cx - unit * 1.35, feet - unit * 0.2);
    for (let k = 0; k <= 8; k += 1) context.lineTo(cx - unit * 1.35 + (k / 8) * unit * 2.7, feet - (k % 2 ? 0 : unit * 0.35));
    context.quadraticCurveTo(cx + unit * 0.95, head + unit * 4, cx + unit * 0.62, head + unit * 1.1);
    context.closePath();
    context.fill();
    if (look.wear === 'crown') {
        context.beginPath();
        context.moveTo(cx - unit * 0.55, head + unit * 0.05);
        for (let k = 0; k <= 4; k += 1) context.lineTo(cx - unit * 0.55 + k * unit * 0.275, head - (k % 2 ? 0 : unit * 0.5));
        context.lineTo(cx + unit * 0.55, head + unit * 0.05);
        context.closePath();
        context.fill();
    }
    if (look.wear === 'hair') {
        context.beginPath();
        context.moveTo(cx - unit * 0.5, head + unit * 0.3);
        context.quadraticCurveTo(cx - unit * 1.6, head + unit * 1.6, cx - unit * 1.9, head + unit * 3.4);
        context.quadraticCurveTo(cx - unit * 0.9, head + unit * 2.2, cx - unit * 0.2, head + unit * 1);
        context.closePath();
        context.fill();
    }
    if (look.wear === 'wings') {
        for (const side of [-1, 1]) {
            context.beginPath();
            context.moveTo(cx + side * unit * 0.4, head + unit * 1.6);
            context.quadraticCurveTo(cx + side * unit * 2.6, head + unit * 0.2, cx + side * unit * 1.9, head + unit * 3.4);
            context.quadraticCurveTo(cx + side * unit * 1.2, head + unit * 2.6, cx + side * unit * 0.6, head + unit * 2.8);
            context.closePath();
            context.fill();
        }
    }
    // Sleeves: the left down along the robe, the right as it's posed.
    const shoulder = head + unit * 1.45;
    arm(context, cx - unit * 0.6, shoulder, -1, 'down', unit);
    const [hx, hy] = arm(context, cx + unit * 0.6, shoulder, 1, look.arms ?? (look.hold ? 'hold' : 'down'), unit);
    drawHeld(context, look.hold, hx, hy, unit);
}

/** A boy with a bull's head: legs, body, arms as he stands, the broad head with its horns and ears. */
function drawBullBoy(context, x0, y0, look) {
    const [width, height] = SHADE_CELL;
    const unit = (height * 0.9) / 8;
    const cx = x0 + width / 2;
    const feet = y0 + height - 4;
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';
    const hip = feet - unit * 3.4;
    const dance = look.arms === 'dance';
    // Legs.
    limb(context, cx - unit * 0.32, hip, cx - unit * (dance ? 0.9 : 0.4), dance ? hip + unit * 2 : feet - unit * 0.1, unit * 0.42);
    limb(context, cx + unit * 0.32, hip, cx + unit * 0.42, feet - unit * 0.1, unit * 0.42);
    // Body.
    const shoulder = hip - unit * 2.4;
    context.beginPath();
    context.moveTo(cx - unit * 0.8, shoulder);
    context.lineTo(cx + unit * 0.8, shoulder);
    context.lineTo(cx + unit * 0.6, hip + unit * 0.2);
    context.lineTo(cx - unit * 0.6, hip + unit * 0.2);
    context.closePath();
    context.fill();
    // Arms.
    const poses = {
        down: ['down', 'down'], wave: ['down', 'wave'], hips: ['hips', 'hips'], up: ['up', 'up'], crossed: ['crossed', 'crossed'],
        dance: ['dance', 'out'],
    }[look.arms ?? 'hold'] ?? ['down', 'hold'];
    arm(context, cx - unit * 0.78, shoulder + unit * 0.15, -1, poses[0], unit);
    const [hx, hy] = arm(context, cx + unit * 0.78, shoulder + unit * 0.15, 1, poses[1], unit);
    drawHeld(context, look.hold, hx, hy, unit);
    // The bull's head: broad, its muzzle wide, horns up and out, ears out to the sides.
    const head = shoulder - unit * 0.95;
    context.beginPath();
    context.ellipse(cx, head, unit * 0.62, unit * 0.78, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(cx, head + unit * 0.55, unit * 0.48, unit * 0.36, 0, 0, Math.PI * 2);
    context.fill();
    for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(cx + side * unit * 0.4, head - unit * 0.45);
        context.quadraticCurveTo(cx + side * unit * 1.5, head - unit * 0.5, cx + side * unit * 1.25, head - unit * 1.5);
        context.quadraticCurveTo(cx + side * unit * 1.15, head - unit * 0.85, cx + side * unit * 0.45, head - unit * 0.15);
        context.closePath();
        context.fill();
        context.beginPath();
        context.ellipse(cx + side * unit * 0.85, head - unit * 0.05, unit * 0.36, unit * 0.15, side * 0.35, 0, Math.PI * 2);
        context.fill();
    }
}

function shadeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = SHADE_ATLAS;
    canvas.height = SHADE_ATLAS;
    const context = canvas.getContext('2d');
    // (Drawn sharp: the shader softens the edge, as a dusk shadow's is, and stipples it. A canvas blur filter did
    // that once, and cost a slow device seconds of drawing just as the swirl ended.)
    const across = SHADE_ATLAS / SHADE_CELL[0];
    const at = (index) => [(index % across) * SHADE_CELL[0], Math.floor(index / across) * SHADE_CELL[1]];
    WRAITHS.forEach((look, index) => drawWraith(context, ...at(index), look));
    BULL_BOYS.forEach((look, index) => drawBullBoy(context, ...at(WRAITHS.length + index), look));
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearMipmapLinearFilter;
    return { texture, canvas, cell: (index) => {
        const [x, y] = at(index);
        return [x / SHADE_ATLAS, 1 - (y + SHADE_CELL[1]) / SHADE_ATLAS, SHADE_CELL[0] / SHADE_ATLAS, SHADE_CELL[1] / SHADE_ATLAS];
    } };
}

const shadeVertex = /* glsl */ `
    attribute float keep;
    varying vec2 vUv;
    varying float vKeep;
    void main() {
        vUv = uv;
        vKeep = keep;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const shadeFragment = /* glsl */ `
    uniform sampler2D map;
    uniform vec3 tint;
    uniform float depth;
    varying vec2 vUv;
    varying float vKeep;
    void main() {
        // A little soft at its edge, as a dusk shadow is: read from a smaller step of the atlas than the screen
        // needs (its mipmaps), which blurs it by a few of its pixels, for nothing.
        float cover = texture2D(map, vUv, 1.5).a * vKeep;
        // Stippled at its edge, as graphite shades (as the wraith's shadow is: walk.js).
        float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float shade = smoothstep(0.3, 0.7, cover + (grain - 0.5) * 0.35) * depth;
        // Multiplied into what lies beneath (the blend is the floor's colour times this).
        gl_FragColor = vec4(mix(vec3(1.0), tint, shade), 1.0);
    }
`;

/**
 * A shade's strip of floor: from (x, z) along `way` for `length`, `breadth` across, laid on the floor as it lies
 * (`floorAt`), fading out where the floor ends or drops away. uv runs over its cell, feet to head.
 */
function shadeStrip({ x, y, z, way, length, breadth, cell, floorAt }) {
    const ALONG = 12;
    const ACROSS = 2;
    const across = new Vector3(-way.z, 0, way.x);
    const positions = [];
    const uvs = [];
    const keeps = [];
    const grid = [];
    for (let i = 0; i <= ALONG; i += 1) {
        const row = [];
        let last = y;
        for (let j = 0; j <= ACROSS; j += 1) {
            const t = i / ALONG;
            const s = j / ACROSS - 0.5;
            // (It begins a little behind the feet, so the shade's own feet are under the one who casts it.)
            const along = -0.08 + t * length;
            const px = x + way.x * along + across.x * s * breadth;
            const pz = z + way.z * along + across.z * s * breadth;
            const floor = floorAt ? floorAt(px, pz, last) : y;
            const lost = floor === null || Math.abs(floor - y) > 1.2;
            const py = (lost ? y : floor) + 0.018;
            last = lost ? last : floor;
            row.push({ p: [px, py, pz], uv: [cell[0] + (s + 0.5) * cell[2], cell[1] + t * cell[3]], keep: lost ? 0 : 1 });
        }
        grid.push(row);
    }
    const push = (vertex) => {
        positions.push(...vertex.p);
        uvs.push(...vertex.uv);
        keeps.push(vertex.keep);
    };
    for (let i = 0; i < ALONG; i += 1) {
        for (let j = 0; j < ACROSS; j += 1) {
            const a = grid[i][j];
            const b = grid[i][j + 1];
            const c = grid[i + 1][j + 1];
            const d = grid[i + 1][j];
            // (Where the floor steps by more than a stair, the shade doesn't hang across the gap.)
            const step = Math.max(...[a, b, c, d].map((v) => v.p[1])) - Math.min(...[a, b, c, d].map((v) => v.p[1]));
            if (step > 0.3) continue;
            for (const vertex of [a, b, c, a, c, d]) push(vertex);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('keep', new Float32BufferAttribute(keeps, 1));
    return geometry;
}

// =============================================================================
// The pug
// =============================================================================

/** A piece of the pug: posed, painted, marked with its part and whether its coat colour is laid over it. */
function pugPiece(geometry, { at, color, part = PART.body, coated = true, ownUv = false }) {
    if (at) pose(geometry, at);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    paint(flat, color);
    const count = flat.attributes.position.count;
    flat.setAttribute('part', new Float32BufferAttribute(new Float32Array(count).fill(part), 1));
    flat.setAttribute('coated', new Float32BufferAttribute(new Float32Array(count).fill(coated ? 1 : 0), 1));
    if (!ownUv || !flat.attributes.uv) {
        const uv = new Float32Array(count * 2);
        for (let index = 0; index < count; index += 1) uv.set(FACE_WHITE, index * 2);
        flat.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    }
    return flat;
}

/**
 * The pug, standing on the origin, looking along +z: a calf's barrel, deep chest and rump, a short neck, knobbly legs
 * on tiny black hooves; the head with horn-buds and black ears, its front flat and dark (the mask), the face set in
 * it; the tail curling over the back to a tuft.
 */
function pugGeometry() {
    const pieces = [
        pugPiece(new SphereGeometry(1, 10, 7), { at: { sx: 0.095, sy: 0.088, sz: 0.155, y: 0.205, z: -0.01 }, color: COAT }),
        pugPiece(new SphereGeometry(1, 9, 6), { at: { sx: 0.09, sy: 0.096, sz: 0.085, y: 0.215, z: 0.085 }, color: COAT }),
        pugPiece(new SphereGeometry(1, 8, 5), { at: { sx: 0.066, sy: 0.05, sz: 0.07, y: 0.272, z: 0.07 }, color: COAT }),
        pugPiece(new SphereGeometry(1, 8, 6), { at: { sx: 0.085, sy: 0.086, sz: 0.075, y: 0.215, z: -0.115 }, color: COAT }),
        pugPiece(new SphereGeometry(1, 8, 5), { at: { sx: 0.06, sy: 0.07, sz: 0.066, y: 0.27, z: 0.15 }, color: COAT }),
    ];
    // The head: big and round, as a pug's is, its front cut flat for the face; dark at the front (the mask), the
    // coat behind.
    const head = new SphereGeometry(1, 10, 8);
    pose(head, { sx: 0.092, sy: 0.096, sz: 0.08, y: 0.31, z: 0.205 });
    const headPosition = head.attributes.position;
    for (let index = 0; index < headPosition.count; index += 1) headPosition.setZ(index, Math.min(headPosition.getZ(index), FACE_FRONT));
    head.computeVertexNormals();
    const headFlat = pugPiece(head, { color: COAT, part: PART.head });
    const headColors = headFlat.attributes.color;
    const headCoated = headFlat.attributes.coated;
    const mask = new Color(MASK);
    for (let index = 0; index < headColors.count; index += 1) {
        if (headFlat.attributes.position.getZ(index) > FACE_FRONT - 0.028) {
            headColors.setXYZ(index, mask.r, mask.g, mask.b);
            headCoated.setX(index, 0);
        }
    }
    pieces.push(headFlat);
    // The face: a disc on the flat front, bulging a touch.
    const face = new CircleGeometry(FACE_RADIUS, 18);
    const facePosition = face.attributes.position;
    for (let index = 0; index < facePosition.count; index += 1) {
        const r = Math.hypot(facePosition.getX(index), facePosition.getY(index)) / FACE_RADIUS;
        facePosition.setZ(index, 0.009 * (1 - r * r));
    }
    face.computeVertexNormals();
    pieces.push(pugPiece(face, { at: { y: 0.31, z: FACE_FRONT + 0.002 }, color: 0xffffff, part: PART.face, coated: false, ownUv: true }));
    // Ears, out and drooping; horn-buds.
    for (const side of [-1, 1]) {
        pieces.push(pugPiece(new SphereGeometry(1, 6, 4), { at: { sx: 0.05, sy: 0.013, sz: 0.032, x: side * 0.1, y: 0.345, z: 0.195, rz: side * -0.35 }, color: MASK, part: PART.head, coated: false }));
        pieces.push(pugPiece(new ConeGeometry(0.014, 0.038, 6), { at: { x: side * 0.05, y: 0.41, z: 0.195, rz: side * -0.35 }, color: HORN, part: PART.head, coated: false }));
    }
    // Legs: a calf's, knobbly at the knee, on tiny black hooves.
    for (const [x, z] of [[-0.052, 0.085], [0.052, 0.085], [-0.05, -0.115], [0.05, -0.115]]) {
        pieces.push(pugPiece(new CylinderGeometry(0.019, 0.016, 0.15, 6, 1, true), { at: { x, y: 0.1, z }, color: COAT }));
        pieces.push(pugPiece(new SphereGeometry(0.023, 6, 3), { at: { x, y: 0.085, z }, color: COAT }));
        pieces.push(pugPiece(new CylinderGeometry(0.015, 0.02, 0.028, 6), { at: { x, y: 0.014, z }, color: HOOF, coated: false }));
    }
    // The tail: up from the rump, curling over the back as a pug's does, to a bull's tuft.
    const tail = taperedTube([
        new Vector3(0, 0.25, -0.17), new Vector3(0, 0.305, -0.205), new Vector3(0.01, 0.34, -0.175), new Vector3(0.014, 0.33, -0.138),
    ], 0.012, 0.008, COAT, 8, 5);
    pieces.push(pugPiece(tail, { color: COAT, part: PART.tail }));
    pieces.push(pugPiece(new SphereGeometry(0.019, 6, 4), { at: { x: 0.014, y: 0.325, z: -0.13 }, color: MASK, part: PART.tail, coated: false }));
    for (const piece of pieces) {
        for (const name of Object.keys(piece.attributes)) {
            if (!['position', 'normal', 'color', 'uv', 'part', 'coated'].includes(name)) piece.deleteAttribute(name);
        }
    }
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(PUG_SIZE, PUG_SIZE, PUG_SIZE);
    return geometry;
}

/** The pugs' material: the city's toon light, each pug's coat laid over its own, its face from the atlas, and its
 * head and tail moved as the pug looks about and wags (per pug, from instanced attributes). */
function pugMaterial(gradientMap, map) {
    const material = new MeshToonMaterial({ gradientMap, map, vertexColors: true, color: 0xffffff });
    const neck = NECK.clone().multiplyScalar(PUG_SIZE);
    const root = TAIL_ROOT.clone().multiplyScalar(PUG_SIZE);
    alsoBeforeCompile(material, 'pug', (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', [
                '#include <common>',
                'attribute float part;',
                'attribute float coated;',
                'attribute vec3 aCoat;',
                'attribute vec2 aFace;',
                'attribute vec4 aMotion;',
                'mat3 pugTurnY(float a) { return mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a)); }',
                'mat3 pugTurnX(float a) { return mat3(1.0, 0.0, 0.0, 0.0, cos(a), sin(a), 0.0, -sin(a), cos(a)); }',
                'mat3 pugTurnZ(float a) { return mat3(cos(a), sin(a), 0.0, -sin(a), cos(a), 0.0, 0.0, 0.0, 1.0); }',
            ].join('\n'))
            .replace('#include <beginnormal_vertex>', [
                '#include <beginnormal_vertex>',
                'bool pugHead = (part > 0.5 && part < 1.5) || part > 2.5;',
                'bool pugTail = part > 1.5 && part < 2.5;',
                'mat3 pugLook = pugTurnY(aMotion.x) * pugTurnX(aMotion.y) * pugTurnZ(aMotion.z);',
                'mat3 pugWag = pugTurnY(aMotion.w);',
                'if (pugHead) objectNormal = pugLook * objectNormal;',
                'if (pugTail) objectNormal = pugWag * objectNormal;',
            ].join('\n'))
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                `if (pugHead) transformed = pugLook * (transformed - vec3(${neck.x.toFixed(4)}, ${neck.y.toFixed(4)}, ${neck.z.toFixed(4)})) + vec3(${neck.x.toFixed(4)}, ${neck.y.toFixed(4)}, ${neck.z.toFixed(4)});`,
                `if (pugTail) transformed = pugWag * (transformed - vec3(${root.x.toFixed(4)}, ${root.y.toFixed(4)}, ${root.z.toFixed(4)})) + vec3(${root.x.toFixed(4)}, ${root.y.toFixed(4)}, ${root.z.toFixed(4)});`,
            ].join('\n'))
            .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb *= mix(vec3(1.0), aCoat, coated);')
            .replace('#include <uv_vertex>', `#include <uv_vertex>\nif (part > 2.5) vMapUv = vMapUv * ${(1 / FACE_CELLS).toFixed(4)} + aFace;`);
    });
    return material;
}

// =============================================================================
// The board
// =============================================================================

/** The board on its easel, standing on the origin and facing +z: the picture (its front, part 1), the easel's legs. */
function boardGeometry() {
    const pieces = [];
    const add = (geometry, { at, color = WOOD, part = 0 }) => {
        if (at) pose(geometry, at);
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        paint(flat, color);
        const count = flat.attributes.position.count;
        flat.setAttribute('part', new Float32BufferAttribute(new Float32Array(count).fill(part), 1));
        if (part === 0) {
            const uv = new Float32Array(count * 2);
            for (let index = 0; index < count; index += 1) uv.set(BOARD_WHITE, index * 2);
            flat.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        }
        pieces.push(flat);
    };
    // The picture: a thin box leaning back on the easel; its front face carries the picture.
    const panel = new BoxGeometry(0.5, 0.375, 0.02);
    const front = panel.groups.find((group) => group.materialIndex === 4);
    const flatPanel = panel.toNonIndexed();
    const count = flatPanel.attributes.position.count;
    const parts = new Float32Array(count);
    const uv = flatPanel.attributes.uv;
    for (let index = 0; index < count; index += 1) {
        const isFront = index >= front.start && index < front.start + front.count;
        parts[index] = isFront ? 1 : 0;
        if (!isFront) uv.setXY(index, BOARD_WHITE[0], BOARD_WHITE[1]);
    }
    pose(flatPanel, { y: 0.52, z: -0.02, rx: -0.2 });
    paint(flatPanel, 0xffffff);
    const colors = flatPanel.attributes.color;
    const wood = new Color(WOOD);
    for (let index = 0; index < count; index += 1) if (!parts[index]) colors.setXYZ(index, wood.r, wood.g, wood.b);
    flatPanel.setAttribute('part', new Float32BufferAttribute(parts, 1));
    pieces.push(flatPanel);
    // The easel: two legs behind the picture (it rests on them, and on the ledge in front), one more behind, and the
    // ledge.
    for (const side of [-1, 1]) add(new BoxGeometry(0.03, 0.86, 0.025), { at: { x: side * 0.17, y: 0.42, z: -0.07, rx: -0.2, rz: side * 0.06 } });
    add(new BoxGeometry(0.028, 0.84, 0.024), { at: { y: 0.4, z: -0.26, rx: 0.32 } });
    add(new BoxGeometry(0.5, 0.028, 0.06), { at: { y: 0.335, z: 0.02, rx: -0.2 } });
    for (const piece of pieces) {
        for (const name of Object.keys(piece.attributes)) if (!['position', 'normal', 'color', 'uv', 'part'].includes(name)) piece.deleteAttribute(name);
        if (!piece.attributes.normal) piece.computeVertexNormals();
    }
    return mergeGeometries(pieces, false);
}

/** The boards' material: their pictures from the atlas, the paint going in number by number (per board, aPaint). */
function boardMaterial(gradientMap, map) {
    const material = new MeshToonMaterial({ gradientMap, map, vertexColors: true, color: 0xffffff });
    const cell = [BOARD_CELL[0] / BOARD_ATLAS, BOARD_CELL[1] / BOARD_ATLAS];
    const paints = BOARD_PAINTS.map((hex) => new Color(hex));
    alsoBeforeCompile(material, 'board', (shader) => {
        shader.uniforms.boardPaints = { value: paints };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float part;\nattribute vec2 aBoard;\nattribute float aPaint;\nvarying vec2 vPainted;\nvarying float vFront;\nvarying float vPaint;')
            .replace('#include <uv_vertex>', [
                '#include <uv_vertex>',
                'vFront = part;',
                'vPaint = aPaint;',
                `if (part > 0.5) vMapUv = vMapUv * vec2(${cell[0].toFixed(5)}, ${cell[1].toFixed(5)}) + aBoard;`,
                `vPainted = vMapUv + vec2(${cell[0].toFixed(5)}, 0.0);`,
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 boardPaints[7];\nvarying vec2 vPainted;\nvarying float vFront;\nvarying float vPaint;')
            .replace('#include <map_fragment>', [
                '#ifdef USE_MAP',
                'vec4 sampledDiffuseColor = texture2D(map, vMapUv);',
                'if (vFront > 0.5 && vPaint > 0.0) {',
                '    vec4 painted = texture2D(map, vPainted);',
                '    // Which number this is (the paint nearest its colour), and whether its turn has come.',
                '    float best = 1e9;',
                '    float number = 0.0;',
                '    for (int k = 0; k < 7; k++) {',
                '        vec3 apart = painted.rgb - boardPaints[k];',
                '        float d = dot(apart, apart);',
                '        if (d < best) { best = d; number = float(k); }',
                '    }',
                '    sampledDiffuseColor = mix(sampledDiffuseColor, painted, clamp(vPaint * 8.0 - number, 0.0, 1.0));',
                '}',
                'diffuseColor *= sampledDiffuseColor;',
                '#endif',
            ].join('\n'));
    });
    return material;
}

// =============================================================================
// Main Code
// =============================================================================

function shortest(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * @param {object} options
 * @param {object[]} options.creatures - from data/creatures.json: { fragment, kind ('pug' | 'hum'), at: [x, y, z],
 *   facing (radians, 0 = +z), face?, coat?, board? (a picture: cup, flag, flower, door, wave, boat, arch, pump, spire,
 *   star), shade?, patina? }
 * @param {Set<string>} options.given - the passages already given (read): their boards are painted
 * @param {import('three').Texture} options.gradientMap - the city's toon steps
 * @param {Vector3} options.light - the way to the light the shades fall from (the hum's sun)
 * @param {((x: number, z: number, near: number) => number | null) | null} options.floorAt - the floor, to lay shades on
 * @param {boolean} options.reducedMotion
 */
export function createCreatures({ creatures, given, gradientMap, light, floorAt, reducedMotion }) {
    const pugs = creatures.filter((creature) => creature.kind === 'pug');
    const hums = creatures.filter((creature) => creature.kind === 'hum');
    const group = { objects: [], materials: [] };
    const turn = new Quaternion();
    const euler = new Euler(0, 0, 0, 'YXZ');
    const matrix = new Matrix4();
    const one = new Vector3(1, 1, 1);
    const place = new Vector3();

    // ---- The pugs, and their boards.
    const faces = faceAtlas();
    const pugMesh = new InstancedMesh(pugGeometry(), pugMaterial(gradientMap, faces.texture), Math.max(1, pugs.length));
    pugMesh.name = 'pugs';
    pugMesh.count = pugs.length;
    pugMesh.frustumCulled = false;
    const coat = new Float32Array(Math.max(1, pugs.length) * 3);
    const faceAt = new Float32Array(Math.max(1, pugs.length) * 2);
    const motion = new Float32Array(Math.max(1, pugs.length) * 4);
    pugs.forEach((pug, index) => {
        new Color(COATS[(pug.coat ?? index) % COATS.length]).toArray(coat, index * 3);
        faceAt.set(faceCell((pug.face ?? index) % FACES.length), index * 2);
    });
    pugMesh.geometry.setAttribute('aCoat', new InstancedBufferAttribute(coat, 3));
    pugMesh.geometry.setAttribute('aFace', new InstancedBufferAttribute(faceAt, 2));
    const motionAttribute = new InstancedBufferAttribute(motion, 4);
    pugMesh.geometry.setAttribute('aMotion', motionAttribute);

    const boards = boardAtlas(pugs.map((pug) => pug.board ?? 'star'));
    const boardMesh = new InstancedMesh(boardGeometry(), boardMaterial(gradientMap, boards.texture), Math.max(1, pugs.length));
    boardMesh.name = 'pug-boards';
    boardMesh.count = pugs.length;
    boardMesh.frustumCulled = false;
    const boardAt = new Float32Array(Math.max(1, pugs.length) * 2);
    const paintAt = new Float32Array(Math.max(1, pugs.length));
    pugs.forEach((pug, index) => {
        boardAt.set(boardCell(index), index * 2);
        paintAt[index] = given.has(pug.fragment) ? 1 : 0;
    });
    boardMesh.geometry.setAttribute('aBoard', new InstancedBufferAttribute(boardAt, 2));
    const paintAttribute = new InstancedBufferAttribute(paintAt, 1);
    boardMesh.geometry.setAttribute('aPaint', paintAttribute);
    // The boards stand still: each behind its pug, facing the way the pug faces.
    pugs.forEach((pug, index) => {
        const [x, y, z] = pug.at;
        const facing = pug.facing ?? 0;
        const back = pug.boardBack ?? 0.34;
        place.set(x - Math.sin(facing) * back, y, z - Math.cos(facing) * back);
        boardMesh.setMatrixAt(index, matrix.compose(place, turn.setFromEuler(euler.set(0, facing, 0)), one));
    });
    boardMesh.instanceMatrix.needsUpdate = true;

    // ---- The hums.
    const clock = { value: 0 };
    const humMesh = new InstancedMesh(humGeometry(), birdMaterial(gradientMap, clock), Math.max(1, hums.length));
    humMesh.name = 'giver-hums';
    humMesh.count = hums.length;
    humMesh.frustumCulled = false;
    hums.forEach((hum, index) => humMesh.setColorAt(index, new Color(PATINAS[(hum.patina ?? index) % PATINAS.length])));
    if (humMesh.instanceColor) humMesh.instanceColor.needsUpdate = true;
    const blurMesh = new InstancedMesh(blurGeometry(), new MeshBasicMaterial({
        color: new Color(0xd09050), transparent: true, opacity: 0.14, depthWrite: false, side: DoubleSide, fog: false,
    }), Math.max(1, hums.length));
    blurMesh.name = 'giver-hums-blur';
    blurMesh.count = hums.length;
    blurMesh.frustumCulled = false;
    blurMesh.renderOrder = 2;
    const steam = createSteam(Math.max(1, hums.length) * PUFFS, HUM_SIZE * 0.6);
    steam.points.name = 'giver-hums-steam';
    const puffs = Array.from({ length: Math.max(1, hums.length) * PUFFS }, () => ({ origin: new Vector3(), last: Infinity }));

    // ---- The shades.
    const shades = shadeAtlas();
    const toLight = light.clone().normalize();
    const way = new Vector3(-toLight.x, 0, -toLight.z).normalize();
    let wraith = 0;
    let bullBoy = 0;
    const strips = creatures.filter((creature) => !creature.noShade).map((creature) => {
        const [x, y, z] = creature.at;
        const kind = creature.kind === 'pug' ? 'pug' : 'hum';
        // The hums' shades lie on the floor beneath them (their spot's floor, given as `floor`, else straight down).
        const ground = kind === 'pug' ? y : creature.floor ?? (floorAt?.(x, z, y - 1) ?? y - 1.2);
        const index = kind === 'pug' ? WRAITHS.length + ((creature.shade ?? bullBoy++) % BULL_BOYS.length) : (creature.shade ?? wraith++) % WRAITHS.length;
        const [length, breadth] = SHADE_SIZE[kind];
        return shadeStrip({ x, y: ground, z, way, length, breadth, cell: shades.cell(index), floorAt });
    });
    const shadeMesh = new Mesh(mergeGeometries(strips, false), new ShaderMaterial({
        uniforms: { map: { value: shades.texture }, tint: { value: SHADE_TINT }, depth: { value: SHADE_DEPTH } },
        vertexShader: shadeVertex,
        fragmentShader: shadeFragment,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: DstColorFactor,
        blendDst: ZeroFactor,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    }));
    shadeMesh.name = 'giver-shades';
    shadeMesh.renderOrder = 1;

    // (They stand in the city's own long shadows, as everything does; they cast none of their own, having their shades.)
    for (const mesh of [pugMesh, boardMesh, humMesh]) mesh.receiveShadow = true;
    group.objects.push(shadeMesh, boardMesh, pugMesh, humMesh, blurMesh, steam.points);
    group.materials.push(pugMesh.material, boardMesh.material, humMesh.material);

    // ---- Their lives.
    /** Where each stands (or hovers), and where its word is shown and a tap finds it. */
    const spots = new Map(creatures.map((creature) => {
        const [x, y, z] = creature.at;
        const top = creature.kind === 'pug' ? y + 0.5 * PUG_SIZE : y + 0.05;
        return [creature.fragment, { creature, at: new Vector3(x, y, z), point: new Vector3(x, top, z) }];
    }));
    const state = new Map(creatures.map((creature) => [creature.fragment, {
        greeted: -Infinity, given: given.has(creature.fragment) ? -Infinity : null, look: 0, nod: 0, tilt: 0,
    }]));
    let visitor = null;

    /** A pug in its moment: looking about (or at the one who's come), hopping when greeted or when it gives, wagging. */
    function posePug(pug, index, elapsed, dt) {
        const own = state.get(pug.fragment);
        const [x, y, z] = pug.at;
        const facing = pug.facing ?? 0;
        let lookWant = reducedMotion ? 0 : Math.sin(elapsed * 0.31 + index * 1.7) * 0.5 * Math.max(0, Math.sin(elapsed * 0.13 + index));
        let nodWant = reducedMotion ? 0 : Math.max(0, Math.sin(elapsed * 0.21 + index * 2.3)) * 0.35;
        if (visitor) {
            const dx = visitor.x - x;
            const dz = visitor.z - z;
            if (Math.hypot(dx, dz) < NOTICE) {
                lookWant = MathUtils.clamp(shortest(Math.atan2(dx, dz) - facing), -1.1, 1.1);
                nodWant = -MathUtils.clamp((visitor.y - y - 0.3) / Math.max(0.5, Math.hypot(dx, dz)), -0.4, 0.5);
            }
        }
        const ease = reducedMotion ? 1 : 1 - Math.exp(-4 * dt);
        own.look += (lookWant - own.look) * ease;
        own.nod += (nodWant - own.nod) * ease;
        const since = elapsed - own.greeted;
        const gave = own.given === null ? Infinity : elapsed - own.given;
        const happy = Math.min(since, gave);
        // A hop or two when it speaks or gives, hooves pattering; a tilt of the head; the tail going.
        const hop = reducedMotion || happy > 1.2 ? 0 : Math.abs(Math.sin(happy * Math.PI * 2.5)) * 0.06 * (1 - happy / 1.2);
        own.tilt = reducedMotion ? 0 : Math.sin(elapsed * 0.7 + index) * 0.12 + (happy < 1.5 ? Math.sin(happy * 9) * 0.2 * (1 - happy / 1.5) : 0);
        const wag = reducedMotion ? 0 : Math.sin(elapsed * (happy < 2 ? 14 : 3) + index) * (happy < 2 ? 0.5 : 0.2);
        motion.set([own.look, own.nod, own.tilt, wag], index * 4);
        place.set(x, y + hop, z);
        pugMesh.setMatrixAt(index, matrix.compose(place, turn.setFromEuler(euler.set(0, facing, 0)), one));
        // The board's paint going in, once given.
        if (own.given !== null) paintAt[index] = reducedMotion ? 1 : Math.min(1, Math.max(paintAt[index], (elapsed - own.given) / PAINT_SECONDS));
    }

    const scale = new Vector3(HUM_SIZE, HUM_SIZE, HUM_SIZE);
    /** A hum in its moment: hovering and bobbing, looking about (or at the one who's come), a loop when it gives. */
    function poseHum(hum, index, elapsed, dt) {
        const own = state.get(hum.fragment);
        const [x, y, z] = hum.at;
        let lookWant = (hum.facing ?? 0) + (reducedMotion ? 0 : Math.sin(elapsed * 0.9 + index * 1.3) * 0.6);
        if (visitor && Math.hypot(visitor.x - x, visitor.z - z) < NOTICE) lookWant = Math.atan2(visitor.x - x, visitor.z - z);
        const ease = reducedMotion ? 1 : 1 - Math.exp(-5 * dt);
        own.look += shortest(lookWant - own.look) * ease;
        const since = elapsed - own.greeted;
        const gave = own.given === null ? Infinity : elapsed - own.given;
        const bob = reducedMotion ? 0 : Math.sin(elapsed * 5.3 + index) * 0.04 + Math.sin(elapsed * 1.9 + index * 0.7) * 0.02;
        // A little rise and a twirl when it speaks; a loop over and round when it gives.
        const rise = reducedMotion || since > 1 ? 0 : Math.sin(Math.PI * since) * 0.18;
        const twirl = reducedMotion || since > 0.9 ? 0 : (1 - (1 - since / 0.9) ** 3) * Math.PI * 2;
        const loop = reducedMotion || gave > 1.4 ? 0 : (gave / 1.4) * Math.PI * 2;
        place.set(x, y + bob + rise + (loop ? Math.sin(loop) * 0.35 : 0), z + (loop ? (1 - Math.cos(loop)) * 0.25 * Math.cos(own.look) : 0));
        euler.set(loop ? -loop : 0, own.look + twirl, 0);
        matrix.compose(place, turn.setFromEuler(euler), scale);
        humMesh.setMatrixAt(index, matrix);
        blurMesh.setMatrixAt(index, matrix);
        // Steam, dripping off it.
        for (let puff = 0; puff < PUFFS; puff += 1) {
            const slot = index * PUFFS + puff;
            const age = reducedMotion ? 0.3 + puff * 0.22 : ((elapsed + (puff / PUFFS) * LIFE + index * 0.37) % LIFE) / LIFE;
            const it = puffs[slot];
            if (age < it.last || reducedMotion) it.origin.set(place.x, place.y - 0.06, place.z);
            it.last = age;
            const up = age * 0.5 + age * age * 0.3;
            steam.positions[slot * 3] = it.origin.x + Math.sin(slot * 1.7 + age * 3) * 0.06 * age;
            steam.positions[slot * 3 + 1] = it.origin.y + up;
            steam.positions[slot * 3 + 2] = it.origin.z + Math.cos(slot * 2.3 + age * 2) * 0.06 * age;
            steam.ages[slot] = age;
        }
    }

    let lastElapsed = 0;
    function update(elapsed) {
        const dt = Math.min(0.1, Math.max(0, elapsed - lastElapsed));
        lastElapsed = elapsed;
        clock.value = reducedMotion ? 0.4 : elapsed;
        pugs.forEach((pug, index) => posePug(pug, index, elapsed, dt));
        hums.forEach((hum, index) => poseHum(hum, index, elapsed, dt));
        pugMesh.instanceMatrix.needsUpdate = true;
        motionAttribute.needsUpdate = true;
        paintAttribute.needsUpdate = true;
        humMesh.instanceMatrix.needsUpdate = true;
        blurMesh.instanceMatrix.needsUpdate = true;
        steam.geometry.attributes.position.needsUpdate = true;
        steam.geometry.attributes.age.needsUpdate = true;
    }
    update(0);

    return {
        /** What to add to the scene. */
        objects: group.objects,
        /** Their own materials (the city's dust takes them too: stage.js). */
        materials: group.materials,
        /** The atlases, for the local checks. */
        canvases: { faces: faces.canvas, boards: boards.canvas, shades: shades.canvas },
        /**
         * Their textures, for the stage to take in before the city is called ready (stage.js adopt): drawn and sent to
         * the screen then, not on the city's first frame, nor behind the swirl's last ones.
         */
        textures: [faces.texture, boards.texture, shades.texture],
        /** Whether a passage has a giver. */
        has: (id) => spots.has(id),
        /** Where a passage's giver is to be found (its word shown, a tap taken): above a pug's head, at a hum. */
        pointOf: (id) => spots.get(id)?.point ?? null,
        /** A passage's giver's body, as a ball (a tap anywhere on it finds it): { center, radius }, or null. */
        bodyOf(id) {
            const spot = spots.get(id);
            if (!spot) return null;
            const pug = spot.creature.kind === 'pug';
            return { center: spot.at.clone().setY(spot.at.y + (pug ? 0.24 : 0) * PUG_SIZE), radius: pug ? 0.26 * PUG_SIZE : 0.28 };
        },
        /** What a passage's giver says: "squur" (a pug) or "chirp" (a hum); null if it has none. */
        speechOf: (id) => (spots.has(id) ? SPEECH[spots.get(id).creature.kind] : null),
        /** Which kind gives a passage: 'pug', 'hum' or null. */
        kindOf: (id) => spots.get(id)?.creature.kind ?? null,
        /**
         * It speaks (the one who's come is near, or the pointer's over it): a hop, a twirl. Not again within two
         * seconds; says whether it spoke.
         */
        greet(id, elapsed) {
            const own = state.get(id);
            if (!own || elapsed - own.greeted <= 2) return false;
            own.greeted = elapsed;
            return true;
        },
        /** It gives its passage: a pug's board paints itself in, the pug hops; a hum loops. */
        give(id, elapsed) {
            const own = state.get(id);
            if (own && own.given === null) own.given = elapsed;
        },
        /** Where the one who's come is (the hum you fly as), or null: the creatures turn to them. */
        notice(position) {
            visitor = position;
        },
        update,
    };
}
