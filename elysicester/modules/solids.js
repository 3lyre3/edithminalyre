/**
 * solids.js — what the camera may not pass through.
 *
 * The camera may go anywhere the air is, but never into the island's rock,
 * the hanging mountain, a spire or a house. Everything solid in the city
 * (every piece but the passable threads, the flags and the lights) goes to a
 * worker as triangles and comes back as a signed distance field
 * (solids-field.js, which adds the sea's surface and the island's certain
 * rock). Here the field is read: a point that strays too close to a surface
 * is pushed back out along it, and a move is taken in short steps, so the
 * camera slides along whatever it meets instead of stopping dead, or
 * tunnelling through.
 *
 * Until the worker answers (or where a browser can't run one), nothing is
 * constrained, and the camera orbits as it always did.
 */

// =============================================================================
// Imports
// =============================================================================

import { Matrix4, Vector3 } from 'three';
import { FIELD_SCALE } from './solids-field.js';

// =============================================================================
// Constants
// =============================================================================

/** The meshes the camera keeps out of: all but the sky, the sea's shader, the flags and the lights. */
const SOLID_MESHES = new Set(['gold', 'bricking', 'dimGold', 'brick', 'stone', 'rock', 'steel', 'glass', 'arch', 'copper', 'signs', 'cloth', 'green']);
/** Pieces standing on their own: the foyer-rock (it bobs a little, well within the camera's clearance). */
const SOLID_GROUPS = new Set(['foyer-rock']);
/** Beyond the grid, everything is air this far from anything. */
const FAR = 1000;
const IDENTITY = new Matrix4();
const UP = new Vector3(0, 1, 0);

// =============================================================================
// What goes to the worker
// =============================================================================

/** Every solid triangle in the scene, as world positions: nine numbers each. */
function solidTriangles(scene) {
    const chunks = [];
    let total = 0;
    const vertex = new Vector3();
    const sources = [];
    for (const child of scene.children) {
        if (child.isMesh && SOLID_MESHES.has(child.name)) sources.push(child);
        else if (SOLID_GROUPS.has(child.name)) child.traverse((node) => node.isMesh && sources.push(node));
    }
    for (const mesh of sources) {
        mesh.updateWorldMatrix(true, false);
        const position = mesh.geometry.attributes.position;
        const index = mesh.geometry.index;
        const ranges = mesh.userData.solidRanges ?? [[0, index ? index.count : position.count]];
        // The merged buckets sit at the origin as flat triangle lists: their numbers copy straight across.
        const straight = !index && mesh.matrixWorld.equals(IDENTITY) && position.itemSize === 3 && !position.isInterleavedBufferAttribute;
        for (const [first, count] of ranges) {
            let chunk;
            if (straight) {
                chunk = position.array.subarray(first * 3, (first + count) * 3);
            } else {
                chunk = new Float32Array(count * 3);
                for (let k = 0; k < count; k += 1) {
                    vertex.fromBufferAttribute(position, index ? index.getX(first + k) : first + k).applyMatrix4(mesh.matrixWorld);
                    chunk[k * 3] = vertex.x;
                    chunk[k * 3 + 1] = vertex.y;
                    chunk[k * 3 + 2] = vertex.z;
                }
            }
            chunks.push(chunk);
            total += chunk.length;
        }
    }
    const triangles = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        triangles.set(chunk, offset);
        offset += chunk.length;
    }
    return triangles;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {import('three').Scene} scene - built, with every solid mesh in it
 * @returns {object} solids: ready (a promise of true or false), available, distance, push, sweep
 */
