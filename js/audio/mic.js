// 마이크 열기 + 어택 감지. 재생과 같은 오디오 시계(AudioContext.currentTime)로 시각을 잼
// iPhone: 마이크를 쓰는 동안 오디오 세션을 "play-and-record"로 바꿔야 입력이 들어옴
import { unlockAudio, getAudioContext, setRecordMode } from "./context.js";
import { OnsetDetector, blockEnergy } from "./onset-core.js";

let mic = null;

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// handlers: onEnergy(t, e), onOnset(t)
export async function openMic({ floor = 2e-6, minGap = 0.05 } = {}) {
  if (mic) { mic.det.setFloor(floor); mic.det.minGap = minGap; return mic; }
  if (!micSupported()) throw new Error("이 브라우저는 마이크를 지원하지 않음");
  setRecordMode(true);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { setRecordMode(false); throw e; }
  await unlockAudio();
  const ctx = getAudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
  const det = new OnsetDetector({ floor, minGap });
  const m = { stream, src, det, node: null, handlers: new Set(), level: 0 };
  const feed = (t, e) => {
    m.level = Math.max(e, m.level * 0.95);
    const hit = det.push(t, e);
    for (const h of m.handlers) { if (h.onEnergy) h.onEnergy(t, e); if (hit != null && h.onOnset) h.onOnset(hit); }
  };
  if (ctx.audioWorklet && window.AudioWorkletNode) {
    await ctx.audioWorklet.addModule(new URL("./onset-worklet.js", import.meta.url));
    const node = new AudioWorkletNode(ctx, "onset-energy", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
    node.port.onmessage = ev => { const a = ev.data; for (let i = 0; i < a.length; i += 2) feed(a[i], a[i + 1]); };
    src.connect(node); node.connect(mute);
    m.node = node;
  } else {
    // 예전 Safari: ScriptProcessor (블록 시각은 대략값)
    const node = ctx.createScriptProcessor(256, 1, 1);
    let last = 0;
    node.onaudioprocess = ev => {
      const ch = ev.inputBuffer.getChannelData(0);
      const t0 = ev.playbackTime != null ? ev.playbackTime - 256 / ctx.sampleRate : ctx.currentTime;
      for (let i = 0; i < ch.length; i += 128) {
        const r = blockEnergy(ch.subarray(i, i + 128), last); last = r.last;
        feed(t0 + i / ctx.sampleRate, r.e);
      }
    };
    src.connect(node); node.connect(mute);
    m.node = node;
  }
  mic = m;
  return m;
}

export function listen(handler) { if (!mic) return () => {}; mic.handlers.add(handler); return () => mic && mic.handlers.delete(handler); }
export const micLevel = () => (mic ? mic.level : 0);
export const isMicOpen = () => !!mic;

export function closeMic() {
  if (!mic) return;
  try { mic.node.disconnect(); mic.src.disconnect(); } catch (_) {}
  mic.stream.getTracks().forEach(t => t.stop());
  mic = null;
  setRecordMode(false);
}
