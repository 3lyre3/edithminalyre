/**
 * rigs/orbit.js — the tier-1 camera rig: orbit the floating city.
 *
 * One finger or the mouse drags to orbit; a pinch or the wheel zooms within
 * limits; the arrow keys orbit, + and − zoom, and Home returns to the whole
 * view. Left alone, the view drifts slowly round, except under reduced
 * motion. focus(placeId) eases the camera toward a named place (and cuts
 * straight there under reduced motion).
 *
 * Every rig exposes attach(camera, domElement), update(dt), focus(placeId) and
 * dispose(), so later tiers can swap in a rail rig or a walking rig.
 */

// =============================================================================
// Imports
// =============================================================================

import { MathUtils, Vector3 } from 'three';

// =============================================================================
// Constants
// =============================================================================

const IDLE_SECONDS = 8;
const DRIFT = 0.04;
const DRAG = 3.2;
const KEY_TURN = 1.1;
const EASE = 3.4;
const POLAR_MIN = 0.22;
const POLAR_MAX = 1.95;
const RADIUS_MIN = 7;
const TAP_SLOP = 7;
const TAP_TIME = 800;

/** Half the height and width, in world units, the whole-diorama view must hold. */
const HALF_HEIGHT = 37;
const HALF_WIDTH = 33;

// =============================================================================
// Main Code
// =============================================================================

function shortest(angle) {
    return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));
}

function ignoresKeys(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return true;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return true;
    return Boolean(document.querySelector('dialog[open]'));
}

export class OrbitRig {
    /**
     * @param {object} options
     * @param {Map<string, {position: Vector3, focus: {distance: number, height: number, azimuth?: number}}>} options.places
     * @param {boolean} options.reducedMotion
     */
    constructor({ places, reducedMotion }) {
        this.places = places;
        this.reducedMotion = reducedMotion;
        this.home = { target: new Vector3(-1, 5, -1), radius: 110, theta: 0.95, phi: 1.2 };
        this.goal = { target: this.home.target.clone(), radius: this.home.radius, theta: this.home.theta, phi: this.home.phi };
        this.now = { target: this.goal.target.clone(), radius: this.goal.radius, theta: this.goal.theta, phi: this.goal.phi };
        this.radiusMax = 260;
        this.fitted = false;
        this.atHome = true;
        this.drifting = true;
        this.idle = 0;
        this.keys = new Set();
        this.pointers = new Map();
        this.tapListeners = [];
        this.camera = null;
        this.element = null;
        this.listeners = [];
    }

    attach(camera, element) {
        this.camera = camera;
        this.element = element;
        const listen = (target, type, handler, options) => {
            target.addEventListener(type, handler, options);
            this.listeners.push(() => target.removeEventListener(type, handler, options));
        };

        listen(element, 'pointerdown', (event) => {
            element.setPointerCapture(event.pointerId);
            this.pointers.set(event.pointerId, {
                x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, startTime: event.timeStamp,
            });
            this.idle = 0;
        });
        listen(element, 'pointermove', (event) => {
            const pointer = this.pointers.get(event.pointerId);
            if (!pointer) return;
            const rect = element.getBoundingClientRect();
            if (this.pointers.size === 1) {
                this.goal.theta -= ((event.clientX - pointer.x) / rect.width) * DRAG;
                this.goal.phi = MathUtils.clamp(this.goal.phi - ((event.clientY - pointer.y) / rect.height) * DRAG * 0.6, POLAR_MIN, POLAR_MAX);
            } else if (this.pointers.size === 2) {
                const [a, b] = [...this.pointers.values()];
                const before = Math.hypot(a.x - b.x, a.y - b.y);
                pointer.x = event.clientX;
                pointer.y = event.clientY;
                const after = Math.hypot(a.x - b.x, a.y - b.y);
                if (before > 0 && after > 0) this.zoomBy(before / after);
            }
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            this.idle = 0;
        });
        const release = (event) => {
            const pointer = this.pointers.get(event.pointerId);
            if (!pointer) return;
            const wasSingle = this.pointers.size === 1;
            this.pointers.delete(event.pointerId);
            if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
            const moved = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
            if (event.type === 'pointerup' && wasSingle && moved < TAP_SLOP && event.timeStamp - pointer.startTime < TAP_TIME) {
                for (const listener of this.tapListeners) listener(event.clientX, event.clientY, event.pointerType);
            }
        };
        listen(element, 'pointerup', release);
        listen(element, 'pointercancel', release);
        listen(element, 'wheel', (event) => {
            event.preventDefault();
            const lines = event.deltaMode === 1 ? 16 : 1;
            this.zoomBy(Math.exp(event.deltaY * lines * 0.0011));
            this.idle = 0;
        }, { passive: false });

        listen(window, 'keydown', (event) => {
            if (ignoresKeys(event)) return;
            if (event.key.startsWith('Arrow')) {
                this.keys.add(event.key);
                event.preventDefault();
            } else if (event.key === '+' || event.key === '=') {
                this.zoomBy(0.85);
            } else if (event.key === '-' || event.key === '_') {
                this.zoomBy(1.18);
            } else if (event.key === 'Home') {
                this.toHome();
                event.preventDefault();
            } else {
                return;
            }
            this.idle = 0;
        });
        listen(window, 'keyup', (event) => this.keys.delete(event.key));
        listen(window, 'blur', () => this.keys.clear());
    }

