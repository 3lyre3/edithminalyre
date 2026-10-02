/**
 * whisper.js — after a long stillness, one of E's lines surfaces low over the water, and sinks again (a trial:
 * the playtester's "a long idle brings an E line back as a whisper over the water"; ?whisper=off).
 *
 * The lines are E's inner voice from the Intermaze, taken up where the flight left off: each stillness brings
 * the next, round and round. Any touch, key, wheel or pointer sends a line away, and the stillness counts
 * again from nothing; so does a passage being open, or the page being hidden. It only ever comes when the
 * visitor has let the city be, so it never talks over them. Under reduced motion it neither drifts nor fades
 * slowly: it simply comes and goes.
 */

// =============================================================================
// Constants
// =============================================================================

/** Seconds of stillness before the first line, and then before each next one. */
const STILL_FIRST = 40;
const STILL_AGAIN = 34;

/** How long a line stays (seconds): a base, and a little for every word, as the Intermaze's lines do. */
const HOLD_BASE = 3.2;
const HOLD_PER_WORD = 0.45;

/** Its rise and its sinking, in seconds (the style's transition matches). */
const RISE = 2.4;
const SINK = 2.8;

// =============================================================================
// Main Code
// =============================================================================

/**
 * @param {object} options
 * @param {HTMLElement} options.element - the line's place on the page (aria-hidden: the words are the book's,
 *   and a line out of nowhere shouldn't interrupt a screen reader)
 * @param {string[]} options.lines - E's lines, in order
 * @param {number} [options.from] - the first line to whisper (where the flight left off)
 * @param {() => boolean} [options.isBusy] - true while something else holds the visitor (a passage open)
 * @param {(listener: (dt: number) => void) => void} options.onFrame - the stage's frames
 *   (under reduced motion the style keeps it from drifting, and it comes and goes quickly)
 */
export function createWhisper({ element, lines, from = 0, isBusy = () => false, onFrame }) {
    if (!element || !lines.length) return null;
    let next = ((from % lines.length) + lines.length) % lines.length;
    let still = 0;
    let wait = STILL_FIRST;
    let showing = 0;
    let hold = 0;
    let sinking = null;

    const sink = (quickly) => {
        if (!element.classList.contains('is-whispering')) return;
        element.classList.toggle('is-quick', Boolean(quickly));
        element.classList.remove('is-whispering');
        window.clearTimeout(sinking);
        sinking = window.setTimeout(() => {
            element.classList.remove('is-quick');
        }, (quickly ? 0.6 : SINK) * 1000);
        showing = 0;
    };
    const stir = () => {
        still = 0;
        if (showing) {
            sink(true);
            wait = STILL_AGAIN;
        }
    };
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
        window.addEventListener(type, stir, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', stir);

    onFrame((dt) => {
        if (isBusy() || document.hidden) {
            stir();
            return;
        }
        if (showing) {
            showing += dt;
            if (showing >= hold) {
                sink(false);
                wait = STILL_AGAIN;
                still = 0;
            }
            return;
        }
        still += dt;
        if (still < wait) return;
        const line = lines[next];
        next = (next + 1) % lines.length;
        element.textContent = line;
        element.classList.remove('is-quick');
        // (Next frame, so the transition runs from the line's hidden state.)
        requestAnimationFrame(() => element.classList.add('is-whispering'));
        hold = RISE + HOLD_BASE + HOLD_PER_WORD * line.split(/\s+/).filter(Boolean).length;
        showing = 1e-6;
    });

    return {
        /** For the local checks: how long the city has been still, and the line showing (or null). */
        get state() {
            return { still, wait, showing: showing ? element.textContent : null, next };
        },
    };
}
