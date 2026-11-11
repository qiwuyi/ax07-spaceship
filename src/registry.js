import * as THREE from 'three';

/**
 * 零件注册表：每个可剖析零件都是一棵独立的 Object3D 子树。
 * base    —— 装配位（初始局部坐标）
 * offset  —— 爆炸方向（相对 base 的位移向量）
 * spin    —— 爆炸时附加的轻微旋转，让拆解有"被取出"的感觉
 */
export const parts = [];
export const partById = new Map();

export function registerPart(def) {
  const item = {
    id: def.id,
    name: def.name,
    en: def.en || '',
    category: def.category || '结构',
    desc: def.desc || '',
    specs: def.specs || [],
    object: def.object,
    offset: new THREE.Vector3().fromArray(def.offset || [0, 0, 0]),
    spin: new THREE.Vector3().fromArray(def.spin || [0, 0, 0]),
    anchor: new THREE.Vector3().fromArray(def.anchor || [0, 0, 0]),
    label: def.label !== false,
    base: def.object ? def.object.position.clone() : new THREE.Vector3(),
    baseQuat: def.object ? def.object.quaternion.clone() : new THREE.Quaternion(),
  };
  parts.push(item);
  partById.set(item.id, item);
  if (def.object) def.object.userData.partId = item.id;
  return def.object;
}

export function eachPartMesh(root, fn) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    // 沿树向上找最近的零件归属
    let p = o;
    let owner = null;
    while (p) {
      if (p.userData && p.userData.partId) { owner = p.userData.partId; break; }
      p = p.parent;
    }
    fn(o, owner);
  });
}
