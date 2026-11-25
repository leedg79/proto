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
import * as DR from "../js/modules/scales/drill-core.js";
import { buildSlots } from "../js/modules/scales/seg-player.js";

test("S1 모양 익히기: 블록 5개(모드 7개), 구간은 마디 처음에서, 근음만·이름만은 확인 마디 추가", () => {
  const a = DR.shapeSegments(9, "minor-penta", "updown");
  assert.equal(a.segments.length, 5);
  assert.equal(a.segments[0].notes.length, 23); // 12음 왕복
  assert.equal(DR.shapeSegments(2, "dorian").segments.length, 7);
  const all = buildSlots(a.segments, 1, "all");
  assert.ok(all.segStart.every(i => i % 4 === 0));
  assert.equal(all.slots.length, 5 * 24);
  const hide = buildSlots(a.segments, 2, "hide");
  assert.equal(hide.slots.filter(x => x.note === -2).length, 5 * 8);
  assert.ok(hide.segStart.every(i => i % 8 === 0));
});

test("근음 문제: 고른 구간 안에 모양 배치, 4도·반음·무작위 순서", () => {
  assert.deepEqual(DR.rootOrder("fourths", 0).slice(0, 4), [0, 5, 10, 3]);
  assert.deepEqual(DR.rootOrder("chromatic", 9).slice(0, 3), [9, 10, 11]);
  assert.deepEqual([...DR.rootOrder("random", 0, () => 0.5)].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const id of Object.keys(S.SCALES)) for (const [rid, lo, hi] of [["0-4", 0, 4], ["5-9", 5, 9], ["12-16", 12, 16]]) {
    const d = DR.rootDeck({ scaleId: id, order: "fourths", startPc: 9, regionId: rid });
    assert.equal(d.length, 12);
    for (const p of d) {
      assert.ok(p.lo >= lo - 2 && p.hi <= hi + 2, `${id} ${rid} ${p.main} ${p.lo}-${p.hi}`);
      assert.ok(p.shape.some(n => n.root));
      assert.equal(p.region.label, `${lo}~${hi}프렛`);
    }
  }
  const r = DR.rootDeck({ scaleId: "minor-penta", regionId: "random" }, () => 0.99);
  assert.equal(r[0].region.id, "12-16");
});

test("S3 시작음: 모든 음에서 한 번씩, 시작음에서 한 옥타브, 관계 스케일", () => {
  for (const id of Object.keys(S.SCALES)) for (let pc = 0; pc < 12; pc++) {
    const deck = DR.startDeck(pc, id);
    const n = S.SCALES[id].steps.length;
    assert.equal(deck.length, n, `${id} ${pc}`);
    assert.deepEqual(deck.map(p => p.semi).sort((x, y) => x - y), [...S.SCALES[id].steps].sort((x, y) => x - y));
    for (const p of deck) {
      assert.equal(p.notes[0].s, p.s); assert.equal(p.notes[0].f, p.f);
      assert.equal(p.notes.length, 2 * n + 1);
      const m = p.notes.map(x => x.midi), top = p.up ? Math.max(...m) : Math.min(...m);
      assert.equal(Math.abs(top - m[0]), 12);
      assert.equal(m.at(-1), m[0]);
      assert.equal(((m[0] - pc) % 12 + 12) % 12, p.semi);
    }
  }
  assert.equal(DR.relatedScale(2, "dorian", 5), "G Mixolydian");
  assert.equal(DR.relatedScale(2, "dorian", 3), "F Lydian");
  assert.equal(DR.relatedScale(9, "minor-penta", 3), "C 메이저 펜타토닉");
});

test("모드 문제: 밝은 순서, 이웃 모드는 한 음만 다름, 같은 구간", () => {
  const order = DR.modeOrder(["dorian", "ionian", "lydian", "locrian", "phrygian", "aeolian", "mixolydian"], "bright");
  assert.deepEqual(order, DR.BRIGHTNESS);
  const m = DR.modeDeck({ rootPc: 9, modes: order, regionId: "5-9" });
  assert.equal(m[0].changed.length, 0);
  for (let i = 1; i < 7; i++) {
    assert.ok(m[i].answer.includes("바뀐 음:") && !m[i].answer.includes("·"), `${m[i].main}: ${m[i].answer}`);
    assert.ok(m[i].changed.length >= 1);
    assert.ok(m[i].lo >= 3 && m[i].hi <= 11, `${m[i].main} ${m[i].lo}-${m[i].hi}`);
  }
  assert.equal(m[1].answer, "Lydian에서 바뀐 음: 4");
  assert.deepEqual(DR.modeOrder(["ionian", "dorian"], "dark"), ["dorian", "ionian"]);
  assert.equal(S.degreeOf(6, "lydian"), "♯4");
});

