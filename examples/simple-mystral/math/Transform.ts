import { Vector3 } from './Vector3';
import { Quaternion } from './Quaternion';
import { Matrix4 } from './Matrix4';

export class Transform {
  private _position: Vector3;
  private _rotation: Quaternion;
  private _scale: Vector3;
  
  private _matrix: Matrix4;
  private _matrixDirty: boolean = true;
  private _parent: Transform | null = null;
  private _children: Transform[] = [];
  private _worldMatrix: Matrix4;
  private _worldMatrixDirty: boolean = true;

  constructor(
    position: Vector3 = Vector3.zero,
    rotation: Quaternion = Quaternion.identity,
    scale: Vector3 = Vector3.one
  ) {
    this._position = position.clone();
    this._rotation = rotation.clone();
    this._scale = scale.clone();
    this._matrix = Matrix4.identity;
    this._worldMatrix = Matrix4.identity;
  }

  get position(): Vector3 {
    return this._position;
  }

  set position(value: Vector3) {
    if (!this._position.equals(value)) {
      this._position = value.clone();
      this._markDirty();
    }
  }

  get rotation(): Quaternion {
    return this._rotation;
  }

  set rotation(value: Quaternion) {
    if (!this._rotation.equals(value)) {
      this._rotation = value.clone();
      this._markDirty();
    }
  }

  get scale(): Vector3 {
    return this._scale;
  }

  set scale(value: Vector3) {
    if (!this._scale.equals(value)) {
      this._scale = value.clone();
      this._markDirty();
    }
  }

  get matrix(): Matrix4 {
    if (this._matrixDirty) {
      this._matrix = new Matrix4().compose(this._position, this._rotation.toMatrix4(), this._scale);
      this._matrixDirty = false;
    }
    return this._matrix;
  }

  get worldMatrix(): Matrix4 {
    if (this._worldMatrixDirty) {
      if (this._parent) {
        this._worldMatrix = new Matrix4().multiplyMatrices(this._parent.worldMatrix, this.matrix);
      } else {
        this._worldMatrix = this.matrix.clone();
      }
      this._worldMatrixDirty = false;
    }
    return this._worldMatrix;
  }

  get parent(): Transform | null {
    return this._parent;
  }

  get children(): Transform[] {
    return this._children.slice();
  }

  set parent(parent: Transform | null) {
    if (this._parent === parent) return;

    if (this._parent) {
      const index = this._parent._children.indexOf(this);
      if (index !== -1) {
        this._parent._children.splice(index, 1);
      }
    }

    this._parent = parent;

    if (this._parent) {
      this._parent._children.push(this);
    }

    this._markWorldMatrixDirty();
  }

  addChild(child: Transform): void {
    child.parent = this;
  }

  removeChild(child: Transform): void {
    if (child.parent === this) {
      child.parent = null;
    }
  }

  translate(translation: Vector3, space: 'local' | 'world' = 'local'): void {
    if (space === 'local') {
      const rotationMatrix = this.rotation.toMatrix4();
      this.position = this.position.add(rotationMatrix.transformDirection(translation));
    } else {
      this.position = this.position.add(translation);
    }
  }

  rotate(axis: Vector3, angle: number, space: 'local' | 'world' = 'local'): void {
    if (space === 'local') {
      const rotation = Quaternion.fromAxisAngle(axis.normalize(), angle);
      this.rotation = this.rotation.multiply(rotation).normalize();
    } else {
      // For world space rotation, apply rotation in world space
      const worldRotation = Quaternion.fromAxisAngle(axis.normalize(), angle);
      
      // Get current world rotation and apply world rotation
      const currentWorldRotation = this.getWorldRotation();
      const newWorldRotation = worldRotation.multiply(currentWorldRotation).normalize();
      this.setWorldRotation(newWorldRotation);
    }
  }

  lookAt(target: Vector3, up: Vector3 = Vector3.up): void {
    // Matrix4.lookAt returns a View Matrix (World -> Camera)
    // We want the World Matrix rotation (Camera -> World)
    // The inverse of a rotation matrix is its transpose.
    const matrix = Matrix4.identity.lookAt(this.position, target, up);
    const { rotation } = matrix.decompose();
    
    // Since decompose() returns the rotation part of the matrix, and the matrix is a View Matrix,
    // 'rotation' is the View Rotation (R_view).
    // The World Rotation (R_world) is the inverse of R_view.
    // Since rotation matrices are orthogonal, Inverse = Transpose.
    // Quaternion.fromRotationMatrix handles the conversion.
    // We need to invert the resulting quaternion to get the World Rotation.
    
    this.rotation = Quaternion.fromRotationMatrix(rotation).invert();
    this._markDirty();
  }

