/**
 * Textured Cube Example - Tests texture loading in native runtime
 * Uses a simplified standalone WebGPU setup with texture sampling.
 */

import { Texture } from '../simple-mystral/core/Texture';
import { BoxGeometry } from '../simple-mystral/geometries/BoxGeometry';
import { Matrix4 } from '../simple-mystral/math/Matrix4';
import { Vector3 } from '../simple-mystral/math/Vector3';

async function main() {
  console.log('Textured Cube Example - Starting');

  if (!navigator.gpu) {
    throw new Error('WebGPU not supported');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No GPU adapter found');
  }

  const device = await adapter.requestDevice();
  console.log('Device acquired');

  // Get canvas context
  const ctx = (canvas as any).getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();

  ctx.configure({
    device: device,
    format: format,
    alphaMode: 'opaque',
  });

  const width = (canvas as any).width;
  const height = (canvas as any).height;

  // Load texture
  console.log('Loading texture...');
  const texture = new Texture('Crate Texture', { srgb: true });

  // Use a simple checkerboard pattern instead of loading a file
  // This tests createTexture and writeTexture
  const texSize = 64;
  const textureData = new Uint8Array(texSize * texSize * 4);
  for (let y = 0; y < texSize; y++) {
    for (let x = 0; x < texSize; x++) {
      const idx = (y * texSize + x) * 4;
      const isWhite = ((x >> 3) + (y >> 3)) % 2 === 0;
      textureData[idx + 0] = isWhite ? 255 : 50;  // R
      textureData[idx + 1] = isWhite ? 255 : 100; // G
      textureData[idx + 2] = isWhite ? 255 : 200; // B
      textureData[idx + 3] = 255; // A
    }
  }

  // Create GPU texture manually
  texture.gpuTexture = device.createTexture({
    label: 'Checkerboard',
    size: [texSize, texSize, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.writeTexture(
    { texture: texture.gpuTexture },
    textureData,
    { bytesPerRow: texSize * 4, rowsPerImage: texSize },
    [texSize, texSize, 1]
  );

  // Use device.createTextureView instead of texture.createView (native runtime workaround)
  texture.view = (device as any).createTextureView(texture.gpuTexture);
  texture.sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  console.log('Texture created');

  // Create geometry
  const geometry = new BoxGeometry(2, 2, 2);
  const vertexData = geometry.getPackedVertexData();

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  // Create uniform buffer
  const uniformBuffer = device.createBuffer({
    size: 160, // MVP(64) + model(64) + material(32)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create depth texture
  const depthTexture = device.createTexture({
    size: [width, height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Create shader module
  const shaderCode = `
struct Uniforms {
    mvp: mat4x4f,
    model: mat4x4f,
    materialColor: vec4f,
    lightDir: vec4f,
}

struct Vertex {
    position: vec4f,  // vec3f + padding
    normal: vec4f,    // vec3f + padding
    uv: vec4f,        // vec2f + padding (8 bytes)
    color: vec4f,     // vec3f + padding
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var texSampler: sampler;
@group(0) @binding(3) var texImage: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) worldNormal: vec3f,
    @location(1) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertices[vertexIndex];

    var output: VertexOutput;
    output.position = uniforms.mvp * vec4f(vertex.position.xyz, 1.0);
    output.worldNormal = (uniforms.model * vec4f(vertex.normal.xyz, 0.0)).xyz;
    output.uv = vertex.uv.xy;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let lightDir = normalize(uniforms.lightDir.xyz);
    let normal = normalize(input.worldNormal);

    // Sample texture
    let texColor = textureSample(texImage, texSampler, input.uv);

    // Simple diffuse + ambient lighting
    let diffuse = max(dot(normal, lightDir), 0.0);
    let ambient = 0.3;
    let lighting = ambient + diffuse * 0.7;

    return vec4f(texColor.rgb * lighting, 1.0);
}
`;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    ],
  });

  // Create pipeline
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format: format }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });

  // Create bind group
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: vertexBuffer } },
      { binding: 2, resource: texture.sampler! },
      { binding: 3, resource: texture.view! },
    ],
  });

  console.log('Pipeline created');

  // Camera setup
  const aspect = width / height;
  const projMatrix = new Matrix4().perspective(60 * Math.PI / 180, aspect, 0.1, 100);
  const viewMatrix = new Matrix4().lookAt(
    new Vector3(0, 2, 5),
    new Vector3(0, 0, 0),
    new Vector3(0, 1, 0)
  );
  const viewProj = new Matrix4().multiplyMatrices(projMatrix, viewMatrix);

  let time = 0;
  let frameCount = 0;

  function render() {
    time += 0.016;
    frameCount++;

    // Rotate cube
    const modelMatrix = new Matrix4().makeRotationFromEuler(time * 0.5, time * 0.7, time * 0.3);
    const mvp = new Matrix4().multiplyMatrices(viewProj, modelMatrix);

    // Upload uniforms
    const uniformData = new Float32Array(40);
    uniformData.set(mvp.elements, 0);
    uniformData.set(modelMatrix.elements, 16);
    // Material color (not used with texture, but need to fill)
    uniformData[32] = 1; uniformData[33] = 1; uniformData[34] = 1; uniformData[35] = 1;
    // Light direction
    uniformData[36] = 0.5; uniformData[37] = 1.0; uniformData[38] = 0.3; uniformData[39] = 0;

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      },
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(geometry.vertexCount);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    if (frameCount <= 5) {
      console.log(`Frame ${frameCount} rendered`);
    }

    requestAnimationFrame(render);
  }

  console.log('Starting render loop');
  requestAnimationFrame(render);
}

main().catch(err => {
  console.error('Error:', err);
});
