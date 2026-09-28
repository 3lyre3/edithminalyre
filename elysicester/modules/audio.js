/**
 * audio.js — Elysicester's sound, made in the browser: a low hum and the sea.
 *
 * No audio files. The hum is three soft, detuned tones under a low-pass
 * filter, breathing slowly; the sea is looped brown noise through a filter
 * that opens and closes like surf, its loudness swelling with each wave. Sound
 * is off unless the visitor switches it on, and the choice is remembered. The
 * AudioContext is only ever made inside a visitor's gesture, as browsers ask.
 */

// =============================================================================
// Constants
// =============================================================================

const LEVEL = 0.32;

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
    let on = false;

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
            }
            on = true;
            master.gain.setTargetAtTime(LEVEL, context.currentTime, 0.8);
            const resuming = context.resume();
            if (context.state !== 'running') {
                resuming?.catch(() => {});
                resumeOnNextGesture();
            }
        },
        stop() {
            on = false;
            if (!context) return;
            master.gain.setTargetAtTime(0, context.currentTime, 0.25);
            window.setTimeout(() => {
                if (!on) context.suspend();
            }, 1500);
        },
        /** "off" until started; then the context's own state. */
        get state() {
            return context && on ? context.state : 'off';
        },
    };
}
