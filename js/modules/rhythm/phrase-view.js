// 리듬 프레이즈(R3): 1~2마디 단음 리프·프레이즈를 드럼·베이스 반주 위에서 반복
// 시범 듣기 → 같이 치기 → 혼자 치기. 같이·혼자 치기 8마디 = 완료 1회 → 다음 프레이즈

import * as R from "./rhythm-core.js";
import { scoreSvg } from "../../render/score.js";
import { startRhythm, stopRhythm, setRhythmBpm, setRhythmLevel, isRhythmRunning } from "../../audio/rhythm-player.js";
import { keyName } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { MODES } from "./pattern-view.js";

const store = makeStore("fretlab:rhph1");
export const clearFinder = () => store.clear();
const MODE_LEVEL = { listen: 0.9, along: 0.3, solo: 0 };
const BARS_PER_UNIT = 8;
const clampBpm = v => Math.max(40, Math.min(180, Math.round(Number(v) || 80)));
const FEEL = { straight: "스트레이트", shuffle: "셔플", triplet: "셋잇단" };

export function settingsHtml() {
  const bpm = clampBpm(getSetting("rhph.bpm", 80));
  return `
    <div class="field"><label>프레이즈 순서</label>${segHtml("rhphOrder", [["seq", "순서대로"], ["rand", "무작위"]], getSetting("rhph.order", "seq"))}</div>
    <div class="field" style="margin-top:14px"><label>클릭</label>${segHtml("rhphClick", [["off", "드럼·베이스만"], ["on", "드럼·베이스 + 클릭"]], getSetting("rhph.click", "off"))}</div>
    <div class="field" style="margin-top:14px">
      <label for="rhphBpm">BPM <b id="rhphBpmOut">${bpm}</b></label>
      <input id="rhphBpm" type="range" min="40" max="180" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">프레이즈마다 정해진 키·코드로 드럼·베이스가 나옴. 시범 듣기 → 같이 치기 → 혼자 치기. 같이·혼자 치기로 ${BARS_PER_UNIT}마디 = 완료 1회</p>`;
}
export function bindSettings(root) {
  bindPicker(root, "rhphOrder"); bindPicker(root, "rhphClick");
  const r = root.querySelector("#rhphBpm");
  r.oninput = () => { root.querySelector("#rhphBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const bpm = clampBpm(root.querySelector("#rhphBpm").value), order = readSel(root, "rhphOrder", "v") || "seq", click = readSel(root, "rhphClick", "v") || "off";
  setSetting("rhph.bpm", bpm); setSetting("rhph.order", order); setSetting("rhph.click", click);
  return { bpm, order, click };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const pool = R.phrasesFor(s0.topics);
  const ids = pool.map(p => p.id);
  if (o.order === "rand") for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  let st = store.load(s0.id) || { order: ids, n: 0, units: 0, mode: "listen", bpm: clampBpm(o.bpm || 80), click: o.click || "off" };
  const persist = () => store.save(s0.id, st);
  let ph, counted = 0, playing = false, bar = -1, lastOn = [];

  container.innerHTML = `
    <div class="nf rh">
      <div class="nf-meta"><span id="phNo"></span><span id="phProg"></span></div>
      <div class="rh-head"><b id="phName"></b><small id="phInfo" class="muted"></small></div>
      <div class="score-wrap" id="phScore"></div>
      <div class="jam-chart" id="phChart"></div>
      <p class="small rh-tip" id="phTip"></p>
      ${segHtml("phMode", MODES, st.mode)}
      <div class="jam-state muted small" id="phState">정지</div>
      <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="phPlay" type="button" data-autostart>시작</button></div>
      <div class="btn-row" style="gap:8px;margin-top:8px">
        <button class="btn small" id="phPrev" type="button">← 이전</button>
        <button class="btn small" id="phNext" type="button">다음 →</button>
      </div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="phBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };

  function load() { ph = R.PHRASE_LIST.find(p => p.id === st.order[st.n % st.order.length]) || pool[0]; counted = 0; bar = -1; }
  function drawProg() { $("#phProg").textContent = `${st.mode === "listen" ? "듣기" : `${counted}/${BARS_PER_UNIT}마디`} · 완료 ${st.units}회`; }
  function drawChart() { $("#phChart").innerHTML = ph.chords.map((c, i) => `<div class="jam-bar ${i === bar ? "now" : ""}"><small>${i + 1}</small><b>${esc(c.name)}</b></div>`).join(""); }
  function draw() {
    $("#phNo").textContent = `${(st.n % st.order.length) + 1}/${st.order.length} · ${ph.id}`;
    $("#phName").textContent = ph.name;
    $("#phInfo").textContent = `${R.TOPIC_NAMES[ph.topic] || ph.topic} · ${keyName(ph.key, "major")} 키 · ${FEEL[ph.feel] || ph.feel} · ${ph.bars}마디`;
    $("#phTip").textContent = ph.tip;
    if (!scoreSvg($("#phScore"), ph.events, { ticks: ph.ticks, chords: ph.chords })) $("#phScore").textContent = "악보를 그릴 수 없음";
    drawProg(); drawChart();
  }
  function mark(idx) {
    lastOn.forEach(x => x.classList.remove("on"));
    lastOn = idx >= 0 ? [...$("#phScore").querySelectorAll(`[data-ev="${idx}"]`)] : [];
    lastOn.forEach(x => x.classList.add("on"));
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
    $("#phPlay").textContent = "음원 불러오는 중…";
    try {
      counted = 0;
      await startRhythm({
        bpm: st.bpm, loopBars: ph.bars, countIn: 4, swing: ph.feel === "shuffle", grid: 4, click: st.click === "on",
        backing: { prog: { bars: ph.prog, style: ph.style }, key: ph.key, style: ph.style }, inst: "guitar",
        barEvents: b => R.phraseBarEvents(ph, b),
        onCount: left => { $("#phState").textContent = `준비 ${left}`; },
        onEvent: e => mark(e.idx),
        onBar: (b, loop) => {
          bar = b;
          if (st.mode !== "listen" && (loop > 0 || b > 0 || counted > 0)) {
            counted++;
            if (counted >= BARS_PER_UNIT) {
              st = { ...st, units: st.units + 1, n: st.n + 1 }; persist();
              api.addUnit(1); api.toast(`${ph.name} ${BARS_PER_UNIT}마디 완료 · 이번 세션 ${st.units}회`);
              stop(); load(); draw(); return;
            }
          }
          $("#phState").textContent = `${b + 1}마디 · ${ph.chords[b].name}`;
          drawProg(); drawChart();
        }
      });
      setRhythmLevel("guitar", MODE_LEVEL[st.mode]);
      playing = true; $("#phPlay").textContent = "멈춤";
    } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#phPlay").textContent = "시작"; }
  }
  function stop() { stopRhythm(); playing = false; bar = -1; counted = 0; mark(-1); $("#phPlay").textContent = "시작"; $("#phState").textContent = "정지"; drawProg(); drawChart(); }
  function go(d) { stop(); st = { ...st, n: (st.n + d + st.order.length) % st.order.length }; persist(); load(); draw(); }
  $("#phPlay").onclick = () => (isRhythmRunning() ? stop() : play());
  $("#phPrev").onclick = () => go(-1);
  $("#phNext").onclick = () => go(1);
  $("#phMode").onclick = e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    $("#phMode").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
    st = { ...st, mode: b.dataset.v }; persist(); setRhythmLevel("guitar", MODE_LEVEL[st.mode]); counted = 0; drawProg();
  };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("rhph.bpm", st.bpm); setRhythmBpm(st.bpm); $("#phBpm").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
  load(); draw(); persist();
  return () => { clearInterval(watch); stopRhythm(); };
}
