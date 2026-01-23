# Mystral Native Runtime

A lightweight, cross-platform runtime for JavaScript games using WebGPU.

## Current Status

**Multi-engine, multi-backend runtime working on macOS, Windows, Linux, iOS, and Android!**

| Feature | Status |
|---------|--------|
| SDL3 window | ✅ Working |
| WebGPU (wgpu-native) | ✅ Working |
| WebGPU (Dawn) | ✅ Working |
| QuickJS JS engine | ✅ Working |
| V8 JS engine | ✅ Working |
| JSC JS engine (iOS) | ✅ Working |
| WebGPU JS bindings | ✅ Working |
| CLI (`mystral run`) | ✅ Working |
| CLI (`mystral compile`) | ✅ Working |
| fetch API (file/http/https) | ✅ Working |
| createImageBitmap | ✅ Working |
| setTimeout/setInterval | ✅ Working |
| Headless screenshot mode | ✅ Working |
| No-SDL headless GPU mode | ✅ Working |
| TypeScript support (SWC) | ✅ Working |
| Module imports (ESM) | ✅ Working |
| Web Audio API | ✅ Working |
| Gamepad API | ✅ Working |
| Canvas 2D (Skia) | ✅ Working |
| GLTF loading | ✅ Working |
| iOS xcframework | ✅ Working |
| Android NDK build | ✅ Working |

## Quick Start

```bash
# Install dev dependencies
bun install

# Download prebuilt dependencies (wgpu-native, SDL3, QuickJS, SWC)
bun run deps:download

# Configure and build
bun run configure
bun run build

# Run an example
./build/mystral run examples/triangle.js

# Run a TypeScript entry (requires SWC)
./build/mystral run examples/gltf-test/main.ts
```

## Running Examples

The `mystral` CLI runs JavaScript files with full WebGPU support:

```bash
# Basic triangle (minimal WebGPU)
./build/mystral run examples/triangle.js

# Rotating 3D cube with matrices
./build/mystral run examples/simple-cube.js

# Test fetch API and timers
./build/mystral run examples/test-fetch.js

# Run with custom window size
./build/mystral run examples/simple-cube.js --width 1920 --height 1080

# Headless mode with screenshot (for testing)
./build/mystral run examples/simple-cube.js --headless --screenshot output.png --frames 60
```

### Available Examples

| Example | Description |
|---------|-------------|
| `triangle.js` | Minimal WebGPU - renders an orange triangle |
| `webgpu-triangle.js` | WebGPU triangle with inline shaders |
| `simple-cube.js` | 3D rotating cube with perspective, matrices, colors |
| `rotating-cube.js` | Cube using storage buffers (advanced) |
| `simple-boxes.js` | Multiple 3D boxes demonstration |
| `test-fetch.js` | Tests fetch API, setTimeout, setInterval |
| `test-texture.js` | Tests texture loading with WebGPU |
| `test-http.js` | Tests HTTP fetch |
| `test-audio.js` | Tests Web Audio API (440 Hz tone) |
| `test-canvas2d.js` | Tests Canvas 2D API (Skia backend) |
| `test-gamepad.js` | Tests Gamepad API |
| `gamepad-3d.js` | 3D cube controlled by gamepad |
| `test-ui.js` | Tests UI rendering system |
| `gltf-test/` | GLTF model loading test |
| `gltf-render/` | GLTF model rendering |
| `textured-cube/` | Textured 3D cube |
| `simple-mystral/` | Self-contained mini engine example |

### Sample Assets

Sample 3D models are included in `examples/assets/`:
- `DamagedHelmet.glb` - Khronos sample model (3.6 MB)
- `Sponza.glb` - Intel Sponza scene (13 MB)

### CLI Options

```
USAGE:
    mystral run <script.js> [options]
    mystral compile <entry.js> [options]
    mystral --version
    mystral --help

OPTIONS:
    --width <n>           Window width (default: 1280)
    --height <n>          Window height (default: 720)
    --title <str>         Window title (default: "Mystral")
    --headless            Run with hidden window
    --screenshot <file>   Take screenshot after N frames and quit
    --frames <n>          Number of frames before screenshot (default: 60)
    --quiet               Suppress output
```

## Bundling for Distribution

Package JavaScript + assets into a single binary:

```bash
./build/mystral compile examples/simple-cube.js --include assets --out dist/my-game

# Run the bundled binary
./dist/my-game
```

## Running Tests

```bash
# CI tests (no GPU required)
bun run test

# GPU tests (requires GPU, local only)
bun run test:gpu

# All tests
bun run test:all
```

## Development Setup (Manual)

```bash
cd internal_packages/mystralnative

# 1. Download dependencies
node scripts/download-deps.mjs

# Optional: download SWC for TypeScript transpiling
node scripts/download-deps.mjs --only swc

# 2. Configure cmake
cmake -B build -DCMAKE_BUILD_TYPE=Release

# 3. Build
cmake --build build

# 4. Run example
./build/mystral run examples/simple-cube.js
```

### Build Output

