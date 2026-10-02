/**
 * ascii.js — the way in's characters, shared: the Intermaze is drawn in them (threshold.js), and the Mega-Screen's face
 * turns into them as the eye dives into it (megascreen.js), in one grid, so that where the one ends the other begins
 * without a jump (Elm's clip of the dive, 3 Oct: "something sort of like this except sort of tidier").
 *
 * A grid fixed to the screen: at least ROWS of characters down it and COLUMNS across (so a phone held upright still
 * draws a shape finely enough to see), each cell CELL_ASPECT as wide as it's tall. Each cell takes the colour of the
 * picture at its middle, and a character as dense as that colour is bright, from a strip of glyphs measured on the
 * device itself (fonts differ from one to the next) and ranked from sparsest to densest.
 */

// =============================================================================
// Imports
// =============================================================================

import { CanvasTexture, LinearFilter } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** At least this many rows down the screen and columns across it, each cell this wide for its height. */
export const ROWS = 44;
export const COLUMNS = 48;
export const CELL_ASPECT = 0.6;

/** The characters it may be drawn in (measured, then ranked from sparsest to densest), and how many ranks. */
const CHARACTERS = ` .'\`,:;-~_^"=+!<>*icvxzuoaeX#%&@`;
const RANKS = 16;

/** A character's cell in the atlas, in pixels. */
const GLYPH_WIDTH = 40;
const GLYPH_HEIGHT = 64;

/**
 * GLSL: a cell's character, its ink (0 to 1) at a point in the cell, for a brightness (0 to 1), from the glyph strip.
 * (uniforms the caller declares: sampler2D glyphs; float glyphCount.)
 */
export const ASCII_GLSL = /* glsl */ `
    float asciiInk(float bright, vec2 inCell) {
        float rank = min(glyphCount - 1.0, floor(pow(clamp(bright, 0.0, 1.0), 0.8) * glyphCount));
        return texture2D(glyphs, vec2((rank + inCell.x) / glyphCount, inCell.y)).a;
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/** A cell of the grid, in the drawing buffer's pixels, for a buffer of this size (x across, y down). */
export function asciiCell(size, into) {
    const tall = Math.max(12, Math.min(size.y / ROWS, size.x / (COLUMNS * CELL_ASPECT)));
    return into.set(tall * CELL_ASPECT, tall);
}

/**
 * The characters, as a strip of white glyphs on nothing, sparsest first. Each candidate is drawn and its ink measured,
 * then RANKS of them are chosen at even steps of ink, from none to the densest.
 */
export function glyphAtlas() {
    const font = `600 ${Math.round(GLYPH_HEIGHT * 0.78)}px ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace`;
    const draw = (context, character, x) => {
        context.fillText(character, x + GLYPH_WIDTH / 2, GLYPH_HEIGHT / 2 + GLYPH_HEIGHT * 0.04);
    };
    const probe = document.createElement('canvas');
    probe.width = GLYPH_WIDTH;
    probe.height = GLYPH_HEIGHT;
    const measure = probe.getContext('2d', { willReadFrequently: true });
    measure.font = font;
    measure.textAlign = 'center';
    measure.textBaseline = 'middle';
    measure.fillStyle = '#fff';
    const inked = [...new Set(CHARACTERS)].map((character) => {
        measure.clearRect(0, 0, GLYPH_WIDTH, GLYPH_HEIGHT);
        draw(measure, character, 0);
        const alpha = measure.getImageData(0, 0, GLYPH_WIDTH, GLYPH_HEIGHT).data;
        let ink = 0;
        for (let index = 3; index < alpha.length; index += 4) ink += alpha[index];
        return { character, ink };
    }).sort((a, b) => a.ink - b.ink);
    const densest = inked[inked.length - 1].ink || 1;
    const chosen = [];
    for (let rank = 0; rank < RANKS; rank += 1) {
        const want = (densest * rank) / (RANKS - 1);
        const nearest = inked.reduce((best, entry) => (Math.abs(entry.ink - want) < Math.abs(best.ink - want) ? entry : best));
        if (!chosen.includes(nearest.character)) chosen.push(nearest.character);
    }

    const canvas = document.createElement('canvas');
    canvas.width = GLYPH_WIDTH * chosen.length;
    canvas.height = GLYPH_HEIGHT;
    const context = canvas.getContext('2d');
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    chosen.forEach((character, index) => draw(context, character, index * GLYPH_WIDTH));
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { texture, count: chosen.length };
}
