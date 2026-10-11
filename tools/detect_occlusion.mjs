/**
 * tools/detect_occlusion.mjs — 找出某镜里「大面积不透明元素」（最可能遮挡主词）
 *
 * 判据：面积 > 画布 2% 的填充，或描边宽度 > 40 的矩形/圆（视觉上等同大色块）。
 * 输出还会报告该元素与主词基线的纵向重叠情况。
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
const ids = process.argv.slice(3);
const mod = await import(`../js/${which}.js`);
const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
const shots = mod[key].filter((s) => !ids.length || ids.includes(s.id));

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

const CANVAS = 1920 * 1080;

for (const s of shots) {
  const span = s.end - s.start;
  const issues = [];
  for (const frac of [0.1, 0.35, 0.6, 0.85]) {
    const t = s.start + span * frac;
    const g = makeCtx();
    try { s.draw(g, makeCtx(), t, 1, beats); } catch (e) { issues.push(`t=${t.toFixed(2)} 绘制出错 ${e.message}`); continue; }

    // 描边矩形：lineWidth 很大时视觉上等于色块
    let lw = 1;
    for (let i = 0; i < g._T.length; i++) {
      const tr = g._T[i];
      if (tr.startsWith('st')) {
        const m = /st.*?(\d+(?:\.\d+)?)$/.exec(tr);
        if (m) lw = parseFloat(m[1]);
      } else if (tr.startsWith('R')) {
        // rect(x,y,w,h) 后跟 stroke → 大 lineWidth 即大色块
        const m = /^R(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/.exec(tr);
        if (m) {
          const w = Math.abs(+m[3]), h = Math.abs(+m[4]);
          const area = (w + lw) * (h + lw) - w * h;   // 描边覆盖面积
          if (area > CANVAS * 0.02 || lw > 40) {
            issues.push(`t=${t.toFixed(2)}  粗描边矩形 x=${m[1]} y=${m[2]} ${w.toFixed(0)}x${h.toFixed(0)} lineWidth=${lw} 覆盖≈${(area / 1000).toFixed(0)}k px²`);
          }
        }
      } else if (tr.startsWith('FR')) {
        const m = /^FR(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(tr);
        if (m) {
          const w = Math.abs(+m[3]), h = Math.abs(+m[4]);
          if (w * h > CANVAS * 0.05) {
            issues.push(`t=${t.toFixed(2)}  大填充 x=${m[1]} y=${m[2]} ${w.toFixed(0)}x${h.toFixed(0)} （${((w * h) / CANVAS * 100).toFixed(0)}% 画布）`);
          }
        }
      }
    }
  }
  const uniq = [...new Set(issues)];
  console.log(`\n=== ${s.id}  ${s.start}-${s.end} ===`);
  if (!uniq.length) console.log('  未发现大面积不透明元素');
  else uniq.slice(0, 8).forEach((x) => console.log('  ★ ' + x));
}
