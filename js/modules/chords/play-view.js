// Play Session 화면: 키·진행 유형으로 만든 A-A-B-A′ 32마디를 메트로놈에 맞춰 연주, 끝나면 코드표 저장

import * as PL from "./play-core.js";
import { chordBoxSvg } from "../../render/chordbox.js";
import { sheetHtml, sheetSvg, savePng } from "../../render/chordsheet.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { topicName } from "../../data/catalog.js";
import * as Metro from "../../audio/metronome.js";

const KEY = "fretlab:play";
const BPM_MIN = 40, BPM_MAX = 160, BPM_DEFAULT = 80;
const clampBpm = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(BPM_MAX, Math.max(BPM_MIN, n)) : BPM_DEFAULT; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function settingsHtml() {
  const key = getSetting("play.key", 0);
  const style = getSetting("play.style", "pop");
  const bpm = clampBpm(getSetting("play.bpm", BPM_DEFAULT));
  return `
    <div class="field"><label>키(단조 진행은 이 음이 단조 으뜸음)</label>
      <div class="root-grid" id="plKey">${PL.KEYS.map(k => `<button type="button" data-key="${k.pc}" class="${k.pc === key ? "sel" : ""}">${esc(k.name)}</button>`).join("")}</div>
    </div>
    <div class="field" style="margin-top:14px"><label>진행 유형</label>
      <div class="seg wide-seg" id="plStyle">${Object.entries(PL.STYLES).map(([id, s]) => `<button type="button" data-style="${id}" class="${id === style ? "sel" : ""}">${esc(s.name)}</button>`).join("")}</div>
    </div>
    <div class="field" style="margin-top:14px">
      <label for="plBpm">BPM <b id="plBpmOut">${bpm}</b></label>
      <input id="plBpm" type="range" min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:6px 0 0">A-A-B-A′ 구조(각 8마디) 32마디, 1마디 준비 박 뒤 시작. 학습 주제를 여러 개 고르면 섹션마다 하나씩 맡음. 32마디를 끝까지 치면 완료 1회</p>`;
}

export function bindSettings(root) {
  root.querySelector("#plKey").onclick = e => { const b = e.target.closest("[data-key]"); if (!b) return; root.querySelectorAll("#plKey button").forEach(x => x.classList.toggle("sel", x === b)); };
  root.querySelector("#plStyle").onclick = e => { const b = e.target.closest("[data-style]"); if (!b) return; root.querySelectorAll("#plStyle button").forEach(x => x.classList.toggle("sel", x === b)); };
  const r = root.querySelector("#plBpm");
  r.oninput = () => { root.querySelector("#plBpmOut").textContent = r.value; };
}

export function readSettings(root) {
  const key = Number(root.querySelector("#plKey .sel").dataset.key);
  const style = root.querySelector("#plStyle .sel").dataset.style;
  const bpm = clampBpm(root.querySelector("#plBpm").value);
  setSetting("play.key", key); setSetting("play.style", style); setSetting("play.bpm", bpm);
  return { key, style, bpm };
}

function load(id) {
  try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && d.sessionId === id ? d.st : null; } catch (_) { return null; }
}
function save(id, st) { localStorage.setItem(KEY, JSON.stringify({ sessionId: id, st })); }
export function clearFinder() { localStorage.removeItem(KEY); }

