import { Node } from './Node';
import { Matrix4 } from '../math/Matrix4';
import { Vector3 } from '../math/Vector3';

export class Camera extends Node {
  public fov: number;
  public aspect: number;
  public near: number;
  public far: number;

  private _projectionMatrix: Matrix4;
  private _viewMatrix: Matrix4;

  constructor(fov: number = 60, aspect: number = 16 / 9, near: number = 0.1, far: number = 1000) {
    super('Camera');
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this._projectionMatrix = new Matrix4();
    this._viewMatrix = new Matrix4();
    this.updateProjectionMatrix();
  }

  get projectionMatrix(): Matrix4 {
    return this._projectionMatrix;
  }

  get viewMatrix(): Matrix4 {
    this.updateViewMatrix();
    return this._viewMatrix;
  }

  updateProjectionMatrix() {
    const fovRad = (this.fov * Math.PI) / 180;
    const f = 1.0 / Math.tan(fovRad / 2);
    const nf = 1 / (this.near - this.far);

    this._projectionMatrix.elements.fill(0);
    this._projectionMatrix.elements[0] = f / this.aspect;
    this._projectionMatrix.elements[5] = f;
    this._projectionMatrix.elements[10] = (this.far + this.near) * nf;
    this._projectionMatrix.elements[11] = -1;
    this._projectionMatrix.elements[14] = 2 * this.far * this.near * nf;
  }

  updateViewMatrix() {
    // Get world position and rotation from transform
    const worldMatrix = this.transform.worldMatrix;

    // View matrix is inverse of camera's world matrix
    this._viewMatrix.copy(worldMatrix).invert();
  }

  lookAt(target: Vector3) {
    const position = this.transform.getWorldPosition();
    const up = new Vector3(0, 1, 0);

    // Calculate forward direction
    const forward = target.clone().subtract(position).normalize();

    // Calculate right vector
    const right = up.clone().cross(forward).normalize();

    // Recalculate up vector
    const newUp = forward.clone().cross(right);

    // Build rotation matrix and extract quaternion
    const rotMatrix = new Matrix4();
    rotMatrix.elements[0] = right.x;
    rotMatrix.elements[1] = right.y;
    rotMatrix.elements[2] = right.z;
    rotMatrix.elements[4] = newUp.x;
    rotMatrix.elements[5] = newUp.y;
    rotMatrix.elements[6] = newUp.z;
    rotMatrix.elements[8] = -forward.x;
    rotMatrix.elements[9] = -forward.y;
    rotMatrix.elements[10] = -forward.z;
    rotMatrix.elements[15] = 1;

    this.transform.rotation.setFromRotationMatrix(rotMatrix);
  }
}
