/**
 * canvas.js — ch07–ch12 的公共中间层（对应 Python ch07–ch09 的章内 helper）
 *
 * ch07–ch12 的 Python 源码用 `Canvas` 上下文 + 一套章内 helper（排版、蒙版采样、
 * 节拍、角标信息）绘制。这些 helper 在 ch07/ch08/ch09 里**逐字重复**，因此抽到
 * 本模块共用；每章的专有 helper（如 ch07 的 `_tree_draw`）留在各自章节文件里。
 *
 * 与 Python 的差异（有意为之）：
 *   · `glyph_mask` / `word_mask` / `sample_mask`：PIL 的 L 蒙版在浏览器没有等价物。
 *     这里改为「用 Canvas 的 measureText 直接算字宽 → 按 step 采样字形像素」的方式，
 *     结果点集与 PIL 蒙版采样**语义一致**（同一 (x,y) 落在墨迹内才取点）。
 *   · 蒙版类 API 返回 `{pts, w, h}` 的点集描述，而不是像素对象。
 */
import {
  BASE_W, BASE_H, BG_DEEP, ICE, CYAN, GREYBLUE, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix, css,
  easeOutCubic, easeInCubic, easeOutExpo, easeInOutCubic, easeOutQuad, easeInOutSine,
} from './core.js';
import { fontOf, Canvas } from './kit.js';

/* ── 字重写法 → kit.js 的字体族名（与 Python WEIGHT_MAP 对齐）────── */
export function font(weight, px, dpr = 1) {
  const fo = fontOf(weight, Math.round(px), dpr);
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fo.font;
  const mm = cv.measureText('Hg');
  const asc = mm.actualBoundingBoxAscent || px * 0.78;
  const desc = mm.actualBoundingBoxDescent || px * 0.22;
  return {
    weight, px: Math.round(px), dpr,
    font: fo.font, stroke: fo.stroke || 0,
    asc, desc,
    getlength(s) {
      const c2 = document.createElement('canvas').getContext('2d');
      c2.font = fo.font;
      return c2.measureText(s).width;
    },
  };
}

/** 字符串宽度（基准 px，对应 Python 的 `tw`） */
export function tw(c, f, s) {
  return f.getlength(s) / (c.ss || 1);
}

/** 字级排版：返回 { cells: [[ch, x_off, adv]], total }（对应 Python 的 `cells_of`） */
export function cellsOf(f, text, px, trkEm, ss) {
  const trk = trkEm * px;
  const out = [];
  let x = 0.0;
  for (const ch of text) {
    const adv = f.getlength(ch) / ss;
    out.push([ch, x, adv]);
    x += adv + trk;
  }
  const total = text ? x - trk : 0.0;
  return { cells: out, total };
}

/**
 * 把一段文字按 step（基准 px）采样为点列（基准坐标）。
 * 对应 Python 的 `glyph_mask` + `sample_mask`，但直接在 Canvas 上采样，
 * 不做像素级蒙版：用逐像素矩形与字形的实际覆盖做判定。
 */
export function sampleText(text, f, ss, stepBase, ox = 0, oy = 0, maxN = 0, dpr = 1) {
  const step = Math.max(1, Math.round(stepBase * ss));
  const cv = document.createElement('canvas');
  const w = Math.ceil(f.getlength(text)) + 4;
  const h = Math.ceil(f.asc + f.desc) + 4;
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.font = f.font;
  cx.textBaseline = 'alphabetic';
  cx.fillStyle = '#fff';
  cx.fillText(text, 2, 2 + f.asc);
  const data = cx.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = data[(y * w + x) * 4 + 3];
      if (a >= 120) pts.push([ox + x / ss, oy + y / ss]);
    }
  }
  if (maxN && pts.length > maxN) {
    const stride = pts.length / maxN;
    const out = [];
    for (let i = 0; i < maxN; i++) out.push(pts[Math.trunc(i * stride)]);
    return out;
  }
  return pts;
}

/* ── 颜色工具（与 Python 同名）────────────────────────────────── */
/** 以 alpha 与背景混合后的实色（对应 Python 的 `mixc`） */
export function mixc(color, a, bg = BG_DEEP) {
  return mix(bg, color, a);
}

