/**
 * hotspots.js — the reading points.
 *
 * Every fragment whose place is built gets a soft glowing point there: the
 * place's anchor plus the fragment's offset. A tap or click picks the point
 * nearest the pointer that isn't hidden behind the city; hovering with a mouse
 * lights a point and names its place. The keyboard, and every screen reader,
 * reaches all the points through a list that mirrors each one as a real link:
 * focusing an entry eases the camera toward its place and lights its point,
 * and Enter opens the reader. Points already read are dimmer, and stay so on a
 * return visit; the unread are a pale, warm light, and ask to be touched
 * without a word: once the city has settled they glint in turn, a ring going
 * out from each, and now and then one glints again. In the still (no WebGL)
 * the same list stands on its own.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    BufferGeometry,
    CanvasTexture,
    Float32BufferAttribute,
    MathUtils,
    Mesh,
    Points,
    Raycaster,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import { DRAWN } from './ink.js';
import { WORKS } from './reader.js';

// =============================================================================
// Constants
// =============================================================================

const PICK_RADIUS = { mouse: 26, pen: 26, touch: 40 };
const POINT_SIZE = 1.15;

/**
 * The points ask to be touched without a word: once the city has settled, each unread point glints in turn (a
 * ring going out from it), in no particular order; after that, now and then, one of them glints again.
 */
const GLINT_SECONDS = 1.3;
const GLINT_ROOM = 2.6;
const WELCOME_DELAY = 1.2;
const WELCOME_STEP = 0.3;
const IDLE_GLINT = 7;

const vertexShader = /* glsl */ `
    attribute float aRead;
    attribute float aLit;
    attribute float aSeed;
    attribute float aGlint;
    attribute float aGiver;

    uniform float time;
    uniform float pulse;
    uniform float scale;
    uniform float pixelRatio;

    varying float vRead;
    varying float vLit;
    varying float vGlint;
    varying float vGiver;

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float breathe = 1.0 + pulse * 0.16 * sin(time * 1.7 + aSeed * 6.2832) * (1.0 - aRead);
        float size = ${POINT_SIZE.toFixed(2)} * (1.0 + aLit * 0.55) * breathe * scale / -mvPosition.z;
        size = clamp(size, 11.0 * pixelRatio, 72.0 * pixelRatio);
        // While it glints, the point's square grows to give its ring room (the glow itself keeps its size).
        float glint = (time - aGlint) / ${GLINT_SECONDS.toFixed(2)};
        vGlint = glint >= 0.0 && glint < 1.0 ? glint : -1.0;
        gl_PointSize = size * (vGlint >= 0.0 ? ${GLINT_ROOM.toFixed(2)} : 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vRead = aRead;
        vLit = aLit;
        vGiver = aGiver;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D map;

    varying float vRead;
    varying float vLit;
    varying float vGlint;
    varying float vGiver;

    void main() {
        float room = vGlint >= 0.0 ? ${GLINT_ROOM.toFixed(2)} : 1.0;
        vec2 at = (gl_PointCoord - 0.5) * room + 0.5;
        vec4 glow = all(greaterThanEqual(at, vec2(0.0))) && all(lessThanEqual(at, vec2(1.0))) ? texture2D(map, at) : vec4(0.0);
        // Unread: a pale, warm light, so it stands apart from the gilding round it; read: dim.
        vec3 unread = vec3(2.5, 2.2, 1.7);
        vec3 seen = vec3(0.55, 0.47, 0.4);
        vec3 color = mix(unread, seen, min(vRead, 1.0));
        color = mix(color, vec3(3.6, 3.0, 2.0), vLit);
        // (A touch's ripple, read as 2, is a ring alone, with no light at its heart; so is a passage with a giver,
        // who is there to be seen: creatures.js.)
        vec4 result = vRead > 1.5 || vGiver > 0.5 ? vec4(0.0) : vec4(color * glow.rgb, glow.a);
        if (vGlint >= 0.0) {
            // The ring, going out and fading as it goes.
            float radius = length(gl_PointCoord - 0.5) * 2.0;
            float reach = 0.18 + 0.78 * vGlint;
            float ring = smoothstep(0.07, 0.0, abs(radius - reach)) * (1.0 - vGlint) * (1.0 - vGlint);
            result.rgb += vec3(2.2, 1.9, 1.4) * ring;
            result.a = max(result.a, ring);
        }
        gl_FragColor = result;
    }
`;

