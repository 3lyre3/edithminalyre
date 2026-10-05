/**
 * governor.js — keeps the frame rate up on a device that can't draw the city as fast as its screen asks, by drawing
 * fewer pixels, and gives them back when there's room again (Elm, 5 Oct, of the ways to faster frames: "all your
 * suggestions seem good", fewer pixels and a governor among them; a trial: ?governor=off keeps the old safety net,
 * which only ever stepped the drawing buffer down, a quarter at a time, never below one pixel to the page's).
 *
 * It climbs down a ladder a rung at a time, from the screen's own pixel ratio with the city drawn at four samples to a
 * pixel (on a computer): first the samples go (the ink's lines draw the edges anyway, and a touch screen never had
 * them); then the pixel ratio, a quarter at a time, down to one pixel to the page's; then the city's own picture,
 * smaller than the screen beneath the ink (0.85, 0.72, 0.6 of it: ink.js DRAWN), its lines and the paper's grain still
 * the screen's own. Nothing else about the look changes.
 *
 * When frames run slow for a sustained stretch (not one hitch, nor the gap a hidden tab leaves), it steps down a rung;
 * if that didn't make them faster (a screen that only ever shows thirty frames a second, say), it steps back up and
 * leaves the ladder alone a while, twice as long each time. When frames have run easily for a good while, it tries a
 * rung back up; if the slowness comes back soon after, it steps back down, and tries that rung again only after twice
 * as long (and after three tries, not again).
 */

// =============================================================================
// Constants
// =============================================================================

/** A frame slower than this (seconds) is slow: under 38 frames a second. */
export const SLOW_FRAME = 1 / 38;
/** A frame faster than this is easy (48 frames a second: so a 50 Hz screen's frames count as easy too). */
const EASY_FRAME = 1 / 48;
/** The pixel ratio's steps. */
const RATIO_STEP = 0.25;
/** The city's picture's scales of the screen, below one pixel to the page's. */
const SCALES = [0.85, 0.72, 0.6];
/** After a step, how long before frames count again (the step's own hitch passes), seconds. */
const SETTLE_AFTER_STEP = 0.5;
/** How long after a step down its frames are judged against those before it (s), and how much faster they must be. */
const JUDGE_FOR = 2;
const HELPED = 0.93;
/** The frames before a step down that it's judged against (s). */
const BEFORE = 1.5;
/** However slow the frames, a step is judged on at least this many either side of it (a tenth of the slowest and of the
 * fastest left out, so one hitch doesn't decide it). */
const FEWEST = 10;
/** How long frames must run easily before a rung up is tried (s): doubled for each time that rung has been taken back. */
const EASY_STRETCH = 8;
/** How many times a rung up is tried before it's left alone. */
const TRIES = 3;
/** After a step up, how long it's on trial (s): the slowness coming back within it takes the step back. */
const TRIAL_FOR = 5;
/** After a step down that didn't help, how long the ladder is left alone (s): doubled each time. */
const HOLD = 20;

// =============================================================================
// Main Code
// =============================================================================

/**
 * The ladder's rungs, from the top.
 * @param {{ ratio: number, samples: number, ceiling?: number }} top - the screen's own pixel ratio (as capped), the
 *   most samples, and the cap the top rungs keep (so a window taken to a finer screen draws finer: a rung's ratio is a
 *   cap on the screen's own, stage.js fitRenderer)
 * @param {{ drop?: boolean, shrink?: boolean }} [what] - whether the samples may go, and the city's picture shrink
 *   (the old safety net: neither)
 * @returns {{ ratio: number, samples: number, scale: number }[]}
 */
export function ladder({ ratio, samples, ceiling = ratio }, { drop = true, shrink = true } = {}) {
    const rungs = [{ ratio: ceiling, samples, scale: 1 }];
    const kept = drop ? 0 : samples;
    if (drop && samples > 0) rungs.push({ ratio: ceiling, samples: 0, scale: 1 });
    let last = ratio;
    for (let next = ratio - RATIO_STEP; ; next -= RATIO_STEP) {
        const stepped = Math.max(1, next);
        if (stepped >= last) break;
        rungs.push({ ratio: stepped, samples: kept, scale: 1 });
        last = stepped;
    }
    const floor = rungs[rungs.length - 1].ratio;
    if (shrink) for (const scale of SCALES) rungs.push({ ratio: floor, samples: kept, scale });
    return rungs;
}

/**
 * @param {object} options
 * @param {{ ratio: number, samples: number, scale: number }[]} options.rungs - from ladder
 * @param {(rung: { ratio: number, samples: number, scale: number }, index: number) => void} options.apply - put a rung
 *   in use
 * @param {number} options.slowStretch - how long frames must run slow before a step down (s)
 * @param {number} options.settling - how long after the start before frames count (s)
 * @param {boolean} [options.climbs] - whether it ever steps back up (and takes back a step down that didn't help); the
 *   old safety net doesn't, and waits the whole settling again after each step
 */
