// 오선보 + TAB 그리기 (VexFlow 4, MIT, vendor/vexflow-bravura.js를 index.html에서 미리 불러옴)
// 입력: 이벤트 [{ at, dur, notes:[{s,f}], bend, rel, h, p, sl, vib, chrom, rest }] (4분음표 = 12틱), 코드 [{ name, at }]
// 기타 악보 관례대로 오선은 실제 음보다 한 옥타브 높게 적음(8vb 높은음자리표). 마디를 넘는 음은 붙임줄로 나눔

import { TUNING } from "../theory/notes.js";

const BAR = 48;
const VF = () => (window.Vex && window.Vex.Flow) || null;
export const scoreAvailable = () => !!VF();

const NAMES_SHARP = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const NAMES_FLAT = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];
const DUR = [[48, "w"], [36, "hd"], [24, "h"], [18, "qd"], [12, "q"], [9, "8d"], [6, "8"], [3, "16"]];

function keyOf(midi, flats) {
  const m = midi + 12; // 8vb 표기
  const n = (flats ? NAMES_FLAT : NAMES_SHARP)[m % 12];
  return `${n}/${Math.floor(m / 12) - 1}`;
}

// 틱 길이를 음표 길이 조각으로
function pieces(ticks) {
  const out = [];
  let left = ticks;
  while (left > 0) {
    const d = DUR.find(([t]) => t <= left);
    if (!d) break;
    out.push(d);
    left -= d[0];
  }
  return out;
}

// 이벤트를 마디별 조각으로 나눔(셋잇단은 그대로, 마디를 넘으면 나눠서 이어짐 표시)
function splitBars(events, ticks) {
  const bars = Math.max(1, Math.ceil(ticks / BAR));
  const out = Array.from({ length: bars }, () => []);
  events.forEach((e, idx) => {
    if (e.dur === 4 || e.dur === 2) { out[Math.floor(e.at / BAR)].push({ e, idx, at: e.at, dur: e.dur, trip: true, cont: false }); return; }
    let at = e.at, left = e.dur, first = true;
    while (left > 0) {
      const bar = Math.floor(at / BAR);
      const room = Math.min(left, (bar + 1) * BAR - at);
      for (const [t, code] of pieces(room)) {
        if (!out[bar]) out[bar] = [];
        out[bar].push({ e, idx, at, dur: t, code, cont: !first });
        at += t; first = false;
      }
      left -= room;
    }
  });
  // 빈 자리는 쉼표로 채움
  out.forEach((list, b) => {
    let t = b * BAR;
    const filled = [];
    for (const x of list.sort((p, q) => p.at - q.at)) {
      if (x.at > t) for (const [d, code] of pieces(x.at - t)) { filled.push({ e: { rest: true }, idx: -1, at: t, dur: d, code, pad: true }); t += d; }
      filled.push(x); t = x.at + x.dur;
    }
    if (t < (b + 1) * BAR) for (const [d, code] of pieces((b + 1) * BAR - t)) { filled.push({ e: { rest: true }, idx: -1, at: t, dur: d, code, pad: true }); t += d; }
    out[b] = filled;
  });
  return out;
}

