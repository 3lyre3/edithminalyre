/**
 * island.js — the floating piece of land Elysicester stands on.
 *
 * The paved top west of the sea-wall, the cliff around the rim, and the rock
 * underside that hangs beneath it: jagged, striated and trailing roots, like
 * the floating islands in Elm's cosmology plate (images/voidal_archipelago.jpg).
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    CatmullRomCurve3,
    Color,
    ConeGeometry,
    Float32BufferAttribute,
    TubeGeometry,
    Vector3,
} from 'three';
import {
    CLIFF_DEPTH,
    SEA_LEVEL,
    UNDERSIDE_DEPTH,
    createRandom,
    fbm2,
    groundY,
    noise2,
    paint,
    pose,
    rimRadius,
    wallX,
} from './kit.js';

// =============================================================================
// Constants
// =============================================================================

const SEGMENTS = 144;
const GROUND_RINGS = 16;
const UNDERSIDE_RINGS = 11;

const PAVEMENT = new Color(0x9a7440);
const PAVEMENT_DARK = new Color(0x6a5030);
const RIM_STONE = new Color(0x5a4640);
const STRATA = [0x7a5c5c, 0x8e6c5a, 0x665068, 0x9a7a5e, 0x584860].map((hex) => new Color(hex));
const DEEP_ROCK = new Color(0x2e2438);
const ROOT = new Color(0x3a2a22);

// =============================================================================
// Surface builder
// =============================================================================

/**
 * Stitch rings of points into triangles. Each triangle is turned to face away
 * from `core`, gets its own flat normal, and is coloured by `painter`.
 */
function stitch(rings, core, painter) {
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

    const emit = (p, q, r) => {
        a.fromArray(p);
        b.fromArray(q);
        c.fromArray(r);
        normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
        if (normal.lengthSq() < 1e-10) return;
        centroid.copy(a).add(b).add(c).divideScalar(3);
        if (normal.dot(centroid.clone().sub(core)) < 0) {
            [b.x, b.y, b.z, c.x, c.y, c.z] = [c.x, c.y, c.z, b.x, b.y, b.z];
            normal.negate();
        }
        normal.normalize();
        for (const vertex of [a, b, c]) {
            positions.push(vertex.x, vertex.y, vertex.z);
            normals.push(normal.x, normal.y, normal.z);
            painter(vertex, centroid, color);
            colors.push(color.r, color.g, color.b);
        }
    };

    for (let ring = 0; ring < rings.length - 1; ring += 1) {
        for (let segment = 0; segment < SEGMENTS; segment += 1) {
            const p = rings[ring][segment];
            const q = rings[ring + 1][segment];
            const r = rings[ring + 1][segment + 1];
            const s = rings[ring][segment + 1];
            emit(p, q, r);
            emit(p, r, s);
        }
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

/** Radius factor that carves vertical ridges down the rock, like columns of basalt. */
function striation(angle, depth) {
    const columns = noise2(angle * 11, depth * 0.04) * 0.07 + noise2(angle * 29, 7.3) * 0.035;
    return 1 - columns;
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

    for (let ring = 1; ring <= UNDERSIDE_RINGS; ring += 1) {
        const t = ring / UNDERSIDE_RINGS;
        const row = [];
        for (let segment = 0; segment <= SEGMENTS; segment += 1) {
            const angle = angleOf(segment);
            const sag = t === 1 ? 1.15 : 0.75 + 0.5 * noise2(angle * 2.3, 1.7);
            const depth = CLIFF_DEPTH + UNDERSIDE_DEPTH * Math.pow(t, 1.1) * sag;
            const taper = Math.pow(1 - t, 1.35) * (0.85 + 0.3 * noise2(angle * 5.1, ring * 0.9));
            const radius = t === 1 ? 0 : rimRadius(angle) * 0.985 * taper * striation(angle, depth);
            row.push([Math.cos(angle) * radius, -depth, Math.sin(angle) * radius]);
        }
        rings.push(row);
    }

    return stitch(rings, new Vector3(0, -2, 0), (vertex, centroid, color) => {
        const depth = -centroid.y;
        const band = Math.floor((depth + 1.5 * noise2(centroid.x * 0.2, centroid.z * 0.2)) / 1.7);
        color.copy(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]);
        color.lerp(DEEP_ROCK, Math.min(0.7, depth / (CLIFF_DEPTH + UNDERSIDE_DEPTH) * 0.8));
    });
}

/** Stalactite spikes and trailing roots that break the underside's outline. */
function buildHangings(random) {
    const spikes = [];
    for (let index = 0; index < 13; index += 1) {
        const angle = random() * Math.PI * 2;
        const reach = random.range(0.25, 0.72);
        const radius = rimRadius(angle) * reach;
        const ringT = 1 - Math.pow(reach, 1 / 1.35);
        const hangFrom = -(CLIFF_DEPTH + UNDERSIDE_DEPTH * Math.pow(ringT, 1.1) * 0.75);
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
        const position = spike.attributes.position;
        const colors = new Float32Array(position.count * 3);
        const color = new Color();
        for (let index = 0; index < position.count; index += 1) {
            const depth = -position.getY(index);
            color.copy(STRATA[index % STRATA.length]).lerp(DEEP_ROCK, Math.min(0.8, depth / 30));
            colors.set([color.r, color.g, color.b], index * 3);
        }
        spike.setAttribute('color', new Float32BufferAttribute(colors, 3));
    }

    const roots = [];
    for (let index = 0; index < 11; index += 1) {
        const angle = random() * Math.PI * 2;
        const start = rimRadius(angle) * random.range(0.55, 0.93);
        const startY = -CLIFF_DEPTH - random.range(0.5, 6);
        const points = [];
        let x = Math.cos(angle) * start;
        let z = Math.sin(angle) * start;
        let y = startY;
        for (let step = 0; step < 6; step += 1) {
            points.push(new Vector3(x, y, z));
            x += random.range(-1.4, 1.4);
            z += random.range(-1.4, 1.4);
            y -= random.range(2.2, 4.2);
        }
        const root = new TubeGeometry(new CatmullRomCurve3(points), 18, random.range(0.07, 0.15), 4, false);
        roots.push(paint(root, ROOT));
    }
    return { spikes, roots };
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * Add the island's pieces to the buckets: the paved top to "dimGold", the
 * rock and its hangings to "stone".
 */
export function buildIsland(buckets) {
    const random = createRandom(2021);
    buckets.add('dimGold', buildGround());
    buckets.add('stone', buildRock());
    const { spikes, roots } = buildHangings(random);
    for (const spike of spikes) buckets.add('stone', spike);
    for (const root of roots) buckets.add('stone', root, { passable: true });
}
