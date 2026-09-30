/**
 * extras.js — the extras, each behind a flag of its own.
 *
 * They began off, one flag each, until they'd been seen; now they're part of
 * the city, and every one of them is on for everyone except door-open. The
 * address can still choose: ?extras=none turns them all off, ?extras=sky,hums
 * (any of the names below, comma-separated) gives exactly those, and
 * ?extras=all,door-open gives them all with the door opened whatever the hour.
 *
 *   sky        THIS IS NOT THE WORLD, inscribed round the sky, as Elm's
 *              milestone plates are titled
 *   shadow     a single character's shadow on a café wall: the shadow of
 *              Numbers by Paint, Episode 3, looking out to sea
 *   door       the sky-grottos' yellow door opens, but only at dusk (the
 *              visitor's own evening), or at Samhain (in the southern
 *              hemisphere, around 30 April–1 May)
 *   door-open  the same door, open whatever the hour (to see it by)
 *   voice      a few lines in the browser's console, in the site's own words:
 *              the city's names as Elm gave them, and one of its passages
 *   hums       a few of the bridgework's "countless hums": tiny bronze
 *              hummingbirds hovering by the spires and darting between them
 *              (Numbers by Paint, Episode 3; hums.js)
 */

// =============================================================================
// Imports
// =============================================================================

import { CanvasTexture, LinearFilter, RepeatWrapping } from 'three';
import { trialOn } from './trials.js';

// =============================================================================
// Constants
// =============================================================================

export const EXTRAS = Object.freeze(['sky', 'shadow', 'door', 'door-open', 'voice', 'hums']);
/** What every visitor gets unless the address says otherwise: all but door-open. */
export const DEFAULT_EXTRAS = Object.freeze(EXTRAS.filter((name) => name !== 'door-open'));

/** The words inscribed round the sky, as Elm's milestone pages have them. */
export const INSCRIPTION = 'THIS IS NOT THE WORLD';

/** The visitor's evening, in local hours: dusk, near enough, wherever and whenever they are. */
const DUSK_FROM = 17.5;
const DUSK_UNTIL = 21;

// =============================================================================
// Which extras, and when
// =============================================================================

/**
 * Which extras to build (a Set of names). With no ?extras= in the address, the
 * defaults; with one, exactly the names it lists ("all" standing for the
 * defaults, and "none", like any word that names nothing, adding nothing).
 */
export function wantedExtras(search = window.location.search) {
    const asked = new URLSearchParams(search).get('extras');
    if (asked === null) return new Set(DEFAULT_EXTRAS);
    const names = asked.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
    const all = names.includes('all') ? DEFAULT_EXTRAS : [];
    return new Set([...all, ...names.filter((name) => EXTRAS.includes(name))]);
}

/** True at Samhain in the southern hemisphere (30 April and 1 May), by the visitor's calendar. */
export function isSamhain(date = new Date()) {
    const month = date.getMonth();
    const day = date.getDate();
    return (month === 3 && day === 30) || (month === 4 && day === 1);
}

/** True in the visitor's evening. */
export function isDusk(date = new Date()) {
    const hours = date.getHours() + date.getMinutes() / 60;
    return hours >= DUSK_FROM && hours < DUSK_UNTIL;
}

/** Whether the extras build the yellow door as one that can open at all. */
export function doorCanOpen(extras) {
    return extras.has('door') || extras.has('door-open');
}

/** Whether the yellow door stands open now. */
export function doorOpen(extras, date = new Date()) {
    if (extras.has('door-open')) return true;
    return extras.has('door') && (isDusk(date) || isSamhain(date));
}

// =============================================================================
// Pictures
// =============================================================================

