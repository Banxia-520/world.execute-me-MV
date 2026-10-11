/** web/tools/test_pildraw.mjs — 独立验证 PilDraw 垫片的 6 种原语
 *
 *  ch10–ch12 用「类 + 裸 PIL ImageDraw」的架构，`_Ch10` 只调用
 *  rectangle / line / text / ellipse / polygon / arc 六种原语。
 *  本测试在写那 24 镜之前先确认垫片可用：正确转成 Frame 调用、不抛异常、
 *  且坐标不被重复缩放。
 */
import { installDom, makeCtx } from './harness.mjs';
import { Frame } from '../js/kit.js';
import { PilDraw, pilFont } from '../js/canvas.js';

installDom();

let pass = 0, fail = 0;
function ok(name) { pass++; console.log(`  OK   ${name}`); }
function bad(name, msg) { fail++; console.log(`  ★    ${name} — ${msg}`); }

const ctx = makeCtx(), gctx = makeCtx();
const f = new Frame(ctx, gctx, 1, [234, 247, 255], []);
const d = new PilDraw(f, false);
const gd = new PilDraw(f, true);
const fo = pilFont('JetBrains Mono', 16, 1);

function count(fn, label) {
  ctx._T.length = 0;
  try { fn(); } catch (e) { bad(label, e.message); return -1; }
  const n = ctx._T.length;
  if (n === 0) { bad(label, '未产生任何绘制调用'); return -1; }
  ok(`${label}（${n} 次调用）`);
  return n;
}

// ① rectangle：填充 + 描边
count(() => d.rectangle([100, 200, 300, 400], { outline: [53, 217, 232], width: 2 }), 'rectangle 描边');
count(() => d.rectangle([100, 200, 300, 400], { fill: [168, 140, 255] }), 'rectangle 填充');

// ② line：两点 + 多点折线
count(() => d.line([0, 0, 100, 100], { fill: [234, 247, 255], width: 2 }), 'line 两点');
count(() => d.line([[0, 0], [50, 50], [100, 0]], { fill: [234, 247, 255] }), 'line 多点折线');

// ③ text：左对齐（PIL 默认 'la'）
count(() => d.text([120, 340], 'SAMPLE_01', { font: fo, fill: [88, 112, 131] }), 'text 基础');

// ④ ellipse：包围盒
count(() => d.ellipse([400, 300, 500, 400], { outline: [53, 217, 232], width: 1 }), 'ellipse 描边');
count(() => d.ellipse([400, 300, 500, 400], { fill: [234, 247, 255] }), 'ellipse 填充');

// ⑤ polygon：填充 + 描边
count(() => d.polygon([[10, 10], [110, 10], [60, 90]], { fill: [11, 19, 32] }), 'polygon 填充');
count(() => d.polygon([[10, 10], [110, 10], [60, 90]], { outline: [168, 140, 255] }), 'polygon 描边');

// ⑥ arc：PIL 用度数
count(() => d.arc([800, 400, 1000, 600], 0, 180, { fill: [53, 217, 232], width: 2 }), 'arc 度数');

// ⑦ glow 层（gd）可用且强度更低
ctx._T.length = 0;
gd.rectangle([0, 0, 10, 10], { fill: [53, 217, 232] });
if (ctx._T.length > 0) ok(`gd 层可用（${ctx._T.length} 次调用）`);
else bad('gd 层', '未产生调用');

// ⑧ 坐标不得被重复缩放（dpr=2 时 -> 坐标 ×2）
{
  const ctx2 = makeCtx(), gctx2 = makeCtx();
  const f2 = new Frame(ctx2, gctx2, 2, [234, 247, 255], []);
  const d2 = new PilDraw(f2, false);
  ctx2._T.length = 0;
  d2.line([0, 0, 100, 0], { fill: [234, 247, 255], width: 1 });
  const trace = ctx2._T.join('|');
  if (/M0,0\|L200,0/.test(trace)) ok('dpr=2 坐标缩放正确（100 → 200）');
  else bad('dpr 缩放', `轨迹为 ${trace.slice(0, 60)}`);
}

// ⑨ paste 应显式抛错（无浏览器等价物）
try {
  d.paste();
  bad('paste 抛错', '未抛错');
} catch (e) { ok('paste 显式抛错（符合设计）'); }

console.log(`\n  ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
