/** tools/list_texts.mjs — 导出某镜所有文字的位置与内容（含基线 y） */
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
const frames = (process.argv[4] || '0.15,0.5,0.85').split(',').map(Number);

const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shot = mod[key].find((s) => s.id === id);
const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

const span = shot.end - shot.start;
console.log(`=== ${id}  ${shot.start}-${shot.end} ===`);
for (const f of frames) {
  const t = shot.start + span * f;
  const g = makeCtx();
  try { shot.draw(g, makeCtx(), t, 1, beats); } catch (e) { console.log(`  ★ ${e.message}`); continue; }
  const texts = [];
  for (const tr of g._T) {
    const m = /^T"(.*)"@(-?[\d.]+),(-?[\d.]+)/.exec(tr);
    if (m) texts.push({ s: m[1], x: +m[2], y: +m[3] });
  }
  // 合并成行（同一基线的连续字符）
  const rows = new Map();
  for (const x of texts) {
    const k = Math.round(x.y);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(x);
  }
  console.log(`\n  t=${t.toFixed(3)}（镜内 ${(f * 100).toFixed(0)}%）共 ${texts.length} 个文字片段，${rows.size} 行`);
  const sorted = [...rows.entries()].sort((a, b) => a[0] - b[0]);
  for (const [y, arr] of sorted.slice(0, 12)) {
    arr.sort((a, b) => a.x - b.x);
    const str = arr.map((z) => z.s).join('');
    const x0 = arr[0].x, x1 = arr[arr.length - 1].x;
    const flag = (y > 1080 || y < 0 || x1 > 1920 || x0 < -10) ? ' ★越界' : '';
    console.log(`    y=${String(y).padStart(5)}  x[${x0.toFixed(0)},${x1.toFixed(0)}]  "${str.slice(0, 46)}"${flag}`);
  }
}
