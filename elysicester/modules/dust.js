/**
 * dust.js — the city comes apart into gold dust where the camera passes: a trial (trials.js), on unless ?dust=off.
 *
 * Elm: "doooo you think it might be not too difficultly possible to make it so the fade to transparent golden dust
 * effect with the bridges can be expanded to work on everything, the ribbons, the wall, the buildings, etc? that
 * the camera might try to go through?" And then: "Can we make the dust more expansive so that we never lose sight
 * of the shadow nor any part of the shadow, please?" And: "some objects are contained by other objects, and the dust
 * may sometimes dissolve the outmost object even as the inner objects remain stable".
 *
 * Everything in the city learns the golden bridges' opening, which this grew from: every wall, roof, step and post,
 * the rock, the bridges themselves, and whatever stands within anything else (never a floor at or below the
 * shadow's own level, where it lies, nor the sea or the sky). It opens close about the camera's lens, and, while
 * walking, about the lines from the camera to the whole of the shadow (walk.js aims them: the one casting it; the
 * shadow along the ground, from its feet to its tip, or to the wall that catches it; and up that wall). Each line
 * stops a little short of where it's aimed, so the wall the shadow climbs stays whole, with the shadow on it. Each
 * opening is clean, the surface simply gone, with a narrow grain at the edge (so the ink draws one line round the
 * opening, not one round every speck); and the edge itself turns to gold as it goes, grain by grain. So the walking
 * camera never climbs over whatever's in the way (walk.js): it stays low behind the shadow, and the way opens.
 *
 * (Nothing is drawn twice for it: where the bridges' dust is a haze drawn over them again, the city's is only at
 * the edges of the openings, in the surfaces' own light, which costs no more draws and no more triangles.)
 */

// =============================================================================
// Imports
// =============================================================================

import { Vector2, Vector4 } from 'three';
import { alsoBeforeCompile } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** About the camera's lens: open within this far, whole again from this far (world units; walk.js brings these in when it comes close). */
export const NEAR_OPEN = 1.1;
export const NEAR_FADE = 3.0;
/** About each line from the camera to the shadow: open within this far of it, whole again from this far. */
const SIGHT_OPEN = 0.95;
export const SIGHT_FADE = 1.75;
/** How many lines to the shadow there may be (walk.js): its feet (and the one casting it), its middle, its tip, up a wall. */
export const DUST_TARGETS = 4;
/** Floors (facing up) at most this far above the floor the shadow's on never come apart (a step is at most 0.5). */
const FLOOR_KEPT = 0.9;
/** How wide the gilded band at an opening's edge is (in the opening's own measure, 0 to 1), and how gold. */
const GILT_BAND = 0.26;
const GILT = 0.92;

/**
 * dustAt(world): how far into an opening a world point lies (0 whole, 1 wholly gone). dustNear: the lens's opening
 * (open, whole again). dustSight: the farthest any line reaches from the camera, squared (x: nothing further off
 * is looked at), the floor the one casting the shadow stands on (y), and 1 in w while walking. dustTargets: where the lines to the shadow are aimed (xyz),
 * each with how far short of it the line stops (w; below 0, no line). dustTime: seconds, for the glitter. (The
 * grain is a pixel's, two to a side.)
 */
