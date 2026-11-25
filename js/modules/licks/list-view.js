// 릭 목록·표시(기록 없음): 하위 분류별 목록, 눌러서 펼쳐 보기, 좋음/삭제 후보 표시, 표시 목록 복사
import { licksFor, LICKS, USE_NAMES, realize } from "./lick-core.js";
import { LICK_LEVELS } from "../../data/catalog.js";
import { lickCardHtml, bindPlayButtons, paintScores } from "./lick-card.js";
import { getFlags, setFlag, flagsText, copyText, clearFlags } from "./lick-flags.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderLickList(root, { level, toast, ask }) {
  bindPlayButtons(root, id => LICKS.find(l => l.id === id), () => 80);
  const lv = LICK_LEVELS.find(l => l.id === level);
  let sub = "all", open = null, flagFilter = "all";
  function draw() {
    const flags = getFlags();
    const all = Object.values(flags);
    const items = licksFor(level, sub === "all" ? null : [sub]).filter(l => flagFilter === "all" || (flagFilter === "none" ? !flags[l.id] : flags[l.id] === flagFilter));
    root.innerHTML = `
      <div class="panel">
        <div class="lk-summary">전체 ${LICKS.length}개 중 표시: 좋음 <b>${all.filter(v => v === "good").length}</b> · 삭제 후보 <b>${all.filter(v => v === "del").length}</b></div>
        <div class="btn-row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn primary small" id="lkCopy" type="button">표시 목록 복사(전체 레벨)</button>
          <button class="btn small ghost" id="lkClear" type="button">표시 모두 지우기</button>
        </div>
        <p class="muted small" style="margin:8px 0 0">복사한 글을 채팅에 붙여 보내면 다음 버전에서 삭제 후보를 지우고, 좋음과 비슷한 릭을 더 만들 수 있음</p>
        <textarea class="hidden lk-copybox" id="lkBox" readonly></textarea>
      </div>
      <div class="panel">
        <div class="seg wide-seg lk-subs">${[["all", "전체"], ...lv.subs].map(([id, n]) => `<button type="button" data-sub="${id}" class="${sub === id ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>
        <div class="seg wide-seg lk-subs" style="margin-top:8px">${[["all", "표시 전체"], ["good", "좋음"], ["del", "삭제 후보"], ["none", "표시 없음"]].map(([id, n]) => `<button type="button" data-ff="${id}" class="${flagFilter === id ? "sel" : ""}">${n}</button>`).join("")}</div>
        <div class="lk-list">${items.map(l => {
          const r = realize(l);
          const f = flags[l.id] || "";
          return `<div class="lk-row ${f}" data-open="${l.id}">
            <div class="lk-row-main"><b>${esc(l.id)}</b><span>${esc(r.title)}</span><small>${esc(USE_NAMES[l.use])} · ${esc(r.blockName)} · 난이도 ${r.difficulty}</small></div>
            <div class="lk-row-flags"><button type="button" class="flag-btn good ${f === "good" ? "on" : ""}" data-flag="good" data-id="${l.id}">좋음</button><button type="button" class="flag-btn del ${f === "del" ? "on" : ""}" data-flag="del" data-id="${l.id}">삭제</button></div>
          </div>${open === l.id ? `<div class="lk-open">${lickCardHtml(l)}</div>` : ""}`;
        }).join("") || `<p class="muted">해당하는 릭이 없음</p>`}</div>
      </div>`;
    paintScores(root, id => LICKS.find(l => l.id === id));
  }
  root.onclick = async e => {
    if (e.target.closest("[data-play]")) return;
    const fb = e.target.closest("[data-flag]");
    if (fb) { setFlag(fb.dataset.id, fb.dataset.flag); draw(); return; }
    const sb = e.target.closest("[data-sub]"); if (sb) { sub = sb.dataset.sub; open = null; draw(); return; }
    const ff = e.target.closest("[data-ff]"); if (ff) { flagFilter = ff.dataset.ff; draw(); return; }
    if (e.target.id === "lkCopy") {
      const text = flagsText();
      const ok = await copyText(text);
      if (ok) toast("표시 목록을 복사했음");
      else { const box = root.querySelector("#lkBox"); box.value = text; box.classList.remove("hidden"); box.select(); toast("복사가 안 되면 아래 글을 길게 눌러 복사"); }
      return;
    }
    if (e.target.id === "lkClear") {
      const k = await ask("표시 지우기", "<p>모든 릭의 좋음·삭제 후보 표시를 지움. 되돌릴 수 없음</p>", [{ key: "ok", label: "지우기", kind: "danger" }, { key: "no", label: "취소" }]);
      if (k === "ok") { clearFlags(); draw(); }
      return;
    }
    const row = e.target.closest("[data-open]");
    if (row) { open = open === row.dataset.open ? null : row.dataset.open; draw(); }
  };
  draw();
}
