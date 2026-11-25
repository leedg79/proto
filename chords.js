// 코드 종류·이름·구성음 (화면과 무관)

import { SPELLINGS } from "./notes.js";

// intervals: 근음 기준 반음 수 (텐션은 12 이상)
export const CHORD_TYPES = {
  maj:   { name: "메이저",        suffix: "",      intervals: [0, 4, 7] },
  m:     { name: "마이너",        suffix: "m",     intervals: [0, 3, 7] },
  dim:   { name: "디미니시드",    suffix: "dim",   intervals: [0, 3, 6] },
  aug:   { name: "어그먼티드",    suffix: "aug",   intervals: [0, 4, 8] },
  sus2:  { name: "서스2",         suffix: "sus2",  intervals: [0, 2, 7] },
  sus4:  { name: "서스4",         suffix: "sus4",  intervals: [0, 5, 7] },
  "5":   { name: "파워 코드",     suffix: "5",     intervals: [0, 7] },
  maj7:  { name: "메이저7",       suffix: "maj7",  intervals: [0, 4, 7, 11] },
  "7":   { name: "도미넌트7",     suffix: "7",     intervals: [0, 4, 7, 10] },
  m7:    { name: "마이너7",       suffix: "m7",    intervals: [0, 3, 7, 10] },
  m7b5:  { name: "하프 디미니시드", suffix: "m7♭5", intervals: [0, 3, 6, 10] },
  dim7:  { name: "디미니시드7",   suffix: "dim7",  intervals: [0, 3, 6, 9] },
  maj9:  { name: "메이저9",       suffix: "maj9",  intervals: [0, 4, 7, 11, 14] },
  "9":   { name: "도미넌트9",     suffix: "9",     intervals: [0, 4, 7, 10, 14] },
  m9:    { name: "마이너9",       suffix: "m9",    intervals: [0, 3, 7, 10, 14] },
  m11:   { name: "마이너11",      suffix: "m11",   intervals: [0, 3, 7, 10, 14, 17] },
  "13":  { name: "도미넌트13",    suffix: "13",    intervals: [0, 4, 7, 10, 14, 21] }
};

// 화면 표시 순서 (숫자 이름 키가 앞으로 가는 자바스크립트 객체 순서 대신 사용)
export const TYPE_ORDER = ["maj", "m", "5", "dim", "aug", "sus2", "sus4", "maj7", "7", "m7", "m7b5", "dim7", "maj9", "9", "m9", "m11", "13"];

// 근음 표기: 코드에서 흔히 쓰는 이름 (C♯/D♭, F♯/G♭은 둘 다 씀)
export const ROOT_NAMES = [["C"], ["C♯", "D♭"], ["D"], ["E♭"], ["E"], ["F"], ["F♯", "G♭"], ["G"], ["A♭"], ["A"], ["B♭"], ["B"]];

export function rootName(pc, rand = Math.random) {
  const list = ROOT_NAMES[((pc % 12) + 12) % 12];
  return list.length === 1 ? list[0] : list[Math.floor(rand() * list.length)];
}

export function chordName(rootLabel, type) {
  return rootLabel + CHORD_TYPES[type].suffix;
}

// 근음과의 반음 간격 → 도수 표기
export function degreeLabel(semi, type) {
  const s = ((semi % 12) + 12) % 12;
  if (type === "dim7" && s === 9) return "𝄫7";
  if (semi >= 12) {
    if (s === 2) return "9";
    if (s === 5) return "11";
    if (s === 9) return "13";
  }
  return ["R", "♭9", "2", "♭3", "3", "4", "♭5", "5", "♯5", "6", "♭7", "7"][s];
}

export function chordTones(rootPc, type) {
  return CHORD_TYPES[type].intervals.map(i => ({ pc: (rootPc + i) % 12, semi: i, label: degreeLabel(i, type) }));
}

// 음 이름(구성음 표시용): 근음 표기가 플랫이면 플랫 위주로
export function toneNames(rootPc, type, rootLabel) {
  const flat = /♭/.test(rootLabel) || ["F"].includes(rootLabel);
  return CHORD_TYPES[type].intervals.map(i => {
    const names = SPELLINGS[(rootPc + i) % 12];
    return names.length === 1 ? names[0] : names[flat ? 1 : 0];
  });
}
