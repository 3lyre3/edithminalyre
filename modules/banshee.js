/**
 * banshee.js — the shadow as a friendly banshee: a trial (trials.js), on unless ?wraith=off, which brings back
 * the walker (walk.js).
 *
 * Elm: "more like a friendly banshee flowing and billowing around and spreading its cloth where it glides etc
 * flowing out spreading and like having a very low graphical-intensity amount of distinct character/personality".
 *
 * Nobody is drawn, as with the walker: this is a body no one sees, and only its shadow falls on the city (walk.js
 * draws it from the light). It floats a hand above the paving: a big round hood on narrow shoulders, and a robe
 * falling from them to a hem in soft scallops. Its sleeves are wide, their cloth hanging from the arms, so that
 * gliding, when it opens its arms and sweeps them back, it spreads its cloth like wings. Gliding, it leans into
 * its going, and its skirt streams back and lifts, gathering into a tail behind it; stopping, the skirt swings on
 * past and back, as cloth does (it follows a sprung wind, a little under-damped), and settles.
 *
 * Its ways are all small. It bobs as it floats, and breathes; leans into its turns. Taken, it gives a little lift
 * of delight; sent somewhere, it twirls on arriving, its hem flaring; standing a while, it turns its hood to
 * whoever's watching and lifts a sleeve, hello; beside a passage, its hood turns to the passage; let go, it sinks
 * and its cloth spreads, as a sigh does. Waiting at the end of the jetty, it gazes out to sea, looks round when
 * the camera comes near, and now and then beckons. Under reduced motion it only glides.
 *
 * (Its shadow has to be it: so the hood is big, and narrower where it meets the shoulders, or its shadow ran into
 * a cone; and nothing hangs from the hood, which, side on, drew a beak.)
 *
 * The cloth is one mesh, laid in the world's own terms every frame, and the hood another: two draws into the
 * walker's shadow map.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Euler,
    Group,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    Quaternion,
    SphereGeometry,
    Vector3,
} from 'three';

// =============================================================================
// Constants
// =============================================================================

/** How high it floats (figure units, a person being 1.87): gliding, standing, waiting at the jetty's end, let go. */
const FLOAT = { gliding: 0.13, standing: 0.08, waiting: 0.1, resting: 0 };
/** It bobs this much as it floats, at this rate (radians a second), and breathes this much (a share of its girth). */
const BOB = 0.035;
const BOB_RATE = 1.7;
const BREATH = 0.035;
/** Gliding, it leans into its going (radians, at its fastest), about its middle (this high). */
const LEAN = 0.34;
const PIVOT = 0.85;
/** The hood: its middle and its size (across, up, front to back), and the neck it turns on. */
const HOOD_AT = new Vector3(0, 1.45, 0.02);
const HOOD_SIZE = new Vector3(0.175, 0.19, 0.18);
const NECK = new Vector3(0, 1.3, 0);
/** The robe: rings down it and points round it, from under the hood to the hem (above the float). */
const ROBE_RINGS = 12;
const ROBE_AROUND = 22;
const ROBE_TOP = 1.32;
const HEM = 0.16;
/** Its girth: at the neck, under the hood; how much more at the shoulders (just below); and more again at the hem. */
const ROBE_NECK = 0.09;
const ROBE_SHOULDERS = 0.13;
const ROBE_FLARE = 0.14;
/** Blown back by its going: how far its skirt streams, how high its back lifts, how much it gathers in. */
const ROBE_STREAM = 0.7;
const ROBE_LIFT = 0.32;
const ROBE_GATHER = 0.3;
/** The hem's soft scallops: how many, and how deep. */
const SCALLOPS = 5;
const SCALLOP_DEPTH = 0.07;
/** The sleeves: points along each arm; the shoulder; the arm's length; how far the cloth hangs below it, at the shoulder and at the cuff. */
const SLEEVE_POINTS = 6;
const SHOULDER = new Vector3(0.19, 1.2, 0);
const ARM = 0.48;
const DRAPE_IN = 0.42;
const DRAPE_OUT = 0.2;
/** The springs move in small steps (s), however long the frame. */
const SUBSTEP = 1 / 90;
/** The springs the robe's wind and the arms follow (stiffness, damping): a little under-damped, so they swing. */
const WIND_SPRING = [40, 8];
const ARM_SPRING = [26, 7];
/** A twirl on arriving, a lift on being taken (s). */
const TWIRL_FOR = 0.9;
const HOP_FOR = 0.7;
/** Standing this long, it looks round at whoever's watching (s), and then waves once, for so long. */
const PEERS_AFTER = 3.5;
const HELLO_AT = 4.3;
const HELLO_FOR = 1.6;
/** Waiting to be taken, it beckons every so often (s), for so long; and looks round at a camera this near. */
const BECKON_EVERY = 7.5;
const BECKON_FOR = 2.2;
const NOTICES = 24;
/** How far round (radians) its hood will turn from the way it faces. */
const HOOD_REACH = 1.1;

