/**
 * Ray-Traced Shadows Example
 *
 * Demonstrates ray-traced sun shadows using the MystralRT API.
 * This example:
 *   1. Loads a simple scene with ground plane and objects
 *   2. Traces shadow rays toward the sun direction
 *   3. Allows toggling RT shadows on/off for comparison
 *   4. Shows real-time performance metrics
 *
 * Requirements:
 *   - GPU with hardware RT support (RTX, RDNA2+, Apple Silicon M1+)
 *   - MystralNative built with MYSTRAL_USE_RAYTRACING=ON
 *
 * Usage:
 *   ./mystral run examples/rt-shadows.js
 *
 * Controls:
 *   - Mouse drag: Rotate camera
 *   - Scroll: Zoom in/out
 *   - T: Toggle RT shadows on/off
 *   - R: Rotate sun position
 *   - Space: Pause sun rotation
 *
 * Reference: Pharr, M. (2010). Physically Based Rendering, Chapter 13.
 */

// ============================================================================
// Configuration
// ============================================================================

const WIDTH = 1280;
const HEIGHT = 720;
const SHADOW_RESOLUTION = 1024;

// Sun parameters
let sunAzimuth = 45;  // Horizontal angle (degrees)
let sunElevation = 45; // Vertical angle (degrees)
let sunRotating = true;
let sunRotationSpeed = 10; // degrees per second

// RT state
let rtShadowsEnabled = true;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;

// ============================================================================
// Check RT Support
// ============================================================================

console.log('=== Ray-Traced Shadows Example ===');
console.log('Backend:', mystralRT.getBackend());
console.log('RT Supported:', mystralRT.isSupported());

if (!mystralRT.isSupported()) {
    console.log('');
    console.log('Hardware ray tracing not available.');
    console.log('Requirements:');
    console.log('  - Windows: DirectX 12 with DXR (NVIDIA RTX, AMD RDNA2+)');
    console.log('  - Linux: Vulkan RT (NVIDIA RTX, AMD RDNA2+)');
    console.log('  - macOS: Metal RT (Apple Silicon M1/M2/M3 with macOS 13+)');
    console.log('');
    console.log('The example will continue with software fallback...');
}

// ============================================================================
// Scene Geometry
// ============================================================================

/**
 * Create ground plane geometry (large flat quad)
 * Ground extends from -10 to +10 on X and Z axes
 */
function createGroundPlane() {
    const vertices = new Float32Array([
        -10, 0, -10,
         10, 0, -10,
         10, 0,  10,
        -10, 0,  10,
    ]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    return { vertices, indices };
}

/**
 * Create a box at the specified position and size
 * Returns vertices and indices for a unit cube, scaled and translated
 */
function createBox(x, y, z, width, height, depth) {
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    // 8 corners of the box
    const corners = [
        [x - hw, y - hh, z - hd], // 0: back-bottom-left
        [x + hw, y - hh, z - hd], // 1: back-bottom-right
        [x + hw, y + hh, z - hd], // 2: back-top-right
        [x - hw, y + hh, z - hd], // 3: back-top-left
        [x - hw, y - hh, z + hd], // 4: front-bottom-left
        [x + hw, y - hh, z + hd], // 5: front-bottom-right
        [x + hw, y + hh, z + hd], // 6: front-top-right
        [x - hw, y + hh, z + hd], // 7: front-top-left
    ];

    // 6 faces, each with 4 vertices (we duplicate for proper normals)
    const vertices = new Float32Array([
        // Front face (z+)
        ...corners[4], ...corners[5], ...corners[6], ...corners[7],
        // Back face (z-)
        ...corners[1], ...corners[0], ...corners[3], ...corners[2],
        // Top face (y+)
        ...corners[7], ...corners[6], ...corners[2], ...corners[3],
        // Bottom face (y-)
        ...corners[4], ...corners[0], ...corners[1], ...corners[5],
        // Right face (x+)
        ...corners[5], ...corners[1], ...corners[2], ...corners[6],
        // Left face (x-)
        ...corners[0], ...corners[4], ...corners[7], ...corners[3],
    ]);

    // Indices for 6 quads (12 triangles)
    const indices = new Uint32Array([
        0, 1, 2, 0, 2, 3,       // Front
        4, 5, 6, 4, 6, 7,       // Back
        8, 9, 10, 8, 10, 11,    // Top
        12, 13, 14, 12, 14, 15, // Bottom
        16, 17, 18, 16, 18, 19, // Right
        20, 21, 22, 20, 22, 23, // Left
    ]);

    return { vertices, indices };
}

/**
 * Create a sphere at the specified position
 * Uses icosphere subdivision for even triangle distribution
 */
function createSphere(x, y, z, radius, subdivisions = 2) {
    // Start with icosahedron
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

    // Subdivide faces
    for (let i = 0; i < subdivisions; i++) {
        const newIndices = [];
        const midpointCache = {};

        function getMidpoint(i1, i2) {
            const key = Math.min(i1, i2) + '_' + Math.max(i1, i2);
            if (midpointCache[key] !== undefined) {
                return midpointCache[key];
            }

            const v1 = [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]];
            const v2 = [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]];

            const mid = [
                (v1[0] + v2[0]) / 2,
                (v1[1] + v2[1]) / 2,
                (v1[2] + v2[2]) / 2,
            ];

            // Normalize to sphere surface
            const len = Math.sqrt(mid[0] ** 2 + mid[1] ** 2 + mid[2] ** 2);
            mid[0] /= len;
            mid[1] /= len;
            mid[2] /= len;

            const newIndex = vertices.length / 3;
            vertices.push(...mid);
            midpointCache[key] = newIndex;
            return newIndex;
        }

        for (let j = 0; j < indices.length; j += 3) {
            const a = indices[j];
            const b = indices[j + 1];
            const c = indices[j + 2];

            const ab = getMidpoint(a, b);
            const bc = getMidpoint(b, c);
            const ca = getMidpoint(c, a);

            newIndices.push(a, ab, ca);
            newIndices.push(b, bc, ab);
            newIndices.push(c, ca, bc);
            newIndices.push(ab, bc, ca);
        }

        indices = newIndices;
    }

    // Scale and translate vertices
    const result = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
        const len = Math.sqrt(vertices[i] ** 2 + vertices[i + 1] ** 2 + vertices[i + 2] ** 2);
        result[i] = (vertices[i] / len) * radius + x;
        result[i + 1] = (vertices[i + 1] / len) * radius + y;
        result[i + 2] = (vertices[i + 2] / len) * radius + z;
    }

    return { vertices: result, indices: new Uint32Array(indices) };
}