export function createGovernor({ rungs, apply, slowStretch, settling, climbs = true }) {
    let at = 0;
    // (Seconds of frames seen, each counted for at most a second.)
    let clock = 0;
    let quietUntil = settling;
    let slowFor = 0;
    let easyFor = 0;
    /** How often a step up to each rung has been taken back. */
    const failed = rungs.map(() => 0);
    let holds = 0;
    let holdUntil = 0;
    /** A step down being judged: the rung it came from, the frames' mean before it, and those since. */
    let judging = null;
    /** A step up on trial: the rung it came from and the one it went to, until when. */
    let trying = null;
    let held = false;
    // (The last frames' lengths, newest last, for the mean before a step.)
    const recent = new Float32Array(256);
    let recentAt = 0;
    let recentCount = 0;

    /** The mean of frames' lengths, the slowest tenth and the fastest left out. */
    function trimmed(lengths) {
        if (!lengths.length) return 0;
        const sorted = [...lengths].sort((a, b) => a - b);
        const cut = Math.floor(sorted.length / 10);
        const kept = sorted.slice(cut, sorted.length - cut);
        return kept.reduce((sum, value) => sum + value, 0) / kept.length;
    }

    /** The last frames, over at least `seconds` and at least FEWEST of them (as many as there are). */
    function lastFrames(seconds) {
        const lengths = [];
        let sum = 0;
        for (let back = 1; back <= recentCount && (sum < seconds || lengths.length < FEWEST); back += 1) {
            const length = recent[(recentAt - back + recent.length) % recent.length];
            lengths.push(length);
            sum += length;
        }
        return lengths;
    }

    function step(to) {
        at = to;
        apply(rungs[at], at);
        slowFor = 0;
        easyFor = 0;
        recentCount = 0;
        quietUntil = clock + (climbs ? SETTLE_AFTER_STEP : settling);
    }

    return {
        /** The rung in use, and the ladder. */
        get rung() { return at; },
        rungs,
        /** What it's drawing with, in a few words, given the pixel ratio in use (for ?debug=1's readout). */
        describe(ratio) {
            const rung = rungs[at];
            return `rung ${at}: ${ratio}x${rung.samples ? `, ${rung.samples} samples` : ''}${rung.scale < 1 ? `, city at ${rung.scale}` : ''}`;
        },
        /** Put a rung in use now, and keep it (?debug=1&rung=N, for the checks and the stills). */
        hold(index) {
            held = true;
            judging = null;
            trying = null;
            step(Math.max(0, Math.min(rungs.length - 1, index)));
        },
        /** Every frame: how long it took (real seconds). */
        frame(real) {
            if (held || !(real > 0) || real >= 1) return;
            clock += real;
            if (clock < quietUntil) return;
            recent[recentAt] = real;
            recentAt = (recentAt + 1) % recent.length;
            recentCount = Math.min(recentCount + 1, recent.length);

            // A step down, judged: if it didn't make the frames faster, it's taken back, and the ladder left alone a while.
            // (Frames come in whole refreshes of the screen, so a step can lighten the work without the frames showing it
            // yet: one more step is taken, judged against the same frames before the first, before both are taken back.)
            if (judging) {
                judging.lengths.push(real);
                if (clock >= judging.until && judging.lengths.length >= FEWEST) {
                    const { back, before, further } = judging;
                    const helped = !(before > 0) || trimmed(judging.lengths) < before * HELPED;
                    judging = null;
                    if (!helped && !further && at < rungs.length - 1) {
                        step(at + 1);
                        judging = { back, before, further: true, until: quietUntil + JUDGE_FOR, lengths: [] };
                        return;
                    }
                    if (!helped) {
                        holdUntil = clock + HOLD * 2 ** holds;
                        holds += 1;
                        step(back);
                        return;
                    }
                }
            }
            if (trying && clock >= trying.until) trying = null;

            slowFor = real > SLOW_FRAME ? slowFor + real : Math.max(0, slowFor - real * 2);
            easyFor = real < EASY_FRAME ? easyFor + real : real > SLOW_FRAME ? 0 : easyFor;

            if (slowFor > slowStretch) {
                slowFor = 0;
                // (A step up that brought the slowness back: down again, and that rung waits twice as long.)
                if (trying) {
                    failed[trying.to] += 1;
                    const back = trying.from;
                    trying = null;
                    step(back);
                    return;
                }
                if (judging || at >= rungs.length - 1 || clock < holdUntil) return;
                const before = trimmed(lastFrames(BEFORE));
                const from = at;
                step(at + 1);
                if (climbs) judging = { back: from, before, until: quietUntil + JUDGE_FOR, lengths: [] };
                return;
            }
            if (!climbs || at === 0 || judging || trying || failed[at - 1] >= TRIES) return;
            if (easyFor > EASY_STRETCH * 2 ** failed[at - 1]) {
                const from = at;
                step(at - 1);
                trying = { from, to: at, until: quietUntil + TRIAL_FOR };
            }
        },
    };
}