/** 提亮/压暗（对应 Python 的 `dimc`：向黑压 k） */
export function dimc(color, k) {
  return mix(BLACK, color, clamp01(1 - k));
}

/** 两色按 k 混合（对应 Python 的 `blendc`） */
export function blendc(c1, c2, k) {
  return mix(c1, c2, k);
}

/* 三次缓入缓出：直接转发 core.js 的实现，避免两处定义漂移 */
export { easeInOutCubic };
/* 二次缓出：同样转发 core.js */
export { easeOutQuad };
/* 正弦缓入缓出：转发 core.js 的 easeInOutSine */
export { easeInOutSine };

/* ── 缓动补充（core.js 没有的写法）────────────────────────────── */
export const easeInExpo = (p) => (p <= 0 ? 0 : 2 ** (10 * (p - 1)));
export const easeOutSine = (p) => Math.sin((Math.PI * p) / 2);
export const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
export const easeOutQuart = (p) => 1 - (1 - p) ** 4;
export const easeInQuart = (p) => p ** 4;
export const easeOutQuint = (p) => 1 - (1 - p) ** 5;
export const easeInQuint = (p) => p ** 5;
export const easeInOutQuint = (p) =>
  (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2);
export function easeOutBack(p, s = 1.70158) {
  const c3 = s + 1;
  return 1 + c3 * (p - 1) ** 3 + s * (p - 1) ** 2;
}

/* ── 文字绘制（对应 Python 的 `main_word` / `status_line` / `micro` / `cursor`）── */
/**
 * 主词绘制：字距排版 + 逐字符错峰淡入 + 塌缩 + 06 L18 宽度上限自适应。
 * `collapse = [t0, perChar, dur, minScale, order]`，order: 'r' | 'l'
 * `perChar = (i, ch, t) => ({dx, dy, sc, a})`
 * 返回 { width, x0, y_top, sx, cells }
 */
export function mainWord(c, t, text, weight, px, trkEm, color, opts = {}) {
  const {
    baseline = null, yTop = null, x = null, align = 'center',
    tIn = null, stagger = 0.012, rise = 6.0, alpha = 1.0, glow = 0.35,
    collapse = null, perChar = null, instant = false, limitPad = 96.0,
    sxOverride = null, sy = 1.0,
  } = opts;
  const f = font(weight, px, c.ss);
  const { cells, total } = cellsOf(f, text, px, trkEm, c.ss);
  const limit = BASE_W - 2.0 * limitPad;
  let sx = total > limit ? limit / total : 1.0;
  if (sxOverride != null) sx = sxOverride;
  if (sx < 0.999) {
    c.note(`主词 ${text} ${Math.round(px)}px 实测 ${Math.round(total)}px > ${limit}px（06 L18 单行上限），横向压缩 ×${sx.toFixed(3)}`);
  }
  const weff = total * sx;
  let x0;
  if (x == null) x0 = align === 'center' ? (BASE_W - weff) * 0.5 : limitPad;
  else x0 = align === 'left' ? x : x - weff * 0.5;
  const asc = f.asc / c.ss;
  let yt = yTop;
  if (yt == null) yt = (baseline != null ? baseline : 0.5 * BASE_H) - asc;
  const baseAbs = yt + asc;
  const out = { width: weff, x0, y_top: yt, sx, cells, natural: total };
  for (let i = 0; i < cells.length; i++) {
    const [ch, xo, adv] = cells[i];
    let aI = alpha, dy = 0.0, sc = 1.0, dx = 0.0;
    if (!instant && tIn != null) {
      const tc = tIn + i * stagger;
      const p = easeOutCubic(phase(t, tc, tc + 0.14));
      aI *= p;
      dy = (1.0 - p) * rise;
    }
    if (collapse != null) {
      const [c0, cper, cdur, cmin, order] = collapse;
      const k = order === 'r' ? cells.length - 1 - i : i;
      const ts = c0 + k * cper;
      const pc = easeInQuint(phase(t, ts, ts + cdur));
      sc *= 1.0 - pc * (1.0 - cmin);
      aI *= 1.0 - pc;
    }
    if (perChar != null) {
      const mod = perChar(i, ch, t) || {};
      dx += mod.dx || 0.0;
      dy += mod.dy || 0.0;
      sc *= mod.sc != null ? mod.sc : 1.0;
      aI *= mod.a != null ? mod.a : 1.0;
    }
    if (aI <= 0.012) continue;
    const gx = x0 + xo * sx + dx + adv * sx * (1.0 - sc) * 0.5;
    const gy = baseAbs - asc * sc + dy;
    c.glyph(ch, gx, gy, f, color, aI, sx * sc, sy * sc, glow * aI);
  }
  return out;
}

