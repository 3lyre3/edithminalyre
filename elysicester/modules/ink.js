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
 *
 * The pen lifts, too, in a few places, as a hand's does (Elm, of Messenger:
 * "breaking the solid boundary lines in a few spots to create a more natural
 * sense of materiality"): each line is traced back to the surface it belongs
 * to, and there a noise in the world leaves rare gaps, eases the pressure a
 * little, and lets the brightest glint eat into it. The breaks stay on the
 * things drawn, so they never crawl as the eye moves. ?lines=whole draws every
 * line unbroken.
 *
 * Before the ink, whatever gives off light (windows, lamps, the reading
 * points, the door, the far islands' lights) lends a soft glow to the air
 * round it: the brightest of the render is gathered at a quarter and an
 * eighth of the size, blurred, and laid back under the lines. Only true
 * lights reach the threshold; lit gold and the dusk don't.
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
    Matrix4,
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
    uniform sampler2D tGlowNear;
    uniform sampler2D tGlowFar;
    uniform float glowStrength;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float lineWidth;
    uniform float inkStrength;
    uniform vec3 inkColor;
    uniform float grainAmount;
    uniform float grainSeed;
    uniform float boil;
    uniform mat4 projectionInverse;
    uniform mat4 cameraWorld;
    uniform float lineBreaks;

    varying vec2 vUv;

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    float hash13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
    }

    /** Value noise in the world, so what it marks belongs to the thing drawn and doesn't crawl. */
    float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
                mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
            mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
                mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
            u.z);
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
        color += (texture2D(tGlowNear, vUv).rgb * 0.55 + texture2D(tGlowFar, vUv).rgb * 0.75) * glowStrength;
        color = toneMapping(color);
        color = linearToOutputTexel(vec4(color, 1.0)).rgb;

        // The pen lifts, here and there, as a hand's does. Where a line is, find the surface it belongs
        // to (the nearest of the taps) back in the world; there, a slow noise leaves gaps in the line
        // and varies how hard the pen presses, so the breaks stay on the thing and never crawl as the
        // eye moves. Light eats into the line where the surface beside it is brightest, and an outer
        // contour (a big step in depth) holds more firmly than a crease within.
        float ink = edge * inkStrength;
        if (ink > 0.002 && lineBreaks > 0.0) {
            float nearest = max(max(max(left, right), max(up, down)), centre);
            vec4 ray = projectionInverse * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
            ray.xyz /= ray.w;
            vec3 viewPosition = ray.xyz * ((-1.0 / nearest) / ray.z);
            vec3 world = (cameraWorld * vec4(viewPosition, 1.0)).xyz;
            float away = 1.0 / nearest;
            // Three sizes of gap, from fine close to broad far off, so a gap stays a pen-lift on screen
            // (a few pixels to a couple of dozen) at every distance; between sizes, they blend.
            float mid = smoothstep(6.0, 14.0, away);
            float far = smoothstep(28.0, 60.0, away);
            float gaps = mix(mix(noise3(world * 7.0), noise3(world * 2.6 + 11.0), mid), noise3(world * 0.7 + 17.0), far);
            float pressure = mix(mix(noise3(world * 2.4 + 5.0), noise3(world * 0.9 + 29.0), mid), noise3(world * 0.25 + 23.0), far);
            // A line is drawn whole unless the pen lifts: rare, clean gaps (the lowest of the noise), a
            // little rarer on an outer contour; the pressure varies it only gently; and only the very
            // brightest glint eats into it. (Multiplied together, stronger versions of these thinned
            // whole outlines away.)
            float silhouette = smoothstep(0.12, 0.45, fold);
            float lift = mix(0.3, 0.26, silhouette);
            float kept = smoothstep(lift - 0.05, lift, gaps);
            float pressed = 0.8 + 0.2 * smoothstep(0.3, 0.7, pressure);
            float lit = smoothstep(0.84, 0.98, dot(color, vec3(0.299, 0.587, 0.114)));
            float drawn = kept * pressed * (1.0 - 0.7 * lit);
            ink *= mix(1.0, drawn, lineBreaks);
        }
        color = mix(color, inkColor, ink);

        float grain = hash12(floor(gl_FragCoord.xy) + grainSeed * 17.0) - 0.5;
        float fibre = noise(gl_FragCoord.xy * vec2(0.9, 0.05) + 3.7) - 0.5;
        color += grain * grainAmount + fibre * grainAmount * 0.35;

        vec2 centred = vUv - 0.5;
        color *= 1.0 - dot(centred, centred) * 0.6;

        gl_FragColor = vec4(color, 1.0);
    }
