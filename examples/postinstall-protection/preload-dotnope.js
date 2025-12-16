#!/usr/bin/env node
'use strict';

/**
 * This preload script enables dotnope protection for ALL Node.js processes.
 * Use with NODE_OPTIONS="--require ./preload-dotnope.js" npm install
 *
 * This protects against malicious postinstall/preinstall scripts that try
 * to steal environment variables during npm install.
 */

const path = require('path');

// Load dotnope from parent directory
const dotnope = require('../../index');

// Find the package.json in the current working directory
const configPath = path.join(process.cwd(), 'package.json');

try {
    dotnope.enableStrictEnv({ configPath });
    // Silently enabled - don't spam logs during npm install
} catch (err) {
    // If config not found, that's okay - we're probably in a subdirectory
    // or this is a fresh install. Still provides default protection.
}
