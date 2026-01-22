// Simple Blend Test - Verify alpha blending works with a programmatically created texture
console.log("Simple Blend Test starting...");

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

async function main() {
    if (!navigator.gpu) {
        console.error("WebGPU not supported!");
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    console.log("Device acquired");

    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    const width = canvas.width;
    const height = canvas.height;

    // Create a simple test texture using PREMULTIPLIED ALPHA
    // - Left half: transparent (all zeros)
    // - Right half: premultiplied semi-transparent blue
    const testTextureData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (x < width / 2) {
                // Left half: COMPLETELY TRANSPARENT (premultiplied = all zeros)
                testTextureData[i] = 0;     // R * A
                testTextureData[i+1] = 0;   // G * A
                testTextureData[i+2] = 0;   // B * A
                testTextureData[i+3] = 0;   // A = 0 (transparent)
            } else {
                // Right half: Premultiplied semi-transparent blue
                // Original: RGBA(0, 0, 255, 128) = 50% blue
                // Premultiplied: RGB * A/255 = (0, 0, 128), A = 128
                testTextureData[i] = 0;     // R * 0.5 = 0
                testTextureData[i+1] = 0;   // G * 0.5 = 0
                testTextureData[i+2] = 128; // B * 0.5 = 128 (premultiplied)
                testTextureData[i+3] = 128; // A = 50% opacity
            }
        }
    }
    console.log("Test texture created:", width, "x", height);
    console.log("Sample pixel [0,0] (should be transparent):", testTextureData[0], testTextureData[1], testTextureData[2], testTextureData[3]);
    console.log("Sample pixel [" + (width-1) + ",0] (should be semi-blue):", testTextureData[(width-1)*4], testTextureData[(width-1)*4+1], testTextureData[(width-1)*4+2], testTextureData[(width-1)*4+3]);

    // Create GPU texture
    const testTexture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    // Upload texture data
    device.queue.writeTexture(
        { texture: testTexture },
        testTextureData,
        { bytesPerRow: width * 4, rowsPerImage: height },
        [width, height]
    );
    console.log("Texture uploaded");

    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: testTexture.createView() }
        ]
    });

    const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "vertexMain"
        },
        fragment: {
            module: device.createShaderModule({ code: uiShaderCode }),
            entryPoint: "fragmentMain",
            targets: [{
                format: format,
                // Enable alpha blending for premultiplied alpha
                blend: {
                    color: {
                        srcFactor: "one",              // Premultiplied: src is already multiplied by alpha
                        dstFactor: "one-minus-src-alpha",
                        operation: "add"
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add"
                    }
                }
            }]
        },
        primitive: { topology: "triangle-list" }
    });
    console.log("Pipeline created with BLEND STATE");

    let frameCount = 0;

    function render() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        // Clear to bright red, then draw test texture with blending
        // Expected result:
        // - Left half: Pure red (transparent texture, shows background)
        // - Right half: Purple-ish (semi-transparent blue blended with red)
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }  // BRIGHT RED
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);

        frameCount++;
        if (frameCount % 60 === 0) {
            console.log("Frame:", frameCount);
        }

        requestAnimationFrame(render);
    }

    console.log("Starting render - LEFT should be RED, RIGHT should be PURPLE-ISH");
    requestAnimationFrame(render);
}

main().catch(console.error);
