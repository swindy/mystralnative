# MystralNative v1.0 - Three.js Compatibility Work

This document tracks the progress on getting Three.js WebGPU renderer working in MystralNative.

---

## Status: WORKING

Three.js WebGPU renderer now initializes and renders correctly. The spinning green cube demo works with proper lighting and background color.

---

## Fixes Applied

### 1. `device.lost` Promise (bindings.cpp)

**Problem:** Three.js calls `device.lost.then(...)` during init. Without this Promise, init would hang indefinitely.

**Fix:** Added a Promise that never resolves (device never lost in normal operation):
```cpp
auto deviceLostPromise = g_engine->evalWithResult(
    "new Promise(function(resolve) { globalThis.__mystral_device_lost_resolve = resolve; })",
    "device.lost"
);
g_engine->setProperty(device, "lost", deviceLostPromise);
```

**Location:** `src/webgpu/bindings.cpp` around line 3315

---

### 2. `pushErrorScope` / `popErrorScope` (bindings.cpp)

**Problem:** Three.js uses these for error handling during pipeline creation. Without them, we get `device.pushErrorScope is not a function` errors.

**Fix:** Added both methods to the device object:
```cpp
g_engine->setProperty(device, "pushErrorScope",
    g_engine->newFunction("pushErrorScope", [](void* ctx, const std::vector<js::JSValueHandle>& args) {
        // No-op - Dawn reports errors via callback
        return g_engine->newUndefined();
    })
);

g_engine->setProperty(device, "popErrorScope",
    g_engine->newFunction("popErrorScope", [](void* ctx, const std::vector<js::JSValueHandle>& args) {
        // Return Promise that resolves to null (no error)
        // IMPORTANT: Must use evalScriptWithResult, not evalWithResult!
        // evalWithResult uses module mode which returns module evaluation result, not expression value
        return g_engine->evalScriptWithResult("Promise.resolve(null)", "popErrorScope");
    })
);
```

**Critical Bug Found:** Originally used `evalWithResult` which uses ES module evaluation mode. In module mode, `Promise.resolve(null)` returns a module evaluation promise that resolves to `undefined`, not the actual `Promise.resolve(null)` value. This caused Three.js to incorrectly detect pipeline errors (since `undefined !== null` is true) and skip rendering after the first frame.

**Solution:** Use `evalScriptWithResult` instead, which uses script evaluation mode and returns the actual expression value.

**Location:** `src/webgpu/bindings.cpp` around line 3275

---

### 3. `self` Global (runtime.cpp)

**Problem:** Three.js Animation class checks `typeof self !== "undefined"` and uses `self.requestAnimationFrame()`. Without `self`, the animation system fails silently causing init to hang.

**Fix:** Added `self` to point to the global object:
```cpp
jsEngine_->setGlobalProperty("self", window);
```

**Location:** `src/runtime.cpp` around line 2968

---

### 4. BindGroupLayout Default Types (bindings.cpp)

**Problem:** Three.js passes empty objects like `{ buffer: {} }` to `createBindGroupLayout()`. Our bindings only set the type if explicitly specified, resulting in Dawn validation errors: "BindGroupLayoutEntry had none of buffer, sampler, texture, storageTexture..."

**Fix:** Default to appropriate types when not specified:
- `buffer: {}` → `WGPUBufferBindingType_Uniform`
- `sampler: {}` → `WGPUSamplerBindingType_Filtering`
- `texture: {}` → `WGPUTextureSampleType_Float`

**Location:** `src/webgpu/bindings.cpp` around line 2914

---

## How Three.js Rendering Works

Understanding the two-pass rendering pipeline:

1. **First Pass** (scene render):
   - `Background.update` is called with the scene's background color
   - `forceClear=true` is set for Color backgrounds
   - Scene is rendered to an intermediate render target texture
   - `WebGPUBackend.draw` called for scene objects (e.g., cube with 36 vertices)

2. **Second Pass** (output/composite):
   - `_renderOutput` is called to composite to screen
   - `autoClear=false` intentionally (intermediate texture already has content)
   - Full-screen quad (3 vertices) draws the render target to canvas
   - `loadOp=Load` is used (correct - we're compositing, not clearing)

The black screen issue was caused by `popErrorScope` returning `undefined` instead of `null`, which made Three.js think there was a pipeline validation error. This caused `pipelineData.error = true` to be set, and subsequent draw calls were skipped.

---

## Test Commands

```bash
# Build
cmake --build build --parallel

# Run Three.js example (visible window)
./build/mystral run examples/threejs-cube.js --frames 300

# Run with screenshot (headless)
./build/mystral run examples/threejs-cube.js --headless --frames 120 --screenshot /tmp/threejs.png

# Verify helmet still works
./build/mystral run examples/mystral-helmet.js --headless --frames 60 --screenshot /tmp/helmet.png
```

---

## Files Modified

- `src/webgpu/bindings.cpp` - WebGPU JavaScript bindings (popErrorScope fix)
- `src/runtime.cpp` - Runtime initialization (self global)
- `examples/internal/threejs-test/threejs-cube.ts` - Test file (bundled to examples/threejs-cube.js)

---

## Remaining Work

1. Clean up debug logging added to node_modules/three
2. Test more Three.js features (textures, post-processing, etc.)
3. Verify performance is acceptable
4. Test with other Three.js examples
