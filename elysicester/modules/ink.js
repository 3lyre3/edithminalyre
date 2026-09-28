/**
 * ink.js — the pass that makes the render read as drawn rather than rendered.
 *
 * The scene is drawn into an off-screen target that keeps its depth. This
 * pass then tone-maps the colour, lays light ink lines wherever the depth
 * folds (silhouettes and creases: the second difference of inverse depth is
 * zero across any flat plane, so only real edges ink), lets those lines
 * wobble a little like a hand's, lays a faint paper fibre over everything
 * (the page adds the site's own grain above), and darkens the corners a
 * touch. Under reduced motion the lines and fibre hold still.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    BufferGeometry,
    Color,
    DepthTexture,
    Float32BufferAttribute,
    HalfFloatType,
    Mesh,
    OrthographicCamera,
    Scene,
    ShaderMaterial,
    UnsignedByteType,
    Vector2,
    WebGLRenderTarget,
} from 'three';

// =============================================================================
// Shaders
// =============================================================================

const vertexShader = /* glsl */ `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    #include <packing>

    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float lineWidth;
    uniform float inkStrength;
    uniform vec3 inkColor;
    uniform float grainAmount;
    uniform float grainSeed;
    uniform float boil;

    varying vec2 vUv;

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float inverseDepth(vec2 uv) {
        float depth = texture2D(tDepth, uv).x;
        return -1.0 / perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
    }

    void main() {
        vec2 texel = lineWidth / resolution;
        vec2 wobble = vec2(noise(vUv * 24.0 + boil), noise(vUv * 24.0 + boil + 19.7)) - 0.5;
        vec2 uv = vUv + wobble * texel * 0.55;

        float centre = inverseDepth(uv);
        float left = inverseDepth(uv - vec2(texel.x, 0.0));
        float right = inverseDepth(uv + vec2(texel.x, 0.0));
        float down = inverseDepth(uv - vec2(0.0, texel.y));
        float up = inverseDepth(uv + vec2(0.0, texel.y));
        float fold = (abs(left + right - 2.0 * centre) + abs(up + down - 2.0 * centre)) / max(centre, 1e-6);
        float edge = smoothstep(0.012, 0.045, fold);

        vec3 color = texture2D(tColor, vUv).rgb;
        color = toneMapping(color);
        color = linearToOutputTexel(vec4(color, 1.0)).rgb;
        color = mix(color, inkColor, edge * inkStrength);

        float grain = hash12(floor(gl_FragCoord.xy) + grainSeed * 17.0) - 0.5;
        float fibre = noise(gl_FragCoord.xy * vec2(0.9, 0.05) + 3.7) - 0.5;
        color += grain * grainAmount + fibre * grainAmount * 0.35;

        vec2 centred = vUv - 0.5;
        color *= 1.0 - dot(centred, centred) * 0.6;

        gl_FragColor = vec4(color, 1.0);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {import('three').WebGLRenderer} renderer
 * @param {object} options
 * @param {boolean} options.reducedMotion - hold lines and grain still
 */
export function createInk(renderer, { reducedMotion }) {
    const size = renderer.getDrawingBufferSize(new Vector2());
    const canFloat = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const target = new WebGLRenderTarget(size.x, size.y, {
        type: canFloat ? HalfFloatType : UnsignedByteType,
        samples: Math.min(4, renderer.capabilities.maxSamples ?? 0),
        depthTexture: new DepthTexture(size.x, size.y),
    });

    const uniforms = {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        resolution: { value: size.clone() },
        cameraNear: { value: 0.5 },
        cameraFar: { value: 900 },
        lineWidth: { value: 1 },
        inkStrength: { value: 0.95 },
        inkColor: { value: new Color(0x1c130e) },
        // The page lays the site's own grain over everything; this is only the paper's fibre beneath it.
        grainAmount: { value: 0.025 },
        grainSeed: { value: 0 },
        boil: { value: 0 },
    };
    const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });

    const triangle = new BufferGeometry();
    triangle.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    triangle.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quad = new Mesh(triangle, material);
    quad.frustumCulled = false;

    const scene = new Scene();
    scene.add(quad);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
        target,
        /** Match the drawing buffer; lines stay a little over one CSS pixel wide, like a fine nib. */
        resize() {
            renderer.getDrawingBufferSize(size);
            target.setSize(size.x, size.y);
            uniforms.resolution.value.copy(size);
            uniforms.lineWidth.value = Math.max(1.3, renderer.getPixelRatio() * 1.15);
        },
        /** Draw the scene through the ink onto the canvas. */
        render(sceneToDraw, sceneCamera, time) {
            uniforms.cameraNear.value = sceneCamera.near;
            uniforms.cameraFar.value = sceneCamera.far;
            if (!reducedMotion) {
                uniforms.grainSeed.value = Math.floor(time * 20) % 97;
                uniforms.boil.value = Math.floor(time * 3) * 13.1 % 97;
            }
            renderer.setRenderTarget(target);
            renderer.render(sceneToDraw, sceneCamera);
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
        },
        dispose() {
            target.dispose();
            material.dispose();
            triangle.dispose();
        },
    };
}
