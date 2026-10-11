/**
 * primitives.js — 共享程序化图形基元（Python 版 core/primitives.py 的移植）
 *
 * 覆盖 11 类视觉母题：点云 / 轨道 / 粒子迁移 / 波形 / 频谱 / 网格 /
 * 参数曲线 / 多边形碎片 / 文字几何化 / 终端界面 / 节点图。
 * 全部为纯函数，任意元素可乱序独立求值。
 */
import {
  BASE_W, BASE_H, Rng, splitmix64, clamp01, lerp, phase,
  easeInOutCubic, easeOutCubic, drawPoints, drawPolyline, drawCircle,
  drawRect, css, BG_DEEP,
} from './core.js';

/* seed 文本 → 整数 */
export function seedOf(seedText) {
  const s = String(seedText).trim().toUpperCase();
  if (s.length === 8 && !/[^0-9A-F]/.test(s)) return parseInt(s, 16);
  let h = 0n;
  for (let i = 0; i < s.length; i++) h = splitmix64(h ^ BigInt(s.charCodeAt(i)));
  return Number(h & 0xFFFFFFFFn);
}

/* ── 1. 点云 ───────────────────────────────────────────────── */
export function cloudPoints(n, seedText, system, shape = 'sphere',
                            center = [0.5, 0.5], radius = 0.3, flat = 1.0) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H;
  const r = radius * BASE_W;
  const s = seedOf(seedText);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(s, system, i);
    const u = rng.next(), v = rng.next();
    let x, y;
    if (shape === 'sphere') {
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      x = cx + r * Math.sin(ph) * Math.cos(th);
      y = cy + r * Math.sin(ph) * Math.sin(th) * flat;
    } else if (shape === 'disk') {
      const th = u * Math.PI * 2, rr = r * Math.sqrt(v);
      x = cx + rr * Math.cos(th); y = cy + rr * Math.sin(th) * flat;
    } else if (shape === 'ring') {
      const th = u * Math.PI * 2, rr = r * (0.94 + 0.12 * v);
      x = cx + rr * Math.cos(th); y = cy + rr * Math.sin(th) * flat;
    } else if (shape === 'line') {
      x = cx + (u - 0.5) * 2 * r; y = cy + (v - 0.5) * 6 * flat;
    } else {
      x = cx + (u - 0.5) * 2 * r; y = cy + (v - 0.5) * 2 * r * flat;
    }
    pts.push([x, y]);
  }
  return pts;
}


/* ── 2. 轨道 / 同心圆 ─────────────────────────────────────── */
export function orbitalPositions(n, center = [0.5, 0.5], radius = 0.3,
                                 speedDegS = 30, t = 0, phaseOffsets = null, flat = 1) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H, r = radius * BASE_W;
  const out = [];
  for (let i = 0; i < n; i++) {
    const off = phaseOffsets ? phaseOffsets[i] : (i * 360) / Math.max(1, n);
    const th = ((off + speedDegS * t) * Math.PI) / 180;
    out.push([cx + r * Math.cos(th), cy + r * Math.sin(th) * flat]);
  }
  return out;
}


/* ── 3. 粒子迁移 / 螺旋吸入 ───────────────────────────────── */
export function flowPositions(src, dst, progress, ease = easeInOutCubic, arc = 0) {
  const p = ease(clamp01(progress));
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const a = src[i], b = dst[i % dst.length];
    out.push([
      lerp(a[0], b[0], p),
      lerp(a[1], b[1], p) - arc * 4 * p * (1 - p),
    ]);
  }
  return out;
}

export function orbitTransition(src, center = [0.5, 0.5], turns = 0.5,
                                progress = 0, ease = easeInOutCubic) {
  const p = ease(clamp01(progress));
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H;
  const out = [];
  for (const [x0, y0] of src) {
    const th = Math.atan2(y0 - cy, x0 - cx) + turns * Math.PI * 2 * p;
    const r = Math.hypot(x0 - cx, y0 - cy) * (1 - p);
    out.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  return out;
}

/* ── 4. 波形 ───────────────────────────────────────────────── */
export function waveformPoints(x0, x1, n, freq, amp, t, yBase,
                               harmonics = [1], speed = 1, phasePerHarmonic = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    const x = lerp(x0, x1, u);
    let y = 0;
    for (let hi = 0; hi < harmonics.length; hi++) {
      const k = hi + 1;
      y += harmonics[hi] * Math.sin(2 * Math.PI * (freq * k * u + speed * t * k)
                                    + phasePerHarmonic * hi);
    }
    out.push([x, yBase - amp * y]);
  }
  return out;
}

