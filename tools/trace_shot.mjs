/**
 * tools/trace_shot.mjs — 逐时间段导出某镜的绘制几何，定位越界或遮挡
 *
 * 注意：轨迹元素形如 `M123.4,567.8` / `T"yr:4096"@x,y` ——
 * **不能**用「提取全部数字」的方式解析，否则会把标签文字里的数字（如 yr:4096）
 * 误当成坐标。本脚本按格式分别解析，文字内容直接丢弃。
 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const which = process.argv[2];
const id = process.argv[3];
const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shot = mod[key].find((s) => s.id === id);
if (!shot) { console.log('未找到', id); process.exit(1); }

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

/** 解析一条轨迹为几何范围；返回 null 表示不携坐标 */
function geomOf(tr) {
  if (typeof tr !== 'string') return null;
  let m;
  if ((m = /^([ML])(-?[\d.]+),(-?[\d.]+)$/.exec(tr))) {
    const x = +m[2], y = +m[3];
    return { kind: m[1], x0: x, y0: y, x1: x, y1: y };
  }
  if ((m = /^A(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(tr))) {
    const x = +m[1], y = +m[2], r = +m[3];
    return { kind: 'A', x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  }
  if ((m = /^E(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(tr))) {
    const x = +m[1], y = +m[2], rx = +m[3], ry = +m[4];
    return { kind: 'E', x0: x - rx, y0: y - ry, x1: x + rx, y1: y + ry };
  }
  if ((m = /^FR(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(tr))) {
    const x = +m[1], y = +m[2], w = +m[3], h = +m[4];
    return { kind: 'FR', x0: x, y0: y, x1: x + w, y1: y + h };
  }
  if ((m = /^T".*"@(-?[\d.]+),(-?[\d.]+)/.exec(tr))) {
    const x = +m[1], y = +m[2];
    return { kind: 'T', x0: x, y0: y, x1: x, y1: y };
  }
  return null;
}

const span = shot.end - shot.start;
console.log(`=== ${id}  ${shot.start}-${shot.end} (${span.toFixed(3)}s) ===\n`);
console.log('  t       调用   几何范围                               越界  画面外最大 y');

for (let i = 0; i <= 8; i++) {
  const t = shot.start + (span * i) / 8;
  const g = makeCtx();
  try { shot.draw(g, makeCtx(), t, 1, beats); } catch (e) { console.log(`  t=${t.toFixed(3)} ★ ${e.message}`); continue; }

  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const bad = [];
  for (const tr of g._T) {
    const geo = geomOf(tr);
    if (!geo) continue;
    minX = Math.min(minX, geo.x0); maxX = Math.max(maxX, geo.x1);
    minY = Math.min(minY, geo.y0); maxY = Math.max(maxY, geo.y1);
    if (geo.y1 > 1080 || geo.y0 < 0 || geo.x1 > 1920 || geo.x0 < 0) bad.push({ tr, geo });
  }
  const outY = Math.max(0, maxY - 1080);
  console.log(`  ${t.toFixed(3)}  ${String(g._T.length).padStart(5)}  `
    + `x[${minX.toFixed(0)},${maxX.toFixed(0)}] y[${minY.toFixed(0)},${maxY.toFixed(0)}]`.padEnd(42)
    + `  ${String(bad.length).padStart(3)}  ${outY > 0 ? outY.toFixed(0) + 'px' : '-'}`);
  for (const b of bad.slice(0, 3)) {
    console.log(`        ${String(b.tr).slice(0, 70)}`);
  }
}
