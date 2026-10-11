/**
 * glyphgeom.js — 字形栅格化与点阵采样（ch10–12 共用）
 *
 * 自 Python 版 render/scenes/ch10_study.py（ch11/ch12 为同一份拷贝）移植。
 * Python 侧用 PIL + numpy 做 L 掩膜与腐蚀；浏览器侧用**离屏 canvas 栅格化**。
 *
 * ⚠️ 基线换算（这里踩过坑）：PIL 的 `font.getbbox(ch)` 是**墨迹框** [x0,y0,x1,y1]，
 * 而 canvas 的 `fillText(x, y)` 的 y 是**基线**。要让墨迹左上落在 (pad,pad)：
 *     baseline = pad + font.asc - bb[3]
 * 早期版本写成 `pad - bb[1] + font.asc`（把 PIL 的墨迹偏移当基线偏移），
 * 因为 `asc` 是行高 ascent（远大于墨迹高），字会被推出画布 → 掩膜全空 →
 * 点阵采样为空 → 依赖它的镜头拿到 undefined 目标点而崩溃。
 */

import { BASE_W as W, BASE_H as H, ICE, CYAN, BLUEVIOLET, MOODPURPLE } from './core.js';

function rasterCtx(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d', { willReadFrequently: true });
  return { c, g };
}

/** 把单字栅格化为掩膜：返回 {w,h,data,cw} */
export function glyphMask(ch, font) {
  const pad = 3;
  const bb = font.getbbox(ch);
  const w = Math.max(1, bb[2] - bb[0] + 2 * pad);
  const h = Math.max(1, bb[3] - bb[1] + 2 * pad);
  const { c, g } = rasterCtx(w, h);
  g.font = font.fontStr;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.fillText(ch, pad - bb[0], pad + font.asc - bb[3]);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  return { w, h, data, cw: c.width };
}

/** 掩膜按 step 采点（阈值 128） */
export function sampleFill(m, step) {
  const out = [];
  for (let y = 0; y < m.h; y += step) {
    for (let x = 0; x < m.w; x += step) {
      if (m.data[(y * m.cw + x) * 4 + 3] >= 128) out.push([x, y]);
    }
  }
  return out;
}

/** 字形轮廓采样：二值化 ⊖ 腐蚀取等宽轮廓带 */
export function sampleOutline(m, step, band = 2) {
  const ink = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h)
    ? false : m.data[(y * m.cw + x) * 4 + 3] >= 128;
  const out = [];
  for (let y = 0; y < m.h; y += step) {
    for (let x = 0; x < m.w; x += step) {
      if (!ink(x, y)) continue;
      let edge = false;
      for (let dy = -band; dy <= band && !edge; dy += band) {
        for (let dx = -band; dx <= band && !edge; dx += band) {
          if (!ink(x + dx, y + dy)) edge = true;
        }
      }
      if (edge) out.push([x, y]);
    }
  }
  return out;
}

/** 掩膜墨迹包围盒 [x0,y0,x1,y1] */
export function maskBBox(m) {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (m.data[(y * m.cw + x) * 4 + 3] >= 128) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return [0, 0, m.w, m.h];
  return [x0, y0, x1 + 1, y1 + 1];
}

/** 把 `LOVE` 摆成「墨高 = targetH、总宽 = targetW（字距补齐）」的点阵
 *  返回 `{all, per}`（坐标基准 1920×1080） */
export function loveLayout(font, targetW, targetH, cx, cy, ss, mode = 'fill', step = 4) {
  const FULL = 'LOVE';
  const masks = {};
  for (const ch of FULL) {
    const m = glyphMask(ch, font);
    masks[ch] = { m, bb: maskBBox(m) };
  }
  const letters = [];
  for (const ch of FULL) {
    const { m, bb } = masks[ch];
    const w0 = bb[2] - bb[0], h0 = bb[3] - bb[1];
    const k = (targetH * ss) / Math.max(1, h0);
    letters.push({ ch, m, bb, k, w: w0 * k });
  }
  let sumW = letters.reduce((a, l) => a + l.w, 0);
  let track = (targetW * ss - sumW) / 3.0;
  if (track < 0.0) {
    const f = (targetW * ss) / sumW;
    for (const l of letters) { l.k *= f; l.w *= f; }
    sumW = letters.reduce((a, l) => a + l.w, 0);
    track = 0.0;
  }
  let x = cx * ss - (sumW + 3.0 * track) / 2.0;
  const yTop = cy * ss - (targetH * ss) / 2.0;
  const per = {};
  const all = [];
  const st = Math.max(1, Math.round(step * ss));
  for (const l of letters) {
    const sub = { w: l.bb[2] - l.bb[0], h: l.bb[3] - l.bb[1], cw: l.m.cw, data: l.m.data };
    const raw = mode === 'outline' ? sampleOutline(sub, st) : sampleFill(sub, st);
    const out = raw.map(([px, py]) => [(x + px * l.k) / ss, (yTop + py * l.k) / ss]);
    per[l.ch] = out;
    for (const p of out) all.push(p);
    x += l.w + track;
  }
  return { all, per };
}

/** 把一行文字按 fill 采样为点阵（坐标基准 1920×1080） */
export function sampleTextFill(text, font, ss, step = 4, inkTop = null, xLeft = null) {
  const pad = 3;
  const bb = font.getbbox(text);
  const w = Math.max(1, bb[2] - bb[0] + 2 * pad);
  const h = Math.max(1, bb[3] - bb[1] + 2 * pad);
  const { c, g } = rasterCtx(w, h);
  g.font = font.fontStr;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.fillText(text, pad - bb[0], pad + font.asc - bb[3]);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const m = { w, h, data, cw: c.width };
  const pts = sampleFill(m, Math.max(1, Math.round(step * ss)));
  const ox = xLeft === null ? 0.0 : xLeft;
  const oy = inkTop === null ? 0.0 : inkTop;
  return pts.map(([px, py]) => [(ox + px - pad) / ss, (oy + py - pad) / ss]);
}

/** 2.5D 立方 12 棱（前 4 + 后 4 + 连接 4） */
export function cubeEdges(cx, cy, fw, fh, offx, offy) {
  const front = [[cx - fw / 2, cy - fh / 2], [cx + fw / 2, cy - fh / 2],
                 [cx + fw / 2, cy + fh / 2], [cx - fw / 2, cy + fh / 2]];
  const back = front.map(([x, y]) => [x + offx, y + offy]);
  const edges = [];
  for (let i = 0; i < 4; i++) {
    edges.push([front[i], front[(i + 1) % 4]]);
    edges.push([back[i], back[(i + 1) % 4]]);
    edges.push([front[i], back[i]]);
  }
  return { front, back, edges };
}

export { W, H, ICE, CYAN, BLUEVIOLET, MOODPURPLE };
