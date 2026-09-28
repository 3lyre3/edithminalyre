/**
 * paper.js — the paper-theatre slot.
 *
 * Elm's own drawings may one day become the city's real look: cut-out layers
 * (PNG with alpha) standing at the places they belong, like the flats of a toy
 * theatre. data/paper.json lists them, each with a place id, an image, a depth
 * offset and a scale. This module stages each one at its place's anchor,
 * turned toward the eye, stepped forward or back by its depth. It ships with
 * no layers; drawings can drop in later with no code changes.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    TextureLoader,
    Vector3,
} from 'three';

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {{ layers: Array<{ place: string, src: string, depth: number, scale: number }> }} data
 * @param {Map<string, Vector3>} anchors - place anchors by id
 */
export async function stagePaper(data, anchors) {
    const group = new Group();
    group.name = 'paper';
    const flats = [];
    const loader = new TextureLoader();

    for (const layer of data?.layers ?? []) {
        const anchor = anchors.get(layer.place);
        if (!anchor) continue;
        const texture = await loader.loadAsync(new URL(`../${layer.src}`, import.meta.url).href);
        texture.colorSpace = SRGBColorSpace;
        const aspect = texture.image.width / texture.image.height;
        const flat = new Mesh(
            new PlaneGeometry(aspect, 1),
            new MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.4, side: DoubleSide }),
        );
        flat.scale.setScalar(layer.scale);
        group.add(flat);
        flats.push({ flat, anchor, depth: layer.depth, lift: layer.scale / 2 });
    }

    const toEye = new Vector3();
    return {
        group,
        /** Turn each flat toward the camera, keeping it upright. */
        update(camera) {
            for (const { flat, anchor, depth, lift } of flats) {
                toEye.subVectors(camera.position, anchor).setY(0).normalize();
                flat.position.copy(anchor).addScaledVector(toEye, depth);
                flat.position.y += lift;
                flat.rotation.set(0, Math.atan2(toEye.x, toEye.z), 0);
            }
        },
    };
}
