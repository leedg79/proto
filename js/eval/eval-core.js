// 연주 평가 판정·기록 (순수 함수)
// 대상(target) 종류
//  note   : { kind:"note", label, midis:[허용 MIDI] | pcs:[음 이름 번호] }   → 맞는 음이 처음 잡힌 시각까지 = 수행시간
//  count  : { kind:"count", label, pcs, need }                         → 맞는 음 이름을 need번 침, 첫 어택~마지막 맞은 어택 = 수행시간, 정확도 = 맞은 음 ÷ 친 음
//  chord  : { kind:"chord", label, pcs, root }                          → 구성음이 잠깐(3프레임) 유지되면 성공
//  set    : { kind:"set", label, pcs, root }                            → 스케일 안의 음 비율 × 구성음 커버
//  seq    : { kind:"seq", label, midis:[순서], octaveFree }              → 순서대로 맞힌 음, 틀린 위치 기록
//  timing : { kind:"timing", label, window }  + expect(t) 로 박 위치 추가 → 어택 박자 일치율
//  follow : { kind:"follow", label }  + expect(t, label, { midis }) 로 음마다 추가 → 제때 맞는 음을 쳤는지(박자 + 음 높이)
import { chordScore } from "./pitch-core.js";

const mod = n => ((n % 12) + 12) % 12;
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const noteName = midi => NAMES[mod(midi)] + (Math.floor(midi / 12) - 1);
export const pcName = pc => NAMES[mod(pc)];

export function startAttempt(target, t0) {
  return { target, t0, firstT: null, lastT: null, doneT: null, ok: false, notes: [], wrong: [], idx: 0, hits: 0, chordRun: 0, covered: [], expected: [], onsets: [], finished: false };
}

// 음 하나가 잡혔을 때 → { a, event: "ok"|"wrong"|"progress"|null }
export function feedNote(a, midi, t) {
  if (a.finished) return { a, event: null };
  const T = a.target;
  const n = { ...a, notes: [...a.notes, { midi, t }], firstT: a.firstT ?? t, lastT: t };
  if (T.kind === "note") {
    const hit = T.midis ? T.midis.includes(midi) : T.pcs.map(mod).includes(mod(midi));
    if (hit) return { a: { ...n, ok: true, doneT: t, finished: true }, event: "ok" };
    return { a: { ...n, wrong: [...n.wrong, noteName(midi)] }, event: "wrong" };
  }
  if (T.kind === "count") {
    const hit = T.pcs.map(mod).includes(mod(midi));
    if (!hit) return { a: { ...n, wrong: [...n.wrong, noteName(midi)] }, event: "wrong" };
    const hits = (a.hits || 0) + 1;
    const fin = hits >= (T.need || 1);
    return { a: { ...n, hits, doneT: t, ok: fin, finished: fin }, event: fin ? "ok" : "progress" };
  }
  if (T.kind === "set") {
    const inSet = T.pcs.map(mod).includes(mod(midi));
    if (!inSet) return { a: { ...n, wrong: [...n.wrong, pcName(midi)] }, event: "wrong" };
    const covered = n.covered.includes(mod(midi)) ? n.covered : [...n.covered, mod(midi)];
    const all = covered.length >= new Set(T.pcs.map(mod)).size;
    return { a: { ...n, covered, doneT: all && n.doneT == null ? t : n.doneT }, event: "progress" };
  }
  if (T.kind === "seq") {
    if (a.idx >= T.midis.length) return { a, event: null };
    // alts[i]: 그 자리에서 인정하는 음(벤딩·슬라이드로 지나가는 음 포함)
    const okAt = (i, m) => {
      const list = (T.alts && T.alts[i]) || [T.midis[i]];
      return T.octaveFree ? list.some(x => mod(x) === mod(m)) : list.includes(m);
    };
    const want = T.midis[a.idx];
    // 바로 앞 음(또는 그 벤딩 음)을 다시 친 것은 틀림으로 세지 않음(지속음·재어택)
    if (!okAt(a.idx, midi) && a.idx > 0 && okAt(a.idx - 1, midi)) return { a, event: null };
    if (okAt(a.idx, midi)) {
      const idx = a.idx + 1;
      const fin = idx >= T.midis.length;
      return { a: { ...n, idx, ok: fin, doneT: fin ? t : null, finished: fin }, event: fin ? "ok" : "progress" };
    }
    return { a: { ...n, wrong: [...n.wrong, `${a.idx + 1}번째 음(${pcName(want)} → ${pcName(midi)})`] }, event: "wrong" };
  }
  return { a: n, event: null };
}

