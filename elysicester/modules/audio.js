/**
 * audio.js — Elysicester's sound, made in the browser: a low hum and the sea.
 *
 * No audio files. The hum is three soft, detuned tones under a low-pass
 * filter, breathing slowly; the sea is looped brown noise through a filter
 * that opens and closes like surf, its loudness swelling with each wave. And
 * now and then, somewhere along the wall, a wave breaks ("the sea erupts in
 * bursts of silver and violet", Numbers by Paint, Episode 1): a short hiss that
 * sweeps down and dies away, a little to one side or the other. Things the
 * visitor touches answer softly in their own voices (answer). Sound is off
 * unless the visitor switches it on, and the choice is remembered. The
 * AudioContext is only ever made inside a visitor's gesture, as browsers ask.
 */

// =============================================================================
// Constants
// =============================================================================

const LEVEL = 0.32;
/** How long between breakers, at the least and the most (seconds). */
const BREAK_FROM = 3.5;
const BREAK_TO = 8.5;

// =============================================================================
// Main Code
// =============================================================================

function brownNoise(context, seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[index] = last * 3.5;
    }
    return buffer;
}

/** A few seconds of pinkish noise, bright enough for the hiss of a breaking wave. */
function spray(context, seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        low = low * 0.9 + white * 0.1;
        data[index] = (white * 0.55 + low * 1.6) * 0.5;
    }
    return buffer;
}

/** One wave breaking against the wall: its hiss sweeps down and dies away, somewhere to one side. */
function breaker(context, output, noise) {
    const now = context.currentTime;
    const length = 1.6 + Math.random() * 1.1;
    const source = context.createBufferSource();
    source.buffer = noise;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(2400 + Math.random() * 900, now);
    band.frequency.exponentialRampToValueAtTime(480, now + length);
    const gain = context.createGain();
    // Loud enough to be heard over the surf (the band-pass takes most of the noise's energy), no louder.
    const peak = 0.34 + Math.random() * 0.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.06 + Math.random() * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    source.connect(band).connect(gain);
    if (context.createStereoPanner) {
        const side = context.createStereoPanner();
        side.pan.value = Math.random() * 1.4 - 0.7;
        gain.connect(side).connect(output);
    } else {
        gain.connect(output);
    }
    source.start(now, Math.random() * Math.max(0, noise.duration - length), length);
}

/** The street's answer to a slam (made once for each context): walls across it giving it back, and a long fall. */
const streets = new WeakMap();

function street(context) {
    if (streets.has(context)) return streets.get(context);
    const seconds = 2.6;
    const length = Math.floor(context.sampleRate * seconds);
    const response = context.createBuffer(2, length, context.sampleRate);
    // (The walls across the street, and the halls further off: an echo from each, softer the further.)
    const walls = [[0.07, 0.5], [0.13, 0.42], [0.21, 0.3], [0.34, 0.22], [0.5, 0.14], [0.71, 0.08]];
    for (let channel = 0; channel < 2; channel += 1) {
        const data = response.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
            const t = index / context.sampleRate;
            data[index] = (Math.random() * 2 - 1) * Math.exp(-t / 0.5) * 0.32;
        }
        for (const [at, level] of walls) {
            const index = Math.floor((at + channel * 0.011) * context.sampleRate);
            for (let k = 0; k < 160; k += 1) data[index + k] += (Math.random() * 2 - 1) * level * Math.exp(-k / 40);
        }
    }
    streets.set(context, response);
    return response;
}

/**
 * A touch answered, softly, in the thing's own voice: the steel sycamore's leaves rustle, a bird statue rings
 * like struck metal, a small dog's feet patter, and the rock's underside gives a deep swell. (And Cassandra's
 * door: a knock, then its slam; and the charity ball: the old Greek's muttering, the applause, the band, the hidden
 * door's bar, and Cassandra talking to herself.)
 */
