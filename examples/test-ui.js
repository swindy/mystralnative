// UI Test - Canvas 2D composited over WebGPU
// Demonstrates text rendering, rounded rectangles, and proper UI layering
console.log("UI Test starting...");

// Shader for fullscreen quad (to render Canvas 2D texture over WebGPU)
const uiShaderCode = `
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Fullscreen quad vertices
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
    let texColor = textureSample(tex, texSampler, uv);
    // Use premultiplied alpha
    return texColor;
}
`;

// Helper: Draw rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// UI rendering function
function renderUI(ctx, width, height, time) {
    // Clear with transparent
    ctx.clearRect(0, 0, width, height);

    // =========================================================================
    // Panel 1: Title bar (top)
    // =========================================================================
    ctx.fillStyle = "rgba(30, 30, 50, 0.9)";
    roundRect(ctx, 10, 10, width - 20, 50, 8);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Mystral UI Demo", width / 2, 35);

    // =========================================================================
    // Panel 2: Stats panel (top-right)
    // =========================================================================
    const statsX = width - 200;
    const statsY = 70;

    ctx.fillStyle = "rgba(20, 60, 80, 0.85)";
    roundRect(ctx, statsX, statsY, 190, 120, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.lineWidth = 2;
    roundRect(ctx, statsX, statsY, 190, 120, 12);
    ctx.stroke();

    ctx.fillStyle = "#88ddff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Stats", statsX + 15, statsY + 12);

    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    ctx.fillText("FPS: 60", statsX + 15, statsY + 40);
    ctx.fillText("Draw calls: 42", statsX + 15, statsY + 60);
    ctx.fillText("Triangles: 12.5K", statsX + 15, statsY + 80);

    // =========================================================================
    // Panel 3: Dialogue box (bottom)
    // =========================================================================
    const dialogX = 50;
    const dialogY = height - 180;
    const dialogW = width - 100;
    const dialogH = 150;

    // Background with gradient effect (simulated with multiple rects)
    ctx.fillStyle = "rgba(10, 10, 30, 0.95)";
    roundRect(ctx, dialogX, dialogY, dialogW, dialogH, 16);
    ctx.fill();

    // Inner border glow
    ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
    ctx.lineWidth = 3;
    roundRect(ctx, dialogX + 2, dialogY + 2, dialogW - 4, dialogH - 4, 14);
    ctx.stroke();

    // Outer border
    ctx.strokeStyle = "rgba(60, 80, 120, 0.8)";
    ctx.lineWidth = 2;
    roundRect(ctx, dialogX, dialogY, dialogW, dialogH, 16);
    ctx.stroke();

    // Speaker name plate
    ctx.fillStyle = "rgba(80, 100, 180, 0.9)";
    roundRect(ctx, dialogX + 20, dialogY - 15, 120, 30, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Character", dialogX + 80, dialogY);

    // Dialogue text with typewriter effect
    const fullText = "Welcome to Mystral Engine! This UI is rendered using Canvas 2D and composited over WebGPU.";
    const visibleChars = Math.floor((time * 30) % (fullText.length + 30));
    const displayText = fullText.substring(0, Math.min(visibleChars, fullText.length));

    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Word wrap
    const maxWidth = dialogW - 60;
    const words = displayText.split(' ');
    let line = '';
    let y = dialogY + 30;
    const lineHeight = 24;

    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, dialogX + 30, y);
            line = word + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, dialogX + 30, y);

    // Continue indicator (blinking)
    if (visibleChars >= fullText.length && Math.floor(time * 3) % 2 === 0) {
        ctx.fillStyle = "#88aaff";
        ctx.beginPath();
        ctx.moveTo(dialogX + dialogW - 40, dialogY + dialogH - 30);
        ctx.lineTo(dialogX + dialogW - 30, dialogY + dialogH - 20);
        ctx.lineTo(dialogX + dialogW - 40, dialogY + dialogH - 10);
        ctx.closePath();
        ctx.fill();
    }

    // =========================================================================
    // Panel 4: Buttons (left side)
    // =========================================================================
    const buttons = ["New Game", "Continue", "Settings", "Exit"];
    const btnX = 30;
    let btnY = 100;

    for (let i = 0; i < buttons.length; i++) {
        const hovered = i === Math.floor(time) % buttons.length;

        // Button background
        ctx.fillStyle = hovered ? "rgba(80, 120, 200, 0.9)" : "rgba(40, 50, 80, 0.8)";
        roundRect(ctx, btnX, btnY, 150, 40, 8);
        ctx.fill();

        // Button border
        ctx.strokeStyle = hovered ? "rgba(150, 200, 255, 0.8)" : "rgba(80, 100, 150, 0.6)";
        ctx.lineWidth = hovered ? 2 : 1;
        roundRect(ctx, btnX, btnY, 150, 40, 8);
        ctx.stroke();

        // Button text
        ctx.fillStyle = hovered ? "#ffffff" : "#aabbcc";
        ctx.font = hovered ? "bold 16px sans-serif" : "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(buttons[i], btnX + 75, btnY + 20);

        btnY += 50;
    }

    // =========================================================================
    // Panel 5: Mini-map (bottom-right)
    // =========================================================================
    const mapSize = 100;
    const mapX = width - mapSize - 20;
    const mapY = height - 200 - mapSize;

    // Map background
    ctx.fillStyle = "rgba(20, 40, 30, 0.9)";
    ctx.beginPath();
    ctx.arc(mapX + mapSize/2, mapY + mapSize/2, mapSize/2, 0, Math.PI * 2);
    ctx.fill();

    // Map border
    ctx.strokeStyle = "rgba(100, 200, 150, 0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Player dot (animated)
    const playerX = mapX + mapSize/2 + Math.cos(time) * 20;
    const playerY = mapY + mapSize/2 + Math.sin(time) * 20;
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.arc(playerX, playerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Compass
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", mapX + mapSize/2, mapY + 15);
}

