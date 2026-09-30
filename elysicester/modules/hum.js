/**
 * hum.js — the hum you fly as (a trial, trials.js: ?hum=off walks the shadow again, as before).
 *
 * Elm: "what if so that the viewer can see what they're controlling, the controlled character was one of the bronze
 * hummingbirds and the shadow was still the very cute and adorable wraith we currently have? just with the
 * hummingbird flying lowish medium lowish and central so it's easy to keep track of one's character's position";
 * and "the hum having the wraith shadow following it as if it were the hum's own shadow is the move".
 *
 * One of the bridgework's "countless hums" (hums.js; Numbers by Paint, Episode 3: "a loud, bronze hummingbird,
 * dripping with steam"), come down to fly low through the streets, a little above the head of the one who casts
 * the shadow: the wraith (banshee.js), who goes beneath it, unseen, so that its shadow goes wherever the hum goes,
 * lying long across the paving from just beneath it, as if it were the hum's own. Near, as this one is seen, a hum is
 * drawn as one: a plump bronze body, a copper throat, a paler breast, a round head and a long fine beak, a little fan
 * of a tail, and wings that are a blur (a faint fan of bronze where they beat, and the wing itself flickering within
 * it). It rises and settles with the floor beneath it (gliding down off a quay's edge, up a flight of steps), leans
 * into its going and banks into its turns, bobs as it hovers, gives a little lift of delight when it's taken and a
 * twirl when it arrives where it was sent, and wears a little steam. It's drawn, and casts nothing: the shadow is the
 * wraith's. Where motion is reduced, it hovers level, wings and steam still.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    Color,
    ConeGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { birdMaterial, createSteam } from './hums.js';
import { paint, pose } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * How high above the floor beneath it the hum flies ("lowish medium lowish"): about the wraith's head (1.35), under the
 * market's awnings, the cafés' valances and the lamps over the hostel's table.
 */
export const FLIGHT = 1.3;
/** Its size, over the bird as drawn below (about a sparrow's there): big enough that a phone's screen finds it. */
const SIZE = 1.9;
/** How quickly it rises or settles to its height over a new floor (per second). */
const SETTLE = 3.2;
/** Its steam: this many puffs, each rising and fading over LIFE seconds. */
const PUFFS = 3;
const LIFE = 1.7;
/** Bronze, darker bronze for its wings and tail, copper at the throat, and a paler bronze breast. */
const BRONZE = 0xc0803e;
const BRONZE_DARK = 0x7a4a22;
const COPPER = 0xb8502c;
const BREAST = 0xe2b27a;
const EYE = 0x1a1008;
/** A wing: from the shoulder, this long, swept back so; and how far it beats up and down (radians, about level). */
const WING = 0.2;
const BEAT_FROM = -0.7;
const BEAT_TO = 1.2;

// =============================================================================
// The bird, near
// =============================================================================

/** Give every vertex a wing weight (0 on the body; 0 at a wing's root to 1 at its tip), as hums.js's shader asks. */
function weighed(geometry, weight = 0) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.deleteAttribute('uv');
    const weights = new Float32Array(flat.attributes.position.count).fill(weight);
    flat.setAttribute('wing', new Float32BufferAttribute(weights, 1));
    return flat;
}

/**
 * The hum as it's seen near, looking along +z: body, breast, throat, head, eyes, beak and tail (still), and the two
 * wings (their tips weighted, so hums.js's shader beats them about the body's long axis).
 */
