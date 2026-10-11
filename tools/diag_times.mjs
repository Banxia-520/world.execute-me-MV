/** tools/diag_times.mjs — 在**指定时间点**渲染某镜，打印完整错误堆栈 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const [, , which, id, ...tArgs] = process.argv;
const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shot = mod[key].find((s) => s.id === id);
const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

for (const a of tArgs) {
  const t = parseFloat(a);
  const g = makeCtx();
  try {
    shot.draw(g, makeCtx(), t, 1, beats);
    console.log(`  t=${t}  OK（${g._T.length} 次绘制）`);
  } catch (e) {
    console.log(`  t=${t}  ★ ${e.message}`);
    (e.stack || '').split('\n').slice(1, 6).forEach((l) => console.log('      ' + l.trim()));
  }
}
