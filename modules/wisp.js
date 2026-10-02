/**
 * wisp.js — the drifting ✶, the site's will-o'-the-wisp, loose in the city.
 *
 * It wanders the air over Elysicester on a slow, looping path and carries a
 * little warm light with it. In tier 1 it leads nowhere; it keeps company.
 * Under reduced motion it hangs still.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    AdditiveBlending,
    CanvasTexture,
    Color,
    Group,
    PointLight,
    SRGBColorSpace,
    Sprite,
    SpriteMaterial,
    Vector3,
} from 'three';

// =============================================================================
// Main Code
// =============================================================================

/** A six-pointed star in a soft glow, drawn once to a small canvas. */
function starTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const centre = size / 2;

    const glow = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
    glow.addColorStop(0, 'rgba(255, 244, 222, 1)');
    glow.addColorStop(0.16, 'rgba(255, 216, 156, 0.55)');
    glow.addColorStop(0.5, 'rgba(255, 180, 96, 0.12)');
    glow.addColorStop(1, 'rgba(255, 160, 64, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, size, size);

    context.beginPath();
    for (let point = 0; point < 12; point += 1) {
        const radius = point % 2 ? centre * 0.13 : centre * 0.6;
        const angle = (point / 12) * Math.PI * 2;
        const x = centre + Math.sin(angle) * radius;
        const y = centre - Math.cos(angle) * radius;
        if (point === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.closePath();
    context.fillStyle = 'rgba(255, 250, 236, 0.95)';
    context.fill();

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

/**
 * @param {object} options
 * @param {boolean} options.reducedMotion
 */
export function createWisp({ reducedMotion }) {
    const map = starTexture();
    const star = new Sprite(new SpriteMaterial({
        map,
        color: new Color(0xffe2b0).multiplyScalar(2.4),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
    }));
    star.scale.setScalar(1.7);
    const halo = new Sprite(new SpriteMaterial({
        map,
        color: new Color(0xffb870).multiplyScalar(0.9),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
        fog: false,
    }));
    halo.scale.setScalar(6.5);
    const glow = new PointLight(0xffc27a, 30, 18, 2);

    const object = new Group();
    object.name = 'wisp';
    object.add(halo, star, glow);
    object.position.copy(new Vector3(4, 10.5, -3));

    return {
        object,
        update(time) {
            if (reducedMotion) return;
            object.position.set(
                13 * Math.sin(time * 0.093) + 6 * Math.sin(time * 0.23 + 1.3),
                10 + 3.5 * Math.sin(time * 0.17 + 0.7) + 1.5 * Math.sin(time * 0.41),
                13 * Math.sin(time * 0.071 + 2.1) + 6 * Math.cos(time * 0.19),
            );
            star.material.rotation = Math.sin(time * 0.3) * 0.2;
        },
    };
}
