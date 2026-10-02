/**
 * check-elysicester.mjs — static checks for the Elysicester diorama.
 *
 * Runs in CI as part of `npm test` and never touches the network. It checks
 * that:
 *   - every data file parses as strict JSON and carries a "schema" number
 *   - ids are unique, and every fragment, sign, paper layer and hotspot points
 *     at a real place id
 *   - every read_on and place link resolves: local files exist, and the only
 *     outside URLs are the Overland and Adelaide texts
 *   - every Danæam string has provenance, and actually appears in the file it
 *     cites, its gloss beside it in the same entry (so nothing on screen can be
 *     coined); a word Elm gave herself ("given") must quote her, word and gloss;
 *     missing words say what they need instead
 *   - the diorama stays inside its budget: total size, file size, no audio
 *     files, no image wider or taller than 1024 px
 *   - the page's import map points at files that exist in vendor/, and the
 *     vendored three.js matches the version pinned in package.json
 *   - the page loads its code through a stamped address that is current (a
 *     hash of the code, so browsers never keep an old city), and _redirects
 *     serves that address from the diorama's own files
 *   - the page makes no outside requests beyond the site's Google Fonts link,
 *     doesn't load the shared site.js, and carries noindex until it is listed
 *     in sitemap.xml (in an HTML page, what's checked is what could ask for
 *     something: attributes, scripts and styles, not the words of its text)
 *   - the texts (read.html) mark every lost page the city gives exactly once,
 *     holding its words exactly; the old plain page's address goes on to them
 */

// =============================================================================
// Imports
// =============================================================================

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRedirects, matchRedirect, servedPath } from './redirects.mjs';
import { currentStamp, stampsIn } from './stamp-elysicester.mjs';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/**
 * The diorama's own files, at the front door (Elm, 2 Oct 2026: "replace the entirety of my website with the elysicester
 * subpage"). Its texts (read.html) and the pages it reads from stand beside it, outside its budget (Elm: the reading
 * page "should probably just live outside the diorama").
 */
const DIORAMA = ['index.html', 'main.js', 'style.css', 'modules', 'data', 'assets', 'vendor', 'fallback.webp', 'fallback-portrait.webp'];
const DATA_FILES = ['places.json', 'fragments.json', 'signs.json', 'paper.json'];

const BUDGET_TOTAL_BYTES = 2_500_000;
const BUDGET_FILE_BYTES = 1_000_000;
const MAX_IMAGE_SIDE = 1024;
const MAX_FRAGMENT_WORDS = 60;
const AUDIO_FILE = /\.(?:mp3|ogg|oga|opus|wav|m4a|aac|flac|weba|mid|midi)$/i;
const IMAGE_FILE = /\.(?:png|webp|jpe?g|gif)$/i;
const TEXT_FILE = /\.(?:html|css|js|mjs|json|txt|svg)$/i;

/** The only outside texts a reading point may send readers to (origin + path). */
const ALLOWED_TEXTS = [
    'https://overland.org.au/previous-issues/issue-239/feature-president-oedipus-or-the-democratisation-of-schizophrenia/',
    'https://digital.library.adelaide.edu.au/server/api/core/bitstreams/9cbedc1a-5eac-4ee5-b909-320c83028bba/content',
];

/** Outside origins the page itself may reach: the site's Google Fonts link. */
const ALLOWED_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

/** Strings that look like URLs but are never requested (XML namespaces). */
const INERT_URL_PREFIXES = ['http://www.w3.org/'];

const FRAGMENT_WORKS = new Set(['nbp', 'po']);
const STATUSES = new Set(['draft', 'approved']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    ndash: '–', mdash: '—', bull: '•', hellip: '…', middot: '·',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Yacute: 'Ý',
    acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
    Acirc: 'Â', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ucirc: 'Û',
    auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
    Auml: 'Ä', Euml: 'Ë', Iuml: 'Ï', Ouml: 'Ö', Uuml: 'Ü', Yuml: 'Ÿ',
    agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
    aelig: 'æ', AElig: 'Æ', oelig: 'œ', OElig: 'Œ', thorn: 'þ', THORN: 'Þ', eth: 'ð', ETH: 'Ð',
    szlig: 'ß', oslash: 'ø', Oslash: 'Ø', aring: 'å', Aring: 'Å', ccedil: 'ç', ntilde: 'ñ',
};

