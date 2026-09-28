/**
 * stamp-elysicester.mjs — gives the diorama's code a new address whenever it changes.
 *
 * Browsers may keep the city's scripts and styles for hours (the site's zone
 * lets them keep JS and CSS for four), so a returning visitor could meet an
 * older city, or a mix of two versions of it. So the page loads its code
 * through elysicester/v/<stamp>/…, which _redirects serves from elysicester/
 * itself. Everything else it loads is found relative to main.js, so it
 * follows. The stamp is a hash of that code (line endings evened out, so
 * Windows and CI agree), so it changes exactly when the code does. The
 * vendored three.js keeps its plain address: it is pinned, and stays put.
 *
 *   npm run stamp:elysicester              write the current stamp into index.html
 *   node scripts/stamp-elysicester.mjs --check   say whether it is current (exit 1 if not)
 *
 * check-elysicester.mjs runs the same comparison in CI.
 */

// =============================================================================
// Imports
// =============================================================================

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIORAMA_DIR = 'elysicester';
const PAGE = `${DIORAMA_DIR}/index.html`;
/** What the page loads through its stamped address: the code, its styles, and all they fetch. */
const STAMPED = ['main.js', 'style.css', 'modules', 'data', 'assets'];
const TEXT_FILE = /\.(?:html|css|js|mjs|json|txt|svg)$/i;
/** A stamped address in the page: v/ and ten hex digits. */
export const STAMP_PATTERN = /\bv\/([0-9a-f]{10})\//g;

// =============================================================================
// Main Code
// =============================================================================

async function filesUnder(relativePath) {
    const full = path.join(ROOT, relativePath);
    let entries;
    try {
        entries = await readdir(full, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOTDIR') return [relativePath];
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const files = [];
    for (const entry of entries) {
        const child = `${relativePath}/${entry.name}`;
        files.push(...(entry.isDirectory() ? await filesUnder(child) : [child]));
    }
    return files;
}

/** The stamp the diorama's code has now: ten hex digits of a SHA-256 over every stamped file. */
export async function currentStamp() {
    const files = [];
    for (const entry of STAMPED) files.push(...await filesUnder(`${DIORAMA_DIR}/${entry}`));
    files.sort();
    const hash = createHash('sha256');
    for (const file of files) {
        let bytes = await readFile(path.join(ROOT, file));
        if (TEXT_FILE.test(file)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
        hash.update(`${file}\0`);
        hash.update(bytes);
        hash.update('\0');
    }
    return hash.digest('hex').slice(0, 10);
}

/** Every stamp written in the page, in order. */
export function stampsIn(html) {
    return [...html.matchAll(STAMP_PATTERN)].map((match) => match[1]);
}

async function main() {
    const checking = process.argv.includes('--check');
    const html = await readFile(path.join(ROOT, PAGE), 'utf8');
    const stamp = await currentStamp();
    const found = stampsIn(html);
    if (found.length === 0) {
        console.error(`${PAGE}: no stamped address (v/<stamp>/) to update`);
        process.exitCode = 1;
        return;
    }
    const current = found.every((value) => value === stamp);
    if (checking) {
        if (current) console.log(`${PAGE}: stamp ${stamp} is current.`);
        else {
            console.error(`${PAGE}: stamp ${[...new Set(found)].join(', ')} is stale (the code is now ${stamp}); run npm run stamp:elysicester`);
            process.exitCode = 1;
        }
        return;
    }
    if (current) {
        console.log(`${PAGE}: stamp ${stamp} was already current.`);
        return;
    }
    await writeFile(path.join(ROOT, PAGE), html.replace(STAMP_PATTERN, `v/${stamp}/`));
    console.log(`${PAGE}: stamped ${stamp} (was ${[...new Set(found)].join(', ')}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
