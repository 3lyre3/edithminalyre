/**
 * hollows.js — the soft darkness that gathers where things stand close.
 *
 * Elm's pencil darkens the hollows: the arcade's dark mouth, the crevices
 * between a great tree's roots, the underside of every floating island in her
 * cosmology plate. Here the same darkness gathers at the feet of walls, in the
 * narrow ways between houses, on the ground at a house's side, and under
 * eaves, balconies and bridges.
 *
 * The city stands still, so its hollows are found once: a worker lays a map
 * of what stands where (hollows-map.js) while the flight into the city plays,
 * and each surface looks a little way out from itself, at its own height, to
 * see how much stands round it, taller than it. It costs one texture look-up a
 * pixel, and nothing to download. Until the map is laid the city is drawn
 * without it; then the darkness comes in over a second, as a pencil goes back
 * over a drawing.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    ClampToEdgeWrapping,
    Color,
    DataTexture,
    LinearFilter,
    RGBAFormat,
    UnsignedByteType,
    Vector4,
} from 'three';
import { HOLLOW_ACROSS, HOLLOW_DOWN, HOLLOW_REGION, HOLLOW_TEXEL, buildHollowData } from './hollows-map.js';
import { alsoBeforeCompile, groundYGLSL } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** The merged meshes whose pieces stand on the ground (the island's rock is the ground's own). */
const STANDING = new Set(['gold', 'bricking', 'brick', 'stone', 'steel', 'copper']);
/** The materials the darkness gathers on. */
export const HOLLOWED = ['gold', 'bricking', 'dimGold', 'brick', 'stone', 'steel', 'copper'];
/** How long the darkness takes to come in, once the map is laid (seconds). */
const COMING_IN = 1.2;

// =============================================================================
// The map
// =============================================================================

/** Every standing triangle (the merged buckets sit at the origin), with the upward part of its normal. */
function standingTriangles(meshes) {
    const chunks = [];
    let vertices = 0;
    for (const [key, mesh] of meshes) {
        if (!STANDING.has(key)) continue;
        const { position, normal } = mesh.geometry.attributes;
        for (const [first, count] of mesh.userData.solidRanges ?? []) {
            chunks.push([position.array.subarray(first * 3, (first + count) * 3), normal.array.subarray(first * 3, (first + count) * 3)]);
            vertices += count;
        }
    }
    const triangles = new Float32Array(vertices * 3);
    const upwards = new Float32Array(Math.floor(vertices / 3));
    let offset = 0;
    let triangle = 0;
    for (const [positions, normals] of chunks) {
        triangles.set(positions, offset);
        offset += positions.length;
        for (let i = 0; i + 8 < normals.length; i += 9) {
            upwards[triangle] = (normals[i + 1] + normals[i + 4] + normals[i + 7]) / 3;
            triangle += 1;
        }
    }
    return { triangles, upwards };
}

/**
 * Set the map of what stands where to be laid, from the city's merged meshes.
 * The texture exists at once (empty, and the darkness off), so the materials
 * compile with it; the worker fills it in.
 * @param {Map<string, import('three').Mesh>} meshes - by bucket, as Buckets.build returns them
 * @param {object} [options]
 * @param {boolean} [options.reducedMotion] - the darkness arrives at once rather than coming in
 */
export function createHollows(meshes, { reducedMotion = false } = {}) {
    const data = new Uint8Array(HOLLOW_ACROSS * HOLLOW_DOWN * 4);
    const texture = new DataTexture(data, HOLLOW_ACROSS, HOLLOW_DOWN, RGBAFormat, UnsignedByteType);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    // ?hollows=off leaves the city as it was drawn before (for comparing); the default is on.
    const wanted = new URLSearchParams(window.location.search).get('hollows') === 'off' ? 0 : 1;
    const strength = { value: 0 };
    let target = 0;
    let answered = false;

    const hollowMap = {
        texture,
        bounds: new Vector4(HOLLOW_REGION.x0, HOLLOW_REGION.z0, 1 / (HOLLOW_ACROSS * HOLLOW_TEXEL), 1 / (HOLLOW_DOWN * HOLLOW_TEXEL)),
        strength,
        available: false,
        build: null,
        ready: null,
        /** True once the map is laid (or can't be) and the darkness has fully come in: for the local checks. */
        get settled() {
            return answered && strength.value === target;
        },
        /** Bring the darkness in once the map is laid (every frame). */
        update(dt) {
            if (strength.value === target) return;
            strength.value = reducedMotion ? target : Math.min(target, strength.value + dt / COMING_IN);
        },
    };

    const lay = (result, started, where) => {
        data.set(result.data);
        texture.needsUpdate = true;
        hollowMap.available = true;
        hollowMap.build = { where, ms: result.ms, total: performance.now() - started, dropped: result.dropped, fullest: result.fullest };
        target = wanted;
        answered = true;
    };

    hollowMap.ready = new Promise((resolve) => {
        const started = performance.now();
        // Without a worker, the map is laid here instead: a moment's work, once.
        const here = () => {
            lay(buildHollowData(standingTriangles(meshes)), started, 'main thread');
            resolve(true);
        };
        let worker;
        try {
            worker = new Worker(new URL('./hollows-worker.js', import.meta.url), { type: 'module' });
        } catch {
            here();
            return;
        }
        worker.addEventListener('message', (event) => {
            worker.terminate();
            lay(event.data, started, 'worker');
            resolve(true);
        });
        for (const type of ['error', 'messageerror']) {
            worker.addEventListener(type, () => {
                worker.terminate();
                if (!answered) here();
            });
        }
        const input = standingTriangles(meshes);
        worker.postMessage(input, [input.triangles.buffer, input.upwards.buffer]);
    });
    return hollowMap;
}

