import * as THREE from 'three';
import { plate, box, strip, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';

export function createDetails(M, root) {
  /* ---------- 散热格栅 ---------- */
  const radiators = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = 0.25 + i * 0.62;
      const panel = mesh(box(1.18, 0.045, 0.46), M.engine,
        { pos: [side * 1.78, 0.72 + i * 0.012, z] });
      panel.rotation.z = side * 0.30;
      radiators.add(panel);
      // 散热片之间的橙热辉光缝
      radiators.add(strip([
        [side * 1.28, 0.73, z + 0.24], [side * 1.78, 0.74, z + 0.24], [side * 2.28, 0.73, z + 0.24],
      ], 0.016, M.amberGlow, 12));
      for (let k = 0; k < 4; k++) {
        radiators.add(mesh(box(1.10, 0.012, 0.018), M.heat,
          { pos: [side * 1.78, 0.750, z - 0.15 + k * 0.11] }));
      }
    }
    radiators.add(rod([side * 1.20, 0.70, 0.10], [side * 1.20, 0.70, 4.05], 0.05, M.frame));
  }
  root.add(radiators);
  registerPart({
    id: 'radiators', name: '可展开散热格栅', en: 'RADIATOR ARRAY', category: '航电',
    object: radiators, offset: [0, 2.6, 1.6], anchor: [1.9, 1.0, 2.0], label: false,
    desc: '双面辐射散热阵列，把反应堆与激光器的废热排向深空；入坞时可折叠贴合舰背。',
    specs: [['面积', '6.6 m²'], ['工质', '钠钾合金'], ['片数', '12 片']],
  });

  /* ---------- 天线与传感器阵列 ---------- */
  const antenna = new THREE.Group();
  // 背部主桅
  antenna.add(mesh(new THREE.CylinderGeometry(0.075, 0.13, 0.72, 12), M.frame,
    { pos: [0, 1.36, 1.55] }));
  antenna.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), M.plate,
    { pos: [0, 1.74, 1.55] }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const l = 0.42 + (i % 2) * 0.22;
    antenna.add(rod([0, 1.72, 1.55],
      [Math.cos(a) * l, 1.94 + (i % 2) * 0.16, 1.55 + Math.sin(a) * l], 0.014, M.plate, 6));
    antenna.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), i % 2 ? M.cyanGlow : M.redGlow,
      { pos: [Math.cos(a) * l, 1.94 + (i % 2) * 0.16, 1.55 + Math.sin(a) * l] }));
  }
  // 碟形定向天线
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), M.plate);
  dish.rotation.x = -0.7;
  dish.position.set(-0.62, 1.26, 2.7);
  antenna.add(dish);
  antenna.add(rod([-0.62, 1.26, 2.7], [-0.62, 1.55, 2.38], 0.020, M.frame, 8));
  antenna.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), M.blueGlow,
    { pos: [-0.62, 1.55, 2.38] }));
  // 侧向光学校准球
  for (const side of [-1, 1]) {
    antenna.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), M.glass,
      { pos: [side * 1.42, 0.42, -1.55], cast: false }));
    antenna.add(mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 20), M.gold,
      { pos: [side * 1.42, 0.42, -1.55] }));
  }
  root.add(antenna);
  registerPart({
    id: 'antenna', name: '通讯与传感阵列', en: 'SENSOR SUITE', category: '航电',
    object: antenna, offset: [0, 4.2, 2.4], anchor: [0, 1.9, 1.6],
    desc: '主桅集成超视距通讯、激光链路与姿态星敏；侧向球罩内是多光谱光学标定头。',
    specs: [['链路', '激光 / Ka 双模'], ['星敏', '3 台冗余'], ['增益', '42 dBi']],
  });

  /* ---------- 起落架 ---------- */
  const gear = new THREE.Group();
  const gearAt = (x, z, s = 1) => {
    gear.add(mesh(box(0.20 * s, 0.09, 0.20 * s), M.darkArmor, { pos: [x, -0.88, z] }));
    gear.add(rod([x, -0.90, z], [x, -1.42, z + 0.10], 0.055 * s, M.frame, 10));
    gear.add(rod([x, -1.10, z + 0.04], [x + 0.18 * s, -1.38, z + 0.10], 0.026 * s, M.plate, 8));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19 * s, 0.075 * s, 10, 20), M.heat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, -1.46, z + 0.12);
    gear.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.16 * s, 12), M.gold);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, -1.46, z + 0.12);
    gear.add(hub);
  };
  gearAt(0, -3.55, 0.85);
  gearAt(-1.15, 2.55, 1);
  gearAt(1.15, 2.55, 1);
  root.add(gear);
  registerPart({
    id: 'landing-gear', name: '前三点起落架', en: 'LANDING GEAR', category: '结构',
    object: gear, offset: [0, -2.8, 0.4], anchor: [0, -1.5, -3.5], label: false,
    desc: '电磁缓冲式起落架，收纳于腹部龙骨舱内；轮胎为实心金属网状，适应无大气天体表面。',
    specs: [['布局', '前三点'], ['缓冲', '电磁阻尼'], ['收纳', '腹部舱内']],
  });

  /* ---------- 舰首传感器与警示涂装 ---------- */
  const nose = new THREE.Group();
  nose.add(mesh(new THREE.ConeGeometry(0.11, 0.42, 16), M.gold,
    { pos: [0, 0.06, -6.48], rot: [-Math.PI / 2, 0, 0] }));
  for (const side of [-1, 1]) {
    nose.add(strip([
      [side * 0.28, 0.20, -5.85], [side * 0.56, 0.32, -5.05], [side * 0.86, 0.44, -4.25],
    ], 0.020, M.cyanGlow, 24));
    for (let i = 0; i < 6; i++) {
      const t = mesh(box(0.09, 0.014, 0.20), M.stripe,
        { pos: [side * (0.34 + i * 0.10), 0.26 + i * 0.025, -5.55 + i * 0.19] });
      t.rotation.y = side * 0.5;
      nose.add(t);
    }
  }
  nose.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), M.whiteGlow,
    { pos: [0, 0.10, -6.62] }));
  root.add(nose);
  registerPart({
    id: 'nose-sensor', name: '舰首探测锥', en: 'NOSE PROBE', category: '航电',
    object: nose, offset: [0, 0.4, -3.6], anchor: [0, 0.4, -6.3], label: false,
    desc: '前视测距雷达与等离子体密度探针，兼作大气层内飞行时的激波锥。',
    specs: [['雷达', '相控阵'], ['探针', '朗缪尔式'], ['长度', '0.42 m']],
  });
}
