/**
 * inventory.js — the lost pages, and the win (with the givers, a trial: creatures.js).
 *
 * Elm's vision: "an inventory so you can just collect it all / and then when collected maybe it gives you like a
 * downloadable file that does the scrolling text thing i made"; and the inventory's items are "lost pages" (Elm, 1 Oct,
 * asking for "Stay - Read" to "match them to their respective inventory items (lost pages)"). The city's passages are
 * lost pages: Numbers by Paint's, given by the pugs and hums, and President Oedipus's, at its points of light. Each is
 * found as it's read (state.js remembers it from visit to visit). Once one is found, a small count in the corner opens
 * the inventory: the lost pages numbered as the texts number them (read.html, data/lost-pages.json), each found one
 * read again with a tap or found in the texts, each still waiting with who holds it and where. Every lost page found
 * is the win ("Explore - Win"): all of them written out by hand as it's scrolled, by Elm's own engine (handwrite;
 * data/handwrite.json), as one page to take away.
 */

// =============================================================================
// Imports
// =============================================================================

import { WORKS } from './reader.js';

// =============================================================================
// Constants
// =============================================================================

/** The page the win writes: its name, title and credit (the texts as the site has them: read.html). */
const REWARD_FILE = 'lost-pages-found-in-elysicester.html';
const REWARD_TITLE = 'The lost pages, found in Elysicester';
const REWARD_AUTHOR = 'Edith Lyre';
const REWARD_CREDIT = 'From President Oedipus (Overland 239, Winter 2020) and Numbers by Paint: Quantifying aesthetic receptions (MPhil thesis, Adelaide University, October 2021)';
const REWARD_CREDIT_URL = 'https://edithminalyre.com/elysicester/read.html';
const CITY_URL = 'https://edithminalyre.com/elysicester/';

/** Who holds a lost page, in a few words. */
const HOLDERS = { pug: 'a pug', hum: 'a hum', light: 'a point of light' };

/**
 * The engine's page in the city's dusk (laid over its own colours; Elm: "feel free to adjust aesthetics and stuff with
 * it as see fit"): warm paper and violet ink by day, the plaques' gold on the dusk by night.
 */
const CITY_COLOURS = `
:root { --paper:#f5ecdc; --ink:#2a1d2e; --hand:#5a2f6e; --muted:#7a6a5c; --flare:#b0502c; --rule:#d9c7a8; --bubble:rgba(42,29,46,.07); --focus:#5a2f6e; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#140f1c; --ink:#f3e2bd; --hand:#e9b860; --muted:#a8977c; --flare:#ff9a70; --rule:#3a2c40; --bubble:rgba(243,226,189,.08); --focus:#e9b860; } }
:root[data-theme="dark"] { --paper:#140f1c; --ink:#f3e2bd; --hand:#e9b860; --muted:#a8977c; --flare:#ff9a70; --rule:#3a2c40; --bubble:rgba(243,226,189,.08); --focus:#e9b860; }
h2 { color:var(--hand); }
.place-source { font-size:.86em; color:var(--muted); text-indent:0; }
`;

