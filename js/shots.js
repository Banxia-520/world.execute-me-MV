/**
 * shots.js — 场景注册表
 *
 * 统一场景接口：
 *   shot.draw(ctx, gctx, t, dpr, beats) -> {bloomR, bloomK, grain} | undefined
 *     ctx   主层 2D 上下文（已按 dpr 缩放）
 *     gctx  高光层 2D 上下文（同尺寸，黑底）—— 由 app 统一做 bloom
 *     t     **绝对时间（秒）**
 *     dpr   缩放比（1920 基准 → 实际像素）
 *   shot._init(ctx, beats)  可选：在首次绘制前完成依赖字体度量的预计算
 *   shot.start / shot.end   正片内部时间区间
 *
 * 全部为纯函数：同一 t 必须画出同一画面，不使用跨帧状态。
 */
import { BASE_W, BASE_H, BG_DEEP, ICE, CYAN, GREYBLUE, WARM,
         css, clamp01, phase, Rng, seedFromHex } from './core.js';
import * as P from './primitives.js';
import { Frame, fontOf, mixc } from './kit.js';

/* ── 片头起点（0.00–0.10）────────────────────────────────────
   注意：这不是任何「SHOT_0xx」。时间轴首镜 SHOT_006 起于 0.1000s，
   故 0–0.10s 是镜头序列开始前的短暂黑场——此处只画一个起始点，
   避免冒用 SHOT_001 的编号（真正的 SHOT_001 是 16.0–18.4s 的间奏镜）。
   ─────────────────────────────────────────────────────────── */
const SHOT_LEADIN = {
  id: 'LEADIN', start: 0.00, end: 0.10,
  seedHex: '0000000A', chapter: 'ch01/12', status: 'INIT', lyric: '',
  draw(ctx, gctx, t, dpr) {
    const f = new Frame(ctx, gctx, dpr, BG_DEEP);
    const cx = 0.5 * BASE_W, yc = 0.5 * BASE_H;
    const a = clamp01(t / 0.10);
    f.dot(cx, yc, 6, ICE, a, a * 0.8);
    f.dashCircle(cx, yc, 26, GREYBLUE, 1, 4, 5, 0.45 * a, 0);
    const mf = fontOf('JetBrains Mono', 18, dpr);
    f.text(26, 26 + 12, 'INIT', mf.font, GREYBLUE, 0.6 * a);
    f.text(BASE_W - 26 - 56, 26 + 12, 'ch01/12', mf.font, GREYBLUE, 0.6 * a);
    return { bloomR: 10, bloomK: 0.40, grain: 2.0 };
  },
};

