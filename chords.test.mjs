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

test("사용 빈도 순위: 최대 8개, 중복 운지 없음, 오픈 코드·바레가 앞", () => {
  for (let pc = 0; pc < 12; pc++) for (const t of ["maj", "m", "7", "m7", "maj7", "dim7", "9"]) {
    const top = V.rankVoicings(V.allVoicings(pc, t).flatMap(g => g.list));
    assert.ok(top.length >= 1 && top.length <= 8);
    assert.equal(new Set(top.map(v => v.key)).size, top.length);
  }
  const c = V.rankVoicings(V.allVoicings(0, "maj").flatMap(g => g.list));
  assert.equal(c[0].key, "x32010");
  assert.equal(c[1].key, "x35553");
  const g7 = V.rankVoicings(V.allVoicings(7, "7").flatMap(g => g.list));
  assert.deepEqual(g7.slice(0, 2).map(v => v.key), ["320001", "353433"]);
  // 15프렛 근처 운지는 낮은 위치에 같은 모양이 있으면 빠짐
  const f = V.rankVoicings(V.closeTriads(5, "maj"));
  assert.ok(f.every(v => Math.max(...v.notes.map(n => n.f)) <= 12));
});

import * as BPM from "../js/modules/chords/bpm-core.js";

test("BPM Chord Finding: 카운트인 4박 → 2박마다 코드, 16개 = 완료 1회", () => {
  let st = BPM.init({ topics: ["triad"], bpm: 90 }, seeded(3));
  assert.equal(st.seq.length, 16);
  assert.equal(BPM.beatInfo(0, 0).phase, "count");
  assert.equal(BPM.beatInfo(0, 3).countLeft, 1);
  let units = 0, changes = 0;
  // 카운트인 4박 + 32박(8마디) + 다음 묶음 첫 박
  for (let b = 0; b < 4 + 32 + 2; b++) {
    const info = BPM.beatInfo(0, b);
    if (info.phase === "chord" && info.chordStart) changes++;
    const r = BPM.advance(st, info, seeded(b));
    st = r.state; if (r.completedUnit) units++;
  }
  assert.equal(changes, 17);
  assert.equal(units, 1);
  assert.equal(st.passes, 1);
  assert.equal(st.pos, 0);
  assert.equal(BPM.barOf(15), 8);
});

test("BPM Chord Finding: 중간에서 재개하면 그 코드부터, 완료는 16번째 다음에만", () => {
  let st = BPM.init({ topics: ["power"], bpm: 60 }, seeded(5));
  st = { ...st, pos: 10 };
  let units = 0;
  for (let b = 0; b < 4 + 12; b++) { // 코드 10~15
    const r = BPM.advance(st, BPM.beatInfo(10, b)); st = r.state; if (r.completedUnit) units++;
  }
  assert.equal(st.pos, 15);
  assert.equal(units, 0);
  const r = BPM.advance(st, BPM.beatInfo(10, 16));
  assert.equal(r.completedUnit, true);
  assert.equal(BPM.clampBpm(300), 160);
});

import * as PL from "../js/modules/chords/play-core.js";

const allTopics = ["open", "triad", "power", "barre", "dim-aug-sus", "triad-inversion", "string-set-triad", "caged", "seventh",
  "seventh-inversion", "shell", "drop2", "drop3", "tension", "substitute", "slash", "open-voicing", "quartal", "voice-leading"];

test("Play Session: 모든 키·진행·주제에서 32마디, 마디당 4박, 모든 코드에 운지", () => {
  for (const style of Object.keys(PL.STYLES)) for (const k of PL.KEYS) for (const t of allTopics) {
    const plan = PL.buildPlan({ keyPc: k.pc, style, topics: [t] }, seeded(k.pc + 1));
    assert.equal(plan.bars.length, 32);
    assert.deepEqual(plan.bars.map(b => b.section).join(""), "A".repeat(16) + "B".repeat(8) + "A′".repeat(8));
    for (const bar of plan.bars) {
      assert.equal(bar.chords.reduce((a, c) => a + c.beats, 0), 4);
      for (const c of bar.chords) {
        assert.ok(c.voicing && c.voicing.notes.length >= 2, `${style} ${t} ${c.name}`);
        if (t !== "quartal") {
          const pcs = new Set(CHORD_TYPES[c.type].intervals.map(i => (c.rootPc + i) % 12));
          if (c.bassPc != null) pcs.add(c.bassPc);
          for (const n of c.voicing.notes) assert.ok(pcs.has(n.midi % 12), `${t} ${c.name} ${c.voicing.key}`);
        }
      }
    }
  }
});

test("Play Session: C키 Pop 화성 — A 섹션 I V vi IV", () => {
  const plan = PL.buildPlan({ keyPc: 0, style: "pop", topics: ["triad"] }, seeded(1));
  assert.deepEqual(plan.bars.slice(0, 4).map(b => b.chords[0].name), ["C", "G", "Am", "F"]);
  const jazz = PL.buildPlan({ keyPc: 5, style: "jazz", topics: ["seventh"] }, seeded(1));
  assert.deepEqual(jazz.bars.slice(0, 4).map(b => b.chords[0].name), ["Fmaj7", "Dm7", "Gm7", "C7"]);
});

