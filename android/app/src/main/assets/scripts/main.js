/**
 * Android GLB Parser Test - DamagedHelmet with Textures
 *
 * Tests the pure JavaScript GLB parser with the DamagedHelmet model.
 * Renders with base color texture using createImageBitmap for decoding.
 */

console.log("Android GLB Parser Test starting...");

// PBR shader with texture sampling
const shaderCode = /* wgsl */`
    const PI = 3.14159265359;

    struct SceneUniforms {
        viewMatrix: mat4x4f,
        projectionMatrix: mat4x4f,
        cameraPosition: vec3f,
        _pad1: f32,
        lightDirection: vec3f,
        _pad2: f32,
        lightColor: vec3f,
        lightIntensity: f32,
    }

    struct ModelUniforms {
        modelMatrix: mat4x4f,
        normalMatrix: mat4x4f,
        baseColor: vec3f,
        metallic: f32,
        roughness: f32,
        _pad: vec3f,
    }

    @group(0) @binding(0) var<uniform> scene: SceneUniforms;
    @group(1) @binding(0) var<uniform> model: ModelUniforms;
    @group(2) @binding(0) var baseColorTexture: texture_2d<f32>;
    @group(2) @binding(1) var baseColorSampler: sampler;

    struct VertexInput {
        @location(0) position: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f,
    }

    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) worldPosition: vec3f,
        @location(1) worldNormal: vec3f,
        @location(2) uv: vec2f,
    }

    @vertex
    fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        let worldPos = model.modelMatrix * vec4f(input.position, 1.0);
        output.worldPosition = worldPos.xyz;
        output.position = scene.projectionMatrix * scene.viewMatrix * worldPos;
        output.worldNormal = normalize((model.normalMatrix * vec4f(input.normal, 0.0)).xyz);
        output.uv = input.uv;
        return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        let N = normalize(input.worldNormal);
        let V = normalize(scene.cameraPosition - input.worldPosition);
        let L = normalize(scene.lightDirection);
        let H = normalize(V + L);

        // Sample base color texture (flip V for GLTF convention)
        let flippedUV = vec2f(input.uv.x, 1.0 - input.uv.y);
        let texColor = textureSample(baseColorTexture, baseColorSampler, flippedUV);
        let albedo = texColor.rgb * model.baseColor;

        // Simple PBR
        let NdotL = max(dot(N, L), 0.0);
        let NdotV = max(dot(N, V), 0.0);
        let NdotH = max(dot(N, H), 0.0);

        // Diffuse
        let diffuse = albedo / PI;

        // Specular (simplified GGX)
        let a = model.roughness * model.roughness;
        let a2 = a * a;
        let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
        let D = a2 / (PI * d * d);

        let F0 = mix(vec3f(0.04), albedo, model.metallic);
        let F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);

        let k = (model.roughness + 1.0) * (model.roughness + 1.0) / 8.0;
        let G = (NdotV / (NdotV * (1.0 - k) + k)) * (NdotL / (NdotL * (1.0 - k) + k));

        let specular = D * F * G / max(4.0 * NdotV * NdotL, 0.001);

        // Combine with metallic workflow
        var kD = (1.0 - F) * (1.0 - model.metallic);
        let Lo = (kD * diffuse + specular) * scene.lightColor * scene.lightIntensity * NdotL;

        // Ambient
        let ambient = albedo * 0.15;

        var color = ambient + Lo;

        // Tone mapping and gamma
        color = color / (color + vec3f(1.0));
        color = pow(color, vec3f(1.0 / 2.2));

        return vec4f(color, 1.0);
    }
`;

// Matrix utilities
function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
    ]);
}

function lookAt(eye, target, up) {
    const zAxis = normalize3(subtract3(eye, target));
    const xAxis = normalize3(cross3(up, zAxis));
    const yAxis = cross3(zAxis, xAxis);
    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot3(xAxis, eye), -dot3(yAxis, eye), -dot3(zAxis, eye), 1,
    ]);
}

function subtract3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize3(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
}

// Arc controls state
let rotationX = 0.3;
let rotationY = 0.5;
let lastTouchX = 0;
let lastTouchY = 0;
let isDragging = false;
let cameraDistance = 3;

