// 기타 코드 보이싱 생성기
// 모든 보이싱: { frets: [1번현..6번현] (null = 치지 않음), notes: [{s,f,midi,semi,label}], kind, detail, key }
// 규칙: 0~15프렛, 누르는 음의 프렛 폭 3칸 이내(4프렛 안), 손가락 4개 이내(가장 낮은 프렛의 2음 이상은 검지 바레 1개),
//       개방현을 섞을 때는 4프렛 이하만

import { TUNING } from "./notes.js";
import { CHORD_TYPES, degreeLabel } from "./chords.js";

export const MAX_FRET = 15;
const OPEN_PC = TUNING.map(m => m % 12); // 1번현..6번현
const mod = n => ((n % 12) + 12) % 12;

export function fretKey(frets) {
  // 6번현 → 1번현 순서 표기 (예: x32010)
  return [5, 4, 3, 2, 1, 0].map(i => (frets[i] == null ? "x" : frets[i] > 9 ? `(${frets[i]})` : String(frets[i]))).join("");
}

export function isPlayable(frets, { template = false } = {}) {
  const played = frets.map((f, i) => ({ f, s: i + 1 })).filter(x => x.f != null);
  if (played.some(x => x.f < 0 || x.f > MAX_FRET)) return false;
  const fretted = played.filter(x => x.f > 0).map(x => x.f);
  if (!fretted.length) return true;
  const lo = Math.min(...fretted), hi = Math.max(...fretted);
  if (hi - lo > 3) return false;
  if (!template && played.some(x => x.f === 0) && hi > 4) return false;
  const atLo = fretted.filter(f => f === lo).length;
  const fingers = fretted.length - (atLo >= 2 ? atLo - 1 : 0);
  return fingers <= 4;
}

function build(frets, rootPc, type, kind, detail, extra = {}) {
  const notes = [];
  for (let s = 6; s >= 1; s--) {
    const f = frets[s - 1];
    if (f == null) continue;
    const midi = TUNING[s - 1] + f;
    const semi = mod(midi - rootPc);
    notes.push({ s, f, midi, semi, label: labelFor(semi, type) });
  }
  return { frets, notes, kind, detail, key: fretKey(frets), ...extra };
}

// 텐션 코드는 구성음 반음 값(12 이상)으로 도수를 붙임
function labelFor(semi, type) {
  const iv = CHORD_TYPES[type] ? CHORD_TYPES[type].intervals : [];
  const hit = iv.find(i => mod(i) === semi);
  return degreeLabel(hit != null ? hit : semi, type);
}

// 베이스에서의 반음 간격(offsets)으로 정확히 같은 보이싱을 현 묶음에서 찾음
// strings: 낮은 음 현부터 (예: [6,5,4])
export function searchPattern(rootPc, bassSemi, offsets, strings) {
  const out = [];
  const low = strings[0];
  for (let f = 0; f <= MAX_FRET; f++) {
    const bassMidi = TUNING[low - 1] + f;
    if (mod(bassMidi - rootPc) !== mod(bassSemi)) continue;
    const frets = [null, null, null, null, null, null];
    let ok = true;
    strings.forEach((s, i) => {
      const fr = bassMidi + offsets[i] - TUNING[s - 1];
      if (fr < 0 || fr > MAX_FRET) ok = false;
      frets[s - 1] = fr;
    });
    if (ok && isPlayable(frets)) out.push(frets);
  }
  return out;
}

// 반음 간격 목록(근음 기준)을 아래에서 위로 쌓은 밀집 배치 (전위 k)
function closeStack(intervals, k) {
  const rot = intervals.slice(k).concat(intervals.slice(0, k).map(i => i + 12));
  const out = [rot[0]];
  for (let i = 1; i < rot.length; i++) {
    let v = rot[i];
    while (v <= out[i - 1]) v += 12;
    while (v - out[i - 1] > 12) v -= 12;
    out.push(v);
  }
  return out; // 근음 기준 반음 (오름차순)
}

const toOffsets = semis => semis.map(x => x - semis[0]);

export const INVERSION_NAMES = ["기본형", "1전위", "2전위", "3전위"];
const setLabel = strings => [...strings].sort((a, b) => a - b).join("-") + "번 현";

function dedupe(list) {
  const seen = new Set();
  return list.filter(v => (seen.has(v.key) ? false : (seen.add(v.key), true)));
}

function sortVoicings(list) {
  const lowFret = v => Math.min(...v.notes.map(n => n.f));
  return list.sort((a, b) => lowFret(a) - lowFret(b) || Math.max(...b.notes.map(n => n.s)) - Math.max(...a.notes.map(n => n.s)));
}

