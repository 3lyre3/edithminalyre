/**
 * hums.js — an extra (extras.js): the bronze hummingbirds of the bridgework.
 *
 * "Lets a loud, bronze hummingbird, dripping with steam, bring her a second
 * cup … Flits back to the anonymity of the enormous, deep-tangling
 * bridgework. One of countless hums." (Numbers by Paint, Episode 3.)
 *
 * A few of the countless: tiny bronze birds that hover by the spires, wings a
 * blur, and dart from one spire to the next, each "dripping with steam" (a few
 * puffs rising off it). One draw call for the birds and one for their steam;
 * each keeps a random stream of its own, so nothing else in the city moves.
 * Where motion is reduced, they hover where they are, wings and steam still.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferAttribute,
    BufferGeometry,
    ConeGeometry,
    DoubleSide,
    DynamicDrawUsage,
    Euler,
    Float32BufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshToonMaterial,
    Points,
    Quaternion,
    ShaderMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRAWN } from './ink.js';
import { BRONZE_SHOWS, createRandom, paint, pose, reflective } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** A few more of the countless (each bird keeps a stream of its own, so the first nine fly as they always did). */
const COUNT = 14;
const BRONZE = 0xc0803e;
const BRONZE_DARK = 0x7a4a22;
/** How fast a hum darts between spires, in world units a second. */
const SPEED = 7;
/** Each hum is "dripping with steam": this many puffs apiece, each rising and fading over LIFE seconds. */
const PUFFS = 3;
const LIFE = 1.7;

// =============================================================================
// The bird
// =============================================================================

/**
 * One hummingbird, looking along +z: body, head and beak, and two wings whose tips flap (the "wing" attribute).
 * (Also the hum you fly as: hum.js.)
 */
export function birdGeometry() {
    const solid = [
        pose(new ConeGeometry(0.05, 0.24, 6), { rx: -Math.PI / 2, z: -0.02 }),
        pose(new SphereGeometry(0.045, 6, 4), { z: 0.11, y: 0.012 }),
        pose(new ConeGeometry(0.009, 0.13, 4), { rx: Math.PI / 2, z: 0.21, y: 0.016 }),
    ].map((piece) => {
        const flat = paint(piece.index ? piece.toNonIndexed() : piece, BRONZE);
        flat.deleteAttribute('uv');
        flat.setAttribute('wing', new Float32BufferAttribute(new Float32Array(flat.attributes.position.count), 1));
        return flat;
    });
    // Each wing: a long thin blade from the shoulder, its tip swept back.
    const positions = [];
    const weights = [];
    for (const side of [-1, 1]) {
        const root = [side * 0.03, 0.025, 0.035];
        const back = [side * 0.03, 0.02, -0.04];
        const tip = [side * 0.21, 0.045, -0.05];
        positions.push(...root, ...back, ...tip);
        weights.push(0, 0, 1);
    }
    const wings = new BufferGeometry();
    wings.setAttribute('position', new Float32BufferAttribute(positions, 3));
    wings.setAttribute('wing', new Float32BufferAttribute(weights, 1));
    wings.computeVertexNormals();
    paint(wings, BRONZE_DARK);
    return mergeGeometries([...solid, wings], false);
}

/** Bronze in the dusk, drawn like everything else; its wings beat in the vertex shader. (Also hum.js's.) */
export function birdMaterial(gradientMap, clock) {
    const material = new MeshToonMaterial({
        gradientMap,
        vertexColors: true,
        color: 0xffffff,
        emissive: 0x5a3208,
        emissiveIntensity: 0.55,
        side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
        shader.uniforms.humTime = clock;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float humTime;\nattribute float wing;')
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                '// A blur of wings: fast, and never quite in step from bird to bird.',
                'float beat = sin(humTime * 71.0 + float(gl_InstanceID) * 1.93);',
                'float lift = sign(position.x) * wing * (0.25 + 0.95 * beat);',
                'transformed.xy = mat2(cos(lift), sin(lift), -sin(lift), cos(lift)) * transformed.xy;',
            ].join('\n'));
    };
    // (Bronze, metal: the city's cube in it, as in the gold, the right way up, so a hum is brightest beneath, where it
    // shows the city's lights below it: Elm, 5 Oct, "could you please alter the hums' cubemapping so they're brighter on
    // the bottom again". From 4 Oct it was turned over, darker beneath: kit.js keeps the way, { over: true }.)
    return reflective(material, BRONZE_SHOWS);
}

// =============================================================================
// Steam
// =============================================================================

