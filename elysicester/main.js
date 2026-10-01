/**
 * Elysicester — boot: capability check → threshold → stage.
 *
 * Tier 1 of the Elysicester diorama: a floating piece of the golden city from
 * Numbers by Paint, orbited at Elysium's endless dusk, with reading points
 * where each passage belongs.
 *
 * The Mega-Screen's card shows at once. Behind it, straight away, the city is
 * built (with WebGL 2) or the still is readied (without). The first tap or
 * keypress begins: sound starts if the visitor has chosen it, then the
 * Intermaze flies until the city is ready and a minimum passage has played
 * (under reduced motion, the card crossfades instead), and the city lifts out
 * of a dark veil. Coming back within the same visit (Back, a reload) skips
 * the card and the flight: the city lifts from the dark as soon as it's ready.
 * On trial (dock, trials.js), the visitor arrives as the shadow, walking, at
 * the end of the jetty; "the whole city" (or ?dock=off) is the view from far.
 * If anything fails, the city arrives as a still and its points as a list;
 * the reader works either way, and each passage leads on to the nearest place
 * not yet read. The optional extras (extras.js) appear only when the address
 * asks for them.
 */

// =============================================================================
// Imports
// =============================================================================

import { ALLISON_SAYS, bioFrom, createAllison } from './modules/allison.js';
import { createAudio } from './modules/audio.js';
import { createCreatures } from './modules/creatures.js';
import { speak, wantedExtras } from './modules/extras.js';
import { createHotspots, createPointList } from './modules/hotspots.js';
import { createInventory } from './modules/inventory.js';
import { showMegaScreen } from './modules/megascreen.js';
import { createNames } from './modules/names.js';
import { WORKS, createReader } from './modules/reader.js';
import { createSignList, createSignOverlay } from './modules/signs.js';
import { createRenderer, createStage, fitRenderer } from './modules/stage.js';
import { crossedThisVisit, markRead, readFragments, rememberCrossed, rememberSound, soundWanted } from './modules/state.js';
import { createThreshold } from './modules/threshold.js';
import { createTouch } from './modules/touch.js';
import { trialOn } from './modules/trials.js';
import { createWhisper } from './modules/whisper.js';

// =============================================================================
// Constants
// =============================================================================

const PROMPT_FRAGMENT = 'nbp-e1-mega-screen-1';
/** E's lines in the Intermaze (Elm, 1 Oct, cut "They?" and the rail, so they end on "You never remember the dreams."). */
const VOICE_FRAGMENTS = ['nbp-e3-intermaze-1'];
/**
 * Where "Stay - Read" and the one option's "back" go: the texts, whole, with the lost pages marked (Elm: "back can take
 * you to the text interface"; "you go directly there when you click zoom out and zoom out and back").
 */
const TEXT_PAGE = 'read.html';

/** Walking as the shadow, a reading point within this of its head names its place. */
const NEAR_POINT = 3.2;

/** A touched thing answers (its ring, its sound), and this long after, its words open (ms). */
const TOUCH_PAUSE = 450;

/** Allison's bio (a trial: allison.js), as a passage the city holds: read from the site's own bio page. */
const BIO_ID = 'allison-bio';
const BIO_PAGE = '../bio.html';

/** The hint (a trial, trials.js): once no more than this many passages are left unread, the count says where. */
const HINT_FEW = 3;
/** And their points glint this often (seconds; else hotspots.js's own pace). */
const HINT_GLINT = 3.5;

// =============================================================================
// Main Code
// =============================================================================

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const debug = params.has('debug');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The optional extras (extras.js): none, unless the address asks, as ?extras=sky,shadow,door,voice. */
const extras = wantedExtras();
const byId = (id) => document.getElementById(id);
if (debug) window.elysicesterDebug = {};

