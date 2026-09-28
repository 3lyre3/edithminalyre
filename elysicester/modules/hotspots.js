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
 * return visit. In the still (no WebGL) the same list stands on its own.
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
import { WORKS } from './reader.js';

// =============================================================================
// Constants
// =============================================================================

const PICK_RADIUS = { mouse: 26, pen: 26, touch: 40 };
const POINT_SIZE = 1.15;

const vertexShader = /* glsl */ `
    attribute float aRead;
    attribute float aLit;
    attribute float aSeed;

    uniform float time;
    uniform float pulse;
    uniform float scale;
    uniform float pixelRatio;

    varying float vRead;
    varying float vLit;

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float breathe = 1.0 + pulse * 0.16 * sin(time * 1.7 + aSeed * 6.2832) * (1.0 - aRead);
        float size = ${POINT_SIZE.toFixed(2)} * (1.0 + aLit * 0.55) * breathe * scale / -mvPosition.z;
        gl_PointSize = clamp(size, 11.0 * pixelRatio, 72.0 * pixelRatio);
        gl_Position = projectionMatrix * mvPosition;
        vRead = aRead;
        vLit = aLit;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D map;

    varying float vRead;
    varying float vLit;

    void main() {
        vec4 glow = texture2D(map, gl_PointCoord);
        vec3 unread = vec3(2.6, 2.0, 1.15);
        vec3 seen = vec3(0.55, 0.48, 0.42);
        vec3 color = mix(unread, seen, vRead);
        color = mix(color, vec3(3.4, 3.0, 2.2), vLit);
        gl_FragColor = vec4(color * glow.rgb, glow.a);
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
        link.append(`${place.label}, from `);
        const work = document.createElement('cite');
        work.textContent = WORKS[fragment.work];
        const mark = document.createElement('span');
        mark.className = 'read-mark';
        link.append(work, mark);
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
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.28)');
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
 */
export function createHotspots({ stage, fragments, read, places, label, reducedMotion, onPick }) {
    const { scene, camera, canvas, renderer, rig } = stage;
    const entries = fragments.map((fragment, index) => ({
        fragment,
        index,
        position: stage.anchors.get(fragment.place).clone().add(new Vector3().fromArray(fragment.offset ?? [0, 0, 0])),
    }));

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(entries.flatMap((entry) => entry.position.toArray()), 3));
    geometry.setAttribute('aRead', new Float32BufferAttribute(entries.map((entry) => (read.has(entry.fragment.id) ? 1 : 0)), 1));
    geometry.setAttribute('aLit', new Float32BufferAttribute(entries.map(() => 0), 1));
    geometry.setAttribute('aSeed', new Float32BufferAttribute(entries.map((entry) => (entry.index * 0.618) % 1), 1));

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

    // Glass and cloth don't hide a point; the sky and sea never stand in front of one.
    const occluders = scene.children.filter((child) => child instanceof Mesh && !['sky', 'sea', 'glass', 'turquoise'].includes(child.name));
    const raycaster = new Raycaster();
    const projected = new Vector3();
    const drawingBuffer = new Vector2();
    let lit = null;

    function screenOf(entry) {
        projected.copy(entry.position).project(camera);
        const rect = canvas.getBoundingClientRect();
        return {
            x: rect.left + ((projected.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - projected.y) / 2) * rect.height,
            inFront: projected.z < 1,
        };
    }

    function visible(entry) {
        const direction = entry.position.clone().sub(camera.position);
        const distance = direction.length();
        raycaster.set(camera.position, direction.normalize());
        raycaster.far = distance - 0.6;
        return raycaster.intersectObjects(occluders, false).length === 0;
    }

    /** The closest point to (x, y) within radius that the city doesn't hide. */
    function nearest(x, y, radius) {
        const candidates = [];
        for (const entry of entries) {
            const screen = screenOf(entry);
            if (!screen.inFront) continue;
            const distance = Math.hypot(screen.x - x, screen.y - y);
            if (distance < radius) candidates.push({ entry, distance });
        }
        candidates.sort((a, b) => a.distance - b.distance);
        return candidates.find(({ entry }) => visible(entry))?.entry ?? null;
    }

    function setLit(entry) {
        const attribute = geometry.attributes.aLit;
        if (lit) attribute.setX(lit.index, 0);
        lit = entry;
        if (lit) attribute.setX(lit.index, 1);
        attribute.needsUpdate = true;
        label.hidden = !lit;
        if (lit) label.textContent = places.get(lit.fragment.place).label;
    }

    rig.onTap((x, y, pointerType) => {
        const entry = nearest(x, y, PICK_RADIUS[pointerType] ?? PICK_RADIUS.touch);
        if (entry) onPick(entry.fragment);
    });

    let hoverCandidate = null;
    canvas.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse' || event.buttons) return;
        const entry = nearest(event.clientX, event.clientY, PICK_RADIUS.mouse);
        if (entry === hoverCandidate) return;
        hoverCandidate = entry;
        canvas.style.cursor = entry ? 'pointer' : '';
        setLit(entry);
    });
    canvas.addEventListener('pointerleave', () => {
        hoverCandidate = null;
        canvas.style.cursor = '';
        setLit(null);
    });

    stage.onFrame((dt, elapsed) => {
        uniforms.time.value = elapsed;
        renderer.getDrawingBufferSize(drawingBuffer);
        uniforms.scale.value = drawingBuffer.y / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
        uniforms.pixelRatio.value = renderer.getPixelRatio();
        if (lit) {
            const screen = screenOf(lit);
            label.style.translate = `${Math.round(screen.x)}px ${Math.round(screen.y)}px`;
            label.hidden = !screen.inFront;
        }
    });

    return {
        /** Light a point (from the list's focus) or none. */
        light(fragment) {
            setLit(fragment ? entries.find((entry) => entry.fragment.id === fragment.id) ?? null : null);
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
