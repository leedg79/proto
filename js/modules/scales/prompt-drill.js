// Scales 문제형 공용 화면: "5~9프렛에서 C 마이너 펜타토닉"처럼 지시 → 제한시간 동안 연주 → 시간이 끝나거나 확인을 누르면 정답 모양 공개
// 문제 중에는 지판에 음을 보여 주지 않음(구간만 표시). 묶음(deck)을 모두 확인하면 완료 1회

import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, makeStore, segHtml, bindPicker, readSel } from "./common.js";
import * as D from "./drill-core.js";
import { pcsTarget, midiAt } from "../../eval/targets.js";

// 공용 설정: 연습 구간, 제한시간
export function regionTimeHtml(p) {
  const t = D.clampTime(getSetting(`${p}.time`, D.TIME_DEFAULT));
  return `
    <div class="field" style="margin-top:14px"><label>연습 구간</label>${segHtml(`${p}Region`, D.REGIONS, getSetting(`${p}.region`, "5-9"))}
      <p class="muted small" style="margin:6px 0 0">모든 문제의 모양이 이 구간 안에 나옴</p></div>
    <div class="field" style="margin-top:14px">
      <label for="${p}Time">제한시간 <b id="${p}TimeOut">${t}초</b></label>
      <input id="${p}Time" type="range" min="${D.TIME_MIN}" max="${D.TIME_MAX}" step="1" value="${t}">
    </div>`;
}
export function bindRegionTime(root, p) {
  bindPicker(root, `${p}Region`);
  const r = root.querySelector(`#${p}Time`);
  r.oninput = () => { root.querySelector(`#${p}TimeOut`).textContent = r.value + "초"; };
}
export function readRegionTime(root, p) {
  const ids = D.REGIONS.map(r => r[0]);
  const region = ids.includes(readSel(root, `${p}Region`, "v")) ? readSel(root, `${p}Region`, "v") : "5-9";
  const timeLimit = D.clampTime(root.querySelector(`#${p}Time`).value);
  setSetting(`${p}.region`, region); setSetting(`${p}.time`, timeLimit);
  return { region, timeLimit };
}

