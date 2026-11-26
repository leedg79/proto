// Technique 연습 화면: 연습곡 악보 → 시연 듣기 → 판정(마이크로 어택 시점을 악보 박자와 비교) → 템포 사다리
// 통과하면 BPM이 올라가고, 2번 연속 실패하면 내려감. 통과 3회 = 완료 1회

import * as T from "./tech-core.js";
import { scoreSvg } from "../../render/score.js";
import { playLick, stopLick } from "../../audio/lick-player.js";
import { unlockAudio, getAudioContext } from "../../audio/context.js";
import { drum } from "../../audio/drums.js";
import { masterOut } from "../../audio/sampler.js";
import { openMic, listen, closeMic, micSupported, isMicOpen } from "../../audio/mic.js";
import { floorFromNoise } from "../../audio/onset-core.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";

const PASSES_PER_UNIT = 3;
const STEPS = [["2", "+2"], ["4", "+4"], ["6", "+6"], ["8", "+8"]];
const RUNS = [["2", "2마디"], ["4", "4마디"], ["8", "8마디"]];
const STARTS = [["rec", "권장 시작 BPM"], ["best", "내 최고 기록부터"]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMs = v => (v == null ? "-" : `${Math.round(v)}ms`);

export function makeTechTask(level) {
  const store = makeStore(`fretlab:tech-${level}`);
  const P = `tq${level}`;

  function settingsHtml() {
    return `
      <div class="field"><label>마이크 감도</label>${segHtml(`${P}Sens`, Object.entries(T.SENS).map(([k, v]) => [k, v.label]), getSetting("tech.sens", "mid"))}</div>
      <div class="field" style="margin-top:14px"><label>시작 BPM</label>${segHtml(`${P}Start`, STARTS, getSetting("tech.start", "rec"))}</div>
      <div class="field" style="margin-top:14px"><label>통과할 때마다 올릴 BPM</label>${segHtml(`${P}Step`, STEPS, String(getSetting("tech.step", 4)))}</div>
      <div class="field" style="margin-top:14px"><label>한 번 판정할 길이</label>${segHtml(`${P}Run`, RUNS, String(getSetting("tech.run", 4)))}</div>
      <div class="field" style="margin-top:14px"><label>연습곡 순서</label>${segHtml(`${P}Order`, [["seq", "순서대로"], ["rand", "무작위"]], getSetting("tech.order", "seq"))}</div>
      <p class="muted small" style="margin:4px 0 0">감도: 앰프 없이 일렉을 치거나 소리가 작으면 "민감", 주변 잡음이 많으면 "둔감". 마이크로 내가 친 소리의 시작점(어택)을 잡아 악보의 음표·쉼표 박자와 비교함. 이어폰을 끼면 클릭 소리가 마이크에 섞이지 않아 정확함. 처음 한 번 "박자 보정"을 해 두면 기기 지연을 뺌. 통과 ${PASSES_PER_UNIT}회 = 완료 1회</p>`;
  }
  function bindSettings(root) { [`${P}Sens`, `${P}Start`, `${P}Step`, `${P}Run`, `${P}Order`].forEach(id => bindPicker(root, id)); }
  function readSettings(root) {
    const sens = readSel(root, `${P}Sens`, "v") || "mid";
    setSetting("tech.sens", sens);
    const o = {
      start: readSel(root, `${P}Start`, "v") || "rec", step: Number(readSel(root, `${P}Step`, "v") || 4),
      run: Number(readSel(root, `${P}Run`, "v") || 4), order: readSel(root, `${P}Order`, "v") || "seq"
    };
    setSetting("tech.start", o.start); setSetting("tech.step", o.step); setSetting("tech.run", o.run); setSetting("tech.order", o.order);
    return o;
  }

  function mount(container, api) {
    const s0 = api.getActive();
    const o = s0.options || {};
    const pool = T.exercisesFor(level, s0.topics);
    const ids = pool.map(x => x.id);
    if (o.order === "rand") for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const bestAll = () => getSetting("tech.best", {}) || {};
    const startBpm = x => (o.start === "best" && bestAll()[x.id] ? bestAll()[x.id] : x.bpm.start);
    let st = store.load(s0.id) || { order: ids, n: 0, passes: 0, units: 0, lad: {}, last: null };
    const persist = () => store.save(s0.id, st);
    let x, busy = false, stopFns = [];

    container.innerHTML = `
      <div class="nf tq">
        <div class="nf-meta"><span id="tqNo"></span><span id="tqProg"></span></div>
        <div class="rh-head"><b id="tqName"></b><small id="tqTopic" class="muted"></small></div>
        <div class="score-wrap" id="tqScore"></div>
        <p class="small rh-tip" id="tqTip"></p>
        <div class="tq-bpm"><div><b id="tqBpm">-</b><span>BPM</span></div><small id="tqBest" class="muted"></small></div>
        <div class="tq-mic"><span id="tqMicState" class="muted small">마이크 꺼짐</span><span class="tq-meter"><i id="tqMeter"></i></span><button class="btn small" id="tqCal" type="button">박자 보정</button></div>
        <div class="field" style="margin-top:6px"><label>마이크 감도 (바로 바뀜)</label>${segHtml("tqSens", Object.entries(T.SENS).map(([k, v]) => [k, v.label]), getSetting("tech.sens", "mid"))}</div>
        <div class="tq-check">
          <button class="btn small" id="tqCheck" type="button">입력 확인</button>
          <div class="tq-strip" id="tqStrip"><span class="muted small">치는 대로 잡힌 어택이 점으로 찍힘</span></div>
          <b id="tqCount" class="small">0</b>
        </div>
        <div class="jam-state muted small" id="tqState"></div>
        <div class="nf-actions" style="margin-top:8px">
          <button class="btn primary wide" id="tqJudge" type="button">판정 시작 (클릭 4번 뒤 연주)</button>
          <button class="btn wide" id="tqDemo" type="button" style="margin-top:8px">시연 듣기</button>
        </div>
        <div id="tqResult" class="tq-result hidden"></div>
        <div class="btn-row" style="gap:8px;margin-top:8px">
          <button class="btn small" id="tqPrev" type="button">← 이전 연습곡</button>
          <button class="btn small" id="tqNext" type="button">다음 연습곡 →</button>
        </div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
          <div class="bpm-val"><b id="tqBpm2">-</b><span>BPM</span></div>
          <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
        </div></div>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
    const lad = () => st.lad[x.id] || { bpm: startBpm(x), fails: 0, best: bestAll()[x.id] || 0 };
    const loops = () => Math.max(1, Math.round((o.run || 4) / x.bars));

    function load() { x = T.exerciseById(st.order[st.n % st.order.length]) || pool[0]; }
    function drawScore(grades) {
      const el = $("#tqScore");
      if (!scoreSvg(el, x.events, { ticks: x.ticks })) { el.textContent = "악보를 그릴 수 없음"; return; }
      if (grades) for (const [idx, g] of Object.entries(grades)) el.querySelectorAll(`[data-ev="${idx}"]`).forEach(n => n.classList.add(`j-${g}`));
    }
    function drawHead() {
      const L = lad();
      $("#tqNo").textContent = `${(st.n % st.order.length) + 1}/${st.order.length} · ${x.id}`;
      $("#tqProg").textContent = `통과 ${st.passes % PASSES_PER_UNIT}/${PASSES_PER_UNIT} · 완료 ${st.units}회`;
      $("#tqName").textContent = x.name;
      $("#tqTopic").textContent = `${T.TECH_TOPIC_NAMES[x.topic] || x.topic} · ${x.bars}마디 · 권장 ${x.bpm.start}→${x.bpm.target} BPM`;
      $("#tqTip").textContent = x.tip;
      $("#tqBpm").textContent = L.bpm; $("#tqBpm2").textContent = L.bpm;
      const best = Math.max(L.best || 0, bestAll()[x.id] || 0);
      $("#tqBest").textContent = best ? `최고 통과 ${best} BPM${best >= x.bpm.target ? " · 목표 달성" : ` · 목표 ${x.bpm.target}`}` : `목표 ${x.bpm.target} BPM`;
    }
    function drawAll() { drawHead(); drawScore(st.last && st.last.id === x.id ? st.last.grades : null); drawResult(); }
    function drawResult() {
      const r = st.last && st.last.id === x.id ? st.last : null;
      const el = $("#tqResult");
      if (!r) { el.classList.add("hidden"); return; }
      el.classList.remove("hidden");
      const tend = r.signedMs == null ? "" : Math.abs(r.signedMs) < 8 ? "박 위에서 고르게 침" : r.signedMs < 0 ? `평균 ${Math.round(-r.signedMs)}ms 빠름(앞으로 쏠림)` : `평균 ${Math.round(r.signedMs)}ms 늦음(뒤로 처짐)`;
      el.innerHTML = `
        <div class="tq-verdict ${r.pass ? "ok" : "ng"}">${r.pass ? "통과" : "다시"} <small>${r.bpm} BPM</small></div>
        <div class="tq-stats">
          <div><b>${Math.round(r.hitRate * 100)}%</b><small>박에 맞춘 어택 (${r.hits}/${r.required})</small></div>
          <div><b>${fmtMs(r.meanMs)}</b><small>평균 오차</small></div>
          <div><b>${Math.round(r.within * 100)}%</b><small>±50ms 안</small></div>
          <div><b>${r.extras}</b><small>불필요한 어택(허용 ${r.allowedExtras})</small></div>
        </div>
        <p class="small" style="margin:8px 0 0">${esc(tend)}${r.misses ? ` · 빠진 음 ${r.misses}개` : ""}. 악보 색: <span class="j-dot good"></span>±25ms <span class="j-dot ok"></span>±50ms <span class="j-dot off"></span>그 이상 <span class="j-dot miss"></span>못 잡음</p>
        <p class="muted small" style="margin:4px 0 0">${r.next}</p>`;
    }
    const setState = t => { $("#tqState").textContent = t; };
    const setMic = t => { $("#tqMicState").textContent = t; };
    let meterTimer = null;
    const micOpts = () => { const sv = T.sensOf(getSetting("tech.sens", "mid")); return { floor: getSetting("tech.floor", 2e-6) * sv.floorMul, ratio: sv.ratio }; };
    async function ensureMic() {
      if (window.__fretlabTechInject) return true;
      if (!micSupported()) { setMic("이 브라우저는 마이크를 쓸 수 없음"); return false; }
      try {
        const m = await openMic(micOpts());
        setMic(getSetting("tech.latency", null) == null ? "마이크 켜짐 · 박자 보정 전(기본 지연 60ms)" : `마이크 켜짐 · 보정 지연 ${Math.round(getSetting("tech.latency", 0.06) * 1000)}ms`);
        if (!meterTimer) meterTimer = setInterval(() => { const lv = Math.min(1, Math.sqrt(m.level || 0) * 25); const b = $("#tqMeter"); if (b) b.style.width = `${Math.round(lv * 100)}%`; }, 80);
        return true;
      } catch (e) {
        setMic(e && e.name === "NotAllowedError" ? "마이크 권한이 없음 — 설정에서 이 앱의 마이크를 허용해야 판정할 수 있음" : `마이크를 열 수 없음: ${e.message}`);
        return false;
      }
    }

    // 박자 보정: 1) 조용히 1초(소음) 2) 클릭 4번 동안 치지 않기(스피커 소리가 들어가는지) 3) 클릭 8번에 맞춰 뮤트한 줄 피킹
    async function calibrate() {
      if (busy || !running()) { if (!running()) api.toast("연습을 시작(재개)한 뒤 보정할 수 있음"); return; }
      if (!(await ensureMic())) return;
      stopCheck();
      busy = true; stopLick();
      try {
        await unlockAudio();
        const ctx = getAudioContext();
        const energies = [], onsets = [];
        const off = listen({ onEnergy: (t, e) => energies.push([t, e]), onOnset: t => onsets.push(t) });
        setState("보정 1/3 · 조용히 1초…"); await sleep(1100);
        const floor = floorFromNoise(energies.map(x2 => x2[1]));
        setSetting("tech.floor", floor);
        await openMic(micOpts());
        setState("보정 2/3 · 클릭 4번 — 치지 말고 들어만 봄");
        onsets.length = 0;
        const t0 = ctx.currentTime + 0.3, spb = 0.75;
        const quiet = Array.from({ length: 4 }, (_, k) => t0 + k * spb);
        quiet.forEach(t => drum("click", t, 1, masterOut(ctx)));
        await sleep((0.3 + 4 * spb) * 1000 + 200);
        const bleed = T.latencyFrom(quiet, onsets.slice(), 0.15);
        setState("보정 3/3 · 클릭 8번에 맞춰 뮤트한 줄을 피킹(첫 클릭부터)");
        onsets.length = 0;
        const t1 = ctx.currentTime + 1.2;
        const clicks = Array.from({ length: 8 }, (_, k) => t1 + k * spb);
        clicks.forEach((t, k) => drum("click", t, k % 4 === 0 ? 1 : 0.7, masterOut(ctx)));
        await sleep((1.2 + 8 * spb) * 1000 + 400);
        off();
        const r = T.latencyFrom(clicks, onsets.slice());
        if (!r) { setState(`어택을 충분히 못 잡음(${onsets.length}개). 조금 더 세게, 클릭에 맞춰 다시 보정`); return; }
        setSetting("tech.latency", Math.max(0, r.latency));
        setMic(`마이크 켜짐 · 보정 지연 ${Math.round(r.latency * 1000)}ms`);
        setState(`보정 완료 · 지연 ${Math.round(r.latency * 1000)}ms (${r.matched}/8 잡음)${bleed ? " · 스피커 클릭이 마이크에 들어감: 이어폰을 끼는 것이 정확함" : ""}`);
      } finally { busy = false; }
    }

    async function demo() {
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 들을 수 있음"); return; }
      stopLick();
      setState("시연 재생 중");
      const d = await playLick(T.loopEvents(x, 1), lad().bpm, { countIn: 4, click: true });
      const id = setTimeout(() => setState(""), d * 1000 + 200); stopFns.push(() => clearTimeout(id));
    }

    async function runJudge() {
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 판정할 수 있음"); return; }
      if (!(await ensureMic())) return;
      stopCheck();
      busy = true; stopLick();
      $("#tqJudge").disabled = true;
      try {
        await unlockAudio();
        const ctx = getAudioContext();
        const L = lad(), bpm = L.bpm, spb = 60 / bpm, n = loops();
        const startAt = ctx.currentTime + 0.25 + 4 * spb;
        const onsets = [];
        const off = window.__fretlabTechInject ? () => {} : listen({ onOnset: t => onsets.push(t) });
        const dur = await playLick(T.loopEvents(x, n), bpm, { countIn: 4, click: true, silent: true, startAt, onEvent: () => {} });
        const tick = setInterval(() => {
          const now = ctx.currentTime;
          setState(now < startAt ? `준비 ${Math.max(1, Math.ceil((startAt - now) / spb))}` : `연주 중 · ${Math.min(n * x.bars, Math.floor((now - startAt) / (4 * spb)) + 1)}/${n * x.bars}마디`);
        }, 100);
        await sleep(dur * 1000 + 350);
        clearInterval(tick); off();
        if (!api.getActive() || !running()) { setState("일시정지되어 판정하지 않음"); return; }
        const expected = T.expectedOnsets(x, bpm, n);
        const latency = getSetting("tech.latency", 0.06);
        const detected = window.__fretlabTechInject ? window.__fretlabTechInject(expected, { bpm, latency }) : onsets.map(t => t - latency - startAt);
        const res = T.judge(expected, detected);
        const L2 = T.ladder(L, res.pass, o.step || 4);
        if (res.pass) {
          const b = bestAll(); if (!b[x.id] || b[x.id] < bpm) { b[x.id] = bpm; setSetting("tech.best", b); }
        }
        const next = res.pass ? `다음 판정은 ${L2.bpm} BPM` : L2.bpm < bpm ? `2번 연속 실패 → ${L2.bpm} BPM으로 내림` : `같은 ${bpm} BPM으로 한 번 더`;
        st = { ...st, lad: { ...st.lad, [x.id]: L2 }, passes: st.passes + (res.pass ? 1 : 0),
          last: { id: x.id, bpm, pass: res.pass, hitRate: res.hitRate, hits: res.hits, required: res.required, misses: res.misses, extras: res.extras, allowedExtras: res.allowedExtras, meanMs: res.meanMs, signedMs: res.signedMs, within: res.within, grades: T.gradeByIndex(res), next } };
        if (res.pass && st.passes % PASSES_PER_UNIT === 0) { st.units += 1; api.addUnit(1); api.toast(`통과 ${PASSES_PER_UNIT}회 · 완료 ${st.units}회`); }
        persist();
        setState(res.pass ? "통과" : "다시");
        drawAll();
      } finally { busy = false; $("#tqJudge").disabled = false; }
    }

    // 입력 확인: 8초 동안 잡힌 어택을 시간 띠에 점으로(최근 4초)
    let checkOff = null, checkTimer = null;
    function stopCheck() {
      if (checkOff) checkOff(); checkOff = null;
      if (checkTimer) clearInterval(checkTimer); checkTimer = null;
      $("#tqCheck").textContent = "입력 확인";
    }
    async function inputCheck() {
      if (checkOff) { stopCheck(); return; }
      if (busy) return;
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 확인할 수 있음"); return; }
      if (!(await ensureMic())) return;
      await unlockAudio();
      const ctx = getAudioContext();
      const hits = [], t0 = ctx.currentTime;
      checkOff = listen({ onOnset: t => hits.push(t) });
      $("#tqCheck").textContent = "멈춤";
      const strip = $("#tqStrip");
      checkTimer = setInterval(() => {
        const now = ctx.currentTime;
        strip.innerHTML = hits.filter(t => now - t < 4).map(t => `<i style="left:${Math.max(0, 100 - ((now - t) / 4) * 100)}%"></i>`).join("");
        $("#tqCount").textContent = hits.length;
        if (now - t0 > 8) {
          stopCheck();
          strip.innerHTML = `<span class="small">${hits.length ? `8초 동안 어택 ${hits.length}개를 잡음. 친 횟수와 비슷하면 이 위치·감도로 판정 가능` : "어택을 하나도 못 잡음. 폰을 줄 가까이 두거나 감도를 \"민감\"으로"}</span>`;
        }
      }, 60);
      if (window.__fretlabTechInject) hits.push(ctx.currentTime);
    }
    $("#tqCheck").onclick = inputCheck;
    $("#tqSens").onclick = async e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      $("#tqSens").querySelectorAll("button").forEach(x2 => x2.classList.toggle("sel", x2 === b));
      setSetting("tech.sens", b.dataset.v);
      if (isMicOpen()) await openMic(micOpts());
      api.toast(`마이크 감도: ${T.sensOf(b.dataset.v).label}`);
    };
    stopFns.push(stopCheck);

    function go(d) { if (busy) return; stopLick(); st = { ...st, n: (st.n + d + st.order.length) % st.order.length }; persist(); load(); drawAll(); setState(""); }
    $("#tqJudge").onclick = runJudge;
    $("#tqDemo").onclick = demo;
    $("#tqCal").onclick = calibrate;
    $("#tqPrev").onclick = () => go(-1);
    $("#tqNext").onclick = () => go(1);
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b || busy) return;
      const L = lad();
      st = { ...st, lad: { ...st.lad, [x.id]: { ...L, bpm: Math.max(40, Math.min(200, L.bpm + Number(b.dataset.bpm))), fails: 0 } } };
      persist(); drawHead();
    });
    load(); drawAll(); persist();
    if (window.__fretlabTechInject) setMic("시험용 입력");
    return () => { stopLick(); stopFns.forEach(f => f()); if (meterTimer) clearInterval(meterTimer); closeMic(); };
  }

  return { settingsHtml, bindSettings, readSettings, mount, clearFinder: () => store.clear() };
}
