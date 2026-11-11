import * as THREE from 'three';
import { box, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';
import { createExhaust } from '../fx/exhaust.js';

function cylZ(rTop, rBot, h, mat, z, seg = 32, open = true) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z);
  return new THREE.Mesh(g, mat);
}

function buildEngine(M, x, y, scale, seed, label) {
  const g = new THREE.Group();
  const r = 0.56 * scale;
  const zFront = 4.15, zBack = 6.05;
  const h = zBack - zFront;
  const cz = (zFront + zBack) / 2;

  // 外壳（前端收窄、尾端喇叭口）
  g.add(mesh(new THREE.CylinderGeometry(r * 1.10, r * 0.92, h, 32, 1, true).rotateX(Math.PI / 2), M.engine,
    { pos: [x, y, cz] }));
  // 内壁隔热筒
  const inner = cylZ(r * 1.02, r * 0.84, h * 0.98, M.inner, cz, 32);
  inner.position.set(x, y, 0);
  inner.geometry.translate(0, 0, 0);
  inner.position.z = 0;
  inner.position.x = x; inner.position.y = y;
  g.add(inner);
  // 喷口厚环
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 1.09, 0.075 * scale, 10, 40), M.gold);
  lip.position.set(x, y, zBack);
  g.add(lip);
  const lip2 = new THREE.Mesh(new THREE.TorusGeometry(r * 1.17, 0.035, 8, 40), M.heat);
  lip2.position.set(x, y, zBack - 0.20);
  g.add(lip2);
  // 外部加强环与散热鳍
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * (0.97 + i * 0.045), 0.032, 8, 36), M.darkArmor);
    t.position.set(x, y, zFront + 0.25 + i * 0.55);
    g.add(t);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const fin = mesh(box(0.055 * scale, 0.22 * scale, 1.35), M.heat, {
      pos: [x + Math.cos(a) * r * 1.03, y + Math.sin(a) * r * 1.03, cz],
    });
    fin.rotation.z = a;
    g.add(fin);
  }
  // 涡轮叶片
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const blade = mesh(box(r * 0.86, 0.035, 0.24), M.frame,
      { pos: [x + Math.cos(a) * r * 0.48, y + Math.sin(a) * r * 0.48, zBack - 0.42] });
    blade.rotation.z = a + 0.45;
    g.add(blade);
  }
  // 喷口内部余辉盘
  const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 32), M.blueGlow);
  glow.position.set(x, y, zBack - 0.34);
  g.add(glow);
  // 引擎状态指示灯
  g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), M.amberGlow,
    { pos: [x, y + r * 1.16, zFront + 0.45] }));

  // 等离子体尾焰
  const fx = createExhaust(r * 0.86, 3.7 * scale, seed);
  fx.group.position.set(x, y, zBack + 0.02);
  g.add(fx.group);

  return { group: g, fx, label, scale };
}

export function createEngines(M, root) {
  const configs = [
    { x: 0, y: -0.02, s: 1.10, seed: 0.3, id: 'engine-center', name: '中央主推进器', en: 'MAIN THRUSTER', label: true },
    { x: -0.98, y: 0.22, s: 0.80, seed: 1.7, id: 'engine-port', name: '左舷推进器', en: 'PORT THRUSTER', label: false },
    { x: 0.98, y: 0.22, s: 0.80, seed: 3.1, id: 'engine-stbd', name: '右舷推进器', en: 'STBD THRUSTER', label: false },
  ];
  const list = [];
  for (const c of configs) {
    const e = buildEngine(M, c.x, c.y, c.s, c.seed, c.label);
    root.add(e.group);
    list.push(e);
    registerPart({
      id: c.id, name: c.name, en: c.en, category: '推进',
      object: e.group, label: c.label,
      offset: [c.x * 1.5, c.y * 0.8, 4.2 + (c.x === 0 ? 0 : 0.8)],
      spin: [0, 0, c.x * 0.06],
      anchor: [c.x, c.y + 0.7 * c.s, 5.2],
      desc: '磁约束等离子体推进器，环形超导线圈约束高温工质；喷口内侧为可更换碳化铪隔热瓦。',
      specs: [
        ['单台推力', (c.s * 118).toFixed(0) + ' kN'],
        ['比冲', '9,400 s'],
        ['喷口直径', (c.s * 1.12).toFixed(2) + ' m'],
        ['工质', '氙 / 氢'],
      ],
    });
  }

  // 尾部承力框架（不单独标注，随中央引擎一起）
  const frame = new THREE.Group();
  for (const side of [-1, 1]) {
    frame.add(rod([side * 1.15, 0.62, 4.35], [side * 0.6, 0.62, 5.85], 0.055, M.frame));
    frame.add(rod([side * 1.15, -0.62, 4.35], [side * 0.6, -0.62, 5.85], 0.055, M.frame));
  }
  frame.add(mesh(box(2.9, 0.10, 0.22), M.darkArmor, { pos: [0, 0.72, 5.25] }));
  frame.add(mesh(box(2.9, 0.10, 0.22), M.darkArmor, { pos: [0, -0.72, 5.25] }));
  root.add(frame);
  registerPart({
    id: 'engine-frame', name: '尾部推力框架', en: 'THRUST FRAME', category: '推进',
    object: frame, offset: [0, 0, 6.2], anchor: [0, 0.9, 5.2], label: false,
    desc: '把三台推进器的推力均匀传递到主承力船体的桁架结构。',
    specs: [['材质', '碳纤维桁架'], ['节点', '钛合金'], ['载荷', '360 kN']],
  });

  return {
    exhausts: list.map((e) => e.fx),
    setPower(target) { for (const e of list) e.fx.setTarget(target); },
    update(t, dt) { for (const e of list) e.fx.update(t, dt); },
  };
}