/** 终端状态行（JetBrains Mono，对应 Python 的 `status_line`） */
export function statusLine(c, t, text, x, baseline, color, opts = {}) {
  const { px = 28.0, a = 1.0, glow = 0.4, align = 'center', typed = null } = opts;
  const f = font('JetBrains Mono', px, c.ss);
  let s = text;
  if (typed != null) {
    const [t0, cps] = typed;
    s = text.slice(0, Math.max(0, Math.min(text.length, Math.trunc((t - t0) * cps + 1e-9))));
  }
  if (!s) return;
  const w = tw(c, f, s);
  const xx = align === 'center' ? x - w * 0.5 : x;
  c.text(xx, baseline - f.asc / c.ss, s, f, color, a, glow);
}

/** 光标块（对应 Python 的 `cursor`） */
export function cursor(c, x, y, opts = {}) {
  const { w = 14.0, h = 28.0, color = CYAN, a = 1.0, glow = 0.45, on = true } = opts;
  if (!on) return;
  c.rect(x - w * 0.5, y - h * 0.5, x + w * 0.5, y + h * 0.5, color, 0.0, 1.0, a, glow * a);
}

/** 等宽微信息（对应 Python 的 `mono` / `micro`） */
export function mono(c, x, yTop, text, color = GREYBLUE, px = 16.0, a = 1.0,
                    glow = 0.0, anchor = 'la') {
  const f = font('JetBrains Mono', px, c.ss);
  c.text(x, yTop, text, f, color, a, glow, anchor);
}

export function micro(c, x, yTop, text, color = GREYBLUE, px = 16.0, a = 0.75) {
  mono(c, x, yTop, text, color, px, a);
}

/** 闪烁判定（对应 Python 的 `blink_on`） */
export function blinkOn(t, period = 0.53, t0 = 0.0, duty = 0.5) {
  return ((t - t0) % period) < period * duty;
}

/** 四角微信息（对应 Python 的 `corner_info`） */
export function cornerInfo(c, sid, startTime, bl, br, a = 0.6, chapter = 'ch07/12') {
  const f = font('JetBrains Mono', 18.0, c.ss);
  const pad = 26.0;
  c.text(pad, pad, `T+${startTime.toFixed(2)}s`, f, GREYBLUE, a);
  c.text(BASE_W - pad, pad, chapter, f, GREYBLUE, a, 0, 'ra');
  c.text(pad, BASE_H - pad - 18.0, bl, f, GREYBLUE, a);
  c.text(BASE_W - pad, BASE_H - pad - 18.0, br, f, GREYBLUE, a, 0, 'ra');
  return f.asc / c.ss;
}

/* ══════════════════════════════════════════════════════════════════
   PIL 兼容垫片（ch10–ch12）

   ch10–ch12 的 Python 源码是**类 + 裸 PIL ImageDraw 对象**的架构：
   `_rNNN(self, d, gd, t)` 直接在 `ImageDraw.Draw` 上调用 `d.text/ellipse/...`。
   全三章只用到 9 种 PIL 原语（text 26 次、ellipse 18、rectangle 14、line 10、
   polygon 6、arc 2、load 2、paste 2），因此做一层薄垫片即可逐行直译。

   坐标一律按 1920×1080 基准、内部乘 ss —— 与 PIL 版一致。
   ══════════════════════════════════════════════════════════════════ */
export class PilDraw {
  constructor(frame, glowFrame) {
    this.f = frame;
    this.gf = glowFrame || null;
  }

