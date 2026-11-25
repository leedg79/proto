// Chords 학습 주제별 출제 규칙
// 문제는 "스펙"(주제·근음·코드 종류·조건)만 저장하고, 정답 운지는 표시할 때 엔진으로 다시 계산함

import * as V from "../../theory/voicings.js";
import { CHORD_TYPES, rootName, chordName, toneNames } from "../../theory/chords.js";

const pick = (a, rand) => a[Math.floor(rand() * a.length)];
const mod = n => ((n % 12) + 12) % 12;
const setText = set => [...set].sort((a, b) => a - b).join("-") + "번 현";
const INV_TEXT = ["기본형(베이스 근음)", "1전위(베이스 3도)", "2전위(베이스 5도)", "3전위(베이스 7도)"];

// 주제별: spec 만들기 → { topic, root, rootLabel, type, ...조건 }
const MAKERS = {
  open: (root, rand, ctx) => {
    const c = ctx.openPick();
    return { root: c.pc, rootLabel: c.name.replace(/m7|m|7/g, "").replace(/^([A-G])$/, "$1"), type: c.type };
  },
  triad: (root, rand) => ({ root, type: pick(["maj", "m"], rand) }),
  power: root => ({ root, type: "5" }),
  barre: (root, rand) => ({ root, type: pick(["maj", "m", "7", "m7"], rand) }),
  "dim-aug-sus": (root, rand) => ({ root, type: pick(["dim", "aug", "sus2", "sus4"], rand) }),
  "triad-inversion": (root, rand) => ({ root, type: pick(["maj", "m"], rand), inversion: pick([0, 1, 2], rand) }),
  "string-set-triad": (root, rand) => ({ root, type: pick(["maj", "m"], rand), set: pick(V.TRIAD_SETS, rand) }),
  caged: (root, rand) => ({ root, type: "maj", form: pick(Object.keys(V.CAGED_FORMS), rand) }),
  seventh: (root, rand) => ({ root, type: pick(["maj7", "7", "m7", "m7b5", "dim7"], rand) }),
  "seventh-inversion": (root, rand) => ({ root, type: pick(["maj7", "7", "m7", "m7b5"], rand), inversion: pick([1, 2, 3], rand) }),
  shell: (root, rand) => ({ root, type: pick(["maj7", "7", "m7", "m7b5"], rand) }),
  drop2: (root, rand) => ({ root, type: pick(["maj7", "7", "m7", "m7b5"], rand), set: pick(V.DROP2_SETS, rand) }),
  drop3: (root, rand) => ({ root, type: pick(["maj7", "7", "m7", "m7b5"], rand), set: pick(V.DROP3_SETS, rand) }),
  tension: (root, rand) => ({ root, type: pick(V.TENSION_TYPES, rand) }),
  substitute: (root, rand) => {
    const kind = pick(["tritone", "relMinor", "relMajor"], rand);
    if (kind === "tritone") return { root, type: "7", sub: kind, from: { root: mod(root + 6), type: "7" } };
    if (kind === "relMinor") return { root, type: "m", sub: kind, from: { root: mod(root + 3), type: "maj" } };
    return { root, type: "maj", sub: kind, from: { root: mod(root - 3), type: "m" } };
  },
  slash: (root, rand) => {
    const b = pick([4, 7, 10, 2], rand);
    return { root, type: "maj", bass: mod(root + b), bassRel: b };
  },
  "open-voicing": (root, rand) => ({ root, type: pick(["maj", "m"], rand) }),
  quartal: (root, rand) => ({ root, type: "maj", count: pick([3, 4], rand) })
};

export const RANDOM_TOPICS = Object.keys(MAKERS);

// 정답 운지 계산
export function answersOf(spec) {
  const { topic, root, type } = spec;
  switch (topic) {
    case "open": return V.openVoicingsOf(root, type);
    case "triad": case "dim-aug-sus": return V.closeTriads(root, type);
    case "power": return V.powerVoicings(root);
    case "barre": return V.barreVoicings(root, type);
    case "triad-inversion": return V.closeTriads(root, type, { inversions: [spec.inversion] });
    case "string-set-triad": return V.closeTriads(root, type, { sets: [spec.set] });
    case "caged": return V.cagedVoicings(root, spec.form);
    case "seventh": return [...V.barreVoicings(root, type), ...V.dropVoicings(root, type, { drop: 2, inversions: [0] }), ...V.dropVoicings(root, type, { drop: 3, inversions: [0] })];
    case "seventh-inversion": return [...V.dropVoicings(root, type, { drop: 2, inversions: [spec.inversion] }), ...V.dropVoicings(root, type, { drop: 3, inversions: [spec.inversion] })];
    case "shell": return V.shellVoicings(root, type);
    case "drop2": return V.dropVoicings(root, type, { drop: 2, sets: [spec.set] });
    case "drop3": return V.dropVoicings(root, type, { drop: 3, sets: [spec.set] });
    case "tension": return V.tensionVoicings(root, type);
    case "substitute": return spec.sub === "tritone"
      ? [...V.dropVoicings(root, "7", { drop: 2, inversions: [0] }), ...V.shellVoicings(root, "7")]
      : V.closeTriads(root, type);
    case "slash": return V.slashVoicings(root, type, spec.bass);
    case "open-voicing": return V.spreadTriads(root, type);
    case "quartal": return V.quartalVoicings(root, spec.count);
    default: return [];
  }
}

