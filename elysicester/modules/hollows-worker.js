/**
 * hollows-worker.js — lays the map of what stands where (hollows-map.js) away
 * from the main thread, so the flight into the city never stutters while the
 * city's hollows are found.
 */

// =============================================================================
// Imports
// =============================================================================

import { buildHollowData } from './hollows-map.js';

// =============================================================================
// Main Code
// =============================================================================

self.addEventListener('message', (event) => {
    const result = buildHollowData(event.data);
    self.postMessage(result, [result.data.buffer]);
});
