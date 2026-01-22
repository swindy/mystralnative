import { Vector3 } from './Vector3';
import { Matrix4 } from './Matrix4';

export class Quaternion {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  static get identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  copy(q: Quaternion): Quaternion {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  /**
   * Multiplies this quaternion by q (this = this * q).
   * MODIFIES this quaternion in place (matches THREE.js behavior).
   */
  multiply(q: Quaternion): Quaternion {
    return this.multiplyQuaternions(this.clone(), q);
  }

  multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
    const qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
    const qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;

    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    return this;
  }

  /**
   * Spherically interpolates this quaternion towards qb by t.
   * MODIFIES this quaternion in place (matches THREE.js behavior).
   */
  slerp(qb: Quaternion, t: number): Quaternion {
    if (t === 0) return this;
    if (t === 1) {
      this.x = qb.x;
      this.y = qb.y;
      this.z = qb.z;
      this.w = qb.w;
      return this;
    }

    const x = this.x, y = this.y, z = this.z, w = this.w;

    let cosHalfTheta = w * qb.w + x * qb.x + y * qb.y + z * qb.z;

    let qbw = qb.w, qbx = qb.x, qby = qb.y, qbz = qb.z;

    if (cosHalfTheta < 0) {
      qbw = -qb.w;
      qbx = -qb.x;
      qby = -qb.y;
      qbz = -qb.z;
      cosHalfTheta = -cosHalfTheta;
    }

    if (cosHalfTheta >= 1.0) {
      return this; // Already at target
    }

    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    this.x = x * ratioA + qbx * ratioB;
    this.y = y * ratioA + qby * ratioB;
    this.z = z * ratioA + qbz * ratioB;
    this.w = w * ratioA + qbw * ratioB;

    return this;
  }

  lerp(qb: Quaternion, t: number): Quaternion {
    return new Quaternion(
      this.x + (qb.x - this.x) * t,
      this.y + (qb.y - this.y) * t,
      this.z + (qb.z - this.z) * t,
      this.w + (qb.w - this.w) * t
    );
  }

  equals(q: Quaternion, epsilon: number = 1e-6): boolean {
    // Quaternions q and -q represent the same rotation
    const directMatch = Math.abs(this.x - q.x) < epsilon &&
                       Math.abs(this.y - q.y) < epsilon &&
                       Math.abs(this.z - q.z) < epsilon &&
                       Math.abs(this.w - q.w) < epsilon;
    
    const inverseMatch = Math.abs(this.x + q.x) < epsilon &&
                        Math.abs(this.y + q.y) < epsilon &&
                        Math.abs(this.z + q.z) < epsilon &&
                        Math.abs(this.w + q.w) < epsilon;
    
    return directMatch || inverseMatch;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  normalize(): Quaternion {
    let length = this.length();

    if (length === 0) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      length = 1 / length;
      this.x *= length;
      this.y *= length;
      this.z *= length;
      this.w *= length;
    }
    return this;
  }

