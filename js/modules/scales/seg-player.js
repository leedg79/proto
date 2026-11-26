// Scales 공용 연주 화면: "구간"(블록·근음·모드) 여러 개를 메트로놈에 맞춰 차례로 연주
// 구간마다 마디 처음에서 시작, 박마다 칠 음을 차례로 진행
// 표시 방식: all(전체 음 보며 치기) / root(근음만 보고 치기) / hide(이름만 보고 치기)
//   root·hide는 구간 끝에 확인 마디 1개를 붙여 정답 모양을 보여 줌
// 모든 구간을 마치면 완료 1회, 다음 사이클로 쉬지 않고 이어감

import * as BC from "./block-core.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { setSetting } from "../../core/storage.js";
import * as Metro from "../../audio/metronome.js";
import { esc, makeStore } from "./common.js";
import { seqTarget } from "../../eval/targets.js";

export const HINTS = [["all", "전체 음 보며"], ["root", "근음만 보고"], ["hide", "이름만 보고"]];
export const hintOk = v => (["all", "root", "hide"].includes(v) ? v : "all");

// 구간 목록 → 박 슬롯. note: 음 순번, -1 쉼표, -2 확인 마디
export function buildSlots(segments, perBeat, hint) {
  const per = 4 * perBeat;
  const slots = [], segStart = [];
  segments.forEach((sg, si) => {
    segStart.push(slots.length);
    sg.notes.forEach((n, ni) => slots.push({ seg: si, note: ni }));
    while (slots.length % per) slots.push({ seg: si, note: -1 });
    if (hint !== "all") for (let i = 0; i < per; i++) slots.push({ seg: si, note: -2 });
  });
  return { slots, segStart, perBeat };
}

export function slotAt(plan, startSlot, k) {
  const countSlots = BC.COUNT_IN * plan.perBeat;
  if (k < countSlots) return { phase: "count", countLeft: BC.COUNT_IN - Math.floor(k / plan.perBeat) };
  const idx = startSlot + (k - countSlots);
  if (idx >= plan.slots.length) return { phase: "end", idx };
  return { phase: "play", idx, slot: plan.slots[idx] };
}

