import * as THREE from 'three';
import { parts, partById } from './registry.js';

const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const GROUPS = ['结构', '驾驶', '气动', '推进', '武器', '航电'];
const GROUP_EN = { 结构: 'STRUCTURE', 驾驶: 'FLIGHT DECK', 气动: 'AERODYNAMIC', 推进: 'PROPULSION', 武器: 'ARMAMENT', 航电: 'AVIONICS' };

export function createUI({ state, apply, actions }) {
  const el = {
    loading: $('#loading'), loadingSub: $('#loadingSub'), fatal: $('#fatal'), fatalMsg: $('#fatalMsg'),
    explode: $('#btnExplode'), explodeText: $('#explodeText'), explodeIcon: $('#explodeIcon'),
    exhaust: $('#btnExhaust'), laser: $('#btnLaser'), spin: $('#btnSpin'), more: $('#btnMore'),
    partsPanel: $('#partsPanel'), partList: $('#partList'), partCount: $('#partCount'),
    partEmpty: $('#partEmpty'), partSearch: $('#partSearch'), closeParts: $('#btnCloseParts'),
    clearSearch: $('#btnClearSearch'),
    infoPanel: $('#infoPanel'), infoCat: $('#infoCat'), infoName: $('#infoName'),
    infoEn: $('#infoEn'), infoDesc: $('#infoDesc'), infoSpecs: $('#infoSpecs'),
    closeInfo: $('#btnCloseInfo'), focus: $('#btnFocus'),
    partsToggle: $('#btnParts'), mobilePartCount: $('#mobilePartCount'),
    settings: $('#settingsPop'), closeSettings: $('#btnCloseSettings'),
    swLabels: $('#swLabels'), swWire: $('#swWire'),
    rgBloom: $('#rgBloom'), bloomVal: $('#bloomVal'), rgExposure: $('#rgExposure'), exposureVal: $('#exposureVal'),
    reset: $('#btnReset'), shot: $('#btnShot'), full: $('#btnFull'),
    help: $('#helpModal'), helpBtn: $('#btnHelp'), closeHelp: $('#btnCloseHelp'), helpOk: $('#btnHelpOk'), helpCount: $('#helpCount'),
    toast: $('#toast'), hint: $('#hint'), sysStatus: $('#sysStatus'),
    tags: $('#tags'), leaders: $('#leaders'),
  };

  let ready = false;
  let toastTimer = null;
  let partsManuallyOpen = false;
  let partsDismissed = false;
  let search = '';
  const tagMap = new Map();
  const marked = parts.filter((p) => p.label);
  const projV = new THREE.Vector3();

  /* ---------- 结构清单 ---------- */
  function buildParts() {
    el.partCount.textContent = String(parts.length);
    el.mobilePartCount.textContent = String(parts.length);
    el.helpCount.textContent = String(parts.length);
    el.partList.innerHTML = '';
    const byGroup = new Map(GROUPS.map((g) => [g, []]));
    parts.forEach((p, i) => {
      const g = byGroup.get(p.category) || byGroup.get('结构');
      g.push({ p, idx: String(i + 1).padStart(2, '0') });
    });
    for (const g of GROUPS) {
      const items = byGroup.get(g);
      if (!items.length) continue;
      const label = document.createElement('div');
      label.className = 'group-label';
      label.dataset.group = g;
      label.textContent = g;
      el.partList.appendChild(label);
      for (const { p, idx } of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'part-item';
        b.dataset.id = p.id;
        b.innerHTML = `<span class="idx">${idx}</span><span class="nm"></span><span class="en"></span>`;
        b.querySelector('.nm').textContent = p.name;
        b.querySelector('.en').textContent = p.en;
        b.addEventListener('click', () => select(p.id));
        el.partList.appendChild(b);
      }
    }
    filterParts();
  }

  function filterParts() {
    const q = search.trim().toLowerCase();
    let shown = 0;
    const items = [...el.partList.querySelectorAll('.part-item')];
    for (const b of items) {
      const p = partById.get(b.dataset.id);
      const hit = !q || (p.name + ' ' + p.en + ' ' + p.id + ' ' + p.category).toLowerCase().includes(q);
      b.hidden = !hit;
      if (hit) shown++;
    }
    for (const l of el.partList.querySelectorAll('.group-label')) {
      let any = false, n = l.nextElementSibling;
      while (n && !n.classList.contains('group-label')) {
        if (n.classList.contains('part-item') && !n.hidden) any = true;
        n = n.nextElementSibling;
      }
      l.hidden = !any;
    }
    el.partEmpty.hidden = shown > 0;
  }

  /* ---------- 引线标注 ---------- */
  function buildTags() {
    marked.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'part-tag';
      btn.dataset.id = p.id;
      btn.innerHTML = `<span class="idx">${String(i + 1).padStart(2, '0')}</span><span class="txt"><b></b><small></small></span>`;
      btn.querySelector('b').textContent = p.name;
      btn.querySelector('small').textContent = p.en;
      btn.addEventListener('click', () => select(p.id));
      el.tags.appendChild(btn);
      const path = document.createElementNS(NS, 'path');
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '2.6');
      el.leaders.append(path, dot);
      tagMap.set(p.id, { btn, path, dot, w: 0 });
    });
  }

  function updateTags(camera, progress, selectedId) {
    const w = window.innerWidth, h = window.innerHeight;
    const mobile = w < 760;
    const visible = state.labels && progress > 0.24;
    const alpha = THREE.MathUtils.clamp((progress - 0.24) / 0.3, 0, 1);
    const candidates = [];
    if (visible) {
      let order = 0;
      for (const p of marked) {
        projV.copy(p.anchor).applyMatrix4(p.object.matrixWorld).project(camera);
        if (projV.z > 1 || projV.z < -1) continue;
        const sx = (projV.x * 0.5 + 0.5) * w;
        const sy = (-projV.y * 0.5 + 0.5) * h;
        if (sx < -60 || sx > w + 60 || sy < -40 || sy > h + 40) continue;
        const side = p.anchor.x < -0.4 ? -1 : p.anchor.x > 0.4 ? 1 : (order % 2 ? 1 : -1);
        candidates.push({ p, sx, sy, side });
        order++;
      }
    }
    // 移动端限制标注数量，选中项始终保留
    let list = candidates;
    if (mobile) {
      const sel = list.find((c) => c.p.id === selectedId);
      const rest = list.filter((c) => c !== sel).slice(0, 4);
      list = sel ? [sel, ...rest] : rest;
    }
    // 同侧标签做垂直避让
    for (const side of [-1, 1]) {
      const group = list.filter((c) => c.side === side).sort((a, b) => a.sy - b.sy);
      let last = -999;
      for (const c of group) {
        c.ly = Math.max(c.sy - 24, last + 48);
        last = c.ly;
      }
    }
    const shownIds = new Set(list.map((c) => c.p.id));
    for (const p of marked) {
      const t = tagMap.get(p.id);
      if (!shownIds.has(p.id)) {
        t.btn.style.display = 'none';
        t.path.setAttribute('opacity', '0');
        t.dot.setAttribute('opacity', '0');
        continue;
      }
      const c = list.find((x) => x.p.id === p.id);
      t.btn.style.display = 'flex';
      if (!t.w) t.w = t.btn.offsetWidth || 148;
      const lx = c.side > 0 ? c.sx + 58 : c.sx - 58 - t.w;
      const ly = c.ly;
      const leftBound = (!mobile && state.exploded) ? 312 : 8;
      const rightBound = (!mobile && state.selected) ? w - 340 : w - 8;
      const clampedX = THREE.MathUtils.clamp(lx, leftBound, Math.max(leftBound, rightBound - t.w));
      const clampedY = THREE.MathUtils.clamp(ly, 88, Math.max(88, h - 160));
      t.btn.style.opacity = String(alpha);
      t.btn.style.pointerEvents = alpha > 0.7 ? 'auto' : 'none';
      t.btn.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
      t.btn.classList.toggle('active', p.id === selectedId);
      const ex = c.side > 0 ? clampedX : clampedX + t.w;
      t.path.setAttribute('d', `M ${c.sx.toFixed(1)} ${c.sy.toFixed(1)} L ${(c.sx + c.side * 26).toFixed(1)} ${(c.sy - 18).toFixed(1)} L ${ex.toFixed(1)} ${(clampedY + 20).toFixed(1)}`);
      t.path.setAttribute('opacity', String(alpha * 0.9));
      t.dot.setAttribute('cx', c.sx.toFixed(1));
      t.dot.setAttribute('cy', c.sy.toFixed(1));
      t.dot.setAttribute('opacity', String(alpha));
    }
    el.leaders.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  /* ---------- 信息卡 ---------- */
  function showInfo(part) {
    if (!part) { el.infoPanel.hidden = true; return; }
    el.infoPanel.hidden = false;
    el.infoCat.textContent = `${part.category} / ${GROUP_EN[part.category] || part.category}`;
    el.infoName.textContent = part.name;
    el.infoEn.textContent = part.en;
    el.infoDesc.textContent = part.desc;
    el.infoSpecs.innerHTML = '';
    for (const [k, v] of part.specs) {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      row.append(dt, dd);
      el.infoSpecs.appendChild(row);
    }
    el.focus.disabled = false;
  }

  function select(id) {
    state.selected = actions.select(id);
    showInfo(state.selected ? partById.get(state.selected) : null);
    for (const b of el.partList.querySelectorAll('.part-item')) b.classList.toggle('active', b.dataset.id === state.selected);
    // 桌面端从标注/模型选中零件时把清单带出来；移动端保持画面完整
    if (state.selected && !partsManuallyOpen && window.innerWidth >= 760) {
      partsManuallyOpen = true;
      sync();
    }
  }

  /* ---------- 状态同步 ---------- */
  function sync() {
    el.explodeText.textContent = state.exploded ? '合拢复位' : '一键剖析';
    el.explodeIcon.querySelector('use').setAttribute('href', state.exploded ? '#i-assemble' : '#i-explode');
    el.exhaust.classList.toggle('is-on', state.exhaust);
    el.exhaust.setAttribute('aria-pressed', String(state.exhaust));
    el.laser.classList.toggle('is-on', state.laser);
    el.laser.setAttribute('aria-pressed', String(state.laser));
    el.spin.classList.toggle('is-on', state.spin);
    el.spin.setAttribute('aria-pressed', String(state.spin));
    el.swLabels.checked = state.labels;
    el.swWire.checked = state.wireframe;
    const mobile = window.innerWidth < 760;
    const panelOpen = partsManuallyOpen || (state.exploded && !mobile && !partsDismissed);
    el.partsPanel.classList.toggle('open', panelOpen);
    el.partsToggle.setAttribute('aria-expanded', String(panelOpen));
    el.sysStatus.textContent = state.exploded ? '剖析模式' : '系统在线';
    el.shot.disabled = !ready;
    el.shot.title = ready ? '导出当前画面为 PNG' : '场景仍在装配，请稍候';
  }

  function toast(msg) {
    el.toast.innerHTML = '<svg class="ic"><use href="#i-check"/></svg><span></span>';
    el.toast.querySelector('span').textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  function setLoading(text) { el.loadingSub.textContent = text; }
  function setReady() {
    ready = true;
    el.loading.classList.add('done');
    setTimeout(() => { el.loading.hidden = true; }, 360);
    sync();
  }
  function fail(msg) {
    el.loading.hidden = true;
    el.fatal.hidden = false;
    el.fatalMsg.textContent = msg;
  }

  /* ---------- 事件 ---------- */
  el.explode.addEventListener('click', () => {
    state.exploded = !state.exploded;
    if (state.exploded) { partsManuallyOpen = false; partsDismissed = false; }
    apply('exploded');
    sync();
    toast(state.exploded ? '已展开全舰结构，点击零件查看参数' : '结构已合拢复位');
  });
  el.exhaust.addEventListener('click', () => { state.exhaust = !state.exhaust; apply('exhaust'); sync(); });
  el.laser.addEventListener('click', () => {
    state.laser = !state.laser; apply('laser'); sync();
    toast(state.laser ? '激光武器已充能' : '激光武器已停火');
  });
  el.spin.addEventListener('click', () => { state.spin = !state.spin; apply('spin'); sync(); });

  el.more.addEventListener('click', () => {
    const open = el.settings.hidden;
    el.settings.hidden = !open;
    el.more.setAttribute('aria-expanded', String(open));
  });
  el.closeSettings.addEventListener('click', () => { el.settings.hidden = true; el.more.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('pointerdown', (e) => {
    if (!el.settings.hidden && !el.settings.contains(e.target) && !el.more.contains(e.target)) {
      el.settings.hidden = true; el.more.setAttribute('aria-expanded', 'false');
    }
  });

  el.partsToggle.addEventListener('click', () => {
    partsManuallyOpen = !partsManuallyOpen;
    partsDismissed = !partsManuallyOpen;
    sync();
  });
  el.closeParts.addEventListener('click', () => {
    partsManuallyOpen = false;
    partsDismissed = true;
    sync();
  });
  el.partSearch.addEventListener('input', (e) => { search = e.target.value; filterParts(); });
  el.clearSearch.addEventListener('click', () => { el.partSearch.value = ''; search = ''; filterParts(); el.partSearch.focus(); });
  el.closeInfo.addEventListener('click', () => select(null));
  el.focus.addEventListener('click', () => { actions.focus(); toast('镜头已聚焦所选零件'); });
  el.swLabels.addEventListener('change', (e) => { state.labels = e.target.checked; apply('labels'); });
  el.swWire.addEventListener('change', (e) => { state.wireframe = e.target.checked; apply('wireframe'); });
  el.rgBloom.addEventListener('input', (e) => {
    state.bloom = parseFloat(e.target.value); el.bloomVal.textContent = state.bloom.toFixed(2); apply('bloom');
  });
  el.rgExposure.addEventListener('input', (e) => {
    state.exposure = parseFloat(e.target.value); el.exposureVal.textContent = state.exposure.toFixed(2); apply('exposure');
  });
  el.reset.addEventListener('click', () => { actions.resetView(); toast('视角已重置'); });
  el.shot.addEventListener('click', () => actions.screenshot());
  el.full.addEventListener('click', () => actions.fullscreen());
  el.helpBtn.addEventListener('click', () => { el.help.hidden = false; });
  const closeHelp = () => { el.help.hidden = true; };
  el.closeHelp.addEventListener('click', closeHelp);
  el.helpOk.addEventListener('click', closeHelp);
  el.help.addEventListener('click', (e) => { if (e.target === el.help) closeHelp(); });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sync, 120);
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); el.explode.click(); }
    else if (k === '1') el.exhaust.click();
    else if (k === '2') el.laser.click();
    else if (k === '3') el.spin.click();
    else if (k === 'r') el.reset.click();
    else if (e.key === 'Escape') {
      if (!el.help.hidden) closeHelp();
      else if (!el.settings.hidden) { el.settings.hidden = true; el.more.setAttribute('aria-expanded', 'false'); }
      else if (state.selected) select(null);
    }
  });

  buildParts();
  buildTags();
  sync();

  return { buildParts, updateTags, select, sync, setReady, setLoading, fail, toast };
}
