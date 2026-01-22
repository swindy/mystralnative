// Rotating Cube Example - WebGPU 3D rendering with matrices
// Uses storage buffers for vertex data (vertex pulling pattern)
console.log("Rotating cube example starting...");

// ============================================================================
// MATH UTILITIES
// ============================================================================

const mat4 = {
  create() {
    return new Float32Array(16);
  },

  identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },

  perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  },

  lookAt(out, eye, center, up) {
    const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let len = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz);
    const z0 = zx * len, z1 = zy * len, z2 = zz * len;

    const xx = up[1] * z2 - up[2] * z1;
    const xy = up[2] * z0 - up[0] * z2;
    const xz = up[0] * z1 - up[1] * z0;
    len = Math.sqrt(xx * xx + xy * xy + xz * xz);
    const x0 = xx / len, x1 = xy / len, x2 = xz / len;

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
  },

  rotateY(out, a, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

    for (let i = 0; i < 16; i++) out[i] = a[i];
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  },

  rotateX(out, a, rad) {
    const s = Math.sin(rad), c = Math.cos(rad);
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];

    for (let i = 0; i < 16; i++) out[i] = a[i];
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  },

  multiply(out, a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[j * 4 + i] =
          a[0 * 4 + i] * b[j * 4 + 0] +
          a[1 * 4 + i] * b[j * 4 + 1] +
          a[2 * 4 + i] * b[j * 4 + 2] +
          a[3 * 4 + i] * b[j * 4 + 3];
      }
    }
    for (let i = 0; i < 16; i++) out[i] = result[i];
    return out;
  }
};

// ============================================================================
// SHADERS - Using vertex pulling from storage buffer
// ============================================================================

const shaderCode = `
struct Uniforms {
    mvp: mat4x4f,
    model: mat4x4f,
}

struct Vertex {
    position: vec3f,
    normal: vec3f,
    color: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) color: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = vertices[vertexIndex];

    var output: VertexOutput;
    output.position = uniforms.mvp * vec4f(vertex.position, 1.0);
    output.normal = (uniforms.model * vec4f(vertex.normal, 0.0)).xyz;
    output.color = vertex.color;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let lightDir = normalize(vec3f(0.5, 1.0, 0.3));
    let normal = normalize(input.normal);
    let diffuse = max(dot(normal, lightDir), 0.0);
    let ambient = 0.3;
    let lighting = ambient + diffuse * 0.7;

    return vec4f(input.color * lighting, 1.0);
}
`;

// ============================================================================
// CUBE GEOMETRY - 36 vertices (no indexing needed)
// ============================================================================

function createCubeVertices() {
  // Each face: 2 triangles, 3 vertices each = 6 vertices
  // Total: 6 faces * 6 = 36 vertices
  // Each vertex: position(3) + normal(3) + color(3) = 9 floats
  // But WGSL struct alignment requires vec3f to be 16 bytes (padded)
  // So we use: position(4) + normal(4) + color(4) = 12 floats per vertex

  const faces = [
    // Front (Z+) - Red
    { n: [0, 0, 1], c: [1, 0, 0], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    // Back (Z-) - Cyan
    { n: [0, 0, -1], c: [0, 1, 1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    // Top (Y+) - Green
    { n: [0, 1, 0], c: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    // Bottom (Y-) - Magenta
    { n: [0, -1, 0], c: [1, 0, 1], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    // Right (X+) - Blue
    { n: [1, 0, 0], c: [0, 0, 1], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    // Left (X-) - Yellow
    { n: [-1, 0, 0], c: [1, 1, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
  ];

  // 36 vertices * 12 floats (vec4 position, vec4 normal, vec4 color - padded for alignment)
  const data = new Float32Array(36 * 12);
  let i = 0;

  for (const face of faces) {
    for (const pos of face.v) {
      // Position (vec3 + padding)
      data[i++] = pos[0];
      data[i++] = pos[1];
      data[i++] = pos[2];
      data[i++] = 0; // padding

      // Normal (vec3 + padding)
      data[i++] = face.n[0];
      data[i++] = face.n[1];
      data[i++] = face.n[2];
      data[i++] = 0; // padding

      // Color (vec3 + padding)
      data[i++] = face.c[0];
      data[i++] = face.c[1];
      data[i++] = face.c[2];
      data[i++] = 0; // padding
    }
  }

  return data;
}

// ============================================================================
// MAIN
// ============================================================================

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

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque",
  });

  // Create vertex data
  const vertexData = createCubeVertices();
  console.log("Vertex data size:", vertexData.byteLength, "bytes");

  // Create storage buffer for vertices
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  // Explicitly pass byteLength to work around binding issue
  device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, vertexData.byteLength);
  console.log("Vertex buffer created");

  // Create uniform buffer (2 mat4x4f = 128 bytes)
  const uniformBuffer = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  console.log("Uniform buffer created");

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  console.log("Bind group layout created");

  // Create bind group
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: vertexBuffer } },
    ],
  });
  console.log("Bind group created");

  // Create pipeline layout
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Create shader module
  const shaderModule = device.createShaderModule({
    code: shaderCode,
  });

  // Create depth texture
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  console.log("Depth texture created");

  // Create render pipeline
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format: format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
  console.log("Pipeline created");

  // Initialize matrices
  const projection = mat4.create();
  const view = mat4.create();
  const model = mat4.create();
  const mvp = mat4.create();
  const tempMat = mat4.create();

  const aspect = canvas.width / canvas.height;
  mat4.perspective(projection, (60 * Math.PI) / 180, aspect, 0.1, 100);
  mat4.lookAt(view, [0, 1, 3], [0, 0, 0], [0, 1, 0]);

  let frameCount = 0;
  let rotation = 0;

  function render() {
    rotation += 0.02;

    mat4.identity(model);
    mat4.rotateY(model, model, rotation);
    mat4.rotateX(model, model, rotation * 0.5);

    mat4.multiply(tempMat, view, model);
    mat4.multiply(mvp, projection, tempMat);

    // Upload uniforms (MVP + model matrix)
    const uniformData = new Float32Array(32);
    uniformData.set(mvp, 0);
    uniformData.set(model, 16);
    // Explicitly pass byteLength to work around binding issue
    device.queue.writeBuffer(uniformBuffer, 0, uniformData, 0, uniformData.byteLength);

    const commandEncoder = device.createCommandEncoder();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1.0,
      },
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(36); // 36 vertices for cube
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    frameCount++;
    if (frameCount % 120 === 0) {
      console.log("Frame:", frameCount);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  console.log("Render loop started - you should see a rotating colored cube!");
}

main().catch(console.error);
