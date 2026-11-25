// 코드 엔진 테스트: 알려진 운지와 대조
import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../js/theory/voicings.js";
import { CHORD_TYPES } from "../js/theory/chords.js";

const keys = list => list.map(v => v.key);
const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, Bb = 10, B = 11;

test("오픈 코드", () => {
  assert.deepEqual(keys(V.openVoicingsOf(C, "maj")), ["x32010"]);
  assert.deepEqual(keys(V.openVoicingsOf(G, "maj")), ["320003", "320033"]);
  assert.deepEqual(keys(V.openVoicingsOf(E, "m")), ["022000"]);
  assert.equal(V.openVoicingsOf(F, "maj").length, 0);
});

test("바레: F = 133211(E폼 1프렛), Bm = x24432(A폼 2프렛)", () => {
  assert.ok(keys(V.barreVoicings(F, "maj")).includes("133211"));
  assert.ok(keys(V.barreVoicings(B, "m")).includes("x24432"));
  assert.ok(keys(V.barreVoicings(B, "m7b5")).includes("x2323x"));
  assert.ok(!keys(V.barreVoicings(E, "maj")).includes("022100")); // 0프렛(개방)은 바레에서 제외
});

test("파워 코드: G5 = 355xxx, C5 = x355xx", () => {
  assert.ok(keys(V.powerVoicings(G)).includes("355xxx"));
  assert.ok(keys(V.powerVoicings(C)).includes("x355xx"));
});

test("CAGED: C메이저 5개 폼", () => {
  const all = Object.keys(V.CAGED_FORMS).map(f => keys(V.cagedVoicings(C, f)));
  assert.ok(all[0].includes("x32010"));     // C폼
  assert.ok(all[1].includes("x35553"));     // A폼 3프렛
  assert.ok(all[2].includes("875558"));     // G폼
  assert.ok(all[4].includes("xx(10)(12)(13)(12)")); // D폼
  assert.ok(keys(V.cagedVoicings(C, "E")).includes("8(10)(10)988"));
});

test("밀집 트라이어드: 전위는 베이스 음 기준", () => {
  const list = V.closeTriads(C, "maj", { sets: [[3, 2, 1]] });
  // 3-2-1번 현 C메이저: 기본형 C-E-G = xxx554? (G현5=C, B현5=E, E현3=G)
  const byInv = k => list.filter(v => v.inversion === k).map(v => v.key);
  assert.ok(byInv(0).includes("xxx553"));
  assert.ok(byInv(1).includes("xxx988"));   // E-G-C
  assert.ok(byInv(2).includes("xxx010"));   // G-C-E (개방)
  assert.ok(byInv(2).includes("xxx(12)(13)(12)"));
  for (const v of list) {
    const bass = v.notes[0];
    assert.equal(bass.label, ["R", "3", "5"][v.inversion]);
  }
});

test("Drop 2: Cmaj7 기본형 = x3545x, 2전위 = xx5557 / Drop 3: Cmaj7 기본형 = 8x998x", () => {
  const d2root = keys(V.dropVoicings(C, "maj7", { drop: 2, inversions: [0] }));
  assert.ok(d2root.includes("x3545x"));
  assert.ok(d2root.includes("xx(10)(12)(12)(12)"));
  assert.ok(keys(V.dropVoicings(C, "maj7", { drop: 2, inversions: [2] })).includes("xx5557"));
  assert.ok(keys(V.dropVoicings(C, "maj7", { drop: 3, inversions: [0] })).includes("8x998x"));
  // 전위 이름 = 실제 베이스 음
  for (const k of [0, 1, 2, 3]) for (const d of [2, 3]) for (const v of V.dropVoicings(G, "7", { drop: d, inversions: [k] })) assert.equal(v.notes[0].label, ["R", "3", "5", "♭7"][k]);
  // Drop 2는 4개 전위 모두, 각 현 묶음에서 나옴
  for (const k of [0, 1, 2, 3]) assert.ok(V.dropVoicings(D, "m7", { drop: 2, inversions: [k] }).length >= 3);
});

test("Shell: G7 = 3x34xx(R-7-3), Cmaj7 = x324xx? 계열 존재", () => {
  const g = keys(V.shellVoicings(G, "7"));
  assert.ok(g.includes("3x34xx"));
  assert.ok(V.shellVoicings(C, "maj7").length >= 2);
});

test("텐션: C9 = x3233x, Cm11 = 8x886x", () => {
  assert.ok(keys(V.tensionVoicings(C, "9")).includes("x3233x"));
  assert.ok(keys(V.tensionVoicings(C, "m11")).includes("8x886x"));
});