export function createSolids(scene) {
    let field = null;
    let dims = [0, 0, 0];
    let origin = [0, 0, 0];
    let voxel = 1;
    let strideZ = 0;
    let strideY = 0;
    const gradient = new Vector3();
    const toward = new Vector3();
    const before = new Vector3();
    const side = new Vector3();

    /** Signed distance to the nearest surface, in world units (negative inside). */
    function distance(x, y, z) {
        if (!field) return FAR;
        const gx = (x - origin[0]) / voxel - 0.5;
        const gy = (y - origin[1]) / voxel - 0.5;
        const gz = (z - origin[2]) / voxel - 0.5;
        if (!(gx >= 0 && gy >= 0 && gz >= 0 && gx < dims[0] - 1 && gy < dims[1] - 1 && gz < dims[2] - 1)) return FAR;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const z0 = Math.floor(gz);
        const fx = gx - x0;
        const fy = gy - y0;
        const fz = gz - z0;
        const i = y0 * strideY + z0 * strideZ + x0;
        const c00 = lerp(field[i], field[i + 1], fx);
        const c01 = lerp(field[i + strideZ], field[i + strideZ + 1], fx);
        const c10 = lerp(field[i + strideY], field[i + strideY + 1], fx);
        const c11 = lerp(field[i + strideY + strideZ], field[i + strideY + strideZ + 1], fx);
        return lerp(lerp(c00, c01, fz), lerp(c10, c11, fz), fy) / FIELD_SCALE;
    }

    /** Which way is out, at a point: the field's slope. */
    function slope(point) {
        const h = voxel * 0.5;
        gradient.set(
            distance(point.x + h, point.y, point.z) - distance(point.x - h, point.y, point.z),
            distance(point.x, point.y + h, point.z) - distance(point.x, point.y - h, point.z),
            distance(point.x, point.y, point.z + h) - distance(point.x, point.y, point.z - h),
        );
        if (gradient.lengthSq() < 1e-12) gradient.set(0, 1, 0);
        return gradient.normalize();
    }

    /** Move a point (in place) out to at least `clearance` from every surface; true if it had to move. */
    function push(point, clearance) {
        let moved = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const gap = distance(point.x, point.y, point.z);
            if (gap >= clearance) break;
            point.addScaledVector(slope(point), clearance - gap + 0.004);
            moved = true;
        }
        return moved;
    }

    /**
     * Carry a point from `from` toward `to` in steps short enough that nothing
     * thin is tunnelled through, pushing it clear after each: it ends at `to`
     * if the way is open, or slid along whatever stood in the way. Met head-on
     * (a step that gets nowhere), it slips sideways across the surface, so a
     * pole or a spire is gone round rather than stopped at. Writes `out`.
     */
    function sweep(from, to, clearance, out) {
        const stride = clearance * 0.4;
        out.copy(from);
        push(out, clearance);
        let slips = 0;
        for (let step = 0; step < 72; step += 1) {
            toward.subVectors(to, out);
            const length = toward.length();
            if (length < 1e-5) break;
            before.copy(out);
            out.addScaledVector(toward, Math.min(1, stride / length));
            push(out, clearance);
            if (out.distanceToSquared(before) > (stride * 0.1) ** 2) continue;
            // Head-on: step across the surface (round it, level, where it stands upright).
            if (slips >= 12) break;
            slips += 1;
            const normal = slope(out);
            side.crossVectors(UP, normal);
            if (side.lengthSq() < 1e-6) side.crossVectors(normal, toward);
            if (side.lengthSq() < 1e-6) break;
            side.normalize();
            if (side.dot(toward) < 0) side.negate();
            out.addScaledVector(side, stride);
            push(out, clearance);
        }
        return out;
    }

    const solids = {
        available: false,
        ready: null,
        build: null,
        distance: (point) => distance(point.x, point.y, point.z),
        push,
        sweep,
    };

    solids.ready = new Promise((resolve) => {
        let worker;
        try {
            worker = new Worker(new URL('./solids-worker.js', import.meta.url), { type: 'module' });
        } catch {
            resolve(false);
            return;
        }
        const started = performance.now();
        const triangles = solidTriangles(scene);
        const prepared = performance.now() - started;
        worker.addEventListener('message', (event) => {
            ({ field, dims, origin, voxel } = event.data);
            strideZ = dims[0];
            strideY = dims[0] * dims[2];
            solids.available = true;
            solids.build = { ms: event.data.ms, mainThreadMs: prepared, total: performance.now() - started, counts: event.data.counts, voxel, dims };
            worker.terminate();
            resolve(true);
        });
        for (const type of ['error', 'messageerror']) {
            worker.addEventListener(type, () => {
                worker.terminate();
                resolve(false);
            });
        }
        worker.postMessage({ triangles }, [triangles.buffer]);
    });
    return solids;
}