    /** Called for a click or tap that didn't turn into a drag: (clientX, clientY, pointerType). */
    onTap(listener) {
        this.tapListeners.push(listener);
    }

    zoomBy(factor) {
        this.goal.radius = MathUtils.clamp(this.goal.radius * factor, RADIUS_MIN, this.radiusMax);
        this.atHome = false;
    }

    /** Frame the whole diorama for this aspect ratio and vertical field of view. */
    fit(aspect, fov) {
        const tan = Math.tan(MathUtils.degToRad(fov) / 2);
        this.home.radius = Math.max(HALF_HEIGHT / tan, HALF_WIDTH / (tan * aspect));
        this.radiusMax = this.home.radius * 1.35;
        if (this.atHome) this.goal.radius = this.home.radius;
        this.goal.radius = Math.min(this.goal.radius, this.radiusMax);
        if (!this.fitted) {
            this.now.radius = this.goal.radius;
            this.fitted = true;
        }
    }

    /** Pause or resume the idle drift (paused while someone is reading). */
    setDrifting(drifting) {
        this.drifting = drifting;
        this.idle = 0;
    }

    toHome() {
        this.goal.target.copy(this.home.target);
        this.goal.radius = this.home.radius;
        this.goal.phi = this.home.phi;
        this.goal.theta = this.now.theta + shortest(this.home.theta - this.now.theta);
        this.atHome = true;
        this.idle = 0;
    }

    /**
     * Ease toward a place. With a point (a reading point's position), the camera
     * centres that point instead of the place's anchor; with an azimuth (degrees),
     * it comes round to that side; with a reach ({ distance, height }), it comes
     * that close (to read a sign, say) instead of the place's own distance.
     */
    focus(placeId, point = null, azimuth = null, reach = null) {
        const place = this.places.get(placeId);
        if (!place) return false;
        const focus = { ...place.focus, ...(reach ?? {}) };
        const position = point ?? place.position;
        const facing = azimuth ?? place.focus.azimuth;
        const theta = facing === undefined || facing === null ? Math.atan2(position.x, position.z) : MathUtils.degToRad(facing);
        this.goal.target.copy(position);
        this.goal.radius = focus.distance;
        this.goal.phi = Math.acos(MathUtils.clamp(focus.height / focus.distance, -0.95, 0.95));
        this.goal.theta = this.now.theta + shortest(theta - this.now.theta);
        this.atHome = false;
        this.idle = 0;
        return true;
    }

    update(dt) {
        this.idle += dt;
        const turn = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
        const tilt = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0);
        if (turn || tilt) {
            this.goal.theta += turn * KEY_TURN * dt;
            this.goal.phi = MathUtils.clamp(this.goal.phi - tilt * KEY_TURN * 0.6 * dt, POLAR_MIN, POLAR_MAX);
            this.idle = 0;
        }
        if (!this.reducedMotion && this.drifting && this.idle > IDLE_SECONDS) this.goal.theta += DRIFT * dt;

        const k = this.reducedMotion ? 1 : 1 - Math.exp(-EASE * dt);
        this.now.target.lerp(this.goal.target, k);
        this.now.radius += (this.goal.radius - this.now.radius) * k;
        this.now.theta += (this.goal.theta - this.now.theta) * k;
        this.now.phi += (this.goal.phi - this.now.phi) * k;

        const sinPhi = Math.sin(this.now.phi);
        this.camera.position.set(
            this.now.target.x + this.now.radius * sinPhi * Math.sin(this.now.theta),
            this.now.target.y + this.now.radius * Math.cos(this.now.phi),
            this.now.target.z + this.now.radius * sinPhi * Math.cos(this.now.theta),
        );
        this.camera.lookAt(this.now.target);
    }

    dispose() {
        for (const remove of this.listeners) remove();
        this.listeners = [];
        this.tapListeners = [];
        this.keys.clear();
        this.pointers.clear();
    }
}
