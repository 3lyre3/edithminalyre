/**
 * hollows-map.js — the map of what stands where, that the city's hollows are
 * read from (hollows.js).
 *
 * No three.js here, so a worker can lay the map off the main thread, while
 * the flight into the city plays. Seen from above, every solid piece that
 * rises from the ground is laid on a fine grid as how tall it stands; the map
 * then keeps, per texel and at four heights, how much stands taller than each,
 * softened, so a surface can look a little way out from itself and see how
 * hemmed in it is.
 */

// =============================================================================
// Imports
// =============================================================================

import { groundY } from './shape.js';

// =============================================================================
// Constants
// =============================================================================

/** The ground the map covers (the island, the wall and the waterfront), in world units. */
export const HOLLOW_REGION = { x0: -34, x1: 22, z0: -34, z1: 34 };
/** The pieces are laid on cells this fine; the map keeps one texel for each two by two of them. */
const CELL = 0.2;
export const HOLLOW_TEXEL = 0.4;
/** The map's size, in texels. */
export const HOLLOW_ACROSS = Math.round((HOLLOW_REGION.x1 - HOLLOW_REGION.x0) / HOLLOW_TEXEL);
export const HOLLOW_DOWN = Math.round((HOLLOW_REGION.z1 - HOLLOW_REGION.z0) / HOLLOW_TEXEL);
/** The ground's height is sampled this far apart and read between (it rises and falls slowly). */
const GROUND_STEP = 0.8;
/** The heights above the ground the map is kept at: each channel is how much stands taller than one. */
export const HOLLOW_HEIGHTS = [0.5, 2, 4, 7];
/** Past this height a column is simply tall: faces wholly above it (world y, with the ground's rise) aren't laid. */
const TALL = 8;
const OVERHEAD = TALL + 1.6;
/** A piece rises from the ground at a cell if its lowest face there is this near the ground (or below it). */
const FOOTING = 0.35;
/** A face whose normal points up (or down) less than this is a wall, seen edge-on from above: it covers no ground. */
const FLAT_ENOUGH = 0.15;
/** The most faces a cell keeps (a two-storey house with its slabs, cornice, roof and chimney fits within it). */
const FACES_PER_CELL = 16;
/** Faces this close in height meet: a solid ending here and another beginning are one column. */
const JOIN = 0.03;
/** How far the softening reaches, in texels, in each of its two passes (together, about 1.6 units). */
const REACH = 2;

// =============================================================================
// The ground under the grid
// =============================================================================

/** The ground's height under every cell's centre, sampled coarsely and read between. */
function groundUnder(width, depth) {
    const across = Math.ceil((width * CELL) / GROUND_STEP) + 2;
    const down = Math.ceil((depth * CELL) / GROUND_STEP) + 2;
    const samples = new Float32Array(across * down);
    for (let j = 0; j < down; j += 1) {
        for (let i = 0; i < across; i += 1) {
            samples[j * across + i] = groundY(HOLLOW_REGION.x0 + i * GROUND_STEP, HOLLOW_REGION.z0 + j * GROUND_STEP);
        }
    }
    const ground = new Float32Array(width * depth);
    const per = GROUND_STEP / CELL;
    for (let row = 0; row < depth; row += 1) {
        const v = (row + 0.5) / per;
        const j = Math.floor(v);
        const fv = v - j;
        for (let col = 0; col < width; col += 1) {
            const u = (col + 0.5) / per;
            const i = Math.floor(u);
            const fu = u - i;
            const at = j * across + i;
            const near = samples[at] + (samples[at + 1] - samples[at]) * fu;
            const far = samples[at + across] + (samples[at + across + 1] - samples[at + across]) * fu;
            ground[row * width + col] = near + (far - near) * fv;
        }
    }
    return ground;
}

// =============================================================================
// How tall things stand
// =============================================================================

