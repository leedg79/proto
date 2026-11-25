// Play Session 진행 생성기 (순수 함수)
// - 키·진행 유형으로 A-A-B-A′(각 8마디, 4/4) 32마디 진행을 만듦
// - 섹션마다 고른 학습 주제를 하나씩 맡겨 화성(3화음/7th/텐션)과 보이싱 방식을 정함
// - 보이싱은 주제별 규칙으로 고르고, 이동형 주제는 앞 코드와 가장 가까운 운지(보이스 리딩)를 고름

import * as V from "../../theory/voicings.js";
import { chordName } from "../../theory/chords.js";

const mod = n => ((n % 12) + 12) % 12;
export const KEYS = [
  { pc: 0, name: "C" }, { pc: 7, name: "G" }, { pc: 2, name: "D" }, { pc: 9, name: "A" }, { pc: 4, name: "E" },
  { pc: 5, name: "F" }, { pc: 10, name: "B♭" }, { pc: 3, name: "E♭" }, { pc: 8, name: "A♭" }, { pc: 1, name: "D♭" }, { pc: 6, name: "G♭" }, { pc: 11, name: "B" }
];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]);
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function noteName(pc, keyPc, chromatic = false) {
  return (FLAT_KEYS.has(keyPc) || chromatic ? FLAT_NAMES : SHARP_NAMES)[mod(pc)];
}

// 진행 템플릿: 마디마다 코드 1~2개. 숫자 = 장음계 도수, 객체 = 도수 밖 코드(rel 반음, q 성질)
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const DEG_Q = { 1: "M", 2: "m", 3: "m", 4: "M", 5: "dom", 6: "m", 7: "hdim" };
const ROMAN = { 1: "I", 2: "ii", 3: "iii", 4: "IV", 5: "V", 6: "vi", 7: "vii" };
const II7 = { rel: 2, q: "dom", roman: "II7" };
const BVII7 = { rel: 10, q: "dom", roman: "♭VII7" };

export const STYLES = {
  pop: { name: "Pop", A: [[1], [5], [6], [4], [1], [5], [4], [5]], B: [[6], [4], [1], [5], [6], [4], [2], [5]], A2: [[1], [5], [6], [4], [1], [5], [4, 5], [1]] },
  ballad: { name: "Ballad", A: [[1], [6], [4], [5], [1], [6], [2], [5]], B: [[4], [5], [3], [6], [2], [5], [4], [5]], A2: [[1], [6], [4], [5], [1], [6], [2, 5], [1]] },
  jazz: { name: "Jazz (ii-V-I)", A: [[1], [6], [2], [5], [1], [6], [2], [5]], B: [[4], [4], [3], [6], [2], [2], [5], [5]], A2: [[1], [6], [2], [5], [3, 6], [2, 5], [1], [1]] },
  bossa: { name: "Bossa Nova", A: [[1], [1], [II7], [II7], [2], [5], [1], [1]], B: [[4], [4], [BVII7], [BVII7], [3], [6], [2], [5]], A2: [[1], [1], [II7], [II7], [2], [5], [1], [1]] }
};

// 주제 → 화성 단계와 보이싱 방식
const TIER = {
  open: "triad", triad: "triad", power: "power", barre: "triad", "dim-aug-sus": "triad", "triad-inversion": "triad",
  "string-set-triad": "triad", caged: "triad", slash: "triad", "open-voicing": "triad", quartal: "triad",
  seventh: "seventh", "seventh-inversion": "seventh", shell: "seventh", drop2: "seventh", drop3: "seventh",
  substitute: "seventh", "voice-leading": "seventh", tension: "tension"
};
// "common": 가장 자주 쓰는 운지 / "near": 앞 코드와 가장 가까운 운지
const MODE = {
  open: "common", power: "common", barre: "common", seventh: "common", tension: "common", caged: "near",
  triad: "near", "dim-aug-sus": "near", "triad-inversion": "near", "string-set-triad": "near", "seventh-inversion": "near",
  shell: "near", drop2: "near", drop3: "near", substitute: "near", "voice-leading": "near", slash: "near", "open-voicing": "near", quartal: "near"
};
export const PLAY_TOPICS = Object.keys(TIER);

