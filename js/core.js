/**
 * core.js — 确定性渲染核心（Python 版 core/render_core.py 的忠实移植）
 *
 * 硬性约束：
 *   · 每帧是绝对时间 t 的纯函数，不使用累积状态
 *   · 随机来自固定 8 位十六进制 seed 派生的 PRNG，可乱序独立求值
 *   · 只允许引用 06 §2 登记的色值
 */

/* ── 色板（06 §2 登记色，#000000 受限）──────────────────────── */
export const PALETTE = {
  '#07111F': [0x07, 0x11, 0x1F], '#0B1320': [0x0B, 0x13, 0x20],
  '#EAF7FF': [0xEA, 0xF7, 0xFF], '#35D9E8': [0x35, 0xD9, 0xE8],
  '#7C83FF': [0x7C, 0x83, 0xFF], '#A88CFF': [0xA8, 0x8C, 0xFF],
  '#FF4668': [0xFF, 0x46, 0x68], '#FFD166': [0xFF, 0xD1, 0x66],
  '#587083': [0x58, 0x70, 0x83], '#000000': [0x00, 0x00, 0x00],
};

export const BG_DEEP = PALETTE['#07111F'];
export const BG_ALT = PALETTE['#0B1320'];
export const ICE = PALETTE['#EAF7FF'];
export const CYAN = PALETTE['#35D9E8'];
export const BLUEVIOLET = PALETTE['#7C83FF'];
export const MOODPURPLE = PALETTE['#A88CFF'];
export const ERRRED = PALETTE['#FF4668'];
export const WARM = PALETTE['#FFD166'];
export const GREYBLUE = PALETTE['#587083'];
export const BLACK = PALETTE['#000000'];

export const BASE_W = 1920;
export const BASE_H = 1080;
export const FPS = 60;

