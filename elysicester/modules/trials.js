/**
 * trials.js — the playtester's ideas, on trial in the live city (Elm: "Let's launch each trial on the live
 * site too"). Each is on unless the address turns it off: ?<name>=off for one, ?trials=off for all of them.
 *
 * - jetty: the passage from p. 76 waits at the end of the jetty, where the shadow does
 * - whisper: after a long stillness, one of E's lines surfaces low over the water (whisper.js)
 * - names: faint names for the places while the camera is far out, or, below the island, the underside's
 *   (names.js)
 * - hint: the places still unread stand out among those names, and once only a few passages are left, the
 *   reader's count says where they are and their points glint more often
 * - wraith: the shadow as a friendly banshee, floating, its skirt streaming and its sleeves spreading as it glides
 *   (banshee.js; Elm's ask)
 * - dust: everything the camera passes through comes apart into gold dust, as the golden bridges do, so the walking
 *   camera stays low instead of climbing over what's in the way (dust.js; Elm's ask)
 * - dock: the visit begins as the shadow, already walking, at the end of the jetty, the camera behind it (Elm's ask;
 *   main.js, walk.js); off, it begins with the whole city in view, as before
 * - hostel: The Door in the Floor, the hostel from Episode 4, on its promontory of sand and dunes south of the
 *   sun-dock, with its lane of gold cobbles, its white door and its two passages (Elm's first pick of the places;
 *   places.js buildHostel, silhouette.js)
 */

// =============================================================================
// Constants
// =============================================================================

export const TRIALS = Object.freeze(['jetty', 'whisper', 'names', 'hint', 'wraith', 'dust', 'dock', 'hostel']);

// =============================================================================
// Main Code
// =============================================================================

/**
 * Whether a trial is on for this visit.
 * @param {string} name - one of TRIALS
 * @param {string} [search] - the address's query (the page's own, unless given)
 */
export function trialOn(name, search = globalThis.location?.search ?? '') {
    const params = new URLSearchParams(search);
    if (params.get('trials') === 'off') return false;
    return params.get(name) !== 'off';
}
