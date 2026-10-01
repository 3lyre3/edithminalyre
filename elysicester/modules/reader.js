/**
 * reader.js — the reading panel: a <dialog>, the only place long text appears.
 *
 * It shows one fragment exactly as it stands in its source (italics restored
 * from the fragment's "italic" list; blank lines keep their paragraphs), the
 * work and section it comes from, a "read on" link to the full text (naming
 * the page it opens at, where there is one), any links the place hosts (they
 * open in a new tab, so the city is still there to come back to), and, at its
 * foot, the thread on: "on to" the nearest place not yet read ("back to" a
 * place read at before, when the thread comes round again), "walk from here"
 * (as the shadow, from this place), and a quiet count of how many have been
 * read (with the hint on trial, once only a few are left, where they wait).
 * Esc closes it, and focus returns to whatever
 * opened it. A tap outside it closes it, and if the tap was on one of the
 * corner controls or links, that answers too (one tap, not two).
 */

// =============================================================================
// Constants
// =============================================================================

export const WORKS = Object.freeze({
    nbp: 'Numbers by Paint',
    po: 'President Oedipus',
});

/** What a tap outside the panel may land on and still be answered (the one option at the top, the count of what's
 * gathered, the corners' words and buttons). */
const CORNERS = '.controls button:not([hidden]), .plainly a, .one-button:not([hidden]), .inventory-toggle:not([hidden]), .sound-corner';

// =============================================================================
// Main Code
// =============================================================================

/** Append text to an element, wrapping each italic run in <em>. */
function appendWithItalics(element, text, italicRuns) {
    const marks = [];
    for (const run of italicRuns) {
        let from = 0;
        for (let at = text.indexOf(run, from); at > -1; at = text.indexOf(run, from)) {
            marks.push([at, at + run.length]);
            from = at + run.length;
        }
    }
    marks.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    for (const [start, end] of marks) {
        if (start < cursor) continue;
        element.append(document.createTextNode(text.slice(cursor, start)));
        const emphasis = document.createElement('em');
        emphasis.textContent = text.slice(start, end);
        element.append(emphasis);
        cursor = end;
    }
    element.append(document.createTextNode(text.slice(cursor)));
}

/** A place's name as it runs on in a sentence: "The sea-wall" becomes "the sea-wall". */
function inSentence(label) {
    return label.replace(/^The /, 'the ');
}