// =============================================================================
// Main Code
// =============================================================================

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

async function exists(relativePath) {
    try {
        await stat(path.join(ROOT, relativePath));
        return true;
    } catch {
        return false;
    }
}

async function walk(relativeDir) {
    const entries = await readdir(path.join(ROOT, relativeDir), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const relativePath = `${relativeDir}/${entry.name}`;
        if (entry.isDirectory()) files.push(...await walk(relativePath));
        else files.push(relativePath);
    }
    return files;
}

function decodeEntities(text) {
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
        .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
}

/** The visible text of an HTML file, flattened, for provenance look-ups. */
async function visibleText(relativePath) {
    const html = await readFile(path.join(ROOT, relativePath), 'utf8');
    const withoutTags = html
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, '');
    return decodeEntities(withoutTags).replace(/\s+/g, ' ');
}

/** Resolve a read_on or link target; returns an error string or null. */
async function checkTarget(where, target) {
    if (typeof target !== 'string' || target.trim() === '') return `${where}: missing URL`;
    let url;
    try {
        url = new URL(target, 'https://edithminalyre.com/');
    } catch {
        return `${where}: malformed URL ${JSON.stringify(target)}`;
    }
    if (url.origin === 'https://edithminalyre.com') {
        let file = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!file || file.endsWith('/')) file += 'index.html';
        return await exists(file) ? null : `${where}: ${JSON.stringify(target)} points to missing ${file}`;
    }
    const base = `${url.origin}${url.pathname}`;
    return ALLOWED_TEXTS.includes(base)
        ? null
        : `${where}: ${JSON.stringify(target)} is outside the Overland and Adelaide texts`;
}

/**
 * Of an HTML page, what could ask for something: its attributes' values, and its scripts and styles. (Its words are
 * only words: the addresses a bibliography lists in its text, as the texts' page carries, are never requested.)
 */
