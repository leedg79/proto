// 화면별 평가 대상 만들기 도우미
import { TUNING } from "../theory/notes.js";
import { CHORD_TYPES } from "../theory/chords.js";
import { SCALES } from "../theory/scales.js";

const mod = n => ((n % 12) + 12) % 12;
export const midiAt = (s, f) => TUNING[s - 1] + f;
// 지판 위치 목록 → 허용 MIDI
export const midisOf = positions => [...new Set(positions.map(p => midiAt(p.s, p.f)))];
export function chordPcs(root, type, extra = []) {
  const t = CHORD_TYPES[type];
  return [...new Set([...(t ? t.intervals : [0, 4, 7]).map(i => mod(root + i)), ...extra.map(mod)])];
}
export const chordTarget = (label, root, type, extra = []) => ({ kind: "chord", label, root: mod(root), pcs: chordPcs(root, type, extra) });
// 실제 운지(notes:[{midi}|{s,f}]) 기준 코드 대상
export function voicingTarget(label, notes, root = null) {
  const pcs = [...new Set(notes.map(n => mod(n.midi ?? midiAt(n.s, n.f))))];
  return { kind: "chord", label, root: root == null ? null : mod(root), pcs };
}
export const scaleTarget = (label, rootPc, scaleId) => ({ kind: "set", label, root: mod(rootPc), pcs: (SCALES[scaleId] ? SCALES[scaleId].steps : [0, 2, 4, 5, 7, 9, 11]).map(i => mod(rootPc + i)) });
export const pcsTarget = (label, pcs) => ({ kind: "set", label, pcs: [...new Set(pcs.map(mod))] });
// 음 순서(TAB 위치) → 순서 대상
export const seqTarget = (label, notes, octaveFree = false) => ({ kind: "seq", label, octaveFree, midis: notes.map(n => n.midi ?? midiAt(n.s, n.f)) });
export const timingTarget = (label, window = 0.1) => ({ kind: "timing", label, window });
export const followTarget = (label, window = 0.12) => ({ kind: "follow", label, window });
// 박 위치 이름: 1.5 → "2박 &"
export function beatLabel(at, bar = null) {
  const b = Math.floor(at + 1e-6), f = at - b;
  const sub = Math.abs(f) < 0.02 ? "" : Math.abs(f - 0.5) < 0.02 ? " &" : Math.abs(f - 0.25) < 0.02 ? " e" : Math.abs(f - 0.75) < 0.02 ? " a" : Math.abs(f - 1 / 3) < 0.03 ? " 트" : Math.abs(f - 2 / 3) < 0.03 ? " 렛" : ` +${f.toFixed(2)}`;
  return `${bar != null ? `${bar + 1}마디 ` : ""}${b + 1}박${sub}`;
}
// 릭 이벤트(realize 결과·옮긴 릭) → 순서 대상. 겹음은 맨 위 음, 벤딩은 올라가는 음까지 인정
export function lickSeq(label, events, octaveFree = false) {
  const ev = events.filter(e => !e.rest && e.notes && e.notes.length);
  const midis = ev.map(e => midiAt(e.notes[0].s, e.notes[0].f));
  const alts = ev.map((e, i) => {
    const m = midis[i], b = Math.max(0, Math.ceil(e.bend || 0));
    return [...e.notes.map(n => midiAt(n.s, n.f)), ...Array.from({ length: b }, (_, k) => m + k + 1)];
  });
  return { kind: "seq", label, octaveFree, midis, alts };
}
