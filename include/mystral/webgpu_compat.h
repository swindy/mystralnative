/**
 * WebGPU Compatibility Header
 *
 * Provides compatibility between wgpu-native and Dawn WebGPU implementations.
 * These implementations have diverged in their C API naming and conventions.
 *
 * Usage: Include this header after including webgpu.h
 */

#ifndef MYSTRAL_WEBGPU_COMPAT_H
#define MYSTRAL_WEBGPU_COMPAT_H

#include <cstring>  // For strlen
#include <iostream>

// Exactly one of MYSTRAL_WEBGPU_WGPU or MYSTRAL_WEBGPU_DAWN must be defined
#if defined(MYSTRAL_WEBGPU_WGPU) && defined(MYSTRAL_WEBGPU_DAWN)
#error "Cannot define both MYSTRAL_WEBGPU_WGPU and MYSTRAL_WEBGPU_DAWN"
#endif

#if defined(MYSTRAL_WEBGPU_WGPU)
// ============================================================================
// wgpu-native v25+ uses the same standard WebGPU API naming as Dawn
// (v22 used older names; v25 adopted the unified webgpu.h standard header)
// ============================================================================

// Surface descriptors - macOS Metal
typedef WGPUSurfaceSourceMetalLayer WGPUSurfaceDescriptorFromMetalLayer_Compat;
#define WGPUSType_SurfaceDescriptorFromMetalLayer_Compat WGPUSType_SurfaceSourceMetalLayer

// Surface descriptors - Windows HWND
typedef WGPUSurfaceSourceWindowsHWND WGPUSurfaceDescriptorFromWindowsHWND_Compat;
#define WGPUSType_SurfaceDescriptorFromWindowsHWND_Compat WGPUSType_SurfaceSourceWindowsHWND

// Surface descriptors - Linux X11
typedef WGPUSurfaceSourceXlibWindow WGPUSurfaceDescriptorFromXlibWindow_Compat;
#define WGPUSType_SurfaceDescriptorFromXlibWindow_Compat WGPUSType_SurfaceSourceXlibWindow

// Surface descriptors - Android ANativeWindow
typedef WGPUSurfaceSourceAndroidNativeWindow WGPUSurfaceDescriptorFromAndroidNativeWindow_Compat;
#define WGPUSType_SurfaceDescriptorFromAndroidNativeWindow_Compat WGPUSType_SurfaceSourceAndroidNativeWindow

// Dawn proc initialization - not needed for wgpu-native
#define WGPU_NEEDS_PROC_INIT 0

// Texture copy types (v25+ uses same Texel* naming as Dawn)
typedef WGPUTexelCopyTextureInfo WGPUImageCopyTexture_Compat;
typedef WGPUTexelCopyBufferInfo WGPUImageCopyBuffer_Compat;
typedef WGPUTexelCopyBufferLayout WGPUTextureDataLayout_Compat;

// Buffer mapping status (v25+ uses WGPUMapAsyncStatus like Dawn)
typedef WGPUMapAsyncStatus WGPUBufferMapAsyncStatus_Compat;
#define WGPUBufferMapAsyncStatus_Success_Compat WGPUMapAsyncStatus_Success
#define WGPUBufferMapAsyncStatus_Unknown_Compat WGPUMapAsyncStatus_Unknown

// Surface texture status
#define WGPU_SURFACE_TEXTURE_STATUS_TYPE WGPUSurfaceGetCurrentTextureStatus
#define WGPUSurfaceGetCurrentTextureStatus_Success_Compat WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal
#define WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal_Compat WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal
#define WGPUSurfaceGetCurrentTextureStatus_Error_Compat WGPUSurfaceGetCurrentTextureStatus_Error

// Error types - v25 no longer has DeviceLost as an error type
// (same as Dawn - don't define to avoid duplicate case in switch)

// String views - v25+ wgpu-native uses WGPUStringView (same as Dawn)
inline WGPUStringView WGPU_STRING_VIEW(const char* str) {
    WGPUStringView sv;
    sv.data = str;
    sv.length = str ? strlen(str) : 0;
    return sv;
}
#define WGPU_STRING_VIEW_NULL WGPUStringView{ nullptr, 0 }

// Helper to print WGPUStringView
#define WGPU_PRINT_STRING_VIEW(sv) ((sv).data ? std::string((sv).data, (sv).length) : std::string("unknown"))

