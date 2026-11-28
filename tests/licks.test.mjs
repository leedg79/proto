import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/modules/licks/lick-core.js";
import { LICK_LEVELS, topicsFor, findTask } from "../js/data/catalog.js";

test("릭 135개: 분류별 수량, 번호 중복 없음", () => {
  assert.equal(L.LICKS.filter(l => !l.custom).length, 135);
  const by = {};
  for (const l of L.LICKS) by[l.level] = (by[l.level] || 0) + 1;
  assert.deepEqual(by, { l1: 30, l2: 20, l3: 20, l4: 25, l5: 15, l6: 25 });
  assert.equal(new Set(L.LICKS.map(l => l.id)).size, 135);
  for (const l of L.LICKS) assert.ok(LICK_LEVELS.find(x => x.id === l.level).subs.some(([id]) => id === l.sub), l.id);
});

test("릭 검사: 2마디 이내, 스케일·코드 스케일 안, 기법 연결 올바름", () => {
  for (const l of L.LICKS) assert.deepEqual(L.validate(l), [], l.id);
});

test("키 이동: 모양 그대로 수평 이동, 도수 유지, 0~20프렛", () => {
  for (const l of L.LICKS) for (let k = 0; k < 12; k++) {
    const a = L.realize(l), b = L.realize(l, k);
    assert.deepEqual(b.notes.map(n => n.deg), a.notes.map(n => n.deg), `${l.id} → ${k}`);
    assert.ok(b.lo >= 0 && b.hi <= 20, `${l.id} ${k} ${b.lo}-${b.hi}`);
    const d = b.notes[0].f - a.notes[0].f;
    assert.ok(b.notes.every((n, i) => n.f - a.notes[i].f === d && n.s === a.notes[i].s));
  }
});

test("위치·코드 관계 정보", () => {
  const a = L.realize(L.lickById("MP-01"));
  assert.equal(a.blockName, "블록 1"); assert.equal(a.rootString, 6); assert.equal(a.rootFret, 5);
  assert.equal(a.notes[0].bendDeg, "R"); assert.equal(a.land, "R");
  assert.equal(L.overText(a), "Am, A7(블루스)");
  const t = L.realize(L.lickById("TF-01"));
  assert.deepEqual(t.chords.map(c => c.name), ["Dm7", "G7", "Cmaj7"]);
  assert.equal(t.land, "3");
  const f = L.realize(L.lickById("TF-01"), 5);
  assert.deepEqual(f.chords.map(c => c.name), ["Gm7", "C7", "Fmaj7"]);
  const m = L.realize(L.lickById("MT-04"));
  assert.ok(m.notes.some(n => n.cdeg === "♭9") && m.notes.some(n => n.cdeg === "♯9"));
});

test("내 릭: 직접 입력한 릭이 목록에 붙고, 4마디까지 허용", async () => {
  globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  const M = await import("../js/modules/licks/my-licks.js");
  assert.equal(M.nextMyId(), "MY-01");
  M.saveMyLick(["MY-01", "my", "minor-penta", 9, "f", "straight", "1-5:q 2-8:qb2 2-5:q 3-7:q 3-5:w", "", "테스트 릭"]);
  const l = L.lickById("MY-01");
  assert.equal(l.level, "l7"); assert.equal(l.name, "테스트 릭"); assert.equal(l.bars, 2);
  assert.deepEqual(L.validate(l), []);
  assert.ok(L.realize(l).title.startsWith("테스트 릭"));
  assert.equal(M.nextMyId(), "MY-02");
  M.deleteMyLick("MY-01");
  assert.equal(L.lickById("MY-01"), null);
  assert.equal(L.LICKS.length, 135);
});

test("Licks 메뉴: 레벨별 과제", () => {
  assert.equal(topicsFor("licks", "l1", "lick-learn").length, 4);
  assert.ok(findTask("licks", "l4", "lick-list").reference);
  assert.ok(!findTask("licks", "l2", "lick-backing").pending);
  for (const l of LICK_LEVELS) for (const id of l.id === "l7" ? ["my-edit", "lick-learn", "lick-list"] : ["lick-learn", "lick-list", "lick-move"]) assert.ok(findTask("licks", l.id, id).unit.label, `${l.id} ${id} 완료 단위`);
});

test("릭 활용: 옮기기·변형·주고받기 코드", async () => {
  const A = await import("../js/modules/licks/apply-core.js");
  for (const l of L.LICKS.filter(x => !x.custom)) {
    const r = L.realize(l);
    const m = A.moveTo(r, (r.key + 5) % 12, { lo: 7, hi: 11 });
    const d = m.events.find(e => !e.rest).notes[0].f - r.events.find(e => !e.rest).notes[0].f;
    assert.ok(((d % 12) + 12) % 12 === 5, `${l.id} 4도 위로`);
    assert.ok(m.events.every(e => e.notes.every(n => n.f >= 0 && n.f <= 20)));
    for (const t of A.variationTypes(r)) {
      const v = A.makeVariation(r, t);
      assert.ok(v.events.some(e => !e.rest), `${l.id} ${t}`);
      assert.ok(v.events.every(e => e.notes.every(n => n.f >= 0 && n.f <= 20)), `${l.id} ${t} 범위`);
    }
    const c = A.callResponse(r);
    assert.equal(c.custom.length, c.bars * 2);
    assert.ok(c.custom.every(b => b.segs.reduce((a, x) => a + x.beats, 0) === 4), `${l.id} 마디 4박`);
  }
});

