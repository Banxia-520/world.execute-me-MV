/**
 * ch03.js — 第 03 章 STIMULATION / SATISFACTION（镜头 057–073）
 *
 * 自 Python 版 render/scenes/ch03_stimulation.py 移植。
 * 逐镜为纯函数：同一 t 必画出同一画面。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, css,
  easeOutCubic, easeInOutCubic, easeOutExpo, easeOutQuad, easeInQuad,
  easeOutBack, easeInOutSine,
} from './core.js';import * as P from './primitives.js';
import { Frame, Word, fontOf, pulse, beatsIn, arcPts, limitN, easeInOutQuart } from './kit.js';

const CHAPTER = 'ch03/12';
const TAU = Math.PI * 2;

/* 种子表（与 SEED_MIGRATION_MAP.csv 一致）*/
const SEEDS = {
  SHOT_057: '0000057D', SHOT_058: '0000058A', SHOT_059: '0000059B',
  SHOT_060: '0000060C', SHOT_061: '0000061D', SHOT_062: '0000062E',
  SHOT_063: '0000063F', SHOT_064: '0000064A', SHOT_065: '0000065B',
  SHOT_066: '0000066C', SHOT_067: '0000067D', SHOT_068: '0000068A',
  SHOT_069: '0000069B', SHOT_070: '0000070C', SHOT_071: '0000071D',
  SHOT_072: '0000072A', SHOT_073: '0000073B',
};

/* 五块（SHOT_058 用）：名称与颜色 */
const BLOCKS = [
  ['INPUT', CYAN], ['PARSE', BV], ['MAP', MOOD], ['TEMP', WARM], ['OUTPUT', ICE],
];

const SC = {
  beatMap: {},
  seeds: {},
  seed(id) { return this.seeds[id] ?? (this.seeds[id] = seedFromHex(SEEDS[id])); },
  beats(id) { return this.beatMap[id] || []; },
};

/** 四角微信息 */
function corners(f, tl, tr, bl, br) {
  f.micro({ TL: tl, TR: tr, BL: bl, BR: br }, { size: 18, alpha: 0.6 });
}

/** 把排版好的文字栅格化后采样为粒子（对应 Python 的 text_points） */
function textPoints(ctx, lines, px, weight, trackEm, h, v, anchor, lineStep, opts) {
  const { step = 4, n = null, dpr = 1 } = opts || {};
  const c = document.createElement('canvas');
  c.width = BASE_W * dpr; c.height = BASE_H * dpr;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.scale(dpr, dpr);
  const W = new Word(g, lines, px, { weight, trackEm, dpr, h, v, anchor, lineStep });
  g.clearRect(0, 0, BASE_W, BASE_H);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.font = W.font;
  for (const ch of W.chars) g.fillText(ch.ch, ch.x / dpr, ch.baseline / dpr);
  const img = g.getImageData(0, 0, c.width, c.height).data;
  const st = Math.max(1, Math.round(step * dpr));
  const out = [];
  for (let y = 0; y < c.height; y += st) {
    for (let x = 0; x < c.width; x += st) {
      if (img[(y * c.width + x) * 4 + 3] >= 128) {
        const by = y / dpr;
        let li = 0;
        for (let k = 0; k < W.baselines.length; k++) if (by <= W.baselines[k] / dpr) { li = k; break; }
        out.push([x / dpr, by, li]);
      }
    }
  }
  return n ? limitN(out, n) : out;
}

/* ══════════════════════════════════════════════════════════════
   SHOT_057  `59.22–59.69` ｜ If I can（分支树生长）
   ══════════════════════════════════════════════════════════════ */
