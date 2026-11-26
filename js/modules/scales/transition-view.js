// Block Transition Practice 화면: 이웃한 블록 2~3개를 하나의 경로(선)로 이어 놓고, 그 위를 박에 맞춰 이동
// 블록 1에서 시작해 중간 줄에서 슬라이드로 다음 블록으로 넘어감(블록 3개면 두 번). 바꾸는 줄은 경로마다 무작위
// 지판 위치 순서로 모든 경로(1→2, 2→3 …)를 마치면 완료 1회

import * as BC from "./block-core.js";
import { scaleTitle, SCALES } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import * as Metro from "../../audio/metronome.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey, unitWord } from "./common.js";

const store = makeStore("fretlab:sbt3");
export const clearFinder = () => store.clear();
const shapeOk = v => (["up", "down", "updown"].includes(v) ? v : "up");

export function settingsHtml() {
  const bpm = BC.clampBpm(getSetting("sbt.bpm", 60));
  const count = Number(getSetting("sbt.count", 2)) === 3 ? 3 : 2;
  const dir = shapeOk(getSetting("sbt.shape", "up"));
  return `
    <div class="field"><label>키</label>${keyPickerHtml("sbtKey", "sbt.key")}</div>
    <div class="field" style="margin-top:14px"><label>잇는 블록 수</label>${segHtml("sbtCount", [[2, "2개"], [3, "3개"]], count)}</div>
    <div class="field" style="margin-top:14px"><label>진행</label>${segHtml("sbtDir", BC.SHAPES, dir)}</div>
    <div class="field" style="margin-top:14px"><label>박당 음 수</label>${segHtml("sbtPer", [[1, "4분음표(1음)"], [2, "8분음표(2음)"]], getSetting("sbt.per", 1))}</div>
    <div class="field" style="margin-top:14px">
      <label for="sbtBpm">BPM <b id="sbtBpmOut">${bpm}</b></label>
      <input id="sbtBpm" type="range" min="${BC.BPM_MIN}" max="${BC.BPM_MAX}" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">블록 1에서 시작해 중간 줄에서 슬라이드로 다음 블록으로 넘어가며 스케일을 같은 음 반복 없이 연속 연주(블록 3개면 두 번 넘어감). 넘어가는 줄은 경로마다 달라짐. 지판 아래쪽 경로부터 차례로, 모든 경로를 마치면 완료 1회</p>`;
}
export function bindSettings(root) {
  ["sbtKey", "sbtCount", "sbtDir", "sbtPer"].forEach(id => bindPicker(root, id));
  const r = root.querySelector("#sbtBpm");
  r.oninput = () => { root.querySelector("#sbtBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const key = Number(readSel(root, "sbtKey"));
  const count = Number(readSel(root, "sbtCount", "v")) === 3 ? 3 : 2;
  const dir = shapeOk(readSel(root, "sbtDir", "v"));
  const per = Number(readSel(root, "sbtPer", "v")) === 2 ? 2 : 1;
  const bpm = BC.clampBpm(root.querySelector("#sbtBpm").value);
  setSetting("sbt.key", key); setSetting("sbt.count", count); setSetting("sbt.shape", dir); setSetting("sbt.per", per); setSetting("sbt.bpm", bpm);
  return { key, count, dir, per, bpm };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const o = s0.options || {};
  const count = o.count === 3 ? 3 : 2;
  const shape = shapeOk(o.dir);
  const per = o.per === 2 ? 2 : 1;
  const newCycle = (n, units) => {
    const scaleId = (scales.length ? scales : ["minor-penta"])[n % Math.max(1, scales.length)];
    return { cycleNo: n, units, rootPc: pickKey(o.key ?? -1), scaleId, slot: 0, bpm: o.bpm || 60, picks: BC.makePicks(8) };
  };
  let st = store.load(s0.id) || newCycle(0, 0);
  if (!st.picks) st = { ...st, picks: BC.makePicks(8) };
  let cycle = BC.transitionCycle(st.rootPc, st.scaleId, count, shape, per, st.picks);
  let word = unitWord(st.scaleId);
  let playing = false, startSlot = 0, cur = null, half = null, kShift = 0;

  container.innerHTML = `
    <div class="nf sb">
      <div class="nf-meta"><span id="sbtTitle"></span><span id="sbtProg"></span></div>
      <div class="sb-chips" id="sbtChips"></div>
      <div class="sb-state"><span class="state-label" id="sbtCap">READY</span><span class="muted small" id="sbtInfo"></span></div>
      <div class="fretboard sb-board" id="sbtBoard"></div>
      <div class="beats bf-beats" id="sbtBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      <div class="ctl-dock">
      <div class="nf-actions" style="margin-top:12px"><button class="btn primary wide" id="sbtPlay" type="button" data-autostart>연주 시작</button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="sbtBpmVal">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
      </div>
      <p class="muted small nf-foot">파란 선 = 연주 경로, 주황 선 = 슬라이드로 다음 블록 넘어가기, 노랑 = 지금 칠 음, 초록 = 근음, 흐린 원 = 연결 블록의 나머지 음. 경로 칩을 누르면 그 경로부터 연습</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function draw() {
    const slot = cur && cur.phase === "play" ? cur.slot : cycle.slots[Math.min(st.slot, cycle.slots.length - 1)];
    const ri = slot.block;
    const run = cycle.runs[ri];
    $("#sbtTitle").textContent = scaleTitle(st.rootPc, st.scaleId);
    $("#sbtProg").textContent = `경로 ${ri + 1}/${cycle.runs.length} · 완료 ${st.units}회`;
    $("#sbtChips").innerHTML = cycle.runs.map((r, i) => `<button type="button" class="sb-chip wide ${i === ri ? "now" : ""} ${i < ri ? "past" : ""}" data-r="${i}">${r.label}</button>`).join("");
    const activeIdx = playing && cur && cur.phase === "play" ? slot.note : -1;
    const act = activeIdx >= 0 ? run.notes[activeIdx] : null;
    const onPath = new Set(run.notes.map(n => `${n.s}-${n.f}`));
    const marks = [];
    const seen = new Set();
    for (const b of run.blocks) for (const n of b.notes) {
      const k = `${n.s}-${n.f}`;
      if (onPath.has(k) || seen.has(k)) continue;
      seen.add(k);
      marks.push({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" });
    }
    for (const n of run.notes) {
      const k = `${n.s}-${n.f}`;
      if (seen.has(k)) continue;
      seen.add(k);
      marks.push({ s: n.s, f: n.f, label: n.label, kind: act && act.s === n.s && act.f === n.f ? "active" : n.root ? "root" : "note" });
    }
    if (act) { const i = marks.findIndex(m => m.kind === "active"); marks.push(...marks.splice(i, 1)); }
    const lo = Math.min(...marks.map(m => m.f)), hi = Math.max(...marks.map(m => m.f));
    let from = Math.max(0, lo - 1); if (from <= 1) from = 0;
    const to = Math.max(from + 6, hi + 1);
    $("#sbtBoard").innerHTML = scaleBoardSvg(marks, { from, to, path: run.notes });
    const shapeWord = { up: "상행", down: "하행", updown: "왕복" }[shape];
    const sl = run.notes.filter(n => n.slide).map(n => `${n.s}번`);
    $("#sbtInfo").textContent = act
      ? `${act.s}번 현 ${act.f}프렛 · ${act.label}${act.slide ? " · 슬라이드" : ""} · ${activeIdx + 1}/${run.notes.length}음`
      : `${word} ${run.label} · ${shapeWord} · ${sl.join("·")} 줄에서 슬라이드 · ${run.notes.length}음`;
  }
  function drawCap(inBar) {
    $("#sbtCap").textContent = !playing ? (running() ? "READY" : "PAUSED") : cur && cur.phase === "count" ? `준비 ${cur.countLeft}` : "PLAY";
    $("#sbtCap").className = "state-label " + (playing ? "running" : "");
    container.querySelectorAll("#sbtBeats .beat").forEach((x, i) => x.classList.toggle("on", playing && i === inBar));
  }
  function step(kAbs, inBar) {
    cur = BC.slotAt(cycle, startSlot, kAbs - kShift);
    if (cur.phase === "end") {
      st = { ...st, units: st.units + 1 };
      api.addUnit(1);
      api.toast(`경로 ${cycle.runs.length}개 모두 완료 · 이번 세션 ${st.units}회`);
      st = { ...newCycle(st.cycleNo + 1, st.units), bpm: st.bpm };
      cycle = BC.transitionCycle(st.rootPc, st.scaleId, count, shape, per, st.picks);
      word = unitWord(st.scaleId);
      startSlot = 0;
      kShift = kAbs - BC.COUNT_IN * per;
      cur = BC.slotAt(cycle, 0, BC.COUNT_IN * per);
    }
    if (cur.phase === "play") {
      // 재개 시 지금 경로 처음부터
      const rs = cycle.blockStart[cur.slot.block];
      if (st.slot !== rs) { st = { ...st, slot: rs }; persist(); }
    }
    draw(); drawCap(inBar);
  }
  function onBeat(inBar, beat) {
    if (!playing) return;
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
    $("#sbtPlay").textContent = playing ? "멈춤" : "연주 시작";
    draw(); drawCap(-1);
  }
  function stop() {
    if (playing) Metro.stopMetronome();
    clearTimeout(half);
    playing = false; cur = null;
    $("#sbtPlay").textContent = "연주 시작";
    draw(); drawCap(-1);
  }
  $("#sbtPlay").onclick = () => (playing ? stop() : play());
  $("#sbtChips").addEventListener("click", e => {
    const c = e.target.closest("[data-r]"); if (!c || playing) return;
    st = { ...st, slot: cycle.blockStart[Number(c.dataset.r)] }; persist(); draw();
  });
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: BC.clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("sbt.bpm", st.bpm); Metro.setMetronomeBpm(st.bpm); $("#sbtBpmVal").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && (!running() || !Metro.isMetronomeRunning())) stop(); else if (!playing) drawCap(-1); }, 200);
  draw(); drawCap(-1);
  return () => { clearInterval(watch); clearTimeout(half); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}
