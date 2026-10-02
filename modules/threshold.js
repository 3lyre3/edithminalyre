/**
 * threshold.js — the way in: a choice, then the Mega-Screen, then the Intermaze (with ?choice=off, the Mega-Screen
 * first).
 *
 * On trial (choice: trials.js; main.js), the choice comes first, and nothing before it (Elm: "the choice of staying and
 * reading or playing and winning should come before the ascii swirl"); "Explore" brings the Mega-Screen's card
 * (showCard: Elm, "the mega-screen card was still good ... is there any chance though that the mega screen could show
 * up after the choice page and before the ascii swirl?"), and the card's own gesture begins the Intermaze.
 *
 * The Mega-Screen's title card: a dark screen across which
 * enormous letters roll in from the right, a short step left with each
 * flicker, spelling INSERT BLUTIX (Numbers by Paint, Episode 1, p. 29). One tap
 * or keypress begins, and that same gesture unlocks sound if the visitor has
 * switched it on.
 *
 * Then the Intermaze: a flight through shifting, mirror-coloured depths and
 * blue-red mirror-gates ringed with nodes, after the wheel at the centre of
 * Elm's cosmology plate, drawn in characters as ASCII art is (Elm's ask): each
 * cell of a grid takes the maze's colour at its middle, and a character as
 * dense as that colour is bright. (The bars of the Heltix's caged chassis stood
 * in front of it once, and the rail E leans against ran low across it: ?bars=on
 * brings both back, to compare; Elm let the swirl stand without them.) The flight
 * doubles as the loading screen: it ends once the city is ready and a minimum
 * passage has played. A tap or Esc skips it (the city still has to be ready).
 * On the way, E's inner voice surfaces a line at a time. Under reduced motion
 * there is no flight; the card crossfades to the city.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    CanvasTexture,
    Float32BufferAttribute,
    LinearFilter,
    Mesh,
    OrthographicCamera,
    Scene,
    ShaderMaterial,
    Vector2,
} from 'three';

// =============================================================================
// Constants
// =============================================================================

/** Each of E's lines stays long enough to read (and re-read): a base, plus a little for every word. */
const LINE_BASE = 1.0;
const LINE_PER_WORD = 0.3;
const LINE_MIN = 1.6;
const LINE_MAX = 4.6;
const FADE_IN = 0.8;
const FADE_OUT = 0.45;
const CROSSFADE_MS = 900;

/**
 * The Intermaze's characters: at least this many rows down the screen and columns across it (so a phone held
 * upright still draws the tunnel finely enough to see its shape), each cell this wide for its height.
 */
const ROWS = 44;
const COLUMNS = 48;
const CELL_ASPECT = 0.6;

/** The characters it may be drawn in (measured, then ranked from sparsest to densest), and how many ranks. */
const CHARACTERS = ` .'\`,:;-~_^"=+!<>*icvxzuoaeX#%&@`;
const RANKS = 16;

/** A character's cell in the atlas, in pixels. */
const GLYPH_WIDTH = 40;
const GLYPH_HEIGHT = 64;

