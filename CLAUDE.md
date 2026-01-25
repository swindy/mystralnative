# MystralNative - Claude Code Instructions

This document contains important instructions for AI assistants working on the MystralNative codebase.

## Critical Rules

### DO NOT Use Native GLTF/GLB Loaders

**NEVER** use or reference the C++ native GLTF/GLB loading code in this repository. The files exist but are deprecated and will cause compile errors if included:

- `src/gltf/gltf_loader.cpp` - DEPRECATED
- `src/utils/cgltf_impl.cpp` - DEPRECATED
- `include/mystral/gltf/gltf_loader.h` - DEPRECATED
- `third_party/cgltf/` - DEPRECATED

**Why?** MystralNative should use the **JavaScript GLBLoader/GLTFLoader** from the Mystral web engine (same code that runs in browsers). This ensures:

1. **Feature parity** with the web engine
2. **Consistent behavior** across platforms (web, desktop, mobile)
3. **Extension support** like Draco mesh compression (via WASM)
4. **Easier maintenance** - one codebase for all platforms

### How to Load GLTF/GLB Files

In your JavaScript/TypeScript code running on MystralNative, use:

```javascript
// For GLB files (binary GLTF)
import { loadGLBModel } from 'mystral';
const model = await loadGLBModel(device, './path/to/model.glb');

// For GLTF files (JSON + external resources)
import { loadGLTFModel } from 'mystral';
const model = await loadGLTFModel(device, './path/to/model.gltf');
```

These loaders are implemented in:
- `src/loaders/GLBLoader.ts` (main Mystral engine repo) - Supports both .glb and .gltf files
- `src/loaders/GLTFLoader.ts` - **DEPRECATED** (uses loaders.gl, adds ~500KB to bundle)

## Draco Compression Support

GLBLoader now supports Draco-compressed meshes (`KHR_draco_mesh_compression`) via WebWorker-based WASM decoding.

### Setup for Bundled Decoder (Recommended)

Copy the Draco decoder files to your public folder:
```bash
mkdir -p public/draco
curl -o public/draco/draco_decoder.js https://www.gstatic.com/draco/versioned/decoders/1.5.6/draco_decoder.js
curl -o public/draco/draco_decoder.wasm https://www.gstatic.com/draco/versioned/decoders/1.5.6/draco_decoder.wasm
```

### Using CDN (No Setup Required)

```javascript
import { GLBLoader } from 'mystral';
const loader = new GLBLoader(device, { dracoDecoderPath: 'cdn' });
const result = await loader.load('./model.glb');
```

## Known Limitations

**loaders.gl removed**: We removed loaders.gl dependency to reduce bundle size by ~500KB. The GLBLoader now handles all GLTF/GLB loading natively.

## Build Configuration

The project uses CMake with several options:

```bash
# Recommended: V8 + Dawn for full shader compatibility
cmake -B build \
  -DMYSTRAL_USE_V8=ON \
  -DMYSTRAL_USE_DAWN=ON \
  -DMYSTRAL_USE_QUICKJS=OFF \
  -DMYSTRAL_USE_WGPU=OFF

cmake --build build --parallel
```

See `README.md` for full build options.

## Repository Sync

This code syncs to the public repository `mystralengine/mystralnative`. See the main repo's `CLAUDE.md` for sync instructions.
