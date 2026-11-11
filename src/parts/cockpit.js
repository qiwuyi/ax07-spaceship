import * as THREE from 'three';
import { loft, box, strip, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';

export function createCockpit(M, root) {
  /* ---------- 4. 内部座舱 ---------- */
  const interior = new THREE.Group();
  const floor = mesh(box(1.06, 0.06, 2.5), M.inner, { pos: [0, 0.44, -3.35] });
  interior.add(floor);
  // 双座座椅
  for (const x of [-0.28, 0.28]) {
    interior.add(mesh(box(0.36, 0.10, 0.42), M.frame, { pos: [x, 0.54, -3.0] }));
    const back = mesh(box(0.36, 0.52, 0.09), M.frame, { pos: [x, 0.80, -2.79] });
    back.rotation.x = -0.16;
    interior.add(back);
    interior.add(mesh(box(0.30, 0.06, 0.10), M.amberGlow, { pos: [x, 0.60, -3.22] }));
  }
  // 仪表台 + 全息屏
  interior.add(mesh(box(1.02, 0.20, 0.34), M.darkArmor, { pos: [0, 0.72, -4.12] }));
  for (const x of [-0.30, 0, 0.30]) {
    const scr = mesh(box(0.24, 0.15, 0.012), M.cyanGlow, { pos: [x, 0.78, -4.28] });
    scr.rotation.x = -0.22;
    interior.add(scr);
  }
  const holo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x39d8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  holo.position.set(0, 1.06, -4.02);
  holo.rotation.x = -0.28;
  interior.add(holo);
  // 舱内暖光
  const cabinLight = new THREE.PointLight(0xffb46a, 1.7, 3.2, 2);
  cabinLight.position.set(0, 0.9, -3.3);
  interior.add(cabinLight);
  root.add(interior);
  registerPart({
    id: 'cockpit-interior', name: '座舱与航电', en: 'FLIGHT DECK', category: '驾驶',
    object: interior, offset: [0, 0, -2.6], anchor: [0, 1.0, -3.4], label: false,
    desc: '双人制驾驶舱，含操纵台、 holographic HUD 投影与生命维持控制面板。',
    specs: [['乘员', '2 人'], ['HUD', '全息投影'], ['维生', '48 h 独立']],
  });

  /* ---------- 5. 座舱罩玻璃 ---------- */
  const canopy = new THREE.Group();
  const sec = [
    { z: -4.65, rx: 0.06, ry: 0.05, n: 2.0, cy: 0.60 },
    { z: -4.35, rx: 0.44, ry: 0.20, n: 2.1, cy: 0.66 },
    { z: -3.85, rx: 0.66, ry: 0.36, n: 2.2, cy: 0.76 },
    { z: -3.10, rx: 0.76, ry: 0.46, n: 2.2, cy: 0.85 },
    { z: -2.35, rx: 0.74, ry: 0.46, n: 2.2, cy: 0.86 },
    { z: -1.75, rx: 0.62, ry: 0.36, n: 2.2, cy: 0.86 },
    { z: -1.45, rx: 0.40, ry: 0.20, n: 2.1, cy: 0.85 },
  ];
  // 只取上半部分做风挡，避免玻璃包住整个船体
  const glassGeo = loft(sec, { radialSegments: 32, thetaStart: 0.02, thetaLength: Math.PI - 0.04, uScale: 1, vScale: 1 });
  canopy.add(mesh(glassGeo, M.glass, { cast: false }));
  // 风挡前缘镀膜反光条
  canopy.add(strip([
    [-0.62, 0.80, -3.02], [-0.40, 1.10, -3.35], [0, 1.22, -3.52],
    [0.40, 1.10, -3.35], [0.62, 0.80, -3.02],
  ], 0.014, M.plate, 40));
  root.add(canopy);
  registerPart({
    id: 'cockpit-canopy', name: '镀膜座舱罩', en: 'CANOPY GLASS', category: '驾驶',
    object: canopy, offset: [0, 3.0, -2.2], spin: [0.12, 0, 0], anchor: [0, 1.35, -3.1],
    desc: '多层蓝宝石/聚碳酸酯复合风挡，外覆导电镀膜以抵御微陨石与强辐射。',
    specs: [['层数', '5 层复合'], ['透光', '78%'], ['镀膜', 'ITO 导电膜'], ['抗压', '3.2 atm']],
  });

  /* ---------- 6. 座舱框架 ---------- */
  const frame = new THREE.Group();
  // 纵向框条
  for (const a of [-0.85, 0, 0.85]) {
    frame.add(strip([
      [a * 0.3, 0.76, -4.55], [a * 0.66, 1.02, -4.05], [a * 0.76, 1.24, -3.05],
      [a * 0.72, 1.24, -2.20], [a * 0.55, 1.04, -1.55],
    ], 0.038, M.frame, 40));
  }
  // 横向框与底座环
  for (const [z, rx, cy] of [[-4.05, 0.56, 0.70], [-3.10, 0.76, 0.86], [-2.10, 0.70, 0.86], [-1.52, 0.46, 0.85]]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1, 0.028, 6, 40, Math.PI), M.frame);
    arc.scale.set(rx, 0.42, 1);
    arc.position.set(0, cy, z);
    frame.add(arc);
  }
  frame.add(mesh(box(1.55, 0.09, 3.25), M.darkArmor, { pos: [0, 0.56, -3.05] }));
  for (const side of [-1, 1]) {
    frame.add(mesh(box(0.10, 0.09, 3.0), M.plate, { pos: [side * 0.78, 0.60, -3.05] }));
    frame.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), side < 0 ? M.redGlow : M.blueGlow,
      { pos: [side * 0.80, 0.63, -4.4] }));
  }
  root.add(frame);
  registerPart({
    id: 'cockpit-frame', name: '座舱承力框架', en: 'CANOPY FRAME', category: '驾驶',
    object: frame, offset: [0, 4.6, -3.0], anchor: [0, 1.4, -2.9], label: false,
    desc: '钛合金拱形框架，承担风挡压差载荷并集成除冰加热丝与导航灯。',
    specs: [['拱架', '4 道'], ['材质', 'Ti-6Al-4V'], ['加热', '嵌入式']],
  });
}
