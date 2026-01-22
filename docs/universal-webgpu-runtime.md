# Building a Universal Native WebGPU Runtime for TypeScript Games

## The Problem: Why Isn't There an Easy Way to Write TypeScript Games Outside a Browser?

TypeScript and JavaScript have become the most widely-used programming languages in the world. Developers love the rapid iteration, hot reloading, and the massive ecosystem of packages. Yet when it comes to game development, particularly for native platforms, these languages are largely absent.

**The core tension:** Browsers have evolved into incredibly capable game platforms with WebGL, WebGPU, Web Audio, and gamepad APIs. But the moment you want to ship a native game—one that runs on desktop without a browser chrome, on mobile app stores, or on consoles—you're forced to either:

1. Bundle an entire browser (Electron: 150MB+ overhead)
2. Use platform-specific webviews with inconsistent GPU support (Tauri)
3. Abandon JavaScript entirely and rewrite in C++ or C# using a native engine like Unreal Engine or Unity

None of these options preserve the core developer experience that makes web development so productive.

## How Games Are Written Today

### Traditional Game Engines

Most games are built with established engines that handle the complexity of cross-platform deployment:

**Unreal Engine** - C++ based, visual scripting with Blueprints. Excellent for AAA graphics but heavyweight, complex build system, and the scripting experience is far from web development.

**Unity** - C# based, huge ecosystem. Dominant in indie and mobile. But C# is not JavaScript, and the development loop is slower than web development. Unity used to support UnityScript, a JS-like language, but it was removed in favor of C#.

**Godot** - GDScript (Python-like) or C#. Open source and lightweight, but again, not the JavaScript ecosystem.

### JavaScript-Based Approaches

**2D Engines:**
- Phaser, PixiJS - Excellent for 2D, browser-only
- Impact - Browser-focused, dated

**3D Runtimes:**
- Three.js - Not really an engine, but a WebGL/WebGPU rendering library. Incredibly popular, great DX, but browser-only
- Babylon.js - Similar featureset as Three.js, still browser-only
- PlayCanvas - Has an editor, WebGL & WebGPU support, not really open source.

**What these all share:** They run in browsers. Period. The moment you want native, you're back to Electron or giving up. They were written with WebGL to start, not natively for WebGPU (which avoids many of the state management issues with WebGL / OpenGL ES stack).

### What Engines Provide

Engines abstract enormous complexity from game developers:
- **Build systems** for compiling to multiple platforms
- **Physics** - rigid body dynamics, collision detection
- **Pathfinding** - navigation meshes, A* algorithms
- **Asset pipelines** - texture compression, mesh optimization, LOD generation
- **Audio systems** - spatial audio, mixing, streaming
- **Input handling** - gamepads, touch, keyboard abstraction
- **Rendering** - shaders, materials, lighting, shadows, post-processing

## The Problem with Current Native JavaScript Approaches

### JavaScript Runtimes

**Node.js, Bun, Deno** - These are server-focused runtimes. They have no:
- Window creation (Deno has 'bring your own window' option)
- GPU access (no WebGPU, no WebGL) - Deno has this as an experimental --unstable-webgpu flag, but it's not ready for production use & because you need to bring your own window, that library has to be dynamically linked.
- Audio output
- Gamepad input
- Display management

You could theoretically add these via native addons, but:
1. Native addon APIs differ between Node/Bun/Deno
2. Each addon needs separate builds per platform
3. No unified abstraction—you're assembling pieces, not using a runtime
4. None of Node, Bun, or Deno are designed for game development or building for mobile / console platforms.

### Browser-Based Approaches