function answer(context, output, noise, kind) {
    const now = context.currentTime;
    const envelope = (gain, peak, rise, fall) => {
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + rise);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + rise + fall);
    };
    if (kind === 'tree') {
        // Three quick, bright brushes of noise, one on another.
        for (let brush = 0; brush < 3; brush += 1) {
            const at = now + brush * 0.09;
            const source = context.createBufferSource();
            source.buffer = noise;
            const band = context.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = 3200 + brush * 700;
            band.Q.value = 1.4;
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.22, at + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
            source.connect(band).connect(gain).connect(output);
            source.start(at, Math.random() * (noise.duration - 0.4), 0.4);
        }
    } else if (kind === 'statue') {
        // Struck metal: a few inharmonic partials, the higher dying first.
        for (const [ratio, level, fall] of [[1, 0.16, 2.2], [1.58, 0.1, 1.6], [2.37, 0.07, 1.1], [3.35, 0.04, 0.7]]) {
            const tone = context.createOscillator();
            tone.frequency.value = 523 * ratio;
            const gain = context.createGain();
            envelope(gain, level, 0.005, fall);
            tone.connect(gain).connect(output);
            tone.start(now);
            tone.stop(now + fall + 0.05);
        }
    } else if (kind === 'door') {
        // The white door of The Door in the Floor, knocked on: two soft knocks on old wood, and then, very small,
        // the mouse's squeak, its joke ready at last.
        for (const knock of [0, 0.19]) {
            const at = now + knock;
            const tone = context.createOscillator();
            tone.type = 'triangle';
            tone.frequency.setValueAtTime(210, at);
            tone.frequency.exponentialRampToValueAtTime(95, at + 0.06);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.26, at + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
            tone.connect(gain).connect(output);
            tone.start(at);
            tone.stop(at + 0.13);
        }
        const squeakAt = now + 0.62;
        const squeak = context.createOscillator();
        squeak.frequency.setValueAtTime(2300, squeakAt);
        squeak.frequency.exponentialRampToValueAtTime(3100, squeakAt + 0.05);
        squeak.frequency.exponentialRampToValueAtTime(2600, squeakAt + 0.09);
        const small = context.createGain();
        small.gain.setValueAtTime(0.0001, squeakAt);
        small.gain.exponentialRampToValueAtTime(0.035, squeakAt + 0.015);
        small.gain.exponentialRampToValueAtTime(0.0001, squeakAt + 0.1);
        squeak.connect(small).connect(output);
        squeak.start(squeakAt);
        squeak.stop(squeakAt + 0.12);
    } else if (kind === 'knock') {
        // Cassandra's door, knocked on (places.js): three firm knocks on heavy wood, a knuckle's click in each.
        for (const knock of [0, 0.23, 0.46]) {
            const at = now + knock;
            const tone = context.createOscillator();
            tone.type = 'triangle';
            tone.frequency.setValueAtTime(150, at);
            tone.frequency.exponentialRampToValueAtTime(68, at + 0.07);
            const body = context.createGain();
            body.gain.setValueAtTime(0.0001, at);
            body.gain.exponentialRampToValueAtTime(0.6, at + 0.004);
            body.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
            tone.connect(body).connect(output);
            tone.start(at);
            tone.stop(at + 0.16);
            const click = context.createBufferSource();
            click.buffer = noise;
            const band = context.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = 1100;
            band.Q.value = 1.6;
            const snap = context.createGain();
            snap.gain.setValueAtTime(0.0001, at);
            snap.gain.exponentialRampToValueAtTime(0.3, at + 0.002);
            snap.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
            click.connect(band).connect(snap).connect(output);
            click.start(at, Math.random() * (noise.duration - 0.1), 0.06);
        }
    } else if (kind === 'slam') {
        // The door yanked shut: a heavy thud and the crack of the latch, and the slam "reverberated through the
        // neighbourhood": the street's walls give it back, and it dies away slowly.
        const echo = context.createConvolver();
        echo.buffer = street(context);
        const far = context.createBiquadFilter();
        far.type = 'lowpass';
        far.frequency.value = 2200;
        const wet = context.createGain();
        wet.gain.value = 0.85;
        echo.connect(far).connect(wet).connect(output);
        const thump = context.createOscillator();
        thump.frequency.setValueAtTime(64, now);
        thump.frequency.exponentialRampToValueAtTime(36, now + 0.4);
        const thumpLevel = context.createGain();
        envelope(thumpLevel, 0.95, 0.004, 0.45);
        thump.connect(thumpLevel);
        thumpLevel.connect(output);
        thumpLevel.connect(echo);
        thump.start(now);
        thump.stop(now + 0.5);
        const burst = context.createBufferSource();
        burst.buffer = noise;
        const low = context.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 650;
        const burstLevel = context.createGain();
        envelope(burstLevel, 1.0, 0.003, 0.32);
        burst.connect(low).connect(burstLevel);
        burstLevel.connect(output);
        burstLevel.connect(echo);
        burst.start(now, Math.random() * (noise.duration - 0.5), 0.4);
        const latch = context.createBufferSource();
        latch.buffer = noise;
        const crack = context.createBiquadFilter();
        crack.type = 'bandpass';
        crack.frequency.value = 1800;
        crack.Q.value = 2.2;
        const latchLevel = context.createGain();
        envelope(latchLevel, 0.4, 0.002, 0.06);
        latch.connect(crack).connect(latchLevel);
        latchLevel.connect(output);
        latchLevel.connect(echo);
        latch.start(now + 0.01, Math.random() * (noise.duration - 0.2), 0.1);
    } else if (kind === 'chirp') {
        // A hum's "chirp" (creatures.js): two quick bright chips, rising, as a hummingbird's are.
        for (const chip of [0, 0.085]) {
            const at = now + chip;
            const tone = context.createOscillator();
            tone.frequency.setValueAtTime(3300, at);
            tone.frequency.exponentialRampToValueAtTime(5200, at + 0.045);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.05, at + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
            tone.connect(gain).connect(output);
            tone.start(at);
            tone.stop(at + 0.07);
        }
    } else if (kind === 'squur') {
        // A pug's "squur" (creatures.js): a snuffle through the squashed nose, and a low calf's voice that rolls its r.
        const snort = context.createBufferSource();
        snort.buffer = noise;
        const nose = context.createBiquadFilter();
        nose.type = 'bandpass';
        nose.frequency.value = 950;
        nose.Q.value = 1.3;
        const breath = context.createGain();
        envelope(breath, 0.16, 0.02, 0.17);
        snort.connect(nose).connect(breath).connect(output);
        snort.start(now, Math.random() * (noise.duration - 0.3), 0.3);
        const voice = context.createOscillator();
        voice.type = 'sawtooth';
        voice.frequency.setValueAtTime(175, now + 0.08);
        voice.frequency.exponentialRampToValueAtTime(122, now + 0.46);
        const throat = context.createBiquadFilter();
        throat.type = 'lowpass';
        throat.frequency.value = 650;
        const level = context.createGain();
        level.gain.setValueAtTime(0.0001, now + 0.08);
        level.gain.exponentialRampToValueAtTime(0.09, now + 0.14);
        level.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        // (The roll of the r: the voice beating at a purr's pace.)
        const roll = context.createOscillator();
        roll.frequency.value = 26;
        const rollDepth = context.createGain();
        rollDepth.gain.value = 0.045;
        const rolled = context.createGain();
        rolled.gain.value = 0.5;
        roll.connect(rollDepth).connect(rolled.gain);
        voice.connect(throat).connect(rolled).connect(level).connect(output);
        voice.start(now + 0.08);
        voice.stop(now + 0.52);
        roll.start(now + 0.08);
        roll.stop(now + 0.52);
    } else if (kind === 'mutter' || kind === 'murmur') {
        // The old Greek's aphorisms at the charity ball (places.js): "a handful of trochaic syllables rising with his
        // eyebrows, then a clutch of iambs closing as his lips pursed", an old man's low voice through a closed mouth.
        // (And Cassandra on the balcony, "talking to herself": the same, higher, softer and quicker.)
        const hers = kind === 'murmur';
        const pace = hers ? 0.8 : 1;
        const mouth = context.createBiquadFilter();
        mouth.type = 'bandpass';
        mouth.frequency.value = hers ? 900 : 620;
        mouth.Q.value = 1.1;
        const closed = context.createBiquadFilter();
        closed.type = 'lowpass';
        closed.frequency.value = hers ? 1800 : 1200;
        const voice = context.createGain();
        voice.gain.value = hers ? 1.25 : 1.85;
        mouth.connect(closed).connect(voice).connect(output);
        let at = now + 0.05;
        // (Three trochees, long-short, each a little higher; then two iambs, short-long, falling and closing.)
        [[1, 0], [1, 0], [1, 0], [0, 1], [0, 1]].forEach((foot, index) => {
            for (const stressed of foot) {
                const rise = index < 3 ? index * 0.06 + (stressed ? 0.03 : 0) : 0.1 - (index - 3) * 0.12 - (stressed ? 0 : 0.03);
                const length = (stressed ? 0.2 : 0.11) * pace;
                const tone = context.createOscillator();
                tone.type = 'sawtooth';
                tone.frequency.setValueAtTime(108 * (hers ? 1.9 : 1) * (1 + rise), at);
                tone.frequency.linearRampToValueAtTime(108 * (hers ? 1.9 : 1) * (1 + rise) * 0.94, at + length);
                const gain = context.createGain();
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.exponentialRampToValueAtTime(stressed ? 0.5 : 0.28, at + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
                tone.connect(gain).connect(mouth);
                tone.start(at);
                tone.stop(at + length + 0.02);
                at += (stressed ? 0.26 : 0.15) * pace;
            }
        });
    } else if (kind === 'applause') {
        // "two hundred guests stood to fill the hall with whistles and applause" (the charity ball, places.js): claps
        // by the dozen, thick at first and thinning as she takes the podium, and a whistle or two.
        const hall = context.createBiquadFilter();
        hall.type = 'lowpass';
        hall.frequency.value = 5200;
        const level = context.createGain();
        level.gain.value = 1.15;
        hall.connect(level).connect(output);
        const length = 2.2;
        for (let clap = 0; clap < 110; clap += 1) {
            const t = length * Math.random() ** 1.35;
            const at = now + 0.04 + t;
            const source = context.createBufferSource();
            source.buffer = noise;
            const band = context.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = 1100 + Math.random() * 1600;
            band.Q.value = 1.2 + Math.random();
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime((1.0 + Math.random() * 1.0) * (1 - 0.6 * (t / length)), at + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05 + Math.random() * 0.03);
            source.connect(band).connect(gain).connect(hall);
            source.start(at, Math.random() * (noise.duration - 0.1), 0.09);
        }
        for (const [start, from, to] of [[0.25, 1500, 2600], [0.8, 1900, 3000]]) {
            const at = now + start;
            const tone = context.createOscillator();
            tone.frequency.setValueAtTime(from, at);
            tone.frequency.exponentialRampToValueAtTime(to, at + 0.22);
            tone.frequency.exponentialRampToValueAtTime(from * 1.05, at + 0.5);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.09, at + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
            tone.connect(gain).connect(output);
            tone.start(at);
            tone.stop(at + 0.6);
        }
    } else if (kind === 'bar') {
        // The hidden door's bar of polished gold, shoved (the charity ball, places.js): the latch's metal clack, a
        // ring in it, and the door's weight giving.
        const clack = context.createBufferSource();
        clack.buffer = noise;
        const ring = context.createBiquadFilter();
        ring.type = 'bandpass';
        ring.frequency.value = 2600;
        ring.Q.value = 3;
        const clackLevel = context.createGain();
        envelope(clackLevel, 0.95, 0.002, 0.07);
        clack.connect(ring).connect(clackLevel).connect(output);
        clack.start(now, Math.random() * (noise.duration - 0.2), 0.12);
        const tone = context.createOscillator();
        tone.frequency.value = 1760;
        const toneLevel = context.createGain();
        envelope(toneLevel, 0.06, 0.003, 0.3);
        tone.connect(toneLevel).connect(output);
        tone.start(now);
        tone.stop(now + 0.35);
        const give = context.createOscillator();
        give.type = 'triangle';
        give.frequency.setValueAtTime(95, now + 0.05);
        give.frequency.exponentialRampToValueAtTime(60, now + 0.25);
        const giveLevel = context.createGain();
        giveLevel.gain.setValueAtTime(0.0001, now + 0.05);
        giveLevel.gain.exponentialRampToValueAtTime(0.75, now + 0.06);
        giveLevel.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        give.connect(giveLevel).connect(output);
        give.start(now + 0.05);
        give.stop(now + 0.32);
    } else if (kind === 'band') {
        // The Kaitens take the stage (the charity ball, places.js): two bars of a walking bass under the ride cymbal's
        // swing, a chord on the off-beats, and a little phrase on the saxophone.
        const beat = 60 / 132;
        // (A beat, or its swung half: the "and" falls two-thirds of the way through the beat.)
        const at = (position) => now + 0.06 + (Math.floor(position) + (position % 1 ? 0.66 : 0)) * beat;
        const note = (type, frequency, from, length, peak, into) => {
            const tone = context.createOscillator();
            tone.type = type;
            tone.frequency.value = frequency;
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, from);
            gain.gain.exponentialRampToValueAtTime(peak, from + 0.012);
            gain.gain.exponentialRampToValueAtTime(peak * 0.6, from + length * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.0001, from + length);
            tone.connect(gain).connect(into);
            tone.start(from);
            tone.stop(from + length + 0.02);
            return tone;
        };
        const low = context.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 700;
        low.connect(output);
        [98, 110, 116.54, 123.47, 130.81, 164.81, 196, 164.81].forEach((frequency, index) => note('triangle', frequency, at(index), beat * 0.9, 0.48, low));
        note('triangle', 130.81, at(8), beat * 1.8, 0.48, low);
        const stabs = context.createBiquadFilter();
        stabs.type = 'lowpass';
        stabs.frequency.value = 1500;
        stabs.connect(output);
        for (const [position, chord] of [[1.5, [196, 246.94, 349.23]], [3.5, [196, 246.94, 349.23]], [5.5, [261.63, 329.63, 440]], [7.5, [261.63, 329.63, 440]]]) {
            for (const frequency of chord) note('sawtooth', frequency, at(position), 0.2, 0.05, stabs);
        }
        const reed = context.createBiquadFilter();
        reed.type = 'bandpass';
        reed.frequency.value = 1100;
        reed.Q.value = 0.8;
        const soft = context.createBiquadFilter();
        soft.type = 'lowpass';
        soft.frequency.value = 2800;
        reed.connect(soft).connect(output);
        for (const [position, length, frequency] of [[0.5, 0.5, 587.33], [1, 0.5, 523.25], [1.5, 0.5, 466.16], [2, 1, 440], [3.5, 0.5, 392], [4, 0.5, 466.16], [4.5, 0.5, 523.25], [5, 2.6, 659.25]]) {
            const tone = note('sawtooth', frequency, at(position), length * beat, 0.16, reed);
            if (length > 2) {
                // (The long note, held, with a singer's vibrato.)
                const wobble = context.createOscillator();
                wobble.frequency.value = 5.5;
                const depth = context.createGain();
                depth.gain.value = 6;
                wobble.connect(depth).connect(tone.frequency);
                wobble.start(at(position) + 0.3);
                wobble.stop(at(position) + length * beat);
            }
        }
        // (The ride cymbal: ding, ding-a ding.)
        const bright = context.createBiquadFilter();
        bright.type = 'highpass';
        bright.frequency.value = 6500;
        bright.connect(output);
        for (const position of [0, 1, 1.5, 2, 3, 3.5, 4, 5, 5.5, 6, 7, 7.5, 8]) {
            const from = at(position);
            const hiss = context.createBufferSource();
            hiss.buffer = noise;
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, from);
            gain.gain.exponentialRampToValueAtTime(position % 2 === 1 ? 0.17 : 0.11, from + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, from + 0.22);
            hiss.connect(gain).connect(bright);
            hiss.start(from, Math.random() * (noise.duration - 0.3), 0.25);
        }
    } else if (kind === 'dog') {
        // A little patter: two soft, low taps.
        for (const step of [0, 0.11]) {
            const tone = context.createOscillator();
            tone.frequency.setValueAtTime(190, now + step);
            tone.frequency.exponentialRampToValueAtTime(120, now + step + 0.07);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, now + step);
            gain.gain.exponentialRampToValueAtTime(0.2, now + step + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + step + 0.09);
            tone.connect(gain).connect(output);
            tone.start(now + step);
            tone.stop(now + step + 0.12);
        }
    } else {
        // The underside: a deep swell, rising and settling.
        const warmth = context.createBiquadFilter();
        warmth.type = 'lowpass';
        warmth.frequency.value = 160;
        const gain = context.createGain();
        envelope(gain, 0.3, 0.7, 1.6);
        for (const frequency of [49, 73.5]) {
            const tone = context.createOscillator();
            tone.frequency.value = frequency;
            tone.connect(warmth);
            tone.start(now);
            tone.stop(now + 2.4);
        }
        warmth.connect(gain).connect(output);
    }
}

