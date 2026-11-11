import * as THREE from 'three';
import { parts, partById } from './registry.js';

const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export function createExploder(camera, controls, scene) {
  let progress = 0, target = 0, fromProgress = 0, animStart = 0;
  const ANIM_MS = 950;
  let selected = null;
  let camActive = false, camStart = 0, camFrom = 0, camTo = 0;
  const CAM_MS = 900;
  let onState = () => {};

  const spinQuat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  const box = new THREE.Box3();
  const helper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0x4bdcff));
  helper.material.transparent = true;
  helper.material.opacity = 0;
  helper.material.depthTest = false;
  helper.renderOrder = 20;
  helper.visible = false;
  scene.add(helper);

  const quats = new Map();
  for (const p of parts) {
    euler.set(p.spin.x, p.spin.y, p.spin.z);
    quats.set(p.id, new THREE.Quaternion().setFromEuler(euler).multiply(p.baseQuat));
  }

  function animateCamera(toDist) {
    camFrom = camera.position.distanceTo(controls.target);
    camTo = toDist;
    camStart = performance.now();
    camActive = true;
  }

  function setExploded(v) {
    const next = v ? 1 : 0;
    if (next === target) return;
    fromProgress = progress;
    target = next;
    animStart = performance.now();
    const dist = camera.position.distanceTo(controls.target);
    animateCamera(v ? Math.max(dist, window.innerWidth < 760 ? 32 : 28) : Math.min(dist, 21));
    onState({ exploded: !!v, progress });
  }

  function select(id) {
    selected = (id && partById.has(id) && id !== selected) ? id : null;
    if (selected) helper.visible = true;
    else { helper.visible = false; helper.material.opacity = 0; }
    onState({ selected });
    return selected;
  }

  function focusSelected() {
    if (!selected) return;
    const p = partById.get(selected);
    const world = tmpV.copy(p.anchor).applyMatrix4(p.object.matrixWorld).clone();
    controls.target.copy(world);
    animateCamera(13);
  }

  function resetView() {
    controls.target.set(0, 0.25, 0);
    camera.position.set(13.5, 6.4, 15.5);
    controls.update();
  }

  function update(dt, t) {
    if (progress !== target) {
      // 按真实时间推进：低帧率 / 后台节流时动画时长依然稳定
      const k = THREE.MathUtils.clamp((performance.now() - animStart) / ANIM_MS, 0, 1);
      progress = THREE.MathUtils.clamp(fromProgress + (target - fromProgress) * k, 0, 1);
      onState({ progress });
    }
    const e = easeInOut(progress);
    // 窄屏水平视野小，拆解幅度同比收拢，保证零件与标注都在画面内
    const spread = window.innerWidth < 760 ? 0.62 : 1;
    for (const p of parts) {
      p.object.position.copy(p.base).addScaledVector(p.offset, e * spread);
      p.object.quaternion.copy(p.baseQuat).slerp(quats.get(p.id), e);
      p.object.updateMatrixWorld(true);
    }

    if (camActive) {
      const k = THREE.MathUtils.clamp((performance.now() - camStart) / CAM_MS, 0, 1);
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, THREE.MathUtils.lerp(camFrom, camTo, easeInOut(k)));
      if (k >= 1) camActive = false;
    }

    if (selected) {
      const p = partById.get(selected);
      box.makeEmpty();
      p.object.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material && (o.material.isShaderMaterial || o.material.transparent && o.material.opacity < 0.4)) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        box.union(b);
      });
      if (!box.isEmpty()) {
        box.expandByScalar(0.09);
        helper.box.copy(box);
        helper.material.opacity = 0.55 + 0.25 * Math.sin(t * 3.2);
      }
    }
  }

  return {
    update, setExploded, select, focusSelected, resetView,
    get progress() { return progress; },
    get exploded() { return target > 0.5; },
    get selected() { return selected; },
    set onState(fn) { onState = fn; },
  };
}
