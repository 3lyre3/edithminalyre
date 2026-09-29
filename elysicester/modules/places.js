/**
 * places.js — Elysicester's named places, built from data/places.json.
 *
 * The city fabric comes first: the golden sea-wall, the pavements, the houses
 * and the copper signal-towers. Then every tier-1 place in the data is drawn
 * in code at its anchor: the sun-dock, the three cafés and the jetty, the
 * turquoise flags and tram-wires, the Steel Garden, the golden bridgework and
 * its spires, the sky-grottos, the sea-wall balcony, the glass gas station and
 * the glitching edge. Anchors are returned by id so reading points, the camera
 * rig and later tiers can find each place; mounts, by name, tell signs.js where
 * each plaque, board, banner and marker hangs.
 *
 * Nothing here is decoration for its own sake: each shape answers a line in
 * Numbers by Paint (Episodes 1 and 3) or President Oedipus.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    BoxGeometry,
    BufferGeometry,
    CatmullRomCurve3,
    CircleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    DoubleSide,
    ExtrudeGeometry,
    Float32BufferAttribute,
    Group,
    IcosahedronGeometry,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Quaternion,
    ShaderMaterial,
    Shape,
    SphereGeometry,
    TorusGeometry,
    TubeGeometry,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { doorCanOpen, doorOpen, shadowTexture } from './extras.js';
import { createHums } from './hums.js';
import {
    SEA_LEVEL,
    createRandom,
    groundY,
    light,
    noise2,
    onLand,
    chamferedBox,
    paint,
    paintBy,
    pose,
    rimRadius,
    taperedTube,
    wallX,
} from './kit.js';

// =============================================================================
// Constants
// =============================================================================

const GOLDS = [0xecc46c, 0xe0b45c, 0xd4a24e, 0xf4d488];
/** The sea-wall's golden bricking: its body, the course that stands out a little, and its merlons. */
const WALL_GOLD = 0xe2bc68;
const WALL_GOLD_BAND = 0xd6aa56;
const WALL_GOLD_TOP = 0xecc978;
const GOLD_ROOFS = [0xb46a30, 0x9a582a, 0xc27a38];
/** Now and then a roof of another metal or clay: dark bronze, rose tile, old brick, verdigris. */
const ROOF_ACCENTS = [0x6e4428, 0xa8563a, 0x8e3f2c, 0x5e8c7a];
const PAVE = 0xb08a4c;
const PAVE_DARK = 0x7e6036;
const BRICK = [0x9c3e2e, 0x8e3628, 0xa4462f];
const BRICK_DARK = 0x5e2019;
const STEEL = 0x8a94a4;
const STEEL_DARK = 0x363c46;
const MOSS = new Color(0x4e7c46);
const BLUE_GREEN = 0x3f8a84;
const PLASTIC = 0xdcdad2;
const TURQUOISES = [0x2fc4bc, 0x3ed8cc, 0x25aea8];
const FRAYED = new Color(0x1c2a2a);
const WHITE_ARCH = 0xe6eef6;
const COPPER = new Color(0xb8683a);
const PATINA = new Color(0x5e9c88);
const DOG_COATS = [0x6a4a32, 0xd8c8a8, 0x3a2e2a];
const SHADOW = 0x140e12;

const WINDOW = light(0xffc46a, 3.0);
/** A window lit lower, by a lamp further in. */
const WINDOW_LOW = light(0xff9e4a, 2.1);
const LAMP = light(0xffd28a, 4.2);
/** The cafés' footlights, burning low and warm. */
const FOOTLIGHT = light(0xffc070, 3.6);
const COOL = light(0xd4fff4, 2.6);
const DOOR = light(0xffd23a, 2.6);
/** What lies beyond the yellow door, when it stands open (an extra). */
const BEYOND = light(0xfff4d0, 4.6);
const STAR = light(0xfff0c0, 4.4);
const GLITCH = [light(0xff3ad8, 3.0), light(0x3afff0, 3.0)];

const GATE_Z = -3.2;
/** How far a building's edges are cut back to catch the light (a hand's breadth, at the city's scale). */
const BEVEL = 0.07;
/** No house stands nearer the Steel Garden's middle than this (its disc is 4.3 across the radius). */
const GARDEN_ROOM = 7.2;

// =============================================================================
// Shape helpers
// =============================================================================

function box(w, h, d, at, color) {
    return paint(pose(new BoxGeometry(w, h, d), at), color);
}

/** A box whose edges are chamfered (kit.js), so they catch the light as made things' edges do. */
function bevelBox(w, h, d, at, color, bevel = BEVEL) {
    return paint(pose(chamferedBox(w, h, d, bevel), at), color);
}

function cylinder(top, bottom, h, segments, at, color) {
    return paint(pose(new CylinderGeometry(top, bottom, h, segments), at), color);
}

function cone(radius, h, segments, at, color) {
    return paint(pose(new ConeGeometry(radius, h, segments), at), color);
}

function ball(radius, at, color, widthSegments = 10, heightSegments = 7) {
    return paint(pose(new SphereGeometry(radius, widthSegments, heightSegments), at), color);
}

function tube(points, radius, color, segments = 20, radial = 5) {
    return paint(new TubeGeometry(new CatmullRomCurve3(points), segments, radius, radial, false), color);
}

/** A gable roof: a triangle extruded along the house's depth. */
function gable(width, rise, depth, at, color) {
    const shape = new Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    return paint(pose(geometry, at), color);
}

/** A strip laid on the ground between two points, following its rise and fall. */
function groundStrip(x0, z0, x1, z1, width, color, lift = 0.05) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const segments = Math.max(2, Math.ceil(length / 1.5));
    const geometry = new PlaneGeometry(length, width, segments, 2);
    geometry.rotateX(-Math.PI / 2);
    const angle = Math.atan2(z1 - z0, x1 - x0);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
        const along = position.getX(index);
        const across = position.getZ(index);
        const x = (x0 + x1) / 2 + along * Math.cos(angle) - across * Math.sin(angle);
        const z = (z0 + z1) / 2 + along * Math.sin(angle) + across * Math.cos(angle);
        position.setXYZ(index, x, groundY(x, z) + lift, z);
    }
    geometry.computeVertexNormals();
    return paint(geometry, color);
}

/** Turn a list of local pieces around a frame (x, y, z, ry). */
function frame(pieces, at) {
    for (const piece of pieces) pose(piece, at);
    return pieces;
}

const UP = new Vector3(0, 1, 0);

/** A point given in a frame's own terms (x, y, z, turned by ry), in the world's. */
function inFrame(x, y, z, at) {
    return new Vector3(x, y, z).applyAxisAngle(UP, at.ry ?? 0).add(new Vector3(at.x ?? 0, at.y ?? 0, at.z ?? 0));
}

/** The sea-wall's outward face direction at z (it bends a little with the shore). */
function wallNormal(z) {
    const slope = (wallX(z + 0.01) - wallX(z - 0.01)) / 0.02;
    return new Vector3(1, 0, -slope).normalize();
}

/**
 * Where a sign can hang. signs.js reads these by name ("place/slot") and fits
 * each plate to its words.
 *   position   centre of the plate
 *   normal     the way its face looks
 *   height     plate height (it narrows if the words are long)
 *   maxWidth   widest the plate may be
 *   style      plaque | cafe | banner | door | board | marker | gate
 *   twoSided   the words read from behind too
 *   roll       a lean, in radians
 *   stand      { kind: 'post' | 'posts', base } — legs from the plate down to y = base
 *   sway       the plate flutters (a banner)
 */
function mount(mounts, name, spec) {
    mounts.set(name, { twoSided: false, roll: 0, stand: null, sway: false, ...spec });
}

// =============================================================================
// City fabric: wall, pavements, houses, signal-towers
// =============================================================================

function wallEnds() {
    const inside = (z) => Math.hypot(wallX(z), z) < rimRadius(Math.atan2(z, wallX(z))) - 0.2;
    let north = 0;
    while (inside(north - 0.25)) north -= 0.25;
    let south = 0;
    while (inside(south + 0.25)) south += 0.25;
    return [north, south];
}

function buildWall(buckets, mounts) {
    const [north, south] = wallEnds();
    const thickness = 1.3;
    const courses = [[SEA_LEVEL - 0.5, 0.6, 0], [0.6, 1.9, 0.05], [1.9, 3.1, 0]];
    const count = Math.ceil((south - north) / 1.5);
    for (let index = 0; index < count; index += 1) {
        const z0 = north + (index / count) * (south - north);
        const z1 = north + ((index + 1) / count) * (south - north);
        const zm = (z0 + z1) / 2;
        if (Math.abs(zm - GATE_Z) < 1.2) continue;
        const length = Math.hypot(wallX(z1) - wallX(z0), z1 - z0) + 0.04;
        const ry = Math.atan2(wallX(z1) - wallX(z0), z1 - z0);
        const at = { x: wallX(zm) - thickness / 2, z: zm, ry };
        // One gold for the whole wall: the bricking material lays each brick its own shade of it.
        const pieces = courses.map(([bottom, top, jut], course) => box(
            thickness + jut * 2, top - bottom, length, { y: (bottom + top) / 2 }, course === 1 ? WALL_GOLD_BAND : WALL_GOLD,
        ));
        for (const offset of [-length / 4, length / 4]) {
            pieces.push(bevelBox(thickness * 0.7, 0.55, length * 0.28, { y: 3.37, z: offset }, WALL_GOLD_TOP, 0.06));
        }
        for (const piece of frame(pieces, at)) buckets.add('bricking', piece);
    }

    // The gate where the avenue meets the waterfront: two pillars and an arch.
    const gateX = wallX(GATE_Z) - thickness / 2;
    const ry = Math.atan2(wallX(GATE_Z + 0.5) - wallX(GATE_Z - 0.5), 1);
    const gate = [
        box(1.5, 3.9, 0.7, { x: 0, y: 1.35, z: -1.35 }, GOLDS[3]),
        box(1.5, 3.9, 0.7, { x: 0, y: 1.35, z: 1.35 }, GOLDS[3]),
        paint(pose(new TorusGeometry(1.35, 0.26, 6, 16, Math.PI), { y: 3.1, ry: Math.PI / 2 }), GOLDS[0]),
        cone(0.28, 1.1, 6, { y: 4.9 }, GOLDS[3]),
    ];
    const gateFrame = { x: gateX, z: GATE_Z, ry };
    for (const piece of frame(gate, gateFrame)) buckets.add('gold', piece);

    // The city's name hangs in the arch, read from the waterfront and the avenue alike.
    mount(mounts, 'gate/name', {
        position: inFrame(0, 3.62, 0, gateFrame),
        normal: inFrame(1, 0, 0, { ry }),
        height: 0.42,
        maxWidth: 1.1,
        style: 'gate',
        twoSided: true,
    });
}

/**
 * The city's streets: paved ways the houses stand back from, so that from above
 * it reads as a city, and there's room to walk in it (walk.js). Each is a line
 * of points (x, z) and a width. The avenue runs in from the gate in the sea-wall
 * past the bridgework to the western cliff; the high street crosses it at the
 * flags' crossroads and runs the city's length; two loops go round the
 * bridgework, north under the sky-grottos by the signal-towers, south by the
 * gas station.
 */
const STREETS = [
    { points: [[8.1, GATE_Z], [-13, GATE_Z], [-25.5, -3.4]], width: 2.4 },
    { points: [[4, -25], [4, 12], [3.6, 24.5]], width: 2.2 },
    { points: [[-13, GATE_Z], [-15.5, -9.5], [-10.5, -13.5], [-3, -13.5], [4, -15]], width: 2.0 },
    { points: [[4, 12.2], [-2, 11.3], [-9, 9], [-13.5, 3], [-13, GATE_Z]], width: 2.0 },
];

/** How far (x, z) lies outside the nearest street's edge (negative: in the street). */
function streetGap(x, z) {
    let nearest = Infinity;
    for (const { points, width } of STREETS) {
        for (let index = 0; index < points.length - 1; index += 1) {
            const [ax, az] = points[index];
            const [bx, bz] = points[index + 1];
            const abx = bx - ax;
            const abz = bz - az;
            const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)));
            nearest = Math.min(nearest, Math.hypot(ax + abx * t - x, az + abz * t - z) - width / 2);
        }
    }
    return nearest;
}

/** Whether a house's footprint (centre, width, depth, turn) would stand in a street, or too near its edge. */
function standsInStreet(x, z, width, depth, turn) {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (const u of [-0.5, 0, 0.5]) {
        for (const v of [-0.5, 0, 0.5]) {
            const lx = u * width;
            const lz = v * depth;
            if (streetGap(x + lx * cos + lz * sin, z - lx * sin + lz * cos) < 0.25) return true;
        }
    }
    return false;
}

function buildPavements(buckets) {
    for (const { points, width } of STREETS) {
        for (let index = 0; index < points.length - 1; index += 1) {
            const [ax, az] = points[index];
            const [bx, bz] = points[index + 1];
            buckets.add('dimGold', groundStrip(ax, az, bx, bz, width, PAVE));
        }
        // Where a street bends, a round paving closes the corner.
        for (const [x, z] of points.slice(1, -1)) {
            const joint = new CircleGeometry(width / 2, 12);
            joint.rotateX(-Math.PI / 2);
            const position = joint.attributes.position;
            for (let index = 0; index < position.count; index += 1) {
                const px = position.getX(index) + x;
                const pz = position.getZ(index) + z;
                position.setXYZ(index, px, groundY(px, pz) + 0.052, pz);
            }
            joint.computeVertexNormals();
            buckets.add('dimGold', paint(joint, PAVE));
        }
    }
}

