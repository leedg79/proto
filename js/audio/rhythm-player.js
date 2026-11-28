// 리듬 재생기: 마디마다 이벤트를 받아 반복 재생. 클릭·반주(드럼·베이스)·기타 시범 소리를 따로 조절
// 시각은 오디오 시계로 예약하고(BeatScheduler), 화면 갱신만 setTimeout으로 맞춤
import { getAudioContext, unlockAudio, onAudioReset, onAudioRelease } from "./context.js";
import { BeatScheduler } from "./scheduler.js";
import { loadInstrument, playNote, strum, masterOut } from "./sampler.js";
import { drum } from "./drums.js";
import { buildBacking, swingBeat } from "./backing.js";

let sched = null, timers = [];
const buses = {};
const DEF = { guitar: 0.9, click: 0.8, band: 0.75 };

function bus(ctx, name) {
  if (!buses[name] || buses[name].context !== ctx) { buses[name] = ctx.createGain(); buses[name].gain.value = DEF[name] ?? 0.8; buses[name].connect(masterOut(ctx)); }
  return buses[name];
}
export function setRhythmLevel(name, v) {
  const ctx = getAudioContext(); if (!ctx) return;
  bus(ctx, name).gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.03);
}

const swing8 = at => { const w = Math.floor(at), f = at - w; return Math.abs(f - 0.5) < 1e-6 ? w + 2 / 3 : at; };

function later(ctx, time, fn) {
  const id = setTimeout(fn, Math.max(0, (time - ctx.currentTime) * 1000));
  timers.push(id);
  if (timers.length > 400) timers = timers.slice(-200);
}

// o: { bpm, loopBars, countIn(박, 기본 4), barEvents(bar, loop) → 이벤트, swing, click, backing: { prog | custom, key, style } | null, noBass,
//      inst, grid(화면 칸 수), maxLoops, onCount(남은 박), onBar(bar, loop), onStep(bar, step, loop), onEvent(e), onEnd() }
export async function startRhythm(o) {
  stopRhythm();
  await unlockAudio();
  const inst = o.inst || "acoustic";
  await Promise.all([loadInstrument(inst), o.backing ? loadInstrument("bass") : null]);
  const ctx = getAudioContext();
  const song = o.backing ? buildBacking({ ...o.backing, comp: false }) : null;
  const countIn = o.countIn ?? 4;
  const loopBars = Math.max(1, o.loopBars || 1);
  const pos = at => (o.swing ? swing8(at) : at);
  let cache = [], ended = false;
  sched = new BeatScheduler(ctx);
  sched.setBpm(o.bpm || 80);
  sched.beatsPerBar = 4;
  sched.onBeat = (time, beatIdx) => {
    const spb = 60 / sched.bpm;
    if (beatIdx < countIn) {
      drum("click", time, beatIdx % 4 === 0 ? 1 : 0.7, masterOut(ctx));
      later(ctx, time, () => o.onCount && o.onCount(countIn - beatIdx));
      return;
    }
    const b = beatIdx - countIn;
    const barAbs = Math.floor(b / 4), beat = b % 4;
    const loop = Math.floor(barAbs / loopBars), bar = barAbs % loopBars;
    if (o.maxLoops && loop >= o.maxLoops) {
      if (!ended) { ended = true; later(ctx, time, () => { stopRhythm(); o.onEnd && o.onEnd(); }); }
      return;
    }
    if (beat === 0) { cache = o.barEvents(bar, loop) || []; later(ctx, time, () => o.onBar && o.onBar(bar, loop)); }
    if (o.click) drum("click", time, beat === 0 ? 0.9 : 0.55, bus(ctx, "click"));
    const per = Math.max(1, (o.grid || 8) / 4);
    for (let k = 0; k < per; k++) {
      const t = time + (pos(beat + k / per) - beat) * spb;
      later(ctx, t, () => o.onStep && o.onStep(bar, beat * per + k, loop));
    }
    const out = bus(ctx, "guitar");
    for (const e of cache) {
      if (e.at < beat - 1e-9 || e.at >= beat + 1 - 1e-9) continue;
      const t = time + (pos(e.at) - beat) * spb;
      playEvent(inst, e, t, spb, out);
      if (o.onEvent) later(ctx, t, () => o.onEvent(e, bar, loop));
      if (o.onSchedule) o.onSchedule(e, bar, loop, t);
    }
    if (song) {
      const sb = b % song.beats, band = bus(ctx, "band");
      for (const e of song.events) {
        if (e.beat < sb || e.beat >= sb + 1) continue;
        const t = time + (swingBeat(e.beat, song.style) - sb) * spb;
        if (e.part === "drums") drum(e.kind, t, e.vel, band);
        else if (e.part === "bass" && !o.noBass) playNote("bass", e.midi, t, e.dur * spb, { gain: e.vel, out: band });
      }
    }
  };
  sched.start();
  return { song };
}

function playEvent(inst, e, t, spb, out) {
  if (e.kind === "strum") {
    if (e.pluck) strum(inst, e.midis, t, e.dur * spb, { gain: e.vel * 0.7, spread: 0.004, out });
    else strum(inst, e.midis, t, e.dur * spb, { gain: e.vel * 0.7, up: e.up, spread: e.up ? 0.011 : 0.014, out });
  } else if (e.kind === "mute") {
    strum(inst, e.midis, t, 0.04, { gain: e.vel * 0.3, spread: 0.004, up: e.up, out });
    drum("chick", t, e.vel, out);
  } else if (e.kind === "pm") strum(inst, e.midis, t, Math.min(e.dur * spb, 0.24), { gain: e.vel * 0.85, spread: 0.006, pm: true, out });
  else if (e.kind === "note") (e.midis || [e.midi]).forEach(m => playNote(inst, m, t, e.dur * spb, { gain: e.vel, out }));
  else if (e.kind === "perc") drum(e.drum, t, e.vel, out);
}

export function setRhythmBpm(bpm) { if (sched) sched.setBpm(bpm); }
export function stopRhythm() { if (sched) sched.stop(); sched = null; timers.forEach(clearTimeout); timers = []; }
onAudioReset(() => stopRhythm());
onAudioRelease(() => stopRhythm());
export const isRhythmRunning = () => !!(sched && sched.running);