/**
 * How tall whatever rises from the ground stands, cell by cell. Every face
 * that isn't a wall is laid over the cells whose centres it covers, as a
 * height and a way it faces: a face turned down is where, going up, a solid
 * begins; a face turned up, where one ends. Each cell's faces are then walked
 * upward from the ground: if a solid begins there, the column stands as high
 * as the solids go without a gap of air (boxes stacked on boxes count as one;
 * a floor, then air, then a tree's crown, counts only as the floor). A bridge
 * or a gangway overhead begins high, and leaves the ground under it open.
 */
function standingHeights(triangles, upwards, width, depth) {
    const count = width * depth;
    const ground = groundUnder(width, depth);
    // Each cell keeps up to FACES_PER_CELL faces: a height, and +1 (a solid begins) or -1 (it ends).
    const heights = new Float32Array(count * FACES_PER_CELL);
    const turns = new Int8Array(count * FACES_PER_CELL);
    const filled = new Uint8Array(count);
    const { x0, z0 } = HOLLOW_REGION;
    let dropped = 0;
    for (let t = 0; t < upwards.length; t += 1) {
        const upward = upwards[t];
        if (upward < FLAT_ENOUGH && upward > -FLAT_ENOUGH) continue;
        const i = t * 9;
        const ay = triangles[i + 1];
        const by = triangles[i + 4];
        const cy = triangles[i + 7];
        if (ay > OVERHEAD && by > OVERHEAD && cy > OVERHEAD) continue;
        const ax = triangles[i];
        const az = triangles[i + 2];
        const bx = triangles[i + 3];
        const bz = triangles[i + 5];
        const cx = triangles[i + 6];
        const cz = triangles[i + 8];
        const colFrom = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - x0) / CELL - 0.5));
        const colTo = Math.min(width - 1, Math.floor((Math.max(ax, bx, cx) - x0) / CELL - 0.5));
        if (colFrom > colTo) continue;
        const rowFrom = Math.max(0, Math.ceil((Math.min(az, bz, cz) - z0) / CELL - 0.5));
        const rowTo = Math.min(depth - 1, Math.floor((Math.max(az, bz, cz) - z0) / CELL - 0.5));
        if (rowFrom > rowTo) continue;
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (det > -1e-12 && det < 1e-12) continue;
        const inverse = 1 / det;
        const turn = upward < 0 ? 1 : -1;
        for (let row = rowFrom; row <= rowTo; row += 1) {
            const dz = z0 + (row + 0.5) * CELL - cz;
            for (let col = colFrom; col <= colTo; col += 1) {
                const dx = x0 + (col + 0.5) * CELL - cx;
                const wa = ((bz - cz) * dx + (cx - bx) * dz) * inverse;
                if (wa < 0) continue;
                const wb = ((cz - az) * dx + (ax - cx) * dz) * inverse;
                if (wb < 0 || wa + wb > 1) continue;
                const cell = row * width + col;
                if (filled[cell] === FACES_PER_CELL) {
                    dropped += 1;
                    continue;
                }
                const slot = cell * FACES_PER_CELL + filled[cell];
                heights[slot] = wa * ay + wb * by + (1 - wa - wb) * cy - ground[cell];
                turns[slot] = turn;
                filled[cell] += 1;
            }
        }
    }

    const standing = new Float32Array(count);
    const order = new Int32Array(FACES_PER_CELL);
    let fullest = 0;
    for (let cell = 0; cell < count; cell += 1) {
        const faces = filled[cell];
        if (faces === 0) continue;
        if (faces > fullest) fullest = faces;
        const base = cell * FACES_PER_CELL;
        // Up the column in order (where two faces meet, the one beginning a solid first, so stacked boxes join).
        for (let k = 0; k < faces; k += 1) {
            let at = k;
            while (at > 0) {
                const previous = order[at - 1];
                const dh = heights[base + previous] - heights[base + k];
                if (dh < -JOIN || (dh <= JOIN && turns[base + previous] >= turns[base + k])) break;
                order[at] = previous;
                at -= 1;
            }
            order[at] = k;
        }
        if (turns[base + order[0]] !== 1 || heights[base + order[0]] > FOOTING) continue;
        let inside = 0;
        let top = 0;
        for (let k = 0; k < faces; k += 1) {
            const face = base + order[k];
            if (inside === 0 && k > 0 && heights[face] > top + JOIN) break;
            inside = Math.max(0, inside + turns[face]);
            top = heights[face];
        }
        // Still inside when the faces run out: it rises past the faces laid (TALL), so it's tall.
        standing[cell] = inside > 0 ? Math.max(top, TALL) : Math.max(0, top);
    }
    return { standing, dropped, fullest };
}

