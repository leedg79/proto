import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS, COURSES, itemCount } from "../js/data/courses.js";
import { findTask, topicsFor } from "../js/data/catalog.js";

test("단계별 코스: 다섯 단계, 항목이 실제 과제·주제를 가리킴", () => {
  assert.deepEqual(STEPS.map(s => s.name), ["입문", "초보", "초급", "중급", "고급"]);
  for (const s of STEPS) {
    assert.ok(COURSES[s.id].length >= 7, s.name);
    for (const it of COURSES[s.id]) {
      if (it.pending) { assert.ok(it.title && it.mod); continue; }
      const t = findTask(it.mod, it.lvl, it.task);
      assert.ok(t && !t.reference, `${it.title} 과제`);
      const ids = topicsFor(it.mod, it.lvl, it.task).map(x => x.id);
      for (const tp of it.topics) assert.ok(ids.includes(tp), `${it.title} 주제 ${tp}`);
    }
  }
});

test("코스 항목 해 본 횟수", () => {
  const it = COURSES[1][1]; // 오픈 코드 잡기
  const recs = [
    { module: "chords", level: "c1", task: "random-chord", topics: ["open"] },
    { module: "chords", level: "c1", task: "random-chord", topics: ["power"] },
    { module: "chords", level: "c2", task: "random-chord", topics: ["open"] }
  ];
  assert.equal(itemCount(it, recs), 1);
  assert.equal(itemCount(COURSES[1][0], [{ module: "notes", level: "n1", task: "note-finder", topics: [] }]), 1);
});