// ── 오픈 코드 (표준 개방 폼, 6번현→1번현 표기) ──
const OPEN_TABLE = [
  ["C", 0, "maj", "x32010"], ["A", 9, "maj", "x02220"], ["G", 7, "maj", "320003"], ["G", 7, "maj", "320033"],
  ["E", 4, "maj", "022100"], ["D", 2, "maj", "xx0232"],
  ["Am", 9, "m", "x02210"], ["Em", 4, "m", "022000"], ["Dm", 2, "m", "xx0231"],
  ["C7", 0, "7", "x32310"], ["A7", 9, "7", "x02020"], ["G7", 7, "7", "320001"], ["E7", 4, "7", "020100"], ["D7", 2, "7", "xx0212"], ["B7", 11, "7", "x21202"],
  ["Am7", 9, "m7", "x02010"], ["Em7", 4, "m7", "020000"], ["Dm7", 2, "m7", "xx0211"]
];

function parseShape(str) {
  // "x32010" → [1번현..6번현]
  const chars = str.split("");
  const frets = [null, null, null, null, null, null];
  chars.forEach((c, i) => { frets[5 - i] = c === "x" ? null : Number(c); });
  return frets;
}

export function openChordList() {
  return OPEN_TABLE.map(([name, pc, type]) => ({ name, pc, type }))
    .filter((x, i, a) => a.findIndex(y => y.name === x.name) === i);
}

export function openVoicingsOf(rootPc, type) {
  return OPEN_TABLE.filter(r => r[1] === rootPc && r[2] === type)
    .map(r => build(parseShape(r[3]), rootPc, type, "오픈 코드", "개방 폼"));
}

// ── 파워 코드: R-5-8, 근음 6·5번 현 ──
export function powerVoicings(rootPc) {
  const out = [];
  for (const set of [[6, 5, 4], [5, 4, 3]]) {
    for (const fr of searchPattern(rootPc, 0, [0, 7, 12], set)) out.push(build(fr, rootPc, "5", "파워 코드", `근음 ${set[0]}번 현`));
  }
  return sortVoicings(dedupe(out));
}

// ── 3음 밀집 트라이어드 (연속 3현) ──
export const TRIAD_SETS = [[6, 5, 4], [5, 4, 3], [4, 3, 2], [3, 2, 1]];

