/**
 * threshold.js — the way in: the Mega-Screen, then the Intermaze.
 *
 * The Mega-Screen's title card comes first: a dark screen across which
 * enormous italic letters roll in from the right, a short step left with each
 * flicker, spelling INSERT BLUTIX (Numbers by Paint, Episode 1, p. 29). One tap
 * or keypress begins, and that same gesture unlocks sound if the visitor has
 * switched it on.
 *
 * Then the Intermaze: a flight through shifting, mirror-coloured depths and
 * blue-red mirror-gates ringed with nodes, after the wheel at the centre of
 * Elm's cosmology plate. It doubles as the loading screen: it ends once the
 * city is ready and a minimum passage has played. A tap or Esc skips it (the
 * city still has to be ready). On the way, E's inner voice surfaces a line at a
 * time. Under reduced motion there is no flight; the card crossfades to the
 * city.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    OrthographicCamera,
    Scene,
    ShaderMaterial,
    Vector2,
} from 'three';

// =============================================================================
// Constants
// =============================================================================

/** Each of E's lines stays long enough to read: a base, plus a little for every word. */
const LINE_BASE = 0.7;
const LINE_PER_WORD = 0.24;
const LINE_MIN = 1.2;
const LINE_MAX = 3.4;
const FADE_IN = 0.8;
const FADE_OUT = 0.45;
const CROSSFADE_MS = 900;

