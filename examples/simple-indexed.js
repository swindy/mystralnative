// Simple WebGPU indexed triangle test
async function main() {
    console.log('Starting simple WebGPU indexed triangle test...');

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    // Use document.createElement like PixiJS
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
        // x, y
         0.0,  0.5,  // top
        -0.5, -0.5,  // bottom left
         0.5, -0.5,  // bottom right
    ]);

    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // Index buffer (padded to multiple of 4 bytes)
    const indices = new Uint16Array([0, 1, 2, 0]);  // Extra 0 for padding
    const indexBuffer = device.createBuffer({
        size: indices.byteLength,  // Now 8 bytes, divisible by 4
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indices);

    // Shader with vertex buffer input
    const shaderCode = `
        struct VertexOutput {
            @builtin(position) position: vec4f,
        }

        @vertex
        fn vs_main(@location(0) pos: vec2f) -> VertexOutput {
            var output: VertexOutput;
            output.position = vec4f(pos, 0.0, 1.0);
            return output;
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
            return vec4f(1.0, 0.5, 0.0, 1.0);  // Orange triangle
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 8,  // 2 floats * 4 bytes
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
            targets: [{ format: format }]
        }
    });
    console.log('Pipeline created');

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
                clearValue: { r: 0.2, g: 0.2, b: 0.4, a: 1.0 }  // Dark blue background
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint16');
        renderPass.drawIndexed(3);  // 3 indices
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
