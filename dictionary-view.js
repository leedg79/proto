// Chord Dictionary: 근음 → 구성 시스템(레벨에 속한 것, 복수 선택) → 코드 종류 → 결과
// 시스템별로 묶고, 하위 구분(전위·현 그룹·폼)이 있으면 구분별로 나눠 표시. 세션 기록 없음

import { CHORD_TYPES, TYPE_ORDER, ROOT_NAMES, chordName, toneNames } from "../../theory/chords.js";
import * as V from "../../theory/voicings.js";
import { chordGrid } from "../../render/chordbox.js";
import { getSetting, setSetting } from "../../core/storage.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setText = set => [...set].sort((a, b) => a - b).join("-") + "번 현";
const INV = ["기본형", "1전위", "2전위", "3전위"];
const SEVENTHS = ["maj7", "7", "m7", "m7b5", "dim7"];
const rank = (list, n = 8) => V.rankVoicings(list, { limit: n });

// 구성 시스템: 이름, 만들 수 있는 코드 종류, 결과 묶음(근음·종류 → [{ title, list }])
const SYSTEMS = {
  open: { name: "오픈 코드", types: ["maj", "m", "7", "m7"], groups: (r, t) => [{ title: "", list: V.openVoicingsOf(r, t) }] },
  triad: { name: "트라이어드(밀집)", types: ["maj", "m"], groups: (r, t) => [{ title: "", list: rank(V.closeTriads(r, t)) }] },
  power: { name: "파워 코드", types: ["5"], groups: r => [{ title: "", list: V.powerVoicings(r) }] },
  barre: { name: "바레·이동형", types: ["maj", "m", "7", "m7", "maj7", "m7b5"], groups: (r, t) => [{ title: "", list: V.barreVoicings(r, t) }] },
  "dim-aug-sus": { name: "디미니시드·어그먼티드·서스펜디드", types: ["dim", "aug", "sus2", "sus4"], groups: (r, t) => [{ title: "", list: rank(V.closeTriads(r, t)) }] },
  "triad-inversion": { name: "트라이어드 전위", types: ["maj", "m", "dim", "aug", "sus2", "sus4"], groups: (r, t) => [0, 1, 2].map(k => ({ title: INV[k], list: rank(V.closeTriads(r, t, { inversions: [k] }), 4) })) },
  "string-set-triad": { name: "현 그룹별 트라이어드", types: ["maj", "m", "dim", "aug", "sus2", "sus4"], groups: (r, t) => V.TRIAD_SETS.map(s => ({ title: setText(s), list: rank(V.closeTriads(r, t, { sets: [s] }), 3) })) },
  caged: { name: "CAGED", types: ["maj"], groups: r => Object.keys(V.CAGED_FORMS).map(f => ({ title: `${f}폼`, list: V.cagedVoicings(r, f) })) },
  seventh: { name: "7th 코드(기본형)", types: SEVENTHS, groups: (r, t) => [{ title: "", list: rank([...V.barreVoicings(r, t), ...V.dropVoicings(r, t, { drop: 2, inversions: [0] }), ...V.dropVoicings(r, t, { drop: 3, inversions: [0] })]) }] },
  "seventh-inversion": { name: "7th 코드 전위", types: SEVENTHS, groups: (r, t) => [0, 1, 2, 3].map(k => ({ title: INV[k], list: rank([...V.dropVoicings(r, t, { drop: 2, inversions: [k] }), ...V.dropVoicings(r, t, { drop: 3, inversions: [k] })], 4) })) },
  shell: { name: "Shell Voicing", types: ["maj7", "7", "m7", "m7b5"], groups: (r, t) => [{ title: "", list: rank(V.shellVoicings(r, t)) }] },
  drop2: { name: "Drop 2", types: SEVENTHS, groups: (r, t) => V.DROP2_SETS.map(s => ({ title: setText(s), list: rank(V.dropVoicings(r, t, { drop: 2, sets: [s] }), 4) })) },
  drop3: { name: "Drop 3", types: SEVENTHS, groups: (r, t) => V.DROP3_SETS.map(s => ({ title: setText(s), list: rank(V.dropVoicings(r, t, { drop: 3, sets: [s] }), 4) })) },
  tension: { name: "텐션", types: V.TENSION_TYPES, groups: (r, t) => [{ title: "", list: rank(V.tensionVoicings(r, t)) }] },
  slash: { name: "슬래시 코드", types: ["maj", "m"], groups: (r, t, label) => [[CHORD_TYPES[t].intervals[1], "3도"], [7, "5도"], [10, "♭7"], [2, "2도"]].map(([iv, n]) => ({ title: `/${n} 베이스`, list: rank(V.slashVoicings(r, t, (r + iv) % 12), 3) })) },
  "open-voicing": { name: "Open Voicing", types: ["maj", "m"], groups: (r, t) => [{ title: "", list: rank(V.spreadTriads(r, t)) }] },
  quartal: { name: "Quartal(4도 쌓기)", types: null, groups: r => [3, 4].map(n => ({ title: `${n}음`, list: rank(V.quartalVoicings(r, n), 4) })) }
};

