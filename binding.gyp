{
    "targets": [{
        "target_name": "dotnope_native",
        "sources": [
            "native/src/dotnope_native.cc",
            "native/src/stack_trace.cc",
            "native/src/promise_hooks.cc",
            "native/src/isolate_manager.cc"
        ],
        "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")",
            "native/src"
        ],
        "dependencies": [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        "cflags!": ["-fno-exceptions"],
        "cflags_cc!": ["-fno-exceptions"],
        "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.14"
        },
        "msvs_settings": {
            "VCCLCompilerTool": {
                "ExceptionHandling": 1
            }
        },
        "defines": [
            "NAPI_VERSION=8",
            "NODE_ADDON_API_DISABLE_DEPRECATED"
        ],
        "conditions": [
            ["OS=='linux'", {
                "cflags_cc": [
                    "-std=c++20",
                    "-fPIC"
                ]
            }],
            ["OS=='mac'", {
                "xcode_settings": {
                    "OTHER_CPLUSPLUSFLAGS": ["-std=c++20"]
                }
            }],
            ["OS=='win'", {
                "msvs_settings": {
                    "VCCLCompilerTool": {
                        "AdditionalOptions": ["/std:c++20"]
                    }
                }
            }]
        ]
    }]
}