test("장르 릭 자리: 장르 8개·기타리스트, 줄 형식으로 넣으면 메뉴·검색·난이도에 반영", async () => {
  const L = await import("../js/modules/licks/lick-core.js");
  const { LICK_GENRES, findTask, topicsFor } = await import("../js/data/catalog.js");
  assert.deepEqual(LICK_GENRES.map(g => g[0]), ["blues", "neosoul", "rnb", "pop", "funk", "rock", "metal", "jazz"]);
  assert.deepEqual(L.GENRES.map(g => g.id), LICK_GENRES.map(g => g[0]));
  assert.ok(L.GENRES.every(g => g.players.length >= 4 && new Set(g.players.map(p => p.id)).size === g.players.length));
  assert.ok(L.GENRES.find(g => g.id === "blues").players.some(p => p.id === "srv"));
  for (const [id] of LICK_GENRES) { assert.ok(findTask("licks", `g-${id}`, "lick-one")); assert.deepEqual(topicsFor("licks", `g-${id}`, "lick-one"), []); }
  assert.equal(L.basicLicksSorted().length, 135);
  const ds = L.basicLicksSorted().map(L.lickDifficulty);
  assert.deepEqual(ds, [...ds].sort((a, b) => a - b));
  // 시험용 줄 2개(4마디·20프렛까지 허용)
  L.setGenreRows([
    ["T-01", "blues", "srv", 2, "minor-penta", 4, "c", "shuffle", "1-15:qb2 1-12:e 2-15:e 2-12:q 3-14:q~"],
    ["T-02", "blues", "srv", 3, "minor-penta", 4, "l", "straight", "1-19:s 1-17:s 2-20:s 2-17:s 3-19:s 3-16:s 4-19:s 4-17:s -:h -:w -:w -:w"]
  ]);
  assert.equal(L.genreLicks({ genre: "blues", player: "srv" }).length, 2);
  assert.equal(L.genreLicks({ genre: "blues", player: "srv", diff: 2 }).length, 1);   // 줄의 난이도 값이 아니라 자동 계산(T-02: 4마디 2 + 16분 2 = 4점 → 중급)
  const t2 = L.lickById("T-02");
  assert.equal(t2.level, "g-blues"); assert.equal(t2.bars, 4); assert.equal(L.realize(t2).difficulty, 2);
  assert.deepEqual(L.validate(t2), []);
  assert.equal(L.playerOf(t2).name, "Stevie Ray Vaughan");
  assert.equal(L.allLicks().length, L.LICKS.length + 2);
  L.setGenreRows([]);
  assert.equal(L.lickById("T-02"), null);
});

test("SRV 릭 16개: 형식·검사 통과, 마디 정렬, 난이도 3단계, 새 기법 해석", async () => {
  const L = await import("../js/modules/licks/lick-core.js");
  const { GENRE_LICK_ROWS } = await import("../js/modules/licks/genre-data.js");
  L.setGenreRows(GENRE_LICK_ROWS);
  const srv = L.genreLicks({ genre: "blues", player: "srv" });
  assert.equal(srv.length, 16);
  assert.equal(new Set(srv.map(l => l.id)).size, 16);
  for (const l of srv) { assert.deepEqual(L.validate(l), [], l.id); assert.ok(l.bars >= 1 && l.bars <= 5, l.id); }
  // 난이도는 절대 기준 자동 계산(v2.11.0): 초급 3 · 중급 6 · 고급 7
  assert.deepEqual([1, 2, 3].map(d => L.genreLicks({ genre: "blues", player: "srv", diff: d }).length), [3, 6, 7]);
  const p = L.difficultyParts(L.lickById("SRV-04"));
  assert.deepEqual([p.length, p.count, p.rhythm, p.outside, p.tech, p.total, p.level], [2, 2, 2, 2, 2, 10, 3]);
  assert.equal(L.difficultyParts(L.lickById("SRV-16")).level, 1);
  const t = L.parseToken("2-3+3-4:q~g-1");
  assert.equal(t.grace, -1); assert.equal(t.vib, true); assert.equal(t.notes.length, 2);
  assert.equal(L.parseToken("1-15:ebq").bend, 0.5);
  assert.equal(L.parseToken("4-1+3-2:t+h~c").dur, 28);
  const k = L.parseToken("1-14:ek-2"); assert.equal(k.grace, -2); assert.equal(k.graceHP, true);
  assert.equal(L.parseToken("1-2:x").dur, 2); assert.equal(L.parseToken("1-2:u").dur, 8);
});
