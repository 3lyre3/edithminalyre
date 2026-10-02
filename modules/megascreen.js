/**
 * megascreen.js — the Mega-Screen, as a still shot in the Desert Eternal: a trial (trials.js), on unless
 * ?megascreen=off (then the card is the flat one it was).
 *
 * Elm: "is there any chance though that the mega screen could show up after the choice page and before the ascii
 * swirl? aaand that it could appear as a still 3d scene like the city itself / just an endless red desert / and a
 * rolling screen as tall as central station, wheeling into the shot as the letters INSERT BLUTIX roll over its
 * screen?"
 *
 * As Numbers by Paint has it (Episode 1, p. 29): E, out in "the glaring, skin-shedding wind and constant, red sunlight
 * of the Eternal", "gawking and squinting, chin high, toward the summit of the Mega-Screen"; across it, "A tremendous
 * tower rolled free, out from the right barrier of the screen. A stalwart, white needle, capped and based at equal
 * depths, structurally reckless yet daring, it flickered, and with each flicker, travelled a short distance left.
 * Another structure half-emerged, identifying the first. Letters."
 *
 * So the eye stands still, low on the sand, chin high: an endless red desert under a low red sun, nothing else; the
 * screen, on a wheeled chassis, about ninety metres to its crown, rolls in from the right, raising dust, slows, and
 * stands, rocking once on its wheels; at its foot, the control-hub, its little screen lit; and across its face the
 * enormous white letters roll in from its right edge, a short step left with each flicker. It's drawn through the
 * city's own ink (ink.js), so it reads as drawn, as the city does, the letters glowing. Under reduced motion the
 * screen is already standing, the whole of INSERT BLUTIX still on its face.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    BackSide,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    CustomBlending,
    CylinderGeometry,
    DataTexture,
    DirectionalLight,
    DstColorFactor,
    Fog,
    Group,
    HemisphereLight,
    LinearFilter,
    LinearMipmapLinearFilter,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    NearestFilter,
    PerspectiveCamera,
    PlaneGeometry,
    Points,
    RedFormat,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
    ZeroFactor,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createInk } from './ink.js';

// =============================================================================
// Constants
// =============================================================================

/** The screen's face, in metres (a unit is a metre here), and how high above the sand its foot stands. */
const FACE_WIDE = 120;
const FACE_TALL = 60;
const FACE_FOOT = 30;
/** Its frame, round the face. */
const FRAME = 2.6;
/** Where it comes to stand (its centre, on the sand), straight ahead of the eye. */
const STAND_Z = -230;
/** Its wheels: how big (each taller than a house), and where along each side of the chassis. */
const WHEEL = 8;
const WHEELS_AT = [-50, -25, 0, 25, 50];
/** The eye: a body's height above the sand. */
const EYE = 1.6;
/** How long it takes to roll in and stand (seconds), from how far right (beyond the edge of the view). */
const ROLL_SECONDS = 8.5;
/**
 * The letters: each flicker (this long), a short step left (this share of the face's height), as the book has it;
 * the letters stand this much of the face's height.
 */
const STEP_SECONDS = 0.42;
const STEP = 0.11;
const LETTERS_TALL = 0.86;
const LETTERS = 'INSERT BLUTIX';
/** The sun: low, off the screen's right shoulder, and red. */
const SUN = new Vector3(0.6, 0.165, -0.86).normalize();
/** The haze the desert goes into, and the colour of the sand; and how far off the sky is drawn. */
const HAZE = 0xd25a36;
const SAND = 0xb84a2c;
const SKY = 2000;

// =============================================================================
// Shaders
// =============================================================================