function typeFor(q, tier, deg) {
  if (tier === "power") return "5";
  if (tier === "triad") return { M: "maj", m: "m", dom: "maj", hdim: "dim", dim: "dim" }[q];
  if (tier === "tension") {
    if (deg === 3) return "m7";
    return { M: "maj9", m: "m9", dom: "9", hdim: "m7b5", dim: "dim7" }[q];
  }
  return { M: "maj7", m: "m7", dom: "7", hdim: "m7b5", dim: "dim7" }[q];
}

const TYPE_SUFFIX_ROMAN = { maj: "", m: "", dim: "°", aug: "+", sus4: "sus4", "5": "5", maj7: "maj7", m7: "7", "7": "7", m7b5: "ø7", dim7: "°7", maj9: "maj9", m9: "9", "9": "9" };

function romanOf(entry, type) {
  if (typeof entry === "object") return entry.roman;
  const r = ROMAN[entry];
  const upper = ["maj", "maj7", "7", "9", "maj9", "5", "sus4", "aug"].includes(type);
  const base = upper ? r.toUpperCase() : r.toLowerCase();
  return base + (TYPE_SUFFIX_ROMAN[type] ?? "");
}

// 템플릿 한 섹션 → 코드 목록 (마디별)
function realizeSection(template, keyPc, tier) {
  return template.map(bar => bar.map(entry => {
    let rootPc, q, deg = null;
    if (typeof entry === "object") { rootPc = mod(keyPc + entry.rel); q = entry.q; }
    else { deg = entry; rootPc = mod(keyPc + MAJOR_STEPS[deg - 1]); q = DEG_Q[deg]; }
    const type = typeFor(q, tier, deg);
    return { rootPc, type, deg, roman: romanOf(entry, type), beats: 4 / bar.length, chromatic: typeof entry === "object" };
  }));
}

// 주제별 변형
// after: 다음 섹션의 첫 코드 (섹션 경계를 넘는 진행 판단용)
function applyTopic(bars, topic, keyPc, after) {
  if (topic === "dim-aug-sus") {
    // I로 가는 V는 V → V+(어그먼티드 도미넌트), 나머지 V는 Vsus4 → V, I에서 IV·vi로 갈 때는 I → I+
    return bars.map((bar, i) => {
      const nx = i + 1 < bars.length ? bars[i + 1][0] : after;
      if (bar.length === 1 && bar[0].deg === 5) {
        if (nx && nx.deg === 1) return [{ ...bar[0], beats: 2 }, { ...bar[0], type: "aug", roman: "V+", beats: 2 }];
        return [{ ...bar[0], type: "sus4", roman: "Vsus4", beats: 2 }, { ...bar[0], beats: 2 }];
      }
      if (bar.length === 1 && bar[0].deg === 1 && nx && [4, 6].includes(nx.deg)) return [{ ...bar[0], beats: 2 }, { ...bar[0], type: "aug", roman: "I+", beats: 2 }];
      return bar;
    });
  }
  if (topic === "substitute") {
    // 다음 코드가 I인 V7을 ♭II7(트라이톤 대리)로 바꿈
    const flat = [...bars.flat(), after].filter(Boolean);
    let k = 0;
    return bars.map(bar => bar.map(ch => {
      const nx = flat[++k];
      if (ch.deg === 5 && nx && nx.deg === 1) return { ...ch, rootPc: mod(ch.rootPc + 6), roman: "♭II7", sub: "V7 대리", chromatic: true };
      return ch;
    }));
  }
  if (topic === "slash") {
    // 다음 코드 근음으로 반음·온음 이동이 되도록 3도·5도를 베이스로
    const flat = [...bars.flat(), after].filter(Boolean);
    let k = 0;
    return bars.map(bar => bar.map(ch => {
      const nx = flat[++k];
      if (!nx || ch.type === "dim") return ch;
      const third = ch.type === "m" ? 3 : 4;
      let best = null;
      for (const rel of [third, 7]) {
        const b = mod(ch.rootPc + rel);
        const d = Math.min(mod(nx.rootPc - b), mod(b - nx.rootPc));
        if (d >= 1 && d <= 2 && (!best || d < best.d)) best = { rel, b, d };
      }
      const rootDist = Math.min(mod(nx.rootPc - ch.rootPc), mod(ch.rootPc - nx.rootPc));
      if (best && best.d < rootDist) return { ...ch, bassPc: best.b, roman: `${ch.roman}/${best.rel === 7 ? "5" : "3"}` };
      return ch;
    }));
  }
  return bars;
}

