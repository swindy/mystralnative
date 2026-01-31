// Test matching PixiJS behavior: viewport, blend, bind groups
async function main() {
    console.log('Starting PixiJS-like test...');

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

    // Vertex buffer with positions
    const vertices = new Float32Array([
         0.0,  0.5,
        -0.5, -0.5,
         0.5, -0.5,
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

    // Uniform buffer for bind group
    const uniformBuffer = device.createBuffer({
        size: 64,  // 4x4 matrix
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderCode = `
        struct Uniforms {
            matrix: mat4x4f,
        }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
            @builtin(position) position: vec4f,
        }

        @vertex
        fn vs_main(@location(0) pos: vec2f) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniforms.matrix * vec4f(pos, 0.0, 1.0);
            return output;
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 1.0, 1.0);  // Magenta
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });

    // Create bind group layout and pipeline with blend
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' }
        }]
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 8,
                attributes: [{
                    format: 'float32x2',
                    offset: 0,
                    shaderLocation: 0,
                }]
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

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });

    // Identity matrix
    const matrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, matrix);

    console.log('Pipeline and bind group created');

    let frameCount = 0;

    function render() {
        frameCount++;

        const texture = context.getCurrentTexture();
        const view = texture.createView();

        const encoder = device.createCommandEncoder();

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: view,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.063, g: 0.6, b: 0.733, a: 1.0 }  // PixiJS blue
            }]
        });

        // Set viewport like PixiJS does
        renderPass.setViewport(0, 0, 800, 600, 0, 1);

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');
        renderPass.drawIndexed(3);
        renderPass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);

        if (frameCount % 60 === 0) {
            console.log('Frame:', frameCount);
        }

        requestAnimationFrame(render);
    }

    render();
    console.log('Render loop started');
}

main().catch(console.error);