`;

/** Gather what gives off light: four taps of the render, only what passes the threshold (with a soft knee). */
const gatherShader = /* glsl */ `
    uniform sampler2D tSource;
    uniform vec2 texel;
    uniform float threshold;
    uniform float knee;

    varying vec2 vUv;

    vec3 bright(vec3 color) {
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float soft = clamp(luma - threshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        return color * (max(soft, luma - threshold) / max(luma, 1e-4));
    }

    void main() {
        vec3 sum = bright(texture2D(tSource, vUv + texel * vec2(-1.0, -1.0)).rgb);
        sum += bright(texture2D(tSource, vUv + texel * vec2(1.0, -1.0)).rgb);
        sum += bright(texture2D(tSource, vUv + texel * vec2(-1.0, 1.0)).rgb);
        sum += bright(texture2D(tSource, vUv + texel * vec2(1.0, 1.0)).rgb);
        gl_FragColor = vec4(sum * 0.25, 1.0);
    }
`;

/** Halve again: four taps, averaged. */
const shrinkShader = /* glsl */ `
    uniform sampler2D tSource;
    uniform vec2 texel;

    varying vec2 vUv;

    void main() {
        vec3 sum = texture2D(tSource, vUv + texel * vec2(-1.0, -1.0)).rgb;
        sum += texture2D(tSource, vUv + texel * vec2(1.0, -1.0)).rgb;
        sum += texture2D(tSource, vUv + texel * vec2(-1.0, 1.0)).rgb;
        sum += texture2D(tSource, vUv + texel * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(sum * 0.25, 1.0);
    }
`;

/** A nine-tap Gaussian along one direction, in five linear taps. */
const blurShader = /* glsl */ `
    uniform sampler2D tSource;
    uniform vec2 direction;

    varying vec2 vUv;

    void main() {
        vec3 color = texture2D(tSource, vUv).rgb * 0.2270270270;
        color += texture2D(tSource, vUv + direction * 1.3846153846).rgb * 0.3162162162;
        color += texture2D(tSource, vUv - direction * 1.3846153846).rgb * 0.3162162162;
        color += texture2D(tSource, vUv + direction * 3.2307692308).rgb * 0.0702702703;
        color += texture2D(tSource, vUv - direction * 3.2307692308).rgb * 0.0702702703;
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

    // The glow: a quarter-size pair and an eighth-size pair of targets, blurred back and forth.
    const glowTarget = () => new WebGLRenderTarget(1, 1, { type: canFloat ? HalfFloatType : UnsignedByteType, depthBuffer: false });
    const near = [glowTarget(), glowTarget()];
    const far = [glowTarget(), glowTarget()];
    const pass = (fragment, extra) => new ShaderMaterial({
        uniforms: { tSource: { value: null }, texel: { value: new Vector2() }, direction: { value: new Vector2() }, ...extra },
        vertexShader,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
    });
    // Without float targets nothing is brighter than white, so the threshold sits just under it.
    const gather = pass(gatherShader, { threshold: { value: canFloat ? 1.25 : 0.92 }, knee: { value: canFloat ? 0.5 : 0.08 } });
    const shrink = pass(shrinkShader);
    const blur = pass(blurShader);

    const uniforms = {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        tGlowNear: { value: near[0].texture },
        tGlowFar: { value: far[0].texture },
        glowStrength: { value: 1 },
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
        // Where the lines break (and the pen's pressure) is worked out in the world, from these.
        projectionInverse: { value: new Matrix4() },
        cameraWorld: { value: new Matrix4() },
        // 1: the pen lifts here and there; 0: every line whole (?lines=whole).
        lineBreaks: { value: new URLSearchParams(window.location.search).get('lines') === 'whole' ? 0 : 1 },
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

    /** One full-screen pass: a material, what it reads, and where it draws. */
    function draw(passMaterial, source, into, setup) {
        passMaterial.uniforms.tSource.value = source.texture;
        setup?.(passMaterial.uniforms, source);
        quad.material = passMaterial;
        renderer.setRenderTarget(into);
        renderer.render(scene, camera);
    }

    function glow() {
        draw(gather, target, near[0], (u) => u.texel.value.set(1 / size.x, 1 / size.y));
        draw(blur, near[0], near[1], (u, from) => u.direction.value.set(1 / from.width, 0));
        draw(blur, near[1], near[0], (u, from) => u.direction.value.set(0, 1 / from.height));
        draw(shrink, near[0], far[0], (u, from) => u.texel.value.set(1 / from.width, 1 / from.height));
        draw(blur, far[0], far[1], (u, from) => u.direction.value.set(1 / from.width, 0));
        draw(blur, far[1], far[0], (u, from) => u.direction.value.set(0, 1 / from.height));
    }

    return {
        target,
        /** Match the drawing buffer; lines stay a little over one CSS pixel wide, like a fine nib. */
        resize() {
            renderer.getDrawingBufferSize(size);
            target.setSize(size.x, size.y);
            for (const glowAt of near) glowAt.setSize(Math.max(1, Math.floor(size.x / 4)), Math.max(1, Math.floor(size.y / 4)));
            for (const glowAt of far) glowAt.setSize(Math.max(1, Math.floor(size.x / 8)), Math.max(1, Math.floor(size.y / 8)));
            uniforms.resolution.value.copy(size);
            uniforms.lineWidth.value = Math.max(1.3, renderer.getPixelRatio() * 1.15);
        },
        /** Draw the scene through the ink onto the canvas. */
        render(sceneToDraw, sceneCamera, time) {
            uniforms.cameraNear.value = sceneCamera.near;
            uniforms.cameraFar.value = sceneCamera.far;
            uniforms.projectionInverse.value.copy(sceneCamera.projectionMatrixInverse);
            uniforms.cameraWorld.value.copy(sceneCamera.matrixWorld);
            if (!reducedMotion) {
                uniforms.grainSeed.value = Math.floor(time * 20) % 97;
                uniforms.boil.value = Math.floor(time * 3) * 13.1 % 97;
            }
            renderer.setRenderTarget(target);
            renderer.render(sceneToDraw, sceneCamera);
            glow();
            quad.material = material;
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
        },
        dispose() {
            target.dispose();
            for (const glowAt of [...near, ...far]) glowAt.dispose();
            for (const passMaterial of [material, gather, shrink, blur]) passMaterial.dispose();
            triangle.dispose();
        },
    };
}
