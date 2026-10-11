/**
 * kit.js — 场景绘制工具集（Python 版各章 Frame/Kit 的统一移植）
 *
 * 设计要点：
 *   · 所有入参一律使用**基准坐标**（1920×1080），内部按 dpr 缩放
 *   · 同时维护「主层」与「高光层」两个上下文，由 app 统一做 bloom
 *   · 半透明填充用真实 globalAlpha 合成（不能靠颜色混色，否则会盖住底层）
 *   · 角度单位统一为**度**，与 Python 的 ImageDraw.arc 一致
 */
import {
  BASE_W, BASE_H, BG_DEEP, ICE, CYAN, GREYBLUE, BLACK,
  css, mix, clamp01, lerp, Rng, seedFromHex, easeOutCubic,
} from './core.js';
import * as P from './primitives.js';

/* ── 颜色 ─────────────────────────────────────────────────── */
/** 按不透明度把颜色混到背景上（等价 Python 的 mixc） */
export const mixc = mix;

/** 高光层用色：按强度缩放（等价 Python 的 glowc） */
export function glowc(rgb, k = 1) {
  return rgb.map((v) => Math.round(clamp01(k) * v));
}

/* ── 缓动（补齐 ch01 用到的其余函数）──────────────────────── */
export const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
export const easeOutBounce = (p) => {
  const n1 = 7.5625, d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) { p -= 1.5 / d1; return n1 * p * p + 0.75; }
  if (p < 2.5 / d1) { p -= 2.25 / d1; return n1 * p * p + 0.9375; }
  p -= 2.625 / d1; return n1 * p * p + 0.984375;
};
export const easeInCubic = (p) => p ** 3;
export const easeInQuart = (p) => p ** 4;
export const easeInExpo = (p) => (p <= 0 ? 0 : 2 ** (10 * (p - 1)));
export const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
export const easeInOutQuart = (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);
export const easeOutQuart = (p) => 1 - (1 - p) ** 4;
export const easeOutQuint = (p) => 1 - (1 - p) ** 5;
export const easeInQuint = (p) => p ** 5;

/** 单次脉冲：在 [t0, t0+dur] 内 sin 半波 */
export function pulse(t, t0, dur) {
  if (t < t0 || t > t0 + dur) return 0;
  return Math.sin((Math.PI * (t - t0)) / dur);
}

/** 距最近节拍的距离归一（1 = 正在拍上，0 = 远离） */
export function ringNear(t, beats, dur = 0.06) {
  let m = 0;
  for (const b of beats) {
    const v = pulse(t, b, dur);
    if (v > m) m = v;
  }
  return m;
}

/** 取区间内的节拍 */
export function beatsIn(beats, t0, t1) {
  return beats.filter((b) => b >= t0 && b <= t1);
}

