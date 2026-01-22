/**
 * GLTF PBR Renderer Example
 *
 * Demonstrates rendering a GLTF model with PBR materials using the native runtime.
 * Uses the same IBL approach as the main Mystral Engine (from DeferredLightingPass.ts).
 *
 * Features:
 * - PBR Cook-Torrance BRDF
 * - Real cube texture for IBL (not procedural)
 * - Roughness-based LOD for specular reflections
 * - Hemisphere interpolation for diffuse IBL
 * - Skybox rendering
 */

// Declare the Mystral namespace
declare const Mystral: {
    loadGLTF: (path: string) => GLTFData;
};

// GLTF Types
interface GLTFData {
    meshes: GLTFMesh[];
    materials: GLTFMaterial[];
    images: GLTFImage[];
    nodes: GLTFNode[];
    scenes: GLTFScene[];
}

interface GLTFMesh {
    name: string;
    primitives: GLTFPrimitive[];
}

interface GLTFPrimitive {
    positions: Float32Array;
    positionCount: number;
    normals?: Float32Array;
    texcoords?: Float32Array;
    tangents?: Float32Array;
    indices?: Uint32Array;
    indexCount: number;
    materialIndex: number;
}

interface GLTFMaterial {
    name: string;
    baseColorFactor: number[];
    metallicFactor: number;
    roughnessFactor: number;
    baseColorTextureIndex: number;
    normalTextureIndex: number;
    metallicRoughnessTextureIndex: number;
    emissiveTextureIndex: number;
    occlusionTextureIndex: number;
}

interface GLTFImage {
    name: string;
    uri: string;
    mimeType: string;
    data?: Uint8Array;
}

interface GLTFNode {
    name: string;
    meshIndex: number;
    translation: number[];
    rotation: number[];
    scale: number[];
    children: number[];
}

interface GLTFScene {
    name: string;
    nodes: number[];
}

// Skybox shader - renders the environment cube as background
const skyboxShaderCode = /* wgsl */`
    struct SceneUniforms {
        viewMatrix: mat4x4f,
        projectionMatrix: mat4x4f,
        cameraPosition: vec3f,
        environmentIntensity: f32,
    }

    @group(0) @binding(0) var<uniform> scene: SceneUniforms;
    @group(0) @binding(1) var envMap: texture_cube<f32>;
    @group(0) @binding(2) var envSampler: sampler;

    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) uvw: vec3f,
    }

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var output: VertexOutput;

        let pos = array<vec3f, 36>(
            vec3f(-1,  1, -1), vec3f(-1, -1, -1), vec3f( 1, -1, -1),
            vec3f( 1, -1, -1), vec3f( 1,  1, -1), vec3f(-1,  1, -1),
            vec3f(-1, -1,  1), vec3f(-1, -1, -1), vec3f(-1,  1, -1),
            vec3f(-1,  1, -1), vec3f(-1,  1,  1), vec3f(-1, -1,  1),
            vec3f( 1, -1, -1), vec3f( 1, -1,  1), vec3f( 1,  1,  1),
            vec3f( 1,  1,  1), vec3f( 1,  1, -1), vec3f( 1, -1, -1),
            vec3f(-1, -1,  1), vec3f(-1,  1,  1), vec3f( 1,  1,  1),
            vec3f( 1,  1,  1), vec3f( 1, -1,  1), vec3f(-1, -1,  1),
            vec3f(-1,  1, -1), vec3f( 1,  1, -1), vec3f( 1,  1,  1),
            vec3f( 1,  1,  1), vec3f(-1,  1,  1), vec3f(-1,  1, -1),
            vec3f(-1, -1, -1), vec3f(-1, -1,  1), vec3f( 1, -1, -1),
            vec3f( 1, -1, -1), vec3f(-1, -1,  1), vec3f( 1, -1,  1)
        );

        let p = pos[vertexIndex];
        output.uvw = p;

        // Remove translation from view matrix for skybox
        var view = scene.viewMatrix;
        view[3] = vec4f(0.0, 0.0, 0.0, 1.0);

        let clipPos = scene.projectionMatrix * view * vec4f(p, 1.0);
        output.position = clipPos.xyww;
        return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        var color = textureSample(envMap, envSampler, normalize(input.uvw)).rgb;
        // Apply environment intensity
        color *= scene.environmentIntensity;
        // Tone mapping for skybox
        color = color / (color + vec3f(1.0));
        color = pow(color, vec3f(1.0 / 2.2));
        return vec4f(color, 1.0);
    }
`;

