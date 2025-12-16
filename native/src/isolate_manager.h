/**
 * isolate_manager.h - V8 Isolate management for worker thread protection
 *
 * Tracks V8 isolates to ensure protection extends to worker threads.
 */

#ifndef DOTNOPE_ISOLATE_MANAGER_H
#define DOTNOPE_ISOLATE_MANAGER_H

#include <napi.h>

namespace dotnope {
namespace IsolateManager {

/**
 * Register the current isolate
 * Should be called when the native module loads
 */
void RegisterIsolate();

/**
 * Unregister the current isolate
 * Should be called during cleanup
 */
void UnregisterIsolate();

/**
 * Get the number of registered isolates
 */
Napi::Value GetIsolateCount(const Napi::CallbackInfo& info);

/**
 * Check if we're running in a worker thread
 */
bool IsWorkerThread();

} // namespace IsolateManager
} // namespace dotnope

#endif // DOTNOPE_ISOLATE_MANAGER_H
