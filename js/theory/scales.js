// 스케일 공식과 지판 블록·포지션 (화면과 무관)
// 블록(5개): 지판 위치 구간. 펜타토닉은 줄당 2음 박스, 7음계·코드톤은 같은 구간(펜타토닉 박스의 프렛 범위) 안의 음
// 포지션(7개, Modes): 시작음 기준 줄당 3음(3NPS)

import { TUNING } from "./notes.js";

const mod = n => ((n % 12) + 12) % 12;

export const SCALES = {
  "major-penta":    { name: "메이저 펜타토닉", steps: [0, 2, 4, 7, 9], frame: "major-penta" },
  "minor-penta":    { name: "마이너 펜타토닉", steps: [0, 3, 5, 7, 10], frame: "minor-penta" },
  blues:            { name: "블루스 스케일", steps: [0, 3, 5, 6, 7, 10], frame: "minor-penta" },
  major:            { name: "메이저", steps: [0, 2, 4, 5, 7, 9, 11], frame: "major-penta" },
  "natural-minor":  { name: "내추럴 마이너", steps: [0, 2, 3, 5, 7, 8, 10], frame: "minor-penta" },
  "harmonic-minor": { name: "하모닉 마이너", steps: [0, 2, 3, 5, 7, 8, 11], frame: "minor-penta" },
  "melodic-minor":  { name: "멜로딕 마이너", steps: [0, 2, 3, 5, 7, 9, 11], frame: "minor-penta" },
  // 코드톤(S1): 아르페지오
  maj:  { name: "메이저 코드톤", steps: [0, 4, 7], frame: "major-penta", chord: true, suffix: "" },
  min:  { name: "마이너 코드톤", steps: [0, 3, 7], frame: "minor-penta", chord: true, suffix: "m" },
  maj7: { name: "maj7 코드톤", steps: [0, 4, 7, 11], frame: "major-penta", chord: true, suffix: "maj7" },
  dom7: { name: "7 코드톤", steps: [0, 4, 7, 10], frame: "major-penta", chord: true, suffix: "7" },
  m7:   { name: "m7 코드톤", steps: [0, 3, 7, 10], frame: "minor-penta", chord: true, suffix: "m7" },
  m7b5: { name: "m7♭5 코드톤", steps: [0, 3, 6, 10], frame: "minor-penta", chord: true, suffix: "m7♭5" },
  // 모드(S4): 장음계 회전
  ionian:     { name: "Ionian", steps: [0, 2, 4, 5, 7, 9, 11], mode: true },
  dorian:     { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10], mode: true },
  phrygian:   { name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10], mode: true },
  lydian:     { name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11], mode: true },
  mixolydian: { name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], mode: true },
  aeolian:    { name: "Aeolian", steps: [0, 2, 3, 5, 7, 8, 10], mode: true },
  locrian:    { name: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10], mode: true }
};

// 근음 기준 반음 → 도수 표기
export function degreeOf(semi, scaleId) {
  const s = mod(semi);
  const sc = SCALES[scaleId];
  if (sc && sc.chord) return { 0: "R", 3: "♭3", 4: "3", 6: "♭5", 7: "5", 10: "♭7", 11: "7" }[s];
  if (scaleId === "lydian" && s === 6) return "♯4";
  return ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"][s];
}

// 키 표기: 플랫 키는 플랫
const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const KEY_LIST = [0, 7, 2, 9, 4, 11, 5, 10, 3, 8, 1, 6];
export function keyName(pc, scaleId) {
  const minorish = SCALES[scaleId] && (SCALES[scaleId].frame === "minor-penta" || ["dorian", "phrygian", "aeolian", "locrian"].includes(scaleId));
  // 단조 계열은 관계 장조의 조표 기준
  const ref = minorish ? mod(pc + 3) : pc;
  return ([5, 10, 3, 8, 1, 6].includes(ref) ? FLAT : SHARP)[mod(pc)];
}

