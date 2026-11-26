// Ear Lab 엔진 (순수 함수): 문제 만들기·채점
import { SPELLINGS, TUNING } from "../../theory/notes.js";
import { LICKS } from "../licks/lick-core.js";

const mod = n => ((n % 12) + 12) % 12;
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
export const noteName = pc => SPELLINGS[mod(pc)].join("/");
export const midiName = m => `${SPELLINGS[mod(m)][0]}${Math.floor(m / 12) - 1}`;

// ── E1 음 이름 ──
export const RANGES = { low: [40, 52], mid: [52, 64], high: [64, 76], all: [40, 76] };   // E2~E3, E3~E4, E4~E5
export const RANGE_NAMES = [["low", "저음(6·5번 줄 영역)"], ["mid", "중음"], ["high", "고음(1·2번 줄 영역)"], ["all", "전체"]];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

export function notePrompt({ range = "all", naturals = false } = {}, rand = Math.random, avoid = null) {
  const [lo, hi] = RANGES[range] || RANGES.all;
  for (let i = 0; i < 30; i++) {
    const m = lo + Math.floor(rand() * (hi - lo + 1));
    if (naturals && !NATURAL.includes(mod(m))) continue;
    if (avoid != null && m === avoid) continue;
    return { midi: m, answer: mod(m) };
  }
  return { midi: 60, answer: 0 };
}
export const noteChoices = naturals => (naturals ? NATURAL : [...Array(12).keys()]).map(pc => ({ v: pc, label: noteName(pc) }));

// ── E2 음정 ──
export const INTERVALS = [
  { s: 1, id: "m2", name: "단2도", topic: "2-3", hint: "Jaws(죠스) 주제" },
  { s: 2, id: "M2", name: "장2도", topic: "2-3", hint: "학교종이 땡땡땡 '솔-솔-라'" },
  { s: 3, id: "m3", name: "단3도", topic: "2-3", hint: "산토끼 '솔-미'(하행)" },
  { s: 4, id: "M3", name: "장3도", topic: "2-3", hint: "When the Saints Go Marching In" },
  { s: 5, id: "P4", name: "완전4도", topic: "4-5", hint: "Here Comes the Bride(결혼 행진곡)" },
  { s: 6, id: "TT", name: "증4도·감5도", topic: "4-5", hint: "The Simpsons 주제" },
  { s: 7, id: "P5", name: "완전5도", topic: "4-5", hint: "반짝반짝 작은 별 '도-솔'" },
  { s: 8, id: "m6", name: "단6도", topic: "6-7", hint: "The Entertainer" },
  { s: 9, id: "M6", name: "장6도", topic: "6-7", hint: "My Bonnie" },
  { s: 10, id: "m7", name: "단7도", topic: "6-7", hint: "Star Trek 원작 주제" },
  { s: 11, id: "M7", name: "장7도", topic: "6-7", hint: "Take On Me 후렴" },
  { s: 12, id: "P8", name: "완전8도(옥타브)", topic: "octave-compound", hint: "Somewhere Over the Rainbow 첫 두 음" },
  { s: 13, id: "m9", name: "단9도", topic: "octave-compound", hint: "옥타브 + 단2도" },
  { s: 14, id: "M9", name: "장9도", topic: "octave-compound", hint: "옥타브 + 장2도" },
  { s: 15, id: "m10", name: "단10도", topic: "octave-compound", hint: "옥타브 + 단3도" },
  { s: 16, id: "M10", name: "장10도", topic: "octave-compound", hint: "옥타브 + 장3도" }
];
export const intervalsFor = topics => { const t = (topics || []).filter(x => INTERVALS.some(i => i.topic === x)); return t.length ? INTERVALS.filter(i => t.includes(i.topic)) : INTERVALS.filter(i => i.s <= 12); };
export const DIRECTIONS = [["up", "상행"], ["down", "하행"], ["harm", "동시"], ["mix", "섞기"]];