// =============================================================================
// The page the win writes
// =============================================================================

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A passage's paragraph as HTML, its italic runs (the fragment's "italic" list) in <em>, as the reader shows them. */
function withItalics(text, runs) {
    const marks = [];
    for (const run of runs) {
        for (let at = text.indexOf(run); at > -1; at = text.indexOf(run, at + run.length)) marks.push([at, at + run.length]);
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

/**
 * The page: Elm's engine's own (as handwrite.py's render writes it), its title and credit, then each lost page under
 * its number and its place's name, its words as they stand, where it comes from, and a break between.
 */
export function writtenByHand({ fragments, places, engine, numberOf = () => null, date = new Date() }) {
    const BREAK = '<div class="break" role="separator" aria-label="Section break"><i></i><i></i><i></i></div>';
    const body = fragments.map((fragment) => {
        const label = places.get(fragment.place)?.label ?? '';
        const number = numberOf(fragment.id);
        const paragraphs = fragment.text.split(/\n{2,}/).map((paragraph) => `<p>${withItalics(paragraph, fragment.italic ?? [])}</p>`).join('\n');
        return `<h2>${number ? `Lost page ${number}: ` : ''}${escape(label)}</h2>\n${paragraphs}\n<p class="place-source">${escape(WORKS[fragment.work] ?? '')}, ${escape(fragment.source)}</p>`;
    }).join(`\n${BREAK}\n`);
    const when = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escape(REWARD_TITLE)} — ${escape(REWARD_AUTHOR)}</title>
<meta name="author" content="${escape(REWARD_AUTHOR)}">
<meta name="color-scheme" content="light dark">
${engine.fonts}<style>${engine.css}${CITY_COLOURS}</style>
</head>
<body>
<script>document.documentElement.className = 'js';</script>
<article>
<header class="title">
  <h1>${escape(REWARD_TITLE)}</h1>
  <p class="byline">${escape(REWARD_AUTHOR)}</p>
  <p class="credit"><a href="${escape(REWARD_CREDIT_URL)}">${escape(REWARD_CREDIT)}</a></p>
  <p class="controls"><button type="button" id="handToggle" aria-pressed="false">Set the handwriting in type</button><button type="button" id="themeToggle">Dark</button></p>
</header>
<hr class="rule">
${body}
<footer class="colophon"><p>Found among the pugs and hums of <a href="${escape(CITY_URL)}">Elysicester</a>, ${escape(when)}. Written by hand with Edith's handwrite.</p></footer>
</article>
<script>${engine.js}</script>
</body>
</html>
`;
}

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {HTMLButtonElement} options.toggle - the count in the corner
 * @param {HTMLDialogElement} options.dialog - the inventory
 * @param {object[]} options.pieces - the lost pages, in their order (read.html's: data/lost-pages.json)
 * @param {Set<string>} options.gathered - those already found (read)
 * @param {Map<string, object>} options.places
 * @param {(id: string) => 'pug' | 'hum' | 'light'} options.kindOf - who holds each
 * @param {string} [options.texts] - the texts' page (read.html), where each lost page is marked (#lost-ID)
 * @param {(fragment: object, opener: HTMLElement) => void} options.onRead - read a found page again
 * @param {() => Promise<object>} options.loadEngine - Elm's engine (data/handwrite.json)
 */
export function createInventory({ toggle, dialog, pieces, gathered, places, kindOf, texts = 'read.html', onRead, loadEngine }) {
    const ordered = [...pieces];
    const numbers = new Map(ordered.map((fragment, index) => [fragment.id, index + 1]));
    const count = toggle.querySelector('[data-inventory-count]');
    const list = dialog.querySelector('[data-inventory-list]');
    const note = dialog.querySelector('[data-inventory-note]');
    const win = dialog.querySelector('[data-inventory-win]');
    const write = dialog.querySelector('[data-inventory-write]');
    const status = dialog.querySelector('[data-inventory-status]');
    let announced = false;
    let returnTo = null;

    const total = ordered.length;
    const have = () => ordered.filter((fragment) => gathered.has(fragment.id));
    const won = () => total > 0 && have().length === total;
    const inSentence = (label) => label.replace(/^The /, 'the ');

    function render() {
        const held = have().length;
        count.textContent = `${held} / ${total}`;
        toggle.hidden = held === 0;
        toggle.classList.toggle('is-won', won());
        note.textContent = won() ? `Every lost page found: all ${total}.` : `${held} of the ${total} lost pages found.`;
        list.replaceChildren(...ordered.map((fragment) => {
            const item = document.createElement('li');
            const number = document.createElement('span');
            number.className = 'inventory-number';
            number.textContent = String(numbers.get(fragment.id));
            const place = places.get(fragment.place)?.label ?? '';
            if (gathered.has(fragment.id)) {
                item.className = 'is-found';
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'inventory-piece';
                const words = document.createElement('span');
                words.className = 'inventory-words';
                const first = fragment.text.split(/\n{2,}/)[0].replace(/^…/, '');
                words.textContent = first.length > 64 ? `${first.slice(0, 62).replace(/\s+\S*$/, '')} …` : first;
                const where = document.createElement('span');
                where.className = 'inventory-where';
                where.textContent = `${place}, from ${WORKS[fragment.work] ?? ''}`;
                button.append(words, where);
                button.addEventListener('click', () => {
                    returnTo = null;
                    dialog.close();
                    onRead(fragment, toggle);
                });
                const inTexts = document.createElement('a');
                inTexts.className = 'inventory-texts';
                inTexts.href = `${texts}#lost-${fragment.id}`;
                inTexts.textContent = 'in the texts';
                item.append(number, button, inTexts);
            } else {
                item.className = 'is-waiting';
                const waiting = document.createElement('span');
                waiting.className = 'inventory-waiting';
                waiting.textContent = `${HOLDERS[kindOf(fragment.id)] ?? 'someone'}, at ${inSentence(place)}`;
                item.append(number, waiting);
            }
            return item;
        }));
        win.hidden = !won();
    }

    toggle.addEventListener('click', () => {
        returnTo = toggle;
        render();
        dialog.showModal();
        (won() ? write : list.querySelector('button') ?? dialog.querySelector('[data-inventory-close]')).focus({ preventScroll: true });
    });
    dialog.querySelector('[data-inventory-close]').addEventListener('click', () => dialog.close());
    // A tap on the backdrop closes it (as the reader's does), only where the press began there too.
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => {
        pressedBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
        const outside = event.target === dialog && pressedBackdrop;
        pressedBackdrop = false;
        if (!outside) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom && event.clientX !== 0) return;
        dialog.close();
    });
    dialog.addEventListener('close', () => {
        if (returnTo && document.contains(returnTo) && !returnTo.hidden) returnTo.focus({ preventScroll: true });
        returnTo = null;
    });

    write.addEventListener('click', async () => {
        write.disabled = true;
        status.textContent = 'Writing…';
        try {
            const engine = await loadEngine();
            const html = writtenByHand({ fragments: ordered, places, engine, numberOf: (id) => numbers.get(id) });
            const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = REWARD_FILE;
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            status.textContent = `Saved as ${REWARD_FILE}: open it, and scroll.`;
            if (window.elysicesterDebug) window.elysicesterDebug.reward = html;
        } catch (error) {
            console.error('The lost pages could not be written:', error);
            status.textContent = 'It could not be written just now.';
        } finally {
            write.disabled = false;
        }
    });

    render();
    // (Won on an earlier visit, it isn't announced again: the count in the corner says so.)
    announced = won();
    return {
        /** A page has been found (or read again): the count, and if that was the last, the win, once. */
        gathered(id) {
            if (!numbers.has(id)) return false;
            render();
            if (won() && !announced) {
                announced = true;
                return true;
            }
            return false;
        },
        /** Show the inventory (the win, if it's won). */
        open() {
            toggle.click();
        },
        /** Whether every lost page is found. */
        get won() {
            return won();
        },
        /** The lost pages in their order (for the local checks, and the reader's count). */
        pieces: ordered,
        /** A lost page's number, as the texts number it. */
        numberOf: (id) => numbers.get(id) ?? null,
    };
}
