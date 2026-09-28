/**
 * redirects.mjs — the site's _redirects, read the way Cloudflare Pages reads it.
 *
 * For the local checks and the local screenshot server, so they see the site
 * as Pages serves it. Only what the site uses: exact paths, :placeholders (one
 * path segment each), a single trailing splat (*), redirects (301, 302, 303,
 * 307, 308; 302 when no code is given) and 200 rewrites. Matching is
 * case-sensitive, as it is on Pages (tried on a preview, 29 September 2026),
 * and the first rule that matches wins.
 */

// =============================================================================
// Imports
// =============================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// =============================================================================
// Main Code
// =============================================================================

/** Turn one rule's source path into a pattern: :name takes one segment, * takes the rest. */
function patternFor(source) {
    const names = [];
    const body = source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|:([A-Za-z]\w*)/g, (token, name) => {
        if (token === '*') {
            names.push('splat');
            return '(.*)';
        }
        names.push(name);
        return '([^/]+)';
    });
    return { pattern: new RegExp(`^${body}$`), names };
}

/** Parse the text of a _redirects file into rules, in order. */
export function parseRedirects(text) {
    const rules = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const [source, destination, code] = line.split(/\s+/);
        if (!source || !destination) continue;
        rules.push({ source, destination, status: code ? Number(code) : 302, ...patternFor(source) });
    }
    return rules;
}

/** The site's rules, read from _redirects at the repo root (none if there is no file). */
export async function loadRedirects(root) {
    try {
        return parseRedirects(await readFile(path.join(root, '_redirects'), 'utf8'));
    } catch {
        return [];
    }
}

/**
 * The first rule matching a path, with its destination filled in:
 * { status, location } or null if nothing matches.
 */
export function matchRedirect(rules, pathname) {
    for (const rule of rules) {
        const match = rule.pattern.exec(pathname);
        if (!match) continue;
        const values = Object.fromEntries(rule.names.map((name, index) => [name, match[index + 1]]));
        const location = rule.destination.replace(/:([A-Za-z]\w*)/g, (token, name) => values[name] ?? token);
        return { status: rule.status, location };
    }
    return null;
}

/** Where a path is really served from: through any 200 rewrite, else itself. */
export function servedPath(rules, pathname) {
    const found = matchRedirect(rules, pathname);
    return found?.status === 200 ? found.location : pathname;
}