export function intervalPrompt(topics, { dir = "up" } = {}, rand = Math.random, avoid = null) {
  const list = intervalsFor(topics);
  let iv = pick(list, rand);
  if (avoid && list.length > 1) for (let i = 0; i < 5 && iv.id === avoid; i++) iv = pick(list, rand);
  const d = dir === "mix" ? pick(["up", "down", "harm"], rand) : dir;
  const lo = 45 + Math.floor(rand() * (72 - 45 - iv.s));       // A2 ~ 위 음이 C5를 넘지 않게
  const a = d === "down" ? lo + iv.s : lo, b = d === "down" ? lo : lo + iv.s;
  return { notes: [a, b], dir: d, answer: iv.id, interval: iv };
}

// ── E3 코드 청음 ──
export const CHORD_QUALITIES = [
  { id: "maj", name: "메이저", ints: [0, 4, 7], topic: "triads" },
  { id: "min", name: "마이너", ints: [0, 3, 7], topic: "triads" },
  { id: "dim", name: "디미니시", ints: [0, 3, 6], topic: "triads" },
  { id: "aug", name: "오그먼트", ints: [0, 4, 8], topic: "triads" },
  { id: "sus4", name: "서스4", ints: [0, 5, 7], topic: "triads" },
  { id: "maj7", name: "maj7", ints: [0, 4, 7, 11], topic: "sevenths" },
  { id: "7", name: "7(도미넌트)", ints: [0, 4, 7, 10], topic: "sevenths" },
  { id: "m7", name: "m7", ints: [0, 3, 7, 10], topic: "sevenths" },
  { id: "m7b5", name: "m7♭5", ints: [0, 3, 6, 10], topic: "sevenths" },
  { id: "dim7", name: "dim7", ints: [0, 3, 6, 9], topic: "sevenths" },
  { id: "add9", name: "add9", ints: [0, 4, 7, 14], topic: "tensions" },
  { id: "maj9", name: "maj9", ints: [0, 4, 7, 11, 14], topic: "tensions" },
  { id: "9", name: "9", ints: [0, 4, 7, 10, 14], topic: "tensions" },
  { id: "m9", name: "m9", ints: [0, 3, 7, 10, 14], topic: "tensions" },
  { id: "7b9", name: "7♭9", ints: [0, 4, 7, 10, 13], topic: "tensions" },
  { id: "13", name: "13", ints: [0, 4, 10, 14, 21], topic: "tensions" }
];
// 진행: 메이저 키 로마 숫자(마디당 1코드)
export const PROGRESSIONS_EAR = [
  { id: "I-IV-V-I", name: "I–IV–V–I", degs: [[0, "maj"], [5, "maj"], [7, "maj"], [0, "maj"]] },
  { id: "I-V-vi-IV", name: "I–V–vi–IV", degs: [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]] },
  { id: "I-vi-IV-V", name: "I–vi–IV–V", degs: [[0, "maj"], [9, "min"], [5, "maj"], [7, "maj"]] },
  { id: "vi-IV-I-V", name: "vi–IV–I–V", degs: [[9, "min"], [5, "maj"], [0, "maj"], [7, "maj"]] },
  { id: "ii-V-I-I", name: "ii–V–I", degs: [[2, "m7"], [7, "7"], [0, "maj7"], [0, "maj7"]] },
  { id: "I-IV-I-V", name: "I–IV–I–V", degs: [[0, "maj"], [5, "maj"], [0, "maj"], [7, "maj"]] }
];
const Q = id => CHORD_QUALITIES.find(q => q.id === id);

