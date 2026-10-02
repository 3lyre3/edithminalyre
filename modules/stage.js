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
import { createDust, INSIDE_LAYER } from './dust.js';
import { Buckets, breathe, createMaterials, duskLight, flutter, wallX } from './kit.js';
import { inscriptionTexture } from './extras.js';
import { HOLLOWED, createHollows, hollows } from './hollows.js';
import { NIMBLE, createInk } from './ink.js';
import { buildIsland } from './island.js';
import { stagePaper } from './paper.js';
import { buildPlaces } from './places.js';
import { OrbitRig } from './rigs/orbit.js';
import { WALKER_GLSL, createWalk, walkerClears, walkerShadow } from './walk.js';
import { createSea } from './sea.js';
import { createGuides } from './guides.js';
import { createSigns } from './signs.js';
import { createSky } from './sky.js';
import { createSolids } from './solids.js';
import { trialOn } from './trials.js';
import { createWisp } from './wisp.js';

// =============================================================================
// Constants
// =============================================================================

/** The sun hangs just under the horizon, west-north-west, behind the grottos. */
const SUN_DIRECTION = new Vector3(-0.82, 0.1, -0.4).normalize();
/** Dusk light is soft and comes from everywhere; the key falls low from the south-west. */
const KEY_DIRECTION = new Vector3(-0.35, 0.5, 0.8).normalize();
/** The drawing buffer's pixels to each of the page's, at the most: two; on a touch screen, drawn lighter, one and a half. */
const MAX_PIXEL_RATIO = NIMBLE ? 1.5 : 2;
/** The dusk's shadows: one map, square round the island, drawn once. */
const SHADOW_MAP = 1024;
const SHADOW_REACH = 40;
/**
 * What throws a shadow (the city's solid pieces and its cloth), and what a shadow falls on: only the
 * ground, its streets and plazas and platforms. A low dusk light across the walls and roofs themselves
 * striped them with the shadow map's own grain; across the paving it lays the long shadows cleanly.
 */
const CASTS_SHADOW = new Set(['gold', 'bricking', 'brick', 'stone', 'rock', 'steel', 'copper', 'arch', 'turquoise', 'amethyst', 'bridge', 'cloth', 'green', 'weed']);
const TAKES_SHADOW = new Set(['dimGold', 'green', 'sand']);
/**
 * What comes apart into gold dust where the camera passes (a trial, dust.js; ?dust=off): everything in the city,
 * the paving's steps, posts and edges, the rock and the golden bridges too, so nothing is left standing inside what
 * has come apart; and the dust of each lingers in its shape. (Floors at or below the shadow's level stay: dust.js.)
 */
const DUST_DISSOLVES = ['gold', 'bricking', 'dimGold', 'brick', 'stone', 'rock', 'steel', 'copper', 'turquoise', 'weed', 'amethyst', 'glass', 'arch', 'cloth', 'green', 'sign', 'glow', 'bridge', 'sand'];
/** And what's drawn with materials of its own: what's laid on the cafés' walls, the hums, the paper. */
const DUST_ON_WALLS = ['cafe-shadow', 'footlight-wash', 'hums', 'paper', 'hostel', 'cassandra', 'cassandra-faces', 'ball'];
/**
 * A safety net for slower phones: if frames run slower than this (seconds) for a sustained stretch,
 * the drawing buffer steps down a quarter at a time, never below 1. It only ever steps down, so it can't
 * see-saw; a phone that keeps up never notices it. (On a touch screen, drawn lighter, it looks sooner and
 * steps sooner.)
 */
const SLOW_FRAME = 1 / 38;
const SLOW_STRETCH = NIMBLE ? 1.5 : 2.5;
const RATIO_STEP = 0.25;
const SETTLING = NIMBLE ? 2 : 4;

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
 * Compile every program the scene could need, and send every texture it draws with to the screen, now, while the
 * way in plays: what's hidden at this moment (the ball's insides, the dust's lingering squares and insides, the givers
 * far off) is shown for the compiling and hidden again, so nothing is compiled or sent the first time it comes into
 * sight (a frame held a quarter of a second or more: 3 Oct, the sand, as the hum took off). Piece by piece, letting the
 * way in move between (a slow phone spent a second on it at a stretch, its Mega-Screen stuck): but a piece holding a
 * light goes with the whole scene at the end, as three counts the lights of what it's given besides the scene's, and a
 * light counted twice would compile a program for a light that isn't there.
 */
