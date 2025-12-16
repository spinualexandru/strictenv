/**
 * promise_hooks.cc - V8 Promise hooks implementation
 *
 * Uses V8's SetPromiseHook to track promise lifecycle and maintain
 * attribution across async boundaries.
 */

#include "promise_hooks.h"
#include "stack_trace.h"
#include <v8.h>
#include <map>
#include <mutex>
#include <string>

namespace dotnope {
namespace PromiseHooks {

// Thread-safe storage for promise attribution
static std::mutex g_mutex;
static std::map<void*, std::string> g_promiseOrigins;
static bool g_enabled = false;

// Current async context (thread-local would be better but this is simpler)
static thread_local std::string g_currentContext = "__main__";

/**
 * V8 Promise hook callback
 *
 * Called for each promise lifecycle event:
 * - kInit: Promise created
 * - kResolve: Promise resolved
 * - kBefore: About to execute promise handler
 * - kAfter: Finished executing promise handler
 */
static void PromiseHookCallback(
    v8::PromiseHookType type,
    v8::Local<v8::Promise> promise,
    v8::Local<v8::Value> parent
) {
    v8::Isolate* isolate = v8::Isolate::GetCurrent();
    if (!isolate) return;

    void* promiseId = *promise;

    switch (type) {
        case v8::PromiseHookType::kInit: {
            // Promise created - capture the creating context
            std::string origin;

            // If there's a parent promise, inherit its origin
            if (!parent.IsEmpty() && parent->IsPromise()) {
                void* parentId = *v8::Local<v8::Promise>::Cast(parent);
                std::lock_guard<std::mutex> lock(g_mutex);
                auto it = g_promiseOrigins.find(parentId);
                if (it != g_promiseOrigins.end()) {
                    origin = it->second;
                }
            }

            // If no inherited origin, capture from stack
            if (origin.empty()) {
                v8::Local<v8::StackTrace> stack = v8::StackTrace::CurrentStackTrace(
                    isolate, 10, v8::StackTrace::kScriptName
                );

                if (!stack.IsEmpty() && stack->GetFrameCount() > 0) {
                    for (int i = 0; i < stack->GetFrameCount(); ++i) {
                        v8::Local<v8::StackFrame> frame = stack->GetFrame(isolate, i);
                        if (frame.IsEmpty()) continue;

                        v8::Local<v8::String> scriptNameV8 = frame->GetScriptName();
                        if (scriptNameV8.IsEmpty()) continue;

                        // Cast to Local<Value> for newer V8 API compatibility
                        v8::Local<v8::Value> scriptNameVal = scriptNameV8.template As<v8::Value>();
                        v8::String::Utf8Value utf8(isolate, scriptNameVal);
                        if (!*utf8) continue;

                        std::string scriptName(*utf8);

                        // Skip internal Node.js and dotnope files
                        if (scriptName.rfind("node:", 0) == 0) continue;
                        if (scriptName.rfind("internal/", 0) == 0) continue;
                        if (scriptName.find("dotnope/") != std::string::npos) continue;

                        // Found the origin
                        origin = StackTrace::ExtractPackageName(scriptName);
                        break;
                    }
                }
            }

            if (origin.empty()) {
                origin = "__main__";
            }

            // Store the origin
            {
                std::lock_guard<std::mutex> lock(g_mutex);
                g_promiseOrigins[promiseId] = origin;
            }
            break;
        }

        case v8::PromiseHookType::kBefore: {
            // About to run promise handler - set context
            std::lock_guard<std::mutex> lock(g_mutex);
            auto it = g_promiseOrigins.find(promiseId);
            if (it != g_promiseOrigins.end()) {
                g_currentContext = it->second;
            }
            break;
        }

        case v8::PromiseHookType::kAfter: {
            // Finished running promise handler - restore context
            g_currentContext = "__main__";
            break;
        }

        case v8::PromiseHookType::kResolve: {
            // Promise resolved - cleanup (optional, could keep for chaining)
            // For now we keep the origin for potential child promises
            break;
        }
    }
}

/**
 * Enable promise hooks
 */
Napi::Value Enable(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (g_enabled) {
        return Napi::Boolean::New(env, true);
    }

    v8::Isolate* isolate = v8::Isolate::GetCurrent();
    if (!isolate) {
        return Napi::Boolean::New(env, false);
    }

    isolate->SetPromiseHook(PromiseHookCallback);
    g_enabled = true;

    return Napi::Boolean::New(env, true);
}

/**
 * Disable promise hooks (CallbackInfo version)
 */
Napi::Value Disable(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    DisableInternal(env);
    return Napi::Boolean::New(env, true);
}

/**
 * Disable promise hooks (internal cleanup version)
 */
void DisableInternal(Napi::Env env) {
    if (!g_enabled) {
        return;
    }

    v8::Isolate* isolate = v8::Isolate::GetCurrent();
    if (isolate) {
        isolate->SetPromiseHook(nullptr);
    }

    // Clear stored origins
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_promiseOrigins.clear();
    }

    g_enabled = false;
    g_currentContext = "__main__";
}

/**
 * Get the async context for current execution
 */
Napi::Value GetAsyncContext(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!g_enabled) {
        return env.Null();
    }

    return Napi::String::New(env, g_currentContext);
}

/**
 * Check if promise hooks are enabled
 */
bool IsEnabled() {
    return g_enabled;
}

} // namespace PromiseHooks
} // namespace dotnope
