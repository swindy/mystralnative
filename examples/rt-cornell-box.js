/**
 * Ray Tracing Cornell Box Example
 *
 * Demonstrates hardware ray tracing using the MystralRT API.
 * Renders a classic Cornell box scene - the standard test scene
 * for evaluating global illumination algorithms.
 *
 * The Cornell box was originally created at Cornell University's
 * Program of Computer Graphics for testing rendering algorithms.
 * It consists of:
 *   - A white floor and ceiling
 *   - A red left wall and green right wall
 *   - A white back wall
 *   - Two boxes (one tall, one short)
 *   - A light source on the ceiling
 *
 * Requirements:
 *   - GPU with hardware RT support:
 *     - Windows: DXR with DirectX 12 (NVIDIA RTX, AMD RDNA2+)
 *     - Linux: Vulkan RT (NVIDIA RTX, AMD RDNA2+)
 *     - macOS: Metal RT (Apple Silicon M1/M2/M3 with macOS 13+)
 *   - MystralNative built with MYSTRAL_USE_RAYTRACING=ON
 *
 * Usage:
 *   ./mystral run examples/rt-cornell-box.js
 *
 * Controls:
 *   Mouse drag - Rotate camera around the scene
 *   Scroll     - Zoom in/out
 *   W/A/S/D    - Move camera position
 *   R          - Reset camera to default position
 *   T          - Toggle between RT and raster mode (if available)
 *   L          - Toggle light on/off
 *   Space      - Pause/resume animation
 *
 * The backend is automatically selected based on platform:
 *   - Windows: DXR (DirectX 12)
 *   - Linux: Vulkan RT
 *   - macOS: Metal RT (Apple Silicon only)
 *
 * Reference:
 *   Cornell University Program of Computer Graphics
 *   http://www.graphics.cornell.edu/online/box/
 */

// ============================================================================
// Configuration
// ============================================================================

const width = 800;
const height = 600;

// Camera state (for interactive controls)
let cameraDistance = 3.5;
let cameraAzimuth = 0;     // Horizontal rotation (degrees)
let cameraElevation = 0;   // Vertical rotation (degrees)
let cameraOffset = [0, 1, 0]; // Look-at target

// Toggle states
let lightEnabled = true;
let isAnimating = false;
let rtEnabled = true;

// Check RT support
console.log('Ray Tracing Backend:', mystralRT.getBackend());
console.log('Ray Tracing Supported:', mystralRT.isSupported());

if (!mystralRT.isSupported()) {
    console.log('Hardware ray tracing not available.');
    console.log('This example requires:');
    console.log('  - macOS: Apple Silicon (M1/M2/M3) with macOS 13+');
    console.log('  - Linux/Windows: GPU with Vulkan RT support (NVIDIA RTX, AMD RDNA2+)');
    // Exit gracefully
    if (typeof process !== 'undefined') {
        process.exit(0);
    }
}

// Cornell box geometry
// Box dimensions: 548.8 x 548.8 x 559.2 (scaled down for simplicity)
// Origin at center of floor

// Floor (white)
const floorVertices = new Float32Array([
    -1.0, 0.0, -1.0,
     1.0, 0.0, -1.0,
     1.0, 0.0,  1.0,
    -1.0, 0.0,  1.0,
]);
const floorIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);

// Ceiling (white)
const ceilingVertices = new Float32Array([
    -1.0, 2.0, -1.0,
    -1.0, 2.0,  1.0,
     1.0, 2.0,  1.0,
     1.0, 2.0, -1.0,
]);
const ceilingIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);

// Back wall (white)
const backWallVertices = new Float32Array([
    -1.0, 0.0, -1.0,
    -1.0, 2.0, -1.0,
     1.0, 2.0, -1.0,
     1.0, 0.0, -1.0,
]);
const backWallIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);

// Left wall (red)
const leftWallVertices = new Float32Array([
    -1.0, 0.0, -1.0,
    -1.0, 0.0,  1.0,
    -1.0, 2.0,  1.0,
    -1.0, 2.0, -1.0,
]);
const leftWallIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);

