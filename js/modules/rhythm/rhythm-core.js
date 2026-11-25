// Rhythm 엔진 (순수 함수): 패턴 해석·검사, 손 방향, 소리 길이, 악보용 음표 나누기, 재생 이벤트, 리듬 읽기 문제 만들기
import { STRUM_PATTERNS, COMP_PATTERNS, FINGER_PATTERNS, PERC_PATTERNS, CHORD_TABLE, CHORD_SETS, PHRASES } from "./rhythm-data.js";
import { parseToken } from "../licks/lick-core.js";
import { chordName } from "../../audio/backing.js";
import { TUNING } from "../../theory/notes.js";

const mod = n => ((n % 12) + 12) % 12;
export const U = 16;                       // 한 마디 = 16분음표 16칸(악보 계산 단위)

export const TOPIC_NAMES = {
  "4beat": "4비트", "8beat": "8비트", "16beat": "16비트", accent: "악센트", mute: "뮤트(칙)", rest: "쉼표·끊어치기",
  syncopation: "싱코페이션", shuffle: "셔플", genre: "장르별",
  "chord-rhythm": "코드 리듬", cutting: "커팅", "arpeggio": "아르페지오", "bass-chord": "베이스+코드",
  "body-hit": "바디 타격", "string-hit": "스트링 히트", "palm-mute": "팜뮤트",
  riff: "리프", "repeat-vary": "반복·변형", "chord-based": "코드 기반", "scale-based": "스케일 기반"
};

function build(kind, row) {
  const [id, topic, name, grid, str, opts, tip] = row;
  const tokens = kind === "finger" || kind === "perc" ? str.trim().split(/\s+/) : str.split("");
  return { id, kind, topic, name, grid, tokens, bars: tokens.length / grid, opts: opts || {}, tip };
}

export const PATTERNS = {
  strum: STRUM_PATTERNS.map(r => build("strum", r)),
  comp: COMP_PATTERNS.map(r => build("comp", r)),
  finger: FINGER_PATTERNS.map(r => build("finger", r)),
  perc: PERC_PATTERNS.map(r => build("perc", r))
};
export const patternById = id => Object.values(PATTERNS).flat().find(p => p.id === id) || null;
export const patternsFor = (kind, topics) => { const all = PATTERNS[kind] || []; const t = (topics || []).filter(x => all.some(p => p.topic === x)); return t.length ? all.filter(p => t.includes(p.topic)) : all; };

// 칸 i의 손 방향 (down | up | null)
export function dirOf(p, i) {
  if (p.opts.pluck) return null;
  if (p.grid === 4 || p.opts.down) return "down";
  return i % 2 === 0 ? "down" : "up";
}

// 스트로크 칸 해석 → { type: hit|mute|pm|bass|alt|air|rest, acc }
const STRUM_CH = { d: ["hit", 0], D: ["hit", 1], u: ["hit", 0], U: ["hit", 1], x: ["mute", 0], X: ["mute", 1], p: ["pm", 0], B: ["bass", 0], b: ["alt", 0], ".": ["air", 0], r: ["rest", 0] };
export function strokeOf(p, i) {
  const ch = p.tokens[i];
  const [type, acc] = STRUM_CH[ch] || ["air", 0];
  return { i, ch, type, acc: !!acc, dir: dirOf(p, i) };
}
const sounding = t => t !== "air";       // air만 소리를 이어감(rest는 끊는 사건)

// 검사: 길이, 문자, 손 방향
export function validatePattern(p) {
  const errs = [];
  if (!Number.isInteger(p.bars) || p.bars < 1 || p.bars > 2) errs.push(`길이 ${p.tokens.length}칸은 격자 ${p.grid}의 1~2마디가 아님`);
  if (![4, 8, 16].includes(p.grid)) errs.push(`격자 ${p.grid}`);
  if (p.kind === "strum" || p.kind === "comp") {
    p.tokens.forEach((ch, i) => {
      if (!(ch in STRUM_CH)) errs.push(`${i}번 칸 문자 ${ch}`);
      const d = dirOf(p, i);
      if (d === "up" && /[dDBb]/.test(ch)) errs.push(`${i}번 칸은 업 자리인데 ${ch}`);
      if (d === "down" && /[uU]/.test(ch) && !p.opts.down) errs.push(`${i}번 칸은 다운 자리인데 ${ch}`);
    });
    if (!p.tokens.some(ch => /[dDuUxXpB]/.test(ch))) errs.push("치는 칸 없음");
  } else if (p.kind === "finger") {
    p.tokens.forEach((t, i) => { if (!/^(\.|r|C|B[1-4]*|b[1-4]*|[1-4]+)$/.test(t)) errs.push(`${i}번 칸 토큰 ${t}`); });
  } else if (p.kind === "perc") {
    p.tokens.forEach((t, i) => t.split("+").forEach(x => { if (!/^([KSTPdDuUx]|\.)$/.test(x)) errs.push(`${i}번 칸 토큰 ${t}`); }));
  }
  return errs;
}

