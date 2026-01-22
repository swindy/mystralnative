// UI over 3D Test - Canvas 2D UI composited over WebGPU 3D scene
// Verifies proper layering: 3D background -> UI overlay
// Uses vertex pulling (storage buffer) like rotating-cube.js for compatibility
console.log("UI over 3D Test starting...");

// 3D cube shader using vertex pulling (storage buffer)
const cubeShaderCode = `
struct Uniforms {
    mvp: mat4x4f,
    model: mat4x4f,
}

struct Vertex {
    position: vec3f,
    normal: vec3f,
    color: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) color: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertices[vertexIndex];

    var output: VertexOutput;
    output.position = uniforms.mvp * vec4f(vertex.position, 1.0);
    output.normal = (uniforms.model * vec4f(vertex.normal, 0.0)).xyz;
    output.color = vertex.color;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let lightDir = normalize(vec3f(0.5, 1.0, 0.3));
    let normal = normalize(input.normal);
    let diffuse = max(dot(normal, lightDir), 0.0);
    let ambient = 0.3;
    let lighting = ambient + diffuse * 0.7;

    return vec4f(input.color * lighting, 1.0);
}
`;

// UI overlay shader (fullscreen quad with texture)
const uiShaderCode = `
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
        vec2f(-1.0, -1.0), vec2f( 1.0,  1.0), vec2f(-1.0,  1.0)
    );
    var uvs = array<vec2f, 6>(
        vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0),
        vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(0.0, 0.0)
    );

    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    output.uv = uvs[vertexIndex];
    return output;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@fragment
fn fragmentMain(@location(0) uv: vec2f) -> @location(0) vec4f {
    return textureSample(tex, texSampler, uv);
}
`;

// Matrix math helpers (from rotating-cube.js)
const mat4 = {
    create() {
        return new Float32Array(16);
    },

    identity(out) {
        out.fill(0);
        out[0] = out[5] = out[10] = out[15] = 1;
        return out;
    },

    perspective(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        out.fill(0);
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) / (near - far);
        out[11] = -1;
        out[14] = (2 * far * near) / (near - far);
        return out;
    },

    lookAt(out, eye, center, up) {
        const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
        let len = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz);
        const z0 = zx * len, z1 = zy * len, z2 = zz * len;

        const xx = up[1] * z2 - up[2] * z1;
        const xy = up[2] * z0 - up[0] * z2;
        const xz = up[0] * z1 - up[1] * z0;
        len = Math.sqrt(xx * xx + xy * xy + xz * xz);
        const x0 = xx / len, x1 = xy / len, x2 = xz / len;

        const y0 = z1 * x2 - z2 * x1;
        const y1 = z2 * x0 - z0 * x2;
        const y2 = z0 * x1 - z1 * x0;

        out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
        out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
        out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
        out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        out[15] = 1;
        return out;
    },

    rotateY(out, a, rad) {
        const s = Math.sin(rad), c = Math.cos(rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

        for (let i = 0; i < 16; i++) out[i] = a[i];
        out[0] = a00 * c - a20 * s;
        out[1] = a01 * c - a21 * s;
        out[2] = a02 * c - a22 * s;
        out[3] = a03 * c - a23 * s;
        out[8] = a00 * s + a20 * c;
        out[9] = a01 * s + a21 * c;
        out[10] = a02 * s + a22 * c;
        out[11] = a03 * s + a23 * c;
        return out;
    },

    rotateX(out, a, rad) {
        const s = Math.sin(rad), c = Math.cos(rad);
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

        for (let i = 0; i < 16; i++) out[i] = a[i];
        out[4] = a10 * c + a20 * s;
        out[5] = a11 * c + a21 * s;
        out[6] = a12 * c + a22 * s;
        out[7] = a13 * c + a23 * s;
        out[8] = a20 * c - a10 * s;
        out[9] = a21 * c - a11 * s;
        out[10] = a22 * c - a12 * s;
        out[11] = a23 * c - a13 * s;
        return out;
    },

    multiply(out, a, b) {
        const result = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[j * 4 + i] =
                    a[0 * 4 + i] * b[j * 4 + 0] +
                    a[1 * 4 + i] * b[j * 4 + 1] +
                    a[2 * 4 + i] * b[j * 4 + 2] +
                    a[3 * 4 + i] * b[j * 4 + 3];
            }
        }
        for (let i = 0; i < 16; i++) out[i] = result[i];
        return out;
    }
};

