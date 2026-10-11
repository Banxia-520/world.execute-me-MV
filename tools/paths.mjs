/** web/tools/paths.mjs — web 自包含的路径解析
 *
 *  背景：本仓库设计成**只上传 web/ 一个文件夹**也能完整运行。
 *  但历史上部分脚本用 `PROJ = web 的上一层` 去找 `data/beats.json`、
 *  `02_TIMELINE.json`、`SEED_MIGRATION_MAP.csv` 等文件 —— 只上传 web 后这些会全部失败。
 *
 *  本模块统一解析：**优先 web 内部**（自包含部署），回退到包根（开发环境）。
 *
 *  用法：
 *      import { WEB, PROJ, dataFile, optionalFile } from './paths.mjs';
 *      const beats = JSON.parse(readFileSync(dataFile('beats.json'), 'utf8'));
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));   // web/tools
export const WEB = dirname(HERE);                        // web/
export const PROJ = dirname(WEB);                        // 包根（可能不存在，不影响）

/** 候选路径列表：web 内部优先，其次包根 */
function candidates(rel) {
  return [join(WEB, rel), join(PROJ, rel)];
}

/** 返回第一个存在的路径；都不存在时返回 web 内的候选（便于报错信息可读） */
export function resolvePath(rel) {
  for (const p of candidates(rel)) {
    if (existsSync(p)) return p;
  }
  return join(WEB, rel);
}

/** 同 `resolvePath`，但不存在时抛错（避免静默读到空数据） */
export function requirePath(rel) {
  for (const p of candidates(rel)) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `找不到 ${rel}\n  已尝试:\n    ${candidates(rel).join('\n    ')}\n` +
    `  提示：相对路径以 web/ 为根（例如 web/${rel}）。`);
}

/** 节拍网格（web/data/beats.json，自包含） */
export function beatsFile() { return requirePath('data/beats.json'); }

/** 节拍时间数组 */
export function loadBeats() {
  const j = JSON.parse(readFileSync(beatsFile(), 'utf8'));
  return j.beat_times || [];
}

/** 读取文本；可选文件缺失时返回 null 而不抛错 */
export function readOptional(rel) {
  for (const p of candidates(rel)) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return null;
}
