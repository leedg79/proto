// 릭 엔진 (순수 함수): 데이터 해석, 검사, 블록·근음·도수·코드 관계 계산, 키 이동

import { SCALES, blocks, keyName, scaleTitle } from "../../theory/scales.js";
import { TUNING } from "../../theory/notes.js";
import { LICK_SETS } from "./lick-data.js";
import { LICK_LEVELS } from "../../data/catalog.js";

const mod = n => ((n % 12) + 12) % 12;
const BEAT = 12, BAR = 48;
const DUR = { w: 48, h: 24, "q.": 18, q: 12, "e.": 9, e: 6, s: 3, t: 4 };

// 릭 전용 스케일(검사·도수 표기용)
export const EXTRA_SCALES = {
  "mixed-blues": { name: "블루스 혼합(메이저·마이너 펜타)", steps: [0, 2, 3, 4, 5, 6, 7, 9, 10] },
  "phrygian-dominant": { name: "믹솔리디안 ♭9♭13(하모닉 마이너 5번째 모드)", steps: [0, 1, 4, 5, 7, 8, 10] },
  altered: { name: "얼터드", steps: [0, 1, 3, 4, 6, 8, 10] },
  aeolian: { name: "Aeolian", steps: [0, 2, 3, 5, 7, 8, 10] }
};
export const stepsOf = id => (EXTRA_SCALES[id] || SCALES[id]).steps;
export const scaleNameOf = id => (EXTRA_SCALES[id] || SCALES[id]).name;

const SUB_LEVEL = Object.fromEntries(LICK_LEVELS.flatMap(l => l.subs.map(([id]) => [id, l.id])));
export const USE_NAMES = { f: "필인", i: "인트로", c: "클라이맥스", t: "턴어라운드", e: "엔딩", l: "라인", r: "리프", a: "아르페지오" };
export const FEEL_NAMES = { straight: "스트레이트", shuffle: "셔플", triplet: "셋잇단" };
export const TECH_NAMES = { b: "벤딩", r: "릴리스", h: "해머온", p: "풀오프", sl: "슬라이드", "~": "비브라토", ds: "더블스톱", c: "경과음" };

// "2-8+1-8:eb2~" → { notes:[{s,f}], dur, bend, rel, h, p, sl, vib, chrom, rest }
export function parseToken(tok) {
  const [pos, spec] = tok.split(":");
  const m = /^(w|h|q\.|q|e\.|e|s|t)(.*)$/.exec(spec || "");
  if (!m) throw new Error(`길이 해석 불가: ${tok}`);
  const dur = DUR[m[1]];
  let rest = m[2];
  const ev = { dur, bend: 0, rel: false, h: false, p: false, sl: false, vib: false, chrom: false, rest: pos === "-" };
  const take = re => { const x = re.exec(rest); if (x) rest = rest.replace(re, ""); return x; };
  const b = take(/b([123])/); if (b) ev.bend = Number(b[1]);
  if (take(/sl/)) ev.sl = true;
  if (take(/r/)) ev.rel = true;
  if (take(/h/)) ev.h = true;
  if (take(/p/)) ev.p = true;
  if (take(/~/)) ev.vib = true;
  if (take(/c/)) ev.chrom = true;
  if (rest) throw new Error(`기법 해석 불가: ${tok}`);
  ev.notes = ev.rest ? [] : pos.split("+").map(x => { const [s, f] = x.split("-").map(Number); return { s, f }; });
  return ev;
}

export function parseChords(str) {
  if (!str) return [];
  return str.split(" ").map(x => { const [name, at, root, sc] = x.split(":"); return { name, at: Number(at), root: Number(root), scale: sc }; });
}

const midiOf = (s, f) => TUNING[s - 1] + f;

// 코드 기준 도수 표기 (도미넌트 계열은 텐션 이름)
const DEG_GENERIC = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
const DEG_DOM = ["R", "♭9", "9", "♯9", "3", "11", "♭5", "5", "♭13", "13", "♭7", "7"];
function degreeLabel(semi, chord) {
  const s = mod(semi);
  if (chord && /7/.test(chord.name) && !/maj7|m7/.test(chord.name)) return DEG_DOM[s];
  return DEG_GENERIC[s];
}

export function chordAt(chords, tick) {
  let c = null;
  for (const x of chords) if (x.at <= tick) c = x;
  return c;
}

// 원본 데이터 한 줄 → 릭 객체
export function buildLick(row) {
  const [id, sub, scale, key, use, feel, notesStr, chordStr, name] = row;
  const events = notesStr.split(" ").map(parseToken);
  let t = 0;
  for (const e of events) { e.at = t; t += e.dur; }
  const chords = parseChords(chordStr);
  return { id, sub, level: SUB_LEVEL[sub], scale, key, use, feel, events, chords, ticks: t, bars: Math.ceil(t / BAR), name: name || "", custom: sub === "my" };
}