export function scaleTitle(rootPc, scaleId) {
  const sc = SCALES[scaleId];
  return sc.chord ? `${keyName(rootPc, scaleId)}${sc.suffix} 코드톤` : `${keyName(rootPc, scaleId)} ${sc.name}`;
}

export function scalePcs(rootPc, scaleId) {
  return SCALES[scaleId].steps.map(s => mod(rootPc + s));
}

const MIDI_OPEN = TUNING; // 1번현..6번현
const MAX = 17;

// 낮은 음부터(6번 현 → 1번 현) 정렬
const order = (a, b) => (b.s - a.s) || (a.f - b.f);

function noteAt(s, f, rootPc, scaleId) {
  const midi = MIDI_OPEN[s - 1] + f;
  return { s, f, midi, label: degreeOf(midi - rootPc, scaleId), root: mod(midi - rootPc) === 0 };
}

// 줄당 n음 패턴: 6번 현의 startFret 음부터 스케일 음을 차례로 n개씩
function nps(rootPc, steps, startFret, perString) {
  const pcs = new Set(steps.map(s => mod(rootPc + s)));
  const out = [];
  let midi = MIDI_OPEN[5] + startFret;
  for (let s = 6; s >= 1; s--) {
    const open = MIDI_OPEN[s - 1];
    for (let k = 0; k < perString; k++) {
      while (!pcs.has(mod(midi))) midi++;
      out.push({ s, f: midi - open });
      midi++;
    }
  }
  return out;
}

// 펜타토닉 박스 5개의 시작 프렛(6번 현): 근음부터 스케일 음 차례로, 0~12 사이로
function boxStarts(rootPc, steps) {
  const r = mod(rootPc - MIDI_OPEN[5]);
  return steps.map(st => {
    let f = r + st;
    while (f > 12) f -= 12;
    return f;
  });
}

function shift12(notes) {
  // 0프렛 아래로 내려가거나 너무 높으면 12프렛 이동
  const lo = Math.min(...notes.map(n => n.f));
  const hi = Math.max(...notes.map(n => n.f));
  if (lo < 0) return notes.map(n => ({ ...n, f: n.f + 12 }));
  if (hi > MAX && lo >= 12) return notes.map(n => ({ ...n, f: n.f - 12 }));
  return notes;
}

// 블록 k (1~5)
export function blocks(rootPc, scaleId) {
  const sc = SCALES[scaleId];
  if (sc.mode) return positions(rootPc, scaleId);
  const frameSteps = SCALES[sc.frame].steps;
  const pcs = new Set(scalePcs(rootPc, scaleId));
  return boxStarts(rootPc, frameSteps).map((start, i) => {
    const box = shift12(nps(rootPc, frameSteps, start, 2));
    let notes;
    if (scaleId === sc.frame) notes = box;
    else {
      // 박스의 프렛 구간 안에서 이 스케일(또는 코드톤) 음 전부
      const lo = Math.min(...box.map(n => n.f)), hi = Math.max(...box.map(n => n.f));
      notes = [];
      for (let s = 6; s >= 1; s--) for (let f = Math.max(0, lo - (sc.chord ? 0 : 1)); f <= hi; f++) {
        if (pcs.has(mod(MIDI_OPEN[s - 1] + f))) notes.push({ s, f });
      }
      // 7음계: 줄마다 낮은 쪽 확장 음은 같은 줄에 3음을 넘을 때만 뺌
      if (!sc.chord) notes = trimPerString(notes, lo, 3);
      notes = dedupePitch(notes, lo, hi);
    }
    const list = notes.map(n => noteAt(n.s, n.f, rootPc, scaleId)).sort(order);
    const fr = list.map(n => n.f);
    return { index: i + 1, name: `블록 ${i + 1}`, notes: list, lo: Math.min(...fr), hi: Math.max(...fr) };
  }).sort((a, b) => a.index - b.index);
}

