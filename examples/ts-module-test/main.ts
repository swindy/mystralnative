/**
 * TypeScript Module Test
 *
 * Tests:
 * - TypeScript transpilation via SWC
 * - Module imports (ES module syntax)
 * - WebGPU rendering with rotating cube
 */

// Import from our TypeScript module
import { mat4, MODULE_VERSION, MODULE_NAME } from './math';

console.log("=== TypeScript Module Test ===");
console.log(`Imported module: ${MODULE_NAME} v${MODULE_VERSION}`);

// Verify the module was loaded correctly
const testMatrix = mat4.create();
mat4.identity(testMatrix);
console.log(`Identity matrix diagonal: ${testMatrix[0]}, ${testMatrix[5]}, ${testMatrix[10]}, ${testMatrix[15]}`);

// ============================================================================
// SHADERS - Hardcoded cube vertices in shader
// ============================================================================

const shaderCode = `
struct Uniforms {
    mvp: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) idx: u32) -> VertexOutput {
    // 36 vertices for cube (6 faces * 2 triangles * 3 vertices)
    var positions = array<vec3f, 36>(
        // Front face (Z+) - Red
        vec3f(-0.5, -0.5,  0.5), vec3f( 0.5, -0.5,  0.5), vec3f( 0.5,  0.5,  0.5),
        vec3f(-0.5, -0.5,  0.5), vec3f( 0.5,  0.5,  0.5), vec3f(-0.5,  0.5,  0.5),
        // Back face (Z-) - Cyan
        vec3f( 0.5, -0.5, -0.5), vec3f(-0.5, -0.5, -0.5), vec3f(-0.5,  0.5, -0.5),
        vec3f( 0.5, -0.5, -0.5), vec3f(-0.5,  0.5, -0.5), vec3f( 0.5,  0.5, -0.5),
        // Top face (Y+) - Green
        vec3f(-0.5,  0.5,  0.5), vec3f( 0.5,  0.5,  0.5), vec3f( 0.5,  0.5, -0.5),
        vec3f(-0.5,  0.5,  0.5), vec3f( 0.5,  0.5, -0.5), vec3f(-0.5,  0.5, -0.5),
        // Bottom face (Y-) - Magenta
        vec3f(-0.5, -0.5, -0.5), vec3f( 0.5, -0.5, -0.5), vec3f( 0.5, -0.5,  0.5),
        vec3f(-0.5, -0.5, -0.5), vec3f( 0.5, -0.5,  0.5), vec3f(-0.5, -0.5,  0.5),
        // Right face (X+) - Blue
        vec3f( 0.5, -0.5,  0.5), vec3f( 0.5, -0.5, -0.5), vec3f( 0.5,  0.5, -0.5),
        vec3f( 0.5, -0.5,  0.5), vec3f( 0.5,  0.5, -0.5), vec3f( 0.5,  0.5,  0.5),
        // Left face (X-) - Yellow
        vec3f(-0.5, -0.5, -0.5), vec3f(-0.5, -0.5,  0.5), vec3f(-0.5,  0.5,  0.5),
        vec3f(-0.5, -0.5, -0.5), vec3f(-0.5,  0.5,  0.5), vec3f(-0.5,  0.5, -0.5),
    );

    var colors = array<vec3f, 6>(
        vec3f(1.0, 0.0, 0.0), // Red
        vec3f(0.0, 1.0, 1.0), // Cyan
        vec3f(0.0, 1.0, 0.0), // Green
        vec3f(1.0, 0.0, 1.0), // Magenta
        vec3f(0.0, 0.0, 1.0), // Blue
        vec3f(1.0, 1.0, 0.0), // Yellow
    );

    var output: VertexOutput;
    output.position = uniforms.mvp * vec4f(positions[idx], 1.0);
    output.color = colors[idx / 6u]; // Each face has 6 vertices
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return vec4f(input.color, 1.0);
}
`;

// ============================================================================
// MAIN RENDERING CODE
// ============================================================================

interface GPUDevice {
  createShaderModule(desc: { code: string }): any;
  createRenderPipeline(desc: any): any;
  createBuffer(desc: any): any;
  createBindGroup(desc: any): any;
  createBindGroupLayout(desc: any): any;
  createPipelineLayout(desc: any): any;
  createCommandEncoder(): any;
  queue: { writeBuffer: (buf: any, offset: number, data: any) => void; submit: (cmds: any[]) => void };
}

async function main(): Promise<void> {
  console.log("Starting WebGPU initialization...");

  // Get the canvas and WebGPU context
  const canvas = document.getElementById('engine-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("Canvas not found!");
  }

  const context = canvas.getContext('webgpu') as any;
  if (!context) {
    throw new Error("WebGPU context not available!");
  }

  // Request adapter and device
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No WebGPU adapter found!");
  }
  console.log("Got WebGPU adapter");

  const device: GPUDevice = await adapter.requestDevice();
  console.log("Got WebGPU device");

  // Configure context
  const format = (navigator as any).gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });
  console.log(`Canvas format: ${format}`);

  // Create shader module
  const shaderModule = device.createShaderModule({ code: shaderCode });
  console.log("Created shader module");

  // Create uniform buffer for MVP matrix (64 bytes for mat4x4)
  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: 0x0040 | 0x0008, // UNIFORM | COPY_DST
  });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: 0x0001, // VERTEX
      buffer: { type: 'uniform' }
    }]
  });

  // Create pipeline layout
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  });

  // Create bind group
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer }
    }]
  });

  // Create render pipeline
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vertexMain',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragmentMain',
      targets: [{ format }],
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
  console.log("Created render pipeline");

  // Create depth texture
  const depthTexture = (device as any).createTexture({
    size: { width: canvas.width, height: canvas.height },
    format: 'depth24plus',
    usage: 0x0010, // RENDER_ATTACHMENT
  });

  // Animation matrices
  const projection = mat4.create();
  const view = mat4.create();
  const model = mat4.create();
  const mvp = mat4.create();
  const temp = mat4.create();

  // Set up perspective
  const aspect = canvas.width / canvas.height;
  mat4.perspective(projection, Math.PI / 4, aspect, 0.1, 100);
  mat4.lookAt(view, [0, 1.5, 3], [0, 0, 0], [0, 1, 0]);

  let rotation = 0;

  function frame(): void {
    rotation += 0.02;

    // Compute MVP
    mat4.identity(model);
    mat4.rotateY(model, model, rotation);
    mat4.multiply(temp, view, model);
    mat4.multiply(mvp, projection, temp);

    // Upload MVP
    device.queue.writeBuffer(uniformBuffer, 0, mvp);

    // Render
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(36, 1, 0, 0);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  }

  console.log("Starting render loop...");
  frame();
}

// Run main
main().catch((err: Error) => {
  console.error("Fatal error:", err.message);
});
