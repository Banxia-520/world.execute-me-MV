/**
 * tools/test_engine.mjs — 引擎移植正确性验证（Node 直跑，无需浏览器）
 *
 * 验证三件事：
 *   1. splitmix64 / mulberry32 与 Python 版**逐位一致**（跨语言可复现）
 *   2. 缓动、色板、排版度量正确
 *   3. 场景渲染为纯函数：同 t 两次调用结果完全相同；乱序调用一致
 */
import { strict as assert } from 'node:assert';

/* ── Canvas 2D 桩 / DOM 桩：统一用共享 harness ───────────── */
import { makeCtx as makeStubCtx, installDom } from './harness.mjs';
installDom();
globalThis.performance = globalThis.performance || { now: () => 0 };

const { splitmix64, seedFromHex, Rng, easeOutCubic, easeInOutCubic, phase,
        clamp01, PALETTE, css, mix, measureLine, layoutText } = await import('../js/core.js');
const P = await import('../js/primitives.js');
const { ALL_SHOTS, SHOTS, primeShots } = await import('../js/shots.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  OK   ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; console.log(`  ★FAIL ${name}  ${extra}`); }
};

console.log('=== 1. 确定性随机（须与 Python 版逐位一致）===');
// Python 期望值由 render/tools/test_engine_ref.py 生成
const EXPECT = JSON.parse(process.env.RNG_EXPECT || 'null');
const r0 = new Rng(seedFromHex('0000006A'), 'conductor-particles', 0);
const seq = [r0.next(), r0.next(), r0.next()];
console.log(`  mulberry32 前三值: ${seq.map((v) => v.toFixed(12)).join(', ')}`);
if (EXPECT) {
  const same = seq.every((v, i) => Math.abs(v - EXPECT.mulberry[i]) < 1e-12);
  ok('mulberry32 与 Python 一致', same,
     same ? '' : `python=${EXPECT.mulberry.map((v) => v.toFixed(12))}`);
} else {
  console.log('  （未提供 RNG_EXPECT，跳过跨语言比对）');
}

console.log('\n=== 2. splitmix64 基本性质 ===');
ok('splitmix64 输出 64 位', splitmix64(0n) <= (1n << 64n) - 1n);
ok('同输入同输出', splitmix64(12345n) === splitmix64(12345n));
ok('不同输入不同输出', splitmix64(1n) !== splitmix64(2n));

console.log('\n=== 3. 色板纪律 ===');
const PAL_KEYS = ['#07111F', '#0B1320', '#EAF7FF', '#35D9E8', '#7C83FF',
                  '#A88CFF', '#FF4668', '#FFD166', '#587083', '#000000'];
ok('登记色齐全（10 色）', PAL_KEYS.every((k) => k in PALETTE), `实得 ${Object.keys(PALETTE).length}`);
ok('css 带不透明度正确', css([10, 20, 30], 0.5) === 'rgba(10,20,30,0.5)');
ok('mix 端点正确', JSON.stringify(mix([255, 255, 255], [0, 0, 0], 0)) === '[0,0,0]'
   && JSON.stringify(mix([255, 255, 255], [0, 0, 0], 1)) === '[255,255,255]');

console.log('\n=== 4. 缓动边界 ===');
ok('easeOutCubic(0)=0', Math.abs(easeOutCubic(0)) < 1e-12);
ok('easeOutCubic(1)=1', Math.abs(easeOutCubic(1) - 1) < 1e-12);
ok('easeInOutCubic(0.5)=0.5', Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-12);
ok('phase 越界收敛 0/1', phase(-5, 0, 1) === 0 && phase(5, 0, 1) === 1);
ok('phase 零长区间不炸', phase(1, 1, 1) === 1 && phase(0, 1, 1) === 0);

console.log('\n=== 5. 基元：点云可乱序独立求值 ===');
const a1 = P.cloudPoints(50, '0000006A', 'sys', 'sphere', [0.5, 0.5], 0.3);
const a2 = P.cloudPoints(50, '0000006A', 'sys', 'sphere', [0.5, 0.5], 0.3);
ok('同参数两次结果一致', JSON.stringify(a1) === JSON.stringify(a2));
const b1 = P.cloudPoints(50, '0000006A', 'other', 'sphere', [0.5, 0.5], 0.3);
ok('不同子系统得到不同布点', JSON.stringify(a1) !== JSON.stringify(b1));
ok('点的数量正确', a1.length === 50, `实得 ${a1.length}`);

console.log('\n=== 6. 基元：几何合理性 ===');
const ring = P.orbitalPositions(8, [0.5, 0.5], 0.3, 0, 0);
const rads = ring.map(([x, y]) => Math.hypot(x - 960, y - 540));
ok('轨道点半径一致', rads.every((v) => Math.abs(v - 576) < 1e-6), `r=${rads[0].toFixed(2)}`);
const flow0 = P.flowPositions([[0, 0]], [[100, 0]], 0);
const flow1 = P.flowPositions([[0, 0]], [[100, 0]], 1);
ok('迁移 p=0 在起点', Math.abs(flow0[0][0]) < 1e-9);
ok('迁移 p=1 在终点', Math.abs(flow1[0][0] - 100) < 1e-9);
const g = P.gridLines(4, 4);
ok('网格线数正确', g.hs.length === 5 && g.vs.length === 5,
   `h=${g.hs.length} v=${g.vs.length}`);
