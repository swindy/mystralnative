/**
 * Simple safe wrapper for createShaderModule (no ErrorOverlay dependency)
 */
function createShaderModuleSafe(device: GPUDevice, descriptor: GPUShaderModuleDescriptor): GPUShaderModule {
    return device.createShaderModule(descriptor);
}

export interface TextureOptions {
  /** Use sRGB color space (for color/albedo textures). Default: false */
  srgb?: boolean;
  /** Premultiply alpha. Default: false */
  premultiplyAlpha?: boolean;
}

export class Texture {
  public gpuTexture: GPUTexture | null = null;
  public view: GPUTextureView | null = null;
  public sampler: GPUSampler | null = null;
  public label: string;
  public srgb: boolean = false;
  public premultiplyAlpha: boolean = false;

  constructor(label = 'Texture', options?: TextureOptions) {
    this.label = label;
    if (options) {
      this.srgb = options.srgb ?? false;
      this.premultiplyAlpha = options.premultiplyAlpha ?? false;
    }
  }

  async load(device: GPUDevice, url: string) {
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

  /**
   * Create a Texture wrapper from an existing GPUTexture
   */
  static fromGPUTexture(device: GPUDevice, gpuTexture: GPUTexture, label = 'GPU Texture'): Texture {
    const texture = new Texture(label);
    texture.gpuTexture = gpuTexture;
    texture.view = gpuTexture.createView();
    texture.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });
    return texture;
  }

  createFromImageBitmap(device: GPUDevice, imgBitmap: ImageBitmap) {
      const mipLevelCount = Math.floor(Math.log2(Math.max(imgBitmap.width, imgBitmap.height))) + 1;

      // Use sRGB format for color textures (proper gamma handling)
      const format: GPUTextureFormat = this.srgb ? 'rgba8unorm-srgb' : 'rgba8unorm';

      this.gpuTexture = device.createTexture({
        label: this.label,
        size: [imgBitmap.width, imgBitmap.height, 1],
        format: format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
        mipLevelCount: mipLevelCount,
      });

      device.queue.copyExternalImageToTexture(
        { source: imgBitmap, flipY: false },
        { texture: this.gpuTexture, premultipliedAlpha: this.premultiplyAlpha },
        [imgBitmap.width, imgBitmap.height]
      );

      if (mipLevelCount > 1) {
          Texture.generateMipmaps(device, this.gpuTexture, mipLevelCount);
      }

      this.view = this.gpuTexture.createView();

      this.sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        maxAnisotropy: 4,
      });
  }

  // Mipmap Generator using render passes
  static generateMipmaps(device: GPUDevice, texture: GPUTexture, mipLevelCount: number) {
      const pipeline = Texture.getMipmapPipeline(device, texture.format);

      const commandEncoder = device.createCommandEncoder({ label: 'Mipmap Gen' });

      let width = texture.width;
      let height = texture.height;

      for (let i = 1; i < mipLevelCount; i++) {
          const dstWidth = Math.max(1, Math.floor(width / 2));
          const dstHeight = Math.max(1, Math.floor(height / 2));

          const bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                  { binding: 0, resource: device.createSampler({ minFilter: 'linear' }) },
                  { binding: 1, resource: texture.createView({ baseMipLevel: i - 1, mipLevelCount: 1 }) }
              ]
          });

          const pass = commandEncoder.beginRenderPass({
              colorAttachments: [{
                  view: texture.createView({ baseMipLevel: i, mipLevelCount: 1 }),
                  loadOp: 'clear',
                  storeOp: 'store'
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

  private static mipmapPipelineCache = new Map<string, GPURenderPipeline>();

  static getMipmapPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
      if (this.mipmapPipelineCache.has(format)) {
          return this.mipmapPipelineCache.get(format)!;
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
          layout: 'auto',
          vertex: {
              module: module,
              entryPoint: 'vs_main'
          },
          fragment: {
              module: module,
              entryPoint: 'fs_main',
              targets: [{ format: format }]
          },
          primitive: { topology: 'triangle-list' }
      });

      this.mipmapPipelineCache.set(format, pipeline);
      return pipeline;
  }

  private static _defaultTextures = new Map<GPUDevice, Texture>();

  static getDefault(device: GPUDevice): Texture {
    if (!Texture._defaultTextures.has(device)) {
      const texture = new Texture('Default White Texture');
      texture.gpuTexture = device.createTexture({
        label: 'Default White Texture',
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // White pixel
      const data = new Uint8Array([255, 255, 255, 255]);
      device.queue.writeTexture(
        { texture: texture.gpuTexture },
        data,
        { bytesPerRow: 4, rowsPerImage: 1 },
        [1, 1, 1]
      );

      texture.view = texture.gpuTexture.createView();
      texture.sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

      Texture._defaultTextures.set(device, texture);
    }
    return Texture._defaultTextures.get(device)!;
  }
}
