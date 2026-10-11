/**
 * ch07.js — 第 07 章 FRAGMENTS / ILLEGAL ARGUMENTS（镜头 127–140）
 *
 * 自 Python 版 render/scenes/ch07_fragments.py 移植。
 * 本章用 `Canvas` 上下文（`c.*`）+ 章内 helper；公共中间层在 canvas.js，
 * 章内专有 helper（逻辑树几何、残片层）在本文件。
 *
 * 本章是全片红色崩坏段：130 露第一抹红 → 133 第二抹 → 137 错误红成为独立对象
 * → 138 成片红辉光 → 139 红色峰值 → 140 红退回「点」。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix,
  easeOutCubic, easeInCubic, easeOutExpo, rad, easeInQuad,
} from './core.js';
import * as P from './primitives.js';
import { Canvas, canvasFont, fontOf } from './kit.js';
import {
  font, tw, cellsOf, sampleText, mixc, dimc, blendc,
  easeInExpo, easeOutSine, easeInOutQuad, easeOutQuad, easeInOutSine, easeOutQuart, easeInQuart,
  easeOutQuint, easeInQuint, easeInOutQuint, easeInOutCubic, easeOutBack,
  mainWord, statusLine, cursor, mono, micro, blinkOn, cornerInfo, makeBeatStore,
} from './canvas.js';

const CHAPTER = 'ch07/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_SEMI = 'Inter Semi-Bold';

// 种子与题旨取自 Python 源码的 SEEDS / MOTIF（**不可自造**：seed 决定全部随机量）
const SEEDS = {
  SHOT_127: '1ED5C201', SHOT_128: 'AA73A489', SHOT_129: 'DBCB03B4',
  SHOT_130: '57CE86C0', SHOT_131: 'E5F9FD38', SHOT_132: 'E0EE4E89',
  SHOT_133: '729D0D18', SHOT_134: '17E515F5', SHOT_135: '39E3A6F7',
  SHOT_136: '91B5DAA9', SHOT_137: 'E26DDF23', SHOT_138: 'B13EC221',
  SHOT_139: '44C65A3C', SHOT_140: 'A87642D2',
};
const MOTIF = {
  SHOT_127: 'IF', SHOT_128: 'ERASE', SHOT_129: 'MORPH', SHOT_130: 'FREEZE',
  SHOT_131: 'MAYBE', SHOT_132: 'ARCHIVE', SHOT_133: 'DECAY', SHOT_134: 'FLAT',
  SHOT_135: 'DEFY', SHOT_136: 'MORPH', SHOT_137: 'PARSING',
  SHOT_138: 'DECODE_FAIL', SHOT_139: 'ERR', SHOT_140: 'CRITICAL',
};

/** 画布中心（对应 Python 的 CX / CY） */
const CX = BASE_W * 0.5;
const CY = BASE_H * 0.5;
/** 逻辑树固定几何（取 Python 真值，**不可自造**） */
const TREE_ROOT = [0.08 * BASE_W, 0.84 * BASE_H];
const TREE_TIP = [0.72 * BASE_W, 0.26 * BASE_H];
const ROOT_DOT = [0.38 * BASE_W, 0.72 * BASE_H];
/** 128/129 主词字号 */
const LAW_PX = 132.0;

/** SHOT_128 橡皮擦扫描线 x：100%→74%(easeInOutQuad)→48%(linear)→32%(easeOutExpo) */
function scanX(t) {
  let x = BASE_W;
  x = lerp(x, 0.74 * BASE_W, easeInOutQuad(phase(t, 118.98, 119.26)));
  if (t >= 119.26) x = lerp(0.74 * BASE_W, 0.48 * BASE_W, clamp01((t - 119.26) / 0.46));
  if (t >= 119.72) x = lerp(0.48 * BASE_W, 0.32 * BASE_W, easeOutExpo(phase(t, 119.72, 119.96)));
  return x;
}

let BEATS = null;
function beatStore(beats) {
  if (!BEATS) BEATS = makeBeatStore(beats || []);
  return BEATS;
}

function blInfo(sid, extra = '') {
  let s = `seed:${SEEDS[sid]}`;
  if (MOTIF[sid]) s += ` · motif:${MOTIF[sid]}`;
  return s + (extra ? ` · ${extra}` : '');
}

/* ── 章内 helper ─────────────────────────────────────────────── */
/** if 逻辑树固定几何：7 条二级枝 + 14 条三级枝（确定性，无随机） */
function treeParts() {
  const [x0, y0] = TREE_ROOT, [x1, y1] = TREE_TIP;
  const sec = [], ter = [];
  for (let k = 0; k < 7; k++) {
    const u = 0.24 + 0.105 * k;
    const bx = lerp(x0, x1, u), by = lerp(y0, y1, u);
    const a2 = rad(-52.0 - 14.0 * (k % 3));
    const L2 = 118.0 + 26.0 * ((k * 7) % 5);
    const e2 = [bx + Math.cos(a2) * L2, by + Math.sin(a2) * L2];
    sec.push([[bx, by], e2]);
    for (let m = 0; m < 2; m++) {
      const uu = 0.45 + 0.4 * m;
      const tx = lerp(bx, e2[0], uu), ty = lerp(by, e2[1], uu);
      const a3 = a2 + rad(34.0 - 68.0 * m);
      const L3 = 54.0 + 12.0 * ((k + m) % 4);
      ter.push([[tx, ty], [tx + Math.cos(a3) * L3, ty + Math.sin(a3) * L3]]);
    }
  }
  return { sec, ter };
}

/** 树后旧章符号残片层（半圆/断轨/短栅格，≤18px，缓慢自旋） */
function shardsLayer(c, t, T0, seedHex, n = 60, a = 0.12) {
  for (let i = 0; i < n; i++) {
    const r = new Rng(seedFromHex(seedHex), 'debris', i);
    const x = r.range(0.06, 0.94) * BASE_W, y = r.range(0.10, 0.90) * BASE_H;
    const s = r.range(8.0, 18.0);
    const rot = (t - T0) * r.range(4.0, 14.0) + r.range(0, 360);
    const kind = i % 3;
    if (kind === 0) {
      c.arc(x, y, s * 0.5, rot, rot + 180, GREY, 1.0, a);
    } else if (kind === 1) {
      c.line(x - s * 0.5, y, x + s * 0.5, y, GREY, 1.0, a);
      c.line(x, y - s * 0.3, x, y + s * 0.3, GREY, 1.0, a);
    } else {
      for (let k = 0; k < 3; k++) {
        c.line(x - s * 0.4 + k * s * 0.4, y - s * 0.4,
               x - s * 0.4 + k * s * 0.4, y + s * 0.4, GREY, 1.0, a);
      }
    }
  }
}

/** 继承 SHOT_126 的孤点：r=4 实心冰白 + 外圈空心环 */
function rootDot(c, t, rExt = 12.0, a = 1.0) {
  const [x, y] = ROOT_DOT;
  c.dot(x, y, 4.0, ICE, a, 0.6);
  c.circle(x, y, rExt, GREY, 1.0, 0.30 * a, 0.0);
}

/** 方括号对（条件括号/节点框） */
function bracket(c, x, y, w, h, color, a = 1.0, g = 0.3, arm = 10.0) {
  for (const sgn of [-1.0, 1.0]) {
    const bx = x + (sgn * w) * 0.5;
    c.line(bx, y - h * 0.5, bx, y + h * 0.5, color, 2.0, a, g);
    c.line(bx, y - h * 0.5, bx - sgn * arm, y - h * 0.5, color, 2.0, a, g);
    c.line(bx, y + h * 0.5, bx - sgn * arm, y + h * 0.5, color, 2.0, a, g);
  }
}

/** 逻辑树绘制（对应 Python 的 `_tree_draw`，逐行对齐）
 *  `eraseX` 给定时 x > eraseX 的元件视为已被橡皮擦扫过。 */
function treeDraw(c, t, T0, opts = {}) {
  const { tipP = 1.0, secP = 1.0, terP = 1.0, alpha = 1.0,
          colSec = BV, colTer = GREY, eraseX = null, sc = 1.0, nodeA = 0.9 } = opts;
  const [x0, y0] = TREE_ROOT;
  const [x1, y1] = TREE_TIP;
  const cx0 = lerp(x0, x1, 0.5);
  const cy0 = lerp(y0, y1, 0.5);
  const tr = (x, y) => [cx0 + (x - cx0) * sc, cy0 + (y - cy0) * sc];

  const tip = tr(lerp(x0, x1, clamp01(tipP)), lerp(y0, y1, clamp01(tipP)));
  const rt = tr(x0, y0);
  c.line(rt[0], rt[1], tip[0], tip[1], CYAN, 3.0, alpha, 0.45 * alpha);
  const { sec, ter } = treeParts();
  for (let k = 0; k < sec.length; k++) {
    const seg = sec[k];
    let p = easeOutCubic(phase(t, T0 + 0.15 + k * 0.025, T0 + 0.15 + k * 0.025 + 0.12));
    p *= secP;
    if (p <= 0.0) continue;
    if (eraseX != null && seg[0][0] > eraseX) continue;
    const a0 = tr(seg[0][0], seg[0][1]);
    const a1 = tr(seg[1][0], seg[1][1]);
    c.line(a0[0], a0[1], lerp(a0[0], a1[0], p), lerp(a0[1], a1[1], p),
           colSec, 2.0, alpha, 0.3 * alpha);
    if (p >= 1.0) c.circle(a1[0], a1[1], 3.0, colSec, 1.0, alpha * nodeA, 0.0, 0.35);
  }
  const kk = steps(t, 4, T0 + 0.26, T0 + 0.34);
  for (let k = 0; k < ter.length; k++) {
    const seg = ter[k];
    if (kk <= (k % 4)) continue;
    if (eraseX != null && seg[0][0] > eraseX) continue;
    const a0 = tr(seg[0][0], seg[0][1]);
    const a1 = tr(seg[1][0], seg[1][1]);
    c.line(a0[0], a0[1], a1[0], a1[1], colTer, 1.0, alpha * terP * 0.9, 0.0);
  }
}

