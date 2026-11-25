// 핵심 로직 자동 테스트 (개발용, 앱 동작에는 필요 없음)
// 실행: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/core/clock.js";
import * as J from "../js/core/journal.js";
import * as B from "../js/core/backup.js";
import { MODULES, UNIT, taskName, levelName } from "../js/data/catalog.js";

const T0 = new Date(2026, 10, 25, 12, 3, 10).getTime(); // 2026-11-25 12:03:10 (기기 시간대)
const sec = n => n * 1000;
const meta = { module: "notes", level: "n1", task: "note-finder", type: "finding" };

test("일시정지 시간은 연습시간에서 빠짐", () => {
  let s = C.createSession(meta, T0, () => 0.5);
  s = C.pause(s, T0 + sec(412), "user");          // 6분 52초 연습
  s = C.resume(s, T0 + sec(412 + 148));           // 2분 28초 쉼
  const rec = C.finish(s, T0 + sec(1110));        // 시작부터 18분 30초 뒤 종료
  assert.equal(rec.activeSec, 1110 - 148);        // 962초
  assert.equal(rec.pauses.length, 1);
  assert.equal(rec.date, "2026-11-25");
});

test("일시정지 상태에서 종료해도 일시정지 시간은 제외", () => {
  let s = C.createSession(meta, T0);
  s = C.pause(s, T0 + sec(300));
  const rec = C.finish(s, T0 + sec(900));
  assert.equal(rec.activeSec, 300);
  assert.equal(rec.pauses.length, 1);
});

test("여러 번 일시정지·재개", () => {
  let s = C.createSession(meta, T0);
  s = C.pause(s, T0 + sec(60), "auto");
  s = C.resume(s, T0 + sec(100));
  s = C.pause(s, T0 + sec(160));
  s = C.resume(s, T0 + sec(200));
  const rec = C.finish(s, T0 + sec(260));
  assert.equal(rec.activeSec, 60 + 60 + 60);
  assert.deepEqual(rec.pauses.map(p => p.reason), ["auto", "user"]);
});

test("중복 일시정지·중복 재개는 무시", () => {
  let s = C.createSession(meta, T0);
  s = C.pause(s, T0 + sec(10));
  s = C.pause(s, T0 + sec(20));
  s = C.resume(s, T0 + sec(30));
  s = C.resume(s, T0 + sec(40));
  assert.equal(C.activeMs(s, T0 + sec(50)), sec(10 + 20));
});

test("앱 강제 종료 후 복구: 마지막 생존 시각에 일시정지", () => {
  let s = C.createSession(meta, T0);
  s = C.touch(s, T0 + sec(120));                  // 마지막 기록 시각
  s = C.recover(s, T0 + sec(3600));               // 1시간 뒤 다시 열림
  assert.equal(s.status, "paused");
  assert.equal(C.activeMs(s, T0 + sec(3600)), sec(120));
  assert.equal(s.pauses.at(-1).reason, "restore");
});

test("완료 단위는 별도 지표로 누적, 미달 종료 시 0", () => {
  let s = C.createSession(meta, T0);
  assert.equal(C.finish(s, T0 + sec(30)).completedUnits, 0);
  s = C.addUnit(s); s = C.addUnit(s);
  const rec = C.finish(s, T0 + sec(30));
  assert.equal(rec.completedUnits, 2);
  assert.equal(rec.activeSec, 30);
});

test("시간 표기", () => {
  assert.equal(C.formatDuration(962), "16:02");
  assert.equal(C.formatDuration(3725), "1:02:05");
  assert.equal(C.formatShort(3900), "1시간 5분");
  assert.equal(C.formatShort(45), "45초");
});

function rec(id, date, module, level, task, activeSec, units) {
  return { schema: 1, id, date, module, level, task, type: "finding", startedAt: date + "T10:00:00+09:00", endedAt: date + "T11:00:00+09:00",
    startedAtMs: Date.parse(date + "T10:00:00+09:00"), endedAtMs: 0, activeSec, pauses: [], completedUnits: units };
}

const DATA = [
  rec("a", "2026-11-25", "notes", "n1", "note-finder", 600, 2),
  rec("b", "2026-11-25", "notes", "n2", "note-finder", 300, 1),
  rec("c", "2026-11-25", "chords", "c1", "random-chord", 900, 0),
  rec("d", "2026-11-03", "notes", "n1", "note-finder", 120, 0),
  rec("e", "2026-10-30", "ear", "e2", "interval", 1500, 3),
  rec("f", "2025-12-31", "notes", "n1", "note-finder", 60, 1)
];

test("연간 집계: 모듈별 누적, 시간과 횟수 구분", () => {
  const y = J.summarizeYear(DATA, 2026);
  assert.equal(y.totals.sec, 600 + 300 + 900 + 120 + 1500);
  assert.equal(y.totals.units, 2 + 1 + 3);
  assert.equal(y.modules.notes.sec, 1020);
  assert.equal(y.modules.notes.units, 3);
  assert.equal(y.months[10].sec, 1920);
  assert.equal(y.months[9].modules.ear.units, 3);
});

test("월간 집계: 모듈·레벨별, 일별", () => {
  const m = J.summarizeMonth(DATA, 2026, 11);
  assert.equal(m.modules.notes.levels.n1.sec, 720);
  assert.equal(m.modules.notes.levels.n2.units, 1);
  assert.equal(m.days["2026-11-25"].sec, 1800);
  assert.equal(m.days["2026-11-03"].modules.notes.sec, 120);
});

test("일간 집계: 모듈·레벨·과제별", () => {
  const d = J.summarizeDay(DATA, "2026-11-25");
  assert.equal(d.sessions.length, 3);
  assert.equal(d.modules.notes.levels.n1.tasks["note-finder"].sec, 600);
  assert.equal(d.modules.chords.units, 0);
});

