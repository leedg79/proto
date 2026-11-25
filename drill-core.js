// Scales S1~S4 연습 규칙 (순수 함수)
// S1 모양 익히기: 블록(모드는 포지션) 차례로
// 근음 위치·근음 이동·모드 전환: 고른 구간 안에 모양을 배치한 문제 묶음(지판 없이 지시 → 확인)
// 시작음 바꿔 치기: 지정한 줄·음(또는 도수)에서 한 옥타브 오르내리기

import { SCALES, KEY_LIST, blocks, positions, sequence, scalePcs, keyName, scaleTitle, degreeOf } from "../../theory/scales.js";
import { TUNING } from "../../theory/notes.js";

const mod = n => ((n % 12) + 12) % 12;
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function shuffle(a, rand = Math.random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const shapeNotes = b => b.notes.map(n => ({ s: n.s, f: n.f, label: n.label, root: n.root, midi: n.midi }));
const viewOf = b => { const from = Math.max(0, b.lo - 1); return { from: from <= 1 ? 0 : from, to: Math.min(18, Math.max(from + 5, b.hi + 1)) }; };

const center = b => (b.lo + b.hi) / 2;

// ── S1 ──
export function shapeSegments(rootPc, scaleId, dir = "updown") {
  const bs = blocks(rootPc, scaleId);
  const word = SCALES[scaleId].mode ? "포지션" : "블록";
  return {
    title: scaleTitle(rootPc, scaleId),
    word,
    segments: bs.map(b => ({
      chip: String(b.index),
      prompt: `${word} ${b.index}`,
      sub: `${b.lo}~${b.hi}프렛`,
      notes: sequence(b, dir),
      shape: shapeNotes(b),
      ...viewOf(b)
    }))
  };
}

// ── S2 ──
export const ROOT_ORDERS = [["fourths", "4도 순환"], ["chromatic", "반음 순환"], ["random", "무작위"]];

export function rootOrder(order, startPc, rand = Math.random) {
  if (order === "random") {
    const r = shuffle(KEY_LIST, rand);
    return r;
  }
  const step = order === "chromatic" ? 1 : 5;
  return Array.from({ length: 12 }, (_, i) => mod(startPc + i * step));
}


// ── S4 ──
// 밝은 순서: 리디안이 가장 밝고 로크리안이 가장 어두움. 이웃한 모드끼리는 한 음만 다름
export const BRIGHTNESS = ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian", "locrian"];
export const MODE_ORDERS = [["bright", "밝은 순 → 어두운 순"], ["dark", "어두운 순 → 밝은 순"], ["random", "무작위"]];

export function modeOrder(modeIds, order, rand = Math.random) {
  const list = BRIGHTNESS.filter(m => modeIds.includes(m));
  if (order === "dark") return list.reverse();
  if (order === "random") return shuffle(list, rand);
  return list;
}

// ── S3 ──
// 시작음에서 한 옥타브 오르내리는(또는 내리고 오르는) 경로. 시작음이 들어 있는 블록 안에서만
export function octaveRun(rootPc, scaleId, s, f) {
  const n = SCALES[scaleId].steps.length;
  const m = TUNING[s - 1] + f;
  let best = null;
  const all = [];
  for (const b0 of blocks(rootPc, scaleId)) for (const d of [-12, 0, 12]) if (b0.lo + d >= 0 && b0.hi + d <= 17) all.push(d ? shiftBlock(b0, d) : b0);
  for (const b of all) {
    if (!b.notes.some(x => x.s === s && x.f === f)) continue;
    const byMidi = new Map(b.notes.map(x => [x.midi, x]));
    for (const up of [true, false]) {
      const range = b.notes.filter(x => (up ? x.midi >= m && x.midi <= m + 12 : x.midi <= m && x.midi >= m - 12)).sort((a, c) => (up ? a.midi - c.midi : c.midi - a.midi));
      if (range.length !== n + 1 || !byMidi.has(up ? m + 12 : m - 12)) continue;
      if (range[0].s !== s || range[0].f !== f) continue;
      const cand = { up, block: b, notes: [...range, ...[...range].reverse().slice(1)] };
      // 위로 갈 수 있으면 위로, 같은 방향이면 시작음이 블록 가운데 쪽인 것
      const score = (up ? 0 : 10) + Math.abs(f - center(b));
      if (!best || score < best.score) best = { ...cand, score };
    }
  }
  return best;
}

// 시작음을 다른 음으로 바꿔 친 음 배열이 어떤 스케일과 같은지 (예: D 도리안을 G에서 → G 믹솔리디안)
export function relatedScale(rootPc, scaleId, semi) {
  const sc = SCALES[scaleId];
  const rot = sc.steps.map(x => mod(x - semi)).sort((a, b) => a - b);
  const key = rot.join(",");
  const pref = sc.mode || ["major", "natural-minor"].includes(scaleId) ? ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"] : [];
  const ids = [...pref, ...Object.keys(SCALES).filter(id => !pref.includes(id))].filter(id => !SCALES[id].chord || sc.chord);
  const hit = ids.find(id => SCALES[id].steps.join(",") === key);
  return hit ? scaleTitle(mod(rootPc + semi), hit) : null;
}

export const START_LEVELS = [["easy", "줄 + 음 이름"], ["hard", "줄 + 도수"]];
export const TIME_MIN = 5, TIME_MAX = 40, TIME_DEFAULT = 15;
export const clampTime = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(TIME_MAX, Math.max(TIME_MIN, n)) : TIME_DEFAULT; };

