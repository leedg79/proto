// 코드 전환하며 익히기: 반주가 진행을 따라가는 동안 마디마다 그 코드에 쓰는 스케일을 고른 구간에서 연주
// 표시: 전체(스케일 + 코드톤 주황) / 코드톤만 / 이름만. 코드가 바뀌는 첫 박에 코드톤(주황)으로 착지하는 것이 목표
// 진행 2바퀴 = 완료 1회

import { CS_PROGS, chordScalePlan, scaleNameOf } from "./chordscale-core.js";
import { placeIn, regionRange, REGIONS } from "./drill-core.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { keyName } from "../../theory/scales.js";
import { TUNING } from "../../theory/notes.js";
import { startBacking, stopBacking, setBackingBpm, isBackingRunning, setPartLevel } from "../../audio/backing-player.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, makeStore, pickKey } from "./common.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = makeStore("fretlab:cs1");
export const clearFinder = () => store.clear();
const HINTS = [["all", "스케일 전체"], ["tones", "코드톤만"], ["hide", "이름만"]];
const DEG = ["R", "♭9", "9", "♭3", "3", "11", "♭5", "5", "♭13", "13", "♭7", "7"];

export function settingsHtml() {
  return `
    <div class="field"><label>키(단조 진행은 이 음이 단조 으뜸음)</label>${keyPickerHtml("csKey", "cs.key")}</div>
    <div class="field" style="margin-top:14px"><label>연습 구간</label>${segHtml("csRegion", REGIONS.filter(r => r[0] !== "random"), getSetting("cs.region", "5-9"))}</div>
    <div class="field" style="margin-top:14px"><label>표시</label>${segHtml("csHint", HINTS, getSetting("cs.hint", "all"))}</div>
    <p class="muted small" style="margin:4px 0 0">반주에 맞춰 마디마다 그 코드에 쓰는 스케일을 고른 구간 안에서 연주. 코드가 바뀌는 첫 박에 코드톤(주황·초록)으로 착지하기. 진행 2바퀴 = 완료 1회</p>`;
}
export function bindSettings(root) { ["csKey", "csRegion", "csHint"].forEach(id => bindPicker(root, id)); }
export function readSettings(root) {
  const key = Number(readSel(root, "csKey"));
  const region = readSel(root, "csRegion", "v") || "5-9";
  const hint = readSel(root, "csHint", "v") || "all";
  setSetting("cs.key", key); setSetting("cs.region", region); setSetting("cs.hint", hint);
  return { key, region, hint };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const level = s0.level;
  const ids = (s0.topics || []).filter(t => CS_PROGS[level] && CS_PROGS[level][t]);
  const list = ids.length ? ids : Object.keys(CS_PROGS[level] || CS_PROGS.pb);
  let st = store.load(s0.id) || { n: 0, units: 0, bpm: 80, key: pickKey(o.key ?? -1), hint: o.hint || "all" };
  const region = regionRange(o.region || "5-9");
  let plan = chordScalePlan(level, list[st.n % list.length], st.key);
  let bar = 0, loops = 0, playing = false;

  container.innerHTML = `
    <div class="nf cs">
      <div class="nf-meta"><span id="csTitle"></span><span id="csProg"></span></div>
      <div class="jam-chart" id="csChart"></div>
      <div class="sp-prompt"><b id="csChord"></b><span id="csScale"></span></div>
      <div class="fretboard sb-board" id="csBoard"></div>
      <div class="muted small" id="csNext"></div>
      <p class="muted small" id="csTip"></p>
      <div class="seg wide-seg" id="csHintLive">${HINTS.map(([v, n]) => `<button type="button" data-v="${v}" class="${v === st.hint ? "sel" : ""}">${n}</button>`).join("")}</div>
      <div class="jam-state muted small" id="csState">정지</div>
      <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="csPlay" type="button" data-autostart>반주 시작</button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button>
        <div class="bpm-val"><b id="csBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="5">+5</button>
      </div></div>
      <p class="muted small nf-foot">초록 = 코드 근음, 주황 = 코드톤(3·5·7음), 흰색 = 나머지 스케일 음. 숫자는 지금 코드 근음 기준 도수</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function board(b) {
    const blk = placeIn(b.scaleRoot, b.scaleId, region);
    const marks = blk.notes.map(n => {
      const pc = (TUNING[n.s - 1] + n.f) % 12;
      const isRoot = pc === b.rootPc, isTone = b.tones.has(pc);
      return { s: n.s, f: n.f, label: DEG[(pc - b.rootPc + 12) % 12], kind: isRoot ? "root" : isTone ? "changed" : "note", tone: isTone };
    }).filter(m => st.hint === "all" || (st.hint === "tones" && m.tone));
    let from = Math.max(0, region.lo - 1); if (from <= 1) from = 0;
    return scaleBoardSvg(st.hint === "hide" ? [] : marks, { from, to: Math.max(from + 5, region.hi + 1) });
  }
  function draw() {
    const b = plan.bars[bar], nb = plan.bars[(bar + 1) % plan.bars.length];
    $("#csTitle").textContent = `${plan.name} · ${keyName(st.key, "major")}`;
    $("#csProg").textContent = `${loops}/2바퀴 · 완료 ${st.units}회`;
    $("#csChart").innerHTML = plan.bars.map((x, i) => `<div class="jam-bar ${i === bar && playing ? "now" : ""}"><small>${i + 1}</small><b>${esc(x.name)}</b></div>`).join("");
    $("#csChord").textContent = b.name;
    $("#csScale").textContent = `${keyName(b.scaleRoot, b.scaleId)} ${scaleNameOf(b.scaleId)} · ${region.label}`;
    $("#csBoard").innerHTML = board(b);
    $("#csNext").textContent = `다음: ${nb.name} → ${keyName(nb.scaleRoot, nb.scaleId)} ${scaleNameOf(nb.scaleId)}`;
    $("#csTip").textContent = plan.tip;
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
    $("#csPlay").textContent = "음원 불러오는 중…";
    try {
      await startBacking({
        prog: plan.prog, key: st.key, bpm: st.bpm,
        onBar: (b, loop) => {
          bar = b;
          if (b === 0 && loop > 0) {
            loops++;
            if (loops >= 2) {
              loops = 0; st = { ...st, units: st.units + 1, n: st.n + 1 }; persist(); api.addUnit(1); api.toast(`2바퀴 완료 · 이번 세션 ${st.units}회`);
              if (list.length > 1) { stop(); plan = chordScalePlan(level, list[st.n % list.length], st.key); draw(); return; }
            }
          }
          $("#csState").textContent = `${b + 1}마디`;
          draw();
        },
        onBeat: (bb, counting, left) => { if (counting) $("#csState").textContent = `준비 ${left}`; }
      });
      setPartLevel("comp", 0.5);
      playing = true; $("#csPlay").textContent = "멈춤"; draw();
    } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#csPlay").textContent = "반주 시작"; }
  }
  function stop() { stopBacking(); playing = false; bar = 0; $("#csPlay").textContent = "반주 시작"; $("#csState").textContent = "정지"; draw(); }
  $("#csPlay").onclick = () => (isBackingRunning() ? stop() : play());
  $("#csHintLive").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; st = { ...st, hint: b.dataset.v }; persist(); container.querySelectorAll("#csHintLive button").forEach(x => x.classList.toggle("sel", x === b)); draw(); };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: Math.max(40, Math.min(200, st.bpm + Number(b.dataset.bpm))) }; persist(); setBackingBpm(st.bpm); $("#csBpm").textContent = st.bpm;
  });
  const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
  draw();
  return () => { clearInterval(watch); stopBacking(); };
}