/* ── SHOT_006 黄金示例（0.1000–1.0184）──────────────────────── */
const SHOT_006 = {
  id: 'SHOT_006', start: 0.1000, end: 1.0184,
  seedHex: '0000006A', chapter: 'ch01/12', status: 'PWR',
  lyric: 'Switch on the power line',
  _c: null,

  _init(ctx, beats) {
    if (this._c) return this._c;
    const seed = seedFromHex(this.seedHex);
    const MAIN_PX = 168, TRACKING = 0.06 * MAIN_PX, LINE_STEP = 1.02 * MAIN_PX;
    const LAST_BASE = 0.44 * BASE_H;
    const baselines = [LAST_BASE - LINE_STEP, LAST_BASE];
    const lines = ['Switch on the', 'power line'];
    const fMain = `700 ${MAIN_PX}px "Inter Bold", "Inter Regular", sans-serif`;
    const fMicro = `400 24px "JetBrains Mono", monospace`;
    const fCorner = `400 18px "JetBrains Mono", monospace`;

    ctx.save();
    ctx.font = fMain;
    const chars = [];
    for (let li = 0; li < lines.length; li++) {
      const text = lines[li];
      const ws = [];
      let w = 0;
      for (const ch of text) { const cw = ctx.measureText(ch).width; ws.push(cw); w += cw; }
      w += TRACKING * (text.length - 1);
      let x = (BASE_W - w) / 2;
      for (let ci = 0; ci < text.length; ci++) {
        chars.push({ li, ci, ch: text[ci], x });
        x += ws[ci] + TRACKING;
      }
    }
    ctx.restore();

    const particles = [];
    for (let i = 0; i < 240; i++) {
      const r = new Rng(seed, 'conductor-particles', i);
      particles.push({ phase: r.next(), lane: r.range(-1, 1), drag: r.range(0.75, 1) });
    }
    const bs = (beats || []).filter((b) => b >= this.start && b <= this.end);
    const beatParticles = [];
    for (let bi = 0; bi < bs.length; bi++) {
      for (let i = 0; i < 40; i++) {
        const r = new Rng(seed, `beat-burst-${bi}`, i);
        beatParticles.push({ beat: bs[bi], phase: r.next(),
                             lane: r.range(-1, 1), drag: r.range(0.8, 1.25) });
      }
    }
    this._c = { seed, tracking: TRACKING, lineStep: LINE_STEP, baselines, lines,
                fMain, fMicro, fCorner, chars, particles, beatParticles, beats: bs,
                N_PARTICLES: 240, BEAT_DUR: 0.06, BEAT_SCALE: 1.02,
                CHAR_STAGGER: 0.0101, CHAR_FADE: 0.06, CYAN_AT: 0.86,
                TRAIL_LEN: 8.0, N_TICKS: 21, TICK_H: 10.0, RING_R: 6.0, TICK_HOLD: 0.4 };
    return this._c;
  },

  _halfWidth(t) {
    const p1 = easeOutExpo2(phase(t, 0.10, 0.34));
    const p2 = easeOutExpo2(phase(t, 0.34, 0.72));
    return lerp2(lerp2(0, 0.30 * BASE_W, p1), 0.50 * BASE_W, p2);
  },

  draw(ctx, gctx, t, dpr, beats) {
    const c = this._init(ctx, beats);
    const f = new Frame(ctx, gctx, dpr, BG_DEEP, beats);
    const yc = 0.50 * BASE_H, cx = BASE_W / 2;
    const hw = this._halfWidth(t);
    let scale = 1.0;
    for (const b of c.beats) {
      if (b <= t && t <= b + c.BEAT_DUR) {
        scale = 1.0 + (c.BEAT_SCALE - 1) * Math.sin((Math.PI * (t - b)) / c.BEAT_DUR);
      }
    }
    let bright = 1.0;
    if (t >= 0.95) bright += 0.15 * easeOutQuad2(phase(t, 0.95, 1.02));
    for (const b of c.beats) {
      if (b <= t && t <= b + c.BEAT_DUR) bright += 0.06 * Math.sin((Math.PI * (t - b)) / c.BEAT_DUR);
    }
    const visible = t >= this.start;
    const dim = (rgb, k) => rgb.map((v) => Math.min(255, Math.round(v * k)));

    // ① 导体
    if (visible && hw > 0) {
      const hws = hw * scale;
      const coreHW = Math.min(BASE_W * 0.06, hws);
      f.line(cx - hws, yc, cx + hws, yc, dim(CYAN, bright), 3, 1, 1.0);
      f.line(cx - coreHW, yc, cx + coreHW, yc, dim(ICE, bright), 3, 1, 1.0);
    }

    // ③ 电压刻度
    if (visible) {
      const span = BASE_W * 0.98;
      for (let i = 0; i < c.N_TICKS; i++) {
        const tx = cx - span / 2 + (span * i) / (c.N_TICKS - 1);
        const arrival = 0.34 + (Math.abs(tx - cx) / (BASE_W / 2)) * 0.38 + i * 0.012;
        const active = t >= arrival && t - arrival <= c.TICK_HOLD;
        const col = active ? CYAN : GREYBLUE;
        for (const sgn of [-1, 1]) {
          const ty = yc + sgn * 3;
          f.line(tx, ty, tx, ty + sgn * c.TICK_H, col, 1, active ? 1 : 0.55);
        }
      }
    }

    // ② 电流粒子
    if (visible) {
      const drawP = (xo, lane, prog, alpha) => {
        if (xo === null) return;
        const px = cx + xo;
        if (px < -c.TRAIL_LEN || px > BASE_W + c.TRAIL_LEN) return;
        const a = clamp01(alpha);
        if (a <= 0.02) return;
        const py = yc + lane * 4;
        f.line(px - c.TRAIL_LEN * prog, py, px, py, mixc(ICE, BG_DEEP, a), 1, 1);
      };
      for (const p of c.particles) {
        const xo = this._particleX(c, p, t);
        const u = p.phase < 0.5 ? p.phase * 2 : (p.phase - 0.5) * 2;
        drawP(xo, p.lane, clamp01(u), lerp2(0.9, 0.1, clamp01(u)));
      }
      for (const p of c.beatParticles) {
        if (!(p.beat <= t && t <= p.beat + 0.22)) continue;
        drawP(this._particleX(c, p, t), p.lane, 0.4, 0.9 * (1 - (t - p.beat) / 0.22));
      }
    }

    // ④ 接触点圆环
    if (visible) {
      const ring = t < 0.34
        ? (Math.min(2, Math.floor(phase(t, 0.10, 0.34) * 3)) % 2 === 0
            ? ICE : ICE.map((v) => Math.round(v * 0.35)))
        : ICE;
      f.ell(cx, yc, c.RING_R * 2, c.RING_R * 2, WARM, 2, 1, 0, WARM, 0.20);
      f.dashCircle(cx, yc, c.RING_R, ring, 1.5, 360, 0.001, 1, 0.9);
    }

    // ⑤ 两行主词：逐字淡入
    if (visible) {
      ctx.save();
      ctx.textBaseline = 'alphabetic';
      ctx.font = c.fMain;
      for (let gi = 0; gi < c.chars.length; gi++) {
        const g = c.chars[gi];
        const tChar = 0.72 + gi * c.CHAR_STAGGER;
        if (t < tChar) continue;
        const p = easeOutCubic2(phase(t, tChar, tChar + c.CHAR_FADE));
        const dy = (1 - p) * 8;
        const col = (g.li === 1 && t >= c.CYAN_AT) ? CYAN : ICE;
        ctx.fillStyle = css(col, p);
        ctx.fillText(g.ch, g.x * dpr, (c.baselines[g.li] + dy) * dpr);
      }
      ctx.restore();
    }

    // ⑥ 次级微词
    if (visible) {
      const ma = 1 - easeOutQuad2(phase(t, 0.89, 0.95));
      if (ma > 0.01) {
        ctx.save();
        ctx.font = c.fMicro;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = css(GREYBLUE, ma * 0.85);
        ctx.fillText('SWITCH:ON', (cx + 12) * dpr, (yc + 18) * dpr);
        ctx.restore();
      }
    }

    f.micro({
      TL: 'T+0.10s', TR: this.chapter,
      BL: `seed:${this.seedHex} · nodes:240`, BR: this.status,
    }, { size: 18, alpha: 0.6 });
    return { bloomR: 8, bloomK: 0.35, grain: 2.5 };
  },

  _particleX(c, p, t) {
    const right = p.phase < 0.5;
    const u = right ? p.phase * 2 : (p.phase - 0.5) * 2;
    const hw = this._halfWidth(t);
    if (hw <= 0) return null;
    const prog = clamp01(u * 0.55 + easeInOutCubic2(phase(t, 0.10, 0.72)) * p.drag * 0.45);
    const x = prog * hw;
    return right ? x : -x;
  },
};

