// examples/simple-mystral/core/Texture.ts
function createShaderModuleSafe(device, descriptor) {
  return device.createShaderModule(descriptor);
}

class Texture {
  gpuTexture = null;
  view = null;
  sampler = null;
  label;
  srgb = false;
  premultiplyAlpha = false;
  constructor(label = "Texture", options) {
    this.label = label;
    if (options) {
      this.srgb = options.srgb ?? false;
      this.premultiplyAlpha = options.premultiplyAlpha ?? false;
    }
  }
  async load(device, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch texture: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      const imgBitmap = await createImageBitmap(blob);
      this.createFromImageBitmap(device, imgBitmap);
    } catch (e) {
      console.error(`Failed to load texture: ${url}`, e);
      throw e;
    }
  }
  static fromGPUTexture(device, gpuTexture, label = "GPU Texture") {
    const texture = new Texture(label);
    texture.gpuTexture = gpuTexture;
    texture.view = gpuTexture.createView();
    texture.sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat"
    });
    return texture;
  }
  createFromImageBitmap(device, imgBitmap) {
    const mipLevelCount = Math.floor(Math.log2(Math.max(imgBitmap.width, imgBitmap.height))) + 1;
    const format = this.srgb ? "rgba8unorm-srgb" : "rgba8unorm";
    this.gpuTexture = device.createTexture({
      label: this.label,
      size: [imgBitmap.width, imgBitmap.height, 1],
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount
    });
    device.queue.copyExternalImageToTexture({ source: imgBitmap, flipY: false }, { texture: this.gpuTexture, premultipliedAlpha: this.premultiplyAlpha }, [imgBitmap.width, imgBitmap.height]);
    if (mipLevelCount > 1) {
      Texture.generateMipmaps(device, this.gpuTexture, mipLevelCount);
    }
    this.view = this.gpuTexture.createView();
    this.sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      maxAnisotropy: 4
    });
  }
  static generateMipmaps(device, texture, mipLevelCount) {
    const pipeline = Texture.getMipmapPipeline(device, texture.format);
    const commandEncoder = device.createCommandEncoder({ label: "Mipmap Gen" });
    let width = texture.width;
    let height = texture.height;
    for (let i = 1;i < mipLevelCount; i++) {
      const dstWidth = Math.max(1, Math.floor(width / 2));
      const dstHeight = Math.max(1, Math.floor(height / 2));
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: device.createSampler({ minFilter: "linear" }) },
          { binding: 1, resource: texture.createView({ baseMipLevel: i - 1, mipLevelCount: 1 }) }
        ]
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: texture.createView({ baseMipLevel: i, mipLevelCount: 1 }),
          loadOp: "clear",
          storeOp: "store"
        }]
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      width = dstWidth;
      height = dstHeight;
    }
    device.queue.submit([commandEncoder.finish()]);
  }
  static mipmapPipelineCache = new Map;
  static getMipmapPipeline(device, format) {
    if (this.mipmapPipelineCache.has(format)) {
      return this.mipmapPipelineCache.get(format);
    }
    const module = createShaderModuleSafe(device, {
      code: `
            struct VertexOutput {
                @builtin(position) position : vec4f,
                @location(0) uv : vec2f,
            }

            @vertex
            fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
                var output : VertexOutput;
                let pos = array(
                  vec2f(-1.0, -1.0),
                  vec2f( 3.0, -1.0),
                  vec2f(-1.0,  3.0)
                );
                let p = pos[vertexIndex];
                output.position = vec4f(p, 0.0, 1.0);
                output.uv = p * 0.5 + 0.5;
                output.uv.y = 1.0 - output.uv.y;
                return output;
            }

            @group(0) @binding(0) var samp : sampler;
            @group(0) @binding(1) var img : texture_2d<f32>;

            @fragment
            fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {
                return textureSample(img, samp, uv);
            }
          `
    });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vs_main"
      },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{ format }]
      },
      primitive: { topology: "triangle-list" }
    });
    this.mipmapPipelineCache.set(format, pipeline);
    return pipeline;
  }
  static _defaultTextures = new Map;
  static getDefault(device) {
    if (!Texture._defaultTextures.has(device)) {
      const texture = new Texture("Default White Texture");
      texture.gpuTexture = device.createTexture({
        label: "Default White Texture",
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });
      const data = new Uint8Array([255, 255, 255, 255]);
      device.queue.writeTexture({ texture: texture.gpuTexture }, data, { bytesPerRow: 4, rowsPerImage: 1 }, [1, 1, 1]);
      texture.view = texture.gpuTexture.createView();
      texture.sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
      });
      Texture._defaultTextures.set(device, texture);
    }
    return Texture._defaultTextures.get(device);
  }
}