  /* PIL: line(xy, fill=None, width=1, joint=None)
   *  xy 有两种形式：扁平 `[x0,y0,x1,y1]`（两点）或嵌套 `[[x0,y0],[x1,y1],...]`（点列）。
   *  **不能用 `xy.length === 2` 判断**：嵌套的两点形式长度同样是 2。 */
  line(xy, opts = {}) {
    const { fill = null, width = 1, joint = null } = opts;
    if (!fill) return;
    const nested = Array.isArray(xy[0]);
    if (!nested && xy.length === 4) {
      // 扁平的 [x0,y0,x1,y1]
      this.f.line(xy[0], xy[1], xy[2], xy[3], fill, width, 1);
      return;
    }
    // 点列（PIL 会隐式连接）
    for (let i = 0; i < xy.length - 1; i++) {
      this.f.line(xy[i][0], xy[i][1], xy[i + 1][0], xy[i + 1][1], fill, width, 1);
    }
  }

  /* PIL: ellipse(xy, fill=None, outline=None, width=1)  xy 为 [x0,y0,x1,y1] 包围盒 */
  ellipse(xy, opts = {}) {
    const [x0, y0, x1, y1] = xy;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const { fill = null, outline = null, width = 1 } = opts;
    this.f.ell(cx, cy, rx, ry, outline || fill, outline ? width : 0,
               outline ? 1 : 0, 0, fill, fill ? 1 : 0);
  }

  /* PIL: rectangle(xy, fill=None, outline=None, width=1) */
  rectangle(xy, opts = {}) {
    const [x0, y0, x1, y1] = xy;
    const { fill = null, outline = null, width = 1 } = opts;
    this.f.rect(x0, y0, x1, y1, outline || fill, outline ? width : 0,
                outline ? 1 : 0, 0, fill, fill ? 1 : 0);
  }

  /* PIL: polygon(xy, fill=None, outline=None) */
  polygon(xy, opts = {}) {
    const { fill = null, outline = null } = opts;
    if (fill) this._fillPoly(xy, fill, 1);
    if (outline) this.f.pline(xy, outline, 1, 1, 0, this.f.bg, true);
  }