// Shader module - v25+ uses ShaderSourceWGSL (same as Dawn)
typedef WGPUShaderSourceWGSL WGPUShaderModuleWGSLDescriptor_Compat;
#define WGPUSType_ShaderModuleWGSLDescriptor_Compat WGPUSType_ShaderSourceWGSL

// Shader module descriptor setup helper
inline void setupShaderModuleWGSL(WGPUShaderModuleDescriptor* desc,
                                  WGPUShaderSourceWGSL* wgslDesc,
                                  const char* code) {
    wgslDesc->chain.next = nullptr;
    wgslDesc->chain.sType = WGPUSType_ShaderSourceWGSL;
    wgslDesc->code = WGPU_STRING_VIEW(code);
    desc->nextInChain = &wgslDesc->chain;
    desc->label = WGPU_STRING_VIEW_NULL;
}

// v25+ wgpu-native uses CallbackInfo structs (same as Dawn)
#define WGPU_BUFFER_MAP_USES_CALLBACK_INFO 1
#define WGPU_USES_CALLBACK_INFO_PATTERN 1

// Copy command
#define wgpuCommandEncoderCopyTextureToBuffer_Compat wgpuCommandEncoderCopyTextureToBuffer

// Vertex/Fragment state uses WGPUStringView for entryPoint (same as Dawn)
#define WGPU_SET_ENTRY_POINT(state, entry) (state).entryPoint = WGPU_STRING_VIEW(entry)

// Label setting - v25+ uses WGPUStringView (same as Dawn)
#define WGPU_SET_LABEL(desc, str) do { \
    static const char* _label_str = str; \
    (desc).label = WGPUStringView{ _label_str, strlen(_label_str) }; \
} while(0)

// WGPUOptionalBool - v25+ has this type (same as Dawn)
#define WGPU_OPTIONAL_BOOL_TRUE WGPUOptionalBool_True
#define WGPU_OPTIONAL_BOOL_FALSE WGPUOptionalBool_False
#define WGPU_OPTIONAL_BOOL_UNDEFINED WGPUOptionalBool_Undefined

#elif defined(MYSTRAL_WEBGPU_DAWN)
// ============================================================================
// Dawn uses newer WebGPU API naming
// ============================================================================

// Surface descriptors - macOS Metal
typedef WGPUSurfaceSourceMetalLayer WGPUSurfaceDescriptorFromMetalLayer_Compat;
#define WGPUSType_SurfaceDescriptorFromMetalLayer_Compat WGPUSType_SurfaceSourceMetalLayer

// Surface descriptors - Windows HWND
typedef WGPUSurfaceSourceWindowsHWND WGPUSurfaceDescriptorFromWindowsHWND_Compat;
#define WGPUSType_SurfaceDescriptorFromWindowsHWND_Compat WGPUSType_SurfaceSourceWindowsHWND

// Surface descriptors - Linux X11
typedef WGPUSurfaceSourceXlibWindow WGPUSurfaceDescriptorFromXlibWindow_Compat;
#define WGPUSType_SurfaceDescriptorFromXlibWindow_Compat WGPUSType_SurfaceSourceXlibWindow

// Surface descriptors - Android ANativeWindow
typedef WGPUSurfaceSourceAndroidNativeWindow WGPUSurfaceDescriptorFromAndroidNativeWindow_Compat;
#define WGPUSType_SurfaceDescriptorFromAndroidNativeWindow_Compat WGPUSType_SurfaceSourceAndroidNativeWindow

// Dawn proc initialization - Dawn requires setting up procs before use
#define WGPU_NEEDS_PROC_INIT 1

// Texture copy types (Dawn renamed Image* to Texel*)
typedef WGPUTexelCopyTextureInfo WGPUImageCopyTexture_Compat;
typedef WGPUTexelCopyBufferInfo WGPUImageCopyBuffer_Compat;
typedef WGPUTexelCopyBufferLayout WGPUTextureDataLayout_Compat;

// Buffer mapping status
typedef WGPUMapAsyncStatus WGPUBufferMapAsyncStatus_Compat;
#define WGPUBufferMapAsyncStatus_Success_Compat WGPUMapAsyncStatus_Success
// Note: Dawn doesn't have Pending - use Error as a sentinel for "not completed"
#define WGPUBufferMapAsyncStatus_Unknown_Compat WGPUMapAsyncStatus_Error

// Surface texture status - Dawn uses WGPUSurfaceGetCurrentTextureStatus enum
#define WGPU_SURFACE_TEXTURE_STATUS_TYPE WGPUSurfaceGetCurrentTextureStatus
#define WGPUSurfaceGetCurrentTextureStatus_Success_Compat WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal
#define WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal_Compat WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal
#define WGPUSurfaceGetCurrentTextureStatus_Error_Compat WGPUSurfaceGetCurrentTextureStatus_Error

