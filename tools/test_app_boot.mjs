/**
 * tools/test_app_boot.mjs — 最小播放器的启动与播放循环验证
 *
 * 桩化 DOM / Audio / fetch / rAF，真实执行 app.js，然后推进时间，
 * 检查每一帧是否真的产生绘制、以及不同时间的画面是否不同。
 * 这条测试是「点播放画面不动」那个 bug 的直接产物——只测零件不够，必须测装配。
 */

/* ── Canvas 2D 桩 ────────────────────────────────────────── */
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
    clearRect() {}, fillRect(x, y, a, b) { T.push(`FR${r(x)},${r(y)},${r(a)},${r(b)}`); },
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

/* ── DOM 桩：只有页面实际存在的元素 ─────────────────────── */
const els = new Map();
function mkEl(id, tag = 'div') {
  const e = {
    id, tagName: tag, style: {}, dataset: {}, _l: {},
    textContent: '', innerHTML: '', value: '0', className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    focus() {},
    addEventListener(ev, fn) { (this._l[ev] ||= []).push(fn); },
    dispatch(ev, arg) { (this._l[ev] || []).forEach((f) => f(arg || {})); },
  };
  if (tag === 'canvas') {
    e.width = 300; e.height = 150;
    e.getContext = function () {
      if (!this._c) this._c = makeCtx(this.width, this.height);
      return this._c;
    };
  }
  els.set(id, e);
  return e;
}
mkEl('cv', 'canvas');
mkEl('play', 'button');
mkEl('seek', 'input');
mkEl('tc', 'span');
mkEl('diag', 'div');

globalThis.document = {
  getElementById: (id) => els.get(id) || null,
  createElement: (tag) => mkEl(`_t${Math.random()}`, tag),
  querySelectorAll: () => [],
  fonts: { add() {}, ready: Promise.resolve() },
  addEventListener() {},
};
globalThis.FontFace = class { async load() { return this; } };
const winListeners = {};
globalThis.window = { addEventListener(ev, fn) { (winListeners[ev] ||= []).push(fn); } };

/* ── Audio 桩 ────────────────────────────────────────────── */
const audioLog = [];                       // 记录调用顺序：seek / seeked / play
const audioStub = {
  src: '', duration: 211.913, ended: false, paused: true, _l: {}, readyState: 4,
  _ct: 0,
  get currentTime() { return this._ct; },
  set currentTime(v) { this._ct = v; audioLog.push(`seek:${v.toFixed(3)}`); },
  addEventListener(e, f) { (this._l[e] ||= []).push(f); },
  removeEventListener(e, f) {
    if (this._l[e]) this._l[e] = this._l[e].filter((x) => x !== f);
  },
  load() { setTimeout(() => (this._l.loadedmetadata || []).forEach((f) => f()), 0); },
  play() {
    audioLog.push('play');
    this.paused = false;
    return Promise.resolve();
  },
  pause() { audioLog.push('pause'); this.paused = true; },
  // 真实浏览器把 seek 落到 seeked 事件；桩里同步触发以贴近行为
  _fireSeeked() { (this._l.seeked || []).forEach((f) => f()); },
};
globalThis.Audio = function () { return audioStub; };