/**
 * The steam the hums drip: soft puffs, one set of points for every bird. Each
 * puff leaves its bird, rises and swells, and fades, then leaves it again from
 * wherever the bird has got to. Drawn only; it blocks and hides nothing. (`scale`: how much bigger each puff is,
 * for a bigger bird: hum.js.)
 */
export function createSteam(count, scale = 1) {
    const positions = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const geometry = new BufferGeometry();
    // BufferAttribute, not Float32BufferAttribute (which copies): the puffs are written straight into these arrays.
    geometry.setAttribute('position', new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('age', new BufferAttribute(ages, 1).setUsage(DynamicDrawUsage));
    const uniforms = { viewportHeight: { value: 800 } };
    const material = new ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
            attribute float age;
            uniform float viewportHeight;
            varying float vAge;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vAge = age;
                float size = (0.06 + 0.2 * age) * ${scale.toFixed(2)};
                gl_PointSize = clamp(size * projectionMatrix[1][1] * viewportHeight * 0.5 / -mvPosition.z, 1.0, 48.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vAge;
            void main() {
                float fromCentre = length(gl_PointCoord - 0.5) * 2.0;
                float puff = 1.0 - smoothstep(0.35, 1.0, fromCentre);
                float fade = pow(1.0 - vAge, 1.6) * smoothstep(0.0, 0.08, vAge);
                gl_FragColor = vec4(vec3(0.96, 0.9, 0.84), puff * fade * 0.42);
            }
        `,
    });
    const points = new Points(geometry, material);
    points.name = 'hum-steam';
    points.frustumCulled = false;
    const size = new Vector2();
    points.onBeforeRender = (renderer) => {
        // (The city's picture's own height, drawn smaller than the screen when the governor asks: ink.js DRAWN.)
        uniforms.viewportHeight.value = renderer.getDrawingBufferSize(size).y * DRAWN.scale;
    };
    return { points, positions, ages, geometry };
}

// =============================================================================
// Keeping clear of the spires
// =============================================================================

/**
 * A spire's girth at height y: its shaft (0.72 across the radius at the foot,
 * tapering to 0.34, with rings that stand out 0.37 more), then its cone.
 */
function girthAt(spire, y) {
    const above = y - spire.base;
    if (above < 0) return 0;
    if (above <= spire.height) return (spire.girth ? spire.girth(above / spire.height) : 0.72 - 0.38 * (above / spire.height)) + 0.37;
    const up = (above - spire.height) / 3.6;
    return up > 1 ? 0 : 0.42 * (1 - up);
}

/** True if a dart from `from` to `to` (rising in its little arc) passes every spire at least `margin` off. */
function clearPath(spires, from, to, margin = 0.3) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length2 = dx * dx + dz * dz;
    for (const spire of spires) {
        const t = length2 > 1e-9 ? Math.min(1, Math.max(0, ((spire.x - from.x) * dx + (spire.z - from.z) * dz) / length2)) : 0;
        const y = from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * 0.35;
        const gap = Math.hypot(spire.x - (from.x + dx * t), spire.z - (from.z + dz * t)) - girthAt(spire, y);
        if (gap < margin) return false;
    }
    return true;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {{ x: number, z: number, base: number, height: number }[]} options.spires - from the bridgework
 * @param {import('three').Texture} options.gradientMap - the city's toon ramp
 * @returns {{ object: InstancedMesh, update: (time: number) => void }}
 */
export function createHums({ spires, gradientMap }) {
    const clock = { value: 0 };
    const mesh = new InstancedMesh(birdGeometry(), birdMaterial(gradientMap, clock), COUNT);
    mesh.name = 'hums';
    mesh.frustumCulled = false;

    /** A place to hover: by a spire, somewhere up its height, a little way off its girth there. */
    const hoverBy = (random, spire, out) => {
        const angle = random() * Math.PI * 2;
        const y = spire.base + spire.height * random.range(0.25, 0.95);
        const reach = girthAt(spire, y) + random.range(0.55, 1.3);
        return out.set(spire.x + Math.cos(angle) * reach, y, spire.z + Math.sin(angle) * reach);
    };

    const birds = Array.from({ length: COUNT }, (_, index) => {
        const random = createRandom(7331 + index * 97);
        const spire = random.pick(spires);
        const at = hoverBy(random, spire, new Vector3());
        return { random, spire, from: at.clone(), to: at.clone(), start: 0, end: random.range(0.3, 2.4), darting: false };
    });

    const position = new Vector3();
    const target = new Vector3();
    const probe = new Vector3();
    const heading = new Euler(0, 0, 0, 'YXZ');
    // Once the camera's solids are known (solids.js), a dart must also keep clear of the bridges,
    // stairs and roofs the spires alone don't account for.
    let solids = null;
    mesh.userData.useSolids = (known) => {
        solids = known;
    };

    /** True if nothing solid lies on or near the dart's arc (or if the solids aren't known yet). */
    function clearOfSolids(from, to) {
        if (!solids?.available) return true;
        for (let step = 0; step <= 8; step += 1) {
            const t = step / 8;
            probe.copy(from).lerp(to, t);
            probe.y += Math.sin(Math.PI * t) * 0.35;
            if (solids.distance(probe) < (step === 8 ? 0.25 : 0.12)) return false;
        }
        return true;
    }
    const turn = new Quaternion();
    const matrix = new Matrix4();
    const one = new Vector3(1, 1, 1);

    // The steam: PUFFS a bird, each born from wherever its bird is when the last has faded.
    const steam = createSteam(COUNT * PUFFS);
    mesh.add(steam.points);
    const puffs = Array.from({ length: COUNT * PUFFS }, () => ({ origin: new Vector3(), last: Infinity }));

    /** Move a bird's puffs on: rise, swell, drift a little, and start again from the bird. */
    function breathe(index, at, time) {
        for (let puff = 0; puff < PUFFS; puff += 1) {
            const slot = index * PUFFS + puff;
            const state = puffs[slot];
            const age = ((time + (puff / PUFFS) * LIFE + index * 0.37) % LIFE) / LIFE;
            if (age < state.last) state.origin.set(at.x, at.y - 0.04, at.z);
            state.last = age;
            const rise = age * 0.5 + age * age * 0.3;
            steam.positions[slot * 3] = state.origin.x + Math.sin(slot * 1.7 + age * 3) * 0.06 * age;
            steam.positions[slot * 3 + 1] = state.origin.y + rise;
            steam.positions[slot * 3 + 2] = state.origin.z + Math.cos(slot * 2.3 + age * 2) * 0.06 * age;
            steam.ages[slot] = age;
        }
    }

    /** The next thing a bird does, once it has done the last. */
    function advance(bird) {
        const { random } = bird;
        bird.start = bird.end;
        if (bird.darting) {
            bird.darting = false;
            bird.from.copy(bird.to);
            bird.end = bird.start + random.range(0.6, 2.6);
            return;
        }
        // Mostly on to a neighbouring spire, sometimes round the same one: only where the way is clear.
        bird.from.copy(bird.to);
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const next = random() < 0.25 ? bird.spire : random.pick(spires);
            hoverBy(random, next, target);
            if (!clearPath(spires, bird.from, target) || !clearOfSolids(bird.from, target)) continue;
            bird.spire = next;
            bird.to.copy(target);
            bird.darting = true;
            bird.end = bird.start + Math.min(1.3, Math.max(0.3, bird.from.distanceTo(bird.to) / SPEED));
            return;
        }
        // No clear way just now: it hovers a while longer where it is.
        bird.end = bird.start + random.range(0.4, 1.2);
    }

    function update(time) {
        clock.value = time;
        birds.forEach((bird, index) => {
            for (let guard = 0; guard < 8 && time >= bird.end; guard += 1) advance(bird);
            const span = Math.max(1e-3, bird.end - bird.start);
            const t = Math.min(1, Math.max(0, (time - bird.start) / span));
            let yaw;
            let pitch = 0;
            if (bird.darting) {
                const s = t * t * (3 - 2 * t);
                position.copy(bird.from).lerp(bird.to, s);
                position.y += Math.sin(Math.PI * t) * 0.35;
                yaw = Math.atan2(bird.to.x - bird.from.x, bird.to.z - bird.from.z);
                pitch = -Math.atan2(bird.to.y - bird.from.y, Math.hypot(bird.to.x - bird.from.x, bird.to.z - bird.from.z)) * 0.5;
            } else {
                // Hovering: a small bob, looking at the spire it came to.
                position.copy(bird.to);
                position.y += Math.sin(time * 5.3 + index) * 0.035;
                yaw = Math.atan2(bird.spire.x - bird.to.x, bird.spire.z - bird.to.z) + Math.sin(time * 1.7 + index * 2) * 0.35;
            }
            heading.set(pitch, yaw, 0);
            matrix.compose(position, turn.setFromEuler(heading), one);
            mesh.setMatrixAt(index, matrix);
            breathe(index, position, time);
        });
        mesh.instanceMatrix.needsUpdate = true;
        steam.geometry.attributes.position.needsUpdate = true;
        steam.geometry.attributes.age.needsUpdate = true;
    }

    update(0);
    return { object: mesh, update };
}
