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
 * - hum: you fly as one of the bronze hums, low and in the middle of the view, over the benches, kerbs and edges
 *   that caught the walker, the wraith's shadow going beneath it as if it were its own (Elm's idea; hum.js, walk.js)
 * - choice: before anything else, a screen of two sides, "Explore" and "Read" (Elm's asks, so the way in
 *   is less overwhelming, and nothing comes before it): the first brings the Mega-Screen's card, then the Intermaze
 *   and the way into the city; the second goes to the texts, President Oedipus and Numbers by Paint on one page
 *   (read.html; main.js, threshold.js)
 * - onebutton: one option at the top of the screen, "zoom out", "zoom out", "leave" (Elm's asks): back to the far
 *   follow, out to the whole city, then back to the choice ("Explore" comes back to the city where it was);
 *   beside it, flying as a hum, the hum's own symbol recentres the camera on it; the other controls stand aside
 *   (main.js)
 * - jettysigns: signs along the jetty, "Click the hum to let go. Click again to keep going." ("Tap" on a touch screen;
 *   the word "hum" a tiny hummingbird) and, on a touch screen only, "Pinch to control the camera", with arrows pointing
 *   in and out (Elm's words; guides.js)
 * - cyclolite: the hum begins on a Cyclolite, a little golden disc-boat floating off the end of the jetty, its roof
 *   of hard yellow light open and spread wide so the bird and its shadow show in full (Elm's idea, after Numbers by
 *   Paint p. 94; places.js buildCyclolite)
 * - creatures: the passages of Numbers by Paint are given by pugs (human faces, the bodies of tiny bulls; they say
 *   "squur") and hums (they say "chirp"), each with a shade of its own beneath it; a pug stands in front of a board
 *   that paints itself in when it gives; what's given is gathered, and all of it gathered is the win, written out by
 *   hand to take away (Elm's asks; creatures.js, inventory.js); off, the passages are points of light, as before
 * - allison: Allison the Sirenian, by the sea-wall's old plaque, trying to read it ("It's all Latin"); a tap on him
 *   gives Elm's bio (Elm's ask; allison.js)
 * - inside: where the dust opens something, its inside shows pure black, not empty (a friend's idea, through Elm;
 *   dust.js)
 * - megascreen: the Mega-Screen's card as a still shot, like the city: an endless red desert, and the screen, as tall as
 *   a station's tower, wheeling into the shot as INSERT BLUTIX rolls over it (Elm's ask; megascreen.js); off, the card
 *   is the flat one it was
 * - cassandra: Cassandra's house, at the plaza's west end where the bridges meet: the wrought-gold fence, the yard of
 *   rocks the shape of ferns, the knock, her shadow's answer, the slam, and the pale faces at the street's windows (Elm's
 *   next place; places.js, cassandra.js)
 * - ball: the charity ball, a hall out beyond the north rim over the ocean: the old Greek's aphorisms at the podium,
 *   the applause, Cassandra's thanks, the band; the hidden door with its bar of gold, the corridor of lockers, and the
 *   balcony where she sits with her cognac (Elm's next place; places.js, ball.js)
 * - plants: President Oedipus's flowers, a part of the essay to each, read whole from its own page: only the one in
 *   bloom opens, the rest wait as buds (one touched shivers, and the bloom glints); opened, a flower wilts and the next
 *   unfurls (Elm: "flowers ... that wilt when you open them ... you gotta click them in order"; flowers.js)
 * - sections: givers for the sections of Numbers by Paint that had none, so the lost pages reach every one of them
 *   (Elm: "things that bridge to every section of those texts"): the Introduction, The Surface of Myth, Episode 2 and
 *   Fictoanalysis, each a draft passage awaiting her yes (data/fragments.json, "trial": "sections")
 * - whole: a lost page of Numbers by Paint read from the inventory is read whole, its stretch of the thesis (Elm: the
 *   lost pages "contain the full text of the thesis"), from the texts (read.html; main.js)
 * - settle: the way in is waited through (Elm: "let's try making it compulsory to wait for the mega screen to settle
 *   and then for the swirling to resolve"): the card's "Tap blutix here." comes only once the Mega-Screen has rolled in
 *   and stood, and the swirl can't be cut short, playing through E's lines until the city is ready (threshold.js,
 *   megascreen.js); off, the card can be tapped at once and a tap or Esc skips the swirl, as before
 * - nimble: on a touch screen (a phone, a tablet), drawn lighter (Elm: "Whatever we intend the visitor to experience must
 *   pass through the small machine in their hands"): no more than one and a half pixels to each of the page's, as
 *   messenger.abeto.co draws, no multisampled render (the ink's lines draw the edges), and, where frames still run slow,
 *   stepping down sooner (ink.js, stage.js); off, drawn as on a computer
 */

// =============================================================================
// Constants
// =============================================================================

export const TRIALS = Object.freeze(['jetty', 'whisper', 'names', 'hint', 'wraith', 'dust', 'dock', 'hostel', 'hum', 'choice', 'onebutton', 'jettysigns', 'cyclolite', 'creatures', 'allison', 'inside', 'megascreen', 'cassandra', 'ball', 'plants', 'sections', 'whole', 'settle', 'nimble']);

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
