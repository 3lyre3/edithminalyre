/**
 * state.js — what the visitor has read, remembered between visits.
 *
 * Everything lives in localStorage under the "elysicester:" namespace, and
 * every access is wrapped in try/catch: a blocked or full store may cost the
 * diorama its memory, never its working. The keys are stable across tiers.
 *
 *   elysicester:read   JSON array of fragment ids the visitor has opened
 *   elysicester:sound  "on" or "off" (sound is off unless chosen)
 */

// =============================================================================
// Constants
// =============================================================================

const PREFIX = 'elysicester:';

export const KEYS = Object.freeze({
    read: `${PREFIX}read`,
    sound: `${PREFIX}sound`,
});

// =============================================================================
// Main Code
// =============================================================================

function load(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function save(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/** @returns {Set<string>} ids of the fragments already read */
export function readFragments() {
    const stored = load(KEYS.read, []);
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []);
}

/** Remember that a fragment has been read; returns the updated set. */
export function markRead(id) {
    const read = readFragments();
    read.add(id);
    save(KEYS.read, [...read]);
    return read;
}

export function soundWanted() {
    return load(KEYS.sound, 'off') === 'on';
}

export function rememberSound(on) {
    save(KEYS.sound, on ? 'on' : 'off');
}