/** 折线路径按弧长参数化取点（对应 Python 的 `_path_point`） */
function pathPoint(pts, u) {
  const segs = [];
  let total = 0.0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push([total, d, pts[i], pts[i + 1]]);
    total += d;
  }
  const d0 = clamp01(u) * total;
  for (const [s0, d, a, b] of segs) {
    if (d0 <= s0 + d) {
      const k = (d0 - s0) / Math.max(1e-6, d);
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    }
  }
  return pts[pts.length - 1];
}

/** 全片统一：主词 + 角标 + flush 的收尾封装 */
function finish(c, t, sid, range, br, flushOpts) {
  cornerInfo(c, sid, range[0], blInfo(sid, flushOpts.info || ''), br, 0.6, CHAPTER);
  return c.flush(t, SEEDS[sid], flushOpts);
}

/* ══════════════════════════════════════════════════════════════
   SHOT_127  `118.33–118.98` ｜ IF：孤点为根，if 逻辑树 28° 向右上生长
   ══════════════════════════════════════════════════════════════ */
const SHOT_127 = {
  id: 'SHOT_127', start: 118.33, end: 118.98,
  seedHex: SEEDS.SHOT_127, chapter: CHAPTER, status: 'IF',
  lyric: 'If I can / 如果我能',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    this._b.of('SHOT_127', [this.start, this.end]);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    c.shotId = 'SHOT_127';
    const sid = 'SHOT_127';
    const [T0, T1] = [this.start, this.end];
    const bs = this._b.of(sid, [T0, T1]);
    let pulse = 1.0;
    for (const b of bs) {
      if (b <= t && t <= b + 0.05) pulse += 0.018 * Math.sin(Math.PI * clamp01((t - b) / 0.05));
    }
    const flash = steps(t, 2, T0, T0 + 0.15);
    shardsLayer(c, t, T0, SEEDS[sid], 60, 0.12);
    treeDraw(c, t, T0, {
      tipP: easeOutExpo(phase(t, T0, T0 + 0.41)), secP: 1.0, terP: 1.0, sc: pulse,
    });
    // 生长前沿亮点 + 拖尾
    const tipP = easeOutExpo(phase(t, T0, T0 + 0.41));
    const fx = lerp(TREE_ROOT[0], TREE_TIP[0], tipP);
    const fy = lerp(TREE_ROOT[1], TREE_TIP[1], tipP);
    c.dot(fx, fy, 5.0, ICE, 0.95, 0.7);
    c.line(fx - 12.0, fy + 12.0, fx, fy, CYAN, 2.0, 0.5, 0.4);
    // 根节点孤点（steps(2) 闪 2 次后外环展开）
    const er = (bs.length && t >= bs[bs.length - 1])
      ? 12.0 + 6.0 * Math.sin(Math.PI * clamp01((t - bs[bs.length - 1]) / 0.08))
      : 12.0;
    rootDot(c, t, er, 0.55 + 0.45 * (flash % 2 ? 0.5 : 1.0));
    bracket(c, ROOT_DOT[0] + 60.0, ROOT_DOT[1], 60.0, 36.0, BV, 0.9, 0.3, 12.0);
    // 主词 If I can：If 先 0.06s、can 迟 0.12s
    mainWord(c, t, 'If I can', FONT_SEMI, 156, 0.05, ICE, {
      baseline: 0.82 * BASE_H, align: 'left', x: 0.10 * BASE_W, instant: true, glow: 0.45,
      perChar: (i, ch, tt) => ({
        a: i <= 2 ? easeOutCubic(phase(tt, T0, T0 + 0.10))
                  : easeOutCubic(phase(tt, T0 + 0.12, T0 + 0.22)),
      }),
    });
    micro(c, ROOT_DOT[0] + 66.0, ROOT_DOT[1] + 26.0, 'COND:pending', GREY, 20.0, 0.75);
    return finish(c, t, sid, [T0, T1], 'IF',
                  { radius: 6.0, strength: 0.30, grainPct: 5.0, scan: 0.0,
                    info: 'nodes:22' });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_128  `118.98–120.0328` ｜ ERASE：垂直橡皮擦自 100% 推进到 32%
   ══════════════════════════════════════════════════════════════ */
const SHOT_128 = {
  id: 'SHOT_128', start: 118.98, end: 120.0328,
  seedHex: SEEDS.SHOT_128, chapter: CHAPTER, status: 'ERASE',
  lyric: 'erase all the pointless / 擦掉所有无意义的',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    this._b.of('SHOT_128', [this.start, this.end]);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_128';
    const [T0, T1] = [this.start, this.end];
    const bs = this._b.of(sid, [T0, T1]);
    const sx = scanX(t);
    let boost = 0.0;
    for (const b of bs) {
      if (b <= t && t <= b + 0.12) boost = 0.4 * Math.sin((Math.PI * (t - b)) / 0.12);
    }
    shardsLayer(c, t, T0, SEEDS[sid], 60, 0.12 * (1.0 - phase(t, T0, 119.96)));
    treeDraw(c, t, T0, {
      tipP: 1.0, sc: 1.0, alpha: 0.9, secP: 1.0, terP: 1.0, eraseX: sx,
      colSec: blendc(BV, GREY, 0.5 + 0.5 * phase(t, 119.26, 119.96)),
    });
    rootDot(c, t, 12.0, 0.6);
    // 被擦除物：三级枝端 → 微尘向右飘
    const { ter } = treeParts();
    let nEr = 0;
    for (let k = 0; k < ter.length; k++) {
      const seg = ter[k];
      if (seg[0][0] <= sx) {
        nEr += 1;
        const r = new Rng(seedFromHex(SEEDS[sid]), 'dust', k);
        const u = clamp01((t - T0) / 0.6);
        for (let m = 0; m < 6 + (k % 5); m++) {
          const dx = r.range(6.0, 40.0) * u;
          const dy = r.range(-14.0, 14.0) * u;
          const a = (1.0 - phase(t, 119.72, 119.96)) * 0.7;
          if (a > 0.01) c.dot(seg[1][0] + dx, seg[1][1] + dy, 2.0, GREY, a, 0.0);
        }
      }
    }
    // 扫描线 + 两侧渐隐辉光
    c.line(sx, 0, sx, BASE_H, ICE, 4.0, 1.0, 0.9);
    c.rect(sx - 26.0, 0, sx, BASE_H, ICE, 0.0, 1.0, 0.05);
    c.rect(sx, 0, sx + 26.0, BASE_H, ICE, 0.0, 1.0, 0.05);
    // 计数器标签
    c.rect(sx - 48.0, 8.0, sx + 48.0, 30.0, BG_ALT, 1.0, 0.8, 0.9);
    const fx = font('JetBrains Mono', 16.0, c.ss);
    const lab = `erased:${String(nEr * 3 + 2).padStart(2, '0')}`;
    c.text(sx - tw(c, fx, lab) * 0.5, 12.0, lab, fx, ICE, 0.9);
    // 主词（pointless 于 119.55s 变灰蓝 55%）
    const kk = phase(t, 119.55, 119.75);
    const w1 = 'erase all the ';
    mainWord(c, t, 'erase all the pointless', FONT_SEMI, LAW_PX, 0.04,
             blendc(ICE, GREY, kk), {
      baseline: 0.52 * BASE_H, align: 'left', x: 0.10 * BASE_W,
      instant: true, glow: 0.4,
      perChar: (i, ch, tt) => {
        const a0 = easeOutCubic(phase(tt, T0 + 0.28 + i * 0.012, T0 + 0.28 + i * 0.012 + 0.12));
        return { a: i < w1.length ? a0 : (kk > 0.5 ? 0.55 : 1.0) * a0 };
      },
    });
    micro(c, sx + 8.0, 40.0, 'SWEEP:x', GREY, 18.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, `sweep:${Math.trunc(100 - (sx / BASE_W) * 100)}%`),
               'ERASE', 0.6, CHAPTER);
    const out = c.flush(t, SEEDS[sid], { radius: 10.0, strength: 0.45, grainPct: 5.0, scan: 0.0 });
    return { ...out, boost };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_129  `120.0328–120.86` ｜ MORPH：主词 2800 点沿螺线吸附入核环
   ══════════════════════════════════════════════════════════════ */
const SHOT_129 = {
  id: 'SHOT_129', start: 120.0328, end: 120.86,
  seedHex: SEEDS.SHOT_129, chapter: CHAPTER, status: 'MORPH',
  lyric: 'erase all the pointless / 擦掉所有无意义的',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    this._b.of('SHOT_129', [this.start, this.end]);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_129';
    const [T0, T1] = [this.start, this.end];
    const seedHex = SEEDS[sid];
    treeDraw(c, t, T0 - 1.0, {
      tipP: 1.0, alpha: 0.4 * 0.4, secP: 1.0, terP: 0.0, colSec: GREY, eraseX: scanX(120.86),
    });
    shardsLayer(c, t, T0, seedHex, 60, 0.05);
    // 采样网格 5×3 闪现（2 帧）
    if (t < T0 + 2.0 / 60.0) {
      for (let i = 0; i < 6; i++) {
        const x = 0.10 * BASE_W + (i * (0.8 * BASE_W)) / 5;
        c.line(x, 0.40 * BASE_H, x, 0.56 * BASE_H, GREY, 1.0, 0.28);
      }
      for (let j = 0; j < 4; j++) {
        const y = 0.40 * BASE_H + (j * (0.16 * BASE_H)) / 3;
        c.line(0.10 * BASE_W, y, 0.90 * BASE_W, y, GREY, 1.0, 0.28);
      }
    }
    // ① 主词轮廓采样 2800 点
    const f = font(FONT_SEMI, LAW_PX, c.ss);
    const { cells } = cellsOf(f, 'erase all the pointless', LAW_PX, 0.04, c.ss);
    const pts = sampleText('erase all the pointless', f, c.ss, 4.0,
                           0.10 * BASE_W, 0.52 * BASE_H - f.asc / c.ss, 2800);
    // ② 沿螺线吸附至核环
    const p = easeInOutCubic(phase(t, 120.20, 120.58));
    const moved = P.orbitTransition(pts, [0.5, 0.48], 0.5, p * 0.92, (v) => v);
    for (let i = 0; i < moved.length; i++) {
      const col = i % 4 !== 3 ? ICE : GREY;
      const keep = i % 3 ? 0.35 : 0.6;
      const px = lerp(pts[i][0], moved[i][0], keep + (1.0 - keep) * p);
      const py = lerp(pts[i][1], moved[i][1], keep + (1.0 - keep) * p);
      c.dot(px, py, 1.6, col, 0.85, 0.25);
    }
    // ③ 碎片核：开口圆环 r=64→38
    const R = lerp(64.0, 38.0, easeInCubic(phase(t, 120.58, 120.78)));
    c.arc(CX, CY - 21.6, R, 20, 340, BV, 2.0, 0.9, 0.4);
    const core = 1.0 + 0.06 * easeInQuad(phase(t, 120.78, T1));
    for (let k = 0; k < 12; k++) {
      const ang = (2 * Math.PI * k) / 12.0;
      c.dot(CX + Math.cos(ang) * R * core * 0.5,
            CY - 21.6 + Math.sin(ang) * R * core * 0.5, 2.0, ICE, 0.9, 0.5);
    }
    // ④ 扫描线残迹：碎为 24 段下落 30px 后溶解
    if (t < 120.78) {
      for (let k = 0; k < 24; k++) {
        const r = new Rng(seedFromHex(seedHex), 'scanres', k);
        const y = (k + 0.5) * (BASE_H / 24.0) + 30.0 * easeInQuad(phase(t, T0, 120.78));
        const a = 1.0 - phase(t, 120.58, 120.78);
        c.line(0.32 * BASE_W + r.range(-3, 3), y - 4.0,
               0.32 * BASE_W + r.range(-3, 3), y + 4.0, ICE, 2.0, a * 0.6, 0.3);
      }
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px · 2800pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, SEEDS[sid], { radius: 9.0, strength: 0.42, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_130  `120.86–121.90` ｜ FREEZE：核环炸裂为 9 块字形碎片 + 180 多边形碎片
   ══════════════════════════════════════════════════════════════ */
const SHOT_130 = {
  id: 'SHOT_130', start: 120.8600, end: 121.7300,
  seedHex: SEEDS.SHOT_130, chapter: CHAPTER, status: 'FREEZE',
  lyric: 'FRAGMENTS / 碎片',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_130';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const frozen = t >= 121.24;
    let pe, ps;
    if (t < 121.24) {
      pe = easeOutExpo(phase(t, T0, T0 + 0.12));
      ps = easeOutQuint(phase(t, T0 + 0.12, 121.24));
    } else { pe = ps = 1.0; }

    // ① 字形碎片：主词蒙版切 9 块，各块保留本身字距位置
    const f = font('Inter Bold', 220, c.ss);
    const { cells } = cellsOf(f, 'FRAGMENTS', 220.0, 0.08, c.ss);
    const off = 1.0 + f.stroke;
    const asc = f.asc / c.ss;
    const totalW = (cells.length ? cells[cells.length - 1][1] + cells[cells.length - 1][2] : 0)
                   + 2 * off / c.ss;
    const wb = totalW, hb = (f.asc + f.desc) / c.ss + 2 * off / c.ss;
    const ox = CX - wb * 0.5;
    const oy = 0.46 * BASE_H - asc * 0.5 - off / c.ss;
    for (let k = 0; k < 9; k++) {
      const x0 = Math.trunc((wb * k) / 9.0);
      const x1 = Math.trunc((wb * (k + 1)) / 9.0);
      const r = new Rng(seedFromHex(seedHex), 'slab', k);
      const ang = r.range(-0.55, 0.55) + (k < 4 ? Math.PI : 0.0);
      const drift = r.range(14.0, 44.0) * (0.86 * pe + 0.14 * ps);
      let extra = 0.0;
      if (t >= 121.68 && k === 8) extra = 60.0 * easeOutCubic(phase(t, 121.68, T1));
      const dx = Math.cos(ang) * drift - extra * 0.7;
      const dy = Math.sin(ang) * drift + extra * 0.7;
      // 该块的文本（按字距切分）
      const slabTxt = cells.filter(([, xo2, adv]) => xo2 >= x0 - 1 && xo2 < x1 + 1)
                           .map(([ch]) => ch).join('');
      if (slabTxt) {
        const bx = ox + x0 + dx;
        c.text(bx, oy + dy, slabTxt, f, ICE, 0.88, 0.4);
      }
    }
    // ② 180 枚多边形碎片（径向抛出后急停）
    const polys = P.shards(180, seedHex, 'shards', [0.5, 0.46], 0.30);
    for (let k = 0; k < polys.length; k++) {
      const poly = polys[k];
      const r = new Rng(seedFromHex(seedHex), 'pdir', k);
      const ang = Math.atan2(poly[0][1] - 0.46 * BASE_H, poly[0][0] - CX);
      const d = r.range(30.0, 150.0) * (0.8 * pe + 0.2 * ps);
      const col = k % 10 < 3 ? GREY : BV;
      const moved = poly.map(([x, y]) => [x + Math.cos(ang) * d, y + Math.sin(ang) * d]);
      c.poly(moved, col, 1.0, 0.8, 0.0, 0.2);
    }
    // ③ 11 条应力裂纹（本章首抹红）
    const ca = (1.0 - phase(t, 121.24, 121.54)) * phase(t, 120.98, 121.10);
    if (ca > 0.01) {
      for (let k = 0; k < 11; k++) {
        const r = new Rng(seedFromHex(seedHex), 'crack', k);
        const x = r.range(0.2, 0.8) * BASE_W, y = r.range(0.3, 0.62) * BASE_H;
        for (let j = 0; j < 3; j++) {
          c.line(x + j * 24.0, y + r.range(-14, 14), x + (j + 1) * 24.0,
                 y + r.range(-14, 14), RED, 1.0, 0.35 * ca, 0.3);
        }
      }
    }
    // ④ 320 颗微尘（freeze 后 0.3px/s 漂移）
    for (let k = 0; k < 320; k++) {
      const r = new Rng(seedFromHex(seedHex), 'dust', k);
      let x = r.range(0.08, 0.92) * BASE_W;
      const y = r.range(0.16, 0.86) * BASE_H;
      if (frozen) x += 0.3 * (t - 121.24);
      c.dot(x, y, 1.0, ICE, 0.35, 0.0);
    }
    // freeze 期 12% 幽灵全词叠底
    if (frozen) {
      mainWord(c, t, 'FRAGMENTS', 'Inter Bold', 220, 0.08, ICE,
               { baseline: 0.46 * BASE_H, align: 'center', instant: true, alpha: 0.12 });
    }
    micro(c, CX - 90.0, 0.46 * BASE_H + 150.0, 'shards:189 · freeze', GREY, 18.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, 'shards:189'), 'FREEZE', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 4.0, strength: 0.28, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_131  `121.90–122.664` ｜ MAYBE：极端留白，左下三分点单分支
   ══════════════════════════════════════════════════════════════ */
const SHOT_131 = {
  id: 'SHOT_131', start: 121.7300, end: 122.7100,
  seedHex: SEEDS.SHOT_131, chapter: CHAPTER, status: 'MAYBE',
  lyric: 'Then maybe / 那么也许',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_131';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const x = 0.26 * BASE_W, y = 0.74 * BASE_H;

    // ① A 碎片落位
    const sc = 1.0 + 0.15 * (1.0 - easeOutBack(phase(t, T0, T0 + 0.15)));
    const fr = font('Inter Bold', 48, c.ss);
    c.text(x - 12.0 * sc, y - 34.0 * sc, 'A', fr, ICE, 0.95, 0.4);
    // ② 分支线：120px 水平 + 30° 上扬 60px
    const gp = easeOutExpo(phase(t, T0 + 0.15, T0 + 0.55));
    c.line(x + 36.0, y, x + 36.0 + 120.0 * gp, y, CYAN, 2.0, 1.0, 0.4);
    let bx1, by1;
    if (t >= T0 + 0.35) {
      const up = easeOutExpo(phase(t, T0 + 0.35, T0 + 0.55));
      const bx0 = x + 156.0, by0 = y;
      bx1 = bx0 + Math.cos(rad(-30.0)) * 60.0 * up;
      by1 = by0 + Math.sin(rad(-30.0)) * 60.0 * up;
      c.line(bx0, by0, bx1, by1, CYAN, 2.0, 1.0, 0.4);
      c.circle(bx1, by1, 3.0, CYAN, 1.0, 0.9, 0.0, 0.4);
    } else { bx1 = x + 156.0; by1 = y; }
    c.circle(x + 36.0 + 120.0 * gp, y, 3.0, CYAN, 1.0, 0.9, 0.0, 0.4);
    bracket(c, bx1, by1 - 14.0, 60.0, 28.0, BV, 0.9, 0.3, 10.0);
    for (let k = 0; k < 4; k++) {
      c.dot(bx1 - 30.0 + (k % 2) * 60.0, by1 - 28.0 + Math.trunc(k / 2) * 28.0,
            2.0, ICE, 0.8, 0.5);
    }
    // ③ 主词 48px 逐字符淡入（20ms 错峰）
    mainWord(c, t, 'Then maybe', 'Inter Medium', 48, 0.06, ICE, {
      baseline: by1 - 26.0, align: 'left', x: bx1 + 12.0,
      tIn: T0 + 0.57, stagger: 0.020, rise: 4.0, glow: 0.35,
    });
    micro(c, x + 40.0, y + 10.0, 'branch:single', GREY, 16.0, 0.75);
    // ④ 末端节点环扩张并描出 25% 圆弧
    if (t >= T0 + 0.83) {
      c.arc(bx1, by1, 8.0, -90, -90 + 90.0 * phase(t, T0 + 0.83, T1), CYAN, 2.0, 1.0, 0.4);
    }
    // 环境：24 颗 1px 休眠微尘
    for (let k = 0; k < 24; k++) {
      const r = new Rng(seedFromHex(seedHex), 'dust', k);
      c.dot(r.range(0.02, 0.98) * BASE_W, r.range(0.04, 0.96) * BASE_H,
            1.0, GREY, 0.4, 0.0);
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'branch:1'), 'MAYBE', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.25, grainPct: 4.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_132  `122.7100–123.9308` ｜ ARCHIVE：5 枚递减圆环沿对角线存档列阵
   ══════════════════════════════════════════════════════════════ */
const SHOT_132 = {
  id: 'SHOT_132', start: 122.7100, end: 123.9308,
  seedHex: SEEDS.SHOT_132, chapter: CHAPTER, status: 'ARCHIVE',
  lyric: "Then maybe you won't leave me so / 那么也许你不会这样离开我",
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_132';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const x0 = 0.30 * BASE_W, y0 = 0.70 * BASE_H;
    const x1 = 0.68 * BASE_W, y1 = 0.26 * BASE_H;
    const f14 = font('JetBrains Mono', 14.0, c.ss);

    for (let n = 1; n <= 5; n++) {
      const u = (n - 1) / 4.0;
      const cxn = lerp(x0, x1, u), cyn = lerp(y0, y1, u);
      const r = 72.0 - 11.0 * n;
      const gap = 20.0 + 14.0 * n;
      const col = n <= 2 ? CYAN : BV;
      const appear = n > 1 ? T0 + (n - 1) * 0.11 : T0;
      const p = easeOutCubic(phase(t, appear, appear + 0.13));
      if (p <= 0.0) continue;
      const flash = (appear <= t && t < appear + 2.0 / 60.0) ? 1.0 : 0.0;
      c.arc(cxn, cyn, r, gap * 0.5, 360.0 - gap * 0.5 + 90.0 * (1.0 - p),
            blendc(col, ICE, flash), 3.0 - 0.3 * n, p, 0.35 + 0.3 * flash);
      for (let k = 0; k < 4; k++) {
        const ang = rad(gap * 0.5 + ((360.0 - gap) * k) / 4.0);
        c.dot(cxn + Math.cos(ang) * r, cyn + Math.sin(ang) * r, 2.0, col, p, 0.3);
      }
      c.dot(cxn, cyn, 6.0, GREY, 0.25 * p, 0.0);
      // 档案标签
      c.rect(cxn + r + 6.0, cyn - 8.0, cxn + r + 74.0, cyn + 8.0, GREY, 1.0, 0.5 * p);
      c.text(cxn + r + 10.0, cyn - 6.0, `arc:${n}/5`, f14, GREY, 0.8 * p);
      // 存档脉冲环
      const pr = phase(t, appear, appear + 0.30);
      if (pr > 0.0 && pr < 1.0) {
        c.circle(cxn, cyn, r + 24.0 * easeOutQuad(pr), ICE, 1.0, (1.0 - pr) * 0.7, 0.0, 0.4);
      }
    }
    // 主词两行 68px（leave me so 于 123.50s 变灰蓝）
    const kk = phase(t, 123.50, 123.70);
    const n1 = "Then maybe you won't".length;
    mainWord(c, t, "Then maybe you won't", 'Inter Medium', 68, 0.05, ICE, {
      baseline: 0.58 * BASE_H - 78.0, align: 'left', x: 0.10 * BASE_W,
      tIn: T0 + 0.69, stagger: 0.010, rise: 5.0, glow: 0.35,
    });
    mainWord(c, t, 'leave me so', 'Inter Medium', 68, 0.05, blendc(ICE, GREY, kk), {
      baseline: 0.58 * BASE_H, align: 'left', x: 0.10 * BASE_W,
      tIn: T0 + 0.69 + n1 * 0.010, stagger: 0.010, rise: 5.0, glow: 0.35,
    });
    micro(c, 0.10 * BASE_W, 0.58 * BASE_H + 20.0, 'retention:decaying', GREY, 16.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, 'arcs:5'), 'ARCHIVE', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.32, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_133  `123.9308–124.8900` ｜ DECAY：续存第 6–8 环 + 前 5 枚红叉 + 点阵吸附
   ══════════════════════════════════════════════════════════════ */
const SHOT_133 = {
  id: 'SHOT_133', start: 123.9308, end: 124.8900,
  seedHex: SEEDS.SHOT_133, chapter: CHAPTER, status: 'DECAY',
  lyric: "Then maybe you won't leave me so / 那么也许你不会这样离开我",
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_133';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const x0 = 0.30 * BASE_W, y0 = 0.70 * BASE_H;
    const x1 = 0.68 * BASE_W, y1 = 0.26 * BASE_H;

    // 前 5 枚（继承，60% 透明）+ 红叉
    for (let n = 1; n <= 5; n++) {
      const u = (n - 1) / 4.0;
      const cxn = lerp(x0, x1, u), cyn = lerp(y0, y1, u);
      const r = 72.0 - 11.0 * n;
      const gap = 20.0 + 14.0 * n;
      const col = n <= 2 ? CYAN : BV;
      c.arc(cxn, cyn, r, gap * 0.5, 360.0 - gap * 0.5, col, 3.0 - 0.3 * n,
            0.6 * (1.0 - 0.3 * phase(t, T0, 124.42)), 0.2);
      const cp = phase(t, T0 + (n - 1) * 0.06, T0 + (n - 1) * 0.06 + 0.08);
      if (cp > 0.0) {
        const lx = cxn + r + 40.0, ly = cyn;
        c.line(lx - 14.0, ly - 8.0, lx - 14.0 + 28.0 * cp, ly - 8.0 + 16.0 * cp,
               RED, 1.0, 0.9, 0.3);
        c.line(lx - 14.0, ly + 8.0, lx - 14.0 + 28.0 * cp, ly + 8.0 - 16.0 * cp,
               RED, 1.0, 0.9, 0.3);
      }
    }
    // 第 6–8 枚（更小、缺口更大、递灰）
    const RR = [17.0, 12.0, 8.0], GG = [104.0, 130.0, 160.0];
    for (let n = 6; n <= 8; n++) {
      const i = n - 6;
      const r = RR[i], gap = GG[i];
      const col = blendc(BV, GREY, i / 2.0);
      const cxn = lerp(x1 - 60.0, x1, i / 2.0), cyn = lerp(y1 + 40.0, y1, i / 2.0);
      const p = easeOutQuad(phase(t, T0 + i * 0.07, T0 + i * 0.07 + 0.10));
      if (p > 0.0) c.arc(cxn, cyn, r, gap * 0.5, 360.0 - gap * 0.5, col, 1.5, p, 0.25);
    }
    // 主词两行采样 1600 点 → 65% 吸附第 8 枚残弧
    const f = font('Inter Medium', 68, c.ss);
    const { cells: cells1 } = cellsOf(f, "Then maybe you won't", 68.0, 0.05, c.ss);
    const off = 1.0 + f.stroke;
    const asc = f.asc / c.ss;
    const oy1 = 0.58 * BASE_H - 78.0 - asc - off / c.ss;
    const pts1 = sampleText("Then maybe you won't", f, c.ss, 4.0,
                            0.10 * BASE_W - off / c.ss, oy1, 1300);
    const oy2 = 0.58 * BASE_H - asc - off / c.ss;
    const pts2 = sampleText('leave me so', f, c.ss, 4.0,
                            0.10 * BASE_W - off / c.ss, oy2, 300);
    const pts = pts1.concat(pts2);
    const p = easeInOutCubic(phase(t, 124.16, 124.42));
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      let tx, ty;
      if (i % 100 < 65) { tx = x1 - 20.0; ty = y1 - 10.0 + (i % 20) * 0.8; }
      else { tx = x - 220.0 * phase(t, 124.42, 124.74); ty = y - 160.0 * phase(t, 124.42, 124.74); }
      const a = 1.0 - phase(t, 124.42, 124.74);
      if (a <= 0.01) continue;
      c.dot(lerp(x, tx, p), lerp(y, ty, p), 1.6, i % 4 ? ICE : GREY, a * 0.85, 0.2);
    }
    // 残弧合并为微弧 → 末段拉直成水平基线
    if (t < 124.74) {
      c.arc(x1 - 20.0, y1 - 10.0, 8.0, 200, 220, MOOD, 2.0, 0.55, 0.3);
    } else {
      const lp = easeOutCubic(phase(t, 124.74, T1));
      c.line(0.12 * BASE_W + 0.40 * BASE_W * (1.0 - lp), 0.50 * BASE_H,
             0.52 * BASE_W, 0.50 * BASE_H, ICE, 1.0, 1.0, 0.45);
    }
    micro(c, 0.10 * BASE_W, 0.58 * BASE_H + 20.0, 'retention:decaying', GREY, 16.0,
          0.75 * (1.0 - phase(t, 124.10, 124.20)));
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px · 1600pt'), 'DECAY', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 6.0, strength: 0.30, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_134  `124.8900–125.7100` ｜ FLAT：心电线拉平为 ±3px 波纹 + 抽象缺损心
   ══════════════════════════════════════════════════════════════ */
const SHOT_134 = {
  id: 'SHOT_134', start: 124.8900, end: 125.7100,
  seedHex: SEEDS.SHOT_134, chapter: CHAPTER, status: 'FLAT',
  lyric: 'DISHEARTENED / 心灰意冷',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_134';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];

    // ① 心电线（两次脉冲 → 拉平）
    const flat = easeOutCubic(phase(t, 125.38, 125.60));
    const wave = [];
    for (let i = 0; i < 320; i++) {
      const x = (i / 319.0) * BASE_W;
      let y = CY;
      if (t < 125.38) {
        for (const [p0, amp] of [[T0, 90.0], [125.16, 54.0]]) {
          if (p0 <= t && t <= p0 + 0.27) {
            const u = (t - p0) / 0.27;
            const w = Math.exp(-(((x - CX - (u - 0.5) * 520.0) ** 2)) / (2 * 62.0 ** 2));
            const sp = u < 0.35 ? easeOutExpo(Math.min(1.0, u / 0.35))
                                : 1.0 - easeInQuad((u - 0.35) / 0.65);
            y -= amp * w * sp;
          }
        }
      } else {
        y += 3.0 * (1.0 - flat) * Math.sin((2 * Math.PI * x) / 240.0)
           + 3.0 * flat * Math.sin((2 * Math.PI * x) / 240.0 + (t - T0) * 2.0);
      }
      wave.push([x, y]);
    }
    c.polyline(wave, CYAN, 2.0, t < 125.38 ? 1.0 : 0.65, 0.5);
    for (let k = 0; k < 8; k++) {
      const da = phase(t, 125.38 + k * 0.07, 125.38 + k * 0.07 + 0.12);
      if (da < 1.0) c.dot(CX - 260.0 + k * 74.0, CY - 60.0, 2.0, ICE, (1.0 - da) * 0.8, 0.4);
    }
    if (t >= 125.38) {
      c.dot((0.10 * BASE_W + 400.0 * (t - 125.38)) % BASE_W, CY, 3.0, WARM, 0.9, 0.6);
    }
    // ② 几何缺损心
    const hx = 0.72 * BASE_W, hy = 0.70 * BASE_H;
    const rot = rad(12.0 * phase(t, 125.16, T1));
    const rt = (px, py) => {
      const dx = px - hx, dy = py - hy;
      return [hx + dx * Math.cos(rot) - dy * Math.sin(rot),
              hy + dx * Math.sin(rot) + dy * Math.cos(rot)];
    };
    const ha = 0.40 * (1.0 - 0.15 * phase(t, 125.60, T1));
    const ra = rt(hx - 17.0, hy - 8.0);
    c.arc(ra[0], ra[1], 34.0, 180, 330, MOOD, 2.5, ha, 0.3);
    const rb = rt(hx + 17.0, hy - 8.0);
    c.arc(rb[0], rb[1], 34.0, 210, 360, MOOD, 2.5, ha, 0.3);
    c.polyline([rt(hx - 51.0, hy + 6.0), rt(hx, hy + 62.0), rt(hx + 51.0, hy + 6.0)],
               MOOD, 2.5, ha, 0.3);
    const n1 = rt(hx + 30.0, hy - 26.0);
    const n2 = rt(hx + 58.0, hy - 4.0);
    c.rect(Math.min(n1[0], n2[0]), Math.min(n1[1], n2[1]),
           Math.max(n1[0], n2[0]), Math.max(n1[1], n2[1]), RED, 1.0,
           (steps(t, 2, 125.20, 125.28) % 2 === 0) ? 0.8 : 0.3);
    // ③ 主词 176px
    const al = 1.0 - 0.55 * easeInOutSine(phase(t, 125.30, 125.60));
    mainWord(c, t, 'DISHEARTENED', 'Inter Bold', 176, 0.10, ICE, {
      baseline: 0.44 * BASE_H, align: 'center', alpha: al, instant: true, glow: 0.6 * al,
      perChar: (i, ch, tt) => ({
        a: easeOutCubic(phase(tt, T0 + i * 0.012, T0 + i * 0.012 + 0.10)),
      }),
    });
    micro(c, CX - 60.0, CY + 28.0, 'bpm:130→0', GREY, 18.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, 'bpm:130·decay'), 'FLAT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 6.0, strength: 0.30 * (1.0 - 0.5 * flat),
                                 grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_135  `125.7100–127.3620` ｜ DEFY：心跳线折转 90° 成垂直对抗轴
   ══════════════════════════════════════════════════════════════ */
const SHOT_135 = {
  id: 'SHOT_135', start: 125.7100, end: 127.3620,
  seedHex: SEEDS.SHOT_135, chapter: CHAPTER, status: 'DEFY',
  lyric: 'Challenging your god / 挑战你的神',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    this._b.of('SHOT_135', [this.start, this.end]);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_135';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const bs = this._b.of(sid, [T0, this.end]);

    // ① 平线右端折转 90° 成垂线
    const pivotX = 0.52 * BASE_W;
    const k = easeOutExpo(phase(t, T0, T0 + 0.23));
    c.line(0.12 * BASE_W, CY, lerp(0.52 * BASE_W, pivotX, k), CY, CYAN, 2.0,
           0.5 * (1.0 - k), 0.2);
    const ax = 0.50 * BASE_W;
    c.line(ax, lerp(CY, 0.30 * BASE_H, k), ax, lerp(CY, 1.0 * BASE_H, k), CYAN, 2.0, 1.0, 0.35);
    // ② 巨大圆环 + 3 圈同心轨道
    const breath = 1.0 + 0.012 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - T0)) / 4.0));
    let bp = 0.0;
    for (const b of bs) if (b <= t && t <= b + 0.05) bp += 0.02;
    const R = 248.0 * breath * (1.0 + bp);
    const ring = 1.0 - easeOutCubic(phase(t, T0, T0 + 0.20));
    c.circle(ax, 0.22 * BASE_H, R * (0.86 + 0.14 * ring), ICE, 4.0, 0.9, 0.0, 0.6);
    const ORBS = [200.0, 160.0, 120.0];
    for (let oi = 0; oi < ORBS.length; oi++) {
      const rr = ORBS[oi];
      const op = phase(t, T0 + 0.23 + oi * 0.09, T0 + 0.23 + oi * 0.09 + 0.14);
      if (op <= 0.0) continue;
      c.circle(ax, 0.22 * BASE_H, rr * breath, BV, 1.0, op * 0.8, 0.0, 0.25);
      for (let m = 0; m < 2; m++) {
        const ang = 2 * Math.PI * (t * 0.25 + m * 0.5 + oi * 0.2) + oi;
        c.dot(ax + Math.cos(ang) * rr * breath,
              0.22 * BASE_H + Math.sin(ang) * rr * breath, 3.0, ICE, op * 0.9, 0.4);
      }
    }
    // ③ 轴上 11 枚刻度
    for (let i = 0; i < 11; i++) {
      const y = lerp(0.30 * BASE_H, 1.0 * BASE_H, i / 10.0);
      const lit = t >= T0 + 0.9 + i * 0.12;
      c.line(ax - 4.0, y, ax + 4.0, y, lit ? CYAN : GREY, 1.0,
             lit ? 0.9 : 0.5, lit ? 0.4 : 0.0);
    }
    // ④ 下方核心点 + 3 圈张力涟漪 + 两条红虚线爬升
    const cx0 = ax, cy0 = 0.84 * BASE_H;
    c.dot(cx0, cy0, 5.0, ICE, 0.95, 0.7);
    c.circle(cx0, cy0, 12.0, MOOD, 1.0, 0.8, 0.0, 0.4);
    for (let ri = 0; ri < 3; ri++) {
      const pp = phase(t, T0 + 0.30 + ri * 0.12, T0 + 0.30 + ri * 0.12 + 0.5);
      if (pp > 0.0 && pp < 1.0) {
        c.circle(cx0, cy0, lerp(12.0, 60.0, easeOutQuad(pp)), MOOD, 1.0,
                 (1.0 - pp) * 0.5, 0.0, 0.2);
      }
    }
    const tp = easeOutCubic(phase(t, 126.42, 126.96));
    const h75 = lerp(cy0, 0.30 * BASE_H, 0.70 * tp);
    for (const sgn of [-1.0, 1.0]) {
      for (let j = 0; j < 9; j++) {
        const y0 = lerp(cy0, h75, j / 8.0);
        const y1 = lerp(cy0, h75, (j + 1) / 8.0);
        if (t >= 126.96) {
          c.line(cx0 + sgn * 16.0, y0, cx0 + sgn * 16.0, y1, RED, 1.0,
                 0.45 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (t - 126.96)) / 0.9)), 0.2);
        } else {
          c.line(cx0 + sgn * 16.0, y0, cx0 + sgn * 16.0, y1, RED, 1.0, 0.45, 0.2);
        }
      }
    }
    // ⑤ 主词两行 84px（god 于 126.40s 变情绪紫）
    const gp = phase(t, 126.40, 126.60);
    mainWord(c, t, 'Challenging your', 'Inter Bold', 84, 0.06, ICE, {
      baseline: 0.52 * BASE_H, align: 'left', x: 0.08 * BASE_W,
      tIn: T0 + 0.71, stagger: 0.014, rise: 5.0, glow: 0.4,
    });
    mainWord(c, t, 'god', 'Inter Bold', 84, 0.06, blendc(ICE, MOOD, gp), {
      baseline: 0.62 * BASE_H, align: 'left', x: 0.08 * BASE_W,
      tIn: T0 + 0.71 + 16 * 0.014, stagger: 0.014, rise: 5.0, glow: 0.4,
    });
    micro(c, ax + 12.0, 0.98 * BASE_H - 20.0, 'axis:vertical · tension:high', GREY, 16.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, 'tension:0.82'), 'DEFY', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 10.0, strength: 0.40, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_136  `127.3620–128.6600` ｜ MORPH：主词 2400 点沿轴向上迁移
   ══════════════════════════════════════════════════════════════ */
const SHOT_136 = {
  id: 'SHOT_136', start: 127.3620, end: 128.6600,
  seedHex: SEEDS.SHOT_136, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Challenging your god / 挑战你的神',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_136';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const ax = 0.50 * BASE_W;
    const p = easeInOutCubic(phase(t, 127.58, 128.14));

    // 采样网格 5×2 闪现
    if (t < T0 + 2.0 / 60.0) {
      for (let i = 0; i < 6; i++) {
        const x = 0.08 * BASE_W + (i * (0.34 * BASE_W)) / 5.0;
        c.line(x, 0.46 * BASE_H, x, 0.68 * BASE_H, GREY, 1.0, 0.25);
      }
      for (let j = 0; j < 3; j++) {
        const y = 0.46 * BASE_H + (j * (0.22 * BASE_H)) / 2.0;
        c.line(0.08 * BASE_W, y, 0.42 * BASE_W, y, GREY, 1.0, 0.25);
      }
    }
    // 继承的轴 + 圆环（呼吸继续）
    const breath = 1.0 + 0.012 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - 127.362)) / 4.0));
    c.line(ax, 0.30 * BASE_H, ax, BASE_H, CYAN, 2.0, 1.0, 0.35 + 0.15 * p);
    c.circle(ax, 0.22 * BASE_H, 248.0 * breath, ICE, 4.0, 0.9, 0.0, 0.6);
    for (const rr of [200.0, 160.0, 120.0]) {
      c.circle(ax, 0.22 * BASE_H, rr * breath, BV, 1.0, 0.8, 0.0, 0.25);
    }
    // 刻度 11→23 枚、行星 6→14 枚
    const nt = 11 + Math.trunc(12 * p);
    for (let i = 0; i < nt; i++) {
      const y = lerp(0.30 * BASE_H, BASE_H, i / Math.max(1.0, nt - 1.0));
      c.line(ax - 4.0, y, ax + 4.0, y, CYAN, 1.0, 0.9, 0.4);
    }
    const np = 6 + Math.trunc(8 * p);
    for (let i = 0; i < np; i++) {
      const rr = [200.0, 160.0, 120.0][i % 3] * breath;
      const ang = 2 * Math.PI * (t * 0.25 + i / Math.max(1.0, np));
      c.dot(ax + Math.cos(ang) * rr, 0.22 * BASE_H + Math.sin(ang) * rr, 3.0, ICE, 0.9, 0.45);
    }
    // 主词 2400 点沿轴向上迁移（横向保留 20% 原位）
    const f = font('Inter Bold', 84, c.ss);
    const allPts = [];
    const LINES = ['Challenging your', 'god'];
    for (let li = 0; li < 2; li++) {
      const s = LINES[li];
      const off = 1.0 + f.stroke;
      const asc = f.asc / c.ss;
      const oy = (0.52 + 0.10 * li) * BASE_H - asc - off / c.ss;
      const gp = sampleText(s, f, c.ss, 4.0, 0.08 * BASE_W - off / c.ss, oy,
                            li === 0 ? 1900 : 500);
      for (let q = 0; q < gp.length; q++) allPts.push([gp[q][0], gp[q][1], li, q]);
    }
    for (const [x, y, li, q] of allPts) {
      let tx, ty;
      if (q % 10 < 7) {
        ty = lerp(y, 0.30 * BASE_H + (0.62 * BASE_H * (q % 97)) / 97.0, p);
        tx = lerp(x, ax + (x - ax) * 0.20, p);
      } else {
        const ang = 2 * Math.PI * ((q % 200) / 200.0) + t * 0.25;
        tx = ax + Math.cos(ang) * 160.0;
        ty = 0.22 * BASE_H + Math.sin(ang) * 160.0;
      }
      const col = li === 1 ? MOOD : ICE;
      const a = Math.min(1.0, 0.9 * (1.0 - 0.6 * p) + 0.3);
      c.dot(lerp(x, tx, p), lerp(y, ty, p), 1.8, col, a, 0.25);
    }
    // 15% 幽灵全词 2 帧
    if (t >= 128.48 && t < 128.48 + 2.0 / 60.0) {
      mainWord(c, t, 'Challenging your', 'Inter Bold', 84, 0.06, ICE,
               { baseline: 0.52 * BASE_H, align: 'left', x: 0.08 * BASE_W,
                 instant: true, alpha: 0.15 });
      mainWord(c, t, 'god', 'Inter Bold', 84, 0.06, MOOD,
               { baseline: 0.62 * BASE_H, align: 'left', x: 0.08 * BASE_W,
                 instant: true, alpha: 0.15 });
    }
    // ④ 圆环底部延伸 90px 竖直入口门柱
    const gp2 = easeOutCubic(phase(t, 128.48, T1));
    c.line(ax, 0.22 * BASE_H + 248.0 * breath, ax,
           0.22 * BASE_H + 248.0 * breath + 90.0 * gp2, CYAN, 2.0, 1.0, 0.4);
    c.dot(ax, 0.84 * BASE_H, 5.0, ICE, 0.9, 0.6);
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px · 2400pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 10.0, strength: 0.38, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_137  `128.6600–130.0936` ｜ PARSING：14 数据包涌入，第 14 包错误红
   ══════════════════════════════════════════════════════════════ */