// 크로마 한 프레임 (코드 대상)
export function feedChroma(a, ch, t, energyOk = true) {
  if (a.finished || a.target.kind !== "chord" || !energyOk) return { a, event: null };
  const r = chordScore(ch, a.target.pcs, a.target.root);
  const firstT = a.firstT ?? t;
  if (r.ok) {
    const run = a.chordRun + 1;
    if (run >= 3) return { a: { ...a, firstT, chordRun: run, ok: true, doneT: t, finished: true }, event: "ok" };
    return { a: { ...a, firstT, chordRun: run }, event: null };
  }
  // 소리는 나는데 구성음이 맞지 않는 프레임이 이어지면 틀림 1회
  const miss = (a.missRun || 0) + 1;
  if (miss === 8) {
    const extra = ch.map((v, p) => [v, p]).filter(([v, p]) => !a.target.pcs.map(mod).includes(p) && v > 0.16).map(([, p]) => pcName(p));
    return { a: { ...a, firstT, chordRun: 0, missRun: 0, wrong: [...a.wrong, extra.length ? `구성음 밖 ${extra.join("·")}` : "구성음 부족"] }, event: "wrong" };
  }
  return { a: { ...a, firstT, chordRun: 0, missRun: miss }, event: null };
}

export function expect(a, t, label = "", extra = {}) { return { ...a, expected: [...a.expected, { t, label, ...extra }] }; }
export function feedOnset(a, t) { return a.finished ? a : { ...a, onsets: [...a.onsets, t], firstT: a.firstT ?? t, lastT: t }; }

// 박 판정: 기대 박마다 가장 가까운 어택(창 안) 1개
export function matchTiming(expected, onsets, win = 0.1) {
  const used = new Set();
  const res = expected.map(e => {
    let best = -1, bd = Infinity;
    onsets.forEach((o, j) => { const d = Math.abs(o - e.t); if (!used.has(j) && d <= win && d < bd) { bd = d; best = j; } });
    if (best >= 0) used.add(best);
    return { ...e, dt: best >= 0 ? onsets[best] - e.t : null };
  });
  const lo = expected.length ? expected[0].t - win : 0, hi = expected.length ? expected[expected.length - 1].t + win : 0;
  const extras = onsets.filter((o, j) => !used.has(j) && o >= lo && o <= hi).length;
  return { res, extras };
}

// 시도 마감 → 기록 1건 { label, kind, ok, score(0~1), timeMs, mistakes[] }
export function finishAttempt(a, t, { minNotes = 0 } = {}) {
  const T = a.target;
  const base = { label: T.label || "", kind: T.kind };
  const timeMs = d => (d == null ? null : Math.max(0, Math.round((d - a.t0) * 1000)));
  if (T.kind === "note" || T.kind === "chord") {
    const tries = a.wrong.length + (a.ok ? 1 : 0);
    return { ...base, ok: a.ok, score: a.ok ? 1 / Math.max(1, tries) : 0, timeMs: a.ok ? timeMs(a.doneT) : null, mistakes: a.ok ? a.wrong : [...a.wrong, `${T.label} 못 찾음`] };
  }
  if (T.kind === "count") {
    const need = T.need || 1, hits = a.hits || 0, tries = hits + a.wrong.length;
    const acc = tries ? hits / tries : 0;
    const score = Math.min(1, hits / need) * acc;
    const miss = hits < need ? [`${need - hits}음 못 침`] : [];
    return { ...base, ok: hits >= need, score, timeMs: hits >= need && a.firstT != null ? Math.max(0, Math.round((a.doneT - a.firstT) * 1000)) : null, mistakes: [...a.wrong, ...miss], hits, total: need };
  }
  if (T.kind === "set") {
    const total = a.notes.length;
    const inRatio = total ? (total - a.wrong.length) / total : 0;
    const cover = T.cover === false ? 1 : a.covered.length / Math.max(1, new Set(T.pcs.map(mod)).size);
    const score = total >= minNotes ? inRatio * cover : 0;
    return { ...base, ok: score >= 0.85, score, timeMs: a.doneT != null ? timeMs(a.doneT) : null, mistakes: a.wrong, notes: total };
  }
  if (T.kind === "seq") {
    const n = T.midis.length;
    const score = n ? (a.idx / n) * (a.idx / Math.max(1, a.idx + a.wrong.length)) : 0;
    const miss = a.idx < n ? [`${a.idx + 1}번째 음부터 못 침`] : [];
    return { ...base, ok: a.ok && a.wrong.length === 0, score, timeMs: a.firstT != null && a.lastT != null ? Math.round((a.lastT - a.firstT) * 1000) : null, mistakes: [...a.wrong, ...miss], matched: a.idx, total: n };
  }
  if (T.kind === "timing") {
    const { res, extras } = matchTiming(a.expected, a.onsets, T.window || 0.1);
    const hits = res.filter(r => r.dt != null);
    const score = res.length ? hits.length / (res.length + extras) : 0;
    const meanMs = hits.length ? Math.round(hits.reduce((s, r) => s + Math.abs(r.dt), 0) / hits.length * 1000) : null;
    const missed = res.filter(r => r.dt == null).map(r => r.label || "박");
    return { ...base, ok: res.length > 0 && hits.length === res.length && extras <= Math.max(1, Math.floor(res.length * 0.05)), score, timeMs: null, meanMs, mistakes: [...missed.map(m => `놓친 어택 ${m}`), ...(extras ? [`불필요한 어택 ${extras}회`] : [])], hits: hits.length, total: res.length };
  }
  if (T.kind === "follow") return finishFollow(a, base, T);
  return { ...base, ok: false, score: 0, timeMs: null, mistakes: [] };
}

