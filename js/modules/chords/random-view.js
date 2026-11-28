// Random Chord Finding 화면: 문제 카드 → 제한시간 → 정답 확인 → 가능한 운지 전부 → 다음 문제

import * as R from "./random-core.js";
import { answersOf, describe } from "./prompts.js";
import { chordGrid } from "../../render/chordbox.js";
import { rankVoicings } from "../../theory/voicings.js";
import { getSetting, setSetting } from "../../core/storage.js";

const KEY = "fretlab:rc";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function settingsHtml() {
  const t = R.clampTime(getSetting("rc.time", R.TIME_DEFAULT));
  return `
    <div class="field">
      <label for="rcTime">제한시간 <b id="rcTimeOut">${t}초</b></label>
      <input id="rcTime" type="range" min="${R.TIME_MIN}" max="${R.TIME_MAX}" step="1" value="${t}">
      <div class="range-ends"><span>${R.TIME_MIN}초</span><span>${R.TIME_MAX}초</span></div>
    </div>
    <p class="muted small" style="margin:4px 0 0">12문제를 모두 정답 확인하면 완료 1회. 시간이 끝나면 정답이 자동으로 표시됨</p>`;
}

export function bindSettings(root) {
  const r = root.querySelector("#rcTime");
  if (r) r.oninput = () => { root.querySelector("#rcTimeOut").textContent = r.value + "초"; };
}

export function readSettings(root) {
  const v = R.clampTime(root.querySelector("#rcTime").value);
  setSetting("rc.time", v);
  return { timeLimit: v };
}

function load(id) {
  try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && d.sessionId === id ? d.st : null; } catch (_) { return null; }
}
function save(id, st) { localStorage.setItem(KEY, JSON.stringify({ sessionId: id, st })); }
export function clearFinder() { localStorage.removeItem(KEY); }

export function mount(container, api) {
  const s0 = api.getActive();
  const topics = s0.topics && s0.topics.length ? s0.topics : ["triad"];
  let st = load(s0.id) || R.init({ topics, timeLimit: (s0.options && s0.options.timeLimit) || getSetting("rc.time", R.TIME_DEFAULT) });

  container.innerHTML = `
    <div class="nf">
      <div class="nf-meta"><span id="rcNo">PROMPT 1</span><span id="rcProg">12문제 중 0</span></div>
      <div class="prompt-card" id="rcCard">
        <div class="prompt-caption" id="rcCaption">FIND THIS CHORD</div>
        <div class="prompt-main chord-title" id="rcTitle">-</div>
        <div class="prompt-sub" id="rcSub"></div>
      </div>
      <div class="cycle-dots" id="rcDots">${Array.from({ length: R.DECK_SIZE }, () => "<i></i>").join("")}</div>
      <div class="timer-wrap"><div class="timer-track"><div id="rcBar"></div></div><div class="timer-text" id="rcTimer">0.0</div></div>
      <div class="ctl-dock">
      <div class="nf-actions">
        <button class="btn primary wide" id="rcReveal" type="button">정답 확인</button>
        <button class="btn primary wide hidden" id="rcNext" type="button">다음 문제 →</button>
      </div>
      </div>
      <div class="answer-area hidden" id="rcAnswer"></div>
      <div class="field inline-time">
        <label for="rcLive">제한시간 <b id="rcLiveOut">${st.timeLimit}초</b></label>
        <input id="rcLive" type="range" min="${R.TIME_MIN}" max="${R.TIME_MAX}" step="1" value="${st.timeLimit}">
      </div>
      <p class="muted small nf-foot">기타로 직접 잡아 본 뒤 정답을 확인함. 정답에는 가능한 운지가 모두 표시됨</p>
    </div>`;

  const $ = sel => container.querySelector(sel);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => save(s0.id, st);

  const ev = api.eval;
  // v2.10.0: 코드 구성음 평가는 실기기에서 인식이 안 돼 뺌(마이크 판정 없음)
  const evalPrompt = () => {};
  function next() {
    if (!running()) return;
    st = R.next(st, api.elapsedMs());
    persist();
    draw();
    evalPrompt();
  }

  function doReveal(timedOut) {
    const r = R.reveal(st, { timedOut });
    if (r.state === st) return;
    if (ev) ev.end();
    st = r.state;
    persist();
    if (r.completedUnit) { api.addUnit(1); api.toast(`12문제 완료 · 이번 세션 ${st.decksDone}회`); }
    draw();
  }

  function draw() {
    const c = st.current;
    $("#rcNo").textContent = "PROMPT " + Math.max(1, st.promptNo);
    $("#rcProg").textContent = `12문제 중 ${st.revealedInDeck} · 완료 ${st.decksDone}회`;
    container.querySelectorAll("#rcDots i").forEach((d, i) => d.classList.toggle("on", i < st.revealedInDeck));
    if (!c) {
      $("#rcTitle").textContent = "-";
      $("#rcCaption").textContent = "READY";
      $("#rcSub").textContent = "세션을 재개하면 출제됨";
      return;
    }
    const d = describe(c.spec);
    $("#rcCaption").textContent = d.question ? "WHICH CHORD?" : "FIND THIS CHORD";
    const title = $("#rcTitle");
    title.textContent = d.title;
    title.classList.toggle("long", d.title.length > 7);
    $("#rcSub").textContent = d.sub;
    $("#rcReveal").classList.toggle("hidden", c.revealed);
    $("#rcNext").classList.toggle("hidden", !c.revealed);
    const ans = $("#rcAnswer");
    if (c.revealed) {
      const list = rankVoicings(answersOf(c.spec), { limit: 8 });
      ans.innerHTML = `
        <div class="answer-title">${esc(d.answerName)}${c.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
        <div class="answer-note" style="margin:0 0 10px">구성음 ${esc(d.tones.join(" · "))} · 자주 쓰는 운지 ${list.length}개(왼쪽 위부터 많이 쓰는 순)</div>
        ${chordGrid(list)}`;
      ans.classList.remove("hidden");
    } else {
      ans.classList.add("hidden");
      ans.innerHTML = "";
    }
  }

  function tick() {
    const on = running();
    if (on && !st.current) next();
    const rem = R.remainingMs(st, api.elapsedMs());
    const live = st.current && !st.current.revealed;
    $("#rcTimer").textContent = ((live ? rem : 0) / 1000).toFixed(1);
    $("#rcBar").style.width = (live ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
    $("#rcReveal").disabled = !on;
    $("#rcNext").disabled = !on;
    $("#rcCard").classList.toggle("paused", !on);
    if (on && live && rem <= 0) doReveal(true);
  }

  $("#rcReveal").onclick = () => { if (running()) doReveal(false); };
  $("#rcNext").onclick = () => next();
  const liveIn = $("#rcLive");
  liveIn.oninput = () => {
    st = R.changeTime(st, liveIn.value, api.elapsedMs());
    $("#rcLiveOut").textContent = st.timeLimit + "초";
    setSetting("rc.time", st.timeLimit);
    persist();
  };

  draw();
  evalPrompt();
  tick();
  const timer = setInterval(tick, 100);
  return () => { clearInterval(timer); if (ev) ev.end(); };
}
