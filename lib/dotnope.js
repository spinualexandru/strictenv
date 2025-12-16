'use strict';

const { createEnvProxy, enable, disable, restore } = require('./proxy');
const { getCallingPackage } = require('./stack-parser');
const { loadConfig, getConfig, clearCache: clearConfigCache } = require('./config-loader');
const { isPackageAllowed, clearCache: clearDepCache } = require('./dependency-resolver');

let isInitialized = false;

// Access tracking: "packageName:envVar" -> count
const accessCounts = new Map();

/**
 * Check if a package is allowed to access an environment variable
 * Throws an error if access is denied
 * @param {string} envVar - The environment variable being accessed
 */
function checkAccess(envVar) {
    // Get the caller info - isInternalFile check handles skipping strictenv frames
    const callerInfo = getCallingPackage(0);

    if (!callerInfo) {
        // Cannot determine caller - this can happen in some edge cases
        // Fail open for safety to avoid breaking applications
        return;
    }

    const { packageName, fileName, lineNumber, functionName } = callerInfo;

    // Main application always has access
    if (packageName === '__main__') {
        return;
    }

    const config = getConfig();

    // Track access
    const trackingKey = `${packageName}:${envVar}`;
    accessCounts.set(trackingKey, (accessCounts.get(trackingKey) || 0) + 1);

    // Check if access is allowed
    const isAllowed = isPackageAllowed(packageName, envVar, config);

    if (!isAllowed) {
        const error = new Error(
            `dotnope: Unauthorized environment variable access!\n` +
            `\n` +
            `  Package: "${packageName}"\n` +
            `  Attempted to read: "${envVar}"\n` +
            `  Location: ${fileName}:${lineNumber}\n` +
            `  Function: ${functionName}\n` +
            `\n` +
            `To allow this access, add to your package.json:\n` +
            `\n` +
            `  "environmentWhitelist": {\n` +
            `    "${packageName}": {\n` +
            `      "allowed": ["${envVar}"]\n` +
            `    }\n` +
            `  }\n`
        );

        error.code = 'ERR_DOTNOPE_UNAUTHORIZED';
        error.packageName = packageName;
        error.envVar = envVar;
        error.fileName = fileName;
        error.lineNumber = lineNumber;
        error.functionName = functionName;

        throw error;
    }
}

/**
 * Enable strict environment variable access control
 * @param {Object} options - Configuration options
 * @param {string} [options.configPath] - Custom path to package.json
 * @returns {Object} Handle with disable() and getAccessStats() methods
 */
function enableStrictEnv(options = {}) {
    if (isInitialized) {
        console.warn('dotnope: Already enabled');
        return {
            disable: disableStrictEnv,
            getAccessStats: getAccessStats
        };
    }

    // Load configuration from package.json
    loadConfig(options.configPath);

    // Create and activate the proxy
    createEnvProxy(checkAccess);
    enable();

    isInitialized = true;

    return {
        disable: disableStrictEnv,
        getAccessStats: getAccessStats
    };
}

/**
 * Disable strict environment variable access control
 */
function disableStrictEnv() {
    disable();
    restore();
    isInitialized = false;

    // Clear caches
    clearConfigCache();
    clearDepCache();
    accessCounts.clear();
}

/**
 * Get access statistics
 * @returns {Object} Access counts by "packageName:envVar"
 */
function getAccessStats() {
    const result = {};
    for (const [key, count] of accessCounts) {
        result[key] = count;
    }
    return result;
}

/**
 * Check if strict mode is currently enabled
 * @returns {boolean}
 */
function isEnabled() {
    return isInitialized;
}

module.exports = {
    enableStrictEnv,
    disableStrictEnv,
    getAccessStats,
    isEnabled
};