// opts: chords, ticks, flats, active(이벤트 번호), width
// 오선으로 나타낼 수 있는 길이인지(셋잇단 4·2틱, 또는 일반 음표 조각으로 정확히 나뉨)
function drawable(events) {
  return events.every(e => e.dur === 4 || e.dur === 2 || pieces(e.dur).reduce((a, [t]) => a + t, 0) === e.dur);
}
export function scoreSvg(el, events, { chords = [], ticks = BAR, flats = false, active = -1, width = 520, tab = true, staff = true, perRow = 1 } = {}) {
  // 12/8 근사 길이(1·8틱)나 이어지는 긴 음은 오선 대신 TAB 그림으로(호출한 쪽이 tabSvg로 그림)
  if (!drawable(events)) return false;
  const V = VF();
  if (!V) return false;
  el.innerHTML = "";
  const bars = splitBars(events, ticks);
  const rows = Math.ceil(bars.length / perRow);
  const staffH = staff ? 110 : 0, tabH = tab ? 105 : 0, rowH = staffH + tabH + 20;
  const renderer = new V.Renderer(el, V.Renderer.Backends.SVG);
  renderer.resize(width, rows * rowH + 10);
  const ctx = renderer.getContext();
  ctx.setFont("Arial", 10);
  const barW = (width - 20) / perRow;
  const chordAt = new Map(chords.map(c => [c.at, c.name]));
  let prevStaff = null, prevTab = null, prevEv = null;
  const tagged = [];

  bars.forEach((list, b) => {
    const row = Math.floor(b / perRow), col = b % perRow;
    const x = 10 + col * barW, y = row * rowH + 10;
    const first = col === 0;
    const extra = first ? 50 : 0;
    let stave = null, tstave = null;
    if (staff) {
      stave = new V.Stave(x, y, barW);
      if (first) { stave.addClef("treble", "default", "8vb"); if (b === 0) stave.addTimeSignature("4/4"); }
      stave.setContext(ctx).draw();
    }
    if (tab) {
      tstave = new V.TabStave(x, y + staffH, barW);
      if (first) tstave.addClef("tab");
      tstave.setContext(ctx).draw();
      if (staff && first) new V.StaveConnector(stave, tstave).setType("singleLeft").setContext(ctx).draw();
    }
    // 오선(높은음자리표·박자표)과 TAB(TAB 표시)의 기호 폭이 달라 음표가 어긋나지 않게 시작점을 맞춤
    if (stave && tstave) { const sx = Math.max(stave.getNoteStartX(), tstave.getNoteStartX()); stave.setNoteStartX(sx); tstave.setNoteStartX(sx); }
    const sNotes = [], tNotes = [], tripS = [], tripT = [];
    let tripBufS = [], tripBufT = [];
    for (const x2 of list) {
      const e = x2.e;
      const isRest = e.rest || !e.notes || !e.notes.length;
      const code = x2.trip ? (x2.dur === 2 ? "16" : "8") : x2.code;
      let sn = null, tn = null;
      if (staff) {
        if (isRest) sn = new V.StaveNote({ keys: ["b/4"], duration: code + "r" });
        else {
          const keys = e.notes.map(n => keyOf(TUNING[n.s - 1] + n.f, flats));
          const order = keys.map((k, i) => [k, TUNING[e.notes[i].s - 1] + e.notes[i].f]).sort((a, c) => a[1] - c[1]).map(a => a[0]);
          sn = new V.StaveNote({ keys: order, duration: code, auto_stem: true });
          if (code.endsWith("d")) V.Dot.buildAndAttach([sn], { all: true });
        }
        if (!x2.cont && chordAt.has(x2.at) && !x2.pad) sn.addModifier(new V.Annotation(chordAt.get(x2.at)).setVerticalJustification(V.Annotation.VerticalJustify.TOP).setFont("Arial", 13, "bold"), 0);
        if (x2.idx === active && active >= 0) sn.setStyle({ fillStyle: "#e0a800", strokeStyle: "#e0a800" });
        sNotes.push(sn);
      }
      if (tab) {
        if (isRest || x2.cont) tn = new V.GhostNote({ duration: code });
        else {
          tn = new V.TabNote({ positions: e.notes.map(n => ({ str: n.s, fret: n.f })), duration: code });
          if (e.bend) tn.addModifier(new V.Bend(e.bend === 0.5 ? "1/4" : e.bend === 1 ? "1/2" : e.bend === 2 ? "Full" : "1 1/2"), 0);
          if (e.grace) tn.addModifier(new V.Annotation(`${e.notes[0].f + e.grace}${e.graceHP ? (e.grace < 0 ? "h" : "p") : e.grace < 0 ? "↗" : "↘"}`).setFont("Arial", 11).setVerticalJustification(V.Annotation.VerticalJustify.BOTTOM), 0);
          if (e.rel) tn.addModifier(new V.Annotation("R").setVerticalJustification(V.Annotation.VerticalJustify.TOP), 0);
          if (e.vib) tn.addModifier(new V.Vibrato(), 0);
          if (x2.idx === active && active >= 0) tn.setStyle({ fillStyle: "#e0a800", strokeStyle: "#e0a800" });
        }
        tNotes.push(tn);
      }
      if (!x2.pad && x2.idx >= 0) { if (sn) tagged.push([sn, x2.idx]); if (tn && !(tn instanceof V.GhostNote)) tagged.push([tn, x2.idx]); }
      if (x2.trip) {
        if (sn) tripBufS.push(sn);
        if (tn) tripBufT.push(tn);
        if ((sn ? tripBufS : tripBufT).length === 3) { if (sn) tripS.push(tripBufS); if (tn) tripT.push(tripBufT); tripBufS = []; tripBufT = []; }
      }
      // 해머·풀·슬라이드(TAB)
      if (tab && !x2.cont && !isRest && (e.h || e.p || e.sl) && prevTab && prevEv && !prevEv.rest) {
        const opts = { first_note: prevTab, last_note: tn, first_indices: [0], last_indices: [0] };
        const tie = e.sl ? (e.notes[0].f > prevEv.notes[0].f ? V.TabSlide.createSlideUp(opts) : V.TabSlide.createSlideDown(opts)) : e.h ? V.TabTie.createHammeron(opts) : V.TabTie.createPulloff(opts);
        tNotes.__ties = (tNotes.__ties || []).concat([tie]);
      }
      // 마디를 넘어 이어지는 음: 오선 붙임줄
      if (staff && x2.cont && prevStaff && !isRest) {
        sNotes.__ties = (sNotes.__ties || []).concat([new V.StaveTie({ first_note: prevStaff, last_note: sn, first_indices: e.notes.map((_, i) => i), last_indices: e.notes.map((_, i) => i) })]);
      }
      if (!x2.pad) { prevStaff = sn || prevStaff; if (tn && !(tn instanceof V.GhostNote)) prevTab = tn; prevEv = isRest ? { rest: true } : e; }
    }
    const tuplets = [];
    for (const g of tripS) tuplets.push(new V.Tuplet(g, { num_notes: 3, notes_occupied: 2 }));
    const tabTuplets = tripT.map(g => new V.Tuplet(g, { num_notes: 3, notes_occupied: 2 }));
    const voices = [];
    let sv = null, tv = null;
    if (staff) { sv = new V.Voice({ num_beats: 4, beat_value: 4 }).setMode(V.Voice.Mode.SOFT).addTickables(sNotes); V.Accidental.applyAccidentals([sv], "C"); voices.push(sv); }
    if (tab) { tv = new V.Voice({ num_beats: 4, beat_value: 4 }).setMode(V.Voice.Mode.SOFT).addTickables(tNotes); voices.push(tv); }
    const fmt = new V.Formatter();
    if (sv) fmt.joinVoices([sv]);
    if (tv) fmt.joinVoices([tv]);
    fmt.format(voices, barW - extra - 30);
    const beams = staff ? V.Beam.generateBeams(sNotes.filter(n => !n.isRest()), { groups: [new V.Fraction(1, 4)] }) : [];
    if (sv) sv.draw(ctx, stave);
    if (tv) tv.draw(ctx, tstave);
    beams.forEach(bm => bm.setContext(ctx).draw());
    tuplets.forEach(t => t.setContext(ctx).draw());
    void tabTuplets;
    (sNotes.__ties || []).forEach(t => t.setContext(ctx).draw());
    (tNotes.__ties || []).forEach(t => t.setContext(ctx).draw());
  });
  // 이벤트 번호를 음표 그림에 붙여 재생 중 강조(클래스 on)에 씀
  for (const [n, idx] of tagged) {
    const g = el.querySelector(`[id="vf-${n.getAttribute("id")}"]`);
    if (g) g.setAttribute("data-ev", idx);
  }
  const svg = el.querySelector("svg");
  if (svg) {
    svg.setAttribute("viewBox", `0 0 ${width} ${rows * rowH + 10}`);
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.style.width = "100%"; svg.style.height = "auto";
  }
  return true;
}