/** rgb 数组 → css 字符串（带不透明度） */
export function css(rgb, a = 1) {
  if (a >= 1) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, a)})`;
}

/** 把颜色按不透明度混到背景上（等价 Python 的 mix） */
export function mix(rgb, bg = BG_DEEP, k = 1) {
  const t = clamp01(k);
  return [
    Math.round(rgb[0] * t + bg[0] * (1 - t)),
    Math.round(rgb[1] * t + bg[1] * (1 - t)),
    Math.round(rgb[2] * t + bg[2] * (1 - t)),
  ];
}

/* ── 确定性 PRNG：splitmix64 + mulberry32（与 Python 版逐位一致）── */
const MASK64 = (1n << 64n) - 1n;

export function splitmix64(x) {
  let v = (BigInt.asUintN(64, BigInt(x)) + 0x9E3779B97F4A7C15n) & MASK64;
  let z = v;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
  return (z ^ (z >> 31n)) & MASK64;
}

export function seedFromHex(seedHex) {
  const s = String(seedHex).trim().toUpperCase();
  if (s.length !== 8 || /[^0-9A-F]/.test(s)) {
    throw new Error(`seed 必须是 8 位大写十六进制：${JSON.stringify(seedHex)}`);
  }
  return parseInt(s, 16);
}

export class Rng {
  constructor(shotSeed, system, index) {
    let h = BigInt.asUintN(64, BigInt(shotSeed));
    for (let i = 0; i < system.length; i++) h = splitmix64(h ^ BigInt(system.charCodeAt(i)));
    const mixed = splitmix64(h ^ BigInt.asUintN(64, BigInt(index) * 0x9E3779B97F4A7C15n));
    this.state = Number(mixed & 0xFFFFFFFFn);
  }
  /** mulberry32 → [0,1) */
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
}

/* ── 缓动 ─────────────────────────────────────────────────── */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** 把绝对时间映射到某阶段内的 0..1 进度 */
export function phase(t, t0, t1) {
  if (t1 <= t0) return t >= t1 ? 1 : 0;
  return clamp01((t - t0) / (t1 - t0));
}

export const linear = (p) => p;
export const easeOutQuad = (p) => 1 - (1 - p) ** 2;
export const easeInQuad = (p) => p * p;
export const easeOutCubic = (p) => 1 - (1 - p) ** 3;
export const easeInCubic = (p) => p ** 3;
export const easeInOutCubic = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
export const easeInOutSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
export const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
/** 四次缓入（自动转换产物会引用，故放在 core 统一提供） */
export const easeInQuart = (p) => p ** 4;
export const easeOutQuart = (p) => 1 - (1 - p) ** 4;
export const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
export const easeInOutQuart = (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);
/** 指数缓动（Python 各章在 0 处有特殊处理） */
export const easeInExpo = (p) => (p <= 0 ? 0 : 2 ** (10 * (p - 1)));
export const easeOutSine = (p) => Math.sin((Math.PI * p) / 2);
export const easeOutQuint = (p) => 1 - (1 - p) ** 5;
export const easeInQuint = (p) => p ** 5;
/** 五次缓入缓出（06 通用缓动之一） */
export const easeInOutQuint = (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2);
/** 弹跳缓出（与 Python 版 ch01 的实现一致） */
export function easeOutBounce(p) {
  p = clamp01(p);
  if (p < 1 / 2.75) return 7.5625 * p * p;
  if (p < 2 / 2.75) { p -= 1.5 / 2.75; return 7.5625 * p * p + 0.75; }
  if (p < 2.5 / 2.75) { p -= 2.25 / 2.75; return 7.5625 * p * p + 0.9375; }
  p -= 2.625 / 2.75;
  return 7.5625 * p * p + 0.984375;
}

/** 角度↔弧度（Python 的 math.radians/degrees 对应物） */
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

/** steps(n) 阶梯：返回 0..n-1 */
export function steps(t, n, t0, t1) {  const p = phase(t, t0, t1);
  if (p >= 1) return n - 1;
  return Math.min(n - 1, Math.floor(p * n));
}

export const lerp = (a, b, p) => a + (b - a) * p;

/* ── 画布辅助 ─────────────────────────────────────────────── */

/** 创建离屏画布 */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** 清为背景色 */
export function clear(ctx, rgb = BG_DEEP) {
  const { width: w, height: h } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = css(rgb);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 画点（等价 Python 的 draw_points） */
export function drawPoints(ctx, pts, r, rgb, alpha = 1, dpr = 1) {
  ctx.fillStyle = css(rgb, alpha);
  const rr = Math.max(0.5, r * dpr);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    ctx.beginPath();
    ctx.arc(p[0] * dpr, p[1] * dpr, rr, 0, 6.283185307179586);
    ctx.fill();
  }
}

/** 画折线 */
export function drawPolyline(ctx, pts, width, rgb, alpha = 1, dpr = 1, close = false) {
  if (pts.length < 2) return;
  ctx.strokeStyle = css(rgb, alpha);
  ctx.lineWidth = Math.max(0.5, width * dpr);
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * dpr, pts[0][1] * dpr);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * dpr, pts[i][1] * dpr);
  if (close) ctx.closePath();
  ctx.stroke();
}

/** 画圆环 */
export function drawCircle(ctx, cx, cy, r, width, rgb, alpha = 1, dpr = 1,
                           startAng = 0, endAng = Math.PI * 2) {
  ctx.strokeStyle = css(rgb, alpha);
  ctx.lineWidth = Math.max(0.5, width * dpr);
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, Math.max(0.1, r * dpr), startAng, endAng);
  ctx.stroke();
}

/** 画矩形（描边 / 填充） */
export function drawRect(ctx, x0, y0, x1, y1, rgb, alpha = 1, dpr = 1,
                        fill = false, width = 1) {
  if (fill) {
    ctx.fillStyle = css(rgb, alpha);
    ctx.fillRect(x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
  } else {
    ctx.strokeStyle = css(rgb, alpha);
    ctx.lineWidth = Math.max(0.5, width * dpr);
    ctx.strokeRect(x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
  }
}

export function textWidth(ctx, font, s) { return ctx.measureText(s).width; }

/* ── 光效 ─────────────────────────────────────────────────── */

/**
 * bloom：把高光层降采样后模糊再叠加。
 * 与 Python 版同构（低通后再合成），但由 GPU/合成器完成，代价极低。
 */
export function bloom(ctx, glowCanvas, radius, strength, dpr = 1) {
  if (strength <= 0) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const dw = Math.max(1, Math.round(w / 4)), dh = Math.max(1, Math.round(h / 4));
  const small = makeCanvas(dw, dh);
  const sc = small.getContext('2d');
  sc.imageSmoothingEnabled = true;
  sc.drawImage(glowCanvas, 0, 0, dw, dh);

  const blur = makeCanvas(dw, dh);
  const bc = blur.getContext('2d');
  bc.filter = `blur(${Math.max(0.5, (radius * dpr) / 4)}px)`;
  bc.drawImage(small, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blur, 0, 0, w, h);
  ctx.restore();
}

/**
 * 颗粒：预算一张确定性噪声贴图并平铺。
 * 避免逐像素运算，等价于 Python 版「低分辨率噪声放大后叠加」。
 */
const _grainCache = new Map();
function grainTile(seedState, size = 256) {
  const key = `${seedState}|${size}`;
  if (_grainCache.has(key)) return _grainCache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rng = new Rng(seedState, 'grain', 0);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + Math.round((rng.next() * 2 - 1) * 127);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (_grainCache.size > 8) _grainCache.clear();
  _grainCache.set(key, c);
  return c;
}

export function grain(ctx, amountPct, seedState, tile = 256) {
  if (amountPct <= 0) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const t = grainTile(seedState, tile);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = Math.min(1, amountPct / 25);
  const pat = ctx.createPattern(t, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 扫描线：隔行压暗（与 Python 版同构） */
export function scanline(ctx, strength, dpr = 1) {
  if (strength <= 0) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = css(BG_DEEP, Math.min(1, strength));
  const step = Math.max(2, Math.round(2 * dpr));
  for (let y = 1; y < h; y += step) ctx.fillRect(0, y, w, Math.max(1, Math.round(dpr)));
  ctx.restore();
}

/* ── 排版 ─────────────────────────────────────────────────── */

/**
 * 字级排版：返回每字的绘制位置。
 * 与 Python 版一致——不用整词绘制，以支持逐字错峰与分段变色。
 * align: 'left' | 'center' | 'right'；baselineY 为文字**基线**位置。
 */
export function layoutText(ctx, font, text, trackingPx, x, baselineY, align = 'left') {
  ctx.font = font;
  const total = textWidth(ctx, font, text) + trackingPx * Math.max(0, text.length - 1);
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  else if (align === 'right') cx = x - total;
  const out = [];
  for (const ch of text) {
    out.push({ ch, x: cx });
    cx += ctx.measureText(ch).width + trackingPx;
  }
  return { glyphs: out, width: total, startX: cx - total };
}

/** 整行宽度（含字距） */
export function measureLine(ctx, font, text, trackingPx = 0) {
  ctx.font = font;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width;
  return w + trackingPx * Math.max(0, text.length - 1);
}


/* ── 字体：必须在启动时确认可用（禁止静默回退）────────────── */

const FONT_FILES = {
  'Inter Regular': '/assets/fonts/Inter-Regular.ttf',
  'Inter Bold': '/assets/fonts/Inter-Bold.ttf',
  'JetBrains Mono': '/assets/fonts/JetBrainsMono-VariableFont_wght.ttf',
};

const _loaded = new Map();
export const fontStatus = { ready: false, loaded: [], failed: [] };

/** 载入随包字体；失败即抛错（不允许系统字体回退） */
export async function loadFonts() {
  fontStatus.loaded = []; fontStatus.failed = [];
  for (const [name, url] of Object.entries(FONT_FILES)) {
    try {
      const face = new FontFace(name, `url(${url})`);
      await face.load();
      document.fonts.add(face);
      _loaded.set(name, true);
      fontStatus.loaded.push(name);
    } catch (e) {
      fontStatus.failed.push(`${name}: ${e.message || e}`);
    }
  }
  fontStatus.ready = fontStatus.failed.length === 0;
  return fontStatus;
}

/** 生成 css font 简写；字重不足时用描边近似（见 assets/fonts/FONTS.md 的映射） */
export function font(sizePx, { family = 'Inter Bold', weight = null, dpr = 1 } = {}) {
  const fam = _loaded.has(family) ? family : (fontStatus.loaded[0] || 'sans-serif');
  const w = weight ? ` ${weight}` : '';
  return `${w} ${sizePx * dpr}px "${fam}"`.replace(/\s+/g, ' ').trim();
}

/** 字重 → (字体族, 描边系数)，与 Python 版 WEIGHT_MAP 一致 */
export const WEIGHT_MAP = {
  'Inter Regular': ['Inter Regular', 0.0],
  'Inter Medium': ['Inter Regular', 0.75],
  'Inter Semi-Bold': ['Inter Regular', 1.50],
  'Inter Bold': ['Inter Bold', 0.0],
  'Inter Extra-Bold': ['Inter Regular', 2.75],
  'JetBrains Mono': ['JetBrains Mono', 0.0],
  'JetBrains Mono Medium': ['JetBrains Mono', 0.0],
  'JetBrains Mono Bold': ['JetBrains Mono', 0.0],
};

/** 按 06 的字重写法取 (font 字符串, 描边像素) */
export function fontOf(weightName, sizePx, dpr = 1) {
  const m = WEIGHT_MAP[weightName];
  if (!m) throw new Error(`未登记的字重写法: ${weightName}`);
  const [family, k] = m;
  return [font(sizePx, { family, dpr }), (k * sizePx * dpr) / 96];
}
