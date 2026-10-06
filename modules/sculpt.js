/**
 * sculpt.js — a figure modelled as clay is (Allison: allison.js).
 *
 * Shapes (balls, egg shapes, limbs tapering from one round end to the other, bands) are melted together where they meet,
 * in layers: the skin, then each garment over it, each its own colour, the layers meeting crisply as cloth meets skin.
 * Their distance field is drawn as one smooth surface (surface nets: a vertex in each small cube the surface passes
 * through, at the mean of where it crosses the cube's edges; a face across each edge it crosses; normals from the field
 * itself). The field is worked out finely only near the surface (found on a coarse grid first), and built a slab at a
 * time with breaths between (kit.js), so the way in never stalls for it.
 */

// =============================================================================
// Imports
// =============================================================================

import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Vector3 } from 'three';
import { breathe, breatheDue } from './kit.js';

// =============================================================================
// Shapes
// =============================================================================

/**
 * Each shape: `at(x, y, z)`, its signed distance (negative inside), and `bound`, a ball it lies wholly within (to pass
 * it by where it's far).
 */

/** A ball. */
export function ball([cx, cy, cz], radius) {
    return {
        bound: { x: cx, y: cy, z: cz, r: radius },
        at: (x, y, z) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) - radius,
    };
}

/** An egg shape (an ellipsoid) of radii [rx, ry, rz], turned by [rx, ry, rz] radians (YXZ), about its centre. */
export function egg([cx, cy, cz], [ax, ay, az], turn = [0, 0, 0]) {
    const inverse = new Matrix4().makeRotationFromEuler(new Euler(turn[0], turn[1], turn[2], 'YXZ')).invert().elements;
    return {
        bound: { x: cx, y: cy, z: cz, r: Math.max(ax, ay, az) },
        at: (x, y, z) => {
            const px = x - cx;
            const py = y - cy;
            const pz = z - cz;
            const lx = inverse[0] * px + inverse[4] * py + inverse[8] * pz;
            const ly = inverse[1] * px + inverse[5] * py + inverse[9] * pz;
            const lz = inverse[2] * px + inverse[6] * py + inverse[10] * pz;
            // (Inigo Quilez's bound for an ellipsoid's distance: exact enough near its surface.)
            const k0 = Math.sqrt((lx / ax) ** 2 + (ly / ay) ** 2 + (lz / az) ** 2);
            const k1 = Math.sqrt((lx / (ax * ax)) ** 2 + (ly / (ay * ay)) ** 2 + (lz / (az * az)) ** 2);
            return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(ax, ay, az);
        },
    };
}