async function prepareAll(renderer, scene, camera, target) {
    const hidden = [];
    scene.traverse((object) => {
        if (!object.visible) {
            hidden.push(object);
            object.visible = true;
        }
    });
    const textures = new Set();
    scene.traverse((object) => {
        for (const material of [].concat(object.material ?? [])) {
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            for (const uniform of Object.values(material.uniforms ?? {})) if (uniform?.value?.isTexture) textures.add(uniform.value);
        }
    });
    for (const texture of textures) renderer.initTexture(texture);
    const holdsLight = (piece) => {
        let found = false;
        piece.traverse((object) => { found ||= Boolean(object.isLight); });
        return found;
    };
    try {
        for (const piece of [...scene.children]) {
            if (holdsLight(piece)) continue;
            // (Into the target the city is drawn into, every time: between breaths the way in draws on the screen, and
            // a program is made for where it's drawn.)
            renderer.setRenderTarget(target);
            renderer.compile(piece, camera, scene);
            await breathe();
        }
        renderer.setRenderTarget(target);
        if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
        else renderer.compile(scene, camera);
    } finally {
        renderer.setRenderTarget(null);
        for (const object of hidden) object.visible = false;
    }
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

/**
 * The canvas's size on the page, kept by a watcher rather than asked of the page every frame (asking makes the page
 * lay itself out again whenever anything on it has changed: a quarter of a second of a slow phone's loading, 3 Oct).
 */
const canvasSizes = new WeakMap();
function canvasSize(canvas) {
    let size = canvasSizes.get(canvas);
    if (!size) {
        size = { width: canvas.clientWidth, height: canvas.clientHeight };
        canvasSizes.set(canvas, size);
        new ResizeObserver(([entry]) => {
            size.width = entry.contentRect.width;
            size.height = entry.contentRect.height;
        }).observe(canvas);
    }
    return { width: Math.round(size.width) || window.innerWidth, height: Math.round(size.height) || window.innerHeight };
}

/** Keep the drawing buffer matched to the canvas (pixel ratio capped at 2, or lower); true if it changed. */
export function fitRenderer(renderer, canvas, cap = MAX_PIXEL_RATIO) {
    const ratio = Math.min(window.devicePixelRatio || 1, cap, MAX_PIXEL_RATIO);
    const { width, height } = canvasSize(canvas);
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
    // (It draws the insides too, where the dust opens the city: on a layer of their own, dust.js.)
    camera.layers.enable(INSIDE_LAYER);

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
    // Where the camera passes, the city comes apart into gold dust (a trial: ?dust=off), and what comes apart shows
    // its inside pure black, not empty (a trial too: ?inside=off).
    const dust = trialOn('dust') ? createDust({ reducedMotion, inside: trialOn('inside') }) : null;
    if (dust) for (const key of DUST_DISSOLVES) dust.dissolve(materials[key]);
    const buckets = new Buckets();
    await pause();
    buildIsland(buckets);
    await pause();
    const places = await buildPlaces(buckets, data.places, materials, pause, extras, reducedMotion);
    // The sun-dock's warmth on the water round it (the dock is a half-sun unfurled from the wall).
    const dock = data.places.places.find((place) => place.id === 'sun-dock');
    if (dock) sea.warmAt(wallX(dock.position[2]) + 1.8, dock.position[2], 7.2);
    await pause();
    const meshes = await buckets.buildBreathing(materials, { turquoise: ['sway'], weed: ['sway'] });
    for (const mesh of meshes.values()) {
        mesh.castShadow = CASTS_SHADOW.has(mesh.name);
        mesh.receiveShadow = TAKES_SHADOW.has(mesh.name);
        scene.add(mesh);
    }
    for (const extra of places.extras) scene.add(extra);
    // The golden bridges' dust, drawn over them where they come apart (places.js): only while walking, or while
    // the camera is among them, as it's nowhere else. (Where the whole city comes apart, a trial, their dust
    // lingers as everything's does instead: dust.js.)
    let bridgeDust = null;
    let bridgeReach = null;
    if (!dust && places.bridgeDust && meshes.get('bridge')) {
        const bridgeGeometry = meshes.get('bridge').geometry;
        bridgeGeometry.computeBoundingBox();
        bridgeReach = bridgeGeometry.boundingBox.clone().expandByScalar(3.2);
        bridgeDust = places.bridgeDust(bridgeGeometry);
        bridgeDust.visible = false;
        scene.add(bridgeDust);
    }
    // Where things stand close, the dark gathers: a worker finds where, from the city as built, while the
    // flight plays (hollows.js); the materials learn to read its map now, before they're compiled.
    // Walking as the shadow (walk.js), for everyone (?walk=off leaves it out, and the shadow stays on its café
    // wall). The hollows' worker marks where the walls stand, at a body's height, for it to walk by.
    const walking = new URLSearchParams(window.location.search).get('walk') !== 'off';
    // (Flying as a hum, a trial, the worker marks the walls at the hum's height as well: walk.js, hum.js.)
    const hollowMap = createHollows(meshes, { reducedMotion, walls: walking, flight: walking && trialOn('hum') });
    for (const key of HOLLOWED) hollows(materials[key], hollowMap);
    const walk = walking ? createWalk({ light: KEY_DIRECTION, reducedMotion, gradientMap: materials.gold.gradientMap }) : null;
    // (The hum you fly as, drawn in the city from the first, so its bronze is compiled with the rest.)
    if (walk?.bird) scene.add(walk.bird);
    // (Cassandra's doorway, where her shadow stands: a body goes round, not in. A trial: places.js.)
    if (walk && places.cassandra) walk.standsIn(places.cassandra.bars.x, places.cassandra.bars.z, places.cassandra.bars.radius);
    // (The charity ball's speech, while it's given, is taken in by the walking camera along with the walker: places.js.)
    if (walk && places.ball) places.ball.onWatch = (point) => walk.watch(point);
    if (walk) {
        for (const key of [...HOLLOWED, 'rock']) walkerShadow(materials[key], walk);
        walkerClears(materials.steel, walk);
        walkerClears(materials.turquoise, walk, 1.5);
        sea.receiveWalker(WALKER_GLSL, walk.uniforms);
        // The sun-dock is light on the water: where the shadow stands on it, its silhouette is cut from the light.
        if (places.sunLight) Object.assign(places.sunLight.material.uniforms, walk.uniforms);
    }
    await pause();
    const signs = await createSigns({ data: data.signs, mounts: places.mounts, material: materials.sign, renderer });
    signs.mesh.castShadow = true;
    scene.add(signs.mesh);
    // The jetty's signs, in Elm's words (a trial: guides.js), where places.js mounted them (the pinch sign on a touch
    // screen only).
    const guides = await createGuides({ mounts: places.mounts, gradientMap: materials.gold.gradientMap, renderer });
    if (guides) {
        scene.add(guides.mesh);
        dust?.dissolve(guides.mesh.material);
    }
    await pause();

    const wisp = createWisp({ reducedMotion });
    scene.add(wisp.object);
    const paper = await stagePaper(data.paper, places.anchors);
    scene.add(paper.group);
    // (What's drawn with materials of its own comes apart too, once it's all in the scene: dust.js.)
    if (dust) {
        const own = new Set();
        for (const name of DUST_ON_WALLS) scene.getObjectByName(name)?.traverse((object) => object.isMesh && own.add(object.material));
        for (const material of own) dust.dissolve(material);
        // And where anything comes apart, its dust lingers in its shape (Elm's "original vision for all of it").
        const lingers = DUST_DISSOLVES.map((key) => meshes.get(key)).filter(Boolean);
        if (signs.mesh) lingers.push(signs.mesh);
        if (guides?.mesh) lingers.push(guides.mesh);
        scene.add(await dust.linger(lingers, wind));
        // And their insides, black where the dust opens them while walking (a trial: ?inside=off), drawn only about
        // the openings: the city's still pieces in squares, the places' own pieces each whole.
        scene.add(await dust.insides(lingers, scene));
    }

    const rigPlaces = new Map(data.places.places
        .filter((place) => place.tier === 1 && places.anchors.has(place.id))
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
    // (Walking or not, the same programs: what the dust opens shows its inside by copies of its own, dust.js.)
    await prepareAll(renderer, scene, camera, ink.target);

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
        floors: places.floors,
        // (Where the whole city comes apart, the bridges do as everything does, so their own sight line isn't kept.)
        bridgeSight: dust ? null : places.bridgeSight,
        dustSight: dust?.sight ?? null,
        dustTargets: dust?.targets ?? null,
        dustNear: dust?.near ?? null,
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
    let next = 0;
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
        // (The walker keeps its pace on a slow screen, down to ten frames a second, in steps no longer than the rest.)
        walk?.update(dt, Math.min(0.1, real));
        rig.update(dt);
        sky.update(elapsed, camera);
        sea.update(elapsed);
        places.update(elapsed);
        places.hostelDoor?.update(dt, walk?.state);
        places.cassandra?.update(dt, walk?.state);
        places.ball?.update(dt, walk?.state, camera);
        dust?.update(elapsed);
        dust?.cull(camera);
        hollowMap.update(dt);
        wisp.update(elapsed);
        paper.update(camera);
        wind.value = elapsed;
        if (!shadowsDrawn) {
            renderer.shadowMap.needsUpdate = true;
            shadowsDrawn = true;
        }
        walk?.render(renderer, elapsed);
        if (bridgeDust) bridgeDust.visible = Boolean(walk?.state.walking) || bridgeReach.containsPoint(camera.position);
        // (Walking, what the dust opens shows its inside black: dust.js. Only while the city is drawn.)
        dust?.showInsides(Boolean(walk?.state.walking));
        ink.render(scene, camera, elapsed, rig.home.radius / Math.max(rig.now.radius, 1e-3));
        dust?.showInsides(false);

        const { calls, triangles, points, lines } = renderer.info.render;
        lastInfo = { calls, triangles, points, lines };
        for (const listener of frameListeners) listener(dt, elapsed);
        // The readout counts real time, so a slow device shows its true rate (dt is clamped for the animation).
        readout?.(Math.min(real, 1), lastInfo);
        next = requestAnimationFrame(frame);
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
        /** The jetty's signs (a trial: guides.js), or null. */
        guides,
        solids,
        canvas,
        /** Walking as the shadow (walk.js), where the address asks for it; else null. */
        walk,
        /** What a touch may find in the city, and the words each opens (places.js; touch.js reads it). */
        touch: places.touch,
        /** Cassandra's house (a trial): its door's scene, for main.js to give its sounds and her words; or null. */
        cassandra: places.cassandra,
        /** The charity ball (a trial): its scene, for main.js to give its sounds and the words; or null. */
        ball: places.ball,
        /**
         * Resolves (true) once the walls are laid, the hollows' worker done with the city as built (hollows.js): what
         * lies on the ground and climbs a wall where one catches it can then find them (walk.wallAt).
         */
        wallsReady: hollowMap.ready,
        /** The city's toon steps, for what's drawn later in its light (creatures.js). */
        gradientMap: materials.gold.gradientMap,
        /**
         * The top of a surface drawn above the walk's floor at (x, z), that a shade lies on (places.js: the Steel
         * Garden's disc), or null where there's none.
         */
        surfaceAt(x, z) {
            for (const surface of places.surfaces ?? []) {
                const height = surface.surfaceAt(x, z);
                if (height !== null) return height;
            }
            return null;
        },
        /** The way to the light the shadows fall from: the walk's (flying as a hum, its higher sun), else the key light. */
        shadowLight: walk?.light ?? KEY_DIRECTION.clone(),
        /**
         * Take in what's built after the city (the givers: creatures.js): into the scene, its materials taught to
         * come apart in the dust as the city's do, its textures sent to the screen and its materials compiled before
         * it's first seen (so the city isn't called ready while any of it is still being drawn: the swirl's last
         * frames, and the city's first, wait for nothing).
         * @param {{ objects: import('three').Object3D[], materials: import('three').Material[], textures?: import('three').Texture[] }} more
         */
        async adopt({ objects, materials: own, textures = [] }) {
            for (const object of objects) scene.add(object);
            // (Not buildings: their insides aren't shown.)
            if (dust) for (const material of own) dust.dissolve(material, { solid: false });
            for (const texture of textures) renderer.initTexture(texture);
            await prepareAll(renderer, scene, camera, ink.target);
        },
        start() {
            if (running) return;
            running = true;
            last = 0;
            next = requestAnimationFrame(frame);
        },
        stop() {
            // (Called off, so starting again at once can't run two loops.)
            running = false;
            cancelAnimationFrame(next);
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

    if (debug) Object.assign(window.elysicesterDebug ??= {}, { info: () => stage.info(), rig, stage, solids, houses: places.houses, bridges: places.bridges, dressing: places.dressing, pixelRatio: () => renderer.getPixelRatio(), hollows: hollowMap, walk, dust });
    return stage;
}
