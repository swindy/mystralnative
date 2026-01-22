// Texture test example - WebGPU with STANDARD WEB APIs
// Tests: fetch() -> blob() -> createImageBitmap() -> copyExternalImageToTexture()
console.log("Texture test starting (using standard web APIs)...");

// Shader code for textured quad
const shaderCode = `
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Fullscreen quad vertices
    var positions = array<vec2f, 6>(
        vec2f(-0.8, -0.8), vec2f( 0.8, -0.8), vec2f( 0.8,  0.8),
        vec2f(-0.8, -0.8), vec2f( 0.8,  0.8), vec2f(-0.8,  0.8)
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

// Helper to create fallback checkerboard texture
function createCheckerboardBitmap() {
    console.log("Creating fallback checkerboard texture...");
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const checker = ((x >> 3) ^ (y >> 3)) & 1;
            data[i + 0] = checker ? 100 : 50;   // R
            data[i + 1] = checker ? 200 : 100;  // G (green-ish)
            data[i + 2] = checker ? 100 : 50;   // B
            data[i + 3] = 255;                   // A
        }
    }
    // Create ImageBitmap-like object
    return {
        width: size,
        height: size,
        _data: data.buffer,
        close() { this._data = null; }
    };
}

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

    // =========================================================================
    // Load texture using STANDARD WEB APIs: fetch() + createImageBitmap()
    // =========================================================================
    let imageBitmap = null;

    // Use file:// URL for local files (standard fetch behavior)
    const texturePath = "file:///Users/suyogsonwalkar/Projects/mystral/assets/terrain/grass_diffuse.png";

    try {
        console.log("Fetching texture:", texturePath);
        const response = await fetch(texturePath);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        console.log("Fetch successful, decoding image with createImageBitmap...");

        // Get as Blob and decode using standard createImageBitmap API
        // This is the standard web approach: fetch -> blob -> createImageBitmap
        const blob = await response.blob();
        console.log("Blob created:", blob.size, "bytes, type:", blob.type || "(none)");
        imageBitmap = await createImageBitmap(blob);

        console.log("Decoded texture:", imageBitmap.width, "x", imageBitmap.height);
    } catch (e) {
        console.log("Failed to load texture:", e.message);
        console.log("Using fallback checkerboard pattern");
        imageBitmap = createCheckerboardBitmap();
    }

    // Create GPU texture
    const texture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    console.log("Created GPU texture");

    // =========================================================================
    // Upload using STANDARD WebGPU API: copyExternalImageToTexture()
    // =========================================================================
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height]
    );
    console.log("Uploaded texture via copyExternalImageToTexture");

    // Create texture view
    const textureView = texture.createView();
    console.log("Created texture view");

    // Create sampler
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat"
    });
    console.log("Created sampler");

    // Create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });
    console.log("Created bind group layout");

    // Create bind group
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: textureView }
        ]
    });
    console.log("Created bind group");

    // Create pipeline layout
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
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

    // Render function
    function render() {
        const commandEncoder = device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0.2, g: 0.2, b: 0.3, a: 1.0 }
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6);  // 6 vertices for quad
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
    console.log("Render loop started - you should see a textured quad!");
}

main().catch(console.error);
