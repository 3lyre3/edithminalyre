/**
 * walk.js — walking the city as the shadow.
 *
 * A shadow with no one there to cast it stands on the last café's outer wall
 * (the shadow of Numbers by Paint, Episode 3). Here it has stepped down to the
 * end of the jetty, looking out to sea: a ring breathes on the boards at its
 * feet, and now and then it lifts an arm and beckons. Tap it (or the "walk as
 * the shadow" button), and it's yours to walk: it turns to face the city, lies
 * long across the paving, away from the sunken sun, and folds up any wall it
 * comes to, as a shadow does. Tap it again (or press Escape) to let go, and it
 * stays where it was left. (With ?walk=off it keeps to its wall.)
 *
 * Nobody is ever drawn. An invisible walker stands in the dusk light, and only
 * its shadow is drawn: each frame the walker alone is rendered, as depth, from
 * the key light's side into a small map of its own, and the city's surfaces
 * read that map (walkerShadow, below), so the city's own long shadows stay
 * drawn once and the walls take no stripes from them.
 *
 * It's steered as the messenger is in Messenger: on a phone, a thumb set down
 * anywhere and dragged (a soft joystick appears under it), or held still (it
 * walks toward the place under it), or a tap (it walks there, a ring marking
 * the spot); on a computer, the arrow keys or WASD, or the mouse held down (it
 * walks toward the pointer) or clicked (it walks there). Keys and joystick go
 * by the way the camera is coming round to look, not the way it happens to be
 * looking as it swings, so the first step after taking the shadow goes where
 * it's meant to. The camera follows above and behind where the one casting it
 * would be, comes round behind them as they turn (slowly, when a thumb or the
 * pointer steers, so what's pointed at stays put), and rises over whatever
 * would hide them. The ground is the island's own (its rise and fall known
 * exactly); past the wall, the waterfront's decks, the steps up to the
 * sea-wall's balcony and the balcony itself, and the sun-dock's light on the
 * water (their floors given exactly, by places.js); walls and houses stop it, by the hollows' map of where walls
 * stand at a body's height, and it stands still until that map is laid (so a
 * slow screen can't let it walk into a wall before the walls are known). R,
 * or "back to the jetty", takes it back to where it began.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    BoxGeometry,
    Color,
    CylinderGeometry,
    DepthTexture,
    Frustum,
    Group,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    OrthographicCamera,
    Raycaster,
    RingGeometry,
    Scene,
    Sphere,
    SphereGeometry,
    Vector2,
    Vector3,
    WebGLRenderTarget,
} from 'three';
import { HOLLOW_REGION, WALLS_CELL } from './hollows-map.js';
import { SEA_LEVEL, alsoBeforeCompile, groundY, onLand } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** How much smaller than a person's full height the figure is made, to sit in the city (Elm: "smaller"). */
const FIGURE = 0.72;
/** The figure's height, and so how long its shadow lies on flat ground (for finding it under a tap). */
const TALL = 1.87 * FIGURE;
/** Walking: the fastest pace (units a second), how quickly it gets there, and a stride's length. */
const PACE = 2.5;
const GETS_GOING = 7;
const STRIDE = 0.5;
/** How high a step may rise or drop (a kerb, the cafés' platform), and the body's girth against walls. */
const STEP = 0.5;
/** (A shadow's girth: it may come close to a wall, only never through one.) */
const GIRTH = 0.1;
/**
 * Blocked, a step tries turning aside (radians) at a shortened stride: straight first, then either way, at
 * last almost square to the way it was going, so it slides round a spire it walks straight into.
 */
const SLIPS = [[0, 1], [0.45, 0.9], [-0.45, 0.9], [0.95, 0.7], [-0.95, 0.7], [1.35, 0.55], [-1.35, 0.55]];
/** Where the body feels for walls, about its middle: there, and its girth to each side. */
const FEEL = [[0, 0], [GIRTH, 0], [-GIRTH, 0], [0, GIRTH], [0, -GIRTH]];
/** How near the rim of the island (or the land's edge at the wall) the walker may come. */
const EDGE = 0.35;
/** "walk from here": how far about a place to look for somewhere to stand (in rings this far apart). */
const STAND_SEARCH = 8;
const STAND_STEP = 0.3;
/**
 * The camera, walking, stands above and behind where the one casting the shadow would be (Elm's ask): how far
 * back (a little further on a screen held upright, where there's less room across), how steeply it looks down
 * (its angle from straight overhead), where on the figure it looks (as a share of its height), and how quickly
 * it comes round behind the way the walker goes (by the sideways part of its going, so walking straight at the
 * camera never whirls it round).
 */
const FOLLOW = 8;
const FOLLOW_PHI = 0.95;
const LOOK_AT = 0.6;
const CHASE = 1.0;
/** How much of that coming round there is while a thumb or the pointer steers (so a held stick walks straight). */
const CHASE_POINTING = 0.2;
/**
 * When a wall, a gable or a pole-top stands between the camera and the shadow, it rises over it, in so many
 * steps, up to this angle from straight overhead (never so far that it looks straight down: whatever still stands
 * in the way is cut away instead, below). It never dives in closer: under an arch, it keeps the view least hidden
 * until the walker is through.
 */
const RISE_STEPS = 4;
const RISE_TOP = 0.5;
/**
 * Walking, the camera keeps a little open air about its lens in everything (so it never stands inside a box),
 * and when even its highest rise can't see the walker, whatever stands between them is cut away (walkerSees):
 * a tunnel about the line of sight, narrow at the lens and widening toward the walker, stopping this far short
 * of them, so the walls the shadow climbs beside them stay whole. (The ground is never cut.)
 */
const SIGHT_LENS = 1.1;
const SIGHT_NEAR = 0.7;
const SIGHT_FAR = 1.5;
const SIGHT_KEEP = 2.4;
/** Once cut, the way stays open this long after the view comes clear (so it doesn't flicker at an edge). */
const SIGHT_HOLD = 0.6;
/** And with each step up it stands this much further back (a share of its distance), well above the rooftops. */
const RISE_PULL = 0.28;
/** How long a lower view must stay clear before the camera settles back down to it (seconds). */
const SETTLE = 0.9;
/** The open air the camera keeps about itself, walking, so no pole-top or gable ever fills the view. */
const LENS_ROOM = 1.6;
/** How far ahead of the walker the camera looks, in seconds of its going (room to see where it's going). */
const LEAD = 0.45;
/** How near the camera, walking, a pole, a crossbar, a wire or a flag goes undrawn (walkerClears). */
const CLEAR_NEAR = 3;
/** A drag this far (CSS px) starts the thumb's joystick; this far is a full stride. */
const STICK_START = 10;
const STICK_REACH = 58;
/** How near a tap must land to the shadow on the ground to take hold of it (CSS px). */
const TAP_REACH = { mouse: 22, pen: 26, touch: 36 };
/** Walking, how near its feet (a share of TAP_REACH) a tap must land to let go (anywhere else walks it there). */
const FEET_REACH = 0.7;
/** A finger held still this long (ms) walks the shadow toward it; and a press this long isn't a tap. */
const HOLD_AFTER = 250;
/** Walking to a spot: how near is there, how far off a spot may be (world units), and how long without getting nearer gives up (s). */
const ARRIVE = 0.3;
const TARGET_REACH = 30;
const TARGET_STUCK = 0.9;
/** The ring marking the spot it walks to: inner and outer radius. */
const TARGET_INNER = 0.2;
const TARGET_OUTER = 0.27;
/** How long (seconds of trying to walk) it waits for the map of walls before walking without it. */
const WALLS_WAIT = 8;
/** Which way the city lies from the jetty (a heading: 0 faces +z, and this faces west, toward the gate). */
const TOWARD_CITY = -Math.PI / 2;
/** The keys that walk, and which way. */
const WAYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

/** The walker's shadow map: its size in texels, and how much of the light's view it covers (world units). */
const MAP_SIZE = 512;
const MAP_REACH = 1.1;
/**
 * How far behind the walker (along the light) its shadow can fall: as far as a dusk shadow of its height
 * reaches, and no further, so it never lands again behind a wall that has already caught it.
 */
