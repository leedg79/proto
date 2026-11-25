// 코드 전환하며 익히기(규칙): 레벨(스케일 종류)별 진행과 "코드마다 쓰는 스케일"
// 각 마디 → { scaleId, rootPc } (스케일 근음), 코드톤은 마디 코드에서
import { buildBacking, QUALITY } from "../../audio/backing.js";
import { SCALES } from "../../theory/scales.js";

const mod = n => ((n % 12) + 12) % 12;
const keyRoot = (scaleId) => (b, key) => ({ scaleId, rootPc: key });
const chordRoot = (scaleId) => (b) => ({ scaleId, rootPc: b.rootPc });

export const CS_PROGS = {
  pb: {
    "blues-minor": { name: "12마디 블루스 · 마이너 펜타 유지", prog: "blues12", map: keyRoot("minor-penta"), tip: "같은 마이너 펜타 블록에서, 코드가 바뀌면 그 코드의 근음·3음(주황)에 착지" },
    "blues-chord": { name: "12마디 블루스 · 코드마다 메이저 펜타", prog: "blues12", map: chordRoot("major-penta"), tip: "A7에서는 A 메이저 펜타, D7에서는 D 메이저 펜타처럼 코드 근음 기준으로 모양을 옮김" },
    "minor-blues": { name: "마이너 블루스 · 마이너 펜타", prog: "minor-blues", map: keyRoot("minor-penta"), tip: "♭VI7·V7 마디에서는 주황(코드톤)으로 착지해 진행감을 살림" },
    "pop-major": { name: "팝 I–V–vi–IV · 메이저 펜타", prog: "pop", map: keyRoot("major-penta"), tip: "한 모양 안에서 코드마다 근음·3음을 골라 착지" }
  },
  mm: {
    "major251": { name: "메이저 ii–V–I · 메이저 스케일", prog: "major251", map: keyRoot("major"), tip: "같은 메이저 스케일, 코드가 바뀔 때 코드톤(주황)으로 착지" },
    "1625": { name: "I–vi–ii–V · 메이저 스케일", prog: "1625", map: keyRoot("major"), tip: "4마디 순환, 마디 첫 박에 코드톤" },
    "minor251": { name: "마이너 ii–V–i · 내추럴↔하모닉 마이너", prog: "minor251", map: (b, key) => (b.quality === "7♭9" ? { scaleId: "harmonic-minor", rootPc: key } : { scaleId: "natural-minor", rootPc: key }), tip: "V7에서만 하모닉 마이너(7음이 반음 올라감)로 바꿈" },
    "minor-blues-nm": { name: "마이너 블루스 · 내추럴 마이너", prog: "minor-blues", map: (b, key) => (b.quality === "7" && mod(b.rootPc - key) === 7 ? { scaleId: "harmonic-minor", rootPc: key } : { scaleId: "natural-minor", rootPc: key }), tip: "V7 마디는 하모닉 마이너" }
  },
  md: {
    "251-modes": { name: "ii–V–I · 도리안→믹솔리디안→아이오니안", prog: "major251", map: b => ({ scaleId: b.quality === "m7" ? "dorian" : b.quality === "7" ? "mixolydian" : "ionian", rootPc: b.rootPc }), tip: "같은 음들이지만 코드 근음 기준 모드 이름과 착지음이 바뀜" },
    "1625-modes": { name: "I–vi–ii–V · 모드 전환", prog: "1625", map: (b, key) => ({ scaleId: b.quality === "maj7" ? "ionian" : b.quality === "7" ? "mixolydian" : mod(b.rootPc - key) === 9 ? "aeolian" : "dorian", rootPc: b.rootPc }), tip: "vi는 에올리안, ii는 도리안" },
    "dorian-vamp": { name: "im7–IV7 뱀프 · 도리안/믹솔리디안", prog: "dorian-vamp", map: b => ({ scaleId: b.quality === "m7" ? "dorian" : "mixolydian", rootPc: b.rootPc }), tip: "im7은 도리안(6음이 색깔음), IV7은 믹솔리디안" },
    "mixo-vamp": { name: "I7–♭VII 뱀프 · 믹솔리디안/아이오니안", prog: "mixo-vamp", map: (b, key) => ({ scaleId: b.quality === "7" ? "mixolydian" : "ionian", rootPc: b.rootPc }), tip: "I7은 믹솔리디안, ♭VII는 같은 음을 ♭VII 근음 기준 아이오니안으로" }
  }
};

// 진행 전체: 마디마다 코드·스케일·코드톤
export function chordScalePlan(level, id, key) {
  const def = CS_PROGS[level][id];
  const song = buildBacking({ prog: def.prog, key }, () => 0.5);
  return {
    name: def.name, tip: def.tip, prog: def.prog, style: song.style,
    bars: song.bars.map(b => {
      const m = def.map(b, key);
      const tones = new Set(QUALITY[b.quality].map(x => mod(b.rootPc + x)));
      return { name: b.name, rootPc: b.rootPc, quality: b.quality, scaleId: m.scaleId, scaleRoot: m.rootPc, tones };
    })
  };
}
export const scaleNameOf = id => (SCALES[id] ? SCALES[id].name : id);