async function main() {
    if (!navigator.gpu) {
        console.error("WebGPU not supported!");
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No adapter found!");
        return;
    }

    const device = await adapter.requestDevice();
    console.log("Device acquired");

    // Get WebGPU context
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
        alphaMode: "premultiplied"
    });

    const width = canvas.width || 1280;
    const height = canvas.height || 720;

    // =========================================================================
    // Create Canvas 2D for UI using standard web API
    // =========================================================================
    console.log("Creating offscreen canvas for UI...");

    // Standard web API: create canvas, set dimensions, get 2D context
    const uiCanvas = document.createElement('canvas');
    uiCanvas.width = width;
    uiCanvas.height = height;
    const ctx = uiCanvas.getContext('2d');

    if (!ctx) {
        console.error("Failed to get 2D context for UI canvas!");
        return;
    }
    console.log("UI Canvas 2D context created:", width, "x", height);

    // =========================================================================
    // Create GPU texture for UI overlay
    // =========================================================================
    const uiTexture = device.createTexture({
        label: "UI Texture",
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const uiTextureView = uiTexture.createView();
    console.log("UI texture created");

    // Sampler for UI texture
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
    });

    // Bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
        ]
    });

    // Bind group
    const uiBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: uiTextureView }
        ]
    });

    // Pipeline layout
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });

    // Shader module
    const shaderModule = device.createShaderModule({
        code: uiShaderCode
    });

    // UI render pipeline (with alpha blending)
    const uiPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain"
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: format,
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                }
            }]
        },
        primitive: {
            topology: "triangle-list"
        }
    });
    console.log("UI pipeline created");

    let frameCount = 0;
    const startTime = Date.now();

    function render() {
        const time = (Date.now() - startTime) / 1000;

        // =====================================================================
        // Step 1: Render UI to Canvas 2D
        // =====================================================================
        renderUI(ctx, width, height, time);

        // =====================================================================
        // Step 2: Upload Canvas 2D to GPU texture
        // =====================================================================
        const imageData = ctx.getImageData(0, 0, width, height);
        device.queue.writeTexture(
            { texture: uiTexture },
            imageData.data,
            { bytesPerRow: width * 4, rowsPerImage: height },
            [width, height]
        );

        // =====================================================================
        // Step 3: Render WebGPU scene (background gradient)
        // =====================================================================
        const commandEncoder = device.createCommandEncoder();

        // Clear with animated gradient color
        const t = time * 0.5;
        const r = 0.05 + Math.sin(t) * 0.02;
        const g = 0.08 + Math.sin(t * 0.7) * 0.02;
        const b = 0.15 + Math.sin(t * 0.5) * 0.05;

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: r, g: g, b: b, a: 1.0 }
            }]
        });

        // =====================================================================
        // Step 4: Composite UI overlay on top
        // =====================================================================
        renderPass.setPipeline(uiPipeline);
        renderPass.setBindGroup(0, uiBindGroup);
        renderPass.draw(6);  // Fullscreen quad

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);

        frameCount++;
        if (frameCount % 60 === 0) {
            console.log("Frame:", frameCount, "Time:", time.toFixed(1) + "s");
        }

        requestAnimationFrame(render);
    }

    console.log("Starting render loop - UI composited over WebGPU!");
    requestAnimationFrame(render);
}

main().catch(console.error);