/** The inscription drawn once, pale on clear, for the sky's shader to repeat round the horizon. */
export async function inscriptionTexture() {
    const size = 38;
    const font = `500 ${size}px Cormorant, Georgia, serif`;
    try {
        await document.fonts.load(font, INSCRIPTION);
    } catch {
        // A fallback serif draws it instead.
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.font = font;
    context.fillStyle = '#ffffff';
    context.textBaseline = 'middle';
    // Letter by letter, spaced as the milestone pages space them (0.3em).
    const spacing = size * 0.3;
    const letters = [...INSCRIPTION];
    const width = letters.reduce((sum, letter) => sum + context.measureText(letter).width + spacing, -spacing);
    let x = (canvas.width - width) / 2;
    for (const letter of letters) {
        context.fillText(letter, x, canvas.height / 2 + 2);
        x += context.measureText(letter).width + spacing;
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return texture;
}

/**
 * The shadow on the wall as the banshee (a trial, trials.js: ?wraith=off gives the walker's back), as banshee.js
 * makes it: a sheet over a round hood, the hood's roundness running into soft shoulders with no neck between,
 * the cloth falling to a hem in soft scallops that floats clear of the ground; one wide sleeve hanging, the other
 * lifted a little, as if to wave.
 */
function banshee(context) {
    context.beginPath();
    context.ellipse(128, 100, 34, 38, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(98, 118);
    context.quadraticCurveTo(128, 134, 158, 118);
    context.quadraticCurveTo(184, 136, 186, 176);
    context.quadraticCurveTo(190, 320, 206, 440);
    const waves = 5;
    const right = 206;
    const left = 50;
    for (let wave = 0; wave < waves; wave += 1) {
        const from = right - (wave * (right - left)) / waves;
        const to = right - ((wave + 1) * (right - left)) / waves;
        context.quadraticCurveTo((from + to) / 2, 472, to, 440);
    }
    context.quadraticCurveTo(66, 320, 70, 176);
    context.quadraticCurveTo(72, 136, 98, 118);
    context.closePath();
    context.fill();
    // The left sleeve, hanging, wide at the cuff.
    context.beginPath();
    context.moveTo(76, 150);
    context.quadraticCurveTo(46, 210, 34, 300);
    context.quadraticCurveTo(54, 286, 78, 298);
    context.quadraticCurveTo(80, 230, 94, 176);
    context.closePath();
    context.fill();
    // The right, lifted a little, as if to wave.
    context.beginPath();
    context.moveTo(178, 150);
    context.quadraticCurveTo(214, 160, 230, 214);
    context.quadraticCurveTo(212, 206, 196, 222);
    context.quadraticCurveTo(190, 186, 170, 170);
    context.closePath();
    context.fill();
}

/** A figure's shadow, soft at its edges, standing and looking out: black on clear. */

export function shadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    // Drawn off the canvas, so that only its blurred shadow falls on it: soft in every browser.
    context.shadowColor = '#000000';
    context.shadowBlur = 12;
    context.shadowOffsetX = 1000;
    context.translate(-1000, 0);
    context.fillStyle = '#000000';
    if (trialOn('wraith')) {
        banshee(context);
        return new CanvasTexture(canvas);
    }
    context.beginPath();
    context.ellipse(128, 74, 25, 31, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(117, 100);
    context.lineTo(139, 100);
    context.lineTo(141, 118);
    context.quadraticCurveTo(176, 124, 184, 150);
    context.lineTo(192, 292);
    context.lineTo(179, 296);
    context.lineTo(174, 214);
    context.quadraticCurveTo(182, 360, 198, 492);
    context.lineTo(58, 492);
    context.quadraticCurveTo(74, 360, 82, 214);
    context.lineTo(77, 296);
    context.lineTo(64, 292);
    context.lineTo(72, 150);
    context.quadraticCurveTo(80, 124, 115, 118);
    context.closePath();
    context.fill();
    return new CanvasTexture(canvas);
}

// =============================================================================
// The console
// =============================================================================

/**
 * A few lines in the console, in the site's own words only: the city's names
 * as Elm gave them, then one of its passages, exactly, with where it's from.
 * @param {object[]} fragments - approved passages (text, work, source, read_on)
 * @param {Record<string, string>} works - work titles by key
 */
export function speak(fragments, works) {
    const heading = 'font-family: Cormorant, Georgia, serif; font-size: 20px; color: #d89840; letter-spacing: 0.08em;';
    const soft = 'font-family: Cormorant, Georgia, serif; font-size: 14px; color: #a8a8b2;';
    const words = 'font-family: "EB Garamond", Georgia, serif; font-size: 14px; color: #e8e8ec; line-height: 1.6;';
    console.log('%cElysicester%c · Êlyscaíniy · Capital of the Afterlife', heading, soft);
    const passage = fragments[Math.floor(Math.random() * fragments.length)];
    if (!passage) return;
    console.log(`%c${passage.text}`, words);
    console.log(`%c${works[passage.work] ?? ''}, ${passage.source}`, soft);
}