/** Names run together as a sentence has them: "a", "a and b", "a, b and c". */
function listed(names) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * @param {object} options
 * @param {HTMLDialogElement} options.dialog
 * @param {Map<string, object>} options.places - place data by id
 * @param {() => void} [options.onClose]
 * @param {(fragment: object) => { next: object | null, returning: boolean, read: number, total: number }} [options.onward] -
 *   where the thread goes on from a fragment (and whether that's back to a place read at before), and how many
 *   of all there are to read have been
 * @param {(fragment: object) => void} [options.onOnward] - follow the thread to that fragment
 * @param {(fragment: object) => boolean} [options.canWalk] - whether the shadow can walk from a fragment's place
 * @param {(fragment: object) => void} [options.onWalkFrom] - walk as the shadow from there ("walk from here")
 */
export function createReader({ dialog, places, onClose, onward, onOnward, canWalk, onWalkFrom }) {
    const placeName = dialog.querySelector('[data-reader-place]');
    const body = dialog.querySelector('[data-reader-text]');
    const source = dialog.querySelector('[data-reader-source]');
    const readOn = dialog.querySelector('[data-reader-read-on]');
    const readOnWords = [...readOn.childNodes].find((node) => node.nodeType === Node.TEXT_NODE) ?? readOn.insertBefore(document.createTextNode(''), readOn.firstChild);
    const alsoBlock = dialog.querySelector('[data-reader-also]');
    const alsoList = dialog.querySelector('[data-reader-also-list]');
    const onwardLine = dialog.querySelector('[data-reader-onward]');
    const onButton = dialog.querySelector('[data-reader-on]');
    const walkButton = dialog.querySelector('[data-reader-walk]');
    const count = dialog.querySelector('[data-reader-count]');
    let returnTo = null;
    let next = null;
    let current = null;

    dialog.querySelector('[data-reader-close]').addEventListener('click', () => dialog.close());
    onButton?.addEventListener('click', () => {
        if (next) onOnward?.(next);
    });
    // Walking from here, the view is the shadow's: focus doesn't go back to where the reading began.
    walkButton?.addEventListener('click', () => {
        if (!current) return;
        const from = current;
        returnTo = null;
        dialog.close();
        onWalkFrom?.(from);
    });
    // A click on the backdrop closes the panel, but only if the press began there too:
    // the click that follows the very tap that opened the panel must not close it again.
    let pressedBackdrop = false; // set by pointerdown on the dialog, read by its click
    dialog.addEventListener('pointerdown', (event) => {
        pressedBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
        const outside = event.target === dialog && pressedBackdrop;
        pressedBackdrop = false;
        if (!outside) return;
        // (The panel's own box is the dialog too, so check the tap really fell outside it.)
        const box = dialog.getBoundingClientRect();
        const inBox = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
        if (inBox && event.clientX !== 0 && event.clientY !== 0) return;
        dialog.close();
        // Once the panel has gone, whatever lay under the tap in the corners answers it (and focus stays with
        // it, rather than going back to where the reading began, which would turn the camera back there).
        const under = document.elementFromPoint(event.clientX, event.clientY)?.closest(CORNERS);
        if (under) {
            returnTo = null;
            under.click();
        }
    });
    dialog.addEventListener('close', () => {
        onClose?.();
        if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
        returnTo = null;
    });

    return {
        /**
         * @param {object} fragment - an entry from data/fragments.json
         * @param {HTMLElement | null} [opener] - where focus goes back to on close (left as it was when
         *   not given: following the thread on keeps the way back to where the reading began)
         */
        open(fragment, opener) {
            const place = places.get(fragment.place);
            current = fragment;
            if (opener !== undefined) returnTo = opener ?? null;
            // (Allison's bio, a trial, has a heading of its own, and no work: main.js.)
            placeName.textContent = fragment.heading ?? place?.label ?? '';
            body.replaceChildren();
            for (const paragraphText of fragment.text.split(/\n{2,}/)) {
                const paragraph = document.createElement('p');
                appendWithItalics(paragraph, paragraphText, fragment.italic ?? []);
                body.append(paragraph);
            }
            source.textContent = WORKS[fragment.work] ? `${WORKS[fragment.work]}, ${fragment.source}` : fragment.source;
            readOn.href = fragment.read_on;
            // Phones' PDF viewers open at the first page whatever the address asks, so the link names its page.
            const page = /#page=(\d+)/.exec(fragment.read_on)?.[1];
            readOnWords.nodeValue = page ? `read on from p. ${page}` : 'read on';

            // They open beside the city (a new tab), so coming back finds it as it was left.
            alsoList.replaceChildren();
            for (const link of fragment.links ?? place?.links ?? []) {
                const item = document.createElement('li');
                const anchor = document.createElement('a');
                anchor.href = link.href;
                anchor.target = '_blank';
                anchor.rel = 'noopener';
                anchor.textContent = link.label;
                const aside = document.createElement('span');
                aside.className = 'visually-hidden';
                aside.textContent = ' (opens in a new tab)';
                anchor.append(aside);
                item.append(anchor);
                alsoList.append(item);
            }
            alsoBlock.hidden = alsoList.children.length === 0;

            // The thread on.
            const way = onward?.(fragment) ?? null;
            next = way?.next ?? null;
            if (onwardLine) {
                onwardLine.hidden = !way;
                if (way) {
                    const nextPlace = next ? places.get(next.place) : null;
                    const again = next && next.place === fragment.place;
                    onButton.hidden = !next;
                    const name = inSentence(nextPlace?.label ?? '');
                    onButton.textContent = !next ? '' : again ? `more from ${name}` : way.returning ? `back to ${name}` : `on to ${name}`;
                    // (The hint, on trial: once only a few are left, where they wait.)
                    const left = way.total - way.read;
                    const where = way.lastAt?.length ? listed(way.lastAt.map((id) => inSentence(places.get(id)?.label ?? ''))) : '';
                    count.textContent = `${way.read} of ${way.total} ${way.word ?? 'read'}${where ? ` · the last ${left === 1 ? 'waits' : 'wait'} at ${where}` : ''}`;
                }
            }
            if (walkButton) walkButton.hidden = !(canWalk?.(fragment) ?? false);

            if (!dialog.open) dialog.showModal();
            body.focus({ preventScroll: true });
        },
        close() {
            if (dialog.open) dialog.close();
        },
        get isOpen() {
            return dialog.open;
        },
    };
}