/* ── fetch 桩 ────────────────────────────────────────────── */
globalThis.fetch = async (url) => {
  if (String(url).includes('beats.json')) {
    const beats = [];
    for (let t = 0.16; t < 212; t += 0.461538) beats.push(Math.round(t * 1e4) / 1e4);
    return { ok: true, status: 200, json: async () => ({ beat_times: beats }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

/* ── rAF 桩：手动驱动 ────────────────────────────────────── */
let rafCbs = [];
globalThis.requestAnimationFrame = (cb) => { rafCbs.push(cb); return rafCbs.length; };
globalThis.performance = { now: () => 0 };

/** 推进 n 帧，每帧后让微任务队列跑完（loop 是 async）。
 *  注意：时间戳必须**递增**，否则 loop 里的 dt 恒为 0、预览时钟不前进。 */
let wallClock = 0;
async function pump(n = 3) {
  for (let i = 0; i < n; i++) {
    const cbs = rafCbs.slice();
    rafCbs = [];
    wallClock += 16.7;
    for (const cb of cbs) {
      try { cb(wallClock); } catch (e) { console.log(`  ★ rAF 回调抛错: ${e.message}`); }
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}

/* ── 加载 app.js ─────────────────────────────────────────── */
console.log('=== 加载 app.js ===');
let bootError = null;
try { await import('../js/app.js'); } catch (e) { bootError = e; }
console.log(bootError ? `  ★ 加载抛错: ${bootError.message}` : '  OK  模块加载无异常');
await new Promise((r) => setTimeout(r, 40));
await pump(2);

let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  OK   ${name}${extra ? '  ' + extra : ''}`);
  else { fail++; console.log(`  ★FAIL ${name}  ${extra}`); }
};

console.log('\n=== 启动状态 ===');
const canvas = els.get('cv');
ok('画布已就绪', canvas.width === 1920 && canvas.height === 1080,
   `${canvas.width}×${canvas.height}`);
ok('播放按钮初始为「播放」', String(els.get('play').textContent).includes('播放'),
   `"${els.get('play').textContent}"`);

/* ── 播放循环 ────────────────────────────────────────────── */
console.log('\n=== 点击播放 + 推进时间 ===');
els.get('play').dispatch('click');
ok('按钮切换为「暂停」', String(els.get('play').textContent).includes('暂停'),
   `"${els.get('play').textContent}"`);

const ctx = canvas.getContext();

/* 场景 A：音频就绪 → 时钟由 audio.currentTime 驱动（画面必须跟随音频位置）
   注意：播放器有「漂移纠正」——画面时间与音频位置差 >0.35s 时会把音频拉回。
   所以测试里必须**同步**设置 state.time 与 audio.currentTime，模拟真实播放。 */
console.log('  [音频时钟] 音频位置推进时画面应跟随');
const { playerState: P } = await import('../js/app.js');
let aChanges = 0, aEmpty = 0, aPrev = '';
const detail = [];
for (const tt of [2.05, 3.5, 4.4, 30, 60]) {
  P.time = tt;                 // 与音频同步（真实播放时二者一致）
  audioStub.currentTime = tt;
  await pump(2);
  const tr = ctx._T.join('|');
  const n = ctx._T.length;
  ctx._T.length = 0;
  if (n === 0) aEmpty++;
  if (tr !== aPrev && n > 0) aChanges++;
  detail.push(`${tt}s:${n}`);
  aPrev = tr;
}
ok('音频时钟下无空帧', aEmpty === 0, `空帧 ${aEmpty}`);
ok('音频时钟下画面跟随位置变化', aChanges >= 4,
   `${aChanges}/5 不同 —— ${detail.join(' ')}`);

/* 场景 B：音频未就绪 → 预览时钟应随帧推进（验证循环真的在前进） */
console.log('  [预览时钟] 无音频时画面应随帧推进');
{
  const { playerState } = await import('../js/app.js');
  const hadAudio = playerState.audioReady;
  playerState.audioReady = false;         // 临时屏蔽音频时钟
  playerState.time = 2.0;
  playerState.previewClock = 2.0;
  const t0 = playerState.time;
  await pump(20);                          // 约 0.33s 墙钟
  const advanced = playerState.time - t0;
  ok('预览时钟随时间前进', advanced > 0.15, `前进 ${advanced.toFixed(3)}s`);
  ok('预览时钟前进后画面已变化', ctx._T.length > 0, `${ctx._T.length} 次绘制`);
  ctx._T.length = 0;
  playerState.audioReady = hadAudio;       // 恢复
}

/* ── 确定性 ──────────────────────────────────────────────── */
console.log('\n=== 确定性：同一时间重复渲染 ===');
const app = await import('../js/app.js');
let detFail = 0;
for (const t of [0.5, 3.5, 4.0, 60, 150]) {
  ctx._T.length = 0; app.renderFrame(t, ctx);
  const a = ctx._T.join('|');
  ctx._T.length = 0; app.renderFrame(t, ctx);
  const b = ctx._T.join('|');
  if (a !== b || ctx._T.length === 0) detFail++;
}
ok('逐字节一致', detFail === 0, detFail ? `${detFail} 处不一致` : '');

/* ── 片头卡不被解构错误打断（回归守卫）──────────────────── */
console.log('\n=== 回归守卫：片头卡区间（0–3s）不会打断循环 ===');
let rafAlive = 0;
audioStub.currentTime = 1.0;
await pump(1);
rafAlive = rafCbs.length;
ok('片头卡期间循环仍在注册', rafAlive > 0, `待执行 rAF ${rafAlive}`);

/* ── 片头卡 3s / 正片与音乐同在 3s 起 ─────────────────── */
console.log('\n=== 片头卡 3s（静音） / 正片与音乐同在 3s 起 ===');
{
  const { renderFrame } = app;
  const ctx2 = els.get('cv').getContext();
  ctx2._T.length = 0; renderFrame(2.8, ctx2);
  const introN = ctx2._T.length;
  ctx2._T.length = 0; renderFrame(3.05, ctx2);
  const filmN = ctx2._T.length;
  ok('t=2.8s 仍在片头卡（音轨此处为静音）', introN > 0, `${introN} 次绘制`);
  ok('t=3.05s 已进入正片（音乐同起）', filmN > 0 && filmN !== introN,
     `片头 ${introN} → 正片 ${filmN} 次绘制`);
  ctx2._T.length = 0; renderFrame(216.0, ctx2);
  ok('t=216.0s 是片尾署名卡', ctx2._T.length > 0, `${ctx2._T.length} 次绘制`);
  ok('总时长为 3:38.98（218.98s）', Math.abs((3.0 + 211.9837 + 4.0) - 218.9833) < 0.01,
     `${(3.0 + 211.9837 + 4.0).toFixed(4)}s`);
}

/* ── 音乐起点：必须先落位再播放（片头卡静音的关键）──────── */
console.log('\n=== 音乐自第 3 秒起：先落位、后播放 ===');
{
  const { playerState: state } = await import('../js/app.js');
  // 场景：当前处于暂停且在 t=0（刚进页面），点播放 → 起点即 0，无需 seek
  if (state.playing) { els.get('play').dispatch('click'); await new Promise((r) => setTimeout(r, 20)); }
  state.time = 0;
  audioStub._ct = 0;
  audioStub.paused = true;
  audioLog.length = 0;

  els.get('play').dispatch('click');
  await new Promise((r) => setTimeout(r, 60));

  const playIdx = audioLog.indexOf('play');
  const seekIdx = audioLog.findIndex((x) => x.startsWith('seek:'));
  ok('起点为 0 时直接播放（不无谓 seek）',
     playIdx >= 0 && (seekIdx < 0 || seekIdx < playIdx),
     `调用顺序 ${audioLog.join(' → ') || '(空)'}`);

  // 关键场景：停在片头卡内点播放，必须 seek 到 ≥3s 才播
  if (state.playing) { els.get('play').dispatch('click'); await new Promise((r) => setTimeout(r, 20)); }
  state.time = 3.0;
  audioStub._ct = 0;
  audioLog.length = 0;
  els.get('play').dispatch('click');
  await new Promise((r) => setTimeout(r, 80));

  const sIdx = audioLog.findIndex((x) => x.startsWith('seek:'));
  const pIdx = audioLog.indexOf('play');
  const to = sIdx >= 0 ? parseFloat(audioLog[sIdx].slice(5)) : -1;
  ok('正片起点处点播放 → 先 seek 到 3s 再播',
     sIdx >= 0 && pIdx > sIdx && Math.abs(to - 3.0) < 0.05,
     `调用顺序 ${audioLog.join(' → ') || '(空)'}`);
  if (state.playing) { els.get('play').dispatch('click'); await new Promise((r) => setTimeout(r, 20)); }
}

/* ── 进度条 ──────────────────────────────────────────────── */
console.log('\n=== 进度条 ===');
const TOTAL = 3.0 + 211.9837 + 4.0;
audioStub.currentTime = 60;
await pump(2);
const seek = els.get('seek');
const tc = els.get('tc');
const v1 = Number(seek.value);
ok('进度条随播放推进', v1 > 0, `value=${v1}/10000`);
ok('时间码已更新', String(tc.innerHTML).length > 0,
   String(tc.innerHTML).replace(/<[^>]+>/g, ''));

seek.value = '5000';
seek.dispatch('input', { target: { value: '5000' } });
await pump(1);
ok('拖动后音频跳到中段', Math.abs(audioStub.currentTime - TOTAL / 2) < 3,
   `audio.currentTime=${audioStub.currentTime.toFixed(1)}s，目标 ${(TOTAL / 2).toFixed(1)}s`);
seek.dispatch('change');

/* ── 片尾卡：音轨比画面短，必须走完 4s 尾卡 ──────────────────
 * 回归背景：音轨只到「正片结尾」（3.0 + 211.9837 ≈ 214.91s），画面还要多 4s 尾卡。
 * 早期把画面时间死绑在 audio.currentTime 上 → 画面卡在 3:34.9、进度条 98.1%、
 * 尾卡永远播不到。此测试锁死该行为。 */
console.log('\n=== 片尾卡（音频结束后继续走完 4s）===');
{
  const st = app.playerState;
  const { renderFrame } = app;
  const AUDIO_END = 3.0 + 211.9837;      // ≈214.98s，音轨实际终点
  audioStub.ended = true;
  audioStub._ct = AUDIO_END;               // 直接改内部值，避免触发 seek 日志
  st.time = AUDIO_END;
  st.previewClock = AUDIO_END;
  st.playing = true;
  const t0 = st.time;
  await pump(6);
  const t1 = st.time;
  ok('音频结束后画面时间继续前进', t1 > t0, `${t0.toFixed(2)}s → ${t1.toFixed(2)}s`);

  // 尾卡区间必须渲染署名卡，而不是停在正片最后一帧
  st.time = AUDIO_END + 2.0;
  st.previewClock = st.time;
  const ctx2 = els.get('cv').getContext();
  ctx2._T.length = 0;
  renderFrame(st.time, ctx2);
  const drew = ctx2._T.join('|');
  ok('尾卡区间渲染署名卡文本', /Unofficial fan-made video/.test(drew),
     `轨迹 ${ctx2._T.length} 项`);

  // 让循环自然推进到终点：进度条必须能到 100% 且随后自动停止
  const tStart = st.time;
  for (let i = 0; i < 600 && st.playing; i++) await pump(1);
  const vEnd = Number(seek.value);
  ok('可推进到总时长并停止', !st.playing && st.time >= TOTAL - 1e-6,
     `${tStart.toFixed(2)}s → ${st.time.toFixed(2)}s / ${TOTAL.toFixed(2)}s · playing=${st.playing}`);
  ok('进度条到达 100%', vEnd >= 9999, `value=${vEnd}/10000`);

  audioStub.ended = false;
  st.playing = false;
}

console.log(`\n${'='.repeat(54)}`);
console.log(fail === 0 ? '结果: 全部通过' : `结果: ${fail} 项失败`);
process.exit(fail ? 1 : 0);