function requestable(html) {
    const parts = [];
    for (const match of html.matchAll(/\s(?:src|href|srcset|poster|action|data|content|style)\s*=\s*(['"])([\s\S]*?)\1/gi)) parts.push(match[2]);
    for (const match of html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)) parts.push(match[2]);
    return parts.join('\n');
}

function isVector(value) {
    return Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));
}

function wordCount(text) {
    return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

// -----------------------------------------------------------------------------
// Data files
// -----------------------------------------------------------------------------

async function loadData() {
    const data = {};
    for (const name of DATA_FILES) {
        const relativePath = `data/${name}`;
        if (!await exists(relativePath)) {
            fail(`${relativePath}: missing data file`);
            continue;
        }
        try {
            data[name] = JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
        } catch (error) {
            fail(`${relativePath}: invalid JSON (${error.message})`);
            continue;
        }
        if (!Number.isInteger(data[name].schema) || data[name].schema < 1) {
            fail(`${relativePath}: needs an integer "schema" (1 or more)`);
        }
    }
    return data;
}

function uniqueIds(list, label) {
    const seen = new Set();
    for (const item of list) {
        if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
            fail(`${label}: id ${JSON.stringify(item.id)} must be lowercase words joined by hyphens`);
        }
        if (seen.has(item.id)) fail(`${label}: duplicate id ${JSON.stringify(item.id)}`);
        seen.add(item.id);
    }
    return seen;
}

async function checkPlaces(places) {
    const label = `data/places.json`;
    if (!Array.isArray(places?.places)) {
        fail(`${label}: needs a "places" array`);
        return new Set();
    }
    const ids = uniqueIds(places.places, label);
    for (const place of places.places) {
        const where = `${label} ${place.id}`;
        if (![1, 2, 3].includes(place.tier)) fail(`${where}: tier must be 1, 2 or 3`);
        if (typeof place.label !== 'string' || !place.label.trim()) fail(`${where}: needs a label`);
        if (place.tier === 1) {
            if (!isVector(place.position)) fail(`${where}: a tier-1 place needs a [x, y, z] position`);
            if (!Number.isFinite(place.focus?.distance) || !Number.isFinite(place.focus?.height)) {
                fail(`${where}: a tier-1 place needs focus.distance and focus.height`);
            }
        } else if (place.position !== null) {
            fail(`${where}: a stub place (tier ${place.tier}) has position null until it is built`);
        }
        for (const [index, link] of (place.links ?? []).entries()) {
            if (typeof link.label !== 'string' || !link.label.trim()) fail(`${where}: link ${index} needs a label`);
            const problem = await checkTarget(`${where} link ${index}`, link.href);
            if (problem) fail(problem);
        }
    }
    return ids;
}

async function checkFragments(fragments, placeIds) {
    const label = `data/fragments.json`;
    if (!Array.isArray(fragments?.fragments)) {
        fail(`${label}: needs a "fragments" array`);
        return;
    }
    uniqueIds(fragments.fragments, label);
    for (const fragment of fragments.fragments) {
        const where = `${label} ${fragment.id}`;
        if (!placeIds.has(fragment.place)) fail(`${where}: unknown place ${JSON.stringify(fragment.place)}`);
        if (!FRAGMENT_WORKS.has(fragment.work)) fail(`${where}: work must be "nbp" or "po"`);
        if (typeof fragment.source !== 'string' || !fragment.source.trim()) fail(`${where}: needs a source`);
        if (typeof fragment.text !== 'string' || !fragment.text.trim()) {
            fail(`${where}: needs text`);
        } else {
            const words = wordCount(fragment.text);
            if (words > MAX_FRAGMENT_WORDS) fail(`${where}: ${words} words; fragments stay near 50`);
            else if (words > 50) warn(`${where}: ${words} words (a little over 50)`);
        }
        if (!STATUSES.has(fragment.status)) fail(`${where}: status must be "draft" or "approved"`);
        if (fragment.offset !== undefined && !isVector(fragment.offset)) fail(`${where}: offset must be [x, y, z]`);
        if (fragment.facing !== undefined && !Number.isFinite(fragment.facing)) fail(`${where}: facing must be a number of degrees`);
        for (const run of fragment.italic ?? []) {
            if (typeof run !== 'string' || !fragment.text?.includes(run)) {
                fail(`${where}: italic run ${JSON.stringify(run)} is not part of the text`);
            }
        }
        const problem = await checkTarget(`${where} read_on`, fragment.read_on);
        if (problem) fail(problem);
    }
}

async function checkSigns(signs, placeIds) {
    const label = `data/signs.json`;
    if (!Array.isArray(signs?.signs)) {
        fail(`${label}: needs a "signs" array`);
        return;
    }
    uniqueIds(signs.signs, label);
    const textCache = new Map();
    const mounts = new Set();
    for (const sign of signs.signs) {
        const where = `${label} ${sign.id}`;
        if (!placeIds.has(sign.place)) fail(`${where}: unknown place ${JSON.stringify(sign.place)}`);
        if (typeof sign.mount !== 'string' || !/^[a-z-]+\/[a-z0-9-]+$/.test(sign.mount)) {
            fail(`${where}: needs a mount ("place/slot") to hang on`);
        } else if (mounts.has(sign.mount)) {
            fail(`${where}: mount ${sign.mount} already carries another sign`);
        }
        mounts.add(sign.mount);
        if (!['draft', 'approved'].includes(sign.status)) fail(`${where}: status must be "draft" or "approved"`);
        if (sign.danaeam === null) {
            if (typeof sign.needs !== 'string' || !sign.needs.trim()) {
                fail(`${where}: a missing word must say what it "needs"`);
            }
            if (sign.gloss !== null) fail(`${where}: a missing word can't have a gloss`);
            continue;
        }
        if (typeof sign.danaeam !== 'string' || !sign.danaeam.trim()) {
            fail(`${where}: danaeam must be an exact string or null`);
            continue;
        }
        if (typeof sign.provenance !== 'string' || !sign.provenance.trim()) {
            fail(`${where}: every Danæam string needs provenance`);
            continue;
        }
        if (sign.gloss !== null && (typeof sign.gloss !== 'string' || !sign.gloss.trim())) {
            fail(`${where}: gloss must be a string from the site, or null`);
        }
        if (sign.given !== undefined) {
            // A word Elm gave herself, which the site doesn't carry: its record must quote her, word and gloss.
            if (typeof sign.given !== 'string' || !/^Elm\b/.test(sign.given)) fail(`${where}: "given" must say Elm gave it, and when`);
            if (!sign.provenance.includes(sign.danaeam)) fail(`${where}: a word Elm gave must be quoted in its provenance`);
            if (sign.gloss && !sign.provenance.includes(sign.gloss)) fail(`${where}: its gloss must come from her words too`);
            continue;
        }
        const cited = sign.provenance.split(/\s/)[0];
        if (!/\.html$/.test(cited) || !await exists(cited)) {
            fail(`${where}: provenance must start with the site file it came from (got ${JSON.stringify(cited)})`);
            continue;
        }
        if (!textCache.has(cited)) textCache.set(cited, await visibleText(cited));
        const text = textCache.get(cited);
        if (!text.includes(sign.danaeam)) fail(`${where}: ${JSON.stringify(sign.danaeam)} does not appear in ${cited}`);
        if (sign.gloss && !text.includes(sign.gloss)) fail(`${where}: gloss ${JSON.stringify(sign.gloss)} does not appear in ${cited}`);
        // The gloss must be the site's gloss for this string: in the same entry, not anywhere on the page.
        if (sign.gloss && text.includes(sign.danaeam) && text.includes(sign.gloss) && !glossBeside(text, sign.danaeam, sign.gloss)) {
            fail(`${where}: gloss ${JSON.stringify(sign.gloss)} is not beside ${JSON.stringify(sign.danaeam)} in ${cited}`);
        }
        if (typeof sign.entry === 'string' && !text.includes(sign.entry)) {
            fail(`${where}: its quoted entry does not appear word for word in ${cited}`);
        }
    }
}

/** True if `gloss` appears within a short reach of some occurrence of `word`. */
function glossBeside(text, word, gloss, reach = 48) {
    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
        const window = text.slice(Math.max(0, at - reach), at + word.length + reach);
        if (window.includes(gloss)) return true;
    }
    return false;
}

