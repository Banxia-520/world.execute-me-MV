/**
 * ch09.js — 第 09 章 RETURN / EXEC（镜头 160–175）
 *
 * 自 Python 版 render/scenes/ch09_return.py 移植。
 * 本章与 ch07/ch08 的 helper 同构（`Canvas` 上下文 + 同一套排版/蒙版/节拍工具），
 * 公共中间层直接复用 canvas.js；章内专有 helper 在本文件。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix,
  easeOutCubic, easeInCubic, easeOutExpo, rad, easeInQuad, easeInOutQuad,
} from './core.js';
import * as P from './primitives.js';
import { Canvas, fontOf } from './kit.js';
import {
  font, tw, cellsOf, sampleText, mixc, dimc, blendc,
  easeInExpo, easeOutSine, easeInOutSine, easeInOutCubic, easeOutQuad,
  easeOutQuart, easeInQuart, easeOutQuint, easeInQuint, easeInOutQuint,
  easeOutBack, mainWord, statusLine, cursor, mono, micro, blinkOn,
  cornerInfo, makeBeatStore, maskBand,
} from './canvas.js';

const CHAPTER = 'ch09/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_SEMI = 'Inter Semi-Bold';
/** 画布中心（取 Python 真值） */
const CX = BASE_W * 0.5;
const CY = BASE_H * 0.5;
/** 逻辑树几何（取 Python 真值） */
const TREE_ROOT = [0.08 * BASE_W, 0.84 * BASE_H];
const TREE_TIP = [0.72 * BASE_W, 0.26 * BASE_H];
/** 163/167/171 等宽主词（06【文字排版】） */
const EXEC_PX = 271.0;

// 种子与题旨取自 Python 源码的 SEEDS / MOTIF（**不可自造**）
const SEEDS = {
  SHOT_160: '0000160A', SHOT_161: '0000161B', SHOT_162: '0000162C',
  SHOT_163: '0000163D', SHOT_164: '0000164E', SHOT_165: '0000165F',
  SHOT_166: '7C963A4E', SHOT_167: '10BAC553', SHOT_168: '0000168A',
  SHOT_169: '0000169B', SHOT_170: '0000170C', SHOT_171: '0000171D',
  SHOT_172: '0000172E', SHOT_173: '0000173F', SHOT_174: 'B99793C5',
  SHOT_175: 'C2C5ECE9',
};
const MOTIF = {
  SHOT_160: 'COND', SHOT_161: 'BCAST', SHOT_162: 'MORPH', SHOT_163: 'EXEC',
  SHOT_164: 'TRUE', SHOT_165: 'PATH', SHOT_166: 'MORPH', SHOT_167: 'EXEC',
  SHOT_168: 'RETURN', SHOT_169: 'MORPH', SHOT_170: 'RUN', SHOT_171: 'EXEC',
  SHOT_172: 'TRAP', SHOT_173: 'ECHO', SHOT_174: 'ECHO', SHOT_175: 'MORPH',
};

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
/** if 逻辑树：自根部沿 45° 向右上生长，depth 层二分 → 2^depth 末端节点 */
function binaryTree(depth = 4) {
  const [x0, y0] = TREE_ROOT;
  const [x1, y1] = TREE_TIP;
  const segs = [];
  let nodes = [[x0, y0, null]];
  for (let d = 0; d < depth; d++) {
    const nxt = [];
    for (const [bx, by] of nodes) {
      const u = (d + 1) / depth;
      const tx = lerp(x0, x1, u), ty = lerp(y0, y1, u);
      for (const s of [-1.0, 1.0]) {
        const ang = rad(-45.0 + s * 26.0);
        const L = 210.0 / (1.35 ** d);
        const nx = lerp(bx + Math.cos(ang) * L, tx, 0.55);
        const ny = lerp(by + Math.sin(ang) * L, ty, 0.55);
        segs.push([[bx, by], [nx, ny], d]);
        nxt.push([nx, ny, d]);
      }
    }
    nodes = nxt;
  }
  return { segs, leaves: nodes };
}

let TREE_CACHE = null;
function treeCached() {
  if (!TREE_CACHE) TREE_CACHE = binaryTree(4);
  return TREE_CACHE;
}

/** EXECUTION 等宽点阵轮廓（06：点间距 4px、等宽字形骨架） */
function dotmatrixTarget(px, trk = 0.12, hCenter = 0.48, step = 4.0) {
  const f = font('JetBrains Mono ExtraBold', px, 1);
  const off = 1.0 + f.stroke;
  const wb = f.getlength('EXECUTION') + trk * px * ('EXECUTION'.length - 1) + off * 2;
  const hb = f.asc + f.desc + off * 2;
  const ox = CX - wb * 0.5;
  const oy = hCenter * BASE_H - hb * 0.5;
  const pts = sampleText('EXECUTION', f, 1, step, ox - off, oy - off, 0, 1);
  return { pts, ox, oy, wb, hb };
}

/** 描边预览字（先铺满字形，再用底色挖空 → 只留轮廓） */
function outlineText(c, x, yTop, text, f, color, a, trkEm = 0.0, px = 0.0) {
  const size = px || f.px;
  // 先画满字形
  c.pasteTextMask(text, x, yTop, f.font, f.asc / c.ss, f.stroke, color, a, 0);
  // 再用底色内缩挖空 → 只留轮廓
  c.pasteTextMask(text, x + 0.5, yTop + 0.5, f.font, f.asc / c.ss, f.stroke,
                  BG_DEEP, 0.88, 3.0 * c.ss);
  return f.getlength(text);
}

/** 整行文字（带字距），返回宽度 */
function lineOfText(c, text, weight, px, trkEm, x, baseline, color, a = 1.0, glow = 0.35) {
  const f = font(weight, px, c.ss);
  const asc = f.asc / c.ss;
  c.text(x, baseline - asc, text, f, color, a, glow);
  return tw(c, f, text);
}

/* ══════════════════════════════════════════════════════════════
   SHOT_160  `162.6300–163.3100` ｜ COND：光标为根，if 逻辑树 45° 右上生长
   ══════════════════════════════════════════════════════════════ */