/** A limb: rounded at each end, from `a` (radius ra) to `b` (radius rb), tapering between (a round cone). */
export function limb(a, b, ra, rb = ra) {
    const [ax, ay, az] = a;
    const bax = b[0] - ax;
    const bay = b[1] - ay;
    const baz = b[2] - az;
    const l2 = bax * bax + bay * bay + baz * baz;
    const rr = ra - rb;
    const a2 = l2 - rr * rr;
    const il2 = 1 / l2;
    const length = Math.sqrt(l2);
    return {
        bound: { x: ax + bax / 2, y: ay + bay / 2, z: az + baz / 2, r: length / 2 + Math.max(ra, rb) },
        // (Inigo Quilez's round cone, between two points.)
        at: (x, y, z) => {
            const pax = x - ax;
            const pay = y - ay;
            const paz = z - az;
            const t = pax * bax + pay * bay + paz * baz;
            const w = t - l2;
            const qx = pax * l2 - bax * t;
            const qy = pay * l2 - bay * t;
            const qz = paz * l2 - baz * t;
            const x2 = qx * qx + qy * qy + qz * qz;
            const y2 = t * t * l2;
            const z2 = w * w * l2;
            const k = Math.sign(rr) * rr * rr * x2;
            if (Math.sign(w) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
            if (Math.sign(t) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
            return (Math.sqrt(x2 * a2 * il2) + t * rr) * il2 - ra;
        },
    };
}

/** A band round an axis (a torus: a rolled cuff, a collar): its middle, the way its axis runs, its radius, its thickness. */
export function band([cx, cy, cz], axis, radius, thickness) {
    const n = new Vector3(...axis).normalize();
    return {
        bound: { x: cx, y: cy, z: cz, r: radius + thickness },
        at: (x, y, z) => {
            const px = x - cx;
            const py = y - cy;
            const pz = z - cz;
            const along = px * n.x + py * n.y + pz * n.z;
            const rx = px - n.x * along;
            const ry = py - n.y * along;
            const rz = pz - n.z * along;
            const ring = Math.sqrt(rx * rx + ry * ry + rz * rz) - radius;
            return Math.sqrt(ring * ring + along * along) - thickness;
        },
    };
}

/** A shape cut by a test (keep(x, y, z) false: outside, by its distance to the cut's own edge, given as `edge`). */
export function cut(shape, edge) {
    return {
        bound: shape.bound,
        at: (x, y, z) => Math.max(shape.at(x, y, z), edge(x, y, z)),
    };
}

// =============================================================================
// The field
// =============================================================================

/** Melt two distances together over `k` (a polynomial smooth minimum: Inigo Quilez's). */
function melt(a, b, k) {
    if (k <= 0) return Math.min(a, b);
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * @typedef {object} Layer
 * @property {object[]} shapes - melted together
 * @property {number} melt - over how far they melt into one another
 * @property {import('three').ColorRepresentation | ((x: number, y: number, z: number) => import('three').Color)} colour
 * @property {boolean} [skin] - his skin (its colour moves with his mood: allison.js)
 */

/**
 * The figure's distance at a point: its layers, each melted from its shapes, met crisply; and which layer the point is
 * nearest (its colour). Shapes further than `band` past their bounds are passed by (they can't touch the surface here).
 */
function field(layers, band, seam = 0) {
    return (x, y, z, which = null) => {
        let best = band;
        let bestLayer = -1;
        // (The layers meet crisply, but for `seam`: a hair's melt where they meet, so the crease where cloth meets cloth
        // or skin is drawn smooth, not stepped by the cubes; each point still takes the colour of the layer nearest.)
        let joined = band;
        for (let index = 0; index < layers.length; index += 1) {
            const layer = layers[index];
            let d = band;
            let any = false;
            for (const shape of layer.shapes) {
                const b = shape.bound;
                const dx = x - b.x;
                const dy = y - b.y;
                const dz = z - b.z;
                const reach = b.r + band;
                if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
                const here = shape.at(x, y, z);
                d = any ? melt(d, here, layer.melt) : here;
                any = true;
            }
            if (!any) continue;
            joined = bestLayer < 0 ? d : melt(joined, d, seam);
            if (d < best) {
                best = d;
                bestLayer = layer.index ?? index;
            }
        }
        if (which) which.layer = bestLayer;
        return bestLayer < 0 ? band : joined;
    };
}

/**
 * A figure's distance at any point, for laying things on it (Allison's curls drape over his shoulders): its layers met
 * as sculpt() meets them.
 */
export function distanceOf(layers, band = 0.1) {
    return field(layers, band);
}

/** The layers as they stand about a block (a ball round its middle, of `radius`): only the shapes that could reach it. */
function localLayers(layers, [cx, cy, cz], radius, band) {
    return layers.map((layer, index) => ({
        ...layer,
        index,
        shapes: layer.shapes.filter((shape) => {
            const b = shape.bound;
            const reach = b.r + band + radius;
            return (cx - b.x) ** 2 + (cy - b.y) ** 2 + (cz - b.z) ** 2 <= reach * reach;
        }),
    })).filter((layer) => layer.shapes.length);
}

// =============================================================================
// The surface
// =============================================================================

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/**
 * Sculpt a figure: its layers' surface, in cubes of `cell` within `from`..`to`, as a geometry with positions, normals
 * and colours, and, from `extra` (name => (x, y, z, layer) => number), more attributes of its own.
 * @param {object} options
 * @param {Layer[]} options.layers
 * @param {[number, number, number]} options.from
 * @param {[number, number, number]} options.to
 * @param {number} options.cell
 * @param {Record<string, (x: number, y: number, z: number, layer: Layer) => number>} [options.extra]
 */
/** How long the last sculpting's stages took (ms), for the local checks. */
export const sculptTimes = {};

export async function sculpt({ layers, from, to, cell, extra = {}, seam = cell * 0.5 }) {
    let mark = performance.now();
    const lap = (name) => { const now = performance.now(); sculptTimes[name] = Math.round(now - mark); mark = now; };
    const coarse = 4;
    const band = cell * coarse * 1.8;
    const distance = field(layers, band, seam);
    const n = [0, 1, 2].map((axis) => Math.ceil((to[axis] - from[axis]) / cell / coarse) * coarse + 1);
    const [nx, ny, nz] = n;
    const at = (i, j, k) => i + nx * (j + ny * k);
    const values = new Float32Array(nx * ny * nz);
    const px = (i) => from[0] + i * cell;
    const py = (j) => from[1] + j * cell;
    const pz = (k) => from[2] + k * cell;

    // A look at each block's middle first: a block of coarse³ cubes the surface could pass through (its middle within
    // half its diagonal of it, and a little more) is worked out finely, asking only the shapes that could reach it; the
    // rest take its middle's side, inside or out. (Worked-out values always win where blocks share a face.)
    const blocks = [(nx - 1) / coarse, (ny - 1) / coarse, (nz - 1) / coarse];
    const halfDiagonal = (cell * coarse * Math.sqrt(3)) / 2;
    const localFields = new Map();
    const active = [];
    const blockIndex = (bi, bj, bk) => bi + blocks[0] * (bj + blocks[1] * bk);
    const blockOf = (i, j, k) => blockIndex(Math.min(blocks[0] - 1, Math.floor(i / coarse)), Math.min(blocks[1] - 1, Math.floor(j / coarse)), Math.min(blocks[2] - 1, Math.floor(k / coarse)));
    const sideOf = new Int8Array(blocks[0] * blocks[1] * blocks[2]);
    for (let bk = 0; bk < blocks[2]; bk += 1) {
        for (let bj = 0; bj < blocks[1]; bj += 1) {
            for (let bi = 0; bi < blocks[0]; bi += 1) {
                const middle = [px((bi + 0.5) * coarse), py((bj + 0.5) * coarse), pz((bk + 0.5) * coarse)];
                const v = distance(...middle);
                const index = blockIndex(bi, bj, bk);
                sideOf[index] = v < 0 ? -1 : 1;
                if (Math.abs(v) < halfDiagonal * 1.3) {
                    active.push([bi, bj, bk]);
                    localFields.set(index, field(localLayers(layers, middle, halfDiagonal + cell, band), band, seam));
                }
            }
            // (Breathing by the clock, not by the count: kit.js breathe. A count, on a phone, ran a tenth of a second.)
            if (breatheDue()) await breathe();
        }
    }
    lap('coarse');
    values.fill(NaN);
    const working = (bi, bj, bk) => {
        const local = localFields.get(blockIndex(bi, bj, bk));
        for (let k = bk * coarse; k <= (bk + 1) * coarse; k += 1) {
            for (let j = bj * coarse; j <= (bj + 1) * coarse; j += 1) {
                for (let i = bi * coarse; i <= (bi + 1) * coarse; i += 1) {
                    const index = at(i, j, k);
                    if (Number.isNaN(values[index])) values[index] = local(px(i), py(j), pz(k));
                }
            }
        }
    };
    // (Then the surface is followed: a quiet block whose shared face, worked out from its neighbour, lies on the
    // other side from its own middle in any corner has the surface crossing into it, and is worked out too; and so on,
    // until no more are found. The distance a block's middle is judged by is only an estimate: without this, where it
    // runs high, the surface would end at the block's face, a hole the ink draws as a speck.)
    const isActive = new Uint8Array(blocks[0] * blocks[1] * blocks[2]);
    for (const [bi, bj, bk] of active) isActive[blockIndex(bi, bj, bk)] = 1;
    const queue = [...active];
    const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    let worked = 0;
    while (queue.length) {
        const [bi, bj, bk] = queue.shift();
        working(bi, bj, bk);
        worked += 1;
        for (const [di, dj, dk] of NEIGHBOURS) {
            const ni = bi + di;
            const nj = bj + dj;
            const nk = bk + dk;
            if (ni < 0 || nj < 0 || nk < 0 || ni >= blocks[0] || nj >= blocks[1] || nk >= blocks[2]) continue;
            const neighbour = blockIndex(ni, nj, nk);
            if (isActive[neighbour]) continue;
            // The face they share, worked out now: does any of it lie on the other side from the neighbour's middle?
            const side = sideOf[neighbour];
            let crosses = false;
            const fixed = [di !== 0 ? (di > 0 ? (bi + 1) * coarse : bi * coarse) : -1, dj !== 0 ? (dj > 0 ? (bj + 1) * coarse : bj * coarse) : -1, dk !== 0 ? (dk > 0 ? (bk + 1) * coarse : bk * coarse) : -1];
            for (let u = 0; u <= coarse && !crosses; u += 1) {
                for (let w = 0; w <= coarse && !crosses; w += 1) {
                    const i = fixed[0] >= 0 ? fixed[0] : bi * coarse + u;
                    const j = fixed[1] >= 0 ? fixed[1] : bj * coarse + (fixed[0] >= 0 ? u : w);
                    const k = fixed[2] >= 0 ? fixed[2] : bk * coarse + w;
                    const value = values[at(i, j, k)];
                    if ((value < 0 ? -1 : 1) !== side) crosses = true;
                }
            }
            if (!crosses) continue;
            isActive[neighbour] = 1;
            const middle = [px((ni + 0.5) * coarse), py((nj + 0.5) * coarse), pz((nk + 0.5) * coarse)];
            localFields.set(neighbour, field(localLayers(layers, middle, halfDiagonal + cell, band), band, seam));
            active.push([ni, nj, nk]);
            queue.push([ni, nj, nk]);
        }
        if (breatheDue()) await breathe();
    }
    sculptTimes.followed = active.length;
    // (The quiet blocks: their middle's side, where nothing was worked out.)
    for (let index = 0; index < values.length; index += 1) {
        if (!Number.isNaN(values[index])) continue;
        const i = index % nx;
        const j = Math.floor(index / nx) % ny;
        const k = Math.floor(index / (nx * ny));
        values[index] = sideOf[blockOf(i, j, k)] * band;
    }

    lap('fine');
    // A vertex in each cube the surface passes through (only in the blocks worked out: nowhere else changes side).
    const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
    const positions = [];
    const vertexBlocks = [];
    const vertexCells = [];
    const corner = new Float32Array(8);
    for (const [bi, bj, bk] of active) {
        for (let k = bk * coarse; k < (bk + 1) * coarse && k < nz - 1; k += 1) {
            for (let j = bj * coarse; j < (bj + 1) * coarse && j < ny - 1; j += 1) {
                for (let i = bi * coarse; i < (bi + 1) * coarse && i < nx - 1; i += 1) {
                    let inside = 0;
                    for (let c = 0; c < 8; c += 1) {
                        const offset = CORNERS[c];
                        corner[c] = values[at(i + offset[0], j + offset[1], k + offset[2])];
                        if (corner[c] < 0) inside += 1;
                    }
                    if (inside === 0 || inside === 8) continue;
                    let sx = 0;
                    let sy = 0;
                    let sz = 0;
                    let count = 0;
                    for (const [a, b] of EDGES) {
                        const va = corner[a];
                        const vb = corner[b];
                        if ((va < 0) === (vb < 0)) continue;
                        const t = va / (va - vb);
                        sx += CORNERS[a][0] + (CORNERS[b][0] - CORNERS[a][0]) * t;
                        sy += CORNERS[a][1] + (CORNERS[b][1] - CORNERS[a][1]) * t;
                        sz += CORNERS[a][2] + (CORNERS[b][2] - CORNERS[a][2]) * t;
                        count += 1;
                    }
                    cellVertex[at(i, j, k)] = positions.length / 3;
                    positions.push(px(i + sx / count), py(j + sy / count), pz(k + sz / count));
                    vertexBlocks.push(blockIndex(bi, bj, bk));
                    vertexCells.push(i, j, k);
                }
            }
        }
        if (breatheDue()) await breathe();
    }
    await breathe();

    lap('vertices');
    // A face across each edge the surface crosses, between the four cubes about it, turned to face out. (Such an
    // edge's first corner is in a cube the surface passes through: so only those cubes are asked.)
    const indices = [];
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const vertexOf = (i, j, k) => (i < 0 || j < 0 || k < 0 ? -1 : cellVertex[at(i, j, k)]);
    const quad = [0, 0, 0, 0];
    for (let cellIndex = 0; cellIndex < vertexCells.length; cellIndex += 3) {
        const i = vertexCells[cellIndex];
        const j = vertexCells[cellIndex + 1];
        const k = vertexCells[cellIndex + 2];
        const here = values[at(i, j, k)];
        for (let axis = 0; axis < 3; axis += 1) {
            const [ex, ey, ez] = axes[axis];
            const there = values[at(i + ex, j + ey, k + ez)];
            if ((here < 0) === (there < 0)) continue;
            const [ux, uy, uz] = axes[(axis + 1) % 3];
            const [vx, vy, vz] = axes[(axis + 2) % 3];
            quad[0] = vertexOf(i, j, k);
            quad[1] = vertexOf(i - ux, j - uy, k - uz);
            quad[2] = vertexOf(i - ux - vx, j - uy - vy, k - uz - vz);
            quad[3] = vertexOf(i - vx, j - vy, k - vz);
            if (quad[1] < 0 || quad[2] < 0 || quad[3] < 0) continue;
            // (Out is the way the field rises: along the axis if this corner is inside.)
            const out = here < 0 ? 1 : -1;
            const a = quad[0] * 3;
            const b = quad[1] * 3;
            const c = quad[2] * 3;
            const abx = positions[b] - positions[a];
            const aby = positions[b + 1] - positions[a + 1];
            const abz = positions[b + 2] - positions[a + 2];
            const acx = positions[c] - positions[a];
            const acy = positions[c + 1] - positions[a + 1];
            const acz = positions[c + 2] - positions[a + 2];
            const normalAlong = axis === 0 ? aby * acz - abz * acy : axis === 1 ? abz * acx - abx * acz : abx * acy - aby * acx;
            if (normalAlong * out >= 0) indices.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
            else indices.push(quad[0], quad[2], quad[1], quad[0], quad[3], quad[2]);
        }
        if (cellIndex % 300 === 0 && breatheDue()) await breathe();
    }

    // (Scraps of surface apart from the rest, a few faces where two layers almost touch, are no part of the figure: the
    // ink would outline each as a speck. Every piece of under `scrap` faces that touches nothing else goes.)
    const scrap = 24;
    const parentOf = new Int32Array(positions.length / 3).map((_, i) => i);
    const root = (i) => {
        while (parentOf[i] !== i) {
            parentOf[i] = parentOf[parentOf[i]];
            i = parentOf[i];
        }
        return i;
    };
    for (let f = 0; f < indices.length; f += 3) {
        const a = root(indices[f]);
        const b = root(indices[f + 1]);
        const c = root(indices[f + 2]);
        parentOf[b] = a;
        parentOf[root(c)] = a;
    }
    const facesIn = new Map();
    for (let f = 0; f < indices.length; f += 3) {
        const r = root(indices[f]);
        facesIn.set(r, (facesIn.get(r) ?? 0) + 1);
    }
    let kept = 0;
    for (let f = 0; f < indices.length; f += 3) {
        if (facesIn.get(root(indices[f])) < scrap) continue;
        indices[kept] = indices[f];
        indices[kept + 1] = indices[f + 1];
        indices[kept + 2] = indices[f + 2];
        kept += 3;
    }
    sculptTimes.scraps = (indices.length - kept) / 3;
    indices.length = kept;
    // (For the local checks: the edges only one face has, which a hole in the surface leaves, and where. Only for them,
    // test-sculpt.mjs and ?debug=1: counted on every visit, it cost a phone a long stretch for nothing seen.)
    if (!globalThis.document || new URLSearchParams(globalThis.location?.search ?? '').has('debug')) {
        const edgeUses = new Map();
        for (let f = 0; f < indices.length; f += 3) {
            for (const [a, b] of [[indices[f], indices[f + 1]], [indices[f + 1], indices[f + 2]], [indices[f + 2], indices[f]]]) {
                const key = a < b ? a * 1e7 + b : b * 1e7 + a;
                edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
            }
            if (f % 3000 === 0 && breatheDue()) await breathe();
        }
        const open = [...edgeUses].filter(([, uses]) => uses === 1).map(([key]) => Math.floor(key / 1e7));
        sculptTimes.openEdges = open.length;
        sculptTimes.openAt = open.slice(0, 6).map((v) => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]].map((n) => +n.toFixed(3)));
    }
    // Each face turned to face out by itself (a quad of the surface nets can twist where the surface is thin or tightly
    // curved, and one of its two faces then faces in: culled, it's a hole the ink draws as a speck): its own normal
    // against the field's rise at its middle.
    let turned = 0;
    const ge = cell * 0.5;
    for (let f = 0; f < indices.length; f += 3) {
        const a = indices[f] * 3;
        const b = indices[f + 1] * 3;
        const c = indices[f + 2] * 3;
        const mx = (positions[a] + positions[b] + positions[c]) / 3;
        const my = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
        const mz = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
        const local = localFields.get(vertexBlocks[indices[f]]) ?? distance;
        const gx = local(mx + ge, my, mz) - local(mx - ge, my, mz);
        const gy = local(mx, my + ge, mz) - local(mx, my - ge, mz);
        const gz = local(mx, my, mz + ge) - local(mx, my, mz - ge);
        const abx = positions[b] - positions[a];
        const aby = positions[b + 1] - positions[a + 1];
        const abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a];
        const acy = positions[c + 1] - positions[a + 1];
        const acz = positions[c + 2] - positions[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        if (nx * gx + ny * gy + nz * gz < 0) {
            indices[f + 1] = c / 3;
            indices[f + 2] = b / 3;
            turned += 1;
        }
        if (f % 600 === 0 && breatheDue()) await breathe();
    }
    sculptTimes.turned = turned;

    lap('faces');
    // Normals from the field, colours and the rest from the layer each vertex is on.
    const count = positions.length / 3;
    const normals = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const more = Object.fromEntries(Object.keys(extra).map((name) => [name, new Float32Array(count)]));
    const which = { layer: -1 };
    const e = cell * 0.5;
    for (let v = 0; v < count; v += 1) {
        const x = positions[v * 3];
        const y = positions[v * 3 + 1];
        const z = positions[v * 3 + 2];
        const local = localFields.get(vertexBlocks[v]) ?? distance;
        const gx = local(x + e, y, z) - local(x - e, y, z);
        const gy = local(x, y + e, z) - local(x, y - e, z);
        const gz = local(x, y, z + e) - local(x, y, z - e);
        const length = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        normals[v * 3] = gx / length;
        normals[v * 3 + 1] = gy / length;
        normals[v * 3 + 2] = gz / length;
        local(x, y, z, which);
        const layer = layers[Math.max(0, which.layer)];
        const colour = typeof layer.colour === 'function' ? layer.colour(x, y, z) : (layer.tint ??= new Color(layer.colour));
        colours[v * 3] = colour.r;
        colours[v * 3 + 1] = colour.g;
        colours[v * 3 + 2] = colour.b;
        for (const [name, of] of Object.entries(extra)) more[name][v] = of(x, y, z, layer);
        if (v % 200 === 199 && breatheDue()) await breathe();
    }
    lap('normals');
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    for (const [name, array] of Object.entries(more)) geometry.setAttribute(name, new Float32BufferAttribute(array, 1));
    geometry.setIndex(indices);
    return geometry;
}
