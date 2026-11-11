import * as THREE from 'three';

const VERT = /* glsl */`
uniform float uLength;
varying float vA;
varying vec3 vN;
varying vec3 vV;
void main() {
  vA = clamp(-position.z / uLength, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uPower;
uniform float uDensity;
uniform vec3  uHot;
uniform vec3  uCool;
varying float vA;
varying vec3 vN;
varying vec3 vV;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, 1.8);
  float fade = 1.0 - smoothstep(0.52, 1.0, vA);
  float ignite = smoothstep(0.0, 0.035, 1.0 - vA);
  float pulse = 0.86 + 0.14 * sin(uTime * 52.0 - vA * 46.0);
  vec3 col = mix(uHot, uCool, clamp(vA * 1.25, 0.0, 1.0));
  float alpha = fade * ignite * pulse * (0.24 + body * 0.9) * uDensity * uPower;
  gl_FragColor = vec4(col * (1.1 + body * 0.9) * uPower, alpha);
}`;

export function createLaserBeam(x, y, z, seed = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const L = 26;
  const layers = [
    { r: 0.155, hot: 0xff7a3c, cool: 0xd21a12, density: 0.34 },
    { r: 0.062, hot: 0xffffff, cool: 0xff9a5a, density: 0.95 },
  ];
  const mats = [];
  for (const Lr of layers) {
    const geo = new THREE.CylinderGeometry(Lr.r, Lr.r, L, 12, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -L / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: seed }, uLength: { value: L }, uPower: { value: 0 },
        uDensity: { value: Lr.density },
        uHot: { value: new THREE.Color(Lr.hot) },
        uCool: { value: new THREE.Color(Lr.cool) },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 9;
    group.add(m);
    mats.push(mat);
  }

  // 炮口闪焰
  const flareMat = new THREE.MeshBasicMaterial({
    color: 0xffd8a8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), flareMat);
  flare.renderOrder = 10;
  group.add(flare);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.026, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff6a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  ring.renderOrder = 10;
  group.add(ring);

  let power = 0, target = 0;
  return {
    group,
    setTarget(v) { target = v; },
    get power() { return power; },
    update(t, dt) {
      power += (target - power) * Math.min(1, dt * 7.0);
      for (const m of mats) {
        m.uniforms.uTime.value = t + seed * 3;
        m.uniforms.uPower.value = power;
      }
      flareMat.opacity = power * (0.75 + 0.2 * Math.sin(t * 44 + seed));
      flare.scale.setScalar(0.7 + power * (0.55 + 0.12 * Math.sin(t * 31 + seed)));
      ring.material.opacity = power * 0.9;
      ring.scale.setScalar(0.85 + 0.22 * Math.sin(t * 26 + seed));
    },
  };
}
