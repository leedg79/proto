// 장르별 컴핑 규칙 (순수 함수): 장르 → 진행·반주 스타일·리듬 패턴·운지 종류, 마디별 운지 고르기
import { PROGRESSIONS, parseRoman, chordName } from "../../audio/backing.js";
import { closeTriads, dropVoicings, shellVoicings, barreVoicings, powerVoicings, tensionVoicings, openVoicingsOf, isPlayable } from "../../theory/voicings.js";

const mod = n => ((n % 12) + 12) % 12;
// 리듬: b = 박 위치(0~3.75), d = 길이(박), up = 업 스트럼, mute = 뮤트 커팅(x), acc = 강세
export const GENRES = {
  "blues-shuffle": { name: "블루스 셔플", prog: "blues12", style: "shuffle", voicing: "ninth", pattern: [{ b: 1, d: 0.3, acc: 1 }, { b: 3, d: 0.3, acc: 1 }], tip: "2·4박을 짧게 끊어 치기(손바닥으로 바로 뮤트)" },
  "rock-8": { name: "록 8비트", prog: "rock", style: "straight", voicing: "power", pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(b => ({ b, d: 0.4, acc: b % 2 === 0 ? 1 : 0 })), tip: "파워 코드 다운 피킹 8분음표, 팜뮤트로 살짝 눌러 치기" },
  "funk-16": { name: "펑크 16비트", prog: "mixo-vamp", style: "straight", voicing: "ninth", compInst: "guitar", pattern: [{ b: 0, d: 0.2, acc: 1 }, { b: 0.75, d: 0.15 }, { b: 1.25, mute: 1 }, { b: 1.5, d: 0.2 }, { b: 2.25, mute: 1 }, { b: 2.5, d: 0.2, acc: 1 }, { b: 3.25, mute: 1 }, { b: 3.5, d: 0.15, up: 1 }], tip: "손목은 16분음표로 계속 움직이고, 표시된 칸만 줄에 닿게. x는 왼손을 살짝 떼어 '칙' 소리" },
  "jazz-charleston": { name: "재즈 스윙(찰스턴)", prog: "1625", style: "swing", voicing: "shell", pattern: [{ b: 0, d: 0.9 }, { b: 1.5, d: 0.35, acc: 1 }], tip: "1박 길게, 2박 뒷박 짧게. 셸 보이싱(근음·3음·7음)" },
  "jazz-4": { name: "재즈 포 투 더 바", prog: "major251", style: "swing", voicing: "shell", pattern: [0, 1, 2, 3].map(b => ({ b, d: 0.55, acc: b % 2 ? 1 : 0 })), tip: "4분음표마다 짧고 고르게(프레디 그린 스타일), 2·4박에 살짝 강세" },
  "bossa": { name: "보사노바", prog: "major251", style: "bossa", voicing: "drop2", pattern: [0, 0.75, 1.5, 2.5, 3.25].map(b => ({ b, d: 0.4 })), tip: "엄지는 베이스(1·3박), 나머지 손가락으로 표시된 칸에 코드" },
  "reggae": { name: "레게 스캥크", prog: "pop", style: "reggae", voicing: "triad-high", compInst: "guitar", pattern: [{ b: 1, d: 0.18, acc: 1 }, { b: 3, d: 0.18, acc: 1 }], tip: "2·4박 뒤에 아주 짧게 업·다운 스캥크, 1·2번 줄 위주 트라이어드" },
  "pop-strum": { name: "팝 스트럼", prog: "pop", style: "straight", voicing: "open", pattern: [{ b: 0, d: 0.9, acc: 1 }, { b: 1, d: 0.45 }, { b: 1.5, d: 0.45, up: 1 }, { b: 2.5, d: 0.45, up: 1 }, { b: 3, d: 0.45 }, { b: 3.5, d: 0.45, up: 1 }], tip: "다운·다운업·업다운업. 손은 8분음표로 계속 흔들고 2박 뒤·3박에서 헛스윙" }
};

// 진행 코드 종류 → 운지 엔진 코드 종류
const TYPE = { "": "maj", m: "m", "7": "7", maj7: "maj7", m7: "m7", "ø7": "m7b5", "7♭9": "7" };

function candidates(rootPc, quality, kind) {
  const t = TYPE[quality] || "maj";
  const triadT = ["m", "m7", "m7b5"].includes(t) ? "m" : "maj";
  let list = [];
  if (kind === "power") list = powerVoicings(rootPc);
  else if (kind === "ninth") list = t === "7" ? [...tensionVoicings(rootPc, "9"), ...barreVoicings(rootPc, "7")] : t === "m7" || t === "m" ? [...tensionVoicings(rootPc, "m9"), ...barreVoicings(rootPc, "m7")] : barreVoicings(rootPc, t);
  else if (kind === "shell") list = ["maj7", "7", "m7", "m7b5"].includes(t) ? shellVoicings(rootPc, t) : shellVoicings(rootPc, t === "m" ? "m7" : "maj7");
  else if (kind === "drop2") list = dropVoicings(rootPc, ["maj7", "7", "m7", "m7b5"].includes(t) ? t : t === "m" ? "m7" : "maj7", { drop: 2 });
  else if (kind === "triad-high") list = closeTriads(rootPc, triadT).filter(v => v.notes.every(n => n.s <= 3));
  else list = [...openVoicingsOf(rootPc, ["maj", "m", "7", "m7", "maj7"].includes(t) ? t : triadT), ...barreVoicings(rootPc, ["maj", "m", "7", "m7", "maj7"].includes(t) ? t : triadT)];
  return list.filter(v => v.notes.length >= 2 && isPlayable(v.frets) && Math.max(...v.notes.map(n => n.f)) <= 12);
}
const center = v => { const fr = v.notes.map(n => n.f).filter(f => f > 0); return fr.length ? (Math.min(...fr) + Math.max(...fr)) / 2 : 1.5; };

// 진행 전체 운지: 앞 코드와 손 위치가 가까운 운지를 고름(시작은 3~8프렛 근처)
export function progVoicings(progId, key, kind) {
  const bars = PROGRESSIONS[progId].bars.map(tok => { const c = parseRoman(tok); return { tok, rootPc: mod(key + c.root), quality: c.quality, name: chordName(key, tok) }; });
  let hand = kind === "open" ? 2 : 5.5;
  const out = [];
  const cache = new Map();
  for (const b of bars) {
    if (cache.has(b.name)) { out.push(cache.get(b.name)); continue; }
    const list = candidates(b.rootPc, b.quality, kind);
    const pick = list.sort((x, y) => Math.abs(center(x) - hand) - Math.abs(center(y) - hand))[0] || null;
    if (pick) hand = center(pick);
    cache.set(b.name, pick);
    out.push(pick);
  }
  return { bars, voicings: out };
}
export function compVoicings(genreId, key) {
  const g = GENRES[genreId];
  return progVoicings(g.prog, key, g.voicing);
}