// 같은 음높이가 두 줄에 있으면 구간 안쪽 → 낮은 줄(굵은 줄) 쪽만 남김
function dedupePitch(notes, lo, hi) {
  const by = new Map();
  for (const n of notes) {
    const m = MIDI_OPEN[n.s - 1] + n.f;
    const cur = by.get(m);
    const inside = x => x.f >= lo && x.f <= hi;
    if (!cur || (inside(n) && !inside(cur)) || (inside(n) === inside(cur) && n.s > cur.s)) by.set(m, n);
  }
  return [...by.values()];
}

function trimPerString(notes, lo, maxPer) {
  const out = [];
  for (let s = 6; s >= 1; s--) {
    let row = notes.filter(n => n.s === s);
    while (row.length > maxPer && row[0].f < lo) row = row.slice(1);
    out.push(...row);
  }
  return out;
}

// 모드 포지션 k (1~7): 모드 k번째 음에서 시작하는 줄당 3음
export function positions(rootPc, scaleId) {
  const steps = SCALES[scaleId].steps;
  const r = mod(rootPc - MIDI_OPEN[5]);
  return steps.map((st, i) => {
    let start = r + st;
    while (start > 12) start -= 12;
    const notes = shift12(nps(rootPc, steps, start, 3)).map(n => noteAt(n.s, n.f, rootPc, scaleId)).sort(order);
    const fr = notes.map(n => n.f);
    return { index: i + 1, name: `포지션 ${i + 1}`, notes, lo: Math.min(...fr), hi: Math.max(...fr) };
  });
}

// 연주 순서: 상행(낮은 음 → 높은 음), 하행, 왕복
export function sequence(block, dir = "updown") {
  const up = [...block.notes].sort((a, b) => a.midi - b.midi || b.s - a.s);
  if (dir === "up") return up;
  const down = [...up].reverse();
  if (dir === "down") return down;
  return [...up, ...down.slice(1)];
}

// 한 줄에서 특정 음높이 위치 (0~15프렛)
export function findOnString(pc, string) {
  const out = [];
  for (let f = 0; f <= 15; f++) if (mod(MIDI_OPEN[string - 1] + f) === mod(pc)) out.push(f);
  return out;
}

// ── 블록 연결 경로 ──
// 이웃한 블록을 이어 같은 음을 반복하지 않고 스케일을 연속으로 오르내리는 운지 경로
// 규칙: 줄을 건너뛰지 않음, 한 줄에 4음 이하, 손 이동(프렛 변화)이 적은 쪽, 블록 구간 밖은 되도록 피함

function poolOf(bs, rootPc, scaleId) {
  const lo = Math.min(...bs.map(b => b.lo)), hi = Math.max(...bs.map(b => b.hi));
  const inBlock = new Set(bs.flatMap(b => b.notes.map(n => n.s + "-" + n.f)));
  const pcs = new Set(scalePcs(rootPc, scaleId));
  const pool = [];
  for (let s = 1; s <= 6; s++) for (let f = Math.max(0, lo - 1); f <= hi + 1; f++) {
    const m = MIDI_OPEN[s - 1] + f;
    if (pcs.has(mod(m))) pool.push({ s, f, midi: m, inBlock: inBlock.has(s + "-" + f) });
  }
  return pool;
}

