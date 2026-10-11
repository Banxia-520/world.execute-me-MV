/**
 * ch12.js — 第 12 章 FINAL EXECUTION（镜头 193–199）
 *
 * 自 Python 版 render/scenes/ch12_final.py 移植。
 *
 * 本章是**并行图层章**（与前十章的「一镜一函数」不同）：
 *   z0  背景纯黑场
 *   z1  底层衰变主线：SHOT_193（205.81–209.10）+ SHOT_194（209.10–211.9837）
 *   z2  前景状态序列（hard cut 依次替换）：195 命令 → 196 状态 → 197 缺失
 *       → 198 `> me` → 199 `> _`
 *   z3  四角微信息
 *
 * Python 侧三层各自带黑底、用「相加」合成。**因为黑色在加法里是零元**，
 * 等价于把三层直接画到同一张画布上 —— 这里就用这一等价实现（省两次全屏填充）。
 *
 * ⚠️ ch12 的镜头号与时间**不是顺序对应**（195/193 同起、196 嵌在其中），
 * 时间一律以 02_TIMELINE.json 为准。
 */
import {
  BASE_W as W, BASE_H as H, BG_DEEP, BG_ALT, ICE, CYAN, BLUEVIOLET,
  MOODPURPLE as MOOD, ERRRED as RED, WARM, GREYBLUE as GREY, BLACK,
  Rng, seedFromHex, phase, clamp01, lerp, steps, mix, rad, css,
  easeOutCubic, easeInCubic, easeOutExpo, easeInExpo, easeOutQuad, easeInQuad,
  easeInOutQuad, easeInOutSine, easeInOutCubic,
} from './core.js';
import { Canvas } from './kit.js';
import { PilDraw, pilFont } from './canvas.js';
import * as P from './primitives.js';

const CHAPTER = 'ch12/12';

// ── 常量（取自 Python 源码，不可自造）────────────────────────────
const SHOT_SEEDS = {
  SHOT_193: '0000193A', SHOT_194: '0000194B', SHOT_195: '0000195B',
  SHOT_196: '0000196B', SHOT_197: '0000197A', SHOT_198: '0000198A',
  SHOT_199: '0000199B',
};
const SHOT_SEED = '0000193A';
const BAND_Z1 = [0.31, 0.52];
const BAND_Z2 = [0.54, 0.67];
const X_FG = 0.07;
/** 巨字衰变链（258→203→163→139px） */
const BIG_SIZES = [[205.81, 258], [206.35, 258], [207.80, 203], [208.50, 163],
                   [209.10, 139], [211.55, 131]];
const BIG_ALPHAS = [[205.81, 0.0], [206.35, 0.0], [207.47, 0.45], [207.90, 0.28],
                    [209.10, 0.14], [209.85, 0.06], [211.55, 0.04]];
const DISSOLVE_SEGMENTS = 27;

const MICRO_BL = {
  SHOT_193: `seed:${SHOT_SEED} · layer:base · seg:0/27`,
  SHOT_194: 'seed:0000194B · layer:base · sample:1400pt',
  SHOT_195: 'seed:0000195B · layer:fg',
  SHOT_196: 'seed:0000196B · layer:fg',
  SHOT_197: 'seed:0000197A · pts:96→94',
  SHOT_198: 'seed:0000198A · ans:NULL',
  SHOT_199: 'seed:0000199B · loop:seed',
};
const MICRO_BR = { SHOT_193: 'DISS', SHOT_194: 'DISS', SHOT_195: 'EXEC',
                   SHOT_196: 'DONE', SHOT_197: 'MISS', SHOT_198: 'WAIT',
                   SHOT_199: 'LOOP' };

/* ── 顶层 helper ─────────────────────────────────────────────── */
/** 按 (time, value) 表线性插值 */
function piecewise(table, t) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 0; i + 1 < table.length; i++) {
    const [t0, v0] = table[i], [t1, v1] = table[i + 1];
    if (t0 <= t && t <= t1) {
      const k = t1 <= t0 ? 0.0 : (t - t0) / (t1 - t0);
      return lerp(v0, v1, k);
    }
  }
  return table[table.length - 1][1];
}

/** 向黑场混合（alpha 0→全黑，1→原色） */
function _col(c, k) { return mix(c, BLACK, clamp01(k)); }

