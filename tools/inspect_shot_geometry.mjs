/** tools/inspect_shot_geometry.mjs — 检查某镜的绘制几何，找出遮挡 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));

const which = process.argv[2] || 'ch02';
const ids = process.argv.slice(3);
const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shots = mod[key].filter((s) => !ids.length || ids.includes(s.id));

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

for (const s of shots) {
  const mid = (s.start + s.end) / 2;
  const g = makeCtx(), gl = makeCtx();
  try { s.draw(g, gl, mid, 1, beats); } catch (e) {
    console.log(`  ★ ${s.id} 绘制出错: ${e.message}`);
    continue;
  }
  // 统计各类调用与坐标范围
  const boxes = [];
  let x = 0, y = 0;
  let maxR = 0;
  for (let i = 0; i < g._T.length; i++) {
    const t = g._T[i];
    if (t[0] === 'M' || t[0] === 'L' || t[0] === 'T' || t[0] === 'FR' || t[0] === 'E' || t[0] === 'A') {
      const m = /^[A-Z]+(-?[\d.]+),(-?[\d.]+)/.exec(t.slice(1));
    }
  }
  // 用正则扫 raw 轨迹里的数值范围
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const t of g._T) {
    const nums = String(t).match(/-?\d+(?:\.\d+)?/g);
    if (!nums) continue;
    const v = nums.map(Number);
    if (t.startsWith('FR')) {          // fillRect x,y,w,h
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0] + v[2]);
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1] + v[3]);
    } else if (t.startsWith('E')) {    // ellipse cx,cy,rx,ry
      minX = Math.min(minX, v[0] - v[2]); maxX = Math.max(maxX, v[0] + v[2]);
      minY = Math.min(minY, v[1] - v[3]); maxY = Math.max(maxY, v[1] + v[3]);
    } else if (t.startsWith('A')) {    // arc cx,cy,r
      minX = Math.min(minX, v[0] - v[2]); maxX = Math.max(maxX, v[0] + v[2]);
      minY = Math.min(minY, v[1] - v[2]); maxY = Math.max(maxY, v[1] + v[2]);
    } else if (t[0] === 'M' || t[0] === 'L') {
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    }
  }
  const fills = g._T.filter((t) => t.startsWith('FR')).length;
  const texts = g._T.filter((t) => t.startsWith('T"')).length;
  console.log(`\n=== ${s.id}  (t=${mid.toFixed(3)}) ===`);
  console.log(`  调用 ${g._T.length}（主层） / ${gl._T.length}（高光）`);
  console.log(`  填充矩形 ${fills}，文字片段 ${texts}`);
  console.log(`  坐标范围 x[${minX.toFixed(0)}, ${maxX.toFixed(0)}]  y[${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);
  console.log(`  画布 1920x1080 —— ${minX < -50 || maxX > 1970 || minY < -50 || maxY > 1130 ? '★ 有元素超出画布' : 'OK 元素都在画布内'}`);
  // 列出最大的几个填充矩形（最可能遮挡）
  const big = g._T.filter((t) => t.startsWith('FR'))
    .map((t) => { const v = String(t).slice(2).match(/-?\d+(?:\.\d+)?/g).map(Number); return { x: v[0], y: v[1], w: v[2], h: v[3], a: v[2] * v[3] }; })
    .filter((r) => r.a > 20000)
    .sort((p, q) => q.a - p.a).slice(0, 6);
  if (big.length) {
    console.log('  最大的填充矩形（可能遮挡主词）：');
    for (const r of big) console.log(`    x=${r.x.toFixed(0)} y=${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`);
  }
}
