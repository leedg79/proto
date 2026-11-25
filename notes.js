// 음 이름·지판 계산 (모듈 공용, 화면과 무관)

// 표준 튜닝: 1번 현(가장 가는 E)부터 6번 현까지의 MIDI 번호
export const TUNING = [64, 59, 55, 50, 45, 40];

// 음높이 12개(pitch class)별 표기. 두 이름이 있는 음은 [샤프, 플랫]
// E♯·F♭·B♯·C♭ 같은 드문 표기는 쓰지 않음
export const SPELLINGS = [
  ["C"], ["C♯", "D♭"], ["D"], ["D♯", "E♭"], ["E"], ["F"],
  ["F♯", "G♭"], ["G"], ["G♯", "A♭"], ["A"], ["A♯", "B♭"], ["B"]
];

export function spell(pc, rand = Math.random) {
  const names = SPELLINGS[((pc % 12) + 12) % 12];
  return names.length === 1 ? names[0] : names[Math.floor(rand() * names.length)];
}

export function pcOf(name) {
  for (let pc = 0; pc < 12; pc++) if (SPELLINGS[pc].includes(name)) return pc;
  return -1;
}

export function midiAt(string, fret) {
  return TUNING[string - 1] + fret;
}

// 지정한 현들에서 해당 음높이가 나오는 모든 위치 (0~maxFret)
export function positionsOf(pc, strings = [1, 2, 3, 4, 5, 6], maxFret = 15) {
  const out = [];
  for (const s of strings) {
    for (let f = 0; f <= maxFret; f++) {
      if (midiAt(s, f) % 12 === pc) out.push({ s, f });
    }
  }
  return out;
}