async function checkPaper(paper, placeIds) {
    const label = `data/paper.json`;
    if (!Array.isArray(paper?.layers)) {
        fail(`${label}: needs a "layers" array`);
        return;
    }
    for (const [index, layer] of paper.layers.entries()) {
        const where = `${label} layer ${index}`;
        if (!placeIds.has(layer.place)) fail(`${where}: unknown place ${JSON.stringify(layer.place)}`);
        if (typeof layer.src !== 'string' || !/\.png$/i.test(layer.src)) fail(`${where}: src must be a PNG`);
        else if (!await exists(layer.src)) fail(`${where}: ${layer.src} is missing`);
        if (!Number.isFinite(layer.depth)) fail(`${where}: needs a numeric depth offset`);
        if (!Number.isFinite(layer.scale)) fail(`${where}: needs a numeric scale`);
    }
}

// -----------------------------------------------------------------------------
// Budget
// -----------------------------------------------------------------------------

function imageSize(buffer, file) {
    if (/\.png$/i.test(file) && buffer.length >= 24) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (/\.gif$/i.test(file) && buffer.length >= 10) {
        return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (/\.webp$/i.test(file) && buffer.length >= 30 && buffer.toString('ascii', 8, 12) === 'WEBP') {
        const chunk = buffer.toString('ascii', 12, 16);
        if (chunk === 'VP8 ') {
            return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
        }
        if (chunk === 'VP8L') {
            const bits = buffer.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === 'VP8X') {
            return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
        }
    }
    if (/\.jpe?g$/i.test(file)) {
        let offset = 2;
        while (offset + 9 < buffer.length) {
            if (buffer[offset] !== 0xff) return null;
            const marker = buffer[offset + 1];
            const length = buffer.readUInt16BE(offset + 2);
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
            }
            offset += 2 + length;
        }
    }
    return null;
}