export function closeTriads(rootPc, type, { sets = TRIAD_SETS, inversions = [0, 1, 2] } = {}) {
  const iv = CHORD_TYPES[type].intervals;
  const out = [];
  for (const k of inversions) {
    const semis = closeStack(iv, k);
    for (const set of sets) {
      for (const fr of searchPattern(rootPc, semis[0], toOffsets(semis), set)) {
        out.push(build(fr, rootPc, type, "트라이어드", `${setLabel(set)} · ${INVERSION_NAMES[k]}`, { inversion: k, set }));
      }
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 바레·이동형 (E폼·A폼) ──
const BARRE = {
  E: { root: 6, shapes: { maj: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, null, 1, 1, 0, null], m7b5: [0, null, 0, 0, -1, null] } },
  A: { root: 5, shapes: { maj: [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], "7": [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0], m7b5: [null, 0, 1, 0, 1, null] } }
};

// template: 6번현→1번현 순서의 상대 프렛
function placeTemplate(rel, rootString, rootPc, { allowOpen }) {
  const out = [];
  const base = mod(rootPc - OPEN_PC[rootString - 1]);
  for (const r of [base, base + 12]) {
    if (r > MAX_FRET) continue;
    if (!allowOpen && r === 0) continue;
    const frets = [null, null, null, null, null, null];
    let ok = true;
    rel.forEach((d, i) => {
      if (d == null) return;
      const f = r + d;
      if (f < 0 || f > MAX_FRET) ok = false;
      frets[5 - i] = f;
    });
    if (ok && isPlayable(frets, { template: true })) out.push({ frets, r });
  }
  return out;
}

export function barreVoicings(rootPc, type) {
  const out = [];
  for (const [form, def] of Object.entries(BARRE)) {
    const rel = def.shapes[type];
    if (!rel) continue;
    for (const { frets, r } of placeTemplate(rel, def.root, rootPc, { allowOpen: false })) {
      out.push(build(frets, rootPc, type, "바레·이동형", `${form}폼 · ${r}프렛`));
    }
  }
  return sortVoicings(dedupe(out));
}

// ── CAGED (메이저) ──
export const CAGED_FORMS = {
  C: { root: 5, rel: [null, 0, -1, -3, -2, -3] },
  A: { root: 5, rel: [null, 0, 2, 2, 2, 0] },
  G: { root: 6, rel: [0, -1, -3, -3, -3, 0] },
  E: { root: 6, rel: [0, 2, 2, 1, 0, 0] },
  D: { root: 4, rel: [null, null, 0, 2, 3, 2] }
};

export function cagedVoicings(rootPc, form) {
  const def = CAGED_FORMS[form];
  const out = [];
  const base = mod(rootPc - OPEN_PC[def.root - 1]);
  for (const r of [base, base + 12]) {
    if (r > MAX_FRET) continue;
    const frets = [null, null, null, null, null, null];
    let ok = true;
    def.rel.forEach((d, i) => {
      if (d == null) return;
      const f = r + d;
      if (f < 0 || f > MAX_FRET) ok = false;
      frets[5 - i] = f;
    });
    if (ok) out.push(build(frets, rootPc, "maj", "CAGED", `${form}폼 · 근음 ${def.root}번 현 ${r}프렛`));
  }
  return out;
}

// ── 4음 Drop 2 / Drop 3 ──
export const DROP2_SETS = [[4, 3, 2, 1], [5, 4, 3, 2], [6, 5, 4, 3]];
export const DROP3_SETS = [[6, 4, 3, 2], [5, 3, 2, 1]];

export function dropVoicings(rootPc, type, { drop = 2, inversions = [0, 1, 2, 3], sets } = {}) {
  const iv = CHORD_TYPES[type].intervals.slice(0, 4);
  const useSets = sets || (drop === 2 ? DROP2_SETS : DROP3_SETS);
  const out = [];
  for (let k = 0; k < 4; k++) {
    const c = closeStack(iv, k); // 밀집 배치 a<b<c<d
    const idx = drop === 2 ? 2 : 1; // 위에서 두 번째(Drop 2) / 세 번째(Drop 3) 음을 한 옥타브 내림
    const semis = [c[idx] - 12, ...c.filter((_, i) => i !== idx)];
    // 전위 이름은 실제 베이스 음 기준 (베이스가 근음이면 기본형)
    const bassRole = iv.findIndex(i => mod(i) === mod(semis[0]));
    if (!inversions.includes(bassRole)) continue;
    for (const set of useSets) {
      for (const fr of searchPattern(rootPc, semis[0], toOffsets(semis), set)) {
        out.push(build(fr, rootPc, type, `Drop ${drop}`, `${setLabel(set)} · ${INVERSION_NAMES[bassRole]}`, { inversion: bassRole, set }));
      }
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 쉘 보이싱: R-3-7 / R-7-3 ──
export function shellVoicings(rootPc, type) {
  const iv = CHORD_TYPES[type].intervals;
  const third = iv[1], seventh = iv[3];
  const shapes = [
    { name: "R-3-7", offs: [0, third, seventh], sets: [[6, 5, 4], [5, 4, 3]] },
    { name: "R-7-3", offs: [0, seventh, third + 12], sets: [[6, 4, 3], [5, 3, 2]] }
  ];
  const out = [];
  for (const sh of shapes) {
    for (const set of sh.sets) {
      for (const fr of searchPattern(rootPc, 0, sh.offs, set)) out.push(build(fr, rootPc, type, "Shell", `${sh.name} · 근음 ${set[0]}번 현`));
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 텐션 (4음) ──
const TENSION_SHAPES = {
  "9":  { offs: [0, 4, 10, 14], sets: [[6, 5, 4, 3], [5, 4, 3, 2], [4, 3, 2, 1]], name: "R-3-♭7-9" },
  maj9: { offs: [0, 4, 11, 14], sets: [[6, 5, 4, 3], [5, 4, 3, 2], [4, 3, 2, 1]], name: "R-3-7-9" },
  m9:   { offs: [0, 3, 10, 14], sets: [[6, 5, 4, 3], [5, 4, 3, 2], [4, 3, 2, 1]], name: "R-♭3-♭7-9" },
  "13": { offs: [0, 10, 16, 21], sets: [[6, 4, 3, 2], [5, 3, 2, 1]], name: "R-♭7-3-13" },
  m11:  { offs: [0, 10, 15, 17], sets: [[6, 4, 3, 2], [5, 3, 2, 1]], name: "R-♭7-♭3-11" }
};
export const TENSION_TYPES = Object.keys(TENSION_SHAPES);

export function tensionVoicings(rootPc, type) {
  const sh = TENSION_SHAPES[type];
  const out = [];
  for (const set of sh.sets) {
    for (const fr of searchPattern(rootPc, 0, sh.offs, set)) out.push(build(fr, rootPc, type, "텐션", `${sh.name} · 근음 ${set[0]}번 현`));
  }
  return sortVoicings(dedupe(out));
}

// ── 오픈 보이싱 (펼친 트라이어드: 밀집 배치의 가운데 음을 한 옥타브 위로) ──
const SPREAD_SETS = [[6, 4, 3], [6, 5, 3], [5, 3, 2], [5, 4, 2], [4, 2, 1], [4, 3, 1]];

export function spreadTriads(rootPc, type) {
  const iv = CHORD_TYPES[type].intervals;
  const out = [];
  for (const k of [0, 1, 2]) {
    const c = closeStack(iv, k);
    const semis = [c[0], c[2], c[1] + 12];
    for (const set of SPREAD_SETS) {
      for (const fr of searchPattern(rootPc, semis[0], toOffsets(semis), set)) out.push(build(fr, rootPc, type, "Open Voicing", `${setLabel(set)} · ${INVERSION_NAMES[k]}`));
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 4도 쌓기 (Quartal) ──
export function quartalVoicings(rootPc, count = 3) {
  const offs = count === 4 ? [0, 5, 10, 15] : [0, 5, 10];
  const sets = count === 4 ? DROP2_SETS : TRIAD_SETS;
  const out = [];
  for (const set of sets) {
    for (const fr of searchPattern(rootPc, 0, offs, set)) {
      const v = build(fr, rootPc, "maj", "Quartal", `${setLabel(set)} · ${count}음`);
      v.notes.forEach(n => { n.label = ["R", "4", "♭7", "♭10"][offs.indexOf(n.midi - v.notes[0].midi)] || n.label; });
      out.push(v);
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 슬래시 코드: 6·5번 현 베이스 + 위쪽 연속 3현의 밀집 트라이어드 ──
export function slashVoicings(rootPc, type, bassPc) {
  const iv = CHORD_TYPES[type].intervals;
  const out = [];
  for (const bassString of [6, 5]) {
    for (const top of [bassString - 1, bassString - 2]) {
      const set = [top, top - 1, top - 2];
      if (set[2] < 1) continue;
      for (const k of [0, 1, 2]) {
        const semis = closeStack(iv, k);
        for (const tri of searchPattern(rootPc, semis[0], toOffsets(semis), set)) {
          const triLow = TUNING[set[0] - 1] + tri[set[0] - 1];
          for (let f = 0; f <= MAX_FRET; f++) {
            const bm = TUNING[bassString - 1] + f;
            if (mod(bm) !== mod(bassPc) || bm >= triLow) continue;
            const frets = tri.slice();
            frets[bassString - 1] = f;
            if (!isPlayable(frets)) continue;
            out.push(build(frets, rootPc, type, "슬래시 코드", `베이스 ${bassString}번 현 · 위 ${setLabel(set)}`));
          }
        }
      }
    }
  }
  return sortVoicings(dedupe(out));
}

// ── 사전용: 코드 종류별 가능한 보이싱 묶음 ──
export function allVoicings(rootPc, type) {
  const groups = [];
  const add = (name, list) => { if (list.length) groups.push({ name, list }); };
  if (type === "5") add("파워 코드", powerVoicings(rootPc));
  add("오픈 코드", openVoicingsOf(rootPc, type));
  if (BARRE.E.shapes[type] || BARRE.A.shapes[type]) add("바레·이동형", barreVoicings(rootPc, type));
  if (type === "maj") add("CAGED", Object.keys(CAGED_FORMS).flatMap(f => cagedVoicings(rootPc, f)));
  if (CHORD_TYPES[type].intervals.length === 3) {
    add("트라이어드(밀집)", closeTriads(rootPc, type));
    if (["maj", "m"].includes(type)) add("Open Voicing", spreadTriads(rootPc, type));
  }
  if (["maj7", "7", "m7", "m7b5", "dim7"].includes(type)) {
    add("Drop 2", dropVoicings(rootPc, type, { drop: 2 }));
    add("Drop 3", dropVoicings(rootPc, type, { drop: 3 }));
    if (type !== "dim7") add("Shell", shellVoicings(rootPc, type));
  }
  if (TENSION_SHAPES[type]) add("텐션", tensionVoicings(rootPc, type));
  return groups;
}