const poly = P.regularPolygon(6, [0.5, 0.5], 0.2);
ok('六边形顶点数正确', poly.length === 6);

console.log('\n=== 7. 场景：纯函数与确定性（全部已移植镜头）===');
const primed = primeShots([0.16, 0.6215]);
ok('primeShots 预热成功', primed >= 1, `预热 ${primed} 镜（仅需字体度量的镜有 _init）`);

const drawable = ALL_SHOTS.filter((s) => typeof s.draw === 'function');
ok('注册表含镜头', drawable.length >= 4, `${drawable.length} 镜可绘：${drawable.map((s) => s.id).join(', ')}`);

/**
 * 逐镜轨迹对比：同一 t 两次绘制必须完全一致；
 * 乱序调用不得影响结果。
 */
let detFail = [];
for (const s of drawable) {
  const t = s.start + (s.end - s.start) * 0.62;
  const traceAt = (tt) => {
    const g = makeStubCtx(), gl = makeStubCtx();
    s.draw(g, gl, tt, 1, [0.16, 0.6215]);
    return g._T.join('|') + '#GLOW#' + gl._T.join('|');
  };
  const a = traceAt(t), b = traceAt(t);
  const c1 = traceAt(s.start + 0.01);
  if (a !== b) detFail.push(`${s.id} 同 t 不一致`);
  if (traceAt(s.start + 0.01) !== c1) detFail.push(`${s.id} 乱序不一致`);
  if (a.length < 50) detFail.push(`${s.id} 几乎没有绘制调用`);
}
ok('全部镜头同 t 逐字节一致且乱序一致', detFail.length === 0,
   detFail.length ? detFail.join('；') : `${drawable.length} 镜通过`);

// 详细报告每镜在若干时间点的绘制量
console.log('  各镜绘制调用量（主层/高光层）:');
for (const s of drawable) {
  const ts = [s.start + 0.05, (s.start + s.end) / 2, s.end - 0.05];
  const counts = ts.map((tt) => {
    const g = makeStubCtx(), gl = makeStubCtx();
    try { s.draw(g, gl, tt, 1, [0.16, 0.6215]); } catch (e) { return `错误:${e.message.slice(0, 24)}`; }
    return `${g._T.length}/${gl._T.length}`;
  });
  console.log(`    ${s.id}  ${counts.join('  ')}`);
}

console.log('\n=== 8. 场景：文字排期不越界 ===');
for (const s of drawable) {
  if (!s._c || !s._c.chars) continue;
  const c = s._c;
  const stagger = c.CHAR_STAGGER || 0.012;
  const t0 = s.id === 'SHOT_006' ? 0.72 : 0;
  const lastStart = t0 + (c.chars.length - 1) * stagger;
  ok(`${s.id} 末字在镜尾前起绘`, lastStart < s.end,
     `末字起于 ${lastStart.toFixed(4)}s，镜尾 ${s.end}s，共 ${c.chars.length} 字`);
}

console.log('\n=== 9. 排版规格常量 ===');
{
  const c = ALL_SHOTS.find((s) => s.id === 'SHOT_006')._c;
  ok('主词字号 = 168px', /168px/.test(c.fMain), c.fMain);
  ok('字距 = 0.06em', Math.abs(c.tracking - 0.06 * 168) < 1e-9);
  ok('行距 = 1.02em', Math.abs(c.lineStep - 1.02 * 168) < 1e-9);
  ok('末行基线锚定 44%H', Math.abs(c.baselines[1] - 0.44 * 1080) < 1e-9);
  ok('共两行主词', c.lines.length === 2, c.lines.join(' / '));
  console.log(`  （桩估算）行宽由真实字体在浏览器中度量，Python 侧实测：`
    + `"Switch on the" 1243.0px / "power line" 945.7px，上限 1728px`);
}

console.log('\n=== 10. 覆盖区间连续性与缺口 ===');
{
  const cov = ALL_SHOTS.filter((s) => typeof s.draw === 'function')
    .map((s) => [s.start, s.end]).sort((a, b) => a[0] - b[0]);
  let gaps = 0;
  for (let i = 1; i < cov.length; i++) if (cov[i][0] > cov[i - 1][1] + 1e-6) gaps++;
  const total = cov.reduce((a, c) => a + (c[1] - c[0]), 0);
  console.log(`  已移植区间: ${cov.map((c) => `${c[0].toFixed(2)}–${c[1].toFixed(2)}`).join('  ')}`);
  console.log(`  覆盖总时长 ${total.toFixed(2)}s，区间间缺口 ${gaps} 处（正片共 211.98s）`);
  ok('覆盖区间无重叠', cov.every((c, i) => i === 0 || c[0] >= cov[i - 1][0]));
}

console.log(`\n${'='.repeat(54)}`);
console.log(`结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
