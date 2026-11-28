import { test } from "node:test";
import assert from "node:assert/strict";
import { yin, nearestNote, chroma, chordScore, midiToFreq } from "../js/eval/pitch-core.js";
import * as E from "../js/eval/eval-core.js";
import { chordTarget, scaleTarget, lickSeq, midisOf, beatLabel } from "../js/eval/targets.js";
import { addEval, createSession, finish, begin } from "../js/core/clock.js";

const SR = 48000;
// 기타 같은 소리: 기본음 + 배음(감쇠)
function tone(freq, n = 2048, harmonics = [1, 0.6, 0.4, 0.25, 0.15]) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = harmonics.reduce((a, h, k) => a + h * Math.sin(2 * Math.PI * freq * (k + 1) * i / SR), 0) * 0.2;
  return b;
}
// 단순 DFT 크기(테스트용, 저역만)
function mag(buf, fft = 4096) {
  const out = new Float32Array(fft / 2);
  const x = new Float32Array(fft); x.set(buf.subarray(0, Math.min(buf.length, fft)));
  for (let i = 0; i < fft; i++) x[i] *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fft - 1));
  for (let k = 1; k < 200; k++) { let re = 0, im = 0; for (let i = 0; i < fft; i++) { const a = 2 * Math.PI * k * i / fft; re += x[i] * Math.cos(a); im -= x[i] * Math.sin(a); } out[k] = Math.hypot(re, im); }
  return out;
}

test("YIN: 기타 음역 단음 음 높이", () => {
  for (const m of [40, 45, 52, 57, 64, 69, 76, 84]) {
    const r = yin(tone(midiToFreq(m)), SR);
    assert.equal(nearestNote(r.freq).midi, m, `midi ${m}`);
    assert.ok(r.clarity > 0.85);
  }
  // 무음·잡음은 신뢰도 낮음
  const noise = Float32Array.from({ length: 2048 }, () => Math.random() * 0.02 - 0.01);
  const z = yin(noise, SR);
  assert.ok(z.freq === 0 || z.clarity < 0.82);
});

test("크로마: 코드 구성음 판정", () => {
  const mix = ms => { const b = new Float32Array(4096); for (const m of ms) { const t = tone(midiToFreq(m), 4096); for (let i = 0; i < 4096; i++) b[i] += t[i]; } return b; };
  const cMaj = chroma(mag(mix([48, 52, 55, 60, 64])), SR, 4096);
  assert.ok(chordScore(cMaj, [0, 4, 7], 0).ok, "C 메이저");
  assert.ok(!chordScore(cMaj, [0, 3, 7], 0).ok, "C 마이너 아님");
  const aMin = chroma(mag(mix([45, 52, 57, 60, 64])), SR, 4096);
  assert.ok(chordScore(aMin, [9, 0, 4], 9).ok, "Am");
  assert.ok(!chordScore(aMin, [2, 6, 9], 2).ok, "D 아님");
});

test("note 대상: 틀린 음 기록 → 맞는 음 시각까지 수행시간", () => {
  let a = E.startAttempt({ kind: "note", label: "E", midis: [52, 64] }, 10);
  a = E.feedNote(a, 53, 10.5).a;
  const r1 = E.feedNote(a, 64, 11.2);
  assert.equal(r1.event, "ok");
  const r = E.finishAttempt(r1.a, 12);
  assert.equal(r.ok, true);
  assert.equal(r.timeMs, 1200);
  assert.deepEqual(r.mistakes, ["F3"]);
  assert.equal(r.score, 0.5);
  const miss = E.finishAttempt(E.startAttempt({ kind: "note", label: "G", pcs: [7] }, 0), 5);
  assert.equal(miss.ok, false);
  assert.ok(miss.mistakes[0].includes("못 찾음"));
});

