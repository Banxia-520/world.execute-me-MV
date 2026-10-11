/**
 * tools/dump_trace.mjs — 导出某镜某时刻的绘制轨迹为 JSON（供 Python/PIL 回放成图）
 *
 * 用法：node web/tools/dump_trace.mjs ch02 SHOT_036 40.5 > trace.json
 *      （时间参数是**正片内部时间**，与场景 start/end 同一坐标系）
 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const [, , which, id, tArg] = process.argv;
if (!which || !id || tArg === undefined) {
  console.error('用法: node web/tools/dump_trace.mjs <chNN> <SHOT_XXX> <t>');
  process.exit(2);
}
const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shot = mod[key].find((s) => s.id === id);
if (!shot) { console.error('未找到', id); process.exit(2); }

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

const t = parseFloat(tArg);
const g = makeCtx();
shot.draw(g, makeCtx(), t, 1, beats);
process.stdout.write(JSON.stringify({
  shot: id, t, start: shot.start, end: shot.end, trace: g._T,
}));
