/**
 * tools/check_chapter.mjs — 章节自验入口
 *
 * 用法： node web/tools/check_chapter.mjs ch03 [ch04 ...]
 *
 * 对指定章节的镜头做：三时间点有绘制、无异常、同 t 二次一致、乱序一致、
 * 主词宽度 ≤1728px、时间与 seed 与规格表一致。
 */
import { installDom, checkShots } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBeats, requirePath, readOptional } from './paths.mjs';

installDom();

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = dirname(HERE);
const PROJ = dirname(WEB);

const args = process.argv.slice(2);
if (!args.length) {
  console.log('用法: node web/tools/check_chapter.mjs ch03 [ch04 ...]');
  process.exit(2);
}

/* 规格表（时间与 seed 的权威来源） */
const TL = JSON.parse(readFileSync(requirePath('data/02_TIMELINE.json'), 'utf8'));
const seedMap = new Map();
{
  const csvRaw = readOptional('data/SEED_MIGRATION_MAP.csv');
const csv = (csvRaw || '').split(/\r?\n/);
  const head = csv[0].split(',');
  const iId = head.findIndex((h) => /shot/i.test(h));
  const iNew = head.findIndex((h) => /new/i.test(h));
  for (const line of csv.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    if (cols[iId] && cols[iNew]) seedMap.set(cols[iId].trim(), cols[iNew].trim().toUpperCase());
  }
}
const timeMap = new Map(TL.shots.map((s) => [s.id, [s.start, s.end]]));

/* 全片拍点（供场景用） */
const beats = [];
{
  for (let t = 0.16; t < 212; t += 0.461538) beats.push(Math.round(t * 1e4) / 1e4);
  try {
    const j = loadBeats();
    if (j.beat_times && j.beat_times.length) beats.splice(0, beats.length, ...j.beat_times);
  } catch { /* 用上面的近似值 */ }
}

let totalFail = 0;
for (const ch of args) {
  const mod = await import(`../js/${ch}.js`);
  const key = Object.keys(mod).find((k) => /^CH\d+_SHOTS$/.test(k));
  if (!key) { console.log(`  ★ ${ch}.js 未导出 CHnn_SHOTS`); totalFail++; continue; }
  const shots = mod[key];
  console.log(`\n=== ${ch}  共 ${shots.length} 镜 ===`);

  // 时间与 seed 核对
  let metaFail = 0;
  for (const s of shots) {
    const tt = timeMap.get(s.id);
    if (!tt) { console.log(`  ★ ${s.id} 不在时间轴中`); metaFail++; continue; }
    // 容差 1e-5：时间轴里存在 71.02080000000001 这类浮点表示，非真误差
    if (Math.abs(tt[0] - s.start) > 1e-5 || Math.abs(tt[1] - s.end) > 1e-5) {
      console.log(`  ★ ${s.id} 时间不符: ${s.start}-${s.end} vs ${tt[0]}-${tt[1]}`); metaFail++;
    }
    const sd = seedMap.get(s.id);
    if (sd && sd !== String(s.seedHex).toUpperCase()) {
      console.log(`  ★ ${s.id} seed 不符: ${s.seedHex} vs ${sd}`); metaFail++;
    }
  }
  console.log(metaFail === 0 ? '  OK  时间与 seed 与规格表一致' : `  ★ ${metaFail} 处元数据不符`);

  const rep = checkShots(shots, beats);
  console.log(rep.text);
  totalFail += rep.fail + metaFail;

  // 关键：确认该章确实已接入播放器注册表（否则浏览器根本不会用到这些镜头）
  try {
    const reg = await import('../js/shots.js');
    const inReg = new Set(reg.ALL_SHOTS.map((s) => s.id));
    const notReg = shots.filter((s) => !inReg.has(s.id)).map((s) => s.id);
    if (notReg.length) {
      console.log(`  ★ 未接入注册表（浏览器不会播放）: ${notReg.slice(0, 8).join(', ')}`
        + `${notReg.length > 8 ? ` …共 ${notReg.length} 镜` : ''}`);
      totalFail += notReg.length;
    } else {
      console.log(`  OK  已接入注册表（ALL_SHOTS 含本章全部 ${shots.length} 镜）`);
    }
  } catch (e) {
    console.log(`  ★ 无法加载 shots.js 校验注册: ${e.message}`);
    totalFail++;
  }
}

console.log(`\n${'='.repeat(56)}`);
console.log(totalFail === 0 ? '章节自验: 全部通过' : `章节自验: ${totalFail} 项失败`);
process.exit(totalFail ? 1 : 0);