const SHADOW_REACH = 3.3;
/** Where the light's camera stands, back along the light from the walker, and how deep it sees. */
const LIGHT_BACK = 16;
const LIGHT_FAR = LIGHT_BACK + SHADOW_REACH + 2;
/** The ring breathing at its feet, while it waits: inner and outer radius. */
const RING_INNER = 0.34;
const RING_OUTER = 0.44;
/** Waiting to be taken, it beckons every so often (seconds), for so long. */
const BECKON_EVERY = 7.5;
const BECKON_FOR = 2.2;
/**
 * The ring at its feet keeps a size the eye can find from far off (about a reading point's): it grows by this
 * much for every unit the camera stands away. And within this distance, its words show beside it.
 */
const RING_FAR = 0.016;
const LABEL_NEAR = 24;

// =============================================================================
// The walker: a body no one sees
// =============================================================================

/** A limb that swings from its top: a group at the joint, the piece hanging below it. */
function limb(material, width, length, depth) {
    const joint = new Group();
    const piece = new Mesh(new BoxGeometry(width, length, depth), material);
    piece.position.y = -length / 2;
    joint.add(piece);
    return joint;
}

/**
 * A slight figure, jointed at the hips, knees, shoulders and elbows, so its
 * shadow walks as a person's does: drawn at a person's full height, then made
 * the city's size (FIGURE). No one in particular: shoulders hardly broader
 * than the hips, a short jacket flaring a little over them, a round head with
 * a little hair about it, so the shadow is neither a man's nor a woman's.
 * (The jacket stops at the top of the thighs, so the legs stride free beneath
 * it: a longer coat hung between them as a slab, Elm saw.)
 */
function buildBody() {
    const material = new MeshBasicMaterial({ color: 0x000000 });
    const body = new Group();
    const figure = new Group();
    figure.scale.setScalar(FIGURE);
    body.add(figure);
    const torso = new Mesh(new BoxGeometry(0.31, 0.58, 0.19), material);
    torso.position.y = 1.25;
    const coat = new Mesh(new CylinderGeometry(0.165, 0.19, 0.22, 10), material);
    coat.scale.z = 0.78;
    coat.position.y = 0.9;
    const neck = new Mesh(new BoxGeometry(0.09, 0.12, 0.09), material);
    neck.position.y = 1.59;
    const head = new Mesh(new SphereGeometry(0.125, 12, 8), material);
    head.position.y = 1.73;
    const hair = new Mesh(new SphereGeometry(0.138, 12, 8), material);
    hair.scale.set(1.05, 0.9, 1);
    hair.position.set(0, 1.755, -0.02);
    figure.add(torso, coat, neck, head, hair);

    const legs = [-1, 1].map((side) => {
        const hip = limb(material, 0.12, 0.45, 0.13);
        hip.position.set(side * 0.085, 0.93, 0);
        const knee = limb(material, 0.105, 0.44, 0.115);
        knee.position.y = -0.45;
        const foot = new Mesh(new BoxGeometry(0.1, 0.05, 0.22), material);
        foot.position.set(0, -0.44, 0.04);
        knee.add(foot);
        hip.add(knee);
        figure.add(hip);
        return { hip, knee };
    });
    const arms = [-1, 1].map((side) => {
        const shoulder = limb(material, 0.075, 0.29, 0.075);
        shoulder.position.set(side * 0.19, 1.5, 0);
        shoulder.rotation.z = side * 0.06;
        const elbow = limb(material, 0.07, 0.29, 0.07);
        elbow.position.y = -0.29;
        shoulder.add(elbow);
        figure.add(shoulder);
        return { shoulder, elbow };
    });
    return { body, legs, arms };
}

// =============================================================================
// Where the walker may stand
// =============================================================================

/**
 * The waterfront's decks (the cafés' platform, the jetty, the sun-dock), seen
 * from above: the top of every low, upward face past the land, cell by cell.
 * Returns floor(x, z): a deck's height there, or null where there's only water.
 */
function waterfrontDecks(meshes) {
    const region = { x0: 4, x1: 25, z0: -34, z1: 34 };
    const cell = 0.2;
    const width = Math.round((region.x1 - region.x0) / cell);
    const depth = Math.round((region.z1 - region.z0) / cell);
    const tops = new Float32Array(width * depth).fill(Number.NaN);
    for (const key of ['dimGold', 'gold']) {
        const mesh = meshes.get(key);
        if (!mesh) continue;
        const position = mesh.geometry.attributes.position.array;
        const normal = mesh.geometry.attributes.normal.array;
        for (const [first, count] of mesh.userData.solidRanges ?? []) {
            for (let vertex = first; vertex + 2 < first + count; vertex += 3) {
                const i = vertex * 3;
                if ((normal[i + 1] + normal[i + 4] + normal[i + 7]) / 3 < 0.8) continue;
                const ay = position[i + 1];
                const by = position[i + 4];
                const cy = position[i + 7];
                const top = Math.max(ay, by, cy);
                if (top < SEA_LEVEL || top > 0.7) continue;
                const ax = position[i];
                const az = position[i + 2];
                const bx = position[i + 3];
                const bz = position[i + 5];
                const cx = position[i + 6];
                const cz = position[i + 8];
                const colFrom = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - region.x0) / cell - 0.5));
                const colTo = Math.min(width - 1, Math.floor((Math.max(ax, bx, cx) - region.x0) / cell - 0.5));
                const rowFrom = Math.max(0, Math.ceil((Math.min(az, bz, cz) - region.z0) / cell - 0.5));
                const rowTo = Math.min(depth - 1, Math.floor((Math.max(az, bz, cz) - region.z0) / cell - 0.5));
                const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
                if (colFrom > colTo || rowFrom > rowTo || Math.abs(det) < 1e-12) continue;
                for (let row = rowFrom; row <= rowTo; row += 1) {
                    const dz = region.z0 + (row + 0.5) * cell - cz;
                    for (let col = colFrom; col <= colTo; col += 1) {
                        const dx = region.x0 + (col + 0.5) * cell - cx;
                        const wa = ((bz - cz) * dx + (cx - bx) * dz) / det;
                        const wb = ((cz - az) * dx + (ax - cx) * dz) / det;
                        if (wa < 0 || wb < 0 || wa + wb > 1) continue;
                        const at = row * width + col;
                        const height = wa * ay + wb * by + (1 - wa - wb) * cy;
                        if (!(tops[at] >= height)) tops[at] = height;
                    }
                }
            }
        }
    }
    return (x, z) => {
        const col = Math.floor((x - region.x0) / cell);
        const row = Math.floor((z - region.z0) / cell);
        if (col < 0 || row < 0 || col >= width || row >= depth) return null;
        const top = tops[row * width + col];
        return Number.isNaN(top) ? null : top;
    };
}

function shortest(angle) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

/** The camera's angle round the walker (as the rig counts it) that puts it behind one facing `heading`. */
function behindOf(heading) {
    return Math.atan2(-Math.sin(heading), -Math.cos(heading));
}

