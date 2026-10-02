/**
 * sea.js — the Elysian Sea, where it meets the island.
 *
 * Violet-dark water east of the golden wall. It mirrors the same dusk as the
 * sky (the colours are shared, from sky.js), and at the wall's foot it holds
 * the golden bricking's reflection, broken by the swell. Breakers burst
 * silver and violet along the wall ("the sea erupts in bursts of silver and
 * violet, tumbling up the golden bricking", Numbers by Paint, Episode 1); the
 * swell is drawn as light crest lines drifting in. At the rim the swell dies
 * away and the water ends flush with the rock's edge, in one smooth line: its
 * sheet is built out to the rim's own corners (Elm wanted the island's edge
 * smooth, so the world's glitching is left to the shards floating off it, in
 * places.js). Colours are linear; the ink pass tone-maps them.
 */

// =============================================================================
// Imports
// =============================================================================

import { BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import { RIM_SEGMENTS, SEA_LEVEL, rimRadius, rimRadiusGLSL, wallX, wallXGLSL } from './kit.js';
import { DUSK_GLSL } from './sky.js';

// =============================================================================
// Constants
// =============================================================================

/** The top of the sea-wall's face above the water (its merlons stand higher, but gapped). */
const WALL_TOP = 3.1;

/** The water tucks this far in under the sea-wall's face. */
const UNDER_WALL = 0.2;

/** The water's sheet: rows from the wall's foot out to the rim, and the pieces each side of the rim is cut into. */
const ROWS = 40;
const CUTS = 3;

/** Within this much of the rim the swell dies away, so the water lies flat against the rock's edge. */
const CALM = 2.2;

/**
 * The swell, as GLSL: seaSwell(p, time, height, slope) gives the water's rise above the sea level at p (world x, z)
 * and its slope there, the rim's calm already in both. Shared, so what floats on the water (flowers.js) rides it.
 * (Needs rimRadius: rimRadiusGLSL() first, unless the shader has it already.)
 */
export const SWELL_GLSL = /* glsl */ `
    void seaWave(vec2 p, float time, vec2 direction, float frequency, float speed, float amplitude, inout float height, inout vec2 slope) {
        float phase = dot(direction, p) * frequency + time * speed;
        height += amplitude * sin(phase);
        slope += amplitude * frequency * cos(phase) * direction;
    }

    void seaSwell(vec2 p, float time, out float height, out vec2 slope) {
        height = 0.0;
        slope = vec2(0.0);
        seaWave(p, time, normalize(vec2(-1.0, 0.25)), 0.55, 1.1, 0.09, height, slope);
        seaWave(p, time, normalize(vec2(-0.7, -0.7)), 0.95, 1.6, 0.045, height, slope);
        seaWave(p, time, normalize(vec2(-0.3, 0.95)), 1.5, 2.2, 0.025, height, slope);
        // The swell dies away toward the rim: the water meets the rock's edge flat, and exactly at its height.
        float calm = smoothstep(0.0, ${CALM.toFixed(2)}, rimRadius(atan(p.y, p.x)) - length(p));
        height *= calm;
        slope *= calm;
    }
`;

// =============================================================================
// Shaders
// =============================================================================

const vertexShader = /* glsl */ `
    uniform float time;

    varying vec3 vWorld;
    varying vec3 vNormal;

    #include <fog_pars_vertex>

    ${rimRadiusGLSL()}
    ${SWELL_GLSL}

    void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        float height;
        vec2 slope;
        seaSwell(world.xz, time, height, slope);
        world.y += height;
        vWorld = world;
        vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
    }
`;

const fragmentShader = /* glsl */ `
    uniform float time;
    uniform vec3 sunDirection;
    uniform float horizonDip;
    uniform vec3 deepColor;
    uniform vec3 wallGold;
    uniform vec3 silver;
    uniform vec3 violet;
    uniform vec3 warmth;

    varying vec3 vWorld;
    varying vec3 vNormal;

    #include <fog_pars_fragment>

    ${wallXGLSL()}
    ${DUSK_GLSL}

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    // Smooth value noise (0 to 1), for edges that waver without breaking into blocks.
    float smoothNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash12(cell);
        float b = hash12(cell + vec2(1.0, 0.0));
        float c = hash12(cell + vec2(0.0, 1.0));
        float d = hash12(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
        float fromWall = vWorld.x - wallX(vWorld.z);
        if (fromWall < -${UNDER_WALL.toFixed(2)}) discard;

        vec3 normal = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);

        // The dusk, mirrored: the hot horizon line at a glance along the water, the night overhead
        // straight down into it; the sea keeps its own violet beneath.
        vec3 mirrored = reflect(-view, normal);
        vec3 sky = dusk(max(mirrored.y + horizonDip, 0.0), towardSun(mirrored));
        vec3 color = mix(deepColor, violet * 0.42, 0.18 + 0.5 * fresnel) + sky * fresnel * 0.55;

        // The golden bricking, mirrored at its foot where a glance off the water would meet it,
        // broken up by the swell.
        if (mirrored.x < -0.04) {
            float reach = max(fromWall, 0.0) / -mirrored.x;
            float meets = vWorld.y + mirrored.y * reach;
            float onWall = step(meets, ${WALL_TOP.toFixed(2)}) * step(${(SEA_LEVEL - 0.4).toFixed(2)}, meets) * exp(-reach * 0.05);
            float broken = 0.55 + 0.45 * smoothstep(-0.3, 0.6, sin(vWorld.z * 2.3 + sin(vWorld.x * 1.7 + time * 0.8) * 1.4 + time * 0.6));
            float rows = 0.85 + 0.15 * step(0.5, fract(meets / 0.6));
            color = mix(color, wallGold * rows, onWall * broken * (0.28 + 0.4 * fresnel));
        }

        vec3 halfway = normalize(view + normalize(sunDirection));
        color += vec3(0.85, 0.8, 1.0) * step(0.9975, max(dot(normal, halfway), 0.0)) * 0.9;

        // The sun-dock "grew upon the water's surface": its warmth lies on the water round it.
        vec2 fromDock = vWorld.xz - warmth.xy;
        float warm = exp(-dot(fromDock, fromDock) / (warmth.z * warmth.z));
        color += vec3(1.0, 0.58, 0.2) * warm * (0.16 + 0.14 * fresnel);

        // Drawn swell: thin light crests drifting in toward the wall, like engraved waves (gilded by the dock).
        float swell = fract(vWorld.x * 0.55 + sin(vWorld.z * 0.3 + time * 0.15) * 1.2 + time * 0.25);
        float crestLine = smoothstep(0.9, 0.95, swell) * (1.0 - smoothstep(0.97, 1.0, swell));
        color = mix(color, mix(mix(violet, silver, 0.35) * 0.8, vec3(1.3, 0.85, 0.42), warm), crestLine * (0.4 + 0.35 * warm));

        // Breakers: flat, drawn shapes of silver and violet bursting along the wall's foot, their edges
        // wavering smoothly as the water moves.
        float travel = sin(vWorld.z * 0.7 + time * 0.9 + 2.0 * sin(vWorld.z * 0.23 + time * 0.37));
        float burst = smoothstep(0.35, 1.0, travel);
        float field = exp(-max(fromWall, 0.0) * 0.5) * (0.4 + 0.75 * burst);
        field += (smoothNoise(vWorld.xz * 2.2 + vec2(time * 0.5, -time * 0.35)) - 0.5) * 0.14;
        // Beneath the sun-dock's light the water lies calm: the breakers don't burst there.
        field *= 1.0 - 0.9 * exp(-dot(fromDock, fromDock) / 14.0) * step(0.01, warmth.z);
        float fringe = smoothstep(0.34, 0.38, field);
        float crest = smoothstep(0.62, 0.66, field);
        color = mix(color, violet, fringe * 0.85);
        color = mix(color, silver, crest);

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/** A corner of the rim's polygon as the rock draws it (island.js): segment `index`, any whole number (it wraps). */
function rimCorner(index) {
    const angle = (index / RIM_SEGMENTS) * Math.PI * 2;
    const radius = rimRadius(angle);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** How far a point on the rim stands east of the line the water tucks in to (the wall's face, less UNDER_WALL). */
function eastOfWall([x, z]) {
    return x - (wallX(z) - UNDER_WALL);
}

/**
 * The water's sheet, from the wall's foot out to the rim. Its outer edge runs through the rock's own corners
 * (each side cut in CUTS along its straight line), so the water ends exactly where the rock's edge is: one
 * clean line, which the ink pass's samples smooth. Each column runs out from the island's middle, from where
 * it meets the wall's line to the rim, in ROWS; at either end the rim meets the wall and the column closes to
 * a point.
 */
function waterSheet() {
    // The rim, corner by corner, round the sea's side (east, where x is greatest), cut along each side.
    const rim = [];
    for (let index = -RIM_SEGMENTS / 2; index < RIM_SEGMENTS / 2; index += 1) {
        const from = rimCorner(index);
        const to = rimCorner(index + 1);
        for (let cut = 0; cut < CUTS; cut += 1) {
            const t = cut / CUTS;
            rim.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
        }
    }
    rim.push(rimCorner(RIM_SEGMENTS / 2));

    // The run of it east of the wall's line, closed at either end exactly where the rim crosses that line.
    const inside = rim.map((point) => eastOfWall(point) > 0);
    const first = inside.indexOf(true);
    const last = inside.lastIndexOf(true);
    const crossing = (outside, within) => {
        let [a, b] = [0, 1];
        for (let step = 0; step < 30; step += 1) {
            const middle = (a + b) / 2;
            const point = [outside[0] + (within[0] - outside[0]) * middle, outside[1] + (within[1] - outside[1]) * middle];
            if (eastOfWall(point) > 0) b = middle;
            else a = middle;
        }
        return [outside[0] + (within[0] - outside[0]) * b, outside[1] + (within[1] - outside[1]) * b];
    };
    const edge = [crossing(rim[first - 1], rim[first]), ...rim.slice(first, last + 1), crossing(rim[last + 1], rim[last])];

    // Each column: from where the line out from the middle meets the wall's line, out to its point on the rim.
    const positions = [];
    for (const [x, z] of edge) {
        const out = Math.hypot(x, z);
        const [dx, dz] = [x / out, z / out];
        let [near, far] = [0, out];
        for (let step = 0; step < 30; step += 1) {
            const middle = (near + far) / 2;
            if (eastOfWall([dx * middle, dz * middle]) > 0) far = middle;
            else near = middle;
        }
        for (let row = 0; row <= ROWS; row += 1) {
            const along = far + ((out - far) * row) / ROWS;
            positions.push(dx * along, SEA_LEVEL, dz * along);
        }
    }
    const indices = [];
    for (let column = 0; column < edge.length - 1; column += 1) {
        for (let row = 0; row < ROWS; row += 1) {
            const a = column * (ROWS + 1) + row;
            const b = a + ROWS + 1;
            // Wound to face up (the columns go round with the angle, the rows outward).
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
}

/**
 * @param {object} options
 * @param {import('three').Vector3} options.sunDirection
 */
export function createSea({ sunDirection, horizonDip = { value: 0.16 } }) {
    const geometry = waterSheet();

    const uniforms = UniformsUtils.merge([
        UniformsLib.fog,
        {
            time: { value: 0 },
            sunDirection: { value: sunDirection.clone().normalize() },
            deepColor: { value: new Color(0x1a1040) },
            wallGold: { value: new Color(0xd8a44c) },
            silver: { value: new Color(0xe8eaf8) },
            violet: { value: new Color(0x9a72ea) },
            // Where the sun-dock's warmth lies on the water: x, z and how far it reaches (none until set).
            warmth: { value: new Vector3(0, 0, 1e-3) },
        },
    ]);
    // The sky's own horizon, shared, so the water mirrors the dusk exactly where the sky has it.
    uniforms.horizonDip = horizonDip;
    const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'sea';

    return {
        mesh,
        update(time) {
            uniforms.time.value = time;
        },
        /** Lay a warm light on the water about (x, z), out to `reach`: the sun-dock's. */
        warmAt(x, z, reach) {
            uniforms.warmth.value.set(x, z, reach);
        },
        /**
         * Let the walk's shadow fall on the water too (walk.js): its GLSL (which defines
         * walkerShade(world)) and its uniforms. Called before the water is first drawn.
         */
        receiveWalker(glsl, walkerUniforms) {
            Object.assign(uniforms, walkerUniforms);
            material.fragmentShader = material.fragmentShader
                .replace('    void main() {', [
                    glsl,
                    '    uniform sampler2D walkerDecks;',
                    '    uniform vec4 walkerDeckRegion;',
                    '    uniform vec4 walkerDeck;',
                    '    uniform vec3 walkerToLight;',
                    '    uniform vec4 walkerDisc;',
                    // Standing on a deck, the walker's shadow falls on the deck; only what misses it (the light
                    // passing the deck's edge, at the walker's height) comes down to the water. And where the
                    // sun-dock's light lies on the water, the shadow is the light's, cut from it: the water under
                    // the light takes none (else it showed twice there, the water's a little off the light's).
                    '    float walkerOnWater(vec3 world) {',
                    '        float shade = walkerShade(world);',
                    '        if (shade <= 0.0) return 0.0;',
                    '        if (walkerDisc.w > 0.5) shade *= smoothstep(walkerDisc.z * 0.85, walkerDisc.z * 1.02, distance(world.xz, walkerDisc.xy));',
                    '        if (shade <= 0.0 || walkerDeck.w < 0.5) return shade;',
                    '        vec3 up = world + walkerToLight * ((walkerDeck.y - world.y) / max(walkerToLight.y, 0.05));',
                    '        vec2 at = (up.xz - walkerDeckRegion.xy) * walkerDeckRegion.zw;',
                    '        if (at.x <= 0.0 || at.y <= 0.0 || at.x >= 1.0 || at.y >= 1.0) return shade;',
                    '        return texture2D(walkerDecks, at).r > 0.5 ? 0.0 : shade;',
                    '    }',
                    '',
                    '    void main() {',
                ].join('\n'))
                .replace('gl_FragColor = vec4(color, 1.0);', [
                    'color = mix(color, color * vec3(0.3, 0.26, 0.36), walkerOnWater(vWorld) * 0.72);',
                    '        gl_FragColor = vec4(color, 1.0);',
                ].join('\n'));
            material.needsUpdate = true;
        },
    };
}
