import * as THREE from 'three';

const VERT = /* glsl */`
uniform float uTime;
uniform float uLength;
uniform float uPower;
varying float vAxial;
varying vec2  vUv;
varying vec3  vN;
varying vec3  vV;
void main() {
  vUv = uv;
  vec3 p = position;
  float axial = clamp(p.z / uLength, 0.0, 1.0);
  vAxial = axial;
  float wob = sin(p.z * 6.5 - uTime * 15.0 + p.x * 3.0) * 0.045
            + cos(p.z * 3.7 - uTime * 9.5 + p.y * 4.0) * 0.035;
  p.x += wob * axial;
  p.y += wob * axial * 0.85;
  p.xy *= 1.0 + 0.075 * sin(uTime * 19.0 + p.z * 2.6) * axial;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uPower;
uniform vec3  uCore;
uniform vec3  uEdge;
uniform float uDensity;
varying float vAxial;
varying vec2  vUv;
varying vec3  vN;
varying vec3  vV;

float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  float a = vAxial;
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, 1.35);
  float n = noise(vec3(vUv.x * 11.0, a * 6.0 - uTime * 2.8, uTime * 0.75));
  float n2 = noise(vec3(vUv.x * 24.0, a * 13.0 - uTime * 5.2, uTime * 1.4));
  float turb = 0.70 + 0.30 * n + 0.14 * n2;
  float flick = 0.90 + 0.10 * sin(uTime * 34.0 + a * 9.0);
  float root = exp(-a * 3.4);
  float tip  = smoothstep(1.0, 0.06, a);
  vec3 col = mix(uEdge, uCore, clamp(root * 1.35 + 0.22, 0.0, 1.0));
  col = mix(col, vec3(1.0, 0.99, 0.95), pow(root, 2.2) * 0.85);
  float alpha = tip * (0.20 + body * 0.68) * turb * flick * uDensity * uPower;
  gl_FragColor = vec4(col * (0.48 + root * 0.86), alpha);
}`;

/** 单具引擎的等离子体尾焰：三层壳体 + 火花粒子 + 动态点光 */
export function createExhaust(radius = 0.44, length = 3.6, seed = 0) {
  const group = new THREE.Group();
  const layers = [
    { r: 1.00, l: 1.00, core: 0x2f6cff, edge: 0x0a1e6e, density: 0.40 },
    { r: 0.62, l: 0.74, core: 0x59d6ff, edge: 0x1b5cff, density: 0.50 },
    { r: 0.30, l: 0.46, core: 0xcfe8ff, edge: 0x8ce8ff, density: 0.48 },
  ];
  const mats = [];
  for (const L of layers) {
    const h = length * L.l;
    const geo = new THREE.CylinderGeometry(radius * L.r * 0.05, radius * L.r, h, 28, 20, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, h / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: seed * 13.7 },
        uLength: { value: h },
        uPower: { value: 0 },
        uCore: { value: new THREE.Color(L.core) },
        uEdge: { value: new THREE.Color(L.edge) },
        uDensity: { value: L.density },
      },
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 6;
    group.add(m);
    mats.push(mat);
  }

  // 喷口辉光核心
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xdaf4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 32), coreMat);
  core.position.z = 0.012;
  core.renderOrder = 7;
  group.add(core);

  // 火花粒子
  const COUNT = 60;
  const p = new Float32Array(COUNT * 3);
  const v = new Float32Array(COUNT * 3);
  const life = new Float32Array(COUNT);
  const sz = new Float32Array(COUNT);
  const col = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    p[i * 3] = (Math.random() - 0.5) * radius * 0.6;
    p[i * 3 + 1] = (Math.random() - 0.5) * radius * 0.6;
    p[i * 3 + 2] = Math.random() * length * 0.85;
    v[i * 3] = (Math.random() - 0.5) * 0.22;
    v[i * 3 + 1] = (Math.random() - 0.5) * 0.22;
    v[i * 3 + 2] = 2.0 + Math.random() * 3.5;
    life[i] = Math.random();
    sz[i] = 0.45 + Math.random() * 1.0;
    const c = new THREE.Color(Math.random() > 0.55 ? 0x8fe4ff : 0xffb066);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  pg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  pg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uPower: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize;
      uniform float uPixelRatio; varying vec3 vC; varying float vA;
      void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=aSize*uPixelRatio*(70.0/-mv.z);
        vA=1.0; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`
      uniform float uPower; varying vec3 vC; varying float vA;
      void main(){ float d=length(gl_PointCoord-vec2(0.5));
        float a=smoothstep(0.5,0.0,d)*uPower*vA;
        gl_FragColor=vec4(vC*1.3,a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const sparks = new THREE.Points(pg, pm);
  sparks.frustumCulled = false;
  sparks.renderOrder = 8;
  group.add(sparks);

  const light = new THREE.PointLight(0x4fb4ff, 0, 9, 2);
  light.position.z = 0.55;
  group.add(light);

  let power = 0, target = 1;
  return {
    group,
    setTarget(v) { target = v; },
    get power() { return power; },
    update(t, dt) {
      power += (target - power) * Math.min(1, dt * 3.4);
      const flick = 0.93 + 0.07 * Math.sin(t * 27 + seed * 4) + 0.03 * Math.sin(t * 61 + seed);
      const p2 = power * flick;
      for (const m of mats) {
        m.uniforms.uTime.value = t + seed * 5;
        m.uniforms.uPower.value = p2;
      }
      coreMat.opacity = 0.32 * power;
      core.scale.setScalar(0.94 + 0.06 * Math.sin(t * 19 + seed));
      pm.uniforms.uPower.value = power;
      light.intensity = power * 2.4 * flick;
      light.color.setHSL(0.56 + 0.02 * Math.sin(t * 3 + seed), 0.85, 0.62);

      if (power > 0.01) {
        const arr = pg.attributes.position.array;
        for (let i = 0; i < COUNT; i++) {
          arr[i * 3] += v[i * 3] * dt;
          arr[i * 3 + 1] += v[i * 3 + 1] * dt;
          arr[i * 3 + 2] += v[i * 3 + 2] * dt * (0.4 + power);
          if (arr[i * 3 + 2] > length * 1.05) {
            arr[i * 3] = (Math.random() - 0.5) * radius * 0.4;
            arr[i * 3 + 1] = (Math.random() - 0.5) * radius * 0.4;
            arr[i * 3 + 2] = 0;
          }
        }
        pg.attributes.position.needsUpdate = true;
      }
    },
  };
}
