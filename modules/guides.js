/**
 * guides.js — the jetty's two signs (a trial, trials.js; ?jettysigns=off), in Elm's words: "along the jetty it's easy
 * enough to have a sign that says 'Click the hum to let go. Click again to keep going.' … Another sign can say pinch
 * to control the camera with little arrows pointing in and pointing out." And for the hum itself: "instead of
 * replacing the 'u' maybe just replace the entire word 'hum' with a bird symbol" — so the word is a hummingbird.
 *
 * They stand where places.js mounts them (jetty/let-go, jetty/pinch): lecterns on the jetty's boards, leaning back
 * toward the way in from its end, so the visitor reads them as the hum sets off. They're dressed as the city's plaques are (signs.js): a dark
 * face in a gold rim, the words in Cormorant, a little light of their own so they read at dusk; both in one atlas, one
 * mesh, one draw. The ink outlines them and the dust takes them as it takes the rest of the city.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BoxGeometry,
    CanvasTexture,
    CylinderGeometry,
    LinearMipmapLinearFilter,
    Matrix4,
    Mesh,
    MeshToonMaterial,
    SRGBColorSpace,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// =============================================================================
// Constants
// =============================================================================

/** The atlas: both signs, one above the other, and a strip of the rim's and stands' colours at its foot. */
const ATLAS = 1024;
const SIGN_WIDTH = 1024;
const SIGN_HEIGHT = 384;
const SWATCH_Y = 1000;
/** The plaques' dress (signs.js STYLES.plaque). */
const FACE = '#2a1d12';
const RIM = '#d9ae5f';
const INK = '#f3d993';
const STAND = '#b98a3e';
const FONT_FAMILY = 'Cormorant';
const FONT_WEIGHT = 500;
const FONT_WAIT_MS = 6000;
/** How much room the words leave at the sign's sides (px), and the largest they're set. */
const PAD = 70;
const MAX_SIZE = 92;

/** The signs, in Elm's words. A null in a line is the hummingbird, standing for the word "hum". */
const LET_GO = [['Click the ', null, ' to let go.'], ['Click again to keep going.']];
const PINCH = 'Pinch to control the camera';

// =============================================================================
// Drawing
// =============================================================================

async function fontsReady(size) {
    if (!document.fonts?.load) return false;
    const text = `${LET_GO.flat().filter(Boolean).join(' ')} ${PINCH}`;
    const loading = document.fonts.load(`${FONT_WEIGHT} ${size}px ${FONT_FAMILY}`, text).then(() => true, () => false);
    const timeout = new Promise((resolve) => {
        setTimeout(() => resolve(false), FONT_WAIT_MS);
    });
    return Promise.race([loading, timeout]);
}

const fontAt = (size) => `${FONT_WEIGHT} ${size}px ${FONT_FAMILY}, Georgia, serif`;

/**
 * The hummingbird is a word, so it's word-sized: a square a little taller than the capitals (so it reads as a bird,
 * not a mark), its tail dipping a little below the line as a descender would (so it sits in the line, not above it).
 * Both as fractions of the capitals' height.
 */
const BIRD_TALL = 1.4;
const BIRD_SINK = 0.14;

/** The side of the hummingbird's square at the context's current font. */
const birdSize = (context) => context.measureText('H').actualBoundingBoxAscent * BIRD_TALL;

/**
 * A tiny hummingbird in silhouette, hovering, facing the way the line reads, drawn in a box `width` wide whose foot is
 * at y (the baseline) and `height` tall: a round head and a long straight beak, a teardrop body tilted tail-down, a
 * wing raised high behind like a blade, and a forked tail. (Laid out on a square of 100, y downward, then fitted.)
 */
