// 리듬 악보(빗금 음표) 그리기: VexFlow 4. 스트로크 방향 화살표, 강세(>), 뮤트(x 머리), 팜뮤트(P.M.), 베이스 음(B)
// 입력: rhythm-core의 notation(p) 결과
import { notation } from "../modules/rhythm/rhythm-core.js";

const VF = () => (window.Vex && window.Vex.Flow) || null;
export const rhythmAvailable = () => !!VF();

// opts: active(지금 칸 번호, 소리 사건의 시작 칸), arrows(화살표 표시), chords(마디별 코드 이름), width
export function rhythmSvg(el, p, { active = -1, arrows = true, chords = [], width = 520 } = {}) {
  const V = VF();
  if (!V) return false;
  el.innerHTML = "";
  const bars = notation(p);
  const rowH = 128;
  const renderer = new V.Renderer(el, V.Renderer.Backends.SVG);
  renderer.resize(width, bars.length * rowH + 14);
  const ctx = renderer.getContext();
  let prev = null;
  const tagged = [];
  bars.forEach((list, b) => {
    const y = b * rowH + 24;
    const stave = new V.Stave(10, y, width - 20);
    if (b === 0) stave.addClef("percussion").addTimeSignature("4/4");
    stave.setContext(ctx).draw();
    if (b === 0 && p.opts.swing) { ctx.save(); ctx.setFont("Arial", 13, "bold"); ctx.fillText("Shuffle (♪♪ = 길게·짧게)", width - 190, y + 4); ctx.restore(); }
    if (chords[b]) { ctx.save(); ctx.setFont("Arial", 15, "bold"); ctx.fillText(chords[b], stave.getNoteStartX(), y + 4); ctx.restore(); }
    const notes = [], ties = [], labels = [];
    for (const it of list) {
      let n;
      if (it.type === "rest") n = new V.StaveNote({ keys: ["b/4"], duration: it.code + "r" });
      else if (it.type === "mute") n = new V.StaveNote({ keys: ["b/4/x2"], duration: it.code, stem_direction: 1 });
      else if (it.bass) n = new V.StaveNote({ keys: ["e/4"], duration: it.code, stem_direction: 1 });
      else n = new V.StaveNote({ keys: ["b/4"], duration: it.code, type: "s", stem_direction: 1 });
      if (it.code.endsWith("d")) V.Dot.buildAndAttach([n], { all: true });
      if (it.type !== "rest" && !it.tie) {
        if (it.acc) n.addModifier(new V.Articulation("a>").setPosition(V.Modifier.Position.ABOVE), 0);
        const label = it.pm ? "P.M." : it.bass ? "B" : arrows && it.dir ? (it.dir === "up" ? "↑" : "↓") : "";
        if (label) labels.push({ n, label, on: it.step === active });
      }
      if (it.type !== "rest" && it.step === active) n.setStyle({ fillStyle: "#e0a800", strokeStyle: "#e0a800" });
      if (it.tie && prev && prev.type !== "rest") {
        if (prev.bar === b) ties.push(new V.StaveTie({ first_note: prev.n, last_note: n, first_indices: [0], last_indices: [0] }));
        else {
          // 줄이 바뀌는 붙임줄: 앞 줄 끝과 이번 줄 처음에 반쪽씩
          try { new V.StaveTie({ first_note: prev.n, last_note: null, first_indices: [0], last_indices: [0] }).setContext(ctx).draw(); } catch (_) {}
          ties.push(new V.StaveTie({ first_note: null, last_note: n, first_indices: [0], last_indices: [0] }));
        }
      }
      notes.push(n);
      if (it.type !== "rest") tagged.push([n, it.step]);
      prev = { n, type: it.type, bar: b };
    }
    const voice = new V.Voice({ num_beats: 4, beat_value: 4 }).setMode(V.Voice.Mode.SOFT).addTickables(notes);
    new V.Formatter().joinVoices([voice]).format([voice], width - 20 - (b === 0 ? 90 : 30));
    const beams = V.Beam.generateBeams(notes.filter(x => !x.isRest()), { groups: [new V.Fraction(1, 4)], stem_direction: 1 });
    voice.draw(ctx, stave);
    beams.forEach(bm => bm.setContext(ctx).draw());
    ties.forEach(t => { try { t.setContext(ctx).draw(); } catch (_) {} });
    // 화살표·P.M.·B는 오선 아래에 직접 씀
    const ly = stave.getYForLine(4) + 26;
    for (const l of labels) {
      ctx.save();
      ctx.setFont("Arial", l.label.length > 1 ? 11 : 18, "bold");
      ctx.setFillStyle(l.on ? "#e0a800" : "#111");
      const x = l.n.getAbsoluteX() + (l.label.length > 1 ? -6 : 0);
      ctx.fillText(l.label, x, ly);
      ctx.restore();
    }
  });
  // 칸 번호를 음표 그림에 붙여 재생 중 강조에 씀
  for (const [n, step] of tagged) {
    const g = el.querySelector(`[id="vf-${n.getAttribute("id")}"]`);
    if (g) g.setAttribute("data-step", step);
  }
  const svg = el.querySelector("svg");
  if (svg) {
    svg.setAttribute("viewBox", `0 0 ${width} ${bars.length * rowH + 14}`);
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.style.width = "100%"; svg.style.height = "auto";
  }
  return true;
}