// PBR Shader using real cube texture IBL (matching DeferredLightingPass.ts)
const pbrShaderCode = /* wgsl */`
    const PI = 3.14159265359;
    const MAX_LIGHTS = 4u;

    struct Light {
        position: vec3f,
        intensity: f32,
        direction: vec3f,
        lightType: u32,  // 0=directional, 1=point
        color: vec3f,
        _pad: f32,
    }

    struct SceneUniforms {
        viewMatrix: mat4x4f,
        projectionMatrix: mat4x4f,
        cameraPosition: vec3f,
        time: f32,
        lightCount: u32,
        environmentIntensity: f32,
        _pad2: f32,
        _pad3: f32,
        lights: array<Light, MAX_LIGHTS>,
    }

    struct ModelUniforms {
        modelMatrix: mat4x4f,
        normalMatrix: mat4x4f,
    }

    struct MaterialUniforms {
        baseColor: vec3f,
        metallic: f32,
        roughness: f32,
        emissiveFactor: f32,
        textureFlags: u32,
        _pad: f32,
    }

    @group(0) @binding(0) var<uniform> scene: SceneUniforms;
    @group(0) @binding(1) var envMap: texture_cube<f32>;
    @group(0) @binding(2) var envSampler: sampler;

    @group(1) @binding(0) var<uniform> model: ModelUniforms;

    @group(2) @binding(0) var<uniform> material: MaterialUniforms;
    @group(2) @binding(1) var texSampler: sampler;
    @group(2) @binding(2) var baseColorTex: texture_2d<f32>;
    @group(2) @binding(3) var normalTex: texture_2d<f32>;
    @group(2) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
    @group(2) @binding(5) var emissiveTex: texture_2d<f32>;
    @group(2) @binding(6) var occlusionTex: texture_2d<f32>;

    struct VertexInput {
        @location(0) position: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f,
    }

    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) worldPosition: vec3f,
        @location(1) worldNormal: vec3f,
        @location(2) uv: vec2f,
    }

    @vertex
    fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        let worldPos = model.modelMatrix * vec4f(input.position, 1.0);
        output.worldPosition = worldPos.xyz;
        output.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
        output.worldNormal = (model.normalMatrix * vec4f(input.normal, 0.0)).xyz;
        output.uv = input.uv;

        return output;
    }

    // PBR Functions
    fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
        let a = roughness * roughness;
        let a2 = a * a;
        let NdotH = max(dot(N, H), 0.0);
        let NdotH2 = NdotH * NdotH;
        let num = a2;
        let denom = NdotH2 * (a2 - 1.0) + 1.0;
        return num / (PI * denom * denom);
    }

    fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
        let r = roughness + 1.0;
        let k = (r * r) / 8.0;
        return NdotV / (NdotV * (1.0 - k) + k);
    }

    fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
        let NdotV = max(dot(N, V), 0.0);
        let NdotL = max(dot(N, L), 0.0);
        return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
    }

    fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }

    const HAS_BASE_COLOR_TEX = 1u;
    const HAS_NORMAL_TEX = 2u;
    const HAS_METALLIC_ROUGHNESS_TEX = 4u;
    const HAS_EMISSIVE_TEX = 8u;
    const HAS_OCCLUSION_TEX = 16u;

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        var N = normalize(input.worldNormal);
        let V = normalize(scene.cameraPosition - input.worldPosition);
        let uv = input.uv;

        // Base color
        var baseColor = material.baseColor;
        if ((material.textureFlags & HAS_BASE_COLOR_TEX) != 0u) {
            let texColor = textureSample(baseColorTex, texSampler, uv);
            baseColor = baseColor * texColor.rgb;
        }

        // Normal mapping
        if ((material.textureFlags & HAS_NORMAL_TEX) != 0u) {
            let mapNormal = textureSample(normalTex, texSampler, uv).xyz * 2.0 - 1.0;
            let Q1 = dpdx(input.worldPosition);
            let Q2 = dpdy(input.worldPosition);
            let st1 = dpdx(uv);
            let st2 = dpdy(uv);
            let T = normalize(Q1 * st2.y - Q2 * st1.y);
            let B = -normalize(cross(N, T));
            let TBN = mat3x3f(T, B, N);
            N = normalize(TBN * mapNormal);
        }

        // Metallic/Roughness
        var metallic = material.metallic;
        var roughness = material.roughness;
        if ((material.textureFlags & HAS_METALLIC_ROUGHNESS_TEX) != 0u) {
            let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
            roughness = mrSample.g * material.roughness;
            metallic = mrSample.b * material.metallic;
        }
        roughness = max(roughness, 0.04);

        // Emissive
        var emissive = vec3f(0.0);
        if ((material.textureFlags & HAS_EMISSIVE_TEX) != 0u) {
            emissive = textureSample(emissiveTex, texSampler, uv).rgb * material.emissiveFactor;
        }

        // Occlusion
        var occlusion = 1.0;
        if ((material.textureFlags & HAS_OCCLUSION_TEX) != 0u) {
            occlusion = textureSample(occlusionTex, texSampler, uv).r;
        }

        // Fresnel reflectance at normal incidence
        var F0 = vec3f(0.04);
        F0 = mix(F0, baseColor, metallic);

        // ==================================
        // IBL Calculations (from DeferredLightingPass.ts)
        // ==================================
        let R = reflect(-V, N);
        let NdotV = max(dot(N, V), 0.0);

        // Specular IBL: sample environment in reflection direction with roughness-based LOD
        let numLevels = f32(textureNumLevels(envMap));
        let lod = roughness * (numLevels - 1.0);
        let iblSpecular = textureSampleLevel(envMap, envSampler, R, lod).rgb;

        // Diffuse IBL: hemisphere interpolation based on normal
        let diffuseLOD = numLevels - 2.0;
        let skyColor = textureSampleLevel(envMap, envSampler, vec3f(0.0, 1.0, 0.0), diffuseLOD).rgb;
        let groundColor = textureSampleLevel(envMap, envSampler, vec3f(0.0, -1.0, 0.0), diffuseLOD).rgb;
        let hemiMix = N.y * 0.5 + 0.5;
        let iblDiffuse = mix(groundColor, skyColor, hemiMix);

        // IBL Fresnel
        let F_IBL = fresnelSchlick(NdotV, F0);
        let kS_IBL = F_IBL;
        var kD_IBL = vec3f(1.0) - kS_IBL;
        kD_IBL *= 1.0 - metallic;

        // Combined IBL with environment intensity and occlusion
        let ambientIBL = (kD_IBL * baseColor * iblDiffuse + iblSpecular * F_IBL) * scene.environmentIntensity * occlusion;

        // ==================================
        // Direct Lighting - Hardcoded sun for testing
        // ==================================
        var Lo = vec3f(0.0);

        // Hardcoded directional sun light (bypassing buffer)
        let sunDir = normalize(vec3f(1.0, 1.0, 0.5));
        let sunColor = vec3f(1.0, 0.98, 0.95);
        let sunIntensity = 5.0;

        let L = sunDir;  // Light direction towards surface
        let H = normalize(V + L);
        let radiance = sunColor * sunIntensity;

        let NDF = distributionGGX(N, H, roughness);
        let G = geometrySmith(N, V, L, roughness);
        let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        let numerator = NDF * G * F;
        let NdotL = max(dot(N, L), 0.0);
        let denominator = 4.0 * NdotV * NdotL + 0.0001;
        let specular = numerator / denominator;

        let kS = F;
        var kD = vec3f(1.0) - kS;
        kD *= 1.0 - metallic;

        Lo = (kD * baseColor / PI + specular) * radiance * NdotL;

        // ==================================
        // Final Composition
        // ==================================
        var color = ambientIBL + Lo + emissive;

        // DEBUG: Uncomment one of these to visualize different components:
        return vec4f(baseColor, 1.0);  // Base color only
        // return vec4f(vec3f(metallic), 1.0);  // Metallic map (white=metal, black=dielectric)
        // return vec4f(vec3f(roughness), 1.0);  // Roughness map
        // return vec4f(N * 0.5 + 0.5, 1.0);  // Normal map
        // return vec4f(iblSpecular, 1.0);  // IBL specular only
        // return vec4f(Lo, 1.0);  // Direct lighting only

        // Reinhard tone mapping
        color = color / (color + vec3f(1.0));

        // Gamma correction
        color = pow(color, vec3f(1.0 / 2.2));

        return vec4f(color, 1.0);
    }
`;

