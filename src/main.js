import * as THREE from 'three';
import { createStage } from './core/renderer.js';
import { createMaterials } from './core/materials.js';
import { createSpace } from './fx/space.js';
import { createHull } from './parts/hull.js';
import { createCockpit } from './parts/cockpit.js';
import { createWings } from './parts/wings.js';
import { createEngines } from './parts/engines.js';
import { createWeapons } from './parts/weapons.js';
import { createDetails } from './parts/details.js';
import { createExploder } from './explode.js';
import { createUI } from './ui.js';
import { parts } from './registry.js';

const state = {
  exploded: false,
  exhaust: true,
  laser: false,
  spin: true,
  labels: true,
  wireframe: false,
  bloom: 0.52,
  exposure: 1.0,
  selected: null,
};

let stage, M, space, engines, weapons, exploder, ui, shipRoot;
let pickables = [];
let savedMats = null;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const raf = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function setWireframe(on) {
  if (on && !savedMats) {
    savedMats = [];
    for (const o of pickables) {
      if (o.userData.noWire) continue;
      savedMats.push([o, o.material]);
      o.material = new THREE.MeshBasicMaterial({
        color: 0x54c8f5, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false,
      });
    }
  } else if (!on && savedMats) {
    for (const [o, m] of savedMats) o.material = m;
    savedMats = null;
  }
}

function apply(key) {
  if (!stage) return;
  switch (key) {
    case 'exploded': exploder.setExploded(state.exploded); break;
    case 'spin': stage.controls.autoRotate = state.spin; break;
    case 'bloom': stage.bloom.strength = state.bloom; break;
    case 'exposure': stage.renderer.toneMappingExposure = state.exposure; break;
    case 'wireframe': setWireframe(state.wireframe); break;
    default: break; // exhaust / laser / labels 由渲染循环读取
  }
}

function pickAt(cx, cy) {
  const r = stage.renderer.domElement.getBoundingClientRect();
  pointer.x = ((cx - r.left) / r.width) * 2 - 1;
  pointer.y = -((cy - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, stage.camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const hit of hits) {
    const mat = hit.object.material;
    if (mat && mat.transparent && mat.opacity < 0.22) continue;
    let p = hit.object, id = null;
    while (p && p !== stage.scene) {
      if (p.userData && p.userData.partId) { id = p.userData.partId; break; }
      p = p.parent;
    }
    if (id) return id;
  }
  return null;
}

function bindPicking() {
  const canvas = stage.renderer.domElement;
  let down = null;
  let hoverPending = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    ui.select(pickAt(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointermove', (e) => {
    lastX = e.clientX; lastY = e.clientY;
    if (hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      canvas.style.cursor = pickAt(lastX, lastY) ? 'pointer' : 'grab';
    });
  });
  canvas.style.cursor = 'grab';
}

function screenshot() {
  try {
    stage.composer.render();
    const url = stage.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `AX-07-${state.exploded ? '结构剖析' : '整舰'}-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = url;
    a.click();
    ui.toast('截图已导出为 PNG');
  } catch (err) {
    ui.toast('截图失败：' + (err.message || err));
  }
}

function fullscreen() {
  const d = document.documentElement;
  if (!document.fullscreenElement) {
    const p = d.requestFullscreen && d.requestFullscreen();
    if (p && p.catch) p.catch(() => ui.toast('浏览器拒绝了全屏请求'));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  stage.controls.autoRotate = state.spin && !state.selected;
  stage.controls.update();
  space.update(t);

  exploder.update(dt, t);
  const p = exploder.progress;
  engines.setPower(state.exhaust ? 1 - p * 0.72 : 0);
  weapons.setPower(state.laser ? 1 : 0);
  engines.update(t, dt);
  weapons.update(t, dt);
  ui.updateTags(stage.camera, p, state.selected);
  stage.composer.render();
}

async function boot() {
  const loadingSub = document.getElementById('loadingSub');
  await raf();

  loadingSub.textContent = '初始化渲染管线…'; await raf();
  stage = createStage(document.getElementById('scene'));
  M = createMaterials();
  space = createSpace(stage.scene);
  shipRoot = new THREE.Group();
  shipRoot.name = 'AX-07 Peregrine';
  stage.scene.add(shipRoot);

  loadingSub.textContent = '构建主船体与复合装甲…'; await raf();
  createHull(M, shipRoot);

  loadingSub.textContent = '装配座舱与后掠主翼…'; await raf();
  createCockpit(M, shipRoot);
  createWings(M, shipRoot);

  loadingSub.textContent = '装配等离子体推进器与激光炮塔…'; await raf();
  engines = createEngines(M, shipRoot);
  weapons = createWeapons(M, shipRoot);

  loadingSub.textContent = '装配航电、散热与起落架…'; await raf();
  createDetails(M, shipRoot);

  shipRoot.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.isShaderMaterial) return;
    pickables.push(o);
  });

  loadingSub.textContent = '建立零件索引与剖析引线…'; await raf();
  exploder = createExploder(stage.camera, stage.controls, stage.scene);
  ui = createUI({
    state,
    apply,
    actions: {
      select: (id) => exploder.select(id),
      focus: () => exploder.focusSelected(),
      resetView: () => exploder.resetView(),
      screenshot,
      fullscreen,
    },
  });
  bindPicking();
  stage.controls.autoRotate = state.spin;
  stage.bloom.strength = state.bloom;
  ui.setReady();
  window.__AX07 = { state, stage, exploder, parts, ui };
  clock.start();
  loop();
}

boot().catch((err) => {
  console.error('[AX-07] boot failed:', err);
  const msg = (err && err.message) ? err.message : String(err);
  if (ui) ui.fail(msg);
  else {
    document.getElementById('loading').hidden = true;
    document.getElementById('fatal').hidden = false;
    document.getElementById('fatalMsg').textContent = msg;
  }
});
