import * as THREE from 'three';
import { loft, shell, plate, box, strip, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';

// 主船体轮廓：尖端舰首 → 加宽中段 → 收紧尾部
export const HULL_SECTIONS = [
  { z: -6.35, rx: 0.04, ry: 0.05, n: 2.0 },
  { z: -5.85, rx: 0.34, ry: 0.24, n: 2.0 },
  { z: -5.05, rx: 0.78, ry: 0.47, n: 2.2 },
  { z: -3.90, rx: 1.16, ry: 0.66, n: 2.3 },
  { z: -2.40, rx: 1.45, ry: 0.82, n: 2.35 },
  { z: -0.60, rx: 1.58, ry: 0.90, n: 2.4 },
  { z: 1.40, rx: 1.60, ry: 0.91, n: 2.4 },
  { z: 3.20, rx: 1.48, ry: 0.84, n: 2.4 },
  { z: 4.55, rx: 1.34, ry: 0.76, n: 2.4 },
  { z: 5.35, rx: 1.26, ry: 0.72, n: 2.4 },
];

export function createHull(M, root) {
  /* ---------- 1. 主承压船体 ---------- */
  const core = new THREE.Group();
  core.add(mesh(loft(HULL_SECTIONS, { radialSegments: 48, uScale: 2, vScale: 3 }), M.hull));

  // 舰首分色锥与环形接缝
  const nose = mesh(loft([
    { z: -6.42, rx: 0.02, ry: 0.02 },
    { z: -5.95, rx: 0.31, ry: 0.22 },
    { z: -5.45, rx: 0.60, ry: 0.38 },
  ], { radialSegments: 32 }), M.plate);
  core.add(nose);
  for (const z of [-4.55, -1.85, 1.05, 3.75]) {
    const s = HULL_SECTIONS.reduce((a, b) => Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.018, 6, 64), M.darkArmor,
    );
    ring.scale.set(s.rx * 1.008, s.ry * 1.008, 1);
    ring.position.z = z;
    core.add(ring);
  }
  // 侧面散热槽
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -2.6 + i * 0.72;
      const vent = mesh(box(0.035, 0.21, 0.45), M.heat, { pos: [side * 1.52, 0.10, z] });
      vent.rotation.z = side * 0.12;
      core.add(vent);
    }
    // 侧面导流棱
    core.add(strip([
      [side * 1.12, 0.42, -4.2], [side * 1.50, 0.34, -2.0],
      [side * 1.61, 0.30, 0.6], [side * 1.48, 0.28, 3.3], [side * 1.28, 0.26, 5.2],
    ], 0.035, M.armor));
  }
  root.add(core);
  registerPart({
    id: 'hull-core', name: '主承压船体', en: 'PRIMARY HULL', category: '结构',
    object: core, offset: [0, 0, 0], anchor: [0, 0.9, -1.2],
    desc: '钛合金一体成型的主承力结构，内部为加压舱段与燃料贮箱。外表面覆盖陶瓷复合隔热层。',
    specs: [['全长', '11.8 m'], ['最大宽', '3.2 m'], ['结构', '钛-铝夹层'], ['干重', '12.4 t']],
  });

  /* ---------- 2. 背部装甲组 ---------- */
  const armor = new THREE.Group();
  const topSec = HULL_SECTIONS.filter((s) => s.z >= -4.6 && s.z <= 4.9);
  armor.add(mesh(shell(topSec, Math.PI * 0.19, Math.PI * 0.62, 1.035, 0.045,
    { radialSegments: 22, uScale: 1.5, vScale: 2 }), M.armor));
  // 中央脊线与分段肋条
  armor.add(strip([
    [0, 0.96, -4.3], [0, 1.05, -2.2], [0, 1.10, 0], [0, 1.05, 2.4], [0, 0.92, 4.6],
  ], 0.055, M.plate));
  for (const z of [-3.4, -1.6, 0.4, 2.4, 4.0]) {
    const rib = mesh(box(2.0, 0.07, 0.11), M.darkArmor, { pos: [0, 0.99, z] });
    rib.rotation.x = 0;
    armor.add(rib);
  }
  // 两侧警示条与发光缝
  for (const side of [-1, 1]) {
    armor.add(strip([
      [side * 0.72, 0.88, -3.9], [side * 1.02, 0.90, -1.6],
      [side * 1.08, 0.91, 1.2], [side * 0.96, 0.84, 4.2],
    ], 0.022, M.cyanGlow, 48));
    for (let i = 0; i < 4; i++) {
      const t = mesh(box(0.16, 0.012, 0.34), M.stripe, { pos: [side * 0.66, 0.91, -3.2 + i * 2.0] });
      armor.add(t);
    }
  }
  // 背部设备舱盖
  armor.add(mesh(plate([[-0.42, -3.1], [0.42, -3.1], [0.42, -2.1], [-0.42, -2.1]], 0.06, 0.02), M.darkArmor,
    { pos: [0, 1.03, 0] }));
  root.add(armor);
  registerPart({
    id: 'hull-armor', name: '背部复合装甲', en: 'DORSAL ARMOR', category: '结构',
    object: armor, offset: [0, 3.6, 0], spin: [0.09, 0, 0], anchor: [0, 1.2, 0.2],
    desc: '可抛弃式陶瓷/金属复合装甲，模块之间通过电磁锁扣连接，战损后可在轨整体更换。',
    specs: [['厚度', '48 mm'], ['覆盖', '背部 62%'], ['连接', '电磁锁扣 ×14'], ['面密度', '31 kg/m²']],
  });

  /* ---------- 3. 腹部龙骨 ---------- */
  const keel = new THREE.Group();
  const botSec = HULL_SECTIONS.filter((s) => s.z >= -4.2 && s.z <= 5.1);
  keel.add(mesh(shell(botSec, Math.PI * 1.20, Math.PI * 0.60, 1.03, 0.04,
    { radialSegments: 20, uScale: 1.5, vScale: 2 }), M.darkArmor));
  keel.add(mesh(box(0.34, 0.20, 8.0), M.engine, { pos: [0, -0.98, 0.3] }));
  for (const side of [-1, 1]) {
    keel.add(rod([side * 0.30, -0.95, -3.6], [side * 0.30, -0.95, 4.4], 0.045, M.gold));
    for (let i = 0; i < 7; i++) {
      keel.add(mesh(box(0.62, 0.05, 0.10), M.armor, { pos: [0, -1.10, -3.2 + i * 1.15] }));
    }
  }
  // 腹部蓝色航行灯
  for (const z of [-3.0, 0.0, 3.0]) {
    keel.add(mesh(new THREE.SphereGeometry(0.075, 12, 8), M.blueGlow, { pos: [0, -1.14, z] }));
  }
  root.add(keel);
  registerPart({
    id: 'hull-keel', name: '腹部龙骨与管线', en: 'VENTRAL KEEL', category: '结构',
    object: keel, offset: [0, -3.4, 0], spin: [-0.08, 0, 0], anchor: [0, -1.2, 0.6],
    desc: '主承力龙骨兼燃料/冷却液总管走向，外部包裹隔热护套，两侧为冗余推进剂管路。',
    specs: [['主管', 'Ø 90 mm'], ['冗余', '双路'], ['护套', '气凝胶毡'], ['长度', '8.6 m']],
  });
}
