'use strict';

let originalEnv = null;
let proxyEnv = null;
let isEnabled = false;
let checkAccessFn = null;
let filterKeysFn = null;
let proxyOptions = null;

/**
 * Creates a Proxy wrapper around process.env to intercept all access
 * @param {Function} checkFn - Function called on every env var access
 *                             Signature: checkFn(envVar, operation)
 *                             operation: 'read' | 'write' | 'delete'
 * @param {Object} options - Protection options
 * @param {boolean} options.protectWrites - Control write operations
 * @param {boolean} options.protectDeletes - Control delete operations
 * @param {boolean} options.protectEnumeration - Filter ownKeys results
 */
function createEnvProxy(checkFn, options = {}) {
    if (proxyEnv) {
        throw new Error('strictenv: Proxy already created');
    }

    checkAccessFn = checkFn;
    proxyOptions = {
        protectWrites: options.protectWrites !== false,
        protectDeletes: options.protectDeletes !== false,
        protectEnumeration: options.protectEnumeration !== false
    };
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
                checkAccessFn(String(prop), 'read');
            }

            return target[prop];
        },

        set(target, prop, value) {
            // Check write access if enabled and protectWrites is true
            if (isEnabled && checkAccessFn && proxyOptions.protectWrites) {
                if (typeof prop === 'string') {
                    checkAccessFn(prop, 'write');
                }
            }
            target[prop] = value;
            return true;
        },

        has(target, prop) {
            // Intercept 'in' operator usage
            if (isEnabled && checkAccessFn && typeof prop === 'string') {
                checkAccessFn(prop, 'read');
            }
            return prop in target;
        },

        deleteProperty(target, prop) {
            // Check delete access if enabled and protectDeletes is true
            if (isEnabled && checkAccessFn && proxyOptions.protectDeletes) {
                if (typeof prop === 'string') {
                    checkAccessFn(prop, 'delete');
                }
            }
            delete target[prop];
            return true;
        },

        ownKeys(target) {
            // Filter enumeration if protectEnumeration is enabled
            if (isEnabled && proxyOptions.protectEnumeration && filterKeysFn) {
                const allKeys = Reflect.ownKeys(target);
                // Filter to only allowed keys for the caller
                const filteredKeys = filterKeysFn(allKeys);
                if (filteredKeys !== null) {
                    return filteredKeys;
                }
            }
            return Reflect.ownKeys(target);
        },

        getOwnPropertyDescriptor(target, prop) {
            // Intercept property descriptor access
            if (isEnabled && checkAccessFn && typeof prop === 'string') {
                checkAccessFn(prop, 'read');
            }
            return Object.getOwnPropertyDescriptor(target, prop);
        },

        defineProperty(target, prop, descriptor) {
            // Check write access for defineProperty (it's effectively a write)
            if (isEnabled && checkAccessFn && proxyOptions.protectWrites) {
                if (typeof prop === 'string') {
                    checkAccessFn(prop, 'write');
                }
            }
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
        filterKeysFn = null;
        proxyOptions = null;
    }
}

/**
 * Set the function used to filter ownKeys results
 * @param {Function} filterFn - Function that takes all keys and returns filtered keys
 *                              Returns null to skip filtering
 */
function setFilterKeysFn(filterFn) {
    filterKeysFn = filterFn;
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
    setFilterKeysFn,
    isStrictModeEnabled
};
