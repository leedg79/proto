// Technique 엔진 (순수 함수): 연습곡 해석, 기대 어택 시각, 박자 판정, 템포 사다리
import { TECH, TECH_TOPIC_NAMES } from "./tech-data.js";
import { parseToken } from "../licks/lick-core.js";

export { TECH_TOPIC_NAMES };

function build([id, level, topic, name, str, bpm, tip]) {
  const events = str.trim().split(/\s+/).map(parseToken);
  let t = 0;
  for (const e of events) { e.at = t; t += e.dur; }
  return { id, level, topic, name, events, ticks: t, bars: Math.ceil(t / 48), bpm: { start: bpm[0], target: bpm[1] }, tip, feel: "straight" };
}
export const EXERCISES = TECH.map(build);
export const exerciseById = id => EXERCISES.find(x => x.id === id) || null;
export function exercisesFor(level, topics) {
  const all = EXERCISES.filter(x => x.level === level);
  const t = (topics || []).filter(x => all.some(e => e.topic === x));
  return t.length ? all.filter(e => t.includes(e.topic)) : all;
}

// 피킹 음인지(판정 대상): 쉼표·해머온·풀오프·슬라이드·벤딩 내리기는 제외
export const isPicked = e => !e.rest && !e.h && !e.p && !e.sl && !e.rel;

export function validateExercise(x) {
  const errs = [];
  if (x.ticks % 48 !== 0) errs.push(`길이 ${x.ticks}틱이 마디(48틱)의 배수가 아님`);
  if (x.bars < 1 || x.bars > 2) errs.push(`${x.bars}마디`);
  if (!x.events.some(isPicked)) errs.push("피킹 음 없음");
  if (!(x.bpm.start >= 40 && x.bpm.target > x.bpm.start && x.bpm.target <= 200)) errs.push("권장 BPM");
  for (const e of x.events) for (const n of e.notes) if (n.s < 1 || n.s > 6 || n.f < 0 || n.f > 17) errs.push(`음 위치 ${n.s}-${n.f}`);
  return errs;
}

// 판정할 한 번(run) = 연습곡을 loops번 반복. 기대 어택: 첫 박 기준 초 단위
// 결과 [{ t, idx(연습곡 안 이벤트 번호), loop, optional }]
export function expectedOnsets(x, bpm, loops = 1) {
  const spb = 60 / bpm;
  const out = [];
  for (let l = 0; l < loops; l++) x.events.forEach((e, idx) => {
    if (e.rest) return;
    out.push({ t: ((l * x.ticks + e.at) / 12) * spb, idx, loop: l, optional: !isPicked(e) });
  });
  return out;
}

// 판정 창: 가장 짧은 어택 간격의 40% (최대 90ms)
export function windowFor(expected) {
  const req = expected.filter(e => !e.optional).map(e => e.t);
  let gap = Infinity;
  for (let i = 1; i < req.length; i++) gap = Math.min(gap, req[i] - req[i - 1]);
  return Math.min(0.09, Number.isFinite(gap) ? gap * 0.4 : 0.09);
}

export const GOOD_MS = 25, OK_MS = 50;
// 통과 기준: 필수 어택의 90% 이상을 창 안에서 침, 그중 80% 이상이 ±50ms 안, 평균 오차 40ms 이하, 불필요한 어택은 필수 수의 5% 또는 1개까지
export const PASS = { hit: 0.9, within: 0.8, meanMs: 40, extraRate: 0.05 };

