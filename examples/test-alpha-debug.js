// Alpha Debug Test - Verify Canvas 2D produces correct alpha values
console.log("Alpha Debug Test starting...");

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

    // Create Canvas 2D
    const uiCanvas = document.createElement('canvas');
    uiCanvas.width = width;
    uiCanvas.height = height;
    const ctx = uiCanvas.getContext('2d');

    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    // Test 1: Check alpha after clearRect
    console.log("\n=== Test 1: clearRect alpha ===");
    ctx.clearRect(0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, 10, 10);
    console.log("After clearRect, first 4 pixels (RGBA):");
    for (let i = 0; i < 4; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        const a = imageData.data[i * 4 + 3];
        console.log("  Pixel " + i + ": R=" + r + " G=" + g + " B=" + b + " A=" + a);
    }

    // Test 2: Check alpha of semi-transparent fill
    console.log("\n=== Test 2: Semi-transparent fill ===");
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";  // 50% red
    ctx.fillRect(0, 0, 10, 10);

    imageData = ctx.getImageData(0, 0, 10, 10);
    console.log("After rgba(255,0,0,0.5) fill:");
    for (let i = 0; i < 4; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        const a = imageData.data[i * 4 + 3];
        console.log("  Pixel " + i + ": R=" + r + " G=" + g + " B=" + b + " A=" + a);
    }

    // Test 3: Check alpha of fully opaque fill
    console.log("\n=== Test 3: Opaque fill ===");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#00ff00";  // Opaque green
    ctx.fillRect(0, 0, 10, 10);

    imageData = ctx.getImageData(0, 0, 10, 10);
    console.log("After opaque green fill:");
    for (let i = 0; i < 4; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        const a = imageData.data[i * 4 + 3];
        console.log("  Pixel " + i + ": R=" + r + " G=" + g + " B=" + b + " A=" + a);
    }

    // Test 4: Draw a rect, clear part of it, check cleared area
    console.log("\n=== Test 4: Clear inside filled area ===");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0000ff";  // Blue
    ctx.fillRect(0, 0, 100, 100);
    ctx.clearRect(25, 25, 50, 50);  // Clear center

    // Check blue area
    imageData = ctx.getImageData(0, 0, 1, 1);
    console.log("Blue corner: R=" + imageData.data[0] + " G=" + imageData.data[1] +
                " B=" + imageData.data[2] + " A=" + imageData.data[3]);

    // Check cleared center
    imageData = ctx.getImageData(50, 50, 1, 1);
    console.log("Cleared center: R=" + imageData.data[0] + " G=" + imageData.data[1] +
                " B=" + imageData.data[2] + " A=" + imageData.data[3]);

    console.log("\n=== Alpha debug complete ===");

    // Render a simple frame so screenshot works
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.2, g: 0.4, b: 0.6, a: 1.0 }
        }]
    });
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
}

main().catch(console.error);
