/** tools/diag_film_time.mjs — 直接验证 renderFrame 在各时间的产出 */
import { installDom, makeCtx } from './harness.mjs';
installDom();

const els = new Map();
function mkEl(id, tag = 'div') {
  const e = { id, tagName: tag, style: {}, dataset: {}, _l: {}, textContent: '',
    innerHTML: '', value: '0', className: '',
    classList: { add() {}, remove() {}, toggle() {} }, focus() {},
    addEventListener() {}, };
  if (tag === 'canvas') {
    e.width = 300; e.height = 150;
    e.getContext = function () { if (!this._c) this._c = makeCtx(this.width, this.height); return this._c; };
  }
  els.set(id, e); return e;
}
['cv', 'play', 'seek', 'tc', 'diag'].forEach((id) =>
  mkEl(id, id === 'cv' ? 'canvas' : (id === 'play' ? 'button' : 'input')));
globalThis.document = {
  getElementById: (id) => els.get(id) || null,
  createElement: (tag) => mkEl(`_t${Math.random()}`, tag),
  querySelectorAll: () => [],
  fonts: { add() {}, ready: Promise.resolve() },
  addEventListener() {},
};
globalThis.FontFace = class { async load() { return this; } };
globalThis.window = { addEventListener() {} };
globalThis.Audio = function () {
  return { src: '', duration: 214.92, readyState: 4, ended: false, paused: true,
    currentTime: 0, _l: {}, addEventListener() {}, removeEventListener() {},
    load() {}, play() { return Promise.resolve(); }, pause() {} };
};
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

const app = await import('../js/app.js');
await new Promise((r) => setTimeout(r, 50));

const ctx = els.get('cv').getContext();
console.log('=== renderFrame 在各时间的产出 ===');
const times = [0.5, 1.5, 1.95, 2.0, 2.05, 2.5, 3.0, 3.05, 3.5, 4.0, 4.4, 30, 60, 215];
let prev = '';
for (const t of times) {
  ctx._T.length = 0;
  let err = null;
  try { app.renderFrame(t, ctx); } catch (e) { err = e; }
  const n = ctx._T.length;
  const tr = ctx._T.join('|');
  const head = ctx._T.slice(0, 3).join(',');
  console.log(`  t=${String(t).padStart(6)}s  ${String(n).padStart(6)} 调用  `
    + `${err ? '★ ' + err.message.slice(0, 40) : (tr === prev ? '与前一时刻相同' : '画面不同')}`);
  if (err) console.log('      ' + err.stack.split('\n').slice(1, 4).join('\n      '));
  prev = tr;
}