// opts: { storeKey, timeKey, timeLimit, makeDeck(cycleNo) → 문제 배열, doneText(deck), caption }
// 문제: { title, main, sub, shape:[{s,f,label,root}], changed?:["s-f"], from, to, lo, hi, region:{lo,hi,label}, answer }
export function mountPromptDrill(container, api, opts) {
  const s0 = api.getActive();
  const store = makeStore(opts.storeKey);
  let st = store.load(s0.id) || { cycleNo: 0, deck: opts.makeDeck(0), index: -1, done: 0, units: 0, promptNo: 0, timeLimit: D.clampTime(opts.timeLimit), current: null };

  container.innerHTML = `
    <div class="nf">
      <div class="nf-meta"><span id="pdNo">PROMPT 1</span><span id="pdProg"></span></div>
      <div class="prompt-card" id="pdCard">
        <div class="prompt-caption">${esc(opts.caption || "PLAY THIS SCALE")}</div>
        <div class="prompt-sub" id="pdTitle" style="font-size:15px;color:var(--text)"></div>
        <div class="prompt-main" id="pdMain">-</div>
        <div class="prompt-sub" id="pdSub"></div>
      </div>
      <div class="cycle-dots" id="pdDots"></div>
      <div class="timer-wrap"><div class="timer-track"><div id="pdBar"></div></div><div class="timer-text" id="pdTimer">0.0</div></div>
      <div class="ctl-dock">
      <div class="nf-actions">
        <button class="btn primary wide" id="pdReveal" type="button">정답 확인</button>
        <button class="btn primary wide hidden" id="pdNext" type="button">다음 문제 →</button>
      </div>
      </div>
      <div class="answer-area" id="pdAnswer"></div>
      <div class="field inline-time">
        <label for="pdLive">제한시간 <b id="pdLiveOut">${st.timeLimit}초</b></label>
        <input id="pdLive" type="range" min="${D.TIME_MIN}" max="${D.TIME_MAX}" step="1" value="${st.timeLimit}">
      </div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function next() {
    if (!running()) return;
    let { deck, index, done, cycleNo } = st;
    if (index + 1 >= deck.length) { cycleNo++; deck = opts.makeDeck(cycleNo); index = -1; done = 0; }
    index++;
    st = { ...st, deck, index, done, cycleNo, promptNo: st.promptNo + 1, current: { start: api.elapsedMs(), revealed: false, timedOut: false } };
    persist(); draw(); evalPrompt();
  }
  // 연주 평가: 제한시간 동안 친 음이 이 스케일 안의 음인지 + 구성음을 모두 쳤는지(수행시간 = 모든 구성음을 친 순간)
  function evalPrompt() {
    const p = st.deck[Math.max(0, st.index)];
    if (!api.eval || !p || !st.current || st.current.revealed) return;
    api.eval.prompt(pcsTarget(`${p.title} ${p.main}`.trim(), p.shape.map(n => midiAt(n.s, n.f))));
  }
  function doReveal(timedOut) {
    if (!st.current || st.current.revealed) return;
    if (api.eval) api.eval.end();
    const done = st.done + 1;
    const complete = done >= st.deck.length;
    st = { ...st, done, units: st.units + (complete ? 1 : 0), current: { ...st.current, revealed: true, timedOut } };
    persist();
    if (complete) { api.addUnit(1); api.toast(`${opts.doneText ? opts.doneText(st.deck) : "완료"} · 이번 세션 ${st.units}회`); }
    draw();
  }
  function draw() {
    const p = st.deck[Math.max(0, st.index)];
    $("#pdNo").textContent = "PROMPT " + Math.max(1, st.promptNo);
    $("#pdProg").textContent = `${st.deck.length}개 중 ${st.done} · 완료 ${st.units}회`;
    $("#pdDots").innerHTML = st.deck.map((_, i) => `<i class="${i < st.done ? "on" : ""}"></i>`).join("");
    const c = st.current;
    if (!c || !p) { $("#pdTitle").textContent = ""; $("#pdMain").textContent = "-"; $("#pdSub").textContent = ""; $("#pdAnswer").innerHTML = ""; return; }
    $("#pdTitle").textContent = p.title;
    $("#pdMain").textContent = p.main;
    $("#pdSub").textContent = p.sub;
    $("#pdReveal").classList.toggle("hidden", c.revealed);
    $("#pdNext").classList.toggle("hidden", !c.revealed);
    const ans = $("#pdAnswer");
    if (c.revealed) {
      const changed = new Set(p.changed || []);
      const marks = p.shape.map(n => ({ s: n.s, f: n.f, label: n.label, kind: changed.has(`${n.s}-${n.f}`) ? "changed" : n.root ? "root" : "note" }));
      ans.innerHTML = `
        <div class="answer-title">${esc(p.title)}${c.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
        <div class="fretboard">${scaleBoardSvg(marks, { from: p.from, to: p.to })}</div>
        <div class="answer-note">${esc(p.answer || "")}${changed.size ? " · 주황 = 앞 모드와 달라진 음" : ""} · 초록 = 근음</div>`;
    } else {
      // 문제 중에는 구간만(음 표시 없음)
      let from = Math.max(0, p.region.lo - 1); if (from <= 1) from = 0;
      ans.innerHTML = `<div class="fretboard">${scaleBoardSvg([], { from, to: Math.max(from + 5, p.region.hi + 1) })}</div>`;
    }
  }
  function tick() {
    const on = running();
    if (on && !st.current) next();
    const live = st.current && !st.current.revealed;
    const rem = live ? Math.max(0, st.timeLimit * 1000 - (api.elapsedMs() - st.current.start)) : 0;
    $("#pdTimer").textContent = (rem / 1000).toFixed(1);
    $("#pdBar").style.width = (live ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
    $("#pdReveal").disabled = !on; $("#pdNext").disabled = !on;
    $("#pdCard").classList.toggle("paused", !on);
    if (on && live && rem <= 0) doReveal(true);
  }
  $("#pdReveal").onclick = () => { if (running()) doReveal(false); };
  $("#pdNext").onclick = () => next();
  const liveR = $("#pdLive");
  liveR.oninput = () => {
    st = { ...st, timeLimit: D.clampTime(liveR.value), current: st.current && !st.current.revealed ? { ...st.current, start: api.elapsedMs() } : st.current };
    $("#pdLiveOut").textContent = st.timeLimit + "초"; if (opts.timeKey) setSetting(opts.timeKey, st.timeLimit); persist();
  };
  draw(); tick();
  const timer = setInterval(tick, 100);
  evalPrompt();
  return () => { clearInterval(timer); if (api.eval) api.eval.end(); };
}

export function clearStore(key) { makeStore(key).clear(); }
