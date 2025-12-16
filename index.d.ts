/**
 * Options for enableStrictEnv
 */
export interface StrictEnvOptions {
    /**
     * Custom path to package.json containing environmentWhitelist config.
     * If not specified, searches for package.json from current working directory.
     */
    configPath?: string;

    /**
     * Suppress security warnings on startup.
     */
    suppressWarnings?: boolean;

    /**
     * Show all warnings including info level (e.g., LD_PRELOAD status).
     */
    verbose?: boolean;

    /**
     * Allow enabling dotnope in worker threads.
     * Required when calling enableStrictEnv() from a worker.
     */
    allowInWorker?: boolean;

    /**
     * Config passed from main thread to worker threads.
     * Use with getSerializableConfig() in the main thread.
     */
    workerConfig?: object;

    /**
     * If false, disable strict load order checking.
     * When true (default), throws if too many modules are loaded before enableStrictEnv().
     */
    strictLoadOrder?: boolean;

    /**
     * Maximum number of modules allowed to be loaded before enableStrictEnv().
     * Default is 5. Only applies if strictLoadOrder is true.
     */
    maxPreloadedModules?: number;
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
 * Error codes thrown by dotnope
 */
export type DotnopeErrorCode =
    | 'ERR_DOTNOPE_UNAUTHORIZED'
    | 'ERR_DOTNOPE_UNKNOWN_CALLER'
    | 'ERR_DOTNOPE_EVAL_CONTEXT'
    | 'ERR_DOTNOPE_LOAD_ORDER'
    | 'ERR_DOTNOPE_WORKER_NOT_ALLOWED'
    | 'ERR_DOTNOPE_DEPRECATED';

/**
 * Error thrown when unauthorized environment access is detected
 */
export interface StrictEnvError extends Error {
    code: DotnopeErrorCode;
    packageName?: string;
    envVar?: string;
    operation?: 'read' | 'write' | 'delete';
    fileName?: string;
    lineNumber?: number;
    functionName?: string;
    loadedModules?: number;
    maxPreloadedModules?: number;
}

/**
 * Options for emitSecurityWarnings
 */
export interface SecurityWarningsOptions {
    /**
     * Force re-emission of warnings even if already emitted.
     */
    forceWarnings?: boolean;

    /**
     * Suppress all warnings.
     */
    suppressWarnings?: boolean;

    /**
     * Show info-level warnings (e.g., LD_PRELOAD status).
     */
    verbose?: boolean;
}

/**
 * Security warning object returned by emitSecurityWarnings
 */
export interface SecurityWarning {
    level: 'error' | 'warn' | 'info';
    message: string;
    detail?: string;
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
 * This function throws ERR_DOTNOPE_DEPRECATED.
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

/**
 * Check if LD_PRELOAD protection is active.
 * This provides protection against native addons calling getenv() directly.
 *
 * @returns true if LD_PRELOAD library is loaded
 */
export function isPreloadActive(): boolean;

/**
 * Emit security warnings about the current configuration.
 * Warns about missing native addon, stack tampering, LD_PRELOAD status, etc.
 *
 * @param options - Options for warning emission
 * @returns Array of warning objects that were checked
 */
export function emitSecurityWarnings(options?: SecurityWarningsOptions): SecurityWarning[];

/**
 * Check if running in the main thread (vs worker thread).
 *
 * @returns true if in main thread, false if in worker
 */
export function isRunningInMainThread(): boolean;

/**
 * Check if worker thread usage is allowed.
 * Returns true if enableStrictEnv was called with allowInWorker: true.
 *
 * @returns true if workers are allowed
 */
export function isWorkerAllowed(): boolean;

/**
 * Get a serializable copy of the current configuration.
 * Use this to pass config from main thread to worker threads.
 *
 * @returns Serializable config object to pass via workerData
 *
 * @example
 * ```javascript
 * // Main thread
 * const dotnope = require('dotnope');
 * dotnope.enableStrictEnv();
 * const config = dotnope.getSerializableConfig();
 *
 * const worker = new Worker('./worker.js', {
 *   workerData: { dotnopeConfig: config }
 * });
 *
 * // Worker thread (worker.js)
 * const { workerData } = require('worker_threads');
 * const dotnope = require('dotnope');
 * dotnope.enableStrictEnv({
 *   allowInWorker: true,
 *   workerConfig: workerData.dotnopeConfig
 * });
 * ```
 */
export function getSerializableConfig(): object;

declare const _default: {
    enableStrictEnv: typeof enableStrictEnv;
    disableStrictEnv: typeof disableStrictEnv;
    getAccessStats: typeof getAccessStats;
    isEnabled: typeof isEnabled;
    isPreloadActive: typeof isPreloadActive;
    emitSecurityWarnings: typeof emitSecurityWarnings;
    isRunningInMainThread: typeof isRunningInMainThread;
    isWorkerAllowed: typeof isWorkerAllowed;
    getSerializableConfig: typeof getSerializableConfig;
};

export default _default;