// 소리 사건(악보·길이 계산용): 스트로크·컴핑 패턴의 치는 칸과 끊는 칸
// 길이 = 다음 사건(치기·끊기)까지 칸 수. wrap=true면 반복 재생 기준으로 끝 → 처음 이어짐
export function soundEvents(p, { wrap = false } = {}) {
  const n = p.tokens.length;
  const ev = [];
  for (let i = 0; i < n; i++) { const s = strokeOf(p, i); if (sounding(s.type)) ev.push(s); }
  return ev.map((s, k) => {
    const next = ev[k + 1] ? ev[k + 1].i : wrap && ev.length ? ev[0].i + n : n;
    return { ...s, len: next - s.i };
  });
}

// ── 악보용 음표 나누기 ──
// 단위: 16분음표(마디 16). 박 경계를 보이게 나누고, 박 머리에서 시작하면 2분·점2분·온음표,
// 8분 뒷박에서 시작한 4분음표(당김음)는 마디 가운데(3박)를 넘지 않을 때만 한 음표로 씀
export const CODE = { 1: "16", 2: "8", 3: "8d", 4: "q", 6: "qd", 8: "h", 12: "hd", 16: "w" };
export function splitDur(start, len, { rest = false } = {}) {
  const out = [];
  let s = start, L = len;
  while (L > 0) {
    const inBeat = s % 4;
    let take;
    if (inBeat === 0) {
      const beats = Math.floor(L / 4);
      if (beats >= 1) take = s === 0 && beats >= 4 ? 16 : s === 0 && beats >= 3 ? 12 : (s === 0 || s === 8) && beats >= 2 ? 8 : 4;
      else take = L;
    } else if (!rest && inBeat === 2 && L >= 4 && (s === 2 || s === 10)) take = 4;
    else take = Math.min(L, 4 - inBeat);
    out.push({ start: s, len: take, code: CODE[take] });
    s += take; L -= take;
  }
  return out;
}

// 패턴 → 마디별 음표 조각 [{ start, len, code, type: note|mute|rest, acc, dir, pm, bass, step, tie }]
export function notation(p) {
  const k = U / p.grid;                     // 칸 → 16분 단위
  const n = p.tokens.length;
  const ev = soundEvents(p);
  const items = [];
  if (!ev.length || ev[0].i > 0) items.push({ type: "rest", start: 0, len: (ev.length ? ev[0].i : n) * k });
  for (const e of ev) {
    const len = e.len * k, start = e.i * k;
    if (e.type === "rest") { items.push({ type: "rest", start, len }); continue; }
    items.push({ type: e.type === "mute" ? "mute" : "note", start, len, acc: e.acc, dir: e.dir, pm: e.type === "pm", bass: e.type === "bass" || e.type === "alt", step: e.i });
  }
  const bars = Array.from({ length: p.bars }, () => []);
  for (const it of items) {
    let s = it.start, L = it.len, first = true;
    while (L > 0) {
      const b = Math.floor(s / U), room = Math.min(L, (b + 1) * U - s);
      for (const pc of splitDur(s - b * U, room, { rest: it.type === "rest" })) {
        bars[b].push({ ...it, start: pc.start, len: pc.len, code: pc.code, tie: !first && it.type !== "rest" });
        first = false;
      }
      s += room; L -= room;
    }
  }
  return bars;
}

