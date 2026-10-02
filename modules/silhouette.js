/**
 * silhouette.js — the silhouette on the doors of The Door in the Floor (Numbers by Paint, Episode 4, p. 60):
 * "an old, white door imprinted with the silhouette of a mouse and two jugs of ale, one enormous beside the mouse,
 * the other tiny, mouse-sized, from which the little creature drank. It smiled as if having thought of a joke,
 * awaiting its chance to share it." And upstairs, "dozens of doors all imprinted with the same silhouette as the
 * entrance, but in myriad new colours", E's among them, where "the mouse and the jugs were a rainbow kaleidoscope".
 *
 * Drawn once, on a canvas, when the city is built (no picture file): a mouse on its hind legs, holding up the tiny
 * jug to its snout with both forepaws, its tail curled behind it, an eye and a smile cut into it; and beside it the
 * enormous jug, its foam running over the rim. Two cells side by side: the silhouette in white (tinted by whatever
 * wears it), and the same silhouette as a rainbow kaleidoscope.
 */

// =============================================================================
// Imports
// =============================================================================

import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** Each cell's side, in pixels (the atlas is two cells across, one down). */
const CELL = 256;

// =============================================================================
// Main Code
// =============================================================================

/**
 * The silhouette's outline in one cell (256 across, y down, standing on y = 232), filled as one shape; then its
 * eye, its smile and the space inside the big jug's handle cut out of it.
 * @param {CanvasRenderingContext2D} context
 * @param {string | CanvasGradient | CanvasPattern} fill
 */