// opts: { storeKey, bpmKey, hint, perBeat, bpm, newParams(cycleNo) → params, build(params) → { title, word, segments }, doneText(built) }
export function mountSegPlayer(container, api, opts) {
  const s0 = api.getActive();
  const store = makeStore(opts.storeKey);
  const hint = hintOk(opts.hint);
  const perBeat = opts.perBeat === 2 ? 2 : 1;
  const fresh = (n, units, bpm) => ({ cycleNo: n, units, params: opts.newParams(n), slot: 0, bpm });
  let st = store.load(s0.id) || fresh(0, 0, BC.clampBpm(opts.bpm || BC.BPM_DEFAULT));
  let built = opts.build(st.params);
  let plan = buildSlots(built.segments, perBeat, hint);
  let playing = false, startSlot = 0, cur = null, half = null, kShift = 0;

  container.innerHTML = `
    <div class="nf sb sp">
      <div class="nf-meta"><span id="spTitle"></span><span id="spProg"></span></div>
      <div class="sb-chips" id="spChips"></div>
      <div class="sp-prompt"><b id="spPrompt"></b><span id="spSub"></span></div>
      <div class="sb-state"><span class="state-label" id="spCap">READY</span><span class="muted small" id="spInfo"></span></div>
      <div class="fretboard sb-board" id="spBoard"></div>
      <div class="beats bf-beats" id="spBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      <div class="nf-actions" style="margin-top:12px"><button class="btn primary wide" id="spPlay" type="button" data-autostart>연주 시작</button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="spBpmVal">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
      <p class="muted small nf-foot">${esc(opts.foot || "")} ${hint === "all" ? "노랑 = 지금 칠 음, 초록 = 근음." : "구간 끝 1마디는 확인 마디(정답 모양 표시)."} 칩을 누르면 그 구간부터 연습</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function draw() {
    const slot = cur && cur.phase === "play" ? cur.slot : plan.slots[Math.min(st.slot, plan.slots.length - 1)];
    const si = slot.seg;
    const sg = built.segments[si];
    const nextSg = built.segments[si + 1];
    const checking = slot.note === -2;
    const live = playing && cur && cur.phase === "play";
    $("#spTitle").textContent = built.title;
    $("#spProg").textContent = `${si + 1}/${built.segments.length} · 완료 ${st.units}회`;
    $("#spChips").innerHTML = built.segments.map((x, i) => `<button type="button" class="sb-chip wide ${i === si ? "now" : ""} ${i < si ? "past" : ""}" data-r="${i}">${esc(x.chip)}</button>`).join("");
    $("#spPrompt").textContent = sg.prompt;
    $("#spSub").textContent = hint === "all" || checking || !live ? sg.sub : sg.subHidden || "";
    // 지판: 표시 방식에 따라
    const showAll = hint === "all" || checking || (!live && hint === "all");
    const changed = new Set(sg.changed || []);
    const act = live && hint === "all" && slot.note >= 0 ? sg.notes[slot.note] : null;
    let marks;
    if (showAll) marks = sg.shape.map(n => ({ s: n.s, f: n.f, label: n.label, kind: act && act.s === n.s && act.f === n.f ? "active" : changed.has(`${n.s}-${n.f}`) ? "changed" : n.root ? "root" : "note" }));
    else if (hint === "root") marks = sg.shape.filter(n => n.root).map(n => ({ s: n.s, f: n.f, label: n.label, kind: "root" }));
    else marks = [];
    const view = hint === "hide" && !checking && sg.hideWide ? { from: 0, to: 15 } : { from: sg.from, to: sg.to };
    $("#spBoard").innerHTML = scaleBoardSvg(marks, view);
    // 안내 문구
    let info;
    if (checking) info = `확인 · ${sg.prompt} 모양${nextSg ? ` · 다음: ${nextSg.prompt}` : ""}`;
    else if (live && slot.note >= 0) {
      const n = sg.notes[slot.note];
      info = hint === "all" ? `${n.s}번 현 ${n.f}프렛 · ${n.label} · ${slot.note + 1}/${sg.notes.length}음` : `${slot.note + 1}/${sg.notes.length}음`;
    } else if (live && slot.note === -1) info = nextSg && hint === "all" ? `다음: ${nextSg.prompt}` : "쉼";
    else info = `${sg.notes.length}음`;
    $("#spInfo").textContent = info;
    $("#spBoard").classList.toggle("checking", checking);
  }
  function drawCap(inBar) {
    $("#spCap").textContent = !playing ? (running() ? "READY" : "PAUSED") : cur && cur.phase === "count" ? `준비 ${cur.countLeft}` : cur && cur.slot && cur.slot.note === -2 ? "CHECK" : "PLAY";
    $("#spCap").className = "state-label " + (playing ? "running" : "");
    container.querySelectorAll("#spBeats .beat").forEach((x, i) => x.classList.toggle("on", playing && i === inBar));
  }
  function step(kAbs, inBar) {
    cur = slotAt(plan, startSlot, kAbs - kShift);
    if (cur.phase === "end") {
      st = { ...st, units: st.units + 1 };
      api.addUnit(1);
      api.toast(`${opts.doneText ? opts.doneText(built) : "1사이클 완료"} · 이번 세션 ${st.units}회`);
      st = { ...fresh(st.cycleNo + 1, st.units, st.bpm) };
      built = opts.build(st.params);
      plan = buildSlots(built.segments, perBeat, hint);
      startSlot = 0;
      kShift = kAbs - BC.COUNT_IN * perBeat;
      cur = slotAt(plan, 0, BC.COUNT_IN * perBeat);
    }
    if (cur.phase === "play" && cur.slot && cur.slot.note >= 0 && api.eval && evSeg !== `${st.cycleNo}:${cur.slot.seg}`) {
      // 연주 평가: 구간이 바뀔 때마다 그 구간의 음을 순서대로 쳤는지
      evSeg = `${st.cycleNo}:${cur.slot.seg}`;
      const sg = built.segments[cur.slot.seg];
      api.eval.prompt(seqTarget(`${built.title || ""} ${sg.chip || ""}`.trim(), sg.notes));
    }
    if (cur.phase === "play") {
      // 재개 시 지금 구간 처음부터
      const ss = plan.segStart[cur.slot.seg];
      if (st.slot !== ss) { st = { ...st, slot: ss }; persist(); }
    }
    draw(); drawCap(inBar);
  }
  let evSeg = null;
  function onBeat(inBar, beat) {
    if (!playing) return;
    step(beat * perBeat, inBar);
    if (perBeat === 2) {
      clearTimeout(half);
      half = setTimeout(() => { if (playing) step(beat * 2 + 1, inBar); }, (60 / st.bpm) * 500);
    }
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 연주할 수 있음"); return; }
    startSlot = st.slot; kShift = 0; cur = { phase: "count", countLeft: BC.COUNT_IN };
    Metro.onMetronomeBeat(onBeat);
    try { await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 }); playing = true; } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); }
    $("#spPlay").textContent = playing ? "멈춤" : "연주 시작";
    draw(); drawCap(-1);
  }
  function stop() {
    if (playing) Metro.stopMetronome();
    if (playing && api.eval) api.eval.end();
    evSeg = null;
    clearTimeout(half);
    playing = false; cur = null;
    $("#spPlay").textContent = "연주 시작";
    draw(); drawCap(-1);
  }
  $("#spPlay").onclick = () => (playing ? stop() : play());
  $("#spChips").addEventListener("click", e => {
    const c = e.target.closest("[data-r]"); if (!c || playing) return;
    st = { ...st, slot: plan.segStart[Number(c.dataset.r)] }; persist(); draw();
  });
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: BC.clampBpm(st.bpm + Number(b.dataset.bpm)) };
    if (opts.bpmKey) setSetting(opts.bpmKey, st.bpm);
    Metro.setMetronomeBpm(st.bpm); $("#spBpmVal").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && (!running() || !Metro.isMetronomeRunning())) stop(); else if (!playing) drawCap(-1); }, 200);
  draw(); drawCap(-1);
  return () => { clearInterval(watch); clearTimeout(half); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}

export function clearStore(key) { makeStore(key).clear(); }