function drawHummingbird(context, x, y, width, height) {
    const s = Math.min(width, height) / 100;
    const ox = x + (width - 100 * s) / 2;
    const oy = y - 100 * s;
    const at = (px, py) => [ox + px * s, oy + py * s];
    context.save();
    // The body: a teardrop leaning back, the head's end high and forward, the tail's end low behind.
    context.beginPath();
    context.ellipse(...at(50, 60), 23 * s, 11 * s, -0.72, 0, Math.PI * 2);
    context.fill();
    // The head.
    context.beginPath();
    context.arc(...at(67, 40), 11 * s, 0, Math.PI * 2);
    context.fill();
    // The long beak, reaching forward and a little down.
    context.beginPath();
    context.moveTo(...at(73, 35));
    context.lineTo(...at(100, 46));
    context.lineTo(...at(72, 44));
    context.closePath();
    context.fill();
    // The wing, raised high behind the head and swept back, a blade.
    context.beginPath();
    context.moveTo(...at(57, 50));
    context.quadraticCurveTo(...at(54, 20), ...at(26, 0));
    context.quadraticCurveTo(...at(36, 28), ...at(42, 58));
    context.closePath();
    context.fill();
    // The forked tail, low behind.
    context.beginPath();
    context.moveTo(...at(38, 70));
    context.lineTo(...at(18, 92));
    context.lineTo(...at(29, 84));
    context.lineTo(...at(25, 100));
    context.lineTo(...at(45, 74));
    context.closePath();
    context.fill();
    context.restore();
}

/** An arrow from (x0, y0) to (x1, y1), its head at (x1, y1). */
function drawArrow(context, x0, y0, x1, y1, head) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1 - Math.cos(angle) * head * 0.6, y1 - Math.sin(angle) * head * 0.6);
    context.stroke();
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x1 - Math.cos(angle - 0.5) * head, y1 - Math.sin(angle - 0.5) * head);
    context.lineTo(x1 - Math.cos(angle + 0.5) * head, y1 - Math.sin(angle + 0.5) * head);
    context.closePath();
    context.fill();
}

/** The face of a sign: dark, framed in gold, as the plaques are. */
function drawFace(context, top) {
    context.fillStyle = RIM;
    context.fillRect(0, top, SIGN_WIDTH, SIGN_HEIGHT);
    context.fillStyle = FACE;
    context.fillRect(10, top + 10, SIGN_WIDTH - 20, SIGN_HEIGHT - 20);
    context.strokeStyle = RIM;
    context.lineWidth = 4;
    context.strokeRect(26, top + 26, SIGN_WIDTH - 52, SIGN_HEIGHT - 52);
}

/** The width of a line: its words, and the hummingbird's square where it stands for "hum". */
function lineWidth(context, line) {
    return line.reduce((sum, run) => sum + (run === null ? birdSize(context) : context.measureText(run).width), 0);
}

/** The largest size, up to MAX_SIZE, at which every line fits the sign. */
function fitSize(context, lines) {
    for (let size = MAX_SIZE; size > 30; size -= 2) {
        context.font = fontAt(size);
        if (lines.every((line) => lineWidth(context, line) <= SIGN_WIDTH - PAD * 2)) return size;
    }
    return 30;
}

function drawLetGo(context, top) {
    drawFace(context, top);
    const size = fitSize(context, LET_GO);
    context.font = fontAt(size);
    context.fillStyle = INK;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    const capHeight = context.measureText('H').actualBoundingBoxAscent;
    const leading = size * 1.28;
    const first = top + SIGN_HEIGHT / 2 - leading / 2 + size * 0.32;
    LET_GO.forEach((line, row) => {
        const baseline = first + row * leading;
        let x = (SIGN_WIDTH - lineWidth(context, line)) / 2;
        for (const run of line) {
            if (run === null) {
                const side = birdSize(context);
                drawHummingbird(context, x, baseline + capHeight * BIRD_SINK, side, side);
                x += side;
            } else {
                context.fillText(run, x, baseline);
                x += context.measureText(run).width;
            }
        }
    });
}

function drawPinch(context, top) {
    drawFace(context, top);
    const size = fitSize(context, [[PINCH]]);
    context.font = fontAt(size);
    context.fillStyle = INK;
    context.strokeStyle = INK;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'center';
    const baseline = top + SIGN_HEIGHT * 0.44;
    context.fillText(PINCH, SIGN_WIDTH / 2, baseline);
    // Below: little arrows pointing in (two meeting), and pointing out (two parting), as a pinch goes.
    const middle = top + SIGN_HEIGHT * 0.73;
    const reach = 62;
    const head = 30;
    context.lineWidth = 11;
    context.lineCap = 'round';
    const inAt = SIGN_WIDTH / 2 - 150;
    const outAt = SIGN_WIDTH / 2 + 150;
    drawArrow(context, inAt - reach - 12, middle - reach * 0.55, inAt - 14, middle - 5, head);
    drawArrow(context, inAt + reach + 12, middle + reach * 0.55, inAt + 14, middle + 5, head);
    drawArrow(context, outAt - 14, middle - 5, outAt - reach - 12, middle - reach * 0.55, head);
    drawArrow(context, outAt + 14, middle + 5, outAt + reach + 12, middle + reach * 0.55, head);
}

