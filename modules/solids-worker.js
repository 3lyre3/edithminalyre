/**
 * solids-worker.js — builds the camera's distance field away from the main
 * thread, so the flight into the city never stutters while it's made.
 */

// =============================================================================
// Imports
// =============================================================================

import { buildField } from './solids-field.js';

// =============================================================================
// Main Code
// =============================================================================

self.addEventListener('message', (event) => {
    const result = buildField(event.data);
    self.postMessage(result, [result.field.buffer]);
});
