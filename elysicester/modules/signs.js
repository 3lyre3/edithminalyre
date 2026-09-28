/**
 * signs.js — Danæam on the city's plaques, café boards, banner and markers.
 *
 * Every string comes from data/signs.json, which records where on the site it
 * was found; scripts/check-elysicester.mjs holds each one to its page. Nothing
 * here writes a word of Danæam: it only draws what the data carries.
 *
 * The words are drawn once into a single canvas atlas (1024 px), in the site's
 * own fonts, after those fonts have loaded, and every plate is cut from that
 * one picture: one texture, one draw call. Each font is asked, letter by
 * letter, whether it truly holds every glyph the signs need (and æ œ þ ł ý ÿ
 * besides); a letter drawn by a fallback font is reported, never hidden. A
 * missing word hangs as a visible placeholder.
 *
 * Over the scene, a sign shows its words as real text, marked
 * lang="art-x-danaeam", with the site's gloss where the site gives one. The
 * same words are listed for keyboards and screen readers.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BoxGeometry,
    CanvasTexture,
    CylinderGeometry,
    Float32BufferAttribute,
    LinearMipmapLinearFilter,
    MathUtils,
    Matrix4,
    Mesh,
    Raycaster,
    SRGBColorSpace,
    Vector2,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRayGrid } from './rays.js';

// =============================================================================
// Constants
// =============================================================================

const ATLAS = 1024;
const REGION_HEIGHT = 128;
const GUTTER = 16;
const PAD_X = 34;
const FONT_SIZE = 80;
const SWATCH = 16;
const FONT_WAIT_MS = 6000;

/** Letters the brief asks after by name, checked in every font the signs use. */
export const PROBE = 'æœþłýÿ';

/**
 * How each kind of sign is dressed. Plates are laid in the site's two faces:
 * Cormorant for the city's gold and brick, EB Garamond for the glass station.
 */
const STYLES = {
    plaque: { font: `500 ${FONT_SIZE}px Cormorant`, face: '#2a1d12', rim: '#d9ae5f', ink: '#f3d993', stand: '#b98a3e', depth: 0.06 },
    cafe: { font: `500 ${FONT_SIZE}px Cormorant`, face: '#3a140f', rim: '#d9ae5f', ink: '#f6e7c6', stand: '#b98a3e', depth: 0.06 },
    banner: { font: `italic 400 ${FONT_SIZE + 6}px Cormorant`, face: '#2fc4bc', rim: '#1e8e88', ink: '#fbfaf0', stand: '#363c46', depth: 0.02, shade: 'rgba(6, 44, 42, 0.6)' },
    door: { font: `500 ${FONT_SIZE}px Cormorant`, face: '#1a1210', rim: '#ffd23a', ink: '#ffd23a', stand: '#1a1210', depth: 0.05 },
    board: { font: `500 ${FONT_SIZE}px "EB Garamond"`, face: '#e6eff3', rim: '#8a94a4', ink: '#27313b', stand: '#8a94a4', depth: 0.06 },
    marker: { font: `500 ${FONT_SIZE}px Cormorant`, face: '#353b45', rim: '#8a94a4', ink: '#eef2f8', stand: '#363c46', depth: 0.05, glitch: true },
    gate: { font: `500 ${FONT_SIZE}px Cormorant`, face: '#2a1d12', rim: '#d9ae5f', ink: '#d9ae5f', stand: '#b98a3e', depth: 0.05 },
};

// =============================================================================
// Fonts and glyphs
// =============================================================================

/** Ask the browser for each font with the very letters it must draw (so the right subsets load). */
async function loadFonts(requests) {
    if (!document.fonts?.load) return false;
    const loading = Promise.all(requests.map(([font, text]) => document.fonts.load(font, text))).then(() => true, () => false);
    const timeout = new Promise((resolve) => {
        setTimeout(() => resolve(false), FONT_WAIT_MS);
    });
    return Promise.race([loading, timeout]);
}

