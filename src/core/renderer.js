import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070d);
  scene.fog = new THREE.FogExp2(0x04070d, 0.0022);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(13.5, 6.4, 15.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 9;
  controls.maxDistance = 48;
  controls.target.set(0, 0.25, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.42;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.minPolarAngle = Math.PI * 0.08;

  // 基于 RoomEnvironment 的 PMREM：无需外部 HDR 文件即可获得真实金属反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.035);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xdcecff, 2.25);
  key.position.set(9, 13, -8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x3a7dff, 1.45);
  rim.position.set(-12, 2, 10);
  scene.add(rim);

  const under = new THREE.DirectionalLight(0x6d90c4, 0.85);
  under.position.set(3, -10, 2);
  scene.add(under);

  scene.add(new THREE.AmbientLight(0x38506b, 0.30));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.52, 0.55, 0.82,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, composer, bloom, key, resize };
}
