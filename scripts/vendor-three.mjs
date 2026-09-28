/**
 * vendor-three.mjs — copy the pinned three.js into elysicester/vendor/three/.
 *
 * The site has no build step: the diorama loads plain ES modules through an
 * import map, so three.js has to live in the repo. This script copies the
 * version pinned in package.json out of node_modules.
 *
 * three r186 ships only unminified builds (build/three.core.js and
 * build/three.module.js are about 2.1 MB together), which alone would spend
 * most of the diorama's 2.5 MB budget, so each file is minified with esbuild
 * (the WebAssembly build, so it installs the same way everywhere) as it is
 * copied. Nothing else changes. Paths mirror the npm package, so the addons'
 * own imports keep working:
 *
 *   elysicester/vendor/three/build/three.module.js
 *   elysicester/vendor/three/build/three.core.js
 *   elysicester/vendor/three/examples/jsm/<addon>.js
 *   elysicester/vendor/three/LICENSE
 *
 * Every vendored file starts with a header naming the exact version, and
 * scripts/check-elysicester.mjs compares that header with package.json.
 *
 * Usage: npm run vendor:three
 */

// =============================================================================
// Imports
// =============================================================================

import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild-wasm';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(ROOT, 'node_modules', 'three');
const TARGET = path.join(ROOT, 'elysicester', 'vendor', 'three');

/** Files copied from the package, relative to node_modules/three. */
const FILES = [
    'build/three.core.js',
    'build/three.module.js',
];

/** Addons the diorama imports, relative to node_modules/three/examples/jsm. */
const ADDONS = [
    'utils/BufferGeometryUtils.js',
];

// =============================================================================
// Main Code
// =============================================================================

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

async function pinnedVersion() {
    const manifest = await readJson(path.join(ROOT, 'package.json'));
    const pinned = manifest.devDependencies?.three;
    if (!pinned || !/^\d+\.\d+\.\d+$/.test(pinned)) {
        throw new Error(`package.json must pin three to an exact version (found ${JSON.stringify(pinned)})`);
    }
    const installed = (await readJson(path.join(SOURCE, 'package.json'))).version;
    if (installed !== pinned) {
        throw new Error(`node_modules has three@${installed} but package.json pins ${pinned}; run npm ci first`);
    }
    return pinned;
}

async function vendorFile(version, relativePath) {
    const source = await readFile(path.join(SOURCE, relativePath), 'utf8');
    const header = `/* three@${version} ${relativePath}, minified by scripts/vendor-three.mjs (esbuild). `
        + 'MIT licence, © 2010-2026 three.js authors: see elysicester/vendor/three/LICENSE */';
    const result = await transform(source, {
        loader: 'js',
        format: 'esm',
        target: 'es2020',
        minify: true,
        legalComments: 'none',
    });
    const code = `${header}\n${result.code}`;
    const destination = path.join(TARGET, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, code);
    return { relativePath, before: Buffer.byteLength(source), after: Buffer.byteLength(code) };
}

const version = await pinnedVersion();
await rm(TARGET, { recursive: true, force: true });
await mkdir(TARGET, { recursive: true });

const results = [];
for (const file of FILES) results.push(await vendorFile(version, file));
for (const addon of ADDONS) results.push(await vendorFile(version, `examples/jsm/${addon}`));
await copyFile(path.join(SOURCE, 'LICENSE'), path.join(TARGET, 'LICENSE'));

for (const { relativePath, before, after } of results) {
    console.log(`${relativePath.padEnd(44)} ${String(before).padStart(9)} → ${String(after).padStart(9)} bytes`);
}
console.log(`Vendored three@${version} into elysicester/vendor/three/.`);
