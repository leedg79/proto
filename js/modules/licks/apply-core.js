// 릭 활용(순수 함수): 키·구간 옮기기, 변형 만들기, 백킹 주고받기용 코드
import { realize, BAR } from "./lick-core.js";
import { TUNING } from "../../theory/notes.js";

const mod = n => ((n % 12) + 12) % 12;
const fretsOf = l => l.events.flatMap(e => e.notes.map(n => n.f));

// 같은 모양을 수평 이동: 목표 키에서 구간 가운데에 가장 가까운 위치(0~20프렛)
export function moveTo(lick, toKey, region) {
  const fr = fretsOf(lick), lo = Math.min(...fr), hi = Math.max(...fr), c = (lo + hi) / 2;
  const k = mod(toKey - lick.key), mid = (region.lo + region.hi) / 2;
  const opts = [k - 24, k - 12, k, k + 12].filter(d => lo + d >= 0 && hi + d <= 20);
  const d = opts.sort((a, b) => Math.abs(c + a - mid) - Math.abs(c + b - mid))[0] ?? k;
  return { ...lick, key: toKey, events: lick.events.map(e => ({ ...e, notes: e.notes.map(n => ({ s: n.s, f: n.f + d })) })), chords: lick.chords.map(ch => ({ ...ch, root: mod(ch.root + k) })), moved: d };
}

// ── 변형 ──
export const VARIATIONS = {
  displace: "리듬 밀기: 같은 음을 8분음표 하나 늦게 시작",
  front: "앞부분만: 앞 절반만 치고 근음으로 끝내기",
  land3: "끝음 바꾸기: 마지막 음을 3음(또는 ♭3)으로 착지",
  even: "리듬 단순화: 모든 음을 8분음표로 고르게",
  octave: "옥타브 이동: 한 옥타브 위나 아래 자리에서"
};

const retime = events => { let t = 0; return events.map(e => { const x = { ...e, at: t }; t += e.dur; return x; }); };
const withTicks = (l, events) => { const ev = retime(events); const ticks = ev.reduce((a, e) => a + e.dur, 0); return { ...l, events: ev, ticks, bars: Math.ceil(ticks / BAR) }; };

// 블록 안에서 끝음을 원하는 도수로 옮기기(마지막 음과 가장 가까운 자리)
function landOn(l, events, degs) {
  const r = realize(l);
  const lastIdx = events.map(e => !e.rest).lastIndexOf(true);
  if (lastIdx < 0) return events;
  const last = events[lastIdx].notes[0];
  const prevIdx = events.slice(0, lastIdx).map(e => !e.rest).lastIndexOf(true);
  const prev = prevIdx >= 0 ? events[prevIdx].notes[0] : null;
  const cands = r.shape.filter(n => degs.includes(n.label) && !(prev && prev.s === n.s && prev.f === n.f));
  if (!cands.length) return events;
  const lastMidi = TUNING[last.s - 1] + last.f;
  const lastDeg = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"][mod(lastMidi - r.key)];
  if (degs.includes(lastDeg) && !(prev && prev.s === last.s && prev.f === last.f)) { const out = [...events]; out[lastIdx] = { ...out[lastIdx], vib: true, dur: Math.max(out[lastIdx].dur, 12) }; return out; }
  const ref = prev || last;
  const best = cands.sort((a, b) => Math.abs(a.s - ref.s) * 2 + Math.abs(a.f - ref.f) - (Math.abs(b.s - ref.s) * 2 + Math.abs(b.f - ref.f)))[0];
  const out = [...events];
  out[lastIdx] = { ...out[lastIdx], notes: [{ s: best.s, f: best.f }], bend: 0, rel: false, h: false, p: false, sl: false, chrom: false, vib: true, dur: Math.max(out[lastIdx].dur, 12) };
  return out;
}

export function makeVariation(l, type) {
  const ev = l.events.map(e => ({ ...e, notes: e.notes.map(n => ({ ...n })) }));
  if (type === "displace") return withTicks(l, [{ dur: 6, rest: true, notes: [] }, ...ev]);
  if (type === "front") {
    const notes = ev.filter(e => !e.rest);
    const keep = Math.max(2, Math.ceil(notes.length / 2));
    let count = 0;
    const cut = [];
    for (const e of ev) { if (!e.rest) count++; cut.push(e); if (count >= keep) break; }
    return withTicks(l, landOn(l, cut, ["R"]));
  }
  if (type === "land3") return withTicks(l, landOn(l, ev, ["♭3", "3"]));
  if (type === "even") return withTicks(l, ev.map((e, i) => ({ ...e, dur: i === ev.length - 1 ? 12 : 6, rel: e.rel, h: false, p: false })));
  if (type === "octave") {
    const fr = fretsOf(l), lo = Math.min(...fr), hi = Math.max(...fr);
    const d = hi + 12 <= 20 ? 12 : lo - 12 >= 0 ? -12 : 0;
    return { ...l, events: ev.map(e => ({ ...e, notes: e.notes.map(n => ({ s: n.s, f: n.f + d })) })) };
  }
  return l;
}
// 이 릭에 쓸 수 있는 변형(옥타브 이동이 안 되는 릭은 제외)
export function variationTypes(l) {
  const fr = fretsOf(l), lo = Math.min(...fr), hi = Math.max(...fr);
  return Object.keys(VARIATIONS).filter(t => t !== "octave" || hi + 12 <= 20 || lo - 12 >= 0);
}

// ── 백킹 주고받기 ──
// 릭의 코드(없으면 스케일로 정한 코드) → 마디별 코드 목록(백킹 custom 형식), 스타일
const CHORD_OF = {
  "minor-penta": "m7", blues: "7", "mixed-blues": "7", "major-penta": "", major: "maj7", "natural-minor": "m7", "harmonic-minor": "m7",
  dorian: "m7", mixolydian: "7", lydian: "maj7", phrygian: "m", m7: "m7", maj7: "maj7", dom7: "7", m7b5: "ø7", min: "m", maj: ""
};
const NM = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SUF = { "": "", m: "m", "7": "7", maj7: "maj7", m7: "m7", "ø7": "m7♭5" };
const QUAL = name => (/m7♭5/.test(name) ? "ø7" : /maj7/.test(name) ? "maj7" : /m7/.test(name) ? "m7" : /7/.test(name) ? "7" : /^[A-G][♭♯]?m/.test(name) ? "m" : "");

export function callResponse(l) {
  const bars = Math.max(1, Math.ceil(l.ticks / BAR));
  const segsFor = bar => {
    if (!l.chords.length) { const q = CHORD_OF[l.scale] ?? ""; return [{ rootPc: l.key, quality: q, beats: 4, name: NM[l.key] + SUF[q] }]; }
    const t0 = bar * BAR, list = [];
    for (let b = 0; b < 4; b += 2) {
      let c = l.chords[0];
      for (const x of l.chords) if (x.at <= t0 + b * 12) c = x;
      const last = list[list.length - 1];
      if (last && last.rootPc === c.root && last.name === c.name) last.beats += 2;
      else list.push({ rootPc: c.root, quality: QUAL(c.name), beats: 2, name: c.name });
    }
    return list;
  };
  const one = Array.from({ length: bars }, (_, i) => ({ segs: segsFor(i) }));
  const style = l.level === "l4" ? "swing" : l.feel === "shuffle" || ["blues", "mixed-blues"].includes(l.scale) ? "shuffle" : "straight";
  return { bars, custom: [...one, ...one], style };
}