// detected: 첫 박 기준 초(지연 보정이 끝난 값). 가까운 것부터 한 번씩만 짝지음
export function judge(expected, detected, { window = windowFor(expected) } = {}) {
  const det = [...detected].sort((a, b) => a - b);
  const used = new Array(det.length).fill(false);
  const pairs = [];
  expected.forEach((e, k) => det.forEach((d, j) => { const dt = d - e.t; if (Math.abs(dt) <= window) pairs.push({ k, j, dt }); }));
  pairs.sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt));
  const match = new Array(expected.length).fill(null);
  for (const p of pairs) { if (match[p.k] != null || used[p.j]) continue; match[p.k] = p.dt; used[p.j] = true; }
  const notes = expected.map((e, k) => ({ ...e, dt: match[k] }));
  const req = notes.filter(n => !n.optional);
  const hits = req.filter(n => n.dt != null);
  const absMs = hits.map(n => Math.abs(n.dt) * 1000);
  const meanMs = absMs.length ? absMs.reduce((a, x) => a + x, 0) / absMs.length : null;
  const signedMs = hits.length ? hits.reduce((a, n) => a + n.dt * 1000, 0) / hits.length : null;
  const first = expected.length ? expected[0].t - window : 0, last = expected.length ? expected[expected.length - 1].t + window : 0;
  // 연주 구간 밖(준비 박·끝난 뒤)의 소리는 불필요한 어택으로 세지 않음
  const extras = det.filter((d, j) => !used[j] && d >= first && d <= last).length;
  const hitRate = req.length ? hits.length / req.length : 0;
  const within = hits.length ? absMs.filter(x => x <= OK_MS).length / hits.length : 0;
  const allowed = Math.max(1, Math.floor(req.length * PASS.extraRate));
  const pass = hitRate >= PASS.hit && within >= PASS.within && meanMs != null && meanMs <= PASS.meanMs && extras <= allowed;
  return {
    notes, window, required: req.length, hits: hits.length, misses: req.length - hits.length, extras, allowedExtras: allowed,
    hitRate, within, meanMs, signedMs, pass,
    good: absMs.filter(x => x <= GOOD_MS).length, ok: absMs.filter(x => x > GOOD_MS && x <= OK_MS).length, off: absMs.filter(x => x > OK_MS).length
  };
}

// 음표별 등급(여러 번 반복한 결과 중 가장 나쁜 것): good | ok | off | miss
export function gradeByIndex(result) {
  const g = {};
  const rank = { good: 0, ok: 1, off: 2, miss: 3 };
  for (const n of result.notes) {
    if (n.optional) continue;
    const v = n.dt == null ? "miss" : Math.abs(n.dt) * 1000 <= GOOD_MS ? "good" : Math.abs(n.dt) * 1000 <= OK_MS ? "ok" : "off";
    if (!(n.idx in g) || rank[v] > rank[g[n.idx]]) g[n.idx] = v;
  }
  return g;
}

// 템포 사다리: 통과하면 step만큼 올리고(목표·최대 200 넘지 않게), 2번 연속 실패하면 step만큼 내림(시작 BPM 아래로는 40까지)
export function ladder(state, passed, step) {
  const s = { bpm: state.bpm, fails: state.fails || 0, best: state.best || 0 };
  if (passed) { s.best = Math.max(s.best, s.bpm); s.bpm = Math.min(200, s.bpm + step); s.fails = 0; }
  else { s.fails += 1; if (s.fails >= 2) { s.bpm = Math.max(40, s.bpm - step); s.fails = 0; } }
  return s;
}

// 박자 보정: 클릭 시각들과 감지 어택을 짝지어 지연(초) 중앙값
export function latencyFrom(clicks, onsets, maxDev = 0.25) {
  const devs = [];
  for (const c of clicks) {
    let best = null;
    for (const o of onsets) { const d = o - c; if (d > -0.1 && d < maxDev && (best == null || Math.abs(d) < Math.abs(best))) best = d; }
    if (best != null) devs.push(best);
  }
  if (devs.length < Math.ceil(clicks.length * 0.6)) return null;
  devs.sort((a, b) => a - b);
  return { latency: devs[Math.floor(devs.length / 2)], matched: devs.length, spread: devs[devs.length - 1] - devs[0] };
}

// 연습곡을 반복한 재생용 이벤트(시연)
export function loopEvents(x, loops) {
  const out = [];
  for (let l = 0; l < loops; l++) for (const e of x.events) out.push({ ...e, at: e.at + l * x.ticks });
  return { events: out, ticks: x.ticks * loops, feel: x.feel };
}

// 감도: 민감(앰프 없는 일렉처럼 작은 소리), 보통, 둔감(잡음이 많은 곳). ratio = 직전 울림 대비 배수, floorMul = 보정 소음 기준 배수
export const SENS = {
  high: { label: "민감", ratio: 2.8, floorMul: 0.35 },
  mid: { label: "보통", ratio: 4, floorMul: 1 },
  low: { label: "둔감", ratio: 6, floorMul: 2.5 }
};
export const sensOf = id => SENS[id] || SENS.mid;