// Error types - Dawn removed DeviceLost as an error type (maps to Unknown)
// Note: We don't define WGPUErrorType_DeviceLost_Compat to avoid duplicate case
// The switch statement should handle this with a comment instead

// String views - Dawn uses WGPUStringView instead of const char*
inline WGPUStringView WGPU_STRING_VIEW(const char* str) {
    WGPUStringView sv;
    sv.data = str;
    sv.length = str ? strlen(str) : 0;
    return sv;
}
#define WGPU_STRING_VIEW_NULL WGPUStringView{ nullptr, 0 }

// Helper to get C string from WGPUStringView (Dawn adapter info returns WGPUStringView)
inline const char* WGPU_STRING_VIEW_TO_CSTR(WGPUStringView sv, char* buffer, size_t bufferSize) {
    if (sv.data == nullptr || sv.length == 0) {
        return "unknown";
    }
    size_t copyLen = sv.length < bufferSize - 1 ? sv.length : bufferSize - 1;
    memcpy(buffer, sv.data, copyLen);
    buffer[copyLen] = '\0';
    return buffer;
}

// Macro to print WGPUStringView or use default
#define WGPU_PRINT_STRING_VIEW(sv) ((sv).data ? std::string((sv).data, (sv).length) : std::string("unknown"))

// Shader module - Dawn renamed WGSLDescriptor to ShaderSourceWGSL
typedef WGPUShaderSourceWGSL WGPUShaderModuleWGSLDescriptor_Compat;
#define WGPUSType_ShaderModuleWGSLDescriptor_Compat WGPUSType_ShaderSourceWGSL

// Shader module descriptor setup helper (Dawn uses ShaderSourceWGSL)
inline void setupShaderModuleWGSL(WGPUShaderModuleDescriptor* desc,
                                  WGPUShaderSourceWGSL* wgslDesc,
                                  const char* code) {
    wgslDesc->chain.next = nullptr;
    wgslDesc->chain.sType = WGPUSType_ShaderSourceWGSL;
    wgslDesc->code = WGPU_STRING_VIEW(code);
    desc->nextInChain = &wgslDesc->chain;
    desc->label = WGPU_STRING_VIEW_NULL;
}

// Buffer map callback has different signature in Dawn
// Dawn: uses WGPUBufferMapCallbackInfo struct with callback, userdata1, userdata2
// wgpu: void (*WGPUBufferMapCallback)(WGPUBufferMapAsyncStatus status, void* userdata)
#define WGPU_BUFFER_MAP_USES_CALLBACK_INFO 1

// Dawn async operations use CallbackInfo structs instead of separate callback + userdata
// The callback signatures are also different
#define WGPU_USES_CALLBACK_INFO_PATTERN 1

// Copy command naming
#define wgpuCommandEncoderCopyTextureToBuffer_Compat wgpuCommandEncoderCopyTextureToBuffer

// Vertex/Fragment state uses WGPUStringView for entryPoint
// Use this macro to set entry points
#define WGPU_SET_ENTRY_POINT(state, entry) (state).entryPoint = WGPU_STRING_VIEW(entry)

// Label setting - Dawn uses WGPUStringView (use compound literal for C++)
#define WGPU_SET_LABEL(desc, str) do { \
    static const char* _label_str = str; \
    (desc).label = WGPUStringView{ _label_str, strlen(_label_str) }; \
} while(0)

// WGPUOptionalBool - Dawn has this type for tri-state booleans
// depthWriteEnabled uses WGPUOptionalBool in Dawn
#define WGPU_OPTIONAL_BOOL_TRUE WGPUOptionalBool_True
#define WGPU_OPTIONAL_BOOL_FALSE WGPUOptionalBool_False
#define WGPU_OPTIONAL_BOOL_UNDEFINED WGPUOptionalBool_Undefined

#else
#error "Either MYSTRAL_WEBGPU_WGPU or MYSTRAL_WEBGPU_DAWN must be defined"
#endif

// ============================================================================
// Common helpers
// ============================================================================

inline bool wgpuSurfaceTextureStatusIsSuccess(int status) {
    return status == WGPUSurfaceGetCurrentTextureStatus_Success_Compat;
    // Note: Suboptimal is also considered success on wgpu, but Dawn maps both to Success
}

#endif // MYSTRAL_WEBGPU_COMPAT_H
