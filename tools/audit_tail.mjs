/** web/tools/audit_tail.mjs — 末段（正片 204–211.98s）逐帧绘制量审计
 *
 *  目的：不要凭「没抛异常」判断画面正常。这里逐帧渲染，统计
 *    · 绘制调用数
 *    · 主层实际绘制的**字符内容**（区分「有画」和「画的是空白」）
 *  以定位「画面近乎纯黑」的区间。
 */
import { installDom, makeCtx } from './harness.mjs';

installDom();
const { ALL_SHOTS } = await import('../js/shots.js');

const A = process.argv[2] ? parseFloat(process.argv[2]) : 204.0;
const B = process.argv[3] ? parseFloat(process.argv[3]) : 211.98;

console.log(`=== 末段逐帧审计（正片 ${A.toFixed(2)}–${B.toFixed(2)}s）===`);
const rows = [];
const NSTEP = Math.round((B - A) / 0.1);
for (let i = 0; i <= NSTEP; i++) {
  const ft = A + i * 0.1;
  const s = ALL_SHOTS.find((x) => ft >= x.start - 1e-9 && ft < x.end - 1e-9);
  if (!s) continue;
  const g = makeCtx();
  // 分离「大字号内容」（主词/巨字/状态行）与「四角微字」（z3，16px）
  let big = 0, micro = 0;
  const bigText = [];
  g.fillText = function (str) {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.font || '');
    const px = m ? parseFloat(m[1]) : 0;
    if (px >= 20) { big++; bigText.push(str); } else micro++;
  };
  const gg = makeCtx(); gg.fillText = () => {};
  let n = 0, err = '';
  try { s.draw(g, gg, ft, 1, []); n = g._T.length; } catch (e) { err = e.message; }
  const ink = g._T.filter((x) => !/^(sv|rs|clip)$/.test(x)).length;
  rows.push({ ft, id: s.id, n, ink, big, micro, text: bigText.join('').replace(/\s/g, ''), err });
}

console.log('\n  正片时刻   播放时刻   镜头        调用  实体  大字  微字  大字内容');
for (let i = 0; i < rows.length; i += 5) {
  const r = rows[i];
  const t = r.text.length > 24 ? `${r.text.slice(0, 24)}…` : r.text;
  console.log(`  ${r.ft.toFixed(2).padStart(8)}  ${(r.ft + 3).toFixed(2).padStart(8)}   ` +
              `${r.id.padEnd(10)} ${String(r.n).padStart(5)} ${String(r.ink).padStart(5)} ` +
              `${String(r.big).padStart(5)} ${String(r.micro).padStart(5)}  ${t}`);
}

// 找「没有大字号内容」的帧（微字不算内容）
const bare = rows.filter((r) => r.big === 0);
console.log(`\n  无大字内容的帧: ${bare.length} / ${rows.length}`);
if (bare.length) {
  const runs = [];
  let st = bare[0].ft, prev = bare[0].ft;
  for (let i = 1; i < bare.length; i++) {
    if (bare[i].ft - prev > 0.15) { runs.push([st, prev]); st = bare[i].ft; }
    prev = bare[i].ft;
  }
  runs.push([st, prev]);
  for (const [a, b] of runs) {
    console.log(`    ★ 正片 ${a.toFixed(2)}–${b.toFixed(2)}s  ` +
                `(播放 ${(a + 3).toFixed(2)}–${(b + 3).toFixed(2)}s)  时长 ${(b - a).toFixed(2)}s`);
  }
}
const errs = rows.filter((r) => r.err);
console.log(`\n  出错帧: ${errs.length}` + (errs.length ? ` 例: ${errs[0].err}` : ''));