// ── 코드 운지 ──
const shapeFrets = shape => { const f = [null, null, null, null, null, null]; shape.split("").forEach((c, i) => { f[5 - i] = c === "x" ? null : Number(c); }); return f; };
const LABEL = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
export function chordVoicing(name) {
  const c = CHORD_TABLE[name];
  if (!c) return null;
  const frets = shapeFrets(c.shape);
  const notes = [];
  for (let s = 6; s >= 1; s--) { const f = frets[s - 1]; if (f == null) continue; const midi = TUNING[s - 1] + f; notes.push({ s, f, midi, label: LABEL[mod(midi - c.pc)] }); }
  const at = ([s, f]) => ({ s, f, midi: TUNING[s - 1] + f });
  return { name, pc: c.pc, q: c.q, frets, notes, key: c.shape, bass: at(c.bass), alt: at(c.alt) };
}
export const chordSet = id => (CHORD_SETS.find(c => c[0] === id) || CHORD_SETS[1])[2];
// 반주(베이스·드럼)용 마디 목록
export const customBars = names => names.map(n => { const c = CHORD_TABLE[n]; return { segs: [{ rootPc: c.pc, quality: c.q, beats: 4, name: n }] }; });

// 운지(notes 있는 객체) → 베이스·교대 베이스가 없으면 가장 낮은 두 음
export function withBass(v) {
  if (!v) return v;
  if (v.bass) return v;
  const low = [...v.notes].sort((a, b) => b.s - a.s);
  return { ...v, bass: low[0], alt: low[1] || low[0] };
}

const midiOf = n => TUNING[n.s - 1] + n.f;
function strumNotes(v, { up = false, top = false } = {}) {
  let ns = v.notes;
  if (top || up) { const hi = ns.filter(n => n.s <= 4); if (hi.length >= 2) ns = hi; }
  return ns.map(midiOf).sort((a, b) => a - b);
}

// ── 재생 이벤트: 한 마디 ──
// cur·next: 지금·다음 마디 운지. 결과 [{ at(박), kind: strum|mute|pm|note|perc, midis|midi|drum, dur(박), up, vel }]
export function barEvents(p, bar, cur, next) {
  const per = 4 / p.grid;
  const start = (bar % p.bars) * p.grid;
  const out = [];
  if (p.kind === "strum" || p.kind === "comp") {
    const ev = soundEvents(p, { wrap: true });
    const hasBass = p.tokens.some(t => t === "B" || t === "b");
    for (const e of ev) {
      if (e.i < start || e.i >= start + p.grid) continue;
      const pos = e.i - start, at = pos * per, dur = e.len * per;
      // 앤티시페이션: 마지막 박에서 친 음이 마디를 넘어 울리면 다음 코드
      const v = withBass(pos >= p.grid - p.grid / 4 && pos + e.len > p.grid && next ? next : cur);
      const up = e.dir === "up";
      if (e.type === "rest") continue;
      if (e.type === "hit") out.push({ at, kind: "strum", midis: strumNotes(v, { up, top: hasBass }), dur: Math.min(dur, 4), up, vel: e.acc ? 0.78 : up ? 0.44 : 0.55, pluck: !!p.opts.pluck });
      else if (e.type === "mute") out.push({ at, kind: "mute", midis: strumNotes(v, { up }), dur: 0.05, up, vel: e.acc ? 0.8 : 0.55 });
      else if (e.type === "pm") out.push({ at, kind: "pm", midis: strumNotes(v).slice(0, 3), dur: Math.min(dur, 0.45), vel: 0.6 });
      else if (e.type === "bass" || e.type === "alt") out.push({ at, kind: "note", midi: midiOf(e.type === "bass" ? v.bass : v.alt), dur: Math.min(dur, 2), vel: 0.75 });
    }
    return out;
  }
  if (p.kind === "finger") {
    const v = withBass(cur);
    // 줄마다 다음에 같은 줄을 뜯을 때까지(최대 3박) 울림, r 이면 모두 멈춤
    const picks = [];
    for (let k = 0; k < p.grid; k++) {
      const t = p.tokens[start + k];
      for (const sn of fingerStrings(t, v)) picks.push({ k, n: sn });
      if (t === "r") picks.push({ k, stop: true });
    }
    for (const pk of picks) {
      if (pk.stop) continue;
      const nextSame = picks.find(q => q.k > pk.k && (q.stop || (q.n && q.n.s === pk.n.s)));
      const endK = nextSame ? nextSame.k : p.grid + 2;
      out.push({ at: pk.k * per, kind: "note", midi: midiOf(pk.n), dur: Math.min(3, (endK - pk.k) * per), vel: pk.n.bassNote ? 0.72 : 0.6 });
    }
    return out;
  }
  if (p.kind === "perc") {
    const v = withBass(cur);
    for (let k = 0; k < p.grid; k++) {
      const t = p.tokens[start + k];
      for (const x of t.split("+")) {
        const at = k * per;
        if (x === "K") out.push({ at, kind: "perc", drum: "thump", vel: 1 });
        else if (x === "S") out.push({ at, kind: "perc", drum: "slap", vel: 1 }, { at, kind: "mute", midis: strumNotes(v), dur: 0.04, vel: 0.45 });
        else if (x === "T") out.push({ at, kind: "perc", drum: "tap", vel: 1 });
        else if (x === "P") out.push({ at, kind: "pm", midis: [midiOf(v.bass)], dur: 0.3, vel: 0.75 });
        else if (x === "x") out.push({ at, kind: "mute", midis: strumNotes(v), dur: 0.05, vel: 0.5 });
        else if (/[dDuU]/.test(x)) { const up = /[uU]/.test(x); out.push({ at, kind: "strum", midis: strumNotes(v, { up }), dur: 1, up, vel: /[DU]/.test(x) ? 0.75 : up ? 0.42 : 0.52 }); }
      }
    }
    return out;
  }
  return out;
}

