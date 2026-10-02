/**
 * allison.js — Allison the Sirenian, at the sea-wall's old plaque (a trial, trials.js; ?allison=off).
 *
 * Elm: "maybe just some actual ppl like allison the sirenian just standing next to plaques saying: i've been trying to
 * read this old plaque, it's all latin, what could it mean? and then you click and it's my bio"; and "There's actually
 * no need for any other characters than Allison as the bio is the only other thing that will be needed. I know
 * allison says it's all in Latin, but don't rewrite it please: keep it in the English."
 *
 * He's as Elm sees him ("bluish white and silver-veined skin (he's a sirenian) and bright luscious long sunny blonde
 * hair (he's first introduced as an actor in a shampoo commercial for example)") and as Numbers by Paint has him: a
 * Sirenian, "a young man now", come up from the sea, with "those astonishing, violet eyes of his, always open"
 * (ever-shining), the "webs of his toes", the "long, luxurious curls" of the commercial, his skin, calm, "a light and
 * neutral eggshell blue", and, glad, "pulsing wheat-yellow, blood-magenta: a common, Sirenian indicator for joy"; his
 * hand sweats "silver mildew", "bright silver against the dim gold of Elysicester's pavement". He works at the hostel (The
 * Door in the Floor): a white shirt, its sleeves rolled, a bar apron, his trousers rolled at the ankle, barefoot. He
 * stands at the plaque that reads "Amár" (the Danæam for ocean), his hand up to it, puzzling; when someone comes he
 * turns to them, his skin pulsing for joy, and says his line (main.js shows it, where a place's name would be). A tap
 * on him, or his line, gives Elm's bio, read from the site's own bio page, in English.
 */

// =============================================================================
// Imports
// =============================================================================

import {
    CapsuleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshToonMaterial,
    SphereGeometry,
    Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { alsoBeforeCompile, light, paint, pose } from './kit.js';

// =============================================================================
// Constants
// =============================================================================

/** His line, in Elm's words (as she set it out, 1 Oct: "please put allison's dialogue in normal case"). */
export const ALLISON_SAYS = 'I’ve been trying to read this old plaque. It’s all Latin. What could it mean?';

/** His height (the city's people are drawn a little smaller than life, as the walker is: walk.js FIGURE). */
const TALL = 1.36;
/** Where his head turns about (the top of his neck), over his feet. */
const NECK = new Vector3(0, 1.12, 0);
/** His skin: calm, bluish white (the book's "light and neutral eggshell blue"), veined with silver; glad, pulsing
 * wheat-yellow and blood-magenta. */
const EGGSHELL = new Color(0xdce9f4);
const VEINS = new Color(0.58, 0.64, 0.76);
const WHEAT = new Color(0xe8c46a);
const MAGENTA = new Color(0xb02860);
const SHIRT = 0xece5d8;
const APRON = 0x4a1e30;
const TROUSERS = 0x26304a;
/** His hair: bright, luscious, long and sunny blonde, a lighter gold where it catches the light. */
const HAIR = 0xf5c85a;
const HAIR_LIGHT = 0xffe28c;
const SILVER = 0xdfe6ee;
/** His eyes: violet, always open, shining (past 1: the ink's tone map makes it a glow). */
const EYES = light(0xa070ff, 2.4);
/** How near (metres) someone must come for him to turn to them. */
const NOTICE = 4;

// =============================================================================
// The figure
// =============================================================================

/** A piece of him: posed, painted, marked as skin (its colour moves with his mood) and as head (it turns). */
function piece(geometry, { at, color, skin = false, head = false }) {
    if (at) pose(geometry, at);
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.attributes.normal) flat.computeVertexNormals();
    paint(flat, color);
    const count = flat.attributes.position.count;
    flat.setAttribute('skin', new Float32BufferAttribute(new Float32Array(count).fill(skin ? 1 : 0), 1));
    flat.setAttribute('head', new Float32BufferAttribute(new Float32Array(count).fill(head ? 1 : 0), 1));
    for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'color', 'skin', 'head'].includes(name)) flat.deleteAttribute(name);
    return flat;
}

/**
 * Allison, standing on the origin, facing +z, his right hand raised (to the plaque, a little to his right and ahead),
 * his left at his side.
 */
