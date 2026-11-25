// 스케일 엔진 테스트: 알려진 패턴과 대조
import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/theory/scales.js";

const row = (block, s) => block.notes.filter(n => n.s === s).map(n => n.f);
const A = 9, C = 0, D = 2, E = 4, G = 7;

test("A 마이너 펜타토닉 블록 1 = 5~8프렛 박스", () => {
  const b = S.blocks(A, "minor-penta")[0];
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(s => row(b, s)), [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]);
  assert.equal(b.notes[0].label, "R");
});

test("A 마이너 펜타토닉 5개 블록이 위로 이어짐(시작 프렛 5·8·10·12, 5번째는 3프렛 동형)", () => {
  const bs = S.blocks(A, "minor-penta");
  assert.equal(bs.length, 5);
  assert.deepEqual(bs.map(b => row(b, 6)[0]), [5, 8, 10, 12, 3]); // 15프렛 블록은 3프렛 동형으로 내림
});

test("C 메이저 블록 1 = 7 8 10 / 7 8 10 / 7 9 10 / 7 9 10 / 8 10 / 7 8 10", () => {
  const b = S.blocks(C, "major")[0];
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(s => row(b, s)), [[7, 8, 10], [7, 8, 10], [7, 9, 10], [7, 9, 10], [8, 10], [7, 8, 10]]);
});

test("D Dorian 포지션 1 = 6번 현 10프렛부터 줄당 3음, 7개 포지션", () => {
  const ps = S.positions(D, "dorian");
  assert.equal(ps.length, 7);
  assert.deepEqual(row(ps[0], 6), [10, 12, 13]);
  for (const p of ps) for (let s = 1; s <= 6; s++) assert.equal(row(p, s).length, 3);
});

test("모든 스케일·키·블록: 스케일 음 전부 포함, 같은 음높이 중복 없음, 0~17프렛", () => {
  for (const id of Object.keys(S.SCALES)) for (let pc = 0; pc < 12; pc++) {
    const bs = S.blocks(pc, id);
    assert.equal(bs.length, S.SCALES[id].mode ? 7 : 5, id);
    for (const b of bs) {
      const pcs = new Set(b.notes.map(n => n.midi % 12));
      assert.deepEqual([...pcs].sort((a, b) => a - b), S.scalePcs(pc, id).sort((a, b) => a - b), `${id} ${pc} ${b.name}`);
      assert.equal(new Set(b.notes.map(n => n.midi)).size, b.notes.length, `${id} ${pc} 중복`);
      assert.ok(b.lo >= 0 && b.hi <= 17, `${id} ${pc} ${b.lo}-${b.hi}`);
      assert.ok(b.hi - b.lo <= 6, `${id} ${pc} 폭 ${b.hi - b.lo}`);
    }
  }
});

test("도수 표기·연주 순서", () => {
  assert.equal(S.degreeOf(3, "minor-penta"), "♭3");
  assert.equal(S.degreeOf(6, "blues"), "♭5");
  assert.equal(S.degreeOf(10, "dom7"), "♭7");
  const b = S.blocks(A, "minor-penta")[0];
  const ud = S.sequence(b, "updown");
  assert.equal(ud.length, 12 + 11);
  assert.equal(ud[0].midi, Math.min(...b.notes.map(n => n.midi)));
  assert.equal(ud[11].midi, Math.max(...b.notes.map(n => n.midi)));
  assert.equal(S.scaleTitle(A, "minor-penta"), "A 마이너 펜타토닉");
  assert.equal(S.keyName(10, "major"), "B♭");
  assert.equal(S.keyName(3, "natural-minor"), "E♭");
  assert.equal(S.keyName(7, "dom7") + "7", "G7");
});

import * as BC from "../js/modules/scales/block-core.js";
import * as IC from "../js/modules/scales/interval-core.js";

test("Block Learning: 블록 5개(모드 7개) 사이클, 블록은 마디 처음에서 시작", () => {
  const c = BC.learningCycle(9, "minor-penta", "updown", 1);
  assert.equal(c.blocks.length, 5);
  assert.ok(c.blockStart.every(i => i % 4 === 0));
  assert.equal(c.slots.filter(s => s.note >= 0).length, 5 * 23);
  const c2 = BC.learningCycle(2, "dorian", "up", 2);
  assert.equal(c2.blocks.length, 7);
  assert.ok(c2.blockStart.every(i => i % 8 === 0));
  assert.equal(BC.slotAt(c, 0, 3).phase, "count");
  assert.equal(BC.slotAt(c, 0, 4).slot.note, 0);
  assert.equal(BC.slotAt(c, 0, 4 + c.slots.length).phase, "end");
  // 중간 블록부터 재생
  assert.equal(BC.slotAt(c, c.blockStart[2], 4).slot.block, 2);
});

test("Block Transition: 순서·마디 수", () => {
  assert.deepEqual(BC.transitionOrder(5, "up"), [0, 1, 2, 3, 4]);
  assert.deepEqual(BC.transitionOrder(5, "down"), [4, 3, 2, 1, 0]);
  assert.deepEqual(BC.transitionOrder(5, "updown"), [0, 1, 2, 3, 4, 3, 2, 1]);
  const o = BC.transitionOrder(5, "up");
  assert.equal(BC.transitionAt(o, 2, 0, 4).block, 0);
  assert.equal(BC.transitionAt(o, 2, 0, 4 + 8).block, 1);
  assert.equal(BC.transitionAt(o, 2, 0, 4 + 8).stepStart, true);
  assert.equal(BC.transitionAt(o, 1, 0, 4 + 20).phase, "end");
});

test("Interval Finding: 12문제, 근음 제외 도수, 정답은 지정 현의 해당 음", () => {
  let s = 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const deck = IC.makeDeck(["minor-penta", "major"], 0, rand);
  assert.equal(deck.length, 12);
  for (const p of deck) {
    assert.notEqual(p.semi, 0);
    const open = [64, 59, 55, 50, 45, 40][p.string - 1];
    assert.ok(IC.answer(p).length >= 1);
    for (const f of IC.answer(p)) assert.equal((open + f) % 12, (p.rootPc + p.semi) % 12);
  }
  for (let i = 1; i < 12; i++) assert.ok(deck[i].string >= 1 && deck[i].string <= 6);
  // 12문제 정답 확인 = 완료 1회
  let st = IC.init({ scales: ["blues"], timeLimit: 8, key: -1 });
  let u = 0;
  for (let i = 0; i < 12; i++) { st = IC.next(st, 0, rand); const r = IC.reveal(st); st = r.state; if (r.completedUnit) u++; }
  assert.equal(u, 1);
});
