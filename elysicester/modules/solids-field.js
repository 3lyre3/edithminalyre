/**
 * solids-field.js — the distance field the camera keeps clear of, made from
 * the city's own triangles.
 *
 * No three.js here, so a worker can run it off the main thread:
 *
 * 1. Every solid triangle is sampled finely, and each voxel it passes through
 *    becomes shell. (The sea's surface joins them: in the scene it's a shader,
 *    but it closes the rock on the water side.)
 * 2. The island's analytic heart (a core that is certainly rock, in case the
 *    shell has a pinhole) is filled in, column by column.
 * 3. The open air floods in from the grid's faces, through everything that
 *    isn't shell. (For the flood, the shell is thickened by a voxel, so no
 *    pinhole lets it in.) Whatever the air can't reach is inside something:
 *    the rock, the mountain, a house, a spire.
 * 4. A two-pass chamfer transform gives every voxel its distance to the other
 *    kind: air to the nearest solid, solid to the nearest air. Together they
 *    make one signed field, positive in the air, negative inside, and zero at
 *    the surface.
 */

// =============================================================================
// Imports
// =============================================================================

import { CLIFF_DEPTH, SEA_LEVEL, UNDERSIDE_DEPTH, groundY, rimRadius, wallX } from './shape.js';

// =============================================================================
// Constants
// =============================================================================

/** Field units per world unit (the field is stored as 16-bit integers). */
export const FIELD_SCALE = 64;

/** Voxels to aim for, and the finest voxel worth having, in world units. */
const TARGET_VOXELS = 1.8e6;
const FINEST = 0.45;
/** Open air kept around everything, so the grid's edges are far from any surface. */
const MARGIN = 4;
/** The sea's surface, a little above the water's mean for the swell's crests. */
const SEA_TOP = SEA_LEVEL + 0.15;

const AIR = 1;
const SHELL = 2;
const BARRIER = 4;
const CORE = 8;
const FAR = 1e6;

// =============================================================================
// The sea, the island's certain rock, and the grid
// =============================================================================

/** The triangles, with the sea's surface (a metre-square mesh inside the rim, east of the wall) added. */
function withSea(triangles) {
    const sea = [];
    for (let x = 7; x < 34; x += 1) {
        for (let z = -34; z < 34; z += 1) {
            const cx = x + 0.5;
            const cz = z + 0.5;
            if (cx < wallX(cz) - 0.5 || Math.hypot(cx, cz) > rimRadius(Math.atan2(cz, cx)) + 0.5) continue;
            sea.push(x, SEA_TOP, z, x + 1, SEA_TOP, z, x + 1, SEA_TOP, z + 1, x, SEA_TOP, z, x + 1, SEA_TOP, z + 1, x, SEA_TOP, z + 1);
        }
    }
    const all = new Float32Array(triangles.length + sea.length);
    all.set(triangles);
    all.set(sea, triangles.length);
    return all;
}

/**
 * The island's certain rock, column by column: well inside the cliff and the
 * underside however island.js's noise falls (the least striation, 0.895, the
 * least taper, 0.85, and the least sag, 0.75, less a margin), and a little
 * under the ground and the sea.
 */
function certainRock(origin, dims, voxel) {
    const [nx, , nz] = dims;
    const core = new Float32Array(nx * nz * 2).fill(Number.NaN);
    for (let z = 0; z < nz; z += 1) {
        for (let x = 0; x < nx; x += 1) {
            const cx = origin[0] + (x + 0.5) * voxel;
            const cz = origin[2] + (z + 0.5) * voxel;
            const radius = Math.hypot(cx, cz);
            if (radius > 34) continue;
            const rim = rimRadius(Math.atan2(cz, cx)) * 0.985 * 0.895;
            if (radius >= rim * 0.95) continue;
            const tapered = rim * 0.85 * 0.95;
            let bottom = -CLIFF_DEPTH;
            if (radius < tapered) {
                const t = 1 - Math.pow(radius / tapered, 1 / 1.35);
                bottom = -(CLIFF_DEPTH + UNDERSIDE_DEPTH * 0.75 * Math.pow(t, 1.1));
            }
            core[(z * nx + x) * 2] = bottom;
            core[(z * nx + x) * 2 + 1] = (cx > wallX(cz) ? SEA_LEVEL : groundY(cx, cz)) - 0.3;
        }
    }
    return core;
}