const SHOT_137 = {
  id: 'SHOT_137', start: 128.6600, end: 130.0936,
  seedHex: SEEDS.SHOT_137, chapter: CHAPTER, status: 'PARSING',
  lyric: 'You have made some / 你犯了某种',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_137';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const core = [0.50 * BASE_W, 0.82 * BASE_H];

    const bus = [[60.0, 0.28 * BASE_H], [0.50 * BASE_W, 0.28 * BASE_H],
                 [0.50 * BASE_W, 0.82 * BASE_H]];
    c.polyline(bus, GREY, 2.0, 0.7, 0.15);
    for (let k = 0; k < 3; k++) {
      const [px, py] = pathPoint(bus, 0.2 + 0.28 * k);
      c.circle(px, py, 6.0, CYAN, 1.5, 0.9, 0.0, 0.4);
    }
    c.line(0.50 * BASE_W, 0.22 * BASE_H + 248.0, 0.50 * BASE_W, 0.28 * BASE_H,
           CYAN, 2.0, 0.8, 0.3);
    c.dot(core[0], core[1], 5.0, ICE, 0.95, 0.7);
    for (let k = 0; k < 14; k++) {
      const st = k < 12 ? 129.02 + k * 0.07 : 129.60 + (k - 12) * 0.08;
      for (let rr = 1; rr < 4; rr++) {
        const pp = phase(t, st + rr * 0.05, st + rr * 0.05 + 0.4);
        if (pp > 0.0 && pp < 1.0) {
          c.circle(core[0], core[1], lerp(8.0, 44.0, easeOutQuad(pp)), CYAN, 1.0,
                   (1.0 - pp) * 0.4, 0.0, 0.2);
        }
      }
    }
    const f12 = font('JetBrains Mono', 12.0, c.ss);
    for (let k = 0; k < 14; k++) {
      let st;
      if (k < 3) st = T0 + k * 0.09;
      else if (k < 12) st = 129.02 + (k - 3) * 0.07;
      else st = 129.60 + (k - 12) * 0.08;
      const u = clamp01((t - st) / 0.30);
      if (u <= 0.0) continue;
      const [px, py] = pathPoint(bus, k < 3 ? easeOutQuad(u) : u);
      const col = k < 9 ? CYAN : (k < 13 ? BV : RED);
      let jit = 0.0;
      if (k >= 10 && k <= 13) jit = 4.0 * (steps(t, 3, st, st + 0.4) % 2 === 0 ? 1.0 : -1.0);
      const x0 = px - 44.0 + jit, y0 = py - 20.0;
      c.rect(x0, y0, x0 + 88.0, y0 + 40.0, col, 2.0, 1.0, 0.12, 0.4);
      for (let b = 0; b < 3; b++) {
        c.line(x0 + 8.0, y0 + 8.0 + b * 12.0,
               x0 + 80.0 - (k >= 10 ? b * 14.0 : 0.0), y0 + 8.0 + b * 12.0,
               col, 1.0, 0.6, 0.15);
      }
      const lab = k < 9 ? 'type:int' : (k < 13 ? 'type:?' : 'type:ERR');
      c.text(x0 + 92.0, y0 + 14.0, lab, f12, k >= 9 ? col : GREY, 0.85);
    }
    if (t >= 129.60 && t < 129.60 + 2.0 / 60.0) c.flash(RED, 0.08);
    const sk = phase(t, 129.60, 129.75);
    mainWord(c, t, 'You have made some', 'Inter Semi-Bold', 112, 0.05, blendc(ICE, RED, sk), {
      baseline: 0.78 * BASE_H, align: 'left', x: 0.10 * BASE_W, instant: true, glow: 0.45,
      perChar: (i, ch, tt) => ({
        a: easeOutCubic(phase(tt, T0 + 0.10 + i * 0.012, T0 + 0.10 + i * 0.012 + 0.12)),
      }),
    });
    if (t >= 129.92) {
      const ex = 0.50 * BASE_W + 60.0, ey = 0.76 * BASE_H;
      c.rect(ex - 20.0, ey - 8.0, ex + 20.0, ey + 8.0, RED, 2.0, 1.0, 0.0, 0.5);
      c.text(ex - 4.0, ey - 6.0, '?', f12, RED, 1.0, 0.5);
    }
    micro(c, 0.62 * BASE_W, 0.94 * BASE_H, 'in:14 · parse:64%', GREY, 16.0, 0.75);
    cornerInfo(c, sid, T0, blInfo(sid, 'in:14'), 'PARSING', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 4.0, strength: 0.30, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_138  `130.0936–131.2200` ｜ DECODE_FAIL：14 包碎解 + 1100 红粒子螺线汇入
   ══════════════════════════════════════════════════════════════ */
const SHOT_138 = {
  id: 'SHOT_138', start: 130.0936, end: 131.2200,
  seedHex: SEEDS.SHOT_138, chapter: CHAPTER, status: 'DECODE_FAIL',
  lyric: 'You have made some / 你犯了某种',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_138';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const bus = [[60.0, 0.28 * BASE_H], [0.50 * BASE_W, 0.28 * BASE_H],
                 [0.50 * BASE_W, 0.82 * BASE_H]];
    c.polyline(bus, GREY, 2.0, 0.5, 0.1);
    // ① 14 包边框碎为 4 段 40px 直角线段
    for (let k = 0; k < 14; k++) {
      const col = k < 9 ? CYAN : (k < 13 ? BV : RED);
      const u = clamp01((t - (T0 + k * 0.015)) / 0.21);
      const p = easeInCubic(u);
      const [px, py] = pathPoint(bus, 0.92);
      const cx0 = px, cy0 = py - 60.0 + k * 9.0;
      for (let s = 0; s < 4; s++) {
        const ang = rad(90.0 * s + 90.0 * p);
        const L = 40.0 * (1.0 - 0.4 * p);
        const sx0 = cx0 + Math.cos(ang) * L * 0.5;
        const sy0 = cy0 + Math.sin(ang) * L * 0.5;
        c.line(sx0 - Math.cos(ang) * L * 0.5, sy0 - Math.sin(ang) * L * 0.5,
               sx0 + Math.cos(ang) * L * 0.5, sy0 + Math.sin(ang) * L * 0.5,
               col, 2.0, 1.0 - 0.6 * p, 0.3);
      }
    }
    // ② 约 1100 颗粒子沿阿基米德螺线汇入中心
    const p = easeInOutQuad(phase(t, 130.30, 130.72));
    const bank = { r: [], c: [], b: [] };
    for (let i = 0; i < 1100; i++) {
      const r = new Rng(seedFromHex(seedHex), 'rp', i);
      const a0 = r.range(0, Math.PI * 2);
      const rr = r.range(80.0, 420.0);
      const th = a0 + 2.0 * Math.PI * (1.0 - p) * 1.2;
      const x1 = CX + Math.cos(th) * rr * (1.0 - 0.85 * p);
      const y1 = CY + Math.sin(th) * rr * (1.0 - 0.85 * p);
      const pt = [x1, y1];
      if (i < 300) bank.r.push(pt); else if (i < 700) bank.c.push(pt); else bank.b.push(pt);
    }
    const al = 0.85 * (1.0 - 0.3 * p);
    for (const [bankArr, bankCol] of [[bank.r, RED], [bank.c, CYAN], [bank.b, BV]]) {
      for (const pt of bankArr) c.dot(pt[0], pt[1], 1.6, bankCol, al, 0.35);
    }
    // ③ 错误窗 40×16 → 120×54，内显 E?
    const wp = easeOutCubic(phase(t, 130.72, 131.04));
    const ww = lerp(20.0, 60.0, wp), wh = lerp(8.0, 27.0, wp);
    const flash = steps(t, 2, 130.72, 131.04);
    c.rect(CX - ww, CY - wh, CX + ww, CY + wh, RED, 2.0,
           0.6 + 0.4 * (flash % 2 ? 0.5 : 1.0), 0.10, 0.6);
    const f24 = font('JetBrains Mono', 24.0, c.ss);
    c.text(CX - tw(c, f24, 'E?') * 0.5, CY - 14.0, 'E?', f24, RED, 1.0, 0.55);
    // ④ 3 扇阶梯次级空窗
    if (t >= 131.04) {
      for (let k = 0; k < 3; k++) {
        const ek = phase(t, 131.04 + k * 0.04, 131.04 + k * 0.04 + 0.10);
        if (ek <= 0.0) continue;
        const ox = CX + (k + 1) * 24.0, oy = CY + (k + 1) * 24.0;
        c.rect(ox - 40.0, oy - 18.0, ox + 40.0, oy + 18.0, RED, 1.0, 0.4 * ek, 0.2);
      }
    }
    // 主词 112px 采样 1200 点，some 组注入窗内
    const f = font('Inter Semi-Bold', 112, c.ss);
    const off = 1.0 + f.stroke;
    const asc = f.asc / c.ss;
    const oy = 0.78 * BASE_H - asc - off / c.ss;
    const pts = sampleText('You have made some', f, c.ss, 4.0,
                           0.10 * BASE_W - off / c.ss, oy, 1200);
    const kk = Math.trunc(1200 * (14 / 21.0));
    const p2 = easeInOutQuad(phase(t, 130.30, 130.72));
    const icePts = [], redPts = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      let tx, ty;
      if (i >= kk) { tx = CX; ty = CY; }
      else { tx = x; ty = y - 220.0 * clamp01((t - 130.09) / 0.94); }
      const a = 1.0 - phase(t, 130.30, 130.72);
      if (a <= 0.01) continue;
      const q = [lerp(x, tx, p2), lerp(y, ty, p2)];
      if (i >= kk) redPts.push(q); else icePts.push(q);
    }
    c.dots ? null : null;
    for (const pt of icePts) c.dot(pt[0], pt[1], 1.6, ICE, 0.9, 0.3);
    for (const pt of redPts) c.dot(pt[0], pt[1], 1.6, RED, 0.9, 0.3);    micro(c, 0.10 * BASE_W, 0.94 * BASE_H, 'parse:0%', GREY, 16.0,
          0.75 * (1.0 - phase(t, 130.72, 130.90)));
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px · 1200pt'), 'DECODE_FAIL', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 12.0, strength: 0.55, grainPct: 6.0, scan: 0.0 });
  },
};

