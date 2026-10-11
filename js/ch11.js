/**
 * ch11.js — 第 11 章 FREEDOM（镜头 187–192）
 *
 * 自 Python 版 render/scenes/ch11_freedom.py 移植。
 * 与 ch10 同属「类 + 裸 PIL」架构，公共几何层复用 glyphgeom.js（与 ch10 同一份）。
 *
 * 差异：ch11 的 `_rNNN` 签名有两种 ——
 *   `_rNNN(d, gd, t)`            （只用 ImageDraw）
 *   `_rNNN(img, glow, d, gd, t)` （额外直接操作图像，用于 `_paste_mask` 旋转字形）
 * JS 侧无 PIL 图像，旋转字形用 canvas 的 translate+rotate 等价实现（见 `_ringGlyph`）。
 */
import {
  BASE_W as W, BASE_H as H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY,
  Rng, phase, clamp01, lerp, steps, mix, rad, css,
  easeOutCubic, easeInCubic, easeOutExpo, easeInExpo, easeOutQuad, easeInQuad,
  easeInOutQuad, easeInOutSine, easeInOutCubic, easeOutQuart, easeInQuart,
  easeOutQuint, easeInQuint, easeInOutQuint, easeOutBack,
} from './core.js';
import { Canvas, fontOf } from './kit.js';
import { PilDraw, pilFont, mainWord, statusLine, cursor, cornerInfo } from './canvas.js';
import {
  glyphMask as _glyphMask, sampleFill as _sampleFill, sampleOutline as _sampleOutline,
  loveLayout as _loveLayout, sampleTextFill as _sampleTextFill, cubeEdges as _cubeEdges,
} from './glyphgeom.js';

const CHAPTER = 'ch11/12';
const FPS = 60;
const CX = W * 0.5, CY = H * 0.5;

// ── 常量（取自 Python 源码，不可自造）────────────────────────────
const SEEDS = {
  SHOT_187: '0000187A', SHOT_188: '0000188B', SHOT_189: '0000189C',
  SHOT_190: '0000190D', SHOT_191: '0000191E', SHOT_192: '0000192F',
};
const MICRO = {
  SHOT_187: ['T+188.48s', 'ch11/12', 'seed:0000187A · gate:28°', 'FREE'],
  SHOT_188: ['T+189.19s', 'ch11/12', 'seed:0000188B · sample:3px/2100pt', 'MORPH'],
  SHOT_189: ['T+189.75s', 'ch11/12', 'seed:0000189C · view:in', 'TRAP'],
  SHOT_190: ['T+190.80s', 'ch11/12', 'seed:0000190D · ring:R300px', 'PRISON'],
  SHOT_191: ['T+191.36s', 'ch11/12', 'seed:0000191E · particles:1.6k→4.0k→2.0k', 'RING'],
  SHOT_192: ['T+199.45s', 'ch11/12', 'seed:0000192F · sample:4px/5200pt', 'CUT'],
};
const BLOOM = {
  SHOT_187: [0.5, 5.0], SHOT_188: [0.55, 5.0], SHOT_189: [0.45, 5.0],
  SHOT_190: [0.48, 5.0], SHOT_191: [0.48, 6.0], SHOT_192: [0.52, 6.0],
};
const BLOOM_RADIUS = 9.0;
const RING_R = 300.0;
const RING_CHARS = 'LO-O-OVE';
const RING_PX = 72;
const CUBE_FW = 700.0, CUBE_FH = 400.0;
const CUBE_OFF = [0.03 * W, -0.04 * H];
const IN_BACK_W = 1180.0, IN_BACK_H = 660.0;
const IN_FRONT_W = 320.0, IN_FRONT_H = 180.0;
const PHRASES = [[191.36, 193.38], [193.38, 195.40], [195.40, 197.42], [197.42, 199.452]];
const LOVE191_W = 460.0, LOVE191_H = 190.0;
const LOVE191_C = [CX, 0.44 * H];
const CORE191 = [CX, 0.62 * H];
const VAR_ORDER = ['MEMORY', 'TIME', 'LOSS', 'DESIRE', 'CONNECTION'];
const VAR_COLOR = { MEMORY: ICE, TIME: CYAN, CONNECTION: BLUEVIOLET,
                    LOSS: GREY, DESIRE: WARM, LOVE: MOOD };
const CAVITIES = { MEMORY: [0.31, 0.44], TIME: [0.46, 0.36], LOSS: [0.57, 0.58],
                   DESIRE: [0.68, 0.42], CONNECTION: [0.50, 0.64] };

/* ── 顶层 helper（与 ch10 同族）────────────────────────────────── */
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
function _ease_out_sine(p) { return Math.sin((Math.PI * clamp01(p)) / 2.0); }
function _ease_in_out_quad(p) { return p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2; }
function _ease_in_cubic(p) { return p ** 3; }
function _frame(t) { return Math.round(t * FPS); }
function _flash(t, t0, frames = 2) {
  const d = _frame(t) - _frame(t0);
  return d >= 0 && d < frames;
}
function _blink(t, t0, period, duty = 0.5) {
  if (t < t0) return false;
  return ((t - t0) % period) < period * duty;
}
function _stagger_start(hint, n, stagger, fade, tEnd) {
  return Math.min(hint, tEnd - Math.max(0, n - 1) * stagger - fade);
}
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
function _text(d, xy, s, font, stroke, col) {
  if (stroke && stroke > 0.4) {
    d.text(xy, s, { font, fill: col, strokeWidth: Math.round(stroke), strokeFill: col });
  } else {
    d.text(xy, s, { font, fill: col });
  }
}

/* ── _Ch11 等价类 ────────────────────────────────────────────── */
class Ch11 {
  constructor(ss = 1) {
    this.ss = Math.trunc(ss);
    this.W = W * this.ss;
    this.H = H * this.ss;
    this.notes = [];
    this.F = {};
    for (const [weight, px] of [
      ['Inter Semi-Bold', 176], ['Inter Semi-Bold', 152], ['Inter Semi-Bold', 144],
      ['Inter Extra-Bold', 240], ['Inter Bold', 330], ['Inter Bold', 412],
      ['Inter Bold', 240], ['JetBrains Mono Bold', 72], ['JetBrains Mono', 96],
      ['JetBrains Mono', 68], ['JetBrains Mono', 46], ['JetBrains Mono', 42],
      ['JetBrains Mono', 22], ['JetBrains Mono', 20], ['JetBrains Mono', 16],
    ]) {
      this.F[`${weight}|${px}`] = pilFont(weight, px, this.ss);
    }
    this.op_col = _C(GREY, 0.60);
    this.seeds = {};
    for (const sid of Object.keys(SEEDS)) this.seeds[sid] = parseInt(SEEDS[sid], 16);
    // 旋转字形（PIL 的 paste 掩膜等价物）需要真实 ctx；
    // 由 render() 填入，未填入时 _ringGlyph 静默跳过（自验桩仍可跑）。
    this._ctx = null;
    this._gctx = null;
    this._build_common();
    this._build_187();
    this._build_188();
    this._build_189();
    this._build_190();
    this._build_191();
  }

  _f(key) { return this.F[key]; }

  _txt(d, gd, x, y, s, key, col, glowK = 0.5) {
    const font = this.F[key];
    _text(d, [x * this.ss, y * this.ss], s, font, font.stroke, col);
    if (gd && glowK > 0) {
      _text(gd, [x * this.ss, y * this.ss], s, font, font.stroke,
            col.map((v) => Math.trunc(v * glowK)));
    }
  }

