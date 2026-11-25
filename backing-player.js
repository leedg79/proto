// 반주 재생기: buildBacking 결과를 박 스케줄러로 반복 재생, 파트별 음량·끄기, 준비 박 4개
import { getAudioContext, unlockAudio } from "./context.js";
import { BeatScheduler } from "./scheduler.js";
import { loadInstrument, playNote, strum, masterOut } from "./sampler.js";
import { drum } from "./drums.js";
import { buildBacking, swingBeat } from "./backing.js";

let sched = null, state = null;
const gains = {};

export const PART_NAMES = { drums: "드럼", bass: "베이스", comp: "코드" };

export async function preload() {
  await unlockAudio();
  await Promise.all([loadInstrument("bass"), loadInstrument("acoustic"), loadInstrument("guitar")]);
}

function partGain(ctx, part) {
  if (!gains[part]) { gains[part] = ctx.createGain(); gains[part].gain.value = { drums: 0.7, bass: 0.9, comp: 0.6 }[part] ?? 0.8; gains[part].connect(masterOut(ctx)); }
  return gains[part];
}

export function setPartLevel(part, v) {
  const ctx = getAudioContext(); if (!ctx) return;
  partGain(ctx, part).gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.03);
}

// opts: { prog, key, style, bpm, countIn(박), onBar(bar, loop), onBeat(beatInBar) }
export async function startBacking(opts) {
  stopBacking();
  await preload();
  const ctx = getAudioContext();
  const song = buildBacking(opts);
  const countIn = opts.countIn ?? 4;
  state = { song, opts, countIn, events: song.events };
  sched = new BeatScheduler(ctx);
  sched.setBpm(opts.bpm || 90);
  sched.beatsPerBar = 4;
  sched.onBeat = (time, beatIdx) => {
    const spb = 60 / sched.bpm;
    if (beatIdx < countIn) {
      drum("click", time, beatIdx % 4 === 0 ? 1 : 0.7, partGain(ctx, "drums"));
      later(ctx, time, () => opts.onBeat && opts.onBeat(beatIdx % 4, true, countIn - beatIdx));
      return;
    }
    const b = beatIdx - countIn;
    const beatInSong = b % song.beats, loop = Math.floor(b / song.beats);
    if (beatInSong % 4 === 0) later(ctx, time, () => opts.onBar && opts.onBar(beatInSong / 4, loop));
    later(ctx, time, () => opts.onBeat && opts.onBeat(beatInSong % 4, false, 0));
    for (const e of state.events) {
      if (e.beat < beatInSong || e.beat >= beatInSong + 1) continue;
      const t = time + (swingBeat(e.beat, song.style) - beatInSong) * spb;
      if (e.part === "drums") drum(e.kind, t, e.vel, partGain(ctx, "drums"));
      else if (e.part === "bass") playNote("bass", e.midi, t, e.dur * spb, { gain: e.vel, out: partGain(ctx, "bass") });
      else strum(opts.compInst || "acoustic", e.midis, t, e.dur * spb, { gain: e.vel * 0.7, up: e.up, spread: e.mute ? 0.004 : 0.014, out: partGain(ctx, "comp") });
    }
  };
  sched.start();
  return song;
}

function later(ctx, time, fn) {
  const ms = Math.max(0, (time - ctx.currentTime) * 1000);
  setTimeout(fn, ms);
}

export function setCompOn(on) { const ctx = getAudioContext(); if (ctx) setPartLevel("comp", on ? (state && state.opts.compLevel) ?? 0.6 : 0); }
export function setBackingBpm(bpm) { if (sched) sched.setBpm(bpm); }
export function stopBacking() { if (sched) sched.stop(); sched = null; state = null; }
export const isBackingRunning = () => !!(sched && sched.running);
export { buildBacking };