// 따라 치기: 음마다 박 근처(어택 −120ms ~ 음 높이 인식 지연 +260ms)에 맞는 음이 잡혔는지
function finishFollow(a, base, T) {
  const win = T.window || 0.12;
  const usedN = new Set(), usedO = new Set();
  const mistakes = [];
  let good = 0, offSum = 0, offN = 0;
  a.expected.forEach((e, k) => {
    const pcs = (e.midis || []).map(mod);
    const j = a.notes.findIndex((n, j) => !usedN.has(j) && n.t >= e.t - win && n.t <= e.t + 0.26 && (!pcs.length || pcs.includes(mod(n.midi))));
    const oi = a.onsets.reduce((best, o, i) => (!usedO.has(i) && Math.abs(o - e.t) <= win && (best < 0 || Math.abs(o - e.t) < Math.abs(a.onsets[best] - e.t)) ? i : best), -1);
    if (oi >= 0) { usedO.add(oi); offSum += Math.abs(a.onsets[oi] - e.t); offN++; }
    if (j >= 0) { usedN.add(j); good++; return; }
    const near = a.notes.find(n => n.t >= e.t - win && n.t <= e.t + 0.26);
    const lab = e.label || `${k + 1}번째 음`;
    mistakes.push(near ? `${lab} 다른 음(${pcName(near.midi)})` : oi >= 0 ? `${lab} 음 높이 불명` : `${lab} 놓침`);
  });
  const n = a.expected.length;
  return { ...base, ok: n > 0 && good === n, score: n ? good / n : 0, timeMs: null, meanMs: offN ? Math.round((offSum / offN) * 1000) : null, mistakes, hits: good, total: n };
}

// ── 세션 누적 ──
export function emptyEval() { return { attempts: 0, ok: 0, scoreSum: 0, timeSum: 0, timeN: 0, meanMsSum: 0, meanMsN: 0, mistakes: {}, log: [] }; }

export function addRecord(ev, r) {
  const e = ev || emptyEval();
  const mistakes = { ...e.mistakes };
  for (const m of r.mistakes || []) mistakes[m] = (mistakes[m] || 0) + 1;
  // 많이 쌓이면 적게 나온 항목부터 정리
  const keys = Object.keys(mistakes);
  if (keys.length > 60) keys.sort((x, y) => mistakes[x] - mistakes[y]).slice(0, keys.length - 60).forEach(k => delete mistakes[k]);
  const log = [...e.log, { l: r.label, k: r.kind, ok: r.ok ? 1 : 0, s: Math.round((r.score || 0) * 100), t: r.timeMs ?? null, m: (r.mistakes || []).slice(0, 4) }].slice(-200);
  return {
    attempts: e.attempts + 1, ok: e.ok + (r.ok ? 1 : 0), scoreSum: e.scoreSum + (r.score || 0),
    timeSum: e.timeSum + (r.timeMs ?? 0), timeN: e.timeN + (r.timeMs != null ? 1 : 0),
    meanMsSum: e.meanMsSum + (r.meanMs ?? 0), meanMsN: e.meanMsN + (r.meanMs != null ? 1 : 0),
    mistakes, log
  };
}

export function summary(ev) {
  if (!ev || !ev.attempts) return null;
  const top = Object.entries(ev.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => ({ label, n }));
  return {
    attempts: ev.attempts, passed: ev.ok,
    accuracy: Math.round((ev.scoreSum / ev.attempts) * 100),
    avgTimeMs: ev.timeN ? Math.round(ev.timeSum / ev.timeN) : null,
    avgOffsetMs: ev.meanMsN ? Math.round(ev.meanMsSum / ev.meanMsN) : null,
    mistakes: Object.values(ev.mistakes).reduce((a, x) => a + x, 0), top
  };
}

export function summaryText(sm) {
  if (!sm) return "평가 기록 없음";
  const parts = [`${sm.attempts}회 평가`, `정확도 ${sm.accuracy}%`, `통과 ${sm.passed}회`];
  if (sm.avgTimeMs != null) parts.push(`평균 수행 ${(sm.avgTimeMs / 1000).toFixed(1)}초`);
  if (sm.avgOffsetMs != null) parts.push(`박자 오차 평균 ${sm.avgOffsetMs}ms`);
  parts.push(`실수 ${sm.mistakes}회`);
  return parts.join(" · ");
}
