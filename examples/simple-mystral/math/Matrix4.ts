import { Vector3 } from './Vector3';

export class Matrix4 {
  public elements: Float32Array;

  constructor(elements?: number[]) {
    this.elements = new Float32Array(elements || [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  static get identity(): Matrix4 {
    return new Matrix4();
  }

  static zero(): Matrix4 {
    return new Matrix4([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    ]);
  }

  copy(m: Matrix4): Matrix4 {
    this.elements.set(m.elements);
    return this;
  }

  clone(): Matrix4 {
    return new Matrix4(Array.from(this.elements));
  }

  multiply(m: Matrix4): Matrix4 {
    return this.multiplyMatrices(this, m);
  }

  multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
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

  transpose(): Matrix4 {
    const te = this.elements;
    let tmp;

    tmp = te[1]; te[1] = te[4]; te[4] = tmp;
    tmp = te[2]; te[2] = te[8]; te[8] = tmp;
    tmp = te[3]; te[3] = te[12]; te[12] = tmp;
    tmp = te[6]; te[6] = te[9]; te[9] = tmp;
    tmp = te[7]; te[7] = te[13]; te[13] = tmp;
    tmp = te[11]; te[11] = te[14]; te[14] = tmp;

    return this;
  }

  determinant(): number {
    const te = this.elements;

    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];

    // Calculate determinant using cofactor expansion
    return (
      n41 * (
        + n14 * n23 * n32
        - n13 * n24 * n32
        - n14 * n22 * n33
        + n12 * n24 * n33
        + n13 * n22 * n34
        - n12 * n23 * n34
      ) +
      n42 * (
        + n11 * n23 * n34
        - n11 * n24 * n33
        + n14 * n21 * n33
        - n13 * n21 * n34
        + n13 * n24 * n31
        - n14 * n23 * n31
      ) +
      n43 * (
        + n11 * n24 * n32
        - n11 * n22 * n34
        - n14 * n21 * n32
        + n12 * n21 * n34
        + n14 * n22 * n31
        - n12 * n24 * n31
      ) +
      n44 * (
        - n13 * n22 * n31
        - n11 * n23 * n32
        + n11 * n22 * n33
        + n13 * n21 * n32
        - n12 * n21 * n33
        + n12 * n23 * n31
      )
    );
  }

  inverse(): Matrix4 {
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

    if (Math.abs(det) < 1e-10) {
        console.warn('Matrix4.inverse(): Can not invert matrix, determinant is too small:', det);
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

  invert(): Matrix4 {
      return this.inverse();
  }

  identity(): Matrix4 {
    this.elements.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
    return this;
  }

  makeTranslation(v: Vector3): Matrix4 {
    this.elements.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      v.x, v.y, v.z, 1
    ]);
    return this;
  }

  makeRotationFromAxisAngle(axis: Vector3, angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z;
    const tx = t * x, ty = t * y;

    this.elements.set([
      tx * x + c, tx * y - s * z, tx * z + s * y, 0,
      tx * y + s * z, ty * y + c, ty * z - s * x, 0,
      tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
      0, 0, 0, 1
    ]);

    return this;
  }

  makeRotationX(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    this.elements.set([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    ]);

    return this;
  }

  makeRotationY(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    this.elements.set([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);

    return this;
  }

  makeRotationZ(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    this.elements.set([
      c, -s, 0, 0,
      s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    return this;
  }

  makeRotationFromEuler(x: number, y: number, z: number): Matrix4 {
    // ZYX order rotation (yaw-pitch-roll)
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);

    this.elements.set([
      cy * cz,                      cy * sz,                      -sy,    0,
      sx * sy * cz - cx * sz,       sx * sy * sz + cx * cz,       sx * cy, 0,
      cx * sy * cz + sx * sz,       cx * sy * sz - sx * cz,       cx * cy, 0,
      0,                            0,                            0,      1
    ]);

    return this;
  }

  makeScale(v: Vector3): Matrix4 {
    this.elements.set([
      v.x, 0, 0, 0,
      0, v.y, 0, 0,
      0, 0, v.z, 0,
      0, 0, 0, 1
    ]);
    return this;
  }

  makePerspective(fov: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1.0 / Math.tan(fov / 2);

    this.elements.set([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, far / (near - far), -1,
      0, 0, far * near / (near - far), 0
    ]);

    return this;
  }

  // Alias for makePerspective
  perspective(fov: number, aspect: number, near: number, far: number): Matrix4 {
    return this.makePerspective(fov, aspect, near, far);
  }

  makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): Matrix4 {
    const te = this.elements;
    const w = 1.0 / (right - left);
    const h = 1.0 / (top - bottom);
    const p = 1.0 / (far - near);

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

  lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const ze = eye.subtract(target).normalize();
    
    let xe = up.cross(ze);
    if (xe.magnitudeSquared() < 1e-6) {
      // Up is parallel to forward, use a different up vector
      if (Math.abs(up.z) < 0.999) {
        xe = new Vector3(0, 0, 1).cross(ze);
      } else {
        xe = new Vector3(1, 0, 0).cross(ze);
      }
    }
    xe = xe.normalize();
    
    const ye = ze.cross(xe);

    const te = this.elements;

    te[0] = xe.x; te[4] = xe.y; te[8] = xe.z; te[12] = -xe.dot(eye);
    te[1] = ye.x; te[5] = ye.y; te[9] = ye.z; te[13] = -ye.dot(eye);
    te[2] = ze.x; te[6] = ze.y; te[10] = ze.z; te[14] = -ze.dot(eye);
    te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;

    return this;
  }

  decompose(): { position: Vector3; rotation: Matrix4; scale: Vector3 } {
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

  compose(position: Vector3, rotation: Matrix4, scale: Vector3): Matrix4 {
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

  equals(m: Matrix4, epsilon: number = 1e-6): boolean {
    const te = this.elements;
    const me = m.elements;

    for (let i = 0; i < 16; i++) {
      if (Math.abs(te[i] - me[i]) > epsilon) {
        return false;
      }
    }
    return true;
  }

  toString(): string {
    const te = this.elements;
    return `Matrix4(\n  ${te[0].toFixed(3)}, ${te[4].toFixed(3)}, ${te[8].toFixed(3)}, ${te[12].toFixed(3)},\n  ${te[1].toFixed(3)}, ${te[5].toFixed(3)}, ${te[9].toFixed(3)}, ${te[13].toFixed(3)},\n  ${te[2].toFixed(3)}, ${te[6].toFixed(3)}, ${te[10].toFixed(3)}, ${te[14].toFixed(3)},\n  ${te[3].toFixed(3)}, ${te[7].toFixed(3)}, ${te[11].toFixed(3)}, ${te[15].toFixed(3)}\n)`;
  }

  transformVector(v: Vector3): Vector3 {
  const te = this.elements;
  const x = v.x, y = v.y, z = v.z;
  
  return new Vector3(
    te[0] * x + te[4] * y + te[8] * z + te[12],
    te[1] * x + te[5] * y + te[9] * z + te[13],
    te[2] * x + te[6] * y + te[10] * z + te[14]
  );
}

transformDirection(v: Vector3): Vector3 {
  const te = this.elements;
  const x = v.x, y = v.y, z = v.z;
  
  return new Vector3(
    te[0] * x + te[4] * y + te[8] * z,
    te[1] * x + te[5] * y + te[9] * z,
    te[2] * x + te[6] * y + te[10] * z
  );
}

toArray(): Float32Array {
    return this.elements.slice();
  }
}