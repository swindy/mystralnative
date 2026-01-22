# Mystral Native CLI Reference

The `mystral` command-line interface provides a simple way to run JavaScript games using WebGPU natively.

## Synopsis

```bash
mystral run <script.js> [options]
mystral compile <entry.js> [options]
mystral --compile <entry.js> [options]
mystral --version
mystral --help
```

## Commands

### `run <script.js>`

Run a JavaScript file with full WebGPU support. TypeScript is supported when SWC is installed.

```bash
mystral run game.js
mystral run app.js --width 1920 --height 1080
mystral run game.ts
```

### `compile <entry.js>`

Bundle JavaScript and assets into a single self-contained binary.

```bash
# Bundle JS + assets into ./my-game
mystral compile examples/game.js --include assets

# Specify output path
mystral compile examples/game.js --include assets --out dist/my-game

# Use a custom bundle root
mystral compile examples/game.js --include assets --root .
```

Compiled binaries automatically run the embedded entry script when launched
with no arguments.

Bundle paths are stored relative to `--root`, so `fetch("assets/foo.png")`
resolves from the bundle regardless of the current working directory.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--width <n>` | Window width in pixels | 1280 |
| `--height <n>` | Window height in pixels | 720 |
| `--title <str>` | Window title | "Mystral" |
| `--headless` | Run with hidden window (background mode) | - |
| `--no-sdl` | Run without SDL/window system (headless GPU) | - |
| `--screenshot <file>` | Take screenshot and exit after N frames | - |
| `--frames <n>` | Number of frames before screenshot | 60 |
| `--quiet`, `-q` | Suppress all output | - |
| `--include <dir>` | Asset directory to bundle (repeatable) | - |
| `--assets <dir>` | Alias for `--include` | - |
| `--output <file>` | Output binary path | `./<entry-stem>` |
| `--out`, `-o <file>` | Alias for `--output` | - |
| `--root <dir>` | Root directory for bundle paths | `cwd` |

## Screenshot Mode

The CLI supports headless screenshot mode for automated testing:

```bash
# Take a screenshot after 60 frames (default)
mystral run render-test.js --screenshot output.png

# Take a screenshot after 120 frames
mystral run render-test.js --screenshot output.png --frames 120

# Headless mode (hidden window) with screenshot
MYSTRAL_HEADLESS=1 mystral run test.js --screenshot result.png --frames 30
```

When `--screenshot` is specified:
1. Creates a window (hidden if `--headless` or `MYSTRAL_HEADLESS=1`)
2. Runs the script for N frames
3. Saves a PNG screenshot to the specified path
4. Exits automatically

This is useful for:
- **Automated visual regression testing** - Compare screenshots against baselines
- **CI/CD pipelines** - Verify rendering without a display
- **Headless rendering** - Generate images from scripts

## Headless Mode

Headless mode runs the application with a hidden window. This is useful for:
- Automated testing without a display
- Server-side rendering
- CI/CD environments
- Screenshot generation

Enable headless mode in two ways:

```bash
# Using the --headless flag
mystral run game.js --headless

# Using the environment variable
MYSTRAL_HEADLESS=1 mystral run game.js
```

In headless mode:
- Window is created but hidden (not visible on screen)
- WebGPU rendering still works (GPU is used)
- Screenshots can be captured with `--screenshot`
- All JavaScript APIs work normally

```bash
# Common pattern: headless + screenshot for testing
MYSTRAL_HEADLESS=1 mystral run test.js --screenshot output.png --frames 60
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MYSTRAL_HEADLESS=1` | Run in headless mode (hidden window) |
| `MYSTRAL_DEBUG=1` | Enable verbose debug logging |

## Examples

### Basic Usage

```bash
# Run a game script
mystral run my-game.js

# Custom window size
mystral run my-game.js --width 1920 --height 1080 --title "My Game"
```

### Headless Testing

```bash
# Screenshot mode for testing
mystral run render-test.js --screenshot test-results/output.png --frames 60

# Fully headless with hidden window
MYSTRAL_HEADLESS=1 mystral run test.js --screenshot out.png --quiet
```

### Debugging

```bash
# Enable debug logging
MYSTRAL_DEBUG=1 mystral run debug-scene.js

# Verify version
mystral --version
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (script error, screenshot failed, etc.) |

## Output Format

By default, the CLI prints:
- Version and script info
- Window dimensions
- WebGPU adapter info
- JavaScript console output (`console.log`, `console.error`)

Use `--quiet` to suppress all output except errors.

## No-SDL Mode (Headless GPU)

The `--no-sdl` flag runs without any window system, using only the GPU directly. This is different from `--headless` which still creates a hidden window.

```bash
# Run compute shader without any window
mystral run compute.js --no-sdl

# Render to offscreen texture and capture screenshot
mystral run render.js --no-sdl --screenshot output.png --frames 60
```

**Key differences from `--headless`:**

| Mode | Window | GPU | Use Case |
|------|--------|-----|----------|
| `--headless` | Hidden (SDL required) | Yes | Testing on systems with display server |
| `--no-sdl` | None (no SDL) | Yes | Servers without X11/Wayland, pure compute |

**Auto-exit behavior in `--no-sdl` mode:**
- Scripts using `requestAnimationFrame` loops need `--frames N` to exit
- Compute-only scripts (no RAF) exit automatically when async work completes

See [headless-gpu.md](./headless-gpu.md) for detailed documentation on headless GPU usage.

## See Also

- [README.md](../README.md) - Quick start guide
- [JavaScript APIs](../README.md#javascript-apis) - Available Web APIs
- [headless-gpu.md](./headless-gpu.md) - Headless GPU mode documentation
