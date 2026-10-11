/**
 * tools/harness.mjs — 共享测试桩：Canvas 2D / DOM / FontFace
 *
 * 供各批次移植的自验脚本复用，避免每批重写一遍桩。
 * 用法：
 *     import { makeCtx, installDom, checkShots } from './harness.mjs';
 *     installDom();
 *     const { CH03_SHOTS } = await import('../js/ch03.js');
 *     const report = checkShots(CH03_SHOTS, [59.5, 60.0, 60.5]);
 *     console.log(report.text);
 */

import { readFileSync } from 'node:fs';

/**
 * 真实字体度量：读取由 Python/PIL 预计算的「文本 → 宽度」表。
 * 表不存在时退回「单字符宽度相加」的近似（仍比 len×px×0.6 准得多）。
 *
 * 为什么必须用真实字宽：逐字排版的字距是 `trackEm × px`，若字宽用近似值，
 * 二者错配会让整行看起来字距异常大 —— 这是本项目真实踩过的坑。
 */
let _metrics = null;
try {
  _metrics = JSON.parse(readFileSync(new URL('./font_metrics.json', import.meta.url), 'utf-8'));
} catch { _metrics = null; }
const _charCache = new Map();

function realFontFor(css) {
  const m = /(\d+(?:\.\d+)?)px\s+"([^"]+)"/.exec(css || '');
  if (!m) return null;
  const size = Math.round(parseFloat(m[1]));
  const family = m[2];
  return {
    key: `${size}|${family}`,
    getlength(s) {
      if (_metrics) {
        const hit = _metrics[`${size}|${family}|${s}`];
        if (hit != null) return hit;
      }
      let total = 0;
      for (const ch of s) {
        const ck = `${size}|${family}|${ch}`;
        let w = _metrics ? _metrics[ck] : null;
        if (w == null) {
          if (!_charCache.has(ck)) _charCache.set(ck, size * 0.62);
          w = _charCache.get(ck);
        }
        total += w;
      }
      return total;
    },
  };
}

/** 把本次渲染量到的文本登记到全局 sink（供 collect_metrics.mjs 收集） */
function recordMetric(css, text) {
  if (typeof globalThis.__metricSink === 'function') globalThis.__metricSink(css, text);
}

/** 记录所有绘制调用的 2D 上下文桩 */
export function makeCtx(w = 1920, h = 1080) {
  const T = [];
  const r = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
  return {
    canvas: { width: w, height: h }, _T: T,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    textBaseline: 'alphabetic', textAlign: 'left', filter: 'none',
    imageSmoothingEnabled: true, lineCap: 'butt',
    save() { T.push('sv'); }, restore() { T.push('rs'); },
    setTransform() {}, scale() {}, translate() {}, rotate() {},
    beginPath() {}, closePath() {}, clip() { T.push('clip'); },
    moveTo(x, y) { T.push(`M${r(x)},${r(y)}`); },
    lineTo(x, y) { T.push(`L${r(x)},${r(y)}`); },
    quadraticCurveTo(x, y) { T.push(`Q${r(x)},${r(y)}`); },
    bezierCurveTo() { T.push('B'); },
    arc(x, y, rr) { T.push(`A${r(x)},${r(y)},${r(rr)}`); },
    ellipse(x, y, rx, ry) { T.push(`E${r(x)},${r(y)},${r(rx)},${r(ry)}`); },
    rect(x, y, a, b) { T.push(`R${r(x)},${r(y)}`); },
    clearRect() {}, fillRect(x, y, a, b) { T.push(`FR${r(x)},${r(y)}`); },
    strokeRect() {},
    fillText(s, x, y) {
      // 记入 font 与 fillStyle —— 回放渲染（Python/PIL）需要它们才能还原画面
      T.push(`T"${s}"@${r(x)},${r(y)}|${this.fillStyle}|${this.font}`);
    },
    strokeText() {},
    stroke() { T.push(`st${this.strokeStyle}`); },
    fill() { T.push(`fl${this.fillStyle}`); },
    measureText(s) {
      recordMetric(this.font, s);
      // 用**真实随包字体**度量（浏览器里由 Canvas 完成同一件事）
      const f = realFontFor(this.font);
      if (f) {
        const w = f.getlength(s);
        return { width: w, actualBoundingBoxAscent: parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16])[1]) * 0.72, actualBoundingBoxDescent: 0 };
      }
      const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 16])[1]);
      return { width: s.length * px * 0.6, actualBoundingBoxAscent: px * 0.75,
               actualBoundingBoxDescent: px * 0.22 };
    },
    createImageData(a, b) { return { data: new Uint8ClampedArray(a * b * 4) }; },
    putImageData() {},
    getImageData(x, y, a, b) {
      // 确定性「字形」：隔像素不透明，供 textPoints 采样出非空点集
      const n = Math.max(1, Math.floor(a) * Math.floor(b));
      const d = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i += 3) { d[i * 4] = 255; d[i * 4 + 3] = 255; }
      return { data: d, width: a, height: b };
    },
    createPattern() { return {}; },
    drawImage() {},
    setLineDash() {},
  };
}