function build(context) {
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const hum = context.createGain();
    hum.gain.value = 0.2;
    const warmth = context.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 190;
    for (const [frequency, type, level] of [[55, 'sine', 0.42], [82.41, 'triangle', 0.22], [110.3, 'sine', 0.3]]) {
        const tone = context.createOscillator();
        tone.type = type;
        tone.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.value = level;
        tone.connect(gain).connect(warmth);
        tone.start();
    }
    warmth.connect(hum).connect(master);
    const breath = context.createOscillator();
    breath.frequency.value = 0.07;
    const breathDepth = context.createGain();
    breathDepth.gain.value = 0.07;
    breath.connect(breathDepth).connect(hum.gain);
    breath.start();

    const noise = context.createBufferSource();
    noise.buffer = brownNoise(context, 6);
    noise.loop = true;
    const surf = context.createBiquadFilter();
    surf.type = 'lowpass';
    surf.frequency.value = 850;
    const sea = context.createGain();
    sea.gain.value = 0.16;
    noise.connect(surf).connect(sea).connect(master);
    noise.start();
    const swell = context.createOscillator();
    swell.frequency.value = 0.11;
    const swellDepth = context.createGain();
    swellDepth.gain.value = 0.11;
    swell.connect(swellDepth).connect(sea.gain);
    const sweepDepth = context.createGain();
    sweepDepth.gain.value = 480;
    swell.connect(sweepDepth).connect(surf.frequency);
    swell.start();

    return master;
}