const skyVertex = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/** The red sky of the Eternal: glaring at the horizon, darkening to a deep wine overhead; the sun low, and its haze. */
const skyFragment = /* glsl */ `
    uniform vec3 sunDir;
    varying vec3 vDir;
    void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 horizon = vec3(1.1, 0.3, 0.12);
        vec3 low = vec3(0.64, 0.085, 0.055);
        vec3 high = vec3(0.14, 0.018, 0.042);
        vec3 sky = mix(horizon, low, smoothstep(-0.02, 0.15, h));
        sky = mix(sky, high, smoothstep(0.15, 0.85, h));
        float toSun = max(dot(dir, sunDir), 0.0);
        sky += vec3(1.0, 0.22, 0.07) * pow(toSun, 9.0) * 0.5;
        // The sun through the red air: a deep red disc, hot at its rim.
        float disc = smoothstep(0.99925, 0.9996, toSun);
        float rim = disc * (1.0 - smoothstep(0.99962, 0.99985, toSun));
        sky = mix(sky, vec3(0.92, 0.1, 0.045), disc);
        sky += vec3(0.9, 0.22, 0.05) * rim;
        gl_FragColor = vec4(sky, 1.0);
    }
`;

const faceVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/**
 * The face: dark glass with its scan lines and pixels, and the letters rolling across it, white-blue and bright
 * enough to glow (ink.js gathers what's brighter than white into its haze). offset: where the letters' strip begins,
 * in face heights from the face's left edge; stripWide: how wide the strip is, in face heights.
 */
const faceFragment = /* glsl */ `
    uniform sampler2D letters;
    uniform float offset;
    uniform float stripWide;
    uniform float stripTall;
    uniform float faceWide;
    uniform float flicker;
    varying vec2 vUv;
    void main() {
        vec2 at = vec2(vUv.x * faceWide, vUv.y);
        float band = (at.y - (1.0 - stripTall) * 0.5) / stripTall;
        float u = (at.x - offset) / stripWide;
        // (Read everywhere, then kept only on the strip: a mipmapped read inside a branch would draw seams.)
        float inside = step(0.0, band) * step(band, 1.0) * step(0.0, u) * step(u, 1.0);
        float ink = texture2D(letters, clamp(vec2(u, band), 0.0, 1.0)).a * inside;
        float scan = 0.7 + 0.3 * step(0.42, fract(vUv.y * 150.0));
        float pixel = 0.86 + 0.14 * step(0.3, fract(vUv.x * 300.0));
        // Dark glass, catching a little of the sky toward its top.
        vec3 dark = mix(vec3(0.02, 0.016, 0.02), vec3(0.07, 0.03, 0.035), smoothstep(0.35, 1.0, vUv.y)) * (0.8 + 0.2 * scan);
        vec3 lit = vec3(2.2, 2.32, 2.7) * flicker * scan * pixel;
        gl_FragColor = vec4(mix(dark, lit, ink), 1.0);
    }
`;

/** The wind, low over the sand: grains streaming right to left, each at its own pace. */
const windVertex = /* glsl */ `
    attribute float seed;
    uniform float time;
    uniform vec3 span;
    uniform float pixelRatio;
    varying float vFade;
    void main() {
        vec3 p = position;
        float speed = 16.0 + 14.0 * fract(seed * 7.13);
        p.x = mod(p.x - time * speed + span.x * 0.5, span.x) - span.x * 0.5;
        p.y += 0.5 * sin(time * 1.7 + seed * 21.0);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = (1.2 + 2.2 * fract(seed * 3.71)) * pixelRatio * clamp(30.0 / -view.z, 0.25, 2.0);
        vFade = smoothstep(0.5, 0.35, abs(p.x / span.x)) * (0.35 + 0.65 * fract(seed * 5.3));
    }
`;

