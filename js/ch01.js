/**
 * ch01.js — 第 01 章 BOOT / OBJECT / WORLD（镜头 001–005、007–021）
 *
 * 自 Python 版 render/scenes/ch01_boot.py 移植。
 * 全部为纯函数：同一 t 必须画出同一画面。
 * 半透明一律用真实 alpha 合成；颜色只取 06 §2 登记色。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV, MOODPURPLE as MOOD,
  ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, css, mix,
  easeOutCubic, easeInOutCubic, easeOutExpo, easeOutQuad, rad, linear,
  easeOutBounce, easeOutBack, easeInCubic, easeInQuad, easeInOutSine,
  easeInOutQuad, easeInQuart, easeInExpo,
} from './core.js';
import * as P from './primitives.js';
import {
  Frame, Word, fontOf, pulse, beatsIn, arcPts, limitN, glowc,
} from './kit.js';

const CHAPTER = 'ch01/12';

/* ── 本章网格常量（对应 Python ch01_boot.py 的模块级常量）──────── */
/** 文本宽度（对应 Python 的 font.getlength） */
function textWidth(fontStr, str) {
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fontStr;
  return cv.measureText(str).width;
}

const CELL = 96.0;
const BOARD_W = CELL * 8;
const BOARD_C = [0.5 * BASE_W, 0.48 * BASE_H];

/** 节拍邻域 0..1（对应 Python 的 ring_near） */
function ringNear(t, times, dur) {
  let v = 0;
  for (const b of times || []) {
    const d = Math.abs(t - b);
    if (d <= dur) v = Math.max(v, 1 - d / dur);
  }
  return v;
}
const SEEDS = {
  SHOT_001: '0000001B', SHOT_002: '0000002A', SHOT_003: '0000003B',
  SHOT_004: '0000004A', SHOT_005: '0000005B', SHOT_007: '0000007A',
  SHOT_008: '0000008B', SHOT_009: '0000009A', SHOT_010: '0000010B',
  SHOT_011: '0000011A', SHOT_012: '0000012B', SHOT_013: '0000013A',
  SHOT_014: '0000014B', SHOT_015: '0000015A', SHOT_016: '0000016C',
  SHOT_017: '0000017B', SHOT_018: '0000018A', SHOT_019: '0000019B',
  SHOT_020: '0000020D', SHOT_021: '0000021A',
};

/* ── 场景状态容器（只存种子与预计算表，不含跨帧状态）──────── */
const SC = {
  beatMap: {},
  seeds: {},
  seed(id) { return this.seeds[id] ?? (this.seeds[id] = seedFromHex(SEEDS[id])); },
  beats(id) { return this.beatMap[id] || []; },
};

/** 四角微信息（各章共用的默认写法） */
function corners(f, tl, tr, bl, br) {
  f.micro({ TL: tl, TR: tr, BL: bl, BR: br }, { size: 18, alpha: 0.6 });
}

/* ── 文字采样为粒子（对应 Python 的 text_points）─────────── */
function textPoints(lines, px, weight, trackEm, h, v, anchor, lineStep, opts) {
  const { step = 4, n = null, dpr = 1 } = opts || {};
  const c = document.createElement('canvas');
  c.width = BASE_W * dpr; c.height = BASE_H * dpr;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.scale(dpr, dpr);
  const w = new Word(g, lines, px, { weight, trackEm, dpr, h, v, anchor, lineStep });
  // 用 Word 的逐字位置绘制到离屏画布，再按步长采样
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.font = w.font;
  const out = [];
  const byIdx = w.chars;
  // 直接取样每个字形：为提速，先整体绘制一次再一次性读取
  g.clearRect(0, 0, BASE_W, BASE_H);
  for (const ch of byIdx) g.fillText(ch.ch, ch.x / dpr, ch.baseline / dpr);
  const img = g.getImageData(0, 0, c.width, c.height).data;
  const st = Math.max(1, Math.round(step * dpr));
  for (let y = 0; y < c.height; y += st) {
    for (let x = 0; x < c.width; x += st) {
      if (img[(y * c.width + x) * 4 + 3] >= 128) {
        // 判断落在哪一行（用于 ICE/CYAN 分组）
        const by = y / dpr;
        let li = 0;
        for (let k = 0; k < w.baselines.length; k++) if (by <= w.baselines[k] / dpr) { li = k; break; }
        out.push([x / dpr, by, li]);
      }
    }
  }
  return n ? limitN(out, n) : out;
}

/* ══════════════════════════════════════════════════════════════
   SHOT_007  `01.02–01.45` ｜ switch on the power line（字形转粒子）
   ══════════════════════════════════════════════════════════════ */
