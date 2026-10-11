/**
 * ch02.js — 第 02 章 GEOMETRY / DIMENSION（镜头 022–056）
 *
 * 自 Python 版 render/scenes/ch02_geometry.py 移植（35 个画镜函数，约 2,111 行）。
 * 全部为纯函数：同一 (镜头, t) 必须画出完全相同的画面；不使用任何跨帧状态。
 * 时间轴逐位取自 02_TIMELINE.json，seed 逐位取自 SEED_MIGRATION_MAP.csv（06 §5.2 BL 槽）。
 * 颜色只取 06 §2 登记色；字体只走 kit 的 fontOf / Word；随机只走 core 的 Rng。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV, MOODPURPLE as MOOD,
  WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, css, mix,
  linear, easeInQuad, easeOutQuad, easeOutCubic, easeInOutCubic, easeOutExpo,
  easeInOutSine,
} from './core.js';
import {
  Frame, Word, fontOf, beatsIn, limitN,
  easeOutQuart, easeInCubic, easeInExpo, easeInOutQuad,
  easeOutQuint,
} from './kit.js';

const CHAPTER = 'ch02/12';

/* ── 06 §5.2 BL 槽登记 seed（与 SEED_MIGRATION_MAP.csv 逐位一致）────── */
const SEEDS = {
  SHOT_022: '0000022A', SHOT_023: '0000023B', SHOT_024: '0000024C', SHOT_025: '0000025D',
  SHOT_026: '0000026E', SHOT_027: '0000027F', SHOT_028: '0000028A', SHOT_029: '0000029B',
  SHOT_030: '0000030C', SHOT_031: '0000031D', SHOT_032: '0000032E', SHOT_033: '0000033F',
  SHOT_034: 'DF257CDB', SHOT_035: '09D4F043', SHOT_036: 'DEFEEEE1', SHOT_037: '40CB8840',
  SHOT_038: '6DCC21A2', SHOT_039: '27F1D60E', SHOT_040: 'BC945794', SHOT_041: '6EAE140F',
  SHOT_042: '19B33AB2', SHOT_043: 'A10BED0B', SHOT_044: '69CA258D', SHOT_045: '7A2C6A41',
  SHOT_046: '0000046A', SHOT_047: '0000047B', SHOT_048: '0000048C', SHOT_049: '0000049D',
  SHOT_050: '0000050E', SHOT_051: '0000051F', SHOT_052: '7C4E34D5', SHOT_053: '2C00AE21',
  SHOT_054: 'D9DFAF30', SHOT_055: '66D6535B', SHOT_056: '1DD0EE56',
};

/* ── 场景状态容器（只存 seed 与不随 t 变的预计算，不含跨帧状态）───── */
const SC = {
  seeds: {},
  seed(id) {
    if (this.seeds[id] === undefined) this.seeds[id] = seedFromHex(SEEDS[id]);
    return this.seeds[id];
  },
};

/* ── 相机常量（基准 1920×1080）：各镜居中/网格基准，集中便于核对 ── */
const CAM = {
  CTR: [0.50 * BASE_W, 0.50 * BASE_H],   // 全幅中心
  GRID: [0.14 * BASE_W, 0.86 * BASE_W, 0.34 * BASE_H, 0.76 * BASE_H],  // 40×30 网格
  LINE_STEP_168: 1.02 * 168,
  LINE_STEP_160: 1.04 * 160,
  SP: 28.0,                              // 点阵间距
};

/* ══════════════════════════════════════════════════════════════
   公共小工具（Python 版 ch02_geometry.py 顶部同名函数）
   ══════════════════════════════════════════════════════════════ */

/** 按不透明度把颜色混到背景上（Python: mixc(c, k, bg)） */
function mixc(c, k, bg = BG_DEEP) { return mix(c, bg, k); }

/** easeOutBack 带超冲参数（Python: ease_out_back(p, s=1.7)） */
function easeOutBackK(p, s = 1.7) {
  const q = clamp01(p);
  return 1.0 + (s + 1.0) * (q - 1.0) ** 3 + s * (q - 1.0) ** 2;
}

/** 节拍脉冲：每个拍点内 sin 半波（Python: pulse(t, times, dur, amp)） */
function bpulse(t, times, dur, amp) {
  let v = 0.0;
  for (const b of times) {
    if (b <= t && t <= b + dur) v = Math.max(v, amp * Math.sin((Math.PI * (t - b)) / dur));
  }
  return v;
}

/** 节拍邻域 0..1（Python: ring_near(t, times, dur)） */
function ringNearPct(t, times, dur) {
  let best = 0.0;
  for (const b of times) {
    const d = Math.abs(t - b);
    if (d <= dur) best = Math.max(best, 1.0 - d / dur);
  }
  return best;
}

/** 超椭圆轮廓（exp=2 椭圆 / exp=6 圆角方形 / exp=1 菱形） */
function superellipse(n, cx, cy, rx, ry, exp = 2.0, rotDeg = 0.0) {
  const out = [];
  const rr = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x = rx * Math.sign(ca) * Math.abs(ca) ** (2.0 / exp);
    const y = ry * Math.sign(sa) * Math.abs(sa) ** (2.0 / exp);
    out.push([cx + x * Math.cos(rr) - y * Math.sin(rr),
              cy + x * Math.sin(rr) + y * Math.cos(rr)]);
  }
  return out;
}

/** 角度制圆弧采样点 */
function ringPtsDeg(cx, cy, r, n, a0 = 0.0, a1 = 360.0, flat = 1.0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * flat * Math.sin(a)]);
  }
  return out;
}

/** 确定性微抖动（Python: wobble） */
function wobble(t, i, amp = 1.0, freq = 1.0, seed = 0) {
  return amp * Math.sin(2 * Math.PI * freq * t + i * 1.7 + seed);
}

/** 四角微信息（各章共用的默认写法） */
function corners(f, tl, tr, bl, br, a = 0.6) {
  f.micro({ TL: tl, TR: tr, BL: bl, BR: br }, { size: 18, alpha: a });
}

/** Python 的 % 语义（负数也返回非负余数），与 JS 的 % 不同 */
function pymod(v, m) { return ((v % m) + m) % m; }

/** 角度制 → 弧度 */
function rad(deg) { return (deg * Math.PI) / 180; }

/**
 * 文字栅格化后按 step 采样为粒子（对应 Python 的 text_points）。
 *
 * 与 Python 版一致：采样格点固定为 0, step, 2step…，逐行扫描（y 外 x 内）。
 * 唯一差别是只扫描词块包围盒——字形不可能落在盒外，故点集与次序完全相同。
 * 返回 [[x, y, 行号], ...]（基准坐标）。
 */
function textPoints(lines, px, weight, trackEm, h, v, anchor, lineStep, opts = {}) {
  const { step = 4, n = null } = opts;
  const cv = document.createElement('canvas');
  cv.width = BASE_W; cv.height = BASE_H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const w = new Word(g, lines, px, { weight, trackEm, dpr: 1, h, v, anchor, lineStep });
  g.clearRect(0, 0, BASE_W, BASE_H);
  g.fillStyle = css(ICE);            // 只看 alpha 通道，颜色不影响采样
  g.textBaseline = 'alphabetic';
  g.font = w.font;
  let minX = Infinity, maxX = -Infinity, minB = Infinity, maxB = -Infinity;
  for (const ch of w.chars) {
    g.fillText(ch.ch, ch.x, ch.baseline);
    const cw = g.measureText(ch.ch).width;
    if (ch.x < minX) minX = ch.x;
    if (ch.x + cw > maxX) maxX = ch.x + cw;
    if (ch.baseline < minB) minB = ch.baseline;
    if (ch.baseline > maxB) maxB = ch.baseline;
  }
  const pad = px * 0.30;
  const y0 = Math.max(0, Math.floor((minB - w.asc - pad) / step) * step);
  const y1 = Math.min(BASE_H, Math.ceil((maxB + w.desc + pad) / step) * step);
  const x0 = Math.max(0, Math.floor((minX - pad) / step) * step);
  const x1 = Math.min(BASE_W, Math.ceil((maxX + pad) / step) * step);
  const img = g.getImageData(0, 0, BASE_W, BASE_H).data;
  const out = [];
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      if (img[(y * BASE_W + x) * 4 + 3] >= 128) {
        let li = 0;
        for (let k = 0; k < w.baselines.length; k++) if (y <= w.baselines[k]) { li = k; break; }
        out.push([x, y, li]);
      }
    }
  }
  return n ? limitN(out, n) : out;
}

/* ══════════════════════════════════════════════════════════════
   SHOT_022  `29.71–30.4996` ｜ 1,200 点爆散 → 40×30 网格吸附
   ══════════════════════════════════════════════════════════════ */