// ── 블록 전환 경로 (슬라이드 연결) ──
// seq: 지나갈 블록 순서, ks: 블록을 바꿀 줄(seq.length - 1개), up: 음 높이 방향
// 규칙: 각 구간의 음은 그 블록 안의 운지만 사용, 블록 전환은 정해진 줄에서 같은 줄 슬라이드(1~4프렛)로만
//       줄 건너뛰기 없음, 같은 음 반복 없음
// pool이 주어지면(완화 모드) 블록 밖이지만 그 블록 프렛 범위 ±1 안의 스케일 음도 감점을 두고 허용
// slides: 허용하는 슬라이드 거리(프렛). 실제 연주처럼 온음(2프렛), 반음이 있는 스케일은 1프렛까지(v2.11.0)
function routeShift(seq, ks, up, pool = null, slides = [2]) {
  const key = n => n.s + "-" + n.f;
  const sets = seq.map(b => new Set(b.notes.map(key)));
  const near = (ph, c) => pool && c.f >= seq[ph].lo - 1 && c.f <= seq[ph].hi + 1;
  const all = new Map();
  for (const b of seq) for (const n of b.notes) all.set(key(n), { s: n.s, f: n.f, midi: MIDI_OPEN[n.s - 1] + n.f });
  if (pool) for (const p of pool) if (!all.has(key(p))) all.set(key(p), { s: p.s, f: p.f, midi: p.midi });
  const first = seq[0], last = seq[seq.length - 1];
  const startN = up ? first.notes.filter(n => n.s === 6).sort((x, y) => x.f - y.f)[0] : first.notes.filter(n => n.s === 1).sort((x, y) => y.f - x.f)[0];
  const endN = up ? last.notes.filter(n => n.s === 1).sort((x, y) => y.f - x.f)[0] : last.notes.filter(n => n.s === 6).sort((x, y) => x.f - y.f)[0];
  if (!startN || !endN) return null;
  const sm = MIDI_OPEN[startN.s - 1] + startN.f, em = MIDI_OPEN[endN.s - 1] + endN.f;
  const pitches = [...new Set([...all.values()].map(p => p.midi))]
    .filter(m => (up ? m >= sm && m <= em : m <= sm && m >= em)).sort((x, y) => (up ? x - y : y - x));
  const cands = pitches.map(m => [...all.values()].filter(p => p.midi === m));
  const lastPhase = seq.length - 1;
  let layer = new Map();
  for (const c of cands[0]) if (c.s === startN.s && c.f === startN.f) layer.set(`${key(c)}|0|1`, { cost: 0, c, ph: 0, cnt: 1, prev: null, slide: false });
  for (let i = 1; i < pitches.length; i++) {
    const next = new Map();
    for (const st of layer.values()) for (const c of cands[i]) {
      const same = c.s === st.c.s;
      if (!(same || c.s === st.c.s + (up ? -1 : 1))) continue;
      if (same && (up ? c.f <= st.c.f : c.f >= st.c.f)) continue;
      const opts = [];
      if (sets[st.ph].has(key(c))) opts.push([st.ph, false, 0]);
      else if (near(st.ph, c)) opts.push([st.ph, false, 3]);
      // 블록 전환: 정한 줄에서, 같은 줄 슬라이드, 다음 블록에만 있는 음으로
      if (st.ph < lastPhase && same && c.s === ks[st.ph] && !sets[st.ph].has(key(c)) && (sets[st.ph + 1].has(key(c)) || near(st.ph + 1, c))) {
        const d = Math.abs(c.f - st.c.f);
        if (slides.includes(d)) opts.push([st.ph + 1, true, sets[st.ph + 1].has(key(c)) ? 0 : 3]);
      }
      for (const [ph, slide, pen] of opts) {
        const cnt = same ? st.cnt + 1 : 1;
        if (cnt > (slide || st.cnt >= 4 && ph !== st.ph ? 5 : 4)) continue;
        if (!slide && same && Math.abs(c.f - st.c.f) > 4) continue;
        const cost = st.cost + pen + Math.abs(c.f - st.c.f) * 0.3 + (cnt === 4 ? 1 : 0);
        const k = `${key(c)}|${ph}|${cnt}`;
        if (!next.has(k) || next.get(k).cost > cost) next.set(k, { cost, c, ph, cnt, prev: st, slide });
      }
    }
    if (!next.size) return null;
    layer = next;
  }
  let best = null;
  for (const st of layer.values()) if (st.ph === lastPhase && st.c.s === endN.s && st.c.f === endN.f && (!best || st.cost < best.cost)) best = st;
  if (!best) return null;
  const out = [];
  for (let x = best; x; x = x.prev) out.push({ s: x.c.s, f: x.c.f, midi: x.c.midi, slide: x.slide, block: seq[x.ph].index });
  return out.reverse();
}

