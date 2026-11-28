// 릭 1개 연습(v2.10.0): 기본 릭 모음·장르·전체 목록에서 고른 릭을 두 방식으로 연습
//  혼자 익히기   : 박자 없이 한 음씩. 다음 칠 음을 악보·지판에 강조. 마이크가 켜져 있으면 맞는 음을 들을 때 다음 음으로(판정·기록 없음),
//                  꺼져 있으면 "다음 음" 버튼. 구간(마디) 반복 가능. 끝까지 3번 = 완료 1회
//  박자 맞춰 치기: 준비 4박(클릭) → 릭 → 다시 준비 4박 → 릭 … 반복. 판정을 켜고 마이크가 켜져 있으면 음마다 박자·음 높이 판정,
//                  통과 2번 = 완료 1회. 판정이 꺼져 있으면 끝까지 3번 = 완료 1회
import { lickById, LICKS, realize, playerOf, lickDifficulty, DIFF_NAMES, USE_NAMES } from "./lick-core.js";
import { paintScore } from "./lick-card.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { playLick, stopLick, beatAt } from "../../audio/lick-player.js";
import { loadInstrument, playNote, masterOut } from "../../audio/sampler.js";
import { unlockAudio, getAudioContext } from "../../audio/context.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { followTarget, midiAt } from "../../eval/targets.js";
import { KEY_LIST } from "../../theory/scales.js";

const store = makeStore("fretlab:lk1one");
export const clearFinder = () => store.clear();

const MODES = [["solo", "혼자 익히기"], ["tempo", "박자 맞춰 치기"]];
const ONOFF_MIC = [["on", "켜기"], ["off", "끄기"]];
const SCORE = [["on", "판정·기록"], ["off", "판정 안 함"]];
const KEYS = [["orig", "원래 키"], ["random", "무작위 키"]];
const DEMO = [["on", "기타 소리 같이"], ["off", "클릭만"]];
const RUNS_PER_UNIT = 3, PASSES_PER_UNIT = 2;

export const pickedLick = () => lickById(getSetting("lk1.pick", "")) || null;

function lickLine(l) {
  if (!l) return `<p class="muted">고른 릭이 없음 · 릭 목록에서 다시 고름</p>`;
  const r = realize(l);
  const p = playerOf(l);
  return `<div class="lk1-pick"><b>${esc(l.id)}</b> <span>${esc(r.title)}</span>
    <small class="muted">${p ? `${esc(p.genreName)} · ${esc(p.name)} · ` : ""}${esc(DIFF_NAMES[lickDifficulty(l)])} · ${esc(USE_NAMES[l.use] || "")} · ${l.bars}마디</small></div>`;
}

export function settingsHtml() {
  const l = pickedLick();
  return `
    ${lickLine(l)}
    <div class="field" style="margin-top:14px"><label>연습 방식</label>${segHtml("lk1Mode", MODES, getSetting("lk1.mode", "solo"))}
      <p class="muted small" style="margin:6px 0 0">혼자 익히기 = 박자와 상관없이 악보를 보며 한 음씩 손가락 익히기 · 박자 맞춰 치기 = 클릭에 맞춰 반복 연주</p></div>
    <div class="field" style="margin-top:14px"><label>마이크</label>${segHtml("lk1Mic", ONOFF_MIC, getSetting("eval.on", !window.__fretlabMicDefaultOff) ? "on" : "off")}
      <p class="muted small" style="margin:6px 0 0">혼자 익히기에서 켜 두면 맞는 음을 칠 때 다음 음으로 넘어감(틀려도 기록 안 함)</p></div>
    <div class="field" style="margin-top:14px"><label>판정 (박자 맞춰 치기)</label>${segHtml("lk1Score", SCORE, getSetting("lk1.score", "on"))}</div>
    <div class="field" style="margin-top:14px"><label>키</label>${segHtml("lk1Key", KEYS, getSetting("lk1.key", "orig"))}</div>
    <div class="field" style="margin-top:14px"><label>시범 소리 (박자 맞춰 치기)</label>${segHtml("lk1Demo", DEMO, getSetting("lk1.demo", "on"))}</div>`;
}
export function bindSettings(root) { ["lk1Mode", "lk1Mic", "lk1Score", "lk1Key", "lk1Demo"].forEach(id => bindPicker(root, id)); }
export function readSettings(root) {
  const pick = (id, list, def) => { const v = readSel(root, id, "v"); return list.some(([k]) => k === v) ? v : def; };
  const o = {
    lickId: getSetting("lk1.pick", ""),
    mode: pick("lk1Mode", MODES, "solo"), mic: pick("lk1Mic", ONOFF_MIC, "on"),
    score: pick("lk1Score", SCORE, "on"), key: pick("lk1Key", KEYS, "orig"), demo: pick("lk1Demo", DEMO, "on")
  };
  setSetting("lk1.mode", o.mode); setSetting("lk1.score", o.score); setSetting("lk1.key", o.key); setSetting("lk1.demo", o.demo);
  setSetting("eval.on", o.mic === "on");
  return o;
}