```
build/mystral: ~15MB Mach-O 64-bit executable arm64

Statically linked:
- wgpu-native (WebGPU)
- QuickJS (JS engine)
- libcurl (HTTP)
- stb_image (PNG decoding)

Dynamically linked:
- SDL3.framework (must bundle for distribution)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Your Game (JavaScript)                       │
│               Uses WebGPU API (same as browser)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                  Mystral Native Runtime                          │
│                                                                  │
│   WebGPU Bindings    Canvas Shim    fetch/timers    Input       │
└─────────────────────────────────────────────────────────────────┘
        │                    │              │              │
        ▼                    ▼              ▼              ▼
  ┌──────────┐        ┌───────────┐   ┌─────────┐   ┌──────────┐
  │ JS Engine │        │  WebGPU   │   │ libcurl │   │   SDL3   │
  │ QuickJS/  │        │  wgpu or  │   │         │   │          │
  │ V8 / JSC  │        │   Dawn    │   │         │   │          │
  └──────────┘        └───────────┘   └─────────┘   └──────────┘
```

## Platform Support

| Platform | JS Engine | WebGPU | Status |
|----------|-----------|--------|--------|
| macOS | QuickJS | wgpu-native | ✅ Working |
| macOS | V8 | wgpu-native | ✅ Working |
| Windows | QuickJS | Dawn | ✅ Working |
| Windows | V8 | Dawn | ✅ Working |
| Linux | QuickJS/V8 | wgpu-native | ✅ Working |
| iOS | JSC | wgpu-native | ✅ Working |
| Android | QuickJS | wgpu-native | ✅ Working |

## Build Options

### JS Engine (choose one)
```bash
cmake -B build -DMYSTRAL_USE_QUICKJS=ON   # Default - tiny, no JIT
cmake -B build -DMYSTRAL_USE_JSC=ON       # macOS/iOS - system framework
cmake -B build -DMYSTRAL_USE_V8=ON        # Desktop - full V8
```

### WebGPU Implementation (choose one)
```bash
cmake -B build -DMYSTRAL_USE_WGPU=ON      # Default - supports iOS
cmake -B build -DMYSTRAL_USE_DAWN=ON      # Chrome's impl - best compliance
```

## Project Structure

```
mystralnative/
├── include/mystral/       # Public headers
│   └── runtime.h          # Main API
├── src/
│   ├── cli/               # CLI entry point
│   ├── runtime.cpp        # Runtime implementation
│   ├── js/                # JS engine integrations
│   ├── webgpu/            # WebGPU bindings
│   ├── canvas/            # Canvas shim
│   ├── http/              # fetch API (libcurl)
│   ├── platform/          # Window, input, surface
│   └── vfs/               # Embedded bundle filesystem
├── examples/              # JavaScript examples
│   ├── triangle.js        # Minimal WebGPU
│   ├── simple-cube.js     # 3D cube with matrices
│   └── ...
├── tests/
│   ├── ci/                # CI-safe tests (no GPU)
│   └── gpu/               # GPU tests (local only)
├── scripts/
│   ├── download-deps.mjs  # Download prebuilt deps
│   ├── prebundle.ts       # Bundle TS/JS with imports
│   └── bundle.mjs         # Embed assets as C header
└── third_party/           # Downloaded dependencies
```

## JavaScript APIs

The runtime exposes standard Web APIs:

```javascript
// WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");

// Animation
requestAnimationFrame(callback);

// Fetch (supports file://, http://, https://)
const response = await fetch("file:///path/to/file.json");
const data = await response.json();

// Image decoding
const bitmap = await createImageBitmap(blob);
device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [w, h]);

// Timers
setTimeout(callback, ms);
setInterval(callback, ms);

// Console
console.log(...);
console.error(...);

// Performance
performance.now();
```

## Embedding the Runtime

For custom builds, you can embed the runtime as a library:

```cpp
#include "mystral/runtime.h"

int main() {
    mystral::RuntimeConfig config;
    config.width = 1280;
    config.height = 720;
    config.title = "My Game";

    auto runtime = mystral::Runtime::create(config);
    runtime->evalScript(gameCode, "game.js");
    runtime->run();

    return 0;
}
```

See `examples/embed-example/` for a complete example.

## Dependencies

All dependencies are downloaded as prebuilt binaries:

| Dependency | Version | License | Notes |
|------------|---------|---------|-------|
| wgpu-native | v22.1.0.5 | Apache 2.0 | WebGPU implementation |
| SDL3 | 3.2.8 | zlib | Windowing, input, audio |
| QuickJS | 2024-01-13 | MIT | Default JS engine |
| Dawn | latest | BSD-3 | Alternative WebGPU (no iOS) |
| V8 | 12.4.254 | BSD-3 | Alternative JS engine |
| SWC | swc-11 | Apache 2.0 | TypeScript transpiling |

## See Also

- [wgpu-native](https://github.com/gfx-rs/wgpu-native) - WebGPU C API
- [SDL3](https://github.com/libsdl-org/SDL) - Cross-platform windowing
- [QuickJS](https://bellard.org/quickjs/) - Tiny JS engine

## Known Issues

### macOS Audio Shutdown
On macOS, the process may exit with code 137 when using Web Audio API. This is due to a known issue with SDL3's CoreAudio callback interaction. The audio functions correctly during runtime; only the shutdown is affected. Screenshot mode (`--screenshot`) exits cleanly with code 0.

## License

MIT License - see [LICENSE](LICENSE) for details.
