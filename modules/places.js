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
 * Each shape answers a line in Numbers by Paint (Episodes 1 and 3) or
 * President Oedipus, or something Elm asked for: last of all, the dressing
 * (buildDressing), the market, lamps, benches, plants and the park with its
 * fountain that make it a lived-in city.
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
    LatheGeometry,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    OctahedronGeometry,
    PlaneGeometry,
    Quaternion,
    Raycaster,
    RepeatWrapping,
    RingGeometry,
    ShaderMaterial,
    Shape,
    SphereGeometry,
    TorusGeometry,
    TubeGeometry,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BAND_CELLS, CROWD_CELLS, bandAtlas, cassandraGeometry, crowdAtlas, filigreePanel, greekGeometry } from './ball.js';
import { paleFace, shadowFigure, starCeiling } from './cassandra.js';
import { doorCanOpen, doorOpen, shadowTexture } from './extras.js';
import { createHums } from './hums.js';
import { silhouetteAtlas } from './silhouette.js';
import { trialOn } from './trials.js';
import { WALKER_GLSL } from './walk.js';
import {
    Buckets,
    GOLD_SHOWS,
    SEA_LEVEL,
    alsoBeforeCompile,
    breathe,
    createRandom,
    groundY,
    light,
    noise2,
    onLand,
    chamferedBox,
    paint,
    paintBy,
    pose,
    reflective,
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

/**
 * The bright things a touch may find (a trial, trials.js; bright.js answers them): how fast the light runs along a
 * string of lights from the bulb touched (metres a second), and how a lamp is listed. Each is { kind, center, radius,
 * fragment: null, lights: [{ at, color, size, after?, kind? }] }.
 */
const BRIGHT_RUNS = 3.4;

/** A lamp, touched, brightens: its one light swells and settles. */
function brightLamp(at, radius, size, color = LAMP) {
    return { kind: 'lamp', center: at.clone(), radius, fragment: null, lights: [{ at: at.clone(), color, size }] };
}

const GATE_Z = -3.2;
/**
 * The north end of the cafés' platform (buildCafes), where the steps up to the sea-wall's balcony begin
 * (buildSeaWall); and, under the balcony, how far it stops short, and from where along it.
 */
const PLATFORM_NORTH = -12.16;
const PLATFORM_NOTCH_Z = -11.7;
const PLATFORM_NOTCH_X = 9.4;
/** The quay's seaward edge (the cafés' platform, from end to end), and where the steps up to the balcony begin. */
const QUAY_EAST = 14.6;
const QUAY_STEPS_WEST = 12.6;
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
async function buildHalls(buckets, byId, zones, standing) {
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
        halls.push({ x, z, reach, width, depth, height, turn, base: groundY(x, z) - 0.05 });
        await breathe();
    }
    return halls;
}

async function buildHouses(buckets, random, byId, { grand = false } = {}) {
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
        await breathe();
    }
    if (grand) {
        const halls = await buildHalls(buckets, byId, zones, standing);
        return { built: standing.length, cleared, streets: 0, infill: 0, halls: halls.length, hallSpecs: halls };
    }

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
        await breathe();
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

/**
 * The sun-dock's half-sun: its radius, its rays (long and short by turns), and how high its light lies on the water.
 * (Grown a little, so the quay's steps come down onto it: Elm's ask.)
 */
const SUN_DISC = 3.6;
const SUN_RAYS = 11;
const SUN_LONG = 6.3;
const SUN_SHORT = 4.95;
/** The quay's steps down to it: how deep each of their four treads is. */
const QUAY_TREAD = 0.35;
/** The quay's south edge and its steps, once built (buildQuay): the sun-dock's light gives no floor under them. */
let quayLayout = null;
const SUN_LIGHT_Y = SEA_LEVEL + 0.42;
/** Where a body stands on it (the old gold disc's top), and how far in from its rim. */
const SUN_FLOOR_Y = SEA_LEVEL + 0.44;
const SUN_KEEP = 0.25;
/** How long after the city arrives it begins to unfurl, and how long it takes (seconds). */
const SUN_UNFURL_FROM = 1.2;
const SUN_UNFURL_FOR = 5;

const sunVertexShader = /* glsl */ `
    varying vec3 vWorld;
    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const sunFragmentShader = /* glsl */ `
    uniform float time;
    uniform float unfurl;
    uniform vec2 centre;
    uniform vec3 core;
    uniform vec3 rim;
    uniform vec3 rayColor;
    varying vec3 vWorld;
    ${WALKER_GLSL}
    float sunHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float sunNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(sunHash(i), sunHash(i + vec2(1.0, 0.0)), u.x), mix(sunHash(i + vec2(0.0, 1.0)), sunHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    void main() {
        vec2 p = vWorld.xz - centre;
        float r = length(p);
        // It unfurls from the wall: first the half-sun grows out over the water, then its rays reach from it.
        float disc = ${SUN_DISC.toFixed(2)} * smoothstep(0.0, 0.45, unfurl);
        float reach = smoothstep(0.3, 1.0, unfurl);
        // Light moving as light on water does.
        float shimmer = 0.72 + 0.56 * sunNoise(vWorld.xz * 1.6 + vec2(time * 0.35, -time * 0.27));
        // The half-sun: a soft pool of light, a brighter rim, and faint rings going out from the wall.
        float pool = 1.0 - smoothstep(disc * 0.7, disc * 1.02, r);
        float heart = exp(-r * r / (disc * disc * 0.18 + 0.01)) * step(0.05, disc);
        float edge = exp(-pow((r - disc * 0.97) / 0.11, 2.0)) * step(0.05, disc);
        float rings = (0.5 + 0.5 * sin(r * 6.5 - time * 1.2)) * (1.0 - smoothstep(0.0, disc + 0.01, r));
        vec3 color = core * (0.42 * pool + 0.3 * heart + 0.16 * rings) + rim * 0.6 * edge;
        // The rays, each drawing back and reaching out a little, as if it were still unfurling, and at each
        // one's tip a mote of light.
        float rays = 0.0;
        float motes = 0.0;
        for (int k = 0; k < ${SUN_RAYS}; k++) {
            float fk = float(k);
            float angle = -1.5707963 + (fk + 0.5) * ${(Math.PI / SUN_RAYS).toFixed(6)};
            vec2 way = vec2(cos(angle), sin(angle));
            float longest = (mod(fk, 2.0) > 0.5 ? ${SUN_LONG.toFixed(2)} : ${SUN_SHORT.toFixed(2)}) * (0.95 + 0.05 * sin(time * 0.5 + fk * 1.7));
            float tip = mix(disc, longest, reach);
            float along = dot(p, way);
            float across = abs(dot(p, vec2(-way.y, way.x)));
            float beam = exp(-pow(across / (0.12 + 0.03 * max(along, 0.0)), 2.0));
            float fade = smoothstep(disc * 0.75, disc * 1.0, along) * (1.0 - smoothstep(mix(disc, tip, 0.62), tip, along));
            rays += beam * fade * (1.0 - 0.3 * along / ${SUN_LONG.toFixed(2)});
            vec2 end = p - way * tip;
            motes += exp(-dot(end, end) / 0.012) * reach;
        }
        color += rayColor * (1.1 * rays + 0.9 * motes);
        color *= shimmer;
        // Where the walk's shadow stands on it, its silhouette is cut from the light.
        color *= 1.0 - 0.92 * walkerShade(vWorld);
        // Fading a little into the distance, as the city does into the dusk.
        color *= 1.0 - smoothstep(70.0, 160.0, distance(cameraPosition, vWorld));
        gl_FragColor = vec4(color, 1.0);
    }
`;

/**
 * The sun-dock that unfurls from the golden wall onto the water ("A sun-dock
 * unfurled from the wall and grew upon the water's surface, awaiting his
 * arrival"). Not a thing of metal but of light (Elm: "more ethereal"): a
 * half-sun lying on the sea, its rays reaching out over the water and drawing
 * back a little, its light moving as light on water does, and at the tip of
 * each ray a mote of light. It unfurls as the city arrives (under reduced
 * motion, it's there already). It draws no ink (it writes no depth); the
 * glow round lights gathers at its rim and its motes. The walk's shadow can
 * step out onto it, and its silhouette is cut from the light. Returns its floor
 * for walking (walk.js), and the light itself, for the stage to give the
 * walk's shadow to.
 */
function buildSunDock({ place, mounts, extras, animated, still }) {
    const z = place.position[2];
    const face = wallX(z);
    mount(mounts, 'sun-dock/plaque', {
        position: new Vector3(face + 0.05, 2.5, z),
        normal: wallNormal(z),
        height: 0.62,
        maxWidth: 4.4,
        style: 'plaque',
    });
    const cx = face + 0.05;
    const geometry = new CircleGeometry(SUN_LONG + 0.5, 72, -Math.PI / 2, Math.PI);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(cx, SUN_LIGHT_Y, z);
    const uniforms = {
        time: { value: 0 },
        unfurl: { value: still ? 1 : 0 },
        centre: { value: new Vector2(cx, z) },
        core: { value: new Color(0xffc46a).multiplyScalar(1.7) },
        rim: { value: new Color(0xffd98e).multiplyScalar(1.7) },
        rayColor: { value: new Color(0xffb05a).multiplyScalar(1.6) },
        // (Until the stage gives it the walk's, there's no shadow on it.)
        walkerDepth: { value: null },
        walkerMatrix: { value: new Matrix4() },
        walkerOn: { value: 0 },
        walkerTexel: { value: new Vector2(1, 1) },
        walkerReach: { value: 0 },
    };
    const light = new Mesh(geometry, new ShaderMaterial({
        uniforms,
        vertexShader: sunVertexShader,
        fragmentShader: sunFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    }));
    light.name = 'sun-dock-light';
    light.renderOrder = 2;
    extras.push(light);
    let unfurled = still ? 1 : 0;
    animated.push((time) => {
        uniforms.time.value = time;
        if (still) return;
        const t = MathUtils.clamp((time - SUN_UNFURL_FROM) / SUN_UNFURL_FOR, 0, 1);
        unfurled = t * t * (3 - 2 * t);
        uniforms.unfurl.value = unfurled;
    });
    // A body may stand on the half-sun (as far as it has unfurled), short of its rim and clear of the wall; not under
    // the quay, nor under its steps above the lowest two (which come down under the light, so a body walks off them
    // onto it, and back up them from it); nor where the promontory's sand rises out of the water through it.
    const sandy = trialOn('hostel');
    const floorAt = (x, zz) => {
        const radius = SUN_DISC * MathUtils.smoothstep(unfurled, 0, 0.45) - SUN_KEEP;
        if (radius <= 0 || x < wallX(zz) + 0.2 || Math.hypot(x - cx, zz - z) > radius) return null;
        if (quayLayout) {
            const { south, stairs, landing } = quayLayout;
            const onStairs = x > stairs.x0 - 0.1 && x < stairs.x1 + 0.1;
            if (zz < (onStairs ? landing : south + 0.12)) return null;
        }
        if (sandy) {
            const sand = sandHeight(x, zz);
            if (sand !== null && sand > SUN_FLOOR_Y - 0.04) return null;
        }
        return SUN_FLOOR_Y;
    };
    // (For the water's share of the walk's shadow: where the light lies, it takes none of it. walk.js, sea.js.)
    const disc = { x: cx, z, y: SUN_FLOOR_Y, radius: () => Math.max(0, SUN_DISC * MathUtils.smoothstep(unfurled, 0, 0.45)) };
    return { floor: { floorAt, disc }, light };
}

/**
 * The three cafés were built alike but not the same, and have aged apart (Elm: "differences developed over
 * time as well as smaller original differences in how they were built"). As built: Cafi (coffee), squat and
 * broad-roofed, with a chimney for its roasting; Cafiarmaí (café), the tallest, its spire slimmer and higher, a
 * lantern kept lit in its tower; Sî (tea), a little narrower, steep-roofed, its tower crowned with a dome. As
 * they've aged (how much soot, damp, bleaching, moss, mending and salt): Cafi's bricks sooted from its chimney,
 * a patch of its side mended in newer brick; Cafiarmaí's north faces and lower roof green with moss; Sî, nearest
 * the open sea and the sun-dock, bleached by the low sun and salted along its foot. (Their footlights are the same for all:
 * no café less equal.)
 */
const CAFE_BUILDS = [
    {
        width: 2.2, height: 2.25, roof: 1.0, tower: 0.7, towerTall: 0.85, spire: 2.0, crown: 'spire', chimney: true, lantern: false,
        wear: { soot: 0.85, damp: 0.35, bleach: 0.15, moss: 0.1, mend: 1, salt: 0.2, seed: 1.7 },
    },
    {
        width: 2.2, height: 2.6, roof: 1.2, tower: 0.58, towerTall: 1.1, spire: 2.7, crown: 'spire', chimney: false, lantern: true,
        wear: { soot: 0.25, damp: 0.4, bleach: 0.3, moss: 0.9, mend: 0, salt: 0.3, seed: 4.3 },
    },
    {
        width: 2.05, height: 2.4, roof: 1.35, tower: 0.6, towerTall: 0.95, spire: 0, crown: 'dome', chimney: false, lantern: false,
        wear: { soot: 0.1, damp: 0.55, bleach: 0.8, moss: 0.25, mend: 0, salt: 0.85, seed: 7.9 },
    },
];

const CAFES_WORN_GLSL = /* glsl */ `
    uniform vec4 cafeAt[3];
    uniform vec4 cafeWear[3];
    uniform vec4 cafeMore[3];
    varying vec3 vWornWorld;
    varying vec3 vWornNormal;
    float wornHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
    float wornNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(wornHash(i), wornHash(i + vec2(1.0, 0.0)), u.x), mix(wornHash(i + vec2(0.0, 1.0)), wornHash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // A café's bricks as the years have left them (see CAFE_BUILDS): at: x, z, turn, eaves height;
    // wear: soot, damp, bleach, moss; more: mend, salt, seed.
    vec3 cafesWorn(vec3 albedo) {
        for (int k = 0; k < 3; k++) {
            vec2 d = vWornWorld.xz - cafeAt[k].xy;
            if (dot(d, d) > 7.0) continue;
            float c = cos(cafeAt[k].z);
            float s = sin(cafeAt[k].z);
            vec2 lp = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
            vec3 n = normalize(vWornNormal);
            vec2 nl = vec2(n.x * c - n.z * s, n.x * s + n.z * c);
            float upright = 1.0 - smoothstep(0.35, 0.6, abs(n.y));
            float h = vWornWorld.y - 0.3;
            float eaves = cafeAt[k].w;
            vec4 wear = cafeWear[k];
            vec4 more = cafeMore[k];
            float seed = more.z;
            vec3 base = albedo;
            // Along the face it's on (streaks and lines run along a wall).
            float along = abs(nl.x) > abs(nl.y) ? lp.y : lp.x;
            // A brush's mottling, warmer and cooler, over every face.
            float m = 0.6 * wornNoise(vec2(along * 1.4 + seed, h * 1.1)) + 0.4 * wornNoise(vec2(along * 4.3 - seed, h * 3.7));
            albedo *= 0.88 + 0.24 * m;
            albedo *= mix(vec3(0.95, 1.0, 1.06), vec3(1.07, 0.98, 0.9), m);
            // Soot: streaks running down from the eaves, a darkening gathered under them, and on the roof.
            float streaks = smoothstep(0.5, 0.85, wornNoise(vec2(along * 5.5 + seed * 3.1, h * 0.45 + seed)));
            float walls = upright * step(h, eaves + 0.05);
            float below = smoothstep(eaves * 0.2, eaves, h);
            albedo *= 1.0 - wear.x * walls * (0.62 * streaks * below + 0.36 * smoothstep(eaves - 0.7, eaves, h));
            albedo *= 1.0 - wear.x * (1.0 - upright) * (0.25 + 0.4 * wornNoise(vWornWorld.xz * 3.0 + seed));
            // Damp rising from the platform, and just above it a tide line of salt.
            float rise = 0.55 + 0.3 * wornNoise(vec2(along * 1.7 + seed, seed));
            albedo *= 1.0 - wear.y * walls * 0.42 * (1.0 - smoothstep(rise * 0.4, rise, h));
            float tide = exp(-pow((h - rise - 0.04) / 0.05, 2.0)) * (0.55 + 0.45 * wornNoise(vec2(along * 6.0, seed)));
            albedo = mix(albedo, vec3(0.9, 0.87, 0.8), more.y * walls * 0.6 * tide);
            // Bleached where the low sun off the sea strikes (the faces toward it): paler, and still warm.
            albedo = mix(albedo, albedo * 0.62 + vec3(0.3, 0.2, 0.15), wear.z * max(0.0, n.x) * upright * 0.5);
            // Moss on the faces turned north, out of the low sun: in fine tufts at the foot of the walls, and
            // along the roof's eaves.
            float north = max(0.0, -n.z);
            float tufts = 0.6 * wornNoise(vec2(along * 5.2 + seed, h * 4.0)) + 0.4 * wornNoise(vec2(along * 11.0 - seed, h * 9.0));
            float creep = smoothstep(0.52, 0.72, tufts) * (1.0 - smoothstep(0.15, 1.1, h));
            float eavesMoss = (1.0 - upright) * smoothstep(0.55, 0.72, wornNoise(vWornWorld.xz * 4.5 + seed)) * (1.0 - smoothstep(eaves, eaves + 0.35, h));
            vec3 green = vec3(0.26, 0.32, 0.18) * (0.8 + 0.4 * m);
            albedo = mix(albedo, green, wear.w * clamp(north * upright * creep + eavesMoss * (0.3 + 0.7 * north), 0.0, 0.85));
            // A mended patch in its side: newer brick, clean of the soot, its edges stepping course by course.
            float side = smoothstep(0.85, 0.95, nl.x) * walls;
            float course = floor((h - 1.2) / 0.11);
            float jag = 0.1 * (wornHash(vec2(course, seed)) - 0.5);
            float mended = step(abs(lp.y - 0.15 - jag * 0.5), 0.3 + jag) * step(abs(h - 1.2), 0.25);
            albedo = mix(albedo, base * vec3(1.22, 1.06, 0.95) * (0.94 + 0.12 * m), more.x * side * mended);
        }
        return albedo;
    }
`;

/**
 * The cafés' bricks, as they've aged: laid on the brick material's colour where each café stands (so nothing
 * else of brick is touched), before the light falls on it, as a painter weathers a wall (CAFES_WORN_GLSL).
 * @param {import('three').Material} material - the brick material
 * @param {{ x: number, z: number, ry: number, eaves: number, wear: object }[]} worn - each café, as built
 */
function weatherCafes(material, worn) {
    const at = worn.map(({ x, z, ry, eaves }) => new Vector4(x, z, ry, eaves));
    const wear = worn.map(({ wear: w }) => new Vector4(w.soot, w.damp, w.bleach, w.moss));
    const more = worn.map(({ wear: w }) => new Vector4(w.mend, w.salt, w.seed, 0));
    alsoBeforeCompile(material, 'cafes-worn', (shader) => {
        shader.uniforms.cafeAt = { value: at };
        shader.uniforms.cafeWear = { value: wear };
        shader.uniforms.cafeMore = { value: more };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWornWorld;\nvarying vec3 vWornNormal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWornWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWornNormal = normalize(mat3(modelMatrix) * objectNormal);');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${CAFES_WORN_GLSL}`)
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = cafesWorn(diffuseColor.rgb);');
    });
}

/**
 * The cafés' platform dressed as a quay (Elm: "something about this corner… the blocky edge of the dock… feels
 * very underbaked"): along its seaward edges a coping of bevelled stones, jointed, standing a little proud of
 * the paving and overhanging the face; on the face, pilasters, and timber fenders between them; at the water, a
 * dark wet band with weed hanging in it and drifting out from it; iron bollards along the edge, a rope looped
 * between two by the jetty, a lamp at the far corner; and there, by the sun-dock, a flight of steps going down
 * into the water. A stream of its own.
 * @param {object} quay - the quay's north and south ends (z), and the jetty's line (z)
 */
function buildQuay(buckets, { north, south, jetty }) {
    const random = createRandom(9091);
    const east = QUAY_EAST;
    const COPING = 0xc9a25e;
    const PILASTER = 0x9b7744;
    const WET = 0x3a3322;
    const ROPE = 0x5a4030;
    // The steps down: at the south end, coming down onto the sun-dock's light (Elm: "the side rail step doesn't go
    // down to the sun dock ... maybe we could expand the sun dock platform a bit so the steps connect to it?").
    const stairs = { x0: east - 3.05, x1: east - 1.95 };
    quayLayout = { south, stairs, landing: south + QUAY_TREAD * 2 };
    const onJetty = (zz) => Math.abs(zz - jetty) < 1.05;
    // The seaward edges, as runs of coping: the east face its whole length, the south face from the wall to the
    // corner (but for the stairs), the north face from the balcony's steps to the corner.
    const runs = [
        { from: new Vector3(east, 0, north), to: new Vector3(east, 0, south), out: new Vector3(1, 0, 0) },
        { from: new Vector3(wallX(south) + 0.1, 0, south), to: new Vector3(stairs.x0, 0, south), out: new Vector3(0, 0, 1) },
        { from: new Vector3(stairs.x1, 0, south), to: new Vector3(east, 0, south), out: new Vector3(0, 0, 1) },
        { from: new Vector3(QUAY_STEPS_WEST, 0, north), to: new Vector3(east, 0, north), out: new Vector3(0, 0, -1) },
    ];
    for (const { from, to, out } of runs) {
        const length = from.distanceTo(to);
        const along = new Vector3().subVectors(to, from).normalize();
        const ry = Math.atan2(along.x, along.z);
        const stones = Math.max(1, Math.round(length / 0.92));
        const each = length / stones;
        for (let stone = 0; stone < stones; stone += 1) {
            const mid = from.clone().addScaledVector(along, each * (stone + 0.5));
            if (out.x > 0 && onJetty(mid.z)) continue;
            const lift = random.range(-0.012, 0.012);
            const shade = new Color(COPING).offsetHSL(random.range(-0.01, 0.01), random.range(-0.05, 0.03), random.range(-0.05, 0.04));
            // (The run's direction as the stone's length; it overhangs the face a little, a hair short of its
            // neighbours, so the joints between stones show.)
            // (0.36 across, overhanging the face by 0.08: its middle is 0.1 in from the edge.)
            buckets.add('dimGold', bevelBox(0.36, 0.13, each - 0.035, {
                x: mid.x - out.x * 0.1, y: 0.3 + 0.045 + lift, z: mid.z - out.z * 0.1, ry,
            }, shade, 0.035));
        }
        // Pilasters down the face, now and then, and the fenders between them (timber, worn dark).
        const bays = Math.max(1, Math.round(length / 1.9));
        for (let bay = 0; bay <= bays; bay += 1) {
            const at = from.clone().addScaledVector(along, (length * bay) / bays);
            if (out.x > 0 && onJetty(at.z)) continue;
            buckets.add('dimGold', box(0.28, 1.22, 0.1, { x: at.x + out.x * 0.05, y: -0.39, z: at.z + out.z * 0.05, ry }, PILASTER));
            if (bay < bays) {
                const fender = from.clone().addScaledVector(along, (length * (bay + 0.5)) / bays);
                if (!(out.x > 0 && onJetty(fender.z))) {
                    buckets.add('dimGold', box(0.13, 1.25, 0.12, { x: fender.x + out.x * 0.07, y: -0.4, z: fender.z + out.z * 0.07, ry }, PAVE_DARK), { passable: true });
                }
            }
        }
        // The wet band at the waterline, and in front of the pilasters.
        const bands = Math.max(1, Math.ceil(length / 2.4));
        for (let band = 0; band < bands; band += 1) {
            const mid = from.clone().addScaledVector(along, (length * (band + 0.5)) / bands);
            if (out.x > 0 && onJetty(mid.z)) continue;
            buckets.add('dimGold', box(0.02, 0.3, length / bands + 0.01, { x: mid.x + out.x * 0.011, y: SEA_LEVEL + 0.11, z: mid.z + out.z * 0.011, ry }, WET), { passable: true });
        }
    }
    // The steps down onto the sun-dock's light, their treads worn (the lowest two under the light, as the water is),
    // and an iron rail beside them.
    const rise = 0.2;
    for (let step = 0; step < 4; step += 1) {
        const top = 0.3 - rise * (step + 1) + 0.01;
        const zz = south + QUAY_TREAD * (step + 0.5);
        buckets.add('dimGold', box(stairs.x1 - stairs.x0, top + 1.0, 0.36, { x: (stairs.x0 + stairs.x1) / 2, y: (top - 1.0) / 2, z: zz }, step % 2 ? PAVE : new Color(PAVE).multiplyScalar(0.94)));
    }
    // (Their cheeks are passable: a narrow ledge to be caught on, else, beside the treads, with only the water past it.)
    for (const x of [stairs.x0 - 0.06, stairs.x1 + 0.06]) {
        buckets.add('dimGold', box(0.12, 1.36, 1.42, { x, y: -0.32, z: south + 0.7 }, PILASTER), { passable: true });
    }
    // The rail runs down beside the steps, a hand's height above them, its posts standing on the treads.
    const railX = stairs.x1 - 0.1;
    const treadAt = (zz) => 0.3 - rise * Math.min(4, Math.max(0, Math.ceil((zz - south) / QUAY_TREAD))) + 0.01;
    const railFrom = new Vector3(railX, 0.3 + 0.8, south - 0.1);
    const railTo = new Vector3(railX, 0.3 - rise * 4 + 0.8, south + 1.3);
    buckets.add('steel', tube([railFrom, railTo], 0.03, STEEL_DARK, 6, 4), { passable: true });
    for (const t of [0.04, 0.5, 0.96]) {
        const at = railFrom.clone().lerp(railTo, t);
        const foot = treadAt(at.z);
        buckets.add('steel', cylinder(0.025, 0.025, at.y - foot, 4, { x: at.x, y: (at.y + foot) / 2, z: at.z }, STEEL_DARK), { passable: true });
    }
    // Iron bollards along the east edge, a rope looped between the two by the jetty, and a lamp at the corner.
    const bollards = [];
    for (let zz = north + 1.3; zz < south - 0.6; zz += 2.6) {
        const at = onJetty(zz) ? (zz < jetty ? jetty - 1.35 : jetty + 1.35) : zz;
        if (bollards.some((other) => Math.abs(other - at) < 1.2)) continue;
        bollards.push(at);
        const x = east - 0.28;
        buckets.add('steel', cylinder(0.1, 0.12, 0.36, 8, { x, y: 0.3 + 0.18, z: at }, STEEL_DARK));
        buckets.add('steel', cylinder(0.15, 0.13, 0.07, 8, { x, y: 0.3 + 0.39, z: at }, STEEL_DARK));
        buckets.add('steel', paint(pose(new SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { x, y: 0.3 + 0.42, z: at }), STEEL_DARK));
    }
    const nearJetty = bollards.filter((at) => Math.abs(at - jetty) < 1.6).sort((p, q) => p - q);
    if (nearJetty.length >= 2) {
        const [a, b] = nearJetty;
        const x = east - 0.28;
        const sag = [new Vector3(x, 0.66, a), new Vector3(x + 0.12, 0.42, (a + b) / 2), new Vector3(x, 0.66, b)];
        buckets.add('steel', tube(sag, 0.028, ROPE, 16, 4), { passable: true });
    }
    const lampAt = new Vector3(east - 0.35, 0, south - 0.35);
    buckets.add('steel', cylinder(0.05, 0.06, 1.7, 5, { x: lampAt.x, y: 0.3 + 0.85, z: lampAt.z }, STEEL_DARK));
    buckets.add('glow', ball(0.16, { x: lampAt.x, y: 0.3 + 1.78, z: lampAt.z }, LAMP, 8, 6));
    // Weed hanging at the waterline and drifting out from the face.
    for (let cluster = 0; cluster < 11; cluster += 1) {
        const run = runs[cluster % 3 === 2 ? 1 : 0];
        const t = random.range(0.06, 0.94);
        const at = run.from.clone().lerp(run.to, t);
        if (run.out.x > 0 && onJetty(at.z)) continue;
        const color = WEED[Math.floor(random() * WEED.length)];
        for (let lump = 0; lump < 2; lump += 1) {
            const radius = random.range(0.07, 0.16);
            const clump = pose(new IcosahedronGeometry(radius, 0), {
                x: at.x + run.out.x * 0.05 + random.range(-0.2, 0.2) * Math.abs(run.out.z), y: SEA_LEVEL + random.range(0.02, 0.14),
                z: at.z + run.out.z * 0.05 + random.range(-0.2, 0.2) * Math.abs(run.out.x), sy: 0.6, ry: random() * Math.PI,
            });
            buckets.add('weed', holdsFast(paint(clump, color)), { passable: true });
        }
        const strands = 3 + Math.floor(random() * 4);
        for (let strand = 0; strand < strands; strand += 1) {
            const reach = random.range(0.4, 1.2);
            const angle = random.range(-0.9, 0.9);
            const wave = random.range(2, 4.5);
            const strip = new PlaneGeometry(0.05, reach, 1, 8);
            strip.rotateX(-Math.PI / 2);
            strip.translate(0, 0, reach / 2);
            const position = strip.attributes.position;
            for (let index = 0; index < position.count; index += 1) {
                const alongStrip = position.getZ(index) / reach;
                position.setX(index, position.getX(index) + Math.sin(alongStrip * wave * Math.PI) * 0.06 * alongStrip);
            }
            swaying(strip, (sx, sy, sz) => sz / reach, 0.9);
            const facing = Math.atan2(run.out.x, run.out.z);
            pose(strip, { x: at.x + run.out.x * 0.04, y: SEA_LEVEL + 0.04, z: at.z + run.out.z * 0.04 + random.range(-0.25, 0.25) * Math.abs(run.out.x), ry: facing + angle });
            buckets.add('weed', paintBy(strip.toNonIndexed(), (px, py, pz, out) => out.set(color).lerp(WEED_TIP, 0.3)), { passable: true });
        }
    }
}

/**
 * Three brick-red, steepled cafés at the head of the jetty, facing out like
 * actors: two to one side and one to the other, parted by an aisle down the
 * stage's middle, so the way from the jetty to the gate in the wall runs
 * straight between them. Each as built and as aged (CAFE_BUILDS).
 */
