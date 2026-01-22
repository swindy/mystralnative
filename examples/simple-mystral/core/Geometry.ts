import { Vector3 } from '../math/Vector3';

export interface AABB {
  min: Vector3;
  max: Vector3;
}

export class Geometry {
  // CPU-side attribute data
  public positions: Float32Array = new Float32Array(0);
  public normals: Float32Array = new Float32Array(0);
  public uvs: Float32Array = new Float32Array(0);
  public colors: Float32Array = new Float32Array(0);

  // For vertex pulling, we need expanded (non-indexed) vertex data
  public vertexCount: number = 0;

  // Bounding box
  public bounds: AABB = {
    min: new Vector3(Infinity, Infinity, Infinity),
    max: new Vector3(-Infinity, -Infinity, -Infinity),
  };

  constructor() {}

  /**
   * Set positions (already expanded, not indexed)
   */
  setPositions(data: Float32Array) {
    this.positions = data;
    this.vertexCount = data.length / 3;
    this.computeBounds();
  }

  /**
   * Set normals (already expanded, not indexed)
   */
  setNormals(data: Float32Array) {
    this.normals = data;
  }

  /**
   * Set UVs (already expanded, not indexed)
   */
  setUVs(data: Float32Array) {
    this.uvs = data;
  }

  /**
   * Set vertex colors (already expanded, not indexed)
   */
  setColors(data: Float32Array) {
    this.colors = data;
  }

  /**
   * Compute bounding box from positions
   */
  computeBounds() {
    this.bounds.min.set(Infinity, Infinity, Infinity);
    this.bounds.max.set(-Infinity, -Infinity, -Infinity);

    for (let i = 0; i < this.positions.length; i += 3) {
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

  /**
   * Get vertex data packed for storage buffer.
   * Layout: position(16) + normal(16) + uv(8) + padding(8) + color(16) = 64 bytes per vertex
   * All vec3f are padded to 16 bytes for proper WGSL alignment.
   */
  getPackedVertexData(): Float32Array {
    const floatsPerVertex = 16; // 4 vec4f (64 bytes)
    const data = new Float32Array(this.vertexCount * floatsPerVertex);

    for (let i = 0; i < this.vertexCount; i++) {
      const srcIdx3 = i * 3;
      const srcIdx2 = i * 2;
      const dstIdx = i * floatsPerVertex;

      // Position (vec3f + padding)
      data[dstIdx + 0] = this.positions[srcIdx3 + 0];
      data[dstIdx + 1] = this.positions[srcIdx3 + 1];
      data[dstIdx + 2] = this.positions[srcIdx3 + 2];
      data[dstIdx + 3] = 0; // padding

      // Normal (vec3f + padding)
      if (this.normals.length > 0) {
        data[dstIdx + 4] = this.normals[srcIdx3 + 0];
        data[dstIdx + 5] = this.normals[srcIdx3 + 1];
        data[dstIdx + 6] = this.normals[srcIdx3 + 2];
      }
      data[dstIdx + 7] = 0; // padding

      // UV (vec2f + padding to 16 bytes)
      if (this.uvs.length > 0) {
        data[dstIdx + 8] = this.uvs[srcIdx2 + 0];
        data[dstIdx + 9] = this.uvs[srcIdx2 + 1];
      } else {
        data[dstIdx + 8] = 0;
        data[dstIdx + 9] = 0;
      }
      data[dstIdx + 10] = 0; // padding
      data[dstIdx + 11] = 0; // padding

      // Color (vec3f + padding)
      if (this.colors.length > 0) {
        data[dstIdx + 12] = this.colors[srcIdx3 + 0];
        data[dstIdx + 13] = this.colors[srcIdx3 + 1];
        data[dstIdx + 14] = this.colors[srcIdx3 + 2];
      } else {
        // Default white
        data[dstIdx + 12] = 1;
        data[dstIdx + 13] = 1;
        data[dstIdx + 14] = 1;
      }
      data[dstIdx + 15] = 0; // padding
    }

    return data;
  }
}
