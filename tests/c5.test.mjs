import test from "node:test";
import assert from "node:assert/strict";
import { GENRES, compVoicings } from "../js/modules/chords/comping-core.js";
import { TUNES, KEYS, tuneData, arrange } from "../js/modules/chords/melody-core.js";
import { buildBacking } from "../js/audio/backing.js";
import { TUNING } from "../js/theory/notes.js";

test("장르별 컴핑: 모든 장르·키에서 마디마다 운지, 리듬 패턴 1마디 안", () => {
  for (const [id, g] of Object.entries(GENRES)) {
    for (const h of g.pattern) assert.ok(h.b >= 0 && h.b < 4, `${id} ${h.b}`);
    for (let key = 0; key < 12; key++) {
      const r = compVoicings(id, key);
      r.voicings.forEach((v, i) => {
        assert.ok(v, `${id} ${key} ${r.bars[i].name}`);
        const pcs = new Set(v.notes.map(n => n.midi % 12));
        assert.ok(pcs.has(r.bars[i].rootPc) || id === "jazz-charleston" || id === "jazz-4" || id === "bossa", `${id} ${r.bars[i].name} 근음`);
      });
      const s = buildBacking({ prog: g.prog, key, style: g.style, compPattern: g.pattern, voicer: (b, i) => r.voicings[i].notes.map(n => n.midi) });
      assert.equal(s.events.filter(e => e.part === "comp").length, g.pattern.length * r.bars.length);
    }
  }
});

test("코드 멜로디: 곡 길이·코드 위치, 화음 맨 윗음 = 멜로디, 모든 키에서 운지", () => {
  for (const id of Object.keys(TUNES)) for (const [k] of KEYS) {
    const d = tuneData(id, k);
    assert.equal(d.ticks % 48, 0, `${id} 마디 단위`);
    assert.ok(d.chords.every(c => c.at < d.ticks));
    const a = arrange(d);
    a.events.forEach((e, i) => {
      const top = Math.max(...e.notes.map(n => TUNING[n.s - 1] + n.f));
      assert.equal(top, d.notes[i].midi, `${id} ${k} ${i}번째 음 맨 위 = 멜로디`);
      assert.ok(e.notes.every(n => n.f >= 0 && n.f <= 15));
      if (e.chord && e.notes.length > 1) {
        const ch = d.chords.filter(c => c.at <= e.at).pop();
        const pcs = e.notes.map(n => (TUNING[n.s - 1] + n.f) % 12);
        assert.ok(pcs.includes(ch.root) || pcs.length >= 3, `${id} ${k} 코드음`);
      }
    });
    assert.ok(a.events.filter(e => e.chord).every(e => e.voiced), `${id} ${k} 화음 배치`);
  }
});