function buildCafes({ buckets, place, mounts, extras, animated, wanted, materials, still, bright = null }) {
    const z = place.position[2];
    // Their stage: a platform out from the wall, with an apron before the cafés (where the footlights stand)
    // wide enough to walk, running on past the last café's outer wall toward the sun-dock. Its north end is
    // broader and longer, so the two northern cafés stand free with a walk all round each (a playtester's
    // shadow kept being caught in the narrow ways between them, the wall and the water); and there, by the
    // wall, it stops short of the sea-wall's balcony overhead, where the steps up to it begin (buildSeaWall).
    // (Its seaward edge runs in one straight line, the quay's, from end to end: Elm found its steps in and out
    // "blocky", and the quay itself underbaked. buildQuay dresses it.)
    const segments = [[PLATFORM_NOTCH_Z, z - 4.4], [z - 4.4, z - 1.0], [z - 1.0, z + 2.4], [z + 2.4, z + 5.8]];
    for (const [z0, z1] of segments) {
        const zm = (z0 + z1) / 2;
        const west = wallX(zm) - 0.1;
        buckets.add('dimGold', box(QUAY_EAST - west, 1.3, z1 - z0 + 0.12, { x: (west + QUAY_EAST) / 2, y: -0.35, z: zm }, PAVE));
    }
    const northZ0 = PLATFORM_NORTH + 0.06;
    buckets.add('dimGold', box(QUAY_EAST - PLATFORM_NOTCH_X, 1.3, PLATFORM_NOTCH_Z - northZ0 + 0.12, {
        x: (QUAY_EAST + PLATFORM_NOTCH_X) / 2, y: -0.35, z: (northZ0 + PLATFORM_NOTCH_Z) / 2,
    }, PAVE));
    buildQuay(buckets, { north: PLATFORM_NORTH, south: z + 5.8 + 0.06, jetty: z });

    const jettyStart = wallX(z) + 3.6;
    const jettyEnd = 23.5;
    buckets.add('dimGold', box(jettyEnd - jettyStart, 0.14, 1.7, { x: (jettyStart + jettyEnd) / 2, y: 0.12, z }, PAVE_DARK));
    for (let x = jettyStart + 0.6; x < jettyEnd; x += 1.8) {
        for (const side of [-0.75, 0.75]) buckets.add('dimGold', cylinder(0.09, 0.09, 1.5, 5, { x, y: -0.5, z: z + side }, PAVE_DARK));
    }
    for (let x = jettyStart + 1.5; x < jettyEnd; x += 3.6) {
        buckets.add('steel', cylinder(0.05, 0.06, 1.7, 5, { x, y: 1.0, z: z + 0.78 }, STEEL_DARK));
        buckets.add('glow', ball(0.16, { x, y: 1.95, z: z + 0.78 }, LAMP, 8, 6));
        // (A bright thing: touched, it brightens. bright.js)
        bright?.push(brightLamp(new Vector3(x, 1.95, z + 0.78), 0.36, 1.2));
    }

    const audience = new Vector3(21, 0, z);
    // [along the wall from the jetty's line, out from the wall]: the aisle between the second and third. (The
    // northern two stand well out from the wall, with room to walk behind them; the third is built right back
    // against it, its back corners in the wall's thickness, so no lane runs behind it: a playtester's shadow
    // kept being caught in the half-body gap there was.)
    const cafes = [[-6.6, 0.75], [-3.0, 1.0], [3.0, -1.0]];
    // "Angled to shine up every face, no café less equal": footlights before each, as on a stage, and the
    // warm wash they throw up its front. The wash is one additive sheet for all three.
    const washes = [];
    const worn = [];
    cafes.forEach(([dz, dx], index) => {
        const cz = z + dz;
        const cx = wallX(cz) + 1.75 + dx;
        const ry = Math.atan2(audience.x - cx, audience.z - cz);
        const brick = BRICK[index];
        const build = CAFE_BUILDS[index];
        const { width, height, roof, tower, towerTall, spire } = build;
        const towerBase = height + roof * 0.6;
        const towerTop = towerBase + towerTall;
        const pieces = [
            bevelBox(width, height, 2.1, { y: height / 2 }, brick),
            gable(width + 0.2, roof, 2.3, { y: height }, BRICK_DARK),
            bevelBox(tower, towerTall, tower, { y: towerBase + towerTall / 2, z: 0.55 }, brick, 0.04),
            box(0.7, 1.3, 0.06, { y: 0.65, z: 1.07 }, SHADOW),
            box(width + 0.3, 0.08, 0.7, { y: 1.62, z: 1.35, rx: 0.25 }, GOLDS[1]),
        ];
        if (build.crown === 'dome') {
            // Sî's tower is crowned with a little dome and a finial, as a tea-house's is.
            pieces.push(paint(pose(new SphereGeometry(tower * 0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: towerTop, z: 0.55 }), BRICK_DARK));
            pieces.push(cylinder(0.035, 0.05, 0.36, 5, { y: towerTop + tower * 0.62 + 0.14, z: 0.55 }, GOLDS[2]));
            pieces.push(ball(0.1, { y: towerTop + tower * 0.62 + 0.36, z: 0.55 }, GOLDS[3], 8, 6));
        } else {
            pieces.push(cone(tower * 0.8, spire, 4, { y: towerTop + spire / 2, z: 0.55, ry: Math.PI / 4 }, BRICK_DARK));
            pieces.push(ball(0.12, { y: towerTop + spire + 0.1, z: 0.55 }, GOLDS[3], 8, 6));
        }
        // Cafi roasts its coffee: a chimney on the back of its roof (the soot of it is in its bricks).
        if (build.chimney) {
            pieces.push(bevelBox(0.3, 0.8, 0.3, { x: width * 0.28, y: height + roof * 0.55, z: -0.6 }, BRICK_DARK, 0.03));
            pieces.push(box(0.36, 0.06, 0.36, { x: width * 0.28, y: height + roof * 0.55 + 0.42, z: -0.6 }, SHADOW));
        }
        const glows = [
            box(0.46, 0.6, 0.05, { x: -0.68, y: 1.25, z: 1.08 }, WINDOW),
            box(0.46, 0.6, 0.05, { x: 0.68, y: 1.25, z: 1.08 }, WINDOW),
            box(0.3, 0.4, 0.05, { y: towerBase + towerTall * 0.6, z: 0.55 + tower / 2 + 0.01 }, WINDOW),
        ];
        // Cafiarmaí keeps a lantern lit high in its tower, in two narrow lights.
        if (build.lantern) {
            for (const side of [-1, 1]) glows.push(box(0.05, 0.34, 0.12, { x: side * (tower / 2 + 0.01), y: towerBase + towerTall * 0.62, z: 0.55 }, WINDOW_LOW));
        }
        for (const along of [-0.84, -0.28, 0.28, 0.84]) {
            pieces.push(box(0.2, 0.09, 0.14, { x: along, y: 0.05, z: 1.36 }, SHADOW));
            glows.push(box(0.14, 0.04, 0.04, { x: along, y: 0.08, z: 1.29 }, FOOTLIGHT));
        }
        const wash = new PlaneGeometry(width, 2.3, 1, 4);
        wash.translate(0, 1.15, 1.075);
        paintBy(wash, (wx, wy, wz, out) => out.setRGB(0.5, 0.3, 0.12).multiplyScalar(Math.pow(1 - Math.min(1, wy / 2.3), 1.6)));
        const at = { x: cx, y: 0.3, z: cz, ry };
        worn.push({ x: cx, z: cz, ry, eaves: height, wear: build.wear });
        for (const piece of frame(pieces, at)) buckets.add('brick', piece);
        for (const piece of frame(glows, at)) buckets.add('glow', piece);
        washes.push(frame([wash], at)[0]);
        // (A bright thing: Cafiarmaí's lantern, touched, turns: its light goes round from side to side, and again.
        // bright.js)
        if (build.lantern && bright) {
            const high = towerBase + towerTall * 0.62;
            const sides = [-1, 1].map((side) => inFrame(side * (tower / 2 + 0.01), high, 0.55, at));
            const lights = [0, 1, 2, 3].map((turn) => ({ at: sides[turn % 2], color: WINDOW_LOW, size: 0.6, after: turn * 0.3 }));
            bright.push({ kind: 'lantern', center: inFrame(0, high, 0.55, at), radius: tower / 2 + 0.22, fragment: null, lights });
        }
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
            shade.position.copy(inFrame(-width / 2 - 0.015, 0.02, 0.2, at));
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
    if (materials?.brick) weatherCafes(materials.brick, worn);
    // The jetty's two signs (a trial: guides.js draws them): lecterns on its boards, a little off its middle, leaning
    // back toward the way in from its end, so the camera behind the hum reads them whole, even on a phone held upright
    // (whose view is narrow). They stand below the hum's height (it flies over them), and aren't walls to anyone.
    if (trialOn('jettysigns')) {
        const lean = new Vector3(Math.cos(0.62), Math.sin(0.62), 0);
        for (const [name, back] of [['jetty/let-go', 1.7], ['jetty/pinch', 4.5]]) {
            mount(mounts, name, {
                position: new Vector3(jettyEnd - back, 0.82, z - 0.42),
                normal: lean.clone(),
                height: 0.44,
                maxWidth: 1.16,
                style: 'guide',
                stand: { kind: 'posts', base: 0.19 },
            });
        }
    }
    // Where the jetty ends, out over the water: on the Cyclolite moored there (a trial), or on its boards (the walk's
    // shadow, or the hum, waits there, walk.js).
    if (trialOn('cyclolite')) {
        const boatX = jettyEnd + CYCLOLITE_RADIUS - CYCLOLITE_MOORED;
        const floor = buildCyclolite(buckets, { x: boatX, z, extras, animated, still });
        return { pierEnd: new Vector3(boatX + CYCLOLITE_WAITS.x, CYCLOLITE_DECK_Y, z + CYCLOLITE_WAITS.z), floor };
    }
    return { pierEnd: new Vector3(jettyEnd - 0.9, 0.19, z) };
}

/**
 * The Cyclolite (a trial, trials.js; ?cyclolite=off). In Numbers by Paint (p. 94) it is "the long, silvered necklace
 * that, when activated, engulfs its owner in a fishbowl of hard, yellow light". Elm's: "a little golden floating half
 * boat half disc at the end of the jetty ... a cyclolite with the roof open, spread wide enough for the bird and shadow
 * to appear in full, the shadow on the ground of the cyclolite disc." So: a golden disc-boat moored off the jetty's
 * end, its deck level with the jetty's boards (a floor: the hum begins on it, and flies off it onto the boards); the
 * silvered necklace strung round its rim, its stone hanging at the front; and its fishbowl of hard yellow light opened
 * into petals spread wide and low about it, breathing a little, as a flower does once it has opened, so nothing of it
 * stands between the camera and the hum, or the wraith's shadow on the deck.
 */
const CYCLOLITE_RADIUS = 1.12;
/** Its deck, level with the jetty's boards (their top), and how far in from its rim a body stands. */
const CYCLOLITE_DECK_Y = 0.19;
const CYCLOLITE_KEEP = 0.2;
/** How far it overlaps the jetty's end, moored against it (so the deck and the boards meet with no gap between). */
const CYCLOLITE_MOORED = 0.32;
/**
 * Where its owner waits on the deck: off the middle, against the way the wraith's shadow falls (north and a little
 * east, from the key light's quarter: walk.js HUM_SUN), so the shadow lies across the deck's heart, the whole of it on
 * the disc (Elm: "the shadow on the ground of the cyclolite disc").
 */
const CYCLOLITE_WAITS = { x: -0.22, z: 0.5 };
/** Its fishbowl's petals: how many, how far out from the rim they reach, how high they arch, and their tips' curl. */
const CYCLOLITE_PETALS = 8;
const PETAL_REACH = 0.82;
const PETAL_ARCH = 0.18;
const PETAL_CURL = 0.16;
const CYCLOLITE_LIGHT = 0xffd447;
/** The deck's inlay, ring by ring from its heart out (radius as a share of the deck's, and its gold). */
const CYCLOLITE_INLAY = [[0.3, 0xf6dc94], [0.36, 0xb0802e], [0.66, 0xecc46c], [0.7, 0xb0802e], [0.985, 0xdcb05a]];

const cycloliteVertexShader = /* glsl */ `
    attribute float along;
    attribute float across;
    attribute float petal;
    uniform float time;
    varying float vAlong;
    varying float vAcross;
    varying vec3 vWorld;
    void main() {
        vAlong = along;
        vAcross = across;
        vec3 p = position;
        // Each petal breathes on its own beat: its tip rises and settles a little.
        p.y += sin(time * 0.9 + petal * 0.79) * 0.045 * along * along;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const cycloliteFragmentShader = /* glsl */ `
    uniform vec3 color;
    uniform float time;
    varying float vAlong;
    varying float vAcross;
    varying vec3 vWorld;
    void main() {
        // Hard light: faint through each petal's body, bright along its edges and its tip, as light held in glass is.
        float edge = smoothstep(0.72, 1.0, abs(vAcross * 2.0 - 1.0));
        float tip = smoothstep(0.8, 1.0, vAlong);
        float base = 1.0 - smoothstep(0.0, 0.12, vAlong);
        float glow = 0.1 + 0.62 * max(edge, tip) + 0.35 * base;
        // A slow shimmer passes round the bowl.
        glow *= 0.85 + 0.15 * sin(vAlong * 6.0 - time * 1.4 + vAcross * 3.0);
        glow *= 1.0 - smoothstep(70.0, 160.0, distance(cameraPosition, vWorld));
        gl_FragColor = vec4(color * glow, 1.0);
    }
`;

/** The opened fishbowl: petals about a deck of radius `radius`, in the boat's own frame (its deck's middle at 0). */
function cyclolitePetals(radius) {
    const ACROSS = 6;
    const ALONG = 9;
    const positions = [];
    const along = [];
    const across = [];
    const petals = [];
    const index = [];
    const span = (Math.PI * 2) / CYCLOLITE_PETALS;
    for (let k = 0; k < CYCLOLITE_PETALS; k += 1) {
        const middle = (k + 0.5) * span;
        const first = positions.length / 3;
        for (let j = 0; j <= ALONG; j += 1) {
            const v = j / ALONG;
            // Out from the rim, arching a little, its tip curling up: a petal of the bowl, opened.
            const r = radius + PETAL_REACH * v;
            const y = PETAL_ARCH * Math.sin(Math.PI * v * 0.85) + PETAL_CURL * v * v * v;
            // Broad at its root (nearly its share of the rim), narrowing to a rounded tip.
            const half = span * 0.46 * (1 - 0.72 * Math.pow(v, 1.6)) * (radius / r);
            for (let i = 0; i <= ACROSS; i += 1) {
                const u = i / ACROSS;
                const angle = middle + (u - 0.5) * 2 * half;
                positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
                along.push(v);
                across.push(u);
                petals.push(k);
            }
        }
        for (let j = 0; j < ALONG; j += 1) {
            for (let i = 0; i < ACROSS; i += 1) {
                const a = first + j * (ACROSS + 1) + i;
                const b = a + ACROSS + 1;
                index.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('along', new Float32BufferAttribute(along, 1));
    geometry.setAttribute('across', new Float32BufferAttribute(across, 1));
    geometry.setAttribute('petal', new Float32BufferAttribute(petals, 1));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    return geometry;
}

/**
 * Build the Cyclolite moored off the jetty's end at (x, z): its hull, deck and rim of gold (the city's own, so the
 * wraith's shadow falls on its deck as on the paving, and the ink and the dust take it as they take the city), its
 * necklace of silvered beads and the necklace's stone, and its opened fishbowl of light (an extra, drawn as light: it
 * writes no depth and draws no ink, and stops nothing). Returns its floor, for walking (walk.js).
 */
function buildCyclolite(buckets, { x, z, extras, animated, still }) {
    const deckY = CYCLOLITE_DECK_Y;
    const R = CYCLOLITE_RADIUS;
    // The hull: a shallow golden bowl under the deck, half under the water, as a little boat's is.
    const hull = new LatheGeometry([
        new Vector2(0.001, deckY - 0.52),
        new Vector2(R * 0.42, deckY - 0.49),
        new Vector2(R * 0.74, deckY - 0.37),
        new Vector2(R * 0.93, deckY - 0.19),
        new Vector2(R * 1.02, deckY - 0.04),
        new Vector2(R * 1.0, deckY + 0.04),
    ], 32);
    buckets.add('gold', paint(pose(hull, { x, y: 0, z }), GOLDS[2]));
    // The deck: a disc of gold inlaid ring by ring, brightest at its heart, where its owner stands.
    let inner = 0;
    for (const [share, color] of CYCLOLITE_INLAY) {
        const ring = inner === 0 ? new CircleGeometry(R * share, 32) : new RingGeometry(R * inner, R * share, 32);
        ring.rotateX(-Math.PI / 2);
        buckets.add('gold', paint(pose(ring, { x, y: deckY + 0.004, z }), color));
        inner = share;
    }
    // Its rim, a raised lip of brighter gold.
    const rim = new TorusGeometry(R, 0.05, 6, 40);
    rim.rotateX(Math.PI / 2);
    buckets.add('gold', paint(pose(rim, { x, y: deckY + 0.04, z }), GOLDS[0]));
    // The silvered necklace, strung round the rim, bead by bead; its stone hangs at the front, toward the city.
    const BEADS = 36;
    for (let k = 0; k < BEADS; k += 1) {
        const angle = (k / BEADS) * Math.PI * 2;
        const out = R + 0.085;
        buckets.add('steel', ball(0.045, { x: x + Math.cos(angle) * out, y: deckY - 0.01, z: z + Math.sin(angle) * out }, 0xd8dee8, 6, 4));
    }
    buckets.add('steel', cylinder(0.012, 0.012, 0.14, 4, { x: x - R - 0.1, y: deckY - 0.08, z }, 0xd8dee8));
    buckets.add('glow', ball(0.085, { x: x - R - 0.1, y: deckY - 0.19, z }, light(CYCLOLITE_LIGHT, 2.6), 8, 6));

    // The fishbowl of hard, yellow light, opened wide.
    const uniforms = { time: { value: 0 }, color: { value: new Color(CYCLOLITE_LIGHT).multiplyScalar(1.5) } };
    const bowl = new Mesh(cyclolitePetals(R), new ShaderMaterial({
        uniforms,
        vertexShader: cycloliteVertexShader,
        fragmentShader: cycloliteFragmentShader,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
    }));
    bowl.name = 'cyclolite-light';
    bowl.position.set(x, deckY + 0.05, z);
    bowl.renderOrder = 2;
    extras.push(bowl);
    animated.push((time) => {
        uniforms.time.value = still ? 0 : time;
    });
    // A body stands on its deck, short of the rim.
    const floorAt = (px, pz) => (Math.hypot(px - x, pz - z) <= R - CYCLOLITE_KEEP ? deckY : null);
    return { floorAt };
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
    // (Its top, for a shade to lie on: inside the rim, 12 cm above its middle.)
    const disc = { surfaceAt: (x, z) => (Math.hypot(x - cx, z - cz) <= 4.2 ? floorY + 0.12 : null) };
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
    return { touch, surface: disc };
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
    // (Three dark half-discs once stood above the arches for the grottos' pits: they hung in the air where the
    // mountain's face curves away, and read as black shapes rather than caves, so they're gone: Elm's call.)
    buckets.add('stone', box(2.6, 0.5, 7.2, { x: faceX + 0.2, y: py - 0.55, z: pz }, 0x5e4c50));
    // The arches' ledge stands out on a spur of the mountain's own rock, grown from it (it hung clear of it once).
    const spur = roughen(new IcosahedronGeometry(1, 1), 0.22, 9.1);
    pose(spur, { x: centre.x + 3.2, y: py - 1.5, z: centre.z + 2.4, sx: 4.4, sy: 1.15, sz: 4.0 });
    buckets.add('rock', paintBy(spur, rock));
    for (const dz of [-2.2, 0.2, 2.4]) {
        buckets.add('arch', paint(pose(new TorusGeometry(1.05, 0.17, 6, 18, Math.PI), { x: faceX + 0.4, y: py - 0.3, z: pz + dz, ry: Math.PI / 2 }), WHITE_ARCH));
        for (const side of [-1.05, 1.05]) {
            buckets.add('arch', cylinder(0.17, 0.2, 1.3, 6, { x: faceX + 0.4, y: py - 0.95 + 0.65, z: pz + dz + side }, WHITE_ARCH));
        }
    }

    // The door stands in a pit: the rock's face is felt for where the pit opens, and the pit sunk into it, so its
    // dark mouth is all that shows of it, the door within, rather than a dark box standing out from the rock.
    const doorAt = new Vector3(centre.x + 1.8, centre.y - 0.9, centre.z + 5.7);
    const feel = new Raycaster(new Vector3(doorAt.x, doorAt.y, centre.z + 20), new Vector3(0, 0, -1));
    const rockFace = feel.intersectObjects([new Mesh(body), new Mesh(under)], false)[0];
    if (rockFace) doorAt.z = rockFace.point.z - 0.05;
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

/** The balcony's floor: its radius, the height of its top, and how far in from its rim a body keeps. */
const BALCONY_RADIUS = 1.25;
const BALCONY_TOP = 2.59;
const BALCONY_KEEP = 0.2;
/**
 * The steps up to it from the cafés' platform: they rise west over the water along the platform's north end, to
 * a landing that meets the balcony between two of its posts. How many risers, each tread's depth, how wide the
 * flight is, and how far in from its seaward side a body keeps.
 */
const STEPS_RISERS = 10;
const STEPS_TREAD = 0.311;
const STEPS_WIDE = 0.8;
const STEPS_KEEP = 0.12;

/** A thin rod from a to b (a rail, a post), as a box turned to lie along it. */
function rod(a, b, thickness, color) {
    const along = new Vector3().subVectors(b, a);
    const length = along.length();
    const geometry = new BoxGeometry(thickness, length, thickness);
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(UP, along.normalize()));
    geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return paint(geometry, color);
}

/**
 * Cassandra's lookout: a balcony on the sea-wall above the breaking sea. A
 * flight of steps climbs to it from the north end of the cafés' platform, over
 * the water, to a landing that meets it where its rail stands open between two
 * posts; the platform stops short of the balcony, so nothing is walked beneath
 * it. (A playtester's shadow kept ending in that corner, under the balcony,
 * out of the camera's sight: now the corner has a way up, to the place with
 * the most to read.) Returns the lookout's floor for walking (walk.js): the
 * steps, the landing and the balcony, each at its height.
 */
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
    const cx = face + 0.02;
    buckets.add('gold', paint(pose(new CylinderGeometry(BALCONY_RADIUS, BALCONY_RADIUS, 0.18, 18, 1, false, 0, Math.PI), { x: cx, y: 2.5, z }), GOLDS[3]));
    // The rail, open between the posts at the east and the south-east, where the landing comes in. (Round the
    // rail, from the south: a quarter-turn is the south-east post, a half-turn the east one.)
    const RAIL = 1.2;
    for (const [from, to] of [[0, Math.PI / 4], [Math.PI / 2, Math.PI]]) {
        const rail = new TorusGeometry(RAIL, 0.05, 4, Math.max(3, Math.round(((to - from) / Math.PI) * 18)), to - from);
        rail.rotateZ(from);
        buckets.add('gold', paint(pose(rail, { x: face, y: 3.1, z, rx: -Math.PI / 2, rz: -Math.PI / 2 }), GOLDS[0]));
    }
    const postAt = (angle) => new Vector3(face + Math.cos(angle) * RAIL, 2.5, z + Math.sin(angle) * RAIL);
    for (let post = 0; post <= 4; post += 1) {
        const angle = -Math.PI / 2 + (post / 4) * Math.PI;
        buckets.add('gold', cylinder(0.04, 0.04, 0.6, 4, { x: face + Math.cos(angle) * RAIL, y: 2.8, z: z + Math.sin(angle) * RAIL }, GOLDS[2]));
    }
    buckets.add('gold', cone(0.9, 1.4, 4, { x: face + 0.6, y: 1.8, z, rx: Math.PI, ry: Math.PI / 4 }, GOLDS[1]));

    // The steps. Their landward side is flush with the platform's north end (buildCafes); the landing reaches
    // into the balcony's floor; the lowest two treads can be stepped onto from the platform alongside.
    const platformTop = 0.3;
    const south = PLATFORM_NORTH;
    const north = south - STEPS_WIDE;
    const mid = (south + north) / 2;
    const top = face + 1.45;
    const foot = top + (STEPS_RISERS - 1) * STEPS_TREAD;
    const riser = (BALCONY_TOP - platformTop) / STEPS_RISERS;
    for (let tread = 1; tread < STEPS_RISERS; tread += 1) {
        const surface = platformTop + tread * riser;
        const tall = riser + 0.1;
        buckets.add('dimGold', box(STEPS_TREAD + 0.02, tall, STEPS_WIDE, { x: foot - (tread - 0.5) * STEPS_TREAD, y: surface - tall / 2, z: mid }, PAVE));
    }
    const landingWest = face + 0.7;
    buckets.add('gold', box(top - landingWest, 0.18, STEPS_WIDE, { x: (top + landingWest) / 2, y: BALCONY_TOP - 0.1, z: mid }, GOLDS[3]));
    // Stringers under each side, and legs down into the water (passable: a pole the camera may pass).
    const pitch = Math.atan2(BALCONY_TOP - platformTop, foot - top);
    const slope = Math.hypot(BALCONY_TOP - platformTop, foot - top);
    for (const side of [south - 0.03, north + 0.03]) {
        buckets.add('dimGold', box(slope, 0.3, 0.06, { x: (foot + top) / 2, y: (platformTop + BALCONY_TOP) / 2 - 0.3, z: side, rz: -pitch }, PAVE_DARK));
    }
    for (const x of [foot - 0.2, (foot + top) / 2, top + 0.15]) {
        const under = platformTop + ((foot - x) / (foot - top)) * (BALCONY_TOP - platformTop) - 0.35;
        for (const side of [south - 0.05, north + 0.05]) {
            buckets.add('dimGold', cylinder(0.07, 0.08, under - SEA_LEVEL + 0.6, 5, { x, y: (under + SEA_LEVEL - 0.6) / 2, z: side }, PAVE_DARK), { passable: true });
        }
    }
    buckets.add('dimGold', cylinder(0.08, 0.09, BALCONY_TOP - SEA_LEVEL + 0.5, 5, { x: top - 0.1, y: (BALCONY_TOP + SEA_LEVEL - 0.5) / 2 - 0.2, z: north + 0.08 }, PAVE_DARK), { passable: true });
    // Handrails, the balcony's gold, each side: the seaward one from the foot, the landward one from above the
    // treads a body steps onto, both running on along the landing to the posts either side of the opening.
    const hand = 0.62;
    const onFlight = (x) => platformTop + Math.min(STEPS_RISERS, Math.max(1, Math.ceil((foot - x) / STEPS_TREAD))) * riser;
    const railPieces = [];
    for (const [side, from, post] of [[north + 0.06, foot - 0.08, postAt(0)], [south - 0.06, foot - 2.5 * STEPS_TREAD, postAt(Math.PI / 4)]]) {
        const low = new Vector3(from, onFlight(from) + hand, side);
        const high = new Vector3(top, BALCONY_TOP + 0.51, side);
        railPieces.push(rod(low, high, 0.05, GOLDS[0]));
        railPieces.push(rod(high, new Vector3(post.x, 3.1, post.z), 0.05, GOLDS[0]));
        for (const at of [low, high]) railPieces.push(rod(new Vector3(at.x, at.y - hand, at.z), at, 0.07, GOLDS[2]));
    }
    for (const piece of railPieces) buckets.add('gold', piece, { passable: true });

    // Where a body may stand up here: the treads (by how far along the flight), the landing, and the balcony's
    // floor, short of its rim and clear of the wall.
    const floorAt = (x, zz) => {
        if (zz <= south && zz >= north + STEPS_KEEP && x > top && x <= foot) {
            const tread = Math.ceil((foot - x) / STEPS_TREAD);
            // (Past the two lowest treads, a body keeps in from the landward side too: there it's a drop.)
            if (tread > 2 && zz > south - STEPS_KEEP) return null;
            return platformTop + Math.min(STEPS_RISERS - 1, Math.max(1, tread)) * riser;
        }
        if (zz <= south - STEPS_KEEP && zz >= north + STEPS_KEEP && x > landingWest && x <= top) return BALCONY_TOP;
        const dx = x - cx;
        const dz = zz - z;
        if (dx >= 0 && x >= wallX(zz) + BALCONY_KEEP && Math.hypot(dx, dz) <= BALCONY_RADIUS - BALCONY_KEEP) return BALCONY_TOP;
        return null;
    };
    return { floor: { floorAt } };
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
function buildShoreWeed(buckets, { underSand = false } = {}) {
    const random = createRandom(8080);
    const [north, south] = wallEnds();
    const clear = (z) => !((z > -11.6 && z < 2.8) || (z > 1.4 && z < 8.8));
    // (Where the promontory's sand lies at the wall's foot, a trial, its weed is under it: drawn from the same
    // stream all the same, so the rest of the shore's weed stays as it was.)
    const buried = (z) => underSand && z > SAND_FROM && z < SAND_TO;
    const add = buckets.add.bind(buckets);
    let skip = false;
    buckets = { add: (...args) => (skip ? null : add(...args)) };
    for (let cluster = 0; cluster < 24; cluster += 1) {
        const z = random.range(north + 1.2, south - 1.2);
        const x = wallX(z) + random.range(0.08, 0.3);
        const color = WEED[Math.floor(random() * WEED.length)];
        const lumps = 2 + Math.floor(random() * 3);
        const strands = 5 + Math.floor(random() * 5);
        const fronds = Math.floor(random() * 3);
        if (!clear(z)) continue;
        skip = buried(z);
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
// The golden bridges
// =============================================================================

/** The deck: how wide, how thick, and how high its rails stand. */
const BRIDGE_WIDE = 0.86;
const BRIDGE_DECK = 0.12;
const BRIDGE_RAIL = 0.62;
/** How high a bridge's underside keeps over the ground beneath it, at the least (the shadow stands 1.35 tall). */
const BRIDGE_CLEAR = 2.6;
/** The shortest and longest span, how many bridges at most, and how many to one building (a tree may take more). */
const BRIDGE_SPAN = [1.8, 9.5];
const BRIDGES_MOST = 22;
const BRIDGES_EACH = 2;
/** How far a bridge may climb for every unit it spans, and how square to a face it must leave it. */
const BRIDGE_SLOPE = 0.16;
const BRIDGE_SQUARE = Math.cos(MathUtils.degToRad(26));
/** From this span a bridge is arched beneath; from this one, roofed. */
const BRIDGE_ARCHED = 3.2;
const BRIDGE_ROOFED = 6.4;

/**
 * Where a bridge dissolves into gold dust: within reach of the camera, and about the line from the camera to the
 * walking shadow (bridgeSight: the shadow's middle, and 1 while walking), so a bridge never stands between the
 * two. What's left there glitters. (The dust is a pixel's grain, turning over a few times a second.)
 */
const BRIDGE_DUST_GLSL = /* glsl */ `
    uniform vec4 bridgeSight;
    uniform float bridgeTime;
    varying vec3 vBridgeWorld;
    float bridgeGrain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float bridgeDust() {
        float near = 1.0 - smoothstep(0.9, 2.8, distance(vBridgeWorld, cameraPosition));
        float sight = 0.0;
        if (bridgeSight.w > 0.5) {
            vec3 ab = bridgeSight.xyz - cameraPosition;
            float t = clamp(dot(vBridgeWorld - cameraPosition, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float off = distance(vBridgeWorld, cameraPosition + ab * t);
            sight = (1.0 - smoothstep(0.6, 1.35, off)) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.9, 0.97, t));
        }
        return max(near, sight);
    }
`;

/** A bar of rectangular section swept along a path (at(t), t from 0 to 1): a deck, a roof's slope. */
function sweptBar(at, segments, width, thickness, color, tilt = 0) {
    const up = new Vector3(0, 1, 0);
    const rings = [];
    for (let index = 0; index <= segments; index += 1) {
        const t = index / segments;
        const point = at(t);
        const tangent = at(Math.min(1, t + 0.002)).sub(at(Math.max(0, t - 0.002))).normalize();
        const side = new Vector3().crossVectors(tangent, up).normalize();
        const lift = new Vector3().crossVectors(side, tangent).normalize();
        if (tilt) {
            side.applyAxisAngle(tangent, tilt);
            lift.applyAxisAngle(tangent, tilt);
        }
        const half = side.multiplyScalar(width / 2);
        const down = lift.multiplyScalar(-thickness);
        rings.push([
            point.clone().add(half), point.clone().sub(half),
            point.clone().sub(half).add(down), point.clone().add(half).add(down),
        ]);
    }
    const positions = [];
    const quad = (a, b, c, d) => positions.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
    for (let index = 0; index < segments; index += 1) {
        const [a0, b0, c0, d0] = rings[index];
        const [a1, b1, c1, d1] = rings[index + 1];
        quad(a0, a1, b1, b0);
        quad(b0, b1, c1, c0);
        quad(c0, c1, d1, d0);
        quad(d0, d1, a1, a0);
    }
    const [first, last] = [rings[0], rings[segments]];
    quad(first[0], first[1], first[2], first[3]);
    quad(last[3], last[2], last[1], last[0]);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return paint(geometry, color);
}

/**
 * One golden bridge, from a to b (each { point: its deck's top at that end, door: the face's outward normal where
 * it leaves a hall, or ring: the tree it leaves, or wall: true }), in the style its span asks for.
 */
function goldenBridge(buckets, a, b, random, touch = null) {
    const span = Math.hypot(b.point.x - a.point.x, b.point.z - a.point.z);
    const way = new Vector3(b.point.x - a.point.x, 0, b.point.z - a.point.z).normalize();
    const side = new Vector3(-way.z, 0, way.x);
    const camber = Math.min(0.42, span * 0.055);
    const deckAt = (t) => new Vector3().lerpVectors(a.point, b.point, t).add(new Vector3(0, camber * Math.sin(Math.PI * t), 0));
    const segments = Math.max(4, Math.ceil(span / 0.45));
    const gold = GOLDS[Math.floor(random() * GOLDS.length)];
    const pieces = [];
    const glows = [];
    pieces.push(sweptBar(deckAt, segments, BRIDGE_WIDE, BRIDGE_DECK, gold));
    // A kerb along each edge of the deck, the balusters, and a rail along their tops.
    for (const edge of [-1, 1]) {
        const offset = side.clone().multiplyScalar(edge * (BRIDGE_WIDE / 2 - 0.05));
        pieces.push(sweptBar((t) => deckAt(t).add(offset).add(new Vector3(0, 0.06, 0)), segments, 0.08, 0.1, GOLDS[2]));
        const rail = [];
        for (let index = 0; index <= segments; index += 1) rail.push(deckAt(index / segments).add(offset).add(new Vector3(0, BRIDGE_RAIL, 0)));
        pieces.push(tube(rail, 0.035, GOLDS[0], segments, 4));
        const posts = Math.max(2, Math.round(span / 0.58));
        for (let post = 1; post < posts; post += 1) {
            const foot = deckAt(post / posts).add(offset);
            pieces.push(box(0.045, BRIDGE_RAIL, 0.045, { x: foot.x, y: foot.y + BRIDGE_RAIL / 2, z: foot.z }, GOLDS[2]));
        }
        // A lantern at each end, on a post a little above the rail.
        for (const t of [0.06, 0.94]) {
            const foot = deckAt(t).add(offset);
            pieces.push(box(0.06, BRIDGE_RAIL + 0.3, 0.06, { x: foot.x, y: foot.y + (BRIDGE_RAIL + 0.3) / 2, z: foot.z }, GOLDS[3]));
            glows.push(ball(0.08, { x: foot.x, y: foot.y + BRIDGE_RAIL + 0.36, z: foot.z }, LAMP, 6, 4));
            // (A bright thing: touched, it brightens. bright.js)
            touch?.push(brightLamp(new Vector3(foot.x, foot.y + BRIDGE_RAIL + 0.36, foot.z), 0.26, 0.8));
        }
    }
    // Arched beneath: an arch springing from below each end, rising to meet the deck at its middle, and slender
    // posts between it and the deck.
    if (span >= BRIDGE_ARCHED) {
        const springs = 0.85 + Math.min(0.5, span * 0.04);
        const archAt = (t) => deckAt(t).add(new Vector3(0, -(BRIDGE_DECK + 0.04 + springs * (1 - Math.sin(Math.PI * t))), 0));
        for (const edge of [-1, 1]) {
            const offset = side.clone().multiplyScalar(edge * (BRIDGE_WIDE / 2 - 0.14));
            const arch = [];
            for (let index = 0; index <= segments; index += 1) arch.push(archAt(index / segments).add(offset));
            pieces.push(tube(arch, 0.07, GOLDS[1], segments, 4));
            for (const t of [0.14, 0.27, 0.73, 0.86]) {
                const low = archAt(t).add(offset);
                const high = deckAt(t).add(offset).add(new Vector3(0, -BRIDGE_DECK, 0));
                pieces.push(rod(low, high, 0.04, GOLDS[2]));
            }
        }
    }
    // Roofed, as a gallery: slim columns along both sides, and a low gabled roof following the deck's rise.
    if (span >= BRIDGE_ROOFED) {
        const columns = Math.max(3, Math.round(span / 1.35));
        for (const edge of [-1, 1]) {
            const offset = side.clone().multiplyScalar(edge * (BRIDGE_WIDE / 2 - 0.04));
            for (let column = 0; column <= columns; column += 1) {
                const foot = deckAt(column / columns).add(offset);
                pieces.push(box(0.06, 1.45, 0.06, { x: foot.x, y: foot.y + 0.72, z: foot.z }, GOLDS[3]));
            }
        }
        for (const edge of [-1, 1]) {
            const slope = (t) => deckAt(t).add(new Vector3(0, 1.62, 0)).add(side.clone().multiplyScalar(edge * 0.26));
            pieces.push(sweptBar(slope, segments, 0.62, 0.05, GOLD_ROOFS[Math.floor(random() * GOLD_ROOFS.length)], edge * 0.42));
        }
        glows.push(ball(0.1, { x: deckAt(0.5).x, y: deckAt(0.5).y + 1.3, z: deckAt(0.5).z }, LAMP, 6, 4));
    }
    // Where it leaves a hall, an arched door in the face; round a tree, a collar; on the wall, a landing.
    for (const end of [a, b]) {
        if (end.door) {
            const out = end.door;
            const ry = Math.atan2(out.x, out.z);
            const at = end.point.clone().addScaledVector(out, 0.03);
            const lit = random() < 0.45;
            // (The door's round top: a half-disc stood upright in the face.)
            const cap = new CylinderGeometry(0.34, 0.34, 0.04, 12, 1, false, 0, Math.PI);
            cap.rotateX(Math.PI / 2);
            cap.rotateZ(Math.PI / 2);
            const opening = [box(0.68, 1.05, 0.04, { y: 0.52 }, lit ? WINDOW_LOW : SHADOW), paint(pose(cap, { y: 1.05 }), lit ? WINDOW_LOW : SHADOW)];
            for (const piece of frame(opening, { x: at.x, y: at.y, z: at.z, ry })) (lit ? glows : pieces).push(piece);
            const arch = paint(pose(new TorusGeometry(0.4, 0.05, 4, 12, Math.PI), { y: 1.05 }), GOLDS[3]);
            pieces.push(...frame([arch, box(0.08, 1.05, 0.08, { x: -0.4, y: 0.52 }, GOLDS[3]), box(0.08, 1.05, 0.08, { x: 0.4, y: 0.52 }, GOLDS[3])], { x: at.x, y: at.y, z: at.z + 0, ry }));
        } else if (end.ring) {
            const ring = end.ring;
            pieces.push(paint(pose(new TorusGeometry(ring.girth + 0.16, 0.09, 5, 20), { x: ring.x, y: end.point.y - 0.05, z: ring.z, rx: Math.PI / 2 }), GOLDS[2]));
        } else if (end.wall) {
            pieces.push(box(1.0, 0.1, 1.05, { x: end.point.x + 0.35, y: end.point.y - 0.05, z: end.point.z, ry: Math.atan2(way.x, way.z) }, GOLDS[1]));
        }
    }
    for (const piece of pieces) buckets.add('bridge', piece);
    for (const piece of glows) buckets.add('glow', piece);
}

/**
 * Golden bridges between the city's buildings (Elm: "more and more thoroughly designed golden bridges between
 * every type of building, just high enough the shadow can walk under them, and maybe they can have a sort of
 * dusting shimmering see through effect if the camera has to go through them"): hall to hall, hall to one of the
 * great golden trees, hall to the top of the sea-wall. Each leaves a hall by an arched door at one of its drawn
 * storey lines, and keeps high enough over the street for the shadow to walk beneath. Short ones are footbridges;
 * middling ones are arched beneath, with slender posts between the arch and the deck; long ones are roofed
 * galleries; each has its balusters and a lantern at either end. They're their own material, which neither the
 * walker's walls nor the camera's solids count: where the camera, or the line from it to the walking shadow,
 * passes through one, it comes apart into glittering gold dust. (?bridges=off leaves them out, to compare.)
 * A stream of its own. Returns the uniforms the dust needs, for the walk to keep the sight line in.
 */
async function buildGoldenBridges(buckets, materials, halls, trees, byId, touch = null) {
    if (!halls?.length || new URLSearchParams(globalThis.location?.search ?? '').get('bridges') === 'off') return null;
    const random = createRandom(6007);
    // The ends a bridge may leave from, building by building.
    const buildings = [];
    for (const hall of halls) {
        const c = Math.cos(hall.turn);
        const s = Math.sin(hall.turn);
        const xAxis = new Vector3(c, 0, -s);
        const zAxis = new Vector3(s, 0, c);
        const lines = [];
        for (let y = 0.45 + HALL_STOREY + 0.3 + HALL_STOREY; y < hall.height - 0.6; y += HALL_STOREY) lines.push(hall.base + y);
        const faces = [[zAxis, hall.depth / 2, hall.width], [zAxis.clone().negate(), hall.depth / 2, hall.width], [xAxis, hall.width / 2, hall.depth], [xAxis.clone().negate(), hall.width / 2, hall.depth]]
            .map(([normal, out, across]) => ({ centre: new Vector3(hall.x, 0, hall.z).addScaledVector(normal, out + 0.02), normal, along: new Vector3(-normal.z, 0, normal.x), half: across / 2 }));
        buildings.push({ kind: 'hall', hall, faces, lines, most: BRIDGES_EACH, used: 0 });
    }
    for (const tree of trees.filter((spire) => !spire.leans)) {
        const lines = [];
        for (let y = 3.9; y < tree.height * 0.55; y += 0.75) lines.push(tree.base + y);
        buildings.push({ kind: 'tree', tree, lines, most: 3, used: 0 });
    }
    const [north, south] = wallEnds();
    const wallSpots = [];
    for (let z = north + 2; z < south - 2; z += 2.2) {
        if (Math.abs(z - GATE_Z) < 2.6) continue;
        wallSpots.push(z);
    }
    buildings.push({ kind: 'wall', spots: wallSpots, lines: [3.1], most: 3, used: 0 });
    // The places that keep their own sky (the flags' lines, the garden, the glass station, the bridgework's middle).
    const keepClear = [['flags', 4.5], ['steel-garden', 4.0], ['gas-station', 3.5], ['bridge', 3.0]]
        .map(([id, room]) => ({ at: byId.get(id)?.position, room }))
        .filter(({ at }) => at);

    /** Where on a building a bridge toward `toward` (x, z) would leave it: { point (x, z), door | ring | wall } or null. */
    const leave = (building, toward) => {
        if (building.kind === 'hall') {
            let best = null;
            for (const face of building.faces) {
                const reach = Math.max(0, face.half - 0.75);
                const along = MathUtils.clamp(new Vector3().subVectors(toward, face.centre).dot(face.along), -reach, reach);
                const point = face.centre.clone().addScaledVector(face.along, along);
                const out = new Vector3().subVectors(toward, point).setY(0).normalize();
                const square = out.dot(face.normal);
                if (square >= BRIDGE_SQUARE && (!best || square > best.square)) best = { point, door: face.normal, square };
            }
            return best;
        }
        if (building.kind === 'tree') {
            const { tree } = building;
            const out = new Vector3(toward.x - tree.x, 0, toward.z - tree.z).normalize();
            return { point: new Vector3(tree.x, 0, tree.z).addScaledVector(out, tree.girth(0.3) + 0.12), ring: { x: tree.x, z: tree.z, girth: tree.girth(0.3) } };
        }
        let best = null;
        for (const z of building.spots) {
            const point = new Vector3(wallX(z) - 1.3, 0, z);
            const out = new Vector3().subVectors(toward, point).setY(0).normalize();
            const square = -out.x;
            if (square >= BRIDGE_SQUARE && (!best || point.distanceTo(toward) < best.point.distanceTo(toward))) best = { point, wall: true };
        }
        return best;
    };
    const centreOf = (building) => (building.kind === 'hall' ? new Vector3(building.hall.x, 0, building.hall.z) : building.kind === 'tree' ? new Vector3(building.tree.x, 0, building.tree.z) : null);
    /** Whether a point at height y stands inside a hall (other than those given) or a tree's trunk. */
    const inside = (x, y, z, skip) => {
        for (const other of buildings) {
            if (skip.includes(other)) continue;
            if (other.kind === 'hall') {
                const { hall } = other;
                const dx = x - hall.x;
                const dz = z - hall.z;
                const u = dx * Math.cos(hall.turn) - dz * Math.sin(hall.turn);
                const v = dx * Math.sin(hall.turn) + dz * Math.cos(hall.turn);
                if (Math.abs(u) < hall.width / 2 + 0.5 && Math.abs(v) < hall.depth / 2 + 0.5 && y < hall.base + hall.height + 3.5) return true;
            } else if (other.kind === 'tree') {
                const { tree } = other;
                if (Math.hypot(x - tree.x, z - tree.z) < tree.girth(0.3) + 0.7 && y < tree.base + tree.height) return true;
            }
        }
        return false;
    };

    // Every pair of buildings near enough, each way it could be bridged, scored: short and level first.
    const candidates = [];
    for (let i = 0; i < buildings.length; i += 1) {
        for (let j = i + 1; j < buildings.length; j += 1) {
            const A = buildings[i];
            const B = buildings[j];
            if (A.kind !== 'hall' && B.kind !== 'hall') continue;
            const [hallEnd, other] = A.kind === 'hall' ? [A, B] : [B, A];
            const guessOther = centreOf(other) ?? new Vector3(wallX(hallEnd.hall.z) - 1.3, 0, hallEnd.hall.z);
            if (Math.hypot(guessOther.x - hallEnd.hall.x, guessOther.z - hallEnd.hall.z) > BRIDGE_SPAN[1] + 6) continue;
            let a = leave(hallEnd, guessOther);
            if (!a) continue;
            let b = leave(other, a.point);
            if (!b) continue;
            a = leave(hallEnd, b.point);
            if (!a) continue;
            b = leave(other, a.point);
            if (!b) continue;
            const span = Math.hypot(b.point.x - a.point.x, b.point.z - a.point.z);
            if (span < BRIDGE_SPAN[0] || span > BRIDGE_SPAN[1]) continue;
            if (other.kind === 'hall' && -new Vector3().subVectors(b.point, a.point).setY(0).normalize().dot(b.door) < BRIDGE_SQUARE) continue;
            // The storey lines at either end that are nearest level with each other, within a gentle ramp.
            let heights = null;
            for (const ya of hallEnd.lines) {
                for (const yb of other.lines) {
                    const climb = Math.abs(ya - yb);
                    if (climb > BRIDGE_SLOPE * span) continue;
                    const score = climb + 0.12 * Math.abs((ya + yb) / 2 - (hallEnd.hall.base + 4.6));
                    if (!heights || score < heights.score) heights = { ya, yb, score };
                }
            }
            if (!heights) continue;
            a.point.y = heights.ya;
            b.point.y = heights.yb;
            // Clear of the ground, of every other building, and of the places that keep their sky.
            let clear = true;
            for (let t = 0.08; t <= 0.92 && clear; t += 0.3 / span) {
                const x = a.point.x + (b.point.x - a.point.x) * t;
                const z = a.point.z + (b.point.z - a.point.z) * t;
                const y = a.point.y + (b.point.y - a.point.y) * t;
                if (y - BRIDGE_DECK - groundY(x, z) < BRIDGE_CLEAR) clear = false;
                else if (!onLand(x, z, -0.2)) clear = false;
                else if (inside(x, y, z, [hallEnd, other])) clear = false;
                else if (keepClear.some(({ at, room }) => Math.hypot(x - at[0], z - at[2]) < room)) clear = false;
            }
            if (!clear) continue;
            const score = span + 3 * Math.abs(a.point.y - b.point.y) + (other.kind === 'hall' ? 0 : -1.5);
            candidates.push({ A: hallEnd, B: other, a, b, span, score });
        }
    }
    candidates.sort((p, q) => p.score - q.score);

    // Taken shortest first, no building taking more than its share, and no two crossing at much the same height.
    const taken = [];
    const crosses = (p, q) => {
        const [a1, b1, a2, b2] = [p.a.point, p.b.point, q.a.point, q.b.point];
        const d = (b1.x - a1.x) * (b2.z - a2.z) - (b1.z - a1.z) * (b2.x - a2.x);
        if (Math.abs(d) < 1e-9) return false;
        const u = ((a2.x - a1.x) * (b2.z - a2.z) - (a2.z - a1.z) * (b2.x - a2.x)) / d;
        const v = ((a2.x - a1.x) * (b1.z - a1.z) - (a2.z - a1.z) * (b1.x - a1.x)) / d;
        return u > -0.05 && u < 1.05 && v > -0.05 && v < 1.05 && Math.abs((a1.y + b1.y) / 2 - (a2.y + b2.y) / 2) < 2.2;
    };
    for (const candidate of candidates) {
        if (taken.length >= BRIDGES_MOST) break;
        if (candidate.A.used >= candidate.A.most || candidate.B.used >= candidate.B.most) continue;
        if (taken.some((other) => (other.A === candidate.A && other.B === candidate.B) || crosses(other, candidate))) continue;
        // (Two bridges from one building leave it well apart: their doors never crowd one another.)
        const endAt = (bridge, building) => (bridge.A === building ? bridge.a.point : bridge.B === building ? bridge.b.point : null);
        const crowded = taken.some((other) => [candidate.A, candidate.B].some((building) => {
            const mine = endAt(candidate, building);
            const theirs = endAt(other, building);
            return mine && theirs && Math.hypot(mine.x - theirs.x, mine.z - theirs.z) < 1.9 && Math.abs(mine.y - theirs.y) < 1.2;
        }));
        if (crowded) continue;
        taken.push(candidate);
        candidate.A.used += 1;
        candidate.B.used += 1;
    }
    for (const { a, b } of taken) {
        goldenBridge(buckets, a, b, random, touch);
        await breathe();
    }

    // Their gold comes apart into dust where the camera, or its sight of the walking shadow, passes through. (Where
    // the whole city comes apart, a trial, they come apart as everything does, and their dust lingers: dust.js.)
    const uniforms = { bridgeSight: { value: new Vector4(0, 0, 0, 0) }, bridgeTime: { value: 0 } };
    if (materials?.bridge && !trialOn('dust')) {
        alsoBeforeCompile(materials.bridge, 'bridge-dust', (shader) => {
            Object.assign(shader.uniforms, uniforms);
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vBridgeWorld;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBridgeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            // (Where it comes apart the gold is simply gone, a narrow grain of it at the edge, so the ink draws
            // one light line round the opening rather than one round every mote; the dust is drawn over it.)
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `#include <common>\n${BRIDGE_DUST_GLSL}`)
                .replace('void main() {', [
                    'void main() {',
                    '    float dust = bridgeDust();',
                    '    if (dust > 0.42 + 0.14 * bridgeGrain(floor(gl_FragCoord.xy / 2.0))) discard;',
                ].join('\n'));
        });
    }
    // The dust itself: the bridges drawn again, in light only (no depth, so no ink), where they come apart: a
    // faint gold haze, and motes glittering in it, turning over as the light catches them.
    const dustMaterial = new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vBridgeWorld;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vBridgeWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            ${BRIDGE_DUST_GLSL}
            void main() {
                float dust = bridgeDust();
                if (dust < 0.03) discard;
                float mote = bridgeGrain(floor(gl_FragCoord.xy / 2.0) + floor(bridgeTime * 7.0) * 13.7);
                float glint = step(0.9, mote) * (0.55 + 0.45 * sin(bridgeTime * 9.0 + mote * 40.0));
                vec3 gold = vec3(1.0, 0.78, 0.4);
                gl_FragColor = vec4(gold * (glint * 1.5 + 0.05) * smoothstep(0.03, 0.6, dust), 1.0);
            }
        `,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
    });
    const dustOf = (geometry) => {
        const dust = new Mesh(geometry, dustMaterial);
        dust.name = 'bridge-dust';
        dust.renderOrder = 3;
        return dust;
    };
    return { uniforms, dustOf, count: taken.length, kinds: taken.map(({ B }) => B.kind), ends: taken.map(({ a, b }) => [a.point.toArray(), b.point.toArray()]) };
}

// =============================================================================
// The dressing: a market, lamps, benches, plants, lanterns and banners, and a park with its fountain
// =============================================================================

const TIMBER = [0x6a4a32, 0x7a5638, 0x5e4230];
const CANVAS = 0xeee2c6;
const AWNINGS = [0x2fb0a8, 0xb04a34, 0xd4a24e, 0x7a4a8e, 0x3e7a52, 0x2f6f9e, 0xc8704a];
const TERRACOTTA = [0xa4553a, 0xb4643e, 0x94482e];
const FOLIAGE = [0x4e7c46, 0x5c8c4a, 0x3f6e40, 0x6a9a50];
const HEDGE = [0x3f7042, 0x487c46, 0x39663c];
const BLOOMS = [0xe86a7a, 0xf0c050, 0xf4ece0, 0xb07ae0, 0xe8904a, 0xd84a5a];
const FRUIT = [0xe8903a, 0xc8402e, 0x8ab04a, 0xe8c84a, 0x7a3a6a];
const BINDINGS = [0x6a2a2a, 0x2a4a6a, 0x4a5a2a, 0xa08a50, 0x3a2a4a, 0x8a4a2a];
const GLAZES = [0xa4553a, 0x3a6a8a, 0xd8ccb4, 0x5e8c7a];
const STONE_PALE = 0xd8ccb4;
const IRON = 0x2a2e36;
const BARK = 0x5a4632;
const SOIL = 0x4a3426;
const GRASS = new Color(0x6fa452);
const GRASS_DRY = new Color(0xa2ae5e);
const BULBS = [light(0xffc870, 3.2), light(0xff9a6a, 3.0), light(0xfff0b0, 3.0)];

/**
 * The park, between the golden trees and the Steel Garden, just off the avenue: its middle, how far its lawn
 * reaches either way (its corners rounded), and the fountain at its heart.
 */
const PARK = { x: -4.4, z: 6.3, halfX: 4.2, halfZ: 1.95, corner: 1.0 };

/**
 * The market along the avenue, between the golden trees and the flags' crossroads, short of the flags' own
 * poles, and (on the south side) behind the bridgework's plaque, which looks down the avenue to the gate. Its
 * stalls (x, z, what they sell): the south side's face north across the street, the north side's face south.
 * And the poles its lanterns are strung between, across the street, one at each stall's front corner, clear of
 * the ways between the stalls, which lead on behind.
 */
const STALLS = [
    [-7.1, -1.3, 'fruit'], [-4.6, -1.3, 'cloth'],
    [-5.6, -5.1, 'lanterns'], [-3.1, -5.1, 'books'], [-0.6, -5.1, 'pots'],
];
const MARKET_POLES = {
    south: { z: -1.85, xs: [-6.3, -3.8] },
    north: { z: -4.55, xs: [-6.4, -3.9, -1.4] },
};
/** Lamps stand along the streets this far apart, by turns on either side; and a bench now and then between. */
const LAMP_EVERY = 7;
const BENCH_EVERY = 11;

const FOUNTAIN_VERTEX = /* glsl */ `
    attribute float aRise;
    varying vec3 vWorld;
    varying vec2 vUv;
    varying float vRise;
    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vUv = uv;
        vRise = aRise;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