function ignoresKeys(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return true;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return true;
    return Boolean(document.querySelector('dialog[open]'));
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {Vector3} options.light - the way to the key light (world), which casts the shadow
 * @param {boolean} options.reducedMotion
 */
export function createWalk({ light, reducedMotion }) {
    const toLight = light.clone().normalize();
    const lightTheta = Math.atan2(toLight.x, toLight.z);
    const shadowWay = new Vector3(-toLight.x, 0, -toLight.z).normalize();
    const shadowLength = TALL / Math.tan(Math.asin(toLight.y));
    const { body, legs, arms } = buildBody();
    const scene = new Scene();
    scene.add(body);

    const target = new WebGLRenderTarget(MAP_SIZE, MAP_SIZE, {
        depthTexture: new DepthTexture(MAP_SIZE, MAP_SIZE),
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        generateMipmaps: false,
    });
    const eye = new OrthographicCamera(-MAP_REACH, MAP_REACH, MAP_REACH, -MAP_REACH, 0.5, LIGHT_FAR);
    const centre = new Vector3();

    const uniforms = {
        walkerDepth: { value: target.depthTexture },
        walkerMatrix: { value: new Matrix4() },
        walkerOn: { value: 0 },
        walkerTexel: { value: new Vector2(1 / MAP_SIZE, 1 / MAP_SIZE) },
        walkerReach: { value: SHADOW_REACH / (LIGHT_FAR - 0.5) },
        // How near the camera the thin things aren't drawn (walkerClears): only while walking.
        walkClear: { value: 0 },
        // The one casting the shadow, and whether what stands between them and the camera is cut away (walkerSees).
        walkSight: { value: new Vector3() },
        walkSightOn: { value: 0 },
    };

    const state = {
        position: new Vector3(),
        heading: Math.PI / 2,
        stride: 0,
        moving: 0,
        present: false,
        walking: false,
    };

    // Set by attach(), once the stage is built.
    let rig = null;
    let camera = null;
    let canvas = null;
    let solids = null;
    let hollowMap = null;
    let decks = null;
    let wallShadow = null;
    let button = null;
    let status = null;
    let followTheta = lightTheta;
    let rise = 0;
    let settling = 0;
    /** How much longer the way to the walker stays cut open (seconds; see SIGHT_HOLD). */
    let sightHeld = 0;
    // Waiting at the jetty's end, it faces the sea; taken there, it turns to face the city (the heading it turns to).
    let turnsToCity = false;
    let turning = null;
    /** The end of the jetty, where the shadow first waits (and where R takes it back to). */
    let pier = null;
    /**
     * Floors given exactly (places.js): the steps up to the sea-wall's balcony and the balcony, and the sun-dock's
     * light. Each floorAt(x, z): a height, or null.
     */
    let floors = [];
    /** "back to the jetty", shown while walking. */
    let backButton = null;
    /** The golden bridges' sight line (places.js): the walker's middle, and 1 while walking (their gold turns to dust there). */
    let bridgeSight = null;
    /** A pointer pressed on the city while walking: { id, type, startX, startY, x, y, time, aimed }. */
    let press = null;
    /** The spot it walks to (a tap, or a pointer held down): { x, y, z, held, best, since }, or null. */
    let destination = null;
    let targetRing = null;
    /** How it's being steered this moment: 'keys', 'pointing' (a thumb, the pointer, a spot), or null. */
    let steeredBy = null;
    /** Seconds spent trying to walk before the map of walls was laid. */
    let wallsWaited = 0;
    const rises = new Array(RISE_STEPS + 1).fill(0);
    const sightAt = new Array(RISE_STEPS + 1).fill(0);
    const clearAt = new Array(RISE_STEPS + 1).fill(true);
    const lead = new Vector3();
    const ahead = new Vector3();
    const sightFrom = new Vector3();
    const sight = new Sphere();
    const view = new Frustum();
    const seen = new Matrix4();
    const inverse = new Matrix4();
    let claimed = null;
    let rivals = null;
    let ring = null;
    let label = null;
    let hovering = false;
    const keys = new Set();
    const stick = { id: null, startX: 0, startY: 0, x: 0, y: 0, active: false, view: null, knob: null };
    const velocity = new Vector3();
    const wanted = new Vector3();
    const forward = new Vector3();
    const right = new Vector3();
    const next = new Vector3();
    const out = new Vector3();
    const probe = new Vector3();
    const side = new Vector3();
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const feet = new Vector3();
    const tip = new Vector3();
    const aim = new Vector3();

    /** Pose the body for this moment: the stride's phase and how much it's walking (0 to 1). */
    function pose(elapsed) {
        const swing = Math.sin(state.stride) * state.moving;
        legs.forEach(({ hip, knee }, index) => {
            hip.rotation.x = (index === 0 ? 1 : -1) * swing * 0.5;
            knee.rotation.x = Math.max(0, Math.sin(state.stride + (index === 0 ? 0 : Math.PI) + Math.PI / 2)) * 0.7 * state.moving;
        });
        arms.forEach(({ shoulder, elbow }, index) => {
            shoulder.rotation.x = (index === 0 ? -1 : 1) * swing * 0.42;
            shoulder.rotation.z = (index === 0 ? -1 : 1) * 0.06;
            elbow.rotation.x = -0.25 * state.moving - 0.08;
        });
        // Waiting to be taken, now and then it lifts its right arm and beckons: a shadow that waves.
        if (!state.walking && !reducedMotion) {
            const t = elapsed % BECKON_EVERY;
            const beckon = t < BECKON_FOR ? Math.sin((Math.PI * t) / BECKON_FOR) ** 2 : 0;
            if (beckon > 0) {
                const { shoulder, elbow } = arms[0];
                shoulder.rotation.x = -2.5 * beckon;
                shoulder.rotation.z = -0.06 - 0.35 * beckon;
                elbow.rotation.x = -(0.35 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 8))) * beckon;
            }
        }
        // Standing, it shifts its weight now and then, as the shadow on the wall does; walking, it bobs.
        const sway = reducedMotion ? 0 : (Math.sin(elapsed * 0.45) * 0.018 + Math.sin(elapsed * 0.17 + 1.3) * 0.01) * (1 - state.moving);
        body.rotation.set(0, state.heading, sway);
        body.position.copy(state.position);
        if (!reducedMotion) body.position.y += Math.abs(Math.sin(state.stride)) * 0.035 * FIGURE * state.moving;
    }

    /** The floor given exactly at (x, z) (the steps, the balcony, the sun-dock's light), or null. */
    function givenFloor(x, z) {
        for (const floor of floors) {
            const height = floor.floorAt(x, z);
            if (height !== null) return height;
        }
        return null;
    }

    /**
     * The floor under (x, z): the island's ground, off its edges; past the wall, a deck; or one given exactly
     * (up the steps to the sea-wall's balcony, the balcony, the sun-dock's light). Where there are two (beside
     * the steps, where the lowest step or the sun-dock meets the platform), the one nearest `near` (the height
     * the walker stands at), else the other.
     */
    function floorAt(x, z, near) {
        const low = onLand(x, z, EDGE) ? groundY(x, z) : decks ? decks(x, z) : null;
        const given = givenFloor(x, z);
        if (given === null) return low;
        if (low === null) return given;
        if (near === undefined) return low;
        return Math.abs(given - near) < Math.abs(low - near) ? given : low;
    }

    /**
     * Whether (x, z) at height y is on a floor given exactly: that floor is its own bound (the wall's face its
     * only edge), so the map of walls at a body's height above the ground (the balcony's cone stands in it,
     * beneath the balcony) doesn't hold it there.
     */
    function aloft(x, z, y) {
        return floors.length > 0 && givenFloor(x, z) === y;
    }

    /** The floor a body could stand on at (x, z) (floor there, no wall within its girth), or null. */
    function standOn(x, z, near) {
        const floor = floorAt(x, z, near);
        if (floor === null) return null;
        if (aloft(x, z, floor)) return floor;
        return blocked(x, z) ? null : floor;
    }

    /**
     * Whether a wall stands within the walker's girth of (x, z): read from the
     * hollows' map of walls at a body's height (hollows-map.js), cell by cell,
     * at the body's middle and at its girth to each side. (Until the map is
     * laid, which is long before anyone walks, nothing stops it.)
     */
    function blocked(x, z) {
        const walls = hollowMap?.walls;
        if (!walls) return false;
        const across = hollowMap.wallsAcross;
        for (const [dx, dz] of FEEL) {
            const col = Math.floor((x + dx - HOLLOW_REGION.x0) / WALLS_CELL);
            const row = Math.floor((z + dz - HOLLOW_REGION.z0) / WALLS_CELL);
            if (col < 0 || row < 0 || col >= across || row * across + col >= walls.length) continue;
            if (walls[row * across + col]) return true;
        }
        return false;
    }

    /** The nearest place about (x, z) a body can stand (floor there, no wall within its girth), or null. */
    function standingNear(x, z) {
        for (let radius = 0; radius <= STAND_SEARCH; radius += STAND_STEP) {
            const around = radius === 0 ? 1 : Math.max(8, Math.round((radius * Math.PI * 2) / STAND_STEP));
            for (let k = 0; k < around; k += 1) {
                const angle = (k / around) * Math.PI * 2;
                const px = x + Math.cos(angle) * radius;
                const pz = z + Math.sin(angle) * radius;
                const floor = standOn(px, pz);
                if (floor === null) continue;
                return { x: px, z: pz, y: floor };
            }
        }
        return null;
    }

    /** Whether the walls map marks the cell at (x, z) itself as a wall. */
    function wallCell(x, z) {
        const walls = hollowMap?.walls;
        if (!walls) return false;
        const col = Math.floor((x - HOLLOW_REGION.x0) / WALLS_CELL);
        const row = Math.floor((z - HOLLOW_REGION.z0) / WALLS_CELL);
        if (col < 0 || row < 0 || col >= hollowMap.wallsAcross) return false;
        return walls[row * hollowMap.wallsAcross + col] === 1;
    }

    /** Which way is out, from the walls about (x, z): a unit step away from them on the ground, or null. */
    function wallNormal(x, z) {
        let sx = 0;
        let sz = 0;
        for (const radius of [GIRTH + 0.12, GIRTH + 0.26]) {
            for (let k = 0; k < 16; k += 1) {
                const angle = (k / 16) * Math.PI * 2;
                if (!wallCell(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)) continue;
                sx -= Math.cos(angle);
                sz -= Math.sin(angle);
            }
            if (sx || sz) break;
        }
        const length = Math.hypot(sx, sz);
        return length > 1e-6 ? out.set(sx / length, 0, sz / length) : null;
    }

    /**
     * Blocked every way it turned, slide along whatever's in the way: the part of the step that goes into the
     * wall taken out (head on, a step along the wall on the side it leant to), and a hair's push out from it.
     */
    function slideAlong(dx, dz) {
        const normal = wallNormal(state.position.x, state.position.z);
        if (!normal) return false;
        const length = Math.hypot(dx, dz);
        const into = Math.min(0, dx * normal.x + dz * normal.z);
        let tx = dx - into * normal.x;
        let tz = dz - into * normal.z;
        if (Math.hypot(tx, tz) < 0.35 * length) {
            const lean = dx * -normal.z + dz * normal.x >= 0 ? 1 : -1;
            tx = -normal.z * lean * 0.6 * length;
            tz = normal.x * lean * 0.6 * length;
        }
        return tryStep(tx + normal.x * 0.015, tz + normal.z * 0.015) || tryStep(tx * 0.5 + normal.x * 0.03, tz * 0.5 + normal.z * 0.03);
    }

    /**
     * Try a step from the walker's place by (dx, dz): true, with `next` set, if
     * there's floor within a step's height and no wall there. (Standing in a
     * wall already, as it might where it was first set down, any step is
     * allowed, so nothing ever holds the walker fast.)
     */
    function tryStep(dx, dz) {
        next.set(state.position.x + dx, state.position.y, state.position.z + dz);
        const floor = floorAt(next.x, next.z, state.position.y);
        if (floor === null || Math.abs(floor - state.position.y) > STEP) return false;
        next.y = floor;
        if (aloft(next.x, next.z, floor)) return true;
        return !blocked(next.x, next.z) || blocked(state.position.x, state.position.z);
    }

    /**
     * Which way the visitor is steering (at most PACE): toward a spot, or by stick or keys in the camera's
     * terms (the way it's coming round to look, so what's "ahead" doesn't swing as it comes).
     */
    function steering() {
        // (The local checks can steer by the compass instead: { x, z }, at most 1.)
        if (walk.compass) {
            steeredBy = 'keys';
            return wanted.set(walk.compass.x, 0, walk.compass.z).multiplyScalar(PACE);
        }
        if (destination && (stick.active || keys.size)) clearTarget();
        if (destination) {
            steeredBy = 'pointing';
            const dx = destination.x - state.position.x;
            const dz = destination.z - state.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < ARRIVE) {
                if (!destination.held) clearTarget();
                return wanted.set(0, 0, 0);
            }
            const pace = PACE * Math.min(1, distance / 0.9);
            return wanted.set((dx / distance) * pace, 0, (dz / distance) * pace);
        }
        let across = 0;
        let ahead = 0;
        if (stick.active) {
            steeredBy = 'pointing';
            across = stick.x;
            ahead = stick.y;
        } else {
            steeredBy = keys.size ? 'keys' : null;
            across = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
            ahead = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
            const length = Math.hypot(across, ahead);
            if (length > 1) {
                across /= length;
                ahead /= length;
            }
        }
        forward.set(-Math.sin(followTheta), 0, -Math.cos(followTheta));
        right.set(-forward.z, 0, forward.x);
        return wanted.set(0, 0, 0).addScaledVector(right, across).addScaledVector(forward, ahead).multiplyScalar(PACE);
    }

    /** Where the pointer at (x, y) points on the level the walker stands at (no further off than TARGET_REACH). */
    function groundUnder(x, y) {
        if (!camera || !canvas) return null;
        const rect = canvas.getBoundingClientRect();
        pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const { origin, direction } = raycaster.ray;
        const level = state.position.y;
        const flat = Math.hypot(direction.x, direction.z);
        let along = direction.y < -1e-4 ? (level - origin.y) / direction.y : Infinity;
        // Looking level or above it, or meeting it far off: as far as a walk may be sent, the way it points.
        if (!(along > 0) || flat * along > TARGET_REACH * 2) {
            if (flat < 1e-6) return null;
            along = (TARGET_REACH * 2) / flat;
        }
        const spot = aim.set(origin.x + direction.x * along, level, origin.z + direction.z * along);
        const away = Math.hypot(spot.x - state.position.x, spot.z - state.position.z);
        if (away > TARGET_REACH) {
            spot.x = state.position.x + ((spot.x - state.position.x) / away) * TARGET_REACH;
            spot.z = state.position.z + ((spot.z - state.position.z) / away) * TARGET_REACH;
        }
        return spot;
    }

    /** Walk to the spot under (x, y): held (while a pointer stays down) or once (a tap). */
    function aimAt(x, y, held) {
        const spot = groundUnder(x, y);
        if (!spot) return false;
        const floor = floorAt(spot.x, spot.z, state.position.y);
        const distance = Math.hypot(spot.x - state.position.x, spot.z - state.position.z);
        destination = { x: spot.x, y: floor ?? spot.y, z: spot.z, held, best: distance, since: 0 };
        return true;
    }

    function clearTarget() {
        destination = null;
    }

    function stepWalker(dt) {
        velocity.lerp(steering(), 1 - Math.exp(-GETS_GOING * dt));
        const speed = velocity.length();
        let moved = 0;
        if (speed > 0.02) {
            const dx = velocity.x * dt;
            const dz = velocity.z * dt;
            // Straight on if there's room; else slipping a little to one side or the other (round a pole or a
            // corner), a little shorter; else sliding along whatever's in the way; else not at all.
            const slips = SLIPS.some(([turn, reach]) => {
                const cos = Math.cos(turn) * reach;
                const sin = Math.sin(turn) * reach;
                return tryStep(dx * cos - dz * sin, dx * sin + dz * cos);
            });
            if (slips || slideAlong(dx, dz) || (Math.abs(dx) > 1e-6 && tryStep(dx, 0)) || (Math.abs(dz) > 1e-6 && tryStep(0, dz))) {
                moved = Math.hypot(next.x - state.position.x, next.z - state.position.z);
                state.position.copy(next);
            } else {
                velocity.multiplyScalar(0.5);
            }
            const facing = Math.atan2(velocity.x, velocity.z);
            state.heading += shortest(facing - state.heading) * (1 - Math.exp(-10 * dt));
        }
        state.stride += (moved / STRIDE) * Math.PI;
        const pace = Math.min(1, moved / Math.max(dt, 1e-3) / (PACE * 0.55));
        state.moving += (pace - state.moving) * (1 - Math.exp(-8 * dt));
        // Walking to a spot, and getting no nearer for a while (a wall between): it stops there.
        if (destination && !destination.held) {
            const distance = Math.hypot(destination.x - state.position.x, destination.z - state.position.z);
            if (distance < destination.best - 0.05) {
                destination.best = distance;
                destination.since = 0;
            } else if ((destination.since += dt) > TARGET_STUCK) {
                clearTarget();
            }
        }
    }

    /**
     * How far the camera can stand back from the target, toward (theta, phi), up to `reach`, before something
     * solid stands in the way: the line of sight is felt along, in the solids field's own strides. (Leaves
     * `side` pointing that way.)
     */
    function sightLine(from, theta, phi, reach) {
        const sinPhi = Math.sin(phi);
        side.set(sinPhi * Math.sin(theta), Math.cos(phi), sinPhi * Math.cos(theta));
        if (!solids?.available) return reach;
        let along = 0.6;
        for (let stride = 0; stride < 48 && along < reach; stride += 1) {
            const gap = solids.distance(probe.copy(from).addScaledVector(side, along));
            if (gap < 0.25) return along - 0.6;
            along += Math.max(gap * 0.9, 0.2);
        }
        return reach;
    }

    /** Whether the camera, `reach` back along the way the last sightLine() felt, would have room about it. */
    function roomAt(from, reach) {
        return !solids?.available || solids.distance(probe.copy(from).addScaledVector(side, reach)) >= LENS_ROOM;
    }

    /**
     * The camera stands above and behind where the one casting the shadow would be, looking at them (and a
     * little ahead of where they go), and comes round behind them as they turn, so a street is looked along
     * rather than across. If something stands between it and the walker, it rises over it at once, and settles
     * back down only once the lower view has stayed clear a while.
     */
    function follow(dt) {
        const aspect = camera.aspect || 1;
        if (!reducedMotion && state.moving > 0.2) {
            const chase = steeredBy === 'pointing' ? CHASE_POINTING : CHASE;
            followTheta += Math.sin(shortest(behindOf(state.heading) - followTheta)) * chase * state.moving * dt;
        }
        lead.lerp(ahead.copy(velocity).multiplyScalar(reducedMotion ? 0 : LEAD), 1 - Math.exp(-2.5 * dt));
        const target = rig.goal.target.copy(state.position).add(lead);
        target.y += TALL * LOOK_AT;
        uniforms.walkSight.value.copy(state.position);
        uniforms.walkSight.value.y += TALL * 0.5;
        // (No golden bridge stands between the camera and the walker: there, its gold comes apart into dust.)
        bridgeSight?.set(state.position.x, state.position.y + TALL * 0.5, state.position.z, 1);
        // (Close against a wall, the one casting it may be all but in it: the sight is felt for from out of it.)
        sightFrom.copy(target);
        if (solids?.available) solids.push(sightFrom, 0.3);
        const theta = rig.now.theta + shortest(followTheta - rig.now.theta);
        const reach = FOLLOW * Math.max(1, (0.9 / aspect) ** 0.3);

        let lowest = -1;
        let leastHidden = 0;
        for (let index = 0; index <= RISE_STEPS; index += 1) {
            rises[index] = FOLLOW_PHI - ((FOLLOW_PHI - RISE_TOP) * index) / RISE_STEPS;
            const back = reach * (1 + RISE_PULL * index);
            sightAt[index] = sightLine(sightFrom, theta, rises[index], back) / back;
            clearAt[index] = sightAt[index] >= 1 && roomAt(sightFrom, back);
            if (lowest < 0 && clearAt[index]) lowest = index;
            if (sightAt[index] > sightAt[leastHidden] + 0.05) leastHidden = index;
        }
        if (lowest < 0) {
            // Nothing is clear (passing under the gate's arch, say): the view least hidden, for the moment.
            rise = leastHidden;
            settling = 0;
        } else if (lowest > rise || !clearAt[rise]) {
            rise = lowest;
            settling = 0;
        } else if (lowest < rise) {
            settling += dt;
            if (settling >= SETTLE) {
                rise = lowest;
                settling = 0;
            }
        } else {
            settling = 0;
        }
        rig.goal.phi = rises[rise];
        rig.goal.theta = theta;
        rig.goal.radius = reach * (1 + RISE_PULL * rise);
        // Still hidden at the view chosen: cut the way open (and keep it open a moment once it clears).
        sightHeld = sightAt[rise] < 1 ? SIGHT_HOLD : Math.max(0, sightHeld - dt);
        uniforms.walkSightOn.value = sightHeld > 0 ? 2 : 1;
        rig.atHome = false;
        rig.gliding = false;
    }

    /** How far (x, y) is on screen from the shadow (CSS px): flat ground, from the feet out along the shadow. */
    function shadowDistance(x, y) {
        if (!state.present || !camera) return Infinity;
        const rect = canvas.getBoundingClientRect();
        const toScreen = (point) => {
            const projected = point.clone().project(camera);
            return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height, front: projected.z < 1 };
        };
        feet.copy(state.position);
        tip.copy(state.position).addScaledVector(shadowWay, shadowLength);
        const a = toScreen(feet);
        const b = toScreen(tip);
        if (!a.front && !b.front) return Infinity;
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const t = MathUtils.clamp(((x - a.x) * abx + (y - a.y) * aby) / Math.max(abx * abx + aby * aby, 1e-6), 0, 1);
        return Math.hypot(a.x + abx * t - x, a.y + aby * t - y);
    }

    /**
     * How near a tap (or the pointer) at (x, y) is to something that takes or lets go of the shadow (CSS px).
     * Waiting to be taken: the shadow on the ground, within a finger's reach, the ring at its feet (as large as
     * it's drawn, and a little more), or the shadow on the café wall. Walking: only its feet (a tap anywhere
     * else along its shadow walks it there). Infinity if it's on none of them.
     */
    function tapDistance(x, y, pointerType) {
        const reach = TAP_REACH[pointerType] ?? TAP_REACH.touch;
        if (state.walking) {
            if (!camera) return Infinity;
            const feetAt = feetOnScreen();
            const away = Math.hypot(x - feetAt.x, y - feetAt.y);
            return feetAt.front && away < reach * FEET_REACH ? away : Infinity;
        }
        let best = Infinity;
        const along = shadowDistance(x, y);
        if (along < reach) best = along;
        if (ring?.visible && camera) {
            const on = ringOnScreen();
            const fromCentre = Math.hypot(x - on.x, y - on.y);
            if (on.front && fromCentre < on.radius + 10) best = Math.min(best, Math.max(0, fromCentre - on.radius * 0.5));
        }
        if (onWallShadow(x, y)) best = 0;
        return best;
    }

    /** Where its feet are on screen (CSS px), and whether they're in front of the camera. */
    function feetOnScreen() {
        const rect = canvas.getBoundingClientRect();
        const at = feet.copy(state.position).project(camera);
        return { x: rect.left + ((at.x + 1) / 2) * rect.width, y: rect.top + ((1 - at.y) / 2) * rect.height, front: at.z < 1 };
    }

    /** Where the ring at its feet is on screen (CSS px): its centre, how wide it's drawn, and whether it's in front. */
    function ringOnScreen() {
        const rect = canvas.getBoundingClientRect();
        const centre = feet.copy(state.position).project(camera);
        side.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(RING_OUTER * (ring?.scale.x ?? 1));
        const edge = tip.copy(state.position).add(side).project(camera);
        return {
            x: rect.left + ((centre.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - centre.y) / 2) * rect.height,
            radius: Math.hypot(((edge.x - centre.x) / 2) * rect.width, ((edge.y - centre.y) / 2) * rect.height),
            front: centre.z < 1 && Math.abs(centre.x) < 0.95 && Math.abs(centre.y) < 0.95,
        };
    }

    /** Whether a tap lands on the shadow on the café wall (while it's still there to be taken). */
    function onWallShadow(x, y) {
        if (!wallShadow || state.present || !wallShadow.visible) return false;
        const rect = canvas.getBoundingClientRect();
        pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObject(wallShadow, false).length > 0;
    }

    function announce(text) {
        if (status) status.textContent = text;
    }

    function showStick() {
        if (!stick.view) return;
        stick.view.hidden = !stick.active;
        if (!stick.active) return;
        stick.view.style.translate = `${Math.round(stick.startX)}px ${Math.round(stick.startY)}px`;
        stick.knob.style.translate = `${Math.round(stick.x * STICK_REACH)}px ${Math.round(-stick.y * STICK_REACH)}px`;
    }

    function releaseStick() {
        stick.id = null;
        stick.active = false;
        stick.x = 0;
        stick.y = 0;
        showStick();
    }

    const walk = {
        uniforms,
        state,
        /** The floor under (x, z), or null (for the local checks). */
        floorAt: (x, z) => floorAt(x, z),
        /** The floor given exactly at (x, z) (the steps, the balcony, the sun-dock's light), or null (for the local checks). */
        lookoutAt: (x, z) => givenFloor(x, z),
        /** Whether a wall stops a body at (x, z) (for the local checks). */
        blockedAt: (x, z) => blocked(x, z),
        /** Whether the walls map marks the cell at (x, z) itself (for the local checks). */
        wallCellAt: (x, z) => {
            const walls = hollowMap?.walls;
            if (!walls) return null;
            const col = Math.floor((x - HOLLOW_REGION.x0) / WALLS_CELL);
            const row = Math.floor((z - HOLLOW_REGION.z0) / WALLS_CELL);
            return walls[row * hollowMap.wallsAcross + col] === 1;
        },
        /** For the local checks: steer by the compass ({ x, z }) rather than by keys or stick; null to stop. */
        compass: null,

        /** Stand the walker at (x, z), facing heading (radians, 0 = +z), on the floor there. */
        place(x, z, heading = state.heading, y = floorAt(x, z) ?? groundY(x, z)) {
            state.position.set(x, y, z);
            state.heading = heading;
            state.present = true;
            uniforms.walkerOn.value = 1;
        },

        /**
         * Wire walking to the built stage.
         * @param {object} parts
         * @param {import('./rigs/orbit.js').OrbitRig} parts.rig
         * @param {import('three').Camera} parts.camera
         * @param {HTMLCanvasElement} parts.canvas
         * @param {object} parts.solids - from solids.js
         * @param {Map<string, import('three').Mesh>} parts.meshes - the city's merged meshes
         * @param {import('three').Object3D | undefined} parts.wallShadow - the shadow on the café wall, if it's there
         * @param {HTMLElement | null} parts.controls - where the walk button goes
         */
        attach(parts) {
            ({ rig, camera, canvas, solids, hollowMap, wallShadow } = parts);
            decks = waterfrontDecks(parts.meshes);
            floors = parts.floors ?? [];
            bridgeSight = parts.bridgeSight ?? null;

            // The shadow waits at the end of the jetty, looking out to sea (in place of the one on the café
            // wall), a ring breathing on the boards at its feet to say it can be taken.
            if (parts.pierEnd) {
                walk.place(parts.pierEnd.x, parts.pierEnd.z, Math.PI / 2, parts.pierEnd.y);
                if (wallShadow) wallShadow.visible = false;
                turnsToCity = true;
                pier = parts.pierEnd.clone();
            }
            if (parts.scene) {
                ring = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 40), new MeshBasicMaterial({
                    color: new Color(0xffc878).multiplyScalar(1.5),
                    transparent: true,
                    opacity: 0.5,
                    blending: AdditiveBlending,
                    depthWrite: false,
                    fog: false,
                }));
                ring.name = 'walk-ring';
                ring.rotation.x = -Math.PI / 2;
                ring.visible = false;
                parts.scene.add(ring);
                // A smaller ring marks the spot a tap (or a pointer held down) walks it to.
                targetRing = new Mesh(new RingGeometry(TARGET_INNER, TARGET_OUTER, 32), ring.material.clone());
                targetRing.name = 'walk-target';
                targetRing.rotation.x = -Math.PI / 2;
                targetRing.visible = false;
                parts.scene.add(targetRing);
            }
            label = document.createElement('p');
            label.className = 'point-label walk-label';
            label.hidden = true;
            label.setAttribute('aria-hidden', 'true');
            label.textContent = 'walk as the shadow';
            document.body.append(label);
            canvas.addEventListener('pointermove', (event) => {
                if (event.pointerType !== 'mouse' || event.buttons) return;
                const over = !state.walking && state.present && Number.isFinite(tapDistance(event.clientX, event.clientY, 'mouse'));
                if (over === hovering) return;
                hovering = over;
                canvas.style.cursor = over ? 'pointer' : '';
            });
            canvas.addEventListener('pointerleave', () => {
                hovering = false;
            });

            // The visible way in (and out), for keyboards and for anyone who'd rather not hunt for a shadow.
            if (parts.controls) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'control';
                button.setAttribute('aria-pressed', 'false');
                button.textContent = 'walk as the shadow';
                button.addEventListener('click', () => (state.walking ? walk.letGo() : walk.take()));
                parts.controls.prepend(button);
                // While walking, a way out of any corner: back to where it began.
                if (pier) {
                    backButton = document.createElement('button');
                    backButton.type = 'button';
                    backButton.className = 'control';
                    backButton.hidden = true;
                    backButton.textContent = 'back to the jetty';
                    backButton.addEventListener('click', () => walk.backToPier());
                    button.after(backButton);
                }
            }
            status = document.createElement('p');
            status.className = 'visually-hidden';
            status.setAttribute('role', 'status');
            document.body.append(status);

            stick.view = document.createElement('div');
            stick.view.className = 'walk-stick';
            stick.view.hidden = true;
            stick.view.setAttribute('aria-hidden', 'true');
            stick.knob = document.createElement('span');
            stick.knob.className = 'walk-stick-knob';
            stick.view.append(stick.knob);
            document.body.append(stick.view);

            // Walking, a pointer pressed on the city steers: the mouse at once, toward wherever it points while
            // it's held down; a finger held still, toward the place under it; a finger dragged, the joystick.
            canvas.addEventListener('pointerdown', (event) => {
                if (!state.walking || press) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                press = {
                    id: event.pointerId,
                    type: event.pointerType,
                    startX: event.clientX,
                    startY: event.clientY,
                    x: event.clientX,
                    y: event.clientY,
                    // (Timed by the page's own clock: an event's timeStamp isn't always on it.)
                    time: performance.now(),
                    aimed: false,
                };
                if (event.pointerType === 'mouse') press.aimed = aimAt(event.clientX, event.clientY, true);
            });
            canvas.addEventListener('pointermove', (event) => {
                if (!press || event.pointerId !== press.id) return;
                press.x = event.clientX;
                press.y = event.clientY;
                if (press.type === 'mouse') {
                    if (destination?.held || !destination) press.aimed = aimAt(event.clientX, event.clientY, true);
                    return;
                }
                const dx = event.clientX - press.startX;
                const dy = event.clientY - press.startY;
                const distance = Math.hypot(dx, dy);
                if (!stick.active && distance < STICK_START) return;
                if (!stick.active) {
                    stick.id = press.id;
                    stick.startX = press.startX;
                    stick.startY = press.startY;
                    stick.active = true;
                    clearTarget();
                }
                const reach = Math.min(distance, STICK_REACH) / STICK_REACH;
                stick.x = (dx / Math.max(distance, 1e-6)) * reach;
                stick.y = -(dy / Math.max(distance, 1e-6)) * reach;
                showStick();
            });
            for (const type of ['pointerup', 'pointercancel']) {
                canvas.addEventListener(type, (event) => {
                    if (!press || event.pointerId !== press.id) return;
                    press = null;
                    if (stick.active) releaseStick();
                    // Let go of a held pointer, and it stops (a tap's spot, set as this tap was heard, it walks on to).
                    if (destination?.held) clearTarget();
                });
            }
            window.addEventListener('keydown', (event) => {
                if (!state.walking || ignoresKeys(event)) return;
                if (event.key === 'Escape') {
                    walk.letGo();
                    event.preventDefault();
                    return;
                }
                // R (or Home): back to the end of the jetty, wherever the shadow has got to.
                if (event.code === 'KeyR' || event.key === 'Home') {
                    walk.backToPier();
                    event.preventDefault();
                    return;
                }
                const way = WAYS[event.code];
                if (!way) return;
                keys.add(way);
                event.preventDefault();
            });
            window.addEventListener('keyup', (event) => {
                const way = WAYS[event.code];
                if (way) keys.delete(way);
            });
            window.addEventListener('blur', () => keys.clear());

            rig.onTap((x, y, pointerType) => {
                claimed = null;
                // A press held long enough to steer (or dragged into the joystick) was steering, not a tap.
                if (state.walking && press && (stick.active || performance.now() - press.time >= HOLD_AFTER)) {
                    claimed = { x, y };
                    return;
                }
                const mine = tapDistance(x, y, pointerType);
                if (!Number.isFinite(mine)) return;
                // A reading point nearer the tap than the shadow keeps it: the words come first.
                if ((rivals?.(x, y, pointerType) ?? Infinity) < mine) return;
                claimed = { x, y };
                if (state.walking) walk.letGo();
                else walk.take();
            });
        },

        /**
         * Let the words have a tap that lands nearer them than the shadow: `nearest(x, y, pointerType)` gives
         * how far (CSS px) the nearest rival for it is (a reading point the city doesn't hide; a sign the tap
         * lands squarely on counts as no distance at all), or Infinity.
         */
        yieldsTo(nearest) {
            rivals = nearest;
        },

        /**
         * True if a tap at (x, y) was the shadow's (so a reading point near it doesn't open as well).
         * The shadow hears a tap first, so it answers for the tap it has just taken.
         */
        claimsTap(x, y) {
            return Boolean(claimed && claimed.x === x && claimed.y === y);
        },

        /**
         * Walking, a tap that nothing else in the city answered (no reading point, sign or touchable thing):
         * the shadow walks to the spot under it, a ring marking it. False if it isn't walking, or the tap
         * pointed at nothing it could walk toward.
         */
        walkToward(x, y) {
            if (!state.walking) return false;
            return aimAt(x, y, false);
        },

        /** The spot it's walking to, if any (for the local checks): { x, y, z, held } or null. */
        get destination() {
            return destination ? { x: destination.x, y: destination.y, z: destination.z, held: destination.held } : null;
        },

        /**
         * Take the shadow, wherever it waits. The first time, at the jetty's end, it turns from the sea to face
         * the city, the way in; after that it keeps the way it was left facing. The camera comes round behind it.
         */
        take() {
            if (state.walking || !rig) return;
            if (turnsToCity) {
                turnsToCity = false;
                turning = TOWARD_CITY;
            }
            if (!state.present) {
                if (wallShadow) {
                    // The shadow on the wall is a body's, standing just out from it (the wall faces the sunken
                    // sun, so the body's own shadow falls where the drawn one was), looking out to sea. It
                    // stands on the nearest floor there is: the cafés' platform ends close by, then water.
                    wallShadow.updateMatrixWorld();
                    const from = new Vector3().setFromMatrixPosition(wallShadow.matrixWorld);
                    side.set(0, 0, 1).applyQuaternion(wallShadow.quaternion).setY(0).normalize();
                    const stand = new Vector3();
                    const found = [0.5, 0.4, 0.6, 0.3, 0.75, 0.9].some((out) => floorAt(stand.copy(from).addScaledVector(side, out).x, stand.z) !== null);
                    if (!found) stand.copy(from).addScaledVector(side, 0.5);
                    walk.place(stand.x, stand.z, Math.PI / 2);
                    wallShadow.visible = false;
                } else {
                    walk.place(4.5, -3.2, Math.PI / 2);
                }
            }
            state.walking = true;
            rig.handsOff = true;
            rig.setDrifting(false);
            followTheta = behindOf(turning ?? state.heading);
            rise = 0;
            settling = 0;
            sightHeld = 0;
            lead.set(0, 0, 0);
            uniforms.walkClear.value = CLEAR_NEAR;
            uniforms.walkSightOn.value = 1;
            hovering = false;
            if (label) label.hidden = true;
            canvas.style.cursor = '';
            velocity.set(0, 0, 0);
            clearTarget();
            if (button) {
                button.textContent = 'let go';
                button.setAttribute('aria-pressed', 'true');
            }
            if (backButton) backButton.hidden = false;
            announce('You are the shadow. Arrow keys or WASD to walk; R to go back to the jetty; Escape to let go.');
        },

        /**
         * Back to the end of the jetty (R, or Home), facing the city again, wherever the shadow has got to: a
         * way out of any corner. The camera comes round behind it, across the city.
         */
        backToPier() {
            if (!pier) return;
            walk.place(pier.x, pier.z, TOWARD_CITY, pier.y);
            turning = null;
            followTheta = behindOf(TOWARD_CITY);
            velocity.set(0, 0, 0);
            clearTarget();
            lead.set(0, 0, 0);
            rise = 0;
            settling = 0;
            if (!state.walking) walk.take();
            announce('Back at the end of the jetty.');
        },

        /**
         * Walk from a place (a passage's "walk from here"): the shadow set down on the nearest floor it can
         * stand on, near (x, z), facing (x, z) if it had to stand off from it, and taken. False if there's
         * nowhere to stand near enough.
         */
        walkFrom(x, z) {
            const stand = standingNear(x, z);
            if (!stand) return false;
            const away = Math.hypot(x - stand.x, z - stand.z);
            const heading = away > 0.6 ? Math.atan2(x - stand.x, z - stand.z) : Math.atan2(-stand.x, -stand.z);
            walk.place(stand.x, stand.z, heading, stand.y);
            turnsToCity = false;
            turning = null;
            followTheta = behindOf(heading);
            velocity.set(0, 0, 0);
            clearTarget();
            lead.set(0, 0, 0);
            rise = 0;
            settling = 0;
            if (!state.walking) walk.take();
            announce('You walk from here.');
            return true;
        },

        /** Let go: the shadow stays where it stands, and the view is the visitor's again. */
        letGo() {
            if (!state.walking) return;
            state.walking = false;
            rig.handsOff = false;
            uniforms.walkClear.value = 0;
            uniforms.walkSightOn.value = 0;
            bridgeSight?.setW(0);
            keys.clear();
            releaseStick();
            press = null;
            clearTarget();
            velocity.set(0, 0, 0);
            rig.goal.radius = Math.max(rig.goal.radius, 18);
            rig.goal.phi = Math.min(rig.goal.phi, 1.1);
            rig.gliding = true;
            rig.setDrifting(true);
            if (button) {
                button.textContent = 'walk as the shadow';
                button.setAttribute('aria-pressed', 'false');
            }
            if (backButton) backButton.hidden = true;
            announce('You let go of the shadow. It stays where you left it.');
        },

        /**
         * Every frame, before the city is drawn.
         * @param {number} dt - the stage's step (seconds, no more than a twentieth)
         * @param {number} [walkDt] - the frame's own length (no more than a tenth): the walker keeps its pace on
         *   a slow screen, in steps no longer than dt
         */
        update(dt, walkDt = dt) {
            if (!state.walking) {
                state.moving += (0 - state.moving) * (1 - Math.exp(-8 * dt));
                return;
            }
            // While a passage is open, the walker waits (and the camera is the reader's).
            if (document.querySelector('dialog[open]')) return;
            // Until the map of walls is laid (on a slow machine it can take a while), it stands where it is.
            if (!hollowMap?.walls && wallsWaited < WALLS_WAIT) {
                wallsWaited += walkDt;
                velocity.set(0, 0, 0);
                follow(dt);
                return;
            }
            // A finger held still a moment walks it toward the place under it.
            if (press && !press.aimed && !stick.active && press.type !== 'mouse' && performance.now() - press.time >= HOLD_AFTER) {
                press.aimed = aimAt(press.x, press.y, true);
            }
            if (turning !== null) {
                state.heading += reducedMotion ? shortest(turning - state.heading) : shortest(turning - state.heading) * (1 - Math.exp(-5 * dt));
                if (Math.abs(shortest(turning - state.heading)) < 0.01 || velocity.lengthSq() > 0.05) turning = null;
            }
            const steps = Math.max(1, Math.ceil(walkDt / 0.05 - 1e-6));
            for (let step = 0; step < steps; step += 1) stepWalker(walkDt / steps);
            follow(dt);
        },

        /**
         * Draw the walker's shadow map for this frame (before the city is drawn).
         * @param {import('three').WebGLRenderer} renderer
         * @param {number} elapsed - seconds
         */
        render(renderer, elapsed) {
            if (ring) ring.visible = state.present && !state.walking;
            if (targetRing) {
                targetRing.visible = Boolean(destination) && state.walking;
                if (targetRing.visible) {
                    const breath = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 3.2);
                    targetRing.position.set(destination.x, destination.y + 0.03, destination.z);
                    const far = camera ? Math.max(1, camera.position.distanceTo(targetRing.position) * RING_FAR) : 1;
                    targetRing.scale.setScalar(far * (1 + 0.1 * breath));
                    targetRing.material.opacity = 0.3 + 0.3 * breath;
                }
            }
            if (!state.present) return;
            if (ring?.visible) {
                // The ring breathes (holding still, where motion is reduced), and from far off keeps a size
                // the eye can find.
                const breath = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 2.1);
                ring.position.set(state.position.x, state.position.y + 0.025, state.position.z);
                const far = camera ? Math.max(1, camera.position.distanceTo(ring.position) * RING_FAR) : 1;
                ring.scale.setScalar(far * (1 + 0.14 * breath));
                ring.material.opacity = 0.28 + 0.36 * breath;
            }
            if (label && camera) {
                // Its words show while the pointer is over it, or, while it still waits at the jetty's end to be
                // taken the first time, whenever the camera has come near it: just above the ring. (Let go of
                // somewhere in the city, it waits unlabelled: the visitor knows it by then.)
                const on = ringOnScreen();
                const near = turnsToCity && camera.position.distanceTo(state.position) < LABEL_NEAR;
                label.hidden = state.walking || !on.front || !(hovering || near);
                if (!label.hidden) label.style.translate = `${Math.round(on.x)}px ${Math.round(on.y - on.radius * 0.6 + 12)}px`;
            }
            // Out of the camera's sight (the walker, and the shadow it throws), there's nothing of it to draw:
            // the city's surfaces skip it altogether, and its map isn't drawn.
            if (camera) {
                sight.center.copy(state.position).addScaledVector(shadowWay, shadowLength * 0.5);
                sight.center.y += TALL * 0.5;
                sight.radius = shadowLength * 0.5 + TALL;
                camera.updateMatrixWorld();
                seen.multiplyMatrices(camera.projectionMatrix, inverse.copy(camera.matrixWorld).invert());
                view.setFromProjectionMatrix(seen);
                uniforms.walkerOn.value = view.intersectsSphere(sight) ? 1 : 0;
                if (!uniforms.walkerOn.value) return;
            }
            pose(elapsed);
            body.updateMatrixWorld(true);
            centre.copy(state.position);
            centre.y += TALL * 0.5;
            eye.position.copy(centre).addScaledVector(toLight, LIGHT_BACK);
            eye.up.set(0, 1, 0);
            eye.lookAt(centre);
            eye.updateMatrixWorld();
            uniforms.walkerMatrix.value.multiplyMatrices(eye.projectionMatrix, eye.matrixWorldInverse);
            const before = renderer.getRenderTarget();
            renderer.setRenderTarget(target);
            renderer.clear();
            renderer.render(scene, eye);
            renderer.setRenderTarget(before);
        },

        dispose() {
            target.dispose();
        },
    };
    return walk;
}