function setupTouchHandlers() {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return;

    canvasEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            isDragging = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }
    });

    canvasEl.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging && e.touches.length > 0) {
            const deltaX = e.touches[0].clientX - lastTouchX;
            const deltaY = e.touches[0].clientY - lastTouchY;
            rotationY += deltaX * 0.01;
            rotationX += deltaY * 0.01;
            rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotationX));
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }
    });

    canvasEl.addEventListener('touchend', () => { isDragging = false; });
    canvasEl.addEventListener('touchcancel', () => { isDragging = false; });
    canvasEl.addEventListener('mousedown', (e) => { isDragging = true; lastTouchX = e.clientX; lastTouchY = e.clientY; });
    canvasEl.addEventListener('mousemove', (e) => {
        if (isDragging) {
            rotationY += (e.clientX - lastTouchX) * 0.01;
            rotationX += (e.clientY - lastTouchY) * 0.01;
            rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotationX));
            lastTouchX = e.clientX; lastTouchY = e.clientY;
        }
    });
    canvasEl.addEventListener('mouseup', () => { isDragging = false; });
    canvasEl.addEventListener('wheel', (e) => {
        cameraDistance += e.deltaY * 0.01;
        cameraDistance = Math.max(1, Math.min(10, cameraDistance));
    });
    console.log("Touch handlers set up");
}

