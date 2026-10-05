/**
 * chunks.js — the city drawn only where the camera looks (Elm, 5 Oct, of the ways to faster frames: "all your
 * suggestions seem good", fewer things drawn among them; a trial: ?chunks=off draws every bucket whole, as before).
 *
 * The city's buckets (kit.js) are each one mesh spread across the whole island, so the graphics chip was given every
 * triangle of the city every frame, even with the camera looking down one street. Now each bucket's pieces are laid in
 * squares of the city, neighbouring squares together (kit.js, along a Hilbert curve), and each frame, before the city
 * is drawn, each bucket draws only the run of its squares from the first in the camera's view to the last: walking,
 * about two fifths of the buckets' triangles (three fifths of all a frame drew before), never a draw more than before
 * (a bucket with nothing in view isn't drawn at all). (Drawn in more runs, more is left out, but each run is a draw, and on a phone's processor a draw costs about
 * what the triangles it saves cost its graphics chip: probe-cpu.mjs, probe-r38.mjs, 5 Oct.) Straight after the frame,
 * every bucket is whole again, so nothing else (the rays, the shadows, the hollows, a look from any other camera) ever
 * meets a city with pieces missing; and on a frame that draws the sun's shadows, nothing is left out.
 */

// =============================================================================
// Imports
// =============================================================================

import { Frustum, Matrix4 } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** A bucket with fewer vertices than this is drawn whole (leaving its squares out would save next to nothing). */
const SMALLEST = 6000;
/** The squares' bounds grown by this (metres): what flutters in the wind (kit.js flutter) never passes it. */
const MARGIN = 1;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {Iterable<import('three').Mesh>} meshes - the city's buckets, built in squares (kit.js Buckets, square)
 * @returns {{ cull: (camera: import('three').Camera) => void, whole: () => void, counts: () => object } | null}
 */
export function createChunks(meshes) {
    const entries = [];
    for (const mesh of meshes) {
        const squares = mesh.userData.squares;
        if (!squares || squares.length < 2 || mesh.geometry.attributes.position.count < SMALLEST) continue;
        // (Each square's bounds in the world, as the camera's view is.)
        mesh.updateMatrixWorld(true);
        entries.push({
            mesh,
            squares: squares.map(({ first, count, box }) => ({ first, count, box: box.clone().applyMatrix4(mesh.matrixWorld).expandByScalar(MARGIN) })),
            shown: true,
        });
    }
    if (!entries.length) return null;

    const frustum = new Frustum();
    const seen = new Matrix4();
    let culled = false;
    let drawnSquares = 0;
    let allSquares = 0;
    let drawnVertices = 0;
    let allVertices = 0;

    return {
        /** Before the city is drawn: each bucket draws only the run of its squares from the first in view to the last. */
        cull(camera) {
            camera.updateMatrixWorld();
            seen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(seen);
            drawnSquares = 0;
            allSquares = 0;
            drawnVertices = 0;
            allVertices = 0;
            for (const entry of entries) {
                const { mesh, squares } = entry;
                entry.shown = mesh.visible;
                allSquares += squares.length;
                allVertices += mesh.geometry.attributes.position.count;
                if (!mesh.visible) continue;
                let first = -1;
                let end = -1;
                for (const square of squares) {
                    if (!frustum.intersectsBox(square.box)) continue;
                    drawnSquares += 1;
                    if (first < 0) first = square.first;
                    end = square.first + square.count;
                }
                if (first < 0) {
                    mesh.visible = false;
                    continue;
                }
                mesh.geometry.setDrawRange(first, end - first);
                drawnVertices += end - first;
            }
            culled = true;
        },
        /** Straight after the frame: every bucket whole again. */
        whole() {
            if (!culled) return;
            for (const entry of entries) {
                entry.mesh.geometry.setDrawRange(0, Infinity);
                entry.mesh.visible = entry.shown;
            }
            culled = false;
        },
        /** How much of the city the last frame drew (for ?debug=1 and the checks). */
        counts() {
            return { buckets: entries.length, squares: allSquares, drawnSquares, vertices: allVertices, drawnVertices };
        },
    };
}