function humGeometry() {
    const body = pose(new SphereGeometry(1, 12, 9), { sx: 0.062, sy: 0.066, sz: 0.118, z: -0.01 });
    // (The breast paler beneath, the throat copper, as the light takes them.)
    paint(body, BRONZE);
    const colour = new Color();
    const bodyColours = body.attributes.color;
    for (let index = 0; index < bodyColours.count; index += 1) {
        const y = body.attributes.position.getY(index);
        const z = body.attributes.position.getZ(index);
        colour.setHex(BRONZE);
        if (y < -0.01) colour.lerp(new Color(BREAST), MathUtils.smoothstep(-y, 0.01, 0.06));
        if (z > 0.05 && y < 0.03) colour.lerp(new Color(COPPER), MathUtils.smoothstep(z, 0.05, 0.1) * 0.85);
        bodyColours.setXYZ(index, colour.r, colour.g, colour.b);
    }
    const head = paint(pose(new SphereGeometry(0.047, 10, 8), { y: 0.036, z: 0.112 }), BRONZE);
    const eyes = [-1, 1].map((side) => paint(pose(new SphereGeometry(0.011, 6, 4), { x: side * 0.036, y: 0.05, z: 0.13 }), EYE));
    const beak = paint(pose(new ConeGeometry(0.0075, 0.15, 5), { rx: Math.PI / 2, y: 0.032, z: 0.232 }), EYE);
    // The tail: a little fan of three feathers behind, tipped down a touch.
    const tail = [];
    for (const [spread, length] of [[-0.35, 0.1], [0, 0.115], [0.35, 0.1]]) {
        const feather = new BufferGeometry();
        feather.setAttribute('position', new Float32BufferAttribute([
            -0.014, 0, 0, 0.014, 0, 0, 0, -0.012, -length,
        ], 3));
        feather.computeVertexNormals();
        pose(feather, { rx: -0.25, ry: spread, z: -0.105, y: 0.004 });
        tail.push(paint(feather, BRONZE_DARK));
    }
    // Each wing: a long narrow blade from the shoulder, its tip swept back; weighted from root to tip.
    const positions = [];
    const weights = [];
    for (const side of [-1, 1]) {
        const root = [side * 0.022, 0.03, 0.035];
        const back = [side * 0.022, 0.026, -0.03];
        const tip = [side * (0.022 + WING), 0.045, -0.06];
        const mid = [side * (0.022 + WING * 0.55), 0.04, 0.012];
        positions.push(...root, ...back, ...mid, ...mid, ...back, ...tip);
        weights.push(0, 0, 0.55, 0.55, 0, 1);
    }
    const wings = new BufferGeometry();
    wings.setAttribute('position', new Float32BufferAttribute(positions, 3));
    wings.setAttribute('wing', new Float32BufferAttribute(weights, 1));
    wings.computeVertexNormals();
    paint(wings, BRONZE_DARK);
    return mergeGeometries([weighed(body), weighed(head), ...eyes.map((eye) => weighed(eye)), weighed(beak), ...tail.map((feather) => weighed(feather)), wings], false);
}

/**
 * The blur of its wings: on each side, a faint fan of bronze over the arc a wing sweeps as it beats, in the plane it
 * beats in (a hummingbird's wings are seen as the haze they make).
 */
