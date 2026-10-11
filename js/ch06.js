/**
 * ch06.js — 第 06 章 LOSS / SENSING（镜头 110–126）
 *
 * 自 Python 版 render/scenes/ch06_loss.py 移植。
 * 本章与 ch04/ch05 同属 `sNNN(K, t)` + `Kit` 适配器风格，逐行对齐，
 * 语义与 Python 版一致（适配器见 kit.js）。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix,
  easeOutCubic, easeInOutCubic, easeOutExpo, easeOutQuad, easeInQuad,
  easeInCubic, rad, easeInOutSine, easeOutBack, easeInOutQuad,
  easeInOutQuint, easeInExpo, easeOutSine,
} from './core.js';
import * as P from './primitives.js';
import { Kit, fontOf, beatsIn } from './kit.js';

const CHAPTER = 'ch06/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_SEMI = 'Inter Semi-Bold';
const FONT_BOLD = 'Inter Bold';
const FONT_XBOLD = 'Inter Extra-Bold';

const SEEDS = {
  SHOT_110: '0000110B', SHOT_111: '0000111A', SHOT_112: '0000112C',
  SHOT_113: '0000113D', SHOT_114: '0000114E', SHOT_115: '0000115F',
  SHOT_116: '0000116A', SHOT_117: '0000117B', SHOT_118: '0000118C',
  SHOT_119: '0000119D', SHOT_120: '0000120E', SHOT_121: '0000121F',
  SHOT_122: '0000122A', SHOT_123: '0000123B', SHOT_124: '0000124C',
  SHOT_125: '0000125D', SHOT_126: '0000126E',
};

/** 节拍邻域 0..1（对应 Python 的 ring_near） */
function ringNear(t, times, dur) {
  let v = 0;
  for (const b of times || []) {
    const d = Math.abs(t - b);
    if (d <= dur) v = Math.max(v, 1 - d / dur);
  }
  return v;
}

/** 拍点脉冲包络 0..1（对应 Python 的 beat_env） */
function beatEnv(t, times, dur = 0.06) {
  let v = 0.0;
  for (const b of times || []) {
    if (b <= t && t <= b + dur) v = Math.max(v, Math.sin((Math.PI * (t - b)) / dur));
  }
  return v;
}

/** 文本宽度（对应 Python 的 font.getlength） */
function textWidthOf(fontStr, str) {
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fontStr;
  return cv.measureText(str).width;
}

const SC = {
  beatMap: {},
  beats(id) { return this.beatMap[id] || []; },
};

/* ── 章内 helper ─────────────────────────────────────────────── */
/** 柔光圆（等效径向渐变：40px 高斯羽化边的同心圆叠近似）
 *  必须从最大半径画到最小半径，alpha 随半径减小而增大。 */
function featherField(K, c, r, color, a0, rings = 16) {
  for (let i = rings; i > 0; i--) {
    const rr = (r * i) / rings;
    const frac = (rings - i + 1) / rings;
    K.disc(c, rr, color, a0 * frac);
  }
}

/** seed:0000113D 固定包络：主峰 38%H@i=31、次峰 26%H@i=58、边谷 4%H */
function barEnv(i, n = 96) {
  // 注意：JS 不允许 `-x ** 2`（一元负号与 ** 相邻为语法错误），必须写成 `-(x ** 2)`
  const main = 38.0 * Math.exp(-(((i - 31.0) / 26.0) ** 2));
  const sec = 26.0 * Math.exp(-(((i - 58.0) / 17.0) ** 2));
  const edge = 4.0 + 6.0 * (i / n);
  return Math.max(4.0, Math.min(38.0, main + sec * 0.55 + edge * 0.30));
}

/** 两色按 k 混合（对应 Python 的 `_mix_px`） */
function mixPx(c1, c2, k) {
  return mix(c1, c2, clamp01(k));
}

/* ══════════════════════════════════════════════════════════════
   SHOT_110  `103.49–104.20` ｜ 光标落位 + 逻辑树三级生长
   ══════════════════════════════════════════════════════════════ */
