/** tools/check_main_word.mjs — 主词实测：字号、整行宽度、是否超 1728px 上限 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const which = process.argv[2];
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
  // 用 _c 里缓存的 Word 实例量宽度（若存在）
  const info = [];
  const c = s._c;
  if (c) {
    for (const [k, v] of Object.entries(c)) {
      if (v && typeof v === 'object' && Array.isArray(v.chars) && typeof v.width === 'number') {
        info.push({ key: k, chars: v.chars.length, width: v.width, px: v.px, font: v.font });
      }
    }
  }
  console.log(`\n=== ${s.id}  ${s.start}-${s.end} ===`);
  if (!info.length) {
    // 退而求其次：从轨迹里估
    const t = s.start + (s.end - s.start) * 0.9;
    const g = makeCtx();
    s.draw(g, makeCtx(), t, 1, beats);
    const texts = [];
    for (const tr of g._T) {
      const m = /^T"(.*)"@(-?[\d.]+),(-?[\d.]+)/.exec(tr);
      if (m) texts.push({ s: m[1], x: +m[2], y: +m[3] });
    }
    // 按基线聚类成行，取字符数最多的一行
    const rows = new Map();
    for (const x of texts) {
      const k = Math.round(x.y);
      (rows.get(k) || rows.set(k, []).get(k)).push(x);
    }
    let best = null;
    for (const [y, arr] of rows) {
      if (!best || arr.length > best.arr.length) best = { y, arr };
    }
    if (best && best.arr.length > 1) {
      best.arr.sort((a, b) => a.x - b.x);
      const x0 = best.arr[0].x, x1 = best.arr[best.arr.length - 1].x;
      const str = best.arr.map((z) => z.s).join('');
      console.log(`  （从轨迹估计）y=${best.y}  x[${x0.toFixed(0)},${x1.toFixed(0)}]  `
        + `字距跨度 ≈ ${(x1 - x0).toFixed(0)}px  "${str}"`);
    } else {
      console.log('  未取到主词轨迹（可能该镜此刻无主词）');
    }
  } else {
    for (const z of info) {
      const flag = z.width > 1728 ? ' ★超 1728px 上限' : 'OK';
      console.log(`  ${z.key}: ${z.chars} 字, 字号 ${z.px || '?'}, 宽 ${z.width.toFixed(1)}px  ${flag}`);
      if (z.font) console.log(`     字体: ${z.font}`);
    }
  }
}
