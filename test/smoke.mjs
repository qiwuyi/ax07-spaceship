import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'test', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// 默认跑本地 file://；设置 LIVE_URL 可回归线上 GitHub Pages
const URL = process.env.LIVE_URL || ('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
const PREFIX = process.env.LIVE_URL ? 'live-' : '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log('TARGET', URL);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=1600,1000', '--hide-scrollbars',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text()); });
page.on('requestfailed', (r) => problems.push('REQUEST ' + r.url() + ' ' + r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) problems.push('HTTP ' + r.status() + ' ' + r.url()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__AX07, { timeout: 60000 });
await sleep(1600);

const boot = await page.evaluate(() => ({
  loadingHidden: document.getElementById('loading').hidden || document.getElementById('loading').classList.contains('done'),
  fatal: !document.getElementById('fatal').hidden,
  fatalMsg: document.getElementById('fatalMsg').textContent,
  partCount: document.getElementById('partCount').textContent,
  partItems: document.querySelectorAll('.part-item').length,
  tags: document.querySelectorAll('.part-tag').length,
  gl: !!document.getElementById('scene').getContext('webgl2'),
  btn: document.getElementById('explodeText').textContent,
}));
console.log('BOOT', JSON.stringify(boot));
await page.screenshot({ path: path.join(SHOTS, PREFIX + '01-assembled.png') });

// 一键剖析
await page.click('#btnExplode');
await sleep(2200);
const exploded = await page.evaluate(() => ({
  btn: document.getElementById('explodeText').textContent,
  panelOpen: document.getElementById('partsPanel').classList.contains('open'),
  visibleTags: [...document.querySelectorAll('.part-tag')].filter((t) => t.style.display !== 'none').length,
  leaders: document.querySelectorAll('#leaders path').length,
  status: document.getElementById('sysStatus').textContent,
}));
console.log('EXPLODED', JSON.stringify(exploded));
await page.screenshot({ path: path.join(SHOTS, PREFIX + '02-exploded.png') });

// 选中一个零件
await page.evaluate(() => document.querySelector('.part-item')?.click());
await sleep(600);
const selected = await page.evaluate(() => ({
  infoVisible: !document.getElementById('infoPanel').hidden,
  name: document.getElementById('infoName').textContent,
  specs: document.querySelectorAll('#infoSpecs div').length,
  activeItems: document.querySelectorAll('.part-item.active').length,
}));
console.log('SELECTED', JSON.stringify(selected));
await page.screenshot({ path: path.join(SHOTS, PREFIX + '03-selected.png') });

// 合拢态开火：验证整舰激光可见
await page.click('#btnExplode');
await sleep(1300);
await page.click('#btnLaser');
await sleep(1000);
const fx = await page.evaluate(() => ({
  laserOn: document.getElementById('btnLaser').getAttribute('aria-pressed'),
  exhaustOn: document.getElementById('btnExhaust').getAttribute('aria-pressed'),
  btn: document.getElementById('explodeText').textContent,
}));
console.log('FX', JSON.stringify(fx));
await page.screenshot({ path: path.join(SHOTS, PREFIX + '04-laser.png') });

// 剖析态开火：验证光束跟随炮塔
await page.click('#btnExplode');
await sleep(1300);
await page.screenshot({ path: path.join(SHOTS, PREFIX + '04b-laser-exploded.png') });

// 设置面板 + 搜索空态
await page.click('#btnMore');
await page.type('#partSearch', 'zzzz-not-exist');
await sleep(300);
const settings = await page.evaluate(() => ({
  settingsOpen: !document.getElementById('settingsPop').hidden,
  emptyVisible: !document.getElementById('partEmpty').hidden,
  shortcuts: document.querySelectorAll('.shortcuts li').length,
}));
console.log('SETTINGS', JSON.stringify(settings));
await page.screenshot({ path: path.join(SHOTS, PREFIX + '05-settings.png') });

// 移动端：用独立页面在窄视口直接加载，避免桌面动态 resize 的样式滞后
const m = await browser.newPage();
await m.bringToFront();
await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
m.on('pageerror', (e) => problems.push('MOBILE PAGEERROR ' + e.message));
m.on('console', (msg) => { if (msg.type() === 'error') problems.push('MOBILE CONSOLE ' + msg.text()); });
await m.goto(URL, { waitUntil: 'load' });
await m.waitForFunction(() => !!window.__AX07, { timeout: 60000 });
await sleep(900);
await m.click('#btnExplode');
await sleep(1400);
// 无头环境可能节流 rAF，手动推进一帧以验证标注投影与布局
await m.evaluate(() => {
  const A = window.__AX07;
  if (!A) return;
  A.exploder.update(0.016, performance.now() / 1000);
  A.ui.updateTags(A.stage.camera, A.exploder.progress, A.state.selected);
  A.stage.composer.render();
});
const mobile = await m.evaluate(() => {
  const d = document.querySelector('.dock');
  const s = getComputedStyle(d);
  const A = window.__AX07;
  return {
    dock: +d.getBoundingClientRect().width.toFixed(1),
    dockLeft: +d.getBoundingClientRect().left.toFixed(1),
    cssLeft: s.left, cssTransform: s.transform,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    progress: A ? +A.exploder.progress.toFixed(2) : null,
    exploded: A ? A.state.exploded : null,
    panelOpenByDefault: document.getElementById('partsPanel').classList.contains('open'),
    partsToggleVisible: getComputedStyle(document.getElementById('btnParts')).display !== 'none',
    tags: [...document.querySelectorAll('.part-tag')].filter((t) => t.style.display !== 'none').length,
  };
});
console.log('MOBILE', JSON.stringify(mobile));
await m.screenshot({ path: path.join(SHOTS, PREFIX + '06-mobile.png') });
await m.click('#btnParts');
await sleep(350);
const drawer = await m.evaluate(() => document.getElementById('partsPanel').classList.contains('open'));
console.log('MOBILE_DRAWER', JSON.stringify({ openAfterTap: drawer }));
await m.screenshot({ path: path.join(SHOTS, PREFIX + '07-mobile-drawer.png') });

console.log('PROBLEMS', JSON.stringify(problems, null, 2));
await browser.close();
if (problems.length || boot.fatal) process.exitCode = 1;