  inverse(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w).normalize();
  }

  conjugate(): Quaternion {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    // w remains unchanged
    return this;
  }

  dot(v: Quaternion): number {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }

  setFromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const normAxis = axis.normalize();
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);

    this.x = normAxis.x * s;
    this.y = normAxis.y * s;
    this.z = normAxis.z * s;
    this.w = Math.cos(halfAngle);
    return this;
  }

  /**
   * Sets this quaternion from Euler angles (in radians).
   * Matches THREE.js Quaternion.setFromEuler behavior.
   * Can be called as setFromEuler({x,y,z}, order) or setFromEuler(x, y, z, order)
   */
  setFromEuler(xOrEuler: number | { x: number; y: number; z: number }, yOrOrder?: number | string, z?: number, order?: string): Quaternion {
    let x: number, y: number, zVal: number, eulerOrder: string;

    if (typeof xOrEuler === 'object') {
      // Called as setFromEuler({x,y,z}, order)
      x = xOrEuler.x;
      y = xOrEuler.y;
      zVal = xOrEuler.z;
      eulerOrder = (yOrOrder as string) ?? 'XYZ';
    } else {
      // Called as setFromEuler(x, y, z, order)
      x = xOrEuler;
      y = yOrOrder as number;
      zVal = z as number;
      eulerOrder = order ?? 'XYZ';
    }

    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(zVal / 2);

    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(zVal / 2);

    switch (eulerOrder) {
      case 'XYZ':
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'YXZ':
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case 'ZXY':
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'ZYX':
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case 'YZX':
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'XZY':
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        throw new Error(`Euler order ${eulerOrder} not supported`);
    }

    return this;
  }

  static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const normAxis = axis.normalize();
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);

    return new Quaternion(
      normAxis.x * s,
      normAxis.y * s,
      normAxis.z * s,
      Math.cos(halfAngle)
    );
  }

  static fromEuler(euler: Vector3, order: string = 'XYZ'): Quaternion {
    const x = euler.x;
    const y = euler.y;
    const z = euler.z;

    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);

    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    let qx, qy, qz, qw;

    switch (order) {
      case 'XYZ':
        qx = s1 * c2 * c3 + c1 * s2 * s3;
        qy = c1 * s2 * c3 - s1 * c2 * s3;
        qz = c1 * c2 * s3 + s1 * s2 * c3;
        qw = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'YXZ':
        qx = s1 * c2 * c3 + c1 * s2 * s3;
        qy = c1 * s2 * c3 - s1 * c2 * s3;
        qz = c1 * c2 * s3 - s1 * s2 * c3;
        qw = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case 'ZXY':
        qx = s1 * c2 * c3 - c1 * s2 * s3;
        qy = c1 * s2 * c3 + s1 * c2 * s3;
        qz = c1 * c2 * s3 + s1 * s2 * c3;
        qw = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'ZYX':
        qx = s1 * c2 * c3 - c1 * s2 * s3;
        qy = c1 * s2 * c3 + s1 * c2 * s3;
        qz = c1 * c2 * s3 - s1 * s2 * c3;
        qw = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case 'YZX':
        qx = s1 * c2 * c3 + c1 * s2 * s3;
        qy = c1 * s2 * c3 + s1 * c2 * s3;
        qz = c1 * c2 * s3 - s1 * s2 * c3;
        qw = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case 'XZY':
        qx = s1 * c2 * c3 - c1 * s2 * s3;
        qy = c1 * s2 * c3 - s1 * c2 * s3;
        qz = c1 * c2 * s3 + s1 * s2 * c3;
        qw = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        throw new Error(`Euler order ${order} not supported`);
    }

    return new Quaternion(qx, qy, qz, qw);
  }

  static fromRotationMatrix(m: Matrix4): Quaternion {
    const te = m.elements;

    // Matrix is stored in column-major order
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];

    const trace = m11 + m22 + m33;

    let q: Quaternion;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      q = new Quaternion(
        (m32 - m23) * s,
        (m13 - m31) * s,
        (m21 - m12) * s,
        0.25 / s
      );
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      q = new Quaternion(
        0.25 * s,
        (m12 + m21) / s,
        (m13 + m31) / s,
        (m32 - m23) / s
      );
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      q = new Quaternion(
        (m12 + m21) / s,
        0.25 * s,
        (m23 + m32) / s,
        (m13 - m31) / s
      );
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      q = new Quaternion(
        (m13 + m31) / s,
        (m23 + m32) / s,
        0.25 * s,
        (m21 - m12) / s
      );
    }

    return q.normalize();
  }

  toMatrix4(): Matrix4 {
    const te = new Matrix4().elements;

    const x = this.x, y = this.y, z = this.z, w = this.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    te[0] = 1 - (yy + zz);
    te[4] = xy - wz;
    te[8] = xz + wy;
    te[12] = 0;

    te[1] = xy + wz;
    te[5] = 1 - (xx + zz);
    te[9] = yz - wx;
    te[13] = 0;

    te[2] = xz - wy;
    te[6] = yz + wx;
    te[10] = 1 - (xx + yy);
    te[14] = 0;

    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;

    return new Matrix4(Array.from(te));
  }

  angleTo(q: Quaternion): number {
    return 2 * Math.acos(Math.abs(Math.max(-1, Math.min(1, this.dot(q)))));
  }

  /**
   * Rotates this quaternion towards q by at most step radians.
   * MODIFIES this quaternion in place (matches THREE.js behavior).
   */
  rotateTowards(q: Quaternion, step: number): Quaternion {
    const angle = this.angleTo(q);

    if (angle === 0) return this;

    const t = Math.min(1, step / angle);

    return this.slerp(q, t);
  }

  invert(): Quaternion {
    return this.conjugate().normalize();
  }

  toString(): string {
    return `Quaternion(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)}, ${this.w.toFixed(3)})`;
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  static fromArray(array: [number, number, number, number]): Quaternion {
    return new Quaternion(array[0], array[1], array[2], array[3]);
  }

  /**
   * Converts the quaternion to Euler angles (in radians).
   * Returns a Vector3 with x=pitch, y=yaw, z=roll in XYZ order.
   */
  toEuler(order: string = 'YXZ'): Vector3 {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const x2 = x * x, y2 = y * y, z2 = z * z, w2 = w * w;

    let ex: number, ey: number, ez: number;

    switch (order) {
      case 'XYZ': {
        const sinp = 2 * (w * x - y * z);
        if (Math.abs(sinp) >= 1) {
          ex = Math.sign(sinp) * Math.PI / 2;
        } else {
          ex = Math.asin(sinp);
        }
        ey = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x2 + y2));
        ez = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x2 + z2));
        break;
      }
      case 'YXZ': {
        const sinp = 2 * (w * x - y * z);
        if (Math.abs(sinp) >= 1) {
          ex = Math.sign(sinp) * Math.PI / 2;
        } else {
          ex = Math.asin(sinp);
        }
        ey = Math.atan2(2 * (w * y + x * z), w2 - x2 - y2 + z2);
        ez = Math.atan2(2 * (w * z + x * y), w2 - x2 + y2 - z2);
        break;
      }
      default: {
        // Default to YXZ for typical camera use
        const sinp = 2 * (w * x - y * z);
        if (Math.abs(sinp) >= 1) {
          ex = Math.sign(sinp) * Math.PI / 2;
        } else {
          ex = Math.asin(sinp);
        }
        ey = Math.atan2(2 * (w * y + x * z), w2 - x2 - y2 + z2);
        ez = Math.atan2(2 * (w * z + x * y), w2 - x2 + y2 - z2);
        break;
      }
    }

    return new Vector3(ex, ey, ez);
  }

  /**
   * Converts the quaternion to Euler angles in degrees.
   * Returns a Vector3 with x=pitch, y=yaw, z=roll.
   */
  toEulerDegrees(order: string = 'YXZ'): Vector3 {
    const euler = this.toEuler(order);
    const rad2deg = 180 / Math.PI;
    return new Vector3(euler.x * rad2deg, euler.y * rad2deg, euler.z * rad2deg);
  }
}