// 스케일의 모든 음에서 한 번씩 시작하는 문제 묶음 = 완료 1회
export function startDeck(rootPc, scaleId, rand = Math.random, regionId = null) {
  const steps = shuffle(SCALES[scaleId].steps, rand);
  let lastString = 0;
  return steps.map(semi => {
    const pc = mod(rootPc + semi);
    const region = regionId ? regionRange(regionId, rand) : null;
    const collect = (maxF, avoid, inRegion) => {
      const out = [];
      for (let s = 6; s >= 1; s--) for (let f = 0; f <= maxF; f++) {
        if (inRegion && (f < region.lo || f > region.hi)) continue;
        if (mod(TUNING[s - 1] + f) !== pc || s === avoid) continue;
        const run = octaveRun(rootPc, scaleId, s, f);
        if (run && (!inRegion || (run.block.lo >= region.lo - 2 && run.block.hi <= region.hi + 2))) out.push({ s, f, run, w: s >= 4 ? 2 : 1 });
      }
      return out;
    };
    let opts = region ? collect(17, lastString, true) : [];
    if (!opts.length && region) opts = collect(17, 0, true);
    if (!opts.length) opts = collect(12, lastString);
    if (!opts.length) opts = collect(15, 0);
    if (!opts.length) return null;
    const total = opts.reduce((a, o) => a + o.w, 0);
    let r = rand() * total, pick = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
    lastString = pick.s;
    return {
      rootPc, scaleId, semi, s: pick.s, f: pick.f,
      noteName: keyName(pc, scaleId),
      degree: degreeOf(semi, scaleId),
      up: pick.run.up,
      notes: pick.run.notes.map(n => ({ s: n.s, f: n.f, label: n.label, root: n.root, midi: n.midi })),
      shape: pick.run.block.notes.map(n => ({ s: n.s, f: n.f, label: n.label, root: n.root })),
      related: semi === 0 ? null : relatedScale(rootPc, scaleId, semi),
      region
    };
  }).filter(Boolean);
}

export { NAMES };