/** Zones the houses keep out of, so the named places have room. */
function clearZones(byId) {
    const at = (id) => byId.get(id).position;
    const [gx, , gz] = at('steel-garden');
    const [sx, , sz] = at('gas-station');
    const [bx, , bz] = at('bridge');
    return [
        (x, z) => Math.hypot(x - gx, z - gz) < 5.2,
        (x, z) => Math.abs(x - sx) < 4.2 && Math.abs(z - sz) < 7.5,
        (x, z) => Math.hypot(x - (bx - 2.5), z - (bz - 1)) < 8.5,
        (x, z) => Math.abs(z - GATE_Z) < 2.3 && x > -13,
        (x, z) => Math.abs(x - 4) < 2.0 && z > -15 && z < 12,
        (x, z) => Math.hypot(x + 7.6, z + 17.6) < 5,
    ];
}

/**
 * Whether a window (of the house at x, z; on row, on its front or its side) is
 * lit at dusk, and in what light: null for dark. A hash of where it is, so the
 * same windows are lit on every visit.
 */
function windowLight(x, z, row, side) {
    const seed = Math.sin(x * 12.9898 + z * 78.233 + row * 37.719 + side * 19.13) * 43758.5453;
    const chance = seed - Math.floor(seed);
    if (chance > 0.4) return null;
    return chance < 0.14 ? WINDOW_LOW : WINDOW;
}

/**
 * One house. The shared random stream decides what it always decided (size,
 * turn, colours, style, lit windows), in the same order, so the rest of the
 * city keeps its shape; `detail`, a stream of its own, adds the variety: slim
 * towers and two-tier houses, walls tinted a little apart, a few bronze, rose
 * or verdigris roofs, doors, dark windows among the lit ones, chimneys and
 * balconies.
 */
function addHouse(buckets, random, x, z, height, style, detail, { keepsTheStreets = true } = {}) {
    const w = random.range(1.6, 2.7);
    const d = random.range(1.6, 2.7);
    const ry = random.pick([0, 0.07, -0.05, Math.PI / 2, 0.12]);
    const wallBase = GOLDS[Math.floor(random() * GOLDS.length)];
    const roofBase = GOLD_ROOFS[Math.floor(random() * GOLD_ROOFS.length)];

    const tower = detail() < 0.12;
    const width = tower ? w * 0.62 : w;
    const depth = tower ? d * 0.62 : d;
    // A house that would stand in a street is drawn from the streams all the same (so every other house and
    // place keeps its look), but never built: the streets stay open.
    const inStreet = keepsTheStreets && standsInStreet(x, z, width + 0.24, depth + 0.24, ry);
    if (inStreet) buckets = UNBUILT;
    const tall = tower ? height + detail.range(2.6, 4.6) : height;
    const wall = new Color(wallBase).offsetHSL(detail.range(-0.012, 0.012), detail.range(-0.08, 0.04), detail.range(-0.07, 0.05));
    const roof = detail() < 0.24 ? ROOF_ACCENTS[Math.floor(detail() * ROOF_ACCENTS.length)] : roofBase;
    const stacked = !tower && tall > 3.1 && detail() < 0.28;
    const roofStyle = tower ? 'pyramid' : style;

    const pieces = [];
    let top = tall;
    let roofWidth = width;
    let roofDepth = depth;
    if (stacked) {
        const lower = tall * 0.58;
        pieces.push(bevelBox(width, lower, depth, { y: lower / 2 }, wall));
        roofWidth = width * 0.72;
        roofDepth = depth * 0.72;
        pieces.push(bevelBox(roofWidth, tall - lower, roofDepth, { y: lower + (tall - lower) / 2, z: -depth * 0.08 }, wall.clone().offsetHSL(0, 0, 0.03)));
        pieces.push(box(width + 0.12, 0.14, depth + 0.12, { y: lower + 0.07 }, roof));
    } else {
        pieces.push(bevelBox(width, tall, depth, { y: tall / 2 }, wall));
    }
    const roofZ = stacked ? -depth * 0.08 : 0;
    if (roofStyle === 'gable') {
        pieces.push(gable(roofWidth + 0.2, 1.1, roofDepth + 0.2, { y: top, z: roofZ }, roof));
    } else if (roofStyle === 'pyramid') {
        const rise = tower ? 2.4 : 1.6;
        pieces.push(cone(Math.max(roofWidth, roofDepth) * 0.74, rise, 4, { y: top + rise / 2, z: roofZ, ry: Math.PI / 4 }, roof));
    } else if (roofStyle === 'dome') {
        const radius = Math.min(roofWidth, roofDepth) * 0.55;
        pieces.push(paint(pose(new SphereGeometry(radius, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: top, z: roofZ }), roof));
        pieces.push(cone(0.12, 1.1, 6, { y: top + radius + 0.4, z: roofZ }, GOLDS[3]));
    } else {
        pieces.push(box(roofWidth + 0.16, 0.3, roofDepth + 0.16, { y: top + 0.15, z: roofZ }, roof));
    }
    // A cornice under every roof but a flat one (that has its own slab): a drawn line where wall meets roof.
    if (roofStyle !== 'flat') {
        pieces.push(box(roofWidth + 0.12, 0.12, roofDepth + 0.12, { y: top - 0.05, z: roofZ }, new Color(wall).offsetHSL(0, 0.02, -0.13)));
    }
    if (roofStyle === 'gable' && detail() < 0.35) {
        pieces.push(box(0.24, 0.8, 0.24, { x: roofWidth * 0.26, y: top + 0.75, z: roofZ + roofDepth * 0.12 }, new Color(roof).offsetHSL(0, 0, -0.08)));
    }

    // A door on the front, and dark windows in the rows the lit ones leave empty.
    const darkWindow = new Color(wall).multiplyScalar(0.34);
    pieces.push(box(0.42, 0.82, 0.05, { x: detail.range(-width * 0.22, width * 0.22), y: 0.46, z: depth / 2 + 0.02 }, SHADOW));
    if (!tower && tall > 3 && detail() < 0.16) {
        pieces.push(box(width * 0.6, 0.08, 0.46, { y: 1.95, z: depth / 2 + 0.23 }, wall.clone().offsetHSL(0, 0, -0.1)));
        pieces.push(box(width * 0.6, 0.3, 0.04, { y: 2.12, z: depth / 2 + 0.44 }, SHADOW));
    }
    // Which wall a window at height y sits on: the lower storey, or the narrower one above it.
    const lowerTop = stacked ? tall * 0.58 : tall;
    const faceAt = (y) => (stacked && y > lowerTop
        ? { front: roofZ + roofDepth / 2 + 0.02, half: roofWidth / 2, depthHalf: roofDepth / 2, centreZ: roofZ, top: tall }
        : { front: depth / 2 + 0.02, half: width / 2, depthHalf: depth / 2, centreZ: 0, top: lowerTop });
    const glows = [];
    const litRows = new Set();
    if (random() < 0.7) {
        const rows = Math.max(1, Math.floor(height / 1.6));
        for (let row = 0; row < rows; row += 1) {
            if (random() < 0.35) continue;
            const y = 1.1 + row * 1.5;
            const across = random.range(-w * 0.25, w * 0.25) / (w / 2);
            const face = faceAt(y);
            if (y + 0.25 > face.top) continue;
            glows.push(box(0.26, 0.42, 0.04, { x: across * face.half, y, z: face.front }, WINDOW));
            litRows.add(row);
        }
    }
    // At dusk, a good many of the other windows are lit too: which ones is fixed by where the house
    // stands (a hash, not the random streams, so every house keeps its shape and place).
    const rows = Math.max(1, Math.floor((tall - 0.6) / 1.5));
    for (let row = 0; row < rows; row += 1) {
        const y = 1.1 + row * 1.5;
        const face = faceAt(y);
        if (y + 0.25 > face.top) continue;
        if (!litRows.has(row)) {
            const front = { x: face.half * 0.52 * (row % 2 ? 1 : -1), y, z: face.front };
            const glowing = windowLight(x, z, row, 0);
            if (glowing) glows.push(box(0.24, 0.4, 0.04, front, glowing));
            else pieces.push(box(0.24, 0.4, 0.04, front, darkWindow));
        }
        if (detail() < 0.6) {
            const side = { x: face.half + 0.02, y, z: face.centreZ + detail.range(-face.depthHalf * 0.4, face.depthHalf * 0.4) };
            const glowing = windowLight(x, z, row, 1);
            if (glowing) glows.push(box(0.04, 0.4, 0.24, side, glowing));
            else pieces.push(box(0.04, 0.4, 0.24, side, darkWindow));
        }
    }

    const at = { x, y: groundY(x, z) - 0.05, z, ry };
    for (const piece of frame(pieces, at)) buckets.add('gold', piece);
    for (const piece of frame(glows, at)) buckets.add('glow', piece);
    return { w, d, built: buckets !== UNBUILT };
}

/** Where a house goes that is drawn but not built. */
const UNBUILT = { add() {} };

/**
 * The grand city (?city=grand; Elm: "what if we aimed for far fewer buildings but much larger?"): a few
 * broad halls in place of the many small houses, in the vocabulary of her plates' tiny buildings, grown up:
 * an arcade of dark arches along the foot, storeys of small square windows above it (her dot windows), a
 * drawn cornice at every storey, and a roof (a gable, a pyramid, a dome with its lantern, or a flat top
 * behind a parapet); now and then a tower at the front with a spire and a cross.
 */
const HALLS = 24;
const HALL_STOREY = 1.5;

function addHall(buckets, random, x, z, { width, depth, height, style, turn, tower }) {
    const pieces = [];
    const glows = [];
    const wall = new Color(GOLDS[Math.floor(random() * GOLDS.length)])
        .offsetHSL(random.range(-0.012, 0.012), random.range(-0.07, 0.03), random.range(-0.05, 0.04));
    const roof = random() < 0.25 ? ROOF_ACCENTS[Math.floor(random() * ROOF_ACCENTS.length)] : GOLD_ROOFS[Math.floor(random() * GOLD_ROOFS.length)];
    const trim = wall.clone().offsetHSL(0, 0.02, -0.13);
    const darkWindow = wall.clone().multiplyScalar(0.34);
    const plinth = 0.45;

    pieces.push(bevelBox(width + 0.3, plinth, depth + 0.3, { y: plinth / 2 }, wall.clone().offsetHSL(0, 0, -0.06)));
    pieces.push(bevelBox(width, height, depth, { y: height / 2 }, wall));
    // A drawn line at every storey.
    for (let y = plinth + HALL_STOREY + 0.3; y < height - 0.5; y += HALL_STOREY) {
        pieces.push(box(width + 0.08, 0.07, depth + 0.08, { y }, trim));
    }

    // Round the four faces: the arcade at the foot, the dot windows above.
    const faces = [
        { across: width, out: depth / 2 + 0.02, turn: 0 },
        { across: width, out: depth / 2 + 0.02, turn: Math.PI },
        { across: depth, out: width / 2 + 0.02, turn: Math.PI / 2 },
        { across: depth, out: width / 2 + 0.02, turn: -Math.PI / 2 },
    ];
    faces.forEach((face, side) => {
        // A point on this face, `along` it from its middle, at height y, turned to face out.
        const at = (along, y) => {
            const c = Math.cos(face.turn);
            const s = Math.sin(face.turn);
            return { x: along * c + face.out * s, y, z: -along * s + face.out * c, ry: face.turn };
        };
        const bays = Math.max(2, Math.round(face.across / 1.2));
        const bay = face.across / bays;
        for (let index = 0; index < bays; index += 1) {
            const along = -face.across / 2 + bay * (index + 0.5);
            const lit = windowLight(x + along * 0.37, z + side * 1.7, 0, side + 2);
            const color = lit ? WINDOW_LOW : SHADOW;
            const opening = box(0.58, 0.8, 0.05, at(along, plinth + 0.4), color);
            const top = paint(pose(new CylinderGeometry(0.29, 0.29, 0.05, 10), { ...at(along, plinth + 0.8), rx: Math.PI / 2 }), color);
            (lit ? glows : pieces).push(opening, top);
        }
        const columns = Math.max(1, Math.floor((face.across - 0.5) / 0.72));
        const spacing = (face.across - 0.5) / columns;
        let row = 0;
        for (let y = plinth + HALL_STOREY + 0.75; y + 0.3 < height - 0.35; y += HALL_STOREY, row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const along = -face.across / 2 + 0.25 + spacing * (column + 0.5);
                const glowing = windowLight(x + along, z + y * 0.61 + side * 3.1, row, side);
                if (glowing) glows.push(box(0.22, 0.3, 0.04, at(along, y), glowing));
                else pieces.push(box(0.22, 0.3, 0.04, at(along, y), darkWindow));
            }
        }
    });

    // The roof, and under it (but for a flat one) a cornice.
    let crown = height;
    if (style !== 'flat') pieces.push(box(width + 0.16, 0.14, depth + 0.16, { y: height - 0.05 }, trim));
    if (style === 'gable') {
        const rise = Math.min(width, depth) * 0.42;
        pieces.push(gable(width + 0.3, rise, depth + 0.3, { y: height }, roof));
        crown = height + rise;
    } else if (style === 'pyramid') {
        const rise = Math.max(width, depth) * 0.5;
        pieces.push(cone(Math.max(width, depth) * 0.74, rise, 4, { y: height + rise / 2, ry: Math.PI / 4 }, roof));
        crown = height + rise;
    } else if (style === 'dome') {
        const radius = Math.min(width, depth) * 0.38;
        pieces.push(cylinder(radius * 1.04, radius * 1.04, 0.5, 18, { y: height + 0.25 }, trim));
        pieces.push(paint(pose(new SphereGeometry(radius, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: height + 0.5 }), roof));
        pieces.push(cylinder(0.18, 0.2, 0.55, 8, { y: height + 0.5 + radius + 0.2 }, wall));
        pieces.push(cone(0.26, 0.7, 8, { y: height + 0.5 + radius + 0.8 }, GOLDS[3]));
        crown = height + 0.5 + radius + 1.15;
    } else {
        pieces.push(box(width + 0.2, 0.26, depth + 0.2, { y: height + 0.13 }, roof));
        for (const [w, d, px, pz] of [[width + 0.2, 0.14, 0, depth / 2 + 0.03], [width + 0.2, 0.14, 0, -depth / 2 - 0.03], [0.14, depth + 0.2, width / 2 + 0.03, 0], [0.14, depth + 0.2, -width / 2 - 0.03, 0]]) {
            pieces.push(box(w, 0.36, d, { x: px, y: height + 0.44, z: pz }, trim));
        }
        crown = height + 0.6;
    }

    // Now and then a tower at the front, with a spire and a cross, as her plates' tiny buildings have.
    if (tower) {
        const rise = 1.8;
        const at = { z: depth / 2 - 0.55 };
        pieces.push(bevelBox(1.0, crown - height + rise, 1.0, { ...at, y: height + (crown - height + rise) / 2 }, wall.clone().offsetHSL(0, 0, 0.03)));
        const base = crown + rise;
        pieces.push(box(1.12, 0.12, 1.12, { ...at, y: base }, trim));
        pieces.push(cone(0.46, 3.0, 8, { ...at, y: base + 1.5 }, roof));
        pieces.push(box(0.07, 0.62, 0.07, { ...at, y: base + 3.25 }, GOLDS[3]));
        pieces.push(box(0.34, 0.07, 0.07, { ...at, y: base + 3.36 }, GOLDS[3]));
        glows.push(box(0.2, 0.34, 0.04, { x: 0, y: crown + rise * 0.55, z: depth / 2 - 0.03 }, WINDOW));
    }

    const at = { x, y: groundY(x, z) - 0.05, z, ry: turn };
    for (const piece of frame(pieces, at)) buckets.add('gold', piece);
    for (const piece of frame(glows, at)) buckets.add('glow', piece);
}

