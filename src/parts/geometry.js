import * as THREE from 'three';

/**
 * 沿 Z 轴的放样（loft）。每个截面是超椭圆，n>2 时带硬朗的科幻倒角。
 * sections: [{ z, rx, ry, n?, cy? }]，按 z 从小到大排列。
 */
export function loft(sections, opts = {}) {
  const rs = opts.radialSegments ?? 40;
  const ts = opts.thetaStart ?? 0;
  const tl = opts.thetaLength ?? Math.PI * 2;
  const closed = Math.abs(tl - Math.PI * 2) < 1e-5;
  const cols = closed ? rs : rs + 1;
  const segs = rs;
  const zmin = sections[0].z, zmax = sections[sections.length - 1].z;
  const pos = [], uv = [], idx = [];

  for (const s of sections) {
    const n = s.n ?? 2.35;
    for (let i = 0; i < cols; i++) {
      const t = ts + tl * (i / rs);
      const ct = Math.cos(t), st = Math.sin(t);
      const px = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n) * s.rx;
      const py = Math.sign(st) * Math.pow(Math.abs(st), 2 / n) * s.ry;
      pos.push(px, py + (s.cy || 0), s.z);
      uv.push((i / rs) * (opts.uScale ?? 1), ((s.z - zmin) / (zmax - zmin || 1)) * (opts.vScale ?? 1));
    }
  }
  for (let j = 0; j < sections.length - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const i2 = closed ? (i + 1) % cols : i + 1;
      const a = j * cols + i, b = j * cols + i2;
      const c = (j + 1) * cols + i, d = (j + 1) * cols + i2;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 贴合放样曲面的带厚度装甲壳（取一段圆周角）。
 * scale = 外表面相对船体的倍率，thickness = 壳厚（相对半径）。
 */
export function shell(sections, thetaStart, thetaLength, scale = 1.025, thickness = 0.035, opts = {}) {
  const rs = opts.radialSegments ?? 20;
  const cols = rs + 1;
  const rows = sections.length;
  const zmin = sections[0].z, zmax = sections[sections.length - 1].z;
  const pos = [], uv = [], idx = [];
  const layers = [scale, scale - thickness];

  for (const k of layers) {
    for (const s of sections) {
      const n = s.n ?? 2.35;
      for (let i = 0; i < cols; i++) {
        const t = thetaStart + thetaLength * (i / rs);
        const ct = Math.cos(t), st = Math.sin(t);
        const px = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n) * s.rx * k;
        const py = Math.sign(st) * Math.pow(Math.abs(st), 2 / n) * s.ry * k;
        pos.push(px, py + (s.cy || 0), s.z);
        uv.push((i / rs) * (opts.uScale ?? 1), ((s.z - zmin) / (zmax - zmin || 1)) * (opts.vScale ?? 1));
      }
    }
  }
  const off = rows * cols;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < rs; i++) {
      const a = j * cols + i, b = j * cols + i + 1;
      const c = (j + 1) * cols + i, d = (j + 1) * cols + i + 1;
      idx.push(a, b, c, b, d, c);                     // 外表面
      idx.push(off + a, off + c, off + b, off + b, off + c, off + d); // 内表面
    }
  }
  // 四条边封口
  for (let i = 0; i < rs; i++) {
    const a = i, b = i + 1;
    const a2 = (rows - 1) * cols + i, b2 = (rows - 1) * cols + i + 1;
    idx.push(a, off + a, b, b, off + a, off + b);
    idx.push(a2, b2, off + a2, b2, off + b2, off + a2);
  }
  for (let j = 0; j < rows - 1; j++) {
    const a = j * cols, b = (j + 1) * cols;
    const a2 = j * cols + rs, b2 = (j + 1) * cols + rs;
    idx.push(a, b, off + a, b, off + b, off + a);
    idx.push(a2, off + a2, b2, b2, off + a2, off + b2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 二维多边形 → 带倒角的实体板，并躺平到 XZ 平面（y 为厚度方向） */
export function plate(points, depth = 0.12, bevel = 0.035) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, curveSegments: 2, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

/** 沿一组点生成发光灯带（细管） */
export function strip(points, radius, material, tubular = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, radius, 6, false), material);
}

/** 沿直线生成圆柱杆 */
export function rod(a, b, r, material, seg = 10) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

export function mesh(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  return m;
}
