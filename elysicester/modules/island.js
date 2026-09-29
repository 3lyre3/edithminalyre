/**
 * island.js — the floating piece of land Elysicester stands on.
 *
 * The paved top west of the sea-wall, the cliff around the rim, and the rock
 * that hangs beneath it, drawn after the floating islands in Elm's cosmology
 * plate (images/voidal_archipelago.jpg): a curtain of rock falling steeply to
 * a ragged, dripping edge, a broad belly within it, striated top to bottom
 * (the "rock" material draws the striae), and roots trailing down, a few
 * strong and many fine, falling nearly straight.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    Color,
    ConeGeometry,
    Float32BufferAttribute,
    Vector3,
} from 'three';
import {
    CLIFF_DEPTH,
    CURTAIN_EDGE,
    SEA_LEVEL,
    bellyDepth,
    createRandom,
    curtainDrop,
    fbm2,
    groundY,
    noise2,
    paint,
    pose,
    rimRadius,
    taperedTube,
    wallX,
} from './kit.js';

// =============================================================================
// Constants
// =============================================================================

const SEGMENTS = 144;
const GROUND_RINGS = 16;
/** Rings down the curtain (cliff's foot to the ragged edge), and in across the belly (edge to the middle). */
const CURTAIN_RINGS = 7;
const BELLY_RINGS = 7;

const PAVEMENT = new Color(0x9a7440);
const PAVEMENT_DARK = new Color(0x6a5030);
const RIM_STONE = new Color(0x5a4640);
/** The rock's own striae are drawn by its material (kit.js); these only tint them. */
const ROCK_TINT = new Color(0xfff2e6);
const ROCK_TINT_COOL = new Color(0xe6e2f4);
const ROOT = new Color(0x3a2a22);
/** The fine roots, a little paler, as a lighter pencil line. */
const ROOTLET = new Color(0x5a4436);

// =============================================================================
// Surface builder
// =============================================================================

/**
 * Stitch rings of points into triangles. Each triangle is turned to face away
 * from `core` and coloured by `painter`. Its normals are its own (flat), or,
 * if `smooth`, shared at every corner with the triangles round it, so the
 * light falls across the surface in broad soft shapes, as a pencil shades,
 * rather than facet by facet. (A turn's last point is its first; a ring whose
 * points all meet is one point.)
 */
function stitch(rings, core, painter, { smooth = false } = {}) {
    const positions = [];
    const normals = [];
    const colors = [];
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const ab = new Vector3();
    const ac = new Vector3();
    const normal = new Vector3();
    const centroid = new Vector3();
    const color = new Color();
    const shared = new Vector3();

    const meets = rings.map((row) => row.every((point) => point[0] === row[0][0] && point[1] === row[0][1] && point[2] === row[0][2]));
    const cornerOf = (ring, segment) => ring * SEGMENTS + (meets[ring] ? 0 : segment % SEGMENTS);
    const sums = new Float64Array(rings.length * SEGMENTS * 3);
    const faces = [];

    const emit = (p, q, r, corners) => {
        a.fromArray(p);
        b.fromArray(q);
        c.fromArray(r);
        normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
        if (normal.lengthSq() < 1e-10) return;
        centroid.copy(a).add(b).add(c).divideScalar(3);
        if (normal.dot(centroid.clone().sub(core)) < 0) {
            [b.x, b.y, b.z, c.x, c.y, c.z] = [c.x, c.y, c.z, b.x, b.y, b.z];
            [corners[1], corners[2]] = [corners[2], corners[1]];
            normal.negate();
        }
        // Each corner gathers the faces round it, weighted by their size.
        for (const corner of corners) {
            sums[corner * 3] += normal.x;
            sums[corner * 3 + 1] += normal.y;
            sums[corner * 3 + 2] += normal.z;
        }
        faces.push({ vertices: [a.clone(), b.clone(), c.clone()], corners, normal: normal.clone().normalize(), centroid: centroid.clone() });
    };

    for (let ring = 0; ring < rings.length - 1; ring += 1) {
        for (let segment = 0; segment < SEGMENTS; segment += 1) {
            const p = rings[ring][segment];
            const q = rings[ring + 1][segment];
            const r = rings[ring + 1][segment + 1];
            const s = rings[ring][segment + 1];
            emit(p, q, r, [cornerOf(ring, segment), cornerOf(ring + 1, segment), cornerOf(ring + 1, segment + 1)]);
            emit(p, r, s, [cornerOf(ring, segment), cornerOf(ring + 1, segment + 1), cornerOf(ring, segment + 1)]);
        }
    }

    for (const face of faces) {
        face.vertices.forEach((vertex, index) => {
            positions.push(vertex.x, vertex.y, vertex.z);
            const corner = face.corners[index];
            if (smooth) shared.set(sums[corner * 3], sums[corner * 3 + 1], sums[corner * 3 + 2]).normalize();
            else shared.copy(face.normal);
            normals.push(shared.x, shared.y, shared.z);
            painter(vertex, face.centroid, color);
            colors.push(color.r, color.g, color.b);
        });
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return geometry;
}

function angleOf(segment) {
    return (segment / SEGMENTS) * Math.PI * 2;
}

/** Height of the rim's top edge: the ground on land, the sea on the water side. */
function rimTop(x, z) {
    return x > wallX(z) ? SEA_LEVEL : groundY(x, z);
}

// =============================================================================
// Pieces
// =============================================================================

function buildGround() {
    const rings = [];
    for (let ring = 0; ring <= GROUND_RINGS; ring += 1) {
        const row = [];
        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
            const angle = angleOf(segment);
            const radius = rimRadius(angle) * (ring / GROUND_RINGS);
            const z = Math.sin(angle) * radius;
            const x = Math.min(Math.cos(angle) * radius, wallX(z));
            row.push([x, groundY(x, z), z]);
        }
        rings.push(row);
    }
    return stitch(rings, new Vector3(0, -100, 0), (vertex, centroid, color) => {
        const toRim = rimRadius(Math.atan2(centroid.z, centroid.x)) - Math.hypot(centroid.x, centroid.z);
        const mottle = fbm2(centroid.x * 0.35, centroid.z * 0.35, 3);
        color.copy(PAVEMENT).lerp(PAVEMENT_DARK, 0.6 * mottle);
        if (toRim < 1.6) color.lerp(RIM_STONE, 1 - toRim / 1.6);
    });
}

