/**
 * cassandra.js — the pictures Cassandra's house wants (places.js buildCassandra), drawn once on canvases when the city
 * is built (no picture files):
 *
 * - her shadow, as it stands in the doorway when it answers (Numbers by Paint, Episode 4, p. 64: "She hopped the fence
 *   and knocked on the seeress’ door. Cassandra’s shadow answered."): a woman's shadow, long-haired, in a long dress,
 *   one hand up on the door's edge;
 * - a pale face, for the windows up and down the street once the door has slammed ("its slam reverberated through the
 *   neighbourhood ... pale faces lit up half the windows on the street", p. 65);
 * - her bedroom's ceiling, seen through the window high in the gable: "the warm, gentle dark but the yang-white
 *   fluorescence of the glow-in-the-dark stars and moon above" (Episode 6, p. 90).
 */

// =============================================================================
// Imports
// =============================================================================

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

// =============================================================================
// Main Code
// =============================================================================

function canvasOf(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, context: canvas.getContext('2d') };
}

function textureOf(canvas, { srgb = true } = {}) {
    const texture = new CanvasTexture(canvas);
    if (srgb) texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
}

/**
 * Her shadow, white on nothing (the material darkens it): 128 across, 256 down, standing on the bottom; the door's
 * edge on the left, where her hand is.
 */
export function shadowFigure() {
    const { canvas, context } = canvasOf(128, 256);
    context.fillStyle = '#ffffff';
    // Her head, turned a little toward the door's edge, on a slender neck.
    context.beginPath();
    context.ellipse(68, 38, 13, 16, -0.12, 0, Math.PI * 2);
    context.fill();
    context.fillRect(63, 48, 10, 16);
    // Her shoulders, her waist, and the long dress flaring a little to the floor.
    context.beginPath();
    context.moveTo(60, 62);
    context.bezierCurveTo(50, 63, 42, 66, 40, 76);
    context.bezierCurveTo(39, 90, 48, 108, 54, 122);
    context.bezierCurveTo(50, 150, 40, 200, 30, 256);
    context.lineTo(104, 256);
    context.bezierCurveTo(96, 200, 88, 150, 84, 122);
    context.bezierCurveTo(90, 108, 98, 90, 97, 76);
    context.bezierCurveTo(95, 66, 86, 63, 76, 62);
    context.closePath();
    context.fill();
    // Her long hair, one mass with her head (so no light shows between): over the crown, a lock by her near cheek,
    // and the rest down her back past the waist.
    context.beginPath();
    context.moveTo(57, 44);
    context.bezierCurveTo(50, 34, 54, 20, 68, 20);
    context.bezierCurveTo(80, 20, 86, 30, 86, 44);
    context.bezierCurveTo(88, 62, 90, 84, 90, 104);
    context.bezierCurveTo(90, 120, 88, 132, 84, 140);
    context.bezierCurveTo(80, 122, 76, 98, 72, 76);
    context.lineTo(66, 60);
    context.lineTo(66, 40);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(58, 30);
    context.bezierCurveTo(52, 42, 50, 56, 52, 68);
    context.lineTo(64, 68);
    context.lineTo(64, 36);
    context.closePath();
    context.fill();
    // Her near arm, the elbow bent, the hand up on the door's edge at the height of her shoulder.
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#ffffff';
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(48, 72);
    context.lineTo(34, 98);
    context.lineTo(14, 74);
    context.stroke();
    context.beginPath();
    context.ellipse(11, 70, 5, 8, 0.3, 0, Math.PI * 2);
    context.fill();
    return textureOf(canvas, { srgb: false });
}

/**
 * A window lit up, and a pale face in it, looking out ("pale faces lit up half the windows on the street"): the
 * lamplight filling the window, someone's shoulders dark against it, their face pale, two dark eyes, a mouth set
 * straight; 64 across, 88 down (a hall's window, 0.22 by 0.3).
 */
export function paleFace() {
    const { canvas, context } = canvasOf(64, 88);
    const lamp = context.createLinearGradient(0, 0, 0, 88);
    lamp.addColorStop(0, '#ffc27a');
    lamp.addColorStop(1, '#f08a3a');
    context.fillStyle = lamp;
    context.fillRect(0, 0, 64, 88);
    // Their shoulders and neck, dark against the light.
    context.fillStyle = '#4a2a2a';
    context.beginPath();
    context.moveTo(4, 88);
    context.bezierCurveTo(6, 70, 18, 64, 32, 64);
    context.bezierCurveTo(46, 64, 58, 70, 60, 88);
    context.closePath();
    context.fill();
    // The face, pale.
    const pale = context.createRadialGradient(32, 38, 4, 32, 40, 22);
    pale.addColorStop(0, '#fffaf2');
    pale.addColorStop(1, '#e6ddd4');
    context.fillStyle = pale;
    context.beginPath();
    context.ellipse(32, 40, 15, 20, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(40, 30, 40, 0.95)';
    for (const x of [26, 38]) {
        context.beginPath();
        context.ellipse(x, 38, 2.6, 3.4, 0, 0, Math.PI * 2);
        context.fill();
    }
    context.strokeStyle = 'rgba(70, 50, 60, 0.6)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(28, 51);
    context.lineTo(36, 51);
    context.stroke();
    return textureOf(canvas);
}

/**
 * Her ceiling, through the round window: the dark, a crescent moon and stars, all glowing a cool white-green, as
 * glow-in-the-dark plastic does; 128 square.
 */
export function starCeiling() {
    const { canvas, context } = canvasOf(128, 128);
    context.fillStyle = '#0c0a18';
    context.fillRect(0, 0, 128, 128);
    const glowInk = 'rgba(214, 255, 226, 1)';
    const star = (x, y, r) => {
        context.beginPath();
        for (let point = 0; point < 10; point += 1) {
            const angle = (point / 10) * Math.PI * 2 - Math.PI / 2;
            const radius = point % 2 ? r * 0.42 : r;
            context[point ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        }
        context.closePath();
        context.fill();
    };
    context.fillStyle = glowInk;
    // The moon, a fat crescent.
    context.beginPath();
    context.arc(44, 46, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0c0a18';
    context.beginPath();
    context.arc(54, 40, 18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = glowInk;
    for (const [x, y, r] of [[92, 30, 8], [104, 70, 6], [70, 92, 7], [30, 96, 5], [96, 104, 4], [20, 22, 4], [78, 58, 3.5], [112, 44, 3]]) star(x, y, r);
    return textureOf(canvas);
}
