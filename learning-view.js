// Block Scale Learning 화면: 한 블록(모드는 포지션)의 음을 메트로놈에 맞춰 차례로 강조, 블록을 차례로 이어 한 사이클 = 완료 1회

import * as BC from "./block-core.js";
import { scaleTitle, SCALES } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import * as Metro from "../../audio/metronome.js";
import { esc, keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey, unitWord } from "./common.js";

const store = makeStore("fretlab:sbl");
export const clearFinder = () => store.clear();
const DIRS = [["updown", "상행→하행"], ["up", "상행"], ["down", "하행"]];

export function settingsHtml() {
  const bpm = BC.clampBpm(getSetting("sbl.bpm", BC.BPM_DEFAULT));
  return `
    <div class="field"><label>키</label>${keyPickerHtml("sblKey", "sbl.key")}</div>
    <div class="field" style="margin-top:14px"><label>방향</label>${segHtml("sblDir", DIRS, getSetting("sbl.dir", "updown"))}</div>
    <div class="field" style="margin-top:14px"><label>박당 음 수</label>${segHtml("sblPer", [[1, "4분음표(1음)"], [2, "8분음표(2음)"]], getSetting("sbl.per", 1))}</div>
    <div class="field" style="margin-top:14px">
      <label for="sblBpm">BPM <b id="sblBpmOut">${bpm}</b></label>
      <input id="sblBpm" type="range" min="${BC.BPM_MIN}" max="${BC.BPM_MAX}" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">블록 1부터 차례로, 블록마다 음을 박에 맞춰 강조. 모든 블록(5개, Modes는 포지션 7개)을 마치면 완료 1회</p>`;
}
export function bindSettings(root) {
  ["sblKey", "sblDir", "sblPer"].forEach(id => bindPicker(root, id));
  const r = root.querySelector("#sblBpm");
  r.oninput = () => { root.querySelector("#sblBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const key = Number(readSel(root, "sblKey"));
  const dir = readSel(root, "sblDir", "v");
  const per = Number(readSel(root, "sblPer", "v"));
  const bpm = BC.clampBpm(root.querySelector("#sblBpm").value);
  setSetting("sbl.key", key); setSetting("sbl.dir", dir); setSetting("sbl.per", per); setSetting("sbl.bpm", bpm);
  return { key, dir, per, bpm };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const o = s0.options || {};
  const newCycle = (n, units) => {
    const scaleId = (scales.length ? scales : ["minor-penta"])[n % Math.max(1, scales.length)];
    return { cycleNo: n, units, rootPc: pickKey(o.key ?? -1), scaleId, slot: 0, bpm: o.bpm || BC.BPM_DEFAULT };
  };
  let st = store.load(s0.id) || newCycle(0, 0);
  let cycle = BC.learningCycle(st.rootPc, st.scaleId, o.dir || "updown", o.per || 1);
  let playing = false, startSlot = 0, cur = null, half = null;

  container.innerHTML = `
    <div class="nf sb">
      <div class="nf-meta"><span id="sblTitle"></span><span id="sblProg"></span></div>
      <div class="sb-chips" id="sblChips"></div>
      <div class="sb-state"><span class="state-label" id="sblCap">READY</span><span class="muted small" id="sblNote"></span></div>
      <div class="fretboard sb-board" id="sblBoard"></div>
      <div class="beats bf-beats" id="sblBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      <div class="nf-actions" style="margin-top:12px"><button class="btn primary wide" id="sblPlay" type="button">연주 시작</button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="sblBpmVal">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
      <p class="muted small nf-foot">초록 = 근음, 노랑 = 지금 칠 음. 블록 칩을 누르면 그 블록부터 연습(완료는 사이클 전체를 마쳤을 때)</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);
  let word = unitWord(st.scaleId);

  function draw() {
    const slot = cur && cur.phase === "play" ? cur.slot : cycle.slots[Math.min(st.slot, cycle.slots.length - 1)];
    const bi = slot.block;
    const b = cycle.blocks[bi];
    $("#sblTitle").textContent = `${scaleTitle(st.rootPc, st.scaleId)}`;
    $("#sblProg").textContent = `${word} ${bi + 1}/${cycle.blocks.length} · 완료 ${st.units}회`;
    $("#sblChips").innerHTML = cycle.blocks.map((x, i) => `<button type="button" class="sb-chip ${i === bi ? "now" : ""} ${i < bi ? "past" : ""}" data-b="${i}">${i + 1}</button>`).join("");
    const active = playing && cur && cur.phase === "play" && slot.note >= 0 ? `${slot.s}-${slot.f}` : null;
    const notes = b.notes.map(n => ({ s: n.s, f: n.f, label: n.label, kind: `${n.s}-${n.f}` === active ? "active" : n.root ? "root" : "note" }));
    const from = Math.max(0, b.lo - 1), to = Math.max(from + 5, b.hi + 1);
    $("#sblBoard").innerHTML = scaleBoardSvg(notes, { from: from <= 1 ? 0 : from, to: Math.min(18, to) });
    const actNote = active ? b.notes.find(n => `${n.s}-${n.f}` === active) : null;
    $("#sblNote").textContent = actNote ? `${actNote.s}번 현 ${actNote.f}프렛 · ${actNote.label}` : `${b.name} · ${b.lo}~${b.hi}프렛`;
  }
  function drawCap(inBar) {
    $("#sblCap").textContent = !playing ? (running() ? "READY" : "PAUSED") : cur && cur.phase === "count" ? `준비 ${cur.countLeft}` : "PLAY";
    $("#sblCap").className = "state-label " + (playing ? "running" : "");
    container.querySelectorAll("#sblBeats .beat").forEach((x, i) => x.classList.toggle("on", playing && i === inBar));
  }
  // kAbs: 재생 시작 후 슬롯 번호(박 × 박당 음 수). kShift: 사이클이 바뀐 지점 보정값
  let kShift = 0;
  function step(kAbs, inBar) {
    cur = BC.slotAt(cycle, startSlot, kAbs - kShift);
    if (cur.phase === "end") {
      st = { ...st, units: st.units + 1 };
      api.addUnit(1);
      api.toast(`${word} ${cycle.blocks.length}개 1사이클 완료 · 이번 세션 ${st.units}회`);
      // 다음 사이클(주제가 여럿이면 다음 스케일, 키가 무작위면 새 키)로 쉬지 않고 이어감
      st = { ...newCycle(st.cycleNo + 1, st.units), bpm: st.bpm };
      cycle = BC.learningCycle(st.rootPc, st.scaleId, o.dir || "updown", o.per || 1);
      word = unitWord(st.scaleId);
      startSlot = 0;
      kShift = kAbs - BC.COUNT_IN * cycle.perBeat;
      cur = BC.slotAt(cycle, 0, BC.COUNT_IN * cycle.perBeat);
    }
    if (cur.phase === "play") {
      // 재개 시 지금 블록 처음부터
      const bs = cycle.blockStart[cur.slot.block];
      if (st.slot !== bs) { st = { ...st, slot: bs }; persist(); }
    }
    draw(); drawCap(inBar);
  }
  function onBeat(inBar, beat) {
    if (!playing) return;
    const per = cycle.perBeat;
    step(beat * per, inBar);
    if (per === 2) {
      clearTimeout(half);
      half = setTimeout(() => { if (playing) step(beat * 2 + 1, inBar); }, (60 / st.bpm) * 500);
    }
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 연주할 수 있음"); return; }
    startSlot = st.slot; kShift = 0; cur = { phase: "count", countLeft: BC.COUNT_IN };
    Metro.onMetronomeBeat(onBeat);
    try { await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 }); playing = true; } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); }
    $("#sblPlay").textContent = playing ? "멈춤" : "연주 시작";
    draw(); drawCap(-1);
  }
  function stop() {
    if (playing) Metro.stopMetronome();
    clearTimeout(half);
    playing = false; cur = null;
    $("#sblPlay").textContent = "연주 시작";
    draw(); drawCap(-1);
  }
  $("#sblPlay").onclick = () => (playing ? stop() : play());
  $("#sblChips").addEventListener("click", e => {
    const c = e.target.closest("[data-b]"); if (!c || playing) return;
    st = { ...st, slot: cycle.blockStart[Number(c.dataset.b)] }; persist(); draw();
  });
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: BC.clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("sbl.bpm", st.bpm); Metro.setMetronomeBpm(st.bpm); $("#sblBpmVal").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && (!running() || !Metro.isMetronomeRunning())) stop(); else if (!playing) drawCap(-1); }, 200);
  draw(); drawCap(-1);
  return () => { clearInterval(watch); clearTimeout(half); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}