export const LICKS = LICK_SETS.map(buildLick);
const BUILTIN = LICKS.length;
// 내 릭(직접 입력): 저장소에서 읽어 목록 뒤에 붙임. 저장·삭제 때마다 다시 붙임
export function setCustomLicks(rows) {
  LICKS.splice(BUILTIN, LICKS.length - BUILTIN);
  for (const r of rows) { try { LICKS.push(buildLick(r)); } catch (_) {} }
}
export const lickById = id => LICKS.find(l => l.id === id) || null;

// 검사: 길이 2마디 이내, 음은 스케일(코드 구간은 코드 스케일) 안 또는 경과음 표시, 벤딩 목표음도 스케일 안,
// 해머·풀·슬라이드·릴리스는 같은 줄에서 방향이 맞아야 함
export function validate(l) {
  const errs = [];
  const maxBars = l.custom ? 4 : 2;
  if (l.ticks > maxBars * BAR) errs.push(`길이 ${l.ticks / BAR}마디 > ${maxBars}마디`);
  let prev = null;
  for (const e of l.events) {
    if (e.rest) { prev = null; continue; }
    const ch = chordAt(l.chords, e.at);
    const root = ch ? ch.root : l.key;
    const allowed = new Set(stepsOf(ch ? ch.scale : l.scale).map(x => mod(root + x)));
    // 코드가 있어도 키 스케일 음은 허용
    if (ch) for (const x of stepsOf(l.scale)) allowed.add(mod(l.key + x));
    for (const n of e.notes) {
      if (n.s < 1 || n.s > 6 || n.f < 0 || n.f > 17) errs.push(`${n.s}-${n.f} 범위 밖`);
      const pc = mod(midiOf(n.s, n.f));
      if (!e.chrom && !e.rel && !allowed.has(pc)) errs.push(`${n.s}-${n.f} 스케일 밖`);
      if (e.bend && !allowed.has(mod(pc + e.bend))) errs.push(`${n.s}-${n.f} 벤딩 목표음 스케일 밖`);
    }
    const n = e.notes[0];
    if ((e.h || e.p || e.sl || e.rel) && (!prev || prev.notes[0].s !== n.s)) errs.push(`${n.s}-${n.f} 같은 줄 연결 아님`);
    if (e.h && prev && n.f <= prev.notes[0].f) errs.push(`${n.s}-${n.f} 해머온 방향`);
    if (e.p && prev && n.f >= prev.notes[0].f) errs.push(`${n.s}-${n.f} 풀오프 방향`);
    if (e.rel && prev && (!prev.bend || prev.notes[0].f !== n.f)) errs.push(`${n.s}-${n.f} 릴리스 앞에 벤딩 없음`);
    prev = e;
  }
  return errs;
}

// 키 이동: 같은 모양을 수평 이동, 0~20프렛 안에서 가장 가까운 쪽(넓은 아르페지오도 모든 키에서 들어가도록 20프렛까지)
export function transposeDelta(l, toKey) {
  const fr = l.events.flatMap(e => e.notes.map(n => n.f));
  const lo = Math.min(...fr), hi = Math.max(...fr);
  const k = mod(toKey - l.key);
  const opts = [k, k - 12].filter(d => lo + d >= 0 && hi + d <= 17);
  if (!opts.length) opts.push(...[k, k - 12].filter(d => lo + d >= 0 && hi + d <= 20));
  if (!opts.length) return k > 6 ? k - 12 : k;
  return opts.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
}

