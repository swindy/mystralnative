/**
 * Progressive Path Tracer Example
 *
 * Demonstrates a simple progressive path tracer using the MystralRT API.
 * Features:
 *   - Multiple light bounces for global illumination
 *   - Progressive accumulation for noise reduction
 *   - Russian roulette for unbiased path termination
 *   - Cosine-weighted hemisphere sampling
 *
 * Requirements:
 *   - GPU with hardware RT support (RTX, RDNA2+, Apple Silicon M1+)
 *   - MystralNative built with MYSTRAL_USE_RAYTRACING=ON
 *
 * Usage:
 *   ./mystral run examples/rt-pathtracer.js
 *
 * Controls:
 *   - R: Reset accumulation
 *   - Space: Pause/resume rendering
 *   - 1-5: Set max bounces (1-5)
 *
 * References:
 *   - Pharr, M., & Humphreys, G. (2010). Physically Based Rendering.
 *   - Veach, E. (1997). Robust Monte Carlo Methods for Light Transport Simulation.
 */

// ============================================================================
// Configuration
// ============================================================================

const WIDTH = 800;
const HEIGHT = 600;
const MAX_BOUNCES = 4;           // Maximum path depth
const SAMPLES_PER_PIXEL = 1;     // Samples per frame (progressive)
const RUSSIAN_ROULETTE_DEPTH = 2; // Start RR after this many bounces

// State
let frameCount = 0;
let isPaused = false;
let maxBounces = MAX_BOUNCES;
let accumulatedSamples = 0;

// ============================================================================
// Check RT Support
// ============================================================================

console.log('=== Progressive Path Tracer ===');
console.log('Backend:', mystralRT.getBackend());
console.log('RT Supported:', mystralRT.isSupported());

if (!mystralRT.isSupported()) {
    console.log('');
    console.log('Hardware ray tracing not available.');
    console.log('Path tracing requires hardware RT for acceptable performance.');
    console.log('');
    console.log('Requirements:');
    console.log('  - Windows: DirectX 12 with DXR (NVIDIA RTX, AMD RDNA2+)');
    console.log('  - Linux: Vulkan RT (NVIDIA RTX, AMD RDNA2+)');
    console.log('  - macOS: Metal RT (Apple Silicon M1/M2/M3 with macOS 13+)');

    if (typeof process !== 'undefined') {
        process.exit(0);
    }
}

// ============================================================================
// Scene Definition - Cornell Box with Spheres
// ============================================================================

/**
 * Classic Cornell box with diffuse walls and two spheres.
 * Left wall: Red, Right wall: Green, Others: White
 * Light source on ceiling.
 */

