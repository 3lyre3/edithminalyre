/**
 * rays.js — quick, exact lines of sight through the city.
 *
 * three.js tests a ray against every triangle of a mesh, and the city is
 * merged into a dozen meshes, so every ray it casts meets the whole city.
 * Here the triangles are sorted once into columns of a coarse grid (laid
 * over the ground plan), and a line meets only the triangles standing in the
 * columns it crosses. The sorting is itself a generator, so it can be done in
 * idle moments a few milliseconds at a time.
 */

// =============================================================================
// Imports
// =============================================================================

import { DoubleSide, Matrix4, Vector3 } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** A column's width, in world units. */
const CELL = 3;
const EPSILON = 1e-7;
const IDENTITY = new Matrix4();

// =============================================================================
// Main Code
// =============================================================================

/**
 * Every triangle of the meshes, as world positions (nine numbers each), and
 * which are seen from both sides: a generator, pausing after each mesh, whose
 * return value is { triangles, twoSided }.
 */
function* worldTriangles(meshes) {
    const out = [];
    const sides = [];
    const vertex = new Vector3();
    for (const mesh of meshes) {
        // As three.js raycasts: a one-sided material is met only from the front.
        sides.push([mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count, mesh.material.side === DoubleSide ? 1 : 0]);
        mesh.updateMatrixWorld();
        const position = mesh.geometry.attributes.position;
        const index = mesh.geometry.index;
        const count = index ? index.count : position.count;
        // The merged buckets sit at the origin as flat triangle lists: their numbers copy straight across.
        if (!index && mesh.matrixWorld.equals(IDENTITY) && position.itemSize === 3 && !position.isInterleavedBufferAttribute) {
            out.push(position.array.subarray(0, count * 3));
        } else {
            const chunk = new Float32Array(count * 3);
            for (let k = 0; k < count; k += 1) {
                vertex.fromBufferAttribute(position, index ? index.getX(k) : k).applyMatrix4(mesh.matrixWorld);
                chunk[k * 3] = vertex.x;
                chunk[k * 3 + 1] = vertex.y;
                chunk[k * 3 + 2] = vertex.z;
            }
            out.push(chunk);
        }
        yield;
    }
    const total = out.reduce((sum, chunk) => sum + chunk.length, 0);
    const triangles = new Float32Array(total);
    const twoSided = new Uint8Array(total / 9);
    let offset = 0;
    let first = 0;
    out.forEach((chunk, index) => {
        triangles.set(chunk, offset);
        offset += chunk.length;
        const [vertices, both] = sides[index];
        twoSided.fill(both, first, first + vertices / 3);
        first += vertices / 3;
    });
    return { triangles, twoSided };
}

/**
 * @param {import('three').Mesh[]} meshes - what a line of sight can be blocked by
 * @returns {{ build: Generator, ready: () => boolean, clear: (from: Vector3, to: Vector3, stopShort?: number) => boolean }}
 */