/** 按基线水平居中绘制 */
function textCentered(d, text, font, cx, baseline, color, alpha = 1.0, stroke = 0) {
  const w = font.getlength(text);
  const col = _col(color, alpha);
  d.text([cx - w / 2, baseline - font.asc], text,
         stroke > 0.4 ? { font, fill: col, strokeWidth: Math.round(stroke), strokeFill: col }
                      : { font, fill: col });
}

/** 按基线左对齐绘制 */
function textLeft(d, text, font, x, baseline, color, alpha = 1.0, stroke = 0) {
  const col = _col(color, alpha);
  d.text([x, baseline - font.asc], text,
         stroke > 0.4 ? { font, fill: col, strokeWidth: Math.round(stroke), strokeFill: col }
                      : { font, fill: col });
}

/** 终端状态行：`>` 灰蓝，词身主色；`chars` 限制已打出的字符数 */
function statusRow(d, prefix, body, font, x, baseline, pfxColor, bodyColor,
                   alpha = 1.0, chars = null) {
  let s = prefix + body;
  if (chars !== null) s = s.slice(0, Math.max(0, chars));
  let cx = x;
  for (const ch of s) {
    const col = ch === '>' ? pfxColor : bodyColor;
    d.text([cx, baseline - font.asc], ch, { font, fill: _col(col, alpha) });
    cx += font.getlength(ch);
  }
  return cx;
}

/* ── 字体与几何缓存 ──────────────────────────────────────────── */
const FONTS = {};
function F(weight, px) {
  const k = `${weight}|${px}`;
  if (!FONTS[k]) FONTS[k] = pilFont(weight, px, 1);
  return FONTS[k];
}
/** 巨字衰变所需字号（整数，避免每帧重建）
 *  ⚠️ 必须**懒加载**：`pilFont` 需要 `document`，模块顶层调用会让
 *  Node 下的 `shots.js` 导入直接抛 `document is not defined`。 */
const BIG_FONT = {};
function bigFont(sz) {
  const k = Math.round(sz);
  if (!BIG_FONT[k]) BIG_FONT[k] = pilFont('Inter Bold', k, 1);
  return BIG_FONT[k];
}

/** 27 段消隐顺序（每个字符 3 段） */
let SEG_ORDER = null;
function segOrder() {
  if (!SEG_ORDER) {
    const arr = [];
    for (let i = 0; i < DISSOLVE_SEGMENTS; i++) {
      arr.push([i, new Rng(parseInt(SHOT_SEED, 16), 'dissolve', i).next()]);
    }
    arr.sort((a, b) => a[1] - b[1]);
    SEG_ORDER = arr.map((x) => x[0]);
  }
  return SEG_ORDER;
}

