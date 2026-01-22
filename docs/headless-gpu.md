# Headless GPU Mode (`--no-sdl`)

MystralNative supports running without any window system using the `--no-sdl` flag. This enables GPU compute and rendering on headless servers without X11, Wayland, or any display.

## Overview

```bash
# Pure compute (exits automatically when done)
mystral run compute.js --no-sdl

# Rendering with screenshot (exits after N frames)
mystral run render.js --no-sdl --screenshot output.png --frames 60
```

## Comparison: `--headless` vs `--no-sdl`

| Feature | `--headless` | `--no-sdl` |
|---------|--------------|------------|
| Window system required | Yes (SDL creates hidden window) | No |
| GPU rendering | Yes (to surface) | Yes (to offscreen texture) |
| GPU compute | Yes | Yes |
| Screenshots | Yes | Yes |
| Audio | Yes | No (SDL required) |
| Input events | Yes (but window hidden) | No |
| Use case | Testing with display server | Headless servers, pure compute |

## Use Cases

### 1. Pure GPU Compute

For ML inference, data processing, or any GPU compute workload:

```javascript
// compute.js - Exits automatically when async work completes
async function main() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    // Create compute pipeline
    const shaderModule = device.createShaderModule({
        code: `
            @group(0) @binding(0) var<storage, read> input: array<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<f32>;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) id: vec3u) {
                let i = id.x;
                if (i < arrayLength(&input)) {
                    output[i] = input[i] * 2.0;
                }
            }
        `
    });

    const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
    });

    // Create buffers, run compute, read back results...
    // Script exits automatically when all async work completes
}

main();
```

Run:
```bash
mystral run compute.js --no-sdl
```

**Exit behavior:** The runtime detects when there are no more pending callbacks (RAF, timers) and exits cleanly.

### 2. Offscreen Rendering with Screenshots

For rendering images without a display:

```javascript
// render.js - Uses requestAnimationFrame, needs --frames to exit
const canvas = document.getElementById('engine-canvas');
const context = canvas.getContext('webgpu');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// Configure context and create pipeline...

function frame() {
    // Render scene...
    requestAnimationFrame(frame);  // Continuous loop
}
frame();
```

Run:
```bash
# Render 60 frames, save screenshot, exit
mystral run render.js --no-sdl --screenshot output.png --frames 60

# Render single frame
mystral run render.js --no-sdl --screenshot output.png --frames 1
```

**Exit behavior:** Scripts using `requestAnimationFrame` loops keep running. Use `--frames N` to exit after N frames.

### 3. Batch Rendering

For generating multiple images:

```javascript
// batch-render.js
async function renderFrame(scene, outputPath) {
    // Render scene...
    // Note: Screenshot is handled by CLI, not JS
}

// Process scenes...
// Exit by not calling requestAnimationFrame
```

## Auto-Exit Behavior

| Script Type | RAF Loop? | Timers? | Auto-Exit? | How to Exit |
|-------------|-----------|---------|------------|-------------|
| Compute-only | No | No | Yes | Automatic |
| One-shot render | No | No | Yes | Automatic |
| Render loop | Yes | - | No | `--frames N` |
| Game with timers | - | Yes | No | `--frames N` or stop timers |

The runtime checks for "idle" state (no RAF callbacks, no active timers) and exits after 3 consecutive idle frames.

## Server Deployment

### Linux Server (No Display)

```bash
# Works without X11/Wayland
mystral run compute.js --no-sdl

# With screenshot
mystral run render.js --no-sdl --screenshot /tmp/out.png --frames 1
```

### Docker Container

```dockerfile
FROM ubuntu:22.04

# Install GPU drivers (NVIDIA example)
RUN apt-get update && apt-get install -y nvidia-driver-535

# No need for xvfb or display server
COPY mystral /usr/local/bin/
COPY app.js /app/

CMD ["mystral", "run", "/app/app.js", "--no-sdl"]
```

### Cloud GPU Instances

Works on headless GPU instances (AWS, GCP, Azure) without configuring virtual displays:

```bash
# No DISPLAY variable needed
mystral run inference.js --no-sdl
```

## Limitations

1. **No audio** - Web Audio API requires SDL for audio output
2. **No input events** - No keyboard, mouse, or gamepad input
3. **No window resize** - Fixed dimensions set by `--width` and `--height`

## Examples

### Example: GPU Matrix Multiplication

```javascript
// matmul.js
async function main() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const N = 1024;
    const matrixA = new Float32Array(N * N);
    const matrixB = new Float32Array(N * N);
    // Initialize matrices...

    // Create shader, buffers, run compute...

    console.log("Matrix multiplication complete");
    // Exits automatically
}
main();
```

```bash
mystral run matmul.js --no-sdl
```

### Example: Headless Screenshot Test

```javascript
// test-render.js
const canvas = document.getElementById('engine-canvas');
const ctx = canvas.getContext('webgpu');
// Setup WebGPU...

function render() {
    // Draw test pattern
    requestAnimationFrame(render);
}
render();
```

```bash
# CI/CD test
mystral run test-render.js --no-sdl --screenshot test-output.png --frames 30
diff test-output.png expected.png
```

## Troubleshooting

### "No WebGPU adapter found"

Ensure GPU drivers are installed and accessible:
```bash
# Check for GPU
lspci | grep -i vga
nvidia-smi  # For NVIDIA

# Vulkan check (used by wgpu on Linux)
vulkaninfo
```

### Script doesn't exit

If using `requestAnimationFrame`, add `--frames N`:
```bash
mystral run game.js --no-sdl --frames 100
```

Or modify script to stop the RAF loop when done.

## See Also

- [CLI.md](./CLI.md) - Full CLI reference
- [examples/compute-test.js](../examples/compute-test.js) - Compute shader example
