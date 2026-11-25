// 반주 생성 (순수 함수): 진행·키·스타일 → 마디별 코드와 드럼·베이스·코드 반주 이벤트
// 시간 단위 = 박(4분음표). 스윙·셔플은 재생할 때 8분음표 뒤쪽을 셋잇단 위치로 옮김

const mod = n => ((n % 12) + 12) % 12;
const SHARP = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]);
const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export const PROGRESSIONS = {
  "blues12": { name: "12마디 블루스", bars: ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"], style: "shuffle" },
  "blues12-quick": { name: "12마디 블루스(퀵 체인지)", bars: ["I7", "IV7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"], style: "shuffle" },
  "minor-blues": { name: "마이너 블루스", bars: ["im7", "im7", "im7", "im7", "ivm7", "ivm7", "im7", "im7", "♭VI7", "V7", "im7", "V7"], style: "shuffle" },
  "major251": { name: "메이저 ii–V–I", bars: ["iim7", "V7", "Imaj7", "Imaj7"], style: "swing" },
  "minor251": { name: "마이너 ii–V–i", bars: ["iiø7", "V7♭9", "im7", "im7"], style: "swing" },
  "1625": { name: "I–vi–ii–V", bars: ["Imaj7", "vim7", "iim7", "V7"], style: "swing" },
  "pop": { name: "팝 I–V–vi–IV", bars: ["I", "V", "vi", "IV"], style: "straight" },
  "rock": { name: "록 I–♭VII–IV–I", bars: ["I", "♭VII", "IV", "I"], style: "straight" },
  "dorian-vamp": { name: "도리안 뱀프 im7–IV7", bars: ["im7", "IV7", "im7", "IV7"], style: "straight" },
  "mixo-vamp": { name: "믹솔리디안 뱀프 I7–♭VII", bars: ["I7", "♭VII", "I7", "♭VII"], style: "straight" }
};
export const STYLES = { straight: "스트레이트(록·팝)", shuffle: "셔플(블루스)", swing: "스윙(재즈)", bossa: "보사노바", reggae: "레게(원 드롭)" };

const DEGREE = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
// 코드 종류 → 구성음(반음)
export const QUALITY = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  "ø7": [0, 3, 6, 10], "7♭9": [0, 4, 7, 10, 13]
};
const SUFFIX = { "": "", m: "m", "7": "7", maj7: "maj7", m7: "m7", "ø7": "m7♭5", "7♭9": "7(♭9)" };

// "iiø7" → { root: 키 기준 반음, quality }
export function parseRoman(tok) {
  const m = /^(♭?)([ivIV]+)(.*)$/.exec(tok);
  if (!m) throw new Error("진행 해석 불가: " + tok);
  const flat = m[1] ? -1 : 0;
  const deg = DEGREE[m[2].toLowerCase()] + flat;
  const lower = m[2] === m[2].toLowerCase();
  let q = m[3];
  if (q === "") q = lower ? "m" : "";
  else if (q === "7" && lower) q = "m7";
  else if (q === "m7") q = "m7";
  return { root: mod(deg), quality: q };
}

export function chordName(keyPc, tok) {
  const c = parseRoman(tok);
  const pc = mod(keyPc + c.root);
  return (FLAT_KEYS.has(mod(keyPc)) ? FLAT : SHARP)[pc] + SUFFIX[c.quality];
}

// 코드 반주 보이싱: 근음 A2~G♯3, 위로 3·7(·5) 쌓기
function voicing(rootPc, quality) {
  const ints = QUALITY[quality];
  const root = 45 + mod(rootPc - 9);              // A2(45) ~ G♯3(56)
  const tones = ints.length >= 4 ? [ints[1], ints[3], ints.length > 4 ? ints[4] : ints[2] + 12] : [ints[1], ints[2], 12];
  const out = [root];
  let last = root;
  for (const t of tones) { let m = root + t; while (m <= last) m += 12; out.push(m); last = m; }
  return out;
}
const bassRoot = pc => 28 + mod(pc - 4);          // E1(28) ~ D♯2(39)