  /** 多边形填充：直接用底层 ctx 画闭合路径
   *  注意 `Frame` 的 2D 上下文挂在 `this.f.d`（不是 `ctx`）。 */
  _fillPoly(pts, color, alpha) {
    const c = this.f.d;
    if (!c) throw new Error('PilDraw._fillPoly: Frame 缺少 2D 上下文（this.f.d）');
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = css(color);
    c.beginPath();
    c.moveTo(pts[0][0] * this.f.ss, pts[0][1] * this.f.ss);
    for (let i = 1; i < pts.length; i++) {
      c.lineTo(pts[i][0] * this.f.ss, pts[i][1] * this.f.ss);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  /* PIL: arc(xy, start, end, fill=None, width=1)  start/end 为度数 */
  arc(xy, start, end, opts = {}) {
    const [x0, y0, x1, y1] = xy;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const { fill = null, width = 1 } = opts;
    this.f.arc(cx, cy, rx, ry, start, end, fill, width, 1, 0);
  }

  /* PIL: text(xy, text, font=..., fill=..., anchor=..., stroke_width=, stroke_fill=) */
  text(xy, s, opts = {}) {
    const [x, y] = xy;
    const { font = null, fill = null, anchor = null, stroke_width = 0,
            stroke_fill = null } = opts;
    if (!fill || !s) return;
    // PIL 字体对象由 pilFont() 构造，内含 fontStr 与 asc
    const fontStr = font && font.fontStr ? font.fontStr : '16px sans-serif';
    const asc = font && font.asc != null ? font.asc : 0;
    let ax = x, align = 'left';
    if (anchor) {
      if (anchor.includes('m')) align = 'center';
      else if (anchor.includes('r')) align = 'right';
    }
    if (align === 'center' || align === 'right') {
      const cv = document.createElement('canvas').getContext('2d');
      cv.font = fontStr;
      const w = cv.measureText(s).width / this.f.dpr;
      ax = align === 'center' ? x - w / 2 : x - w;
    }
    this.f.text(ax, y + asc, s, fontStr, fill, 1, 0, stroke_width);
  }

  /* PIL: paste(im, box, mask) —— 浏览器无等价物，显式抛错 */
  paste() {
    throw new Error('PilDraw.paste 在浏览器无等价物：请把该镜改写为裁剪/合成写法');
  }

  load() {
    return { __pilMask: true,
             getpixel() { return 255; },
             size: [BASE_W, BASE_H] };
  }
}

/** 构造 PIL 风格字体对象（ch10–12 的 `load_font` 返回 (font, stroke)） */
export function pilFont(weight, px, dpr = 1) {
  const fo = fontOf(weight, Math.round(px), dpr);
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fo.font;
  const mm = cv.measureText('Hg');
  return {
    fontStr: fo.font,
    stroke: fo.stroke || 0,
    px: Math.round(px),
    asc: mm.actualBoundingBoxAscent || px * 0.78,
    desc: mm.actualBoundingBoxDescent || px * 0.22,
    getlength(s) {
      const c2 = document.createElement('canvas').getContext('2d');
      c2.font = fo.font;
      return c2.measureText(s).width;
    },
    getmetrics() { return [this.asc, this.desc]; },
    getbbox(s) {
      const c2 = document.createElement('canvas').getContext('2d');
      c2.font = fo.font;
      const m = c2.measureText(s);
      return [0, -m.actualBoundingBoxAscent, m.width,
              m.actualBoundingBoxDescent || 0];
    },
  };
}

/** 构造一个字幕条带描述（供 `Canvas.paste_mask` 使用）
 *
 *  语义对齐 PIL 的 `paste(im, (x,y), mask)` + 蒙版切条：
 *    · `textY`  —— **整词**的 ascender 落点（基准 px）；条带里的文本始终画在这里，
 *                  靠裁剪区 `cy0..cy1` 决定「只露出哪一段」，这样才能得到条带化显影。
 *    · `cy0`/`cy1` —— 本条的裁剪区上下界（基准 px，绝对坐标）。
 *    · `cx0`/`cx1` —— 左右分块时的裁剪区左右界（基准 px，绝对坐标）；不给则不限。
 */
export function maskBand(text, f, opts = {}) {
  const { textY = 0, cy0 = 0, cy1 = 1, cx0 = null, cx1 = null, stroke = 0 } = opts;
  return { text, font: f.font, asc: f.asc, textY, cy0, cy1, cx0, cx1, stroke };
}

/* ── 节拍（唯一来源 beats.json）──────────────────────────────── */
export function makeBeatStore(allBeats) {
  const shotCache = {};
  // 防御：primeShots() 可能在不带 beats 的情况下调用 _init()，
  // 此时 allBeats 为 undefined —— 存成空数组保证 `of()` 可用。
  const ALL = Array.isArray(allBeats) ? allBeats : [];
  return {
    all: ALL,
    of(sid, range) {
      if (!shotCache[sid]) {
        shotCache[sid] = ALL.filter((b) => b >= range[0] - 1e-9 && b <= range[1] + 1e-9);
      }
      return shotCache[sid];
    },
    /** 拍点脉冲包络 0..1（对应 Python 的 `beat_env(sid, t, dur)`） */
    env(sid, t, dur = 0.06, range = null) {
      const bs = range ? this.of(sid, range) : (shotCache[sid] || []);
      let v = 0.0;
      for (const b of bs) {
        if (b <= t && t <= b + dur) v = Math.max(v, Math.sin((Math.PI * (t - b)) / dur));
      }
      return v;
    },
    /** 距下一拍的相位 0..1（对应 Python 的 `next_beat_phase`） */
    nextPhase(sid, t, hint = 0.46, range = null) {
      const bs = range ? this.of(sid, range) : (shotCache[sid] || []);
      for (const b of bs) if (b > t) return clamp01((t - (b - hint)) / hint);
      return 0.0;
    },
    /** steps 相位脉冲（对应 Python 的 `step_pulse`） */
    stepPulse(t, t0, t1) {
      return easeOutCubic(phase(t, t0, t1));
    },
  };
}
