/**
 * stage.js — the scene and its loop.
 *
 * Builds Elysium's dusk (the sky, the fog, a low warm light from the hidden
 * sun and a cool fill off the sea), the Elysian Sea, the island, the places,
 * the wisp and the paper-theatre slot; hands the camera to a rig; and draws
 * every frame through the ink pass. With ?debug=1 it exposes renderer.info
 * for the local screenshot script and shows a small readout, for testing on a
 * phone.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    DirectionalLight,
    FogExp2,
    HemisphereLight,
    NeutralToneMapping,
    PCFShadowMap,
    PerspectiveCamera,
    Scene,
    Vector2,
    Vector3,
    WebGLRenderer,
} from 'three';
import { Buckets, createMaterials, duskLight, flutter, wallX } from './kit.js';
import { inscriptionTexture } from './extras.js';
import { HOLLOWED, createHollows, hollows } from './hollows.js';
import { createInk } from './ink.js';
import { buildIsland } from './island.js';
import { stagePaper } from './paper.js';
import { buildPlaces } from './places.js';
import { OrbitRig } from './rigs/orbit.js';
import { WALKER_GLSL, createWalk, walkerClears, walkerShadow } from './walk.js';
import { createSea } from './sea.js';
import { createSigns } from './signs.js';
import { createSky } from './sky.js';
import { createSolids } from './solids.js';
import { createWisp } from './wisp.js';

// =============================================================================
// Constants
// =============================================================================

/** The sun hangs just under the horizon, west-north-west, behind the grottos. */
const SUN_DIRECTION = new Vector3(-0.82, 0.1, -0.4).normalize();
/** Dusk light is soft and comes from everywhere; the key falls low from the south-west. */
const KEY_DIRECTION = new Vector3(-0.35, 0.5, 0.8).normalize();
const MAX_PIXEL_RATIO = 2;
/** The dusk's shadows: one map, square round the island, drawn once. */
const SHADOW_MAP = 1024;
const SHADOW_REACH = 40;
/**
 * What throws a shadow (the city's solid pieces and its cloth), and what a shadow falls on: only the
 * ground, its streets and plazas and platforms. A low dusk light across the walls and roofs themselves
 * striped them with the shadow map's own grain; across the paving it lays the long shadows cleanly.
 */
const CASTS_SHADOW = new Set(['gold', 'bricking', 'brick', 'stone', 'rock', 'steel', 'copper', 'arch', 'turquoise', 'amethyst']);
const TAKES_SHADOW = new Set(['dimGold']);
/**
 * A safety net for slower phones: if frames run slower than this (seconds) for a sustained stretch,
 * the drawing buffer steps down a quarter at a time, never below 1. It only ever steps down, so it can't
 * see-saw; a phone that keeps up never notices it.
 */
const SLOW_FRAME = 1 / 38;
const SLOW_STRETCH = 2.5;
const RATIO_STEP = 0.25;
const SETTLING = 4;

// =============================================================================
// Main Code
// =============================================================================

function createReadout() {
    const panel = document.createElement('div');
    panel.className = 'debug-readout';
    panel.setAttribute('aria-hidden', 'true');
    document.body.append(panel);
    let frames = 0;
    let seconds = 0;
    return (dt, info) => {
        frames += 1;
        seconds += dt;
        if (seconds < 0.5) return;
        panel.textContent = `${Math.round(frames / seconds)} fps · ${info.calls} calls · ${info.triangles} tris`;
        frames = 0;
        seconds = 0;
    };
}

/** Let a frame through, so the threshold keeps moving while the city is built. */
function pause() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Make the renderer early, before the city is built: the Intermaze flies on it
 * while the stage is still being assembled.
 */
export function createRenderer(canvas) {
    const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.info.autoReset = false;
    fitRenderer(renderer, canvas);
    return renderer;
}

/** Keep the drawing buffer matched to the canvas (pixel ratio capped at 2, or lower); true if it changed. */
export function fitRenderer(renderer, canvas, cap = MAX_PIXEL_RATIO) {
    const ratio = Math.min(window.devicePixelRatio || 1, cap, MAX_PIXEL_RATIO);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const size = renderer.getSize(new Vector2());
    if (renderer.getPixelRatio() === ratio && size.x === width && size.y === height) return false;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    return true;
}

/**
 * @param {object} options
 * @param {import('three').WebGLRenderer} options.renderer - from createRenderer
 * @param {HTMLCanvasElement} options.canvas
 * @param {{ places: object, paper: object, signs: object }} options.data
 * @param {boolean} options.reducedMotion
 * @param {boolean} options.debug
 * @param {() => void} [options.onLost] - called if the WebGL context is lost
 * @param {Set<string>} [options.extras] - the optional extras asked for (extras.js); none, unless asked
 */