const DUST_GLSL = /* glsl */ `
    uniform vec2 dustNear;
    uniform vec4 dustSight;
    uniform vec4 dustTargets[${DUST_TARGETS}];
    uniform float dustTime;
    varying vec3 vDustWorld;
    varying float vDustUp;
    float dustGrain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float dustAt(vec3 p) {
        float dust = 1.0 - smoothstep(dustNear.x, dustNear.y, distance(p, cameraPosition));
        vec3 fromLens = p - cameraPosition;
        if (dustSight.w > 0.5 && dot(fromLens, fromLens) < dustSight.x) {
            for (int i = 0; i < ${DUST_TARGETS}; i++) {
                vec4 target = dustTargets[i];
                if (target.w < 0.0) continue;
                vec3 ab = target.xyz - cameraPosition;
                float reach = max(length(ab), 1e-3);
                float t = clamp(dot(fromLens, ab) / (reach * reach), 0.0, 1.0);
                float off = distance(p, cameraPosition + ab * t);
                float stop = 1.0 - target.w / reach;
                dust = max(dust, (1.0 - smoothstep(${SIGHT_OPEN.toFixed(2)}, ${SIGHT_FADE.toFixed(2)}, off))
                    * smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(stop - 0.04, stop, t)));
            }
        }
        return dust;
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {boolean} options.reducedMotion - the glitter holds still
 */
export function createDust({ reducedMotion }) {
    const uniforms = {
        dustNear: { value: new Vector2(NEAR_OPEN, NEAR_FADE) },
        dustSight: { value: new Vector4(0, 0, 0, 0) },
        dustTargets: { value: Array.from({ length: DUST_TARGETS }, () => new Vector4(0, 0, 0, -1)) },
        dustTime: { value: 0 },
    };

    return {
        uniforms,
        /**
         * How far the lines reach from the camera, squared (x), the floor the one casting the shadow stands on (y), and
         * 1 in w while walking (walk.js sets it).
         */
        sight: uniforms.dustSight.value,
        /** Where the lines to the shadow are aimed, and how far short of each they stop (walk.js aims them). */
        targets: uniforms.dustTargets.value,
        /** The opening about the lens: open within x, whole again from y (walk.js brings it in when it comes close). */
        near: uniforms.dustNear.value,

        /**
         * Teach a material to come apart where the camera passes, its edges gilded. (Any of three's own materials:
         * it needs their common, begin_vertex and opaque_fragment chunks.)
         * @param {import('three').Material} material
         */
        dissolve(material) {
            alsoBeforeCompile(material, 'dust', (shader) => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vDustWorld;\nvarying float vDustUp;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDustWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDustUp = normalize(mat3(modelMatrix) * normal).y;');
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', `#include <common>\n${DUST_GLSL}`)
                    // (Nothing is worked out for the grain where there's no dust at all, which is almost everywhere.)
                    .replace('void main() {', [
                        'void main() {',
                        // (A floor, facing up, no higher than a step or so above the shadow's own level, stays whole, so the
                        // shadow always has somewhere to lie and nothing opens under the camera where it steps down: a
                        // platform the shadow has just left stood 0.38 above it; and, the camera not walking, every floor does.)
                        `    bool dustFloor = vDustUp > 0.6 && (dustSight.w < 0.5 || vDustWorld.y < dustSight.y + ${FLOOR_KEPT.toFixed(2)});`,
                        '    float dustHere = dustFloor ? 0.0 : dustAt(vDustWorld);',
                        '    vec2 dustCell = floor(gl_FragCoord.xy / 2.0);',
                        '    float dustGilt = 0.0;',
                        '    if (dustHere > 0.0) {',
                        '        float dustEdge = 0.42 + 0.03 * dustGrain(dustCell);',
                        '        if (dustHere > dustEdge) discard;',
                        `        dustGilt = smoothstep(dustEdge - ${GILT_BAND.toFixed(2)}, dustEdge, dustHere);`,
                        '    }',
                    ].join('\n'))
                    // (Toward the edge, more and more of the surface is gold grains, each coming and going at a
                    // pace of its own, a few of them bright.)
                    .replace('#include <opaque_fragment>', [
                        '    if (dustGilt > 0.0) {',
                        '        float grain = dustGrain(dustCell);',
                        '        float phase = dustGrain(dustCell + 7.31);',
                        '        float shows = step(fract(phase + dustTime * (0.35 + 0.5 * grain)), dustGilt * 0.85);',
                        '        vec3 gold = vec3(1.0, 0.72, 0.3) * (0.8 + 0.9 * step(0.92, grain));',
                        `        outgoingLight = mix(outgoingLight, gold, shows * ${GILT.toFixed(2)});`,
                        '    }',
                        '#include <opaque_fragment>',
                    ].join('\n'));
            });
            return material;
        },

        /** Every frame: the glitter's clock. */
        update(elapsed) {
            if (!reducedMotion) uniforms.dustTime.value = elapsed;
        },
    };
}
