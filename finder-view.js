// Note Finder 화면 (세션 화면 안에 들어가는 연습 영역)
// 기존 FRET LAB Note Finder의 흐름을 유지: 문제 카드 → 제한시간 → 정답 확인 → 지판 정답 → 다음 문제

import * as F from "./finder-core.js";
import { positionsOf } from "../../theory/notes.js";
import { fretboardSvg } from "../../render/fretboard.js";
import { getSetting, setSetting } from "../../core/storage.js";

const KEY = "fretlab:nf";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── 세션 시작 전 설정 ──
export function settingsHtml() {
  const t = F.clampTime(getSetting("nf.time", 5));
  return `
    <div class="field">
      <label for="nfTime">제한시간 <b id="nfTimeOut">${t}초</b></label>
      <input id="nfTime" type="range" min="${F.TIME_MIN}" max="${F.TIME_MAX}" step="1" value="${t}">
      <div class="range-ends"><span>${F.TIME_MIN}초</span><span>${F.TIME_MAX}초</span></div>
    </div>
    <p class="muted small" style="margin:4px 0 0">연습 중에도 바꿀 수 있음. 시간이 끝나면 정답이 자동으로 표시됨</p>`;
}

export function bindSettings(root) {
  const r = root.querySelector("#nfTime");
  if (r) r.oninput = () => { root.querySelector("#nfTimeOut").textContent = r.value + "초"; };
}

export function readSettings(root) {
  const v = F.clampTime(root.querySelector("#nfTime").value);
  setSetting("nf.time", v);
  return { timeLimit: v };
}

// ── 진행 상태 저장 (화면 이동·앱 재실행에도 이어서 출제) ──
function load(sessionId) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    return d && d.sessionId === sessionId ? d.st : null;
  } catch (_) { return null; }
}
function save(sessionId, st) {
  localStorage.setItem(KEY, JSON.stringify({ sessionId, st }));
}
export function clearFinder() {
  localStorage.removeItem(KEY);
}

// ── 세션 화면 안의 연습 영역 ──
// api: { getActive, elapsedMs, addUnit, toast }
export function mount(container, api) {
  const s0 = api.getActive();
  let st = load(s0.id) || F.initFinder({ level: s0.level, timeLimit: (s0.options && s0.options.timeLimit) || getSetting("nf.time", 5) });

  container.innerHTML = `
    <div class="nf">
      <div class="nf-meta"><span id="nfNo">PROMPT 1</span><span id="nfProg">12음 중 0</span></div>
      <div class="prompt-card" id="nfCard">
        <div class="prompt-caption" id="nfCaption">FIND THIS NOTE</div>
        <div class="prompt-main" id="nfNote">-</div>
        <div class="prompt-sub" id="nfSub">ALL STRINGS (0~15F)</div>
      </div>
      <div class="cycle-dots" id="nfDots">${Array.from({ length: F.CYCLE_SIZE }, () => "<i></i>").join("")}</div>
      <div class="timer-wrap">
        <div class="timer-track"><div id="nfBar"></div></div>
        <div class="timer-text" id="nfTimer">5.0</div>
      </div>
      <div class="nf-actions">
        <button class="btn primary wide" id="nfReveal" type="button">정답 확인</button>
        <button class="btn primary wide hidden" id="nfNext" type="button">다음 문제 →</button>
      </div>
      <div class="answer-area hidden" id="nfAnswer"></div>
      <div class="field inline-time">
        <label for="nfLive">제한시간 <b id="nfLiveOut">${st.timeLimit}초</b></label>
        <input id="nfLive" type="range" min="${F.TIME_MIN}" max="${F.TIME_MAX}" step="1" value="${st.timeLimit}">
      </div>
      <p class="muted small nf-foot">기타로 직접 찾아 짚어 본 뒤 정답을 확인함. 정답 확인 전에는 위치가 표시되지 않음</p>
    </div>`;

  const $ = sel => container.querySelector(sel);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };

  function persist() { save(s0.id, st); }

  function next() {
    if (!running()) return;
    st = F.nextPrompt(st, api.elapsedMs());
    persist();
    drawPrompt();
  }

  function doReveal(timedOut) {
    const r = F.reveal(st, { timedOut });
    if (r.state === st) return;
    st = r.state;
    persist();
    if (r.completedUnit) {
      api.addUnit(1);
      api.toast(`12음 1순환 완료 · 이번 세션 ${st.cyclesDone}회`);
    }
    drawPrompt();
  }

  function drawPrompt() {
    const c = st.current;
    const prog = F.cycleProgress(st);
    $("#nfNo").textContent = "PROMPT " + Math.max(1, st.promptNo);
    $("#nfProg").textContent = `12음 중 ${prog.done} · 완료 ${st.cyclesDone}회`;
    container.querySelectorAll("#nfDots i").forEach((d, i) => d.classList.toggle("on", i < prog.done));
    if (!c) {
      $("#nfNote").textContent = "-";
      $("#nfCaption").textContent = "READY";
      $("#nfSub").textContent = "세션을 재개하면 출제됨";
      $("#nfReveal").classList.remove("hidden");
      $("#nfNext").classList.add("hidden");
      $("#nfAnswer").classList.add("hidden");
      return;
    }
    $("#nfCaption").textContent = c.strings.length ? "FIND ON THESE STRINGS" : "FIND THIS NOTE";
    $("#nfNote").textContent = c.name;
    $("#nfSub").textContent = c.strings.length ? c.strings.map(s => `${s}번 현`).join(" · ") : "ALL STRINGS (0~15F)";
    $("#nfReveal").classList.toggle("hidden", c.revealed);
    $("#nfNext").classList.toggle("hidden", !c.revealed);
    const ans = $("#nfAnswer");
    if (c.revealed) {
      const strings = c.strings.length ? c.strings : [1, 2, 3, 4, 5, 6];
      const ps = positionsOf(c.pc, strings, 15);
      ans.innerHTML = `
        <div class="answer-title">정답 위치 · ${esc(c.name)}${c.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
        <div class="fretboard">${fretboardSvg(ps.map(p => ({ ...p, label: c.name })), { maxFret: 15, strings: c.strings })}</div>
        <div class="answer-note">${ps.map(p => `${p.s}번 현 ${p.f}프렛`).join(" · ")}</div>`;
      ans.classList.remove("hidden");
    } else {
      ans.classList.add("hidden");
      ans.innerHTML = "";
    }
  }

  function tick() {
    const on = running();
    const c = st.current;
    if (on && !c) next();
    const rem = F.remainingMs(st, api.elapsedMs());
    const showRem = st.current && !st.current.revealed ? rem : 0;
    $("#nfTimer").textContent = (showRem / 1000).toFixed(1);
    $("#nfBar").style.width = (st.current && !st.current.revealed ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
    $("#nfReveal").disabled = !on;
    $("#nfNext").disabled = !on;
    $("#nfCard").classList.toggle("paused", !on);
    if (on && st.current && !st.current.revealed && rem <= 0) doReveal(true);
  }

  $("#nfReveal").onclick = () => { if (running()) doReveal(false); };
  $("#nfNext").onclick = () => next();
  const live = $("#nfLive");
  live.oninput = () => {
    st = F.changeTime(st, live.value, api.elapsedMs());
    $("#nfLiveOut").textContent = st.timeLimit + "초";
    setSetting("nf.time", st.timeLimit);
    persist();
  };

  drawPrompt();
  tick();
  const timer = setInterval(tick, 100);
  return () => clearInterval(timer);
}
