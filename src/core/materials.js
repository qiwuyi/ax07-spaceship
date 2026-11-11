import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * 程序化表面细节：一块 canvas 同时产出 颜色细节 / 粗糙度 / 凹凸三张图。
 * 全是灰度，材质本身的 color 决定各零件基色，因此可以全舰复用。
 * ------------------------------------------------------------------ */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildSurfaceMaps(size = 1024) {
  const rnd = seededRandom(20261110);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')];
  };

  const [cc, albedo] = make();
  const [rc, rough] = make();
  const [bc, bump] = make();

  albedo.fillStyle = '#c3cad2'; albedo.fillRect(0, 0, size, size);
  rough.fillStyle = '#c4c4c4'; rough.fillRect(0, 0, size, size);
  bump.fillStyle = '#808080'; bump.fillRect(0, 0, size, size);

  // 大块污渍 / 使用痕迹
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size, y = rnd() * size, r = 12 + rnd() * 110;
    const g = albedo.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.45;
    g.addColorStop(0, dark ? 'rgba(70,78,88,0.10)' : 'rgba(255,255,255,0.09)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    albedo.fillStyle = g; albedo.beginPath(); albedo.arc(x, y, r, 0, Math.PI * 2); albedo.fill();
  }

  // 面板分格线：横向 + 纵向，带高光边
  const drawSeam = (ctx, x1, y1, x2, y2, w, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const seams = [];
  for (let i = 0; i < 9; i++) seams.push(['h', Math.floor((i + 0.5) * size / 9) + (rnd() - 0.5) * 24]);
  for (let i = 0; i < 7; i++) seams.push(['v', Math.floor((i + 0.5) * size / 7) + (rnd() - 0.5) * 30]);

  for (const [dir, pos] of seams) {
    const x1 = dir === 'h' ? 0 : pos, y1 = dir === 'h' ? pos : 0;
    const x2 = dir === 'h' ? size : pos, y2 = dir === 'h' ? pos : size;
    drawSeam(albedo, x1, y1, x2, y2, 3, 'rgba(38,44,52,0.42)');
    drawSeam(albedo, x1 + (dir === 'v' ? 2 : 0), y1 + (dir === 'h' ? 2 : 0),
      x2 + (dir === 'v' ? 2 : 0), y2 + (dir === 'h' ? 2 : 0), 1.5, 'rgba(255,255,255,0.30)');
    drawSeam(bump, x1, y1, x2, y2, 4, 'rgba(20,20,20,0.95)');
    drawSeam(rough, x1, y1, x2, y2, 5, 'rgba(240,240,240,0.55)');
  }

  // 铆钉阵列
  for (const [dir, pos] of seams) {
    for (let t = 12; t < size; t += 26) {
      const x = dir === 'h' ? t : pos, y = dir === 'h' ? pos : t;
      albedo.fillStyle = 'rgba(45,52,60,0.40)';
      albedo.beginPath(); albedo.arc(x, y, 1.8, 0, Math.PI * 2); albedo.fill();
      albedo.fillStyle = 'rgba(255,255,255,0.45)';
      albedo.beginPath(); albedo.arc(x - 0.6, y - 0.6, 0.9, 0, Math.PI * 2); albedo.fill();
      bump.fillStyle = '#b8b8b8';
      bump.beginPath(); bump.arc(x, y, 2.2, 0, Math.PI * 2); bump.fill();
    }
  }

  // 细划痕
  for (let i = 0; i < 420; i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = 8 + rnd() * 90, ang = (rnd() - 0.5) * 0.5 + (rnd() > 0.5 ? Math.PI / 2 : 0);
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    drawSeam(albedo, x, y, x + dx, y + dy, 0.8 + rnd(), rnd() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(40,46,54,0.20)');
    drawSeam(rough, x, y, x + dx, y + dy, 1, 'rgba(255,255,255,0.30)');
  }

  // 编号 / 警示标识
  albedo.save();
  albedo.font = 'bold 54px "Arial Narrow", Arial, sans-serif';
  albedo.fillStyle = 'rgba(50,58,68,0.42)';
  albedo.fillText('AX-07', 60, 118);
  albedo.font = 'bold 24px Arial, sans-serif';
  albedo.fillText('HULL / TITANIUM ALLOY', 62, 152);
  albedo.restore();
  for (let i = 0; i < 14; i++) {
    albedo.save();
    albedo.translate(760 + i * 15, 880);
    albedo.rotate(-0.5);
    albedo.fillStyle = i % 2 ? 'rgba(52,58,68,0.50)' : 'rgba(235,140,50,0.34)';
    albedo.fillRect(0, 0, 7, 46);
    albedo.restore();
  }

  const tex = (canvas, srgb = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {
    detail: tex(cc, true),
    rough: tex(rc),
    bump: tex(bc),
  };
}

let cache = null;
export function surfaceMaps() {
  if (!cache) cache = buildSurfaceMaps();
  return cache;
}

function physical(color, opts = {}) {
  const m = surfaceMaps();
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.88,
    roughness: 0.38,
    map: opts.noMap ? null : m.detail,
    roughnessMap: opts.noMap ? null : m.rough,
    bumpMap: opts.noMap ? null : m.bump,
    bumpScale: opts.bumpScale ?? 0.012,
    clearcoat: opts.clearcoat ?? 0.28,
    clearcoatRoughness: 0.24,
    envMapIntensity: opts.env ?? 1.15,
    ...opts.extra,
  });
}

export function createMaterials() {
  const M = {};
  M.hull      = physical(0x8d98a6, { roughness: 0.36, clearcoat: 0.30 });
  M.armor     = physical(0x4d5763, { roughness: 0.44, clearcoat: 0.18 });
  M.darkArmor = physical(0x1e242c, { roughness: 0.52, clearcoat: 0.10 });
  M.plate     = physical(0xb9c2cd, { roughness: 0.32, clearcoat: 0.38 });
  M.engine    = physical(0x606975, { roughness: 0.30, env: 1.35 });
  M.heat      = physical(0x171b21, { roughness: 0.78, metalness: 0.55, clearcoat: 0 });
  M.inner     = new THREE.MeshStandardMaterial({ color: 0x0d1117, metalness: 0.9, roughness: 0.55, side: THREE.DoubleSide });
  M.frame     = physical(0x333b45, { roughness: 0.36 });
  M.gold      = physical(0xc7a15a, { roughness: 0.28, metalness: 1, env: 1.6 });

  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0x0d3247,
    metalness: 0.0,
    roughness: 0.06,
    transmission: 0.82,
    thickness: 0.55,
    ior: 1.46,
    transparent: true,
    opacity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.2,
    side: THREE.DoubleSide,
  });

  const glow = (color, intensity = 2.4) => new THREE.MeshStandardMaterial({
    color: 0x0a0f14, emissive: color, emissiveIntensity: intensity,
    metalness: 0.2, roughness: 0.3, toneMapped: true,
  });
  M.cyanGlow   = glow(0x39d8ff, 2.2);
  M.blueGlow   = glow(0x2f7dff, 1.8);
  M.amberGlow  = glow(0xffa03a, 1.7);
  M.redGlow    = glow(0xff4d4d, 1.6);
  M.whiteGlow  = glow(0xdff4ff, 2.0);
  M.panelGlow  = glow(0x1c6f92, 1.1);

  M.stripe = new THREE.MeshStandardMaterial({ color: 0xe98a2b, metalness: 0.35, roughness: 0.55 });
  return M;
}