function allisonGeometry() {
    const pieces = [];
    const add = (geometry, options) => pieces.push(piece(geometry, options));
    // Bare feet, their toes webbed (as the book has them; too small to see from the walk), and the rolled trousers.
    for (const side of [-1, 1]) {
        add(new SphereGeometry(1, 8, 5), { at: { sx: 0.045, sy: 0.03, sz: 0.09, x: side * 0.07, y: 0.03, z: 0.03 }, color: 0xffffff, skin: true });
        add(new CylinderGeometry(0.05, 0.045, 0.06, 8), { at: { x: side * 0.07, y: 0.09, z: 0 }, color: 0xffffff, skin: true });
        add(new CylinderGeometry(0.062, 0.058, 0.07, 8), { at: { x: side * 0.07, y: 0.15, z: 0 }, color: 0x3a4664 });
        add(new CylinderGeometry(0.07, 0.056, 0.52, 8), { at: { x: side * 0.07, y: 0.44, z: 0 }, color: TROUSERS });
    }
    // Hips, the shirt, the apron over it.
    add(new CapsuleGeometry(0.13, 0.08, 3, 10), { at: { sx: 1.05, sz: 0.75, y: 0.72 }, color: TROUSERS });
    add(new CapsuleGeometry(0.13, 0.26, 3, 10), { at: { sx: 1.08, sz: 0.72, y: 0.92 }, color: SHIRT });
    add(new CylinderGeometry(0.14, 0.17, 0.48, 10, 1, true, -1.1, 2.2), { at: { y: 0.6, z: 0.012, sz: 0.8 }, color: APRON });
    // His neck.
    add(new CylinderGeometry(0.04, 0.045, 0.1, 8), { at: { y: 1.12 }, color: 0xffffff, skin: true });
    // The left arm at his side, its sleeve rolled to the elbow.
    add(new CylinderGeometry(0.045, 0.04, 0.26, 8), { at: { x: -0.17, y: 0.95, z: 0, rz: -0.12 }, color: SHIRT });
    add(new CylinderGeometry(0.035, 0.03, 0.26, 8), { at: { x: -0.2, y: 0.71, z: 0.01, rz: -0.08 }, color: 0xffffff, skin: true });
    add(new SphereGeometry(0.038, 8, 5), { at: { x: -0.21, y: 0.56, z: 0.015 }, color: 0xffffff, skin: true });
    // The right arm raised, the hand up near his face, reaching to the plaque.
    add(new CylinderGeometry(0.045, 0.04, 0.26, 8), { at: { x: 0.2, y: 0.98, z: 0.06, rz: 0.9, rx: 0.5 }, color: SHIRT });
    add(new CylinderGeometry(0.035, 0.03, 0.26, 8), { at: { x: 0.3, y: 1.1, z: 0.17, rz: -0.4, rx: 0.7 }, color: 0xffffff, skin: true });
    // (His hand, sweating silver mildew.)
    add(new SphereGeometry(0.04, 8, 5), { at: { x: 0.34, y: 1.2, z: 0.26 }, color: SILVER });
    // His head: round, its nose flat, his violet eyes open.
    add(new SphereGeometry(0.105, 12, 9), { at: { sy: 1.1, y: 1.27 }, color: 0xffffff, skin: true, head: true });
    for (const side of [-1, 1]) {
        add(new SphereGeometry(0.022, 8, 6), { at: { x: side * 0.04, y: 1.29, z: 0.093 }, color: EYES, head: true });
    }
    // His hair: a full crown, parted and swept back from his brow, and long waves falling past his shoulders down his
    // back and over the front of each shoulder, sunny gold, lighter where they catch the light.
    add(new SphereGeometry(1, 12, 8), { at: { sx: 0.125, sy: 0.12, sz: 0.13, y: 1.33, z: -0.025 }, color: HAIR, head: true });
    add(new SphereGeometry(1, 10, 7), { at: { sx: 0.11, sy: 0.06, sz: 0.09, y: 1.4, z: 0.03, rx: -0.3 }, color: HAIR_LIGHT, head: true });
    const waves = [
        // Down his back, in three falls, each a little wavy.
        [0, 1.2, -0.11, 0.1, 0.16, 0.06, 0], [0, 1.0, -0.13, 0.11, 0.14, 0.055, 0.12], [0, 0.84, -0.12, 0.09, 0.1, 0.05, -0.1],
        [-0.08, 1.12, -0.1, 0.06, 0.16, 0.05, 0.1], [0.08, 1.12, -0.1, 0.06, 0.16, 0.05, -0.1],
        [-0.07, 0.92, -0.11, 0.055, 0.12, 0.045, -0.15], [0.07, 0.92, -0.11, 0.055, 0.12, 0.045, 0.15],
        // Either side of his face, and over the front of each shoulder.
        [-0.115, 1.24, -0.01, 0.045, 0.12, 0.06, 0.08], [0.115, 1.24, -0.01, 0.045, 0.12, 0.06, -0.08],
        [-0.13, 1.06, 0.02, 0.045, 0.12, 0.05, 0.2], [0.13, 1.06, 0.02, 0.045, 0.12, 0.05, -0.2],
    ];
    // (The falls below his neck hang from his shoulders: only the crown and the locks by his face turn as he does.)
    waves.forEach(([x, y, z, sx, sy, sz, rz], index) => {
        add(new SphereGeometry(1, 9, 7), { at: { sx, sy, sz, x, y, z, rz }, color: index % 3 === 1 ? HAIR_LIGHT : HAIR, head: y > 1.18 });
    });
    // Silver dripping from his hand to the pavement (as it did when he was a child, and still does when he's glad).
    for (const [x, y, z, r] of [[0.33, 0.004, 0.24, 0.035], [0.29, 0.004, 0.31, 0.022], [0.37, 0.004, 0.19, 0.018]]) {
        add(new ConeGeometry(r, 0.006, 8), { at: { x, y, z }, color: SILVER });
    }
    const geometry = mergeGeometries(pieces, false);
    geometry.scale(TALL / 1.5, TALL / 1.5, TALL / 1.5);
    return geometry;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {[number, number, number]} options.at - where he stands
 * @param {number} options.facing - the way he faces (radians, 0 = +z): to the plaque
 * @param {import('three').Texture} options.gradientMap - the city's toon steps
 * @param {boolean} options.reducedMotion
 */
export function createAllison({ at, facing, gradientMap, reducedMotion }) {
    const uniforms = {
        allisonJoy: { value: 0 },
        allisonTime: { value: 0 },
        allisonTurn: { value: 0 },
        allisonCalm: { value: EGGSHELL.clone() },
        allisonWheat: { value: WHEAT.clone() },
        allisonMagenta: { value: MAGENTA.clone() },
        allisonVeins: { value: VEINS.clone() },
    };
    const material = new MeshToonMaterial({ gradientMap, vertexColors: true, color: 0xffffff });
    const neck = NECK.clone().multiplyScalar(TALL / 1.5);
    alsoBeforeCompile(material, 'allison', (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', [
                '#include <common>',
                'attribute float skin;',
                'attribute float head;',
                'uniform float allisonJoy;',
                'uniform float allisonTime;',
                'uniform float allisonTurn;',
                'uniform vec3 allisonCalm;',
                'uniform vec3 allisonWheat;',
                'uniform vec3 allisonMagenta;',
                'varying float vAllisonSkin;',
                'varying vec3 vAllisonVein;',
            ].join('\n'))
            .replace('#include <beginnormal_vertex>', [
                '#include <beginnormal_vertex>',
                'mat3 allisonLook = mat3(cos(allisonTurn), 0.0, -sin(allisonTurn), 0.0, 1.0, 0.0, sin(allisonTurn), 0.0, cos(allisonTurn));',
                'if (head > 0.5) objectNormal = allisonLook * objectNormal;',
            ].join('\n'))
            .replace('#include <begin_vertex>', [
                '#include <begin_vertex>',
                `if (head > 0.5) transformed = allisonLook * (transformed - vec3(0.0, ${neck.y.toFixed(4)}, 0.0)) + vec3(0.0, ${neck.y.toFixed(4)}, 0.0);`,
            ].join('\n'))
            .replace('#include <color_vertex>', [
                '#include <color_vertex>',
                '// Calm, bluish white; glad, pulsing wheat-yellow and blood-magenta, in waves up from his feet.',
                'float allisonPulse = 0.5 + 0.5 * sin(allisonTime * 5.0 - position.y * 6.0);',
                'vec3 allisonGlad = mix(allisonWheat, allisonMagenta, allisonPulse);',
                'vColor.rgb = mix(vColor.rgb, vColor.rgb * mix(allisonCalm, allisonGlad, allisonJoy), skin);',
                'vAllisonSkin = skin;',
                'vAllisonVein = position * 11.0;',
            ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 allisonVeins;\nvarying float vAllisonSkin;\nvarying vec3 vAllisonVein;')
            .replace('#include <color_fragment>', [
                '#include <color_fragment>',
                '// His skin veined with silver: fine lines, wandering and branching (two weaves of them), over all his skin.',
                'vec3 allisonAt = vAllisonVein;',
                'float allisonA = abs(sin(allisonAt.x * 3.1 + sin(allisonAt.y * 2.3 + allisonAt.z * 1.7) * 1.9 + allisonAt.y * 0.7));',
                'float allisonB = abs(sin(allisonAt.z * 2.7 + sin(allisonAt.x * 1.9 - allisonAt.y * 2.9) * 2.1 - allisonAt.y * 1.1));',
                'float allisonVein = max(1.0 - smoothstep(0.0, 0.09, allisonA), 0.7 * (1.0 - smoothstep(0.0, 0.06, allisonB))) * vAllisonSkin;',
                'diffuseColor.rgb = mix(diffuseColor.rgb, allisonVeins, allisonVein * 0.8);',
            ].join('\n'));
    });
    const mesh = new Mesh(allisonGeometry(), material);
    mesh.name = 'allison';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(...at);
    mesh.rotation.y = facing;
    const where = new Vector3(...at);
    /** Where his line is shown and a tap finds him: just above his head. */
    const point = new Vector3(at[0], at[1] + TALL + 0.12, at[2]);
    let visitor = null;
    let joy = 0;
    let turn = 0;
    let greeted = -Infinity;
    let last = 0;

    return {
        object: mesh,
        material,
        point,
        /** His body, as a ball (a tap anywhere on him finds him). */
        body: { center: new Vector3(at[0], at[1] + TALL * 0.55, at[2]), radius: 0.42 },
        /** He's spoken to (someone's near, or the pointer's over him): he's glad. */
        greet(elapsed) {
            greeted = elapsed;
        },
        /** Where the one who's come is, or null: he turns to them. */
        notice(position) {
            visitor = position;
        },
        update(elapsed) {
            const dt = Math.min(0.1, Math.max(0, elapsed - last));
            last = elapsed;
            uniforms.allisonTime.value = reducedMotion ? 0.3 : elapsed;
            let want = reducedMotion ? 0 : Math.sin(elapsed * 0.4) * 0.15 - 0.1;
            let glad = elapsed - greeted < 6 ? 1 : 0;
            if (visitor) {
                const dx = visitor.x - where.x;
                const dz = visitor.z - where.z;
                if (Math.hypot(dx, dz) < NOTICE) {
                    const toward = Math.atan2(dx, dz) - facing;
                    want = Math.max(-1.3, Math.min(1.3, Math.atan2(Math.sin(toward), Math.cos(toward))));
                    glad = 1;
                }
            }
            const ease = reducedMotion ? 1 : 1 - Math.exp(-3 * dt);
            turn += (want - turn) * ease;
            joy += (glad - joy) * (reducedMotion ? 1 : 1 - Math.exp(-1.5 * dt));
            uniforms.allisonTurn.value = turn;
            uniforms.allisonJoy.value = joy;
        },
    };
}

/**
 * Elm's bio, as her site's bio page has it (its first part: who she is, in her words), read from the page itself so
 * it's always as she has it there: the title line, the paragraphs, the italics, and the links (as links to go on to).
 * @param {string} html - bio.html
 * @returns {{ text: string, italic: string[], links: { href: string, label: string }[] } | null}
 */
export function bioFrom(html) {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const block = page.querySelector('.bio-text');
    if (!block) return null;
    const paragraphs = [];
    const italic = [];
    const links = [];
    for (const paragraph of block.querySelectorAll('p')) {
        const words = paragraph.textContent.replace(/\s+/g, ' ').trim();
        const linked = [...paragraph.querySelectorAll('a')];
        for (const link of linked) {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('mailto:') || /google\./.test(href)) continue;
            // (Compared once resolved: an address with its closing slash and the same without are one place, listed once.)
            const resolved = new URL(href, new URL('../', window.location.href)).href;
            if (!links.some((known) => known.href === resolved)) links.push({ href: resolved, label: link.textContent.trim() });
        }
        // (The line of links alone, and the search link at its foot, are links to go on to, not words of the bio.)
        const bare = paragraph.cloneNode(true);
        for (const link of bare.querySelectorAll('a')) link.remove();
        const own = bare.textContent.replace(/[—–\s]+/g, ' ').trim();
        if (!paragraph.classList.contains('bio-title') && own.split(' ').filter(Boolean).length < 3) continue;
        paragraphs.push(words);
        for (const emphasis of paragraph.querySelectorAll('em, i, cite')) italic.push(emphasis.textContent.trim());
    }
    return paragraphs.length ? { text: paragraphs.join('\n\n'), italic, links } : null;
}
