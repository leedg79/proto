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

test("Licks 메뉴: 6개 레벨, 익히기·목록, 나머지 과제는 준비 중", () => {
  assert.equal(topicsFor("licks", "l1", "lick-learn").length, 4);
  assert.ok(findTask("licks", "l4", "lick-list").reference);
  assert.ok(findTask("licks", "l2", "lick-backing").pending);
  for (const l of LICK_LEVELS) for (const id of l.id === "l7" ? ["my-edit", "lick-learn", "lick-list"] : ["lick-learn", "lick-list", "lick-move"]) assert.ok(findTask("licks", l.id, id).unit.label, `${l.id} ${id} 완료 단위`);
});