/* ── 几何辅助 ─────────────────────────────────────────────── */
export function arcPts(cx, cy, rx, ry, a0, a1, n = 32) {
  const out = [];
  const n0 = Math.max(2, n);
  for (let i = 0; i < n0; i++) {
    const a = ((a0 + (a1 - a0) * (i / (n0 - 1))) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** 均匀抽稀到 n 个（保持确定性） */
export function limitN(arr, n) {
  if (!arr || arr.length <= n) return arr || [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]);
  return out;
}

/* ── 字号/字重（与 06 的写法对齐）──────────────────────────
   注意：随包字体只有 Inter-Regular 与 Inter-Bold 两个字重文件。
   06 里的 Medium(500) / Semi-Bold(600) / Extra-Bold(800) 没有独立文件，
   按 assets/fonts/FONTS.md 的既定方案用「基础字重 + 描边」近似：
     · Semi-Bold / Extra-Bold → 用 Inter Bold 打底，再按各档描边系数补差
     · Medium → 用 Inter Regular 打底 + 小描边
   绝不能把 Semi-Bold/Extra-Bold 映射成 Regular —— 那会让主词变成细体
   （这是浏览器版真实出现过的 bug：所有主词都渲染成了 400 细体）。
   ─────────────────────────────────────────────────────────── */
const FONT_FAMILY = {
  'Inter Regular': 'Inter Regular',
  'Inter Medium': 'Inter Regular',
  'Inter Semi-Bold': 'Inter Bold',      // 打底用 Bold，描边补 600 的差值
  'Inter Bold': 'Inter Bold',
  'Inter Extra-Bold': 'Inter Bold',     // 打底用 Bold，描边补 800 的差值
  'JetBrains Mono': 'JetBrains Mono',
  'JetBrains Mono Medium': 'JetBrains Mono',
  'JetBrains Mono Bold': 'JetBrains Mono',
  'JetBrains Mono ExtraBold': 'JetBrains Mono',
  'JetBrains Mono Semi-Bold': 'JetBrains Mono',
  'JetBrains Mono SemiBold': 'JetBrains Mono',
};
/** 各档描边系数（以 96px 为基准，见 assets/fonts/FONTS.md） */
const FONT_STROKE_K = {
  'Inter Regular': 0, 'Inter Medium': 0.75, 'Inter Semi-Bold': 1.50,
  'Inter Bold': 0, 'Inter Extra-Bold': 2.75,
  'JetBrains Mono': 0, 'JetBrains Mono Medium': 0.5,
  'JetBrains Mono Semi-Bold': 0.5, 'JetBrains Mono SemiBold': 0.5,
  'JetBrains Mono Bold': 0, 'JetBrains Mono ExtraBold': 0.5,
};
/** 打底字体的实际字重（必须与实际字体文件相符，否则浏览器会再合成一次） */
const FONT_WEIGHT = {
  'Inter Regular': 400, 'Inter Medium': 400, 'Inter Semi-Bold': 700,
  'Inter Bold': 700, 'Inter Extra-Bold': 700,
  'JetBrains Mono': 400, 'JetBrains Mono Medium': 400,
  'JetBrains Mono Bold': 700, 'JetBrains Mono ExtraBold': 700,
  'JetBrains Mono Semi-Bold': 400, 'JetBrains Mono SemiBold': 400,
};

/** 返回 {font, stroke, family}；font 为 css 字符串（已按 dpr 缩放） */
export function fontOf(weightName, sizePx, dpr = 1) {
  const fam = FONT_FAMILY[weightName];
  if (!fam) throw new Error(`未登记的字重写法: ${weightName}`);
  const w = FONT_WEIGHT[weightName] || 400;
  const size = sizePx * dpr;
  const font = `${w} ${size}px "${fam}", "Segoe UI", sans-serif`;
  return { font, stroke: ((FONT_STROKE_K[weightName] || 0) * size) / 96, family: fam, size };
}

/* ── 逐字符排版（06 要求字距，故不能整词绘制）──────────────── */
/**
 * 把整行按字距展开为逐字位置。
 * align: 'left' | 'center' | 'right'
 * 返回 { glyphs:[{ch,x}], width }
 */
export function layoutChars(ctx, font, text, trackingPx, x, align = 'left') {
  ctx.font = font;
  let w = 0;
  const widths = [];
  for (const ch of text) { const cw = ctx.measureText(ch).width; widths.push(cw); w += cw; }
  w += trackingPx * Math.max(0, text.length - 1);
  let cx = x;
  if (align === 'center') cx = x - w / 2;
  else if (align === 'right') cx = x - w;
  const glyphs = [];
  for (let i = 0; i < text.length; i++) {
    glyphs.push({ ch: text[i], x: cx });
    cx += widths[i] + trackingPx;
  }
  return { glyphs, width: w };
}

/* ══════════════════════════════════════════════════════════════
   Frame —— 一帧的绘制上下文（对应 Python 各章的 Frame / Kit）
   ══════════════════════════════════════════════════════════════ */
export class Frame {  /**
   * @param ctx   主层 2D 上下文（已按 dpr 缩放）
   * @param gctx  高光层 2D 上下文（同尺寸，黑底）
   * @param dpr   缩放比（1920 基准 → 实际像素）
   * @param bg    底色
   */
  constructor(ctx, gctx, dpr = 1, bg = BG_DEEP, beats = []) {
    this.d = ctx;
    this.g = gctx;
    this.ss = dpr;
    this.bg = bg;
    this.beats = beats;
    this.notes = [];
  }

  /* 内部：把基准坐标缩放到设备坐标 */
  _p(v) { return v * this.ss; }

  /* ── 基础图元（入参一律基准坐标）────────────────────────── */

  line(x0, y0, x1, y1, col, w = 1, a = 1, gl = 0, bg = this.bg) {
    const s = this.ss, d = this.d;
    d.strokeStyle = css(a >= 0.999 ? col : mixc(col, bg, a));
    d.lineWidth = Math.max(0.5, w * s);
    d.beginPath(); d.moveTo(x0 * s, y0 * s); d.lineTo(x1 * s, y1 * s); d.stroke();
    if (gl > 0) {
      const g = this.g;
      g.strokeStyle = css(glowc(col, gl));
      g.lineWidth = Math.max(0.5, w * s);
      g.beginPath(); g.moveTo(x0 * s, y0 * s); g.lineTo(x1 * s, y1 * s); g.stroke();
    }
  }

  pline(pts, col, w = 1, a = 1, gl = 0, bg = this.bg, closed = false) {
    if (!pts || pts.length < 2) return;
    const s = this.ss;
    const draw = (c, alpha) => {
      c.strokeStyle = css(alpha >= 0.999 ? col : mixc(col, bg, alpha));
      c.lineWidth = Math.max(0.5, w * s);
      c.beginPath();
      c.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * s, pts[i][1] * s);
      if (closed) c.closePath();
      c.stroke();
    };
    draw(this.d, a);
    if (gl > 0) {
      const c = this.g;
      c.strokeStyle = css(glowc(col, gl));
      c.lineWidth = Math.max(0.5, w * s);
      c.beginPath();
      c.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * s, pts[i][1] * s);
      if (closed) c.closePath();
      c.stroke();
    }
  }

  dot(x, y, r, col, a = 1, gl = 0, bg = this.bg) {
    const s = this.ss, rr = Math.max(0.5, r * s), d = this.d;
    d.fillStyle = css(a >= 0.999 ? col : mixc(col, bg, a));
    d.beginPath(); d.arc(x * s, y * s, rr, 0, 6.283185307179586); d.fill();
    if (gl > 0) {
      const g = this.g;
      g.fillStyle = css(glowc(col, gl));
      g.beginPath(); g.arc(x * s, y * s, rr, 0, 6.283185307179586); g.fill();
    }
  }

  /** 批量画点；alphas 可选，逐点不透明度 */
  pts(points, r, col, a = 1, gl = 0, bg = this.bg, alphas = null) {
    const s = this.ss, rr = Math.max(0.5, r * s), d = this.d, g = this.g;
    for (let i = 0; i < points.length; i++) {
      const aa = alphas ? alphas[i] : a;
      if (aa <= 0.02) continue;
      d.fillStyle = css(aa >= 0.999 ? col : mixc(col, bg, aa));
      d.beginPath(); d.arc(points[i][0] * s, points[i][1] * s, rr, 0, 6.283185307179586); d.fill();
      if (gl > 0) {
        g.fillStyle = css(glowc(col, gl * aa));
        g.beginPath(); g.arc(points[i][0] * s, points[i][1] * s, rr, 0, 6.283185307179586); g.fill();
      }
    }
  }

  /**
   * 矩形。fill 为填充色；fa<1 时用真实 alpha 合成（不盖住底层内容）。
   * rad>0 时画圆角矩形。
   */
  rect(x0, y0, x1, y1, col, w = 1, a = 1, gl = 0, fill = null, fa = 0,
       bg = this.bg, rad = 0) {
    const s = this.ss, d = this.d;
    const X = x0 * s, Y = y0 * s, W = (x1 - x0) * s, H = (y1 - y0) * s;
    if (fill) {
      if (fa >= 0.999) {
        d.fillStyle = css(fill);
        this._roundRect(d, X, Y, W, H, rad * s); d.fill();
      } else if (fa > 0.003) {
        d.save(); d.globalAlpha = clamp01(fa);
        d.fillStyle = css(fill);
        this._roundRect(d, X, Y, W, H, rad * s); d.fill();
        d.restore();
      }
    }
    if (w > 0) {
      d.strokeStyle = css(a >= 0.999 ? col : mixc(col, bg, a));
      d.lineWidth = Math.max(0.5, w * s);
      this._roundRect(d, X, Y, W, H, rad * s); d.stroke();
      if (gl > 0) {
        const g = this.g;
        g.strokeStyle = css(glowc(col, gl));
        g.lineWidth = Math.max(0.5, w * s);
        this._roundRect(g, X, Y, W, H, rad * s); g.stroke();
      }
    }
  }

  _roundRect(c, x, y, w, h, r) {
    c.beginPath();
    if (r > 0) {
      const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      c.moveTo(x + rr, y);
      c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr);
      c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr);
      c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
      c.closePath();
    } else {
      c.rect(x, y, w, h);
    }
  }

  ell(cx, cy, rx, ry, col, w = 1, a = 1, gl = 0, fill = null, fa = 0, bg = this.bg) {
    const s = this.ss, d = this.d;
    if (fill) {
      d.save();
      if (fa < 0.999) d.globalAlpha = clamp01(fa);
      d.fillStyle = css(fill);
      d.beginPath(); d.ellipse(cx * s, cy * s, Math.abs(rx * s), Math.abs(ry * s), 0, 0, 6.283185307179586);
      d.fill(); d.restore();
    }
    if (w > 0) {
      d.strokeStyle = css(a >= 0.999 ? col : mixc(col, bg, a));
      d.lineWidth = Math.max(0.5, w * s);
      d.beginPath(); d.ellipse(cx * s, cy * s, Math.abs(rx * s), Math.abs(ry * s), 0, 0, 6.283185307179586);
      d.stroke();
      if (gl > 0) {
        const g = this.g;
        g.strokeStyle = css(glowc(col, gl));
        g.lineWidth = Math.max(0.5, w * s);
        g.beginPath(); g.ellipse(cx * s, cy * s, Math.abs(rx * s), Math.abs(ry * s), 0, 0, 6.283185307179586);
        g.stroke();
      }
    }
  }

  /** 弧：角度单位为**度**，与 Python 的 ImageDraw.arc 一致（0° 在 3 点钟，顺时针） */
  arc(cx, cy, rx, ry, a0, a1, col, w = 1, a = 1, gl = 0, bg = this.bg) {
    const s = this.ss, d = this.d;
    const R0 = (a0 * Math.PI) / 180, R1 = (a1 * Math.PI) / 180;
    d.strokeStyle = css(a >= 0.999 ? col : mixc(col, bg, a));
    d.lineWidth = Math.max(0.5, w * s);
    d.beginPath(); d.ellipse(cx * s, cy * s, Math.abs(rx * s), Math.abs(ry * s), 0, R0, R1);
    d.stroke();
    if (gl > 0) {
      const g = this.g;
      g.strokeStyle = css(glowc(col, gl));
      g.lineWidth = Math.max(0.5, w * s);
      g.beginPath(); g.ellipse(cx * s, cy * s, Math.abs(rx * s), Math.abs(ry * s), 0, R0, R1);
      g.stroke();
    }
  }

  /** 虚线圆：按弧段拼接 */
  dashCircle(cx, cy, r, col, w = 1, dash = 10, gap = 8, a = 1, gl = 0,
             phaseDeg = 0, bg = this.bg) {
    const circ = 2 * Math.PI * r;
    const n = Math.max(3, Math.floor(circ / (dash + gap)));
    const stepDeg = 360 / n;
    const on = (stepDeg * dash) / (dash + gap);
    for (let i = 0; i < n; i++) {
      const s0 = phaseDeg + i * stepDeg;
      this.arc(cx, cy, r, r, s0, s0 + on, col, w, a, gl, bg);
    }
  }

  /** 虚线直段 */
  dashLine(x0, y0, x1, y1, col, w = 1, dash = 6, gap = 6, a = 1, gl = 0, bg = this.bg) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L <= 0) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    let dd = 0;
    while (dd < L) {
      const e = Math.min(L, dd + dash);
      this.line(x0 + ux * dd, y0 + uy * dd, x0 + ux * e, y0 + uy * e, col, w, a, gl, bg);
      dd = e + gap;
    }
  }

  /** 文本：x,y 为**基线左端**（调用方负责基线换算） */
  text(x, y, s, fontStr, col, a = 1, gl = 0, stroke = 0, bg = this.bg) {
    const s2 = this.ss, d = this.d;
    d.save();
    d.font = fontStr;
    d.textBaseline = 'alphabetic';
    const c = a >= 0.999 ? col : mixc(col, bg, a);
    d.fillStyle = css(c);
    d.fillText(s, x * s2, y * s2);
    if (stroke > 0) {
      d.strokeStyle = css(c);
      d.lineWidth = stroke;
      d.strokeText(s, x * s2, y * s2);
    }
    d.restore();
    if (gl > 0) {
      const g = this.g;
      g.save();
      g.font = fontStr;
      g.textBaseline = 'alphabetic';
      g.fillStyle = css(glowc(col, gl));
      g.fillText(s, x * s2, y * s2);
      if (stroke > 0) {
        g.strokeStyle = css(glowc(col, gl));
        g.lineWidth = stroke;
        g.strokeText(s, x * s2, y * s2);
      }
      g.restore();
    }
  }

  /**
   * 带字距的整行文字（06 要求字距，故逐字绘制）
   * baselineY 为基线；align 支持 left/center/right
   * 返回整行宽度（基准坐标）
   */
  textLine(baselineY, s, fontStr, trackingPx, x, col, opts = {}) {
    const { align = 'left', a = 1, gl = 0, stroke = 0, bg = this.bg,
            progressOf = null, colorAt = null, alphaOf = null } = opts;
    const d = this.d;
    const { glyphs, width } = layoutChars(d, fontStr, s, trackingPx, x, align);
    for (let i = 0; i < glyphs.length; i++) {
      const pr = progressOf ? clamp01(progressOf(i)) : 1;
      if (pr <= 0) continue;
      const aa = (alphaOf ? alphaOf(i) : a) * pr;
      if (aa <= 0.002) continue;
      const c = colorAt ? colorAt(i) : col;
      this.text(glyphs[i].x, baselineY, glyphs[i].ch, fontStr, c, aa, gl, stroke, bg);
    }
    return width;
  }

  /** 四角微信息。默认右下为状态词，左下为技术参数 */
  micro(slots, opts = {}) {
    const { size = 18, weight = 'JetBrains Mono', alpha = 0.6, pad = 26,
            color = GREYBLUE } = opts;
    const f = fontOf(weight, size, this.ss);
    const W = BASE_W, H = BASE_H;
    const put = (txt, x, y, right) => {
      if (!txt) return;
      this.d.save();
      this.d.font = f.font;
      this.d.textBaseline = 'alphabetic';
      const w = this.d.measureText(txt).width / this.ss;
      this.d.fillStyle = css(mixc(color, this.bg, alpha));
      this.d.fillText(txt, (right ? x - w : x) * this.ss, y * this.ss);
      this.d.restore();
    };
    put(slots.TL, pad, pad, false);
    put(slots.TR, W - pad, pad, true);
    put(slots.BL, pad, H - pad, false);
    put(slots.BR, W - pad, H - pad, true);
  }
}