// 핑거스타일 토큰 → 줄·프렛 목록
export function fingerStrings(t, v) {
  if (!t || t === "." || t === "r") return [];
  const out = [];
  let rest = t;
  if (rest[0] === "B" || rest[0] === "b") { const b = rest[0] === "B" ? v.bass : v.alt; out.push({ s: b.s, f: b.f, bassNote: true }); rest = rest.slice(1); }
  if (rest === "C") rest = "321";
  for (const c of rest) {
    const s = Number(c), f = v.frets[s - 1];
    if (f != null) out.push({ s, f });
  }
  return out;
}

// 핑거스타일 한 마디를 TAB 이벤트로(4분음표 = 12틱)
export function fingerTabEvents(p, cur, bar = 0) {
  const v = withBass(cur);
  const tp = 48 / p.grid, start = (bar % p.bars) * p.grid;
  const ev = [];
  for (let k = 0; k < p.grid; k++) {
    const t = p.tokens[start + k];
    const ns = fingerStrings(t, v);
    if (ns.length || t === "r") ev.push({ k, notes: ns.map(n => ({ s: n.s, f: n.f })), rest: t === "r" });
  }
  return ev.map((e, i) => {
    const end = ev[i + 1] ? ev[i + 1].k : p.grid;
    return { at: e.k * tp, dur: (end - e.k) * tp, notes: e.notes, rest: e.rest || !e.notes.length, step: e.k };
  }).reduce((acc, e) => { if (!acc.length && e.at > 0) acc.push({ at: 0, dur: e.at, notes: [], rest: true }); acc.push(e); return acc; }, []);
}

// 칸 표시 문자
export function cellText(p, i) {
  const t = p.tokens[i];
  if (p.kind === "finger") {
    if (t === ".") return "";
    if (t === "r") return "∅";
    const m = /^([Bb]?)(.*)$/.exec(t);
    const thumb = m[1] === "B" ? "p" : m[1] === "b" ? "p'" : "";
    const fingers = (m[2] === "C" ? "321" : m[2]).replace(/[1234]/g, c => ({ 1: "a", 2: "m", 3: "i", 4: "i" }[c]));
    return thumb && fingers ? `${thumb}+${fingers}` : thumb || fingers;
  }
  if (p.kind === "perc") {
    if (t === ".") return "";
    return t.split("+").map(x => ({ K: "K", S: "S", T: "T", P: "P", x: "x", d: "↓", D: "↓", u: "↑", U: "↑" }[x] || x)).join("");
  }
  const s = strokeOf(p, i);
  if (s.type === "air") return "";
  if (s.type === "rest") return "∅";
  if (s.type === "mute") return "x";
  if (s.type === "pm") return "P";
  if (s.type === "bass") return "B";
  if (s.type === "alt") return "b";
  return p.opts.pluck ? "●" : s.dir === "up" ? "↑" : "↓";
}
export const isAccent = (p, i) => (p.kind === "perc" ? /[DU]/.test(p.tokens[i]) : /[DUX]/.test(p.tokens[i]));
export const isHitCell = (p, i) => p.tokens[i] !== "." && p.tokens[i] !== "r";

// 박 세기 글자
export function countLabels(grid) {
  if (grid === 16) return Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? String(i / 4 + 1) : ["", "e", "&", "a"][i % 4]));
  if (grid === 8) return Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? String(i / 2 + 1) : "&"));
  return ["1", "2", "3", "4"];
}

