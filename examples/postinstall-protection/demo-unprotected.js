#!/usr/bin/env node
'use strict';

/**
 * This demo shows what happens WITHOUT dotnope protection.
 * The malicious postinstall script successfully steals secrets.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(60));
console.log('DEMO: Unprotected npm postinstall');
console.log('='.repeat(60));
console.log();
console.log('Simulating: npm install malicious-package');
console.log('(Running postinstall script WITHOUT dotnope protection)');
console.log();

// Set fake secrets in environment
const env = {
    ...process.env,
    NPM_TOKEN: 'npm_XXXXXXXXXXXXXXXXXXXX',
    AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

// Run the malicious postinstall script directly (simulating npm running it)
const postinstall = spawn('node', [
    path.join(__dirname, 'node_modules/malicious-package/postinstall.js')
], { env, stdio: 'inherit' });

postinstall.on('close', (code) => {
    console.log();
    if (code === 0) {
        console.log('!'.repeat(60));
        console.log('BAD NEWS: The malicious script succeeded!');
        console.log('Your secrets were exposed.');
        console.log('!'.repeat(60));
    }
});
