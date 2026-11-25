// 리듬 읽기(R1): 리듬 악보만 보고 스트로크 → 정답(손 방향·소리) 확인
// 문제는 고른 주제에서 무작위(4·8·16비트·쉼표·싱코페이션은 새로 조합, 나머지는 패턴 목록). 10문제 = 완료 1회

import * as R from "./rhythm-core.js";
import { rhythmSvg } from "../../render/rhythm.js";
import { startRhythm, stopRhythm, setRhythmLevel, setRhythmBpm } from "../../audio/rhythm-player.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { gridHtml } from "./pattern-view.js";

const store = makeStore("fretlab:rhr1");
export const clearFinder = () => store.clear();
const PER_UNIT = 10;
const clampBpm = v => Math.max(40, Math.min(160, Math.round(Number(v) || 70)));

export function settingsHtml() {
  const bpm = clampBpm(getSetting("rhr.bpm", 70));
  return `
    <div class="field"><label>문제에 화살표(다운·업) 표시</label>${segHtml("rhrArrow", [["off", "숨김(직접 판단)"], ["on", "보임"]], getSetting("rhr.arrow", "off"))}</div>
    <div class="field" style="margin-top:14px">
      <label for="rhrBpm">BPM <b id="rhrBpmOut">${bpm}</b></label>
      <input id="rhrBpm" type="range" min="40" max="160" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">악보만 보고 "치기 시작"을 눌러 클릭에 맞춰 2번 침 → "정답 듣기"로 손 방향과 소리 확인. ${PER_UNIT}문제 = 완료 1회</p>`;
}
export function bindSettings(root) {
  bindPicker(root, "rhrArrow");
  const r = root.querySelector("#rhrBpm");
  r.oninput = () => { root.querySelector("#rhrBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const bpm = clampBpm(root.querySelector("#rhrBpm").value), arrow = readSel(root, "rhrArrow", "v") || "off";
  setSetting("rhr.bpm", bpm); setSetting("rhr.arrow", arrow);
  return { bpm, arrow };
}

const plain = p => ({ id: p.id, kind: "strum", topic: p.topic, name: p.name, grid: p.grid, tokens: [...p.tokens], bars: p.bars, opts: { ...p.opts }, tip: p.tip });

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  let st = store.load(s0.id) || { no: 1, done: 0, units: 0, phase: "prompt", bpm: clampBpm(o.bpm || 70), arrow: o.arrow || "off", cur: plain(R.readingPrompt(s0.topics)) };
  const persist = () => store.save(s0.id, st);
  const voicing = R.chordVoicing("G");
  let stepEls = null, lastOn = [];

  container.innerHTML = `
    <div class="nf rh">
      <div class="nf-meta"><span id="rrNo"></span><span id="rrProg"></span></div>
      <div class="prompt-card">
        <div class="prompt-caption">READ &amp; PLAY · G 코드</div>
        <div class="prompt-sub" id="rrTopic" style="font-size:15px;color:var(--text)"></div>
      </div>
      <div class="score-wrap" id="rrScore"></div>
      <div id="rrGrid"></div>
      <p class="small rh-tip hidden" id="rrTip"></p>
      <div class="jam-state muted small" id="rrState"></div>
      <div class="nf-actions" style="margin-top:8px">
        <button class="btn primary wide" id="rrTry" type="button">치기 시작 (클릭에 맞춰 2번)</button>
        <button class="btn wide" id="rrReveal" type="button" style="margin-top:8px">정답 듣기·보기</button>
        <button class="btn primary wide hidden" id="rrNext" type="button" style="margin-top:8px">다음 문제 →</button>
      </div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="rrBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };

  function draw() {
    const p = st.cur, shown = st.phase === "revealed";
    $("#rrNo").textContent = `문제 ${st.no}`;
    $("#rrProg").textContent = `${st.done % PER_UNIT}/${PER_UNIT} · 완료 ${st.units}회`;
    $("#rrTopic").textContent = `${R.TOPIC_NAMES[p.topic] || p.topic}${p.opts.swing ? " · 셔플" : ""}${p.bars > 1 ? " · 2마디" : ""}${shown && p.id !== "RD" ? ` · ${p.id} ${p.name}` : ""}`;
    const el = $("#rrScore");
    if (rhythmSvg(el, p, { arrows: shown || st.arrow === "on" })) {
      stepEls = new Map();
      el.querySelectorAll("[data-step]").forEach(g => { const k = Number(g.dataset.step); stepEls.set(k, [...(stepEls.get(k) || []), g]); });
    } else el.textContent = "악보를 그릴 수 없음";
    $("#rrGrid").innerHTML = gridHtml(p, { hide: !shown });
    $("#rrTip").textContent = p.tip || "짝수 칸(박 머리·&) 다운, 홀수 칸 업. 치지 않는 칸에서도 손은 계속 움직임";
    $("#rrTip").classList.toggle("hidden", !shown);
    $("#rrNext").classList.toggle("hidden", !shown);
    $("#rrReveal").classList.toggle("hidden", shown);
    $("#rrTry").textContent = shown ? "다시 치기 (클릭에 맞춰 2번)" : "치기 시작 (클릭에 맞춰 2번)";
  }
  const events = () => R.soundEvents(st.cur);
  function onStep(b, step) {
    const p = st.cur, i = (b % p.bars) * p.grid + step;
    container.querySelectorAll(".rg-c.now").forEach(x => x.classList.remove("now"));
    const c = container.querySelector(`.rg-c[data-i="${i}"]`); if (c) c.classList.add("now");
    if (stepEls && st.phase === "revealed") {
      let last = null; for (const e of events()) if (e.i <= i) last = e;
      lastOn.forEach(x => x.classList.remove("on"));
      lastOn = last && last.type !== "rest" ? stepEls.get(last.i) || [] : [];
      lastOn.forEach(x => x.classList.add("on"));
    }
  }
  function clearMarks() { container.querySelectorAll(".rg-c.now").forEach(x => x.classList.remove("now")); lastOn.forEach(x => x.classList.remove("on")); lastOn = []; }
  async function run(demo) {
    if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
    const p = st.cur;
    $("#rrState").textContent = "음원 불러오는 중…";
    try {
      await startRhythm({
        bpm: st.bpm, loopBars: p.bars, countIn: 4, swing: !!p.opts.swing, grid: p.grid, click: true, maxLoops: demo ? 1 : 2,
        barEvents: b => R.barEvents(p, b, voicing, voicing),
        onCount: left => { $("#rrState").textContent = `준비 ${left}`; },
        onBar: (b, loop) => { $("#rrState").textContent = demo ? "정답 소리" : `${loop + 1}/2번째 · ${b + 1}마디`; },
        onStep,
        onEnd: () => { clearMarks(); $("#rrState").textContent = demo ? "다음 문제로 넘어가거나 다시 쳐 봄" : "다 쳤으면 정답 듣기"; }
      });
      setRhythmLevel("guitar", demo ? 0.9 : 0);
    } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#rrState").textContent = ""; }
  }
  $("#rrTry").onclick = () => { stopRhythm(); clearMarks(); run(false); };
  $("#rrReveal").onclick = () => {
    stopRhythm(); clearMarks();
    st = { ...st, phase: "revealed", done: st.done + 1 };
    if (st.done % PER_UNIT === 0) { st.units += 1; api.addUnit(1); api.toast(`${PER_UNIT}문제 완료 · 이번 세션 ${st.units}회`); }
    persist(); draw(); run(true);
  };
  $("#rrNext").onclick = () => {
    stopRhythm(); clearMarks();
    st = { ...st, no: st.no + 1, phase: "prompt", cur: plain(R.readingPrompt(s0.topics, Math.random, st.cur.tokens.join(""))) };
    persist(); draw(); $("#rrState").textContent = "";
  };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: clampBpm(st.bpm + Number(b.dataset.bpm)) };
    setSetting("rhr.bpm", st.bpm); setRhythmBpm(st.bpm); $("#rrBpm").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (!running()) { stopRhythm(); } }, 400);
  draw(); persist();
  return () => { clearInterval(watch); stopRhythm(); };
}
