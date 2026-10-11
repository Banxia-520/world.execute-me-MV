/**
 * app.js — 极简播放器
 *
 * 只有一个职责：用音频时钟驱动画面。
 *   · 播放 / 暂停（按钮或空格）
 *   · 画面时间 = 音频 currentTime，因此音画天然同步
 *   · 场景由各章模块提供，接口：draw(ctx, gctx, t, dpr, beats) -> 光效参数
 *
 * 确定性：同一 t 必画出同一画面（无跨帧状态），故拖动/跳转/导出都能按需求值。
 */
import {
  BASE_W, BASE_H, BG_DEEP, ICE, CYAN, GREYBLUE, WARM,
  css, clamp01, loadFonts, bloom, grain, makeCanvas, seedFromHex,
} from './core.js';
import { primeShots, ALL_SHOTS } from './shots.js';

/* ── 时间轴 ───────────────────────────────────────────────── */
/**
 * 播放器时间轴（总时长与成片一致 3:38.98）：
 *
 *   0.00 – 3.00s     片头警示卡（**静音**，倒计时 3→2→1）
 *   3.00s 起         正片开始 **且音乐同时开始**（二者严格对齐）
 *   3.00 – 214.98s   正片（211.9833s）
 *   214.98 – 218.98s 片尾署名卡（5s，静音）
 *
 * 音乐起点之所以严格可控，是因为**前导静音已做进音轨文件**：
 * `player_audio.m4a` = 前 3.0s 静音 + 母版 211.9837s。
 * 播放器从 0 正常播放，**完全不需要 seek** —— 这样绝不可能出现
 * 「音乐从头响」或音画错位（此前靠 seek 跳过，曾被浏览器异步落位坑过）。
 */
const INTRO_SECONDS = 3.0;                 // 片头卡时长 = 音轨前导静音 = 音乐起点
const MUSIC_START = INTRO_SECONDS;         // 正片开始即音乐开始
const FILM_SECONDS = 211.9837;                  // 正片 = 02_TIMELINE 的 duration_seconds（= 12719/60 的四位小数）
const OUTRO_SECONDS = 4.0;                 // 片尾卡时长（补足到与成片同为 3:38.98）
const FILM_START = INTRO_SECONDS;
const FILM_END = FILM_START + FILM_SECONDS;
const TOTAL_SECONDS = FILM_END + OUTRO_SECONDS;
const FPS = 60;

const $ = (id) => document.getElementById(id);

const state = {
  time: 0,
  playing: false,
  previewClock: 0,
  audioReady: false,
  beats: [],
  stalled: 0,          // 「播放中但时间没动」的连续帧数（停滞兜底用）
};

/** 仅供自验脚本与页面诊断使用（渲染逻辑不依赖外部读写） */
export { state as playerState };

/* ── 画布 ─────────────────────────────────────────────────── */
let canvas, ctx, glowCanvas, glowCtx, outW = 1920, outH = 1080, dpr = 1;

function setupCanvas(w, h) {
  outW = w; outH = h; dpr = w / BASE_W;
  canvas.width = w; canvas.height = h;
  ctx = canvas.getContext('2d', { alpha: false });
  glowCanvas = makeCanvas(w, h);
  glowCtx = glowCanvas.getContext('2d', { alpha: false });
}

/* ── 音频（作为唯一时钟）──────────────────────────────────── */
const audio = new Audio();
// 只预加载元数据：避免浏览器提前缓冲/解码，也避免任何隐式播放
audio.preload = 'metadata';
audio.crossOrigin = 'anonymous';

function updateAudioState() {
  state.audioReady = Number.isFinite(audio.duration) && audio.duration > 0;
}
audio.addEventListener('loadedmetadata', updateAudioState);
audio.addEventListener('error', () => {
  console.error('音轨载入失败；仍可用预览时钟查看画面');
});

/**
 * 把播放位置落到 t 秒**并确认生效**。
 *
 * 母版音频第 0.05 秒起就有内容（已实测），所以片头卡要静音，
 * 完全依赖这次 seek 真的生效。直接 `audio.currentTime = t` 在元数据未就绪
 * 或缓冲不足时会被浏览器忽略，于是 play() 从 0 开始 —— 这就是「音乐从头响」。
 *
 * 因此：等 `seeked` 确认落位；成功后**再复核一次实际位置**；带超时兜底。
 */