/* ══════════════════════════════════════════════════════════════
   Kit —— 与 Python 各章 Kit/Frame 同名的绘制适配器

   为什么需要它：Python 各章自带一套 Kit API（pt/px/dots/seg/disc/poly/ring/
   dash/word_block/micro/text），若移植时改写每个调用点，既费时又容易引入偏差。
   这里提供一个薄适配器，让移植可以**近乎逐行照抄** Python 源码，语义一致。

   角度单位用**度**（与 PIL 的 ImageDraw 一致）。
   ══════════════════════════════════════════════════════════════ */
export class Kit {
  constructor(ctx, gctx, dpr = 1, bg = BG_DEEP, beats = []) {
    this.f = new Frame(ctx, gctx, dpr, bg, beats);
    // ch06 的若干镜头直接用了 Python 的 `K.d` / `K.gd`（PIL 画布对象）。
    // 这里给出 PIL 兼容垫片，让那几处也能逐行直译。
    this.d = new PilDrawShim(this.f, false);
    this.gd = new PilDrawShim(this.f, true);
    this.ctx = ctx;
    this.dpr = dpr;
    this.bg = bg;
    this.beats = beats;
  }

  /** 相对坐标 (%) → 基准像素 */
  pt(xPct, yPct) { return [xPct * BASE_W, yPct * BASE_H]; }

