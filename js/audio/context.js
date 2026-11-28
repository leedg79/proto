// 오디오 컨텍스트 공용 관리
// iPhone은 사용자가 화면을 터치한 순간에만 소리를 켤 수 있으므로,
// 시작·재생 버튼 처리 안에서 unlockAudio()를 먼저 호출해야 함
// v2.10.0: 아이폰에서 마이크를 열거나 USB 장치를 꽂으면 오디오 시계가 멈추는 경우가 있어
//  - 시계가 실제로 흐르는지 확인하고, 멈췄으면 컨텍스트를 새로 만듦(구독자에게 알림)
//  - resume 등 기다리는 작업에 시간 제한을 둠

let ctx = null;
let recordMode = false;   // 마이크 사용 중이면 오디오 세션을 play-and-record로 둠
let everRan = false;      // 한 번이라도 소리가 돌았는지(멈춤 안내 판단용)
let lastFlow = 0;         // 시계가 흐르는 것을 마지막으로 본 때(performance.now)
let lastCt = -1, monitor = null, resets = 0;
const resetSubs = new Set();
const releaseSubs = new Set();
let released = false;     // 세션을 마쳐 일부러 쉬게 한 상태(멈춤 안내를 띄우지 않음)

export const sleep = ms => new Promise(r => setTimeout(r, ms));
// 약속(promise)에 시간 제한: 넘으면 오류(이름 Timeout)
export function withTimeout(p, ms, label = "작업") {
  let id;
  const t = new Promise((_, rej) => { id = setTimeout(() => { const e = new Error(`${label} 시간 초과`); e.name = "Timeout"; rej(e); }, ms); });
  return Promise.race([Promise.resolve(p).finally(() => clearTimeout(id)), t]);
}

export function setRecordMode(on) {
  recordMode = !!on;
  try { if (navigator.audioSession) navigator.audioSession.type = recordMode ? "play-and-record" : "playback"; } catch (_) {}
}
// iOS가 외부 입력(이어폰·USB 인터페이스)으로 경로를 바꾸게 하려고 마이크 열기 직전 잠깐 "auto"로 둠
// (WebKit 버그 282939에 보고된 우회 방법). 이 순간 시계가 멈출 수 있어 마이크를 연 뒤 ensureRunning으로 확인함
export function audioSessionAuto() {
  try { if (navigator.audioSession) navigator.audioSession.type = "auto"; } catch (_) {}
}

export function getAudioContext() {
  return ctx;
}
// 컨텍스트를 새로 만들 때 알림(옛 컨텍스트에 묶인 노드·재생기·마이크를 정리)
export function onAudioReset(fn) { resetSubs.add(fn); return () => resetSubs.delete(fn); }
// 세션을 마칠 때 정리(재생기 멈춤·마이크 닫기). 각 재생기·마이크가 등록함
export function onAudioRelease(fn) { releaseSubs.add(fn); return () => releaseSubs.delete(fn); }
export async function releaseAudio() {
  for (const f of releaseSubs) { try { f(); } catch (_) {} }
  released = true;
  recordMode = false;
  try { if (navigator.audioSession) navigator.audioSession.type = "auto"; } catch (_) {}
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } } catch (_) {}
  if (ctx && ctx.state === "running") { try { await withTimeout(ctx.suspend(), 1500, "오디오 쉬기"); } catch (_) {} }
}
export const isReleased = () => released;

function watch() {
  if (monitor) return;
  monitor = setInterval(() => {
    if (!ctx) return;
    const ct = ctx.currentTime;
    if (ctx.state === "running" && ct > lastCt + 0.05) { lastFlow = performance.now(); everRan = true; }
    lastCt = ct;
  }, 250);
}

function create() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx({ latencyHint: "interactive" });
  lastCt = -1; lastFlow = 0;
  watch();
  return ctx;
}

// 오디오 상태(진단 표시·멈춤 안내용)
export function audioHealth() {
  if (!ctx) return { exists: false, state: "none", sampleRate: 0, flowing: false, stalled: false, everRan, resets };
  const flowing = ctx.state === "running" && performance.now() - lastFlow < 1200;
  return { exists: true, state: ctx.state, sampleRate: ctx.sampleRate, flowing, stalled: everRan && !flowing && !released, released, everRan, resets, time: ctx.currentTime };
}

// 시계가 흐르는지 직접 확인(ms 동안 기다림)
async function clockFlows(c, ms = 160) {
  const a = c.currentTime;
  await sleep(ms);
  return c.currentTime > a + 0.02;
}

// 옛 컨텍스트를 버리고 새로 만듦(사용자 터치 안에서 부르는 것이 안전)
export async function resetAudio() {
  const old = ctx;
  ctx = null;
  resets++;
  for (const f of resetSubs) { try { f(); } catch (_) {} }
  if (old) { try { old.close(); } catch (_) {} }
  create();
  if (ctx && ctx.state !== "running") { try { await withTimeout(ctx.resume(), 1500, "오디오 켜기"); } catch (_) {} }
  return ctx;
}

// 컨텍스트가 실제로 돌아가게 만듦: resume(시간 제한) → 시계 확인 → 안 흐르면 새로 만듦
export async function ensureRunning() {
  released = false;
  if (!ctx) create();
  if (!ctx) return null;
  if (ctx.state !== "running") { try { await withTimeout(ctx.resume(), 1500, "오디오 켜기"); } catch (_) {} }
  if (ctx.state === "running" && performance.now() - lastFlow < 600) return ctx;
  if (ctx.state === "running" && (await clockFlows(ctx))) { lastFlow = performance.now(); everRan = true; return ctx; }
  // 멈춤(상태가 running인데 시계가 안 흐름, 또는 interrupted·suspended에서 안 풀림) → 새로 만듦
  if (window.__fretlabNoAudioReset) return ctx;
  await resetAudio();
  if (ctx && ctx.state === "running" && (await clockFlows(ctx))) { lastFlow = performance.now(); everRan = true; }
  return ctx;
}

export async function unlockAudio() {
  if (!ctx) create();
  if (!ctx) return null;
  // 최신 Safari: 무음 스위치가 켜져 있어도 재생되도록 요청 (지원 시에만 적용)
  try {
    const want = recordMode ? "play-and-record" : "playback";
    if (navigator.audioSession && navigator.audioSession.type !== want) navigator.audioSession.type = want;
  } catch (_) {}
  // 무음 버퍼를 한 번 재생해 iOS 오디오 출력 잠금 해제(터치 처리 안에서 바로)
  const blip = c => { try { const buf = c.createBuffer(1, 1, c.sampleRate); const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start(0); } catch (_) {} };
  blip(ctx);
  const before = ctx;
  await ensureRunning();
  if (ctx && ctx !== before) blip(ctx);
  return ctx;
}
