// 메트로놈: 박자 스케줄러 + 합성 클릭음
// 화면 표시(박 표시등)는 실제 소리가 나는 시각에 맞춰 갱신함

import { unlockAudio, getAudioContext } from "./context.js";
import { BeatScheduler } from "./scheduler.js";

let sched = null;
let master = null;
let volume = 0.8;
let visualQueue = [];
let raf = null;
let onVisual = null;

function ensure(ctx) {
  if (sched) return;
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  sched = new BeatScheduler(ctx);
  sched.onBeat = (time, beat, inBar) => {
    click(ctx, time, inBar === 0);
    visualQueue.push({ time, inBar, beat });
  };
}

function click(ctx, t, accent) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(accent ? 1760 : 1175, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.06);
}

function drawLoop() {
  const ctx = getAudioContext();
  if (ctx) {
    const nowT = ctx.currentTime;
    while (visualQueue.length && visualQueue[0].time <= nowT) {
      const v = visualQueue.shift();
      if (onVisual) onVisual(v.inBar, v.beat);
    }
  }
  raf = requestAnimationFrame(drawLoop);
}

export async function startMetronome({ bpm, beatsPerBar }) {
  const ctx = await unlockAudio();
  if (!ctx) throw new Error("이 브라우저는 Web Audio를 지원하지 않음");
  ensure(ctx);
  sched.setBpm(bpm);
  sched.beatsPerBar = beatsPerBar;
  visualQueue = [];
  sched.start();
  if (!raf) raf = requestAnimationFrame(drawLoop);
}

export function stopMetronome() {
  if (sched) sched.stop();
  visualQueue = [];
  if (raf) { cancelAnimationFrame(raf); raf = null; }
}

export function isMetronomeRunning() {
  return !!(sched && sched.running);
}

export function setMetronomeBpm(bpm) {
  if (sched) sched.setBpm(bpm);
}

export function setMetronomeBeats(n) {
  if (sched) sched.beatsPerBar = n;
}

export function setMetronomeVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function onMetronomeBeat(fn) {
  onVisual = fn;
}

// 테스트용: 예약된 박 시각 기록
export function _debugScheduler() { return sched; }
