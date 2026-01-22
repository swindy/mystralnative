# Mystral Native - Android Build

## Prerequisites

1. **Android Studio** (or command-line SDK tools)
2. **Android NDK** r25 or later
3. **CMake** 3.22.1+
4. **Mystral dependencies** downloaded

## Download Dependencies

```bash
# From mystralnative directory
cd internal_packages/mystralnative

# Download Android-specific dependencies
node scripts/download-deps.mjs --android

# Also need stb and cgltf (header-only libraries)
node scripts/download-deps.mjs --only stb
node scripts/download-deps.mjs --only cgltf
node scripts/download-deps.mjs --only quickjs
```

This downloads:
- `wgpu-android` - WebGPU implementation (aarch64, x86_64)
- `sdl3-android` - SDL3 Android development package

## Build with Android Studio

1. Open the `android/` folder in Android Studio
2. Let Gradle sync (will download Android SDK components)
3. Build > Make Project

## Build from Command Line

```bash
cd android

# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Install on connected device
./gradlew installDebug
```

## Architecture Support

| ABI | Description | Notes |
|-----|-------------|-------|
| `arm64-v8a` | ARM64 (most devices) | Primary target |
| `x86_64` | Intel/AMD 64-bit | Emulator support |

## Project Structure

```
android/
├── app/
│   ├── build.gradle.kts     # App build config with NDK/CMake settings
│   ├── proguard-rules.pro   # ProGuard config
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/mystral/native/
│       │   └── MystralActivity.java    # SDL Activity subclass
│       └── res/
│           └── values/
│               ├── strings.xml
│               └── themes.xml
├── build.gradle.kts         # Root build file
├── gradle.properties        # Gradle/NDK settings
└── settings.gradle.kts      # Project settings
```

## How It Works

1. **SDLActivity** handles the Android lifecycle and creates a native window
2. **wgpu-native** creates a Vulkan surface from the ANativeWindow
3. **QuickJS** runs the JavaScript game code
4. **SDL3** provides input (touch, gamepad) and audio

## Loading Scripts

Scripts can be loaded from:
- **Assets**: `asset://scripts/main.js`
- **Internal storage**: `/data/data/com.mystral.native/files/game.js`
- **External URL**: `https://example.com/game.js` (requires INTERNET permission)

## Debugging

```bash
# View native logs
adb logcat -s Mystral SDL

# View all logs from app
adb logcat --pid=$(adb shell pidof com.mystral.native)
```

## Known Issues

1. **Vulkan 1.1 required** - Devices must support Vulkan 1.1 (Android 7.0+)
2. **No Canvas 2D yet** - Skia Android builds not integrated
3. **HTTP uses curl** - Should migrate to Java HttpURLConnection for better Android integration
