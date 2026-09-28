/**
 * reader.js — the reading panel: a <dialog>, the only place long text appears.
 *
 * It shows one fragment exactly as it stands in its source (italics restored
 * from the fragment's "italic" list; blank lines keep their paragraphs), the
 * work and section it comes from, a "read on" link to the full text, and any
 * links the place hosts. Esc closes it, and focus returns to whatever opened it.
 */

// =============================================================================
// Constants
// =============================================================================

export const WORKS = Object.freeze({
    nbp: 'Numbers by Paint',
    po: 'President Oedipus',
});

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

/**
 * @param {object} options
 * @param {HTMLDialogElement} options.dialog
 * @param {Map<string, object>} options.places - place data by id
 * @param {() => void} [options.onClose]
 */
export function createReader({ dialog, places, onClose }) {
    const placeName = dialog.querySelector('[data-reader-place]');
    const body = dialog.querySelector('[data-reader-text]');
    const source = dialog.querySelector('[data-reader-source]');
    const readOn = dialog.querySelector('[data-reader-read-on]');
    const alsoBlock = dialog.querySelector('[data-reader-also]');
    const alsoList = dialog.querySelector('[data-reader-also-list]');
    let returnTo = null;

    dialog.querySelector('[data-reader-close]').addEventListener('click', () => dialog.close());
    // A click on the backdrop closes the panel, but only if the press began there too:
    // the click that follows the very tap that opened the panel must not close it again.
    let pressedBackdrop = false; // set by pointerdown on the dialog, read by its click
    dialog.addEventListener('pointerdown', (event) => {
        pressedBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog && pressedBackdrop) dialog.close();
        pressedBackdrop = false;
    });
    dialog.addEventListener('close', () => {
        onClose?.();
        if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
        returnTo = null;
    });

    return {
        /**
         * @param {object} fragment - an entry from data/fragments.json
         * @param {HTMLElement | null} opener - where focus goes back to on close
         */
        open(fragment, opener) {
            const place = places.get(fragment.place);
            returnTo = opener ?? null;
            placeName.textContent = place?.label ?? '';
            body.replaceChildren();
            for (const paragraphText of fragment.text.split(/\n{2,}/)) {
                const paragraph = document.createElement('p');
                appendWithItalics(paragraph, paragraphText, fragment.italic ?? []);
                body.append(paragraph);
            }
            source.textContent = `${WORKS[fragment.work] ?? ''}, ${fragment.source}`;
            readOn.href = fragment.read_on;

            alsoList.replaceChildren();
            for (const link of place?.links ?? []) {
                const item = document.createElement('li');
                const anchor = document.createElement('a');
                anchor.href = link.href;
                anchor.textContent = link.label;
                item.append(anchor);
                alsoList.append(item);
            }
            alsoBlock.hidden = alsoList.children.length === 0;

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