// 결과 이벤트: { part: "drums"|"bass"|"comp", beat, dur, kind | midi | midis, vel }
// compPattern: [{ b: 박 위치, d: 길이(박), up, mute }] 이 있으면 코드 반주를 이 리듬으로, comp: false면 코드 반주 없음
// voicer(bar, i) → midis 가 있으면 그 보이싱 사용
export function buildBacking({ prog = "blues12", key = 9, style = null, compPattern = null, comp = true, voicer = null }, rand = Math.random) {
  // prog: 진행 이름 또는 { bars: [토큰], style }. 토큰 "iim7|V7" = 한 마디에 2박씩
  // custom: [{ segs: [{ rootPc, quality, beats, name }] }] 이면 그대로 사용(릭의 코드 진행 등)
  const P = typeof prog === "object" ? prog : PROGRESSIONS[prog] || PROGRESSIONS.blues12;
  const st = style || P.style || "straight";
  const seg = (tok, beats) => { const c = parseRoman(tok); return { rootPc: mod(key + c.root), quality: c.quality, name: chordName(key, tok), beats }; };
  const raw = arguments[0].custom || P.bars.map(tok => ({ segs: tok.split("|").map((t, _, a) => seg(t, 4 / a.length)) }));
  const bars = raw.map(b => ({ ...b.segs[0], segs: b.segs, name: b.segs.map(x => x.name).join(" / "), tok: b.segs.length === 1 ? "" : "split" }));
  const ev = [];
  bars.forEach((b, i) => {
    const t0 = i * 4;
    const next = bars[(i + 1) % bars.length];
    const ints = QUALITY[b.quality];
    const R = bassRoot(b.rootPc);
    // 드럼
    if (st === "bossa") {
      for (const x of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) ev.push({ part: "drums", beat: t0 + x, kind: "hat", vel: 0.45 });
      for (const x of (i % 2 === 0 ? [0, 0.75, 1.5, 2.5, 3.25] : [0.5, 1.5, 2.25, 3])) ev.push({ part: "drums", beat: t0 + x, kind: "click", vel: 0.55 });
      for (const x of [0, 1.5, 2, 3.5]) ev.push({ part: "drums", beat: t0 + x, kind: "kick", vel: 0.55 });
    } else if (st === "reggae") {
      for (const x of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) ev.push({ part: "drums", beat: t0 + x, kind: "hat", vel: x % 1 ? 0.5 : 0.7 });
      ev.push({ part: "drums", beat: t0 + 2, kind: "kick", vel: 1 });
      ev.push({ part: "drums", beat: t0 + 2, kind: "snare", vel: 0.8 });
    } else if (st === "swing") {
      for (const x of [0, 1, 1.5, 2, 3, 3.5]) ev.push({ part: "drums", beat: t0 + x, kind: "ride", vel: x % 1 ? 0.7 : 1 });
      for (const x of [1, 3]) ev.push({ part: "drums", beat: t0 + x, kind: "hat", vel: 0.6 });
      ev.push({ part: "drums", beat: t0, kind: "kick", vel: 0.45 });
    } else {
      const hats = st === "shuffle" ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
      for (const x of hats) ev.push({ part: "drums", beat: t0 + x, kind: "hat", vel: x % 1 ? 0.6 : 0.9 });
      for (const x of st === "straight" ? [0, 2, 2.5] : [0, 2]) ev.push({ part: "drums", beat: t0 + x, kind: "kick", vel: 1 });
      for (const x of [1, 3]) ev.push({ part: "drums", beat: t0 + x, kind: "snare", vel: 1 });
    }
    // 한 마디에 코드가 2개 이상이면 코드마다 짧은 베이스·반주
    if (b.segs.length > 1) {
      let at = 0;
      for (const sg of b.segs) {
        const R2 = bassRoot(sg.rootPc), iv = QUALITY[sg.quality];
        ev.push({ part: "bass", beat: t0 + at, dur: 0.9, midi: R2, vel: 0.9 });
        if (sg.beats >= 2) ev.push({ part: "bass", beat: t0 + at + 1, dur: 0.9, midi: R2 + (st === "swing" ? iv[2] : 7), vel: 0.8 });
        if (comp) {
          const v2 = voicing(sg.rootPc, sg.quality);
          const hits = compPattern ? compPattern.filter(h => h.b >= at && h.b < at + sg.beats) : st === "swing" ? [{ b: at, d: 0.7 }, ...(sg.beats >= 2 ? [{ b: at + 1.5, d: 0.3 }] : [])] : [{ b: at, d: Math.min(0.9, sg.beats - 0.1) }];
          for (const h of hits) ev.push({ part: "comp", beat: t0 + h.b, dur: h.mute ? 0.08 : h.d ?? 0.4, midis: v2, vel: 0.48, up: !!h.up, mute: !!h.mute });
        }
        at += sg.beats;
      }
      return;
    }
    // 베이스
    if (st === "bossa") {
      for (const [x, iv] of [[0, 0], [1.5, 7], [2, 0], [3.5, 7]]) ev.push({ part: "bass", beat: t0 + x, dur: x % 1 ? 0.45 : 1.3, midi: R + iv - (iv === 7 && R + 7 > 43 ? 12 : 0), vel: 0.85 });
    } else if (st === "reggae") {
      for (const [x, iv] of [[0, 0], [1.5, 7], [2, 0], [2.5, 12], [3, 7]]) ev.push({ part: "bass", beat: t0 + x, dur: 0.45, midi: R + iv, vel: 0.9 });
    } else if (st === "shuffle") {
      const third = ints.includes(4) ? 4 : 3, six = 9, sev = ints.includes(10) ? 10 : 9;
      // 부기 라인 R 3 5 6 | ♭7 6 5 3: 같은 코드가 2마디 이어질 때만 뒷마디를 내려오는 쪽으로
      const prevSame = i > 0 && bars[i - 1].name === b.name;
      let run = 0; for (let k = i; k > 0 && bars[k - 1].name === b.name; k--) run++;
      const line = prevSame && run % 2 === 1 ? [sev, six, 7, third] : [0, third, 7, six];
      line.forEach((x, k) => ev.push({ part: "bass", beat: t0 + k, dur: 0.85, midi: R + x, vel: 0.9 }));
    } else if (st === "swing") {
      const nr = bassRoot(next.rootPc);
      const approach = nr + (rand() < 0.5 ? -1 : 1);
      [R, R + ints[1], R + ints[2], approach].forEach((m, k) => ev.push({ part: "bass", beat: t0 + k, dur: 0.9, midi: m, vel: 0.85 }));
    } else {
      for (let k = 0; k < 8; k++) ev.push({ part: "bass", beat: t0 + k * 0.5, dur: 0.42, midi: k === 6 || k === 7 ? R + 7 : R, vel: k % 2 ? 0.7 : 0.9 });
    }
    // 코드 반주
    const v = voicer ? voicer(b, i) : voicing(b.rootPc, b.quality);
    if (!comp) return;
    if (compPattern) { for (const h of compPattern) ev.push({ part: "comp", beat: t0 + h.b, dur: h.mute ? 0.08 : h.d ?? 0.4, midis: v, vel: h.mute ? 0.25 : h.acc ? 0.6 : 0.48, up: !!h.up, mute: !!h.mute }); return; }
    if (st === "shuffle") for (const x of [1, 3]) ev.push({ part: "comp", beat: t0 + x, dur: 0.35, midis: v, vel: 0.55 });
    else if (st === "swing") { ev.push({ part: "comp", beat: t0, dur: 0.7, midis: v, vel: 0.5 }); ev.push({ part: "comp", beat: t0 + 1.5, dur: 0.3, midis: v, vel: 0.45 }); }
    else if (st === "bossa") for (const x of [0, 0.75, 1.5, 2.5, 3.25]) ev.push({ part: "comp", beat: t0 + x, dur: 0.4, midis: v, vel: 0.4 });
    else if (st === "reggae") for (const x of [1, 3]) ev.push({ part: "comp", beat: t0 + x, dur: 0.18, midis: v, vel: 0.5 });
    else for (const [x, d, up] of [[0, 1.2, false], [1.5, 0.45, true], [2, 0.9, false], [3, 0.45, false], [3.5, 0.45, true]]) ev.push({ part: "comp", beat: t0 + x, dur: d, midis: v, vel: 0.45, up });
  });
  return { prog, key, style: st, bars, beats: bars.length * 4, events: ev.sort((a, b) => a.beat - b.beat) };
}

// 스윙·셔플: 8분음표 뒤쪽(.5)을 셋잇단 위치(.667)로
export function swingBeat(beat, style) {
  if (style !== "shuffle" && style !== "swing") return beat;
  const whole = Math.floor(beat), frac = beat - whole;
  return Math.abs(frac - 0.5) < 1e-6 ? whole + 2 / 3 : beat;
}
