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
  assert.equal(itemCount(COURSES[1][0], [{ module: "notes", level: "n2", task: "note-finder", topics: [] }]), 1);
  // v2.10.0: 1단계 = 6현 전체·오픈 코드 반주, 2단계 = 무작위 3~4현·마이너 펜타 모양
  const ids = n => COURSES[n].map(x => `${x.mod}/${x.lvl}/${x.task}`);
  assert.ok(ids(1).includes("notes/n2/note-finder") && ids(1).includes("chords/c1/play-session") && !ids(1).includes("scales/pb/shape-learning"));
  assert.ok(ids(2).includes("notes/n1/note-finder") && ids(2).includes("scales/pb/shape-learning") && !ids(2).includes("chords/c1/play-session"));
});

import { practiceSeries } from "../js/core/journal.js";
import { practiceChartSvg } from "../js/ui/practice-chart.js";
test("홈 연습량: 1주 7점·1달 4점, 화성학/테크닉 구분", () => {
  const recs = [
    { date: "2026-11-26", module: "rhythm", activeSec: 1200 },
    { date: "2026-11-26", module: "ear", activeSec: 300 },
    { date: "2026-11-24", module: "chords", activeSec: 600 },
    { date: "2026-10-01", module: "notes", activeSec: 600 }
  ];
  const w = practiceSeries(recs, "2026-11-26", "week");
  assert.equal(w.length, 7);
  assert.deepEqual(w[6], { from: "2026-11-26", to: "2026-11-26", label: "목", harmony: 5, technique: 20, total: 25 });
  assert.equal(w[4].harmony, 10);
  const m = practiceSeries(recs, "2026-11-26", "month");
  assert.equal(m.length, 4);
  assert.equal(m.reduce((a, p) => a + p.total, 0), 35);
  assert.equal((practiceChartSvg(w).match(/<polyline/g) || []).length, 3);
});