const pcOf = m => ((m % 12) + 12) % 12;

// 세션 안에서 이전·다음 릭으로 바꿀 수 있게: 릭 하나를 그리는 mountOne을 바꿔 끼움(완료 횟수·BPM은 이어짐)
export function mount(container, api) {
  let cleanup = null;
  const show = id => { if (cleanup) cleanup(); cleanup = mountOne(container, api, id, show); };
  show(null);
  return () => { if (cleanup) cleanup(); };
}
// 고른 목록(기본 릭 모음·장르·전체 목록에서 보던 순서)
const pickList = () => { const l = getSetting("lk1.list", []); return Array.isArray(l) ? l.filter(id => lickById(id)) : []; };

function mountOne(container, api, switchTo, show) {
  const s0 = api.getActive();
  const o = s0.options || {};
  let st = store.load(s0.id);
  const lick = lickById(switchTo || (st && st.lickId) || o.lickId) || LICKS[0];
  const newKey = () => (o.key === "random" ? KEY_LIST[Math.floor(Math.random() * 12)] : lick.key);
  if (!st) st = { lickId: lick.id, key: newKey(), cur: 0, part: "all", runs: 0, passes: 0, units: 0, bpm: getSetting("lk1.bpm", 60) };
  else if (st.lickId !== lick.id) st = { ...st, lickId: lick.id, key: newKey(), cur: 0, part: "all", runs: 0, passes: 0 };
  setSetting("lk1.pick", lick.id);
  const nameEl = document.querySelector(".sess-name b"); if (nameEl) nameEl.textContent = `릭 ${lick.id}`;
  const list = pickList();
  const pos = list.indexOf(lick.id);
  const persist = () => store.save(s0.id, st);
  const r = realize(lick, st.key);
  const ev = api.eval;
  const mode = o.mode === "tempo" ? "tempo" : "solo";
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const noteIdx = r.events.map((e, i) => (e.rest ? -1 : i)).filter(i => i >= 0);
  const parts = r.bars > 1 ? [["all", "전체"], ...Array.from({ length: r.bars }, (_, b) => [String(b), `${b + 1}마디`])] : [["all", "전체"]];
  const section = () => (st.part === "all" ? noteIdx : noteIdx.filter(i => Math.floor(r.events[i].at / 48) === Number(st.part)));
  const p = playerOf(lick);

  container.innerHTML = `
    <div class="nf lk lk1">
      <div class="lk1-nav">
        <button class="btn small" id="l1PrevLick" type="button" ${pos > 0 ? "" : "disabled"}>‹ 이전 릭</button>
        <span id="l1No">${esc(lick.id)}${pos >= 0 ? ` <small class="muted">${pos + 1}/${list.length}</small>` : ""}</span>
        <button class="btn small" id="l1NextLick" type="button" ${pos >= 0 && pos < list.length - 1 ? "" : "disabled"}>다음 릭 ›</button>
      </div>
      <div class="nf-meta"><span></span><span id="l1Prog"></span></div>
      <div class="lk1-title"><b>${esc(r.title)}</b><small class="muted">${p ? `${esc(p.name)} · ` : ""}${esc(DIFF_NAMES[lickDifficulty(lick)])} · ${mode === "solo" ? "혼자 익히기" : "박자 맞춰 치기"}</small></div>
      <div class="tab-wrap score-wrap" id="l1Score" data-key="${st.key}"></div>
      <div class="fretboard" id="l1Board"></div>
      ${mode === "solo" ? `<div class="lk1-now" id="l1Now"></div>` : `<div class="lk1-now" id="l1State">정지</div>`}
      <div class="ctl-dock">
      ${mode === "solo" ? `
        <div class="nf-actions lk-nav">
          <button class="btn" id="l1Prev" type="button">← 이전 음</button>
          <button class="btn primary" id="l1Next" type="button">다음 음 →</button>
        </div>
        <div class="nf-actions lk-nav" style="margin-top:8px">
          <button class="btn small" id="l1Hear" type="button">이 음 듣기</button>
          <button class="btn small" id="l1PlayAll" type="button">▶ 릭 듣기</button>
          <button class="btn small" id="l1Reset" type="button">처음부터</button>
        </div>
        ${parts.length > 1 ? `<div style="margin-top:8px">${segHtml("l1Part", parts, st.part)}</div>` : ""}` : `
        <div class="nf-actions"><button class="btn primary wide" id="l1Play" type="button" data-autostart>시작</button></div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button>
          <div class="bpm-val"><b id="l1Bpm">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="5">+5</button>
        </div></div>`}
      </div>
      <p class="muted small nf-foot">${mode === "solo" ? "박자와 상관없이 한 음씩 손가락을 익힘. 마이크가 켜져 있으면 맞는 음을 칠 때 다음 음으로 넘어감" : "준비 4박 → 릭 → 준비 4박 → 릭 순서로 반복. 판정이 켜져 있으면 음마다 박자와 음 높이를 봄"}${lick.note ? ` · ${esc(lick.note)}` : ""}</p>
    </div>`;
  const $ = s => container.querySelector(s);

  // 악보·지판(지금 음 강조)
  const lickKeys = r.notes;
  let from = Math.max(0, r.lo - 1); if (from <= 1) from = 0;
  const to = Math.max(from + 5, r.hi + 1);
  function paint(active) {
    paintScore($("#l1Score"), lick, active);
    const nowSet = active >= 0 && r.events[active] ? new Set(r.events[active].notes.map(n => `${n.s}-${n.f}`)) : new Set();
    const marks = [...new Map(lickKeys.map(n => [`${n.s}-${n.f}`, n])).values()].map(n => ({ s: n.s, f: n.f, label: n.deg, kind: nowSet.has(`${n.s}-${n.f}`) ? "active" : n.deg === "R" ? "root" : "note" }));
    $("#l1Board").innerHTML = scaleBoardSvg(marks, { from, to });
  }
  function drawProg() {
    $("#l1Prog").textContent = mode === "solo"
      ? `끝까지 ${st.runs}번 · 완료 ${st.units}회`
      : `연주 ${st.runs}번${scoring() ? ` · 통과 ${st.passes}번` : ""} · 완료 ${st.units}회`;
  }
  const scoring = () => o.score !== "off" && ev && ev.isOn();
  const unit = () => { st.units++; api.addUnit(1); api.toast(`${lick.id} 완료 · 이번 세션 ${st.units}회`); };

  // ── 혼자 익히기 ──
  let lastAdv = 0;
  function eventMidis(e) {
    const ms = e.notes.map(n => midiAt(n.s, n.f));
    const b = Math.ceil(e.bend || 0);
    return [...ms, ...Array.from({ length: b }, (_, k) => ms[0] + k + 1)];
  }
  function drawSolo() {
    const sec = section();
    if (st.cur >= sec.length) st.cur = 0;
    const i = sec[st.cur];
    const e = r.events[i];
    paint(i);
    const ns = e.notes.map(n => `${n.s}번 줄 ${n.f}프렛`).join(" + ");
    const nm = r.notes.find(n => n.at === e.at);
    $("#l1Now").innerHTML = `<b>${st.cur + 1}/${sec.length}</b> 다음 음: ${esc(ns)}${nm ? ` · ${esc(nm.deg)}${e.bend ? ` → ${e.bend === 1 ? "반음" : e.bend === 2 ? "온음" : "1음반"} 벤딩` : ""}` : ""}`;
    $("#l1Prev").disabled = st.cur === 0;
    drawProg();
  }
  function advance() {
    if (!running()) { api.toast("세션을 재개한 뒤 넘길 수 있음"); return; }
    const sec = section();
    lastAdv = performance.now();
    st.cur++;
    if (st.cur >= sec.length) {
      st.cur = 0; st.runs++;
      if (st.runs % RUNS_PER_UNIT === 0) unit(); else api.toast(`끝까지 ${st.runs}번`);
    }
    persist(); drawSolo();
  }
  // 릭 전체를 이어서 듣기(지금 BPM, 악보에서 지금 음 강조). 다시 누르면 멈춤
  let listening = false;
  async function playAll() {
    const b = $("#l1PlayAll");
    if (listening) { stopLick(); listening = false; b.textContent = "▶ 릭 듣기"; drawSolo(); return; }
    try {
      listening = true; b.textContent = "■ 멈춤";
      await playLick(r, st.bpm, { countIn: 0, onEvent: i => {
        if (!listening) return;
        if (i >= 0) paint(i);
        else { listening = false; b.textContent = "▶ 릭 듣기"; drawSolo(); }
      } });
    } catch (err) { listening = false; b.textContent = "▶ 릭 듣기"; api.toast("소리를 낼 수 없음: " + err.message); }
  }
  async function hear() {
    const e = r.events[section()[st.cur]];
    try {
      await unlockAudio(); await loadInstrument("guitar");
      const ctx = getAudioContext();
      e.notes.forEach(n => playNote("guitar", midiAt(n.s, n.f), ctx.currentTime + 0.03, 0.9, { gain: 0.8, bend: e.bend || 0, out: masterOut(ctx) }));
    } catch (err) { api.toast("소리를 낼 수 없음: " + err.message); }
  }

  // ── 박자 맞춰 치기 ──
  let playing = false, timers = [], loopStart = 0;
  const later = (fn, ms) => { const id = setTimeout(fn, Math.max(0, ms)); timers.push(id); };
  // 한 바퀴 예약: 소리(준비 4박 + 릭)는 미리, 판정 시작은 앞 바퀴 판정이 마감된 뒤(준비 박 중간), 다음 바퀴 소리는 끝나기 직전에 예약
  function loopOnce(startAt, first, prevEnd = null) {
    const ctx = getAudioContext();
    const spb = 60 / st.bpm;
    const now = ctx.currentTime;
    const label = `${lick.id} · ${st.bpm} BPM`;
    playLick(r, st.bpm, { countIn: 4, click: true, silent: o.demo === "off", startAt, keep: !first, onEvent: i => { if (i >= 0 && playing) paint(i); } })
      .catch(err => { api.toast("소리를 낼 수 없음: " + err.message); stop(); });
    const promptAt = Math.min(startAt - 0.15, Math.max(startAt - 2 * spb, prevEnd != null ? prevEnd + 0.75 : 0));
    later(() => {
      if (!playing || !scoring()) return;
      ev.prompt(followTarget(label));
      r.events.forEach((e, i) => { if (!e.rest) ev.expect(`${i + 1}번째 음`, startAt + beatAt(r, e.at) * spb, { midis: eventMidis(e) }); });
    }, (promptAt - now) * 1000);
    const endT = startAt + Math.ceil(r.ticks / 48) * 4 * spb;
    later(() => {
      if (!playing) return;
      if (scoring()) ev.end();
      st.runs++;
      if (!scoring() && st.runs % RUNS_PER_UNIT === 0) unit();
      persist(); drawProg();
    }, (endT - now) * 1000 + 300);
    later(() => { if (playing) loopOnce(endT + 4 * (60 / st.bpm), false, endT); }, (endT - now) * 1000 - 300);
    later(() => { if (playing) $("#l1State").textContent = `연주 중 · ${st.runs + 1}번째`; }, (startAt - now) * 1000);
    later(() => { if (playing) $("#l1State").textContent = "준비 4박"; }, (startAt - 4 * spb - now) * 1000);
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
    $("#l1Play").textContent = "음원 불러오는 중…";
    try {
      await unlockAudio(); await loadInstrument("guitar");
      const ctx = getAudioContext();
      playing = true; $("#l1Play").textContent = "멈춤";
      loopOnce(ctx.currentTime + 0.2 + 4 * (60 / st.bpm), true);
    } catch (err) { api.toast("소리를 켤 수 없음: " + err.message); $("#l1Play").textContent = "시작"; playing = false; }
  }
  function stop() {
    const was = playing;
    playing = false; timers.forEach(clearTimeout); timers = []; stopLick();
    if (was && ev) ev.end();
    if ($("#l1Play")) $("#l1Play").textContent = "시작";
    if ($("#l1State")) $("#l1State").textContent = "정지";
    paint(-1);
  }

  const offs = [];
  if (mode === "solo") {
    $("#l1Next").onclick = advance;
    $("#l1Prev").onclick = () => { if (st.cur > 0) { st.cur--; persist(); drawSolo(); } };
    $("#l1Reset").onclick = () => { st.cur = 0; persist(); drawSolo(); };
    $("#l1Hear").onclick = hear;
    $("#l1PlayAll").onclick = playAll;
    if ($("#l1Part")) $("#l1Part").addEventListener("click", e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      $("#l1Part").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
      st.part = b.dataset.v; st.cur = 0; persist(); drawSolo();
    });
    // 마이크: 지금 음(벤딩 목표음·옥타브 오인식 포함)을 들으면 다음 음으로
    if (ev && ev.onHeard) offs.push(ev.onHeard(h => {
      if (!running() || !ev.isOn()) return;
      if (performance.now() - lastAdv < 180) return;
      const e = r.events[section()[st.cur]];
      if (!e) return;
      const ok = eventMidis(e).some(m => pcOf(m) === pcOf(h.midi));
      ev.info(ok ? `들림 ${h.name} ✓ 다음 음으로` : `들림 ${h.name} · 기다리는 음 ${e.notes.map(n => `${n.s}번 줄 ${n.f}프렛`).join("+")}`);
      if (ok) advance();
    }));
    drawSolo();
  } else {
    $("#l1Play").onclick = () => (playing ? stop() : play());
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b) return;
      st.bpm = Math.min(220, Math.max(30, st.bpm + Number(b.dataset.bpm)));
      setSetting("lk1.bpm", st.bpm); $("#l1Bpm").textContent = st.bpm; persist();
    });
    if (ev && ev.onRecord) offs.push(ev.onRecord(rec => {
      if (!playing || rec.kind !== "follow" || !rec.ok) return;
      st.passes++;
      if (st.passes % PASSES_PER_UNIT === 0) unit();
      persist(); drawProg();
    }));
    paint(-1); drawProg();
  }
  const goLick = d => { const id = list[pos + d]; if (!id) return; persist(); show(id); };
  $("#l1PrevLick").onclick = () => goLick(-1);
  $("#l1NextLick").onclick = () => goLick(1);
  const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
  return () => { clearInterval(watch); stop(); if (listening) stopLick(); offs.forEach(f => f()); if (ev) ev.end(); persist(); };
}

// 시험용
export const _test = { MODES };
