// BPM Chord Finding 진행 규칙 (순수 함수)
// - 4/4, 1마디 카운트인 뒤 2박마다 코드가 바뀜 (마디당 코드 2개)
// - 8마디 = 코드 16개를 끝까지 연주하면 완료 1회, 이어서 새 16개로 계속
// - 일시정지 후 재개하면 멈췄던 코드부터 카운트인을 다시 하고 이어감

import { buildDeck } from "./prompts.js";

export const CHORDS_PER_PASS = 16;
export const BEATS_PER_CHORD = 2;
export const COUNT_IN = 4;
export const BPM_MIN = 40;
export const BPM_MAX = 160;
export const BPM_DEFAULT = 70;

export function clampBpm(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(BPM_MAX, Math.max(BPM_MIN, n)) : BPM_DEFAULT;
}

export function init({ topics, bpm }, rand = Math.random) {
  return { topics: [...topics], bpm: clampBpm(bpm), seq: buildDeck(topics, rand, CHORDS_PER_PASS), pos: 0, passes: 0 };
}

// 재생 시작 시점의 위치(startPos)와 시작 후 박 번호(beat)로 지금 상황 계산
// 반환: { phase: "count"|"chord", countLeft, chordIndex, chordStart(이 박에서 코드가 바뀌는지), passBoundary }
export function beatInfo(startPos, beat) {
  if (beat < COUNT_IN) return { phase: "count", countLeft: COUNT_IN - beat };
  const k = Math.floor((beat - COUNT_IN) / BEATS_PER_CHORD);
  const raw = startPos + k;
  return {
    phase: "chord",
    chordStart: (beat - COUNT_IN) % BEATS_PER_CHORD === 0,
    passOffset: Math.floor(raw / CHORDS_PER_PASS),       // 시작 후 몇 번째 16개 묶음인지
    chordIndex: raw % CHORDS_PER_PASS,
    beatInChord: (beat - COUNT_IN) % BEATS_PER_CHORD
  };
}

// 코드가 바뀌는 순간마다 호출. 16개를 다 치고 다음 묶음 첫 코드로 넘어갈 때 completedUnit = true
export function advance(st, info, rand = Math.random) {
  if (info.phase !== "chord" || !info.chordStart) return { state: st, completedUnit: false };
  if (info.chordIndex === 0 && st.pos === CHORDS_PER_PASS - 1) {
    return { completedUnit: true, state: { ...st, passes: st.passes + 1, seq: buildDeck(st.topics, rand, CHORDS_PER_PASS), pos: 0 } };
  }
  return { completedUnit: false, state: { ...st, pos: info.chordIndex } };
}

export function barOf(chordIndex) {
  return Math.floor(chordIndex / 2) + 1; // 1~8마디
}
