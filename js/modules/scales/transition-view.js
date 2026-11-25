// Block Transition Practice 화면: 마디마다 블록을 옮겨 가며 연주, 현재 블록을 타임라인으로 표시, 한 바퀴 = 완료 1회

import * as BC from "./block-core.js";
import { blocks, scaleTitle, SCALES } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import * as Metro from "../../audio/metronome.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey, unitWord } from "./common.js";

const store = makeStore("fretlab:sbt");
export const clearFinder = () => store.clear();
const DIRS = [["up", "위로 1→끝"], ["down", "아래로 끝→1"], ["updown", "왕복"]];

export function settingsHtml() {
  const bpm = BC.clampBpm(getSetting("sbt.bpm", 70));
  return `
    <div class="field"><label>키</label>${keyPickerHtml("sbtKey", "sbt.key")}</div>
    <div class="field" style="margin-top:14px"><label>방향</label>${segHtml("sbtDir", DIRS, getSetting("sbt.dir", "up"))}</div>
    <div class="field" style="margin-top:14px"><label>블록마다</label>${segHtml("sbtBars", [[1, "1마디"], [2, "2마디"]], getSetting("sbt.bars", 2))}</div>
    <div class="field" style="margin-top:14px">
      <label for="sbtBpm">BPM <b id="sbtBpmOut">${bpm}</b></label>
      <input id="sbtBpm" type="range" min="${BC.BPM_MIN}" max="${BC.BPM_MAX}" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">정한 마디 수마다 다음 블록으로 옮겨 연주. 모든 블록을 한 바퀴 돌면 완료 1회</p>`;
}
export function bindSettings(root) {
  ["sbtKey", "sbtDir", "sbtBars"].forEach(id => bindPicker(root, id));
  const r = root.querySelector("#sbtBpm");
  r.oninput = () => { root.querySelector("#sbtBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const key = Number(readSel(root, "sbtKey"));
  const dir = readSel(root, "sbtDir", "v");
  const bars = Number(readSel(root, "sbtBars", "v"));
  const bpm = BC.clampBpm(root.querySelector("#sbtBpm").value);
  setSetting("sbt.key", key); setSetting("sbt.dir", dir); setSetting("sbt.bars", bars); setSetting("sbt.bpm", bpm);
  return { key, dir, bars, bpm };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const o = s0.options || {};
  const make = (n, units) => {
    const scaleId = (scales.length ? scales : ["minor-penta"])[n % Math.max(1, scales.length)];
    return { pass: n, units, rootPc: pickKey(o.key ?? -1), scaleId, step: 0, bpm: o.bpm || 70 };
  };
  let st = store.load(s0.id) || make(0, 0);
  let bs = blocks(st.rootPc, st.scaleId);
  let order = BC.transitionOrder(bs.length, o.dir || "up");
  const barsPer = o.bars || 2;
  let playing = false, startStep = 0, beatShift = 0, cur = null;

  container.innerHTML = `
    <div class="nf sb">
      <div class="nf-meta"><span id="sbtTitle"></span><span id="sbtProg"></span></div>
      <div class="sb-timeline" id="sbtLine"></div>
      <div class="sb-state"><span class="state-label" id="sbtCap">READY</span><span class="muted small" id="sbtInfo"></span></div>
      <div class="fretboard sb-board" id="sbtBoard"></div>
      <div class="beats bf-beats" id="sbtBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      <div class="nf-actions" style="margin-top:12px"><button class="btn primary wide" id="sbtPlay" type="button">연주 시작</button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="sbtBpmVal">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
      <p class="muted small nf-foot">진하게 = 지금 블록, 흐리게 = 다른 블록. 블록이 바뀌기 1박 전부터 다음 블록 번호가 깜박임</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function draw(inBar = -1) {
    const word = unitWord(st.scaleId);
    const stepIdx = cur && cur.phase === "play" ? cur.step : st.step;
    const bi = order[Math.min(stepIdx, order.length - 1)];
    const b = bs[bi];
    const nextBi = order[stepIdx + 1];
    $("#sbtTitle").textContent = scaleTitle(st.rootPc, st.scaleId);
    $("#sbtProg").textContent = `${stepIdx + 1}/${order.length} · 완료 ${st.units}회`;
    const soon = playing && cur && cur.phase === "play" && cur.barInStep === barsPer && inBar === 3;
    $("#sbtLine").innerHTML = order.map((x, i) => `<span class="sb-step ${i === stepIdx ? "now" : ""} ${i < stepIdx ? "past" : ""} ${soon && i === stepIdx + 1 ? "soon" : ""}">${x + 1}</span>`).join("");
    const inCur = new Set(b.notes.map(n => n.s + "-" + n.f));
    const marks = [];
    const seen = new Set();
    for (const x of bs) for (const n of x.notes) {
      const k = n.s + "-" + n.f;
      if (seen.has(k) || inCur.has(k) || n.f > 15) continue;
      seen.add(k);
      marks.push({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" });
    }
    for (const n of b.notes) marks.push({ s: n.s, f: n.f, label: n.label, kind: n.root ? "root" : "note" });
    $("#sbtBoard").innerHTML = scaleBoardSvg(marks, { from: 0, to: 15 });
    $("#sbtInfo").textContent = `${word} ${bi + 1} · ${b.lo}~${b.hi}프렛${nextBi != null ? ` → 다음 ${word} ${nextBi + 1}` : " → 한 바퀴 끝"}${cur && cur.phase === "play" ? ` · ${cur.barInStep}/${barsPer}마디` : ""}`;
    $("#sbtCap").textContent = !playing ? (running() ? "READY" : "PAUSED") : cur && cur.phase === "count" ? `준비 ${cur.countLeft}` : "PLAY";
    $("#sbtCap").className = "state-label " + (playing ? "running" : "");
    container.querySelectorAll("#sbtBeats .beat").forEach((x, i) => x.classList.toggle("on", playing && i === inBar));
  }
  function onBeat(inBar, beat) {
    if (!playing) return;
    cur = BC.transitionAt(order, barsPer, startStep, beat - beatShift);
    if (cur.phase === "end") {
      st = { ...st, units: st.units + 1 };
      api.addUnit(1);
      api.toast(`${unitWord(st.scaleId)} 한 바퀴 완료 · 이번 세션 ${st.units}회`);
      st = { ...make(st.pass + 1, st.units), bpm: st.bpm };
      bs = blocks(st.rootPc, st.scaleId);
      order = BC.transitionOrder(bs.length, o.dir || "up");
      startStep = 0;
      beatShift = beat - BC.COUNT_IN;
      cur = BC.transitionAt(order, barsPer, 0, BC.COUNT_IN);
    }
    if (cur.phase === "play" && cur.step !== st.step) { st = { ...st, step: cur.step }; persist(); }
    draw(inBar);
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 연주할 수 있음"); return; }
    startStep = st.step; beatShift = 0; cur = { phase: "count", countLeft: BC.COUNT_IN };
    Metro.onMetronomeBeat(onBeat);
    try { await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 }); playing = true; } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); }
    $("#sbtPlay").textContent = playing ? "멈춤" : "연주 시작";
    draw();
  }
  function stop() {
    if (playing) Metro.stopMetronome();
    playing = false; cur = null;
    $("#sbtPlay").textContent = "연주 시작";
    draw();
  }
  $("#sbtPlay").onclick = () => (playing ? stop() : play());
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: BC.clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("sbt.bpm", st.bpm); Metro.setMetronomeBpm(st.bpm); $("#sbtBpmVal").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && (!running() || !Metro.isMetronomeRunning())) stop(); else if (!playing) draw(); }, 300);
  draw();
  return () => { clearInterval(watch); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}