// 레벨별 구성 시스템 (학습 주제 중 운지 모양에 해당하는 것)
const LEVEL_SYSTEMS = {
  c1: ["open", "triad", "power"],
  c2: ["barre", "dim-aug-sus", "triad-inversion", "string-set-triad", "caged", "seventh"],
  c3: ["seventh-inversion", "shell", "drop2", "drop3", "tension"],
  c4: ["slash", "open-voicing", "quartal"]
};
// C5(응용)는 운지 모양 주제가 없으므로 C1~C4 시스템 전체
LEVEL_SYSTEMS.c5 = [...LEVEL_SYSTEMS.c1, ...LEVEL_SYSTEMS.c2, ...LEVEL_SYSTEMS.c3, ...LEVEL_SYSTEMS.c4];

export function renderDictionary(container, { level }) {
  const systems = LEVEL_SYSTEMS[level] || LEVEL_SYSTEMS.c1;
  let rootPc = getSetting("dict.root", 0);
  let chosen = (getSetting("dict.sys." + level, null) || [systems[0]]).filter(s => systems.includes(s));
  if (!chosen.length) chosen = [systems[0]];
  let type = getSetting("dict.type." + level, null);

  const typesFor = list => {
    const set = new Set();
    for (const s of list) (SYSTEMS[s].types || []).forEach(t => set.add(t));
    return TYPE_ORDER.filter(t => set.has(t));
  };

  container.innerHTML = `
    <div class="panel span-all">
      <h3 class="panel-title">근음</h3>
      <div class="root-grid" id="dRoots">${ROOT_NAMES.map((n, pc) => `<button type="button" data-pc="${pc}">${esc(n.join("/"))}</button>`).join("")}</div>
      <div class="topic-head" style="margin-top:14px"><h3 class="panel-title">구성 시스템 · 여러 개 선택 가능</h3></div>
      <div class="topic-list" id="dSys">${systems.map(s => `<label class="topic"><input type="checkbox" value="${s}" ${chosen.includes(s) ? "checked" : ""}><span>${esc(SYSTEMS[s].name)}</span></label>`).join("")}</div>
      <h3 class="panel-title" style="margin-top:14px">코드 종류</h3>
      <div class="type-grid" id="dTypes"></div>
    </div>
    <div class="span-all" id="dResult"></div>`;

  const $ = sel => container.querySelector(sel);

  const draw = () => {
    const types = typesFor(chosen);
    const onlyQuartal = chosen.every(s => !SYSTEMS[s].types);
    if (!onlyQuartal && !types.includes(type)) type = types[0];
    container.querySelectorAll("#dRoots button").forEach(b => b.classList.toggle("sel", Number(b.dataset.pc) === rootPc));
    $("#dTypes").innerHTML = onlyQuartal
      ? `<p class="muted small" style="margin:0">4도 쌓기는 근음만 고르면 됨</p>`
      : types.map(id => `<button type="button" data-type="${esc(id)}" class="${id === type ? "sel" : ""}"><b>${esc(CHORD_TYPES[id].suffix || "M")}</b><span>${esc(CHORD_TYPES[id].name)}</span></button>`).join("");

    const label = ROOT_NAMES[rootPc][0];
    const sections = chosen.map(sid => {
      const sys = SYSTEMS[sid];
      if (sys.types && !sys.types.includes(type)) {
        return `<div class="dict-sys"><div class="section-title">${esc(sys.name)}</div><p class="muted small">이 시스템에는 ${esc(chordName(label, type))} 운지가 없음(가능: ${esc(sys.types.map(t => chordName(label, t)).join(", "))})</p></div>`;
      }
      const groups = sys.groups(rootPc, type || "maj", label).filter(g => g.list.length);
      const count = groups.reduce((a, g) => a + g.list.length, 0);
      if (!count) return `<div class="dict-sys"><div class="section-title">${esc(sys.name)}</div><p class="muted small">0~15프렛 안에서 잡을 수 있는 운지가 없음</p></div>`;
      return `<div class="dict-sys"><div class="section-title">${esc(sys.name)} · ${count}</div>
        ${groups.map(g => `${g.title ? `<div class="dict-sub">${esc(g.title)}</div>` : ""}${chordGrid(g.list)}`).join("")}</div>`;
    }).join("");
    const head = onlyQuartal ? `${label} 4도 쌓기` : chordName(label, type);
    const tones = onlyQuartal ? "" : `구성음 ${toneNames(rootPc, type, label).join(" · ")}`;
    $("#dResult").innerHTML = `
      <div class="panel">
        <div class="dict-head"><h2>${esc(head)}</h2><span class="muted small">${esc(tones)}</span></div>
        <p class="muted small" style="margin:6px 0 4px">묶음마다 자주 쓰는 운지부터 표시</p>
        ${sections}
      </div>`;
  };

  $("#dRoots").onclick = e => {
    const b = e.target.closest("[data-pc]"); if (!b) return;
    rootPc = Number(b.dataset.pc); setSetting("dict.root", rootPc); draw();
  };
  $("#dSys").addEventListener("change", () => {
    const next = [...container.querySelectorAll("#dSys input:checked")].map(i => i.value);
    if (!next.length) { container.querySelector(`#dSys input[value="${chosen[0]}"]`).checked = true; return; }
    chosen = next; setSetting("dict.sys." + level, chosen); draw();
  });
  $("#dTypes").onclick = e => {
    const b = e.target.closest("[data-type]"); if (!b) return;
    type = b.dataset.type; setSetting("dict.type." + level, type); draw();
  };
  draw();
}

// 테스트용
export const _SYSTEMS = SYSTEMS;
export const _LEVEL_SYSTEMS = LEVEL_SYSTEMS;
