/**
 * bright.js — the city's bright things, answering a touch.
 *
 * Elm's yes (2 Oct) to "eye-catching things answer a touch: a lamp brightens, a crystal chimes, a lantern turns" (a
 * trial, trials.js; ?bright=off). places.js lists them among what a touch may find (touch.js), each with its lights
 * ([{ at, color, size, after, kind }]): the street and park lamps and the golden bridges' lanterns ('lamp'), the
 * market's strung lights and Cafiarmaí's lantern high in its tower ('lantern'), and the charity ball's chandeliers
 * ('crystal'). Touched, a lamp brightens: its light swells and settles. A lantern turns: its lights brighten one after
 * another, along the string from where it was touched, or round the tower's lantern from side to side. A crystal
 * chimes: its drops flash in turn, as stars. main.js plays each one's sound (audio.js).
 *
 * The lights are drawn over the city, added to it as its lamps are: hidden by whatever stands in front of them, never
 * hiding anything themselves. Under reduced motion a light brightens and fades where it is, without swelling.
 */

// =============================================================================
// Imports
// =============================================================================

import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, MathUtils, Points, ShaderMaterial, Vector2 } from 'three';

// =============================================================================
// Constants
// =============================================================================

/** How many lights can be answering at once (the oldest gives way to the newest). */
const MOST = 96;

/** How long one light's answer lasts, from its own start (seconds). */
const LASTS = 1.6;

/** Kinds of light in the shader: a lamp's swelling glow, or a crystal's star. */
const GLOW = 0;
const STAR = 1;

const vertexShader = /* glsl */ `
    attribute float aStart;
    attribute float aSize;
    attribute float aKind;
    attribute vec3 aColor;

    uniform float time;
    uniform float scale;
    uniform float pixelRatio;
    uniform float still;

    varying float vT;
    varying float vKind;
    varying vec3 vColor;

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // (Drawn a little nearer than the light itself, so its own lamp's glass never hides its heart.)
        mvPosition.xyz += normalize(-mvPosition.xyz) * 0.18;
        float t = (time - aStart) / ${LASTS.toFixed(2)};
        vT = t;
        vKind = aKind;
        vColor = aColor;
        // A lamp's light swells as it brightens and settles back; a crystal's star flares and is gone.
        float swell = still > 0.5 ? 1.0 : aKind > 0.5 ? 0.6 + 0.8 * sin(clamp(t * 2.2, 0.0, 1.0) * 3.14159) : 1.0 + 0.7 * sin(clamp(t * 1.6, 0.0, 1.0) * 3.14159);
        float size = aSize * swell * scale / -mvPosition.z;
        gl_PointSize = t >= 0.0 && t < 1.0 ? clamp(size, 8.0 * pixelRatio, 260.0 * pixelRatio) : 0.0;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = /* glsl */ `
    varying float vT;
    varying float vKind;
    varying vec3 vColor;

    void main() {
        if (vT < 0.0 || vT >= 1.0) discard;
        vec2 at = gl_PointCoord - 0.5;
        float r = length(at) * 2.0;
        // Up quickly, down slowly (a star's is quicker).
        float level = vKind > 0.5
            ? smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.08, 0.55, vT))
            : smoothstep(0.0, 0.1, vT) * (1.0 - smoothstep(0.22, 1.0, vT));
        vec3 light;
        if (vKind > 0.5) {
            // A four-pointed star, its points thinning to nothing, and a small bright heart.
            vec2 d = abs(at) * 2.0;
            float arms = max(smoothstep(0.1, 0.0, d.x) * (1.0 - d.y), smoothstep(0.1, 0.0, d.y) * (1.0 - d.x));
            float heart = smoothstep(0.3, 0.0, r);
            light = vColor * (arms * 2.4 + heart * 2.0);
        } else {
            // A glow in the city's own stepped light: a firm heart, then two bands, softening out.
            if (r > 1.0) discard;
            float glow = pow(1.0 - r, 1.6);
            float banded = floor(glow * 3.0 + 0.6) / 3.0;
            light = vColor * (smoothstep(0.3, 0.18, r) * 1.4 + banded * 0.9 + glow * 0.5);
        }
        gl_FragColor = vec4(light * level, 1.0);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {object} options.stage - from createStage (its scene, camera, renderer and frames)
 * @param {boolean} [options.reducedMotion]
 */