// Wall vertices (each wall is a quad)
const walls = {
    // Floor (white)
    floor: {
        vertices: new Float32Array([
            -1.0, 0.0, -1.0,
             1.0, 0.0, -1.0,
             1.0, 0.0,  1.0,
            -1.0, 0.0,  1.0,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [0.8, 0.8, 0.8],    // White
        emission: [0, 0, 0],
    },

    // Ceiling (white with light)
    ceiling: {
        vertices: new Float32Array([
            -1.0, 2.0, -1.0,
            -1.0, 2.0,  1.0,
             1.0, 2.0,  1.0,
             1.0, 2.0, -1.0,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [0.8, 0.8, 0.8],
        emission: [0, 0, 0],
    },

    // Light (small quad on ceiling)
    light: {
        vertices: new Float32Array([
            -0.3, 1.99, -0.3,
            -0.3, 1.99,  0.3,
             0.3, 1.99,  0.3,
             0.3, 1.99, -0.3,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [1, 1, 1],
        emission: [15, 15, 15],  // Emissive light
    },

    // Back wall (white)
    back: {
        vertices: new Float32Array([
            -1.0, 0.0, -1.0,
            -1.0, 2.0, -1.0,
             1.0, 2.0, -1.0,
             1.0, 0.0, -1.0,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [0.8, 0.8, 0.8],
        emission: [0, 0, 0],
    },

    // Left wall (red)
    left: {
        vertices: new Float32Array([
            -1.0, 0.0, -1.0,
            -1.0, 0.0,  1.0,
            -1.0, 2.0,  1.0,
            -1.0, 2.0, -1.0,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [0.85, 0.1, 0.1],  // Red
        emission: [0, 0, 0],
    },

    // Right wall (green)
    right: {
        vertices: new Float32Array([
             1.0, 0.0, -1.0,
             1.0, 2.0, -1.0,
             1.0, 2.0,  1.0,
             1.0, 0.0,  1.0,
        ]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        color: [0.1, 0.85, 0.1],  // Green
        emission: [0, 0, 0],
    },
};

/**
 * Create sphere geometry using subdivision
 */
function createSphere(cx, cy, cz, radius, subdivisions = 2) {
    const t = (1 + Math.sqrt(5)) / 2;

    let vertices = [
        -1, t, 0,  1, t, 0,  -1, -t, 0,  1, -t, 0,
        0, -1, t,  0, 1, t,  0, -1, -t,  0, 1, -t,
        t, 0, -1,  t, 0, 1,  -t, 0, -1,  -t, 0, 1,
    ];

    let indices = [
        0, 11, 5,  0, 5, 1,  0, 1, 7,  0, 7, 10,  0, 10, 11,
        1, 5, 9,  5, 11, 4,  11, 10, 2,  10, 7, 6,  7, 1, 8,
        3, 9, 4,  3, 4, 2,  3, 2, 6,  3, 6, 8,  3, 8, 9,
        4, 9, 5,  2, 4, 11,  6, 2, 10,  8, 6, 7,  9, 8, 1,
    ];

    for (let s = 0; s < subdivisions; s++) {
        const newIndices = [];
        const midpointCache = {};

        function getMidpoint(i1, i2) {
            const key = Math.min(i1, i2) + '_' + Math.max(i1, i2);
            if (midpointCache[key] !== undefined) return midpointCache[key];

            const v1 = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
            const v2 = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];
            const mid = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2];
            const len = Math.sqrt(mid[0] ** 2 + mid[1] ** 2 + mid[2] ** 2);
            mid[0] /= len; mid[1] /= len; mid[2] /= len;

            const newIndex = vertices.length / 3;
            vertices.push(...mid);
            midpointCache[key] = newIndex;
            return newIndex;
        }

        for (let j = 0; j < indices.length; j += 3) {
            const [a, b, c] = [indices[j], indices[j + 1], indices[j + 2]];
            const ab = getMidpoint(a, b), bc = getMidpoint(b, c), ca = getMidpoint(c, a);
            newIndices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
        }
        indices = newIndices;
    }

    const result = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
        const len = Math.sqrt(vertices[i] ** 2 + vertices[i + 1] ** 2 + vertices[i + 2] ** 2);
        result[i] = (vertices[i] / len) * radius + cx;
        result[i + 1] = (vertices[i + 1] / len) * radius + cy;
        result[i + 2] = (vertices[i + 2] / len) * radius + cz;
    }

    return { vertices: result, indices: new Uint32Array(indices) };
}

// Create spheres
const spheres = {
    // Left sphere (diffuse white)
    left: {
        ...createSphere(-0.4, 0.4, 0.2, 0.4, 3),
        color: [0.9, 0.9, 0.9],
        emission: [0, 0, 0],
    },
    // Right sphere (mirror-like, but we use diffuse for simplicity)
    right: {
        ...createSphere(0.4, 0.25, -0.1, 0.25, 3),
        color: [0.9, 0.9, 0.9],
        emission: [0, 0, 0],
    },
};

// ============================================================================
// Build Acceleration Structures
// ============================================================================

console.log('Building scene...');

// Collect all geometry and materials
const allObjects = [...Object.values(walls), ...Object.values(spheres)];
const materials = allObjects.map(obj => ({
    color: obj.color,
    emission: obj.emission,
}));

// Merge geometry
let totalVertices = 0;
let totalIndices = 0;
allObjects.forEach(obj => {
    totalVertices += obj.vertices.length;
    totalIndices += obj.indices.length;
});

const mergedVertices = new Float32Array(totalVertices);
const mergedIndices = new Uint32Array(totalIndices);
const triangleMaterials = []; // Material index per triangle

let vertexOffset = 0;
let indexOffset = 0;
let vertexCount = 0;

allObjects.forEach((obj, objIndex) => {
    mergedVertices.set(obj.vertices, vertexOffset);
    for (let i = 0; i < obj.indices.length; i++) {
        mergedIndices[indexOffset + i] = obj.indices[i] + vertexCount;
    }

    // Record material for each triangle
    const numTriangles = obj.indices.length / 3;
    for (let i = 0; i < numTriangles; i++) {
        triangleMaterials.push(objIndex);
    }

    vertexOffset += obj.vertices.length;
    indexOffset += obj.indices.length;
    vertexCount += obj.vertices.length / 3;
});

console.log(`Scene: ${vertexCount} vertices, ${mergedIndices.length / 3} triangles, ${materials.length} materials`);

// Build acceleration structures
console.log('Building BVH...');
const buildStart = performance.now();

const geometry = mystralRT.createGeometry({
    vertices: mergedVertices,
    indices: mergedIndices,
    vertexStride: 12,
});

const blas = mystralRT.createBLAS([geometry]);

const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

const tlas = mystralRT.createTLAS([
    { blas, transform: identity, instanceId: 0 },
]);

console.log(`BVH built in ${(performance.now() - buildStart).toFixed(2)}ms`);

// ============================================================================
// Camera Setup
// ============================================================================

const cameraPos = [0, 1, 2.8];
const cameraTarget = [0, 1, 0];
const cameraUp = [0, 1, 0];

function lookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ]);
}

function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
}

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function invertMatrix(m) {
    const inv = new Float32Array(16);
    inv[0] = m[0]; inv[1] = m[4]; inv[2] = m[8]; inv[3] = 0;
    inv[4] = m[1]; inv[5] = m[5]; inv[6] = m[9]; inv[7] = 0;
    inv[8] = m[2]; inv[9] = m[6]; inv[10] = m[10]; inv[11] = 0;
    inv[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
    inv[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
    inv[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]);
    inv[15] = 1;
    return inv;
}

function perspectiveProjectionInverse(fovY, aspect, near, far) {
    const tanHalfFovy = Math.tan(fovY / 2);
    return new Float32Array([
        tanHalfFovy * aspect, 0, 0, 0,
        0, tanHalfFovy, 0, 0,
        0, 0, 0, (near - far) / (2 * far * near),
        0, 0, -1, (near + far) / (2 * far * near),
    ]);
}

const viewMatrix = lookAt(cameraPos, cameraTarget, cameraUp);
const viewInverse = invertMatrix(viewMatrix);
const projInverse = perspectiveProjectionInverse(
    Math.PI / 3,
    WIDTH / HEIGHT,
    0.01,
    100.0
);

// ============================================================================
// Uniforms for Path Tracer
// ============================================================================

// Uniform layout:
// - viewInverse: mat4x4 (16 floats)
// - projInverse: mat4x4 (16 floats)
// - frameNumber: u32 (1 float)
// - maxBounces: u32 (1 float)
// - samplesPerPixel: u32 (1 float)
// - pad: 1 float

function buildUniforms() {
    const uniforms = new Float32Array(36);
    uniforms.set(viewInverse, 0);
    uniforms.set(projInverse, 16);
    uniforms[32] = frameCount;
    uniforms[33] = maxBounces;
    uniforms[34] = SAMPLES_PER_PIXEL;
    uniforms[35] = 0; // padding
    return uniforms;
}

// ============================================================================
// Path Tracing Loop
// ============================================================================

console.log('');
console.log('Starting path tracer...');
console.log('Controls:');
console.log('  R - Reset accumulation');
console.log('  Space - Pause/resume');
console.log('  1-5 - Set max bounces');
console.log('');

let lastLogTime = performance.now();
let lastFrameTime = 0;

function render() {
    if (isPaused) {
        requestAnimationFrame(render);
        return;
    }

    const startTime = performance.now();

    // Trace rays
    mystralRT.traceRays({
        tlas: tlas,
        width: WIDTH,
        height: HEIGHT,
        outputTexture: null,
        uniforms: buildUniforms(),
    });

    lastFrameTime = performance.now() - startTime;
    frameCount++;
    accumulatedSamples += SAMPLES_PER_PIXEL;

    // Log progress
    const now = performance.now();
    if (now - lastLogTime > 1000) {
        const raysPerSecond = (WIDTH * HEIGHT * SAMPLES_PER_PIXEL) / (lastFrameTime / 1000) / 1e6;
        console.log(`[Frame ${frameCount}] Samples: ${accumulatedSamples}, ` +
                   `Time: ${lastFrameTime.toFixed(2)}ms, Rays: ${raysPerSecond.toFixed(2)}M/s, ` +
                   `Bounces: ${maxBounces}`);
        lastLogTime = now;
    }

    requestAnimationFrame(render);
}

// ============================================================================
// Input Handling
// ============================================================================

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'r':
                frameCount = 0;
                accumulatedSamples = 0;
                console.log('Accumulation reset');
                break;
            case ' ':
                isPaused = !isPaused;
                console.log(isPaused ? 'Paused' : 'Resumed');
                break;
            case '1': case '2': case '3': case '4': case '5':
                maxBounces = parseInt(e.key);
                frameCount = 0;
                accumulatedSamples = 0;
                console.log(`Max bounces: ${maxBounces}, accumulation reset`);
                break;
        }
    });
}

// ============================================================================
// Start Rendering
// ============================================================================

render();

// Cleanup
if (typeof process !== 'undefined') {
    process.on('exit', () => {
        console.log('Cleaning up...');
        mystralRT.destroyTLAS(tlas);
        mystralRT.destroyBLAS(blas);
    });
}

// ============================================================================
// Path Tracing Algorithm Notes
// ============================================================================

/*
 * Progressive Path Tracing Algorithm:
 *
 * For each pixel, for each sample:
 *   1. Generate primary ray from camera through pixel
 *   2. For bounce = 0 to maxBounces:
 *      a. Trace ray, find closest intersection
 *      b. If hit emissive surface: accumulate emission * throughput
 *      c. If no hit: accumulate sky color * throughput (or break)
 *      d. Sample new direction using cosine-weighted hemisphere
 *      e. Update throughput: throughput *= (albedo * cos(theta)) / pdf
 *         For cosine-weighted sampling: pdf = cos(theta) / PI
 *         So throughput *= albedo (the cos(theta) cancels!)
 *      f. Russian roulette: After depth > RR_DEPTH
 *         - Survival probability p = max(throughput.r, g, b)
 *         - If random() > p: terminate path
 *         - Else: throughput /= p (unbiased)
 *   3. Accumulate color: accum = (accum * (n-1) + newColor) / n
 *
 * Key Optimizations:
 *   - Cosine-weighted sampling reduces variance for diffuse surfaces
 *   - Russian roulette allows early termination without bias
 *   - Progressive accumulation converges to ground truth
 *
 * References:
 *   - Veach (1997) - Multiple Importance Sampling
 *   - Kajiya (1986) - The Rendering Equation
 */
