import * as THREE from 'three';
import { box, rod, mesh } from './geometry.js';
import { registerPart } from '../registry.js';
import { createLaserBeam } from '../fx/laser.js';

export function createWeapons(M, root) {
  const turrets = new THREE.Group();
  // 光束挂在炮塔子树下：剖析拆解时光束会跟着炮塔一起移动
  const beams = [];

  for (const side of [-1, 1]) {
    const cx = side * 1.86, cy = 0.74, cz = -0.95;

    // 转塔基座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.40, 0.20, 24), M.darkArmor);
    base.position.set(cx, cy, cz);
    base.castShadow = true;
    turrets.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 14), M.armor);
    dome.position.set(cx, cy + 0.16, cz);
    dome.scale.set(1, 0.78, 1);
    dome.castShadow = true;
    turrets.add(dome);
    // 蓄能核心
    turrets.add(mesh(new THREE.SphereGeometry(0.10, 14, 10), M.redGlow,
      { pos: [cx, cy + 0.34, cz] }));

    // 双联炮管，朝 -Z
    for (const off of [-0.145, 0.145]) {
      const bx = cx + off;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.05, 16), M.engine);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, cy + 0.12, cz - 0.52);
      barrel.castShadow = true;
      turrets.add(barrel);
      // 散热环
      for (let i = 0; i < 3; i++) {
        const rr = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.018, 6, 20), M.heat);
        rr.position.set(bx, cy + 0.12, cz - 0.20 - i * 0.28);
        turrets.add(rr);
      }
      // 炮口环
      const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.022, 8, 20), M.gold);
      muzzle.position.set(bx, cy + 0.12, cz - 1.06);
      turrets.add(muzzle);
      const ember = mesh(new THREE.CircleGeometry(0.062, 16), M.redGlow,
        { pos: [bx, cy + 0.12, cz - 1.055] });
      turrets.add(ember);

      const beam = createLaserBeam(bx, cy + 0.12, cz - 1.07, (side + 2) * 2 + (off > 0 ? 1 : 0));
      beam.group.rotation.y = side * 0.075 + (off > 0 ? 0.018 : -0.018);
      turrets.add(beam.group);
      beams.push(beam);
    }
    // 炮塔侧面装甲与传感器
    for (const s of [-1, 1]) {
      turrets.add(mesh(box(0.06, 0.30, 0.52), M.plate,
        { pos: [cx + s * 0.30, cy + 0.20, cz] }));
    }
    turrets.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), M.blueGlow,
      { pos: [cx, cy + 0.30, cz + 0.20] }));
  }

  root.add(turrets);
  registerPart({
    id: 'weapon-turrets', name: '双联激光炮塔', en: 'LASER TURRETS', category: '武器',
    object: turrets, offset: [0, 3.0, -3.4], spin: [-0.12, 0, 0],
    anchor: [1.86, 1.1, -1.0],
    desc: '左右舷各一座双联装固态激光炮塔，采用相干合成光路，炮管外置超导散热环。',
    specs: [['数量', '2 座 / 4 管'], ['单管功率', '2.4 MW'], ['波长', '1,064 nm'], ['射程', '有效 12 km']],
  });

  return {
    beams,
    setPower(v) { for (const b of beams) b.setTarget(v); },
    update(t, dt) { for (const b of beams) b.update(t, dt); },
  };
}