export async function createStage({ renderer, canvas, data, reducedMotion, debug, onLost, extras = new Set() }) {
    const scene = new Scene();
    // Thin enough that the gold still shines through at the whole city's distance.
    scene.fog = new FogExp2(0x4a2c4c, 0.0024);
    const camera = new PerspectiveCamera(35, 1, 0.5, 900);

    const sky = createSky({ sunDirection: SUN_DIRECTION, inscription: extras.has('sky') ? await inscriptionTexture() : null });
    const sea = createSea({ sunDirection: SUN_DIRECTION, horizonDip: sky.horizonDip });
    scene.add(sky.mesh, sea.mesh);

    const key = new DirectionalLight(0xffd6a0, 2.5);
    key.position.copy(KEY_DIRECTION).multiplyScalar(60);
    // The dusk throws long shadows across the paving. The city stands still, so they're drawn once
    // (shadowMap.autoUpdate off): after that they cost only a look-up per pixel of ground. Shadowed
    // ground keeps the sky's lilac and the sunset's warmth, so the shadows fall cool, not black.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    key.castShadow = true;
    key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    Object.assign(key.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 1, far: 170 });
    // Offsets enough that no face shadows itself in stripes (acne), at the low angle a dusk light falls.
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.12;
    key.target.position.set(-2, 2, 0);
    scene.add(key.target);
    const sunset = new DirectionalLight(0xff9a50, 0.9);
    sunset.position.copy(SUN_DIRECTION).multiplyScalar(60);
    const seaFill = new DirectionalLight(0x8c90ff, 0.5);
    seaFill.position.set(50, 30, 25);
    const underglow = new DirectionalLight(0x8a64a8, 0.9);
    underglow.position.set(0.2, -1, 0.35).multiplyScalar(60);
    scene.add(new HemisphereLight(0x9a86c8, 0x6a4450, 0.75), key, sunset, seaFill, underglow);

    const materials = createMaterials();
    // Dusk on the city: warm edges toward the sunken sun, gold's glint, and the last light up high.
    duskLight(materials.gold, { sun: SUN_DIRECTION, rim: 0.55, shine: 0.35, tip: 0.3, tipFrom: 9, tipTo: 30 });
    duskLight(materials.bricking, { sun: SUN_DIRECTION, rim: 0.45, shine: 0.15 });
    duskLight(materials.brick, { sun: SUN_DIRECTION, rim: 0.45, tip: 0.2, tipFrom: 4, tipTo: 12 });
    duskLight(materials.stone, { sun: SUN_DIRECTION, rim: 0.4, tip: 0.28, tipFrom: 20, tipTo: 48 });
    // The rock: the island's underside, and the hanging mountain, whose peaks hold the last of the light.
    duskLight(materials.rock, { sun: SUN_DIRECTION, rim: 0.38, tip: 0.34, tipFrom: 29, tipTo: 39 });
    duskLight(materials.copper, { sun: SUN_DIRECTION, rim: 0.4, shine: 0.3 });
    const wind = { value: 0 };
    flutter(materials.turquoise, wind);
    flutter(materials.sign, wind);
    flutter(materials.weed, wind);
    const buckets = new Buckets();
    await pause();
    buildIsland(buckets);
    await pause();
    const places = await buildPlaces(buckets, data.places, materials, pause, extras, reducedMotion);
    // The sun-dock's warmth on the water round it (the dock is a half-sun unfurled from the wall).
    const dock = data.places.places.find((place) => place.id === 'sun-dock');
    if (dock) sea.warmAt(wallX(dock.position[2]) + 1.6, dock.position[2], 6.5);
    await pause();
    const meshes = buckets.build(materials, { turquoise: ['sway'], weed: ['sway'] });
    for (const mesh of meshes.values()) {
        mesh.castShadow = CASTS_SHADOW.has(mesh.name);
        mesh.receiveShadow = TAKES_SHADOW.has(mesh.name);
        scene.add(mesh);
    }
    for (const extra of places.extras) scene.add(extra);
    // Where things stand close, the dark gathers: a worker finds where, from the city as built, while the
    // flight plays (hollows.js); the materials learn to read its map now, before they're compiled.
    // Walking as the shadow (walk.js), for everyone (?walk=off leaves it out, and the shadow stays on its café
    // wall). The hollows' worker marks where the walls stand, at a body's height, for it to walk by.
    const walking = new URLSearchParams(window.location.search).get('walk') !== 'off';
    const hollowMap = createHollows(meshes, { reducedMotion, walls: walking });
    for (const key of HOLLOWED) hollows(materials[key], hollowMap);
    const walk = walking ? createWalk({ light: KEY_DIRECTION, reducedMotion }) : null;
    if (walk) {
        for (const key of [...HOLLOWED, 'rock']) walkerShadow(materials[key], walk);
        walkerClears(materials.steel, walk);
        walkerClears(materials.turquoise, walk, 1.5);
        sea.receiveWalker(WALKER_GLSL, walk.uniforms);
    }
    await pause();
    const signs = await createSigns({ data: data.signs, mounts: places.mounts, material: materials.sign, renderer });
    signs.mesh.castShadow = true;
    scene.add(signs.mesh);
    await pause();

    const wisp = createWisp({ reducedMotion });
    scene.add(wisp.object);
    const paper = await stagePaper(data.paper, places.anchors);
    scene.add(paper.group);

    const rigPlaces = new Map(data.places.places
        .filter((place) => place.tier === 1)
        .map((place) => [place.id, { position: places.anchors.get(place.id), focus: place.focus }]));
    const rig = new OrbitRig({ places: rigPlaces, reducedMotion });
    rig.attach(camera, canvas);

    const ink = createInk(renderer, { reducedMotion });

    // The drawing buffer's ceiling, lowered only if this device can't keep up (SLOW_FRAME). Under ?debug=1
    // (the local checks and the stills) it holds, so their pictures stay exact, unless ?adapt=1 asks.
    let ratioCap = MAX_PIXEL_RATIO;
    const adaptive = !debug || new URLSearchParams(window.location.search).has('adapt');
    let slowFor = 0;
    let runningFor = 0;

    function resize() {
        fitRenderer(renderer, canvas, ratioCap);
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;
        camera.aspect = width / height;
        camera.fov = camera.aspect < 0.8 ? 46 : 35;
        camera.updateProjectionMatrix();
        rig.fit(camera.aspect, camera.fov);
        ink.resize();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    rig.update(0);

    await pause();
    renderer.setRenderTarget(ink.target);
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.setRenderTarget(null);

    // What the camera may not pass through is worked out in a worker while the flight plays;
    // until it's ready, the camera orbits free.
    await pause();
    const solids = createSolids(scene);
    walk?.attach({
        rig,
        camera,
        canvas,
        solids,
        hollowMap,
        meshes,
        wallShadow: scene.getObjectByName('cafe-shadow'),
        pierEnd: places.pierEnd,
        scene,
        controls: document.querySelector('.controls'),
    });
    solids.ready.then((ok) => {
        if (!ok) return;
        rig.setSolids(solids);
        // The hums (an extra) keep clear of the city's solids too.
        scene.getObjectByName('hums')?.userData.useSolids?.(solids);
    });

    const frameListeners = [];
    const readout = debug ? createReadout() : null;
    // The shadows are drawn by the stage's own first frame (not before: the Intermaze shares the renderer,
    // and would spend the one update on a scene with no shadows in it).
    let shadowsDrawn = false;
    let running = false;
    let last = 0;
    let elapsed = 0;
    let lastInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };

    function frame(now) {
        if (!running) return;
        const real = last ? (now - last) / 1000 : 1 / 60;
        const dt = Math.min(0.05, real);
        last = now;
        if (!reducedMotion) elapsed += dt;

        // A sustained run of slow frames (not a single hitch, nor the gap a hidden tab leaves) steps the
        // drawing buffer down, once in a while, until it keeps up or reaches 1.
        runningFor += Math.min(real, 1);
        if (adaptive && runningFor > SETTLING && real < 1) {
            slowFor = real > SLOW_FRAME ? slowFor + real : Math.max(0, slowFor - real * 2);
            const current = Math.min(window.devicePixelRatio || 1, ratioCap);
            if (slowFor > SLOW_STRETCH && current > 1) {
                ratioCap = Math.max(1, current - RATIO_STEP);
                slowFor = 0;
                runningFor = 0;
                resize();
            }
        }

        renderer.info.reset();
        walk?.update(dt);
        rig.update(dt);
        sky.update(elapsed, camera);
        sea.update(elapsed);
        places.update(elapsed);
        hollowMap.update(dt);
        wisp.update(elapsed);
        paper.update(camera);
        wind.value = elapsed;
        if (!shadowsDrawn) {
            renderer.shadowMap.needsUpdate = true;
            shadowsDrawn = true;
        }
        walk?.render(renderer, elapsed);
        ink.render(scene, camera, elapsed, rig.home.radius / Math.max(rig.now.radius, 1e-3));

        const { calls, triangles, points, lines } = renderer.info.render;
        lastInfo = { calls, triangles, points, lines };
        for (const listener of frameListeners) listener(dt, elapsed);
        // The readout counts real time, so a slow device shows its true rate (dt is clamped for the animation).
        readout?.(Math.min(real, 1), lastInfo);
        requestAnimationFrame(frame);
    }

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        running = false;
        onLost?.();
    });

    const stage = {
        renderer,
        scene,
        camera,
        rig,
        anchors: places.anchors,
        signs,
        solids,
        canvas,
        /** Walking as the shadow (walk.js), where the address asks for it; else null. */
        walk,
        start() {
            if (running) return;
            running = true;
            last = 0;
            requestAnimationFrame(frame);
        },
        stop() {
            running = false;
        },
        /** Run something after every frame: (dt, elapsed) => void. */
        onFrame(listener) {
            frameListeners.push(listener);
        },
        /** Draw calls and triangles in the last whole frame (both passes). */
        info() {
            return {
                ...lastInfo,
                geometries: renderer.info.memory.geometries,
                textures: renderer.info.memory.textures,
                programs: renderer.info.programs?.length ?? 0,
            };
        },
    };

    if (debug) Object.assign(window.elysicesterDebug ??= {}, { info: () => stage.info(), rig, stage, solids, houses: places.houses, pixelRatio: () => renderer.getPixelRatio(), hollows: hollowMap, walk });
    return stage;
}