test("chord 대상: 3프레임 유지 시 통과", () => {
  const T = chordTarget("C", 0, "maj");
  const ch = Array(12).fill(0.01); ch[0] = 0.35; ch[4] = 0.25; ch[7] = 0.3;
  let a = E.startAttempt(T, 0);
  a = E.feedChroma(a, ch, 0.1).a; a = E.feedChroma(a, ch, 0.13).a;
  const r = E.feedChroma(a, ch, 0.16);
  assert.equal(r.event, "ok");
  assert.equal(E.finishAttempt(r.a, 1).timeMs, 160);
});

test("set 대상: 스케일 밖 음·커버", () => {
  const T = scaleTarget("A 마이너 펜타", 9, "minor-penta");
  let a = E.startAttempt(T, 0);
  for (const [m, t] of [[57, 0.5], [60, 0.8], [62, 1], [63, 1.1], [64, 1.3], [67, 1.6]]) a = E.feedNote(a, m, t).a;
  const r = E.finishAttempt(a, 3);
  assert.equal(r.timeMs, 1600);
  assert.deepEqual(r.mistakes, ["Eb"]);
  assert.ok(Math.abs(r.score - 5 / 6) < 1e-9);
  const free = E.finishAttempt({ ...E.startAttempt({ ...T, cover: false }, 0), notes: [{}, {}, {}], wrong: [], covered: [9] }, 1);
  assert.equal(free.score, 1);
});

test("seq 대상: 순서·틀린 위치·벤딩 음 인정", () => {
  const T = lickSeq("릭", [{ notes: [{ s: 2, f: 8 }] }, { notes: [{ s: 3, f: 7 }], bend: 2 }, { notes: [{ s: 2, f: 5 }] }]);
  assert.deepEqual(T.midis, [67, 62, 64]);
  let a = E.startAttempt(T, 0);
  a = E.feedNote(a, 67, 0.1).a;
  a = E.feedNote(a, 62, 0.3).a;
  a = E.feedNote(a, 63, 0.35).a;   // 벤딩 중 지나가는 음
  a = E.feedNote(a, 64, 0.4).a;    // 벤딩 도착음 = 2번째 자리 인정 → 3번째 음 64와 같으므로 여기서 끝나지 않게 확인
  assert.ok(a.idx >= 2);
  a = E.feedNote(a, 60, 0.6).a;
  const r = E.finishAttempt(a, 1);
  assert.ok(r.matched >= 2);
});

test("follow 대상: 제때 맞는 음", () => {
  let a = E.startAttempt({ kind: "follow", label: "멜로디" }, 0);
  a = E.expect(a, 1, "1번째 음", { midis: [64] });
  a = E.expect(a, 1.5, "2번째 음", { midis: [62] });
  a = E.expect(a, 2, "3번째 음", { midis: [60] });
  a = E.feedOnset(a, 1.01); a = E.feedNote(a, 64, 1.06).a;
  a = E.feedOnset(a, 1.52); a = E.feedNote(a, 65, 1.58).a;
  const r = E.finishAttempt(a, 3);
  assert.equal(r.hits, 1);
  assert.equal(r.total, 3);
  assert.deepEqual(r.mistakes, ["2번째 음 다른 음(F)", "3번째 음 놓침"]);
  assert.equal(r.meanMs, 15);
});

test("timing 대상: 놓친 박·불필요한 어택", () => {
  let a = E.startAttempt({ kind: "timing", label: "패턴" }, 0);
  for (const [t, l] of [[1, "1박"], [1.5, "1박 &"], [2, "2박"]]) a = E.expect(a, t, l);
  for (const o of [1.02, 1.49, 1.75]) a = E.feedOnset(a, o);
  const r = E.finishAttempt(a, 3);
  assert.equal(r.hits, 2);
  assert.ok(r.mistakes.includes("놓친 어택 2박"));
  assert.equal(r.meanMs, 15);
  assert.equal(beatLabel(1.5, 0), "1마디 2박 &");
});

