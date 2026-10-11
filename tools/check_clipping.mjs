/**
 * tools/check_clipping.mjs — 全片排查「主词被画布顶边裁切」
 *
 * 判据：取每镜中字号最大的那行文字，估其字形顶 = 基线 − 字号×0.73。
 * 若字形顶 < 0，说明主词顶部被裁掉（多半是移植时误用了 Python 的 y_top 约定）。
 */
import { installDom, makeCtx } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats } from './paths.mjs';
installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = dirname(dirname(HERE));
const groups = process.argv.slice(2);
if (!groups.length) { console.error('用法: node web/tools/check_clipping.mjs ch01 ch02 ...'); process.exit(2); }

const beats = [];
try {
  const j = loadBeats();
  if (j.beat_times) beats.push(...j.beat_times);
} catch { /* 近似 */ }

let flagged = 0, checked = 0;
for (const grp of groups) {
  const mod = await import(`../js/${grp}.js`);
  const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
  for (const s of mod[key]) {
    if (typeof s.draw !== 'function') continue;
    const span = s.end - s.start;
    let worst = null;
    for (const fr of [0.15, 0.4, 0.65, 0.9]) {
      const t = s.start + span * fr;
      const g = makeCtx();
      try { s.draw(g, makeCtx(), t, 1, beats); } catch { continue; }
      const rows = new Map();
      for (const tr of g._T) {
        const m = /^T"(.*)"@(-?[\d.]+),(-?[\d.]+)\|(.*?)\|(\d+(?:\.\d+)?)px "([^"]+)"/.exec(tr);
        if (!m) continue;
        const px = parseFloat(m.group(5));
        if (px < 80) continue;                     // 只看主词级字号
        const y = parseFloat(m.group(3));
        const k = Math.round(y);
        if (!rows.has(k)) rows.set(k, { n: 0, px, x0: 1e9, x1: -1e9, txt: '' });
        const r = rows.get(k);
        r.n++; r.px = Math.max(r.px, px);
        r.x0 = Math.min(r.x0, parseFloat(m.group(2)));
        r.x1 = Math.max(r.x1, parseFloat(m.group(2)));
        r.txt += m.group(1);
      }
      for (const [y, r] of rows) {
        if (r.n < 2) continue;
        const top = y - r.px * 0.73;
        if (!worst || top < worst.top) worst = { y, px: r.px, top, txt: r.txt, x0: r.x0, x1: r.x1, fr, n: r.n };
      }
    }
    checked++;
    if (worst && worst.top < 0) {
      flagged++;
      console.log(`  ★ ${s.id}  基线 y=${worst.y}  字号 ${worst.px}px  `
        + `字形顶 ≈ ${worst.top.toFixed(0)}（被裁 ${(-worst.top).toFixed(0)}px）  "${worst.txt.slice(0, 20)}"`);
    } else if (worst && worst.top >= 0 && worst.top < 20) {
      console.log(`  ! ${s.id}  字形顶 ≈ ${worst.top.toFixed(0)}px（贴近上边缘）  "${worst.txt.slice(0, 20)}"`);
    }
  }
}
console.log(`\n共检查 ${checked} 镜，${flagged} 镜主词被顶边裁切`);
