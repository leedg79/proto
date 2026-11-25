// Chord Dictionary: 근음·코드 종류를 고르면 가능한 운지를 보이싱 종류별로 모두 표시 (세션 기록 없음)

import { CHORD_TYPES, TYPE_ORDER, ROOT_NAMES, chordName, toneNames } from "../../theory/chords.js";
import { allVoicings, rankVoicings } from "../../theory/voicings.js";
import { chordGrid } from "../../render/chordbox.js";
import { getSetting, setSetting } from "../../core/storage.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const LEVEL_DEFAULT_TYPE = { c1: "maj", c2: "m", c3: "maj7", c4: "7", c5: "7" };

export function renderDictionary(container, { level }) {
  let rootPc = getSetting("dict.root", 0);
  let type = getSetting("dict.type." + level, LEVEL_DEFAULT_TYPE[level] || "maj");
  if (!CHORD_TYPES[type]) type = "maj";

  container.innerHTML = `
    <div class="panel span-all">
      <h3 class="panel-title">근음</h3>
      <div class="root-grid" id="dRoots">${ROOT_NAMES.map((n, pc) => `<button type="button" data-pc="${pc}">${esc(n.join("/"))}</button>`).join("")}</div>
      <h3 class="panel-title" style="margin-top:14px">코드 종류</h3>
      <div class="type-grid" id="dTypes">${TYPE_ORDER.map(id => [id, CHORD_TYPES[id]]).map(([id, t]) => `<button type="button" data-type="${esc(id)}"><b>${esc(t.suffix || "M")}</b><span>${esc(t.name)}</span></button>`).join("")}</div>
    </div>
    <div class="span-all" id="dResult"></div>`;

  const draw = () => {
    container.querySelectorAll("#dRoots button").forEach(b => b.classList.toggle("sel", Number(b.dataset.pc) === rootPc));
    container.querySelectorAll("#dTypes button").forEach(b => b.classList.toggle("sel", b.dataset.type === type));
    const label = ROOT_NAMES[rootPc][0];
    const all = allVoicings(rootPc, type).flatMap(g => g.list);
    const top = rankVoicings(all, { limit: 8 }).map(v => ({ ...v, detail: `${v.kind} · ${v.detail}` }));
    container.querySelector("#dResult").innerHTML = `
      <div class="panel">
        <div class="dict-head"><h2>${esc(chordName(label, type))}</h2><span class="muted small">구성음 ${esc(toneNames(rootPc, type, label).join(" · "))}</span></div>
        <p class="muted small" style="margin:6px 0 12px">자주 쓰는 운지 ${top.length}개 · 왼쪽 위부터 많이 쓰는 순</p>
        ${chordGrid(top)}
      </div>`;
  };

  container.querySelector("#dRoots").onclick = e => {
    const b = e.target.closest("[data-pc]"); if (!b) return;
    rootPc = Number(b.dataset.pc); setSetting("dict.root", rootPc); draw();
  };
  container.querySelector("#dTypes").onclick = e => {
    const b = e.target.closest("[data-type]"); if (!b) return;
    type = b.dataset.type; setSetting("dict.type." + level, type); draw();
  };
  draw();
}
