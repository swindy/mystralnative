# V8 Prebuilt Binaries

This document describes how we obtain V8 prebuilt binaries and the plan for maintaining our own fork.

## Current Source

We currently use prebuilt V8 binaries from:

**Repository**: https://github.com/kuoruan/libv8

**Release**: v13.1.201.22 (from ~1 year ago)

### Available Platforms

| Platform | Architecture | File | Library Name |
|----------|--------------|------|--------------|
| macOS | arm64 | v8_macOS_arm64.tar.xz | libv8_monolith.a |
| macOS | x64 | v8_macOS_x64.tar.xz | libv8_monolith.a |
| Linux | x64 | v8_Linux_x64.tar.xz | libv8_monolith.a |
| Windows | x64 | v8_Windows_x64.7z | v8_monolith.lib |

### Download URLs

```
https://github.com/kuoruan/libv8/releases/download/v13.1.201.22/v8_macOS_arm64.tar.xz
https://github.com/kuoruan/libv8/releases/download/v13.1.201.22/v8_macOS_x64.tar.xz
https://github.com/kuoruan/libv8/releases/download/v13.1.201.22/v8_Linux_x64.tar.xz
https://github.com/kuoruan/libv8/releases/download/v13.1.201.22/v8_Windows_x64.7z
```

## Archive Structure

After extraction, the directory structure is:

```
v8/
├── include/
│   ├── v8.h
│   ├── v8-platform.h
│   ├── v8-version.h
│   ├── libplatform/
│   │   └── libplatform.h
│   └── ... (other headers)
└── lib/
    └── libv8_monolith.a  (or v8_monolith.lib on Windows)
```

## Future: Fork and Maintain Our Own Builds

The kuoruan/libv8 release is about a year old. For production use, we should:

1. **Fork the repository** and set up our own CI/CD to build V8
2. **Update to latest V8** version regularly
3. **Add missing platforms** (Linux arm64, etc.)

### Reference Forks

These forks have more recent updates:

| Fork | Platform Focus | Notes |
|------|---------------|-------|
| [rifkikesepara/libv8](https://github.com/rifkikesepara/libv8) | Windows | Updated Windows builds |
| [vincenwu/libv8](https://github.com/vincenwu/libv8) | Linux | Updated Linux builds |

**Note**: No one has made updated macOS builds yet (as of Jan 2025).

### Building V8 Yourself

If you need to build V8 from source:

1. **Install depot_tools**:
   ```bash
   git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
   export PATH="$PATH:$(pwd)/depot_tools"
   ```

2. **Fetch V8**:
   ```bash
   mkdir v8 && cd v8
   fetch v8
   cd v8
   ```

3. **Build monolithic library**:
   ```bash
   # Generate build files
   tools/dev/v8gen.py x64.release -- \
     is_component_build=false \
     v8_monolithic=true \
     v8_use_external_startup_data=false \
     use_custom_libcxx=false

   # Build
   ninja -C out.gn/x64.release v8_monolith
   ```

4. **Output**: `out.gn/x64.release/obj/libv8_monolith.a`

### GitHub Actions for Automated Builds

When we fork, we should set up GitHub Actions to:

1. Build for all platforms on each release
2. Upload binaries as release assets
3. Run on a schedule to stay up-to-date with V8

See kuoruan/libv8's `.github/workflows/` for reference.

## Alternatives to V8

If V8 is too complex to maintain, consider:

| Engine | JIT? | Size | Platforms | Notes |
|--------|------|------|-----------|-------|
| **QuickJS** | No | ~200KB | All | Simple, no JIT |
| **JavaScriptCore** | Yes | 0 (system) | Apple only | System framework |
| **Hermes** | Yes | ~2MB | All | React Native's engine |

## Version History

| Date | Version | Notes |
|------|---------|-------|
| 2025-01 | v13.1.201.22 | Initial integration from kuoruan/libv8 |

---

## TODO

- [ ] Fork kuoruan/libv8 to our org
- [ ] Set up GitHub Actions for automated builds
- [ ] Add macOS arm64 builds to CI
- [ ] Update to latest V8 version
- [ ] Add Linux arm64 builds
- [ ] Document JIT-less mode for iOS/consoles