/**
 * The grand city's halls, from a stream of their own, where there's room between the streets and the places.
 * (Where one stands between a reading point and its camera, the camera comes round to a clear side: orbit.js.)
 */
function buildHalls(buckets, byId, zones, standing) {
    const random = createRandom(5171);
    const [gx, , gz] = byId.get('steel-garden').position;
    const halls = [];
    const styles = ['gable', 'flat', 'dome', 'pyramid', 'gable', 'flat'];
    for (let attempt = 0; attempt < 8000 && halls.length < HALLS; attempt += 1) {
        const x = random.range(-26, 8);
        const z = random.range(-27, 27);
        // The great halls take their room first; later, smaller ones fill what room is left between them.
        const later = Math.min(1, attempt / 5000);
        const width = random.range(3.2 - 0.6 * later, 5.4 - 1.6 * later);
        const depth = random.range(3.2 - 0.6 * later, 5.4 - 1.6 * later);
        const turn = random.pick([0, 0, Math.PI / 2, 0.05, -0.05]);
        const reach = Math.hypot(width, depth) / 2;
        if (!onLand(x, z, reach + 1.0)) continue;
        const corners = [[0, 0], [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]].map(([u, v]) => [x + u * width, z + v * depth]);
        if (corners.some(([cx, cz]) => zones.some((inside) => inside(cx, cz)))) continue;
        if (Math.hypot(x - gx, z - gz) < GARDEN_ROOM + reach * 0.6) continue;
        if (standsInStreet(x, z, width + 0.9, depth + 0.9, turn)) continue;
        if (standing.some(([px, pz]) => Math.hypot(px - x, pz - z) < reach + 2.0)) continue;
        if (halls.some((hall) => Math.hypot(hall.x - x, hall.z - z) < reach + hall.reach + 0.7)) continue;
        const westness = Math.min(1, Math.max(0, -x / 24));
        const height = random.range(4.2, 6.2) + westness * random.range(2, 5.5);
        const style = styles[Math.floor(random() * styles.length)];
        const tower = style !== 'dome' && random() < 0.3;
        addHall(buckets, random, x, z, { width, depth, height, style, turn, tower });
        halls.push({ x, z, reach });
    }
    return halls.length;
}

function buildHouses(buckets, random, byId, { grand = false } = {}) {
    const zones = clearZones(byId);
    const placed = [];
    // The houses' finer variety draws on a stream of its own, so the shared one runs as before.
    const detail = createRandom(1209);

    // Two tall houses by the crossroads, joined by a gangway the flags tangle over: kept plain
    // (no tower, no second storey), so the gangway still meets their walls.
    const steady = Object.assign(() => 0.99, { range: (low, high) => (low + high) / 2, pick: (list) => list[0] });
    const [fx, , fz] = byId.get('flags').position;
    const pair = [[fx - 2.6, fz - 4.4, 6.4], [fx + 2.4, fz - 4.6, 5.8]];
    const standing = [];
    for (const [x, z, height] of pair) {
        // (These two flank the high street under their gangway, where it crosses: they stand whatever.)
        addHouse(buckets, random, x, z, height, 'gable', steady, { keepsTheStreets: false });
        placed.push([x, z]);
        standing.push([x, z]);
    }
    const gangY = groundY(fx, fz - 4.5) + 5.1;
    buckets.add('gold', box(5.2, 0.16, 0.9, { x: fx - 0.1, y: gangY, z: fz - 4.5 }, GOLDS[1]));
    buckets.add('gold', box(5.2, 0.5, 0.06, { x: fx - 0.1, y: gangY + 0.3, z: fz - 4.05 }, GOLDS[2]));

    // A house that would crowd the Steel Garden's rim is still drawn from the stream (so every other
    // house keeps its place and its look) but never built: the garden has room round it to be seen.
    const [gx, , gz] = byId.get('steel-garden').position;
    let cleared = 0;
    let streets = 0;
    const styles = ['gable', 'gable', 'pyramid', 'dome', 'flat'];
    for (let attempt = 0; attempt < 2600 && placed.length < 80; attempt += 1) {
        const x = random.range(-26, 8);
        const z = random.range(-27, 27);
        if (!onLand(x, z, 2.2)) continue;
        if (zones.some((inside) => inside(x, z))) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.0)) continue;
        const westness = Math.min(1, Math.max(0, -x / 24));
        const height = random.range(1.8, 3.4) + westness * random.range(1.5, 4.5);
        const crowds = Math.hypot(x - gx, z - gz) < GARDEN_ROOM;
        if (crowds) cleared += 1;
        // In the grand city the small houses are drawn from the stream all the same (so every place keeps its
        // look), but none is built: the halls stand in their stead.
        const { built } = addHouse(crowds || grand ? UNBUILT : buckets, random, x, z, height, styles[Math.floor(random() * styles.length)], detail);
        if (!crowds && !built && !grand) streets += 1;
        if (built) standing.push([x, z]);
        placed.push([x, z]);
    }
    if (grand) return { built: standing.length, cleared, streets: 0, infill: 0, halls: buildHalls(buckets, byId, zones, standing) };

    // As many again as the streets cleared, as far as there's room for them between the streets (there is for
    // most: fifteen of twenty-two), from a stream of their own, so nothing else in the city moves.
    const infill = createRandom(4247);
    let added = 0;
    for (let attempt = 0; attempt < 4000 && added < streets; attempt += 1) {
        const x = infill.range(-26, 8);
        const z = infill.range(-27, 27);
        if (!onLand(x, z, 2.2) || zones.some((inside) => inside(x, z))) continue;
        if (Math.hypot(x - gx, z - gz) < GARDEN_ROOM || streetGap(x, z) < 1.2) continue;
        if (standing.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.0)) continue;
        const westness = Math.min(1, Math.max(0, -x / 24));
        const height = infill.range(1.8, 3.4) + westness * infill.range(1.5, 4.5);
        const { built } = addHouse(buckets, infill, x, z, height, styles[Math.floor(infill() * styles.length)], infill);
        if (!built) continue;
        standing.push([x, z]);
        added += 1;
    }
    return { built: standing.length, cleared, streets, infill: added };
}

/** The signal-towers: twisted fins of a pod of monstrous, copper dolphins. */
function buildSignalTowers(buckets) {
    const towers = [[-7.6, -17.6, 7.5, 0.4], [-4.4, -20.4, 9.2, 1.9], [-11.0, -15.0, 6.2, -0.9]];
    for (const [x, z, height, turn] of towers) {
        const shape = new Shape();
        shape.moveTo(-1.3, 0);
        shape.quadraticCurveTo(-0.5, height * 0.55, 0.9, height);
        shape.quadraticCurveTo(0.6, height * 0.45, 1.4, 0);
        shape.closePath();
        const fin = new ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: false, curveSegments: 10 });
        fin.translate(0, 0, -0.17);
        const position = fin.attributes.position;
        for (let index = 0; index < position.count; index += 1) {
            const px = position.getX(index);
            const py = position.getY(index);
            const pz = position.getZ(index);
            const twist = (py / height) * 1.1;
            position.setXYZ(index, px * Math.cos(twist) - pz * Math.sin(twist), py, px * Math.sin(twist) + pz * Math.cos(twist));
        }
        fin.computeVertexNormals();
        pose(fin, { x, y: groundY(x, z) - 0.1, z, ry: turn });
        paintBy(fin, (vx, vy, vz, color) => {
            color.copy(COPPER).lerp(PATINA, Math.min(0.85, Math.max(0, noise2(vx * 1.3 + vy * 0.2, vz * 1.3 + vy * 0.9) * 1.2 - 0.25)));
        });
        buckets.add('copper', fin);
    }
}

// =============================================================================
// The named places
// =============================================================================

/** The sun-dock that unfurls from the golden wall onto the water. */
function buildSunDock({ buckets, place, mounts }) {
    const z = place.position[2];
    const face = wallX(z);
    const y = SEA_LEVEL + 0.34;
    mount(mounts, 'sun-dock/plaque', {
        position: new Vector3(face + 0.05, 2.5, z),
        normal: wallNormal(z),
        height: 0.62,
        maxWidth: 4.4,
        style: 'plaque',
    });
    buckets.add('gold', paint(pose(new CylinderGeometry(3.2, 3.2, 0.2, 28, 1, false, 0, Math.PI), { x: face + 0.05, y, z }), 0xecb450));
    const rays = 11;
    for (let index = 0; index < rays; index += 1) {
        const angle = -Math.PI / 2 + ((index + 0.5) / rays) * Math.PI;
        const length = index % 2 ? 5.6 : 4.4;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        buckets.add('gold', box(length, 0.1, 0.34, { x: face + (dx * length) / 2, y: y + 0.03, z: z + (dz * length) / 2, ry: -angle }, index % 2 ? 0xf2c262 : 0xd8983e));
        buckets.add('glow', ball(0.12, { x: face + dx * (length + 0.05), y: y + 0.12, z: z + dz * (length + 0.05) }, LAMP, 6, 4));
    }
}

/**
 * Three brick-red, steepled cafés at the head of the jetty, facing out like
 * actors: two to one side and one to the other, parted by an aisle down the
 * stage's middle, so the way from the jetty to the gate in the wall runs
 * straight between them.
 */