test("슬래시: C/E, D/F♯ 운지 존재, 베이스가 가장 낮은 음", () => {
  for (const [r, t, b] of [[C, "maj", E], [D, "maj", 6], [F, "maj", G]]) {
    const list = V.slashVoicings(r, t, b);
    assert.ok(list.length > 0, `${r}/${b}`);
    for (const v of list) assert.equal(v.notes[0].midi % 12, b);
  }
});

test("모든 생성 운지: 0~15프렛, 프렛 폭 3칸 이내(템플릿 제외), 손가락 4개 이내", () => {
  for (let pc = 0; pc < 12; pc++) {
    const lists = [
      V.powerVoicings(pc), V.closeTriads(pc, "maj"), V.closeTriads(pc, "dim"), V.closeTriads(pc, "sus4"),
      V.dropVoicings(pc, "m7", { drop: 2 }), V.dropVoicings(pc, "m7b5", { drop: 3 }), V.shellVoicings(pc, "maj7"),
      V.tensionVoicings(pc, "13"), V.spreadTriads(pc, "m"), V.quartalVoicings(pc, 3), V.quartalVoicings(pc, 4), V.slashVoicings(pc, "maj", (pc + 4) % 12)
    ];
    for (const list of lists) {
      assert.ok(list.length > 0);
      for (const v of list) assert.ok(V.isPlayable(v.frets), v.key);
    }
  }
});

test("모든 근음 × 코드 종류에 사전 운지가 1개 이상", () => {
  for (let pc = 0; pc < 12; pc++) for (const t of Object.keys(CHORD_TYPES)) {
    const n = V.allVoicings(pc, t).reduce((a, g) => a + g.list.length, 0);
    assert.ok(n > 0, `${pc} ${t}`);
  }
});

test("구성음 검사: 생성 운지의 모든 음이 코드 구성음", () => {
  for (let pc = 0; pc < 12; pc++) for (const t of ["maj", "m", "maj7", "7", "m7", "m7b5", "dim7", "9", "13", "m11"]) {
    const pcs = new Set(CHORD_TYPES[t].intervals.map(i => (pc + i) % 12));
    for (const g of V.allVoicings(pc, t)) for (const v of g.list) for (const n of v.notes) assert.ok(pcs.has(n.midi % 12), `${t} ${v.key}`);
  }
});

import * as P from "../js/modules/chords/prompts.js";
import * as R from "../js/modules/chords/random-core.js";
import { topicsFor } from "../js/data/catalog.js";

function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test("C1~C4 모든 학습 주제: 출제 가능, 정답 운지 1개 이상, 문구 생성", () => {
  const ids = ["c1", "c2", "c3", "c4"].flatMap(l => topicsFor("chords", l, "random-chord").map(t => t.id));
  assert.equal(ids.length, 3 + 6 + 5 + 4);
  for (const id of ids) {
    assert.ok(P.RANDOM_TOPICS.includes(id), id);
    for (let seed = 1; seed <= 30; seed++) {
      const deck = P.buildDeck([id], seeded(seed));
      assert.equal(deck.length, 12);
      for (const spec of deck) {
        const ans = P.answersOf(spec);
        assert.ok(ans.length > 0, `${id} ${JSON.stringify(spec)}`);
        const d = P.describe(spec);
        assert.ok(d.title && d.answerName && d.tones.length, id);
      }
    }
  }
});

test("12문제 묶음: 근음 12개 한 번씩(오픈 코드 제외), 여러 주제 고르게", () => {
  const deck = P.buildDeck(["triad", "power", "barre"], seeded(9));
  assert.equal(new Set(deck.map(s => s.root)).size, 12);
  const count = t => deck.filter(s => s.topic === t).length;
  assert.deepEqual([count("triad"), count("power"), count("barre")], [4, 4, 4]);
});

test("주제별 조건이 정답에 반영됨", () => {
  const rand = seeded(4);
  for (let i = 0; i < 40; i++) {
    const inv = P.makeSpec("triad-inversion", i % 12, rand, {});
    for (const v of P.answersOf(inv)) assert.equal(v.inversion, inv.inversion);
    const ss = P.makeSpec("string-set-triad", i % 12, rand, {});
    for (const v of P.answersOf(ss)) assert.deepEqual(v.notes.map(n => n.s).sort(), [...ss.set].sort());
    const sub = P.makeSpec("substitute", i % 12, rand, {});
    if (sub.sub === "tritone") assert.equal((sub.from.root + 6) % 12, sub.root);
  }
});

test("Random Chord Finding: 12문제 정답 확인 = 완료 1회", () => {
  let st = R.init({ topics: ["triad", "shell"], timeLimit: 10 });
  let units = 0;
  for (let i = 0; i < 24; i++) {
    st = R.next(st, i * 1000, seeded(i + 1));
    const r = R.reveal(st); st = r.state; if (r.completedUnit) units++;
  }
  assert.equal(units, 2);
  assert.equal(R.clampTime(1), 3);
  assert.equal(R.clampTime(99), 30);
});