function seekAudioTo(t, timeoutMs = 900) {
  return new Promise((resolve) => {
    if (!state.audioReady || audio.readyState < 1) return resolve(false);
    const target = Math.max(0, Math.min(t, Math.max(0, audio.duration - 0.05)));
    if (Math.abs(audio.currentTime - target) < 0.03) return resolve(true);

    let done = false;
    const finish = (why) => {
      if (done) return;
      done = true;
      audio.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      const landed = Math.abs(audio.currentTime - target) < 0.08;
      diag.seek = `${target.toFixed(2)}→${audio.currentTime.toFixed(2)} ${landed ? 'OK' : 'FAIL'}(${why})`;
      resolve(landed);
    };
    const onSeeked = () => finish('event');
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    audio.addEventListener('seeked', onSeeked);
    try {
      audio.currentTime = target;
    } catch (e) {
      return finish('throw');
    }
    // 关键：赋 currentTime 是**异步落位**，不能在赋值后立即复核
    //（那样必然读到旧值而误判失败）。让出一拍再查。
    await0(() => finish('immediate'));
  });
}

/** 让出一个宏任务（setTimeout 0），用于等异步赋值落地 */
function await0(cb) { setTimeout(cb, 0); }

/** 诊断信息（内部状态；seek 失败/起播被阻止时仍会 console.warn） */
const diag = { seek: '—', blocked: 0 };

