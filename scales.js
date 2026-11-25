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

// from/to: {s,f} 시작·끝 음, up: 상행 여부
function routeSegment(pool, from, to, up) {
  const fm = MIDI_OPEN[from.s - 1] + from.f, tm = MIDI_OPEN[to.s - 1] + to.f;
  const pitches = [...new Set(pool.map(p => p.midi))].filter(m => (up ? m >= fm && m <= tm : m <= fm && m >= tm)).sort((a, b) => (up ? a - b : b - a));
  const cands = pitches.map((m, i) => {
    if (i === 0) return [{ ...from, midi: fm, inBlock: true }];
    if (i === pitches.length - 1) return [{ ...to, midi: tm, inBlock: true }];
    return pool.filter(p => p.midi === m);
  });
  // DP: 손 위치(4프렛 구간의 시작 p)를 상태로 둠. 구간 안의 음은 손 이동 없이, 구간을 옮기면(포지션 이동) 비용
  // 상태 = (후보, 같은 줄 음 수, 그 줄 첫 프렛, 손 위치 p)
  const neckDir = Math.sign(to.f - from.f);
  const fits = (f, p) => f === 0 || (f >= p && f <= p + 3);
  const stretch = (f, p) => f === p - 1 || f === p + 4;
  const startPs = [];
  for (let p = Math.max(0, from.f - 3); p <= Math.max(0, from.f); p++) startPs.push(p);
  let layer = new Map();
  for (const p of startPs) layer.set(`0|1|${from.f}|${p}`, { cost: Math.abs(p - Math.max(0, from.f - 1)) * 0.1, cand: cands[0][0], count: 1, first: from.f, p, prev: null });
  for (let i = 1; i < pitches.length; i++) {
    const next = new Map();
    for (const st of layer.values()) {
      for (const c of cands[i]) {
        const sameString = c.s === st.cand.s;
        const okString = up ? c.s === st.cand.s || c.s === st.cand.s - 1 : c.s === st.cand.s || c.s === st.cand.s + 1;
        if (!okString) continue;
        if (sameString && (up ? c.f <= st.cand.f : c.f >= st.cand.f)) continue;
        const count = sameString ? st.count + 1 : 1;
        if (count > 4) continue;
        const first = sameString ? st.first : c.f;
        if (Math.abs(c.f - first) > 4) continue; // 한 줄 안에서는 4프렛 이내
        // 손 위치 후보: 그대로 / 이 음을 포함하도록 이동
        const ps = new Set([st.p]);
        if (c.f > 0) for (let p = Math.max(0, c.f - 3); p <= c.f; p++) ps.add(p);
        for (const p of ps) {
          let cost;
          if (fits(c.f, p)) cost = 0;
          else if (stretch(c.f, p)) cost = 1.5;
          else continue;
          if (p !== st.p) {
            const d = p - st.p;
            cost += 2 + Math.abs(d) + (neckDir !== 0 && Math.sign(d) === -neckDir ? 3 * Math.abs(d) : 0);
          }
          cost += (c.inBlock ? 0 : 2.5) + (count === 4 ? 1 : 0) + Math.abs(c.f - st.cand.f) * 0.1;
          const key = `${cands[i].indexOf(c)}|${count}|${first}|${p}`;
          const total = st.cost + cost;
          if (!next.has(key) || next.get(key).cost > total) next.set(key, { cost: total, cand: c, count, first, p, prev: st });
        }
      }
    }
    if (!next.size) return null;
    layer = next;
  }
  let best = null;
  for (const st of layer.values()) if (!best || st.cost < best.cost) best = st;
  const path = [];
  for (let x = best; x; x = x.prev) path.push({ s: x.cand.s, f: x.cand.f, midi: x.cand.midi });
  return path.reverse();
}

// 끝점 후보: 6번 현은 낮은 음부터, 1번 현은 높은 음부터 (가능한 가장 넓은 구간을 먼저 시도)
const lows6 = b => b.notes.filter(n => n.s === 6).sort((a, c) => a.f - c.f);
const highs1 = b => b.notes.filter(n => n.s === 1).sort((a, c) => c.f - a.f);

function tryRoute(pool, froms, tos, up) {
  for (const f of froms) for (const t of tos) {
    const r = routeSegment(pool, f, t, up);
    if (r) return r;
  }
  return null;
}

// 지판 위치 순서(낮은 프렛 → 높은 프렛)로 정렬한 블록. 연결은 이 순서의 이웃끼리
export function neckOrder(rootPc, scaleId) {
  return [...blocks(rootPc, scaleId)].sort((a, b) => a.lo - b.lo || a.index - b.index);
}

export function connectPath(rootPc, scaleId, startIndex, count, shape) {
  const bs = neckOrder(rootPc, scaleId);
  const sel = bs.slice(startIndex, startIndex + count);
  if (sel.length < count) return null;
  const pool = poolOf(sel, rootPc, scaleId);
  const label = n => ({ ...n, ...noteAt(n.s, n.f, rootPc, scaleId) });
  const segs = [];
  if (count === 2) {
    const seg = tryRoute(pool, lows6(sel[0]), highs1(sel[1]), true);
    if (!seg) return null;
    segs.push(shape === "down" ? seg.reverse() : seg);
  } else if (shape === "updown") {
    const a = tryRoute(pool, lows6(sel[0]), highs1(sel[1]), true);
    const b = a && tryRoute(pool, [a[a.length - 1]], lows6(sel[2]), false);
    if (!a || !b) return null;
    segs.push(a, b.slice(1));
  } else {
    const a = tryRoute(pool, highs1(sel[0]), lows6(sel[1]), false);
    const b = a && tryRoute(pool, [a[a.length - 1]], highs1(sel[2]), true);
    if (!a || !b) return null;
    segs.push(a, b.slice(1));
  }
  const notes = segs.flat().map(label);
  const fr = notes.map(n => n.f);
  return { blocks: sel, notes, lo: Math.min(...fr), hi: Math.max(...fr), label: sel.map(b => b.index).join("→") };
}