**Chrome, Safari, Firefox** - Full WebGPU support (or coming soon), but:
- You're shipping a browser, not a game
- No console support (PlayStation, Xbox, Switch don't run Chrome)
- Overhead of browser security sandboxing, multi-process architecture
- No mobile support Note: *iOS has Safari webviews, Android has webviews as well which you can build a game for - can't use native events, need to use web based events.
- No console support

**Electron** - Bundles Chromium. Works, but:
- 150MB+ base overhead
- Memory hungry (multiple processes)
- No mobile support
- No console support
- Overkill—you don't need a full browser for a game

**Tauri** - Uses system webviews. Lighter than Electron, but:
- WebGPU support varies by platform (Safari's WebKit vs Chrome's Blink vs Edge's Blink)
- System webviews are often outdated (especially on Windows)
- No iOS App Store (WKWebView restrictions)
- No console support

### The Gap

| Approach | Desktop | Mobile | Console | GPU | JS/TS | Lightweight |
|----------|---------|--------|---------|-----|-------|-------------|
| Electron | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Tauri | ✅ | ⚠️ | ❌ | ⚠️ | ✅ | ✅ |
| Node + addons | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Unity | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **What we need** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## The Solution: A Purpose-Built Native WebGPU Runtime

Instead of bending existing tools to fit our needs, we built a runtime specifically designed for TypeScript games:

```
┌─────────────────────────────────────────────────────────┐
│                    Your TypeScript Game                 │
│              (Same code as browser version)             │
├─────────────────────────────────────────────────────────┤
│                   Web APIs (WebGPU, WebAudio, etc.)     │
├─────────────────────────────────────────────────────────┤
│         Mystral Native Runtime (C++ core)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  JS Engine  │  │ WebGPU Impl │  │ Platform Layer  │  │
│  │ QuickJS/V8/ │  │  Dawn/wgpu  │  │  SDL3 + Metal/  │  │
│  │    JSC      │  │             │  │  Vulkan/D3D12   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│              Operating System / Platform                │
│        (macOS, Windows, Linux, iOS, Android, Switch)    │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Same code everywhere** - Your game's TypeScript/JavaScript runs identically on all platforms
2. **Web API compatibility** - Implement the same APIs browsers provide (WebGPU, fetch, etc.)
3. **Minimal overhead** - No browser baggage, just what games need
4. **Platform-native performance** - Direct GPU access, no sandboxing overhead
5. **Pluggable components** - Swap JS engines or WebGPU implementations per platform

## Abstracting WebGPU: Dawn vs wgpu-native

WebGPU is a modern graphics API designed as the successor to WebGL. Two major implementations exist:

### Dawn (Google)

- **Origin:** Chrome's WebGPU implementation, extracted as a standalone library
- **Language:** C++ with C API (`webgpu.h`)
- **Backends:** Metal, Vulkan, D3D12, D3D11, OpenGL (fallback)
- **Platforms:** Windows, macOS, Linux, Android, ChromeOS
- **Strengths:** Battle-tested in Chrome, excellent validation/debugging, full spec compliance
- **Weaknesses:** Large binary size (~50MB static), complex build, embeds Abseil library

### wgpu-native (Mozilla/gfx-rs)

- **Origin:** Firefox's WebGPU implementation (wgpu), with C bindings
- **Language:** Rust with C API (`webgpu.h`)
- **Backends:** Metal, Vulkan, D3D12, D3D11, OpenGL (fallback)
- **Platforms:** Windows, macOS, Linux, iOS, Android
- **Strengths:** Smaller binary (~15MB), simpler distribution, iOS support
- **Weaknesses:** Slightly behind spec in some areas, different error messages

### Why Support Both?

Different platforms have different optimal choices:

| Platform | Recommended | Reason |
|----------|-------------|--------|
| macOS | Either | Both work well with Metal |
| Windows | Dawn | Better D3D12 support, matches Chrome |
| Linux | Either | Both use Vulkan |
| iOS | wgpu | Dawn doesn't support iOS |
| Android | Dawn | More mature Android support |
| Consoles | Custom | Neither supports consoles directly |

### The Abstraction Layer

Both Dawn and wgpu implement the same `webgpu.h` C API, but with subtle differences:

```cpp
// Callback patterns differ between implementations
#if defined(MYSTRAL_WEBGPU_DAWN)
    // Dawn uses CallbackInfo structs with explicit callback modes
    WGPURequestDeviceCallbackInfo callbackInfo = {};
    callbackInfo.mode = WGPUCallbackMode_AllowProcessEvents;
    callbackInfo.callback = onDeviceReady;
    wgpuAdapterRequestDevice(adapter, &descriptor, callbackInfo);
#else
    // wgpu uses simpler callback function pointers
    wgpuAdapterRequestDevice(adapter, &descriptor, onDeviceReady, userdata);
#endif
```

Our abstraction handles these differences at compile time with preprocessor macros, presenting a unified API to the JavaScript bindings layer.

### Build Considerations

**Dawn + V8 Symbol Conflicts:** Both Dawn and V8 statically link the Abseil library, causing duplicate symbol errors on macOS. We solve this with careful link ordering:

```cmake
# Force-load V8 first to establish symbol precedence
target_link_libraries(runtime PRIVATE "-Wl,-force_load,${V8_LIBRARY}")
# Then link Dawn - duplicate symbols become warnings, not errors
target_link_libraries(runtime PRIVATE dawn::webgpu)
```

On Linux, the linker flag `--allow-multiple-definition` achieves the same result.

## JavaScript Engine Choices: QuickJS, V8, and JSC

### Why Not Just Use Node.js or Deno?

This is the most common question. The answer comes down to architecture:

**Node.js/Deno are processes, not libraries.** They're designed to be the main program, not embedded components. Embedding them means:

1. **libuv dependency** - Node's event loop is tightly coupled to libuv, which conflicts with game loops
2. **Process model** - Node expects to control the main thread and process lifecycle
3. **No mobile support** - Node doesn't run on iOS or Android (or consoles)
4. **Large footprint** - Node bundles npm, module resolution, and server-focused APIs

**Deno has similar issues** plus additional complexity around its security sandbox model.

What we need is a **JavaScript engine**, not a **JavaScript runtime**. The engine executes JavaScript; the runtime provides APIs like `fetch`, `setTimeout`, and WebGPU. We build our own runtime on top of an engine.

### Engine Comparison

| Engine | Binary Size | Startup | Performance | License | Platforms |
|--------|-------------|---------|-------------|---------|-----------|
| QuickJS | ~600KB | ~1ms | Good | MIT | Universal |
| V8 | ~30MB | ~50ms | Excellent | BSD | Desktop, Android |
| JSC | System | ~10ms | Excellent | LGPL | Apple only |

### QuickJS (Default)

**Bellard's QuickJS** is a remarkably complete JavaScript engine in ~600KB:

- **Full ES2023 support** including async/await, generators, proxies
- **BigInt and BigFloat** support
- **Embeddable** - designed to be embedded, not standalone
- **Simple API** - straightforward C API for bindings
- **Universal** - compiles anywhere with a C compiler

**When to use:** Default choice. Small binary, fast startup, good enough performance for most games. Essential for platforms where V8 isn't available (some consoles).

**Tradeoffs:** ~10x slower than V8 for CPU-intensive JavaScript. For games, this rarely matters since the GPU does the heavy lifting.

### V8 (Chrome's Engine)

**Google's V8** powers Chrome, Node.js, and Deno:

- **JIT compilation** - optimizing compiler produces near-native performance
- **Industry standard** - most JavaScript runs on V8
- **Excellent tooling** - Chrome DevTools, profilers, debuggers

**When to use:** When JavaScript performance matters (complex game logic, physics in JS), or when you need perfect compatibility with browser behavior.

**Tradeoffs:** Large binary (~30MB), slower startup, complex build process, doesn't support all platforms.

### JavaScriptCore (Safari's Engine)

**Apple's JSC** powers Safari and all iOS browsers:

- **System framework on Apple platforms** - zero added binary size
- **JIT compilation** - excellent performance
- **Required for iOS** - Apple mandates JSC for dynamic code execution

**When to use:** Apple platforms, especially iOS where it's essentially required.

**Tradeoffs:** Apple-only, can't use on Windows/Linux/Android.

### The Abstraction

We define a common `IJavaScriptEngine` interface:

```cpp
class IJavaScriptEngine {
public:
    virtual ~IJavaScriptEngine() = default;

    // Core execution
    virtual bool evaluate(const std::string& code, const std::string& filename) = 0;

    // Value creation
    virtual JSValueHandle createObject() = 0;
    virtual JSValueHandle createArray() = 0;
    virtual JSValueHandle createFloat32Array(const float* data, size_t count) = 0;

    // Global registration
    virtual void setGlobalObject(const std::string& name, JSValueHandle value) = 0;
    virtual void setGlobalFunction(const std::string& name, JSNativeFunction func) = 0;

    // ... etc
};
```

Each engine implements this interface. The WebGPU bindings and game code interact only with this abstraction, never with engine-specific APIs.

### Engine Selection Strategy

```cpp
std::unique_ptr<IJavaScriptEngine> createEngine() {
    #if defined(MYSTRAL_JS_V8)
        // V8 available - use for best performance
        return std::make_unique<V8Engine>();
    #elif defined(MYSTRAL_JS_JSC) && defined(__APPLE__)
        // Apple platform - use system JSC
        return std::make_unique<JSCEngine>();
    #elif defined(MYSTRAL_JS_QUICKJS)
        // Fallback - QuickJS works everywhere
        return std::make_unique<QuickJSEngine>();
    #else
        #error "No JavaScript engine configured"
    #endif
}
```

## "Universal" Means Desktop, Mobile, and Consoles

### Desktop (macOS, Windows, Linux)

The straightforward case:
- **Window creation:** SDL3 provides cross-platform windowing
- **GPU:** Dawn or wgpu with Metal/Vulkan/D3D12 backends
- **JS Engine:** V8 (performance) or QuickJS (simplicity)

### Mobile (iOS, Android)

**iOS Challenges:**
- App Store prohibits JIT compilation (security policy)
- Must use JavaScriptCore (Apple's engine, allowed because it's a system framework)
- wgpu-native supports iOS; Dawn does not
- Metal is the only GPU backend

**Android Challenges:**
- V8 works but adds significant APK size
- QuickJS is often the better choice for APK size
- Vulkan is the primary backend (Metal not available)
- Dawn has better Android support than wgpu currently

### Consoles (Nintendo Switch, PlayStation, Xbox)

The most challenging platforms:

**Nintendo Switch:**
- Custom Nvidia GPU, proprietary graphics API (NVN) or Vulkan
- No public WebGPU implementation exists
- Requires Nintendo developer license
- QuickJS likely the only JS engine option (V8 too large, no JSC)
- Custom WebGPU-to-NVN translation layer needed

**PlayStation:**
- GNM (PS4) or GNMX (PS5) graphics APIs
- Requires Sony developer license
- Similar situation to Switch

**Xbox:**
- D3D12 available, so Dawn theoretically works
- Microsoft developer license required
- V8 potentially available (used in Edge)

**The Console Strategy:**

We can't ship console support out of the box—NDAs and licensing prevent it. But the architecture supports it:

1. **Pluggable WebGPU backend** - Console developers implement WebGPU-to-native translation
2. **QuickJS as baseline** - Works on any platform with a C compiler
3. **Same game code** - TypeScript game logic doesn't change

```
┌────────────────────────────────────────────┐
│           Your TypeScript Game             │  <- Same code
├────────────────────────────────────────────┤
│         Mystral Native Runtime             │  <- Same runtime
├──────────────┬──────────────┬──────────────┤
│   Desktop    │    Mobile    │   Console    │
│  Dawn/wgpu   │ wgpu/Metal   │  Custom*     │  <- Platform layer
└──────────────┴──────────────┴──────────────┘
                                    * NDA-protected
```

## Architecture Deep Dive

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Game Code (TypeScript)                   │
│    const device = await navigator.gpu.requestAdapter();         │
│    const ctx = canvas.getContext('webgpu');                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ JavaScript calls
┌────────────────────────────▼────────────────────────────────────┐
│                     JavaScript Bindings Layer                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ navigator.gpu│ │   Canvas     │ │    fetch()   │  ...        │
│  │   bindings   │ │   bindings   │ │   bindings   │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
┌─────────▼────────────────▼────────────────▼─────────────────────┐
│                      Native Implementation                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ WebGPU       │ │  SDL3 Window │ │  libcurl     │             │
│  │ (Dawn/wgpu)  │ │  + Surface   │ │  HTTP client │             │
│  └──────┬───────┘ └──────┬───────┘ └──────────────┘             │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
┌─────────▼────────────────▼──────────────────────────────────────┐
│                      Platform Layer                              │
│        Metal (macOS/iOS) │ Vulkan (Linux/Android/Windows)       │
│        D3D12 (Windows)   │ NVN (Switch - custom)                │
└─────────────────────────────────────────────────────────────────┘
```

### The Main Loop

Unlike browsers, we control the main loop:

```cpp
void MystralRuntime::run() {
    while (!shouldQuit_) {
        // 1. Process platform events (input, window resize, etc.)
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
            handleEvent(event);
        }

        // 2. Tick WebGPU (process callbacks, especially for Dawn)
        #if defined(MYSTRAL_WEBGPU_DAWN)
        wgpuInstanceProcessEvents(instance_);
        #endif

        // 3. Call JavaScript frame callback
        if (hasFrameCallback_) {
            jsEngine_->callFunction(frameCallback_, currentTime);
        }

        // 4. Present frame
        wgpuSurfacePresent(surface_);
    }
}
```

### Memory Management

JavaScript is garbage collected; C++ is manual. The bridge requires care:

```cpp
// C++ side: prevent garbage collection of live GPU resources
class GPUBuffer {
    WGPUBuffer handle_;
    weak_ptr<TrackingRef> ref_;  // Release C++ side when GC runs
};

// JavaScript side: ensure cleanup
// When JS GC collects the wrapper, invoke destructor callback
```

## What This Enables

With this architecture, you can:

1. **Write games in TypeScript** with modern tooling (VS Code, hot reload, npm packages)
2. **Use the same code** across browser, desktop, and mobile
3. **Ship native binaries** without browser overhead (5MB vs 150MB)
4. **Target consoles** with the same game logic (platform layer customization)
5. **Choose your tradeoffs** - pick the JS engine and WebGPU implementation that fits

## Current Status and Roadmap

### Working Today

- [x] QuickJS + wgpu-native (macOS, Linux, Windows)
- [x] QuickJS + Dawn (macOS, Linux, Windows)
- [x] V8 + wgpu-native (macOS, Linux, Windows)
- [x] V8 + Dawn (macOS, Windows, Linux)
- [x] JSC + wgpu-native (macOS)
- [x] JSC + Dawn (macOS)
- [x] WebGPU bindings (device, buffers, textures, shaders, render passes)
- [x] GLTF/GLB loading with typed arrays
- [x] Fetch API (file://, http://, https://)

### In Progress

- [ ] PBR materials (StandardMaterial from Mystral Engine)
- [ ] Audio system (Web Audio API subset)
- [ ] Gamepad input
- [ ] Mobile builds (iOS, Android)

### Future

- [ ] Console support (requires partnerships)
- [ ] Debugging/profiling tools
- [ ] Hot reload over network
- [ ] Asset bundling and compression
- [ ] AOT compilation (MystralScript)

## The Road to Native Performance: AOT Compilation

### The Performance Spectrum

JavaScript execution exists on a spectrum:

```
Interpreted (QuickJS)  →  JIT Compiled (V8/JSC)  →  AOT Compiled (Native)
     ~10x slower              ~2x slower              Native speed
     Tiny binary              Large runtime           Medium binary
     Universal                Platform-specific       Platform-specific
     Fast startup             Slow startup            Instant startup
```

For most games, JIT compilation (V8) is "fast enough"—the GPU does the heavy lifting for rendering. But there are compelling reasons to go further:

**Startup time:** V8 takes 50-100ms to initialize, then additional time to parse and compile JavaScript. For a mobile game, users expect instant launch.

**Consistent frame times:** JIT compilers can cause frame hitches when recompiling hot code paths. AOT eliminates this entirely.

**Binary size:** A game compiled to native code doesn't need to ship a JavaScript engine at all.

**Console requirements:** Some console platforms have restrictions on JIT compilation (similar to iOS).

### MystralScript: TypeScript for Native Compilation

The vision is a subset of TypeScript—called **MystralScript**—that can be compiled ahead-of-time to native code:

```typescript
// This MystralScript compiles to native code
class Player {
    position: Vec3;
    velocity: Vec3;
    health: number;

    update(deltaTime: number): void {
        this.position = this.position.add(this.velocity.scale(deltaTime));
    }
}
```

**What makes AOT possible:**

1. **Static typing** - TypeScript's type annotations provide the information needed for efficient native code generation
2. **Restricted dynamism** - No `eval()`, limited reflection, predictable object shapes
3. **WebGPU as the boundary** - GPU operations are already "compiled" (shaders), so the JS→native boundary is well-defined

**What gets restricted:**

- Dynamic property access on untyped objects
- `eval()` and `new Function()`
- Certain reflection patterns
- Some npm packages that rely on JavaScript dynamism

### The Toolchain Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   game.ts  ──────┬──────────────────────────────────────────►   │
│                  │                                               │
│                  ├──► mystral run game.ts     (Development)     │
│                  │    Interpreted, hot reload, fast iteration   │
│                  │                                               │
│                  ├──► mystral build game.ts   (Production)      │
│                  │    Bundled JS + mystral runtime binary       │
│                  │                                               │
│                  └──► mystralc game.ts        (Native)          │
│                       AOT compiled, no runtime needed           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Toolchain Naming

| Tool | Purpose | Analogy |
|------|---------|---------|
| `mystral` | CLI runtime for running TypeScript games | Like `node`, `deno`, `bun` |
| `mystral.js` | The JavaScript engine bindings (embeddable) | Like V8, QuickJS |
| `mystralc` | AOT compiler for MystralScript | Like `rustc`, `go build` |

**Usage examples:**

```bash
# Development - interpreted execution with hot reload
mystral run src/game.ts --watch

# Production - bundle JS and ship with runtime
mystral build src/game.ts --target macos --output MyGame.app

# Native - AOT compile to standalone executable (future)
mystralc src/game.ts --target macos --output MyGame
```

### Implementation Approach

**Phase 1 (Current):** Interpreted runtime with pluggable JS engines
- Ship games as bundled JavaScript + mystral runtime
- ~10MB total binary size (QuickJS) to ~50MB (V8)
- Full TypeScript compatibility via standard toolchain

This isn't really needed:
<!-- **Phase 2:** Bytecode compilation
- Compile TypeScript to QuickJS bytecode ahead of time
- Faster startup (skip parsing), same runtime
- Still interpreted, but optimized -->

**Phase 2:** Native AOT compilation
- MystralScript subset compiles to LLVM IR
- Output native executables for each platform
- No JavaScript engine required at runtime
- Target: Unreal/Unity-level performance for game logic

### Why This Matters

The JavaScript ecosystem is enormous—npm has millions of packages, millions of developers know the language, and TypeScript has proven that static typing can coexist with JavaScript's flexibility.

By creating a path from "write TypeScript, run in interpreter" to "write TypeScript, compile to native," we offer:

1. **Gentle onramp** - Start with familiar tools, optimize later
2. **Gradual adoption** - Keep dynamic JS for tools/scripts, compile hot paths
3. **Maximum reach** - Same language from prototype to shipped console game

This is the trajectory that made C# successful in Unity—start with a managed language for productivity, add tools like IL2CPP for native performance when needed.

## Conclusion

The web platform proved that JavaScript can be used for serious graphics applications. WebGPU proves that JavaScript can achieve near-native GPU performance. The missing piece was a lightweight native runtime that preserves the web development experience while enabling true cross-platform deployment.

By carefully abstracting the JS engine and WebGPU implementation, we create a foundation that can adapt to any platform—from a MacBook to a Nintendo Switch—while developers write the same TypeScript code they'd write for a browser.

The goal isn't to replace browsers or Electron for web apps. It's to give game developers the same productive, iterative experience that web developers enjoy, without sacrificing the ability to ship native games on any platform.

---

*Mystral Native Runtime - Write TypeScript, Ship \[Games\] Everywhere*
