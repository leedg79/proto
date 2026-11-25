// 블록 학습·블록 전환 진행 규칙 (순수 함수)

import { connectPath, neckOrder } from "../../theory/scales.js";

export const COUNT_IN = 4;
export const BPM_MIN = 40, BPM_MAX = 200, BPM_DEFAULT = 60;
export const clampBpm = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(BPM_MAX, Math.max(BPM_MIN, n)) : BPM_DEFAULT; };

// 재생 시작 슬롯(startSlot)과 시작 후 슬롯 번호(k, 준비 박 포함) → 현재 슬롯
export function slotAt(cycle, startSlot, k) {
  const countSlots = COUNT_IN * cycle.perBeat;
  if (k < countSlots) return { phase: "count", countLeft: COUNT_IN - Math.floor(k / cycle.perBeat) };
  const idx = startSlot + (k - countSlots);
  if (idx >= cycle.slots.length) return { phase: "end", idx };
  return { phase: "play", idx, slot: cycle.slots[idx] };
}

// ── Block Transition Practice ──
// 이웃한 블록 2~3개를 잇는 경로(connectPath)를 지판 위치 순서대로 하나씩 연주
// 경로마다 마디 처음에서 시작, 모든 경로를 마치면 완료 1회

export const SHAPES = [["up", "상행"], ["down", "하행"], ["updown", "왕복(올라갔다 내려오기)"]];

// picks: 경로마다 블록을 바꿀 줄 조합 번호(무작위로 정해 저장해 두면 이어하기 때도 같은 경로)
export function makePicks(n, rand = Math.random) { return Array.from({ length: n }, () => Math.floor(rand() * 4)); }

export function transitionCycle(rootPc, scaleId, count = 2, shape = "up", perBeat = 1, picks = []) {
  const n = neckOrder(rootPc, scaleId).length;
  const runs = [];
  for (let i = 0; i + count <= n; i++) {
    const p = connectPath(rootPc, scaleId, i, count, shape, picks[i] || 0);
    if (p) runs.push(p);
  }
  const slotsPerBar = 4 * perBeat;
  const slots = [], runStart = [];
  runs.forEach((r, ri) => {
    runStart.push(slots.length);
    r.notes.forEach((nt, ni) => slots.push({ block: ri, note: ni, s: nt.s, f: nt.f }));
    while (slots.length % slotsPerBar) slots.push({ block: ri, note: -1 });
  });
  return { rootPc, scaleId, count, shape, perBeat, runs, slots, blockStart: runStart };
}
