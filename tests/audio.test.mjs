import test from "node:test";
import assert from "node:assert/strict";
import { PROGRESSIONS, buildBacking, chordName, parseRoman, swingBeat } from "../js/audio/backing.js";
import fs from "node:fs";

test("진행 해석: 로마 숫자 → 코드 이름(키 반영)", () => {
  assert.deepEqual(parseRoman("iiø7"), { root: 2, quality: "ø7" });
  assert.deepEqual(parseRoman("♭VII"), { root: 10, quality: "" });
  assert.equal(chordName(9, "I7"), "A7");
  assert.equal(chordName(9, "IV7"), "D7");
  assert.equal(chordName(0, "iim7"), "Dm7");
  assert.equal(chordName(9, "iiø7"), "Bm7♭5");
  assert.equal(chordName(9, "V7♭9"), "E7(♭9)");
  assert.equal(chordName(5, "♭VII"), "E♭");
  assert.equal(buildBacking({ prog: "blues12", key: 9 }).bars.map(b => b.name).join(" "), "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7");
});

test("반주 이벤트: 모든 진행·스타일·키에서 마디마다 드럼·베이스·코드, 음역 안", () => {
  for (const prog of Object.keys(PROGRESSIONS)) for (const style of ["straight", "shuffle", "swing"]) for (let key = 0; key < 12; key++) {
    const s = buildBacking({ prog, key, style }, () => 0.3);
    assert.equal(s.beats, PROGRESSIONS[prog].bars.length * 4);
    for (let bar = 0; bar < s.bars.length; bar++) {
      const inBar = s.events.filter(e => e.beat >= bar * 4 && e.beat < bar * 4 + 4);
      for (const part of ["drums", "bass", "comp"]) assert.ok(inBar.some(e => e.part === part), `${prog} ${style} ${key} ${bar} ${part}`);
    }
    for (const e of s.events) {
      if (e.part === "bass") assert.ok(e.midi >= 27 && e.midi <= 55, `베이스 ${e.midi}`);
      if (e.part === "comp") for (const m of e.midis) assert.ok(m >= 45 && m <= 82, `코드 ${m}`);
    }
    // 코드가 바뀌는 마디의 베이스 첫 박은 근음
    s.bars.forEach((b, i) => {
      if (i > 0 && s.bars[i - 1].name === b.name && style === "shuffle") return;
      const first = s.events.find(e => e.part === "bass" && e.beat === i * 4);
      assert.equal(((first.midi - b.rootPc) % 12 + 12) % 12, 0);
    });
  }
});

test("스윙·셔플: 8분음표 뒤쪽은 셋잇단 위치", () => {
  assert.equal(swingBeat(1.5, "swing"), 1 + 2 / 3);
  assert.equal(swingBeat(1.5, "straight"), 1.5);
  assert.equal(swingBeat(2, "shuffle"), 2);
});

test("음원 파일: 목록의 mp3가 모두 있음", () => {
  const idx = JSON.parse(fs.readFileSync("sounds/index.json", "utf8"));
  assert.deepEqual(Object.keys(idx).sort(), ["acoustic", "bass", "guitar"]);
  for (const [k, list] of Object.entries(idx)) for (const m of list) assert.ok(fs.statSync(`sounds/${k}/${m}.mp3`).size > 2000, `${k}/${m}`);
  const sw = fs.readFileSync("sw.js", "utf8");
  for (const [k, list] of Object.entries(idx)) for (const m of list) assert.ok(sw.includes(`./sounds/${k}/${m}.mp3`), `sw ${k}/${m}`);
});

test("백킹 스타일 13종: 모든 진행에서 드럼·베이스·코드가 생기고 값이 정상", async () => {
  const B = await import("../js/audio/backing.js");
  assert.equal(Object.keys(B.STYLES).length, 13);
  for (const st of Object.keys(B.STYLES)) for (const prog of Object.keys(B.PROGRESSIONS)) {
    const s = B.buildBacking({ prog, key: 7, style: st }, () => 0.5);
    for (const part of ["drums", "bass", "comp"]) assert.ok(s.events.some(e => e.part === part), `${st} ${prog} ${part}`);
    for (const e of s.events) {
      assert.ok(e.beat >= 0 && e.beat < s.beats, `${st} beat`);
      for (const x of [e.dur ?? 0, e.midi ?? 0, ...(e.midis || [])]) assert.ok(Number.isFinite(x), `${st} ${prog}`);
    }
  }
  // R&B·네오 소울·스무드 재즈·펑크는 9음을 얹은 보이싱
  const nj = B.buildBacking({ prog: "major251", key: 0, style: "smooth-jazz" }).events.find(e => e.part === "comp");
  assert.ok(nj.midis.some(m => m % 12 === 4));             // Dm7의 9음 E
  // 네오 소울 16분 스윙, 슬로우 블루스는 셋잇단 위치를 그대로
  assert.equal(B.swingBeat(1.25, "neo-soul"), 1.3);
  assert.equal(B.swingBeat(1.5, "neo-soul"), 1.5);
  const sb = B.buildBacking({ prog: "blues12", key: 9, style: "slow-blues" }).events.filter(e => e.part === "drums" && e.beat < 1);
  assert.ok(sb.some(e => Math.abs(e.beat - 1 / 3) < 1e-9));
});
