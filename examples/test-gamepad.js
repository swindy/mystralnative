/**
 * Gamepad API Test
 *
 * Tests navigator.getGamepads() and gamepad events.
 * Uses W3C Standard Gamepad mapping.
 */

console.log("Gamepad API Test starting...");

// Track connected gamepads
const connectedGamepads = new Map();

// Gamepad connected event
window.addEventListener('gamepadconnected', (e) => {
    console.log("Gamepad connected:", e.gamepad.id);
    console.log("  Index:", e.gamepad.index);
    console.log("  Buttons:", e.gamepad.buttons.length);
    console.log("  Axes:", e.gamepad.axes.length);
    console.log("  Mapping:", e.gamepad.mapping);
    connectedGamepads.set(e.gamepad.index, e.gamepad);
});

// Gamepad disconnected event
window.addEventListener('gamepaddisconnected', (e) => {
    console.log("Gamepad disconnected:", e.gamepad.id);
    connectedGamepads.delete(e.gamepad.index);
});

// W3C Standard Gamepad button names
const buttonNames = [
    'A (Cross)',           // 0
    'B (Circle)',          // 1
    'X (Square)',          // 2
    'Y (Triangle)',        // 3
    'Left Bumper',         // 4
    'Right Bumper',        // 5
    'Left Trigger',        // 6
    'Right Trigger',       // 7
    'Back/Select',         // 8
    'Start',               // 9
    'Left Stick Press',    // 10
    'Right Stick Press',   // 11
    'D-Pad Up',            // 12
    'D-Pad Down',          // 13
    'D-Pad Left',          // 14
    'D-Pad Right',         // 15
    'Home/Guide',          // 16
];

// W3C Standard Gamepad axis names
const axisNames = [
    'Left Stick X',        // 0
    'Left Stick Y',        // 1
    'Right Stick X',       // 2
    'Right Stick Y',       // 3
];

// Set up WebGPU visualization
async function setupVisualization() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.log("No canvas element, skipping visualization");
        return null;
    }
    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
        console.log("No WebGPU context, skipping visualization");
        return null;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format });

    // Shader for rendering gamepad state
    const shaderCode = `
        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) color: vec3f,
        };

        struct Uniforms {
            buttonStates: array<vec4f, 5>,  // 4 buttons per vec4, need 17 buttons = 5 vec4s
            axisStates: vec4f,              // 4 axes
        };

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        @vertex
        fn vs_main(@builtin(vertex_index) idx: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
            // Create quads for each button/axis indicator
            var quadVerts = array<vec2f, 6>(
                vec2f(-0.03, -0.03), vec2f(0.03, -0.03), vec2f(-0.03, 0.03),
                vec2f(0.03, -0.03), vec2f(0.03, 0.03), vec2f(-0.03, 0.03)
            );

            var out: VertexOutput;
            let vert = quadVerts[idx];

            // Layout: buttons in 2 rows at top, axes at bottom
            var pos: vec2f;
            var brightness: f32 = 0.2;  // Default dim

            if (instance < 17u) {
                // Buttons - 2 rows of 9
                let row = instance / 9u;
                let col = instance % 9u;
                pos = vec2f(
                    -0.8 + f32(col) * 0.2,
                    0.7 - f32(row) * 0.15
                );

                // Get button state from packed uniforms
                let vecIdx = instance / 4u;
                let compIdx = instance % 4u;
                let buttonVec = uniforms.buttonStates[vecIdx];
                brightness = select(select(select(select(0.2, buttonVec.x, compIdx == 0u), buttonVec.y, compIdx == 1u), buttonVec.z, compIdx == 2u), buttonVec.w, compIdx == 3u);
            } else {
                // Axes - 4 indicators at bottom
                let axisIdx = instance - 17u;
                pos = vec2f(
                    -0.6 + f32(axisIdx) * 0.4,
                    -0.5
                );

                // Axis value shows as position offset
                let axisVal = select(select(select(select(0.0, uniforms.axisStates.x, axisIdx == 0u), uniforms.axisStates.y, axisIdx == 1u), uniforms.axisStates.z, axisIdx == 2u), uniforms.axisStates.w, axisIdx == 3u);
                pos.x += axisVal * 0.15;
                brightness = 0.8;
            }

            out.position = vec4f(pos + vert, 0.0, 1.0);

            // Color: green when pressed, dim gray otherwise
            if (instance < 17u) {
                out.color = mix(vec3f(0.3, 0.3, 0.3), vec3f(0.2, 0.9, 0.3), brightness);
            } else {
                out.color = vec3f(0.3, 0.6, 0.9);  // Blue for axes
            }

            return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4f {
            return vec4f(in.color, 1.0);
        }
    `;

    const module = device.createShaderModule({ code: shaderCode });

    const uniformBuffer = device.createBuffer({
        size: 96,  // 5 vec4s for buttons (80) + 1 vec4 for axes (16)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' }
        }]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module, entryPoint: 'vs_main' },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
    });

    return { device, ctx, pipeline, uniformBuffer, bindGroup, format };
}