// ── 연습 구간(프렛 범위) ──
// 세션 시작 때 고른 구간 안에 모든 문제의 모양을 배치함
export const REGIONS = [["0-4", "0~4프렛"], ["2-6", "2~6프렛"], ["5-9", "5~9프렛"], ["7-11", "7~11프렛"], ["9-13", "9~13프렛"], ["12-16", "12~16프렛"], ["random", "문제마다 무작위"]];
export function regionRange(id, rand = Math.random) {
  const fixed = REGIONS.filter(r => r[0] !== "random");
  const pick = id === "random" || !fixed.some(r => r[0] === id) ? (id === "random" ? fixed[Math.floor(rand() * fixed.length)][0] : "5-9") : id;
  const [lo, hi] = pick.split("-").map(Number);
  return { id: pick, lo, hi, label: `${lo}~${hi}프렛` };
}

const shiftBlock = (b, d) => ({ ...b, notes: b.notes.map(n => ({ ...n, f: n.f + d })), lo: b.lo + d, hi: b.hi + d });

// 구간 가운데에 가장 가까운 모양(블록·포지션, 12프렛 위아래 같은 모양 포함)
export function placeIn(rootPc, scaleId, region) {
  const cands = [];
  for (const b of blocks(rootPc, scaleId)) for (const d of [-12, 0, 12]) {
    if (b.lo + d < 0 || b.hi + d > 17) continue;
    cands.push(d ? shiftBlock(b, d) : b);
  }
  const mid = (region.lo + region.hi) / 2;
  const out = r => Math.max(0, region.lo - r.lo) + Math.max(0, r.hi - region.hi);
  return cands.sort((a, b) => out(a) * 2 + Math.abs(center(a) - mid) - (out(b) * 2 + Math.abs(center(b) - mid)) || a.lo - b.lo)[0];
}

const promptView = b => { let from = Math.max(0, b.lo - 1); if (from <= 1) from = 0; return { from, to: Math.max(from + 5, b.hi + 1) }; };

// 근음 문제 묶음: order = random(근음 위치 익히기) | fourths | chromatic(근음 이동)
export function rootDeck({ scaleId, order = "random", startPc = 0, regionId = "5-9" }, rand = Math.random) {
  return rootOrder(order, startPc, rand).map(pc => {
    const region = regionRange(regionId, rand);
    const b = placeIn(pc, scaleId, region);
    return {
      kind: "root", scaleId, rootPc: pc, region,
      title: scaleTitle(pc, scaleId), main: keyName(pc, scaleId), sub: `${region.label}에서 · ${SCALES[scaleId].name}`,
      shape: shapeNotes(b), lo: b.lo, hi: b.hi, answer: `${SCALES[scaleId].mode ? "포지션" : "블록"} ${b.index} · ${b.lo}~${b.hi}프렛`,
      ...promptView(b)
    };
  });
}

// 모드 문제 묶음: 근음 고정, 모드를 순서대로. 앞 모드와 달라진 음 표시
export function modeDeck({ rootPc, modes, regionId = "5-9" }, rand = Math.random) {
  let prev = null;
  return modes.map(m => {
    const region = regionRange(regionId, rand);
    const b = placeIn(rootPc, m, region);
    const prevPcs = prev ? new Set(scalePcs(rootPc, prev)) : null;
    const changed = prevPcs ? b.notes.filter(n => !prevPcs.has(mod(n.midi))).map(n => `${n.s}-${n.f}`) : [];
    const changedDeg = prevPcs ? scalePcs(rootPc, m).filter(x => !prevPcs.has(x)).map(x => degreeOf(x - rootPc, m)) : [];
    const p = {
      kind: "mode", scaleId: m, rootPc, region,
      title: `${keyName(rootPc, "major")} 근음 · 모드 전환`, main: SCALES[m].name, sub: `${region.label}에서 · ${keyName(rootPc, m)} ${SCALES[m].name}`,
      shape: shapeNotes(b), changed, lo: b.lo, hi: b.hi,
      answer: prev ? (changedDeg.length ? `${SCALES[prev].name}에서 바뀐 음: ${changedDeg.join("·")}` : `${SCALES[prev].name}와 같은 음`) : `${b.lo}~${b.hi}프렛`,
      ...promptView(b)
    };
    prev = m;
    return p;
  });
}