console.log("GLTF PBR Renderer - Starting");

// Load the damaged helmet
const helmetPath = "/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/DamagedHelmet/glTF-Binary/DamagedHelmet.glb";
console.log("Loading: " + helmetPath);

let gltf: GLTFData;
try {
    gltf = Mystral.loadGLTF(helmetPath);
    console.log("Loaded GLTF: " + gltf.meshes.length + " meshes, " + gltf.materials.length + " materials, " + gltf.images.length + " images");
} catch (e: any) {
    console.log("Error loading GLTF: " + (e.message || e));
    throw e;
}

// ============================================
// HDR Loader (ported from Mystral's HDRLoader.ts)
// Parses Radiance HDR format with RGBE encoding
// ============================================
function parseHDR(buffer: ArrayBuffer): { width: number, height: number, data: Float32Array } {
    const data = new Uint8Array(buffer);
    let pos = 0;

    // Read Header - skip lines until empty line
    while (pos < data.length) {
        let line = '';
        while (pos < data.length && data[pos] !== 0x0a) {
            line += String.fromCharCode(data[pos]);
            pos++;
        }
        pos++; // skip \n
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.length === 0) break;
    }

    // Parse Resolution
    let width = 0;
    let height = 0;

    let resLine = '';
    while (pos < data.length && data[pos] !== 0x0a) {
        resLine += String.fromCharCode(data[pos]);
        pos++;
    }
    pos++;
    if (resLine.endsWith('\r')) resLine = resLine.slice(0, -1);

    const parts = resLine.trim().split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '-Y' || parts[i] === '+Y') height = parseInt(parts[i+1]);
        if (parts[i] === '+X' || parts[i] === '-X') width = parseInt(parts[i+1]);
    }

    if (width === 0 || height === 0) {
        throw new Error(`HDR: Invalid resolution: "${resLine}"`);
    }

    // Read RGBE Data
    const floatData = new Float32Array(width * height * 4);
    const scanlineBuffer = new Uint8Array(width * 4);
    let ptr = pos;

    for (let y = 0; y < height; y++) {
        const idxStart = y * width * 4;

        // Check for New RLE encoding
        if (ptr + 4 <= data.length && data[ptr] === 2 && data[ptr+1] === 2 &&
            data[ptr+2] === ((width >> 8) & 0xFF) && data[ptr+3] === (width & 0xFF)) {
            ptr += 4;

            for (let ch = 0; ch < 4; ch++) {
                let extracted = 0;
                while (extracted < width) {
                    const val = data[ptr++];
                    if (val > 128) {
                        const count = val - 128;
                        const runVal = data[ptr++];
                        for (let i = 0; i < count; i++) {
                            scanlineBuffer[extracted + ch * width] = runVal;
                            extracted++;
                        }
                    } else {
                        const count = val;
                        for (let i = 0; i < count; i++) {
                            scanlineBuffer[extracted + ch * width] = data[ptr++];
                            extracted++;
                        }
                    }
                }
            }

            // Convert RGBE to float
            for (let x = 0; x < width; x++) {
                const r = scanlineBuffer[x];
                const g = scanlineBuffer[x + width];
                const b = scanlineBuffer[x + 2 * width];
                const e = scanlineBuffer[x + 3 * width];

                const outIdx = idxStart + x * 4;
                if (e === 0) {
                    floatData[outIdx] = 0; floatData[outIdx+1] = 0; floatData[outIdx+2] = 0; floatData[outIdx+3] = 1;
                } else {
                    const f = Math.pow(2.0, e - 128 - 8);
                    floatData[outIdx] = r * f;
                    floatData[outIdx+1] = g * f;
                    floatData[outIdx+2] = b * f;
                    floatData[outIdx+3] = 1;
                }
            }
        } else {
            // Uncompressed
            for (let x = 0; x < width; x++) {
                const r = data[ptr++];
                const g = data[ptr++];
                const b = data[ptr++];
                const e = data[ptr++];
                const outIdx = idxStart + x * 4;

                if (e === 0) {
                    floatData[outIdx] = 0; floatData[outIdx+1] = 0; floatData[outIdx+2] = 0; floatData[outIdx+3] = 1;
                } else {
                    const f = Math.pow(2.0, e - 128 - 8);
                    floatData[outIdx] = r * f;
                    floatData[outIdx+1] = g * f;
                    floatData[outIdx+2] = b * f;
                    floatData[outIdx+3] = 1;
                }
            }
        }
    }

    return { width, height, data: floatData };
}

