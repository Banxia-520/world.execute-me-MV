/**
 * ch05.js — 第 05 章 IDENTITY / GENDER（镜头 094–109）
 *
 * 自 Python 版 render/scenes/ch05_identity.py 移植。
 * 本章 Python 使用自有 Kit API，这里用 `Kit` 适配器逐行对齐，
 * 语义与 Python 版一致（适配器见 kit.js）。
 */
import {
  BASE_W, BASE_H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET as BV,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix,
  easeOutCubic, easeInOutCubic, easeOutExpo, easeOutQuad, easeInQuad,
  easeInCubic, rad, easeInOutSine, easeOutBack, easeInOutQuad, easeInOutQuint, easeInExpo,
} from './core.js';
import * as P from './primitives.js';
import { Kit, fontOf, beatsIn } from './kit.js';

const CHAPTER = 'ch05/12';
const FONT_MONO = 'JetBrains Mono';
const FONT_SEMI = 'Inter Semi-Bold';
const FONT_BOLD = 'Inter Bold';
const FONT_XBOLD = 'Inter Extra-Bold';

const SEEDS = {
  SHOT_094: '0000094A', SHOT_095: '0000095B', SHOT_096: '0000096C',
  SHOT_097: '0000097D', SHOT_098: '0000098E', SHOT_099: '0000099F',
  SHOT_100: '0000100A', SHOT_101: '0000101B', SHOT_102: '0000102C',
  SHOT_103: '0000103D', SHOT_104: '0000104F', SHOT_105: '0000105F',
  SHOT_106: '0000106B', SHOT_107: '0000107A', SHOT_108: '0000108C',
  SHOT_109: '0000109D',
};

/** 文本宽度（对应 Python 的 font.getlength） */
function textWidth(fontStr, str) {
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = fontStr;
  return cv.measureText(str).width;
}

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

/** 把文字采样为粒子点阵（对应 Python 的 glyph_points）
 *  `targetH` 为目标墨迹高度：先量当前字号下的墨迹高，再等比缩放到目标。
 */
function glyphPoints(weight, px, text, n, center, targetH = null) {
  let size = px;
  if (targetH != null) {
    const fo = fontOf(weight, Math.max(2, Math.round(px)), 1);
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = fo.font;
    const mm = cv.measureText(text);
    const ih = (mm.actualBoundingBoxAscent || px * 0.72)
             + (mm.actualBoundingBoxDescent || 0);
    if (ih > 0) size = (px * targetH) / ih;
  }
  const fo2 = fontOf(weight, Math.max(2, Math.round(size)), 1);
  const pts = P.sampleTextPoints(text, fo2.font, 100000, { step: 2, dpr: 1 });
  if (!pts.length) return [];
  // 平移到指定中心
  let mx = 0, my = 0;
  for (const p of pts) { mx += p[0]; my += p[1]; }
  mx /= pts.length; my /= pts.length;
  const shifted = pts.map((p) => [center[0] + (p[0] - mx), center[1] + (p[1] - my)]);
  const out = [];
  if (n <= shifted.length) {
    for (let i = 0; i < n; i++) out.push(shifted[Math.trunc((i * shifted.length) / n)]);
  } else {
    for (let i = 0; i < n; i++) out.push(shifted[i % shifted.length]);
  }
  return out;
}