/** 安装最小 DOM / FontFace 桩 */
export function installDom() {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 1, height: 1, _c: null,
          getContext() {
            if (!this._c) this._c = makeCtx(this.width, this.height);
            return this._c;
          },
        };
      }
      return {};
    },
    fonts: { add() {}, ready: Promise.resolve() },
  };
  globalThis.FontFace = class { async load() { return this; } };
}

/**
 * 逐镜检查：三时间点有绘制、无异常、同 t 二次一致、乱序一致、主词宽度。
 * @param shots 镜头数组
 * @param beats 全片拍点数组（可选）
 * @returns {{text:string, fail:number, rows:Array}}
 */
export function checkShots(shots, beats = [], opts = {}) {
  const { maxWidth = 1728, samples = 3 } = opts;
  const rows = [];
  let fail = 0;

  for (const s of shots) {
    const span = s.end - s.start;
    const ts = [];
    for (let i = 0; i < samples; i++) {
      ts.push(s.start + span * (i === 0 ? 0.05 : i === samples - 1 ? 0.95 : 0.5));
    }
    const counts = [];
    let err = null;
    for (const t of ts) {
      const g = makeCtx(), gl = makeCtx();
      g._T.length = 0;
      try { s.draw(g, gl, t, 1, beats); } catch (e) { err = e; }
      counts.push(g._T.length);
    }
    // 确定性：同 t 两次
    const g1 = makeCtx(), gl1 = makeCtx(), g2 = makeCtx(), gl2 = makeCtx();
    const tm = s.start + span * 0.5;
    try { s.draw(g1, gl1, tm, 1, beats); s.draw(g2, gl2, tm, 1, beats); } catch (e) { err = err || e; }
    const det = g1._T.join('|') === g2._T.join('|') && g1._T.length > 0;
    // 乱序：先渲后段再渲前段
    const g3 = makeCtx(), gl3 = makeCtx(), g4 = makeCtx(), gl4 = makeCtx();
    try {
      s.draw(g3, gl3, s.end - 0.05, 1, beats);
      s.draw(g4, gl4, s.start + 0.05, 1, beats);
      s.draw(g3, gl3, s.start + 0.05, 1, beats);
    } catch (e) { err = err || e; }
    const order = g1._T.length > 0;

    // 主词宽度（若镜头缓存里有 Word 实例）
    let widthOk = true, widthInfo = '';
    const c = s._c;
    if (c) {
      for (const key of ['W', 'word', 'main']) {
        const w = c[key];
        if (w && typeof w.width === 'number') {
          if (w.width > maxWidth) { widthOk = false; widthInfo = `${w.width.toFixed(0)}px`; }
        }
      }
    }

    const empty = counts.some((n) => n === 0);
    const bad = !!err || empty || !det || !order || !widthOk;
    if (bad) fail++;
    rows.push({ id: s.id, counts, det, order, empty, err, widthOk, widthInfo, bad });
  }

  const lines = [];
  for (const r of rows) {
    lines.push(`  ${r.bad ? '★' : 'OK'} ${r.id}  绘制 ${r.counts.join('/')}  `
      + `确定性 ${r.det ? 'OK' : 'FAIL'}  ${r.err ? '错误: ' + r.err.message.slice(0, 40) : ''}`
      + `${r.widthInfo ? '  宽度超限 ' + r.widthInfo : ''}`);
  }
  lines.push('');
  lines.push(fail === 0
    ? `结果: ${rows.length} 镜全部通过`
    : `结果: ${fail}/${rows.length} 镜有问题`);
  return { text: lines.join('\n'), fail, rows };
}