function drawMouseAndJugs(context, fill) {
    context.save();
    context.fillStyle = fill;
    context.strokeStyle = fill;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // The enormous jug: a tankard, a little wider at its foot, three hoops round it, its handle on the far side.
    context.beginPath();
    context.moveTo(40, 232);
    context.lineTo(44, 98);
    context.quadraticCurveTo(44, 90, 50, 88);
    context.lineTo(120, 88);
    context.quadraticCurveTo(126, 90, 126, 98);
    context.lineTo(130, 232);
    context.closePath();
    context.fill();
    // Its foam, in heaps over the rim, one runnel running down its side.
    context.beginPath();
    context.moveTo(40, 96);
    for (const [x, y, r] of [[52, 84, 13], [70, 74, 15], [90, 76, 14], [108, 72, 15], [124, 84, 12]]) context.arc(x, y, r, Math.PI, 0);
    context.lineTo(134, 104);
    context.quadraticCurveTo(137, 122, 131, 134);
    context.quadraticCurveTo(128, 120, 126, 106);
    context.closePath();
    context.fill();
    // Its hoops, standing a little proud of the sides.
    for (const y of [118, 170, 214]) {
        context.fillRect(37, y, 97, 7);
    }
    // Its handle.
    context.lineWidth = 11;
    context.beginPath();
    context.moveTo(44, 116);
    context.bezierCurveTo(8, 118, 6, 196, 42, 198);
    context.stroke();

    // The mouse, on its hind legs, turned toward the big jug: its body a leaning pear, its head tipped back to drink.
    context.beginPath();
    context.ellipse(206, 188, 26, 41, 0.16, 0, Math.PI * 2);
    context.fill();
    // Its feet.
    context.beginPath();
    context.ellipse(193, 229, 12, 5, 0, 0, Math.PI * 2);
    context.ellipse(221, 229, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    // Its head, snout lifted to the tiny jug, and its big round ear.
    context.beginPath();
    context.ellipse(194, 130, 20, 18, -0.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(180, 120);
    context.quadraticCurveTo(168, 110, 162, 108);
    context.quadraticCurveTo(166, 122, 182, 138);
    context.closePath();
    context.fill();
    context.beginPath();
    context.arc(210, 112, 14, 0, Math.PI * 2);
    context.fill();
    // Its forepaws, both lifting the tiny jug to its snout.
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(194, 160);
    context.quadraticCurveTo(178, 150, 166, 130);
    context.stroke();
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(204, 158);
    context.quadraticCurveTo(188, 144, 172, 124);
    context.stroke();
    // The tiny jug, mouse-sized, tipped up at its snout: a little tankard with its own handle and its own foam.
    context.save();
    context.translate(163, 112);
    context.rotate(-0.6);
    context.fillRect(-9, -13, 18, 25);
    context.fillRect(-10, 1, 20, 3);
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(-9, -1, 6, Math.PI / 2, Math.PI * 1.5);
    context.stroke();
    context.beginPath();
    context.arc(-5, -15, 5, 0, Math.PI * 2);
    context.arc(3, -16, 5.5, 0, Math.PI * 2);
    context.arc(9, -13, 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Its tail, curled round behind it.
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(228, 214);
    context.bezierCurveTo(254, 228, 256, 182, 240, 178);
    context.bezierCurveTo(228, 176, 229, 193, 239, 193);
    context.stroke();

    // Cut out of it: the space inside the handles, the mouse's eye, and its smile, as if it had thought of a joke.
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.ellipse(28, 157, 7, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(191, 123, 3.2, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 2.6;
    context.beginPath();
    context.moveTo(172, 128);
    context.quadraticCurveTo(180, 140, 192, 136);
    context.stroke();
    context.restore();
}

/**
 * A rainbow kaleidoscope over a cell: a ring of wedges, each banded in rings through the hues with shards across
 * them, every other wedge mirrored (as a kaleidoscope's mirrors turn it), so the shards meet as a star.
 */
function kaleidoscope(context, left) {
    const cx = left + CELL / 2;
    const cy = CELL / 2 + 14;
    const wedges = 12;
    const span = (Math.PI * 2) / wedges;
    for (let wedge = 0; wedge < wedges; wedge += 1) {
        context.save();
        context.translate(cx, cy);
        context.rotate(wedge * span);
        if (wedge % 2) {
            context.rotate(span);
            context.scale(1, -1);
        }
        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, CELL, -0.01, span + 0.01);
        context.closePath();
        context.clip();
        context.lineWidth = 15;
        for (let r = 6; r < CELL; r += 14) {
            context.strokeStyle = `hsl(${Math.round(r * 2.3) % 360}, 95%, 60%)`;
            context.beginPath();
            context.arc(0, 0, r, -0.1, span + 0.1);
            context.stroke();
        }
        for (const [r, a, size, hue] of [[30, 0.25, 9, 20], [58, 0.6, 13, 200], [90, 0.3, 11, 300], [122, 0.7, 15, 90], [150, 0.4, 12, 160], [184, 0.55, 16, 40]]) {
            const x = Math.cos(a * span) * r;
            const y = Math.sin(a * span) * r;
            context.fillStyle = `hsl(${hue}, 100%, 72%)`;
            context.beginPath();
            context.moveTo(x - size, y);
            context.lineTo(x, y - size * 0.6);
            context.lineTo(x + size, y);
            context.lineTo(x, y + size * 0.6);
            context.closePath();
            context.fill();
        }
        context.restore();
    }
}

/**
 * The atlas: [0, 0.5) across, the silhouette in white on nothing (a door tints it); [0.5, 1), the same silhouette
 * as a rainbow kaleidoscope (E's door). One texture, so every door's silhouette is one draw.
 * @returns {CanvasTexture}
 */
export function silhouetteAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = CELL * 2;
    canvas.height = CELL;
    const context = canvas.getContext('2d');
    drawMouseAndJugs(context, '#ffffff');
    // The second cell: the silhouette drawn, and the kaleidoscope (made whole first, apart) laid only where it is,
    // in one draw (source-in keeps only where the silhouette already is).
    const pattern = document.createElement('canvas');
    pattern.width = CELL * 2;
    pattern.height = CELL;
    kaleidoscope(pattern.getContext('2d'), CELL);
    const second = document.createElement('canvas');
    second.width = CELL * 2;
    second.height = CELL;
    const inner = second.getContext('2d');
    inner.save();
    inner.translate(CELL, 0);
    drawMouseAndJugs(inner, '#ffffff');
    inner.restore();
    inner.globalCompositeOperation = 'source-in';
    inner.drawImage(pattern, 0, 0);
    context.drawImage(second, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return texture;
}