function blurGeometry() {
    const positions = [];
    const segments = 10;
    for (const side of [-1, 1]) {
        for (let k = 0; k < segments; k += 1) {
            const a0 = BEAT_FROM + ((BEAT_TO - BEAT_FROM) * k) / segments;
            const a1 = BEAT_FROM + ((BEAT_TO - BEAT_FROM) * (k + 1)) / segments;
            const reach = WING + 0.015;
            // (The wing lifts about the body's long axis: a point out at x = side * reach turns up by the angle, on
            // either side alike.)
            const at = (angle) => [side * (0.022 + reach * Math.cos(angle)), 0.035 + reach * Math.sin(angle), -0.02];
            positions.push(side * 0.022, 0.035, -0.02, ...at(a0), ...at(a1));
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geometry;
}

// =============================================================================
// Main Code
// =============================================================================

function shortest(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * @param {object} options
 * @param {import('three').Texture} options.gradientMap - the city's toon ramp
 * @param {boolean} options.reducedMotion
 * @returns {{ object: Group, position: Vector3, fly: Function, pose: Function, reset: Function }}
 */
export function createHum({ gradientMap, reducedMotion }) {
    const clock = { value: 0 };
    const mesh = new Mesh(humGeometry(), birdMaterial(gradientMap, clock));
    mesh.name = 'hum';
    const blur = new Mesh(blurGeometry(), new MeshBasicMaterial({
        color: new Color(0xd09050),
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
    }));
    blur.name = 'hum-blur';
    blur.renderOrder = 2;
    const bird = new Group();
    bird.scale.setScalar(SIZE);
    bird.add(mesh, blur);
    // (Its steam is laid in the world's own terms, so it rises from wherever the hum has got to and stays there.)
    const steam = createSteam(PUFFS, SIZE * 0.7);
    const object = new Group();
    object.name = 'hum-flown';
    object.add(bird, steam.points);
    object.visible = false;
    const puffs = Array.from({ length: PUFFS }, () => ({ origin: new Vector3(), last: Infinity }));

    /** Where it flies (the camera looks near here): above the one casting the shadow, at its height over their floor. */
    const position = new Vector3();
    let placed = false;
    let lift = 0;
    let twirl = 0;
    let roll = 0;
    let lastHeading = null;

    return {
        object,
        position,

        /**
         * Carry it on with the one beneath it, for a step of dt seconds: straight above their feet, and rising or
         * settling toward its height over the floor they stand on.
         * @param {number} dt
         * @param {Vector3} feet - where the one casting the shadow stands
         */
        fly(dt, feet) {
            const want = feet.y + FLIGHT;
            if (!placed || reducedMotion) {
                position.set(feet.x, want, feet.z);
                placed = true;
                return;
            }
            position.x = feet.x;
            position.z = feet.z;
            position.y += (want - position.y) * (1 - Math.exp(-SETTLE * dt));
        },

        /** Set down somewhere new: it's there at once, at its height. */
        reset() {
            placed = false;
            lastHeading = null;
            roll = 0;
        },

        /**
         * Pose it for this moment: its lean, its bank, its bob, its wings and its steam.
         * @param {object} moment
         * @param {number} moment.elapsed - seconds
         * @param {number} moment.dt - since the last pose (seconds)
         * @param {number} moment.heading - the way it goes (radians, 0 = +z)
         * @param {number} moment.moving - how much it's going (0 to 1)
         * @param {boolean} moment.flown - whether it's being flown (else it hovers, waiting, looking about)
         * @param {boolean} moment.taken - just taken: a lift of delight
         * @param {boolean} moment.arrived - just arrived where it was sent: a twirl
         */
        pose({ elapsed, dt, heading, moving, flown, taken, arrived }) {
            object.visible = true;
            clock.value = reducedMotion ? 0.4 : elapsed;
            if (taken && !reducedMotion) lift = 1;
            if (arrived && !reducedMotion) twirl = 1;
            lift = Math.max(0, lift - dt * 2.2);
            twirl = Math.max(0, twirl - dt * 1.5);
            const bob = reducedMotion ? 0 : Math.sin(elapsed * 5.3) * 0.045 + Math.sin(elapsed * 1.9 + 0.7) * 0.02;
            bird.position.copy(position);
            bird.position.y += bob + Math.sin(Math.PI * lift) * 0.28;
            // Banking into its turns, the way a bird leans; nose down into its going.
            const rate = lastHeading === null || dt <= 0 ? 0 : shortest(heading - lastHeading) / dt;
            lastHeading = heading;
            const bank = reducedMotion ? 0 : MathUtils.clamp(-rate * 0.14, -0.55, 0.55) * moving;
            roll += (bank - roll) * (1 - Math.exp(-6 * dt));
            const pitch = reducedMotion ? 0 : 0.3 * moving;
            // Hovering unflown, it looks about now and then; a twirl turns it right round, and eases out.
            const glance = flown || reducedMotion ? 0 : Math.sin(elapsed * 0.9) * 0.5 * (1 - moving);
            const spin = twirl > 0 ? (1 - twirl ** 3) * Math.PI * 2 : 0;
            bird.rotation.set(pitch, heading + glance + spin, roll, 'YXZ');
            // A little steam, rising off it as it goes, and left behind where it was.
            for (let puff = 0; puff < PUFFS; puff += 1) {
                const age = reducedMotion ? 0.3 + puff * 0.22 : ((elapsed + (puff / PUFFS) * LIFE) % LIFE) / LIFE;
                const one = puffs[puff];
                if (age < one.last || reducedMotion) one.origin.set(bird.position.x, bird.position.y - 0.08, bird.position.z);
                one.last = age;
                const rise = age * 0.6 + age * age * 0.35;
                steam.positions[puff * 3] = one.origin.x + Math.sin(puff * 1.7 + age * 3) * 0.08 * age;
                steam.positions[puff * 3 + 1] = one.origin.y + rise;
                steam.positions[puff * 3 + 2] = one.origin.z + Math.cos(puff * 2.3 + age * 2) * 0.08 * age;
                steam.ages[puff] = age;
            }
            steam.geometry.attributes.position.needsUpdate = true;
            steam.geometry.attributes.age.needsUpdate = true;
        },
    };
}
