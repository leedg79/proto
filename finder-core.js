// Note Finder 출제 규칙 (순수 함수)
// - 12개 음높이를 섞어 한 번씩 출제 → 12개 모두 정답 확인까지 마치면 완료 1회
// - 순환이 바뀔 때 같은 음이 연달아 나오지 않게 함
// - N1: 매 문제 무작위 3~4개 현 / N2: 6개 현 전체
// - 제한시간은 세션의 "실제 연습시간" 기준으로 계산 → 일시정지·앱 이탈 중에는 자동으로 멈춤

import { spell } from "../../theory/notes.js";

export const CYCLE_SIZE = 12;
export const TIME_MIN = 1;
export const TIME_MAX = 15;

export function clampTime(sec) {
  const v = Math.round(Number(sec));
  return Number.isFinite(v) ? Math.min(TIME_MAX, Math.max(TIME_MIN, v)) : 5;
}

export function shuffledCycle(rand = Math.random, avoidFirst = null) {
  const a = Array.from({ length: CYCLE_SIZE }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (avoidFirst != null && a[0] === avoidFirst) {
    const k = 1 + Math.floor(rand() * (a.length - 1));
    [a[0], a[k]] = [a[k], a[0]];
  }
  return a;
}

export function pickStrings(level, rand = Math.random) {
  if (level !== "n1") return [];
  const count = rand() < 0.5 ? 3 : 4;
  const pool = [1, 2, 3, 4, 5, 6];
  const out = [];
  while (out.length < count) {
    const s = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    out.push(s);
  }
  return out.sort((x, y) => x - y);
}

export function initFinder({ level, timeLimit }) {
  return {
    level,
    timeLimit: clampTime(timeLimit),
    cycle: [],
    index: -1,          // 현재 순환에서 몇 번째 문제인지 (0~11)
    revealedInCycle: 0, // 현재 순환에서 정답 확인까지 마친 문제 수
    cyclesDone: 0,
    promptNo: 0,
    current: null       // { pc, name, strings, startActiveMs, revealed, timedOut }
  };
}

// 다음 문제. activeMs = 세션의 현재 실제 연습시간(ms)
export function nextPrompt(st, activeMs, rand = Math.random) {
  let { cycle, index, revealedInCycle } = st;
  if (index + 1 >= cycle.length) {
    const last = cycle.length ? cycle[cycle.length - 1] : null;
    cycle = shuffledCycle(rand, last);
    index = -1;
    revealedInCycle = 0;
  }
  index += 1;
  const pc = cycle[index];
  return {
    ...st,
    cycle, index, revealedInCycle,
    promptNo: st.promptNo + 1,
    current: { pc, name: spell(pc, rand), strings: pickStrings(st.level, rand), startActiveMs: activeMs, revealed: false, timedOut: false }
  };
}

export function remainingMs(st, activeMs) {
  if (!st.current || st.current.revealed) return 0;
  return Math.max(0, st.timeLimit * 1000 - (activeMs - st.current.startActiveMs));
}

// 정답 확인 (직접 누름 또는 시간 종료). 순환 12개를 모두 마치면 completedUnit = true
export function reveal(st, { timedOut = false } = {}) {
  if (!st.current || st.current.revealed) return { state: st, completedUnit: false };
  const revealedInCycle = st.revealedInCycle + 1;
  const completedUnit = revealedInCycle >= CYCLE_SIZE;
  return {
    completedUnit,
    state: {
      ...st,
      revealedInCycle: completedUnit ? CYCLE_SIZE : revealedInCycle,
      cyclesDone: st.cyclesDone + (completedUnit ? 1 : 0),
      current: { ...st.current, revealed: true, timedOut }
    }
  };
}

// 연습 중 제한시간 변경: 현재 문제는 바뀐 시간으로 처음부터 다시 셈
export function changeTime(st, sec, activeMs) {
  const next = { ...st, timeLimit: clampTime(sec) };
  if (st.current && !st.current.revealed) next.current = { ...st.current, startActiveMs: activeMs };
  return next;
}

export function cycleProgress(st) {
  return { done: st.revealedInCycle >= CYCLE_SIZE ? CYCLE_SIZE : st.revealedInCycle, size: CYCLE_SIZE };
}
