// 악기 샘플 재생 (기타·어쿠스틱·베이스)
// 음원: FluidR3 GM 사운드폰트(gleitz/midi-js-soundfonts 변환본)에서 3반음 간격으로 뽑은 mp3. 사이 음은 재생 속도로 맞춤
// 벤딩·릴리스·슬라이드·비브라토는 재생 속도(음높이) 자동 변화로 표현

import { getAudioContext, unlockAudio } from "./context.js";

const BASE = "./sounds/";
let index = null;
const buffers = {};   // inst → Map(midi → AudioBuffer)
const loading = {};
let master = null;

export function masterOut(ctx) {
  if (!master) { master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); }
  return master;
}

async function getIndex() {
  if (!index) index = await (await fetch(BASE + "index.json")).json();
  return index;
}

export async function loadInstrument(inst) {
  if (buffers[inst]) return buffers[inst];
  if (loading[inst]) return loading[inst];
  loading[inst] = (async () => {
    const ctx = await unlockAudio();
    const idx = await getIndex();
    const map = new Map();
    await Promise.all(idx[inst].map(async m => {
      const ab = await (await fetch(`${BASE}${inst}/${m}.mp3`)).arrayBuffer();
      const buf = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
      map.set(m, buf);
    }));
    buffers[inst] = map;
    return map;
  })();
  return loading[inst];
}

export const isLoaded = inst => !!buffers[inst];

function nearest(map, midi) {
  let best = null;
  for (const m of map.keys()) if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  return best;
}

const rate = semis => Math.pow(2, semis / 12);

// opts: gain, bend(반음), release(반음: 벤딩된 음에서 시작해 내려옴), slideFrom(midi), vib(true), soft(해머·풀), pm(팜뮤트), out(연결 노드)
export function playNote(inst, midi, when, dur, opts = {}) {
  const ctx = getAudioContext();
  const map = buffers[inst];
  if (!ctx || !map) return null;
  const s = nearest(map, midi);
  const src = ctx.createBufferSource();
  src.buffer = map.get(s);
  const base = rate(midi - s);
  const p = src.playbackRate;
  const g = ctx.createGain();
  const vol = (opts.gain ?? 0.8) * (opts.soft ? 0.55 : 1);
  let pitch = base;
  if (opts.release) { pitch = base * rate(opts.release); p.setValueAtTime(pitch, when); p.linearRampToValueAtTime(base, when + Math.min(0.18, dur * 0.6)); pitch = base; }
  else if (opts.slideFrom != null) { p.setValueAtTime(rate(opts.slideFrom - s), when); p.linearRampToValueAtTime(base, when + Math.min(0.09, dur * 0.5)); }
  else p.setValueAtTime(base, when);
  let vibStart = when + Math.min(0.2, dur * 0.35);
  if (opts.bend) {
    const t0 = when + Math.min(0.05, dur * 0.15), t1 = t0 + Math.min(0.16, dur * 0.45);
    p.setValueAtTime(base, t0);
    p.linearRampToValueAtTime(base * rate(opts.bend), t1);
    pitch = base * rate(opts.bend);
    vibStart = Math.max(vibStart, t1 + 0.02);
  }
  const vibDur = when + dur - vibStart;
  if (opts.vib && vibDur > 0.12) {
    const n = 64, curve = new Float32Array(n), cycles = Math.max(1, Math.round(vibDur * 5.5));
    for (let i = 0; i < n; i++) curve[i] = pitch * rate(0.35 * Math.sin((i / (n - 1)) * cycles * 2 * Math.PI));
    try { p.setValueCurveAtTime(curve, vibStart, vibDur); } catch (_) {}
  }
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.005);
  g.gain.setValueAtTime(vol, when + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.09);
  if (opts.pm) {
    // 팜뮤트: 높은 배음을 깎고 짧게
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700; f.Q.value = 0.8;
    src.connect(f); f.connect(g);
  } else src.connect(g);
  g.connect(opts.out || masterOut(ctx));
  src.start(when);
  src.stop(when + dur + 0.12);
  return src;
}

// 코드 스트럼: 낮은 음부터 조금씩 늦게
export function strum(inst, midis, when, dur, { gain = 0.5, spread = 0.014, up = false, out, pm = false } = {}) {
  const list = up ? [...midis].reverse() : midis;
  list.forEach((m, i) => playNote(inst, m, when + i * spread, dur, { gain, out, pm }));
}
