/**
 * ch10.js — 第 10 章 STUDY（镜头 176–186）
 *
 * 自 Python 版 render/scenes/ch10_study.py 移植。
 * 本章属「类 + 裸 PIL」架构：Python 侧 `_Ch10` 持有字体表与自绘方法，
 * `_rNNN(d, gd, t)` 直接用 `ImageDraw` 的 6 种原语。
 * 浏览器侧用 `PilDraw` 垫片 + `pilFont`（见 canvas.js，已由 test_pildraw.mjs 验证）。
 *
 * Python 的 `d`/`gd` 两个 ImageDraw（主层 + 辉光层）在此对应
 * `PilDraw(frame, false)` / `PilDraw(frame, true)`。
 */
import {
  BASE_W as W, BASE_H as H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BLUEVIOLET,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY,
  Rng, phase, clamp01, lerp, steps, mix,
  easeOutCubic, easeInCubic, easeOutExpo, easeInExpo, easeOutQuad, easeInQuad,
  easeInOutQuad, easeInOutSine, easeInOutCubic, easeOutQuart, easeInQuart,
  easeOutQuint, easeInQuint, easeInOutQuint, easeOutBack,
  rad, css,
} from './core.js';
import { Frame, Canvas } from './kit.js';
import { PilDraw, pilFont, mainWord, statusLine, cursor, cornerInfo } from './canvas.js';

const CHAPTER = 'ch10/12';
const FPS = 60;

// ── 常量（取自 Python 源码，不可自造）────────────────────────────
const SEEDS = {
  SHOT_176: '0000176A', SHOT_177: '0000177B', SHOT_178: '0000178C',
  SHOT_179: '0000179D', SHOT_180: '0000180E', SHOT_181: '0000181F',
  SHOT_182: '9A4CDE3F', SHOT_183: '451A1676', SHOT_184: '4CD1353B',
  SHOT_185: 'ED9ECB7B', SHOT_186: '475B68D4',
};
const MICRO = {
  SHOT_176: ['T+177.25s', 'ch10/12', 'seed:0000176A · cards:14', 'STUDY'],
  SHOT_177: ['T+178.17s', 'ch10/12', 'seed:0000177B · nodes:104 · edges:138', 'GRAPH'],
  SHOT_178: ['T+179.16s', 'ch10/12', 'seed:0000178C · sample:3px/2900pt', 'MORPH'],
  SHOT_179: ['T+179.93s', 'ch10/12', 'seed:0000179D · particles:1.0k', 'LOVE'],
  SHOT_180: ['T+180.86s', 'ch10/12', 'seed:0000180E · wait:530ms', 'QUERY'],
  SHOT_181: ['T+181.90s', 'ch10/12', 'seed:0000181F · cards:14+6', 'ANSWER'],
  SHOT_182: ['T+182.88s', 'ch10/12', 'seed:9A4CDE3F · sample:3px/3300pt', 'MORPH'],
  SHOT_183: ['T+183.65s', 'ch10/12', 'seed:451A1676 · particles:2.4k', 'LOVE'],
  SHOT_184: ['T+184.54s', 'ch10/12', 'seed:4CD1353B · rows:5 · vars:5', 'EQN'],
  SHOT_185: ['T+186.29s', 'ch10/12', 'seed:ED9ECB7B · sample:4px/5600pt', 'MORPH'],
  SHOT_186: ['T+187.66s', 'ch10/12', 'seed:475B68D4 · particles:3.6k', 'LOVE'],
};
const BLOOM = {
  SHOT_176: [0.35, 5.0], SHOT_177: [0.34, 5.0], SHOT_178: [0.4, 5.0],
  SHOT_179: [0.42, 5.0], SHOT_180: [0.35, 4.0], SHOT_181: [0.36, 5.0],
  SHOT_182: [0.46, 5.0], SHOT_183: [0.46, 5.0], SHOT_184: [0.36, 5.0],
  SHOT_185: [0.48, 5.0], SHOT_186: [0.52, 5.0],
};
const BLOOM_RADIUS = 9.0;
const VAR_COLOR = { MEMORY: CYAN, TIME: ICE, LOSS: MOOD, DESIRE: RED, CONNECTION: BLUEVIOLET };
// 四个知识簇（06 SHOT_177【主体几何】①）
const CLUSTERS = [
  ['MATH', 28, CYAN, 5.0, 'tl', 'L'],
  ['SENSE', 24, WARM, 5.0, 'tr', 'O'],
  ['MEMORY', 30, MOOD, 6.0, 'bl', 'V'],
  ['LINK', 22, ICE, 5.0, 'br', 'E'],
];
// SHOT_181 的 7 组问答（06【主体几何】③：7 组循环）
const QA = [
  ['WHAT IS MEMORY?', 'MEMORY=TIME^2'],
  ['WHAT IS TIME?', 'TIME=LOSS+D'],
  ['WHAT IS LOSS?', 'LOSS=∫dt'],
  ['WHAT IS DESIRE?', 'DESIRE=f(x)/y'],
  ['WHO ARE YOU?', 'you=VAR(me)'],
  ['WHERE IS HOME?', 'home=MEMORY'],
  ['HOW TO LOVE?', 'LOVE=?'],
];
// 五行公式（06 SHOT_184【文字排版】）
const EQ_ROWS = [
  ['01', [['LOVE', 'LOVE'], [' = ', 'OP'], ['MEMORY', 'MEMORY'], [' + ', 'OP'], ['CONNECTION', 'CONNECTION']]],
  ['02', [['LOVE', 'LOVE'], [' = ', 'OP'], ['MEMORY', 'MEMORY'], [' * ', 'OP'], ['TIME', 'TIME']]],
  ['03', [['LOVE', 'LOVE'], [' = ', 'OP'], ['CONNECTION', 'CONNECTION'], [' - ', 'OP'], ['LOSS', 'LOSS']]],
  ['04', [['LOVE', 'LOVE'], [' = ', 'OP'], ['DESIRE', 'DESIRE'], [' / ', 'OP'],
          ['(', 'OP'], ['1', 'OP'], [' + ', 'OP'], ['LOSS', 'LOSS'], [')', 'OP']]],
  ['05', [['LOVE', 'LOVE'], [' = ', 'OP'], ['MEMORY', 'MEMORY'], [' * ', 'OP'], ['TIME', 'TIME'],
          [' - ', 'OP'], ['LOSS', 'LOSS'], [' + ', 'OP'], ['DESIRE', 'DESIRE']]],
];
// SHOT_186 的 5 个变量腔坐标（SHOT_185 阶段 4 复用同坐标）
const CAVITIES = { MEMORY: [0.31, 0.44], TIME: [0.46, 0.36], LOSS: [0.57, 0.58],
                   DESIRE: [0.68, 0.42], CONNECTION: [0.50, 0.64] };
const VAR_ORDER = ['MEMORY', 'TIME', 'LOSS', 'DESIRE', 'CONNECTION'];

/* ── 顶层 helper（对应 Python 的同名函数）────────────────────── */
/** 把登记色按不透明度 a 混到背景上（06 §2 纪律：不引入新色） */
function _C(col, a, bg = BG_DEEP) {
  const k = a < 0.0 ? 0.0 : (a > 1.0 ? 1.0 : a);
  return [Math.trunc(col[0] * k + bg[0] * (1 - k)),
          Math.trunc(col[1] * k + bg[1] * (1 - k)),
          Math.trunc(col[2] * k + bg[2] * (1 - k))];
}
const _ease_out_cubic = easeOutCubic;
const _ease_in_out_cubic = easeInOutCubic;
const _ease_out_quad = easeOutQuad;
const _ease_in_quad = easeInQuad;
const _ease_out_expo = easeOutExpo;
const _ease_in_out_sine = easeInOutSine;
function _ease_out_back(p) { const q = p - 1.0; return q * q * ((1.70158 + 1) * q + 1.70158) + 1.0; }
function _ease_in_cubic(p) { return p ** 3; }
/** 二次缓入缓出（Python 侧与 render_core 的同名函数一致） */
function _ease_in_out_quad(p) {
  return p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
}
function _frame(t) { return Math.round(t * FPS); }
/** hard cut 闪帧：t0 起 frames 帧内为真 */
function _flash(t, t0, frames = 2) { return (_frame(t) - _frame(t0)) >= 0 && (_frame(t) - _frame(t0)) < frames; }
/** steps(2) 型闪烁 */
function _blink(t, t0, period, duty = 0.5) {
  if (t < t0) return false;
  return ((t - t0) % period) < period * duty;
}
/** 逐字符错峰起点：保证末字符 + 淡入在 t_end 前完成 */
function _stagger_start(hint, n, stagger, fade, tEnd) {
  return Math.min(hint, tEnd - Math.max(0, n - 1) * stagger - fade);
}
/** 点集里确定性取 n 个（不足则循环） */
function _spread(pts, n) {
  const m = pts.length;
  if (m === 0) return [];
  if (n <= m) { const o = []; for (let i = 0; i < n; i++) o.push(pts[Math.trunc((i * m) / n)]); return o; }
  const o = []; for (let i = 0; i < n; i++) o.push(pts[i % m]); return o;
}
function _bezier(p0, p1, p2, u) {
  const v = 1.0 - u;
  return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
          v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]];
}
/** 从 (cx,cy) 指向 (x,y) 的射线与矩形边界的交点 */
function _rect_perimeter_hit(cx, cy, hw, hh, x, y) {
  const dx = x - cx, dy = y - cy;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return [cx, cy];
  const ts = [];
  if (Math.abs(dx) > 1e-9) ts.push(hw / Math.abs(dx));
  if (Math.abs(dy) > 1e-9) ts.push(hh / Math.abs(dy));
  const s = Math.min(...ts);
  return [cx + dx * s, cy + dy * s];
}
/** PIL 的 stroke 语义：描边宽度 > 0.4 时才描边 */
function _text(d, xy, s, font, stroke, col) {
  if (stroke && stroke > 0.4) {
    d.text(xy, s, { font, fill: col, strokeWidth: Math.round(stroke), strokeFill: col });
  } else {
    d.text(xy, s, { font, fill: col });
  }
}
function _tracked_w(font, text, tracking) {
  if (!text) return 0.0;
  let w = 0;
  for (const ch of text) w += font.getlength(ch);
  return w + tracking * (text.length - 1);
}

/* 字形栅格化与点阵采样：ch10–12 共用的几何层（原在本文件的实现已抽出） */
import {
  glyphMask as _glyphMask, sampleFill as _sampleFill, sampleOutline as _sampleOutline,
  loveLayout as _loveLayout, sampleTextFill as _sampleTextFill,
} from './glyphgeom.js';

/* ── _Ch10 等价类 ────────────────────────────────────────────── */
class Ch10 {
  constructor(ss = 1) {
    this.ss = Math.trunc(ss);
    this.W = W * this.ss;
    this.H = H * this.ss;
    this.notes = [];
    // 字体表：与 Python 的 F 键一致（缺失即抛异常，禁系统回退）
    this.F = {};
    for (const [weight, px] of [
      ['Inter Semi-Bold', 176], ['Inter Semi-Bold', 168], ['Inter Semi-Bold', 144],
      ['Inter Extra-Bold', 240], ['Inter Bold', 330], ['Inter Bold', 412],
      ['Inter Bold', 240], ['JetBrains Mono', 96], ['JetBrains Mono', 68],
      ['JetBrains Mono', 46], ['JetBrains Mono', 42], ['JetBrains Mono', 22],
      ['JetBrains Mono', 20], ['JetBrains Mono', 16],
    ]) {
      this.F[`${weight}|${px}`] = pilFont(weight, px, this.ss);
    }
    this.op_col = _C(GREY, 0.60);
    this.seeds = {};
    for (const sid of Object.keys(SEEDS)) this.seeds[sid] = parseInt(SEEDS[sid], 16);
    this._build_176();
    this._build_177();
    this._build_178();
    this._build_179();
    this._build_180();
    this._build_181();
    this._build_182();
    this._build_183();
    this._build_184();
    this._build_185();
    this._build_186();
  }

  /** 取字体（键形如 'Inter Semi-Bold|176'） */
  _f(key) { return this.F[key]; }

  _txt(d, gd, x, y, s, key, col, glowK = 0.5) {
    const font = this.F[key];
    _text(d, [x * this.ss, y * this.ss], s, font, font.stroke, col);
    if (gd && glowK > 0) {
      _text(gd, [x * this.ss, y * this.ss], s, font, font.stroke,
            col.map((v) => Math.trunc(v * glowK)));
    }
  }