export function createBright({ stage, reducedMotion = false }) {
    const { camera, renderer } = stage;
    const positions = new Float32Array(MOST * 3).fill(0);
    for (let index = 0; index < MOST; index += 1) positions[index * 3 + 1] = -1000;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aStart', new Float32BufferAttribute(new Float32Array(MOST).fill(-1000), 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(new Float32Array(MOST).fill(0), 1));
    geometry.setAttribute('aKind', new Float32BufferAttribute(new Float32Array(MOST).fill(GLOW), 1));
    geometry.setAttribute('aColor', new Float32BufferAttribute(new Float32Array(MOST * 3).fill(1), 3));
    const uniforms = {
        time: { value: 0 },
        scale: { value: 400 },
        pixelRatio: { value: 1 },
        still: { value: reducedMotion ? 1 : 0 },
    };
    const points = new Points(geometry, new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    }));
    points.name = 'bright-answers';
    points.frustumCulled = false;
    points.renderOrder = 6;
    // (Drawn only while something answers: at rest it costs the city nothing. main.js gives it to the stage, which
    // makes its program with the city's, so the first touch draws it without a pause.)
    points.visible = false;

    const drawingBuffer = new Vector2();
    const colour = new Color();
    let next = 0;
    let now = 0;
    /** The time each slot's answer ends (to tell what's still answering), and the last of them. */
    const ends = new Float32Array(MOST).fill(-1000);
    let lastEnd = -1000;

    const keep = (elapsed) => {
        uniforms.time.value = elapsed;
        renderer.getDrawingBufferSize(drawingBuffer);
        uniforms.scale.value = drawingBuffer.y / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
        uniforms.pixelRatio.value = renderer.getPixelRatio();
    };
    stage.onFrame((dt, elapsed) => {
        now = elapsed;
        points.visible = elapsed < lastEnd;
        if (points.visible) keep(elapsed);
    });

    return {
        /** The answers' points (for the local checks). */
        object: points,
        /**
         * Answer a touch: each of the thing's lights in its turn. `from` (a point) orders a string's lights from
         * where it was touched, outward.
         * @param {{ lights: { at: import('three').Vector3, color: number, size: number, after?: number, kind?: string }[] }} target
         * @param {import('three').Vector3} [from]
         * @returns {number} the stage's time it answered at (the local checks draw it a moment on)
         */
        answer(target, from = null) {
            const lights = target.lights ?? [];
            // (Along a string, the light runs out from the touched bulb both ways: each waits by its distance.)
            const along = target.runs && from ? Math.max(0.0001, target.runs) : 0;
            for (const light of lights) {
                const slot = next;
                next = (next + 1) % MOST;
                const after = (light.after ?? 0) + (along ? light.at.distanceTo(from) / along : 0);
                geometry.attributes.position.setXYZ(slot, light.at.x, light.at.y, light.at.z);
                geometry.attributes.aStart.setX(slot, now + after);
                geometry.attributes.aSize.setX(slot, light.size);
                geometry.attributes.aKind.setX(slot, light.kind === 'star' ? STAR : GLOW);
                // (Its hue, at the brightness the shader gives it: the city's lights are kept brighter than white.)
                colour.set(light.color);
                const peak = Math.max(colour.r, colour.g, colour.b);
                if (peak > 1) colour.multiplyScalar(1 / peak);
                geometry.attributes.aColor.setXYZ(slot, colour.r, colour.g, colour.b);
                ends[slot] = now + after + LASTS;
                lastEnd = Math.max(lastEnd, ends[slot]);
            }
            for (const name of ['position', 'aStart', 'aSize', 'aKind', 'aColor']) geometry.attributes[name].needsUpdate = true;
            // (Seen from this frame on: the stage's next frame draws it, its clock and size already as the frame's.)
            if (lights.length) {
                points.visible = true;
                keep(now);
            }
            return now;
        },
        /** How many lights are answering now (the local checks'). */
        answering() {
            let count = 0;
            for (let slot = 0; slot < MOST; slot += 1) if (ends[slot] > now) count += 1;
            return count;
        },
    };
}
