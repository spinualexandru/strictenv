'use strict';

const crypto = require('crypto');
const { createEnvProxy, enable, disable, restore, setFilterKeysFn } = require('./proxy');
const { getCallingPackage } = require('./stack-parser');
const { loadConfig, getConfig, getOptions, clearCache: clearConfigCache } = require('./config-loader');
const { isPackageAllowed, clearCache: clearDepCache } = require('./dependency-resolver');

let isInitialized = false;
let disableToken = null;

// Access tracking: "packageName:envVar" -> count
const accessCounts = new Map();

/**
 * Check if a package is allowed to access an environment variable
 * Throws an error if access is denied
 * @param {string} envVar - The environment variable being accessed
 * @param {string} operation - The operation type: 'read', 'write', or 'delete'
 */
function checkAccess(envVar, operation = 'read') {
    // Get the caller info - isInternalFile check handles skipping strictenv frames
    const callerInfo = getCallingPackage(0);
    const options = getOptions();

    if (!callerInfo) {
        // Cannot determine caller - this can happen in some edge cases
        // Fail-closed by default (configurable)
        if (options.failClosed) {
            const error = new Error(
                `dotnope: Unable to identify calling package!\n` +
                `\n` +
                `  Attempted to ${operation}: "${envVar}"\n` +
                `  Caller could not be determined from stack trace.\n` +
                `\n` +
                `This may happen with eval(), async contexts, or native addons.\n` +
                `To allow unknown callers (less secure), add to your package.json:\n` +
                `\n` +
                `  "environmentWhitelist": {\n` +
                `    "__options__": {\n` +
                `      "failClosed": false\n` +
                `    }\n` +
                `  }\n`
            );
            error.code = 'ERR_DOTNOPE_UNKNOWN_CALLER';
            error.envVar = envVar;
            error.operation = operation;
            throw error;
        }
        return;
    }

    const { packageName, fileName, lineNumber, functionName } = callerInfo;

    // Main application always has access
    if (packageName === '__main__') {
        return;
    }

    const config = getConfig();

    // Track access
    const trackingKey = `${packageName}:${envVar}:${operation}`;
    accessCounts.set(trackingKey, (accessCounts.get(trackingKey) || 0) + 1);

    // Check if access is allowed based on operation type
    let isAllowed = false;
    let configKey = 'allowed';

    if (operation === 'read') {
        isAllowed = isPackageAllowed(packageName, envVar, config);
        configKey = 'allowed';
    } else if (operation === 'write') {
        isAllowed = isPackageAllowedForOperation(packageName, envVar, config, 'canWrite');
        configKey = 'canWrite';
    } else if (operation === 'delete') {
        isAllowed = isPackageAllowedForOperation(packageName, envVar, config, 'canDelete');
        configKey = 'canDelete';
    }

    if (!isAllowed) {
        const operationVerb = operation === 'read' ? 'read' : operation === 'write' ? 'write to' : 'delete';
        const error = new Error(
            `dotnope: Unauthorized environment variable ${operation}!\n` +
            `\n` +
            `  Package: "${packageName}"\n` +
            `  Attempted to ${operationVerb}: "${envVar}"\n` +
            `  Location: ${fileName}:${lineNumber}\n` +
            `  Function: ${functionName}\n` +
            `\n` +
            `To allow this access, add to your package.json:\n` +
            `\n` +
            `  "environmentWhitelist": {\n` +
            `    "${packageName}": {\n` +
            `      "${configKey}": ["${envVar}"]\n` +
            `    }\n` +
            `  }\n`
        );

        error.code = 'ERR_DOTNOPE_UNAUTHORIZED';
        error.packageName = packageName;
        error.envVar = envVar;
        error.operation = operation;
        error.fileName = fileName;
        error.lineNumber = lineNumber;
        error.functionName = functionName;

        throw error;
    }
}

/**
 * Check if a package is allowed for write/delete operations
 * @param {string} packageName
 * @param {string} envVar
 * @param {Object} config
 * @param {string} operationKey - 'canWrite' or 'canDelete'
 * @returns {boolean}
 */
function isPackageAllowedForOperation(packageName, envVar, config, operationKey) {
    // Main application always has access
    if (packageName === '__main__') {
        return true;
    }

    const packageConfig = config[packageName];
    if (!packageConfig) {
        return false;
    }

    const allowedVars = packageConfig[operationKey] || [];
    return allowedVars.includes(envVar) || allowedVars.includes('*');
}

