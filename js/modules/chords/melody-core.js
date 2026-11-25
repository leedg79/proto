// 코드 멜로디 (순수 함수): 저작권이 끝난 곡의 멜로디 + 코드 → 멜로디를 맨 윗음으로 하는 운지 자동 배치
// 곡은 C장조 기준(MIDI, 실제 음높이 C4 = 60), 4분음표 = 12틱, 4/4박

import { closeTriads, dropVoicings, barreVoicings, openVoicingsOf, isPlayable } from "../../theory/voicings.js";
import { TUNING } from "../../theory/notes.js";

const mod = n => ((n % 12) + 12) % 12;
const D = { w: 48, h: 24, "q.": 18, q: 12, e: 6 };
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "E4:q" → [64, 12]
const parse = s => s.split(" ").map(t => { const [p, d] = t.split(":"); const m = /^([A-G])(#?)(\d)$/.exec(p); return [12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0), D[d]]; });

// 코드: "이름@틱" (C장조), 종류는 이름에서
export const TUNES = {
  "ode-to-joy": { name: "환희의 송가 (베토벤)", melody: "E4:q E4:q F4:q G4:q G4:q F4:q E4:q D4:q C4:q C4:q D4:q E4:q E4:q. D4:e D4:h E4:q E4:q F4:q G4:q G4:q F4:q E4:q D4:q C4:q C4:q D4:q E4:q D4:q. C4:e C4:h",
    chords: "C@0 G@48 C@96 G@144 C@192 G@240 C@288 G@336 C@360" },
  "twinkle": { name: "반짝반짝 작은 별 (프랑스 민요)", melody: "C4:q C4:q G4:q G4:q A4:q A4:q G4:h F4:q F4:q E4:q E4:q D4:q D4:q C4:h G4:q G4:q F4:q F4:q E4:q E4:q D4:h G4:q G4:q F4:q F4:q E4:q E4:q D4:h C4:q C4:q G4:q G4:q A4:q A4:q G4:h F4:q F4:q E4:q E4:q D4:q D4:q C4:h",
    chords: "C@0 F@48 C@72 F@96 C@120 G@144 C@168 C@192 F@216 C@240 G@264 C@288 F@312 C@336 G@360 C@384 F@432 C@456 F@480 C@504 G@528 C@552" },
  "jingle-bells": { name: "징글벨 후렴 (피어폰트)", melody: "E4:q E4:q E4:h E4:q E4:q E4:h E4:q G4:q C4:q. D4:e E4:w F4:q F4:q F4:q. F4:e F4:q E4:q E4:q E4:e E4:e E4:q D4:q D4:q E4:q D4:h G4:h",
    chords: "C@0 C@48 C@96 C@144 F@192 C@240 D7@288 G7@336" },
  "frere-jacques": { name: "프레르 자크 (프랑스 민요)", melody: "C4:q D4:q E4:q C4:q C4:q D4:q E4:q C4:q E4:q F4:q G4:h E4:q F4:q G4:h G4:e A4:e G4:e F4:e E4:q C4:q G4:e A4:e G4:e F4:e E4:q C4:q C4:q G3:q C4:h C4:q G3:q C4:h",
    chords: "C@0 C@48 C@96 C@144 C@192 C@240 C@288 G7@300 C@312 C@336 G7@348 C@360" }
};

const TYPE_OF = name => (/maj7/.test(name) ? "maj7" : /m7/.test(name) ? "m7" : /7/.test(name) ? "7" : /m$/.test(name) ? "m" : "maj");
const ROOT_OF = name => mod(NOTE[name[0]] + (name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0));
export const KEYS = [[0, "C"], [7, "G"], [2, "D"], [9, "A"], [5, "F"]];
const KEY_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function tuneData(id, key = 0) {
  const t = TUNES[id];
  const mel = parse(t.melody);
  const chords = t.chords.split(" ").map(x => { const [n, at] = x.split("@"); return { at: Number(at), root: mod(ROOT_OF(n) + key), type: TYPE_OF(n) }; });
  chords.forEach(c => { c.name = KEY_NAMES[c.root] + ({ maj: "", m: "m", "7": "7", m7: "m7", maj7: "maj7" }[c.type]); });
  // 멜로디 음역: 위쪽 줄(실제 음 F#3~A5)에 오도록 한 옥타브 단위로 조정
  let shift = key;
  const lo = Math.min(...mel.map(m => m[0])) + shift, hi = Math.max(...mel.map(m => m[0])) + shift;
  if (hi > 81) shift -= 12;
  if (lo + 12 <= 64 && hi + 12 <= 81) shift += 12; // 너무 낮으면 한 옥타브 올림
  let at = 0;
  const notes = mel.map(([m, d]) => { const n = { midi: m + shift, at, dur: d }; at += d; return n; });
  return { id, name: t.name, key, notes, chords, ticks: at };
}

const posOf = midi => { const out = []; for (let s = 1; s <= 6; s++) { const f = midi - TUNING[s - 1]; if (f >= 0 && f <= 15) out.push({ s, f }); } return out; };

function chordCands(root, type) {
  const triT = type === "m" || type === "m7" ? "m" : "maj";
  return [
    ...closeTriads(root, triT),
    ...(["7", "m7", "maj7"].includes(type) ? dropVoicings(root, type, { drop: 2 }) : []),
    ...openVoicingsOf(root, type), ...barreVoicings(root, type)
  ].filter(v => isPlayable(v.frets));
}

// 운지 배치: 코드가 바뀌는 음(또는 마디 첫 음)은 멜로디가 맨 윗음인 운지, 나머지는 멜로디만
export function arrange(data) {
  let hand = 5;
  const events = [];
  const chordAt = t => { let c = null; for (const x of data.chords) if (x.at <= t) c = x; return c; };
  const onsets = new Set(data.chords.map(c => c.at));
  for (const n of data.notes) {
    const c = chordAt(n.at);
    const harmonize = c && (onsets.has(n.at) || n.at % 48 === 0) && n.dur >= 12;
    let ev = null;
    if (harmonize) {
      const cands = chordCands(c.root, c.type).filter(v => {
        const top = v.notes.reduce((a, x) => (x.midi > a.midi ? x : a));
        return top.midi === n.midi && v.notes.length >= 3 && v.notes.every(x => x.f <= 15);
      });
      const score = v => { const fr = v.notes.map(x => x.f).filter(f => f > 0); const cen = fr.length ? (Math.min(...fr) + Math.max(...fr)) / 2 : 1; return Math.abs(cen - hand) + (v.notes.length > 4 ? 1 : 0); };
      const pick = cands.sort((a, b) => score(a) - score(b))[0];
      if (pick) {
        const ns = [...pick.notes].sort((a, b) => b.midi - a.midi).map(x => ({ s: x.s, f: x.f }));
        const fr = ns.map(x => x.f).filter(f => f > 0);
        if (fr.length) hand = (Math.min(...fr) + Math.max(...fr)) / 2;
        ev = { at: n.at, dur: n.dur, notes: ns, chord: c.name, voiced: true };
      } else {
        // 대신 멜로디 + 근음 베이스(같은 손 위치)
        for (const mp of posOf(n.midi).filter(p => p.s <= 3).sort((a, b) => Math.abs(a.f - hand) - Math.abs(b.f - hand))) {
          const bass = [6, 5, 4].filter(s => s >= mp.s + 2).flatMap(s => { const out = []; for (let f = 0; f <= 15; f++) if (mod(TUNING[s - 1] + f) === c.root && Math.abs(f - mp.f) <= 4) out.push({ s, f }); return out; })[0];
          if (bass) { ev = { at: n.at, dur: n.dur, notes: [mp, bass], chord: c.name, voiced: true }; hand = (mp.f + bass.f) / 2 || hand; break; }
        }
      }
    }
    if (!ev) {
      const p = posOf(n.midi).filter(x => x.s <= 4).sort((a, b) => Math.abs(a.f - hand) + (a.s > 3 ? 1 : 0) - (Math.abs(b.f - hand) + (b.s > 3 ? 1 : 0)))[0] || posOf(n.midi)[0];
      ev = { at: n.at, dur: n.dur, notes: [p], chord: harmonize ? c.name : null, voiced: false };
    }
    events.push(ev);
  }
  const chords = [];
  let last = null;
  for (const c of data.chords) if (c.name !== last || true) { chords.push({ at: c.at, name: c.name }); last = c.name; }
  return { ...data, events: events.map(e => ({ ...e, rest: false, bend: 0 })), chordMarks: chords };
}
