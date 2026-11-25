// 합성 드럼 (킥·스네어·하이햇·라이드). 샘플 없이 소리를 만들어 용량·라이선스 부담이 없음
import { getAudioContext } from "./context.js";

let noise = null;
function noiseBuf(ctx) {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}
function env(ctx, out, when, vol, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  g.connect(out);
  return g;
}
function noiseHit(ctx, out, when, vol, decay, type, freq, q = 1) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  src.connect(f); f.connect(env(ctx, out, when, vol, decay));
  src.start(when, Math.random() * 0.5); src.stop(when + decay + 0.02);
}

export function drum(kind, when, vel, out) {
  const ctx = getAudioContext(); if (!ctx) return;
  const v = vel ?? 1;
  if (kind === "kick") {
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    o.connect(env(ctx, out, when, 0.95 * v, 0.32)); o.start(when); o.stop(when + 0.34);
  } else if (kind === "snare") {
    noiseHit(ctx, out, when, 0.5 * v, 0.17, "bandpass", 1900, 0.7);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(190, when);
    o.connect(env(ctx, out, when, 0.35 * v, 0.09)); o.start(when); o.stop(when + 0.1);
  } else if (kind === "hat") noiseHit(ctx, out, when, 0.22 * v, 0.045, "highpass", 7500);
  else if (kind === "ohat") noiseHit(ctx, out, when, 0.2 * v, 0.22, "highpass", 6500);
  else if (kind === "ride") { noiseHit(ctx, out, when, 0.16 * v, 0.35, "bandpass", 5200, 0.9); noiseHit(ctx, out, when, 0.08 * v, 0.06, "highpass", 9000); }
  else if (kind === "click") noiseHit(ctx, out, when, 0.35 * v, 0.03, "highpass", 4000);
  // 기타 퍼커시브·뮤트 커팅용
  else if (kind === "chick") noiseHit(ctx, out, when, 0.32 * v, 0.05, "bandpass", 2600, 1.2);
  else if (kind === "thump") {
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(115, when); o.frequency.exponentialRampToValueAtTime(55, when + 0.12);
    o.connect(env(ctx, out, when, 0.9 * v, 0.2)); o.start(when); o.stop(when + 0.22);
    noiseHit(ctx, out, when, 0.12 * v, 0.03, "lowpass", 900);
  } else if (kind === "slap") {
    noiseHit(ctx, out, when, 0.55 * v, 0.12, "bandpass", 1500, 0.8);
    noiseHit(ctx, out, when, 0.18 * v, 0.04, "highpass", 5000);
  } else if (kind === "tap") {
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(420, when); o.frequency.exponentialRampToValueAtTime(260, when + 0.05);
    o.connect(env(ctx, out, when, 0.45 * v, 0.07)); o.start(when); o.stop(when + 0.08);
    noiseHit(ctx, out, when, 0.15 * v, 0.025, "bandpass", 3000, 1);
  }
}
