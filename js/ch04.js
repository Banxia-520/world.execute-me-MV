/**
 * ch04.js — 第 04 章 OBJECTS / EXISTENCE（镜头 074–093）
 *
 * 自 Python 版 render/scenes/ch04_objects.py 移植。
 * 本章 Python 用的是自有 Kit API，这里用 `Kit` 适配器让移植**近乎逐行照抄**，
 * 以保证语义与 Python 版一致（适配器见 kit.js）。
 *
 * 06 硬性要求：茄子 / 番茄 / 花猫 / 唯一的神一律**抽象线框/体素/点阵，不画实物**。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, css,
  easeOutCubic, easeInOutCubic, easeOutExpo, easeOutQuad, easeInQuad, rad, mix,
} from './core.js';
import * as P from './primitives.js';
import { Kit, fontOf, pulse, beatsIn } from './kit.js';

/** 文本宽度（对应 Python 的 font.getlength） */
function textWidth(fontStr, str) {
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fontStr;
  return cv.measureText(str).width;
}

const CHAPTER = 'ch04/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_MONO_MED = 'JetBrains Mono Medium';
const FONT_SEMI = 'Inter Semi-Bold';
const FONT_BOLD = 'Inter Bold';
const FONT_XBOLD = 'Inter Extra-Bold';
const FONT_REG = 'Inter Regular';

const SEEDS = {
  SHOT_074: '0000074C', SHOT_075: '0000075D', SHOT_076: '0000076A',
  SHOT_077: '0000077B', SHOT_078: '0000078C', SHOT_079: '0000079D',
  SHOT_080: '0000080A', SHOT_081: '0000081B', SHOT_082: '0000082C',
  SHOT_083: '0000083D', SHOT_084: '0000084A', SHOT_085: '0000085B',
  SHOT_086: '0000086C', SHOT_087: '0000087D', SHOT_088: '0000088A',
  SHOT_089: '0000089B', SHOT_090: '0000090C', SHOT_091: '0000091D',
  SHOT_092: '0000092A', SHOT_093: '0000093B',
};

/* ── 补充缓动（与 Python ch04 顶部定义一致）───────────────── */
const easeInCubic = (p) => p ** 3;
const easeInQuart = (p) => p ** 4;
const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const easeInOutQuart = (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);
const easeInOutQuint = (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2);
const easeInExpo = (p) => (p <= 0 ? 0 : 2 ** (10 * (p - 1)));
const easeOutSine = (p) => Math.sin((Math.PI * p) / 2);
const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
/** 0→1→0 的对称脉冲 */
const easeBump = (p) => Math.sin(Math.PI * clamp01(p));
/** 拍点脉冲包络 0..1（sin 半周，默认 60ms） */
function beatEnv(t, times, dur = 0.06) {
  let v = 0.0;
  for (const b of times) if (b <= t && t <= b + dur) {
    v = Math.max(v, Math.sin((Math.PI * (t - b)) / dur));
  }
  return v;
}

/* ── 几何：茄子 / 番茄 / 花猫（一律抽象，不画实物）─────────── */
/** 茄子归一化半宽：u=0 蒂端（短颈）→ u=1 尖端（圆帽） */
function eggHalfwidth(u) {
  u = clamp01(u);
  const v = 1.35 * u;
  const base = Math.sqrt(Math.max(0, 1 - ((v - 0.70) / 0.72) ** 2));
  const neck = 0.30 + 0.70 * Math.min(1, v / 0.26);
  return base * neck;
}

/** 确定性体素点阵（拒绝采样），正好 n 颗 */
function eggVoxels(n, seedHex, cx, cy, rx, ry) {
  const pts = [];
  const seed = seedFromHex(seedHex);
  let k = 0;
  const limit = n * 60;
  while (pts.length < n && k < limit) {
    const r = new Rng(seed, 'egg-voxel', k);
    k++;
    const u = r.next();
    const w = r.range(-1, 1);
    if (Math.abs(w) <= eggHalfwidth(u)) pts.push([cx + w * rx, cy + (u - 0.5) * ry]);
  }
  return pts;
}

/** 两圆相交的 lens 形（重叠透镜描边） */
function lensPoints(c1, r1, c2, r2, n) {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  if (d <= 1e-6 || d >= r1 + r2 || d <= Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 <= 0) return [];
  const h = Math.sqrt(h2);
  const bx = c1[0] + (a * (c2[0] - c1[0])) / d;
  const by = c1[1] + (a * (c2[1] - c1[1])) / d;
  const ux = (c2[0] - c1[0]) / d, uy = (c2[1] - c1[1]) / d;
  const i1 = [bx - h * uy, by + h * ux];
  const i2 = [bx + h * uy, by - h * ux];
  let a1 = Math.atan2(i1[1] - c1[1], i1[0] - c1[0]);
  let a2 = Math.atan2(i2[1] - c1[1], i2[0] - c1[0]);
  if (a2 < a1) { const t = a1; a1 = a2; a2 = t; }
  const arc1 = [];
  for (let i = 0; i <= n; i++) {
    const ang = a1 + (a2 - a1) * (i / n);
    arc1.push([c1[0] + r1 * Math.cos(ang), c1[1] + r1 * Math.sin(ang)]);
  }
  let a3 = Math.atan2(i2[1] - c2[1], i2[0] - c2[0]);
  let a4 = Math.atan2(i1[1] - c2[1], i1[0] - c2[0]);
  if (a4 < a3) { const t = a3; a3 = a4; a4 = t; }
  const arc2 = [];
  for (let i = 0; i <= n; i++) {
    const ang = a3 + (a4 - a3) * (i / n);
    arc2.push([c2[0] + r2 * Math.cos(ang), c2[1] + r2 * Math.sin(ang)]);
  }
  return arc2.concat(arc1);
}

const SC = {
  beatMap: {},
  beats(id) { return this.beatMap[id] || []; },
};

const corners = (K, tl, tr, bl, br) =>
  K.micro({ TL: tl, TR: tr, BL: bl, BR: br });

/* ══════════════════════════════════════════════════════════════
   SHOT_074  `74.05–74.8172` ｜ 茄体 voxel→mesh
   ══════════════════════════════════════════════════════════════ */