// 주제별 후보 운지
function candidates(topic, ch, sectionCtx) {
  const { rootPc: r, type } = ch;
  const triadLike = ["maj", "m", "dim", "aug", "sus4"].includes(type);
  const fallback = () => {
    if (triadLike) return V.closeTriads(r, type);
    const list = V.dropVoicings(r, type, { drop: 2 });
    return list.length ? list : V.shellVoicings(r, type);
  };
  let list = [];
  switch (topic) {
    case "open": list = V.openVoicingsOf(r, type); if (!list.length) list = V.barreVoicings(r, type); break;
    case "power": list = V.powerVoicings(r); break;
    case "barre": list = V.barreVoicings(r, type); break;
    case "caged": list = type === "maj" ? Object.keys(V.CAGED_FORMS).flatMap(f => V.cagedVoicings(r, f)) : V.barreVoicings(r, type); break;
    case "triad": case "dim-aug-sus": case "triad-inversion": list = triadLike ? V.closeTriads(r, type) : []; break;
    case "string-set-triad": list = triadLike ? V.closeTriads(r, type, { sets: [sectionCtx.triadSet] }) : []; break;
    case "open-voicing": list = ["maj", "m"].includes(type) ? V.spreadTriads(r, type) : []; break;
    case "quartal": list = V.quartalVoicings(r, 3); break;
    case "slash": list = ch.bassPc != null ? V.slashVoicings(r, type, ch.bassPc) : V.closeTriads(r, type); break;
    case "seventh": list = [...V.barreVoicings(r, type), ...V.dropVoicings(r, type, { drop: 2, inversions: [0] }), ...V.dropVoicings(r, type, { drop: 3, inversions: [0] })]; break;
    case "shell": list = V.shellVoicings(r, type); break;
    case "drop2": list = V.dropVoicings(r, type, { drop: 2, sets: [sectionCtx.drop2Set] }); break;
    case "drop3": list = V.dropVoicings(r, type, { drop: 3, sets: [sectionCtx.drop3Set] }); break;
    case "tension": list = V.TENSION_TYPES.includes(type) ? V.tensionVoicings(r, type) : V.shellVoicings(r, type); break;
    case "seventh-inversion": case "substitute": case "voice-leading": list = V.dropVoicings(r, type, { drop: 2 }); break;
    default: list = [];
  }
  return list.length ? list : fallback();
}

// 두 운지 사이 거리: 높은 음부터 짝지은 음높이 차이 합 + 손 위치 이동
export function voicingDistance(a, b) {
  const pa = a.notes.map(n => n.midi).sort((x, y) => y - x);
  const pb = b.notes.map(n => n.midi).sort((x, y) => y - x);
  const n = Math.min(pa.length, pb.length);
  let d = 0;
  for (let i = 0; i < n; i++) d += Math.abs(pa[i] - pb[i]);
  const pos = v => { const f = v.notes.filter(x => x.f > 0).map(x => x.f); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0; };
  return d + Math.abs(pos(a) - pos(b)) * 1.5;
}

const handPos = v => { const f = v.notes.filter(x => x.f > 0).map(x => x.f); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0; };