/* ── SHOT_139 的错误窗文本与版式 ─────────────────────────────── */
const ERR_LINES = [
  'type mismatch: love(You, Me)',
  "cannot convert 'memory' to 'bool'",
  "unexpected token: 'maybe'",
  "argument 2 of 'erase' is undefined",
];
const ERR_TOK = ['love', 'memory', 'maybe', 'erase', 'undefined', 'bool', 'type'];

/** 一扇错误窗：红标题栏 + 冰白关闭叉 + 2–4 行 16px 等宽文本 */
function errWindow(c, t, k, x, y, w, h, seedHex, alpha = 1.0) {
  const bar = 22.0;
  c.rect(x, y, x + w, y + h, RED, 2.0, alpha, 0.0);
  c.rect(x, y, x + w, y + bar, RED, 0.0, 1.0, 0.9 * alpha);
  const ex = x + w - 14.0;
  c.line(ex - 5.0, y + 6.0, ex + 5.0, y + 16.0, ICE, 2.0, alpha, 0.4);
  c.line(ex - 5.0, y + 16.0, ex + 5.0, y + 6.0, ICE, 2.0, alpha, 0.4);
  const r0 = new Rng(seedFromHex(seedHex), `win${k}`, 0);
  const nl = 2 + Math.trunc(r0.next() * 3.0);
  const stepn = Math.trunc((t - 131.22) / 0.180);
  const f16 = font('JetBrains Mono', 16.0, c.ss);
  for (let li = 0; li < nl; li++) {
    const line = ERR_LINES[(k + li) % ERR_LINES.length];
    const rr = new Rng(seedFromHex(seedHex), `line${k}_${li}`, stepn);
    const sh = rr.range(-40.0, 60.0);
    const yy = y + bar + 6.0 + li * 18.0;
    if (yy + 16.0 > y + h) break;
    const tok = ERR_TOK[(k + li) % ERR_TOK.length];
    const rev = steps(t, 6, 131.22 + (k % 5) * 0.09, 140.0) % 2 === 0;
    const cut = line.split(tok);
    let xx = x + 10.0 + sh;
    c.text(xx, yy, cut[0], f16, ICE, 0.7 * alpha);
    xx += tw(c, f16, cut[0]);
    c.text(xx, yy, tok, f16, rev ? ICE : RED, 0.9 * alpha);
    xx += tw(c, f16, tok);
    if (cut.length > 1) c.text(xx, yy, cut[1], f16, ICE, 0.7 * alpha);
  }
}

