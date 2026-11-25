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

test("Block Transition: 이웃 블록을 잇는 경로, 같은 음 반복 없이 연속", () => {
  const c = BC.transitionCycle(9, "minor-penta", 2, "up", 1);
  assert.equal(c.runs.length, 4); // 지판 순서 5→1, 1→2, 2→3, 3→4
  assert.deepEqual(c.runs.map(r => r.label), ["5→1", "1→2", "2→3", "3→4"]);
  for (const r of c.runs) {
    const m = r.notes.map(n => n.midi);
    for (let i = 1; i < m.length; i++) assert.ok(m[i] > m[i - 1], "상행 연속");
    assert.equal(r.notes[0].s, 6); assert.equal(r.notes.at(-1).s, 1);
    // 줄을 건너뛰지 않음
    for (let i = 1; i < r.notes.length; i++) assert.ok(r.notes[i - 1].s - r.notes[i].s <= 1);
  }
  // A 마이너 펜타 1→2: 6번 현 5프렛에서 시작해 1번 현 10프렛까지
  const r12 = c.runs[1];
  assert.equal(r12.notes[0].f, 5); assert.equal(r12.notes.at(-1).f, 10);
  assert.ok(c.blockStart.every(i => i % 4 === 0));
  // 하행은 상행의 역순
  const d = BC.transitionCycle(9, "minor-penta", 2, "down", 1);
  assert.deepEqual(d.runs[1].notes.map(n => n.midi), [...r12.notes.map(n => n.midi)].reverse());
  // 3블록 왕복: 올라갔다 내려옴
  const ud = BC.transitionCycle(0, "major", 3, "updown", 2);
  for (const r of ud.runs) {
    const m = r.notes.map(n => n.midi), top = m.indexOf(Math.max(...m));
    assert.ok(top > 0 && top < m.length - 1);
    for (let i = 1; i <= top; i++) assert.ok(m[i] > m[i - 1]);
    for (let i = top + 1; i < m.length; i++) assert.ok(m[i] < m[i - 1]);
  }
});

test("Block Transition: 모든 스케일·키·모양에서 경로 생성, 한 줄 4프렛 이내", () => {
  for (const id of Object.keys(S.SCALES)) for (let pc = 0; pc < 12; pc++) for (const [cnt, shape] of [[2, "up"], [2, "down"], [3, "updown"], [3, "downup"]]) {
    const c = BC.transitionCycle(pc, id, cnt, shape, 1);
    assert.equal(c.runs.length, S.neckOrder(pc, id).length - cnt + 1, `${id} ${pc} ${shape}`);
    for (const r of c.runs) {
      // 같은 줄에서 연속으로 치는 음 묶음마다 4프렛 이내
      let group = [r.notes[0]];
      const check = g => assert.ok(Math.max(...g.map(n => n.f)) - Math.min(...g.map(n => n.f)) <= 4, `${id} ${pc} ${r.label} ${g[0].s}번 현`);
      for (let i = 1; i < r.notes.length; i++) {
        if (r.notes[i].s === group[0].s) group.push(r.notes[i]); else { check(group); group = [r.notes[i]]; }
      }
      check(group);
    }
  }
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