test("세션 누적·요약·기록 저장", () => {
  let ev = null;
  ev = E.addRecord(ev, { label: "E", kind: "note", ok: true, score: 1, timeMs: 1000, mistakes: [] });
  ev = E.addRecord(ev, { label: "F", kind: "note", ok: false, score: 0, timeMs: null, mistakes: ["F 못 찾음", "G3"] });
  ev = E.addRecord(ev, { label: "G", kind: "note", ok: true, score: 0.5, timeMs: 2000, mistakes: ["G3"] });
  const sm = E.summary(ev);
  assert.equal(sm.attempts, 3); assert.equal(sm.passed, 2); assert.equal(sm.accuracy, 50);
  assert.equal(sm.avgTimeMs, 1500); assert.equal(sm.mistakes, 3);
  assert.deepEqual(sm.top[0], { label: "G3", n: 2 });
  assert.ok(E.summaryText(sm).includes("정확도 50%"));
  let s = begin(createSession({ module: "notes", level: "n1", task: "finder", type: "finding" }, 1000, () => 0.5, { ready: true }), 1000);
  s = addEval(s, { label: "E", kind: "note", ok: true, score: 1, timeMs: 900, mistakes: [] }, E.addRecord);
  const rec = finish(s, 5000);
  assert.equal(rec.eval.attempts, 1);
  const rec2 = finish(begin(createSession({ module: "notes", level: "n1", task: "finder", type: "finding" }, 1000, () => 0.5, { ready: true }), 1000), 2000);
  assert.equal(rec2.eval, undefined);
});

test("note 대상 허용 위치", () => {
  assert.deepEqual(midisOf([{ s: 6, f: 0 }, { s: 1, f: 0 }, { s: 5, f: 7 }]).sort(), [40, 52, 64].sort());
});

test("count 대상(노트 찾기): 같은 음 이름 6번, 첫 어택~마지막 맞은 어택 시간, 정확도", async () => {
  const { countTarget } = await import("../js/eval/targets.js");
  const E = await import("../js/eval/eval-core.js");
  let a = E.startAttempt(countTarget("C (6현)", 0, 6), 10);
  const hits = [[48, 11], [60, 11.5], [61, 11.8], [60, 12.1], [72, 12.6], [60, 13], [72, 13.4]];
  let last = null;
  for (const [m, t] of hits) { const r = E.feedNote(a, m, t); a = r.a; last = r.event; }
  assert.equal(last, "ok");
  const r = E.finishAttempt(a, 14);
  assert.equal(r.ok, true);
  assert.equal(r.timeMs, 2400);          // 11 → 13.4 (출제 시각 10과 무관)
  assert.ok(Math.abs(r.score - 6 / 7) < 1e-9);
  assert.deepEqual(r.mistakes, ["C#4"]);
  // 못 채우면 미통과 + 남은 음 수
  let b = E.startAttempt(countTarget("D", 2, 4), 0);
  b = E.feedNote(b, 50, 1).a; b = E.feedNote(b, 62, 2).a;
  const rb = E.finishAttempt(b, 3);
  assert.equal(rb.ok, false); assert.deepEqual(rb.mistakes, ["2음 못 침"]); assert.equal(rb.score, 0.5);
});

test("순서 대상은 기본으로 옥타브 오인식을 틀림으로 치지 않음", async () => {
  const { seqTarget } = await import("../js/eval/targets.js");
  const E = await import("../js/eval/eval-core.js");
  let a = E.startAttempt(seqTarget("A 마이너 펜타", [{ s: 6, f: 5 }, { s: 6, f: 8 }]), 0);
  a = E.feedNote(a, 45 + 12, 1).a;   // 한 옥타브 위로 들림
  const r = E.feedNote(a, 48, 2);
  assert.equal(r.event, "ok");
  assert.equal(E.finishAttempt(r.a, 3).ok, true);
});
