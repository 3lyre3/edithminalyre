import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const siteOrigin = 'https://edithminalyre.com';
const errors = [];

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
const intentionalMissingLinks = new Set([
    'index.html:xma-explained.html',
]);
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
        target = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
        errors.push(`${fromFile}: malformed URL encoding in ${JSON.stringify(reference)}`);
        return null;
    }
    if (!target || target.endsWith('/')) target += 'index.html';
    return { target, fragment: decodeURIComponent(url.hash.slice(1)), reference };
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
    if (resolved.fragment && resolved.target.endsWith('.html')) {
        const targetIds = idsByFile.get(resolved.target);
        if (targetIds && !targetIds.has(resolved.fragment)) {
            errors.push(`${fromFile}: ${JSON.stringify(rawReference)} points to missing fragment #${resolved.fragment}`);
        }
    }
}

for (const htmlFile of htmlFiles) {
    const html = await textFor(htmlFile);
    if (!['404.html', 'secret_s3cret_secr3t/index.html'].includes(htmlFile)) {
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

for (const xmlFile of ['feed.xml', 'sitemap.xml']) {
    const xml = await textFor(xmlFile);
    if (!xml.startsWith('<?xml') || !xml.trimEnd().endsWith(xmlFile === 'feed.xml' ? '</rss>' : '</urlset>')) {
        errors.push(`${xmlFile}: incomplete XML document`);
    }
    for (const match of xml.matchAll(/https:\/\/edithminalyre\.com(?:\/[^<\s"']*)?/g)) {
        checkReference(xmlFile, match[0]);
    }
}

function groupBy(works, property, fallback) {
    const groups = {};
    for (const work of works) {
        const values = Array.isArray(work[property])
            ? work[property]
            : [work[property] ?? fallback];
        for (const value of values) {
            if (value === undefined) continue;
            (groups[value] ??= []).push(work.id);
        }
    }
    return groups;
}

const index = JSON.parse(await textFor('index.json'));
const workIds = index.works.map((work) => work.id);
if (new Set(workIds).size !== workIds.length) errors.push('index.json: work IDs must be unique');
for (const work of index.works) checkReference('index.json', work.url);

const expectedViews = {
    works_by_type: groupBy(index.works, 'type'),
    works_by_subtype: groupBy(index.works, 'subtype'),
    works_by_publication_context: groupBy(index.works, 'published_in'),
    works_by_year: groupBy(index.works, 'year', 'undated'),
    tag_index: groupBy(index.works, 'tags'),
};
if (JSON.stringify(index.machine_views) !== JSON.stringify(expectedViews)) {
    errors.push('index.json: machine_views are stale; run npm run index:rebuild');
}

if (!fileSet.has('agents.txt')) errors.push('agents.txt: expected site artifact is missing');

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
    console.log(`Site check passed: ${htmlFiles.length} HTML pages, ${checkedReferences} local references, ${index.works.length} indexed works.`);
}
