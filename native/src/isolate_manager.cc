/**
 * isolate_manager.cc - V8 Isolate management implementation
 */

#include "isolate_manager.h"
#include <v8.h>
#include <set>
#include <mutex>

namespace dotnope {
namespace IsolateManager {

// Thread-safe set of registered isolates
static std::mutex g_mutex;
static std::set<v8::Isolate*> g_isolates;

// Track the main isolate (first one registered)
static v8::Isolate* g_mainIsolate = nullptr;

/**
 * Register the current isolate
 */
void RegisterIsolate() {
    v8::Isolate* isolate = v8::Isolate::GetCurrent();
    if (!isolate) return;

    std::lock_guard<std::mutex> lock(g_mutex);

    // Track the main isolate
    if (g_mainIsolate == nullptr) {
        g_mainIsolate = isolate;
    }

    g_isolates.insert(isolate);
}

/**
 * Unregister the current isolate
 */
void UnregisterIsolate() {
    v8::Isolate* isolate = v8::Isolate::GetCurrent();
    if (!isolate) return;

    std::lock_guard<std::mutex> lock(g_mutex);
    g_isolates.erase(isolate);

    // Don't clear g_mainIsolate as it might still be valid
}

/**
 * Get the number of registered isolates
 */
Napi::Value GetIsolateCount(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(g_mutex);
    return Napi::Number::New(env, static_cast<double>(g_isolates.size()));
}

/**
 * Check if we're running in a worker thread
 *
 * Worker threads run in separate V8 isolates.
 * If the current isolate is not the main one, we're in a worker.
 */
bool IsWorkerThread() {
    v8::Isolate* current = v8::Isolate::GetCurrent();
    if (!current) return false;

    std::lock_guard<std::mutex> lock(g_mutex);

    // If we haven't registered any isolates yet, assume main thread
    if (g_mainIsolate == nullptr) {
        return false;
    }

    return current != g_mainIsolate;
}

} // namespace IsolateManager
} // namespace dotnope
