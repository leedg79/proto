// 백킹 트랙: 진행·키·스타일·템포를 골라 반복 재생(기록 없음). 연주 중 지금 마디·코드 표시
import { PROGRESSIONS, STYLES, buildBacking } from "../../audio/backing.js";
import { startBacking, stopBacking, setBackingBpm, setPartLevel, isBackingRunning, PART_NAMES } from "../../audio/backing-player.js";
import { KEY_LIST, keyName } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderJam(root, { toast }) {
  let prog = getSetting("jam.prog", "blues12");
  if (!PROGRESSIONS[prog]) prog = "blues12";
  let key = getSetting("jam.key", 9), style = getSetting("jam.style", PROGRESSIONS[prog].style), bpm = getSetting("jam.bpm", 90);
  const levels = getSetting("jam.levels", { drums: 0.7, bass: 0.9, comp: 0.6 });
  let curBar = -1, loading = false;
  const preview = () => buildBacking({ prog, key, style }, () => 0.5);

  root.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">진행</h3>
      <div class="seg wide-seg jam-prog" id="jamProg">${Object.entries(PROGRESSIONS).map(([id, p]) => `<button type="button" data-v="${id}" class="${id === prog ? "sel" : ""}">${esc(p.name)}</button>`).join("")}</div>
      <h3 class="panel-title" style="margin-top:14px">키</h3>
      <div class="root-grid key7" id="jamKey">${KEY_LIST.map(pc => `<button type="button" data-key="${pc}" class="${pc === key ? "sel" : ""}">${esc(keyName(pc, "major"))}</button>`).join("")}</div>
      <h3 class="panel-title" style="margin-top:14px">스타일</h3>
      <div class="seg wide-seg" id="jamStyle">${Object.entries(STYLES).map(([id, n]) => `<button type="button" data-v="${id}" class="${id === style ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>
    </div>
    <div class="panel">
      <div class="jam-chart" id="jamChart"></div>
      <div class="beats bf-beats" id="jamBeats">${[0, 1, 2, 3].map(i => `<span class="beat ${i === 0 ? "accent" : ""}"></span>`).join("")}</div>
      <div class="jam-state muted small" id="jamState">정지</div>
      <div class="ctl-dock">
      <button class="btn primary wide" id="jamPlay" type="button" style="margin-top:10px">재생</button>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
        <div class="bpm-val"><b id="jamBpm">${bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
      </div></div>
      </div>
    </div>
    <div class="panel">
      <h3 class="panel-title">파트 음량</h3>
      ${Object.entries(PART_NAMES).map(([id, n]) => `<div class="field jam-level"><label for="jl-${id}">${n}</label><input id="jl-${id}" data-part="${id}" type="range" min="0" max="1" step="0.05" value="${levels[id] ?? 0.8}"></div>`).join("")}
      <p class="muted small" style="margin:6px 0 0">기록하지 않는 연습 도구. 시작 전 4박 준비 클릭. 악기 음원: FluidR3 GM 사운드폰트(Frank Wen), 드럼은 합성음</p>
    </div>`;
  const $ = s => root.querySelector(s);
  function chart() {
    const song = preview();
    $("#jamChart").innerHTML = song.bars.map((b, i) => `<div class="jam-bar ${i === curBar ? "now" : ""}"><small>${i + 1}</small><b>${esc(b.name)}</b></div>`).join("");
  }
  async function restartIfPlaying() { if (isBackingRunning()) await play(); }
  async function play() {
    if (loading) return;
    loading = true; $("#jamPlay").textContent = "음원 불러오는 중…";
    try {
      await startBacking({
        prog, key, style, bpm,
        onBar: bar => { curBar = bar; chart(); $("#jamState").textContent = `${bar + 1}마디 · ${preview().bars[bar].name}`; },
        onBeat: (b, counting, left) => {
          root.querySelectorAll("#jamBeats .beat").forEach((x, i) => x.classList.toggle("on", i === b));
          if (counting) $("#jamState").textContent = `준비 ${left}`;
        }
      });
      for (const [p, v] of Object.entries(levels)) setPartLevel(p, v);
      $("#jamPlay").textContent = "정지";
    } catch (e) { toast("소리를 켤 수 없음: " + e.message); $("#jamPlay").textContent = "재생"; }
    loading = false;
  }
  function stop() { stopBacking(); curBar = -1; chart(); $("#jamPlay").textContent = "재생"; $("#jamState").textContent = "정지"; root.querySelectorAll("#jamBeats .beat").forEach(x => x.classList.remove("on")); }
  root.addEventListener("click", async e => {
    const pb = e.target.closest("#jamProg [data-v]");
    if (pb) { prog = pb.dataset.v; style = PROGRESSIONS[prog].style; setSetting("jam.prog", prog); setSetting("jam.style", style);
      root.querySelectorAll("#jamProg button").forEach(x => x.classList.toggle("sel", x === pb));
      root.querySelectorAll("#jamStyle button").forEach(x => x.classList.toggle("sel", x.dataset.v === style));
      curBar = -1; chart(); await restartIfPlaying(); return; }
    const kb = e.target.closest("#jamKey [data-key]");
    if (kb) { key = Number(kb.dataset.key); setSetting("jam.key", key); root.querySelectorAll("#jamKey button").forEach(x => x.classList.toggle("sel", x === kb)); chart(); await restartIfPlaying(); return; }
    const sb = e.target.closest("#jamStyle [data-v]");
    if (sb) { style = sb.dataset.v; setSetting("jam.style", style); root.querySelectorAll("#jamStyle button").forEach(x => x.classList.toggle("sel", x === sb)); await restartIfPlaying(); return; }
    const bb = e.target.closest("[data-bpm]");
    if (bb) { bpm = Math.min(220, Math.max(40, bpm + Number(bb.dataset.bpm))); setSetting("jam.bpm", bpm); $("#jamBpm").textContent = bpm; setBackingBpm(bpm); return; }
    if (e.target.id === "jamPlay") { if (isBackingRunning()) stop(); else await play(); }
  });
  root.addEventListener("input", e => {
    const r = e.target.closest("[data-part]"); if (!r) return;
    levels[r.dataset.part] = Number(r.value); setSetting("jam.levels", levels); setPartLevel(r.dataset.part, Number(r.value));
  });
  chart();
  return () => stopBacking();
}