const SHOT_074 = {
  id: 'SHOT_074', start: 74.05, end: 74.8172,
  seedHex: SEEDS.SHOT_074, chapter: CHAPTER, status: 'VOX',
  lyric: "If I'm an eggplant",
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_074 = beatsIn(beats, this.start, this.end);
    const ex = 0.62 * BASE_W, ey = 0.52 * BASE_H;
    const rx = 0.11 * BASE_W, ry = 0.56 * BASE_H;
    // 1150 体素只依赖 seed 与几何，预计算一次
    const vox = eggVoxels(1150, SEEDS.SHOT_074, ex, ey, rx, ry);
    const lit = vox.filter((p) => p[0] <= ex + rx * 0.15);
    const shad = vox.filter((p) => p[0] > ex + rx * 0.15);
    const spine = P.curvePoints('bezier', 90, 0, {
      p0: [ex, ey - ry * 0.5], p1: [ex - rx * 0.45, ey - ry * 0.1],
      p2: [ex + rx * 0.18, ey + ry * 0.5],
    });
    // 320 三角面位置（确定性）
    const seed = seedFromHex(SEEDS.SHOT_074);
    const tris = [];
    for (let i = 0; i < 320; i++) {
      const rr = new Rng(seed, 'tri', i);
      const u = rr.next(), w = rr.range(-1, 1);
      const hw = eggHalfwidth(u);
      if (Math.abs(w) > hw) continue;
      const bx = ex + w * rx, by = ey + (u - 0.5) * ry;
      const s = 16.0;
      tris.push([0, 2.094, 4.189].map((a) => [bx + s * Math.cos(a + i), by + s * Math.sin(a + i)]));
    }
    this._c = { ex, ey, rx, ry, vox, lit, shad, spine, tris };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { ex, ey, rx, ry } = c;

    const p1 = easeOutExpo(phase(t, 74.05, 74.24));
    const p2 = easeOutQuad(phase(t, 74.24, 74.46));
    const p3 = easeOutCubic(phase(t, 74.46, 74.66));
    const nVox = t < 74.24
      ? Math.floor(lerp(4, 400, p1))
      : Math.floor(lerp(400, 1150, p2));

    // 体素点阵（按当前数量截取）
    const take = Math.min(nVox, 1150);
    const litNow = [], shadNow = [];
    let ci = 0;
    for (let i = 0; i < c.vox.length && ci < take; i++) {
      const p = c.vox[i];
      if (p[0] <= ex + rx * 0.15) litNow.push(p); else shadNow.push(p);
      ci++;
    }
    K.dots(litNow, 5.0, BV, 0.95, 0.36);
    K.dots(shadNow, 5.0, MOOD, 0.90, 0.36);

    // 主脊贝塞尔 + 9 关节
    if (t >= 74.24) {
      const q = easeOutQuad(phase(t, 74.24, 74.46));
      const m = Math.max(2, Math.floor(c.spine.length * clamp01(q)));
      K.seg(c.spine.slice(0, m), CYAN, 2.5, 1.0, 0.40);
      for (let i = 0; i < 9; i++) {
        const j = Math.floor((c.spine.length * (i + 0.5)) / 9);
        if (j < m) K.disc(c.spine[j], 4.0, CYAN, 0.9, 0.35);
      }
    }

    // 320 个三角面（6 批依附）
    if (t >= 74.46) {
      const batch = 6;
      const done = Math.floor(clamp01(phase(t, 74.46, 74.66)) * batch + 1e-9);
      const nTri = Math.floor(320 * Math.min(1.0, done / batch));
      for (let i = 0; i < Math.min(nTri, c.tris.length); i++) {
        K.poly(c.tris[i], ICE, 1.0, 0.30 * p3, 0.24, true);
      }
    }

    // 星形蒂：5 根短线交于 (62%, 24%)
    const cyx = 0.62 * BASE_W, cyy = 0.24 * BASE_H;
    const rot = t >= 74.66 ? (18.0 * easeOutCubic(phase(t, 74.66, 74.82)) * Math.PI) / 180 : 0;
    for (let i = 0; i < 5; i++) {
      const a = rot + (2 * Math.PI * i) / 5 - Math.PI / 2;
      const e = [cyx + 46 * Math.cos(a), cyy + 30 * Math.sin(a) + 40];
      K.lineSeg([cyx, cyy], e, CYAN, 1.5, 0.95, 0.30);
      K.disc(e, 3.0, CYAN, 0.95, 0.30);
    }
    K.ring([cyx, cyy], 4.0, CYAN, 1.5, 0.9, 0.30);

    // 三段构建进度条（VOXEL→CURVE→MESH）
    const bx = 0.075 * BASE_W;
    const by0 = 0.30 * BASE_H, by1 = 0.60 * BASE_H;
    const segH = (by1 - by0) / 3;
    const fills = [
      clamp01(phase(t, 74.05, 74.24)),
      clamp01(phase(t, 74.24, 74.46)),
      clamp01(phase(t, 74.46, 74.66)),
    ];
    const names = ['VOXEL', 'CURVE', 'MESH'];
    for (let i = 0; i < 3; i++) {
      const y0 = by0 + segH * i;
      K.lineSeg([bx, y0], [bx, y0 + segH - 6], GREY, 6.0, 0.5);
      if (fills[i] > 0) {
        K.lineSeg([bx, y0 + (segH - 6) * (1 - fills[i])], [bx, y0 + segH - 6], CYAN, 6.0, 0.95, 0.30);
      }
      K.textKit(FONT_MONO, 42, names[i], 0.012 * BASE_W, y0 + segH * 0.62,
             fills[i] > 0 ? CYAN : GREY, 0, fills[i] > 0 ? 0.9 : 0.55);
    }

    // 主词两行
    K.word_block(FONT_SEMI, 168, ["If I'm an", 'eggplant'], 0.10 * BASE_W,
                 [0.28 * BASE_H, 0.46 * BASE_H], 0.04, 74.66, t,
                 { per_char: 0.014,
                   accents: [[["If I'm an", ICE]], [['eggplant', BV]]] });

    corners(K, 'T+74.05s', CHAPTER, `seed:${SEEDS.SHOT_074} · vox:1150`, 'VOX');
    return { bloomR: 8.0, bloomK: 0.36 + beatEnv(t, SC.beats('SHOT_074'), 0.06), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_075  `74.8172–75.42` ｜ 词形轮廓采样 → 点云茄 + 8 营养节点
   ══════════════════════════════════════════════════════════════ */
const SHOT_075 = {
  id: 'SHOT_075', start: 74.8172, end: 75.42,
  seedHex: SEEDS.SHOT_075, chapter: CHAPTER, status: 'MORPH',
  lyric: "If I'm an eggplant",
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_075 = beatsIn(beats, this.start, this.end);
    const ex = 0.62 * BASE_W, ey = 0.52 * BASE_H;
    const rx = 0.11 * BASE_W, ry = 0.56 * BASE_H;
    const vox = eggVoxels(1150, SEEDS.SHOT_074, ex, ey, rx, ry);   // 继承 074 的体素
    const spine = P.curvePoints('bezier', 90, 0, {
      p0: [ex, ey - ry * 0.5], p1: [ex - rx * 0.45, ey - ry * 0.1],
      p2: [ex + rx * 0.18, ey + ry * 0.5],
    });
    this._c = { ex, ey, rx, ry, vox, spine, extra: null, target: null };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { ex, ey, rx, ry } = c;

    const p1 = phase(t, 74.8172, 74.96);
    const p2 = phase(t, 74.96, 75.18);
    const p3 = easeInOutCubic(phase(t, 75.18, 75.34));

    // ① 采样网格 4×3 闪现 steps(2)
    if ((p1 < 1.0 && steps(t, 2, 74.8172, 74.96) % 2 === 0) || (t >= 74.8172 && t <= 74.90)) {
      const gx0 = 0.10 * BASE_W, gy0 = 0.14 * BASE_H;
      const gx1 = 0.50 * BASE_W, gy1 = 0.50 * BASE_H;
      for (let i = 0; i < 4; i++) {
        const yy = lerp(gy0, gy1, i / 3);
        K.lineSeg([gx0, yy], [gx1, yy], GREY, 1.0, 0.30, 0);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4);
        K.lineSeg([xx, gy0], [xx, gy1], GREY, 1.0, 0.30, 0);
      }
    }

    // ② 茄体体素 → 2px 粒子（补足到 6400 点后吸附回茄形）
    const solidA = 0.55 * (1 - clamp01(p2));
    if (solidA > 0.02) {
      const lit = c.vox.filter((p) => p[0] <= ex + rx * 0.15);
      const shad = c.vox.filter((p) => p[0] > ex + rx * 0.15);
      K.dots(lit, 5.0, BV, solidA, 0.30);
      K.dots(shad, 5.0, MOOD, solidA, 0.30);
    }
    const nPart = Math.floor(lerp(1150, 6400, clamp01(p2)));
    let cloud = c.vox.slice(0, Math.min(nPart, 1150));
    if (nPart > 1150) {
      if (!c.extra) {
        c.extra = P.cloudPoints(Math.min(nPart - 1150, 4000), SEEDS.SHOT_075,
                                'word-sample', 'rect', [0.30, 0.32], 0.22, 0.5);
      }
      cloud = cloud.concat(c.extra.slice(0, nPart - 1150));
    }
    let cur = cloud;
    if (t >= 74.96) {
      if (!c.target || c.target.length !== cloud.length) {
        c.target = eggVoxels(cloud.length, SEEDS.SHOT_075, ex, ey, rx * 1.02, ry * 1.02);
      }
      const mo = 0.70;
      cur = cloud.map((p, i) => {
        const q = c.target[i] || p;
        return [lerp(p[0], q[0], p3) * mo + p[0] * (1 - mo), lerp(p[1], q[1], p3)];
      });
    }
    K.dots(cur, 2.0, BV, 0.85, 0.36);
    K.dots(cur.filter((_, i) => i % 3 === 0), 2.0, ICE, 0.40, 0.20);

    // ③ 主脊骨架完整保留
    K.seg(c.spine, CYAN, 2.5, 1.0 + 0.20 * clamp01(phase(t, 75.34, 75.42)), 0.40);
    for (let i = 0; i < 9; i++) {
      const j = Math.floor((c.spine.length * (i + 0.5)) / 9);
      K.disc(c.spine[j], 4.0, CYAN, 0.9, 0.35);
    }

    // ④ 8 枚营养节点（吸附完成时点亮）
    if (t >= 75.34) {
      for (let i = 0; i < 8; i++) {
        const j = Math.min(Math.floor((c.spine.length * (i + 0.5)) / 8), c.spine.length - 1);
        K.disc(c.spine[j], 6.0, WARM, 1.0, 0.5);
      }
    }

    // 主词：74.96 前逐字入场，之后 2 帧内溶为粒子
    if (t < 74.96) {
      K.word_block(FONT_SEMI, 168, ["If I'm an", 'eggplant'], 0.10 * BASE_W,
                   [0.28 * BASE_H, 0.46 * BASE_H], 0.04, 74.74, t,
                   { per_char: 0.014,
                     accents: [[["If I'm an", ICE]], [['eggplant', BV]]] });
    } else {
      const fade = 1.0 - clamp01(phase(t, 74.9933, 75.0333));
      if (fade > 0.01) {
        K.word_block(FONT_SEMI, 168, ["If I'm an", 'eggplant'], 0.10 * BASE_W,
                     [0.28 * BASE_H, 0.46 * BASE_H], 0.04, 74.60, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fade,
                       accents: [[["If I'm an", ICE]], [['eggplant', BV]]] });
      }
    }

    corners(K, 'T+74.82s', CHAPTER,
            `seed:${SEEDS.SHOT_075} · sample:4px · 6400pt`, 'MORPH');
    return { bloomR: 8.0, bloomK: 0.36 + beatEnv(t, SC.beats('SHOT_075'), 0.06), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_076  `75.42–76.16` ｜ 两空心球 + 重叠透镜 + 8 营养节点
   ══════════════════════════════════════════════════════════════ */
const SHOT_076 = {
  id: 'SHOT_076', start: 75.42, end: 76.2824,
  seedHex: SEEDS.SHOT_076, chapter: CHAPTER, status: 'GIVE',
  lyric: 'Then I will give you my',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_076 = beatsIn(beats, this.start, this.end);
    const A = [0.38 * BASE_W, 0.56 * BASE_H];
    const Bc = [0.60 * BASE_W, 0.46 * BASE_H];
    const src = eggVoxels(6400, SEEDS.SHOT_075, 0.62 * BASE_W, 0.52 * BASE_H,
                          0.11 * BASE_W, 0.56 * BASE_H);
    const tgtA = P.cloudPoints(3900, SEEDS.SHOT_076, 'sinkA', 'disk', [0.38, 0.56], 120 / BASE_W, 1);
    const tgtB = P.cloudPoints(2500, SEEDS.SHOT_076, 'sinkB', 'disk', [0.60, 0.46], 96 / BASE_W, 1);
    this._c = { A, Bc, src, tgtA, tgtB, tgt: tgtA.concat(tgtB) };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { A, Bc } = c;

    const p1 = phase(t, 75.42, 75.60);
    const p2 = easeInOutCubic(phase(t, 75.60, 76.00));
    const p3 = phase(t, 76.00, 76.16);

    // 粒子从茄体沉入两球
    const n = Math.min(c.src.length, c.tgt.length);
    const cur = [];
    for (let i = 0; i < n; i++) {
      cur.push([lerp(c.src[i][0], c.tgt[i][0], p2), lerp(c.src[i][1], c.tgt[i][1], p2)]);
    }
    if (t < 76.16) K.dots(cur, 2.0, GREY, 0.55, 0.20);
    K.dots(c.tgtA, 2.0, CYAN, 0.40 + 0.2 * p2, 0.30);
    K.dots(c.tgtB, 2.0, MOOD, 0.40 + 0.2 * p2, 0.30);

    // 双球描边（自顶点向两侧补全）
    const q = easeOutExpo(phase(t, 75.60, 76.00));
    K.ring(A, 120.0, CYAN, 2.0, 0.95, 0.40, -90, -90 + 360 * q);
    K.ring(Bc, 96.0, MOOD, 2.0, 0.95, 0.40, -90, -90 + 360 * q);

    // 重叠透镜
    if (t >= 76.00) {
      const lens = lensPoints(A, 120, Bc, 96, 40);
      if (lens.length) {
        K.poly(lens, ICE, 1.0, 0.30 + 0.5 * p3, 0.30, true, ICE, 0.10 * p3);
      }
    }

    // 连心线（虚线）
    K.dash(A, Bc, GREY, 1.5, 0.55, 8, 6);

    // 8 枚营养节点落于球 A 圆周 8 等分点
    const spin = (30.0 * clamp01(phase(t, 76.00, 76.16)) * Math.PI) / 180;
    for (let i = 0; i < 8; i++) {
      const a = spin + (2 * Math.PI * i) / 8;
      const p = [A[0] + 120 * Math.cos(a), A[1] + 120 * Math.sin(a)];
      if (t < 75.60) K.disc(p, 6.0, WARM, 1.0, 0.5);
      else if (t < 76.00) K.disc(p, 6.0, GREY, 0.8, 0.15);
      else K.disc(p, 6.0, WARM, 1.0, 0.5);
    }

    // 主词两行
    K.word_block(FONT_SEMI, 168, ['Then I will', 'give you my'], 0.10 * BASE_W,
                 [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 76.16, t,
                 { per_char: 0.013,
                   accents: [[['Then I will', ICE]],
                             [['give you', CYAN], [' my', ICE]]] });
    corners(K, 'T+75.42s', CHAPTER,
            `seed:${SEEDS.SHOT_076} · cloud:6400pt`, 'GIVE');
    K.textKit(FONT_MONO, 44, 'giving:1 → 2', 0.50 * BASE_W, 0.63 * BASE_H - 16,
           GREY, 0, 0.7, 'center');
    return { bloomR: 8.0, bloomK: 0.36 + beatEnv(t, SC.beats('SHOT_076'), 0.06), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_077  `76.2824–76.96` ｜ 双球点云重组为 14 节点分子簇
   ══════════════════════════════════════════════════════════════ */
const SHOT_077 = {
  id: 'SHOT_077', start: 76.2824, end: 76.96,
  seedHex: SEEDS.SHOT_077, chapter: CHAPTER, status: 'BOND',
  lyric: 'Then I will give you my',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_077 = beatsIn(beats, this.start, this.end);
    const seed = SEEDS.SHOT_077;
    const nodes = P.nodeGraphLayout(14, seed, 'mol', [0.50, 0.54], 0.13);
    const cloud = P.cloudPoints(3600, seed, 'eco', 'rect', [0.30, 0.30], 0.23, 0.55);
    this._c = { nodes, cloud };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = [0.50 * BASE_W, 0.54 * BASE_H];
    const p1 = easeOutQuad(phase(t, 76.2824, 76.42));
    const p2 = easeInOutCubic(phase(t, 76.42, 76.64));
    const p3 = easeOutQuad(phase(t, 76.64, 76.84));
    const p4 = easeOutCubic(phase(t, 76.84, 76.96));
    const A = [0.38 * BASE_W, 0.56 * BASE_H];
    const Bc = [0.60 * BASE_W, 0.46 * BASE_H];

    // 双球底纹
    if (p1 < 1.0) {
      K.ring(A, 120 + 8 * p1, CYAN, 1.5, 0.15 * (1 - p1) + 0.15, 0.10);
      K.ring(Bc, 96 + 8 * p1, MOOD, 1.5, 0.15, 0.10);
    }

    const bonds = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10], [6, 11],
                   [7, 12], [8, 13], [9, 11], [10, 12], [11, 13], [0, 13]];

    // 主词采样点沿键线铺入
    if (t >= 76.42) {
      const moved = [];
      for (let i = 0; i < c.cloud.length; i++) {
        const k = clamp01(p2 * 1.2 - (i % 17) * 0.01);
        const tgt = c.nodes[i % 14];
        moved.push([lerp(c.cloud[i][0], tgt[0], k), lerp(c.cloud[i][1], tgt[1], k)]);
      }
      K.dots(moved, 2.0, ICE, 0.35, 0.20);
    }

    // 键线 13 条（逐条描出）
    const nBond = Math.floor(bonds.length * clamp01(p3) + 1e-9);
    for (let k = 0; k < bonds.length; k++) {
      if (k > nBond) continue;
      const [a, b] = bonds[k];
      const f2 = k < nBond ? 1.0 : (clamp01(p3) * bonds.length) % 1.0;
      const x1 = lerp(c.nodes[a][0], c.nodes[b][0], f2);
      const y1 = lerp(c.nodes[a][1], c.nodes[b][1], f2);
      K.lineSeg(c.nodes[a], [x1, y1], BV, 1.5, 0.85, 0.34);
    }
    for (let i = 0; i < 14; i++) K.ring(c.nodes[i], 6.0, CYAN, 1.5, 0.95, 0.30);

    if (t >= 76.64) {
      const sc = easeOutCubic(phase(t, 76.64, 76.84));
      K.disc(C, 10.0 * sc, WARM, 1.0, 0.46);
      K.ring(C, 16.0 * sc, WARM, 1.0, 0.6, 0.30);
    }

    // 主词（76.42 前完整，之后淡出为粒子）
    const LINES = ['Then I will', 'give you my'];
    const ACC = [[['Then I will', ICE]], [['give you', CYAN], [' my', ICE]]];
    if (t < 76.42) {
      K.word_block(FONT_SEMI, 168, LINES, 0.10 * BASE_W,
                   [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 76.17, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACC });
    } else {
      const fade = 1 - clamp01(phase(t, 76.42, 76.50));
      if (fade > 0.01) {
        K.word_block(FONT_SEMI, 168, LINES, 0.10 * BASE_W,
                     [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 76.17, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fade, accents: ACC });
      }
    }
    if (t >= 76.72) {
      const a = 0.5 * clamp01(phase(t, 76.72, 76.84));
      K.textKit(FONT_MONO, 44, 'formula:C₂₇H₄₆O', 0.62 * BASE_W, 0.76 * BASE_H, GREY, 0, a);
    }
    K.micro({ TL: 'T+76.28s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_077} · nodes:14 · bonds:13`, BR: 'BOND' });
    return { bloomR: 8.0, bloomK: 0.36, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_078  `76.96–77.68` ｜ 分子爆炸 → 8 个营养标签 + 640 粒子汇入容器
   ══════════════════════════════════════════════════════════════ */
const SHOT_078 = {
  id: 'SHOT_078', start: 76.96, end: 77.58,
  seedHex: SEEDS.SHOT_078, chapter: CHAPTER, status: 'MIX',
  lyric: 'Then I will give you my',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_078 = beatsIn(beats, this.start, this.end);
    const seed = SEEDS.SHOT_078;
    const cloud = P.cloudPoints(640, seed, 'pour', 'disk', [0.50, 0.30], 0.16, 1);
    this._c = { cloud };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = [0.50 * BASE_W, 0.48 * BASE_H];
    const p1 = easeInQuad(phase(t, 76.96, 77.10));
    const p2 = easeOutExpo(phase(t, 77.10, 77.32));
    const p3 = easeInOutCubic(phase(t, 77.32, 77.50));
    const sc = 1.0 - 0.06 * p1;

    // ① 爆炸前的 14 节点环 + 13 键线 + 核心
    if (t < 77.10) {
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const a = (2 * Math.PI * i) / 14;
        pts.push([C[0] + 120 * sc * Math.cos(a), C[1] + 86 * sc * Math.sin(a)]);
      }
      for (const p of pts) K.ring(p, 6.0 * sc, CYAN, 1.5, 0.9, 0.30);
      for (let i = 0; i < 13; i++) {
        K.lineSeg(pts[i], pts[(i + 1) % 14], BV, 1.5, 0.8, 0.30);
      }
      K.disc(C, 10.0 * sc, WARM, 1.0, 0.46);
    }

    // ② 8 个营养标签块，沿容器外缘 8 等分环收拢
    const labels = ['VIT-C', 'K', 'MG', 'ZN', 'B6', 'FE', 'NA', 'SE'];
    const cont = [0.70 * BASE_W, 0.64 * BASE_H];
    const cw = 260, chh = 320;
    for (let i = 0; i < labels.length; i++) {
      const a = (2 * Math.PI * i) / 8 - Math.PI / 2;
      const appear = clamp01(phase(t, 77.10 + i * 0.02, 77.24 + i * 0.02));
      if (appear <= 0) continue;
      const rad = 300 * (1 - p3) + 250 * p3;
      const px = C[0] + rad * Math.cos(a) * (1 - p3) + (cont[0] + 250 * Math.cos(a) - C[0]) * p3;
      const py = C[1] + rad * Math.sin(a) * 0.7 * (1 - p3) + (cont[1] + 250 * Math.sin(a) * 0.7 - C[1]) * p3;
      const f2 = fontOf(FONT_MONO, 42, dpr);
      K.ctx.save();
      K.ctx.font = f2.font;
      const tw = K.ctx.measureText(labels[i]).width / dpr;
      K.ctx.restore();
      K.poly([[px - 62, py - 26], [px + 62, py - 26], [px + 62, py + 26], [px - 62, py + 26]],
             CYAN, 1.5, 0.9 * appear, 0.3, true);
      K.textKit(FONT_MONO, 42, labels[i], px - tw / 2, py + 14, ICE, 0.95 * appear, 0);
    }

    // ③ 透明容器（液位 42%）+ 640 颗粒子汇入
    const box = [cont[0] - cw / 2, cont[1] - chh / 2, cont[0] + cw / 2, cont[1] + chh / 2];
    K.poly([[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]],
           GREY, 1.5, 0.55, 0);
    const level = box[3] - chh * 0.42 * clamp01(phase(t, 77.32, 77.62));
    if (level < box[3]) {
      K.ctx.save();
      K.ctx.globalAlpha = 0.18;
      K.ctx.fillStyle = css(CYAN);
      K.ctx.fillRect(box[0] * dpr, level * dpr, (box[2] - box[0]) * dpr, (box[3] - level) * dpr);
      K.ctx.restore();
    }
    // 粒子自上方汇入液面
    const stream = [];
    for (let i = 0; i < c.cloud.length; i++) {
      const q = c.cloud[i];
      const k = clamp01(p2 * 1.1 - (i % 13) * 0.02);
      stream.push([lerp(q[0], box[0] + (i % 17) * 12, k),
                   lerp(q[1], level + (i % 7) * 3, k)]);
    }
    K.dots(stream, 2.0, CYAN, 0.75, 0.30);

    // 主词
    K.word_block(FONT_SEMI, 168, ['Then I will', 'give you my'], 0.10 * BASE_W,
                 [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 76.96, t,
                 { per_char: 0.0, char_dur: 0.001,
                   accents: [[['Then I will', ICE]], [['give you', CYAN], [' my', ICE]]] });
    K.micro({ TL: 'T+76.96s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_078} · labels:8 · pour:640`, BR: 'MIX' });
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_079  `77.58–78.5` ｜ mesh inflate：圆盘点阵充气成球 + 经纬网格 + 380 细胞
   ══════════════════════════════════════════════════════════════ */
/** 经线/纬线（抽象球体网格） */
function sphereMeshLines(cx, cy, r, nLon, nLat, squash = 1.0) {
  const out = [];
  for (let i = 0; i < nLon; i++) {
    const th = (Math.PI * i) / nLon;
    const pts = [];
    for (let j = 0; j < 25; j++) {
      const ph = (2 * Math.PI * j) / 24;
      pts.push([cx + r * Math.sin(th) * Math.cos(ph), cy + r * Math.cos(th) * squash]);
    }
    out.push(pts);
  }
  for (let j = 1; j < nLat; j++) {
    const ph = (Math.PI * j) / nLat;
    const rr = r * Math.sin(ph);
    const pts = [];
    for (let k = 0; k < 33; k++) {
      pts.push([cx + rr * Math.cos((2 * Math.PI * k) / 32), cy - r * Math.cos(ph) * squash]);
    }
    out.push(pts);
  }
  return out;
}

const SHOT_079 = {
  id: 'SHOT_079', start: 77.58, end: 78.504,
  seedHex: SEEDS.SHOT_079, chapter: CHAPTER, status: 'MESH',
  lyric: "If I'm a tomato",
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_079 = beatsIn(beats, this.start, this.end);
    const C = [0.54 * BASE_W, 0.56 * BASE_H], R = 140.0;
    const seed = SEEDS.SHOT_079;
    const dots = P.cloudPoints(640, seed, 'disc', 'disk', [0.54, 0.56], R / BASE_W, 1);
    // 380 六边形细胞的球面布点（确定性）
    const sd = seedFromHex(seed);
    const cells = [];
    for (let i = 0; i < 380; i++) {
      const rr = new Rng(sd, 'cell', i);
      const th = rr.range(0, 2 * Math.PI);
      const ph = Math.acos(1 - 2 * rr.next());
      const sc = 1.0 + 0.18 * (rr.next() - 0.5);
      cells.push([C[0] + R * Math.sin(ph) * Math.cos(th) * sc,
                  C[1] + R * Math.cos(ph), i / 380]);
    }
    this._c = { C, R, dots, cells };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R } = c;
    const p1 = easeOutQuad(phase(t, 77.58, 77.76));
    const p2 = easeOutExpo(phase(t, 77.76, 78.14));
    const p3 = phase(t, 78.14, 78.36);

    // 容器残影
    if (p1 < 1.0) {
      const cont = [0.70 * BASE_W, 0.64 * BASE_H];
      K.rectCenter(cont[0], cont[1], 260, 320, GREY, 1.5, 0.9 * (1 - p1), 0.10, 8);
      K.textKit(FONT_MONO, 42, 'intake:42%', cont[0] - 130, cont[1] + 160 + 34,
             GREY, 0, 0.7 * (1 - p1));
    }

    // 圆盘点阵 → 球（垂直压扁随 p2 恢复）
    const flat = 1.0 - 0.55 * clamp01(p2);
    const dots = c.dots.map(([x, y]) => [x, C[1] + (y - C[1]) / Math.max(0.45, flat)]);
    K.dots(dots, 2.0, CYAN, 0.55 * (1 - p2) + 0.25, 0.25);

    if (t >= 77.76) {
      const lines = sphereMeshLines(C[0], C[1], R, 18, 24);
      const nShow = Math.floor(lines.length * clamp01(p2 * 1.5));
      for (let i = 0; i < nShow; i++) K.seg(lines[i], BV, 1.0, 0.45, 0.32);
    }

    // 380 六边形细胞（贴附球面）
    if (t >= 78.14) {
      const q = clamp01(p3);
      for (const [cx0, cy0, frac] of c.cells) {
        if (frac > q) continue;
        const cy = C[1] + (cy0 - C[1]) * (1.0 - 0.25 * (1 - q));
        const hexp = P.regularPolygon(6, [cx0 / BASE_W, cy / BASE_H], 0.011, 0);
        K.poly(hexp, CYAN, 0.8, 0.35, 0, true);
        K.disc([cx0, cy], 2.0, WARM, 0.9, 0.28);
      }
    }

    // 星形蒂
    const st = [0.54 * BASE_W, 0.30 * BASE_H];
    for (let i = 0; i < 5; i++) {
      const a = (2 * Math.PI * i) / 5 - Math.PI / 2;
      K.lineSeg(st, [st[0] + 38 * Math.cos(a), st[1] + 24 * Math.sin(a)], CYAN, 1.5, 0.9, 0.30);
    }
    K.ring(st, 5.0, CYAN, 1.5, 0.9, 0.30);

    K.textKit(FONT_MONO, 44, 'cells:380 · r:140px', C[0] + R - 40, C[1] + R + 60, GREY, 0, 0.7);
    K.word_block(FONT_SEMI, 176, ["If I'm a", 'tomato'], 0.10 * BASE_W,
                 [0.26 * BASE_H, 0.44 * BASE_H], 0.04, 78.36, t,
                 { per_char: 0.014,
                   accents: [[["If I'm a", ICE]], [['tomato', BV]]] });
    K.micro({ TL: 'T+77.58s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_079} · cells:380`, BR: 'MESH' });
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_080  `78.5–79.23` ｜ 球面剥离为 240° 球壳弧 + 空腔
   ══════════════════════════════════════════════════════════════ */
const SHOT_080 = {
  id: 'SHOT_080', start: 78.504, end: 79.23,
  seedHex: SEEDS.SHOT_080, chapter: CHAPTER, status: 'MORPH',
  lyric: "If I'm a tomato",
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_080 = beatsIn(beats, this.start, this.end);
    const S = [0.44 * BASE_W, 0.56 * BASE_H];
    const seed = SEEDS.SHOT_080;
    const src = P.cloudPoints(5680, seed, 'shell-src', 'sphere', [0.54, 0.56], 140 / BASE_W, 1);
    const band = [], dust = P.cloudPoints(src.length, seed, 'cavity', 'disk',
                                          [0.44, 0.56], 0.055, 1);
    for (let i = 0; i < src.length; i++) {
      const a = -((60 * Math.PI) / 180) + ((240 * Math.PI) / 180) * (i / Math.max(1, src.length - 1));
      const rr = 130 + (18 * ((i * 7) % 11)) / 11 - 9;
      band.push([S[0] + rr * Math.cos(a), S[1] + rr * Math.sin(a)]);
    }
    this._c = { S, src, band, dust };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const S = c.S;
    const p3 = easeInOutCubic(phase(t, 78.92, 79.12));
    const p4 = phase(t, 79.12, 79.23);

    // 主词：78.64 前完整，之后淡出
    const LINES = ["If I'm a", 'tomato'];
    const ACC = [[["If I'm a", ICE]], [['tomato', BV]]];
    if (t < 78.64) {
      K.word_block(FONT_SEMI, 176, LINES, 0.10 * BASE_W,
                   [0.26 * BASE_H, 0.44 * BASE_H], 0.04, 78.36, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACC });
    } else {
      const fa = 1 - clamp01(phase(t, 78.64, 78.72));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 176, LINES, 0.10 * BASE_W,
                     [0.26 * BASE_H, 0.44 * BASE_H], 0.04, 78.36, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACC });
      }
    }

    // 5680 点自球面分流到弧带（70%）与空腔尘埃（30%）
    const groups = [[], [], []];
    for (let i = 0; i < c.src.length; i++) {
      const goBand = i % 10 < 7;
      const tgt = goBand ? c.band[i] : c.dust[i];
      const k = clamp01(p3 * 1.1 - (i % 23) * 0.008);
      const P2 = [lerp(c.src[i][0], tgt[0], k), lerp(c.src[i][1], tgt[1], k)];
      const m = i % 10;
      groups[m < 6 ? 0 : (m < 9 ? 1 : 2)].push([P2, goBand ? 0.85 : 0.25]);
    }
    K.dots(groups[0].map((g) => g[0]), 2.0, CYAN, 0.85, 0.34);
    K.dots(groups[1].map((g) => g[0]), 2.0, BV, 0.85, 0.34);
    K.dots(groups[2].map((g) => g[0]), 2.0, WARM, 0.85, 0.34);

    if (t >= 79.12) {
      K.disc(S, 6.0, WARM, 0.6 * (1.0 - p4 * 0.4), 0.30);
      for (let i = 0; i < 3; i++) {
        const a0 = 240 + i * 22;
        K.ring(S, 148.0, CYAN, 1.5, 0.8, 0.25, a0, a0 + 14);
      }
    }
    if (t >= 79.10) {
      K.textKit(FONT_MONO, 44, 'shell:240°', S[0] - 120, S[1] + 180, GREY, 0,
             0.5 * clamp01(phase(t, 79.10, 79.23)));
    }
    K.micro({ TL: 'T+78.50s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_080} · shell:5680pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_081  `79.23–80.0084` ｜ 球壳裂瓣外翻 → 暖色内核抛物线飞向承接轮廓
   ══════════════════════════════════════════════════════════════ */
const SHOT_081 = {
  id: 'SHOT_081', start: 79.23, end: 80.0084,
  seedHex: SEEDS.SHOT_081, chapter: CHAPTER, status: 'OFFER',
  lyric: 'Then I will give you',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_081 = beatsIn(beats, this.start, this.end);
    this._c = {
      dust: P.cloudPoints(1400, SEEDS.SHOT_080, 'cavity', 'disk', [0.44, 0.56], 0.05, 1),
      inner: P.cloudPoints(140, SEEDS.SHOT_076, 'sinkB', 'disk', [0.74, 0.44], 96 / BASE_W, 1),
    };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const S = [0.44 * BASE_W, 0.56 * BASE_H];
    const T = [0.74 * BASE_W, 0.44 * BASE_H];
    const p1 = easeOutQuad(phase(t, 79.23, 79.40));
    const p2 = easeOutCubic(phase(t, 79.40, 79.62));
    const p3 = easeInOutCubic(phase(t, 79.62, 79.86));
    const p4 = phase(t, 79.86, 80.0084);

    // 弧带 240°→260° 收紧，随后裂为上下两瓣外翻
    const aSpan = lerp(240.0, 260.0, p1);
    const flap = easeOutCubic(p2) * 26.0;
    for (const [branch, sgn] of [[0, -1], [1, 1]]) {
      const pts = [];
      for (let i = 0; i < 121; i++) {
        const a = (( -aSpan / 2 + (aSpan * i) / 120.0) * Math.PI) / 180 - (branch === 0 ? 0 : Math.PI);
        const a2 = a + ((sgn * flap) * Math.PI) / 180;
        pts.push([S[0] + 130 * Math.cos(a2), S[1] + 130 * Math.sin(a2)]);
      }
      K.seg(pts, CYAN, p2 > 0 ? 2.5 : 2.0, 0.75, 0.34);
    }
    K.dots(c.dust, 2.0, ICE, 0.18, 0.10);
    K.disc(S, 6.0, WARM, 0.55, 0.30);
    K.dash(S, T, GREY, 1.5, 0.45, 6, 5);

    // 承接轮廓
    const q = easeOutQuad(phase(t, 79.70, 79.86));
    if (t >= 79.70) {
      K.ring(T, 96.0, CYAN, 2.0, 0.95, 0.34, -90, -90 + 360 * q);
      K.dots(c.inner, 2.0, CYAN, 0.4 * q, 0.20);
    }

    // 内核飞行（抛物线 + 12 颗拖尾）
    if (t >= 79.62) {
      const f2 = p3;
      const kx = lerp(S[0], T[0], f2);
      const ky = lerp(S[1], T[1], f2) - Math.sin(Math.PI * f2) * 150;
      const rk = 46.0 * (1.0 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 79.86, 79.95))));
      K.disc([kx, ky], t < 79.86 ? rk : 46.0, WARM, 1.0, 0.50);
      K.ring([kx, ky], rk + 14, ICE, 1.0, 0.5, 0.30);
      for (let i = 0; i < 12; i++) {
        const k = f2 - 0.04 * i;
        if (k <= 0) continue;
        const tx = lerp(S[0], T[0], k);
        const ty = lerp(S[1], T[1], k) - Math.sin(Math.PI * k) * 150;
        K.dots([[tx, ty]], 2.0, WARM, 0.6 * (1 - i / 12.0), 0.20);
      }
    }
    if (t >= 79.86) {
      const lens = lensPoints(T, 96, [T[0] + 20, T[1] + 10], 46, 30);
      if (lens.length) K.poly(lens, ICE, 1.0, 0.6 * p4, 0.30, true);
    }

    K.word_block(FONT_SEMI, 168, ['Then I will', 'give you'], 0.10 * BASE_W,
                 [0.22 * BASE_H, 0.40 * BASE_H], 0.04, 79.86, t,
                 { per_char: 0.013,
                   accents: [[['Then I will', ICE]], [['give you', CYAN]]] });
    if (t >= 79.90) {
      K.textKit(FONT_MONO, 44, 'offering:core', S[0] - 130, S[1] + 210, GREY, 0,
             0.7 * clamp01(phase(t, 79.90, 80.0)));
    }
    K.micro({ TL: 'T+79.23s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_081} · offering:1`, BR: 'OFFER' });
    return { bloomR: 9.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_082  `80.0084–80.64` ｜ 献出结构粒子化 → 3 段 60° 护盾弧 + 6 枚自由基
   ══════════════════════════════════════════════════════════════ */
const SHOT_082 = {
  id: 'SHOT_082', start: 80.0084, end: 80.62,
  seedHex: SEEDS.SHOT_082, chapter: CHAPTER, status: 'SHIELD',
  lyric: 'Then I will give you',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_082 = beatsIn(beats, this.start, this.end);
    const C = [0.50 * BASE_W, 0.52 * BASE_H];
    const sd = seedFromHex(SEEDS.SHOT_082);
    // 弧段点位（3×620）
    const segs = [];
    for (let s = 0; s < 3; s++) {
      const arr = [];
      for (let i = 0; i < 620; i++) {
        const u = i / 619.0;
        const rr = 150 + (14 * ((i * 5) % 7)) / 7.0 - 7;
        arr.push([rr, (60 * s + 60 + 60 * u) * 1, u]);
      }
      arr.base = (60 * s + 60);
      segs.push(arr);
    }
    this._c = {
      C, segs,
      eco: P.cloudPoints(3300, SEEDS.SHOT_082, 'eco', 'rect', [0.30, 0.30], 0.22, 0.5),
    };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;
    const p2 = easeInOutCubic(phase(t, 80.16, 80.40));
    const p3 = phase(t, 80.40, 80.54);
    const p4 = easeOutQuad(phase(t, 80.54, 80.62));

    // 采样网格闪现
    if (t <= 80.16) {
      const gx0 = 0.10 * BASE_W, gy0 = 0.14 * BASE_H;
      const gx1 = 0.50 * BASE_W, gy1 = 0.48 * BASE_H;
      for (let i = 0; i < 4; i++) {
        const yy = lerp(gy0, gy1, i / 3);
        K.lineSeg([gx0, yy], [gx1, yy], GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4);
        K.lineSeg([xx, gy0], [xx, gy1], GREY, 1.0, 0.30);
      }
      if (t < 80.02) {
        K.word_block(FONT_SEMI, 168, ['Then I will', 'give you'], 0.10 * BASE_W,
                     [0.22 * BASE_H, 0.40 * BASE_H], 0.04, 79.86, t,
                     { per_char: 0.0, char_dur: 0.001,
                       accents: [[['Then I will', ICE]], [['give you', CYAN]]] });
      }
    }

    // 3 段弧（粒子带）
    const rot = ((8.0 * p4) * Math.PI) / 180;
    for (let s = 0; s < 3; s++) {
      const a0 = rot + (((60 * s + 60) * Math.PI) / 180);
      const arr = c.segs[s];
      const pts = [];
      for (let i = 0; i < arr.length; i++) {
        const [rr, deg, u] = arr[i];
        if (u > clamp01(p2 * 1.15)) continue;
        const a = a0 + ((60.0 * u) * Math.PI) / 180;
        pts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
      }
      K.dots(pts, 2.0, CYAN, 0.85, 0.40);
      const ea = a0 + (60.0 * Math.PI) / 180;
      for (const aa of [a0, ea]) {
        K.ring([C[0] + 150 * Math.cos(aa), C[1] + 150 * Math.sin(aa)], 5.0, ICE, 1.0, 0.9, 0.30);
      }
    }

    // 弧间电子云
    if (t >= 80.16) {
      const q = clamp01(p2);
      const pts = [], al = [];
      for (let i = 0; i < c.eco.length; i++) {
        const k = clamp01(q * 1.2 - (i % 19) * 0.01);
        const [x, y] = c.eco[i];
        pts.push([lerp(x, C[0] + (x - C[0]) * 0.35, k),
                  lerp(y, C[1] + (y - C[1]) * 0.35, k)]);
        al.push(0.30);
      }
      K.dots(pts, 2.0, ICE, 1, 0.15);
    }

    // 6 枚自由基十字星
    if (t >= 80.40) {
      const q = easeOutCubic(phase(t, 80.40, 80.54));
      const sc = 1.0 + 0.3 * Math.sin(Math.PI * clamp01(phase(t, 80.40, 80.50)));
      for (let i = 0; i < 6; i++) {
        const ang = ((15 + 60 * i) * Math.PI) / 180;
        const rr = lerp(210, 210 - 24, easeInQuad(phase(t, 80.40, 80.54)));
        const px = C[0] + rr * Math.cos(ang), py = C[1] + rr * Math.sin(ang);
        const L = 8 * sc * q;
        K.lineSeg([px - L, py], [px + L, py], RED, 1.5, 0.9, 0.34);
        K.lineSeg([px, py - L], [px, py + L], RED, 1.5, 0.9, 0.34);
      }
    }
    if (t >= 80.48) {
      K.textKit(FONT_MONO, 44, 'radicals:6', 0.80 * BASE_W, 0.16 * BASE_H, RED, 0,
             0.6 * clamp01(phase(t, 80.48, 80.60)));
    }
    K.micro({ TL: 'T+80.01s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_082} · arc:3×60°`, BR: 'SHIELD' });
    return { bloomR: 9.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_083  `80.62–81.35` ｜ 3 弧闭合为 720 粒护盾环 + 6 枚自由基中和
   ══════════════════════════════════════════════════════════════ */
const SHOT_083 = {
  id: 'SHOT_083', start: 80.62, end: 81.35,
  seedHex: SEEDS.SHOT_083, chapter: CHAPTER, status: 'SHIELD',
  lyric: 'ANTIOXIDANTS / 抗氧化',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_083 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.52 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;
    const p1 = easeOutQuad(phase(t, 80.62, 80.78));
    const rot = rad(-12.0 * Math.max(0.0, t - 80.78));
    const closed = clamp01(p1);
    const n = Math.trunc(720 * Math.max(0.35, closed));

    // 720 粒护盾环
    const ring = [], ringCol = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (2 * Math.PI * i) / 720;
      const rr = 150 + (10 * ((i * 3) % 5)) / 5.0 - 5;
      ring.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
      ringCol.push(i % 10 < 7 ? CYAN : ICE);
    }
    K.dots(ring, 3.0, CYAN, 0.9, 0.44);

    // 6 枚自由基冲撞 → 涟漪 → 暖尘 → 中和节点
    const hits = [80.82, 80.91, 81.00, 81.07, 81.14, 81.21];
    for (let i = 0; i < 6; i++) {
      const ang = rad(15 + 60 * i);
      const hb = hits[i];
      const rr = 210 - 62 * easeInQuad(phase(t, hb - 0.09, hb));
      const p = [C[0] + rr * Math.cos(ang), C[1] + rr * Math.sin(ang)];
      if (t < hb) {
        const L = 8;
        K.line([p[0] - L, p[1]], [p[0] + L, p[1]], RED, 1.5, 0.9, 0.34);
        K.line([p[0], p[1] - L], [p[0], p[1] + L], RED, 1.5, 0.9, 0.34);
      } else if (t < hb + 0.16) {
        const q = (t - hb) / 0.16;
        const rr2 = 8 + 32 * easeOutQuad(q);
        K.ring([C[0] + 150 * Math.cos(ang), C[1] + 150 * Math.sin(ang)],
               rr2, WARM, 1.5, 0.6 * (1 - q), 0.36);
        K.dots([p], 4.0, mix(RED, WARM, q), 0.9, 0.36);
      }
      if (t >= 81.10) {
        K.disc([C[0] + 150 * Math.cos(ang), C[1] + 150 * Math.sin(ang)],
               7.0, WARM, 1.0, 0.44);
      }
    }
    // 3 条切向尾迹（预告线框起笔）
    if (t >= 81.24) {
      for (let i = 0; i < 3; i++) {
        const a = rad(30 + 120 * i);
        const st = [C[0] + 150 * Math.cos(a), C[1] + 150 * Math.sin(a)];
        const ln = 90 * easeOutExpo(clamp01(phase(t, 81.24, 81.35)));
        K.line(st, [st[0] - ln * Math.sin(a), st[1] + ln * Math.cos(a)],
               CYAN, 2.0, 0.7, 0.30);
      }
    }
    const left = 6 - hits.filter((hb) => t >= hb + 0.16).length;
    K.text(FONT_MONO, 44, `radicals:${Math.max(0, left)}→0`,
           0.78 * BASE_W, 0.16 * BASE_H, left === 0 ? GREY : RED, 0, left === 0 ? 0.6 : 1.0);

    // ANTIOXIDANTS（81.18 起 ANTI 转主青）
    const LINES = ['ANTIOXIDANTS'];
    const BASE = { base: ICE, rules: [] };
    const ACC = { base: ICE, rules: [{ when: { ciLt: 4 }, color: CYAN }] };
    K.word_block(FONT_XBOLD, 203, LINES, 0.50 * BASE_W, [0.22 * BASE_H], 0.07, 81.24, t,
                 { per_char: 0.0, char_dur: 0.001, anchor: 'center',
                   accents: t < 81.18 ? null : [[['ANTI', CYAN]]] });
    K.micro({ TL: 'T+80.62s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_083} · ring:720pt`, BR: 'SHIELD' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_084  `81.35–82.1788` ｜ 护盾环收束为坐姿猫线框（抽象线稿）
   ══════════════════════════════════════════════════════════════ */
/** 坐姿侧面猫线框（抽象线稿，不画实物）。对应 Python 的 cat_wire。 */
function catWire(cx, cy, h, kpx) {
  const u = h;
  const P = (fx, fy) => [cx + fx * u, cy + fy * u];
  const polys = [], eyes = [], stripes = [];
  // 0 躯干椭圆
  const p0 = [];
  for (let i = 0; i < 41; i++) {
    const a = (2 * Math.PI * i) / 40;
    p0.push(P(-0.02 + 0.096 * Math.cos(a), 0.02 + 0.126 * Math.sin(a)));
  }
  polys.push(p0);
  // 1 头
  const p1 = [];
  for (let i = 0; i < 33; i++) {
    const a = (2 * Math.PI * i) / 32;
    p1.push(P(0.06 + 0.085 * Math.cos(a), -0.36 + 0.085 * Math.sin(a)));
  }
  polys.push(p1);
  // 2/3 双耳三角
  polys.push([P(0.005, -0.500), P(-0.025, -0.400), P(0.045, -0.415), P(0.005, -0.500)]);
  polys.push([P(0.115, -0.490), P(0.085, -0.415), P(0.152, -0.398), P(0.115, -0.490)]);
  // 4/5 颈线
  polys.push([P(0.145, -0.300), P(0.115, -0.200), P(0.090, -0.145)]);
  polys.push([P(-0.020, -0.290), P(-0.075, -0.200), P(-0.100, -0.145)]);
  // 6 后臀圆
  const p6 = [];
  for (let i = 0; i < 25; i++) {
    const a = (2 * Math.PI * i) / 24;
    p6.push(P(-0.055 + 0.075 * Math.cos(a), 0.05 + 0.075 * Math.sin(a)));
  }
  polys.push(p6);
  // 7/8 前腿折线、9 后腿折线、10 足线
  polys.push([P(0.035, 0.100), P(0.045, 0.400), P(0.085, 0.445)]);
  polys.push([P(0.005, 0.110), P(0.018, 0.410), P(0.058, 0.450)]);
  polys.push([P(-0.100, 0.100), P(-0.118, 0.360), P(-0.048, 0.450)]);
  polys.push([P(-0.055, 0.455), P(0.095, 0.455)]);
  // 眼线 2 条
  eyes.push([P(0.025, -0.383), P(0.025, -0.355)]);
  eyes.push([P(0.085, -0.383), P(0.085, -0.355)]);
  // 14 条条纹
  for (let i = 0; i < 14; i++) {
    const th = Math.PI * (1.10 + (0.80 * (i + 0.5)) / 14.0);
    const bx = -0.02 + 0.096 * Math.cos(th);
    const by = 0.02 + 0.126 * Math.sin(th);
    let nx = Math.cos(th) / 0.096, ny = Math.sin(th) / 0.126;
    const nl = Math.hypot(nx, ny) || 1.0;
    nx /= nl; ny /= nl;
    const L = (18.0 + (16.0 * ((i * 7) % 5)) / 4.0) / 540.0;
    stripes.push([P(bx - (nx * L) / 2, by - (ny * L) / 2),
                  P(bx + (nx * L) / 2, by + (ny * L) / 2)]);
  }
  // 尾巴：自臀部向右上甩出，y = 46px·sin(2πx/120px)
  const hip = P(-0.100, 0.020);
  const ang = rad(35.0);
  const tail = [];
  for (let i = 0; i < 41; i++) {
    const s = (335.0 * i) / 40.0;
    tail.push([hip[0] + Math.cos(ang) * kpx * s,
               hip[1] - Math.sin(ang) * kpx * s
               + Math.sin((2 * Math.PI * s) / 120.0) * kpx * 46.0]);
  }
  return { polys, eyes, stripes, tail };
}

const SHOT_084 = {
  id: 'SHOT_084', start: 81.35, end: 82.1788,
  seedHex: SEEDS.SHOT_084, chapter: CHAPTER, status: 'WIRE',
  lyric: "If I'm a tabby cat / 如果我是一只虎斑猫",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_084 = beatsIn(beats, this.start, this.end);
    const catC = [0.54 * BASE_W, 0.56 * BASE_H];
    const wire = catWire(catC[0], catC[1], 0.50 * BASE_H, 1.0);
    this._c = { C: [0.50 * BASE_W, 0.52 * BASE_H], catC, wire };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, catC, wire } = c;
    const p1 = easeInOutCubic(phase(t, 81.35, 81.56));
    const p2 = phase(t, 81.56, 81.90);
    const p3 = easeOutCubic(phase(t, 81.90, 82.06));

    // 护盾环粒子收束
    if (p1 < 1.0) {
      for (let i = 0; i < 720; i += 3) {
        const a = (2 * Math.PI * i) / 720;
        const src = [C[0] + 150 * Math.cos(a), C[1] + 150 * Math.sin(a)];
        const pl = wire.polys[i % wire.polys.length];
        const dst = pl[i % pl.length] || src;
        const k = easeInOutCubic(clamp01(p1 * 1.1 - (i % 17) * 0.01));
        K.dots([[lerp(src[0], dst[0], k), lerp(src[1], dst[1], k)]],
               2.0, CYAN, 0.85 * (1 - 0.6 * p1), 0.30);
      }
    }
    // 线框逐段描出（头→背→颈→臀→耳→腿→足线）
    const order = [1, 0, 4, 5, 6, 2, 3, 7, 9, 8, 10];
    const nSeg = Math.trunc(order.length * clamp01(p2 * 1.2));
    for (let k = 0; k < order.length; k++) {
      if (k >= nSeg) continue;
      const f2 = k < nSeg - 1 ? 1.0 : ((clamp01(p2 * 1.2) * order.length) % 1.0) || 1.0;
      const pl = wire.polys[order[k]];
      K.seg(pl.slice(0, Math.max(2, Math.trunc(pl.length * f2))), WARM, 1.5, 0.9, 0.34);
    }
    if (t >= 81.56) {
      const nSt = Math.trunc(14 * clamp01(phase(t, 81.56, 81.90)));
      for (let i = 0; i < nSt; i++) K.seg(wire.stripes[i], WARM, 1.0, 0.5, 0.20);
      for (const e of wire.eyes) K.seg(e, CYAN, 1.5, 0.95, 0.30);
    }
    // 尾巴主曲线 + 3 叉
    if (t >= 81.90) {
      const tail = wire.tail;
      const m = Math.max(2, Math.trunc(tail.length * clamp01(p3)));
      const wobble = p3 >= 1.0 ? Math.sin((2 * Math.PI * (t - 82.06)) / 1.2) * 0.10 : 0.0;
      const moved = tail.map(([x, y], i) => [x, y + 46 * wobble * (i / tail.length)]);
      K.seg(moved.slice(0, m), WARM, 1.5, 0.95, 0.34);
      if (t >= 82.02) {
        for (const [j, colr] of [[0, BV], [1, CYAN]]) {
          const q = clamp01(phase(t, 82.02 + 0.06 * j, 82.14 + 0.06 * j));
          if (q <= 0) continue;
          const start = Math.trunc((moved.length * 3) / 5);
          const b = moved.slice(start).map(([x, y]) =>
            [x + 20 * j, y - 30 * (1 + j)]);
          K.seg(b.slice(0, Math.max(2, Math.trunc(b.length * q))), colr, 1.2, 0.8, 0.26);
        }
      }
    }
    // 6 处高光点
    if (t >= 81.35) {
      for (let i = 0; i < 6; i++) {
        const a = (2 * Math.PI * i) / 6;
        K.disc([catC[0] + 70 * Math.cos(a), catC[1] + 70 * Math.sin(a)],
               4.0, WARM, 0.9 * (1 - 0.7 * p1), 0.40);
      }
    }
    if (t >= 82.10) {
      K.text(FONT_MONO, 44, 'wire:curve · tail:3fork', 0.58 * BASE_W, 0.78 * BASE_H,
             GREY, 0, 0.7 * clamp01(phase(t, 82.10, 82.1788)));
    }
    // 主词（82.06 起第二行转暖色）
    const acc = t >= 82.06 ? WARM : ICE;
    K.word_block(FONT_SEMI, 168, ["If I'm a", 'tabby cat'], 0.10 * BASE_W,
                 [0.24 * BASE_H, 0.42 * BASE_H], 0.04, 82.06, t,
                 { per_char: 0.013,
                   accents: [[["If I'm a", ICE]], [['tabby cat', acc]]] });
    K.micro({ TL: 'T+81.35s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_084} · wire:14seg · tail:3`, BR: 'WIRE' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_085  `82.1788–82.83` ｜ 猫线框采样向胸口收拢 + 共振源点
   ══════════════════════════════════════════════════════════════ */
const SHOT_085 = {
  id: 'SHOT_085', start: 82.1788, end: 82.83,
  seedHex: SEEDS.SHOT_085, chapter: CHAPTER, status: 'MORPH',
  lyric: "If I'm a tabby cat / 如果我是一只虎斑猫",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_085 = beatsIn(beats, this.start, this.end);
    const catC = [0.54 * BASE_W, 0.56 * BASE_H];
    const wire = catWire(catC[0], catC[1], 0.50 * BASE_H, 1.0);
    // 猫形点阵（松散）：polys + stripes + tail 的全部顶点
    const pts = [];
    for (const pl of wire.polys.concat(wire.stripes, [wire.tail])) {
      for (const p of pl) {
        pts.push(p);
        if (pts.length >= 2800) break;
      }
      if (pts.length >= 2800) break;
    }
    this._c = { catC, wire, pts, chest: [0.52 * BASE_W, 0.58 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { wire, pts, chest } = c;
    const p2 = easeInOutCubic(phase(t, 82.30, 82.58));

    // 采样网格 + 完整猫线框（82.30 前）
    if (t < 82.30) {
      const gx0 = 0.10 * BASE_W, gy0 = 0.12 * BASE_H;
      const gx1 = 0.50 * BASE_W, gy1 = 0.46 * BASE_H;
      for (let i = 0; i < 4; i++) {
        const yy = lerp(gy0, gy1, i / 3.0);
        K.line([gx0, yy], [gx1, yy], GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4.0);
        K.line([xx, gy0], [xx, gy1], GREY, 1.0, 0.30);
      }
      for (const pl of wire.polys) K.seg(pl, WARM, 1.5, 0.85, 0.30);
      for (const s of wire.stripes) K.seg(s, WARM, 1.0, 0.5, 0.20);
      for (const e of wire.eyes) K.seg(e, CYAN, 1.5, 0.9, 0.30);
      K.seg(wire.tail, WARM, 1.5, 0.9, 0.30);
      const fa = t > 82.30 ? 1.0 - clamp01(phase(t, 82.30, 82.36)) : 1.0;
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 168, ["If I'm a", 'tabby cat'], 0.10 * BASE_W,
                     [0.24 * BASE_H, 0.42 * BASE_H], 0.04, 82.06, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa,
                       accents: [[["If I'm a", ICE]], [['tabby cat', WARM]]] });
      }
    }

    // 猫形点阵向胸口收拢
    const drift = 3.0 * Math.sin((2 * Math.PI * t) / 0.8);
    for (let i = 0; i < pts.length; i++) {
      const k = clamp01(p2 * 1.15 - (i % 29) * 0.006);
      let nx = lerp(pts[i][0], chest[0], 0.30 * k);
      const ny = lerp(pts[i][1], chest[1], 0.30 * k);
      nx += drift * (i % 3 ? 1 : -1);
      K.dots([[nx, ny]], 2.0, WARM, 0.85, 0.30);
    }
    // 3 条尾曲线降 40% 并冻结相位
    const tailA = 1.0 - 0.6 * clamp01(phase(t, 82.58, 82.74));
    K.seg(wire.tail, WARM, 1.2, tailA, 0.20);
    K.seg(wire.tail.map(([x, y]) => [x + 18, y - 26]), BV, 1.2, tailA * 0.8, 0.16);
    K.seg(wire.tail.map(([x, y]) => [x - 18, y - 34]), CYAN, 1.2, tailA * 0.8, 0.16);

    // 胸口源点 + 首圈涟漪
    if (t >= 82.58) {
      const sc = easeOutCubic(phase(t, 82.58, 82.74));
      K.disc(chest, 10.0 * sc, ICE, 1.0, 0.46);
      K.ring(chest, 16.0 * sc, CYAN, 1.0, 0.8, 0.30);
      const q = phase(t, 82.74, 82.83);
      K.ring(chest, lerp(10.0, 40.0, easeOutQuad(q)), CYAN, 1.5, 0.6 * (1 - q), 0.30);
    }
    if (t >= 82.74) {
      K.text(FONT_MONO, 44, 'freq:25Hz', chest[0] + 20, chest[1] + 70, GREY, 0,
             0.5 * clamp01(phase(t, 82.74, 82.83)));
    }
    K.micro({ TL: 'T+82.18s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_085} · sample:4px · 6100pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_086  `82.83–83.6364` ｜ 7 圈涟漪 + 48 根音频柱带
   ══════════════════════════════════════════════════════════════ */
const SHOT_086 = {
  id: 'SHOT_086', start: 82.83, end: 83.6364,
  seedHex: SEEDS.SHOT_086, chapter: CHAPTER, status: 'PURR',
  lyric: 'Then I will purr for your / 那么我会为你呼噜',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_086 = beatsIn(beats, this.start, this.end);
    const catC = [0.54 * BASE_W, 0.56 * BASE_H];
    this._c = {
      src: [0.52 * BASE_W, 0.58 * BASE_H],
      wire: catWire(catC[0], catC[1], 0.50 * BASE_H, 1.0),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const src = c.src;
    const bs = SC.beats('SHOT_086');
    const p2 = phase(t, 83.06, 83.36);

    // 7 圈涟漪（前锋抵达 x=66% 时 hard cut 消失）
    const radii = [46, 92, 138, 184, 230, 276, 322];
    const emits = [82.83, 82.94, 83.05, 83.16, 83.36, 83.47, 83.58];
    for (let i = 0; i < radii.length; i++) {
      const e = emits[i];
      if (t < e) continue;
      const q = clamp01((t - e) / 0.62);
      const rr = radii[i] + 46.0 * q;
      if (src[0] + rr >= 0.66 * BASE_W) continue;
      K.ring(src, rr, CYAN, 1.5, Math.max(0.0, 0.7 - q * 0.6), 0.30);
    }

    // 猫形底影 40%
    for (const pl of c.wire.polys.concat(c.wire.stripes)) {
      K.seg(pl, WARM, 1.0, 0.40 * 0.35, 0.0);
    }
    const tailA = 0.4 + 0.3 * clamp01(p2);
    let kk = 0;
    for (const colr of [WARM, BV, CYAN]) {
      K.seg(c.wire.tail.map(([x, y]) => [x + 60 + 12 * kk, y]), colr, 1.2, tailA, 0.0);
      kk++;
    }

    // 源点（随拍点脉冲）
    const em = beatEnv(t, bs);
    K.disc(src, 10.0 * (1.0 + 0.2 * em), ICE, 1.0, 0.46);

    // 48 根音频柱（x 66%~78%）
    const bx0 = 0.66 * BASE_W, bx1 = 0.78 * BASE_W;
    const yb = 0.78 * BASE_H;
    const n = 48;
    for (let i = 0; i < n; i++) {
      const st = 83.06 + i * 0.008;
      const q = easeOutCubic(phase(t, st, st + 0.10));
      if (q <= 0) continue;
      const env = 25.0 + 25.0 * Math.abs(Math.sin(2 * Math.PI * 1.6 * t + i * 0.42));
      const h = (env * 0.14 * BASE_H / 25.0) * (0.35 + 0.65 * q);
      const x = lerp(bx0, bx1, (i + 0.5) / n);
      K.line([x, yb], [x, yb - h], CYAN, 8.0 * 0.55, 0.9, 0.38);
    }
    // 顶端连线
    if (t >= 83.06) {
      const lp = [];
      for (let i = 0; i < n; i++) {
        const env = 25.0 + 25.0 * Math.abs(Math.sin(2 * Math.PI * 1.6 * t + i * 0.42));
        const h = (env * 0.14 * BASE_H) / 25.0;
        lp.push([lerp(bx0, bx1, (i + 0.5) / n), yb - h]);
      }
      const m = Math.max(2, Math.trunc(lp.length * clamp01(phase(t, 83.06, 83.20))));
      K.seg(lp.slice(0, m), ICE, 1.5, 0.85, 0.30);
    }

    // 主词（83.48 起 purr 转主青）
    const purrCol = t >= 83.48 ? CYAN : ICE;
    K.word_block(FONT_SEMI, 168, ['Then I will purr', 'for your'], 0.10 * BASE_W,
                 [0.22 * BASE_H, 0.40 * BASE_H], 0.04, 83.48, t,
                 { per_char: 0.013,
                   accents: [[['Then I will ', ICE], ['purr', purrCol]],
                             [['for your', ICE]]] });
    if (t >= 83.54) {
      K.text(FONT_MONO, 44, 'amp:0.00→1.00', bx0, 0.80 * BASE_H, GREY, 0,
             0.7 * clamp01(phase(t, 83.54, 83.6364)));
    }
    K.micro({ TL: 'T+82.83s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_086} · ripple:7 · bars:48`, BR: 'PURR' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_087  `83.6364–84.27` ｜ 音频柱/涟漪/词粒子下沉凝结为花床
   ══════════════════════════════════════════════════════════════ */
/** 24 颗苞点（2 行 12 列）的屏幕坐标 */
function budPoints() {
  const out = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      out.push([(0.30 + 0.0554 * col) * BASE_W, (0.68 + 0.04 * row) * BASE_H]);
    }
  }
  return out;
}

const SHOT_087 = {
  id: 'SHOT_087', start: 83.6364, end: 84.27,
  seedHex: SEEDS.SHOT_087, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Then I will purr for your / 那么我会为你呼噜',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_087 = beatsIn(beats, this.start, this.end);
    // 词粒子 3300 + 音频柱点 48×26 + 涟漪点 7×80
    const src = P.cloudPoints(3300, SEEDS.SHOT_087, 'word', 'rect', [0.30, 0.30], 0.22, 0.5);
    for (let i = 0; i < 48; i++) {
      const x = (0.66 + (0.12 * (i + 0.5)) / 48) * BASE_W;
      for (let j = 0; j < 26; j++) src.push([x, 0.78 * BASE_H - 2.0 * j]);
    }
    const sc = [0.52 * BASE_W, 0.58 * BASE_H];
    for (let i = 0; i < 7; i++) {
      const rr = 46 + 46 * i;
      for (let j = 0; j < 80; j++) {
        const a = (2 * Math.PI * j) / 80;
        src.push([sc[0] + rr * Math.cos(a), sc[1] + rr * Math.sin(a)]);
      }
    }
    const catC = [0.54 * BASE_W, 0.56 * BASE_H];
    this._c = { src, buds: budPoints(), wire: catWire(catC[0], catC[1], 0.50 * BASE_H, 1.0) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = easeInQuad(phase(t, 83.76, 84.02));
    const p3 = phase(t, 84.02, 84.16);
    const ySoil = 0.76 * BASE_H;

    // 全部源点向 24 颗苞点收拢
    const a0 = p3 < 1 ? 0.30 : 0.18;
    const cx0 = 0.30 * BASE_W;
    const dots = [];
    for (let i = 0; i < c.src.length; i++) {
      const [x, y] = c.src[i];
      const tx = x * 0.60 + cx0 * 0.40;
      const b = c.buds[i % 24];
      const k = clamp01(p2 * 1.25 - (i % 37) * 0.005);
      dots.push([lerp(tx, b[0], k), lerp(y, b[1], k)]);
    }
    K.dots(dots, 2.0, ICE, a0 * 0.7, 0.10);

    // 猫形底影与尾曲线淡出
    if (t < 84.02) {
      const fa = 0.40 * (1 - clamp01(phase(t, 83.76, 84.02)));
      for (const pl of c.wire.polys.concat(c.wire.stripes)) {
        K.seg(pl, WARM, 1.0, fa * 0.35, 0.0);
      }
      K.seg(c.wire.tail, WARM, 1.2, fa * 0.8, 0.0);
    }
    // 土壤线
    const ln = clamp01(p3);
    K.line([0.14 * BASE_W, ySoil], [(0.14 + 0.72 * ln) * BASE_W, ySoil], GREY, 1.0, 0.60, 0.0);
    // 24 颗苞点
    if (t >= 84.02) {
      for (let i = 0; i < c.buds.length; i++) {
        const st = 84.02 + 0.010 * i;
        const q = easeOutCubic(phase(t, st, st + 0.08));
        if (q <= 0) continue;
        const col = [0, 4, 8, 12, 16, 20].includes(i) ? MOOD : ICE;
        K.disc(c.buds[i], 8.0 * q, col, 0.95, 0.36);
      }
    }
    if (t >= 84.14) {
      K.text(FONT_MONO, 44, 'buds:24', 0.74 * BASE_W, ySoil + 50, GREY, 0,
             0.7 * clamp01(phase(t, 84.14, 84.27)));
    }
    K.micro({ TL: 'T+83.64s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_087} · buds:24 · 5760pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_088  `84.27–85.08` ｜ 24 颗苞点绽放为 42 粒玫瑰线花冠
   ══════════════════════════════════════════════════════════════ */
/** 玫瑰线花瓣轨迹 r(θ)=R·|cos(kθ)|（对应 Python 的 rose_petal） */
function rosePetal(rMax, n, k = 2.5, spin = 0.0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n + spin;
    const rr = rMax * Math.abs(Math.cos(k * th));
    pts.push([rr * Math.cos(th), rr * Math.sin(th)]);
  }
  return pts;
}

const SHOT_088 = {
  id: 'SHOT_088', start: 84.27, end: 85.08,
  seedHex: SEEDS.SHOT_088, chapter: CHAPTER, status: 'BLOOM',
  lyric: 'ENJOYMENT / 享受',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_088 = beatsIn(beats, this.start, this.end);
    // 24 朵花冠的 42 点花瓣（尺度随绽放变化，这里按每帧重算，点数小）
    this._c = {
      buds: budPoints(),
      dust: P.cloudPoints(700, SEEDS.SHOT_088, 'dust', 'rect', [0.50, 0.67], 0.36, 0.12),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const ySoil = 0.76 * BASE_H;
    K.line([0.14 * BASE_W, ySoil], [0.86 * BASE_W, ySoil], GREY, 1.0, 0.60);
    K.dots(c.dust, 2.0, GREY, 0.18, 0.0);

    // 花冠：每朵 42 粒
    for (let i = 0; i < c.buds.length; i++) {
      const [bx, by] = c.buds[i];
      const st = 84.46 + 0.014 * i;
      const q = easeOutExpo(phase(t, st, st + 0.26));
      const rec = easeInCubic(clamp01((t - 84.92) / 0.16));
      const grow = q * (1.0 - rec);
      if (grow <= 0.02) continue;
      const pet = rosePetal(26.0 * (0.6 + 0.4 * grow), 42, 2.5, 0.0);
      const wob = 4 * Math.sin((2 * Math.PI * t) / 0.6 + i);
      for (let j = 0; j < pet.length; j++) {
        const px = bx + pet[j][0] * (0.6 + 0.4 * grow);
        const py = by - 20 - pet[j][1] - 6 * grow + wob;
        let col = j % 2 === 0 ? ICE : (j % 4 === 1 ? MOOD : ICE);
        if (i === 11 && j === 0) col = WARM;
        K.dots([[px, py]], 2.0, col, 0.9 * grow, 0.40);
      }
    }
    // 花托苞点
    for (let i = 0; i < c.buds.length; i++) {
      const [bx, by] = c.buds[i];
      let pr = 1.0 + 0.30 * easeOutQuad(phase(t, 84.27, 84.46))
               * (1 - clamp01((t - 84.46) / 0.2));
      if (t >= 84.92) pr = 1.0;
      const col = [0, 4, 8, 12, 16, 20].includes(i) ? MOOD : ICE;
      if (i === 11 && t >= 84.92) {
        const sc = clamp01(phase(t, 84.92, 85.08));
        K.disc([bx, by], lerp(8.0, 18.0, sc), WARM, 1.0, 0.54);
        K.ring([bx, by], 26.0 * sc, ICE, 1.0, 0.5, 0.30);
        K.line([bx, by - 18], [bx, by - 18 - 40 * sc], WARM, 1.5, 0.5 * sc, 0.40);
      } else {
        K.disc([bx, by], 8.0 * pr, col, 0.95, 0.36);
      }
    }
    // 主词（84.86 起 JOY 转紫）
    K.word_block(FONT_XBOLD, 244, ['ENJOYMENT'], 0.50 * BASE_W, [0.24 * BASE_H],
                 0.09, 84.74, t,
                 { per_char: 0.0, char_dur: 0.001, anchor: 'center',
                   accents: t < 84.86 ? null : [[['JOY', MOOD]]] });
    const lab = t < 84.96 ? 'bloom:24 · hold:0.18s' : 'buds:1 · next:halo';
    K.text(FONT_MONO, 44, lab, 0.20 * BASE_W, ySoil + 56, GREY, 0, 0.7);
    K.micro({ TL: 'T+84.27s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_088} · petals:1008`, BR: 'BLOOM' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_089  `85.08–85.8976` ｜ 三层同心光环（神谕式抽象几何）+ 十字准星
   ══════════════════════════════════════════════════════════════ */
const SHOT_089 = {
  id: 'SHOT_089', start: 85.08, end: 85.8976,
  seedHex: SEEDS.SHOT_089, chapter: CHAPTER, status: 'HALO',
  lyric: "If I'm the only god / 如果我是唯一的神",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_089 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.46 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;
    const p1 = easeOutExpo(phase(t, 85.08, 85.26));
    const p4 = easeOutCubic(phase(t, 85.80, 85.8976));

    // 中心亮点扩张 + 光柱
    K.disc(C, lerp(18.0, 34.0, p1), WARM, 1.0, 0.52);
    if (t < 85.26) {
      K.line([C[0], C[1] - 40], [C[0], C[1] - 40 * (1 + 2 * p1)], WARM, 1.5, 0.5, 0.36);
    }
    // 外环 72 段刻度
    for (let i = 0; i < 72; i++) {
      const st = 85.26 + 0.006 * i;
      if (t < st) continue;
      const a = (2 * Math.PI * i) / 72 - Math.PI / 2;
      K.line([C[0] + 250 * Math.cos(a), C[1] + 250 * Math.sin(a)],
             [C[0] + 264 * Math.cos(a), C[1] + 264 * Math.sin(a)], GREY, 1.5, 0.8);
    }
    // 中环
    const q2 = easeOutExpo(phase(t, 85.26, 85.62));
    K.ring(C, 190.0, CYAN, 2.0, 0.95, 0.30, -90, -90 + 360 * q2);
    // 内环虚线
    if (t >= 85.38) {
      const n = 360, stepd = 12.0 / 20.0;
      for (let i = 0; i < n; i++) {
        if (i / n > (t - 85.38) / 0.24) break;
        const a = rad((i * 360.0) / n - 14.0);
        const seg = Math.trunc(n / 9);
        if ((i % seg) / seg > stepd) continue;
        K.dots([[C[0] + 130 * Math.cos(a), C[1] + 130 * Math.sin(a)]],
               1.6, BV, 0.9, 0.26);
      }
    }
    // 三环差速旋转
    if (t >= 85.62) {
      for (const [speed, rr, colr, wd] of [[6.0, 250.0, GREY, 1.5],
                                           [-4.0, 190.0, CYAN, 2.0],
                                           [10.0, 130.0, BV, 1.5]]) {
        const a0 = speed * (t - 85.62);
        K.ring(C, rr, colr, wd, 0.55, 0.20, a0, a0 + 40);
      }
    }
    // 十字准星（自 45° 转正）
    const q3 = easeOutCubic(phase(t, 85.62, 85.80));
    const ang = rad(45.0 * (1 - q3));
    for (const k of [0, Math.PI / 2]) {
      const ax = Math.cos(ang + k), ay = Math.sin(ang + k);
      K.line([C[0] - 40 * ax, C[1] - 40 * ay], [C[0] + 40 * ax, C[1] + 40 * ay],
             ICE, 1.0, 0.5, 0.20);
    }
    K.ring(C, 26.0, ICE, 1.0, 0.5, 0.20);
    // 24 锚点
    for (let i = 0; i < 24; i++) {
      const a = (2 * Math.PI * i) / 24;
      K.disc([C[0] + 268 * Math.cos(a), C[1] + 268 * Math.sin(a)], 3.0, GREY, 0.30, 0.0);
    }
    // 垂直证明轴线
    if (t >= 85.80) {
      K.line([C[0], C[1] + 18], [C[0], C[1] + 18 + 90 * p4], ICE, 1.5, 0.8, 0.30);
    }
    // 主词（85.74 起 only 转暖）
    K.word_block(FONT_SEMI, 156, ["If I'm the only god"], 0.08 * BASE_W,
                 [0.14 * BASE_H], 0.05, 85.80, t,
                 { per_char: 0.011,
                   accents: [[['only', t >= 85.74 ? WARM : ICE]]] });
    if (t >= 85.78) {
      K.text(FONT_MONO, 44, 'halo:3ring · center:1', C[0] + 120, C[1] + 220, GREY, 0,
             0.7 * clamp01(phase(t, 85.78, 85.88)));
    }
    K.micro({ TL: 'T+85.08s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_089} · ring:3 · tick:72`, BR: 'HALO' });
    return { bloomR: 9.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_090  `85.8976–86.54` ｜ 光环解体 → 证明图（AXIOM + EVIDENCE）
   ══════════════════════════════════════════════════════════════ */
/** 矩形周长上的 n 个点（对应 Python 的 _rect_perimeter） */
function rectPerimeter(c, w, h, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i / n) * 4.0;
    if (u < 1) out.push([c[0] - w / 2 + w * u, c[1] - h / 2]);
    else if (u < 2) out.push([c[0] + w / 2, c[1] - h / 2 + h * (u - 1)]);
    else if (u < 3) out.push([c[0] + w / 2 - w * (u - 2), c[1] + h / 2]);
    else out.push([c[0] - w / 2, c[1] + h / 2 - h * (u - 3)]);
  }
  return out;
}

const SHOT_090 = {
  id: 'SHOT_090', start: 85.8976, end: 86.54,
  seedHex: SEEDS.SHOT_090, chapter: CHAPTER, status: 'GRAPH',
  lyric: "If I'm the only god / 如果我是唯一的神",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_090 = beatsIn(beats, this.start, this.end);
    const AX = [0.26 * BASE_W, 0.54 * BASE_H];
    const EV = [0.74 * BASE_W, 0.48 * BASE_H];
    const C = [0.50 * BASE_W, 0.46 * BASE_H];
    // 环拆点：3600 点分三半径
    const ringPts = [];
    for (let i = 0; i < 3600; i++) {
      const a = (2 * Math.PI * i) / 360;
      const rr = i % 3 === 0 ? 250.0 : (i % 3 === 1 ? 190.0 : 130.0);
      ringPts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
    }
    const boxPts = rectPerimeter(AX, 140, 84, 560);
    const evPts = P.cloudPoints(1080, SEEDS.SHOT_090, 'ev', 'disk', [0.74, 0.48],
                                16.0 / BASE_W, 1.0);
    const pathPts = [];
    for (let i = 0; i < 540; i++) {
      pathPts.push([lerp(AX[0] + 70, EV[0], i / 539.0), lerp(AX[1], EV[1], i / 539.0)]);
    }
    this._c = { AX, EV, ringPts, boxPts, evPts, pathPts };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { AX, EV } = c;
    const p1 = easeOutQuad(phase(t, 85.8976, 86.06));
    const p2 = easeInOutCubic(phase(t, 86.06, 86.34));
    const p3 = clamp01(phase(t, 86.34, 86.46));
    const bs = SC.beats('SHOT_090');

    // 三组粒子收束
    const groups = [['ring', c.ringPts, c.boxPts], ['ev', c.evPts, c.evPts],
                    ['path', c.pathPts, c.pathPts]];
    const COLS = [GREY, ICE, BV];
    for (let gi = 0; gi < 3; gi++) {
      const [, src, dst] = groups[gi];
      const n = Math.min(src.length, dst.length);
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = clamp01(p2 * 1.15 - (i % 41) * 0.004);
        out.push([lerp(src[i][0], dst[i][0], k), lerp(src[i][1], dst[i][1], k)]);
      }
      K.dots(out, 2.0, COLS[gi], 0.75, 0.20);
    }
    // 方块四边
    K.rect(AX[0], AX[1], 140, 84, GREY, 1.5, 0.9 * clamp01(p2), 0.22, 4);
    // EVIDENCE 亮点
    const colEv = t >= 86.06 ? ICE : WARM;
    const em = beatEnv(t, bs);
    K.disc(EV, 10.0 * (1.0 + 0.2 * em), colEv, 1.0, 0.50);
    K.ring(EV, 16.0, CYAN, 1.0, 0.8, 0.30);
    // 虚线路径 + 12 候选点
    K.dash([AX[0] + 70, AX[1]], EV, GREY, 1.5, 0.7, 6, 5);
    for (let i = 0; i < 12; i++) {
      const f = (i + 0.5) / 12.0;
      if (i / 12.0 <= p3) {
        K.disc([lerp(AX[0] + 70, EV[0], f), lerp(AX[1], EV[1], f)], 4.0, BV, 0.5, 0.0);
      }
    }
    // 24 锚点 → 路径两端护点
    for (let i = 0; i < 24; i++) {
      const side = i < 12 ? -1 : 1;
      const f = (i % 12) / 11.0;
      const bx = lerp(AX[0], EV[0], f);
      const by = lerp(AX[1], EV[1], f) + side * 26 * (1 - p2) + side * 10 * (1 - p1);
      K.disc([bx, by], 3.0, GREY, 0.30, 0.0);
    }
    if (t >= 86.40) {
      const a = 0.7 * clamp01(phase(t, 86.40, 86.52));
      K.text(FONT_MONO, 60, 'AXIOM', AX[0], AX[1] + 42 + 34, GREY, 0, a, 'center');
      K.text(FONT_MONO, 60, 'EVIDENCE', EV[0], EV[1] + 50, CYAN, 0, a, 'center');
    }
    K.word_block(FONT_SEMI, 168, ["If I'm the only", 'god'], 0.08 * BASE_W,
                 [0.18 * BASE_H, 0.34 * BASE_H], 0.04, 86.46, t,
                 { per_char: 0.013,
                   accents: [[['only', t < 86.10 ? WARM : ICE]], [['god', ICE]]] });
    K.micro({ TL: 'T+85.90s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_090} · node:2 · cand:12`, BR: 'GRAPH' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_091  `86.54–87.3128` ｜ 证明图闭合：证明线 + 5 中介节点 + 40 电流粒子
   ══════════════════════════════════════════════════════════════ */
const SHOT_091 = {
  id: 'SHOT_091', start: 86.54, end: 87.3128,
  seedHex: SEEDS.SHOT_091, chapter: CHAPTER, status: 'PROVE',
  lyric: "Then you're the proof of my / 那么你就是我的证明",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_091 = beatsIn(beats, this.start, this.end);
    const AX = [0.26 * BASE_W, 0.54 * BASE_H];
    const EV = [0.74 * BASE_W, 0.48 * BASE_H];
    const A0 = [AX[0] + 70, AX[1]];
    const bez = P.curvePoints('bezier', 120, 0, {
      p0: A0,
      p1: [(A0[0] + EV[0]) / 2, Math.min(A0[1], EV[1]) - 65],
      p2: EV,
    });
    this._c = { AX, EV, A0, bez };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { AX, EV, A0, bez } = c;
    const p1 = easeOutCubic(phase(t, 86.54, 86.72));
    const p2 = easeInOutCubic(phase(t, 86.72, 87.06));
    const p3 = phase(t, 87.06, 87.22);

    const m = Math.max(2, Math.trunc(bez.length * (0.35 + 0.65 * p2)));
    K.seg(bez.slice(0, m), CYAN, 2.0, 0.95, 0.44);
    K.rect(AX[0], AX[1], 140, 84, GREY, 1.5, 0.9, 0.22, 4);
    const ty = AX[1] + 42 + 14 - 26 * p1;
    K.text(FONT_MONO, 60, 'AXIOM', AX[0], ty + 20, GREY, 0, 0.8, 'center');
    K.disc(EV, 10.0 * (1 + 0.15 * Math.sin(Math.PI * clamp01(p1))), ICE, 1.0, 0.50);
    K.ring(EV, 16.0, CYAN, 1.0, 0.8, 0.30);
    K.text(FONT_MONO, 60, 'EVIDENCE', EV[0], EV[1] + 50 + 14, CYAN, 0, 0.8, 'center');

    // 5 枚中介节点
    for (let i = 0; i < 5; i++) {
      const f = 0.17 + (0.67 * i) / 4.0;
      const idx = Math.trunc(f * (bez.length - 1));
      const p = bez[idx];
      if (p2 >= f + 0.05) {
        K.ring(p, 6.0, BV, 1.5, 0.95, 0.30);
        const q = clamp01((t - (86.72 + 0.066 * i)) / 0.10);
        if (q > 0 && q < 1) K.ring(p, 6.0 + 18.0 * q, BV, 1.0, 0.5 * (1 - q), 0.0);
      }
    }
    // 12 候选点（5 颗被取代，余 7 颗降 25%）
    for (let i = 0; i < 12; i++) {
      const f = (i + 0.5) / 12.0;
      if ([1, 3, 5, 7, 9].includes(i) && t >= 87.06) continue;
      K.disc([lerp(A0[0], EV[0], f), lerp(A0[1], EV[1], f)], 4.0, BV,
             t < 87.06 ? 0.5 : 0.25, 0.0);
    }
    // 40 颗电流粒子
    const spd = 1.0 + 0.4 * clamp01(p3);
    for (let i = 0; i < 40; i++) {
      const f = (i / 40.0 + spd * 0.55 * (t - 86.54)) % 1.0;
      const idx = Math.trunc(f * (bez.length - 1));
      K.dots([bez[idx]], 2.0, CYAN, 0.9, 0.30);
      K.seg([bez[Math.max(0, idx - 5)], bez[idx]], CYAN, 1.0, 0.35, 0.20);
    }
    if (t >= 87.20) {
      K.text(FONT_MONO, 44, 'chain:5', (A0[0] + EV[0]) / 2, Math.max(A0[1], EV[1]) + 50,
             GREY, 0, 0.7 * clamp01(phase(t, 87.20, 87.30)), 'center');
    }
    K.word_block(FONT_SEMI, 168, ["Then you're the", 'proof of my'], 0.08 * BASE_W,
                 [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 87.22, t,
                 { per_char: 0.013,
                   accents: [[["Then you're the", ICE]],
                             [['proof', t >= 87.14 ? CYAN : ICE], [' of my', ICE]]] });
    K.micro({ TL: 'T+86.54s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_091} · chain:5 · hop:40`, BR: 'PROVE' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_092  `87.3128–87.92` ｜ 证明图采样重组成等式字符阵 EX = EVIDENCE
   ══════════════════════════════════════════════════════════════ */
const SHOT_092 = {
  id: 'SHOT_092', start: 87.3128, end: 87.92,
  seedHex: SEEDS.SHOT_092, chapter: CHAPTER, status: 'MORPH',
  lyric: "Then you're the proof of my / 那么你就是我的证明",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_092 = beatsIn(beats, this.start, this.end);
    const AX = [0.26 * BASE_W, 0.34 * BASE_H];
    const EV = [0.74 * BASE_W, 0.48 * BASE_H];
    const yEq = 0.56 * BASE_H;
    // 三 token：EX / = / EVIDENCE，字号按可用宽度等比缩放
    const toks = [
      { s: 'EX', px: 168, weight: 'Inter Extra-Bold', col: ICE },
      { s: '=', px: 96, weight: 'JetBrains Mono', col: GREY },
      { s: 'EVIDENCE', px: 96, weight: 'JetBrains Mono', col: BV },
    ];
    const widths = toks.map((tk) => {
      const fo = fontOf(tk.weight, tk.px, 1);
      let w = 0;
      for (const ch of tk.s) w += textWidth(fo.font, ch);
      return w + 0.04 * tk.px * tk.s.length;
    });
    const total = widths.reduce((a, b) => a + b, 0) + 48;
    const x0 = 0.18 * BASE_W;
    const span = 0.82 * BASE_W - x0;
    const sc = span / total;
    const xs = [];
    let acc = 0;
    for (let i = 0; i < toks.length; i++) {
      xs.push(x0 + acc * sc);
      acc += widths[i] + 24;
    }
    this._c = { AX, EV, yEq, toks, sc, xs,
                cloud: P.cloudPoints(1400, SEEDS.SHOT_092, 'eco', 'rect',
                                     [0.50, 0.58], 0.32, 0.10) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { AX, yEq, toks, sc, xs } = c;
    const p3 = phase(t, 87.70, 87.84);
    const p4 = phase(t, 87.84, 87.92);

    // 采样网格 + 主词余影（87.44 前）
    if (t <= 87.44) {
      const gx0 = 0.06 * BASE_W, gy0 = 0.14 * BASE_H;
      const gx1 = 0.94 * BASE_W, gy1 = 0.52 * BASE_H;
      for (let i = 0; i < 4; i++) {
        const yy = lerp(gy0, gy1, i / 3.0);
        K.line([gx0, yy], [gx1, yy], GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4.0);
        K.line([xx, gy0], [xx, gy1], GREY, 1.0, 0.30);
      }
      const fa = 1.0 - clamp01(phase(t, 87.44, 87.52));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 168, ["Then you're the", 'proof of my'], 0.08 * BASE_W,
                     [0.20 * BASE_H, 0.36 * BASE_H], 0.04, 87.22, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa,
                       accents: [[["Then you're the", ICE]],
                                 [['proof', CYAN], [' of my', ICE]]] });
      }
    }
    // 等式字符阵（"= 闪主青 87.70–87.76）
    const op = 0.35 + 0.30 * clamp01(p3);
    for (let k = 0; k < toks.length; k++) {
      const tk = toks[k];
      let col = tk.col;
      if (tk.s === '=' && t >= 87.70 && t < 87.76) col = CYAN;
      K.textKit(tk.weight, tk.px * sc, tk.s, xs[k], yEq, col, op, 0.30);
    }
    // 字间电子云 + 分隔槽
    K.dots(c.cloud, 2.0, BV, 0.30, 0.10);
    const yDiv = 0.68 * BASE_H;
    K.dash([0.22 * BASE_W, yDiv], [(0.22 + 0.56 * clamp01(p4)) * BASE_W, yDiv],
           GREY, 1.5, 0.30, 8, 6);
    K.rect(AX[0], AX[1] - 10 * p4, 140, 84, GREY, 1.5, 0.15, 0.0, 4);
    if (t >= 87.86) {
      K.text(FONT_MONO, 44, 'derive:1', 0.70 * BASE_W, 0.46 * BASE_H, GREY, 0,
             0.7 * clamp01(phase(t, 87.86, 87.92)));
    }
    K.micro({ TL: 'T+87.31s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_092} · eq:3tok · 5700pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_093  `87.92–88.59` ｜ 三层等式推导收束 → 终态主词 EXISTENCE 240px
   ══════════════════════════════════════════════════════════════ */
const SHOT_093 = {
  id: 'SHOT_093', start: 87.92, end: 88.59,
  seedHex: SEEDS.SHOT_093, chapter: CHAPTER, status: 'PROVED',
  lyric: 'EXISTENCE / 存在',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_093 = beatsIn(beats, this.start, this.end);
    const toks = [
      { s: 'EX', px: 168, weight: 'Inter Extra-Bold', col: ICE },
      { s: '=', px: 96, weight: 'JetBrains Mono', col: GREY },
      { s: 'EVIDENCE', px: 96, weight: 'JetBrains Mono', col: BV },
    ];
    const widths = toks.map((tk) => {
      const fo = fontOf(tk.weight, tk.px, 1);
      let w = 0;
      for (const ch of tk.s) w += textWidth(fo.font, ch);
      return w;
    });
    const total = widths.reduce((a, b) => a + b, 0) + 48;
    const x0 = 0.18 * BASE_W;
    const sc = (0.82 * BASE_W - x0) / total;
    this._c = { AX: [0.26 * BASE_W, 0.34 * BASE_H], toks, widths, sc, x0 };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { AX, toks, widths, sc, x0 } = c;
    const p1 = easeInQuad(phase(t, 87.92, 88.10));
    const p4 = easeOutExpo(phase(t, 88.46, 88.59));
    const yEq = 0.56 * BASE_H;
    const op = 0.65 + 0.35 * clamp01(p1);
    const gone = clamp01(phase(t, 88.30, 88.46));   // EX = EVIDENCE 碎裂沉底

    // 等式（含删除线与下沉）
    if (gone < 1.0) {
      const sink = easeInQuad(gone) * 220;
      let acc = 0;
      for (let k = 0; k < toks.length; k++) {
        const tk = toks[k];
        K.textKit(tk.weight, tk.px * sc, tk.s, x0 + acc * sc, yEq + sink,
                  tk.col, 0.04, op * (1 - gone));
        acc += widths[k] + 24;
      }
      if (t >= 88.30) {
        const q = clamp01((t - 88.30) / 0.12);
        K.line([0.16 * BASE_W, yEq - 30], [0.16 * BASE_W + 0.26 * BASE_W * q, yEq - 30],
               GREY, 1.5, 0.9, 0.0);
      }
    }
    // 推导行
    const yDr = 0.68 * BASE_H;
    if (t < 88.46) {
      K.text(FONT_MONO, 96, '/', 0.24 * BASE_W, yDr, GREY, 0, 0.8);
      const txt = 'EXISTENCE';
      const fo = fontOf('Inter Extra-Bold', 168, 1);
      let tw = 0;
      for (const ch of txt) tw += textWidth(fo.font, ch);
      let cxp = 0.50 * BASE_W - tw / 2 + 40;
      for (let i = 0; i < txt.length; i++) {
        const st = 88.10 + 0.016 * i;
        if (t < st) continue;
        const col = t >= st + 0.030 ? ICE : BV;
        K.textKit('Inter Extra-Bold', 168, txt[i], cxp, yDr, col, 0.95, 0.30);
        cxp += textWidth(fo.font, txt[i]) + 0.04 * 168;
      }
      K.line([0.26 * BASE_W, 0.76 * BASE_H],
             [0.26 * BASE_W + 0.48 * BASE_W * clamp01(phase(t, 88.10, 88.30)), 0.76 * BASE_H],
             GREY, 1.0, 0.40);
    }
    // 终态主词
    if (t >= 88.46) {
      const px = lerp(168.0, 240.0, p4);
      const cyy = lerp(0.68 * BASE_H, 0.46 * BASE_H, p4);
      K.textKit(FONT_XBOLD, px, 'EXISTENCE', 0.50 * BASE_W, cyy, ICE, 1.0, 0.46, 'center');
      const sc2 = clamp01(phase(t, 88.50, 88.59));
      const fo2 = fontOf('Inter Extra-Bold', px, 1);
      let tw2 = 0;
      for (const ch of 'EXISTENCE') tw2 += textWidth(fo2.font, ch);
      K.disc([0.50 * BASE_W + tw2 / 2 + 26, cyy - 30], 8.0 * sc2, CYAN, 1.0, 0.40);
      K.line([0.28 * BASE_W, 0.76 * BASE_H], [0.72 * BASE_W, 0.76 * BASE_H], GREY, 1.0, 0.40);
    }
    K.rect(AX[0], AX[1], 140, 84, GREY, 1.5, 0.15 * (1 - gone), 0.0, 4);
    if (t < 88.30) {
      K.text(FONT_MONO, 44, 'derive:1', 0.70 * BASE_W, 0.46 * BASE_H, GREY, 0, 0.7);
    }
    K.micro({ TL: 'T+87.92s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_093} · eq:2→1 · rest:2600pt`, BR: 'PROVED' });
    return { bloomR: 10.0, bloomK: 0.44, grain: 5.0 };
  },
};

export const CH04_SHOTS = [SHOT_074, SHOT_075, SHOT_076, SHOT_077, SHOT_078,
                           SHOT_079, SHOT_080, SHOT_081, SHOT_082, SHOT_083,
                           SHOT_084, SHOT_085, SHOT_086, SHOT_087, SHOT_088,
                           SHOT_089, SHOT_090, SHOT_091, SHOT_092, SHOT_093];
export { SC as CH04_SC };