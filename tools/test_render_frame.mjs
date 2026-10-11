/**
 * tools/test_render_frame.mjs — 直接驱动 renderFrame，验证「不同时间 → 不同画面」
 *
 * 绕开渲染循环与音频时钟，只测渲染函数本身。
 */
function makeCtx(w, h) {
  const T = [];
  const r = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  return {
    canvas: { width: w, height: h }, _T: T,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    textBaseline: 'alphabetic', textAlign: 'left', filter: 'none',
    imageSmoothingEnabled: true, lineCap: 'butt',
    save() { T.push('save'); }, restore() { T.push('restore'); },
    setTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() { T.push('bp'); }, closePath() {},
    moveTo(x, y) { T.push(`M${r(x)},${r(y)}`); },
    lineTo(x, y) { T.push(`L${r(x)},${r(y)}`); },
    arc(x, y, rr) { T.push(`A${r(x)},${r(y)},${r(rr)}`); },
    ellipse(x, y, rx, ry) { T.push(`E${r(x)},${r(y)},${r(rx)},${r(ry)}`); },
    rect(x, y, a, b) { T.push(`R${r(x)},${r(y)}`); },
    clearRect() {}, fillRect(x, y, a, b) { T.push(`FR${r(x)},${r(y)}`); },
    strokeRect() {},
    fillText(s, x, y) { T.push(`T"${s}"@${r(x)},${r(y)}`); },
    strokeText() {}, stroke() { T.push('s'); }, fill() { T.push('f'); },
    measureText(s) {
      const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16])[1]);
      return { width: s.length * px * 0.6, actualBoundingBoxAscent: px * 0.75,
               actualBoundingBoxDescent: px * 0.22 };
    },
    createImageData(a, b) { return { data: new Uint8ClampedArray(a * b * 4) }; },
    putImageData() {},
    getImageData(x, y, a, b) {
      const n = Math.max(1, Math.floor(a) * Math.floor(b));
      const d = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i += 3) { d[i * 4] = 255; d[i * 4 + 3] = 255; }
      return { data: d, width: a, height: b };
    },
    createPattern() { return {}; }, drawImage() {}, setLineDash() {},
  };
}

const els = new Map();
function mkEl(id, tag = 'div') {
  const e = { id, tagName: tag, style: {}, dataset: {}, _l: {}, textContent: '',
    innerHTML: '', value: '0', className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(ev, fn) { (this._l[ev] ||= []).push(fn); } };
  if (tag === 'canvas') {
    e.width = 300; e.height = 150;
    e.getContext = function () { if (!this._c) this._c = makeCtx(this.width, this.height); return this._c; };
    e.toBlob = (cb) => cb({});
  }
  els.set(id, e);
  return e;
}
['play', 'seek', 'tCur', 'tTotal', 'nowShot', 'fpsCap', 'audioState', 'beatState',
 'fontState', 'playState', 'coverBar', 'coverState', 'exportBtn', 'exportCancel',
 'exportPlayable', 'expT0', 'expT1', 'expRes', 'exportLog', 'exportLink',
 'audioFile', 'cv', 'stage'].forEach((id) => mkEl(id, id === 'cv' ? 'canvas' : 'div'));

globalThis.document = {
  getElementById: (id) => els.get(id) || null,
  createElement: (tag) => mkEl(`_t${Math.random()}`, tag),
  querySelectorAll: () => [],
  fonts: { add() {}, ready: Promise.resolve() },
  addEventListener() {},
};
globalThis.FontFace = class { async load() { return this; } };
globalThis.window = { addEventListener() {} };
const audioStub = {
  src: '', currentTime: 0, duration: 211.9837, ended: false, paused: true, _l: {},
  addEventListener(e, f) { (this._l[e] ||= []).push(f); },
  load() { setTimeout(() => (this._l.loadedmetadata || []).forEach((f) => f()), 0); },
  play() { return Promise.resolve(); }, pause() {},
};
globalThis.Audio = function () { return audioStub; };
globalThis.fetch = async (url) => {
  if (String(url).includes('beats.json')) {
    const beats = [];
    for (let t = 0.16; t < 212; t += 0.461538) beats.push(Math.round(t * 1e4) / 1e4);
    return { ok: true, status: 200, json: async () => ({ beat_times: beats }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = { now: () => 0 };
globalThis.confirm = () => true;
globalThis.URL = { createObjectURL: () => 'x' };

const app = await import('../js/app.js');
await new Promise((r) => setTimeout(r, 40));

const canvas = els.get('cv');
const ctx = canvas.getContext();

console.log('=== 直接调用 renderFrame，检查不同时间是否产出不同画面 ===');
const times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.05, 3.5, 4.0, 4.4, 4.5, 5.0, 10, 60, 150, 211];
let prev = '', same = 0, empty = 0;
for (const t of times) {
  ctx._T.length = 0;
  let err = null;
  try { app.renderFrame(t, ctx); } catch (e) { err = e; }
  const n = ctx._T.length;
  const tr = ctx._T.join('|');
  const changed = tr !== prev;
  if (!changed && n > 0) same++;
  if (n === 0) empty++;
  console.log(`  t=${String(t).padStart(7)}s  调用 ${String(n).padStart(5)}  `
    + `${err ? '★ 抛错: ' + err.message.slice(0, 50) : (n === 0 ? '★ 无绘制' : (changed ? '画面不同' : '与前一时刻相同'))}`);
  prev = tr;
}
console.log(`\n空帧 ${empty} 个；相邻相同 ${same} 处`);
console.log(empty > 0 ? '★ 存在完全无绘制的时刻' : 'OK  每个时间点都有绘制');

// 同一时间重复渲染是否一致（确定性）
console.log('\n=== 确定性：同一时间重复渲染 ===');
let detFail = 0;
for (const t of [3.5, 4.0, 60, 150]) {
  ctx._T.length = 0; app.renderFrame(t, ctx);
  const a = ctx._T.join('|');
  ctx._T.length = 0; app.renderFrame(t, ctx);
  const b = ctx._T.join('|');
  if (a !== b) { detFail++; console.log(`  ★ t=${t} 两次不一致`); }
}
console.log(detFail === 0 ? '  OK  全部一致' : `  ★ ${detFail} 处不一致`);