/**
 * What a surface's shader needs to take the walker's shadow: its uniforms, and
 * walkerShade(world), how far in shadow a world point lies (0 to 1). A point
 * is in it where it lies behind the walker, seen from the light, and not too
 * far behind; the edge is found by twelve looks round a small disc, turned a
 * little differently at every pixel, so it comes out stippled, as graphite
 * shades, not stepped.
 */
export const WALKER_GLSL = [
    'uniform sampler2D walkerDepth;',
    'uniform mat4 walkerMatrix;',
    'uniform float walkerOn;',
    'uniform vec2 walkerTexel;',
    'uniform float walkerReach;',
    'float walkerShade(vec3 world) {',
    '    if (walkerOn <= 0.0) return 0.0;',
    '    vec4 seen = walkerMatrix * vec4(world, 1.0);',
    '    vec3 at = seen.xyz / seen.w * 0.5 + 0.5;',
    '    if (at.x <= 0.0 || at.x >= 1.0 || at.y <= 0.0 || at.y >= 1.0 || at.z >= 1.0) return 0.0;',
    '    float turn = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
    '    mat2 spin = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));',
    '    vec2 disc[12];',
    '    disc[0] = vec2(-0.326, -0.406); disc[1] = vec2(-0.840, -0.074); disc[2] = vec2(-0.696, 0.457);',
    '    disc[3] = vec2(-0.203, 0.621); disc[4] = vec2(0.962, -0.195); disc[5] = vec2(0.473, -0.480);',
    '    disc[6] = vec2(0.519, 0.767); disc[7] = vec2(0.185, -0.893); disc[8] = vec2(0.507, 0.064);',
    '    disc[9] = vec2(0.896, 0.412); disc[10] = vec2(-0.322, -0.933); disc[11] = vec2(-0.792, -0.598);',
    '    float shade = 0.0;',
    '    for (int k = 0; k < 12; k++) {',
    '        float body = texture2D(walkerDepth, at.xy + spin * disc[k] * walkerTexel * 2.6).r;',
    '        float behind = at.z - body;',
    '        shade += step(0.0015, behind) * step(behind, walkerReach) * step(body, 0.99999);',
    '    }',
    '    return shade * walkerOn / 12.0;',
    '}',
].join('\n');