async function init() {
    setupTouchHandlers();

    // Load GLB parser
    console.log("Loading GLB parser...");
    if (typeof parseGLB === 'undefined') {
        const parserResponse = await fetch('scripts/glb-parser.js');
        const parserCode = await parserResponse.text();
        eval(parserCode);
    }

    console.log("Loading DamagedHelmet...");
    const gltfData = await loadGLB('DamagedHelmet.glb');
    console.log("GLB loaded: " + gltfData.meshes.length + " meshes, " + gltfData.images.length + " images");

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No WebGPU adapter");
    const device = await adapter.requestDevice();
    console.log("WebGPU device acquired");

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format });

    // Decode base color texture (texture 0 -> image 0)
    let baseColorBitmap = null;
    if (gltfData.textures && gltfData.textures.length > 0 && gltfData.images.length > 0) {
        const texInfo = gltfData.textures[0];
        const imgData = gltfData.images[texInfo.imageIndex];
        if (imgData && imgData.data) {
            console.log("Decoding base color texture: " + imgData.data.length + " bytes, " + imgData.mimeType);
            try {
                baseColorBitmap = await createImageBitmap(imgData.data.buffer);
                console.log("Decoded texture: " + baseColorBitmap.width + "x" + baseColorBitmap.height);
            } catch (e) {
                console.log("Failed to decode texture: " + e.message);
            }
        }
    }

    // Create GPU texture from decoded image
    let gpuTexture;
    if (baseColorBitmap && baseColorBitmap._data) {
        gpuTexture = device.createTexture({
            size: [baseColorBitmap.width, baseColorBitmap.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.writeTexture(
            { texture: gpuTexture },
            baseColorBitmap._data,
            { bytesPerRow: baseColorBitmap.width * 4 },
            [baseColorBitmap.width, baseColorBitmap.height]
        );
        console.log("Created GPU texture");
    } else {
        // Fallback: 1x1 white texture
        gpuTexture = device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        device.queue.writeTexture({ texture: gpuTexture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
        console.log("Using fallback 1x1 white texture");
    }

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
    });

    // Create shader and pipeline
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const sceneBindGroupLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
    });
    const modelBindGroupLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
    });
    const textureBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, modelBindGroupLayout, textureBindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 32,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                    { shaderLocation: 2, offset: 24, format: 'float32x2' },
                ],
            }],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });

    // Create mesh buffers
    const meshBuffers = [];
    for (const mesh of gltfData.meshes) {
        for (const prim of mesh.primitives) {
            if (!prim.positions || prim.vertexCount === 0) continue;

            const vertexCount = prim.vertexCount;
            const hasNormals = prim.normals && prim.normals.length >= vertexCount * 3;
            const hasUVs = prim.texcoords && prim.texcoords.length >= vertexCount * 2;

            const vertexData = new Float32Array(vertexCount * 8);
            for (let i = 0; i < vertexCount; i++) {
                vertexData[i * 8 + 0] = prim.positions[i * 3 + 0];
                vertexData[i * 8 + 1] = prim.positions[i * 3 + 1];
                vertexData[i * 8 + 2] = prim.positions[i * 3 + 2];
                vertexData[i * 8 + 3] = hasNormals ? prim.normals[i * 3 + 0] : 0;
                vertexData[i * 8 + 4] = hasNormals ? prim.normals[i * 3 + 1] : 1;
                vertexData[i * 8 + 5] = hasNormals ? prim.normals[i * 3 + 2] : 0;
                vertexData[i * 8 + 6] = hasUVs ? prim.texcoords[i * 2 + 0] : 0;
                vertexData[i * 8 + 7] = hasUVs ? prim.texcoords[i * 2 + 1] : 0;
            }

            const vertexBuffer = device.createBuffer({
                size: vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vertexBuffer, 0, vertexData);

            let indexBuffer = null, indexCount = 0;
            if (prim.indices && prim.indexCount > 0) {
                const indices = new Uint32Array(prim.indices);
                indexBuffer = device.createBuffer({
                    size: indices.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(indexBuffer, 0, indices);
                indexCount = prim.indexCount;
            }

            let baseColor = [1, 1, 1], metallic = 0.5, roughness = 0.5;
            if (prim.materialIndex >= 0 && prim.materialIndex < gltfData.materials.length) {
                const mat = gltfData.materials[prim.materialIndex];
                baseColor = mat.baseColorFactor.slice(0, 3);
                metallic = mat.metallicFactor;
                roughness = mat.roughnessFactor;
            }

            meshBuffers.push({ vertexBuffer, indexBuffer, indexCount, vertexCount, baseColor, metallic, roughness });
        }
    }
    console.log("Created " + meshBuffers.length + " mesh buffers");

    // Uniform buffers
    const sceneUniformBuffer = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const modelUniformBuffer = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const sceneBindGroup = device.createBindGroup({
        layout: sceneBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });
    const modelBindGroup = device.createBindGroup({
        layout: modelBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: modelUniformBuffer } }],
    });
    const textureBindGroup = device.createBindGroup({
        layout: textureBindGroupLayout,
        entries: [
            { binding: 0, resource: gpuTexture.createView() },
            { binding: 1, resource: sampler },
        ],
    });

    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const fov = 60 * Math.PI / 180;
    const lightDir = normalize3([1, 1, 0.5]);

    console.log("Starting render loop");

    function frame() {
        const cameraX = Math.sin(rotationY) * Math.cos(rotationX) * cameraDistance;
        const cameraY = Math.sin(rotationX) * cameraDistance;
        const cameraZ = Math.cos(rotationY) * Math.cos(rotationX) * cameraDistance;
        const cameraPos = [cameraX, cameraY, cameraZ];

        const viewMatrix = lookAt(cameraPos, [0, 0, 0], [0, 1, 0]);
        const projMatrix = perspective(fov, canvas.width / canvas.height, 0.1, 100);

        const sceneData = new Float32Array(64);
        sceneData.set(viewMatrix, 0);
        sceneData.set(projMatrix, 16);
        sceneData[32] = cameraPos[0]; sceneData[33] = cameraPos[1]; sceneData[34] = cameraPos[2];
        sceneData[36] = lightDir[0]; sceneData[37] = lightDir[1]; sceneData[38] = lightDir[2];
        sceneData[40] = 1.0; sceneData[41] = 0.98; sceneData[42] = 0.95; sceneData[43] = 5.0;
        device.queue.writeBuffer(sceneUniformBuffer, 0, sceneData);

        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: ctx.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, sceneBindGroup);
        renderPass.setBindGroup(2, textureBindGroup);

        for (const meshBuf of meshBuffers) {
            const modelData = new Float32Array(48);
            modelData.set(identity(), 0);
            modelData.set(identity(), 16);
            modelData[32] = meshBuf.baseColor[0];
            modelData[33] = meshBuf.baseColor[1];
            modelData[34] = meshBuf.baseColor[2];
            modelData[35] = meshBuf.metallic;
            modelData[36] = meshBuf.roughness;
            device.queue.writeBuffer(modelUniformBuffer, 0, modelData);

            renderPass.setBindGroup(1, modelBindGroup);
            renderPass.setVertexBuffer(0, meshBuf.vertexBuffer);
            if (meshBuf.indexBuffer) {
                renderPass.setIndexBuffer(meshBuf.indexBuffer, 'uint32');
                renderPass.drawIndexed(meshBuf.indexCount);
            } else {
                renderPass.draw(meshBuf.vertexCount);
            }
        }

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    frame();
}

init().catch((e) => {
    console.log("Error: " + (e.message || e));
    console.log(e.stack || "");
});