function buildCafes({ buckets, place, mounts, extras, animated, wanted }) {
    const z = place.position[2];
    // Their stage: a platform out from the wall, with an apron before the cafés (where the footlights stand)
    // wide enough to walk, running on past the last café's outer wall toward the sun-dock.
    for (const [z0, z1] of [[z - 8.2, z - 4.4], [z - 4.4, z - 1.0], [z - 1.0, z + 2.4], [z + 2.4, z + 5.8]]) {
        const zm = (z0 + z1) / 2;
        buckets.add('dimGold', box(5.2, 1.3, z1 - z0 + 0.12, { x: wallX(zm) + 2.5, y: -0.35, z: zm }, PAVE));
    }

    const jettyStart = wallX(z) + 3.6;
    const jettyEnd = 23.5;
    buckets.add('dimGold', box(jettyEnd - jettyStart, 0.14, 1.7, { x: (jettyStart + jettyEnd) / 2, y: 0.12, z }, PAVE_DARK));
    for (let x = jettyStart + 0.6; x < jettyEnd; x += 1.8) {
        for (const side of [-0.75, 0.75]) buckets.add('dimGold', cylinder(0.09, 0.09, 1.5, 5, { x, y: -0.5, z: z + side }, PAVE_DARK));
    }
    for (let x = jettyStart + 1.5; x < jettyEnd; x += 3.6) {
        buckets.add('steel', cylinder(0.05, 0.06, 1.7, 5, { x, y: 1.0, z: z + 0.78 }, STEEL_DARK));
        buckets.add('glow', ball(0.16, { x, y: 1.95, z: z + 0.78 }, LAMP, 8, 6));
    }

    const audience = new Vector3(21, 0, z);
    // [along the wall from the jetty's line, out from the wall]: the aisle between the second and third.
    const cafes = [[-6.3, 0], [-3.0, 0.35], [3.0, 0.35]];
    // "Angled to shine up every face, no café less equal": footlights before each, as on a stage, and the
    // warm wash they throw up its front. The wash is one additive sheet for all three.
    const washes = [];
    cafes.forEach(([dz, dx], index) => {
        const cz = z + dz;
        const cx = wallX(cz) + 1.75 + dx;
        const ry = Math.atan2(audience.x - cx, audience.z - cz);
        const brick = BRICK[index];
        const pieces = [
            bevelBox(2.2, 2.4, 2.1, { y: 1.2 }, brick),
            gable(2.4, 1.15, 2.3, { y: 2.4 }, BRICK_DARK),
            bevelBox(0.62, 1.0, 0.62, { y: 3.6, z: 0.55 }, brick, 0.04),
            cone(0.5, 2.3, 4, { y: 5.25, z: 0.55, ry: Math.PI / 4 }, BRICK_DARK),
            ball(0.12, { y: 6.5, z: 0.55 }, GOLDS[3], 8, 6),
            box(0.7, 1.3, 0.06, { y: 0.65, z: 1.07 }, SHADOW),
            box(2.5, 0.08, 0.7, { y: 1.62, z: 1.35, rx: 0.25 }, GOLDS[1]),
        ];
        const glows = [
            box(0.46, 0.6, 0.05, { x: -0.68, y: 1.25, z: 1.08 }, WINDOW),
            box(0.46, 0.6, 0.05, { x: 0.68, y: 1.25, z: 1.08 }, WINDOW),
            box(0.3, 0.4, 0.05, { y: 3.7, z: 0.88 }, WINDOW),
        ];
        for (const along of [-0.84, -0.28, 0.28, 0.84]) {
            pieces.push(box(0.2, 0.09, 0.14, { x: along, y: 0.05, z: 1.36 }, SHADOW));
            glows.push(box(0.14, 0.04, 0.04, { x: along, y: 0.08, z: 1.29 }, FOOTLIGHT));
        }
        const wash = new PlaneGeometry(2.2, 2.3, 1, 4);
        wash.translate(0, 1.15, 1.075);
        paintBy(wash, (wx, wy, wz, out) => out.setRGB(0.5, 0.3, 0.12).multiplyScalar(Math.pow(1 - Math.min(1, wy / 2.3), 1.6)));
        const at = { x: cx, y: 0.3, z: cz, ry };
        for (const piece of frame(pieces, at)) buckets.add('brick', piece);
        for (const piece of frame(glows, at)) buckets.add('glow', piece);
        washes.push(frame([wash], at)[0]);
        // A board above the awning, under the gable.
        mount(mounts, `jetty-cafes/cafe-${index + 1}`, {
            position: inFrame(0, 2.03, 1.09, at),
            normal: inFrame(0, 0, 1, { ry }),
            height: 0.44,
            maxWidth: 2.0,
            style: 'cafe',
        });
        // As an extra (extras.js): on the last café's outer wall, a shadow, with no one there to cast it.
        if (index === 2 && wanted.has('shadow')) {
            const figure = new PlaneGeometry(1.05, 2.1);
            figure.translate(0, 1.05, 0);
            const shade = new Mesh(figure, new MeshBasicMaterial({
                map: shadowTexture(),
                color: 0x1c0e1a,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            }));
            shade.name = 'cafe-shadow';
            shade.position.copy(inFrame(-1.1 - 0.015, 0.02, 0.2, at));
            shade.rotation.y = ry - Math.PI / 2;
            extras.push(shade);
            // It shifts its weight, now and then, as a body waiting would.
            animated.push((time) => {
                shade.rotation.z = Math.sin(time * 0.45) * 0.018 + Math.sin(time * 0.17 + 1.3) * 0.01;
            });
        }
    });
    const footlit = new Mesh(mergeGeometries(washes.map((wash) => wash.toNonIndexed()), false), new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        // Light added, not a surface: the fog would only add its own colour to it.
        fog: false,
    }));
    footlit.name = 'footlight-wash';
    extras.push(footlit);
    // Where the jetty ends, out over the water, on its boards (the walk's shadow waits there, walk.js).
    return { pierEnd: new Vector3(jettyEnd - 0.9, 0.19, z) };
}

/** A pennant string or ribbon, with per-vertex "sway" so the flags can flutter. */
class FlagCloth {
    constructor() {
        this.positions = [];
        this.normals = [];
        this.colors = [];
        this.sway = [];
    }

    triangle(a, b, c, colorA, colorB, colorC, swayA, swayB, swayC) {
        const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
        for (const [point, color, sway] of [[a, colorA, swayA], [b, colorB, swayB], [c, colorC, swayC]]) {
            this.positions.push(point.x, point.y, point.z);
            this.normals.push(normal.x, normal.y, normal.z);
            this.colors.push(color.r, color.g, color.b);
            this.sway.push(sway);
        }
    }

    geometry() {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
        geometry.setAttribute('sway', new Float32BufferAttribute(this.sway, 1));
        return geometry;
    }
}

function sagging(from, to, sag) {
    const middle = from.clone().lerp(to, 0.5);
    middle.y -= sag;
    return new CatmullRomCurve3([from, from.clone().lerp(middle, 0.55), middle, to.clone().lerp(middle, 0.55), to]);
}

function distanceToSegment(point, a, b) {
    const ab = new Vector3().subVectors(b, a);
    const t = Math.max(0, Math.min(1, new Vector3().subVectors(point, a).dot(ab) / ab.lengthSq()));
    return point.distanceTo(a.clone().addScaledVector(ab, t));
}

/**
 * Turquoise flags ribboning the skies above gangways, balconies and
 * crisscrossing tram-wires, frayed and blackened where they touch the lines.
 */
function buildFlags({ buckets, place, random, byId, mounts }) {
    const [cx, cy, cz] = place.position;
    const base = groundY(cx, cz);
    const poleTop = base + 6.9;
    // The four poles stand at the crossroads' corners, clear of the avenue and the high street.
    const poles = [[cx - 4.2, cz - 0.4], [cx + 2.0, cz - 0.6], [cx + 3.4, cz + 3.6], [cx - 3.2, cz + 3.2]];
    for (const [x, z] of poles) {
        buckets.add('steel', cylinder(0.08, 0.11, 7.1, 6, { x, y: groundY(x, z) + 3.5, z }, STEEL_DARK));
        buckets.add('steel', box(0.9, 0.08, 0.08, { x, y: poleTop, z, ry: 0.6 }, STEEL_DARK));
    }

    // A banner hung from a rod between the two seaward poles, looking out to the water.
    const [east1, east2] = [poles[1], poles[2]];
    const rodY = poleTop - 0.7;
    const span = new Vector3(east2[0] - east1[0], 0, east2[1] - east1[1]);
    const rodLength = span.length();
    span.normalize();
    const facing = new Vector3(span.z, 0, -span.x);
    const middle = new Vector3((east1[0] + east2[0]) / 2, rodY, (east1[1] + east2[1]) / 2);
    // (Rods, wires and strings are drawn but passable: the camera never bumps into a thread.)
    buckets.add('steel', cylinder(0.035, 0.035, rodLength, 5, {
        x: middle.x, y: rodY, z: middle.z, rx: Math.PI / 2, ry: Math.atan2(span.x, span.z),
    }, STEEL_DARK), { passable: true });
    mount(mounts, 'flags/banner', {
        position: middle.clone().add(new Vector3(0, -0.46, 0)).addScaledVector(facing, 0.03),
        normal: facing,
        height: 0.84,
        maxWidth: 3.6,
        style: 'banner',
        twoSided: true,
        sway: true,
    });
    const wires = [[0, 2], [1, 3], [0, 1], [2, 3], [3, 0]].map(([from, to]) => [
        new Vector3(poles[from][0], poleTop, poles[from][1]),
        new Vector3(poles[to][0], poleTop, poles[to][1]),
    ]);
    for (const [a, b] of wires) {
        const curve = sagging(a, b, 0.25);
        buckets.add('steel', paint(new TubeGeometry(curve, 16, 0.03, 3, false), STEEL_DARK), { passable: true });
    }

    const [gx, , gz] = byId.get('steel-garden').position;
    const anchorsHigh = [
        new Vector3(cx - 5.4, cy + 0.6, cz - 4.2), new Vector3(cx + 4.8, cy + 0.2, cz - 3.9),
        new Vector3(cx + 5.2, cy + 0.9, cz + 4.4), new Vector3(cx - 4.8, cy + 0.4, cz + 4.8),
        new Vector3(cx + 0.4, cy + 1.3, cz - 5.2), new Vector3(gx + 0.7, cy + 0.2, gz - 0.5),
        new Vector3(cx - 0.8, cy + 1.0, cz + 1.2),
    ];
    const strings = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [4, 5], [1, 6], [6, 3], [5, 3]];
    const cloth = new FlagCloth();
    const colour = new Color();
    const tip = new Color();

    strings.forEach(([from, to], stringIndex) => {
        const curve = sagging(anchorsHigh[from], anchorsHigh[to], random.range(0.7, 1.4));
        buckets.add('steel', paint(new TubeGeometry(curve, 20, 0.02, 3, false), STEEL_DARK), { passable: true });
        const length = curve.getLength();
        const ribbon = stringIndex % 3 === 2;
        if (ribbon) {
            const steps = Math.ceil(length / 0.35);
            let previous = null;
            for (let step = 0; step <= steps; step += 1) {
                const t = step / steps;
                const point = curve.getPointAt(t).add(new Vector3(0, -0.12, 0));
                const tangent = curve.getTangentAt(t);
                const side = new Vector3(-tangent.z, 0, tangent.x).normalize();
                const twist = t * Math.PI * 3;
                const across = side.multiplyScalar(0.19 * Math.cos(twist)).add(new Vector3(0, 0.19 * Math.sin(twist), 0));
                const left = point.clone().add(across);
                const right = point.clone().sub(across);
                const sway = Math.sin(Math.PI * t) * 0.9;
                const near = wires.some(([a, b]) => distanceToSegment(point, a, b) < 0.8);
                colour.set(TURQUOISES[stringIndex % TURQUOISES.length]);
                if (near) colour.lerp(FRAYED, 0.75);
                if (previous) {
                    cloth.triangle(previous.left, previous.right, left, previous.colour, previous.colour, colour, previous.sway, previous.sway, sway);
                    cloth.triangle(previous.right, right, left, previous.colour, colour, colour, previous.sway, sway, sway);
                }
                previous = { left, right, colour: colour.clone(), sway };
            }
            return;
        }
        const count = Math.floor(length / 0.55);
        for (let flag = 0; flag < count; flag += 1) {
            const t0 = (flag + 0.08) / count;
            const t1 = (flag + 0.72) / count;
            const a = curve.getPointAt(t0);
            const b = curve.getPointAt(t1);
            const middle = a.clone().lerp(b, 0.5);
            const near = wires.some(([p, q]) => distanceToSegment(middle, p, q) < 0.9);
            const drop = near ? random.range(0.26, 0.4) : random.range(0.62, 0.82);
            const point = middle.clone().add(new Vector3(random.range(-0.05, 0.05), -drop, random.range(-0.05, 0.05)));
            colour.set(TURQUOISES[(flag + stringIndex) % TURQUOISES.length]);
            tip.copy(colour);
            if (near) tip.lerp(FRAYED, 0.85);
            cloth.triangle(a, b, point, colour, colour, tip, 0, 0, 1);
        }
    });
    buckets.add('turquoise', cloth.geometry());
}

/**
 * The Steel Garden: bird statues overgrown with the moss the small dogs bring,
 * and one steel sycamore, caked bluish-green, writhing up into the flags.
 * Returns what a touch may find here (the sycamore, the statues, the dogs), each
 * with the garden's words that tell of it (Elm: things that look touchable
 * should answer).
 */