  /** 基准像素 → 基准像素（保留接口以对齐 Python 写法） */
  px(v) { return v; }

  /** 批量圆点 */
  dots(points, r, col, a = 1, g = 0) { this.f.pts(points, r, col, a, g, this.bg); }

  /** 折线（不闭合） */
  /** 折线路径（多点）
   *  注意：原名为 `seg`，与 Python 各章 `K.seg` 同名但**语义不同** ——
   *  后者其实是这条折线。为避免与 `K.line/lineSeg` 混淆，统一改名 `path`。 */
  path(points, col, w = 1, a = 1, g = 0) { this.f.pline(points, col, w, a, g, this.bg, false); }
  /** 兼容旧名（Python ch04 的 `K.seg(points, col, w, a, g)`） */
  seg(points, col, w = 1, a = 1, g = 0) { return this.path(points, col, w, a, g); }

  /** 圆点（单个） */
  disc(p, r, col, a = 1, g = 0) { this.f.dot(p[0], p[1], r, col, a, g, this.bg); }

  /** 多边形（闭合）；fill + fa 走真实 alpha */
  poly(points, col, w = 1, a = 1, g = 0, close = false, fill = null, fa = 0) {
    this.f.pline(points, col, w, a, g, this.bg, close);
    if (fill && fa > 0) {
      // 用真实 alpha 填充多边形
      const d = this.f.d, s = this.dpr;
      d.save();
      d.globalAlpha = clamp01(fa);
      d.fillStyle = css(fill);
      d.beginPath();
      d.moveTo(points[0][0] * s, points[0][1] * s);
      for (let i = 1; i < points.length; i++) d.lineTo(points[i][0] * s, points[i][1] * s);
      d.closePath(); d.fill();
      d.restore();
    }
  }

  /** 圆环；a0/a1 为起止角（度），省略即整圆 */
  ring(c, r, col, w = 1, a = 1, g = 0, a0 = 0, a1 = 360) {
    if (a0 === 0 && a1 === 360) {
      this.f.ell(c[0], c[1], r, r, col, w, a, g);
    } else {
      this.f.arc(c[0], c[1], r, r, a0, a1, col, w, a, g);
    }
  }

  /**
   * 直线（**Frame 语义**）：四个标量端点 `(x0, y0, x1, y1, col, w, a, gl, bg)`。
   *
   * 为什么统一成 Frame 语义：自动转换产物的来源是 Python 的 `Frame.line`，
   * 若这里用「两个点对」，参数会整体错位（颜色被当成发光强度）。
   * 原本的「两点对」版本改名为 `lineSeg`。
   */
  line(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const x0 = A[0], y0 = A[1], x1 = A[2], y1 = A[3], col = A[4];
    const w = opt(A, 5, o, 'w', 1), a = opt(A, 6, o, 'a', 1);
    const gl = opt(A, 7, o, 'gl', 0), bg = opt(A, 8, o, 'bg', this.bg);
    this.f.line(x0, y0, x1, y1, col, w, a, gl, bg);
  }

  /** 连线（两点对形态；Python ch04 的 `K.line(p0, p1, ...)`） */
  lineSeg(p0, p1, col, w = 1, a = 1, g = 0) {
    this.f.line(p0[0], p0[1], p1[0], p1[1], col, w, a, g, this.bg);
  }

  /** 虚线（两点对形态） */
  dash(p0, p1, col, w = 1, a = 1, on = 6, off = 6, g = 0) {
    this.f.dashLine(p0[0], p0[1], p1[0], p1[1], col, w, on, off, a, g, this.bg);
  }

  /**
   * 矩形（**Frame 语义**）：`(x0, y0, x1, y1, col, w, a, gl, fill, fa, bg, rad)`，
   * 即**左上 + 右下**两个角，可选填充。
   *
   * 「中心 + 宽高」版本改名为 `rectCenter`（Python ch04 的用法）。
   */
  rect(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const x0 = A[0], y0 = A[1], x1 = A[2], y1 = A[3], col = A[4];
    const w = opt(A, 5, o, 'w', 1), a = opt(A, 6, o, 'a', 1);
    const gl = opt(A, 7, o, 'gl', 0), fill = opt(A, 8, o, 'fill', null);
    const fa = opt(A, 9, o, 'fa', 0), bg = opt(A, 10, o, 'bg', this.bg);
    const rad = opt(A, 11, o, 'rad', 0);
    this.f.rect(x0, y0, x1, y1, col, w, a, gl, fill, fa, bg, rad);
  }

