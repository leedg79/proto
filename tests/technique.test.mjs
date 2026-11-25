// Technique: 연습곡 데이터, 어택 감지, 박자 판정, 템포 사다리, 지연 보정
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../js/modules/technique/tech-core.js";
import { detectOnsets, floorFromNoise } from "../js/audio/onset-core.js";
import { topicsFor, MODULES } from "../js/data/catalog.js";

test("연습곡 55개: 길이·음 위치·권장 BPM 통과, 레벨 주제마다 연습곡", () => {
  assert.equal(T.EXERCISES.length, 55);
  for (const x of T.EXERCISES) assert.deepEqual(T.validateExercise(x), [], x.id);
  assert.equal(new Set(T.EXERCISES.map(x => x.id)).size, T.EXERCISES.length);
  const m = MODULES.find(x => x.id === "technique");
  assert.deepEqual(m.levels.map(l => l.id), ["t1", "t2", "t3", "t4", "t5"]);
  for (const l of m.levels) for (const tp of topicsFor("technique", l.id, "drill")) assert.ok(T.exercisesFor(l.id, [tp.id]).every(x => x.topic === tp.id) && T.exercisesFor(l.id, [tp.id]).length >= 1, `${l.id}/${tp.id}`);
});

test("기대 어택: 쉼표·해머온·풀오프·슬라이드·벤딩 내리기는 판정 제외", () => {
  const x = T.exerciseById("TG-01"); // 피킹 + 해머온 번갈아
  const ex = T.expectedOnsets(x, 120, 1);
  assert.equal(ex.length, 8);
  assert.equal(ex.filter(e => !e.optional).length, 4);
  assert.deepEqual(ex.filter(e => !e.optional).map(e => e.t), [0, 0.5, 1, 1.5]);
  const b = T.expectedOnsets(T.exerciseById("TB-02"), 60, 2); // 벤딩·내리기·아래 음·쉼표
  assert.deepEqual(b.filter(e => !e.optional).map(e => e.t), [0, 2, 4, 6]);
  assert.equal(b.length, 6);
});

test("판정: 정확하면 통과, 늦게 치거나 빠뜨리거나 쉼표에서 치면 실패", () => {
  const x = T.exerciseById("TA-01"); // 16분 16개
  const ex = T.expectedOnsets(x, 100, 2);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const perfect = ex.map(e => e.t + (rnd() - 0.5) * 0.03);
  const r1 = T.judge(ex, perfect);
  assert.equal(r1.pass, true);
  assert.equal(r1.hits, 32);
  assert.ok(r1.meanMs < 10);
  // 전체가 55ms 늦음 → 창 안에는 들지만 ±50ms 비율 미달
  const late = T.judge(ex, ex.map(e => e.t + 0.055));
  assert.equal(late.pass, false);
  assert.ok(late.signedMs > 50);
  // 4개 빠뜨림 → 박에 맞춘 비율 87.5% < 90%
  const miss = T.judge(ex, perfect.filter((_, i) => i % 8 !== 3));
  assert.equal(miss.misses, 4);
  assert.equal(miss.pass, false);
  // 쉼표 자리에서 친 소리 = 불필요한 어택
  const sx = T.exerciseById("TQ-01");
  const se = T.expectedOnsets(sx, 80, 2);
  const restHits = se.map(e => e.t).concat([0.375, 1.125, 1.875]);
  const rr = T.judge(se, restHits);
  assert.equal(rr.extras, 3);
  assert.equal(rr.pass, false);
  // 준비 박의 소리는 세지 않음
  assert.equal(T.judge(se, [-1.5, -0.75, ...se.map(e => e.t)]).extras, 0);
});

test("판정 창: 가장 짧은 어택 간격의 40%, 최대 90ms", () => {
  const ex16 = T.expectedOnsets(T.exerciseById("TA-01"), 120, 1);
  assert.ok(Math.abs(T.windowFor(ex16) - 0.125 * 0.4) < 1e-9);
  assert.equal(T.windowFor(T.expectedOnsets(T.exerciseById("TV-01"), 60, 1)), 0.09);
});

test("템포 사다리: 통과 → +step·최고 기록, 2번 연속 실패 → −step", () => {
  let s = { bpm: 80, fails: 0, best: 0 };
  s = T.ladder(s, true, 4); assert.deepEqual(s, { bpm: 84, fails: 0, best: 80 });
  s = T.ladder(s, false, 4); assert.equal(s.bpm, 84);
  s = T.ladder(s, false, 4); assert.equal(s.bpm, 80);
  assert.equal(T.ladder({ bpm: 198, fails: 0, best: 0 }, true, 4).bpm, 200);
  assert.equal(T.ladder({ bpm: 42, fails: 1, best: 0 }, false, 4).bpm, 40);
});

test("지연 보정: 클릭과 어택 차이의 중앙값, 절반 넘게 못 잡으면 실패", () => {
  const clicks = Array.from({ length: 8 }, (_, k) => 1 + k * 0.75);
  const r = T.latencyFrom(clicks, clicks.map((c, k) => c + 0.07 + (k % 3) * 0.004));
  assert.ok(Math.abs(r.latency - 0.074) < 0.005);
  assert.equal(r.matched, 8);
  assert.equal(T.latencyFrom(clicks, clicks.slice(0, 3).map(c => c + 0.05)), null);
});

// 합성 기타 소리: 어택 순간 잡음 + 감쇠 배음. 앞 음이 계속 울리는 상태에서도 새 어택만 잡는지
function synth(times, { sr = 48000, dur = 3, amp = [0.3, 0.6], tau = 0.6, noise = 0.002 } = {}) {
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = new Float32Array(sr * dur);
  for (let i = 0; i < out.length; i++) out[i] = (rnd() - 0.5) * noise;
  times.forEach((t0, k) => {
    const f = 110 * Math.pow(2, ((k * 5) % 24) / 12), A = amp[0] + (amp[1] - amp[0]) * rnd(), start = Math.round(t0 * sr);
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / sr; let v = 0;
      for (let h = 1; h <= 6; h++) v += (Math.sin(2 * Math.PI * f * h * t) / h) * Math.exp(-t / (tau / h));
      if (t < 0.004) v += (rnd() - 0.5) * 1.5 * (1 - t / 0.004);
      out[i] += A * v * 0.3;
    }
  });
  return out;
}

test("어택 감지: 16분(120·160 BPM)·작은 음·팜뮤트에서 빠짐·중복 없이 ±5ms", () => {
  const cases = [
    Array.from({ length: 16 }, (_, i) => 0.3 + i * 0.125),
    Array.from({ length: 16 }, (_, i) => 0.3 + i * 0.09375),
    Array.from({ length: 8 }, (_, i) => 0.3 + i * 0.25)
  ];
  for (const times of cases) for (const opt of [{}, { amp: [0.15, 0.6] }, { tau: 0.08 }]) {
    const d = detectOnsets(synth(times, opt), 48000, { floor: 2e-6 });
    assert.equal(d.length, times.length, JSON.stringify(opt));
    d.forEach((x, i) => assert.ok(Math.abs(x - times[i]) < 0.005, `${x} vs ${times[i]}`));
  }
  // 조용한 구간(소음만)에서는 어택 없음
  assert.equal(detectOnsets(synth([], { dur: 1 }), 48000, { floor: 2e-6 }).length, 0);
  assert.ok(floorFromNoise([1e-8, 2e-8, 3e-8]) >= 2e-6);
});
