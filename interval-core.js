// Scale Interval Finding 규칙 (순수 함수)
// 예: "C 마이너 펜타토닉의 ♭3을 3번 현에서" → 정답: 3번 현의 해당 음 위치 전부
// 12문제 정답 확인 = 완료 1회, 제한시간은 실제 연습시간 기준

import { SCALES, KEY_LIST, degreeOf, findOnString } from "../../theory/scales.js";

export const DECK = 12, TIME_MIN = 3, TIME_MAX = 30, TIME_DEFAULT = 8;
export const clampTime = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(TIME_MAX, Math.max(TIME_MIN, n)) : TIME_DEFAULT; };
const mod = n => ((n % 12) + 12) % 12;

export function makeDeck(scaleIds, keySetting, rand = Math.random) {
  const deck = [];
  let lastString = 0;
  for (let i = 0; i < DECK; i++) {
    const scaleId = scaleIds[i % scaleIds.length];
    const steps = SCALES[scaleId].steps.filter(s => s !== 0); // 근음 제외한 도수
    const semi = steps[Math.floor(rand() * steps.length)];
    const rootPc = keySetting >= 0 ? keySetting : KEY_LIST[Math.floor(rand() * 12)];
    let string;
    do { string = 1 + Math.floor(rand() * 6); } while (string === lastString);
    lastString = string;
    deck.push({ scaleId, rootPc, semi, degree: degreeOf(semi, scaleId), string });
  }
  // 여러 스케일을 골랐으면 순서를 섞음
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

export function answer(p) {
  return findOnString(mod(p.rootPc + p.semi), p.string);
}

export function init({ scales, timeLimit, key }) {
  return { scales: [...scales], key, timeLimit: clampTime(timeLimit), deck: [], index: -1, done: 0, units: 0, promptNo: 0, current: null };
}

export function next(st, activeMs, rand = Math.random) {
  let { deck, index, done } = st;
  if (index + 1 >= deck.length) { deck = makeDeck(st.scales, st.key, rand); index = -1; done = 0; }
  index++;
  return { ...st, deck, index, done, promptNo: st.promptNo + 1, current: { p: deck[index], start: activeMs, revealed: false, timedOut: false } };
}

export function remainingMs(st, activeMs) {
  if (!st.current || st.current.revealed) return 0;
  return Math.max(0, st.timeLimit * 1000 - (activeMs - st.current.start));
}

export function reveal(st, { timedOut = false } = {}) {
  if (!st.current || st.current.revealed) return { state: st, completedUnit: false };
  const done = st.done + 1;
  const completedUnit = done >= DECK;
  return { completedUnit, state: { ...st, done, units: st.units + (completedUnit ? 1 : 0), current: { ...st.current, revealed: true, timedOut } } };
}

export function changeTime(st, sec, activeMs) {
  const n = { ...st, timeLimit: clampTime(sec) };
  if (st.current && !st.current.revealed) n.current = { ...st.current, start: activeMs };
  return n;
}