/**
 * Filter ownKeys results based on caller's allowed env vars
 * @param {Array} allKeys - All environment variable keys
 * @returns {Array|null} Filtered keys or null to skip filtering
 */
function filterKeys(allKeys) {
    const callerInfo = getCallingPackage(0);

    // Can't determine caller - return null to skip filtering
    if (!callerInfo) {
        const options = getOptions();
        // If fail-closed, return empty array (no keys visible)
        // If fail-open, return all keys
        return options.failClosed ? [] : null;
    }

    const { packageName } = callerInfo;

    // Main application sees everything
    if (packageName === '__main__') {
        return null; // Skip filtering
    }

    const config = getConfig();
    const packageConfig = config[packageName];

    // Package not in whitelist - sees nothing
    if (!packageConfig) {
        return [];
    }

    // Package has wildcard access - sees everything
    if (packageConfig.allowed.includes('*')) {
        return null; // Skip filtering
    }

    // Filter to only allowed keys (keep symbols and non-string keys)
    return allKeys.filter(key => {
        if (typeof key !== 'string') {
            return true; // Keep symbols
        }
        return packageConfig.allowed.includes(key);
    });
}

/**
 * Enable strict environment variable access control
 * @param {Object} options - Configuration options
 * @param {string} [options.configPath] - Custom path to package.json
 * @returns {Object} Handle with token-protected disable() and getAccessStats() methods
 */
function enableStrictEnv(options = {}) {
    if (isInitialized) {
        console.warn('dotnope: Already enabled');
        // Return a handle with the existing token
        return createHandle();
    }

    // Generate a cryptographically secure token for disable protection
    disableToken = crypto.randomBytes(32).toString('hex');

    // Load configuration from package.json
    loadConfig(options.configPath);

    // Create and activate the proxy with options
    const configOptions = getOptions();
    createEnvProxy(checkAccess, configOptions);

    // Set up enumeration filtering if enabled
    if (configOptions.protectEnumeration) {
        setFilterKeysFn(filterKeys);
    }

    enable();

    isInitialized = true;

    return createHandle();
}

/**
 * Create a secure handle with token-protected disable
 * @returns {Object} Handle with disable() and getAccessStats() methods
 */
function createHandle() {
    const token = disableToken;

    return {
        /**
         * Disable strict environment variable access control
         * @param {string} providedToken - The token returned from enableStrictEnv
         */
        disable: (providedToken) => {
            if (providedToken !== token) {
                throw new Error(
                    'dotnope: Invalid disable token!\n' +
                    '\n' +
                    'You must use the token returned from enableStrictEnv() to disable.\n' +
                    'This prevents malicious packages from disabling protection.\n' +
                    '\n' +
                    'Example:\n' +
                    '  const handle = enableStrictEnv();\n' +
                    '  // Later:\n' +
                    '  handle.disable(token);  // Must pass the correct token\n'
                );
            }
            disableStrictEnvInternal();
        },
        /**
         * Get access statistics
         * @returns {Object} Access counts by "packageName:envVar:operation"
         */
        getAccessStats: getAccessStats,
        /**
         * Get the disable token (store securely!)
         * @returns {string} The token required to disable protection
         */
        getToken: () => token
    };
}

/**
 * Internal: Disable strict environment variable access control
 * Called only with valid token via handle.disable()
 */
function disableStrictEnvInternal() {
    disable();
    restore();
    isInitialized = false;
    disableToken = null;

    // Clear caches
    clearConfigCache();
    clearDepCache();
    accessCounts.clear();
}

/**
 * Disable strict environment variable access control
 * @deprecated Use handle.disable(token) instead for security
 */
function disableStrictEnv() {
    console.warn(
        'dotnope: disableStrictEnv() is deprecated!\n' +
        '\n' +
        'For security, use the token-protected disable:\n' +
        '  const handle = enableStrictEnv();\n' +
        '  const token = handle.getToken();\n' +
        '  // Later:\n' +
        '  handle.disable(token);\n' +
        '\n' +
        'Direct disableStrictEnv() will be removed in a future version.'
    );
    disableStrictEnvInternal();
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