async function checkBudget(files) {
    let total = 0;
    for (const file of files) {
        const buffer = await readFile(path.join(ROOT, file));
        total += buffer.length;
        if (buffer.length > BUDGET_FILE_BYTES) fail(`${file}: ${buffer.length} bytes is over the ${BUDGET_FILE_BYTES}-byte file budget`);
        if (AUDIO_FILE.test(file)) fail(`${file}: the diorama synthesises its sound; no audio files`);
        if (IMAGE_FILE.test(file)) {
            const size = imageSize(buffer, file);
            if (!size) fail(`${file}: could not read the image's size`);
            else if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) {
                fail(`${file}: ${size.width}×${size.height} is larger than ${MAX_IMAGE_SIDE} px`);
            }
        }
    }
    if (total > BUDGET_TOTAL_BYTES) fail(`the diorama: ${total} bytes is over the ${BUDGET_TOTAL_BYTES}-byte budget`);
    return total;
}

// -----------------------------------------------------------------------------
// The texts ("Stay - Read") and the lost pages
// -----------------------------------------------------------------------------

/**
 * The texts (read.html: both works whole on one page, made by the mission's build_reading_room.py from the essay
 * pages) and the city's lost pages (data/lost-pages.json, in the order a reader meets them there; the givers in
 * data/creatures.json give them): every lost page is a passage of the city's, given by a giver (Numbers by Paint),
 * or one of President Oedipus's five parts, whole, each held by a flower (data/flowers.json; without the flowers, its
 * passages at their points of light); each is marked in the texts exactly once, and the mark holds its words exactly,
 * so a passage changed in the city (or a part on the essay's page) can't leave the texts behind.
 */
async function checkTexts(fragmentsData, placeIds, placesData) {
    const textsPath = 'read.html';
    const texts = await readFile(path.join(ROOT, textsPath), 'utf8').catch(() => null);
    if (texts === null) {
        fail(`${textsPath}: missing (where "Stay - Read" goes)`);
        return;
    }
    const lostPath = `data/lost-pages.json`;
    const creaturesPath = `data/creatures.json`;
    let lost;
    let creatures;
    try {
        lost = JSON.parse(await readFile(path.join(ROOT, lostPath), 'utf8')).lost;
        creatures = JSON.parse(await readFile(path.join(ROOT, creaturesPath), 'utf8'));
    } catch (error) {
        fail(`${lostPath} or ${creaturesPath}: ${error.message}`);
        return;
    }
    if (!Array.isArray(lost) || lost.length === 0) {
        fail(`${lostPath}: needs a "lost" list of passage ids`);
        return;
    }
    const fragments = fragmentsData?.fragments ?? [];
    const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
    const tier = new Map((placesData?.places ?? []).map((place) => [place.id, place.tier]));
    const given = new Set();
    for (const creature of creatures.creatures ?? []) {
        if (!byId.has(creature.fragment)) fail(`${creaturesPath}: a ${creature.kind} gives ${JSON.stringify(creature.fragment)}, which isn't a passage`);
        if (!['pug', 'hum'].includes(creature.kind)) fail(`${creaturesPath}: ${creature.fragment} is given by a ${JSON.stringify(creature.kind)} (pugs and hums only)`);
        if (!isVector(creature.at)) fail(`${creaturesPath}: ${creature.fragment}'s giver needs an "at" of three numbers`);
        given.add(creature.fragment);
    }
    if (creatures.allison && (!placeIds.has(creatures.allison.place) || !isVector(creatures.allison.at))) {
        fail(`${creaturesPath}: Allison needs a real place and an "at" of three numbers`);
    }
    // President Oedipus's flowers (a trial, plants): one for each of the five parts the essay divides itself into,
    // each part a lost page whole (the city reads them from the essay's page, so they're checked against it here).
    const parts = await checkFlowers(placeIds);
    const expected = [
        ...parts.keys(),
        ...fragments
            .filter((fragment) => tier.get(fragment.place) === 1 && (given.has(fragment.id) || (fragment.work === 'po' && parts.size === 0)))
            .map((fragment) => fragment.id),
    ];
    const missing = expected.filter((id) => !lost.includes(id));
    const extra = lost.filter((id) => !expected.includes(id));
    if (missing.length) fail(`${lostPath}: missing ${missing.join(', ')} (rebuild the texts)`);
    if (extra.length) fail(`${lostPath}: ${extra.join(', ')} isn't given in the city`);
    if (new Set(lost).size !== lost.length) fail(`${lostPath}: a lost page is listed twice`);

    // (Compared as the builder compares them: tags and spaces aside, an excerpt's leading or trailing ellipsis aside.)
    const bare = (text) => decodeEntities(text.replace(/<[^>]+>/g, ''))
        .replace(/­/g, '')
        .replace(/[\s ]+/g, '')
        .replace(/^…+|…+$/g, '');
    for (const id of lost) {
        const fragment = byId.get(id);
        const part = parts.get(id);
        if (!fragment && part === undefined) continue;
        const chips = texts.split(`id="lost-${id}"`).length - 1;
        if (chips !== 1) fail(`${textsPath}: lost page ${id} is marked ${chips} times, not once (rebuild the texts)`);
        // (A part is marked whole, paragraph by paragraph.)
        const held = [...texts.matchAll(new RegExp(`<mark class="lost${part === undefined ? '' : ' whole'}" data-lost="${id}">([\\s\\S]*?)</mark>`, 'g'))]
            .map((match) => match[1])
            .join('');
        if (bare(held) !== bare(part ?? fragment.text)) fail(`${textsPath}: lost page ${id} doesn't hold its ${part === undefined ? 'passage' : 'part of the essay'} word for word (rebuild the texts from the essays)`);
    }
}