  /** 矩形（中心 + 宽高；Python ch04 的 `K.rect(cx, cy, w, h, ...)`） */
  rectCenter(cx, cy, w, h, col, wpx = 1, a = 1, g = 0, radius = 0) {
    this.f.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2,
                col, wpx, a, g, null, 0, this.bg, radius);
  }

  /**
   * 排版文本（**Frame 语义**）：`(x, y, s, fontStr, col, a, gl, stroke, bg)`。
   *
   * 注意：Python ch04 那种 `(字体名, 字号, 文本, x, y, col, ...)` 的写法已改名
   * `textKit` —— 两种形态的**第 3 个实参都可能是字符串**（一个是文字、一个是
   * 字体名之后的文本），故**无法靠类型分派**，只能靠方法名区分。
   * （曾用自适应分派的写法，结果 ch04 的 `K.text(FONT_MONO, 42, 'VIT-C', ...)`
   *  被误判成 Frame 形态，参数整体错位。）
   */
  text(x, y, s, fontStr, col, a = 1, gl = 0, stroke = 0, bg = this.bg) {
    this.f.text(x, y, s, fontStr, col, a, gl, stroke, bg);
  }

  /** 排版文本（**Kit 语义**）：`(fontFamily, px, s, x, y, col, a, gl, anchor, stroke)` */
  textKit(a0, a1, a2, a3, a4, a5, a6 = 1, a7 = 0, a8 = 'left', a9 = 0) {
    const fontFamily = a0, px = a1, s = a2, x = a3, y = a4, col = a5;
    const a = a6, gl = a7, anchor = a8, stroke = a9;
    const fid = typeof fontFamily === 'string' && /Inter|JetBrains/.test(fontFamily)
      ? (fontFamily.includes('Extra') ? 'Inter Extra-Bold'
        : fontFamily.includes('Semi') ? 'Inter Semi-Bold'
        : fontFamily.includes('Bold') && fontFamily.includes('Inter') ? 'Inter Bold'
        : fontFamily.includes('Mono') ? 'JetBrains Mono'
        : fontFamily.includes('Inter') ? 'Inter Regular' : 'JetBrains Mono')
      : fontFamily;
    const f = fontOf(fid, px, this.dpr);
    let xx = x;
    if (anchor === 'center' || anchor === 'right') {
      this.ctx.save();
      this.ctx.font = f.font;
      const w = this.ctx.measureText(s).width / this.dpr;
      this.ctx.restore();
      xx = anchor === 'center' ? x - w / 2 : x - w;
    }
    this.f.text(xx, y, s, f.font, col, a, gl, stroke || f.stroke, this.bg);
  }

  /**
   * 逐字符主词块（对应 Python 的 word_block）
   * lines: 字符串数组；baselines: 每行**基线 y**（基准像素）
   * accents: 形如 [[["If I'm an", ICE]], [["eggplant", BLUEVIOLET]]]（按行给子串配色）
   * t: 当前**绝对时间**（纯函数要求显式传入，不使用类内可变状态）
   */
  word_block(fontFamily, px, lines, x, baselines, trackEm, tIn, t, opts = {}) {
    const { per_char = 0.014, char_dur = 0.07, accents = null, alpha = 1,
            anchor = 'left', g = 0.45 } = opts;
    const fid = fontFamily.includes('Extra') ? 'Inter Extra-Bold'
      : fontFamily.includes('Semi') ? 'Inter Semi-Bold'
      : fontFamily.includes('Bold') ? 'Inter Bold' : 'Inter Regular';
    const f = fontOf(fid, px, this.dpr);
    const tr = trackEm * px;

    // 逐字位置与颜色（按行给子串配色）
    const glyphs = [];
    const colors = [];
    for (let li = 0; li < lines.length; li++) {
      this.ctx.save();
      this.ctx.font = f.font;
      const ws = [];
      for (const ch of lines[li]) ws.push(this.ctx.measureText(ch).width / this.dpr);
      this.ctx.restore();
      const w = ws.reduce((a, b) => a + b, 0) + tr * Math.max(0, lines[li].length - 1);
      let cx = anchor === 'center' ? x - w / 2 : anchor === 'right' ? x - w : x;
      const segs = accents && accents[li] ? accents[li] : null;
      let acc = 0;
      for (let ci = 0; ci < lines[li].length; ci++) {
        let col = ICE;
        if (segs) {
          for (const [sub, c] of segs) {
            if (acc < sub.length) { col = c; break; }
          }
        }
        glyphs.push({ ch: lines[li][ci], x: cx, base: baselines[li] });
        colors.push(col);
        cx += ws[ci] + tr;
        acc++;
      }
    }

    for (let gi = 0; gi < glyphs.length; gi++) {
      const tc = tIn + gi * per_char;
      if (t < tc) continue;
      const p = char_dur > 0 ? clamp01((t - tc) / char_dur) : 1;
      const dy = (1 - p) * 8;
      this.f.text(glyphs[gi].x, glyphs[gi].base + dy, glyphs[gi].ch, f.font,
                  colors[gi], alpha * p, g * p, f.stroke, this.bg);
    }
  }

  /** 四角微信息（`opts` 可覆盖字号/透明度，与 Frame.micro 一致） */
  micro(slots, opts = null) {
    this.f.micro(slots, opts || { size: 18, alpha: 0.6 });
  }

  /* ── Frame 风格别名 ──────────────────────────────────────
     Python 各章混用 `K.xxx` 与 `f.xxx` 两套写法（f 为 PIL ImageDraw 风格的
     Frame 封装）。为便于自动转换，这里把两者都暴露在同一适配器上。 */

  /** f.dot(x, y, r, col, a=1, gl=0, bg) */
  dot(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const x = A[0], y = A[1], r = A[2], col = A[3];
    this.f.dot(x, y, r, col, opt(A, 4, o, 'a', 1), opt(A, 5, o, 'gl', 0),
               opt(A, 6, o, 'bg', this.bg));
  }

  /** f.pts(points, r, col, a=1, gl=0, bg, alphas) */
  pts(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const points = A[0], r = A[1], col = A[2];
    this.f.pts(points, r, col, opt(A, 3, o, 'a', 1), opt(A, 4, o, 'gl', 0),
               opt(A, 5, o, 'bg', this.bg), opt(A, 6, o, 'alphas', null));
  }

  /** f.pline(pts, col, w=1, a=1, gl=0, bg, closed) */
  pline(points, col, w = 1, a = 1, gl = 0, bg = this.bg, closed = false) {
    this.f.pline(points, col, w, a, gl, bg, closed);
  }

  /** f.ell(cx, cy, rx, ry, col, w=1, a=1, gl=0, fill, fa, bg) */
  ell(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const cx = A[0], cy = A[1], rx = A[2], ry = A[3], col = A[4];
    this.f.ell(cx, cy, rx, ry, col, opt(A, 5, o, 'w', 1), opt(A, 6, o, 'a', 1),
               opt(A, 7, o, 'gl', 0), opt(A, 8, o, 'fill', null),
               opt(A, 9, o, 'fa', 0), opt(A, 10, o, 'bg', this.bg));
  }

  /** f.arc(cx, cy, rx, ry, a0, a1, col, w=1, a=1, gl=0, bg) —— 角度制 */
  arc(...argsIn) {
    const A = argsIn, o = tailOpts(A);
    const cx = A[0], cy = A[1], rx = A[2], ry = A[3], a0 = A[4], a1 = A[5], col = A[6];
    this.f.arc(cx, cy, rx, ry, a0, a1, col, opt(A, 7, o, 'w', 1),
               opt(A, 8, o, 'a', 1), opt(A, 9, o, 'gl', 0), opt(A, 10, o, 'bg', this.bg));
  }

  /** f.dash_line(x0, y0, x1, y1, col, w, dash, gap, a, gl) */
  dash_line(x0, y0, x1, y1, col, w = 1, dash = 6, gap = 6, a = 1, gl = 0) {
    this.f.dashLine(x0, y0, x1, y1, col, w, dash, gap, a, gl, this.bg);
  }

  /** f.dash_circle(cx, cy, r, col, w, dash, gap, a, gl, phase_deg) */
  dash_circle(cx, cy, r, col, w = 1, dash = 6, gap = 6, a = 1, gl = 0, phaseDeg = 0) {
    this.f.dashCircle(cx, cy, r, col, w, dash, gap, a, gl, phaseDeg, this.bg);
  }

  /** 用真实 alpha 填充椭圆（Python 的 overlay_ellipse）——不盖住下层内容 */
  overlay_ellipse(cx, cy, rx, ry, col, alpha = 1.0) {
    this.f.ell(cx, cy, rx, ry, col, 0, 1, 0, col, alpha, this.bg);
  }

  /** 用真实 alpha 填充矩形（Python 的 overlay_box） */
  overlay_box(box, col, alpha = 1.0) {
    this.f.rect(box[0], box[1], box[2], box[3], col, 0, 1, 0, col, alpha, this.bg);
  }

  /** 文本宽度（基准像素） */
  text_w(s, fontStr) {
    this.ctx.save();
    this.ctx.font = fontStr;
    const w = this.ctx.measureText(s).width / this.dpr;
    this.ctx.restore();
    return w;
  }
}