/** A grid round everything, with open air at its edges, fine enough and no finer than the budget of voxels. */
function gridFor(triangles) {
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < triangles.length; i += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
            const value = triangles[i + axis];
            if (value < low[axis]) low[axis] = value;
            if (value > high[axis]) high[axis] = value;
        }
    }
    const size = high.map((value, axis) => value - low[axis] + MARGIN * 2);
    const voxel = Math.max(FINEST, Math.cbrt((size[0] * size[1] * size[2]) / TARGET_VOXELS));
    return {
        origin: low.map((value) => value - MARGIN),
        dims: size.map((value) => Math.ceil(value / voxel) + 1),
        voxel,
    };
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * Mark the voxels a triangle passes through, sampling it at under half a voxel
 * in each of its two directions.
 */
function markTriangle(flags, t, triangles, grid) {
    const { ox, oy, oz, inverse, nx, ny, nz, strideY, strideZ, step } = grid;
    const ax = triangles[t];
    const ay = triangles[t + 1];
    const az = triangles[t + 2];
    const ux = triangles[t + 3] - ax;
    const uy = triangles[t + 4] - ay;
    const uz = triangles[t + 5] - az;
    const vx = triangles[t + 6] - ax;
    const vy = triangles[t + 7] - ay;
    const vz = triangles[t + 8] - az;
    const along = Math.max(1, Math.ceil(Math.hypot(ux, uy, uz) / step));
    const across = Math.max(1, Math.ceil(Math.hypot(vx, vy, vz) / step));
    const mark = (a, b) => {
        const x = Math.floor((ax + ux * a + vx * b - ox) * inverse);
        const y = Math.floor((ay + uy * a + vy * b - oy) * inverse);
        const z = Math.floor((az + uz * a + vz * b - oz) * inverse);
        if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return;
        flags[y * strideY + z * strideZ + x] |= SHELL;
    };
    for (let i = 0; i <= along; i += 1) {
        const a = i / along;
        const reach = 1 - a;
        const steps = Math.floor(reach * across);
        for (let j = 0; j <= steps; j += 1) mark(a, j / across);
        mark(a, reach);
    }
}

/**
 * @param {object} input
 * @param {Float32Array} input.triangles - the solid triangles' world positions, nine numbers each
 * @returns {{ field: Int16Array, dims: number[], origin: number[], voxel: number, ms: number, counts: object }}
 */
