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
    PerspectiveCamera,
    Scene,
    Vector2,
    Vector3,
    WebGLRenderer,
} from 'three';
import { Buckets, createMaterials, flutter } from './kit.js';
import { inscriptionTexture } from './extras.js';
import { createInk } from './ink.js';
import { buildIsland } from './island.js';
import { stagePaper } from './paper.js';
import { buildPlaces } from './places.js';
import { OrbitRig } from './rigs/orbit.js';
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

/** Keep the drawing buffer matched to the canvas (pixel ratio capped at 2); true if it changed. */
export function fitRenderer(renderer, canvas) {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
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
    scene.fog = new FogExp2(0x3a2440, 0.0034);
    const camera = new PerspectiveCamera(35, 1, 0.5, 900);

    const edge = data.places.places.find((place) => place.id === 'edge');
    const sky = createSky({ sunDirection: SUN_DIRECTION, inscription: extras.has('sky') ? await inscriptionTexture() : null });
    const sea = createSea({ sunDirection: SUN_DIRECTION, edgeAngle: Math.atan2(edge.position[2], edge.position[0]) });
    scene.add(sky.mesh, sea.mesh);

    const key = new DirectionalLight(0xffd6a0, 2.5);
    key.position.copy(KEY_DIRECTION).multiplyScalar(60);
    const sunset = new DirectionalLight(0xff9a50, 0.9);
    sunset.position.copy(SUN_DIRECTION).multiplyScalar(60);
    const seaFill = new DirectionalLight(0x8c90ff, 0.5);
    seaFill.position.set(50, 30, 25);
    const underglow = new DirectionalLight(0x8a64a8, 0.9);
    underglow.position.set(0.2, -1, 0.35).multiplyScalar(60);
    scene.add(new HemisphereLight(0x9a86c8, 0x6a4450, 0.75), key, sunset, seaFill, underglow);

    const materials = createMaterials();
    const wind = { value: 0 };
    flutter(materials.turquoise, wind);
    flutter(materials.sign, wind);
    const buckets = new Buckets();
    await pause();
    buildIsland(buckets);
    await pause();
    const places = await buildPlaces(buckets, data.places, materials, pause, extras, reducedMotion);
    await pause();
    for (const mesh of buckets.build(materials, { turquoise: ['sway'] }).values()) scene.add(mesh);
    for (const extra of places.extras) scene.add(extra);
    await pause();
    const signs = await createSigns({ data: data.signs, mounts: places.mounts, material: materials.sign, renderer });
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

    function resize() {
        fitRenderer(renderer, canvas);
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
    solids.ready.then((ok) => {
        if (ok) rig.setSolids(solids);
    });

    const frameListeners = [];
    const readout = debug ? createReadout() : null;
    let running = false;
    let last = 0;
    let elapsed = 0;
    let lastInfo = { calls: 0, triangles: 0, points: 0, lines: 0 };

    function frame(now) {
        if (!running) return;
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
        last = now;
        if (!reducedMotion) elapsed += dt;

        renderer.info.reset();
        rig.update(dt);
        sky.update(elapsed, camera);
        sea.update(elapsed);
        places.update(elapsed);
        wisp.update(elapsed);
        paper.update(camera);
        wind.value = elapsed;
        ink.render(scene, camera, elapsed);

        const { calls, triangles, points, lines } = renderer.info.render;
        lastInfo = { calls, triangles, points, lines };
        for (const listener of frameListeners) listener(dt, elapsed);
        readout?.(dt, lastInfo);
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

    if (debug) Object.assign(window.elysicesterDebug ??= {}, { info: () => stage.info(), rig, stage, solids, houses: places.houses });
    return stage;
}
