# Mystral Native Build Performance

Build performance metrics for the Mystral Native runtime on Apple M3 Max.

## Build Speed

### Mystral Native

| Build Type | Time |
|------------|------|
| Clean build (from scratch) | **~6 seconds** |
| Incremental build (1 file changed) | **~1 second** |
| CMake configure | **~1 second** |

### Comparison with Other Engines (M3 Max)

| Engine | Clean Build | Incremental | Mystral Speedup |
|--------|-------------|-------------|-----------------|
| **Mystral Native** | 6s | 1s | - |
| **Unreal Engine 5** | ~1 hour (3600s) | ~10s+ | **600x / 10x** |
| **Unity** | 5-15 min | 30s-2min | ~100x / 30x |
| **Godot** | 10-20 min | 10-30s | ~150x / 15x |

Mystral Native achieves these speeds by linking pre-built static libraries for heavy dependencies rather than compiling them from source.

## Binary Sizes

### Final Executable (Release, macOS arm64)

| Configuration | Uncompressed | Compressed (zip) |
|---------------|--------------|------------------|
| **Dawn + V8** | 37 MB | 9.9 MB |
| **Dawn + QuickJS** | 10 MB | 3.5 MB |
| **Dawn + JSC** | 10 MB | 3.5 MB |

QuickJS and JSC configurations compress to **under 4 MB** - remarkable for a full WebGPU 3D engine runtime.

### Comparison with Other Engines

| Engine | Uncompressed | Compressed | Notes |
|--------|--------------|------------|-------|
| **Mystral (Dawn + QuickJS)** | 10 MB | 3.5 MB | Full 3D, WebGPU, text rendering |
| **Mystral (Dawn + V8)** | 37 MB | 9.9 MB | Full 3D + JIT |
| **Bevy 0.15.3** (optimized) | 32-38 MB | 8.3 MB (web) | Rust ECS game engine |
| **Bevy 0.15.3** (unoptimized) | 52-80 MB | 11.7 MB (web) | Default build |
| **Godot** (default) | 93 MB | 30.6 MB | Full engine |
| **Godot** (minified) | 21 MB | 7.25 MB | **3D disabled**, text rendering limited |
| **Unity** (empty) | ~100+ MB | 30-50 MB | Mono runtime overhead |
| **Unreal Engine 5** (Win/Linux) | ~200 MB | - | Empty project, default settings |
| **Unreal Engine 5** (macOS) | 400-700 MB | ~300 MB* | *Requires significant effort to minimize |
| **Electron** (hello world) | 400+ MB | 150-200 MB | Full Chromium |

**Key insight**: Godot's minified builds (6-7 MB compressed) require disabling 3D rendering and some text features. Mystral achieves 3.5 MB compressed **with full 3D and text rendering enabled**.

### Historical Context

For perspective, classic game cartridges shipped entire games - engine, graphics, audio, and all content:

| Game | Size | What It Included |
|------|------|------------------|
| **Super Mario 64** (1996) | 8 MB | Full 3D engine + 15 worlds + audio + music |
| **Ocarina of Time** (1998) | 32 MB | Massive open world + orchestral music + voice acting |
| **GoldenEye 007** (1997) | 12 MB | FPS engine + 20 levels + multiplayer |
| **Mystral runtime** (2025) | 10 MB | Engine only (no game content) |

N64 developers achieved this through custom hardware, hand-tuned assembly, MIDI sequencing, and aggressive compression. Mystral's small size is a nice side effect of good architecture (pre-built static libs, minimal binding layer), not extreme optimization.

The real wins from Mystral's architecture are **fast iteration** (6s builds, 0s in interpreted mode) and **simplicity** (27 source files, ~11K LoC), not absolute size minimization.

