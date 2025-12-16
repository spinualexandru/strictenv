/**
 * dotnope_preload.c - LD_PRELOAD library for libc getenv interposition
 *
 * This library intercepts getenv/setenv/unsetenv calls from native code,
 * allowing dotnope to control environment variable access even from
 * C/C++ native addons.
 *
 * Usage:
 *   LD_PRELOAD=/path/to/libdotnope_preload.so node app.js
 *
 * Configuration is read from DOTNOPE_POLICY environment variable or
 * from a Unix domain socket for dynamic policy updates.
 */

/* _GNU_SOURCE is defined via CFLAGS in Makefile */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <dlfcn.h>
#include <pthread.h>
#include <errno.h>

/* Original libc functions */
static char* (*real_getenv)(const char*) = NULL;
static int (*real_setenv)(const char*, const char*, int) = NULL;
static int (*real_unsetenv)(const char*) = NULL;

/* Thread-safe initialization */
static pthread_once_t init_once = PTHREAD_ONCE_INIT;
static pthread_mutex_t policy_mutex = PTHREAD_MUTEX_INITIALIZER;

/* Simple allow list (expandable via shared memory or socket) */
#define MAX_ALLOWED_VARS 256
static char* allowed_vars[MAX_ALLOWED_VARS];
static int allowed_count = 0;
static int policy_loaded = 0;

/* Logging */
static int log_enabled = 0;
static FILE* log_file = NULL;

/**
 * Log an access attempt
 */
static void log_access(const char* op, const char* name, int allowed) {
    if (!log_enabled || !log_file) return;

    fprintf(log_file, "[dotnope_preload] %s %s: %s\n",
            op, name, allowed ? "ALLOWED" : "BLOCKED");
    fflush(log_file);
}

/**
 * Load policy from environment variable or file
 * Format: comma-separated list of allowed variables, or "*" for all
 */
static void load_policy(void) {
    if (policy_loaded) return;

    pthread_mutex_lock(&policy_mutex);

    if (policy_loaded) {
        pthread_mutex_unlock(&policy_mutex);
        return;
    }

    /* Check for logging */
    const char* log_env = real_getenv ? real_getenv("DOTNOPE_LOG") : getenv("DOTNOPE_LOG");
    if (log_env && *log_env) {
        log_enabled = 1;
        if (strcmp(log_env, "1") == 0 || strcmp(log_env, "stderr") == 0) {
            log_file = stderr;
        } else {
            log_file = fopen(log_env, "a");
            if (!log_file) log_file = stderr;
        }
    }

    /* Get policy */
    const char* policy = real_getenv ? real_getenv("DOTNOPE_POLICY") : getenv("DOTNOPE_POLICY");

    if (!policy || !*policy) {
        /* No policy - allow all (for compatibility) */
        allowed_vars[0] = strdup("*");
        allowed_count = 1;
        policy_loaded = 1;
        pthread_mutex_unlock(&policy_mutex);
        return;
    }

    /* Parse policy */
    char* policy_copy = strdup(policy);
    char* token = strtok(policy_copy, ",");

    while (token && allowed_count < MAX_ALLOWED_VARS) {
        /* Trim whitespace */
        while (*token == ' ') token++;
        char* end = token + strlen(token) - 1;
        while (end > token && *end == ' ') *end-- = '\0';

        if (*token) {
            allowed_vars[allowed_count++] = strdup(token);
        }
        token = strtok(NULL, ",");
    }

    free(policy_copy);
    policy_loaded = 1;

    if (log_enabled) {
        fprintf(log_file, "[dotnope_preload] Loaded policy with %d allowed vars\n", allowed_count);
        fflush(log_file);
    }

    pthread_mutex_unlock(&policy_mutex);
}

/**
 * Check if a variable is allowed
 */
static int is_allowed(const char* name) {
    if (!policy_loaded) {
        load_policy();
    }

    /* Always allow some essential variables */
    if (strcmp(name, "PATH") == 0 ||
        strcmp(name, "HOME") == 0 ||
        strcmp(name, "USER") == 0 ||
        strcmp(name, "SHELL") == 0 ||
        strcmp(name, "TERM") == 0 ||
        strcmp(name, "LANG") == 0 ||
        strcmp(name, "LC_ALL") == 0 ||
        strncmp(name, "DOTNOPE_", 8) == 0) {
        return 1;
    }

    pthread_mutex_lock(&policy_mutex);

    for (int i = 0; i < allowed_count; i++) {
        if (strcmp(allowed_vars[i], "*") == 0) {
            pthread_mutex_unlock(&policy_mutex);
            return 1;
        }
        if (strcmp(allowed_vars[i], name) == 0) {
            pthread_mutex_unlock(&policy_mutex);
            return 1;
        }
    }

    pthread_mutex_unlock(&policy_mutex);
    return 0;
}

/**
 * Initialize by loading real libc functions
 */
static void init_real_functions(void) {
    real_getenv = dlsym(RTLD_NEXT, "getenv");
    real_setenv = dlsym(RTLD_NEXT, "setenv");
    real_unsetenv = dlsym(RTLD_NEXT, "unsetenv");

    if (!real_getenv || !real_setenv || !real_unsetenv) {
        fprintf(stderr, "[dotnope_preload] Failed to load libc functions\n");
        _exit(1);
    }

    load_policy();
}

/**
 * Hooked getenv
 */
char* getenv(const char* name) {
    pthread_once(&init_once, init_real_functions);

    if (!name) return NULL;

    int allowed = is_allowed(name);
    log_access("getenv", name, allowed);

    if (!allowed) {
        return NULL;
    }

    return real_getenv(name);
}

/**
 * Hooked setenv
 */
int setenv(const char* name, const char* value, int overwrite) {
    pthread_once(&init_once, init_real_functions);

    if (!name) {
        errno = EINVAL;
        return -1;
    }

    int allowed = is_allowed(name);
    log_access("setenv", name, allowed);

    if (!allowed) {
        errno = EPERM;
        return -1;
    }

    return real_setenv(name, value, overwrite);
}

/**
 * Hooked unsetenv
 */
int unsetenv(const char* name) {
    pthread_once(&init_once, init_real_functions);

    if (!name) {
        errno = EINVAL;
        return -1;
    }

    int allowed = is_allowed(name);
    log_access("unsetenv", name, allowed);

    if (!allowed) {
        errno = EPERM;
        return -1;
    }

    return real_unsetenv(name);
}

/**
 * Constructor - called when library is loaded
 */
__attribute__((constructor))
static void dotnope_preload_init(void) {
    pthread_once(&init_once, init_real_functions);
}

/**
 * Destructor - cleanup when library is unloaded
 */
__attribute__((destructor))
static void dotnope_preload_cleanup(void) {
    pthread_mutex_lock(&policy_mutex);

    for (int i = 0; i < allowed_count; i++) {
        free(allowed_vars[i]);
        allowed_vars[i] = NULL;
    }
    allowed_count = 0;

    if (log_file && log_file != stderr) {
        fclose(log_file);
    }

    pthread_mutex_unlock(&policy_mutex);
}