  _char_line(d, gd, fontKey, text, x, baseline, tracking, ss, opts = {}) {
    const { segs = null, reveal = null, glowCol = null } = opts;
    const font = this.F[fontKey];
    const y = baseline - font.asc;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let col = ICE;
      if (segs) for (const s of segs) { if (i >= s.i0 && i < s.i1) { col = s.col; break; } }
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

  _dot(d, gd, x, y, r, col, a = 1.0, glowK = 0.45) {
    const ss = this.ss;
    const c = _C(col, a);
    const rr = Math.max(1.0, r);
    d.rectangle([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss], { fill: c });
    if (gd && glowK > 0) {
      gd.rectangle([(x - rr) * ss, (y - rr) * ss, (x + rr) * ss, (y + rr) * ss],
                   { fill: col.map((v) => Math.trunc(v * a * glowK)) });
    }
  }

  _line(d, gd, p0, p1, col, a = 1.0, width = 1.0, glowK = 0.45) {
    const ss = this.ss;
    const wpx = Math.max(1, Math.round(width * ss));
    d.line([p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss], { fill: _C(col, a), width: wpx });
    if (gd && glowK > 0) {
      gd.line([p0[0] * ss, p0[1] * ss, p1[0] * ss, p1[1] * ss],
              { fill: col.map((v) => Math.trunc(v * a * glowK)), width: wpx });
    }
  }

  /** 环上字形：PIL 是「预旋转掩膜 + paste」，浏览器改用 canvas 的 translate+rotate
   *  `sizeK` 用于 SHOT_192 阶段 3 的掩膜缩放（对应 PIL 的 `mask.resize`）。 */
  _ringGlyph(ctx, glowCtx, ch, px, cx, cy, rotDeg, col, a = 1.0, glowK = 0.5, sizeK = 1.0) {
    const size = px * Math.max(0.2, sizeK);
    for (const [c2, k] of [[ctx, 1.0], [glowCtx, glowK]]) {
      if (!c2 || a * k <= 0.012) continue;
      c2.save();
      c2.globalAlpha = Math.min(1, a * k);
      c2.fillStyle = css(col);
      c2.font = fontOf('JetBrains Mono Bold', size, this.ss).font;
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.translate(cx * this.ss, cy * this.ss);
      c2.rotate(rad(rotDeg));
      c2.fillText(ch, 0, 0);
      c2.restore();
    }
  }

  _clamp_baseline(fkey, baseline, minTop = 6.0) {
    const font = this.F[fkey];
    const bb = font.getbbox('H');
    const cap = bb[3] - bb[1];
    if (baseline - cap < minTop) return minTop + cap;
    return baseline;
  }

  /* ═════════ 公共几何（SHOT_186 交棒）═════════ */
  _build_common() {
    const ss = this.ss;
    this.cube = _cubeEdges(CX, CY, CUBE_FW, CUBE_FH, CUBE_OFF[0], CUBE_OFF[1]);
    // 环上 8 个字形（字底朝内、顺时针）
    this.ring = [];
    for (let k = 0; k < RING_CHARS.length; k++) {
      this.ring.push({ ch: RING_CHARS[k], phi: -90.0 + 45.0 * k, rot: -(-90.0 + 45.0 * k + 90.0) });
    }
    this.ring_seps = [];
    for (let i = 0; i < 8; i++) {
      const a = rad(-90.0 + 45.0 * i + 22.5);
      this.ring_seps.push({ x: CX + RING_R * Math.cos(a), y: CY + RING_R * Math.sin(a), a });
    }
    this.in_cube = _cubeEdges(CX, CY, IN_BACK_W, IN_BACK_H, 0.0, 0.0);
    this.in_front = [[CX - IN_FRONT_W / 2, CY - IN_FRONT_H / 2],
                     [CX + IN_FRONT_W / 2, CY - IN_FRONT_H / 2],
                     [CX + IN_FRONT_W / 2, CY + IN_FRONT_H / 2],
                     [CX - IN_FRONT_W / 2, CY + IN_FRONT_H / 2]];
    const fLove = this.F['Inter Bold|330'];
    this.inherit_outline = _loveLayout(fLove, 0.78 * W, 300.0, CX, CY, ss, 'outline', 3).all;
    this.inherit_fill = _loveLayout(fLove, 0.78 * W, 300.0, CX, CY, ss, 'fill', 4).all;
    this.core0 = [CX, CY];
  }

  /* ═════════ SHOT_187  188.48–189.1912  开门 + 越界亮点 ═════════ */
  _build_187() {
    const seed = this.seeds.SHOT_187;
    const fr = this.cube.front;
    // 前框右棱 (fr[1] → fr[2]) 从中点裂为两扇门，各 200px
    const seam = [(fr[1][0] + fr[2][0]) / 2.0, (fr[1][1] + fr[2][1]) / 2.0];
    this.p187 = { seam, hinge_top: fr[1], hinge_bot: fr[2], leaf: 200.0,
                  out: [0.78 * W, 0.30 * H] };
    const edgePts = [];
    for (const [p0, p1] of this.cube.edges) {
      for (let k = 0; k < 26; k++) {
        const u = k / 25.0;
        edgePts.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]);
      }
    }
    void seed;
    this.p187.pts = _spread(edgePts, 420).concat(_spread(this.inherit_fill, 240));
    this.p187.t_main0 = _stagger_start(189.04, 20, 0.012, 0.06, 189.1912);
  }

  /** 返回 `[开度 0..1, 门缝 x]` */
  _door_state(t) {
    const o = _ease_out_expo(phase(t, 188.48, 188.62));
    const s28 = Math.sin(rad(28.0 * o));
    return [o, this.p187.hinge_top[0] + 200.0 * s28];
  }

  _r187(d, gd, t) {
    const ss = this.ss;
    const P = this.p187;
    const st = this._door_state(t);
    const o = st[0], seamX = st[1];
    const cx = CX, cy = CY;
    // 立方 12 棱（前框右棱由双门扇替代）
    for (const [p0, p1] of this.cube.edges) {
      if (Math.abs(p0[0] - p1[0]) < 1e-6
          && Math.abs(p0[0] - (CX + CUBE_FW / 2)) < 1e-6
          && p0[1] < CY && CY < p1[1]) continue;
      this._line(d, gd, p0, p1, BLUEVIOLET, 0.50, 1.5, 0.30);
    }
    // 双门扇（rotateY ±28°）
    const L = P.leaf;
    const c28 = Math.cos(rad(28.0 * o));
    const s28 = Math.sin(rad(28.0 * o));
    const topH = P.hinge_top, botH = P.hinge_bot;
    this._line(d, gd, topH, [topH[0] + L * s28, topH[1] + L * c28], CYAN, 0.95, 1.5, 0.5);
    this._line(d, gd, botH, [botH[0] + L * s28, botH[1] - L * c28], CYAN, 0.95, 1.5, 0.5);
    // 门缝光带 4px × 160px（自 0 拉满）
    const bh = 160.0 * o;
    if (bh > 1) this._line(d, gd, [seamX, CY - bh / 2], [seamX, CY + bh / 2], ICE, 0.70, 4.0, 0.6);
    // 核内 LOVE 粒子（随门开向内退让 12px）
    const push = 12.0 * _ease_out_back(phase(t, 188.62, 188.88));
    for (const pt of P.pts) {
      let x = pt[0];
      const y = pt[1];
      if (x > seamX - 40) x -= push;
      const a = t < 188.88 ? 0.55 : 0.40;
      this._dot(d, gd, x, y, 1.2, MOOD, a, 0.35);
    }
    // 越界亮点：字心 → 门缝 → 框外
    const gap = [seamX, CY];
    let hx, hy;
    if (t < 188.62) { hx = cx; hy = cy; }
    else if (t < 188.88) {
      const k = _ease_in_quad(phase(t, 188.62, 188.88));
      hx = lerp(cx, gap[0], k); hy = lerp(cy, gap[1], k);
    } else {
      const k = _ease_out_quad(phase(t, 188.88, 189.10));
      hx = lerp(gap[0], P.out[0], k); hy = lerp(gap[1], P.out[1], k);
    }
    // 穿门 2 帧白闪 + r=40px 扩散环
    if (_flash(t, 188.88, 2)) {
      d.rectangle([0, 0, this.W, this.H], { fill: _C(ICE, 0.25) });
    }
    if (t >= 188.88 && t <= 189.04) {
      const rr = 40.0 * _ease_out_expo(phase(t, 188.88, 189.04));
      d.ellipse([(gap[0] - rr) * ss, (gap[1] - rr) * ss,
                 (gap[0] + rr) * ss, (gap[1] + rr) * ss],
                { outline: _C(ICE, 0.60 * (1.0 - phase(t, 188.88, 189.04))),
                  width: Math.max(1, ss) });
    }
    // 22px 拖尾
    if (t >= 188.62) {
      const dx = hx - cx, dy = hy - cy;
      const n = Math.hypot(dx, dy) || 1.0;
      for (let k = 0; k < 6; k++) {
        const u = k / 6.0;
        this._dot(d, gd, hx - (dx / n) * 22.0 * u, hy - (dy / n) * 22.0 * u,
                  1.4, ICE, 0.9 - 0.8 * u, 0.5);
      }
    }
    // 越界亮点 r=6px + 16px 空心环
    const blink = _flash(t, 189.10, 2);
    const lr = 6.0 * (blink ? 1.35 : 1.0);
    if (!_flash(t, 189.11, 2)) {
      this._dot(d, gd, hx, hy, lr, ICE, 1.0, 0.7);
      d.ellipse([(hx - 16) * ss, (hy - 16) * ss, (hx + 16) * ss, (hy + 16) * ss],
                { outline: CYAN, width: Math.max(1, Math.round(1.5 * ss)) });
      gd.ellipse([(hx - 16) * ss, (hy - 16) * ss, (hx + 16) * ss, (hy + 16) * ss],
                 { outline: CYAN.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    }
    // 主词 `Though you are free` 152px、左缘 10%W、基线 y=17%
    const txt = 'Though you are free';
    const n = txt.length;
    const t0 = P.t_main0;
    const segs = [{ i0: 0, i1: n - 4, col: ICE }, { i0: n - 4, i1: n, col: CYAN }];
    const rev = (idx) => {
      const tc = t0 + idx * 0.012;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|152', txt, 0.10 * W, 0.17 * H, 0.04 * 152, ss,
                    { segs, reveal: rev });
    // 次词 `gate:open` mono 46px（门扇左下 24px）
    if (t >= 189.04) {
      this._txt(d, gd, seamX + 24, 0.66 * H, 'gate:open', 'JetBrains Mono|46', CYAN, 0.4);
    }
    this._micro(d, 'SHOT_187');
    return (t >= 188.88 && t <= 188.92) ? 0.10 : 0.0;
  }

  /* ═════════ SHOT_188  189.1912–189.75  自由粒子涌出 → 内视角立方 ═════════ */
  _build_188() {
    const seed = this.seeds.SHOT_188;
    const P = this.p187;
    const seamX = this._door_state(189.1912)[1];
    this.p188 = { seam_x: seamX };
    // 200 颗自由粒子（每 1.2ms 一颗自门缝涌出）
    this.p188.free = [];
    for (let i = 0; i < 200; i++) {
      const r = new Rng(seed, 'free', i);
      this.p188.free.push({ birth: 189.1912 + i * 0.0012,
                            th: r.range(-1.35, -0.05), sp: r.range(0.9, 1.5),
                            lane: r.range(-160.0, 160.0) });
    }
    // 2100 点：立方 12 棱 + LOVE 粒子 + 主词 → 内视角目标
    let src = [];
    for (const [p0, p1] of this.cube.edges) {
      for (let k = 0; k < 30; k++) {
        const u = k / 29.0;
        src.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), BLUEVIOLET]);
      }
    }
    for (const [x, y] of P.pts) src.push([x, y, MOOD]);
    const f152 = this.F['Inter Semi-Bold|152'];
    const wtxt = _sampleTextFill('Though you are free', f152, this.ss, 4, 0.17 * H - 110.5, 0.10 * W);
    for (let i = 0; i < wtxt.length; i += 2) src.push([wtxt[i][0], wtxt[i][1], ICE]);
    // 内视角目标：后框 1180×660 四棱 + 前框 320×180 四棱 + 连接棱
    const tgtPool = [];
    for (const [p0, p1] of _cubeEdges(CX, CY, IN_BACK_W, IN_BACK_H, 0.0, 0.0).edges) {
      for (let k = 0; k < 24; k++) {
        const u = k / 23.0;
        tgtPool.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]);
      }
    }
    for (const [p0, p1] of _cubeEdges(CX, CY, IN_FRONT_W, IN_FRONT_H, 0.0, 0.0).edges) {
      for (let k = 0; k < 10; k++) {
        const u = k / 9.0;
        tgtPool.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]);
      }
    }
    src = _spread(src, 2100);
    this.p188.src = src;
    this.p188.tgt = _spread(tgtPool, src.length);
  }

  _r188(d, gd, t) {
    const ss = this.ss;
    const P = this.p188;
    // 主词（完整至 189.40s，字形边缘 2 帧完整再散）
    const txt = 'Though you are free';
    const n = txt.length;
    if (t < 189.42) {
      const a = t < 189.40 ? 1.0 : Math.max(0.0, 1.0 - (t - 189.40) / 0.02);
      this._char_line(d, gd, 'Inter Semi-Bold|152', txt, 0.10 * W, 0.17 * H, 0.04 * 152, ss,
                      { segs: [{ i0: 0, i1: n - 4, col: _C(ICE, a) },
                               { i0: n - 4, i1: n, col: _C(CYAN, a) }] });
    }
    // 次词 `gate:open` 先于主词 60ms 消失
    if (t < 189.34) {
      this._txt(d, gd, P.seam_x + 24, 0.66 * H, 'gate:open', 'JetBrains Mono|46', CYAN, 0.4);
    }
    // 阶段 1：越界亮点加速飞向 (96%,10%)，拖尾拉长至 40px
    const hp0 = [0.78 * W, 0.30 * H], hp1 = [0.96 * W, 0.10 * H];
    if (t >= 189.1912) {
      const k = _ease_in_quad(phase(t, 189.1912, 189.42));
      const hx = lerp(hp0[0], hp1[0], k), hy = lerp(hp0[1], hp1[1], k);
      const dx = hp1[0] - hp0[0], dy = hp1[1] - hp0[1];
      const nn = Math.hypot(dx, dy) || 1.0;
      for (let j = 0; j < 8; j++) {
        const u = j / 8.0;
        this._dot(d, gd, hx - (dx / nn) * 40.0 * u, hy - (dy / nn) * 40.0 * u,
                  1.5, ICE, 0.9 - 0.8 * u, 0.5);
      }
      this._dot(d, gd, hx, hy, 5.0, ICE, 1.0, 0.7);
    }
    // 200 颗自由粒子自门缝涌出
    const sx = P.seam_x, sy = CY;
    for (const fp of P.free) {
      if (t < fp.birth) continue;
      const k = _ease_out_quad(phase(t, fp.birth, fp.birth + 0.26));
      const dist = 340.0 * k;
      const px = sx + dist * Math.cos(fp.th);
      const py = sy + dist * Math.sin(fp.th) + fp.lane * k * 0.9;
      const col = Math.trunc(fp.lane) % 2 === 0 ? CYAN : ICE;
      this._dot(d, gd, px, py, 1.2, col, 0.85, 0.5);
      this._dot(d, gd, px - 16.0 * Math.cos(fp.th) * k, py - 16.0 * Math.sin(fp.th) * k,
                1.0, col, 0.30, 0.25);
    }
    if (t >= 189.42) {
      const blink = _flash(t, 189.42, 2);
      this._dot(d, gd, hp1[0], hp1[1], 5.0 * (blink ? 1.3 : 1.0), ICE, 1.0, 0.7);
    }
    // 阶段 2/3：框内几何采样 → 内视角立方
    const aIn = _ease_in_out_cubic(phase(t, 189.32, 189.52));
    for (let i = 0; i < P.src.length; i++) {
      const [x0, y0, col] = P.src[i];
      this._dot(d, gd, lerp(x0, P.tgt[i][0], aIn), lerp(y0, P.tgt[i][1], aIn),
                1.15, col, 0.45 + 0.4 * aIn, 0.35);
    }
    // 阶段 3：12 棱以 steps(6) 两两补齐
    if (t >= 189.52) {
      const fill = steps(t, 6, 189.52, 189.68);
      const edges = this.in_cube.edges.concat(
        [0, 1, 2, 3].map((i) => [this.in_front[i], this.in_front[(i + 1) % 4]]));
      for (let i = 0; i < edges.length; i++) {
        if (i > fill * 2 + 1) continue;
        this._line(d, gd, edges[i][0], edges[i][1], BLUEVIOLET, 0.60, 1.5, 0.35);
      }
    }
    // 阶段 4：中央小框核心点 hard cut + blink 一次
    if (t >= 189.68 && !_flash(t, 189.72, 2)) {
      this._dot(d, gd, CX, CY, 4.0, CYAN, 1.0, 0.6);
    }
    this._micro(d, 'SHOT_188');
    return 0.0;
  }

  /* ═════════ SHOT_189  189.75–190.80  视角内翻 → 「我被困住」 ═════════ */
  _build_189() {
    const seed = this.seeds.SHOT_189;
    this.p189 = { small_box: [280.0, 156.0] };
    // 8 条内壁透视线：自四个画布角各 2 条指向中心
    const corners = [[0.0, 0.0], [W, 0.0], [W, H], [0.0, H]];
    const lines = [];
    for (const [cxx, cyy] of corners) {
      const dx = CX - cxx, dy = CY - cyy;
      const nn = Math.hypot(dx, dy) || 1.0;
      const px = -dy / nn, py = dx / nn;
      for (const sign of [-1.0, 1.0]) {
        const off = sign * 150.0;
        lines.push([[cxx, cyy], [CX + px * off, CY + py * off]]);
      }
    }
    this.p189.walls = lines;
    // 24 颗挤压粒子
    this.p189.squeeze = [];
    for (let i = 0; i < 24; i++) {
      const r = new Rng(seed, 'sq', i);
      this.p189.squeeze.push({ a: r.range(0.0, 2 * Math.PI), base: r.range(60.0, 150.0),
                               d: (i % 24) * 0.014 });
    }
    this.p189.t_main0 = _stagger_start(190.62, 12, 0.012, 0.06, 190.80);
  }

  _r189(d, gd, t) {
    const ss = this.ss;
    const P = this.p189;
    // 阶段 1：12 棱向四缘外扩张（线宽 1.5→3px）
    const ex = _ease_in_quad(phase(t, 189.75, 189.95));
    const lw = 1.5 + 1.5 * ex;
    const outer = _cubeEdges(CX, CY, lerp(IN_BACK_W, 1.62 * W, ex),
                             lerp(IN_BACK_H, 0.92 * H, ex), 0.0, 0.0);
    for (const [p0, p1] of outer.edges) this._line(d, gd, p0, p1, BLUEVIOLET, 0.40, lw, 0.28);
    // 自由侧消亡：越界亮点 + 200 自由粒子
    const fa = 1.0 - _ease_in_quad(phase(t, 189.75, 189.95));
    if (fa > 0.01) {
      this._dot(d, gd, 0.96 * W, 0.10 * H, 5.0, ICE, fa, 0.6);
      const sx = this.p188.seam_x;
      for (const fp of this.p188.free) {
        if (t < fp.birth) continue;
        const k = _ease_out_quad(phase(t, fp.birth, fp.birth + 0.26));
        this._dot(d, gd, sx + 340.0 * k * Math.cos(fp.th),
                  CY + 340.0 * k * Math.sin(fp.th) + fp.lane * k * 0.9,
                  1.1, CYAN, 0.85 * fa, 0.3);
      }
    }
    // 阶段 2：camera inversion 完成，四缘弹出 8 条内壁透视线
    const wp = _ease_out_expo(phase(t, 189.95, 190.21));
    if (wp > 0.01) {
      for (const [p0, p1] of P.walls) {
        this._line(d, gd, p0, [lerp(p0[0], p1[0], wp), lerp(p0[1], p1[1], wp)],
                   BLUEVIOLET, 0.40, 1.5, 0.28);
      }
    }
    // 中央小框 320×180 → 280×156 + 圆角 3px
    const k = _ease_out_cubic(phase(t, 189.95, 190.35));
    const bw = lerp(IN_FRONT_W, P.small_box[0], k);
    const bh = lerp(IN_FRONT_H, P.small_box[1], k);
    const bx0 = CX - bw / 2, by0 = CY - bh / 2, bx1 = CX + bw / 2, by1 = CY + bh / 2;
    const r = 3.0;
    for (const [p0, p1] of [[[bx0 + r, by0], [bx1 - r, by0]], [[bx1, by0 + r], [bx1, by1 - r]],
                            [[bx1 - r, by1], [bx0 + r, by1]], [[bx0, by1 - r], [bx0, by0 + r]]]) {
      this._line(d, gd, p0, p1, CYAN, 0.70, 1.5, 0.45);
    }
    // 阶段 3：24 颗挤压粒子向内压进
    if (t >= 190.35) {
      for (const sq of P.squeeze) {
        const kk = _ease_out_back(phase(t, 190.35 + sq.d, 190.35 + sq.d + 0.20));
        const rr = sq.base - (sq.base - bw * 0.62) * clamp01(kk);
        this._dot(d, gd, CX + rr * Math.cos(sq.a) * 1.25, CY + rr * Math.sin(sq.a) * 0.95,
                  1.5, GREY, 0.55, 0.18);
      }
    }
    // 核心点 r=6px，被困后 scale 0.82
    const cs = lerp(1.0, 0.82, _ease_in_out_cubic(phase(t, 190.35, 190.55)));
    this._dot(d, gd, CX, CY, 6.0 * cs, ICE, 1.0, 0.7);
    d.ellipse([(CX - 16) * ss, (CY - 16) * ss, (CX + 16) * ss, (CY + 16) * ss],
              { outline: _C(CYAN, 0.8), width: Math.max(1, Math.round(1.5 * ss)) });
    gd.ellipse([(CX - 16) * ss, (CY - 16) * ss, (CX + 16) * ss, (CY + 16) * ss],
               { outline: CYAN.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    // 主词 `I am trapped` 176px、左缘 8%W、基线 y=23%
    const txt = 'I am trapped';
    const n = txt.length;
    const t0 = P.t_main0;
    const segs = [{ i0: 0, i1: 5, col: ICE }, { i0: 5, i1: n, col: BLUEVIOLET }];
    const rev = (idx) => {
      const tc = t0 + idx * 0.012;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.06));
      return [p, (1.0 - p) * 6.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|176', txt, 0.08 * W, 0.23 * H, 0.05 * 176, ss,
                    { segs, reveal: rev });
    // 次词 `view:inside` mono 46px（小框右下 24px）
    if (t >= 190.62) {
      this._txt(d, gd, bx1 + 24, by1 + 24, 'view:inside', 'JetBrains Mono|46', GREY, 0.25);
    }
    this._micro(d, 'SHOT_189');
    return 0.0;
  }

  /* ═════════ SHOT_190  190.80–191.36  PRISON：12 棱断为 8 段弧 + 文字环显形 ═════════ */
  _build_190() {
    const seed = this.seeds.SHOT_190;
    this.p190 = { orbit: [] };
    for (let i = 0; i < 12; i++) {
      const r = new Rng(seed, 'orbit', i);
      this.p190.orbit.push({ a: r.range(0, 2 * Math.PI), ph: r.next() });
    }
    const f144 = this.F['Inter Semi-Bold|144'];
    let tw = 0;
    for (const ch of 'Trapped in') tw += f144.getlength(ch);
    tw += 0.05 * 144 * ('Trapped in'.length - 1);
    this.p190.main_w = tw;
    this.p190.t_main0 = _stagger_start(191.30, 10, 0.008, 0.05, 191.36);
  }

  _r190(d, gd, t) {
    const ss = this.ss;
    const P = this.p190;
    const T0 = 190.80, T1 = 191.36;
    void T1;
    // 阶段 1：12 棱 hard cut 断为 8 段弧；中央小框塌为点
    const k1 = _ease_in_quad(phase(t, T0, 190.96));
    const arcR = lerp(676.0, RING_R, _ease_out_cubic(phase(t, 190.96, 191.20)));
    const rot = lerp(-22.0, 0.0, _ease_out_cubic(phase(t, 190.96, 191.20)));
    if (t < 191.22) {
      for (let i = 0; i < 8; i++) {
        const a0 = rot + i * 45.0 + 3.0;
        d.arc([(CX - arcR) * ss, (CY - arcR) * ss, (CX + arcR) * ss, (CY + arcR) * ss],
              a0, a0 + 39.0, { fill: _C(MOOD, 0.55), width: Math.max(1, Math.round(1.5 * ss)) });
      }
    }
    const bw = 280.0 * (1.0 - k1), bh = 156.0 * (1.0 - k1);
    if (bw > 6) {
      d.rectangle([(CX - bw / 2) * ss, (CY - bh / 2) * ss, (CX + bw / 2) * ss, (CY + bh / 2) * ss],
                  { outline: _C(CYAN, 0.7 * (1.0 - k1)), width: Math.max(1, ss) });
    }
    // 阶段 2/3：圆环整体 scale 1.06→1.0 锁定
    let ringSc = 1.0;
    if (t >= 191.20) ringSc = lerp(1.06, 1.0, clamp01(_ease_out_back(phase(t, 191.20, 191.30))));
    const pulse = _flash(t, 191.30, 4) ? 1.02 : 1.0;
    const rr = RING_R * ringSc * pulse;
    // 8 枚分隔点 + 径向短线
    for (const sp of this.ring_seps) {
      const x = CX + rr * Math.cos(sp.a), y = CY + rr * Math.sin(sp.a);
      this._dot(d, gd, x, y, 4.0, BLUEVIOLET, 0.7, 0.3);
      this._line(d, gd, [x - 12 * Math.cos(sp.a), y - 12 * Math.sin(sp.a)],
                 [x + 12 * Math.cos(sp.a), y + 12 * Math.sin(sp.a)], BLUEVIOLET, 0.35, 1.0, 0.2);
    }
    // `LO-O-OVE` 8 字符顺时针逐个显形
    let litBoost = 1.0;
    if (t >= 191.30) litBoost = 1.0 + 0.20 * _ease_out_sine(phase(t, 191.30, 191.36));
    for (let k = 0; k < this.ring.length; k++) {
      const g = this.ring[k];
      if (t < 190.96 + k * 0.030 && t < 191.20) continue;
      const phi = rad(g.phi);
      this._ringGlyph(this._ctx, this._gctx, g.ch, RING_PX,
                      CX + rr * Math.cos(phi), CY + rr * Math.sin(phi),
                      g.rot, MOOD, Math.min(1.0, 0.85 * litBoost), 0.45);
    }
    // 环心核心点 + 16px 空心环
    const cs = lerp(0.82, 0.90, _ease_in_out_cubic(phase(t, T0, 190.96)));
    this._dot(d, gd, CX, CY, 6.0 * cs, ICE, 1.0, 0.7);
    d.ellipse([(CX - 16) * ss, (CY - 16) * ss, (CX + 16) * ss, (CY + 16) * ss],
              { outline: _C(CYAN, 0.85), width: Math.max(1, Math.round(1.5 * ss)) });
    gd.ellipse([(CX - 16) * ss, (CY - 16) * ss, (CX + 16) * ss, (CY + 16) * ss],
               { outline: CYAN.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    // 12 颗绕心粒子
    if (t >= 190.96) {
      const kk = _ease_out_cubic(phase(t, 190.96, 191.20));
      for (const op of P.orbit) {
        const a = op.a + 2 * Math.PI * 0.30 * (t - 190.96);
        const rad2 = 46.0 * kk;
        this._dot(d, gd, CX + rad2 * Math.cos(a), CY + rad2 * Math.sin(a) * 0.9,
                  1.4, GREY, 0.55, 0.15);
      }
    }
    // 主词 `Trapped in` 144px 居中、基线 y=11%
    const txt = 'Trapped in';
    const n = txt.length;
    const t0 = P.t_main0;
    const tr = 0.05 * 144;
    const segs = [{ i0: 0, i1: 8, col: ICE }, { i0: 8, i1: n, col: MOOD }];
    const rev = (idx) => {
      const tc = t0 + idx * 0.008;
      const p = _ease_out_cubic(phase(t, tc, tc + 0.05));
      return [p, (1.0 - p) * 5.0];
    };
    this._char_line(d, gd, 'Inter Semi-Bold|144', txt, CX - P.main_w / 2, 0.11 * H, tr, ss,
                    { segs, reveal: rev });
    // 次词 `ring:R300`
    this._txt(d, gd, 0.78 * W, 0.78 * H, 'ring:R300', 'JetBrains Mono|46', GREY, 0.25);
    this._micro(d, 'SHOT_190');
    return 0.0;
  }

  /* ═════════ SHOT_191  191.36–199.452  RING：四个乐句的长镜 ═════════ */
  _build_191() {
    const ss = this.ss;
    const seed = this.seeds.SHOT_191;
    // 环内 LOVE 粒子字（视觉高 190px、宽 460px、居中偏上 (50%,44%)）
    const fLove = this.F['Inter Bold|330'];
    const outline = _loveLayout(fLove, LOVE191_W, LOVE191_H, LOVE191_C[0], LOVE191_C[1],
                                ss, 'outline', 3).all;
    const fillp = _loveLayout(fLove, LOVE191_W, LOVE191_H, LOVE191_C[0], LOVE191_C[1],
                              ss, 'fill', 4).all;
    this.p191 = { outline, fill: fillp };
    // 数学符号 18%
    this.p191.math = [];
    const mo = _spread(outline, 260);
    for (let i = 0; i < mo.length; i++) {
      const r = new Rng(seed, 'math', i);
      this.p191.math.push({ x: mo[i][0], y: mo[i][1], ph: r.next(), rot: r.range(-10, 10) });
    }
    // 三重波形 18%
    this.p191.wave = [];
    for (let i = 0; i < 260; i++) this.p191.wave.push({ u: i / 259.0 });
    // 记忆碎片 34%
    this.p191.shards = [];
    for (let i = 0; i < 700; i++) {
      const r = new Rng(seed, 'shard', i);
      const bp = fillp[(i * 6151) % fillp.length];
      this.p191.shards.push({ x: bp[0], y: bp[1], rad: r.range(1.5, 3.5),
                              rot: r.next() * 360.0, ph: r.next(),
                              p2: i >= 500, warm: (i % 25 === 0) });
    }
    // 环内方程碎屑 8%
    this.p191.debris = _spread(fillp, 180).map((p) => ({ x: p[0], y: p[1] }));
    // 环外自由逸散粒子（200→900→1400）
    this.p191.free = [];
    for (let i = 0; i < 1400; i++) {
      const r = new Rng(seed, 'out', i);
      let birth, rEnd;
      if (i < 200) { birth = 191.36 + i * 0.010; rEnd = RING_R + 90.0 + r.range(0.0, 300.0); }
      else if (i < 900) { birth = 193.38 + (i - 200) * 0.0029; rEnd = RING_R + 120.0 + r.range(0.0, 420.0); }
      else { birth = 195.40 + (i - 900) * 0.00404; rEnd = RING_R + 140.0 + r.range(0.0, 520.0); }
      // 左半屏偏「自由逸散」：70% 落在左半区
      const th = (i % 10 < 7) ? r.range(rad(100.0), rad(260.0)) : r.range(rad(-70.0), rad(70.0));
      this.p191.free.push({ birth, th0: th, r_end: rEnd, spin: r.range(-0.22, 0.22),
                            retreat: i >= 1100 });
    }
    this.p191.trail_free = { p0: [CX + RING_R + 10, CY - 40], p1: [CX + 620.0, CY - 430.0],
                             p2: [0.06 * W, 0.08 * H], col: CYAN };
    this.p191.trail_trap = { col: MOOD, r: RING_R - 26.0 };
    this.p191.loop = [];
    for (let i = 0; i < 36; i++) this.p191.loop.push({ th: (2 * Math.PI * i) / 36.0 });
    this.p191.t_main0 = 0.0;
    // 承接 190 的主词宽度
    this.p191.main_w = this.p190.main_w;
    // SHOT_192 需要 _build_191 的 fill
    this._build_192();
  }

  /** 环外自由粒子位置（硬不变量：r > RING_R + 6） */
  _free_pos(i, t) {
    const fp = this.p191.free[i];
    const birth = fp.birth, rEnd = fp.r_end;
    const k = _ease_out_quad(phase(t, birth, birth + 1.2));
    let r = lerp(RING_R + 40.0, rEnd, k);
    if (fp.retreat) {
      r -= 0.5 * (rEnd - (RING_R + 40.0)) * _ease_in_out_sine(phase(t, birth + 1.1, birth + 2.0));
    }
    r = Math.max(RING_R + 6.0, r);
    let th = fp.th0 + fp.spin * (t - birth);
    if (t >= PHRASES[3][0]) {
      const orb = _ease_in_cubic(phase(t, PHRASES[3][0], PHRASES[3][1]));
      th = fp.th0 + fp.spin * (PHRASES[3][0] - birth)
         + 2 * Math.PI * 0.50 * (t - PHRASES[3][0]) * orb;
    }
    return [CX + r * Math.cos(th), CY + r * Math.sin(th), r, th];
  }

  _r191(d, gd, t) {
    const ss = this.ss;
    const P = this.p191;
    const T0 = 191.36;
    // 乐句脉冲（每乐句起点 60ms scale 1.02→1）
    let pulse = 1.0;
    for (const [p0] of PHRASES) {
      if (t >= p0 && t <= p0 + 0.06) pulse = 1.0 + 0.02 * Math.sin((Math.PI * (t - p0)) / 0.06);
    }
    // 环外自由逸散粒子（最底层）
    for (let i = 0; i < 1400; i++) {
      const fp = P.free[i];
      if (t < fp.birth) continue;
      const [x, y, r, th] = this._free_pos(i, t);
      let a = 0.85;
      if (t >= PHRASES[3][0] && i < 900) {
        a *= 1.0 - _ease_in_cubic(phase(t, PHRASES[3][0], 198.60));
      }
      if (a <= 0.02) continue;
      const col = i % 3 ? CYAN : ICE;
      this._dot(d, gd, x, y, 1.1, col, a, 0.4);
      // 12px 拖尾（沿径向向外）
      this._dot(d, gd, CX + (r - 12.0) * Math.cos(th), CY + (r - 12.0) * Math.sin(th),
                0.9, col, a * 0.35, 0.2);
    }
    // 文字圆环（监狱墙，R=300px，8×72px）
    let bloomK = 0.40;
    if (t >= PHRASES[1][0]) bloomK = 0.45;
    if (t >= PHRASES[2][0]) bloomK = 0.60;
    if (t >= PHRASES[3][0]) bloomK = 0.55;
    const rr = RING_R * pulse;
    for (const g of this.ring) {
      const phi = rad(g.phi);
      this._ringGlyph(this._ctx, this._gctx, g.ch, RING_PX,
                      CX + rr * Math.cos(phi), CY + rr * Math.sin(phi), g.rot, MOOD, 0.90, bloomK);
    }
    for (const sp of this.ring_seps) {
      this._dot(d, gd, CX + rr * Math.cos(sp.a), CY + rr * Math.sin(sp.a), 3.2, BLUEVIOLET, 0.65, 0.3);
    }
    // 被困轨：贴环内壁 cruise 0.9 圈/秒
    if (t < PHRASES[3][0]) {
      const ta = 2 * Math.PI * 0.9 * (t - T0);
      const trr = P.trail_trap.r;
      for (let k = 0; k < 14; k++) {
        const a = ta - k * 0.055;
        this._dot(d, gd, CX + trr * Math.cos(a), CY + trr * Math.sin(a) * 0.98,
                  1.2, MOOD, 0.75 * (1 - k / 14.0), 0.4);
      }
    }
    // 乐句 1「成形」：LOVE 字自核心点以 easeOutExpo 爆发成形
    const form = _ease_out_expo(phase(t, T0, 191.68));
    const ox = CORE191[0], oy = CORE191[1];
    // 环内 LOVE 粒子字（乐句 3 scale 1.04）
    let wsc = 1.0;
    if (t >= PHRASES[2][0]) wsc = 1.04;
    if (t >= PHRASES[3][0]) wsc = 1.0;
    const edgeA = t < PHRASES[3][0] ? 0.85 : 0.95;
    const cxw = LOVE191_C[0], cyw = LOVE191_C[1];
    for (let i = 0; i < P.outline.length; i++) {
      if (i % 3) continue;
      const xx = cxw + (P.outline[i][0] - cxw) * wsc * pulse;
      const yy = cyw + (P.outline[i][1] - cyw) * wsc * pulse;
      this._dot(d, gd, ox + (xx - ox) * form, oy + (yy - oy) * form, 1.2, ICE, edgeA, 0.5);
    }
    // 数学符号（18%）
    for (const m of P.math) {
      const ang = rad(m.rot * Math.sin(2 * Math.PI * (0.4 * t + m.ph)));
      const mx = cxw + (m.x - cxw) * pulse + 2.0 * Math.cos(ang);
      const my = cyw + (m.y - cyw) * pulse + 2.0 * Math.sin(ang);
      this._dot(d, gd, ox + (mx - ox) * form, oy + (my - oy) * form, 1.0, CYAN, 0.7, 0.35);
    }
    // 三重波形（4/7/11 Hz）
    for (const wv of P.wave) {
      const u = wv.u;
      const x = lerp(cxw - LOVE191_W / 2, cxw + LOVE191_W / 2, u);
      for (const [fq, amp, off] of [[4.0, 0.22, 0.0], [7.0, 0.17, Math.PI / 3],
                                    [11.0, 0.12, Math.PI / 5]]) {
        const y = cyw + amp * LOVE191_H * Math.sin(2 * Math.PI * fq * ((u + 1.0 * t) % 1.0) + off);
        this._dot(d, gd, x, y, 0.75, BLUEVIOLET, 0.42, 0.28);
      }
    }
    // 记忆碎片（34%）：乐句 2 再 +400，乐句 3 补 4% 暖碎片
    const breath = 0.7 + 0.3 * _ease_in_out_sine(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 0.52));
    for (const s of P.shards) {
      if (s.p2 && t < PHRASES[1][0]) continue;
      const col = (s.warm && t >= PHRASES[2][0]) ? WARM : MOOD;
      const x = cxw + (s.x - cxw) * wsc * pulse;
      const y = cyw + (s.y - cyw) * wsc * pulse;
      const cxx = ox + (x - ox) * form;
      const cyy = oy + (y - oy) * form;
      const pts = [];
      for (let kk = 0; kk < 5; kk++) {
        const a2 = rad(s.rot + kk * 72);
        pts.push([(cxx + s.rad * Math.cos(a2)) * ss, (cyy + s.rad * Math.sin(a2)) * ss]);
      }
      d.polygon(pts, { outline: _C(col, breath * 0.8) });
    }
    // 环内方程碎屑 8%
    for (const db of P.debris) {
      this._dot(d, gd, ox + (db.x - ox) * form, oy + (db.y - oy) * form, 1.0, GREY, 0.35, 0.15);
    }
    // 核心亮点（被困标记）(50%,62%)
    let coreS = 1.0, ringW = 1.5;
    if (t >= PHRASES[1][0]) coreS = 0.92;
    if (t >= PHRASES[2][0]) { coreS = 0.80; ringW = 3.0; }
    if (t >= PHRASES[3][0]) { coreS = 0.90; ringW = 2.0; }
    const cb = 0.6 + 0.4 * _ease_in_out_sine(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 0.52));
    const ccx = CORE191[0], ccy = CORE191[1];
    this._dot(d, gd, ccx, ccy, 6.0 * coreS, ICE, 0.55 + 0.45 * cb, 0.7);
    d.ellipse([(ccx - 16) * ss, (ccy - 16) * ss, (ccx + 16) * ss, (ccy + 16) * ss],
              { outline: _C(CYAN, 0.85), width: Math.max(1, Math.round(ringW * ss)) });
    gd.ellipse([(ccx - 16) * ss, (ccy - 16) * ss, (ccx + 16) * ss, (ccy + 16) * ss],
               { outline: CYAN.map((v) => Math.trunc(v * 0.5)), width: Math.max(1, ss) });
    // 自由轨（穿环隙外飞，24 颗拖尾点）
    let uHead = null;
    if (t >= PHRASES[0][0] && t < PHRASES[3][0]) {
      uHead = _ease_in_out_cubic((t - 191.60) / 1.60) % 1.0;
    }
    if (uHead !== null) {
      for (let k = 0; k < 24; k++) {
        const u = (((uHead - k * 0.02) % 1.0) + 1.0) % 1.0;
        const bp = _bezier(P.trail_free.p0, P.trail_free.p1, P.trail_free.p2, u);
        this._dot(d, gd, bp[0], bp[1], 1.3, CYAN, 0.85 * (1 - k / 24.0), 0.5);
      }
    }
    // 乐句 4：两条轨迹合成一条椭圆闭环（1.4 圈/秒）
    if (t >= PHRASES[3][0]) {
      for (const lp of P.loop) {
        const th = lp.th + 2 * Math.PI * 1.4 * (t - PHRASES[3][0]);
        this._dot(d, gd, CX + (RING_R + 120.0) * Math.cos(th),
                  CY + (RING_R - 40.0) * Math.sin(th), 1.2, ICE, 0.6, 0.4);
      }
    }
    // 次词 `free`(88%,14%) / `trapped`(11%,84%)
    const f42 = this.F['JetBrains Mono|42'];
    if (t >= PHRASES[1][0]) {
      _text(d, [0.88 * W * ss, 0.14 * H * ss], 'free', f42, 0.0, _C(CYAN, 0.70));
      _text(gd, [0.88 * W * ss, 0.14 * H * ss], 'free', f42, 0.0,
            CYAN.map((v) => Math.trunc(v * 0.35)));
    }
    if (t >= PHRASES[2][0]) {
      _text(d, [0.11 * W * ss, 0.84 * H * ss], 'trapped', f42, 0.0, _C(MOOD, 0.70));
      _text(gd, [0.11 * W * ss, 0.84 * H * ss], 'trapped', f42, 0.0,
            MOOD.map((v) => Math.trunc(v * 0.35)));
    }
    // 承接 SHOT_190：主词 `Trapped in` + `ring:R300`（191.60s 前采样并入）
    if (t < 191.62) {
      const k = clamp01((t - 191.52) / 0.10);
      const f144 = this.F['Inter Semi-Bold|144'];
      const tr2 = 0.05 * 144;
      const tw = P.main_w;
      if (k <= 0.0) {
        this._char_line(d, gd, 'Inter Semi-Bold|144', 'Trapped in', CX - tw / 2, 0.11 * H, tr2, ss,
                        { segs: [{ i0: 0, i1: 8, col: ICE }, { i0: 8, i1: 10, col: MOOD }] });
        this._txt(d, gd, 0.78 * W, 0.78 * H, 'ring:R300', 'JetBrains Mono|46', GREY, 0.25);
      } else {
        const sp = _spread(P.fill, 60);
        for (let i = 0; i < sp.length; i++) {
          const tp = P.fill[(i * 7) % P.fill.length];
          this._dot(d, gd, lerp(0.5 * W, tp[0], k), lerp(0.11 * H, tp[1], k), 1.2,
                    MOOD, 1.0 - k, 0.4);
        }
      }
    }
    this._micro(d, 'SHOT_191');
    // bloom 随乐句起伏：0.42→0.60→0.48
    if (t < PHRASES[1][0]) return -0.06;
    if (t < PHRASES[2][0]) return 0.02;
    if (t < PHRASES[3][0]) return 0.12;
    return 0.0;
  }

  /* ═════════ SHOT_192  199.452–205.7967  CUT：归位 → 采样 → 合环 → 黑场 ═════════ */
  _build_192() {
    const ss = this.ss;
    const seed = this.seeds.SHOT_192;
    // 采样粒子：LOVE 字 + 环 8 字符轮廓，合计 ≈5,200 点
    const word = this.p191.fill;
    const ringPts = [];
    const f72 = this.F[`JetBrains Mono Bold|${RING_PX}`];
    for (const g of this.ring) {
      const m = _glyphMask(g.ch, f72);
      for (const [px, py] of _sampleOutline(m, Math.max(1, Math.trunc(2 * ss)), 2)) {
        const phi = rad(g.phi);
        const ox = CX + RING_R * Math.cos(phi) - m.w / (2.0 * ss);
        const oy = CY + RING_R * Math.sin(phi) - m.h / (2.0 * ss);
        ringPts.push([ox + px / ss, oy + py / ss]);
      }
    }
    this.p192 = { word: _spread(word, 2800), ring: _spread(ringPts, 2400) };
    // 5 个变量微词（4px 采样，60ms/词 延迟）
    this.p192.vars = [];
    const font46 = this.F['JetBrains Mono|46'];
    for (let k = 0; k < VAR_ORDER.length; k++) {
      const name = VAR_ORDER[k];
      const vx = CAVITIES[name][0], vy = CAVITIES[name][1];
      const tw = font46.getlength(name);
      const pts = _sampleTextFill(name, font46, ss, 4, vy * H - 34.0, vx * W - tw / 2);
      this.p192.vars.push({ name, pts, k });
    }
    // 环外 500 公转粒子（SHOT_191 存活组）
    this.p192.orbit = [];
    for (let i = 0; i < 500; i++) {
      const r = new Rng(seed, 'orb', i);
      this.p192.orbit.push({ th: r.range(0, 2 * Math.PI),
                             rad: r.range(RING_R + 120.0, RING_R + 260.0),
                             sp: r.range(0.5, 0.9) });
    }
    this.p192.loop = [];
    for (let i = 0; i < 36; i++) this.p192.loop.push({ th: (2 * Math.PI * i) / 36.0 });
  }

  _r192(d, gd, t) {
    const ss = this.ss;
    const P = this.p192;
    const T0 = 199.452;
    // 阶段 4 末：205.7967s 起满屏纯黑场（交棒 CH12）
    if (t >= 205.7967) return -BLOOM.SHOT_192[0];
    const f42 = this.F['JetBrains Mono|42'];
    // ── 阶段 1（199.452–201.10）「归位」──
    if (t < 201.10) {
      const back = _ease_in_quad(phase(t, T0, 201.10));
      for (let i = 0; i < P.orbit.length; i++) {
        const op = P.orbit[i];
        if (i * 0.004 > (t - T0)) continue;
        const r = lerp(op.rad, RING_R, back);
        const th = op.th + 2 * Math.PI * op.sp * (t - T0);
        this._dot(d, gd, CX + r * Math.cos(th), CY + r * Math.sin(th), 1.1, CYAN, 0.7, 0.35);
        this._dot(d, gd, CX + (r + 10.0) * Math.cos(th), CY + (r + 10.0) * Math.sin(th),
                  0.9, CYAN, 0.25, 0.2);
      }
      const bloomK = lerp(0.48, 0.42, phase(t, T0, 201.10));
      for (const g of this.ring) {
        const phi = rad(g.phi);
        this._ringGlyph(this._ctx, this._gctx, g.ch, RING_PX,
                        CX + RING_R * Math.cos(phi), CY + RING_R * Math.sin(phi),
                        g.rot, MOOD, 0.90, bloomK);
      }
      for (const sp of this.ring_seps) {
        this._dot(d, gd, CX + RING_R * Math.cos(sp.a), CY + RING_R * Math.sin(sp.a),
                  3.2, BLUEVIOLET, 0.65, 0.3);
      }
      // 核心点收缩为 2px 青光标形态 + scale 脉冲一次
      const kk = _ease_in_out_cubic(phase(t, T0, 201.10));
      const cs = lerp(6.0, 1.0, kk);
      const pulse = 1.0 + 0.03 * Math.sin(Math.PI * clamp01((t - 200.30) / 0.20));
      this._dot(d, gd, CX, CY, cs, kk < 0.6 ? ICE : CYAN, 1.0, 0.6);
      d.ellipse([(CX - 16 * (1 - kk)) * ss, (CY - 16 * (1 - kk)) * ss,
                 (CX + 16 * (1 - kk)) * ss, (CY + 16 * (1 - kk)) * ss],
                { outline: _C(CYAN, 0.85 * (1 - kk)), width: Math.max(1, ss) });
      for (let i = 0; i < P.word.length; i++) {
        if (i % 4) continue;
        this._dot(d, gd, P.word[i][0], P.word[i][1], 1.2, ICE, 0.85 * pulse, 0.5);
      }
      for (const lp of P.loop) {
        const th = lp.th + 2 * Math.PI * 1.4 * (t - PHRASES[3][0]);
        this._dot(d, gd, CX + (RING_R + 120.0) * Math.cos(th),
                  CY + (RING_R - 40.0) * Math.sin(th), 1.2, ICE, 0.55, 0.35);
      }
      _text(d, [0.88 * W * ss, 0.14 * H * ss], 'free', f42, 0.0, _C(CYAN, 0.70));
      _text(d, [0.11 * W * ss, 0.84 * H * ss], 'trapped', f42, 0.0, _C(MOOD, 0.70));
      this._micro(d, 'SHOT_192');
      return -0.04;
    }
    // ── 阶段 2（201.10–202.90）「采样」：4px 采样点沿螺旋吸入点核 ──
    if (t < 202.90) {
      const k = _ease_in_out_cubic(phase(t, 201.10, 202.90));
      const tgtR = lerp(120.0, 3.0, k);
      const turns = 2.2;
      for (let i = 0; i < P.word.length; i++) {
        if (i % 2) continue;
        const dx = P.word[i][0] - CX, dy = P.word[i][1] - CY;
        const r0 = Math.hypot(dx, dy);
        const th0 = Math.atan2(dy, dx);
        const r = lerp(r0, tgtR, k);
        const th = th0 + turns * 2 * Math.PI * k;
        this._dot(d, gd, CX + r * Math.cos(th), CY + r * Math.sin(th), 1.2,
                  i % 3 ? MOOD : ICE, 0.8, 0.4);
      }
      for (const v of P.vars) {
        const tStart = 201.10 + (202.90 - 201.10 - 0.30) + v.k * 0.060;
        const kv = _ease_in_out_cubic(phase(t, tStart, 202.90));
        if (kv <= 0.0) continue;
        for (const [px, py] of v.pts) {
          const dx = px - CX, dy = py - CY;
          const r0 = Math.hypot(dx, dy);
          const th0 = Math.atan2(dy, dx);
          const r = lerp(r0, tgtR, kv);
          const th = th0 + turns * 2 * Math.PI * kv;
          this._dot(d, gd, CX + r * Math.cos(th), CY + r * Math.sin(th), 1.1,
                    VAR_COLOR[v.name], 0.8, 0.35);
        }
      }
      for (const g of this.ring) {
        const phi = rad(g.phi);
        this._ringGlyph(this._ctx, this._gctx, g.ch, RING_PX,
                        CX + RING_R * Math.cos(phi), CY + RING_R * Math.sin(phi),
                        g.rot, MOOD, 0.85, 0.42);
      }
      for (const lp of P.loop) {
        const th = lp.th + 2 * Math.PI * 1.4 * (t - PHRASES[3][0]);
        this._dot(d, gd, CX + (RING_R + 120.0) * Math.cos(th),
                  CY + (RING_R - 40.0) * Math.sin(th), 1.2, ICE, 0.5, 0.3);
      }
      this._dot(d, gd, CX, CY, 2.0, ICE, 1.0, 0.6);
      this._micro(d, 'SHOT_192');
      return 0.0;
    }
    // ── 阶段 3（202.90–204.60）「合环」：R 300→0，字符顺时针逐个熄灭 ──
    if (t < 204.60) {
      const kr = _ease_in_cubic(phase(t, 202.90, 204.60));
      const rr = RING_R * (1.0 - kr);
      const sc = Math.max(0.2, 1.0 - kr);
      for (let k = 0; k < this.ring.length; k++) {
        const g = this.ring[k];
        const die = 202.90 + k * 0.20;
        if (t >= die + 0.20) continue;
        const a = t < die ? 1.0 : Math.max(0.0, 1.0 - (t - die) / 0.20);
        const phi = rad(g.phi);
        this._ringGlyph(this._ctx, this._gctx, g.ch, RING_PX,
                        CX + rr * Math.cos(phi), CY + rr * Math.sin(phi),
                        g.rot, MOOD, a, 0.5, sc);
      }
      for (const lp of P.loop) {
        const th = lp.th + 2 * Math.PI * 1.4 * (t - PHRASES[3][0]);
        const kq = 1.0 - _ease_in_quad(phase(t, 202.90, 204.60));
        this._dot(d, gd, CX + (RING_R + 120.0) * kq * Math.cos(th),
                  CY + (RING_R - 40.0) * kq * Math.sin(th), 1.1, ICE, 0.5 * kq, 0.3);
      }
      // 点核色由紫白混色转纯冰白
      const mixk = phase(t, 202.90, 204.60);
      const col = MOOD.map((v, i) => Math.trunc(v + (ICE[i] - v) * mixk));
      this._dot(d, gd, CX, CY, 3.0, col, 1.0, 0.7);
      this._micro(d, 'SHOT_192');
      return 0.12 * mixk;
    }
    // ── 阶段 4（204.60–205.7967）「黑场」：仅剩点核 + 2px 青光标 ──
    const aMicro = t < 205.20 ? 1.0 : 0.0;
    if (aMicro > 0) this._micro(d, 'SHOT_192', 0.6);
    let curOn = true;
    if (t >= 204.70) {
      curOn = _blink(t, 204.70, 0.60, 0.5) || _blink(t, 205.30, 0.60, 0.5);
    }
    let coreR = 3.0;
    if (t >= 205.55) coreR = 3.0 * (1.0 - _ease_in_quad(phase(t, 205.55, 205.81)));
    if (coreR > 0.2) this._dot(d, gd, CX, CY, coreR, ICE, 1.0, 0.7);
    if (curOn && t < 205.78) {
      const x = CX + 8.0;
      d.rectangle([x * ss, (CY - 14) * ss, (x + 2) * ss, (CY + 14) * ss], { fill: CYAN });
    }
    return 0.0;
  }

  /** 统一入口（纯函数） */
  render(shotId, t, ctx, gctx, dpr, beats) {
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats || []);
    const d = new PilDraw(c._f, false);
    const gd = new PilDraw(c._f, true);
    this._ctx = ctx;
    this._gctx = gctx;
    const fn = this['_r' + shotId.split('_')[1]];
    if (!fn) throw new Error(`CH11 无 ${shotId} 的绘制实现`);
    const boost = fn.call(this, d, gd, t, ctx, gctx) || 0.0;
    // SHOT_192 阶段 4：205.7967s 起满屏纯底色（无 bloom / 无 grain），交棒 CH12
    if (shotId === 'SHOT_192' && t >= 205.7967) {
      return { bloomR: 0, bloomK: 0, grain: 0, scan: 0 };
    }
    let gpct = BLOOM[shotId][1];
    if (shotId === 'SHOT_192' && t >= 204.60) gpct = 2.0;
    return c.flush(t, SEEDS[shotId], {
      radius: BLOOM_RADIUS,
      strength: Math.min(0.85, BLOOM[shotId][0] + boost),
      grainPct: gpct, scan: 0.0,
    });
  }
}