const vertexShader = /* glsl */ `
    void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform float time;
    uniform vec2 resolution;
    uniform float fade;
    uniform sampler2D glyphs;
    uniform float glyphCount;
    uniform vec2 cell;
    uniform float bars;

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    // A mirror's sheen: pale gold through rust to deep blue and sky, never green.
    vec3 sheen(float t) {
        return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.1, 0.2) + t));
    }

    // The Intermaze at a point of the view (centred, in screen heights).
    vec3 maze(vec2 p) {
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
        return color * (0.3 + 0.7 * smoothstep(1.2, 0.2, r));
    }

    // One round iron bar of the chassis, across its width (s from -1 to 1), lit from the nether ahead on
    // the side toward the middle of the view (inward: +1 or -1). Returns its colour and how much of the
    // pixel it covers (w: its edge's softness, in the same units as s).
    vec4 bar(float s, float inward, float w, vec3 behind) {
        float cover = smoothstep(1.0 + w, 1.0 - w, abs(s));
        float c = clamp(s, -1.0, 1.0);
        vec2 normal = vec2(c, sqrt(1.0 - c * c));
        vec2 light = normalize(vec2(0.75 * inward, 0.65));
        float diffuse = max(dot(normal, light), 0.0);
        float shine = pow(max(dot(normal, normalize(light + vec2(0.0, 1.0))), 0.0), 28.0);
        // Gunmetal with a body to it (so the whole bar reads against the dark, not only its lit side), the
        // maze's colours caught along the lit side, a hard shine, and a little of the glow on the far edge.
        vec3 iron = vec3(0.16, 0.14, 0.19) * (0.35 + 0.95 * diffuse) + behind * 0.16 * diffuse;
        iron += vec3(0.95, 0.88, 1.0) * shine * 0.65;
        iron += behind * 0.1 * smoothstep(0.55, 0.9, -c * inward);
        // A drawn edge, as the city's ink has.
        iron *= 1.0 - 0.8 * smoothstep(0.8, 0.99, abs(s));
        return vec4(iron, cover);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution;

        // The maze, in characters: each cell takes its colour at the cell's middle, and a character as dense
        // as that colour is bright; a faint glow of the colour behind, so the tunnel's shape still carries.
        vec2 cellIndex = floor(gl_FragCoord.xy / cell);
        vec2 middle = (cellIndex + 0.5) * cell;
        vec3 tone = maze((middle - 0.5 * resolution) / resolution.y);
        float bright = clamp(dot(tone, vec3(0.3, 0.55, 0.15)), 0.0, 1.0);
        float rank = min(glyphCount - 1.0, floor(pow(bright, 0.8) * glyphCount));
        vec2 inCell = fract(gl_FragCoord.xy / cell);
        float ink = texture2D(glyphs, vec2((rank + inCell.x) / glyphCount, inCell.y)).a;
        vec3 color = tone * 0.06 + (tone * 1.25 + 0.03) * ink;

        // (Asked for, ?bars=on: the bars of the Heltix's caged chassis, two to each side, swaying a little:
        // solid and round, slimmer on a tall, narrow screen; and the rail E leans against, low across the view,
        // round too, lit from above, a glint along its top. Elm let the swirl stand without either.)
        float pixel = 1.0 / resolution.y;
        if (bars > 0.5) {
            float aspect = resolution.x / resolution.y;
            float across = uv.x * aspect;
            float barHalf = 0.016 * min(1.0, aspect * 1.15);
            float sway = 0.004 * sin(time * 0.7) * aspect;
            for (int index = 0; index < 4; index++) {
                float at = (index < 2 ? 0.05 + 0.13 * float(index) : 0.95 - 0.13 * float(index - 2)) * aspect + sway;
                vec4 iron = bar((across - at) / barHalf, index < 2 ? 1.0 : -1.0, pixel / barHalf, tone);
                color = mix(color, iron.rgb, iron.a);
            }

            float railY = 0.085;
            float railHalf = 0.019;
            float t = (uv.y - railY) / railHalf;
            vec4 rail = bar(t, 1.0, pixel / railHalf, tone);
            float glint = smoothstep(0.25, 0.0, abs(t - 0.62)) * (0.55 + 0.45 * sin(uv.x * 9.0 - time * 1.3));
            color = mix(color, rail.rgb + vec3(0.85, 0.68, 0.36) * glint * 0.5, rail.a);
        }

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
 * The characters the Intermaze is drawn in, as a strip of white glyphs on nothing, sparsest first. Each
 * candidate is drawn and its ink measured (fonts differ from one device to the next), then RANKS of them are
 * chosen at even steps of ink, from none to the densest.
 */
function glyphAtlas() {
    const font = `600 ${Math.round(GLYPH_HEIGHT * 0.78)}px ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace`;
    const draw = (context, character, x) => {
        context.fillText(character, x + GLYPH_WIDTH / 2, GLYPH_HEIGHT / 2 + GLYPH_HEIGHT * 0.04);
    };
    const probe = document.createElement('canvas');
    probe.width = GLYPH_WIDTH;
    probe.height = GLYPH_HEIGHT;
    const measure = probe.getContext('2d', { willReadFrequently: true });
    measure.font = font;
    measure.textAlign = 'center';
    measure.textBaseline = 'middle';
    measure.fillStyle = '#fff';
    const inked = [...new Set(CHARACTERS)].map((character) => {
        measure.clearRect(0, 0, GLYPH_WIDTH, GLYPH_HEIGHT);
        draw(measure, character, 0);
        const alpha = measure.getImageData(0, 0, GLYPH_WIDTH, GLYPH_HEIGHT).data;
        let ink = 0;
        for (let index = 3; index < alpha.length; index += 4) ink += alpha[index];
        return { character, ink };
    }).sort((a, b) => a.ink - b.ink);
    const densest = inked[inked.length - 1].ink || 1;
    const chosen = [];
    for (let rank = 0; rank < RANKS; rank += 1) {
        const want = (densest * rank) / (RANKS - 1);
        const nearest = inked.reduce((best, entry) => (Math.abs(entry.ink - want) < Math.abs(best.ink - want) ? entry : best));
        if (!chosen.includes(nearest.character)) chosen.push(nearest.character);
    }

    const canvas = document.createElement('canvas');
    canvas.width = GLYPH_WIDTH * chosen.length;
    canvas.height = GLYPH_HEIGHT;
    const context = canvas.getContext('2d');
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    chosen.forEach((character, index) => draw(context, character, index * GLYPH_WIDTH));
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { texture, count: chosen.length };
}

/**
 * @param {object} options
 * @param {HTMLElement} options.root - <html>, which carries data-threshold
 * @param {HTMLElement} options.card - the Mega-Screen section
 * @param {HTMLButtonElement} options.begin - covers the card; its text is the prompt
 * @param {HTMLElement} options.voice - where E's lines surface
 * @param {() => void} [options.onBegin] - runs inside the beginning gesture itself
 *   (so sound may start, as browsers ask), before `begun` resolves
 * @param {boolean} [options.returning] - back within the same visit: no card and
 *   no flight; begun at once, with no gesture (so any sound waits for the
 *   visitor's first touch); see comeBack
 * @param {boolean} [options.choosing] - the way in begins at a choice (a trial,
 *   main.js: "Explore" or "Read"): no card yet; the threshold waits
 *   at 'choice' until main.js calls showCard (the visitor chose to explore)
 */
export function createThreshold({ root, card, begin, voice, onBegin, returning = false, choosing = false }) {
    root.dataset.threshold = returning ? 'returning' : choosing ? 'choice' : 'card';
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
        // (Nor a key still held from the choice before it.)
        if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        const target = event.target;
        if (target === begin && (event.key === 'Enter' || event.key === ' ')) return;
        if (target instanceof Element && target !== begin && target.closest('a, button, input, select, textarea')) return;
        event.preventDefault();
        start();
    }
    begin.addEventListener('click', start);
    if (returning) {
        started = true;
        card.hidden = true;
        resolveBegun();
    } else if (choosing) {
        // (The choice's own "Explore" brings the card: main.js calls showCard.)
        card.hidden = true;
    } else {
        document.addEventListener('keydown', onKey, true);
    }

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
        /** Resolves on the first tap, click or keypress (at once, coming back within the same visit). */
        begun,

        /** Begin, as the card's gesture does. Runs onBegin within it. */
        start,

        /**
         * After the choice ("Explore": main.js): the Mega-Screen's card, its letters rolling in from the start,
         * waiting for its own tap, click or keypress to begin.
         */
        showCard() {
            if (started || root.dataset.threshold !== 'choice') return;
            root.dataset.threshold = 'card';
            card.hidden = false;
            document.addEventListener('keydown', onKey, true);
            begin.focus({ preventScroll: true });
        },

        /** Coming back within the same visit: wait for the city, then step aside (it lifts from the dark). */
        async comeBack({ ready }) {
            await ready.catch(() => {});
            leave();
            return { frames: 0, skipped: false, linesShown: 0, returning: true };
        },

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
            const cell = new Vector2();
            const atlas = glyphAtlas();
            const uniforms = {
                time: { value: 0 },
                resolution: { value: size },
                fade: { value: 0 },
                glyphs: { value: atlas.texture },
                glyphCount: { value: atlas.count },
                cell: { value: cell },
                // The Heltix's bars and E's rail stand in front only when asked for (?bars=on): the swirl is the way in.
                bars: { value: new URLSearchParams(window.location.search).get('bars') === 'on' ? 1 : 0 },
            };
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
                    // At least ROWS of characters down the screen and COLUMNS across (never under 12 pixels tall).
                    const tall = Math.max(12, Math.min(size.y / ROWS, size.x / (COLUMNS * CELL_ASPECT)));
                    cell.set(tall * CELL_ASPECT, tall);
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
            atlas.texture.dispose();
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