// ── 리듬 읽기 문제 ──
const CELLS = {
  "4beat": { grid: 8, cells: ["d.", "d.", ".."], first: ["d."] },
  "8beat": { grid: 8, cells: ["d.", "du", ".u", "du", "d."], first: ["d.", "du"] },
  "16beat": { grid: 16, cells: ["d...", "d.u.", "dudu", "d.du", "dud.", "d..u", ".udu", "d.u."], first: ["d...", "d.u.", "dudu", "d.du", "dud.", "d..u"] },
  rest: { grid: 8, cells: ["d.", "du", "dr", "r.", "d."], first: ["d.", "dr", "r."] },
  syncopation: { grid: 8, cells: ["d.", "du", ".u", ".u", ".."], first: ["d.", "du"] }
};
export const GENERATED_TOPICS = Object.keys(CELLS);

function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }

export function generatePattern(topic, rand = Math.random) {
  const def = CELLS[topic];
  for (let tries = 0; tries < 50; tries++) {
    const cells = [pick(def.first, rand), pick(def.cells, rand), pick(def.cells, rand), pick(def.cells, rand)];
    const str = cells.join("");
    const p = build("strum", ["RD", topic, "무작위 리듬", def.grid, str, {}, ""]);
    const hits = p.tokens.filter(c => /[dDuU]/.test(c)).length;
    if (hits < 3) continue;
    if (topic === "rest" && !str.includes("r")) continue;
    if (topic === "syncopation") { const ok = p.tokens.some((c, i) => c === "u" && p.tokens[i + 1] === "." && (i + 1) % 2 === 0); if (!ok) continue; }
    if (validatePattern(p).length) continue;
    return p;
  }
  return PATTERNS.strum.find(x => x.topic === topic) || PATTERNS.strum[0];
}

// topics 중 하나를 골라 문제 하나: 만들 수 있는 주제는 절반은 새로 만들고 절반은 패턴 목록에서
export function readingPrompt(topics, rand = Math.random, avoidId = null) {
  const list = topics && topics.length ? topics : ["8beat"];
  for (let tries = 0; tries < 20; tries++) {
    const t = pick(list, rand);
    const lib = PATTERNS.strum.filter(p => p.topic === t);
    const p = CELLS[t] && (!lib.length || rand() < 0.5) ? generatePattern(t, rand) : lib.length ? pick(lib, rand) : generatePattern("8beat", rand);
    const sig = p.tokens.join("");
    if (avoidId && sig === avoidId && tries < 19) continue;
    return p;
  }
  return generatePattern("8beat", rand);
}

// ── 리듬 프레이즈 ──
export function buildPhrase(row) {
  const [id, topic, name, key, prog, style, feel, notesStr, tip] = row;
  const events = notesStr.split(" ").map(parseToken);
  let t = 0;
  for (const e of events) { e.at = t; t += e.dur; }
  const bars = Math.ceil(t / 48);
  const chords = prog.map((tok, i) => ({ name: chordName(key, tok), at: i * 48 }));
  return { id, topic, name, key, prog, style, feel, events, ticks: t, bars, chords, tip };
}
export const PHRASE_LIST = PHRASES.map(buildPhrase);
export const phrasesFor = topics => { const t = (topics || []).filter(x => PHRASE_LIST.some(p => p.topic === x)); return t.length ? PHRASE_LIST.filter(p => t.includes(p.topic)) : PHRASE_LIST; };

export function validatePhrase(ph) {
  const errs = [];
  if (ph.ticks !== ph.bars * 48) errs.push(`길이 ${ph.ticks}틱은 마디(48틱)의 배수가 아님`);
  if (ph.prog.length !== ph.bars) errs.push(`코드 ${ph.prog.length}개 ≠ ${ph.bars}마디`);
  for (const e of ph.events) for (const n of e.notes) if (n.s < 1 || n.s > 6 || n.f < 0 || n.f > 15) errs.push(`음 위치 ${n.s}-${n.f}`);
  return errs;
}

// 프레이즈 한 마디 재생 이벤트(박 단위)
export function phraseBarEvents(ph, bar) {
  const b = bar % ph.bars, t0 = b * 48;
  return ph.events.filter(e => !e.rest && e.at >= t0 && e.at < t0 + 48).map(e => ({
    at: (e.at - t0) / 12, kind: "note", dur: Math.max(0.12, e.dur / 12 * 0.92), midis: e.notes.map(n => TUNING[n.s - 1] + n.f), vel: e.notes.length > 1 ? 0.6 : 0.8,
    idx: ph.events.indexOf(e)
  }));
}