// Right wall (green)
const rightWallVertices = new Float32Array([
     1.0, 0.0, -1.0,
     1.0, 2.0, -1.0,
     1.0, 2.0,  1.0,
     1.0, 0.0,  1.0,
]);
const rightWallIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);

// Tall box (rotated)
const tallBoxVertices = new Float32Array([
    // Front face
    -0.3, 0.0, 0.1,
     0.1, 0.0, 0.3,
     0.1, 1.2, 0.3,
    -0.3, 1.2, 0.1,
    // Back face
    -0.1, 0.0, -0.3,
     0.3, 0.0, -0.1,
     0.3, 1.2, -0.1,
    -0.1, 1.2, -0.3,
    // Left face
    -0.3, 0.0, 0.1,
    -0.3, 1.2, 0.1,
    -0.1, 1.2, -0.3,
    -0.1, 0.0, -0.3,
    // Right face
     0.1, 0.0, 0.3,
     0.3, 0.0, -0.1,
     0.3, 1.2, -0.1,
     0.1, 1.2, 0.3,
    // Top face
    -0.3, 1.2, 0.1,
     0.1, 1.2, 0.3,
     0.3, 1.2, -0.1,
    -0.1, 1.2, -0.3,
]);
const tallBoxIndices = new Uint32Array([
    0, 1, 2, 0, 2, 3,       // Front
    4, 5, 6, 4, 6, 7,       // Back
    8, 9, 10, 8, 10, 11,    // Left
    12, 13, 14, 12, 14, 15, // Right
    16, 17, 18, 16, 18, 19, // Top
]);

// Short box
const shortBoxVertices = new Float32Array([
    // Front face
     0.2, 0.0, 0.5,
     0.6, 0.0, 0.3,
     0.6, 0.6, 0.3,
     0.2, 0.6, 0.5,
    // Back face
     0.4, 0.0, 0.1,
     0.8, 0.0, -0.1,
     0.8, 0.6, -0.1,
     0.4, 0.6, 0.1,
    // Left face
     0.2, 0.0, 0.5,
     0.2, 0.6, 0.5,
     0.4, 0.6, 0.1,
     0.4, 0.0, 0.1,
    // Right face
     0.6, 0.0, 0.3,
     0.8, 0.0, -0.1,
     0.8, 0.6, -0.1,
     0.6, 0.6, 0.3,
    // Top face
     0.2, 0.6, 0.5,
     0.6, 0.6, 0.3,
     0.8, 0.6, -0.1,
     0.4, 0.6, 0.1,
]);
const shortBoxIndices = new Uint32Array([
    0, 1, 2, 0, 2, 3,       // Front
    4, 5, 6, 4, 6, 7,       // Back
    8, 9, 10, 8, 10, 11,    // Left
    12, 13, 14, 12, 14, 15, // Right
    16, 17, 18, 16, 18, 19, // Top
]);

console.log('Creating geometry...');

// Create geometry handles
const floorGeom = mystralRT.createGeometry({
    vertices: floorVertices,
    indices: floorIndices,
    vertexStride: 12,
});

const ceilingGeom = mystralRT.createGeometry({
    vertices: ceilingVertices,
    indices: ceilingIndices,
    vertexStride: 12,
});

const backWallGeom = mystralRT.createGeometry({
    vertices: backWallVertices,
    indices: backWallIndices,
    vertexStride: 12,
});

const leftWallGeom = mystralRT.createGeometry({
    vertices: leftWallVertices,
    indices: leftWallIndices,
    vertexStride: 12,
});

const rightWallGeom = mystralRT.createGeometry({
    vertices: rightWallVertices,
    indices: rightWallIndices,
    vertexStride: 12,
});

const tallBoxGeom = mystralRT.createGeometry({
    vertices: tallBoxVertices,
    indices: tallBoxIndices,
    vertexStride: 12,
});

const shortBoxGeom = mystralRT.createGeometry({
    vertices: shortBoxVertices,
    indices: shortBoxIndices,
    vertexStride: 12,
});

console.log('Building BLAS...');

