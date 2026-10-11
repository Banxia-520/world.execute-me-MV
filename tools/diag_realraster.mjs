/** web/tools/diag_realraster.mjs — 用「真实字形形状」的软件栅格器复现浏览器路径
 *
 *  背景：harness 的 `getImageData` 返回棋盘格、`measureText` 走预计算表，
 *  因此 Node 侧的自验**测不到** ch10 的点阵采样路径
 *  （`_glyphMask` / `_sampleFill` / `_sampleOutline` / `_loveLayout`）。
 *
 *  本脚本把 `document.createElement('canvas')` 换成能真画字形的实现：
 *    · `fillText`  → 在当前字形位置登记一个「墨迹矩形 + 笔画中空」的简化字形
 *    · `getImageData` → 按已登记字形逐像素产出 alpha
 *  这样 `_sampleFill` / `_sampleOutline` 会拿到**非棋盘格**的数据，
 *  可检验真实字形下点集是否非空、包围盒是否合理。
 */
import { installDom } from './harness.mjs';
import { loadBeats } from './paths.mjs';

installDom();

/** 极简软件字形：把每个字符当作「粗体方块字」——笔画宽度约 18%、内部中空 */
function glyphPixels(ch, x, y, px) {
  const W = Math.round(px * 0.62), H = Math.round(px * 0.72);
  const out = [];
  const sw = Math.max(2, Math.round(px * 0.18));
  const x0 = Math.round(x), y0 = Math.round(y - H);
  if (ch === ' ') return out;
  // 外框
  for (let i = 0; i < W; i++) {
    for (let t = 0; t < sw; t++) {
      out.push([x0 + i, y0 + t], [x0 + i, y0 + H - 1 - t]);
    }
  }
  for (let j = 0; j < H; j++) {
    for (let t = 0; t < sw; t++) {
      out.push([x0 + t, y0 + j], [x0 + W - 1 - t, y0 + j]);
    }
  }
  // 中竖（让 L/O/V/E 有内部结构）
  for (let j = Math.round(H * 0.25); j < H; j++) {
    for (let t = 0; t < sw; t++) out.push([x0 + Math.round(W / 2) + t, y0 + j]);
  }
  return out;
}

const offscreen = [];
const OrigCreate = globalThis.document.createElement.bind(globalThis.document);
globalThis.document.createElement = function (tag) {
  if (String(tag).toLowerCase() !== 'canvas') return OrigCreate(tag);
  const el = { width: 300, height: 150, _ink: [], _font: '' };
  const ctx = {
    canvas: el,
    font: '',
    textBaseline: 'alphabetic',
    textAlign: 'left',
    fillStyle: '#fff',
    getContext() { return ctx; },
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    measureText(s) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16];
      return { width: String(s).length * parseFloat(m[1]) * 0.62,
               actualBoundingBoxAscent: parseFloat(m[1]) * 0.72,
               actualBoundingBoxDescent: 0 };
    },
    fillText(s, x, y) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16];
      const px = parseFloat(m[1]);
      let cx = x;
      for (const ch of String(s)) {
        el._ink.push(...glyphPixels(ch, cx, y, px));
        cx += px * 0.62;
      }
    },
    getImageData(_x, _y, w, h) {
      const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
      const d = new Uint8ClampedArray(W * H * 4);
      for (const [ix, iy] of el._ink) {
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const i = (iy * W + ix) * 4;
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
      }
      return { data: d, width: W, height: H };
    },
  };
  el.getContext = () => ctx;
  offscreen.push(el);
  return el;
};

const { pilFont } = await import('../js/canvas.js');
const { _geom, CH10_SHOTS } = await import('../js/ch10.js');

console.log('=== 真实字形栅格下的点阵采样 ===');
const f = pilFont('Inter Bold', 330, 1);
console.log(`  字宽 'LOVE' = ${f.getlength('LOVE').toFixed(1)}px   asc=${f.asc.toFixed(1)}`);

for (const [mode, step, label] of [['fill', 3, 'LOVE fill step=3'], ['outline', 2, 'LOVE outline step=2']]) {
  const lay = _geom.loveLayout(f, 0.58 * 1920, 170.0, 960, 0.52 * 1080, 1, mode, step);
  const n = lay.all.length;
  if (!n) { console.log(`  ★ ${label}: 点集为空！`); continue; }
  const xs = lay.all.map((p) => p[0]), ys = lay.all.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  console.log(`  OK ${label}: ${n} 点 · 每字母 ` +
    Object.keys(lay.per).map((k) => `${k}=${lay.per[k].length}`).join(' ') +
    ` · 包围盒 ${w.toFixed(0)}×${h.toFixed(0)}px`);
}

console.log('\n=== 文本 fill 采样 ===');
const p = _geom.sampleTextFill('LOVE', f, 1, 4, 100, 200);
console.log(`  OK 点数 ${p.length}` + (p.length ? ` · x ${Math.min(...p.map((q) => q[0])).toFixed(0)}~${Math.max(...p.map((q) => q[0])).toFixed(0)}` : ''));

console.log('\n=== 依赖真实像素的镜头全时段绘制 ===');
const fs = await import('node:fs');
const beats = loadBeats();
const H2 = await import('./harness.mjs');
for (const id of ['SHOT_178', 'SHOT_179', 'SHOT_182', 'SHOT_183', 'SHOT_184',
                  'SHOT_185', 'SHOT_186']) {
  const s = CH10_SHOTS.find((x) => x.id === id);
  if (!s) { console.log(`  — ${id} 未接入`); continue; }
  let bad = 0, first = null;
  for (let ft = s.start; ft < s.end; ft += 0.1) {
    try { s.draw(H2.makeCtx(), H2.makeCtx(), ft, 1, beats); }
    catch (e) { if (!first) first = `${ft.toFixed(2)}s ${e.message}`; bad++; }
  }
  console.log(bad ? `  ★ ${id}: ${bad} 处失败 · 首次 ${first}` : `  OK ${id} 全时段无异常`);
}