const UP = new Vector3(0, 1, 0);

// =============================================================================
// The pieces
// =============================================================================

/** The hood: round, its brow coming forward a little over the face, as a cowl's does. */
function hoodGeometry() {
    const geometry = new SphereGeometry(1, 16, 12);
    const position = geometry.attributes.position;
    const point = new Vector3();
    for (let k = 0; k < position.count; k += 1) {
        point.fromBufferAttribute(position, k);
        const brow = Math.max(0, point.z) * MathUtils.smoothstep(point.y, -0.3, 0.7);
        position.setXYZ(k, point.x * HOOD_SIZE.x, point.y * HOOD_SIZE.y, point.z * HOOD_SIZE.z + brow * 0.05);
    }
    geometry.computeBoundingSphere();
    return geometry;
}

/** A spring toward `target` (semi-implicit Euler): { x, v }. */
function spring(state, target, [stiffness, damping], h) {
    state.v += (stiffness * (target - state.x) - damping * state.v) * h;
    state.x += state.v * h;
}

/** 0 to 1 and back, smoothly, over t from 0 to 1 (0 outside). */
function bump(t) {
    return t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
}

function shortest(angle) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {number} options.figure - how much smaller than a person's height it's made (walk.js FIGURE)
 * @param {number} options.pace - the walker's fastest pace (units a second)
 * @param {boolean} [options.reducedMotion]
 */