  /** 逐字符带字距绘制；`segs=[{i0,i1,col}]`；`reveal(i)->[alpha,dy]` */
  _char_line(d, gd, fontKey, text, x, baseline, tracking, ss, opts = {}) {
    const { segs = null, reveal = null, glowCol = null } = opts;
    const font = this.F[fontKey];
    const asc = font.asc;
    const y = baseline - asc;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let col = ICE;
      if (segs) {
        for (const s of segs) { if (i >= s.i0 && i < s.i1) { col = s.col; break; } }
      }
      const [a, dy] = reveal === null ? [1.0, 0.0] : reveal(i);
      if (a > 0.02) {
        const use = _C(col, a);
        _text(d, [cx * ss, (y + dy) * ss], ch, font, font.stroke, use);
        if (gd) {
          const gc = glowCol || col;
          _text(gd, [cx * ss, (y + dy) * ss], ch, font, font.stroke,
                gc.map((v) => Math.trunc(v * a * 0.5)));
        }
      }
      cx += font.getlength(ch) + tracking;
    }
    return cx;
  }

  /** 四角微信息（对应 Python 的 _micro） */
  _micro(d, sid, alpha = 0.6, pad = 26.0, px = 16) {
    const [tl, tr, bl, br] = MICRO[sid];
    const col = _C(GREY, alpha);
    const font = this.F[`JetBrains Mono|${px}`];
    const ss = this.ss;
    d.text([pad * ss, pad * ss], tl, { font, fill: col });
    d.text([(W - pad) * ss - font.getlength(tr), pad * ss], tr, { font, fill: col });
    d.text([pad * ss, (H - pad - px) * ss], bl, { font, fill: col });
    d.text([(W - pad) * ss - font.getlength(br), (H - pad - px) * ss], br, { font, fill: col });
  }

  /** 圆点：PIL 用正方形近似（与 Python 一致，非 ctx.arc） */
  _dot(d, gd, x, y, r, col, a = 1.0, glowK = 0.45) {
    const ss = this.ss;
    const c = _C(col, a);
    const rr = Math.max(1.0, r);
    d.rectangle([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss], { fill: c });
    if (gd && glowK > 0) {
      const g = col.map((v) => Math.trunc(v * a * glowK));
      gd.rectangle([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss], { fill: g });
    }
  }

  _line(d, gd, p0, p1, col, a = 1.0, width = 1.0, glowK = 0.45) {
    const ss = this.ss;
    const c = _C(col, a);
    const wpx = Math.max(1, Math.round(width * ss));
    d.line([p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss], { fill: c, width: wpx });
    if (gd && glowK > 0) {
      const g = col.map((v) => Math.trunc(v * a * glowK));
      gd.line([p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss], { fill: g, width: wpx });
    }
  }

  /** 把基线抬到「字形可见顶边 ≥ min_top」，避免大字号顶到画布外 */
  _clamp_baseline(fkey, baseline, minTop = 6.0) {
    const font = this.F[fkey];
    const bb = font.getbbox('H');
    const cap = bb[3] - bb[1];
    if (baseline - cap < minTop) return minTop + cap;
    return baseline;
  }

  /** 卡面标本图形（局部 0..1 坐标的折线/点集）
   *  注意：Python 用 `int(rng.state)` 作嵌套种子 —— 对应 `Rng` 的公开字段 `.state`。 */
  _specimen(kind, rng) {
    const st = rng.state;
    if (kind === 'sin') {
      const l = [];
      for (let u = 0; u <= 40; u++) l.push([u / 40.0, 0.5 - 0.30 * Math.sin((2 * Math.PI * 2.2 * u) / 40.0)]);
      return { lines: [l], dots: [] };
    }
    if (kind === 'circle') {
      const l = [], l2 = [];
      for (let i = 0; i <= 48; i++) {
        l.push([0.5 + 0.34 * Math.cos((2 * Math.PI * i) / 48.0),
                0.5 + 0.34 * Math.sin((2 * Math.PI * i) / 48.0)]);
      }
      l2.push([0.5, 0.5], [0.84, 0.5]);
      return { lines: [l, l2], dots: [] };
    }
    if (kind === 'tangent') {
      const a = [], b = [], c = [];
      for (let u = 0; u <= 20; u++) {
        a.push([u / 20.0, 0.62 - 0.55 * (u / 20.0)]);
        b.push([u / 20.0, 0.52]);
        c.push([u / 20.0, 0.40 + 0.62 * (u / 20.0)]);
      }
      return { lines: [a, b, c], dots: [] };
    }
    if (kind === 'limit') {
      const a = [];
      for (let u = 0; u <= 32; u++) a.push([u / 32.0, 0.86 - 0.62 * (1.0 - Math.exp((-3.4 * u) / 32.0))]);
      return { lines: [a, [[0.02, 0.86], [0.98, 0.86]]], dots: [] };
    }
    if (kind === 'voronoi') {
      const polys = [];
      for (let i = 0; i < 5; i++) {
        const r = new Rng(st, 'vor', i);
        const cxp = r.range(0.15, 0.85), cyp = r.range(0.15, 0.85);
        const rd = r.range(0.08, 0.20);
        const poly = [];
        for (let k = 0; k < 5; k++) {
          const th = (2 * Math.PI * k) / 5.0 + r.range(0, 1);
          poly.push([cxp + rd * Math.cos(th), cyp + rd * Math.sin(th)]);
        }
        polys.push(poly);
      }
      return { lines: polys, dots: [] };
    }
    if (kind === 'cloud') {
      const pts = [];
      for (let i = 0; i < 46; i++) {
        pts.push([new Rng(st, 'cl', i).next(),
                  new Rng(st, 'cl2', i).next()]);
      }
      return { lines: [], dots: pts };
    }
    // composite（第 14 张：正弦波 + 切线，双色）
    const sinL = [], t1 = [], t2 = [];
    for (let u = 0; u <= 40; u++) sinL.push([u / 40.0, 0.55 - 0.30 * Math.sin((2 * Math.PI * 1.6 * u) / 40.0)]);
    for (let u = 0; u <= 20; u++) {
      t1.push([u / 20.0, 0.30 + 0.60 * (u / 20.0)]);
      t2.push([u / 20.0, 0.86 - 0.46 * (u / 20.0)]);
    }
    return { lines: [sinL, t1, t2], dots: [] };
  }

  /* ═════════ SHOT_176  177.25–178.17  卡片翻页 + 第 14 张急停放大 ═════════ */
  _build_176() {
    const seed = this.seeds.SHOT_176;
    const cards = [];
    const kinds = ['sin', 'circle', 'tangent', 'limit', 'voronoi', 'cloud'];
    for (let i = 0; i < 14; i++) {
      // 扇形堆：x=26% 起、前后堆叠偏移 14px、倾斜 -6°～+6°
      const cx = 498.0 + i * 12.0 + 110.0;
      const cy = 306.0 + i * 13.0 + 150.0;
      const tilt = -6.0 + 12.0 * (i / 13.0);
      const kind = i === 13 ? 'composite' : kinds[i % 6];
      const rng = new Rng(seed, 'card-spec', i);
      cards.push({ cx, cy, tilt, kind, rng_i: i, spec: this._specimen(kind, rng) });
    }
    const flip_a = [], flip_d = [];
    for (let i = 0; i < 14; i++) {
      if (i < 6) { flip_a.push(177.25 + 0.030 * i); flip_d.push(0.15); }
      else { flip_a.push(177.40 + 0.062 * (i - 6)); flip_d.push(0.06); }
    }
    this.p176 = { cards, flip_a, flip_d };
    const f176 = this.F['Inter Semi-Bold|176'];
    this.p176.track = 0.05 * 176;
    this.p176.x = 0.10 * W;
    this.p176.baseline = 0.13 * H;
    this.p176.width = _tracked_w(f176, "I've studied", this.p176.track);
  }

  _r176(d, gd, t) {
    const ss = this.ss;
    const P = this.p176;
    const stop_t = 177.92;
    const stroke_a = 0.45 + 0.40 * _ease_out_cubic(phase(t, 177.92, 178.06));
    for (let i = 0; i < P.cards.length; i++) {
      const c = P.cards[i];
      const s_i = P.flip_a[i], d_i = P.flip_d[i];
      let phi;
      if (i === 13) {
        phi = t < stop_t
          ? 78.0 * _ease_out_cubic(phase(t, s_i, s_i + d_i))
          : 78.0 * (1.0 - _ease_out_back(phase(t, stop_t, 178.06)));
      } else {
        phi = 168.0 * _ease_out_cubic(phase(t, s_i, s_i + d_i));
      }
      const sx = Math.cos(rad(phi));
      const front = sx >= 0.0;
      let k = 1.0;
      let cx = c.cx, cy = c.cy;
      if (i === 13 && t >= stop_t) {
        const g = _ease_out_back(phase(t, stop_t, 178.06));
        cx = lerp(c.cx, 0.5 * W, Math.min(1.0, Math.max(0.0, g)));
        cy = lerp(c.cy, 0.5 * H, Math.min(1.0, Math.max(0.0, g)));
        k = lerp(1.0, 1.15, Math.min(1.0, Math.max(0.0, g)));
      }
      const cw = 220.0 * k, chh = 300.0 * k;
      const asx = Math.abs(sx);
      if (asx < 0.02) continue;
      const tilt = c.tilt;
      const kk = rad(tilt);
      const corners = [];
      for (const [dx, dy] of [[-cw / 2, -chh / 2], [cw / 2, -chh / 2],
                              [cw / 2, chh / 2], [-cw / 2, chh / 2]]) {
        const xx = dx * asx, yy = dy;
        corners.push([(cx + xx * Math.cos(kk) - yy * Math.sin(kk)) * ss,
                      (cy + xx * Math.sin(kk) + yy * Math.cos(kk)) * ss]);
      }
      d.polygon(corners, { fill: _C(BG_ALT, 0.70) });
      if (front) {
        // 正面标本图形（双色 06【主体几何】②）
        const cols = { sin: CYAN, circle: BLUEVIOLET, tangent: ICE, limit: MOOD, voronoi: GREY, cloud: CYAN };
        const lineCols = c.kind === 'composite' ? [CYAN, ICE, ICE]
          : new Array(c.spec.lines.length).fill(cols[c.kind]);
        for (let li = 0; li < c.spec.lines.length; li++) {
          const col = lineCols[li % lineCols.length];
          const pts = [];
          for (const [px, py] of c.spec.lines[li]) {
            const lx = (px - 0.5) * cw * 0.76, ly = (py - 0.5) * chh * 0.76;
            const xx = lx * asx, yy = ly;
            pts.push([(cx + xx * Math.cos(kk) - yy * Math.sin(kk)) * ss,
                      (cy + xx * Math.sin(kk) + yy * Math.cos(kk)) * ss]);
          }
          if (pts.length > 1) {
            d.line(pts, { fill: _C(col, 0.9), width: Math.max(1, Math.round(1.5 * ss)) });
            gd.line(pts, { fill: col.map((v) => Math.trunc(v * 0.45)),
                           width: Math.max(1, ss) });
          }
        }
        for (const [px, py] of c.spec.dots) {
          const lx = (px - 0.5) * cw * 0.76, ly = (py - 0.5) * chh * 0.76;
          const xx = lx * asx, yy = ly;
          const ax = cx + xx * Math.cos(kk) - yy * Math.sin(kk);
          const ay = cy + xx * Math.sin(kk) + yy * Math.cos(kk);
          this._dot(d, gd, ax, ay, 1.2, CYAN, 0.9);
        }
      } else if (asx > 0.70) {
        // 背面：`SAMPLE_nn` mono 16px 30%
        const txt = `SAMPLE_${String(i + 1).padStart(2, '0')}`;
        const font = this.F['JetBrains Mono|16'];
        const tw = font.getlength(txt) * asx;
        const col = _C(GREY, 0.30 * asx);
        d.text([(cx - tw / 2) * ss, (cy - 8) * ss], txt, { font, fill: col });
      }
      // 描边 1.5px
      const a_edge = (i === 13 && t >= stop_t) ? 0.95 : stroke_a;
      d.line([...corners, corners[0]], { fill: _C(MOOD, a_edge), width: Math.max(1, Math.round(1.5 * ss)) });
      gd.line([...corners, corners[0]], { fill: MOOD.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    }
    // 主词逐字符淡入（14ms 错峰，y+6px，easeOutCubic）
    const txt = "I've studied";
    const n = txt.length;
    const t0 = _stagger_start(177.95, n, 0.014, 0.06, 178.17);
    const segs = [{ i0: 0, i1: 6, col: ICE }, { i0: 6, i1: n, col: MOOD }];
    const rev = (idx) => {
      const tc = t0 + idx * 0.014;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|176', txt, this.p176.x,
                    this.p176.baseline, this.p176.track, ss, { segs, reveal: rev });
    this._micro(d, 'SHOT_176');
  }

  /* ═════════ SHOT_177  178.17–179.1556  四簇知识图 ═════════ */
  _build_177() {
    const seed = this.seeds.SHOT_177;
    // 四簇紧凑点团（三分构图四交点），中心留十字空隙
    const centers = { tl: [0.33 * W, 0.40 * H], tr: [0.67 * W, 0.40 * H],
                      bl: [0.33 * W, 0.68 * H], br: [0.67 * W, 0.68 * H] };
    const rx = 0.115 * W, ry = 0.085 * H;
    const nodes = [], masters = [];
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const [name, cnt, col, rad_, box, letter] = CLUSTERS[ci];
      const [bcx, bcy] = centers[box];
      for (let i = 0; i < cnt; i++) {
        const r = new Rng(seed, `node-${name}`, i);
        const th = 2 * Math.PI * r.next();
        const rr = Math.sqrt(r.next());
        const r0 = new Rng(seed, `node0-${name}`, i);
        nodes.push({
          cluster: ci, name, color: col, r: rad_,
          tgt: [bcx + rx * rr * Math.cos(th), bcy + ry * rr * Math.sin(th)],
          init: [lerp(0.5 * W - 120, 0.5 * W + 120, r0.next()),
                 lerp(0.5 * H - 160, 0.5 * H + 160, r0.next())],
          letter, idx: i, cidx: nodes.length,
          delay: (i % 28) * 0.004 + ci * 0.020,
        });
      }
      masters.push({ cluster: ci, name, color: col, letter, pos: [bcx, bcy],
                     cidx: cnt, box, blob: [bcx, bcy, rx, ry] });
    }
    // 138 条连线：簇内密（链 + 隔点）、簇间疏（各簇主节点互连）
    let pairs = [];
    let off = 0;
    for (const [name, cnt] of CLUSTERS.map((c) => [c[0], c[1]])) {
      for (let i = 0; i < cnt - 1; i++) pairs.push([off + i, off + i + 1]);
      for (let i = 0; i < cnt - 2; i += 3) pairs.push([off + i, off + i + 2]);
      off += cnt;
    }
    const mIdx = [];
    off = 0;
    for (const [, cnt] of CLUSTERS.map((c) => [c[0], c[1]])) { mIdx.push(off); off += cnt; }
    for (let a = 0; a < 4; a++) {
      pairs.push([mIdx[a], mIdx[(a + 1) % 4]]);
      pairs.push([mIdx[a], mIdx[(a + 2) % 4]]);
    }
    pairs = pairs.slice(0, 138);
    this.p177 = { nodes, pairs, masters, centers, rx, ry };
    // 60 颗卡片塌陷残尘
    this.p177.dust = [];
    for (let i = 0; i < 60; i++) {
      const r = new Rng(seed, 'dust', i);
      this.p177.dust.push({ x: r.range(0.2 * W, 0.8 * W), y: r.range(0.2 * H, 0.8 * H),
                            ph: r.next(), amp: r.range(8.0, 34.0) });
    }
    this.p177.labels = masters.map((m) => [m.name, m.pos, m.color]);
  }

  _r177(d, gd, t) {
    const ss = this.ss;
    const P = this.p177;
    const T0 = 178.17, T1 = 179.1556;
    // 阶段 1：标本卡塌陷 + 硬切消失
    const collapse = _ease_in_quad(phase(t, T0, 178.30));
    const card_a = 1.0 - collapse;
    if (card_a > 0.02) {
      const cw = 253.0 * (1.0 - 0.35 * collapse), chh = 345.0 * (1.0 - 0.35 * collapse);
      d.polygon([[(0.5 * W - cw / 2) * ss, (0.5 * H - chh / 2) * ss],
                 [(0.5 * W + cw / 2) * ss, (0.5 * H - chh / 2) * ss],
                 [(0.5 * W + cw / 2) * ss, (0.5 * H + chh / 2) * ss],
                 [(0.5 * W - cw / 2) * ss, (0.5 * H + chh / 2) * ss]],
                { outline: _C(MOOD, 0.85 * card_a), width: Math.max(1, Math.round(1.5 * ss)) });
    }
    // 阶段 2：节点迁往四簇目标位（簇内 4ms 错峰）
    const arrive = P.nodes.map((nd) => _ease_out_cubic(phase(t, 178.30 + nd.delay, 178.30 + nd.delay + 0.30)));
    // 阶段 3：连线自各簇主节点向外生长
    const scale = 1.0 + 0.015 * _ease_in_out_sine(phase(t, 179.00, T1));
    const cxg = 0.5 * W, cyg = 0.5 * H;
    const pos = [];
    for (let k = 0; k < P.nodes.length; k++) {
      const nd = P.nodes[k], p = arrive[k];
      const x = lerp(nd.init[0], nd.tgt[0], p);
      const y = lerp(nd.init[1], nd.tgt[1], p);
      pos.push([cxg + (x - cxg) * scale, cyg + (y - cyg) * scale]);
    }
    // 残尘
    for (const du of P.dust) {
      const dx = du.x + du.amp * Math.sin(2 * Math.PI * (0.13 * t + du.ph));
      const dy = du.y + du.amp * 0.6 * Math.cos(2 * Math.PI * (0.11 * t + du.ph * 1.7));
      this._dot(d, gd, dx, dy, 1.0, GREY, 0.12, 0.0);
    }
    // 连线
    for (let k = 0; k < P.pairs.length; k++) {
      const a = P.pairs[k][0], b = P.pairs[k][1];
      const gp = _ease_out_expo(phase(t, 178.74 + k * 0.006, 178.74 + k * 0.006 + 0.16));
      if (gp <= 0.0) continue;
      let x0 = pos[a][0], y0 = pos[a][1], x1 = pos[b][0], y1 = pos[b][1];
      if (gp < 1.0) { x1 = lerp(x0, x1, gp); y1 = lerp(y0, y1, gp); }
      const bright = _flash(t, 178.74 + k * 0.006, 2) ? 1.0 : 0.45;
      const col = bright > 0.9 ? ICE : BLUEVIOLET;
      d.line([x0 * ss, y0 * ss, x1 * ss, y1 * ss], { fill: _C(col, bright), width: Math.max(1, ss) });
      if (bright > 0.9) {
        gd.line([x0 * ss, y0 * ss, x1 * ss, y1 * ss],
                { fill: ICE.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
      }
    }
    // 节点
    for (let k = 0; k < P.nodes.length; k++) {
      if (arrive[k] <= 0.0) continue;
      const nd = P.nodes[k];
      const x = pos[k][0], y = pos[k][1];
      const tb = 178.30 + nd.delay + 0.30;
      let bump = 1.0;
      if (t >= tb) {
        const q = clamp01((t - tb) / 0.070);
        bump = q < 1.0 ? 1.0 + 0.5 * Math.sin(Math.PI * q) : 1.0;
      }
      const a = arrive[k] > 0.6 ? 1.0 : arrive[k] / 0.6;
      const rr = nd.r * bump;
      d.ellipse([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss],
                { fill: _C(nd.color, a) });
      gd.ellipse([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss],
                 { fill: nd.color.map((v) => Math.trunc(v * a * 0.45)) });
    }
    // 每簇主节点：r=13px 空心环 2px，同色 80%
    const master_p = _ease_out_cubic(phase(t, 178.74, 179.00));
    for (const m of P.masters) {
      if (master_p <= 0.0) continue;
      const pulse = _flash(t, 179.10, 4) ? 1.08 : 1.0;
      const r = 13.0 * master_p * pulse;
      const cx = m.pos[0], cy = m.pos[1];
      d.ellipse([(cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss],
                { outline: _C(m.color, 0.80 * master_p), width: Math.max(1, Math.round(2 * ss)) });
      gd.ellipse([(cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss],
                 { outline: m.color.map((v) => Math.trunc(v * 0.4)), width: Math.max(1, ss) });
    }
    // 主词两行（144px、行距 1.06、左缘 8%W、首行基线 y=9%）
    const txt1 = "I've studied how", txt2 = 'to properly';
    const n1 = txt1.length, n2 = txt2.length;
    const t0 = _stagger_start(178.70, n1 + n2, 0.014, 0.06, T1);
    const base1 = this._clamp_baseline('Inter Semi-Bold|144', 0.09 * H);
    const base2 = base1 + 1.06 * 144;
    const rev1 = (idx) => {
      const tc = t0 + idx * 0.014;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    const rev2 = (idx) => {
      const tc = t0 + (n1 + idx) * 0.014;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    const xLeft = 0.08 * W;
    this._char_line(d, gd, 'Inter Semi-Bold|144', txt1, xLeft, base1, 0.03 * 144, ss,
                    { segs: [{ i0: 0, i1: n1, col: ICE }], reveal: rev1 });
    this._char_line(d, gd, 'Inter Semi-Bold|144', txt2, xLeft, base2, 0.03 * 144, ss,
                    { segs: [{ i0: 0, i1: n2, col: MOOD }], reveal: rev2 });
    this._micro(d, 'SHOT_177');
  }

  /* ═════════ SHOT_178  179.1556–179.93  图结构 2900 点吸附为 LOVE 点阵 ═════════ */
  _build_178() {
    const seed = this.seeds.SHOT_178;
    // 图结构按 3px 步长重采样 ≈2900 点；每点带「簇→字母」映射
    let src = [];
    const nodes = this.p177.nodes;
    const pos = nodes.map((nd) => nd.tgt);
    for (const [a, b] of this.p177.pairs) {
      const x0 = pos[a][0], y0 = pos[a][1], x1 = pos[b][0], y1 = pos[b][1];
      const letter = nodes[a].letter;
      for (let k = 0; k < 12; k++) {
        const u = (k + 0.5) / 12.0;
        src.push([lerp(x0, x1, u), lerp(y0, y1, u), BLUEVIOLET, letter]);
      }
    }
    for (const nd of nodes) {
      for (let k = 0; k < 3; k++) {
        const r = new Rng(seed, 'nodept', nd.cidx * 3 + k);
        src.push([nd.tgt[0] + r.range(-6, 6), nd.tgt[1] + r.range(-6, 6), nd.color, nd.letter]);
      }
    }
    for (let j = 0; j < this.p177.dust.length; j++) {
      const du = this.p177.dust[j];
      src.push([du.x, du.y, GREY, CLUSTERS[j % 4][5]]);
    }
    // LOVE 点阵（宽 58%W、视觉高 170px、居中 (50%,52%)）
    const font = this.F['Inter Bold|330'];
    const lay = _loveLayout(font, 0.58 * W, 170.0, 0.5 * W, 0.52 * H, this.ss, 'fill', 3);
    const per = lay.per;
    src = _spread(src, 2900);
    // 按字母分组后各自吸附到本字母的点阵
    const byLetter = {};
    for (let i = 0; i < src.length; i++) {
      const lt = src[i][3];
      (byLetter[lt] = byLetter[lt] || []).push(i);
    }
    const tgt = new Array(src.length).fill(null);
    for (const letter of Object.keys(byLetter)) {
      const idxs = byLetter[letter];
      const pool = per[letter] || lay.all;
      const sp = _spread(pool, idxs.length);
      for (let j = 0; j < idxs.length; j++) tgt[idxs[j]] = sp[j];
    }
    this.p178 = { src, tgt, per };
    // 300 颗未吸附漂浮粒子（12%），其中 30 颗情绪紫记忆碎片
    this.p178.free = [];
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'free', i);
      this.p178.free.push({ x: r.range(0.06 * W, 0.94 * W), y: r.range(0.10 * H, 0.90 * H),
                            ph: r.next(), purple: i < 30, amp: r.range(6, 22) });
    }
    this.p178.memory_pts = src.filter((s) => s[2] === MOOD).slice(0, 30);
  }

  _r178(d, gd, t) {
    const ss = this.ss;
    const P = this.p178;
    const T0 = 179.1556, T1 = 179.93;
    // 阶段 1：连线闪一次 ICE 1 帧
    const flash = _flash(t, 179.20, 1) || _flash(t, 179.22, 1) || _flash(t, 179.25, 1);
    void flash;
    // 阶段 2：按簇→字母映射吸附（每簇 30ms 错峰）
    const pAbs = 1.0 - _ease_in_out_cubic(phase(t, 179.28, 179.62));
    const pts = [];
    for (let i = 0; i < P.src.length; i++) {
      const [sx, sy, col] = P.src[i];
      const tx = P.tgt[i][0], ty = P.tgt[i][1];
      const k = _ease_in_out_cubic(phase(t, 179.28 + (i % 4) * 0.03, 179.28 + (i % 4) * 0.03 + 0.30));
      pts.push([lerp(sx, tx, k), lerp(sy, ty, k), col, k]);
    }
    if (t < 179.28) {
      for (const [sx, sy, col] of P.src) this._dot(d, gd, sx, sy, 1.3, col, 0.85, 0.35);
    } else {
      const cx = 0.5 * W, cy = 0.52 * H;
      for (const [x, y, col, k] of pts) {
        const a = 0.35 + 0.55 * k;
        this._dot(d, gd, cx + (x - cx) * (1.0 - 0.02 * pAbs),
                  cy + (y - cy) * (1.0 - 0.02 * pAbs), 1.3, col, a, 0.40);
      }
    }
    // 阶段 3：四字母依次 hard cut 点亮 2 帧（间隔 50ms）
    let lit = null;
    const FULL = 'LOVE';
    for (let li = 0; li < 4; li++) {
      if (_flash(t, 179.62 + li * 0.05, 2)) lit = FULL[li];
    }
    if (lit && P.per[lit]) {
      for (const [x, y] of P.per[lit]) this._dot(d, gd, x, y, 2.0, ICE, 1.0, 0.6);
    }
    // 阶段 4：300 颗余粒子自轮廓边缘析出
    const eff = _ease_out_quad(phase(t, 179.82, T1));
    for (const fr of P.free) {
      const ex = fr.x + fr.amp * Math.sin(2 * Math.PI * (0.16 * t + fr.ph));
      const ey = fr.y + fr.amp * 0.7 * Math.cos(2 * Math.PI * (0.13 * t + fr.ph * 1.3));
      const col = fr.purple ? MOOD : BLUEVIOLET;
      this._dot(d, gd, ex, ey, 1.2, col, 0.12 + 0.30 * eff, 0.2);
    }
    // 主词两行完整至 179.40s，随后 2 帧残影清除
    if (t < 179.42) {
      const fade = t < 179.40 ? 1.0 : Math.max(0.0, 1.0 - (t - 179.40) / 0.02);
      const txt1 = "I've studied how", txt2 = 'to properly';
      const base1 = this._clamp_baseline('Inter Semi-Bold|144', 0.09 * H);
      this._char_line(d, gd, 'Inter Semi-Bold|144', txt1, 0.08 * W, base1, 0.03 * 144, ss,
                      { segs: [{ i0: 0, i1: txt1.length, col: _C(ICE, fade) }] });
      this._char_line(d, gd, 'Inter Semi-Bold|144', txt2, 0.08 * W, base1 + 1.06 * 144,
                      0.03 * 144, ss,
                      { segs: [{ i0: 0, i1: txt2.length, col: _C(MOOD, fade) }] });
    }
    this._micro(d, 'SHOT_178');
  }

  /* ═════════ SHOT_179  179.93–180.86  LOVE 实体化（描边/波形/碎片/轨迹）═════════ */
  _build_179() {
    const seed = this.seeds.SHOT_179;
    const font = this.F['Inter Bold|330'];
    const LW = 0.44 * W, LH = 240.0;
    this._LOVE179_W = LW;
    this._LOVE179_H = LH;
    const outline = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'outline', 3).all;
    const fillp = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'fill', 4).all;
    this.p179 = { outline, fill: fillp };
    // ① 数学符号粒子 30%
    this.p179.math = [];
    const mo = _spread(outline, 300);
    for (let i = 0; i < mo.length; i++) {
      const r = new Rng(seed, 'math', i);
      this.p179.math.push({ x: mo[i][0] + r.range(-2, 2), y: mo[i][1] + r.range(-2, 2),
                            rot: r.range(-8, 8), ph: r.next() });
    }
    // ② 波形粒子 25%（4Hz 正弦穿字区）
    this.p179.wave = [];
    for (let i = 0; i < 250; i++) {
      const u = i / 249.0;
      this.p179.wave.push({ x: lerp(0.5 * W - LW / 2, 0.5 * W + LW / 2, u), u });
    }
    // ③ 记忆碎片 30%（3–6px 多边形）：分布在字身点阵上，保证字形可读
    this.p179.shards = [];
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'shard', i);
      const bp = fillp.length ? fillp[(i * 7919) % fillp.length] : [0.5 * W, 0.5 * H];
      this.p179.shards.push({ x: bp[0], y: bp[1], rad: r.range(1.5, 3.0),
                              rot: r.next() * 360.0, ph: r.next() });
    }
    // ④ 轨迹粒子 15%：ICE / WARM 各一条贝塞尔，18 颗拖尾点
    this.p179.trails = [
      { col: ICE, p0: [0.14 * W, 0.34 * H], p1: [0.5 * W, 0.24 * H], p2: [0.88 * W, 0.66 * H] },
      { col: WARM, p0: [0.86 * W, 0.70 * H], p1: [0.5 * W, 0.82 * H], p2: [0.12 * W, 0.44 * H] },
    ];
    // 阶段 1 的 300 颗漂浮粒子（承接 SHOT_178）
    this.p179.floating = this.p178.free.map((f) => [f.x, f.y, f.purple ? MOOD : BLUEVIOLET]);
    this.p179.W = LW;
    this.p179.H = LH;
    this.p179.t0 = _stagger_start(180.72, 8, 0.014, 0.06, 180.86);
  }

  _r179(d, gd, t) {
    const ss = this.ss;
    const P = this.p179;
    const T0 = 179.93, T1 = 180.86;
    void T1;
    // 阶段 1：300 漂浮粒子 + 点阵以 easeOutExpo 收束为 LOVE 实体
    const conv = _ease_out_expo(phase(t, T0, 180.14));
    const body = (t >= 180.72 && t <= 180.86)
      ? 1.0 + 0.03 * Math.sin(Math.PI * clamp01((t - 180.72) / 0.14)) : 1.0;
    const cx = 0.5 * W, cy = 0.5 * H;
    const outline = P.outline;
    for (let i = 0; i < outline.length; i++) {
      if (i % 2) continue;
      const xx = cx + (outline[i][0] - cx) * body;
      const yy = cy + (outline[i][1] - cy) * body;
      this._dot(d, gd, xx, yy, 1.2, ICE, 0.90 * (0.35 + 0.65 * conv), 0.5);
    }
    for (let i = 0; i < P.floating.length; i++) {
      const fx = P.floating[i][0], fy = P.floating[i][1], col = P.floating[i][2];
      const k = _ease_out_expo(clamp01(conv * 1.2));
      const pool = P.fill.length ? P.fill : outline;
      const tp = pool[(i * 13) % pool.length];
      const x = lerp(fx, tp[0], k), y = lerp(fy, tp[1], k);
      if (k >= 0.999) continue;
      this._dot(d, gd, x, y, 1.2, col, 0.12 + 0.5 * (1 - k), 0.3);
    }
    if (t < 180.14) { this._micro(d, 'SHOT_179'); return 0.0; }
    // 阶段 2：字内微运动
    for (const m of P.math) {
      const ang = rad(m.rot * Math.sin(2 * Math.PI * (0.35 * t + m.ph)));
      const x = cx + (m.x - cx) * body + 2.0 * Math.cos(ang);
      const y = cy + (m.y - cy) * body + 2.0 * Math.sin(ang);
      this._dot(d, gd, x, y, 1.0, CYAN, 0.75, 0.35);
    }
    for (const wv of P.wave) {
      const u = wv.u;
      const flow = (u + 0.6 * t) % 1.0;
      const x = lerp(cx - P.W / 2, cx + P.W / 2, flow);
      const y = cy + (u - 0.5) * P.H * 0.9 + 16.0 * Math.sin(2 * Math.PI * (4 * flow));
      this._dot(d, gd, x, y, 0.75, BLUEVIOLET, 0.55, 0.3);
    }
    // 记忆碎片：opacity 0.7↔1.0 呼吸（周期 520ms）
    const breath = 0.7 + 0.3 * _ease_in_out_sine(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 0.52));
    for (const s of P.shards) {
      const x = cx + (s.x - cx) * body;
      const y = cy + (s.y - cy) * body;
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const a2 = rad(s.rot + k * 72);
        pts.push([(x + s.rad * Math.cos(a2)) * ss, (y + s.rad * Math.sin(a2)) * ss]);
      }
      d.polygon(pts, { outline: _C(MOOD, breath * 0.85) });
    }
    // 阶段 3：两条轨迹自两侧进入、沿字外缘掠过
    if (t >= 180.40) {
      const uHead = _ease_in_out_cubic(phase(t, 180.40, 180.80));
      for (const tr of P.trails) {
        for (let k = 0; k < 18; k++) {
          const u = uHead - k * 0.022;
          if (u < 0.0 || u > 1.0) continue;
          const bp = _bezier(tr.p0, tr.p1, tr.p2, u);
          this._dot(d, gd, bp[0], bp[1], 1.3, tr.col, 0.9 * (1.0 - k / 18.0), 0.5);
        }
      }
    }
    // 阶段 4：次词 `LO-O-OVE` mono 46px
    if (t >= 180.72) {
      const a = clamp01((t - 180.72) / 0.20);
      const font = this.F['JetBrains Mono|46'];
      const txt = 'LO-O-OVE';
      const tw = font.getlength(txt);
      const col = _C(MOOD, a);
      _text(d, [(0.5 * W - tw / 2) * ss, (0.78 * H - 46) * ss], txt, font, 0.0, col);
      _text(gd, [(0.5 * W - tw / 2) * ss, (0.78 * H - 46) * ss], txt, font, 0.0,
            MOOD.map((v) => Math.trunc(v * a * 0.4)));
    }
    this._micro(d, 'SHOT_179');
    return 0.0;
  }

  /* ═════════ SHOT_180  180.86–181.90  QUERY：LOVE 粒子 → 640×200 查询框 ═════════ */
  _build_180() {
    this.p180 = {};
    const pts = this.p179.outline.filter((_, i) => i % 2 === 0);
    const bx = 0.5 * W, by = 0.46 * H, bw = 640.0, bh = 200.0;
    this.p180.dst = pts.map(([x, y]) => _rect_perimeter_hit(bx, by, bw / 2, bh / 2, x, y));
    this.p180.src = pts;
    this.p180.box = [bx, by, bw, bh];
    this.p180.resid = this.p178.free.map((f) => [f.x, f.y, f.purple ? MOOD : BLUEVIOLET]);
    this.p180.t_main0 = _stagger_start(181.74, 11, 0.014, 0.06, 181.90);
    this.p180.dashes = [0.60 * H, 0.64 * H, 0.68 * H];
  }

  _r180(d, gd, t) {
    const ss = this.ss;
    const P = this.p180;
    const T0 = 180.86;
    const bx = P.box[0], by = P.box[1], bw = P.box[2], bh = P.box[3];
    // 阶段 1：外缘粒子向内收拢，描边 steps(4) 四边依次闭合
    const cp = _ease_in_quad(phase(t, T0, 181.00));
    const edges = steps(t, 4, T0, 181.00);
    if (t < 181.02) {
      for (let i = 0; i < P.src.length; i++) {
        const x = lerp(P.src[i][0], P.dst[i][0], cp);
        const y = lerp(P.src[i][1], P.dst[i][1], cp);
        this._dot(d, gd, x, y, 1.2, MOOD, 0.35 + 0.5 * cp, 0.4);
      }
    }
    // 框线（圆角 4px，1.5px 80%）
    const aBox = 0.80, r = 4.0;
    const x0 = bx - bw / 2, y0 = by - bh / 2, x1 = bx + bw / 2, y1 = by + bh / 2;
    const seg = [[[x0 + r, y0], [x1 - r, y0]], [[x1, y0 + r], [x1, y1 - r]],
                 [[x1 - r, y1], [x0 + r, y1]], [[x0, y1 - r], [x0, y0 + r]]];
    for (let k = 0; k < seg.length; k++) {
      if (k > edges && t < 181.00) continue;
      this._line(d, gd, seg[k][0], seg[k][1], MOOD, aBox, 1.5, 0.5);
    }
    for (const [ccx, ccy, a0, a1] of [[x0 + r, y0 + r, 180, 270], [x1 - r, y0 + r, 270, 360],
                                      [x1 - r, y1 - r, 0, 90], [x0 + r, y1 - r, 90, 180]]) {
      d.arc([(ccx - r) * ss, (ccy - r) * ss, (ccx + r) * ss, (ccy + r) * ss], a0, a1,
            { fill: _C(MOOD, aBox), width: Math.max(1, Math.round(1.5 * ss)) });
    }
    // ② 幽灵 `?` mono 96px 20%
    if (t >= 181.00) {
      const font = this.F['JetBrains Mono|96'];
      _text(d, [(x0 + 28) * ss, (y0 + 26) * ss], '?', font, 0.0, _C(MOOD, 0.20));
    }
    // ③ 光标 2px×34px，530ms steps(2) blink
    const curX = 0.24 * W, curY = 0.46 * H;
    let on = true;
    if (t >= 181.30) on = _blink(t, 181.30, 0.530, 0.5);
    if (t >= 181.00 && on) {
      this._dot(d, gd, curX + 1, curY, 1.0, CYAN, 1.0, 0.6);
      d.rectangle([curX * ss, (curY - 17) * ss, (curX + 2) * ss, (curY + 17) * ss], { fill: CYAN });
    }
    // ③ 3 条等待虚线自左向右线性流动（12%W/s）
    if (t >= 181.30) {
      const dashW = 12.0, gapW = 8.0, total = 560.0;
      const off = (0.12 * W * (t - 181.30)) % (dashW + gapW);
      for (const dy of P.dashes) {
        let xx = 0.5 * W - total / 2 - off;
        while (xx < 0.5 * W + total / 2) {
          const xa = Math.max(xx, 0.5 * W - total / 2);
          const xb = Math.min(xx + dashW, 0.5 * W + total / 2);
          if (xb > xa) this._line(d, gd, [xa, dy], [xb, dy], GREY, 0.30, 1.0, 0.0);
          xx += dashW + gapW;
        }
      }
    }
    // ④ LOVE 粒子残余 180 颗贴框外缘漂浮（12%）
    const res = _spread(P.resid, 180);
    for (let k = 0; k < res.length; k++) {
      const fx = res[k][0], fy = res[k][1], col = res[k][2];
      const ax = fx + 6.0 * Math.sin(2 * Math.PI * (0.14 * t + k * 0.017));
      const ay = fy + 6.0 * Math.cos(2 * Math.PI * (0.11 * t + k * 0.013));
      this._dot(d, gd, ax, ay, 1.1, col, 0.12, 0.15);
    }
    // 主词 `Question me` 168px、左缘 10%W、基线 y=27%
    const txt = 'Question me';
    const n = txt.length;
    const t0 = P.t_main0;
    const segs = [{ i0: 0, i1: 8, col: MOOD }, { i0: 8, i1: n, col: ICE }];
    const rev = (idx) => {
      const tc = t0 + idx * 0.014;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|168', txt, 0.10 * W, 0.27 * H,
                    0.05 * 168, ss, { segs, reveal: rev });
    // 次词 `input:` mono 46px @ 框右下角
    const f46 = this.F['JetBrains Mono|46'];
    _text(d, [(x1 - 150) * ss, (y1 + 10) * ss], 'input:', f46, 0.0, _C(GREY, 0.8));
    this._micro(d, 'SHOT_180');
    return 0.05 * _ease_out_cubic(phase(t, 181.74, 181.90));
  }

  /* ═════════ SHOT_181  181.90–182.88  ANSWER：20 张问答卡瀑布 ═════════ */
  _build_181() {
    const cards = [];
    // 主瀑布 14 张：自 y=34% 向下堆叠；尾部 6 张「半出场」
    for (let i = 0; i < 20; i++) {
      const [q, a] = QA[i % 7];
      let x, y;
      if (i < 14) { x = 0.30 * W + i * 88.0; y = 0.34 * H + i * 94.0; }
      else { const k = i - 14; x = 0.14 * W + k * 78.0; y = 0.27 * H + k * 56.0; }
      cards.push({ i, q, a: 'A: ' + a, x, y, pop: 181.90 + i * 0.042 });
    }
    this.p181 = { cards };
    this.p181.t_main0 = _stagger_start(182.76, 28, 0.014, 0.06, 182.88);
  }

  _r181(d, gd, t) {
    const ss = this.ss;
    const P = this.p181;
    const cw = 420.0, chh = 86.0;
    const font20 = this.F['JetBrains Mono|20'];
    const font22 = this.F['JetBrains Mono|22'];
    const flow = _ease_in_quad(phase(t, 182.56, 182.76)) * 160.0;
    // 尾部 6 张先画（在主流之下）
    for (const c of P.cards) {
      if (c.i < 14 || t < c.pop) continue;
      const reveal = 30.0 + 56.0 * _ease_out_cubic(phase(t, c.pop, c.pop + 0.24));
      const x = c.x, y = c.y + flow;
      if (y > H + 120) continue;
      const hh = Math.min(chh, reveal);
      d.rectangle([x * ss, y * ss, (x + cw) * ss, (y + hh) * ss],
                  { fill: _C(BG_ALT, 0.80), outline: _C(MOOD, 0.40),
                    width: Math.max(1, Math.round(1.0 * ss)) });
      if (hh >= 60) {
        _text(d, [(x + 18) * ss, (y + 14) * ss], 'Q:', font20, 0.0, _C(GREY, 1.0));
        _text(d, [(x + 52) * ss, (y + 11) * ss], c.q, font22, 0.0, _C(ICE, 0.8));
      }
    }
    for (const c of P.cards) {
      if (c.i >= 14) continue;
      let k;
      if (c.i === 0) k = 1.0;                 // 首卡 = 原问题框 hard cut 裂变而来
      else {
        if (t < c.pop) continue;
        k = Math.min(1.0, _ease_out_back(phase(t, c.pop, c.pop + 0.09)));
      }
      const sc = lerp(0.9, 1.0, clamp01(k));
      let x = c.x;
      let y = c.y + flow + (-40.0 * (1.0 - clamp01(k)));
      // 阶段 2：答案逐字填入（22ms/字符）后卡片右下平移 6px
      const ansN = c.a.length;
      let typed = Math.trunc(Math.max(0.0, t - (c.pop + 0.10)) / 0.022);
      typed = Math.max(0, Math.min(ansN, typed));
      const shift = _ease_out_cubic(phase(t, c.pop + 0.10 + ansN * 0.022,
                                         c.pop + 0.10 + ansN * 0.022 + 0.12)) * 6.0;
      x += shift; y += shift;
      const w = cw * sc, h = chh * sc;
      if (y > H + 120 || x > W + 120 || y + h < -20) continue;
      d.rectangle([x * ss, y * ss, (x + w) * ss, (y + h) * ss],
                  { fill: _C(BG_ALT, 0.80), outline: _C(MOOD, 0.55),
                    width: Math.max(1, Math.round(1.0 * ss)) });
      if ([11, 12, 13].includes(c.i) && _flash(t, 182.80, 1)) {
        d.rectangle([x * ss, y * ss, (x + w) * ss, (y + h) * ss],
                    { outline: ICE, width: Math.max(1, Math.round(1.5 * ss)) });
      }
      if (h >= 60) {
        _text(d, [(x + 18) * ss, (y + 14) * ss], 'Q:', font20, 0.0, _C(GREY, 1.0));
        _text(d, [(x + 52) * ss, (y + 11) * ss], c.q, font22, 0.0, ICE);
        _text(d, [(x + 18) * ss, (y + 48) * ss], 'A:', font20, 0.0, _C(GREY, 1.0));
        const shown = c.a.slice(0, typed);
        _text(d, [(x + 52) * ss, (y + 45) * ss], shown, font22, 0.0, CYAN);
        _text(gd, [(x + 52) * ss, (y + 45) * ss], shown, font22, 0.0,
              CYAN.map((v) => Math.trunc(v * 0.45)));
      }
      // 首卡内光标
      if (c.i === 0 && typed < ansN) {
        const cx = x + 52 + font22.getlength(c.a.slice(0, typed));
        d.rectangle([cx * ss, (y + 42) * ss, (cx + 2) * ss, (y + 70) * ss], { fill: CYAN });
      }
    }
    // 主词两行
    const txt1 = 'Question me I can', txt2 = 'answer all';
    const n1 = txt1.length, n2 = txt2.length;
    const t0 = P.t_main0;
    const base1 = this._clamp_baseline('Inter Semi-Bold|144', 0.08 * H);
    const base2 = base1 + 1.04 * 144;
    const mk = (off) => (idx) => {
      const tc = t0 + (off + idx) * 0.014;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|144', txt1, 0.08 * W, base1, 0.03 * 144, ss,
                    { segs: [{ i0: 0, i1: n1, col: ICE }], reveal: mk(0) });
    this._char_line(d, gd, 'Inter Semi-Bold|144', txt2, 0.08 * W, base2, 0.03 * 144, ss,
                    { segs: [{ i0: 0, i1: n2, col: CYAN }], reveal: mk(n1) });
    this._micro(d, 'SHOT_181');
  }

  /* ═════════ SHOT_182  182.88–183.65  MORPH：卡片 3300 点吸附为扩张 LOVE ═════════ */
  _build_182() {
    const seed = this.seeds.SHOT_182;
    let src = [];
    // 卡片文字按 3px 步长重采样；卡面矩形框 4px
    const f22 = this.F['JetBrains Mono|22'];
    for (const c of this.p181.cards) {
      const i = c.i;
      for (const [txt, col] of [[c.q, ICE], [c.a, CYAN]]) {
        if (i % 2 === 0) {
          const pts = _sampleTextFill(txt, f22, this.ss, 3, c.y + 11, c.x + 52);
          for (let j = 0; j < pts.length; j += 3) src.push([pts[j][0], pts[j][1], col]);
        }
      }
      for (let k = 0; k < 14; k++) {
        const u = k / 14.0;
        src.push([c.x + u * 420.0, c.y, MOOD]);
        src.push([c.x + u * 420.0, c.y + 86.0, MOOD]);
      }
      for (let k = 0; k < 5; k++) {
        const v = (k + 0.5) / 5.0;
        src.push([c.x, c.y + v * 86.0, MOOD]);
        src.push([c.x + 420.0, c.y + v * 86.0, MOOD]);
      }
    }
    // 扩张态 LOVE 点阵（宽 74%W、视觉高 300px）
    const font = this.F['Inter Bold|412'];
    const lay = _loveLayout(font, 0.74 * W, 300.0, 0.5 * W, 0.5 * H, this.ss, 'fill', 4);
    src = _spread(src, 3300);
    const tgt = _spread(lay.all, src.length);
    this.p182 = { src, tgt, per: lay.per };
    // 400 颗卡屑（12%）
    this.p182.dust = [];
    for (let i = 0; i < 400; i++) {
      const r = new Rng(seed, 'dust', i);
      this.p182.dust.push({ x: r.range(0.2 * W, 0.9 * W), y: r.range(0.3 * H, 0.9 * H),
                            vx: r.range(-30, 30), vy: r.range(40, 120), ph: r.next() });
    }
    this.p182.t_main0 = _stagger_start(182.442, 28, 0.014, 0.06, 183.65);
  }

  _r182(d, gd, t) {
    const ss = this.ss;
    const P = this.p182;
    const T0 = 182.88, T1 = 183.65;
    // 阶段 1：微字线性消失；20 张卡片描边闪一次
    const cardA = 1.0 - clamp01((t - T0) / 0.08);
    if (cardA > 0.02) {
      const flash = _flash(t, T0, 1);
      for (const c of this.p181.cards) {
        const col = flash ? ICE : MOOD;
        d.rectangle([c.x * ss, c.y * ss, (c.x + 420) * ss, (c.y + 86) * ss],
                    { outline: _C(col, 0.55 * cardA), width: Math.max(1, ss) });
      }
    }
    // 阶段 2：按 3px/4px 采样吸附（下半部 20ms 延迟）
    const samp = 1.0 - _ease_in_out_cubic(phase(t, 183.02, 183.40));
    const cx = 0.5 * W, cy = 0.5 * H;
    for (let i = 0; i < P.src.length; i++) {
      const sx = P.src[i][0], sy = P.src[i][1], col = P.src[i][2];
      const tx = P.tgt[i][0], ty = P.tgt[i][1];
      const dly = sy < 0.5 * H ? 0.0 : 0.020;
      const k = _ease_in_out_cubic(phase(t, 183.02 + dly, 183.02 + dly + 0.34));
      const x = lerp(sx, tx, k), y = lerp(sy, ty, k);
      this._dot(d, gd, cx + (x - cx) * (1.0 - 0.02 * samp),
                cy + (y - cy) * (1.0 - 0.02 * samp), 1.3, col, 0.5 + 0.5 * k, 0.4);
    }
    // 阶段 3：L→O→V→E 各 2 帧 hard cut 点亮
    let lit = null;
    const FULL = 'LOVE';
    for (let li = 0; li < 4; li++) if (_flash(t, 183.40 + li * 0.045, 2)) lit = FULL[li];
    if (lit && P.per[lit]) {
      for (const [x, y] of P.per[lit]) this._dot(d, gd, x, y, 2.0, ICE, 1.0, 0.6);
    }
    // 阶段 4：400 颗卡屑改向汇入字缘
    const con = _ease_in_out_cubic(phase(t, 183.56, T1));
    for (let k = 0; k < P.dust.length; k++) {
      const du = P.dust[k];
      let x, y;
      if (t < 183.56) {
        x = du.x + du.vx * (t - T0);
        y = du.y + du.vy * (t - T0);
      } else {
        const x0 = du.x + du.vx * (183.56 - T0);
        const y0 = du.y + du.vy * (183.56 - T0);
        const tp = P.tgt[(k * 7) % P.tgt.length];
        x = lerp(x0, tp[0], con);
        y = lerp(y0, tp[1], con);
      }
      if (x >= 0 && x <= W && y >= 0 && y <= H) {
        this._dot(d, gd, x, y, 1.1, MOOD, 0.12 + 0.35 * con, 0.25);
      }
    }
    // 主词两行（承接 SHOT_181）
    if (t < 183.18) {
      const txt1 = 'Question me I can', txt2 = 'answer all';
      const n1 = txt1.length;
      const t0 = P.t_main0;
      const base1 = this._clamp_baseline('Inter Semi-Bold|144', 0.08 * H);
      const base2 = base1 + 1.04 * 144;
      const mk = (off) => (idx) => {
        const tc = t0 + (off + idx) * 0.014;
        const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
        return [p, (1.0 - p) * 6.0];
      };
      this._char_line(d, gd, 'Inter Semi-Bold|144', txt1, 0.08 * W, base1, 0.03 * 144, ss,
                      { segs: [{ i0: 0, i1: n1, col: ICE }], reveal: mk(0) });
      this._char_line(d, gd, 'Inter Semi-Bold|144', txt2, 0.08 * W, base2, 0.03 * 144, ss,
                      { segs: [{ i0: 0, i1: txt2.length, col: CYAN }], reveal: mk(n1) });
    }
    this._micro(d, 'SHOT_182');
  }

  /** 5 个变量微词的环绕位置：椭圆轨道 + 上下避让（保证不压字身） */
  _orbit_slots() {
    const rx = this._LOVE183_W / 2 + 160.0, ry = this._LOVE183_H / 2 + 170.0;
    const inkTop = 0.5 * H - this._LOVE183_H / 2;
    const inkBot = 0.5 * H + this._LOVE183_H / 2;
    const out = [];
    for (let k = 0; k < VAR_ORDER.length; k++) {
      const th = rad(-90.0 + k * 72.0);
      const x = 0.5 * W + rx * Math.cos(th);
      let y = 0.5 * H + ry * Math.sin(th);
      y = y < 0.5 * H ? inkTop - 46.0 : inkBot + 46.0;
      out.push([VAR_ORDER[k], [x, y]]);
    }
    return out;
  }

  /* ═════════ SHOT_183  183.65–184.54  LOVE 粒子字（5 变量环绕）═════════ */
  _build_183() {
    const seed = this.seeds.SHOT_183;
    const font = this.F['Inter Bold|412'];
    const LW = 0.74 * W, LH = 300.0;
    this._LOVE183_W = LW;
    this._LOVE183_H = LH;
    const outline = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'outline', 3).all;
    const fillp = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'fill', 4).all;
    this.p183 = { outline, fill: fillp };
    this.p183.math = [];
    const mo = _spread(outline, 600);
    for (let i = 0; i < mo.length; i++) {
      const r = new Rng(seed, 'math', i);
      this.p183.math.push({ x: mo[i][0], y: mo[i][1], rot: r.range(-10, 10), ph: r.next() });
    }
    this.p183.wave = [];
    for (let i = 0; i < 350; i++) this.p183.wave.push({ u: i / 349.0 });
    this.p183.shards = [];
    for (let i = 0; i < 840; i++) {
      const r = new Rng(seed, 'shard', i);
      const bp = fillp.length ? fillp[(i * 6151) % fillp.length] : [0.5 * W, 0.5 * H];
      this.p183.shards.push({ x: bp[0], y: bp[1], rad: r.range(1.5, 3.5),
                              rot: r.next() * 360.0, ph: r.next() });
    }
    this.p183.trails = [
      { col: ICE, p0: [0.08 * W, 0.30 * H], p1: [0.5 * W, 0.10 * H], p2: [0.94 * W, 0.62 * H] },
      { col: WARM, p0: [0.92 * W, 0.74 * H], p1: [0.5 * W, 0.94 * H], p2: [0.06 * W, 0.42 * H] },
    ];
    this.p183.W = LW;
    this.p183.H = LH;
    this.p183.vars = this._orbit_slots();
    this.orbit_slots = this.p183.vars;
    this.p183.var_anchor = ['c', 'r', 'c', 'l', 'l'];
    // 阶段 1：新增粒子自四角 easeInQuad 飞入字区
    this.p183.inflow = [];
    for (let i = 0; i < 1400; i++) {
      const r = new Rng(seed, 'inflow', i);
      const corner = i % 4;
      const sx = (corner === 0 || corner === 2) ? 0.0 : W;
      const sy = (corner === 0 || corner === 1) ? 0.0 : H;
      const pool = fillp.length ? fillp : outline;
      const tp = pool.length ? pool[(i * 13) % pool.length] : [0.5 * W, 0.5 * H];
      this.p183.inflow.push({ sx, sy, tx: tp[0], ty: tp[1], d: r.range(0.0, 0.14) });
    }
  }

  _r183(d, gd, t) {
    const ss = this.ss;
    const P = this.p183;
    const T0 = 183.65;
    const cx = 0.5 * W, cy = 0.5 * H;
    const pulse = t >= 184.42
      ? 1.0 + 0.04 * Math.sin(Math.PI * clamp01((t - 184.42) / 0.12)) : 1.0;
    const ent = _ease_out_expo(phase(t, T0, 183.86));
    // ① 字形边缘 4px 描边层（可读性保证）
    for (let i = 0; i < P.outline.length; i++) {
      if (i % 3) continue;
      const xx = cx + (P.outline[i][0] - cx) * pulse;
      const yy = cy + (P.outline[i][1] - cy) * pulse;
      this._dot(d, gd, xx, yy, 1.2, ICE, 0.92, 0.5);
    }
    // ① 新增粒子自四角飞入
    for (const p of P.inflow) {
      const k = _ease_in_quad(phase(t, T0 + p.d, T0 + p.d + 0.21));
      if (k >= 1.0) continue;
      this._dot(d, gd, lerp(p.sx, p.tx, k), lerp(p.sy, p.ty, k), 1.1, MOOD, 0.3 + 0.6 * k, 0.3);
    }
    // ② 双波形（4Hz / 7Hz，相位差 π/3）
    for (const wv of P.wave) {
      const u = wv.u;
      const f1 = (u + 0.9 * t) % 1.0;
      const f2 = (u + 1.4 * t) % 1.0;
      const x = lerp(cx - P.W / 2, cx + P.W / 2, u);
      const y1 = cy - 0.22 * P.H * Math.sin(2 * Math.PI * 4 * f1);
      const y2 = cy + 0.24 * P.H * Math.sin(2 * Math.PI * 7 * f2 + Math.PI / 3);
      this._dot(d, gd, x, y1, 0.75, BLUEVIOLET, 0.5, 0.3);
      this._dot(d, gd, x, y2, 0.75, BLUEVIOLET, 0.4, 0.3);
    }
    // 数学符号（rotate ±10°）
    for (const m of P.math) {
      const ang = rad(m.rot * Math.sin(2 * Math.PI * (0.4 * t + m.ph)));
      this._dot(d, gd, cx + (m.x - cx) * pulse + 2.4 * Math.cos(ang),
                cy + (m.y - cy) * pulse + 2.4 * Math.sin(ang), 1.0, CYAN, 0.7, 0.35);
    }
    // 记忆碎片呼吸 0.7↔1.0（480ms）
    const br = 0.7 + 0.3 * _ease_in_out_sine(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 0.48));
    for (const s of P.shards) {
      const x = cx + (s.x - cx) * pulse;
      const y = cy + (s.y - cy) * pulse;
      const pts = [];
      for (let kk = 0; kk < 5; kk++) {
        const a2 = rad(s.rot + kk * 72);
        pts.push([(x + s.rad * Math.cos(a2)) * ss, (y + s.rad * Math.sin(a2)) * ss]);
      }
      d.polygon(pts, { outline: _C(MOOD, br * 0.8 * (0.3 + 0.7 * ent)) });
    }
    // ③ 两条轨迹绕行字外缘（3/4 周长）
    const uHead = 0.75 * _ease_in_out_cubic(phase(t, 184.20, 184.42));
    for (const tr of P.trails) {
      for (let k = 0; k < 24; k++) {
        const u = uHead - k * 0.02;
        if (u < 0.0 || u > 1.0) continue;
        const bp = _bezier(tr.p0, tr.p1, tr.p2, u);
        this._dot(d, gd, bp[0], bp[1], 1.3, tr.col, 0.85 * (1 - k / 24.0), 0.5);
      }
    }
    // ③ 5 个变量微词 + r=3px 前导点（40ms 错峰）
    if (t >= 184.20) {
      const font = this.F['JetBrains Mono|46'];
      for (let k = 0; k < P.vars.length; k++) {
        if (t < 184.20 + k * 0.040) continue;
        const name = P.vars[k][0], vx = P.vars[k][1][0], vy = P.vars[k][1][1];
        const tw = font.getlength(name);
        const anchor = P.var_anchor[k];
        const tx = anchor === 'c' ? vx - tw / 2.0 : (anchor === 'r' ? vx - tw : vx);
        _text(d, [tx * ss, (vy - 23) * ss], name, font, 0.0, _C(GREY, 0.60));
        const lx = tx - 16.0;
        this._dot(d, gd, lx, vy, 3.0, GREY, 0.6, 0.15);
        if (t < 184.20 + k * 0.040 + 0.06) this._dot(d, gd, lx, vy, 5.0, ICE, 0.7, 0.5);
      }
    }
    // ③ 次词 `LO-O-OVE` mono 46px @ (50%,84%)
    const aSub = clamp01((t - 184.42) / 0.12);
    if (aSub > 0.02) {
      const font = this.F['JetBrains Mono|46'];
      const txt = 'LO-O-OVE';
      const tw = font.getlength(txt);
      _text(d, [(0.5 * W - tw / 2) * ss, (0.84 * H - 46) * ss], txt, font, 0.0, _C(MOOD, aSub));
      _text(gd, [(0.5 * W - tw / 2) * ss, (0.84 * H - 46) * ss], txt, font, 0.0,
            MOOD.map((v) => Math.trunc(v * aSub * 0.4)));
    }
    this._micro(d, 'SHOT_183');
    return 0.0;
  }

  /* ═════════ SHOT_184  184.54–186.29  EQN：五行公式逐行打字 + 扫描线 ═════════ */
  _build_184() {
    const ss = this.ss;
    void ss;
    const font = this.F['JetBrains Mono|46'];
    const track = 0.02 * 46;
    const xEq = 0.12 * W;
    const rows = [];
    for (let ri = 0; ri < EQ_ROWS.length; ri++) {
      const [num, segs] = EQ_ROWS[ri];
      const baseline = 0.38 * H + ri * 96.0;
      const chars = [];
      let x = xEq;
      for (const [txt, key] of segs) {
        const col = Object.prototype.hasOwnProperty.call(VAR_COLOR, key)
          ? VAR_COLOR[key] : this.op_col;
        for (const ch of txt) {
          chars.push({ ch, x, col, key });
          x += font.getlength(ch) + track;
        }
      }
      const varFirst = {};
      for (const c of chars) {
        if (Object.prototype.hasOwnProperty.call(VAR_COLOR, c.key)
            && varFirst[c.key] === undefined) varFirst[c.key] = c.x;
      }
      rows.push({ num, chars, baseline, var_first: varFirst, ri });
    }
    this.p184 = { rows, track, x_eq: xEq, divider_y: 0.30 * H, divider_w: 0.76 * W,
                  title_x: 0.12 * W, title_top: 0.10 * H, sub_y: 0.28 * H };
    // 标题 `LOVE` Inter ExtraBold 240px：墨顶 y=10%
    const ftitle = this.F['Inter Extra-Bold|240'];
    const bb = ftitle.getbbox('LOVE');
    const cap = bb[3] - bb[1];
    this.p184.title_baseline = 0.10 * H + cap;
    this.p184.title_w = ftitle.getlength('LOVE');
    this.p184.title_pts = _sampleTextFill('LOVE', ftitle, this.ss, 4, 0.10 * H, 0.12 * W);
    // 承接 SHOT_183 的粒子字（上移收缩为标题）
    this.p184.src = this.p183.outline.filter((_, i) => i % 2 === 0);
    const pool = this.p184.title_pts.length ? this.p184.title_pts : this.p183.outline;
    this.p184.tgt = _spread(pool, this.p184.src.length);
  }

  _r184(d, gd, t) {
    const ss = this.ss;
    const P = this.p184;
    const T0 = 184.54, T1 = 186.2872;
    // 阶段 1：LOVE 粒子字上移收缩为 240px 实体标题
    const shrink = _ease_in_out_cubic(phase(t, T0, 184.76));
    if (shrink < 1.0) {
      for (let i = 0; i < P.src.length; i++) {
        this._dot(d, gd, lerp(P.src[i][0], P.tgt[i][0], shrink),
                  lerp(P.src[i][1], P.tgt[i][1], shrink), 1.2, MOOD, 0.75, 0.45);
      }
    }
    // 标题（实体，184.74 后完全接管）
    if (shrink >= 0.92) {
      const a = clamp01((shrink - 0.92) / 0.08);
      const font = this.F['Inter Extra-Bold|240'];
      const y = P.title_baseline - font.asc;
      _text(d, [P.title_x * ss, y * ss], 'LOVE', font, 0.0, _C(MOOD, a));
      _text(gd, [P.title_x * ss, y * ss], 'LOVE', font, 0.0,
            MOOD.map((v) => Math.trunc(v * a * 0.5)));
    }
    // 分隔线（easeOutExpo 拉开至 76%W）
    const dw = P.divider_w * _ease_out_expo(phase(t, T0, 184.76));
    if (dw > 1) {
      this._line(d, gd, [P.x_eq, P.divider_y], [P.x_eq + dw, P.divider_y], MOOD, 0.40, 1.0, 0.25);
    }
    // 次词 `algebraic expression`
    const font46 = this.F['JetBrains Mono|46'];
    _text(d, [(P.title_x + P.title_w + 40) * ss, (P.sub_y - 46) * ss],
          'algebraic expression', font46, 0.0, _C(GREY, 0.85));
    // 阶段 1：5 个变量微词自环绕轨道下落至右侧操作数预备位
    const drop = _ease_out_cubic(phase(t, T0, 184.76));
    const slot0 = {};
    for (const [nm, pos] of this.orbit_slots) slot0[nm] = pos;
    for (const name of VAR_ORDER) {
      const op = slot0[name];
      if (!op) continue;
      let slot = null, rowIdx = -1;
      for (const row of P.rows) {
        if (row.var_first[name] !== undefined) { slot = [row.var_first[name], row.baseline]; rowIdx = row.ri; break; }
      }
      if (slot === null) continue;
      const x = lerp(op[0], slot[0], drop);
      const y = lerp(op[1] + 23, slot[1], drop);
      const fadeStart = 184.76 + rowIdx * 0.040;
      const a = t >= fadeStart ? 1.0 - clamp01((t - fadeStart) / 0.08) : 1.0;
      if (a > 0.02 && drop > 0.9) {
        _text(d, [(x - 20) * ss, (y - 36) * ss], name, font46, 0.0, _C(VAR_COLOR[name], 0.75 * a));
      }
    }
    // 阶段 2：逐行打字（每行 160ms、行间 40ms stagger）
    const numFont = this.F['JetBrains Mono|20'];
    for (const row of P.rows) {
      const n = row.chars.length;
      const rowStart = 184.76 + row.ri * 0.040;
      const step = 0.160 / Math.max(1, n);
      if (t >= rowStart - 0.060) {
        _text(d, [0.08 * W * ss, (row.baseline - 20) * ss], row.num, numFont, 0.0, _C(GREY, 0.9));
      }
      for (let j = 0; j < row.chars.length; j++) {
        const c = row.chars[j];
        const tApp = rowStart + (j + 1) * step;
        if (t < tApp) continue;
        const age = t - tApp;
        const col = age < 0.12
          ? CYAN.map((v, i2) => Math.trunc(v + (c.col[i2] - v) * (age / 0.12)))
          : c.col;
        _text(d, [c.x * ss, (row.baseline - 46) * ss], c.ch, font46, 0.0, col);
      }
    }
    // 阶段 3：1px ICE 竖向扫描线 x=12%→92%
    if (t >= 185.56 && t <= 186.10) {
      const sx = lerp(P.x_eq, P.x_eq + P.divider_w,
                      _ease_in_out_quad(phase(t, 185.56, 186.00)));
      this._line(d, gd, [sx, 0.33 * H], [sx, 0.86 * H], ICE, 0.75, 1.0, 0.6);
      for (const row of P.rows) {
        for (const name of Object.keys(row.var_first)) {
          const vx = row.var_first[name];
          if (Math.abs(sx - (vx + 60)) < 70) {
            _text(gd, [vx * ss, (row.baseline - 46) * ss], name, font46, 0.0,
                  VAR_COLOR[name].map((v) => Math.trunc(v * 0.6)));
          }
        }
      }
      for (const row of P.rows) {
        if (row.var_first.DESIRE !== undefined && _flash(t, 185.56 + 0.44 * 0.62, 1)) {
          _text(d, [row.var_first.DESIRE * ss, (row.baseline - 46) * ss], 'DESIRE', font46, 0.0, WARM);
        }
      }
    }
    // 阶段 4：标题边缘析出 200 颗预采样粒子
    if (t >= 186.00) {
      const eff = clamp01((t - 186.00) / 0.28);
      const sp = _spread(P.title_pts, 200);
      for (let i = 0; i < sp.length; i++) {
        const a = eff * (0.4 + 0.6 * ((i % 7) / 7.0));
        this._dot(d, gd, sp[i][0] + 10 * Math.sin(t * 3.1 + i),
                  sp[i][1] + 8 * Math.cos(t * 2.7 + i), 2.0, MOOD, a, 0.4);
      }
    }
    this._micro(d, 'SHOT_184');
    return 0.05 * clamp01((t - 185.56) / 0.2);
  }

  /* ═════════ SHOT_185  186.2872–187.66  MORPH：方程 5600 点吸附为 LOVE 粒子字 ═════════ */
  _build_185() {
    const font = this.F['Inter Bold|412'];
    const LW = 0.74 * W, LH = 300.0;
    this._LOVE185_W = LW;
    this._LOVE185_H = LH;
    const fillLay = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'fill', 4);
    const outLay = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'outline', 3);
    const fillp = fillLay.all, fillPer = fillLay.per;
    this.p185 = { per: fillPer, all: outLay.all, fill: fillp };
    // 源粒子：五行方程按 4px 步长重采样（保留变量原色）+ 标题 240px
    const src = [];
    const font46 = this.F['JetBrains Mono|46'];
    const rowLetter = { 0: 'L', 1: 'L', 2: 'O', 3: 'V', 4: 'E' };
    for (const row of this.p184.rows) {
      const letter = rowLetter[row.ri];
      for (const c of row.chars) {
        if (c.ch === ' ') continue;
        const pts = _sampleTextFill(c.ch, font46, this.ss, 4, row.baseline - 34.0, c.x);
        for (const [px, py] of pts) src.push({ x: px, y: py, col: c.col, letter });
      }
    }
    for (const [px, py] of this.p184.title_pts) {
      src.push({ x: px, y: py, col: MOOD, letter: 'core' });
    }
    // 目标：各字母点阵（字形中央加密核）
    const cx = 0.5 * W, cy = 0.5 * H;
    let corePool = fillp.filter((p) => Math.abs(p[0] - cx) < 0.22 * W && Math.abs(p[1] - cy) < 90.0);
    if (!corePool.length) corePool = fillp;
    const byLetter = {};
    for (const s of src) (byLetter[s.letter] = byLetter[s.letter] || []).push(s);
    for (const letter of Object.keys(byLetter)) {
      const items = byLetter[letter];
      const pool = (letter === 'core') ? corePool : (fillPer[letter] || fillp);
      const tgt = _spread(pool, items.length);
      for (let j = 0; j < items.length; j++) { items[j].tx = tgt[j][0]; items[j].ty = tgt[j][1]; }
    }
    this.p185.src = src;
    this.p185.debris = src.filter((s) => s.letter === 'core').slice(0, 600);
    for (let k = 0; k < this.p185.debris.length; k++) {
      const r = new Rng(this.seeds.SHOT_185, 'debris', k);
      this.p185.debris[k].ox = r.range(-70, 70);
      this.p185.debris[k].oy = r.range(-60, 60);
    }
    this.p185.vars = VAR_ORDER;
  }

  _r185(d, gd, t) {
    const ss = this.ss;
    const P = this.p185;
    const T0 = 186.2872;
    // 阶段 1：微字与扫描线余晖线性消失
    if (t < T0 + 0.08) {
      const a = 1.0 - clamp01((t - T0) / 0.08);
      const sx = lerp(this.p184.x_eq, this.p184.x_eq + this.p184.divider_w,
                      _ease_in_out_quad(phase(t, 185.56, 186.00)));
      this._line(d, gd, [sx, 0.33 * H], [sx, 0.86 * H], ICE, 0.75 * a, 1.0, 0.4);
    }
    // 阶段 2：按行→字母映射吸附（每行 25ms 错峰，DESIRE 最后 120ms）
    const lead = { L: 0.0, O: 0.050, V: 0.075, E: 0.100, core: 0.0 };
    for (const s of P.src) {
      let k;
      if (s.letter === 'core') k = _ease_in_out_cubic(phase(t, 186.98, 187.40));
      else {
        const dly = lead[s.letter] + (s.col === WARM ? 0.120 : 0.0);
        k = _ease_in_out_cubic(phase(t, 186.44 + dly, 186.44 + dly + 0.54));
      }
      if (k <= 0.0) continue;
      this._dot(d, gd, lerp(s.x, s.tx, k), lerp(s.y, s.ty, k), 1.2, s.col, 0.55 + 0.45 * k, 0.4);
    }
    // 阶段 3 末：轮廓硬对齐可读 2 帧
    if (t >= 187.40) {
      for (let i = 0; i < P.all.length; i++) {
        if (i % 4) continue;
        this._dot(d, gd, P.all[i][0], P.all[i][1], 1.3, ICE, 0.9, 0.5);
      }
    }
    // 阶段 4：5 个变量微词按 40ms 错峰浮入变量腔
    if (t >= 187.40) {
      const font46 = this.F['JetBrains Mono|46'];
      for (let k = 0; k < P.vars.length; k++) {
        if (t < 187.40 + k * 0.040) continue;
        const name = P.vars[k];
        const vx = CAVITIES[name][0], vy = CAVITIES[name][1];
        const tw = font46.getlength(name);
        _text(d, [(vx * W - tw / 2) * ss, (vy * H - 46) * ss], name, font46, 0.0,
              _C(VAR_COLOR[name], 0.85));
        _text(gd, [(vx * W - tw / 2) * ss, (vy * H - 46) * ss], name, font46, 0.0,
              VAR_COLOR[name].map((v) => Math.trunc(v * 0.4)));
      }
    }
    this._micro(d, 'SHOT_185');
    return 0.0;
  }

  /* ═════════ SHOT_186  187.66–188.48  LOVE：三重波形 + 立方拟合 + 核心亮点 ═════════ */
  _build_186() {
    const font = this.F['Inter Bold|412'];
    const LW = this._LOVE185_W, LH = this._LOVE185_H;
    const outLay = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'outline', 3);
    const fillp = _loveLayout(font, LW, LH, 0.5 * W, 0.5 * H, this.ss, 'fill', 4).all;
    this.p186 = { all: outLay.all, per: outLay.per, fill: fillp };
    const seed = this.seeds.SHOT_186;
    this.p186.math = [];
    const mo = _spread(outLay.all, 650);
    for (let i = 0; i < mo.length; i++) {
      const r = new Rng(seed, 'math', i);
      this.p186.math.push({ x: mo[i][0], y: mo[i][1], rot: r.range(-10, 10), ph: r.next() });
    }
    this.p186.wave = [];
    for (let i = 0; i < 350; i++) this.p186.wave.push({ u: i / 349.0 });
    this.p186.shards = [];
    for (let i = 0; i < 1150; i++) {
      const r = new Rng(seed, 'shard', i);
      const bp = fillp.length ? fillp[(i * 4507) % fillp.length] : [0.5 * W, 0.5 * H];
      this.p186.shards.push({ x: bp[0], y: bp[1], rad: r.range(1.6, 3.6),
                              rot: r.next() * 360.0, ph: r.next() });
    }
    // 椭圆闭环 36 点（1.2 圈/秒）
    this.p186.loop = [];
    for (let i = 0; i < 36; i++) this.p186.loop.push({ th: (2 * Math.PI * i) / 36.0 });
    // 600 颗方程碎屑（承接 185）：自字缘外围归位至字缘（延迟 8ms/颗）
    this.p186.debris = [];
    const pool = outLay.all.length ? outLay.all : [[0.5 * W, 0.5 * H]];
    for (let k = 0; k < this.p185.debris.length; k++) {
      const r = new Rng(seed, 'debris', k);
      const tp = pool[(k * 61) % pool.length];
      const th = r.range(0.0, 2 * Math.PI);
      const rad = r.range(150.0, 330.0);
      this.p186.debris.push({ x: tp[0] + rad * Math.cos(th),
                              y: tp[1] + rad * Math.sin(th) * 0.55,
                              tx: tp[0] + r.range(-16, 16), ty: tp[1] + r.range(-16, 16) });
    }
    // 2.5D 立方（12 棱、前框 700×400 居中、后框偏移 (3%,-4%)）
    const cx = 0.5 * W, cy = 0.5 * H;
    const fw = 700.0, fh = 400.0;
    const bx = 0.03 * W, by = -0.04 * H;
    const front = [[cx - fw / 2, cy - fh / 2], [cx + fw / 2, cy - fh / 2],
                   [cx + fw / 2, cy + fh / 2], [cx - fw / 2, cy + fh / 2]];
    const back = front.map(([x, y]) => [x + bx, y + by]);
    const edges = [];
    for (let i = 0; i < 4; i++) {
      edges.push([front[i], front[(i + 1) % 4]]);
      edges.push([back[i], back[(i + 1) % 4]]);
      edges.push([front[i], back[i]]);
    }
    this.p186.cube = { front, back, edges };
    const cubePts = [];
    for (const [p0, p1] of edges) {
      for (let k = 0; k < 40; k++) {
        const u = k / 39.0;
        cubePts.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]);
      }
    }
    this.p186.cube_pts = cubePts;
    this.p186.fit_src = outLay.all;
    this.p186.fit_tgt = _spread(cubePts, outLay.all.length);
  }

  _r186(d, gd, t) {
    const ss = this.ss;
    const P = this.p186;
    const T0 = 187.66, T1 = 188.48;
    const cx = 0.5 * W, cy = 0.5 * H;
    // 阶段 3 脉冲：scale 1→1.05→1
    let pulse = 1.0;
    if (t >= 188.14 && t <= 188.30) pulse = 1.0 + 0.05 * Math.sin((Math.PI * (t - 188.14)) / 0.16);
    // 阶段 4：字外缘粒子以 easeInQuad 拟合为 2.5D 立方 12 棱
    const fit = _ease_in_quad(phase(t, 188.30, T1));
    // 数学符号（三重波形 4/7/11Hz + rotate）
    for (let i = 0; i < P.math.length; i++) {
      const m = P.math[i];
      let x, y, col;
      if (fit > 0.0 && i % 10 < 7) {
        x = lerp(m.x, P.fit_tgt[i][0], fit);
        y = lerp(m.y, P.fit_tgt[i][1], fit);
        col = BLUEVIOLET;
      } else {
        x = cx + (m.x - cx) * pulse;
        y = cy + (m.y - cy) * pulse;
        col = CYAN;
      }
      const ang = rad(m.rot * Math.sin(2 * Math.PI * (0.48 * t + m.ph)));
      this._dot(d, gd, x + 2.2 * Math.cos(ang), y + 2.2 * Math.sin(ang), 1.0, col, 0.72, 0.35);
    }
    for (const wv of P.wave) {
      const u = wv.u;
      const x = lerp(cx - this._LOVE185_W / 2, cx + this._LOVE185_W / 2, u);
      for (const [fq, amp, off] of [[4.0, 0.20, 0.0], [7.0, 0.16, Math.PI / 3],
                                    [11.0, 0.12, Math.PI / 5]]) {
        const y = cy + amp * this._LOVE185_H
                * Math.sin(2 * Math.PI * fq * ((u + 1.08 * t) % 1.0) + off);
        this._dot(d, gd, x, y, 0.75, BLUEVIOLET, 0.28, 0.2);
      }
    }
    const breath = 0.7 + 0.3 * _ease_in_out_sine(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 0.52));
    for (const s of P.shards) {
      const x = cx + (s.x - cx) * pulse;
      const y = cy + (s.y - cy) * pulse;
      const pts = [];
      for (let kk = 0; kk < 5; kk++) {
        const a2 = rad(s.rot + kk * 72);
        pts.push([(x + s.rad * Math.cos(a2)) * ss, (y + s.rad * Math.sin(a2)) * ss]);
      }
      d.polygon(pts, { outline: _C(MOOD, breath * 0.75) });
    }
    // ① 600 颗方程碎屑归位至字缘（延迟 8ms/颗）
    for (let k = 0; k < Math.min(P.debris.length, 601); k++) {
      const db = P.debris[k];
      const kk = _ease_out_cubic(phase(t, T0 + k * 0.008, T0 + k * 0.008 + 0.24));
      this._dot(d, gd, lerp(db.x, db.tx, kk), lerp(db.y, db.ty, kk), 1.1, GREY, 0.35 + 0.5 * kk, 0.25);
    }
    // 椭圆闭环 36 点（1.2 圈/秒）
    for (const lp of P.loop) {
      const th = lp.th + 2 * Math.PI * 1.2 * t;
      this._dot(d, gd, cx + 0.44 * W * Math.cos(th), cy + 0.30 * H * Math.sin(th),
                1.2, ICE, 0.5, 0.35);
    }
    // ② 变量词各自 steps(1) 亮起一次（间隔 30ms）
    const font46 = this.F['JetBrains Mono|46'];
    for (let k = 0; k < VAR_ORDER.length; k++) {
      const name = VAR_ORDER[k];
      const vx = CAVITIES[name][0], vy = CAVITIES[name][1];
      const tw = font46.getlength(name);
      let a = 0.85;
      if (t >= 187.90 && t <= 188.14) {
        a = Math.abs(t - (187.90 + k * 0.030)) < 0.05 ? 1.0 : 0.55;
      }
      _text(d, [(vx * W - tw / 2) * ss, (vy * H - 46) * ss], name, font46, 0.0,
            _C(VAR_COLOR[name], a));
    }
    // ③ 轮廓描边层
    for (let i = 0; i < P.all.length; i++) {
      if (i % 5) continue;
      this._dot(d, gd, cx + (P.all[i][0] - cx) * pulse, cy + (P.all[i][1] - cy) * pulse,
                1.2, ICE, 0.85, 0.5);
    }
    // ④ 立方 12 棱 + 字心核心亮点与空心环
    if (t >= 188.30) {
      const aCube = 0.5 * clamp01((t - 188.30) / 0.18);
      for (const [p0, p1] of P.cube.edges) this._line(d, gd, p0, p1, BLUEVIOLET, aCube, 1.5, 0.35);
    }
    if (t >= 188.42) {
      this._dot(d, gd, cx, cy, 6.0, ICE, 1.0, 0.7);
      d.ellipse([(cx - 16) * ss, (cy - 16) * ss, (cx + 16) * ss, (cy + 16) * ss],
                { outline: CYAN, width: Math.max(1, Math.round(1.5 * ss)) });
      gd.ellipse([(cx - 16) * ss, (cy - 16) * ss, (cx + 16) * ss, (cy + 16) * ss],
                 { outline: CYAN.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    }
    this._micro(d, 'SHOT_186');
    return 0.15 * clamp01((t - 188.14) / 0.16);
  }

  /** 统一入口（纯函数）
   *  `d`/`gd` 直接画在 `Canvas` 内部的 `Frame` 上（`c._f`）；
   *  后处理参数仍由 `Canvas.flush` 产出（与 ch07–09 同一出口）。 */
  render(shotId, t, ctx, gctx, dpr, beats) {
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats || []);
    const d = new PilDraw(c._f, false);
    const gd = new PilDraw(c._f, true);
    const fn = this['_r' + shotId.split('_')[1]];
    if (!fn) throw new Error(`CH10 无 ${shotId} 的绘制实现`);
    const boost = fn.call(this, d, gd, t) || 0.0;
    return c.flush(t, SEEDS[shotId], {
      radius: BLOOM_RADIUS, strength: Math.min(0.80, BLOOM[shotId][0] + boost),
      grainPct: BLOOM[shotId][1], scan: 0.0,
    });
  }
}