function buildSteelGarden({ buckets, place, random, mounts }) {
    const [cx, , cz] = place.position;
    const floorY = groundY(cx, cz) + 0.08;
    const touch = [];
    // The garden's name on a post at its seaward rim; the gift's word on the albatross's plinth.
    mount(mounts, 'steel-garden/plaque', {
        position: new Vector3(cx + 3.9, floorY + 0.95, cz + 1.2),
        normal: new Vector3(1, 0, 0),
        height: 0.5,
        maxWidth: 1.6,
        style: 'plaque',
        twoSided: true,
        stand: { kind: 'post', base: floorY + 0.1 },
    });
    mount(mounts, 'steel-garden/gift', {
        position: new Vector3(cx, floorY + 0.62, cz + 2.7 + 0.535),
        normal: new Vector3(0, 0, 1),
        height: 0.3,
        maxWidth: 0.75,
        style: 'plaque',
    });
    const mossy = (strength) => (x, y, z, color) => {
        color.set(STEEL).lerp(MOSS, Math.max(0, Math.min(1, (noise2(x * 1.6 + y * 0.5, z * 1.6 - y * 0.4) - 0.45) * strength)));
    };

    buckets.add('steel', paintBy(pose(new CylinderGeometry(4.3, 4.4, 0.24, 36), { x: cx, y: floorY, z: cz }), mossy(2.6)));
    buckets.add('steel', paint(pose(new TorusGeometry(4.3, 0.1, 4, 44), { x: cx, y: floorY + 0.14, z: cz, rx: Math.PI / 2 }), STEEL_DARK));

    const trunkPoints = [
        [0, 0, 0], [0.5, 1.8, 0.3], [-0.3, 3.6, 0.6], [0.4, 5.4, -0.2], [-0.1, 7.0, 0.3], [0.7, 8.6, -0.3],
    ].map(([x, y, z]) => new Vector3(cx + x, floorY + y, cz + z));
    buckets.add('steel', paintBy(taperedTube(trunkPoints, 0.46, 0.1, 0xffffff, 30, 7), mossy(3.4)));
    const sycamore = 'nbp-e3-steel-garden-2';
    for (const point of trunkPoints) touch.push({ kind: 'tree', center: point.clone(), radius: 0.75, fragment: sycamore });
    const branchStarts = [0.35, 0.5, 0.62, 0.74, 0.86];
    const trunk = new CatmullRomCurve3(trunkPoints);
    branchStarts.forEach((t, index) => {
        const start = trunk.getPointAt(t);
        const angle = index * 2.4 + 0.6;
        const reach = 1.6 + random() * 1.4;
        const end = start.clone().add(new Vector3(Math.cos(angle) * reach, 1.2 + random() * 1.3, Math.sin(angle) * reach));
        const middle = start.clone().lerp(end, 0.5).add(new Vector3(0, -0.3, 0));
        buckets.add('steel', paintBy(taperedTube([start, middle, end], 0.14, 0.04, 0xffffff, 10, 5), mossy(3.4)));
        const leafSize = 0.75 + random() * 0.45;
        const foliage = new IcosahedronGeometry(leafSize, 0);
        buckets.add('steel', paintBy(pose(foliage, { x: end.x, y: end.y + 0.3, z: end.z, s: 1 }), (x, y, z, color) => {
            color.set(BLUE_GREEN).offsetHSL(0, 0, (noise2(x * 3, z * 3) - 0.5) * 0.12);
        }));
        touch.push({ kind: 'tree', center: new Vector3(end.x, end.y + 0.3, end.z), radius: leafSize + 0.15, fragment: sycamore });
    });
    const crown = trunkPoints[trunkPoints.length - 1];
    buckets.add('steel', paintBy(pose(new IcosahedronGeometry(1.1, 0), { x: crown.x, y: crown.y + 0.4, z: crown.z }), (x, y, z, color) => {
        color.set(BLUE_GREEN);
    }));
    touch.push({ kind: 'tree', center: new Vector3(crown.x, crown.y + 0.4, crown.z), radius: 1.3, fragment: sycamore });

    const statues = [
        { kind: 'albatross', angle: Math.PI / 2 },
        { kind: 'ibis', angle: (7 * Math.PI) / 6 },
        { kind: 'seagull', angle: (11 * Math.PI) / 6 },
    ];
    // Steel parts are caked with moss where the noise says so; drips and mounds are moss outright.
    const caked = (geometry) => paintBy(geometry, mossy(1.8));
    for (const { kind, angle } of statues) {
        const x = cx + Math.cos(angle) * 2.7;
        const z = cz + Math.sin(angle) * 2.7;
        const facing = Math.atan2(Math.cos(angle), Math.sin(angle));
        const raised = kind === 'seagull' ? 0 : 0.95;
        const pieces = [];
        if (raised) pieces.push(box(1.0, raised, 1.0, { y: raised / 2 }, STEEL_DARK));
        const y = raised;
        if (kind === 'albatross') {
            pieces.push(caked(ball(0.55, { y: y + 0.7, sx: 1.9, sy: 0.9, sz: 0.85 }, STEEL)));
            pieces.push(caked(ball(0.3, { y: y + 0.95, z: 0.9 }, STEEL)));
            pieces.push(caked(cone(0.1, 0.5, 5, { y: y + 0.92, z: 1.35, rx: Math.PI / 2 }, STEEL)));
            for (const side of [-1, 1]) {
                pieces.push(caked(box(2.6, 0.08, 0.55, { x: side * 1.55, y: y + 0.95, z: -0.1, rz: side * 0.22 }, STEEL)));
                for (let drip = 0; drip < 3; drip += 1) {
                    pieces.push(paint(pose(new ConeGeometry(0.07, 0.34, 4), { x: side * (0.9 + drip * 0.7), y: y + 0.62 + drip * 0.15, z: -0.1, rx: Math.PI }), MOSS));
                }
            }
        } else if (kind === 'ibis') {
            pieces.push(caked(ball(0.45, { y: y + 1.05, sx: 1.4, sy: 0.9, sz: 0.85 }, STEEL)));
            for (const side of [-0.18, 0.18]) pieces.push(cylinder(0.04, 0.04, 0.7, 4, { x: side, y: y + 0.35 }, STEEL_DARK));
            pieces.push(caked(tube([new Vector3(0, y + 1.3, 0.35), new Vector3(0, y + 1.8, 0.55), new Vector3(0, y + 1.95, 0.85)], 0.09, STEEL, 10, 5)));
            pieces.push(caked(ball(0.16, { y: y + 1.98, z: 0.9 }, STEEL)));
            pieces.push(tube([new Vector3(0, y + 1.95, 1.0), new Vector3(0, y + 1.8, 1.45), new Vector3(0, y + 1.45, 1.75)], 0.035, STEEL, 10, 4));
            pieces.push(ball(0.08, { y: y + 1.42, z: 1.77 }, MOSS, 6, 4));
        } else {
            pieces.push(caked(ball(0.36, { y: 0.55, sx: 1.3, sy: 0.85, sz: 0.8 }, STEEL)));
            pieces.push(caked(ball(0.2, { y: 0.85, z: 0.38 }, STEEL)));
            pieces.push(cone(0.06, 0.26, 4, { y: 0.84, z: 0.64, rx: Math.PI / 2 }, STEEL));
            for (const side of [-1, 1]) pieces.push(caked(box(0.95, 0.06, 0.34, { x: side * 0.55, y: 0.95, rz: side * -0.7 }, STEEL)));
            pieces.push(ball(0.34, { y: 0.06, sx: 1.6, sy: 0.45, sz: 1.3 }, MOSS, 8, 5));
        }
        for (const piece of frame(pieces, { x, y: floorY + 0.1, z, ry: facing })) buckets.add('steel', piece);
        // (Algae dripped from the albatrosses' wings, the ibises' spear-like beaks, the seagulls' claws: the
        // garden's second passage names them.)
        const reach = kind === 'albatross' ? 1.9 : kind === 'ibis' ? 1.2 : 0.9;
        touch.push({ kind: 'statue', center: new Vector3(x, floorY + 0.1 + raised + 0.8, z), radius: reach, fragment: sycamore });
    }

    const dogs = [[7.6, -2.1, 1.2], [cx + 2.9, cz - 3.4, 2.6], [cx - 3.6, cz + 1.6, -0.8]];
    dogs.forEach(([x, z, turn], index) => {
        const coat = DOG_COATS[index % DOG_COATS.length];
        const pieces = [
            ball(0.24, { y: 0.34, sx: 1.5, sy: 0.9, sz: 0.9 }, coat),
            ball(0.16, { x: 0.36, y: 0.5 }, coat),
            cone(0.06, 0.14, 4, { x: 0.36, y: 0.68, z: 0.08 }, coat),
            cone(0.06, 0.14, 4, { x: 0.36, y: 0.68, z: -0.08 }, coat),
            ball(0.09, { x: 0.54, y: 0.44 }, MOSS, 6, 4),
        ];
        for (const [lx, lz] of [[0.2, 0.1], [0.2, -0.1], [-0.2, 0.1], [-0.2, -0.1]]) {
            pieces.push(cylinder(0.035, 0.035, 0.26, 4, { x: lx, y: 0.13, z: lz }, coat));
        }
        for (const piece of frame(pieces, { x, y: groundY(x, z), z, ry: turn })) buckets.add('brick', piece);
        touch.push({ kind: 'dog', center: new Vector3(x, groundY(x, z) + 0.4, z), radius: 0.6, fragment: 'nbp-e3-steel-garden-1' });
    });
    return { touch };
}

/** The golden bridgework: spires, bridges curling spire to spire, floating stairs. */
/**
 * "From the tenth storey, then across the sky-parade, the spire's verti-pool
 * leads her to the inner gate of the sky-grottos" (Numbers by Paint, Episode
 * 3): a sheath of water standing up round the tallest spire's upper reach, as
 * high as the gate, light rising through it. Water is no wall: the camera may
 * pass through it, and it hides nothing.
 */
