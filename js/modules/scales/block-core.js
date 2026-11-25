// 블록 학습·블록 전환 진행 규칙 (순수 함수)

import { blocks, sequence } from "../../theory/scales.js";

export const COUNT_IN = 4;
export const BPM_MIN = 40, BPM_MAX = 200, BPM_DEFAULT = 60;
export const clampBpm = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(BPM_MAX, Math.max(BPM_MIN, n)) : BPM_DEFAULT; };

// ── Block Scale Learning ──
// 블록마다 음을 차례로(박당 perBeat음) 연주, 블록은 마디 단위로 시작(남는 칸은 쉼표)
// 한 사이클 = 모든 블록(5개 또는 모드 7개 포지션) = 완료 1회
export function learningCycle(rootPc, scaleId, dir = "updown", perBeat = 1) {
  const bs = blocks(rootPc, scaleId);
  const slotsPerBar = 4 * perBeat;
  const slots = [];
  const blockStart = [];
  bs.forEach((b, bi) => {
    blockStart.push(slots.length);
    const seq = sequence(b, dir);
    seq.forEach((n, ni) => slots.push({ block: bi, note: ni, s: n.s, f: n.f }));
    while (slots.length % slotsPerBar) slots.push({ block: bi, note: -1 });
  });
  return { rootPc, scaleId, dir, perBeat, blocks: bs, slots, blockStart };
}

// 재생 시작 슬롯(startSlot)과 시작 후 슬롯 번호(k, 준비 박 포함) → 현재 슬롯
export function slotAt(cycle, startSlot, k) {
  const countSlots = COUNT_IN * cycle.perBeat;
  if (k < countSlots) return { phase: "count", countLeft: COUNT_IN - Math.floor(k / cycle.perBeat) };
  const idx = startSlot + (k - countSlots);
  if (idx >= cycle.slots.length) return { phase: "end", idx };
  return { phase: "play", idx, slot: cycle.slots[idx] };
}

// ── Block Transition Practice ──
// 블록 순서: 위로(1→N) / 아래로(N→1) / 왕복(1→N→2). 블록마다 barsPer마디. 한 바퀴 = 완료 1회
export function transitionOrder(n, dir) {
  const up = Array.from({ length: n }, (_, i) => i);
  if (dir === "down") return up.slice().reverse();
  if (dir === "updown") return [...up, ...up.slice(1, -1).reverse()];
  return up;
}

export function transitionAt(order, barsPer, startStep, beat) {
  if (beat < COUNT_IN) return { phase: "count", countLeft: COUNT_IN - beat };
  const b = beat - COUNT_IN;
  const step = startStep + Math.floor(b / (4 * barsPer));
  if (step >= order.length) return { phase: "end" };
  return { phase: "play", step, block: order[step], stepStart: b % (4 * barsPer) === 0, barInStep: Math.floor((b % (4 * barsPer)) / 4) + 1 };
}
