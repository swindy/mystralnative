import { Node } from './Node';
import { Vector3 } from '../math/Vector3';

export interface Light {
  type: 'directional' | 'point' | 'ambient';
  color: Vector3;
  intensity: number;
  position?: Vector3;
  direction?: Vector3;
}

export class Scene extends Node {
  public backgroundColor: { r: number; g: number; b: number; a: number } = {
    r: 0.1,
    g: 0.1,
    b: 0.15,
    a: 1.0,
  };
  public lights: Light[] = [];

  constructor(name: string = 'Scene') {
    super(name);
  }

  addLight(light: Light) {
    this.lights.push(light);
  }

  removeLight(light: Light) {
    const index = this.lights.indexOf(light);
    if (index !== -1) {
      this.lights.splice(index, 1);
    }
  }
}
