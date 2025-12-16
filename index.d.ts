/**
 * Options for enableStrictEnv
 */
export interface StrictEnvOptions {
    /**
     * Custom path to package.json containing environmentWhitelist config.
     * If not specified, searches for package.json from current working directory.
     */
    configPath?: string;
}

/**
 * Handle returned by enableStrictEnv
 */
export interface StrictEnvHandle {
    /**
     * Disable strict environment checking and restore original process.env.
     * Requires the security token returned by getToken().
     *
     * @param token - The security token from getToken()
     * @throws Error if token is invalid
     */
    disable(token: string): void;

    /**
     * Get access statistics for environment variable operations.
     * Keys are in format "packageName:envVar:operation"
     */
    getAccessStats(): Record<string, number>;

    /**
     * Get the security token required to disable protection.
     * Store this securely - any code with this token can disable protection!
     */
    getToken(): string;
}

/**
 * Global options for dotnope behavior.
 * Add to environmentWhitelist under "__options__" key.
 */
export interface DotnopeGlobalOptions {
    /**
     * If true (default), throw error when caller cannot be identified.
     * If false, allow access when caller is unknown (less secure).
     */
    failClosed?: boolean;

    /**
     * If true (default), control write operations to process.env.
     * Packages must have "canWrite" permission to set env vars.
     */
    protectWrites?: boolean;

    /**
     * If true (default), control delete operations on process.env.
     * Packages must have "canDelete" permission to delete env vars.
     */
    protectDeletes?: boolean;

    /**
     * If true (default), filter Object.keys(process.env) results.
     * Packages only see env vars they have read permission for.
     */
    protectEnumeration?: boolean;
}

/**
 * Configuration for a single package's environment access
 */
export interface PackageEnvConfig {
    /**
     * List of allowed environment variable names for reading.
     * Use "*" to allow read access to all environment variables.
     */
    allowed: string[];

    /**
     * List of environment variable names the package can write/set.
     * Use "*" to allow write access to all environment variables.
     */
    canWrite?: string[];

    /**
     * List of environment variable names the package can delete.
     * Use "*" to allow delete access to all environment variables.
     */
    canDelete?: string[];

    /**
     * If true, all dependencies of this package are also allowed
     * to access the same environment variables (read only).
     */
    allowPeerDependencies?: boolean;
}

/**
 * Environment whitelist configuration.
 * Add this to your package.json under "environmentWhitelist" key.
 */
export interface EnvironmentWhitelistConfig {
    /**
     * Global options for dotnope behavior
     */
    __options__?: DotnopeGlobalOptions;

    /**
     * Package-specific environment access rules
     */
    [packageName: string]: PackageEnvConfig | string[] | DotnopeGlobalOptions;
}

/**
 * Error thrown when unauthorized environment access is detected
 */
export interface StrictEnvError extends Error {
    code: 'ERR_DOTNOPE_UNAUTHORIZED' | 'ERR_DOTNOPE_UNKNOWN_CALLER';
    packageName?: string;
    envVar: string;
    operation: 'read' | 'write' | 'delete';
    fileName?: string;
    lineNumber?: number;
    functionName?: string;
}

/**
 * Enable strict environment variable access control.
 *
 * When enabled, any package that tries to read an environment variable
 * must be explicitly whitelisted in your package.json's "environmentWhitelist"
 * configuration. Unauthorized access will throw an error with details about
 * which package attempted the access.
 *
 * By default (failClosed: true), access is denied when the calling package
 * cannot be determined (e.g., from eval, async contexts, native addons).
 *
 * IMPORTANT: Call this as early as possible in your application,
 * before other modules have a chance to read environment variables.
 *
 * @param options - Configuration options
 * @returns Handle with token-protected disable, stats, and token retrieval
 * @throws Error if package.json cannot be found or parsed
 *
 * @example
 * ```javascript
 * // In your app's entry point (must be first!)
 * const { enableStrictEnv } = require('dotnope');
 * const handle = enableStrictEnv();
 *
 * // Store the token securely for later disable
 * const token = handle.getToken();
 *
 * // Now load other modules
 * const express = require('express');
 *
 * // Later, to disable (requires token):
 * handle.disable(token);
 * ```
 *
 * @example
 * ```javascript
 * // package.json configuration:
 * {
 *   "environmentWhitelist": {
 *     "__options__": {
 *       "failClosed": true,
 *       "protectWrites": true
 *     },
 *     "dotenv": {
 *       "allowed": ["*"],
 *       "canWrite": ["*"]
 *     },
 *     "axios": {
 *       "allowed": ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"],
 *       "allowPeerDependencies": true
 *     }
 *   }
 * }
 * ```
 */
export function enableStrictEnv(options?: StrictEnvOptions): StrictEnvHandle;

/**
 * Disable strict environment variable access control.
 * Restores original process.env behavior and clears all caches.
 *
 * @deprecated Use handle.disable(token) instead for security.
 * Direct disableStrictEnv() will be removed in a future version.
 */
export function disableStrictEnv(): void;

/**
 * Get access statistics for environment variable operations.
 *
 * @returns Object mapping "packageName:envVar:operation" to access count
 */
export function getAccessStats(): Record<string, number>;

/**
 * Check if strict mode is currently enabled.
 *
 * @returns true if enableStrictEnv() has been called and not disabled
 */
export function isEnabled(): boolean;

declare const _default: {
    enableStrictEnv: typeof enableStrictEnv;
    disableStrictEnv: typeof disableStrictEnv;
    getAccessStats: typeof getAccessStats;
    isEnabled: typeof isEnabled;
};

export default _default;