const SHOT_110 = {
  id: 'SHOT_110', start: 103.49, end: 104.20,
  seedHex: SEEDS.SHOT_110, chapter: CHAPTER, status: 'GROW',
  lyric: 'If I can / 如果我能',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_110 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_110);
    const halo = [];
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'halo', i);
      halo.push([r.range(0, Math.PI * 2), 0.5 + 0.5 * r.next()]);
    }
    this._c = { halo, CUR: [0.14 * BASE_W, 0.82 * BASE_H], C0: [0.50 * BASE_W, 0.48 * BASE_H],
                TOP: [0.46 * BASE_W, 0.40 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { CUR, C0, TOP } = c;
    const p2 = easeOutQuad(phase(t, 103.60, 103.92));

    // 阶段 1：核心亮点自画面中央平移到左下光标位
    const q = easeOutExpo(phase(t, 103.49, 103.60));
    const core = [lerp(C0[0], CUR[0], q), lerp(C0[1], CUR[1], q)];
    if (q < 1.0) {
      K.ring(C0, 0.04 * BASE_W, GREY, 1.5, 0.25 * (1 - q));
    }
    const haloPts = c.halo.map(([a0, rr0]) => {
      const a = a0 + 0.2 * (t - 103.49);
      const rr = 0.06 * BASE_W * rr0;
      return [core[0] + rr * Math.cos(a), core[1] + rr * Math.sin(a)];
    });
    K.dots(haloPts, 2.0, CYAN, 0.08, 0.0);

    // 光标方框 28×28
    let blink = 1.0;
    if (t >= 104.12) blink = (steps(t, 2, 104.12, 104.2) % 2 === 0) ? 1.0 : 0.4;
    K.rectCenter(CUR[0], CUR[1], 28, 28, ICE, 1.5, 0.9 * blink, 0.20, 2);
    K.disc(core, 12.0, ICE, 0.95, 0.45);

    // 主干（自光标顶点至 (46%,40%)）带 4px 生长头
    const trunkEnd = [lerp(CUR[0], TOP[0], p2), lerp(CUR[1], TOP[1], p2)];
    K.line([CUR[0], CUR[1] - 14], trunkEnd, CYAN, 2.0, 0.95, 0.35);
    if (p2 > 0 && p2 < 1) K.disc(trunkEnd, 4.0, ICE, 0.95, 0.40);

    // 4 条二级枝（分叉角 28°–62°）
    const l2Ends = [];
    for (let i = 0; i < 4; i++) {
      const st = 103.92 + 0.030 * i;
      const qq = easeOutExpo(phase(t, st, st + 0.14));
      if (qq <= 0) continue;
      const ang = rad(-92 + 34 * i);
      const ln = (0.08 + (0.06 * (i % 3)) / 2.0) * BASE_W;
      const f = 0.45 + 0.16 * i;
      const base = [lerp(CUR[0], TOP[0], f), lerp(CUR[1], TOP[1], f)];
      const e = [base[0] + ln * qq * Math.cos(ang), base[1] + ln * qq * Math.sin(ang)];
      K.line(base, e, BV, 1.5, 0.9, 0.22);
      l2Ends.push([base, e]);
      K.ring(base, 6.0, BV, 1.0, 0.9, 0.20);
    }
    // 8 条三级枝
    for (let i = 0; i < 8; i++) {
      const st = 103.96 + 0.020 * i;
      if (t < st) continue;
      const [base] = l2Ends.length ? l2Ends[i % l2Ends.length] : [[0, 0]];
      const ang = rad(-120 + 22 * i);
      const ln = (0.04 + (0.03 * (i % 4)) / 3.0) * BASE_W;
      const qq = easeOutExpo(phase(t, st, st + 0.10));
      K.line(base, [base[0] + ln * qq * Math.cos(ang), base[1] + ln * qq * Math.sin(ang)],
             GREY, 1.0, 0.7, 0.0);
    }
    // 枝端命令词
    const WORDS = ['then', 'can', 'try', '?'];
    for (let i = 0; i < WORDS.length; i++) {
      if (i < l2Ends.length && p2 > 0.6) {
        const e = l2Ends[i][1];
        K.textKit(FONT_MONO, 16, WORDS[i], e[0] + 8, e[1] + 6, GREY, 0.7);
      }
    }
    K.word_block(FONT_SEMI, 176, ['If I can'], 0.10 * BASE_W, [0.22 * BASE_H],
                 0.05, 103.60, t,
                 { per_char: 0.020, accents: [[['If', CYAN], [' I can', ICE]]] });
    K.micro({ TL: 'T+103.49s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_110} · depth:3`, BR: 'GROW' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_111  `104.20–105.3704` ｜ 信号源 5 圈波纹扫过逻辑树 + 感应节点
   ══════════════════════════════════════════════════════════════ */
const SHOT_111 = {
  id: 'SHOT_111', start: 104.20, end: 105.3704,
  seedHex: SEEDS.SHOT_111, chapter: CHAPTER, status: 'SENSING',
  lyric: 'If I can feel your / 如果我能感到你的',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_111 = beatsIn(beats, this.start, this.end);
    this._c = { SRC: [0.82 * BASE_W, 0.16 * BASE_H], SEN: [0.38 * BASE_W, 0.52 * BASE_H],
                CUR: [0.14 * BASE_W, 0.82 * BASE_H], TOP: [0.46 * BASE_W, 0.40 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { SRC, SEN, CUR, TOP } = c;
    const p3 = phase(t, 105.02, 105.24);
    const p4 = phase(t, 105.24, 105.3704);
    const bs = SC.beats('SHOT_111');

    // 逻辑树降为 35% 背景层
    K.line([CUR[0], CUR[1] - 14], TOP, CYAN, 2.0, 0.35, 0.10);
    K.rectCenter(CUR[0], CUR[1], 28, 28, ICE, 1.5, 0.35, 0, 2);
    const forks = [];
    for (let i = 0; i < 4; i++) {
      const ang = rad(-92 + 34 * i);
      const ln = 0.10 * BASE_W;
      const f = 0.45 + 0.16 * i;
      const base = [lerp(CUR[0], TOP[0], f), lerp(CUR[1], TOP[1], f)];
      const e = [base[0] + ln * Math.cos(ang), base[1] + ln * Math.sin(ang)];
      K.line(base, e, BV, 1.5, 0.35, 0.0);
      forks.push(base);
    }
    // 对角参考线
    K.line(SRC, SEN, GREY, 1.0, 0.20 + 0.4 * clamp01(p3), 0.0);
    // 信号源
    const em = beatEnv(t, bs, 0.08);
    const sc = 1.0 + 0.4 * Math.sin(Math.PI * clamp01(((t - 104.2) % 0.13) / 0.013));
    K.disc(SRC, 6.0 * (1 + 0.1 * em), ICE, 0.95, 0.45);
    K.ring(SRC, 10.0 * sc, CYAN, 1.5, 0.20, 0.10);
    // 5 圈波纹（每 0.13s 一圈，46%W/s 恒速向左下扩张）
    for (let i = 0; i < 5; i++) {
      const e0 = 104.2 + 0.13 * i;
      if (t < e0) continue;
      const rr = 0.46 * BASE_W * (t - e0);
      const op = Math.max(0.0, 0.7 - 0.14 * i);
      if (rr > 0.62 * BASE_W) continue;
      K.ring(SRC, rr, CYAN, 1.5, op, 0.30);
      // 波纹扫过逻辑树分叉点时点亮
      for (const f of forks) {
        const fd = Math.hypot(f[0] - SRC[0], f[1] - SRC[1]);
        if (Math.abs(rr - fd) < 14.0) K.disc(f, 6.0, CYAN, 0.9, 0.30);
      }
    }
    // 感应节点
    let senSc = 1.0;
    if (t >= 105.02) senSc = 1.0 + 0.5 * Math.sin(Math.PI * clamp01(phase(t, 105.02, 105.14)));
    const shake = t >= 105.24 ? 1.0 * Math.sin(2 * Math.PI * 3.0 * t) : 0.0;
    K.disc([SEN[0] + shake, SEN[1]], 14.0 * senSc, CYAN, 0.95, 0.50);
    K.ring([SEN[0] + shake, SEN[1]], 20.0 * senSc, ICE, 1.5, 0.8, 0.25);
    // 回应波纹
    if (t >= 105.14) {
      const rr = 0.46 * BASE_W * (t - 105.14) * 0.6;
      K.ring([SEN[0] + shake, SEN[1]], rr, BV, 1.5,
             Math.max(0.0, 0.6 - rr / (0.3 * BASE_W)), 0.20);
    }
    // 交汇点闪 2 帧
    if (t >= 105.24 && t <= 105.31) {
      K.disc([(SRC[0] + SEN[0]) / 2, (SRC[1] + SEN[1]) / 2], 6.0, ICE, 0.9 * (1 - p4), 0.45);
    }
    K.textKit(FONT_MONO, 14, 'd=0.62', (SRC[0] + SEN[0]) / 2, (SRC[1] + SEN[1]) / 2 + 48,
              GREY, 0.7, 0, 'center');
    K.word_block(FONT_SEMI, 150, ['If I can feel your'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.04, 104.20, t,
                 { per_char: 0.016,
                   accents: [[['If I can ', ICE], ['feel', CYAN], [' your', ICE]]] });
    K.micro({ TL: 'T+104.20s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_111} · waves:5`, BR: 'SENSING' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_112  `105.3704–106.29` ｜ 3 条波形摊开（点阵→波形）
   ══════════════════════════════════════════════════════════════ */
const SHOT_112 = {
  id: 'SHOT_112', start: 105.3704, end: 106.29,
  seedHex: SEEDS.SHOT_112, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I can feel your / 如果我能感到你的',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_112 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_112);
    const dust = [];
    for (let i = 0; i < 600; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, BASE_W), r.range(0.30 * BASE_H, 0.62 * BASE_H)]);
    }
    this._c = { dust };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = easeInOutQuint(phase(t, 105.58, 105.96));
    const p4 = easeInQuad(phase(t, 106.16, 106.29));
    const yc = 0.46 * BASE_H;
    const amp = ((9.0 + 5.0 * p4) / 100.0) * BASE_H;

    // 网格尘底衬
    K.dots(c.dust, 2.0, GREY, 0.35 * (0.5 + 0.5 * p2), 0.0);
    // 外圈加速淡出
    if (t < 105.72) {
      for (const i of [3, 4]) {
        const rr = 0.46 * BASE_W * Math.max(0.0, t - (105.37 - 0.13 * (4 - i)));
        K.ring([0.82 * BASE_W, 0.16 * BASE_H], rr, CYAN, 1.5,
               Math.max(0.0, 0.5 * (1 - clamp01(phase(t, 105.37, 105.58)))), 0.20);
      }
    }
    // 3 条波形
    const sp = [0.22 * BASE_W * (t - 105.96), -0.14 * BASE_W * (t - 105.96),
                0.08 * BASE_W * (t - 105.96)];
    const specs = [[CYAN, 2.0, 1.0, amp, 0.34], [BV, 1.5, 0.8, amp * 0.7, 0.11],
                   [GREY, 1.0, 0.30, amp * 0.5, 0.20]];
    for (let k = 0; k < specs.length; k++) {
      const [col, w, a, A, lamW] = specs[k];
      const pts = [];
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const xx = (BASE_W * i) / n;
        const ph = 2 * Math.PI * (xx / (lamW * BASE_W))
                 + (sp[k] / (lamW * BASE_W)) * 2 * Math.PI;
        let yy = yc - A * Math.sin(ph) * (k === 0 ? 1.0 : 0.9);
        if (p2 < 1.0) yy = lerp(yc + (i - n / 2) * 2.0, yy, p2);
        pts.push([xx, yy]);
      }
      K.seg(pts, col, w, a, k === 0 ? 0.30 : 0.15);
    }
    // 波峰标记（主线最高点 x=32%）
    const ph0 = 2 * Math.PI * (0.32 / 0.34)
              + (sp[0] / (0.34 * BASE_W)) * 2 * Math.PI;
    const py = yc - amp * Math.sin(ph0);
    K.disc([0.32 * BASE_W, py], 14.0 * (1 + 0.2 * Math.sin(Math.PI * clamp01(p4))),
           CYAN, 0.95, 0.40);
    // 右端信号亮点
    K.disc([0.88 * BASE_W, 0.46 * BASE_H], 6.0, ICE, 0.95, 0.45);
    // 主词（105.58 起淡出）
    const ACCS = [[['If I can ', ICE], ['feel', CYAN], [' your', ICE]]];
    if (t < 105.58) {
      K.word_block(FONT_SEMI, 150, ['If I can feel your'], 0.10 * BASE_W, [0.70 * BASE_H],
                   0.04, 104.20, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 105.58, 105.66));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 150, ['If I can feel your'], 0.10 * BASE_W, [0.70 * BASE_H],
                     0.04, 104.20, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    K.micro({ TL: 'T+105.37s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_112} · sample:4px · 2150pt`, BR: 'MORPH' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_113  `106.29–107.22` ｜ 96 根频谱柱 + 拱顶描线 + VIBRATIONS
   ══════════════════════════════════════════════════════════════ */
const SHOT_113 = {
  id: 'SHOT_113', start: 106.29, end: 107.22,
  seedHex: SEEDS.SHOT_113, chapter: CHAPTER, status: 'VIBE',
  lyric: 'VIBRATIONS / 振动',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_113 = beatsIn(beats, this.start, this.end);
    // 椭圆衬底 65 点
    const ell = [];
    const cyT = 0.48 * BASE_H;
    for (let i = 0; i < 65; i++) {
      const a = (2 * Math.PI * i) / 64;
      ell.push([0.50 * BASE_W + 0.42 * BASE_W * Math.cos(a),
                cyT + 0.13 * BASE_H * Math.sin(a)]);
    }
    this._c = { ell, cyT };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_113');
    const p2 = phase(t, 106.46, 107.02);
    const p3 = easeOutExpo(phase(t, 107.02, 107.14));
    const p4 = 1.0 - easeOutSine(phase(t, 107.14, 107.22));
    const yH = 0.88 * BASE_H;
    const n = 96;
    const beat = beatEnv(t, bs, 0.10);
    const waveSp = 0.22 * (1.0 - 0.45 * (1 - p4));

    const cols = [];
    for (let i = 0; i < n; i++) {
      const f = barEnv(i);
      const drive = 0.55 + 0.45 * Math.sin(2 * Math.PI * 1.6 * t + i * 0.20
                    - (t - 106.29) * waveSp * 2 * Math.PI * 4.0);
      let hgt = (f / 100.0 * BASE_H) * (drive * 0.5 + 0.5) * (1.0 + 0.30 * p3);
      hgt = Math.max((4.0 / 100.0) * BASE_H, hgt)
          * (0.35 + 0.65 * clamp01(p2 * 1.3 - i * 0.004));
      hgt += (3.0 / 100.0) * BASE_H * beat;
      const x = 0.02 * BASE_W + (0.96 * BASE_W * i) / n;
      const col = mixPx(CYAN, BV, i / n);
      const y1 = yH - hgt;
      K.line([x, yH], [x, y1], col, 8.0, 0.95, 0.32);
      K.line([x - 4, y1], [x + 4, y1], ICE, 2.0, 0.95, 0.40);
      K.dots([[x, yH]], 2.0, CYAN, 0.4 + 0.6 * (f / 38.0), 0.10);
      cols.push([x, y1]);
    }
    // 拱顶描线
    K.seg(cols, BV, 1.0, 0.70, 0.22);
    // 地平线
    K.line([0, yH], [BASE_W, yH], GREY, 1.0, 0.9, 0.0);
    // 椭圆衬底
    K.poly(c.ell, BG_DEEP, 0.01, 0.0, 0.0, BG_DEEP, 0.35);
    // 主词 VIBRATIONS（逐字 easeOutBack 弹入）
    const cy = c.cyT;
    const chars = 'VIBRATIONS';
    const fo = fontOf(FONT_BOLD, 210, dpr);
    const twv = textWidthOf(fo.font, chars) + 0.14 * 210 * (chars.length - 1);
    const x0 = 0.50 * BASE_W - twv / 2;
    const trk = 0.14 * 210;
    if (t < 106.29 + 0.022 * 10) {
      let cxp = x0;
      for (let i = 0; i < chars.length; i++) {
        const st = 106.29 + 0.022 * i;
        if (t >= st) {
          const p = easeOutBack(clamp01((t - st) / 0.22), 1.2);
          const sc = 0.92 + 0.08 * clamp01(p);
          K.textKit(FONT_BOLD, 210 * sc, chars[i], cxp, cy, ICE, 0.95, 0.45);
        }
        cxp += textWidthOf(fo.font, chars[i]) + trk;
      }
    } else {
      K.textKit(FONT_BOLD, 210, 'VIBRATIONS', 0.50 * BASE_W, cy, ICE, 1.0, 0.45, 'center',
                0.14);
    }
    K.micro({ TL: 'T+106.29s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_113} · bars:96`, BR: 'VIBE' });
    return { bloomR: 9.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_114  `107.22–107.90` ｜ 柱群残影下沉 + TRUE/FALSE 状态容器
   ══════════════════════════════════════════════════════════════ */
const SHOT_114 = {
  id: 'SHOT_114', start: 107.22, end: 107.90,
  seedHex: SEEDS.SHOT_114, chapter: CHAPTER, status: 'TRUE',
  lyric: 'Then I can / 那么我能',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_114 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.46 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;
    const p1 = easeOutBack(phase(t, 107.22, 107.32), 1.15);
    const flips = [107.32, 107.43, 107.53, 107.64];
    const p3 = phase(t, 107.64, 107.78);

    // 柱群残影下沉 10%H
    const sink = 0.88 * BASE_H + 0.10 * BASE_H * easeInQuad(phase(t, 107.22, 107.32));
    for (let i = 0; i < 96; i++) {
      const f = barEnv(i);
      const hgt = (f / 100.0 * BASE_H)
                * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.6 * t + i * 0.20)) * 0.6;
      const x = 0.02 * BASE_W + (0.96 * BASE_W * i) / 96;
      K.line([x, sink], [x, sink - hgt], mixPx(CYAN, BV, i / 96.0), 8.0,
             0.30 * (1 - 0.5 * p3), 0.0);
    }
    // 状态容器 18%W × 14%H
    const cw = 0.18 * BASE_W, chh = 0.14 * BASE_H;
    const sc = 0.6 + 0.4 * p1;
    let flash = 0.0;
    for (const f of flips) if (f <= t && t <= f + 0.033) flash = 1.0;
    const border = flash ? ICE : BV;
    const bw = t < 107.78 ? 1.5 : 1.0;
    K.rectCenter(C[0], C[1], cw * sc, chh * sc, border, bw, 0.95, 0.22, 8);
    // FALSE / TRUE 硬切
    const locked = t >= 107.64;
    let state, col;
    if (t < flips[0]) { state = 'FALSE'; col = RED; }
    else if (t < flips[1]) { state = 'TRUE'; col = CYAN; }
    else if (t < flips[2]) { state = 'FALSE'; col = RED; }
    else if (t < flips[3]) { state = 'TRUE'; col = CYAN; }
    else { state = 'TRUE'; col = CYAN; }
    let fpx = 96.0;
    if (locked) fpx = lerp(96.0, 108.0, easeOutCubic(clamp01(phase(t, 107.64, 107.78))));
    let bump = 1.0;
    for (const f of flips) {
      if (f <= t && t <= f + 0.05) bump = 1.0 + 0.08 * Math.sin(Math.PI * clamp01((t - f) / 0.05));
    }
    K.textKit(FONT_BOLD, fpx * bump * sc, state, C[0], C[1] + fpx * sc * 0.24, col,
              0.95, state === 'TRUE' ? 0.50 : 0.34, 'center');
    // 3 枚状态点
    for (let i = 0; i < 3; i++) {
      const y = C[1] + (i - 1) * 56;
      const on = (i === 0 && t >= 107.24) || (i === 1 && t >= 107.45) || (i === 2 && t >= 107.66);
      K.dots([[C[0] - cw / 2 - 0.02 * BASE_W, y]], 8.0, on ? CYAN : GREY,
             on ? 0.95 : 0.6, on ? 0.20 : 0.0);
    }
    // 锁形方块
    const lx = C[0] + cw / 2 + 0.02 * BASE_W;
    K.rectCenter(lx, C[1], 12, 12, ICE, 1.5, 0.9, 0.30);
    if (locked) K.rectCenter(lx, C[1], 12, 12, CYAN, 0, 0.95, 0);
    // 主词
    K.word_block(FONT_SEMI, 162, ['Then I can'], 0.10 * BASE_W, [0.72 * BASE_H],
                 0.04, 107.30, t,
                 { per_char: 0.018, accents: [[['Then', CYAN], [' I can', ICE]]] });
    K.micro({ TL: 'T+107.22s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_114} · flips:4`, BR: 'TRUE' });
    return { bloomR: 9.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_115  `107.90–109.1992` ｜ 双轨迹相向合拢（A 上半弧 / B 下半弧）
   ══════════════════════════════════════════════════════════════ */
const SHOT_115 = {
  id: 'SHOT_115', start: 107.90, end: 109.1992,
  seedHex: SEEDS.SHOT_115, chapter: CHAPTER, status: 'MERGE',
  lyric: 'Then I can finally be / 那么我终于能成为',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_115 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_115);
    const sd = [];
    for (let i = 0; i < 400; i++) {
      const r = new Rng(seed, 'seed', i);
      sd.push([r.range(0, Math.PI * 2), 0.4 + 0.6 * r.next()]);
    }
    this._c = { sd, C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.22 * BASE_W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R } = c;
    const p1 = phase(t, 107.9, 108.08);
    const p3 = phase(t, 108.72, 109.02);

    // 容器与锁块 scale→0
    if (p1 < 1.0) {
      const cw = 0.18 * BASE_W, chh = 0.14 * BASE_H;
      K.rectCenter(C[0], C[1], cw * (1 - p1), chh * (1 - p1), BV, 1.5, 0.95 * (1 - p1), 0, 8);
      K.rectCenter(C[0] + cw / 2 + 0.02 * BASE_W, C[1], 12 * (1 - p1), 12 * (1 - p1),
                   ICE, 1.5, 0.9 * (1 - p1));
    }
    // 虚线导轨
    const br = t >= 108.08 ? 0.50 : 0.30;
    for (let i = 0; i < 72; i++) {
      if (i % 14 > 8) continue;
      const a0 = (360 * i) / 72;
      K.ring(C, R, GREY, 1.0, br, 0.0, a0 - 3, a0 + 1);
    }
    // 双轨迹（70°/s 相向）
    const A_STOP = 250.0, B_STOP = 290.0;
    let advA = 70.0 * Math.max(0.0, t - 108.08);
    let advB = 70.0 * Math.max(0.0, t - 108.08);
    if (t >= 108.72) {
      advA = Math.min(advA, A_STOP - 90.0);
      advA = lerp(advA, A_STOP - 90.0, easeOutExpo(p3));
      advB = Math.min(advB, 270.0 - B_STOP);
      advB = lerp(advB, 270.0 - B_STOP, easeOutExpo(p3));
    }
    let haA = 90.0 + advA;
    let haB = 270.0 - advB;
    if (t >= 109.02) {
      const probe = 8.0 * Math.sin(2 * Math.PI
                    * easeInOutSine(clamp01((t - 109.02) / 0.09)) * 2);
      haA += probe;
      haB -= probe;
    }
    for (const [k, ha, colr] of [[0, haA, CYAN], [1, haB, BV]]) {
      const n = 680;
      const pts = [], al = [];
      for (let i = 0; i < n; i++) {
        const a = k === 0
          ? rad(90 + (ha - 90) * (i / (n - 1.0)))
          : rad(270 + (haB - 270) * (i / (n - 1.0)));
        pts.push([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]);
        al.push(0.15 + 0.85 * (i / n));
      }
      K.dots(pts, 2.0, colr, 1, 0.35, BG_DEEP, al);
      const hx = C[0] + R * Math.cos(rad(ha));
      const hy = C[1] + R * Math.sin(rad(ha));
      const halo = t >= 108.72
        ? 12.0 + 6.0 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t)) : 12.0;
      K.disc([hx, hy], 8.0, colr, 0.95, 0.45);
      K.ring([hx, hy], halo, colr, 1.0, 0.20, 0.20);
    }
    // TRUE 溶解的 400 点种子
    if (t < 108.08) {
      const q = clamp01((t - 107.9) / 0.18);
      const cyPts = [], bvPts = [];
      for (let i = 0; i < 400; i++) {
        const rr = 0.05 * BASE_W * (1 - q) * c.sd[i][1];
        const p = [C[0] + rr * Math.cos(c.sd[i][0]), C[1] + rr * Math.sin(c.sd[i][0])];
        (i % 2 ? bvPts : cyPts).push(p);
      }
      K.dots(cyPts, 2.0, CYAN, 0.9 * (1 - q), 0.20);
      K.dots(bvPts, 2.0, BV, 0.9 * (1 - q), 0.20);
    }
    K.word_block(FONT_SEMI, 144, ['Then I can finally be'], 0.10 * BASE_W, [0.16 * BASE_H],
                 0.03, 107.90, t,
                 { per_char: 0.014,
                   accents: [[['Then I can ', ICE], ['finally', CYAN], [' be', ICE]]] });
    K.micro({ TL: 'T+107.90s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_115} · arc:2×680pt`, BR: 'MERGE' });
    return { bloomR: 9.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_116  `109.1992–110.22` ｜ 闭合环 + 焊点 + 环外尘带 + 词粒子化
   ══════════════════════════════════════════════════════════════ */
const SHOT_116 = {
  id: 'SHOT_116', start: 109.1992, end: 110.22,
  seedHex: SEEDS.SHOT_116, chapter: CHAPTER, status: 'CLOSING',
  lyric: 'Then I can finally be / 那么我终于能成为',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_116 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_116);
    const dust = [];
    for (let i = 0; i < 1000; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, Math.PI * 2), r.range(1.18, 1.55)]);
    }
    // 词粒子 1200 点的源与目标（预计算；jitter 用索引而非 indexOf）
    const wpSrc = P.cloudPoints(1, SEEDS.SHOT_116, 'word', 'rect', [0.26, 0.20], 0.22, 0.3)[0];
    const wp = [];
    for (let i = 0; i < 1200; i++) {
      const r = new Rng(seed, 'wp', i);
      const sx = wpSrc[0] + r.range(-0.20 * BASE_W, 0.20 * BASE_W);
      const sy = wpSrc[1] + r.range(-0.05 * BASE_H, 0.05 * BASE_H);
      const isRing = i < 200;
      const ta = isRing ? (2 * Math.PI * i) / 200 : r.range(0, Math.PI * 2);
      const tr = isRing ? 1.0 : r.range(1.18, 1.55);
      wp.push({ sx, sy, ta, tr, isRing, jit: (i % 37) * 0.006 });
    }
    this._c = { dust, wp, C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.22 * BASE_W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R } = c;
    const p1 = easeInOutCubic(phase(t, 109.1992, 109.46));
    const haA = 250.0 + 20.0 * p1;
    const haB = 290.0 - 20.0 * p1;
    const spin = 0.12 * Math.max(0.0, t - 109.98);
    const closed = t >= 109.60;

    // 闭合环 1560 点
    const n = 1560;
    const cyG = [], bvG = [], mxG = [];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      let a, kind;
      if (!closed) {
        const inA = i % 2 === 0;
        const ha = inA ? haA : haB;
        a = rad(90 + (ha - 90) * (Math.trunc(i / 2) / (n / 2.0)));
        if ((inA && ha > 270.0) || (!inA && ha < 270.0)) continue;
        kind = inA ? 'cy' : 'bv';
      } else {
        a = 2 * Math.PI * u + spin;
        const deg = (((a * 180) / Math.PI) % 360 + 360) % 360;
        if (deg < 180) kind = 'cy';
        else if (deg < 348) kind = 'bv';
        else kind = 'mx';
      }
      const p = [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)];
      if (kind === 'cy') cyG.push(p);
      else if (kind === 'bv') bvG.push(p);
      else mxG.push(p);
    }
    K.dots(cyG, 2.0, CYAN, 0.9, 0.32);
    K.dots(bvG, 2.0, BV, 0.9, 0.32);
    K.dots(mxG, 2.0, mixPx(BV, CYAN, 0.5), 0.9, 0.32);
    // 焊点（12 点位）
    if (t >= 109.46) {
      let blink = 1.0;
      if (t < 109.54) blink = (steps(t, 2, 109.46, 109.54) % 2 === 0) ? 1.0 : 0.4;
      K.disc([C[0], C[1] - R],
             10.0 * (0.6 + 0.4 * Math.min(1.0, (t - 109.46) / 0.1)) * blink, ICE, 0.95, 0.50);
    }
    // 环外尘带
    if (t >= 109.46) {
      const q = easeOutQuad(phase(t, 109.46, 109.68));
      const pts = c.dust.map(([a0, rr0]) => {
        const a = a0 + 0.08 * Math.max(0.0, t - 109.68);
        const rr = R * rr0 * (1 + 0.15 * (1 - q));
        return [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)];
      });
      K.dots(pts, 2.0, GREY, 0.12 * q, 0.0);
    }
    // 导轨转实线
    K.ring(C, R * 1.02, GREY, 1.0, closed ? 0.6 : 0.35, 0.0);
    // 主词 / 词粒子化
    if (t < 109.46) {
      K.word_block(FONT_SEMI, 144, ['Then I can finally be'], 0.10 * BASE_W, [0.16 * BASE_H],
                   0.03, 107.90, t,
                   { per_char: 0.0, char_dur: 0.001,
                     accents: [[['Then I can ', ICE], ['finally', CYAN], [' be', ICE]]] });
    } else {
      const cyPts = [], greyPts = [];
      const base = easeOutQuad(clamp01(phase(t, 109.46, 109.68)));
      for (const q0 of c.wp) {
        const q = easeOutQuad(clamp01(base * 1.2 - q0.jit));
        const tx = q0.isRing ? C[0] + R * Math.cos(q0.ta + spin) : C[0] + R * q0.tr * Math.cos(q0.ta);
        const ty = q0.isRing ? C[1] + R * Math.sin(q0.ta + spin) : C[1] + R * q0.tr * Math.sin(q0.ta);
        const p = [lerp(q0.sx, tx, q), lerp(q0.sy, ty, q)];
        (q0.isRing ? cyPts : greyPts).push(p);
      }
      K.dots(cyPts, 2.0, CYAN, 0.7, 0.20);
      K.dots(greyPts, 2.0, GREY, 0.12, 0.20);
    }
    K.micro({ TL: 'T+109.20s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_116} · sample:4px · 1560pt`, BR: 'CLOSING' });
    return { bloomR: 10.0, bloomK: 0.48, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_117  `110.22–110.90` ｜ 环冻结实线化 + 白场 + COMPLETION 逐字弹入
   ══════════════════════════════════════════════════════════════ */
const SHOT_117 = {
  id: 'SHOT_117', start: 110.22, end: 110.90,
  seedHex: SEEDS.SHOT_117, chapter: CHAPTER, status: 'LOCKED',
  lyric: 'COMPLETION / 完成',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_117 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.22 * BASE_W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R } = c;
    const p2 = easeOutQuad(phase(t, 110.34, 110.56));
    const p3 = easeInOutSine(phase(t, 110.56, 110.78));

    // 环冻结实线化
    K.ring(C, R, ICE, 2.0, 0.90, 0.35);
    // 24 刻度
    for (let i = 0; i < 24; i++) {
      const st = 110.22 + 0.005 * i;
      if (t < st) continue;
      const a = (2 * Math.PI * i) / 24 - Math.PI / 2;
      K.dots([[C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]], 4.0, ICE, 0.40, 0.10);
    }
    // 白场
    const fieldA = (0.40 + 0.15 * p3) * clamp01(p2 * 1.2);
    if (t >= 110.34) {
      let tremor = 0.0;
      if (t >= 110.86) tremor = 0.02 * Math.sin(2 * Math.PI * 30.0 * t);
      featherField(K, C, 0.10 * BASE_W * (0.9 + 0.1 * p2 + tremor), ICE, fieldA, 18);
    }
    // 主词 COMPLETION（暗描边保证白场中可读）
    const fo = fontOf(FONT_BOLD, 211, dpr);
    const text = 'COMPLETION';
    const trk = 0.16 * 211;
    let twv = 0;
    for (const ch of text) twv += textWidthOf(fo.font, ch);
    twv += trk * (text.length - 1);
    let cxp = C[0] - twv / 2;
    const cvM = document.createElement('canvas').getContext('2d');
    cvM.font = fo.font;
    const asc = cvM.measureText('Hg').actualBoundingBoxAscent || 211 * 0.78;
    const yTop = 0.48 * BASE_H - asc;
    for (let i = 0; i < text.length; i++) {
      const chW = textWidthOf(fo.font, text[i]);
      const st = 110.34 + 0.018 * (i - (text.length - 1) / 2.0);
      if (t < st) { cxp += chW + trk; continue; }
      const p = easeOutBack(clamp01((t - st) / 0.20), 1.2);
      const dy = (1 - clamp01(p)) * 10;
      // 暗描边（用 BG_DEEP）再叠冰白，保证在白场上可读
      K.text(cxp, yTop + dy + asc, text[i], fo.font, BG_DEEP, 1, 0, 2);
      K.text(cxp, yTop + dy + asc, text[i], fo.font, ICE, 1, 0.45);
      cxp += chW + trk;
    }
    if (t >= 110.56) {
      K.textKit(FONT_MONO, 16, 'status: complete', C[0], C[1] + 0.10 * BASE_W - 24,
                GREY, 0.6 * clamp01(phase(t, 110.56, 110.70)), 0, 'center');
    }
    K.micro({ TL: 'T+110.22s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_117} · sealed`, BR: 'LOCKED' });
    return { bloomR: 10.0, bloomK: 0.48, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_118  `110.90–111.6392` ｜ 暖色亮点退行 + 裂纹 + 尾迹 + 里程碑点
   ══════════════════════════════════════════════════════════════ */
const SHOT_118 = {
  id: 'SHOT_118', start: 110.90, end: 111.6392,
  seedHex: SEEDS.SHOT_118, chapter: CHAPTER, status: 'LEAVING',
  lyric: 'Though you have left / 尽管你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_118 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.22 * BASE_W,
                TGT: [0.72 * BASE_W, 0.30 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R, TGT } = c;
    const p2 = phase(t, 111.04, 111.42);

    // 白场收缩
    const shrinkP = clamp01(phase(t, 110.9, 111.42));
    featherField(K, C, lerp(0.10, 0.06, shrinkP) * BASE_W, ICE,
                 lerp(0.55, 0.30, shrinkP), 14);
    // 亮环 + 裂纹
    K.ring(C, R, ICE, 2.0, 0.55, 0.20);
    const cracks = 2 + Math.trunc(3 * clamp01(phase(t, 111.42, 111.6392)));
    for (let i = 0; i < cracks; i++) {
      const a = rad(-140 + 70 * i);
      const x1 = C[0] + R * Math.cos(a), y1 = C[1] + R * Math.sin(a);
      K.line([x1, y1], [x1 + 0.03 * BASE_W * Math.cos(a + 1.2),
                        y1 + 0.03 * BASE_W * Math.sin(a + 1.2)], BG_DEEP, 1.0, 1.0);
    }
    // COMPLETION 缩为 42px 微词沉入环底
    if (t < 111.06) {
      const q = clamp01(phase(t, 110.9, 111.02));
      K.textKit(FONT_BOLD, lerp(211.0, 42.0, q), 'COMPLETION', C[0],
                lerp(0.48 * BASE_H, C[1] + R - 10, q), ICE,
                1.0 - q, 0, 'center', 0.16 * (1 - q) + 0.06);
    }
    // 暖色亮点退行（38%W/s → 12%W/s）
    let dist = 0.0;
    if (t >= 111.04) {
      if (t < 111.42) dist = 0.38 * BASE_W * (t - 111.04);
      else dist = 0.38 * BASE_W * (111.42 - 111.04) + 0.12 * BASE_W * (t - 111.42);
    }
    const maxd = Math.hypot(TGT[0] - C[0], TGT[1] - C[1]);
    const fpos = clamp01(dist / maxd);
    const P = [lerp(C[0], TGT[0], fpos), lerp(C[1], TGT[1], fpos)];
    const rP = lerp(8.0, 6.0, clamp01(phase(t, 111.42, 111.6392)));
    if (t < 111.04) {
      const alt = steps(t, 2, 110.9, 111.04) % 2 === 0;
      K.disc(C, 8.0, alt ? WARM : ICE, 0.95, 0.40);
    } else {
      let sc = 1.0;
      if (t >= 111.56) sc = 1.0 - 0.15 * Math.sin(Math.PI * clamp01((t - 111.56) / 0.07));
      K.disc(P, rP * sc, WARM, 0.95, 0.40);
      K.ring(P, (t < 111.42 ? 14.0 : 10.0) * sc, WARM, 1.0, 0.25, 0.20);
    }
    // 尾迹
    if (t > 111.04) {
      const span = Math.min(1.0, (t - 111.04) / (111.6392 - 111.04));
      const nT = Math.trunc(200 * span);
      const pts = [], rs = [], cols = [], al = [];
      for (let i = 0; i < nT; i++) {
        const u = i / 200.0;
        const ff = Math.max(0.0, fpos - u * 0.55);
        let py = lerp(C[1], TGT[1], ff);
        if (t >= 111.56 && u > 0.8) py += 6.0 * Math.sin(2 * Math.PI * 2.0 * t + i);
        pts.push([lerp(C[0], TGT[0], ff), py]);
        rs.push(lerp(4.0, 1.0, u));
        cols.push(mixPx(GREY, WARM, Math.max(0.0, 1.0 - u * 2.2)));
        al.push(Math.max(0.0, 0.9 - u * 2.4));
      }
      for (let i = 0; i < pts.length; i++) {
        K.dots([pts[i]], rs[i], cols[i], al[i], 0.10);
      }
    }
    // 3 枚里程碑点
    for (let i = 0; i < 3; i++) {
      const u = (i + 1) / 4.0;
      const mp = [lerp(C[0], TGT[0], u), lerp(C[1], TGT[1], u)];
      const passed = fpos > u;
      K.dots([mp], 4.0, GREY, passed ? 0.4 : 0.8, 0.0);
    }
    K.word_block(FONT_SEMI, 150, ['Though you have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.03, 110.90, t,
                 { per_char: 0.013,
                   accents: [[['Though you have ', ICE], ['left', WARM]]] });
    K.micro({ TL: 'T+110.90s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_118} · retreat:38%W/s`, BR: 'LEAVING' });
    return { bloomR: 10.0, bloomK: 0.48, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_119  `111.6392–112.22` ｜ 亮环裂为 8 段后粒子化 + 8 条灭点线
   ══════════════════════════════════════════════════════════════ */
const SHOT_119 = {
  id: 'SHOT_119', start: 111.6392, end: 112.22,
  seedHex: SEEDS.SHOT_119, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Though you have left / 尽管你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_119 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_119);
    const ring = [], wp = [], rem = [];
    for (let i = 0; i < 900; i++) {
      const r = new Rng(seed, 'ring', i);
      ring.push([r.range(0, Math.PI * 2), r.range(0.95, 1.05)]);
    }
    for (let i = 0; i < 2100; i++) {
      const r = new Rng(seed, 'wp', i);
      wp.push({ sx: r.range(0.08 * BASE_W, 0.62 * BASE_W),
                sy: r.range(0.62 * BASE_H, 0.72 * BASE_H),
                tx: r.range(0, BASE_W), ty: r.range(0, BASE_H), jit: (i % 43) * 0.005 });
    }
    for (let i = 0; i < 56; i++) {
      const r = new Rng(seed, 'rem', i);
      rem.push([r.range(0, Math.PI * 2), r.next()]);
    }
    this._c = { ring, wp, rem, C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.22 * BASE_W,
                P: [0.78 * BASE_W, 0.24 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R, P } = c;
    const p2 = phase(t, 111.84, 112.06);
    const p4 = phase(t, 112.18, 112.22);

    // 白场缩为 0
    const fq = clamp01(phase(t, 111.6392, 111.80));
    const fa = 0.30 * (1 - easeInQuad(fq));
    if (fa > 0.005) featherField(K, C, 0.06 * BASE_W * (1 - fq), ICE, fa, 10);
    // 亮环裂为 8 段后粒子化
    if (t < 111.84) {
      const segDone = Math.trunc(8 * clamp01((t - 111.6392) / 0.20));
      for (let i = 0; i < 8; i++) {
        if (i >= segDone) K.ring(C, R, ICE, 2.0, 0.55, 0.15, i * 45, (i + 1) * 45);
      }
    } else {
      const q = clamp01(p2);
      const pts = c.ring.map(([a, rr0]) => {
        const r0 = R * rr0;
        const rr = lerp(r0, 0.36 * BASE_W, q);
        return [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a) + 60 * q];
      });
      K.dots(pts, 2.0, GREY, 0.15 * (1 - 0.6 * q), 0.0);
    }
    // 8 条灭点线 + 尾迹重排
    if (t >= 111.84) {
      const anchors = [[0.0, 0.0], [0.5, 0.0], [1.0, 0.0], [0.0, 0.5], [1.0, 0.5],
                       [0.0, 1.0], [0.5, 1.0], [1.0, 1.0]];
      for (let i = 0; i < anchors.length; i++) {
        const q = easeOutQuad(clamp01(phase(t, 111.84 + 0.025 * i, 111.96 + 0.025 * i)));
        if (q <= 0) continue;
        const A = [anchors[i][0] * BASE_W, anchors[i][1] * BASE_H];
        K.line(A, [lerp(A[0], P[0], q), lerp(A[1], P[1], q)], GREY, 1.0, 0.20, 0.0);
      }
      for (const kk of [-1, 1]) {
        for (let i = 0; i < 100; i++) {
          const u = i / 100.0;
          K.dots([[lerp(C[0], P[0], u) + kk * 30 * (1 - u), lerp(C[1], P[1], u)]], 2.0,
                 u > 0.5 ? WARM : GREY, Math.max(0.0, 0.8 - u * 0.9), 0.10);
        }
      }
    }
    // 亮点继续微退
    const rP = t < 112.06 ? 6.0 : 5.0;
    let sc = 1.0;
    if (t >= 112.18) sc = 1.0 + 0.25 * Math.sin(Math.PI * clamp01((t - 112.18) / 0.04));
    K.disc(P, rP * sc, WARM, 0.95, 0.38);
    K.ring(P, 10.0 * sc, WARM, 1.0, 0.25, 0.20);
    if (t >= 112.18) {
      K.ring(P, lerp(4.0, 40.0, clamp01((t - 112.18) / 0.04)), WARM, 1.0,
             0.30 * (1 - p4), 0.20);
    }
    // 词粒子（1260 上线滑行 / 840 散逸）
    if (t < 111.84) {
      K.word_block(FONT_SEMI, 150, ['Though you have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                   0.03, 110.90, t,
                   { per_char: 0.0, char_dur: 0.001,
                     accents: [[['Though you have ', ICE], ['left', WARM]]] });
    } else {
      const cyPts = [], greyPts = [];
      for (let i = 0; i < c.wp.length; i++) {
        const q0 = c.wp[i];
        const q = easeInOutCubic(clamp01(p2 * 1.15 - q0.jit));
        const isLine = i < 1260;
        const tx = isLine ? P[0] : q0.tx;
        const ty = isLine ? P[1] : q0.ty;
        const p = [lerp(q0.sx, tx, q), lerp(q0.sy, ty, q)];
        (isLine ? cyPts : greyPts).push(p);
      }
      K.dots(cyPts, 2.0, ICE, 0.7, 0.0);
      K.dots(greyPts, 2.0, GREY, 0.08, 0.0);
    }
    // 白场残迹
    if (t >= 111.6392 && t <= 111.70) {
      const pts = c.rem.map(([a, rr0]) => {
        const rr = 0.04 * BASE_W * rr0;
        return [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)];
      });
      K.dots(pts, 2.0, ICE, 0.10, 0.0);
    }
    K.micro({ TL: 'T+111.64s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_119} · sample:4px · 2100pt`, BR: 'MORPH' });
    return { bloomR: 9.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_120  `112.22–113.10` ｜ 5 条灭点线收敛 + 卫星微点 + 距离读数
   ══════════════════════════════════════════════════════════════ */
const SHOT_120 = {
  id: 'SHOT_120', start: 112.22, end: 113.10,
  seedHex: SEEDS.SHOT_120, chapter: CHAPTER, status: 'DISTANT',
  lyric: 'You have left / 你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_120 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_120);
    const dust = [];
    for (let i = 0; i < 400; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, BASE_W), r.range(0, BASE_H)]);
    }
    this._c = { dust, P0: [0.78 * BASE_W, 0.24 * BASE_H], P1: [0.80 * BASE_W, 0.22 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { P0, P1 } = c;
    const p2 = phase(t, 112.36, 112.88);
    const P = [lerp(P0[0], P1[0], clamp01(p2)), lerp(P0[1], P1[1], clamp01(p2))];

    // 5 条灭点线（末段淡出 2 条）
    const nLines = t < 112.88 ? 5 : 3;
    const anchors = [[0.0, 0.0], [1.0, 0.0], [0.0, 0.5], [1.0, 0.5], [0.5, 1.0]];
    for (let i = 0; i < nLines; i++) {
      K.line([anchors[i][0] * BASE_W, anchors[i][1] * BASE_H], P, GREY, 1.0, 0.30, 0.12);
    }
    // 亮点
    const rP = lerp(6.0, 5.5, clamp01(p2));
    let blink = 1.0;
    if (t >= 112.88 && t <= 113.04) {
      blink = (steps(t, 2, 112.88, 113.04) % 2 === 0) ? 1.0 : 0.45;
    }
    let sc = 1.0;
    if (t >= 113.04) sc = 1.0 + 0.2 * Math.sin(Math.PI * clamp01((t - 113.04) / 0.05));
    K.disc(P, rP * sc * blink, WARM, 0.95, 0.38);
    K.ring(P, 10.0 * sc, WARM, 1.0, 0.25, 0.18);
    // 卫星微点
    const sat = [P[0] - 0.03 * BASE_W, P[1] + 0.012 * BASE_H];
    let satBlink = 1.0;
    if (t >= 113.04) satBlink = 1.0 - 0.7 * Math.sin(Math.PI * clamp01((t - 113.04) / 0.06));
    K.dots([sat], 4.0, ICE, 0.9 * satBlink, 0.20);
    // 60 点短尾迹
    const tlen = lerp(0.06, 0.045, clamp01(p2));
    const tailPts = [], tailR = [], tailCol = [], tailA = [];
    for (let i = 0; i < 60; i++) {
      const u = i / 60.0;
      tailPts.push([P[0] - tlen * BASE_W * u, P[1] + 0.02 * BASE_H * u]);
      tailR.push(2.0);
      tailCol.push(mixPx(GREY, WARM, Math.max(0.0, 1 - u * 1.8)));
      tailA.push(Math.max(0.0, 0.85 - u * 1.1));
    }
    for (let i = 0; i < tailPts.length; i++) {
      K.dots([tailPts[i]], tailR[i], tailCol[i], tailA[i], 0.10);
    }
    // 散逸尘
    K.dots(c.dust, 2.0, GREY, 0.08, 0.0);
    // 距离读数
    const dval = Math.min(1.0, 0.02 * Math.trunc(Math.max(0.0, t - 112.22) * 60));
    K.textKit(FONT_MONO, 14, `d=${dval.toFixed(2)}`, P[0],
              P[1] + 0.03 * BASE_H + 14, GREY, 0.7);
    K.word_block(FONT_SEMI, 168, ['You have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.04, 112.22, t,
                 { per_char: 0.018, accents: [[['You have ', ICE], ['left', WARM]]] });
    K.micro({ TL: 'T+112.22s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_120} · pull:1/4`, BR: 'DISTANT' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_121  `113.10–114.18` ｜ 亮点退至 3.5px + 卫星靠拢 + 距离标签组
   ══════════════════════════════════════════════════════════════ */
const SHOT_121 = {
  id: 'SHOT_121', start: 113.10, end: 114.18,
  seedHex: SEEDS.SHOT_121, chapter: CHAPTER, status: 'TRACKING',
  lyric: 'You have left / 你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_121 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_121);
    const dust = [];
    for (let i = 0; i < 180; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, BASE_W), r.range(0, BASE_H)]);
    }
    this._c = { dust, STEP_PTS: [[0.80 * BASE_W, 0.22 * BASE_H],
                                 [0.82 * BASE_W, 0.20 * BASE_H],
                                 [0.84 * BASE_W, 0.18 * BASE_H]] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = phase(t, 113.28, 113.9);
    const P = c.STEP_PTS[Math.min(steps(t, 3, 113.1, 113.28), 2)];

    // 2 条灭点线（末段再淡出 1 条）
    const anchors = [[0.0, 0.0], [1.0, 0.5]];
    const nLines = t < 113.90 ? 2 : 1;
    for (let i = 0; i < nLines; i++) {
      K.line([anchors[i][0] * BASE_W, anchors[i][1] * BASE_H], P, GREY, 1.0, 0.20, 0.10);
    }
    // 亮点 3.5px / 1.2Hz 微闪
    const flick = 0.70 + 0.30 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.2 * t));
    let sc = 1.0;
    if (t >= 114.08) sc = 1.0 + 0.15 * Math.sin(Math.PI * clamp01((t - 114.08) / 0.04));
    K.disc(P, 3.5 * sc, WARM, Math.min(1.0, flick), 0.30);
    K.ring(P, 6.0 * sc, WARM, 1.0, 0.20, 0.12);
    // 卫星微点靠拢至 1.5%W
    const sat = [P[0] - lerp(0.03, 0.015, clamp01(p2)) * BASE_W, P[1] + 0.008 * BASE_H];
    let satB = 1.0;
    if (t >= 114.08) {
      satB = 0.3 + 0.7 * Math.abs(Math.sin(Math.PI * clamp01((t - 114.08) / 0.04)));
    }
    K.dots([sat], 2.0, ICE, 0.85 * satB, 0.15);
    // 尾迹 20 点逐点熄灭
    const alive = t < 113.28 ? 20
      : Math.max(0, Math.trunc(20 * (1 - clamp01((t - 113.28) / 0.62))));
    const tailPts = [], tailCol = [];
    for (let i = 0; i < alive; i++) {
      const u = i / 20.0;
      tailPts.push([P[0] - 0.02 * BASE_W * u, P[1] + 0.008 * BASE_H * u]);
      tailCol.push(mixPx(GREY, WARM, Math.max(0.0, 1 - u * 2.0)));
    }
    for (let i = 0; i < tailPts.length; i++) {
      K.dots([tailPts[i]], 2.0, tailCol[i], 0.6, 0.10);
    }
    // 散逸尘
    K.dots(c.dust, 2.0, GREY, 0.06, 0.0);
    // 距离标签组
    const dval = 2.71 + 0.01 * Math.min(8, Math.trunc(Math.max(0.0, t - 113.90) / 0.1));
    K.textKit(FONT_MONO, 18, `d=${dval.toFixed(2)}`, P[0] - 0.06 * BASE_W,
              P[1] + 0.03 * BASE_H + 18, BV, 0.9, 0.15);
    K.textKit(FONT_MONO, 14, 'θ=32°', P[0] - 0.06 * BASE_W,
              P[1] + 0.03 * BASE_H + 42, BV, 0.85, 0.10);
    // 主词（唯一允许的词面衰减：100%→92%）
    const alpha = lerp(1.0, 0.92, easeInOutSine(clamp01(phase(t, 113.90, 114.08))));
    K.word_block(FONT_SEMI, 168, ['You have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.04, 113.10, t,
                 { per_char: 0.0, char_dur: 0.001, alpha,
                   accents: [[['You have ', ICE], ['left', WARM]]] });
    K.micro({ TL: 'T+113.10s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_121} · pull:2/4`, BR: 'TRACKING' });
    return { bloomR: 9.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_122  `114.18–114.92` ｜ 亮点退至 1.5px + 坐标读数 + 尘减至 20 点
   ══════════════════════════════════════════════════════════════ */
const SHOT_122 = {
  id: 'SHOT_122', start: 114.18, end: 114.92,
  seedHex: SEEDS.SHOT_122, chapter: CHAPTER, status: 'COORD',
  lyric: 'You have left / 你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_122 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex('0000122A');
    const dust = [];
    for (let i = 0; i < 60; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, BASE_W), r.range(0, BASE_H)]);
    }
    this._c = { dust, STEP_PTS: [[0.84 * BASE_W, 0.18 * BASE_H],
                                 [0.86 * BASE_W, 0.16 * BASE_H],
                                 [0.88 * BASE_W, 0.15 * BASE_H]] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = phase(t, 114.32, 114.70);
    const p3 = phase(t, 114.70, 114.86);
    const p4 = phase(t, 114.86, 114.92);
    const P = c.STEP_PTS[Math.min(steps(t, 2, 114.18, 114.32), 2)];

    // 最后 1 条灭点线
    if (t < 114.86) {
      const A = [0.0, 0.0];
      const q = 1.0 - easeInQuad(clamp01(phase(t, 114.70, 114.86)));
      K.line(A, [lerp(A[0], P[0], q), lerp(A[1], P[1], q)], GREY, 1.0, 0.12, 0.0);
    }
    // 亮点 2→1.5px，1.2Hz 微闪
    const flick = 0.80 + 0.20 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.2 * t));
    const rP = lerp(2.0, 1.5, clamp01(p2));
    let sc = 1.0;
    if (t >= 114.86) sc = 1.0 + 0.1 * Math.sin(Math.PI * clamp01((t - 114.86) / 0.03));
    K.disc(P, rP * sc, WARM, flick, 0.22);
    K.ring(P, 3.0 * sc, WARM, 1.0, 0.16, 0.10);
    // 20px 坐标读数
    const bright = t < 114.70 ? 0.9 : 0.9 + 0.2 * clamp01(p3) + 0.2 * clamp01(p4);
    K.textKit(FONT_MONO, 20, `x:88 y:15 d:${(5.19 + 0.12 * clamp01(p2)).toFixed(2)}`,
              P[0] - 0.06 * BASE_W, P[1] + 0.04 * BASE_H + 30, BV,
              Math.min(1.0, bright), 0.18);
    // 散逸尘 60 → 20 点
    const nDust = t < 114.70 ? 60 : Math.trunc(lerp(60, 20, clamp01(p3)));
    K.dots(c.dust.slice(0, nDust), 2.0, GREY, 0.05, 0.0);
    // 主词维持 92%
    K.word_block(FONT_SEMI, 168, ['You have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.04, 114.18, t,
                 { per_char: 0.0, char_dur: 0.001, alpha: 0.92,
                   accents: [[['You have ', ICE], ['left', WARM]]] });
    K.micro({ TL: 'T+114.18s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_122} · pull:3/4`, BR: 'COORD' });
    return { bloomR: 9.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_123  `114.92–115.78` ｜ 亮点退至 1px + 坐标残读数逐字熄灭
   ══════════════════════════════════════════════════════════════ */
const SHOT_123 = {
  id: 'SHOT_123', start: 114.92, end: 115.78,
  seedHex: SEEDS.SHOT_123, chapter: CHAPTER, status: 'FADING',
  lyric: 'You have left / 你已经离开',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_123 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_123);
    const dust = [];
    for (let i = 0; i < 20; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0.10 * BASE_W, 0.30 * BASE_W), 0.86 * BASE_H]);
    }
    this._c = { dust, P: [0.91 * BASE_W, 0.12 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = phase(t, 115.06, 115.52);
    const P = c.P;

    // 1.5 / 1px 每 8 帧交替
    const rP = (Math.trunc(Math.round(t * 60)) % 16) < 8 ? 1.5 : 1.0;
    let flick = 0.90 + 0.10 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.9 * t));
    if (t >= 115.70) flick = 1.0;
    let sc = 1.0;
    if (t >= 115.70) sc = 1.0 + 0.08 * Math.sin(Math.PI * clamp01((t - 115.70) / 0.025));
    K.disc(P, rP * sc, WARM, flick, 0.12);
    // 坐标残读数：字符自右向左逐个熄灭
    const text = 'd:8.50';
    const die = Math.trunc(clamp01(phase(t, 115.52, 115.70)) * text.length);
    const keep = Math.max(1, text.length - die);
    K.textKit(FONT_MONO, 16, text.slice(0, keep), P[0] - 0.06 * BASE_W,
              P[1] + 0.04 * BASE_H + 24, GREY, 0.60);
    // 20 点残尘带
    const nDust = Math.max(0, Math.trunc(20 * (1 - clamp01(phase(t, 115.06, 115.52)))));
    K.dots(c.dust.slice(0, nDust), 2.0, GREY, 0.04, 0.0);
    // 主词 92%→85%（与亮点衰减反向——人退词留）
    let alpha = lerp(0.92, 0.85, easeInOutSine(clamp01(p2)));
    if (t >= 115.52) alpha = 0.85;
    K.word_block(FONT_SEMI, 168, ['You have left'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.04, 114.92, t,
                 { per_char: 0.0, char_dur: 0.001, alpha,
                   accents: [[['You have ', ICE], ['left', WARM]]] });
    K.micro({ TL: 'T+114.92s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_123} · pull:4/4`, BR: 'FADING' });
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_124  `115.78–116.6144` ｜ 右上元素组消失 + 中央竖轴生长 + 3 刻度点
   ══════════════════════════════════════════════════════════════ */
const SHOT_124 = {
  id: 'SHOT_124', start: 115.78, end: 116.6144,
  seedHex: SEEDS.SHOT_124, chapter: CHAPTER, status: 'ALONE',
  lyric: 'You have left me in / 你把我留在了',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_124 = beatsIn(beats, this.start, this.end);
    this._c = { P: [0.91 * BASE_W, 0.12 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p1 = phase(t, 115.78, 115.90);
    const p2 = easeOutExpo(phase(t, 115.90, 116.16));
    const p4 = easeInQuad(phase(t, 116.46, 116.6144));

    // 阶段 1：右上元素组 scale→0
    if (p1 < 1.0) {
      const P = c.P;
      const sc = 1.0 - easeInQuad(p1);
      if (sc > 0.02) {
        K.disc(P, 2.0 * sc, WARM, 0.9 * sc, 0.10);
        K.textKit(FONT_MONO, 16 * Math.max(0.2, sc), 'd:8.50', P[0] - 0.06 * BASE_W,
                  P[1] + 0.04 * BASE_H + 24, GREY, 0.6 * sc);
      }
    }
    // 竖线：自中点向上下两端绘制
    const x = 0.50 * BASE_W;
    const midY = 0.50 * BASE_H;
    const half = 0.50 * BASE_H * p2;
    const a0 = 0.40 + 0.15 * clamp01(phase(t, 116.46, 116.6144));
    K.line([x, midY - half], [x, midY + half], GREY, 1.0, a0, 0.0);
    // 中段加亮区
    if (t >= 116.16) {
      const segA = 0.70;
      K.line([x, 0.44 * BASE_H], [x, 0.52 * BASE_H], GREY, 1.0,
             a0 + (segA - a0) * clamp01(phase(t, 116.16, 116.30)), 0.0);
    }
    // 3 枚刻度点
    const ys = [0.24, 0.48, 0.76];
    for (let i = 0; i < 3; i++) {
      const st = 115.90 + 0.02 * i;
      if (t < st) continue;
      let r = 4.0;
      if (i === 1 && t >= 116.46) r = lerp(4.0, 8.0, clamp01(p4));
      K.dots([[x, ys[i] * BASE_H]], r, ICE, 0.60, 0.15);
    }
    // 主词自左缘外滑入
    const xx = lerp(-0.04 * BASE_W, 0.10 * BASE_W,
                    easeOutCubic(clamp01(phase(t, 115.78, 116.06))));
    K.word_block(FONT_SEMI, 150, ['You have left me in'], xx, [0.48 * BASE_H],
                 0.03, 115.78, t,
                 { per_char: 0.0, char_dur: 0.001, alpha: 0.85,
                   accents: [[['You have left me ', ICE], ['in', CYAN]]] });
    K.micro({ TL: 'T+115.78s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_124} · axis:1`, BR: 'ALONE' });
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_125  `116.6144–117.27` ｜ 竖线切分为 120 点 → 两端向中点收缩
   ══════════════════════════════════════════════════════════════ */
const SHOT_125 = {
  id: 'SHOT_125', start: 116.6144, end: 117.27,
  seedHex: SEEDS.SHOT_125, chapter: CHAPTER, status: 'MORPH',
  lyric: 'You have left me in / 你把我留在了',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_125 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_125);
    const wp = [];
    for (let i = 0; i < 1750; i++) {
      const r = new Rng(seed, 'wp', i);
      wp.push({ sx: r.range(0.10 * BASE_W, 0.78 * BASE_W),
                dy: r.range(-70, 70),
                ty: r.range(-120, 120),
                jit: (i % 47) * 0.006, isCyan: i % 5 === 0 });
    }
    this._c = { wp, x: 0.50 * BASE_W, C: [0.50 * BASE_W, 0.48 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { x, C } = c;
    const p2 = easeInOutQuint(phase(t, 116.80, 117.02));
    const p3 = easeInCubic(phase(t, 117.02, 117.18));

    // 竖线 steps(24) 切分为 120 点
    const segs = Math.min(120, Math.trunc(clamp01(phase(t, 116.6144, 116.78)) * 120) + 1);
    const linePts = [];
    for (let i = 0; i < segs; i++) {
      let y = (i / 119.0) * BASE_H;
      const midDist = Math.abs(i - 60) / 60.0;
      if (t >= 117.02) {
        const keep = (Math.abs(i - 60) <= 20) || (p3 < (1.0 - midDist));
        if (!keep) continue;
        y = lerp(y, C[1], p3 * midDist);
      }
      linePts.push([x, y]);
    }
    K.dots(linePts, t >= 116.80 ? 2.0 : 1.0, GREY,
           t < 116.80 ? 0.55 : 0.55 * (1 - 0.35 * p3), 0.0);
    // 主词（116.80 前）
    if (t < 116.80) {
      K.word_block(FONT_SEMI, 150, ['You have left me in'], 0.10 * BASE_W, [0.48 * BASE_H],
                   0.03, 116.6144, t,
                   { per_char: 0.0, char_dur: 0.001, alpha: 0.85,
                     accents: [[['You have left me ', ICE], ['in', CYAN]]] });
    }
    // 词粒子沿最短路径滑向轴线
    const icePts = [], cyPts = [];
    for (let i = 0; i < 1750; i++) {
      const q0 = c.wp[i];
      const sy0 = 0.48 * BASE_H + q0.dy;
      if (t >= 116.80) {
        const ty = C[1] + q0.ty;
        let q = clamp01(p2 * 1.15 - q0.jit);
        let sx = q0.sx, sy = sy0;
        if (t >= 117.02) {
          const alive = i >= Math.trunc(1500 * clamp01((t - 117.02) / 0.16));
          if (!alive) continue;
          q = 1.0;
          sx = x;
          sy = lerp(ty, C[1], p3);
          (q0.isCyan ? cyPts : icePts).push([sx, sy]);
          continue;
        }
        const p = [lerp(sx, x, q), lerp(sy, ty, q)];
        (q0.isCyan ? cyPts : icePts).push(p);
      }
    }
    if (t >= 116.80) {
      K.dots(icePts, 2.0, ICE, 0.70, 0.10);
      K.dots(cyPts, 2.0, CYAN, 0.70, 0.10);
    }
    // 中央孤点
    if (t >= 117.16) {
      const sc = 1.0 + 0.2 * easeInOutSine(clamp01((t - 117.18) / 0.09));
      K.disc(C, 4.0 * sc, ICE, 0.95, 0.20);
    }
    K.micro({ TL: 'T+116.61s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_125} · sample:4px · 1750pt`, BR: null });
    return { bloomR: 8.0, bloomK: 0.36, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_126  `117.27–118.33` ｜ 呼吸孤点 + ISOLATION 标题 + 引力细线
   ══════════════════════════════════════════════════════════════ */
const SHOT_126 = {
  id: 'SHOT_126', start: 117.27, end: 118.33,
  seedHex: SEEDS.SHOT_126, chapter: CHAPTER, status: 'ISOLATED',
  lyric: 'You have left me in isolation / 你把我留在孤立中',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_126 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;

    // 呼吸周期 1.0s（上 0.35 / 下 0.35 / 静止 0.30）
    const ph = (t - 117.27) % 1.0;
    let br;
    if (ph < 0.35) br = easeInOutSine(ph / 0.35);
    else if (ph < 0.70) br = easeInOutSine(1.0 - (ph - 0.35) / 0.35);
    else br = 0.0;
    const sc = 1.0 + 0.15 * br;
    K.disc(C, 4.0 * sc, ICE, 0.95, 0.20);
    K.ring(C, 8.0, ICE, 1.0, 0.12, 0.05);
    // 标题 ISOLATION 42px / 右下 (82%, 84%) 左对齐
    const aT = clamp01(phase(t, 117.27, 117.45));
    const rise = (1.0 - easeOutQuad(aT)) * 4;
    K.textKit('Inter Medium', 42, 'ISOLATION', 0.82 * BASE_W, 0.84 * BASE_H + rise,
              GREY, 0.55 * aT, 0, 'left', 0.20);
    // 引力细线
    if (t >= 118.05) {
      const q = easeInQuad(phase(t, 118.05, 118.24));
      const end = [0.14 * BASE_W, 0.82 * BASE_H];
      K.line(C, [lerp(C[0], end[0], q), lerp(C[1], end[1], q)], GREY, 1.0, 0.15, 0.0);
    }
    // 左下 2px 花粉点
    if (t >= 118.24) {
      K.dots([[0.14 * BASE_W, 0.82 * BASE_H]], 2.0, CYAN, 0.95, 0.30);
    }
    // 角标 + BR 于 117.45 起以 30% 淡入（单独重绘覆盖默认 60%）
    K.micro({ TL: 'T+117.27s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_126} · breath:1.0s`, BR: 'ISOLATED' }, 0.6);
    const aB = 0.30 * clamp01(phase(t, 117.45, 117.60));
    if (aB > 0.01) {
      // 用 BG_DEEP 覆盖角标默认 BR，再以 30% 重绘
      K.micro({ TL: 'T+117.27s', TR: CHAPTER, BL: '', BR: '' }, 0, BG_DEEP);
      K.textKit(FONT_MONO, 18, 'ISOLATED', BASE_W - 26, BASE_H - 26 - 18, GREY, aB,
                0, 'right');
    }
    return { bloomR: 8.0, bloomK: 0.34, grain: 5.0 };
  },
};

export const CH06_SHOTS = [SHOT_110, SHOT_111, SHOT_112, SHOT_113, SHOT_114,
                           SHOT_115, SHOT_116, SHOT_117, SHOT_118, SHOT_119,
                           SHOT_120, SHOT_121, SHOT_122, SHOT_123, SHOT_124,
                           SHOT_125, SHOT_126];
export { SC as CH06_SC };