export function mount(container, api) {
  const s0 = api.getActive();
  const usable = (s0.topics || []).filter(t => PL.PLAY_TOPICS.includes(t));
  const topics = usable.length ? usable : ["triad"];
  const opts = s0.options || {};
  const tn = id => topicName("chords", s0.level, "play-session", id);
  // played: 이번 회차에 실제로 연주한 마디 번호 (건너뛴 마디가 있으면 완료로 치지 않음)
  const fresh = () => ({ plan: PL.buildPlan({ keyPc: opts.key ?? 0, style: opts.style || "pop", topics }), bar: 0, done: false, passes: 0, played: [], bpm: clampBpm(opts.bpm || BPM_DEFAULT) });
  let st = load(s0.id) || fresh();
  let playing = false, startBar = 0;
  let pos = { phase: "idle", barIdx: st.bar, chordIdx: 0 };
  let inBarBeat = -1;

  container.innerHTML = `
    <div class="nf pl">
      <div class="nf-meta"><span id="plSec">A · 1/8마디</span><span id="plProg">1/32마디 · 완료 0회</span></div>
      <div class="pl-info muted small" id="plInfo"></div>
      <div class="prompt-card pl-card" id="plCard">
        <div class="prompt-caption" id="plCaption">READY</div>
        <div class="prompt-main chord-title" id="plName">-</div>
        <div class="prompt-sub" id="plRoman"></div>
        <div class="beats bf-beats" id="plBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      </div>
      <div class="pl-pair">
        <figure class="chord-cell"><figcaption class="pl-cap">지금 <b id="plNowName"></b></figcaption><div id="plNowBox"></div><figcaption id="plNowDetail"></figcaption></figure>
        <figure class="chord-cell next"><figcaption class="pl-cap">다음 <b id="plNextName"></b></figcaption><div id="plNextBox"></div><figcaption id="plNextDetail"></figcaption></figure>
      </div>
      <div class="nf-actions"><button class="btn primary wide" id="plPlay" type="button">연주 시작</button></div>
      <div class="pl-done hidden" id="plDone">
        <p><b>32마디 끝</b> · 코드표를 이미지로 저장할 수 있음. 32마디를 빠짐없이 연주했을 때만 완료로 기록함</p>
        <div class="btn-row"><button class="btn primary" id="plSave" type="button">코드표 PNG 저장</button><button class="btn" id="plAgain" type="button">같은 진행 다시</button><button class="btn" id="plNew" type="button">새 진행</button></div>
      </div>
      <div class="bf-controls">
        <div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
          <div class="bpm-val"><b id="plBpmVal">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
        </div>
      </div>
      <div class="section-title">코드표 · 마디를 누르면 그 마디부터 연주(연습용, 완료는 32마디 모두 쳤을 때)</div>
      <div id="plSheet"></div>
    </div>`;

  const $ = sel => container.querySelector(sel);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => save(s0.id, st);

  function chordAt(barIdx, chordIdx) { return st.plan.bars[barIdx].chords[chordIdx]; }

  function drawChord() {
    const bi = Math.min(pos.barIdx ?? st.bar, PL.TOTAL_BARS - 1);
    const ci = pos.phase === "play" ? pos.chordIdx : 0;
    const cur = chordAt(bi, ci);
    const nxt = PL.nextChord(st.plan, bi, ci);
    const bar = st.plan.bars[bi];
    $("#plSec").textContent = `${bar.section} · ${bar.barInSection}/8마디`;
    $("#plProg").textContent = `${bi + 1}/32마디 · 완료 ${st.passes}회`;
    $("#plInfo").textContent = `${st.plan.keyName} ${st.plan.minor ? "단조" : "장조"} · ${st.plan.styleName} · ${tn(bar.topic)}`;
    $("#plName").textContent = cur.name;
    $("#plName").classList.toggle("long", cur.name.length > 7);
    $("#plRoman").textContent = cur.roman + (cur.sub ? ` · ${cur.sub}` : "");
    $("#plNowName").textContent = cur.name;
    $("#plNowBox").innerHTML = chordBoxSvg(cur.voicing);
    $("#plNowDetail").textContent = cur.voicing.detail;
    if (nxt) {
      $("#plNextName").textContent = nxt.name;
      $("#plNextBox").innerHTML = chordBoxSvg(nxt.voicing);
      $("#plNextDetail").textContent = nxt.voicing.detail;
    } else {
      $("#plNextName").textContent = "끝";
      $("#plNextBox").innerHTML = "";
      $("#plNextDetail").textContent = "";
    }
    $("#plSheet").innerHTML = sheetHtml(st.plan, { current: playing || pos.phase === "play" ? bi : st.bar, topicName: tn });
    $("#plDone").classList.toggle("hidden", !st.done);
  }

  function drawBeat() {
    const cap = $("#plCaption");
    if (!playing) cap.textContent = st.done ? "DONE" : running() ? "READY" : "PAUSED";
    else if (pos.phase === "count") cap.textContent = `준비 ${pos.countLeft}`;
    else cap.textContent = "PLAY";
    container.querySelectorAll("#plBeats .beat").forEach((b, i) => b.classList.toggle("on", playing && i === inBarBeat));
    $("#plCard").classList.toggle("count", playing && pos.phase === "count");
    $("#plCard").classList.toggle("paused", !running());
  }

  function finish() {
    stop();
    const full = new Set(st.played || []).size >= PL.TOTAL_BARS;
    st = { ...st, done: true, bar: 0, passes: st.passes + (full ? 1 : 0), played: [] };
    persist();
    if (full) {
      api.addUnit(1);
      api.toast(`32마디 완주 · 이번 세션 ${st.passes}회`);
    } else {
      api.toast("건너뛴 마디가 있어 완료로 기록하지 않음");
    }
    pos = { phase: "idle", barIdx: PL.TOTAL_BARS - 1, chordIdx: 0 };
    drawChord(); drawBeat();
  }

  function onBeat(inBar, beat) {
    if (!playing) return;
    const p = PL.locate(st.plan, startBar, beat);
    inBarBeat = inBar;
    if (p.phase === "done") { finish(); return; }
    pos = p;
    if (p.phase === "play" && p.chordStart) {
      if (p.barStart) {
        const played = (st.played || []).includes(p.barIdx) ? st.played : [...(st.played || []), p.barIdx];
        st = { ...st, bar: p.barIdx, played };
        persist();
      }
      drawChord();
    }
    drawBeat();
  }

  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 연주할 수 있음"); return; }
    if (st.done) { st = { ...st, done: false, bar: 0, played: [] }; persist(); }
    startBar = st.bar;
    pos = { phase: "count", countLeft: PL.COUNT_IN, barIdx: startBar, chordIdx: 0 };
    Metro.onMetronomeBeat(onBeat);
    try { await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 }); playing = true; }
    catch (e) { api.toast("소리를 켤 수 없음: " + e.message); playing = false; }
    $("#plPlay").textContent = playing ? "멈춤" : "연주 시작";
    drawChord(); drawBeat();
  }

  function stop() {
    if (playing) Metro.stopMetronome();
    playing = false;
    inBarBeat = -1;
    if (pos.phase !== "play") pos = { phase: "idle", barIdx: st.bar, chordIdx: 0 };
    $("#plPlay").textContent = "연주 시작";
    drawBeat();
  }

  $("#plPlay").onclick = () => (playing ? stop() : play());
  $("#plAgain").onclick = () => { st = { ...st, done: false, bar: 0, played: [] }; persist(); pos = { phase: "idle", barIdx: 0, chordIdx: 0 }; drawChord(); drawBeat(); };
  $("#plNew").onclick = () => { const n = fresh(); st = { ...n, passes: st.passes, bpm: st.bpm, played: [] }; persist(); pos = { phase: "idle", barIdx: 0, chordIdx: 0 }; drawChord(); drawBeat(); };
  $("#plSave").onclick = async () => {
    const d = new Date();
    const p2 = n => String(n).padStart(2, "0");
    const meta = `${st.plan.keyName} ${st.plan.minor ? "단조" : "장조"} · ${st.plan.styleName} · ${st.bpm} BPM · ${st.plan.topics.map(tn).join(", ")} · ${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
    try {
      await savePng(sheetSvg(st.plan, { title: `Play Session · ${st.plan.keyName} ${st.plan.styleName}`, meta, topicName: tn }), `fretlab-chordsheet-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.png`);
      api.toast("코드표를 저장함");
    } catch (e) {
      if (!(e && e.name === "AbortError")) api.toast("저장 실패: " + (e && e.message));
    }
  };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("play.bpm", st.bpm);
    Metro.setMetronomeBpm(st.bpm);
    $("#plBpmVal").textContent = st.bpm;
    persist();
  });
  $("#plSheet").addEventListener("click", e => {
    const b = e.target.closest("[data-bar]");
    if (!b || playing) return;
    st = { ...st, bar: Number(b.dataset.bar), done: false };
    persist();
    pos = { phase: "idle", barIdx: st.bar, chordIdx: 0 };
    drawChord(); drawBeat();
  });

  const watch = setInterval(() => {
    if (playing && (!running() || !Metro.isMetronomeRunning())) stop();
    else drawBeat();
  }, 200);

  drawChord(); drawBeat();
  return () => { clearInterval(watch); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}
