/**
 * native-bridge.js - JavaScript bridge to native C++ addon
 *
 * Provides optional native functionality for enhanced security:
 * - V8-level stack trace capture (bypasses Error.prepareStackTrace tampering)
 * - Promise hooks for async context tracking
 * - Worker thread protection
 */

'use strict';

let native = null;
let nativeAvailable = false;
let initializationError = null;

/**
 * Attempt to load the native addon
 */
function loadNativeAddon() {
    if (native !== null) {
        return nativeAvailable;
    }

    try {
        // Try to load the compiled native addon from root build directory
        native = require('../build/Release/dotnope_native.node');
        nativeAvailable = true;

        // Initialize the native module
        native.initialize();

        return true;
    } catch (err) {
        // Native addon not available - fall back to pure JS
        initializationError = err;
        native = null;
        nativeAvailable = false;
        return false;
    }
}

/**
 * Check if native functionality is available
 */
function isNativeAvailable() {
    if (native === null) {
        loadNativeAddon();
    }
    return nativeAvailable;
}

/**
 * Get the initialization error if native failed to load
 */
function getInitializationError() {
    return initializationError;
}

/**
 * Get native module version
 */
function getVersion() {
    if (!isNativeAvailable()) {
        return null;
    }
    return native.getVersion();
}

/**
 * Capture stack trace using native V8 API
 * Falls back to JavaScript implementation if native not available
 *
 * @param {number} skipFrames - Number of frames to skip
 * @returns {Array|null} Array of stack frames or null
 */
function captureStackTrace(skipFrames = 0) {
    if (!isNativeAvailable()) {
        return null;
    }
    return native.captureStackTrace(skipFrames);
}

/**
 * Get caller information using native V8 API
 * Falls back to JavaScript implementation if native not available
 *
 * @param {number} skipFrames - Number of frames to skip
 * @returns {Object|null} Caller info object or null
 */
function getCallerInfo(skipFrames = 0) {
    if (!isNativeAvailable()) {
        return null;
    }
    return native.getCallerInfo(skipFrames);
}

/**
 * Enable promise hooks for async context tracking
 *
 * @returns {boolean} Success
 */
function enablePromiseHooks() {
    if (!isNativeAvailable()) {
        return false;
    }
    return native.enablePromiseHooks();
}

/**
 * Disable promise hooks
 *
 * @returns {boolean} Success
 */
function disablePromiseHooks() {
    if (!isNativeAvailable()) {
        return false;
    }
    return native.disablePromiseHooks();
}

/**
 * Get the async context (package name that initiated current async chain)
 *
 * @returns {string|null} Package name or null
 */
function getAsyncContext() {
    if (!isNativeAvailable()) {
        return null;
    }
    return native.getAsyncContext();
}

/**
 * Check if we're running in a worker thread
 *
 * @returns {boolean}
 */
function isWorkerThread() {
    if (!isNativeAvailable()) {
        // Fall back to checking worker_threads
        try {
            const { isMainThread } = require('worker_threads');
            return !isMainThread;
        } catch (e) {
            return false;
        }
    }
    return native.isWorkerThread();
}

/**
 * Get the number of registered isolates
 *
 * @returns {number}
 */
function getIsolateCount() {
    if (!isNativeAvailable()) {
        return 1;
    }
    return native.getIsolateCount();
}

/**
 * Cleanup native resources
 */
function cleanup() {
    if (isNativeAvailable()) {
        native.cleanup();
    }
}

module.exports = {
    loadNativeAddon,
    isNativeAvailable,
    getInitializationError,
    getVersion,
    captureStackTrace,
    getCallerInfo,
    enablePromiseHooks,
    disablePromiseHooks,
    getAsyncContext,
    isWorkerThread,
    getIsolateCount,
    cleanup
};