const windFragment = /* glsl */ `
    varying float vFade;
    void main() {
        float round = 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.25, 0.62, 0.38), round * vFade * 0.55);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/** The city's four-step light ramp (kit.js), so the desert's light falls in the same bands. */
function toonRamp() {
    const steps = [0.28, 0.52, 0.78, 1];
    const texture = new DataTexture(new Uint8Array(steps.map((value) => Math.round(value * 255))), steps.length, 1, RedFormat);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

/** A geometry painted one colour (the toon materials here take their colours from the vertices, as the city's do). */
function painted(geometry, hex) {
    const color = new Color(hex);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) colors.set([color.r, color.g, color.b], index * 3);
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return geometry;
}

/** A box, painted, standing with its centre at (x, y, z). */
function block(width, height, depth, x, y, z, hex, tilt = 0) {
    const geometry = new BoxGeometry(width, height, depth);
    if (tilt) geometry.rotateZ(tilt);
    geometry.translate(x, y, z);
    return painted(geometry, hex);
}

/**
 * The letters, INSERT BLUTIX, white on nothing, spaced as the card spaced them (a tenth of a letter between letters,
 * almost half a letter between the words), in the city's display face once it's loaded.
 */
async function letterStrip() {
    const tall = 256;
    const size = Math.round(tall * 0.86);
    const font = `300 ${size}px Cormorant, Georgia, serif`;
    await Promise.race([document.fonts.load(font).catch(() => null), new Promise((resolve) => setTimeout(resolve, 1500))]);
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const gap = size * 0.1;
    const wordGap = size * 0.45;
    const widths = [...LETTERS].map((letter) => (letter === ' ' ? wordGap : measure.measureText(letter).width));
    const wide = Math.ceil(widths.reduce((sum, width) => sum + width, 0) + gap * (LETTERS.length - 1) + size * 0.2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(4096, wide);
    canvas.height = tall;
    const context = canvas.getContext('2d');
    context.font = font;
    context.fillStyle = '#ffffff';
    context.textBaseline = 'alphabetic';
    let x = size * 0.1;
    [...LETTERS].forEach((letter, index) => {
        if (letter !== ' ') context.fillText(letter, x, tall * 0.84);
        x += widths[index] + gap;
    });
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    return { texture, wide: canvas.width / canvas.height };
}

/** The screen on its chassis: what stands still on it (one geometry), each wheel (its own, to turn), and the face. */
function buildRig(material, faceMaterial) {
    const parts = [];
    const steel = 0x2b2528;
    const girder = 0x3a3135;
    const deck = 0x51413a;
    // The chassis: a long deck on its axles, girt along its sides.
    const deckTop = WHEEL + 6.4;
    parts.push(block(124, 6.2, 34, 0, WHEEL + 2.6, 0, deck));
    parts.push(block(126, 1.3, 35, 0, deckTop - 0.65, 0, steel));
    for (const side of [-1, 1]) parts.push(block(124, 1.1, 1.1, 0, WHEEL - 0.2, side * 15.5, steel));
    for (const at of WHEELS_AT) parts.push(block(3, 3, 38, at, WHEEL, 0, steel));
    // Two great legs, each braced in an A, and a spine behind the screen (it's top-heavy: "structurally reckless yet
    // daring", as the book has its letter I).
    const legTall = FACE_FOOT - FRAME - deckTop;
    const legY = deckTop + legTall / 2;
    const lean = Math.atan2(10, legTall);
    const brace = Math.hypot(10, legTall);
    for (const side of [-1, 1]) {
        parts.push(block(5.2, legTall, 5.2, side * 38, legY, -3, girder));
        parts.push(block(1.8, brace, 1.8, side * 38 - 5, legY, -3, girder, -lean));
        parts.push(block(1.8, brace, 1.8, side * 38 + 5, legY, -3, girder, lean));
    }
    parts.push(block(6, FACE_TALL * 0.92, 4, 0, FACE_FOOT + FACE_TALL * 0.46, -5, girder));
    for (const side of [-1, 1]) parts.push(block(3, FACE_TALL * 0.82, 3, side * 34, FACE_FOOT + FACE_TALL * 0.42, -5, girder));
    // The frame round the face, with a deeper bezel.
    const frameY = FACE_FOOT + FACE_TALL / 2;
    parts.push(block(FACE_WIDE + FRAME * 2, FRAME, 4, 0, FACE_FOOT - FRAME / 2, 0, steel));
    parts.push(block(FACE_WIDE + FRAME * 2, FRAME, 4, 0, FACE_FOOT + FACE_TALL + FRAME / 2, 0, steel));
    for (const side of [-1, 1]) parts.push(block(FRAME, FACE_TALL, 4, side * (FACE_WIDE / 2 + FRAME / 2), frameY, 0, steel));
    parts.push(block(FACE_WIDE, FACE_TALL, 2.2, 0, frameY, -0.9, 0x111015));
    // Little lamps along its crown.
    for (let index = -5; index <= 5; index += 1) parts.push(block(1.4, 1.1, 1.4, index * 11, FACE_FOOT + FACE_TALL + FRAME + 0.55, 0, 0x8a2a20));
    // The control-hub at its foot, where the blutix is tapped (the book: "Inside the control-hub, a smaller, more
    // ergonomic (read: newer) screen said: Tap blutix here."): a booth on the deck, its little screen lit inside.
    parts.push(block(11, 7.5, 9, -50, deckTop + 3.75, 9, girder));
    parts.push(block(12.4, 0.9, 10.4, -50, deckTop + 7.95, 9, steel));
    const body = new Mesh(mergeGeometries(parts, false), material);

    const face = new Mesh(new PlaneGeometry(FACE_WIDE, FACE_TALL), faceMaterial);
    face.position.set(0, frameY, 0.25);
    const hubScreen = new Mesh(new PlaneGeometry(5.2, 3.2), new MeshBasicMaterial({ color: new Color(1.5, 1.62, 1.95), fog: false }));
    hubScreen.position.set(-50, deckTop + 4.4, 13.56);

    // The wheels: a tyre, a hub, five spokes on its outer face, so they're seen to turn. (Built with the axle upright,
    // then stood on edge, the axle along the chassis's depth, the spokes toward the eye.)
    const wheels = [];
    for (const at of WHEELS_AT) {
        for (const side of [-1, 1]) {
            const pieces = [painted(new CylinderGeometry(WHEEL, WHEEL, 3.4, 30), 0x1d1719)];
            pieces.push(painted(new CylinderGeometry(WHEEL * 0.4, WHEEL * 0.4, 3.9, 18), 0x8d7a68));
            for (let spoke = 0; spoke < 5; spoke += 1) {
                const bar = new BoxGeometry(WHEEL * 0.84, 0.5, 0.95);
                bar.translate(WHEEL * 0.42, 1.95, 0);
                bar.rotateY((spoke / 5) * Math.PI * 2);
                pieces.push(painted(bar, 0x6c5d52));
            }
            const geometry = mergeGeometries(pieces, false);
            geometry.rotateX(Math.PI / 2);
            const wheel = new Mesh(geometry, material);
            wheel.position.set(at, WHEEL, side * 19.2);
            if (side < 0) wheel.rotation.y = Math.PI;
            wheels.push(wheel);
        }
    }

    // Its shade pooled on the sand beneath it (the sand keeps no depth, so this is laid over it, darkening it).
    const pool = new Mesh(new PlaneGeometry(150, 64), new ShaderMaterial({
        vertexShader: faceVertex,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vec2 at = (vUv - 0.5) * 2.0;
                float shade = 1.0 - smoothstep(0.35, 1.0, length(at * vec2(1.0, 1.15)));
                gl_FragColor = vec4(vec3(1.0 - 0.55 * shade), 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: DstColorFactor,
        blendDst: ZeroFactor,
        fog: false,
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-6, 0.05, 10);
    pool.renderOrder = -0.25;

    const rig = new Group();
    rig.add(pool, body, face, hubScreen, ...wheels);
    return { rig, wheels };
}

/** The dust its wheels raise as it rolls: drifting up and back, reddening the air, then gone. */
function createWheelDust(pixelRatio) {
    const count = 220;
    const position = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const lived = new Float32Array(count);
    const alpha = new Float32Array(count);
    const size = new Float32Array(count);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('alpha', new BufferAttribute(alpha, 1));
    geometry.setAttribute('size', new BufferAttribute(size, 1));
    const points = new Points(geometry, new ShaderMaterial({
        uniforms: { pixelRatio: { value: pixelRatio } },
        vertexShader: /* glsl */ `
            attribute float alpha;
            attribute float size;
            uniform float pixelRatio;
            varying float vAlpha;
            void main() {
                vec4 view = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * view;
                gl_PointSize = size * pixelRatio * (220.0 / max(-view.z, 1.0));
                vAlpha = alpha;
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vAlpha;
            void main() {
                float soft = 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5));
                gl_FragColor = vec4(0.82, 0.32, 0.17, soft * vAlpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        fog: false,
    }));
    points.frustumCulled = false;
    let next = 0;
    let owed = 0;
    return {
        points,
        /** dt: seconds; rigX, speed: where the rig is and how fast it rolls (world units, per second). */
        update(dt, rigX, speed) {
            owed += Math.min(Math.abs(speed), 80) * 0.9 * dt;
            while (owed >= 1) {
                owed -= 1;
                const at = next;
                next = (next + 1) % count;
                const wheel = WHEELS_AT[Math.floor(Math.random() * WHEELS_AT.length)];
                position.set([rigX + wheel + (Math.random() - 0.3) * WHEEL * 1.4, 0.4 + Math.random() * 1.2, STAND_Z + 21 + Math.random() * 4], at * 3);
                velocity.set([-speed * 0.06 + (Math.random() - 0.5) * 3, 2.5 + Math.random() * 4, (Math.random() - 0.3) * 2.5], at * 3);
                life[at] = 1.6 + Math.random() * 1.6;
                lived[at] = 0;
            }
            for (let index = 0; index < count; index += 1) {
                if (life[index] <= 0) {
                    alpha[index] = 0;
                    continue;
                }
                lived[index] += dt;
                const share = lived[index] / life[index];
                if (share >= 1) {
                    life[index] = 0;
                    alpha[index] = 0;
                    continue;
                }
                for (let axis = 0; axis < 3; axis += 1) position[index * 3 + axis] += velocity[index * 3 + axis] * dt;
                velocity[index * 3 + 1] *= 1 - 0.9 * dt;
                alpha[index] = 0.5 * Math.sin(Math.PI * Math.min(1, share * 1.6)) * (1 - share);
                size[index] = 6 + 18 * share;
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.alpha.needsUpdate = true;
            geometry.attributes.size.needsUpdate = true;
        },
    };
}

