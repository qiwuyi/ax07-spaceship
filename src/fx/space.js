import * as THREE from 'three';

const NEBULA_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAG = /* glsl */`
varying vec3 vDir;
uniform float uTime;
float hash(vec3 p){ p=fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5;} return s; }
void main(){
  vec3 d = normalize(vDir);
  float n = fbm(d*3.4 + vec3(0.0,0.0,uTime*0.004));
  float n2 = fbm(d*7.0 - vec3(uTime*0.002,0.0,0.0));
  vec3 base = vec3(0.010,0.017,0.032);
  vec3 cloudA = vec3(0.055,0.105,0.235) * pow(max(n-0.42,0.0),1.7)*3.2;
  vec3 cloudB = vec3(0.155,0.055,0.205) * pow(max(n2-0.50,0.0),1.9)*2.1;
  float band = pow(max(0.0, 1.0-abs(d.y*1.5)), 4.0);
  vec3 col = base + (cloudA+cloudB)*(0.55+band*0.7);
  gl_FragColor = vec4(col,1.0);
}`;

export function createSpace(scene) {
  const group = new THREE.Group();
  group.name = 'space';

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 48, 32), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  // 分层星场：远小近大，颜色带一点冷暖差
  const starLayers = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = [2600, 900, 220][layer];
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 90 + Math.random() * 140;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const t = Math.random();
      c.setHSL(t < 0.7 ? 0.58 + Math.random() * 0.05 : 0.08 + Math.random() * 0.04,
        0.25 + Math.random() * 0.4, 0.62 + Math.random() * 0.35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = (layer === 2 ? 2.6 : layer === 1 ? 1.5 : 0.85) * (0.6 + Math.random());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: /* glsl */`
        attribute float aSize; varying vec3 vColor; uniform float uPixelRatio;
        void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=aSize*uPixelRatio*(240.0/-mv.z);
          gl_Position=projectionMatrix*mv; }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main(){ float d=length(gl_PointCoord-vec2(0.5));
          float a=smoothstep(0.5,0.06,d); float core=smoothstep(0.22,0.0,d);
          gl_FragColor=vec4(vColor*(1.0+core*1.6),a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexColors: true, fog: false,
    });
    const pts = new THREE.Points(g, m);
    starLayers.push(pts);
    group.add(pts);
  }

  scene.add(group);
  return {
    group,
    update(t) {
      skyMat.uniforms.uTime.value = t;
      starLayers[2].rotation.y = t * 0.0018;
      starLayers[1].rotation.y = -t * 0.0009;
    },
  };
}