async function main() {
    const gpu = await setupVisualization();

    let frame = 0;

    function update() {
        frame++;

        // Poll gamepads
        const gamepads = navigator.getGamepads();

        // Find first connected gamepad
        let activeGamepad = null;
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.connected) {
                activeGamepad = gp;
                break;
            }
        }

        // Log state periodically (every 60 frames = ~1 second)
        if (frame % 60 === 0) {
            if (activeGamepad) {
                console.log("Frame", frame, "- Gamepad:", activeGamepad.id);

                // Log pressed buttons
                const pressedButtons = [];
                for (let i = 0; i < activeGamepad.buttons.length && i < buttonNames.length; i++) {
                    if (activeGamepad.buttons[i].pressed) {
                        pressedButtons.push(buttonNames[i]);
                    }
                }
                if (pressedButtons.length > 0) {
                    console.log("  Pressed:", pressedButtons.join(", "));
                }

                // Log non-zero axes
                const activeAxes = [];
                for (let i = 0; i < activeGamepad.axes.length && i < axisNames.length; i++) {
                    const val = activeGamepad.axes[i];
                    if (Math.abs(val) > 0.1) {
                        activeAxes.push(`${axisNames[i]}: ${val.toFixed(2)}`);
                    }
                }
                if (activeAxes.length > 0) {
                    console.log("  Axes:", activeAxes.join(", "));
                }
            } else {
                console.log("Frame", frame, "- No gamepad connected");
                console.log("  Connect a controller to test");
            }
        }

        // Update visualization
        if (gpu) {
            // Pack button states
            const uniformData = new Float32Array(24);  // 6 vec4s

            if (activeGamepad) {
                // Pack 17 button values into 5 vec4s
                for (let i = 0; i < 17; i++) {
                    const value = i < activeGamepad.buttons.length ? activeGamepad.buttons[i].value : 0;
                    uniformData[i] = value;
                }

                // Pack 4 axis values into vec4 at offset 20
                for (let i = 0; i < 4; i++) {
                    const value = i < activeGamepad.axes.length ? activeGamepad.axes[i] : 0;
                    uniformData[20 + i] = value;
                }
            }

            gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniformData);

            const commandEncoder = gpu.device.createCommandEncoder();
            const view = gpu.ctx.getCurrentTexture().createView();

            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view,
                    clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            });

            renderPass.setPipeline(gpu.pipeline);
            renderPass.setBindGroup(0, gpu.bindGroup);
            // Draw 21 instances: 17 buttons + 4 axes
            renderPass.draw(6, 21);
            renderPass.end();

            gpu.device.queue.submit([commandEncoder.finish()]);
        }

        requestAnimationFrame(update);
    }

    console.log("Starting gamepad polling loop...");
    console.log("Connect a gamepad to see its state");
    update();
}

main().catch(e => {
    console.log("Error:", e.message || e);
});