test("시작음: 고른 구간 안에서 시작", () => {
  for (const id of ["minor-penta", "major", "dorian", "m7"]) for (const [rid, lo, hi] of [["0-4", 0, 4], ["9-13", 9, 13]]) {
    const d = DR.startDeck(4, id, Math.random, rid);
    assert.equal(d.length, S.SCALES[id].steps.length);
    for (const p of d) assert.ok(p.f >= lo && p.f <= hi, `${id} ${rid} ${p.s}-${p.f}`);
  }
});

test("Block Transition: 블록 1에서 시작, 중간 줄 슬라이드로 블록 2로 넘어가 최고음까지", () => {
  const c = BC.transitionCycle(9, "minor-penta", 2, "up", 1, [0, 0, 0, 0]);
  assert.deepEqual(c.runs.map(r => r.label), ["5→1", "1→2", "2→3", "3→4"]);
  const r = c.runs[1]; // A 마이너 펜타 1→2, 4번 줄에서 전환
  assert.deepEqual(r.notes.map(n => `${n.s}-${n.f}`), ["6-5", "6-8", "5-5", "5-7", "4-5", "4-7", "4-10", "3-7", "3-9", "2-8", "2-10", "1-8", "1-10"]);
  assert.deepEqual(r.slides, [6]);
  // 다른 줄 조합을 고르면 다른 경로
  const r3 = BC.transitionCycle(9, "minor-penta", 2, "up", 1, [1, 1, 1, 1]).runs[1];
  assert.equal(r3.notes[r3.slides[0]].s, 3);
  // 하행은 높은 블록 최고음 → 낮은 블록 최저음
  const d = BC.transitionCycle(9, "minor-penta", 2, "down", 1, [0, 0, 0, 0]).runs[1];
  assert.equal(`${d.notes[0].s}-${d.notes[0].f}`, "1-10"); assert.equal(`${d.notes.at(-1).s}-${d.notes.at(-1).f}`, "6-5");
  // 블록 3개 상행은 두 번 슬라이드, 왕복은 꼭대기에서 방향 전환
  const t = BC.transitionCycle(9, "minor-penta", 3, "up", 1, [0, 0, 0]).runs[1];
  assert.equal(t.slides.length, 2);
  const ud = BC.transitionCycle(0, "major", 3, "updown", 2, [0, 0, 0, 0, 0]);
  for (const x of ud.runs) {
    const m = x.notes.map(n => n.midi), top = m.indexOf(Math.max(...m));
    assert.ok(top > 0 && top < m.length - 1);
    for (let i = 1; i <= top; i++) assert.ok(m[i] > m[i - 1]);
    for (let i = top + 1; i < m.length; i++) assert.ok(m[i] < m[i - 1]);
  }
});

test("Block Transition: 모든 스케일·키·모양에서 경로 생성, 슬라이드는 같은 줄", () => {
  for (const id of Object.keys(S.SCALES)) for (let pc = 0; pc < 12; pc++) for (const [cnt, shape] of [[2, "up"], [2, "down"], [3, "up"], [3, "updown"]]) {
    const c = BC.transitionCycle(pc, id, cnt, shape, 1, [pc % 4, 1, 2, 3, 0, 1, 2, 3]);
    assert.equal(c.runs.length, S.neckOrder(pc, id).length - cnt + 1, `${id} ${pc} ${shape}`);
    for (const r of c.runs) {
      assert.ok(r.slides.length >= cnt - 1, `${id} ${pc} ${r.label} 슬라이드`);
      for (const i of r.slides) assert.equal(r.notes[i].s, r.notes[i - 1].s);
      for (let i = 1; i < r.notes.length; i++) {
        assert.notEqual(r.notes[i].midi, r.notes[i - 1].midi);
        assert.ok(Math.abs(r.notes[i].s - r.notes[i - 1].s) <= 1, "줄 건너뛰기 없음");
      }
    }
  }
});


test("코드 전환하며 익히기: 진행·스케일 매핑", async () => {
  const C = await import("../js/modules/scales/chordscale-core.js");
  for (const lv of ["pb", "mm", "md"]) for (const id of Object.keys(C.CS_PROGS[lv])) for (const key of [0, 9, 7]) {
    const p = C.chordScalePlan(lv, id, key);
    for (const b of p.bars) {
      assert.ok(S.SCALES[b.scaleId], `${lv} ${id} ${b.scaleId}`);
      // 코드 근음은 쓰는 스케일 안에 있어야 함
      const pcs = S.scalePcs(b.scaleRoot, b.scaleId);
      // 펜타(5음)는 IV·♭VI 근음이 없을 수 있음(코드톤 착지로 연습) → 7음 스케일만 검사
      if (lv !== "pb") assert.ok(pcs.includes(b.rootPc), `${lv} ${id} ${key} ${b.name} 근음`);
    }
  }
  const m = C.chordScalePlan("md", "251-modes", 0);
  assert.deepEqual(m.bars.map(b => `${b.name}:${b.scaleId}`), ["Dm7:dorian", "G7:mixolydian", "Cmaj7:ionian", "Cmaj7:ionian"]);
});
