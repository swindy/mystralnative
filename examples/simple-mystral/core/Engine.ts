import { Scene } from './Scene';
import { Camera } from './Camera';
import { Mesh } from './Mesh';
import { Matrix4 } from '../math/Matrix4';

/**
 * Minimal WebGPU Engine using vertex pulling pattern.
 * Works with native runtime that doesn't have setVertexBuffer/setIndexBuffer.
 */
export class Engine {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private bindGroupLayout!: GPUBindGroupLayout;

  // Per-mesh GPU resources (cached)
  private meshResources: Map<Mesh, { vertexBuffer: GPUBuffer; bindGroup: GPUBindGroup }> = new Map();

  private depthTexture!: GPUTexture;

  constructor() {}

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter found');
    }

    this.device = await adapter.requestDevice();
    console.log('Engine: Device acquired');

    // Get canvas context (native runtime provides global 'canvas')
    this.context = (canvas as any).getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });

    // Create uniform buffer for MVP matrix (64 bytes) + model matrix (64 bytes) + material (32 bytes)
    this.uniformBuffer = this.device.createBuffer({
      size: 160,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    // Create pipeline
    const shaderModule = this.device.createShaderModule({
      code: this.getShaderCode(),
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: this.format }],
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

    // Create depth texture
    this.depthTexture = this.device.createTexture({
      size: [(canvas as any).width, (canvas as any).height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    console.log('Engine: Initialized');
  }

  private getShaderCode(): string {
    return `
struct Uniforms {
    mvp: mat4x4f,
    model: mat4x4f,
    materialColor: vec4f,
    lightDir: vec4f,
}

// Matches Geometry.getPackedVertexData layout:
// position(16) + normal(16) + uv(16) + color(16) = 64 bytes per vertex
struct Vertex {
    position: vec4f,  // xyz + padding
    normal: vec4f,    // xyz + padding
    uv: vec4f,        // xy + padding
    color: vec4f,     // xyz + padding
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) worldNormal: vec3f,
    @location(1) color: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertices[vertexIndex];

    var output: VertexOutput;
    output.position = uniforms.mvp * vec4f(vertex.position.xyz, 1.0);
    output.worldNormal = (uniforms.model * vec4f(vertex.normal.xyz, 0.0)).xyz;
    output.color = uniforms.materialColor.rgb;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let lightDir = normalize(uniforms.lightDir.xyz);
    let normal = normalize(input.worldNormal);

    // Simple diffuse + ambient lighting
    let diffuse = max(dot(normal, lightDir), 0.0);
    let ambient = 0.3;
    let lighting = ambient + diffuse * 0.7;

    return vec4f(input.color * lighting, 1.0);
}
`;
  }

  private getMeshResources(mesh: Mesh): { vertexBuffer: GPUBuffer; bindGroup: GPUBindGroup } {
    if (!this.meshResources.has(mesh)) {
      // Create vertex buffer from geometry
      const vertexData = mesh.geometry.getPackedVertexData();

      const vertexBuffer = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, vertexData.byteLength);

      // Create bind group
      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: vertexBuffer } },
        ],
      });

      this.meshResources.set(mesh, { vertexBuffer, bindGroup });
    }

    return this.meshResources.get(mesh)!;
  }

  render(scene: Scene, camera: Camera): void {
    const commandEncoder = this.device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: scene.backgroundColor,
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      },
    });

    renderPass.setPipeline(this.pipeline);

    // Get view and projection matrices
    const viewMatrix = camera.viewMatrix;
    const projMatrix = camera.projectionMatrix;
    const viewProj = new Matrix4().multiplyMatrices(projMatrix, viewMatrix);

    // Get light direction from scene (default if no lights)
    let lightDir = { x: 0.5, y: 1.0, z: 0.3 };
    if (scene.lights.length > 0 && scene.lights[0].direction) {
      lightDir = scene.lights[0].direction;
    }

    // Render all meshes
    scene.traverse((node) => {
      if (!node.visible) return false;

      if (node instanceof Mesh) {
        const mesh = node as Mesh;
        const resources = this.getMeshResources(mesh);

        // Compute MVP matrix
        const modelMatrix = mesh.transform.worldMatrix;
        const mvp = new Matrix4().multiplyMatrices(viewProj, modelMatrix);

        // Upload uniforms
        const uniformData = new Float32Array(40); // 160 bytes / 4
        uniformData.set(mvp.elements, 0); // MVP matrix (16 floats)
        uniformData.set(modelMatrix.elements, 16); // Model matrix (16 floats)
        // Material color (4 floats)
        uniformData[32] = mesh.material.color.x;
        uniformData[33] = mesh.material.color.y;
        uniformData[34] = mesh.material.color.z;
        uniformData[35] = 1.0;
        // Light direction (4 floats)
        uniformData[36] = lightDir.x;
        uniformData[37] = lightDir.y;
        uniformData[38] = lightDir.z;
        uniformData[39] = 0.0;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData, 0, uniformData.byteLength);

        renderPass.setBindGroup(0, resources.bindGroup);
        renderPass.draw(mesh.geometry.vertexCount);
      }

      return true;
    });

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  run(callback: (deltaTime: number) => void): void {
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      callback(deltaTime);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