/** 窗 k 的落位与尺寸：8 站主对角线 × 每站 5–6 扇阶梯偏移 */
function winRect(k) {
  const st = k / 5.25;
  const si = Math.trunc(st);
  const step = k - si * 5.25;
  const bx = lerp(0.08, 0.92, si / 7.0) * BASE_W;
  const by = lerp(0.12, 0.88, si / 7.0) * BASE_H;
  const w = lerp(320.0, 180.0, k / 41.0);
  const h = lerp(120.0, 70.0, k / 41.0);
  if (k % 2 === 0) return [bx + step * 38.0 - 20.0, by + step * 26.0 - 10.0, w, h];
  return [bx + step * 38.0 - 20.0, by - step * 26.0 - h + 10.0, w, h];
}

/** ILLEGAL ARGUMENTS 专用：逐字符 ±jitter 纵向错位 + 2px 冰白内描边 */
function illegalWord(c, t, text, px, trk, baseline, opts = {}) {
  const { color = RED, jitterAmp = 3.0, jitterStep = 0.36, glow = 0.85 } = opts;
  const f = font('Inter Bold', px, c.ss);
  const { cells, total } = cellsOf(f, text, px, trk, c.ss);
  const limit = BASE_W - 2.0 * 96.0;
  const sx = total > limit ? Math.min(1.0, limit / total) : 1.0;
  if (sx < 0.999) {
    c.note(`主词 ${text} ${Math.round(px)}px 实测 ${Math.round(total)}px > ${limit}px（06 L18 单行上限），横向压缩 ×${sx.toFixed(3)}`);
  }
  const asc = f.asc / c.ss;
  const yTop = baseline - asc;
  for (let i = 0; i < cells.length; i++) {
    const [ch, xo, adv] = cells[i];
    const kk = Math.trunc((t - 131.22) / jitterStep);
    const r = new Rng(seedFromHex(SEEDS.SHOT_139), `jit${i}`, kk);
    const dy = r.range(-jitterAmp, jitterAmp);
    const gx = 0.04 * BASE_W + xo * sx;
    const gy = yTop + dy;
    // 冰白外描边层（用 stroke 模拟）
    c.text(gx, gy, ch, f, ICE, 1.0, glow * 0.5, 2);
    // 红芯（内描边效果：直接叠红字）
    c.text(gx, gy, ch, f, color, 1.0, glow, 0);  }
}