// 바꿀 줄 후보: 블록 2개 = 4·3·5·2번 줄, 블록 3개 = (5·4번 줄, 3·2번 줄) 조합
const SWITCH_SETS = {
  2: [[4], [3], [5], [2]],
  3: [[5, 3], [4, 2], [5, 2], [4, 3], [5, 4], [3, 2]]
};
function routeAny(seq, up, prefer, pool, slides) {
  const base = SWITCH_SETS[seq.length] || [[]];
  const opts = up ? base : base.map(o => [...o].reverse());
  // 마지막 수단: 모든 줄 조합(같은 줄에서 두 번 바꾸는 경우 포함)
  const extra = [];
  if (seq.length === 2) for (const k of [6, 1]) extra.push([k]);
  if (seq.length === 3) for (let a = 6; a >= 1; a--) for (let b = a; b >= 1; b--) extra.push(up ? [a, b] : [b, a]);
  const seen = new Set();
  const order = [...(prefer ? [prefer] : []), ...opts, ...extra].filter(o => !seen.has(o.join()) && seen.add(o.join()));
  // 1차: 블록 운지만 / 2차: 블록 근처 음까지 허용
  for (const p of [null, pool]) for (const ks of order) {
    const r = routeShift(seq, ks, up, p, slides);
    if (r) return { notes: r, ks };
  }
  return null;
}

// 지판 위치 순서(낮은 프렛 → 높은 프렛)로 정렬한 블록. 연결은 이 순서의 이웃끼리
export function neckOrder(rootPc, scaleId) {
  return [...blocks(rootPc, scaleId)].sort((a, b) => a.lo - b.lo || a.index - b.index);
}

// shape: "up"(낮은 블록 → 높은 블록, 상행) | "down"(높은 블록 → 낮은 블록, 하행) | "updown"(상행 후 하행, 꼭대기 음 1번)
// pick: 바꿀 줄 조합 번호(무작위 선택용, 없으면 가장 가운데 줄)
export function connectPath(rootPc, scaleId, startIndex, count, shape, pick = 0) {
  const bs = neckOrder(rootPc, scaleId);
  const sel = bs.slice(startIndex, startIndex + count);
  if (sel.length < count) return null;
  const opts = SWITCH_SETS[count];
  const prefer = opts[((pick % opts.length) + opts.length) % opts.length];
  const rev = [...sel].reverse();
  const pool = poolOf(sel, rootPc, scaleId);
  const st = SCALES[scaleId] ? SCALES[scaleId].steps : [0, 2, 4, 5, 7, 9, 11];
  const semi = st.some((x, i) => ((st[(i + 1) % st.length] - x + 12) % 12) === 1);
  // 코드톤(아르페지오)은 이웃 음이 원래 3~4프렛 떨어져 있어 예전처럼 1~4프렛 허용
  const slides = SCALES[scaleId] && SCALES[scaleId].chord ? [1, 2, 3, 4] : semi ? [1, 2] : [2];
  let notes;
  if (shape === "down") {
    const r = routeAny(rev, false, [...prefer].reverse(), pool, slides);
    if (!r) return null;
    notes = r.notes;
  } else {
    const a = routeAny(sel, true, prefer, pool, slides);
    if (!a) return null;
    notes = a.notes;
    if (shape === "updown") {
      // 내려올 때는 올라갈 때와 다른 줄에서 바꿔 다른 경로로
      const other = opts.find(o => o.join() !== a.ks.join());
      const b = routeAny(rev, false, other ? [...other].reverse() : null, pool, slides);
      if (!b) return null;
      notes = notes.concat(b.notes.slice(1));
    }
  }
  notes = notes.map(n => ({ ...n, ...noteAt(n.s, n.f, rootPc, scaleId) }));
  const fr = notes.map(n => n.f);
  return { blocks: sel, notes, lo: Math.min(...fr), hi: Math.max(...fr), label: sel.map(b => b.index).join("→"), slides: notes.map((n, i) => (n.slide ? i : -1)).filter(i => i >= 0) };
}