  setWorldPosition(position: Vector3): void {
    if (this._parent) {
      const parentWorldMatrixInverse = this._parent.worldMatrix.clone().inverse();
      this.position = parentWorldMatrixInverse.transformVector(position);
    } else {
      this.position = position.clone();
    }
  }

  setWorldRotation(rotation: Quaternion): void {
    if (this._parent) {
      const parentRotation = this._parent.worldMatrix.decompose().rotation;
      const parentQuaternion = Quaternion.fromRotationMatrix(parentRotation);
      this.rotation = parentQuaternion.invert().multiply(rotation).normalize();
    } else {
      this.rotation = rotation.clone();
    }
    this._markDirty();
  }

  setWorldScale(scale: Vector3): void {
    if (this._parent) {
      const parentScale = this._parent.worldMatrix.decompose().scale;
      this.scale = new Vector3(
        scale.x / parentScale.x,
        scale.y / parentScale.y,
        scale.z / parentScale.z
      );
    } else {
      this.scale = scale.clone();
    }
    this._markDirty();
  }

  getWorldPosition(): Vector3 {
    const { position } = this.worldMatrix.decompose();
    return position;
  }

  getWorldRotation(): Quaternion {
    const { rotation } = this.worldMatrix.decompose();
    return Quaternion.fromRotationMatrix(rotation);
  }

  getWorldScale(): Vector3 {
    const { scale } = this.worldMatrix.decompose();
    return scale;
  }

  getForwardVector(): Vector3 {
    const rotationMatrix = this.rotation.toMatrix4();
    return rotationMatrix.transformDirection(Vector3.forward).normalize();
  }

  getRightVector(): Vector3 {
    const rotationMatrix = this.rotation.toMatrix4();
    return rotationMatrix.transformDirection(Vector3.right).normalize();
  }

  getUpVector(): Vector3 {
    const rotationMatrix = this.rotation.toMatrix4();
    return rotationMatrix.transformDirection(Vector3.up).normalize();
  }

  transformPoint(point: Vector3): Vector3 {
    return this.worldMatrix.transformVector(point);
  }

  transformDirection(direction: Vector3): Vector3 {
    return this.worldMatrix.transformDirection(direction).normalize();
  }

  inverseTransformPoint(point: Vector3): Vector3 {
    // Manual inverse transformation: world -> local
    // First subtract position, then divide by scale, then apply inverse rotation
    const worldPos = this.getWorldPosition();
    const worldScale = this.getWorldScale();
    const worldRot = this.getWorldRotation();
    
    // Translate to origin
    const translated = point.subtract(worldPos);
    
    // Apply inverse rotation
    const inverseRot = worldRot.invert();
    const rotated = inverseRot.toMatrix4().transformDirection(translated);
    
    // Apply inverse scale
    return new Vector3(
      rotated.x / worldScale.x,
      rotated.y / worldScale.y,
      rotated.z / worldScale.z
    );
  }

  inverseTransformDirection(direction: Vector3): Vector3 {
    const worldMatrixInverse = this.worldMatrix.clone().inverse();
    return worldMatrixInverse.transformDirection(direction).normalize();
  }

  copy(transform: Transform): Transform {
    this.position.copy(transform.position);
    this.rotation.copy(transform.rotation);
    this.scale.copy(transform.scale);
    this._markDirty();
    return this;
  }

  clone(): Transform {
    return new Transform(this.position, this.rotation, this.scale);
  }

  equals(transform: Transform, epsilon: number = 1e-6): boolean {
    return this.position.equals(transform.position, epsilon) &&
           this.rotation.equals(transform.rotation, epsilon) &&
           this.scale.equals(transform.scale, epsilon);
  }

  reset(): void {
    this.position.copy(Vector3.zero);
    this.rotation.copy(Quaternion.identity);
    this.scale.copy(Vector3.one);
    this._markDirty();
  }

  private _markDirty(): void {
    this._matrixDirty = true;
    this._markWorldMatrixDirty();
  }

  private _markWorldMatrixDirty(): void {
    this._worldMatrixDirty = true;
    for (const child of this._children) {
      child._markWorldMatrixDirty();
    }
  }

  toString(): string {
    return `Transform(\n  Position: ${this.position.toString()},\n  Rotation: ${this.rotation.toString()},\n  Scale: ${this.scale.toString()}\n)`;
  }

  toJSON(): object {
    return {
      position: this.position.toArray(),
      rotation: this.rotation.toArray(),
      scale: this.scale.toArray()
    };
  }

  static fromJSON(json: any): Transform {
    return new Transform(
      Vector3.fromArray(json.position),
      Quaternion.fromArray(json.rotation),
      Vector3.fromArray(json.scale)
    );
  }
}