// Build BLASes (one per geometry for simplicity)
const floorBLAS = mystralRT.createBLAS([floorGeom]);
const ceilingBLAS = mystralRT.createBLAS([ceilingGeom]);
const backWallBLAS = mystralRT.createBLAS([backWallGeom]);
const leftWallBLAS = mystralRT.createBLAS([leftWallGeom]);
const rightWallBLAS = mystralRT.createBLAS([rightWallGeom]);
const tallBoxBLAS = mystralRT.createBLAS([tallBoxGeom]);
const shortBoxBLAS = mystralRT.createBLAS([shortBoxGeom]);

// Identity matrix (column-major)
const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

console.log('Building TLAS...');

// Build TLAS with all instances at identity transform
const tlas = mystralRT.createTLAS([
    { blas: floorBLAS, transform: identity, instanceId: 0 },
    { blas: ceilingBLAS, transform: identity, instanceId: 1 },
    { blas: backWallBLAS, transform: identity, instanceId: 2 },
    { blas: leftWallBLAS, transform: identity, instanceId: 3 },
    { blas: rightWallBLAS, transform: identity, instanceId: 4 },
    { blas: tallBoxBLAS, transform: identity, instanceId: 5 },
    { blas: shortBoxBLAS, transform: identity, instanceId: 6 },
]);

// Camera setup
// Looking at the Cornell box from in front
const cameraPos = [0, 1, 3.5];
const cameraTarget = [0, 1, 0];
const cameraUp = [0, 1, 0];

// Build view matrix (simple look-at)
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
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

function subtract(a, b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0],
    ];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function invertMatrix(m) {
    // Simplified 4x4 matrix inversion for affine matrices
    const inv = new Float32Array(16);

    inv[0] = m[0]; inv[1] = m[4]; inv[2] = m[8]; inv[3] = 0;
    inv[4] = m[1]; inv[5] = m[5]; inv[6] = m[9]; inv[7] = 0;
    inv[8] = m[2]; inv[9] = m[6]; inv[10] = m[10]; inv[11] = 0;
    inv[12] = -(m[0]*m[12] + m[1]*m[13] + m[2]*m[14]);
    inv[13] = -(m[4]*m[12] + m[5]*m[13] + m[6]*m[14]);
    inv[14] = -(m[8]*m[12] + m[9]*m[13] + m[10]*m[14]);
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
    Math.PI / 3,  // 60 degree FOV
    width / height,
    0.01,
    100.0
);

// Combine into uniform buffer (viewInverse + projInverse = 2 * 16 floats)
const uniforms = new Float32Array(32);
uniforms.set(viewInverse, 0);
uniforms.set(projInverse, 16);

console.log('Tracing rays...');

// Create output texture (placeholder - in real usage this would be a WebGPU texture)
// For now, the RT backend handles the output internally
const outputTexture = null;  // TODO: Create actual WebGPU texture

// Trace rays
const startTime = performance.now();

mystralRT.traceRays({
    tlas: tlas,
    width: width,
    height: height,
    outputTexture: outputTexture,
    uniforms: uniforms,
});

const elapsed = performance.now() - startTime;
console.log(`Ray tracing complete in ${elapsed.toFixed(2)} ms`);
console.log(`Resolution: ${width}x${height}`);
console.log(`Rays per second: ${((width * height) / (elapsed / 1000) / 1e6).toFixed(2)} million`);

// ============================================================================
// Interactive Render Loop
// ============================================================================

console.log('');
console.log('Controls:');
console.log('  Mouse drag - Rotate camera');
console.log('  Scroll     - Zoom in/out');
console.log('  R          - Reset camera');
console.log('  T          - Toggle RT mode');
console.log('  L          - Toggle light');
console.log('  Space      - Pause animation');
console.log('');

let running = true;
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;

/**
 * Update camera matrices based on current camera state
 */
function updateCamera() {
    // Calculate camera position from spherical coordinates
    const azRad = cameraAzimuth * Math.PI / 180;
    const elRad = cameraElevation * Math.PI / 180;

    const camX = cameraOffset[0] + cameraDistance * Math.cos(elRad) * Math.sin(azRad);
    const camY = cameraOffset[1] + cameraDistance * Math.sin(elRad);
    const camZ = cameraOffset[2] + cameraDistance * Math.cos(elRad) * Math.cos(azRad);

    const newCameraPos = [camX, camY, camZ];
    const newViewMatrix = lookAt(newCameraPos, cameraOffset, cameraUp);
    const newViewInverse = invertMatrix(newViewMatrix);

    // Update uniforms
    uniforms.set(newViewInverse, 0);
}