/* ── z1：底层衰变主线 ────────────────────────────────────────── */
function layerZ1(c, t) {
  const ss = c.ss;
  const d = new PilDraw(c._f, false);
  const gd = new PilDraw(c._f, true);
  const size = piecewise(BIG_SIZES, t);
  const alpha = piecewise(BIG_ALPHAS, t);
  if (alpha <= 0.01) return;
  const font = bigFont(size);
  if (!font) return;
  // 字带中心 y=42% → 44%
  const cyPct = lerp(0.42, 0.44, clamp01((t - 206.35) / (211.98 - 206.35)));
  const baseline = cyPct * H;
  // 27 段笔画消隐：每 0.21s 熄一段（渐进侵蚀）
  let segAlive = DISSOLVE_SEGMENTS;
  if (t >= 206.35) segAlive = Math.max(0, DISSOLVE_SEGMENTS - Math.trunc((t - 206.35) / 0.21));
  const text = 'EXECUTION';
  const totalW = font.getlength(text);
  let x = W / 2 - totalW / 2;
  const order = segOrder();
  const dead = new Set(order.slice(0, DISSOLVE_SEGMENTS - segAlive));
  const col = _col(ICE, alpha);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cw = font.getlength(ch);
    // 该字符的 3 段：把字符宽度三等分，逐段裁剪绘制
    for (let seg = 0; seg < 3; seg++) {
      const segId = i * 3 + seg;
      if (dead.has(segId)) continue;
      const sx = x + (cw * seg) / 3.0;
      const sw = cw / 3.0;
      c.ctx.save();
      c.ctx.beginPath();
      c.ctx.rect(sx * ss, (baseline - font.asc - 4) * ss, (sw + 0.6) * ss,
                 (font.asc + font.desc + 8) * ss);
      c.ctx.clip();
      c.ctx.globalAlpha = 1.0;
      c.ctx.fillStyle = css(col);
      c.ctx.font = font.fontStr;
      c.ctx.textBaseline = 'alphabetic';
      c.ctx.textAlign = 'left';
      c.ctx.fillText(ch, x * ss, baseline * ss);
      c.ctx.restore();
    }
    gd.text([x, baseline - font.asc], ch, { font, fill: _col(ICE, alpha * 0.35) });
    x += cw;
  }
  // 词尾光标余位
  if (t < 209.10) {
    P.drawCursor(c.ctx, W * 0.80, baseline - 46, ss, 2, 46, CYAN, alpha > 0.05);
  }
  // 状态行雏形（207.90s 起）
  if (t >= 207.90) {
    const f2 = F('JetBrains Mono', 24);
    const aa = 0.30 * clamp01((t - 207.90) / 0.6);
    textLeft(d, 'execution:done', f2, W * 0.10, 0.50 * H, GREY,
             alpha > 0 ? (aa * alpha) / 0.14 : 0);
  }
  // 短基线（208.50s 起）
  if (t >= 208.50) {
    const k = clamp01((t - 208.50) / 0.4);
    P.drawHLine(c.ctx, 0.545 * H, W * 0.06, W * (0.06 + 0.24 * k), 1, GREY, 0.35, ss);
  }
  // SHOT_194：粒子迁移（209.85 起）
  if (t >= 209.85) {
    const prog = clamp01((t - 209.85) / 1.7);
    const pts = P.cloudPoints(1400, SHOT_SEED, 'mig', 'line', [0.5, 0.42], 0.30);
    const dst = P.cloudPoints(1400, SHOT_SEED, 'migdst', 'rect', [0.72, 0.60], 0.16);
    // ease 省略以走 flowPositions 的默认值（传 null 会抛 `ease is not a function`）
    const moved = P.flowPositions(pts, dst, prog, undefined, 20);
    // PIL 的 draw_points 分别画在主层与辉光层：Frame.pts 的 gl 参数同时写两层
    c._f.pts(moved, 1.2, ICE, 0.12 * (1 - prog * 0.6));
    c._f.pts(moved, 1.2, CYAN, 0.10 * (1 - prog * 0.6), 1.0);
  }
}