// ============================================================================
// Build Scene
// ============================================================================

console.log('Creating scene geometry...');

// Merge all geometry into single arrays
const geometries = [
    createGroundPlane(),
    createBox(-3, 0.5, 0, 1, 1, 1),      // Box on left
    createBox(0, 0.75, 0, 1.5, 1.5, 1.5), // Larger box in center
    createBox(3, 0.4, 0, 0.8, 0.8, 0.8),  // Smaller box on right
    createSphere(0, 2.5, 0, 0.6, 2),      // Sphere floating above
    createBox(-2, 0.3, 3, 0.6, 0.6, 0.6), // Box in front-left
    createBox(2, 0.25, 3, 0.5, 0.5, 0.5), // Box in front-right
];

// Merge into single vertex/index arrays
let totalVertices = 0;
let totalIndices = 0;
geometries.forEach(g => {
    totalVertices += g.vertices.length;
    totalIndices += g.indices.length;
});

const allVertices = new Float32Array(totalVertices);
const allIndices = new Uint32Array(totalIndices);

let vertexOffset = 0;
let indexOffset = 0;
let vertexCount = 0;

geometries.forEach(g => {
    allVertices.set(g.vertices, vertexOffset);
    for (let i = 0; i < g.indices.length; i++) {
        allIndices[indexOffset + i] = g.indices[i] + vertexCount;
    }
    vertexOffset += g.vertices.length;
    indexOffset += g.indices.length;
    vertexCount += g.vertices.length / 3;
});

console.log(`Scene: ${vertexCount} vertices, ${allIndices.length / 3} triangles`);

// ============================================================================
// Build Acceleration Structures
// ============================================================================

console.log('Building acceleration structures...');
const buildStartTime = performance.now();

// Create geometry from merged data
const geometry = mystralRT.createGeometry({
    vertices: allVertices,
    indices: allIndices,
    vertexStride: 12, // 3 floats * 4 bytes
});

// Build BLAS (Bottom-Level Acceleration Structure)
const blas = mystralRT.createBLAS([geometry]);

// Identity transform matrix (column-major)
const identityTransform = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

// Build TLAS (Top-Level Acceleration Structure)
const tlas = mystralRT.createTLAS([
    { blas, transform: identityTransform, instanceId: 0 },
]);

const buildTime = performance.now() - buildStartTime;
console.log(`Acceleration structures built in ${buildTime.toFixed(2)}ms`);

// ============================================================================
// Camera and Matrices
// ============================================================================

// Camera state
let cameraDistance = 12;
let cameraAzimuth = 45;
let cameraElevation = 30;
const cameraTarget = [0, 1, 0];

/**
 * Calculate sun direction from azimuth and elevation angles
 */
function getSunDirection() {
    const azRad = sunAzimuth * Math.PI / 180;
    const elRad = sunElevation * Math.PI / 180;

    return [
        Math.cos(elRad) * Math.sin(azRad),
        Math.sin(elRad),
        Math.cos(elRad) * Math.cos(azRad),
    ];
}

/**
 * Create look-at view matrix
 */
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