/* 频域柱群：envelope 为逐帧频带包络（0..1 数组） */
export function spectrumBars(n, envelope, t, yBase, height, x0 = 0,
                             width = BASE_W, seedText = '0', system = 'bars',
                             dur = 211.9837) {
  if (!envelope || !envelope.length) return [];
  const idx = Math.min(envelope.length - 1,
                       Math.floor(clamp01(t / dur) * (envelope.length - 1)));
  const base = envelope[idx];
  const s = seedOf(seedText);
  const bw = width / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(s, system, i);
    const shape = (1 - i / Math.max(1, n)) ** 1.4;
    const jit = 0.55 + 0.45 * rng.next();
    out.push([x0 + bw * (i + 0.5), bw * 0.32,
              height * shape * jit * (0.35 + 0.65 * base)]);
  }
  return out;
}

/* ── 5. 网格 / 点阵 ───────────────────────────────────────── */
export function gridLines(rows, cols, x0 = 0.05, y0 = 0.05, x1 = 0.95, y1 = 0.95,
                          deform = null) {
  const hs = [], vs = [];
  const map = (u, v) => {
    let a = u, b = v;
    if (deform) [a, b] = deform(u, v);
    return [a * BASE_W, b * BASE_H];
  };
  for (let r = 0; r <= rows; r++) {
    const v = r / rows, line = [];
    for (let c = 0; c <= cols; c++) line.push(map(x0 + (x1 - x0) * (c / cols), y0 + (y1 - y0) * v));
    hs.push(line);
  }
  for (let c = 0; c <= cols; c++) {
    const u = c / cols, line = [];
    for (let r = 0; r <= rows; r++) line.push(map(x0 + (x1 - x0) * u, y0 + (y1 - y0) * (r / rows)));
    vs.push(line);
  }
  return { hs, vs };
}


/* ── 6. 参数曲线 ───────────────────────────────────────────── */
export function curvePoints(kind, n, t = 0, kw = {}) {
  const out = [];
  if (kind === 'bezier') {
    const { p0, p1, p2 } = kw;
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1), iu = 1 - u;
      out.push([
        iu * iu * p0[0] + 2 * iu * u * p1[0] + u * u * p2[0],
        iu * iu * p0[1] + 2 * iu * u * p1[1] + u * u * p2[1],
      ]);
    }
  } else if (kind === 'spiral') {
    const c = kw.center || [0.5, 0.5], r0 = kw.r0 ?? 0.02, r1 = kw.r1 ?? 0.3,
          turns = kw.turns ?? 3;
    const cx = c[0] * BASE_W, cy = c[1] * BASE_H;
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1), th = turns * Math.PI * 2 * u;
      const r = lerp(r0, r1, u) * BASE_W;
      out.push([cx + r * Math.cos(th + t), cy + r * Math.sin(th + t)]);
    }
  } else if (kind === 'ellipse') {
    const c = kw.center || [0.5, 0.5], rx = kw.rx ?? 0.3, ry = kw.ry ?? 0.18,
          rot = kw.rot ?? 0;
    const cx = c[0] * BASE_W, cy = c[1] * BASE_H;
    for (let i = 0; i < n; i++) {
      const th = (2 * Math.PI * i) / Math.max(1, n - 1) + t;
      const x = rx * BASE_W * Math.cos(th), y = ry * BASE_H * Math.sin(th);
      out.push([cx + x * Math.cos(rot) - y * Math.sin(rot),
                cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
  } else if (kind === 'lissajous') {
    const a = kw.a ?? 3, b = kw.b ?? 2, d = kw.delta ?? Math.PI / 2;
    const c = kw.center || [0.5, 0.5], rx = kw.rx ?? 0.3, ry = kw.ry ?? 0.22;
    const cx = c[0] * BASE_W, cy = c[1] * BASE_H;
    for (let i = 0; i < n; i++) {
      const u = (2 * Math.PI * i) / Math.max(1, n - 1);
      out.push([cx + rx * BASE_W * Math.sin(a * u + t),
                cy + ry * BASE_H * Math.sin(b * u + d)]);
    }
  } else if (kind === 'parabola') {
    const c = kw.center || [0.5, 0.5], w = kw.w ?? 0.4, h = kw.h ?? 0.2;
    const cx = c[0] * BASE_W, cy = c[1] * BASE_H;
    for (let i = 0; i < n; i++) {
      const u = (i / Math.max(1, n - 1)) * 2 - 1;
      out.push([cx + u * w * BASE_W, cy + u * u * h * BASE_H]);
    }
  }
  return out;
}

/* ── 7. 多边形 / 碎片 ─────────────────────────────────────── */
export function regularPolygon(sides, center = [0.5, 0.5], radius = 0.3, rotDeg = 0) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H;
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotDeg + (360 * i) / sides) * Math.PI) / 180;
    out.push([cx + radius * BASE_W * Math.cos(a), cy + radius * BASE_W * Math.sin(a)]);
  }
  return out;
}