/* ── z2：前景状态序列 ────────────────────────────────────────── */
function layerZ2(c, t) {
  const d = new PilDraw(c._f, false);
  const gd = new PilDraw(c._f, true);
  const mono = F('JetBrains Mono', 56);
  const mono48 = F('JetBrains Mono', 48);
  const base1 = lerp(BAND_Z2[0], BAND_Z2[1], 0.32) * H;   // y=59%
  const base2 = lerp(BAND_Z2[0], BAND_Z2[1], 0.80) * H;   // y=65.5%
  const x0 = X_FG * W;

  // SHOT_195：巨大 EXECUTION slow type + 光标（205.81–207.47）
  if (t >= 205.81 && t < 207.47) {
    const f = F('Inter Bold', 258);
    const text = 'EXECUTION';
    const total = f.getlength(text);
    let x = W / 2 - total / 2;
    const baseline = 0.42 * H;
    const per = 0.166;
    const shown = Math.trunc(clamp01((t - 205.81) / (per * text.length)) * text.length);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const vis = i < shown ? 1.0
        : (i === shown ? clamp01((t - 205.81 - per * i) / 0.05) : 0.0);
      if (vis <= 0.01) { x += f.getlength(ch); continue; }
      const dt = t - (205.81 + per * i);
      const flash = (dt >= 0 && dt <= 2 / 60) ? 1.0 : 0.85;
      const col = _col(ICE, vis * flash);
      d.text([x, baseline - f.asc], ch,
             { font: f, fill: col, strokeWidth: Math.round(f.stroke), strokeFill: col });
      gd.text([x, baseline - f.asc], ch, { font: f, fill: _col(ICE, vis * 0.25) });
      x += f.getlength(ch);
    }
    const cy = baseline - 46;
    const on = t < 207.3 ? (Math.trunc((t - 205.81) / 0.1) % 2 === 0) : true;
    P.drawCursor(d.ctx ?? c.ctx, W * 0.5 + total / 2 + 16, cy, c.ss, 2, 46, CYAN, on);
    gd.rectangle([W * 0.5 + total / 2, cy, W * 0.5 + total / 2 + 2, cy + 46],
                 { fill: _col(CYAN, 0.3) });
  }

  // SHOT_196：状态 start（207.47–209.10）
  if (t >= 207.47 && t < 209.10) {
    textLeft(d, 'EXECUTION', F('Inter Bold', 42), x0, 0.14 * H, ICE, 0.9);
    const n1 = Math.trunc(clamp01((t - 207.69) / (0.034 * 20)) * 20);
    statusRow(d, '> ', 'execution complete', mono, x0, base1, GREY, CYAN, 1.0, n1);
    if (t >= 208.30) {
      const n2 = Math.trunc(clamp01((t - 208.30) / 0.2) * 2);
      statusRow(d, '> ', '', mono48, x0, base2, GREY, GREY, 1.0, n2);
      const on = Math.trunc((t - 208.30) / 0.5) % 2 === 0;
      P.drawCursor(c.ctx, x0 + 40, base2 - 34, c.ss, 2, 34, CYAN, on);
      P.drawHLine(c.ctx, lerp(base1, base2, 0.5), x0, x0 + 240, 1, GREY, 0.3, c.ss);
    }
  }

  // SHOT_197：缺失（209.10–210.30）
  if (t >= 209.10 && t < 210.30) {
    textLeft(d, 'EXECUTION', F('Inter Bold', 42), x0, 0.14 * H, ICE, 0.9);
    const up = clamp01((t - 209.10) / 0.26);
    const yComplete = lerp(base1, base1 - 0.06 * H, up);
    statusRow(d, '> ', 'execution complete', mono, x0, yComplete, GREY, GREY, 0.4);
    const n1 = Math.trunc(clamp01((t - 209.30) / (0.030 * 16)) * 16);
    statusRow(d, '> ', 'user not found', mono48, x0, base1, GREY, ICE, 1.0, n1);
    const n2 = Math.trunc(clamp01((t - 209.70) / (0.030 * 17)) * 17);
    statusRow(d, '> ', 'world not found', mono48, x0, base2, GREY, ICE, 1.0, n2);
    const on = Math.trunc((t - 209.10) / 0.5) % 2 === 0;
    P.drawCursor(c.ctx, x0 + 30, base2 - 34, c.ss, 2, 34, CYAN, on);
  }

  // SHOT_198：`> me`（210.30–211.20）
  if (t >= 210.30 && t < 211.20) {
    textLeft(d, 'EXECUTION', F('Inter Bold', 42), x0, 0.14 * H, ICE, 0.4);
    const f72 = F('JetBrains Mono', 72);
    const f144 = F('JetBrains Mono Bold', 144);
    const baseMe = 0.64 * H;
    const n1 = Math.trunc(clamp01((t - 210.48) / 0.05) * 2);
    statusRow(d, '> ', '', f72, x0, baseMe, GREY, GREY, 1.0, n1);
    const w = f72.getlength('> ');
    const n2 = Math.trunc(clamp01((t - 210.55) / (0.040 * 2)) * 2);
    const s = 'me'.slice(0, n2);
    d.text([x0 + w, baseMe - f144.asc], s, { font: f144, fill: _col(ICE, 1.0) });
    if (n2 > 0) gd.text([x0 + w, baseMe - f144.asc], s, { font: f144, fill: _col(ICE, 0.25) });
    const blink = t >= 210.85 && t <= 211.05;
    const on = blink ? (Math.trunc((t - 210.85) / 0.11) % 2 === 0) : true;
    P.drawCursor(c.ctx, x0 + w + f144.getlength('me') + 14, baseMe - 96, c.ss, 3, 96, CYAN, on);
  }

  // SHOT_199：`> _` + 循环种子（211.20–211.9837）
  if (t >= 211.20) {
    const f72 = F('JetBrains Mono', 72);
    const f144 = F('JetBrains Mono Bold', 144);
    const baseMe = 0.64 * H;
    const fade = 1.0 - clamp01((t - 211.85) / 0.10);
    const n1 = Math.trunc(clamp01((t - 211.20) / 0.024) * 2);
    statusRow(d, '> ', '', f72, x0, baseMe, GREY, GREY, fade, n1);
    const w = f72.getlength('> ');
    const n2 = Math.trunc(clamp01((t - 211.24) / 0.048) * 1);
    const s = '_'.slice(0, n2);
    d.text([x0 + w, baseMe - f144.asc], s, { font: f144, fill: _col(CYAN, fade) });
    const on = Math.trunc((t - 211.20) / 0.5) % 2 === 0;
    P.drawCursor(c.ctx, x0 + w + 100, baseMe - 34, c.ss, 3, 34, CYAN, on && fade > 0.5);
    // 循环种子亮点：迁至画面中心，脉冲后扩到 2px
    if (t >= 211.35) {
      const k = clamp01((t - 211.35) / 0.18);
      if (k >= 1.0) {
        const pulse = 1.0 + 0.5 * (1 + Math.sin((2 * Math.PI * (t - 211.53)) / 0.6)) / 2;
        let r = 1.0 * pulse;
        const cx = 0.5 * W, cy = 0.48 * H;
        if (t >= 211.85) {
          const k4 = clamp01((t - 211.85) / (4 / 60));
          r = lerp(1.0, 2.0, k4);
          if (t >= 211.90) r = 2.0;
        }
        const col = _col(ICE, t >= 211.85 ? 1.0 : 0.9);
        d.ellipse([cx - r, cy - r, cx + r, cy + r], { fill: col });
        gd.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], { outline: _col(ICE, 0.08) });
      }
    }
  }
}

