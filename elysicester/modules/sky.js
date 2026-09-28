/**
 * sky.js — Elysium's endless dusk, and the far sea under it.
 *
 * A dome drawn at the far plane. Above the far horizon: deep indigo overhead,
 * violet in the middle air, rose low down and a glow of apricot and gold where
 * the sun has just gone under; long banks of cloud lie low across it, their
 * edges lit from beneath on the sun's side, and faint stars prick out above.
 * Below the horizon lies the Elysian Sea, far down: it mirrors the dusk, shows
 * its swell, and holds a pool of warm light beneath the island, where
 * Elysicester shines on it like the one moon Elysium needs. Far out on it,
 * islands far apart still show a light each ("If even one prick of light
 * stood out, anywhere, it made a different scene. Then, the world was only
 * huge. Islands far apart but still there", Numbers by Paint, Episode 1).
 *
 * The horizon lies where the far sea ends (SEA_REACH from the island), so it
 * dips lower the higher the eye rises. Colours are linear; the ink pass
 * tone-maps them. As an extra (extras.js), words can be written round the sky,
 * just above the far horizon.
 */

// =============================================================================
// Imports
// =============================================================================

import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3, Vector4 } from 'three';
import { createRandom } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** Where the glow gathers: the island's heart, and how far its light reaches around it. */
const GLOW_CENTRE = new Vector3(0, 2, 0);
const GLOW_REACH = 34;
/** The Elysian Sea lies far below the floating island, and stretches this far out to the horizon. */
const SEA_DEPTH = -120;
const SEA_REACH = 1000;
/** Islands far apart on the far sea, each with its prick of light. */
const FAR_ISLANDS = 6;

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
    uniform float horizonDip;
    uniform float seaLevel;
    uniform vec3 glowCentre;
    uniform vec4 farIslands[FAR_ISLANDS];
    #ifdef INSCRIPTION
    uniform sampler2D inscription;
    #endif

    varying vec3 vDirection;

    const float TAU = 6.28318531;

    float hash13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
    }

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    /** Value noise that wraps every "period" cells across, so the clouds close round the sky without a seam. */
    float wrappedNoise(vec2 p, float period) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float x0 = mod(i.x, period);
        float x1 = mod(i.x + 1.0, period);
        float a = hash12(vec2(x0, i.y));
        float b = hash12(vec2(x1, i.y));
        float c = hash12(vec2(x0, i.y + 1.0));
        float d = hash12(vec2(x1, i.y + 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float wrappedFbm(vec2 p, float period) {
        float sum = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 4; octave++) {
            sum += amplitude * wrappedNoise(p, period);
            p = p * 2.0 + vec2(0.0, 17.3);
            period *= 2.0;
            amplitude *= 0.5;
        }
        return sum / 0.9375;
    }

    /** The dusk itself, by height above the far horizon and how far round toward the sunken sun (0 to 1). */
    vec3 dusk(float height, float toward) {
        float sun = toward * toward * toward;
        // A thin, hot line where sky meets sea; rose above it; then violet, indigo, and night overhead.
        vec3 horizon = mix(vec3(0.34, 0.12, 0.18), vec3(1.2, 0.5, 0.2), sun);
        vec3 low = mix(vec3(0.13, 0.05, 0.13), vec3(0.26, 0.085, 0.12), sun);
        vec3 color = mix(horizon, low, smoothstep(0.0, 0.035, height));
        color = mix(color, vec3(0.068, 0.032, 0.12), smoothstep(0.03, 0.2, height));
        color = mix(color, vec3(0.024, 0.018, 0.078), smoothstep(0.18, 0.5, height));
        color = mix(color, vec3(0.007, 0.007, 0.034), smoothstep(0.48, 1.1, height));
        // The glow over where the sun went down.
        color += vec3(0.95, 0.38, 0.10) * pow(toward, 16.0) * exp(-height * 18.0) * 0.6;
        return color;
    }

    /** How far round toward the sun a direction faces, from 0 (away, or across) to 1. */
    float towardSun(vec3 direction) {
        vec3 sunFlat = normalize(vec3(sunDirection.x, 0.0, sunDirection.z));
        vec2 level = direction.xz;
        float length2 = dot(level, level);
        if (length2 < 1e-8) return 0.0;
        return max(dot(level * inversesqrt(length2), sunFlat.xz), 0.0);
    }

    /**
     * Long, low banks of cloud, laid in flat like the rest of the drawing: a dusky body, and
     * where the sun can still reach, an edge lit from beneath.
     */
    vec3 clouds(vec3 color, float height, float around, float toward) {
        float band = smoothstep(0.012, 0.05, height) * (1.0 - smoothstep(0.13, 0.3, height));
        if (band <= 0.0) return color;
        vec2 p = vec2(around * 11.0 + time * 0.0016, height * 21.0);
        float body = (wrappedFbm(p, 11.0) - 0.5) * 2.8 * band;
        float below = (wrappedFbm(p - vec2(0.0, 0.38), 11.0) - 0.5) * 2.8 * band;
        float cover = smoothstep(0.1, 0.13, body);
        if (cover <= 0.0) return color;
        // Where the cloud thins toward its underside, it catches the light from beneath the horizon.
        float rim = cover * (1.0 - smoothstep(0.08, 0.16, below));
        float sun = pow(toward, 2.5);
        float warmth = exp(-height * 7.0);
        vec3 shade = mix(vec3(0.07, 0.036, 0.1), vec3(0.2, 0.07, 0.11), sun * warmth);
        vec3 lit = mix(vec3(0.36, 0.19, 0.3), vec3(1.25, 0.58, 0.28), sun) * (0.5 + 0.5 * warmth);
        color = mix(color, shade, cover * 0.92);
        return mix(color, lit, rim * 0.9);
    }

    /** The angle from a to b round the sky, folded into -pi..pi. */
    float turn(float a, float b) {
        return mod(b - a + 3.14159265, TAU) - 3.14159265;
    }

    /**
     * The islands far out on the sea, low humps against the horizon haze, each with a light;
     * under each light, its broken reflection. Only drawn close about the horizon.
     */
    vec3 farWorld(vec3 color, vec3 direction, float around, vec3 haze) {
        float elevation = asin(clamp(direction.y, -1.0, 1.0));
        for (int index = 0; index < FAR_ISLANDS; index++) {
            vec4 island = farIslands[index];
            vec3 foot = vec3(island.x, seaLevel, island.y) - cameraPosition;
            float reach = length(foot.xz);
            float across = turn(atan(foot.z, foot.x), around) / (island.z / reach);
            if (abs(across) > 1.35) continue;
            float base = atan(foot.y, reach);
            float top = atan(foot.y + island.w, reach);
            float seed = float(index) * 7.31;
            float shape = pow(max(1.0 - across * across, 0.0), 0.55) * (0.86 + 0.14 * sin(across * 5.0 + seed));
            float crown = base + (top - base) * shape;
            // The light, near the crown, a little off its middle.
            float lightAcross = 0.18 * sin(seed);
            float lightUp = base + (top - base) * 0.78;
            vec2 fromLight = vec2((across - lightAcross) * island.z / reach, elevation - lightUp);
            float twinkle = 0.85 + 0.15 * sin(time * (0.7 + 0.2 * float(index)) + seed);
            if (elevation < crown && elevation > base - 0.0004) {
                // Far off, an island is mostly haze: only a little darker than the dusk behind it.
                color = mix(haze, vec3(0.03, 0.02, 0.06), 0.5 - 0.25 * smoothstep(500.0, 950.0, reach));
            } else if (elevation < base && elevation > base - 0.03) {
                // Its light, broken on the swell below it.
                float streak = exp(-pow(fromLight.x / 0.0009, 2.0)) * exp(-(base - elevation) / 0.008);
                float broken = step(0.45, hash12(vec2(floor(elevation * 2600.0), floor(time * 3.0) + seed)));
                color += vec3(1.0, 0.78, 0.45) * streak * broken * 0.55 * twinkle;
            }
            float glint = length(fromLight);
            color += vec3(1.0, 0.8, 0.5) * (exp(-pow(glint / 0.0011, 2.0)) * 2.6 + exp(-glint / 0.004) * 0.12) * twinkle;
        }
        return color;
    }

    /** The far Elysian Sea: the dusk mirrored in its swell, and Elysicester's light pooled on it below. */
    vec3 farSea(vec3 direction, float height, float toward) {
        float drop = cameraPosition.y - seaLevel;
        float along = drop / max(-direction.y, 1e-4);
        vec3 point = cameraPosition + direction * along;

        // Long swells, their slopes summed; they smooth away with distance, so they never shimmer.
        vec2 slope = vec2(0.0);
        vec2 p = point.xz;
        float calm = exp(-along / 420.0);
        vec2 directions[4];
        directions[0] = vec2(0.8, 0.6);
        directions[1] = vec2(-0.45, 0.89);
        directions[2] = vec2(0.96, -0.28);
        directions[3] = vec2(-0.7, -0.71);
        for (int wave = 0; wave < 4; wave++) {
            float frequency = 0.045 * pow(1.9, float(wave));
            float phase = dot(directions[wave], p) * frequency + time * (0.35 + 0.22 * float(wave));
            slope += directions[wave] * cos(phase) * (0.5 / pow(1.6, float(wave)));
        }
        slope *= 0.1 * calm;
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 mirrored = reflect(direction, normal);

        float facing = max(dot(normal, -direction), 0.0);
        float fresnel = 0.03 + 0.97 * pow(1.0 - facing, 5.0);
        // The sea is darker than the sky it mirrors.
        vec3 sky = dusk(max(mirrored.y - horizonDip, 0.0), towardSun(mirrored)) * 0.62;
        vec3 water = vec3(0.014, 0.011, 0.04);
        vec3 color = mix(water, sky, fresnel);

        // Drawn swell, as on the island's own water: thin crest lines, silver-violet with the dusk
        // far out, and gold where Elysicester's light lies on the water beneath it.
        vec2 under = point.xz - glowCentre.xz;
        float pool = exp(-dot(under, under) / (190.0 * 190.0));
        // Each line an even nib's width on screen, whatever its distance, and gone before it crowds.
        float lineAt = dot(p, vec2(0.09, 0.055)) + sin(dot(p, vec2(-0.021, 0.034)) + time * 0.07) * 1.6 + time * 0.08;
        float width = fwidth(lineAt);
        float offLine = abs(fract(lineAt + 0.5) - 0.5);
        float crest = (1.0 - smoothstep(0.0, width * 1.1 + 0.015, offLine)) * (1.0 - smoothstep(0.1, 0.3, width));
        // Broken into short strokes, scattered the way an engraver scatters them.
        float strokes = wrappedNoise(p * vec2(0.085, 0.12), 1e5) * 0.7 + wrappedNoise(p * 0.013, 1e5) * 0.3;
        crest *= smoothstep(0.6 - 0.14 * pool, 0.72 - 0.14 * pool, strokes);
        vec3 crestColor = mix(vec3(0.13, 0.1, 0.24), vec3(1.0, 0.66, 0.3), pool);
        color = mix(color, crestColor, crest * (0.1 + 0.7 * pool));
        color += vec3(0.5, 0.33, 0.14) * pool * pool * 0.06;

        // Far out, the sea goes to haze, and meets the sky's own horizon without a seam.
        float horizontal = along * length(direction.xz);
        color = mix(color, dusk(0.0, toward), smoothstep(${(SEA_REACH * 0.84).toFixed(1)}, ${(SEA_REACH * 1.0).toFixed(1)}, horizontal));
        return color;
    }

    void main() {
        vec3 direction = normalize(vDirection);
        float height = direction.y + horizonDip;
        float toward = towardSun(direction);
        float around = fract(atan(direction.z, direction.x) / TAU);

        vec3 color;
        if (height >= 0.0) {
            color = dusk(height, toward);
            if (height > 0.09) {
                vec3 grid = direction * 170.0;
                float seed = hash13(floor(grid));
                if (seed > 0.985) {
                    float core = smoothstep(0.32, 0.0, length(fract(grid) - 0.5));
                    float twinkle = 0.7 + 0.3 * sin(time * (0.8 + seed * 2.5) + seed * 60.0);
                    color += vec3(1.0, 0.93, 0.82) * core * twinkle * smoothstep(0.09, 0.5, height) * (seed - 0.985) * 52.0;
                }
            }
            color = clouds(color, height, around, toward);
        } else {
            color = farSea(direction, height, toward);
        }

        if (abs(height) < 0.05) color = farWorld(color, direction, atan(direction.z, direction.x), dusk(0.0, toward));

        // Elysicester glows like the one moon Elysium needs: a soft gold corona close about the
        // island, gone within half its width again, however near or far the eye.
        float reach = (1.0 - dot(direction, haloDirection)) / max(haloWidth, 1e-4);
        color += vec3(1.0, 0.7, 0.34) * exp(-max(reach - 0.6, 0.0) * 2.2) * 0.06;

        #ifdef INSCRIPTION
        // An extra: THIS IS NOT THE WORLD, round the sky just above the far horizon, repeated all
        // the way round, so it reads from wherever the eye stands.
        float band = (height - INSCRIPTION_LOW) / INSCRIPTION_HEIGHT;
        if (band > 0.0 && band < 1.0) {
            float letter = texture2D(inscription, vec2(fract(around * INSCRIPTION_COPIES), band)).a;
            color += vec3(1.0, 0.84, 0.56) * letter * INSCRIPTION_STRENGTH;
        }
        #endif

        gl_FragColor = vec4(color, 1.0);
    }
`;

// =============================================================================
// Main Code
// =============================================================================

/** Islands far apart, at the same places on every visit: [x, z, half-width, height] on the far sea. */
function farIslands() {
    const random = createRandom(1111);
    const islands = [];
    for (let index = 0; index < FAR_ISLANDS; index += 1) {
        // Spread round the whole horizon, never two together.
        const angle = ((index + random.range(0.2, 0.8)) / FAR_ISLANDS) * Math.PI * 2;
        const reach = random.range(0.52, 0.9) * SEA_REACH;
        islands.push(new Vector4(Math.cos(angle) * reach, Math.sin(angle) * reach, random.range(9, 24), random.range(4, 12)));
    }
    return islands;
}

/**
 * @param {object} options
 * @param {import('three').Vector3} options.sunDirection - where the hidden sun lies
 * @param {import('three').Texture | null} [options.inscription] - an extra: words to write round the sky
 */
export function createSky({ sunDirection, inscription = null }) {
    const uniforms = {
        sunDirection: { value: sunDirection.clone().normalize() },
        time: { value: 0 },
        haloDirection: { value: new Vector3(0, -1, 0) },
        haloWidth: { value: 0.03 },
        horizonDip: { value: 0.16 },
        seaLevel: { value: SEA_DEPTH },
        glowCentre: { value: GLOW_CENTRE.clone() },
        farIslands: { value: farIslands() },
    };
    const defines = { FAR_ISLANDS };
    if (inscription) {
        uniforms.inscription = { value: inscription };
        Object.assign(defines, {
            INSCRIPTION: '',
            INSCRIPTION_LOW: '0.046',
            INSCRIPTION_HEIGHT: '0.034',
            INSCRIPTION_COPIES: '12.0',
            INSCRIPTION_STRENGTH: '0.1',
        });
    }
    const material = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        defines,
        side: BackSide,
        depthWrite: false,
    });
    const mesh = new Mesh(new SphereGeometry(400, 48, 24), material);
    mesh.name = 'sky';
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;

    return {
        mesh,
        /** Keep the dome centred on the eye, the horizon where the far sea ends, the stars breathing, and the glow round the island. */
        update(time, camera) {
            uniforms.time.value = time;
            mesh.position.copy(camera.position);
            const drop = Math.max(1, camera.position.y - SEA_DEPTH);
            uniforms.horizonDip.value = drop / Math.hypot(drop, SEA_REACH);
            const toward = uniforms.haloDirection.value.copy(GLOW_CENTRE).sub(camera.position);
            const distance = toward.length();
            toward.normalize();
            uniforms.haloWidth.value = 1 - Math.cos(Math.asin(Math.min(0.999, GLOW_REACH / Math.max(distance, 1e-3))));
        },
    };
}