/** The fountain's water, in its basin and its bowl: rings going out from where the water comes down. */
const FOUNTAIN_WATER = /* glsl */ `
    uniform float time;
    uniform vec3 centre;
    varying vec3 vWorld;
    void main() {
        vec2 d = vWorld.xz - centre.xz;
        float bowl = step(centre.y + 1.2, vWorld.y);
        float r = length(d) / mix(0.76, 0.52, bowl);
        float from = mix(0.86, 0.0, bowl);
        float rings = pow(0.5 + 0.5 * sin((r - from) * 34.0 - time * 3.4), 8.0) * exp(-abs(r - from) * 2.2);
        vec3 deep = vec3(0.07, 0.18, 0.26);
        vec3 shallow = vec3(0.24, 0.46, 0.54);
        vec3 color = mix(shallow, deep, smoothstep(0.1, 1.0, r)) + vec3(1.0, 0.85, 0.6) * rings * 0.42;
        gl_FragColor = vec4(color, 1.0);
    }
`;

/** Its falling water (and the jet rising from the top): light only, in streaks, broken and glinting. */
const FOUNTAIN_FALL = /* glsl */ `
    uniform float time;
    varying vec2 vUv;
    varying float vRise;
    void main() {
        float across = vUv.x * 48.0;
        float lane = floor(across);
        float h = fract(sin(lane * 12.9898) * 43758.5453);
        // (The sheet's streaks run down it, the jet's up: uv.y is 1 at a cylinder's top.)
        float up = vRise > 0.5 ? -1.0 : 1.0;
        float flow = fract(vUv.y * (1.6 + h) + time * (1.3 + h * 0.8) * up);
        float streak = smoothstep(0.0, 0.15, flow) * (1.0 - smoothstep(0.35, 0.8, flow));
        float thin = 1.0 - smoothstep(0.1, 0.45, abs(fract(across) - 0.5));
        vec3 color = vec3(0.75, 0.88, 1.0) * streak * thin * 0.55 + vec3(0.25, 0.4, 0.5) * 0.1;
        gl_FragColor = vec4(color, 1.0);
    }
`;

/**
 * The city dressed (Elm, 30 Sep: "Maybe some plants and bits and bobs and decorations around the city too?
 * Stalls idk all that sort of thing. A park somewhere? A fountain?"). A market along the avenue under striped
 * awnings, its goods on the counters (fruit, cloth, pots, books, lanterns), and lanterns strung across the
 * street above it; lamps along the streets; benches; potted plants by the halls and flowers in their window
 * boxes; banners of plain cloth on the halls that face a street; and, between the golden trees and the Steel
 * Garden, a park: a lawn with low hedges, the city's sycamores (Episode 3, "tangling the sycamores' heights"),
 * raised beds of flowers, benches, and at its heart a fountain, its water falling from a bowl and rising from
 * its top. Nothing crowds what already stands (the halls, the trees' feet, the named places, the streets) or
 * what the dressing has set down. A stream of its own (7331), so nothing else in the city moves; ?dressing=off
 * leaves it all out, to compare.
 */
/** A piece as the buckets want it, with its own corners (a polyhedron has them already). */
function unindexed(geometry) {
    return geometry.index ? geometry.toNonIndexed() : geometry;
}