export function buildField({ triangles: solid }) {
    const started = performance.now();
    const triangles = withSea(solid);
    const { origin, dims, voxel } = gridFor(triangles);
    const core = certainRock(origin, dims, voxel);
    const [nx, ny, nz] = dims;
    const [ox, oy, oz] = origin;
    const strideZ = nx;
    const strideY = nx * nz;
    const count = nx * ny * nz;
    const inverse = 1 / voxel;
    const flags = new Uint8Array(count);

    // 1. The shell.
    const grid = { ox, oy, oz, inverse, nx, ny, nz, strideY, strideZ, step: voxel * 0.45 };
    for (let t = 0; t < triangles.length; t += 9) markTriangle(flags, t, triangles, grid);

    // 2. The island's certain rock (a voxel is in when its centre is).
    for (let z = 0; z < nz; z += 1) {
        for (let x = 0; x < nx; x += 1) {
            const column = (z * nx + x) * 2;
            const bottom = core[column];
            const top = core[column + 1];
            if (!(top > bottom)) continue;
            const from = Math.max(0, Math.ceil((bottom - oy) * inverse - 0.5));
            const to = Math.min(ny - 1, Math.floor((top - oy) * inverse - 0.5));
            for (let y = from; y <= to; y += 1) flags[y * strideY + z * strideZ + x] |= CORE;
        }
    }

    // 3. The barrier the flood can't cross: the shell thickened by a voxel, and the core.
    for (let y = 0; y < ny; y += 1) {
        for (let z = 0; z < nz; z += 1) {
            for (let x = 0; x < nx; x += 1) {
                const i = y * strideY + z * strideZ + x;
                if (flags[i] & CORE) flags[i] |= BARRIER;
                if (!(flags[i] & SHELL)) continue;
                flags[i] |= BARRIER;
                if (x > 0) flags[i - 1] |= BARRIER;
                if (x < nx - 1) flags[i + 1] |= BARRIER;
                if (z > 0) flags[i - strideZ] |= BARRIER;
                if (z < nz - 1) flags[i + strideZ] |= BARRIER;
                if (y > 0) flags[i - strideY] |= BARRIER;
                if (y < ny - 1) flags[i + strideY] |= BARRIER;
            }
        }
    }

    // 4. The flood of open air, face to face, in from every side of the grid.
    const queue = new Int32Array(count);
    let head = 0;
    let tail = 0;
    const seed = (i) => {
        if (flags[i] & (BARRIER | AIR)) return;
        flags[i] |= AIR;
        queue[tail] = i;
        tail += 1;
    };
    for (let y = 0; y < ny; y += 1) {
        for (let z = 0; z < nz; z += 1) {
            for (let x = 0; x < nx; x += 1) {
                if (x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1) seed(y * strideY + z * strideZ + x);
            }
        }
    }
    while (head < tail) {
        const i = queue[head];
        head += 1;
        const x = i % nx;
        const z = Math.floor(i / strideZ) % nz;
        const y = Math.floor(i / strideY);
        if (x > 0) seed(i - 1);
        if (x < nx - 1) seed(i + 1);
        if (z > 0) seed(i - strideZ);
        if (z < nz - 1) seed(i + strideZ);
        if (y > 0) seed(i - strideY);
        if (y < ny - 1) seed(i + strideY);
    }

    // 5. The thickening's outer layer is air after all, wherever it touches the flood.
    const outer = [];
    for (let i = 0; i < count; i += 1) {
        if ((flags[i] & (BARRIER | AIR | SHELL | CORE)) !== BARRIER) continue;
        const x = i % nx;
        const z = Math.floor(i / strideZ) % nz;
        const y = Math.floor(i / strideY);
        if ((x > 0 && flags[i - 1] & AIR) || (x < nx - 1 && flags[i + 1] & AIR)
            || (z > 0 && flags[i - strideZ] & AIR) || (z < nz - 1 && flags[i + strideZ] & AIR)
            || (y > 0 && flags[i - strideY] & AIR) || (y < ny - 1 && flags[i + strideY] & AIR)) outer.push(i);
    }
    for (const i of outer) flags[i] |= AIR;

    // 6. Chamfer distances, in voxels, to the nearest voxel of the other kind (the flood's
    //    queue is spent, so its memory holds them). The grid's outermost layer stays far.
    const distance = new Float32Array(queue.buffer);
    for (let i = 0; i < count; i += 1) distance[i] = FAR;
    const forward = [];
    for (let dy = -1; dy <= 0; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                if (dy === 0 && (dz > 0 || (dz === 0 && dx >= 0))) continue;
                forward.push([dy * strideY + dz * strideZ + dx, Math.hypot(dx, dy, dz)]);
            }
        }
    }
    const offsets = Int32Array.from(forward, ([offset]) => offset);
    const weights = Float32Array.from(forward, ([, weight]) => weight);
    const relax = (i) => {
        const kind = flags[i] & AIR;
        let best = distance[i];
        for (let k = 0; k < 13; k += 1) {
            const j = i + offsets[k];
            const candidate = ((flags[j] & AIR) === kind ? distance[j] : 0) + weights[k];
            if (candidate < best) best = candidate;
        }
        distance[i] = best;
    };
    const relaxBack = (i) => {
        const kind = flags[i] & AIR;
        let best = distance[i];
        for (let k = 0; k < 13; k += 1) {
            const j = i - offsets[k];
            const candidate = ((flags[j] & AIR) === kind ? distance[j] : 0) + weights[k];
            if (candidate < best) best = candidate;
        }
        distance[i] = best;
    };
    for (let y = 1; y < ny - 1; y += 1) {
        for (let z = 1; z < nz - 1; z += 1) {
            for (let x = 1; x < nx - 1; x += 1) relax(y * strideY + z * strideZ + x);
        }
    }
    for (let y = ny - 2; y >= 1; y -= 1) {
        for (let z = nz - 2; z >= 1; z -= 1) {
            for (let x = nx - 2; x >= 1; x -= 1) relaxBack(y * strideY + z * strideZ + x);
        }
    }

    // 7. One signed field: the surface lies half a voxel from each side's nearest centre.
    const field = new Int16Array(count);
    let air = 0;
    let shell = 0;
    let coreCount = 0;
    for (let i = 0; i < count; i += 1) {
        const open = flags[i] & AIR;
        if (open) air += 1;
        if (flags[i] & SHELL) shell += 1;
        if (flags[i] & CORE) coreCount += 1;
        const value = (open ? 1 : -1) * (distance[i] - 0.5) * voxel * FIELD_SCALE;
        field[i] = Math.max(-32767, Math.min(32767, Math.round(value)));
    }
    return {
        field,
        dims,
        origin,
        voxel,
        ms: performance.now() - started,
        counts: { voxels: count, air, solid: count - air, shell, core: coreCount, triangles: triangles.length / 9 },
    };
}
