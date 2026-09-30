/**
 * dust.js — the city comes apart into gold dust where the camera passes: a trial (trials.js), on unless ?dust=off.
 *
 * Elm: "doooo you think it might be not too difficultly possible to make it so the fade to transparent golden dust
 * effect with the bridges can be expanded to work on everything, the ribbons, the wall, the buildings, etc? that
 * the camera might try to go through?"
 *
 * Everything that stands (never the ground, the rock, the sea or the sky; the golden bridges keep their own, which
 * this grew from) learns the bridges' opening: close about the camera's lens, and, while walking, about the line
 * from the camera to the shadow, stopping a little short of it, so the wall it walks beside stays whole. Each
 * opening is clean, the surface simply gone, with a narrow grain at the edge (so the ink draws one line round the
 * opening, not one round every speck); and the edge itself turns to gold as it goes, glittering, grain by grain.
 * So the walking camera no longer climbs over whatever's in the way (walk.js): it stays low behind the shadow, and
 * the way opens instead.
 *
 * (Nothing is drawn twice for it: where the bridges' dust is a haze drawn over them again, the city's is only at
 * the edges of the openings, in the surfaces' own light, which costs no more draws and no more triangles.)
 */

// =============================================================================
// Imports
// =============================================================================

import { Vector4 } from 'three';
import { alsoBeforeCompile } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** About the camera's lens: open within this far, whole again from this far (world units). */
const NEAR_OPEN = 1.1;
const NEAR_FADE = 3.0;
/** About the line from the camera to the shadow: open within this far of it, whole again from this far. */
const SIGHT_OPEN = 0.7;
const SIGHT_FADE = 1.45;
/** The line stops this far short of the shadow's middle (world units), so what stands beside it stays whole. */
const KEEP = 0.9;
/** How wide the gilded band at an opening's edge is (in the opening's own measure, 0 to 1), and how gold. */
const GILT_BAND = 0.26;
const GILT = 0.92;

/**
 * dustAt(world): how far into an opening a world point lies (0 whole, 1 wholly gone); dustSight: the shadow's
 * middle, and 1 while walking; dustTime: seconds, for the glitter. (The grain is a pixel's, two to a side.)
 */
const DUST_GLSL = /* glsl */ `
    uniform vec4 dustSight;
    uniform float dustTime;
    varying vec3 vDustWorld;
    float dustGrain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float dustAt(vec3 p) {
        float near = 1.0 - smoothstep(${NEAR_OPEN.toFixed(2)}, ${NEAR_FADE.toFixed(2)}, distance(p, cameraPosition));
        float sight = 0.0;
        if (dustSight.w > 0.5) {
            vec3 ab = dustSight.xyz - cameraPosition;
            float reach = max(length(ab), 1e-3);
            float t = clamp(dot(p - cameraPosition, ab) / (reach * reach), 0.0, 1.0);
            float off = distance(p, cameraPosition + ab * t);
            float stop = 1.0 - ${KEEP.toFixed(2)} / reach;
            sight = (1.0 - smoothstep(${SIGHT_OPEN.toFixed(2)}, ${SIGHT_FADE.toFixed(2)}, off))
                * smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(stop - 0.04, stop, t));
        }
        return max(near, sight);
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
        dustSight: { value: new Vector4(0, 0, 0, 0) },
        dustTime: { value: 0 },
    };

    return {
        uniforms,
        /** The shadow's middle, and 1 while walking (walk.js sets it, as it does the bridges'). */
        sight: uniforms.dustSight.value,

        /**
         * Teach a material to come apart where the camera passes, its edges gilded. (Any of three's own materials:
         * it needs their common, begin_vertex and opaque_fragment chunks.)
         * @param {import('three').Material} material
         */
        dissolve(material) {
            alsoBeforeCompile(material, 'dust', (shader) => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vDustWorld;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDustWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', `#include <common>\n${DUST_GLSL}`)
                    // (Nothing is worked out for the grain where there's no dust at all, which is almost everywhere.)
                    .replace('void main() {', [
                        'void main() {',
                        '    float dust = dustAt(vDustWorld);',
                        '    vec2 dustCell = floor(gl_FragCoord.xy / 2.0);',
                        '    float dustGilt = 0.0;',
                        '    if (dust > 0.0) {',
                        '        float dustEdge = 0.42 + 0.03 * dustGrain(dustCell);',
                        '        if (dust > dustEdge) discard;',
                        `        dustGilt = smoothstep(dustEdge - ${GILT_BAND.toFixed(2)}, dustEdge, dust);`,
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