/* ── 节拍数据 ─────────────────────────────────────────────── */
async function loadBeats() {
  try {
    // 节拍网格随 web/ 一起分发（web/data/beats.json），保证单独上传 web/ 也能跑
    const r = await fetch('/data/beats.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    state.beats = j.beat_times || [];
  } catch (e) {
    console.error('节拍数据未载入，节拍微动将不生效', e);
    state.beats = [];
  }
}

/* ── 场景分发 ─────────────────────────────────────────────── */
/**
 * 始终返回对象（调用方用解构取值）。
 * 若在片头卡区间返回 null，解构会抛错并打断渲染循环——这正是本播放器
 * 早期「点播放画面不动」的根因，故此处不再返回 null。
 */
function shotAt(t) {
  if (t < FILM_START) return { shot: null, filmTime: 0, inIntro: true, inOutro: false };
  if (t >= FILM_END) return { shot: null, filmTime: FILM_SECONDS, inIntro: false, inOutro: true };
  const ft = t - FILM_START;
  let hit = null;
  for (const s of ALL_SHOTS) {
    if (ft >= s.start - 1e-9 && ft < s.end - 1e-9) { hit = s; break; }
  }
  return { shot: hit, filmTime: ft, inIntro: false, inOutro: false };
}

/* ── 片头警示卡（3 秒，含倒计时）──────────────────────────── */
const HOTSPOTS = ['0:05-0:15', '0:32-0:53', '1:07-1:10', '1:55-1:56',
                  '2:25-2:26', '2:44-2:49', '3:03-3:04'];

function drawIntroCard(t, c) {
  const W = outW, H = outH, k = dpr;
  c.fillStyle = 'rgb(22,22,22)';
  c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';

  const fCmd = `500 ${36 * k}px "JetBrains Mono", monospace`;
  const fLab = `700 ${34 * k}px "JetBrains Mono", monospace`;
  const fBody = `400 ${34 * k}px "JetBrains Mono", monospace`;
  const fSmall = `400 ${28 * k}px "JetBrains Mono", monospace`;
  const DIM = [110, 110, 110], BODY = [220, 220, 220], BRIGHT = [242, 242, 242];
  const OKC = [143, 208, 143];

  const x0 = 88 * k;
  let y = 56 * k;
  const lead = 56 * k;

  c.font = fCmd; c.fillStyle = css(BRIGHT);
  c.fillText('$ check "world.execute(me);"', x0, y + 36 * k);
  y += lead * 1.7;

  const segTop = y, barX = x0 - 4 * k;
  c.font = fLab;
  const lw = c.measureText('warning').width;
  c.fillStyle = css([236, 236, 236]);
  c.fillRect(x0 + 22 * k - 8 * k, y - 5 * k, lw + 16 * k, 47 * k);
  c.fillStyle = css([20, 20, 20]);
  c.fillText('warning', x0 + 22 * k, y + 34 * k);
  c.font = fBody; c.fillStyle = css(BODY);
  c.fillText(': rapidly changing, high-contrast cuts', x0 + 22 * k + lw + 22 * k, y + 34 * k);
  y += lead * 1.30;

  c.fillText('—→', x0 + 46 * k, y + 34 * k);
  c.fillText('peaks at 2:25 (29 cuts/s)', x0 + 148 * k, y + 34 * k);
  y += lead * 1.05;

  c.font = fSmall; c.fillStyle = css(DIM);
  c.fillText('|', x0 + 46 * k, y + 30 * k);
  c.fillStyle = css(BODY);
  c.fillText('dense-cut regions: ' + HOTSPOTS.join('  '), x0 + 148 * k, y + 30 * k);
  y += lead * 1.05;

  c.fillStyle = css(DIM); c.fillText('=', x0 + 46 * k, y + 30 * k);
  c.fillStyle = css(OKC);
  c.fillText('no bright-light flashes: peak luma 78.8/255, no frame above 128',
             x0 + 148 * k, y + 30 * k);
  y += lead * 1.05;

  c.fillStyle = css(DIM); c.fillText('=', x0 + 46 * k, y + 30 * k);
  c.fillStyle = css(OKC);
  c.fillText('no flashing: 63 luma shifts >20/255 film-wide, peak 5/s',
             x0 + 148 * k, y + 30 * k);
  y += lead * 1.05;

  c.fillStyle = css(DIM); c.fillText('=', x0 + 46 * k, y + 30 * k);
  c.fillStyle = css(BODY);
  c.fillText('note: may affect photosensitive viewers', x0 + 148 * k, y + 30 * k);
  y += lead * 1.05;

  c.fillStyle = css(DIM); c.fillText('=', x0 + 46 * k, y + 28 * k);
  c.fillStyle = css(BODY);
  c.fillText('以快速高对比剪辑为主；经逐帧检测无强光频闪，光敏者仍请注意',
             x0 + 148 * k, y + 28 * k);
  y += lead * 1.02;

  c.strokeStyle = css(DIM); c.lineWidth = 2 * k;
  c.beginPath(); c.moveTo(barX, segTop - 24 * k); c.lineTo(barX, y - 16 * k); c.stroke();

  const remain = Math.max(1, Math.ceil(INTRO_SECONDS) - Math.floor(t));  c.font = fBody; c.fillStyle = css(BODY);
  c.fillText('starting in ', x0, H - 146 * k + 34 * k);
  const w = c.measureText('starting in ').width;
  c.font = `700 ${42 * k}px "JetBrains Mono", monospace`;
  c.fillStyle = css(BRIGHT);
  c.fillText(String(remain), x0 + w, H - 146 * k + 34 * k);

  if (t > INTRO_SECONDS - 0.25) {
    const a = clamp01((t - (INTRO_SECONDS - 0.25)) / 0.25);
    c.fillStyle = `rgba(22,22,22,${a * 0.55})`;
    c.fillRect(0, 0, W, H);
  }
}

/* ── 尚未移植镜头的占位画面（诚实标注，不假装已完成）──────── */
function drawPlaceholder(filmTime, shot, c) {
  const W = outW, H = outH, k = dpr;
  c.fillStyle = css(BG_DEEP);
  c.fillRect(0, 0, W, H);

  c.strokeStyle = css(GREYBLUE, 0.14);
  c.lineWidth = 1 * k;
  const step = 60 * k;
  c.beginPath();
  for (let x = 0; x <= W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = 0; y <= H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();

  c.textBaseline = 'alphabetic';
  c.textAlign = 'center';
  const cx = W / 2;

  c.font = `700 ${72 * k}px "Inter Bold", "Inter Regular", sans-serif`;
  c.fillStyle = css(ICE, 0.92);
  c.fillText(shot ? shot.id : '—', cx, H * 0.44);

  c.font = `400 ${30 * k}px "JetBrains Mono", monospace`;
  c.fillStyle = css(CYAN, 0.9);
  c.fillText(shot && shot.lyric ? shot.lyric : '（本镜待移植到浏览器版）', cx, H * 0.52);

  c.font = `400 ${24 * k}px "JetBrains Mono", monospace`;
  c.fillStyle = css(GREYBLUE, 0.85);
  c.fillText('场景尚未移植到浏览器版', cx, H * 0.60);
  c.fillText(`t = ${filmTime.toFixed(3)}s`, cx, H * 0.65);
  c.textAlign = 'left';
}

/* ── 片尾署名卡（与成片一致）──────────────────────────────── */
function drawOutroCard(t, c) {
  const W = outW, H = outH, k = dpr;
  const local = t - FILM_END;                 // 0..OUTRO_SECONDS
  const BG = [22, 22, 22];
  c.fillStyle = css(BG);
  c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';
  c.textAlign = 'center';
  const cx = W / 2;

  const lines = [
    ['Unofficial fan-made video. Not affiliated with, or endorsed by, Mili.', 30, 500],
    ['Music: "world.execute(me);" by Mili. All imagery drawn procedurally in code.', 26, 400],
    ['非官方同人作品，与 Mili 无隶属或授权关系；画面全部由代码程序化生成。', 24, 400],
  ];
  const gap = 52 * k;
  let y = H * 0.80 - (gap * lines.length) / 2;
  for (const [s, px, wt] of lines) {
    c.font = `${wt} ${px * k}px "JetBrains Mono", monospace`;
    c.fillStyle = css([220, 220, 220]);
    c.fillText(s, cx, y + px * k * 0.8);
    y += gap;
  }
  // 上方细线
  c.strokeStyle = css([110, 110, 110]);
  c.lineWidth = 1 * k;
  c.beginPath();
  c.moveTo(W * 0.22, H * 0.80 - (gap * lines.length) / 2 - 40 * k);
  c.lineTo(W * 0.78, H * 0.80 - (gap * lines.length) / 2 - 40 * k);
  c.stroke();
  c.textAlign = 'left';

  // 首 0.3s 淡入、末 0.4s 淡出
  if (local < 0.3) {
    c.fillStyle = `rgba(22,22,22,${1 - clamp01(local / 0.3)})`;
    c.fillRect(0, 0, W, H);
  } else if (local > OUTRO_SECONDS - 0.4) {
    c.fillStyle = `rgba(22,22,22,${clamp01((local - (OUTRO_SECONDS - 0.4)) / 0.4)})`;
    c.fillRect(0, 0, W, H);
  }
}

/* ── 单帧渲染（确定性：只依赖 t）──────────────────────────── */
export function renderFrame(t, c) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  const { shot, filmTime, inIntro, inOutro } = shotAt(t);
  if (inIntro) { drawIntroCard(t, c); return; }
  if (inOutro) { drawOutroCard(t, c); return; }

  c.fillStyle = css(BG_DEEP);
  c.fillRect(0, 0, outW, outH);

  glowCtx.setTransform(1, 0, 0, 1, 0, 0);
  glowCtx.globalAlpha = 1;
  glowCtx.globalCompositeOperation = 'source-over';
  glowCtx.fillStyle = '#000';
  glowCtx.fillRect(0, 0, outW, outH);

  if (shot && typeof shot.draw === 'function') {
    let fx = null;
    try {
      fx = shot.draw(c, glowCtx, filmTime, dpr, state.beats);
    } catch (e) {
      console.error(`场景 ${shot.id} 绘制失败`, e);
      drawPlaceholder(filmTime, { id: shot.id, lyric: `渲染出错：${e.message}` }, c);
    }
    const o = fx || {};
    bloom(c, glowCanvas, o.bloomR != null ? o.bloomR : 8,
          o.bloomK != null ? o.bloomK : 0.35, dpr);
    grain(c, o.grain != null ? o.grain : 2.5,
          seedFromHex(shot.seedHex || '00000000') + Math.round(t * 60));
  } else {
    drawPlaceholder(filmTime, shot, c);
  }
}

/* ── 播放控制 ─────────────────────────────────────────────── */
function syncButton() {
  const b = $('play');
  b.textContent = state.playing ? '⏸ 暂停' : '▶ 播放';
  b.classList.toggle('playing', state.playing);
}

function fmt(s) {
  if (!Number.isFinite(s)) return '00:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** 把播放位置写进进度条与时间码（拖动中不覆盖用户操作） */
let seeking = false;
function syncProgress() {
  if (!seeking) {
    const el = $('seek');
    if (el) el.value = String(Math.round((state.time / TOTAL_SECONDS) * 10000));
    const tc = $('tc');
    if (tc) tc.innerHTML = `<b>${fmt(state.time)}</b> / ${fmt(TOTAL_SECONDS)}`;
  }
}

function seekTo(t) {
  state.time = Math.max(0, Math.min(t, TOTAL_SECONDS));
  state.previewClock = state.time;
  renderFrame(state.time, ctx);
  syncProgress();
  if (state.audioReady) seekAudioTo(state.time);   // 确认落位，失败也不阻塞画面
}

async function togglePlay() {
  if (!state.playing) {
    state.previewClock = state.time;
    state.playing = true;          // 先让画面动起来，音频就位后再对齐
    syncButton();
    if (state.audioReady) {
      // 音轨已把前导静音做进文件，故**从 0 播放即可**：
      // 片头卡期间音频本身就是静音，音乐精确自 MUSIC_START 起。
      // 只有当画面被拖到别处时才需要 seek。
      const want = state.time;
      if (want > 0.25) {
        const okSeek = await seekAudioTo(want);
        if (!state.playing) return;
        if (!okSeek) {
          diag.blocked++;
          console.warn(`音频未能定位到 ${want.toFixed(3)}s，本次不改变音频位置`);
        }
      }
      try {
        await audio.play();
      } catch (e) {
        console.error('播放失败', e);
      }
    }
  } else {
    if (state.audioReady) audio.pause();
    state.playing = false;
    syncButton();
  }
}

/* ── 渲染循环 ─────────────────────────────────────────────── */
let lastWall = performance.now();
let loopErrors = 0;
let lastLoopTime = -1;      // 上一帧的 state.time（用于「停滞兜底」检测）

function loop(now) {
  const dt = Math.min(0.25, (now - lastWall) / 1000);
  lastWall = now;

  try {
    if (state.playing) {
      if (state.audioReady) {
        // 保险：片头卡区间（t < 2s）音轨本身是静音；若因拖动等原因
        // 音频落在了有声区间，则把位置纠正回画面所在处。
        if (Math.abs(audio.currentTime - state.time) > 0.35) {
          diag.blocked++;
          seekAudioTo(state.time);
        }
        if (audio.ended) {
          // ⚠️ 音轨只到「正片结尾」（3.0 静音 + 211.9837 正片 ≈ 214.91s），
          // 而画面还要多出 OUTRO_SECONDS 的片尾卡。若继续把画面时间绑在
          // audio.currentTime 上，时间会卡在 ~3:34.9 不动 —— 片尾卡永远播不到、
          // 进度条也走不满。故音频结束后切换到本地时钟继续推进。
          state.previewClock += dt;
          state.time = Math.min(state.previewClock, TOTAL_SECONDS);
          if (state.time >= TOTAL_SECONDS) { state.playing = false; syncButton(); }
        } else {
          state.time = Math.min(audio.currentTime, TOTAL_SECONDS);
          state.previewClock = state.time;
        }
        // 兜底：播放中但时间没动（浏览器把 currentTime 钉在 duration、又没派 ended）
        // 时，用本地时钟顶上，保证片尾卡一定能播到。
        if (state.playing) {
          if (Math.abs(state.time - lastLoopTime) < 1e-4) {
            state.stalled++;
            if (state.stalled > 3) {
              state.previewClock += dt;
              state.time = Math.min(state.previewClock, TOTAL_SECONDS);
              if (state.time >= TOTAL_SECONDS) { state.playing = false; syncButton(); }
            }
          } else {
            state.stalled = 0;
          }
        }
      } else {
        state.previewClock += dt;
        state.time = Math.min(state.previewClock, TOTAL_SECONDS);
        if (state.time >= TOTAL_SECONDS) { state.playing = false; syncButton(); }
      }
    }
    lastLoopTime = state.time;
    renderFrame(state.time, ctx);
    syncProgress();
  } catch (e) {
    // 单帧出错绝不能打断循环，否则画面会永远冻在出错前那一帧
    loopErrors++;
    if (loopErrors <= 5) console.error(`渲染循环第 ${loopErrors} 次出错（t=${state.time.toFixed(3)}s）`, e);
  }
  requestAnimationFrame(loop);
}

/* ── 启动 ─────────────────────────────────────────────────── */
async function boot() {
  canvas = $('cv');
  setupCanvas(1920, 1080);

  await loadFonts();
  await loadBeats();
  primeShots(state.beats);

  const b = $('play');
  b.addEventListener('click', togglePlay);

  const seek = $('seek');
  if (seek) {
    // input 期间实时预览，change（松手）时落定
    seek.addEventListener('input', (e) => {
      seeking = true;
      seekTo((Number(e.target.value) / 10000) * TOTAL_SECONDS);
    });
    seek.addEventListener('change', () => { seeking = false; });
    seek.addEventListener('pointerup', () => { seeking = false; });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(state.time + 1); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(state.time - 1); }
  });
  b.focus();

  // 带前导静音的音轨：从 0 播放即可，音乐自 MUSIC_START(=3s) 起，无需 seek
  audio.src = '/media/player_audio.m4a';
  audio.load();

  syncButton();
  syncProgress();
  requestAnimationFrame(loop);
}

boot();
