// Note Finder 출제 규칙 테스트
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "../js/modules/notes/finder-core.js";
import { SPELLINGS, positionsOf, pcOf, spell } from "../js/theory/notes.js";

// 재현 가능한 난수
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function runCycles(level, n, rand) {
  let st = F.initFinder({ level, timeLimit: 5 });
  const prompts = [];
  let units = 0;
  for (let i = 0; i < 12 * n; i++) {
    st = F.nextPrompt(st, i * 1000, rand);
    prompts.push(st.current);
    const r = F.reveal(st);
    st = r.state;
    if (r.completedUnit) units++;
  }
  return { st, prompts, units };
}

test("12개 음높이를 한 번씩 내면 완료 1회", () => {
  const { prompts, units, st } = runCycles("n1", 1, seeded(1));
  assert.equal(units, 1);
  assert.equal(st.cyclesDone, 1);
  assert.deepEqual([...new Set(prompts.map(p => p.pc))].sort((a, b) => a - b), [...Array(12).keys()]);
});

test("여러 순환: 순환마다 12음 모두, 경계에서 같은 음 연속 없음", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { prompts, units } = runCycles("n2", 5, seeded(seed));
    assert.equal(units, 5);
    for (let c = 0; c < 5; c++) {
      const set = new Set(prompts.slice(c * 12, c * 12 + 12).map(p => p.pc));
      assert.equal(set.size, 12);
    }
    for (let i = 1; i < prompts.length; i++) assert.notEqual(prompts[i].pc, prompts[i - 1].pc, `seed ${seed} at ${i}`);
  }
});

test("중간에 멈추면 완료 0회", () => {
  let st = F.initFinder({ level: "n1", timeLimit: 5 });
  let units = 0;
  for (let i = 0; i < 11; i++) {
    st = F.nextPrompt(st, 0, seeded(3));
    const r = F.reveal(st); st = r.state; if (r.completedUnit) units++;
  }
  assert.equal(units, 0);
  assert.equal(F.cycleProgress(st).done, 11);
});

test("N1은 3~4개 현(중복 없음, 오름차순), N2는 전체", () => {
  const rand = seeded(7);
  const counts = new Set();
  for (let i = 0; i < 500; i++) {
    const s = F.pickStrings("n1", rand);
    counts.add(s.length);
    assert.ok(s.length === 3 || s.length === 4);
    assert.equal(new Set(s).size, s.length);
    assert.deepEqual([...s].sort((a, b) => a - b), s);
    assert.ok(s.every(x => x >= 1 && x <= 6));
  }
  assert.deepEqual([...counts].sort(), [3, 4]);
  assert.deepEqual(F.pickStrings("n2", rand), []);
});

test("샤프·플랫 모두 출제, 드문 표기 없음", () => {
  const rand = seeded(11);
  const names = new Set();
  for (let i = 0; i < 2000; i++) names.add(spell(i % 12, rand));
  assert.equal(names.size, 17);
  for (const bad of ["E♯", "F♭", "B♯", "C♭"]) assert.ok(!names.has(bad));
  assert.equal(pcOf("D♭"), 1);
  assert.equal(pcOf("C♯"), 1);
});

test("정답 위치: 6번 현 E는 0·12프렛, 3번 현 B♭은 3·15프렛", () => {
  assert.deepEqual(positionsOf(4, [6]).map(p => p.f), [0, 12]);
  assert.deepEqual(positionsOf(10, [3]).map(p => p.f), [3, 15]);
  // 0~15프렛 6현 전체에서 모든 음은 최소 6곳 이상
  for (let pc = 0; pc < 12; pc++) assert.ok(positionsOf(pc).length >= 6);
  assert.equal(SPELLINGS.length, 12);
});

test("제한시간은 실제 연습시간 기준, 1~15초로 제한", () => {
  let st = F.initFinder({ level: "n2", timeLimit: 30 });
  assert.equal(st.timeLimit, 15);
  st = F.changeTime(st, 0, 0);
  assert.equal(st.timeLimit, 1);
  st = F.changeTime(st, 5, 0);
  st = F.nextPrompt(st, 10_000, seeded(2));
  assert.equal(F.remainingMs(st, 12_000), 3000);
  assert.equal(F.remainingMs(st, 16_000), 0);
  // 연습 중 시간 변경 시 현재 문제는 새 시간으로 다시 셈
  st = F.changeTime(st, 8, 13_000);
  assert.equal(F.remainingMs(st, 13_000), 8000);
});

test("정답 확인은 한 문제에 한 번만 집계", () => {
  let st = F.initFinder({ level: "n2", timeLimit: 5 });
  st = F.nextPrompt(st, 0, seeded(5));
  const a = F.reveal(st, { timedOut: true });
  const b = F.reveal(a.state);
  assert.equal(b.state.revealedInCycle, 1);
  assert.equal(a.state.current.timedOut, true);
});