function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function invertMatrix(m) {
    // Simplified inversion for affine view matrices
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

// ============================================================================
// Main Render Loop
// ============================================================================

let running = true;
let lastTime = performance.now();

function render() {
    if (!running) return;

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // Update sun rotation
    if (sunRotating) {
        sunAzimuth = (sunAzimuth + sunRotationSpeed * dt) % 360;
    }

    // Calculate camera position from spherical coordinates
    const azRad = cameraAzimuth * Math.PI / 180;
    const elRad = cameraElevation * Math.PI / 180;
    const cameraPos = [
        cameraTarget[0] + cameraDistance * Math.cos(elRad) * Math.sin(azRad),
        cameraTarget[1] + cameraDistance * Math.sin(elRad),
        cameraTarget[2] + cameraDistance * Math.cos(elRad) * Math.cos(azRad),
    ];

    // Build matrices
    const viewMatrix = lookAt(cameraPos, cameraTarget, [0, 1, 0]);
    const viewInverse = invertMatrix(viewMatrix);
    const projInverse = perspectiveProjectionInverse(
        Math.PI / 3, // 60 degree FOV
        WIDTH / HEIGHT,
        0.1,
        1000.0
    );

    // Build uniform buffer with:
    // - viewInverse (16 floats)
    // - projInverse (16 floats)
    // - sunDirection (3 floats + 1 pad)
    // - shadowBias (1 float + 3 pad)
    const uniforms = new Float32Array(40);
    uniforms.set(viewInverse, 0);
    uniforms.set(projInverse, 16);

    const sunDir = getSunDirection();
    uniforms[32] = sunDir[0];
    uniforms[33] = sunDir[1];
    uniforms[34] = sunDir[2];
    uniforms[35] = 0; // padding
    uniforms[36] = 0.02; // shadow bias
    uniforms[37] = 0; // padding
    uniforms[38] = 0; // padding
    uniforms[39] = 0; // padding

    // Trace rays (only if RT shadows enabled)
    if (rtShadowsEnabled) {
        const traceStart = performance.now();

        mystralRT.traceRays({
            tlas: tlas,
            width: WIDTH,
            height: HEIGHT,
            outputTexture: null, // Internal output
            uniforms: uniforms,
        });

        lastFrameTime = performance.now() - traceStart;
    }

    // FPS calculation
    frameCount++;
    if (frameCount >= 60) {
        fps = frameCount / (now - (lastTime - dt * 1000 * frameCount)) * 1000;
        frameCount = 0;
    }

    // Request next frame
    requestAnimationFrame(render);
}

// ============================================================================
// Input Handling
// ============================================================================

console.log('');
console.log('Controls:');
console.log('  T - Toggle RT shadows on/off');
console.log('  R - Rotate sun direction');
console.log('  Space - Pause/resume sun rotation');
console.log('  Up/Down - Change sun elevation');
console.log('  Left/Right - Change sun azimuth');
console.log('');

// Keyboard input (if available in MystralNative)
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 't':
                rtShadowsEnabled = !rtShadowsEnabled;
                console.log('RT Shadows:', rtShadowsEnabled ? 'ON' : 'OFF');
                break;
            case ' ':
                sunRotating = !sunRotating;
                console.log('Sun rotation:', sunRotating ? 'ON' : 'OFF');
                break;
            case 'r':
                sunAzimuth = (sunAzimuth + 45) % 360;
                console.log('Sun azimuth:', sunAzimuth);
                break;
            case 'arrowup':
                sunElevation = Math.min(89, sunElevation + 5);
                console.log('Sun elevation:', sunElevation);
                break;
            case 'arrowdown':
                sunElevation = Math.max(5, sunElevation - 5);
                console.log('Sun elevation:', sunElevation);
                break;
            case 'arrowleft':
                sunAzimuth = (sunAzimuth - 15 + 360) % 360;
                console.log('Sun azimuth:', sunAzimuth);
                break;
            case 'arrowright':
                sunAzimuth = (sunAzimuth + 15) % 360;
                console.log('Sun azimuth:', sunAzimuth);
                break;
        }
    });
}

// ============================================================================
// Performance Logging
// ============================================================================

setInterval(() => {
    if (rtShadowsEnabled) {
        const raysPerSecond = (WIDTH * HEIGHT) / (lastFrameTime / 1000) / 1e6;
        console.log(`[Stats] FPS: ${fps.toFixed(1)}, Frame: ${lastFrameTime.toFixed(2)}ms, Rays: ${raysPerSecond.toFixed(2)}M/s`);
        console.log(`[Sun] Azimuth: ${sunAzimuth.toFixed(1)}°, Elevation: ${sunElevation.toFixed(1)}°`);
    } else {
        console.log('[Stats] RT Shadows disabled');
    }
}, 2000);

// ============================================================================
// Start
// ============================================================================

console.log('Starting render loop...');
render();

// Cleanup on exit
if (typeof process !== 'undefined') {
    process.on('exit', () => {
        console.log('Cleaning up...');
        mystralRT.destroyTLAS(tlas);
        mystralRT.destroyBLAS(blas);
        running = false;
    });
}
