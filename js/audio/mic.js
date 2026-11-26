// 마이크 열기 + 어택 감지. 재생과 같은 오디오 시계(AudioContext.currentTime)로 시각을 잼
// iPhone: 마이크를 쓰는 동안 오디오 세션을 "play-and-record"로 바꿔야 입력이 들어옴
import { unlockAudio, getAudioContext, setRecordMode, audioSessionAuto } from "./context.js";
import { OnsetDetector, blockEnergy } from "./onset-core.js";

let mic = null;

export const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// 입력 장치 목록(권한을 받은 뒤에야 이름이 나옴). [{ deviceId, label }]
export async function listInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter(d => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `입력 ${i + 1}` }));
}
// 이름으로 짐작한 입력 종류: builtin(아이폰·아이패드 마이크) | headset | interface
export function inputKind(label = "") {
  const l = label.toLowerCase();
  if (/iphone|ipad|built-?in|내장/.test(l)) return "builtin";
  if (/airpods|bluetooth|headset|헤드셋|이어폰|earpods/.test(l)) return "headset";
  return l ? "interface" : "builtin";
}

// handlers: onEnergy(t, e), onOnset(t)
// deviceId: 고른 입력 장치("" = 아이폰이 정한 기본 입력)
export async function openMic({ floor = 2e-6, minGap = 0.05, ratio = 4, deviceId = "" } = {}) {
  if (mic && (mic.want || "") !== (deviceId || "")) closeMic();
  if (mic) { mic.det.setFloor(floor); mic.det.minGap = minGap; mic.det.ratio = ratio; return mic; }
  if (!micSupported()) throw new Error("이 브라우저는 마이크를 지원하지 않음");
  audioSessionAuto();
  let stream;
  const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (deviceId) audio.deviceId = { exact: deviceId };
  try { stream = await navigator.mediaDevices.getUserMedia({ audio }); }
  catch (e) {
    // 고른 장치가 빠졌으면 기본 입력으로 다시 시도
    if (deviceId && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch (e2) { setRecordMode(false); throw e2; }
    } else { setRecordMode(false); throw e; }
  }
  setRecordMode(true);
  await unlockAudio();
  const ctx = getAudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
  const det = new OnsetDetector({ floor, minGap, ratio });
  const track = stream.getAudioTracks()[0];
  const set = track && track.getSettings ? track.getSettings() : {};
  const m = { stream, src, det, node: null, handlers: new Set(), level: 0, want: deviceId || "", label: (track && track.label) || "", deviceId: set.deviceId || "", monitor: null };
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

// 입력 모니터링: 들어오는 기타 소리를 이어폰으로 같이 들려줌(아이폰 마이크+스피커에서는 하울링 위험)
export function setMonitor(on, level = 0.8) {
  if (!mic) return false;
  const ctx = getAudioContext();
  if (on) {
    if (!mic.monitor) { mic.monitor = ctx.createGain(); mic.src.connect(mic.monitor); mic.monitor.connect(ctx.destination); }
    mic.monitor.gain.setTargetAtTime(level, ctx.currentTime, 0.02);
  } else if (mic.monitor) {
    try { mic.monitor.disconnect(); mic.src.disconnect(mic.monitor); } catch (_) {}
    mic.monitor = null;
  }
  return true;
}
export const micInfo = () => (mic ? { label: mic.label, deviceId: mic.deviceId, kind: inputKind(mic.label), monitor: !!mic.monitor } : null);

export function listen(handler) { if (!mic) return () => {}; mic.handlers.add(handler); return () => mic && mic.handlers.delete(handler); }
export const micHandle = () => mic;
export const listenerCount = () => (mic ? mic.handlers.size : 0);
export const micLevel = () => (mic ? mic.level : 0);
export const isMicOpen = () => !!mic;

export function closeMic() {
  if (!mic) return;
  try { if (mic.monitor) mic.monitor.disconnect(); mic.node.disconnect(); mic.src.disconnect(); } catch (_) {}
  mic.stream.getTracks().forEach(t => t.stop());
  mic = null;
  setRecordMode(false);
}