/**
 * The letters of `text` that `font` doesn't hold. A letter the font lacks falls
 * back to the next font in the list, so it measures differently behind a
 * monospace and behind a serif fallback; a letter the font holds doesn't.
 */
export function missingGlyphs(context, font, text) {
    const missing = [];
    for (const letter of new Set(Array.from(text.normalize('NFC')).filter((character) => character.trim()))) {
        context.font = `${font}, monospace`;
        const behindMono = context.measureText(letter).width;
        context.font = `${font}, serif`;
        const behindSerif = context.measureText(letter).width;
        if (Math.abs(behindMono - behindSerif) > 0.5) missing.push(letter);
    }
    return missing;
}

// =============================================================================
// The atlas
// =============================================================================

function textBox(context, font, text) {
    context.font = font;
    const metrics = context.measureText(text);
    return { width: metrics.width, ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
}

/** Shelf-pack regions left to right, row by row. */
function packer() {
    let x = GUTTER;
    let y = SWATCH * 2 + GUTTER;
    return (width) => {
        if (x + width + GUTTER > ATLAS) {
            x = GUTTER;
            y += REGION_HEIGHT + GUTTER;
        }
        if (y + REGION_HEIGHT + GUTTER > ATLAS) throw new Error('The signs no longer fit their atlas');
        const region = { x, y, width, height: REGION_HEIGHT };
        x += width + GUTTER;
        return region;
    };
}

function drawPlate(context, region, style, text) {
    const { x, y, width, height } = region;
    // The rim colour runs out into the gutter, so distant (mipmapped) plates keep clean edges.
    context.fillStyle = style.rim;
    context.fillRect(x - GUTTER / 2, y - GUTTER / 2, width + GUTTER, height + GUTTER);
    context.fillStyle = style.face;
    context.fillRect(x + 6, y + 6, width - 12, height - 12);
    context.strokeStyle = style.rim;
    context.lineWidth = 3;
    if (text === null) context.setLineDash([12, 9]);
    context.strokeRect(x + 14, y + 14, width - 28, height - 28);
    context.setLineDash([]);

    const centreX = x + width / 2;
    if (text === null) {
        // A missing word: three dots in an empty, dashed frame.
        context.fillStyle = style.ink;
        for (const offset of [-26, 0, 26]) {
            context.beginPath();
            context.arc(centreX + offset, y + height / 2, 5.5, 0, Math.PI * 2);
            context.fill();
        }
        return;
    }
    const box = textBox(context, style.font, text);
    const baseline = y + height / 2 + (box.ascent - box.descent) / 2;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.font = style.font;
    if (style.shade) {
        context.save();
        context.shadowColor = style.shade;
        context.shadowBlur = 10;
        context.fillStyle = style.ink;
        context.fillText(text, centreX, baseline);
        context.restore();
    }
    if (style.glitch) {
        context.globalAlpha = 0.8;
        context.fillStyle = '#ff3ad8';
        context.fillText(text, centreX - 4, baseline);
        context.fillStyle = '#3afff0';
        context.fillText(text, centreX + 4, baseline);
        context.globalAlpha = 1;
    }
    context.fillStyle = style.ink;
    context.fillText(text, centreX, baseline);
}

/** Small solid squares for the plates' edges and stands, one pair per style. */
function drawSwatches(context) {
    const swatches = {};
    Object.entries(STYLES).forEach(([name, style], index) => {
        const x = index * SWATCH * 2;
        context.fillStyle = style.rim;
        context.fillRect(x, 0, SWATCH * 2, SWATCH);
        context.fillStyle = style.stand;
        context.fillRect(x, SWATCH, SWATCH * 2, SWATCH);
        swatches[name] = {
            rim: [(x + SWATCH) / ATLAS, 1 - (SWATCH / 2) / ATLAS],
            stand: [(x + SWATCH) / ATLAS, 1 - (SWATCH * 1.5) / ATLAS],
        };
    });
    return swatches;
}

// =============================================================================
// Plates
// =============================================================================

/** Map a box's faces: its front (and back, if two-sided) to the region, the rest to the rim. */
function mapFaces(geometry, region, swatch, twoSided) {
    const uv = geometry.attributes.uv;
    const u0 = region.x / ATLAS;
    const u1 = (region.x + region.width) / ATLAS;
    const v1 = 1 - region.y / ATLAS;
    const v0 = 1 - (region.y + region.height) / ATLAS;
    const index = geometry.index;
    for (const group of geometry.groups) {
        const face = group.materialIndex;
        const seen = new Set();
        for (let at = group.start; at < group.start + group.count; at += 1) seen.add(index.getX(at));
        for (const vertex of seen) {
            if (face === 4 || (face === 5 && twoSided)) {
                uv.setXY(vertex, u0 + uv.getX(vertex) * (u1 - u0), v0 + uv.getY(vertex) * (v1 - v0));
            } else {
                uv.setXY(vertex, swatch[0], swatch[1]);
            }
        }
    }
    geometry.clearGroups();
}

function flatUV(geometry, swatch) {
    const uv = geometry.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setXY(vertex, swatch[0], swatch[1]);
}

function setSway(geometry, sway) {
    geometry.setAttribute('sway', new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).map((_, vertex) => sway(vertex)), 1));
}

