/**
 * sea.js — the Elysian Sea, where it meets the island.
 *
 * Violet-dark water east of the golden wall. It mirrors the same dusk as the
 * sky (the colours are shared, from sky.js), and at the wall's foot it holds
 * the golden bricking's reflection, broken by the swell. Breakers burst
 * silver and violet along the wall ("the sea erupts in bursts of silver and
 * violet, tumbling up the golden bricking", Numbers by Paint, Episode 1); the
 * swell is drawn as light crest lines drifting in; near the rim the water
 * stops behaving like water and breaks into flickering blocks, the place where
 * the world glitches. Colours are linear; the ink pass tone-maps them.
 */

// =============================================================================
// Imports
// =============================================================================

import { Color, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { ISLAND_RADIUS, SEA_LEVEL, rimRadiusGLSL, wallXGLSL } from './kit.js';
import { DUSK_GLSL } from './sky.js';

/** The top of the sea-wall's face above the water (its merlons stand higher, but gapped). */
const WALL_TOP = 3.1;

// =============================================================================
// Shaders
// =============================================================================

const vertexShader = /* glsl */ `
    uniform float time;

    varying vec3 vWorld;
    varying vec3 vNormal;

    #include <fog_pars_vertex>

    void addWave(vec2 p, vec2 direction, float frequency, float speed, float amplitude, inout float height, inout vec2 slope) {
        float phase = dot(direction, p) * frequency + time * speed;
        height += amplitude * sin(phase);
        slope += amplitude * frequency * cos(phase) * direction;
    }

    void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        float height = 0.0;
        vec2 slope = vec2(0.0);
        addWave(world.xz, normalize(vec2(-1.0, 0.25)), 0.55, 1.1, 0.09, height, slope);
        addWave(world.xz, normalize(vec2(-0.7, -0.7)), 0.95, 1.6, 0.045, height, slope);
        addWave(world.xz, normalize(vec2(-0.3, 0.95)), 1.5, 2.2, 0.025, height, slope);
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
    uniform float edgeAngle;
    uniform vec3 sunDirection;
    uniform float horizonDip;
    uniform vec3 deepColor;
    uniform vec3 wallGold;
    uniform vec3 silver;
    uniform vec3 violet;

    varying vec3 vWorld;
    varying vec3 vNormal;

    #include <fog_pars_fragment>

    ${rimRadiusGLSL()}
    ${wallXGLSL()}
    ${DUSK_GLSL}

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
        float fromWall = vWorld.x - wallX(vWorld.z);
        if (fromWall < -0.2) discard;

        float angle = atan(vWorld.z, vWorld.x);
        float toRim = rimRadius(angle) - length(vWorld.xz);
        // The glitch is strongest at the edge place and only simmers elsewhere on the rim.
        float fromEdge = mod(angle - edgeAngle + 3.14159265, 6.28318531) - 3.14159265;
        float nearEdge = exp(-pow(fromEdge / 0.35, 2.0));
        float reach = 0.5 + 1.8 * nearEdge;
        vec2 block = floor(vWorld.xz * 1.5);
        float tick = floor(time * 6.0);
        if (toRim < 0.0) discard;
        if (toRim < reach && hash12(block + tick * 0.371) > 0.35 + (toRim / reach) * 0.65) discard;

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

        // Drawn swell: thin light crests drifting in toward the wall, like engraved waves.
        float swell = fract(vWorld.x * 0.55 + sin(vWorld.z * 0.3 + time * 0.15) * 1.2 + time * 0.25);
        color = mix(color, mix(violet, silver, 0.35) * 0.8, smoothstep(0.9, 0.95, swell) * (1.0 - smoothstep(0.97, 1.0, swell)) * 0.4);

        // Breakers: flat, drawn shapes of silver and violet bursting along the wall's foot.
        float travel = sin(vWorld.z * 0.7 + time * 0.9 + 2.0 * sin(vWorld.z * 0.23 + time * 0.37));
        float burst = smoothstep(0.35, 1.0, travel);
        float field = exp(-max(fromWall, 0.0) * 0.5) * (0.4 + 0.75 * burst);
        field += (hash12(floor(vWorld.xz * 4.0) + tick) - 0.5) * 0.14;
        float fringe = smoothstep(0.34, 0.38, field);
        float crest = smoothstep(0.62, 0.66, field);
        color = mix(color, violet, fringe * 0.85);
        color = mix(color, silver, crest);

        float band = smoothstep(reach + 0.4, 0.0, toRim);
        float flash = step(0.82 - 0.12 * nearEdge, hash12(block * 1.7 + tick));
        vec3 glitch = mix(vec3(0.95, 0.2, 0.85), vec3(0.2, 0.95, 0.9), hash12(block + 3.1));
        color = mix(color, glitch, band * flash * (0.35 + 0.5 * nearEdge));

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {import('three').Vector3} options.sunDirection
 * @param {number} options.edgeAngle - where on the rim the edge place is (radians, atan2(z, x))
 */
export function createSea({ sunDirection, edgeAngle, horizonDip = { value: 0.16 } }) {
    const west = 7.4;
    const east = ISLAND_RADIUS * 1.08;
    const extent = ISLAND_RADIUS * 1.1;
    const geometry = new PlaneGeometry(east - west, extent * 2, 48, 120);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((west + east) / 2, SEA_LEVEL, 0);

    const uniforms = UniformsUtils.merge([
        UniformsLib.fog,
        {
            time: { value: 0 },
            edgeAngle: { value: edgeAngle },
            sunDirection: { value: sunDirection.clone().normalize() },
            deepColor: { value: new Color(0x1a1040) },
            wallGold: { value: new Color(0xd8a44c) },
            silver: { value: new Color(0xe8eaf8) },
            violet: { value: new Color(0x9a72ea) },
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
    };
}
