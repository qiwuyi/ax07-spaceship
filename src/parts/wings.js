import * as THREE from 'three';
import { plate, box, strip, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';

const WING_OUTLINE = [
  [1.18, 1.95], [2.55, 0.55], [5.35, -2.35], [5.62, -3.42],
  [3.10, -3.62], [1.18, -3.52],
];
const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

function buildWing(M, side) {
  const g = new THREE.Group();
  const outline = side > 0 ? WING_OUTLINE : mirror(WING_OUTLINE);

  // 主翼盒
  g.add(mesh(plate(outline, 0.17, 0.045), M.armor, { pos: [0, 0.02, 0] }));
  // 上表面深色分色板（略小一圈）
  const inset = outline.map(([x, y]) => [x * 0.93, y * 0.90 - 0.08]);
  const inner = side > 0 ? inset : mirror(inset);
  g.add(mesh(plate(inner, 0.035, 0.015), M.darkArmor, { pos: [0, 0.22, 0] }));

  // 前缘发光条
  g.add(strip([
    [side * 1.22, 0.16, -1.90], [side * 2.55, 0.16, -0.52],
    [side * 4.10, 0.16, 1.05], [side * 5.36, 0.14, 2.34],
  ], 0.032, M.cyanGlow, 60));
  // 后缘襟翼
  g.add(strip([
    [side * 1.25, 0.10, 3.50], [side * 3.10, 0.10, 3.61], [side * 5.58, 0.09, 3.40],
  ], 0.055, M.frame, 48));
  // 翼面分隔筋
  for (let i = 0; i < 4; i++) {
    const x = 1.75 + i * 0.92;
    const zf = -1.95 + (x - 1.18) * 1.02;
    g.add(mesh(box(0.035, 0.03, 2.55 - i * 0.34), M.plate,
      { pos: [side * x, 0.25, zf + 1.15 - i * 0.16] }));
  }
  // 翼尖垂直安定面
  const fin = mesh(box(0.07, 0.92, 1.25), M.plate, { pos: [side * 5.50, 0.55, 2.92] });
  fin.rotation.x = -0.24;
  fin.rotation.z = side * 0.20;
  g.add(fin);
  g.add(mesh(box(0.09, 0.10, 0.86), M.redGlow, { pos: [side * 5.52, 1.02, 2.80] }));

  // 翼下挂架与副油箱
  for (const z of [0.15, 2.05]) {
    const x = side * (3.05 - z * 0.12);
    g.add(rod([x, -0.12, z], [x, -0.46, z], 0.055, M.frame));
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.78, 4, 12), M.plate);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(x, -0.52, z);
    pod.castShadow = true;
    g.add(pod);
    g.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M.amberGlow, { pos: [x, -0.52, z + 0.60] }));
  }
  // 翼根整流罩
  g.add(mesh(new THREE.SphereGeometry(0.46, 16, 12), M.hull,
    { pos: [side * 1.25, 0.06, 0.75], scale: [1.5, 0.42, 3.1] }));
  // 翼面警示三角
  for (let i = 0; i < 5; i++) {
    g.add(mesh(box(0.22, 0.012, 0.08), M.stripe,
      { pos: [side * (3.9 + i * 0.24), 0.24, 2.55 - i * 0.10] }));
  }
  return g;
}

export function createWings(M, root) {
  for (const [side, id, name, en] of [
    [1, 'wing-right', '右舷主翼', 'STBD WING'],
    [-1, 'wing-left', '左舷主翼', 'PORT WING'],
  ]) {
    const g = buildWing(M, side);
    root.add(g);
    registerPart({
      id, name, en, category: '气动',
      object: g, offset: [side * 5.0, 0.3, 0.6], spin: [0, side * 0.14, side * 0.10],
      anchor: [side * 3.6, 0.3, 0.9],
      desc: '后掠三角翼，内含姿控推进剂贮箱与热管回路；前缘集成等离子导流条，翼尖设垂直安定面。',
      specs: [['翼展', '5.6 m/侧'], ['后掠角', '38°'], ['挂点', '2 个'], ['襟翼', '电驱分裂式']],
    });
  }
}
