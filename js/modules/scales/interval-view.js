// Scale Interval Finding 화면

import * as I from "./interval-core.js";
import { scaleTitle, blocks, SCALES } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, keyPickerHtml, bindPicker, readSel, makeStore } from "./common.js";

const store = makeStore("fretlab:sif");
export const clearFinder = () => store.clear();

export function settingsHtml() {
  const t = I.clampTime(getSetting("sif.time", I.TIME_DEFAULT));
  return `
    <div class="field"><label>키</label>${keyPickerHtml("sifKey", "sif.key")}</div>
    <div class="field" style="margin-top:14px">
      <label for="sifTime">제한시간 <b id="sifTimeOut">${t}초</b></label>
      <input id="sifTime" type="range" min="${I.TIME_MIN}" max="${I.TIME_MAX}" step="1" value="${t}">
    </div>
    <p class="muted small" style="margin:4px 0 0">"스케일의 도수를 지정한 현에서" 찾는 문제 12개 = 완료 1회. 절대음 찾기는 Notes에서 연습</p>`;
}
export function bindSettings(root) {
  bindPicker(root, "sifKey");
  const r = root.querySelector("#sifTime");
  r.oninput = () => { root.querySelector("#sifTimeOut").textContent = r.value + "초"; };
}
export function readSettings(root) {
  const key = Number(readSel(root, "sifKey"));
  const timeLimit = I.clampTime(root.querySelector("#sifTime").value);
  setSetting("sif.key", key); setSetting("sif.time", timeLimit);
  return { key, timeLimit };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const opts = s0.options || {};
  let st = store.load(s0.id) || I.init({ scales: scales.length ? scales : ["minor-penta"], timeLimit: opts.timeLimit, key: opts.key ?? -1 });

  container.innerHTML = `
    <div class="nf">
      <div class="nf-meta"><span id="sifNo">PROMPT 1</span><span id="sifProg">12문제 중 0</span></div>
      <div class="prompt-card" id="sifCard">
        <div class="prompt-caption">FIND THIS DEGREE</div>
        <div class="prompt-sub" id="sifScale" style="font-size:15px;color:var(--text)"></div>
        <div class="prompt-main" id="sifDeg">-</div>
        <div class="prompt-sub" id="sifStr"></div>
      </div>
      <div class="cycle-dots" id="sifDots">${Array.from({ length: I.DECK }, () => "<i></i>").join("")}</div>
      <div class="timer-wrap"><div class="timer-track"><div id="sifBar"></div></div><div class="timer-text" id="sifTimer">0.0</div></div>
      <div class="nf-actions">
        <button class="btn primary wide" id="sifReveal" type="button">정답 확인</button>
        <button class="btn primary wide hidden" id="sifNext" type="button">다음 문제 →</button>
      </div>
      <div class="answer-area hidden" id="sifAnswer"></div>
      <div class="field inline-time">
        <label for="sifLive">제한시간 <b id="sifLiveOut">${st.timeLimit}초</b></label>
        <input id="sifLive" type="range" min="${I.TIME_MIN}" max="${I.TIME_MAX}" step="1" value="${st.timeLimit}">
      </div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function next() { if (!running()) return; st = I.next(st, api.elapsedMs()); persist(); draw(); }
  function doReveal(timedOut) {
    const r = I.reveal(st, { timedOut });
    if (r.state === st) return;
    st = r.state; persist();
    if (r.completedUnit) { api.addUnit(1); api.toast(`12문제 완료 · 이번 세션 ${st.units}회`); }
    draw();
  }
  function draw() {
    const c = st.current;
    $("#sifNo").textContent = "PROMPT " + Math.max(1, st.promptNo);
    $("#sifProg").textContent = `12문제 중 ${st.done} · 완료 ${st.units}회`;
    container.querySelectorAll("#sifDots i").forEach((d, i) => d.classList.toggle("on", i < st.done));
    if (!c) return;
    const p = c.p;
    $("#sifScale").textContent = scaleTitle(p.rootPc, p.scaleId);
    $("#sifDeg").textContent = p.degree;
    $("#sifStr").textContent = `${p.string}번 현에서`;
    $("#sifReveal").classList.toggle("hidden", c.revealed);
    $("#sifNext").classList.toggle("hidden", !c.revealed);
    const ans = $("#sifAnswer");
    if (c.revealed) {
      const frets = I.answer(p);
      // 같은 스케일 블록의 음을 흐리게 함께 표시해 위치 감을 잡게 함
      const ghosts = [];
      const seen = new Set();
      for (const b of blocks(p.rootPc, p.scaleId)) for (const n of b.notes) {
        const k = n.s + "-" + n.f;
        if (n.f <= 15 && !seen.has(k)) { seen.add(k); ghosts.push({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" }); }
      }
      const marks = [...ghosts.filter(g => !(g.s === p.string && frets.includes(g.f))), ...frets.map(f => ({ s: p.string, f, label: p.degree, kind: "target" }))];
      ans.innerHTML = `
        <div class="answer-title">${esc(p.degree)} · ${p.string}번 현${c.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
        <div class="fretboard">${scaleBoardSvg(marks, { from: 0, to: 15, strings: [p.string] })}</div>
        <div class="answer-note">${p.string}번 현 ${frets.join("·")}프렛 · 흐린 점은 같은 스케일의 다른 음(초록 테두리 = 근음)</div>`;
      ans.classList.remove("hidden");
    } else { ans.classList.add("hidden"); ans.innerHTML = ""; }
  }
  function tick() {
    const on = running();
    if (on && !st.current) next();
    const rem = I.remainingMs(st, api.elapsedMs());
    const live = st.current && !st.current.revealed;
    $("#sifTimer").textContent = ((live ? rem : 0) / 1000).toFixed(1);
    $("#sifBar").style.width = (live ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
    $("#sifReveal").disabled = !on; $("#sifNext").disabled = !on;
    $("#sifCard").classList.toggle("paused", !on);
    if (on && live && rem <= 0) doReveal(true);
  }
  $("#sifReveal").onclick = () => { if (running()) doReveal(false); };
  $("#sifNext").onclick = () => next();
  const live = $("#sifLive");
  live.oninput = () => { st = I.changeTime(st, live.value, api.elapsedMs()); $("#sifLiveOut").textContent = st.timeLimit + "초"; setSetting("sif.time", st.timeLimit); persist(); };
  draw(); tick();
  const timer = setInterval(tick, 100);
  return () => clearInterval(timer);
}
