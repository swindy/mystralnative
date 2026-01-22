import { Matrix4 } from './Matrix4';

export class Vector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  static get zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static get one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  static get up(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  static get down(): Vector3 {
    return new Vector3(0, -1, 0);
  }

  static get right(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  static get left(): Vector3 {
    return new Vector3(-1, 0, 0);
  }

  static get forward(): Vector3 {
    return new Vector3(0, 0, -1);
  }

  static get back(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  static min(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
  }

  static max(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
  }

  min(v: Vector3): Vector3 {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }

  max(v: Vector3): Vector3 {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  multiplyScalar(scalar: number): Vector3 {
    return this.multiply(scalar);
  }

  divide(scalar: number): Vector3 {
    if (scalar === 0) {
      throw new Error('Cannot divide by zero');
    }
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    const mag = this.magnitude();
    if (mag === 0) {
      return Vector3.zero;
    }
    return this.divide(mag);
  }

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  distanceTo(v: Vector3): number {
    return this.subtract(v).magnitude();
  }

  distanceToSquared(v: Vector3): number {
    return this.subtract(v).magnitudeSquared();
  }

  clampMagnitude(maxMagnitude: number): Vector3 {
    const mag = this.magnitude();
    if (mag > maxMagnitude) {
      return this.normalize().multiply(maxMagnitude);
    }
    return this.clone();
  }

  lerp(v: Vector3, t: number): Vector3 {
    return this.add(v.subtract(this).multiply(t));
  }

  slerp(v: Vector3, t: number): Vector3 {
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

  reflect(normal: Vector3): Vector3 {
    return this.subtract(normal.multiply(2 * this.dot(normal)));
  }

  projectOn(v: Vector3): Vector3 {
    const vMagSq = v.magnitudeSquared();
    if (vMagSq === 0) {
      return Vector3.zero;
    }
    return v.multiply(this.dot(v) / vMagSq);
  }

  angleTo(v: Vector3): number {
    const dotProduct = this.dot(v);
    const magProduct = this.magnitude() * v.magnitude();
    if (magProduct === 0) {
      return 0;
    }
    return Math.acos(Math.max(-1, Math.min(1, dotProduct / magProduct)));
  }

  equals(v: Vector3, epsilon: number = 1e-6): boolean {
    return Math.abs(this.x - v.x) < epsilon &&
           Math.abs(this.y - v.y) < epsilon &&
           Math.abs(this.z - v.z) < epsilon;
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v: Vector3): Vector3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  set(x: number, y: number, z: number): Vector3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  toString(): string {
    return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  static fromArray(array: [number, number, number]): Vector3 {
    return new Vector3(array[0], array[1], array[2]);
  }

  applyMatrix4(m: Matrix4): Vector3 {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;

    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;

    return this;
  }
}