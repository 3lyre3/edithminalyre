/**
 * sky.js — Elysium's endless dusk.
 *
 * A dome drawn at the far plane: deep indigo overhead, violet in the middle
 * air, a rose band all round the horizon and an amber glow on the side where
 * the sun hangs just under it. Faint stars above; below the horizon the dusk
 * thickens into haze. Around the island, wherever the eye stands, a soft gold
 * glow: Elysicester lit like the one moon Elysium needs. Colours are linear;
 * the ink pass tone-maps them.
 */

// =============================================================================
// Imports
// =============================================================================

import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Where the glow gathers: the island's heart, and how far its light reaches around it. */
const GLOW_CENTRE = new Vector3(0, 2, 0);
const GLOW_REACH = 34;

// =============================================================================
// Shaders
// =============================================================================

const vertexShader = /* glsl */ `
    varying vec3 vDirection;

    void main() {
        vDirection = normalize(position);
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(clip.xy, clip.w * 0.99999, clip.w);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 sunDirection;
    uniform float time;
    uniform vec3 haloDirection;
    uniform float haloWidth;

    varying vec3 vDirection;

    float hash13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
    }

    void main() {
        vec3 direction = normalize(vDirection);
        // The island floats high, so the far horizon lies below eye level.
        float height = direction.y + 0.16;
        vec3 sunFlat = normalize(vec3(sunDirection.x, 0.0, sunDirection.z));
        float toward = max(dot(normalize(vec3(direction.x, 0.0, direction.z) + vec3(0.0, 1e-4, 0.0)), sunFlat), 0.0);
        float sunSide = pow(toward, 9.0);

        vec3 zenith = vec3(0.008, 0.007, 0.030);
        vec3 upper = vec3(0.026, 0.018, 0.070);
        vec3 dusk = vec3(0.120, 0.052, 0.110);
        vec3 amber = vec3(1.20, 0.50, 0.16);
        vec3 rose = vec3(0.30, 0.10, 0.18);
        vec3 farSea = vec3(0.020, 0.014, 0.046);

        vec3 color;
        if (height >= 0.0) {
            color = mix(dusk, upper, smoothstep(0.0, 0.16, height));
            color = mix(color, zenith, smoothstep(0.16, 0.8, height));
            color += amber * sunSide * exp(-height * 16.0) * 0.42;
            color += rose * exp(-height * 26.0) * 0.22;
        } else {
            color = mix(dusk * 0.7, farSea, smoothstep(0.0, -0.08, height));
            color = mix(color, vec3(0.008, 0.006, 0.018), smoothstep(-0.1, -0.6, height));
            color += amber * sunSide * exp(height * 30.0) * 0.4;
        }

        if (height > 0.08) {
            vec3 grid = direction * 170.0;
            float seed = hash13(floor(grid));
            if (seed > 0.986) {
                float core = smoothstep(0.32, 0.0, length(fract(grid) - 0.5));
                float twinkle = 0.7 + 0.3 * sin(time * (0.8 + seed * 2.5) + seed * 60.0);
                color += vec3(1.0, 0.93, 0.82) * core * twinkle * smoothstep(0.05, 0.45, height) * (seed - 0.986) * 55.0;
            }
        }

        // Elysicester glows like the one moon Elysium needs: a soft gold corona close about the
        // island, gone within half its width again, however near or far the eye. (The dusk is
        // dark enough that any wider glow would brown the whole sky.)
        float reach = (1.0 - dot(direction, haloDirection)) / max(haloWidth, 1e-4);
        color += vec3(1.0, 0.7, 0.34) * exp(-max(reach - 0.6, 0.0) * 2.2) * 0.045;

        gl_FragColor = vec4(color, 1.0);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {import('three').Vector3} options.sunDirection - where the hidden sun lies
 */
export function createSky({ sunDirection }) {
    const uniforms = {
        sunDirection: { value: sunDirection.clone().normalize() },
        time: { value: 0 },
        haloDirection: { value: new Vector3(0, -1, 0) },
        haloWidth: { value: 0.03 },
    };
    const material = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
    });
    const mesh = new Mesh(new SphereGeometry(400, 48, 24), material);
    mesh.name = 'sky';
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;

    return {
        mesh,
        /** Keep the dome centred on the eye, let the stars breathe, and keep the glow round the island. */
        update(time, camera) {
            uniforms.time.value = time;
            mesh.position.copy(camera.position);
            const toward = uniforms.haloDirection.value.copy(GLOW_CENTRE).sub(camera.position);
            const distance = toward.length();
            toward.normalize();
            uniforms.haloWidth.value = 1 - Math.cos(Math.asin(Math.min(0.999, GLOW_REACH / Math.max(distance, 1e-3))));
        },
    };
}
