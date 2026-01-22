/**
 * Gamepad 3D Demo
 *
 * Controls:
 * - Left Stick: Move (forward/back/strafe)
 * - Right Stick: Look around
 * - A/Cross (0): Jump indicator
 * - B/Circle (1): Sprint indicator
 * - X/Square (2): Action 1
 * - Y/Triangle (3): Action 2
 */

console.log("Gamepad 3D Demo");
console.log("Controls: Left stick = move, Right stick = look");

// Camera state
let camX = 0, camY = 2, camZ = 5;
let camYaw = 0, camPitch = 0;

// Action indicators
let jumping = false;
let sprinting = false;
let action1 = false;
let action2 = false;

async function main() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.log("No canvas - running in headless mode");
        return runHeadless();
    }

    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
        console.log("No WebGPU context");
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format });

    // Shader with 3D perspective
    const shaderCode = `
        struct Uniforms {
            viewProj: mat4x4f,
            model: mat4x4f,
            color: vec4f,
        };

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) normal: vec3f,
        };

        @vertex
        fn vs_main(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VertexOutput {
            var out: VertexOutput;
            let worldPos = uniforms.model * vec4f(pos, 1.0);
            out.position = uniforms.viewProj * worldPos;
            out.normal = (uniforms.model * vec4f(normal, 0.0)).xyz;
            return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4f {
            let light = normalize(vec3f(1.0, 2.0, 1.0));
            let ndotl = max(dot(normalize(in.normal), light), 0.3);
            return vec4f(uniforms.color.rgb * ndotl, 1.0);
        }
    `;

    const module = device.createShaderModule({ code: shaderCode });

    // Create cube geometry
    const cubeVerts = new Float32Array([
        // Front face (pos, normal)
        -1,-1, 1,  0, 0, 1,   1,-1, 1,  0, 0, 1,   1, 1, 1,  0, 0, 1,
        -1,-1, 1,  0, 0, 1,   1, 1, 1,  0, 0, 1,  -1, 1, 1,  0, 0, 1,
        // Back
        -1,-1,-1,  0, 0,-1,  -1, 1,-1,  0, 0,-1,   1, 1,-1,  0, 0,-1,
        -1,-1,-1,  0, 0,-1,   1, 1,-1,  0, 0,-1,   1,-1,-1,  0, 0,-1,
        // Top
        -1, 1,-1,  0, 1, 0,  -1, 1, 1,  0, 1, 0,   1, 1, 1,  0, 1, 0,
        -1, 1,-1,  0, 1, 0,   1, 1, 1,  0, 1, 0,   1, 1,-1,  0, 1, 0,
        // Bottom
        -1,-1,-1,  0,-1, 0,   1,-1,-1,  0,-1, 0,   1,-1, 1,  0,-1, 0,
        -1,-1,-1,  0,-1, 0,   1,-1, 1,  0,-1, 0,  -1,-1, 1,  0,-1, 0,
        // Right
         1,-1,-1,  1, 0, 0,   1, 1,-1,  1, 0, 0,   1, 1, 1,  1, 0, 0,
         1,-1,-1,  1, 0, 0,   1, 1, 1,  1, 0, 0,   1,-1, 1,  1, 0, 0,
        // Left
        -1,-1,-1, -1, 0, 0,  -1,-1, 1, -1, 0, 0,  -1, 1, 1, -1, 0, 0,
        -1,-1,-1, -1, 0, 0,  -1, 1, 1, -1, 0, 0,  -1, 1,-1, -1, 0, 0,
    ]);

    const vertexBuffer = device.createBuffer({
        size: cubeVerts.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, cubeVerts);

    // Floor grid vertices
    const gridVerts = [];
    const gridSize = 20;
    for (let i = -gridSize; i <= gridSize; i++) {
        // X lines
        gridVerts.push(i, 0, -gridSize, 0, 1, 0);
        gridVerts.push(i, 0, gridSize, 0, 1, 0);
        // Z lines
        gridVerts.push(-gridSize, 0, i, 0, 1, 0);
        gridVerts.push(gridSize, 0, i, 0, 1, 0);
    }
    const gridBuffer = device.createBuffer({
        size: gridVerts.length * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(gridBuffer, 0, new Float32Array(gridVerts));

    const uniformBuffer = device.createBuffer({
        size: 144, // 2 mat4 + vec4
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
    });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                ]
            }]
        },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });

    const linePipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                ]
            }]
        },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'line-list' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });

    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Scene objects: position, scale, color
    const objects = [
        { pos: [0, 1, 0], scale: 1, color: [0.8, 0.2, 0.2, 1] },      // Red cube center
        { pos: [-5, 0.5, -5], scale: 0.5, color: [0.2, 0.8, 0.2, 1] }, // Green
        { pos: [5, 0.5, -5], scale: 0.5, color: [0.2, 0.2, 0.8, 1] },  // Blue
        { pos: [-5, 0.5, 5], scale: 0.5, color: [0.8, 0.8, 0.2, 1] },  // Yellow
        { pos: [5, 0.5, 5], scale: 0.5, color: [0.8, 0.2, 0.8, 1] },   // Magenta
        { pos: [0, 0.5, -8], scale: 0.5, color: [0.2, 0.8, 0.8, 1] },  // Cyan
    ];

    // Indicator cubes for button states (top right)
    const indicators = [
        { label: 'A', color: [0.2, 0.9, 0.3, 1] },  // Green for A/Cross
        { label: 'B', color: [0.9, 0.2, 0.2, 1] },  // Red for B/Circle
        { label: 'X', color: [0.2, 0.5, 0.9, 1] },  // Blue for X/Square
        { label: 'Y', color: [0.9, 0.9, 0.2, 1] },  // Yellow for Y/Triangle
    ];

    let frame = 0;

    function render() {
        frame++;

        // Process gamepad input
        const gamepads = navigator.getGamepads();
        let gp = null;
        for (let i = 0; i < 4; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                gp = gamepads[i];
                break;
            }
        }

        if (gp) {
            // Left stick: movement
            const moveX = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0;
            const moveZ = Math.abs(gp.axes[1]) > 0.15 ? gp.axes[1] : 0;

            // Right stick: look
            const lookX = Math.abs(gp.axes[2]) > 0.15 ? gp.axes[2] : 0;
            const lookY = Math.abs(gp.axes[3]) > 0.15 ? gp.axes[3] : 0;

            // Update camera rotation
            camYaw -= lookX * 0.05;
            camPitch -= lookY * 0.03;
            camPitch = Math.max(-1.2, Math.min(1.2, camPitch));

            // Calculate movement direction based on yaw
            const speed = 0.15;
            const forward = -moveZ * speed;
            const strafe = moveX * speed;

            camX += Math.sin(camYaw) * forward + Math.cos(camYaw) * strafe;
            camZ += Math.cos(camYaw) * forward - Math.sin(camYaw) * strafe;

            // Button states
            jumping = gp.buttons[0] && gp.buttons[0].pressed;
            sprinting = gp.buttons[1] && gp.buttons[1].pressed;
            action1 = gp.buttons[2] && gp.buttons[2].pressed;
            action2 = gp.buttons[3] && gp.buttons[3].pressed;

            // Log occasionally
            if (frame % 120 === 0) {
                console.log(`Pos: (${camX.toFixed(1)}, ${camZ.toFixed(1)}) Yaw: ${(camYaw * 180/Math.PI).toFixed(0)}°`);
            }
        }

        // Build view-projection matrix
        const aspect = canvas.width / canvas.height;
        const proj = perspective(Math.PI / 3, aspect, 0.1, 100);
        const view = lookAt(
            [camX, camY, camZ],
            [camX + Math.sin(camYaw) * Math.cos(camPitch),
             camY + Math.sin(camPitch),
             camZ - Math.cos(camYaw) * Math.cos(camPitch)],
            [0, 1, 0]
        );
        const viewProj = multiply(proj, view);

        const commandEncoder = device.createCommandEncoder();
        const textureView = ctx.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        });

        // Draw grid
        renderPass.setPipeline(linePipeline);
        const gridModel = identity();
        const gridData = new Float32Array([...viewProj, ...gridModel, 0.3, 0.3, 0.3, 1]);
        device.queue.writeBuffer(uniformBuffer, 0, gridData);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, gridBuffer);
        renderPass.draw(gridVerts.length / 6);

        // Draw scene cubes
        renderPass.setPipeline(pipeline);
        for (const obj of objects) {
            const model = translate(obj.pos[0], obj.pos[1], obj.pos[2]);
            scale4(model, obj.scale);
            const data = new Float32Array([...viewProj, ...model, ...obj.color]);
            device.queue.writeBuffer(uniformBuffer, 0, data);
            renderPass.setVertexBuffer(0, vertexBuffer);
            renderPass.draw(36);
        }

        // Draw button indicators in top-right (screen space hack - just small cubes)
        const buttonStates = [jumping, sprinting, action1, action2];
        for (let i = 0; i < 4; i++) {
            const ix = 8 + i * 1.5;
            const iy = 6;
            const model = translate(ix, iy, -10);
            scale4(model, buttonStates[i] ? 0.4 : 0.2);
            const col = buttonStates[i] ? indicators[i].color : [0.2, 0.2, 0.2, 1];
            const data = new Float32Array([...viewProj, ...model, ...col]);
            device.queue.writeBuffer(uniformBuffer, 0, data);
            renderPass.draw(36);
        }

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }

    console.log("Starting render loop...");
    requestAnimationFrame(render);
}