// 가까운 자리 보이싱: 근음을 C3~B3(48~59)에 두고 위로 쌓음
export function chordMidis(rootPc, qid, base = 48) {
  const root = base + mod(rootPc - base);
  return Q(qid).ints.map(i => root + i);
}
export function chordPrompt(topics, rand = Math.random, avoid = null) {
  const t = (topics && topics.length ? topics : ["triads"]);
  if (t.includes("progressions") && (t.length === 1 || rand() < 1 / t.length)) {
    let p = pick(PROGRESSIONS_EAR, rand);
    if (avoid && p.id === avoid) p = pick(PROGRESSIONS_EAR, rand);
    const key = Math.floor(rand() * 12);
    return { kind: "prog", answer: p.id, key, chords: p.degs.map(([d, q]) => chordMidis(key + d, q)), choices: PROGRESSIONS_EAR.map(x => ({ v: x.id, label: x.name })) };
  }
  const qs = CHORD_QUALITIES.filter(q => t.includes(q.topic));
  const list = qs.length ? qs : CHORD_QUALITIES.filter(q => q.topic === "triads");
  let q = pick(list, rand);
  if (avoid && list.length > 1) for (let i = 0; i < 5 && q.id === avoid; i++) q = pick(list, rand);
  const root = Math.floor(rand() * 12);
  return { kind: "chord", answer: q.id, root, midis: chordMidis(root, q.id), choices: list.map(x => ({ v: x.id, label: x.name })) };
}

// ── E3 화성(구성음·보이싱) ──
// 자리바꿈: 기본·1전위·2전위 / 맨 위 음: 근음·3음·5음
export const HARM_KINDS = [["inversion", "자리바꿈"], ["top", "맨 위 음"], ["mix", "섞기"]];
export function harmPrompt({ kind = "mix" } = {}, rand = Math.random) {
  const k = kind === "mix" ? pick(["inversion", "top"], rand) : kind;
  const q = pick(["maj", "min"], rand), root = Math.floor(rand() * 12);
  const base = chordMidis(root, q);                          // [R, 3, 5]
  const inv = Math.floor(rand() * 3);
  const v = base.map((m, i) => (i < inv ? m + 12 : m)).sort((a, b) => a - b);
  const top = ["R", "3", "5"][(inv + 2) % 3];
  if (k === "inversion") return { kind: k, midis: v, quality: q, answer: String(inv), choices: [["0", "기본 자리(근음이 아래)"], ["1", "1전위(3음이 아래)"], ["2", "2전위(5음이 아래)"]].map(([v2, l]) => ({ v: v2, label: l })) };
  return { kind: k, midis: v, quality: q, answer: top, choices: [["R", "근음"], ["3", "3음"], ["5", "5음"]].map(([v2, l]) => ({ v: v2, label: l })) };
}