const SHOT_160 = {
  id: 'SHOT_160', start: 162.6300, end: 163.3100,
  seedHex: SEEDS.SHOT_160, chapter: CHAPTER, status: 'COND',
  lyric: 'If I can / 如果我能',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_160';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    // IN：2px 青光标落在 (18%,62%)，steps(2) 闪 2 次
    const cur = [0.18 * BASE_W, 0.62 * BASE_H];
    cursor(c, cur[0], cur[1], { w: 14.0, h: 28.0, color: CYAN,
      on: (steps(t, 2, T0, T0 + 2.0 / 60.0) % 2 === 0 || t > T0 + 2.0 / 60.0), glow: 0.6 });
    // 根部 if ( 以 steps(4) 每步 40ms 打出
    const f42 = font('JetBrains Mono', 42.0, c.ss);
    const nif = steps(t, 4, T0, T0 + 0.16);
    c.text(cur[0] + 14.0, cur[1] - 24.0, 'if ('.slice(0, Math.max(0, nif)), f42, CYAN, 1.0, 0.5);
    // 主干 + 4 层二分枝（25ms 错峰）
    const { segs, leaves } = treeCached();
    const gp = easeOutExpo(phase(t, T0 + 0.16, T0 + 0.50));
    const tx = lerp(TREE_ROOT[0], TREE_TIP[0], gp);
    const ty = lerp(TREE_ROOT[1], TREE_TIP[1], gp);
    c.line(TREE_ROOT[0], TREE_ROOT[1], tx, ty, CYAN, 2.0, 1.0, 0.45);
    for (let k = 0; k < segs.length; k++) {
      const a0 = segs[k][0], b0 = segs[k][1], d = segs[k][2];
      const p = easeOutCubic(phase(t, T0 + 0.16 + d * 0.06 + k * 0.025,
                                   T0 + 0.16 + d * 0.06 + k * 0.025 + 0.12));
      if (p <= 0.0) continue;
      if (a0[1] < ty - 4.0) continue;
      c.line(a0[0], a0[1], lerp(a0[0], b0[0], p), lerp(a0[1], b0[1], p), CYAN, 1.5, 0.7, 0.3);
    }
    // 16 枚末端节点 + 各 2 条测量短线
    for (let k = 0; k < leaves.length; k++) {
      const nx = leaves[k][0], ny = leaves[k][1];
      const st = T0 + 0.46 + k * 0.01;
      const pp = phase(t, st, st + 0.07);
      if (pp <= 0.0) continue;
      const sc = 1.0 + 0.6 * Math.sin(Math.PI * pp);
      c.dot(nx, ny, 4.0 * sc, BV, 0.95, 0.5);
      if (t >= T0 + 0.58) {
        for (const s of [-1.0, 1.0]) c.line(nx, ny, nx + s * 6.0, ny, GREY, 1.0, 0.4);
      }
    }
    // 生长前沿亮点 + 12px 拖尾
    c.dot(tx, ty, 5.0, ICE, 0.95, 0.7);
    c.line(tx - 12.0 * 0.7, ty + 12.0 * 0.7, tx, ty, CYAN, 2.0, 0.5, 0.4);
    // 主词 If I can 176px 上扬 8°
    const f176 = font('Inter Semi-Bold', 176, c.ss);
    const { cells } = cellsOf(f176, 'If I can', 176.0, 0.05, c.ss);
    const lift = Math.tan(rad(8.0));
    const res = mainWord(c, t, 'If I can', 'Inter Semi-Bold', 176, 0.05, ICE, {
      baseline: 0.46 * BASE_H, align: 'left', x: 0.10 * BASE_W,
      instant: true, glow: 0.45,
      perChar: (i, ch, tt) => {
        const xo = i < cells.length ? cells[i][1] : 0.0;
        const st = T0 + i * 0.016;
        return { dy: -lift * xo, a: easeOutCubic(phase(tt, st, st + 0.12)) };
      },
    });
    // If 为 #35D9E8（覆写前两字符）
    for (const i of [0, 1]) {
      if (i < cells.length) {
        const xo = res.x0 + cells[i][1] * res.sx;
        const a = easeOutCubic(phase(t, T0 + i * 0.016, T0 + i * 0.016 + 0.12));
        c.glyph(cells[i][0], xo, res.y_top - lift * cells[i][1], f176, CYAN, a, 1.0, 1.0, 0.45);
      }
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'depth:4'), 'COND', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.30, grainPct: 4.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_161  `163.3100–164.3516` ｜ BCAST：512 节点阵列 + 权限波前弧 + 300 电流粒子
   ══════════════════════════════════════════════════════════════ */
const SHOT_161 = {
  id: 'SHOT_161', start: 163.3100, end: 164.3516,
  seedHex: SEEDS.SHOT_161, chapter: CHAPTER, status: 'BCAST',
  lyric: 'If I can give them all the / 如果我能给他们所有',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_161';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const org = [0.08 * BASE_W, 0.84 * BASE_H];
    const NC = 32, NR = 16;
    const x0 = 0.07 * BASE_W, x1 = 0.93 * BASE_W;
    const y0 = 0.19 * BASE_H, y1 = 0.81 * BASE_H;
    // ① 阵列骨架 + 8 条扇形导线
    const wp = easeOutExpo(phase(t, T0, T0 + 0.19));
    for (let k = 0; k < 8; k++) {
      const ang = rad(-90.0 + 12.0 * k);
      c.line(org[0], org[1], org[0] + Math.cos(ang) * 700.0 * wp,
             org[1] + Math.sin(ang) * 700.0 * wp, BV, 1.5, 0.8 * wp, 0.2);
    }
    // ② 波前弧 + 512 节点按距离 1ms/点延迟标记
    const fw = easeOutQuad(phase(t, 163.50, 164.05));
    const R = 2400.0 * fw;
    c.arc(org[0], org[1], R, -90, 0, CYAN, 1.5, 0.9, 0.5);
    c.arc(org[0], org[1], Math.max(4.0, R - 24.0), -90, 0, CYAN, 1.0, 0.35, 0.3);
    const markedPts = [], unmarkedPts = [];
    for (let j = 0; j < NR; j++) {
      for (let i = 0; i < NC; i++) {
        const px = lerp(x0, x1, i / (NC - 1.0)), py = lerp(y0, y1, j / (NR - 1.0));
        const dist = Math.hypot(px - org[0], py - org[1]);
        if (t >= 163.50 + dist * 0.001) markedPts.push([px, py]);
        else unmarkedPts.push([px, py]);
      }
    }
    for (const pt of markedPts) c.dot(pt[0], pt[1], 3.0, CYAN, 0.95, 0.45);
    for (const pt of unmarkedPts) c.dot(pt[0], pt[1], 3.0, GREY, 0.6, 0.0);
    // ③ 300 颗 2px 冰白电流粒子沿节点间最短路径迁移（拖尾 10px）
    for (let k = 0; k < 300; k++) {
      const r = new Rng(seedFromHex(seedHex), 'cur', k);
      const u = clamp01((t - 163.50 - k * 0.002) / 0.55);
      if (u <= 0.0) continue;
      const i0 = r.range(0, NC - 1), j0 = r.range(0, NR - 1);
      const px = lerp(x0, x1, i0 / (NC - 1.0)) + ((x1 - x0) / (NC - 1.0)) * u * 6.0;
      const py = lerp(y0, y1, j0 / (NR - 1.0));
      c.line(px - 10.0, py, px, py, ICE, 2.0, (1.0 - u) * 0.9, 0.4);
    }
    // ④ 主词 136px（all the 主青）
    const f136 = font('Inter Semi-Bold', 136, c.ss);
    const { cells } = cellsOf(f136, 'If I can give them all the', 136.0, 0.03, c.ss);
    const npre = 'If I can give them '.length;
    mainWord(c, t, 'If I can give them all the', 'Inter Semi-Bold', 136, 0.03, ICE, {
      baseline: 0.13 * BASE_H, align: 'left', x: 0.08 * BASE_W,
      tIn: 164.05, stagger: 0.016, rise: 6.0, glow: 0.4,
    });
    for (let i = npre; i < cells.length; i++) {
      const xo = 0.08 * BASE_W + cells[i][1];
      const a = easeOutCubic(phase(t, 164.05 + i * 0.016, 164.05 + i * 0.016 + 0.14));
      c.glyph(cells[i][0], xo, 0.13 * BASE_H - f136.asc / c.ss, f136, CYAN, a, 1.0, 1.0, 0.4);
    }
    if (t >= 164.05) {
      statusLine(c, t, 'broadcast:512', 0.07 * BASE_W, 0.87 * BASE_H, BV,
                 { px: 46.0, align: 'left', typed: [164.05, 1.0 / 0.03], glow: 0.4 });
    }
    if (t >= 164.24) c.flash(ICE, 0.10 * (1.0 - phase(t, 164.24, 164.35)));
    cornerInfo(c, sid, T0, blInfo(sid, 'nodes:512'), 'BCAST', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.40, grainPct: 5.0, scan: 0.03 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_162  `164.3516–165.1700` ｜ MORPH：512 阵列与主词粒子化 → EXECUTION 点阵轮廓
   ══════════════════════════════════════════════════════════════ */
const SHOT_162 = {
  id: 'SHOT_162', start: 164.3516, end: 165.1700,
  seedHex: SEEDS.SHOT_162, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I can give them all the / 如果我能给他们所有',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_162';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    // 采样网格 4×2 闪现
    if (t < T0 + 2.0 / 60.0) {
      for (let i = 0; i < 5; i++) {
        const x = 0.08 * BASE_W + (i * (0.84 * BASE_W)) / 4.0;
        c.line(x, 0.14 * BASE_H, x, 0.86 * BASE_H, GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 3; j++) {
        const y = 0.14 * BASE_H + (j * (0.72 * BASE_H)) / 2.0;
        c.line(0.08 * BASE_W, y, 0.92 * BASE_W, y, GREY, 1.0, 0.30);
      }
    }
    const tgt = dotmatrixTarget(205.0, 0.12, 0.48, 4.0);
    const tp = tgt.pts, twb = tgt.wb;
    // 源粒子：512 阵列 + 主词采样 + 300 电流粒子
    const src = [];
    const NC = 32, NR = 16;
    for (let j = 0; j < NR; j++) {
      for (let i = 0; i < NC; i++) {
        src.push([lerp(0.07 * BASE_W, 0.93 * BASE_W, i / (NC - 1.0)),
                  lerp(0.19 * BASE_H, 0.81 * BASE_H, j / (NR - 1.0)), CYAN]);
      }
    }
    const f136 = font('Inter Semi-Bold', 144, c.ss);
    const off = 1.0 + f136.stroke;
    const asc = f136.asc / c.ss;
    const wpPts = sampleText('If I can give them all the', f136, c.ss, 4.0,
                             0.08 * BASE_W - off / c.ss,
                             0.13 * BASE_H - asc - off / c.ss, 2600);
    for (const [x, y] of wpPts) src.push([x, y, ICE]);
    const p = easeInOutCubic(phase(t, 164.55, 164.92));
    for (let k = 0; k < src.length; k++) {
      if (k >= tp.length) break;
      const [sx_, sy_, col] = src[k];
      const txx = tp[Math.trunc((k * tp.length) / Math.max(1, src.length))][0];
      const tyy = tp[Math.trunc((k * tp.length) / Math.max(1, src.length))][1];
      const px_ = lerp(sx_, txx, p);
      const py_ = lerp(sy_, tyy, easeInOutCubic(clamp01(p * 1.35)));
      c.dot(px_, py_, 2.0, col, 0.55 + 0.35 * p, 0.35);
    }
    // 轮廓预览 2 帧 + 外圈 380 点二次散开
    if (t >= 164.92) {
      const sc = easeInQuad(phase(t, 165.08, T1));
      for (let k = 0; k < Math.min(380, tp.length); k++) {
        const x = tp[k][0], y = tp[k][1];
        const ang = Math.atan2(y - CY, x - CX);
        c.dot(x + Math.cos(ang) * 120.0 * sc, y + Math.sin(ang) * 120.0 * sc, 2.0,
              BV, 0.8 * (1.0 - sc * 0.6), 0.3);
      }
    }
    if (t >= 164.92 && t < 164.92 + 2.0 / 60.0) c.flash(ICE, 0.06);
    cursor(c, CX + twb * 0.5, CY, { w: 2.0, h: 28.0, color: CYAN,
                                    on: blinkOn(t, 0.53, T0), glow: 0.5 });
    statusLine(c, t, 'broadcast:512', 0.08 * BASE_W, 0.87 * BASE_H, BV,
               { px: 46.0, align: 'left', a: 1.0 - phase(t, T0, T0 + 0.10), glow: 0.3 });
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px/2600pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 9.0, strength: 0.45, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_163  `165.1700–166.0200` ｜ EXEC：等宽 ExtraBold 巨标题 + 状态行 + 扫描轨
   ══════════════════════════════════════════════════════════════ */
const SHOT_163 = {
  id: 'SHOT_163', start: 165.1700, end: 166.0200,
  seedHex: SEEDS.SHOT_163, chapter: CHAPTER, status: 'EXEC',
  lyric: 'EXECUTION / 执行',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_163';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const fill = steps(t, 3, T0, T0 + 0.13);
    const col = [BV, BV, ICE][Math.min(2, fill)];
    const erase = phase(t, 165.58, 165.88);
    mainWord(c, t, 'EXECUTION', 'JetBrains Mono ExtraBold', EXEC_PX, 0.14, col, {
      baseline: 0.46 * BASE_H, align: 'center', instant: true, glow: 0.5,
      sxOverride: t < T0 + 0.13 ? null : 1.0,
      perChar: (i, ch, tt) => {
        if (erase <= 0) return { a: 1.0, dy: 0.0 };
        const e = clamp01((erase - (8 - i) * 0.012) / 0.35);
        return { a: 1.0 - e, dy: 26.0 * easeInQuad(e) };
      },
    });
    c.note('SHOT_163 主词 EXECUTION 271px（等宽 ExtraBold）实测约 1766px > 1728px，按 06 L18 横向压缩');
    // 状态行 + 光标
    statusLine(c, t, '> execution --granted', 0.19 * BASE_W, 0.58 * BASE_H, CYAN,
               { px: 42.0, align: 'left', typed: [165.30, 1.0 / 0.02], glow: 0.45 });
    cursor(c, 0.19 * BASE_W + 470.0, 0.58 * BASE_H - 14.0, {
      w: 2.0, h: 28.0, color: CYAN,
      on: (t < 165.58 || blinkOn(t, 0.53, T0)), glow: 0.5 });
    // 输入下划线 + 左端方点
    c.line(0.19 * BASE_W, 0.64 * BASE_H, 0.19 * BASE_W + 470.0, 0.64 * BASE_H, GREY, 1.5, 0.30);
    c.rect(0.19 * BASE_W - 3.0, 0.64 * BASE_H - 3.0,
           0.19 * BASE_W + 3.0, 0.64 * BASE_H + 3.0, GREY, 0.0, 1.0, 0.9);
    // 3 条极淡扫描轨
    for (let k = 0; k < 3; k++) {
      c.line(CX - 0.27 * BASE_W, (0.70 + 0.04 * k) * BASE_H,
             CX + 0.27 * BASE_W, (0.70 + 0.04 * k) * BASE_H, GREY, 1.0, 0.20);
    }
    // 阶段 4：收束为 2px 光标（状态行余烬 12 颗）
    if (t >= 165.88) {
      cursor(c, CX, CY, { w: 2.0, h: 28.0, color: CYAN,
                          on: steps(t, 2, 165.88, 166.02) % 2 === 0, glow: 0.5 });
      for (let k = 0; k < 12; k++) {
        const r = new Rng(seedFromHex(seedHex), 'ember', k);
        c.dot(CX + r.range(-40, 40), CY + r.range(10, 40) * phase(t, 165.88, T1),
              2.0, GREY, 0.6 * (1.0 - phase(t, 165.88, T1)), 0.0);
      }
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'W:271px · cmd'), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.45 * (1.0 - 0.4 * phase(t, 165.58, T1)),
                                 grainPct: 5.0, scan: 0.04 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_164  `166.0200–167.0200` ｜ TRUE：520×220 状态面板内 TRUE/FALSE 硬翻 7 次后锁定
   ══════════════════════════════════════════════════════════════ */
const SHOT_164 = {
  id: 'SHOT_164', start: 166.0200, end: 167.0200,
  seedHex: SEEDS.SHOT_164, chapter: CHAPTER, status: 'TRUE',
  lyric: 'Then I can / 那么我能',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_164';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    // 面板自光标横向拉伸展开
    const pw = 520.0 * easeOutExpo(phase(t, T0, T0 + 0.14));
    const ph = 220.0 * easeOutExpo(phase(t, T0 + 0.02, T0 + 0.16));
    const px0 = CX - pw * 0.5, py0 = 0.42 * BASE_H - ph * 0.5;
    const ok = t >= 166.62;
    c.rect(px0, py0, px0 + pw, py0 + ph, BG_ALT, 0.0, 1.0, 0.70);
    c.rect(px0, py0, px0 + pw, py0 + ph, ok ? CYAN : BV, 1.5,
           ok ? 1.0 : 0.6, 0.0, ok ? 0.5 : 0.25);
    // 四角刻度
    for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = px0 + (s[0] > 0 ? pw : 0.0);
      const y = py0 + (s[1] > 0 ? ph : 0.0);
      c.line(x, y, x + s[0] * 6.0, y, BV, 1.0, 0.5);
      c.line(x, y, x, y + s[1] * 6.0, BV, 1.0, 0.5);
    }
    // 状态词同位硬翻（6 次 + 第 7 次锁定 TRUE）
    const fi = steps(t, 7, 166.16, 166.62);
    const word = (fi % 2 === 1 && !ok) ? 'FALSE' : 'TRUE';
    const f200 = font('JetBrains Mono ExtraBold', 200, c.ss);
    const wcol = word === 'FALSE' ? RED : ICE;
    c.text(CX - tw(c, f200, word) * 0.5, 0.42 * BASE_H - 100.0 - 14.0, word, f200, wcol, 1.0, 0.5);
    // 8 枚输入点（随翻转逐个点亮）
    const lit = steps(t, 8, 166.16, 166.62);
    for (let k = 0; k < 8; k++) {
      c.dot(px0 - 26.0, py0 + 20.0 + k * 24.0, 4.0,
            k < lit ? CYAN : GREY, k < lit ? 0.95 : 0.7, 0.4);
    }
    // 状态轨（锁定后中段 40% 转主青）
    c.rect(0.15 * BASE_W, 0.72 * BASE_H, 0.85 * BASE_W, 0.72 * BASE_H + 4.0, GREY, 0.0, 1.0, 0.9);
    if (ok) {
      const rp = easeOutExpo(phase(t, 166.62, 166.88));
      c.rect(CX - 0.35 * BASE_W * rp, 0.72 * BASE_H,
             CX + 0.35 * BASE_W * rp, 0.72 * BASE_H + 4.0, CYAN, 0.0, 1.0, 0.95);
    }
    // 次词 Then I can 56px
    mainWord(c, t, 'Then I can', 'Inter Medium', 56, 0.05, ICE, {
      baseline: 0.30 * BASE_H, align: 'center', tIn: 166.88, stagger: 0.012,
      rise: 8.0, glow: 0.35,
    });
    c.note('SHOT_164 FALSE 帧仅 #FF4668（累计 <180ms），TRUE 帧冰白');
    cornerInfo(c, sid, T0, blInfo(sid, 'flip:7'), ok ? 'TRUE' : 'FALSE', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.35, grainPct: 4.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_165  `167.0200–168.0784` ｜ PATH：64 条候选路径逐条熄灭，只留唯一执行链
   ══════════════════════════════════════════════════════════════ */
const SHOT_165 = {
  id: 'SHOT_165', start: 167.0200, end: 168.0784,
  seedHex: SEEDS.SHOT_165, chapter: CHAPTER, status: 'PATH',
  lyric: 'Then I can be your only / 那么我能成为你唯一的',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_165';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const org = [0.14 * BASE_W, 0.46 * BASE_H];
    const tgt = [0.86 * BASE_W, 0.42 * BASE_H];
    const keep = 37;
    const fan = easeOutExpo(phase(t, T0, T0 + 0.18));
    // 64 条候选路径（先算完整点列，再决定保留链）
    const paths = [];
    for (let k = 0; k < 64; k++) {
      const r = new Rng(seedFromHex(seedHex), 'path', k);
      const pts = [org];
      for (let s = 0; s < 6; s++) {
        const u = (s + 1) / 6.0;
        pts.push([lerp(org[0], tgt[0], u),
                  lerp(org[1], tgt[1], u) + r.range(-70.0, 70.0) * (1.0 - u) * fan]);
      }
      paths.push(pts);
    }
    for (let k = 0; k < 64; k++) {
      const off = k !== keep
        ? phase(t, 167.20 + k * 0.006, 167.20 + k * 0.006 + 0.10) : 0.0;
      const a = (1.0 - off) * 0.12;
      if (a > 0.005) c.polyline(paths[k], GREY, 1.0, a, 0.0);
    }
    // 保留链：逐段点亮 + 24 颗电流粒子
    const r2 = new Rng(seedFromHex(seedHex), 'path', keep);
    const pts = [org];
    for (let s = 0; s < 6; s++) {
      const u = (s + 1) / 6.0;
      pts.push([lerp(org[0], tgt[0], u),
                lerp(org[1], tgt[1], u) + r2.range(-70.0, 70.0) * (1.0 - u)]);
    }
    for (let s = 0; s < 6; s++) {
      const sp = easeOutExpo(phase(t, 167.66 + s * 0.04, 167.66 + s * 0.04 + 0.10));
      if (sp <= 0.0) continue;
      c.line(pts[s][0], pts[s][1], lerp(pts[s][0], pts[s + 1][0], sp),
             lerp(pts[s][1], pts[s + 1][1], sp), CYAN, 3.0, 1.0, 0.5);
    }
    for (let k = 0; k < 24; k++) {
      const u = clamp01((t - 167.66 - k * 0.012) / 0.24);
      if (u <= 0.0 || u >= 1.0) continue;
      const px = lerp(org[0], tgt[0], u);
      const py = lerp(org[1], tgt[1], u) + r2.range(-70.0, 70.0) * (1.0 - u);
      c.line(px - 8.0, py, px, py, ICE, 2.0, 0.9, 0.4);
    }
    // 起点圆点 + 目标环
    c.dot(org[0], org[1], 10.0, CYAN, 1.0, 0.6);
    const rs = 10.0 * clamp01(easeOutBack(phase(t, 167.66, 167.92)) + 0.6);
    c.circle(tgt[0], tgt[1], rs, ICE, 2.0, 0.95, 0.0, 0.55);
    c.dot(tgt[0], tgt[1], rs * 0.7, WARM, 0.2, 0.3);
    // 主词 136px（only 主青）
    const f136 = font('Inter Semi-Bold', 136, c.ss);
    const { cells } = cellsOf(f136, 'Then I can be your only', 136.0, 0.04, c.ss);
    const npre = 'Then I can be your '.length;
    mainWord(c, t, 'Then I can be your only', 'Inter Semi-Bold', 136, 0.04, ICE, {
      baseline: 0.17 * BASE_H, align: 'left', x: 0.08 * BASE_W,
      tIn: 167.92, stagger: 0.014, rise: 6.0, glow: 0.4,
    });
    for (let i = npre; i < cells.length; i++) {
      const a = easeOutCubic(phase(t, 167.92 + i * 0.014, 167.92 + i * 0.014 + 0.14));
      c.glyph(cells[i][0], 0.08 * BASE_W + cells[i][1],
              0.17 * BASE_H - f136.asc / c.ss, f136, CYAN, a, 1.0, 1.0, 0.4);
    }
    statusLine(c, t, 'path:64→1', tgt[0], tgt[1] + 28.0, BV,
               { px: 46.0, typed: [167.20, 1.0 / 0.04], glow: 0.4 });
    cornerInfo(c, sid, T0, blInfo(sid, 'paths:64→1'), 'PATH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.30, grainPct: 4.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_166  `168.0784–168.9100` ｜ MORPH：执行链 + 主词吸附成 EXECUTION 点阵轮廓
   ══════════════════════════════════════════════════════════════ */
const SHOT_166 = {
  id: 'SHOT_166', start: 168.0784, end: 168.9100,
  seedHex: SEEDS.SHOT_166, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Then I can be your only / 那么我能成为你唯一的',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_166';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const org = [0.14 * BASE_W, 0.46 * BASE_H];
    const tgt = [0.86 * BASE_W, 0.42 * BASE_H];
    // 采样网格 2×2 闪现 1 帧
    if (t < T0 + 1.0 / 60.0) {
      for (let i = 0; i < 2; i++) {
        const x = 0.10 * BASE_W + i * 0.75 * BASE_W;
        c.line(x, 0.20 * BASE_H, x, 0.62 * BASE_H, GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 2; j++) {
        const y = 0.22 * BASE_H + j * 0.36 * BASE_H;
        c.line(0.10 * BASE_W, y, 0.85 * BASE_W, y, GREY, 1.0, 0.30);
      }
      for (let s = 0; s < 3; s++) {
        const x = 0.06 * BASE_W + s * 0.4 * BASE_W;
        c.line(x, 0.20 * BASE_H, x, 0.62 * BASE_H, GREY, 1.0, 0.18);
      }
    }
    // 目标环先膨胀 r=10→46 再塌缩
    let rr;
    if (t < 168.26) rr = lerp(10.0, 46.0, easeOutExpo(phase(t, T0, T0 + 0.18)));
    else rr = lerp(46.0, 0.0, easeOutCubic(phase(t, 168.26, 168.58)));
    c.circle(tgt[0], tgt[1], Math.max(0.5, rr), ICE, 2.0, 0.9, 0.0, 0.5);
    c.dot(tgt[0], tgt[1], 4.0, WARM, 0.6 * (1.0 - phase(t, 168.26, 168.58)), 0.4);
    const tgtM = dotmatrixTarget(200.0, 0.12, 0.48, 4.0);
    const tp = tgtM.pts, twb = tgtM.wb;
    // 源：链上 1800 点 + 主词 1400 点
    const src = [];
    const r = new Rng(seedFromHex(seedHex), 'path', 37);
    for (let k = 0; k < 1800; k++) {
      const u = k / 1799.0;
      src.push([lerp(org[0], tgt[0], u),
                lerp(org[1], tgt[1], u) + r.range(-70.0, 70.0) * (1.0 - u),
                k % 10 < 7 ? CYAN : ICE]);
    }
    const f144 = font('Inter Semi-Bold', 144, c.ss);
    const off = 1.0 + f144.stroke;
    const asc = f144.asc / c.ss;
    const wpts = sampleText('Then I can be your only', f144, c.ss, 4.0,
                            0.08 * BASE_W - off / c.ss,
                            0.17 * BASE_H - asc - off / c.ss, 1400);
    for (const [x, y] of wpts) src.push([x, y, ICE]);
    const p = easeInOutCubic(phase(t, 168.26, 168.58));
    for (let k = 0; k < src.length; k++) {
      if (k >= tp.length) break;
      const [sx_, sy_, col] = src[k];
      const idx = Math.trunc((k * tp.length) / Math.max(1, src.length));
      let a = 0.55 + 0.35 * p;
      if (t >= 168.78) a = k % 3 ? 0.45 : 0.9;   // 内部粒子下沉为 45% 填充
      c.dot(lerp(sx_, tp[idx][0], p), lerp(sy_, tp[idx][1], easeInOutCubic(clamp01(p * 1.35))),
            2.0, col, a, 0.35);
    }
    cursor(c, CX + twb * 0.5, CY, { w: 2.0, h: 28.0, color: CYAN,
                                    on: blinkOn(t, 0.53, T0), glow: 0.5 });
    if (t >= 168.58 && t < 168.58 + 2.0 / 60.0) c.flash(ICE, 0.06);
    statusLine(c, t, 'broadcast:512', 0.08 * BASE_W, 0.30 * BASE_H, BV,
               { px: 46.0, a: 1.0 - phase(t, T0, T0 + 0.09), glow: 0.3 });
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:2px/1800pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 9.0, strength: 0.42, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_167  `168.9100–169.8200` ｜ EXEC：等宽巨标题 + role 状态行 + 暖色离去点
   ══════════════════════════════════════════════════════════════ */
const SHOT_167 = {
  id: 'SHOT_167', start: 168.9100, end: 169.8200,
  seedHex: SEEDS.SHOT_167, chapter: CHAPTER, status: 'EXEC',
  lyric: 'EXECUTION / 执行',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_167';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const fill = steps(t, 3, T0, T0 + 0.15);
    const col = [BV, BV, ICE][Math.min(2, fill)];
    const erase = phase(t, 169.34, 169.66);
    mainWord(c, t, 'EXECUTION', 'JetBrains Mono ExtraBold', EXEC_PX, 0.12, col, {
      baseline: 0.44 * BASE_H, align: 'center', instant: true, glow: 0.5,
      perChar: (i, ch, tt) => {
        const e = clamp01((erase - i * 0.014) / 0.30);
        return { a: 1.0 - 0.65 * e, dy: 6.0 * easeInCubic(e) };
      },
    });
    c.note('SHOT_167 主词 EXECUTION 271px（等宽 ExtraBold）实测约 1766px > 1728px，按 06 L18 横向压缩');
    statusLine(c, t, '> role: your only executor', CX, 0.57 * BASE_H, CYAN,
               { px: 42.0, typed: [169.06, 1.0 / 0.02], glow: 0.45 });
    // 阶段 4：状态行右滑 12%W 淡出，仅剩 2px 光标
    const slide = easeInQuad(phase(t, 169.66, 169.82));
    if (slide > 0) {
      statusLine(c, t, '> role: your only executor', CX + 0.12 * BASE_W * slide,
                 0.57 * BASE_H, CYAN, { px: 42.0, a: 1.0 - slide, glow: 0.4 });
    }
    cursor(c, 0.18 * BASE_W, 0.62 * BASE_H, { w: 2.0, h: 28.0, color: CYAN,
                                              on: blinkOn(t, 0.53, T0), glow: 0.5 });
    // 169.78s 起的 4px 暖色离去亮点（拖尾 14px，向右上加速）
    if (t >= 169.78) {
      const u = (t - 169.78) / Math.max(1e-6, T1 - 169.78);
      if (u < 0.35) {
        const x0 = 0.18 * BASE_W + 6.0, y0 = 0.62 * BASE_H;
        const ang = rad(-42.0);
        const d = 600.0 * easeInQuad(u / 0.35);
        const x1 = x0 + Math.cos(ang) * d, y1 = y0 + Math.sin(ang) * d;
        c.line(x1 - Math.cos(ang) * 14.0, y1 - Math.sin(ang) * 14.0, x1, y1, WARM, 2.0, 0.5, 0.5);
        c.dot(x1, y1, 4.0, WARM, 0.95, 0.7);
      }
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'W:271px · role'), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.40 * (1.0 - 0.4 * phase(t, 169.34, T1)),
                                 grainPct: 5.0, scan: 0.04 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_168  `169.8200–170.9680` ｜ RETURN：暖亮点飞至右上极限后折返 + 200 条引力透镜弧
   ══════════════════════════════════════════════════════════════ */
const SHOT_168 = {
  id: 'SHOT_168', start: 169.8200, end: 170.9680,
  seedHex: SEEDS.SHOT_168, chapter: CHAPTER, status: 'RETURN',
  lyric: 'If I can have you back / 如果我能把你带回来',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_168';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const org = [0.18 * BASE_W, 0.62 * BASE_H];
    // 暖亮点轨迹：加速飞向 (92%,14%) → hard stop → 折返
    let dx, dy;
    if (t < 170.16) {
      const u = easeInQuad(phase(t, T0, 170.16));
      dx = lerp(org[0], 0.92 * BASE_W, u);
      dy = lerp(org[1], 0.14 * BASE_H, u);
    } else if (t < 170.30) { dx = 0.92 * BASE_W; dy = 0.14 * BASE_H; }
    else {
      const u = easeOutCubic(phase(t, 170.30, 170.74));
      dx = lerp(0.92 * BASE_W, 0.34 * BASE_W, u);
      dy = lerp(0.14 * BASE_H, 0.48 * BASE_H, u);
    }
    // 200 条世界线：向亮点弯成引力透镜弧（每条延迟 3ms）
    const vmax = 0.09 * BASE_H;
    const bow = vmax * Math.exp(-(((dx - CX) ** 2)) / (2 * (700.0 ** 2)));
    for (let k = 0; k < 200; k++) {
      const yb = lerp(0.15 * BASE_H, 0.85 * BASE_H, k / 199.0);
      const bp = clamp01((t - 170.30 - k * 0.003) / 0.44);
      const eob = easeOutCubic(bp);
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const x = (i / 47.0) * BASE_W;
        const pull = Math.exp(-(((x - dx) ** 2)) / (2 * (620.0 ** 2)));
        pts.push([x, yb - bow * pull * eob * (1.0 - Math.abs(yb - dy) / (1.2 * BASE_H))]);
      }
      c.polyline(pts, BV, 1.0, 0.65, 0.0);
    }
    // 亮点 + 拖尾
    const tl = 18.0 + 8.0 * clamp01((t - T0) / 0.34);
    const ang = t < 170.30
      ? Math.atan2(dy - org[1], dx - org[0])
      : Math.atan2(0.48 * BASE_H - 0.14 * BASE_H, 0.34 * BASE_W - 0.92 * BASE_W);
    c.line(dx - Math.cos(ang) * tl, dy - Math.sin(ang) * tl, dx, dy, WARM, 2.0, 0.5, 0.45);
    c.dot(dx, dy, 5.0, WARM, 0.95, 0.75);
    // 原点光标（「我」的锚点）
    cursor(c, org[0], org[1], { w: 2.0, h: 28.0, color: CYAN,
                                on: blinkOn(t, 0.53, T0), glow: 0.5 });
    // 主词 144px 上扬 6°；back 暖色
    const f144 = font('Inter Semi-Bold', 144, c.ss);
    const { cells } = cellsOf(f144, 'If I can have you back', 144.0, 0.04, c.ss);
    const lift = Math.tan(rad(6.0));
    const npre = 'If I can have you '.length;
    mainWord(c, t, 'If I can have you back', 'Inter Semi-Bold', 144, 0.04, ICE, {
      baseline: 0.77 * BASE_H, align: 'left', x: 0.10 * BASE_W, instant: true, glow: 0.4,
      perChar: (i, ch, tt) => {
        const xo = i < cells.length ? cells[i][1] : 0.0;
        const st = 170.74 + i * 0.014;
        return { dy: -lift * xo, a: easeOutCubic(phase(tt, st, st + 0.12)) };
      },
    });
    if (t >= 170.90) {
      for (let i = npre; i < cells.length; i++) {
        c.glyph(cells[i][0], 0.10 * BASE_W + cells[i][1],
                0.77 * BASE_H - f144.asc / c.ss - lift * cells[i][1], f144, WARM, 0.95, 1.0, 1.0, 0.5);
      }
    }
    if (t >= 170.16 && t < 170.16 + 2.0 / 60.0) {
      c.circle(dx, dy, 16.0, WARM, 2.0, 0.6, 0.0, 0.5);
    }
    statusLine(c, t, 'reverse:t+1', dx + 32.0, dy + 20.0, BV,
               { px: 46.0, align: 'left', typed: [170.30, 1.0 / 0.04], glow: 0.4 });
    cornerInfo(c, sid, T0, blInfo(sid, 'field:200lines'), 'RETURN', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.35, grainPct: 4.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_169  `170.9680–171.8700` ｜ MORPH：暖点与光标合并，世界线+主词收拢为 4 行队列
   ══════════════════════════════════════════════════════════════ */
const SHOT_169 = {
  id: 'SHOT_169', start: 170.9680, end: 171.8700,
  seedHex: SEEDS.SHOT_169, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I can have you back / 如果我能把你带回来',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_169';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const org = [0.18 * BASE_W, 0.62 * BASE_H];
    // ① 双点合并 hard cut + 扩散环
    const rp = easeOutExpo(phase(t, T0, T0 + 0.17));
    if (rp < 1.0) {
      c.circle(org[0], org[1], 12.0 * rp, ICE, 1.0, (1.0 - rp) * 0.8, 0.0, 0.5);
    }
    c.dot(org[0], org[1], 8.0, blendc(WARM, CYAN, phase(t, T0, T0 + 2.0 / 60.0)), 1.0, 0.7);
    // ② 4 行队列骨架（逐行点亮）
    const qx = 0.14 * BASE_W, qy = 0.34 * BASE_H;
    const roww = 420.0, rowh = 46.0, gap = 54.0;
    const labels = ['> load', '> route', '> run', '> _'];
    const f42 = font('JetBrains Mono', 42.0, c.ss);
    for (let r0 = 0; r0 < 4; r0++) {
      const y = qy + r0 * gap;
      const lp = steps(t, 4, 171.48, 171.70);
      const a = r0 >= lp ? 0.35 : 0.85;
      c.rect(qx, y, qx + roww, y + rowh, CYAN, 1.0, a, 0.35 * a, 0.25 * a);
      c.text(qx + 16.0, y + 2.0, labels[r0], f42, ICE, 0.9 * a, 0.3 * a);
    }
    c.dot(qx, qy - 26.0, 4.0, CYAN, 0.95, 0.6);
    // ③ 世界线 + 主词采样 → 队列骨架
    const tp = [];
    for (let r0 = 0; r0 < 4; r0++) {
      for (let i = 0; i < 24; i++) {
        tp.push([qx + 20.0 + ((roww - 40.0) * i) / 23.0, qy + r0 * gap + rowh * 0.5]);
      }
    }
    const src = [];
    for (let k = 0; k < 200; k++) {
      const yb = lerp(0.15 * BASE_H, 0.85 * BASE_H, k / 199.0);
      for (let i = 0; i < 17; i++) src.push([(i / 16.0) * BASE_W, yb, BV]);
    }
    const f144 = font('Inter Semi-Bold', 144, c.ss);
    const off = 1.0 + f144.stroke;
    const asc = f144.asc / c.ss;
    const wpts = sampleText('If I can have you back', f144, c.ss, 3.0,
                            0.10 * BASE_W - off / c.ss,
                            0.77 * BASE_H - asc - off / c.ss, 1900);
    for (const [x, y] of wpts) src.push([x, y, ICE]);
    const p2 = easeInOutCubic(phase(t, 171.14, 171.48));
    for (let k = 0; k < src.length; k++) {
      if (k >= tp.length) break;
      const [sx_, sy_, col] = src[k];
      c.dot(lerp(sx_, tp[k][0], p2), lerp(sy_, tp[k][1], p2), 1.6,
            k % 13 === 0 ? WARM : col, 0.6 + 0.3 * p2, 0.25);
    }
    cursor(c, qx + roww - 20.0, qy + 3 * gap + rowh * 0.5, {
      w: 2.0, h: 28.0, color: CYAN, on: blinkOn(t, 0.53, T0), glow: 0.5 });
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:3px/3400pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.40, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_170  `171.8700–172.7100` ｜ RUN：4 行队列展开为 640×360 终端面板
   ══════════════════════════════════════════════════════════════ */
const SHOT_170 = {
  id: 'SHOT_170', start: 171.8700, end: 172.7100,
  seedHex: SEEDS.SHOT_170, chapter: CHAPTER, status: 'RUN',
  lyric: 'I will run the / 我会运行',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_170';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    // 面板（scaleX 0.4→1）
    const sw = easeOutExpo(phase(t, T0, T0 + 0.18));
    const pw = 640.0 * lerp(0.4, 1.0, sw);
    const ph = 360.0 * sw;
    const x0 = 0.10 * BASE_W, y0 = 0.26 * BASE_H;
    c.rect(x0, y0, x0 + pw, y0 + ph, BG_ALT, 0.0, 1.0, 0.80);
    c.rect(x0, y0, x0 + pw, y0 + ph, BV, 1.5, 0.5, 0.0, 0.3);
    c.dot(x0, y0, 4.0, CYAN, 1.0, 0.6);              // 继承的起点标记
    c.poly([[x0 + pw - 8.0, y0], [x0 + pw, y0], [x0 + pw, y0 + 8.0]], GREY, 1.0, 0.5, 0.0);
    const lines = ['> load return.k', '> route: back', '> run', '> _'];
    const cols = [GREY, GREY, ICE, CYAN];
    const f42 = font('JetBrains Mono', 42.0, c.ss);
    const typedN = [];
    for (let i = 0; i < 4; i++) {
      typedN.push(Math.trunc(clamp01((t - (172.05 + i * 0.06)) / 0.02)));
    }
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i];
      const yy = y0 + 60.0 + i * 60.0;
      c.line(x0, yy - 18.0, x0 + pw, yy - 18.0, GREY, 1.0, 0.15);
      let vis = Math.min(s.length, Math.max(0, typedN[i]) + (t < 172.05 + i * 0.06 ? 0 : 1));
      if (t >= 172.56) vis = s.length;
      if (vis > 0) c.text(x0 + 20.0, yy - 42.0, s.slice(0, vis), f42, cols[i], 0.95, 0.35);
    }
    // run 行高亮条（hard cut）
    if (t >= 172.34) {
      const hy = y0 + 60.0 + 2 * 60.0 - 46.0;
      c.rect(x0 + 10.0, hy, x0 + 118.0, hy + 46.0, CYAN, 0.0, 1.0, 0.18);
      c.line(x0 + 10.0, hy, x0 + 10.0, hy + 46.0, ICE, 1.0, 0.25);
    }
    const curRow = t >= 172.34 ? 2 : 0;
    cursor(c, x0 + 20.0 + tw(c, f42, lines[curRow]) + 6.0,
           y0 + 60.0 + curRow * 60.0 - 28.0, { w: 2.0, h: 30.0, color: CYAN,
           on: blinkOn(t, 0.53, T0), glow: 0.5 });
    // 主词 168px（run 主青）
    const f168 = font('Inter Semi-Bold', 168, c.ss);
    const { cells } = cellsOf(f168, 'I will run the', 168.0, 0.05, c.ss);
    const npre = 'I will '.length;
    mainWord(c, t, 'I will run the', 'Inter Semi-Bold', 168, 0.05, ICE, {
      baseline: 0.15 * BASE_H, align: 'left', x: 0.10 * BASE_W,
      tIn: 172.56, stagger: 0.014, rise: 6.0, glow: 0.4,
    });
    for (let i = npre; i < npre + 3; i++) {
      if (i < cells.length) {
        const a = easeOutCubic(phase(t, 172.56 + i * 0.014, 172.56 + i * 0.014 + 0.14));
        c.glyph(cells[i][0], 0.10 * BASE_W + cells[i][1],
                0.15 * BASE_H - f168.asc / c.ss, f168, CYAN, a, 1.0, 1.0, 0.4);
      }
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'queue:4'), 'RUN', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.30, grainPct: 5.0, scan: 0.05 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_171  `172.7100–173.6400` ｜ EXEC：白闪 → 等宽巨标题 → 状态行 → 1px 边界细线
   ══════════════════════════════════════════════════════════════ */
const SHOT_171 = {
  id: 'SHOT_171', start: 172.7100, end: 173.6400,
  seedHex: SEEDS.SHOT_171, chapter: CHAPTER, status: 'EXEC',
  lyric: 'EXECUTION / 执行',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_171';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.flash(ICE, 0.25);
    const sp = easeOutBack(phase(t, 172.80, 173.02));
    const fill = steps(t, 3, T0, T0 + 0.20);
    const col = [BV, BV, ICE][Math.min(2, fill)];
    const erase = phase(t, 173.02, 173.42);
    mainWord(c, t, 'EXECUTION', 'JetBrains Mono ExtraBold', EXEC_PX, 0.12, col, {
      baseline: 0.46 * BASE_H, align: 'center', instant: true,
      alpha: clamp01(sp * 1.5), glow: 0.55,
      perChar: (i, ch, tt) => ({ a: 1.0 - 0.7 * clamp01((erase - (8 - i) * 0.016) / 0.34) }),
    });
    c.note('SHOT_171 主词 EXECUTION 271px（等宽 ExtraBold）实测约 1766px > 1728px，按 06 L18 横向压缩');
    statusLine(c, t, '> executed: return', CX, 0.56 * BASE_H, CYAN,
               { px: 42.0, typed: [173.02, 1.0 / 0.02], glow: 0.45,
                 a: 1.0 - phase(t, 173.42, 173.55) });
    cursor(c, CX, CY, { w: 2.0, h: 28.0, color: CYAN,
                        on: steps(t, 2, 173.42, 173.54) % 2 === 0, glow: 0.5 });
    // 边界细线：自中心向两侧展开至 W=76%
    if (t >= 173.48) {
      const lp = easeOutExpo(phase(t, 173.48, T1));
      const half = 0.38 * BASE_W * lp;
      c.line(CX - half, 0.56 * BASE_H, CX + half, 0.56 * BASE_H, BV, 1.0, 0.40, 0.25);
      for (let k = 0; k < 20; k++) {
        const x = CX - 0.38 * BASE_W + (k * (0.76 * BASE_W)) / 19.0;
        if (Math.abs(x - CX) <= half) {
          const dist = Math.abs(x - CX) / (0.38 * BASE_W);
          c.dot(x, 0.56 * BASE_H, 1.5, BV, (1.0 - dist) * 0.6, 0.3);
        }
      }
    }
    // 12 颗状态行余烬被细线吸附
    for (let k = 0; k < 12; k++) {
      const r = new Rng(seedFromHex(seedHex), 'ember', k);
      const u = phase(t, 173.42, T1);
      const x = CX + r.range(-120, 120);
      const y = 0.56 * BASE_H - 60.0 * (1.0 - u) * (0.4 + 0.6 * r.next());
      c.dot(x, y, 2.0, GREY, 0.6 * (1.0 - u * 0.6), 0.0);
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'W:271px · line'), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.50 * (1.0 - 0.4 * phase(t, 173.02, T1)),
                                 grainPct: 5.0, scan: 0.03 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_172  `173.6400–174.3848` ｜ TRAP：1px 细线折起为 2.5D 透明立方，24 粒子撞壁
   ══════════════════════════════════════════════════════════════ */
const SHOT_172 = {
  id: 'SHOT_172', start: 173.6400, end: 174.3848,
  seedHex: SEEDS.SHOT_172, chapter: CHAPTER, status: 'TRAP',
  lyric: 'Though we are trapped / 尽管我们被困',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_172';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const fw = 720.0, fh = 400.0;
    const fx0 = CX - fw * 0.5, fy0 = CY - fh * 0.5;
    const bx0 = fx0 + 0.03 * BASE_W, by0 = fy0 - 0.04 * BASE_H;
    const fold = easeOutExpo(phase(t, T0, T0 + 0.12));
    // 12 条棱（线宽 1→10px、opacity 0.35→0.85）
    const hits = Math.trunc((t - T0) / 0.014);
    const th = 1.0 + 9.0 * clamp01(hits / 24.0);
    const al = 0.35 + 0.50 * clamp01(hits / 24.0);
    const F = [[fx0, fy0], [fx0 + fw, fy0], [fx0 + fw, fy0 + fh], [fx0, fy0 + fh]];
    const B = [[bx0, by0], [bx0 + fw, by0], [bx0 + fw, by0 + fh], [bx0, by0 + fh]];
    const jit = (hits % 2 === 0 && hits > 0) ? 2.0 : 0.0;
    for (let i = 0; i < 4; i++) {
      const j1 = F[i], k1 = F[(i + 1) % 4];
      c.line(j1[0] + jit, j1[1], k1[0] + jit, k1[1], BV, th, al, 0.35);
      const j2 = B[i], k2 = B[(i + 1) % 4];
      c.line(j2[0], j2[1] - jit, k2[0], k2[1] - jit, BV, th, al * 0.8, 0.3);
      c.line(F[i][0], F[i][1], B[i][0], B[i][1], BV, th * 0.6, al * 0.7, 0.25);
    }
    // 盒内 6 条空间网格线
    for (let k = 0; k < 3; k++) {
      const yy = fy0 + (fh * (k + 1)) / 4.0 + jit;
      c.line(fx0 + 0.2 * fw, yy, fx0 + 0.8 * fw, yy, GREY, 1.0, 0.12);
      const xx = fx0 + (fw * (k + 1)) / 4.0 + jit;
      c.line(xx, fy0 + 0.2 * fh, xx, fy0 + 0.8 * fh, GREY, 1.0, 0.12);
    }
    // 24 颗粒子以 0.9W/s 撞壁（间隔 14ms）
    for (let k = 0; k < 24; k++) {
      const r = new Rng(seedFromHex(seedHex), 'ball', k);
      const st = T0 + 0.12 + k * 0.014;
      if (t < st) continue;
      const vx = r.range(0.6, 1.2), vy = r.range(0.4, 0.9);
      const ux = 0.2 + 0.6 * r.next(), uy = 0.2 + 0.6 * r.next();
      const dxs = ((0.9 * BASE_W) / fw) * (t - st) * vx;
      const dys = ((0.9 * BASE_W) / fh) * (t - st) * vy;
      const tx = Math.abs(((ux + dxs) % 2.0) - 1.0);
      const ty = Math.abs(((uy + dys) % 2.0) - 1.0);
      const px = fx0 + tx * fw, py = fy0 + ty * fh;
      c.dot(px, py, 3.0, CYAN, 0.95, 0.5);
      const hit = (tx < 0.04 || tx > 0.96 || ty < 0.04 || ty > 0.96);
      if (hit) {
        c.arc(px, py, 10.0, 0, 180, ICE, 1.0, 0.6, 0.4);
        const hk = Math.trunc((t - st) / 0.19);
        if (hk % 9 === 0) c.dot(px, py, 6.0, RED, 0.5, 0.4);
      }
    }
    // 主词 136px（trapped 蓝紫）
    const f136 = font('Inter Semi-Bold', 136, c.ss);
    const { cells } = cellsOf(f136, 'Though we are trapped', 136.0, 0.04, c.ss);
    const npre = 'Though we are '.length;
    mainWord(c, t, 'Though we are trapped', 'Inter Semi-Bold', 136, 0.04, ICE, {
      baseline: 0.25 * BASE_H, align: 'left', x: 0.08 * BASE_W,
      tIn: 174.28, stagger: 0.012, rise: 6.0, glow: 0.4,
    });
    for (let i = npre; i < cells.length; i++) {
      const a = easeOutCubic(phase(t, 174.28 + i * 0.012, 174.28 + i * 0.012 + 0.14));
      c.glyph(cells[i][0], 0.08 * BASE_W + cells[i][1],
              0.25 * BASE_H - f136.asc / c.ss, f136, BV, a, 1.0, 1.0, 0.4);
    }
    statusLine(c, t, 'wall.t:1→10px', fx0 + fw + 24.0, fy0 + fh + 10.0, GREY,
               { px: 46.0, align: 'left', typed: [T0, 1.0 / 0.05], glow: 0.3 });
    cornerInfo(c, sid, T0, blInfo(sid, 'wall:10px'), 'TRAP', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.32, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_173  `174.3848–174.9700` ｜ ECHO：立方 12 棱 → 5 层同心深度矩形 + 层内描边预览
   ══════════════════════════════════════════════════════════════ */
const SHOT_173 = {
  id: 'SHOT_173', start: 174.3848, end: 174.9700,
  seedHex: SEEDS.SHOT_173, chapter: CHAPTER, status: 'ECHO',
  lyric: 'WE ARE TRAPPED / 我们被困住了',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_173';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    // 12 棱闪一次（2 帧）
    if (t < T0 + 2.0 / 60.0) {
      const fx0 = CX - 360.0, fy0 = CY - 200.0;
      c.rect(fx0, fy0, fx0 + 720.0, fy0 + 400.0, ICE, 1.0, 0.5);
    }
    const p = easeInOutCubic(phase(t, 174.50, 174.76));
    const w0 = 0.62 * BASE_W;
    const inner = 0.24 * BASE_W;
    const PXS = [176.0, 150.0, 126.0, 104.0, 86.0];
    for (let L = 0; L < 5; L++) {
      const sw = lerp(w0, inner, L / 4.0);
      const sh = sw * 0.55;
      const lay = clamp01(p * 5.0 - L * 0.6);
      if (lay <= 0.0) continue;
      const k = 0.9 + 0.1 * lay;
      c.rect(CX - sw * 0.5 * k, CY - sh * 0.5 * k,
             CX + sw * 0.5 * k, CY + sh * 0.5 * k, MOOD, 1.5,
             lerp(0.30, 0.55, L / 4.0) * lay, 0.25);
      // 层内 WE ARE TRAPPED 描边预览
      const pxL = PXS[L];
      if (t >= 174.76 + L * 0.03) {
        const fl = font('Inter Semi-Bold', pxL, c.ss);
        const wtxt = tw(c, fl, 'WE ARE TRAPPED');
        outlineText(c, CX - wtxt * 0.5, CY - pxL * 0.36, 'WE ARE TRAPPED', fl,
                    MOOD, 0.30, 0.06, pxL);
      }
    }
    // 24 颗层间粒子
    for (let k = 0; k < 24; k++) {
      const r = new Rng(seedFromHex(seedHex), 'p', k);
      const ang = r.range(0, Math.PI * 2);
      const rr = r.range(0.30, 0.60) * BASE_W;
      c.dot(CX + Math.cos(ang) * rr * p, CY + Math.sin(ang) * rr * 0.55 * p, 3.0, CYAN, 0.9, 0.4);
    }
    cursor(c, CX, CY, { w: 2.0, h: 28.0, color: CYAN, on: blinkOn(t, 0.53, T0), glow: 0.5 });
    cornerInfo(c, sid, T0, blInfo(sid, 'depth:5'), 'ECHO', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.38, grainPct: 5.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_174  `174.9700–176.2468` ｜ ECHO：9 层同心矩形 + 9 层同句递减（240→48px）
   ══════════════════════════════════════════════════════════════ */
const SHOT_174 = {
  id: 'SHOT_174', start: 174.9700, end: 176.2468,
  seedHex: SEEDS.SHOT_174, chapter: CHAPTER, status: 'ECHO',
  lyric: 'WE ARE TRAPPED / 我们被困住了',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_174';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const SIZES = [240.0, 196.0, 160.0, 132.0, 108.0, 90.0, 74.0, 60.0, 48.0];
    // 阶段 1：5 层补至 9 层
    let nLay = 5;
    for (let k = 0; k < 4; k++) if (t >= T0 + k * 0.06) nLay += 1;
    nLay = Math.min(9, nLay);
    let flashLayer = -1;
    if (t >= 175.86) {
      for (let k = 0; k < 6; k++) {
        const s0 = 175.86 + k * 0.036;
        if (t >= s0 && t < s0 + 2.0 / 60.0) {
          const r = new Rng(seedFromHex(seedHex), 'flash', k);
          flashLayer = Math.trunc(r.next() * 9.0);
        }
      }
    }
    for (let L = 0; L < nLay; L++) {
      const sw = 0.92 * BASE_W * (0.80 ** L);
      const sh = sw * 0.55;
      const appear = T0 + Math.max(0, L - 5) * 0.06;
      const lp = L >= 5 ? easeOutBack(phase(t, appear, appear + 0.12)) : 1.0;
      if (lp <= 0.0) continue;
      const breath = 1.0 + 0.02 * Math.sin((2 * Math.PI * (t - T0)) / 0.9 - L * 0.14);
      const collect = 1.0 - 0.03 * easeInCubic(phase(t, 176.08, T1));
      const w1 = sw * lp * breath * collect;
      const h1 = sh * lp * breath * collect;
      const a = lerp(0.55, 0.12, L / 8.0) * Math.min(1.0, lp * 1.6);
      c.rect(CX - w1 * 0.5, CY - h1 * 0.5, CX + w1 * 0.5, CY + h1 * 0.5, MOOD, 1.5,
             a + (L === flashLayer ? 0.4 : 0.0), 0.25);
    }
    // 60 条纵向深度连线
    for (let k = 0; k < 60; k++) {
      const x = lerp(0.06 * BASE_W, 0.94 * BASE_W, k / 59.0);
      c.line(x, 0.20 * BASE_H, x, 0.80 * BASE_H, GREY, 1.0, 0.20);
    }
    // 9 层同句（最外 2 层冰白、3–6 层情绪紫、内 3 层灰蓝）
    for (let L = 0; L < nLay; L++) {
      const pxL = SIZES[L];
      const col = L < 2 ? ICE : (L < 6 ? MOOD : GREY);
      const appear = T0 + Math.max(0, L - 5) * 0.06;
      const aa = L >= 5 ? clamp01((t - appear) / 0.12) : 1.0;
      mainWord(c, t, 'WE ARE TRAPPED', 'Inter Semi-Bold', pxL, 0.06, col, {
        baseline: CY + pxL * 0.36, align: 'center', instant: true,
        alpha: 0.95 * aa, glow: 0.25,
      });
    }
    // ah mono 42px（情绪紫）
    statusLine(c, t, 'ah', 0.78 * BASE_W, 0.80 * BASE_H, MOOD,
               { px: 42.0, align: 'left', typed: [T0, 1.0 / 0.05], glow: 0.4 });
    // 24 颗层间粒子 + 中心光标
    for (let k = 0; k < 24; k++) {
      const r = new Rng(seedFromHex(seedHex), 'p', k);
      const ang = (2 * Math.PI * k) / 24.0 + t * 0.1;
      const rr = r.range(0.10, 0.40) * BASE_W;
      c.dot(CX + Math.cos(ang) * rr, CY + Math.sin(ang) * rr * 0.55, 3.0, CYAN, 0.9, 0.4);
    }
    cursor(c, CX, CY, { w: 2.0, h: 28.0, color: CYAN,
                        on: (steps(t, 2, 176.08, 176.20) % 2 === 0 || t > 176.20), glow: 0.5 });
    if (t >= 176.08) c.flash(ICE, 0.10 * (1.0 - phase(t, 176.08, 176.25)));
    cornerInfo(c, sid, T0, blInfo(sid, 'layers:9'), 'ECHO', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.40, grainPct: 6.0, scan: 0.0 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_175  `176.2468–177.2500` ｜ MORPH：9 层文字 4800 点吸附为 6 张 SAMPLE 卡片
   ══════════════════════════════════════════════════════════════ */
const SHOT_175 = {
  id: 'SHOT_175', start: 176.2468, end: 177.2500,
  seedHex: SEEDS.SHOT_175, chapter: CHAPTER, status: 'MORPH',
  lyric: 'SAMPLE / 样本',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_175';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const SIZES = [240.0, 196.0, 160.0, 132.0, 108.0, 90.0, 74.0, 60.0, 48.0];
    // 卡片几何：220×300、扇形微斜 ±6°、前后堆叠偏移 14px
    const cards = [];
    for (let i = 0; i < 6; i++) {
      cards.push([0.30 * BASE_W + i * 0.08 * BASE_W,
                  0.50 * BASE_H + (i - 2.5) * 14.0, -6.0 + 2.4 * i, 220.0, 300.0]);
    }
    // 阶段 1：9 层文字 4px 步长采样
    const pp = clamp01((t - 176.60) / 0.38);
    const NMAX = [400, 400, 400, 400, 450, 450, 450, 450, 400];
    for (let L = 0; L < 9; L++) {
      const pxL = SIZES[L];
      const fl = font('Inter Semi-Bold', pxL, c.ss);
      const off = 1.0 + fl.stroke;
      const asc = fl.asc / c.ss;
      const wb = fl.getlength('WE ARE TRAPPED') + 0.06 * pxL * ('WE ARE TRAPPED'.length - 1)
               + off * 2;
      const ox = CX - (wb / c.ss) * 0.5 - off / c.ss;
      const oy = CY + pxL * 0.36 - asc - off / c.ss;
      const pts = sampleText('WE ARE TRAPPED', fl, c.ss, 4.0, ox, oy, NMAX[L]);
      const tgtI = L < 2 ? 5 : (L < 6 ? 4 : 0);
      const card = cards[tgtI];
      const cx0 = card[0], cy0 = card[1], rot = card[2], cw = card[3], chh = card[4];
      const rad2 = rad(rot);
      const col = L < 2 ? ICE : (L < 6 ? MOOD : GREY);
      for (let q = 0; q < pts.length; q++) {
        const [x, y] = pts[q];
        const u = q / Math.max(1.0, pts.length - 1);
        const px_ = cx0 + (u - 0.5) * cw * 0.9;
        const py_ = cy0 - chh * 0.42 + (0.15 + 0.7 * ((q * 7) % 100) / 100.0) * chh;
        const rr = new Rng(seedFromHex(seedHex), `noise${L}`, q);
        const tx = px_ + rr.range(-4.0, 4.0) * 3.0;
        const ty = py_ + rr.range(-4.0, 4.0);
        const ax = cx0 + (tx - cx0) * Math.cos(rad2) - (ty - cy0) * Math.sin(rad2);
        const ay = cy0 + (tx - cx0) * Math.sin(rad2) + (ty - cy0) * Math.cos(rad2);
        const aa = q % 25 ? 1.0 : 0.35;   // 92% 吸附，8% 留作残尘
        c.dot(lerp(x, ax, pp), lerp(y, ay, pp), 1.6, col, aa * 0.9, 0.25);
      }
    }
    // 卡片描边点亮 + 卡面 SAMPLE 微字
    const lp = easeOutBack(phase(t, 176.98, 177.14));
    const f16 = font('JetBrains Mono', 16.0, c.ss);
    for (let i = 0; i < cards.length; i++) {
      const [cx0, cy0, rot, cw, chh] = cards[i];
      const rad2 = rad(rot);
      const corners = [[-cw / 2, -chh / 2], [cw / 2, -chh / 2], [cw / 2, chh / 2], [-cw / 2, chh / 2]];
      const poly = corners.map(([x, y]) => [
        cx0 + x * Math.cos(rad2) - y * Math.sin(rad2),
        cy0 + x * Math.sin(rad2) + y * Math.cos(rad2)]);
      c.poly(poly, MOOD, 1.5, 0.45 + 0.40 * clamp01(lp), 0.0, 0.3);
      c.text(cx0 - cw * 0.32, cy0 + chh * 0.30, `SAMPLE_${String(i + 1).padStart(2, '0')}`,
             f16, GREY, 0.30);
    }
    // 中心 2px 光标飞向卡堆顶端并 hard cut 消失；4 颗青粒子停在卡堆右上
    if (t < 177.14) {
      const u = easeInQuad(phase(t, 177.14 - 0.14, 177.14));
      cursor(c, lerp(CX, 0.62 * BASE_W, u), lerp(CY, 0.18 * BASE_H, u),
             { w: 2.0, h: 28.0, color: CYAN, on: true, glow: 0.5 });
    }
    for (let k = 0; k < 4; k++) {
      const r = new Rng(seedFromHex(seedHex), 'wait', k);
      c.dot(0.62 * BASE_W + r.range(0, 40), 0.20 * BASE_H + r.range(0, 30), 2.0, CYAN, 0.9, 0.5);
    }
    cornerInfo(c, sid, T0, blInfo(sid, 'sample:4px/4800pt'), 'MORPH', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 9.0, strength: 0.44, grainPct: 6.0, scan: 0.0 });
  },
};

export const CH09_SHOTS = [SHOT_160, SHOT_161, SHOT_162, SHOT_163, SHOT_164,
                           SHOT_165, SHOT_166, SHOT_167, SHOT_168, SHOT_169,
                           SHOT_170, SHOT_171, SHOT_172, SHOT_173, SHOT_174,
                           SHOT_175];
export { beatStore as CH09_BEATS };