/* ── options 对象支持 ───────────────────────────────────────
   自动转换产物把 Python 的关键字实参放在**尾部对象**里，
   而不是靠 `undefined` 占位（补占位会让对象落到某个形参上而错位）。
   这里按名取值：位置实参优先，其次 options，最后默认值。 */
function opt(args, idx, opts, name, dflt) {
  if (idx < args.length && args[idx] !== undefined) return args[idx];
  if (opts && name && opts[name] !== undefined) return opts[name];
  return dflt;
}
/** 找出最后一个对象实参（即 options） */
function tailOpts(args) {
  const last = args[args.length - 1];
  return (last && typeof last === 'object' && !Array.isArray(last)) ? last : null;
}


/* ══════════════════════════════════════════════════════════════
   Word —— 按 06 的字重/字距/行距/锚点做逐字符布局
   （对应 Python 各章的 Word 类）

   v: 'center' 整块垂直居中 / 'baseline_last' 末行基线落在锚点
      / 'baseline_first' 首行基线落在锚点
   h: 'center' / 'left' / 'right'
   ══════════════════════════════════════════════════════════════ */
export class Word {
  constructor(ctx, lines, px, opts = {}) {
    const { weight = 'Inter Semi-Bold', trackEm = 0, dpr = 1, h = 'center',
            v = 'center', anchor = [0.5, 0.5], lineStep = null,
            stepEm = 1.02 } = opts;
    this.lines = Array.isArray(lines) ? lines.slice() : [lines];
    this.px = px;
    this.ss = dpr;
    const f = fontOf(weight, px, dpr);
    this.font = f.font;
    this.stroke = f.stroke;
    this.tr = trackEm * px * dpr;

    // 行高：优先用显式值，否则 1.02em
    const asc = this._ascent(ctx, f.font);
    const desc = this._descent(ctx, f.font);
    this.asc = asc; this.desc = desc;
    const step = (lineStep != null ? lineStep : stepEm * px) * dpr;
    this.step = step;

    const ax = anchor[0] * BASE_W * dpr;
    const ay = anchor[1] * BASE_H * dpr;
    const n = this.lines.length;
    let base;
    if (v === 'baseline_last') {
      base = [];
      for (let i = 0; i < n; i++) base.push(ay - step * (n - 1 - i));
    } else if (v === 'baseline_first') {
      base = [];
      for (let i = 0; i < n; i++) base.push(ay + step * i);
    } else {
      const total = step * (n - 1) + asc + desc;
      base = [];
      for (let i = 0; i < n; i++) base.push(ay - total / 2 + step * i + asc);
    }
    this.baselines = base;

    // 逐字符位置（设备像素坐标，与 Python 版一致）
    ctx.save();
    ctx.font = this.font;
    this.chars = [];
    this.lineW = [];
    for (let li = 0; li < n; li++) {
      const text = this.lines[li];
      let w = 0;
      const cw = [];
      for (const ch of text) { const v2 = ctx.measureText(ch).width; cw.push(v2); w += v2; }
      w += this.tr * Math.max(0, text.length - 1);
      this.lineW.push(w);
      let x0;
      if (h === 'center') x0 = ax - w / 2;
      else if (h === 'left') x0 = ax;
      else x0 = ax - w;
      let x = x0;
      for (let ci = 0; ci < text.length; ci++) {
        this.chars.push({ li, ci, ch: text[ci], x, baseline: base[li] });
        x += cw[ci] + this.tr;
      }
    }
    ctx.restore();

    this.width = this.lineW.length ? Math.max(...this.lineW) / dpr : 0;
    this.height = (step * (n - 1) + asc + desc) / dpr;
    this.x0 = (h === 'center' ? (ax - this.lineW[0] / 2) : (h === 'left' ? ax : ax - this.lineW[0])) / dpr;
    this.x1 = this.x0 + this.width;
  }

  _ascent(ctx, font) {
    ctx.save(); ctx.font = font;
    const m = ctx.measureText('H');
    ctx.restore();
    return m.actualBoundingBoxAscent || this._px(font) * 0.75;
  }

  _descent(ctx, font) {
    ctx.save(); ctx.font = font;
    const m = ctx.measureText('Hg');
    ctx.restore();
    return m.actualBoundingBoxDescent || this._px(font) * 0.25;
  }

  _px(font) { const m = /(\d+(?:\.\d+)?)px/.exec(font); return m ? parseFloat(m[1]) : 16; }

  /** 逐字符淡入（06 的 stagger / 上浮 dy / 缓动）；cut=true 则硬切 */
  draw(f, t, opts = {}) {
    const { t0 = 0, stagger = 0.012, dur = 0.10, dy = 8, ease = easeOutCubic,
            color = null, glowK = 0, alpha = 1, bg = BG_DEEP, cut = false } = opts;
    const colf = toColorFn(color, t);
    for (let gi = 0; gi < this.chars.length; gi++) {
      const c = this.chars[gi];
      const tc = t0 + gi * stagger;
      if (t < tc) continue;
      const p = cut ? 1 : ease(clamp01((t - tc) / dur));
      const off = (1 - p) * dy;
      const col = colf(c.li, c.ci, c.ch);
      f.text(c.x / f.ss, c.baseline / f.ss + off, c.ch, this.font, col,
             alpha * p, glowK * p, this.stroke, bg);
    }
  }

  /** 完整绘制（硬切，无错峰）。t 用于求值声明式颜色规则里的时间条件。 */
  drawPlain(f, color, opts = {}, t = 0) {
    const { alpha = 1, glowK = 0, bg = BG_DEEP, dy = 0 } = opts;
    const colf = toColorFn(color, t);
    for (const c of this.chars) {
      f.text(c.x / f.ss, c.baseline / f.ss + dy, c.ch, this.font,
             colf(c.li, c.ci, c.ch), alpha, glowK, this.stroke, bg);
    }
  }
}

/**
 * 把**声明式颜色规则**转成逐字回调 `(li, ci, ch) => color`。
 *
 * 为什么需要：Python 各章大量使用 lambda 逐字着色，例如
 *     W.draw(..., color=lambda li, ci, ch: CYAN if ci in (3,4,5) and t >= 3.6 else ICE)
 *     W.draw_plain(f, lambda li, ci, ch: BV if li == 1 else ICE)
 * 自动转换无法机械翻译 lambda，故约定用规则对象表达同一语义：
 *
 *     { rules: [ { when: { li: 1 } }, BV ],          // 第 2 行整行
 *     { base: ICE, rules: [ { ciIn: [3,4,5], at: 3.6 }, CYAN ] }
 *
 * 也接受：函数（原样调用）/ 颜色常量或 hex（统一返回该色）/ 颜色数组（按字符序取）。
 */