const SC = {
  beatMap: {},
  beats(id) { return this.beatMap[id] || []; },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_094  `88.59–89.4916` ｜ 面板展开 + 三枚枚举芯片 F/M 交换
   ══════════════════════════════════════════════════════════════ */
const SHOT_094 = {
  id: 'SHOT_094', start: 88.59, end: 89.4916,
  seedHex: SEEDS.SHOT_094, chapter: CHAPTER, status: 'SWAP',
  lyric: 'Switch my gender / 切换我的性别',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_094 = beatsIn(beats, this.start, this.end);
    this._c = { pcx: 0.58 * BASE_W, pcy: 0.48 * BASE_H,
                pw: 0.40 * BASE_W, ph: 0.44 * BASE_H,
                rail: [0.10 * BASE_W, 0.24 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p1 = easeOutExpo(phase(t, 88.59, 88.78));
    const p2 = easeInOutCubic(phase(t, 88.78, 89.18));
    const p3 = phase(t, 89.18, 89.4916);
    const { pcx, pcy, pw, ph, rail } = c;
    const x0 = pcx - pw / 2, y0 = pcy - ph / 2;
    const x1 = x0 + pw * p1;

    // 面板自导轨顶端向右展开
    K.line(rail, [rail[0], y0 + ph * 0.5], GREY, 2.0, 0.7);
    if (p1 > 0.001) {
      K.rectCenter((x0 + x1) / 2, (y0 + (y0 + ph)) / 2, x1 - x0, ph,
                   BV, 2.0, 0.95, 0.22, 12);
    }
    // 主词两行
    K.word_block(FONT_SEMI, 150, ['Switch my gender'], 0.10 * BASE_W,
                 [0.30 * BASE_H], 0.04, 88.59, t,
                 { per_char: 0.016,
                   accents: [[['Switch my ', ICE], ['gender', CYAN]]] });

    // 面板内容：IDENTITY 行 + 三枚枚举芯片
    if (p1 > 0.55) {
      const aP = clamp01((p1 - 0.55) / 0.45);
      K.textKit(FONT_MONO, 18, 'IDENTITY: enum', x0 + 28, y0 + 52, ICE, 0.85 * aP);
      const chipY = y0 + 150;
      const cxs = [x0 + 120, x0 + 288, x0 + 456];
      const fx = lerp(cxs[0], cxs[1], p2);
      const mx = lerp(cxs[1], cxs[0], p2);
      for (const [cx, lab, act] of [[fx, 'F', true], [mx, 'M', true], [cxs[2], 'SELF', false]]) {
        let blink = 1.0;
        if (!act && t >= 89.18) {
          blink = (steps(t, 3, 89.18, 89.40) % 2 === 0) ? 0.35 : 1.0;
        }
        if (act) {
          K.rectCenter(cx, chipY, 96, 40, CYAN, 1.5, 0.95 * aP, 0.30, 6);
          K.textKit(FONT_MONO, 22, lab, cx, chipY + 8, ICE, 0.95 * aP, 0, 'center');
        } else {
          // UNDEFINED 芯片：虚线灰边
          for (let i = 0; i < 9; i++) {
            const sx = cx - 48 + (96 * i) / 9.0;
            if (i % 2 === 0) {
              K.line([sx, chipY - 20], [Math.min(sx + 12, cx + 48), chipY - 20],
                     GREY, 1.5, aP * blink);
              K.line([sx, chipY + 20], [Math.min(sx + 12, cx + 48), chipY + 20],
                     GREY, 1.5, aP * blink);
            }
          }
          for (let i = 0; i < 3; i++) {
            const sy = chipY - 20 + (40 * i) / 3.0;
            if (i % 2 === 0) {
              K.line([cx - 48, sy], [cx - 48, Math.min(sy + 13, chipY + 20)],
                     GREY, 1.5, aP * blink);
              K.line([cx + 48, sy], [cx + 48, Math.min(sy + 13, chipY + 20)],
                     GREY, 1.5, aP * blink);
            }
          }
          K.textKit(FONT_MONO, 22, lab, cx, chipY + 8, GREY, 0.9 * aP * blink, 0, 'center');
        }
      }
      // 光标块：贴住移动中的 [F]
      const curX = t < 89.18 ? fx - 60 : lerp(fx - 60, cxs[2] - 72, clamp01(p3 * 1.6));
      const em = beatEnv(t, SC.beats('SHOT_094'), 0.05);
      const s = 1.0 + 0.06 * em;
      K.rectCenter(curX, chipY, 12 * s, 28 * s, CYAN, 1.0, 1.0, 0.30);
      K.textKit(FONT_MONO, 20, 'SWAP:0x01', curX + 10, chipY + 42, GREY, 0.6);
    }
    K.micro({ TL: 'T+88.59s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_094} · enum:3`, BR: 'SWAP' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_095  `89.4916–90.14` ｜ 面板塌缩为残核 + 词粒子聚成球团 + F 三笔起笔点
   ══════════════════════════════════════════════════════════════ */
const SHOT_095 = {
  id: 'SHOT_095', start: 89.4916, end: 90.2,
  seedHex: SEEDS.SHOT_095, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Switch my gender / 切换我的性别',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_095 = beatsIn(beats, this.start, this.end);
    const src = P.cloudPoints(2600, SEEDS.SHOT_095, 'word', 'rect', [0.28, 0.28], 0.22, 0.4);
    const ball = P.cloudPoints(2600, SEEDS.SHOT_095, 'ball', 'sphere', [0.50, 0.46], 0.12, 1.0);
    this._c = { src, ball, C: [0.50 * BASE_W, 0.46 * BASE_H],
                pc: [0.58 * BASE_W, 0.48 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const p2 = easeInOutCubic(phase(t, 89.62, 89.98));
    const p3 = phase(t, 89.98, 90.14);
    const C = c.C;

    // 采样网格 4×2
    if (t <= 89.66) {
      const gx0 = 0.09 * BASE_W, gy0 = 0.22 * BASE_H;
      const gx1 = 0.52 * BASE_W, gy1 = 0.36 * BASE_H;
      for (let i = 0; i < 3; i++) {
        const yy = lerp(gy0, gy1, i / 2.0);
        K.line([gx0, yy], [gx1, yy], GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4.0);
        K.line([xx, gy0], [xx, gy1], GREY, 1.0, 0.30);
      }
    }
    // 主词（89.60 起淡出）
    const ACCS = [[['Switch my ', ICE], ['gender', CYAN]]];
    if (t < 89.60) {
      K.word_block(FONT_SEMI, 150, ['Switch my gender'], 0.10 * BASE_W,
                   [0.30 * BASE_H], 0.04, 88.59, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 89.60, 89.70));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 150, ['Switch my gender'], 0.10 * BASE_W,
                     [0.30 * BASE_H], 0.04, 88.59, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    // 面板塌缩为 8×8 残核
    const k = easeInCubic(phase(t, 89.62, 89.98));
    const pw = 0.40 * BASE_W * (1 - k) + 8.0 * k;
    const ph = 0.44 * BASE_H * (1 - k) + 8.0 * k;
    if (t < 90.02) {
      K.rectCenter(lerp(c.pc[0], C[0], k), lerp(c.pc[1], C[1], k), pw, ph,
                   BV, 2.0, 0.95 * (1 - clamp01(phase(t, 89.62, 89.70))),
                   0.22 * (1 - k), 12 * (1 - k));
    }
    // 词粒子 → 中心球团（横向保留 60%）
    const rot = rad(12.0 * clamp01(p3));
    const comp = 1.0 - 0.15 * clamp01(p3);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const bank = [[], []];
    for (let i = 0; i < c.src.length; i++) {
      const kk = clamp01(p2 * 1.15 - (i % 31) * 0.006);
      let bx = C[0] + (c.ball[i][0] - C[0]) * comp;
      const by = C[1] + (c.ball[i][1] - C[1]) * comp;
      const mx = lerp(c.src[i][0] * 0.60 + C[0] * 0.40, bx, kk);
      const my = lerp(c.src[i][1], by, kk);
      const dx = mx - C[0], dy = my - C[1];
      const rx = C[0] + dx * cr - dy * sr;
      const ry = C[1] + dx * sr + dy * cr;
      bank[i % 4 === 0 ? 0 : 1].push([rx, ry]);
    }
    K.dots(bank[0], 2.0, CYAN, 0.85, 0.36);
    K.dots(bank[1], 2.0, ICE, 0.85, 0.36);

    // 阶段 4：最亮 40 颗排成 F 三笔起笔点
    if (t >= 90.14) {
      const q = clamp01(phase(t, 90.14, 90.2));
      const fPts = glyphPoints(FONT_BOLD, 120, 'F', 40, C, 0.40 * BASE_H);
      for (const p of fPts) K.dots([p], 2.5, CYAN, 0.6 + 0.4 * q, 0.5);
    }
    K.micro({ TL: 'T+89.49s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_095} · sample:4px · 2600pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.40, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_096  `90.14–91.2192` ｜ F / M 字形粒子阵 + SELF 占位环 + 粒子互溶
   ══════════════════════════════════════════════════════════════ */
const SHOT_096 = {
  id: 'SHOT_096', start: 90.2, end: 91.2192,
  seedHex: SEEDS.SHOT_096, chapter: CHAPTER, status: 'MORPH',
  lyric: 'To F to M / 从 F 到 M',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_096 = beatsIn(beats, this.start, this.end);
    const FL = [0.32 * BASE_W, 0.46 * BASE_H];
    const FR = [0.68 * BASE_W, 0.46 * BASE_H];
    const gh = 0.40 * BASE_H;
    this._c = { FL, FR, gh,
                fPts: glyphPoints(FONT_BOLD, 200, 'F', 1300, FL, gh),
                mPts: glyphPoints(FONT_BOLD, 200, 'M', 1300, FR, gh) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { FL, FR, gh, fPts, mPts } = c;
    const p1 = easeOutExpo(phase(t, 90.2, 90.38));
    const p2 = easeInOutSine(phase(t, 90.38, 90.72));
    const shift = 0.06 * BASE_W * p2;

    // F / M 字形粒子阵（p1 期间自中心绽放）
    const fOut = [], mOut = [];
    for (let i = 0; i < fPts.length; i++) {
      const q = clamp01(p1 * 1.15 - (i % 37) * 0.004);
      fOut.push([lerp(FL[0], fPts[i][0] + shift, q), lerp(FL[1], fPts[i][1], q)]);
    }
    for (let i = 0; i < mPts.length; i++) {
      const q = clamp01(p1 * 1.15 - (i % 37) * 0.004);
      mOut.push([lerp(FR[0], mPts[i][0] - shift, q), lerp(FR[1], mPts[i][1], q)]);
    }
    K.dots(fOut, 2.5, CYAN, 0.9, 0.35);
    K.dots(mOut, 2.5, BV, 0.9, 0.30);
    // 笔画端点点亮
    K.dots([fPts[0], fPts[Math.trunc(fPts.length / 2)], fPts[fPts.length - 1]], 3.0, ICE, 0.8, 0.30);

    // SELF 占位环
    const mid = [(FL[0] + FR[0]) / 2, (FL[1] + FR[1]) / 2];
    const ringC = [mid[0], mid[1] - 0.30 * BASE_H];
    const rr = 0.05 * BASE_W;
    let blink = 1.0;
    if (t >= 90.38) blink = (steps(t, 2, 90.38, 90.72) % 2 === 0) ? 1.0 : 0.45;
    K.ring(ringC, rr, GREY, 1.5, 0.40 * blink, 0.0);
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * i) / 8;
      K.dots([[ringC[0] + rr * Math.cos(a), ringC[1] + rr * Math.sin(a)]],
             2.0, GREY, 0.5 * blink);
    }
    K.textKit(FONT_MONO, 16, 'SELF:?', ringC[0] + rr + 14, ringC[1] + 6, GREY, 0.6);
    // 底部两条引线指向占位环
    for (const base of [FL, FR]) {
      K.line([base[0], base[1] + gh / 2], ringC, GREY, 2.0, 0.30, 0.0);
    }
    // 末 3 帧中央细桥
    if (t >= 91.16) {
      K.line([FL[0] + 60, FL[1]], [FR[0] - 60, FR[1]], ICE, 1.0, 0.8, 0.30);
    }
    // 粒子互溶（各失重 20% 飘向占位环）
    if (t >= 90.72) {
      const out = [];
      for (let i = 0; i < 260; i++) {
        const src = fPts[(i * 5) % fPts.length];
        const q = clamp01(phase(t, 90.72, 91.2192) * 1.1 - (i % 23) * 0.01);
        out.push([lerp(src[0], ringC[0], q), lerp(src[1], ringC[1], q)]);
      }
      K.dots(out, 2.0, CYAN, 0.5, 0.20);
    }
    if (t >= 91.05) K.ring(ringC, rr * 1.25, GREY, 1.0, 0.5, 0.0);

    K.word_block(FONT_SEMI, 190, ['To F to M'], 0.10 * BASE_W, [0.72 * BASE_H],
                 0.08, 90.2, t,
                 { per_char: 0.012,
                   accents: [[['To ', ICE], ['F', CYAN], [' to ', ICE], ['M', BV]]] });
    K.micro({ TL: 'T+90.20s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_096} · glyph:F/M`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_097  `91.2192–92.02` ｜ SELF 字形逐段点亮 + 根节点引线
   ══════════════════════════════════════════════════════════════ */
const SHOT_097 = {
  id: 'SHOT_097', start: 91.2192, end: 92.02,
  seedHex: SEEDS.SHOT_097, chapter: CHAPTER, status: 'MORPH',
  lyric: 'To F to M / 从 F 到 M',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_097 = beatsIn(beats, this.start, this.end);
    const C = [0.50 * BASE_W, 0.46 * BASE_H];
    const ROOT = [0.18 * BASE_W, 0.78 * BASE_H];
    const seed = seedFromHex(SEEDS.SHOT_097);
    // 400 点互溶残余的轨道参数
    const orb = [];
    for (let i = 0; i < 400; i++) {
      const r = new Rng(seed, 'orb', i);
      orb.push([r.range(0, Math.PI * 2), r.range(0.85, 1.15)]);
    }
    // 1400 点背景尘
    const dust = [];
    for (let i = 0; i < 1400; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([r.range(0, BASE_W), r.range(0, BASE_H)]);
    }
    this._c = { C, ROOT, orb, dust,
                selfPts: glyphPoints(FONT_BOLD, 200, 'SELF', 1900, C, 0.40 * BASE_H * 0.55) };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, ROOT, selfPts } = c;
    const p3 = easeInOutCubic(phase(t, 91.72, 91.96));
    const gh = 0.40 * BASE_H;

    // S→E→L→F 逐段点亮（各 50ms）
    const segs = [[], [], [], []];
    for (let i = 0; i < selfPts.length; i++) {
      const seg = Math.trunc((i * 4) / selfPts.length);
      const st = 91.2192 + 0.05 * seg;
      if (t < st) continue;
      const col = i % 8 < 5 ? ICE : (i % 8 < 7 ? CYAN : BV);
      segs[seg].push({ p: selfPts[i], col });
    }
    for (const g of segs) {
      if (!g.length) continue;
      // 按颜色分组批量绘制
      for (const col of [ICE, CYAN, BV]) {
        const pts = g.filter((z) => z.col === col).map((z) => z.p);
        if (pts.length) K.dots(pts, 2.5, col, 0.9, 0.45);
      }
    }
    // 主词（91.42 起淡出）
    const ACCS = [[['To ', ICE], ['F', CYAN], [' to ', ICE], ['M', BV]]];
    if (t < 91.42) {
      K.word_block(FONT_SEMI, 190, ['To F to M'], 0.10 * BASE_W, [0.72 * BASE_H],
                   0.08, 90.2, t, { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 91.42, 91.50));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 190, ['To F to M'], 0.10 * BASE_W, [0.72 * BASE_H],
                     0.08, 90.2, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    if (t <= 91.74) {
      const gx0 = 0.08 * BASE_W, gy0 = 0.20 * BASE_H;
      const gx1 = 0.52 * BASE_W, gy1 = 0.34 * BASE_H;
      for (let i = 0; i < 3; i++) {
        const yy = lerp(gy0, gy1, i / 2.0);
        K.line([gx0, yy], [gx1, yy], GREY, 1.0, 0.30);
      }
      for (let j = 0; j < 5; j++) {
        const xx = lerp(gx0, gx1, j / 4.0);
        K.line([xx, gy0], [xx, gy1], GREY, 1.0, 0.30);
      }
    }
    // 互溶残余 400 点绕 SELF 慢轨道（0.4 rad/s）
    const orbPts = [];
    for (const [a0, rr] of c.orb) {
      const a = a0 + 0.4 * (t - 91.2192);
      const r = 0.08 * BASE_W * rr;
      orbPts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]);
    }
    K.dots(orbPts, 2.0, GREY, 0.5, 0.10);
    // SELF 微词 42px
    if (t >= 91.595 && t <= 91.85) {
      K.textKit(FONT_MONO, 42, 'SELF', C[0], C[1] + 16, ICE, 0.9, 0.05, 'center');
    }
    // 根节点引线
    const lineA = clamp01(phase(t, 91.60, 91.80));
    const tip = [C[0] + (ROOT[0] - C[0]) * lineA, C[1] + (ROOT[1] - C[1]) * lineA];
    K.line(C, tip, CYAN, 2.0, 0.9, 0.30);
    K.disc(tip, 4.0, CYAN, 0.95, 0.40);
    // 2,200 点流向左下根节点 + 背景尘
    if (t >= 91.72) {
      const flow = [];
      const nFlow = Math.min(2200, selfPts.length * 2);
      for (let i = 0; i < nFlow; i++) {
        const src = selfPts[i % selfPts.length];
        const q = clamp01(p3 * 1.15 - (i % 41) * 0.006);
        flow.push([lerp(src[0], ROOT[0], q), lerp(src[1], ROOT[1], q)]);
      }
      K.dots(flow, 2.0, CYAN, 0.8, 0.20);
      K.dots(c.dust, 2.0, GREY, 0.30 * p3, 0.0);
    }
    // 根节点方块
    if (t >= 91.72) {
      const sc = easeOutCubic(phase(t, 91.92, 92.0));
      K.rectCenter(ROOT[0], ROOT[1], 24 * (0.6 + 0.4 * sc), 24 * (0.6 + 0.4 * sc),
                   CYAN, 1.5, 0.95, 0.50);
    }
    // 8 向散线
    if (t >= 91.96) {
      for (let i = 0; i < 8; i++) {
        const a = (2 * Math.PI * i) / 8;
        for (let j = 0; j < 3; j++) {
          const q = clamp01(phase(t, 91.96 + 0.008 * j, 91.99 + 0.008 * j));
          const rr = 12 + 40 * j * q;
          K.line([ROOT[0] + rr * Math.cos(a) * 0.2, ROOT[1] + rr * Math.sin(a) * 0.2],
                 [ROOT[0] + rr * Math.cos(a), ROOT[1] + rr * Math.sin(a)],
                 CYAN, 1.0, 0.6 * (1 - q), 0.30);
        }
      }
    }
    K.micro({ TL: 'T+91.22s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_097} · sample:4px · 3600pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_098  `92.02–93.1008` ｜ 语法树：5 主枝 + 12 子枝 + 光流 + 3 新芽
   ══════════════════════════════════════════════════════════════ */
const MAIN_BRANCHES = [
  [[0.18, 0.78], [0.25, 0.62], [0.31, 0.50], [0.38, 0.40]],
  [[0.18, 0.78], [0.13, 0.60], [0.17, 0.44], [0.25, 0.30]],
  [[0.18, 0.78], [0.31, 0.80], [0.45, 0.72], [0.59, 0.66]],
  [[0.18, 0.78], [0.34, 0.70], [0.52, 0.52], [0.68, 0.38]],
  [[0.18, 0.78], [0.36, 0.86], [0.58, 0.84], [0.80, 0.76]],
];
const CMD_WORDS = ['do(){}', 'free()', 'rand()', 'goto:', '*'];
const SUB_PER_MAIN = [3, 2, 3, 2, 2];

/** 12 条子枝：自各主枝中段向外偏 60° 长出（确定性）。对应 Python 的 _sub_branches */
function subBranches() {
  const out = [];
  for (let bi = 0; bi < MAIN_BRANCHES.length; bi++) {
    const br = MAIN_BRANCHES[bi];
    for (let si = 0; si < SUB_PER_MAIN[bi]; si++) {
      const i0 = 1 + (si % 2);
      const [ax, ay] = br[i0];
      const [bx, by] = br[i0 + 1];
      const dx = bx - ax, dy = by - ay;
      const L = Math.hypot(dx, dy) || 1.0;
      let nx = -dy / L, ny = dx / L;
      if (si % 2 === 0) { nx = -nx; ny = -ny; }
      const ln = 0.062 + (0.030 * ((bi * 5 + si * 3) % 4)) / 3.0;
      out.push([[ax, ay], [ax + nx * ln, ay + ny * ln]]);
    }
  }
  return out;
}

const SHOT_098 = {
  id: 'SHOT_098', start: 92.02, end: 93.1008,
  seedHex: SEEDS.SHOT_098, chapter: CHAPTER, status: 'EXEC',
  lyric: 'And then do whatever / 然后做任何事',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_098 = beatsIn(beats, this.start, this.end);
    const ROOT = [0.18 * BASE_W, 0.78 * BASE_H];
    // 主枝折算为设备坐标
    const mains = MAIN_BRANCHES.map((br) => br.map(([fx, fy]) => [fx * BASE_W, fy * BASE_H]));
    // 子枝折算为设备坐标
    const subs = subBranches().map(([a, b]) => [
      [a[0] * BASE_W, a[1] * BASE_H], [b[0] * BASE_W, b[1] * BASE_H]]);
    this._c = { ROOT, mains, subs };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { ROOT, mains, subs } = c;
    const p4 = easeOutQuad(phase(t, 92.96, 93.1008));

    // 根节点
    K.rectCenter(ROOT[0], ROOT[1], 24, 24, CYAN, 1.5, 0.95, 0.40);
    K.rectCenter(ROOT[0], ROOT[1], 30, 30, ICE, 1.0, 0.7, 0.20, 2);
    // 5 条主枝（每枝延迟 60ms）
    const ends = [];
    for (let bi = 0; bi < mains.length; bi++) {
      const st = 92.02 + 0.06 * bi;
      const q = easeOutExpo(phase(t, st, st + 0.30));
      const pts = mains[bi];
      const m = Math.max(2, Math.trunc((pts.length - 1) * q) + 1);
      let segPts = pts.slice(0, m);
      if (q < 1.0 && m >= 2) {
        const f = ((pts.length - 1) * q) % 1.0 || 1.0;
        segPts = pts.slice(0, m - 1).concat([[
          lerp(pts[m - 2][0], pts[m - 1][0], f),
          lerp(pts[m - 2][1], pts[m - 1][1], f)]]);
      }
      const hi = bi === 0;
      const alpha = (t >= 92.72 && !hi) ? 0.35 : 0.9;
      K.seg(segPts, hi ? ICE : BV, 2.0, alpha, hi ? 0.40 : 0.22);
      if (q > 0 && q < 1.0) K.disc(segPts[segPts.length - 1], 4.0, ICE, 0.9, 0.35);
      ends.push(pts[pts.length - 1]);
    }
    // 命令节点 28×28 + 支端微词
    for (let bi = 0; bi < ends.length; bi++) {
      const e = ends[bi];
      if (t < 92.02 + 0.06 * bi + 0.30) continue;
      const grow = (bi === 0 && t >= 92.72) ? 40.0 : 28.0;
      if (bi === 0 && t >= 92.72) {
        const blink = 0.5 + 0.5 * (steps(t, 5, 92.72, 92.96) % 2);
        K.rectCenter(e[0], e[1], grow, grow, CYAN, 1.5, 0.95 * blink, 0.40);
      } else {
        K.rectCenter(e[0], e[1], grow, grow, CYAN, 1.5, 0.9, 0.24);
      }
      K.rectCenter(e[0] - grow / 2 + 6, e[1], 2.0, grow * 0.45, CYAN, 1.0, 0.9, 0);
      K.textKit(FONT_MONO, 14, CMD_WORDS[bi], e[0] + 12, e[1] + 20, GREY,
                bi === 0 ? 0.85 : 0.6);
    }
    // 12 条子枝 + 子节点
    for (let si = 0; si < subs.length; si++) {
      const st = 92.42 + 0.035 * si;
      if (t < st) continue;
      const q = easeOutCubic(phase(t, st, st + 0.14));
      const [pa, pb] = subs[si];
      const e = [lerp(pa[0], pb[0], q), lerp(pa[1], pb[1], q)];
      K.line(pa, e, GREY, 1.5, 0.8, 0.0);
      if (q >= 1.0) K.dots([pb], 6.0, BV, 0.9, 0.10);
    }
    // 高亮路径光流（30%W/s）
    if (t >= 92.42) {
      const fpts = mains[0];
      let total = 0.0;
      for (let i = 1; i < fpts.length; i++) {
        total += Math.hypot(fpts[i][0] - fpts[i - 1][0], fpts[i][1] - fpts[i - 1][1]);
      }
      const want = total * clamp01(((t - 92.42) * 0.30 * BASE_W) / Math.max(1.0, total));
      let run = 0.0;
      for (let i = 1; i < fpts.length; i++) {
        const d = Math.hypot(fpts[i][0] - fpts[i - 1][0], fpts[i][1] - fpts[i - 1][1]);
        if (run + d >= want) {
          const f = (want - run) / Math.max(1e-6, d);
          K.disc([lerp(fpts[i - 1][0], fpts[i][0], f),
                  lerp(fpts[i - 1][1], fpts[i][1], f)], 4.0, ICE, 1.0, 0.50);
          break;
        }
        run += d;
      }
    }
    // 3 条新芽
    if (t >= 92.96) {
      for (let i = 0; i < 3; i++) {
        const a = rad(-60 + 30 * i);
        const st = ends[0];
        const ln = 0.04 * BASE_W * p4;
        K.line(st, [st[0] + ln * Math.cos(a), st[1] + ln * Math.sin(a)], CYAN, 1.5, 0.85, 0.30);
      }
    }
    K.word_block(FONT_SEMI, 144, ['And then do whatever'], 0.10 * BASE_W, [0.14 * BASE_H],
                 0.05, 92.02, t,
                 { per_char: 0.012,
                   accents: [[['And then do ', ICE], ['whatever', CYAN]]] });
    K.micro({ TL: 'T+92.02s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_098} · branches:5 · leaf:12`, BR: 'EXEC' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_099  `93.1008–93.95` ｜ 枝干弯曲为 240° 圆弧 + 4000 点吸附 + 24 刻度
   ══════════════════════════════════════════════════════════════ */
const SHOT_099 = {
  id: 'SHOT_099', start: 93.1008, end: 93.95,
  seedHex: SEEDS.SHOT_099, chapter: CHAPTER, status: 'MORPH',
  lyric: 'And then do whatever / 然后做任何事',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_099 = beatsIn(beats, this.start, this.end);
    const src = P.cloudPoints(2400, SEEDS.SHOT_099, 'word', 'rect', [0.24, 0.20], 0.20, 0.3)
      .concat(P.cloudPoints(1600, SEEDS.SHOT_099, 'node', 'rect', [0.42, 0.78], 0.30, 0.3));
    const mains = MAIN_BRANCHES.map((br) => br.map(([fx, fy]) => [fx * BASE_W, fy * BASE_H]));
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.26 * BASE_W, src, mains };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R, src, mains } = c;
    const p1 = easeInQuad(phase(t, 93.1008, 93.30));
    const p2 = easeInOutCubic(phase(t, 93.30, 93.60));
    const p3 = easeOutCubic(phase(t, 93.60, 93.86));

    // 主词（93.30 起淡出）
    const ACCS = [[['And then do ', ICE], ['whatever', CYAN]]];
    if (t < 93.30) {
      K.word_block(FONT_SEMI, 144, ['And then do whatever'], 0.10 * BASE_W, [0.14 * BASE_H],
                   0.05, 92.02, t, { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 93.30, 93.38));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 144, ['And then do whatever'], 0.10 * BASE_W, [0.14 * BASE_H],
                     0.05, 92.02, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    // 枝干弯曲（贝塞尔化）
    for (let bi = 0; bi < mains.length; bi++) {
      const pts = mains[bi];
      const a0 = rad(-80 + 60 * bi);
      const arc = [];
      for (let i = 0; i < 25; i++) {
        const u = i / 24.0;
        const ang = a0 + rad(66.0 * u);
        const rr = R * (0.45 + 0.55 * u);
        arc.push([C[0] + rr * Math.cos(ang), C[1] + rr * Math.sin(ang)]);
      }
      const m = Math.max(2, Math.trunc(arc.length * clamp01(p2 * 1.2 - bi * 0.02)));
      const kk = clamp01(p2 * 1.3);
      const cur = arc.map((ap, i) => {
        const pp = pts[Math.min(i, pts.length - 1)];
        return [lerp(pp[0], ap[0], kk), lerp(pp[1], ap[1], kk)];
      });
      K.seg(cur.slice(0, m), BV, 2.0, 0.75 * (1 - 0.5 * p1), 0.20);
    }
    // 4000 点吸附到 240°→270° 圆周
    const span = lerp(240.0, 270.0, p3);
    const bvPts = [], greyPts = [];
    for (let i = 0; i < src.length; i++) {
      const u = i / Math.max(1, src.length - 1);
      const ang = rad(-90 - span / 2 + span * u);
      const tx = C[0] + R * Math.cos(ang);
      const ty = C[1] + R * Math.sin(ang);
      const q = clamp01(p2 * 1.15 - (i % 43) * 0.005);
      const p = [lerp(src[i][0], tx, q), lerp(src[i][1], ty, q)];
      if (i % 3) bvPts.push(p); else greyPts.push(p);
    }
    K.dots(bvPts, 2.0, BV, 0.85, 0.30);
    K.dots(greyPts, 2.0, GREY, 0.85, 0.30);
    // 根节点滑至 6 点钟位并变为亮点
    const tgt = [C[0], C[1] + R];
    const q = clamp01(phase(t, 93.10, 93.70));
    K.disc([lerp(0.18 * BASE_W, tgt[0], q), lerp(0.78 * BASE_H, tgt[1], q)],
           lerp(12.0, 16.0, q), CYAN, 0.95, 0.45);
    // 24 刻度
    for (let i = 0; i < 24; i++) {
      const st = 93.86 + 0.0037 * i;
      if (t < st) continue;
      const ang = rad(-90 - span / 2 + (span * i) / 23.0);
      K.rectCenter(C[0] + R * Math.cos(ang), C[1] + R * Math.sin(ang), 4, 4,
                   ICE, 0.5, 0.95, 0.35);
    }
    K.micro({ TL: 'T+93.10s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_099} · sample:4px · 4000pt`, BR: 'MORPH' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_100  `93.95–94.8012` ｜ 从 AM 到 PM：24 刻度表盘 + 双针 + 扫掠残扇
   ══════════════════════════════════════════════════════════════ */
const SHOT_100 = {
  id: 'SHOT_100', start: 93.95, end: 94.8012,
  seedHex: SEEDS.SHOT_100, chapter: CHAPTER, status: 'AM→PM',
  lyric: 'From AM to PM / 从早到晚',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_100 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_100);
    const rim = [];
    for (let i = 0; i < 960; i++) {
      const r = new Rng(seed, 'rim', i);
      rim.push([r.range(0, Math.PI * 2), 0.90 + 0.10 * r.next()]);
    }
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.26 * BASE_W, rim };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R } = c;
    const p1 = easeOutBack(phase(t, 93.95, 94.08), 1.2);
    const p2 = phase(t, 94.08, 94.58);
    const p3 = easeOutExpo(phase(t, 94.58, 94.72));
    const p4 = phase(t, 94.72, 94.8012);

    K.ring(C, R, BV, 1.5, 0.85, 0.24);
    // 960 颗环面尘
    const rimPts = c.rim.map(([a, rr]) => [C[0] + R * rr * Math.cos(a), C[1] + R * rr * Math.sin(a)]);
    K.dots(rimPts, 2.0, BV, 0.35, 0.0);
    // 24 刻度（AM 9 点 / PM 3 点加长）
    for (let i = 0; i < 24; i++) {
      const a = rad(-90 + (360 * i) / 24.0);
      const am = i === 18, pm = i === 6;
      const ln = (am || pm) ? 20.0 : 12.0;
      const col = (am || pm) ? CYAN : ICE;
      let dim = !pm ? 0.4 + 0.6 * (1 - p4) : 1.0;
      if (t >= 94.72 && pm) dim = 1.0;
      K.line([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)],
             [C[0] + (R + ln) * Math.cos(a), C[1] + (R + ln) * Math.sin(a)],
             col, (am || pm) ? 4.0 : 2.0, 0.9 * dim, 0.20);
    }
    // 扫掠残扇
    const sweepEnd = -90 + 360 * clamp01(p2);
    if (t >= 94.08) {
      const sector = [[C[0], C[1]]];
      for (let i = 0; i < 49; i++) {
        const a = rad(-90 + ((sweepEnd + 90) * i) / 48.0);
        sector.push([C[0] + R * 0.98 * Math.cos(a), C[1] + R * 0.98 * Math.sin(a)]);
      }
      K.poly(sector, CYAN, 0.01, 0.0, 0.0, CYAN, 0.12);
    }
    // 长针（减速抵达 PM 3 点钟）
    let angLong = -90 + 360 * (clamp01(p1) * 0.06 + p2);
    if (t >= 94.58) angLong = lerp(angLong, 0.0, p3);
    const lp = rad(angLong);
    const longR = 0.22 * BASE_W;
    K.line(C, [C[0] + longR * Math.cos(lp), C[1] + longR * Math.sin(lp)], CYAN, 3.0, 0.95, 0.38);
    K.disc([C[0] + longR * Math.cos(lp), C[1] + longR * Math.sin(lp)], 6.0, CYAN, 0.95, 0.38);
    // 短针（6 叉，94.58 起归位 0°）
    const shortR = 0.13 * BASE_W;
    if (t < 94.60) {
      const sp = rad(-90 + 4320 * (t - 93.95) * clamp01(p2));
      for (let i = 0; i < 6; i++) {
        const aa = sp + (i * Math.PI) / 3;
        K.line(C, [C[0] + shortR * Math.cos(aa), C[1] + shortR * Math.sin(aa)],
               WARM, 2.0, 0.20, 0.0);
      }
    } else {
      K.line(C, [C[0] + shortR, C[1]], WARM, 2.0, 0.9, 0.25);
    }
    K.disc(C, 5.0, ICE, 0.95, 0.35);
    // AM / PM 标签
    for (const [lab, aDeg, fade] of [['AM', 180.0, 1.0 - 0.7 * clamp01(p3)],
                                     ['PM', 0.0, 0.4 + 0.6 * clamp01(p3)]]) {
      const a = rad(aDeg);
      K.textKit(FONT_MONO, 42, lab,
                C[0] + (R - 0.03 * BASE_W) * Math.cos(a),
                C[1] + (R - 0.03 * BASE_W) * Math.sin(a) + 15,
                lab === 'AM' ? ICE : CYAN, fade, 0, 'center');
    }
    // 主词压在盘心
    K.word_block(FONT_SEMI, 150, ['From AM to PM'], 0.50 * BASE_W, [0.48 * BASE_H],
                 0.05, 93.95, t,
                 { per_char: 0.012, char_dur: 0.10, anchor: 'center',
                   accents: [[['From ', ICE], ['AM', CYAN], [' to ', ICE], ['PM', BV]]] });
    K.micro({ TL: 'T+93.95s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_100} · orbit:720°`, BR: 'AM→PM' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_101  `94.8012–95.47` ｜ 圆盘解体 → 3×2 描边矩阵 + 光标块
   ══════════════════════════════════════════════════════════════ */
const SHOT_101 = {
  id: 'SHOT_101', start: 94.8012, end: 95.47,
  seedHex: SEEDS.SHOT_101, chapter: CHAPTER, status: 'MORPH',
  lyric: 'From AM to PM / 从早到晚',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_101 = beatsIn(beats, this.start, this.end);
    // 矩阵整体避开主词（`From AM to PM` 150px 实测 1188px，x=10% 起 → 右缘 71.9%W）
    const MC = [0.783 * BASE_W, 0.48 * BASE_H];
    const cw = 96.0, chh = 72.0, gap = 16.0;
    const cells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        cells.push([MC[0] + (col - 0.5) * (cw + gap), MC[1] + (row - 1) * (chh + gap)]);
      }
    }
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], R: 0.26 * BASE_W, MC, cells, cw, chh, gap };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, R, MC, cells, cw, chh, gap } = c;
    const p1 = phase(t, 94.8012, 95.02);
    const p2 = easeInOutCubic(phase(t, 95.02, 95.26));
    const p3 = easeOutExpo(phase(t, 95.26, 95.42));
    const ACCS = [[['From ', ICE], ['AM', CYAN], [' to ', ICE], ['PM', BV]]];

    if (t < 95.02) {
      K.ring(C, R * (1 - 0.25 * p1), BV, 1.5, 0.85 * (1 - p1), 0.20);
      for (let i = 0; i < 24; i++) {
        const a = rad(-90 + (360 * i) / 24.0);
        K.line([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)],
               [C[0] + (R + 12) * Math.cos(a), C[1] + (R + 12) * Math.sin(a)],
               ICE, 2.0, 0.9 * (1 - p1), 0.15);
      }
      K.word_block(FONT_SEMI, 150, ['From AM to PM'], 0.50 * BASE_W, [0.48 * BASE_H],
                   0.05, 93.95, t,
                   { per_char: 0.0, char_dur: 0.001, anchor: 'center', accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 95.02, 95.10));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 150, ['From AM to PM'], 0.50 * BASE_W, [0.48 * BASE_H],
                     0.05, 93.95, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, anchor: 'center',
                       accents: ACCS });
      }
    }
    const place = ['A', 'B', 'ACTIVE', 'PASSIVE', 'LEAD', 'FOLLOW'];
    for (let ci = 0; ci < cells.length; ci++) {
      if (t < 95.02) continue;
      const [cx, cy] = cells[ci];
      const q = clamp01(p2 * 1.2 - ci * 0.03);
      if (q <= 0) continue;
      K.rectCenter(cx, cy, cw * q, chh * q, BV, 1.5, 0.9, 0.22, 6);
      if (t >= 95.26) K.rectCenter(cx, cy, cw, chh, BV, 2.0, 0.6 * p3, 0.30, 6);
      if (q >= 1.0) {
        K.textKit(FONT_MONO, 16, place[ci], cx, cy + 6, GREY, t < 95.26 ? 0.30 : 0.85, 0, 'center');
      }
    }
    if (t < 95.26) {
      const sp = rad(-90 + 360 * p1);
      const r1 = 0.22 * BASE_W, r2 = 0.13 * BASE_W;
      K.line(C, [C[0] + r1 * Math.cos(sp), C[1] + r1 * Math.sin(sp)],
             CYAN, 3.0, 0.9 * (1 - p1), 0.38);
      K.line(C, [C[0] + r2 * Math.cos(sp + Math.PI), C[1] + r2 * Math.sin(sp + Math.PI)],
             WARM, 2.0, 0.9 * (1 - p1), 0.25);
    }
    const tgt = t < 95.26 ? cells[0] : MC;
    let cur = [lerp(C[0], tgt[0], clamp01(p2 * 1.4)), lerp(C[1], tgt[1], clamp01(p2 * 1.4))];
    if (t >= 95.42) {
      const q = clamp01((t - 95.42) / 0.05);
      cur = [lerp(cur[0], MC[0], q), lerp(cur[1], MC[1], q)];
    }
    let blink = 1.0;
    if (t >= 95.42) blink = (steps(t, 2, 95.42, 95.47) % 2 === 0) ? 1.0 : 0.35;
    K.rectCenter(cur[0], cur[1], 12, 28, CYAN, 1.0, 0.95 * blink, 0.30);
    if (t >= 95.02) K.disc([MC[0] + cw / 2 + 8, MC[1] - (chh + gap / 2)], 6.0, ICE, 0.95, 0.35);
    K.micro({ TL: 'T+94.80s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_101} · sample:4px · 3600pt`, BR: 'MORPH' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_102  `95.47–96.7412` ｜ 3×2 角色矩阵 A/B 与 ACTIVE/PASSIVE 互换
   ══════════════════════════════════════════════════════════════ */
const SHOT_102 = {
  id: 'SHOT_102', start: 95.47, end: 96.7412,
  seedHex: SEEDS.SHOT_102, chapter: CHAPTER, status: 'SWAP',
  lyric: 'Oh switch my role / 哦，交换我的角色',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_102 = beatsIn(beats, this.start, this.end);
    this._c = { MC: [0.56 * BASE_W, 0.66 * BASE_H], cw: 180.0, chh: 72.0, gap: 56.0 };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { MC, cw, chh, gap } = c;
    const p1 = phase(t, 95.47, 95.72);
    const rows = [['A', 'B'], ['ACTIVE', 'PASSIVE'], ['LEAD', 'FOLLOW']];

    for (let ri = 0; ri < rows.length; ri++) {
      const cy = MC[1] + (ri - 1) * (chh + gap);
      for (let ci = 0; ci < 2; ci++) {
        const cx = MC[0] + (ci - 0.5) * (cw + gap);
        const act = (ri === 1 && ci === (t < 95.85 ? 0 : 1));
        if (act) K.rectCenter(cx, cy, cw, chh, CYAN, 1.5, 0.55, 0.10, 6);
        K.rectCenter(cx, cy, cw, chh, BV, 1.5, 0.9, 0.20, 6);
        if (ri === 0) {
          K.textKit(FONT_BOLD, 64, rows[ri][ci], cx, cy + 24, ICE, 0.95, 0.20, 'center');
        } else {
          K.textKit(FONT_MONO, 42, rows[ri][ci], cx, cy + 15, ICE, 0.95, 0, 'center');
        }
      }
      const ax = MC[0], A = 40;
      for (const sgn of [-1, 1]) {
        const y = cy + sgn * 12;
        K.line([ax - A / 2, y], [ax + A / 2, y], CYAN, 2.0, 0.6, 0.10);
        const tipx = ax + (sgn * A) / 2;
        K.line([tipx, y], [tipx - sgn * 10, y - 6], CYAN, 2.0, 0.6, 0.10);
        K.line([tipx, y], [tipx - sgn * 10, y + 6], CYAN, 2.0, 0.6, 0.10);
      }
    }
    const swapMid = easeInOutCubic(clamp01(phase(t, 95.72, 96.06)));
    const swapOut = easeInOutQuad(clamp01(phase(t, 96.06, 96.42)));
    K.textKit(FONT_MONO, 42, swapMid < 0.5 ? 'PASSIVE' : 'ACTIVE',
              MC[0] - (cw + gap) / 2, MC[1] + 15, ICE, 0.95, 0, 'center');
    K.textKit(FONT_MONO, 42, swapMid < 0.5 ? 'ACTIVE' : 'PASSIVE',
              MC[0] + (cw + gap) / 2, MC[1] + 15, ICE, 0.95, 0, 'center');
    const yTop = MC[1] - (chh + gap);
    K.textKit(FONT_BOLD, 64, swapOut < 0.5 ? 'B' : 'A',
              MC[0] - (cw + gap) / 2, yTop + 24, ICE, 0.95, 0.20, 'center');
    K.textKit(FONT_BOLD, 64, swapOut < 0.5 ? 'A' : 'B',
              MC[0] + (cw + gap) / 2, yTop + 24, ICE, 0.95, 0.20, 'center');
    const yBot = MC[1] + (chh + gap);
    K.textKit(FONT_MONO, 42, swapOut < 0.5 ? 'FOLLOW' : 'LEAD',
              MC[0] - (cw + gap) / 2, yBot + 15, ICE, 0.95, 0, 'center');
    K.textKit(FONT_MONO, 42, swapOut < 0.5 ? 'LEAD' : 'FOLLOW',
              MC[0] + (cw + gap) / 2, yBot + 15, ICE, 0.95, 0, 'center');
    let cur = [MC[0], MC[1]];
    if (t >= 95.47 && t < 95.72) {
      cur = [lerp(MC[0] - (cw / 2 + gap / 2), MC[0], clamp01(p1)), MC[1]];
    }
    K.rectCenter(cur[0], cur[1], 12, 28, CYAN, 1.0, 0.95, 0.30);
    if (t >= 96.42) {
      const bl = (steps(t, 3, 96.42, 96.70) % 2 === 0) ? 1.0 : 0.45;
      for (let ri = 0; ri < 3; ri++) {
        const cy = MC[1] + (ri - 1) * (chh + gap);
        K.rectCenter(MC[0] - (cw + gap) / 2, cy, cw, chh, BV, 1.5, 0.5 * bl, 0, 6);
      }
    }
    K.disc([MC[0] + cw / 2 + 8, yTop - 4], 6.0, ICE, 0.95, 0.35);
    K.word_block(FONT_SEMI, 156, ['Oh switch my role'], 0.10 * BASE_W, [0.48 * BASE_H],
                 0.04, 95.47, t,
                 { per_char: 0.012,
                   accents: [[['Oh ', ICE], ['switch', CYAN], [' my ', ICE], ['role', CYAN]]] });
    K.micro({ TL: 'T+95.47s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_102} · matrix:3×2`, BR: 'SWAP' });
    return { bloomR: 8.0, bloomK: 0.42, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_103  `96.7412–97.74` ｜ 格描边粒子流向左右双核 + 点云球自转
   ══════════════════════════════════════════════════════════════ */
const SHOT_103 = {
  id: 'SHOT_103', start: 96.7412, end: 97.74,
  seedHex: SEEDS.SHOT_103, chapter: CHAPTER, status: 'MORPH',
  lyric: 'Oh switch my role / 哦，交换我的角色',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_103 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_103);
    const MC = [0.56 * BASE_W, 0.66 * BASE_H];
    // 格描边粒子 1200 + 标签粒子 1800
    const src = [];
    for (let ri = 0; ri < 3; ri++) {
      for (let ci = 0; ci < 2; ci++) {
        for (let k = 0; k < 200; k++) {
          const a = (2 * Math.PI * k) / 200;
          src.push([MC[0] + Math.cos(a) * (90 + 20 * ci),
                    MC[1] + Math.sin(a) * (36 + 20 * ri)]);
        }
      }
    }
    for (let i = 0; i < 1800; i++) {
      const r = new Rng(seed, 'lab', i);
      src.push([r.range(MC[0] - 300, MC[0] + 300), r.range(MC[1] - 200, MC[1] + 200)]);
    }
    // 每点的目标偏移与球内点云
    const off = [], ball = [];
    for (let i = 0; i < src.length; i++) {
      const r = new Rng(seed, 'ball', i);
      off.push([0.09 * BASE_W * (r.next() - 0.5) * 2, 0.09 * BASE_W * (r.next() - 0.5) * 2]);
    }
    for (let i = 0; i < 900; i++) {
      const r = new Rng(seed, 'ring', i);
      ball.push([r.range(0, Math.PI * 2), 0.25 + 0.75 * r.next()]);
    }
    this._c = { MC, src, off, ball,
                L: [0.32 * BASE_W, 0.48 * BASE_H], R: [0.68 * BASE_W, 0.48 * BASE_H] };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { MC, L, R } = c;
    const p1 = phase(t, 96.7412, 96.96);
    const p2 = easeInOutCubic(phase(t, 96.96, 97.34));
    const p4 = phase(t, 97.60, 97.74);
    const ACCS = [[['Oh ', ICE], ['switch', CYAN], [' my ', ICE], ['role', CYAN]]];

    // 残留矩阵 + 主词
    if (t < 96.96) {
      const cw = 180.0, chh = 72.0, gap = 56.0;
      for (let ri = 0; ri < 3; ri++) {
        for (let ci = 0; ci < 2; ci++) {
          K.rectCenter(MC[0] + (ci - 0.5) * (cw + gap), MC[1] + (ri - 1) * (chh + gap),
                       cw, chh, BV, 1.5, 0.9 * (1 - p1), 0, 6);
        }
      }
      K.word_block(FONT_SEMI, 156, ['Oh switch my role'], 0.10 * BASE_W, [0.48 * BASE_H],
                   0.04, 95.47, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 96.96, 97.04));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 156, ['Oh switch my role'], 0.10 * BASE_W, [0.48 * BASE_H],
                     0.04, 95.47, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    // 粒子沿相向弧线流向左右双核（中途在中线交错）
    const cyBank = [], bvBank = [];
    for (let i = 0; i < c.src.length; i++) {
      const left = i % 2 === 0;
      const base = left ? L : R;
      const tx = base[0] + c.off[i][0];
      const ty = base[1] + c.off[i][1];
      const q = clamp01(p2 * 1.15 - (i % 47) * 0.005);
      const mx = lerp(c.src[i][0], tx, q);
      const my = lerp(c.src[i][1], ty, q) + Math.sin(Math.PI * q) * (left ? -60 : 60);
      (left ? cyBank : bvBank).push([mx, my]);
    }
    K.dots(cyBank, 2.0, CYAN, 0.8, 0.30);
    K.dots(bvBank, 2.0, BV, 0.8, 0.30);
    // 双核 + 点云球自转
    const rot = 0.6 * Math.max(0.0, t - 97.34);
    const bs = SC.beats('SHOT_103');
    for (const [cc, colr] of [[L, CYAN], [R, BV]]) {
      const pts = c.ball.map(([a0, rr]) => {
        const a = a0 + rot;
        const r = 0.09 * BASE_W * rr;
        return [cc[0] + r * Math.cos(a), cc[1] + r * Math.sin(a)];
      });
      K.dots(pts, 2.0, colr, 0.8, 0.30);
      const em = beatEnv(t, bs, 0.05);
      K.disc(cc, 16.0 * (1 + 0.08 * em + 0.04 * p4), colr, 0.95, 0.45);
      K.ring(cc, 22.0, ICE, 1.5, 0.8, 0.25);
    }
    // 中线引力虚线
    if (t >= 97.55) K.dash(L, R, GREY, 1.0, 0.30 + 0.20 * p4, 6, 6);
    K.micro({ TL: 'T+96.74s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_103} · sample:3px · 5900pt`, BR: 'MORPH' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_104  `97.74–98.6416` ｜ 两球沿弧线轨道交换（左走上弧、右走下弧）
   ══════════════════════════════════════════════════════════════ */
const SHOT_104 = {
  id: 'SHOT_104', start: 97.74, end: 98.6416,
  seedHex: SEEDS.SHOT_104, chapter: CHAPTER, status: 'EXCHANGE',
  lyric: 'To S to M / 从 S 到 M',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_104 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_104);
    const node = [];
    for (let i = 0; i < 900; i++) {
      const r = new Rng(seed, 'node', i);
      node.push([r.range(0, Math.PI * 2), 0.2 + 0.8 * r.next()]);
    }
    this._c = { SL: [0.32 * BASE_W, 0.48 * BASE_H], MR: [0.68 * BASE_W, 0.48 * BASE_H],
                RB: 0.09 * BASE_W, node };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { SL, MR, RB } = c;
    const p1 = easeOutCubic(phase(t, 97.74, 97.98));
    const p2 = easeInOutQuint(phase(t, 97.98, 98.32));
    const p4 = phase(t, 98.54, 98.6416);
    const bs = SC.beats('SHOT_104');

    // 两球沿弧线轨道交换
    let A, Bb;
    if (t >= 97.98) {
      const sa = Math.PI * p2;
      A = [lerp(SL[0], MR[0], p2), lerp(SL[1], MR[1], p2) - Math.sin(sa) * 0.16 * BASE_H];
      Bb = [lerp(MR[0], SL[0], p2), lerp(MR[1], SL[1], p2) + Math.sin(sa) * 0.16 * BASE_H];
    } else {
      A = [SL[0], SL[1]];
      Bb = [MR[0], MR[1]];
    }
    // 连线（含中点环）
    if (t >= 97.74) {
      const q = easeOutQuad(phase(t, 97.74, 97.98));
      K.line(A, [lerp(A[0], Bb[0], q), lerp(A[1], Bb[1], q)], ICE, 2.0, 0.9, 0.35);
      if (q >= 1.0) {
        const mcx = (A[0] + Bb[0]) / 2, mcy = (A[1] + Bb[1]) / 2;
        K.ring([mcx, mcy], t >= 98.54 ? 6.0 : 4.0, ICE, 1.5, 0.9, 0.30);
      }
    }
    // 双球点云 + 核心
    for (const [cc, colr] of [[A, CYAN], [Bb, BV]]) {
      const tight = 1.0 - 0.15 * p1;
      const pts = c.node.map(([a0, rr]) => {
        const r = RB * rr * tight;
        return [cc[0] + r * Math.cos(a0), cc[1] + r * Math.sin(a0)];
      });
      K.dots(pts, 2.0, colr, 0.8, 0.28);
      const em = beatEnv(t, bs, 0.05);
      const off = colr === BV ? 0.04 : 0;
      const sc = 1.0 + 0.06 * Math.sin(Math.PI * clamp01(phase(t, 98.32 + off, 98.37 + off)));
      K.disc(cc, 16.0 * sc * (1 + 0.06 * em), colr, 0.95, 0.45);
      K.ring(cc, 22.0 * sc, ICE, 1.5, 0.8, 0.25);
    }
    // 节点标签（与球同步位移）
    K.textKit(FONT_MONO, 42, 'NODE_S', A[0], A[1] - RB - 0.04 * BASE_H, ICE, 0.9, 0, 'center');
    K.textKit(FONT_MONO, 42, 'NODE_M', Bb[0], Bb[1] - RB - 0.04 * BASE_H, ICE, 0.9, 0, 'center');
    // 权限位阶弧（左 3 条 / 右 1 条），阶段 4 淡出
    const fade = 1.0 - clamp01(p4);
    for (let i = 0; i < 3; i++) {
      const rr = 0.11 + 0.02 * i;
      K.ring(A, rr * BASE_W, GREY, 1.0, 0.7 * fade, 0.0, -40, 20);
      K.ring(A, rr * BASE_W, GREY, 1.0, 0.45 * fade, 0.0, 140, 200);
    }
    K.ring(Bb, 0.11 * BASE_W, GREY, 1.0, 0.7 * fade, 0.0, -20, 40);
    K.word_block(FONT_SEMI, 170, ['To S to M'], 0.10 * BASE_W, [0.70 * BASE_H],
                 0.07, 97.74, t,
                 { per_char: 0.013,
                   accents: [[['To ', ICE], ['S', CYAN], [' to ', ICE], ['M', BV]]] });
    K.micro({ TL: 'T+97.74s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_104} · nodes:2`, BR: 'EXCHANGE' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_105  `98.6416–99.35` ｜ 标签与词点汇聚为 CONNECTION 词形
   ══════════════════════════════════════════════════════════════ */
const SHOT_105 = {
  id: 'SHOT_105', start: 98.6416, end: 99.35,
  seedHex: SEEDS.SHOT_105, chapter: CHAPTER, status: 'MORPH',
  lyric: 'To S to M / 从 S 到 M',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_105 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_105);
    // 承接 SHOT_104 交换后的位置
    const SL = [0.68 * BASE_W, 0.48 * BASE_H];
    const MR = [0.32 * BASE_W, 0.48 * BASE_H];
    const MID = [(SL[0] + MR[0]) / 2, (SL[1] + MR[1]) / 2];
    const RB = 0.09 * BASE_W;
    const node = [];
    for (let i = 0; i < 600; i++) {
      const r = new Rng(seed, 'node', i);
      node.push([r.range(0, Math.PI * 2), 0.2 + 0.8 * r.next()]);
    }
    const dust = [];
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'dust', i);
      dust.push([Math.PI * (0.15 + 0.7 * r.next()), 0.2 + 0.8 * r.next()]);
    }
    const labPts = glyphPoints(FONT_MONO, 42, 'NODE_S', 320, SL)
      .concat(glyphPoints(FONT_MONO, 42, 'NODE_M', 320, MR));
    const wordPts = P.cloudPoints(1500, SEEDS.SHOT_105, 'word', 'rect', [0.26, 0.24], 0.20, 0.35);
    const conn = glyphPoints(FONT_MONO, 120, 'CONNECTION', 900,
                             [MID[0], MID[1] - 0.04 * BASE_H], 28);
    this._c = { SL, MR, MID, RB, node, dust, allPts: labPts.concat(wordPts), conn };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { SL, MR, MID, RB, conn } = c;
    const p1 = phase(t, 98.6416, 98.82);
    const p2 = easeInOutCubic(phase(t, 98.82, 99.10));
    const p3 = phase(t, 99.10, 99.26);

    // 双球点云 + 核心
    for (const [cc, colr] of [[SL, CYAN], [MR, BV]]) {
      const pts = c.node.map(([a0, rr]) => {
        const r = RB * rr * (1.0 - 0.10 * p1);
        return [cc[0] + r * Math.cos(a0), cc[1] + r * Math.sin(a0)];
      });
      K.dots(pts, 2.0, colr, 0.8, 0.28);
      K.disc(cc, 16.0, colr, 0.95, 0.45);
      K.ring(cc, 22.0, ICE, 1.5, 0.8, 0.25);
    }
    K.line(SL, MR, ICE, 2.0, 0.9, 0.35);
    // 标签下划线预告
    if (t < 99.02 && t >= 98.64) {
      const bl = (steps(t, 2, 98.64, 99.02) % 2 === 0) ? 1.0 : 0.4;
      for (const cc of [SL, MR]) {
        K.line([cc[0] - 80, cc[1] + 66], [cc[0] + 80, cc[1] + 66], ICE, 1.0, 0.7 * bl, 0.0);
      }
    }
    // 汇聚为 CONNECTION 词形
    for (let i = 0; i < c.allPts.length; i++) {
      const [tx, ty] = conn[i % conn.length];
      const q = clamp01(p2 * 1.15 - (i % 41) * 0.006);
      const mx = lerp(c.allPts[i][0], tx, q);
      const my = lerp(c.allPts[i][1], ty, q) + Math.sin(Math.PI * q) * (i % 2 ? -40 : 40);
      K.dots([[mx, my]], 2.0, ICE, 0.85, 0.30);
    }
    // 主词与标签（98.82 前）
    if (t < 98.82) {
      K.word_block(FONT_SEMI, 170, ['To S to M'], 0.10 * BASE_W, [0.70 * BASE_H],
                   0.07, 97.74, t,
                   { per_char: 0.0, char_dur: 0.001,
                     accents: [[['To ', ICE], ['S', CYAN], [' to ', ICE], ['M', BV]]] });
      K.textKit(FONT_MONO, 42, 'NODE_S', SL[0], SL[1] - RB - 0.04 * BASE_H, ICE, 0.9, 0, 'center');
      K.textKit(FONT_MONO, 42, 'NODE_M', MR[0], MR[1] - RB - 0.04 * BASE_H, ICE, 0.9, 0, 'center');
    }
    if (t >= 99.10) {
      K.line(SL, MR, ICE, 2.0, 0.9 + 0.1 * p3, 0.45);
      K.textKit(FONT_MONO, 28, 'CONNECTION', MID[0], MID[1] - 0.04 * BASE_H + 10,
                ICE, 0.95 * p3, 0.30, 'center');
    }
    // 中点环
    const blink = (steps(t, 2, 99.26, 99.35) % 2 === 0) ? 1.0 : 0.5;
    K.ring(MID, 6.0, ICE, 1.5, 0.9 * (t >= 99.26 ? blink : 1.0), 0.30);
    // 双球底部尘埃垫
    if (t >= 99.10) {
      for (const cc of [SL, MR]) {
        const pts = c.dust.map(([a, rr]) => {
          const r = RB * rr;
          return [cc[0] + r * Math.cos(a), cc[1] + r * Math.sin(a)];
        });
        K.dots(pts, 2.0, GREY, 0.10 * p3, 0.0);
      }
    }
    K.micro({ TL: 'T+98.64s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_105} · sample:3px · 2140pt`, BR: 'MORPH' });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_106  `99.35–100.5372` ｜ 双轨收缩入黑洞 + 螺旋吸入尾迹
   ══════════════════════════════════════════════════════════════ */
const SHOT_106 = {
  id: 'SHOT_106', start: 99.35, end: 100.5372,
  seedHex: SEEDS.SHOT_106, chapter: CHAPTER, status: 'PORTAL',
  lyric: 'So we can enter / 所以我们可以进入',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_106 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_106);
    const conn = [];
    for (let i = 0; i < 900; i++) {
      const r = new Rng(seed, 'conn', i);
      conn.push(r.range(0, Math.PI * 2));
    }
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], conn };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const C = c.C;
    const p1 = easeOutExpo(phase(t, 99.35, 99.62));
    const p2 = easeInOutCubic(phase(t, 99.62, 99.98));
    const p3 = easeInQuad(phase(t, 99.98, 100.34));
    const p4 = phase(t, 100.34, 100.5372);

    let rIn, rOut;
    if (t < 99.62) { rIn = 0.16; rOut = 0.26; }
    else if (t < 99.98) { rIn = lerp(0.16, 0.11, p2); rOut = lerp(0.26, 0.17, p2); }
    else { rIn = lerp(0.11, 0.04, p3); rOut = lerp(0.17, 0.07, p3); }
    if (t >= 100.34) {
      rIn = lerp(rIn, 0.04, p4);
      rOut = lerp(rOut, 0.07, p4);
    }
    const hole = 0.06 * BASE_W * clamp01(phase(t, 99.35, 99.62)) * (1.0 - 0.5 * p3);
    if (t >= 99.35) {
      K.disc(C, hole, BLACK, 1.0);
      K.ring(C, hole + 2.0, ICE, 2.0, 0.9, 0.50);
    }
    K.ring(C, rIn * BASE_W, CYAN, 1.5, 0.9, 0.30);
    K.ring(C, rOut * BASE_W, BV, 1.5, 0.9, 0.28);
    const spIn = -0.8 * Math.max(0.0, t - 99.62) * (1.0 + p3);
    const spOut = 0.5 * Math.max(0.0, t - 99.62) * (1.0 + p3);
    const inPts = [], outPts = [];
    for (let i = 0; i < 480; i++) {
      const a = spIn + (2 * Math.PI * i) / 480;
      inPts.push([C[0] + rIn * BASE_W * Math.cos(a), C[1] + rIn * BASE_W * Math.sin(a)]);
    }
    for (let i = 0; i < 720; i++) {
      const a = spOut + (2 * Math.PI * i) / 720;
      outPts.push([C[0] + rOut * BASE_W * Math.cos(a), C[1] + rOut * BASE_W * Math.sin(a)]);
    }
    K.dots(inPts, 2.0, CYAN, 0.85, 0.30);
    K.dots(outPts, 2.0, BV, 0.85, 0.28);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.15 + i / 8.0);
      const q = clamp01(phase(t, 99.98 + 0.045 * i, 100.30 + 0.045 * i));
      const r1 = rOut * BASE_W;
      const r0 = r1 - 0.04 * BASE_W * (1 - q);
      K.line([C[0] + r0 * Math.cos(a), C[1] + r0 * Math.sin(a)],
             [C[0] + r1 * Math.cos(a), C[1] + r1 * Math.sin(a)], GREY, 1.0, 0.6, 0.0);
    }
    K.disc([C[0] + rIn * BASE_W * Math.cos(spIn), C[1] + rIn * BASE_W * Math.sin(spIn)],
           8.0, CYAN, 0.95, 0.40);
    K.disc([C[0] + rOut * BASE_W * Math.cos(spOut + Math.PI),
            C[1] + rOut * BASE_W * Math.sin(spOut + Math.PI)], 8.0, BV, 0.95, 0.40);
    // CONNECTION 词形塌入空洞
    if (t < 99.62) {
      const q = clamp01((t - 99.35) / 0.27);
      const pts = c.conn.map((a0) => {
        const rr = 0.10 * BASE_W * (1 - q);
        return [C[0] + rr * Math.cos(a0), C[1] + rr * Math.sin(a0)];
      });
      K.dots(pts, 2.0, ICE, 0.9 * (1 - q), 0.10);
    }
    // 螺旋吸入尾迹
    if (t >= 100.34) {
      for (let k = 0; k < 2; k++) {
        const pts = [], al = [];
        for (let i = 0; i < 240; i++) {
          const u = i / 240.0;
          const a = (k === 0 ? spIn : spOut) + u * 4.0;
          const rr = rOut * BASE_W * (1 - u * (0.6 + 0.4 * p4));
          pts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
          al.push(0.6 * (1 - u) * p4);
        }
        K.dots(pts, 2.0, k === 0 ? CYAN : BV, 1, 0.30, BG_DEEP, al);
      }
    }
    K.word_block(FONT_SEMI, 162, ['So we can enter'], 0.10 * BASE_W, [0.16 * BASE_H],
                 0.05, 99.35, t,
                 { per_char: 0.013,
                   accents: [[['So we can ', ICE], ['enter', CYAN]]] });
    K.micro({ TL: 'T+99.35s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_106} · rings:2`, BR: 'PORTAL' });
    return { bloomR: 10.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_107  `100.5372–101.47` ｜ 密度极限 → 沿螺线放出 2400 点（3.5 圈）
   ══════════════════════════════════════════════════════════════ */
const SHOT_107 = {
  id: 'SHOT_107', start: 100.5372, end: 101.47,
  seedHex: SEEDS.SHOT_107, chapter: CHAPTER, status: 'MORPH',
  lyric: 'So we can enter / 所以我们可以进入',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_107 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_107);
    const suck = [];
    for (let i = 0; i < 400; i++) {
      const r = new Rng(seed, 'suck', i);
      suck.push([r.range(0, Math.PI * 2), 0.4 + 0.6 * r.next()]);
    }
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], A: 0.011 * BASE_W, suck };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, A } = c;
    const p1 = phase(t, 100.5372, 100.74);
    const p2 = phase(t, 100.74, 101.04);
    const p3 = easeOutExpo(phase(t, 101.04, 101.32));
    const spin = t >= 101.32 ? 0.35 * Math.max(0.0, t - 101.32) : 0.0;
    const ACCS = [[['So we can ', ICE], ['enter', CYAN]]];

    // 阶段 1：双环失稳抖动后向心塌缩
    if (t < 100.74) {
      for (let k = 0; k < 2; k++) {
        const r0 = k === 0 ? 0.04 : 0.07;
        const jit = 0.02 * Math.sin(2 * Math.PI * 8.0 * t + k);
        const rr = lerp(r0, 0.0, easeInExpo(clamp01((t - 100.5372) / 0.20))) + jit * (1 - p1);
        K.ring(C, rr * BASE_W, k === 0 ? CYAN : BV, 1.5, 0.9 * (1 - p1), 0.30);
      }
      K.disc(C, 10.0 * (1 - 0.5 * p1), ICE, 0.95, 0.50);
      const q = clamp01((t - 100.5372) / 0.2);
      K.disc(C, 6.0 * (1 - q), BLACK, 1.0);
      K.word_block(FONT_SEMI, 162, ['So we can enter'], 0.10 * BASE_W, [0.16 * BASE_H],
                   0.05, 99.35, t,
                   { per_char: 0.0, char_dur: 0.001, accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 100.74, 100.82));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 162, ['So we can enter'], 0.10 * BASE_W, [0.16 * BASE_H],
                     0.05, 99.35, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, accents: ACCS });
      }
    }
    // 阶段 2：汇聚点（密度极限）
    if (t >= 100.74 && t < 101.04) {
      const bump = Math.sin(Math.PI * clamp01(p2));
      K.disc(C, 10.0 + 6.0 * bump, ICE, 1.0, 0.70);
      const pts = c.suck.map(([a, rr0]) => {
        const rr = 0.30 * BASE_W * (1 - p2) * rr0;
        return [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)];
      });
      K.dots(pts, 2.0, CYAN, 0.7, 0.30);
    }
    // 阶段 3：沿螺线放出 2,400 点（3.5 圈）
    if (t >= 101.04) {
      const pts = [];
      for (let i = 0; i < 2400; i++) {
        const u = i / 2400.0;
        if (u > p3) continue;
        const th = 7 * Math.PI * u + spin;
        const rr = Math.min(A * th * 3.2, 0.26 * BASE_W);
        pts.push([C[0] + rr * Math.cos(th), C[1] + rr * Math.sin(th)]);
      }
      K.dots(pts, 2.0, CYAN, 0.85, 0.32);
      K.disc(C, 8.0, ICE, 0.95, 0.40);
      K.disc(C, 3.0, BLACK, 1.0);
    }
    // 48 颗外缘蓝紫亮点
    if (t >= 101.32) {
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (2 * Math.PI * i) / 48 + spin * 0.5;
        const rr = 0.26 * BASE_W * 1.06;
        pts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
      }
      K.dots(pts, 3.0, BV, 0.9, 0.30);
    }
    K.micro({ TL: 'T+100.54s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_107} · sample:4px · 4700pt`, BR: 'MORPH' });
    return { bloomR: 10.0, bloomK: 0.46, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_108  `101.47–102.6012` ｜ 螺旋稳态 + 半透明圆盘隔雾 + 5 组 the trance
   ══════════════════════════════════════════════════════════════ */
const SHOT_108 = {
  id: 'SHOT_108', start: 101.47, end: 102.6012,
  seedHex: SEEDS.SHOT_108, chapter: CHAPTER, status: 'TRANCE',
  lyric: 'The trance the trance / 恍惚',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_108 = beatsIn(beats, this.start, this.end);
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], A: 0.011 * BASE_W };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, A } = c;
    const p1 = phase(t, 101.47, 101.72);
    let spin = 0.35 * (t - 101.47);
    if (t >= 102.28) spin = 0.35 * (102.28 - 101.47) + 0.22 * (t - 102.28);

    // 半透明圆盘（隔雾看旋）
    if (t >= 101.47) {
      const dsc = easeOutCubic(clamp01(phase(t, 101.47, 101.72)));
      K.disc(C, 0.27 * BASE_W * dsc, BG_ALT, 0.45);
      K.ring(C, 0.27 * BASE_W * dsc, BV, 1.5, 0.30, 0.0);
    }
    // 螺旋 2,400 点（3.5 圈）
    const pts = [];
    for (let i = 0; i < 2400; i++) {
      const u = i / 2400.0;
      const th = 7 * Math.PI * u + spin;
      const rr = Math.min(A * th * 3.2, 0.26 * BASE_W);
      pts.push([C[0] + rr * Math.cos(th), C[1] + rr * Math.sin(th)]);
    }
    K.dots(pts, 2.0, CYAN, 0.85, 0.32);
    // 核心呼吸（0.8Hz）
    const br = 0.35 + 0.10 * Math.sin(2 * Math.PI * 0.8 * t);
    K.disc(C, 8.0, ICE, 0.95, br);
    K.disc(C, 2.0, BLACK, 1.0);
    // 外缘 48 亮点
    const outer = [];
    for (let i = 0; i < 48; i++) {
      const a = (2 * Math.PI * i) / 48 + spin * 0.5;
      const rr = 0.26 * BASE_W * 1.06;
      outer.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
    }
    K.dots(outer, 3.0, BV, 0.9, 0.30);
    // 5 组重复微词「the trance」
    const fadeM = 1.0 - 0.6 * clamp01(phase(t, 102.28, 102.48));
    for (let k = 0; k < 5; k++) {
      const th0 = [1.0, 2.2, 3.4, 4.6, 5.8][k];
      const th = th0 * Math.PI + spin + 0.05 * k * Math.max(0.0, t - 101.72);
      const rr = Math.min(A * th * 3.2, 0.26 * BASE_W);
      K.textKit(FONT_MONO, 28, 'the trance', C[0] + rr * Math.cos(th),
                C[1] + rr * Math.sin(th) + 0.02 * BASE_H, GREY, 0.6 * fadeM, 0, 'center');
    }
    // 主词
    const ACCS = [[['The ', ICE], ['trance', CYAN], [' the ', ICE], ['trance', CYAN]]];
    let blink = 1.0;
    if (t >= 102.48) blink = (steps(t, 2, 102.48, 102.6012) % 2 === 0) ? 1.0 : 0.85;
    if (t < 102.48) {
      K.word_block(FONT_SEMI, 144, ['The trance the trance'], 0.50 * BASE_W, [0.48 * BASE_H],
                   0.06, 101.47, t,
                   { per_char: 0.014, char_dur: 0.10, anchor: 'center', rise: 6.0,
                     accents: ACCS });
    } else {
      K.word_block(FONT_SEMI, 144, ['The trance the trance'], 0.50 * BASE_W, [0.48 * BASE_H],
                   0.06, 101.47, t,
                   { per_char: 0.0, char_dur: 0.001, anchor: 'center', alpha: blink,
                     accents: ACCS });
    }
    K.micro({ TL: 'T+101.47s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_108} · spin:0.35rad/s`, BR: null });
    return { bloomR: 9.0, bloomK: 0.44, grain: 5.0 };
  },
};

/* ══════════════════════════════════════════════════════════════
   SHOT_109  `102.6012–103.49` ｜ 3,100 点沿对数螺旋向心塌缩 → 核点
   ══════════════════════════════════════════════════════════════ */
const SHOT_109 = {
  id: 'SHOT_109', start: 102.6012, end: 103.49,
  seedHex: SEEDS.SHOT_109, chapter: CHAPTER, status: 'COLLAPSE',
  lyric: 'The trance the trance / 恍惚',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    SC.beatMap.SHOT_109 = beatsIn(beats, this.start, this.end);
    const seed = seedFromHex(SEEDS.SHOT_109);
    const halo = [];
    for (let i = 0; i < 300; i++) {
      const r = new Rng(seed, 'halo', i);
      halo.push([r.range(0, Math.PI * 2), 0.5 + 0.5 * r.next()]);
    }
    this._c = { C: [0.50 * BASE_W, 0.48 * BASE_H], A: 0.011 * BASE_W, halo };
    return this._c;
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const K = new Kit(ctx, gctx, dpr, BG_DEEP, beats);
    const { C, A } = c;
    const p1 = phase(t, 102.6012, 102.80);
    const p2 = easeInExpo(phase(t, 102.80, 103.18));
    const p3 = phase(t, 103.18, 103.36);
    const ACCS = [[['The ', ICE], ['trance', CYAN], [' the ', ICE], ['trance', CYAN]]];

    // 主词淡出
    if (t < 102.80) {
      K.word_block(FONT_SEMI, 144, ['The trance the trance'], 0.50 * BASE_W, [0.48 * BASE_H],
                   0.06, 101.47, t,
                   { per_char: 0.0, char_dur: 0.001, anchor: 'center', accents: ACCS });
    } else {
      const fa = 1.0 - clamp01(phase(t, 102.80, 102.88));
      if (fa > 0.01) {
        K.word_block(FONT_SEMI, 144, ['The trance the trance'], 0.50 * BASE_W, [0.48 * BASE_H],
                     0.06, 101.47, t,
                     { per_char: 0.0, char_dur: 0.001, alpha: fa, anchor: 'center',
                       accents: ACCS });
      }
    }
    // 半透明圆盘收缩至 0
    const dsc = 1.0 - easeInQuad(phase(t, 102.6012, 103.18));
    if (dsc > 0.01) {
      K.disc(C, 0.27 * BASE_W * dsc, BG_ALT, 0.45 * (1 - 0.55 * p1));
      K.ring(C, 0.27 * BASE_W * dsc, BV, 1.5, 0.30 * (1 - 0.55 * p1));
    }
    // 3,100 点沿对数螺旋向心塌缩（角速度 0.2→3.0 rad/s）
    const pts = [];
    for (let i = 0; i < 3100; i++) {
      const u = i / 3100.0;
      const th0 = 7 * Math.PI * u;
      const r0 = Math.min(A * th0 * 3.2, 0.26 * BASE_W);
      const ang = 0.2 * (t - 102.6012) + (3.0 - 0.2) * Math.max(0.0, t - 102.80) * u;
      let rr = r0 * Math.exp(-3.2 * p2);
      if (t >= 103.18) {
        if (!(u < 1.0 - p3)) continue;
        rr = r0 * Math.exp(-3.2) * 0.10;
      }
      pts.push([C[0] + rr * Math.cos(th0 + ang), C[1] + rr * Math.sin(th0 + ang)]);
    }
    K.dots(pts, 2.0, CYAN, 0.85, 0.30);
    // 300 点晕
    if (t >= 103.18) {
      const haloPts = c.halo.map(([a0, rr0]) => {
        const a = a0 + 0.2 * Math.max(0.0, t - 103.18);
        const rr = 0.08 * BASE_W * rr0;
        return [C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)];
      });
      K.dots(haloPts, 2.0, CYAN, 0.12, 0.0);
    }
    // 核心 + 遗迹细环
    let sc = 1.0;
    if (t >= 103.36) sc = 1.0 + 0.15 * Math.sin(Math.PI * clamp01((t - 103.36) / 0.13));
    K.disc(C, 12.0 * sc, ICE, 0.95, t >= 103.18 ? 0.60 : 0.30);
    K.ring(C, 0.04 * BASE_W, GREY, 1.5, 0.25, 0.0);
    K.micro({ TL: 'T+102.60s', TR: CHAPTER,
              BL: `seed:${SEEDS.SHOT_109} · collapse:3100pt`, BR: null });
    return { bloomR: 10.0, bloomK: 0.48, grain: 5.0 };
  },
};

export const CH05_SHOTS = [SHOT_094, SHOT_095, SHOT_096, SHOT_097, SHOT_098,
                           SHOT_099, SHOT_100, SHOT_101, SHOT_102, SHOT_103,
                           SHOT_104, SHOT_105, SHOT_106, SHOT_107, SHOT_108,
                           SHOT_109];
export { SC as CH05_SC };
