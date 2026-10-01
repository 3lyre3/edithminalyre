/**
 * plainly-elysicester.mjs — the city's passages as a plain page: elysicester/plainly.html.
 *
 * Elm: "somewhere near the start just direct links to a normal page where you don't have to be a bird and can
 * just read text normal style". The page is written from the diorama's own data (data/places.json and
 * data/fragments.json), so it holds exactly the passages the city holds, place by place, in the city's order: each
 * as the reading panel shows it (its paragraphs, its italics, the work and section it comes from, and a link to
 * read on from its page), with the place's other links ("also here"); then the whole works. It wears the site's
 * own pages' look (style.css), so it reads as they do; it needs no script.
 *
 *   npm run plainly:elysicester                  write elysicester/plainly.html
 *   node scripts/plainly-elysicester.mjs --check  say whether it is current (exit 1 if not)
 *
 * check-elysicester.mjs runs the same comparison in CI.
 */

// =============================================================================
// Imports
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIORAMA_DIR = 'elysicester';
export const PLAINLY_PAGE = `${DIORAMA_DIR}/plainly.html`;
/** The works the passages come from (as the reading panel names them: modules/reader.js). */
const WORKS = { nbp: 'Numbers by Paint', po: 'President Oedipus' };
const BOOK = 'https://digital.library.adelaide.edu.au/server/api/core/bitstreams/9cbedc1a-5eac-4ee5-b909-320c83028bba/content';
const OEDIPUS = 'https://overland.org.au/previous-issues/issue-239/feature-president-oedipus-or-the-democratisation-of-schizophrenia/';

// =============================================================================
// Main Code
// =============================================================================

function escape(text) {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** A paragraph's text with its italic runs restored, as the reading panel restores them. */
function withItalics(text, runs) {
    const marks = [];
    for (const run of runs) {
        let from = 0;
        for (let at = text.indexOf(run, from); at > -1; at = text.indexOf(run, from)) {
            marks.push([at, at + run.length]);
            from = at + run.length;
        }
    }
    marks.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    let html = '';
    for (const [start, end] of marks) {
        if (start < cursor) continue;
        html += `${escape(text.slice(cursor, start))}<em>${escape(text.slice(start, end))}</em>`;
        cursor = end;
    }
    return html + escape(text.slice(cursor));
}

/** "read on from p. 60" where the link names its page, else "read on" (as the reading panel words it). */
function readOnWords(url) {
    const page = /#page=(\d+)/.exec(url)?.[1];
    return page ? `read on from p. ${page}` : 'read on';
}

/** Whether a link leaves the site (it opens beside the page, as the city's do). */
function leaves(url) {
    return /^https?:\/\//.test(url);
}

function link(url, words) {
    return leaves(url)
        ? `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(words)}</a>`
        : `<a href="${escape(url)}">${escape(words)}</a>`;
}

/** The page, from the diorama's data. */
export async function plainlyHtml(root = ROOT) {
    const places = JSON.parse(await readFile(path.join(root, DIORAMA_DIR, 'data', 'places.json'), 'utf8')).places;
    const fragments = JSON.parse(await readFile(path.join(root, DIORAMA_DIR, 'data', 'fragments.json'), 'utf8')).fragments;
    const sections = [];
    for (const place of places.filter((candidate) => candidate.tier === 1)) {
        const passages = fragments.filter((fragment) => fragment.place === place.id);
        if (!passages.length) continue;
        const lines = [`        <section class="place" id="${escape(place.id)}">`, `            <h2>${escape(place.label)}</h2>`];
        for (const fragment of passages) {
            lines.push('            <div class="passage">');
            for (const paragraph of fragment.text.split(/\n{2,}/)) lines.push(`                <p>${withItalics(paragraph, fragment.italic ?? [])}</p>`);
            const source = `${WORKS[fragment.work] ?? ''}, ${fragment.source}`;
            lines.push(`                <p class="passage-source">${escape(source)} · ${link(fragment.read_on, readOnWords(fragment.read_on))}</p>`);
            lines.push('            </div>');
        }
        if (place.links?.length) {
            lines.push(`            <p class="passage-also">also here: ${place.links.map((also) => link(also.href, also.label)).join(' · ')}</p>`);
        }
        lines.push('        </section>');
        sections.push(lines.join('\n'));
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Elysicester's passages, plainly: Numbers by Paint by Edith Mina Lyre, as text, place by place, as they wait in the city.">
    <meta name="author" content="Edith Mina Lyre">
    <link rel="canonical" href="https://edithminalyre.com/elysicester/plainly.html">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&amp;family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&amp;display=swap" rel="stylesheet">
    <title>Elysicester, plainly – Edith Mina Lyre</title>
    <link rel="stylesheet" href="../style.css">
    <style>
        .plainly-intro { color: var(--text-muted); }
        .place { margin: 3rem 0; }
        .place h2 { font-family: var(--font-display); font-weight: 400; letter-spacing: 0.04em; margin-bottom: 1.2rem; }
        .passage { margin: 0 0 2rem; }
        .passage p { margin: 0 0 0.9rem; }
        .passage-source, .passage-also { font-family: var(--font-display); font-size: 0.9rem; letter-spacing: 0.04em; color: var(--text-muted); }
    </style>
</head>
<body>
<main>
        <a href="../index.html" class="back">d&uacute;rrync</a>

        <h1>Elysicester, plainly</h1>

        <p class="plainly-intro">The city&rsquo;s passages as text, place by place, as they wait in the city. <a href="./">Back into the city</a>.</p>

${sections.join('\n\n')}

        <div class="mark"></div>

        <section class="place" id="whole-works">
            <h2>The whole works</h2>
            <p>${link(BOOK, 'Numbers by Paint')} (the book) · ${link(OEDIPUS, 'President Oedipus')} (Overland) · <a href="../essays.html">essays</a> · <a href="../bio.html">bio</a> · <a href="../cv.html">cv</a></p>
        </section>
    </main>

    <script src="../site.js"></script>
</body>
</html>
`;
}

// (Run directly: write the page, or with --check, say whether it is current.)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const target = path.join(ROOT, PLAINLY_PAGE);
    const wanted = await plainlyHtml();
    if (process.argv.includes('--check')) {
        const current = await readFile(target, 'utf8').catch(() => '');
        if (current.replaceAll('\r\n', '\n') !== wanted) {
            console.error(`${PLAINLY_PAGE} is out of date: run npm run plainly:elysicester`);
            process.exit(1);
        }
        console.log(`${PLAINLY_PAGE} is current.`);
    } else {
        await writeFile(target, wanted);
        console.log(`${PLAINLY_PAGE}: written.`);
    }
}
