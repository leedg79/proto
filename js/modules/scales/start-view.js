// S3 Start Note: "D 도리안, 6번 줄 G에서 시작"처럼 지정한 음(또는 도수)에서 한 옥타브 오르내리기
// 제한시간이 지나거나 정답 확인을 누르면 경로와 "이렇게 치면 어떤 스케일과 같은 음 배열인지" 공개
// 스케일의 모든 음에서 한 번씩 시작 = 완료 1회

import * as D from "./drill-core.js";
import { scaleTitle, SCALES } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey } from "./common.js";
import { regionTimeHtml, bindRegionTime, readRegionTime } from "./prompt-drill.js";
import { seqTarget } from "../../eval/targets.js";

const store = makeStore("fretlab:stn2");
export const clearFinder = () => store.clear();

export function settingsHtml() {
  return `
    <div class="field"><label>키</label>${keyPickerHtml("stnKey", "stn.key")}</div>
    <div class="field" style="margin-top:14px"><label>지시 방식</label>${segHtml("stnLevel", D.START_LEVELS, getSetting("stn.level", "easy"))}
      <p class="muted small" style="margin:6px 0 0">줄 + 음 이름: "6번 줄 G에서" / 줄 + 도수: "6번 줄 4도음에서"(어떤 음인지 직접 떠올림)</p></div>
    ${regionTimeHtml("stn")}
    <p class="muted small" style="margin:4px 0 0">시작음(구간 안)에서 같은 블록 안으로 한 옥타브 올라갔다 내려오기(위쪽이 블록을 벗어나면 내려갔다 올라오기). 스케일의 모든 음에서 한 번씩 시작하면 완료 1회</p>`;
}
export function bindSettings(root) {
  bindPicker(root, "stnKey"); bindPicker(root, "stnLevel"); bindRegionTime(root, "stn");
}
export function readSettings(root) {
  const key = Number(readSel(root, "stnKey"));
  const level = readSel(root, "stnLevel", "v") === "hard" ? "hard" : "easy";
  setSetting("stn.key", key); setSetting("stn.level", level);
  return { key, level, ...readRegionTime(root, "stn") };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const list = scales.length ? scales : ["minor-penta"];
  const o = s0.options || {};
  const level = o.level === "hard" ? "hard" : "easy";
  const newDeck = n => { const scaleId = list[n % list.length]; return D.startDeck(pickKey(o.key ?? -1), scaleId, Math.random, o.region || "5-9"); };
  let st = store.load(s0.id) || { cycleNo: 0, deck: newDeck(0), index: -1, done: 0, units: 0, promptNo: 0, timeLimit: D.clampTime(o.timeLimit), current: null };

  container.innerHTML = `
    <div class="nf">
      <div class="nf-meta"><span id="stnNo">PROMPT 1</span><span id="stnProg"></span></div>
      <div class="prompt-card" id="stnCard">
        <div class="prompt-caption">START FROM</div>
        <div class="prompt-sub" id="stnScale" style="font-size:15px;color:var(--text)"></div>
        <div class="prompt-main" id="stnMain">-</div>
        <div class="prompt-sub" id="stnSub"></div>
      </div>
      <div class="cycle-dots" id="stnDots"></div>
      <div class="timer-wrap"><div class="timer-track"><div id="stnBar"></div></div><div class="timer-text" id="stnTimer">0.0</div></div>
      <div class="ctl-dock">
      <div class="nf-actions">
        <button class="btn primary wide" id="stnReveal" type="button">정답 확인</button>
        <button class="btn primary wide hidden" id="stnNext" type="button">다음 문제 →</button>
      </div>
      </div>
      <div class="answer-area" id="stnAnswer"></div>
      <div class="field inline-time">
        <label for="stnLive">제한시간 <b id="stnLiveOut">${st.timeLimit}초</b></label>
        <input id="stnLive" type="range" min="${D.TIME_MIN}" max="${D.TIME_MAX}" step="1" value="${st.timeLimit}">
      </div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function next() {
    if (!running()) return;
    let { deck, index, done, cycleNo } = st;
    if (index + 1 >= deck.length) { cycleNo++; deck = newDeck(cycleNo); index = -1; done = 0; }
    index++;
    st = { ...st, deck, index, done, cycleNo, promptNo: st.promptNo + 1, current: { start: api.elapsedMs(), revealed: false, timedOut: false } };
    persist(); draw(); evalPrompt();
  }
  // 연주 평가: 시작음부터 한 옥타브 왕복을 순서대로 쳤는지(틀린 위치 기록, 수행시간 = 첫 음~끝 음)
  function evalPrompt() {
    const p = st.deck[Math.max(0, st.index)];
    if (!api.eval || !p || !st.current || st.current.revealed) return;
    api.eval.prompt(seqTarget(`${scaleTitle(p.rootPc, p.scaleId)} · ${p.s}번 줄 ${p.noteName}`, p.notes));
  }
  function doReveal(timedOut) {
    if (!st.current || st.current.revealed) return;
    if (api.eval) api.eval.end();
    const done = st.done + 1;
    const complete = done >= st.deck.length;
    st = { ...st, done, units: st.units + (complete ? 1 : 0), current: { ...st.current, revealed: true, timedOut } };
    persist();
    if (complete) { api.addUnit(1); api.toast(`모든 음(${st.deck.length}개)에서 시작 완료 · 이번 세션 ${st.units}회`); }
    draw();
  }
  function draw() {
    const p = st.deck[Math.max(0, st.index)];
    $("#stnNo").textContent = "PROMPT " + Math.max(1, st.promptNo);
    $("#stnProg").textContent = `${st.deck.length}개 중 ${st.done} · 완료 ${st.units}회`;
    $("#stnDots").innerHTML = st.deck.map((_, i) => `<i class="${i < st.done ? "on" : ""}"></i>`).join("");
    const c = st.current;
    if (!c || !p) { $("#stnScale").textContent = ""; $("#stnMain").textContent = "-"; $("#stnSub").textContent = ""; $("#stnAnswer").innerHTML = ""; return; }
    const dirText = p.up ? "한 옥타브 올라갔다 내려오기" : "한 옥타브 내려갔다 올라오기";
    $("#stnScale").textContent = scaleTitle(p.rootPc, p.scaleId);
    $("#stnMain").textContent = level === "hard" ? (p.degree === "R" ? "근음" : `${p.degree}도음`) : p.noteName;
    $("#stnSub").textContent = `${p.s}번 줄에서 · ${dirText}${p.region ? ` · ${p.region.label}` : ""}`;
    $("#stnReveal").classList.toggle("hidden", c.revealed);
    $("#stnNext").classList.toggle("hidden", !c.revealed);
    const ans = $("#stnAnswer");
    if (c.revealed) {
      const runKeys = new Set(p.notes.map(n => `${n.s}-${n.f}`));
      const marks = [
        ...p.shape.filter(n => !runKeys.has(`${n.s}-${n.f}`)).map(n => ({ s: n.s, f: n.f, label: n.label, kind: n.root ? "ghostRoot" : "ghost" })),
        ...p.notes.filter((n, i) => i === 0 || !(n.s === p.s && n.f === p.f)).map((n, i) => ({ s: n.s, f: n.f, label: n.label, kind: i === 0 ? "active" : n.root ? "root" : "note" }))
      ];
      const fr = p.notes.map(n => n.f).concat(p.shape.map(n => n.f));
      let from = Math.max(0, Math.min(...fr) - 1); if (from <= 1) from = 0;
      const to = Math.max(from + 5, Math.max(...fr) + 1);
      const rel = SCALES[p.scaleId].chord
        ? (p.semi === 0 ? "근음에서 시작" : `코드톤 전위 · ${p.degree}음부터`)
        : p.semi === 0 ? "근음에서 시작" : p.related ? `이 음 배열은 ${p.related}와 같음` : "";
      const half = Math.ceil(p.notes.length / 2);
      ans.innerHTML = `
        <div class="answer-title">${esc(p.noteName)} = ${esc(p.degree === "R" ? "근음" : p.degree + "도")} · ${p.s}번 줄 ${p.f}프렛${c.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
        <div class="fretboard">${scaleBoardSvg(marks, { from, to, path: p.notes.slice(0, half) })}</div>
        <div class="answer-note">${esc(rel)}${rel ? " · " : ""}노랑 = 시작음, 파란 선 = ${p.up ? "올라가는" : "내려가는"} 경로(돌아올 때는 거꾸로), 흐린 원 = 같은 블록의 나머지 음</div>
        <div class="st-run">${p.notes.slice(0, half).map(n => `<span>${esc(n.label)}</span>`).join("")}</div>`;
    } else {
      ans.innerHTML = `<div class="fretboard">${scaleBoardSvg([], { from: 0, to: 15, strings: [p.s] })}</div>`;
    }
  }
  function tick() {
    const on = running();
    if (on && !st.current) next();
    const live = st.current && !st.current.revealed;
    const rem = live ? Math.max(0, st.timeLimit * 1000 - (api.elapsedMs() - st.current.start)) : 0;
    $("#stnTimer").textContent = (rem / 1000).toFixed(1);
    $("#stnBar").style.width = (live ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
    $("#stnReveal").disabled = !on; $("#stnNext").disabled = !on;
    $("#stnCard").classList.toggle("paused", !on);
    if (on && live && rem <= 0) doReveal(true);
  }
  $("#stnReveal").onclick = () => { if (running()) doReveal(false); };
  $("#stnNext").onclick = () => next();
  const liveR = $("#stnLive");
  liveR.oninput = () => {
    st = { ...st, timeLimit: D.clampTime(liveR.value), current: st.current && !st.current.revealed ? { ...st.current, start: api.elapsedMs() } : st.current };
    $("#stnLiveOut").textContent = st.timeLimit + "초"; setSetting("stn.time", st.timeLimit); persist();
  };
  draw(); tick();
  const timer = setInterval(tick, 100);
  evalPrompt();
  return () => { clearInterval(timer); if (api.eval) api.eval.end(); };
}