// examples/simple-mystral/math/Vector3.ts
class Vector3 {
  x;
  y;
  z;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  static get zero() {
    return new Vector3(0, 0, 0);
  }
  static get one() {
    return new Vector3(1, 1, 1);
  }
  static get up() {
    return new Vector3(0, 1, 0);
  }
  static get down() {
    return new Vector3(0, -1, 0);
  }
  static get right() {
    return new Vector3(1, 0, 0);
  }
  static get left() {
    return new Vector3(-1, 0, 0);
  }
  static get forward() {
    return new Vector3(0, 0, -1);
  }
  static get back() {
    return new Vector3(0, 0, 1);
  }
  static min(a, b) {
    return new Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
  }
  static max(a, b) {
    return new Vector3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  add(v) {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  subtract(v) {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  multiply(scalar) {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }
  multiplyScalar(scalar) {
    return this.multiply(scalar);
  }
  divide(scalar) {
    if (scalar === 0) {
      throw new Error("Cannot divide by zero");
    }
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }
  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  magnitudeSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    const mag = this.magnitude();
    if (mag === 0) {
      return Vector3.zero;
    }
    return this.divide(mag);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  distanceTo(v) {
    return this.subtract(v).magnitude();
  }
  distanceToSquared(v) {
    return this.subtract(v).magnitudeSquared();
  }
  clampMagnitude(maxMagnitude) {
    const mag = this.magnitude();
    if (mag > maxMagnitude) {
      return this.normalize().multiply(maxMagnitude);
    }
    return this.clone();
  }
  lerp(v, t) {
    return this.add(v.subtract(this).multiply(t));
  }
  slerp(v, t) {
    const dot = this.dot(v);
    const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
    const sinTheta = Math.sin(theta);
    if (sinTheta === 0) {
      return this.lerp(v, t);
    }
    const a = Math.sin((1 - t) * theta) / sinTheta;
    const b = Math.sin(t * theta) / sinTheta;
    return this.multiply(a).add(v.multiply(b));
  }
  reflect(normal) {
    return this.subtract(normal.multiply(2 * this.dot(normal)));
  }
  projectOn(v) {
    const vMagSq = v.magnitudeSquared();
    if (vMagSq === 0) {
      return Vector3.zero;
    }
    return v.multiply(this.dot(v) / vMagSq);
  }
  angleTo(v) {
    const dotProduct = this.dot(v);
    const magProduct = this.magnitude() * v.magnitude();
    if (magProduct === 0) {
      return 0;
    }
    return Math.acos(Math.max(-1, Math.min(1, dotProduct / magProduct)));
  }
  equals(v, epsilon = 0.000001) {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon && Math.abs(this.z - v.z) < epsilon;
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  toString() {
    return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
  toArray() {
    return [this.x, this.y, this.z];
  }
  static fromArray(array) {
    return new Vector3(array[0], array[1], array[2]);
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
}

// examples/simple-mystral/core/Geometry.ts
class Geometry {
  positions = new Float32Array(0);
  normals = new Float32Array(0);
  uvs = new Float32Array(0);
  colors = new Float32Array(0);
  vertexCount = 0;
  bounds = {
    min: new Vector3(Infinity, Infinity, Infinity),
    max: new Vector3(-Infinity, -Infinity, -Infinity)
  };
  constructor() {}
  setPositions(data) {
    this.positions = data;
    this.vertexCount = data.length / 3;
    this.computeBounds();
  }
  setNormals(data) {
    this.normals = data;
  }
  setUVs(data) {
    this.uvs = data;
  }
  setColors(data) {
    this.colors = data;
  }
  computeBounds() {
    this.bounds.min.set(Infinity, Infinity, Infinity);
    this.bounds.max.set(-Infinity, -Infinity, -Infinity);
    for (let i = 0;i < this.positions.length; i += 3) {
      const x = this.positions[i];
      const y = this.positions[i + 1];
      const z = this.positions[i + 2];
      this.bounds.min.x = Math.min(this.bounds.min.x, x);
      this.bounds.min.y = Math.min(this.bounds.min.y, y);
      this.bounds.min.z = Math.min(this.bounds.min.z, z);
      this.bounds.max.x = Math.max(this.bounds.max.x, x);
      this.bounds.max.y = Math.max(this.bounds.max.y, y);
      this.bounds.max.z = Math.max(this.bounds.max.z, z);
    }
  }
  getPackedVertexData() {
    const floatsPerVertex = 16;
    const data = new Float32Array(this.vertexCount * floatsPerVertex);
    for (let i = 0;i < this.vertexCount; i++) {
      const srcIdx3 = i * 3;
      const srcIdx2 = i * 2;
      const dstIdx = i * floatsPerVertex;
      data[dstIdx + 0] = this.positions[srcIdx3 + 0];
      data[dstIdx + 1] = this.positions[srcIdx3 + 1];
      data[dstIdx + 2] = this.positions[srcIdx3 + 2];
      data[dstIdx + 3] = 0;
      if (this.normals.length > 0) {
        data[dstIdx + 4] = this.normals[srcIdx3 + 0];
        data[dstIdx + 5] = this.normals[srcIdx3 + 1];
        data[dstIdx + 6] = this.normals[srcIdx3 + 2];
      }
      data[dstIdx + 7] = 0;
      if (this.uvs.length > 0) {
        data[dstIdx + 8] = this.uvs[srcIdx2 + 0];
        data[dstIdx + 9] = this.uvs[srcIdx2 + 1];
      } else {
        data[dstIdx + 8] = 0;
        data[dstIdx + 9] = 0;
      }
      data[dstIdx + 10] = 0;
      data[dstIdx + 11] = 0;
      if (this.colors.length > 0) {
        data[dstIdx + 12] = this.colors[srcIdx3 + 0];
        data[dstIdx + 13] = this.colors[srcIdx3 + 1];
        data[dstIdx + 14] = this.colors[srcIdx3 + 2];
      } else {
        data[dstIdx + 12] = 1;
        data[dstIdx + 13] = 1;
        data[dstIdx + 14] = 1;
      }
      data[dstIdx + 15] = 0;
    }
    return data;
  }
}

// examples/simple-mystral/geometries/BoxGeometry.ts
class BoxGeometry extends Geometry {
  constructor(width = 1, height = 1, depth = 1) {
    super();
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;
    const faceUVs = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
      [1, 1],
      [0, 1]
    ];
    const faces = [
      {
        normal: [0, 0, 1],
        vertices: [
          [-w, -h, d],
          [w, -h, d],
          [w, h, d],
          [-w, -h, d],
          [w, h, d],
          [-w, h, d]
        ]
      },
      {
        normal: [0, 0, -1],
        vertices: [
          [w, -h, -d],
          [-w, -h, -d],
          [-w, h, -d],
          [w, -h, -d],
          [-w, h, -d],
          [w, h, -d]
        ]
      },
      {
        normal: [0, 1, 0],
        vertices: [
          [-w, h, d],
          [w, h, d],
          [w, h, -d],
          [-w, h, d],
          [w, h, -d],
          [-w, h, -d]
        ]
      },
      {
        normal: [0, -1, 0],
        vertices: [
          [-w, -h, -d],
          [w, -h, -d],
          [w, -h, d],
          [-w, -h, -d],
          [w, -h, d],
          [-w, -h, d]
        ]
      },
      {
        normal: [1, 0, 0],
        vertices: [
          [w, -h, d],
          [w, -h, -d],
          [w, h, -d],
          [w, -h, d],
          [w, h, -d],
          [w, h, d]
        ]
      },
      {
        normal: [-1, 0, 0],
        vertices: [
          [-w, -h, -d],
          [-w, -h, d],
          [-w, h, d],
          [-w, -h, -d],
          [-w, h, d],
          [-w, h, -d]
        ]
      }
    ];
    const positions = [];
    const normals = [];
    const uvs = [];
    for (const face of faces) {
      for (let i = 0;i < face.vertices.length; i++) {
        const vertex = face.vertices[i];
        positions.push(vertex[0], vertex[1], vertex[2]);
        normals.push(face.normal[0], face.normal[1], face.normal[2]);
        uvs.push(faceUVs[i][0], faceUVs[i][1]);
      }
    }
    this.setPositions(new Float32Array(positions));
    this.setNormals(new Float32Array(normals));
    this.setUVs(new Float32Array(uvs));
  }
}

// examples/simple-mystral/math/Matrix4.ts
class Matrix4 {
  elements;
  constructor(elements) {
    this.elements = new Float32Array(elements || [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
  }
  static get identity() {
    return new Matrix4;
  }
  static zero() {
    return new Matrix4([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ]);
  }
  copy(m) {
    this.elements.set(m.elements);
    return this;
  }
  clone() {
    return new Matrix4(Array.from(this.elements));
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  transpose() {
    const te = this.elements;
    let tmp;
    tmp = te[1];
    te[1] = te[4];
    te[4] = tmp;
    tmp = te[2];
    te[2] = te[8];
    te[8] = tmp;
    tmp = te[3];
    te[3] = te[12];
    te[12] = tmp;
    tmp = te[6];
    te[6] = te[9];
    te[9] = tmp;
    tmp = te[7];
    te[7] = te[13];
    te[13] = tmp;
    tmp = te[11];
    te[11] = te[14];
    te[14] = tmp;
    return this;
  }
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31);
  }
  inverse() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (Math.abs(det) < 0.0000000001) {
      console.warn("Matrix4.inverse(): Can not invert matrix, determinant is too small:", det);
      return this.identity();
    }
    const detInv = 1 / det;
    const out = this.elements;
    out[0] = t11 * detInv;
    out[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    out[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    out[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    out[4] = t12 * detInv;
    out[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    out[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    out[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    out[8] = t13 * detInv;
    out[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    out[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    out[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    out[12] = t14 * detInv;
    out[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    out[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    out[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    return this;
  }
  invert() {
    return this.inverse();
  }
  identity() {
    this.elements.set([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeTranslation(v) {
    this.elements.set([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      v.x,
      v.y,
      v.z,
      1
    ]);
    return this;
  }
  makeRotationFromAxisAngle(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const { x, y, z } = axis;
    const tx = t * x, ty = t * y;
    this.elements.set([
      tx * x + c,
      tx * y - s * z,
      tx * z + s * y,
      0,
      tx * y + s * z,
      ty * y + c,
      ty * z - s * x,
      0,
      tx * z - s * y,
      ty * z + s * x,
      t * z * z + c,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeRotationX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.elements.set([
      1,
      0,
      0,
      0,
      0,
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeRotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.elements.set([
      c,
      0,
      s,
      0,
      0,
      1,
      0,
      0,
      -s,
      0,
      c,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeRotationZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.elements.set([
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeRotationFromEuler(x, y, z) {
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);
    this.elements.set([
      cy * cz,
      cy * sz,
      -sy,
      0,
      sx * sy * cz - cx * sz,
      sx * sy * sz + cx * cz,
      sx * cy,
      0,
      cx * sy * cz + sx * sz,
      cx * sy * sz - sx * cz,
      cx * cy,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makeScale(v) {
    this.elements.set([
      v.x,
      0,
      0,
      0,
      0,
      v.y,
      0,
      0,
      0,
      0,
      v.z,
      0,
      0,
      0,
      0,
      1
    ]);
    return this;
  }
  makePerspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    this.elements.set([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      far / (near - far),
      -1,
      0,
      0,
      far * near / (near - far),
      0
    ]);
    return this;
  }
  perspective(fov, aspect, near, far) {
    return this.makePerspective(fov, aspect, near, far);
  }
  makeOrthographic(left, right, top, bottom, near, far) {
    const te = this.elements;
    const w = 1 / (right - left);
    const h = 1 / (top - bottom);
    const p = 1 / (far - near);
    te[0] = 2 * w;
    te[1] = 0;
    te[2] = 0;
    te[3] = 0;
    te[4] = 0;
    te[5] = 2 * h;
    te[6] = 0;
    te[7] = 0;
    te[8] = 0;
    te[9] = 0;
    te[10] = -p;
    te[11] = 0;
    te[12] = -(right + left) * w;
    te[13] = -(top + bottom) * h;
    te[14] = -near * p;
    te[15] = 1;
    return this;
  }
  lookAt(eye, target, up) {
    const ze = eye.subtract(target).normalize();
    let xe = up.cross(ze);
    if (xe.magnitudeSquared() < 0.000001) {
      if (Math.abs(up.z) < 0.999) {
        xe = new Vector3(0, 0, 1).cross(ze);
      } else {
        xe = new Vector3(1, 0, 0).cross(ze);
      }
    }
    xe = xe.normalize();
    const ye = ze.cross(xe);
    const te = this.elements;
    te[0] = xe.x;
    te[4] = xe.y;
    te[8] = xe.z;
    te[12] = -xe.dot(eye);
    te[1] = ye.x;
    te[5] = ye.y;
    te[9] = ye.z;
    te[13] = -ye.dot(eye);
    te[2] = ze.x;
    te[6] = ze.y;
    te[10] = ze.z;
    te[14] = -ze.dot(eye);
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;
    return this;
  }
  decompose() {
    const te = this.elements;
    const sx = Math.sqrt(te[0] * te[0] + te[1] * te[1] + te[2] * te[2]);
    const sy = Math.sqrt(te[4] * te[4] + te[5] * te[5] + te[6] * te[6]);
    const sz = Math.sqrt(te[8] * te[8] + te[9] * te[9] + te[10] * te[10]);
    const scale = new Vector3(sx, sy, sz);
    const position = new Vector3(te[12], te[13], te[14]);
    const rotation = this.clone();
    const invScaleX = 1 / sx;
    const invScaleY = 1 / sy;
    const invScaleZ = 1 / sz;
    rotation.elements[0] *= invScaleX;
    rotation.elements[1] *= invScaleX;
    rotation.elements[2] *= invScaleX;
    rotation.elements[4] *= invScaleY;
    rotation.elements[5] *= invScaleY;
    rotation.elements[6] *= invScaleY;
    rotation.elements[8] *= invScaleZ;
    rotation.elements[9] *= invScaleZ;
    rotation.elements[10] *= invScaleZ;
    return { position, rotation, scale };
  }
  compose(position, rotation, scale) {
    const te = this.elements;
    te[0] = rotation.elements[0] * scale.x;
    te[1] = rotation.elements[1] * scale.x;
    te[2] = rotation.elements[2] * scale.x;
    te[3] = 0;
    te[4] = rotation.elements[4] * scale.y;
    te[5] = rotation.elements[5] * scale.y;
    te[6] = rotation.elements[6] * scale.y;
    te[7] = 0;
    te[8] = rotation.elements[8] * scale.z;
    te[9] = rotation.elements[9] * scale.z;
    te[10] = rotation.elements[10] * scale.z;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  equals(m, epsilon = 0.000001) {
    const te = this.elements;
    const me = m.elements;
    for (let i = 0;i < 16; i++) {
      if (Math.abs(te[i] - me[i]) > epsilon) {
        return false;
      }
    }
    return true;
  }
  toString() {
    const te = this.elements;
    return `Matrix4(
  ${te[0].toFixed(3)}, ${te[4].toFixed(3)}, ${te[8].toFixed(3)}, ${te[12].toFixed(3)},
  ${te[1].toFixed(3)}, ${te[5].toFixed(3)}, ${te[9].toFixed(3)}, ${te[13].toFixed(3)},
  ${te[2].toFixed(3)}, ${te[6].toFixed(3)}, ${te[10].toFixed(3)}, ${te[14].toFixed(3)},
  ${te[3].toFixed(3)}, ${te[7].toFixed(3)}, ${te[11].toFixed(3)}, ${te[15].toFixed(3)}
)`;
  }
  transformVector(v) {
    const te = this.elements;
    const { x, y, z } = v;
    return new Vector3(te[0] * x + te[4] * y + te[8] * z + te[12], te[1] * x + te[5] * y + te[9] * z + te[13], te[2] * x + te[6] * y + te[10] * z + te[14]);
  }
  transformDirection(v) {
    const te = this.elements;
    const { x, y, z } = v;
    return new Vector3(te[0] * x + te[4] * y + te[8] * z, te[1] * x + te[5] * y + te[9] * z, te[2] * x + te[6] * y + te[10] * z);
  }
  toArray() {
    return this.elements.slice();
  }
}

// examples/textured-cube/main.ts
async function main() {
  console.log("Textured Cube Example - Starting");
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported");
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No GPU adapter found");
  }
  const device = await adapter.requestDevice();
  console.log("Device acquired");
  const ctx = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({
    device,
    format,
    alphaMode: "opaque"
  });
  const width = canvas.width;
  const height = canvas.height;
  console.log("Loading texture...");
  const texture = new Texture("Crate Texture", { srgb: true });
  const texSize = 64;
  const textureData = new Uint8Array(texSize * texSize * 4);
  for (let y = 0;y < texSize; y++) {
    for (let x = 0;x < texSize; x++) {
      const idx = (y * texSize + x) * 4;
      const isWhite = ((x >> 3) + (y >> 3)) % 2 === 0;
      textureData[idx + 0] = isWhite ? 255 : 50;
      textureData[idx + 1] = isWhite ? 255 : 100;
      textureData[idx + 2] = isWhite ? 255 : 200;
      textureData[idx + 3] = 255;
    }
  }
  texture.gpuTexture = device.createTexture({
    label: "Checkerboard",
    size: [texSize, texSize, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  });
  device.queue.writeTexture({ texture: texture.gpuTexture }, textureData, { bytesPerRow: texSize * 4, rowsPerImage: texSize }, [texSize, texSize, 1]);
  texture.view = device.createTextureView(texture.gpuTexture);
  texture.sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat"
  });
  console.log("Texture created");
  const geometry = new BoxGeometry(2, 2, 2);
  const vertexData = geometry.getPackedVertexData();
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  const uniformBuffer = device.createBuffer({
    size: 160,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const depthTexture = device.createTexture({
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });
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
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  });
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain"
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format }]
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back"
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less"
    }
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: vertexBuffer } },
      { binding: 2, resource: texture.sampler },
      { binding: 3, resource: texture.view }
    ]
  });
  console.log("Pipeline created");
  const aspect = width / height;
  const projMatrix = new Matrix4().perspective(60 * Math.PI / 180, aspect, 0.1, 100);
  const viewMatrix = new Matrix4().lookAt(new Vector3(0, 2, 5), new Vector3(0, 0, 0), new Vector3(0, 1, 0));
  const viewProj = new Matrix4().multiplyMatrices(projMatrix, viewMatrix);
  let time = 0;
  let frameCount = 0;
  function render() {
    time += 0.016;
    frameCount++;
    const modelMatrix = new Matrix4().makeRotationFromEuler(time * 0.5, time * 0.7, time * 0.3);
    const mvp = new Matrix4().multiplyMatrices(viewProj, modelMatrix);
    const uniformData = new Float32Array(40);
    uniformData.set(mvp.elements, 0);
    uniformData.set(modelMatrix.elements, 16);
    uniformData[32] = 1;
    uniformData[33] = 1;
    uniformData[34] = 1;
    uniformData[35] = 1;
    uniformData[36] = 0.5;
    uniformData[37] = 1;
    uniformData[38] = 0.3;
    uniformData[39] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1
      }
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
  console.log("Starting render loop");
  requestAnimationFrame(render);
}
main().catch((err) => {
  console.error("Error:", err);
});
