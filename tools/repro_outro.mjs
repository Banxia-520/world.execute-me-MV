/** web/tools/repro_outro.mjs — 端到端复现「播到 3:34 就停」
 *
 *  与 test_app_boot.mjs 的区别：这里的 Audio 桩**模拟真实浏览器约束** ——
 *    · duration = 音轨真实时长 214.936s
 *    · currentTime 只能落在 [0, duration]（seek 越界被钳制）
 *    · ended 由「播放到 duration」派生，且 ended 后 currentTime 冻结
 *  然后灌真实时间推进（非固定 dt），观察 state.time 能否走到 218.98s 并渲染片尾卡。
 */
import { readFileSync } from 'node:fs';

/* ── 极简 DOM 桩（与 test_app_boot 同思路）────────────────────── */
function makeCtx(w = 1920, h = 1080) {
  const T = [];
  return {
    canvas: { width: w, height: h }, _T: T,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', textBaseline: 'alphabetic',
    textAlign: 'left', filter: 'none', imageSmoothingEnabled: true, lineCap: 'butt',
    save() { T.push('sv'); }, restore() { T.push('rs'); },
    setTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() {}, closePath() {}, clip() { T.push('clip'); },
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {},
    arc() { T.push('arc'); }, ellipse() { T.push('ell'); },
    rect() {}, fill() { T.push('fill'); }, stroke() { T.push('str'); },
    fillRect() { T.push('FR'); }, clearRect() {},
    strokeRect() {}, fillText(s) { T.push(`T:${s}`); },
    measureText(s) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16];
      return { width: String(s).length * parseFloat(m[1]) * 0.6,
               actualBoundingBoxAscent: parseFloat(m[1]) * 0.72,
               actualBoundingBoxDescent: parseFloat(m[1]) * 0.22 };
    },
    getImageData(x, y, a, b) {
      const n = Math.max(1, Math.floor(a) * Math.floor(b));
      const d = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i++) { d[i * 4] = 255; d[i * 4 + 3] = 255; }
      return { data: d, width: a, height: b };
    },
    createLinearGradient() { return { addColorStop() {} }; },
    createImageData(w, h) {
      const n = Math.max(1, Math.floor(w) * Math.floor(h));
      return { data: new Uint8ClampedArray(n * 4), width: w, height: h };
    },
    putImageData() {},
    drawImage() {},
  };
}
const els = new Map();
function mkEl(id, tag) {
  const e = {
    id, tagName: tag, style: {}, dataset: {}, children: [], value: '0',
    textContent: '', innerHTML: '', className: '', width: 1920, height: 1080,
    _l: {},
    addEventListener(t, f) { (this._l[t] ||= []).push(f); },
    removeEventListener(t, f) { if (this._l[t]) this._l[t] = this._l[t].filter((x) => x !== f); },
    dispatch(t, ev = {}) { (this._l[t] || []).forEach((f) => f({ target: this, ...ev })); },
    appendChild(c) { this.children.push(c); return c; },
    getContext() { if (!this._c) this._c = makeCtx(this.width, this.height); return this._c; },
    setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, blur() {}, click() { this.dispatch('click'); },
  };
  els.set(id, e);
  return e;
}
globalThis.document = {
  getElementById: (id) => els.get(id) || null,
  createElement: (tag) => mkEl(`__${tag}_${Math.random()}`, tag),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: mkEl('body', 'body'), documentElement: mkEl('html', 'html'),
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add() {} },
  hidden: false, readyState: 'complete',
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.fetch = async () => { throw new Error('offline'); };
globalThis.performance = globalThis.performance || {};
let fakeNow = 0;
globalThis.performance.now = () => fakeNow;   // 每帧 16.67ms，让 loop 的 dt 真实
let rafCbs = [];
globalThis.requestAnimationFrame = (cb) => { rafCbs.push(cb); return rafCbs.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.FontFace = class { constructor() {} load() { return Promise.resolve(this); } };
globalThis.location = { href: 'http://127.0.0.1:8777/index.html', search: '' };
try { globalThis.navigator = { userAgent: 'node' }; } catch { /* Node 24 的 navigator 只有 getter */ }

/* 页面元素 */
for (const [id, tag] of [['cv', 'canvas'], ['play', 'button'], ['seek', 'input'],
                         ['tc', 'div'], ['diag', 'div'], ['title', 'h1'],
                         ['stage', 'div'], ['bar', 'div'], ['outro', 'div'],
                         ['export', 'button'], ['status', 'div'], ['loading', 'div']]) {
  mkEl(id, tag);
}

/* ── 真实行为的 Audio 桩 ─────────────────────────────────────── */
const DURATION = 218.91;                     // 音轨真实媒体时长（mdhd）
const log = [];
class RealAudio {
  constructor() {
    this._ct = 0; this.paused = true; this.ended = false;
    this.duration = DURATION; this.readyState = 4; this.preload = 'metadata';
    this.src = ''; this._l = {}; this.volume = 1; this.currentTimeSet = [];
  }
  get currentTime() { return this._ct; }
  set currentTime(v) {
    // 浏览器：seek 越界会被钳制到 [0, duration]；到末尾后 ended 置位
    const c = Math.max(0, Math.min(DURATION, v));
    this.currentTimeSet.push([v, c]);
    log.push(`seek:${v.toFixed(3)}→${c.toFixed(3)}${Math.abs(v - c) > 1e-6 ? '(钳制)' : ''}`);
    this._ct = c;
    this._endedNow = c >= DURATION - 1e-6;
    queueMicrotask(() => { this._l.seeked?.forEach((f) => f()); });
  }
  addEventListener(t, f) { (this._l[t] ||= []).push(f); }
  removeEventListener(t, f) { if (this._l[t]) this._l[t] = this._l[t].filter((x) => x !== f); }
  load() { queueMicrotask(() => this._l.loadedmetadata?.forEach((f) => f())); }
  play() {
    log.push('play'); this.paused = false;
    if (this._ct >= DURATION - 1e-6) this.ended = true;
    queueMicrotask(() => this._l.play?.forEach((f) => f()));
    return Promise.resolve();
  }
  pause() { log.push('pause'); this.paused = true; }
  /** 由测试驱动：把音频推进 dt 秒 */
  advance(dt) {
    if (this.paused) return;
    this._ct = Math.min(DURATION, this._ct + dt);
    if (this._ct >= DURATION - 1e-6 && !this.ended && !globalThis.__NO_ENDED) {
      this.ended = true;
      log.push('ended-event');
      queueMicrotask(() => this._l.ended?.forEach((f) => f()));
    }
  }
}
const audioStub = new RealAudio();
globalThis.Audio = function () { return audioStub; };

/* ── 载入 app ────────────────────────────────────────────────── */
const app = await import('../js/app.js');
const { playerState: st, renderFrame } = app;

const TOTAL = 3.0 + 211.9837 + 4.0;
const FILM_END = 3.0 + 211.9837;
console.log('=== 事实 ===');
console.log(`  音轨真实时长 ${DURATION}s`);
console.log(`  正片结束     ${FILM_END.toFixed(4)}s`);
console.log(`  总时长       ${TOTAL.toFixed(4)}s`);
console.log(`  → 音轨比正片结束早 ${(FILM_END - DURATION).toFixed(4)}s；尾卡在 ${FILM_END.toFixed(2)}–${TOTAL.toFixed(2)}s`);

const cv = els.get('cv');
const pump = async (n) => {
  for (let i = 0; i < n; i++) {
    fakeNow += 1000 / 60;                       // 每帧推进 16.67ms（真实循环的 dt 来源）
    const c = rafCbs; rafCbs = [];
    c.forEach((f) => f(fakeNow));
    await Promise.resolve();
  }
};

/* 等待元数据 */
audioStub.load();
await new Promise((r) => setTimeout(r, 30));
console.log(`\n  audioReady = ${st.audioReady}`);

/* 从正片末段开始播（模拟用户已播到 3:30） */
st.time = 210.0;
st.previewClock = 210.0;
st.playing = true;
audioStub._ct = 210.0;
audioStub.paused = false;
log.length = 0;

console.log('\n=== 端到端播放（每次 1/60s）===');
console.log('  播放时刻    镜头/相位           audio.currentTime  ended  playing');
let shown = 0;
for (let i = 0; i < 600; i++) {
  audioStub.advance(1 / 60);
  await pump(1);
  if (i % 60 === 0 || (st.time > FILM_END - 0.2 && st.time < FILM_END + 0.4)) {
    const phase = st.time < FILM_END ? 'film' : 'OUTRO';
    if (shown++ < 22) {
      console.log(`  ${st.time.toFixed(2).padStart(9)}  ${phase.padEnd(16)}  ` +
                  `${audioStub.currentTime.toFixed(3).padStart(12)}  ` +
                  `${String(audioStub.ended).padEnd(5)}  ${st.playing}`);
    }
  }
  if (!st.playing) { console.log(`  → 播放循环在 ${st.time.toFixed(3)}s 停止（playing=false）`); break; }
}

console.log(`\n  最终 state.time = ${st.time.toFixed(4)}s / 总时长 ${TOTAL.toFixed(4)}s`);
console.log(`  到达尾卡（≥${FILM_END.toFixed(3)}s）: ${st.time >= FILM_END ? '是 ✅' : '否 ★'}`);
console.log(`  到达总时长（≥${TOTAL.toFixed(3)}s）: ${st.time >= TOTAL - 1e-6 ? '是 ✅' : '否 ★'}`);

const seekEl = els.get('seek');
console.log(`  进度条 value = ${seekEl.value}/10000  (${(Number(seekEl.value) / 100).toFixed(2)}%)`);

const clamps = audioStub.currentTimeSet.filter(([a, b]) => Math.abs(a - b) > 1e-6);
console.log(`\n  音频 seek 调用 ${audioStub.currentTimeSet.length} 次，其中被钳制 ${clamps.length} 次`);
if (clamps.length) console.log(`    例: ${clamps.slice(0, 4).map(([a, b]) => `${a.toFixed(2)}→${b.toFixed(2)}`).join('  ')}`);

const ctx = cv.getContext();
ctx._T.length = 0;
renderFrame(FILM_END + 2.0, ctx);
const drew = ctx._T.join('|');
console.log(`\n  尾卡区间渲染: ${/Unofficial fan-made video/.test(drew) ? '署名卡 ✅' : '★ 非署名卡'}  (${ctx._T.length} 项)`);

const evts = log.filter((x) => x === 'ended-event' || x.startsWith('pause') || x.startsWith('play'));
console.log(`  音频事件: ${evts.join(', ') || '(无)'}`);