/** 判断是否为颜色值（`[r,g,b]` / `[r,g,b,a]`）——**颜色本身就是数组**，
 *  故必须先识别它，否则会被误当成「逐字颜色列表」而返回一个数字。 */
function isColorish(v) {
  return Array.isArray(v) && (v.length === 3 || v.length === 4)
    && v.every((x) => typeof x === 'number');
}

export function toColorFn(spec, t = 0) {
  if (typeof spec === 'function') return spec;
  if (spec == null) return () => ICE;
  if (typeof spec === 'string' || isColorish(spec)) return () => spec;
  if (Array.isArray(spec)) {
    // 逐字颜色列表（元素是颜色/字符串，而非单个数字）
    const arr = spec;
    let i = 0;
    return () => arr[i++ % arr.length];
  }
  const base = spec.base || ICE;
  const rules = spec.rules || [];
  // `_dynConds` 是转换器记录的时间类条件（如 `t >= 3.6`）。
  // 未满足时该规则不生效 —— 否则颜色会过早变化。
  const dynOk = (spec._dynConds || []).every((c) => evalCond(c, t));
  return (li, ci, ch) => {
    if (dynOk) {
      for (const r of rules) {
        const w = r.when || r;
        if (w.li != null && w.li !== li) continue;
        if (w.ci != null && w.ci !== ci) continue;
        if (w.ciIn && !w.ciIn.includes(ci)) continue;
        if (w.liIn && !w.liIn.includes(li)) continue;
        if (w.ciLt != null && !(ci < w.ciLt)) continue;
        if (w.ciFrom != null && !(ci >= w.ciFrom)) continue;
        if (w.liFrom != null && !(li >= w.liFrom)) continue;
        return r.color || r.then || base;
      }
    }
    return base;
  };
}

/** 求值转换器记录的时间条件（形如 `t >= 3.6`、`t < 4.94`） */
function evalCond(cond, t) {
  const m = /^t\s*(>=|<=|>|<|===|!==|==|!=)\s*(-?[\d.]+)$/.exec(String(cond).trim());
  if (!m) return true;                     // 无法识别时不禁用（保持原色）
  const v = parseFloat(m[2]);
  switch (m[1]) {
    case '>=': return t >= v;
    case '<=': return t <= v;
    case '>': return t > v;
    case '<': return t < v;
    case '===': case '==': return t === v;
    case '!==': case '!=': return t !== v;
    default: return true;
  }
}

/* ── PIL 画布垫片（对应 Python 的 `K.d` / `K.gd`）─────────────────
   ch06 的少数镜头直接调用了 `K.d.text(...)` / `K.gd.text(...)`。
   这里做最小实现：text 映射到 Frame.text；glow 层用同色但低强度近似。 */
class PilDrawShim {
  constructor(frame, isGlow) {
    this.f = frame;
    this.isGlow = isGlow;
  }

  text(xy, s, opts = {}) {
    const [x, y] = xy;
    const { font = null, fill = null, stroke_width = 0, stroke_fill = null } = opts;
    if (!fill || !s) return;
    const fontStr = font && font.fontStr ? font.fontStr : '16px sans-serif';
    // Python 的 y 是字形顶端；Frame.text 的 y 是基线
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = fontStr;
    const mm = cv.measureText(s);
    const asc = mm.actualBoundingBoxAscent || 0;
    const a = this.isGlow ? 0.45 : 1.0;
    this.f.text(x, y + asc, s, fontStr, fill, a, 0, stroke_width);
  }

  line(xy, opts = {}) {
    const { fill = null, width = 1 } = opts;
    if (!fill || xy.length < 2) return;
    for (let i = 0; i < xy.length - 1; i++) {
      this.f.line(xy[i][0], xy[i][1], xy[i + 1][0], xy[i + 1][1], fill, width,
                  this.isGlow ? 0.45 : 1);
    }
  }

  rectangle(xy, opts = {}) {
    const [x0, y0, x1, y1] = xy;
    const { fill = null, outline = null, width = 1 } = opts;
    this.f.rect(x0, y0, x1, y1, outline || fill, outline ? width : 0,
                this.isGlow ? 0.45 : 1, 0, fill, fill ? (this.isGlow ? 0.45 : 1) : 0);
  }
}

/* ══════════════════════════════════════════════════════════════════
   Canvas —— ch07–ch12 的 `c.*` 上下文适配器

   ch07–ch12 的 Python 源码用的是各章自定义的 `Canvas` 类，API 与 Frame/Kit
   都不同。实测其方法集与 `Frame` 高度同构（`line` 同样是四标量、`arc` 同样
   是**度数**），只是多了 `circle`/`poly`/`glyph`/`flash`/`flush`，且 `rect`
   的第 4 个参数叫 `fill_a`。因此这里做一层薄适配，让移植近乎逐行照抄。

   与 Python `Canvas` 的差异（有意为之）：
     · `flush()` 的 bloom/scanline/grain 由播放器的后处理管线负责，这里只把
       参数回传给调用方（返回对象），不在此处做像素后处理。
     · `paste_mask()` 的 PIL 蒙版在浏览器里没有等价物，抛出明确错误——若某镜
       真的用到，需要单独改写为 Canvas 的裁剪/合成写法。
   ══════════════════════════════════════════════════════════════════ */
export class Canvas {
  constructor(ctx, gctx, dpr = 1, bg = BG_DEEP, beats = []) {
    this.ctx = ctx;
    this.gctx = gctx;
    this.dpr = dpr;
    this.bg = bg;
    this.beats = beats;
    this.ss = dpr;
    this.W = BASE_W;
    this.H = BASE_H;
    this.shotId = '';
    this.notes = [];
    this._f = new Frame(ctx, gctx, dpr, bg, beats);
  }

  /* -- 基础图元（与 Python Canvas 同名同序）------------------------- */
  line(x0, y0, x1, y1, color, w = 1.0, a = 1.0, g = 0.0) {
    this._f.line(x0, y0, x1, y1, color, w, a, g);
  }

  polyline(pts, color, w = 1.0, a = 1.0, g = 0.0, closed = false) {
    this._f.pline(pts, color, w, a, g, this.bg, closed);
  }

  rect(x0, y0, x1, y1, color, w = 1.0, a = 1.0, fillA = 0.0, g = 0.0) {
    this._f.rect(x0, y0, x1, y1, color, w, a, g,
                 fillA > 0 ? color : null, fillA);
  }

  poly(pts, color, w = 1.0, a = 1.0, fillA = 0.0, g = 0.0, closed = true) {
    if (fillA > 0.0 && pts.length >= 3) {
      this._f.pts(pts, 0, color, 0, 0, this.bg);
      this._fillPoly(pts, color, fillA);
    }
    if (closed && pts.length >= 2) this._f.pline(pts, color, w, a, g, this.bg, true);
    else if (w > 0.0) this._f.pline(pts, color, w, a, g, this.bg, false);
  }