/* ── z3：四角微信息 ──────────────────────────────────────────── */
function layerZ3(c, t, shotId) {
  const d = new PilDraw(c._f, false);
  const f = F('JetBrains Mono', 16);
  const pad = 26;
  const tl = `T+${t.toFixed(2)}s`;
  const tr = 'ch12/12';
  const bl = MICRO_BL[shotId] || '';
  const br = MICRO_BR[shotId] || '';
  const col = _col(GREY, 0.6);
  d.text([pad, pad], tl, { font: f, fill: col });
  d.text([W - pad - f.getlength(tr), pad], tr, { font: f, fill: col });
  d.text([pad, H - pad - 18], bl, { font: f, fill: col });
  d.text([W - pad - f.getlength(br), H - pad - 18], br, { font: f, fill: col });
}

/* ── 镜头注册 ────────────────────────────────────────────────── */
function ch12Shot(id, start, end, status, lyric) {
  return {
    id, start, end, chapter: CHAPTER, status, lyric,
    seedHex: SHOT_SEEDS[id],
    draw(ctx, gctx, t, dpr, beats) {
      const c = new Canvas(ctx, gctx, dpr, BLACK, beats || []);
      // z1 / z2 / z3 相加合成 → 直接画到同一画布（黑色是加法的零元）
      layerZ1(c, t);
      layerZ2(c, t);
      layerZ3(c, t, id);
      const boost = 0.0;
      void boost;
      return c.flush(t, SHOT_SEEDS[id], {
        radius: 8.0, strength: 0.30, grainPct: 3.0,
        scan: t >= 209.10 ? 0.04 : 0.0,
      });
    },
  };
}

const SHOT_193 = ch12Shot('SHOT_193', 205.8100, 209.1000, 'DISS', 'EXECUTION / 执行');
const SHOT_194 = ch12Shot('SHOT_194', 209.1000, 211.9837, 'DISS', 'EXECUTION / 执行');
const SHOT_195 = ch12Shot('SHOT_195', 205.8100, 207.4700, 'EXEC', 'EXECUTION / 执行');
const SHOT_196 = ch12Shot('SHOT_196', 207.4700, 209.1000, 'DONE', 'execution complete / 执行完成');
const SHOT_197 = ch12Shot('SHOT_197', 209.1000, 210.3000, 'MISS', 'user not found / 找不到用户');
const SHOT_198 = ch12Shot('SHOT_198', 210.3000, 211.2000, 'WAIT', '> me / 我');
const SHOT_199 = ch12Shot('SHOT_199', 211.2000, 211.9837, 'LOOP', '> _ / 循环种子');

export const CH12_SHOTS = [SHOT_193, SHOT_194, SHOT_195, SHOT_196, SHOT_197,
                           SHOT_198, SHOT_199];