const vertexShader = /* glsl */ `
    void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform float time;
    uniform vec2 resolution;
    uniform float fade;

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    // A mirror's sheen: pale gold through rust to deep blue and sky, never green.
    vec3 sheen(float t) {
        return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.1, 0.2) + t));
    }

    void main() {
        vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
        vec2 uv = gl_FragCoord.xy / resolution;
        float r = length(p);
        float a = atan(p.y, p.x);

        // Depth along the flight; the walls twist as they pass.
        float z = 0.42 / max(r, 1e-3) + time * 2.3;
        float twist = 0.45 * sin(z * 0.35 + time * 0.4);
        float sector = 3.14159265 / 3.0;
        float mirrored = abs(mod(a + twist, 2.0 * sector) - sector);

        // Ever-over-folding, mirror-coloured walls: mostly silver, tinted as a mirror is.
        float fold = sin(z * 1.6 + mirrored * 8.0) * sin(z * 0.7 - mirrored * 4.0 + time * 0.6);
        vec3 wall = sheen(z * 0.05 + mirrored * 0.35 + fold * 0.25);
        wall = mix(wall, vec3(0.8, 0.82, 0.9), 0.5 + 0.2 * fold);
        wall *= 0.16 + 0.72 * smoothstep(-0.6, 1.0, fold);

        // Mirror-gates: blue-red rings at intervals of depth, ringed with nodes, with spokes.
        float gap = 7.0;
        float g = fract(z / gap);
        float gate = floor(z / gap);
        float ring = exp(-pow((g - 0.5) / 0.04, 2.0));
        vec3 gateColor = mix(vec3(0.3, 0.5, 1.3), vec3(1.3, 0.28, 0.38), 0.5 + 0.5 * sin(a * 3.0 + gate * 1.7));
        float nodes = smoothstep(0.93, 1.0, cos(a * 24.0 + gate)) * exp(-pow((g - 0.47) / 0.065, 2.0));
        float spokes = smoothstep(0.985, 1.0, cos(a * 12.0 + gate)) * smoothstep(0.34, 0.46, g) * smoothstep(0.62, 0.5, g);
        vec3 color = wall + gateColor * (ring * 1.4 + nodes * 1.2) + vec3(0.9, 0.85, 1.0) * spokes * 0.5;

        // The pale nether ahead, and the dark of the well at the edges of sight.
        color += vec3(0.95, 0.9, 1.0) * exp(-r * 9.0) * 0.9;
        color *= 0.3 + 0.7 * smoothstep(1.2, 0.2, r);

        // The bars of the Heltix's caged chassis, two to each side, swaying a little;
        // and the rail E leans against, low across the view, with a glint along its top.
        float pixel = 1.0 / resolution.y;
        float sway = 0.004 * sin(time * 0.7);
        float barWidth = 0.0045 * resolution.y / resolution.x;
        float bars = 0.0;
        for (int index = 0; index < 4; index++) {
            float x = index < 2 ? 0.05 + 0.13 * float(index) : 0.95 - 0.13 * float(index - 2);
            bars = max(bars, smoothstep(barWidth + pixel, barWidth, abs(uv.x - x - sway)));
        }
        float railY = 0.085;
        float rail = smoothstep(0.011 + pixel, 0.011, abs(uv.y - railY));
        float glint = smoothstep(0.0025 + pixel, 0.0, abs(uv.y - railY - 0.008)) * (0.55 + 0.45 * sin(uv.x * 9.0 - time * 1.3));
        color = mix(color, vec3(0.03, 0.02, 0.05), clamp(bars * 0.92 + rail, 0.0, 1.0));
        color += vec3(0.85, 0.68, 0.36) * glint * 0.5;

        color += (hash12(floor(gl_FragCoord.xy) + floor(time * 20.0)) - 0.5) * 0.05;
        gl_FragColor = vec4(color * fade, 1.0);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function secondsFor(line) {
    const words = line.split(/\s+/).filter(Boolean).length;
    return Math.min(LINE_MAX, Math.max(LINE_MIN, LINE_BASE + LINE_PER_WORD * words));
}

/**
 * @param {object} options
 * @param {HTMLElement} options.root - <html>, which carries data-threshold
 * @param {HTMLElement} options.card - the Mega-Screen section
 * @param {HTMLButtonElement} options.begin - covers the card; its text is the prompt
 * @param {HTMLElement} options.voice - where E's lines surface
 * @param {() => void} [options.onBegin] - runs inside the beginning gesture itself
 *   (so sound may start, as browsers ask), before `begun` resolves
 */
export function createThreshold({ root, card, begin, voice, onBegin }) {
    root.dataset.threshold = 'card';
    let resolveBegun;
    const begun = new Promise((resolve) => {
        resolveBegun = resolve;
    });

    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        document.removeEventListener('keydown', onKey, true);
        try {
            onBegin?.();
        } catch (error) {
            console.error(error);
        }
        resolveBegun();
    };
    function onKey(event) {
        if (root.dataset.threshold !== 'card') {
            document.removeEventListener('keydown', onKey, true);
            return;
        }
        if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target === begin && (event.key === 'Enter' || event.key === ' ')) return;
        if (target instanceof Element && target !== begin && target.closest('a, button, input, select, textarea')) return;
        event.preventDefault();
        start();
    }
    begin.addEventListener('click', start);
    document.addEventListener('keydown', onKey, true);

    const say = (line, seconds) => {
        voice.textContent = line;
        voice.style.animationDuration = `${seconds}s`;
        voice.classList.remove('is-speaking');
        void voice.offsetWidth;
        voice.classList.add('is-speaking');
    };

    const leave = () => {
        card.hidden = true;
        voice.textContent = '';
        root.dataset.threshold = 'done';
    };

    return {
        /** Resolves on the first tap, click or keypress. */
        begun,

        /**
         * Fly the Intermaze until the city is ready and the passage is done.
         * @param {object} options
         * @param {import('three').WebGLRenderer} options.renderer
         * @param {Promise<unknown>} options.ready
         * @param {string[]} options.lines - E's lines, in order
         * @param {() => void} [options.fit] - keeps the renderer sized to its canvas
         */
        async fly({ renderer, ready, lines, fit }) {
            root.dataset.threshold = 'flight';
            card.classList.add('is-leaving');
            const size = new Vector2();
            const uniforms = { time: { value: 0 }, resolution: { value: size }, fade: { value: 0 } };
            const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
            const triangle = new BufferGeometry();
            triangle.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
            const quad = new Mesh(triangle, material);
            quad.frustumCulled = false;
            const scene = new Scene();
            scene.add(quad);
            const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

            let isReady = false;
            ready.then(() => {
                isReady = true;
            }, () => {
                isReady = true;
            });
            let skipped = false;
            const skip = (event) => {
                if (event.type === 'keydown' && event.key !== 'Escape') return;
                // While flying, a tap belongs to the flight, not to the city waiting underneath.
                if (event.type === 'pointerdown') event.stopPropagation();
                skipped = true;
            };
            window.addEventListener('keydown', skip);
            window.addEventListener('pointerdown', skip, true);

            // E's lines, one after another, each for as long as it takes to read.
            const durations = lines.map(secondsFor);
            const starts = durations.map((_, index) => FADE_IN * 0.5 + durations.slice(0, index).reduce((sum, value) => sum + value, 0));
            const passage = FADE_IN * 0.5 + durations.reduce((sum, value) => sum + value, 0);
            let frames = 0;
            let shown = -1;
            let endingAt = null;
            await new Promise((resolve) => {
                const began = performance.now();
                const frame = (now) => {
                    const t = (now - began) / 1000;
                    fit?.();
                    renderer.getDrawingBufferSize(size);
                    uniforms.time.value = t;
                    if (endingAt === null && (skipped || t >= passage) && isReady) endingAt = t;
                    uniforms.fade.value = endingAt === null
                        ? Math.min(1, t / FADE_IN)
                        : Math.max(0, 1 - (t - endingAt) / FADE_OUT);
                    renderer.setRenderTarget(null);
                    renderer.render(scene, camera);
                    frames += 1;
                    let line = -1;
                    while (line + 1 < starts.length && t >= starts[line + 1]) line += 1;
                    if (endingAt === null && !skipped && line > shown && line < lines.length) {
                        shown = line;
                        say(lines[line], durations[line]);
                    }
                    if (endingAt !== null && t - endingAt >= FADE_OUT) {
                        resolve();
                        return;
                    }
                    requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
            });

            window.removeEventListener('keydown', skip);
            window.removeEventListener('pointerdown', skip, true);
            material.dispose();
            triangle.dispose();
            leave();
            return { frames, skipped, linesShown: shown + 1 };
        },

        /** No flight: hold the card until the city is ready, then crossfade. */
        async crossfade({ ready }) {
            root.dataset.threshold = 'crossfade';
            await ready.catch(() => {});
            card.classList.add('is-leaving');
            await wait(CROSSFADE_MS);
            leave();
            return { frames: 0, skipped: false, linesShown: 0 };
        },
    };
}