/**
 * Main render loop for interactive mode
 */
function renderLoop() {
    if (!running) return;

    // Update camera if animating
    if (isAnimating) {
        cameraAzimuth = (cameraAzimuth + 0.5) % 360;
        updateCamera();
    }

    // Trace rays
    if (rtEnabled && mystralRT.isSupported()) {
        const frameStart = performance.now();

        mystralRT.traceRays({
            tlas: tlas,
            width: width,
            height: height,
            outputTexture: outputTexture,
            uniforms: uniforms,
        });

        // FPS tracking
        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
            fps = frameCount;
            frameCount = 0;
            lastFpsTime = now;
            console.log(`[Cornell Box] FPS: ${fps}, RT: ${rtEnabled ? 'ON' : 'OFF'}, Light: ${lightEnabled ? 'ON' : 'OFF'}`);
        }
    }

    requestAnimationFrame(renderLoop);
}

// ============================================================================
// Input Handling
// ============================================================================

if (typeof window !== 'undefined') {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'r':
                // Reset camera
                cameraDistance = 3.5;
                cameraAzimuth = 0;
                cameraElevation = 0;
                updateCamera();
                console.log('Camera reset');
                break;

            case 't':
                // Toggle RT
                rtEnabled = !rtEnabled;
                console.log('RT mode:', rtEnabled ? 'ON' : 'OFF');
                break;

            case 'l':
                // Toggle light
                lightEnabled = !lightEnabled;
                console.log('Light:', lightEnabled ? 'ON' : 'OFF');
                break;

            case ' ':
                // Pause/resume animation
                isAnimating = !isAnimating;
                console.log('Animation:', isAnimating ? 'ON' : 'OFF');
                break;

            case 'w':
                cameraOffset[2] -= 0.2;
                updateCamera();
                break;

            case 's':
                cameraOffset[2] += 0.2;
                updateCamera();
                break;

            case 'a':
                cameraOffset[0] -= 0.2;
                updateCamera();
                break;

            case 'd':
                cameraOffset[0] += 0.2;
                updateCamera();
                break;

            case 'arrowup':
                cameraElevation = Math.min(89, cameraElevation + 5);
                updateCamera();
                break;

            case 'arrowdown':
                cameraElevation = Math.max(-89, cameraElevation - 5);
                updateCamera();
                break;

            case 'arrowleft':
                cameraAzimuth = (cameraAzimuth - 10 + 360) % 360;
                updateCamera();
                break;

            case 'arrowright':
                cameraAzimuth = (cameraAzimuth + 10) % 360;
                updateCamera();
                break;
        }
    });

    // Mouse controls for rotation
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    window.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;

        cameraAzimuth = (cameraAzimuth + dx * 0.5 + 360) % 360;
        cameraElevation = Math.max(-89, Math.min(89, cameraElevation - dy * 0.5));

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        updateCamera();
    });

    // Scroll for zoom
    window.addEventListener('wheel', (e) => {
        cameraDistance = Math.max(1, Math.min(10, cameraDistance + e.deltaY * 0.01));
        updateCamera();
    });
}

// Start interactive render loop
console.log('Starting interactive render loop...');
console.log('Press Space to enable camera animation');
renderLoop();

// ============================================================================
// Cleanup
// ============================================================================

if (typeof process !== 'undefined') {
    process.on('exit', () => {
        console.log('Cleaning up...');
        running = false;

        mystralRT.destroyTLAS(tlas);
        mystralRT.destroyBLAS(floorBLAS);
        mystralRT.destroyBLAS(ceilingBLAS);
        mystralRT.destroyBLAS(backWallBLAS);
        mystralRT.destroyBLAS(leftWallBLAS);
        mystralRT.destroyBLAS(rightWallBLAS);
        mystralRT.destroyBLAS(tallBoxBLAS);
        mystralRT.destroyBLAS(shortBoxBLAS);

        console.log('Done!');
    });
}