const SHOT_022 = {
  id: 'SHOT_022', start: 29.71, end: 30.4996,
  seedHex: SEEDS.SHOT_022, chapter: CHAPTER, status: 'INIT',
  lyric: "If I'm a set of points",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const seed = SC.seed('SHOT_022');
    const [cx, cy] = CAM.CTR;
    const [gx0, gx1, gy0, gy1] = CAM.GRID;
    const LINES = ["If I'm a set", 'of points'];
    const W = new Word(ctx, LINES, 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
      v: 'baseline_first', anchor: [0.10, 0.30], lineStep: CAM.LINE_STEP_168,
    });
    const src = [], dst = [], cols = [];
    for (let i = 0; i < 1200; i++) {
      const r = new Rng(seed, 'burst', i);
      const ang = r.range(0, Math.PI * 2), rad = r.range(0.06, 0.40);
      src.push([cx + rad * BASE_W * Math.cos(ang) * 1.3, cy + rad * BASE_H * Math.sin(ang)]);
      const col = i % 40, row = Math.floor(i / 40);
      dst.push([gx0 + (col * (gx1 - gx0)) / 39, gy0 + (row * (gy1 - gy0)) / 29]);
      cols.push(i % 5 === 0);
    }
    this._c = { W, src, dst, cols };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const [cx, cy] = CAM.CTR;
    const [gx0, gx1, gy0, gy1] = CAM.GRID;

    // ① 起手黑幕（29.71–29.95）
    const black = 1.0 - clamp01(phase(t, 29.71, 29.95));
    if (black > 0) f.rect(0, 0, BASE_W, BASE_H, BLACK, 0, 1, 0, BLACK, black);

    // ② 爆散 + 低速漂移（噪声位移 ±1.2%H、角位移 0.6°/帧）
    const burst = easeOutExpo(phase(t, 29.71, 29.85));
    const drift = clamp01(phase(t, 29.85, 30.16));
    const dp = [];
    for (let i = 0; i < 1200; i++) {
      const x0 = c.src[i][0], y0 = c.src[i][1];
      const dx = wobble(t, i, 0.012 * BASE_H, 0.35);
      const a = ((0.6 * 60 * (t - 29.85) * 0.06) * Math.PI) / 180;
      const x1 = cx + (x0 - cx) * Math.cos(a) - (y0 - cy) * Math.sin(a);
      const y1 = cy + (x0 - cx) * Math.sin(a) + (y0 - cy) * Math.cos(a);
      dp.push([lerp(cx, x1, burst), lerp(cy, y1, burst) + dx * drift]);
    }

    // ③ 逐列 8ms 延迟吸附到 40×30 网格（cubic-bezier(.22,1,.36,1) ≈ easeOutQuart）
    const snapPts = [];
    for (let i = 0; i < 1200; i++) {
      const col = i % 40;
      const st = 30.16 + col * 0.008;
      const p = easeOutQuart(clamp01((t - st) / 0.20));
      snapPts.push([lerp(dp[i][0], c.dst[i][0], p), lerp(dp[i][1], c.dst[i][1], p)]);
    }
    const gridA = 0.20 * clamp01(phase(t, 30.16, 30.40)) * (t >= 30.42 ? 1.2 : 1.0);
    for (let cc = 0; cc < 40; cc++) {
      const xx = gx0 + (cc * (gx1 - gx0)) / 39;
      f.line(xx, gy0, xx, gy1, GREY, 1, gridA);
    }
    for (let rr = 0; rr < 30; rr++) {
      const yy = gy0 + (rr * (gy1 - gy0)) / 29;
      f.line(gx0, yy, gx1, yy, GREY, 1, gridA);
    }
    f.pts(snapPts, 2.5, CYAN, 1, 0.45, BG_DEEP, c.cols.map((q) => (q ? 0.9 : 0.95)));
    const rest = [], restA = [];
    for (let i = 0; i < 1200; i++) if (!c.cols[i]) { rest.push(snapPts[i]); restA.push(0.85); }
    f.pts(rest, t >= 30.42 ? 3.0 : 2.5, BV, 1, 0.4, BG_DEEP, restA);

    // ④ p1/p2/p3 标注（依次点亮 + 8px 引线）
    const lf = fontOf('JetBrains Mono', 24, dpr);
    const marks = [[2, 3], [17, 14], [36, 27]];
    for (let k = 0; k < marks.length; k++) {
      const idx = marks[k][1] * 40 + marks[k][0];
      const px = c.dst[idx][0], py = c.dst[idx][1];
      if (t >= 30.42 + k * 0.02) {
        f.line(px, py, px + 8, py - 8, GREY, 1, 0.6);
        f.text(px + 10, py - 32, `p${k + 1}`, lf.font, ICE, 0.85);
      }
    }

    // 主词两行（`points` 30.42s 变主青）
    c.W.draw(f, t, {
      t0: 29.75, stagger: 0.011, dur: 0.12, dy: 8, ease: easeOutCubic,
      color: (li) => (li === 1 && t >= 30.42 ? CYAN : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 24, dpr);
    if (t < 30.42) f.text(gx1 + 12, gy0 - 30, 'SET::p[]', mf.font, GREY, 0.6);

    corners(f, 'T+29.71s', CHAPTER, `seed:${SEEDS.SHOT_022} · nodes:1200`, 'INIT');
    return { bloomR: 6.0, bloomK: 0.30, grain: 4.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_023  `30.4996–31.12` ｜ 网格点向 r=150 球核汇聚（3,600 点）
   ══════════════════════════════════════════════════════════════ */
const SHOT_023 = {
  id: 'SHOT_023', start: 30.4996, end: 31.12,
  seedHex: SEEDS.SHOT_023, chapter: CHAPTER, status: 'MORPH',
  lyric: "If I'm a set of points",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ["If I'm a set", 'of points'];
    const W = new Word(ctx, LINES, 168, {
      weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
      v: 'baseline_first', anchor: [0.10, 0.30], lineStep: CAM.LINE_STEP_168,
    });
    const wpts = textPoints(LINES, 168, 'Inter Semi-Bold', 0.04, 'left',
                            'baseline_first', [0.10, 0.30], CAM.LINE_STEP_168,
                            { step: 4, n: 2400 });
    this._c = { W, wpts };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.62 * BASE_W, cy = 0.46 * BASE_H;
    const [gx0, gx1, gy0, gy1] = CAM.GRID;

    // ① 静置 4 帧（30.50–30.58）+ 4×2 采样网格闪现
    if (t < 30.58) {
      for (let gy = 0; gy < 2; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          f.rect(0.10 * BASE_W + gx * 0.18 * BASE_W, 0.26 * BASE_H + gy * 0.16 * BASE_H,
                 0.10 * BASE_W + (gx + 1) * 0.18 * BASE_W, 0.26 * BASE_H + (gy + 1) * 0.16 * BASE_H,
                 GREY, 1, 0.30);
        }
      }
      c.W.drawPlain(f, () => ICE, { alpha: 1.0, glowK: 0.4 });
    }

    // ② 网格线自左向右逐行淡出 + 原格位 1px 十字标记
    const fade = clamp01(phase(t, 30.58, 30.90));
    for (let cc = 0; cc < 40; cc++) {
      const xx = gx0 + (cc * (gx1 - gx0)) / 39;
      f.line(xx, gy0, xx, gy1, GREY, 1, 0.20 * (1 - clamp01(fade * 1.4 - cc / 39)));
    }
    for (let rr = 0; rr < 30; rr++) {
      const yy = gy0 + (rr * (gy1 - gy0)) / 29;
      f.line(gx0, yy, gx1, yy, GREY, 1, 0.20 * (1 - clamp01(fade * 1.4 - rr / 29)));
    }
    if (t >= 30.58) {
      const ma = 0.15 * (1 - clamp01(phase(t, 30.58, 30.78)));
      for (let i = 0; i < 1200; i += 5) {
        const col = i % 40, row = Math.floor(i / 40);
        const px = gx0 + (col * (gx1 - gx0)) / 39;
        const py = gy0 + (row * (gy1 - gy0)) / 29;
        f.line(px - 3, py, px + 3, py, GREY, 1, ma);
      }
    }

    // ③ 词轮廓采样 2,400 点 + 1,200 网格点向 r=150 球核汇聚
    const ghost = 1.0 - clamp01(phase(t, 30.58, 30.63));
    if (ghost > 0.02) c.W.drawPlain(f, () => ICE, { alpha: ghost, glowK: 0.4 * ghost });
    const flow = easeInOutQuad(phase(t, 30.74, 31.02));
    const inner = easeInOutQuad(phase(t, 30.58, 30.74));
    const dp = [], dpA = [];
    for (const q of c.wpts) {
      const ang = Math.atan2(q[1] - cy, q[0] - cx);
      const tx = cx + 150 * Math.cos(ang), ty = cy + 150 * Math.sin(ang);
      const px = lerp(q[0], cx + (q[0] - cx) * 0.35, inner);
      const py = lerp(q[1], cy + (q[1] - cy) * 0.35, inner);
      dp.push([lerp(px, tx, flow), lerp(py, ty, flow)]);
      dpA.push(0.85);
    }
    const gpts = [], gA = [];
    const release = clamp01(phase(t, 30.58, 30.80));
    for (let i = 0; i < 1200; i++) {
      const col = i % 40, row = Math.floor(i / 40);
      const x = gx0 + (col * (gx1 - gx0)) / 39;
      const y = gy0 + (row * (gy1 - gy0)) / 29;
      const ang = Math.atan2(y - cy, x - cx);
      const px = lerp(x, cx + 150 * Math.cos(ang), flow);
      const py = lerp(y, cy + 150 * Math.sin(ang), flow);
      gpts.push([lerp(x, px, release), lerp(y, py, release)]);
      gA.push(0.8);
    }
    f.pts(dp, 2.5, ICE, 1, 0.5, BG_DEEP, dpA);
    f.pts(gpts, 2.5, CYAN, 1, 0.4, BG_DEEP, gA);

    // 吸引子标记 r=150 空心环 + 12 条流线
    const ringA = 0.30 + 0.30 * clamp01(phase(t, 30.74, 30.95));
    f.ell(cx, cy, 150, 150, BV, 1.5, ringA, 0.5);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI * 2) / 12 + 0.1 * (t - 30.50);
      f.line(cx + 190 * Math.cos(a), cy + 190 * Math.sin(a),
             cx + 158 * Math.cos(a), cy + 158 * Math.sin(a), GREY, 1, 0.20);
    }

    // 阶段 4：1.6r 外疏松成两圈雏形
    if (t >= 31.02) {
      const pp = easeOutExpo(phase(t, 31.02, 31.12));
      for (let k = 0; k < 2; k++) {
        const rr = (240 + k * 34) * (0.6 + 0.4 * pp);
        f.ell(cx, cy, rr, rr * 0.7, ICE, 1, 0.25 * pp);
      }
    }

    const mf = fontOf('JetBrains Mono', 24, dpr);
    if (t < 30.56) {
      f.text(gx1 + 12, gy0 - 30, 'SET::p[]', mf.font, GREY,
             0.6 * (1 - clamp01(phase(t, 30.50, 30.56))));
    }
    if (t >= 31.02) f.text(0.80 * BASE_W, 0.86 * BASE_H, 'MORPH→orb', mf.font, GREY, 0.6);

    corners(f, 'T+30.50s', CHAPTER, `seed:${SEEDS.SHOT_023} · 3600pt`, 'MORPH');
    const k = 0.30 + 0.20 * easeInOutCubic(phase(t, 30.74, 30.95));
    return { bloomR: 7.0, bloomK: Math.min(0.50, k), grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_024  `31.12–31.9936` ｜ 双轮廓相向旋进叠合入 r=160 球核
   ══════════════════════════════════════════════════════════════ */
const SHOT_024 = {
  id: 'SHOT_024', start: 31.12, end: 31.9936,
  seedHex: SEEDS.SHOT_024, chapter: CHAPTER, status: 'OFFER',
  lyric: 'Then I will give you my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['Then I will give', 'you my'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.60 * BASE_W, cy = 0.46 * BASE_H;

    // ① 空心球核 r=160 + 内虚线环 118 + 8 颗暖核点
    f.ell(cx, cy, 160, 160, BV, 1.5, 0.95, 0.6);
    f.dashCircle(cx, cy, 118, GREY, 1, 8, 6, 0.40);
    for (let k = 0; k < 8; k++) {
      if (t >= 31.72 + k * 0.02) {
        const a = (k * Math.PI * 2) / 8;
        f.dot(cx + 40 * Math.cos(a), cy + 40 * Math.sin(a), 3, WARM, 0.9, 1.0);
      }
    }

    // ② 双轮廓相向旋进 -14°/+14° 并在球核前叠合
    const adv = easeInOutCubic(phase(t, 31.30, 31.72));
    const rot = easeInOutCubic(phase(t, 31.12, 31.30));
    const breathe = t >= 31.90 ? 2.0 * Math.sin(2 * Math.PI * 0.8 * (t - 31.90)) : 0.0;
    const ax0 = lerp(0.24 * BASE_W, cx - 60, adv), ay0 = lerp(0.74 * BASE_H, cy + 10, adv);
    const bx0 = lerp(0.86 * BASE_W, cx + 60, adv), by0 = lerp(0.20 * BASE_H, cy - 10, adv);
    const pa = superellipse(900, ax0, ay0 + breathe, 160, 130, 6.0, -14 * rot);
    const pb = superellipse(900, bx0, by0 - breathe, 150, 150, 1.0, 14 * rot);
    const overlap = adv > 0.9 ? 1.0 : 0.0;
    f.pts(pa, 2.0 + overlap, ICE, 1, 0.5, BG_DEEP, pa.map(() => 0.9));
    f.pts(pb, 2.0 + overlap, CYAN, 1, 0.5, BG_DEEP, pb.map(() => 0.9));
    if (overlap > 0) {
      for (let k = 0; k < 7; k++) {
        const px = cx - 90 + k * 30;
        f.ell(px, cy, 22, 22, ICE, 1, 0.25, 0.4);
      }
    }

    // ③ 汇入路径 6 条 1px 灰蓝 30%
    for (let k = 0; k < 6; k++) {
      const a = ((40 + k * 55) * Math.PI) / 180;
      f.line(cx + 520 * Math.cos(a), cy + 420 * Math.sin(a),
             cx + 168 * Math.cos(a), cy + 168 * Math.sin(a), GREY, 1, 0.30);
    }

    // ④ 球核脉冲 easeOutBack(1.4)
    if (t >= 31.72) {
      const pp = easeOutBackK(phase(t, 31.72, 31.86), 1.4);
      const rr = 160 * (1 + 0.05 * Math.sin(Math.PI * pp));
      f.ell(cx, cy, rr, rr, ICE, 1, 0.5 * (1 - pp), 0.6);
    }

    // 主词 + give 变情绪紫
    c.W.draw(f, t, {
      t0: 31.12, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => (t >= 31.55 && li === 0 && ci >= 8 ? MOOD : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 42, dpr);
    f.text(cx - 120, cy + 180, 'GIVE::f(x)', mf.font, GREY, 0.55);

    corners(f, 'T+31.12s', CHAPTER, `seed:${SEEDS.SHOT_024} · rings:2`, 'OFFER');
    return { bloomR: 10.0, bloomK: 0.45, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_025  `31.9936–32.68` ｜ 3,008 点吸附 16×16 点阵（超冲回弹）
   ══════════════════════════════════════════════════════════════ */
const SHOT_025 = {
  id: 'SHOT_025', start: 31.9936, end: 32.68,
  seedHex: SEEDS.SHOT_025, chapter: CHAPTER, status: 'FLATTEN',
  lyric: 'Then I will give you my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const seed = SC.seed('SHOT_025');
    const src = [];
    for (let i = 0; i < 1800; i++) {
      const r = new Rng(seed, 'c', i);
      const ang = r.range(0, Math.PI * 2), rad = r.range(0.03, 0.27);
      src.push([0.60 * BASE_W + rad * BASE_W * Math.cos(ang) * 0.9,
                0.46 * BASE_H + rad * BASE_H * Math.sin(ang)]);
    }
    for (let i = 0; i < 1208; i++) {
      const r = new Rng(seed, 'g', i);
      src.push([r.range(0.16, 0.84) * BASE_W, r.range(0.32, 0.74) * BASE_H]);
    }
    this._c = {
      src,
      W: new Word(ctx, ['Then I will give', 'you my'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.52 * BASE_H;
    const SP = CAM.SP;

    // ① 双轮廓解除叠合向中心收缩 → ② 3,008 点吸附 256 目标位（超冲 4% 回弹）
    const p1 = easeInQuad(phase(t, 31.99, 32.14));
    const p2 = easeOutBackK(phase(t, 32.14, 32.44), 1.56);
    const dp = [], dpA = [];
    for (let i = 0; i < c.src.length; i++) {
      const k = i % 256;
      const tx = cx + ((k % 16) - 7.5) * SP;
      const ty = cy + (Math.floor(k / 16) - 7.5) * SP;
      const x = c.src[i][0], y = c.src[i][1];
      const px = lerp(x, cx + (x - cx) * 0.3, p1), py = lerp(y, cy + (y - cy) * 0.3, p1);
      dp.push([lerp(px, tx, p2), lerp(py, ty, p2)]);
      dpA.push(0.85);
    }
    f.pts(dp, 3.0, CYAN, 1, 0.5, BG_DEEP, dpA);

    // 球核环收缩至 r=0（32.28）
    const shr = clamp01(phase(t, 31.99, 32.28));
    if (t < 32.28) {
      f.ell(cx, cy, 160 * (1 - shr), 160 * (1 - shr), BV, 1.5, 0.8 * (1 - shr), 0.5);
    }

    // ③ 行列连线逐行点亮（24ms/行）
    for (let rr = 0; rr < 16; rr++) {
      const st = 32.44 + rr * 0.024;
      const aa = 0.25 * clamp01((t - st) / 0.03);
      if (aa <= 0) continue;
      const yy = cy + (rr - 7.5) * SP;
      f.line(cx - 7.5 * SP, yy, cx + 7.5 * SP, yy, GREY, 1, aa);
    }
    if (t >= 32.50) {
      for (let cc = 0; cc < 16; cc++) {
        const xx = cx + (cc - 7.5) * SP;
        f.line(xx, cy - 7.5 * SP, xx, cy + 7.5 * SP, GREY, 1, 0.20);
      }
    }

    // ④ 倾角 -6°（easeOutCubic）
    const tilt = -6.0 * easeOutCubic(phase(t, 32.60, 32.68));
    if (Math.abs(tilt) > 0.1) {
      const tr = (tilt * Math.PI) / 180;
      const ptsT = [], ptsA = [];
      for (let k = 0; k < 256; k++) {
        const x = cx + ((k % 16) - 7.5) * SP, y = cy + (Math.floor(k / 16) - 7.5) * SP;
        ptsT.push([cx + (x - cx) * Math.cos(tr) - (y - cy) * Math.sin(tr),
                   cy + (x - cx) * Math.sin(tr) + (y - cy) * Math.cos(tr)]);
        ptsA.push(0.9);
      }
      f.pts(ptsT, 3.0, CYAN, 1, 0.5, BG_DEEP, ptsA);
    }

    // 主词自下而上逐行消隐（`my` 保留至 32.52）
    for (const g of c.W.chars) {
      let a = 1.0;
      if (g.li === 1) {
        if (t >= 32.44) a = 1.0 - easeInCubic(phase(t, 32.52, 32.60));
      } else if (t >= 32.20) {
        a = 1.0 - easeInCubic(phase(t, 32.20, 32.36));
      }
      if (a <= 0.02 || (t >= 32.54 && g.li === 1 && g.ci >= 4)) continue;
      const col = g.li === 0 && g.ci >= 8 ? MOOD : ICE;
      f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font, col, a, 0.3 * a, c.W.stroke);
    }
    const mf = fontOf('JetBrains Mono', 42, dpr);
    if (t >= 32.44) {
      const on = Math.floor((t - 32.44) / 0.08) % 2 === 0;
      f.text(cx - 40, cy + 7.5 * SP + 24, 'z:0', mf.font, CYAN, on ? 0.9 : 0.4);
    }

    corners(f, 'T+31.99s', CHAPTER, `seed:${SEEDS.SHOT_025} · grid:16x16`, 'FLATTEN');
    const k = 0.35 + 0.20 * Math.sin(Math.PI * clamp01(phase(t, 32.14, 32.44)));
    return { bloomR: 8.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_026  `32.68–33.41` ｜ 16×16 点阵绕 X 轴转 -22° 并挤出 6 层
   ══════════════════════════════════════════════════════════════ */
const SHOT_026 = {
  id: 'SHOT_026', start: 32.68, end: 33.41,
  seedHex: SEEDS.SHOT_026, chapter: CHAPTER, status: 'EXTRUDE',
  lyric: 'DIMENSION',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['DIMENSION'], 240, {
        weight: 'Inter Extra-Bold', trackEm: 0.14, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.51],
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.51 * BASE_H;
    const SP = CAM.SP;
    const rot = 22.0 * easeOutQuad(phase(t, 32.68, 32.86));
    const layers = 6;

    // ① 16×16 点阵平面绕 X 轴转 -22° 并向上挤出 6 层
    const ext = easeOutQuad(phase(t, 32.68, 32.86));
    const cr = Math.cos((rot * Math.PI) / 180);
    const flat = [];
    for (let k = 0; k < 256; k++) {
      flat.push([cx + ((k % 16) - 7.5) * SP, cy + (Math.floor(k / 16) - 7.5) * SP * cr]);
    }
    for (let L = 0; L < layers; L++) {
      const dz = L * 30 * ext;
      const s_ = 1.0 - 0.06 * L;
      const col = L === 0 ? CYAN : (L === layers - 1 ? BV : mixc(CYAN, 0.6, BV));
      const pts = flat.map(([x, y]) => [cx + (x - cx) * s_, cy + (y - cy) * s_ - dz]);
      f.pts(pts, 3.0, col, 1, 0.5, BG_DEEP, pts.map(() => 0.9 - 0.13 * L));
      if (L && L % 2 === 0) {
        for (let k = 0; k < 256; k += 24) {
          f.line(pts[k][0], pts[k][1], pts[k][0], pts[k][1] + 30, GREY, 1, 0.30);
        }
      }
    }

    // ② DIMENSION 逐字入场 + 6 层 Z 副本
    for (let L = 5; L >= 0; L--) {
      const aL = L === 0 ? 1.0 : 0.85 * (1 - L / 6.0);
      const col = L === 0 ? ICE : mixc(BV, 0.15 + 0.12 * (5 - L));
      for (const g of c.W.chars) {
        const st = 32.86 + g.ci * 0.026;
        if (t < st + 0.04 * (5 - L) * 0.5) continue;
        const p = easeOutCubic(phase(t, st, st + 0.14));
        if (p <= 0) continue;
        const dx = (1 - p) * -18;
        const depth = 6 * (L * 30) * clamp01(phase(t, st + 0.04, st + 0.04 + 0.12));
        const xx = g.x / dpr + dx + depth * 0.35;
        const yy = g.baseline / dpr - depth * 0.55 + (1 - p) * 6;
        f.text(xx, yy, g.ch, c.W.font, col, p * aL, 0.35 * p * aL, c.W.stroke);
      }
    }

    // ③ Z 轴刻度尺（21 根 1×10px）+ z0..z5 标注 + 深度引导线
    const zx = 0.06 * BASE_W;
    for (let i = 0; i < 21; i++) {
      if (t >= 33.16 + i * 0.014) {
        const yy = 0.30 * BASE_H + i * ((0.40 * BASE_H) / 20);
        f.line(zx, yy, zx + 10, yy, GREY, 1, 0.7);
      }
    }
    const lf = fontOf('JetBrains Mono', 18, dpr);
    for (let L = 0; L < 6; L++) {
      f.text(zx + 16, 0.30 * BASE_H + L * ((0.40 * BASE_H) / 5) - 9, `z${L}`, lf.font, CYAN, 0.7);
    }
    const mf = fontOf('JetBrains Mono', 42, dpr);
    f.text(zx, 0.30 * BASE_H - 40, 'axis:Z', mf.font, CYAN, 0.8);

    // ④ X/Y 平面小图例（120×90px）
    const lx = 0.88 * BASE_W, ly = 0.18 * BASE_H;
    f.rect(lx - 60, ly - 45, lx + 60, ly + 45, GREY, 1, 0.5);
    f.line(lx - 40, ly + 20, lx + 40, ly + 20, GREY, 1, 0.6);
    f.line(lx - 40, ly + 20, lx - 40, ly - 20, GREY, 1, 0.6);

    // 阶段 4：Y 轴微摆（整体亮度由 post 的 bloom 抬升体现）
    if (t >= 33.32) {
      f.line(0.30 * BASE_W, 0.30 * BASE_H, 0.70 * BASE_W, 0.30 * BASE_H, ICE, 1,
             0.20 * Math.sin(Math.PI * clamp01(phase(t, 33.32, 33.41))));
    }

    corners(f, 'T+32.68s', CHAPTER, `seed:${SEEDS.SHOT_026} · layers:6`, 'EXTRUDE');
    const k = 0.42 + bpulse(t, beatsIn(beats, this.start, this.end), 0.06, 0.06);
    return { bloomR: 8.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_027  `33.41–34.1044` ｜ 1,024 点聚成 r=270 圆周
   ══════════════════════════════════════════════════════════════ */
const SHOT_027 = {
  id: 'SHOT_027', start: 33.41, end: 34.1044,
  seedHex: SEEDS.SHOT_027, chapter: CHAPTER, status: 'CLOSE',
  lyric: "If I'm a circle",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const seed = SC.seed('SHOT_027');
    const src = [];
    for (let i = 0; i < 1024; i++) {
      const r = new Rng(seed, 'cube', i);
      src.push([0.5 * BASE_W + r.range(-0.34, 0.34) * BASE_W,
                0.51 * BASE_H + r.range(-0.30, 0.30) * BASE_H]);
    }
    this._c = {
      src,
      W: new Word(ctx, ["If I'm a circle"], 176, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: null,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.46 * BASE_W, cy = 0.48 * BASE_H;
    const R = 270.0;

    // ① 立方体内散点 → 圆周（逐点 6ms 延迟）
    const spin = 0.06 * Math.max(0.0, t - 34.00);
    const dp = [], dpA = [];
    for (let i = 0; i < 1024; i++) {
      const ang = (i * Math.PI * 2) / 1024 + spin;
      const tx = cx + R * Math.cos(ang), ty = cy + R * Math.sin(ang);
      const st = 33.41 + (i % 64) * 0.006;
      const pp = easeOutQuad(clamp01((t - st) / 0.30));
      dp.push([lerp(c.src[i][0], tx, pp), lerp(c.src[i][1], ty, pp)]);
      dpA.push(i % 7 ? 1.0 : 0.95);
    }
    f.pts(dp, 3.0, CYAN, 1, 0.5, BG_DEEP, dpA);
    const sp = [], spA = [];
    for (let i = 0; i < 1024; i += 7) { sp.push(dp[i]); spA.push(0.9); }
    f.pts(sp, 3.0, ICE, 1, 0.6, BG_DEEP, spA);

    // 半径辅助线 + 圆心暖点 + 4 象限标记
    f.line(cx, cy, cx + 270 * clamp01(phase(t, 33.86, 34.00)), cy, GREY, 1, 0.40);
    f.dot(cx, cy, 4, WARM, 1, 1.0);
    for (let q = 0; q < 4; q++) {
      if (t >= 33.86 + q * 0.04) {
        const a = (q * Math.PI) / 2;
        f.ell(cx + 270 * Math.cos(a), cy + 270 * Math.sin(a), 6, 6, BV, 1.5, 0.9, 0.5);
      }
    }

    // 收束轨迹线 6 条
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI * 2) / 6;
      f.line(cx + 420 * Math.cos(a), cy + 420 * Math.sin(a),
             cx + 280 * Math.cos(a), cy + 280 * Math.sin(a), GREY, 1,
             0.20 * (1 - clamp01(phase(t, 33.56, 33.90))));
    }

    // 主词
    c.W.draw(f, t, {
      t0: 33.41, stagger: 0.009, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li, ci) => (t >= 34.02 && ci >= 8 ? CYAN : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 24, dpr);
    f.text(cx + 24, cy + 24, 'r:270 · n:1024', mf.font, GREY, 0.6);

    corners(f, 'T+33.41s', CHAPTER, `seed:${SEEDS.SHOT_027} · nodes:1024`, 'CLOSE');
    return { bloomR: 9.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_028  `34.1044–34.65` ｜ 三层轨道 860/1024/1188 点反向嵌套
   ══════════════════════════════════════════════════════════════ */
const SHOT_028 = {
  id: 'SHOT_028', start: 34.1044, end: 34.65,
  seedHex: SEEDS.SHOT_028, chapter: CHAPTER, status: 'MORPH',
  lyric: "If I'm a circle",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ["If I'm a circle"];
    this._c = {
      W: new Word(ctx, LINES, 176, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: null,
      }),
      pts: textPoints(LINES, 176, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                      [0.10, 0.26], null, { step: 4, n: 1660 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.46 * BASE_W, cy = 0.48 * BASE_H;

    const ghost = 1.0 - clamp01(phase(t, 34.18, 34.24));
    if (ghost > 0.02) c.W.drawPlain(f, ICE, { alpha: ghost, glowK: 0.4 * ghost });

    // 三层轨道 r=210/270/330（860/1024/1188 点，反向嵌套）
    const speed = [0.9, -0.5, 0.3];
    const boost = t >= 34.38 && t <= 34.46 ? 1.6 : 1.0;
    const p = easeInOutQuad(phase(t, 34.30, 34.54));
    const rings = [[210, 860, ICE], [270, 1024, CYAN], [330, 1188, BV]];
    for (let li = 0; li < rings.length; li++) {
      const rr = rings[li][0], n = rings[li][1], col = rings[li][2];
      const pl = [], pa = [];
      for (let i = 0; i < n; i++) {
        const ang = ((i * 360.0) / n + speed[li] * boost * 60 * Math.max(0.0, t - 34.30))
          * (Math.PI / 180);
        const tx = cx + rr * Math.cos(ang), ty = cy + rr * Math.sin(ang);
        let x0 = tx, y0 = ty;
        if (li === 0 && c.pts.length) {
          const q = c.pts[i < c.pts.length ? i : i % c.pts.length];
          x0 = q[0]; y0 = q[1];
        }
        pl.push([lerp(x0, tx, p), lerp(y0, ty, p)]);
        pa.push(0.85);
      }
      f.pts(pl, 2.5, col, 1, 0.45, BG_DEEP, pa);
    }

    // 半径线与圆心暖点（亮度降至 40%）
    f.line(cx, cy, cx + 210, cy, GREY, 1, 0.16);
    const pu = 1.0 + bpulse(t, beatsIn(beats, this.start, this.end), 0.06, 0.06);
    f.dot(cx, cy, 4 * pu, WARM, 0.4, 0.6);
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      f.ell(cx + 270 * Math.cos(a), cy + 270 * Math.sin(a), 6, 6, BV, 1.5, 0.5);
    }
    const mf = fontOf('JetBrains Mono', 24, dpr);
    if (t < 34.05) f.text(cx + 24, cy + 24, 'r:270 · n:1024', mf.font, GREY, 0.6);
    if (t >= 34.52) f.text(0.78 * BASE_W, 0.88 * BASE_H, 'MORPH→give', mf.font, GREY, 0.6);

    corners(f, 'T+34.10s', CHAPTER, `seed:${SEEDS.SHOT_028} · 3072pt`, 'MORPH');
    let k = 0.40 + 0.12 * easeInOutCubic(phase(t, 34.18, 34.40));
    k = lerp(k, 0.42, clamp01(phase(t, 34.40, 34.65)));
    return { bloomR: 9.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_029  `31.9936→32.68` 之外｜三环收敛 + 球核自 C 环浮现
   ══════════════════════════════════════════════════════════════ */
const SHOT_029 = {
  id: 'SHOT_029', start: 34.65, end: 35.5684,
  seedHex: SEEDS.SHOT_029, chapter: CHAPTER, status: 'OFFER',
  lyric: 'Then I will give you my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['Then I will give', 'you my'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.24], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.58 * BASE_W, cy = 0.46 * BASE_H;

    // 三环自 1.35r 收敛锁定（easeOutBack 1.56 超冲后回弹）
    const lock = easeOutBackK(phase(t, 34.86, 35.28), 1.56);
    const rings = [[108, 760, ICE, 0.8], [150, 1024, CYAN, -0.5], [196, 1288, BV, 0.3]];
    for (const [r0, n, col, sp] of rings) {
      const r = lerp(r0 * 1.35, r0, lock);
      const pts = [], al = [];
      for (let i = 0; i < n; i++) {
        const ang = ((i * 360.0) / n + sp * 60 * Math.max(0.0, t - 34.86)) * (Math.PI / 180);
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
        al.push(0.85);
      }
      f.pts(pts, 2.5, col, 1, 0.45, BG_DEEP, al);
    }

    // 球核 r=96 自 C 环中心浮现 + 8 颗暖核点
    const core = 96 * easeOutBackK(phase(t, 35.28, 35.46), 1.4);
    if (core > 1) f.ell(cx, cy, core, core, BV, 1.5, 0.9, 0.7);
    for (let k = 0; k < 8; k++) {
      if (t >= 35.28 + k * 0.02) {
        const a = (k * Math.PI * 2) / 8;
        f.dot(cx + 32 * Math.cos(a), cy + 32 * Math.sin(a), 3, WARM, 0.9, 1.0);
      }
    }

    // 向心流线 8 条 + C 环外 12 段刻度
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI * 2) / 8;
      f.line(cx + 260 * Math.cos(a), cy + 260 * Math.sin(a),
             cx + 210 * Math.cos(a), cy + 210 * Math.sin(a), GREY, 1, 0.25);
    }
    for (let k = 0; k < 12; k++) {
      const a = k * 30.0;
      f.arc(cx, cy, 214, 214, a, a + 6, GREY, 1, 0.40);
    }

    // 呼吸 ±2px
    if (t >= 35.46) {
      const br = 2.0 * Math.sin(2 * Math.PI * 0.9 * (t - 35.46));
      for (const [r0, , col] of rings) {
        f.pline(ringPtsDeg(cx, cy, r0 + br, 48), col, 1, 0.25, 0.2, BG_DEEP, true);
      }
    }

    // 主词
    c.W.draw(f, t, {
      t0: 34.65, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => (t >= 35.24 && li === 0 && ci >= 8 ? MOOD : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 42, dpr);
    f.text(cx - 60, cy + 118, 'NEST::3', mf.font, GREY, 0.55);

    corners(f, 'T+34.65s', CHAPTER, `seed:${SEEDS.SHOT_029} · rings:3`, 'OFFER');
    return { bloomR: 10.0, bloomK: 0.45, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_030  `35.5684–36.29` ｜ 三环归并为 r=240 单环 + 40° 高亮弧
   ══════════════════════════════════════════════════════════════ */
const SHOT_030 = {
  id: 'SHOT_030', start: 35.5684, end: 36.29,
  seedHex: SEEDS.SHOT_030, chapter: CHAPTER, status: 'TRACE',
  lyric: 'Then I will give you my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['Then I will give', 'you my'];
    this._c = {
      W: new Word(ctx, LINES, 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.24], lineStep: CAM.LINE_STEP_160,
      }),
      ghost: textPoints(LINES, 160, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                        [0.10, 0.24], CAM.LINE_STEP_160, { step: 4, n: 500 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.48 * BASE_W, cy = 0.50 * BASE_H;
    const R = 240.0;

    // ① 三环半径向 240px 收敛并环（角速度归同向）
    const thin = easeInCubic(phase(t, 35.74, 36.02));
    const nShow = Math.floor(lerp(3072, 1024, thin));
    const ring = [];
    for (let i = 0; i < nShow; i++) {
      const ang = ((i * 360.0) / nShow + 20.0 * Math.max(0.0, t - 35.57)) * (Math.PI / 180);
      ring.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
    }
    // 等价 Python 的逐点 f.dot(..., 2.5, CYAN, a=0.8, gl=0.4)：
    // pts 的高光按 aa 缩放，故传 gl=0.4/0.8 以复现同一高光强度
    f.pts(ring, 2.5, CYAN, 0.8, 0.4 / 0.8, BG_DEEP);

    // ② 球核收缩至 0 并把 8 颗核点转为卫星
    if (t < 36.02) {
      const rr = 96 * (1 - clamp01(phase(t, 35.74, 36.02)));
      f.ell(cx, cy, rr, rr, BV, 1.5, 0.6, 0.5);
    } else {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI * 2) / 8 + 2.0 * (t - 36.02);
        f.dot(cx + 30 * Math.cos(a), cy + 30 * Math.sin(a), 2, WARM, 0.7, 0.6);
      }
    }

    // ③ 40° 高亮弧被标记点拖出（linear）
    const arcA = clamp01(phase(t, 36.02, 36.20));
    const markDeg = 360.0 * easeInOutSine(phase(t, 35.74, 36.29)) * 0.55;
    const hl = 40.0 * arcA;
    if (hl > 0.5) {
      f.pline(ringPtsDeg(cx, cy, R, Math.max(2, Math.floor(hl)),
                         Math.max(0.0, markDeg - hl), markDeg), ICE, 2, 0.95, 0.7);
    }
    const ma = (markDeg * Math.PI) / 180;
    const mx = cx + R * Math.cos(ma), my = cy + R * Math.sin(ma);
    f.ell(mx, my, 6, 6, WARM, 2, 0.95, 1.0);
    for (let k = 0; k < 12; k++) {
      f.dot(lerp(mx, mx - 24 * Math.cos(ma), k / 12),
            lerp(my, my - 24 * Math.sin(ma), k / 12),
            2, WARM, 0.9 * (1 - k / 12), 0.4);
    }

    // ④ `C = 2πr` steps(5) 打字机
    const mf = fontOf('JetBrains Mono', 48, dpr);
    if (t >= 36.06) {
      const n = Math.floor(clamp01(phase(t, 36.06, 36.26)) * 5) * 3;
      f.text(cx - 90, cy + 30, 'C = 2πr'.slice(0, n), mf.font, ICE, 0.9, 0.4);
    }

    // 主词逐行自下而上消隐（`my` 保留至 36.14）
    for (const g of c.W.chars) {
      let a = 1.0;
      if (g.li === 1) a = 1.0 - easeInCubic(phase(t, 36.14, 36.22));
      else if (t >= 35.90) a = 1.0 - easeInCubic(phase(t, 35.90, 36.08));
      if (a <= 0.02) continue;
      f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font,
             g.li === 0 && g.ci >= 8 ? MOOD : ICE, a, 0.3 * a, c.W.stroke);
    }

    // 主词轮廓残留 500 点向圆外散尽
    if (t >= 35.90) {
      const pp = clamp01(phase(t, 35.90, 36.29));
      const pts2 = [], al2 = [];
      for (const q of c.ghost) {
        pts2.push([q[0] + (q[0] - cx) * 0.4 * pp, q[1] + (q[1] - cy) * 0.4 * pp]);
        al2.push(0.5 * (1 - pp));
      }
      f.pts(pts2, 2, ICE, 1, 0.3, BG_DEEP, al2);
    }

    corners(f, 'T+35.57s', CHAPTER, `seed:${SEEDS.SHOT_030} · arc:40deg`, 'TRACE');
    const k = 0.38 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 35.74, 35.95)));
    return { bloomR: 9.0, bloomK: k, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_031  `36.29–37.07` ｜ 13 字母沿圆周切向吸附 + 260° 绕行
   （Python 注释写「12 字母」，实际 'CIRCUMFERENCE'.length = 13，此处以实际为准）
   ══════════════════════════════════════════════════════════════ */
const SHOT_031 = {
  id: 'SHOT_031', start: 36.29, end: 37.07,
  seedHex: SEEDS.SHOT_031, chapter: CHAPTER, status: 'PERIMETER',
  lyric: 'CIRCUMFERENCE',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LETTERS = 'CIRCUMFERENCE';
    const fnt = fontOf('Inter Bold', 72, 1);
    const mf1 = fontOf('JetBrains Mono', 48, 1);
    // 以 dpr=1 度量：绘制时按帧 dpr 缩放（PIL 版是旋转位图贴图）
    ctx.save();
    ctx.font = fnt.font;
    const lw = [], m = ctx.measureText('H');
    const asc = m.actualBoundingBoxAscent || 72 * 0.75;
    const desc = m.actualBoundingBoxDescent || 72 * 0.25;
    for (const ch of LETTERS) lw.push(ctx.measureText(ch).width);
    ctx.font = mf1.font;
    const wFml = ctx.measureText('C = 2').width;
    ctx.restore();
    this._c = { LETTERS, lw, asc, desc, wFml };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.48 * BASE_W, cy = 0.50 * BASE_H;
    const R = 240.0;
    const WA = -90.0, WB = 90.0;

    // 底盘圆周（1,024 点保留 60%）
    const base = [];
    for (let i = 0; i < 1024; i += 2) {
      const ang = ((i * 360) / 1024 + 10 * (t - 36.29)) * (Math.PI / 180);
      base.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
    }
    f.pts(base, 2, CYAN, 0.45, 0.3 / 0.45, BG_DEEP);

    // ① 13 字母自圆外 1.35r 沿径向吸附并切向旋转对齐（延迟 30ms/字）
    const fnt = fontOf('Inter Bold', 72, dpr);
    for (let i = 0; i < c.LETTERS.length; i++) {
      const st = 36.29 + i * 0.03;
      const p = t >= st ? easeOutCubic(phase(t, st, st + 0.14)) : 0.0;
      if (p <= 0) continue;
      const deg = WA + ((WB - WA) * i) / (c.LETTERS.length - 1);
      const rr = R * lerp(1.35, 1.0, p);
      const ang = (deg * Math.PI) / 180;
      const x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang);
      const w = c.lw[i] * dpr;
      // PIL: 位图绕中心旋转 (deg+90)°（逆时针）后贴到 (x,y)。
      // Canvas: 逆时针 = rotate(-角度)；按 PIL 的层高 1.4em 居中补偿字形盒
      ctx.save();
      ctx.translate(x * dpr, y * dpr);
      ctx.rotate((-(deg + 90) * Math.PI) / 180);
      ctx.font = fnt.font;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = css(ICE);
      ctx.globalAlpha = clamp01(p);
      ctx.fillText(c.LETTERS[i], (-w / 2 - 2 * dpr), (c.asc - 0.7 * 72) * dpr);
      ctx.restore();
    }

    // ② 绕行标记匀速推进 260° + 轨迹弧
    const pro = 260.0 * clamp01(phase(t, 36.45, 36.86));
    if (pro > 1) {
      f.pline(ringPtsDeg(cx, cy, R, Math.max(2, Math.floor(pro)), WA, WA + pro),
              ICE, 2, 0.95, 0.8);
    }
    const ma = ((WA + pro) * Math.PI) / 180;
    f.ell(cx + R * Math.cos(ma), cy + R * Math.sin(ma), 6, 6, WARM, 2, 1.0, 1.0);

    // ③ 直径标注横穿 + 端帽
    const dp = easeOutCubic(phase(t, 36.86, 36.98));
    if (dp > 0) {
      f.line(cx - R * dp, cy, cx + R * dp, cy, GREY, 1, 0.40);
      if (t >= 36.92) {
        f.line(cx - R, cy - 8, cx - R, cy + 8, ICE, 2, 0.9, 0.6);
        f.line(cx + R, cy - 8, cx + R, cy + 8, ICE, 2, 0.9, 0.6);
      }
    }

    // ④ 公式 `C = 2πr`（2π 主青）
    const mf = fontOf('JetBrains Mono', 48, dpr);
    f.text(cx - 92, cy + 34, 'C = 2', mf.font, ICE, 0.9, 0.4);
    f.text(cx - 92 + c.wFml, cy + 34, 'πr', mf.font,
           t >= 36.98 ? CYAN : ICE, 0.95, 0.5);
    const mf2 = fontOf('JetBrains Mono', 20, dpr);
    f.text(0.86 * BASE_W, 0.84 * BASE_H, 'arc:260°', mf2.font, GREY, 0.6);

    corners(f, 'T+36.29s', CHAPTER, `seed:${SEEDS.SHOT_031} · letters:12`, 'PERIMETER');
    const k = 0.40 + 0.10 * easeInOutCubic(phase(t, 36.45, 36.86));
    return { bloomR: 9.0, bloomK: k, grain: 5.0 };
  },
};
/* ══════════════════════════════════════════════════════════════
   SHOT_032  `37.07–37.9268` ｜ 圆周解卷为基线 + 正弦波自左向右书写
   ══════════════════════════════════════════════════════════════ */
const SHOT_032 = {
  id: 'SHOT_032', start: 37.07, end: 37.9268,
  seedHex: SEEDS.SHOT_032, chapter: CHAPTER, status: 'OSC',
  lyric: "If I'm a sine wave",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ["If I'm a sine", 'wave'], 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.30], lineStep: CAM.LINE_STEP_168,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.50 * BASE_H;
    const x0 = 0.08 * BASE_W, x1 = 0.92 * BASE_W;
    let amp = 150.0 * (1.0 + 0.2 * (easeOutBackK(phase(t, 37.84, 37.93), 1.5) - 1.0));
    if (t < 37.84) amp = 150.0;

    // ① 圆周解卷为水平基线
    const unf = easeInOutQuad(phase(t, 37.07, 37.16));
    for (let i = 0; i < 1024; i += 3) {
      const ang = ((i * 360) / 1024) * (Math.PI / 180);
      const sx = 0.48 * BASE_W + 240 * Math.cos(ang);
      const sy = 0.50 * BASE_H + 240 * Math.sin(ang);
      const tx = lerp(x0, x1, i / 1024.0);
      f.dot(lerp(sx, tx, unf), lerp(sy, yb, unf), 2, CYAN, 0.4 * (1 - unf), 0.3);
    }

    // ② 波形自左向右书写（linear）+ 波前笔点
    const write = clamp01(phase(t, 37.16, 37.70));
    const n = 320;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      pts.push([lerp(x0, x1, u), yb - amp * Math.sin(2 * Math.PI * 1.5 * u)]);
    }
    const vis = [];
    for (let i = 0; i < n; i++) if (i / (n - 1) <= write) vis.push(pts[i]);
    if (vis.length > 1) f.pline(vis, CYAN, 2, 1.0, 0.6);
    const pen = pts[Math.min(n - 1, Math.floor(write * (n - 1)))];
    if (write < 1.0) {
      f.dot(pen[0], pen[1], 5, ICE, 1, 1.0);
      f.line(pen[0] - 16, pen[1], pen[0], pen[1], ICE, 2, 0.8, 0.6);
    }

    // 基线 + 横轴 24 根刻度 + 纵轴振幅标尺
    f.line(x0, yb, x1, yb, GREY, 1, 0.45);
    for (let i = 0; i < 24; i++) {
      if (t >= 37.70 + i * 0.01) {
        const xx = lerp(x0, x1, i / 23);
        f.line(xx, yb, xx, yb + 8, GREY, 1, 0.5);
      }
    }
    for (const sgn of [-1, 1]) {
      f.line(x0 + 24, yb + sgn * amp, x0 + 24, yb + sgn * (amp - 40), GREY, 1, 0.5);
    }
    const lf = fontOf('JetBrains Mono', 18, dpr);
    f.text(x0 + 30, yb - amp - 22, '+A', lf.font, GREY, 0.6);
    f.text(x0 + 30, yb + amp + 6, '-A', lf.font, GREY, 0.6);

    // 波峰波谷暖点（笔点经过即点亮）
    for (const uMark of [0.25 / 1.5, 0.75 / 1.5]) {
      if (write >= uMark) f.dot(lerp(x0, x1, uMark), yb - amp, 3, WARM, 1, 1.0);
    }
    for (const uMark of [0.75 / 1.5, 1.25 / 1.5]) {
      if (write >= uMark) f.dot(lerp(x0, x1, uMark), yb + amp, 3, WARM, 1, 1.0);
    }

    // 主词两行
    if (t >= 37.07) {
      c.W.draw(f, t, {
        t0: 37.07, stagger: 0.010, dur: 0.10, dy: 8, ease: easeOutCubic,
        color: (li, ci) => (t >= 37.60 && li === 0 && ci >= 7 ? CYAN : ICE), glowK: 0.35,
      });
    }
    const mf = fontOf('JetBrains Mono', 42, dpr);
    f.text(x1 - 300, yb - 60, 'y=A·sin(ωt)', mf.font, GREY, 0.55);

    corners(f, 'T+37.07s', CHAPTER, `seed:${SEEDS.SHOT_032} · f:1.5`, 'OSC');
    return {
      bloomR: 8.0,
      bloomK: 0.42 + bpulse(t, beatsIn(beats, this.start, this.end), 0.07, 0.06),
      grain: 5.0,
      scan: 0.08,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_033  `37.9268–38.6` ｜ 波形 + 字形采样粒子池 → 12 条短棒座位
   ══════════════════════════════════════════════════════════════ */
const SHOT_033 = {
  id: 'SHOT_033', start: 37.9268, end: 38.6,
  seedHex: SEEDS.SHOT_033, chapter: CHAPTER, status: 'SEAT',
  lyric: "If I'm a sine wave",
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ["If I'm a sine", 'wave'];
    this._c = {
      W: new Word(ctx, LINES, 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.30], lineStep: CAM.LINE_STEP_168,
      }),
      wpts: textPoints(LINES, 168, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                       [0.10, 0.30], CAM.LINE_STEP_168, { step: 6, n: 900 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.50 * BASE_H;
    const x0 = 0.08 * BASE_W, x1 = 0.92 * BASE_W;
    const ghost = 1.0 - clamp01(phase(t, 38.06, 38.12));

    // ① 波形静置 3 帧 + 主词完整
    if (t < 38.06) {
      const pts = [];
      for (let i = 0; i < 260; i++) {
        const u = i / 259;
        pts.push([lerp(x0, x1, u), yb - 150 * Math.sin(2 * Math.PI * 1.5 * u)]);
      }
      f.pline(pts, CYAN, 2, 0.9, 0.5);
      f.dot(x1, yb, 5, ICE, 1, 0.8);
      if (ghost > 0.02) c.W.drawPlain(f, ICE, { alpha: 1.0, glowK: 0.35 });
      f.line(x0, yb, x1, yb, GREY, 1, 0.30);
    }

    // ② 波形 + 字形按 6px 步长共同采样为粒子池
    const pool = [];
    for (let i = 0; i < 260; i++) {
      const u = i / 259;
      pool.push([lerp(x0, x1, u), yb - 150 * Math.sin(2 * Math.PI * 1.5 * u)]);
    }
    for (const q of c.wpts) pool.push([q[0], q[1]]);
    if (t < 38.24) {
      c.W.drawPlain(f, () => ICE, {
        alpha: 1.0 - easeInCubic(phase(t, 38.24, 38.40)), glowK: 0.3,
      });
    }

    // ③ 中段 40% 点吸附成 12 条水平短棒 + 每条 1 颗静止点
    const snap = easeOutQuart(phase(t, 38.20, 38.46));
    const bars = [];
    for (let k = 0; k < 12; k++) {
      const st = 38.20 + k * 0.018;
      const p = easeOutQuart(clamp01((t - st) / 0.22));
      const bx = 0.30 * BASE_W + k * ((0.50 * BASE_W) / 11);
      const by = 0.40 * BASE_H + (k % 6) * ((0.30 * BASE_H) / 5)
        + 1.5 * Math.sin(2 * Math.PI * 0.7 * (t - 38.46) + k);
      const L = 90 + (k % 4) * 23;
      bars.push([bx, by, L, p]);
      f.line(bx - L / 2, by, bx - L / 2 + L * p, by, ICE, 3, 0.95, 0.6);
      if (p > 0.9) f.dot(bx, by, 4, BV, 0.9, 0.5);
    }
    const keep = [];
    for (let i = 0; i < pool.length; i++) if (i % 3 === 0) keep.push(pool[i]);
    keep.length = Math.min(keep.length, 600);
    const snapPts = [], snapA = [];
    for (let i = 0; i < keep.length; i++) {
      const tx = 0.30 * BASE_W + (i % 12) * ((0.50 * BASE_W) / 11);
      const ty = 0.40 * BASE_H + ((i % 12) % 6) * ((0.30 * BASE_H) / 5);
      snapPts.push([lerp(keep[i][0], tx, snap), lerp(keep[i][1], ty, snap)]);
      snapA.push(0.6);
    }
    f.pts(snapPts, 2.5, CYAN, 1, 0.4, BG_DEEP, snapA);
    f.line(x0, yb, x1, yb, GREY, 1, 0.30 * (1 - clamp01(phase(t, 38.46, 38.60))));

    // 主词按行消隐（延迟 40ms/行）
    if (t >= 38.24 && t < 38.60) {
      for (const g of c.W.chars) {
        const a = 1.0 - easeInCubic(phase(t, 38.24 + g.li * 0.04, 38.44 + g.li * 0.04));
        if (a > 0.02) {
          f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font, ICE, a, 0.3 * a, c.W.stroke);
        }
      }
    }
    const mf = fontOf('JetBrains Mono', 36, dpr);
    if (t >= 38.44) f.text(0.24 * BASE_W, 0.62 * BASE_H, 'seat:12', mf.font, GREY, 0.6);

    corners(f, 'T+37.93s', CHAPTER, `seed:${SEEDS.SHOT_033} · seats:12`, 'SEAT');
    const k = 0.42 + 0.08 * Math.sin(Math.PI * clamp01(phase(t, 38.20, 38.35)));
    return { bloomR: 8.0, bloomK: Math.min(0.5, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_034  `38.6–39.412` ｜ 12 条短棒 + 靠背锁死成 3 排座位
   ══════════════════════════════════════════════════════════════ */
const SHOT_034 = {
  id: 'SHOT_034', start: 38.6, end: 39.412,
  seedHex: SEEDS.SHOT_034, chapter: CHAPTER, status: 'ROW',
  lyric: 'Then you can sit on all my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['Then you can sit', 'on all my'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);

    // ① 12 条短棒 + 12 颗静止点锁死（Python 里逐根的 p 未参与绘制，此处不再计算）
    for (let k = 0; k < 12; k++) {
      const row = Math.floor(k / 4), col = k % 4;
      const L0 = 96 + (k % 5) * 16;
      const bx = 0.30 * BASE_W + col * ((0.42 * BASE_W) / 3) + (row === 0 ? 0.10 * BASE_W : 0);
      const by = 0.42 * BASE_H + row * 0.16 * BASE_H;
      const L = L0 * 0.86 ** row;
      f.line(bx - L / 2, by, bx + L / 2, by, ICE, 3, 0.95, 0.55);
      if (t >= 39.06) f.line(bx - L * 0.2, by - 18, bx + L * 0.2, by - 18, GREY, 2, 0.8);
      f.dot(bx, by, 4, BV, 0.9, 0.5);
    }

    // ④ 156 颗残余正弦点沿三条纵向走道排布
    const walk = easeInOutCubic(phase(t, 38.74, 39.06));
    const seed = SC.seed('SHOT_034');
    for (let i = 0; i < 156; i++) {
      const r = new Rng(seed, 'walk', i);
      const lane = i % 3;
      const tx = 0.30 * BASE_W + lane * ((0.42 * BASE_W) / 2) + r.range(-12, 12);
      const ty = 0.40 * BASE_H + r.range(0, 0.36 * BASE_H);
      const x0 = 0.30 * BASE_W + (i % 12) * ((0.50 * BASE_W) / 11);
      const y0 = 0.40 * BASE_H + r.range(0, 0.30 * BASE_H);
      f.dot(lerp(x0, tx, walk), lerp(y0, ty, walk), 2.5, CYAN, 0.55, 0.3);
    }

    // ⑤ 暖色献出标记（前排中点，唯一暖色）+ 地面投影线
    if (t >= 39.06) {
      const mx = 0.30 * BASE_W + 1.5 * ((0.42 * BASE_W) / 3), my = 0.42 * BASE_H;
      const flash = Math.floor((t - 39.06) / 0.09) % 2 === 0 ? 1.0 : 0.4;
      f.ell(mx, my, 7, 7, WARM, 2, flash, 1.0);
      f.line(mx, my + 8, mx, my + 34, WARM, 1, 0.6);
      for (let i = 0; i < 3; i++) {
        f.line(0.28 * BASE_W, 0.76 * BASE_H + i * 6, 0.84 * BASE_W, 0.76 * BASE_H + i * 6,
               GREY, 1, 0.20);
      }
    }

    // 阶段 4：阵列整体浮沉（亮度 +12% 由 bloom 抬升体现）
    if (t >= 39.28) {
      f.rect(0.26 * BASE_W, 0.34 * BASE_H, 0.88 * BASE_W, 0.80 * BASE_H, ICE, 0, 1, 0, ICE, 0.03);
    }

    // 主词
    c.W.draw(f, t, {
      t0: 38.60, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => (t >= 39.06 && li === 0 && ci >= 9 && ci <= 11 ? CYAN : ICE),
      glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.86 * BASE_W, 0.46 * BASE_H, 'rows:3 · seats:12', mf.font, GREY, 0.55);

    corners(f, 'T+38.60s', CHAPTER, `seed:${SEEDS.SHOT_034} · seats:12`, 'ROW');
    return { bloomR: 8.0, bloomK: 0.35, grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_035  `39.412–40.05` ｜ 3,256 点分流吸附 512 带位 + 64 切线
   ══════════════════════════════════════════════════════════════ */
const SHOT_035 = {
  id: 'SHOT_035', start: 39.412, end: 40.05,
  seedHex: SEEDS.SHOT_035, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Then you can sit on all my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['Then you can sit', 'on all my'];
    const seed = SC.seed('SHOT_035');
    const pool = [];
    for (const q of textPoints(LINES, 160, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                               [0.10, 0.26], CAM.LINE_STEP_160, { step: 4, n: 2400 })) {
      pool.push([q[0], q[1]]);
    }
    for (let i = 0; i < 700; i++) {
      const r = new Rng(seed, 'bar', i);
      pool.push([0.30 * BASE_W + r.range(0, 0.52 * BASE_W),
                 0.40 * BASE_H + r.range(0, 0.32 * BASE_H)]);
    }
    for (let i = 0; i < 156; i++) {
      const r = new Rng(seed, 'res', i);
      pool.push([0.30 * BASE_W + r.range(0, 0.44 * BASE_W),
                 0.40 * BASE_H + r.range(0, 0.30 * BASE_H)]);
    }
    this._c = {
      pool,
      W: new Word(ctx, LINES, 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.56 * BASE_H;

    const ghost = 1.0 - clamp01(phase(t, 39.50, 39.56));
    if (ghost > 0.02) c.W.drawPlain(f, () => ICE, { alpha: ghost, glowK: 0.35 * ghost });

    // ① 阵列残留 3×4 框线亮 1 次
    if (t < 39.62) {
      const ra = 0.12 * (1 - clamp01(phase(t, 39.50, 39.62)));
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const bx = 0.30 * BASE_W + col * ((0.42 * BASE_W) / 3) + (row === 0 ? 0.10 * BASE_W : 0);
          const by = 0.42 * BASE_H + row * 0.16 * BASE_H;
          f.rect(bx - 60, by - 32, bx + 60, by + 12, GREY, 1, ra);
        }
      }
    }

    // ② 分流吸附到 512 带位 + 64 根短线位（逐列 6ms）
    const p3 = easeInOutCubic(phase(t, 39.62, 39.94));
    const dp = [], al = [];
    for (let i = 0; i < c.pool.length; i++) {
      const x = c.pool[i][0], y = c.pool[i][1];
      const col = i % 64;
      const st = 39.62 + col * 0.006;
      const pp = easeInOutCubic(clamp01((t - st) / 0.26));
      const tx = 0.08 * BASE_W + (i % 512) * ((0.84 * BASE_W) / 511);
      const ty = yb + Math.sin(((i % 512) / 511) * Math.PI * 6) * 72;
      dp.push([lerp(x, tx, pp * 0.6 + p3 * 0.4), lerp(y, ty, pp)]);
      al.push(0.7 * (1 - 0.4 * p3));
    }
    f.pts(dp, 2.5, CYAN, 1, 0.4, BG_DEEP, al);
    const sub = [], subA = [];
    for (let i = 0; i < dp.length; i += 3) { sub.push(dp[i]); subA.push(0.5); }
    f.pts(sub, 2.0, ICE, 1, 0.35, BG_DEEP, subA);

    // 切线雏形 64 根（±5° 单摆）
    const sw = 5.0 * Math.sin(Math.PI * clamp01(phase(t, 39.94, 40.05)));
    for (let k = 0; k < 64; k++) {
      const bx = 0.08 * BASE_W + k * ((0.84 * BASE_W) / 63);
      const slope = Math.cos((k / 63) * Math.PI * 6) * 0.4;
      const angr = Math.atan(slope) + rad(sw);
      f.line(bx - 20 * Math.cos(angr), yb - 20 * Math.sin(angr),
             bx + 20 * Math.cos(angr), yb + 20 * Math.sin(angr), BV, 2, 0.55, 0.4);
    }
    f.dot(0.12 * BASE_W, yb, 4, WARM, 1, 1.0);
    const mf = fontOf('JetBrains Mono', 36, dpr);
    if (t < 39.47) f.text(0.86 * BASE_W, 0.46 * BASE_H, 'rows:3 · seats:12', mf.font, GREY, 0.55);
    const mf2 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 39.92) f.text(0.78 * BASE_W, 0.88 * BASE_H, 'MORPH→tan', mf2.font, GREY, 0.6);

    corners(f, 'T+39.41s', CHAPTER, `seed:${SEEDS.SHOT_035} · sample:4px · 3400pt`, 'MORPH');
    const k = 0.35 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 39.62, 39.80)));
    return { bloomR: 8.0, bloomK: Math.min(0.50, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_036  `40.05–40.71` ｜ TANGENTS：512 点曲线 + 28 条切线扇
   ══════════════════════════════════════════════════════════════ */
const SHOT_036 = {
  id: 'SHOT_036', start: 40.05, end: 40.71,
  seedHex: SEEDS.SHOT_036, chapter: CHAPTER, status: 'TAN',
  lyric: 'TANGENTS',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['TANGENTS'], 240, {
        weight: 'Inter Extra-Bold', trackEm: 0.10, dpr: 1, h: 'center',
        v: 'baseline_first', anchor: [0.50, 0.28],
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.62 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;
    const K = 2 * Math.PI * 1.25;

    // ① 512 点闭合成连续曲线
    const curve = [];
    for (let i = 0; i < 512; i++) {
      const u = i / 511;
      curve.push([lerp(x0, x1, u), yb - 96 * Math.sin(K * u)]);
    }
    f.pline(curve, CYAN, 2, 0.95, 0.6);

    // ② derivative fan：移动点 12%→78%，每 10ms 一条，累计 28 条
    const mot = lerp(0.12, 0.78, clamp01(phase(t, 40.14, 40.44)));
    const mx = lerp(x0, x1, mot), my = yb - 96 * Math.sin(K * mot);
    f.dot(mx, my, 5, ICE, 1, 1.0);
    f.line(mx - 16, my, mx, my, ICE, 2, 0.9, 0.6);
    for (let k = 0; k < 28; k++) {
      const st = 40.14 + k * 0.010;
      if (t < st) continue;
      const u = lerp(0.12, 0.78, k / 27.0);
      const px = lerp(x0, x1, u), py = yb - 96 * Math.sin(K * u);
      const slope = -96 * (K / (x1 - x0)) * Math.cos(K * u);
      const ang = Math.atan(slope) + rad(4 * Math.sin(2 * Math.PI * 0.9 * (t - 40.60)));
      const aL = lerp(0.75, 0.12, clamp01((t - st) / 0.30));
      f.line(px - 190 * Math.cos(ang), py - 190 * Math.sin(ang),
             px + 190 * Math.cos(ang), py + 190 * Math.sin(ang), BV, 1.5, aL, 0.3);
    }

    // ③ 主词 8 字逐字上浮（18ms/字）+ 引导线 + 字形切线
    for (let gi = 0; gi < c.W.chars.length; gi++) {
      const g = c.W.chars[gi];
      const st = 40.44 + gi * 0.018;
      if (t < st) continue;
      const p = easeOutCubic(phase(t, st, st + 0.12));
      const col = t >= 40.50 && g.ci < 3 ? BV : ICE;
      // JS 的 Frame.text 以**基线**为 y（Python 的 f.text 才是上行顶端）：
      // 此处不可再减 asc，否则整词会上移一个 ascent（240px ≈ 180px）并顶出画布上边缘
      const gx = g.x / dpr, gy = g.baseline / dpr;
      f.text(gx, gy + (1 - p) * 10, g.ch, c.W.font, col, p, 0.35 * p, c.W.stroke);
      if (t >= st + 0.012) {
        const gp = easeOutCubic(phase(t, st + 0.012, st + 0.10));
        const u = 0.10 + 0.80 * (g.ci / 7.0);
        const ax = lerp(x0, x1, u);
        const ay = yb - 96 * Math.sin(K * u);
        f.line(lerp(gx, ax, gp), lerp(gy + 240, ay, gp), ax, ay, GREY, 1, 0.30);
        if (gp > 0.9) {
          const slope = -96 * (K / (x1 - x0)) * Math.cos(K * u);
          const ang = Math.atan(slope);
          f.line(ax - 150 * Math.cos(ang), ay - 150 * Math.sin(ang),
                 ax + 150 * Math.cos(ang), ay + 150 * Math.sin(ang), ICE, 2, 0.9, 0.5);
          f.ell(ax + 150 * Math.cos(ang), ay + 150 * Math.sin(ang), 5, 5, WARM, 1.5, 0.9, 1.0);
          f.ell(ax - 150 * Math.cos(ang), ay - 150 * Math.sin(ang), 5, 5, WARM, 1.5, 0.9, 1.0);
        }
      }
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(x1 - 420, yb - 140, "f'(x) = A·k·cos(kx)", mf.font, GREY, 0.55);

    corners(f, 'T+40.05s', CHAPTER, `seed:${SEEDS.SHOT_036} · tan:36`, 'TAN');
    return {
      bloomR: 9.0,
      bloomK: 0.38 + 0.06 * bpulse(t, beatsIn(beats, this.start, this.end), 0.06, 1.0),
      grain: 5.0,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_037  `40.71–41.6284` ｜ 灭点 20 条纵深线 + 14 道横截框推进
   ══════════════════════════════════════════════════════════════ */
const SHOT_037 = {
  id: 'SHOT_037', start: 40.71, end: 41.6284,
  seedHex: SEEDS.SHOT_037, chapter: CHAPTER, status: 'INF',
  lyric: 'If I approach infinity',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['If I approach', 'infinity'], 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: 1.04 * 168,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const vx = 0.50 * BASE_W, vy = 0.44 * BASE_H;
    const pull = easeInOutQuad(phase(t, 40.71, 40.90));

    // ① 20 条纵深线自灭点向下缘辐射（夹角 ±34°）
    for (let k = 0; k < 20; k++) {
      const ang = rad(-34 + (68 * k) / 19);
      f.line(vx, vy, vx + 1800 * Math.sin(ang), vy + 1800 * Math.cos(ang), BV, 1.5,
             0.9 * pull, 0.4);
    }
    f.dot(vx, vy, 5, ICE, 1, 1.0);

    // ② 14 道横截框按 z=1/n 放大外移（dolly through grid，linear）
    const zflow = clamp01(phase(t, 40.90, 41.40));
    const speedup = t >= 41.55 ? 1.6 : 1.0;
    for (let n = 1; n < 15; n++) {
      let z = pymod(zflow * speedup * 2.2 + n * 0.12, 1.0);
      z = 0.05 + 0.95 * z;
      const w = lerp(0.06, 1.0, z) * BASE_W;
      const h = lerp(0.05, 1.0, z) * BASE_H;
      f.rect(vx - w / 2, vy - h / 2 + h * 0.25, vx + w / 2, vy + h / 2 + h * 0.25,
             GREY, 1, 0.35);
    }

    // ③ 坐标标签 9 枚自灭点飞出缩小
    const lf = fontOf('JetBrains Mono', 44, dpr);
    const labels = ['yr:2099', 'z:1.0e+3', 'yr:∞', 'z:2.4e+2', 'yr:4096', 'z:8.1e+1',
                    'yr:1024', 'z:1.6e+1', 'yr:∞'];
    for (let k = 0; k < labels.length; k++) {
      const ph = pymod(((t - 40.90) * 0.55) / speedup + k / 9.0, 1.0);
      const scale = lerp(1.0, 0.41, ph);
      const px = vx + (k - 4) * 120 * (1 - ph) * 2.0;
      const py = vy + 60 + ph * 380;
      if (scale > 0.42) f.text(px - 60 * scale, py, labels[k], lf.font, CYAN, 0.5 * (1 - ph));
    }

    // ④ 地面节点 8×6=48 枚 2px 沿走廊推进
    const seed = SC.seed('SHOT_037');
    for (let i = 0; i < 48; i++) {
      void new Rng(seed, 'node', i);
      const col = i % 8, row = Math.floor(i / 8);
      const baseX = -0.5 + col / 7.0;
      const z = pymod((t - 40.90) * 0.5 + row / 6.0, 1.0);
      const depth = 0.06 + 0.94 * z;
      f.dot(vx + baseX * 0.34 * BASE_W * depth, vy + 260 * depth,
            2 * depth + 1, CYAN, 0.5 + 0.4 * z, 0.4);
    }

    // 起点残迹：8 条字形切线融入纵深线
    for (let k = 0; k < 8; k++) {
      f.line(vx - 300 + k * 86, 0.62 * BASE_H, vx - 300 + k * 86, 0.62 * BASE_H - 60, ICE, 2,
             0.3 * (1 - clamp01(phase(t, 40.71, 40.90))));
    }

    // 主词（12ms/字符错峰，infinity 变色 + 1.04 脉冲）
    const bs = beatsIn(beats, this.start, this.end);
    const pulseS = t >= 41.28 ? 1.0 + bpulse(t, bs, 0.08, 0.04) : 1.0;
    for (let gi = 0; gi < c.W.chars.length; gi++) {
      const g = c.W.chars[gi];
      const st = 41.40 + gi * 0.012;
      if (t < st) continue;
      const p = easeOutCubic(phase(t, st, st + 0.10));
      const col = t >= 41.28 && g.li === 1 ? CYAN : ICE;
      const xx = 0.10 * BASE_W + (g.x / dpr - 0.10 * BASE_W) * (g.li === 1 ? pulseS : 1.0);
      f.text(xx, g.baseline / dpr + (1 - p) * 8, g.ch, c.W.font, col, p, 0.35 * p, c.W.stroke);
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(0.86 * BASE_W, 0.70 * BASE_H, 'approach:Δz→∞', mf.font, GREY, 0.55);

    corners(f, 'T+40.71s', CHAPTER, `seed:${SEEDS.SHOT_037} · z:∞ · grid:14`, 'INF');
    return {
      bloomR: 8.0,
      bloomK: 0.30 + 0.20 * ringNearPct(t, [41.28], 0.2),
      grain: 5.0,
      scan: 0.06,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_038  `41.6284–42.35` ｜ 走廊衰减 + 3,648 点吸附 420×300 边界框
   ══════════════════════════════════════════════════════════════ */
const SHOT_038 = {
  id: 'SHOT_038', start: 41.6284, end: 42.35,
  seedHex: SEEDS.SHOT_038, chapter: CHAPTER, status: 'MORPH',
  lyric: 'If I approach infinity',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['If I approach', 'infinity'];
    const pts = [];
    for (const q of textPoints(LINES, 168, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                               [0.10, 0.26], 1.04 * 168, { step: 4, n: 3600 })) {
      pts.push([q[0], q[1]]);
    }
    const seed = SC.seed('SHOT_038');
    for (let i = 0; i < 48; i++) {
      const r = new Rng(seed, 'nd', i);
      pts.push([r.range(0.2, 0.8) * BASE_W, r.range(0.5, 0.7) * BASE_H]);
    }
    this._c = {
      pts,
      W: new Word(ctx, LINES, 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: 1.04 * 168,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const vx = 0.50 * BASE_W, vy = 0.44 * BASE_H;
    const bx = 0.50 * BASE_W, by = 0.50 * BASE_H;

    // ① 走廊推进衰减至 0，末 3 道横截框越出画外
    const dec = 1.0 - easeOutExpo(phase(t, 41.63, 41.86));
    const lineA = 0.9 * (1 - clamp01(phase(t, 41.86, 42.06)));
    for (let k = 0; k < 20; k++) {
      const ang = rad(-34 + (68 * k) / 19);
      f.line(vx, vy, vx + 1800 * Math.sin(ang) * (1 + 0.4 * dec),
             vy + 1800 * Math.cos(ang) * (1 + 0.4 * dec), BV, 1.5, lineA * 0.5, 0.3);
    }
    for (let n = 0; n < 3; n++) {
      const y = 1.02 * BASE_H + n * 0.16 * BASE_H - dec * 0.6 * BASE_H;
      f.rect(0.02 * BASE_W, y - 40, 0.98 * BASE_W, y + 40, GREY, 1, 0.3 * dec);
    }

    // ② 主词 + 48 地面节点按 4px 步长采样 3,648 点
    const ghost = 1.0 - clamp01(phase(t, 41.86, 41.92));
    if (ghost > 0.02) c.W.drawPlain(f, () => ICE, { alpha: ghost, glowK: 0.4 * ghost });

    // ③ 奇偶分流吸附到 420×300 边界框四边（逐边 20ms，超冲 4% 回弹）
    const BW = 420.0, BH = 300.0;
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const x = c.pts[i][0], y = c.pts[i][1];
      const edge = i % 4;
      const st = 42.06 + edge * 0.02;
      const p = easeOutBackK(clamp01((t - st) / 0.20), 1.56);
      let tx, ty;
      if (edge === 0) { tx = bx - BW / 2 + (i % 60) * (BW / 59); ty = by - BH / 2; }
      else if (edge === 1) { tx = bx + BW / 2; ty = by - BH / 2 + (i % 50) * (BH / 49); }
      else if (edge === 2) { tx = bx + BW / 2 - (i % 60) * (BW / 59); ty = by + BH / 2; }
      else { tx = bx - BW / 2; ty = by + BH / 2 - (i % 50) * (BH / 49); }
      dp.push([lerp(x, tx, p), lerp(y, ty, p)]);
      al.push(0.7);
    }
    f.pts(dp, 2.5, ICE, 1, 0.5, BG_DEEP, al);

    // ④ 虚线边界框 + 四角标记 + 框心孤立暖点
    if (t >= 42.06) {
      f.rect(bx - BW / 2, by - BH / 2, bx + BW / 2, by + BH / 2, BV, 2, 0.9, 0.5,
             null, 0, BG_DEEP, 10);
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const cx = bx + sx * BW / 2, cy = by + sy * BH / 2;
          f.line(cx, cy, cx - sx * 14, cy, ICE, 2, 0.9, 0.5);
          f.line(cx, cy, cx, cy - sy * 14, ICE, 2, 0.9, 0.5);
        }
      }
      const jx = 2.0 * Math.sin(2 * Math.PI * 0.8 * (t - 42.26));
      const jy = 2.0 * Math.cos(2 * Math.PI * 0.8 * (t - 42.26));
      const pu = 1.0 + 0.1 * Math.sin(Math.PI * clamp01(phase(t, 42.26, 42.35)));
      f.dot(bx + jx, by + jy, 8 * pu, WARM, 1, 1.0);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI * 2) / 6;
      f.line(bx + 220 * Math.cos(a), by + 160 * Math.sin(a),
             bx + 210 * Math.cos(a), by + 150 * Math.sin(a), GREY, 1,
             0.15 * (1 - clamp01(phase(t, 42.06, 42.35))));
    }
    const mf2 = fontOf('JetBrains Mono', 46, dpr);
    if (t < 41.80) f.text(0.86 * BASE_W, 0.70 * BASE_H, 'approach:Δz→∞', mf2.font, GREY, 0.55);
    const mf3 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 42.20) f.text(0.86 * BASE_W, 0.90 * BASE_H, 'bound:rect', mf3.font, GREY, 0.6);

    corners(f, 'T+41.63s', CHAPTER, `seed:${SEEDS.SHOT_038} · sample:4px · 3648pt`, 'MORPH');
    const k = 0.40 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 42.06, 42.20)));
    return { bloomR: 8.0, bloomK: Math.min(0.52, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_039  `42.35–43.51` ｜ 框平移弹到 440×300 + 移动点两度逼近
   ══════════════════════════════════════════════════════════════ */
const SHOT_039 = {
  id: 'SHOT_039', start: 42.35, end: 43.51,
  seedHex: SEEDS.SHOT_039, chapter: CHAPTER, status: 'BOUND',
  lyric: 'Then you can be my',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['Then you can be', 'my'];
    this._c = {
      W: new Word(ctx, LINES, 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.24], lineStep: CAM.LINE_STEP_160,
      }),
      pts: textPoints(LINES, 160, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                      [0.10, 0.24], CAM.LINE_STEP_160, { step: 4, n: 900 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const PATH = [[0.18 * BASE_W, 0.80 * BASE_H], [0.28 * BASE_W, 0.66 * BASE_H],
                  [0.34 * BASE_W, 0.54 * BASE_H], [0.50 * BASE_W, 0.42 * BASE_H],
                  [0.66 * BASE_W, 0.50 * BASE_H], [0.78 * BASE_W, 0.62 * BASE_H],
                  [0.62 * BASE_W, 0.72 * BASE_H]];

    // ① 边界框平移 + 弹到 440×300
    const mv = easeOutBackK(phase(t, 42.35, 42.52), 1.3);
    let bx = lerp(0.50 * BASE_W, 0.58 * BASE_W, mv);
    let by = lerp(0.50 * BASE_H, 0.52 * BASE_H, mv);
    let BW = lerp(420, 440.0, mv);
    const BH = 300.0;

    // ② 移动点沿三段折线两度逼近框边（260px/s）
    const seg = clamp01(phase(t, 42.52, 43.00));
    const fi = seg * (PATH.length - 1);
    const i0 = Math.min(PATH.length - 2, Math.floor(fi));
    const frac = fi - i0;
    let dpx = lerp(PATH[i0][0], PATH[i0 + 1][0], frac);
    let dpy = lerp(PATH[i0][1], PATH[i0 + 1][1], frac);
    if (t >= 43.00) {
      const back = easeInOutSine(phase(t, 43.00, 43.32));
      dpx = lerp(PATH[PATH.length - 1][0], 0.72 * BASE_W, back);
      dpy = lerp(PATH[PATH.length - 1][1], 0.74 * BASE_H, back);
    }
    const d = Math.max(Math.abs(dpx - bx) - BW / 2, Math.abs(dpy - by) - BH / 2, 0.0) * 0.45 + 48;
    let resp = d < 80 ? 1.12 : 1.0;
    if (t >= 43.00) resp = lerp(1.12, 1.0, easeInOutSine(phase(t, 43.00, 43.32)));
    const w2 = BW * resp;
    const h2 = BH * (1 + (resp - 1) * 0.5);

    // ③ 框 + 距离射线 + 幽灵字
    f.rect(bx - w2 / 2, by - h2 / 2, bx + w2 / 2, by + h2 / 2, BV, 2, 0.9, 0.5,
           null, 0, BG_DEEP, 10);
    for (let k = 0; k < 4; k++) {
      const sx = k % 2 === 0 ? -1 : 1;
      const sy = k < 2 ? -1 : 1;
      const cx = bx + (sx * w2) / 2, cy = by + (sy * h2) / 2;
      if (t >= 43.32 + k * 0.02) {
        f.line(cx, cy, cx - sx * 14, cy, ICE, 2, 0.9, 0.5);
        f.line(cx, cy, cx, cy - sy * 14, ICE, 2, 0.9, 0.5);
      }
    }
    for (let k = 0; k < 6; k++) {
      const ax = bx - w2 / 2 + (k + 1) * (w2 / 7);
      f.line(ax, by, dpx, dpy, GREY, 1, 0.30);
    }
    const lf = fontOf('JetBrains Mono', 48, dpr);
    f.text(bx - 60, by - 30, 'my', lf.font, ICE, 0.40);
    f.dot(dpx, dpy, 8, WARM, 1, 1.0);
    for (let k = 0; k < 9; k++) {
      f.dot(lerp(dpx, PATH[i0][0], k / 9), lerp(dpy, PATH[i0][1], k / 9), 3, WARM,
            0.9 * (1 - k / 9), 0.4);
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(dpx + 20, dpy - 30, `d:${Math.trunc(d)}px`, mf.font, CYAN, 0.85);

    // ④ 主词（43.32 起采样并入框边，43.44 起微字先淡出）
    const fade = 1.0 - clamp01(phase(t, 43.44, 43.51));
    if (fade > 0.02) {
      for (const g of c.W.chars) {
        const col = t >= 43.10 && g.li === 1 ? MOOD : ICE;
        f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font, col, fade, 0.35 * fade, c.W.stroke);
      }
    }
    if (t >= 43.32) {
      const pp = clamp01(phase(t, 43.32, 43.51));
      const moved = [], al = [];
      for (let i = 0; i < c.pts.length; i++) {
        moved.push([lerp(c.pts[i][0], bx - w2 / 2 + (i % 40) * (w2 / 39), pp),
                    lerp(c.pts[i][1], by - h2 / 2, pp)]);
        al.push(0.5 * (1 - pp));
      }
      f.pts(moved, 2, ICE, 1, 0.3, BG_DEEP, al);
    }

    corners(f, 'T+42.35s', CHAPTER, `seed:${SEEDS.SHOT_039} · d:min:48`, 'BOUND',
            0.6 * fade + 0.01);
    return { bloomR: 8.0, bloomK: 0.38, grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_040  `43.51–44.45` ｜ 无限网格 24×14 + 900 颗粒子堤 + LIMITATIONS
   ══════════════════════════════════════════════════════════════ */
const SHOT_040 = {
  id: 'SHOT_040', start: 43.51, end: 44.45,
  seedHex: SEEDS.SHOT_040, chapter: CHAPTER, status: 'CLAMP',
  lyric: 'LIMITATIONS',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    // 11 字母宽度（基准像素，dpr=1 度量）
    const fnt = fontOf('Inter Bold', 168, 1);
    ctx.save();
    ctx.font = fnt.font;
    const word = 'LIMITATIONS';
    const adv = [];
    for (const ch of word) adv.push(ctx.measureText(ch).width);
    ctx.restore();
    this._c = { word, adv };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const bx = 0.50 * BASE_W, by = 0.52 * BASE_H;
    const FW = 1320.0, FH = 260.0;

    // ① 框虚线转实线 + 内衬（框已居中，mv 在 Python 中未参与绘制）
    f.rect(bx - FW / 2, by - FH / 2, bx + FW / 2, by + FH / 2, ICE, 2, 0.9, 0.6,
           null, 0, BG_DEEP, 14);
    f.rect(bx - FW / 2 + 4, by - FH / 2 + 4, bx + FW / 2 - 4, by + FH / 2 - 4, CYAN, 1, 0.6);
    for (let k = 0; k < 4; k++) {
      const sx = k % 2 === 0 ? -1 : 1;
      const sy = k < 2 ? -1 : 1;
      if (t >= 43.51 + k * 0.02) {
        const cx = bx + (sx * FW) / 2, cy = by + (sy * FH) / 2;
        f.line(cx, cy, cx - sx * 14, cy, CYAN, 2, 0.9, 0.5);
        f.line(cx, cy, cx, cy - sy * 14, CYAN, 2, 0.9, 0.5);
      }
    }

    // ② 无限网格 24×14 自画外推入
    const gp = easeOutQuint(phase(t, 43.68, 44.02));
    for (let i = 0; i < 25; i++) {
      const xx = lerp(0.02 * BASE_W, 0.98 * BASE_W, i / 24) * (0.6 + 0.4 * gp);
      f.line(xx, 0.04 * BASE_H, xx, 0.96 * BASE_H, GREY, 1, 0.30 * gp);
    }
    for (let j = 0; j < 15; j++) {
      const yy = lerp(0.04 * BASE_H, 0.96 * BASE_H, j / 14);
      f.line(0.02 * BASE_W, yy, 0.98 * BASE_W, yy, GREY, 1, 0.30 * gp);
    }

    // ③ 粒子堤 900 颗在框外 12px 内堆积（逐列 8ms）
    const seed = SC.seed('SHOT_040');
    for (let i = 0; i < 900; i++) {
      const r = new Rng(seed, 'pile', i);
      const col = i % 60;
      const st = 43.68 + col * 0.008;
      const p = easeOutQuint(clamp01((t - st) / 0.24));
      const side = i % 4;
      let tx, ty;
      if (side === 0) {
        tx = bx - FW / 2 + (i % 60) * (FW / 59);
        ty = by - FH / 2 - 12 - r.range(0, 44);
      } else if (side === 1) {
        tx = bx + FW / 2 + 12 + r.range(0, 44);
        ty = by - FH / 2 + (i % 50) * (FH / 49);
      } else if (side === 2) {
        tx = bx + FW / 2 - (i % 60) * (FW / 59);
        ty = by + FH / 2 + 12 + r.range(0, 44);
      } else {
        tx = bx - FW / 2 - 12 - r.range(0, 44);
        ty = by + FH / 2 - (i % 50) * (FH / 49);
      }
      const d0 = r.range(1.6, 3.0);
      const x0 = bx + (tx - bx) * 2.4;
      const y0 = by + (ty - by) * 2.4;
      f.dot(lerp(x0, tx, p), lerp(y0, ty, p), d0, CYAN,
            (i % 5 ? 1.0 : 0.6) * 0.85, 0.4);
    }

    // ④ 主词 11 字自中心向两侧展开（22ms/字），首末字母被夹压 6%
    //    单位纪律：adv 为基准像素，布局一律在基准坐标内完成
    const inner = FW - 60;
    const adv = c.adv;
    const wsum = adv.reduce((a, v) => a + v, 0);
    const track = (inner - wsum) / (c.word.length - 1);
    const total = wsum + track * (c.word.length - 1);
    const xs = [];
    let acc = bx - total / 2;
    for (const a of adv) { xs.push(acc); acc += a + track; }
    const fnt = fontOf('Inter Bold', 168, dpr);
    for (let ci = 0; ci < c.word.length; ci++) {
      const st = 44.02 + Math.abs(ci - 5) * 0.022;
      if (t < st) continue;
      const p = easeOutCubic(phase(t, st, st + 0.12));
      const squeeze = ci > 0 && ci < c.word.length - 1 ? 1.0 : 0.94;
      const ch = c.word[ci];
      if (squeeze !== 1.0) {
        // PIL：字形位图横向压到 94% 后贴回（fx = 原 x + 压缩量的一半）
        const fx = xs[ci] + (adv[ci] * (1 - squeeze)) / 2;
        ctx.save();
        ctx.translate(fx * dpr, (by - 60) * dpr);
        ctx.scale(squeeze, 1);
        ctx.font = fnt.font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = css(ICE);
        ctx.globalAlpha = clamp01(p);
        ctx.fillText(ch, 0, 0);
        if (fnt.stroke > 0) {
          ctx.strokeStyle = css(ICE);
          ctx.lineWidth = fnt.stroke;
          ctx.strokeText(ch, 0, 0);
        }
        ctx.restore();
      } else {
        f.text(xs[ci], by - 60, ch, fnt.font, ICE, p, 0.4 * p, fnt.stroke);
      }
    }

    // 压力刻线闪 2 次
    if (t >= 44.30 && Math.floor((t - 44.30) / 0.09) % 2 === 0) {
      f.line(bx - FW / 2, by - 60, bx - FW / 2, by + 40, WARM, 10, 0.9, 1.0);
      f.line(bx + FW / 2, by - 60, bx + FW / 2, by + 40, WARM, 10, 0.9, 1.0);
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(bx + FW / 2 - 180, by - FH / 2 - 70, 'Δx:−6%', mf.font, GREY, 0.6);

    corners(f, 'T+43.51s', CHAPTER, `seed:${SEEDS.SHOT_040} · pile:900`, 'CLAMP');
    return {
      bloomR: 8.0,
      bloomK: 0.42 + bpulse(t, beatsIn(beats, this.start, this.end), 0.06, 0.06),
      grain: 5.0,
      scan: 0.05,
    };
  },
};

/** 圆角矩形回路的周长参数化（Python: _loop_path，用于电流粒子切向行进） */
function loopPath(cx, cy, w, h, n, rad = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const s = u * (2 * (w - 2 * rad) + 2 * (h - 2 * rad) + 2 * Math.PI * rad);
    if (s < w - 2 * rad) {
      pts.push([cx - w / 2 + rad + s, cy - h / 2]);
    } else if (s < w - 2 * rad + (Math.PI * rad) / 2) {
      const a = (s - (w - 2 * rad)) / rad;
      pts.push([cx + w / 2 - rad + rad * Math.sin(a), cy - h / 2 + rad - rad * Math.cos(a)]);
    } else if (s < w - 2 * rad + (Math.PI * rad) / 2 + (h - 2 * rad)) {
      pts.push([cx + w / 2, cy - h / 2 + rad + (s - (w - 2 * rad) - (Math.PI * rad) / 2)]);
    } else if (s < w - 2 * rad + Math.PI * rad + (h - 2 * rad)) {
      const a = (s - (w - 2 * rad) - (Math.PI * rad) / 2 - (h - 2 * rad)) / rad;
      pts.push([cx + w / 2 - rad + rad * Math.cos(a), cy + h / 2 - rad + rad * Math.sin(a)]);
    } else if (s < 2 * (w - 2 * rad) + Math.PI * rad + (h - 2 * rad)) {
      pts.push([cx + w / 2 - rad - (s - (w - 2 * rad) - Math.PI * rad - (h - 2 * rad)),
                cy + h / 2]);
    } else {
      pts.push([cx - w / 2 + rad, cy + h / 2 - rad]);
    }
  }
  return pts;
}

/* ══════════════════════════════════════════════════════════════
   SHOT_041  `44.45–45.234` ｜ 回路 + 180 电流粒子 + 拨杆换向
   ══════════════════════════════════════════════════════════════ */
const SHOT_041 = {
  id: 'SHOT_041', start: 44.45, end: 45.234,
  seedHex: SEEDS.SHOT_041, chapter: CHAPTER, status: 'SWITCH',
  lyric: 'Switch my current',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const seed = SC.seed('SHOT_041');
    const cur = [];
    for (let i = 0; i < 180; i++) cur.push(new Rng(seed, 'cur', i).next());
    this._c = {
      cur,
      W: new Word(ctx, ['Switch my', 'current'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.22], lineStep: CAM.LINE_STEP_160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const LR = 960.0, TB = 560.0;
    const flip = t >= 45.00;
    const lineCol = flip ? CYAN : ICE;

    // ① 框自 1320×260 拉伸到 960×560 回路
    const stretch = easeOutQuad(phase(t, 44.45, 44.62));
    const w = lerp(1320, LR, stretch);
    const h = lerp(260, TB, stretch);
    f.rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, lineCol, 2, 0.9, 0.7,
           null, 0, BG_DEEP, lerp(14, 40, stretch));

    // ② 12 焊点 + 180 电流粒子（沿回路切向，拖尾 10px）
    const path = loopPath(cx, cy, w, h, 200, Math.max(8.0, 40 * stretch));
    const direction = flip ? -1.0 : 1.0;
    for (let k = 0; k < 12; k++) {
      const q = path[Math.floor((k / 12.0) * path.length) % path.length];
      if (t >= 44.62 + k * 0.012) f.ell(q[0], q[1], 5, 5, BV, 1.5, 0.9, 0.5);
    }
    for (let i = 0; i < 180; i++) {
      const ph = c.cur[i];
      const idx = Math.floor(pymod(ph + direction * (t - 44.45) * 0.22, 1.0) * path.length);
      const px = path[idx][0], py = path[idx][1];
      f.line(px - 10, py, px, py, ICE, 1, 0.7, 0.5);
      f.dot(px, py, 2, ICE, 0.9, 0.6);
    }

    // ③ 拨杆开关（+38° → −38°）+ 两端暖色触点
    const swX = cx, swY = cy - h / 2;
    const ang = rad(flip ? -38 : 38);
    f.line(swX - 28, swY, swX + 28, swY, ICE, 3, 0.9, 0.5);
    f.line(swX, swY, swX + 48 * Math.sin(ang), swY - 48 * Math.cos(ang), ICE, 3, 0.95, 0.6);
    for (const k of [-1, 1]) f.ell(swX + k * 28, swY, 6, 6, WARM, 2, 0.95, 1.0);
    if (flip && t <= 45.06) f.dot(swX, swY - 48, 8, WARM, 0.6, 1.0);

    // ④ 8 枚方向箭头（换向整体翻转）
    for (let k = 0; k < 8; k++) {
      const u = k / 8.0 + 0.1 * (t - 44.45) * direction;
      const idx = Math.floor(pymod(u, 1.0) * path.length);
      const px = path[idx][0], py = path[idx][1];
      const nx = path[(idx + 2) % path.length][0], ny = path[(idx + 2) % path.length][1];
      const dxx = nx - px, dyy = ny - py;
      const L = Math.hypot(dxx, dyy) || 1.0;
      f.line(px, py, px + (dxx / L) * 12, py + (dyy / L) * 12, CYAN, 1, 0.30);
    }

    // 主词
    c.W.draw(f, t, {
      t0: 44.45, stagger: 0.012, dur: 0.10, dy: 8, ease: easeOutCubic,
      color: (li) => (t >= 44.70 && li === 1 ? CYAN : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(0.84 * BASE_W, 0.50 * BASE_H, 'I:0 → I:1', mf.font, GREY, 0.55);

    corners(f, 'T+44.45s', CHAPTER, `seed:${SEEDS.SHOT_041} · nodes:12 · flow:180`, 'SWITCH');
    const k = 0.38 + (flip && t <= 45.10 ? 0.10 : 0.0);
    return { bloomR: 8.0, bloomK: k, grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_042  `45.234–45.85` ｜ 回路拉开成导体 + 240 粒子 + 2Hz 交流
   ══════════════════════════════════════════════════════════════ */
const SHOT_042 = {
  id: 'SHOT_042', start: 45.234, end: 45.85,
  seedHex: SEEDS.SHOT_042, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Switch my current',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['Switch my', 'current'];
    this._c = {
      W: new Word(ctx, LINES, 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.22], lineStep: CAM.LINE_STEP_160,
      }),
      pts: textPoints(LINES, 160, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                      [0.10, 0.22], CAM.LINE_STEP_160, { step: 4, n: 3500 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.56 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;

    // ① 回路自顶部拉开、四角展平
    const unroll = easeInQuad(phase(t, 45.23, 45.34));
    const top = lerp(0.21 * BASE_H, yb, unroll);
    f.line(0.02 * BASE_W, top, 0.98 * BASE_W, yb, CYAN, 2, 0.5 * (1 - unroll), 0.4);
    f.line(x0, yb, x1, yb, CYAN, 2, 0.95, 0.8);
    f.ell(x0, yb, 7, 7, ICE, 2, 0.9, 0.6);
    f.ell(x1, yb, 7, 7, ICE, 2, 0.9, 0.6);
    f.dot(0.5 * BASE_W, yb, 4, WARM, 1, 1.0);

    // ② 主词采样 3,500 点 → 240 颗导体粒子
    const ghost = 1.0 - clamp01(phase(t, 45.34, 45.40));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (li === 1 ? CYAN : ICE),
                    { alpha: ghost, glowK: 0.4 * ghost });
    }
    const p2 = easeInOutCubic(phase(t, 45.34, 45.62));
    const seed = SC.seed('SHOT_042');
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const r = new Rng(seed, 'cond', i);
      const tx = x0 + (i % 240) * ((x1 - x0) / 239);
      const ty = yb + r.range(-3, 3);
      dp.push([lerp(c.pts[i][0], tx, p2), lerp(c.pts[i][1], ty, p2)]);
      al.push(0.6 * (1 - 0.4 * p2));
    }
    f.pts(dp, 2, CYAN, 1, 0.5, BG_DEEP, al);
    for (let i = 0; i < 240; i++) {
      const tx = x0 + i * ((x1 - x0) / 239);
      f.line(tx - 8, yb, tx, yb, ICE, 1, 0.55, 0.5);
    }

    // ③ 交流正弦 2 周期（自左向右生长）+ 笔点
    const A = 120.0;
    const write = clamp01(phase(t, 45.62, 45.78));
    const n = 200;
    const ptsW = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      ptsW.push([lerp(x0, x1, u), yb - A * Math.sin(2 * Math.PI * 2 * u)]);
    }
    const vis = [];
    for (let i = 0; i < n; i++) if (i / (n - 1) <= write) vis.push(ptsW[i]);
    if (vis.length > 1) f.pline(vis, ICE, 2, 0.95, 0.7);
    const pen = ptsW[Math.min(n - 1, Math.floor(write * (n - 1)))];
    f.dot(pen[0], pen[1], 5, ICE, 1, 1.0);
    if (t >= 45.78) {
      for (let k = 0; k < 2; k++) {
        const u = 0.25 + k * 0.5;
        f.dot(lerp(x0, x1, u), yb - A, 3, WARM, 1, 1.0);
      }
    }

    // 12 焊点压扁为刻度
    for (let k = 0; k < 12; k++) {
      const xx = x0 + k * ((x1 - x0) / 11);
      f.line(xx, yb - 6, xx, yb + 6, GREY, 1, 0.7);
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    if (t < 45.28) f.text(0.84 * BASE_W, 0.50 * BASE_H, 'I:0 → I:1', mf.font, GREY, 0.55);
    const mf3 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 45.72) f.text(0.86 * BASE_W, 0.90 * BASE_H, 'f:2Hz', mf3.font, GREY, 0.6);

    corners(f, 'T+45.23s', CHAPTER, `seed:${SEEDS.SHOT_042} · sample:4px · 3500pt`, 'MORPH');
    const k = 0.38 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 45.34, 45.55)));
    return { bloomR: 8.0, bloomK: Math.min(0.50, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_043  `45.85–46.8692` ｜ 交流振幅 A→0 整流为直流 + 桥式符号
   ══════════════════════════════════════════════════════════════ */
const SHOT_043 = {
  id: 'SHOT_043', start: 45.85, end: 46.8692,
  seedHex: SEEDS.SHOT_043, chapter: CHAPTER, status: 'DC',
  lyric: 'To AC to DC',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['To AC to DC'], 176, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: 1.02 * 176,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yb = 0.56 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;
    const A = 120.0 * (1.0 - easeInOutCubic(phase(t, 46.00, 46.60)));

    // ① 波形 512 采样点（2–3px 蓝紫）
    const n = 512;
    const pts = [], al = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      pts.push([lerp(x0, x1, u), yb - A * Math.sin(2 * Math.PI * 2 * u)]);
      al.push(0.85 - 0.35 * (1 - A / 120.0));
    }
    f.pts(pts, 2.5, BV, 1, 0.4, BG_DEEP, al);

    // ② 直流亮线（3px 冰白，随 A→0 由 40% 升到 100%）
    const aDC = lerp(0.4, 1.0, clamp01(1 - A / 120.0));
    f.line(x0, yb, x1, yb, ICE, 3, aDC, 1.0);

    // ③ 吸入粒子：每波峰释放 6 颗
    for (let k = 0; k < 4; k++) {
      const crestU = 0.125 + k * 0.25;
      const cxr = lerp(x0, x1, crestU);
      for (let j = 0; j < 6; j++) {
        const st = 46.00 + k * 0.06 + j * 0.004;
        if (t < st) continue;
        const p = easeInOutCubic(clamp01((t - st) / 0.18));
        const x = cxr + (j - 2.5) * 6;
        const yC = yb - 120.0;
        f.dot(x, lerp(yC + (j % 2) * 8 - 6, yb, p), 2, BV, 0.8 * (1 - 0.4 * p), 0.4);
      }
    }

    // ④ 桥式整流四节点符号
    const sx = 0.82 * BASE_W, sy = 0.70 * BASE_H;
    const lf = fontOf('JetBrains Mono', 20, dpr);
    for (let k = 0; k < 4; k++) {
      if (t >= 45.85 + k * 0.03) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        const px = sx + 33 * Math.cos(a), py = sy + 33 * Math.sin(a);
        f.dot(px, py, 6, CYAN, 0.9, 0.6);
        f.text(px - 6, py - 10, k % 2 === 0 ? '+' : '−', lf.font, GREY, 0.7);
      }
    }
    for (let k = 0; k < 4; k++) {
      const a0 = (k * Math.PI) / 2 + Math.PI / 4;
      const a1 = (((k + 1) % 4) * Math.PI) / 2 + Math.PI / 4;
      f.line(sx + 33 * Math.cos(a0), sy + 33 * Math.sin(a0),
             sx + 33 * Math.cos(a1), sy + 33 * Math.sin(a1), CYAN, 1.5, 0.8, 0.4);
    }

    // ⑤ 读数 V:±120 → 0
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(x1 - 240, yb - 90, A > 1 ? 'V:±120' : 'V:0', mf.font, GREY, 0.6);

    // 主词（AC 蓝紫 / DC 于 46.42 变主青，中间箭头 → 64px 灰蓝）
    for (const g of c.W.chars) {
      let col = ICE;
      if (g.ci >= 3 && g.ci <= 4) col = BV;
      if (g.ci >= 9 && t >= 46.42) col = CYAN;
      f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font, col, 0.95, 0.35, c.W.stroke);
    }
    const af = fontOf('Inter Semi-Bold', 64, dpr);
    f.text(0.10 * BASE_W + 330, 0.26 * BASE_H - 20, '→', af.font, GREY, 0.6);

    corners(f, 'T+45.85s', CHAPTER, `seed:${SEEDS.SHOT_043} · A:120→0`, 'DC');
    const k = 0.45 - 0.05 * (1 - A / 120.0);
    return { bloomR: 8.0, bloomK: k, grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_044  `46.8692–47.67` ｜ 直流线上弯成环 → 三层同心环
   ══════════════════════════════════════════════════════════════ */
const SHOT_044 = {
  id: 'SHOT_044', start: 46.8692, end: 47.67,
  seedHex: SEEDS.SHOT_044, chapter: CHAPTER, status: 'RING',
  lyric: 'To AC to DC',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['To AC to DC'];
    this._c = {
      W: new Word(ctx, LINES, 176, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.26], lineStep: null,
      }),
      wpts: textPoints(LINES, 176, 'Inter Semi-Bold', 0.05, 'left', 'baseline_first',
                       [0.10, 0.26], null, { step: 4, n: 1400 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // ① 直流线自左端向上弯折（Python 里 share 未参与绘制）
    const bendp = easeInOutQuad(phase(t, 46.87, 47.00));

    // ② 512 点闭合为 r=250 圆（超冲 4% 回弹）
    const close = easeOutBackK(phase(t, 47.00, 47.24), 1.56);
    const r0 = 250 * (0.2 + 0.8 * close);
    const pts = [], al = [];
    for (let i = 0; i < 512; i++) {
      const u = i / 512;
      if (t < 47.00) {
        pts.push([0.06 * BASE_W + u * 0.88 * BASE_W,
                  0.56 * BASE_H - bendp * Math.sin(u * Math.PI) * 220]);
      } else {
        const a = -Math.PI / 2 + u * 2 * Math.PI;
        pts.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]);
      }
      al.push(0.9);
    }
    f.pts(pts, 2.5, ICE, 1, 0.5, BG_DEEP, al);

    // ③ 分裂为三层同心环 r=140/250/360（异速自转 +5/−3/+2 °/帧）
    const split = easeOutCubic(phase(t, 47.24, 47.48));
    if (split > 0.01) {
      const rings = [[140, 360, ICE, 300.0], [250, 640, CYAN, -180.0], [360, 920, BV, 120.0]];
      for (const [rr, n_, col, spin] of rings) {
        const r = lerp(250, rr, split);
        const pl = [], pa = [];
        for (let i = 0; i < n_; i++) {
          const a = rad((i * 360.0) / n_ + spin * (t - 47.24));
          pl.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
          pa.push(0.85 * split);
        }
        f.pts(pl, 2.5, col, 1, 0.45, BG_DEEP, pa);
      }
    }

    // ④ 24 道扫描线自上而下铺开（14ms/道）+ 外环 24 段刻度
    for (let k = 0; k < 24; k++) {
      const st = 47.24 + k * 0.014;
      const yy = 0.30 * BASE_H + k * ((0.44 * BASE_H) / 23);
      const a = 0.22 * clamp01((t - st) / 0.03);
      if (a > 0) f.line(0.14 * BASE_W, yy, 0.86 * BASE_W, yy, GREY, 1, a);
    }
    for (let k = 0; k < 24; k++) {
      f.arc(cx, cy, 366, 366, k * 15, k * 15 + 6, GREY, 1, 0.40);
    }

    // ⑤ 桥式符号收缩至 r=0，4 枚节点转内环暖微点
    if (t < 47.02) {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        f.dot(0.82 * BASE_W + 33 * Math.cos(a), 0.70 * BASE_H + 33 * Math.sin(a),
              6 * (1 - phase(t, 46.87, 47.02)), CYAN, 0.8);
      }
    } else {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        f.dot(cx + 140 * Math.cos(a), cy + 140 * Math.sin(a), 3, WARM, 0.9, 1.0);
      }
    }

    // 主词（47.10 采样，保 2 帧）
    const ghost = 1.0 - clamp01(phase(t, 47.10, 47.16));
    if (ghost > 0.02) {
      for (const g of c.W.chars) {
        const col = g.ci >= 3 && g.ci <= 4 ? BV : (g.ci >= 9 ? CYAN : ICE);
        f.text(g.x / dpr, g.baseline / dpr, g.ch, c.W.font, col, ghost, 0.3 * ghost, c.W.stroke);
      }
    }
    if (t >= 47.10) {
      const pp = clamp01(phase(t, 47.10, 47.44));
      const swarm = [], sa = [];
      for (let i = 0; i < c.wpts.length; i++) {
        swarm.push([lerp(c.wpts[i][0], cx + 200 * Math.cos(i * 0.09), pp),
                    lerp(c.wpts[i][1], cy + 200 * Math.sin(i * 0.09), pp)]);
        sa.push(0.5 * (1 - pp * 0.5));
      }
      f.pts(swarm, 2, ICE, 1, 0.3, BG_DEEP, sa);
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    if (t < 47.04) f.text(0.86 * BASE_W, 0.86 * BASE_H, 'V:0', mf.font, GREY, 0.6);
    const mf3 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 47.44) f.text(0.86 * BASE_W, 0.90 * BASE_H, 'rings:3', mf3.font, GREY, 0.6);

    corners(f, 'T+46.87s', CHAPTER, `seed:${SEEDS.SHOT_044} · rings:3 · 1920pt`, 'MORPH');
    const k = 0.40 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 47.00, 47.24)));
    return { bloomR: 9.0, bloomK: k, grain: 5.0, scan: 0.05 };
  },
};

/** PIL `pieslice` 的 Canvas 等价实现（已按 dpr 缩放的设备坐标入参） */
function pieslice(ctx, cx, cy, r, s0, s1, fill, outline, wpx) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, rad(s0), rad(s1));
  ctx.closePath();
  ctx.fillStyle = css(fill);
  ctx.fill();
  if (outline && wpx > 0) {
    ctx.strokeStyle = css(outline);
    ctx.lineWidth = wpx;
    ctx.stroke();
  }
}

/* ══════════════════════════════════════════════════════════════
   SHOT_045  `47.67–48.7116` ｜ 三层环 + 12 片虹膜叶片张合 + 遮罩
   ══════════════════════════════════════════════════════════════ */
const SHOT_045 = {
  id: 'SHOT_045', start: 47.67, end: 48.711600000000004,
  seedHex: SEEDS.SHOT_045, chapter: CHAPTER, status: 'BLIND',
  lyric: 'And then blind my vision',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['And then blind', 'my vision'], 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.14, 0.42], lineStep: 1.04 * 168,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const RINGS = [[140, ICE, 360.0], [250, CYAN, -180.0], [360, BV, 90.0]];

    // ① 三层环（继承 044）+ 24 道滚动扫描线
    for (let li = 0; li < RINGS.length; li++) {
      const rr = RINGS[li][0], col = RINGS[li][1], spin = RINGS[li][2];
      const a0 = spin * (t - 47.67);
      const n_ = 160 + li * 80;
      const pl = [], al = [];
      for (let i = 0; i < n_; i++) {
        const a = rad((i * 360.0) / n_ + a0 * 0.02);
        pl.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
        al.push(0.55);
      }
      f.pts(pl, 2.0, col, 1, 0.4, BG_DEEP, al);
    }
    for (let k = 0; k < 24; k++) {
      const yy = ((0.24 * BASE_H + k * ((0.52 * BASE_H) / 23))
        + 12 * Math.sin(2 * Math.PI * 0.6 * (t - 47.67))) % BASE_H;
      f.line(0.12 * BASE_W, yy, 0.88 * BASE_W, yy, GREY, 1, 0.22);
    }

    // ② 瞳孔 r=90（阶段 1 由 60 涨到 90）
    const pr = lerp(60, 90, easeOutExpo(phase(t, 47.67, 47.90)));
    f.ell(cx, cy, pr, pr, BG_ALT, 0, 1, 0, BG_ALT, 1.0);   // overlay_ellipse → 真实 alpha 填充
    f.ell(cx, cy, pr, pr, CYAN, 2, 0.95, 1.0);

    // ③ 12 片扇形叶片：张开 46°→8°（阶段 1），收拢 8°→46°（阶段 3）
    let openAng;
    if (t < 47.67) openAng = 46.0;
    else if (t < 48.30) openAng = lerp(46.0, 8.0, easeOutExpo(phase(t, 47.67, 47.90)));
    else openAng = lerp(8.0, 46.0, easeInOutCubic(phase(t, 48.30, 48.58)));
    for (let k = 0; k < 12; k++) {
      const a0 = k * 30.0;
      const st = t >= 48.30 ? 48.30 + k * 0.006 : 0.0;
      const extra = t >= 48.30 ? 38.0 * easeInOutCubic(clamp01((t - st) / 0.26)) : 0.0;
      const half = (180.0 - openAng) / 12.0;
      const s0 = a0 + half + extra;
      const s1 = s0 + (30.0 - 2 * half);
      pieslice(ctx, cx * dpr, cy * dpr, 360 * dpr, s0, s1,
               mixc(BG_DEEP, 0.96), GREY, Math.max(1, 2 * dpr));
    }

    // ④ 黑色遮罩（48.30 起自圆心扩至 r=420）+ 60% 矩形带
    if (t >= 48.30) {
      const mp = easeInOutCubic(phase(t, 48.30, 48.58));
      if (mp > 0) {
        f.ell(cx, cy, 420 * mp, 420 * mp, BG_DEEP, 0, 1, 0, BG_DEEP, 1.0);
        f.rect(0.10 * BASE_W, 0.34 * BASE_H, 0.74 * BASE_W, 0.60 * BASE_H, BG_DEEP, 0, 1, 0,
               BG_DEEP, 0.60 * mp);
      }
    }

    // 主词（47.67 起 12ms/字符；48.40 起只留 25% 残影）
    const wA = t < 48.40 ? 1.0 : 0.25;
    c.W.draw(f, t, {
      t0: 47.67, stagger: 0.012, dur: 0.12, dy: 8, ease: easeOutExpo,
      color: (li) => (t >= 48.06 && li === 1 ? CYAN : ICE),
      glowK: 0.3 * wA, alpha: wA,
    });
    const mf = fontOf('JetBrains Mono', 46, dpr);
    const nIris = Math.floor(clamp01(phase(t, 47.90, 48.30)) * 12);
    f.text(cx - 130, 0.84 * BASE_H, `iris:${nIris}/12`, mf.font, GREY, 0.6);

    corners(f, 'T+47.67s', CHAPTER, `seed:${SEEDS.SHOT_045} · blades:12`, 'BLIND');
    return {
      bloomR: 9.0,
      bloomK: 0.35 + 0.15 * ringNearPct(t, [48.06], 0.15),
      grain: 6.0,
      scan: 0.08,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_046  `48.7116–49.53` ｜ 三环 96 径向刻度 + 虹膜叶片收拢至 r=26
   ══════════════════════════════════════════════════════════════ */
const SHOT_046 = {
  id: 'SHOT_046', start: 48.711600000000004, end: 49.53,
  seedHex: SEEDS.SHOT_046, chapter: CHAPTER, status: 'BLIND',
  lyric: 'And then blind my vision',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['And then blind', 'my vision'];
    this._c = {
      W: new Word(ctx, LINES, 168, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.46], lineStep: 1.05 * 168,
      }),
      pts: textPoints(LINES, 168, 'Inter Semi-Bold', 0.04, 'center', 'center',
                      [0.50, 0.46], 1.05 * 168, { step: 4, n: 2900 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.48 * BASE_H;
    const PLANES = [[430, ICE, 1.4], [320, CYAN, -48.0], [210, BV, 30.0]];

    // ① 三环异速自转 + 96 径向刻度
    for (const [rr, col, spin] of PLANES) {
      const a0 = spin * (t - 48.71);
      const pl = [], al = [];
      for (let i = 0; i < 160; i++) {
        const a = rad((i * 360.0) / 160 + a0 * 0.02);
        pl.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
        al.push(0.6);
      }
      f.pts(pl, 2.0, col, 1, 0.4, BG_DEEP, al);
      for (let k = 0; k < 96; k++) {
        const a = rad(k * 3.75 + a0 * 0.02);
        f.line(cx + rr * Math.cos(a), cy + rr * Math.sin(a),
               cx + (rr - 6) * Math.cos(a), cy + (rr - 6) * Math.sin(a), col, 1, 0.5);
      }
    }

    // ② 12 片虹膜叶片（240 点/片点链）→ 孔径 140→26px
    const ap = easeInOutCubic(phase(t, 49.14, 49.40));
    const rIn = lerp(140, 26, ap);
    for (let k = 0; k < 12; k++) {
      const st = 49.14 + k * 0.009;
      const pp = easeInOutCubic(clamp01((t - st) / 0.24));
      const rrIn = lerp(140, 26, pp);
      const a0 = k * 30.0;
      const pl = [];
      for (let i = 0; i < 240; i++) {
        const u = i / 240;
        const a = rad(a0 + 30.0 * u);
        const rr = lerp(rrIn, 430, 0.55 + 0.45 * Math.sin(u * Math.PI));
        pl.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      f.pline(pl, CYAN, 2, 0.30, 0.3);
    }

    // ③ 12 条遮蔽扫描线随叶片收拢
    for (let k = 0; k < 12; k++) {
      const yy = cy - 140 + k * (280 / 11) * (rIn / 140);
      f.line(cx - 140 * (rIn / 140), yy, cx + 140 * (rIn / 140), yy, BG_DEEP, 2, 0.9);
    }

    // ④ 承接的电路拓扑余色（7 段 1px 蓝紫，6 帧淡尽）
    const ca = 0.5 * (1 - clamp01(phase(t, 48.71, 48.81)));
    if (ca > 0.02) {
      const topo = [[0.20, 0.20], [0.34, 0.20], [0.34, 0.32], [0.48, 0.32],
                    [0.48, 0.44], [0.62, 0.44], [0.62, 0.56], [0.76, 0.56]];
      f.pline(topo.map(([px, py]) => [px * BASE_W, py * BASE_H]), BV, 1, ca);
    }

    // 主词 2900 点采样 + 保 2 帧
    const ghost = 1.0 - clamp01(phase(t, 48.90, 48.96));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (t >= 49.10 && li === 1 ? CYAN : ICE),
                    { alpha: t < 48.90 ? ghost * 0.35 : ghost, glowK: 0.3 * ghost });
    }
    const pp = clamp01(phase(t, 48.90, 49.14));
    const moved = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const a = (i % 12) * 30.0;
      const rr = lerp(140, 60, pp) + (i % 7) * 6;
      moved.push([lerp(c.pts[i][0], cx + rr * Math.cos(rad(a)), pp),
                  lerp(c.pts[i][1], cy + rr * Math.sin(rad(a)), pp)]);
      al.push(0.6);
    }
    f.pts(moved, 2, ICE, 1, 0.4, BG_DEEP, al);
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(cx - 140, cy + 180, 'IRIS::close', mf.font, GREY, 0.55);

    corners(f, 'T+48.71s', CHAPTER, `seed:${SEEDS.SHOT_046} · 2900pt`, 'BLIND');
    const k = 0.40 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 49.14, 49.40)));
    return { bloomR: 8.0, bloomK: Math.min(0.55, k), grain: 5.0, scan: 0.12 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_047  `49.53–50.5548` ｜ 三层倾斜平面爆开 + 1,450 残余词粒子
   ══════════════════════════════════════════════════════════════ */
const SHOT_047 = {
  id: 'SHOT_047', start: 49.53, end: 50.5548,
  seedHex: SEEDS.SHOT_047, chapter: CHAPTER, status: 'SPIN',
  lyric: 'So dizzy so dizzy',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['So dizzy', 'so dizzy'], 176, {
        weight: 'Inter Extra-Bold', trackEm: 0.02, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.40], lineStep: 1.0 * 176,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.48 * BASE_H;
    const burst = easeOutExpo(phase(t, 49.53, 49.76));
    const rush = t >= 50.22 && t <= 50.44 ? 1.8 : 1.0;
    const slow = t >= 50.44 ? 0.4 : 1.0;

    // ① 三层平面（倾角 + 自转 + 72 径向刻度）
    const PLANES = [[456, ICE, -14.0, 1.6], [320, CYAN, 9.0, -1.0], [190, BV, 0.0, 0.55]];
    for (const [rr0, col, tilt, w] of PLANES) {
      const r = rr0 * burst;
      const tiltA = rad(tilt * burst);
      const spin = rad(w * rush * slow * 60 * (t - 49.53) * 0.02);
      const pl = [];
      for (let i = 0; i < 120; i++) {
        const a = (i * 2 * Math.PI) / 120 + spin;
        const x = r * Math.cos(a), y = r * Math.sin(a) * Math.cos(tiltA);
        pl.push([cx + x * Math.cos(tiltA) - y * Math.sin(tiltA),
                 cy + x * Math.sin(tiltA) + y * Math.cos(tiltA)]);
      }
      f.pline(pl, col, 1, 0.8, 0.4, BG_DEEP, true);
      for (let k = 0; k < 72; k++) {
        const a = (k * Math.PI) / 36 + spin;
        const x0 = r * Math.cos(a), y0 = r * Math.sin(a) * Math.cos(tiltA);
        const x1 = (r - 8) * Math.cos(a), y1 = (r - 8) * Math.sin(a) * Math.cos(tiltA);
        f.line(cx + x0 * Math.cos(tiltA) - y0 * Math.sin(tiltA),
               cy + x0 * Math.sin(tiltA) + y0 * Math.cos(tiltA),
               cx + x1 * Math.cos(tiltA) - y1 * Math.sin(tiltA),
               cy + x1 * Math.sin(tiltA) + y1 * Math.cos(tiltA), col, 1, 0.45);
      }
    }

    // 前景残留 1,450 颗词粒子（半透明 40%）
    const seed = SC.seed('SHOT_047');
    for (let i = 0; i < 1450; i++) {
      const r = new Rng(seed, 'res', i);
      const a = r.range(0, Math.PI * 2) + rad(1.6 * 60 * (t - 49.53) * 0.02);
      const rr = 456 * burst * r.range(0.2, 1.0);
      f.dot(cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.97, 2, ICE, 0.40, 0.3);
    }

    // 12 条视差连线 + 中心暖点
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI * 2) / 12;
      f.line(cx + 190 * Math.cos(a), cy + 190 * Math.sin(a),
             cx + 320 * Math.cos(a), cy + 320 * Math.sin(a), BV, 1, 0.30);
    }
    const pu = 1.0 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 50.44, 50.55)));
    f.dot(cx, cy, 8 * pu, WARM, 1, 1.0);

    // 主词（两记 dizzy 于 50.02 依次变色）
    c.W.draw(f, t, {
      t0: 49.53, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => {
        if (t >= 50.02 && li === 0 && ci >= 3 && t < 50.30) return CYAN;
        if (t >= 50.02 && li === 1 && ci >= 3) return BV;
        return ICE;
      },
      glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.76 * BASE_W, 0.72 * BASE_H, 'ω:+1.6 / -1.0 / +0.55', mf.font, GREY, 0.55);

    corners(f, 'T+49.53s', CHAPTER, `seed:${SEEDS.SHOT_047} · planes:3`, 'SPIN');
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0, scan: 0.06 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_048  `50.5548–51.36` ｜ 三层叠合 + 3,300 点吸附 12 边门
   ══════════════════════════════════════════════════════════════ */
const SHOT_048 = {
  id: 'SHOT_048', start: 50.5548, end: 51.36,
  seedHex: SEEDS.SHOT_048, chapter: CHAPTER, status: 'MORPH',
  lyric: 'So dizzy so dizzy',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['So dizzy', 'so dizzy'];
    this._c = {
      W: new Word(ctx, LINES, 176, {
        weight: 'Inter Extra-Bold', trackEm: 0.02, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.40], lineStep: 1.0 * 176,
      }),
      pts: textPoints(LINES, 176, 'Inter Extra-Bold', 0.02, 'center', 'center',
                      [0.50, 0.40], 1.0 * 176, { step: 4, n: 3300 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const R = 420.0;
    const merge = easeInQuad(phase(t, 50.55, 50.63));

    // ① 三层平面倾角归零并叠合
    for (const [rr, , ] of [[456, ICE, -14.0], [320, CYAN, 9.0], [190, BV, 0.0]]) {
      const a_ = 0.30 * (1 - clamp01(phase(t, 50.55, 50.63)));
      if (a_ > 0.02) {
        f.pline(ringPtsDeg(cx, cy, rr * (1 - 0.4 * merge), 96), GREY, 1, 0.20 * a_,
                BG_DEEP, true);
      }
    }

    // ② 主词按 4px 步长采样 3,300 点（带 6px 拖尾）
    const ghost = 1.0 - clamp01(phase(t, 50.63, 50.70));
    if (ghost > 0.02) c.W.drawPlain(f, ICE, { alpha: ghost, glowK: 0.35 * ghost });

    // ③ 粒子按角度扇区分流吸附到 12 条边（每边 275 点）
    const p3 = easeOutQuart(phase(t, 50.84, 51.20));
    const verts = [];
    for (let k = 0; k < 12; k++) {
      verts.push([cx + R * Math.cos(rad(15 + k * 30)), cy + R * Math.sin(rad(15 + k * 30))]);
    }
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const edge = i % 12;
      const u = ((Math.floor(i / 12) % 275) / 274.0);
      const v0 = verts[edge], v1 = verts[(edge + 1) % 12];
      dp.push([lerp(c.pts[i][0], lerp(v0[0], v1[0], u), p3),
               lerp(c.pts[i][1], lerp(v0[1], v1[1], u), p3)]);
      al.push(0.8);
    }
    f.pts(dp, 2.5, CYAN, 1, 0.5, BG_DEEP, al);
    const sub = [], subA = [];
    for (let i = 0; i < dp.length; i += 3) { sub.push(dp[i]); subA.push(0.7); }
    f.pts(sub, 2.0, ICE, 1, 0.4, BG_DEEP, subA);

    // ④ 12 个顶点 r=7 空心节点环（12ms stagger）
    for (let k = 0; k < 12; k++) {
      if (t >= 51.20 + k * 0.012) {
        f.ell(verts[k][0], verts[k][1], 7, 7, ICE, 2, 0.95, 0.7);
      }
    }

    // ⑤ 门内深处 r=5 暖光点 + 隧道口沿 Z 轻推 1.06
    const pu = 1.0 + 0.06 * easeOutQuad(phase(t, 51.20, 51.36));
    f.dot(cx, cy, 5 * pu, WARM, 1, 1.0);
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t < 50.60) f.text(0.76 * BASE_W, 0.72 * BASE_H, 'ω:+1.6 / -1.0 / +0.55', mf.font, GREY, 0.55);
    const mf3 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 51.20) f.text(0.78 * BASE_W, 0.90 * BASE_H, 'MORPH→tunnel', mf3.font, GREY, 0.6);

    corners(f, 'T+50.55s', CHAPTER, `seed:${SEEDS.SHOT_048} · 3300pt`, 'MORPH');
    const k = 0.40 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 50.84, 51.06)));
    return { bloomR: 9.0, bloomK: Math.min(0.52, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_049  `51.36–52.4072` ｜ 14 层十二边形环隧道 + 迎面数值流
   ══════════════════════════════════════════════════════════════ */
const SHOT_049 = {
  id: 'SHOT_049', start: 51.36, end: 52.407199999999996,
  seedHex: SEEDS.SHOT_049, chapter: CHAPTER, status: 'FLIGHT',
  lyric: 'Oh we can travel',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['Oh we can travel'], 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.30], lineStep: 1.02 * 160,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.47 * BASE_H;
    const flight = clamp01(phase(t, 51.58, 52.18));
    const speedup = t >= 52.18 ? 1.4 : 1.0;

    // ① 14 层环（半径 420 → 46，比例 0.86/层）+ z-flow 迎面放大
    const lf = fontOf('JetBrains Mono', 18, dpr);
    for (let L = 0; L < 14; L++) {
      const r0 = 420.0 * 0.86 ** L;
      const z = (flight * speedup * 0.55 + L * 0.072) % 1.0;
      const scale = lerp(1.0, 2.6, z);
      const r = r0 * scale;
      let col, wdt;
      if (L < 3) { col = CYAN; wdt = 1.5; }
      else if (L < 8) { col = BV; wdt = 1.0; }
      else { col = GREY; wdt = 1.0; }
      const a_ = L < 3 ? 0.9 : (L < 8 ? 0.7 : 0.6);
      const verts = [];
      for (let k = 0; k < 12; k++) {
        verts.push([cx + r * Math.cos(rad(15 + k * 30)), cy + r * Math.sin(rad(15 + k * 30))]);
      }
      f.pline(verts, col, wdt, a_ * clamp01(1.3 - z), 0.4, BG_DEEP, true);
      // 时间刻度墙（左右各一面 120×34px）
      if (L % 2 === 0) {
        for (const side of [-1, 1]) {
          const wx = cx + side * r * 0.72;
          const wy = cy + r * 0.42;
          f.rect(wx - 60, wy - 17, wx + 60, wy + 17, GREY, 1, 0.5 * clamp01(1.3 - z));
          f.text(wx - 34, wy - 9, `+${String(2026 - L * 145).padStart(4, '0')}`, lf.font, GREY,
                 0.6 * clamp01(1.3 - z));
        }
      }
    }

    // ② 中轴飞行线 + 灭点暖核
    f.line(cx, cy, cx, 0.98 * BASE_H, ICE, 1, 0.30);
    const pu = 1.0 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 52.34, 52.41)));
    f.dot(cx, cy, 9 * pu, WARM, 1, 1.0);

    // ③ 迎面数值流（52.18 起密度 ×2.2）
    const nflow = t >= 52.18 ? 400 : 180;
    const seed = SC.seed('SHOT_049');
    for (let i = 0; i < nflow; i++) {
      const r = new Rng(seed, 'fly', i);
      const a = r.range(0, Math.PI * 2);
      const ph = pymod((t - 51.58) * (t >= 52.18 ? 1.4 : 1.0) * 0.6 + r.next(), 1.0);
      const rr = 20 + ph * 900;
      f.dot(cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.9, 2, CYAN, 0.8 * (1 - ph), 0.4);
    }

    // 主词（travel 52.06 变主青）
    c.W.draw(f, t, {
      t0: 51.36, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => (t >= 52.06 && ci >= 11 ? CYAN : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(0.52 * BASE_W, 0.47 * BASE_H + 20, 't:0001→2026', mf.font, GREY, 0.5);

    corners(f, 'T+51.36s', CHAPTER, `seed:${SEEDS.SHOT_049} · rings:14`, 'FLIGHT');
    return {
      bloomR: 9.0,
      bloomK: 0.45 + bpulse(t, beatsIn(beats, this.start, this.end), 0.05, 0.05),
      grain: 5.0,
      scan: 0.08,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_050  `52.4072–53.23` ｜ 环流停摆 + 3,600 点吸附时间轴与年份牌
   ══════════════════════════════════════════════════════════════ */
const SHOT_050 = {
  id: 'SHOT_050', start: 52.407199999999996, end: 53.23,
  seedHex: SEEDS.SHOT_050, chapter: CHAPTER, status: 'FLATTEN',
  lyric: 'Oh we can travel',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['Oh we can travel'];
    this._c = {
      W: new Word(ctx, LINES, 160, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.30], lineStep: null,
      }),
      pts: textPoints(LINES, 160, 'Inter Semi-Bold', 0.05, 'center', 'center',
                      [0.50, 0.30], null, { step: 4, n: 3600 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yAx = 0.56 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;

    // ① 14 层环停止 z-flow 并锁定
    const lock = clamp01(phase(t, 52.41, 52.70));
    for (let L = 0; L < 14; L++) {
      const a_ = 0.35 * (1 - lock);
      if (a_ <= 0.02) continue;
      const r = 420.0 * 0.86 ** L * (1 - 0.4 * lock);
      const verts = [];
      for (let k = 0; k < 12; k++) {
        verts.push([0.50 * BASE_W + r * Math.cos(rad(15 + k * 30)),
                    0.47 * BASE_H + r * Math.sin(rad(15 + k * 30))]);
      }
      f.pline(verts, GREY, 1, 0.20 * a_, BG_DEEP, true);
    }
    const ghost = 1.0 - clamp01(phase(t, 52.49, 52.56));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li, ci) => (ci >= 11 ? CYAN : ICE),
                    { alpha: ghost, glowK: 0.35 * ghost });
    }

    // ③ 1,200 点吸附为轴线、2,400 点分 5 簇聚成年份牌
    const p3 = easeOutQuart(phase(t, 52.70, 53.06));
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const x = c.pts[i][0], y = c.pts[i][1];
      let tx, ty;
      if (i < 1200) {
        tx = lerp(x0, x1, (i % 1200) / 1199.0);
        ty = yAx;
      } else {
        const k = Math.floor((i - 1200) / 480);
        const u = ((i - 1200) % 480) / 480.0;
        const bx = lerp(0.22 * BASE_W, 0.78 * BASE_W, k / 4.0);
        tx = bx + (pymod(u, 1.0) - 0.5) * 96;
        ty = yAx - 96 + pymod(u * 3, 1.0) * 54;
      }
      const st = 52.70 + (i % 5) * 0.03;
      const pp = easeOutQuart(clamp01((t - st) / 0.30));
      dp.push([lerp(x, tx, pp), lerp(y, ty, pp)]);
      al.push(0.8);
    }
    f.pts(dp, 3.0, CYAN, 1, 0.5, BG_DEEP, al);
    const sub = [], subA = [];
    const hi = Math.min(1200, dp.length);
    for (let i = 0; i < hi; i += 2) { sub.push(dp[i]); subA.push(0.6); }
    f.pts(sub, 2.5, ICE, 1, 0.4, BG_DEEP, subA);

    // 年份牌数值锚点 + 打字机次词
    const YEARS = ['2026', '1500', '500', '0', '−500'];
    const lf = fontOf('JetBrains Mono', 24, dpr);
    for (let k = 0; k < YEARS.length; k++) {
      const bx = lerp(0.22 * BASE_W, 0.78 * BASE_W, k / 4.0);
      if (t >= 53.06) {
        const pu = 1.0 + 0.05 * Math.sin(Math.PI * clamp01(phase(t, 53.06 + k * 0.03, 53.10 + k * 0.03)));
        f.dot(bx, yAx - 96 + 27 * pu, 2, WARM, 1, 1.0);
        f.text(bx - 26, yAx - 96 + 8, YEARS[k], lf.font, ICE, 0.85);
      }
    }
    const mf = fontOf('JetBrains Mono', 46, dpr);
    if (t >= 53.06) {
      const n_ = Math.floor(clamp01(phase(t, 53.06, 53.23)) * 4) * 3;
      f.text(x1 - 300, yAx - 90, 'axis:AD·BC'.slice(0, Math.max(3, n_)), mf.font, GREY, 0.6);
    }
    const mf2 = fontOf('JetBrains Mono', 44, dpr);
    if (t < 52.50) f.text(0.52 * BASE_W, 0.47 * BASE_H + 20, 't:0001→2026', mf2.font, GREY, 0.5);

    corners(f, 'T+52.41s', CHAPTER, `seed:${SEEDS.SHOT_050} · 3600pt`, 'FLATTEN');
    const k = 0.40 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 52.70, 52.90)));
    return { bloomR: 9.0, bloomK: Math.min(0.55, k), grain: 5.0, scan: 0.03 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_051  `53.23–54.266` ｜ 年份牌滚动 + 年代四态 crossfade
   ══════════════════════════════════════════════════════════════ */
const SHOT_051 = {
  id: 'SHOT_051', start: 53.23, end: 54.266,
  seedHex: SEEDS.SHOT_051, chapter: CHAPTER, status: 'REVERSE',
  lyric: 'To A.D to B.C',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['To A.D', 'to B.C'], 172, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.34], lineStep: 1.02 * 172,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const yAx = 0.56 * BASE_H;
    const x0 = 0.06 * BASE_W, x1 = 0.94 * BASE_W;
    const seed = SC.seed('SHOT_051');

    // ① 时间轴 1,200 点（批量点，glow 0.3/0.6 复现 f.dot 的高光强度）
    const axis = [];
    for (let i = 0; i < 1200; i++) axis.push([lerp(x0, x1, i / 1199.0), yAx]);
    f.pts(axis, 3, CYAN, 0.6, 0.3 / 0.6, BG_DEEP);

    // ② 5 枚年份牌循环右→左滚动（牌过轴心放大 1.18）
    const YEARS = ['2026', '1500', '500', '0', '−500'];
    const lf = fontOf('JetBrains Mono', 24, dpr);
    for (let k = 0; k < YEARS.length; k++) {
      const ph = pymod((t - 53.23) * 1.05 + k * 0.13, 1.0);
      const bx = lerp(x1, x0, ph);
      const sc = 1.0 + 0.18 * Math.exp(-((bx - 0.50 * BASE_W) ** 2) / (2 * 60 ** 2));
      f.rect(bx - 40 * sc, yAx - 27 * sc, bx + 40 * sc, yAx + 27 * sc, ICE, 1, 0.5,
             null, 0, BG_DEEP, 4);
      f.text(bx - 26 * sc, yAx - 10, YEARS[k], lf.font, ICE, 0.85);
    }

    // ③ 游标（1px 竖线 + 6px 暖三角）
    f.line(0.50 * BASE_W, 0.46 * BASE_H, 0.50 * BASE_W, 0.70 * BASE_H, ICE, 1, 0.9);
    const pu = 1.0 + 0.2 * Math.sin(Math.PI * clamp01(phase(t, 54.18, 54.27)));
    f.pline([[0.50 * BASE_W - 6 * pu, 0.46 * BASE_H],
             [0.50 * BASE_W + 6 * pu, 0.46 * BASE_H],
             [0.50 * BASE_W, 0.46 * BASE_H + 12 * pu]], WARM, 1, 1.0, 1.0, BG_DEEP, true);

    // ④ 年代结构四态 crossfade（网格 → 线框 → 点云 → 孤点）
    const era = clamp01(phase(t, 53.44, 54.02));
    const gx0 = 0.16 * BASE_W, gy0 = 0.66 * BASE_H;
    const gw = 0.68 * BASE_W, gh = 0.24 * BASE_H;
    if (era < 0.33) {
      const a_ = 1.0 - era / 0.33;
      for (let r_ = 0; r_ < 36; r_++) {
        f.line(gx0, gy0 + (r_ * gh) / 35, gx0 + gw, gy0 + (r_ * gh) / 35, GREY, 1, 0.20 * a_);
      }
      for (let cc = 0; cc < 64; cc++) {
        f.line(gx0 + (cc * gw) / 63, gy0, gx0 + (cc * gw) / 63, gy0 + gh, GREY, 1, 0.20 * a_);
      }
      for (let r_ = 0; r_ < 18; r_++) {
        f.line(gx0, gy0 + (r_ * gh) / 17, gx0 + gw, gy0 + (r_ * gh) / 17, GREY, 1, 0.20 * (1 - a_));
      }
      for (let cc = 0; cc < 32; cc++) {
        f.line(gx0 + (cc * gw) / 31, gy0, gx0 + (cc * gw) / 31, gy0 + gh, GREY, 1, 0.20 * (1 - a_));
      }
    } else if (era < 0.66) {
      const u_ = (era - 0.33) / 0.33;
      for (let r_ = 0; r_ < 18; r_++) {
        f.line(gx0, gy0 + (r_ * gh) / 17, gx0 + gw, gy0 + (r_ * gh) / 17, GREY, 1, 0.20 * (1 - u_));
      }
      for (let cc = 0; cc < 32; cc++) {
        f.line(gx0 + (cc * gw) / 31, gy0, gx0 + (cc * gw) / 31, gy0 + gh, GREY, 1, 0.20 * (1 - u_));
      }
      for (let i = 0; i < 640; i++) {
        const r = new Rng(seed, 'cloud', i);
        f.dot(gx0 + r.range(0, gw), gy0 + r.range(0, gh), 2, BV, 0.5 * u_, 0.3);
      }
    } else {
      const u_ = (era - 0.66) / 0.34;
      for (let i = 0; i < 640; i++) {
        const r = new Rng(seed, 'cloud', i);
        f.dot(gx0 + r.range(0, gw), gy0 + r.range(0, gh), 2, BV, 0.5 * (1 - u_), 0.3);
      }
      for (let i = 0; i < 24; i++) {
        const r = new Rng(seed, 'lone', i);
        f.dot(gx0 + r.range(0, gw), gy0 + r.range(0, gh), 2, GREY, 0.6 * u_, 0.2);
      }
    }

    // ⑤ 逆行粒子流 140 颗（自左向右，减速 40%）
    for (let i = 0; i < 140; i++) {
      const r = new Rng(seed, 'rev', i);
      const ph = pymod((t - 53.23) * (t >= 54.02 ? 0.63 : 1.05) + r.next(), 1.0);
      f.dot(lerp(x0, x1, ph), yAx - 14, 2, CYAN, 0.7, 0.4);
    }

    // 主词两行（A.D 主青 / B.C 蓝紫）
    c.W.draw(f, t, {
      t0: 53.23, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => {
        if (li === 0 && ci >= 3 && t >= 53.70) return CYAN;
        if (li === 1 && ci >= 3 && t >= 53.98) return BV;
        return ICE;
      },
      glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(x0, yAx - 70, 'dir:−1', mf.font, GREY, 0.55);

    corners(f, 'T+53.23s', CHAPTER, `seed:${SEEDS.SHOT_051} · eras:5`, 'REVERSE');
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0, scan: 0.03 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_052  `54.266–55.08` ｜ 双弧抬升 + 3,150 点注入两弧
   ══════════════════════════════════════════════════════════════ */
const SHOT_052 = {
  id: 'SHOT_052', start: 54.266, end: 55.08,
  seedHex: SEEDS.SHOT_052, chapter: CHAPTER, status: 'MORPH',
  lyric: 'To A.D to B.C',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['To A.D', 'to B.C'];
    this._c = {
      W: new Word(ctx, LINES, 172, {
        weight: 'Inter Semi-Bold', trackEm: 0.05, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.34], lineStep: 1.02 * 172,
      }),
      pts: textPoints(LINES, 172, 'Inter Semi-Bold', 0.05, 'center', 'center',
                      [0.50, 0.34], 1.02 * 172, { step: 4, n: 3150 }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const R = 420.0;
    const bend = easeInOutQuad(phase(t, 54.27, 54.58));

    // ① 双弧：右半 +32° 抬升（主青）/ 左半 −32° 下沉（蓝紫）
    for (const [side, col] of [[1, CYAN], [-1, BV]]) {
      const n_ = 480;
      const pl = [], al = [];
      for (let i = 0; i < n_; i++) {
        const u = i / (n_ - 1);
        const a = rad(-32 * side * Math.sin(u * Math.PI * 0.5) * (0.5 + 0.5 * bend));
        const rr = R * lerp(1.0, 0.92, bend);
        pl.push([cx + side * rr * Math.cos(a) * Math.sin(u * Math.PI * 0.5),
                 cy + rr * Math.sin(a) * Math.sin(u * Math.PI * 0.5)]);
        al.push(0.8);
      }
      f.pts(pl, 2.0, col, 1, 0.5, BG_DEEP, al);
      if (t >= 54.58) {
        const spine = [];
        for (let i = 0; i < pl.length; i += 8) spine.push(pl[i]);
        f.pline(spine, col, 1.5, 0.5, 0.4);
      }
    }

    // ② 60 颗经度标记 + 游标暖三角上行至 12 点钟位
    for (let k = 0; k < 60; k++) {
      const a = rad(-180 + k * 6);
      f.dot(cx + R * Math.cos(a) * 0.9, cy + R * Math.sin(a) * 0.9, 3, ICE, 0.6, 0.3);
    }
    const mv = easeOutBackK(phase(t, 54.58, 54.96), 1.3);
    const mx = lerp(0.50 * BASE_W, cx, mv);
    const my = lerp(0.50 * BASE_H, cy - R * 0.9 * 0.35, mv);
    f.pline([[mx - 6, my], [mx + 6, my], [mx, my + 12]], WARM, 1, 0.95, 1.0, BG_DEEP, true);

    // ③ 主词 4px 采样 3,150 点注入两弧（40% 右 / 60% 左）
    const ghost = 1.0 - clamp01(phase(t, 54.35, 54.42));
    if (ghost > 0.02) c.W.drawPlain(f, ICE, { alpha: ghost, glowK: 0.35 * ghost });
    const p3 = easeOutQuart(phase(t, 54.58, 54.96));
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const side = i % 5 < 2 ? 1 : -1;
      const u = (i % 300) / 299.0;
      const a = rad(-32 * side * Math.sin(u * Math.PI * 0.5));
      dp.push([lerp(c.pts[i][0], cx + side * R * 0.92 * Math.cos(a) * Math.sin(u * Math.PI * 0.5), p3),
               lerp(c.pts[i][1], cy + R * 0.92 * Math.sin(a) * Math.sin(u * Math.PI * 0.5), p3)]);
      al.push(0.7);
    }
    f.pts(dp, 2.0, ICE, 1, 0.5, BG_DEEP, al);

    // ④ 残余轴段收进弧根
    const a_ = 0.4 * (1 - clamp01(phase(t, 54.27, 54.60)));
    for (let i = 0; i < 400; i++) {
      const xx = lerp(0.06 * BASE_W, 0.94 * BASE_W, i / 399.0);
      f.dot(xx, 0.56 * BASE_H, 2, GREY, a_, 0.2);
    }
    if (t >= 54.96) {
      const pu = 1.0 + 0.15 * Math.sin(Math.PI * clamp01(phase(t, 54.96, 55.08)));
      f.dot(mx, my, 8 * pu, WARM, 0.5, 1.0);
    }
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t < 54.34) f.text(0.06 * BASE_W, 0.56 * BASE_H - 70, 'dir:−1', mf.font, GREY, 0.55);
    const mf3 = fontOf('JetBrains Mono', 20, dpr);
    if (t >= 54.88) f.text(0.78 * BASE_W, 0.90 * BASE_H, 'MORPH→orbit', mf3.font, GREY, 0.6);

    corners(f, 'T+54.27s', CHAPTER, `seed:${SEEDS.SHOT_052} · 3150pt`, 'MORPH');
    const k = 0.42 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 54.58, 54.82)));
    return { bloomR: 9.0, bloomK: Math.min(0.54, k), grain: 5.0, scan: 0.04 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_053  `55.08–56.1104` ｜ 两轨道合并 620×380 椭圆 + 96 节点
   ══════════════════════════════════════════════════════════════ */
const SHOT_053 = {
  id: 'SHOT_053', start: 55.08, end: 56.1104,
  seedHex: SEEDS.SHOT_053, chapter: CHAPTER, status: 'UNITE',
  lyric: 'And we can unite',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    this._c = {
      W: new Word(ctx, ['And we can', 'unite'], 164, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.24], lineStep: 1.02 * 164,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const RX = 310.0, RY = 190.0;
    const merge = easeInOutCubic(phase(t, 55.08, 55.34));
    const lock = easeOutQuart(phase(t, 55.34, 55.86));

    // ① 合并轨道 620×380 闭合椭圆 + 96 节点
    const ellipse = [];
    for (let i = 0; i < 240; i++) {
      const a = (i * Math.PI * 2) / 240;
      ellipse.push([cx + RX * merge * Math.cos(a), cy + RY * merge * Math.sin(a)]);
    }
    f.pline(ellipse, ICE, 1.5, 0.9, 0.6, BG_DEEP, true);
    const nNodes = Math.floor(lerp(0, 96, lock));
    for (let i = 0; i < nNodes; i++) {
      const a = (i * Math.PI * 2) / 96;
      f.dot(cx + RX * Math.cos(a), cy + RY * Math.sin(a), 3, CYAN, 0.9, 0.5);
    }

    // ② 双天体对向运行 + 24px 拖尾
    for (let k = 0; k < 2; k++) {
      const col = k === 0 ? CYAN : MOOD;
      const w = k === 0 ? 1.0 : -1.0;
      const a = rad(90 * k + w * 120 * (t - 55.34));
      f.dot(cx + RX * Math.cos(a), cy + RY * Math.sin(a), 7, col, 1, 1.0);
      for (let j = 0; j < 8; j++) {
        const aa = a - w * j * 0.04;
        f.dot(cx + RX * Math.cos(aa), cy + RY * Math.sin(aa), 2, col, 0.9 - j * 0.1, 0.4);
      }
    }

    // ③ 会合标记 r=10 双环（3 点钟位）
    const mx = cx + RX, my = cy;
    const pu = 1.0 + 0.22 * Math.sin(Math.PI * clamp01(phase(t, 55.86, 56.02)));
    f.ell(mx, my, 10 * pu, 10 * pu, WARM, 2, 1.0, 1.0);
    f.ell(mx, my, 14 * pu, 14 * pu, WARM, 1, 0.6, 0.6);

    // ④ 合并前残弧 + 3,150 粒子（900 转节点补光 / 2,250 沉入背景星尘）
    for (const side of [-1, 1]) {
      const a_ = 0.30 * (1 - clamp01(phase(t, 55.08, 55.34)));
      if (a_ > 0.02) {
        f.pline(ringPtsDeg(cx, cy, 430, 40, side > 0 ? 200 : -20, side > 0 ? 260 : 40),
                GREY, 1, a_, 0.2);
      }
    }
    const seed = SC.seed('SHOT_053');
    for (let i = 0; i < 3150; i++) {
      const r = new Rng(seed, 'dust', i);
      const a = r.range(0, Math.PI * 2) + 0.2 * (t - 55.08);
      const rr = r.range(60, 460);
      if (i % 7 < 2) f.dot(cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.7, 2, ICE, 0.45, 0.3);
      else f.dot(cx + rr * Math.cos(a), cy + rr * Math.sin(a) * 0.7, 2, ICE, 0.12);
    }

    // 主词（unite 55.72 变情绪紫）
    c.W.draw(f, t, {
      t0: 55.08, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li) => (t >= 55.72 && li === 1 ? MOOD : ICE), glowK: 0.35,
    });
    const mf = fontOf('JetBrains Mono', 46, dpr);
    f.text(mx - 120, my + 26, 'merge:2→1', mf.font, GREY, 0.55);

    corners(f, 'T+55.08s', CHAPTER, `seed:${SEEDS.SHOT_053} · nodes:96`, 'UNITE');
    return {
      bloomR: 9.0,
      bloomK: 0.44 + bpulse(t, beatsIn(beats, this.start, this.end), 0.05, 0.06),
      grain: 5.0,
      scan: 0.04,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_054  `56.1104–56.92` ｜ 椭圆解体 + 4,396 池分 5 股同心环
   ══════════════════════════════════════════════════════════════ */
const SHOT_054 = {
  id: 'SHOT_054', start: 56.1104, end: 56.92,
  seedHex: SEEDS.SHOT_054, chapter: CHAPTER, status: 'NEST',
  lyric: 'And we can unite',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['And we can', 'unite'];
    const seed = SC.seed('SHOT_054');
    const pts = [];
    for (const q of textPoints(LINES, 164, 'Inter Semi-Bold', 0.04, 'left', 'baseline_first',
                               [0.10, 0.24], 1.02 * 164, { step: 4, n: 3400 })) {
      pts.push([q[0], q[1]]);
    }
    for (let i = 0; i < 996; i++) {
      const r = new Rng(seed, 'old', i);
      const a = r.range(0, Math.PI * 2);
      pts.push([0.50 * BASE_W + 310 * Math.cos(a), 0.50 * BASE_H + 190 * Math.sin(a)]);
    }
    this._c = {
      pts,
      W: new Word(ctx, LINES, 164, {
        weight: 'Inter Semi-Bold', trackEm: 0.04, dpr: 1, h: 'left',
        v: 'baseline_first', anchor: [0.10, 0.24], lineStep: 1.02 * 164,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const RADII = [52, 104, 168, 244, 336];
    const LAYERS = 5;
    const spin = [3.0, -2.0, 1.4, -1.0, 0.6];

    // ① 椭圆解体为点链；② 主词 4px 采样；③ 4,396 池分 5 股吸附
    const ghost = 1.0 - clamp01(phase(t, 56.19, 56.26));
    if (ghost > 0.02) {
      c.W.drawPlain(f, (li) => (li === 1 ? MOOD : ICE), { alpha: ghost, glowK: 0.35 * ghost });
    }
    for (let L = 0; L < LAYERS; L++) {
      const st = 56.38 + L * 0.026;
      const pp = easeOutQuart(clamp01((t - st) / 0.30));
      const isSq = L === 1 || L === 3;
      const col = isSq ? BV : CYAN;
      if (pp > 0.01) {
        const a0 = spin[L] * 60 * Math.max(0.0, t - 56.78);
        const ptsL = isSq
          ? superellipse(180, cx, cy, RADII[L], RADII[L], 8.0, a0)
          : ringPtsDeg(cx, cy, RADII[L], 180, a0, a0 + 360);
        f.pline(ptsL, col, 1, 0.8 * pp, 0.4, BG_DEEP, true);
      }
    }

    // 层间十字轴
    for (const [ax, ay] of [[1, 0], [0, 1]]) {
      f.line(cx - 336 * ax, cy - 336 * ay, cx + 336 * ax, cy + 336 * ay, ICE, 1, 0.40);
    }

    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const L = i % LAYERS;
      const st = 56.38 + L * 0.026;
      const pp = easeOutQuart(clamp01((t - st) / 0.30));
      const a = pymod(i * 0.618, 1.0) * Math.PI * 2;
      dp.push([lerp(c.pts[i][0], cx + RADII[L] * Math.cos(a), pp),
               lerp(c.pts[i][1], cy + RADII[L] * Math.sin(a), pp)]);
      al.push(0.6);
    }
    f.pts(dp, 2.0, ICE, 1, 0.4, BG_DEEP, al);

    // 双天体 5px 嵌在 L1 外侧对向绕行
    for (let k = 0; k < 2; k++) {
      const a = rad(120 * k + (k ? 120 : -120) * (t - 56.78));
      f.dot(cx + 70 * Math.cos(a), cy + 70 * Math.sin(a), 5, k === 0 ? CYAN : MOOD, 1, 1.0);
    }
    f.dot(cx, cy, 6, WARM, 1, 1.0);

    const mf = fontOf('JetBrains Mono', 46, dpr);
    if (t < 56.17) f.text(cx - 120, cy + 230, 'merge:2→1', mf.font, GREY, 0.55);
    if (t >= 56.74) {
      const n_ = Math.floor(clamp01(phase(t, 56.74, 56.92)) * 5) * 2;
      f.text(cx + 200, cy + 200, 'depth:5'.slice(0, Math.max(2, n_)), mf.font, GREY, 0.6);
    }

    corners(f, 'T+56.11s', CHAPTER, `seed:${SEEDS.SHOT_054} · 4396pt`, 'NEST');
    const k = 0.44 + 0.12 * Math.sin(Math.PI * clamp01(phase(t, 56.38, 56.66)));
    return { bloomR: 9.0, bloomK: Math.min(0.56, k), grain: 5.0, scan: 0.05 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_055  `56.92–58.208` ｜ 五层结构穿透下潜 + 穿层光圈
   ══════════════════════════════════════════════════════════════ */
const SHOT_055 = {
  id: 'SHOT_055', start: 56.92, end: 58.208,
  seedHex: SEEDS.SHOT_055, chapter: CHAPTER, status: 'DIVE',
  lyric: 'So deeply so deeply',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const seed = SC.seed('SHOT_055');
    const dots = [];
    for (let i = 0; i < 240; i++) {
      const r = new Rng(seed, 'dots', i);
      dots.push([r.range(-1, 1), r.range(-1, 1)]);
    }
    const dust = [];
    for (let i = 0; i < 120; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, 1), r.range(0, 1)]);
    }
    this._c = {
      dots, dust,
      W: new Word(ctx, ['So deeply', 'so deeply'], 156, {
        weight: 'Inter Extra-Bold', trackEm: 0.03, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.42], lineStep: 1.0 * 156,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;
    const dive = t < 58.02 ? 1.0 : 0.35;
    const zoomT = (t - 56.92) * 0.62 * dive;

    // 五层结构：L1 时钟刻度 / L2 网格 / L3 波形 / L4 点阵 / L5 微核心
    for (let L = 0; L < 5; L++) {
      const z = pymod(zoomT + L * 0.2, 1.0);
      const scale = 0.38 + 2.6 * z;
      const a_ = clamp01(1.15 - z * 1.3) * (z < 0.85 ? 1.0 : Math.max(0.0, (1.0 - z) / 0.15));
      if (a_ <= 0.02) continue;
      const r = 200 * scale;
      if (L === 0) {
        for (let k = 0; k < 48; k++) {
          const ang = rad(k * 7.5);
          f.line(cx + r * 0.9 * Math.cos(ang), cy + r * 0.9 * Math.sin(ang),
                 cx + r * Math.cos(ang), cy + r * Math.sin(ang), CYAN, 1.5, a_, 0.4);
        }
      } else if (L === 1) {
        for (let i = 0; i < 13; i++) {
          f.line(cx - r * 0.7 + (i * (1.4 * r * 0.7)) / 12, cy - r * 0.7,
                 cx - r * 0.7 + (i * (1.4 * r * 0.7)) / 12, cy + r * 0.7, BV, 1, 0.25 * a_);
          f.line(cx - r * 0.7, cy - r * 0.7 + (i * (1.4 * r * 0.7)) / 12,
                 cx + r * 0.7, cy - r * 0.7 + (i * (1.4 * r * 0.7)) / 12, BV, 1, 0.25 * a_);
        }
      } else if (L === 2) {
        const pl = [];
        for (let i = 0; i < 48; i++) {
          pl.push([cx - r * 0.7 + (i * (1.4 * r * 0.7)) / 47,
                   cy - 18 * scale * Math.sin((1.5 * Math.PI * 2 * i) / 47)]);
        }
        f.pline(pl, CYAN, 2, a_, 0.5);
      } else if (L === 3) {
        for (let i = 0; i < 240; i++) {
          f.dot(cx + c.dots[i][0] * r * 0.6, cy + c.dots[i][1] * r * 0.6, 2, BV, 0.6 * a_, 0.3);
        }
      } else {
        f.ell(cx, cy, 30 * scale, 30 * scale, ICE, 2, a_, 0.7);
        f.dot(cx, cy, 5 * scale, WARM, a_, 1.0);
      }
    }

    // 穿层光圈
    for (let k = 0; k < 3; k++) {
      const age = pymod(t - 56.92, 0.42) - k * 0.14;
      if (age >= 0 && age <= 0.24) {
        const rr = 900 * easeOutQuad(age / 0.24);
        f.ell(cx, cy, rr, rr, ICE, 1, 0.5 * (1 - age / 0.24), 0.6);
      }
    }

    // 双天体降为 12% 星尘
    for (const d of c.dust) {
      f.dot(d[0] * BASE_W, d[1] * BASE_H, 2, ICE, 0.12);
    }

    // 主词（57.14 主青 → 57.88 情绪紫）
    c.W.draw(f, t, {
      t0: 56.92, stagger: 0.0, dur: 0.001, dy: 0, ease: linear, cut: true,
      color: (li, ci) => {
        if (t >= 57.88 && ci >= 3) return MOOD;
        if (t >= 57.14 && ci >= 3) return CYAN;
        return ICE;
      },
      glowK: 0.35,
    });
    const depth = 1 + Math.min(4, Math.floor(clamp01(phase(t, 56.92, 58.02)) * 4.99));
    const mf = fontOf('JetBrains Mono', 44, dpr);
    f.text(cx - 120, cy + 120, `depth:${depth}/5`, mf.font, GREY, 0.55);

    corners(f, 'T+56.92s', CHAPTER, `seed:${SEEDS.SHOT_055} · depth:5`, 'DIVE');
    return {
      bloomR: 9.0,
      bloomK: 0.40 + 0.20 * ringNearPct(t, [57.14, 57.88], 0.12),
      grain: 5.0,
      scan: 0.06,
    };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_056  `58.208–59.22` ｜ 8,196 点 L5→L1 顺序内爆 → 终点根光点
   ══════════════════════════════════════════════════════════════ */
const SHOT_056 = {
  id: 'SHOT_056', start: 58.208, end: 59.22,
  seedHex: SEEDS.SHOT_056, chapter: CHAPTER, status: 'ROOT',
  lyric: 'So deeply so deeply',
  _c: null,

  _init(ctx) {
    if (this._c) return this._c;
    const LINES = ['So deeply', 'so deeply'];
    const seed = SC.seed('SHOT_056');
    const pts = [];
    for (const q of textPoints(LINES, 156, 'Inter Extra-Bold', 0.03, 'center', 'center',
                               [0.50, 0.42], 1.0 * 156, { step: 4, n: 3800 })) {
      pts.push([q[0], q[1]]);
    }
    for (let i = 0; i < 4396; i++) {
      const r = new Rng(seed, 'core', i);
      const a = r.range(0, Math.PI * 2);
      const L = Math.floor(r.range(0, 5));
      pts.push([0.50 * BASE_W + (52 + L * 71) * Math.cos(a),
                0.50 * BASE_H + (52 + L * 71) * Math.sin(a)]);
    }
    this._c = {
      pts,
      W: new Word(ctx, LINES, 156, {
        weight: 'Inter Extra-Bold', trackEm: 0.03, dpr: 1, h: 'center',
        v: 'center', anchor: [0.50, 0.42], lineStep: 1.0 * 156,
      }),
    };
    return this._c;
  },

  draw(ctx, gctx, t, dpr) {
    const c = this._init(ctx);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const rx = 0.08 * BASE_W, ry = 0.88 * BASE_H;
    const cx = 0.50 * BASE_W, cy = 0.50 * BASE_H;

    // ① 微核心定格 2 帧 + ② 主词采样（与 4,396 核粒子合并 8,196）
    if (t < 58.29) {
      c.W.drawPlain(f, (li, ci) => (ci >= 3 ? MOOD : ICE), { alpha: 1.0, glowK: 0.35 });
      f.ell(cx, cy, 30, 30, ICE, 2, 0.9, 0.7);
    }

    // ③ L5→L1 顺序内爆（每层 40ms 延迟），整体向 (8%,88%) 位移 62%W
    const step = easeInExpo(phase(t, 58.54, 59.02));
    const shrink = easeInExpo(phase(t, 58.54, 59.02));
    const tx0 = lerp(cx, rx, 0.62);
    const ty0 = lerp(cy, ry, 0.62);
    const dp = [], al = [];
    for (let i = 0; i < c.pts.length; i++) {
      const x = c.pts[i][0], y = c.pts[i][1];
      const L = 4 - (i % 5);
      const st = 58.54 + L * 0.04;
      const pp = easeInExpo(clamp01((t - st) / 0.42));
      const nx = lerp(cx, tx0, step) + (x - cx) * (1 - shrink) * 0.28;
      const ny = lerp(cy, ty0, step) + (y - cy) * (1 - shrink) * 0.28;
      dp.push([lerp(x, nx, pp), lerp(y, ny, pp)]);
      al.push(0.5 * (1 - 0.6 * step));
    }
    f.pts(dp, 2.0, ICE, 1, 0.5, BG_DEEP, al);

    // ④ 内爆残影 5 圈 + 终点根光点（十字 + r=10 蓝紫环 + 5px 暖心）
    const a_ = 0.20 * (1 - clamp01(phase(t, 58.54, 59.02)));
    if (a_ > 0.02) {
      for (let k = 0; k < 5; k++) {
        const rr = (96 + k * 60) * (1 - step * 0.7);
        f.ell(lerp(cx, rx, step), lerp(cy, ry, step), rr, rr, GREY, 1, a_);
      }
    }
    if (t >= 59.02) {
      const on = Math.floor((t - 59.02) / 0.07) % 2 === 0;
      const pu = 1.0 + 0.3 * Math.sin(Math.PI * clamp01(phase(t, 59.02, 59.08)));
      f.line(rx - 14 * pu, ry, rx + 14 * pu, ry, ICE, 1.5, 1.0, 1.0);
      f.line(rx, ry - 14 * pu, rx, ry + 14 * pu, ICE, 1.5, 1.0, 1.0);
      f.ell(rx, ry, 10, 10, BV, 1.5, on ? 0.95 : 0.6, 0.8);
      f.dot(rx, ry, 5, WARM, 1, 1.0);
    }
    const mf = fontOf('JetBrains Mono', 44, dpr);
    if (t < 58.27) f.text(cx - 120, cy + 120, 'depth:5/5', mf.font, GREY, 0.55);

    corners(f, 'T+58.21s', CHAPTER, `seed:${SEEDS.SHOT_056} · 8196pt`, 'ROOT');
    let k = 0.46 + 0.14 * Math.sin(Math.PI * clamp01(phase(t, 58.54, 58.88)));
    k = lerp(k, 0.52, clamp01(phase(t, 58.88, 59.22)));
    return {
      bloomR: 10.0,
      bloomK: k,
      grain: 5.0,
      scan: lerp(0.06, 0.02, clamp01(phase(t, 58.54, 59.22))),
    };
  },
};

export const CH02_SHOTS = [
  SHOT_022, SHOT_023, SHOT_024, SHOT_025, SHOT_026, SHOT_027,
  SHOT_028, SHOT_029, SHOT_030, SHOT_031, SHOT_032, SHOT_033,
  SHOT_034, SHOT_035, SHOT_036, SHOT_037, SHOT_038, SHOT_039, SHOT_040,
  SHOT_041, SHOT_042, SHOT_043, SHOT_044, SHOT_045, SHOT_046, SHOT_047, SHOT_048,
  SHOT_049, SHOT_050, SHOT_051, SHOT_052, SHOT_053, SHOT_054, SHOT_055, SHOT_056,
];
export { SC as CH02_SC, CAM as CH02_CAM, SEEDS as CH02_SEEDS };