// 문제 화면 문구
export function describe(spec) {
  const name = chordName(spec.rootLabel, spec.type);
  const base = { answerName: name, tones: toneNames(spec.root, spec.type, spec.rootLabel) };
  switch (spec.topic) {
    case "open": return { ...base, title: name, sub: "오픈 코드" };
    case "triad": return { ...base, title: name, sub: "트라이어드 · 연속 3현 밀집 배치" };
    case "power": return { ...base, title: name, sub: "파워 코드 · 근음 6·5번 현" };
    case "barre": return { ...base, title: name, sub: "바레·이동형 · E폼/A폼" };
    case "dim-aug-sus": return { ...base, title: name, sub: `${CHORD_TYPES[spec.type].name} · 연속 3현` };
    case "triad-inversion": return { ...base, title: name, sub: `트라이어드 · ${INV_TEXT[spec.inversion]}` };
    case "string-set-triad": return { ...base, title: name, sub: `트라이어드 · ${setText(spec.set)}` };
    case "caged": return { ...base, title: name, sub: `CAGED · ${spec.form}폼` };
    case "seventh": return { ...base, title: name, sub: "7th 코드 · 근음이 베이스" };
    case "seventh-inversion": return { ...base, title: name, sub: `7th 전위 · ${INV_TEXT[spec.inversion]}` };
    case "shell": return { ...base, title: name, sub: "Shell Voicing · R-3-7 / R-7-3" };
    case "drop2": return { ...base, title: name, sub: `Drop 2 · ${setText(spec.set)}` };
    case "drop3": return { ...base, title: name, sub: `Drop 3 · ${setText(spec.set)}` };
    case "tension": return { ...base, title: name, sub: "텐션 · 4음 보이싱" };
    case "substitute": {
      const fromName = chordName(spec.fromLabel, spec.from.type);
      const q = { tritone: `${fromName}의 트라이톤 대리 코드`, relMinor: `${fromName}의 관계 단조 대리 코드`, relMajor: `${fromName}의 관계 장조 대리 코드` }[spec.sub];
      return { ...base, title: q, sub: "대리 코드 · 코드명을 떠올린 뒤 운지", question: true };
    }
    case "slash": return { ...base, title: `${name}/${spec.bassLabel}`, answerName: `${name}/${spec.bassLabel}`, sub: "슬래시 코드 · 베이스 6·5번 현" };
    case "open-voicing": return { ...base, title: name, sub: "Open Voicing · 펼친 트라이어드" };
    case "quartal": {
      const names = [0, 5, 10, 15].slice(0, spec.count).map(i => rootName(mod(spec.root + i), () => 0.99));
      return { ...base, title: `${spec.rootLabel} 4도 쌓기`, answerName: `${spec.rootLabel} Quartal (${names.join("-")})`, tones: names, sub: `Quartal · ${spec.count}음` };
    }
    default: return { ...base, title: name, sub: "" };
  }
}

// 주제 하나로 문제 1개 만들기 (정답 운지가 없으면 근음을 바꿔 재시도)
export function makeSpec(topic, root, rand, ctx) {
  for (let t = 0; t < 12; t++) {
    const r = mod(root + t * 5);
    const s = { topic, ...MAKERS[topic](r, rand, ctx) };
    s.rootLabel = s.rootLabel && topic === "open" ? s.rootLabel : rootName(s.root, rand);
    if (s.from) s.fromLabel = rootName(s.from.root, rand);
    if (s.bass != null) s.bassLabel = rootName(s.bass, rand);
    if (answersOf(s).length) return s;
  }
  throw new Error("출제할 수 있는 운지가 없음: " + topic);
}

// 12문제 묶음: 근음 12개를 섞어 한 번씩, 고른 주제를 고르게 섞음
export function buildDeck(topics, rand = Math.random, size = 12) {
  const roots = Array.from({ length: 12 }, (_, i) => i);
  for (let i = roots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [roots[i], roots[j]] = [roots[j], roots[i]]; }
  const order = [];
  while (order.length < size) {
    const round = [...topics];
    for (let i = round.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [round[i], round[j]] = [round[j], round[i]]; }
    order.push(...round);
  }
  const opens = V.openChordList();
  for (let i = opens.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opens[i], opens[j]] = [opens[j], opens[i]]; }
  let oi = 0;
  const ctx = { openPick: () => opens[oi++ % opens.length] };
  return order.slice(0, size).map((topic, i) => makeSpec(topic, roots[i % 12], rand, ctx));
}
