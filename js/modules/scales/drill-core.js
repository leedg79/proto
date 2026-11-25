// Scales S1~S4 연습 규칙 (순수 함수)
// S1 모양 익히기: 블록(모드는 포지션) 차례로
// S2 근음 순환: 스케일 고정, 근음만 바꿔 지금 손 위치에서 가장 가까운 모양으로
// S3 시작음 바꿔 치기: 지정한 줄·음(또는 도수)에서 한 옥타브 오르내리기
// S4 모드 전환: 근음 고정, 모드만 바꿔 같은 위치(6번 줄 근음 포지션)에서

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

const center = b => (b.lo + b.hi) / 2;

// 지금 손 위치(prev 중심 프렛)에서 가장 가까운 모양
export function nearestBlock(rootPc, scaleId, prevCenter) {
  const bs = blocks(rootPc, scaleId).filter(b => b.hi <= 15);
  return bs.sort((a, b) => Math.abs(center(a) - prevCenter) - Math.abs(center(b) - prevCenter) || a.lo - b.lo)[0];
}

export function rootSegments(scaleId, roots, dir = "updown", startCenter = 6) {
  let c = startCenter;
  const word = SCALES[scaleId].mode ? "포지션" : "블록";
  const segments = roots.map(pc => {
    const b = nearestBlock(pc, scaleId, c);
    c = center(b);
    return {
      chip: keyName(pc, scaleId),
      prompt: keyName(pc, scaleId),
      sub: `${scaleTitle(pc, scaleId)} · ${word} ${b.index} · ${b.lo}~${b.hi}프렛`,
      notes: sequence(b, dir),
      shape: shapeNotes(b),
      rootPc: pc,
      ...viewOf(b)
    };
  });
  return { title: `${SCALES[scaleId].name} · 근음 순환`, word, segments };
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

// 6번 줄 근음에서 시작하는 포지션(포지션 1)
export function rootPosition(rootPc, modeId) {
  return positions(rootPc, modeId)[0];
}

export function modeSegments(rootPc, modes, dir = "updown") {
  let prev = null;
  const segments = modes.map(m => {
    const p = rootPosition(rootPc, m);
    const pcs = new Set(scalePcs(rootPc, m));
    const prevPcs = prev ? new Set(scalePcs(rootPc, prev)) : null;
    const changed = prevPcs ? p.notes.filter(n => !prevPcs.has(mod(n.midi))).map(n => `${n.s}-${n.f}`) : [];
    const changedDeg = prevPcs ? [...pcs].filter(x => !prevPcs.has(x)).map(x => degreeOf(x - rootPc, m)) : [];
    const seg = {
      chip: SCALES[m].name.slice(0, 3),
      prompt: SCALES[m].name,
      sub: prev ? (changedDeg.length ? `${SCALES[prev].name}에서 바뀐 음: ${changedDeg.join("·")}` : `${SCALES[prev].name}와 같은 음`) : `${keyName(rootPc, m)} 근음 · 6번 줄 ${p.lo}프렛부터`,
      notes: sequence(p, dir),
      shape: shapeNotes(p),
      changed,
      modeId: m,
      ...viewOf(p)
    };
    prev = m;
    return seg;
  });
  return { title: `${keyName(rootPc, "major")} 근음 · 모드 전환`, word: "모드", segments };
}

// ── S3 ──
// 시작음에서 한 옥타브 오르내리는(또는 내리고 오르는) 경로. 시작음이 들어 있는 블록 안에서만
export function octaveRun(rootPc, scaleId, s, f) {
  const n = SCALES[scaleId].steps.length;
  const m = TUNING[s - 1] + f;
  let best = null;
  for (const b of blocks(rootPc, scaleId)) {
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
export function startDeck(rootPc, scaleId, rand = Math.random) {
  const steps = shuffle(SCALES[scaleId].steps, rand);
  let lastString = 0;
  return steps.map(semi => {
    const pc = mod(rootPc + semi);
    const collect = (maxF, avoid) => {
      const out = [];
      for (let s = 6; s >= 1; s--) for (let f = 0; f <= maxF; f++) {
        if (mod(TUNING[s - 1] + f) !== pc || s === avoid) continue;
        const run = octaveRun(rootPc, scaleId, s, f);
        if (run) out.push({ s, f, run, w: s >= 4 ? 2 : 1 });
      }
      return out;
    };
    let opts = collect(12, lastString);
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
      related: semi === 0 ? null : relatedScale(rootPc, scaleId, semi)
    };
  }).filter(Boolean);
}

export { NAMES };
