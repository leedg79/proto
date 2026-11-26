// 코드 멜로디(C5): 저작권이 끝난 곡을 멜로디가 맨 윗음인 운지로 배치해 오선+TAB으로 보여 주고 함께 연주
// "듣기" = 앱이 연주, "따라 치기" = 소리 없이 클릭과 강조만. 따라 치기로 끝까지 가면 완료 1회

import { TUNES, KEYS, tuneData, arrange } from "./melody-core.js";
import { scoreSvg } from "../../render/score.js";
import { playLick, stopLick } from "../../audio/lick-player.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { followTarget, midiAt } from "../../eval/targets.js";

const store = makeStore("fretlab:cm1");
export const clearFinder = () => store.clear();
const FLATS = [5, 10, 3, 8, 1, 6];

export function settingsHtml() {
  return `
    <div class="field"><label>키</label>${segHtml("cmKey", KEYS, getSetting("cm.key", 0))}</div>
    <p class="muted small" style="margin:4px 0 0">멜로디가 맨 윗음이 되도록 코드 운지를 자동 배치함. 코드가 바뀌는 음은 화음, 나머지는 멜로디 한 음. "따라 치기"로 곡 끝까지 가면 완료 1회</p>`;
}
export function bindSettings(root) { bindPicker(root, "cmKey"); }
export function readSettings(root) {
  const key = Number(readSel(root, "cmKey", "v")) || 0;
  setSetting("cm.key", key);
  return { key };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const tunes = (s0.topics || []).filter(t => TUNES[t]);
  const list = tunes.length ? tunes : ["ode-to-joy"];
  let st = store.load(s0.id) || { n: 0, units: 0, bpm: 70 };
  let song = arrange(tuneData(list[st.n % list.length], o.key || 0));
  let mode = null;

  container.innerHTML = `
    <div class="nf cm">
      <div class="nf-meta"><span id="cmTitle"></span><span id="cmProg"></span></div>
      <div class="tab-wrap score-wrap" id="cmScore"></div>
      <div class="ctl-dock">
      <div class="ed-actions" style="margin-top:10px">
        <button class="btn" id="cmListen" type="button">▶ 듣기</button>
        <button class="btn primary" id="cmFollow" type="button">따라 치기</button>
      </div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button>
        <div class="bpm-val"><b id="cmBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="5">+5</button>
        <button type="button" class="btn small" id="cmNext">다음 곡</button>
      </div></div>
      </div>
      <p class="muted small nf-foot">노랑 = 지금 칠 음. 위쪽 숫자 묶음(동시음)이 코드, 맨 위 음이 멜로디. 처음 4박은 준비 클릭</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);
  const paint = (active = -1) => scoreSvg($("#cmScore"), song.events, { chords: song.chordMarks, ticks: song.ticks, flats: FLATS.includes(song.key), active });
  function draw() {
    $("#cmTitle").textContent = `${song.name}`;
    $("#cmProg").textContent = `${song.ticks / 48}마디 · 완료 ${st.units}회`;
    paint();
    $("#cmListen").textContent = mode === "listen" ? "■ 멈춤" : "▶ 듣기";
    $("#cmFollow").textContent = mode === "follow" ? "■ 멈춤" : "따라 치기";
  }
  function stop() { stopLick(); if (mode === "follow" && api.eval) api.eval.end(); mode = null; draw(); }
  async function run(m) {
    if (mode) { const was = mode; stop(); if (was === m) return; }
    if (m === "follow" && !running()) { api.toast("세션을 재개한 뒤 따라 칠 수 있음"); return; }
    mode = m; draw();
    // 연주 평가: 따라 치기에서 음마다 제때 멜로디(맨 위 음)를 쳤는지
    if (m === "follow" && api.eval) api.eval.prompt(followTarget(song.name));
    try {
      await playLick({ events: song.events, ticks: song.ticks, feel: "straight" }, st.bpm, {
        countIn: 4, click: m === "follow", silent: m === "follow",
        onEvent: i => {
          if (i === -1) {
            if (mode === "follow" && running()) { st = { ...st, units: st.units + 1 }; persist(); api.addUnit(1); api.toast(`${song.name} 끝까지 연주 · 이번 세션 ${st.units}회`); }
            if (mode === "follow" && api.eval) api.eval.end();
            mode = null; draw(); return;
          }
          if (mode === "follow" && api.eval) { const ev = song.events[i]; const top = ev && ev.notes && ev.notes[0]; if (top) api.eval.expect(`${i + 1}번째 음`, null, { midis: [midiAt(top.s, top.f)] }); }
          paint(i);
        }
      });
    } catch (e) { api.toast("소리를 켤 수 없음"); mode = null; draw(); }
  }
  $("#cmListen").onclick = () => run("listen");
  $("#cmFollow").onclick = () => run("follow");
  $("#cmNext").onclick = () => { stop(); st = { ...st, n: st.n + 1 }; persist(); song = arrange(tuneData(list[st.n % list.length], o.key || 0)); draw(); };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: Math.max(40, Math.min(140, st.bpm + Number(b.dataset.bpm))) }; persist(); $("#cmBpm").textContent = st.bpm;
  });
  const watch = setInterval(() => { if (mode === "follow" && !running()) stop(); }, 300);
  draw();
  return () => { clearInterval(watch); stopLick(); };
}