function choose(list, mode, prev, anchor) {
  if (!prev) return V.rankVoicings(list, { limit: 1 })[0];
  if (mode === "common") {
    // 자주 쓰는 운지 후보(최고 점수 +1 이내) 안에서 손 위치 이동이 가장 적은 것
    // → 근음 6번 현(E폼)·5번 현(A폼)을 바꿔 가며 섹션 시작 자리(anchor) 근처에 머묾
    const scored = list.map(v => ({ v, u: V.usageScore(v) }));
    const best = Math.min(...scored.map(x => x.u));
    let pick = null, bestCost = Infinity;
    for (const { v, u } of scored) {
      if (u > best + 1) continue;
      const p = handPos(v);
      const cost = Math.abs(p - handPos(prev)) * 1.5 + Math.abs(p - anchor) * 1.2 + voicingDistance(prev, v) * 0.15 + u * 0.5;
      if (cost < bestCost) { pick = v; bestCost = cost; }
    }
    return pick;
  }
  let best = null, bestCost = Infinity;
  for (const v of list) {
    const cost = voicingDistance(prev, v) + V.usageScore(v) * 2;
    if (cost < bestCost) { best = v; bestCost = cost; }
  }
  return best;
}

const SECTIONS = [["A", "A"], ["A", "A"], ["B", "B"], ["A′", "A2"]];

export function buildPlan({ keyPc, style, topics }, rand = Math.random) {
  const st = STYLES[style] || STYLES.pop;
  const order = [...topics];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const bars = [];
  let prev = null;
  const sectionTopics = SECTIONS.map((_, si) => order[si % order.length]);
  const raw = SECTIONS.map(([, key], si) => realizeSection(st[key], keyPc, TIER[sectionTopics[si]]));
  SECTIONS.forEach(([label], si) => {
    const topic = sectionTopics[si];
    const ctx = {
      triadSet: V.TRIAD_SETS[1 + Math.floor(rand() * 3)],
      drop2Set: V.DROP2_SETS[Math.floor(rand() * 2)],
      drop3Set: V.DROP3_SETS[Math.floor(rand() * 2)]
    };
    const after = si + 1 < raw.length ? raw[si + 1][0][0] : null;
    const realized = applyTopic(raw[si], topic, keyPc, after);
    let anchor = null;
    realized.forEach((bar, bi) => {
      bars.push({
        section: label, sectionIndex: si, barInSection: bi + 1, topic,
        chords: bar.map(ch => {
          const v = choose(candidates(topic, ch, ctx), MODE[topic], prev, anchor ?? (prev ? handPos(prev) : 0));
          if (anchor == null) anchor = handPos(v);
          prev = v;
          const rootLabel = noteName(ch.rootPc, keyPc, ch.chromatic && ch.sub);
          const name = chordName(rootLabel, ch.type) + (ch.bassPc != null ? "/" + noteName(ch.bassPc, keyPc) : "");
          return { name, roman: ch.roman, rootPc: ch.rootPc, type: ch.type, bassPc: ch.bassPc ?? null, beats: ch.beats, sub: ch.sub || null, voicing: { frets: v.frets, notes: v.notes, kind: v.kind, detail: v.detail, key: v.key } };
        })
      });
    });
  });
  return { keyPc, keyName: KEYS.find(k => k.pc === keyPc)?.name || noteName(keyPc, keyPc), style, styleName: st.name, topics: [...topics], bars };
}

// 박 → 마디·코드 위치 (4/4, 1마디 준비 박)
export const COUNT_IN = 4;
export const TOTAL_BARS = 32;

export function locate(plan, startBar, beat) {
  if (beat < COUNT_IN) return { phase: "count", countLeft: COUNT_IN - beat };
  const b = beat - COUNT_IN;
  const barIdx = startBar + Math.floor(b / 4);
  if (barIdx >= TOTAL_BARS) return { phase: "done" };
  const inBar = b % 4;
  const bar = plan.bars[barIdx];
  let acc = 0, ci = 0;
  for (; ci < bar.chords.length; ci++) { if (inBar < acc + bar.chords[ci].beats) break; acc += bar.chords[ci].beats; }
  return { phase: "play", barIdx, chordIdx: ci, chordStart: inBar === acc, barStart: inBar === 0 };
}

// 지금 코드 다음에 올 코드
export function nextChord(plan, barIdx, chordIdx) {
  const bar = plan.bars[barIdx];
  if (chordIdx + 1 < bar.chords.length) return bar.chords[chordIdx + 1];
  const nb = plan.bars[barIdx + 1];
  return nb ? nb.chords[0] : null;
}
