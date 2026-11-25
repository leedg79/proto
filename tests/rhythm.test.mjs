// Rhythm 엔진 검사
import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/modules/rhythm/rhythm-core.js";
import { buildBacking } from "../js/audio/backing.js";
import { progVoicings } from "../js/modules/chords/comping-core.js";
import { MODULES, topicsFor, levelName, taskName } from "../js/data/catalog.js";

const all = Object.values(R.PATTERNS).flat();

test("패턴 전체: 길이·문자·손 방향 규칙(짝수 칸 다운, 홀수 칸 업) 통과, 번호 중복 없음", () => {
  for (const p of all) assert.deepEqual(R.validatePattern(p), [], p.id);
  const ids = [...all.map(p => p.id), ...R.PHRASE_LIST.map(p => p.id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(R.PATTERNS.strum.length, 45);
  assert.equal(R.PATTERNS.comp.length, 17);
  assert.equal(R.PATTERNS.finger.length, 8);
  assert.equal(R.PATTERNS.perc.length, 9);
});

test("카탈로그 주제마다 패턴이 있음(R1 9개, R2 컴핑·핑거·퍼커시브, R3 프레이즈)", () => {
  const cases = [["r1", "strum-pattern", "strum"], ["r2", "comping", "comp"], ["r2", "fingerstyle", "finger"], ["r2", "percussive", "perc"]];
  for (const [lv, task, kind] of cases) {
    const tps = topicsFor("rhythm", lv, task);
    assert.ok(tps.length >= 2, task);
    for (const t of tps) assert.ok(R.PATTERNS[kind].some(p => p.topic === t.id), `${task}/${t.id}`);
  }
  for (const t of topicsFor("rhythm", "r4", "phrase")) assert.ok(R.PHRASE_LIST.filter(p => p.topic === t.id).length === 5, t.id);
  assert.equal(topicsFor("rhythm", "r1", "strum-pattern").length, 9);
});

test("Rhythm 레벨: R3 Picking은 Technique로 옮기고 예전 기록 이름은 남김", () => {
  const m = MODULES.find(x => x.id === "rhythm");
  assert.deepEqual(m.levels.map(l => l.id), ["r1", "r2", "r4"]);
  assert.equal(m.levels[2].name, "R3 Rhythm Phrases");
  assert.match(levelName("rhythm", "r3"), /Technique/);
  assert.match(taskName("rhythm", "r3", "picking"), /Technique/);
});

test("소리 길이: 허공 칸은 앞 소리를 이어 가고, r에서 끊김", () => {
  const p = R.patternById("S8-03"); // d.du.udu
  const ev = R.soundEvents(p);
  assert.deepEqual(ev.map(e => [e.i, e.len]), [[0, 2], [2, 1], [3, 2], [5, 1], [6, 1], [7, 1]]);
  const r = R.soundEvents(R.patternById("RS-03")); // d.dur.du
  assert.deepEqual(r.map(e => [e.i, e.type]), [[0, "hit"], [2, "hit"], [3, "hit"], [4, "rest"], [6, "hit"], [7, "hit"]]);
});

test("악보 나누기: 박 경계·마디 가운데를 보이게, 당김 4분음표는 가운데를 넘지 않을 때만", () => {
  const bar = R.notation(R.patternById("S8-03"))[0];
  assert.deepEqual(bar.map(x => [x.start, x.code, !!x.tie]), [[0, "q", false], [4, "8", false], [6, "8", false], [8, "8", true], [10, "8", false], [12, "8", false], [14, "8", false]]);
  assert.deepEqual(R.splitDur(2, 4).map(x => x.code), ["q"]);          // 1박 뒷박 → 2박 뒷박: 당김 4분음표
  assert.deepEqual(R.splitDur(6, 4).map(x => x.code), ["8", "8"]);     // 마디 가운데를 넘음 → 나눔
  assert.deepEqual(R.splitDur(0, 16).map(x => x.code), ["w"]);
  assert.deepEqual(R.splitDur(4, 8).map(x => x.code), ["q", "q"]);     // 2박에서 2분음표는 가운데를 가림 → 나눔
  assert.deepEqual(R.splitDur(1, 3).map(x => x.code), ["8d"]);
  // 모든 패턴: 마디마다 길이 합 16
  for (const p of [...R.PATTERNS.strum, ...R.PATTERNS.comp]) for (const b of R.notation(p)) assert.equal(b.reduce((a, x) => a + x.len, 0), 16, p.id);
  // 마디를 넘는 붙임줄(SY-02)
  const sy = R.notation(R.patternById("SY-02"));
  assert.equal(sy[1][0].tie, true);
});

test("재생 이벤트: 업 스트로크는 위쪽 줄, 앤티시페이션은 다음 코드", () => {
  const G = R.chordVoicing("G"), C = R.chordVoicing("C");
  const ev = R.barEvents(R.patternById("SY-02"), 0, G, C);
  const last = ev[ev.length - 1];
  assert.equal(last.at, 3.5);
  assert.equal(last.up, true);
  assert.deepEqual(last.midis, [52, 55, 60, 64]);   // C 코드 4~1번 줄
  assert.ok(ev[0].midis.includes(43));              // 첫 다운은 G 6번 줄부터
  const mute = R.barEvents(R.patternById("MU-01"), 0, G, G).find(e => e.kind === "mute");
  assert.equal(mute.at, 1);
});

test("핑거스타일: 트래비스는 근음·교대 베이스가 4분음표로 번갈아, TAB 이벤트 길이 합 = 1마디", () => {
  const C = R.chordVoicing("C"), p = R.patternById("FB-03");
  const bass = R.barEvents(p, 0, C, C).filter(e => [48, 52].includes(e.midi) && [0, 1, 2, 3].includes(e.at));
  assert.deepEqual(bass.map(e => [e.at, e.midi]), [[0, 48], [1, 52], [2, 48], [3, 52]]);
  for (const f of R.PATTERNS.finger) for (const ch of ["G", "C", "D", "Am", "Em", "F", "E", "A", "B7", "Bm", "Dm"]) {
    const t = R.fingerTabEvents(f, R.chordVoicing(ch));
    assert.equal(t.reduce((a, e) => a + e.dur, 0), 48, `${f.id} ${ch}`);
  }
});

test("퍼커시브: K·S·T·P가 소리 종류로", () => {
  const G = R.chordVoicing("G");
  const ev = R.barEvents(R.patternById("PP-02"), 0, G, G);
  assert.ok(ev.some(e => e.kind === "pm" && e.midis[0] === 43));
  assert.ok(ev.some(e => e.kind === "perc" && e.drum === "slap"));
  const k = R.barEvents(R.patternById("PS-02"), 0, G, G).filter(e => e.at === 0);
  assert.deepEqual(k.map(e => e.kind).sort(), ["perc", "strum"]);
});

test("컴핑 패턴: 진행·운지를 모든 키에서 찾음", () => {
  for (const p of R.PATTERNS.comp) for (const key of [0, 4, 7, 9, 10]) {
    const pv = progVoicings(p.opts.prog, key, p.opts.voicing);
    assert.ok(pv.voicings.every(v => v && v.notes.length >= 2), `${p.id} ${key}`);
    const ev = R.barEvents(p, 0, R.withBass(pv.voicings[0]), R.withBass(pv.voicings[1 % pv.voicings.length]));
    assert.ok(ev.length >= 1, p.id);
  }
});

test("리듬 읽기 문제: 생성 패턴도 규칙 통과, 주제 특징 포함", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    for (const t of R.GENERATED_TOPICS) {
      const p = R.generatePattern(t, rand);
      assert.deepEqual(R.validatePattern(p), [], `${t} ${p.tokens.join("")}`);
      if (t === "rest") assert.ok(p.tokens.includes("r"));
      if (t === "syncopation") assert.ok(p.tokens.some((c, k) => c === "u" && p.tokens[k + 1] === "." ));
      if (t === "16beat") assert.equal(p.grid, 16);
    }
  }
  const q = R.readingPrompt(["shuffle"], rand);
  assert.equal(q.opts.swing, true);
});

