// Test that mimics PixiJS v8 behavior:
// - Auto-end render pass (no explicit end() call)
// - Multiple bind groups (like texture batching)
// - Set vertex/index buffers before pipeline

async function main() {
    console.log('Starting PixiJS-mimic test...');

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const myCanvas = document.createElement('canvas');
    myCanvas.width = 800;
    myCanvas.height = 600;

    const context = myCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: 'opaque'
    });

    // Vertex buffer with positions and UVs (like PixiJS batch geometry)
    const vertices = new Float32Array([
        // x, y, u, v
         0.0,  0.5, 0.5, 0.0,  // top
        -0.5, -0.5, 0.0, 1.0,  // bottom left
         0.5, -0.5, 1.0, 1.0,  // bottom right
    ]);

    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // Index buffer (padded)
    const indices = new Uint16Array([0, 1, 2, 0]);
    const indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indices);

    // Uniform buffer for bind group 0 (global uniforms)
    const uniformBuffer = device.createBuffer({
        size: 64,  // 4x4 matrix
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Identity matrix
    const matrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, matrix);

    // Create 1x1 textures like PixiJS does for batch rendering
    const texture1 = device.createTexture({
        size: [1, 1],
        format: 'bgra8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture(
        { texture: texture1 },
        new Uint8Array([255, 0, 255, 255]),  // Magenta
        { bytesPerRow: 4 },
        { width: 1, height: 1 }
    );

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Shader with 2 bind groups like PixiJS
    const shaderCode = `
        struct GlobalUniforms {
            uMatrix: mat4x4f,
        }
        @group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;

        @group(1) @binding(0) var textureSrc: texture_2d<f32>;
        @group(1) @binding(1) var textureSampler: sampler;

        struct VertexInput {
            @location(0) position: vec2f,
            @location(1) uv: vec2f,
        }

        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) uv: vec2f,
        }

        @vertex
        fn vs_main(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = globalUniforms.uMatrix * vec4f(input.position, 0.0, 1.0);
            output.uv = input.uv;
            return output;
        }

        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4f {
            // Just output magenta for testing, ignoring texture
            return vec4f(1.0, 0.0, 1.0, 1.0);
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });

    console.log('Creating bind group layouts...');

    // Create bind group layouts like PixiJS
    const bindGroupLayout0 = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' }
        }]
    });

    const bindGroupLayout1 = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
            }
        ]
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1]
    });

    console.log('Creating pipeline...');

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 16,  // 4 floats * 4 bytes
                attributes: [
                    { format: 'float32x2', offset: 0, shaderLocation: 0 },
                    { format: 'float32x2', offset: 8, shaderLocation: 1 },
                ]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{
                format: format,
                blend: {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add'
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add'
                    }
                }
            }]
        }
    });

    const bindGroup0 = device.createBindGroup({
        layout: bindGroupLayout0,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });

    const bindGroup1 = device.createBindGroup({
        layout: bindGroupLayout1,
        entries: [
            { binding: 0, resource: texture1.createView() },
            { binding: 1, resource: sampler }
        ]
    });

    console.log('Setup complete, starting render...');

    function render() {
        const texture = context.getCurrentTexture();
        const view = texture.createView();

        const encoder = device.createCommandEncoder();

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: view,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.063, g: 0.6, b: 0.733, a: 1.0 }
            }]
        });

        // Set viewport like PixiJS does
        renderPass.setViewport(0, 0, 800, 600, 0, 1);

        // MIMIC PIXIJS: Set vertex/index buffers BEFORE pipeline
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');

        // Now set pipeline
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup0);
        renderPass.setBindGroup(1, bindGroup1);
        renderPass.drawIndexed(3);

        // MIMIC PIXIJS: Do NOT call renderPass.end()
        // Let encoder.finish() auto-end it

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);

        console.log('Frame rendered (no explicit end)');
    }

    render();
    console.log('PixiJS-mimic test complete');
}

main().catch(console.error);
