// 오디오 컨텍스트 공용 관리
// iPhone은 사용자가 화면을 터치한 순간에만 소리를 켤 수 있으므로,
// 시작·재생 버튼 처리 안에서 unlockAudio()를 먼저 호출해야 함

let ctx = null;
let recordMode = false;   // 마이크 사용 중이면 오디오 세션을 play-and-record로 둠

export function setRecordMode(on) {
  recordMode = !!on;
  try { if (navigator.audioSession) navigator.audioSession.type = recordMode ? "play-and-record" : "playback"; } catch (_) {}
}

export function getAudioContext() {
  return ctx;
}

export async function unlockAudio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx({ latencyHint: "interactive" });
  }
  // 최신 Safari: 무음 스위치가 켜져 있어도 재생되도록 요청 (지원 시에만 적용)
  try {
    const want = recordMode ? "play-and-record" : "playback";
    if (navigator.audioSession && navigator.audioSession.type !== want) navigator.audioSession.type = want;
  } catch (_) {}
  if (ctx.state !== "running") {
    try { await ctx.resume(); } catch (_) {}
  }
  // 무음 버퍼를 한 번 재생해 iOS 오디오 출력 잠금 해제
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch (_) {}
  return ctx;
}