/* ══════════════════════════════════════════════════════════════
   SHOT_139  `131.2200–140.4264` ｜ ERR（9.21s 长镜）：42 扇错误窗级联铺满
   ══════════════════════════════════════════════════════════════ */
const SHOT_139 = {
  id: 'SHOT_139', start: 131.2200, end: 140.4264,
  seedHex: SEEDS.SHOT_139, chapter: CHAPTER, status: 'ERR',
  lyric: 'ILLEGAL ARGUMENTS / 非法参数',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    this._b.of('SHOT_139', [this.start, this.end]);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_139';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const bs = this._b.of(sid, [T0, this.end]);

    // 级联扇数：节拍驱动
    let beatCount = 0;
    for (const b of bs) if (b <= t) beatCount += 1;
    let n = 4 + 2 * beatCount;
    if (t >= 133.20) n = Math.max(n, 20 + Math.trunc((t - 133.20) / 0.18));
    if (t >= 136.00) n = 42;
    n = Math.max(1, Math.min(42, n));
    // 漂移
    const drift = 12.0 * clamp01((t - 136.00) / 8.0);
    const sleep = steps(t, 2, 136.00, 139.00);
    for (let k = 0; k < n; k++) {
      let [x, y, w, h] = winRect(k);
      x += drift * (0.5 + 0.5 * ((k % 3) / 2.0));
      y += drift * (0.4 + 0.3 * (k % 2));
      let al = 1.0;
      if (t >= 140.30) al = 0.92;
      if (k < 6 && t >= 136.00 && sleep % 2 === 0) al = 0.55;
      errWindow(c, t, k, x, y, w, h, seedHex, al);
    }
    // 主词 260px 红字
    illegalWord(c, t, 'ILLEGAL ARGUMENTS', 260.0, 0.12, 0.54 * BASE_H);
    // 微信息
    const f18 = font('JetBrains Mono', 18.0, c.ss);
    c.text(BASE_W - 26.0 - tw(c, f18, 'ERR:42 · stack:deep'), BASE_H - 26.0 - 18.0,
           'ERR:42 · stack:deep', f18, RED, 0.95);
    cornerInfo(c, sid, T0, blInfo(sid, 'stack:42'), 'ERR', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 12.0, strength: 0.60, grainPct: 7.0, scan: 0.08 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_140  `140.4264–147.6600` ｜ CRITICAL（7.23s 长镜）：窗堆压缩→震颤→碎解→归一
   ══════════════════════════════════════════════════════════════ */
const SHOT_140 = {
  id: 'SHOT_140', start: 140.4264, end: 147.6600,
  seedHex: SEEDS.SHOT_140, chapter: CHAPTER, status: 'CRITICAL',
  lyric: 'ILLEGAL ARGUMENTS / 非法参数',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_140';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];

    // ① 压缩：向中心迁移 22% + 2.2s 低频呼吸
    const cp = easeInOutCubic(phase(t, T0, 142.60));
    let tremble = 0.0;
    if (t >= 142.60 && t < 144.80) {
      tremble = 3.0 * (steps(t, 2, 142.60, 144.80) % 2 === 0 ? 1.0 : -1.0);
    }
    const n = 42;
    for (let k = 0; k < n; k++) {
      let [x, y, w, h] = winRect(k);
      x = lerp(x, CX - w * 0.5, 0.22 * cp) + tremble;
      y = lerp(y, CY - h * 0.5, 0.22 * cp) - tremble * 0.5;
      const al = 1.0 - 0.45 * clamp01((k - 30) / 12.0);
      if (t >= 144.80) {
        const segP = phase(t, 144.80 + k * 0.06, 144.80 + k * 0.06 + 0.30);
        if (segP > 0.0) {
          // 标题栏碎裂为线段
          for (let b = 0; b < 4; b++) {
            const bx0 = x + b * (w / 4.0);
            const bx1 = bx0 + (w / 4.0) * (1.0 - 0.72 * segP);
            c.line(bx0, y + 6.0 + 8.0 * segP, bx1, y + 6.0 + 8.0 * segP,
                   RED, 3.0, al * (1.0 - segP * 0.6), 0.3);
          }
          // 窗框线段化
          for (let s = 0; s < 4; s++) {
            const ang = rad(90.0 * s + 90.0 * segP);
            const L = 40.0 * (1.0 - 0.4 * segP);
            const sx0 = x + w * 0.5 + Math.cos(ang) * L * 0.5;
            const sy0 = y + h * 0.5 + Math.sin(ang) * L * 0.5;
            c.line(sx0 - Math.cos(ang) * L * 0.5, sy0 - Math.sin(ang) * L * 0.5,
                   sx0 + Math.cos(ang) * L * 0.5, sy0 + Math.sin(ang) * L * 0.5,
                   RED, 2.0, al * (1.0 - segP * 0.7), 0.3);
          }
        } else {
          errWindow(c, t, k, x, y, w, h, seedHex, al);
        }
      } else {
        errWindow(c, t, k, x, y, w, h, seedHex, al);
      }
    }
    // ② 过载状态行 3 行 20px
    const f20 = font('JetBrains Mono', 20.0, c.ss);
    const STATUS = ['heap:overflow', 'stack:collapsed', 'return:NULL'];
    for (let li = 0; li < 3; li++) {
      const st = 140.43 + li * 0.4;
      if (t < st) continue;
      let on = 1.0;
      if (li === 1) on = 0.5 + 0.5 * (steps(t, 8, 142.60, 143.20) % 2 === 0 ? 1.0 : 0.0);
      if (li === 2 && t >= 147.50) on = Math.max(0.0, 1.0 - phase(t, 147.50, 147.60));
      if (on > 0.01) {
        c.text(CX - tw(c, f20, STATUS[li]) * 0.5, CY - 120.0 + li * 28.0,
               STATUS[li], f20, RED, on, 0.4);
      }
    }
    // ③ 1800 颗粒子绕中心涡旋收缩
    const p2 = easeInOutQuad(phase(t, 144.80, 146.90));
    for (let i = 0; i < 1800; i++) {
      const r = new Rng(seedFromHex(seedHex), 'p', i);
      const col = i < 1080 ? RED : (i < 1584 ? GREY : ICE);
      const a0 = r.range(0, Math.PI * 2);
      const rr = r.range(60.0, 500.0);
      const th = a0 + 2.0 * Math.PI * (1.0 - p2) * 1.4;
      c.dot(CX + Math.cos(th) * rr * (1.0 - 0.9 * p2),
            CY + Math.sin(th) * rr * (1.0 - 0.9 * p2), 2.0, col,
            0.85 * (1.0 - 0.25 * p2), 0.3);
    }
    // ④ 主词 146px（145.20 起采样入涡）
    if (t < 145.20) {
      const amp = t < 142.60 ? 3.0 : 7.0;
      illegalWord(c, t, 'ILLEGAL ARGUMENTS', 146.0, 0.12, 0.54 * BASE_H,
                  { jitterAmp: amp, jitterStep: 0.18, glow: 0.8 });
    } else {
      const f = font('Inter Bold', 146, c.ss);
      const off = 1.0 + f.stroke;
      const asc = f.asc / c.ss;
      const pts = sampleText('ILLEGAL ARGUMENTS', f, c.ss, 4.0,
                             0.04 * BASE_W - off / c.ss,
                             0.54 * BASE_H - asc - off / c.ss, 3600);
      const pp = easeInOutQuad(phase(t, 145.20, 146.60));
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i];
        const th = Math.atan2(y - CY, x - CX) + 2.0 * Math.PI * 0.6 * (1.0 - pp);
        const rr = Math.hypot(x - CX, y - CY) * (1.0 - 0.88 * pp);
        c.dot(CX + Math.cos(th) * rr, CY + Math.sin(th) * rr, 1.6,
              i % 5 ? RED : ICE, 0.9 * (1.0 - 0.3 * pp), 0.3);
      }
    }
    // ⑤ 归一：红光标 + 空心框 + 幽灵全词
    if (t >= 147.40 && t < 147.40 + 2.0 / 60.0) {
      illegalWord(c, t, 'ILLEGAL ARGUMENTS', 146.0, 0.12, 0.54 * BASE_H,
                  { jitterAmp: 0.0, glow: 0.0 });
    }
    if (t >= 146.90) {
      const box = lerp(20.0, 32.0, phase(t, 147.60, T1));
      c.rect(CX - box * 0.5, CY - box * 0.5, CX + box * 0.5, CY + box * 0.5,
             RED, 2.0, 0.5, 0.0, 0.4);
      let on = true;
      if (t < 147.58) on = (steps(t, 2, 146.90, 147.14) % 2 === 0) || t > 147.14;
      cursor(c, CX, CY, { w: 14.0, h: 28.0, color: RED, on, glow: 0.65 });
      const f16 = font('JetBrains Mono', 16.0, c.ss);
      c.text(CX + 26.0, CY - 8.0, 'ready:', f16, GREY, 0.75);
    }
    // 尾帧交接 CH08：未注入红残片散布光标四周
    for (let i = 0; i < (t >= 147.20 ? 10 : 0); i++) {
      const r = new Rng(seedFromHex(seedHex), 'leftover', i);
      const ang = r.range(0, Math.PI * 2);
      const rr = r.range(20.0, 60.0);
      c.rect(CX + Math.cos(ang) * rr - 5.0, CY + Math.sin(ang) * rr - 4.0,
             CX + Math.cos(ang) * rr + 5.0, CY + Math.sin(ang) * rr + 4.0,
             RED, 1.0, 0.7, 0.0, 0.25);
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'heap:overflow'), 'CRITICAL', 0.6, CHAPTER);
    return c.flush(t, seedHex, {
      radius: 10.0, strength: 0.65 * (1.0 - phase(t, 146.60, T1)),
      grainPct: 6.0, scan: 0.04 * (1.0 - phase(t, 144.80, 146.90)),
    });
  },
};

export const CH07_SHOTS = [SHOT_127, SHOT_128, SHOT_129, SHOT_130, SHOT_131,
                           SHOT_132, SHOT_133, SHOT_134, SHOT_135, SHOT_136,
                           SHOT_137, SHOT_138, SHOT_139, SHOT_140];
export { beatStore as CH07_BEATS };