// 화면에 쓸 릭 정보(키 적용): 음마다 도수(키 기준, 코드 기준), 블록, 근음 줄, 마지막 음 착지
export function realize(l, toKey = l.key) {
  const d = transposeDelta(l, toKey);
  const shiftK = mod(toKey - l.key);
  const chords = l.chords.map(c => ({ ...c, root: mod(c.root + shiftK), name: renameChord(c.name, c.root, mod(c.root + shiftK)) }));
  const events = l.events.map(e => ({ ...e, notes: e.notes.map(n => ({ s: n.s, f: n.f + d })) }));
  const notes = [];
  for (const e of events) for (const n of e.notes) {
    const midi = midiOf(n.s, n.f);
    const ch = chordAt(chords, e.at);
    const lab = m => ({ deg: DEG_GENERIC[mod(m - toKey)], cdeg: ch ? degreeLabel(m - ch.root, ch) : null });
    const a = lab(midi), b = e.bend ? lab(midi + e.bend) : null;
    notes.push({ ...n, at: e.at, midi, deg: a.deg, cdeg: a.cdeg, bendDeg: b ? (b.cdeg || b.deg) : null, chord: ch ? ch.name : null });
  }
  // 블록: 기준 스케일(진행 릭은 키 스케일) 블록 중 릭 음을 가장 많이 포함하는 것
  const frameScale = SCALES[l.scale] ? l.scale : l.scale === "mixed-blues" ? "minor-penta" : "major";
  const frameKey = l.scale === "mixed-blues" || l.scale === "minor-penta" || l.scale === "blues" || l.scale === "natural-minor" || l.scale === "harmonic-minor" ? toKey : toKey;
  const keys = new Set(notes.map(n => `${n.s}-${n.f}`));
  let best = null;
  for (const b of blocks(frameKey, frameScale)) for (const sh of [-12, 0, 12]) {
    const set = new Set(b.notes.map(n => `${n.s}-${n.f + sh}`));
    let hit = 0;
    for (const k of keys) if (set.has(k)) hit++;
    const lo = b.lo + sh, hi = b.hi + sh;
    const inRange = notes.filter(n => n.f >= lo - 1 && n.f <= hi + 1).length;
    const score = hit * 2 + inRange;
    if (!best || score > best.score) best = { score, block: b, sh, lo, hi, hit };
  }
  const word = SCALES[frameScale] && SCALES[frameScale].mode ? "포지션" : "블록";
  const shape = best ? best.block.notes.map(n => ({ s: n.s, f: n.f + best.sh, root: n.root, label: n.label })) : [];
  const roots = shape.filter(n => n.root);
  const rootString = roots.length ? Math.max(...roots.map(n => n.s)) : null;
  const rootFret = roots.length ? roots.find(n => n.s === rootString).f : null;
  const last = notes[notes.length - 1];
  const fr = notes.map(n => n.f);
  const techs = new Set();
  for (const e of events) {
    if (e.bend) techs.add("b"); if (e.rel) techs.add("r"); if (e.h) techs.add("h"); if (e.p) techs.add("p");
    if (e.sl) techs.add("sl"); if (e.vib) techs.add("~"); if (e.notes.length > 1) techs.add("ds"); if (e.chrom) techs.add("c");
  }
  return {
    ...l, key: toKey, delta: d, events, chords, notes, techs: [...techs],
    title: (l.name ? l.name + " · " : "") + (l.chords.length ? `${keyName(toKey, "major")} 키 · ${chords.map(c => c.name).join(" → ")}` : `${keyName(toKey, l.scale === "mixed-blues" ? "minor-penta" : SCALES[l.scale] ? l.scale : "major")} ${scaleNameOf(l.scale)}`),
    blockName: best ? `${word} ${best.block.index}${best.hit < notes.length * 0.7 ? " 주변" : ""}` : "-",
    blockLo: best ? best.lo : Math.min(...fr), blockHi: best ? best.hi : Math.max(...fr),
    shape, rootString, rootFret,
    land: last ? (last.bendDeg || last.cdeg || last.deg) : "-",
    lo: Math.min(...fr), hi: Math.max(...fr),
    difficulty: difficultyOf(l)
  };
}

const LETTERS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
function renameChord(name, from, to) {
  const m = /^([A-G][♭♯]?)(.*)$/.exec(name);
  if (!m) return name;
  return keyName(to, /^[A-G][♭♯]?m(?!aj)/.test(name) ? "natural-minor" : "major") + m[2];
}

// 코드 표시가 없는 릭이 어울리는 코드
const OVER = {
  "minor-penta": ["m", "7(블루스)"], "major-penta": ["", "7"], blues: ["7", "m"], "mixed-blues": ["7(블루스)"],
  major: ["", "maj7"], "natural-minor": ["m", "m7"], "harmonic-minor": ["m", "→ V7"], dorian: ["m7", "m6"], mixolydian: ["7", "9"],
  lydian: ["maj7(♯11)"], phrygian: ["m", "7sus4(♭9)"]
};
export function overText(r) {
  if (r.chords.length) return r.chords.map(c => c.name).join(" → ");
  const sc = SCALES[r.scale];
  if (sc && sc.chord) return keyName(r.key, r.scale) + sc.suffix;
  const kn = keyName(r.key, ["minor-penta", "blues", "mixed-blues", "natural-minor", "harmonic-minor", "dorian", "phrygian"].includes(r.scale) ? "natural-minor" : "major");
  const o = OVER[r.scale] || [""];
  return o.map(x => (x.startsWith("→") ? `${x.replace("→ V7", "")}${keyName(r.key + 7, "major")}7 → ${kn}m` : kn + x)).join(", ");
}

// 난이도: 1 = 8분음표 이하·쉬운 벤딩, 2 = 셋잇단·경과음·1음반 벤딩, 3 = 16분음표·얼터드
export function difficultyOf(l) {
  let lv = 1;
  for (const e of l.events) {
    if (e.dur === 4 || e.chrom || e.bend === 3 || e.dur === 18) lv = Math.max(lv, 2);
    if (e.dur === 3) lv = 3;
  }
  if (l.chords.some(c => c.scale === "altered")) lv = 3;
  return lv;
}

export function licksFor(levelId, subs = null) {
  return LICKS.filter(l => l.level === levelId && (!subs || !subs.length || subs.includes(l.sub)));
}

export { BEAT, BAR, LETTERS, LICK_LEVELS };