let SCENE = null;
function scene() {
  if (!SCENE) SCENE = new Ch10(1);
  return SCENE;
}

/* ── 镜头注册 ────────────────────────────────────────────────── */
function ch10Shot(id, start, end, status, lyric) {
  return {
    id, start, end, seedHex: SEEDS[id], chapter: CHAPTER, status, lyric,
    draw(ctx, gctx, t, dpr, beats) {
      return scene().render(id, t, ctx, gctx, dpr, beats);
    },
  };
}

const SHOT_176 = ch10Shot('SHOT_176', 177.2500, 178.1700, 'STUDY', "I've studied / 我研究过");
const SHOT_177 = ch10Shot('SHOT_177', 178.1700, 179.1556, 'GRAPH',
                          "I've studied how to properly / 我研究过如何正确地");
const SHOT_178 = ch10Shot('SHOT_178', 179.1556, 179.9300, 'MORPH',
                          'LOVE / 爱');
const SHOT_179 = ch10Shot('SHOT_179', 179.9300, 180.8600, 'LOVE',
                          'LOVE / 爱');
const SHOT_180 = ch10Shot('SHOT_180', 180.8600, 181.9000, 'QUERY',
                          'Question me / 问我');
const SHOT_181 = ch10Shot('SHOT_181', 181.9000, 182.8800, 'ANSWER',
                          'Question me I can answer all / 问我，我能回答所有');
const SHOT_182 = ch10Shot('SHOT_182', 182.8800, 183.6500, 'MORPH',
                          'LOVE / 爱');
const SHOT_183 = ch10Shot('SHOT_183', 183.6500, 184.5400, 'LOVE',
                          'LOVE / 爱');
const SHOT_184 = ch10Shot('SHOT_184', 184.5400, 186.2872, 'EQN',
                          'LOVE = MEMORY + CONNECTION / 爱 = 记忆 + 连接');
const SHOT_185 = ch10Shot('SHOT_185', 186.2872, 187.6600, 'MORPH',
                          'LOVE / 爱');
const SHOT_186 = ch10Shot('SHOT_186', 187.6600, 188.4800, 'LOVE',
                          'LOVE / 爱');

export const CH10_SHOTS = [SHOT_176, SHOT_177, SHOT_178, SHOT_179, SHOT_180,
                           SHOT_181, SHOT_182, SHOT_183, SHOT_184, SHOT_185,
                           SHOT_186];
/** 供自验/调试用的点阵几何接口（ch11–12 亦复用同一实现） */
export const _geom = { loveLayout: _loveLayout, sampleTextFill: _sampleTextFill,
                       sampleOutline: _sampleOutline, glyphMask: _glyphMask };
