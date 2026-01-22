import { Node } from './Node';
import { Geometry } from './Geometry';
import { Vector3 } from '../math/Vector3';

export interface Material {
  color: Vector3;
  roughness?: number;
  metallic?: number;
}

export class Mesh extends Node {
  public geometry: Geometry;
  public material: Material;

  constructor(geometry: Geometry, material?: Material) {
    super('Mesh');
    this.geometry = geometry;
    this.material = material || { color: new Vector3(1, 1, 1) };
  }
}