test("Play Session: 대리 코드는 V7→I를 ♭II7로, 슬래시는 베이스 진행, sus·aug 변형", () => {
  const sub = PL.buildPlan({ keyPc: 0, style: "pop", topics: ["substitute"] }, seeded(2));
  assert.ok(sub.bars.flatMap(b => b.chords).some(c => c.name === "D♭7" && c.roman === "♭II7"));
  const sl = PL.buildPlan({ keyPc: 0, style: "pop", topics: ["slash"] }, seeded(2));
  assert.ok(sl.bars.flatMap(b => b.chords).some(c => c.name.includes("/")));
  const das = PL.buildPlan({ keyPc: 0, style: "pop", topics: ["dim-aug-sus"] }, seeded(2));
  const names = das.bars.flatMap(b => b.chords).map(c => c.name);
  assert.ok(names.includes("Gsus4") && names.includes("Gaug"));
  const ball = PL.buildPlan({ keyPc: 0, style: "ballad", topics: ["dim-aug-sus"] }, seeded(2)).bars.flatMap(b => b.chords).map(c => c.name);
  assert.ok(ball.includes("Caug"));
  // 섹션 경계를 넘는 V7→I도 대리 (Jazz A 끝 V7 → 다음 A의 I)
  const jz = PL.buildPlan({ keyPc: 0, style: "jazz", topics: ["substitute"] }, seeded(2));
  assert.equal(jz.bars[7].chords[0].name, "D♭7");
});

test("Play Session: 보이스 리딩은 코드 사이 음 이동이 작음(평균 6반음 미만)", () => {
  const avg = plan => { const cs = plan.bars.flatMap(b => b.chords); let s = 0; for (let i = 1; i < cs.length; i++) s += PL.voicingDistance(cs[i - 1].voicing, cs[i].voicing); return s / (cs.length - 1); };
  let vl = 0, common = 0;
  for (const k of PL.KEYS) {
    vl += avg(PL.buildPlan({ keyPc: k.pc, style: "jazz", topics: ["voice-leading"] }, seeded(3)));
    common += avg(PL.buildPlan({ keyPc: k.pc, style: "jazz", topics: ["seventh"] }, seeded(3)));
  }
  assert.ok(vl <= common * 1.05 && vl / 12 < 6, `${vl / 12} vs ${common / 12}`);
});

test("Play Session: 박 위치 계산(준비 4박, 2코드 마디는 2박씩)", () => {
  const plan = PL.buildPlan({ keyPc: 0, style: "pop", topics: ["triad"] }, seeded(1));
  assert.equal(PL.locate(plan, 0, 2).phase, "count");
  const a = PL.locate(plan, 0, 4);
  assert.deepEqual([a.barIdx, a.chordIdx, a.chordStart], [0, 0, true]);
  // A′ 7마디째(전체 31번째 마디)는 IV-V 2코드
  const s = PL.locate(plan, 30, 4 + 2);
  assert.deepEqual([s.barIdx, s.chordIdx, s.chordStart], [30, 1, true]);
  assert.equal(PL.locate(plan, 0, 4 + 32 * 4).phase, "done");
  assert.equal(PL.nextChord(plan, 3, 0).name, "C");
});

test("연속 코드 찾기: 16개 무작위, 같은 근음 연속 없음", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const deck = P.buildDeck(["triad", "power", "seventh"], seeded(seed), 16);
    assert.equal(deck.length, 16);
    for (let i = 1; i < 16; i++) assert.notEqual(deck[i].root, deck[i - 1].root, `seed ${seed} at ${i}`);
  }
});

test("Play Session: 바레·7th 등도 앞 코드 가까이(근음 현을 바꿔 가며), 평균 손 위치 이동 3프렛 이내", () => {
  const pos = v => { const f = v.notes.filter(n => n.f > 0).map(n => n.f); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; };
  for (const t of ["barre", "seventh"]) for (const k of PL.KEYS) for (const style of ["pop", "jazz"]) {
    const cs = PL.buildPlan({ keyPc: k.pc, style, topics: [t] }, seeded(7)).bars.flatMap(b => b.chords);
    let move = 0;
    for (let i = 1; i < cs.length; i++) move += Math.abs(pos(cs[i].voicing) - pos(cs[i - 1].voicing));
    assert.ok(move / (cs.length - 1) <= 3, `${t} ${k.name} ${style} ${(move / (cs.length - 1)).toFixed(2)}`);
    // 근음 6번 현·5번 현 운지를 함께 씀
    if (t === "barre") assert.ok(new Set(cs.map(c => c.voicing.detail.slice(0, 2))).size >= 2);
  }
});

import { _SYSTEMS, _LEVEL_SYSTEMS } from "../js/modules/chords/dictionary-view.js";

test("사전: 레벨별 구성 시스템 × 가능한 코드 종류 × 근음 12개 → 묶음마다 운지", () => {
  assert.deepEqual(_LEVEL_SYSTEMS.c1, ["open", "triad", "power"]);
  assert.equal(_LEVEL_SYSTEMS.c5.length, 17);
  for (const [sid, sys] of Object.entries(_SYSTEMS)) {
    const types = sys.types || ["maj"];
    for (const t of types) {
      let total = 0;
      for (let pc = 0; pc < 12; pc++) {
        const groups = sys.groups(pc, t, "C");
        for (const g of groups) { assert.ok(g.list.length <= 8, `${sid} ${t}`); total += g.list.length; }
      }
      if (sid === "open") assert.ok(total >= 1, sid + t); else assert.ok(total >= 12, `${sid} ${t} ${total}`);
    }
  }
  // 하위 구분: Drop 2는 현 묶음 3개, 7th 전위는 4개, CAGED는 5폼
  assert.equal(_SYSTEMS.drop2.groups(7, "7").length, 3);
  assert.equal(_SYSTEMS["seventh-inversion"].groups(7, "7").length, 4);
  assert.equal(_SYSTEMS.caged.groups(0, "maj").length, 5);
});