export function createRayGrid(meshes) {
    let triangles = null;
    let twoSided = null;
    let minX = 0;
    let minZ = 0;
    let columnsX = 0;
    let columnsZ = 0;
    let starts = null;
    let members = null;
    let stamps = null;
    let query = 0;
    let built = false;

    /** Sort the triangles into columns, pausing now and then. */
    function* build() {
        ({ triangles, twoSided } = yield* worldTriangles(meshes));
        const count = triangles.length / 9;
        yield;
        minX = Infinity;
        minZ = Infinity;
        let maxX = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < triangles.length; i += 3) {
            minX = Math.min(minX, triangles[i]);
            maxX = Math.max(maxX, triangles[i]);
            minZ = Math.min(minZ, triangles[i + 2]);
            maxZ = Math.max(maxZ, triangles[i + 2]);
        }
        columnsX = Math.max(1, Math.ceil((maxX - minX) / CELL) + 1);
        columnsZ = Math.max(1, Math.ceil((maxZ - minZ) / CELL) + 1);
        const span = (t) => {
            const x0 = Math.min(triangles[t], triangles[t + 3], triangles[t + 6]);
            const x1 = Math.max(triangles[t], triangles[t + 3], triangles[t + 6]);
            const z0 = Math.min(triangles[t + 2], triangles[t + 5], triangles[t + 8]);
            const z1 = Math.max(triangles[t + 2], triangles[t + 5], triangles[t + 8]);
            return [Math.floor((x0 - minX) / CELL), Math.floor((x1 - minX) / CELL), Math.floor((z0 - minZ) / CELL), Math.floor((z1 - minZ) / CELL)];
        };
        // Count, then fill: each column's triangles sit together in one list.
        const counts = new Int32Array(columnsX * columnsZ + 1);
        for (let triangle = 0; triangle < count; triangle += 1) {
            const [a, b, c, d] = span(triangle * 9);
            for (let z = c; z <= d; z += 1) for (let x = a; x <= b; x += 1) counts[z * columnsX + x] += 1;
            if (triangle % 4000 === 3999) yield;
        }
        starts = new Int32Array(columnsX * columnsZ + 1);
        for (let column = 0; column < columnsX * columnsZ; column += 1) starts[column + 1] = starts[column] + counts[column];
        const fill = starts.slice();
        members = new Int32Array(starts[columnsX * columnsZ]);
        for (let triangle = 0; triangle < count; triangle += 1) {
            const [a, b, c, d] = span(triangle * 9);
            for (let z = c; z <= d; z += 1) {
                for (let x = a; x <= b; x += 1) {
                    members[fill[z * columnsX + x]] = triangle;
                    fill[z * columnsX + x] += 1;
                }
            }
            if (triangle % 4000 === 3999) yield;
        }
        stamps = new Uint32Array(count);
        built = true;
    }

    /**
     * Distance along the ray (origin o, unit direction d) to triangle t, or
     * Infinity (Möller–Trumbore; a one-sided triangle is met only from the front).
     */
    function meet(t, ox, oy, oz, dx, dy, dz) {
        const ax = triangles[t];
        const ay = triangles[t + 1];
        const az = triangles[t + 2];
        const e1x = triangles[t + 3] - ax;
        const e1y = triangles[t + 4] - ay;
        const e1z = triangles[t + 5] - az;
        const e2x = triangles[t + 6] - ax;
        const e2y = triangles[t + 7] - ay;
        const e2z = triangles[t + 8] - az;
        const px = dy * e2z - dz * e2y;
        const py = dz * e2x - dx * e2z;
        const pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        // det > 0: the ray meets the triangle's front (its winding faces the ray).
        if (det < EPSILON && (det > -EPSILON || !twoSided[t / 9])) return Infinity;
        const inverse = 1 / det;
        const sx = ox - ax;
        const sy = oy - ay;
        const sz = oz - az;
        const u = (sx * px + sy * py + sz * pz) * inverse;
        if (u < 0 || u > 1) return Infinity;
        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inverse;
        if (v < 0 || u + v > 1) return Infinity;
        const distance = (e2x * qx + e2y * qy + e2z * qz) * inverse;
        return distance > 0 ? distance : Infinity;
    }

    /** True if nothing lies on the line from `from` to `to`, stopping `stopShort` before `to`. */
    function clear(from, to, stopShort = 0.08) {
        const dx0 = to.x - from.x;
        const dy0 = to.y - from.y;
        const dz0 = to.z - from.z;
        const length = Math.hypot(dx0, dy0, dz0);
        const far = length - stopShort;
        if (far <= 0) return true;
        const dx = dx0 / length;
        const dy = dy0 / length;
        const dz = dz0 / length;
        query = (query + 1) >>> 0;
        if (query === 0) {
            stamps.fill(0);
            query = 1;
        }
        // Walk the columns the line's ground plan crosses (Amanatides and Woo), nearest first.
        let x = Math.floor((from.x - minX) / CELL);
        let z = Math.floor((from.z - minZ) / CELL);
        const endX = Math.floor((from.x + dx * far - minX) / CELL);
        const endZ = Math.floor((from.z + dz * far - minZ) / CELL);
        const stepX = dx > 0 ? 1 : -1;
        const stepZ = dz > 0 ? 1 : -1;
        const flat = Math.hypot(dx, dz);
        const nextX = dx !== 0 ? ((x + (dx > 0 ? 1 : 0)) * CELL + minX - from.x) / dx : Infinity;
        const nextZ = dz !== 0 ? ((z + (dz > 0 ? 1 : 0)) * CELL + minZ - from.z) / dz : Infinity;
        let tMaxX = nextX;
        let tMaxZ = nextZ;
        const tDeltaX = dx !== 0 ? CELL / Math.abs(dx) : Infinity;
        const tDeltaZ = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
        for (let guard = 0; guard < 4096; guard += 1) {
            if (x >= 0 && z >= 0 && x < columnsX && z < columnsZ) {
                const column = z * columnsX + x;
                for (let k = starts[column]; k < starts[column + 1]; k += 1) {
                    const triangle = members[k];
                    if (stamps[triangle] === query) continue;
                    stamps[triangle] = query;
                    if (meet(triangle * 9, from.x, from.y, from.z, dx, dy, dz) < far) return false;
                }
            }
            if ((x === endX && z === endZ) || flat < EPSILON) break;
            if (tMaxX < tMaxZ) {
                if (tMaxX > far) break;
                x += stepX;
                tMaxX += tDeltaX;
            } else {
                if (tMaxZ > far) break;
                z += stepZ;
                tMaxZ += tDeltaZ;
            }
        }
        return true;
    }

    return { build, ready: () => built, clear };
}