/** three.js r163 and later draw with WebGL 2 only. */
function hasWebGL2() {
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

async function loadData(name) {
    const response = await fetch(new URL(`./data/${name}.json`, import.meta.url));
    if (!response.ok) throw new Error(`data/${name}.json answered ${response.status}`);
    return response.json();
}

/** Hold the city still: the drawn plate instead of the live scene, the points as a list. */
function showStill() {
    root.dataset.mode = 'still';
    const fallback = byId('fallback');
    fallback.querySelector('.fallback-note').append(byId('points'));
    fallback.hidden = false;
    // With no camera to turn, a sign in the list is simply its words.
    for (const button of byId('signs-list').querySelectorAll('button')) {
        const words = document.createElement('span');
        words.className = button.className;
        words.dataset.sign = button.dataset.sign;
        words.append(...button.childNodes);
        button.replaceWith(words);
    }
}

/** The sound switch: off unless chosen; the choice is remembered. It says what the sound is now ("sound: off"). */
function wireSound(audio) {
    const toggle = byId('sound-toggle');
    const show = (on) => {
        toggle.setAttribute('aria-pressed', String(on));
        toggle.textContent = on ? 'sound: on' : 'sound: off';
    };
    show(soundWanted());
    toggle.addEventListener('click', () => {
        const on = !soundWanted();
        rememberSound(on);
        show(on);
        if (on) audio.start();
        else audio.stop();
    });
}

/** Fill the Mega-Screen's prompt from its fragment, keeping its italics (else it stays "enter"). */
function fillPrompt(fragment) {
    const prompt = byId('threshold-prompt');
    prompt.classList.add('is-ready');
    if (!fragment) return;
    prompt.replaceChildren();
    let rest = fragment.text;
    for (const run of fragment.italic ?? []) {
        const at = rest.indexOf(run);
        if (at < 0) continue;
        prompt.append(rest.slice(0, at));
        const emphasis = document.createElement('em');
        emphasis.textContent = run;
        prompt.append(emphasis);
        rest = rest.slice(at + run.length);
    }
    prompt.append(rest);
}

/**
 * The choice, first (a trial, trials.js; Elm: "a screen that offers 'Explore - Win' on one side and 'Stay - Read' on
 * the other", and "the choice ... should come before the ascii swirl"). It's already on the screen (the page's first
 * paint shows it: index.html, style.css); this takes it over. "Stay - Read" is a link, to the texts (read.html);
 * "Explore - Win" brings the Mega-Screen's card up beneath it as it fades (Elm: "the mega screen could show up after
 * the choice page and before the ascii swirl"), and the card's gesture begins the swirl, as it always did.
 */
function offerChoice(threshold, onCard) {
    const choice = byId('choice');
    const explore = byId('choice-explore');
    choice.hidden = false;
    choice.classList.add('is-shown');
    delete root.dataset.choosing;
    explore.focus({ preventScroll: true });
    explore.addEventListener('click', () => {
        // (Fading, it's out of reach: a second tap meets the card beneath it, not "Stay - Read".)
        choice.classList.remove('is-shown');
        choice.classList.add('is-leaving');
        choice.inert = true;
        window.setTimeout(() => {
            choice.hidden = true;
        }, reducedMotion ? 0 : 900);
        threshold.showCard();
        onCard?.();
    }, { once: true });
}

/**
 * One option at the top of the screen (a trial, trials.js; Elm: "there can just be one option at the top of the
 * screen: zoom out, zoom out, back. And back can take you to the text interface anyway"). Flying close, it draws the
 * camera back as far as it follows; flying drawn back, it lets the hum hover where it is and goes out to the whole
 * city (looking about, it goes there too); at the whole city, "back" goes to the city's text. Taking the hum again
 * (a tap on it) brings the camera back in close, and the round begins again.
 */
function wireOneButton(stage) {
    const one = byId('one-button');
    one.hidden = false;
    const step = () => {
        const walk = stage.walk;
        if (walk?.state.walking) return walk.followDistance < walk.followFar - 0.05 ? 'closer' : 'far';
        return stage.rig.atHome ? 'home' : 'away';
    };
    stage.onFrame(() => {
        const words = step() === 'home' ? 'back' : 'zoom out';
        if (one.textContent !== words) one.textContent = words;
    });
    one.addEventListener('click', () => {
        const now = step();
        if (now === 'closer') {
            stage.walk.zoomTo(stage.walk.followFar);
        } else if (now === 'far') {
            stage.walk.letGo();
            stage.rig.toHome();
        } else if (now === 'away') {
            stage.rig.toHome();
        } else {
            window.location.href = TEXT_PAGE;
        }
    });
    return one;
}

/** Let the city lift out of the dark after the flight, whichever city it is. */
function liftVeil(arrive) {
    const veil = byId('veil');
    veil.classList.add('is-dark');
    arrive();
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-dark')));
}

async function boot() {
    const audio = createAudio();
    // With one option at the top of the screen (a trial), the rest stands aside (style.css), and the sound switch
    // keeps a quiet corner of its own.
    const oneButton = trialOn('onebutton');
    if (oneButton) {
        root.dataset.onebutton = '';
        const toggle = byId('sound-toggle');
        toggle.classList.add('sound-corner');
        document.body.append(toggle);
    }
    wireSound(audio);
    if (debug) window.elysicesterDebug.audio = audio;
    // The choice first (a trial): not when coming back within the visit (straight into the city), and an address that
    // came to read a passage (#read-…) goes straight to it, as one coming back does.
    const reading = window.location.hash.startsWith('#read-');
    const returning = crossedThisVisit() || (trialOn('choice') && reading);
    const choosing = trialOn('choice') && !returning;
    const threshold = createThreshold({
        root,
        card: byId('threshold'),
        begin: byId('threshold-begin'),
        voice: byId('threshold-voice'),
        onBegin: () => {
            if (debug) window.elysicesterDebug.begunAt = performance.now();
            if (soundWanted()) audio.start();
        },
        returning,
        choosing,
    });
    // The Mega-Screen as a still shot in the Desert Eternal (a trial: megascreen.js), drawn on the city's canvas while
    // the card is up, once there's a renderer to draw it with (the card itself, flat, until its first frame is in).
    let sceneRenderer = null;
    let sceneStarted = false;
    const startMegaScreen = () => {
        if (sceneStarted || !sceneRenderer || !trialOn('megascreen') || root.dataset.threshold !== 'card') return;
        sceneStarted = true;
        const card = byId('threshold');
        showMegaScreen({
            renderer: sceneRenderer,
            fit: () => fitRenderer(sceneRenderer, byId('stage')),
            reducedMotion,
            showing: () => root.dataset.threshold === 'card',
            onShown: () => card.classList.add('is-scene'),
        }).catch((error) => {
            card.classList.remove('is-scene');
            console.error('The Mega-Screen could not be drawn:', error);
        });
    };
    if (choosing) offerChoice(threshold, startMegaScreen);
    // Until the city is entered, its reading points wait behind the card.
    const pointsNav = byId('points');
    pointsNav.inert = true;
    if (returning) {
        // Back within the same visit: no card, only the dark the city will lift out of (held by the veil
        // now, rather than by the page's first paint). Sound, if chosen, starts at the visitor's first touch
        // (browsers ask for one).
        byId('veil').classList.add('is-dark');
        delete root.dataset.returning;
        if (soundWanted()) {
            const wake = () => {
                window.removeEventListener('pointerdown', wake, true);
                window.removeEventListener('keydown', wake, true);
                if (soundWanted()) audio.start();
            };
            window.addEventListener('pointerdown', wake, true);
            window.addEventListener('keydown', wake, true);
        }
    }

    // The givers and Allison (trials: creatures.js, allison.js) stand where data/creatures.json puts them; Allison's
    // bio is read from the site's own bio page (if it can't be, he isn't there).
    const giving = trialOn('creatures');
    const allisonOn = trialOn('allison');
    const [placeData, fragmentData, paper, signData, creatureData, bioPage, lostData] = await Promise.all([
        loadData('places'), loadData('fragments'), loadData('paper'), loadData('signs'),
        giving || allisonOn ? loadData('creatures').catch(() => null) : null,
        allisonOn ? fetch(new URL(BIO_PAGE, window.location.href)).then((response) => (response.ok ? response.text() : null)).catch(() => null) : null,
        giving ? loadData('lost-pages').catch(() => null) : null,
    ]);
    const places = new Map(placeData.places.map((place) => [place.id, place]));
    const fragmentById = new Map(fragmentData.fragments.map((fragment) => [fragment.id, fragment]));
    // (A passage on trial, trials.js, is read only while its trial is on.)
    const readable = fragmentData.fragments.filter((fragment) => places.get(fragment.place)?.tier === 1
        && (!fragment.trial || trialOn(fragment.trial)));
    const bio = bioPage ? bioFrom(bioPage) : null;
    const allisonAt = allisonOn && bio ? creatureData?.allison ?? null : null;
    if (allisonAt) {
        // His bio, held by the city as a passage is (its list entry, its point at him, the reader), in Elm's words.
        readable.push({
            id: BIO_ID,
            place: allisonAt.place,
            work: 'bio',
            heading: 'Bio',
            source: 'Edith Mina Lyre, from her bio page',
            listLabel: `Allison, by the old plaque at ${places.get(allisonAt.place)?.label.replace(/^The /, 'the ') ?? 'the sea-wall'}: the bio`,
            text: bio.text,
            italic: bio.italic,
            links: bio.links,
            read_on: new URL(BIO_PAGE, window.location.href).href,
            status: 'approved',
        });
    }
    // The passages of Numbers by Paint the givers hold (each found as it's given: inventory.js).
    const givers = giving && creatureData ? creatureData.creatures.filter((creature) => readable.some((fragment) => fragment.id === creature.fragment)) : [];
    const giverOf = new Map(givers.map((creature) => [creature.fragment, creature]));
    // The lost pages: those, and President Oedipus's at its points of light, numbered as the texts number them
    // (read.html; data/lost-pages.json, written with it), else in the book's order.
    const isLost = (fragment) => giverOf.has(fragment.id) || (fragment.work === 'po' && givers.length > 0);
    const pageOf = (fragment) => Number(/p\. (\d+)/.exec(fragment.source)?.[1] ?? 0);
    const lostPages = (lostData?.lost
        ? lostData.lost.map((id) => readable.find((fragment) => fragment.id === id))
        : [...readable].sort((a, b) => (a.work === 'po' ? 0 : 1) - (b.work === 'po' ? 0 : 1) || pageOf(a) - pageOf(b)))
        .filter((fragment) => fragment && isLost(fragment));
    const lines = VOICE_FRAGMENTS.map((id) => fragmentById.get(id)).filter(Boolean).flatMap((fragment, index) => (
        index === 0 ? fragment.text.split(/\n{2,}/) : [fragment.text]
    ));
    // E's own lines, of those (the first passage's), are the ones a long stillness whispers again (whisper.js).
    const whispered = fragmentById.get(VOICE_FRAGMENTS[0])?.text.split(/\n{2,}/) ?? [];
    fillPrompt(fragmentById.get(PROMPT_FRAGMENT));

    const read = readFragments();
    const hinting = trialOn('hint');
    const unreadCount = () => readable.filter((fragment) => !read.has(fragment.id)).length;
    let stage = null;
    let hotspots = null;
    let signOverlay = null;

    // The thread on from a passage: the nearest place none of whose passages has been read yet; failing
    // that, the nearest unread passage at another place, then here; once every one has been read, simply the
    // nearest other place. It never ends, and nothing leads off first (Elm: nothing definite yet, no opening
    // or closing).
    const whereIs = (fragment) => {
        const point = hotspots?.positionOf(fragment.id);
        return point ? [point.x, point.y, point.z] : places.get(fragment.place).position;
    };
    const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const onward = (fragment) => {
        const from = whereIs(fragment);
        const others = readable.filter((candidate) => candidate.id !== fragment.id);
        const unread = others.filter((candidate) => !read.has(candidate.id));
        const visited = new Set(readable.filter((candidate) => read.has(candidate.id)).map((candidate) => candidate.place));
        const pools = [
            unread.filter((candidate) => !visited.has(candidate.place)),
            unread.filter((candidate) => candidate.place !== fragment.place),
            unread,
            others.filter((candidate) => candidate.place !== fragment.place),
        ];
        const pool = pools.find((candidates) => candidates.length) ?? [];
        let next = null;
        for (const candidate of pool) {
            if (!next || apart(from, whereIs(candidate)) < apart(from, whereIs(next))) next = candidate;
        }
        // (A place read at before is gone "back to", so a thread that comes round again says so.)
        const returning = Boolean(next) && next.place !== fragment.place && visited.has(next.place);
        // (The hint, on trial: the last few left unread, and where they are. With the givers, a trial, what's counted
        // is what's been gathered, as the corner counts it: inventory.js.)
        const counted = inventory ? inventory.pieces : readable;
        const left = counted.filter((candidate) => !read.has(candidate.id));
        const lastAt = hinting && left.length > 0 && left.length <= HINT_FEW ? [...new Set(left.map((candidate) => candidate.place))] : null;
        return { next, returning, read: counted.length - left.length, total: counted.length, lastAt, word: inventory ? 'lost pages found' : 'read' };
    };
    let open = null;
    let inventory = null;
    let creatures = null;
    let allison = null;
    /** The stage's own clock (seconds), for the givers' moments. */
    let stageTime = 0;
    /** The last piece has just been gathered: the win shows once its passage is closed. */
    let winWaiting = false;
    const reader = createReader({
        dialog: byId('reader'),
        places,
        // (Walking, the camera is the shadow's: it doesn't drift off when a passage closes.)
        onClose: () => {
            if (!stage?.walk?.state.walking) stage?.rig.setDrifting(true);
            if (winWaiting) {
                winWaiting = false;
                window.setTimeout(() => inventory?.open(), 350);
            }
        },
        onward,
        onOnward: (next) => open(next, undefined),
        // "walk from here": the shadow set down at the passage's place (the nearest floor to its point), and taken.
        canWalk: () => Boolean(stage?.walk),
        onWalkFrom: (fragment) => {
            const point = hotspots?.positionOf(fragment.id);
            const [x, , z] = point ? [point.x, point.y, point.z] : places.get(fragment.place).position;
            stage?.walk?.walkFrom(x, z);
        },
    });
    // (Flying as a hum, a trial: it flies from there.)
    if (trialOn('hum')) document.querySelector('[data-reader-walk]')?.replaceChildren('fly from here');
    createSignList({
        list: byId('signs-list'),
        signs: signData.signs,
        places,
        onFocusSign: (sign) => {
            if (sign) {
                hotspots?.light(null);
                stage?.walk?.letGo();
            }
            signOverlay?.focusSign(sign);
        },
    });

    const focusFragment = (fragment) => {
        if (!stage) return;
        stage.rig.focus(fragment.place, hotspots?.positionOf(fragment.id), fragment.facing ?? null);
    };
    let list = null;
    open = (fragment, opener) => {
        read.add(fragment.id);
        markRead(fragment.id);
        list.markRead(fragment.id);
        hotspots?.markRead(fragment.id);
        signOverlay?.hide();
        // Its giver gives it (a pug's board paints itself in; a hum loops), and it's gathered: if it was the last,
        // the win waits for the passage to be closed.
        creatures?.give(fragment.id, stageTime);
        if (inventory?.gathered(fragment.id)) winWaiting = true;
        if (stage) {
            stage.rig.setDrifting(false);
            focusFragment(fragment);
        }
        reader.open(fragment, opener);
    };
    list = createPointList({
        nav: byId('points'),
        fragments: readable,
        places,
        read,
        onOpen: open,
        onFocusPoint: (fragment) => {
            hotspots?.light(fragment);
            if (!fragment) return;
            // (Looking about by the list, the camera is the list's: the shadow is let go, and stays where it stands.)
            stage?.walk?.letGo();
            focusFragment(fragment);
        },
    });

    // What's been gathered, and the win (with the givers: inventory.js). Its count shows once there's something in it;
    // the list gathers as the givers do (a passage read is a passage given), so keys and the still can win too.
    if (givers.length) {
        inventory = createInventory({
            toggle: byId('inventory-toggle'),
            dialog: byId('inventory'),
            pieces: lostPages,
            gathered: read,
            places,
            kindOf: (id) => giverOf.get(id)?.kind ?? 'light',
            texts: TEXT_PAGE,
            onRead: (fragment, opener) => open(fragment, opener),
            loadEngine: () => loadData('handwrite'),
            // (Numbered as the texts number them, every lost page counted, trials on or off.)
            numberOf: (id) => {
                const at = lostData?.lost?.indexOf(id) ?? -1;
                return at >= 0 ? at + 1 : null;
            },
        });
        if (debug) window.elysicesterDebug.inventory = inventory;
    }

    // Build the city now, behind the card, while the visitor reads the Mega-Screen.
    const canvas = byId('stage');
    let renderer = null;
    let building;
    if (hasWebGL2()) {
        renderer = createRenderer(canvas);
        // (If the card is up already, the Mega-Screen can be drawn now.)
        sceneRenderer = renderer;
        startMegaScreen();
        building = createStage({ renderer, canvas, data: { places: placeData, paper, signs: signData }, reducedMotion, debug, onLost: showStill, extras })
            .then(async (built) => {
                stage = built;
                // The givers (pugs and hums, each with its shade) and Allison, built into the city before it's seen.
                if (givers.length) {
                    creatures = createCreatures({
                        creatures: givers,
                        given: read,
                        gradientMap: stage.gradientMap,
                        light: stage.shadowLight,
                        floorAt: stage.walk ? (x, z, near) => stage.walk.floorNear(x, z, near) : null,
                        reducedMotion,
                    });
                }
                if (allisonAt) {
                    allison = createAllison({ at: allisonAt.at, facing: allisonAt.facing, gradientMap: stage.gradientMap, reducedMotion });
                    // (A body doesn't fly through him.)
                    stage.walk?.standsIn(allisonAt.at[0], allisonAt.at[2], 0.32);
                }
                const more = {
                    objects: [...(creatures?.objects ?? []), ...(allison ? [allison.object] : [])],
                    materials: [...(creatures?.materials ?? []), ...(allison ? [allison.material] : [])],
                    textures: creatures?.textures ?? [],
                };
                if (more.objects.length) await stage.adopt(more);
                stage.onFrame((dt, elapsed) => {
                    stageTime = elapsed;
                    // They turn to the one who's come, flying near.
                    const visitor = stage.walk?.state.walking ? stage.walk.humAt ?? stage.walk.state.position : null;
                    creatures?.notice(visitor);
                    allison?.notice(visitor);
                    creatures?.update(elapsed);
                    allison?.update(elapsed);
                });
                if (debug) Object.assign(window.elysicesterDebug, { creatures, allison });
                let touch = null;
                hotspots = createHotspots({
                    stage,
                    fragments: readable,
                    read,
                    places,
                    label: byId('point-label'),
                    reducedMotion,
                    // (The hint, on trial: the last few unread glint more often.)
                    glintEvery: () => (hinting && unreadCount() <= HINT_FEW ? HINT_GLINT : null),
                    onPick: (fragment) => open(fragment, null),
                    // (The givers, and Allison: each passage's point is at its giver, who says its word.)
                    giverAt: (fragment) => (fragment.id === BIO_ID ? allison?.point : creatures?.pointOf(fragment.id)) ?? null,
                    giverBody: (fragment) => (fragment.id === BIO_ID ? allison?.body : creatures?.bodyOf(fragment.id)) ?? null,
                    speechOf: (fragment) => (fragment.id === BIO_ID ? ALLISON_SAYS : creatures?.speechOf(fragment.id) ?? null),
                    onLight: (fragment) => {
                        if (!fragment) return;
                        if (fragment.id === BIO_ID) {
                            allison?.greet(stageTime);
                            return;
                        }
                        const word = creatures?.speechOf(fragment.id);
                        if (word && creatures.greet(fragment.id, stageTime)) audio.answer(word);
                    },
                    // A tap on the shadow is the shadow's (walk.js); one squarely on a sign is the sign's.
                    yieldTap: (x, y, pointDistance) => (stage.walk?.claimsTap(x, y) ?? false)
                        || (signOverlay?.claimsTap(x, y, pointDistance) ?? false),
                    // A tap no point took may have found something else that answers (touch.js): a ring where
                    // it was touched, its own sound, then its words (with the givers, a trial, only they give the
                    // passages of Numbers by Paint: a touched thing answers, and gives nothing). Walking as the
                    // shadow, a tap nothing answers walks it there.
                    onMiss: (x, y) => {
                        if (!touch || stage.walk?.claimsTap(x, y) || signOverlay?.claimsTap(x, y, Infinity)) return;
                        const found = touch.find(x, y);
                        // (Cassandra's door, touched, is knocked on: places.js plays the rest.)
                        if (found?.kind === 'cassandra-door') {
                            if (!reducedMotion) hotspots.ripple(found.point);
                            stage.cassandra?.knock();
                            return;
                        }
                        const fragment = found ? readable.find((candidate) => candidate.id === found.fragment) : null;
                        if (!fragment) {
                            stage.walk?.walkToward(x, y);
                            return;
                        }
                        if (!reducedMotion) hotspots.ripple(found.point);
                        audio.answer(found.kind);
                        if (giverOf.has(fragment.id)) return;
                        window.setTimeout(() => open(fragment, null), TOUCH_PAUSE);
                    },
                });
                touch = createTouch({ stage, occluders: hotspots.occluders });
                // Cassandra's door (a trial: places.js): its knock and its slam, and her shadow's words where she
                // stands, while she says them.
                const doorWords = byId('door-words');
                const oneOption = byId('one-button');
                if (stage.cassandra && doorWords) {
                    let saidAt = null;
                    let seenAt = null;
                    stage.cassandra.onSound = (kind) => audio.answer(kind);
                    stage.cassandra.onSay = (words, point) => {
                        saidAt = words ? point : null;
                        seenAt = saidAt?.clone() ?? null;
                        doorWords.textContent = words ?? '';
                        doorWords.hidden = !words;
                    };
                    stage.onFrame(() => {
                        if (!saidAt) return;
                        seenAt.copy(saidAt).project(stage.camera);
                        const rect = stage.canvas.getBoundingClientRect();
                        // (Over her, and kept on the screen, however near the camera has come, and below the one
                        // option at the top: it's drawn above its point, so its point stays at least its own height
                        // and a margin below them.)
                        const half = doorWords.offsetWidth / 2 + 8;
                        const above = oneOption && !oneOption.hidden ? oneOption.getBoundingClientRect().bottom + 6 : 0;
                        const x = Math.min(Math.max(half, window.innerWidth - half), Math.max(half, rect.left + ((seenAt.x + 1) / 2) * rect.width));
                        const y = Math.min(window.innerHeight - 8, Math.max(above + doorWords.offsetHeight + 26, rect.top + ((1 - seenAt.y) / 2) * rect.height));
                        doorWords.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
                        doorWords.hidden = seenAt.z >= 1;
                    });
                }
                // The shadow hears a tap first; a reading point nearer the tap than the shadow keeps it, and so
                // does a sign the tap lands squarely on.
                stage.walk?.yieldsTo((x, y, pointerType) => (signOverlay?.claimsTap(x, y, Infinity)
                    ? 0
                    : hotspots.nearestDistance(x, y, pointerType)));
                signOverlay = createSignOverlay({
                    stage,
                    label: byId('sign-label'),
                    isBusy: () => !byId('point-label').hidden || byId('reader').open,
                });
                if (debug) window.elysicesterDebug.readyAt = performance.now();
                return stage;
            });
    } else {
        showStill();
        building = Promise.resolve(null);
    }

    await threshold.begun;
    const built = building.catch((error) => {
        console.error('Elysicester could not be drawn live:', error);
        return null;
    });
    // A passage asked for by the address (#read-…) opens once the city has arrived.
    const wanted = window.location.hash.startsWith('#read-')
        ? readable.find((fragment) => `#read-${fragment.id}` === window.location.hash)
        : null;
    // Arrive: the live city if it was built, else the still (unless it's already showing). On trial (dock,
    // trials.js), the visit begins as the shadow, walking, at the end of the jetty (unless it came to read).
    const arrive = () => {
        if (stage) {
            if (trialOn('dock') && !wanted) stage.walk?.arrive();
            stage.start();
            root.dataset.mode = 'live';
        } else if (root.dataset.mode !== 'still') {
            showStill();
        }
    };
    let passage;
    if (returning) {
        passage = await threshold.comeBack({ ready: built });
        liftVeil(arrive);
    } else if (renderer && !reducedMotion) {
        passage = await threshold.fly({ renderer, ready: built, lines, fit: () => fitRenderer(renderer, canvas) });
        liftVeil(arrive);
    } else {
        passage = await threshold.crossfade({ ready: built.then(arrive) });
    }
    rememberCrossed();
    hotspots?.welcome();
    if (debug) window.elysicesterDebug.threshold = passage;
    pointsNav.inert = false;
    if (extras.has('voice')) speak(readable.filter((fragment) => fragment.status === 'approved' && WORKS[fragment.work]), WORKS);

    // The trials (trials.js): a whisper after a long stillness, taken up where the flight's lines left off;
    // and the places' faint names from far out.
    if (stage && trialOn('whisper')) {
        const whisper = createWhisper({
            element: byId('whisper'),
            lines: whispered,
            from: (passage?.linesShown ?? 0) < whispered.length ? passage?.linesShown ?? 0 : 0,
            isBusy: () => reader.isOpen,
            onFrame: (listener) => stage.onFrame(listener),
        });
        if (debug) window.elysicesterDebug.whisper = whisper;
    }
    if (stage && trialOn('names')) {
        const pointLabel = byId('point-label');
        const names = createNames({
            container: byId('place-names'),
            stage,
            places,
            fragments: readable,
            read,
            hint: hinting,
            litPlace: () => (pointLabel.hidden ? null : readable.find((fragment) => fragment.id === pointLabel.dataset.fragment)?.place ?? null),
        });
        if (debug) window.elysicesterDebug.names = names;
    }

    if (stage) {
        if (oneButton) wireOneButton(stage);
        const home = byId('home-view');
        home.addEventListener('click', () => {
            stage.walk?.letGo();
            stage.rig.toHome();
        });
        stage.onFrame(() => {
            const away = !stage.rig.atHome;
            if (home.hidden === away) home.hidden = !away;
        });

        // Walking as the shadow, a reading point close by names its place (a tap on it reads it, as ever).
        if (stage.walk && hotspots) {
            let near = null;
            stage.onFrame(() => {
                const walker = stage.walk.state;
                let found = null;
                if (walker.walking) {
                    let best = NEAR_POINT;
                    for (const fragment of readable) {
                        const point = hotspots.positionOf(fragment.id);
                        if (!point) continue;
                        const head = walker.position.y + 1.2;
                        const away = Math.hypot(point.x - walker.position.x, point.y - head, point.z - walker.position.z);
                        if (away < best) {
                            best = away;
                            found = fragment;
                        }
                    }
                }
                if (found !== near) {
                    near = found;
                    hotspots.light(found, { pin: true });
                    // (The banshee, on trial, turns its hood to the passage it's beside.)
                    stage.walk.attend?.(found ? hotspots.positionOf(found.id) : null);
                }
            });
            // Its name, while the shadow stands beside it, is a way in too: a click reads it (the list is the
            // way for keys, as ever).
            const pointLabel = byId('point-label');
            pointLabel.addEventListener('click', () => {
                if (!pointLabel.classList.contains('is-near')) return;
                const fragment = readable.find((candidate) => candidate.id === pointLabel.dataset.fragment);
                if (fragment) open(fragment, null);
            });
            // (And a thumb set down on it to steer, as a phone's thumb is, low on the screen, steers: walk.js.)
            stage.walk.steersFrom(pointLabel);
        }
    }
    // If the card or the choice held focus (they've gone now), land it on the city's name.
    const focused = document.activeElement;
    if (!focused || focused === document.body || byId('threshold').contains(focused) || byId('choice').contains(focused)) {
        byId('diorama-title').focus({ preventScroll: true });
    }

    if (debug) {
        Object.assign(window.elysicesterDebug, {
            hotspots,
            signs: signOverlay,
            signCoverage: stage?.signs.coverage ?? null,
            reader,
            fragments: readable,
            focusFragment: (id) => focusFragment(readable.find((fragment) => fragment.id === id)),
        });
    }

    if (wanted) open(wanted, list.linkFor(wanted.id));
}

boot().catch((error) => {
    showStill();
    byId('threshold').hidden = true;
    byId('points').inert = false;
    root.dataset.threshold = 'done';
    console.error('Elysicester could not begin:', error);
});
