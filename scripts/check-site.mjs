import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRedirects, servedPath } from './redirects.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const siteOrigin = 'https://edithminalyre.com';
const errors = [];
// A reference may reach its file through a rewrite in _redirects (Elysicester's stamped code does).
const redirects = await loadRedirects(root);

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

const files = await walk(root);
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/'));
const fileSet = new Set(relativeFiles);
const intentionalMissingLinks = new Set();
// Elysicester, at the front door, opens a passage named in its address (#read-<passage id>: main.js), so those name
// its passages, not ids on its page (its texts, read.html, link each lost page back to the city so).
const cityPassages = new Set(JSON.parse(await readFile(path.join(root, 'data', 'fragments.json'), 'utf8'))
    .fragments.map((fragment) => `read-${fragment.id}`));
const htmlFiles = relativeFiles.filter((file) => file.endsWith('.html'));
const cssFiles = relativeFiles.filter((file) => file.endsWith('.css'));
const textByFile = new Map();
let checkedReferences = 0;

async function textFor(relativePath) {
    if (!textByFile.has(relativePath)) {
        textByFile.set(relativePath, await readFile(path.join(root, relativePath), 'utf8'));
    }
    return textByFile.get(relativePath);
}

function resolveLocalReference(fromFile, rawReference) {
    const reference = rawReference.replaceAll('&amp;', '&').trim();
    if (!reference || /^(?:data|mailto|tel|javascript):/i.test(reference)) return null;

    let url;
    try {
        url = new URL(reference, `${siteOrigin}/${fromFile}`);
    } catch {
        errors.push(`${fromFile}: malformed URL ${JSON.stringify(reference)}`);
        return null;
    }
    if (url.origin !== siteOrigin) return null;

    let target;
    try {
        target = decodeURIComponent(servedPath(redirects, url.pathname)).replace(/^\/+/, '');
    } catch {
        errors.push(`${fromFile}: malformed URL encoding in ${JSON.stringify(reference)}`);
        return null;
    }
    if (!target || target.endsWith('/')) target += 'index.html';
    return { target, fragment: decodeURIComponent(url.hash.slice(1)), rawFragment: url.hash.slice(1), reference };
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', uacute: 'ú', middot: '·' };

/** A page's visible text, flattened (tags gone, entities read, whitespace single), for finding a text fragment's words. */
function visibleText(html) {
    return html
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
        .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** The words a text fragment (#:~:text=[prefix-,]start[,end][,-suffix]) asks the browser to find on the page. */
function textFragmentWords(rawFragment) {
    const directives = rawFragment.slice(rawFragment.indexOf(':~:') + 3).split('&').filter((d) => d.startsWith('text='));
    return directives.flatMap((directive) => directive.slice('text='.length).split(',')
        .filter((part) => !part.endsWith('-') && !part.startsWith('-'))
        .map((part) => decodeURIComponent(part).replace(/\s+/g, ' ').toLowerCase()));
}

const idsByFile = new Map();
for (const htmlFile of htmlFiles) {
    const html = await textFor(htmlFile);
    const ids = new Set();
    for (const match of html.matchAll(/\bid=(['"])(.*?)\1/gi)) {
        if (ids.has(match[2])) errors.push(`${htmlFile}: duplicate id ${JSON.stringify(match[2])}`);
        ids.add(match[2]);
    }
    for (const match of html.matchAll(/<a\b[^>]*\bname=(['"])(.*?)\1/gi)) ids.add(match[2]);
    idsByFile.set(htmlFile, ids);
}

function checkReference(fromFile, rawReference) {
    const resolved = resolveLocalReference(fromFile, rawReference);
    if (!resolved) return;
    checkedReferences += 1;

    if (!fileSet.has(resolved.target)) {
        if (intentionalMissingLinks.has(`${fromFile}:${resolved.target}`)) return;
        errors.push(`${fromFile}: ${JSON.stringify(rawReference)} points to missing ${resolved.target}`);
        return;
    }
    if (resolved.fragment.startsWith(':~:') && resolved.target.endsWith('.html')) {
        // A text fragment names no id: the browser finds its words on the page, so the words must be there.
        const text = visibleText(textByFile.get(resolved.target) ?? '');
        for (const words of textFragmentWords(resolved.rawFragment)) {
            if (!text.includes(words)) errors.push(`${fromFile}: ${JSON.stringify(rawReference)} looks for words not on ${resolved.target}: ${JSON.stringify(words)}`);
        }
        return;
    }
    if (resolved.target === 'index.html' && cityPassages.has(resolved.fragment)) return;
    if (resolved.fragment && resolved.target.endsWith('.html')) {
        const targetIds = idsByFile.get(resolved.target);
        if (targetIds && !targetIds.has(resolved.fragment)) {
            errors.push(`${fromFile}: ${JSON.stringify(rawReference)} points to missing fragment #${resolved.fragment}`);
        }
    }
}

for (const htmlFile of htmlFiles) {
    const html = await textFor(htmlFile);
    // (The 404 and the city carry their own chrome; every page of text wears the site's.)
    if (!['404.html', 'index.html'].includes(htmlFile)) {
        if (!/<script\s+src=(['"])(?:\.\.\/)?site\.js\1><\/script>/.test(html)) {
            errors.push(`${htmlFile}: shared site.js is missing`);
        }
        if (/id=(['"])(?:themeToggle|glow|wisp)\1/.test(html) || /class=(['"])[^'"]*\bgrain\b/.test(html)) {
            errors.push(`${htmlFile}: shared chrome should be mounted by site.js`);
        }
    }
    const attributePattern = /<(?:a|img|link|script|source)\b[^>]*\b(?:href|src)=(['"])(.*?)\1/gi;
    for (const match of html.matchAll(attributePattern)) checkReference(htmlFile, match[2]);
}

for (const cssFile of cssFiles) {
    const css = (await textFor(cssFile)).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
        checkReference(cssFile, match[2]);
    }
}

for (const jsonFile of relativeFiles.filter((file) => file.endsWith('.json') || file.endsWith('.webmanifest'))) {
    try {
        JSON.parse(await textFor(jsonFile));
    } catch (error) {
        errors.push(`${jsonFile}: invalid JSON (${error.message})`);
    }
}

const sitemap = await textFor('sitemap.xml');
if (!sitemap.startsWith('<?xml') || !sitemap.trimEnd().endsWith('</urlset>')) errors.push('sitemap.xml: incomplete XML document');
for (const match of sitemap.matchAll(/https:\/\/edithminalyre\.com(?:\/[^<\s"']*)?/g)) checkReference('sitemap.xml', match[0]);
// (Every page of the site is listed, but the 404, which asks not to be indexed.)
for (const htmlFile of htmlFiles.filter((file) => file !== '404.html')) {
    const address = `https://edithminalyre.com/${htmlFile.replace(/(^|\/)index\.html$/, '$1')}`;
    if (!sitemap.includes(`<loc>${address}</loc>`)) errors.push(`sitemap.xml: doesn't list ${address}`);
}

for (const stalePath of [
    'well-known/ara/digest.md',
    'well-known/ara/manifest.json',
    '.github/workflows/claude.yml',
    '.github/workflows/claude-code-review.yml',
]) {
    if (fileSet.has(stalePath)) errors.push(`${stalePath}: obsolete scaffold is still present`);
}

if (errors.length > 0) {
    console.error(`Site check failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Site check passed: ${htmlFiles.length} HTML pages, ${checkedReferences} local references.`);
}