const SHOT_057 = {
  id: 'SHOT_057', start: 59.22, end: 59.69,
  seedHex: SEEDS.SHOT_057, chapter: CHAPTER, status: 'IF',
  lyric: 'If I can',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_057 = beatsIn(beats, this.start, this.end);
    this._c = { seed: SC.seed('SHOT_057') };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_057');
    const root = [0.08 * BASE_W, 0.88 * BASE_H];
    const tip = [0.52 * BASE_W, 0.46 * BASE_H];

    // ① 坐标十字 + 同心环自 r=10 弹开至 26
    const ringR = lerp(10, 26, easeOutExpo(phase(t, 59.22, 59.38)));
    const ax = 1.0 - 0.55 * clamp01(phase(t, 59.56, 59.69));
    f.line(root[0] - 14 * ax, root[1], root[0] + 14 * ax, root[1], ICE, 1.5, 0.95, 0.8);
    f.line(root[0], root[1] - 14 * ax, root[0], root[1] + 14 * ax, ICE, 1.5, 0.95, 0.8);
    f.ell(root[0], root[1], ringR, ringR, BV, 1.5, 0.9, 0.5);

    // ① 主干生长 + 中段转折环
    const grow = easeOutExpo(phase(t, 59.22, 59.38));
    const gx = lerp(root[0], tip[0], grow);
    const gy = lerp(root[1], tip[1], grow);
    f.line(root[0], root[1], gx, gy, CYAN, 2.5, 0.95, 0.9);
    if (grow > 0.5) {
      f.ell(lerp(root[0], tip[0], 0.5), lerp(root[1], tip[1], 0.5), 14, 14, CYAN, 2, 0.9, 0.6);
    }

    // ② 6 条二级分支（stagger 18ms）+ 转折环
    for (let b = 0; b < 6; b++) {
      const st = 59.38 + b * 0.018;
      const p = easeOutCubic(phase(t, st, st + 0.12));
      if (p <= 0) continue;
      const bx = lerp(root[0], tip[0], 0.25 + 0.12 * b);
      const by = lerp(root[1], tip[1], 0.25 + 0.12 * b);
      const ang = ((-70 + b * 26) * Math.PI) / 180;
      const ex = bx + 190 * p * Math.cos(ang);
      const ey = by + 190 * p * Math.sin(ang) * 0.6;
      f.line(bx, by, ex, ey, BV, 1.5, 0.9, 0.5);
      f.ell(bx + (ex - bx) * 0.7, by + (ey - by) * 0.7, 5, 5, BV, 1.5, 0.8);
    }
    // 24 个叶节点（每点 12ms）
    for (let b = 0; b < 6; b++) {
      for (let k = 0; k < 4; k++) {
        const st = 59.38 + (b * 4 + k) * 0.012;
        if (t < st) continue;
        const bx = lerp(root[0], tip[0], 0.25 + 0.12 * b);
        const by = lerp(root[1], tip[1], 0.25 + 0.12 * b);
        const ang = ((-70 + b * 26) * Math.PI) / 180;
        const ex = bx + 190 * Math.cos(ang) + (k - 1.5) * 30;
        const ey = by + 190 * Math.sin(ang) * 0.6 + (k % 2) * 22;
        f.dot(ex, ey, 3, CYAN, 0.95, 0.7);
      }
    }
    // 分支条件小签 if(cond) ×3
    const mf = fontOf('JetBrains Mono', 46, dpr);
    for (let k = 0; k < 3; k++) {
      if (t < 59.38 + k * 0.06) continue;
      const bx = lerp(root[0], tip[0], 0.30 + 0.10 * k);
      const by = lerp(root[1], tip[1], 0.30 + 0.10 * k);
      f.text(bx + 34, by - 30 + 36, 'if(cond)', mf.font, GREY, 0.5);
    }

    // ③ 主词（`can` 为主青）
    const W = new Word(ctx, ['If I can'], 156, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.38],
    });
    W.draw(f, t, {
      t0: 59.56, stagger: 0.012, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li, ci) => (ci >= 3 ? CYAN : ICE), glowK: 0.35,
    });
    if (t >= 59.56) {
      f.rect(0.04 * BASE_W, 0.40 * BASE_H, 0.68 * BASE_W, 0.94 * BASE_H,
             CYAN, 0, 1, 0, CYAN, 0.02);
    }

    corners(f, 'T+59.22s', CHAPTER, `seed:${SEEDS.SHOT_057} · branch:6`, 'IF');
    return { bloomR: 6.0, bloomK: 0.30 + pulse(t, bs, 0.05, 0.06), grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_058  `59.69–60.96` ｜ If I can give you all the（容器装配）
   ══════════════════════════════════════════════════════════════ */
const SHOT_058 = {
  id: 'SHOT_058', start: 59.69, end: 60.9612,
  seedHex: SEEDS.SHOT_058, chapter: CHAPTER, status: 'LOADED',
  lyric: 'If I can give you all the',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_058 = beatsIn(beats, this.start, this.end);
    this._c = { seed: SC.seed('SHOT_058') };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_058');
    const cx = 0.58 * BASE_W, cy = 0.52 * BASE_H;
    const BW = 360, BH = 420;
    const root = [0.08 * BASE_W, 0.88 * BASE_H];
    const tip = [0.52 * BASE_W, 0.46 * BASE_H];

    // ① 逻辑树退后缩小为背景层
    const tp = easeInOutCubic(phase(t, 59.69, 60.05));
    const trA = lerp(1.0, 0.35, tp);
    const ts = lerp(1.0, 0.86, tp);
    f.line(lerp(root[0], 0.30 * BASE_W, 1 - ts), lerp(root[1], 0.80 * BASE_H, 1 - ts),
           lerp(tip[0], 0.42 * BASE_W, 1 - ts), lerp(tip[1], 0.56 * BASE_H, 1 - ts),
           GREY, 2, trA);
    for (let b = 0; b < 6; b++) {
      const bx = lerp(root[0], tip[0], 0.25 + 0.12 * b);
      const by = lerp(root[1], tip[1], 0.25 + 0.12 * b);
      const ang = ((-70 + b * 26) * Math.PI) / 180;
      f.line(bx, by, bx + 140 * Math.cos(ang), by + 140 * Math.sin(ang) * 0.6, GREY, 1.5, trA);
    }
    f.line(root[0] - 12, root[1], root[0] + 12, root[1], ICE, 1.5, trA);
    f.line(root[0], root[1] - 12, root[0], root[1] + 12, ICE, 1.5, trA);
    f.ell(root[0], root[1], 10, 10, BV, 1.5, trA);

    // ① 容器（沿周长画出一周）+ 6% 填充 + 底部高亮条
    f.rect(cx - BW / 2, cy - BH / 2, cx + BW / 2, cy + BH / 2, CYAN, 0, 1, 0, ICE, 0.06);
    const per = 2 * (BW + BH);
    const drawP = easeOutQuad(phase(t, 59.69, 60.05));
    const box = [[cx - BW / 2, cy + BH / 2], [cx - BW / 2, cy - BH / 2],
                 [cx + BW / 2, cy - BH / 2], [cx + BW / 2, cy + BH / 2]];
    for (let k = 0; k < 4; k++) {
      const s0 = (k * per) / 4;
      const s1 = Math.min(per, drawP * per);
      if (s1 <= s0) continue;
      const u0 = (s1 - s0) / (per / 4);
      const p0 = box[k], p1 = box[(k + 1) % 4];
      f.line(p0[0], p0[1], lerp(p0[0], p1[0], u0), lerp(p0[1], p1[1], u0), CYAN, 1.5, 0.9, 0.7);
    }
    if (t >= 60.62) {
      f.line(cx - BW / 2 + 8, cy + BH / 2 - 4, cx + BW / 2 - 8, cy + BH / 2 - 4, CYAN, 4, 0.95, 1.0);
    }

    // ② 五块以 90ms stagger 飞入（4% 过冲 + 6 颗同色尾迹）
    const lf = fontOf('JetBrains Mono', 42, dpr);
    const slot = 82;
    for (let i = 0; i < BLOCKS.length; i++) {
      const [name, col] = BLOCKS[i];
      const st = 60.05 + i * 0.09;
      if (t < st) continue;
      const p = easeOutBack(phase(t, st, st + 0.22));
      const tx = cx;
      const ty = cy - ((5 - 1) * slot) / 2 + i * slot;
      const px = lerp(root[0], tx, p), py = lerp(root[1], ty, p);
      f.rect(px - 84, py - 37, px + 84, py + 37, col, 2, 0.95, 0.5, null, 0, BG_DEEP, 6);
      if (t < st + 0.30) {
        for (let k = 0; k < 6; k++) {
          const r = new Rng(SC.seed('SHOT_058'), `tr${i}`, k);
          f.dot(px - 84 - k * 8, py + r.range(-30, 30), 2, col, 0.6 * (1 - k / 6), 0.3);
        }
      }
      f.text(px - 70, py - 18 + 30, name, lf.font, name !== 'TEMP' ? BG_DEEP : ICE, 0.95);
    }

    // ③ 主词两行
    const W = new Word(ctx, ['If I can give you', 'all the'], 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.30], lineStep: 1.05 * 144,
    });
    W.draw(f, t, {
      t0: 59.69, stagger: 0.012, dur: 0.12, dy: 8, ease: easeOutCubic,
      color: (li) => (t >= 60.88 && li === 1 ? CYAN : ICE), glowK: 0.35,
    });

    corners(f, 'T+59.69s', CHAPTER, `seed:${SEEDS.SHOT_058} · blocks:5/5`, 'LOADED');
    return {
      bloomR: 8.0, bloomK: 0.35 + pulse(t, bs, 0.05, 0.08), grain: 4.0, scan: 0.06,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_059  `60.96–61.96` ｜ 字形转粒子 → 五条放射通道
   ══════════════════════════════════════════════════════════════ */
const SHOT_059 = {
  id: 'SHOT_059', start: 60.9612, end: 61.96,
  seedHex: SEEDS.SHOT_059, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I can give you all the',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_059 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_059');
    const LINES = ['If I can give you', 'all the'];
    const W = new Word(ctx, LINES, 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.30], lineStep: 1.05 * 144,
    });
    const pts = textPoints(ctx, LINES, 144, 'Inter Semi-Bold', 0.03, 'left',
                           'baseline_first', [0.10, 0.30], 1.05 * 144,
                           { step: 4, n: 4200, dpr: 1 });
    const ring = [];
    for (let i = 0; i < 60; i++) {
      const r = new Rng(seed, 'ring', i);
      ring.push({ a: r.range(0, TAU) });
    }
    this._c = { W, pts, ring, dirs: [0, 1, 2, 3, 4].map((k) => ((90 + k * 72) * Math.PI) / 180) };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // 4×4 采样网格
    if (t < 61.16) {
      for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          f.rect(0.08 * BASE_W + gx * 0.12 * BASE_W, 0.28 * BASE_H + gy * 0.08 * BASE_H,
                 0.08 * BASE_W + (gx + 1) * 0.12 * BASE_W,
                 0.28 * BASE_H + (gy + 1) * 0.08 * BASE_H, GREY, 1, 0.30);
        }
      }
    }

    // 字形残影
    const ghost = 1.0 - clamp01(phase(t, 61.06, 61.12));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (li === 1 ? CYAN : ICE), { alpha: ghost, glowK: 0.4 * ghost });
    }

    // 五条放射通道线（stagger 30ms）
    for (let k = 0; k < 5; k++) {
      const a = c.dirs[k];
      const st = 61.55 + k * 0.03;
      const pp = easeOutExpo(clamp01((t - st) / 0.20));
      if (pp <= 0) continue;
      const ex = cx + 0.26 * BASE_H * Math.cos(a) * pp;
      const ey = cy + 0.26 * BASE_H * Math.sin(a) * pp;
      f.line(cx, cy, ex, ey, CYAN, 2, 0.85 * pp, 0.5);
      f.ell(cx + 0.26 * BASE_H * Math.cos(a), cy + 0.26 * BASE_H * Math.sin(a),
            6, 6, BV, 1.5, 0.9 * pp, 0.5);
    }

    // 词粒子 4200 点吸附到通道（横向保留 40%）
    const groups = [[], [], [], [], []];
    const COL5 = [WARM, CYAN, BV, ICE, MOOD];
    for (let i = 0; i < c.pts.length; i++) {
      const [x, y] = c.pts[i];
      const k = i % 5;
      const a = c.dirs[k];
      const rr = clamp01(phase(t, 61.16 + k * 0.03, 61.55 + k * 0.03));
      const dist = Math.hypot(x - cx, y - cy) * 0.60;
      const tx = cx + (x - cx) * 0.40 + dist * Math.cos(a) * 0.60;
      const ty = cy + (y - cy) * 0.40 + dist * Math.sin(a) * 0.60;
      groups[k].push([lerp(x, tx, rr), lerp(y, ty, rr)]);
    }
    for (let k = 0; k < 5; k++) {
      if (groups[k].length) f.pts(groups[k], 2.0, COL5[k], 1, 0.4);
    }

    // 容器描边溶解为 60 颗环形粒子
    for (const r of c.ring) {
      const rr = 380 * (1 - clamp01(phase(t, 61.82, 61.96)));
      f.dot(cx + rr * Math.cos(r.a), cy + 0.6 * rr * Math.sin(r.a), 2, ICE,
            0.5 * (1 - clamp01(phase(t, 61.55, 61.96))), 0.3);
    }

    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t >= 61.30 && t <= 61.55) {
      f.text(0.72 * BASE_W, 0.88 * BASE_H + 34, 'morph:word→channel', mf.font, GREY, 0.6);
    }

    corners(f, 'T+60.96s', CHAPTER, `seed:${SEEDS.SHOT_059} · sample:4px · 4200pt`, 'MORPH');
    const k = 0.35 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 61.16, 61.45)));
    return { bloomR: 8.0, bloomK: Math.min(0.50, k), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_060  `61.96–62.59` ｜ STIMULATIONS（五感汇聚成核）
   ══════════════════════════════════════════════════════════════ */
const LABELS5 = ['SIGHT', 'SOUND', 'TOUCH', 'TASTE', 'SMELL'];

const SHOT_060 = {
  id: 'SHOT_060', start: 61.96, end: 62.59,
  seedHex: SEEDS.SHOT_060, chapter: CHAPTER, status: 'CONV',
  lyric: 'STIMULATIONS',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_060 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_060');
    const cur = [];
    for (let i = 0; i < 120; i++) {
      const r = new Rng(seed, 'cur', i);
      cur.push({ k: i % 5, jitter: r.range(-0.06, 0.06) });
    }
    const W = new Word(ctx, ['STIMULATIONS'], 201, {
      weight: 'Inter Extra-Bold', trackEm: 0.08, dpr: 1,
      h: 'center', v: 'baseline_first', anchor: [0.50, 0.80],
    });
    this._c = { cur, W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_060');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const mf = fontOf('JetBrains Mono', 42, dpr);

    // ① 五条感官通道线 + 标签
    for (let k = 0; k < 5; k++) {
      const a = ((90 + k * 72) * Math.PI) / 180;
      const st = 61.96 + k * 0.02;
      const pp = easeOutExpo(clamp01((t - st) / 0.18));
      if (pp <= 0) continue;
      f.line(cx + 0.30 * BASE_H * Math.cos(a), cy + 0.30 * BASE_H * Math.sin(a),
             cx + 74 * Math.cos(a), cy + 74 * Math.sin(a), BV, 2, 0.9 * pp, 0.5);
      const la = clamp01(phase(t, 62.14 + k * 0.04, 62.50 + k * 0.04));
      if (la > 0) {
        f.text(cx + 0.30 * BASE_H * 0.72 * Math.cos(a) - 60,
               cy + 0.30 * BASE_H * 0.72 * Math.sin(a) - 12 + 30,
               LABELS5[k], mf.font, GREY, 0.6 * la);
      }
    }

    // ② 120 颗电流粒子冲向核心
    const rush = easeInQuad(phase(t, 62.14, 62.40));
    for (const p of c.cur) {
      const a = ((90 + p.k * 72) * Math.PI) / 180 + p.jitter;
      const rr = lerp(0.30 * BASE_H, 74, rush);
      const px = cx + rr * Math.cos(a);
      const py = cy + rr * Math.sin(a);
      f.line(px - 8 * Math.cos(a), py - 8 * Math.sin(a), px, py, CYAN, 1, 0.8, 0.5);
      f.dot(px, py, 3, CYAN, 0.95, 0.6);
    }

    // ③ 白色核心（撞击过冲 74→88→74）+ 描边 + 向心细线 + 外圈刻度
    const over = 1.0 + 0.19 * Math.sin(Math.PI * clamp01(phase(t, 62.40, 62.50)));
    const rCore = 74 * over;
    f.dot(cx, cy, rCore, ICE, 1, 1.0);
    f.ell(cx, cy, rCore, rCore, CYAN, 8, 0.9, 0.8);
    for (let k = 0; k < 5; k++) {
      const a = ((90 + k * 72) * Math.PI) / 180;
      f.line(cx, cy, cx + rCore * 0.75 * Math.cos(a), cy + rCore * 0.75 * Math.sin(a),
             CYAN, 1, 0.6);
    }
    for (let k = 0; k < 24; k++) {
      const a0 = k * 15.0;
      f.arc(cx, cy, 96, 96, a0, a0 + 6, GREY, 2, t < 62.40 ? 0.40 : 0.75, 0.3);
    }

    // ④ 主词
    c.W.draw(f, t, {
      t0: 62.50, stagger: 0.010, dur: 0.10, dy: 10, ease: easeOutCubic,
      color: () => ICE, glowK: 0.45,
    });

    corners(f, 'T+61.96s', CHAPTER, `seed:${SEEDS.SHOT_060} · ch:5/5`, 'CONV');
    const k = t >= 62.40 ? 0.55 : 0.45;
    return {
      bloomR: 14.0, bloomK: k + pulse(t, bs, 0.06, 0.05), grain: 4.0, scan: 0.05,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_061  `62.59–63.53` ｜ Then I can（布尔面板 TRUE/FALSE）
   ══════════════════════════════════════════════════════════════ */
const SHOT_061 = {
  id: 'SHOT_061', start: 62.59, end: 63.53,
  seedHex: SEEDS.SHOT_061, chapter: CHAPTER, status: 'TRUE',
  lyric: 'Then I can',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_061 = beatsIn(beats, this.start, this.end);
    const sf = fontOf('JetBrains Mono Bold', 168, 1);
    const W = new Word(ctx, ['Then I can'], 156, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.30],
    });
    this._c = { sf, W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.52 * BASE_H;
    const PW = 480, PH = 230;
    const ex = easeInOutCubic(phase(t, 62.59, 62.75));
    const w = lerp(74, PW, ex), h = lerp(74, PH, ex);
    const locked = t >= 63.16;
    const border = locked ? ICE : CYAN;
    f.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, border, 2, 0.95, 0.7,
           null, 0, BG_DEEP, lerp(37, 10, ex));
    // 面板内衬（深色）
    f.rect(cx - w / 2 + 3, cy - h / 2 + 3, cx + w / 2 - 3, cy + h / 2 - 3,
           BG_ALT, 0, 0.90, 0, BG_ALT, 0.90);
    if (t < 63.16) f.ell(cx, cy, 30, 30, CYAN, 0, 0.25, 0, CYAN, 0.25);

    // ② 6 次 FALSE/TRUE 硬切（68ms），第 7 次锁定 TRUE
    const flipI = t >= 62.75 ? Math.floor((t - 62.75) / 0.068) : 0;
    const isTrue = t < 63.16 ? flipI % 2 === 1 : true;
    const txt = isTrue ? 'TRUE' : 'FALSE';
    const col = (isTrue ? (locked ? ICE : CYAN) : GREY);
    ctx.save();
    ctx.font = c.sf.font;
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(txt).width / dpr;
    ctx.restore();
    f.text(cx - tw / 2, cy - 78 + 120, txt, c.sf.font, col, 0.95, 0.5);
    // 闪切瞬间的反色边框
    if (t >= 62.75 && t < 63.16 && (t - 62.75) % 0.068 < 0.017) {
      f.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, BV, 2, 0.9, 0.6);
    }
    // ③ 左右各 8 枚布尔位方块
    const bits = locked ? 16 : (flipI * 3) % 17;
    for (let k = 0; k < 16; k++) {
      const side = k < 8 ? -1 : 1;
      const idx = k % 8;
      const bx = cx + side * (PW / 2 + 26 + (idx % 2) * 14);
      const by = cy - 91 + idx * 26;
      const on = k < bits;
      if (on) {
        f.rect(bx - 6, by - 6, bx + 6, by + 6, CYAN, 0, 0.95, 0, CYAN, 1.0);
      } else {
        f.rect(bx - 6, by - 6, bx + 6, by + 6, GREY, 1, 0.5, 0);
      }
    }
    // ④ 继承虚线环
    for (let k = 0; k < 24; k++) {
      const a0 = k * 15.0;
      f.arc(cx, cy, Math.max(w / 2 + 8, 128), Math.max(h / 2 + 8, 76.8), a0, a0 + 6, GREY, 2, 0.40);
    }
    if (t >= 63.16 && t <= 63.24) {
      const pu = 1.0 + 0.05 * Math.sin((Math.PI * (t - 63.16)) / 0.08);
      f.rect(cx - (w / 2) * pu, cy - (h / 2) * pu, cx + (w / 2) * pu, cy + (h / 2) * pu, ICE, 1, 0.4);
    }
    // 主词
    c.W.draw(f, t, {
      t0: 63.38, stagger: 0.014, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li, ci) => (ci >= 5 ? CYAN : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(cx - 130, cy + h / 2 + 14 + 34, 'state:boolean', mf.font, GREY, 0.55);
    if (t >= 63.38) {
      for (let k = 0; k < 3; k++) {
        f.line(cx - 90 + k * 90, cy + h / 2, cx - 60 + k * 90, cy + h / 2 + 40, GREY, 1.5, 0.5);
      }
    }

    corners(f, 'T+62.59s', CHAPTER, `seed:${SEEDS.SHOT_061} · flip:7`, 'TRUE');
    return {
      bloomR: 8.0,
      bloomK: 0.42 + (t >= 63.16 && t <= 63.30 ? 0.08 : 0),
      grain: 4.0, scan: 0.05,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_062  `63.53–64.5772` ｜ 48 条路径收敛为唯一链
   ══════════════════════════════════════════════════════════════ */
const SHOT_062 = {
  id: 'SHOT_062', start: 63.53, end: 64.5772,
  seedHex: SEEDS.SHOT_062, chapter: CHAPTER, status: 'ONE',
  lyric: 'Then I can be your only',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_062 = beatsIn(beats, this.start, this.end);
    const ox = 0.12 * BASE_W, oy = 0.84 * BASE_H;
    const tgt = [0.84 * BASE_W, 0.26 * BASE_H];
    // 预生成 48 条贝塞尔曲线（只依赖 k，与 t 无关）
    const curves = [];
    for (let k = 0; k < 48; k++) {
      const ang = ((-64 + k * 2.7) * Math.PI) / 180;
      curves.push(P.curvePoints('bezier', 40, 0, {
        p0: [ox, oy],
        p1: [ox + 400 * Math.cos(ang), oy + 400 * Math.sin(ang)],
        p2: tgt,
      }));
    }
    const active = P.curvePoints('bezier', 60, 0, {
      p0: [ox, oy],
      p1: [ox + 400 * Math.cos(((-64 + 12 * 2.7) * Math.PI) / 180),
           oy + 400 * Math.sin(((-64 + 12 * 2.7) * Math.PI) / 180)],
      p2: tgt,
    });
    const seed = SC.seed('SHOT_062');
    const flow = [];
    for (let i = 0; i < 12; i++) flow.push(new Rng(seed, 'flow', i).next());
    const W = new Word(ctx, ['Then I can be', 'your only'], 148, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.38], lineStep: 1.06 * 148,
    });
    this._c = { curves, active, flow, W, ox, oy, tgt };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const tgt = c.tgt;
    const killed = Math.floor(clamp01(phase(t, 63.68, 64.10)) * 47);
    const fade = 1 - 0.6 * clamp01(phase(t, 64.10, 64.34));

    for (let k = 0; k < 48; k++) {
      if (k === 12 || k < killed) continue;
      const st = 63.53 + k * 0.006;
      const p = easeOutQuad(phase(t, st, st + 0.18));
      if (p <= 0) continue;
      const pts = c.curves[k];
      const n = Math.max(2, Math.floor(40 * p));
      f.pline(pts.slice(0, n), GREY, 1.5, 0.35 * fade);
      for (let j = 0; j < 5; j++) {
        const idx = Math.min(39, Math.floor((40 * (j + 1)) / 6));
        f.dot(pts[idx][0], pts[idx][1], 3, GREY, 0.30);
      }
    }

    // ② 唯一激活链 + 12 颗电流粒子（拖尾 10px）
    f.pline(c.active, CYAN, t >= 64.10 ? 3 : 1.5, 0.95, 0.7);
    if (t >= 64.10) {
      for (let i = 0; i < 12; i++) {
        const ph = ((t - 64.10) * 0.55 + c.flow[i]) % 1.0;
        const idx = Math.floor(ph * 59);
        for (let j = 0; j < 5; j++) {
          const jj = Math.max(0, idx - j);
          f.dot(c.active[jj][0], c.active[jj][1], 2, CYAN, 0.9 - j * 0.15, 0.4);
        }
      }
    }

    // ③ 目标节点环 + 环心暖点
    const pu = 1.0 + 0.06 * Math.sin(Math.PI * clamp01(phase(t, 64.48, 64.58)));
    f.ell(tgt[0], tgt[1], 14 * pu, 14 * pu, ICE, 1.5, 0.95, 0.7);
    f.dot(tgt[0], tgt[1], 4, WARM, 1, 1.0);

    // ④ 右上 TRUE 徽标
    f.rect(0.86 * BASE_W - 60, 0.14 * BASE_H - 28, 0.86 * BASE_W + 60, 0.14 * BASE_H + 28,
           ICE, 1.5, 0.8, 0.4, BG_ALT, 0.9, BG_DEEP, 6);
    const bf = fontOf('JetBrains Mono', 42, dpr);
    f.text(0.86 * BASE_W - 48, 0.14 * BASE_H - 14 + 30, 'TRUE', bf.font, ICE, 0.9);

    // 主词
    c.W.draw(f, t, {
      t0: 64.34, stagger: 0.014, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li, ci) => (t >= 64.48 && li === 1 && ci >= 5 ? WARM : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.46 * BASE_W, 0.90 * BASE_H + 34, 'paths:48 → 1', mf.font, GREY, 0.55);

    corners(f, 'T+63.53s', CHAPTER, `seed:${SEEDS.SHOT_062} · paths:48→1`, 'ONE');
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_063  `64.5772–65.40` ｜ 字形转粒子 → 仪表弧
   ══════════════════════════════════════════════════════════════ */
const SHOT_063 = {
  id: 'SHOT_063', start: 64.5772, end: 65.40,
  seedHex: SEEDS.SHOT_063, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Then I can be your only',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_063 = beatsIn(beats, this.start, this.end);
    const LINES = ['Then I can be', 'your only'];
    const W = new Word(ctx, LINES, 148, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.38], lineStep: 1.06 * 148,
    });
    const pts = textPoints(ctx, LINES, 148, 'Inter Semi-Bold', 0.03, 'left',
                           'baseline_first', [0.10, 0.38], 1.06 * 148,
                           { step: 4, n: 3600, dpr: 1 });
    this._c = { W, pts };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.66 * BASE_H, R = 230;

    if (t < 64.74) {
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 6; gx++) {
          f.rect(0.08 * BASE_W + gx * 0.08 * BASE_W, 0.34 * BASE_H + gy * 0.05 * BASE_H,
                 0.08 * BASE_W + (gx + 1) * 0.08 * BASE_W,
                 0.34 * BASE_H + (gy + 1) * 0.05 * BASE_H, GREY, 1, 0.30);
        }
      }
    }
    const ghost = 1.0 - clamp01(phase(t, 64.70, 64.76));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li, ci) => (li === 1 && ci >= 5 ? WARM : ICE),
                    { alpha: ghost, glowK: 0.4 * ghost });
    }

    // ② 执行链退为背景
    const chainA = 0.5 * (1 - clamp01(phase(t, 65.30, 65.40)));
    f.line(0.12 * BASE_W, 0.84 * BASE_H, 0.84 * BASE_W, 0.26 * BASE_H, CYAN, 3, 0.5 * chainA, 0.4);
    f.ell(0.84 * BASE_W, 0.26 * BASE_H + 8, 14, 14, ICE, 1.5, chainA, 0.5);

    // ③ 仪表底座弧 + 粒子吸附 + 21 根刻度
    f.arc(cx, cy, R, R, 200, 340, GREY, 10, 0.30);
    const morph = easeInOutCubic(phase(t, 64.74, 65.12));
    const n = c.pts.length;
    const ice = [], iceA = [], warm = [], warmA = [];
    for (let i = 0; i < n; i++) {
      const [x, y, li] = c.pts[i];
      const a = ((200 + ((i % 3600) / 3600) * 140) * Math.PI) / 180;
      const rr = R + ((i * 7) % 17) - 8;
      const tx = cx + rr * Math.cos(a), ty = cy + rr * Math.sin(a);
      const px = lerp(x, cx + (x - cx) * 0.60, morph);
      const py = lerp(y, cy + (y - cy) * 0.60, morph);
      const P2 = [lerp(px, tx, morph), lerp(py, ty, morph)];
      if (li === 0) { ice.push(P2); iceA.push(0.8); } else { warm.push(P2); warmA.push(0.85); }
    }
    f.pts(ice, 2.5, CYAN, 1, 0.5, BG_DEEP, iceA);
    f.pts(warm, 2.5, WARM, 1, 0.6, BG_DEEP, warmA);
    for (let k = 0; k < 21; k++) {
      if (t < 65.12 + k * 0.008) continue;
      const a = ((200 + k * 7) * Math.PI) / 180;
      f.line(cx + (R - 12) * Math.cos(a), cy + (R - 12) * Math.sin(a),
             cx + (R + 12) * Math.cos(a), cy + (R + 12) * Math.sin(a), GREY, 2, 0.8);
      f.line(cx + R * Math.cos(a), cy + R * Math.sin(a),
             cx + (R + 10) * Math.cos(a), cy + (R + 10) * Math.sin(a), CYAN, 4, 0.5, 0.4);
    }
    const rise = 8.0 * easeInQuad(phase(t, 65.30, 65.40));
    const aEnd = (340 * Math.PI) / 180;
    f.ell(cx + R * Math.cos(aEnd), cy + R * Math.sin(aEnd) - rise, 14, 14, ICE, 1.5, 0.9, 0.6);

    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t >= 64.80 && t <= 65.00) {
      f.text(0.74 * BASE_W, 0.88 * BASE_H + 34, 'morph:word→gauge', mf.font, GREY, 0.6);
    }
    corners(f, 'T+64.58s', CHAPTER, `seed:${SEEDS.SHOT_063} · sample:4px · 3600pt`, 'MORPH');
    const k = 0.42 + 0.08 * Math.sin(Math.PI * clamp01(phase(t, 64.74, 65.02)));
    return { bloomR: 9.0, bloomK: Math.min(0.50, k), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_064  `65.40–66.60` ｜ SATISFACTION（情绪曲线达成峰值）
   ══════════════════════════════════════════════════════════════ */
const SHOT_064 = {
  id: 'SHOT_064', start: 65.40, end: 66.60,
  seedHex: SEEDS.SHOT_064, chapter: CHAPTER, status: 'PEAK',
  lyric: 'SATISFACTION',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_064 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ['SATISFACTION'], 209, {
      weight: 'Inter Extra-Bold', trackEm: 0.06, dpr: 1,
      h: 'center', v: 'baseline_first', anchor: [0.50, 0.86],
    });
    this._c = { W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.62 * BASE_H, R = 250;
    const span = lerp(120, 160, easeOutExpo(phase(t, 65.40, 65.60)));
    const a0 = 200, a1 = 200 + span;
    let fillP = lerp(0.35, 1.0, easeInOutCubic(phase(t, 65.60, 66.18)));
    if (t >= 66.18) fillP = lerp(1.0, 0.96, clamp01(phase(t, 66.18, 66.40)));
    f.arc(cx, cy, R, R, a0, a1, GREY, 10, 0.30);
    f.arc(cx, cy, R, R, a0, a0 + span * fillP, CYAN, 10, 0.95, 0.7);
    for (let k = 0; k < 25; k++) {
      const a = ((a0 + (span * k) / 24) * Math.PI) / 180;
      f.line(cx + (R - 14) * Math.cos(a), cy + (R - 14) * Math.sin(a),
             cx + (R + 14) * Math.cos(a), cy + (R + 14) * Math.sin(a), GREY, 2, 0.7);
    }

    // ② 情绪曲线 + 峰值处渐变填充
    const cur = easeInOutCubic(phase(t, 65.60, 66.18));
    const NN = 120;
    const curve = [];
    for (let i = 0; i < NN; i++) {
      const u = i / (NN - 1);
      curve.push([lerp(0.28 * BASE_W, 0.66 * BASE_W, u),
                  lerp(0.58 * BASE_H, 0.30 * BASE_H, easeInOutCubic(u)), u]);
    }
    const vis = curve.filter((p) => p[2] <= Math.max(0.02, cur));
    if (vis.length > 1) {
      f.pline(vis.map((p) => [p[0], p[1]]), ICE, 3, 0.95, 0.7);
      const last = vis[vis.length - 1];
      f.rect(last[0] - 40, last[1], last[0], last[1] + 40, CYAN, 0, 1, 0, CYAN, 0.12);
    }

    // ③ 峰值点 + 三层扩散光环
    if (cur > 0.95) {
      const rings = [[28, 0.30], [48, 0.16], [72, 0.08]];
      for (let k = 0; k < rings.length; k++) {
        if (t < 66.18 + k * 0.06) continue;
        f.ell(0.66 * BASE_W, 0.30 * BASE_H, rings[k][0], rings[k][0], WARM, 2, rings[k][1], 0.5);
      }
      const pu = 1.0 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 66.18, 66.26)));
      f.dot(0.66 * BASE_W, 0.30 * BASE_H, 10 * pu, WARM, 1, 1.0);
    }
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t >= 66.18) {
      f.text(0.66 * BASE_W + 12, 0.30 * BASE_H + 12 + 34, 'peak:100%', mf.font, WARM, 0.85);
    }
    c.W.draw(f, t, {
      t0: 66.40, stagger: 0.012, dur: 0.10, dy: 10, ease: easeOutCubic,
      color: (li, ci) => (t >= 66.30 && ci >= 5 ? CYAN : ICE), glowK: 0.45,
    });
    corners(f, 'T+65.40s', CHAPTER, `seed:${SEEDS.SHOT_064} · gauge:160°`, 'PEAK');
    const k = 0.42 + 0.13 * Math.sin(Math.PI * clamp01(phase(t, 66.18, 66.40)));
    return { bloomR: 12.0, bloomK: Math.min(0.55, k), grain: 4.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_065  `66.60–67.524` ｜ 平直波形抬起成笑脸
   ══════════════════════════════════════════════════════════════ */
const SHOT_065 = {
  id: 'SHOT_065', start: 66.60, end: 67.524,
  seedHex: SEEDS.SHOT_065, chapter: CHAPTER, status: 'MOOD',
  lyric: 'If I can make you happy',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_065 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_065');
    const petal = [];
    for (let i = 0; i < 96; i++) {
      const r = new Rng(seed, 'petal', i);
      petal.push({ k: i % 5, jA: r.range(-0.2, 0.2), rr: r.range(40, 120) });
    }
    const W = new Word(ctx, ['If I can make you', 'happy'], 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.44], lineStep: 1.05 * 144,
    });
    this._c = { petal, W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_065');
    const yb = 0.54 * BASE_H, x0 = 0.02 * BASE_W, x1 = 0.98 * BASE_W;

    // ① 峰值光点沉降至波形带并转灰蓝
    const mp = easeInOutCubic(phase(t, 66.60, 66.82));
    f.dot(lerp(0.66 * BASE_W, 0.30 * BASE_W, mp), lerp(0.30 * BASE_H, 0.58 * BASE_H, mp),
          10 * (1 - 0.5 * mp), mp < 0.9 ? WARM : GREY, 0.95, 1.0);
    const ga = 1 - easeInQuad(phase(t, 66.60, 66.78));
    if (ga > 0.02) f.arc(0.50 * BASE_W, 0.62 * BASE_H, 250, 250, 200, 360, CYAN, 10, 0.9 * ga, 0.5);

    // ② 波形带：左 40% 平直，右 60% 抬起
    const flatP = easeOutQuad(phase(t, 66.60, 66.82));
    f.line(x0, yb, lerp(x0, x0 + 0.40 * BASE_W, flatP), yb, GREY, 4, 0.6);
    const NN = 512;
    const rise = clamp01(phase(t, 66.82, 67.16));
    const pts = [];
    for (let i = 0; i < NN; i++) {
      const u = i / (NN - 1);
      const amp = 0.14 * BASE_H * easeInOutSine(Math.max(0, (u - 0.04) / 0.96)) * rise;
      const jit = 3.0 * Math.sin(2 * Math.PI * 8 * (t - 66.82) + u * 40) * rise;
      pts.push([lerp(x0, x1, u), yb - amp + jit]);
    }
    f.pline(pts.filter((_, i) => i / (NN - 1) >= 0.40), CYAN, 4, 0.95, 0.7);
    const vx = lerp(0.50, 0.68, easeInOutSine(phase(t, 66.82, 67.16)));
    f.dot(vx * BASE_W, yb - 0.14 * BASE_H, 5, ICE, 1, 0.8);
    if (t >= 66.90) {
      f.pline(pts.slice(Math.floor(NN * 0.40), Math.floor(NN * 0.74)), ICE, 4, 0.55, 0.5);
    }
    for (const xx of [0.34 * BASE_W, 0.96 * BASE_W]) {
      f.ell(xx, yb, 5, 5, BV, 2, 0.9, 0.5);
    }

    // ③ 96 颗花瓣粒子分 5 瓣弹出
    for (let i = 0; i < c.petal.length; i++) {
      const p0 = c.petal[i];
      const baseA = ((-90 + (p0.k - 2) * 32) * Math.PI) / 180;
      const st = 67.16 + p0.k * 0.024;
      const p = easeOutBack(clamp01((t - st) / 0.24));
      const fall = easeInQuad(clamp01((t - st - 0.10) / 0.20));
      const rr = p0.rr * p;
      const px = vx * BASE_W + rr * Math.cos(baseA + p0.jA);
      const py = yb - 0.14 * BASE_H + rr * Math.sin(baseA) + fall * 40;
      const col = i % 2 === 0 ? MOOD : ICE;
      f.dot(px, py, 3, col, 0.9 - 0.3 * fall, 0.5);
      if (p > 0.2) {
        f.line(px - 12 * Math.cos(baseA), py - 12 * Math.sin(baseA), px, py, col, 1,
               0.4 * (1 - fall), 0.3);
      }
    }

    // ④ 主词（happy 于 67.45 转情绪紫）
    c.W.draw(f, t, {
      t0: 67.40, stagger: 0.013, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li) => (t >= 67.45 && li === 1 ? MOOD : ICE), glowK: 0.4,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(x0 + 20, yb + 14 + 34, 'mood:flat→smile', mf.font, GREY, 0.55);
    corners(f, 'T+66.60s', CHAPTER, `seed:${SEEDS.SHOT_065} · wave:512pt`, 'MOOD');
    return { bloomR: 10.0, bloomK: 0.40 + pulse(t, bs, 0.06, 0.08), grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_066  `67.524–68.25` ｜ 全部粒子塌缩重组成提示行
   ══════════════════════════════════════════════════════════════ */
const SHOT_066 = {
  id: 'SHOT_066', start: 67.524, end: 68.25,
  seedHex: SEEDS.SHOT_066, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I can make you happy',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_066 = beatsIn(beats, this.start, this.end);
    const LINES = ['If I can make you', 'happy'];
    const W = new Word(ctx, LINES, 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.44], lineStep: 1.05 * 144,
    });
    const base = textPoints(ctx, LINES, 144, 'Inter Semi-Bold', 0.03, 'left',
                            'baseline_first', [0.10, 0.44], 1.05 * 144,
                            { step: 4, n: 3300, dpr: 1 });
    // 追加波形 512 点 + 花瓣 96 点（与 Python 版一致）
    const pts = base.map((p) => [p[0], p[1], p[2]]);
    for (let i = 0; i < 512; i++) {
      const u = i / 511;
      pts.push([lerp(0.02 * BASE_W, 0.98 * BASE_W, u),
                0.54 * BASE_H - 0.14 * BASE_H * easeInOutSine(u), 0]);
    }
    const seed = SC.seed('SHOT_066');
    for (let i = 0; i < 96; i++) {
      const r = new Rng(seed, 'petal', i);
      pts.push([0.68 * BASE_W + r.range(-70, 70), 0.40 * BASE_H + r.range(-40, 60), 1]);
    }
    // 每点的收敛目标与不透明度（确定性预计算）
    const meta = pts.map((p, i) => {
      const r = new Rng(seed, 'col', i);
      return { dy: r.range(-0.08, 0.08) * BASE_H, a: i % 3 ? 0.6 : 0.9 };
    });
    const dust = [];
    for (let i = 0; i < 200; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0.10, 0.70) * BASE_W, r.range(0, 20)]);
    }
    this._c = { W, pts, meta, dust };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const ybLine = 0.72 * BASE_H;

    // 闪烁采样网格
    if (t < 67.68 && Math.floor((t - 67.52) / 0.04) % 2 === 0) {
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          f.rect(0.08 * BASE_W + gx * 0.18 * BASE_W, 0.42 * BASE_H + gy * 0.07 * BASE_H,
                 0.08 * BASE_W + (gx + 1) * 0.18 * BASE_W,
                 0.42 * BASE_H + (gy + 1) * 0.07 * BASE_H, GREY, 1, 0.30);
        }
      }
    }
    const ghost = 1 - clamp01(phase(t, 67.64, 67.70));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (li === 1 ? MOOD : ICE), { alpha: ghost, glowK: 0.4 * ghost });
    }

    // 粒子塌缩到提示行
    const collapse = easeInOutQuart(phase(t, 67.68, 68.00));
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const [x, y] = c.pts[i];
      const tx = x * 0.70 + 0.12 * BASE_W * 0.30;
      const ty = ybLine + c.meta[i].dy * (1 - collapse);
      dp.push([lerp(x, tx, collapse), lerp(y, ty, collapse)]);
      al.push(c.meta[i].a);
    }
    f.pts(dp, 2.0, ICE, 1, 0.4, BG_DEEP, al);

    // ③ 重组为提示行 + 行首光标
    if (t >= 68.00) {
      const L = 1180 * easeOutQuad(phase(t, 68.00, 68.16));
      f.line(0.12 * BASE_W, ybLine, 0.12 * BASE_W + L, ybLine, GREY, 4, 0.6, 0.4);
      f.line(0.12 * BASE_W, ybLine, 0.12 * BASE_W + Math.min(L, 142), ybLine, CYAN, 4, 0.95, 0.7);
      if (Math.floor((t - 68.00) / 0.5) % 2 === 0) {
        f.rect(0.12 * BASE_W - 20, ybLine - 11, 0.12 * BASE_W - 8, ybLine + 11, CYAN, 0, 1, 0, CYAN, 1.0);
      }
    }
    for (const d of c.dust) {
      f.dot(d[0], ybLine - d[1], 2, ICE, 0.6 * (1 - clamp01(phase(t, 68.16, 68.25))), 0.2);
    }
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t < 67.60) f.text(0.02 * BASE_W + 20, 0.54 * BASE_H + 14 + 34, 'mood:flat→smile', mf.font, GREY, 0.55);
    if (t >= 68.05) f.text(0.12 * BASE_W, ybLine - 60 + 34, '>_ ready', mf.font, GREY, 0.5);

    corners(f, 'T+67.52s', CHAPTER, `seed:${SEEDS.SHOT_066} · sample:4px · 3908pt`, 'MORPH');
    const k = 0.40 + 0.10 * Math.sin(Math.PI * clamp01(phase(t, 67.68, 67.95)));
    return { bloomR: 8.0, bloomK: Math.min(0.50, k), grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_067  `68.25–69.26` ｜ 执行队列五行（run）
   ══════════════════════════════════════════════════════════════ */
const SHOT_067 = {
  id: 'SHOT_067', start: 68.25, end: 69.26,
  seedHex: SEEDS.SHOT_067, chapter: CHAPTER, status: 'RUN',
  lyric: 'I will run the',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_067 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ['I will run the'], 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.36],
    });
    this._c = { W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_067');
    const x0 = 0.12 * BASE_W;
    const rise = easeOutExpo(phase(t, 68.25, 68.44));
    const yFirst = lerp(0.72 * BASE_H, 0.50 * BASE_H, rise);
    const ROWS = 5, LH = 44, runRow = 3;
    const mf = fontOf('JetBrains Mono', 46, dpr);

    for (let i = 0; i < ROWS; i++) {
      const st = 68.25 + i * 0.03;
      const yy = yFirst + i * LH;
      if (t < st) continue;
      const frameP = easeOutExpo(clamp01((t - st) / 0.16));
      const nDots = 220 + i * 30;
      const drawn = Math.floor(nDots * clamp01((t - (68.44 + i * 0.012)) / 0.09));
      const col = i === runRow ? CYAN : GREY;
      for (let k = 0; k < Math.max(0, drawn); k += 2) {
        const xx = x0 + 34 + k * 4.0 * frameP;
        f.rect(xx, yy - 8, xx + 3, yy + 8, col, 0, 1, 0, col, i === runRow ? 0.85 : 0.6);
      }
      if (i === runRow && t >= 68.92) {
        f.text(x0 + 34, yy - 22 + 34, 'run', mf.font, CYAN, 0.95, 0.6);
      }
      if (i === 4 && t >= 68.44 && t <= 68.80) {
        const half = clamp01((t - 68.44 - 4 * 0.012) / 0.09);
        if (half > 0.5) {
          f.rect(x0 + 34 + Math.floor(nDots * (1 - half)) * 4.0, yy - 8,
                 x0 + 34 + Math.floor(nDots * half) * 4.0, yy + 8, WARM, 0, 1, 0, WARM, 0.5);
        }
      }
      if (i === runRow) {
        const on = t >= 68.92
          ? Math.floor((t - 68.92) / 0.5) % 2 === 0
          : Math.floor(t / 0.5) % 2 === 0;
        if (on) f.rect(x0, yy - 11, x0 + 12, yy + 11, CYAN, 0, 1, 0, CYAN, 1.0);
      } else {
        f.rect(x0, yy - 11, x0 + 12, yy + 11, GREY, 1, 0.30);
      }
    }

    // ③ 右侧执行状态条
    for (let i = 0; i < 4; i++) {
      const bx = 0.88 * BASE_W, by = 0.44 * BASE_H + i * 50;
      if (i < 3) {
        f.rect(bx - 5, by, bx + 5, by + 40, CYAN, 0, 1, 0, CYAN, 0.9);
      } else {
        const fillH = 20 * clamp01(phase(t, 69.10, 69.26));
        f.rect(bx - 5, by, bx + 5, by + 40, WARM, 1, 0.8);
        f.rect(bx - 5, by + 40 - fillH, bx + 5, by + 40, WARM, 0, 1, 0, WARM, 0.9);
      }
    }
    f.rect(0.88 * BASE_W - 5, 0.44 * BASE_H + 150, 0.88 * BASE_W + 5, 0.44 * BASE_H + 190, GREY, 1, 0.5);

    // ④ 主词
    c.W.draw(f, t, {
      t0: 69.10, stagger: 0.014, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li, ci) => (t >= 69.18 && ci >= 7 && ci <= 9 ? CYAN : ICE), glowK: 0.4,
    });
    const mf2 = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.62 * BASE_W, 0.84 * BASE_H + 34, 'queue:5 · cursor:RUN', mf2.font, GREY, 0.55);
    corners(f, 'T+68.25s', CHAPTER, `seed:${SEEDS.SHOT_067} · queue:5/5`, 'RUN');
    return { bloomR: 8.0, bloomK: 0.42 + pulse(t, bs, 0.05, 0.06), grain: 5.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_068  `69.26–70.08` ｜ EXECUTION 由 258px 缩为命令 token
   ══════════════════════════════════════════════════════════════ */
const SHOT_068 = {
  id: 'SHOT_068', start: 69.26, end: 70.08,
  seedHex: SEEDS.SHOT_068, chapter: CHAPTER, status: 'EXEC',
  lyric: 'EXECUTION',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_068 = beatsIn(beats, this.start, this.end);
    const fBig = fontOf('Inter Extra-Bold', 258, 1);
    const fMono46 = fontOf('JetBrains Mono', 46, 1);
    this._c = { fBig, fMono46 };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // ① 队列残影
    const qa = 1.0 - easeInQuad(phase(t, 69.26, 69.40));
    if (qa > 0.02) {
      const Wq = new Word(ctx, ['I will run the'], 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr,
        h: 'left', v: 'baseline_first', anchor: [0.10, 0.36],
      });
      Wq.drawPlain(f, ICE, { alpha: qa, glowK: 0.3 * qa });
      for (let i = 0; i < 5; i++) {
        f.rect(0.12 * BASE_W, 0.50 * BASE_H + i * 44 - 8, 0.60 * BASE_W,
               0.50 * BASE_H + i * 44 + 8, GREY, 0, 1, 0, GREY, 0.4 * qa);
      }
    }
    const sp = lerp(0.94, 1.0, easeOutExpo(phase(t, 69.26, 69.48)));

    if (t < 69.76) {
      // 主词：258px，随后逐字擦除
      const size = t < 69.48 ? 258 : lerp(258, 96, easeInOutCubic(phase(t, 69.48, 69.76)));
      const erase = t < 69.48 ? 0 : Math.floor(clamp01((t - 69.48) / 0.16) * 3);
      const text = 'EXECUTION'.slice(0, 9 - erase);
      const fnt = fontOf('Inter Extra-Bold', Math.round(size * sp), dpr);
      const track = 0.10 * size * sp;
      ctx.save();
      ctx.font = fnt.font;
      const advs = [...text].map((ch) => ctx.measureText(ch).width / dpr);
      ctx.restore();
      const wpx = advs.reduce((a, b) => a + b, 0) + track * Math.max(0, text.length - 1);
      let acc = cx - wpx / 2;
      const yStart = cy - size * sp * 0.36;
      for (let ci = 0; ci < text.length; ci++) {
        const col = (ci === 0 || ci === text.length - 1) ? CYAN : ICE;
        f.text(acc, yStart + 34, text[ci], fnt.font, col, 1.0, 0.55, fnt.stroke * sp);
        acc += advs[ci] + track;
      }
    } else {
      // 收缩为命令行
      const size = lerp(96, 46, easeOutQuad(phase(t, 69.76, 69.94)));
      const mf = fontOf('JetBrains Mono', Math.round(size), dpr);
      const slide = easeOutQuad(phase(t, 69.76, 69.94));
      ctx.save(); ctx.font = mf.font;
      const tw = ctx.measureText('execution:done').width / dpr;
      ctx.restore();
      const x = lerp(cx - tw / 2, 0.12 * BASE_W, slide);
      f.text(x, 0.70 * BASE_H - size * 0.5 + 34, 'execution:done', mf.font, GREY, 0.85);
    }
    for (let k = 0; k < 3; k++) {
      if (t >= 69.76 + k * 0.05) continue;
      f.dot(0.66 * BASE_W + k * 26, 0.70 * BASE_H - 8, 5, k < 2 ? CYAN : GREY, 0.9, 0.5);
    }
    if (t >= 69.94 && Math.floor((t - 69.94) / 0.5) % 2 === 0) {
      f.rect(0.12 * BASE_W, 0.70 * BASE_H - 11, 0.12 * BASE_W + 12, 0.70 * BASE_H + 11,
             CYAN, 0, 1, 0, CYAN, 1.0);
    }
    corners(f, 'T+69.26s', CHAPTER, `seed:${SEEDS.SHOT_068} · scale:300→46px`, 'EXEC');
    return {
      bloomR: t < 69.48 ? 16.0 : 8.0, bloomK: t < 69.48 ? 0.60 : 0.35,
      grain: 5.0, scan: 0.06,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_069  `70.08–71.02` ｜ Though we are trapped（边界加厚）
   ══════════════════════════════════════════════════════════════ */
const SHOT_069 = {
  id: 'SHOT_069', start: 70.08, end: 71.0208,
  seedHex: SEEDS.SHOT_069, chapter: CHAPTER, status: 'LOCK',
  lyric: 'Though we are trapped',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_069 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ['Though we are', 'trapped'], 156, {
      weight: 'Inter Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.44], lineStep: 1.05 * 156,
    });
    this._c = { W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_069');
    const cx = 0.50 * BASE_W, cy = 0.54 * BASE_H;
    const BW = 520, BH = 400;

    const curX = lerp(0.12 * BASE_W, 0.30 * BASE_W, easeOutQuad(phase(t, 70.08, 70.26)));
    const curY = lerp(0.70 * BASE_H, 0.66 * BASE_H, easeOutQuad(phase(t, 70.08, 70.26)));

    // 边界厚度分四阶段增长
    let wall;
    if (t < 70.26) wall = 1.0;
    else if (t < 70.58) wall = lerp(1, 5, easeOutQuad(phase(t, 70.26, 70.58)));
    else if (t < 70.84) wall = lerp(5, 10, easeInOutSine(phase(t, 70.58, 70.84)));
    else wall = lerp(10, 14, easeOutExpo(phase(t, 70.84, 71.02)));
    const br = 1.0 + 0.02 * Math.sin(Math.PI * clamp01(phase(t, 70.58, 70.84)));
    const bright = 1.0 + 0.25 * clamp01(phase(t, 70.84, 71.02));
    const col = t >= 70.58 ? CYAN : ICE;
    f.rect(cx - (BW / 2) * br, cy - (BH / 2) * br, cx + (BW / 2) * br, cy + (BH / 2) * br,
           col, wall, Math.min(0.9, (t < 70.26 ? 0.2 : 0.7) * bright), 0.5, null, 0, BG_DEEP, 8);
    f.rect(cx - (BW / 2) * br - wall / 2, cy - (BH / 2) * br - wall / 2,
           cx + (BW / 2) * br + wall / 2, cy + (BH / 2) * br + wall / 2, ICE, 1, 0.5);

    // ② 光标 + 返回箭头 + 撞击涟漪
    f.rect(curX, curY - 11, curX + 12, curY + 11, CYAN, 0, 1, 0, CYAN, 1.0);
    const shotI = t >= 70.26 ? Math.floor((t - 70.26) / 0.2) : 0;
    const ap = easeOutQuad(clamp01((t - (70.26 + shotI * 0.2)) / 0.12));
    const ax0 = curX + 12, ay0 = curY;
    const ax1 = ax0 + 90 * Math.cos((-38 * Math.PI) / 180);
    const ay1 = ay0 + 90 * Math.sin((-38 * Math.PI) / 180);
    const ex = lerp(ax0, ax1, ap), ey = lerp(ay0, ay1, ap);
    f.line(ax0, ay0, ex, ey, CYAN, 3, 0.95, 0.6);
    f.pline([[ex, ey], [ex - 8, ey + 12], [ex + 6, ey + 10]], CYAN, 1, 0.9, 0.5);
    if (t >= 70.58) {
      for (let k = 0; k < 2; k++) {
        const age = ((t - 70.58) % 0.2) + k * 0.1;
        if (age >= 0 && age <= 0.2) {
          f.ell(ax1, ay1, 16 + 380 * age, 16 + 380 * age, ICE, 2, 0.4 * (1 - age / 0.2), 0.4);
        }
      }
    }

    // ③ 框外 24 枚失败箭头（4 批 × 6 枚）
    for (let k = 0; k < 24; k++) {
      const st = 70.26 + Math.floor(k / 6) * 0.06;
      if (t < st) continue;
      const ang = ((45 + (k % 6) * 60) * Math.PI) / 180;
      const rad = 40 * (easeOutQuad(clamp01((t - st) / 0.10))
                        - easeInQuad(clamp01((t - st - 0.10) / 0.10)));
      const bx = cx + (BW / 2 + 30 + rad) * Math.cos(ang);
      const by = cy + (BH / 2 + 30 + rad) * Math.sin(ang);
      f.line(bx, by, bx + 20 * Math.cos(ang), by + 20 * Math.sin(ang), GREY, 2, 0.40);
    }

    c.W.draw(f, t, {
      t0: 70.84, stagger: 0.013, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li) => (t >= 70.95 && li === 1 ? BV : ICE), glowK: 0.4,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(cx + BW / 2 - 60, cy + BH / 2 + 20 + 34, 'boundary:w=1→14px', mf.font, GREY, 0.55);
    corners(f, 'T+70.08s', CHAPTER, `seed:${SEEDS.SHOT_069} · wall:14px`, 'LOCK');
    return { bloomR: 10.0, bloomK: 0.40 + 0.08 * pulse(t, bs, 0.05, 1.0), grain: 5.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_070  `71.02–71.76` ｜ 三层同构边框叠影
   ══════════════════════════════════════════════════════════════ */
const SHOT_070 = {
  id: 'SHOT_070', start: 71.0208, end: 71.76,
  seedHex: SEEDS.SHOT_070, chapter: CHAPTER, status: 'DUP',
  lyric: 'Though we are trapped',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_070 = beatsIn(beats, this.start, this.end);
    const LINES = ['Though we are', 'trapped'];
    const W = new Word(ctx, LINES, 156, {
      weight: 'Inter Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.44], lineStep: 1.05 * 156,
    });
    const pts = textPoints(ctx, LINES, 156, 'Inter Semi-Bold', 0.0, 'left',
                           'baseline_first', [0.10, 0.44], 1.05 * 156,
                           { step: 4, n: 3500, dpr: 1 });
    this._c = { W, pts };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.54 * BASE_H;
    const BW = 520, BH = 400;

    if (t < 71.20) {
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          f.rect(0.08 * BASE_W + gx * 0.13 * BASE_W, 0.40 * BASE_H + gy * 0.06 * BASE_H,
                 0.08 * BASE_W + (gx + 1) * 0.13 * BASE_W,
                 0.40 * BASE_H + (gy + 1) * 0.06 * BASE_H, GREY, 1, 0.30);
        }
      }
    }

    // ① 文字粒子迁入三层网格
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const [x, y, li] = c.pts[i];
      const st = 71.16 + (li === 0 ? 0.08 : 0.0);
      const pp = easeOutCubic(clamp01((t - st) / 0.14));
      const layer = i % 3;
      const nx = cx - BW / 2 + [0, 46, 92][layer] + ((i % 50) * BW) / 49;
      const ny = cy - BH / 2 + [0, 30, 60][layer] + ((i % 40) * BH) / 39;
      dp.push([lerp(x, nx, pp), lerp(y, ny, pp)]);
      al.push(0.7);
    }
    f.pts(dp, 2, ICE, 1, 0.4, BG_DEEP, al);

    // ② 三层同构边框
    const LAY = [[CYAN, 0.70, 14, 0, 0], [BV, 0.45, 10, 46, 30], [MOOD, 0.28, 7, 92, 60]];
    for (let k = 0; k < LAY.length; k++) {
      const [col, a0, wdt, ox, oy] = LAY[k];
      const st = 71.20 + k * 0.06;
      const pp = easeOutCubic(clamp01((t - st) / 0.16));
      if (pp <= 0) continue;
      const x0 = cx - BW / 2 + ox * pp;
      const y0 = cy - BH / 2 + oy * pp;
      f.rect(x0, y0, x0 + BW, y0 + BH, col, wdt * pp, a0 * pp, 0.4 * pp, null, 0, BG_DEEP, 8);
      f.rect(x0 + 40, y0 + BH * 0.72, x0 + 52, y0 + BH * 0.72 + 22, col, 0,
             1, 0, col, (k === 0 ? 1.0 : 0.6) * pp);
      for (let j = 0; j < 8; j++) {
        const ang = ((20 + j * 40) * Math.PI) / 180;
        const bx = x0 + BW / 2 + (BW / 2 + 26) * Math.cos(ang) * 0.22;
        const by = y0 + BH / 2 + (BH / 2 + 26) * Math.sin(ang) * 0.22;
        f.line(bx, by, bx + 18 * Math.cos(ang), by + 18 * Math.sin(ang), col, 2, 0.35 * pp);
      }
    }

    // ③ 71.16 前的实心文字
    if (t < 71.16) {
      for (const ch of c.W.chars) {
        f.text(ch.x / dpr, ch.baseline / dpr, ch.ch, c.W.font,
               ch.li === 1 ? BV : ICE, 1.0, 0.35, c.W.stroke);
      }
    }
    corners(f, 'T+71.02s', CHAPTER, `seed:${SEEDS.SHOT_070} · layers:3 · 3500pt`, 'DUP');
    return { bloomR: 9.0, bloomK: t < 71.48 ? 0.40 : 0.30, grain: 5.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_071  `71.76–72.5496` ｜ 三层世界漂移 + 体素楼升起
   ══════════════════════════════════════════════════════════════ */
const SHOT_071 = {
  id: 'SHOT_071', start: 71.76, end: 72.5496,
  seedHex: SEEDS.SHOT_071, chapter: CHAPTER, status: 'ODD',
  lyric: 'In this strange strange',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_071 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_071');
    const bld = [];
    for (let k = 0; k < 3; k++) {
      const arr = [];
      for (let i = 0; i < 28; i++) {
        const r = new Rng(seed, `bld${k}`, i);
        arr.push({ w: r.range(10, 26), h: r.range(24, 96) });
      }
      bld.push(arr);
    }
    const W = new Word(ctx, ['In this strange', 'strange'], 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.42], lineStep: 1.05 * 168,
    });
    this._c = { bld, W };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.54 * BASE_H;
    const BW = 520, BH = 400;
    const LAYERS = [[CYAN, 0.70, 0, 0, 1.0], [BV, 0.45, 46, 30, 0.4], [MOOD, 0.28, 92, 60, 0.4]];
    const drift = 10.0 * Math.sin(2 * Math.PI * 0.5 * (t - 71.98));

    for (let k = 0; k < LAYERS.length; k++) {
      const [col, a0, ox, oy, ga] = LAYERS[k];
      const dx = ox + (k === 1 ? drift : (k === 2 ? -drift : 0)) * (t >= 71.98 ? 0.5 : 0);
      const x0 = cx - BW / 2 + dx, y0 = cy - BH / 2 + oy;
      f.rect(x0, y0, x0 + BW, y0 + BH, col, k === 0 ? 14 : (k === 1 ? 10 : 7),
             a0 * 0.9, 0.4, null, 0, BG_DEEP, 8);
      // 窗格
      for (let i = 0; i < 9; i++) {
        f.line(x0 + 20 + i * 20, y0 + BH * 0.55, x0 + 20 + i * 20, y0 + BH - 30, GREY, 1, 0.25 * ga);
      }
      for (let j = 0; j < 6; j++) {
        f.line(x0 + 20, y0 + BH * 0.55 + j * 20, x0 + 180, y0 + BH * 0.55 + j * 20, GREY, 1, 0.25 * ga);
      }
      // 体素楼升起
      for (let i = 0; i < 28; i++) {
        const st = 71.76 + i * 0.008;
        const pp = easeOutExpo(clamp01((t - st) / 0.16));
        const b = c.bld[k][i];
        const hh = b.h * pp;
        const bx = x0 + 30 + (i % 14) * 34;
        const by = y0 + BH * 0.62;
        f.rect(bx - b.w / 2, by - hh, bx + b.w / 2, by, GREY, 1.5, 0.55 * ga, 0.2);
      }
      // 扫描线 + 光标
      if (t >= 72.24 + k * 0.06) {
        f.line(x0 + 20, y0 + BH * 0.62, x0 + BW - 20, y0 + BH * 0.62, CYAN, 1.5, 0.85 * ga, 0.5);
        for (let j = 0; j < 3; j++) {
          const ph = (((t - 72.24 - k * 0.06) * 0.5 + j / 3) % 1);
          f.dot(x0 + 20 + ph * (BW - 40), y0 + BH * 0.62, 2, ICE, 0.8, 0.4);
        }
      }
      f.rect(x0 + 20, y0 + BH * 0.62 - 11, x0 + 32, y0 + BH * 0.62 + 11, col, 0, 1, 0, col, 0.9);
    }

    c.W.draw(f, t, {
      t0: 72.42, stagger: 0.013, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li) => (t >= 72.40 && li === 1 ? BV : ICE), glowK: 0.4,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(cx + BW / 2 - 40, cy + BH / 2 + 20 + 34, 'drift:+46px/+30px', mf.font, GREY, 0.55);
    corners(f, 'T+71.76s', CHAPTER, `seed:${SEEDS.SHOT_071} · worlds:3 · bld:28`, 'ODD');
    return { bloomR: 9.0, bloomK: 0.38, grain: 6.0, scan: 0.07 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_072  `72.5496–73.17` ｜ 文字与城市粒子塌缩进 12×7 网格
   ══════════════════════════════════════════════════════════════ */
const SHOT_072 = {
  id: 'SHOT_072', start: 72.5496, end: 73.17,
  seedHex: SEEDS.SHOT_072, chapter: CHAPTER, status: 'MORPH',
  lyric: 'In this strange strange',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_072 = beatsIn(beats, this.start, this.end);
    const LINES = ['In this strange', 'strange'];
    const W = new Word(ctx, LINES, 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.10, 0.42], lineStep: 1.05 * 168,
    });
    const base = textPoints(ctx, LINES, 168, 'Inter Semi-Bold', 0.0, 'left',
                            'baseline_first', [0.10, 0.42], 1.05 * 168,
                            { step: 4, n: 3700, dpr: 1 });
    const seed = SC.seed('SHOT_072');
    for (let i = 0; i < 1773; i++) {
      const r = new Rng(seed, 'city', i);
      base.push([0.50 * BASE_W - 260 + r.range(0, 520), 0.54 * BASE_H - 200 + r.range(0, 400), 0]);
    }
    const mist = [];
    for (let i = 0; i < 120; i++) {
      const r = new Rng(seed, 'mist', i);
      mist.push([r.range(0.16, 0.84) * BASE_W, 0.54 * BASE_H + r.range(0, 20), i % 2]);
    }
    this._c = { W, pts: base, mist };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.50 * BASE_W, cy = 0.54 * BASE_H;

    // 三层边框向内收拢
    const conv = easeInOutCubic(phase(t, 72.55, 72.68));
    const LAY = [[CYAN, 0.70, 0, 0], [BV, 0.45, 46, 30], [MOOD, 0.28, 92, 60]];
    for (let k = 0; k < 3; k++) {
      const [col, a0, ox, oy] = LAY[k];
      const s = 1 - 0.30 * conv;
      f.rect(cx - 260 + ox * s, cy - 200 + oy * s, cx + 260 + ox * s, cy + 200 + oy * s,
             col, k === 0 ? 14 : (k === 1 ? 10 : 7),
             a0 * 0.8 * (1 - clamp01(phase(t, 72.88, 73.06))), 0.3, null, 0, BG_DEEP, 8);
    }
    const ghost = 1 - clamp01(phase(t, 72.65, 72.72));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (li === 1 ? BV : ICE), { alpha: ghost, glowK: 0.3 * ghost });
    }

    // 粒子塌缩进网格
    const conv2 = easeInOutQuart(phase(t, 72.88, 73.06));
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const [x, y] = c.pts[i];
      const k = i % 84;
      const gx = cx - 6 * 34 + (k % 12) * 68;
      const gy = 0.58 * BASE_H + Math.floor(k / 12) * 30;
      dp.push([lerp(x, gx, conv2), lerp(y, gy, conv2)]);
      al.push(i % 5 ? 0.55 : 0.25);
    }
    f.pts(dp, 2.0, ICE, 1, 0.4, BG_DEEP, al);
    for (let k = 0; k < 84; k++) {
      if (t < 73.06 + k * 0.004) continue;
      f.dot(cx - 6 * 34 + (k % 12) * 68, 0.58 * BASE_H + Math.floor(k / 12) * 30, 4, CYAN, 0.9, 0.6);
    }
    for (const m of c.mist) f.dot(m[0], m[1], 2, m[2] ? MOOD : BV, 0.12);

    // 光标滑出 + 微词
    const slide = 90.0 * easeOutQuad(phase(t, 73.06, 73.17));
    f.rect(0.14 * BASE_W + slide, 0.74 * BASE_H - 11, 0.14 * BASE_W + slide + 12,
           0.74 * BASE_H + 11, CYAN, 0, 1, 0, CYAN, 1.0);
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t < 72.60) f.text(cx + 220, cy + 220 + 34, 'drift:+46px/+30px', mf.font, GREY, 0.55);
    if (t >= 73.02) f.text(0.70 * BASE_W, 0.84 * BASE_H + 34, 'grid:12×7', mf.font, GREY, 0.6);

    corners(f, 'T+72.55s', CHAPTER, `seed:${SEEDS.SHOT_072} · grid:12×7 · 5473pt`, 'MORPH');
    const k = 0.40 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 72.88, 73.06)));
    return { bloomR: 9.0, bloomK: Math.min(0.52, k), grain: 6.0, scan: 0.07 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_073  `73.17–74.05` ｜ SIMULATION（体素城市 + 双轨道）
   ══════════════════════════════════════════════════════════════ */
const SHOT_073 = {
  id: 'SHOT_073', start: 73.17, end: 74.05,
  seedHex: SEEDS.SHOT_073, chapter: CHAPTER, status: 'SIM',
  lyric: 'SIMULATION',
  _c: null,
  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_073 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_073');
    const towers = [];
    for (let i = 0; i < 24; i++) {
      const r = new Rng(seed, 'tower', i);
      towers.push({ n: 6 + Math.floor(r.range(0, 8)), w: r.range(40, 90) });
    }
    const mist = [];
    for (let i = 0; i < 120; i++) {
      const r = new Rng(seed, 'mist', i);
      mist.push([r.range(0.16, 0.84) * BASE_W, 0.54 * BASE_H + r.range(0, 20), i % 3]);
    }
    const seeds4 = [];
    for (let k = 0; k < 4; k++) {
      const r = new Rng(seed, 'seed', k);
      seeds4.push([r.range(-40, 40), r.range(-40, 40)]);
    }
    const W = new Word(ctx, ['SIMULATION'], 241, {
      weight: 'Inter Extra-Bold', trackEm: 0.09, dpr: 1,
      h: 'center', v: 'baseline_first', anchor: [0.50, 0.22],
    });
    // 波形 512 点（与 t 无关的前半段）
    const wpts = [];
    for (let i = 0; i < 512; i++) {
      const u = i / 511;
      wpts.push([lerp(0.04 * BASE_W, 0.96 * BASE_W, u),
                 0.34 * BASE_H - 0.06 * BASE_H * Math.sin(2 * Math.PI * 1.25 * u)]);
    }
    this._c = { towers, mist, seeds4, W, wpts };
    return this._c;
  },
  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_073');
    const cx = 0.50 * BASE_W, cy = 0.54 * BASE_H;

    // ① 24 栋体素楼自地基点阵升起（stagger 12ms）
    for (let i = 0; i < 24; i++) {
      const st = 73.17 + i * 0.012;
      if (t < st) continue;
      const pp = easeOutExpo(clamp01((t - st) / 0.20));
      const k = i % 84;
      const gx = cx - 6 * 34 + (k % 12) * 68;
      const gy = 0.58 * BASE_H + Math.floor(k / 12) * 30;
      const tw = c.towers[i];
      for (let L = 0; L < tw.n; L++) {
        if (L / tw.n > pp) break;
        f.rect(gx - tw.w / 2 + (L % 2) * 5, gy - (L + 1) * 10,
               gx + tw.w / 2 + (L % 2) * 5, gy - L * 10, CYAN, 1.5, 0.6, 0.3);
      }
    }

    // ② 两条轨道椭圆 + 绕行粒子 + 暖色节点环
    for (let k = 0; k < 2; k++) {
      const tilt = k === 0 ? 0 : 18;
      const w = k === 0 ? 1.0 : -0.7;
      const pp = easeOutQuad(clamp01((t - (73.40 + k * 0.08)) / 0.20));
      if (pp <= 0) continue;
      const pl = [];
      for (let i = 0; i < 80; i++) {
        const a = (i * TAU) / 80 + ((40 * 60 * (t - 73.40) * 0.02 * w) * Math.PI) / 180;
        const x = 0.34 * BASE_W * Math.cos(a), y = 0.14 * BASE_H * Math.sin(a);
        const tr = (tilt * Math.PI) / 180;
        pl.push([cx + x * Math.cos(tr) - y * Math.sin(tr),
                 cy - 30 + x * Math.sin(tr) + y * Math.cos(tr)]);
      }
      f.pline(pl.slice(0, Math.max(2, Math.floor(80 * pp))), BV, 1.5, 0.8, 0.4);
      for (let i = 0; i < 24; i++) {
        const a = (i * TAU) / 24 + ((50 * 60 * (t - 73.40) * 0.02 * w) * Math.PI) / 180;
        const x = 0.34 * BASE_W * Math.cos(a), y = 0.14 * BASE_H * Math.sin(a);
        const tr = (tilt * Math.PI) / 180;
        f.dot(cx + x * Math.cos(tr) - y * Math.sin(tr),
              cy - 30 + x * Math.sin(tr) + y * Math.cos(tr), 2, ICE, 0.85, 0.5);
      }
    }
    if (t >= 73.66) {
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6 + ((30 * (t - 73.66)) * Math.PI) / 180;
        f.ell(cx + 0.30 * BASE_W * Math.cos(a), cy - 30 + 0.12 * BASE_H * Math.sin(a),
              6, 6, WARM, 2, 0.95, 1.0);
      }
    }

    // ③ 波形带自左向右描出
    const wp = easeOutQuad(phase(t, 73.40, 73.66));
    f.pline(c.wpts.slice(0, Math.max(2, Math.floor(512 * wp))), CYAN, 4, 0.9, 0.6);

    // 三色薄雾（情绪紫在 73.66 后归零）
    for (const m of c.mist) {
      const col = m[2] === 0 ? BV : (m[2] === 1 ? MOOD : ICE);
      let a = t < 73.66 ? 0.20 : lerp(0.20, 0.05, clamp01(phase(t, 73.66, 73.88)));
      if (m[2] === 1 && t >= 73.66) a *= 1 - clamp01(phase(t, 73.66, 73.88));
      f.dot(m[0], m[1], 2, col, a);
    }

    // 塔顶信标
    if (t < 73.66 || Math.floor((t - 73.66) / 0.5) % 2 === 0) {
      f.rect(cx - 6, 0.70 * BASE_H - 11, cx + 6, 0.70 * BASE_H + 11, CYAN, 0, 1, 0, CYAN, 1.0);
    }

    // 主词 SIMULATION
    c.W.draw(f, t, {
      t0: 73.66, stagger: 0.012, dur: 0.10, dy: 12, ease: easeOutCubic,
      color: (li, ci) => (t >= 73.85 && ci < 4 ? CYAN : ICE), glowK: 0.45,
    });

    // 段末：右下 4 颗体素种子聚集
    if (t >= 73.88) {
      const sp = clamp01(phase(t, 73.88, 74.05));
      for (let k = 0; k < 4; k++) {
        f.dot(0.78 * BASE_W + c.seeds4[k][0] * (1 - sp),
              0.78 * BASE_H + c.seeds4[k][1] * (1 - sp), 4,
              sp < 0.7 ? BV : MOOD, 0.9, 0.6);
      }
    }
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.62 * BASE_W, 0.92 * BASE_H + 34, 'nodes:6 · orbit:2 · wave:512', mf.font, GREY, 0.55);
    corners(f, 'T+73.17s', CHAPTER, `seed:${SEEDS.SHOT_073} · city:24 · orbit:2`, 'SIM');
    return { bloomR: 8.0, bloomK: 0.42 + pulse(t, bs, 0.05, 0.06), grain: 5.0, scan: 0.06 };
  },
};

export const CH03_SHOTS = [
  SHOT_057, SHOT_058, SHOT_059, SHOT_060, SHOT_061, SHOT_062,
  SHOT_063, SHOT_064, SHOT_065, SHOT_066, SHOT_067, SHOT_068,
  SHOT_069, SHOT_070, SHOT_071, SHOT_072, SHOT_073,
];
export { SC as CH03_SC };
