// Random Chord Finding 진행 규칙 (순수 함수)
// 12문제 묶음을 모두 정답 확인까지 마치면 완료 1회. 제한시간은 실제 연습시간 기준

import { buildDeck } from "./prompts.js";

export const DECK_SIZE = 12;
export const TIME_MIN = 3;
export const TIME_MAX = 30;
export const TIME_DEFAULT = 10;

export function clampTime(sec) {
  const v = Math.round(Number(sec));
  return Number.isFinite(v) ? Math.min(TIME_MAX, Math.max(TIME_MIN, v)) : TIME_DEFAULT;
}

export function init({ topics, timeLimit }) {
  return { topics: [...topics], timeLimit: clampTime(timeLimit), deck: [], index: -1, revealedInDeck: 0, decksDone: 0, promptNo: 0, current: null };
}

export function next(st, activeMs, rand = Math.random) {
  let { deck, index, revealedInDeck } = st;
  if (index + 1 >= deck.length) {
    deck = buildDeck(st.topics, rand, DECK_SIZE);
    index = -1;
    revealedInDeck = 0;
  }
  index += 1;
  return { ...st, deck, index, revealedInDeck, promptNo: st.promptNo + 1, current: { spec: deck[index], startActiveMs: activeMs, revealed: false, timedOut: false } };
}

export function remainingMs(st, activeMs) {
  if (!st.current || st.current.revealed) return 0;
  return Math.max(0, st.timeLimit * 1000 - (activeMs - st.current.startActiveMs));
}

export function reveal(st, { timedOut = false } = {}) {
  if (!st.current || st.current.revealed) return { state: st, completedUnit: false };
  const r = st.revealedInDeck + 1;
  const completedUnit = r >= DECK_SIZE;
  return {
    completedUnit,
    state: { ...st, revealedInDeck: r, decksDone: st.decksDone + (completedUnit ? 1 : 0), current: { ...st.current, revealed: true, timedOut } }
  };
}

export function changeTime(st, sec, activeMs) {
  const n = { ...st, timeLimit: clampTime(sec) };
  if (st.current && !st.current.revealed) n.current = { ...st.current, startActiveMs: activeMs };
  return n;
}