/**
 * Radius factor that carves vertical ridges down the rock, like columns of
 * basalt. Read round a circle in the noise, so a full turn comes back to where
 * it began (the ring closes without a seam). At least 0.935 (the camera's
 * certain rock, in solids-field.js, allows for as little as 0.895).
 */
function striation(angle, depth) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const columns = noise2(c * 11 + depth * 0.04, s * 11) * 0.045 + noise2(c * 29 + 7.3, s * 29) * 0.02;
    return 1 - columns;
}

/**
 * How deep the belly hangs at a fraction of the rim's radius, lumps and all:
 * the lumps only ever bulge down (so the rock the camera's solids take as
 * certain stays inside it), and fade to nothing at the edge and the middle.
 */
function bellyAt(angle, fraction) {
    const plain = rimRadius(angle) * fraction;
    const u = 1 - Math.pow(Math.min(1, fraction / CURTAIN_EDGE), 1 / 0.85);
    const lump = fbm2(Math.cos(angle) * plain * 0.16 + 4.4, Math.sin(angle) * plain * 0.16 - 2.2, 2);
    return bellyDepth(angle, fraction) + lump * 2.6 * Math.sin(Math.PI * u);
}

/** How far in the curtain has drawn at a fraction s of the way down it (bulging a little on the way). */
function curtainIn(s) {
    return 0.985 + (CURTAIN_EDGE - 0.985) * Math.pow(s, 1.8) + 0.03 * Math.sin(Math.PI * s);
}

function buildRock() {
    const rings = [];
    const top = [];
    for (let segment = 0; segment <= SEGMENTS; segment += 1) {
        const angle = angleOf(segment);
        const radius = rimRadius(angle);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        top.push([x, rimTop(x, z), z]);
    }
    rings.push(top);

    const cliffFoot = [];
    for (let segment = 0; segment <= SEGMENTS; segment += 1) {
        const angle = angleOf(segment);
        const radius = rimRadius(angle) * 0.985 * striation(angle, 0);
        cliffFoot.push([Math.cos(angle) * radius, -CLIFF_DEPTH, Math.sin(angle) * radius]);
    }
    rings.push(cliffFoot);

    // The curtain, falling to its ragged edge: where the edge drips, the whole curtain stretches down with it.
    for (let ring = 1; ring <= CURTAIN_RINGS; ring += 1) {
        const s = ring / CURTAIN_RINGS;
        const row = [];
        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
            const angle = angleOf(segment);
            const depth = CLIFF_DEPTH + curtainDrop(angle) * s;
            const radius = rimRadius(angle) * curtainIn(s) * striation(angle, depth);
            row.push([Math.cos(angle) * radius, -depth, Math.sin(angle) * radius]);
        }
        rings.push(row);
    }

    // The belly, bowing down from the edge to its lowest point under the middle: lumpy (it only ever bulges
    // down, so the rock the camera's solids take as certain stays inside it), its columns fading toward the middle.
    for (let ring = 1; ring <= BELLY_RINGS; ring += 1) {
        const u = ring / BELLY_RINGS;
        const row = [];
        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
            const angle = angleOf(segment);
            const fraction = CURTAIN_EDGE * Math.pow(1 - u, 0.85);
            const depth = bellyAt(angle, fraction);
            const columns = 1 - (1 - striation(angle, depth)) * (1 - u);
            const radius = ring === BELLY_RINGS ? 0 : rimRadius(angle) * fraction * columns;
            row.push([Math.cos(angle) * radius, -depth, Math.sin(angle) * radius]);
        }
        rings.push(row);
    }

    // The striae are laid by the "rock" material itself, per pixel (kit.js); the vertex colour
    // only tints them, warmer toward the sun-facing west and a little cooler under the sea side.
    return stitch(rings, new Vector3(0, -2, 0), (vertex, centroid, color) => {
        color.copy(ROCK_TINT).lerp(ROCK_TINT_COOL, Math.min(1, Math.max(0, centroid.x / 30 + 0.5)));
    }, { smooth: true });
}

