// BPM Chord Finding 화면: 메트로놈에 맞춰 2박마다 코드가 바뀜, 다음 코드 미리보기

import * as B from "./bpm-core.js";
import { answersOf, describe } from "./prompts.js";
import { rankVoicings } from "../../theory/voicings.js";
import { chordBoxSvg } from "../../render/chordbox.js";
import { getSetting, setSetting } from "../../core/storage.js";
import * as Metro from "../../audio/metronome.js";

const KEY = "fretlab:bpm";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function settingsHtml() {
  const v = B.clampBpm(getSetting("bpm.find", B.BPM_DEFAULT));
  const diag = getSetting("bpm.diagram", false);
  return `
    <div class="field">
      <label for="bfBpm">BPM <b id="bfBpmOut">${v}</b></label>
      <input id="bfBpm" type="range" min="${B.BPM_MIN}" max="${B.BPM_MAX}" step="1" value="${v}">
      <div class="range-ends"><span>${B.BPM_MIN}</span><span>${B.BPM_MAX}</span></div>
    </div>
    <label class="check-row"><input type="checkbox" id="bfDiag" ${diag ? "checked" : ""}> 현재 코드의 운지 다이어그램 표시</label>
    <p class="muted small" style="margin:8px 0 0">4/4박자, 1마디 준비 박 뒤 2박마다 코드가 바뀜. 8마디(코드 16개)를 끝까지 치면 완료 1회</p>`;
}

export function bindSettings(root) {
  const r = root.querySelector("#bfBpm");
  if (r) r.oninput = () => { root.querySelector("#bfBpmOut").textContent = r.value; };
}

export function readSettings(root) {
  const bpm = B.clampBpm(root.querySelector("#bfBpm").value);
  const diagram = root.querySelector("#bfDiag").checked;
  setSetting("bpm.find", bpm);
  setSetting("bpm.diagram", diagram);
  return { bpm, diagram };
}

function load(id) {
  try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && d.sessionId === id ? d.st : null; } catch (_) { return null; }
}
function save(id, st) { localStorage.setItem(KEY, JSON.stringify({ sessionId: id, st })); }
export function clearFinder() { localStorage.removeItem(KEY); }

function topVoicing(spec) {
  return rankVoicings(answersOf(spec), { limit: 1 })[0];
}

