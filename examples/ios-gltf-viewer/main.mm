/**
 * iOS GLTF Viewer - Main Entry Point
 *
 * This demonstrates embedding the Mystral Native Runtime in an iOS app.
 * Uses SDL3 for Metal surface management and the mystral-runtime library
 * for WebGPU rendering via wgpu-native.
 *
 * Assets:
 * - DamagedHelmet.glb - The GLTF model to display
 * - sunny_rose_garden_2k.hdr - HDR environment map for IBL
 * - gltf-viewer.js - JavaScript code that handles rendering
 */

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// SDL3 main entry point handling for iOS
// This header provides the main() function that calls SDL_RunApp()
// and renames our main() to SDL_main() via macro
#include <SDL3/SDL_main.h>

#include "mystral/runtime.h"
#include <fstream>
#include <sstream>
#include <cstdio>  // For fprintf

// Early debug logging (writes to stderr immediately, before any ObjC setup)
#define DEBUG_LOG(fmt, ...) do { \
    fprintf(stderr, "[MystralGLTF] " fmt "\n", ##__VA_ARGS__); \
    fflush(stderr); \
} while(0)

// Read file contents from the app bundle
static std::string readBundleFile(NSString* filename) {
    NSBundle* bundle = [NSBundle mainBundle];
    NSString* path = [bundle pathForResource:[filename stringByDeletingPathExtension]
                                      ofType:[filename pathExtension]];
    if (!path) {
        NSLog(@"Could not find %@ in bundle", filename);
        return "";
    }

    NSString* contents = [NSString stringWithContentsOfFile:path
                                                   encoding:NSUTF8StringEncoding
                                                      error:nil];
    if (!contents) {
        NSLog(@"Could not read %@", filename);
        return "";
    }

    return std::string([contents UTF8String]);
}

// Get path to asset in bundle
static std::string getBundleAssetPath(NSString* filename) {
    NSBundle* bundle = [NSBundle mainBundle];
    NSString* path = [bundle pathForResource:[filename stringByDeletingPathExtension]
                                      ofType:[filename pathExtension]];
    if (!path) {
        NSLog(@"Could not find %@ in bundle", filename);
        return "";
    }
    return std::string([path UTF8String]);
}

// Main function - SDL_main.h renames this to SDL_main via macro
// and provides the actual main() that calls SDL_RunApp()
int main(int argc, char *argv[]) {
    DEBUG_LOG("SDL_main entry - argc=%d", argc);

    @autoreleasepool {
        DEBUG_LOG("Entered @autoreleasepool");
        NSLog(@"=== Mystral iOS GLTF Viewer ===");
        DEBUG_LOG("After first NSLog");
        NSLog(@"Version: %s", mystral::getVersion());
        DEBUG_LOG("Version: %s", mystral::getVersion());

        // Get screen size for the runtime config
        CGRect screenBounds = [[UIScreen mainScreen] bounds];
        CGFloat scale = [[UIScreen mainScreen] scale];
        int width = (int)(screenBounds.size.width * scale);
        int height = (int)(screenBounds.size.height * scale);

        NSLog(@"Screen: %dx%d (scale: %.1f)", width, height, scale);
        DEBUG_LOG("Screen: %dx%d (scale: %.1f)", width, height, scale);

        // Configure the runtime
        DEBUG_LOG("Creating RuntimeConfig...");
        mystral::RuntimeConfig config;
        config.width = width;
        config.height = height;
        config.title = "GLTF Viewer";
        config.fullscreen = true;  // iOS apps are fullscreen
        config.vsync = true;
        DEBUG_LOG("RuntimeConfig ready, calling Runtime::create()...");

        // Create the runtime
        auto runtime = mystral::Runtime::create(config);
        DEBUG_LOG("Runtime::create() returned %s", runtime ? "success" : "NULL");
        if (!runtime) {
            DEBUG_LOG("FAILED to create runtime!");
            NSLog(@"Failed to create runtime!");
            return 1;
        }

        DEBUG_LOG("Runtime created successfully");
        NSLog(@"Runtime created successfully");

        // Get asset paths
        std::string gltfPath = getBundleAssetPath(@"DamagedHelmet.glb");
        std::string envMapPath = getBundleAssetPath(@"sunny_rose_garden_2k.hdr");

        if (gltfPath.empty() || envMapPath.empty()) {
            NSLog(@"Missing assets! Make sure DamagedHelmet.glb and sunny_rose_garden_2k.hdr are in the bundle.");
            return 1;
        }

        NSLog(@"GLTF path: %s", gltfPath.c_str());
        NSLog(@"Environment map path: %s", envMapPath.c_str());
        DEBUG_LOG("GLTF path: %s", gltfPath.c_str());
        DEBUG_LOG("Env map path: %s", envMapPath.c_str());

        // Set global paths for the JavaScript code
        DEBUG_LOG("Setting up asset path globals...");
        std::string setupCode = R"(
            globalThis.__GLTF_PATH__ = ")" + gltfPath + R"(";
            globalThis.__ENV_MAP_PATH__ = ")" + envMapPath + R"(";
            console.log("Asset paths configured");
        )";

        if (!runtime->evalScript(setupCode, "setup.js")) {
            DEBUG_LOG("FAILED to set up asset paths!");
            NSLog(@"Failed to set up asset paths!");
            return 1;
        }
        DEBUG_LOG("Asset path globals set successfully");

        // Load and run the main JavaScript code
        DEBUG_LOG("Loading gltf-viewer.js...");
        std::string jsCode = readBundleFile(@"gltf-viewer.js");
        if (jsCode.empty()) {
            DEBUG_LOG("FAILED to load gltf-viewer.js!");
            NSLog(@"Failed to load gltf-viewer.js from bundle!");
            return 1;
        }

        NSLog(@"Loaded JavaScript: %lu bytes", jsCode.length());
        DEBUG_LOG("Loaded JavaScript: %lu bytes", jsCode.length());

        DEBUG_LOG("Evaluating gltf-viewer.js...");
        if (!runtime->evalScript(jsCode, "gltf-viewer.js")) {
            DEBUG_LOG("FAILED to evaluate JavaScript!");
            NSLog(@"Failed to evaluate JavaScript!");
            return 1;
        }

        DEBUG_LOG("JavaScript evaluated successfully");
        NSLog(@"JavaScript loaded, starting main loop");
        DEBUG_LOG("Starting main loop...");

        // Run the main loop - this blocks until quit
        runtime->run();

        DEBUG_LOG("Main loop exited");
        NSLog(@"=== Application finished ===");
        return 0;
    }
}