let SCENE = null;
function scene() {
  if (!SCENE) SCENE = new Ch11(1);
  return SCENE;
}

function ch11Shot(id, start, end, status, lyric) {
  return {
    id, start, end, seedHex: SEEDS[id], chapter: CHAPTER, status, lyric,
    draw(ctx, gctx, t, dpr, beats) {
      return scene().render(id, t, ctx, gctx, dpr, beats);
    },
  };
}

const SHOT_187 = ch11Shot('SHOT_187', 188.4800, 189.1912, 'FREE',
                          'Though you are free / 尽管你是自由的');
const SHOT_188 = ch11Shot('SHOT_188', 189.1912, 189.7500, 'MORPH',
                          'Though you are free / 尽管你是自由的');
const SHOT_189 = ch11Shot('SHOT_189', 189.7500, 190.8000, 'TRAP',
                          'I am trapped / 我被困住了');
const SHOT_190 = ch11Shot('SHOT_190', 190.8000, 191.3600, 'PRISON',
                          'Trapped in / 被困在');
const SHOT_191 = ch11Shot('SHOT_191', 191.3600, 199.4520, 'RING',
                          'Trapped in / 被困在');
const SHOT_192 = ch11Shot('SHOT_192', 199.4520, 205.8100, 'CUT',
                          '— / 归位·采样·合环·黑场');

export const CH11_SHOTS = [SHOT_187, SHOT_188, SHOT_189, SHOT_190, SHOT_191,
                           SHOT_192];