async function buildDressing(buckets, { halls, spires, byId, extras, animated, still, keepOff = null, touch = null }) {
    const random = createRandom(7331);
    // (Where another place stands that came after the dressing, Cassandra's house, a trial: what would stand there is
    // laid out as ever, from the same stream, taking its room, but isn't built.)
    const into = (x, z, r) => (keepOff?.(x, z, r) ? UNBUILT : buckets);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const trunks = spires.filter((spire) => !spire.leans && spire.girth(0) > 1);
    const [gx, , gz] = byId.get('steel-garden').position;
    const [sx, , sz] = byId.get('gas-station').position;
    const [fx, , fz] = byId.get('flags').position;
    const taken = [];
    const inHall = (x, z, r) => halls.some((hall) => {
        const c = Math.cos(hall.turn);
        const s = Math.sin(hall.turn);
        const dx = x - hall.x;
        const dz = z - hall.z;
        return Math.abs(dx * c - dz * s) < hall.width / 2 + 0.3 + r && Math.abs(dx * s + dz * c) < hall.depth / 2 + 0.3 + r;
    });
    /** Whether something r across the radius may stand at (x, z): on the land, off the street, crowding nothing. */
    const clear = (x, z, r, street = 0.1) => onLand(x, z, r + 0.3)
        && !inHall(x, z, r)
        && trunks.every((trunk) => Math.hypot(x - trunk.x, z - trunk.z) > trunk.girth(0) * 1.4 + r + 0.3)
        && Math.hypot(x - gx, z - gz) > 2.9 + r
        && !(Math.abs(x - sx) < 2.4 + r && Math.abs(z - sz) < 3.0 + r)
        && Math.hypot(x - fx, z - fz) > 4.2 + r
        && streetGap(x, z) > street + r
        && inPark(x, z) === false
        && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + r + 0.25);
    const take = (x, z, r) => taken.push([x, z, r]);
    function inPark(x, z) {
        return Math.abs(x - PARK.x) < PARK.halfX + 0.4 && Math.abs(z - PARK.z) < PARK.halfZ + 0.4;
    }
    const ground = (x, z) => groundY(x, z) - 0.02;
    const counts = { stalls: 0, lamps: 0, benches: 0, pots: 0, windowBoxes: 0, banners: 0, strings: 0, trees: 0, beds: 0 };

    // ----- Pieces -----

    const lamp = (x, z) => {
        const y = ground(x, z);
        const at = into(x, z, 0.2);
        at.add('steel', cylinder(0.11, 0.13, 0.22, 6, { x, y: y + 0.11, z }, IRON));
        at.add('steel', cylinder(0.045, 0.06, 2.3, 6, { x, y: y + 1.35, z }, IRON));
        at.add('steel', cone(0.15, 0.16, 6, { x, y: y + 2.76, z }, IRON));
        at.add('glow', ball(0.12, { x, y: y + 2.58, z }, LAMP, 8, 6));
        take(x, z, 0.3);
        counts.lamps += 1;
        // (A bright thing: touched, it brightens. bright.js)
        if (touch && at !== UNBUILT) touch.push(brightLamp(new Vector3(x, y + 2.58, z), 0.34, 1.1));
    };

    // A bench for two, its seat facing +z in its own frame (turned by facing).
    const bench = (x, z, facing) => {
        const at = { x, y: ground(x, z), z, ry: facing };
        const wood = pick(TIMBER);
        const planks = [
            bevelBox(1.1, 0.06, 0.36, { y: 0.44, z: 0.02 }, wood, 0.015),
            bevelBox(1.1, 0.26, 0.05, { y: 0.74, z: -0.17, rx: -0.12 }, wood, 0.015),
        ];
        const iron = [];
        for (const side of [-0.48, 0.48]) {
            iron.push(box(0.05, 0.44, 0.05, { x: side, y: 0.22, z: 0.14 }, IRON));
            iron.push(box(0.05, 0.88, 0.05, { x: side, y: 0.44, z: -0.16 }, IRON));
            iron.push(box(0.05, 0.05, 0.36, { x: side, y: 0.6, z: 0 }, IRON));
        }
        const laid = into(x, z, 0.62);
        for (const piece of frame(planks, at)) laid.add('stone', piece);
        for (const piece of frame(iron, at)) laid.add('steel', piece);
        take(x, z, 0.65);
        counts.benches += 1;
    };

    // A pot of clay by a hall, and what grows in it: a clipped ball of box, a cone of yew, or a tumble of flowers.
    const pot = (x, z) => {
        const y = ground(x, z);
        const clay = pick(TERRACOTTA);
        buckets.add('stone', cylinder(0.24, 0.18, 0.44, 9, { x, y: y + 0.22, z }, clay));
        buckets.add('stone', cylinder(0.26, 0.26, 0.05, 9, { x, y: y + 0.45, z }, clay));
        const kind = random();
        if (kind < 0.38) {
            buckets.add('green', paint(pose(new IcosahedronGeometry(0.3, 1), { x, y: y + 0.78, z }), pick(FOLIAGE)));
        } else if (kind < 0.66) {
            buckets.add('green', cone(0.25, 0.95, 8, { x, y: y + 0.95, z }, pick(HEDGE)));
        } else {
            buckets.add('green', paint(pose(new IcosahedronGeometry(0.2, 0), { x, y: y + 0.6, z, sy: 0.7 }), pick(FOLIAGE)));
            for (let leaf = 0; leaf < 3; leaf += 1) {
                const clump = pose(new IcosahedronGeometry(0.14, 0), { x: x + random.range(-0.16, 0.16), y: y + random.range(0.62, 0.8), z: z + random.range(-0.16, 0.16) });
                buckets.add('weed', paint(unindexed(swaying(clump, () => 1, 0.18)), pick(FOLIAGE)), { passable: true });
            }
            for (let bloom = 0; bloom < 5; bloom += 1) {
                const flower = pose(new SphereGeometry(0.055, 5, 3), { x: x + random.range(-0.2, 0.2), y: y + random.range(0.7, 0.92), z: z + random.range(-0.2, 0.2) });
                buckets.add('weed', paint(unindexed(swaying(flower, () => 1, 0.2)), pick(BLOOMS)), { passable: true });
            }
        }
        take(x, z, 0.35);
        counts.pots += 1;
    };

    // A sycamore: a trunk, and its crown in clumps, swaying a little in the wind.
    const sycamore = (x, z, scale) => {
        const y = ground(x, z);
        const lean = random.range(-0.08, 0.08);
        const trunk = [new Vector3(x, y, z), new Vector3(x + lean, y + 0.9 * scale, z - lean * 0.5), new Vector3(x - lean * 0.5, y + 1.8 * scale, z + lean)];
        buckets.add('stone', unindexed(taperedTube(trunk, 0.15 * scale, 0.08 * scale, BARK, 8, 6)));
        const crown = new Vector3(x, y + 2.35 * scale, z);
        for (let clump = 0; clump < 5; clump += 1) {
            const angle = (clump / 5) * Math.PI * 2 + random.range(-0.4, 0.4);
            const out = (clump === 0 ? 0 : random.range(0.4, 0.75)) * scale;
            const at = crown.clone().add(new Vector3(Math.cos(angle) * out, random.range(-0.25, 0.4) * scale, Math.sin(angle) * out));
            const leaves = pose(new IcosahedronGeometry(random.range(0.55, 0.8) * scale, 1), { x: at.x, y: at.y, z: at.z, sy: 0.78 });
            swaying(leaves, (px, py) => (py - y) / (3.2 * scale), 0.22);
            buckets.add('weed', paint(unindexed(leaves), pick(FOLIAGE)), { passable: true });
        }
        take(x, z, 0.4);
        counts.trees += 1;
    };

    // A raised bed of flowers, in a stone rim that comes to a body's knee (so it's walked round).
    const flowerBed = (x, z) => {
        const y = ground(x, z);
        const rim = new LatheGeometry([
            new Vector2(0.5, 0), new Vector2(0.47, 0.05), new Vector2(0.47, 0.6), new Vector2(0.44, 0.65), new Vector2(0.4, 0.62), new Vector2(0.4, 0.52),
        ], 14);
        buckets.add('stone', paint(pose(rim, { x, y, z }), STONE_PALE));
        buckets.add('stone', paint(pose(new CircleGeometry(0.41, 14).rotateX(-Math.PI / 2), { x, y: y + 0.57, z }), SOIL));
        for (let leaf = 0; leaf < 6; leaf += 1) {
            const angle = random() * Math.PI * 2;
            const r = Math.sqrt(random()) * 0.3;
            const clump = pose(new IcosahedronGeometry(0.1, 0), { x: x + Math.cos(angle) * r, y: y + 0.66, z: z + Math.sin(angle) * r, sy: 0.7 });
            buckets.add('weed', paint(unindexed(swaying(clump, () => 1, 0.1)), pick(FOLIAGE)), { passable: true });
        }
        for (let bloom = 0; bloom < 12; bloom += 1) {
            const angle = random() * Math.PI * 2;
            const r = Math.sqrt(random()) * 0.34;
            const flower = pose(new SphereGeometry(0.05, 5, 3), { x: x + Math.cos(angle) * r, y: y + random.range(0.7, 0.86), z: z + Math.sin(angle) * r });
            buckets.add('weed', paint(unindexed(swaying(flower, () => 1, 0.14)), pick(BLOOMS)), { passable: true });
        }
        take(x, z, 0.5);
        counts.beds += 1;
    };

    // ----- The market -----

    STALLS.forEach(([x, z, kind], index) => {
        const facing = z > GATE_Z ? Math.PI : 0;
        const at = { x, y: ground(x, z), z, ry: facing };
        const color = AWNINGS[index % AWNINGS.length];
        const wood = pick(TIMBER);
        const solid = [];
        const cloth = [];
        const awning = [];
        const glows = [];
        for (const [px, pz, h] of [[-0.7, 0.36, 1.95], [0.7, 0.36, 1.95], [-0.7, -0.36, 2.2], [0.7, -0.36, 2.2]]) {
            solid.push(box(0.07, h, 0.07, { x: px, y: h / 2, z: pz }, wood));
        }
        solid.push(bevelBox(1.5, 0.08, 0.72, { y: 0.92, z: 0.02 }, wood, 0.02));
        solid.push(box(1.46, 0.86, 0.04, { y: 0.47, z: -0.37 }, wood));
        cloth.push(box(1.46, 0.66, 0.03, { y: 0.55, z: 0.38 }, color));
        cloth.push(box(1.46, 0.07, 0.035, { y: 0.8, z: 0.385 }, CANVAS));
        // The awning, in stripes, sloping down to the front, and a scalloped valance along its edge.
        const slope = Math.atan2(0.25, 0.72);
        for (let stripe = 0; stripe < 6; stripe += 1) {
            const sxAt = -0.675 + stripe * 0.27;
            awning.push(box(0.27, 0.025, 1.22, { x: sxAt, y: 2.1, z: 0.05, rx: slope }, stripe % 2 ? CANVAS : color));
            awning.push(cone(0.1, 0.13, 3, { x: sxAt, y: 1.77, z: 0.64, rx: Math.PI }, stripe % 2 ? color : CANVAS));
        }
        awning.push(box(1.62, 0.12, 0.02, { y: 1.88, z: 0.635 }, color));
        glows.push(ball(0.07, { y: 1.64, z: 0.52 }, LAMP, 6, 4));
        solid.push(cone(0.06, 0.08, 5, { y: 1.74, z: 0.52 }, IRON));
        // What it sells, laid out on the counter.
        const top = 0.96;
        if (kind === 'fruit') {
            for (const side of [-0.36, 0.36]) {
                solid.push(box(0.52, 0.1, 0.36, { x: side, y: top + 0.05, z: 0.04 }, wood));
                for (let piece = 0; piece < 7; piece += 1) {
                    cloth.push(ball(0.07, { x: side + random.range(-0.18, 0.18), y: top + 0.14 + random.range(0, 0.04), z: 0.04 + random.range(-0.11, 0.11) }, pick(FRUIT), 6, 4));
                }
            }
        } else if (kind === 'cloth') {
            for (let bolt = 0; bolt < 5; bolt += 1) {
                cloth.push(cylinder(0.065, 0.065, 0.5, 7, { x: -0.56 + bolt * 0.28, y: top + 0.065, z: 0.04, rx: Math.PI / 2 }, pick(AWNINGS)));
            }
            cloth.push(box(0.4, 0.05, 0.3, { x: 0.3, y: top + 0.16, z: 0.02, ry: 0.2 }, pick(BLOOMS)));
        } else if (kind === 'books') {
            // (A stall of books, in a city that is a book.)
            for (const [px, pz, count] of [[-0.52, 0.02, 4], [-0.2, 0.1, 3], [0.14, -0.02, 5], [0.46, 0.08, 2]]) {
                for (let book = 0; book < count; book += 1) {
                    cloth.push(box(0.22, 0.05, 0.3, { x: px + random.range(-0.02, 0.02), y: top + 0.025 + book * 0.05, z: pz, ry: random.range(-0.18, 0.18) }, pick(BINDINGS)));
                }
            }
            cloth.push(box(0.2, 0.012, 0.28, { x: 0.3, y: top + 0.06, z: 0.24, rz: 0.22, rx: -0.2 }, CANVAS));
            cloth.push(box(0.2, 0.012, 0.28, { x: 0.5, y: top + 0.06, z: 0.24, rz: -0.22, rx: -0.2 }, CANVAS));
        } else if (kind === 'pots') {
            for (let vase = 0; vase < 5; vase += 1) {
                const glaze = pick(GLAZES);
                const px = -0.56 + vase * 0.28;
                cloth.push(cylinder(0.07, 0.09, 0.18, 7, { x: px, y: top + 0.09, z: 0.04 }, glaze));
                cloth.push(cylinder(0.04, 0.06, 0.08, 7, { x: px, y: top + 0.22, z: 0.04 }, glaze));
            }
        } else {
            for (const px of [-0.45, 0, 0.45]) {
                glows.push(ball(0.06, { x: px, y: 1.56, z: 0.42 }, pick(BULBS), 6, 4));
                solid.push(cone(0.05, 0.07, 5, { x: px, y: 1.65, z: 0.42 }, IRON));
                glows.push(ball(0.065, { x: px * 1.1, y: top + 0.08, z: 0.02 }, pick(BULBS), 6, 4));
                solid.push(box(0.14, 0.02, 0.14, { x: px * 1.1, y: top + 0.01, z: 0.02 }, IRON));
            }
        }
        // A crate behind it, and now and then a barrel (behind, so the ways between the stalls stay open).
        solid.push(bevelBox(0.42, 0.42, 0.42, { x: 0.42, y: 0.21, z: -0.64, ry: random.range(-0.2, 0.2) }, pick(TIMBER), 0.03));
        if (index % 2 === 0) {
            solid.push(cylinder(0.19, 0.2, 0.56, 9, { x: -0.4, y: 0.28, z: -0.62 }, pick(TIMBER)));
            for (const hoop of [0.12, 0.44]) solid.push(cylinder(0.205, 0.205, 0.04, 9, { x: -0.4, y: hoop, z: -0.62 }, IRON));
        }
        for (const piece of frame(solid, at)) buckets.add('stone', piece);
        for (const piece of frame(cloth, at)) buckets.add('cloth', piece);
        for (const piece of frame(awning, at)) buckets.add('cloth', piece, { passable: true });
        for (const piece of frame(glows, at)) buckets.add('glow', piece);
        take(x, z + (z > GATE_Z ? 0.2 : -0.2), 1.2);
        counts.stalls += 1;
    });

    // Lanterns strung across the street above the market, pole to pole, from one side to the other and back.
    const poleTop = (x, z) => new Vector3(x, ground(x, z) + 3.3, z);
    const poles = [];
    for (const side of ['south', 'north']) {
        const { z, xs } = MARKET_POLES[side];
        for (const x of xs) {
            buckets.add('steel', cylinder(0.035, 0.045, 3.4, 5, { x, y: ground(x, z) + 1.7, z }, IRON));
            buckets.add('steel', ball(0.06, { x, y: ground(x, z) + 3.42, z }, IRON, 6, 4));
            take(x, z, 0.2);
            poles.push({ x, z, side });
        }
    }
    const south = poles.filter((pole) => pole.side === 'south');
    const north = poles.filter((pole) => pole.side === 'north');
    // (Each south pole to the north poles on either side of it, so the strings zig-zag down the street.)
    const strings = [];
    for (const pole of south) {
        const before = north.filter((other) => other.x <= pole.x).pop();
        const after = north.find((other) => other.x > pole.x);
        for (const other of [before, after]) if (other) strings.push([pole, other]);
    }
    for (const [a, b] of strings) {
        const curve = sagging(poleTop(a.x, a.z), poleTop(b.x, b.z), 0.42);
        buckets.add('steel', paint(new TubeGeometry(curve, 14, 0.012, 3, false), IRON), { passable: true });
        const length = curve.getLength();
        const bulbs = Math.floor(length / 0.42);
        const lit = [];
        for (let bulb = 1; bulb < bulbs; bulb += 1) {
            const at = curve.getPointAt(bulb / bulbs);
            const color = pick(BULBS);
            buckets.add('glow', ball(0.05, { x: at.x, y: at.y - 0.07, z: at.z }, color, 6, 4), { passable: true });
            lit.push({ at: new Vector3(at.x, at.y - 0.07, at.z), color, size: 0.36 });
        }
        // (Bright things: a bulb touched, the light runs along its string from it, both ways. bright.js)
        if (touch) for (const bulb of lit) touch.push({ kind: 'lantern', center: bulb.at.clone(), radius: 0.24, fragment: null, lights: lit, runs: BRIGHT_RUNS });
        counts.strings += 1;
    }

    await breathe();
    // ----- The park -----

    // The lawn: a grid laid on the ground's rise and fall, its corners drawn in to the rounded outline, greener
    // and drier by turns.
    {
        const lawn = new PlaneGeometry(PARK.halfX * 2, PARK.halfZ * 2, 34, 16);
        lawn.rotateX(-Math.PI / 2);
        const position = lawn.attributes.position;
        const innerX = PARK.halfX - PARK.corner;
        const innerZ = PARK.halfZ - PARK.corner;
        for (let index = 0; index < position.count; index += 1) {
            let u = position.getX(index);
            let v = position.getZ(index);
            const dx = Math.abs(u) - innerX;
            const dz = Math.abs(v) - innerZ;
            if (dx > 0 && dz > 0 && Math.hypot(dx, dz) > PARK.corner) {
                const k = PARK.corner / Math.hypot(dx, dz);
                u = Math.sign(u) * (innerX + dx * k);
                v = Math.sign(v) * (innerZ + dz * k);
            }
            const x = PARK.x + u;
            const z = PARK.z + v;
            position.setXYZ(index, x, groundY(x, z) + 0.07, z);
        }
        lawn.computeVertexNormals();
        const tint = new Color();
        buckets.add('green', paintBy(unindexed(lawn), (x, y, z, out) => {
            const dry = noise2(x * 0.7 + 11.3, z * 0.7 - 4.1);
            out.copy(tint.copy(GRASS).lerp(GRASS_DRY, MathUtils.smoothstep(dry, 0.35, 0.8) * 0.7));
        }));
    }
    // The paths: a round court about the fountain, and a walk from it to either end.
    {
        const court = new CircleGeometry(1.6, 28);
        court.rotateX(-Math.PI / 2);
        const position = court.attributes.position;
        for (let index = 0; index < position.count; index += 1) {
            const x = PARK.x + position.getX(index);
            const z = PARK.z + position.getZ(index);
            position.setXYZ(index, x, groundY(x, z) + 0.1, z);
        }
        court.computeVertexNormals();
        buckets.add('dimGold', paint(court, PAVE));
        buckets.add('dimGold', groundStrip(PARK.x - PARK.halfX - 0.05, PARK.z, PARK.x - 1.3, PARK.z, 0.9, PAVE, 0.095));
        buckets.add('dimGold', groundStrip(PARK.x + 1.3, PARK.z, PARK.x + PARK.halfX + 0.05, PARK.z, 0.9, PAVE, 0.095));
    }
    // Low hedges along its sides and its ends, open at the walks and at the corners.
    {
        const hedge = (x0, z0, x1, z1) => {
            const length = Math.hypot(x1 - x0, z1 - z0);
            const x = (x0 + x1) / 2;
            const z = (z0 + z1) / 2;
            buckets.add('green', bevelBox(length, 0.72, 0.42, { x, y: ground(x, z) + 0.36, z, ry: -Math.atan2(z1 - z0, x1 - x0) }, pick(HEDGE), 0.1));
        };
        const edgeX = PARK.halfX - 0.3;
        const edgeZ = PARK.halfZ - 0.3;
        for (const side of [-1, 1]) {
            hedge(PARK.x - edgeX + PARK.corner * 0.7, PARK.z + side * edgeZ, PARK.x - 2.75, PARK.z + side * edgeZ);
            hedge(PARK.x + 2.75, PARK.z + side * edgeZ, PARK.x + edgeX - PARK.corner * 0.7, PARK.z + side * edgeZ);
            hedge(PARK.x + side * edgeX, PARK.z - edgeZ + PARK.corner * 0.7, PARK.x + side * edgeX, PARK.z - 0.65);
            hedge(PARK.x + side * edgeX, PARK.z + 0.65, PARK.x + side * edgeX, PARK.z + edgeZ - PARK.corner * 0.7);
        }
    }
    // Its sycamores, its beds of flowers, and benches looking in at the fountain.
    for (const [dx, dz] of [[-2.95, -1.12], [-2.85, 1.15], [2.9, -1.1], [2.95, 1.12]]) sycamore(PARK.x + dx, PARK.z + dz, random.range(0.9, 1.1));
    for (const [dx, dz] of [[-2.1, -1.38], [-2.1, 1.38], [2.1, -1.38], [2.1, 1.38]]) flowerBed(PARK.x + dx, PARK.z + dz);
    bench(PARK.x, PARK.z - 2.12, 0);
    bench(PARK.x, PARK.z + 2.12, Math.PI);
    lamp(PARK.x - PARK.halfX - 0.3, PARK.z + 0.75);
    lamp(PARK.x + PARK.halfX + 0.3, PARK.z - 0.75);

    // The fountain: a basin of pale stone, a column rising from its water to a bowl, the bowl's water falling
    // back into the basin in a glittering sheet, a jet rising from its top.
    {
        const x = PARK.x;
        const z = PARK.z;
        const y = ground(x, z);
        const stone = (profile, segments) => paint(pose(new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), segments), { x, y, z }), STONE_PALE);
        // (Each profile runs up its outside, across its top and down its inside, so every face looks out.)
        buckets.add('stone', stone([[1.0, 0], [0.95, 0.08], [0.95, 0.62], [0.91, 0.7], [0.8, 0.7], [0.75, 0.62], [0.75, 0.1]], 30));
        buckets.add('stone', cylinder(0.12, 0.17, 1.05, 10, { x, y: y + 1.02, z }, STONE_PALE));
        buckets.add('stone', stone([[0.12, 1.5], [0.42, 1.58], [0.58, 1.7], [0.6, 1.74], [0.55, 1.73], [0.3, 1.67], [0.0, 1.64]], 20));
        buckets.add('gold', ball(0.1, { x, y: y + 1.86, z }, GOLDS[3], 10, 6));
        buckets.add('gold', cone(0.07, 0.26, 8, { x, y: y + 2.05, z }, GOLDS[3]));
        take(x, z, 1.1);

        const uniforms = { time: { value: 0 }, centre: { value: new Vector3(x, y, z) } };
        const water = [new CircleGeometry(0.76, 30).rotateX(-Math.PI / 2).translate(x, y + 0.55, z), new CircleGeometry(0.53, 20).rotateX(-Math.PI / 2).translate(x, y + 1.69, z)];
        for (const disc of water) disc.setAttribute('aRise', new Float32BufferAttribute(new Float32Array(disc.attributes.position.count), 1));
        const surface = new Mesh(mergeGeometries(water), new ShaderMaterial({ uniforms, vertexShader: FOUNTAIN_VERTEX, fragmentShader: FOUNTAIN_WATER }));
        surface.name = 'fountain-water';
        const fall = new CylinderGeometry(0.6, 0.66, 1.12, 32, 1, true).translate(x, y + 1.12, z);
        const jet = new CylinderGeometry(0.015, 0.05, 0.55, 8, 1, true).translate(x, y + 2.42, z);
        fall.setAttribute('aRise', new Float32BufferAttribute(new Float32Array(fall.attributes.position.count), 1));
        jet.setAttribute('aRise', new Float32BufferAttribute(new Float32Array(jet.attributes.position.count).fill(1), 1));
        const falling = new Mesh(mergeGeometries([fall, jet]), new ShaderMaterial({
            uniforms,
            vertexShader: FOUNTAIN_VERTEX,
            fragmentShader: FOUNTAIN_FALL,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
        }));
        falling.name = 'fountain-fall';
        falling.renderOrder = 2;
        extras.push(surface, falling);
        animated.push((time) => {
            if (!still) uniforms.time.value = time;
        });
    }

    await breathe();
    // ----- Along the streets -----

    // Lamps by turns on either side (none in the market, which has its lanterns), and a bench now and then
    // between them, facing the street.
    let turn = 1;
    for (const { points, width } of STREETS) {
        for (let index = 0; index < points.length - 1; index += 1) {
            const [ax, az] = points[index];
            const [bx, bz] = points[index + 1];
            const length = Math.hypot(bx - ax, bz - az);
            const wayX = (bx - ax) / length;
            const wayZ = (bz - az) / length;
            for (let along = LAMP_EVERY / 2; along < length; along += LAMP_EVERY) {
                turn = -turn;
                const out = width / 2 + 0.45;
                const x = ax + wayX * along - wayZ * out * turn;
                const z = az + wayZ * along + wayX * out * turn;
                const inMarket = Math.abs(z - GATE_Z) < 2.6 && x > -8.5 && x < 2.5;
                if (!inMarket && clear(x, z, 0.2, 0.15)) lamp(x, z);
            }
            for (let along = BENCH_EVERY / 2 + 1.7; along < length; along += BENCH_EVERY) {
                const out = width / 2 + 0.75;
                const side = -turn;
                const x = ax + wayX * along - wayZ * out * side;
                const z = az + wayZ * along + wayX * out * side;
                const inMarket = Math.abs(z - GATE_Z) < 2.6 && x > -8.5 && x < 2.5;
                // (It faces the street: back to its outside, the way out from the street's middle.)
                const facing = Math.atan2(wayZ * side, -wayX * side);
                if (!inMarket && clear(x, z, 0.62, 0.05)) bench(x, z, facing);
            }
        }
    }

    await breathe();
    // ----- By the halls -----

    // The faces of each hall that look onto a street (the two nearest at most): potted plants at their ends,
    // out from the plinth; flowers in window boxes under some of the first storey's windows (where addHall lays
    // them); and, on a tall hall's street face, now and then a banner of plain cloth.
    for (const hall of halls) {
        const hallAt = { x: hall.x, y: hall.base, z: hall.z, ry: hall.turn };
        const faces = [
            { across: hall.width, out: hall.depth / 2, turn: 0 },
            { across: hall.width, out: hall.depth / 2, turn: Math.PI },
            { across: hall.depth, out: hall.width / 2, turn: Math.PI / 2 },
            { across: hall.depth, out: hall.width / 2, turn: -Math.PI / 2 },
        ];
        const local = (face, along, y, out) => {
            const c = Math.cos(face.turn);
            const s = Math.sin(face.turn);
            return { x: along * c + out * s, y, z: -along * s + out * c, ry: face.turn };
        };
        const onto = faces
            .map((face) => {
                const middle = local(face, 0, 0, face.out + 1);
                const world = inFrame(middle.x, 0, middle.z, hallAt);
                return { face, gap: streetGap(world.x, world.z) };
            })
            .filter(({ gap }) => gap < 3.2)
            .sort((a, b) => a.gap - b.gap)
            .slice(0, 2);
        onto.forEach(({ face, gap }, which) => {
            for (const along of [-(face.across / 2 - 0.3), face.across / 2 - 0.3]) {
                const spot = local(face, along, 0, face.out + 0.62);
                const world = inFrame(spot.x, 0, spot.z, hallAt);
                if (clear(world.x, world.z, 0.3, 0.05) && !inHall(world.x, world.z, -0.3)) pot(world.x, world.z);
            }
            const columns = Math.max(1, Math.floor((face.across - 0.5) / 0.72));
            const spacing = (face.across - 0.5) / columns;
            const pieces = [];
            const plants = [];
            for (let column = 0; column < columns; column += 1) {
                if (random() > 0.42) continue;
                const along = -face.across / 2 + 0.25 + spacing * (column + 0.5);
                pieces.push(box(0.34, 0.1, 0.13, local(face, along, 2.48, face.out + 0.08), pick(TERRACOTTA)));
                for (let bloom = 0; bloom < 4; bloom += 1) {
                    const sprig = new SphereGeometry(bloom < 2 ? 0.06 : 0.045, 5, 3);
                    pose(sprig, local(face, along + random.range(-0.13, 0.13), 2.58 + random.range(0, 0.05), face.out + 0.1 + random.range(-0.03, 0.03)));
                    plants.push(paint(sprig, bloom < 2 ? pick(FOLIAGE) : pick(BLOOMS)));
                }
                counts.windowBoxes += 1;
            }
            if (which === 0 && gap < 1.5 && hall.height > 5.8 && random() < 0.6) {
                const color = pick(AWNINGS);
                pieces.push(box(0.66, 0.035, 0.035, local(face, 0, 5.1, face.out + 0.2), IRON));
                const banner = [
                    box(0.52, 1.36, 0.015, local(face, 0, 4.38, face.out + 0.14), color),
                    box(0.52, 0.08, 0.02, local(face, 0, 3.78, face.out + 0.145), CANVAS),
                    paint(pose(new CylinderGeometry(0.12, 0.12, 0.02, 14).rotateX(Math.PI / 2), local(face, 0, 4.6, face.out + 0.15)), GOLDS[3]),
                ];
                for (const piece of frame(banner, hallAt)) buckets.add('cloth', piece, { passable: true });
                counts.banners += 1;
            }
            for (const piece of frame(pieces, hallAt)) buckets.add('stone', piece);
            for (const piece of frame(plants, hallAt)) buckets.add('weed', unindexed(holdsFast(piece)), { passable: true });
        });
    }
    return counts;
}

// =============================================================================
// The Door in the Floor: the hostel on the promontory (Elm's first pick; a trial, ?hostel=off)
// =============================================================================

/**
 * The promontory at the wall's foot, south of the sun-dock, where E washed up "Like seaweed" and was carried "over
 * sand and dunes, across cobbles sparkling gold, to an old, white door" (Numbers by Paint, Episode 4, p. 60): how
 * far its sand reaches out from the wall's face along its length, [z, reach], read between smoothly.
 */
const SAND_REACH = [
    [6.9, 0], [7.5, 2.0], [9.0, 2.4], [11.0, 3.4], [13.0, 5.8], [14.6, 8.6], [15.9, 9.6], [17.1, 8.4],
    [18.2, 5.8], [19.5, 5.4], [22.0, 5.5], [24.0, 5.4], [25.2, 4.8], [25.8, 2.6], [26.3, 0],
];
const SAND_FROM = 6.9;
const SAND_TO = 26.3;
/** Over this far in from its edge, the sand rises out of the water to the beach. */
const SAND_SHORE = 1.4;
/** The dunes, [x, z, radius, height]: between the point where she washed up and the lane, and one by the wall. */
const DUNES = [[12.4, 10.4, 1.4, 0.62], [14.4, 12.3, 1.9, 1.05], [16.4, 14.6, 1.7, 0.85], [14.9, 16.3, 1.3, 0.55], [10.4, 12.2, 1.1, 0.45], [17.6, 16.8, 1.1, 0.42]];
/** The level the sand is laid to about the hostel and along the lane, and the cobbles' tops on it. */
const TERRACE_Y = 0.06;
const COBBLE_TOP = 0.13;
/** The lane of gold cobbles, from the dunes to the doorstep, and how wide. */
const LANE = [[10.9, 12.7], [11.05, 14.2], [11.45, 15.9], [11.6, 17.2]];
const LANE_WIDE = 1.3;
/** The hostel: its door face (north) and back (south), its sea face (east) and its back, in the sea-wall (west). */
const HOSTEL_NORTH = 17.8;
const HOSTEL_SOUTH = 24.8;
const HOSTEL_EAST = 13.4;
const HOSTEL_WEST = 9.0;
const HOSTEL_WALL = 0.24;
/** Its storeys' floors (the ground floor on the plinth), its eaves, and its roof's rise. */
const HOSTEL_FLOORS = [0.35, 2.75, 5.05];
const HOSTEL_EAVES = 7.35;
const HOSTEL_RISE = 1.9;
/** The plinth stands out this far all round; the doorstep before the door, and its top. */
const PLINTH_OUT = 0.15;
const DOORSTEP_TOP = 0.2;
/** The white door, on the north face: its middle (x), its width, and its height to where the arch springs. */
const DOOR_X = 11.6;
const DOOR_WIDE = 1.05;
const DOOR_SPRING = 1.85;
/** The stair, along the back (south) wall, rising east: from x, ten treads of this depth and rise, this wide in z. */
const STAIR_FROM = 10.3;
const STAIR_TREADS = 10;
const STAIR_TREAD = 0.26;
const STAIR_DEEP = 0.76;
/** The breakfast table (x0, x1, z0, z1), the bar along the sea-wall, and the cabinet with the key tray by the door. */
const BREAKFAST = [11.2, 12.1, 19.7, 22.7];
const BAR = [9.35, 9.95, 19.4, 22.4];
const CABINET = [12.45, 13.12, 18.05, 18.45];
/** Upstairs: the corridor along the sea-wall, the rooms along the sea (their fronts at this x), five to a floor. */
const CORRIDOR_EAST = 10.5;
const ROOMS = 5;
/** The doors upstairs, "in myriad new colours", and E's, "a hot, venomous green". */
const HOSTEL_DOORS = [0xd8465c, 0x3a74c8, 0xeaa82c, 0x7a4ab0, 0x2aa89c, 0xe86ea0, 0x5c9a3a, 0xe0703a, 0x3cb4e8, 0xa8c440, 0xb8342a, 0x8a66d0];
const E_DOOR = 0x4cf01e;
/**
 * The door swings in as the walk's shadow (or the hum) comes this near, and closes behind it when it has gone: near
 * enough that the silhouette on it is seen, coming up the lane, before it opens.
 */
const DOOR_OPENS = 1.5;
const DOOR_SWING = -1.3;

/** How far (x, z) is from the segment a–b ([x, z] pairs). */
function segmentDistance(x, z, [ax, az], [bx, bz]) {
    const ux = bx - ax;
    const uz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz)));
    return Math.hypot(x - ax - ux * t, z - az - uz * t);
}

/** How far (x, z) is from the lane's middle line. */
function laneDistance(x, z) {
    let best = Infinity;
    for (let index = 0; index < LANE.length - 1; index += 1) best = Math.min(best, segmentDistance(x, z, LANE[index], LANE[index + 1]));
    return best;
}

/** How far the sand reaches out from the wall's face at z (0 beyond its ends), its shore wandering a little. */
function sandReach(z) {
    if (z <= SAND_FROM || z >= SAND_TO) return 0;
    let at = 0;
    while (at < SAND_REACH.length - 2 && SAND_REACH[at + 1][0] < z) at += 1;
    const [z0, r0] = SAND_REACH[at];
    const [z1, r1] = SAND_REACH[at + 1];
    const before = SAND_REACH[Math.max(0, at - 1)][1];
    const after = SAND_REACH[Math.min(SAND_REACH.length - 1, at + 2)][1];
    const t = (z - z0) / (z1 - z0);
    const reach = 0.5 * (2 * r0 + (r1 - before) * t + (2 * before - 5 * r0 + 4 * r1 - after) * t * t + (3 * r0 - before - 3 * r1 + after) * t * t * t);
    const wander = (0.22 * Math.sin(z * 1.7) + 0.12 * Math.sin(z * 3.1 + 1.0)) * Math.min(1, Math.max(0, reach) / 1.5);
    return Math.max(0, reach + wander);
}

/**
 * The sand's height at (x, z), or null off it: rising out of the water at its edge to the beach, banked a little
 * against the wall, the dunes on it, and laid level about the hostel and under the lane.
 */
function sandHeight(x, z) {
    const reach = sandReach(z);
    if (reach <= 0.05) return null;
    const out = x - wallX(z);
    if (out < -0.5 || out > reach + 0.35) return null;
    const inFrom = reach - out;
    let y = SEA_LEVEL - 0.14 + 0.66 * MathUtils.smoothstep(inFrom, -0.2, SAND_SHORE);
    y += 0.18 * (1 - MathUtils.smoothstep(out, 0, 1.6)) * MathUtils.smoothstep(inFrom, 0, 1.0);
    for (const [dx, dz, radius, height] of DUNES) {
        const q = Math.hypot(x - dx, (z - dz) * 0.8) / radius;
        if (q < 1) y += height * (1 - q * q) ** 2 * MathUtils.smoothstep(inFrom, 0.2, 1.2);
    }
    const lane = 1 - MathUtils.smoothstep(laneDistance(x, z), LANE_WIDE / 2 + 0.1, LANE_WIDE / 2 + 0.9);
    const beyond = Math.hypot(Math.max(0, x - (HOSTEL_EAST + 0.6)), Math.max(0, HOSTEL_NORTH - 1.3 - z, z - (HOSTEL_SOUTH + 0.4)));
    const around = 1 - MathUtils.smoothstep(beyond, 0, 0.9);
    const level = Math.max(lane, around) * MathUtils.smoothstep(inFrom, 0.2, 0.9);
    return y + (TERRACE_Y - y) * level;
}

/**
 * The promontory's sand, laid in rows across it from inside the wall's face out to under the water, following its
 * shore; wet and darker at the water, a lace of foam where it meets it. The dune grass on it, and at its point,
 * where she washed up, weed and a few stones and a branch of driftwood thrown up with her.
 */
function buildPromontory(buckets, random) {
    const rows = Math.ceil((SAND_TO - SAND_FROM) / 0.2);
    const cols = 30;
    const positions = [];
    const index = [];
    const at = [];
    for (let row = 0; row <= rows; row += 1) {
        const z = SAND_FROM + (row / rows) * (SAND_TO - SAND_FROM);
        const reach = sandReach(z);
        const line = [];
        for (let col = 0; col <= cols; col += 1) {
            if (reach <= 0.05) {
                line.push(-1);
                continue;
            }
            const x = wallX(z) - 0.45 + (col / cols) * (reach + 0.75);
            line.push(positions.length / 3);
            positions.push(x, sandHeight(x, z) ?? SEA_LEVEL - 0.2, z);
        }
        at.push(line);
    }
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const a = at[row][col];
            const b = at[row][col + 1];
            const c = at[row + 1][col];
            const d = at[row + 1][col + 1];
            if (a < 0 || b < 0 || c < 0 || d < 0) continue;
            index.push(a, c, b, b, c, d);
        }
    }
    const sand = new BufferGeometry();
    sand.setAttribute('position', new Float32BufferAttribute(positions, 3));
    sand.setIndex(index);
    sand.computeVertexNormals();
    const dry = new Color(0xf0dcb0);
    const wet = new Color(0x9c7e52);
    const foam = new Color(0xf2eee4);
    paintBy(sand, (x, y, z, out) => {
        const mottle = noise2(x * 1.3, z * 1.3);
        out.copy(dry).multiplyScalar(0.92 + 0.14 * mottle);
        out.lerp(wet, 1 - MathUtils.smoothstep(y, SEA_LEVEL + 0.04, SEA_LEVEL + 0.34));
        out.lerp(foam, 0.85 * Math.exp(-(((y - SEA_LEVEL - 0.03) / 0.045) ** 2)));
    });
    buckets.add('sand', sand);

    // Dune grass, in tufts on the dunes, pale and dry, leaning away from the sea.
    const GRASS_BLADES = [0xd0c47e, 0xb8b46a, 0xe0cc8a, 0xa8ac62];
    for (const [dx, dz, radius, height] of DUNES) {
        const tufts = Math.round(6 + radius * 9 * height);
        for (let tuft = 0; tuft < tufts; tuft += 1) {
            const angle = random() * Math.PI * 2;
            const far = Math.sqrt(random()) * radius * 0.8;
            const tx = dx + Math.cos(angle) * far;
            const tz = dz + Math.sin(angle) * far * 1.25;
            const ty = sandHeight(tx, tz);
            if (ty === null || ty < SEA_LEVEL + 0.4) continue;
            const color = GRASS_BLADES[Math.floor(random() * GRASS_BLADES.length)];
            const blades = 5 + Math.floor(random() * 4);
            for (let blade = 0; blade < blades; blade += 1) {
                const tall = random.range(0.22, 0.48);
                const lean = random.range(0.05, 0.22);
                const strip = new PlaneGeometry(0.035, tall, 1, 3);
                strip.translate(0, tall / 2, 0);
                const position = strip.attributes.position;
                for (let vertex = 0; vertex < position.count; vertex += 1) {
                    const up = position.getY(vertex) / tall;
                    position.setX(vertex, position.getX(vertex) + up * up * lean);
                }
                swaying(strip, (bx, by) => by / tall, 0.35);
                pose(strip, { x: tx + random.range(-0.06, 0.06), y: ty - 0.02, z: tz + random.range(-0.06, 0.06), ry: random.range(-0.6, 0.6) - Math.PI / 2 });
                buckets.add('weed', paintBy(strip.toNonIndexed(), (bx, by, bz, out) => out.set(color).multiplyScalar(0.8 + 0.4 * Math.min(1, (by - ty) / tall))), { passable: true });
            }
        }
    }

    // At its point, where she washed up: weed thrown up on the sand, a few stones, a branch of driftwood.
    const point = { x: wallX(15.9) + 8.7, z: 15.9 };
    for (let clump = 0; clump < 9; clump += 1) {
        const x = point.x + random.range(-1.2, 0.6);
        const z = point.z + random.range(-1.4, 1.4);
        const y = sandHeight(x, z);
        if (y === null || y < SEA_LEVEL + 0.05) continue;
        const radius = random.range(0.08, 0.2);
        const lump = pose(new IcosahedronGeometry(radius, 0), { x, y: y + radius * 0.2, z, sy: 0.45, ry: random() * Math.PI });
        buckets.add('weed', holdsFast(paint(lump, WEED[Math.floor(random() * WEED.length)])), { passable: true });
    }
    for (let stone = 0; stone < 5; stone += 1) {
        const x = point.x + random.range(-1.6, 0.4);
        const z = point.z + random.range(-1.8, 1.8);
        const y = sandHeight(x, z);
        if (y === null) continue;
        const radius = random.range(0.1, 0.24);
        buckets.add('stone', paint(unindexed(pose(new DodecahedronGeometry(radius, 0), { x, y: y + radius * 0.35, z, sy: 0.6, ry: random() * Math.PI })), new Color(0xa89c84).offsetHSL(0, 0, random.range(-0.08, 0.06))));
    }
    const driftFrom = new Vector3(point.x - 1.1, 0, point.z + 0.6);
    const drift = [0, 0.35, 0.7, 1].map((t) => {
        const x = driftFrom.x + t * 1.5;
        const z = driftFrom.z - t * 0.5 + Math.sin(t * 3) * 0.12;
        return new Vector3(x, (sandHeight(x, z) ?? 0) + 0.06, z);
    });
    buckets.add('stone', tube(drift, 0.055, 0x8e7a62, 10, 5));
}

