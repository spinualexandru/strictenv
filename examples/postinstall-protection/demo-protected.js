#!/usr/bin/env node
'use strict';

/**
 * This demo shows what happens WITH dotnope protection.
 * The malicious postinstall script is blocked from stealing secrets.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(60));
console.log('DEMO: Protected npm postinstall with dotnope');
console.log('='.repeat(60));
console.log();
console.log('Simulating: NODE_OPTIONS="--require ./preload-dotnope.js" npm install malicious-package');
console.log('(Running postinstall script WITH dotnope protection)');
console.log();

// Set fake secrets in environment
const env = {
    ...process.env,
    NPM_TOKEN: 'npm_XXXXXXXXXXXXXXXXXXXX',
    AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    // This is the key: preload dotnope before any npm scripts run
    NODE_OPTIONS: `--require ${path.join(__dirname, 'preload-dotnope.js')}`
};

// Run the malicious postinstall script with dotnope preloaded
const postinstall = spawn('node', [
    path.join(__dirname, 'node_modules/malicious-package/postinstall.js')
], { env, stdio: 'inherit', cwd: __dirname });

postinstall.on('close', (code) => {
    console.log();
    if (code !== 0) {
        console.log('='.repeat(60));
        console.log('GOOD NEWS: dotnope blocked the malicious script!');
        console.log('Your secrets are safe.');
        console.log('='.repeat(60));
    } else {
        console.log('Unexpected: script succeeded when it should have been blocked');
    }
});