// =============================================================================
// Main Code
// =============================================================================

/** Map a plate's front face to its region of the atlas, and every other face to the rim's colour. */
function mapPlate(geometry, top) {
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const v1 = 1 - top / ATLAS;
    const v0 = 1 - (top + SIGN_HEIGHT) / ATLAS;
    const rim = [0.25, 1 - (SWATCH_Y + 6) / ATLAS];
    for (const group of geometry.groups) {
        const seen = new Set();
        for (let at = group.start; at < group.start + group.count; at += 1) seen.add(index.getX(at));
        for (const vertex of seen) {
            if (group.materialIndex === 4) uv.setXY(vertex, uv.getX(vertex), v0 + uv.getY(vertex) * (v1 - v0));
            else uv.setXY(vertex, rim[0], rim[1]);
        }
    }
    geometry.clearGroups();
}

/**
 * Draw the jetty's signs and stand them on their mounts.
 * @param {object} options
 * @param {Map<string, object>} options.mounts - from places.js (jetty/let-go, jetty/pinch)
 * @param {import('three').Texture | null} options.gradientMap - the city's toon steps
 * @param {import('three').WebGLRenderer} options.renderer
 * @returns {Promise<{ mesh: Mesh, canvas: HTMLCanvasElement, fontsLoaded: boolean } | null>}
 */
export async function createGuides({ mounts, gradientMap, renderer }) {
    const wanted = [['jetty/let-go', drawLetGo], ['jetty/pinch', drawPinch]].filter(([name]) => mounts.has(name));
    if (!wanted.length) return null;
    const fontsLoaded = await fontsReady(MAX_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS;
    canvas.height = ATLAS;
    const context = canvas.getContext('2d');
    context.fillStyle = RIM;
    context.fillRect(0, SWATCH_Y, ATLAS / 2, 12);
    context.fillStyle = STAND;
    context.fillRect(ATLAS / 2, SWATCH_Y, ATLAS / 2, 12);

    const pieces = [];
    wanted.forEach(([name, draw], row) => {
        const top = row * (SIGN_HEIGHT + 16);
        draw(context, top);
        const mount = mounts.get(name);
        const height = mount.height;
        const width = Math.min(mount.maxWidth, height * (SIGN_WIDTH / SIGN_HEIGHT));
        const plateHeight = width / (SIGN_WIDTH / SIGN_HEIGHT);
        const plate = new BoxGeometry(width, plateHeight, 0.06);
        mapPlate(plate, top);
        const normal = mount.normal.clone().normalize();
        const side = new Vector3(0, 1, 0).cross(normal).normalize();
        const up = normal.clone().cross(side);
        const matrix = new Matrix4().makeBasis(side, up, normal).setPosition(mount.position);
        plate.applyMatrix4(matrix);
        pieces.push(plate);
        // Its two legs, down its own slope to where it stands (the boards): as long as that slope takes to get there.
        const bottom = mount.position.y - up.y * (plateHeight / 2);
        const drop = Math.max(0.05, (bottom - (mount.stand?.base ?? 0)) / Math.max(0.3, up.y));
        for (const legX of [-(width / 2 - 0.14), width / 2 - 0.14]) {
            const leg = new CylinderGeometry(0.035, 0.045, drop, 6);
            leg.translate(legX, -plateHeight / 2 - drop / 2, -0.07);
            const uv = leg.attributes.uv;
            for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setXY(vertex, 0.75, 1 - (SWATCH_Y + 6) / ATLAS);
            leg.applyMatrix4(matrix);
            pieces.push(leg);
        }
    });

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = LinearMipmapLinearFilter;
    const material = new MeshToonMaterial({
        color: 0xffffff,
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.62,
        gradientMap,
    });
    const mesh = new Mesh(mergeGeometries(pieces, false), material);
    mesh.name = 'guides';
    mesh.castShadow = true;
    return { mesh, canvas, fontsLoaded };
}