export function createAudio() {
    let context = null;
    let master = null;
    let noise = null;
    let breaking = 0;
    let on = false;

    /** While the sound is on and playing, a wave breaks now and then. */
    const nextBreaker = () => {
        window.clearTimeout(breaking);
        breaking = window.setTimeout(() => {
            if (!on) return;
            if (context.state === 'running') breaker(context, master, noise);
            nextBreaker();
        }, (BREAK_FROM + Math.random() * (BREAK_TO - BREAK_FROM)) * 1000);
    };

    /**
     * If the browser held the sound back (the gesture didn't count, as with Esc),
     * let the visitor's next tap or keypress bring it in.
     */
    const resumeOnNextGesture = () => {
        const retry = () => {
            window.removeEventListener('pointerdown', retry, true);
            window.removeEventListener('keydown', retry, true);
            if (on && context.state !== 'running') context.resume().catch(() => {});
        };
        window.addEventListener('pointerdown', retry, true);
        window.addEventListener('keydown', retry, true);
    };

    return {
        /** Start (or resume) the sound. Call only from inside a gesture. */
        start() {
            const Context = window.AudioContext ?? window.webkitAudioContext;
            if (!Context) return;
            if (!context) {
                context = new Context();
                master = build(context);
                noise = spray(context, 4);
            }
            on = true;
            master.gain.setTargetAtTime(LEVEL, context.currentTime, 0.8);
            nextBreaker();
            const resuming = context.resume();
            if (context.state !== 'running') {
                resuming?.catch(() => {});
                resumeOnNextGesture();
            }
        },
        stop() {
            on = false;
            window.clearTimeout(breaking);
            if (!context) return;
            master.gain.setTargetAtTime(0, context.currentTime, 0.25);
            window.setTimeout(() => {
                if (!on) context.suspend();
            }, 1500);
        },
        /**
         * A touch answered (touch.js): 'tree', 'statue', 'dog', 'door' or 'underside'; or a giver's word (creatures.js):
         * 'chirp' or 'squur'; or Cassandra's door (places.js): 'knock', then 'slam'; or the charity ball (places.js):
         * 'mutter', 'applause', 'band', 'bar' and 'murmur'. Silent unless the sound is on.
         */
        answer(kind) {
            if (!on || !context || context.state !== 'running') return;
            answer(context, master, noise, kind);
        },
        /** "off" until started; then the context's own state. */
        get state() {
            return context && on ? context.state : 'off';
        },
    };
}