test("달력 칸: 2026년 11월은 일요일 시작, 30일", () => {
  const g = J.monthGrid(2026, 11);
  assert.equal(g[0], 1); // 2026-11-01은 일요일
  assert.equal(g.filter(Boolean).length, 30);
  assert.equal(g.length % 7, 0);
});

test("백업 → 복원 왕복", () => {
  const backup = B.buildBackup(DATA, { bpm: 90 }, T0);
  const parsed = B.parseBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, DATA.length);
  assert.equal(parsed.rejected.length, 0);
  assert.deepEqual(parsed.settings, { bpm: 90 });
});

test("잘못된 파일·잘못된 기록 거르기", () => {
  assert.equal(B.parseBackup("not json").ok, false);
  assert.equal(B.parseBackup(JSON.stringify({ app: "other", sessions: [] })).ok, false);
  const bad = { app: "fret-lab", schema: 1, sessions: [DATA[0], { id: "x" }, { ...DATA[1], activeSec: -5 }] };
  const p = B.parseBackup(JSON.stringify(bad));
  assert.equal(p.records.length, 1);
  assert.equal(p.rejected.length, 2);
  assert.equal(B.parseBackup(JSON.stringify({ app: "fret-lab", schema: 99, sessions: [] })).ok, false);
});

test("병합 계획 계산", () => {
  const plan = B.mergePlan(DATA.slice(0, 3), [DATA[2], DATA[3]]);
  assert.deepEqual(plan, { added: 1, replaced: 1, total: 4 });
});

test("레벨·완료 단위 정의가 결정 사항과 일치", () => {
  const counts = Object.fromEntries(MODULES.map(m => [m.id, m.levels.length]));
  assert.deepEqual(counts, { notes: 2, chords: 5, rhythm: 4, scales: 4, licks: 7, ear: 4 });
  const notes = MODULES.find(m => m.id === "notes");
  assert.equal(notes.levels[0].tasks[0].unit, UNIT.noteCycle);
  const ear = MODULES.find(m => m.id === "ear");
  assert.equal(ear.levels[0].tasks[0].unit.size, 24);
  assert.equal(ear.levels[1].tasks[0].unit.size, 24);
  const scales = MODULES.find(m => m.id === "scales");
  assert.deepEqual(scales.levels.map(l => l.name), ["S1 Pentatonic & Blues", "S2 Major & Minor Family", "S3 Modes", "S4 Chord Tones"]);
  const base = ["shape-learning", "shape-root", "root-cycle", "start-note", "neck-transition"];
  assert.deepEqual(scales.levels[0].tasks.map(t => t.id), [...base, "chord-scale"]);
  assert.deepEqual(scales.levels[2].tasks.map(t => t.id), ["shape-learning", "shape-root", "root-cycle", "start-note", "mode-switch", "neck-transition", "chord-scale"]);
  assert.deepEqual(scales.levels[3].tasks.map(t => t.id), base);
  assert.ok(scales.levels[0].tasks.at(-1).pending);
  // 이전 구성 기록은 이름 뒤에 (이전 구성)
  assert.equal(taskName("scales", "s2", "block-learning"), "Block Scale Learning (이전 구성)");
  assert.equal(levelName("scales", "s2"), "S2 (이전 구성)");
  assert.equal(taskName("scales", "s2", "root-cycle"), "근음 이동하며 익히기 · Root Cycle");
  const chords = MODULES.find(m => m.id === "chords");
  assert.deepEqual(chords.levels[4].tasks.map(t => t.id), ["play-session", "genre-comping", "chord-melody", "chord-dictionary"]);
});

test("학습 주제: 목록·기록·일간 집계", async () => {
  const { topicsFor, topicLabel } = await import("../js/data/catalog.js");
  assert.deepEqual(topicsFor("chords", "c1", "random-chord").map(t => t.name), ["오픈 코드", "메이저·마이너 트라이어드", "파워 코드"]);
  assert.deepEqual(topicsFor("scales", "pb", "root-cycle").map(t => t.id), ["minor-penta", "major-penta", "blues"]);
  assert.deepEqual(topicsFor("scales", "md", "mode-switch").map(t => t.id), ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"]);
  assert.equal(topicsFor("scales", "ct", "start-note").length, 6);
  assert.equal(topicsFor("chords", "c5", "play-session")[0].name, "보이스 리딩");
  assert.equal(topicsFor("rhythm", "r2", "fingerstyle").length, 2);
  assert.deepEqual(topicsFor("notes", "n1", "note-finder"), []);
  assert.deepEqual(topicsFor("chords", "c1", "chord-dictionary"), []);
  assert.equal(topicLabel("chords", "c1", "random-chord", ["open", "power"]), "오픈 코드 + 파워 코드");

  let s = C.createSession({ module: "chords", level: "c1", task: "random-chord", type: "finding", topics: ["power", "open"] }, T0);
  const r1 = C.finish(s, T0 + sec(100));
  assert.deepEqual(r1.topics, ["power", "open"]);
  s = C.createSession({ module: "chords", level: "c1", task: "random-chord", type: "finding", topics: ["open", "power"] }, T0 + sec(200));
  const r2 = C.finish(s, T0 + sec(260));
  s = C.createSession({ module: "chords", level: "c1", task: "random-chord", type: "finding", topics: ["open"] }, T0 + sec(300));
  const r3 = C.finish(s, T0 + sec(330));
  const d = J.summarizeDay([r1, r2, r3], "2026-11-25");
  const topics = d.modules.chords.levels.c1.tasks["random-chord"].topics;
  assert.equal(topics["open+power"].sec, 160);   // 순서가 달라도 같은 조합
  assert.equal(topics["open"].sec, 30);
});
