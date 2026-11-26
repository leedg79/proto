// Ear Lab 엔진 검사
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/modules/ear/ear-core.js";
import { topicsFor, findTask } from "../js/data/catalog.js";

let seed = 5;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("E1 음 이름: 음역·자연음 조건을 지킴", () => {
  for (let i = 0; i < 300; i++) {
    const q = E.notePrompt({ range: "low", naturals: true }, rand);
    assert.ok(q.midi >= 40 && q.midi <= 52);
    assert.ok([0, 2, 4, 5, 7, 9, 11].includes(q.answer));
    assert.equal(q.midi % 12, q.answer);
  }
  assert.equal(E.noteChoices(true).length, 7);
  assert.equal(E.noteChoices(false).length, 12);
});

test("E2 음정: 주제의 음정만, 반음 수·방향이 맞음", () => {
  for (let i = 0; i < 300; i++) {
    const q = E.intervalPrompt(["6-7", "octave-compound"], { dir: "mix" }, rand);
    assert.ok(["6-7", "octave-compound"].includes(q.interval.topic));
    const [a, b] = q.notes;
    assert.equal(Math.abs(b - a), q.interval.s);
    if (q.dir === "down") assert.ok(a > b); else assert.ok(b > a);
    assert.ok(Math.max(a, b) <= 72);
  }
  assert.equal(E.intervalsFor(topicsFor("ear", "e2", "interval").map(t => t.id)).length, 16);
});

test("E3 코드: 구성음 반음 간격, 진행은 4코드", () => {
  assert.deepEqual(E.chordMidis(0, "m7b5"), [48, 51, 54, 58]);
  assert.deepEqual(E.chordMidis(7, "13").map(m => m - 55), [0, 4, 10, 14, 21]);
  for (let i = 0; i < 100; i++) {
    const q = E.chordPrompt(["sevenths"], rand);
    assert.equal(q.kind, "chord");
    assert.ok(["maj7", "7", "m7", "m7b5", "dim7"].includes(q.answer));
    assert.equal(q.choices.length, 5);
  }
  const p = E.chordPrompt(["progressions"], rand);
  assert.equal(p.kind, "prog");
  assert.equal(p.chords.length, 4);
});

test("E3 화성: 자리바꿈에 따라 맨 아래·맨 위 음이 맞음", () => {
  for (let i = 0; i < 200; i++) {
    const q = E.harmPrompt({ kind: "inversion" }, rand);
    const bassIntervalsUp = q.midis.map(m => m - q.midis[0]);
    // 기본: 3·7(또는 4·7), 1전위: 3·8(또는 3·9), 2전위: 5·8(또는 5·9)
    const shape = { 0: [[0, 4, 7], [0, 3, 7]], 1: [[0, 3, 8], [0, 4, 9]], 2: [[0, 5, 9], [0, 5, 8]] }[q.answer];
    assert.ok(shape.some(sh => sh.join() === bassIntervalsUp.join()), `${q.answer} ${bassIntervalsUp}`);
  }
});

test("E3 선율: 길이·범위, 정답 확인, 리듬 보기 3개 중 정답 1개", () => {
  for (let i = 0; i < 200; i++) {
    const q = E.melodyPrompt({ len: 6, scale: "minor", leaps: true, rhythm: true }, rand);
    assert.equal(q.seq.length, 6);
    assert.ok(q.seq.every(k => k >= -3 && k <= 7));
    assert.equal(q.rhythm.reduce((a, r) => a + r.len, 0), 8 - q.rhythm[0].at);
    const ch = E.rhythmChoices(q.rhythm, rand);
    assert.equal(ch.length, 3);
    assert.equal(ch.filter(r => E.rhythmSig(r) === E.rhythmSig(q.rhythm)).length, 1);
  }
  assert.equal(E.degreeLabel(2, "minor"), "♭3");
  assert.equal(E.degreeLabel(-3, "major"), "낮은 5");
  assert.equal(E.degreeMidi(7, 60), 72);
  assert.deepEqual(E.checkSequence([0, 1, 2], [0, 2, 2]), { ok: false, firstWrong: 1, correctCount: 2 });
});

test("E4 프레이즈: 장르마다 릭이 있고, 앞 N음만 판정·재생", () => {
  for (const t of topicsFor("ear", "e4", "phrase-transcribe")) assert.ok(E.phrasePool([t.id]).length >= 5, t.id);
  for (const l of E.phrasePool([])) {
    const t = E.phraseTargets(l, 4);
    assert.ok(t.length >= 1 && t.length <= 4, l.id);
    const cut = E.phraseCut(l, 4);
    assert.ok(cut.events.length >= t.length && cut.ticks <= l.ticks, l.id);
  }
});

test("Ear Lab 과제 완료 단위", () => {
  assert.equal(findTask("ear", "e3", "melodic").unit.size, 10);
  assert.equal(findTask("ear", "e4", "phrase-transcribe").unit.size, 5);
});
