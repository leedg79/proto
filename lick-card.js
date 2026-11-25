// 릭 한 개 표시: 번호·제목·태그, TAB, 지판(블록 흐리게 + 릭 음 도수), 위치·코드 관계, 표시 버튼
import { realize, overText, USE_NAMES, FEEL_NAMES, TECH_NAMES, scaleNameOf } from "./lick-core.js";
import { LICK_LEVELS } from "../../data/catalog.js";
import { tabSvg } from "../../render/tab.js";
import { scoreSvg } from "../../render/score.js";
import { lickById } from "./lick-core.js";
import { scaleBoardSvg } from "../../render/scaleboard.js";
import { getFlags } from "./lick-flags.js";
import { playLick, stopLick } from "../../audio/lick-player.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SUB_NAME = Object.fromEntries(LICK_LEVELS.flatMap(l => l.subs));

export function lickCardHtml(lick, { key = lick.key, chordLabels = true } = {}) {
  const r = realize(lick, key);
  const flag = getFlags()[r.id] || "";
  const useChord = chordLabels && r.chords.length;
  // 지판: 블록 모양 흐리게 + 릭 음 진하게(도수)
  const lickKeys = new Set(r.notes.map(n => `${n.s}-${n.f}`));
  const marks = [
    ...r.shape.filter(n => !lickKeys.has(`${n.s}-${n.f}`)).map(n => ({ s: n.s, f: n.f, label: "", kind: n.root ? "ghostRoot" : "ghost" })),
    ...[...new Map(r.notes.map(n => [`${n.s}-${n.f}`, n])).values()].map(n => ({ s: n.s, f: n.f, label: useChord ? n.cdeg || n.deg : n.deg, kind: n.deg === "R" ? "root" : "note" }))
  ];
  let from = Math.max(0, Math.min(r.lo, r.blockLo) - 1); if (from <= 1) from = 0;
  const to = Math.max(from + 5, Math.max(r.hi, r.blockHi) + 1);
  const degLine = r.notes.map(n => (n.bendDeg ? `${useChord ? n.cdeg || n.deg : n.deg}↗${n.bendDeg}` : useChord ? n.cdeg || n.deg : n.deg)).join(" ");
  return `
    <div class="lick-card" data-lick="${esc(r.id)}">
      <div class="lick-head">
        <div><b class="lick-id">${esc(r.id)}</b> <span class="lick-title">${esc(r.title)}</span></div>
        <div class="lick-flags">
          <button type="button" class="flag-btn good ${flag === "good" ? "on" : ""}" data-flag="good" data-id="${esc(r.id)}">좋음</button>
          <button type="button" class="flag-btn del ${flag === "del" ? "on" : ""}" data-flag="del" data-id="${esc(r.id)}">삭제 후보</button>
        </div>
      </div>
      <div class="tag-row lick-tags">
        <span class="tag accent">${esc(SUB_NAME[r.sub] || r.sub)}</span>
        <span class="tag">${esc(USE_NAMES[r.use] || r.use)}</span>
        <span class="tag">${esc(FEEL_NAMES[r.feel] || r.feel)}</span>
        <span class="tag">난이도 ${"●".repeat(r.difficulty)}${"○".repeat(3 - r.difficulty)}</span>
        ${r.techs.map(t => `<span class="tag">${esc(TECH_NAMES[t])}</span>`).join("")}
      </div>
      <div class="lick-play-row"><button type="button" class="btn small primary" data-play="${esc(r.id)}" data-key="${r.key}">▶ 듣기</button><span class="muted small">벤딩·슬라이드·비브라토 포함 샘플 재생</span></div>
      <div class="tab-wrap score-wrap" data-tab="${esc(r.id)}" data-score="${esc(r.id)}" data-key="${r.key}"></div>
      <div class="fretboard">${scaleBoardSvg(marks, { from, to })}</div>
      <dl class="lick-info">
        <dt>위치</dt><dd>${esc(r.blockName)} (${r.blockLo}~${r.blockHi}프렛)${r.rootString ? ` · 근음 ${r.rootString}번 줄 ${r.rootFret}프렛` : ""}</dd>
        <dt>코드</dt><dd>${esc(overText(r))}</dd>
        <dt>스케일</dt><dd>${esc(scaleNameOf(r.scale))}${r.chords.length ? ` · ${r.chords.map(c => `${c.name}: ${scaleNameOf(c.scale)}`).join(" / ")}` : ""}</dd>
        <dt>도수</dt><dd class="deg-line">${esc(degLine)}</dd>
        <dt>착지</dt><dd>${esc(r.land)}${useChord ? " (코드 기준)" : ""}</dd>
      </dl>
    </div>`;
}

export function bindFlagButtons(root, onChange) {
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-flag]"); if (!b) return;
    onChange(b.dataset.id, b.dataset.flag);
  });
}

// 악보 그리기: 카드를 화면에 넣은 뒤 호출(오선+TAB, VexFlow가 없으면 간단 TAB)
const FLAT_KEYS = [5, 10, 3, 8, 1, 6];
export function paintScore(el, lick, active = -1) {
  const r = realize(lick, Number(el.dataset.key));
  const ok = scoreSvg(el, r.events, { chords: r.chords, ticks: r.ticks, flats: FLAT_KEYS.includes(r.key), active });
  if (!ok) el.innerHTML = tabSvg(r.events, { chords: r.chords, ticks: r.ticks, active });
}
export function paintScores(root, lickOf = lickById) {
  root.querySelectorAll("[data-score]").forEach(el => { const l = lickOf(el.dataset.score); if (l) paintScore(el, l); });
}

// 듣기 버튼: 누르면 재생(TAB에서 지금 음 강조), 다시 누르면 멈춤. getBpm: 템포
export function bindPlayButtons(root, lickOf, getBpm = () => 80) {
  let cur = null;
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-play]"); if (!b) return;
    if (cur === b) { stopLick(); b.textContent = "▶ 듣기"; cur = null; return; }
    if (cur) cur.textContent = "▶ 듣기";
    cur = b; b.textContent = "■ 멈춤";
    const r = realize(lickOf(b.dataset.play), Number(b.dataset.key));
    const tab = root.querySelector(`[data-tab="${b.dataset.play}"]`);
    try {
      await playLick(r, getBpm(), {
        onEvent: i => {
          if (tab) paintScore(tab, lickOf(b.dataset.play), i);
          if (i === -1 && cur === b) { b.textContent = "▶ 듣기"; cur = null; }
        }
      });
    } catch (err) { b.textContent = "▶ 듣기"; cur = null; }
  });
  return () => stopLick();
}