const SHOT_007 = {
  id: 'SHOT_007', start: 1.0184, end: 1.74,
  seedHex: SEEDS.SHOT_007, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Switch on the power line',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_007 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_007');
    const LINES = ['Switch on the', 'power line'];
    const W = new Word(ctx, LINES, 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.06, dpr: 1,
      h: 'center', v: 'baseline_last', anchor: [0.5, 0.44], lineStep: 1.02 * 168,
    });
    // 粒子（确定性派生）
    const cur = [];
    for (let i = 0; i < 240; i++) {
      const r = new Rng(seed, 'current', i);
      cur.push({ ph: r.next(), lane: r.range(-1, 1), drag: r.range(0.75, 1) });
    }
    const pts = textPoints(LINES, 168, 'Inter Semi-Bold', 0.06, 'center',
                           'baseline_last', [0.5, 0.44], 1.02 * 168, { step: 4, n: 3200, dpr: 1 });
    const wp = [];
    for (let i = 0; i < pts.length; i++) {
      const r = new Rng(seed, 'wp', i);
      wp.push({ x0: pts[i][0], y0: pts[i][1], li: pts[i][2],
                dx: r.range(-70, 70), dy: r.range(-0.06, 0.06) * BASE_H });
    }
    this._c = { W, cur, wp };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const sc = { seed: (id) => SC.seed(id), beats: (id) => SC.beats(id) };
    const yc = 0.50 * BASE_H;
    const bs = sc.beats('SHOT_007');
    const W = c.W;

    // ① 满宽导体（继承 006）+ 右端 8% 上弯 15°
    const bend = easeInOutCubic(phase(t, 1.68, 1.74));
    const xL = 0.01 * BASE_W, xR = 0.99 * BASE_W, xk = xR - 0.08 * BASE_W;
    const ang = (15.0 * bend * Math.PI) / 180;
    f.line(xL, yc, xk, yc, CYAN, 3, 1, 1.0);
    f.line(xk, yc, xk + (xR - xk) * Math.cos(ang), yc - (xR - xk) * Math.sin(ang), CYAN, 3, 1, 1.0);
    f.line(0.5 * BASE_W - 0.06 * BASE_W, yc, 0.5 * BASE_W + 0.06 * BASE_W, yc, ICE, 3, 1, 1.0);

    // ② 240 颗电流粒子 + 节拍脉冲
    const bump = 1.0 + pulse(t, bs, 0.06, 0.015);
    const flow = easeInOutCubic(phase(t, 1.02, 1.52));
    for (const p of c.cur) {
      const u = p.ph < 0.5 ? p.ph * 2 : (p.ph - 0.5) * 2;
      const prog = clamp01(u * 0.55 + flow * p.drag * 0.45) * bump;
      const x = 0.5 * BASE_W + (p.ph < 0.5 ? 1 : -1) * prog * 0.5 * BASE_W;
      const y = yc + p.lane * 4.0;
      const a = lerp(0.9, 0.1, clamp01(u));
      f.line(x - 8.0 * clamp01(u), y, x, y, ICE, 1, a, 0.6 * a);
    }

    // ③ 词区 4×2 采样网格闪一次
    if (t < 1.06) {
      const gp = 1.0 - phase(t, 1.02, 1.05);
      if (gp > 0.05) {
        const bx0 = 0.5 * BASE_W - W.width / 2 - 20, bx1 = 0.5 * BASE_W + W.width / 2 + 20;
        const by0 = 0.13 * BASE_H, by1 = 0.45 * BASE_H;
        for (let gy = 0; gy < 2; gy++) {
          for (let gx = 0; gx < 4; gx++) {
            f.rect(lerp(bx0, bx1, gx / 4), lerp(by0, by1, gy / 2),
                   lerp(bx0, bx1, (gx + 1) / 4), lerp(by0, by1, (gy + 1) / 2),
                   GREY, 1, 0.30 * gp);
          }
        }
      }
    }

    // ④ 字形残影 → 3200 点 → 吸附导体带 → 并入电流
    const ghost = 1.0 - clamp01(phase(t, 1.06, 1.115));
    if (ghost > 0.02) {
      W.drawPlain(f, (li) => (li === 1 ? CYAN : ICE), { alpha: ghost, glowK: 0.45 * ghost });
    }
    const p2 = easeInOutCubic(phase(t, 1.20, 1.52));
    const p3 = clamp01(phase(t, 1.52, 1.62));
    if (p2 > 0 || t >= 1.06) {
      const ice = [], cyan = [], ia = [], ca = [];
      for (const q of c.wp) {
        const x = lerp(q.x0, q.x0 + q.dx, 0.30 * p2);
        const y = lerp(q.y0, yc + q.dy, p2);
        const a = clamp01((1.0 - p3) * (0.55 + 0.45 * (1.0 - p2)));
        if (q.li === 0) { ice.push([x, y]); ia.push(a); }
        else { cyan.push([x, y]); ca.push(a); }
      }
      f.pts(ice, 2.0, ICE, 1, 0.5, BG_DEEP, ia);
      f.pts(cyan, 2.0, CYAN, 1, 0.5, BG_DEEP, ca);
    }

    // 次级微词
    const mf = fontOf('JetBrains Mono', 24, dpr);
    const ma = 1.0 - clamp01(phase(t, 0.98, 1.06));
    if (ma > 0.02) f.text(0.5 * BASE_W + 12, yc + 18, 'SWITCH:ON', mf.font, GREY, 0.85 * ma);

    corners(f, 'T+1.02s', CHAPTER, `seed:${SEEDS.SHOT_007} · sample:4px · 3200pt`, 'MORPH');
    let k = lerp(0.35, 0.50, easeInOutCubic(phase(t, 1.20, 1.40)));
    k = lerp(k, 0.40, clamp01(phase(t, 1.55, 1.74)));
    return { bloomR: 8.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_008  `01.45–02.90` ｜ remember to put on（导体断裂 → 装配人形）
   ══════════════════════════════════════════════════════════════ */
const SHOT_008 = {
  id: 'SHOT_008', start: 1.74, end: 2.92,
  seedHex: SEEDS.SHOT_008, chapter: CHAPTER, status: 'FIT',
  lyric: 'Remember to put on',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_008 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_008');
    const LINES = ['Remember to', 'put on'];
    const W = new Word(ctx, LINES, 152, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.07, 0.27], lineStep: 130,
    });
    const mk = (sys, n, fn) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(fn(new Rng(seed, sys, i), i));
      return out;
    };
    this._c = {
      W,
      cur: mk('cur', 160, (r) => ({ ph: r.next(), lane: r.range(-1, 1) })),
      burst: mk('burst', 40, (r) => ({ ang: r.range(0, Math.PI * 2), d: r.range(60, 180) })),
      guide: mk('guide', 3, (r) => ({ x0: r.range(-260, 260) })),
      shard: {},
      spark: {},
      seed,
    };
    // 三件护具的火花（每件 24 颗）
    for (const ts of [1.98, 2.20, 2.42]) {
      const arr = [];
      for (let k = 0; k < 24; k++) {
        const r = new Rng(seed, `shard${ts}`, k);
        arr.push({ ang: r.range(0, Math.PI * 2), d: r.range(20, 90) });
      }
      this._c.spark[ts] = arr;
    }
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_008');
    const cx = 0.62 * BASE_W, cy = 0.52 * BASE_H;
    const TOP = cy - 713 / 2, HGT = 713.0;
    const headC = [cx, TOP + 26], neck = [cx, TOP + 52], sh = [cx, TOP + 84],
          pelvis = [cx, TOP + 292];
    const W = c.W;

    // ① 导体断余段：三段圆弧
    const bendp = easeInOutCubic(phase(t, 1.74, 1.92));
    const seg = steps(t, 3, 1.74, 1.92);
    const arcs = [[300, 150, 235], [360, 118, 196], [430, 96, 168]];
    for (let i = 0; i < arcs.length; i++) {
      if (i > seg && bendp < 1.0) continue;
      const [r, a0, a1] = arcs[i];
      f.pline(arcPts(cx, cy, r, r, a0, lerp(a0, a1, bendp), 40), CYAN, 3, 0.85, 0.8);
    }

    // ② 电流粒子随断裂甩出
    const keep = 1.0 - easeOutExpo(phase(t, 1.92, 2.04));
    for (let i = 0; i < c.cur.length; i++) {
      const p = c.cur[i];
      let x = 0.02 * BASE_W + p.ph * 0.96 * BASE_W;
      x = lerp(x, cx, easeInOutCubic(phase(t, 1.74, 1.92)));
      const y = cy + p.lane * 6.0
        + easeOutQuad(phase(t, 1.74, 1.92)) * (i % 2 ? 1 : -1) * 40;
      f.dot(x, y, 1.5, ICE, 0.7 * keep, 0.5 * keep);
    }
    for (const b of c.burst) {
      const d = easeOutExpo(phase(t, 1.92, 2.08)) * b.d;
      f.dot(cx + Math.cos(b.ang) * d, cy + Math.sin(b.ang) * d, 2.0, ICE,
            0.9 * (1.0 - phase(t, 1.92, 2.08)), 0.5);
    }

    // ③ 人形轮廓（火柴式几何人）
    const fig = 1.0 - clamp01(phase(t, 1.92, 2.02));
    const figp = t >= 1.92 ? Math.max(0.35, fig) : 0.0;
    if (figp > 0.01) {
      const segShow = steps(t, 4, 1.92, 2.20);
      f.pline([neck, sh, pelvis], BV, 1.5, figp);
      for (const sgn of [-1, 1]) {
        f.pline([sh, [cx + sgn * 72, TOP + 190], [cx + sgn * 108, TOP + 300]], BV, 1.5, figp);
        f.pline([pelvis, [cx + sgn * 48, TOP + 500], [cx + sgn * 74, TOP + 713]], BV, 1.5, figp);
      }
      if (segShow >= 3) f.pline([neck, headC], BV, 1.5, figp);
    }
    f.ell(headC[0], headC[1], 26, 26, BV, 1.5, Math.max(figp, t >= 2.0 ? 0.35 : 0.0));

    // ④ 三件护具（mechanical snap）
    const snap = (ts, pos, partFn, normal = [1, 0]) => {
      if (t < ts - 0.028) return;
      const p = easeOutCubic(phase(t, ts - 0.028, ts));
      const off = (1 - p) * 0.14 * BASE_W;
      const recoil = t > ts ? -3.0 * Math.sin(Math.PI * clamp01(phase(t, ts, ts + 0.06))) : 0;
      const gx = pos[0] + normal[0] * off + normal[0] * recoil;
      const gy = pos[1] + normal[1] * off + normal[1] * recoil;
      partFn(gx, gy, 1.0);
      if (t >= ts) {
        const flash = 1.0 - clamp01(phase(t, ts, ts + 0.06));
        if (flash > 0.02) f.dot(pos[0], pos[1], 6, WARM, 0.5 * flash, 0.7 * flash);
        for (const s of c.spark[ts] || []) {
          const dd = easeOutExpo(phase(t, ts, ts + 0.16)) * s.d;
          f.dot(pos[0] + Math.cos(s.ang) * dd, pos[1] + Math.sin(s.ang) * dd, 2.0, ICE,
                1.0 - phase(t, ts, ts + 0.16), 0.5);
        }
      }
    };
    snap(1.98, headC, (x, y, a) => f.arc(x, y, 44, 44, -10, 190, CYAN, 3, a, 1.0));
    snap(2.20, [cx, TOP + 150], (x, y, a) => {
      f.arc(x, y, 54, 54, 100, 210, CYAN, 3, a, 1.0);
      f.arc(x, y, 54, 54, -30, 80, CYAN, 3, a, 1.0);
    });
    snap(2.42, [cx - 84, TOP + 190], (x, y, a) => f.arc(x, y, 18, 18, 90, 270, BV, 2.5, a, 0.6));
    snap(2.42, [cx + 84, TOP + 190], (x, y, a) => f.arc(x, y, 18, 18, -90, 90, BV, 2.5, a, 0.6));

    // 接触环缩为头内芯
    const ringa = clamp01(phase(t, 1.74, 1.92));
    const rx = t < 1.92 ? lerp(BASE_W * 0.5, cx, ringa) : cx;
    const ry = lerp(0.50 * BASE_H, TOP + 26, ringa);
    f.dashCircle(rx, ry, 8, ICE, 1.5, 3, 3, 1.0, 0.8);
    f.ell(rx, ry, 6, 6, WARM, 1, 1, 0, WARM, 0.20);

    // ⑤ 装配引导虚线
    const gda = 0.45 * (1.0 - 0.67 * clamp01(phase(t, 2.46, 2.76)));
    for (let i = 0; i < c.guide.length; i++) {
      f.dashLine(0.06 * BASE_W, 0.14 * BASE_H + i * 0.30 * BASE_H, cx, cy, GREY, 1, 6, 6, gda);
    }

    // ⑥ 主词
    const cyan2 = t >= 2.66;
    W.draw(f, t, {
      t0: 2.46, stagger: 0.018, dur: 0.14, dy: 10.0, ease: easeOutExpo,
      color: (li) => (li === 1 && cyan2 ? CYAN : ICE), glowK: 0.35,
    });

    // 次级微词
    const mf = fontOf('JetBrains Mono', 22, dpr);
    const parts = [[1.98, headC, 'PART:HELM'], [2.20, [cx, TOP + 150], 'PART:CHEST'],
                   [2.42, [cx + 84, TOP + 190], 'PART:SHIN']];
    for (const [ts, pos, name] of parts) {
      if (t >= ts) f.text(pos[0] + 14, pos[1] + 8, name, mf.font, GREY, 0.6);
    }

    const bump = pulse(t, bs, 0.06, 0.03);
    corners(f, 'T+1.74s', CHAPTER, `seed:${SEEDS.SHOT_008} · parts:3`, 'FIT');
    const k = 0.32 + 0.10 + bump;
    return { bloomR: 6.0, bloomK: Math.min(0.42, k), grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_009  `2.92–3.87` ｜ 人形收拢 + 六边形 + 三层同心圆 + 护罩网格
   ══════════════════════════════════════════════════════════════ */
const SHOT_009 = {
  id: 'SHOT_009', start: 2.92, end: 3.87,
  seedHex: SEEDS.SHOT_009, chapter: CHAPTER, status: 'LOCK',
  lyric: 'PROTECTION / 保护',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_009 = beatsIn(beats, this.start, this.end);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const rx = 0.38 * BASE_W, ry = 0.30 * BASE_H;
    // 六边形六顶点
    const verts = [];
    for (const a of [0, 60, 120, 180, 240, 300]) {
      verts.push([cx + rx * Math.cos(rad(a)), cy + ry * Math.sin(rad(a))]);
    }
    // 护罩内网格（36×28）—— 与 Python 的 P.grid_lines 同序
    const gl = P.gridLines(28, 36, 0.06, 0.06, 0.94, 0.94);
    const gridLines = (gl.hs || gl[0] || []).concat(gl.vs || gl[1] || []);
    const W = new Word(ctx, ['PROTECTION'], 220, {
      weight: 'Inter Bold', trackEm: 0.14, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.50],
    });
    this._c = { cx, cy, verts, gridLines, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const { cx, cy, verts } = c;
    const bs = SC.beats('SHOT_009');
    const p1 = easeInOutCubic(phase(t, 2.92, 3.10));

    // ① 人形与三护具平移收拢至圆心（scale 1.0 → 0.22）
    const fx = lerp(0.62 * BASE_W, cx, p1);
    const fy = lerp(0.52 * BASE_H, cy, p1);
    const hh = 130.0 * lerp(1.0, 0.22, p1);
    f.ell(fx, fy - hh * 0.36, hh * 0.10, hh * 0.10, BV, 1.4, 0.9);
    f.line(fx, fy - hh * 0.26, fx, fy + hh * 0.12, BV, 1.4, 0.9);
    for (const sgn of [-1, 1]) {
      f.line(fx, fy - hh * 0.20, fx + sgn * hh * 0.22, fy + hh * 0.06, BV, 1.4, 0.9);
      f.line(fx, fy + hh * 0.12, fx + sgn * hh * 0.14, fy + hh * 0.50, BV, 1.4, 0.9);
    }
    for (const [rr, a0] of [[0.20, 100], [0.28, -30]]) {
      f.arc(fx, fy - hh * 0.10, hh * rr * 1.6, hh * rr * 1.6, a0, a0 + 110,
            CYAN, 2, 0.9, 0.5);
    }

    // ② 六边形（六顶点 20ms 错峰点亮 → 六边自顶点向中点绘出）
    for (let i = 0; i < 6; i++) {
      const v0 = verts[i], v1 = verts[(i + 1) % 6];
      const ep = easeOutQuad(phase(t, 3.10 + i * 0.06, 3.10 + i * 0.06 + 0.06));
      f.line(v0[0], v0[1], lerp(v0[0], v1[0], ep), lerp(v0[1], v1[1], ep),
             CYAN, 2.5, 0.95, 0.9);
    }
    for (let i = 0; i < verts.length; i++) {
      if (t >= 2.92 + i * 0.02) f.dot(verts[i][0], verts[i][1], 4, ICE, 1, 0.8);
    }

    // ③ 三层同心圆 r=300/240/180（每层延迟 70ms，dash 层用 steps(36) 分段点亮）
    const RINGS = [[300, BV, 2, false], [240, CYAN, 1.5, true], [180, ICE, 2, false]];
    for (let i = 0; i < RINGS.length; i++) {
      const [r, col, w, dash] = RINGS[i];
      const t0 = 3.10 + i * 0.07;
      const pr = easeOutCubic(phase(t, t0, t0 + 0.34));
      if (dash) {
        const seg = steps(t, 36, t0, t0 + 0.34);
        for (let k = 0; k < seg; k++) {
          const a0 = k * 10.0;
          f.arc(cx, cy, r, r, a0, a0 + 6, col, w, 0.85, 0.6);
        }
      } else if (pr > 0) {
        f.arc(cx, cy, r, r, -90, -90 + 360 * pr, col, w, 0.9, 0.7);
      }
    }

    // ④ 护罩内网格 36×28（圆形裁切，阶段 3 自中心向外张开）
    //    Python 用 Image.new + circle_mask + paste 合成；Canvas 用 clip 等价实现。
    const gp = easeOutExpo(phase(t, 3.56, 3.76));
    if (gp > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx * dpr, cy * dpr, 300 * gp * dpr, 0, Math.PI * 2);
      ctx.clip();
      for (const ln of c.gridLines) {
        f.line(ln[0][0] * BASE_W, ln[0][1] * BASE_H,
               ln[1][0] * BASE_W, ln[1][1] * BASE_H, GREY, 1, 0.18);
      }
      ctx.restore();
    }

    // ⑤ 底部残余导体弧段
    f.line(0.06 * BASE_W, 0.88 * BASE_H, 0.94 * BASE_W, 0.88 * BASE_H, ICE, 2, 0.20);

    // ⑥ 主词硬切上屏 + 第 4–6 字符在 3.60s 转主青
    if (t >= 3.76) {
      c.W.draw(f, t, {
        t0: 3.76, stagger: 0.0, dur: 0.001, dy: 0.0, cut: true, glowK: 0.35,
        color: { base: ICE, rules: [{ when: { ciIn: [3, 4, 5] }, color: CYAN }],
                 _dynConds: ['t >= 3.60'] },
      });
      // 锁定脉冲：六边形整体 scale 1.0→1.03→1.0
      const sp = 1.0 + pulse(t, bs, 0.08, 0.03);
      for (let i = 0; i < 6; i++) {
        const v0 = verts[i], v1 = verts[(i + 1) % 6];
        f.line(lerp(cx, v0[0], sp), lerp(cy, v0[1], sp),
               lerp(cx, v1[0], sp), lerp(cy, v1[1], sp), ICE, 1, 0.35, 0.6);
      }
    }

    corners(f, 'T+2.92s', CHAPTER, `seed:${SEEDS.SHOT_009} · rings:3 · lock`, 'LOCK');
    return { bloomR: 10.0, bloomK: 0.40, grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_010  `3.87–4.7772` ｜ 棋盘 8×8 + 12 枚棋子分三批落下 + 涟漪
   ══════════════════════════════════════════════════════════════ */
/** 12 枚棋子：7 枚蓝紫实心方块（旋转 45°）+ 5 枚主青空心圆环，格点由 seed 固定 */
function makePieces(seedHex) {
  const sd = parseInt(seedHex, 16);
  const cells = [];
  const used = new Set();
  let i = 0;
  while (cells.length < 12 && i < 400) {
    const r = new Rng(sd, 'pieces', i);
    const c = Math.trunc(r.range(0, 8));
    const rw = Math.trunc(r.range(0, 8));
    i++;
    const key = `${c},${rw}`;
    if (used.has(key)) continue;
    used.add(key);
    cells.push([c, rw, cells.length < 7]);
  }
  return cells;
}

/** 格点中心（Python 的 _cell_center） */
function cellCenter(col, row) {
  return [BOARD_C[0] - BOARD_W / 2 + CELL * (col + 0.5),
          BOARD_C[1] - BOARD_W / 2 + CELL * (row + 0.5)];
}

const SHOT_010 = {
  id: 'SHOT_010', start: 3.87, end: 4.7772,
  seedHex: SEEDS.SHOT_010, chapter: CHAPTER, status: 'BOARD',
  lyric: 'Lay down your pieces / 摆好棋子',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_010 = beatsIn(beats, this.start, this.end);
    const LINES = ['Lay down your', 'pieces'];
    const W = new Word(ctx, LINES, 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.02, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.07, 0.25], lineStep: 158,
    });
    this._c = { W, LINES, pcs: makePieces(SEEDS.SHOT_010) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_010');
    const [cxs, cys] = BOARD_C;
    const x0 = cxs - BOARD_W / 2, y0 = cys - BOARD_W / 2;
    const x1 = cxs + BOARD_W / 2, y1 = cys + BOARD_W / 2;
    const stretch = easeInOutCubic(phase(t, 3.87, 4.06));

    // ① 棋盘 8×8（1px 灰蓝 0.5）+ 外围框 2px 主青
    for (let i = 0; i < 9; i++) {
      const xx = x0 + CELL * i, yy = y0 + CELL * i;
      f.line(xx, lerp(cys, y0, stretch), xx, lerp(cys, y1, stretch), GREY, 1, 0.5);
      f.line(lerp(cxs, x0, stretch), yy, lerp(cxs, x1, stretch), yy, GREY, 1, 0.5);
    }
    f.rect(lerp(cxs, x0, stretch), lerp(cys, y0, stretch),
           lerp(cxs, x1, stretch), lerp(cys, y1, stretch), CYAN, 2, 0.9, 0.8);

    // ② 中央环线 r=144 实线冰白 / r=288 虚线蓝紫 + 圆心点
    f.ell(cxs, cys, 144 * stretch, 144 * stretch, ICE, 2, 0.9, 0.5);
    f.dashCircle(cxs, cys, 288 * stretch, BV, 1.5, 10, 8, 0.7, 0.4);
    f.dot(cxs, cys, lerp(14, 5, stretch), ICE, 1, 0.7);

    // ③ 12 枚棋子分 3 批（4.06/4.24/4.42）落下 + ④ 涟漪 + 命中格短亮
    const batchT = [4.06, 4.24, 4.42];
    for (let idx = 0; idx < c.pcs.length; idx++) {
      const [col, row, square] = c.pcs[idx];
      const bx = Math.trunc(idx / 4);
      const st = batchT[Math.min(bx, 2)] + (idx % 4) * 0.04;
      const [tx, ty] = cellCenter(col, row);
      if (t < st) continue;
      const p = clamp01((t - st) / 0.22);
      const yy = lerp(-0.12 * BASE_H, ty, easeOutBounce(p));
      const landed = t >= st + 0.22;
      if (square) {
        const d = 13 * Math.SQRT2;
        f.pline([[tx, yy - d], [tx + d, yy], [tx, yy + d], [tx - d, yy]],
                BV, 2, 0.95, 0.5, BG_DEEP, true);
      } else {
        f.ell(tx, yy, 11, 11, CYAN, 2, 0.95, 0.6);
      }
      for (const k of [0, 1]) {
        const age = t - st - 0.22 - k * 0.09;
        if (age >= 0 && age <= 0.45) {
          const rp = easeOutQuad(age / 0.45);
          f.ell(tx, yy, 170 * rp, 170 * rp, CYAN, 2, 0.7 * (1 - age / 0.45), 0.5);
        }
      }
      if (landed && (t - st - 0.22) <= 0.30) {
        f.rect(tx - CELL / 2, ty - CELL / 2, tx + CELL / 2, ty + CELL / 2, ICE, 1,
               0.35 * (1 - (t - st - 0.22) / 0.30));
      }
    }

    // ⑤ 主词两行（分三次字符淡入：4.30/4.48/4.62；4.66s 第二行变蓝紫）
    const W = c.W;
    let gi = 0;
    for (let li = 0; li < c.LINES.length; li++) {
      const text = c.LINES[li];
      for (let ci = 0; ci < text.length; ci++) {
        const grp = Math.min(2, Math.trunc((ci * 3) / Math.max(1, text.length)));
        const t0 = [4.30, 4.48, 4.62][grp];
        const ch = text[ci];
        const g = W.chars[gi];
        gi++;
        const p = easeOutCubic(phase(t, t0, t0 + 0.16));
        if (p <= 0) continue;
        const col = (li === 1 && t >= 4.66) ? BV : ICE;
        f.text(g.x / dpr, g.baseline / dpr + (1 - p) * 8, ch, W.font, col,
               p, 0.35 * p, W.stroke);
      }
    }

    // 落子微词 p:04 / p:08 / p:12（贴最新落点右上 10px，0.4s 后隐去）
    const mf = fontOf('JetBrains Mono', 18, dpr);
    for (const n4 of [4, 8, 12]) {
      const idx = n4 - 1;
      const [col, row] = c.pcs[idx];
      const st = batchT[Math.min(Math.trunc(idx / 4), 2)] + (idx % 4) * 0.04 + 0.22;
      const [tx, ty] = cellCenter(col, row);
      if (st <= t && t <= st + 0.4) {
        f.text(tx + 10, ty - 22, `p:${String(n4).padStart(2, '0')}`, mf.font, GREY, 0.6);
      }
      if (n4 === 12 && t >= 4.70 && t <= 4.74) {
        f.dot(tx, ty, 15, ICE, 0.8);
      }
    }

    corners(f, 'T+3.87s', CHAPTER,
            `seed:${SEEDS.SHOT_010} · cells:64 · pieces:12`, 'BOARD');
    const k = 0.30 + 0.15 * ringNear(t, bs, 0.10);
    return { bloomR: 8.0, bloomK: k, grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_011  `4.7772–5.49` ｜ 棋盘线合并成基准线 + 棋子滑入 + 词点吸附
   ══════════════════════════════════════════════════════════════ */
const SHOT_011 = {
  id: 'SHOT_011', start: 4.7772, end: 5.49,
  seedHex: SEEDS.SHOT_011, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Lay down your pieces / 摆好棋子',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_011 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_011');
    const LINES = ['Lay down your', 'pieces'];
    const W = new Word(ctx, LINES, 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.02, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.07, 0.25], lineStep: 158,
    });
    const pts = textPoints(LINES, 144, 'Inter Semi-Bold', 0.02, 'left',
                           'baseline_last', [0.07, 0.25], 158,
                           { step: 4, n: 2600, dpr: 1 });
    const wp = [];
    for (let i = 0; i < pts.length; i++) {
      const r = new Rng(seed, 'wp', i);
      wp.push({ px: pts[i][0], py: pts[i][1], li: pts[i][2],
                jx: r.range(0, 1), jy: r.range(-0.015, 0.015) * BASE_H });
    }
    this._c = { W, LINES, wp, pcs: makePieces(SEEDS.SHOT_010) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_011');
    const yline = 0.66 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;

    // ① 90 条棋盘水平线 25ms 错峰下压合并
    for (let i = 0; i < 90; i++) {
      const st = 4.94 + i * 0.025;
      const p = easeInOutCubic(phase(t, st, st + 0.30));
      const yy = lerp(0.34 * BASE_H + i * ((0.42 * BASE_H) / 89), yline, p);
      f.line(0.14 * BASE_W, yy, 0.86 * BASE_W, yy, GREY, 1, 0.45 * (1 - p * 0.7));
    }
    // ② 基准线 2px 主青 + 行尾 r=6 光点
    f.line(x0, yline, x1, yline, CYAN, 2, 0.95, 0.9);
    const dotCx = lerp(BASE_W * 0.5, x1, clamp01(phase(t, 4.78, 5.10)));
    f.dot(dotCx, yline, 6, CYAN, 1, 1.0);

    // ③ 12 枚棋子以 40ms 错峰滑向基准线（间距 6.5%W）
    for (let idx = 0; idx < c.pcs.length; idx++) {
      const [col, row, square] = c.pcs[idx];
      const [sx, sy] = cellCenter(col, row);
      const st = 4.94 + idx * 0.04;
      const p = easeOutCubic(phase(t, st, st + 0.26));
      const tx = 0.14 * BASE_W + idx * 0.065 * BASE_W;
      const px = lerp(sx, tx, p), py = lerp(sy, yline, p);
      if (square) {
        const d = 13 * Math.SQRT2;
        f.pline([[px, py - d], [px + d, py], [px, py + d], [px - d, py]],
                BV, 2, 0.95, 0.5, BG_DEEP, true);
      } else {
        f.ell(px, py, 11, 11, CYAN, 2, 0.95, 0.6);
      }
    }

    // ④ 词区 4×2 采样网格闪一次 + 主词 2,600 点吸附基准线
    const gp = 1.0 - phase(t, 4.78, 4.82);
    if (gp > 0.05 && t < 4.94) {
      const W = c.W;
      const bx0 = 0.07 * BASE_W, bx1 = 0.07 * BASE_W + W.width + 24;
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          f.rect(lerp(bx0, bx1, gx / 4), lerp(0.11 * BASE_H, 0.30 * BASE_H, gy / 2),
                 lerp(bx0, bx1, (gx + 1) / 4), lerp(0.11 * BASE_H, 0.30 * BASE_H, (gy + 1) / 2),
                 GREY, 1, 0.30 * gp);
        }
      }
    }
    const ghost = 1.0 - clamp01(phase(t, 4.90, 4.955));
    if (ghost > 0.02) {
      c.W.drawPlain(f, { base: ICE, rules: [{ when: { li: 1 }, color: BV }] },
                    { alpha: ghost, glowK: 0.4 * ghost }, t);
    }
    const p2 = easeInOutCubic(phase(t, 4.94, 5.24));
    const p3 = clamp01(phase(t, 5.24, 5.32));
    const row0 = [], al0 = [], row1 = [], al1 = [];
    const al = clamp01(1.0 - p3) * 0.8;
    for (const q of c.wp) {
      const tx = q.px * 0.65 + (x0 + q.jx * (x1 - x0)) * 0.35;
      const ty = yline + q.jy * (1 - p2);
      const px = lerp(q.px, tx, 0.55 * p2), py = lerp(q.py, ty, p2);
      if (q.li === 0) { row0.push([px, py]); al0.push(al); }
      else { row1.push([px, py]); al1.push(al); }
    }
    f.pts(row0, 2, ICE, 1, 0.5, BG_DEEP, al0);
    f.pts(row1, 2, BV, 1, 0.5, BG_DEEP, al1);

    // 阶段 3：>5.24 不再绘制四角
    if (t < 5.24) {
      corners(f, 'T+4.78s', CHAPTER,
              `seed:${SEEDS.SHOT_011} · sample:4px · 2600pt`, 'MORPH');
    }
    const k = t < 5.24
      ? lerp(0.35, 0.50, easeInOutCubic(phase(t, 4.94, 5.10)))
      : 0.40;
    return { bloomR: 8.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_012  `5.49–6.38` ｜ READY 面板 + BEGIN 硬切 + 光标闪烁 + 广播方波
   ══════════════════════════════════════════════════════════════ */
const SHOT_012 = {
  id: 'SHOT_012', start: 5.49, end: 6.38,
  seedHex: SEEDS.SHOT_012, chapter: CHAPTER, status: 'INIT',
  lyric: "And let's begin / 让我们开始",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_012 = beatsIn(beats, this.start, this.end);
    const Wb = new Word(ctx, ['BEGIN'], 168, {
      weight: 'Inter Bold', trackEm: 0.14, dpr: 1,
      h: 'center', v: 'center', anchor: [0.46, 0.5],
    });
    this._c = { Wb, pcs: makePieces(SEEDS.SHOT_010) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_012');
    const cxs = 0.50 * BASE_W, cys = 0.50 * BASE_H;
    const pw = 0.46 * BASE_W, ph = 0.22 * BASE_H;
    const y0 = cys - ph / 2, y1 = cys + ph / 2;

    // 继承 011 的基准线 + 12 枚棋子（静置；6.02s 被广播扫过时脉冲）
    const yline = 0.66 * BASE_H;
    f.line(0.06 * BASE_W, yline, 0.94 * BASE_W, yline, CYAN, 2, 0.70, 0.5);
    for (let idx = 0; idx < c.pcs.length; idx++) {
      const square = c.pcs[idx][2];
      const px = 0.14 * BASE_W + idx * 0.065 * BASE_W;
      const dist = Math.abs(px - cxs) + Math.abs(yline - cys);
      const bump = 1.0 + pulse(t, [6.02 + dist / 1600.0], 0.07, 0.06);
      if (square) {
        const d = 13 * Math.SQRT2 * bump;
        f.pline([[px, yline - d], [px + d, yline], [px, yline + d], [px - d, yline]],
                BV, 2, 0.70, 0.4, BG_DEEP, true);
      } else {
        f.ell(px, yline, 11 * bump, 11 * bump, CYAN, 2, 0.70, 0.5);
      }
    }

    // ① READY 面板四边自四角绘出 + 四角主青角标
    const q = easeOutQuad(phase(t, 5.49, 5.66));
    const half = (q * pw) / 2;
    f.rect(cxs - half, y0, cxs + half, y1, GREY, 1.5, 0.9);
    if (q >= 1.0) {
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const bx = cxs + (sx * pw) / 2, by = cys + (sy * ph) / 2;
          f.line(bx, by, bx - sx * 12, by, CYAN, 2, 1, 0.8);
          f.line(bx, by, bx, by - sy * 12, CYAN, 2, 1, 0.8);
        }
      }
    }

    // ② 光标（steps 闪烁）
    const cxr = 0.64 * BASE_W;
    const cw = 12, chh = lerp(52, 52, clamp01(phase(t, 5.49, 5.66)));
    let blink = true;
    if (t >= 5.66 && t < 6.02) blink = Math.trunc((t - 5.66) / 0.09) % 2 === 0;
    else if (t >= 6.26) blink = Math.trunc((t - 6.26) / 0.5) % 2 === 0;
    if (blink && q > 0) {
      f.rect(cxr, cys - chh / 2, cxr + cw, cys + chh / 2, ICE, 1, 1, 0.6, ICE, 1.0);
    }

    // ③ BEGIN 于 5.70s hard cut 上屏
    if (t >= 5.70) {
      c.Wb.draw(f, t, {
        t0: 5.70, stagger: 0.0, dur: 0.001, dy: 0.0, cut: true,
        color: CYAN, glowK: 0.4,
      });
    }

    // ④ 广播方波（6.02s 起 0.60s linear，扫过 12 枚棋子）
    if (t >= 6.02) {
      const bp = phase(t, 6.02, 6.62);
      if (bp < 1.0) {
        const bw = pw * 0.5 + (1.20 * BASE_W - pw * 0.5) * bp;
        const bh = ph * 0.5 + ((1.20 * BASE_W * ph) / pw - ph * 0.5) * bp;
        f.rect(cxs - bw / 2, cys - bh / 2, cxs + bw / 2, cys + bh / 2,
               CYAN, 2, 0.7 * (1 - bp), 0.6 * (1 - bp), null, 0, BG_DEEP, 8);
      }
    }

    // ⑤ 次词 And let's begin（42px，5.80s 起打字出现）
    const mf = fontOf('JetBrains Mono', 42, dpr);
    const sub = "And let's begin";
    const n = (Math.trunc(sub.length * clamp01(phase(t, 5.80, 6.10)) * 15) / 15.0) * sub.length;
    f.text(0.28 * BASE_W, 0.36 * BASE_H, sub.slice(0, Math.max(0, Math.trunc(n))),
           mf.font, GREY, 0.55);

    corners(f, 'T+5.49s', CHAPTER, `seed:${SEEDS.SHOT_012} · ready:TRUE`, 'INIT');
    const k = 0.35 + 0.10 * ringNear(t, bs, 0.10);
    return { bloomR: 8.0, bloomK: Math.min(0.45, k), grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_013  `6.38–7.45` ｜ 检查器双栏：代码 9 行逐字揭示 + 线框球 + 主词
   ══════════════════════════════════════════════════════════════ */
/** 左栏代码（对应 Python 的 CODE_9） */
const CODE_9 = [
  '> begin object()',
  '  set radius = 1.00',
  '  set mass   = 0.75',
  '  bind seed  = 0x13A',
  '  for each vertex:',
  '    emit point(p)',
  '  if integrity > 0:',
  '    commit(object)',
  '  return READY',
];

const SHOT_013 = {
  id: 'SHOT_013', start: 6.38, end: 7.45,
  seedHex: SEEDS.SHOT_013, chapter: CHAPTER, status: 'MAKE',
  lyric: 'OBJECT CREATION / 对象的创造',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_013 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ['OBJECT CREATION'], 144, {
      weight: 'Inter Bold', trackEm: 0.08, dpr: 1,
      h: 'left', v: 'baseline_first', anchor: [0.06, 0.115],
    });
    this._c = { W, totalChars: CODE_9.reduce((a, s) => a + s.length, 0) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cxs = 0.50 * BASE_W, cys = 0.50 * BASE_H;
    const top0 = 0.06 * BASE_H, top1 = 0.14 * BASE_H;
    const lx0 = 0.05 * BASE_W, lx1 = 0.49 * BASE_W;
    const rx0 = 0.53 * BASE_W, rx1 = 0.95 * BASE_W;
    const bot = 0.96 * BASE_H;
    const stretch = easeInOutCubic(phase(t, 6.38, 6.56));

    // 继承 012：READY 面板四边拉伸为检查器三段框线
    const pw = 0.46 * BASE_W, ph = 0.22 * BASE_H;
    const q = easeOutQuad(phase(t, 6.38, 6.52));
    f.rect(cxs - (pw / 2) * q, cys - ph / 2, cxs + (pw / 2) * q, cys + ph / 2, GREY, 1.5, 0.9);
    // 栏内底色（+6% 提亮）
    f.rect(lx0, top1, lx1, lerp(top1, bot, stretch), BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    f.rect(rx0, top1, rx1, lerp(top1, bot, stretch), BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    // 顶栏 + 分栏线
    for (const yy of [top0, top1]) f.line(lx0, yy, rx1, yy, GREY, 1.5, 0.9);
    f.line(lx0, top0, lx0, bot, GREY, 1.5, 0.9);
    f.line(rx1, top0, rx1, bot, GREY, 1.5, 0.9);
    f.line(0.51 * BASE_W, top1, 0.51 * BASE_W, bot, GREY, 1.0,
           0.5 * (1 - clamp01(phase(t, 7.45, 7.66))));

    // ① 左栏代码 9 行（24px / 行高 34px）
    const mf = fontOf('JetBrains Mono', 24, dpr);
    const nf = fontOf('JetBrains Mono', 24, dpr);
    const reveal = c.totalChars * clamp01(phase(t, 6.56, 7.06));
    let done = 0;
    const xLeft = 0.06 * BASE_W;
    for (let li = 0; li < CODE_9.length; li++) {
      const line = CODE_9[li];
      const y = 0.30 * BASE_H + li * 34;
      if (t < 6.56) { done += line.length; continue; }
      const show = Math.max(0, Math.min(line.length, Math.trunc(reveal - done)));
      done += line.length;
      f.text(xLeft - 26, y, String(li + 1).padStart(2, '0'), nf.font, BV, 0.55);
      if (show <= 0) continue;
      const cur = show < line.length;
      f.text(xLeft, y, line.slice(0, show), mf.font, cur ? CYAN : GREY,
             cur ? 0.9 : 0.7, cur ? 0.5 : 0.0);
      if (cur) {
        const w = textWidth(mf.font, line.slice(0, show));
        f.rect(xLeft + w + 4, y, xLeft + w + 12, y + 24, CYAN, 1, 1, 0.7, CYAN, 1.0);
        // 向右栏发一条 1px 对应线
        const cp = easeOutQuad(phase(t, 6.56 + li * 0.06, 6.68 + li * 0.06));
        f.line(lx1, y + 12, lerp(lx1, rx0, cp), y + 12 + li * 4, GREY, 1,
               0.6 * (1 - 0.58 * cp));
      }
    }

    // ② 右栏线框球 3 条大圆 + 坐标轴 + 属性环
    const bx = 0.74 * BASE_W, by = 0.54 * BASE_H;
    const sp = easeOutCubic(phase(t, 6.74, 7.14));
    if (sp > 0.01) {
      const r = 130 * sp;
      f.ell(bx, by, r, r, CYAN, 2, 0.9, 0.7);
      f.ell(bx, by, r, r * 0.38, CYAN, 2, 0.7, 0.5);
      f.ell(bx, by, r * 0.38, r, CYAN, 2, 0.7, 0.5);
    }
    const AXES = [[150, 96, 'X'], [0, -150, 'Y'], [-132, 76, 'Z']];
    for (let i = 0; i < AXES.length; i++) {
      const [dx, dy, lab] = AXES[i];
      const ap = easeOutExpo(phase(t, 6.90 + i * 0.06, 7.10 + i * 0.06));
      if (ap > 0.01) {
        const ex = bx + dx * ap, ey = by + dy * ap;
        f.line(bx, by, ex, ey, BV, 2, 0.9, 0.5);
        f.dot(ex, ey, 4, BV, 1, 0.6);
        const lf = fontOf('JetBrains Mono', 14, dpr);
        f.text(ex + 6, ey - 6, lab, lf.font, GREY, 0.6);
      }
    }
    const rp = easeOutCubic(phase(t, 7.08, 7.26));
    if (rp > 0.01) {
      f.dashCircle(bx, by, 188, BV, 1.5, 6, 10, 0.7 * rp, 0.4 * rp);
      for (let i = 0; i < 8; i++) {
        const a = rad(i * 45);
        f.dot(bx + 188 * Math.cos(a), by + 188 * Math.sin(a), 4, BV, rp, 0.5);
      }
    }

    // ③ 主词 144px 逐字符 hard cut 上屏
    c.W.draw(f, t, {
      t0: 7.26, stagger: (7.45 - 7.26) / 15.0, dur: 0.001, dy: 0.0,
      cut: true, color: ICE, glowK: 0.4,
    });
    const tf = fontOf('JetBrains Mono', 42, dpr);
    if (t >= 7.26) {
      f.text(0.78 * BASE_W, 0.115 * BASE_H - 42, 'BEGIN', tf.font, GREY, 0.5);
    }

    corners(f, 'T+6.38s', CHAPTER, `seed:${SEEDS.SHOT_013} · lines:9 · obj:1`, 'MAKE');
    return { bloomR: 8.0, bloomK: 0.35 + 0.15 * ringNear(t, [6.74], 0.2),
             grain: 4.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_014  `7.45–8.9284` ｜ 参数表逐行改写 + 中央球即时形变 + SELF:NULL 断口
   ══════════════════════════════════════════════════════════════ */
const PARAMS = ['POS_X', 'POS_Y', 'RADIUS', 'MASS', 'SPIN', 'OPACITY', 'COLOR_ID',
                'SEED', 'SELF', 'LOCK'];
const PVALS = ['0.4213', '-1.2040', '120.000', '0.7500', '2.4000', '1.0000',
               '#35D9E8', '0x0014B', 'NULL', 'TRUE'];

const SHOT_014 = {
  id: 'SHOT_014', start: 7.45, end: 8.9284,
  seedHex: SEEDS.SHOT_014, chapter: CHAPTER, status: 'RUN',
  lyric: 'Fill in my data parameters / 填充我的数据参数',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_014 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ['Fill in my data', 'parameters'], 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.02, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.06, 0.25], lineStep: 156,
    });
    const jit = [];
    for (let k = 0; k < 12; k++) {
      jit.push(new Rng(SC.seed('SHOT_014'), 'jitter', k).range(-4, 4));
    }
    this._c = { W, jit };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const ball = [0.50 * BASE_W, 0.58 * BASE_H];
    const mf = fontOf('JetBrains Mono', 24, dpr);
    const xName = 0.06 * BASE_W, xVal = 0.94 * BASE_W;
    const rowY = [];
    for (let i = 0; i < 10; i++) rowY.push(0.36 * BASE_H + i * 0.05 * BASE_H);

    // 中缝线淡出 + 顶栏保留（主词缩为 42px 次词移至顶栏右端）
    f.line(0.51 * BASE_W, 0.14 * BASE_H, 0.51 * BASE_W, 0.96 * BASE_H, GREY, 1.0,
           0.5 * (1 - clamp01(phase(t, 7.45, 7.60))));
    f.line(0.05 * BASE_W, 0.14 * BASE_H, 0.95 * BASE_W, 0.14 * BASE_H, GREY, 1.5, 0.8);
    const sf = fontOf('JetBrains Mono', 42, dpr);
    f.text(0.78 * BASE_W, 0.075 * BASE_H, 'OBJECT CREATION', sf.font, GREY, 0.55);

    // ① 左栏参数名（逐行 24ms）+ ② 右栏数值跳变（每 78ms 一行）
    for (let i = 0; i < PARAMS.length; i++) {
      const name = PARAMS[i], val = PVALS[i];
      const y = rowY[i];
      const rw = easeInOutCubic(phase(t, 7.45 + i * 0.024, 7.60 + i * 0.024));
      if (rw <= 0) continue;
      let active = false, flash = 0.0;
      for (const t0 of [7.66 + i * 0.078, 8.44 + i * 0.078]) {
        if (t0 <= t && t <= t0 + 0.18) active = true;
        if (t0 <= t && t <= t0 + 0.09) flash = 1.0 - (t - t0) / 0.09;
      }
      // 绑定线（dash 2-6）+ 跑光
      f.dashLine(xName + 180, y + 12, ball[0], ball[1], BV, 1, 2, 6,
                 0.35 + 0.3 * (active ? 1 : 0));
      if (active) {
        const lp = easeOutQuad(clamp01((t - Math.min(7.66 + i * 0.078, 8.44 + i * 0.078)) / 0.18));
        f.dot(lerp(xName + 180, ball[0], lp), lerp(y + 12, ball[1], lp), 3, CYAN, 1, 1.0);
      }
      f.text(xName, y, name, mf.font, GREY, 0.6 * rw);
      const w = textWidth(mf.font, val);
      if (name === 'SELF') {
        const on = Math.trunc(t / 1.2) % 2 === 0;
        f.text(xVal - w, y, val, mf.font, on ? mix(GREY, ICE, 0.8) : GREY, 1.0);
      } else {
        const vc = flash > 0.5 ? ICE : CYAN;
        f.text(xVal - w, y, val, mf.font, vc, active ? 0.9 : 0.7);
      }
    }

    // ④ 中央球：随参数即时形变
    let ai = -1;
    for (let i = 0; i < 10 && ai < 0; i++) {
      for (const t0 of [7.66 + i * 0.078, 8.44 + i * 0.078]) {
        if (t0 <= t && t <= t0 + 0.12) { ai = i; break; }
      }
    }
    let dx = 0.0;
    if (ai === 0 || ai === 1) {
      dx = 0.06 * BASE_W * Math.sin(Math.PI * clamp01((t - 7.66 - ai * 0.078) / 0.12));
    }
    let sc = 1.0;
    if (ai === 2 || ai === 3) {
      const p = clamp01((t - 7.66 - ai * 0.078) / 0.12);
      sc = 1.0 + 0.08 * Math.sin(Math.PI * p) * (ai === 2 ? 1 : -1);
    }
    const colBall = (ai === 6 && Math.trunc(t * 4) % 2 === 0) ? BV : CYAN;
    let op = 0.9;
    if (ai === 5) {
      op = lerp(0.5, 1.0,
                clamp01(Math.sin(Math.PI * clamp01((t - 7.66 - 5 * 0.078) / 0.12))));
    }
    const bx = ball[0] + (ai === 0 ? dx : 0.0);
    const by = ball[1] + (ai === 1 ? dx * 0.6 : 0.0);
    const r = 120 * sc;
    f.ell(bx, by, r, r, colBall, 2, op, 0.6);
    f.ell(bx, by, r, r * 0.38, colBall, 2, op * 0.8, 0.4);
    f.ell(bx, by, r * 0.38, r, colBall, 2, op * 0.8, 0.4);
    f.dashCircle(bx, by, 168, BV, 1.5, 6, 10, 0.6, 0);
    for (const [ddx, ddy] of [[96, 62], [0, -96], [-84, 48]]) {
      f.line(bx, by, bx + ddx, by + ddy, BV, 2, 0.7);
    }
    if (ai === 7) {
      for (let k = 0; k < 12; k++) {
        const a = rad(k * 30);
        const j = c.jit[k];
        f.dot(bx + (r + j) * Math.cos(a), by + (r + j) * Math.sin(a), 3, ICE, 0.8);
      }
    }

    // ⑤ `SELF:NULL` 断口（8.56s 起，端点闪红 40%）
    const row8Y = 0.36 * BASE_H + 8 * 0.05 * BASE_H + 12;
    if (t >= 8.56) {
      const gx0 = lerp(xName + 180, ball[0], 0.62);
      const gx1 = gx0 + 24;
      f.line(gx0, row8Y, gx1, row8Y, BG_DEEP, 4, 1.0);
      if (t <= 8.60) {
        f.dot(gx0, row8Y, 3, RED, 0.4);
        f.dot(gx1, row8Y, 3, RED, 0.4);
      }
    }

    // ⑥ 主词两行（第二行最后 3 字 8.76s 起补完）
    const W = c.W;
    for (let gi = 0; gi < W.chars.length; gi++) {
      const g = W.chars[gi];
      const li = g.li, ci = g.ci;
      const isParam = li === 1;
      const tail = isParam && ci >= 'parameters'.length - 3;
      let p;
      if (!isParam) {
        p = easeOutCubic(phase(t, 7.45, 7.45 + 0.20));
      } else if (tail) {
        p = easeOutCubic(phase(t, 8.76 + (ci - ('parameters'.length - 3)) * 0.03, 8.93));
      } else {
        const t0 = 7.45 + ci * 0.012;
        p = easeOutCubic(phase(t, t0, t0 + 0.20));
      }
      if (p <= 0) continue;
      const col = isParam ? BV : ICE;
      f.text(g.x / dpr, g.baseline / dpr + (1 - p) * 8, g.ch, W.font, col,
             p, 0.35 * p, W.stroke);
    }

    corners(f, 'T+7.45s', CHAPTER,
            `seed:${SEEDS.SHOT_014} · params:10 · SELF:NULL`, 'RUN');
    return { bloomR: 8.0, bloomK: 0.40, grain: 4.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_015  `8.9284–10.09` ｜ 词点重排为 3 条轨道 + 球体收缩为核点
   ══════════════════════════════════════════════════════════════ */
const SHOT_015 = {
  id: 'SHOT_015', start: 8.9284, end: 10.09,
  seedHex: SEEDS.SHOT_015, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Fill in my data parameters / 填充我的数据参数',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_015 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_015');
    const LINES = ['Fill in my data', 'parameters'];
    const W = new Word(ctx, LINES, 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.02, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.06, 0.25], lineStep: 156,
    });
    const pts = textPoints(LINES, 144, 'Inter Semi-Bold', 0.02, 'left',
                           'baseline_last', [0.06, 0.25], 156,
                           { step: 4, n: 2600, dpr: 1 });
    const wp = [];
    for (let i = 0; i < pts.length; i++) {
      wp.push({ px: pts[i][0], py: pts[i][1], li: pts[i][2], i });
    }
    const reds = [];
    for (let k = 0; k < 18; k++) {
      reds.push(new Rng(seed, 'red', k).range(0, Math.PI * 2));
    }
    this._c = { W, wp, reds };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const core = [0.50 * BASE_W, 0.52 * BASE_H];
    const mf = fontOf('JetBrains Mono', 24, dpr);
    const fadeA = 0.6 * (1 - clamp01(phase(t, 9.14, 9.30)));

    // ① 参数行同时向中缝收拢
    const gath = easeInOutCubic(phase(t, 8.93, 9.14));
    for (let i = 0; i < 7; i++) {
      const y = 0.36 * BASE_H + i * 0.05 * BASE_H;
      const xx = lerp(0.06 * BASE_W, 0.48 * BASE_W, gath);
      f.text(xx, y, PARAMS[i], mf.font, GREY, fadeA);
      const w = textWidth(mf.font, PVALS[i]);
      const xv = 0.94 * BASE_W - w - (0.94 * BASE_W - 0.52 * BASE_W) * gath;
      f.text(xv, y, PVALS[i], mf.font, CYAN, 0.7 * (1 - clamp01(phase(t, 9.14, 9.30))));
    }

    // ② 主词轮廓采样 → 与参数一同绕核重排为 3 条轨道
    const ghost = 1.0 - clamp01(phase(t, 9.30, 9.36));
    if (ghost > 0.02) {
      c.W.drawPlain(f, { base: ICE, rules: [{ when: { li: 1 }, color: BV }] },
                    { alpha: ghost * 0.9, glowK: 0.4 * ghost }, t);
    }
    const snap = easeInOutCubic(phase(t, 9.14, 9.58));
    const radii = [190, 250, 310];
    const shrink = clamp01(phase(t, 9.58, 9.92));
    const alMul = 0.85 * (1 - 0.25 * clamp01(phase(t, 9.92, 10.09)));
    const dp = [], al = [];
    for (const q of c.wp) {
      const r = radii[q.i % 3] * (1 - 0.55 * shrink);
      const ang = Math.atan2(q.py - core[1], q.px - core[0]) + q.i * 0.004;
      const tgx = core[0] + r * Math.cos(ang);
      const tgy = core[1] + r * Math.sin(ang);
      dp.push([lerp(q.px, tgx, snap), lerp(q.py, tgy, snap)]);
      al.push(alMul);
    }
    f.pts(dp, 2, ICE, 1, 0.5, BG_DEEP, al);

    // ③ 球体自 r=120 收缩为 r=24 核点
    const shr = easeInOutCubic(phase(t, 9.58, 9.92));
    const rr = lerp(120, 24, shr);
    f.ell(core[0], core[1], rr, rr, CYAN, 2, 0.8, 0.9);
    f.dot(core[0], core[1], 24, ICE, 1, 1.0);
    f.dot(core[0], core[1], 60, CYAN, 0.10 * (1 - shr * 0.4), 0.6);

    // ④ 3 段残弧停在核外 r=168 + 18 颗红粒子
    const spin = [0.12, -0.07, 0.05];
    const ARC0 = [20, 150, 268];
    for (let k = 0; k < 3; k++) {
      const aa = ARC0[k] + (spin[k] * 180 / Math.PI) * (t - 9.92);
      f.arc(core[0], core[1], 168, 168, aa, aa + 40, BV, 2, 0.5);
    }
    for (let k = 0; k < 18; k++) {
      const ang = c.reds[k] + 0.3 * (t - 9.92);
      f.dot(core[0] + 110 * Math.cos(ang), core[1] + 110 * Math.sin(ang), 2, RED, 0.3);
    }

    // 三条轨道自转（0.12/0.07/-0.05 rad/s）
    const ORB = [[190, 0.12], [250, 0.07], [310, -0.05]];
    if (t >= 9.92) {
      for (const [r, w] of ORB) {
        const ang = w * (t - 9.92);
        f.ell(core[0], core[1], r * 0.55, r * 0.55, GREY, 1, 0.25);
        f.dot(core[0] + r * 0.55 * Math.cos(ang),
              core[1] + r * 0.55 * Math.sin(ang), 2, CYAN, 1, 0.5);
      }
    }

    if (t < 9.14) {
      corners(f, 'T+8.93s', CHAPTER,
              `seed:${SEEDS.SHOT_015} · sample:7160pt`, 'MORPH');
    }
    let k = lerp(0.35, 0.45, easeInOutCubic(phase(t, 9.14, 9.58)));
    k = lerp(k, 0.35, clamp01(phase(t, 9.70, 10.09)));
    return { bloomR: 9.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_016  `10.09–11.10` ｜ 核心脉冲 + 7 层环逐刻度点亮 + 168 粒子 + 主词
   ══════════════════════════════════════════════════════════════ */
const SHOT_016 = {
  id: 'SHOT_016', start: 10.09, end: 11.10,
  seedHex: SEEDS.SHOT_016, chapter: CHAPTER, status: 'INIT',
  lyric: 'INITIALIZATION / 初始化',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_016 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_016');
    const orb = [];
    for (let i = 0; i < 168; i++) {
      orb.push({ rr: [190, 290, 390][i % 3],
                 a0: new Rng(seed, 'orb', i).range(0, 360),
                 sp: [26.0, -16.0, 9.0][i % 3] });
    }
    const W = new Word(ctx, ['INITIALIZATION'], 200, {
      weight: 'Inter Bold', trackEm: 0.06, dpr: 1,
      h: 'center', v: 'center', anchor: [0.5, 0.50],
    });
    this._c = { orb, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_016');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const RINGS = [90, 140, 190, 240, 290, 340, 390];
    const COLORS = [CYAN, BV, GREY];

    // ① 核心 pulse（r 46→56→46）+ 20% 暖色内晕
    const pl = easeOutBack(phase(t, 10.09, 10.21), 1.4);
    const rc = t >= 10.09 ? 46 + 10 * Math.sin(Math.PI * pl) : 46;
    f.dot(cx, cy, rc, ICE, 1, 1.0);
    f.dot(cx, cy, rc * 0.75, WARM, 0.20, 0.6);

    // ② 7 层环：70ms 依次生成，每环 steps(36) 逐刻度点亮后闭合
    for (let i = 0; i < RINGS.length; i++) {
      const r0 = RINGS[i];
      const t0 = 10.30 + i * 0.07;
      if (t < t0) continue;
      const pr = easeOutCubic(phase(t, t0, t0 + 0.30));
      const r = r0 * lerp(0.92, 1.0, pr);
      const col = COLORS[i % 3];
      const a = 0.55 + 0.40 * (i / 6.0);
      f.ell(cx, cy, r, r, col, 2, a * Math.min(1.0, pr * 3), 0.6);
      const seg = steps(t, 36, t0, t0 + 0.30);
      for (let k = 0; k < seg; k++) {
        const ang = rad(k * 10);
        f.dot(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 2, ICE, 0.7);
      }
      if (t <= t0 + 0.05) f.ell(cx, cy, r, r, ICE, 2, 0.9, 1.0);
    }

    // ③ 168 颗继承粒子沿三层轨道运行
    const mul = t < 10.30 ? 1.6 : 1.0;
    for (const q of c.orb) {
      const ang = rad(q.a0 + q.sp * mul * (t - 10.09));
      f.dot(cx + q.rr * Math.cos(ang), cy + q.rr * Math.sin(ang), 2, ICE, 0.8, 0.5);
    }

    // ④ 主词自中心 scale 0.86→1.0 + 逐字符淡入（14ms），前 4 字主青
    const scl = lerp(0.86, 1.0, easeOutExpo(phase(t, 10.62, 10.96)));
    const W = c.W;
    for (let gi = 0; gi < W.chars.length; gi++) {
      const g = W.chars[gi];
      const t0 = 10.62 + gi * 0.014;
      if (t < t0) continue;
      const p = easeOutCubic(phase(t, t0, t0 + 0.10));
      const xx = cx + (g.x / dpr - cx) * scl;
      const yy = cy + (g.baseline / dpr - cy) * scl;
      const col = g.ci < 4 ? CYAN : ICE;
      f.text(xx, yy, g.ch, W.font, col, p, 0.4 * p, W.stroke);
    }

    // 阶段 4：全系统亮度 -6% 收束 1 拍
    const dim = 1.0 - 0.06 * clamp01(phase(t, 10.96, 11.04));
    if (dim < 0.999) {
      f.rect(0, 0, BASE_W, BASE_H, BLACK, 0, 1, 0, BLACK, (1 - dim) * 0.5);
    }

    corners(f, 'T+10.09s', CHAPTER,
            `seed:${SEEDS.SHOT_016} · rings:7 · 100%`, 'INIT');
    const k = 0.40 + pulse(t, bs, 0.08, 0.06);
    return { bloomR: 10.0, bloomK: k, grain: 4.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_017  `11.10–12.1136` ｜ 7 层环压缩成 62° 透视平面 + 96 节点球面点阵
   ══════════════════════════════════════════════════════════════ */
const SHOT_017 = {
  id: 'SHOT_017', start: 11.10, end: 12.1136,
  seedHex: SEEDS.SHOT_017, chapter: CHAPTER, status: 'WORLD',
  lyric: 'Set up our new world / 建立我们的新世界',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_017 = beatsIn(beats, this.start, this.end);
    const R = 300.0;
    // 96 节点（8 纬 × 12 经）的球面参数
    const nodes = [];
    for (let la = 0; la < 8; la++) {
      const phi = rad((180 * (la + 0.5)) / 8);
      for (let lo = 0; lo < 12; lo++) {
        const th = rad((360 * lo) / 12);
        nodes.push({ la, lo, sp: Math.sin(phi), cp: Math.cos(phi),
                     ct: Math.cos(th), st: Math.sin(th) });
      }
    }
    const seed = SC.seed('SHOT_017');
    const band = [];
    for (let i = 0; i < 168; i++) {
      band.push({ rr: [430, 500, 570][i % 3],
                  ang: new Rng(seed, 'band', i).range(0, Math.PI * 2) });
    }
    const W = new Word(ctx, ['Set up our new', 'world'], 144, {
      weight: 'Inter Semi-Bold', trackEm: 0.03, dpr: 1,
      h: 'left', v: 'baseline_last', anchor: [0.07, 0.89], lineStep: 152,
    });
    this._c = { nodes, band, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = 0.52 * BASE_W, cy = 0.48 * BASE_H;
    const R = 300.0;
    const spin = 4.0 * clamp01(phase(t, 11.80, 12.02)) * (t - 11.80);

    // ① 7 层环压缩 18% 并倾斜至 62° 透视平面
    const comp = easeInCubic(phase(t, 11.10, 11.34));
    const RINGS = [90, 140, 190, 240, 290, 340, 390];
    const COLS = [CYAN, BV, GREY];
    const cos62 = Math.cos(rad(62));
    for (let i = 0; i < RINGS.length; i++) {
      const r = RINGS[i] * lerp(1.0, 0.82, comp);
      const ry = r * lerp(1.0, cos62, comp);
      f.ell(cx, cy, r, ry, COLS[i % 3], 2, 0.5 * (1 - comp * 0.5), 0.4);
    }

    // ② 96 节点球面点阵 + 相邻连线
    const unf = easeInOutCubic(phase(t, 11.34, 11.80));
    const drawn = [];
    for (const n of c.nodes) {
      const th = Math.atan2(n.st, n.ct) + rad(spin);
      const x = cx + R * n.sp * Math.cos(th);
      const y = cy + R * n.cp;
      drawn.push([cx + (x - cx) * unf, cy + (y - cy) * unf]);
    }
    const grow = easeOutCubic(phase(t, 11.40, 11.86));
    for (let la = 0; la < 8; la++) {
      for (let lo = 0; lo < 12; lo++) {
        const i = la * 12 + lo;
        const js = [la * 12 + ((lo + 1) % 12)];
        if (la < 7) js.push((la + 1) * 12 + lo);
        for (const j of js) {
          const p = drawn[i], q = drawn[j];
          f.line(p[0], p[1], p[0] + (q[0] - p[0]) * grow,
                 p[1] + (q[1] - p[1]) * grow, BV, 1.5, 0.40, 0.2);
        }
      }
    }
    for (let i = 0; i < drawn.length; i++) {
      let a = 1.0;
      if (t >= 12.02) {
        const la = Math.trunc(i / 12);
        if (t >= 12.02 + la * 0.03 && t <= 12.06 + la * 0.03) a = 1.4;
      }
      f.dot(drawn[i][0], drawn[i][1], 3, CYAN, Math.min(1.0, a), 0.6);
    }

    // ③ 三轴（easeOutQuint），Z 轴端点 3 帧暖色
    const AX = [[180, 0, ICE, 'X'], [0, -180, CYAN, 'Y'], [-150, 96, GREY, 'Z']];
    for (let i = 0; i < AX.length; i++) {
      const [dx, dy, col] = AX[i];
      const ap = 1 - (1 - phase(t, 11.34 + i * 0.06, 11.62 + i * 0.06)) ** 5;
      f.line(cx, cy, cx + dx * ap, cy + dy * ap, col, 2, 0.85, 0.5);
      f.dot(cx + dx * ap, cy + dy * ap, 3, col, 1, 0.5);
    }
    if (t >= 11.96 && t <= 12.01) f.dot(cx - 150, cy + 96, 5, WARM, 0.9, 1.0);
    const lf = fontOf('JetBrains Mono', 14, dpr);
    for (const [dx, dy, , lab] of AX) {
      f.text(cx + dx + 8, cy + dy - 8, lab, lf.font, GREY, 0.6);
    }

    // ④ 核心 + 平面网格残迹 + 168 粒子三条稀薄环带
    f.dot(cx, cy, 46, ICE, 0.9, 1.0);
    f.ell(cx, 0.62 * BASE_H, 0.42 * BASE_W, 0.06 * BASE_H, GREY, 1, 0.25);
    for (const q of c.band) {
      f.dot(cx + q.rr * Math.cos(q.ang) * (1 - 0.7 * comp),
            cy + q.rr * Math.sin(q.ang) * 0.24, 2, ICE, 0.35, 0.3);
    }

    // ⑤ 主词两行（16ms/字符、y+8px；11.96s world 变主青）
    c.W.draw(f, t, {
      t0: 11.80, stagger: 0.016, dur: 0.12, dy: 8.0, ease: easeOutExpo, glowK: 0.35,
      color: { base: ICE, rules: [{ when: { li: 1 }, color: CYAN }],
               _dynConds: ['t >= 11.96'] },
    });

    corners(f, 'T+11.10s', CHAPTER,
            `seed:${SEEDS.SHOT_017} · nodes:96 · fps:60`, 'WORLD');
    return { bloomR: 8.0, bloomK: 0.37, grain: 4.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_018  `12.1136–12.91` ｜ 5,600 点各向异性塌缩 + 亮带 + 光标
   ══════════════════════════════════════════════════════════════ */
const SHOT_018 = {
  id: 'SHOT_018', start: 12.1136, end: 12.91,
  seedHex: SEEDS.SHOT_018, chapter: CHAPTER, status: 'FREEZE',
  lyric: 'Set up our new world / 建立我们的新世界',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_018 = beatsIn(beats, this.start, this.end);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const seed = SC.seed('SHOT_018');
    const src = [];
    // 球面点云 2,600
    for (let i = 0; i < 2600; i++) {
      const rng = new Rng(seed, 'shell', i);
      const th = rng.range(0, Math.PI * 2);
      const ph = Math.acos(2 * rng.next() - 1);
      src.push([cx + 250 * Math.sin(ph) * Math.cos(th),
                cy + 250 * Math.sin(ph) * Math.sin(th) * 0.9, 0]);
    }
    // 词点 2,400
    const LINES = ['Set up our new', 'world'];
    const tp = textPoints(LINES, 144, 'Inter Semi-Bold', 0.03, 'left',
                          'baseline_last', [0.07, 0.89], 152,
                          { step: 4, n: 2400, dpr: 1 });
    for (const p of tp) src.push([p[0], p[1], p[2]]);
    // 连线离散点 600
    for (let i = 0; i < 600; i++) {
      const rng = new Rng(seed, 'edge', i);
      src.push([rng.range(0.2, 0.8) * BASE_W, rng.range(0.2, 0.8) * BASE_H, 1]);
    }
    // 预计算每点的塌缩抖动，避免每帧重算随机
    const jit = [];
    for (let i = 0; i < src.length; i++) {
      jit.push(new Rng(seed, 'collapse', i).range(-0.03, 0.03) * BASE_H);
    }
    this._c = { src, jit, cx, cy };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const cx = c.cx, cy = c.cy;

    // ② 5,600 点向 y=50% 各向异性塌缩（X 保留 22%、Y 收敛 ±3%H）
    const colP = easeInOutCubic(phase(t, 12.32, 12.66));
    const shrink = easeInCubic(phase(t, 12.66, 12.84));
    const dp = [], al = [];
    for (let i = 0; i < c.src.length; i++) {
      const [x, y] = c.src[i];
      let tx = lerp(x, cx + (x - cx) * 0.22, colP);
      const ty = lerp(y, cy + c.jit[i], colP);
      tx = cx + (tx - cx) * (1 - shrink * 0.88);
      dp.push([tx, ty]);
      let keep = 1.0;
      if (t >= 12.66) keep = (i % 23 === 0) ? 1.0 : lerp(1.0, 0.08, shrink);
      al.push(0.85 * keep);
    }
    f.pts(dp, 2, ICE, 1, 0.6, BG_DEEP, al);

    // ③ 亮带（宽 66%W → 12%W）+ 核心 r=24→6
    const bw = lerp(0.66 * BASE_W, 0.12 * BASE_W, shrink);
    f.line(cx - bw / 2, cy, cx + bw / 2, cy, CYAN, 4, 0.25 * (1 - shrink), 0.8);
    f.dot(cx, cy, lerp(24, 6, clamp01(phase(t, 12.66, 12.84))), CYAN, 1, 1.0);

    // ④ 中心 4×46px 光标 hard cut 亮起
    if (t >= 12.84) {
      const on = Math.trunc((t - 12.84) / 0.5) % 2 === 0;
      if (on) f.rect(cx - 2, cy - 23, cx + 2, cy + 23, CYAN, 1, 1, 0.7, CYAN, 1.0);
    }

    if (t < 12.66) {
      corners(f, 'T+12.11s', CHAPTER,
              `seed:${SEEDS.SHOT_018} · sample:2400pt`, 'FREEZE');
    }
    const k = lerp(0.45, 0.28, clamp01(phase(t, 12.32, 12.91)));
    return { bloomR: 8.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_019  `12.91–13.89` ｜ 冻结亮带熄灭 + 主词逐字上屏 + 光标 + 下划线
   ══════════════════════════════════════════════════════════════ */
const SHOT_019 = {
  id: 'SHOT_019', start: 12.91, end: 13.89,
  seedHex: SEEDS.SHOT_019, chapter: CHAPTER, status: 'HOLD',
  lyric: "And let's begin the / 那么就让我们开始",
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_019 = beatsIn(beats, this.start, this.end);
    const W = new Word(ctx, ["And let's begin the"], 156, {
      weight: 'Inter Semi-Bold', trackEm: 0.02, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.48],
    });
    this._c = { W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_019');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const LEN = 19;

    // ① 冻结亮带 easeInQuad 熄灭；12 枚残点
    const ext = 1.0 - easeInQuad(phase(t, 12.91, 13.06));
    if (ext > 0.02) {
      f.line(cx - 0.06 * BASE_W, cy, cx + 0.06 * BASE_W, cy, CYAN, 4,
             0.25 * ext, 0.6 * ext);
    }
    const dotA = 0.20 * lerp(1.0, 0.0, clamp01(phase(t, 13.46, 13.74)));
    for (let i = 0; i < 12; i++) {
      f.dot(0.10 * BASE_W + i * ((0.80 * BASE_W) / 11), cy, 2, GREY, dotA);
    }

    // ② 主词自左逐字 hard cut + 缩放吸气
    const cw = 4.0, chh = 46.0;
    const nShow = Math.trunc(clamp01((t - 13.06) / (13.46 - 13.06)) * (LEN + 1));
    const scl = lerp(0.985, 1.000, easeInOutSine(phase(t, 13.46, 13.74)));
    const W = c.W;
    for (const g of W.chars) {
      if (g.ci >= nShow) continue;
      const col = (g.ci >= 6 && g.ci <= 10) ? CYAN : ICE;
      const xx = cx + (g.x / dpr - cx) * scl;
      const yy = 0.48 * BASE_H + (g.baseline / dpr - 0.48 * BASE_H) * scl;
      f.text(xx, yy, g.ch, W.font, col, 1, 0.35, W.stroke);
    }
    if (nShow > 0) {
      const tailX = W.x1 + 14;
      f.rect(tailX, 0.48 * BASE_H - chh / 2, tailX + cw, 0.48 * BASE_H + chh / 2,
             CYAN, 1, 1, 0.7, CYAN, 1.0);
    }
    // ③ 下划线自词首扫至词尾外 40px
    const up = easeInQuad(phase(t, 13.46, 13.74));
    if (up > 0) {
      const xs = W.x0;
      const xe = lerp(xs, W.x1 + 40, up);
      f.line(xs, 0.48 * BASE_H + 84, xe, 0.48 * BASE_H + 84, CYAN, 1, 0.8, 0.5);
    }

    corners(f, 'T+12.91s', CHAPTER, `seed:${SEEDS.SHOT_019} · hold:980ms`, 'HOLD');
    return { bloomR: 8.0, bloomK: 0.20 + 0.04 * ringNear(t, bs, 0.1), grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_020  `13.89–15.0716` ｜ 光标爆为 12 行代码 → 9000 点分四组流向四种结构
   ══════════════════════════════════════════════════════════════ */
const SIM_CODE = ['emit world()', 'for i in 0..n', '  spawn node', '  link edge',
                  'draw city()', 'orbit(a,b,c)', 'wave(sin,3)', '  sample(4px)',
                  '  apply seed', 'if ok: run()', '  else: halt', 'return SIM'];

const SHOT_020 = {
  id: 'SHOT_020', start: 13.89, end: 15.0716,
  seedHex: SEEDS.SHOT_020, chapter: CHAPTER, status: 'SIM',
  lyric: 'SIMULATION / 模拟',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_020 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_020');
    const cx = 0.50 * BASE_W;
    // 9000 个代码采样点 + 各自的分组目标
    const pts = textPoints(SIM_CODE, 24, 'JetBrains Mono', 0.0, 'left', 'baseline_first',
                           [0.14, 0.30], 0.03 * BASE_H,
                           { step: 4, n: 9000, dpr: 1 });
    const items = [];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1];
      const g = i % 4;
      let tx, ty;
      if (g === 0) {
        tx = 0.08 * BASE_W + (i % 22) * ((0.84 * BASE_W) / 21);
        ty = 0.74 * BASE_H - (14 + (i % 7) * 7);
      } else if (g === 1) {
        const ang = new Rng(seed, 'grp', i).range(0, Math.PI * 2);
        const r = [160, 240, 300][i % 3];
        tx = cx + r * Math.cos(ang);
        ty = 0.52 * BASE_H + r * 0.32 * Math.sin(ang);
      } else if (g === 2) {
        tx = 0.08 * BASE_W + (i % 64) * ((0.84 * BASE_W) / 63);
        ty = 0.88 * BASE_H - Math.abs(Math.sin(((i % 64) / 63) * Math.PI * 6)) * 40;
      } else {
        const r = new Rng(seed, 'grp', i);
        tx = 0.20 * BASE_W + r.range(0, 0.60 * BASE_W);
        ty = 0.34 * BASE_H + r.range(0, 0.32 * BASE_H);
      }
      items.push([x, y, g, tx, ty]);
    }
    // 城市 / 节点网 / 环境粒子 的随机量预计算
    const city = [], nodes = [], amb = [];
    for (let i = 0; i < 22; i++) {
      const r = new Rng(seed, 'city', i);
      city.push({ w: r.range(12, 48), h: r.range(14, 62) });
    }
    for (let i = 0; i < 60; i++) {
      nodes.push([0.20 * BASE_W + new Rng(seed, 'nd', i).range(0, 0.60 * BASE_W),
                  0.34 * BASE_H + new Rng(seed, 'nd2', i).range(0, 0.32 * BASE_H)]);
    }
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'amb', i);
      amb.push([r.range(0.04, 0.96) * BASE_W, r.range(0.08, 0.94) * BASE_H]);
    }
    const W = new Word(ctx, ['SIMULATION'], 200, {
      weight: 'Inter Bold', trackEm: 0.12, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.24],
    });
    this._c = { items, city, nodes, amb, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_020');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // ① 光标 scaleX 拉伸为 30%W 水平线 → 爆为 12 行代码
    const st = easeOutExpo(phase(t, 13.89, 14.01));
    if (st < 1.0) {
      f.line(cx - 0.15 * BASE_W * st, cy, cx + 0.15 * BASE_W * st, cy, CYAN, 4, 1, 1.0);
    }
    const mf = fontOf('JetBrains Mono', 24, dpr);
    for (let i = 0; i < SIM_CODE.length; i++) {
      const line = SIM_CODE[i];
      const t0 = 14.01 + i * 0.018;
      const p = clamp01(phase(t, t0, t0 + 0.02));
      if (p <= 0) continue;
      f.text(0.14 * BASE_W + i * 14, 0.30 * BASE_H + i * 0.03 * BASE_H,
             line.slice(0, Math.max(1, Math.trunc(line.length * p))), mf.font, CYAN, 0.8);
    }

    // ② 9000 点分四组流向城市/轨道/波形/节点
    const bank = [[], [], [], []];
    for (const [x, y, g, tx, ty] of c.items) {
      const p = easeInOutCubic(phase(t, 14.12 + 0.03 * g, 14.56 + 0.03 * g));
      bank[g].push([lerp(x, tx, p), lerp(y, ty, p)]);
    }
    for (let gi = 0; gi < 4; gi++) {
      const al = bank[gi].map(() => 0.55);
      f.pts(bank[gi], 2, gi !== 2 ? ICE : GREY, 1, 0.4, BG_DEEP, al);
    }

    // ③ 四组结构成形
    const cp = easeOutBack(phase(t, 14.56, 14.94), 1.1);
    for (let i = 0; i < 22; i++) {
      const bx = 0.08 * BASE_W + i * ((0.84 * BASE_W) / 21);
      const h = c.city[i].h * Math.max(0.02, cp);
      f.rect(bx - c.city[i].w / 2, 0.74 * BASE_H - h, bx + c.city[i].w / 2,
             0.74 * BASE_H, BV, 1, 0.6, 0.3);
    }
    const ORB = [[18, 300], [62, 240], [104, 160]];
    for (let k = 0; k < 3; k++) {
      const [degd, ra] = ORB[k];
      const pp = easeOutCubic(phase(t, 14.62 + k * 0.05, 14.94));
      const ep = P.curvePoints('ellipse', 90, rad(degd), [0.5, 0.52],
                               ra / BASE_W, (ra * 0.30) / BASE_H);
      f.pline(ep.slice(0, Math.max(2, Math.trunc(90 * pp))), CYAN, 1.5, 0.8, 0.5,
              BG_DEEP, false);
      const n = 6 + k * 2;
      for (let j = 0; j < n; j++) {
        const ang = rad((360 * j) / n + 40 * (t - 14.56));
        const rx = ra, ry = ra * 0.30;
        const cd = Math.cos(rad(degd)), sd = Math.sin(rad(degd));
        const xx = 0.5 * BASE_W + rx * Math.cos(ang) * cd - ry * Math.sin(ang) * sd;
        const yy = 0.52 * BASE_H + rx * Math.cos(ang) * sd + ry * Math.sin(ang) * cd;
        f.dot(xx, yy, 4, ICE, 0.9, 0.6);
      }
    }
    const gb = clamp01(phase(t, 14.56, 14.94));
    for (let i = 0; i < 64; i++) {
      const h = (4 + 40 * Math.abs(Math.sin((i / 63) * Math.PI * 6 + (t - 14.56) * 3))) * gb;
      const xx = 0.08 * BASE_W + i * ((0.84 * BASE_W) / 63);
      f.line(xx, 0.88 * BASE_H, xx, 0.88 * BASE_H - h,
             i % 8 === 0 ? CYAN : GREY, 2, i % 8 === 0 ? 0.85 : 0.55, 0.4);
    }
    const gp = steps(t, 12, 14.56, 14.94) / 12.0;
    for (let i = 0; i < 90; i++) {
      if (i > 90 * gp) continue;
      const a = i % 60, b = (i * 7 + 3) % 60;
      f.line(c.nodes[a][0], c.nodes[a][1], c.nodes[b][0], c.nodes[b][1], GREY, 1, 0.40);
    }
    f.pts(c.nodes, 3, GREY, 0.8);

    // 300 颗悬浮呼吸粒子
    for (let i = 0; i < 300; i++) {
      const br = 2.0 * Math.sin((2 * Math.PI * (t - 13.89)) / 0.6 + i);
      f.dot(c.amb[i][0] + br, c.amb[i][1] + br * 0.5, 2, ICE, 0.45, 0.3);
    }

    // ④ 主词 SIMULATION 200px（第 3–7 字于 14.62s 变主青）
    c.W.draw(f, t, {
      t0: 14.70, stagger: (15.07 - 14.70 - 0.05) / 10.0, dur: 0.001, dy: 0.0,
      cut: true, glowK: 0.4,
      color: { base: ICE, rules: [{ when: { ciFrom: 2, ciLt: 7 }, color: CYAN }],
               _dynConds: ['t >= 14.62'] },
    });

    corners(f, 'T+13.89s', CHAPTER, `seed:${SEEDS.SHOT_020} · pt:9000`, 'SIM');
    const k = 0.42 + pulse(t, bs, 0.08, 0.08);
    return { bloomR: 8.0, bloomK: Math.min(0.50, k), grain: 5.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_021  `15.0716–16.00` ｜ 1 万点收敛成单行代码 `world.execute(me);`
   ══════════════════════════════════════════════════════════════ */
const CODE_LINE = 'world.execute(me);';

const SHOT_021 = {
  id: 'SHOT_021', start: 15.0716, end: 16.00,
  seedHex: SEEDS.SHOT_021, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Hello world / 你好，世界',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_021 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_021');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // 四组结构（降透明用）
    const city = [], orbitPts = [], bars = [];
    for (let i = 0; i < 22; i++) {
      const r = new Rng(seed, 'city', i);
      city.push({ bx: 0.08 * BASE_W + i * ((0.84 * BASE_W) / 21),
                  w: r.range(6, 24), h: r.range(7, 31) });
    }
    const ORB = [[18, 300], [62, 240], [104, 160]];
    for (const [degd, ra] of ORB) {
      orbitPts.push(P.curvePoints('ellipse', 60, rad(degd), [0.5, 0.52],
                                  ra / BASE_W, (ra * 0.30) / BASE_H));
    }
    for (let i = 0; i < 64; i++) bars.push(0.08 * BASE_W + i * ((0.84 * BASE_W) / 63));

    // SIMULATION 采样 1,100 点
    const pts = textPoints(['SIMULATION'], 200, 'Inter Bold', 0.12, 'center', 'center',
                           [0.50, 0.24], null, { step: 4, n: 1100, dpr: 1 });

    // 单行代码的等宽字形位置（84px）
    const fontLine = fontOf('JetBrains Mono Semi-Bold', 84, 1);
    const widths = [];
    for (const ch of CODE_LINE) widths.push(textWidth(fontLine.font, ch));
    const lw = widths.reduce((a, b) => a + b, 0);
    const x0 = cx - lw / 2;
    const targets = [];
    let acc = 0;
    for (let i = 0; i < CODE_LINE.length; i++) {
      targets.push([x0 + acc, cy]);
      acc += widths[i];
    }

    // 1 万点的收敛目标（预计算）
    const items = [];
    for (let i = 0; i < pts.length; i++) {
      const jx = new Rng(seed, 'cv', i).range(-0.02, 0.02) * BASE_H;
      items.push([pts[i][0], pts[i][1], jx, i % targets.length]);
    }
    const stray = [];
    for (let i = 0; i < 200; i++) {
      const r = new Rng(seed, 'stray', i);
      stray.push([r.range(0.10, 0.90) * BASE_W, r.range(-40, 40)]);
    }
    const Wsim = new Word(ctx, ['SIMULATION'], 200, {
      weight: 'Inter Bold', trackEm: 0.12, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.24],
    });
    this._c = { city, orbitPts, bars, items, targets, lw, x0, stray, Wsim, fontLine };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_021');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // ① 四组结构降透明 60%
    const struct = 0.60 * (1 - clamp01(phase(t, 15.28, 15.66)));
    for (const b of c.city) {
      f.rect(b.bx - b.w, 0.74 * BASE_H - b.h, b.bx + b.w, 0.74 * BASE_H,
             BV, 1, struct * 0.6);
    }
    for (const ep of c.orbitPts) f.pline(ep, CYAN, 1, struct * 0.7);
    for (const xx of c.bars) {
      f.line(xx, 0.88 * BASE_H, xx, 0.88 * BASE_H - 20, GREY, 2, struct * 0.5);
    }
    const sa = 1.0 - clamp01(phase(t, 15.28, 15.34));
    if (sa > 0.02) {
      c.Wsim.drawPlain(f, ICE, { alpha: sa, glowK: 0.4 * sa }, t);
    }

    // ② 1 万点向 y=50% 带收敛 → ③ 按等宽栅格重排为单行代码
    const bandp = easeInOutCubic(phase(t, 15.28, 15.66));
    const regp = easeOutCubic(phase(t, 15.66, 15.90));
    const dp = [], al = [];
    for (const [x, y, jx, ti] of c.items) {
      const tx = lerp(x, cx + (x - cx) * 0.30, bandp);
      const ty = lerp(y, cy + jx, bandp);
      const gt = c.targets[ti];
      dp.push([lerp(tx, gt[0], regp), lerp(ty, gt[1], regp)]);
      al.push(0.55 * (1 - 0.5 * regp));
    }
    f.pts(dp, 2, CYAN, 1, 0.5, BG_DEEP, al);

    // ④ 重组单行代码（execute 冰白）+ 行尾光标
    if (t >= 15.66) {
      const reveal = clamp01(phase(t, 15.66, 15.90));
      const stepsN = Math.trunc(reveal * CODE_LINE.length);
      for (let i = 0; i < CODE_LINE.length; i++) {
        if (i > stepsN) break;
        const col = (i >= 6 && i < 13) ? ICE : CYAN;
        f.text(c.targets[i][0], cy - 42, CODE_LINE[i], c.fontLine.font, col, 0.95, 0.5);
      }
    }
    if (t >= 15.84) {
      const on = Math.trunc((t - 15.84) / 0.4) % 2 === 0;
      if (on) {
        f.rect(c.x0 + c.lw + 12, cy - 23, c.x0 + c.lw + 16, cy + 23,
               CYAN, 1, 1, 0.7, CYAN, 1.0);
      }
    }
    // 200 颗游离粒子沿带外侧 ±40px
    for (const [x, dy] of c.stray) f.dot(x, cy + dy, 2, ICE, 0.30, 0.3);

    // 阶段 4：全画面暗至 -20%
    const dim = clamp01(phase(t, 15.90, 15.93));
    if (dim > 0) {
      f.rect(0, 0, BASE_W, BASE_H, BLACK, 0, 1, 0, BLACK, 0.20 * dim);
    }
    if (t < 15.90) {
      corners(f, 'T+15.07s', CHAPTER,
              `seed:${SEEDS.SHOT_021} · sample:4px · 10100pt`, 'MORPH');
    }
    let k = lerp(0.42, 0.50, easeInOutCubic(phase(t, 15.28, 15.66)));
    k = lerp(k, 0.34, clamp01(phase(t, 15.70, 15.95)));
    const scn = 0.06 * (1 - clamp01(phase(t, 15.90, 15.95)));
    return { bloomR: 8.0, bloomK: k + pulse(t, bs, 0.06, 0.06), grain: 5.0, scan: scn };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_001  `16.00–18.40` ｜ 复制种子：代码行 4/16/64 级递归复制 + 字缘粒子化
   ══════════════════════════════════════════════════════════════ */
/** 确定性代码场文本（对应 Python 的 _field_rows） */
const FIELD_LINES = [
  'world.execute(me);', 'if (world.run()) {', '  load(world.seed);',
  '  while (me.alive) {', '    execute(self);', '  }', '}',
  'return world;',
];

function fieldRows(nrows, cols, seedHex) {
  const out = [];
  for (let i = 0; i < nrows; i++) {
    let s = '', k = 0;
    while (s.length < cols) {
      s += FIELD_LINES[(i + k) % FIELD_LINES.length];
      k++;
      if (k % 2 === 0) s += ' ';
    }
    out.push(s.slice(0, cols));
  }
  return out;
}

/** 带两位行号的代码行（对应 Python 的 _row_text） */
function rowText(i, cols) {
  const s = `${String(i).padStart(2, '0')} world.execute(me); #0000001B`;
  return s.repeat(4).slice(0, cols);
}

/** 镜头 001 的推镜曲线（对应 Python 的 _cam_001） */
function cam001(t) {
  let c = 1.00;
  c = lerp(c, 1.03, easeInOutCubic(phase(t, 16.35, 16.55)));
  c = lerp(c, 1.07, easeInOutCubic(phase(t, 16.55, 17.40)));
  c = lerp(c, 1.12, easeInCubic(phase(t, 17.40, 18.40)));
  return Math.round(c * 1000) / 1000;
}

const SHOT_001 = {
  id: 'SHOT_001', start: 16.00, end: 18.40,
  seedHex: SEEDS.SHOT_001, chapter: CHAPTER, status: 'REPL',
  lyric: 'world.execute(me); — replication seed',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_001 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_001');
    // 字缘粒子采样（1800 代码场点 + 1800 主词点），抖动预计算
    const cols4 = 58;                       // cam 变化时列数会变，粒子用固定近似
    const rows = fieldRows(6, cols4, SEEDS.SHOT_001);
    const pts = textPoints(rows, 16, 'JetBrains Mono', 0.0, 'left', 'baseline_first',
                           [0.28, 0.14], 160, { step: 4, n: 1800, dpr: 1 });
    const pts2 = textPoints(['world.execute(me);'], 160, 'JetBrains Mono Semi-Bold',
                            0.0, 'center', 'center', [0.50, 0.50], null,
                            { step: 4, n: 1800, dpr: 1 });
    const all = pts.concat(pts2);
    const jit = [];
    for (let i = 0; i < all.length; i++) {
      const r = new Rng(seed, 'edge', i);
      const ang = r.range(0, Math.PI * 2);
      jit.push([Math.cos(ang) * 10, Math.sin(ang) * 10]);
    }
    this._c = { all, jit };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_001');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    f.rect(0, 0, BASE_W, BASE_H, BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    const cam = cam001(t);
    const advMain = 0.6 * 160 * cam;
    const x0m = cx - 9 * advMain;
    const band = (0.44 * BASE_W) / (0.6 * 16 * cam);
    const cols = { 2: 32, 3: 58, 4: Math.trunc(band) };

    // ① 主词行 + 行首索引方点（16.35s 后转为光点）
    const mf = fontOf('JetBrains Mono Semi-Bold', Math.trunc(160 * cam), dpr);
    const word = 'world.execute(me);';
    if (t < 16.35) {
      const blink = Math.trunc((t - 16.00) / 0.09) % 2 === 0;
      if (blink) {
        f.rect(x0m + 18 * advMain, cy - 30, x0m + 18 * advMain + 4, cy + 16,
               GREY, 1, 1, 0, GREY, 1.0);
      }
    } else {
      f.dot(x0m - 8, cy - 8, 4, CYAN, 1, 0.8);
    }
    // 主词衬底横带（40% 不透明）
    f.rect(0, cy - 46, BASE_W, cy + 30, BG_DEEP, 0, 1, 0, BG_DEEP, 0.40);
    for (let i = 0; i < word.length; i++) {
      const col = (i >= 6 && i < 13) ? ICE : CYAN;
      f.text(x0m + i * advMain, cy - 42, word[i], mf.font, col, 0.95, 0.5);
    }
    // ② 纵向执行带（execute 所在 8 列）
    const b0 = x0m + 6 * advMain, b1 = x0m + 13 * advMain;
    const bp = easeInQuad(phase(t, 17.80, 18.10));
    if (bp > 0) {
      const yt = lerp(0.01 * BASE_H, 0.99 * BASE_H, bp);
      f.rect(b0, 0.01 * BASE_H, b1, yt, CYAN, 0, 1, 0, CYAN, 0.18);
    }

    // ③ 复制（第 2 级 4 行 / 第 3 级 16 行 / 第 4 级 64 行）
    const LEVELS = [[2, 4, 44, 16.35, 0.09], [3, 16, 24, 16.55, 0.028],
                    [4, 64, 16, 17.40, 0.009]];
    for (const [lvl, n, px, t0, stg] of LEVELS) {
      const lf = fontOf('JetBrains Mono', Math.trunc(px * cam), dpr);
      const lh = px * cam;
      for (let i = 0; i < n; i++) {
        if (t < t0 + i * stg) continue;
        const y = cy - ((n - 1) / 2) * lh + i * lh;
        const txt = rowText(i, cols[lvl]);
        f.text(x0m - 3 * 0.6 * px * cam, y, txt.slice(0, 2), lf.font, GREY, 0.45);
        if (lvl === 4 && t >= 17.40 + i * stg) {
          // 索引逐行点亮 + world 列转主青
          const segA = clamp01((t - (t0 + i * stg)) / 0.06);
          f.text(x0m, y, txt.slice(3), lf.font, mix(GREY, BG_DEEP, 0.55), 0.55);
          f.text(x0m, y, 'world', lf.font, CYAN, 0.75 * segA);
        } else {
          f.text(x0m, y, txt.slice(3), lf.font, GREY, 0.55);
        }
      }
    }

    // ④ glyph-to-particle（18.10–18.40，字缘外飘 10px）
    const pp = easeOutQuad(phase(t, 18.10, 18.40));
    if (pp > 0.01) {
      const dp = [], al = [];
      for (let i = 0; i < c.all.length; i++) {
        dp.push([c.all[i][0] + c.jit[i][0] * pp, c.all[i][1] + c.jit[i][1] * pp]);
        al.push(0.85 * (1 - 0.3 * pp));
      }
      f.pts(dp, 2, ICE, 1, 0.5, BG_DEEP, al);
    }

    corners(f, 'T+16.00s', CHAPTER,
            `seed:${SEEDS.SHOT_001} · rows:64 · rep:4/16/64`, 'REPL');
    return { bloomR: 8.0, bloomK: 0.34 + 0.08 * pulse(t, bs, 0.06, 1.0),
             grain: 5.0, scan: 0.07 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_002  `18.40–21.60` ｜ 48×148 代码场 + 扫描线 + 锁定 token + 电路路径
   ══════════════════════════════════════════════════════════════ */
const SHOT_002 = {
  id: 'SHOT_002', start: 18.40, end: 21.60,
  seedHex: SEEDS.SHOT_002, chapter: CHAPTER, status: 'SCAN',
  lyric: 'world.execute(me); — scan',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_002 = beatsIn(beats, this.start, this.end);
    const NROWS = 48, NCOLS = 148;
    const rows = fieldRows(NROWS, NCOLS, SEEDS.SHOT_002);
    // 锁定 token：world 行8列10 / execute 行24列60 / me 行40列120
    const locks = [[8, 10, 'world'], [24, 60, 'execute'], [40, 120, 'me']];
    for (const [r, c, tok] of locks) {
      const s = rows[r];
      rows[r] = s.slice(0, c) + tok + s.slice(c + tok.length);
    }
    const W = new Word(ctx, ['world.execute(me);'], 144, {
      weight: 'JetBrains Mono Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.13],
    });
    this._c = { rows, locks, W, NROWS, NCOLS };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const bs = SC.beats('SHOT_002');
    f.rect(0, 0, BASE_W, BASE_H, BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    const PX = 18, LH = 16;
    const x0 = 0.06 * BASE_W, y0 = 0.26 * BASE_H;
    const mf = fontOf('JetBrains Mono', PX, dpr);
    const adv = 0.6 * PX;

    // ① 相机拉远重采样；② 扫描线自 y=26% 扫至 97%
    const spread = easeOutExpo(phase(t, 18.40, 19.05));
    const scanY = lerp(y0, 0.97 * BASE_H, clamp01(phase(t, 19.05, 20.40)));
    const scanned = scanY > y0;
    for (let i = 0; i < c.NROWS; i++) {
      if (t < 18.40) continue;
      const y = y0 + i * LH;
      const yy = lerp(0.0 * BASE_H + i * LH * 1.6, y, spread);
      const rowAge = t - (19.05 + ((y - y0) / (0.97 * BASE_H - y0)) * 1.35);
      let base = GREY;
      if (scanned && rowAge >= 0 && rowAge <= 0.46) {
        base = mix(ICE, BG_ALT, Math.max(0.0, 1.0 - Math.max(0.0, rowAge - 0.06) / 0.40));
      }
      f.text(x0, yy, c.rows[i], mf.font, base, scanned ? 0.5 : 0.55);
    }
    // 扫描线 2px + 12px 拖尾
    if (scanned) {
      const w = c.NCOLS * adv;
      f.rect(x0, scanY, x0 + w, scanY + 2, CYAN, 0, 1, 0, CYAN, 0.9);
      f.rect(x0, scanY - 12, x0 + w, scanY, CYAN, 0, 1, 0, CYAN, 0.25);
    }
    // ③ 三处锁定 token（被扫过即常亮 + 外框）
    const tokPos = [];
    for (const [r, cc, tok] of c.locks) {
      const ty = y0 + r * LH;
      const tx = x0 + cc * adv;
      const tlock = 19.05 + ((ty - y0) / (0.97 * BASE_H - y0)) * 1.35;
      tokPos.push([tx + (tok.length * adv) / 2, ty + LH / 2]);
      if (t >= tlock) {
        f.text(tx, ty, tok, mf.font, CYAN, 0.95, 0.7);
        const bxp = easeOutQuad(phase(t, tlock, tlock + 0.12));
        if (bxp > 0) {
          f.rect(tx - 3 * bxp, ty - 3 * bxp, tx + tok.length * adv + 3 * bxp,
                 ty + LH + 2 + 3 * bxp, CYAN, 1, 0.8);
        }
      }
    }
    // ④ 5 段直角电路路径 + 拐点空心方块
    const segs = [
      [tokPos[0], [tokPos[0][0], tokPos[1][1]]],
      [[tokPos[0][0], tokPos[1][1]], tokPos[1]],
      [tokPos[1], [tokPos[1][0], tokPos[2][1]]],
      [[tokPos[1][0], tokPos[2][1]], tokPos[2]],
      [tokPos[2], [tokPos[2][0] + 60, tokPos[2][1]]],
    ];
    for (let k = 0; k < segs.length; k++) {
      const [p, q] = segs[k];
      const pr = easeInOutQuad(phase(t, 20.40 + k * 0.13, 20.40 + k * 0.13 + 0.13));
      if (pr <= 0) continue;
      f.line(p[0], p[1], lerp(p[0], q[0], pr), lerp(p[1], q[1], pr), ICE, 1.5, 0.9, 0.5);
      if (pr >= 1.0) f.rect(q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5, CYAN, 1, 0.8);
    }
    // ⑤ 主词（逐字符上屏，第 7–13 字主青）
    f.rect(0, 0.13 * BASE_H - 46, BASE_W, 0.13 * BASE_H + 30, BG_DEEP, 0, 1, 0, BG_DEEP, 0.40);
    c.W.draw(f, t, {
      t0: 21.05, stagger: 0.040, dur: 0.001, dy: 0.0, cut: true, glowK: 0.4,
      color: { base: ICE, rules: [{ when: { ciFrom: 6, ciLt: 13 }, color: CYAN }] },
    });

    corners(f, 'T+18.40s', CHAPTER,
            `seed:${SEEDS.SHOT_002} · cells:48×148`, 'SCAN');
    return { bloomR: 8.0, bloomK: 0.36 + 0.12 * pulse(t, bs, 0.07, 1.0),
             grain: 5.0, scan: 0.08 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_003  `21.60–24.80` ｜ 11,000 点自代码场收敛成点球 + 经纬高亮带 + 壳层
   ══════════════════════════════════════════════════════════════ */
const SHOT_003 = {
  id: 'SHOT_003', start: 21.60, end: 24.80,
  seedHex: SEEDS.SHOT_003, chapter: CHAPTER, status: 'ATTR',
  lyric: 'world.execute(me); — attribute sphere',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_003 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_003');
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const N = 11000;

    // 目标：单位球方向 + 半径抖动
    const tgt = [], rjit = [];
    for (let i = 0; i < N; i++) {
      const r = new Rng(seed, 'sph', i);
      const th = r.range(0, Math.PI * 2);
      const ph = Math.acos(2 * r.next() - 1);
      tgt.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
    }
    // 源：代码场 48×148 网格 + 主词轮廓 250 点
    const src = [];
    for (let i = 0; i < 48; i++) {
      for (let j = 0; j < 148; j++) {
        src.push([0.06 * BASE_W + j * 0.6 * 18, 0.26 * BASE_H + i * 16]);
      }
    }
    src.length = Math.min(src.length, N - 250);
    const tp = textPoints(['world.execute(me);'], 144, 'JetBrains Mono Semi-Bold',
                          0.0, 'center', 'center', [0.50, 0.13], null,
                          { step: 4, n: 250, dpr: 1 });
    for (const p of tp) src.push([p[0], p[1]]);
    while (src.length < N) src.push([cx, cy]);

    // 每点的随机量预计算
    const info = [];
    for (let i = 0; i < N; i++) {
      const ri = new Rng(seed, 'grp', i);
      const dist = Math.hypot(src[i][0] - cx, src[i][1] - cy) / Math.hypot(BASE_W, BASE_H);
      info.push({ dist, rj: ri.next() });
    }
    const W = new Word(ctx, ['world.execute(me);'], 144, {
      weight: 'JetBrains Mono Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.13],
    });
    // 三层壳层（各 400 点）
    const shells = [];
    for (let k = 0; k < 3; k++) {
      const arr = [];
      for (let i = 0; i < 400; i++) {
        const r = new Rng(seed, `shell${k}`, i);
        const th = r.range(0, Math.PI * 2);
        const ph = Math.acos(2 * r.next() - 1);
        arr.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
      }
      shells.push(arr);
    }
    this._c = { tgt, src, info, W, shells, N };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    f.rect(0, 0, BASE_W, BASE_H, BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const mf = fontOf('JetBrains Mono', 16, dpr);
    const N = c.N;

    const conv = easeInOutCubic(phase(t, 23.30, 24.30));
    const rad2 = lerp(300.0, 250.0, conv);
    const spin = rad(6.0 * Math.max(0.0, t - 23.30));
    const keepP = clamp01(phase(t, 24.30, 24.80));

    // 主词余影驻留至 24.80
    if (t < 24.80) {
      c.W.drawPlain(f, ICE, { alpha: 0.40, glowK: 0.2 }, t);
    }

    // 11,000 点：源 → 球面
    const bank = [[], [], []];
    const ca = Math.cos(spin), sa = Math.sin(spin);
    for (let i = 0; i < N; i++) {
      const [x0, y0] = c.src[i];
      const [ux, uy, uz] = c.tgt[i];
      const dist = c.info[i].dist;
      const st = 22.16 + dist * 0.70;
      const p = easeInOutCubic(clamp01((t - st) / Math.max(0.02, 23.30 - st)));
      const rr = rad2 * (0.9 + 0.2 * c.info[i].rj);
      const tx = cx + (ux * ca - uz * sa) * rr;
      const ty = cy + uy * rr;
      let keep = 1.0;
      if (t >= 24.30) keep = (i % 10 < 4) ? 1.0 : lerp(1.0, 0.35, keepP);
      const q = i % 20;
      const gi = q < 14 ? 0 : (q < 19 ? 1 : 2);
      bank[gi].push([lerp(x0, tx, p), lerp(y0, ty, p), 0.85 * keep]);
    }
    const COLS = [ICE, CYAN, BV];
    for (let gi = 0; gi < 3; gi++) {
      f.pts(bank[gi].map((z) => [z[0], z[1]]), 2, COLS[gi], 1, 0.5, BG_ALT,
            bank[gi].map((z) => z[2]));
    }

    // 8 条经纬高亮带
    const bandA = 0.25 * clamp01((t - 23.30) / 1.0);
    for (let k = 0; k < 8; k++) {
      const tilt = rad(k * 22.5);
      const pts = [];
      for (let j = 0; j < 60; j++) {
        const a = rad(j * 6 + spin * 57.3);
        const x = Math.sin(a), y = Math.cos(a), z = 0.0;
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        pts.push([cx + x * rad2 * 1.02, cy + y2 * rad2 * 1.02]);
      }
      f.pline(pts, CYAN, 3, bandA, 0.2);
    }

    // 3 层壳层
    if (t >= 24.30) {
      const SH = [[270, 9.0], [250, -5.0], [230, 2.0]];
      for (let k = 0; k < 3; k++) {
        const [rr, w] = SH[k];
        const a = rad(w * (t - 24.30));
        const cs = Math.cos(a), sn = Math.sin(a);
        for (const [x, yy, z] of c.shells[k]) {
          const x2 = x * cs - z * sn;
          const z2 = x * sn + z * cs;
          f.dot(cx + x2 * rr, cy + yy * rr, 2, ICE, 0.6, 0.4);
        }
      }
    }
    // 6 个暖色缺口节点
    for (let k = 0; k < 6; k++) {
      if (t >= 24.55 + k * 0.02) {
        const a = (k * Math.PI * 2) / 6 + spin;
        f.ell(cx + rad2 * Math.cos(a), cy + rad2 * 0.5 * Math.sin(a), 4, 4,
              WARM, 2, 0.9, 1.0);
      }
    }

    corners(f, 'T+21.60s', CHAPTER,
            `seed:${SEEDS.SHOT_003} · pt:11000 · r:250`, 'ATTR');
    const k2 = 0.42 + 0.13 * easeInOutCubic(phase(t, 22.16, 23.30));
    return { bloomR: 9.0, bloomK: k2, grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_004  `24.80–27.20` ｜ 球壳点云 + 四轨椭圆 + 22 城市 + 64 波形条
   ══════════════════════════════════════════════════════════════ */
const SHOT_004 = {
  id: 'SHOT_004', start: 24.80, end: 27.20,
  seedHex: SEEDS.SHOT_004, chapter: CHAPTER, status: 'WORLD',
  lyric: 'world.execute(me); — assemble',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_004 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_004');
    // 球壳 9000 点的球面参数（每帧只做三角）
    const shell = [];
    for (let i = 0; i < 9000; i++) {
      const r = new Rng(seed, 'shell', i);
      const th = r.range(0, Math.PI * 2);
      const ph = Math.acos(2 * r.next() - 1);
      shell.push([Math.sin(ph), Math.cos(ph), th]);
    }
    const city = [];
    for (let i = 0; i < 22; i++) {
      const r = new Rng(seed, 'city', i);
      city.push({ w: r.range(8, 26), h: r.range(10, 46) });
    }
    const orbits = [];
    for (const [ra, deg] of [[90, 22], [130, 58], [170, 96], [210, 134]]) {
      orbits.push({ ra, pts: P.curvePoints('ellipse', 72, rad(deg), [0.5, 0.56],
                                           ra / BASE_W, (ra * 0.34) / BASE_H) });
    }
    const W = new Word(ctx, ['world.execute(me);'], 144, {
      weight: 'JetBrains Mono Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.13],
    });
    this._c = { shell, city, orbits, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    f.rect(0, 0, BASE_W, BASE_H, BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    const cx = 0.50 * BASE_W, cy = 0.56 * BASE_H;
    const R = 250.0;

    // 球壳点云（透明度按阶段变化）
    let shellA = 0.65;
    if (t < 25.30) shellA = lerp(0.65, 0.45, clamp01(phase(t, 24.80, 25.30)));
    else if (t < 26.24) shellA = lerp(0.45, 0.65, clamp01(phase(t, 26.24, 26.94)));
    const spin = 0.10 * (t - 24.80);
    const sp = [];
    for (const [sph, cph, th0] of c.shell) {
      const th = th0 + spin;
      sp.push([cx + R * sph * Math.cos(th), cy + R * cph]);
    }
    f.pts(sp, 2, ICE, 1, 0, BG_ALT, sp.map(() => shellA * 0.6));

    // 6 个暖色缺口节点 + 引线锚点
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI * 2) / 6;
      const ax = cx + R * Math.cos(a), ay = cy + R * 0.5 * Math.sin(a);
      f.ell(ax, ay, 4, 4, WARM, 2, 0.9, 1.0);
      const lp = easeOutBack(phase(t, 24.80 + k * 0.03, 25.30 + k * 0.03), 1.6);
      if (lp > 0) {
        f.line(ax, ay, cx + (ax - cx) * (1 - lp), cy + (ay - cy) * (1 - lp), WARM, 1, 0.5);
      }
    }
    // 三轴
    const AX = [[150, 96, ICE, 'X'], [0, -170, CYAN, 'Y'], [-140, 80, GREY, 'Z']];
    const lf = fontOf('JetBrains Mono', 14, dpr);
    for (let i = 0; i < AX.length; i++) {
      const [dx, dy, col, lab] = AX[i];
      const ap = 1 - (1 - clamp01(phase(t, 24.80 + i * 0.05, 25.30 + i * 0.05))) ** 5;
      f.line(cx, cy, cx + dx * ap, cy + dy * ap, col, 2, 0.85, 0.5);
      f.dot(cx + dx * ap, cy + dy * ap, 4, col, 1, 0.6);
      f.text(cx + dx * ap + 6, cy + dy * ap - 6, lab, lf.font, GREY, 0.6);
    }
    // 4 条椭圆轨道 + 8 枚冰白节点
    for (let k = 0; k < c.orbits.length; k++) {
      const { pts } = c.orbits[k];
      const gp = clamp01(phase(t, 25.30 + k * 0.06, 25.90 + k * 0.06));
      const n = Math.max(2, Math.trunc(72 * gp));
      f.pline(pts.slice(0, n), CYAN, 1.5, 0.85, 0.5);
      for (let j = 0; j < 2; j++) {
        const ang = j * Math.PI + rad(40 * k) * (t - 25.30);
        // 索引必须钳制在 [0, 71]：`ang % 2π` 在 ang 为负时结果仍为负，
        // 会取到 undefined（本项目真实踩过）
        const frac = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.min(71, Math.max(0, Math.trunc((frac / (Math.PI * 2)) * 71)));
        f.dot(pts[idx][0], pts[idx][1], 5, ICE, 0.95, 0.7);
      }
    }
    // 22 座城市（沿 y=+70px 弦线）
    const fade1 = 0.6 * (1 - 0.3 * clamp01(phase(t, 27.05, 27.20)));
    for (let i = 0; i < 22; i++) {
      const gp = easeOutBack(phase(t, 25.60 + i * 0.01, 26.10 + i * 0.01), 1.3);
      const h = c.city[i].h * Math.max(0.0, gp);
      const xx = cx - 170 + i * (340 / 21) + 6 * Math.sin((2 * Math.PI * (t - 24.80)) / 2.4);
      f.rect(xx - c.city[i].w / 2, cy + 70 - h, xx + c.city[i].w / 2, cy + 70, BV, 1, fade1);
    }
    // 64 根波形条（y=-80px 弦线）
    const fade2 = 0.8 * (1 - 0.3 * clamp01(phase(t, 27.05, 27.20)));
    for (let i = 0; i < 64; i++) {
      const gp = clamp01(phase(t, 25.80 + i * 0.004, 26.24));
      const h = (4 + 34 * Math.abs(Math.sin((i / 63) * Math.PI * 6 + (t - 24.80) * 3))) * gp;
      const xx = cx - 170 + i * (340 / 63);
      f.line(xx, cy - 80, xx, cy - 80 - h, i % 8 === 0 ? CYAN : GREY, 2, fade2, 0.4);
    }
    // 3 个同心环
    if (t >= 26.00) {
      const RINGS2 = [[120, 0.08], [160, -0.05], [200, 0.03]];
      for (const [rr, w] of RINGS2) {
        const a = w * (t - 26.00);
        f.ell(cx, cy, rr, rr * 0.92, GREY, 2, 0.7);
        f.dot(cx + rr * Math.cos(a), cy + rr * 0.92 * Math.sin(a), 3, GREY, 1, 0.4);
      }
    }
    // 主词（余影恢复）
    f.rect(0, 0.13 * BASE_H - 46, BASE_W, 0.13 * BASE_H + 30, BG_DEEP, 0, 1, 0, BG_DEEP, 0.40);
    const aW = clamp01(phase(t, 24.80, 25.00));
    c.W.drawPlain(f, { base: CYAN, rules: [{ when: { ciFrom: 6, ciLt: 13 }, color: ICE }] },
                  { alpha: aW, glowK: 0.4 * aW }, t);
    // 阶段 4：整体吸入
    if (t >= 26.94) {
      const gp = easeInQuad(phase(t, 26.94, 27.20));
      f.ell(cx, cy, R * gp, R * gp, ICE, 1, 0.25 * (1 - gp));
    }

    corners(f, 'T+24.80s', CHAPTER,
            `seed:${SEEDS.SHOT_004} · inst:22+64+4`, 'WORLD');
    return { bloomR: 9.0, bloomK: 0.40, grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_005  `27.20–29.71` ｜ 四层折叠至 2px 点 + 压至纯黑场
   ══════════════════════════════════════════════════════════════ */
const SHOT_005 = {
  id: 'SHOT_005', start: 27.20, end: 29.71,
  seedHex: SEEDS.SHOT_005, chapter: CHAPTER, status: 'SILENCE',
  lyric: 'world.execute(me); — collapse',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_005 = beatsIn(beats, this.start, this.end);
    const seed = SC.seed('SHOT_005');
    const city = [];
    for (let i = 0; i < 22; i++) {
      const r = new Rng(seed, 'city', i);
      city.push({ w: r.range(8, 26), h: r.range(10, 46) });
    }
    // 球壳 8,900 点的球面参数
    const shell = [];
    for (let i = 0; i < 8900; i++) {
      const r = new Rng(seed, 'shell', i);
      const th = r.range(0, Math.PI * 2);
      const ph = Math.acos(2 * r.next() - 1);
      shell.push([Math.sin(ph), Math.cos(ph), th]);
    }
    const orbits = [];
    for (const [ra, deg] of [[90, 22], [130, 58], [170, 96], [210, 134]]) {
      orbits.push(P.curvePoints('ellipse', 48, rad(deg), [0.5, 0.5],
                                ra / BASE_W, (ra * 0.34) / BASE_H));
    }
    const W = new Word(ctx, ['world.execute(me);'], 144, {
      weight: 'JetBrains Mono Semi-Bold', trackEm: 0.0, dpr: 1,
      h: 'center', v: 'center', anchor: [0.50, 0.13],
    });
    this._c = { city, shell, orbits, W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    f.rect(0, 0, BASE_W, BASE_H, BG_ALT, 0, 1, 0, BG_ALT, 1.0);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // 折叠半径 r=250→160→90→24→2（四层，各级缓动不同）
    const r1 = lerp(250.0, 160.0, easeInCubic(phase(t, 27.20, 27.70)));
    const r2 = lerp(r1, 90.0, easeInQuart(phase(t, 27.70, 28.30)));
    const r3 = lerp(r2, 24.0, easeInCubic(phase(t, 28.30, 29.05)));
    const R = lerp(r3, 2.0, easeInExpo(phase(t, 29.05, 29.71)));
    const rl = R / 250.0;

    // 颜色收敛：0.4s 内混色至冰白 90%
    const cmixV = clamp01(phase(t, 27.20, 27.60)) * 0.9;
    const colA = (col) => mix(col, ICE, cmixV);

    // ① L1 城市 / 波形 / 同心环
    if (t < 28.30) {
      for (let i = 0; i < 22; i++) {
        const xx = cx - 170 + i * (340 / 21);
        f.rect(xx - c.city[i].w / 2, cy + 70 * rl - c.city[i].h * rl,
               xx + c.city[i].w / 2, cy + 70 * rl, colA(BV), 1, 0.55);
      }
      for (let i = 0; i < 64; i++) {
        const h = 4 + 34 * Math.abs(Math.sin((i / 63) * Math.PI * 6 + (t - 24.80) * 3));
        const xx = cx - 170 + i * (340 / 63);
        f.line(xx, cy - 80 * rl, xx, cy - (80 + h) * rl,
               colA(i % 8 === 0 ? CYAN : GREY), 2, 0.6);
      }
      for (const rr of [120, 160, 200]) {
        f.ell(cx, cy, rr * rl, rr * rl * 0.92, colA(GREY), 2, 0.6);
      }
    }
    // ② L2 坐标轴 / 轨道 / 节点
    if (t >= 27.20 && t < 29.05) {
      for (const [dx, dy, col] of [[150, 96, ICE], [0, -170, CYAN], [-140, 80, GREY]]) {
        f.line(cx, cy, cx + dx * rl, cy + dy * rl, colA(col), 2, 0.7);
      }
      for (const pts of c.orbits) f.pline(pts, colA(CYAN), 1.5, 0.55);
      for (let j = 0; j < 8; j++) {
        const ang = (j * Math.PI * 2) / 8 + 0.2 * (t - 27.20);
        const rr = 170 * rl;
        f.dot(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), 3, colA(ICE), 0.7);
      }
    }
    // ③ L3 球壳点云（8,900 → 4,500 → 640）
    if (t >= 28.30) {
      const n3 = Math.trunc(lerp(640, 4500, 1 - clamp01(phase(t, 28.30, 29.05))));
      const step = Math.max(1, Math.trunc(8900 / Math.max(1, n3)));
      const sp = [];
      for (let i = 0; i < 8900 && sp.length < n3; i += step) {
        const [sph, cph, th0] = c.shell[i];
        const th = th0 + 0.05 * (t - 28.30);
        sp.push([cx + R * sph * Math.cos(th), cy + R * cph]);
      }
      f.pts(sp, 2, colA(ICE), 0.55);
    }
    // ④ 主词余影
    const fa = 1.0 - clamp01(phase(t, 27.44, 27.60));
    if (fa > 0.02) {
      c.W.drawPlain(f, { base: CYAN, rules: [{ when: { ciFrom: 6, ciLt: 13 }, color: ICE }] },
                    { alpha: fa, glowK: 0.4 * fa }, t);
    }
    // ⑤ 终点：2px 冰白点 + r=10 余辉环
    if (t >= 29.50) {
      f.ell(cx, cy, 10, 10, ICE, 1, 0.08);
      f.dot(cx, cy, 2, ICE, 1, 1.0);
    }
    // 背景压至纯黑场（29.05→29.50）
    const blk = clamp01(phase(t, 29.05, 29.50));
    if (blk > 0) f.rect(0, 0, BASE_W, BASE_H, BLACK, 0, 1, 0, BLACK, blk);
    if (t < 28.70) {
      corners(f, 'T+27.20s', CHAPTER,
              `seed:${SEEDS.SHOT_005} · collapse:4/4`, 'SILENCE');
    }
    let k = 0.40 + 0.22 * easeInOutCubic(phase(t, 28.30, 29.05));
    k = lerp(k, 0.22, clamp01(phase(t, 29.20, 29.50)));
    return { bloomR: 9.0, bloomK: k,
             grain: lerp(5.0, 0.0, clamp01(phase(t, 28.70, 29.50))),
             scan: 0.05 * (1 - clamp01(phase(t, 28.70, 29.05))) };
  },
};

export const CH01_SHOTS = [SHOT_007, SHOT_008, SHOT_009, SHOT_010, SHOT_011,
                           SHOT_012, SHOT_013, SHOT_014, SHOT_015, SHOT_016,
                           SHOT_017, SHOT_018, SHOT_019, SHOT_020, SHOT_021,
                           SHOT_001, SHOT_002, SHOT_003, SHOT_004, SHOT_005];
export { SC as CH01_SC };