/**
 * The flowers (data/flowers.json): five, one for each part of President Oedipus, each where a place is, each its own
 * bloom; and the essay's page marks its five parts (id="part-1" to "part-5", made by the mission's
 * build_president_oedipus.py). Gives each part's id (po-part-N) and its words as the page has them (from its mark to
 * the next part's: the first takes in its own paragraph, the rest begin after their ". . ."; the note goes with the
 * last), or nothing if there are no flowers.
 */
async function checkFlowers(placeIds) {
    const flowersPath = 'data/flowers.json';
    const parts = new Map();
    let data;
    try {
        data = JSON.parse(await readFile(path.join(ROOT, flowersPath), 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') fail(`${flowersPath}: ${error.message}`);
        return parts;
    }
    const BLOOMS = ['coral', 'sun', 'steel', 'crimson', 'lotus'];
    const PAGE = 'essays/president-oedipus.html';
    const flowers = Array.isArray(data.flowers) ? data.flowers : [];
    if (data.schema !== 1) fail(`${flowersPath}: schema must be 1`);
    if (data.page !== PAGE) fail(`${flowersPath}: "page" must be ${PAGE} (the city reads the parts from it)`);
    const numbers = flowers.map((flower) => flower.part);
    if (flowers.length !== 5 || [1, 2, 3, 4, 5].some((number) => !numbers.includes(number))) {
        fail(`${flowersPath}: needs one flower for each of the essay's five parts (1 to 5), and no more`);
    }
    for (const flower of flowers) {
        const which = `part ${flower.part}'s flower`;
        if (!placeIds.has(flower.place)) fail(`${flowersPath}: ${which} is at ${JSON.stringify(flower.place)}, which isn't a place`);
        if (!isVector(flower.at)) fail(`${flowersPath}: ${which} needs an "at" of three numbers`);
        if (!BLOOMS.includes(flower.bloom)) fail(`${flowersPath}: ${which} is a ${JSON.stringify(flower.bloom)} (blooms: ${BLOOMS.join(', ')})`);
        if (typeof flower.droop !== 'number' || !Number.isFinite(flower.droop)) fail(`${flowersPath}: ${which} needs a "droop" (radians)`);
        if ('floats' in flower && typeof flower.floats !== 'boolean') fail(`${flowersPath}: ${which}'s "floats" is true or false`);
    }
    const essay = await readFile(path.join(ROOT, PAGE), 'utf8').catch(() => null);
    if (essay === null) {
        fail(`${PAGE}: missing (the flowers' parts are read from it)`);
        return parts;
    }
    const marks = [1, 2, 3, 4, 5].map((number) => {
        const found = new RegExp(`<p[^>]*\\bid="part-${number}"[^>]*>[\\s\\S]*?</p>`).exec(essay);
        return found ? { number, start: found.index, end: found.index + found[0].length } : null;
    });
    if (marks.some((mark) => mark === null) || marks.some((mark, index) => index > 0 && mark.start < marks[index - 1].end)) {
        fail(`${PAGE}: needs its five parts marked in order, id="part-1" to "part-5" (rebuild it with the mission's build_president_oedipus.py)`);
        return parts;
    }
    const related = essay.indexOf('<div class="related">', marks[4].end);
    const bodyEnd = related < 0 ? -1 : essay.lastIndexOf('</div>', related);
    if (bodyEnd < marks[4].end) {
        fail(`${PAGE}: can't find where its body ends (before <div class="related">)`);
        return parts;
    }
    for (const { number, start, end } of marks) {
        parts.set(`po-part-${number}`, essay.slice(number === 1 ? start : end, number < 5 ? marks[number].start : bodyEnd));
    }
    return parts;
}

// -----------------------------------------------------------------------------
// Page, import map, vendored three.js, outside requests
// -----------------------------------------------------------------------------

async function checkPage(files) {
    const pagePath = 'index.html';
    if (!await exists(pagePath)) {
        fail(`${pagePath}: missing`);
        return;
    }
    const html = await readFile(path.join(ROOT, pagePath), 'utf8');

    if (/<script\b[^>]*\bsrc=(['"])[^'"]*site\.js\1/i.test(html)) {
        fail(`${pagePath}: the diorama carries its own chrome and must not load the shared site.js`);
    }

    const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const listed = sitemap.includes('<loc>https://edithminalyre.com/</loc>');
    const noindex = /<meta\s+name=(['"])robots\1\s+content=(['"])[^'"]*noindex/i.test(html);
    if (!listed && !noindex) fail(`${pagePath}: needs <meta name="robots" content="noindex"> until the door opens (M7)`);
    if (listed && noindex) fail(`${pagePath}: is in sitemap.xml but still carries noindex`);

    const importMap = html.match(/<script\s+type=(['"])importmap\1>([\s\S]*?)<\/script>/i);
    if (!importMap) {
        fail(`${pagePath}: needs an import map`);
    } else {
        let map;
        try {
            map = JSON.parse(importMap[2]);
        } catch (error) {
            fail(`${pagePath}: import map is not valid JSON (${error.message})`);
        }
        for (const [specifier, target] of Object.entries(map?.imports ?? {})) {
            const resolved = path.posix.normalize(target);
            if (!resolved.startsWith('vendor/')) {
                fail(`${pagePath}: import map entry ${JSON.stringify(specifier)} must point into vendor/`);
            } else if (!await exists(resolved)) {
                fail(`${pagePath}: import map entry ${JSON.stringify(specifier)} points to missing ${resolved}`);
            }
        }
    }

    // The code arrives through its stamp, so no browser keeps an old city (stamp-elysicester.mjs).
    const stamp = await currentStamp();
    const stamps = stampsIn(html);
    for (const entry of ['main.js', 'style.css']) {
        if (!new RegExp(`(?:src|href)=(['"])v/[0-9a-f]{10}/${entry.replace('.', '\\.')}\\1`).test(html)) {
            fail(`${pagePath}: must load ${entry} through its stamped address, v/<stamp>/${entry}`);
        }
    }
    if (stamps.some((value) => value !== stamp)) {
        fail(`${pagePath}: stamp ${[...new Set(stamps)].join(', ')} is stale (the code is now ${stamp}); run npm run stamp:elysicester`);
    }
    const redirects = await loadRedirects(ROOT);
    const served = servedPath(redirects, `/v/${stamp}/main.js`);
    if (served !== '/main.js') {
        fail(`_redirects: /v/<stamp>/* must be served from the root (a 200 rewrite); it gives ${served}`);
    }
    // The city came up to the front door, and its plain page gave way to its texts (read.html): old links still find
    // them, however a phone keyboard capitalises the old address.
    for (const [old, to] of [
        ['/elysicester', '/'], ['/elysicester/', '/'], ['/Elysicester', '/'], ['/ELYSICESTER/', '/'],
        ['/elysicester/read.html', '/read.html'], ['/elysicester/plainly.html', '/read.html'], ['/elysicester/plainly', '/read.html'],
    ]) {
        const goes = matchRedirect(redirects, old);
        if (goes?.status !== 301 || goes.location !== to) {
            fail(`_redirects: ${old} must go on to ${to} (301); it gives ${goes ? `${goes.status} ${goes.location}` : 'nothing'}`);
        }
    }

    const outsideUrl = /\bhttps?:\/\/[^\s"'<>)`\\]+/g;
    for (const file of files.filter((name) => TEXT_FILE.test(name) && !name.startsWith('vendor/'))) {
        const whole = await readFile(path.join(ROOT, file), 'utf8');
        const text = file.endsWith('.html') ? requestable(whole) : whole;
        for (const [raw] of text.matchAll(outsideUrl)) {
            if (INERT_URL_PREFIXES.some((prefix) => raw.startsWith(prefix))) continue;
            let url;
            try {
                url = new URL(raw.replaceAll('&amp;', '&'));
            } catch {
                fail(`${file}: malformed URL ${JSON.stringify(raw)}`);
                continue;
            }
            if (url.origin === 'https://edithminalyre.com') continue;
            if (ALLOWED_ORIGINS.includes(url.origin)) continue;
            if (ALLOWED_TEXTS.includes(`${url.origin}${url.pathname}`)) continue;
            fail(`${file}: outside URL ${JSON.stringify(raw)} is not allowed (no CDNs, analytics or trackers)`);
        }
    }
}

async function checkVendor() {
    const manifest = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    const pinned = manifest.devDependencies?.three;
    if (!/^\d+\.\d+\.\d+$/.test(pinned ?? '')) fail('package.json: three must be pinned to an exact version');
    const vendorDir = 'vendor/three';
    if (!await exists(`${vendorDir}/LICENSE`)) fail(`${vendorDir}/LICENSE: keep the MIT licence with the vendored copy`);
    if (!await exists(vendorDir)) return;
    for (const file of (await walk(vendorDir)).filter((name) => name.endsWith('.js'))) {
        const head = (await readFile(path.join(ROOT, file), 'utf8')).slice(0, 200);
        const version = head.match(/three@(\d+\.\d+\.\d+)/)?.[1];
        if (version !== pinned) {
            fail(`${file}: vendored three@${version ?? '?'} does not match the pinned ${pinned}; run npm run vendor:three`);
        }
    }
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

const missingParts = [];
for (const entry of DIORAMA) if (!await exists(entry)) missingParts.push(entry);
if (missingParts.length) {
    fail(`the diorama is missing ${missingParts.join(', ')}`);
} else {
    const files = [];
    for (const entry of DIORAMA) files.push(...((await stat(path.join(ROOT, entry))).isDirectory() ? await walk(entry) : [entry]));
    const data = await loadData();
    const placeIds = data['places.json'] ? await checkPlaces(data['places.json']) : new Set();
    if (data['fragments.json']) await checkFragments(data['fragments.json'], placeIds);
    if (data['signs.json']) await checkSigns(data['signs.json'], placeIds);
    if (data['paper.json']) await checkPaper(data['paper.json'], placeIds);
    await checkTexts(data['fragments.json'], placeIds, data['places.json']);
    await checkPage(files);
    await checkVendor();
    const total = await checkBudget(files);

    for (const message of warnings) console.warn(`note: ${message}`);
    if (errors.length === 0) {
        const count = (name, key) => data[name]?.[key]?.length ?? 0;
        console.log(
            `Elysicester check passed: ${count('places.json', 'places')} places, `
            + `${count('fragments.json', 'fragments')} fragments, ${count('signs.json', 'signs')} signs, `
            + `${files.length} files, ${total} of ${BUDGET_TOTAL_BYTES} bytes.`,
        );
    }
}

if (errors.length > 0) {
    console.error(`Elysicester check failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
    for (const message of errors) console.error(`- ${message}`);
    process.exitCode = 1;
}