/** The plate's frame: its face looks along `normal`, its top toward the sky, leaning by `roll`. */
function plateMatrix(mount) {
    const normal = mount.normal.clone().normalize();
    const side = new Vector3(0, 1, 0).cross(normal).normalize();
    const up = normal.clone().cross(side);
    if (mount.roll) {
        side.applyAxisAngle(normal, mount.roll);
        up.applyAxisAngle(normal, mount.roll);
    }
    return new Matrix4().makeBasis(side, up, normal).setPosition(mount.position);
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * Draw every sign and hang it on its mount.
 * @param {object} options
 * @param {{ signs: object[] }} options.data - data/signs.json
 * @param {Map<string, object>} options.mounts - from places.js
 * @param {import('three').MeshToonMaterial} options.material - takes the atlas
 * @param {import('three').WebGLRenderer} options.renderer
 */
export async function createSigns({ data, mounts, material, renderer }) {
    const signs = (data?.signs ?? []).filter((sign) => {
        if (mounts.has(sign.mount)) return true;
        console.warn(`Elysicester signs: ${sign.id} names a mount the city doesn't have (${sign.mount}).`);
        return false;
    });
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS;
    canvas.height = ATLAS;
    const context = canvas.getContext('2d');

    // Load each face with every letter it must draw, and the probe letters too.
    const byFont = new Map();
    for (const sign of signs) {
        const { font } = STYLES[mounts.get(sign.mount).style];
        byFont.set(font, `${byFont.get(font) ?? ''}${sign.danaeam ?? ''}`);
    }
    const fontsLoaded = await loadFonts([...byFont].map(([font, text]) => [font, `${text}${PROBE}`]));
    const coverage = [...byFont].map(([font, text]) => ({
        font,
        missing: missingGlyphs(context, font, text),
        probeMissing: missingGlyphs(context, font, PROBE),
    }));
    for (const { font, missing } of coverage) {
        if (missing.length) console.warn(`Elysicester signs: ${font} lacks ${missing.join(' ')}; those letters fall back to another font.`);
    }

    const swatches = drawSwatches(context);
    const place = packer();
    const geometries = [];
    const entries = [];
    for (const sign of signs) {
        const mount = mounts.get(sign.mount);
        const style = STYLES[mount.style];
        const text = sign.danaeam;
        const measured = text === null ? 150 : textBox(context, style.font, text).width;
        const width = Math.min(ATLAS - GUTTER * 2, Math.max(REGION_HEIGHT * 1.25, Math.ceil(measured + PAD_X * 2)));
        const region = place(width);
        drawPlate(context, region, style, text);

        const aspect = region.width / region.height;
        let plateHeight = mount.height;
        let plateWidth = plateHeight * aspect;
        if (plateWidth > mount.maxWidth) {
            plateWidth = mount.maxWidth;
            plateHeight = plateWidth / aspect;
        }
        const matrix = plateMatrix(mount);
        const segments = mount.sway ? [12, 3] : [1, 1];
        const plate = new BoxGeometry(plateWidth, plateHeight, style.depth, segments[0], segments[1], 1);
        mapFaces(plate, region, swatches[mount.style].rim, mount.twoSided);
        const local = plate.attributes.position;
        setSway(plate, (vertex) => (mount.sway
            ? (0.5 - local.getY(vertex) / plateHeight) * (0.55 + 0.45 * Math.abs(local.getX(vertex)) / (plateWidth / 2))
            : 0));
        plate.applyMatrix4(matrix);
        const pieces = [plate];

        if (mount.stand) {
            const drop = (mount.position.y - plateHeight / 2 - mount.stand.base) / Math.cos(mount.roll);
            const legs = mount.stand.kind === 'posts' ? [-(plateWidth / 2 - 0.2), plateWidth / 2 - 0.2] : [0];
            for (const legX of legs) {
                const leg = new CylinderGeometry(0.035, 0.045, drop, 6);
                leg.translate(legX, -plateHeight / 2 - drop / 2, -style.depth / 2 - 0.04);
                flatUV(leg, swatches[mount.style].stand);
                setSway(leg, () => 0);
                leg.applyMatrix4(matrix);
                pieces.push(leg);
            }
        }
        geometries.push(...pieces);

        const side = new Vector3();
        const up = new Vector3();
        const normal = new Vector3();
        matrix.extractBasis(side, up, normal);
        entries.push({
            sign,
            mount,
            width: plateWidth,
            height: plateHeight,
            centre: mount.position.clone(),
            top: mount.position.clone().addScaledVector(up, plateHeight / 2 + 0.06),
            side,
            up,
            normal,
            indexCount: pieces.reduce((sum, piece) => sum + piece.index.count, 0),
        });
    }

    const merged = mergeGeometries(geometries, false);
    merged.computeBoundingSphere();
    let start = 0;
    for (const entry of entries) {
        entry.range = [start, start + entry.indexCount];
        start += entry.indexCount;
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = LinearMipmapLinearFilter;
    material.map = texture;
    material.emissiveMap = texture;
    material.needsUpdate = true;

    const mesh = new Mesh(merged, material);
    mesh.name = 'signs';

    return {
        mesh,
        entries,
        canvas,
        coverage: { fontsLoaded, fonts: coverage },
        /** The sign under a ray, if any: { entry, distance }. */
        pick(raycaster) {
            const [hit] = raycaster.intersectObject(mesh, false);
            if (!hit) return null;
            const at = hit.faceIndex * 3;
            const entry = entries.find(({ range }) => at >= range[0] && at < range[1]);
            return entry ? { entry, distance: hit.distance } : null;
        },
    };
}

/** How far away to stand to read a plate of this height. */
export function readingDistance(entry) {
    return MathUtils.clamp(entry.height * 26 + 3, 8, 22);
}

// =============================================================================
// The words as text: over the scene, and in the list
// =============================================================================

const HIDE_AFTER_TAP_MS = 4500;
/** A reading view stands at least this far from anything solid (more than the camera's own clearance). */
const VIEW_ROOM = 1.2;
/** A reading point this close to a tap keeps it, even over a sign. */
const POINT_KEEPS_TAP_PX = 18;

/** A sign's words as text: the Danæam marked as such, and the site's gloss only where it gives one. */
function fillWords(element, sign) {
    element.replaceChildren();
    const words = document.createElement('span');
    words.className = 'sign-words';
    if (sign.danaeam === null) {
        words.textContent = '· · ·';
        element.append(words);
        return;
    }
    words.lang = 'art-x-danaeam';
    words.textContent = sign.danaeam;
    element.append(words);
    if (sign.gloss) {
        const gloss = document.createElement('span');
        gloss.className = 'sign-gloss';
        gloss.textContent = sign.gloss;
        element.append(gloss);
    }
}

/**
 * Every sign as a button in the list (for keyboards, screen readers, and the
 * still): focusing one brings the camera round to read it.
 * @param {object} options
 * @param {HTMLElement} options.list - an empty <ul>
 * @param {object[]} options.signs - data/signs.json's signs
 * @param {Map<string, object>} options.places
 * @param {(sign: object | null) => void} options.onFocusSign
 */
export function createSignList({ list, signs, places, onFocusSign }) {
    for (const sign of signs) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sign-link';
        button.dataset.sign = sign.id;
        fillWords(button, sign);
        const where = document.createElement('span');
        where.className = 'visually-hidden';
        const place = sign.where ?? places.get(sign.place)?.label;
        where.textContent = sign.danaeam === null ? ` (${place}: a sign still waiting for its word)` : ` (${place})`;
        button.append(where);
        button.addEventListener('focus', () => onFocusSign(sign));
        button.addEventListener('click', () => onFocusSign(sign));
        item.append(button);
        list.append(item);
    }
    list.closest('nav')?.addEventListener('focusout', (event) => {
        if (!list.contains(event.relatedTarget)) onFocusSign(null);
    });
}

/**
 * Show a sign's words over the scene: while a mouse rests on it, for a moment
 * after a tap on it, and for as long as its entry in the list has focus.
 * @param {object} options
 * @param {object} options.stage - from createStage (has signs)
 * @param {HTMLElement} options.label - the floating caption
 * @param {() => boolean} options.isBusy - true while a reading point is lit or the reader is open
 */
export function createSignOverlay({ stage, label, isBusy }) {
    const { camera, canvas, rig, signs, scene, solids } = stage;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const projected = new Vector3();
    let shown = null;
    let pinned = false;
    let hideTimer = 0;

    // A tap sees through glass; a reading view shouldn't be taken through it, nor past another
    // sign standing in front (the rays stop short of the plate being read, so it never blocks itself).
    // The hums flit about, and block nothing; nor does the verti-pool's water.
    const occluders = scene.children.filter((child) => child instanceof Mesh && !['sky', 'sea', 'glass', 'turquoise', 'signs', 'hums', 'verti-pool'].includes(child.name));
    const viewBlockers = scene.children.filter((child) => child instanceof Mesh && !['sky', 'sea', 'turquoise', 'hums', 'verti-pool'].includes(child.name));
    // The flags aren't solid to the camera (it may pass through cloth), but a view seen through them is crowded.
    const cloth = scene.children.filter((child) => child instanceof Mesh && child.name === 'turquoise');

    function pickAt(x, y) {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        raycaster.far = Infinity;
        const hit = signs.pick(raycaster);
        if (!hit) return null;
        // A sign behind the city can't be read through it.
        const blocked = raycaster.intersectObjects(occluders, false)[0];
        return blocked && blocked.distance < hit.distance ? null : hit.entry;
    }

    function show(entry) {
        shown = entry;
        label.hidden = !entry;
        if (entry) fillWords(label, entry.sign);
    }

    function screenOf(entry) {
        projected.copy(entry.top).project(camera);
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height, inFront: projected.z < 1 };
    }

    const DOWN = new Vector3(0, -1, 0);
    const UP = new Vector3(0, 1, 0);

    // Lines of sight through a grid of the city's triangles (rays.js), sorted in idle moments;
    // until then, three.js's own raycaster (the same answer, only slower).
    const sight = createRayGrid(viewBlockers);

    function clearLine(from, to) {
        if (sight.ready()) return sight.clear(from, to, 0.08);
        const direction = to.clone().sub(from);
        const distance = direction.length();
        raycaster.set(from, direction.normalize());
        raycaster.far = distance - 0.08;
        return raycaster.intersectObjects(viewBlockers, false).length === 0;
    }

    /**
     * Points across the plate's face (a little inset), close enough together that
     * a pole standing before any of its words hides one: the whole face must be
     * seen, not just its middle.
     */
    function facePoints(entry) {
        const points = [entry.centre];
        for (const across of [-0.85, -0.57, -0.28, 0, 0.28, 0.57, 0.85]) {
            for (const upward of [-0.6, 0.6]) {
                points.push(entry.centre.clone()
                    .addScaledVector(entry.side, (across * entry.width) / 2)
                    .addScaledVector(entry.up, (upward * entry.height) / 2));
            }
        }
        return points;
    }

    /** True if nothing but air lies between `from` and every part of the plate's face. */
    function clearFrom(from, entry) {
        return facePoints(entry).every((point) => clearLine(from, point));
    }

    /** True if open sky lies above `eye` (so it isn't inside a house or under an arch). */
    function openSky(eye) {
        const above = eye.clone().add(new Vector3(0, 60, 0));
        if (sight.ready()) return sight.clear(above, eye, 0.2);
        raycaster.set(above, DOWN);
        raycaster.far = 60 - 0.2;
        return raycaster.intersectObjects(viewBlockers, false).length === 0;
    }

    function visible(entry) {
        return clearFrom(camera.position, entry);
    }

    /** True if the camera could stand at `eye` without the solids moving it (solids.js keeps it clear). */
    function roomy(eye) {
        return !solids?.available || solids.distance(eye) >= VIEW_ROOM;
    }

    /** Points around the plate, well clear of its edges: a view that sees them isn't peering through a gap. */
    function marginPoints(entry) {
        const points = [];
        for (const across of [-1.7, 1.7]) {
            for (const upward of [-2, 2]) {
                points.push(entry.centre.clone()
                    .addScaledVector(entry.side, (across * entry.width) / 2)
                    .addScaledVector(entry.up, (upward * entry.height) / 2));
            }
        }
        return points;
    }

    const views = new Map();
    const probe = new Vector3();
    const toward = new Vector3();

    /** True if the flags hang across the first `length` of the way from `eye` toward `target`. */
    function throughCloth(eye, target, length) {
        if (!cloth.length) return false;
        raycaster.set(eye, toward.subVectors(target, eye).normalize());
        raycaster.far = length;
        return raycaster.intersectObjects(cloth, false).length > 0;
    }

    /** How far a ray gets through the solids' field (as a share of `length`) before it meets anything. */
    function reachOf(eye, target, length) {
        toward.subVectors(target, eye);
        const full = toward.length();
        toward.divideScalar(full);
        let travelled = 0;
        while (travelled < length) {
            probe.copy(eye).addScaledVector(toward, travelled);
            const gap = solids.distance(probe);
            if (gap < 0.15) break;
            travelled += Math.max(gap, 0.2);
        }
        return Math.min(1, travelled / length);
    }

    /**
     * How open the view from `eye` is, traced through the solids' field: rays
     * over the whole frame, and how much of it is filled by things close to the
     * camera (a roof, a spire, a pole); and rays just round the plate, and
     * whether anything crosses in front of it. 1 is open on both counts.
     */
    function openness(eye, entry) {
        const reach = eye.distanceTo(entry.centre);
        const halfHeight = reach * Math.tan(MathUtils.degToRad(camera.fov) / 2) * 0.95;
        const halfWidth = halfHeight * Math.max(0.5, camera.aspect);
        // The frame as the camera will see it: square to the line of sight, through the plate.
        const look = entry.centre.clone().sub(eye).normalize();
        const right = new Vector3().crossVectors(look, UP).normalize();
        const up = new Vector3().crossVectors(right, look);
        const target = new Vector3();
        let near = 0;
        let frame = 0;
        for (const across of [-1, -0.66, -0.33, 0, 0.33, 0.66, 1]) {
            for (const upward of [-1, -0.5, 0, 0.5, 1]) {
                target.copy(entry.centre).addScaledVector(right, across * halfWidth).addScaledVector(up, upward * halfHeight);
                const length = eye.distanceTo(target);
                if (reachOf(eye, target, length * 0.55) < 1 || throughCloth(eye, target, length * 0.55)) near += 1;
                frame += 1;
            }
        }
        // Round the plate; and across its face, closely enough that a pole before any of its words shows.
        const blocked = (spots) => spots.filter(([across, upward]) => {
            target.copy(entry.centre).addScaledVector(entry.side, (across * entry.width) / 2).addScaledVector(entry.up, (upward * entry.height) / 2);
            return reachOf(eye, target, eye.distanceTo(target) - 1.2) < 1;
        }).length;
        const round = [];
        for (const across of [-1.4, 0, 1.4]) for (const upward of [-1.6, 0, 1.6]) round.push([across, upward]);
        const face = [];
        for (const across of [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9]) for (const upward of [-0.5, 0.5]) face.push([across, upward]);
        return { open: 1 - near / frame, clear: 1 - blocked(round) / round.length, faced: blocked(face) === 0 };
    }

    /**
     * Where to stand to read a plate. Every stance round it (straight on, then
     * turned a little or a lot, lower or higher, nearer or at the full reading
     * distance, and from behind if its words read from there too) is scored:
     * stances with nothing at all before the plate's words come first; then, a
     * frame not crowded by things close to the camera, and nothing crossing
     * round the plate; then looking at it more squarely. Best first, the first
     * place with nothing between it and the whole plate, and room around the
     * plate as well, wins; failing that, the first that sees the plate at all.
     * Each sign's view is found once and kept.
     *
     * The search is a generator that pauses after every stance it scores and
     * every ray it casts, so the idle-time search can stop wherever a frame is
     * due and carry on next time.
     */
    function* searchView(entry) {
        const distance = readingDistance(entry);
        const facing = Math.atan2(entry.normal.x, entry.normal.z);
        const sides = entry.mount.twoSided ? [0, Math.PI] : [0];
        const eye = new Vector3();
        const place = (candidate) => {
            const across = Math.sqrt(1 - candidate.lift * candidate.lift) * candidate.reach;
            return eye.set(Math.sin(candidate.theta) * across, candidate.lift * candidate.reach, Math.cos(candidate.theta) * across).add(entry.centre);
        };
        const candidates = [];
        for (const side of sides) {
            for (const [lift, liftScore] of [[0.3, 0.3], [0.5, 0.2], [0.18, 0.1], [0.7, 0]]) {
                for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
                    for (const [share, reachScore] of [[1, 0.2], [0.75, 0.25], [0.55, 0.05]]) {
                        const candidate = { theta: facing + side + turn, lift, reach: Math.max(6, distance * share) };
                        candidate.score = liftScore + reachScore + (1 - Math.abs(turn) / 1.05) * 0.6 + (side ? 0 : 0.2);
                        candidates.push(candidate);
                    }
                }
            }
        }
        // The cheap tests first, through the field: room to stand, and an open foreground.
        const known = solids?.available;
        const ranked = [];
        for (const candidate of candidates) {
            if (!roomy(place(candidate))) continue;
            if (known) {
                const { open, clear, faced } = openness(eye, entry);
                Object.assign(candidate, { open, clear, faced, score: candidate.score + 3 * open + 2 * clear });
                yield;
            }
            ranked.push(candidate);
        }
        // Whole words first: a stance with anything before the plate's face waits behind every one without.
        ranked.sort((a, b) => (b.faced === false ? 0 : 1) - (a.faced === false ? 0 : 1) || b.score - a.score);
        const face = facePoints(entry);
        const margins = marginPoints(entry);
        let fallback = null;
        for (const candidate of ranked) {
            place(candidate);
            const standing = eye.clone();
            if (!openSky(standing)) continue;
            yield;
            let seen = true;
            for (const point of face) {
                seen = clearLine(standing, point);
                yield;
                if (!seen) break;
            }
            if (!seen) continue;
            fallback ??= candidate;
            let roomAround = true;
            for (const point of margins) {
                roomAround = clearLine(standing, point);
                yield;
                if (!roomAround) break;
            }
            if (roomAround) return candidate;
        }
        return fallback ?? candidates[0];
    }

    /** The view for a sign, found now if the idle-time search hasn't reached it yet. */
    function readingView(entry) {
        if (views.has(entry.sign.id)) return views.get(entry.sign.id);
        const search = current?.entry === entry ? current.search : searchView(entry);
        if (current?.entry === entry) current = null;
        let step = search.next();
        while (!step.done) step = search.next();
        views.set(entry.sign.id, step.value);
        return step.value;
    }

    // Find every sign's view in idle moments, a few milliseconds at a time (the search pauses
    // mid-sign wherever a frame is due), so focusing one seldom waits and the city never stutters.
    // It begins once the solids are known; views found before then are found again, with room to stand.
    const idle = window.requestIdleCallback ?? ((callback) => setTimeout(() => callback(null), 50));
    const pending = [];
    let current = null;
    let searchMs = 0;
    const sorting = sight.build();
    const prepare = (deadline) => {
        const started = performance.now();
        const until = started + Math.max(2, Math.min(10, deadline?.timeRemaining() ?? 6));
        while (performance.now() < until) {
            if (!sight.ready()) {
                sorting.next();
                continue;
            }
            if (!current) {
                const entry = pending.shift();
                if (!entry) break;
                if (views.has(entry.sign.id)) continue;
                current = { entry, search: searchView(entry) };
            }
            const step = current.search.next();
            if (step.done) {
                views.set(current.entry.sign.id, step.value);
                current = null;
            }
        }
        searchMs += performance.now() - started;
        if (current || pending.length) idle(prepare);
    };
    (solids?.ready ?? Promise.resolve(false)).then(() => {
        views.clear();
        pending.push(...signs.entries);
        idle(prepare);
    });

    canvas.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse' || event.buttons || pinned) return;
        const entry = isBusy() ? null : pickAt(event.clientX, event.clientY);
        if (entry !== shown) show(entry);
    });
    // (Touch pointers "leave" as they lift, just after the tap that shows a sign: only a mouse leaves.)
    canvas.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'mouse' && !pinned) show(null);
    });
    rig.onTap((x, y) => {
        if (isBusy()) return;
        const entry = pickAt(x, y);
        if (!entry) return;
        show(entry);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!pinned && shown === entry) show(null);
        }, HIDE_AFTER_TAP_MS);
    });

    stage.onFrame(() => {
        if (!shown) return;
        if (isBusy() && !pinned) {
            show(null);
            return;
        }
        const screen = screenOf(shown);
        label.style.translate = `${Math.round(screen.x)}px ${Math.round(screen.y)}px`;
        label.hidden = !screen.inFront;
    });

    return {
        /** Bring the camera round to read a sign (from the list), or let it go. */
        focusSign(sign) {
            if (!sign) {
                pinned = false;
                show(null);
                return;
            }
            const entry = signs.entries.find((candidate) => candidate.sign.id === sign.id);
            if (!entry) return;
            pinned = true;
            show(entry);
            const view = readingView(entry);
            rig.focus(sign.place, entry.centre, MathUtils.radToDeg(view.theta), { distance: view.reach, height: view.reach * view.lift });
        },
        hide() {
            pinned = false;
            show(null);
        },
        /** A tap squarely on a plate keeps it from a reading point that the tap only grazed. */
        claimsTap(x, y, pointDistance) {
            return pointDistance > POINT_KEEPS_TAP_PX && pickAt(x, y) !== null;
        },
        /** For tests: the sign shown, where each plate is on screen, and what finding the views cost. */
        shownId: () => (label.hidden ? null : shown?.sign.id ?? null),
        viewSearch: () => ({ prepared: views.size, of: signs.entries.length, ms: Math.round(searchMs) }),
        viewFor: (id) => views.get(id) ?? null,
        screenPositions() {
            return signs.entries.map((entry) => {
                projected.copy(entry.centre).project(camera);
                const rect = canvas.getBoundingClientRect();
                return {
                    id: entry.sign.id,
                    x: rect.left + ((projected.x + 1) / 2) * rect.width,
                    y: rect.top + ((1 - projected.y) / 2) * rect.height,
                    inFront: projected.z < 1,
                    visible: visible(entry),
                };
            });
        },
    };
}