/**
 * Stalactite spikes hanging from the belly, and the roots: a few strong ones,
 * and many fine ones in bundles (from the belly and from the ragged edge),
 * falling nearly straight, as the roots trail from the islands in Elm's plate.
 */
function buildHangings(random) {
    const spikes = [];
    for (let index = 0; index < 13; index += 1) {
        const angle = random() * Math.PI * 2;
        const reach = random.range(0.25, 0.72);
        const radius = rimRadius(angle) * reach;
        const hangFrom = -bellyAt(angle, reach);
        const length = random.range(3.5, 10);
        const spike = new ConeGeometry(random.range(0.9, 2.2), length, 5, 1);
        pose(spike, {
            x: Math.cos(angle) * radius,
            y: hangFrom - length / 2 + 1.2,
            z: Math.sin(angle) * radius,
            rx: Math.PI + random.range(-0.15, 0.15),
            ry: random() * Math.PI,
            rz: random.range(-0.15, 0.15),
        });
        spikes.push(spike.toNonIndexed());
    }
    for (const spike of spikes) {
        spike.computeVertexNormals();
        paint(spike, ROCK_TINT);
    }

    // The strong roots grow out of the belly (each starts a little inside the rock) and fall, wavering.
    const roots = [];
    for (let index = 0; index < 11; index += 1) {
        const angle = random() * Math.PI * 2;
        const fraction = random.range(0.3, 0.8);
        const points = [];
        let x = Math.cos(angle) * rimRadius(angle) * fraction;
        let z = Math.sin(angle) * rimRadius(angle) * fraction;
        let y = -bellyAt(angle, fraction) + 0.8;
        for (let step = 0; step < 7; step += 1) {
            points.push(new Vector3(x, y, z));
            x += random.range(-0.7, 0.7);
            z += random.range(-0.7, 0.7);
            y -= random.range(2.4, 4.2);
        }
        // Thick where it leaves the rock, drawn out to a thread: a root, not a wire (and never finer than
        // a pen's line, or it breaks into dots).
        roots.push(taperedTube(points, random.range(0.2, 0.3), 0.05, ROOT, 28, 5));
    }

    // The fine roots, in bundles, as a pencil trails them: some from the belly, some from the ragged edge.
    const fine = createRandom(2029);
    for (let bundle = 0; bundle < 6; bundle += 1) {
        const angle = fine() * Math.PI * 2;
        const fromEdge = bundle % 2 === 0;
        const fraction = fromEdge ? CURTAIN_EDGE * 0.96 : fine.range(0.3, 0.7);
        const depth = fromEdge ? CLIFF_DEPTH + curtainDrop(angle) : bellyAt(angle, fraction);
        const cx = Math.cos(angle) * rimRadius(angle) * fraction;
        const cz = Math.sin(angle) * rimRadius(angle) * fraction;
        const count = Math.floor(fine.range(4, 7));
        for (let k = 0; k < count; k += 1) {
            let x = cx + fine.range(-1.3, 1.3);
            let z = cz + fine.range(-1.3, 1.3);
            let y = -depth + 0.5;
            const fall = fine.range(9, 24) / 6;
            const driftX = fine.range(-0.22, 0.22);
            const driftZ = fine.range(-0.22, 0.22);
            const points = [];
            for (let step = 0; step < 7; step += 1) {
                points.push(new Vector3(x, y, z));
                x += driftX + fine.range(-0.3, 0.3);
                z += driftZ + fine.range(-0.3, 0.3);
                y -= fall * fine.range(0.8, 1.2);
            }
            roots.push(taperedTube(points, fine.range(0.1, 0.14), 0.04, ROOTLET, 16, 3));
        }
    }
    return { spikes, roots };
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * Add the island's pieces to the buckets: the paved top to "dimGold", the
 * rock and its spikes to "rock" (which draws their striae), the roots to
 * "stone".
 */
export function buildIsland(buckets) {
    const random = createRandom(2021);
    buckets.add('dimGold', buildGround());
    buckets.add('rock', buildRock());
    const { spikes, roots } = buildHangings(random);
    for (const spike of spikes) buckets.add('rock', spike);
    for (const root of roots) buckets.add('stone', root, { passable: true });
}