Sources:
- [Bevy build sizes (StackOverflow)](https://stackoverflow.com/questions/79585343/what-should-the-size-of-a-game-build-be-on-bevy)
- [Godot minification guide](https://popcar.bearblog.dev/how-to-minify-godots-build-size/)

### Pre-built Dependencies (Static Libraries)

| Library | Size | Notes |
|---------|------|-------|
| V8 (`libv8_monolith.a`) | 62 MB | Google's JavaScript engine with JIT |
| Dawn (`libwebgpu_dawn.a`) | 18 MB | Google's WebGPU implementation |
| wgpu-native (`libwgpu_native.a`) | 27 MB | Rust WebGPU implementation (alternative) |
| SDL3 (macOS framework) | 4.3 MB | Windowing, input, audio |
| QuickJS (compiled) | 1.2 MB | Lightweight JS engine |

### Built Libraries

| Library | Size |
|---------|------|
| `libmystral-runtime.a` | 5.5 MB |
| `libquickjs.a` | 1.2 MB |

### Why QuickJS/JSC are smaller

- **V8** includes a full JIT compiler, garbage collector, and WebAssembly runtime (~27 MB of code after linking)
- **QuickJS** is a pure interpreter (~1.2 MB)
- **JSC** uses the system framework (zero added size on macOS/iOS)

## Source Code Metrics

### Lines of Code by Layer

| Layer | Files | LoC | Description |
|-------|-------|-----|-------------|
| **WebGPU Bindings** | `bindings.cpp`, `context.cpp` | **3,975** | JS ↔ WebGPU API bridge |
| **JS Engine Bindings** | `v8_engine.cpp`, `quickjs_engine.cpp`, `jsc_engine.mm` | **2,210** | Three engine implementations |
| **Runtime Core** | `runtime.cpp` | **1,785** | DOM shims, fetch, events, main loop |
| **Platform/Input** | `window.cpp`, `input.cpp`, surfaces | **1,010** | SDL3 windowing, keyboard, mouse |
| **Headers** | `*.h` | **1,199** | API definitions |
| **CLI** | `main.cpp` | **272** | Command-line interface |
| **Utilities** | GLTF, HTTP, stb, cgltf | **~900** | Asset loading, networking |
| **Total** | **27 files** | **~11,400** | |

### Detailed Breakdown

| File | LoC | Layer |
|------|-----|-------|
| `webgpu/bindings.cpp` | 3,301 | WebGPU |
| `runtime.cpp` | 1,785 | Runtime |
| `js/v8_engine.cpp` | 876 | JS Engine |
| `js/quickjs_engine.cpp` | 709 | JS Engine |
| `webgpu/context.cpp` | 674 | WebGPU |
| `platform/input.cpp` | 633 | Platform |
| `js/jsc_engine.mm` | 625 | JS Engine |
| `gltf/gltf_loader.cpp` | 411 | Utilities |
| `cli/main.cpp` | 272 | CLI |
| `platform/window.cpp` | 255 | Platform |
| `http/http_client.cpp` | 179 | Utilities |
| Other files | ~1,500 | Various |

### Estimate vs Actual

As of 1/20/2026 at 8:15PM with sponza example running. 

Original estimates from `tasks/mystralnativeruntime.md`:

| Component | Estimated | Actual | Accuracy |
|-----------|-----------|--------|----------|
| **Total** | 4-5K | **11,355** | 2.3x more |
| WebGPU JS Bindings | 2-3K | **3,975** | ✅ Close |
| Input/Event Bindings | ~500 | **633** | ✅ Close |
| Platform Abstraction | ~500 | **1,010** | 2x |
| JS Engine Bindings | *not estimated* | **2,210** | New |
| Runtime (DOM shims, fetch, events) | ~500 | **1,785** | 3.5x |
| Headers | *not estimated* | **1,199** | New |

**Why the difference?** The original estimate didn't account for:
1. **Three JS engine implementations** - Supporting V8, JSC, and QuickJS adds ~2,200 lines
2. **Runtime grew** - DOM shims, Fetch API, Headers class, event system
3. **Headers** - API definitions for clean separation

### File Count

| Category | Count |
|----------|-------|
| Source files (`.cpp`, `.mm`) | 19 |
| Header files (`.h`) | 8 |
| **Total** | **27 files** |

## Why So Fast?

1. **Pre-built static libraries**: The heavy dependencies (V8, Dawn, SDL3) are distributed as pre-built binaries. These would take 30-60+ minutes each to compile from source.

2. **Minimal binding layer**: Only ~11,400 lines of C++ code needs to be compiled, which takes seconds.

3. **No shader compilation**: WebGPU/WGSL shaders compile at runtime, so there's no offline shader compilation step (unlike Unreal's shader compilation which can take hours).

4. **Simple build system**: CMake with straightforward static library linking - no complex build orchestration.

5. **Modern hardware**: Apple Silicon (M3 Max) compiles C++ extremely fast with unified memory architecture.

## Iteration Speed

Fast builds enable fast iteration - critical for both human developers and AI agents.

### Development Modes

| Mode | Rebuild Time | Use Case |
|------|--------------|----------|
| **Interpreted (JS)** | 0s | Just re-run the JS file - no rebuild needed |
| **Incremental C++** | ~1s | Changed binding layer code |
| **Clean C++ build** | ~6s | Full rebuild from scratch |
| **AOT (future)** | TBD | Compile JS to native for max performance |

### Why This Matters

- **Instant iteration**: In interpreted mode, change your game code and re-run immediately
- **Hot reload (planned)**: Watch files and reload without restart
- **AI-friendly**: Fast feedback loops mean AI agents can iterate quickly on game development
- **No shader compilation**: Unlike Unreal (hours of shader cooking), shaders compile at runtime in milliseconds

## Build Configurations

Mystral Native supports multiple backend combinations:

| Configuration | JS Engine | WebGPU Backend | Binary Size | Best For |
|---------------|-----------|----------------|-------------|----------|
| Dawn + V8 | V8 (JIT) | Dawn (Google) | 37 MB | Full performance, JIT |
| Dawn + QuickJS | QuickJS | Dawn | 10 MB | Small size, all platforms |
| Dawn + JSC | JavaScriptCore | Dawn | 10 MB | macOS/iOS native |
| wgpu + QuickJS | QuickJS | wgpu-native | ~10 MB | iOS, minimal size |

### CMake Flags

```bash
# Dawn + V8 (full performance)
cmake .. -DMYSTRAL_USE_DAWN=ON -DMYSTRAL_USE_V8=ON -DMYSTRAL_USE_QUICKJS=OFF

# Dawn + QuickJS (small size)
cmake .. -DMYSTRAL_USE_DAWN=ON -DMYSTRAL_USE_QUICKJS=ON

# Dawn + JSC (macOS/iOS)
cmake .. -DMYSTRAL_USE_DAWN=ON -DMYSTRAL_USE_JSC=ON -DMYSTRAL_USE_QUICKJS=OFF

# wgpu + QuickJS (iOS, cross-platform)
cmake .. -DMYSTRAL_USE_WGPU=ON -DMYSTRAL_USE_QUICKJS=ON
```

All configurations build in approximately the same time (~6 seconds clean).