export function shards(n, seedText, system = 'shards', center = [0.5, 0.5], radius = 0.3) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H, R = radius * BASE_W;
  const s = seedOf(seedText);
  const out = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(s, system, i);
    const a0 = rng.range(0, Math.PI * 2), span = rng.range(0.12, 0.5);
    const rIn = R * rng.range(0.05, 0.45), rOut = R * (0.75 + 0.25 * rng.next());
    const ring = [a0, a0 + span * 0.4, a0 + span, a0 + span * 0.6];
    const rs = [rIn, rOut, rOut * 0.9, rIn * 1.3];
    const poly = [];
    for (let k = 0; k < 4; k++) poly.push([cx + rs[k] * Math.cos(ring[k]), cy + rs[k] * Math.sin(ring[k])]);
    out.push(poly);
  }
  return out;
}


/* ── 8. 文字几何化 ────────────────────────────────────────── */
/**
 * 把文字栅格化后按 step 采样为点（对应「按 4px 步长轮廓采样」）。
 * 返回基准坐标（1920×1080）。
 */
export function sampleTextPoints(text, fontStr, n, opts = {}) {
  const { step = 4, threshold = 128, box = null, dpr = 1 } = opts;
  const W = box ? box[2] - box[0] : BASE_W;
  const H = box ? box[3] - box[1] : BASE_H;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = fontStr;
  const w = g.measureText(text).width;
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.fillText(text, c.width / 2, c.height / 2);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const ox = box ? box[0] : 0, oy = box ? box[1] : 0;
  const pts = [];
  const st = Math.max(1, Math.round(step * dpr));
  for (let y = 0; y < c.height; y += st) {
    for (let x = 0; x < c.width; x += st) {
      if (data[(y * c.width + x) * 4 + 3] >= threshold) {
        pts.push([ox + x / dpr, oy + y / dpr]);
      }
    }
  }
  if (!pts.length) return [];
  // 确定性抽稀/重复到 n 个
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[i % pts.length]);
  return out;
}

/* ── 9. 终端 / UI ─────────────────────────────────────────── */
export function drawHLine(ctx, y, x0, x1, width, rgb, alpha = 1, dpr = 1) {
  drawPolyline(ctx, [[x0, y], [x1, y]], width, rgb, alpha, dpr);
}

export function drawCursor(ctx, x, y, w, h, rgb, on = true, alpha = 1, dpr = 1) {
  if (!on) return;
  drawRect(ctx, x, y, x + w, y + h, rgb, alpha, dpr, true);
}


/* ── 10. 节点图 ───────────────────────────────────────────── */
export function nodeGraphLayout(n, seedText, system = 'graph',
                                center = [0.5, 0.5], radius = 0.3) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H, R = radius * BASE_W;
  const s = seedOf(seedText);
  const out = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(s, system, i);
    const ring = i / Math.max(1, n - 1);
    const r = R * (0.15 + 0.85 * ring);
    const ang = rng.range(-Math.PI, Math.PI) * (0.35 + 0.65 * ring);
    out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return out;
}

export function chainPairs(n) {
  const out = [];
  for (let i = 0; i < n - 1; i++) out.push([i, i + 1]);
  return out;
}

export function ringPairs(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([i, (i + 1) % n]);
  return out;
}

/** 连线，progress<1 时逐条绘出 */
export function drawEdges(ctx, nodes, pairs, width, rgb, alpha = 0.5,
                          progress = 1, dpr = 1) {
  const lim = Math.floor(pairs.length * clamp01(progress)) + (progress > 0 ? 1 : 0);
  for (let k = 0; k < Math.min(lim, pairs.length); k++) {
    const [a, b] = pairs[k];
    let [x0, y0] = nodes[a]; let [x1, y1] = nodes[b];
    if (k === lim - 1 && progress < 0.999) {
      const f = (clamp01(progress) * pairs.length) % 1 || 1;
      x1 = lerp(x0, x1, f); y1 = lerp(y0, y1, f);
    }
    drawPolyline(ctx, [[x0, y0], [x1, y1]], width, rgb, alpha, dpr);
  }
}

/* ── 11. 几何变换辅助 ─────────────────────────────────────── */
export function scalePts(pts, center = [0.5, 0.5], k = 1) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H;
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

export function rotatePts(pts, center = [0.5, 0.5], deg = 0) {
  const cx = center[0] * BASE_W, cy = center[1] * BASE_H;
  const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * co - dy * si, cy + dx * si + dy * co];
  });
}

export function lerpPts(a, b, k) {
  return a.map((p, i) => [lerp(p[0], b[i % b.length][0], k), lerp(p[1], b[i % b.length][1], k)]);
}
