// 릭 재생: 이벤트(틱, 4분음표 = 12)를 기타 샘플로 연주. 셔플 릭은 8분음표 뒤쪽을 셋잇단 위치로
import { unlockAudio, getAudioContext } from "./context.js";
import { loadInstrument, playNote, masterOut } from "./sampler.js";
import { drum } from "./drums.js";
import { TUNING } from "../theory/notes.js";

let timers = [];
let playing = null;

export function stopLick() { timers.forEach(clearTimeout); timers = []; if (playing) playing.forEach(s => { try { s.stop(); } catch (_) {} }); playing = null; }

// lick: realize() 결과(events, feel), onEvent(i | -1 끝)
// opts: onEvent, countIn(준비 박 수), click(박마다 클릭), silent(음은 내지 않고 강조·클릭만)
export async function playLick(lick, bpm = 80, { onEvent, countIn = 0, click = false, silent = false, startAt = null, keep = false } = {}) {
  if (!keep) stopLick();
  await unlockAudio();
  await loadInstrument("guitar");
  const ctx = getAudioContext();
  const spb = 60 / bpm;
  const pre = startAt != null ? startAt - countIn * spb : ctx.currentTime + 0.12;
  const start = pre + countIn * spb;
  for (let k = 0; k < countIn; k++) drum("click", pre + k * spb, k === 0 ? 1 : 0.7, masterOut(ctx));
  if (click) for (let t = 0; t < lick.ticks; t += 12) drum("click", start + (t / 12) * spb, t % 48 === 0 ? 0.8 : 0.45, masterOut(ctx));
  const swing = lick.feel === "shuffle";
  const at = tick => { const beat = tick / 12; if (!swing) return beat; const w = Math.floor(beat), f = beat - w; return Math.abs(f - 0.5) < 1e-6 ? w + 2 / 3 : beat; };
  const srcs = [];
  let prev = null;
  lick.events.forEach((e, i) => {
    const t = start + at(e.at) * spb;
    const end = start + at(e.at + e.dur) * spb;
    const dur = Math.max(0.06, (end - t) * (e.rest ? 1 : 0.96));
    if (!e.rest && !silent) {
      for (const n of e.notes) {
        const midi = TUNING[n.s - 1] + n.f;
        const opts = { gain: e.notes.length > 1 ? 0.6 : 0.85, vib: e.vib, soft: e.h || e.p };
        if (e.bend) opts.bend = e.bend;
        if (e.rel && prev && prev.bend) opts.release = prev.bend;
        if (e.sl && prev && !prev.rest) opts.slideFrom = TUNING[prev.notes[0].s - 1] + prev.notes[0].f;
        const s = playNote("guitar", midi, t, dur, opts);
        if (s) srcs.push(s);
      }
    }
    if (onEvent) timers.push(setTimeout(() => onEvent(i), Math.max(0, (t - ctx.currentTime) * 1000)));
    prev = e;
  });
  const total = start + at(lick.ticks) * spb;
  if (onEvent) timers.push(setTimeout(() => onEvent(-1), Math.max(0, (total - ctx.currentTime) * 1000 + 150)));
  playing = srcs;
  return total - ctx.currentTime;
}
