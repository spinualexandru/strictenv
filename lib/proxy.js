'use strict';

let originalEnv = null;
let proxyEnv = null;
let isEnabled = false;
let checkAccessFn = null;

/**
 * Creates a Proxy wrapper around process.env to intercept all access
 * @param {Function} checkFn - Function called on every env var access
 */
function createEnvProxy(checkFn) {
    if (proxyEnv) {
        throw new Error('strictenv: Proxy already created');
    }

    checkAccessFn = checkFn;
    originalEnv = process.env;

    proxyEnv = new Proxy(originalEnv, {
        get(target, prop, receiver) {
            // Skip symbols and internal properties
            if (typeof prop === 'symbol') {
                return Reflect.get(target, prop, receiver);
            }

            // Skip Node.js internal inspection
            if (prop === 'inspect' || prop === Symbol.toStringTag) {
                return Reflect.get(target, prop, receiver);
            }

            // Check access if enabled
            if (isEnabled && checkAccessFn) {
                checkAccessFn(String(prop));
            }

            return target[prop];
        },

        set(target, prop, value) {
            // Allow all writes - only reads are controlled
            target[prop] = value;
            return true;
        },

        has(target, prop) {
            // Intercept 'in' operator usage
            if (isEnabled && checkAccessFn && typeof prop === 'string') {
                checkAccessFn(prop);
            }
            return prop in target;
        },

        deleteProperty(target, prop) {
            // Allow deletions
            delete target[prop];
            return true;
        },

        ownKeys(target) {
            // Allow enumeration without checks (Object.keys, etc.)
            return Reflect.ownKeys(target);
        },

        getOwnPropertyDescriptor(target, prop) {
            // Intercept property descriptor access
            if (isEnabled && checkAccessFn && typeof prop === 'string') {
                checkAccessFn(prop);
            }
            return Object.getOwnPropertyDescriptor(target, prop);
        },

        defineProperty(target, prop, descriptor) {
            return Object.defineProperty(target, prop, descriptor);
        }
    });

    // Replace process.env with our proxy
    process.env = proxyEnv;
}

/**
 * Enable strict environment checking
 */
function enable() {
    isEnabled = true;
}

/**
 * Disable strict environment checking (proxy remains but doesn't check)
 */
function disable() {
    isEnabled = false;
}

/**
 * Restore original process.env and remove proxy
 */
function restore() {
    if (originalEnv) {
        process.env = originalEnv;
        isEnabled = false;
        proxyEnv = null;
        checkAccessFn = null;
    }
}

/**
 * Check if strict mode is currently enabled
 */
function isStrictModeEnabled() {
    return isEnabled;
}

module.exports = {
    createEnvProxy,
    enable,
    disable,
    restore,
    isStrictModeEnabled
};
