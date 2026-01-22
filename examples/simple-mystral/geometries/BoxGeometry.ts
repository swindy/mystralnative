import { Geometry } from '../core/Geometry';

/**
 * BoxGeometry - Creates a unit cube with proper normals and UVs for each face.
 * Vertices are expanded (non-indexed) for vertex pulling.
 */
export class BoxGeometry extends Geometry {
  constructor(width: number = 1, height: number = 1, depth: number = 1) {
    super();

    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    // UV coordinates for each face (same pattern for all faces)
    // Two triangles: [0,0], [1,0], [1,1] and [0,0], [1,1], [0,1]
    const faceUVs = [
      [0, 0], [1, 0], [1, 1],
      [0, 0], [1, 1], [0, 1],
    ];

    // 6 faces * 2 triangles * 3 vertices = 36 vertices
    const faces = [
      // Front face (Z+)
      {
        normal: [0, 0, 1],
        vertices: [
          [-w, -h, d], [w, -h, d], [w, h, d],
          [-w, -h, d], [w, h, d], [-w, h, d],
        ],
      },
      // Back face (Z-)
      {
        normal: [0, 0, -1],
        vertices: [
          [w, -h, -d], [-w, -h, -d], [-w, h, -d],
          [w, -h, -d], [-w, h, -d], [w, h, -d],
        ],
      },
      // Top face (Y+)
      {
        normal: [0, 1, 0],
        vertices: [
          [-w, h, d], [w, h, d], [w, h, -d],
          [-w, h, d], [w, h, -d], [-w, h, -d],
        ],
      },
      // Bottom face (Y-)
      {
        normal: [0, -1, 0],
        vertices: [
          [-w, -h, -d], [w, -h, -d], [w, -h, d],
          [-w, -h, -d], [w, -h, d], [-w, -h, d],
        ],
      },
      // Right face (X+)
      {
        normal: [1, 0, 0],
        vertices: [
          [w, -h, d], [w, -h, -d], [w, h, -d],
          [w, -h, d], [w, h, -d], [w, h, d],
        ],
      },
      // Left face (X-)
      {
        normal: [-1, 0, 0],
        vertices: [
          [-w, -h, -d], [-w, -h, d], [-w, h, d],
          [-w, -h, -d], [-w, h, d], [-w, h, -d],
        ],
      },
    ];

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (const face of faces) {
      for (let i = 0; i < face.vertices.length; i++) {
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
