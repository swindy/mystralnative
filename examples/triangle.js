// Triangle example - WebGPU
// Minimal example showing basic WebGPU rendering
console.log("Triangle example starting...");

// Shader code
const shaderCode = `
@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 3>(
        vec2f( 0.0,  0.5),
        vec2f(-0.5, -0.5),
        vec2f( 0.5, -0.5)
    );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
    return vec4f(1.0, 0.5, 0.2, 1.0);  // Orange
}
`;

async function main() {
    // Check for WebGPU support
    if (!navigator.gpu) {
        console.error("WebGPU not supported!");
        return;
    }

    // Request adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No adapter found!");
        return;
    }

    const device = await adapter.requestDevice();
    console.log("Device acquired");

    // Get canvas context
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain"
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format: format }]
        },
        primitive: {
            topology: "triangle-list"
        }
    });

    console.log("Pipeline created");

    // Render function
    function render() {
        const commandEncoder = device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(3);  // 3 vertices
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }

    // Start rendering
    requestAnimationFrame(render);
    console.log("Render loop started");
}

main().catch(console.error);