test("프레이즈 25개: 길이 = 마디 배수, 코드 수 = 마디 수, 반주 생성", () => {
  assert.equal(R.PHRASE_LIST.length, 25);
  for (const ph of R.PHRASE_LIST) {
    assert.deepEqual(R.validatePhrase(ph), [], ph.id);
    const song = buildBacking({ prog: { bars: ph.prog, style: ph.style }, key: ph.key, style: ph.style, comp: false });
    assert.equal(song.bars.length, ph.bars, ph.id);
    const n = Array.from({ length: ph.bars }, (_, b) => R.phraseBarEvents(ph, b).length).reduce((a, x) => a + x, 0);
    assert.equal(n, ph.events.filter(e => !e.rest).length, ph.id);
  }
  // SC-04: 첫 마디 4박 뒷박 F♯(2번 줄 7프렛)이 다음 마디로 이어짐
  const sc = R.PHRASE_LIST.find(p => p.id === "SC-04");
  const fs = sc.events.find(e => e.at === 42);
  assert.equal(fs.notes[0].f, 7);
  assert.ok(fs.at + fs.dur > 48);
});

test("코드 표: 근음·교대 베이스가 모양의 음과 맞음", () => {
  for (const ch of ["G", "C", "D", "Em", "Am", "F", "E", "A", "B7", "Bm", "Dm"]) {
    const v = R.chordVoicing(ch);
    assert.equal(v.bass.midi % 12, v.pc, ch);
    const sf = v.frets[v.bass.s - 1];
    assert.equal(sf, v.bass.f, ch);
  }
});