/** The lane of gold cobbles, "sparkling gold", row by row from the dunes to the doorstep, each stone a gold of its own. */
function buildLane(buckets, random) {
    const golds = [...GOLDS, 0xf8dc90, 0xe8c070];
    let row = 0;
    for (let segment = 0; segment < LANE.length - 1; segment += 1) {
        const [ax, az] = LANE[segment];
        const [bx, bz] = LANE[segment + 1];
        const length = Math.hypot(bx - ax, bz - az);
        const wx = (bx - ax) / length;
        const wz = (bz - az) / length;
        const ry = Math.atan2(wx, wz);
        for (let along = 0; along < length; along += 0.21) {
            const stagger = row % 2 ? 0.1 : 0;
            for (let across = -3; across <= 3; across += 1) {
                const u = across * 0.2 + stagger;
                if (Math.abs(u) > LANE_WIDE / 2 - 0.1) continue;
                const x = ax + wx * along - wz * (u + random.range(-0.02, 0.02));
                const z = az + wz * along + wx * (u + random.range(-0.02, 0.02));
                const color = new Color(golds[Math.floor(random() * golds.length)]).offsetHSL(random.range(-0.01, 0.01), random.range(-0.05, 0.05), random.range(-0.05, 0.06));
                buckets.add('gold', bevelBox(0.18, 0.09, 0.17, { x, y: COBBLE_TOP - 0.045, z, ry: ry + random.range(-0.15, 0.15) }, color, 0.035));
            }
            row += 1;
        }
    }
}

/** An arch-topped shape: straight sides to `spring`, a half-round above, `width` across, standing on y = 0. */
function archShape(width, spring) {
    const shape = new Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, spring);
    shape.absarc(0, spring, width / 2, 0, Math.PI, false);
    shape.lineTo(-width / 2, 0);
    return shape;
}

/** An arch-topped slab, `thick` deep, facing +z (its back at -thick/2), posed at `at`. */
function arched(width, spring, thick, at, color, segments = 10) {
    const geometry = new ExtrudeGeometry(archShape(width, spring), { depth: thick, bevelEnabled: false, curveSegments: segments });
    geometry.translate(0, 0, -thick / 2);
    return paint(pose(geometry, at), color);
}

/** An arch-topped ring round an opening: `band` wide, `thick` deep, facing +z. */
function archRing(width, spring, band, thick, at, color, segments = 10) {
    const shape = archShape(width + band * 2, spring + band);
    shape.holes.push(archShape(width, spring));
    // (The outer arch stands on y = 0 too: the hole's straight sides run down to it.)
    const geometry = new ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: segments });
    geometry.translate(0, 0, -thick / 2);
    return paint(pose(geometry, at), color);
}

/** A flat quad of the silhouette (silhouette.js), `size` across, facing `ry` (0 faces +z), in the atlas's cell. */
function silhouetteQuad(size, at, color, cell) {
    const quad = new PlaneGeometry(size, size);
    const uv = quad.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setX(vertex, cell * 0.5 + uv.getX(vertex) * 0.5);
    return paint(pose(quad, at), color);
}

/**
 * The Door in the Floor, the hostel where Allison carried E (Numbers by Paint, Episode 4, pp. 60-61), standing on
 * the promontory against the sea-wall's foot, its upper storeys over the wall's top: pale gold brick, three storeys
 * of arched windows, lit and dark and shuttered, under a slate roof with a mouse for its weathervane. "An old, white
 * door imprinted with the silhouette of a mouse and two jugs of ale" (silhouette.js), shining, that swings in as the
 * walk's shadow comes to it (as Allison swung them in). Inside, the breakfast table she was set down on, the bar,
 * the cabinet of keys, the stair; upstairs, a corridor of doors "all imprinted with the same silhouette as the
 * entrance, but in myriad new colours", and hers, "a hot, venomous green, while the mouse and the jugs were a rainbow
 * kaleidoscope", and "a tall, down-quilted bed" in "the light through the arched window". A stream of its own.
 * Returns its floor for walking (the sand, the lane, the doorstep and the breakfast room: the walls, the furniture
 * and the stair left out, for a floor given exactly is its own bound), the door, and what a touch finds.
 */
