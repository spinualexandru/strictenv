/**
 * Auto-register entry point for dotnope.
 *
 * Usage:
 *   node -r dotnope/register your-app.js
 *
 * This automatically enables strict environment variable protection
 * before your application code runs, ensuring no modules can capture
 * a reference to process.env before protection is active.
 *
 * The handle and token are stored on global.__dotnope for access:
 *   const { handle, token } = global.__dotnope;
 *   handle.disable(token);  // If you need to disable later
 */

'use strict';

const dotnope = require('./index.js');

// Enable strict env protection immediately
const handle = dotnope.enableStrictEnv({
    // Disable strict load order check since we're being loaded via -r
    // which means we're intentionally loaded before other modules
    strictLoadOrder: false,
    // Suppress warnings during auto-register (user can call emitSecurityWarnings later)
    suppressWarnings: true
});

// Store handle and token on global for later access if needed
global.__dotnope = {
    handle,
    token: handle.getToken(),
    // Convenience method to emit warnings after app loads
    emitWarnings: (options) => dotnope.emitSecurityWarnings(options)
};