// =============================================================================
// The list: every reading point as a real link
// =============================================================================

/**
 * @param {object} options
 * @param {HTMLElement} options.nav - holds an empty <ol>
 * @param {object[]} options.fragments - fragments that have a built place
 * @param {Map<string, object>} options.places
 * @param {Set<string>} options.read - fragment ids already read
 * @param {(fragment: object, link: HTMLElement) => void} options.onOpen
 * @param {(fragment: object | null) => void} [options.onFocusPoint]
 */
export function createPointList({ nav, fragments, places, read, onOpen, onFocusPoint }) {
    const list = nav.querySelector('ol');
    const links = new Map();

    const setRead = (link, isRead) => {
        link.dataset.read = isRead ? 'yes' : 'no';
        link.querySelector('.read-mark').textContent = isRead ? ' (read)' : '';
    };

    for (const fragment of fragments) {
        const place = places.get(fragment.place);
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#read-${fragment.id}`;
        link.dataset.fragment = fragment.id;
        const mark = document.createElement('span');
        mark.className = 'read-mark';
        if (fragment.listLabel) {
            // (Allison's bio, a trial, is named for him: main.js.)
            link.append(fragment.listLabel, mark);
        } else {
            link.append(`${place.label}, from `);
            const work = document.createElement('cite');
            work.textContent = WORKS[fragment.work];
            link.append(work, mark);
        }
        setRead(link, read.has(fragment.id));
        link.addEventListener('click', (event) => {
            event.preventDefault();
            onOpen(fragment, link);
        });
        link.addEventListener('focus', () => onFocusPoint?.(fragment));
        item.append(link);
        list.append(item);
        links.set(fragment.id, link);
    }
    nav.addEventListener('focusout', (event) => {
        if (!nav.contains(event.relatedTarget)) onFocusPoint?.(null);
    });

    return {
        markRead(id) {
            const link = links.get(id);
            if (link) setRead(link, true);
        },
        linkFor(id) {
            return links.get(id) ?? null;
        },
    };
}

// =============================================================================
// The points in the scene
// =============================================================================

function glowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    // A small bright core in a wide, faint halo: a point of light, not a ball of it.
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.42)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.13)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new CanvasTexture(canvas);
}

/**
 * @param {object} options
 * @param {object} options.stage - from createStage
 * @param {object[]} options.fragments - fragments that have a built place
 * @param {Set<string>} options.read
 * @param {Map<string, object>} options.places
 * @param {HTMLElement} options.label - a floating caption for the lit point
 * @param {boolean} options.reducedMotion
 * @param {(fragment: object) => void} options.onPick
 * @param {(x: number, y: number, pointDistance: number) => boolean} [options.yieldTap] - lets
 *   something the tap landed squarely on (a sign) keep a tap that only grazed a point
 * @param {(x: number, y: number, pointerType: string) => void} [options.onMiss] - a tap that found no
 *   point (touch.js may find something else there)
 * @param {() => number | null} [options.glintEvery] - how often (seconds) an unread point glints again, if
 *   not at the usual pace (the hint, on trial: the last few unread glint more often)
 * @param {(fragment: object) => Vector3 | null} [options.giverAt] - where a passage's giver is, if it has one (the
 *   givers, a trial: creatures.js): its point is there, with no light of its own (the giver is there to be seen)
 * @param {(fragment: object) => string | null} [options.speechOf] - what a passage's giver says, shown where a
 *   place's name would be
 * @param {(fragment: object) => { center: Vector3, radius: number } | null} [options.giverBody] - the giver's body (a
 *   tap anywhere on it finds it, however near it's seen)
 * @param {(fragment: object | null) => void} [options.onLight] - a point has been lit (or none is)
 * @param {(fragment: object) => boolean} [options.glints] - whether an unread point may glint unasked (a flower's bud
 *   doesn't: flowers.js)
 * @param {(fragment: object) => boolean} [options.moving] - whether a giver moves (a flower bowing as it wilts), so its
 *   point is followed (giverAt read each frame; its body, giverBody's, must be live too)
 */