/* 局部缓动别名（避免循环依赖） */
const lerp2 = (a, b, p) => a + (b - a) * p;
const easeOutExpo2 = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const easeOutCubic2 = (p) => 1 - (1 - p) ** 3;
const easeOutQuad2 = (p) => 1 - (1 - p) ** 2;
const easeInOutCubic2 = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

/* ── 注册表 ───────────────────────────────────────────────── */
/**
 * 各章移植进来的镜头集合。
 * 约定：每个 `chNN.js` 导出 `CHnn_SHOTS`。
 * 每批移植完成后在这里加一行 import 与展开即可，不必改动其它逻辑。
 */
import { CH01_SHOTS } from './ch01.js';
import { CH02_SHOTS } from './ch02.js';
import { CH03_SHOTS } from './ch03.js';
import { CH04_SHOTS } from './ch04.js';
import { CH05_SHOTS } from './ch05.js';
import { CH06_SHOTS } from './ch06.js';
import { CH07_SHOTS } from './ch07.js';
import { CH08_SHOTS } from './ch08.js';
import { CH09_SHOTS } from './ch09.js';
import { CH10_SHOTS } from './ch10.js';
import { CH11_SHOTS } from './ch11.js';
import { CH12_SHOTS } from './ch12.js';

const CHAPTER_GROUPS = [
  CH01_SHOTS,
  CH02_SHOTS,
  CH03_SHOTS,
  CH04_SHOTS,
  CH05_SHOTS,
  CH06_SHOTS,
  CH07_SHOTS,
  CH08_SHOTS,
  CH09_SHOTS,
  CH10_SHOTS,
  CH11_SHOTS,
  CH12_SHOTS,
];

export const ALL_SHOTS = [
  SHOT_LEADIN,
  SHOT_006,
  ...CHAPTER_GROUPS.flat(),
].sort((a, b) => a.start - b.start);

/** 向后兼容：旧代码取 SHOTS */
export const SHOTS = ALL_SHOTS;

/** 已移植镜头的覆盖区间（供播放器/工具统计） */
export function coverage() {
  return ALL_SHOTS
    .filter((s) => typeof s.draw === 'function')
    .map((s) => ({ id: s.id, start: s.start, end: s.end }))
    .sort((a, b) => a.start - b.start);
}

/**
 * 预热：在**任何绘制之前**完成所有依赖字体度量的初始化。
 *
 * 为什么必须预热：逐字位置要用真实字体宽度计算，这段计算只能在拿到 2D 上下文后做。
 * 若把它留在首次 draw() 里惰性执行，首次绘制会比后续多出测量调用，
 * 且渲染结果依赖于「这一帧是不是第一帧」——这正是本项目禁止的跨帧隐藏状态。
 */
export function primeShots(beats = []) {
  const scratch = document.createElement('canvas');
  scratch.width = BASE_W; scratch.height = BASE_H;
  const mctx = scratch.getContext('2d');
  let n = 0;
  for (const s of ALL_SHOTS) {
    if (typeof s._init === 'function') { s._init(mctx, beats); n++; }
  }
  return n;
}