// Cube vertex data (from rotating-cube.js)
function createCubeVertices() {
    const faces = [
        // Front (Z+) - Red
        { n: [0, 0, 1], c: [1, 0, 0], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
        // Back (Z-) - Cyan
        { n: [0, 0, -1], c: [0, 1, 1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
        // Top (Y+) - Green
        { n: [0, 1, 0], c: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
        // Bottom (Y-) - Magenta
        { n: [0, -1, 0], c: [1, 0, 1], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
        // Right (X+) - Blue
        { n: [1, 0, 0], c: [0, 0, 1], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
        // Left (X-) - Yellow
        { n: [-1, 0, 0], c: [1, 1, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    ];

    // 36 vertices * 12 floats (vec4 position, vec4 normal, vec4 color - padded for alignment)
    const data = new Float32Array(36 * 12);
    let i = 0;

    for (const face of faces) {
        for (const pos of face.v) {
            // Position (vec3 + padding)
            data[i++] = pos[0];
            data[i++] = pos[1];
            data[i++] = pos[2];
            data[i++] = 0;

            // Normal (vec3 + padding)
            data[i++] = face.n[0];
            data[i++] = face.n[1];
            data[i++] = face.n[2];
            data[i++] = 0;

            // Color (vec3 + padding)
            data[i++] = face.c[0];
            data[i++] = face.c[1];
            data[i++] = face.c[2];
            data[i++] = 0;
        }
    }

    return data;
}

// Helper: Draw rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// UI rendering
function renderUI(ctx, width, height, time) {
    // Clear to fully transparent - this is critical for seeing 3D behind UI!
    ctx.clearRect(0, 0, width, height);

    // Semi-transparent overlay panel (top-left)
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    roundRect(ctx, 20, 20, 250, 150, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
    ctx.lineWidth = 2;
    roundRect(ctx, 20, 20, 250, 150, 12);
    ctx.stroke();

    ctx.fillStyle = "#88ddff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("3D Scene Info", 40, 35);

    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText("Rotating Cube Demo", 40, 70);
    ctx.fillText("Time: " + time.toFixed(1) + "s", 40, 95);
    ctx.fillText("Canvas 2D over WebGPU", 40, 120);
    ctx.fillText("Transparency: Working!", 40, 145);

    // Bottom status bar
    ctx.fillStyle = "rgba(20, 20, 40, 0.85)";
    roundRect(ctx, 20, height - 70, width - 40, 50, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(150, 150, 200, 0.5)";
    ctx.lineWidth = 1;
    roundRect(ctx, 20, height - 70, width - 40, 50, 8);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UI Layer - You should see the 3D cube BEHIND this text through the transparent areas", width / 2, height - 50);

    // Crosshair in center (to show transparency)
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8);
    ctx.lineTo(cx, cy + 20);
    ctx.stroke();

    // Corner indicators to show UI bounds
    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillRect(width - 10, 0, 10, 10);
    ctx.fillRect(0, height - 10, 10, 10);
    ctx.fillRect(width - 10, height - 10, 10, 10);
}

async function main() {
    if (!navigator.gpu) {
        console.error("WebGPU not supported!");
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No adapter found!");
        return;
    }

    const device = await adapter.requestDevice();
    console.log("Device acquired");

    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"  // Changed from premultiplied to match rotating-cube.js
    });

    const width = canvas.width;
    const height = canvas.height;
    console.log("Canvas size:", width, "x", height);

    // =========================================================================
    // Create Canvas 2D for UI
    // =========================================================================
    const uiCanvas = document.createElement('canvas');
    uiCanvas.width = width;
    uiCanvas.height = height;
    const ctx = uiCanvas.getContext('2d');

    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }
    console.log("Canvas 2D context created");

    // =========================================================================
    // Create 3D cube resources (vertex pulling pattern like rotating-cube.js)
    // =========================================================================
    const vertexData = createCubeVertices();
    console.log("Vertex data size:", vertexData.byteLength, "bytes");

    const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, vertexData.byteLength);
    console.log("Vertex buffer created");

    // Uniform buffer (2 mat4x4f = 128 bytes)
    const uniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    console.log("Uniform buffer created");

    // Bind group layout for cube
    const cubeBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    const cubeBindGroup = device.createBindGroup({
        layout: cubeBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: vertexBuffer } }
        ]
    });
    console.log("Cube bind group created");

    // Depth texture
    const depthTexture = device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    console.log("Depth texture created");

    // Cube pipeline
    const cubePipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [cubeBindGroupLayout] }),
        vertex: {
            module: device.createShaderModule({ code: cubeShaderCode }),
            entryPoint: "vertexMain"
        },
        fragment: {
            module: device.createShaderModule({ code: cubeShaderCode }),
            entryPoint: "fragmentMain",
            targets: [{ format: format }]
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "back"
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less"
        }
    });
    console.log("Cube pipeline created");

    // =========================================================================
    // Create UI overlay resources
    // =========================================================================
    const uiTexture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
    });

    const uiBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });

    const uiBindGroup = device.createBindGroup({
        layout: uiBindGroupLayout,
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: uiTexture.createView() }
        ]
    });

    const uiPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [uiBindGroupLayout] }),
        vertex: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "vertexMain"
        },
        fragment: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "fragmentMain",
            targets: [{
                format: format,
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                }
            }]
        },
        primitive: { topology: "triangle-list" },
        // Add depth stencil config (disabled) to make it compatible with depth-enabled render passes
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: false,  // Don't write to depth buffer
            depthCompare: "always"     // Always pass depth test (effectively disabled)
        }
    });
    console.log("UI pipeline created");

    // UI pipeline WITHOUT depth stencil for use with render passes that don't have depth
    const uiPipelineNoDepth = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [uiBindGroupLayout] }),
        vertex: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "vertexMain"
        },
        fragment: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "fragmentMain",
            targets: [{
                format: format,
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                }
            }]
        },
        primitive: { topology: "triangle-list" }
        // NO depthStencil - for use with render passes without depth attachment
    });
    console.log("UI pipeline (no depth) created");

    // Initialize matrices
    const projection = mat4.create();
    const view = mat4.create();
    const model = mat4.create();
    const mvp = mat4.create();
    const tempMat = mat4.create();

    const aspect = width / height;
    mat4.perspective(projection, (60 * Math.PI) / 180, aspect, 0.1, 100);
    mat4.lookAt(view, [0, 1, 3], [0, 0, 0], [0, 1, 0]);

    let frameCount = 0;
    let rotation = 0;

    function render() {
        rotation += 0.02;
        const time = frameCount / 60;

        // Update matrices
        mat4.identity(model);
        mat4.rotateY(model, model, rotation);
        mat4.rotateX(model, model, rotation * 0.5);

        mat4.multiply(tempMat, view, model);
        mat4.multiply(mvp, projection, tempMat);

        // Upload uniforms (MVP + model matrix)
        const uniformData = new Float32Array(32);
        uniformData.set(mvp, 0);
        uniformData.set(model, 16);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData, 0, uniformData.byteLength);

        // =====================================================================
        // Step 1: Render UI to Canvas 2D
        // =====================================================================
        renderUI(ctx, width, height, time);

        // Upload to GPU texture
        const imageData = ctx.getImageData(0, 0, width, height);
        device.queue.writeTexture(
            { texture: uiTexture },
            imageData.data,
            { bytesPerRow: width * 4, rowsPerImage: height },
            [width, height]
        );

        // =====================================================================
        // Render 3D scene first, then UI overlay
        // =====================================================================
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const depthView = depthTexture.createView();

        // Pass 1: Render 3D cube
        const cubePass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }  // Dark blue background
            }],
            depthStencilAttachment: {
                view: depthView,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1.0
            }
        });
        cubePass.setPipeline(cubePipeline);
        cubePass.setBindGroup(0, cubeBindGroup);
        cubePass.draw(36);  // 36 vertices for cube
        cubePass.end();

        // Pass 2: Render UI overlay with blending (loadOp: "load" preserves the 3D scene)
        const uiPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: "load",   // CRITICAL: Load the 3D scene we just rendered
                storeOp: "store"
            }]
        });
        uiPass.setPipeline(uiPipelineNoDepth);
        uiPass.setBindGroup(0, uiBindGroup);
        uiPass.draw(6);
        uiPass.end();

        device.queue.submit([commandEncoder.finish()]);

        frameCount++;
        if (frameCount % 60 === 0) {
            console.log("Frame:", frameCount, "Time:", time.toFixed(1) + "s");
        }

        requestAnimationFrame(render);
    }

    console.log("Starting render loop - 3D cube with UI overlay!");
    requestAnimationFrame(render);
}

main().catch(console.error);