  circle(cx, cy, r, color, w = 1.0, a = 1.0, fillA = 0.0, g = 0.0) {
    this.ellipse(cx, cy, r, r, color, w, a, fillA, g);
  }

  ellipse(cx, cy, rx, ry, color, w = 1.0, a = 1.0, fillA = 0.0, g = 0.0) {
    this._f.ell(cx, cy, rx, ry, color, w, a, g,
                fillA > 0 ? color : null, fillA);
  }

  /** 角度制（与 Python PIL 的 `ImageDraw.arc` 一致） */
  arc(cx, cy, r, d0, d1, color, w = 1.0, a = 1.0, g = 0.0) {
    this._f.arc(cx, cy, r, r, d0, d1, color, w, a, g);
  }

  dot(x, y, r, color, a = 1.0, g = 0.0) {
    this._f.dot(x, y, r, color, a, g);
  }

  _fillPoly(pts, color, alpha) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = css(color);
    c.beginPath();
    c.moveTo(pts[0][0] * this.dpr, pts[0][1] * this.dpr);
    for (let i = 1; i < pts.length; i++) {
      c.lineTo(pts[i][0] * this.dpr, pts[i][1] * this.dpr);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  /* -- 文字 --------------------------------------------------------- */
  /** `f` 为 `{font, stroke, px, weight}`（见 `canvasFont`）
   *  `anchor` 同 PIL（'la' 左上 / 'ma' 中上 / 'ra' 右上）；`strokePx` 额外描边宽度 */
  text(x, yTop, text, f, color, a = 1.0, g = 0.0, anchor = 'la', strokePx = null) {
    if (a <= 0.012 || !text) return;
    const strokeW = strokePx != null ? strokePx : f.stroke;
    const align = typeof anchor === 'string' && anchor.includes('m') ? 'center'
      : (typeof anchor === 'string' && anchor.includes('r') ? 'right' : 'left');
    if (align === 'left') {
      this._f.text(x, yTop + f.asc, text, f.font, color, a, g, strokeW);
      return;
    }
    const w = this._measure(text, f.font);
    const dx = align === 'center' ? -w / 2 : -w;
    this._f.text(x + dx, yTop + f.asc, text, f.font, color, a, g, strokeW);
  }

  glyph(ch, x, yTop, f, color, a = 1.0, sx = 1.0, sy = 1.0, g = 0.0) {
    if (a <= 0.012) return;
    if (sx >= 0.999 && sy >= 0.999) {
      this.text(x, yTop, ch, f, color, a, g);
      return;
    }
    // 缩放单字符：用 Canvas 变换实现（Python 用蒙版缩放）
    const c = this.ctx;
    c.save();
    c.translate(x * this.dpr, (yTop + f.asc) * this.dpr);
    c.scale(sx, sy);
    c.translate(-x * this.dpr, -(yTop + f.asc) * this.dpr);
    this._f.text(x, yTop + f.asc, ch, f.font, color, a, g, f.stroke);
    c.restore();
  }

  _measure(s, fontStr) {
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = fontStr;
    return cv.measureText(s).width;
  }

  /** 文本掩版合成（对应 `_outline_text` 用的 `paste_mask(word_mask(...))`）
   *  `inset > 0` 时把字缩小 `inset`（模拟 PIL 的腐蚀：下采样再放大），
   *  用于「先铺满字形、再用底色挖空 → 只留轮廓」。 */
  pasteTextMask(text, x, yTop, fontStr, asc, stroke, color, a = 1.0, inset = 0.0) {
    if (a <= 0.012 || !text) return;
    if (inset <= 0.01) {
      this._f.text(x, yTop + asc, text, fontStr, color, a, 0, stroke);
      return;
    }
    const c = this.ctx;
    c.save();
    c.font = fontStr;
    const w = c.measureText(text).width;
    const k = Math.max(0.5, (w - inset * this.dpr) / Math.max(1e-6, w));
    c.translate(x * this.dpr, (yTop + asc) * this.dpr);
    c.scale(k, k);
    c.translate(-x * this.dpr, -(yTop + asc) * this.dpr);
    this._f.text(x, yTop + asc, text, fontStr, color, a, 0, stroke);
    c.restore();
  }

  /** PIL 蒙版合成的等价实现：`m` 为 `{text, font, asc, textY, cy0, cy1, cx0, cx1}`
   *  条带描述（由 `canvas.js` 的 `maskBand()` 构造）。
   *
   *  与 PIL 的对应关系：`paste(im, (x,y), mask)` 中 mask 决定「哪些像素可见」。
   *  这里用「裁剪到条带区域 + 在**整词**落点绘制文本」实现等价效果 ——
   *  关键是文本落点固定为整词位置，只有裁剪区变化，才能得到条带化显影。
   */
  paste_mask(m, x, y, color, a = 1.0, g = 0.0) {
    if (a <= 0.012 || !m) return;
    const sx0 = m.cx0 != null ? Math.min(m.cx0, m.cx1) : x - 4000;
    const sx1 = m.cx1 != null ? Math.max(m.cx0, m.cx1) : x + 4000;
    const sy0 = Math.min(m.cy0, m.cy1);
    const sy1 = Math.max(m.cy0, m.cy1);
    if (sy1 - sy0 <= 0.01 || sx1 - sx0 <= 0.01) return;
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(sx0 * this.dpr, sy0 * this.dpr,
           (sx1 - sx0) * this.dpr, (sy1 - sy0) * this.dpr);
    c.clip();
    // 文本画在**整词**的 ascender 落点（m.textY），而非条带 y
    this._f.text(x, m.textY, m.text, m.font, color, a, g, m.stroke);
    c.restore();
  }

  /** 整屏硬闪（1–2 帧白闪） */
  flash(color, k) {
    const kk = clamp01(k);
    if (kk <= 0.001) return;
    this._f.rect(0, 0, BASE_W, BASE_H, color, 0, 1, 0, color, kk);
  }

  note(msg) {
    if (!this.notes.includes(msg)) this.notes.push(msg);
  }

  /** 收尾：bloom / scanline / grain 交给播放器后处理，这里只回传参数 */
  flush(t, seed, opts = {}) {
    const { radius = 8.0, strength = 0.35, grainPct = 5.0, scan = 0.0 } = opts;
    return { bloomR: radius, bloomK: strength, grain: grainPct, scan };
  }
}

/** 构造 Canvas 的字体对象（对应 Python ch07 的 `F` 与 `canvas_font`） */
export function canvasFont(weight, px, dpr = 1) {
  const fo = fontOf(weight, px, dpr);
  return { font: fo.font, fontStr: fo.font, stroke: fo.stroke || 0, px, weight,
           asc: fo.asc || px * 0.92, desc: fo.desc || px * 0.22 };
}

export { P };
