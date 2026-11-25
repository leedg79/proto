// 장르별 컴핑(C5): 드럼·베이스 반주 위에 장르 리듬으로 코드 치기
// 화면: 코드표(지금 마디), 지금·다음 운지, 16칸 리듬표(↓ ↑ x, 강세), "시범 코드 소리" 켜기·끄기
// 진행 2바퀴 = 완료 1회

import { GENRES, compVoicings } from "./comping-core.js";
import { startBacking, stopBacking, setBackingBpm, isBackingRunning, setPartLevel } from "../../audio/backing-player.js";
import { chordBoxSvg } from "../../render/chordbox.js";
import { KEY_LIST, keyName } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { segHtml, bindPicker, readSel, keyPickerHtml, makeStore, pickKey } from "../scales/common.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = makeStore("fretlab:cmp1");
export const clearFinder = () => store.clear();

export function settingsHtml() {
  const bpm = getSetting("cmp.bpm", 80);
  return `
    <div class="field"><label>키</label>${keyPickerHtml("cmpKey", "cmp.key")}</div>
    <div class="field" style="margin-top:14px">
      <label for="cmpBpm">BPM <b id="cmpBpmOut">${bpm}</b></label>
      <input id="cmpBpm" type="range" min="50" max="160" step="1" value="${bpm}">
    </div>
    <p class="muted small" style="margin:4px 0 0">장르마다 정해진 진행 위에서 드럼·베이스가 나오고, 리듬표대로 코드를 침. "시범 코드"를 켜면 앱이 먼저 쳐 줌. 진행 2바퀴 = 완료 1회. 주제를 여러 개 고르면 완료할 때마다 다음 장르</p>`;
}
export function bindSettings(root) {
  bindPicker(root, "cmpKey");
  const r = root.querySelector("#cmpBpm");
  r.oninput = () => { root.querySelector("#cmpBpmOut").textContent = r.value; };
}
export function readSettings(root) {
  const key = Number(readSel(root, "cmpKey"));
  const bpm = Math.max(50, Math.min(160, Number(root.querySelector("#cmpBpm").value) || 80));
  setSetting("cmp.key", key); setSetting("cmp.bpm", bpm);
  return { key, bpm };
}