/**
 * Show the Mega-Screen on the page's canvas while `showing()` holds; then let the canvas go, and free all it drew with.
 * Resolves once it's stopped (or at once, if it can't be drawn).
 * @param {object} options
 * @param {import('three').WebGLRenderer} options.renderer - the page's own
 * @param {() => void} options.fit - keeps the renderer sized to its canvas
 * @param {boolean} options.reducedMotion - it stands already, its letters still
 * @param {() => boolean} options.showing - whether the card is still up
 * @param {() => void} [options.onShown] - its first frame is on the canvas
 */
export async function showMegaScreen({ renderer, fit, reducedMotion, showing, onShown }) {
    if (!showing()) return;
    const strip = await letterStrip();
    if (!showing()) {
        strip.texture.dispose();
        return;
    }
    const gradientMap = toonRamp();
    const scene = new Scene();
    scene.fog = new Fog(HAZE, 300, 1700);
    scene.background = new Color(HAZE);

    const sky = new Mesh(new SphereGeometry(SKY, 40, 20), new ShaderMaterial({
        uniforms: { sunDir: { value: SUN } },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
    }));
    sky.renderOrder = -1;
    scene.add(sky);

    // The desert: a pan of sand as far as the haze, its horizon one clean line (any swell in it would turn its light
    // from one of the toon's steps to the next, in dark patches); its ripples and swathes are in its colour.
    const ground = new PlaneGeometry(SKY * 2.2, SKY * 2.2, 8, 8);
    ground.rotateX(-Math.PI / 2);
    const sandMaterial = new MeshToonMaterial({ color: SAND, gradientMap });
    // The wind's ripples across the sand: fine, and fading out where they'd grow finer than the eye can hold.
    sandMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSandWorld;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vSandWorld;')
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                'float rippleAt = dot(vSandWorld.xz, vec2(0.93, 0.36)) * 1.7 + 0.8 * sin(vSandWorld.z * 0.19 + vSandWorld.x * 0.04);',
                'float ripple = (0.5 + 0.5 * sin(rippleAt)) * (1.0 - smoothstep(0.5, 2.2, fwidth(rippleAt)));',
                'diffuseColor.rgb *= 1.0 - 0.1 * ripple;',
                // (And broad, wind-scoured paler swathes.)
                'float swathe = sin(vSandWorld.x * 0.011 + sin(vSandWorld.z * 0.007) * 2.0) * sin(vSandWorld.z * 0.009 + 1.7);',
                'diffuseColor.rgb *= 0.95 + 0.1 * swathe;',
            ].join('\n'));
    };
    // (It keeps no depth: the ink, reading the depth for its lines a fraction of a pixel apart, would find false folds
    // in a plain seen edge-on toward the horizon, and hatch them in blots. What stands on it is still outlined.)
    sandMaterial.depthWrite = false;
    const sand = new Mesh(ground, sandMaterial);
    sand.renderOrder = -0.5;
    scene.add(sand);

    const rigMaterial = new MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap });
    // (Still, under reduced motion, the whole of INSERT BLUTIX stands on the face at once, smaller.)
    const faceWide = FACE_WIDE / FACE_TALL;
    const stripTall = reducedMotion ? Math.min(LETTERS_TALL, (faceWide * 0.88) / strip.wide) : LETTERS_TALL;
    const faceUniforms = {
        letters: { value: strip.texture },
        offset: { value: 0 },
        stripWide: { value: strip.wide * stripTall },
        stripTall: { value: stripTall },
        faceWide: { value: faceWide },
        flicker: { value: 1 },
    };
    const faceMaterial = new ShaderMaterial({ uniforms: faceUniforms, vertexShader: faceVertex, fragmentShader: faceFragment, fog: false });
    const { rig, wheels } = buildRig(rigMaterial, faceMaterial);
    scene.add(rig);
    const dust = reducedMotion ? null : createWheelDust(renderer.getPixelRatio());
    if (dust) scene.add(dust.points);

    const sunLight = new DirectionalLight(0xff6a3e, 2.3);
    sunLight.position.copy(SUN).multiplyScalar(500);
    scene.add(sunLight, new HemisphereLight(0xff7656, 0x4c150f, 1.05));

    // The wind, low over the sand between the eye and the screen.
    const windCount = reducedMotion ? 0 : 260;
    let wind = null;
    if (windCount) {
        const span = new Vector3(260, 6, 200);
        const points = new Float32Array(windCount * 3);
        const seeds = new Float32Array(windCount);
        for (let index = 0; index < windCount; index += 1) {
            points.set([(Math.random() - 0.5) * span.x, Math.random() * span.y * 0.5, -Math.random() * span.z - 4], index * 3);
            seeds[index] = Math.random();
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(points, 3));
        geometry.setAttribute('seed', new BufferAttribute(seeds, 1));
        wind = new Points(geometry, new ShaderMaterial({
            uniforms: { time: { value: 0 }, span: { value: span }, pixelRatio: { value: renderer.getPixelRatio() } },
            vertexShader: windVertex,
            fragmentShader: windFragment,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            fog: false,
        }));
        wind.frustumCulled = false;
        scene.add(wind);
    }

    // (Its near and far kept as close as the shot allows: the ink reads the depth between them for its lines, and a
    // deep range would let it find edges in the noise of the far sand.)
    const camera = new PerspectiveCamera(40, 1, 2, SKY * 1.2);
    const ink = createInk(renderer, { reducedMotion });
    const size = new Vector2();
    let startX = 200;
    /**
     * Frame the shot for the screen's shape: close, wide and chin high on a wide screen, the desert below and the
     * crown near the top; on a tall one, further back and level, its sides running out past the edges.
     */
    function frame() {
        renderer.getDrawingBufferSize(size);
        const aspect = size.x / Math.max(1, size.y);
        const tall = aspect < 0.8;
        camera.aspect = aspect;
        camera.fov = tall ? 64 : 54;
        const halfAcross = Math.atan(Math.tan(MathUtils.degToRad(camera.fov / 2)) * aspect);
        const distance = tall ? 255 : 128;
        const top = Math.atan((FACE_FOOT + FACE_TALL + FRAME + 1.2 - EYE) / distance);
        const pitch = Math.max(MathUtils.degToRad(tall ? 5 : 0), top - MathUtils.degToRad(camera.fov / 2) + MathUtils.degToRad(camera.fov * 0.075));
        camera.position.set(0, EYE, STAND_Z + distance);
        camera.lookAt(0, EYE + Math.tan(pitch) * distance, STAND_Z);
        camera.updateProjectionMatrix();
        startX = Math.tan(halfAcross) * distance + FACE_WIDE / 2 + FRAME + 24;
        ink.resize();
    }
    fit();
    frame();
    renderer.setRenderTarget(ink.target);
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.setRenderTarget(null);

    // Rolling in: braking all the way, the wheels turning as far as it goes, its tall crown pressing on while it slows
    // and rocking back once it stands (a spring at its foot).
    let lean = 0;
    let leanSpeed = 0;
    let began = null;
    let last = null;
    let shown = false;
    const progress = (t) => MathUtils.clamp(t / ROLL_SECONDS, 0, 1);
    const rollAt = (t) => (reducedMotion ? 0 : startX * (1 - progress(t)) ** 2);
    const brakingAt = (t) => (reducedMotion || progress(t) >= 1 ? 0 : (2 * startX) / ROLL_SECONDS ** 2);
    // (Once it stands, it's drawn on every other frame: the letters step and the grains drift, no faster. Under reduced
    // motion nothing moves, so it's drawn only when the canvas changes.)
    let frames = 0;
    let drawnStill = 0;
    await new Promise((resolve) => {
        const step = (now) => {
            if (!showing()) {
                resolve();
                return;
            }
            began ??= now;
            const t = (now - began) / 1000;
            frames += 1;
            const resized = fit();
            if (resized) {
                frame();
                drawnStill = 0;
            }
            if (reducedMotion ? drawnStill >= 3 : t > ROLL_SECONDS + 2 && frames % 2 === 1) {
                requestAnimationFrame(step);
                return;
            }
            drawnStill += 1;
            const dt = last === null ? 1 / 60 : Math.min(0.05, Math.max(1e-3, (now - last) / 1000));
            last = now;
            const x = rollAt(t);
            dust?.update(dt, x, (x - rig.position.x) / dt);
            rig.position.set(x, 0, STAND_Z);
            for (const wheel of wheels) wheel.rotation.z = -x / WHEEL;
            if (!reducedMotion) {
                leanSpeed += (-24 * lean - 2.4 * leanSpeed + brakingAt(t) * 0.055) * dt;
                lean += leanSpeed * dt;
                rig.rotation.z = MathUtils.clamp(lean, -0.03, 0.03);
            }
            // The letters: in from the face's right edge, a step left with each flicker, round and round.
            const travel = faceWide + faceUniforms.stripWide.value;
            if (reducedMotion) {
                faceUniforms.offset.value = (faceWide - faceUniforms.stripWide.value) / 2;
                faceUniforms.flicker.value = 1;
            } else {
                const steps = Math.floor(t / STEP_SECONDS);
                const through = (steps * STEP) % (travel + STEP * 4);
                faceUniforms.offset.value = faceWide - through;
                faceUniforms.flicker.value = (t / STEP_SECONDS) % 1 < 0.2 ? 0.62 : 1;
            }
            if (wind) wind.material.uniforms.time.value = t;
            sky.position.copy(camera.position);
            ink.render(scene, camera, t, 1);
            if (!shown) {
                shown = true;
                onShown?.();
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });

    // Let the canvas go: free everything it drew with.
    ink.dispose();
    scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) for (const material of [].concat(object.material)) material.dispose();
    });
    strip.texture.dispose();
    gradientMap.dispose();
}