function runHeadless() {
    let frame = 0;
    function update() {
        frame++;
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < 4; i++) {
            const gp = gamepads[i];
            if (gp && gp.connected) {
                if (frame % 60 === 0) {
                    console.log("Gamepad:", gp.id);
                    console.log("  Axes:", gp.axes.map(a => a.toFixed(2)).join(", "));
                }
                break;
            }
        }
        if (frame < 300) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Matrix utilities
function identity() {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}

function translate(x, y, z) {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
}

function scale4(m, s) {
    m[0] *= s; m[5] *= s; m[10] *= s;
}

function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return [
        f/aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far+near)*nf, -1,
        0, 0, 2*far*near*nf, 0
    ];
}

function lookAt(eye, target, up) {
    const zx = eye[0]-target[0], zy = eye[1]-target[1], zz = eye[2]-target[2];
    let len = Math.sqrt(zx*zx + zy*zy + zz*zz);
    const z = [zx/len, zy/len, zz/len];

    const xx = up[1]*z[2] - up[2]*z[1];
    const xy = up[2]*z[0] - up[0]*z[2];
    const xz = up[0]*z[1] - up[1]*z[0];
    len = Math.sqrt(xx*xx + xy*xy + xz*xz);
    const x = [xx/len, xy/len, xz/len];

    const y = [z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];

    return [
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],
        -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],
        -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2],
        1
    ];
}

function multiply(a, b) {
    const out = new Array(16);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            out[j*4+i] = a[i]*b[j*4] + a[i+4]*b[j*4+1] + a[i+8]*b[j*4+2] + a[i+12]*b[j*4+3];
        }
    }
    return out;
}

main().catch(e => console.log("Error:", e.message || e));