export function createBanshee({ figure, pace, reducedMotion = false }) {
    const still = reducedMotion;
    const material = new MeshBasicMaterial({ color: 0x000000, side: DoubleSide });
    const hood = new Mesh(hoodGeometry(), material);
    hood.matrixAutoUpdate = false;
    hood.frustumCulled = false;

    // ----- The cloth: the robe and the sleeves, one mesh laid in the world's terms -----
    const robeCount = (ROBE_RINGS + 1) * (ROBE_AROUND + 1);
    const wingFrom = robeCount;
    const total = wingFrom + 2 * SLEEVE_POINTS * 2;
    const positions = new Float32Array(total * 3);
    const index = [];
    for (let ring = 0; ring < ROBE_RINGS; ring += 1) {
        for (let side = 0; side < ROBE_AROUND; side += 1) {
            const a = ring * (ROBE_AROUND + 1) + side;
            const b = a + ROBE_AROUND + 1;
            index.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    for (const from of [wingFrom, wingFrom + SLEEVE_POINTS * 2]) {
        for (let k = 0; k < SLEEVE_POINTS - 1; k += 1) {
            const a = from + k * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const geometry = new BufferGeometry();
    // (A BufferAttribute over the array itself, which is laid anew every frame: a Float32BufferAttribute would copy it.)
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const cloth = new Mesh(geometry, material);
    cloth.frustumCulled = false;
    const body = new Group();
    body.add(hood, cloth);

    // ----- Its state -----
    const matrix = new Matrix4();
    const tilt = new Matrix4();
    const leaning = new Matrix4();
    const unPivot = new Matrix4().makeTranslation(0, -PIVOT * figure, 0);
    const sized = new Matrix4().makeScale(figure, figure, figure);
    const hoodFrame = new Matrix4();
    const turnAt = new Matrix4();
    const unNeck = new Matrix4().makeTranslation(-NECK.x, -NECK.y, -NECK.z);
    const hoodPlace = new Matrix4().makeTranslation(HOOD_AT.x, HOOD_AT.y, HOOD_AT.z);
    const quaternion = new Quaternion();
    const euler = new Euler(0, 0, 0, 'YXZ');
    const where = new Vector3();
    const point = new Vector3();
    const wind = { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } };
    const arms = [0, 1].map(() => ({ lift: { x: 0.25, v: 0 }, turn: { x: 0, v: 0 } }));
    let lift = FLOAT.waiting;
    let pool = 0;
    let glide = 0;
    let lastHeading = null;
    let turnRate = 0;
    let stillFor = 0;
    let helloFrom = -1;
    let helloDone = false;
    let twirlFrom = -1;
    let hopFrom = -1;
    let hoodTurn = 0;
    let hoodTilt = 0;

    /** The body's frame (figure units to the world): floating `rise` over `at`, facing `heading`, leaning and rolling about its middle. */
    function frame(out, at, heading, rise, lean, roll) {
        where.set(at.x, at.y + rise * figure, at.z);
        quaternion.setFromAxisAngle(UP, heading);
        out.compose(where, quaternion, point.set(1, 1, 1));
        tilt.makeTranslation(0, PIVOT * figure, 0)
            .multiply(leaning.makeRotationFromEuler(euler.set(lean, 0, roll, 'YXZ')))
            .multiply(unPivot)
            .multiply(sized);
        return out.multiply(tilt);
    }

    function put(vertex, p) {
        positions[vertex * 3] = p.x;
        positions[vertex * 3 + 1] = p.y;
        positions[vertex * 3 + 2] = p.z;
    }

    const banshee = {
        /** Its body (the hood and its cloth), for the walker's shadow map. */
        body,

        /** Set down somewhere new: its cloth lies as it would there, at once. */
        reset() {
            wind.x.x = 0;
            wind.x.v = 0;
            wind.z.x = 0;
            wind.z.v = 0;
            lastHeading = null;
        },

        /** Taken: a little lift of delight. */
        taken(elapsed) {
            if (!still) hopFrom = elapsed;
        },

        /** Arrived where it was sent: a twirl. */
        arrived(elapsed) {
            if (!still && twirlFrom < 0) twirlFrom = elapsed;
        },

        /**
         * Pose it for this moment.
         * @param {object} at
         * @param {number} at.elapsed - seconds
         * @param {number} at.dt - this frame's length (s)
         * @param {Vector3} at.position - the floor under it
         * @param {number} at.heading - which way it faces (radians, 0 = +z)
         * @param {Vector3} at.velocity - its going (units a second)
         * @param {'waiting' | 'walking' | 'resting'} at.mode - waiting to be taken at the jetty's end; walked; let go
         * @param {Vector3 | null} at.attending - a passage it's beside, or null
         * @param {Vector3 | null} at.viewer - where the camera is
         */
        pose({ elapsed, dt, position, heading, velocity, mode, attending, viewer }) {
            const t = elapsed;
            const speed = Math.min(1, velocity.length() / pace);
            const cos = Math.cos(heading);
            const sin = Math.sin(heading);
            const flowX = (velocity.x * cos - velocity.z * sin) / pace;
            const flowZ = (velocity.x * sin + velocity.z * cos) / pace;
            glide += (speed - glide) * (1 - Math.exp(-3 * dt));
            if (lastHeading === null) lastHeading = heading;
            const turnedBy = shortest(heading - lastHeading);
            lastHeading = heading;
            turnRate += ((dt > 0 ? turnedBy / dt : 0) - turnRate) * (1 - Math.exp(-6 * dt));
            if (mode === 'walking' && speed < 0.05) {
                stillFor += dt;
            } else {
                stillFor = 0;
                helloDone = false;
            }
            const poolTo = mode === 'resting' ? 1 : mode === 'waiting' ? 0.15 : 0;
            pool += (poolTo - pool) * (1 - Math.exp(-(poolTo > pool ? 1.1 : 4) * dt));
            const liftTo = mode === 'resting' ? FLOAT.resting : mode === 'waiting' ? FLOAT.waiting : speed > 0.1 ? FLOAT.gliding : FLOAT.standing;
            lift += (liftTo - lift) * (1 - Math.exp(-3 * dt));

            let twirl = 0;
            let twirling = 0;
            if (twirlFrom >= 0) {
                const u = (t - twirlFrom) / TWIRL_FOR;
                if (u >= 1) {
                    twirlFrom = -1;
                } else {
                    twirl = u * u * (3 - 2 * u);
                    twirling = bump(u);
                }
            }
            const hop = hopFrom >= 0 ? bump((t - hopFrom) / HOP_FOR) : 0;
            if (hopFrom >= 0 && t - hopFrom > HOP_FOR) hopFrom = -1;

            // Where it looks: a passage it's beside; standing a while, whoever's watching; waiting, out to sea,
            // unless the camera has come near.
            let look = 0;
            let looking = false;
            const toward = (p) => shortest(Math.atan2(p.x - position.x, p.z - position.z) - heading);
            if (mode === 'walking' && attending) {
                look = toward(attending);
                looking = true;
            } else if (mode === 'walking' && stillFor > PEERS_AFTER && viewer) {
                look = toward(viewer);
                looking = true;
            } else if (mode === 'waiting' && viewer && viewer.distanceTo(position) < NOTICES) {
                look = toward(viewer);
                looking = true;
            }
            look = MathUtils.clamp(look, -HOOD_REACH, HOOD_REACH);
            hoodTurn += (look - hoodTurn) * (1 - Math.exp(-3 * dt));
            const tiltTo = looking && !still ? 0.2 * MathUtils.clamp(hoodTurn / 0.6, -1, 1) : 0;
            hoodTilt += (tiltTo - hoodTilt) * (1 - Math.exp(-2.5 * dt));

            // Hello: standing a while, once, the sleeve on the side it looks toward lifts and waves.
            if (mode === 'walking' && !helloDone && !still && stillFor > HELLO_AT) {
                helloFrom = t;
                helloDone = true;
            }
            const hello = helloFrom >= 0 ? bump((t - helloFrom) / HELLO_FOR) : 0;
            if (helloFrom >= 0 && t - helloFrom > HELLO_FOR) helloFrom = -1;
            const helloArm = hoodTurn >= 0 ? 0 : 1;
            // Waiting to be taken, now and then its right sleeve lifts and beckons.
            const beckon = mode !== 'walking' && !still ? bump((t % BECKON_EVERY) / BECKON_FOR) : 0;

            // The arms: hanging, a little forward, standing; gliding, opened and swept back, spreading the cloth.
            const armTargets = arms.map((_, side) => {
                let raise = 0.25 + 0.8 * glide;
                let turn = 0.12 * (1 - glide) - 0.6 * glide;
                raise *= 1 - 0.5 * pool;
                raise += (1.4 - raise) * twirling;
                turn *= 1 - twirling;
                raise += 0.55 * hop;
                if (side === 1 && beckon > 0) {
                    raise += (2.0 - raise) * beckon;
                    turn += (0.7 + 0.28 * Math.sin(t * 7) - turn) * beckon;
                }
                if (side === helloArm && hello > 0) {
                    raise += (1.9 - raise) * hello;
                    turn += (0.5 + 0.3 * Math.sin(t * 8) - turn) * hello;
                }
                return [raise, turn];
            });
            const steps = Math.max(1, Math.min(9, Math.ceil(dt / SUBSTEP - 1e-6)));
            const h = dt / steps;
            for (let k = 0; k < steps; k += 1) {
                spring(wind.x, flowX, WIND_SPRING, h);
                spring(wind.z, flowZ, WIND_SPRING, h);
                arms.forEach((arm, side) => {
                    spring(arm.lift, armTargets[side][0], ARM_SPRING, h);
                    spring(arm.turn, armTargets[side][1], ARM_SPRING, h);
                });
            }

            const bob = still ? 0 : BOB * Math.sin(t * BOB_RATE) * (1 - pool);
            const rise = lift + bob + 0.14 * hop;
            const lean = still ? 0.5 * LEAN * glide : LEAN * glide;
            const roll = still ? 0 : MathUtils.clamp(-turnRate * 0.06, -0.25, 0.25) * glide;
            frame(matrix, position, heading + twirl * Math.PI * 2, rise, lean, roll);

            // The hood turns on the neck; let go, it bows a little.
            turnAt.makeRotationFromEuler(euler.set(0.25 * pool, hoodTurn, hoodTilt, 'YXZ'));
            hoodFrame.makeTranslation(NECK.x, NECK.y - 0.08 * pool, NECK.z).multiply(turnAt).multiply(unNeck);
            hood.matrix.multiplyMatrices(matrix, hoodFrame).multiply(hoodPlace);
            hood.matrixWorldNeedsUpdate = true;

            // ----- The robe: falling from narrow shoulders to a scalloped hem; blown back, it streams and lifts -----
            const windX = wind.x.x;
            const windZ = wind.z.x;
            const blown = Math.min(1, Math.hypot(windX, windZ));
            const downwind = Math.atan2(-windX, -windZ);
            const downX = Math.sin(downwind);
            const downZ = Math.cos(downwind);
            const hemY = HEM * (1 - pool) + 0.02 * pool;
            for (let ring = 0; ring <= ROBE_RINGS; ring += 1) {
                const f = ring / ROBE_RINGS;
                const y = ROBE_TOP - f * (ROBE_TOP - hemY);
                const breath = still ? 1 : 1 + BREATH * Math.sin(t * 1.3 + f * 2);
                const girth = (ROBE_NECK + ROBE_SHOULDERS * MathUtils.smoothstep(f, 0.02, 0.2) + ROBE_FLARE * f ** 1.15
                    + (0.2 * pool + 0.14 * twirling) * f * f) * breath * (1 - ROBE_GATHER * blown * f * f);
                for (let side = 0; side <= ROBE_AROUND; side += 1) {
                    const angle = (side / ROBE_AROUND) * Math.PI * 2;
                    const back = 0.5 + 0.5 * Math.cos(angle - downwind);
                    const ripple = still ? 0 : f * (0.03 * Math.sin(angle * 3 + t * 2.3 + f * 4.5) + 0.015 * Math.sin(angle * 5 - t * 1.7)) * (0.4 + blown);
                    const r = girth + ripple;
                    const scallop = f ** 6 * SCALLOP_DEPTH * (0.5 + 0.5 * Math.cos(angle * SCALLOPS + (still ? 0 : t * 1.3)));
                    const stream = blown * ROBE_STREAM * f ** 1.6 * (0.55 + 0.45 * back);
                    const lifted = blown * f * f * ROBE_LIFT * back;
                    point.set(Math.sin(angle) * r + downX * stream, y + scallop + lifted, Math.cos(angle) * r * 0.88 + downZ * stream);
                    put(ring * (ROBE_AROUND + 1) + side, point.applyMatrix4(matrix));
                }
            }

            // ----- The sleeves: the arm's line, and the cloth hanging below it to the robe's side -----
            arms.forEach((arm, side) => {
                const sign = side === 0 ? 1 : -1;
                const raise = arm.lift.x;
                const turn = arm.turn.x;
                const dx = sign * Math.sin(raise) * Math.cos(turn);
                const dy = -Math.cos(raise);
                const dz = Math.sin(raise) * Math.sin(turn);
                const first = wingFrom + side * SLEEVE_POINTS * 2;
                for (let j = 0; j < SLEEVE_POINTS; j += 1) {
                    const u = j / (SLEEVE_POINTS - 1);
                    const reach = ARM * u;
                    const tx = sign * SHOULDER.x + dx * reach;
                    const ty = SHOULDER.y + dy * reach;
                    const tz = SHOULDER.z + dz * reach;
                    put(first + j * 2, point.set(tx, ty, tz).applyMatrix4(matrix));
                    const drape = DRAPE_IN * (1 - u) + DRAPE_OUT * u;
                    const flutter = still ? 0 : 0.06 * Math.sin(t * 4 - u * 3 + side) * u * (0.3 + blown);
                    point.set(tx + downX * blown * 0.3 * u, ty - drape, tz + downZ * blown * 0.3 * u + flutter);
                    put(first + j * 2 + 1, point.applyMatrix4(matrix));
                }
            });

            geometry.attributes.position.needsUpdate = true;
        },
    };
    return banshee;
}