// =============================================================================
// The darkness, per pixel
// =============================================================================

/**
 * Let the hollows darken a material. The darkness is a dusk violet, not black,
 * as the ground's drawn shadows are.
 * @param {import('three').Material} material
 * @param {ReturnType<typeof createHollows>} hollowMap
 * @param {object} [options]
 * @param {number} [options.shade] - the colour light is multiplied toward in the deepest hollow (hex)
 */
export function hollows(material, hollowMap, { shade = 0x6c5c8c } = {}) {
    alsoBeforeCompile(material, 'hollows', (shader) => {
        shader.uniforms.hollowMap = { value: hollowMap.texture };
        shader.uniforms.hollowBounds = { value: hollowMap.bounds };
        shader.uniforms.hollowStrength = hollowMap.strength;
        shader.uniforms.hollowShade = { value: new Color(shade) };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', [
                '#include <common>',
                'varying vec3 vHollowWorld;',
                'varying vec3 vHollowNormal;',
                'varying float vHollowHeight;',
                groundYGLSL(),
            ].join('\n'))
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                'vHollowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
                'vHollowNormal = normalize(mat3(modelMatrix) * objectNormal);',
                'vHollowHeight = vHollowWorld.y - groundY(vHollowWorld.xz);',
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', [
                '#include <common>',
                'uniform sampler2D hollowMap;',
                'uniform vec4 hollowBounds;',
                'uniform float hollowStrength;',
                'uniform vec3 hollowShade;',
                'varying vec3 vHollowWorld;',
                'varying vec3 vHollowNormal;',
                'varying float vHollowHeight;',
            ].join('\n'))
            .replace('#include <opaque_fragment>', [
                '{',
                '    vec3 outward = normalize(vHollowNormal);',
                '    // Look a little way out from the surface, at its own height (a roof looks from just above itself).',
                '    vec2 at = vHollowWorld.xz + outward.xz * 0.45;',
                '    float height = vHollowHeight + max(outward.y, 0.0) * 0.45;',
                '    vec4 taller = texture2D(hollowMap, (at - hollowBounds.xy) * hollowBounds.zw);',
                '    float standing = mix(taller.r, taller.g, smoothstep(0.5, 2.0, height));',
                '    standing = mix(standing, taller.b, smoothstep(2.0, 4.0, height));',
                '    standing = mix(standing, taller.a, smoothstep(4.0, 7.0, height));',
                '    // Only at the city\'s own level: not the roots under the island, nor the grottos overhead.',
                '    float level = smoothstep(-1.6, -0.6, vHollowHeight) * (1.0 - smoothstep(7.0, 11.0, height));',
                '    float hemmed = smoothstep(0.12, 0.7, standing) * level;',
                '    // Where a wall meets the ground (or the water), the dark gathers at its foot.',
                '    float upright = 1.0 - abs(outward.y);',
                '    float foot = (1.0 - smoothstep(0.0, 1.25, vHollowHeight)) * smoothstep(-1.6, -0.6, vHollowHeight) * upright;',
                '    // Under eaves, balconies and bridges: faces turned to the ground.',
                '    float under = smoothstep(0.35, 0.95, -outward.y) * smoothstep(0.2, 0.8, vHollowHeight);',
                '    float dark = clamp(max(hemmed, foot * 0.8) + under * 0.3, 0.0, 1.0) * hollowStrength;',
                '    outgoingLight *= mix(vec3(1.0), hollowShade, dark);',
                '}',
                '#include <opaque_fragment>',
            ].join('\n'));
    });
    return material;
}
