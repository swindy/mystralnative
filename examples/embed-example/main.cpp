/**
 * Embed Example
 *
 * This example demonstrates how to embed the Mystral Native Runtime
 * in your own C++ application instead of using the CLI.
 *
 * Use this as a reference when:
 * - You want to embed the runtime in a native app (iOS, Android, desktop)
 * - You need custom initialization or window management
 * - You want to pre-bundle JS code in your binary
 *
 * For most development, use the CLI instead:
 *   mystral run game.js
 */

#include "mystral/runtime.h"
#include <iostream>

// Example: Inline JS code (in production, you might load from a resource file)
const char* EXAMPLE_JS = R"(
// Simple WebGPU triangle
console.log("Embedded example starting...");

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

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shaderModule, entryPoint: "vertexMain" },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format: format }]
        },
        primitive: { topology: "triangle-list" }
    });

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
        renderPass.draw(3);
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
    console.log("Render loop started");
}

main().catch(console.error);
)";

int main(int argc, char* argv[]) {
    std::cout << "=== Mystral Embed Example ===" << std::endl;
    std::cout << "Version: " << mystral::getVersion() << std::endl;
    std::cout << std::endl;
    std::cout << "This demonstrates embedding the runtime in a C++ app." << std::endl;
    std::cout << "For development, use the CLI: mystral run game.js" << std::endl;
    std::cout << std::endl;

    // Step 1: Configure the runtime
    mystral::RuntimeConfig config;
    config.width = 800;
    config.height = 600;
    config.title = "Mystral Embed Example";

    // Step 2: Create the runtime
    auto runtime = mystral::Runtime::create(config);
    if (!runtime) {
        std::cerr << "Failed to create runtime!" << std::endl;
        return 1;
    }

    // Step 3: Evaluate your JavaScript code
    // In a real app, you might load this from a bundled resource
    if (!runtime->evalScript(EXAMPLE_JS, "embedded-app.js")) {
        std::cerr << "Failed to evaluate script!" << std::endl;
        return 1;
    }

    // Step 4: Run the main loop
    // This blocks until the window is closed
    runtime->run();

    std::cout << "=== Example finished ===" << std::endl;
    return 0;
}