/**
 * Keep the thin things (poles, crossbars, wires, flags) from filling the view
 * while walking, as the camera passes among them: whatever of them comes
 * within reach of the camera then isn't drawn. (Walls and roofs are left
 * whole: the camera rises over those instead.)
 * @param {import('three').Material} material
 * @param {ReturnType<typeof createWalk>} walk
 * @param {number} [scale] - how much further than CLEAR_NEAR this material is cleared (the flags, being broad)
 */
export function walkerClears(material, walk, scale = 1) {
    alsoBeforeCompile(material, 'walker-clears', (shader) => {
        shader.uniforms.walkClear = walk.uniforms.walkClear;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vClearWorld;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClearWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float walkClear;\nvarying vec3 vClearWorld;')
            .replace('void main() {', `void main() {\n    if (distance(vClearWorld, cameraPosition) < walkClear * ${scale.toFixed(2)}) discard;`);
    });
    return material;
}

/**
 * Cut away, while walking, whatever of a material stands between the camera and the one casting the shadow
 * (the playtester's roofs, that hid the shadow and sent the camera up to look straight down): a tunnel about
 * the line of sight, SIGHT_NEAR wide at the lens and SIGHT_FAR toward the walker, ending SIGHT_KEEP short of
 * them. The cut is clean (a dithered edge set the ink pass drawing round every speck), and the city's ink draws
 * one line round what's cut, as a drawn cutaway would.
 * @param {import('three').Material} material
 * @param {ReturnType<typeof createWalk>} walk
 */
