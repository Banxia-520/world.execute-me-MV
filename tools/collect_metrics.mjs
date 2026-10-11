/**
 * tools/collect_metrics.mjs — 收集「需要真实字宽」的 (字号, 字体族, 文本) 组合
 *
 * 做法：把 harness 的 measureText 临时指向一个「记录未命中项」的实现，
 * 跑一遍各章所有镜头，收集所有被量过的文本，写成任务清单交给 Python 测量。
 *
 * 用法：node web/tools/collect_metrics.mjs ch01 ch02 ch03 ch04
 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const groups = process.argv.slice(2);
if (!groups.length) { console.error('用法: node web/tools/collect_metrics.mjs ch01 ch02 ...'); process.exit(2); }

/** 解析 css font → { size, family } */
export function parseCssFont(css) {
  const m = /(\d+(?:\.\d+)?)px\s+"([^"]+)"/.exec(css || '');
  if (!m) return null;
  return { size: Math.round(parseFloat(m[1])), family: m[2] };
}

// 收集：key = `${size}|${family}` → Set(文本)
const need = new Map();
const seen = new Set();
globalThis.__metricSink = (css, text) => {
  const p = parseCssFont(css);
  if (!p) return;
  const k = `${p.size}|${p.family}`;
  if (!need.has(k)) need.set(k, new Set());
  need.get(k).add(text);
};

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

let shots = 0;
for (const grp of groups) {
  const mod = await import(`../js/${grp}.js`);
  const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
  for (const s of mod[key]) {
    if (typeof s.draw !== 'function') continue;
    shots++;
    const span = s.end - s.start;
    for (const fr of [0.1, 0.35, 0.6, 0.85, 0.98]) {
      const g = makeCtx();
      try { s.draw(g, makeCtx(), s.start + span * fr, 1, beats); } catch { /* 忽略 */ }
    }
  }
}

const tasks = [...need.entries()].map(([k, set]) => {
  const [size, family] = k.split('|');
  return { size: parseInt(size, 10), family, texts: [...set] };
});
writeFileSync(join(HERE, '_metrics_tasks.json'), JSON.stringify(tasks), 'utf-8');
const total = tasks.reduce((a, t) => a + t.texts.length, 0);
console.log(`扫描 ${shots} 镜，得到 ${tasks.length} 组字体、共 ${total} 条待测文本`);
