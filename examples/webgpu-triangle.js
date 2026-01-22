// Test script for Mystral CLI
// Tests basic WebGPU rendering with standard APIs

console.log("=== Mystral CLI Test ===");
console.log("Testing WebGPU rendering with standard APIs...");

// Shader for a simple colored triangle
const shaderCode = `
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2f, 3>(
        vec2f( 0.0,  0.5),
        vec2f(-0.5, -0.5),
        vec2f( 0.5, -0.5)
    );
    var colors = array<vec4f, 3>(
        vec4f(1.0, 0.0, 0.0, 1.0),  // Red
        vec4f(0.0, 1.0, 0.0, 1.0),  // Green
        vec4f(0.0, 0.0, 1.0, 1.0)   // Blue
    );

    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    output.color = colors[vertexIndex];
    return output;
}

@fragment
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
    return color;
}
`;

async function main() {
    // Check WebGPU support
    if (!navigator.gpu) {
        console.error("WebGPU not supported!");
        return;
    }
    console.log("WebGPU is available");

    // Get adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No adapter found!");
        return;
    }
    console.log("Adapter acquired");

    const device = await adapter.requestDevice();
    console.log("Device acquired");

    // Configure canvas
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });
    console.log("Canvas configured with format:", format);

    // Create shader module
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });
    console.log("Shader module created");

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

    let frameCount = 0;

    // Render loop
    function render() {
        const commandEncoder = device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(3);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);

        frameCount++;
        if (frameCount % 60 === 0) {
            console.log("Frame:", frameCount);
        }

        requestAnimationFrame(render);
    }

    // Start rendering
    requestAnimationFrame(render);
    console.log("Render loop started - you should see a colored triangle!");
}

main().catch(e => console.error("Error:", e.message));