function vertiPool(spire) {
    const from = spire.base + spire.height * 0.42;
    const to = spire.base + spire.height + 0.35;
    const girth = (y) => spire.girth((y - spire.base) / spire.height) + 0.3;
    // A tapering sheath: the spire's own taper, a hand's breadth off it.
    const geometry = new CylinderGeometry(girth(to), girth(from), to - from, 18, 12, true);
    geometry.translate(spire.x, (from + to) / 2, spire.z);
    const uniforms = { time: { value: 0 }, from: { value: from }, to: { value: to } };
    const material = new ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormalWorld;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vNormalWorld = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float time;
            uniform float from;
            uniform float to;
            varying vec3 vWorld;
            varying vec3 vNormalWorld;
            void main() {
                vec3 toEye = normalize(cameraPosition - vWorld);
                float edge = 1.0 - abs(dot(normalize(vNormalWorld), toEye));
                float around = atan(vWorld.z, vWorld.x);
                // Light rising through the water, in bands that waver and break as they climb.
                float waver = sin(around * 3.0 + vWorld.y * 1.3 + time * 0.9) * 0.3 + sin(around * 7.0 - vWorld.y * 0.6 + time * 1.4) * 0.12;
                float rising = fract(vWorld.y * 0.7 - time * 0.45 + waver);
                float band = smoothstep(0.0, 0.04, rising) * (1.0 - smoothstep(0.05, 0.12, rising));
                band *= 0.45 + 0.55 * smoothstep(-0.2, 0.6, sin(around * 2.0 + vWorld.y * 0.35 - time * 0.3));
                float fine = fract(vWorld.y * 2.3 - time * 0.8 - waver * 1.5);
                band += (1.0 - smoothstep(0.0, 0.06, abs(fine - 0.5))) * 0.25;
                vec3 water = vec3(0.24, 0.48, 0.8);
                vec3 color = water * (0.45 + 0.8 * edge) + vec3(0.85, 0.96, 1.0) * band * 0.85;
                // It rises out of nothing below, and brims at the top.
                float fade = smoothstep(from, from + 2.5, vWorld.y);
                float brim = smoothstep(to - 0.5, to, vWorld.y);
                float alpha = (0.1 + 0.34 * edge + band * 0.26 + brim * 0.28) * fade;
                gl_FragColor = vec4(color + brim * vec3(0.4, 0.6, 0.7), alpha);
            }
        `,
    });
    const object = new Mesh(geometry, material);
    object.name = 'verti-pool';
    object.renderOrder = 2;
    return { object, update: (time) => { uniforms.time.value = time; } };
}

function buildBridgework({ buckets, place, random, mounts, extras, animated, materials, wanted, grand }) {
    const [px, , pz] = place.position;
    // A plaque on two legs at the foot of the bridgework, looking down the avenue to the gate.
    const plaqueX = px + 3.3;
    const plaqueZ = pz + 0.8;
    const ground = groundY(plaqueX, plaqueZ);
    mount(mounts, 'bridge/plaque', {
        position: new Vector3(plaqueX, ground + 1.15, plaqueZ),
        normal: new Vector3(1, 0, 0),
        height: 0.6,
        maxWidth: 3.0,
        style: 'plaque',
        twoSided: true,
        stand: { kind: 'posts', base: ground - 0.05 },
    });
    // In the grand city the forest of spires is still drawn from the shared stream (so every place after it keeps
    // its look), but not built: two great trees of spires stand in its stead (buildGreatSpires).
    const into = grand ? UNBUILT : buckets;
    const spires = [
        [2.0, -4.5, 11], [0.0, 0.5, 13], [-1.5, -5.5, 15], [-3.0, -0.5, 17], [-0.5, 4.5, 12],
        [-5.0, -4.0, 19], [-6.0, 1.0, 21], [-4.0, 5.0, 15], [-7.5, -2.0, 23], [1.5, 5.8, 10], [-7.0, 4.2, 18],
    ].map(([dx, dz, height]) => upright(px + dx, pz + dz, height));

    for (const spire of spires) {
        const { x, z, base, height } = spire;
        const gold = GOLDS[Math.floor(random() * GOLDS.length)];
        into.add('gold', cylinder(0.34, 0.72, height, 8, { x, y: base + height / 2, z }, gold));
        into.add('gold', cone(0.42, 3.6, 8, { x, y: base + height + 1.8, z }, GOLDS[3]));
        for (const fraction of [0.45, 0.76]) {
            const radius = 0.72 - 0.38 * fraction + 0.3;
            into.add('gold', paint(pose(new TorusGeometry(radius, 0.07, 4, 18), { x, y: base + height * fraction, z, rx: Math.PI / 2 }), GOLDS[2]));
        }
        if (random() < 0.8) {
            into.add('glow', box(0.12, 0.5, 0.12, { x: x + 0.52, y: base + height * 0.6, z }, WINDOW));
        }
    }

    const at = (index, fraction) => {
        const spire = spires[index];
        return new Vector3(spire.x, spire.base + spire.height * fraction, spire.z);
    };
    const bridges = [
        [0, 1, 0.7, 0.6], [1, 3, 0.8, 0.55], [2, 3, 0.75, 0.7], [3, 5, 0.8, 0.65], [4, 1, 0.8, 0.5],
        [5, 8, 0.85, 0.7], [6, 8, 0.75, 0.8], [7, 6, 0.8, 0.6], [9, 4, 0.75, 0.7], [10, 6, 0.7, 0.75], [2, 5, 0.55, 0.45],
    ];
    for (const [from, to, fromFraction, toFraction] of bridges) {
        const a = at(from, fromFraction);
        const b = at(to, toFraction);
        const side = new Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(random.range(-1.1, 1.1));
        const lift = random.range(0.8, 2.0);
        const m1 = a.clone().lerp(b, 0.33).add(side).add(new Vector3(0, lift, 0));
        const m2 = a.clone().lerp(b, 0.66).sub(side).add(new Vector3(0, lift * 0.7, 0));
        into.add('gold', tube([a, m1, m2, b], 0.16, GOLDS[Math.floor(random() * GOLDS.length)], 26, 6));
    }

    const stairs = [[2, 5, 0.42], [4, 7, 0.55], [9, 0, 0.5]];
    for (const [from, to, fraction] of stairs) {
        const a = at(from, fraction);
        const b = at(to, fraction + 0.08);
        const steps = 7;
        const ry = Math.atan2(b.x - a.x, b.z - a.z);
        for (let step = 1; step < steps; step += 1) {
            if (step === 3 || step === 4) continue;
            const point = a.clone().lerp(b, step / steps);
            into.add('gold', box(0.9, 0.12, 0.5, { x: point.x, y: point.y, z: point.z, ry }, GOLDS[1]));
        }
    }
    const standing = grand ? buildGreatSpires(buckets, place) : spires;
    // The tallest upright spire's verti-pool, rising to the inner gate of the sky-grottos.
    const pool = vertiPool(standing.filter((spire) => !spire.leans).reduce((tallest, spire) => (spire.height > tallest.height ? spire : tallest)));
    extras.push(pool.object);
    animated.push(pool.update);

    // As an extra (extras.js): a few of the bridgework's countless bronze hums (by the upright spires).
    if (wanted.has('hums')) {
        const hums = createHums({ spires: standing.filter((spire) => !spire.leans), gradientMap: materials.gold.gradientMap });
        extras.push(hums.object);
        animated.push(hums.update);
    }
    return standing;
}

/**
 * An upright spire's measure: where it stands, its foot and height, and (for what winds round it, hangs from it
 * or hovers by it) a point on its axis and its shaft's girth, each at a share of its height. The forest's spires
 * taper from 0.72 at the foot to 0.34.
 */
function upright(x, z, height, foot = 0.72, top = 0.34) {
    const base = groundY(x, z) - 0.05;
    return {
        x,
        z,
        base,
        height,
        at: (fraction) => new Vector3(x, base + height * fraction, z),
        girth: (fraction) => foot + (top - foot) * Math.min(1, Math.max(0, fraction)),
    };
}

/** A shaft from `from` to `to` (a tapered cylinder, `foot` to `top` across the radius), in its own gold. */
function shaftBetween(from, to, foot, top, color, segments = 12) {
    const way = new Vector3().subVectors(to, from);
    const length = way.length();
    const geometry = new CylinderGeometry(top, foot, length, segments);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), way.normalize()));
    geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return paint(geometry, color);
}

/** A cone standing on `at`, pointing along `way` (a unit vector). */
function coneAlong(at, way, radius, height, color) {
    const geometry = new ConeGeometry(radius, height, 8);
    geometry.translate(0, height / 2, 0);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), way));
    geometry.translate(at.x, at.y, at.z);
    return paint(geometry, color);
}

/**
 * The grand city's spires (Elm: "perhaps the spires could be fewer too? maybe two or so extra large bases and more
 * that sort of branch off of those two further up"): two great golden trunks, one either side of the avenue, each
 * branching higher up into leaning spires (and one or two of those again), every tip a cone; rings at their
 * joints, lit windows up the trunks, and the golden bridges slung between the branches, the highest of them
 * passing by the bridgework's reading points. A stream of its own. Returns the trunks (upright, first) and the
 * branches (leaning), each with its measure.
 */
function buildGreatSpires(buckets, place) {
    const random = createRandom(4481);
    const [px, py, pz] = place.position;
    // (The taller keeps its tip under the sky-grottos' view of their first reading point.)
    const trunks = [
        upright(px - 2.7, pz - 5.2, 18.5, 1.75, 0.62),
        upright(px - 3.7, pz + 3.8, 15.5, 1.5, 0.55),
    ];
    const branches = [];
    const golds = (index) => GOLDS[index % GOLDS.length];
    trunks.forEach((trunk, which) => {
        const foot = new Vector3(trunk.x, trunk.base, trunk.z);
        const head = trunk.at(1);
        buckets.add('gold', shaftBetween(foot, head, trunk.girth(0), trunk.girth(1), golds(which + 1), 16));
        // A foot that flares into the paving, as a great tree's does.
        buckets.add('gold', cylinder(trunk.girth(0) * 1.02, trunk.girth(0) * 1.38, 1.1, 16, { x: trunk.x, y: trunk.base + 0.55, z: trunk.z }, golds(which + 2)));
        buckets.add('gold', cone(trunk.girth(1) * 1.3, 4.6, 10, { x: trunk.x, y: head.y + 2.3, z: trunk.z }, GOLDS[3]));
        for (const fraction of [0.2, 0.46, 0.72, 0.9]) {
            const at = trunk.at(fraction);
            buckets.add('gold', paint(pose(new TorusGeometry(trunk.girth(fraction) + 0.12, 0.11, 5, 24), { x: at.x, y: at.y, z: at.z, rx: Math.PI / 2 }), GOLDS[2]));
        }
        for (let window = 0; window < 7; window += 1) {
            const fraction = 0.12 + window * 0.11;
            const angle = window * 2.1 + which;
            const at = trunk.at(fraction);
            const out = trunk.girth(fraction) + 0.01;
            buckets.add('glow', box(0.16, 0.5, 0.16, { x: at.x + Math.cos(angle) * out, y: at.y, z: at.z + Math.sin(angle) * out, ry: -angle }, random() < 0.3 ? WINDOW_LOW : WINDOW));
        }

        // The branches, as a candelabra's: each springs from the trunk's face at a share of its height, reaches
        // out a little way, and rises from there as a spire of its own; the first of each reaches toward the
        // bridgework's middle (where its reading points are). Now and then one branches again.
        const toward = Math.atan2(pz - trunk.z, px - trunk.x);
        const count = which === 0 ? 4 : 3;
        for (let index = 0; index < count; index += 1) {
            const fraction = 0.32 + index * (0.44 / count) + random.range(-0.03, 0.03);
            const azimuth = index === 0 ? toward : toward + index * ((Math.PI * 2) / count) + random.range(-0.35, 0.35);
            const outward = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
            const from = trunk.at(fraction).addScaledVector(outward, trunk.girth(fraction) * 0.6);
            const arm = (index === 0 ? 3.0 : random.range(2.0, 3.2)) * (which === 0 ? 1 : 0.9);
            const rise = (index === 0 ? 6.8 : random.range(4.6, 7.4)) * (which === 0 ? 1 : 0.88);
            const foot = trunk.girth(fraction) * 0.46;
            const branch = branchOf(buckets, from, outward, arm, rise, foot, 0.26, golds(which + index), random);
            branches.push({ ...branch, tree: which });
            if (index > 0 && random() < 0.55) {
                const split = branch.at(random.range(0.3, 0.5));
                const turnTo = azimuth + (random() < 0.5 ? 1 : -1) * random.range(0.7, 1.3);
                const out = new Vector3(Math.cos(turnTo), 0, Math.sin(turnTo));
                const twig = branchOf(buckets, split.addScaledVector(out, branch.girth(0.4) * 0.6), out, arm * 0.55, rise * 0.55, 0.22, 0.16, golds(which + index + 1), random);
                branches.push({ ...twig, tree: which });
            }
        }
    });

    // The golden bridges, slung between the branches: within each tree, and across from one to the other (the
    // highest passing by the middle of the bridgework, where its reading points are).
    const middle = new Vector3(px, py, pz);
    const pairs = [];
    for (let a = 0; a < branches.length; a += 1) {
        for (let b = a + 1; b < branches.length; b += 1) pairs.push([a, b]);
    }
    pairs.sort(([a1, b1], [a2, b2]) => branches[a1].at(0.6).distanceTo(branches[b1].at(0.6)) - branches[a2].at(0.6).distanceTo(branches[b2].at(0.6)));
    let slung = 0;
    for (const [a, b] of pairs) {
        if (slung >= 7) break;
        const start = branches[a].at(random.range(0.45, 0.75));
        const end = branches[b].at(random.range(0.45, 0.75));
        const across = start.distanceTo(end);
        if (across < 2.5 || across > 11) continue;
        const lift = random.range(0.6, 1.6);
        const side = new Vector3(-(end.z - start.z), 0, end.x - start.x).normalize().multiplyScalar(random.range(-0.9, 0.9));
        const m1 = start.clone().lerp(end, 0.33).add(side).add(new Vector3(0, lift, 0));
        const m2 = start.clone().lerp(end, 0.66).sub(side).add(new Vector3(0, lift * 0.7, 0));
        buckets.add('gold', tube([start, m1, m2, end], 0.16, GOLDS[Math.floor(random() * GOLDS.length)], 26, 6));
        slung += 1;
    }
    // The high bridge across the middle: from the tall tree's first branch to the other's, by the reading points.
    const reachA = branches.find((branch) => branch.tree === 0)?.at(0.78) ?? trunks[0].at(0.85);
    const reachB = branches.find((branch) => branch.tree === 1)?.at(0.78) ?? trunks[1].at(0.85);
    buckets.add('gold', tube([reachA, reachA.clone().lerp(middle, 0.6).add(new Vector3(0, 0.8, 0)), middle.clone().lerp(reachB, 0.4).add(new Vector3(0, 0.5, 0)), reachB], 0.18, GOLDS[1], 30, 6));
    return [...trunks, ...branches];
}

/**
 * One branch of a great spire, as a candelabra's: an arm reaching out from `from` along `outward` (rising a
 * little as it goes), a collar at its elbow, and from there a spire rising (leaning a touch outward), with a lit
 * window and its cone. Returns the risen spire's measure (from the elbow up).
 */
function branchOf(buckets, from, outward, arm, rise, foot, top, color, random) {
    const elbow = from.clone().addScaledVector(outward, arm).add(new Vector3(0, arm * 0.45, 0));
    const middle = foot * 0.82;
    buckets.add('gold', shaftBetween(from, elbow, foot, middle, color, 10));
    const collar = new TorusGeometry(middle + 0.1, 0.09, 4, 16);
    collar.rotateX(Math.PI / 2);
    collar.translate(elbow.x, elbow.y, elbow.z);
    buckets.add('gold', paint(collar, GOLDS[2]));
    buckets.add('gold', paint(pose(new SphereGeometry(middle * 1.05, 10, 6), { x: elbow.x, y: elbow.y, z: elbow.z }), color));
    const way = new Vector3(outward.x * 0.1, 1, outward.z * 0.1).normalize();
    const tip = elbow.clone().addScaledVector(way, rise);
    buckets.add('gold', shaftBetween(elbow, tip, middle, top, color, 10));
    buckets.add('gold', coneAlong(tip, way, top * 1.35, 2.4, GOLDS[3]));
    if (random() < 0.75) {
        const lit = elbow.clone().lerp(tip, 0.45);
        buckets.add('glow', box(0.12, 0.34, 0.12, { x: lit.x + outward.x * (middle * 0.9), y: lit.y, z: lit.z + outward.z * (middle * 0.9), ry: -Math.atan2(outward.z, outward.x) }, WINDOW));
    }
    return {
        leans: true,
        from: elbow,
        to: tip,
        x: tip.x,
        z: tip.z,
        base: elbow.y,
        height: tip.y - elbow.y,
        at: (fraction) => elbow.clone().lerp(tip, fraction),
        girth: (fraction) => middle + (top - middle) * Math.min(1, Math.max(0, fraction)),
    };
}

/**
 * The sky-grottos: the hanging mountain with its cold white arches, a thin
 * yellow door buried in its far pits, and the foyer-rock that crosses to it.
 */
function buildSkyGrottos({ buckets, place, random, extras, animated, materials, mounts, wanted, still }) {
    const [px, py, pz] = place.position;
    const centre = new Vector3(px - 6.8, py + 3.8, pz - 2.4);
    const roughen = (geometry, amount, seed) => {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        const position = flat.attributes.position;
        for (let index = 0; index < position.count; index += 1) {
            const x = position.getX(index);
            const y = position.getY(index);
            const z = position.getZ(index);
            const n = noise2(x * 0.7 + seed, z * 0.7 + y * 0.3) - 0.5;
            position.setXYZ(index, x * (1 + n * amount), y + n * amount * 1.2, z * (1 + n * amount));
        }
        flat.computeVertexNormals();
        return flat;
    };
    // The mountain is the island's kin, a floating rock: the "rock" material draws its striae, and
    // this only tints them, paler up top and deepening toward the point it hangs from.
    const rock = (x, y, z, color) => color.set(0xfff4ee).lerp(new Color(0x857a96), Math.min(1, Math.max(0, (centre.y - y) / 11)));

    const body = roughen(new IcosahedronGeometry(5.6, 1), 0.35, 1.3);
    pose(body, { x: centre.x, y: centre.y, z: centre.z, sx: 1.2, sy: 0.5, sz: 1.0 });
    buckets.add('rock', paintBy(body, rock));
    const under = roughen(new ConeGeometry(5.4, 10, 9, 3), 0.3, 4.2);
    pose(under, { x: centre.x, y: centre.y - 6.4, z: centre.z, rx: Math.PI });
    buckets.add('rock', paintBy(under, rock));
    for (const [dx, dz, height, radius] of [[-0.8, -0.6, 7.5, 3.0], [2.4, 1.4, 5.2, 2.2], [-3.0, 1.6, 4.6, 2.0]]) {
        const peak = roughen(new ConeGeometry(radius, height, 7, 2), 0.25, dx + dz);
        pose(peak, { x: centre.x + dx, y: centre.y + 2.2 + height / 2, z: centre.z + dz });
        buckets.add('rock', paintBy(peak, rock));
    }

    const faceX = centre.x + 6.3;
    for (const [dz, dy] of [[-2.2, 0.3], [0.2, 1.1], [2.4, 0.1]]) {
        buckets.add('stone', paint(pose(new CylinderGeometry(0.95, 0.95, 0.3, 12, 1, false, 0, Math.PI), { x: faceX - 0.35, y: py + 1.2 + dy, z: pz + dz, rz: Math.PI / 2, ry: Math.PI / 2 }), SHADOW));
    }
    buckets.add('stone', box(2.6, 0.5, 7.2, { x: faceX + 0.2, y: py - 0.55, z: pz }, 0x5e4c50));
    for (const dz of [-2.2, 0.2, 2.4]) {
        buckets.add('arch', paint(pose(new TorusGeometry(1.05, 0.17, 6, 18, Math.PI), { x: faceX + 0.4, y: py - 0.3, z: pz + dz, ry: Math.PI / 2 }), WHITE_ARCH));
        for (const side of [-1.05, 1.05]) {
            buckets.add('arch', cylinder(0.17, 0.2, 1.3, 6, { x: faceX + 0.4, y: py - 0.95 + 0.65, z: pz + dz + side }, WHITE_ARCH));
        }
    }

    const doorAt = new Vector3(centre.x + 1.8, centre.y - 0.9, centre.z + 5.7);
    buckets.add('stone', box(1.2, 2.1, 0.7, { x: doorAt.x, y: doorAt.y, z: doorAt.z - 0.25 }, SHADOW));
    // As an extra (extras.js), the door can open: a leaf on its hinge, the knob's roots with it, light beyond.
    const hinge = doorCanOpen(wanted) ? new Group() : null;
    if (hinge) {
        hinge.name = 'yellow-door';
        // (The leaf stands a hair forward of where the door is drawn otherwise, so the light fits behind it.)
        hinge.position.set(doorAt.x - 0.21, doorAt.y - 0.1, doorAt.z + 0.15);
        buckets.add('glow', box(0.42, 1.5, 0.02, { x: doorAt.x, y: doorAt.y - 0.1, z: doorAt.z + 0.11 }, BEYOND));
        hinge.add(new Mesh(box(0.42, 1.5, 0.06, { x: 0.21 }, DOOR), materials.glow));
    } else {
        buckets.add('glow', box(0.42, 1.5, 0.06, { x: doorAt.x, y: doorAt.y - 0.1, z: doorAt.z + 0.12 }, DOOR));
    }
    mount(mounts, 'sky-grottos/door', {
        position: new Vector3(doorAt.x, doorAt.y + 1.3, doorAt.z + 0.16),
        normal: new Vector3(0, 0, 1),
        height: 0.34,
        maxWidth: 0.9,
        style: 'door',
    });
    const knobRoots = [];
    for (let root = 0; root < 5; root += 1) {
        const start = new Vector3(doorAt.x + 0.16, doorAt.y - 0.1, doorAt.z + 0.16);
        const bend = start.clone().add(new Vector3(random.range(0.1, 0.5), random.range(-0.5, 0.4), random.range(0.1, 0.4)));
        const end = bend.clone().add(new Vector3(random.range(0.2, 0.7), random.range(-0.9, 0.2), random.range(-0.2, 0.4)));
        if (hinge) knobRoots.push(taperedTube([start, bend, end].map((point) => point.sub(hinge.position)), 0.05, 0.015, 0x4a3426, 8, 4));
        else buckets.add('stone', taperedTube([start, bend, end], 0.05, 0.015, 0x4a3426, 8, 4));
    }
    if (hinge) {
        hinge.add(new Mesh(mergeGeometries(knobRoots.map((root) => root.index ? root.toNonIndexed() : root), false), materials.stone));
        extras.push(hinge);
        // It opens slowly, a little after the visitor arrives (at once, where motion is reduced).
        const open = doorOpen(wanted);
        animated.push((time) => {
            const opening = !open ? 0 : still ? 1 : Math.min(1, Math.max(0, (time - 2.5) / 6));
            hinge.rotation.y = -1.25 * opening * opening * (3 - 2 * opening);
        });
    }

    // The foyer-rock hovers between the spire-tops and the mountain, entryway shining.
    const foyer = new Group();
    foyer.name = 'foyer-rock';
    const foyerRock = roughen(new DodecahedronGeometry(1.25, 0), 0.3, 7.7);
    pose(foyerRock, { sy: 0.8 });
    paintBy(foyerRock, (x, y, z, color) => color.set(0x6a585c));
    foyer.add(new Mesh(foyerRock, materials.stone));
    const entry = paint(pose(new TorusGeometry(0.55, 0.1, 5, 14, Math.PI), { x: 0.9, y: 0.1, ry: Math.PI / 2 }), WHITE_ARCH);
    foyer.add(new Mesh(entry, materials.arch));
    const shine = paint(pose(new CylinderGeometry(0.5, 0.5, 0.06, 14, 1, false, 0, Math.PI), { x: 1.02, y: 0.1, rz: Math.PI / 2, ry: Math.PI / 2 }), LAMP);
    foyer.add(new Mesh(shine, materials.glow));
    const foyerHome = new Vector3(px + 1.8, py + 0.2, pz - 1.3);
    foyer.position.copy(foyerHome);
    extras.push(foyer);
    animated.push((time) => {
        foyer.position.y = foyerHome.y + Math.sin(time * 0.6) * 0.35;
        foyer.rotation.y = Math.sin(time * 0.23) * 0.25;
    });
}

/** Cassandra's lookout: a balcony on the sea-wall above the breaking sea. */
function buildSeaWall({ buckets, place, mounts }) {
    const z = place.position[2];
    const face = wallX(z);
    const plaqueZ = z + 2.1;
    mount(mounts, 'sea-wall/plaque', {
        position: new Vector3(wallX(plaqueZ) + 0.09, 1.25, plaqueZ),
        normal: wallNormal(plaqueZ),
        height: 0.6,
        maxWidth: 1.8,
        style: 'plaque',
    });
    buckets.add('gold', paint(pose(new CylinderGeometry(1.25, 1.25, 0.18, 18, 1, false, 0, Math.PI), { x: face + 0.02, y: 2.5, z }), GOLDS[3]));
    buckets.add('gold', paint(pose(new TorusGeometry(1.2, 0.05, 4, 18, Math.PI), { x: face, y: 3.1, z, rx: -Math.PI / 2, rz: -Math.PI / 2 }), GOLDS[0]));
    for (let post = 0; post <= 4; post += 1) {
        const angle = -Math.PI / 2 + (post / 4) * Math.PI;
        buckets.add('gold', cylinder(0.04, 0.04, 0.6, 4, { x: face + Math.cos(angle) * 1.2, y: 2.8, z: z + Math.sin(angle) * 1.2 }, GOLDS[2]));
    }
    buckets.add('gold', cone(0.9, 1.4, 4, { x: face + 0.6, y: 1.8, z, rx: Math.PI, ry: Math.PI / 4 }, GOLDS[1]));
}

/** The one building in Elysicester that isn't gold: all glass, lit cold inside. */
function buildGasStation({ buckets, place, mounts }) {
    const [x, , z] = place.position;
    const y = groundY(x, z);
    mount(mounts, 'gas-station/board', {
        position: new Vector3(x + 3.25, y + 3.42, z + 0.5),
        normal: new Vector3(1, 0, 0),
        height: 0.6,
        maxWidth: 3.0,
        style: 'board',
        twoSided: true,
    });
    buckets.add('dimGold', groundStrip(x - 2.9, z - 7, x - 2.9, z + 7, 2.0, PAVE));
    buckets.add('dimGold', groundStrip(x + 2.9, z - 7, x + 2.9, z + 7, 2.0, PAVE));
    buckets.add('glass', box(3.4, 2.4, 2.2, { x, y: y + 1.2, z }, 0xcfeaf2));
    buckets.add('glass', box(5.8, 0.14, 3.6, { x: x + 0.4, y: y + 3.0, z: z + 0.5 }, 0xcfeaf2));
    for (const [dx, dz] of [[-2.3, -1.2], [3.1, -1.2], [-2.3, 2.2], [3.1, 2.2]]) {
        buckets.add('glass', cylinder(0.11, 0.11, 3.0, 6, { x: x + dx, y: y + 1.5, z: z + dz }, 0xcfeaf2));
    }
    for (const side of [-0.55, 0.55]) {
        buckets.add('steel', box(2.6, 0.42, 0.5, { x, y: y + 0.21, z: z + side }, PLASTIC));
        for (const along of [-0.8, 0.3]) buckets.add('glow', box(0.3, 0.02, 0.22, { x: x + along, y: y + 0.44, z: z + side }, COOL));
    }
    for (let scroll = 0; scroll < 5; scroll += 1) {
        buckets.add('steel', box(0.28, 0.9, 0.03, { x: x - 1.1 + scroll * 0.55, y: y + 1.5, z: z - 1.02 }, PLASTIC));
    }
    buckets.add('glow', box(2.8, 0.04, 1.6, { x, y: y + 2.34, z }, COOL));
    for (const dx of [1.4, 2.5]) {
        buckets.add('steel', box(0.42, 1.1, 0.32, { x: x + dx, y: y + 0.55, z: z + 1.9 }, PLASTIC));
        buckets.add('glow', box(0.3, 0.28, 0.02, { x: x + dx, y: y + 0.8, z: z + 2.07 }, COOL));
    }
}

/** The edge: a star fence along the rim with a gap to drive through, and the world glitching. */
function buildEdge({ buckets, place, random, mounts }) {
    const [px, , pz] = place.position;
    const centre = Math.atan2(pz, px);
    // A crooked marker in the water by the gap in the fence, facing back toward the city.
    const markAngle = centre + 0.017;
    const markRadius = rimRadius(markAngle) - 1.3;
    mount(mounts, 'edge/marker', {
        position: new Vector3(Math.cos(markAngle) * markRadius, SEA_LEVEL + 1.3, Math.sin(markAngle) * markRadius),
        normal: new Vector3(-Math.cos(markAngle), 0, -Math.sin(markAngle)),
        height: 0.42,
        maxWidth: 1.3,
        style: 'marker',
        twoSided: true,
        roll: -0.12,
        stand: { kind: 'post', base: SEA_LEVEL - 0.5 },
    });
    const starShape = new Shape();
    for (let point = 0; point < 12; point += 1) {
        const radius = point % 2 ? 0.1 : 0.28;
        const angle = (point / 12) * Math.PI * 2;
        const [sx, sy] = [Math.sin(angle) * radius, Math.cos(angle) * radius];
        if (point === 0) starShape.moveTo(sx, sy);
        else starShape.lineTo(sx, sy);
    }
    starShape.closePath();
    for (let post = -5; post <= 5; post += 1) {
        if (post === 0 || post === 1) continue;
        const angle = centre + post * 0.034;
        const radius = rimRadius(angle) - 0.55;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        buckets.add('steel', cylinder(0.05, 0.06, 1.7, 5, { x, y: SEA_LEVEL + 0.45, z }, STEEL_DARK));
        const star = new ExtrudeGeometry(starShape, { depth: 0.05, bevelEnabled: false });
        pose(star, { x, y: SEA_LEVEL + 1.45, z, ry: -angle + Math.PI / 2 });
        buckets.add('glow', paint(star, STAR));
    }
    for (let shard = 0; shard < 9; shard += 1) {
        const angle = centre + random.range(-0.16, 0.16);
        const radius = rimRadius(angle) + random.range(0.2, 2.6);
        const size = random.range(0.18, 0.55);
        buckets.add('glow', box(size, size, size, {
            x: Math.cos(angle) * radius,
            y: random.range(-1.8, 1.6),
            z: Math.sin(angle) * radius,
            rx: random() * 3,
            ry: random() * 3,
        }, GLITCH[shard % 2]));
    }
}

// =============================================================================
// From the text, about the city: seaweed at the shore, vines, the amethyst chute
// =============================================================================

const WEED = [0x2f4a36, 0x3c5a3a, 0x46623c, 0x2a4440];
const WEED_TIP = new Color(0x6e9c62);
const FOAM = 0xe6e8f6;
const VINE = 0x3a6236;
const LEAVES = [0x4e7c46, 0x5c8c4a, 0x3f6e40];
const AMETHYST = 0xb07cf0;
const BRONZE_BIN = 0x6a4428;

/** Give a piece a "sway" of its own: 0 where it holds fast, `amount` at the far end of `along` (0 to 1 per vertex). */
function swaying(geometry, along, amount) {
    const position = geometry.attributes.position;
    const sway = new Float32Array(position.count);
    for (let index = 0; index < position.count; index += 1) {
        sway[index] = Math.min(1, Math.max(0, along(position.getX(index), position.getY(index), position.getZ(index)))) * amount;
    }
    geometry.setAttribute('sway', new Float32BufferAttribute(sway, 1));
    return geometry;
}

/** A piece that doesn't sway at all (every piece in a swaying bucket needs the attribute). */
function holdsFast(geometry) {
    return swaying(geometry, () => 0, 0);
}

/**
 * The seaweed that "bubbled from the shoreline" (Numbers by Paint, Episode 3,
 * "turquoise ribbons dangling from the sky as seaweed bubbled from the
 * shoreline"): mats of it at the wall's foot, riding the swell, strands of it
 * drifting out on the water, a frond or two standing up, and the bubbles it
 * brings up. Kept clear of the cafés' platform and the sun-dock. A stream of
 * its own, so nothing else in the city moves.
 */
function buildShoreWeed(buckets) {
    const random = createRandom(8080);
    const [north, south] = wallEnds();
    const clear = (z) => !((z > -11.6 && z < 2.8) || (z > 1.4 && z < 8.8));
    for (let cluster = 0; cluster < 24; cluster += 1) {
        const z = random.range(north + 1.2, south - 1.2);
        const x = wallX(z) + random.range(0.08, 0.3);
        const color = WEED[Math.floor(random() * WEED.length)];
        const lumps = 2 + Math.floor(random() * 3);
        const strands = 5 + Math.floor(random() * 5);
        const fronds = Math.floor(random() * 3);
        if (!clear(z)) continue;
        // Small clumps, half under the water at the wall's foot.
        for (let lump = 0; lump < lumps; lump += 1) {
            const radius = random.range(0.09, 0.22);
            const clump = pose(new IcosahedronGeometry(radius, 0), {
                x: x + random.range(0, 0.35), y: SEA_LEVEL - radius * 0.2, z: z + random.range(-0.35, 0.35), sy: 0.5, ry: random() * Math.PI,
            });
            buckets.add('weed', holdsFast(paint(clump, color)), { passable: true });
        }
        // Strands fanned out on the water from the clumps, each a little wavy, waving more the further it drifts.
        for (let strand = 0; strand < strands; strand += 1) {
            const reach = random.range(0.45, 1.6);
            const angle = random.range(-1.25, 1.25);
            const wave = random.range(2, 4.5);
            const strip = new PlaneGeometry(0.06, reach, 1, 10);
            strip.rotateX(-Math.PI / 2);
            strip.translate(0, 0, reach / 2);
            const position = strip.attributes.position;
            for (let index = 0; index < position.count; index += 1) {
                const along = position.getZ(index) / reach;
                position.setX(index, position.getX(index) + Math.sin(along * wave * Math.PI) * 0.07 * along);
            }
            swaying(strip, (sx, sy, sz) => sz / reach, 0.9);
            pose(strip, { x: x + 0.05, y: SEA_LEVEL + 0.04, z: z + random.range(-0.3, 0.3), ry: Math.PI / 2 + angle });
            buckets.add('weed', paintBy(strip.toNonIndexed(), (px, py, pz, out) => out.set(color).lerp(WEED_TIP, 0.3)), { passable: true });
        }
        // A frond or two standing up, bent at the middle.
        for (let frond = 0; frond < fronds; frond += 1) {
            const height = random.range(0.35, 0.8);
            const lean = random.range(0.25, 0.6);
            const blade = new PlaneGeometry(0.1, height, 1, 6);
            blade.translate(0, height / 2, 0);
            const position = blade.attributes.position;
            for (let index = 0; index < position.count; index += 1) {
                const up = position.getY(index) / height;
                position.setX(index, position.getX(index) + up * up * lean);
            }
            swaying(blade, (bx, by) => by / height, 0.7);
            pose(blade, { x: x + random.range(0, 0.25), y: SEA_LEVEL - 0.05, z: z + random.range(-0.35, 0.35), ry: random() * Math.PI * 2 });
            buckets.add('weed', paintBy(blade.toNonIndexed(), (bx, by, bz, out) => out.set(color).lerp(WEED_TIP, Math.min(1, Math.max(0, (by - SEA_LEVEL) / height)))), { passable: true });
        }
        // The bubbles it brings up: beads of foam on the water about it.
        for (let bead = 0; bead < 5; bead += 1) {
            const ball = new SphereGeometry(random.range(0.025, 0.06), 5, 3);
            pose(ball, { x: x + random.range(0, 0.9), y: SEA_LEVEL + 0.06, z: z + random.range(-0.7, 0.7) });
            buckets.add('weed', holdsFast(paint(ball.toNonIndexed(), FOAM)), { passable: true });
        }
    }
}

/**
 * The "vine-ridden plazas" at the bridgework's foot (Numbers by Paint, Episode
 * 3): vines winding up the lower reaches of most of the spires, leafed as they
 * go. A stream of its own.
 */
function buildVines(buckets, spires) {
    const random = createRandom(6161);
    for (const spire of spires) {
        // (Vines climb the upright spires only.)
        if (spire.leans) continue;
        const skip = random() < 0.3;
        const climb = spire.height * random.range(0.18, 0.4);
        const turns = random.range(1.1, 2.3);
        const phase = random() * Math.PI * 2;
        if (skip) continue;
        const points = [];
        for (let step = 0; step <= 28; step += 1) {
            const t = step / 28;
            const y = spire.base + 0.08 + t * climb;
            const radius = spire.girth((y - spire.base) / spire.height) + 0.06;
            const angle = phase + t * turns * Math.PI * 2;
            points.push(new Vector3(spire.x + Math.cos(angle) * radius, y, spire.z + Math.sin(angle) * radius));
        }
        buckets.add('weed', holdsFast(taperedTube(points, 0.075, 0.025, VINE, 56, 4).toNonIndexed()), { passable: true });
        for (let leaf = 0; leaf < 12; leaf += 1) {
            const at = points[Math.min(points.length - 1, Math.floor(random() * points.length))];
            const outward = Math.atan2(at.z - spire.z, at.x - spire.x);
            const blade = new ConeGeometry(0.1, 0.26, 3);
            blade.translate(0, 0.13, 0);
            swaying(blade, (lx, ly) => ly / 0.26, 0.25);
            pose(blade, { x: at.x, y: at.y, z: at.z, ry: -outward, rz: -Math.PI / 2 + random.range(-0.5, 0.5), sz: 0.3 });
            buckets.add('weed', paint(blade.toNonIndexed(), LEAVES[Math.floor(random() * LEAVES.length)]), { passable: true });
        }
    }
}

/**
 * "…vine-ridden plazas, a mess of golden ribbons, to mounting, golden
 * bridges" (Numbers by Paint, Episode 3): gold ribbons slung between near
 * spires of the bridgework, sagging and turning over as they go. Drawn from
 * both sides; the camera may pass through them. A stream of its own.
 */
function buildRibbons(buckets, spires) {
    const random = createRandom(7070);
    for (let ribbon = 0; ribbon < 9; ribbon += 1) {
        const a = spires[Math.floor(random() * spires.length)];
        const b = spires[Math.floor(random() * spires.length)];
        const fa = random.range(0.25, 0.7);
        const fb = random.range(0.25, 0.7);
        const turns = random.range(0.75, 2.25);
        const sag = random.range(0.5, 1.4);
        const width = random.range(0.16, 0.26);
        const color = new Color(GOLDS[Math.floor(random() * GOLDS.length)]).offsetHSL(0, 0.04, 0.02);
        if (a === b) continue;
        const start = a.at(fa);
        const end = b.at(fb);
        const across = Math.hypot(end.x - start.x, end.z - start.z);
        if (across > 8 || across < 2) continue;
        // From the face of one spire to the face of the other, not their hearts.
        const flat = new Vector3(end.x - start.x, 0, end.z - start.z).normalize();
        start.addScaledVector(flat, a.girth(fa));
        end.addScaledVector(flat, -b.girth(fb));
        const segments = 30;
        const positions = [];
        const rim = [];
        const point = new Vector3();
        const ahead = new Vector3();
        const tangent = new Vector3();
        const side = new Vector3();
        const up = new Vector3(0, 1, 0);
        for (let step = 0; step <= segments; step += 1) {
            const t = step / segments;
            point.lerpVectors(start, end, t).y -= sag * 4 * t * (1 - t);
            const next = Math.min(1, t + 1 / segments);
            ahead.lerpVectors(start, end, next).y -= sag * 4 * next * (1 - next);
            tangent.subVectors(ahead, point);
            if (tangent.lengthSq() < 1e-8) tangent.copy(flat);
            tangent.normalize();
            side.crossVectors(tangent, up).normalize().applyAxisAngle(tangent, turns * Math.PI * t);
            rim.push([point.clone().addScaledVector(side, width / 2), point.clone().addScaledVector(side, -width / 2)]);
        }
        for (let step = 0; step < segments; step += 1) {
            const [a0, a1] = rim[step];
            const [b0, b1] = rim[step + 1];
            // Both faces, so the ribbon shows whichever way it has turned.
            for (const [p, q, r] of [[a0, b0, a1], [a1, b0, b1], [a0, a1, b0], [a1, b1, b0]]) positions.push(...p.toArray(), ...q.toArray(), ...r.toArray());
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        buckets.add('gold', paint(geometry, color), { passable: true });
    }
}

/**
 * The "amethystine trash chute" she tosses her coffee down, on her way up the
 * golden bridges (Numbers by Paint, Episode 3): from a landing on the first
 * spire, curling down to a bronze bin by the plaza.
 */
function buildChute(buckets, spires) {
    const spire = spires[0];
    // (Laid out for a spire of the forest's girth; a greater one pushes it out by the difference.)
    const high = spire.girth(0.55) - 0.51;
    const low = spire.girth(0) - 0.72;
    const top = new Vector3(spire.x + 0.95 + high, spire.base + spire.height * 0.55, spire.z - 0.35);
    const floor = groundY(spire.x + 1.9 + low, spire.z - 1.9);
    const points = [
        top,
        new Vector3(spire.x + 1.7 + high, top.y - 1.4, spire.z - 0.7),
        new Vector3(spire.x + 2.25 + (high + low) / 2, top.y - 3.4, spire.z - 1.35),
        new Vector3(spire.x + 1.95 + low, floor + 1.0, spire.z - 1.85),
    ];
    buckets.add('amethyst', tube(points, 0.23, AMETHYST, 36, 6));
    // Its mouth at the landing, and the bin it empties into.
    buckets.add('amethyst', paint(pose(new CylinderGeometry(0.42, 0.24, 0.5, 6, 1, true), { x: top.x, y: top.y + 0.2, z: top.z }), AMETHYST));
    buckets.add('gold', box(0.9, 0.12, 0.7, { x: top.x - 0.1, y: top.y - 0.08, z: top.z + 0.05 }, GOLDS[1]));
    buckets.add('steel', cylinder(0.42, 0.36, 0.8, 10, { x: spire.x + 1.95 + low, y: floor + 0.4, z: spire.z - 1.85 }, BRONZE_BIN));
}

// =============================================================================
// Main Code
// =============================================================================

const BUILDERS = {
    'sun-dock': buildSunDock,
    'jetty-cafes': buildCafes,
    flags: buildFlags,
    'steel-garden': buildSteelGarden,
    bridge: buildBridgework,
    'sky-grottos': buildSkyGrottos,
    'sea-wall': buildSeaWall,
    'gas-station': buildGasStation,
    edge: buildEdge,
};

/**
 * Build the city into the buckets, letting a frame through between steps.
 * @param {() => Promise<void>} [pause] - yields to the browser between steps
 * @param {Set<string>} [wanted] - the optional extras asked for (extras.js); none, unless asked
 * @param {boolean} [still] - motion is reduced: what moves, arrives
 * @returns {Promise<{ anchors: Map<string, Vector3>, mounts: Map<string, object>, extras: object[], houses: { built: number, cleared: number }, update: (time: number) => void }>}
 */
export async function buildPlaces(buckets, placeData, materials, pause = async () => {}, wanted = new Set(), still = false) {
    const random = createRandom(239);
    const byId = new Map(placeData.places.map((place) => [place.id, place]));
    const extras = [];
    const animated = [];
    const mounts = new Map();

    buildWall(buckets, mounts);
    buildPavements(buckets);
    await pause();
    // The grand city: far fewer buildings, much larger (Elm's idea, and her choice); ?city=small keeps the city of
    // small houses and its forest of spires.
    const grand = new URLSearchParams(globalThis.location?.search ?? '').get('city') !== 'small';
    const houses = buildHouses(buckets, random, byId, { grand });
    await pause();
    buildSignalTowers(buckets);

    const anchors = new Map();
    const built = new Map();
    for (const place of placeData.places.filter((entry) => entry.tier === 1)) {
        const builder = BUILDERS[place.id];
        if (builder) {
            built.set(place.id, builder({ buckets, place, random, byId, extras, animated, materials, mounts, wanted, still, grand }));
            await pause();
        }
        anchors.set(place.id, new Vector3().fromArray(place.position));
    }

    // Details from the text about the city, each on a random stream of its own (so nothing above moves).
    buildShoreWeed(buckets);
    const spires = built.get('bridge');
    if (spires) {
        buildVines(buckets, spires);
        buildRibbons(buckets, spires);
        buildChute(buckets, spires);
    }

    return {
        anchors,
        mounts,
        extras,
        houses,
        /** The end of the jetty, on its boards: where the walk's shadow waits (walk.js). */
        pierEnd: built.get('jetty-cafes')?.pierEnd ?? null,
        /** What a touch may find, and the words it opens: [{ kind, center, radius, fragment }] (touch.js). */
        touch: [...built.values()].flatMap((result) => result?.touch ?? []),
        update(time) {
            for (const step of animated) step(time);
        },
    };
}
