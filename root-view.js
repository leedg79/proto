// Block + Root Memorization 화면: 여러 블록을 이어 한 번에 표시하고 근음 위치를 익힘(박자 강조 없음)
// 12개 키를 차례로 확인하면 완료 1회

import { blocks, scaleTitle, SCALES, KEY_LIST } from "../../theory/scales.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { makeStore, segHtml, bindPicker, readSel } from "./common.js";

const store = makeStore("fretlab:sbr");
export const clearFinder = () => store.clear();
const MODES = [["all", "전체 음"], ["root", "근음만"], ["quiz", "근음 숨기고 찾기"]];

export function settingsHtml() {
  const sel = getSetting("sbr.blocks", [1, 2]);
  return `
    <div class="field"><label>함께 볼 블록(모드는 포지션) · 여러 개 선택</label>
      <div class="topic-list" id="sbrBlocks">${[1, 2, 3, 4, 5, 6, 7].map(n => `<label class="topic"><input type="checkbox" value="${n}" ${sel.includes(n) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div>
      <p class="muted small" style="margin:6px 0 0">6·7은 Modes(포지션 7개)에서만 쓰임</p>
    </div>
    <div class="field" style="margin-top:14px"><label>처음 보기 방식</label>${segHtml("sbrMode", MODES, getSetting("sbr.mode", "all"))}</div>
    <p class="muted small" style="margin:4px 0 0">12개 키를 차례로(무작위 순서) 보며 블록 연결과 근음 위치를 익힘. 12개 키를 모두 확인하면 완료 1회</p>`;
}
export function bindSettings(root) { bindPicker(root, "sbrMode"); }
export function readSettings(root) {
  let b = [...root.querySelectorAll("#sbrBlocks input:checked")].map(i => Number(i.value));
  if (!b.length) b = [1];
  const mode = readSel(root, "sbrMode", "v");
  setSetting("sbr.blocks", b); setSetting("sbr.mode", mode);
  return { blocks: b, mode };
}

function shuffled(rand = Math.random) {
  const a = [...KEY_LIST];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function mount(container, api) {
  const s0 = api.getActive();
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const o = s0.options || {};
  const scaleOf = n => (scales.length ? scales : ["minor-penta"])[n % Math.max(1, scales.length)];
  let st = store.load(s0.id) || { keys: shuffled(), idx: 0, round: 0, units: 0, mode: o.mode || "all", shown: false };

  container.innerHTML = `
    <div class="nf sb">
      <div class="nf-meta"><span id="sbrTitle"></span><span id="sbrProg"></span></div>
      <div class="cycle-dots" id="sbrDots">${Array.from({ length: 12 }, () => "<i></i>").join("")}</div>
      <div class="sb-state"><span class="muted small" id="sbrInfo"></span></div>
      <div class="fretboard sb-board" id="sbrBoard"></div>
      <div style="margin-top:10px">${segHtml("sbrView", MODES, st.mode)}</div>
      <div class="nf-actions" style="margin-top:12px;display:grid;gap:8px">
        <button class="btn wide hidden" id="sbrShow" type="button">근음 위치 확인</button>
        <button class="btn primary wide" id="sbrNext" type="button">이 키 확인 · 다음 키 →</button>
      </div>
      <p class="muted small nf-foot">박자 강조 없이 블록이 이어지는 모양과 근음 자리를 눈과 손으로 익힘. 다 짚어 본 뒤 다음 키로 넘어감</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function draw() {
    const key = st.keys[st.idx];
    const scaleId = scaleOf(st.round);
    const bs = blocks(key, scaleId);
    const pick = (o.blocks || [1, 2]).filter(n => n <= bs.length);
    const chosen = (pick.length ? pick : [1]).map(n => bs[n - 1]);
    const marks = [];
    const seen = new Set();
    for (const b of chosen) for (const n of b.notes) {
      const k = n.s + "-" + n.f;
      if (seen.has(k) || n.f > 15) continue;
      seen.add(k);
      if (st.mode === "root" && !n.root) continue;
      const hideRoot = st.mode === "quiz" && n.root && !st.shown;
      marks.push({ s: n.s, f: n.f, label: hideRoot ? "" : n.label, kind: n.root ? (hideRoot ? "ghost" : "root") : "note" });
    }
    const lo = Math.min(...chosen.map(b => b.lo)), hi = Math.max(...chosen.map(b => b.hi));
    const from = lo <= 1 ? 0 : lo - 1, to = Math.min(17, Math.max(hi + 1, from + 6));
    $("#sbrBoard").innerHTML = scaleBoardSvg(marks, { from, to });
    $("#sbrTitle").textContent = scaleTitle(key, scaleId);
    $("#sbrProg").textContent = `키 ${st.idx + 1}/12 · 완료 ${st.units}회`;
    $("#sbrInfo").textContent = `${SCALES[scaleId].mode ? "포지션" : "블록"} ${chosen.map(b => b.index).join("+")} · ${lo}~${hi}프렛`;
    container.querySelectorAll("#sbrDots i").forEach((d, i) => d.classList.toggle("on", i < st.idx));
    $("#sbrShow").classList.toggle("hidden", st.mode !== "quiz" || st.shown);
    $("#sbrNext").disabled = !running();
  }
  $("#sbrView").onclick = e => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    container.querySelectorAll("#sbrView button").forEach(x => x.classList.toggle("sel", x === b));
    st = { ...st, mode: b.dataset.v, shown: false }; persist(); draw();
  };
  $("#sbrShow").onclick = () => { st = { ...st, shown: true }; persist(); draw(); };
  $("#sbrNext").onclick = () => {
    if (!running()) return;
    if (st.idx + 1 >= 12) {
      st = { ...st, keys: shuffled(), idx: 0, round: st.round + 1, units: st.units + 1, shown: false };
      api.addUnit(1);
      api.toast(`12개 키 확인 완료 · 이번 세션 ${st.units}회`);
    } else st = { ...st, idx: st.idx + 1, shown: false };
    persist(); draw();
  };
  const watch = setInterval(() => { $("#sbrNext").disabled = !running(); }, 300);
  draw();
  return () => clearInterval(watch);
}