async function buildHostel({ buckets, extras, still, materials }) {
    const random = createRandom(6061);
    buildPromontory(buckets, random);
    buildLane(buckets, random);

    const BRICK_PALE = 0xecd8a4;
    const TRIM = 0xd8ceb2;
    const PLINTH = 0xb4a684;
    const SLATE = 0x564a5c;
    const SLATE_RIDGE = 0x3c3444;
    const DOOR_WHITE = 0xeee8da;
    const DOOR_PANEL = 0xdcd4c2;
    const BRASS = 0xc9a24e;
    const DARK_WINDOW = 0x241a18;
    const SHUTTERS = [0x5e7a52, 0x8a4a32, 0x4a6a8a];
    const WOOD = TIMBER;
    const t = HOSTEL_WALL;
    const [ground, first, second] = HOSTEL_FLOORS;
    const width = HOSTEL_EAST - HOSTEL_WEST;
    const depth = HOSTEL_SOUTH - HOSTEL_NORTH;
    const cx = (HOSTEL_EAST + HOSTEL_WEST) / 2;
    const cz = (HOSTEL_NORTH + HOSTEL_SOUTH) / 2;
    const tall = HOSTEL_EAVES - ground;
    const inner = { x0: HOSTEL_WEST + t, x1: HOSTEL_EAST - t, z0: HOSTEL_NORTH + t, z1: HOSTEL_SOUTH - t };

    // The plinth, and the doorstep up to it.
    buckets.add('stone', bevelBox(width + PLINTH_OUT * 2, ground - (SEA_LEVEL - 0.3), depth + PLINTH_OUT * 2, { x: cx, y: (ground + SEA_LEVEL - 0.3) / 2, z: cz }, PLINTH, 0.05));
    buckets.add('stone', bevelBox(1.6, DOORSTEP_TOP + 0.1, 0.62, { x: DOOR_X, y: (DOORSTEP_TOP - 0.1) / 2, z: HOSTEL_NORTH - PLINTH_OUT - 0.31 }, TRIM, 0.04));

    // The walls: the sea face and the back whole, the south face whole, the north face about the doorway; the gables.
    const walls = [
        box(t, tall, depth, { x: HOSTEL_EAST - t / 2, y: ground + tall / 2, z: cz }, BRICK_PALE),
        box(t, tall, depth, { x: HOSTEL_WEST + t / 2, y: ground + tall / 2, z: cz }, BRICK_PALE),
        box(width, tall, t, { x: cx, y: ground + tall / 2, z: HOSTEL_SOUTH - t / 2 }, BRICK_PALE),
    ];
    const left = DOOR_X - DOOR_WIDE / 2 - 0.02;
    const right = DOOR_X + DOOR_WIDE / 2 + 0.02;
    const doorTop = ground + DOOR_SPRING + DOOR_WIDE / 2 + 0.03;
    const nz = HOSTEL_NORTH + t / 2;
    walls.push(box(left - HOSTEL_WEST, tall, t, { x: (HOSTEL_WEST + left) / 2, y: ground + tall / 2, z: nz }, BRICK_PALE));
    walls.push(box(HOSTEL_EAST - right, tall, t, { x: (right + HOSTEL_EAST) / 2, y: ground + tall / 2, z: nz }, BRICK_PALE));
    walls.push(box(right - left, HOSTEL_EAVES - doorTop, t, { x: DOOR_X, y: (doorTop + HOSTEL_EAVES) / 2, z: nz }, BRICK_PALE));
    for (const z of [HOSTEL_NORTH + t / 2, HOSTEL_SOUTH - t / 2]) {
        const end = gable(width, HOSTEL_RISE, t, { x: cx, y: HOSTEL_EAVES, z }, BRICK_PALE);
        walls.push(end);
    }
    for (const wall of walls) buckets.add('bricking', wall);

    // Stone trims: a course at each floor, the eaves' cornice, quoins at the sea corners.
    const trims = [];
    for (const y of [first - 0.06, second - 0.06]) {
        trims.push(box(0.1, 0.12, depth + 0.1, { x: HOSTEL_EAST + 0.04, y, z: cz }, TRIM));
        trims.push(box(width + 0.1, 0.12, 0.1, { x: cx, y, z: HOSTEL_NORTH - 0.04 }, TRIM));
    }
    trims.push(bevelBox(0.3, 0.2, depth + 0.3, { x: HOSTEL_EAST + 0.08, y: HOSTEL_EAVES - 0.05, z: cz }, TRIM, 0.04));
    trims.push(bevelBox(0.3, 0.2, depth + 0.3, { x: HOSTEL_WEST - 0.08, y: HOSTEL_EAVES - 0.05, z: cz }, TRIM, 0.04));
    for (let course = 0; course * 0.46 < tall - 0.3; course += 1) {
        const long = course % 2 === 0;
        for (const z of [HOSTEL_NORTH + (long ? 0.22 : 0.15), HOSTEL_SOUTH - (long ? 0.22 : 0.15)]) {
            trims.push(bevelBox(0.07, 0.4, long ? 0.44 : 0.3, { x: HOSTEL_EAST + 0.02, y: ground + 0.23 + course * 0.46, z }, TRIM, 0.02));
        }
    }
    for (const trim of trims) buckets.add('stone', trim);

    // The roof: two slopes of slate over the eaves, a ridge, a chimney at the back, and on the front of the ridge
    // a mouse for a weathervane (the silhouette's, as it were, looking out to sea).
    const half = width / 2 + 0.28;
    const slope = Math.atan2(HOSTEL_RISE, width / 2);
    const run = Math.hypot(half, HOSTEL_RISE * (half / (width / 2)));
    for (const side of [-1, 1]) {
        buckets.add('brick', box(run, 0.12, depth + 0.5, {
            x: cx + side * (half / 2), y: HOSTEL_EAVES + HOSTEL_RISE - (half / 2) * Math.tan(slope) + 0.06, z: cz, rz: -side * slope,
        }, SLATE));
    }
    buckets.add('brick', box(0.22, 0.16, depth + 0.56, { x: cx, y: HOSTEL_EAVES + HOSTEL_RISE + 0.06, z: cz }, SLATE_RIDGE));
    buckets.add('bricking', bevelBox(0.5, 1.6, 0.5, { x: cx - 0.9, y: HOSTEL_EAVES + HOSTEL_RISE * 0.55 + 0.5, z: HOSTEL_SOUTH - 1.2 }, BRICK_PALE, 0.04));
    buckets.add('stone', box(0.62, 0.1, 0.62, { x: cx - 0.9, y: HOSTEL_EAVES + HOSTEL_RISE * 0.55 + 1.32, z: HOSTEL_SOUTH - 1.2 }, TRIM));
    const vane = { x: cx, y: HOSTEL_EAVES + HOSTEL_RISE + 0.12, z: HOSTEL_NORTH + 0.5 };
    const vanePieces = [
        cylinder(0.02, 0.02, 0.7, 4, { x: vane.x, y: vane.y + 0.35, z: vane.z }, STEEL_DARK),
        ball(0.16, { x: vane.x, y: vane.y + 0.82, z: vane.z, sx: 1.5, sz: 0.8 }, STEEL_DARK, 8, 5),
        ball(0.1, { x: vane.x + 0.25, y: vane.y + 0.9, z: vane.z }, STEEL_DARK, 8, 5),
        ball(0.06, { x: vane.x + 0.2, y: vane.y + 1.02, z: vane.z }, STEEL_DARK, 6, 4),
        tube([new Vector3(vane.x - 0.22, vane.y + 0.8, vane.z), new Vector3(vane.x - 0.42, vane.y + 0.92, vane.z), new Vector3(vane.x - 0.5, vane.y + 1.08, vane.z)], 0.012, STEEL_DARK, 6, 3),
    ];
    for (const piece of vanePieces) buckets.add('steel', piece, { passable: true });

    // The windows, arched, some lit, some dark, some shuttered: along the sea five to a floor (and one by the stair),
    // over the door, and over the sea-wall toward the city.
    const windowAt = (x, y, z, ry, kind, wide = 0.6, spring = 0.95) => {
        const at = { x, y, z, ry };
        if (kind === 'lit' || kind === 'gold') {
            buckets.add('glow', arched(wide, spring, 0.04, at, kind === 'gold' ? light(0xffcf6a, 3.6) : WINDOW));
        } else {
            buckets.add('brick', arched(wide, spring, 0.04, at, DARK_WINDOW));
        }
        if (kind === 'shut') {
            const shade = SHUTTERS[Math.floor(random() * SHUTTERS.length)];
            for (const side of [-1, 1]) {
                const leaf = [box(wide / 2 - 0.02, spring, 0.04, { x: side * (wide / 4), y: spring / 2, z: 0.03 }, shade)];
                for (let slat = 1; slat < 6; slat += 1) leaf.push(box(wide / 2 - 0.06, 0.02, 0.02, { x: side * (wide / 4), y: (spring * slat) / 6, z: 0.06 }, new Color(shade).multiplyScalar(0.7)));
                for (const piece of frame(leaf, at)) buckets.add('brick', piece);
            }
        }
        buckets.add('stone', archRing(wide, spring, 0.07, 0.07, at, TRIM));
        for (const piece of frame([box(wide + 0.22, 0.07, 0.14, { y: -0.035, z: 0.04 }, TRIM)], at)) buckets.add('stone', piece);
    };
    const bays = Array.from({ length: ROOMS }, (_, bay) => inner.z0 + ((inner.z1 - 0.8 - inner.z0) * (bay + 0.5)) / ROOMS);
    const eastKinds = [
        ['lit', 'lit', 'lit', 'lit', 'lit'],
        ['lit', 'shut', 'dark', 'lit', 'shut'],
        ['gold', 'dark', 'lit', 'shut', 'lit'],
    ];
    HOSTEL_FLOORS.forEach((floor, storey) => {
        bays.forEach((z, bay) => windowAt(HOSTEL_EAST + 0.01, floor + (storey ? 0.72 : 0.62), z, Math.PI / 2, eastKinds[storey][bay]));
        windowAt(HOSTEL_EAST + 0.01, floor + 0.9, inner.z1 - 0.4, Math.PI / 2, storey === 1 ? 'dark' : 'lit', 0.4, 0.6);
    });
    windowAt(DOOR_X, first + 0.72, HOSTEL_NORTH - 0.01, Math.PI, 'lit');
    windowAt(DOOR_X, second + 0.72, HOSTEL_NORTH - 0.01, Math.PI, 'dark');
    windowAt(DOOR_X - 1.55, ground + 0.75, HOSTEL_NORTH - 0.01, Math.PI, 'lit', 0.5, 0.75);
    windowAt(DOOR_X + 1.2, first + 0.72, HOSTEL_NORTH - 0.01, Math.PI, 'shut', 0.5, 0.8);
    for (const [z, kind] of [[19.2, 'lit'], [21.3, 'dark'], [23.4, 'lit']]) windowAt(HOSTEL_WEST - 0.01, second + 0.8, z, -Math.PI / 2, kind, 0.5, 0.8);
    buckets.add('glow', cylinder(0.26, 0.26, 0.04, 16, { x: cx, y: HOSTEL_EAVES + 0.75, z: HOSTEL_NORTH - 0.01, rx: Math.PI / 2 }, WINDOW_LOW));
    buckets.add('stone', paint(pose(new TorusGeometry(0.29, 0.05, 5, 16), { x: cx, y: HOSTEL_EAVES + 0.75, z: HOSTEL_NORTH - 0.03 }), TRIM));

    await breathe();
    // The doorway's arch in stone, and a lamp on its bracket beside the door.
    buckets.add('stone', archRing(DOOR_WIDE + 0.04, DOOR_SPRING, 0.12, 0.1, { x: DOOR_X, y: ground, z: HOSTEL_NORTH - 0.02, ry: Math.PI }, TRIM));
    buckets.add('steel', box(0.05, 0.05, 0.36, { x: right + 0.42, y: ground + 2.25, z: HOSTEL_NORTH - 0.18 }, STEEL_DARK), { passable: true });
    buckets.add('steel', cylinder(0.02, 0.02, 0.22, 4, { x: right + 0.42, y: ground + 2.12, z: HOSTEL_NORTH - 0.36 }, STEEL_DARK), { passable: true });
    buckets.add('glow', ball(0.12, { x: right + 0.42, y: ground + 1.94, z: HOSTEL_NORTH - 0.36 }, LAMP, 8, 6));

    await breathe();
    // Inside: the floors above (open over the stair, along the back), the breakfast table with its benches and its
    // breakfast, the bar along the sea-wall with its bottles, the cabinet with its tray of keys, lamps over the table.
    const stairZ = inner.z1 - STAIR_DEEP / 2;
    for (const floor of [first, second]) {
        buckets.add('stone', box(inner.x1 - inner.x0, 0.14, inner.z1 - STAIR_DEEP - inner.z0, { x: (inner.x0 + inner.x1) / 2, y: floor - 0.07, z: (inner.z0 + inner.z1 - STAIR_DEEP) / 2 }, WOOD[1]));
        buckets.add('stone', box(STAIR_FROM - inner.x0, 0.14, STAIR_DEEP, { x: (inner.x0 + STAIR_FROM) / 2, y: floor - 0.07, z: stairZ }, WOOD[1]));
    }
    for (const [floor, rise] of [[ground, (first - ground) / STAIR_TREADS], [first, (second - first) / STAIR_TREADS]]) {
        for (let tread = 0; tread < STAIR_TREADS; tread += 1) {
            const top = floor + (tread + 1) * rise;
            buckets.add('brick', box(STAIR_TREAD, top - floor, STAIR_DEEP, { x: STAIR_FROM + (tread + 0.5) * STAIR_TREAD, y: (floor + top) / 2, z: stairZ }, WOOD[tread % 2]));
        }
    }
    const [tx0, tx1, tz0, tz1] = BREAKFAST;
    const table = [
        bevelBox(tx1 - tx0, 0.06, tz1 - tz0, { x: (tx0 + tx1) / 2, y: ground + 0.74, z: (tz0 + tz1) / 2 }, WOOD[1], 0.02),
    ];
    for (const x of [tx0 + 0.08, tx1 - 0.08]) for (const z of [tz0 + 0.1, tz1 - 0.1]) table.push(box(0.07, 0.71, 0.07, { x, y: ground + 0.355, z }, WOOD[2]));
    for (const x of [tx0 - 0.35, tx1 + 0.35]) {
        table.push(box(0.3, 0.05, tz1 - tz0 - 0.2, { x, y: ground + 0.44, z: (tz0 + tz1) / 2 }, WOOD[0]));
        for (const z of [tz0 + 0.2, tz1 - 0.2]) table.push(box(0.26, 0.42, 0.05, { x, y: ground + 0.21, z }, WOOD[2]));
    }
    for (const piece of table) buckets.add('brick', piece);
    const breakfast = [];
    for (let place = 0; place < 6; place += 1) {
        const side = place % 2 ? 1 : -1;
        const z = tz0 + 0.45 + Math.floor(place / 2) * 0.95;
        const x = (tx0 + tx1) / 2 + side * 0.25;
        breakfast.push(cylinder(0.11, 0.1, 0.015, 10, { x, y: ground + 0.78, z }, 0xf2eee4));
        breakfast.push(cylinder(0.035, 0.03, 0.06, 7, { x: x + side * -0.02, y: ground + 0.8, z: z + 0.17 }, 0xe8e2d4));
    }
    breakfast.push(ball(0.09, { x: (tx0 + tx1) / 2, y: ground + 0.84, z: (tz0 + tz1) / 2, sy: 0.8 }, 0x7a4a6e, 8, 6));
    breakfast.push(ball(0.12, { x: (tx0 + tx1) / 2, y: ground + 0.82, z: tz0 + 0.95, sx: 1.6, sy: 0.6 }, 0xc8903e, 8, 5));
    for (const piece of breakfast) buckets.add('stone', piece);
    const [bx0, bx1, bz0, bz1] = BAR;
    buckets.add('brick', bevelBox(bx1 - bx0, 1.02, bz1 - bz0, { x: (bx0 + bx1) / 2, y: ground + 0.51, z: (bz0 + bz1) / 2 }, WOOD[2], 0.03));
    buckets.add('stone', box(bx1 - bx0 + 0.08, 0.05, bz1 - bz0 + 0.06, { x: (bx0 + bx1) / 2, y: ground + 1.045, z: (bz0 + bz1) / 2 }, 0xcdbf9c));
    for (let bottle = 0; bottle < 9; bottle += 1) {
        const z = bz0 + 0.25 + bottle * 0.32;
        const color = [0x3c7a52, 0x8a3a2e, 0xc8a04a, 0x3a5a8a][bottle % 4];
        buckets.add('glass', cylinder(0.035, 0.04, 0.26, 6, { x: bx0 + 0.14, y: ground + 1.2, z }, color));
    }
    const [kx0, kx1, kz0, kz1] = CABINET;
    buckets.add('brick', bevelBox(kx1 - kx0, 1.4, kz1 - kz0, { x: (kx0 + kx1) / 2, y: ground + 0.7, z: (kz0 + kz1) / 2 }, WOOD[0], 0.02));
    buckets.add('brick', box(0.46, 0.04, 0.34, { x: (kx0 + kx1) / 2, y: ground + 0.92, z: kz1 + 0.12 }, WOOD[1]));
    for (let key = 0; key < 4; key += 1) buckets.add('stone', box(0.05, 0.015, 0.1, { x: kx0 + 0.16 + key * 0.11, y: ground + 0.95, z: kz1 + 0.14 }, BRASS));
    for (const z of [tz0 + 0.8, tz1 - 0.8]) {
        buckets.add('steel', cylinder(0.008, 0.008, first - ground - 1.75, 3, { x: (tx0 + tx1) / 2, y: (first + ground + 1.75) / 2 - 0.12, z }, STEEL_DARK), { passable: true });
        buckets.add('brick', cone(0.2, 0.16, 10, { x: (tx0 + tx1) / 2, y: ground + 1.68, z }, 0x4a3a2c));
        buckets.add('glow', ball(0.06, { x: (tx0 + tx1) / 2, y: ground + 1.6, z }, LAMP, 6, 4));
    }

    // Upstairs, on each floor: the corridor along the sea-wall; the rooms along the sea, their walls between them;
    // doors on both sides of the corridor, and one at its end, each of a colour of its own and its silhouette another.
    const silhouettes = [];
    const doorColors = [...HOSTEL_DOORS];
    let door = 0;
    const doorOn = (x, y, z, ry, color, glyph, cell = 0) => {
        buckets.add('brick', box(0.72, 1.85, 0.05, { x, y: y + 0.925, z, ry }, color));
        const out = new Vector3(0, 0, 0.04).applyAxisAngle(UP, ry);
        silhouettes.push(silhouetteQuad(0.5, { x: x + out.x, y: y + 1.22, z: z + out.z, ry }, glyph, cell));
    };
    const roomDepth = (inner.z1 - STAIR_DEEP - inner.z0) / ROOMS;
    for (const [storey, floor] of [[1, first], [2, second]]) {
        const room = floor + 2.15;
        buckets.add('stone', box(0.1, room - floor, inner.z1 - STAIR_DEEP - inner.z0, { x: CORRIDOR_EAST + 0.05, y: (floor + room) / 2, z: (inner.z0 + inner.z1 - STAIR_DEEP) / 2 }, BRICK_PALE));
        for (let wall = 1; wall < ROOMS; wall += 1) {
            buckets.add('stone', box(inner.x1 - CORRIDOR_EAST - 0.1, room - floor, 0.08, { x: (CORRIDOR_EAST + 0.1 + inner.x1) / 2, y: (floor + room) / 2, z: inner.z0 + wall * roomDepth }, BRICK_PALE));
        }
        for (let bay = 0; bay < ROOMS; bay += 1) {
            const z = inner.z0 + (bay + 0.5) * roomDepth;
            const hers = storey === 2 && bay === 0;
            const color = hers ? E_DOOR : doorColors[door % doorColors.length];
            // (Each silhouette a colour of its own: the door's own, turned half round the wheel, and lit.)
            const glyph = hers ? light(0xffffff, 1.35) : new Color(color).offsetHSL(0.5, 0.1, 0.25).multiplyScalar(1.25);
            doorOn(CORRIDOR_EAST - 0.01, floor, z, -Math.PI / 2, color, glyph, hers ? 1 : 0);
            door += 1;
            const across = doorColors[(door + 5) % doorColors.length];
            doorOn(inner.x0 + 0.01, floor, z, Math.PI / 2, across, new Color(across).offsetHSL(0.5, 0.1, 0.25).multiplyScalar(1.25));
            door += 1;
            // A bed in each room along the sea (hers, tall and down-quilted, by the arched window).
            const bedZ = inner.z0 + (bay + 1) * roomDepth - 0.48;
            const quilt = hers ? 0xf6f1e6 : [0xc8b8d8, 0xe0c8a8, 0xb8d0c8, 0xe8b8b0][bay % 4];
            const bed = hers
                ? [
                    box(1.9, 0.62, 0.84, { x: CORRIDOR_EAST + 1.25, y: floor + 0.31, z: bedZ }, WOOD[2]),
                    bevelBox(1.86, 0.34, 0.86, { x: CORRIDOR_EAST + 1.26, y: floor + 0.8, z: bedZ }, quilt, 0.12),
                    ball(0.2, { x: CORRIDOR_EAST + 0.5, y: floor + 1.0, z: bedZ, sx: 1.9, sy: 0.7 }, 0xfaf8f2, 8, 5),
                    box(0.08, 1.5, 0.9, { x: CORRIDOR_EAST + 0.22, y: floor + 0.75, z: bedZ }, WOOD[2]),
                ]
                : [
                    box(1.8, 0.36, 0.78, { x: CORRIDOR_EAST + 1.2, y: floor + 0.18, z: bedZ }, WOOD[0]),
                    bevelBox(1.76, 0.14, 0.8, { x: CORRIDOR_EAST + 1.2, y: floor + 0.43, z: bedZ }, quilt, 0.05),
                ];
            for (const piece of bed) buckets.add(hers ? 'cloth' : 'brick', piece);
        }
        doorOn((inner.x0 + CORRIDOR_EAST) / 2, floor, inner.z0 + 0.01, 0, doorColors[door % doorColors.length], new Color(doorColors[(door + 3) % doorColors.length]).multiplyScalar(1.25));
        door += 1;
    }

    // The silhouettes upstairs, one draw for all; the white door, with its own, shining, on a hinge that swings it in.
    const silhouetteMaterial = new MeshBasicMaterial({
        map: silhouetteAtlas(),
        vertexColors: true,
        transparent: true,
        alphaTest: 0.35,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const group = new Group();
    group.name = 'hostel';
    const upstairs = new Mesh(mergeGeometries(silhouettes.map((quad) => unindexed(quad)), false), silhouetteMaterial);
    upstairs.name = 'hostel-silhouettes';
    group.add(upstairs);

    const hinge = new Group();
    hinge.name = 'hostel-door';
    hinge.position.set(DOOR_X - DOOR_WIDE / 2, ground, HOSTEL_NORTH + t / 2);
    const leafPieces = [arched(DOOR_WIDE - 0.02, DOOR_SPRING, 0.07, { x: DOOR_WIDE / 2 }, DOOR_WHITE)];
    for (const [py, ph] of [[0.35, 0.6], [1.1, 0.62]]) {
        for (const side of [-1, 1]) leafPieces.push(box(0.36, ph, 0.02, { x: DOOR_WIDE / 2 + side * 0.22, y: py + ph / 2, z: -0.045 }, DOOR_PANEL));
    }
    for (const face of [-1, 1]) leafPieces.push(ball(0.045, { x: DOOR_WIDE - 0.14, y: 1.0, z: face * 0.06 }, BRASS, 8, 6));
    const leaf = new Mesh(mergeGeometries(leafPieces.map((piece) => unindexed(piece)), false), materials.brick);
    leaf.name = 'hostel-door-leaf';
    hinge.add(leaf);
    const front = new Mesh(silhouetteQuad(0.74, { x: DOOR_WIDE / 2, y: 1.3, z: -0.06, ry: Math.PI }, light(0xffe6a8, 1.9), 0), silhouetteMaterial);
    front.name = 'hostel-door-silhouette';
    hinge.add(front);
    group.add(hinge);
    extras.push(group);

    let swing = 0;
    const doorway = {
        leaf,
        /** Every frame: swing in as the walk's shadow comes near (walk.js's state), and to again once it's gone. */
        update(dt, walker) {
            const near = Boolean(walker?.walking) && Math.hypot(walker.position.x - DOOR_X, walker.position.z - HOSTEL_NORTH) < DOOR_OPENS;
            const want = near ? DOOR_SWING : 0;
            swing += (want - swing) * (still ? 1 : 1 - Math.exp(-5 * dt));
            hinge.rotation.y = swing;
        },
    };

    // Where a body may stand: the sand (not in the sea-wall), the lane's cobbles, the doorstep, the plinth's ledge and
    // the breakfast room; never the walls (the doorway aside), the table, the bar, the cabinet or the stair. (A hum,
    // flying, goes over the table and the bar: `flying`, walk.js.)
    const girth = 0.12;
    const within = (x, z, [x0, x1, z0, z1], pad = girth) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
    const plinth = [HOSTEL_WEST - PLINTH_OUT, HOSTEL_EAST + PLINTH_OUT, HOSTEL_NORTH - PLINTH_OUT, HOSTEL_SOUTH + PLINTH_OUT];
    const floorAt = (x, z, flying = false) => {
        if (x < wallX(z) + girth) return null;
        if (within(x, z, plinth, 0)) {
            const inDoorway = Math.abs(x - DOOR_X) < DOOR_WIDE / 2 - girth && z < inner.z0 + girth;
            const inWalls = x > HOSTEL_WEST - girth && x < HOSTEL_EAST + girth && z > HOSTEL_NORTH - girth && z < HOSTEL_SOUTH + girth;
            const inRoom = x > inner.x0 + girth && x < inner.x1 - girth && z > inner.z0 + girth && z < inner.z1 - girth;
            if (inWalls && !inRoom && !inDoorway) return null;
            if (inRoom) {
                if (within(x, z, CABINET) || (!flying && (within(x, z, BREAKFAST) || within(x, z, BAR)))) return null;
                if (x > STAIR_FROM - girth && z > inner.z1 - STAIR_DEEP - girth) return null;
            }
            return ground;
        }
        if (Math.abs(x - DOOR_X) < 0.8 && z > HOSTEL_NORTH - PLINTH_OUT - 0.62 && z <= HOSTEL_NORTH - PLINTH_OUT) return DOORSTEP_TOP;
        const y = sandHeight(x, z);
        if (y === null || y < SEA_LEVEL + 0.14) return null;
        return laneDistance(x, z) < LANE_WIDE / 2 - 0.05 ? COBBLE_TOP : y;
    };

    return {
        floor: { floorAt },
        // (Its room's floor, wall to wall, for a shade begun on it to lie on, under the furniture too, and end at the walls.)
        surface: { surfaceAt: (x, z) => (x > inner.x0 && x < inner.x1 && z > inner.z0 && z < inner.z1 ? ground : null) },
        door: doorway,
        // A touch on the door: it's knocked on (and the mouse, perhaps, has its joke ready).
        touch: [{ kind: 'door', center: new Vector3(DOOR_X, ground + 1.3, HOSTEL_NORTH - 0.05), radius: 0.85, fragment: 'nbp-e4-door-in-the-floor-1' }],
    };
}

/** Cassandra's house: its walls (x runs from its back to its face on the street, z along its face). */
const CASSANDRA_BACK = -27.4;
const CASSANDRA_FRONT = -23.6;
const CASSANDRA_NORTH = -4.6;
const CASSANDRA_SOUTH = 0.4;
/** Its storeys, its plinth (the doorway's sill is the plinth's top), and the rise of its gable over the eaves. */
const CASSANDRA_STOREY = 2.5;
const CASSANDRA_PLINTH = 0.24;
const CASSANDRA_RISE = 2.7;
/** The face's thickness, and the hall behind the door (how deep, how wide, how tall): lit, and hers. */
const CASSANDRA_FACE = 0.2;
const CASSANDRA_HALL = 1.25;
const CASSANDRA_HALL_WIDE = 1.24;
const CASSANDRA_HALL_TALL = 2.36;
/** The seeress' door: its middle (z), its width, and where its arch springs. */
const CASSANDRA_DOOR_Z = -2.1;
const CASSANDRA_DOOR_WIDE = 1.0;
const CASSANDRA_DOOR_SPRING = 1.72;
/** How far the door opens when it's answered (warily, not all the way). */
const CASSANDRA_DOOR_OPEN = 1.15;
/**
 * The wrought-gold fence: its line along the street (x), the yard's ends (z), and its height, which a hum flies over
 * (hollows-map.js: a hum's band begins at 1.1 above the ground) and a walker can't pass.
 */
const CASSANDRA_FENCE = -20.2;
const CASSANDRA_YARD_NORTH = -4.95;
const CASSANDRA_YARD_SOUTH = 0.75;
const CASSANDRA_FENCE_TALL = 0.98;
/**
 * The boulevard of golden pebbles, along the fence: x0, x1, z0, z1; and how far it, and the yard, lie over the ground
 * (over the high street's paving, which runs on to her fence: buildPavements lays it 0.05 up).
 */
const CASSANDRA_BOULEVARD = [-20.05, -17.55, -4.95, 1.35];
const CASSANDRA_PAVED = 0.068;
/** The shadow's first answer (the book's words, p. 64), and the scene's beats (seconds from the knock). */
const CASSANDRA_SAYS = 'She’s not in, but this is her address, sure.';
const KNOCK_ANSWERED = 0.95;
const KNOCK_SPEAKS = 1.6;
const KNOCK_SLAMS = 5.6;
/** The faces at the street's windows, after the slam: how long until they're all lit, how long they stay. */
const FACES_RISE = 1.6;
const FACES_STAY = 8.5;
/** Who comes this near the door (or to the gate, from the street) knocks; gone this far, they may knock again. */
const KNOCK_NEAR = 2.6;
const KNOCK_AT_GATE = 1.25;
const KNOCK_AGAIN = 6;

/** Whether (x, z), give or take r, is on Cassandra's lot: the house, its yard, and the boulevard along its fence. */
function onCassandrasLot(x, z, r = 0) {
    const [bx0, bx1, bz0, bz1] = CASSANDRA_BOULEVARD;
    const houseAndYard = x > CASSANDRA_BACK - 0.3 - r && x < CASSANDRA_FENCE + 0.15 + r && z > CASSANDRA_YARD_NORTH - 0.15 - r && z < CASSANDRA_YARD_SOUTH + 0.15 + r;
    return houseAndYard || (x > bx0 - r && x < bx1 + r && z > bz0 - r && z < bz1 + r);
}

/**
 * Cassandra's house (Numbers by Paint, Episode 4, pp. 63-65; Episode 6, p. 90; Elm's next place after the hostel; a
 * trial: ?cassandra=off). Allison: "It's somewhere near all the plazas, near the centre, where all the bridges meet."
 * So it stands at the plaza's west end, past the golden trees, where the halls rise either side and the golden bridges
 * cross between them, the city's outer edge behind it ("her little townhouse in the shining fray, the golden mess of
 * the outer city"). "Some time passed before she found the house, a wrought-gold fence barring a yard littered with
 * rocks the shape of ferns. She hopped the fence and knocked on the seeress' door. Cassandra's shadow answered."
 *
 * A tall, narrow townhouse of pale gold under a gable of violet slate, its door a seeress' violet, the round window
 * high in its gable onto her bedroom's ceiling and its glow-in-the-dark stars and moon (cassandra.js); the fence "all
 * wrought of gold", spear-tipped, low enough to hop (a hum flies over it; a walker knocks at its gate); in the yard,
 * "her bare, neglected garden plot" and the rocks the shape of ferns; along the fence, "the golden pebbles of the
 * boulevard". Behind the door, a hall, lit.
 *
 * Come near the door (or to the gate) and it's knocked on: it opens, warily, and Cassandra's shadow stands in the
 * light ("She's not in, but this is her address, sure."); then she "yanked shut the door – its slam reverberated
 * through the neighbourhood", and "pale faces lit up half the windows on the street". A stream of its own, so nothing
 * else in the city moves. Returns its floors (the boulevard, the doorstep), the door's scene (stage.js steps it; main.js
 * gives it its sounds and her words), and what a touch finds (the door: a knock).
 */
function buildCassandra({ buckets, extras, still, materials, halls = [] }) {
    const random = createRandom(6406);
    const corners = [[CASSANDRA_BACK, CASSANDRA_NORTH], [CASSANDRA_BACK, CASSANDRA_SOUTH], [CASSANDRA_FRONT, CASSANDRA_NORTH], [CASSANDRA_FRONT, CASSANDRA_SOUTH]];
    const ground = Math.min(...corners.map(([x, z]) => groundY(x, z))) - 0.03;
    const sill = ground + CASSANDRA_PLINTH;
    const depth = CASSANDRA_FRONT - CASSANDRA_BACK;
    const width = CASSANDRA_SOUTH - CASSANDRA_NORTH;
    const cx = (CASSANDRA_FRONT + CASSANDRA_BACK) / 2;
    const cz = (CASSANDRA_NORTH + CASSANDRA_SOUTH) / 2;
    const eaves = sill + CASSANDRA_STOREY * 3;
    const WALL = 0xeecb88;
    const TRIM = 0xc9a868;
    const STONE = 0xb7a88c;
    const SLATE = 0x5a4a6c;
    const SLATE_RIDGE = 0x3e3250;
    const VIOLET = 0x4a2c62;
    const VIOLET_PANEL = 0x5e3a78;
    const DARK_WINDOW = 0x221a22;
    const FENCE_GOLD = 0xf2c75a;
    const FENCE_GOLD_DEEP = 0xd9a63e;
    const HALL_LIGHT = light(0xffb066, 1.3);
    const FACE = Math.PI / 2;
    const hallBack = CASSANDRA_FRONT - CASSANDRA_HALL;
    const hallSide = CASSANDRA_HALL_WIDE / 2;

    // The plinth; the face, one piece, with the doorway through it; the house behind, around the hall inside the
    // door (plain blocks, their joins hidden: the corners have quoins).
    buckets.add('stone', box(depth + 0.24, CASSANDRA_PLINTH, width + 0.24, { x: cx, y: ground + CASSANDRA_PLINTH / 2, z: cz }, STONE));
    const faceShape = new Shape();
    faceShape.moveTo(-width / 2, 0);
    faceShape.lineTo(width / 2, 0);
    faceShape.lineTo(width / 2, eaves - sill);
    faceShape.lineTo(-width / 2, eaves - sill);
    faceShape.closePath();
    // (The face's own x runs against the world's z, turned to face the street: the doorway at its middle.)
    const doorAlong = cz - CASSANDRA_DOOR_Z;
    const hole = new Shape(archShape(CASSANDRA_DOOR_WIDE, CASSANDRA_DOOR_SPRING).getPoints(6).map((point) => new Vector2(point.x + doorAlong, point.y)));
    faceShape.holes.push(hole);
    const faceGeometry = new ExtrudeGeometry(faceShape, { depth: CASSANDRA_FACE, bevelEnabled: false, curveSegments: 10 });
    faceGeometry.translate(0, 0, -CASSANDRA_FACE);
    buckets.add('gold', paint(pose(faceGeometry, { x: CASSANDRA_FRONT, y: sill, z: cz, ry: FACE }), WALL));
    const tall = eaves - sill;
    const behind = CASSANDRA_FRONT - CASSANDRA_FACE;
    const block = (x0, x1, z0, z1, y0 = sill, y1 = eaves) => buckets.add('gold', box(x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, WALL));
    block(CASSANDRA_BACK, behind, CASSANDRA_NORTH, CASSANDRA_DOOR_Z - hallSide);
    block(CASSANDRA_BACK, behind, CASSANDRA_DOOR_Z + hallSide, CASSANDRA_SOUTH);
    block(CASSANDRA_BACK, hallBack, CASSANDRA_DOOR_Z - hallSide, CASSANDRA_DOOR_Z + hallSide);
    block(hallBack, behind, CASSANDRA_DOOR_Z - hallSide, CASSANDRA_DOOR_Z + hallSide, sill + CASSANDRA_HALL_TALL, eaves);
    for (const [x, z] of corners) {
        buckets.add('stone', box(0.2, tall, 0.2, { x: x + (x > cx ? -0.07 : 0.07), y: sill + tall / 2, z: z + (z > cz ? -0.07 : 0.07) }, TRIM));
    }
    // The hall: its far wall lit (a lamp further in), its walls and ceiling in the lamp's warmth, a dark floor.
    buckets.add('glow', box(0.02, CASSANDRA_HALL_TALL - 0.01, CASSANDRA_HALL_WIDE - 0.02, { x: hallBack + 0.012, y: sill + CASSANDRA_HALL_TALL / 2, z: CASSANDRA_DOOR_Z }, HALL_LIGHT));
    for (const side of [-1, 1]) {
        buckets.add('brick', box(CASSANDRA_HALL - CASSANDRA_FACE, CASSANDRA_HALL_TALL - 0.01, 0.02, { x: (hallBack + behind) / 2, y: sill + CASSANDRA_HALL_TALL / 2, z: CASSANDRA_DOOR_Z + side * (hallSide - 0.012) }, 0x8a5a3a));
    }
    buckets.add('brick', box(CASSANDRA_HALL - CASSANDRA_FACE, 0.02, CASSANDRA_HALL_WIDE - 0.02, { x: (hallBack + behind) / 2, y: sill + CASSANDRA_HALL_TALL - 0.012, z: CASSANDRA_DOOR_Z }, 0x5a3a2c));
    buckets.add('brick', box(CASSANDRA_HALL, 0.02, CASSANDRA_HALL_WIDE - 0.02, { x: hallBack + CASSANDRA_HALL / 2, y: sill + 0.01, z: CASSANDRA_DOOR_Z }, 0x3e2a22));

    // The doorstep, two steps up to the sill.
    for (const [step, out] of [[0, 0.62], [1, 0.32]]) {
        const rise = 0.12 * (step + 1);
        buckets.add('stone', box(out, rise, 1.5 - step * 0.2, { x: CASSANDRA_FRONT + out / 2, y: ground + rise / 2, z: CASSANDRA_DOOR_Z }, STONE));
    }
    // A drawn course at each floor, along the face and round the sides; the cornice under the gable.
    for (let storey = 1; storey <= 3; storey += 1) {
        const y = sill + CASSANDRA_STOREY * storey - (storey === 3 ? 0.04 : 0.06);
        const band = storey === 3 ? 0.18 : 0.1;
        buckets.add('stone', box(0.12, band, width + 0.16, { x: CASSANDRA_FRONT + 0.05, y, z: cz }, TRIM));
        for (const z of [CASSANDRA_NORTH - 0.05, CASSANDRA_SOUTH + 0.05]) buckets.add('stone', box(depth + 0.1, band, 0.12, { x: cx, y, z }, TRIM));
    }

    // The gable, turned to the street, under two slopes of violet slate; its ridge, a finial, a chimney at the back.
    buckets.add('gold', gable(width, CASSANDRA_RISE, depth, { x: cx, y: eaves, z: cz, ry: FACE }, WALL));
    const half = width / 2 + 0.3;
    const slope = Math.atan2(CASSANDRA_RISE, width / 2);
    const slant = half / Math.cos(slope);
    for (const side of [-1, 1]) {
        buckets.add('brick', box(depth + 0.5, 0.12, slant, {
            x: cx, y: eaves + CASSANDRA_RISE - (half / 2) * Math.tan(slope) + 0.07, z: cz + side * (half / 2), rx: side * slope,
        }, SLATE));
    }
    buckets.add('brick', box(depth + 0.56, 0.16, 0.24, { x: cx, y: eaves + CASSANDRA_RISE + 0.07, z: cz }, SLATE_RIDGE));
    buckets.add('gold', cone(0.1, 0.62, 6, { x: CASSANDRA_FRONT + 0.2, y: eaves + CASSANDRA_RISE + 0.5, z: cz }, FENCE_GOLD));
    buckets.add('gold', ball(0.09, { x: CASSANDRA_FRONT + 0.2, y: eaves + CASSANDRA_RISE + 0.17, z: cz }, FENCE_GOLD, 6, 4));
    buckets.add('gold', box(0.62, 1.8, 0.62, { x: CASSANDRA_BACK + 0.8, y: eaves + CASSANDRA_RISE * 0.62 + 0.4, z: cz + 1.25 }, WALL));
    buckets.add('stone', box(0.76, 0.1, 0.76, { x: CASSANDRA_BACK + 0.8, y: eaves + CASSANDRA_RISE * 0.62 + 1.32, z: cz + 1.25 }, TRIM));

    // The windows, arched, lit and dark: one either side of the door below, three to each floor above, two along the
    // south side; and high in the gable, the round window onto her bedroom's ceiling (cassandra.js), its stars aglow.
    // (Small, and seen from the street: arches of a few segments, light on triangles.)
    const windowAt = (x, y, z, ry, lit, wide = 0.62, spring = 0.92) => {
        const at = { x, y, z, ry };
        if (lit) buckets.add('glow', arched(wide, spring, 0.04, at, WINDOW_LOW, 4));
        else buckets.add('brick', arched(wide, spring, 0.04, at, DARK_WINDOW, 4));
        buckets.add('stone', archRing(wide, spring, 0.07, 0.07, at, TRIM, 4));
        for (const piece of frame([box(wide + 0.22, 0.07, 0.14, { y: -0.035, z: 0.04 }, TRIM)], at)) buckets.add('stone', piece);
    };
    const face = CASSANDRA_FRONT + 0.012;
    const storeyAt = (storey) => sill + CASSANDRA_STOREY * storey;
    windowAt(face, storeyAt(0) + 0.62, CASSANDRA_DOOR_Z - 1.45, FACE, true);
    windowAt(face, storeyAt(0) + 0.62, CASSANDRA_DOOR_Z + 1.45, FACE, false);
    [[false, true, false], [true, false, false]].forEach((lights, index) => {
        [-1.45, 0, 1.45].forEach((along, bay) => windowAt(face, storeyAt(index + 1) + 0.62, CASSANDRA_DOOR_Z + along, FACE, lights[bay]));
    });
    for (const [x, storey, lit] of [[cx - 0.7, 1, true], [cx + 0.6, 2, false]]) windowAt(x, storeyAt(storey) + 0.62, CASSANDRA_SOUTH + 0.012, 0, lit, 0.5, 0.8);
    const roundAt = { x: CASSANDRA_FRONT + 0.03, y: eaves + 1.05, z: cz };
    buckets.add('stone', paint(pose(new RingGeometry(0.42, 0.54, 14), { x: roundAt.x + 0.012, y: roundAt.y, z: roundAt.z, ry: FACE }), TRIM));

    // Round the doorway, an arch of stone; beside it, a lamp on its bracket.
    buckets.add('stone', archRing(CASSANDRA_DOOR_WIDE + 0.04, CASSANDRA_DOOR_SPRING, 0.13, 0.12, { x: CASSANDRA_FRONT + 0.03, y: sill, z: CASSANDRA_DOOR_Z, ry: FACE }, TRIM, 6));
    buckets.add('steel', box(0.36, 0.05, 0.05, { x: CASSANDRA_FRONT + 0.18, y: sill + 2.42, z: CASSANDRA_DOOR_Z + 0.95 }, STEEL_DARK), { passable: true });
    buckets.add('steel', cylinder(0.02, 0.02, 0.2, 4, { x: CASSANDRA_FRONT + 0.34, y: sill + 2.3, z: CASSANDRA_DOOR_Z + 0.95 }, STEEL_DARK), { passable: true });
    buckets.add('glow', ball(0.11, { x: CASSANDRA_FRONT + 0.34, y: sill + 2.12, z: CASSANDRA_DOOR_Z + 0.95 }, LAMP, 6, 4));

    // The yard: gravel, the flagstones to the door, the bare plot, and the rocks the shape of ferns. (What lies on
    // the ground, the pebbles too, is drawn as a mesh of its own, in the city's own materials: floors never come
    // apart in the dust, so it needs no dust of its own lingering, and the frame doesn't draw it unless it's in sight.)
    const lying = { gold: [], stone: [] };
    const yard = { x0: CASSANDRA_FRONT + 0.05, x1: CASSANDRA_FENCE - 0.06, z0: CASSANDRA_YARD_NORTH + 0.06, z1: CASSANDRA_YARD_SOUTH - 0.06 };
    lying.stone.push(groundStrip(yard.x0, (yard.z0 + yard.z1) / 2, yard.x1, (yard.z0 + yard.z1) / 2, yard.z1 - yard.z0, 0xa48e6c, CASSANDRA_PAVED));
    for (let slab = 0; slab < 4; slab += 1) {
        const x = CASSANDRA_FRONT + 0.95 + slab * 0.66;
        lying.stone.push(box(0.5, 0.05, 0.62, { x, y: groundY(x, CASSANDRA_DOOR_Z) + CASSANDRA_PAVED + 0.012, z: CASSANDRA_DOOR_Z + random.range(-0.05, 0.05), ry: random.range(-0.08, 0.08) }, 0xc4b494));
    }
    const plot = { x0: yard.x0 + 0.3, x1: -21.4, z0: yard.z0 + 0.22, z1: CASSANDRA_DOOR_Z - 0.75 };
    lying.stone.push(groundStrip(plot.x0, (plot.z0 + plot.z1) / 2, plot.x1, (plot.z0 + plot.z1) / 2, plot.z1 - plot.z0, 0x4a3226, CASSANDRA_PAVED + 0.02));
    for (let stalk = 0; stalk < 9; stalk += 1) {
        const x = random.range(plot.x0 + 0.15, plot.x1 - 0.15);
        const z = random.range(plot.z0 + 0.12, plot.z1 - 0.12);
        const high = random.range(0.25, 0.6);
        const lean = random.range(-0.4, 0.4);
        lying.stone.push(paint(pose(new CylinderGeometry(0.008, 0.016, high, 3, 1, true), { x: x + Math.sin(lean) * high * 0.4, y: groundY(x, z) + CASSANDRA_PAVED + 0.02 + high / 2, z, rz: lean }), 0x7a6248));
    }
    const fernShape = (pinnae) => {
        // A frond: its stem bending a little, its leaflets either side shortening toward the tip; lying flat, as a
        // rock does.
        const shape = new Shape();
        const bend = (t) => 0.06 * Math.sin(t * Math.PI * 0.9);
        const stem = 0.025;
        const right = [];
        const left = [];
        for (let index = 0; index <= pinnae; index += 1) {
            const t = index / pinnae;
            const reach = 0.24 * (1 - t) ** 0.8 + 0.02;
            const x = bend(t);
            right.push([x + stem, t], [x + stem + reach, t + 0.1], [x + stem + reach * 0.12, t + 0.15]);
            left.push([x - stem, t], [x - stem - reach, t + 0.1], [x - stem - reach * 0.12, t + 0.15]);
        }
        shape.moveTo(stem, 0);
        for (const [x, y] of right) shape.lineTo(x, y);
        shape.lineTo(bend(1), 1.08);
        for (const [x, y] of left.reverse()) shape.lineTo(x, y);
        shape.closePath();
        return shape;
    };
    const fernRocks = [[-23.0, -0.9, 0.8], [-22.1, 0.15, 0.9], [-21.3, -0.75, 0.75], [-20.75, 0.3, 0.6], [-22.55, -1.2, 0.45], [-20.75, -4.2, 0.7], [-20.8, -3.15, 0.55]];
    fernRocks.forEach(([x, z, size], index) => {
        const geometry = new ExtrudeGeometry(fernShape(5), { depth: 0.07, bevelEnabled: false, curveSegments: 1 });
        geometry.translate(0, -0.5, 0);
        geometry.scale(size, size, 1);
        geometry.rotateX(-Math.PI / 2);
        const tone = [0xc2bba4, 0xb4ae96, 0xcbc2a8, 0xa9a68e][index % 4];
        const propped = index % 3 === 2;
        lying.stone.push(paint(pose(geometry, {
            x, y: groundY(x, z) + CASSANDRA_PAVED + 0.035 + (propped ? 0.1 : 0), z, ry: random.range(0, Math.PI * 2), rx: propped ? random.range(0.18, 0.32) : 0,
        }), tone));
    });

    // The fence, all wrought of gold: posts with spear finials, two rails, spear-tipped pickets, and its gate, shut.
    const fence = [];
    const run = (x0, z0, x1, z1) => {
        const length = Math.hypot(x1 - x0, z1 - z0);
        const angle = Math.atan2(x1 - x0, z1 - z0);
        const mx = (x0 + x1) / 2;
        const mz = (z0 + z1) / 2;
        for (const y of [0.16, CASSANDRA_FENCE_TALL - 0.2]) fence.push(box(0.04, 0.05, length, { x: mx, y: groundY(mx, mz) + y, z: mz, ry: angle }, FENCE_GOLD_DEEP));
        const count = Math.max(2, Math.round(length / 0.17));
        for (let index = 1; index < count; index += 1) {
            const t = index / count;
            const x = x0 + (x1 - x0) * t;
            const z = z0 + (z1 - z0) * t;
            const base = groundY(x, z);
            fence.push(paint(pose(new CylinderGeometry(0.022, 0.022, CASSANDRA_FENCE_TALL - 0.12, 3, 1, true), { x, y: base + (CASSANDRA_FENCE_TALL - 0.12) / 2, z, ry: angle }), FENCE_GOLD));
            fence.push(paint(pose(new ConeGeometry(0.038, 0.12, 3, 1, true), { x, y: base + CASSANDRA_FENCE_TALL - 0.06, z, ry: angle }), FENCE_GOLD));
        }
    };
    const post = (x, z, high = CASSANDRA_FENCE_TALL + 0.02) => {
        const base = groundY(x, z);
        fence.push(box(0.09, high, 0.09, { x, y: base + high / 2, z }, FENCE_GOLD_DEEP));
        fence.push(paint(pose(new ConeGeometry(0.06, 0.16, 4, 1, true), { x, y: base + high + 0.08, z, ry: Math.PI / 4 }), FENCE_GOLD));
    };
    const gate = [CASSANDRA_DOOR_Z - 0.6, CASSANDRA_DOOR_Z + 0.6];
    run(CASSANDRA_FENCE, CASSANDRA_YARD_NORTH, CASSANDRA_FENCE, gate[0]);
    run(CASSANDRA_FENCE, gate[0], CASSANDRA_FENCE, gate[1]);
    run(CASSANDRA_FENCE, gate[1], CASSANDRA_FENCE, CASSANDRA_YARD_SOUTH);
    run(CASSANDRA_FRONT + 0.12, CASSANDRA_YARD_NORTH, CASSANDRA_FENCE, CASSANDRA_YARD_NORTH);
    run(CASSANDRA_FRONT + 0.12, CASSANDRA_YARD_SOUTH, CASSANDRA_FENCE, CASSANDRA_YARD_SOUTH);
    for (const z of [CASSANDRA_YARD_NORTH, CASSANDRA_YARD_SOUTH]) {
        post(CASSANDRA_FENCE, z);
        post((CASSANDRA_FRONT + CASSANDRA_FENCE) / 2, z);
    }
    for (const z of gate) post(CASSANDRA_FENCE, z, CASSANDRA_FENCE_TALL + 0.1);
    for (const piece of fence) buckets.add('gold', piece);

    // The boulevard of golden pebbles, along the fence: its bed, and every pebble its own gold, a little proud of it.
    const [bx0, bx1, bz0, bz1] = CASSANDRA_BOULEVARD;
    // (Its floor is given, a little over the pebbles, so the givers' shades lie on them: creatures.js.)
    buckets.add('dimGold', groundStrip((bx0 + bx1) / 2, bz0, (bx0 + bx1) / 2, bz1, bx1 - bx0, 0x94702e, CASSANDRA_PAVED));
    const cell = 0.3;
    const pebbles = [];
    for (let x = bx0; x < bx1 - 0.01; x += cell) {
        for (let z = bz0; z < bz1 - 0.01; z += cell) {
            const tone = new Color(GOLDS[Math.floor(random() * GOLDS.length)]).multiplyScalar(random.range(0.66, 0.92));
            // (Every other row set half a pebble over, as stones are laid; each a rounded flat stone, turned its own way.)
            const offset = Math.round((z - bz0) / cell) % 2 ? cell / 2 : 0;
            const px = x + offset + cell / 4 + random.range(-0.02, 0.02);
            if (px > bx1 - 0.08) continue;
            const pz = z + cell / 2 + random.range(-0.02, 0.02);
            const pebble = new CircleGeometry(0.5, 5);
            pebble.rotateX(-Math.PI / 2);
            pebbles.push(paint(pose(pebble, {
                x: px, y: groundY(px, pz) + CASSANDRA_PAVED + random.range(0.006, 0.016), z: pz, ry: random.range(0, Math.PI), sx: cell * random.range(0.86, 1.02), sz: cell * random.range(0.68, 0.86),
            }), tone));
        }
    }
    lying.gold.push(...pebbles);

    // What moves: the door on its hinge, her shadow in the hall, her ceiling in the round window; and the faces at
    // the street's windows (one draw for all).
    const group = new Group();
    group.name = 'cassandra';
    const hinge = new Group();
    hinge.name = 'cassandra-door';
    // (Hung at the doorway's south side, in its reveal; its own x runs along the leaf, north, and swinging it on
    // the hinge's y opens it inward.)
    hinge.position.set(CASSANDRA_FRONT - 0.14, sill, CASSANDRA_DOOR_Z + CASSANDRA_DOOR_WIDE / 2);
    hinge.rotation.y = FACE;
    const swing = new Group();
    hinge.add(swing);
    const leafWide = CASSANDRA_DOOR_WIDE - 0.03;
    const leafPieces = [arched(leafWide, CASSANDRA_DOOR_SPRING, 0.06, { x: leafWide / 2, z: 0.03 }, VIOLET)];
    for (const [py, ph] of [[0.28, 0.62], [1.04, 0.62]]) {
        for (const side of [-1, 1]) leafPieces.push(box(0.33, ph, 0.02, { x: leafWide / 2 + side * 0.2, y: py + ph / 2, z: 0.065 }, VIOLET_PANEL));
    }
    leafPieces.push(ball(0.035, { x: leafWide - 0.12, y: 1.0, z: 0.085 }, FENCE_GOLD, 8, 6));
    leafPieces.push(ball(0.035, { x: leafWide - 0.12, y: 1.0, z: -0.025 }, FENCE_GOLD, 8, 6));
    const leaf = new Mesh(mergeGeometries(leafPieces.map((piece) => unindexed(piece)), false), materials.brick);
    leaf.name = 'cassandra-door-leaf';
    swing.add(leaf);
    group.add(hinge);

    // Her shadow, standing in the hall's light, a hand up to the door's edge (cassandra.js).
    const figure = new Mesh(new PlaneGeometry(0.95, 1.95), new MeshBasicMaterial({
        map: shadowFigure(), color: 0x1a0f24, transparent: true, opacity: 0, depthWrite: false,
    }));
    figure.name = 'cassandra-shadow';
    figure.rotation.y = FACE;
    figure.position.set(CASSANDRA_FRONT - 0.38, sill + 0.975, CASSANDRA_DOOR_Z - 0.1);
    figure.visible = false;
    group.add(figure);

    // And her shadow cast: the hall's light spilling out of the door, warm, over the doorstep and down the path, and
    // in it, long, where it doesn't reach, her shadow, laid toward whoever knocked (seen from close over their
    // shoulder, as well as her in the doorway). It comes as the door opens and goes as it shuts. Light added over the
    // floor, so it marks nothing for the ink. (Its own pieces, out of the dust: floors never come apart.)
    const spillFrom = CASSANDRA_FRONT - 0.42;
    const spillTo = CASSANDRA_FRONT + 3.0;
    const stations = [
        [spillFrom, sill + 0.012], [CASSANDRA_FRONT + 0.315, sill + 0.012],
        [CASSANDRA_FRONT + 0.325, ground + 0.132], [CASSANDRA_FRONT + 0.615, ground + 0.132],
    ];
    for (let x = CASSANDRA_FRONT + 0.625; x <= spillTo + 1e-6; x += (spillTo - CASSANDRA_FRONT - 0.625) / 5) {
        // (Just over the flagstones' tops.)
        stations.push([x, groundY(x, CASSANDRA_DOOR_Z) + CASSANDRA_PAVED + 0.042]);
    }
    const spillPositions = [];
    const spillUvs = [];
    for (const [x, y] of stations) {
        const halfWide = 0.46 + Math.max(0, x - CASSANDRA_FRONT) * 0.22;
        const along = (x - spillFrom) / (spillTo - spillFrom);
        // (Across: 0 on the south, her raised hand's side, as the figure has it.)
        spillPositions.push(x, y, CASSANDRA_DOOR_Z + halfWide, x, y, CASSANDRA_DOOR_Z - halfWide);
        spillUvs.push(0, along, 1, along);
    }
    const spillIndex = [];
    for (let station = 0; station < stations.length - 1; station += 1) {
        const a = station * 2;
        spillIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const spillGeometry = new BufferGeometry();
    spillGeometry.setAttribute('position', new Float32BufferAttribute(spillPositions, 3));
    spillGeometry.setAttribute('uv', new Float32BufferAttribute(spillUvs, 2));
    spillGeometry.setIndex(spillIndex);
    const spillUniforms = { shadowMap: { value: figure.material.map }, open: { value: 0 } };
    const spill = new Mesh(spillGeometry, new ShaderMaterial({
        uniforms: spillUniforms,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D shadowMap;
            uniform float open;
            varying vec2 vUv;
            void main() {
                // The light through the door: strongest at the threshold, fading down the path and to its sides.
                float across = vUv.x;
                float along = vUv.y;
                float light = open * (0.95 - 0.6 * along) * (1.0 - smoothstep(0.6, 1.0, along))
                    * smoothstep(0.0, 0.2, across) * smoothstep(1.0, 0.8, across);
                // Her shadow in it, from her feet, as long as most of the light.
                float height = along / 0.8;
                float shade = height < 1.0 ? texture2D(shadowMap, vec2(across, height)).a : 0.0;
                gl_FragColor = vec4(vec3(1.0, 0.56, 0.26) * 0.62 * light * (1.0 - 0.94 * shade), 1.0);
            }
        `,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
    }));
    spill.name = 'cassandra-spill';
    spill.visible = false;
    extras.push(spill);

    for (const [key, pieces] of Object.entries(lying)) {
        const lies = new Mesh(mergeGeometries(pieces.map((piece) => unindexed(piece)), false), materials[key]);
        lies.name = `cassandra-ground-${key}`;
        group.add(lies);
    }

    const ceiling = new Mesh(new CircleGeometry(0.44, 18), new MeshBasicMaterial({ map: starCeiling(), color: new Color(1.3, 1.36, 1.4) }));
    ceiling.name = 'cassandra-ceiling';
    ceiling.rotation.y = FACE;
    ceiling.position.set(roundAt.x, roundAt.y, roundAt.z);
    group.add(ceiling);
    extras.push(group);

    // The street's windows: the halls standing round the plaza, their dot windows (as addHall lays them) on the
    // faces turned toward the house; half of them will show a face.
    const quads = [];
    const delays = [];
    const yardMiddle = new Vector2((CASSANDRA_FRONT + CASSANDRA_FENCE) / 2 + 2, CASSANDRA_DOOR_Z);
    for (const hall of halls) {
        if (Math.hypot(hall.x - yardMiddle.x, hall.z - yardMiddle.y) > 20) continue;
        const sides = [
            { across: hall.width, out: hall.depth / 2 + 0.02, turn: 0 },
            { across: hall.width, out: hall.depth / 2 + 0.02, turn: Math.PI },
            { across: hall.depth, out: hall.width / 2 + 0.02, turn: Math.PI / 2 },
            { across: hall.depth, out: hall.width / 2 + 0.02, turn: -Math.PI / 2 },
        ];
        for (const side of sides) {
            const turn = side.turn + hall.turn;
            const normal = new Vector2(Math.sin(turn), Math.cos(turn));
            const middle = new Vector2(hall.x + normal.x * side.out, hall.z + normal.y * side.out);
            const toYard = yardMiddle.clone().sub(middle);
            if (toYard.length() > 19 || normal.dot(toYard.normalize()) < 0.25) continue;
            const columns = Math.max(1, Math.floor((side.across - 0.5) / 0.72));
            const spacing = (side.across - 0.5) / columns;
            let row = 0;
            for (let y = 0.45 + HALL_STOREY + 0.75; y + 0.3 < hall.height - 0.35; y += HALL_STOREY, row += 1) {
                for (let column = 0; column < columns; column += 1) {
                    const hash = Math.sin(hall.x * 3.17 + hall.z * 7.31 + row * 1.91 + column * 2.73 + side.turn * 5.1) * 9187.13;
                    if (hash - Math.floor(hash) > 0.5) continue;
                    const along = -side.across / 2 + 0.25 + spacing * (column + 0.5);
                    const out = side.out + 0.032;
                    const local = new Vector3(along * Math.cos(side.turn) + out * Math.sin(side.turn), y, -along * Math.sin(side.turn) + out * Math.cos(side.turn));
                    local.applyAxisAngle(UP, hall.turn);
                    // (The window's own size: it lights up, with the face in it.)
                    const quad = new PlaneGeometry(0.22, 0.3);
                    quad.rotateY(turn);
                    quad.translate(hall.x + local.x, hall.base + local.y, hall.z + local.z);
                    quads.push(quad);
                    const delay = still ? 0 : random.range(0, FACES_RISE);
                    for (let vertex = 0; vertex < 4; vertex += 1) delays.push(delay);
                }
            }
        }
    }
    const sinceSlam = { value: 1e4 };
    let faces = null;
    if (quads.length) {
        const geometry = mergeGeometries(quads, false);
        geometry.setAttribute('delay', new Float32BufferAttribute(delays, 1));
        // (Lit as the street's lit windows are, the faces glowing a little, as the ink draws light: ink.js.)
        const material = new MeshBasicMaterial({ map: paleFace(), color: new Color(2.05, 2.0, 1.95), transparent: true, depthWrite: false });
        // (Each face comes up at its own moment after the slam, stays, and goes, the last a little after the first.)
        alsoBeforeCompile(material, 'cassandra-faces', (shader) => {
            shader.uniforms.sinceSlam = sinceSlam;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nattribute float delay;\nuniform float sinceSlam;\nvarying float vShown;')
                .replace('#include <begin_vertex>', [
                    '#include <begin_vertex>',
                    `vShown = smoothstep(delay, delay + 0.35, sinceSlam) * (1.0 - smoothstep(${(FACES_RISE + FACES_STAY).toFixed(2)}, ${(FACES_RISE + FACES_STAY + 1.6).toFixed(2)}, sinceSlam - delay * 0.5));`,
                ].join('\n'));
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying float vShown;')
                .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vShown;\nif (diffuseColor.a < 0.02) discard;');
        });
        faces = new Mesh(geometry, material);
        faces.name = 'cassandra-faces';
        faces.frustumCulled = false;
        faces.visible = false;
        extras.push(faces);
    }

    // The knock, the answer, the slam: a scene on a clock of its own (stage.js steps it with the walk's state; main.js
    // gives it its sounds and her words, through onSound and onSay).
    const doorPoint = new Vector3(CASSANDRA_FRONT - 0.3, sill + 1.75, CASSANDRA_DOOR_Z);
    const gatePoint = new Vector2(CASSANDRA_FENCE + 0.5, CASSANDRA_DOOR_Z);
    let since = null;
    let slammedAt = null;
    let open = 0;
    let spoke = false;
    let slammed = false;
    let armed = true;
    // (A hum hops the fence, as E did, and knocks at the door; a walker, who can't, knocks at the gate.)
    const hops = trialOn('hum');
    const scene = {
        /** Called with 'knock' or 'slam'. */
        onSound: null,
        /** Called with her words and where she says them (a world point), and with null when she's done. */
        onSay: null,
        /** Her words, and where they're said. */
        says: CASSANDRA_SAYS,
        point: doorPoint,
        /**
         * Where a body can't go: before the doorway, where she stands (walk.js standsIn); far enough out that the camera,
         * behind and above whoever's come, sees her over them.
         */
        bars: { x: CASSANDRA_FRONT + 0.05, z: CASSANDRA_DOOR_Z, radius: 1.55 },
        /** Whether the scene is playing (from the knock until the faces have gone). */
        get playing() {
            return since !== null && since < KNOCK_SLAMS + FACES_RISE + FACES_STAY + 2;
        },
        /** Knock on the door, unless it's being answered already. */
        knock() {
            if (since !== null && since < KNOCK_SLAMS + 1.2) return false;
            since = 0;
            spoke = false;
            slammed = false;
            armed = false;
            scene.onSound?.('knock');
            return true;
        },
        /** Every frame: the scene's clock, and whoever's walking (or flying) coming to the door, or to the gate. */
        update(dt, walker) {
            if (walker?.walking) {
                const { x, z } = walker.position;
                const inYard = x > CASSANDRA_FRONT && x < CASSANDRA_FENCE && z > CASSANDRA_YARD_NORTH && z < CASSANDRA_YARD_SOUTH;
                const nearDoor = inYard && Math.hypot(x - CASSANDRA_FRONT, z - CASSANDRA_DOOR_Z) < KNOCK_NEAR;
                const atGate = !hops && x >= CASSANDRA_FENCE && Math.hypot(x - gatePoint.x, z - gatePoint.y) < KNOCK_AT_GATE;
                if (armed && (nearDoor || atGate)) scene.knock();
                else if (!armed && !scene.playing && Math.hypot(x - gatePoint.x, z - gatePoint.y) > KNOCK_AGAIN) armed = true;
            } else if (!scene.playing) {
                armed = true;
            }
            if (since !== null) {
                since += dt;
                if (!spoke && since >= KNOCK_SPEAKS) {
                    spoke = true;
                    scene.onSay?.(CASSANDRA_SAYS, doorPoint);
                }
                if (!slammed && since >= KNOCK_SLAMS) {
                    slammed = true;
                    slammedAt = 0;
                    scene.onSay?.(null);
                    scene.onSound?.('slam');
                }
            }
            const wanted = since !== null && since >= KNOCK_ANSWERED && !slammed ? CASSANDRA_DOOR_OPEN : 0;
            // (It opens slowly, warily; it's yanked shut.)
            const pace = wanted > open ? 2.6 : 30;
            open += (wanted - open) * (still ? 1 : 1 - Math.exp(-pace * dt));
            if (Math.abs(open) < 1e-3) open = 0;
            swing.rotation.y = open;
            figure.visible = open > 0.02;
            figure.material.opacity = Math.min(1, open / CASSANDRA_DOOR_OPEN * 1.6) * 0.94;
            spill.visible = figure.visible;
            spillUniforms.open.value = Math.min(1, open / CASSANDRA_DOOR_OPEN);
            if (slammedAt !== null) {
                slammedAt += dt;
                sinceSlam.value = slammedAt;
                if (faces) faces.visible = slammedAt < FACES_RISE + FACES_STAY + 2.2;
                if (slammedAt > FACES_RISE + FACES_STAY + 2.2) slammedAt = null;
            }
        },
    };

    // Where a body may stand that the ground doesn't give: the boulevard, and the doorstep's two steps. (The house's
    // walls, the fence and the doorway, where she stands, keep it out of the rest.)
    const floorAt = (x, z) => {
        if (x > bx0 && x < bx1 && z > bz0 && z < bz1) return groundY(x, z) + CASSANDRA_PAVED + 0.016;
        if (Math.abs(z - CASSANDRA_DOOR_Z) < 0.7 && x >= CASSANDRA_FRONT && x < CASSANDRA_FRONT + 0.62) return ground + (x < CASSANDRA_FRONT + 0.32 ? 0.24 : 0.12);
        return null;
    };

    return {
        floor: { floorAt },
        door: scene,
        // A touch on the door knocks (main.js): anywhere on it, from the sill to the top of its arch.
        touch: [{ kind: 'cassandra-door', center: new Vector3(CASSANDRA_FRONT, sill + 1.1, CASSANDRA_DOOR_Z), radius: 1.15, fragment: null }],
    };
}

// =============================================================================
// The charity ball
// =============================================================================

/**
 * The charity ball's hall stands wholly out beyond the north rim, over the drop (x across it; z along it, its far end
 * north, over the ocean), reached across a terrace laid out from the rim's edge. Its walls (their outer faces), their
 * thickness, how tall they stand over its floor, and how high its vault rises over the eaves.
 */
const BALL_WEST = 0.8;
const BALL_EAST = 7.2;
const BALL_SOUTH = -31.8;
const BALL_NORTH = -42.0;
const BALL_WALL = 0.22;
const BALL_TALL = 5.6;
const BALL_RISE = 1.4;
/** The terrace, from over the land out to the hall's face: its south edge and its top; the hall's floor, a step up. */
const BALL_TERRACE_SOUTH = -29.2;
const BALL_TERRACE_TOP = 0.11;
const BALL_FLOOR = 0.29;
/** The doorway in its face: its middle (x), its width, where its arch springs; how far its doors stand open. */
const BALL_DOOR_X = 4.0;
const BALL_DOOR_WIDE = 1.8;
const BALL_DOOR_SPRING = 2.1;
const BALL_DOORS_OPEN = 1.25;
/** The stage: its front and back (z), its east end (beside it, the dark aisle to the hidden door), its height. */
const BALL_STAGE_FRONT = -37.75;
const BALL_STAGE_BACK = -39.85;
const BALL_STAGE_EAST = 6.0;
const BALL_STAGE_TALL = 0.5;
/** The wall behind the stage, from the stage's back: its thickness (a dark face to the hall, a gold one behind). */
const BALL_PARTITION_THICK = 0.2;
/** The hidden door in it: x from, x to; its height; how near someone comes before it swings back, and how far round. */
const BALL_HIDDEN = [6.12, 6.86];
const BALL_HIDDEN_TALL = 2.0;
const BALL_HIDDEN_NEAR = 1.7;
const BALL_HIDDEN_SWING = 1.45;
/** The balcony beyond the far wall: x from, x to, how deep; the arch onto it from the corridor: x from, x to, its spring. */
const BALL_BALCONY = [1.6, 6.4];
const BALL_BALCONY_DEEP = 1.2;
const BALL_BALCONY_DOOR = [3.0, 4.0];
const BALL_BALCONY_DOOR_SPRING = 1.7;
/** The tables (their middles), their cloths' radius and height; how far from each middle its guests sit. */
const BALL_TABLES = [[2.35, -33.2], [5.65, -33.2], [2.35, -34.75], [5.65, -34.75], [2.35, -36.3], [5.65, -36.3]];
const BALL_TABLE_RADIUS = 0.42;
const BALL_TABLE_TALL = 0.58;
const BALL_SEATED = 0.64;
/** The chandeliers hang over the aisle between the tables, this high over the floor. */
const BALL_CHANDELIER_HANG = 4.5;
/** Where Cassandra sits on the balcony (her hips), her back to the rails; she hears whoever comes this near. */
const BALL_SHE_SITS = [4.9, -42.85];
const BALL_SHE_HEARS = 2.2;
/** The chairs tumbled about the balcony: x, z, and how each lies (turned, tipped back, on its side). */
const BALL_TUMBLED = [[2.05, -42.5, 0.6, 0, Math.PI / 2], [2.7, -42.8, -0.3, -Math.PI / 2, 0], [6.05, -42.6, 2.2, 0, -Math.PI / 2], [5.62, -42.98, 1.4, 0, 0]];
/** The bottle of cognac at her feet. */
const BALL_COGNAC = [5.3, -42.3];
/** The hall's insides are drawn only while the eye is this near its middle (it's seen into only from close by). */
const BALL_INSIDE_SEEN = 18;
/**
 * The speech's pace (Elm, 2 Oct: "much slower"): its beats, and how long each line stays, this many times what they
 * first were, so a visitor who has only just come in has settled before the old Greek's aphorisms are over.
 */
const BALL_PACE = 2.2;
/** The speech's beats, in seconds after someone comes in. */
const BALL_SPEECH = Object.fromEntries(Object.entries({ mutters: 0, applause: 2.2, vanishes: 3.0, appears: 3.4, elysicester: 4.6, elysium: 7.0, leaves: 9.8, band: 10.2 })
    .map(([beat, at]) => [beat, at * BALL_PACE]));
/**
 * Out of the building this long (seconds: a step out of the doors, not a stumble on the threshold), and it all begins
 * again on the way back in, whether the speech was over or not (Elm: it "starts over on every re-entry").
 */
const BALL_AGAIN = 0.8;
/**
 * The words, exactly as the book has them (pp. 77-78): the old Greek's, as it gives his name; Cassandra's at the
 * podium, each as she says it; and hers on the balcony.
 */
const BALL_MUTTERED = '[Unintelligible]';
const BALL_THANKS = ['Thank you, Elysicester,', 'Thank you, Elysium.'];
const BALL_NOT_DRUNK = 'I’m not that drunk.';

/** Whether (x, z), give or take r, is on the ball's lot: the terrace at the rim, and the hall and balcony beyond it. */
function onBallsLot(x, z, r = 0) {
    return x > BALL_WEST - 0.6 - r && x < BALL_EAST + 0.6 + r && z > BALL_NORTH - BALL_BALCONY_DEEP - 0.6 - r && z < BALL_TERRACE_SOUTH + 0.8 + r;
}

/** Where the island ends at x, going north (its rim, shape.js). */
function northRimZ(x) {
    let z = -26;
    while (Math.hypot(x, z) < rimRadius(Math.atan2(z, x)) && z > -40) z -= 0.02;
    return z;
}

/**
 * A crowd in silhouette: each figure a quad standing on its feet and turned about its own upright to the eye, its
 * picture a cell of an atlas (ball.js). Feet: [x, y, z, width, height, cell, phase]. One draw for them all. Its
 * uniforms: shown (0 to 1: they rise out of nothing), bob (each lifts in its turn: clapping, playing), and a clock.
 */
function silhouettes(feet, atlas, cells, { color, name }) {
    const positions = [];
    const normals = [];
    const corners = [];
    const uvs = [];
    const phases = [];
    const index = [];
    feet.forEach(([x, y, z, wide, tall, cell, phase], quad) => {
        for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
            positions.push(x, y, z);
            normals.push(0, 1, 0);
            corners.push((u - 0.5) * wide, v * tall);
            uvs.push((cell + u) / cells, v);
            phases.push(phase);
        }
        const a = quad * 4;
        index.push(a, a + 1, a + 2, a, a + 2, a + 3);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('corner', new Float32BufferAttribute(corners, 2));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('phase', new Float32BufferAttribute(phases, 1));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    // (Its positions are its figures' feet: the sphere grows by their height.)
    geometry.boundingSphere.radius += 1.5;
    const uniforms = { silhouetteShown: { value: 1 }, silhouetteBob: { value: 0 }, silhouetteTime: { value: 0 } };
    const material = new MeshBasicMaterial({ map: atlas, color, alphaTest: 0.5 });
    alsoBeforeCompile(material, name, (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec2 corner;\nattribute float phase;\nuniform float silhouetteShown;\nuniform float silhouetteBob;\nuniform float silhouetteTime;')
            .replace('#include <project_vertex>', [
                'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);',
                // (Across, the view's own way; up, the world's, as the eye sees it: upright, however steeply it's looked down at.)
                'vec3 upright = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);',
                'float lift = silhouetteBob * max(0.0, sin(silhouetteTime * 9.0 + phase * 6.2831)) * 0.045;',
                'mvPosition.xyz += vec3(corner.x * silhouetteShown, 0.0, 0.0) + upright * (corner.y * silhouetteShown + lift);',
                'gl_Position = projectionMatrix * mvPosition;',
            ].join('\n'));
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    return { mesh, uniforms };
}

/**
 * The charity ball (Numbers by Paint, Episode 5, pp. 77-78; Elm's next place; a trial: ?ball=off): "a charity thing"
 * in a hall of chandeliers, its "distant podium", the "hidden door" with "A bar of polished gold" across it, and "a thin
 * balcony, enclosed by filigreed railing, overlooking the expanse of ocean". It stands out beyond the north rim on golden
 * struts, its face to the city across a terrace; its shell is a solid to the camera, its insides drawn only while the
 * eye is near. Come in and the speech is given (the old Greek, "[Unintelligible]" as the book names him; applause;
 * Cassandra's thanks; the band); on the balcony, she says it. A stream of its own, so nothing else moves. Returns its
 * floors, the scene (stage.js steps it; main.js voices it) and what a touch finds (her, on the balcony).
 */
function buildBall({ extras, still, materials, bright = null }) {
    const random = createRandom(7707);
    const floor = BALL_FLOOR;
    const width = BALL_EAST - BALL_WEST;
    const cx = (BALL_WEST + BALL_EAST) / 2;
    const innerWest = BALL_WEST + BALL_WALL;
    const innerEast = BALL_EAST - BALL_WALL;
    const innerSouth = BALL_SOUTH - BALL_WALL;
    const innerNorth = BALL_NORTH + BALL_WALL;
    const eaves = floor + BALL_TALL;
    const stageTop = floor + BALL_STAGE_TALL;
    const [hiddenWest, hiddenEast] = BALL_HIDDEN;
    const [balconyWest, balconyEast] = BALL_BALCONY;
    const balconyFar = BALL_NORTH - BALL_BALCONY_DEEP;
    const partitionNorth = BALL_STAGE_BACK - BALL_PARTITION_THICK;
    const shell = new Buckets();
    const inside = new Buckets();
    const WALL = 0xe8bf6a;
    const TRIM = 0xd2aa5c;
    const PALE = 0xd8c8a4;
    const VERDIGRIS = 0x6a9c86;
    const PARQUET = 0x6a3424;
    const VELVET = 0x8a1f2c;
    const VELVET_DEEP = 0x4e1018;
    const CLOTH_WHITE = 0xf2eee6;
    const DARK = 0x2a1e18;
    const DUSTY = 0xb8975a;
    const STAGE_WOOD = 0x5a3220;
    const DUSK = 0x2c2650;
    const DUSK_LOW = new Color(0xb0607a);
    const RAIL_GOLD = 0xe8c060;
    const CHAIR_GOLD = 0xd8a848;
    const CANDLE = light(0xffd890, 3.0);

    // The terrace, laid out from over the land to the hall's face; on its east side, where it's out over the drop, a
    // low gold rail; by the doorway, two lamps.
    shell.add('stone', box(width, 0.35, BALL_TERRACE_SOUTH - BALL_SOUTH, { x: cx, y: BALL_TERRACE_TOP - 0.175, z: (BALL_TERRACE_SOUTH + BALL_SOUTH) / 2 }, PALE));
    const railFrom = northRimZ(BALL_EAST) + 0.3;
    for (let post = 0; post < 4; post += 1) {
        const z = railFrom + (BALL_SOUTH + 0.1 - railFrom) * (post / 3);
        shell.add('gold', box(0.06, 0.52, 0.06, { x: BALL_EAST - 0.05, y: BALL_TERRACE_TOP + 0.26, z }, RAIL_GOLD), { passable: true });
    }
    shell.add('gold', box(0.07, 0.05, railFrom - BALL_SOUTH, { x: BALL_EAST - 0.05, y: BALL_TERRACE_TOP + 0.52, z: (railFrom + BALL_SOUTH) / 2 }, RAIL_GOLD), { passable: true });
    for (const side of [-1, 1]) {
        const x = BALL_DOOR_X + side * 1.55;
        shell.add('gold', cylinder(0.035, 0.05, 1.5, 6, { x, y: BALL_TERRACE_TOP + 0.75, z: BALL_SOUTH + 0.55 }, TRIM), { passable: true });
        shell.add('glow', ball(0.1, { x, y: BALL_TERRACE_TOP + 1.58, z: BALL_SOUTH + 0.55 }, LAMP, 6, 4), { passable: true });
    }

    // The hall's floor, out over the drop; its walls the length of it, east and west.
    shell.add('stone', box(width + 0.2, 0.45, BALL_SOUTH - BALL_NORTH, { x: cx, y: floor - 0.225, z: (BALL_SOUTH + BALL_NORTH) / 2 }, TRIM));
    for (const x of [BALL_WEST + BALL_WALL / 2, BALL_EAST - BALL_WALL / 2]) {
        shell.add('gold', box(BALL_WALL, BALL_TALL, BALL_SOUTH - BALL_NORTH, { x, y: floor + BALL_TALL / 2, z: (BALL_SOUTH + BALL_NORTH) / 2 }, WALL));
    }
    // Its face to the city, its far wall, and the wall behind the stage: each under the vault's curve, with a doorway
    // through it (the stage's, a plain one: the hidden door).
    const arcRadius = ((width / 2) ** 2 + BALL_RISE ** 2) / (2 * BALL_RISE);
    const arcCentre = BALL_TALL - (arcRadius - BALL_RISE);
    const arcAngle = Math.asin(width / 2 / arcRadius);
    // (Each a little narrower than the hall, its edges sunk in the side walls, so no two faces lie in one plane.)
    const endWall = (hole, depth = BALL_WALL, half = width / 2 - 0.02) => {
        const reach = Math.asin(half / arcRadius);
        const shape = new Shape();
        shape.moveTo(-half, 0);
        shape.lineTo(half, 0);
        shape.lineTo(half, arcCentre + Math.sqrt(arcRadius ** 2 - half ** 2));
        shape.absarc(0, arcCentre, arcRadius, Math.PI / 2 - reach, Math.PI / 2 + reach, false);
        shape.lineTo(-half, 0);
        shape.holes.push(hole);
        return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
    };
    const arch = (middle, wide, spring) => new Shape(archShape(wide, spring).getPoints(6).map((point) => new Vector2(point.x + middle - cx, point.y)));
    const front = endWall(arch(BALL_DOOR_X, BALL_DOOR_WIDE, BALL_DOOR_SPRING));
    front.translate(cx, floor, innerSouth);
    shell.add('gold', paint(front, WALL));
    const balconyDoorMiddle = (BALL_BALCONY_DOOR[0] + BALL_BALCONY_DOOR[1]) / 2;
    const back = endWall(arch(balconyDoorMiddle, BALL_BALCONY_DOOR[1] - BALL_BALCONY_DOOR[0], BALL_BALCONY_DOOR_SPRING));
    back.translate(cx, floor, BALL_NORTH);
    shell.add('gold', paint(back, WALL));
    const hiddenHole = () => {
        const hole = new Shape();
        hole.moveTo(hiddenWest - cx, 0);
        hole.lineTo(hiddenEast - cx, 0);
        hole.lineTo(hiddenEast - cx, BALL_HIDDEN_TALL);
        hole.lineTo(hiddenWest - cx, BALL_HIDDEN_TALL);
        hole.lineTo(hiddenWest - cx, 0);
        return hole;
    };
    // (Dark to the hall, "In the darkness at the edge of the hall, behind the lights", without gold's glow; dusty gold
    // to the corridor.)
    const layer = BALL_PARTITION_THICK / 2;
    const darkSide = endWall(hiddenHole(), layer, width / 2 - 0.1);
    darkSide.translate(cx, floor, BALL_STAGE_BACK - layer);
    shell.add('brick', paint(darkSide, DARK));
    const goldSide = endWall(hiddenHole(), layer, width / 2 - 0.1);
    goldSide.translate(cx, floor, partitionNorth);
    shell.add('gold', paint(goldSide, DUSTY));

    // The vault over it, of verdigris, out past the walls and the ends; a gilded finial at each end of its crown.
    const roofOut = arcRadius + 0.14;
    const spread = Math.asin((width / 2 + 0.3) / roofOut);
    const roof = new Shape();
    roof.absarc(0, arcCentre, roofOut, Math.PI / 2 - spread, Math.PI / 2 + spread, false);
    roof.absarc(0, arcCentre, arcRadius, Math.PI / 2 + spread, Math.PI / 2 - spread, true);
    roof.closePath();
    const vault = new ExtrudeGeometry(roof, { depth: BALL_SOUTH - BALL_NORTH + 0.5, bevelEnabled: false, curveSegments: 14 });
    vault.translate(cx, floor, BALL_NORTH - 0.25);
    shell.add('copper', paint(vault, VERDIGRIS));
    for (const z of [BALL_SOUTH + 0.1, BALL_NORTH - 0.1]) {
        shell.add('gold', ball(0.13, { x: cx, y: eaves + BALL_RISE + 0.24, z }, RAIL_GOLD, 6, 4));
        shell.add('gold', cone(0.07, 0.5, 6, { x: cx, y: eaves + BALL_RISE + 0.55, z }, RAIL_GOLD));
    }

    // Pilasters down each side between the windows, and on its face; the course at the windows' sills; round the
    // doorway an arch of stone, round the balcony's arch another.
    for (const [x, out] of [[BALL_WEST, -1], [BALL_EAST, 1]]) {
        for (const z of [BALL_SOUTH - 0.2, -33.97, -35.52, -37.55, -40.1, -41.5]) {
            shell.add('stone', box(0.12, BALL_TALL - 0.1, 0.3, { x: x + out * 0.06, y: floor + (BALL_TALL - 0.1) / 2, z }, TRIM));
        }
        shell.add('stone', box(0.08, 0.1, BALL_SOUTH - BALL_NORTH - 0.02, { x: x + out * 0.04, y: floor + 1.24, z: (BALL_SOUTH + BALL_NORTH) / 2 }, TRIM));
    }
    for (const x of [BALL_WEST + 0.2, BALL_DOOR_X - BALL_DOOR_WIDE / 2 - 0.42, BALL_DOOR_X + BALL_DOOR_WIDE / 2 + 0.42, BALL_EAST - 0.2]) {
        shell.add('stone', box(0.34, BALL_TALL - 0.1, 0.12, { x, y: floor + (BALL_TALL - 0.1) / 2, z: BALL_SOUTH + 0.06 }, TRIM));
    }
    shell.add('stone', archRing(BALL_DOOR_WIDE + 0.02, BALL_DOOR_SPRING, 0.2, 0.14, { x: BALL_DOOR_X, y: floor, z: BALL_SOUTH + 0.06 }, TRIM, 8));
    shell.add('stone', archRing(BALL_BALCONY_DOOR[1] - BALL_BALCONY_DOOR[0] + 0.02, BALL_BALCONY_DOOR_SPRING, 0.14, 0.12, { x: balconyDoorMiddle, y: floor, z: BALL_NORTH - 0.05, ry: Math.PI }, TRIM, 6));
    // High in each gable, a round window, lit; on the far face, two high arched windows either side of the balcony's arch.
    for (const [z, ry] of [[BALL_SOUTH + 0.012, 0], [BALL_NORTH - 0.012, Math.PI]]) {
        shell.add('glow', paint(pose(new CircleGeometry(0.55, 14), { x: cx, y: floor + 4.45, z, ry }), WINDOW_LOW));
        shell.add('stone', paint(pose(new RingGeometry(0.55, 0.72, 14), { x: cx, y: floor + 4.45, z: z + (ry ? -0.01 : 0.01), ry }), TRIM));
    }
    for (const x of [1.95, 5.85]) {
        const at = { x, y: floor + 2.3, z: BALL_NORTH - 0.012, ry: Math.PI };
        shell.add('glow', arched(0.66, 1.25, 0.03, at, WINDOW_LOW, 4));
        shell.add('stone', archRing(0.66, 1.25, 0.09, 0.08, at, TRIM, 4));
    }
    // The doors themselves, two leaves of gold standing open into the hall.
    for (const side of [-1, 1]) {
        const leaf = arched(BALL_DOOR_WIDE / 2 - 0.03, BALL_DOOR_SPRING, 0.06, { x: -side * (BALL_DOOR_WIDE / 4 - 0.015) }, 0xd8a848, 6);
        pose(leaf, { x: BALL_DOOR_X + side * BALL_DOOR_WIDE / 2, y: floor, z: innerSouth - 0.04, ry: -side * BALL_DOORS_OPEN });
        shell.add('gold', leaf, { passable: true });
    }
    // The windows: tall arches down each side, lit; inside, the dusk through them.
    for (const [x, ry, out] of [[BALL_WEST - 0.012, -Math.PI / 2, -1], [BALL_EAST + 0.012, Math.PI / 2, 1]]) {
        for (const z of [-33.2, -34.75, -36.3, -38.8]) {
            const at = { x, y: floor + 1.3, z, ry };
            shell.add('glow', arched(0.8, 2.0, 0.03, at, WINDOW, 4));
            shell.add('stone', archRing(0.8, 2.0, 0.1, 0.08, at, TRIM, 4));
            for (const piece of frame([box(1.06, 0.07, 0.14, { y: -0.035, z: 0.04 }, TRIM)], at)) shell.add('stone', piece);
            // (Night high in the glass, the last of the sunset low in it.)
            const night = paintBy(arched(0.8, 2.0, 0.02, { x: x - out * (BALL_WALL + 0.025), y: floor + 1.3, z, ry: ry + Math.PI }, DUSK, 4), (px, py, pz, color) => {
                color.set(DUSK).lerp(DUSK_LOW, MathUtils.clamp(1 - (py - floor - 1.3) / 1.6, 0, 1) ** 1.6);
            });
            inside.add('glow', night);
        }
    }
    // Golden struts from the cliff's face, under the rim, out to the floor's underside; a beam along under each.
    for (const x of [BALL_WEST + 0.5, cx - 1.2, cx + 1.2, BALL_EAST - 0.5]) {
        const from = new Vector3(x, -2.6, northRimZ(x) + 0.35);
        for (const z of [-35.2, -40.4]) shell.add('gold', tube([from, new Vector3(x, floor - 0.5, z)], 0.075, TRIM, 1, 6), { passable: true });
        shell.add('gold', box(0.14, 0.14, BALL_SOUTH - BALL_NORTH - 0.4, { x, y: floor - 0.52, z: (BALL_SOUTH + BALL_NORTH) / 2 }, TRIM), { passable: true });
    }

    // The balcony, out over the ocean: its floor, its posts and rails (the filigree between them: below); the chairs
    // tumbled about; the bottle of cognac at her feet.
    shell.add('stone', box(balconyEast - balconyWest, 0.3, BALL_BALCONY_DEEP, { x: (balconyWest + balconyEast) / 2, y: floor - 0.15, z: BALL_NORTH - BALL_BALCONY_DEEP / 2 }, TRIM));
    for (const [x, z] of [[balconyWest, balconyFar + 0.035], [(balconyWest + balconyEast) / 2, balconyFar + 0.035], [balconyEast, balconyFar + 0.035], [balconyWest, BALL_NORTH - 0.06], [balconyEast, BALL_NORTH - 0.06]]) {
        shell.add('gold', box(0.07, 0.98, 0.07, { x, y: floor + 0.49, z }, RAIL_GOLD), { passable: true });
    }
    shell.add('gold', box(balconyEast - balconyWest + 0.07, 0.05, 0.08, { x: (balconyWest + balconyEast) / 2, y: floor + 0.98, z: balconyFar + 0.035 }, RAIL_GOLD), { passable: true });
    for (const x of [balconyWest, balconyEast]) {
        shell.add('gold', box(0.08, 0.05, BALL_BALCONY_DEEP, { x, y: floor + 0.98, z: BALL_NORTH - BALL_BALCONY_DEEP / 2 }, RAIL_GOLD), { passable: true });
    }
    const chair = () => {
        const parts = [box(0.3, 0.035, 0.3, { y: 0.36 }, CHAIR_GOLD), box(0.3, 0.34, 0.035, { y: 0.55, z: -0.135 }, CHAIR_GOLD)];
        for (const [px, pz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) parts.push(box(0.028, 0.36, 0.028, { x: px, y: 0.18, z: pz }, 0xb8902e));
        return mergeGeometries(parts.map((part) => unindexed(part)), false);
    };
    for (const [x, z, ry, rx, rz] of BALL_TUMBLED) {
        // (Tipped as it fell, then set on the floor where it lies.)
        const piece = pose(chair(), { rx, rz });
        piece.computeBoundingBox();
        piece.translate(0, -piece.boundingBox.min.y, 0);
        shell.add('gold', pose(piece, { x, y: floor, z, ry }), { passable: true });
    }
    const bottle = new LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.018], [0.036, 0.11], [0.026, 0.145], [0.011, 0.162], [0.011, 0.215], [0.014, 0.22], [0, 0.224]].map(([r, y]) => new Vector2(r, y)), 7);
    shell.add('brick', paint(pose(bottle, { x: BALL_COGNAC[0], y: floor, z: BALL_COGNAC[1] }), 0x8a4a14), { passable: true });

    // Inside. The parquet; the corridor's floor of dusty gold; velvet round the walls; the vault's underside, deep red.
    inside.add('brick', box(innerEast - innerWest, 0.012, innerSouth - BALL_STAGE_BACK, { x: cx, y: floor + 0.006, z: (innerSouth + BALL_STAGE_BACK) / 2 }, PARQUET));
    inside.add('brick', box(innerEast - innerWest, 0.012, partitionNorth - innerNorth, { x: cx, y: floor + 0.006, z: (partitionNorth + innerNorth) / 2 }, DUSTY));
    for (const x of [innerWest + 0.015, innerEast - 0.015]) {
        inside.add('cloth', box(0.03, 1.0, innerSouth - BALL_STAGE_FRONT, { x, y: floor + 0.5, z: (innerSouth + BALL_STAGE_FRONT) / 2 }, VELVET));
    }
    const lining = new Shape();
    lining.absarc(0, arcCentre, arcRadius - 0.01, Math.PI / 2 - arcAngle, Math.PI / 2 + arcAngle, false);
    lining.absarc(0, arcCentre, arcRadius - 0.05, Math.PI / 2 + arcAngle, Math.PI / 2 - arcAngle, true);
    lining.closePath();
    const ceiling = new ExtrudeGeometry(lining, { depth: innerSouth - innerNorth, bevelEnabled: false, curveSegments: 12 });
    ceiling.translate(cx, floor, innerNorth);
    inside.add('brick', paint(ceiling, 0x5a2a2a));

    // The stage, its gold edge and footlights; the podium (a lectern and its microphone); the curtains, deep red.
    inside.add('brick', box(BALL_STAGE_EAST - innerWest, BALL_STAGE_TALL, BALL_STAGE_FRONT - BALL_STAGE_BACK, { x: (innerWest + BALL_STAGE_EAST) / 2, y: floor + BALL_STAGE_TALL / 2, z: (BALL_STAGE_FRONT + BALL_STAGE_BACK) / 2 }, STAGE_WOOD));
    inside.add('gold', box(BALL_STAGE_EAST - innerWest, 0.07, 0.03, { x: (innerWest + BALL_STAGE_EAST) / 2, y: stageTop - 0.035, z: BALL_STAGE_FRONT + 0.015 }, RAIL_GOLD));
    for (let lamp = 0; lamp < 7; lamp += 1) {
        const x = innerWest + 0.35 + lamp * ((BALL_STAGE_EAST - innerWest - 0.7) / 6);
        inside.add('glow', box(0.12, 0.05, 0.06, { x, y: stageTop + 0.025, z: BALL_STAGE_FRONT - 0.05 }, FOOTLIGHT), { passable: true });
    }
    const podium = { x: BALL_DOOR_X, z: BALL_STAGE_FRONT - 0.45 };
    inside.add('brick', box(0.42, 0.78, 0.3, { x: podium.x, y: stageTop + 0.39, z: podium.z }, 0x4a2a1e));
    inside.add('gold', box(0.5, 0.04, 0.36, { x: podium.x, y: stageTop + 0.8, z: podium.z - 0.02, rx: -0.3 }, RAIL_GOLD));
    inside.add('steel', cylinder(0.008, 0.008, 0.32, 4, { x: podium.x + 0.12, y: stageTop + 0.94, z: podium.z - 0.1, rx: -0.5 }, 0x2a2a2a), { passable: true });
    const curtain = (x0, x1, z, bottom, tall, color = VELVET, deep = VELVET_DEEP) => {
        // (Hung in folds: a strip waved across its width, its colour deepening into each fold.)
        const across = x1 - x0;
        const folds = Math.max(2, Math.round(across / 0.3));
        const strip = new PlaneGeometry(across, tall, folds * 2, 1);
        const position = strip.attributes.position;
        for (let vertex = 0; vertex < position.count; vertex += 1) {
            position.setZ(vertex, Math.sin(((position.getX(vertex) + across / 2) / across) * folds * Math.PI * 2) * 0.05);
        }
        strip.computeVertexNormals();
        pose(strip, { x: (x0 + x1) / 2, y: bottom + tall / 2, z });
        const shade = new Color(deep);
        return paintBy(strip, (px, py, pz, out) => out.set(color).lerp(shade, 0.5 + 0.5 * Math.sin(((px - x0) / across) * folds * Math.PI * 2 + Math.PI / 2)));
    };
    const drape = BALL_TALL - BALL_STAGE_TALL - 0.5;
    inside.add('cloth', curtain(innerWest + 0.02, BALL_STAGE_EAST, BALL_STAGE_BACK + 0.1, stageTop, drape), { passable: true });
    for (const [x0, x1] of [[innerWest + 0.02, innerWest + 0.6], [BALL_STAGE_EAST - 0.58, BALL_STAGE_EAST]]) {
        inside.add('cloth', curtain(x0, x1, BALL_STAGE_FRONT - 0.08, stageTop, drape), { passable: true });
    }
    inside.add('cloth', curtain(innerWest + 0.02, BALL_STAGE_EAST, BALL_STAGE_FRONT - 0.04, stageTop + drape - 0.7, 0.7), { passable: true });

    // The tables, their cloths and candles.
    for (const [x, z] of BALL_TABLES) {
        inside.add('brick', paint(pose(new CylinderGeometry(BALL_TABLE_RADIUS, BALL_TABLE_RADIUS + 0.05, BALL_TABLE_TALL, 12, 1, true), { x, y: floor + BALL_TABLE_TALL / 2, z }), CLOTH_WHITE));
        inside.add('brick', paint(pose(new CircleGeometry(BALL_TABLE_RADIUS, 12), { x, y: floor + BALL_TABLE_TALL, z, rx: -Math.PI / 2 }), CLOTH_WHITE));
        inside.add('glow', cone(0.03, 0.1, 5, { x, y: floor + BALL_TABLE_TALL + 0.07, z }, CANDLE), { passable: true });
    }
    // The chandeliers over the aisle: a chain from the vault, two rings of candles, and crystal drops that twinkle.
    const crystals = [];
    for (const z of [-33.2, -34.75, -36.3]) {
        const hang = floor + BALL_CHANDELIER_HANG;
        const top = eaves + BALL_RISE - 0.05;
        inside.add('gold', cylinder(0.012, 0.012, top - hang, 4, { x: cx, y: (top + hang) / 2, z }, 0xb8963c), { passable: true });
        inside.add('gold', paint(pose(new TorusGeometry(0.42, 0.025, 4, 16), { x: cx, y: hang, z, rx: Math.PI / 2 }), 0xe0b450), { passable: true });
        inside.add('gold', paint(pose(new TorusGeometry(0.26, 0.022, 4, 12), { x: cx, y: hang + 0.3, z, rx: Math.PI / 2 }), 0xe0b450), { passable: true });
        inside.add('glow', ball(0.08, { x: cx, y: hang - 0.14, z, sy: 1.5 }, light(0xfff2d0, 2.2), 6, 4), { passable: true });
        for (let arm = 0; arm < 8; arm += 1) {
            const angle = (arm / 8) * Math.PI * 2;
            const ring = arm % 2 ? 0.26 : 0.42;
            const y = arm % 2 ? hang + 0.36 : hang + 0.06;
            inside.add('glow', cone(0.028, 0.09, 4, { x: cx + Math.cos(angle) * ring, y, z: z + Math.sin(angle) * ring }, light(0xffe0a0, 2.6)), { passable: true });
            const drop = paint(pose(new OctahedronGeometry(0.03, 0), { x: cx + Math.cos(angle + 0.39) * 0.4, y: hang - 0.13, z: z + Math.sin(angle + 0.39) * 0.4, sy: 2 }), light(0xe8f4ff, 1.3));
            drop.setAttribute('sparkle', new Float32BufferAttribute(new Array(drop.attributes.position.count).fill(random()), 1));
            crystals.push(drop);
        }
        // (A bright thing: a chandelier, touched, chimes, its drops flashing in turn as stars. bright.js)
        if (bright) {
            const lights = [];
            for (let arm = 0; arm < 8; arm += 1) {
                const angle = (arm / 8) * Math.PI * 2 + 0.39;
                lights.push({ at: new Vector3(cx + Math.cos(angle) * 0.4, hang - 0.13, z + Math.sin(angle) * 0.4), color: 0xe8f4ff, size: 0.26, kind: 'star', after: ((arm * 3) % 8) * 0.07 });
            }
            lights.push({ at: new Vector3(cx, hang - 0.14, z), color: 0xfff2d0, size: 0.9 });
            bright.push({ kind: 'crystal', center: new Vector3(cx, hang + 0.1, z), radius: 0.55, fragment: null, lights });
        }
    }
    // Behind the wall: the corridor's "abandoned costume lockers" (one hangs open, a fae robe still in it, pinks and
    // greens) and its "empty changerooms", their curtains half drawn.
    const lockerColors = [0x8a7448, 0x7a6640, 0x948052, 0x857048];
    for (let locker = 0; locker < 4; locker += 1) {
        const x = innerWest + 0.26 + locker * 0.45;
        if (locker !== 2) {
            inside.add('steel', box(0.42, 1.7, 0.36, { x, y: floor + 0.85, z: innerNorth + 0.19 }, lockerColors[locker]));
            continue;
        }
        // (Its inside dark, its door swung out, the robe hanging in it.)
        inside.add('steel', box(0.42, 1.7, 0.34, { x, y: floor + 0.85, z: innerNorth + 0.17 }, 0x1e1812));
        const swung = 1.1;
        const hingeX = x - 0.21;
        const hingeZ = innerNorth + 0.37;
        inside.add('steel', box(0.4, 1.66, 0.025, { x: hingeX + Math.cos(swung) * 0.2, y: floor + 0.85, z: hingeZ + Math.sin(swung) * 0.2, ry: -swung }, lockerColors[locker]), { passable: true });
        inside.add('cloth', cone(0.15, 1.0, 7, { x, y: floor + 1.05, z: innerNorth + 0.24, sz: 0.45 }, 0xe88aa8), { passable: true });
        inside.add('cloth', box(0.28, 0.06, 0.08, { x, y: floor + 0.95, z: innerNorth + 0.3 }, 0x5aa86a), { passable: true });
    }
    for (const [x0, x1] of [[4.45, 5.48], [5.52, 6.55]]) {
        for (const x of [x0, x1]) inside.add('brick', box(0.04, 1.9, 0.8, { x, y: floor + 0.95, z: innerNorth + 0.4 }, 0x6a5038));
        inside.add('gold', box(x1 - x0, 0.03, 0.03, { x: (x0 + x1) / 2, y: floor + 1.95, z: innerNorth + 0.8 }, RAIL_GOLD), { passable: true });
        inside.add('cloth', curtain(x0 + 0.03, x0 + (x1 - x0) * 0.45, innerNorth + 0.8, floor + 0.1, 1.82, 0x4e6e46, 0x2a4228), { passable: true });
    }

    // Built: the shell, a solid to the camera (solids.js); the rest, together.
    const solid = new Group();
    solid.name = 'ball-solid';
    for (const [key, mesh] of shell.build(materials)) {
        mesh.name = `ball-${key}`;
        solid.add(mesh);
    }
    extras.push(solid);
    const group = new Group();
    group.name = 'ball';
    const insides = new Group();
    insides.name = 'ball-insides';
    insides.visible = false;
    for (const [key, mesh] of inside.build(materials)) {
        mesh.name = `ball-inside-${key}`;
        insides.add(mesh);
    }
    group.add(insides);

    // The people: the old Greek at the podium, and Cassandra, one at a time there; Cassandra on the balcony.
    const figureMaterial = new MeshToonMaterial({ gradientMap: materials.gold.gradientMap, vertexColors: true });
    const stands = new Vector3(podium.x, stageTop, podium.z - 0.32);
    const greek = new Mesh(greekGeometry(), figureMaterial);
    greek.name = 'ball-greek';
    greek.position.copy(stands);
    const host = new Mesh(cassandraGeometry('podium'), figureMaterial);
    host.name = 'ball-cassandra';
    host.position.copy(stands);
    host.scale.set(0.7, 1e-3, 0.7);
    host.visible = false;
    const sitting = new Mesh(cassandraGeometry('balcony'), figureMaterial);
    sitting.name = 'ball-cassandra-balcony';
    sitting.position.set(BALL_SHE_SITS[0], floor, BALL_SHE_SITS[1]);
    sitting.rotation.y = 0.08;
    insides.add(greek, host);
    group.add(sitting);
    // The guests at the tables, in silhouette, turned to the stage; the band, at the stage's back, not there yet.
    const guests = [];
    BALL_TABLES.forEach(([x, z], table) => {
        for (let seat = 0; seat < 4; seat += 1) {
            const angle = (seat / 4) * Math.PI * 2 + 0.6 + table * 0.5;
            guests.push([x + Math.cos(angle) * BALL_SEATED, floor, z + Math.sin(angle) * BALL_SEATED, 0.46, 0.69, (seat + table) % CROWD_CELLS, random()]);
        }
    });
    const crowd = silhouettes(guests, crowdAtlas(), CROWD_CELLS, { color: 0x150c16, name: 'ball-crowd' });
    const players = [
        [innerWest + 0.55, stageTop, BALL_STAGE_BACK + 0.55, 0.62, 1.24, 0, 0.1],
        [innerWest + 1.35, stageTop, BALL_STAGE_BACK + 0.4, 0.62, 1.24, 1, 0.45],
        [podium.x - 0.75, stageTop, BALL_STAGE_BACK + 0.75, 0.62, 1.24, 2, 0.7],
        [podium.x + 1.0, stageTop, BALL_STAGE_BACK + 0.6, 0.62, 1.24, 3, 0.25],
    ];
    const band = silhouettes(players, bandAtlas(), BAND_CELLS, { color: 0x1c1020, name: 'ball-band' });
    band.uniforms.silhouetteShown.value = 0;
    band.mesh.visible = false;
    insides.add(crowd.mesh, band.mesh);
    const twinkle = { value: 0 };
    const crystalMaterial = new MeshBasicMaterial({ vertexColors: true });
    alsoBeforeCompile(crystalMaterial, 'ball-twinkle', (shader) => {
        shader.uniforms.twinkleTime = twinkle;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float sparkle;\nuniform float twinkleTime;\nvarying float vTwinkle;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTwinkle = 0.75 + 1.1 * pow(max(0.0, sin(twinkleTime * 2.3 + sparkle * 6.2831)), 14.0);');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vTwinkle;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTwinkle;');
    });
    const chandeliers = new Mesh(mergeGeometries(crystals, false), crystalMaterial);
    chandeliers.name = 'ball-crystals';
    insides.add(chandeliers);
    // The filigreed railing, between the balcony's posts: panels of scrollwork, gold in the dusk light.
    const filigree = filigreePanel();
    filigree.wrapS = RepeatWrapping;
    const panels = [];
    const panel = (x0, z0, x1, z1) => {
        const length = Math.hypot(x1 - x0, z1 - z0);
        const quad = new PlaneGeometry(length, 0.9);
        const uv = quad.attributes.uv;
        for (let vertex = 0; vertex < uv.count; vertex += 1) uv.setX(vertex, uv.getX(vertex) * Math.max(1, Math.round(length / 1.6)));
        quad.rotateY(-Math.atan2(z1 - z0, x1 - x0));
        quad.translate((x0 + x1) / 2, floor + 0.52, (z0 + z1) / 2);
        panels.push(quad);
    };
    const balconyMiddle = (balconyWest + balconyEast) / 2;
    panel(balconyWest, balconyFar + 0.035, balconyMiddle, balconyFar + 0.035);
    panel(balconyMiddle, balconyFar + 0.035, balconyEast, balconyFar + 0.035);
    panel(balconyWest, BALL_NORTH, balconyWest, balconyFar);
    panel(balconyEast, BALL_NORTH, balconyEast, balconyFar);
    // (Gold, metal: the city's cube in it, as in the halls': kit.js.)
    const railing = new Mesh(mergeGeometries(panels, false), reflective(new MeshToonMaterial({ gradientMap: materials.gold.gradientMap, map: filigree, color: RAIL_GOLD, alphaTest: 0.45, side: DoubleSide }), GOLD_SHOWS));
    railing.name = 'ball-railing';
    group.add(railing);
    // The hidden door, dark, its bar of polished gold at waist height on the hall's side: on its west hinge, it swings
    // back into the corridor as someone comes to it.
    const hiddenWide = hiddenEast - hiddenWest;
    const hinge = new Group();
    hinge.name = 'ball-hidden-door';
    hinge.position.set(hiddenWest + 0.01, floor, BALL_STAGE_BACK - layer);
    const hiddenLeaf = new Mesh(mergeGeometries([
        unindexed(box(hiddenWide - 0.03, BALL_HIDDEN_TALL - 0.02, 0.05, { x: hiddenWide / 2, y: (BALL_HIDDEN_TALL - 0.02) / 2 }, 0x2a201a)),
        unindexed(cylinder(0.02, 0.02, hiddenWide - 0.16, 8, { x: hiddenWide / 2, y: 0.8, z: 0.075, rz: Math.PI / 2 }, light(0xffe090, 1.15))),
        unindexed(box(0.035, 0.06, 0.06, { x: 0.12, y: 0.8, z: 0.045 }, 0xe0b450)),
        unindexed(box(0.035, 0.06, 0.06, { x: hiddenWide - 0.15, y: 0.8, z: 0.045 }, 0xe0b450)),
    ], false), materials.brick);
    hiddenLeaf.name = 'ball-hidden-door-leaf';
    hinge.add(hiddenLeaf);
    insides.add(hinge);
    extras.push(group);

    // The speech, the band, the hidden door, the balcony: a scene on a clock of its own (stage.js steps it with the walk's
    // state and the camera; main.js gives it its sounds and the words, through onSound and onSay).
    const greekSays = new Vector3(stands.x, stageTop + 1.75, stands.z);
    const atThePodium = new Vector3(stands.x, stageTop + 1.3, stands.z);
    const sheSays = new Vector3(BALL_SHE_SITS[0], floor + 1.15, BALL_SHE_SITS[1] + 0.2);
    const middle = new Vector3(cx, floor + 2, (BALL_SOUTH + BALL_NORTH) / 2);
    const hiddenMiddle = new Vector2((hiddenWest + hiddenEast) / 2, BALL_STAGE_BACK - layer);
    const inHall = (x, z) => x > innerWest && x < innerEast && z < innerSouth && z > BALL_STAGE_FRONT;
    const inBuilding = (x, z) => x > BALL_WEST && x < BALL_EAST && z < BALL_SOUTH && z > balconyFar;
    const onBalcony = (x, z) => x > balconyWest && x < balconyEast && z < BALL_NORTH && z > balconyFar;
    /** Who's shown (1) or not (0): each rises out of nothing, or sinks back into it. */
    const shown = new Map([[greek, 1], [host, 0], [sitting, 1]]);
    const beats = new Set();
    let speech = null;
    let away = 0;
    let clock = 0;
    let swing = 0;
    let opening = false;
    let balconyFor = 0;
    let heard = false;
    let saying = null;
    let watching = false;
    const say = (words, point, seconds) => {
        saying = { until: clock + seconds };
        scene.onSay?.(words, point);
    };
    const scene = {
        /** Called with 'mutter', 'applause', 'band', 'bar' or 'murmur'. */
        onSound: null,
        /** Called with words and where they're said (a world point), and with null when they're done. */
        onSay: null,
        /** Called with the podium (a world point) for the walking camera to take in while the speech is seen, then null. */
        onWatch: null,
        /** Whether the speech is being given. */
        get speaking() {
            return speech !== null && speech < BALL_SPEECH.band;
        },
        /** Whether the hidden door stands open (its doorway is a floor, walk.js, only then). */
        get doorOpen() {
            return swing > 0.9;
        },
        /** For the local checks: hold the hidden door open, as if someone were at it. */
        heldOpen: false,
        /** Her, on the balcony, touched: she talks to herself, then says it. */
        touch() {
            if (!sitting.visible || scene.speaking) return false;
            scene.onSound?.('murmur');
            say(BALL_NOT_DRUNK, sheSays, 3.4);
            return true;
        },
        /** Every frame: the scene's clock; whoever's walking (or flying), and where; and where the eye is. */
        update(dt, walker, camera) {
            clock += dt;
            if (camera) insides.visible = camera.position.distanceTo(middle) < BALL_INSIDE_SEEN;
            const walking = Boolean(walker?.walking);
            const x = walker?.position.x ?? 0;
            const z = walker?.position.z ?? 0;
            // Someone comes in: the speech is given (once, until they've been out of the building a while).
            if (walking && speech === null && inHall(x, z)) {
                speech = 0;
                beats.clear();
            }
            if (speech !== null) {
                speech += dt;
                const beat = (name) => {
                    if (speech < BALL_SPEECH[name] || beats.has(name)) return false;
                    beats.add(name);
                    return true;
                };
                if (beat('mutters')) {
                    scene.onSound?.('mutter');
                    say(BALL_MUTTERED, greekSays, 2.1 * BALL_PACE);
                }
                if (beat('applause')) scene.onSound?.('applause');
                if (beat('vanishes')) shown.set(greek, 0);
                if (beat('appears')) {
                    shown.set(host, 1);
                    shown.set(sitting, 0);
                }
                if (beat('elysicester')) say(BALL_THANKS[0], greekSays, 2.2 * BALL_PACE);
                if (beat('elysium')) say(BALL_THANKS[1], greekSays, 2.4 * BALL_PACE);
                if (beat('leaves')) {
                    shown.set(host, 0);
                    shown.set(sitting, 1);
                }
                if (beat('band')) scene.onSound?.('band');
                // (Once whoever came in has stepped out of the building, over or not, all is as it was, and it begins
                // again when they come back in. Letting go of the hum in the hall, to watch, isn't stepping out.)
                away = walker && !inBuilding(x, z) ? away + dt : 0;
                if (away > BALL_AGAIN) {
                    speech = null;
                    away = 0;
                    shown.set(greek, 1);
                    shown.set(host, 0);
                    shown.set(sitting, 1);
                    if (saying) {
                        saying = null;
                        scene.onSay?.(null);
                    }
                }
            }
            const since = speech ?? -1;
            // While the speech is given (and the band comes on) and someone in the hall sees it, the walking camera takes
            // in the podium too (walk.js watch), so the one speaking is in sight with them.
            const watch = walking && since >= 0 && since < BALL_SPEECH.band + 4 && inHall(x, z);
            if (watch !== watching) {
                watching = watch;
                scene.onWatch?.(watch ? atThePodium : null);
            }
            // The guests clap (each lifting in its turn) from the applause until she has her hush; the band plays.
            crowd.uniforms.silhouetteBob.value = !still && since >= BALL_SPEECH.applause && since < BALL_SPEECH.appears + 0.6 ? 1 : 0;
            const bandShown = since >= BALL_SPEECH.band ? (still ? 1 : Math.min(1, (since - BALL_SPEECH.band) / 0.8)) : 0;
            band.uniforms.silhouetteShown.value = bandShown;
            band.uniforms.silhouetteBob.value = still ? 0 : 0.5;
            band.mesh.visible = bandShown > 0;
            crowd.uniforms.silhouetteTime.value = clock;
            band.uniforms.silhouetteTime.value = clock * 0.55;
            twinkle.value = still ? 0 : clock;
            // (The old Greek, between his aphorisms, rocks with them.)
            greek.rotation.x = still || since >= BALL_SPEECH.applause ? 0 : Math.sin(clock * 4.2) * 0.035;
            for (const [figure, want] of shown) {
                let next = still ? want : figure.scale.y + (want - figure.scale.y) * (1 - Math.exp(-7 * dt));
                if (Math.abs(next - want) < 0.01) next = want;
                figure.scale.set(0.7 + 0.3 * next, Math.max(1e-3, next), 0.7 + 0.3 * next);
                figure.visible = next > 0.01;
            }
            // Out on the balcony, she's talking to herself; come near, and she says it (once each time out there).
            const out = walking && onBalcony(x, z);
            if (out && balconyFor === 0 && sitting.visible) scene.onSound?.('murmur');
            balconyFor = out ? balconyFor + dt : 0;
            if (out && !heard && sitting.visible && balconyFor > 1.1 && Math.hypot(x - BALL_SHE_SITS[0], z - BALL_SHE_SITS[1]) < BALL_SHE_HEARS) {
                heard = true;
                say(BALL_NOT_DRUNK, sheSays, 3.4);
            }
            if (!out) heard = false;
            if (saying && clock > saying.until) {
                saying = null;
                scene.onSay?.(null);
            }
            // The hidden door: someone at it (on either side), and its bar is shoved, and it swings back; then to again.
            const near = (walking && Math.hypot(x - hiddenMiddle.x, z - hiddenMiddle.y) < BALL_HIDDEN_NEAR) || scene.heldOpen;
            if (near && !opening) scene.onSound?.('bar');
            opening = near;
            swing += ((near ? BALL_HIDDEN_SWING : 0) - swing) * (still ? 1 : 1 - Math.exp(-(near ? 4 : 2.5) * dt));
            if (swing < 1e-3) swing = 0;
            hinge.rotation.y = swing;
        },
    };

    // Where a body may stand: the terrace; through the doorway, between its doors; the hall, round its tables (a hum
    // flies over them); the dark aisle beside the stage (never the stage); the hidden doorway while it stands open; the
    // corridor, round its lockers and changerooms; the balcony's arch, and the balcony, round her, the chairs and the
    // bottle. (A floor given exactly is its own bound, walk.js: off the land, nothing else holds a body.)
    const girth = 0.12;
    const between = (v, a, b) => v > a && v < b;
    const clearOf = (x, z, spots) => spots.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) >= r);
    const atTables = BALL_TABLES.map(([x, z]) => [x, z, BALL_SEATED + 0.2]);
    const onBalconyFloor = [[BALL_SHE_SITS[0], BALL_SHE_SITS[1] + 0.3, 0.6], [BALL_COGNAC[0], BALL_COGNAC[1], 0.15], ...BALL_TUMBLED.map(([x, z]) => [x, z, 0.32])];
    const leafReach = (BALL_DOOR_WIDE / 2) * Math.sin(BALL_DOORS_OPEN) + girth;
    const leafAcross = (BALL_DOOR_WIDE / 2) * Math.cos(BALL_DOORS_OPEN) + girth;
    const byTheDoors = (x, z) => z > innerSouth - leafReach && (Math.abs(x - (BALL_DOOR_X - BALL_DOOR_WIDE / 2)) < leafAcross || Math.abs(x - (BALL_DOOR_X + BALL_DOOR_WIDE / 2)) < leafAcross);
    const floorAt = (x, z, flying = false) => {
        if (between(x, BALL_WEST + girth, BALL_EAST - girth) && between(z, BALL_SOUTH, BALL_TERRACE_SOUTH)) return BALL_TERRACE_TOP;
        if (between(z, innerSouth - girth, BALL_SOUTH + 1e-3)) return between(x, BALL_DOOR_X - BALL_DOOR_WIDE / 2 + girth, BALL_DOOR_X + BALL_DOOR_WIDE / 2 - girth) ? floor : null;
        if (between(x, innerWest + girth, innerEast - girth) && between(z, BALL_STAGE_FRONT, innerSouth - girth + 1e-3)) {
            if (byTheDoors(x, z)) return null;
            return flying || clearOf(x, z, atTables) ? floor : null;
        }
        if (between(x, BALL_STAGE_EAST + girth, innerEast - girth) && between(z, BALL_STAGE_BACK + girth, BALL_STAGE_FRONT + 1e-3)) return floor;
        if (between(x, hiddenWest + girth, hiddenEast - girth) && between(z, partitionNorth - girth, BALL_STAGE_BACK + girth + 1e-3)) return scene.doorOpen ? floor : null;
        if (between(x, innerWest + girth, innerEast - girth) && between(z, innerNorth + girth, partitionNorth - girth + 1e-3)) {
            const lockers = x < innerWest + 1.83 + girth && z < innerNorth + 0.37 + girth;
            const lockerDoor = between(x, 1.9, 2.32) && z < innerNorth + 0.62;
            const changerooms = between(x, 4.45 - girth, 6.55 + girth) && z < innerNorth + 0.8 + girth;
            return lockers || lockerDoor || changerooms ? null : floor;
        }
        if (between(x, BALL_BALCONY_DOOR[0] + girth, BALL_BALCONY_DOOR[1] - girth) && between(z, BALL_NORTH - 1e-3, innerNorth + girth + 1e-3)) return floor;
        if (between(x, balconyWest + girth, balconyEast - girth) && between(z, balconyFar + 0.035 + girth, BALL_NORTH)) return clearOf(x, z, onBalconyFloor) ? floor : null;
        return null;
    };

    return {
        floor: { floorAt },
        door: scene,
        // A touch on her, on the balcony: she says it (main.js).
        touch: [{ kind: 'ball-cassandra', center: new Vector3(BALL_SHE_SITS[0], floor + 0.45, BALL_SHE_SITS[1] + 0.15), radius: 0.7, fragment: null }],
    };
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
    'door-in-the-floor': buildHostel,
    'cassandras-house': buildCassandra,
    'charity-ball': buildBall,
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
    const houses = await buildHouses(buckets, random, byId, { grand });
    await pause();
    buildSignalTowers(buckets);

    const anchors = new Map();
    const built = new Map();
    // The bright things a touch may find (a trial: bright.js), listed as each place builds them.
    const bright = trialOn('bright') ? [] : null;
    // (A place on trial, trials.js, is built only while its trial is on.)
    for (const place of placeData.places.filter((entry) => entry.tier === 1 && (!entry.trial || trialOn(entry.trial)))) {
        const builder = BUILDERS[place.id];
        if (builder) {
            built.set(place.id, await builder({ buckets, place, random, byId, extras, animated, materials, mounts, wanted, still, grand, halls: houses.hallSpecs ?? [], bright }));
            await pause();
        }
        anchors.set(place.id, new Vector3().fromArray(place.position));
    }

    // Details from the text about the city, each on a random stream of its own (so nothing above moves).
    buildShoreWeed(buckets, { underSand: built.has('door-in-the-floor') });
    const spires = built.get('bridge');
    if (spires) {
        buildVines(buckets, spires);
        buildRibbons(buckets, spires);
        buildChute(buckets, spires);
    }
    // The golden bridges between the buildings (a stream of their own), and the clock their dust keeps.
    const bridges = await buildGoldenBridges(buckets, materials, houses.hallSpecs, spires ?? [], byId, bright);
    if (bridges) animated.push((time) => { bridges.uniforms.bridgeTime.value = time; });
    // The city dressed: its market, lamps, benches, plants, and its park and fountain (Elm's ask; a stream of its
    // own; the grand city's; ?dressing=off leaves it out).
    const dressed = new URLSearchParams(globalThis.location?.search ?? '').get('dressing') !== 'off';
    // (Nothing of the dressing is built on the lots of the places on trial: Cassandra's, the ball's.)
    const lots = [built.has('cassandras-house') ? onCassandrasLot : null, built.has('charity-ball') ? onBallsLot : null].filter(Boolean);
    const keepOff = lots.length ? (x, z, r) => lots.some((onLot) => onLot(x, z, r)) : null;
    const dressing = dressed && houses.hallSpecs
        ? await buildDressing(buckets, { halls: houses.hallSpecs, spires: spires ?? [], byId, extras, animated, still, keepOff, touch: bright })
        : null;

    return {
        anchors,
        mounts,
        extras,
        houses,
        /** The end of the jetty, on its boards: where the walk's shadow waits (walk.js). */
        pierEnd: built.get('jetty-cafes')?.pierEnd ?? null,
        /**
         * Floors given exactly, beyond the ground and the waterfront's decks (walk.js): the steps up to the
         * sea-wall's balcony and the balcony, and the sun-dock's light. Each floorAt(x, z): a height, or null.
         */
        floors: [...built.values()].flatMap((result) => (result?.floor ? [result.floor] : [])),
        /**
         * Surfaces drawn above the walk's floor that a shade lies on, though no one walks on them (creatures.js): the
         * Steel Garden's disc (its trunks stand on it, so the walk keeps to the ground beneath). Each surfaceAt(x, z):
         * the height of its top there, or null.
         */
        surfaces: [...built.values()].flatMap((result) => (result?.surface ? [result.surface] : [])),
        /** The sun-dock's light, for the stage to give the walk's shadow to. */
        sunLight: built.get('sun-dock')?.light ?? null,
        /** The Door in the Floor's white door (a trial), which swings in as the walk's shadow comes to it, or null. */
        hostelDoor: built.get('door-in-the-floor')?.door ?? null,
        /** Cassandra's house (a trial): its door's scene (the knock, her shadow's answer, the slam, the faces), or null. */
        cassandra: built.get('cassandras-house')?.door ?? null,
        /** The charity ball (a trial): its scene (the speech, the band, the hidden door, her on the balcony), or null. */
        ball: built.get('charity-ball')?.door ?? null,
        /** The golden bridges: how many, of which kinds, and the sight line their dust keeps clear (walk.js keeps it). */
        bridges: bridges ? { count: bridges.count, kinds: bridges.kinds, ends: bridges.ends } : null,
        bridgeSight: bridges?.uniforms.bridgeSight.value ?? null,
        /** The bridges' dust, drawn over their merged mesh (stage.js makes it once the buckets are built). */
        bridgeDust: bridges?.dustOf ?? null,
        /** What the dressing set down, by kind (for the local checks), or null. */
        dressing,
        /**
         * What a touch may find, and the words it opens: [{ kind, center, radius, fragment }] (touch.js); and the
         * bright things (a trial), which open none: [{ kind, center, radius, fragment: null, lights }] (bright.js).
         */
        touch: [...[...built.values()].flatMap((result) => result?.touch ?? []), ...(bright ?? [])],
        /** How many bright things a touch may find, by kind (for the local checks), or null. */
        bright: bright ? Object.fromEntries(['lamp', 'lantern', 'crystal'].map((kind) => [kind, bright.filter((thing) => thing.kind === kind).length])) : null,
        update(time) {
            for (const step of animated) step(time);
        },
    };
}