// =============================================================================
// The map
// =============================================================================

/** Soften a layer in place: a box blur across, then down (done twice over, a gentle tent). */
function soften(values, width, depth, scratch) {
    const span = REACH * 2 + 1;
    const lastCol = width - 1;
    for (let row = 0; row < depth; row += 1) {
        const base = row * width;
        let sum = 0;
        for (let k = -REACH; k <= REACH; k += 1) sum += values[base + (k < 0 ? 0 : k > lastCol ? lastCol : k)];
        for (let col = 0; col < width; col += 1) {
            scratch[base + col] = sum / span;
            const next = col + REACH + 1;
            const gone = col - REACH;
            sum += values[base + (next > lastCol ? lastCol : next)] - values[base + (gone < 0 ? 0 : gone)];
        }
    }
    const lastRow = depth - 1;
    for (let col = 0; col < width; col += 1) {
        let sum = 0;
        for (let k = -REACH; k <= REACH; k += 1) sum += scratch[(k < 0 ? 0 : k > lastRow ? lastRow : k) * width + col];
        for (let row = 0; row < depth; row += 1) {
            values[row * width + col] = sum / span;
            const next = row + REACH + 1;
            const gone = row - REACH;
            sum += scratch[(next > lastRow ? lastRow : next) * width + col] - scratch[(gone < 0 ? 0 : gone) * width + col];
        }
    }
}

/**
 * Lay the map.
 * @param {object} input
 * @param {Float32Array} input.triangles - the standing pieces' triangles, world positions, nine numbers each
 * @param {Float32Array} input.upwards - each triangle's normal's upward part (the mean of its vertices')
 * @returns {{ data: Uint8Array, ms: number, dropped: number, fullest: number }} data: RGBA, HOLLOW_ACROSS × HOLLOW_DOWN
 */
export function buildHollowData({ triangles, upwards }) {
    const started = performance.now();
    const per = Math.round(HOLLOW_TEXEL / CELL);
    const width = HOLLOW_ACROSS * per;
    const depth = HOLLOW_DOWN * per;
    const { standing, dropped, fullest } = standingHeights(triangles, upwards, width, depth);

    // Each texel holds, per height, how much of its two by two cells stands taller than that height.
    const texels = HOLLOW_ACROSS * HOLLOW_DOWN;
    const layers = HOLLOW_HEIGHTS.map(() => new Float32Array(texels));
    const share = 1 / (per * per);
    for (let row = 0; row < depth; row += 1) {
        const texelRow = Math.floor(row / per) * HOLLOW_ACROSS;
        for (let col = 0; col < width; col += 1) {
            const height = standing[row * width + col];
            if (height <= HOLLOW_HEIGHTS[0]) continue;
            const texel = texelRow + Math.floor(col / per);
            for (let k = 0; k < HOLLOW_HEIGHTS.length && height > HOLLOW_HEIGHTS[k]; k += 1) layers[k][texel] += share;
        }
    }
    const data = new Uint8Array(texels * 4);
    const scratch = new Float32Array(texels);
    for (let channel = 0; channel < layers.length; channel += 1) {
        const layer = layers[channel];
        soften(layer, HOLLOW_ACROSS, HOLLOW_DOWN, scratch);
        soften(layer, HOLLOW_ACROSS, HOLLOW_DOWN, scratch);
        for (let texel = 0; texel < texels; texel += 1) data[texel * 4 + channel] = Math.round(Math.min(1, layer[texel]) * 255);
    }
    return { data, ms: performance.now() - started, dropped, fullest };
}
