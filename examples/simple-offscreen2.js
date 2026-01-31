// Simple WebGPU triangle test using document.createElement('canvas') like PixiJS
async function main() {
    console.log('Starting simple WebGPU createElement canvas test...');

    // Get WebGPU adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    console.log('Got adapter:', adapter);

    const device = await adapter.requestDevice();
    console.log('Got device:', device);

    // Create canvas like PixiJS does
    const myCanvas = document.createElement('canvas');
    myCanvas.width = 800;
    myCanvas.height = 600;
    console.log('Created canvas via createElement:', myCanvas);

    // Get WebGPU context from this canvas
    const context = myCanvas.getContext('webgpu');
    console.log('Got context:', context);

    const format = navigator.gpu.getPreferredCanvasFormat();
    console.log('Preferred format:', format);

    context.configure({
        device: device,
        format: format,
        alphaMode: 'opaque'
    });
    console.log('Context configured');

    // Simple triangle shader
    const shaderCode = `
        @vertex
        fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
            var pos = array<vec2f, 3>(
                vec2f( 0.0,  0.5),
                vec2f(-0.5, -0.5),
                vec2f( 0.5, -0.5)
            );
            return vec4f(pos[vertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4f {
            return vec4f(1.0, 1.0, 0.0, 1.0);  // Yellow triangle
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });
    console.log('Shader created');

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main'
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
                clearValue: { r: 0.4, g: 0.8, b: 0.2, a: 1.0 }  // Green background
            }]
        });

        renderPass.setPipeline(pipeline);
        renderPass.draw(3);  // 3 vertices for a triangle
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