export function mount(container, api) {
  const s0 = api.getActive();
  const topics = s0.topics && s0.topics.length ? s0.topics : ["triad"];
  const opts = s0.options || {};
  let st = load(s0.id) || B.init({ topics, bpm: opts.bpm || getSetting("bpm.find", B.BPM_DEFAULT) });
  let showDiagram = opts.diagram ?? getSetting("bpm.diagram", false);
  let playing = false;
  let startPos = 0;
  let view = { phase: "idle", countLeft: 0, beatInChord: 0, inBar: -1 };

  container.innerHTML = `
    <div class="nf bf">
      <div class="nf-meta"><span id="bfBar">마디 1/8</span><span id="bfProg">코드 0/16 · 완료 0회</span></div>
      <div class="prompt-card" id="bfCard">
        <div class="prompt-caption" id="bfCaption">READY</div>
        <div class="prompt-main chord-title" id="bfTitle">-</div>
        <div class="prompt-sub" id="bfSub"></div>
        <div class="beats bf-beats" id="bfBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      </div>
      <div class="bf-next"><span class="muted small">다음</span> <b id="bfNext">-</b> <span class="muted small" id="bfNextSub"></span></div>
      <div class="cycle-dots bf-dots" id="bfDots">${Array.from({ length: B.CHORDS_PER_PASS }, () => "<i></i>").join("")}</div>
      <div class="nf-actions"><button class="btn primary wide" id="bfPlay" type="button">연주 시작</button></div>
      <div class="bf-diagram hidden" id="bfDiagram"></div>
      <div class="bf-controls">
        <div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
          <div class="bpm-val"><b id="bfBpmVal">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
        </div>
        <label class="check-row"><input type="checkbox" id="bfDiagLive" ${showDiagram ? "checked" : ""}> 운지 다이어그램 표시</label>
      </div>
      <p class="muted small nf-foot">이어폰·헤드폰을 쓰면 클릭 소리가 잘 들림. 일시정지하면 멈춘 코드부터 다시 준비 박을 세고 이어감</p>
    </div>`;

  const $ = sel => container.querySelector(sel);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => save(s0.id, st);

  function drawStatic() {
    const cur = st.seq[st.pos];
    const nxt = st.pos + 1 < st.seq.length ? st.seq[st.pos + 1] : null;
    const d = describe(cur);
    $("#bfTitle").textContent = d.question ? d.answerName : d.title;
    $("#bfSub").textContent = d.sub.replace(" · 코드명을 떠올린 뒤 운지", "");
    if (nxt) {
      const dn = describe(nxt);
      $("#bfNext").textContent = dn.question ? dn.answerName : dn.title;
      $("#bfNextSub").textContent = dn.sub.split(" · ").slice(1).join(" · ");
    } else {
      $("#bfNext").textContent = "새 8마디";
      $("#bfNextSub").textContent = "";
    }
    $("#bfBar").textContent = `마디 ${B.barOf(st.pos)}/8`;
    $("#bfProg").textContent = `코드 ${playing && view.phase === "chord" ? st.pos + 1 : st.pos}/16 · 완료 ${st.passes}회`;
    container.querySelectorAll("#bfDots i").forEach((dot, i) => {
      dot.classList.toggle("on", i < st.pos || (playing && view.phase === "chord" && i === st.pos));
    });
    const dg = $("#bfDiagram");
    if (showDiagram) {
      const v = topVoicing(cur);
      dg.innerHTML = v ? `<figure class="chord-cell bf-cell">${chordBoxSvg(v)}<figcaption>${esc(v.detail)}</figcaption></figure>` : "";
      dg.classList.remove("hidden");
    } else dg.classList.add("hidden");
  }

  function drawBeat() {
    const cap = $("#bfCaption");
    if (!playing) cap.textContent = running() ? "READY" : "PAUSED";
    else if (view.phase === "count") cap.textContent = `준비 ${view.countLeft}`;
    else cap.textContent = view.beatInChord === 0 ? "PLAY" : "PLAY ·";
    container.querySelectorAll("#bfBeats .beat").forEach((b, i) => b.classList.toggle("on", playing && i === view.inBar));
    $("#bfCard").classList.toggle("count", playing && view.phase === "count");
    $("#bfCard").classList.toggle("paused", !running());
  }

  function onBeat(inBar, beat) {
    if (!playing) return;
    const info = B.beatInfo(startPos, beat);
    view = { ...info, inBar };
    if (info.phase === "chord" && info.chordStart) {
      const r = B.advance(st, info);
      st = r.state;
      persist();
      if (r.completedUnit) {
        api.addUnit(1);
        api.toast(`8마디 완주 · 이번 세션 ${st.passes}회`);
        // 새 묶음은 이 박에서 0번 코드로 시작하도록 기준 위치를 맞춤
        startPos = -Math.floor((beat - B.COUNT_IN) / B.BEATS_PER_CHORD);
      }
      drawStatic();
    }
    drawBeat();
  }

  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 연주할 수 있음"); return; }
    startPos = st.pos;
    view = { phase: "count", countLeft: B.COUNT_IN, inBar: -1 };
    Metro.onMetronomeBeat(onBeat);
    try {
      await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 });
      playing = true;
    } catch (e) {
      api.toast("소리를 켤 수 없음: " + e.message);
      playing = false;
    }
    $("#bfPlay").textContent = playing ? "멈춤" : "연주 시작";
    drawStatic(); drawBeat();
  }

  function stop() {
    if (playing) Metro.stopMetronome();
    playing = false;
    view = { phase: "idle", countLeft: 0, inBar: -1 };
    $("#bfPlay").textContent = "연주 시작";
    drawStatic(); drawBeat();
  }

  $("#bfPlay").onclick = () => (playing ? stop() : play());
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]");
    if (!b) return;
    st = { ...st, bpm: B.clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("bpm.find", st.bpm);
    Metro.setMetronomeBpm(st.bpm); // 다음 박부터 적용
    $("#bfBpmVal").textContent = st.bpm;
    persist();
  });
  $("#bfDiagLive").onchange = e => { showDiagram = e.target.checked; setSetting("bpm.diagram", showDiagram); drawStatic(); };

  // 세션이 멈추면(일시정지·앱 이탈) 연주도 멈춤
  const watch = setInterval(() => {
    if (playing && (!running() || !Metro.isMetronomeRunning())) stop();
    else drawBeat();
  }, 200);

  drawStatic(); drawBeat();
  return () => { clearInterval(watch); if (playing) Metro.stopMetronome(); playing = false; Metro.onMetronomeBeat(null); };
}