// ── E3 선율 채보 ──
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
// 음 번호: -3(낮은 5) … 0(1) … 6(7) … 7(높은 1)
export const DEGREE_KEYS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
export function degreeLabel(k, scale = "major") {
  const d = ((k % 7) + 7) % 7;
  const acc = scale === "minor" && [2, 5, 6].includes(d) ? "♭" : "";
  const base = `${acc}${d + 1}`;
  return k < 0 ? `낮은 ${base}` : k >= 7 ? `높은 ${base}` : base;
}
export function degreeMidi(k, tonic, scale = "major") {
  const st = scale === "minor" ? MINOR : MAJOR;
  const oct = Math.floor(k / 7), d = ((k % 7) + 7) % 7;
  return tonic + oct * 12 + st[d];
}
export function melodyPrompt({ len = 4, scale = "major", leaps = false, key = null, rhythm = false } = {}, rand = Math.random) {
  const tonicPc = key == null ? Math.floor(rand() * 12) : key;
  const tonic = 55 + mod(tonicPc - 55);                       // G3~F♯4
  const seq = [];
  let cur = pick([0, 2, 4], rand);
  for (let i = 0; i < len; i++) {
    if (i > 0) {
      const steps = leaps ? [-4, -3, -2, -1, 1, 2, 3, 4] : [-2, -1, -1, 1, 1, 2];
      let nx = cur, tries = 0;
      do { nx = cur + pick(steps, rand); tries++; } while ((nx < -3 || nx > 7) && tries < 20);
      cur = Math.max(-3, Math.min(7, nx));
    }
    seq.push(cur);
  }
  // 마지막 음은 1·3·5 중 하나로 끝나게(조성감)
  if (![0, 2, 4, 7].includes(seq[len - 1])) seq[len - 1] = [0, 2, 4].reduce((a, b) => (Math.abs(b - seq[len - 2]) < Math.abs(a - seq[len - 2]) ? b : a));
  const midis = seq.map(k => degreeMidi(k, tonic, scale));
  const rhy = rhythm ? melodyRhythm(len, rand) : seq.map((_, i) => ({ at: i * 2, len: 2 }));  // 8분 칸 단위
  return { tonicPc, tonic, scale, seq, midis, rhythm: rhy, answer: seq.join(",") };
}
// 한 마디(8분 8칸) 안에 len개 음 시작 위치
export function melodyRhythm(len, rand = Math.random) {
  const n = Math.max(1, Math.min(8, len));
  const pos = [0];
  const cand = [1, 2, 3, 4, 5, 6, 7];
  while (pos.length < n) { const p = pick(cand, rand); if (!pos.includes(p)) pos.push(p); }
  pos.sort((a, b) => a - b);
  return pos.map((p, i) => ({ at: p, len: (pos[i + 1] ?? 8) - p }));
}
export const rhythmSig = r => r.map(x => `${x.at}:${x.len}`).join(" ");
// 리듬 보기 3개(정답 + 같은 음 개수의 다른 리듬 2개)
export function rhythmChoices(r, rand = Math.random) {
  const out = [r], sigs = new Set([rhythmSig(r)]);
  for (let i = 0; i < 40 && out.length < 3; i++) { const x = melodyRhythm(r.length, rand); if (!sigs.has(rhythmSig(x))) { sigs.add(rhythmSig(x)); out.push(x); } }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// 리듬 → 리듬 악보용 패턴(8칸 격자, 방향 표시 없음)
export function rhythmPattern(r) {
  const tokens = Array(8).fill(".");
  for (const x of r) tokens[x.at] = x.at % 2 ? "u" : "d";
  return { id: "EAR", kind: "strum", topic: "", name: "", grid: 8, tokens, bars: 1, opts: {}, tip: "" };
}
export function checkSequence(answer, given) {
  const a = answer, g = given;
  let firstWrong = -1;
  for (let i = 0; i < Math.max(a.length, g.length); i++) if (a[i] !== g[i]) { firstWrong = i; break; }
  return { ok: firstWrong === -1, firstWrong, correctCount: a.filter((x, i) => x === g[i]).length };
}

// ── E4 프레이즈 채보 ──
export const GENRE_OF = l => {
  if (["blues", "intro", "iv-change", "turnaround", "ending", "shuffle"].includes(l.sub)) return "blues";
  if (["minor-penta", "major-penta", "mixed"].includes(l.sub)) return l.feel === "straight" ? "rock" : "blues";
  if (["dorian", "mixolydian"].includes(l.sub)) return "funk";
  if (["major-251", "minor-251", "v-i", "arpeggio", "two-chord"].includes(l.sub)) return "jazz";
  return null;
};
export const phrasePool = topics => { const t = topics && topics.length ? topics : ["blues", "rock", "funk", "jazz"]; return LICKS.filter(l => t.includes(GENRE_OF(l))); };
// 판정할 음: 쉼표 빼고 이벤트마다 가장 높은 음(겹음은 윗음)
export function phraseTargets(l, maxNotes = 0) {
  const ev = l.events.filter(e => !e.rest && e.notes.length && !e.rel);
  const cut = maxNotes > 0 ? ev.slice(0, maxNotes) : ev;
  return cut.map(e => ({ midi: Math.max(...e.notes.map(n => TUNING[n.s - 1] + n.f)), at: e.at, ev: e }));
}
// 연주할 부분: 판정할 마지막 음까지 자른 릭
export function phraseCut(l, maxNotes = 0) {
  const t = phraseTargets(l, maxNotes);
  if (!t.length) return l;
  const last = t[t.length - 1].ev;
  const events = l.events.filter(e => e.at <= last.at);
  return { ...l, events, ticks: last.at + last.dur };
}