function gridHtml(pattern, step = -1) {
  const cells = [];
  for (let i = 0; i < 16; i++) {
    const b = i / 4;
    const h = pattern.find(x => Math.abs(x.b - b) < 1e-6);
    const mark = !h ? "" : h.mute ? "x" : h.up ? "↑" : "↓";
    cells.push(`<span class="rg-c ${h ? "hit" : ""} ${h && h.acc ? "acc" : ""} ${Math.floor(i / 4) === step ? "now" : ""} ${i % 4 === 0 ? "rg-beat" : ""}">${mark}</span>`);
  }
  const labels = ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"].map((x, i) => `<span class="rg-l ${i % 4 === 0 ? "rg-beat" : ""}">${x}</span>`).join("");
  return `<div class="rgrid">${cells.join("")}</div><div class="rgrid lab">${labels}</div>`;
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const genres = (s0.topics || []).filter(t => GENRES[t]);
  const list = genres.length ? genres : ["blues-shuffle"];
  let st = store.load(s0.id) || { n: 0, units: 0, demo: true, bpm: o.bpm || 80, key: pickKey(o.key ?? -1) };
  let gid = list[st.n % list.length], g = GENRES[gid], plan = compVoicings(gid, st.key);
  let bar = -1, beat = -1, loops = 0, playing = false;

  container.innerHTML = `
    <div class="nf cmp">
      <div class="nf-meta"><span id="cmpTitle"></span><span id="cmpProg"></span></div>
      <div class="jam-chart" id="cmpChart"></div>
      <div class="cmp-now">
        <div><small>지금</small><div id="cmpNow" class="cmp-box"></div></div>
        <div><small>다음</small><div id="cmpNext" class="cmp-box"></div></div>
      </div>
      <div id="cmpGrid"></div>
      <p class="muted small" id="cmpTip"></p>
      <div class="jam-state muted small" id="cmpState">정지</div>
      <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="cmpPlay" type="button" data-autostart>반주 시작</button></div>
      <div class="btn-row" style="gap:8px;margin-top:8px"><button class="btn small" id="cmpDemo" type="button"></button></div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="cmpBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
    </div>`;
  const $ = s => container.querySelector(s);
  const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
  const persist = () => store.save(s0.id, st);

  function draw() {
    $("#cmpTitle").textContent = `${g.name} · ${keyName(st.key, "major")} 키`;
    $("#cmpProg").textContent = `${loops}/2바퀴 · 완료 ${st.units}회`;
    $("#cmpChart").innerHTML = plan.bars.map((b, i) => `<div class="jam-bar ${i === bar ? "now" : ""}"><small>${i + 1}</small><b>${esc(b.name)}</b></div>`).join("");
    const cur = Math.max(0, bar), nxt = (cur + 1) % plan.bars.length;
    const box = (v, name) => (v ? `<figure class="chord-cell" data-midis="${v.notes.map(n => n.midi).join(",")}">${chordBoxSvg(v)}<figcaption>${esc(name)}</figcaption></figure>` : `<div class="muted small">${esc(name)}</div>`);
    $("#cmpNow").innerHTML = box(plan.voicings[cur], plan.bars[cur].name);
    $("#cmpNext").innerHTML = box(plan.voicings[nxt], plan.bars[nxt].name);
    $("#cmpGrid").innerHTML = gridHtml(g.pattern, playing ? beat : -1);
    $("#cmpTip").textContent = g.tip;
    $("#cmpDemo").textContent = st.demo ? "시범 코드 끄기(내가 치기)" : "시범 코드 켜기(앱이 치기)";
  }
  async function play() {
    if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
    $("#cmpPlay").textContent = "음원 불러오는 중…";
    try {
      await startBacking({
        prog: g.prog, key: st.key, style: g.style, bpm: st.bpm, compPattern: g.pattern, compInst: g.compInst,
        voicer: (b, i) => (plan.voicings[i] ? plan.voicings[i].notes.map(n => n.midi) : undefined) || undefined,
        onBar: (b, loop) => {
          bar = b;
          if (b === 0 && loop > 0) {
            loops++;
            if (loops >= 2) { loops = 0; st = { ...st, units: st.units + 1, n: st.n + 1 }; api.addUnit(1); api.toast(`${g.name} 2바퀴 완료 · 이번 세션 ${st.units}회`); persist(); if (list.length > 1) { stop(); switchGenre(); return; } }
          }
          $("#cmpState").textContent = `${b + 1}마디 · ${plan.bars[b].name}`;
          draw();
        },
        onBeat: (b, counting, left) => { beat = counting ? -1 : b; if (counting) $("#cmpState").textContent = `준비 ${left}`; $("#cmpGrid").innerHTML = gridHtml(g.pattern, beat); }
      });
      setPartLevel("comp", st.demo ? 0.6 : 0);
      playing = true; $("#cmpPlay").textContent = "멈춤";
    } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#cmpPlay").textContent = "반주 시작"; }
  }
  function stop() { stopBacking(); playing = false; bar = -1; beat = -1; $("#cmpPlay").textContent = "반주 시작"; $("#cmpState").textContent = "정지"; draw(); }
  function switchGenre() { gid = list[st.n % list.length]; g = GENRES[gid]; plan = compVoicings(gid, st.key); loops = 0; draw(); }
  $("#cmpPlay").onclick = () => (isBackingRunning() ? stop() : play());
  $("#cmpDemo").onclick = () => { st = { ...st, demo: !st.demo }; persist(); setPartLevel("comp", st.demo ? 0.6 : 0); draw(); };
  container.querySelector(".bf-controls").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]"); if (!b) return;
    st = { ...st, bpm: Math.max(50, Math.min(160, st.bpm + Number(b.dataset.bpm))) };
    setSetting("cmp.bpm", st.bpm); setBackingBpm(st.bpm); $("#cmpBpm").textContent = st.bpm; persist();
  });
  const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
  draw();
  return () => { clearInterval(watch); stopBacking(); };
}