export function walkerSees(material, walk) {
    alsoBeforeCompile(material, 'walker-sees', (shader) => {
        shader.uniforms.walkSight = walk.uniforms.walkSight;
        shader.uniforms.walkSightOn = walk.uniforms.walkSightOn;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSightWorld;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSightWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 walkSight;\nuniform float walkSightOn;\nvarying vec3 vSightWorld;')
            .replace('void main() {', [
                'void main() {',
                `    if (walkSightOn > 0.5 && distance(vSightWorld, cameraPosition) < ${SIGHT_LENS.toFixed(2)}) discard;`,
                '    if (walkSightOn > 1.5) {',
                '        vec3 way = walkSight - cameraPosition;',
                '        float reach = max(length(way), 1e-3);',
                '        float along = dot(vSightWorld - cameraPosition, way) / (reach * reach);',
                `        float stop = 1.0 - ${SIGHT_KEEP.toFixed(2)} / reach;`,
                '        if (along > 0.0 && along < stop) {',
                '            float off = distance(vSightWorld, cameraPosition + way * along);',
                `            float radius = mix(${SIGHT_NEAR.toFixed(2)}, ${SIGHT_FAR.toFixed(2)}, along / max(stop, 1e-3));`,
                '            radius *= smoothstep(stop, stop - 0.1, along);',
                '            if (off < radius) discard;',
                '        }',
                '    }',
            ].join('\n'));
    });
    return material;
}

/**
 * Let the walker's shadow fall on a material: a deep dusk violet, as the
 * shadow on the café wall is. The city's own shadows are hatched; the
 * walker's is laid on as a wash, flat and dark, with only a little of the
 * ground showing through, so it still reads where it crosses theirs.
 * @param {import('three').Material} material
 * @param {ReturnType<typeof createWalk>} walk
 */
export function walkerShadow(material, walk) {
    alsoBeforeCompile(material, 'walker', (shader) => {
        Object.assign(shader.uniforms, walk.uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWalkerWorld;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWalkerWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\nvarying vec3 vWalkerWorld;\n${WALKER_GLSL}`)
            .replace('#include <opaque_fragment>', [
                'outgoingLight = mix(outgoingLight, vec3(0.02, 0.014, 0.034) + outgoingLight * 0.1, walkerShade(vWalkerWorld) * 0.85);',
                '#include <opaque_fragment>',
            ].join('\n'));
    });
    return material;
}