// Pack Float32 to Float16 for rgba16float texture
function packToHalf(data: Float32Array): Uint16Array {
    const out = new Uint16Array(data.length);
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);
    const HALF_MAX = 0x7bff; // Max normal half-float

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (Number.isNaN(val)) { out[i] = 0; continue; }

        floatView[0] = val;
        const x = int32View[0];
        const bits = (x >> 16) & 0x8000; // Sign bit
        let m = (x >> 12) & 0x07ff;
        const e = (x >> 23) & 0xff;

        if (e < 103) { out[i] = bits; continue; } // Underflow
        if (e > 142) { out[i] = bits | HALF_MAX; continue; } // Overflow - clamp
        if (e < 113) { m |= 0x0800; out[i] = bits | ((m >> (114 - e)) + ((m >> (113 - e)) & 1)); continue; } // Denormals
        out[i] = bits | ((e - 112) << 10) | ((m >> 1) + (m & 1)); // Normal
    }
    return out;
}

// ============================================
// Load HDR equirectangular and convert to cubemap
// ============================================
async function loadEnvironmentMap(device: GPUDevice, url: string, resolution: number = 512): Promise<{ texture: GPUTexture, view: GPUTextureView, sampler: GPUSampler }> {
    console.log("Loading HDR environment map: " + url);

    // 1. Load and parse HDR file
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const hdr = parseHDR(buffer);
    const width = hdr.width;
    const height = hdr.height;
    const equirectData = hdr.data; // Float32 HDR data

    // Log dynamic range
    let maxVal = 0;
    for (let i = 0; i < equirectData.length; i += 4) {
        const lum = equirectData[i] * 0.2126 + equirectData[i+1] * 0.7152 + equirectData[i+2] * 0.0722;
        if (lum > maxVal) maxVal = lum;
    }
    console.log("Loaded HDR: " + width + "x" + height + ", max luminance: " + maxVal.toFixed(2));

    // 2. Helper functions
    function getDirection(face: number, u: number, v: number): [number, number, number] {
        const uc = 2.0 * u - 1.0;
        const vc = 2.0 * v - 1.0;
        switch (face) {
            case 0: return [1, -vc, -uc];   // +X
            case 1: return [-1, -vc, uc];   // -X
            case 2: return [uc, 1, vc];     // +Y
            case 3: return [uc, -1, -vc];   // -Y
            case 4: return [uc, -vc, 1];    // +Z
            case 5: return [-uc, -vc, -1];  // -Z
        }
        return [0, 0, 0];
    }

    function normalize(v: [number, number, number]): [number, number, number] {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0, 0, 0];
    }

    function dirToEquirect(dir: [number, number, number]): [number, number] {
        const d = normalize(dir);
        const phi = Math.atan2(d[2], d[0]);
        const theta = Math.acos(Math.max(-1, Math.min(1, d[1])));
        const u = (phi + Math.PI) / (2 * Math.PI);
        const v = theta / Math.PI;
        return [u, v];
    }

    function sampleEquirect(u: number, v: number): [number, number, number, number] {
        // Bilinear sampling
        const fx = u * width - 0.5;
        const fy = v * height - 0.5;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = (x0 + 1) % width;
        const y1 = Math.min(y0 + 1, height - 1);
        const wx = fx - x0;
        const wy = fy - y0;

        const getPixel = (x: number, y: number) => {
            const px = ((x % width) + width) % width;
            const py = Math.max(0, Math.min(height - 1, y));
            const idx = (py * width + px) * 4;
            return [equirectData[idx], equirectData[idx+1], equirectData[idx+2], equirectData[idx+3]];
        };

        const p00 = getPixel(x0, y0);
        const p10 = getPixel(x1, y0);
        const p01 = getPixel(x0, y1);
        const p11 = getPixel(x1, y1);

        const r = p00[0]*(1-wx)*(1-wy) + p10[0]*wx*(1-wy) + p01[0]*(1-wx)*wy + p11[0]*wx*wy;
        const g = p00[1]*(1-wx)*(1-wy) + p10[1]*wx*(1-wy) + p01[1]*(1-wx)*wy + p11[1]*wx*wy;
        const b = p00[2]*(1-wx)*(1-wy) + p10[2]*wx*(1-wy) + p01[2]*(1-wx)*wy + p11[2]*wx*wy;
        const a = p00[3]*(1-wx)*(1-wy) + p10[3]*wx*(1-wy) + p01[3]*(1-wx)*wy + p11[3]*wx*wy;

        return [r, g, b, a];
    }

    // 3. Create cube texture with HDR format (rgba16float)
    const mipLevels = Math.floor(Math.log2(resolution)) + 1;
    const cubeTexture = device.createTexture({
        label: 'Environment Cubemap HDR',
        size: [resolution, resolution, 6],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        mipLevelCount: mipLevels,
    });

    // 4. Convert and upload each face (HDR float data)
    const basePixels: Float32Array[] = [];

    for (let face = 0; face < 6; face++) {
        const faceData = new Float32Array(resolution * resolution * 4);

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const u = (x + 0.5) / resolution;
                const v = (y + 0.5) / resolution;
                const dir = getDirection(face, u, v);
                const [eu, ev] = dirToEquirect(dir);
                const [r, g, b, a] = sampleEquirect(eu, ev);

                const idx = (y * resolution + x) * 4;
                faceData[idx] = r;
                faceData[idx + 1] = g;
                faceData[idx + 2] = b;
                faceData[idx + 3] = a;
            }
        }

        basePixels.push(faceData);

        // Pack Float32 to Float16 for upload
        const halfData = packToHalf(faceData);
        device.queue.writeTexture(
            { texture: cubeTexture, origin: [0, 0, face], mipLevel: 0 },
            halfData,
            { bytesPerRow: resolution * 8, rowsPerImage: resolution }, // 4 channels * 2 bytes
            [resolution, resolution, 1]
        );
    }

    console.log("Converted HDR equirectangular to cubemap faces");

    // 5. Generate mipmaps (CPU-based with HDR data)
    let currentRes = resolution;
    let currentPixels = basePixels;

    for (let level = 1; level < mipLevels; level++) {
        const nextRes = Math.floor(currentRes / 2);
        if (nextRes < 1) break;

        const nextPixels: Float32Array[] = [];

        for (let face = 0; face < 6; face++) {
            const src = currentPixels[face];
            const dst = new Float32Array(nextRes * nextRes * 4);

            for (let y = 0; y < nextRes; y++) {
                for (let x = 0; x < nextRes; x++) {
                    const srcX = x * 2;
                    const srcY = y * 2;
                    let r = 0, g = 0, b = 0, a = 0;

                    for (let dy = 0; dy < 2; dy++) {
                        for (let dx = 0; dx < 2; dx++) {
                            const sIdx = ((srcY + dy) * currentRes + (srcX + dx)) * 4;
                            r += src[sIdx]; g += src[sIdx + 1]; b += src[sIdx + 2]; a += src[sIdx + 3];
                        }
                    }

                    const idx = (y * nextRes + x) * 4;
                    dst[idx] = r / 4;     // HDR float, no rounding
                    dst[idx + 1] = g / 4;
                    dst[idx + 2] = b / 4;
                    dst[idx + 3] = a / 4;
                }
            }

            nextPixels.push(dst);

            // Pack to half-float and upload
            const halfData = packToHalf(dst);
            device.queue.writeTexture(
                { texture: cubeTexture, origin: [0, 0, face], mipLevel: level },
                halfData,
                { bytesPerRow: nextRes * 8, rowsPerImage: nextRes }, // 4 channels * 2 bytes
                [nextRes, nextRes, 1]
            );
        }

        currentRes = nextRes;
        currentPixels = nextPixels;
    }

    // 6. Create cube view and sampler
    const view = (device as any).createTextureView(cubeTexture, {
        dimension: 'cube',
        mipLevelCount: mipLevels,
        arrayLayerCount: 6,
    });
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
    });

    console.log("Created environment cubemap: " + resolution + "x" + resolution + " with " + mipLevels + " mip levels");

    return { texture: cubeTexture, view, sampler };
}

