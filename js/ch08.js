/**
 * ch08.js — 第 08 章 EXECUTION / WHITE（镜头 141–159）
 *
 * 自 Python 版 render/scenes/ch08_execution.py 移植。
 * 本章与 ch07 的 helper 完全同构（`Canvas` 上下文 + 同一套排版/蒙版/节拍工具），
 * 因此公共中间层直接复用 canvas.js；章内专有 helper 在本文件。
 *
 * 本章是红色退潮 → 白色执行段：红从"对象"退回"点"，白场接管，执行 19 个母题。
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

const CHAPTER = 'ch08/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_SEMI = 'Inter Semi-Bold';
/** 画布中心（对应 Python 的 CX / CY） */
const CX = BASE_W * 0.5;
const CY = BASE_H * 0.5;
/** 06 第 08 章统一光标（继承 SHOT_140） */
const CURSOR_W = 14.0;
const CURSOR_H = 28.0;

// 种子与题旨取自 Python 源码的 SEEDS / MOTIF（**不可自造**）
const SEEDS = {
  SHOT_141: '0564A8DB', SHOT_142: 'B38E82FC', SHOT_143: '74C60DF7',
  SHOT_144: '9050B2DA', SHOT_145: '5B7F56A4', SHOT_146: '8A32CB1A',
  SHOT_147: '2C373019', SHOT_148: 'B6C0EAA9', SHOT_149: '45F83ED2',
  SHOT_150: 'BF1E673C', SHOT_151: '9E844CCF', SHOT_152: 'E1BD9EDA',
  SHOT_153: '646B26E4', SHOT_154: '09091471', SHOT_155: '1D0F13F7',
  SHOT_156: 'E5600212', SHOT_157: '12120471', SHOT_158: '7653A15D',
  SHOT_159: 'BCEDDEDC',
};
const MOTIF = {
  SHOT_141: 'ring', SHOT_142: 'split', SHOT_143: 'grid', SHOT_144: 'tri',
  SHOT_145: 'burst', SHOT_146: 'spiral', SHOT_147: 'stairs', SHOT_148: 'mirror',
  SHOT_149: 'clamp', SHOT_150: 'wave', SHOT_151: 'reticle', SHOT_152: 'flyby',
  SHOT_153: 'probe', SHOT_154: 'lattice', SHOT_155: 'echo', SHOT_156: 'seal',
  SHOT_157: 'pulse', SHOT_158: 'gate', SHOT_159: 'dissolve',
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
/** SHOT_139/140 的 ILLEGAL ARGUMENTS 残影 2 帧（10% 红字全词）——章节闭环 */
function residualIllegal(c, t, T0) {
  if (t < T0 + 2.0 / 60.0) {
    mainWord(c, t, 'ILLEGAL ARGUMENTS', 'Inter Bold', 146, 0.12, RED, {
      baseline: 0.54 * BASE_H, align: 'center', alpha: 0.10, instant: true, glow: 0.0,
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   SHOT_141  `147.66–148.60` ｜ ring：巨标题 hard cut → 状态行 → 8 段弧闭合圆环
   ══════════════════════════════════════════════════════════════ */
const SHOT_141 = {
  id: 'SHOT_141', start: 147.66, end: 148.60,
  seedHex: SEEDS.SHOT_141, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_141';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    residualIllegal(c, t, T0);

    // ① 红残片外漂（10 片 6–18px）
    const fa = 1.0 - easeInQuad(phase(t, 148.10, 148.30));
    if (fa > 0.01) {
      for (let i = 0; i < 10; i++) {
        const r = new Rng(seedFromHex(seedHex), 'frag', i);
        const x0 = CX + r.range(-46, 46), y0 = CY + r.range(-46, 46);
        const sz = r.range(6, 18);
        const ang = r.range(0, Math.PI * 2);
        const d = 40.0 * Math.max(0.0, t - T0);
        const x1 = x0 + Math.cos(ang) * d, y1 = y0 + Math.sin(ang) * d;
        c.rect(x1 - sz * 0.5, y1 - sz * 0.5, x1 + sz * 0.5, y1 + sz * 0.5,
               RED, 1.5, fa, 0.25);
      }
    }
    // ② 外圈空心红框
    const ob = 1.0 - easeOutQuad(phase(t, T0, 148.10));
    if (ob > 0.01) {
      const h = lerp(16.0, 20.0, phase(t, T0, 148.10));
      c.rect(CX - h, CY - h, CX + h, CY + h, RED, 2.0, ob * 0.5, 0.2);
    }
    // ③ 光标：ERRRED → CYAN
    const ck = easeInOutSine(phase(t, 148.20, 148.55));
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: blendc(RED, CYAN, ck),
                        glow: 0.55, on: blinkOn(t, 0.53, T0) });
    // ④ 8 段 25° 弧错峰合拢，闭合瞬间全环白闪 2 帧
    const rs = 1.0 + 0.04 * easeInQuad(phase(t, 148.46, T1));
    const R = 64.0 * rs;
    const closed = t >= 148.16 + 7 * 0.045 + 0.06;
    for (let s = 0; s < 8; s++) {
      const ts = 148.16 + s * 0.045;
      const p = easeOutCubic(phase(t, ts, ts + 0.06));
      if (p <= 0.0) continue;
      const a0 = s * 45.0 + 2.0;
      c.arc(CX, CY, R, a0, a0 + 25.0 * p, RED, 2.0, 1.0, 0.5);
    }
    if (closed) {
      const fk = t < 148.16 + 7 * 0.045 + 0.06 + 2.0 / 60.0 ? 1.0 : 0.0;
      c.circle(CX, CY, R, blendc(RED, ICE, fk), 2.0, 0.35 + 0.65 * fk, 0.0, 0.6);
    }
    // ⑤ 主词 240px 自右向左塌缩
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 240, 0.14, RED, {
      baseline: 0.46 * BASE_H, align: 'center', instant: true, glow: 0.85,
      collapse: [147.86, 0.026, 0.09, 0.2, 'r'],
    });
    // ⑥ 终端状态行
    statusLine(c, t, '> execute(me)', CX, CY - 36.0, ICE,
               { px: 28.0, typed: [147.86, 1.0 / 0.014], glow: 0.45 });
    if (t >= 147.86 + 12 * 0.014) {
      const fx = font('JetBrains Mono', 16.0, c.ss);
      micro(c, CX + tw(c, fx, '> execute(me)') * 0.5 + 20.0, CY - 36.0 - 12.0,
            'cmd:execute · rc:pending', GREY, 16.0, 0.7);
    }
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 12.0, strength: 0.55, grainPct: 6.0, scan: 0.03 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_142  `148.60–149.52` ｜ split：圆环展平为满宽双线 + 垂直切分线扫过
   ══════════════════════════════════════════════════════════════ */
const SHOT_142 = {
  id: 'SHOT_142', start: 148.60, end: 149.52,
  seedHex: SEEDS.SHOT_142, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_142';
    const T0 = this.start;
    const seedHex = SEEDS[sid];

    // 上镜残影：闭合圆环 2 帧
    if (t < T0 + 2.0 / 60.0) c.circle(CX, CY, 64.0, RED, 2.0, 0.10, 0.0, 0.0);
    // ① 环身卷开为水平线
    const hw = lerp(64.0, BASE_W * 0.5, easeInCubic(phase(t, T0, 148.88)));
    if (t < 148.94) {
      const ca = 1.0 - phase(t, 148.80, 148.94);
      for (let s = 0; s < 8; s++) {
        const a0 = s * 45.0 + 2.0;
        c.arc(CX, CY, 64.0, a0, a0 + 25.0 * ca, RED, 2.0, ca * 0.8, 0.4);
      }
    }
    // ② 切分线自中心向两侧扫出 → 扫过处剪断为上下双线
    const sp = easeOutExpo(phase(t, 149.06, 149.18));
    const front = 960.0 * sp;
    const splitOn = t >= 149.06;
    const wob = (t >= 149.34 && Math.trunc((t - T0) / 0.53) % 2 === 0) ? 2.0
      : (t >= 149.34 ? -2.0 : 0.0);
    const seg = 24;
    for (let k = 0; k < seg; k++) {
      const x0 = k * (BASE_W / seg);
      const x1 = x0 + BASE_W / seg;
      const xm = (x0 + x1) * 0.5;
      if (xm > CX + hw || xm < CX - hw) continue;
      const cut = splitOn && Math.abs(xm - CX) < front;
      if (cut) {
        c.line(x0, CY - 20.0 + wob, x1, CY - 20.0 + wob, RED, 2.0, 1.0, 0.45);
        c.line(x0, CY + 20.0 - wob, x1, CY + 20.0 - wob, MOOD, 2.0, 0.6, 0.35);
      } else {
        c.line(x0, CY + wob, x1, CY + wob, RED, 2.0, 1.0, 0.45);
      }
    }
    // ③ 切分线残留
    const ra = 1.0 - phase(t, 149.18, 149.34);
    if (ra > 0.01) {
      for (const sgn of [-1.0, 1.0]) {
        const x = CX + sgn * front;
        c.line(x, CY - 200.0, x, CY + 200.0, ICE, 3.0, ra, 0.7);
      }
    }
    // ④ 主词 + 状态行 + 光标
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 200, 0.13, RED, {
      baseline: 0.44 * BASE_H, align: 'center', instant: true, glow: 0.8,
      collapse: [149.06, 0.024, 0.085, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 40.0, ICE,
               { px: 28.0, typed: [148.72, 1.0 / 0.014], glow: 0.4 });
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: CYAN,
                        on: blinkOn(t, 0.53, T0 + 0.2) });
    micro(c, CX + 30.0, CY + 46.0, 'split:±20px', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.4, grainPct: 6.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_143  `149.52–150.54` ｜ grid：8×5 网格向心塌陷为 r=70 节点簇
   ══════════════════════════════════════════════════════════════ */
const SHOT_143 = {
  id: 'SHOT_143', start: 149.52, end: 150.54,
  seedHex: SEEDS.SHOT_143, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_143';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const NC = 8, NR = 5;
    const X0 = 96.0, X1 = BASE_W - 96.0, Y0 = 96.0, Y1 = BASE_H - 96.0;

    // 上镜残影：错位双线
    if (t < T0 + 2.0 / 60.0) {
      c.line(0, CY - 20, BASE_W, CY - 20, RED, 2.0, 0.10);
      c.line(0, CY + 20, BASE_W, CY + 20, MOOD, 2.0, 0.06);
    }
    // ① 网格向心塌陷
    const pts = [], mig = [];
    for (let j = 0; j <= NR; j++) {
      for (let i = 0; i <= NC; i++) {
        const x = lerp(X0, X1, i / NC);
        const y = lerp(Y0, Y1, j / NR);
        const dist = Math.hypot(x - CX, y - CY);
        const dly = dist * 0.0012;
        const p = easeInCubic(clamp01((t - (149.66 + dly)) / 0.44));
        const ux = (x - CX) / Math.max(1.0, dist), uy = (y - CY) / Math.max(1.0, dist);
        const f = 70.0 * (1.0 - (0.45 * ((i + j) % 3)) / 2.0);
        const tx = CX + ux * f, ty = CY + uy * f;
        const k = j * (NC + 1) + i;
        pts[k] = [x, y];
        mig[k] = [lerp(x, tx, p), lerp(y, ty, p)];
      }
    }
    // 线框：横向 4 次、纵向 2 次 step 展开
    const hx = steps(t, 4, 149.52, 149.66);
    const vy = steps(t, 2, 149.52, 149.62);
    for (let j = 0; j <= NR; j++) {
      if (j > (vy + 1) * 3) continue;
      const row = [];
      for (let i = 0; i <= NC; i++) row.push(mig[j * (NC + 1) + i]);
      const isEdge = (j === 0 || j === NR);
      c.polyline(row, isEdge ? RED : MOOD, 1.0, isEdge ? 0.45 : 0.6, 0.18);
    }
    for (let i = 0; i <= NC; i++) {
      if (i > (hx + 1) * 2) continue;
      const colp = [];
      for (let j = 0; j <= NR; j++) colp.push(mig[j * (NC + 1) + i]);
      const isEdge = (i === 0 || i === NC);
      c.polyline(colp, isEdge ? RED : MOOD, 1.0, isEdge ? 0.45 : 0.6, 0.18);
    }
    // 蛛丝残线
    const sa = phase(t, 150.10, 150.40) * (1.0 - phase(t, 150.44, 150.54));
    for (let k = 0; k < mig.length; k++) {
      const [x, y] = mig[k];
      if (sa > 0.01 && Math.hypot(pts[k][0] - CX, pts[k][1] - CY) > 90) {
        c.line(x, y, CX + (pts[k][0] - CX) * 0.28, CY + (pts[k][1] - CY) * 0.28,
               GREY, 1.0, sa * 0.3, 0.0);
      }
    }
    // 40 交点亮点
    for (const [x, y] of mig) c.dot(x, y, 2.0, ICE, 0.85, 0.35);

    // ② 主词 + 状态行 + 簇心光标
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 176, 0.12, RED, {
      baseline: 0.45 * BASE_H, align: 'center', instant: true, glow: 0.75,
      collapse: [150.10, 0.022, 0.08, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 48.0, ICE,
               { px: 28.0, typed: [149.68, 1.0 / 0.014], glow: 0.4 });
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: CYAN,
                        on: (t >= 150.40 || blinkOn(t, 0.53, T0)) });
    micro(c, 96.0, BASE_H - 96.0 - 30.0, 'grid:8×5 · collapse', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 10.0, strength: 0.45, grainPct: 6.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_144  `150.54–151.52` ｜ tri：三枚异色三角三方楔入 → 合成锁定三角框
   ══════════════════════════════════════════════════════════════ */
const SHOT_144 = {
  id: 'SHOT_144', start: 150.54, end: 151.52,
  seedHex: SEEDS.SHOT_144, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_144';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    // 边长 300 的等边三角外接圆
    const FINAL_R = 300.0 / Math.sqrt(3.0);
    const START = [[CX, -0.20 * BASE_H], [-0.18 * BASE_W, 0.78 * BASE_H],
                   [1.18 * BASE_W, 0.78 * BASE_H]];
    const COLS = [RED, MOOD, BV];
    const ROTS = [180.0, 60.0, -60.0];

    if (t < T0 + 2.0 / 60.0) {
      for (let k = 0; k < 40; k++) {
        const r = new Rng(seedFromHex(seedHex), 'clusterprev', k);
        c.dot(CX + r.range(-70, 70), CY + r.range(-70, 70), 2.0, ICE, 0.10, 0.0);
      }
    }
    // 三枚三角楔入
    const merged = t >= 151.04;
    const ck = steps(t, 3, 151.04, 151.16);
    for (let j = 0; j < 3; j++) {
      const ps = clamp01((t - (T0 + j * 0.03)) / 0.50);
      let p = easeOutQuart(ps);
      if (t >= 151.04) p = easeOutCubic(clamp01((151.04 - (T0 + j * 0.03)) / 0.50));
      const [sx0, sy0] = START[j];
      const cx = lerp(sx0, CX, p), cy = lerp(sy0, CY, p);
      const r = lerp(340.0 / Math.sqrt(3.0), FINAL_R,
                     easeOutCubic(clamp01((t - T0) / 0.50)));
      const tri = P.regularPolygon(3, [cx / BASE_W, cy / BASE_H], r / BASE_W, ROTS[j]);
      const col = blendc(COLS[j], MOOD, merged ? ck : 0.0);
      const al = (t < 151.04 || j === 0) ? 1.0 : (1.0 - phase(t, 151.04, 151.20));
      if (p <= 0.0 && t < T0 + j * 0.03) continue;
      c.poly(tri, col, 3.0, al, 0.0, 0.4);
      for (const [vx, vy] of tri) c.dot(vx, vy, 3.0, ICE, al * 0.9, 0.5);
    }
    // ① 40 亮点：塌陷簇 → 三角内切圆 r=90 巡行
    const kk = easeInOutCubic(phase(t, T0, 151.04));
    for (let k = 0; k < 40; k++) {
      const rr = new Rng(seedFromHex(seedHex), 'inscribed', k);
      const ang = (2 * Math.PI * k) / 40.0 + t * 0.4;
      const tx = CX + 90.0 * Math.cos(ang), ty = CY + 90.0 * Math.sin(ang);
      const ux = CX + rr.range(-70, 70) * 0.35, uy = CY + rr.range(-70, 70) * 0.35;
      c.dot(lerp(ux, tx, kk), lerp(uy, ty, kk), 2.0, ICE, 0.9, 0.45);
    }
    if (merged && t < 151.04 + 2.0 / 60.0) c.flash(ICE, 0.25);
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 160, 0.12, RED, {
      baseline: 0.45 * BASE_H, align: 'center', instant: true, glow: 0.75,
      collapse: [151.04, 0.020, 0.075, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - FINAL_R - 30.0, ICE,
               { px: 28.0, typed: [150.68, 1.0 / 0.014], glow: 0.4 });
    const lock = 1.0 - 0.04 * easeInQuad(phase(t, 151.34, T1));
    cursor(c, CX, CY, { w: CURSOR_W * lock, h: CURSOR_H * lock, color: CYAN, glow: 0.5 });
    micro(c, CX + 200.0, CY + 150.0, 'tri:lock · 3axis', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 9.0, strength: 0.42, grainPct: 6.0, scan: 0.015 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_145  `151.52–152.60` ｜ burst：640 粒子径向爆散 → 急减速悬浮 → 引力回拉
   ══════════════════════════════════════════════════════════════ */
const SHOT_145 = {
  id: 'SHOT_145', start: 151.5200, end: 152.2800,
  seedHex: SEEDS.SHOT_145, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_145';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const N = 640;

    // 上镜残影：合成三角框
    if (t < T0 + 2.0 / 60.0) {
      const tri = P.regularPolygon(3, [0.5, 0.5], (288.0 / Math.sqrt(3.0)) / BASE_W, 0.0);
      c.poly(tri, MOOD, 2.5, 0.10, 0.0);
    }
    const pe = easeOutQuint(phase(t, T0, T0 + 0.30));
    const pull = 60.0 * easeInOutCubic(phase(t, 152.04, 152.20));
    const pulse = t >= 152.20 ? 1.02 : 1.0;
    for (let i = 0; i < N; i++) {
      const r = new Rng(seedFromHex(seedHex), 'burst', i);
      const ang = r.range(0, Math.PI * 2);
      const R0 = r.range(80.0, 380.0);
      const col = i < 269 ? RED : (i < 480 ? MOOD : ICE);
      const rad = Math.max(0.0, (R0 * pe - pull) * pulse);
      const drift = 0.6 * Math.max(0.0, t - T0 - 0.30);
      const x = CX + Math.cos(ang) * (rad + drift);
      const y = CY + Math.sin(ang) * (rad + drift);
      const a = 1.0 - 0.35 * phase(t, T1 - 0.06, T1);
      if (Math.abs(x - CX) > 1000 || Math.abs(y - CY) > 620) continue;
      c.dot(x, y, 2.0, col, a, 0.35);
    }
    // 光标 + 3 圈引力涟漪
    for (let k = 0; k < 3; k++) {
      const pr = phase(t, 152.04 + k * 0.06, 152.04 + k * 0.06 + 0.30);
      if (pr > 0.0 && pr < 1.0) {
        c.circle(CX, CY, lerp(20.0, 200.0, easeOutQuad(pr)), CYAN, 1.0,
                 (1.0 - pr) * 0.6, 0.0, 0.3);
      }
    }
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 148, 0.11, RED, {
      baseline: 0.42 * BASE_H, align: 'center', instant: true, glow: 0.8,
      collapse: [151.86, 0.018, 0.07, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 70.0, ICE,
               { px: 28.0, typed: [151.62, 1.0 / 0.014], glow: 0.4 });
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: CYAN, glow: 0.6 });
    micro(c, CX + 26.0, CY + 44.0, 'burst:640', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 9.0, strength: 0.42, grainPct: 6.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_146  `152.60–153.54` ｜ spiral：双阿基米德螺线卷绕收紧为 r=24 螺旋核
   ══════════════════════════════════════════════════════════════ */
const SHOT_146 = {
  id: 'SHOT_146', start: 152.2800, end: 153.1600,
  seedHex: SEEDS.SHOT_146, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_146';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    const N = 640;

    // 上镜残影：悬浮粒子环带
    if (t < T0 + 2.0 / 60.0) {
      for (let i = 0; i < 160; i++) {
        const r = new Rng(seedFromHex(seedHex), 'prev', i);
        const ang = r.range(0, Math.PI * 2);
        const rad = r.range(80, 380);
        c.dot(CX + Math.cos(ang) * rad, CY + Math.sin(ang) * rad, 2.0, ICE, 0.10, 0.0);
      }
    }
    const entry = easeOutCubic(phase(t, T0, T0 + 0.12));
    const wind = 1.0 - 0.62 * easeInOutCubic(phase(t, 152.40, 152.86));
    const prerot = rad(12.0) * easeInQuad(phase(t, 153.08, T1));
    for (let i = 0; i < N; i++) {
      const r = new Rng(seedFromHex(seedHex), 'spiral', i);
      const s = i % 2;
      const k = Math.trunc(i / 2);
      const th0 = (k / (N / 2.0 - 1.0)) * 6.5 * Math.PI;
      const th = th0 * wind + prerot * (1.0 + 0.2 * s);
      const rad2 = 24.0 + 3.2 * th;
      const u = th / (6.5 * Math.PI);
      const x1 = CX + Math.cos(th) * rad2;
      const y1 = CY + Math.sin(th) * rad2;
      const x0 = CX + Math.cos(th * 0.35) * lerp(80.0, 380.0, r.next());
      const y0 = CY + Math.sin(th * 0.35) * lerp(80.0, 380.0, r.next());
      let col = s === 0 ? MOOD : BV;
      let a = 1.0;
      if (i < 51) {          // 8% 红粒子：边滑边灭
        col = RED;
        a = 1.0 - phase(t, 152.40 + (i % 9) * 0.07, 152.55 + (i % 9) * 0.07);
      }
      if (a <= 0.01) continue;
      if (u > 0.92) a *= 0.4;
      c.dot(lerp(x0, x1, entry), lerp(y0, y1, entry), 2.0, col, a, 0.4);
    }
    c.circle(CX, CY, 24.0, MOOD, 1.5, 0.7, 0.0, 0.5);
    c.circle(CX, CY, 24.0, BV, 1.0, 0.5, 0.0, 0.3);
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 140, 0.11, MOOD, {
      baseline: 0.42 * BASE_H, align: 'center', instant: true, glow: 0.7,
      collapse: [152.76, 0.018, 0.07, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 44.0, ICE,
               { px: 28.0, typed: [152.40, 1.0 / 0.014], glow: 0.4 });
    cursor(c, CX, CY, { w: 6.0, h: 14.0, color: CYAN,
                        on: (steps(t, 2, 152.86, 152.92) % 2 === 0 || t > 152.92), glow: 0.6 });
    micro(c, CX + 40.0, CY + 40.0, 'spiral:dual · wind', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.4, grainPct: 5.0, scan: 0.01 });
  },
};

/** 7 级阶梯几何：返回 `{pts, treads}`（折线点列 + 各级踏面）。落地含 1 帧 3px 反弹。 */
function stairsGeo(t, fallT0 = 153.26, per = 0.055, dur = 0.16, prep = 0.0) {
  const W_ = 170.0, H_ = 52.0;
  const x0 = (BASE_W - 7 * W_) * 0.5;
  const y0 = 0.404 * BASE_H - prep;
  const pts = [], treads = [];
  for (let k = 0; k < 7; k++) {
    const p = easeInQuad(phase(t, fallT0 + k * per, fallT0 + k * per + dur));
    let dy = (1.0 - p) * -40.0;
    if (p >= 1.0 && (t - (fallT0 + k * per + dur)) < 1.0 / 60.0) dy = 3.0;
    const xk = x0 + k * W_, yk = y0 + k * H_ + dy;
    const xk1 = xk + W_, yk1 = y0 + (k + 1) * H_ + dy;
    treads.push([xk, yk, xk1, yk1]);
    if (k === 0) pts.push([xk, yk]);
    pts.push([xk1, yk]);
    pts.push([xk1, yk1]);
  }
  return { pts, treads };
}

/* ══════════════════════════════════════════════════════════════
   SHOT_147  `153.1600–153.9800` ｜ stairs：螺旋核展开为 7 级阶梯逐级下坠
   ══════════════════════════════════════════════════════════════ */
const SHOT_147 = {
  id: 'SHOT_147', start: 153.1600, end: 153.9800,
  seedHex: SEEDS.SHOT_147, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_147';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.circle(CX, CY, 24.0, MOOD, 1.5, 0.10, 0.0, 0.0);

    const ex = easeOutExpo(phase(t, T0, 153.26));
    const { pts, treads } = stairsGeo(t, 153.26, 0.055, 0.16, (1.0 - ex) * 40.0);
    c.polyline(pts, BV, 2.0, 1.0, 0.35);
    for (const [xa, ya, xb] of treads) {
      const hl = 0.6 * (0.5 + 0.5 * (steps(t, 7, 153.62, 153.90) / 6.0));
      c.line(xa, ya, xb, ya, ICE, 1.0, hl, t >= 153.62 ? 0.35 : 0.0);
    }
    // 12 颗螺核余粒沿踏面滑向最低台阶右端
    const last = treads[treads.length - 1];
    const xa = last[0], ya = last[1], xb = last[2];
    const sp = easeOutCubic(phase(t, 153.62, 153.90));
    for (let i = 0; i < 12; i++) {
      const r = new Rng(seedFromHex(seedHex), 'residue', i);
      const sx0 = lerp(xa, xb, r.next());
      const sx1 = lerp(xa, xb, 0.5 + 0.5 * (1.0 - 0.02 * i));
      const x = lerp(sx0, sx1, sp);
      const a = 1.0 - phase(t, 153.86, 153.94);
      if (a > 0.01) c.dot(x, ya - 3.0 - 3.0 * r.next(), 2.0, MOOD, a, 0.4);
    }
    const sink = 2.0 * easeInQuad(phase(t, 153.90, T1));
    c.rect(xa, ya + sink, xb, ya + 4.0 + sink, BV, 0.0, 1.0, 0.25);

    mainWord(c, t, 'EXECUTION', 'Inter Bold', 132, 0.10, BV, {
      baseline: 0.44 * BASE_H, align: 'center', instant: true, glow: 0.7,
      collapse: [153.62, 0.016, 0.065, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', xb - 40.0, ya - 36.0, ICE,
               { px: 28.0, typed: [153.28, 1.0 / 0.014], glow: 0.4, align: 'left' });
    cursor(c, xb - 8.0, ya + 2.0 + sink, { w: CURSOR_W, h: CURSOR_H, color: CYAN,
                                           on: blinkOn(t, 0.53, T0) });
    micro(c, 96.0, BASE_H - 130.0, 'stairs:7 · fall', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.35, grainPct: 5.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_148  `153.9800–155.2000` ｜ mirror：y=50% 镜面两次整屏翻转 + 菱形幻象
   ══════════════════════════════════════════════════════════════ */
const SHOT_148 = {
  id: 'SHOT_148', start: 153.9800, end: 155.2000,
  seedHex: SEEDS.SHOT_148, chapter: CHAPTER, status: 'EXEC',
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
    const sid = 'SHOT_148';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.polyline(stairsGeo(t, -9.0).pts, BV, 2.0, 0.10);

    // 翻转相位
    let fl;
    if (t < 154.24) fl = easeInOutCubic(phase(t, T0, 154.24));
    else if (t < 154.50) fl = 1.0;
    else fl = 1.0 - easeInOutCubic(phase(t, 154.50, 154.75));
    const cc = Math.cos(Math.PI * fl);

    c.line(0, CY, BASE_W, CY, CYAN, 1.0, 0.6, 0.35);
    for (let k = 0; k < 5; k++) {
      c.dot(lerp(BASE_W * 0.2, BASE_W * 0.8, k / 4.0), CY, 2.0, CYAN, 0.6, 0.3);
    }
    const { pts, treads } = stairsGeo(t, -9.0);
    for (const sgn of [1.0, -1.0]) {
      const al = Math.abs(cc) > 0.99 ? 1.0 : 0.55;
      const my = (y) => CY + (y - CY) * cc * sgn;
      c.polyline(pts.map(([x, y]) => [x, my(y)]), BV, 2.0, al, 0.3 * al);
      for (const [xa, ya, xb] of treads) c.line(xa, my(ya), xb, my(ya), ICE, 1.0, 0.55 * al, 0.2);
      if (sgn < 0) {
        for (let k = 0; k < 3; k++) {
          c.dot(lerp(pts[0][0], pts[pts.length - 1][0], 0.3 + 0.2 * k),
                my(pts[pts.length - 1][1]), 2.0, ICE, 0.4 * al, 0.2);
        }
      }
    }
    // 菱形幻象幽灵框
    const gk = Math.max(0.0, 1.0 - Math.abs(cc) * 6.0);
    if (gk > 0.01) {
      c.poly([[pts[0][0], CY - 40 * gk], [pts[pts.length - 1][0], CY - 40 * gk],
              [pts[pts.length - 1][0], CY + 40 * gk], [pts[0][0], CY + 40 * gk]],
             BV, 2.0, 0.6 * gk, 0.0, 0.3);
    }
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 140, 0.10, BV, {
      baseline: 0.40 * BASE_H, align: 'center', instant: true, glow: 0.7,
      collapse: [154.10, 0.016, 0.065, 0.2, 'r'],
    });
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 124, 0.10, CYAN, {
      baseline: 0.62 * BASE_H, align: 'center', glow: 0.7,
      tIn: 154.90, stagger: 0.010, rise: 6.0,
      collapse: [155.00, 0.016, 0.065, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 60.0 * Math.abs(cc), ICE,
               { px: 28.0, typed: [154.12, 1.0 / 0.014], glow: 0.4 });
    // 光标：翻转期双份，回正合并后沿踏面滑至中段
    const slide = easeOutCubic(phase(t, 154.90, 155.10));
    const last = treads[treads.length - 1];
    const ya2 = last[1], xb2 = last[2];
    if (fl > 0.02 && fl < 0.98) {
      cursor(c, xb2 - 8.0, CY + (ya2 + 2.0 - CY) * cc, { w: 10.0, h: 20.0, color: CYAN, glow: 0.4 });
      cursor(c, xb2 - 8.0, CY - (ya2 + 2.0 - CY) * cc, { w: 10.0, h: 20.0, color: CYAN, glow: 0.4 });
    } else {
      cursor(c, lerp(xb2 - 8.0, BASE_W * 0.46, slide),
             lerp(ya2 + 2.0, 0.58 * BASE_H, slide), { w: 10.0, h: 20.0, color: CYAN, glow: 0.5 });
    }
    const ra = 1.0 - phase(t, 155.00, 155.20);
    if (ra > 0.01) c.line(CX - BASE_W * 0.2, CY, CX + BASE_W * 0.2, CY, CYAN, 1.0, 0.6 * ra, 0.35);
    micro(c, 96.0, BASE_H - 130.0, 'mirror:y50 · flip×2', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXEC', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.4, grainPct: 5.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_149  `155.2000–156.0800` ｜ clamp：两枚方框夹取 → 88×88 纯几何禁闭
   ══════════════════════════════════════════════════════════════ */
const SHOT_149 = {
  id: 'SHOT_149', start: 155.2000, end: 156.0800,
  seedHex: SEEDS.SHOT_149, chapter: CHAPTER, status: 'LOCK',
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
    const sid = 'SHOT_149';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.polyline(stairsGeo(t, -9.0).pts, BV, 2.0, 0.10);

    // ① 阶梯降为 25% 背景线稿
    const pa = 0.25 * (1.0 - phase(t, T1 - 0.10, T1));
    c.polyline(stairsGeo(t, -9.0).pts, BV, 1.5, pa, 0.0);
    // ② 两枚 120×120 夹框相向滑入
    const p = easeOutQuart(phase(t, T0, 155.78));
    const gap = lerp(BASE_W * 0.65, 44.0, p);
    for (const sgn of [-1.0, 1.0]) {
      const cx = CX + sgn * gap;
      const bx0 = cx - 60.0, bx1 = cx + 60.0;
      c.line(sgn < 0 ? bx0 : bx1, CY - 60.0, sgn < 0 ? bx0 : bx1, CY + 60.0,
             CYAN, 2.5, 1.0, 0.5);
      for (const s2 of [-1.0, 1.0]) {
        c.line(bx0 + (sgn < 0 ? 0.0 : 40.0), CY + s2 * 60.0,
               bx0 + (sgn < 0 ? 20.0 : 60.0), CY + s2 * 60.0, CYAN, 2.5, 1.0, 0.5);
      }
    }
    if (t >= 155.78) {
      const fl = t < 155.78 + 2.0 / 60.0 ? 1.0 : 0.0;
      if (fl > 0.0) c.flash(ICE, 0.28);
      const br = 1.0 + 0.1 * Math.sin((2 * Math.PI * (t - 155.78)) / 1.1);
      c.rect(CX - 44.0, CY - 44.0, CX + 44.0, CY + 44.0, CYAN, 2.5 * br, 1.0, 0.0, 0.55);
      for (let k = 0; k < 4; k++) {
        const kp = phase(t, 155.78 + k * 0.045, 155.78 + k * 0.045 + 0.05);
        if (kp > 0.0) {
          const x = CX + (k % 2 ? 44.0 : -44.0);
          const y = CY + (k < 2 ? 44.0 : -44.0);
          c.dot(x, y, 3.0, ICE, Math.min(1.0, kp * 2), 0.6);
        }
      }
    }
    // ③ 主词 + 状态行 + 被压回框心的光标
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 116, 0.10, CYAN, {
      baseline: 0.42 * BASE_H, align: 'center', instant: true, glow: 0.7,
      collapse: [155.62, 0.014, 0.06, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 44.0 - 34.0, ICE,
               { px: 28.0, typed: [155.34, 1.0 / 0.014], glow: 0.4 });
    const cxp = lerp(BASE_W * 0.46, CX, easeInOutCubic(phase(t, T0, 155.78)));
    const cyp = lerp(0.58 * BASE_H, CY, easeInOutCubic(phase(t, T0, 155.78)));
    const lock = 1.0 + 0.03 * easeOutBack(phase(t, 155.96, T1));
    cursor(c, cxp, cyp, { w: CURSOR_W * lock, h: CURSOR_H * lock, color: CYAN,
                          on: (t >= 155.96 || blinkOn(t, 0.53, T0)) });
    micro(c, CX + 70.0, CY + 70.0, 'clamp:88px · sealed', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'LOCK', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.42, grainPct: 5.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_150  `156.0800–157.0400` ｜ wave（死刑=抹平）：满宽复合正弦被锋线逐段压直
   ══════════════════════════════════════════════════════════════ */
const SHOT_150 = {
  id: 'SHOT_150', start: 156.0800, end: 157.0400,
  seedHex: SEEDS.SHOT_150, chapter: CHAPTER, status: 'FLAT',
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
    const sid = 'SHOT_150';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.rect(CX - 44.0, CY - 44.0, CX + 44.0, CY + 44.0, CYAN, 2.5, 0.10);

    // 通道拉伸
    const ch = easeOutExpo(phase(t, T0, T0 + 0.12));
    const half = lerp(44.0, BASE_W * 0.5, ch);
    c.line(CX - half, CY - 44.0, CX + half, CY - 44.0, CYAN, 1.0, 0.25, 0.1);
    c.line(CX - half, CY + 44.0, CX + half, CY + 44.0, CYAN, 1.0, 0.25, 0.1);

    // 抹平锋线
    const fp = easeInOutQuad(phase(t, 156.20, 156.82));
    const front = fp * BASE_W;
    const wave = [];
    for (let i = 0; i < 384; i++) {
      const x = (i / 383.0) * BASE_W;
      const behind = clamp01((front - x) / 180.0);
      const amp = 1.0 - behind;
      const y = CY + amp * (40.0 * Math.sin(2 * Math.PI * (1.6 * (t - T0) + x / 1200.0))
              + 14.0 * Math.sin(2 * Math.PI * 4.7 * (t - T0) + x / 380.0 + 0.7));
      wave.push([x, y]);
    }
    c.polyline(wave, CYAN, 2.5, 1.0, 0.5);
    if (fp > 0.0 && fp < 1.0) c.line(front, CY - 120.0, front, CY + 120.0, ICE, 2.0, 1.0, 0.8);
    if (t >= 156.94) c.line(0, CY, BASE_W, CY, CYAN, 2.5, 1.0, 0.5);
    // 4 枚角刻度
    for (let k = 0; k < 4; k++) {
      if (t >= 156.62 + k * 0.04) {
        const x = lerp(BASE_W * 0.2, BASE_W * 0.8, k / 3.0);
        c.line(x, CY - 6.0, x, CY + 6.0, ICE, 2.0, 0.9, 0.5);
      }
    }
    // 光标随锋线
    const cx = lerp(front, BASE_W * 0.92, phase(t, 156.82, 156.94));
    const cy = CY - 60.0 * (1.0 - phase(t, 156.82, 156.94));
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 108, 0.09, CYAN, {
      baseline: 0.40 * BASE_H, align: 'center', instant: true, glow: 0.75,
      collapse: [156.62, 0.014, 0.06, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - 42.0, ICE,
               { px: 28.0, typed: [156.22, 1.0 / 0.014], glow: 0.4 });
    cursor(c, cx, cy, { w: CURSOR_W, h: CURSOR_H, color: CYAN, glow: 0.6 });
    micro(c, 96.0, CY + 96.0, 'wave:1.6Hz · flatten', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'FLAT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 8.0, strength: 0.5, grainPct: 5.0, scan: 0.02 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_151  `157.0400–158.0000` ｜ reticle（死刑=瞄准）：十字准星 + 四向刻度 + 准星环
   ══════════════════════════════════════════════════════════════ */
const SHOT_151 = {
  id: 'SHOT_151', start: 157.0400, end: 158.0000,
  seedHex: SEEDS.SHOT_151, chapter: CHAPTER, status: 'AIM',
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
    const sid = 'SHOT_151';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) c.line(0, CY, BASE_W, CY, CYAN, 2.5, 0.10);

    // ① 水平轴 + 垂直轴
    c.line(0, CY, BASE_W, CY, ICE, 1.0, 0.7, 0.3);
    const hv = 380.0 * easeOutExpo(phase(t, T0, T0 + 0.38));
    c.line(CX, CY - hv, CX, CY + hv, CYAN, 1.0, 1.0, 0.45);
    // ② 四向刻度
    for (const sgn of [-1.0, 1.0]) {
      for (let k = 1; k < 13; k++) {
        const d = k * 40.0;
        if (d > hv) continue;
        if (!(t >= 157.16 + k * 0.03)) continue;
        const near = k <= 3;
        const L = near ? 14.0 : 8.0;
        const col = near ? CYAN : GREY;
        c.line(CX + sgn * d, CY - L * 0.5, CX + sgn * d, CY + L * 0.5, col, 1.0,
               near ? 0.9 : 0.6, near ? 0.4 : 0.0);
        c.line(CX - L * 0.5, CY + sgn * d, CX + L * 0.5, CY + sgn * d, col, 1.0,
               near ? 0.9 : 0.6, near ? 0.4 : 0.0);
      }
    }
    // ③ 准星环：r=0→48 easeOutBack + 4 缺口 + 900ms 周期微旋
    const rp = easeOutBack(phase(t, 157.60, 157.88));
    const R = 48.0 * clamp01(rp);
    const rot = 4.0 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - T0)) / 0.9));
    if (t >= 157.60) {
      for (let k = 0; k < 4; k++) {
        const a0 = rot + k * 90.0 + 4.0;
        c.arc(CX, CY, R, a0, a0 + 82.0, CYAN, 1.5, 1.0, 0.5);
      }
    }
    const focus = 1.0 + 0.015 * easeOutQuad(phase(t, 157.88, T1));
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 100, 0.09, ICE, {
      baseline: 0.36 * BASE_H, align: 'center', instant: true, glow: 0.7,
      collapse: [157.60, 0.012, 0.055, 0.2, 'r'],
    });
    statusLine(c, t, '> execute(me)', CX, CY - R - 40.0, ICE,
               { px: 28.0, typed: [157.16, 1.0 / 0.014], glow: 0.4 });
    cursor(c, CX, CY, { w: CURSOR_W * focus, h: CURSOR_H * focus, color: ICE, glow: 0.6 });
    micro(c, CX + 70.0, CY + 70.0, 'reticle:lock · ±0', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid), 'AIM', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 7.0, strength: 0.42, grainPct: 5.0, scan: 0.015 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_152  `158.0000–158.9000` ｜ flyby（12 连击终击）：24 枚碎片掠过镜头飞出
   ══════════════════════════════════════════════════════════════ */
const SHOT_152 = {
  id: 'SHOT_152', start: 158.0000, end: 158.9000,
  seedHex: SEEDS.SHOT_152, chapter: CHAPTER, status: 'EXIT',
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
    const sid = 'SHOT_152';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    // 准星残影
    if (t < T0 + 2.0 / 60.0) {
      c.line(0, CY, BASE_W, CY, ICE, 1.0, 0.10);
      c.circle(CX, CY, 48.0, CYAN, 1.5, 0.10, 0.0, 0.0);
    }
    // 24 枚碎片：沿自身径向 900px/s 起飞并 scale→3.2
    for (let i = 0; i < 24; i++) {
      const r = new Rng(seedFromHex(seedHex), 'shard', i);
      const stag = i * 0.008 + r.range(0.0, 0.03);
      const tau = t - T0 - stag;
      if (tau <= 0.0) continue;
      let seg, col;
      if (i < 12) {                                    // 轴线段
        const ang = r.range(0, Math.PI * 2);
        const rad0 = r.range(40.0, 140.0), ln = r.range(60.0, 160.0);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        seg = [[CX + ux * rad0 - uy * ln * 0.5, CY + uy * rad0 + ux * ln * 0.5],
               [CX + ux * rad0 + uy * ln * 0.5, CY + uy * rad0 - ux * ln * 0.5]];
        col = i % 2 === 0 ? ICE : CYAN;
      } else if (i < 20) {                             // 准星环弧段
        const ang = r.range(0, Math.PI * 2);
        seg = [[CX + Math.cos(ang + 0.30) * 48.0, CY + Math.sin(ang + 0.30) * 48.0],
               [CX + Math.cos(ang - 0.30) * 48.0, CY + Math.sin(ang - 0.30) * 48.0]];
        col = CYAN;
      } else {                                         // 刻度组合
        const ang = r.range(0, Math.PI * 2);
        const ox = CX + Math.cos(ang) * 120.0, oy = CY + Math.sin(ang) * 120.0;
        seg = [[ox, oy - 6.0], [ox, oy + 6.0]];
        col = ICE;
      }
      const mx0 = (seg[0][0] + seg[1][0]) * 0.5;
      const my0 = (seg[0][1] + seg[1][1]) * 0.5;
      let ux = mx0 - CX, uy = my0 - CY;
      const n = Math.hypot(ux, uy) || 1.0;
      ux /= n; uy /= n;
      const rad = 900.0 * tau + 300.0 * tau * tau;
      const sc = 1.0 + 2.2 * easeInQuad(clamp01(tau / 0.6));
      const a = 1.0 - clamp01((rad - 700.0) / 450.0);
      if (a <= 0.01) continue;
      const pts = seg.map(([x, y]) => [x + ux * rad + (x - mx0) * (sc - 1.0),
                                       y + uy * rad + (y - my0) * (sc - 1.0)]);
      c.polyline(pts, col, Math.max(1.0, 1.5 * sc), a, 0.3 * a);
    }
    // 光标纹丝不动 + 状态行参数逐字删除
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: ICE,
                        on: (t < 158.62 ? blinkOn(t, 0.53, T0)
                                        : (steps(t, 2, 158.86, 158.94) % 2 === 0)) });
    const cmd = '> execute(me)';
    if (t < 158.62) {
      statusLine(c, t, cmd, CX, CY - 40.0, ICE, { px: 28.0, typed: [T0, 1.0 / 0.014], glow: 0.4 });
    } else {
      const n = cmd.length - Math.trunc((t - 158.62) / 0.045) - 1;
      statusLine(c, t, cmd.slice(0, Math.max(1, n)), CX, CY - 40.0, ICE,
                 { px: 28.0, glow: 0.4 });
    }
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 92, 0.08, ICE, {
      baseline: 0.36 * BASE_H, align: 'center', instant: true, glow: 0.6,
      collapse: [158.46, 0.010, 0.05, 0.2, 'r'],
    });
    micro(c, CX + 26.0, CY + 44.0, 'exit:pending', GREY, 16.0, 0.6);
    cornerInfo(c, sid, T0, blInfo(sid), 'EXIT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 6.0, strength: 0.45, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_153  `158.9000–159.3200` ｜ EIN：18 条水平扫描切片 + 主扫描线自下而上显影
   ══════════════════════════════════════════════════════════════ */
const SHOT_153 = {
  id: 'SHOT_153', start: 158.9000, end: 159.3200,
  seedHex: SEEDS.SHOT_153, chapter: CHAPTER, status: 'COUNT',
  lyric: 'EIN / 一',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_153';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) {
      c.text(CX + 6.0, CY + 20.0, '>', font('JetBrains Mono', 28.0, c.ss), ICE, 0.10);
    }
    const f = font('Inter Bold', 200, c.ss);
    const off = 1.0 + f.stroke;
    const mw = f.getlength('EIN') + 0.16 * 200 * 2 + off * 2;
    const mh = f.asc + f.desc + off * 2;
    const ox = CX - (mw / c.ss) * 0.5;
    const oy = 0.5 * BASE_H - (mh / c.ss) * 0.5;
    // 垂直参考线（唯一环境元素）
    c.line(CX, oy, CX, oy + mh / c.ss, GREY, 1.0, 0.3);
    // 主扫描线：自 y=68% 上扫至 32%
    const sy = lerp(0.68 * BASE_H, 0.32 * BASE_H, easeOutQuad(phase(t, 158.96, 159.22)));
    const written = t >= 158.96;
    const NS = 18;
    for (let k = 0; k < NS; k++) {
      const y0 = Math.trunc((mh * k) / NS);
      const ybase = oy + y0 / c.ss;
      const above = sy <= ybase + 0.5;
      let a = above ? (t >= 159.24 ? 0.70 : 0.90) : 0.20;
      if (!written) a = 0.20;
      // 每个条带 = 一行切片；文本始终画在整词落点（oy+asc），靠裁剪区露条
      const band = maskBand('EIN', f, {
        textY: oy + f.asc / c.ss,
        cy0: ybase,
        cy1: ybase + mh / NS / c.ss + 0.5,
      });
      c.paste_mask(band, ox, ybase, ICE, a, 0.3 * a);
    }
    if (written && t >= 158.96 && t < 159.24) {
      c.line(0, sy, BASE_W, sy, CYAN, 3.0, 1.0, 0.8);
    } else if (t >= 159.24 && t < 159.24 + 2.0 / 60.0) {
      c.line(0, sy, BASE_W, sy, CYAN, 3.0, 0.5, 0.4);
    }
    // 光标 + 双闪
    cursor(c, ox + mw / c.ss + 20.0, oy + mh / c.ss - 14.0, {
      color: ICE, on: (steps(t, 2, 159.22, 159.30) % 2 === 0 || t > 159.30), glow: 0.6 });
    micro(c, CX - 20.0, oy + mh / c.ss + 40.0, 'n:1 · de', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:1'), 'COUNT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.28, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_154  `159.3200–159.6600` ｜ DOS：中央垂直缝裂成左右两块、反向平移后合并
   ══════════════════════════════════════════════════════════════ */
const SHOT_154 = {
  id: 'SHOT_154', start: 159.3200, end: 159.6600,
  seedHex: SEEDS.SHOT_154, chapter: CHAPTER, status: 'COUNT',
  lyric: 'DOS / 二',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_154';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) {
      c.text(CX - 60.0, 0.44 * BASE_H, 'EIN', font('Inter Bold', 200, c.ss), ICE, 0.06);
    }
    const f = font('Inter Bold', 200, c.ss);
    const off = 1.0 + f.stroke;
    const mw = f.getlength('DOS') + 0.14 * 200 * 2 + off * 2;
    const mh = f.asc + f.desc + off * 2;
    const ox = CX - (mw / c.ss) * 0.5;
    const oy = 0.5 * BASE_H - (mh / c.ss) * 0.5;
    const halfW = mw / c.ss * 0.5;
    // 裂开 → 停驻 → 合并
    let sep = 40.0 * easeOutQuart(phase(t, T0, T0 + 0.06));
    if (t >= 159.52) sep = 40.0 * (1.0 - easeInOutCubic(phase(t, 159.52, 159.62)));
    // 左块：整词画在 ox-sep，裁剪区限左半（右缘随 sep 内移）
    const bandL = maskBand('DOS', f, {
      textY: oy + f.asc / c.ss,
      cy0: oy,
      cy1: oy + mh / c.ss,
      cx0: ox - 2000,
      cx1: CX - sep,
    });
    c.paste_mask(bandL, ox - sep, oy, ICE, 1.0, 0.35);
    // 右块：整词画在 ox+sep，裁剪区限右半（左缘随 sep 内移）
    const bandR = maskBand('DOS', f, {
      textY: oy + f.asc / c.ss,
      cy0: oy,
      cy1: oy + mh / c.ss,
      cx0: CX + sep,
      cx1: ox + 2000,
    });
    c.paste_mask(bandR, ox + sep, oy, ICE, 1.0, 0.35);
    // 分割缝 + 对称刻度
    if (t < 159.62) {
      c.line(CX, oy, CX, oy + mh / c.ss, CYAN, 1.0,
             1.0 - 0.6 * phase(t, 159.52, 159.62), 0.5);
    }
    for (const sgn of [-1.0, 1.0]) {
      c.dot(CX + sgn * (halfW + sep + 24.0), CY, 2.0, GREY, 0.8, 0.2);
    }
    if (t >= 159.60 && t < 159.62) c.flash(ICE, 0.20);
    // 光标合并后跳至字形正上方 36px
    cursor(c, CX, oy - 36.0 + 14.0, { color: ICE,
           on: (t > 159.52 && blinkOn(t, 0.53, T0)), glow: 0.6 });
    micro(c, CX - 30.0, oy + mh / c.ss + 40.0, 'n:2 · es', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:2'), 'COUNT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.35, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_155  `159.6600–160.2400` ｜ TROIS：T/R/OIS 三段字形锚定等边三角三顶点
   ══════════════════════════════════════════════════════════════ */
const SHOT_155 = {
  id: 'SHOT_155', start: 159.6600, end: 160.2400,
  seedHex: SEEDS.SHOT_155, chapter: CHAPTER, status: 'COUNT',
  lyric: 'TROIS / 三',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_155';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    const R = 200.0;
    const cyc = 0.54 * BASE_H;
    const verts = [[CX, cyc - R],
                   [CX - R * Math.cos(rad(30)), cyc + R * 0.5],
                   [CX + R * Math.cos(rad(30)), cyc + R * 0.5]];
    if (t < T0 + 2.0 / 60.0) {
      for (const [vx, vy] of verts) c.dot(vx, vy, 4.0, ICE, 0.10, 0.0);
    }
    // 三段字形（各 25ms 错峰 easeOutBack 微弹落位）
    const groups = [['T', 0], ['R', 1], ['OIS', 2]];
    const f88 = font('Inter Bold', 88, c.ss);
    for (let gi = 0; gi < groups.length; gi++) {
      const s = groups[gi][0], vi = groups[gi][1];
      const p = easeOutBack(phase(t, T0 + gi * 0.025, T0 + gi * 0.025 + 0.10));
      const vx = verts[vi][0], vy = verts[vi][1];
      const w = tw(c, f88, s);
      const asc = f88.asc / c.ss;
      c.text(vx - w * 0.5, vy - asc * 0.5, s, f88, ICE, clamp01(p * 1.4), 0.35);
    }
    for (const [vx, vy] of verts) c.dot(vx, vy, 4.0, ICE, 0.95, 0.6);
    // 三条边线 70ms 错峰
    for (let ei = 0; ei < 3; ei++) {
      const p = easeOutExpo(phase(t, 159.74 + ei * 0.07, 159.74 + ei * 0.07 + 0.22));
      if (p <= 0.0) continue;
      const a = verts[ei], b = verts[(ei + 1) % 3];
      c.line(a[0], a[1], lerp(a[0], b[0], p), lerp(a[1], b[1], p), CYAN, 2.0, 1.0, 0.4);
    }
    c.circle(CX, cyc, 100.0, GREY, 1.0, 0.25 * phase(t, T0, T0 + 0.25), 0.0, 0.0);
    cursor(c, CX, cyc, { w: CURSOR_W, h: CURSOR_H, color: CYAN,
                         on: (t >= 160.04 || blinkOn(t, 0.53, T0)), glow: 0.5 });
    micro(c, CX - 30.0, cyc + R + 36.0, 'n:3 · fr', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:3'), 'COUNT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.32, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_156  `160.2400–160.6900` ｜ NE：十字四臂自 220px 收缩至 90px
   ══════════════════════════════════════════════════════════════ */
const SHOT_156 = {
  id: 'SHOT_156', start: 160.2400, end: 160.6900,
  seedHex: SEEDS.SHOT_156, chapter: CHAPTER, status: 'COUNT',
  lyric: 'NE / 四',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_156';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) {
      const tri = P.regularPolygon(3, [0.5, 0.54], 200.0 / BASE_W, 0.0);
      c.poly(tri, CYAN, 2.0, 0.10, 0.0);
    }
    const grow = easeOutExpo(phase(t, T0, T0 + 0.06));
    const shrink = easeInQuart(phase(t, 160.30, 160.62));
    const reb = 8.0 * easeOutBack(phase(t, 160.62, 160.67));
    const L = lerp(220.0 * grow, 90.0, shrink) + reb;
    for (const sgn of [[-1.0, 0.0], [1.0, 0.0], [0.0, -1.0], [0.0, 1.0]]) {
      const ex = CX + sgn[0] * L, ey = CY + sgn[1] * L;
      c.line(CX, CY, ex, ey, CYAN, 2.0, 1.0, 0.4);
      c.dot(ex, ey, 3.0, ICE, 0.95, 0.6);
    }
    // NE 字形（收缩期按有效字号重排，锚点随动）
    const pxE = 176.0 * (1.0 + 0.06 * shrink);
    mainWord(c, t, 'NE', 'Inter Bold', pxE, 0.12, ICE, {
      baseline: CY + pxE * 0.36, align: 'center', instant: true, glow: 0.4,
    });
    c.rect(CX - 6.0, CY - 6.0, CX + 6.0, CY + 6.0, ICE, 1.5, 0.95, 0.0, 0.5);
    cursor(c, CX, CY, { w: 8.0, h: 16.0, color: CYAN, glow: 0.5 });
    micro(c, CX - 30.0, CY + 120.0, 'n:4 · ko', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:4'), 'COUNT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.32, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_157  `160.6900–161.1200` ｜ FEM：正五边形连同顶点亮点旋转 72°
   ══════════════════════════════════════════════════════════════ */
const SHOT_157 = {
  id: 'SHOT_157', start: 160.6900, end: 161.1200,
  seedHex: SEEDS.SHOT_157, chapter: CHAPTER, status: 'COUNT',
  lyric: 'FEM / 五',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_157';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) {
      for (const sgn of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        c.line(CX, CY, CX + sgn[0] * 90.0, CY + sgn[1] * 90.0, CYAN, 2.0, 0.10);
      }
    }
    const rot = 72.0 * easeOutQuart(phase(t, 160.75, 161.05));
    const poly = P.regularPolygon(5, [0.5, 0.5], 150.0 / BASE_W, -90.0 + rot);
    c.poly(poly, CYAN, 2.0, 1.0, 0.0, 0.45);
    for (const [vx, vy] of poly) {
      c.dot(vx, vy, 3.0, ICE, 0.95, 0.6);
      const ang = Math.atan2(vy - CY, vx - CX);
      c.line(vx - Math.cos(ang) * 6.0, vy - Math.sin(ang) * 6.0, vx, vy, ICE, 1.0, 0.4, 0.2);
    }
    for (let k = 0; k < 5; k++) {
      const a = poly[k], b = poly[(k + 2) % 5];
      c.line(a[0], a[1], b[0], b[1], GREY, 1.0, 0.30 * phase(t, 160.75, 161.05), 0.0);
    }
    const sway = 2.0 * Math.sin((2 * Math.PI * (t - T0)) / 0.43)
               * (1.0 - phase(t, 161.05, 161.10));
    mainWord(c, t, 'FEM', 'Inter Bold', 156, 0.12, ICE, {
      baseline: CY + 156 * 0.36, align: 'center', x: CX + sway, instant: true, glow: 0.4,
    });
    const flashp = (t >= 161.05 && t < 161.05 + 1.0 / 60.0) ? 1.0 : 0.0;
    for (const [vx, vy] of poly) c.dot(vx, vy, 3.0 + 2.0 * flashp, ICE, 0.95, 0.7);
    cursor(c, CX + 90.0, CY + 80.0, { color: ICE, on: blinkOn(t, 0.53, T0), glow: 0.5 });
    micro(c, CX - 30.0, CY + 150.0, 'n:5 · sv', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:5'), 'COUNT', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 5.0, strength: 0.32, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_158  `161.1200–161.5800` ｜ LIU：六边形扫描框自 r=260 收缩锁定至 r=120
   ══════════════════════════════════════════════════════════════ */
const SHOT_158 = {
  id: 'SHOT_158', start: 161.1200, end: 161.5800,
  seedHex: SEEDS.SHOT_158, chapter: CHAPTER, status: 'LOCK',
  lyric: 'LIU / 六',
  _b: null,

  _init(beats) {
    if (this._b) return this._b;
    this._b = beatStore(beats);
    return this._b;
  },

  draw(ctx, gctx, t, dpr, beats) {
    this._init(beats);
    const c = new Canvas(ctx, gctx, dpr, BG_DEEP, beats);
    const sid = 'SHOT_158';
    const T0 = this.start;
    const seedHex = SEEDS[sid];
    if (t < T0 + 2.0 / 60.0) {
      const poly = P.regularPolygon(5, [0.5, 0.5], 150.0 / BASE_W, -90.0 + 72.0);
      c.poly(poly, CYAN, 2.0, 0.10, 0.0);
    }
    const p = easeInExpo(phase(t, 161.18, 161.46));
    const R = lerp(260.0, 120.0, p);
    for (let g = 0; g < 3; g++) {
      const gp = clamp01(p - g * 0.12);
      if (gp <= 0.0) continue;
      const gr = lerp(260.0, 120.0, gp);
      const ph = P.regularPolygon(6, [0.5, 0.5], gr / BASE_W, -90.0);
      c.poly(ph, CYAN, 1.0, 0.15 * (1.0 - phase(t, 161.46, 161.58)), 0.0, 0.1);
    }
    const hexa = P.regularPolygon(6, [0.5, 0.5], R / BASE_W, -90.0);
    const lock = t >= 161.46;
    c.poly(hexa, CYAN, 2.5, 1.0, 0.0, lock ? 0.5 : 0.35);
    for (let k = 0; k < hexa.length; k++) {
      const vx = hexa[k][0], vy = hexa[k][1];
      c.dot(vx, vy, 3.0, ICE, 1.0, 0.65);
      const mx = (vx + hexa[(k + 1) % 6][0]) * 0.5;
      const my = (vy + hexa[(k + 1) % 6][1]) * 0.5;
      c.line(mx, my - 2.0, mx, my + 2.0, GREY, 1.0, 0.6);
    }
    if (t >= 161.46 && t < 161.46 + 1.0 / 60.0) {
      c.circle(CX, CY, 120.0, ICE, 1.0, 1.0, 0.0, 0.7);
    }
    const pulse = 1.0 + 0.05 * Math.sin(Math.PI * clamp01((t - 161.46) / 0.08));
    const pxE = 148.0 * pulse;
    mainWord(c, t, 'LIU', 'Inter Bold', pxE, 0.12, ICE, {
      baseline: CY + pxE * 0.36, align: 'center', instant: true, glow: 0.45,
    });
    cursor(c, CX + 100.0, CY + 30.0, { color: ICE, on: blinkOn(t, 0.53, T0), glow: 0.5 });
    micro(c, CX - 30.0, CY + 150.0, 'n:6 · zh', GREY, 16.0, 0.7);
    cornerInfo(c, sid, T0, blInfo(sid, 'n:6'), 'LOCK', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 6.0, strength: 0.5, grainPct: 4.0, scan: 0.01 });
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_159  `161.5800–162.6300` ｜ dissolve：标题塌缩→命令删除→仅存中心种子光标
   ══════════════════════════════════════════════════════════════ */
const SHOT_159 = {
  id: 'SHOT_159', start: 161.5800, end: 162.6300,
  seedHex: SEEDS.SHOT_159, chapter: CHAPTER, status: 'DONE',
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
    const sid = 'SHOT_159';
    const T0 = this.start, T1 = this.end;
    const seedHex = SEEDS[sid];
    // 六边形幽灵框 8% 淡出
    const ga = 0.08 * (1.0 - phase(t, T0, T0 + 0.15));
    if (ga > 0.005) {
      const hexa = P.regularPolygon(6, [0.5, 0.5], 120.0 / BASE_W, -90.0);
      c.poly(hexa, CYAN, 1.0, ga, 0.0);
    }
    mainWord(c, t, 'EXECUTION', 'Inter Bold', 96, 0.08, ICE, {
      baseline: 0.48 * BASE_H, align: 'center', instant: true, glow: 0.55,
      collapse: [161.88, 0.012, 0.05, 0.2, 'r'],
    });
    const cmd = '> execute(me)';
    if (t < 162.30) {
      statusLine(c, t, cmd, CX, 0.50 * BASE_H + 24.0, ICE,
                 { px: 28.0, typed: [162.10, 1.0 / 0.014], glow: 0.45 });
    } else {
      const n = cmd.length - Math.trunc((t - 162.30) / 0.040) - 1;
      statusLine(c, t, cmd.slice(0, Math.max(1, n)), CX, 0.50 * BASE_H + 24.0, ICE,
                 { px: 28.0, a: t < 162.60 ? 1.0 : Math.max(0.0, 1.0 - phase(t, 162.60, 162.63)),
                   glow: 0.45 });
    }
    let on = true;
    if (t >= 162.54 && t < 162.62) on = steps(t, 2, 162.54, 162.62) % 2 === 0;
    cursor(c, CX, CY, { w: CURSOR_W, h: CURSOR_H, color: ICE, on, glow: 0.6 });
    const ma = 1.0 - phase(t, 162.60, 162.63);
    if (ma > 0.01) micro(c, CX - 90.0, CY + 32.0 + 14.0, 'rc:0 · exit:seed', GREY, 16.0, 0.7 * ma);
    cornerInfo(c, sid, T0, blInfo(sid, 'rc:0'), 'DONE', 0.6, CHAPTER);
    return c.flush(t, seedHex, { radius: 6.0, strength: 0.45, grainPct: 4.0,
                                 scan: 0.01 * (1.0 - phase(t, 162.54, T1)) });
  },
};

export const CH08_SHOTS = [SHOT_141, SHOT_142, SHOT_143, SHOT_144, SHOT_145,
                           SHOT_146, SHOT_147, SHOT_148, SHOT_149, SHOT_150,
                           SHOT_151, SHOT_152, SHOT_153, SHOT_154, SHOT_155,
                           SHOT_156, SHOT_157, SHOT_158, SHOT_159];
export { beatStore as CH08_BEATS };
