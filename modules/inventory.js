/**
 * inventory.js — the lost pages, and the win (with the givers, a trial: creatures.js).
 *
 * Elm's vision: "an inventory so you can just collect it all / and then when collected maybe it gives you like a
 * downloadable file that does the scrolling text thing i made"; and the inventory's items are "lost pages" (Elm, 1 Oct,
 * asking for "Read" to "match them to their respective inventory items (lost pages)"). The city's passages are
 * lost pages: Numbers by Paint's, given by the pugs and hums, and President Oedipus's, at its points of light. Each is
 * found as it's read (state.js remembers it from visit to visit). Once one is found, a small count in the corner opens
 * the inventory: the lost pages numbered as the texts number them (read.html, data/lost-pages.json), each found one
 * read again with a tap or found in the texts, each still waiting with who holds it and where. Every lost page found
 * is the win: the Read page's whole, both works, written out by hand as it's scrolled, by Elm's own engine, to take
 * away (Elm: "the handwritten document should be everything on the Stay - Read page ... just as a handwritten version
 * instead"; "it should just be the file. There's absolutely no need for it to rehandwrite the page each time"): one
 * page, made once (the mission's sources/build_by_hand.py) and kept on the site (read-by-hand.html).
 */

// =============================================================================
// Imports
// =============================================================================

import { WORKS } from './reader.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * The win's page: both works written by hand, kept on the site (read-by-hand.html, made once by the mission's
 * sources/build_by_hand.py), and the name it's saved under.
 */
const BY_HAND = 'read-by-hand.html';
const BY_HAND_FILE = 'president-oedipus-and-numbers-by-paint-by-hand.html';

/** Who holds a lost page, in a few words. */
const HOLDERS = { pug: 'a pug', hum: 'a hum', light: 'a point of light', flower: 'a flower' };

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
 * @param {(id: string) => number | null} [options.numberOf] - a lost page's number as the texts number it (all of
 *   them, read.html's), so a place whose trial is off leaves a gap rather than renumbering the rest; else by order
 * @param {string} [options.byHand] - the win's page, both works written by hand (read-by-hand.html)
 */
export function createInventory({ toggle, dialog, pieces, gathered, places, kindOf, texts = 'read.html', onRead, numberOf = null, byHand = BY_HAND }) {
    const ordered = [...pieces];
    const numbers = new Map(ordered.map((fragment, index) => [fragment.id, numberOf?.(fragment.id) ?? index + 1]));
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
                // (Out of the game, into a new tab: the city stays as it was.)
                Object.assign(inTexts, { target: '_blank', rel: 'noopener', textContent: 'in the texts' });
                inTexts.append(Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: ' (opens in a new tab)' }));
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

    // (Taken as it's kept: the one page, already written, saved under its name.)
    write.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = byHand;
        link.download = BY_HAND_FILE;
        document.body.append(link);
        link.click();
        link.remove();
        status.textContent = `Saved as ${BY_HAND_FILE}: open it, and scroll.`;
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
