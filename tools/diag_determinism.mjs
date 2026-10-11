/** tools/diag_determinism.mjs — 定位「同 t 两次绘制轨迹不同」的分歧点 */
import { strict as assert } from 'node:assert';

function makeStubCtx(w = 1920, h = 1080) {
  const trace = [];
  const r = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
  const ctx = {
    canvas: { width: w, height: h }, trace,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    textBaseline: 'alphabetic', textAlign: 'left', filter: 'none',
    imageSmoothingEnabled: true, lineCap: 'butt',
    save() { trace.push(['save', this.font, this.fillStyle]); },
    restore() { trace.push(['restore']); },
    setTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() {}, closePath() {},
    moveTo(x, y) { trace.push(['M', r(x), r(y)]); },
    lineTo(x, y) { trace.push(['L', r(x), r(y)]); },
    arc(x, y, rr, a, b) { trace.push(['A', r(x), r(y), r(rr)]); },
    rect() {}, fillRect(x, y, a, b) { trace.push(['FR', r(x), r(y), r(a), r(b)]); },
    strokeRect() {},
    fillText(s, x, y) { trace.push(['T', s, r(x), r(y), this.fillStyle, this.font]); },
    strokeText() {},
    stroke() { trace.push(['stroke', this.strokeStyle, r(this.lineWidth)]); },
    fill() { trace.push(['fill', this.fillStyle]); },
    measureText(s) { return { width: s.length * (parseFloat(this.font) || 16) * 0.62 }; },
    createImageData(a, b) { return { data: new Uint8ClampedArray(a * b * 4) }; },
    putImageData() {}, getImageData(x, y, a, b) {
      const d = new Uint8ClampedArray(a * b * 4); d.fill(255); return { data: d };
    },
    createPattern() { return {}; }, drawImage() {}, setLineDash() {},
  };
  return ctx;
}

globalThis.document = { createElement: (t) => (t === 'canvas'
  ? { width: 1, height: 1, _c: null,
      getContext() { if (!this._c) this._c = makeStubCtx(this.width, this.height); return this._c; } }
  : {}), fonts: { add() {} } };
globalThis.FontFace = class { async load() { return this; } };

const { SHOTS } = await import('../js/shots.js');
const shot = SHOTS.find((s) => s.id === 'SHOT_006');

const draw = (t) => {
  const c = makeStubCtx();
  shot.draw(c, t, 1, [0.16, 0.6215]);
  return c.trace.map((x) => JSON.stringify(x));
};

const A = draw(0.5), B = draw(0.5);
console.log(`轨迹长度: A=${A.length}  B=${B.length}`);
const n = Math.min(A.length, B.length);
let diff = -1;
for (let i = 0; i < n; i++) if (A[i] !== B[i]) { diff = i; break; }
if (diff < 0 && A.length === B.length) {
  console.log('两条轨迹完全相同');
} else {
  console.log(`首个分歧在第 ${diff} 条调用:`);
  for (let i = Math.max(0, diff - 2); i < Math.min(n, diff + 4); i++) {
    console.log(`  [${i}] A=${A[i]}`);
    console.log(`       B=${B[i]}`);
  }
}
console.log('\n--- 场景内部状态 ---');
console.log('shot._c.chars 长度:', shot._c && shot._c.chars ? shot._c.chars.length : 'null');
console.log('shot._c.beats:', shot._c && shot._c.beats);
console.log('shot._c.beatParticles 长度:', shot._c && shot._c.beatParticles
  ? shot._c.beatParticles.length : 'null');