export function createHotspots({ stage, fragments, read, places, label, reducedMotion, onPick, yieldTap, onMiss, glintEvery, giverAt, giverBody, speechOf, onLight, glints = () => true, moving = () => false }) {
    const { scene, camera, canvas, renderer, rig } = stage;
    const entries = fragments.map((fragment, index) => {
        const giver = giverAt?.(fragment) ?? null;
        return {
            fragment,
            index,
            giver: Boolean(giver),
            // (A giver that moves, a flower as it wilts, is followed: its point read again each frame.)
            follows: Boolean(giver) && moving(fragment),
            body: giver ? giverBody?.(fragment) ?? null : null,
            position: giver ? giver.clone() : stage.anchors.get(fragment.place).clone().add(new Vector3().fromArray(fragment.offset ?? [0, 0, 0])),
        };
    });
    const following = entries.filter((entry) => entry.follows);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(entries.flatMap((entry) => entry.position.toArray()), 3));
    geometry.setAttribute('aRead', new Float32BufferAttribute(entries.map((entry) => (read.has(entry.fragment.id) ? 1 : 0)), 1));
    geometry.setAttribute('aLit', new Float32BufferAttribute(entries.map(() => 0), 1));
    geometry.setAttribute('aSeed', new Float32BufferAttribute(entries.map((entry) => (entry.index * 0.618) % 1), 1));
    // When each point's glint begins (in the stage's seconds); long ago, until one is asked for.
    geometry.setAttribute('aGlint', new Float32BufferAttribute(entries.map(() => -1000), 1));
    geometry.setAttribute('aGiver', new Float32BufferAttribute(entries.map((entry) => (entry.giver ? 1 : 0)), 1));

    const uniforms = {
        map: { value: glowTexture() },
        time: { value: 0 },
        pulse: { value: reducedMotion ? 0 : 1 },
        scale: { value: 400 },
        pixelRatio: { value: 1 },
    };
    const material = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    });
    const points = new Points(geometry, material);
    points.name = 'reading-points';
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);

    // Glass, cloth and water don't hide a point; the sky and sea never stand in front of one, nor a passing hum, nor
    // the givers (each stands at its own point) and their boards and shades, nor the flowers (their shapes are made in
    // the shader, so a ray would meet them where they aren't).
    const occluders = scene.children.filter((child) => child instanceof Mesh && !['sky', 'sea', 'glass', 'turquoise', 'hums', 'verti-pool', 'footlight-wash', 'walk-ring', 'walk-target', 'sun-dock-light', 'bridge', 'bridge-dust', 'fountain-fall', 'pugs', 'pug-boards', 'giver-hums', 'giver-hums-blur', 'giver-shades', 'giver-shades-hums', 'flowers', 'flower-shades'].includes(child.name));
    const raycaster = new Raycaster();
    const projected = new Vector3();
    const drawingBuffer = new Vector2();
    let lit = null;
    // The point the walking shadow is beside: its name stays up (the pointer passing over another point names
    // that one for a moment, then gives it back), and the name can be clicked, to read it.
    let pinned = null;

    function screenOf(entry) {
        projected.copy(entry.position).project(camera);
        const rect = canvas.getBoundingClientRect();
        return {
            x: rect.left + ((projected.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - projected.y) / 2) * rect.height,
            inFront: projected.z < 1,
        };
    }

    /** Whether nothing of the city stands between the eye and this point (but within the last 0.6 of the way). */
    function clearTo(target) {
        const direction = target.clone().sub(camera.position);
        const distance = direction.length();
        raycaster.set(camera.position, direction.normalize());
        raycaster.far = Math.max(0, distance - 0.6);
        return raycaster.intersectObjects(occluders, false).length === 0;
    }

    const across = new Vector3();
    const upward = new Vector3();
    const edge = new Vector3();
    /**
     * Whether a point can be touched: nothing hides it; or, a flower, it's seen at least in part, round whatever stands
     * before it (the playtester, 2 Oct: the lotus, in bloom at the edge, was hidden from a touch by its own sign and the
     * crystal on its pad, though half of it showed): its head's edges, as the eye sees them, will do. (Only the flowers,
     * which follow their bowing heads: a giver half behind a wall is left to the wall's own signs beside it.)
     */
    function visible(entry) {
        if (clearTo(entry.position)) return true;
        if (!entry.body || !entry.follows) return false;
        const { center, radius } = entry.body;
        const toward = center.clone().sub(camera.position).normalize();
        across.crossVectors(toward, camera.up).normalize();
        upward.crossVectors(across, toward).normalize();
        for (const [side, up] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7]]) {
            edge.copy(center).addScaledVector(across, side * radius * 0.85).addScaledVector(upward, up * radius * 0.85);
            if (clearTo(edge)) return true;
        }
        return false;
    }

    const bodyAt = new Vector3();
    /** How far (CSS px) (x, y) is from a giver's body as it's seen (0 anywhere on it), or Infinity if it's behind. */
    function offBody(entry, x, y) {
        bodyAt.copy(entry.body.center).project(camera);
        if (bodyAt.z >= 1) return Infinity;
        const rect = canvas.getBoundingClientRect();
        const away = camera.position.distanceTo(entry.body.center);
        const across = (entry.body.radius / Math.max(0.01, away)) * (rect.height / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2)));
        const sx = rect.left + ((bodyAt.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - bodyAt.y) / 2) * rect.height;
        return Math.max(0, Math.hypot(sx - x, sy - y) - across);
    }

    /** The closest point to (x, y) within radius that the city doesn't hide: { entry, distance }. */
    function nearest(x, y, radius) {
        const candidates = [];
        for (const entry of entries) {
            const screen = screenOf(entry);
            if (!screen.inFront) continue;
            // (A giver is found by its point, or anywhere on its body.)
            const distance = Math.min(Math.hypot(screen.x - x, screen.y - y), entry.body ? offBody(entry, x, y) : Infinity);
            if (distance < radius) candidates.push({ entry, distance, depth: camera.position.distanceTo(entry.position) });
        }
        // (Touched on two at once, a bud with a pug's body behind it, say, the one nearer the eye has it.)
        candidates.sort((a, b) => a.distance - b.distance || a.depth - b.depth);
        return candidates.find(({ entry }) => visible(entry)) ?? null;
    }

    // The label (a place's name, or a giver's line) stands centred above its point, but always whole on the screen and
    // never over the controls along the top (the one option, the count, the hum's button): with no room above, it
    // stands below the point. (Elm's phone, 3 Oct: Allison's line over "zoom out" and the count, and off the edge.)
    // Its size and the controls' edge are measured as its words change (and on a resize), not every frame.
    const LABEL_MARGIN = 10;
    const LABEL_GAP = 18;
    const topControls = ['one-button', 'inventory-toggle', 'hum-button'].map((id) => document.getElementById(id)).filter(Boolean);
    let labelBox = null;
    const measureLabel = () => {
        let top = LABEL_MARGIN;
        for (const control of topControls) {
            if (control.hidden) continue;
            const box = control.getBoundingClientRect();
            if (box.height > 0 && box.top < innerHeight * 0.25) top = Math.max(top, box.bottom + 6);
        }
        labelBox = { width: label.offsetWidth, height: label.offsetHeight, top };
    };
    addEventListener('resize', () => {
        labelBox = null;
    });
    function placeLabel(screen) {
        if (!labelBox || !labelBox.width) measureLabel();
        const { width, height, top } = labelBox;
        // (Its CSS sets it centred on the spot it's given, its foot LABEL_GAP above: translate(-50%, -100% - 18px).)
        const half = width / 2;
        const x = MathUtils.clamp(screen.x, LABEL_MARGIN + half, Math.max(LABEL_MARGIN + half, innerWidth - LABEL_MARGIN - half));
        let y = screen.y;
        if (screen.y - LABEL_GAP - height < top) {
            const below = screen.y + LABEL_GAP;
            y = below + height <= innerHeight - LABEL_MARGIN ? below + height + LABEL_GAP : top + height + LABEL_GAP;
        }
        // (And whatever the point's place, its head even above the screen with the camera close: the box itself between
        // the controls' edge and the screen's foot.)
        y = MathUtils.clamp(y, top + height + LABEL_GAP, Math.max(top + height + LABEL_GAP, innerHeight - LABEL_MARGIN + LABEL_GAP));
        label.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    }

    function setLit(entry) {
        const attribute = geometry.attributes.aLit;
        if (lit) attribute.setX(lit.index, 0);
        lit = entry;
        if (lit) attribute.setX(lit.index, 1);
        attribute.needsUpdate = true;
        label.hidden = !lit;
        // (A giver says its word where a place's name would be: creatures.js.)
        const speech = lit && speechOf ? speechOf(lit.fragment) : null;
        if (lit) {
            label.textContent = speech ?? places.get(lit.fragment.place).label;
            label.dataset.fragment = lit.fragment.id;
        } else {
            delete label.dataset.fragment;
        }
        label.classList.toggle('is-speech', Boolean(speech));
        label.classList.toggle('is-near', Boolean(lit) && lit === pinned);
        labelBox = null;
        onLight?.(lit?.fragment ?? null);
    }

    rig.onTap((x, y, pointerType) => {
        const found = nearest(x, y, PICK_RADIUS[pointerType] ?? PICK_RADIUS.touch);
        if (!found) {
            onMiss?.(x, y, pointerType);
            return;
        }
        if (yieldTap?.(x, y, found.distance)) return;
        onPick(found.entry.fragment);
    });

    // A touch's ripple: one ring, going out from where something in the city was touched (touch.js).
    const rippleGeometry = new BufferGeometry();
    rippleGeometry.setAttribute('position', new Float32BufferAttribute([0, -1000, 0], 3));
    rippleGeometry.setAttribute('aRead', new Float32BufferAttribute([2], 1));
    rippleGeometry.setAttribute('aLit', new Float32BufferAttribute([0], 1));
    rippleGeometry.setAttribute('aSeed', new Float32BufferAttribute([0], 1));
    rippleGeometry.setAttribute('aGlint', new Float32BufferAttribute([-1000], 1));
    rippleGeometry.setAttribute('aGiver', new Float32BufferAttribute([0], 1));
    const ripplePoint = new Points(rippleGeometry, material);
    ripplePoint.name = 'touch-ripple';
    ripplePoint.frustumCulled = false;
    ripplePoint.renderOrder = 5;
    scene.add(ripplePoint);

    let hoverCandidate = null;
    canvas.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse' || event.buttons) return;
        const entry = nearest(event.clientX, event.clientY, PICK_RADIUS.mouse)?.entry ?? null;
        if (entry === hoverCandidate) return;
        hoverCandidate = entry;
        canvas.style.cursor = entry ? 'pointer' : '';
        setLit(entry ?? pinned);
    });
    canvas.addEventListener('pointerleave', () => {
        hoverCandidate = null;
        canvas.style.cursor = '';
        setLit(pinned);
    });

    const isRead = (entry) => geometry.attributes.aRead.getX(entry.index) === 1;
    const glintAt = (entry, at) => {
        geometry.attributes.aGlint.setX(entry.index, at);
        geometry.attributes.aGlint.needsUpdate = true;
    };
    let nextIdleGlint = Infinity;

    stage.onFrame((dt, elapsed) => {
        uniforms.time.value = elapsed;
        for (const entry of following) {
            const now = giverAt(entry.fragment);
            if (!now || now.equals(entry.position)) continue;
            entry.position.copy(now);
            geometry.attributes.position.setXYZ(entry.index, now.x, now.y, now.z);
            geometry.attributes.position.needsUpdate = true;
        }
        // Now and then, one unread point in sight glints again (never under reduced motion).
        if (!reducedMotion && elapsed >= nextIdleGlint) {
            nextIdleGlint = elapsed + (glintEvery?.() ?? IDLE_GLINT);
            const waiting = entries.filter((entry) => !isRead(entry) && glints(entry.fragment) && screenOf(entry).inFront);
            if (waiting.length) glintAt(waiting[Math.floor(Math.random() * waiting.length)], elapsed);
        }
        renderer.getDrawingBufferSize(drawingBuffer);
        // (In the city's picture's pixels, drawn smaller than the screen when the governor asks: ink.js DRAWN.)
        uniforms.scale.value = drawingBuffer.y * DRAWN.scale / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
        uniforms.pixelRatio.value = renderer.getPixelRatio() * DRAWN.scale;
        if (lit) {
            const screen = screenOf(lit);
            label.hidden = !screen.inFront;
            if (screen.inFront) placeLabel(screen);
        }
    });

    return {
        /**
         * The city has arrived: once it settles, every unread point glints in turn, in no particular order
         * (none leads), and from then on one glints now and then. Nothing under reduced motion.
         */
        welcome() {
            if (reducedMotion) return;
            const now = uniforms.time.value;
            const unread = entries.filter((entry) => !isRead(entry) && glints(entry.fragment));
            for (let index = unread.length - 1; index > 0; index -= 1) {
                const swap = Math.floor(Math.random() * (index + 1));
                [unread[index], unread[swap]] = [unread[swap], unread[index]];
            }
            unread.forEach((entry, order) => glintAt(entry, now + WELCOME_DELAY + order * WELCOME_STEP));
            nextIdleGlint = now + WELCOME_DELAY + unread.length * WELCOME_STEP + IDLE_GLINT;
        },
        /** One passage's point glints now (a bud refused shows the bloom so: main.js), read or not. */
        glint(id) {
            const entry = entries.find((candidate) => candidate.fragment.id === id);
            if (entry && !reducedMotion) glintAt(entry, uniforms.time.value);
        },
        /** A ring of light going out from a point in the city (where something was touched). */
        ripple(point) {
            rippleGeometry.attributes.position.setXYZ(0, point.x, point.y, point.z);
            rippleGeometry.attributes.position.needsUpdate = true;
            rippleGeometry.attributes.aGlint.setX(0, uniforms.time.value);
            rippleGeometry.attributes.aGlint.needsUpdate = true;
        },
        /** The city's solid surfaces, as the points are hidden by them (touch.js feels along the same). */
        occluders,
        /**
         * Light a point (from the list's focus) or none. Pinned (the walking shadow is beside it), it stays lit
         * as the pointer passes over the city, and its name can be clicked.
         */
        light(fragment, { pin = false } = {}) {
            const entry = fragment ? entries.find((candidate) => candidate.fragment.id === fragment.id) ?? null : null;
            if (pin || !entry) pinned = pin ? entry : null;
            setLit(entry);
        },
        /**
         * How near (x, y) is to the nearest point the city doesn't hide, within a tap's reach (CSS px); Infinity
         * if none is. (The shadow walk asks, so a tap meant for the words is never taken as the shadow's.)
         */
        nearestDistance(x, y, pointerType) {
            return nearest(x, y, PICK_RADIUS[pointerType] ?? PICK_RADIUS.touch)?.distance ?? Infinity;
        },
        /** Where a fragment's point stands in the scene. */
        positionOf(id) {
            return entries.find((entry) => entry.fragment.id === id)?.position ?? null;
        },
        markRead(id) {
            const entry = entries.find((candidate) => candidate.fragment.id === id);
            if (!entry) return;
            geometry.attributes.aRead.setX(entry.index, 1);
            geometry.attributes.aRead.needsUpdate = true;
        },
        /** Where each point sits on screen, for tests: [{ id, x, y, inFront, visible }]. */
        screenPositions() {
            return entries.map((entry) => ({ id: entry.fragment.id, ...screenOf(entry), visible: visible(entry) }));
        },
        /** Ids of the points drawn as read, for tests. */
        readIds() {
            return entries.filter((entry) => geometry.attributes.aRead.getX(entry.index) === 1).map((entry) => entry.fragment.id);
        },
    };
}