// Initialize WebGPU
async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No adapter");

    const device = await adapter.requestDevice();
    console.log("Device acquired");

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format });

    // Load HDR environment map (same as browser version)
    const envMapPath = "/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/Skyboxes/sunny_rose_garden_2k.hdr";
    const envCube = await loadEnvironmentMap(device, envMapPath, 512);

    // Get the first mesh primitive
    const mesh = gltf.meshes[0];
    const primitive = mesh.primitives[0];
    const mat = gltf.materials[primitive.materialIndex];

    console.log("Mesh: " + mesh.name);
    console.log("Vertices: " + primitive.positionCount);
    console.log("Indices: " + primitive.indexCount);
    console.log("Material: " + mat.name);

    // Create vertex buffer (interleaved: position, normal, uv)
    const vertexCount = primitive.positionCount;
    const vertexData = new Float32Array(vertexCount * 8);

    for (let i = 0; i < vertexCount; i++) {
        vertexData[i * 8 + 0] = primitive.positions[i * 3 + 0];
        vertexData[i * 8 + 1] = primitive.positions[i * 3 + 1];
        vertexData[i * 8 + 2] = primitive.positions[i * 3 + 2];
        if (primitive.normals) {
            vertexData[i * 8 + 3] = primitive.normals[i * 3 + 0];
            vertexData[i * 8 + 4] = primitive.normals[i * 3 + 1];
            vertexData[i * 8 + 5] = primitive.normals[i * 3 + 2];
        } else {
            vertexData[i * 8 + 3] = 0;
            vertexData[i * 8 + 4] = 1;
            vertexData[i * 8 + 5] = 0;
        }
        if (primitive.texcoords) {
            vertexData[i * 8 + 6] = primitive.texcoords[i * 2 + 0];
            vertexData[i * 8 + 7] = primitive.texcoords[i * 2 + 1];
        } else {
            vertexData[i * 8 + 6] = 0;
            vertexData[i * 8 + 7] = 0;
        }
    }

    const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = device.createBuffer({
        size: primitive.indices!.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, primitive.indices!);

    // Helper to create texture from GLTF image
    async function createTextureFromImage(imageIndex: number): Promise<GPUTexture | null> {
        if (imageIndex < 0 || imageIndex >= gltf.images.length) return null;

        const img = gltf.images[imageIndex];
        if (!img.data) {
            console.log("Image " + imageIndex + " has no data");
            return null;
        }

        const blob = new Blob([img.data], { type: img.mimeType });
        const bitmap = await createImageBitmap(blob);

        console.log("Loaded texture " + imageIndex + ": " + bitmap.width + "x" + bitmap.height);

        const texture = device.createTexture({
            size: [bitmap.width, bitmap.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture },
            [bitmap.width, bitmap.height]
        );

        return texture;
    }

    function createWhiteTexture(): GPUTexture {
        const texture = device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        device.queue.writeTexture(
            { texture },
            new Uint8Array([255, 255, 255, 255]),
            { bytesPerRow: 4 },
            [1, 1]
        );
        return texture;
    }

    function createFlatNormalTexture(): GPUTexture {
        const texture = device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        device.queue.writeTexture(
            { texture },
            new Uint8Array([128, 128, 255, 255]),
            { bytesPerRow: 4 },
            [1, 1]
        );
        return texture;
    }

    // Load textures
    console.log("Loading textures...");
    const baseColorTex = await createTextureFromImage(mat.baseColorTextureIndex) || createWhiteTexture();
    const normalTex = await createTextureFromImage(mat.normalTextureIndex) || createFlatNormalTexture();
    const metallicRoughnessTex = await createTextureFromImage(mat.metallicRoughnessTextureIndex) || createWhiteTexture();
    const emissiveTex = await createTextureFromImage(mat.emissiveTextureIndex) || createWhiteTexture();
    const occlusionTex = await createTextureFromImage(mat.occlusionTextureIndex) || createWhiteTexture();
    console.log("Textures loaded");

    const textureSampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'repeat',
    });

    // Create depth texture
    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // ============================================
    // Scene Bind Group (shared by skybox and PBR)
    // ============================================
    const sceneUniformBuffer = device.createBuffer({
        size: 256 + 64 * 4, // SceneUniforms + 4 lights
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sceneBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: 'cube' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
    });

    const sceneBindGroup = device.createBindGroup({
        layout: sceneBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: sceneUniformBuffer } },
            { binding: 1, resource: envCube.view },
            { binding: 2, resource: envCube.sampler },
        ],
    });

    // ============================================
    // Skybox Pipeline
    // ============================================
    const skyboxShaderModule = device.createShaderModule({ code: skyboxShaderCode });
    const skyboxPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout],
    });
    const skyboxPipeline = device.createRenderPipeline({
        layout: skyboxPipelineLayout,
        vertex: {
            module: skyboxShaderModule,
            entryPoint: 'vs_main',
        },
        fragment: {
            module: skyboxShaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'none',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: false,
            depthCompare: 'less-equal',
        },
    });

    // ============================================
    // PBR Pipeline
    // ============================================
    const modelUniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const materialUniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const modelBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        ],
    });

    const materialBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        ],
    });

    const modelBindGroup = device.createBindGroup({
        layout: modelBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: modelUniformBuffer } },
        ],
    });

    // Use device.createTextureView workaround
    const baseColorView = (device as any).createTextureView(baseColorTex);
    const normalView = (device as any).createTextureView(normalTex);
    const metallicRoughnessView = (device as any).createTextureView(metallicRoughnessTex);
    const emissiveView = (device as any).createTextureView(emissiveTex);
    const occlusionView = (device as any).createTextureView(occlusionTex);

    const materialBindGroup = device.createBindGroup({
        layout: materialBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: materialUniformBuffer } },
            { binding: 1, resource: textureSampler },
            { binding: 2, resource: baseColorView },
            { binding: 3, resource: normalView },
            { binding: 4, resource: metallicRoughnessView },
            { binding: 5, resource: emissiveView },
            { binding: 6, resource: occlusionView },
        ],
    });

    const pbrPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, modelBindGroupLayout, materialBindGroupLayout],
    });

    const pbrShaderModule = device.createShaderModule({ code: pbrShaderCode });

    const pbrPipeline = device.createRenderPipeline({
        layout: pbrPipelineLayout,
        vertex: {
            module: pbrShaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 32,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                    { shaderLocation: 2, offset: 24, format: 'float32x2' },
                ],
            }],
        },
        fragment: {
            module: pbrShaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back',
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less',
        },
    });

    // Calculate texture flags
    let textureFlags = 0;
    if (mat.baseColorTextureIndex >= 0) textureFlags |= 1;
    if (mat.normalTextureIndex >= 0) textureFlags |= 2;
    if (mat.metallicRoughnessTextureIndex >= 0) textureFlags |= 4;
    if (mat.emissiveTextureIndex >= 0) textureFlags |= 8;
    if (mat.occlusionTextureIndex >= 0) textureFlags |= 16;

    // Write material uniforms
    const materialData = new Float32Array([
        mat.baseColorFactor[0], mat.baseColorFactor[1], mat.baseColorFactor[2],
        mat.metallicFactor,
        mat.roughnessFactor,
        1.0, // emissiveFactor
        0, 0
    ]);
    const materialDataView = new DataView(materialData.buffer);
    materialDataView.setUint32(24, textureFlags, true);
    device.queue.writeBuffer(materialUniformBuffer, 0, materialData);

    console.log("Material: baseColor=" + mat.baseColorFactor.slice(0,3) + " metallic=" + mat.metallicFactor + " roughness=" + mat.roughnessFactor);
    console.log("Texture flags: " + textureFlags);

    const startTime = performance.now();
    const cameraFOV = 60 * Math.PI / 180;
    const environmentIntensity = 0.4; // Same as gltfLoader.ts for HDR

    function frame() {
        const time = (performance.now() - startTime) / 1000;

        // Slow camera orbit
        const orbitAngle = time * 0.2;
        const cameraDistance = 2.5;
        const cameraX = Math.sin(orbitAngle) * cameraDistance;
        const cameraZ = Math.cos(orbitAngle) * cameraDistance;
        const cameraPos = [cameraX, 0.3, cameraZ];

        const viewMatrix = lookAt(cameraPos, [0, 0, 0], [0, 1, 0]);
        const aspect = canvas.width / canvas.height;
        const projMatrix = perspective(cameraFOV, aspect, 0.1, 1000);

        // Scene uniforms
        const sceneData = new Float32Array(64 + 16 * 4);
        sceneData.set(viewMatrix, 0);
        sceneData.set(projMatrix, 16);
        sceneData.set(cameraPos, 32);
        sceneData[35] = time;

        const sceneDataView = new DataView(sceneData.buffer);
        sceneDataView.setUint32(36 * 4, 2, true); // lightCount = 2
        sceneData[37] = environmentIntensity;

        // Light 0: Main directional key light
        const light0Offset = 40;
        sceneData[light0Offset + 0] = 5;
        sceneData[light0Offset + 1] = 10;
        sceneData[light0Offset + 2] = 5;
        sceneData[light0Offset + 3] = 8.0; // Strong sun light
        const dirLen = Math.sqrt(5*5 + 10*10 + 5*5);
        sceneData[light0Offset + 4] = 5 / dirLen;
        sceneData[light0Offset + 5] = 10 / dirLen;
        sceneData[light0Offset + 6] = 5 / dirLen;
        sceneDataView.setUint32((light0Offset + 7) * 4, 0, true);
        sceneData[light0Offset + 8] = 1.0;
        sceneData[light0Offset + 9] = 0.95;
        sceneData[light0Offset + 10] = 0.9;
        sceneData[light0Offset + 11] = 0;

        // Light 1: Fill point light
        const light1Offset = 52;
        sceneData[light1Offset + 0] = -5;
        sceneData[light1Offset + 1] = 2;
        sceneData[light1Offset + 2] = -5;
        sceneData[light1Offset + 3] = 0.5;
        sceneData[light1Offset + 4] = 0;
        sceneData[light1Offset + 5] = 0;
        sceneData[light1Offset + 6] = 0;
        sceneDataView.setUint32((light1Offset + 7) * 4, 1, true);
        sceneData[light1Offset + 8] = 0.8;
        sceneData[light1Offset + 9] = 0.8;
        sceneData[light1Offset + 10] = 1.0;
        sceneData[light1Offset + 11] = 0;

        device.queue.writeBuffer(sceneUniformBuffer, 0, sceneData);

        // Model uniforms
        const modelMatrix = rotateY(Math.PI);
        const normalMatrix = identity();
        const modelData = new Float32Array(32);
        modelData.set(modelMatrix, 0);
        modelData.set(normalMatrix, 16);
        device.queue.writeBuffer(modelUniformBuffer, 0, modelData);

        // Render
        const commandEncoder = device.createCommandEncoder();
        const textureView = ctx.getCurrentTexture().createView();
        const depthView = (device as any).createTextureView(depthTexture);

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        // Draw skybox first (writes at z=1, depth test less-equal)
        renderPass.setPipeline(skyboxPipeline);
        renderPass.setBindGroup(0, sceneBindGroup);
        renderPass.draw(36);

        // Draw model
        renderPass.setPipeline(pbrPipeline);
        renderPass.setBindGroup(0, sceneBindGroup);
        renderPass.setBindGroup(1, modelBindGroup);
        renderPass.setBindGroup(2, materialBindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint32');
        renderPass.drawIndexed(primitive.indexCount);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(frame);
    }

    console.log("Starting render loop");
    frame();
}

// Matrix utilities
function identity(): Float32Array {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);
}

function rotateY(angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
        c, 0, s, 0,
        0, 1, 0, 0,
        -s, 0, c, 0,
        0, 0, 0, 1,
    ]);
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
    ]);
}

function lookAt(eye: number[], target: number[], up: number[]): Float32Array {
    const zAxis = normalize3(subtract3(eye, target));
    const xAxis = normalize3(cross3(up, zAxis));
    const yAxis = cross3(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot3(xAxis, eye), -dot3(yAxis, eye), -dot3(zAxis, eye), 1,
    ]);
}

function subtract3(a: number[], b: number[]): number[] {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: number[], b: number[]): number[] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function dot3(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize3(v: number[]): number[] {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
}

// Start
init().catch((e) => {
    console.log("Error: " + e.message);
});
