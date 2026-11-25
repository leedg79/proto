// 내 릭 입력·편집: 지판 칸을 눌러 음을 넣고(길이·기법 선택), 악보로 바로 확인·듣기·저장
// 저장한 릭은 L7 My Licks의 릭 익히기·목록에서 기본 릭과 같은 방식으로 쓰임

import { buildLick, validate, LICKS, scaleNameOf, stepsOf, USE_NAMES, FEEL_NAMES } from "./lick-core.js";
import { loadMyLicks, saveMyLick, deleteMyLick, nextMyId } from "./my-licks.js";
import { paintScore, lickCardHtml, paintScores, bindPlayButtons } from "./lick-card.js";
import { playLick, stopLick } from "../../audio/lick-player.js";
import { realize } from "./lick-core.js";
import { KEY_LIST, keyName, SCALES } from "../../theory/scales.js";
import { TUNING } from "../../theory/notes.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DURS = [[48, "w", "온"], [24, "h", "2분"], [18, "q.", "점4분"], [12, "q", "4분"], [9, "e.", "점8분"], [6, "e", "8분"], [3, "s", "16분"], [4, "t", "셋잇단"]];
const CODE = Object.fromEntries(DURS.map(([t, c]) => [t, c]));
const SCALE_OPTS = ["minor-penta", "major-penta", "blues", "mixed-blues", "major", "natural-minor", "harmonic-minor", "dorian", "mixolydian", "lydian", "phrygian", "locrian", "melodic-minor"];
const MAX_TICKS = 4 * 48;

function toToken(e) {
  const pos = e.rest ? "-" : e.notes.map(n => `${n.s}-${n.f}`).join("+");
  return `${pos}:${CODE[e.dur]}${e.bend ? "b" + e.bend : ""}${e.sl ? "sl" : ""}${e.rel ? "r" : ""}${e.h ? "h" : ""}${e.p ? "p" : ""}${e.vib ? "~" : ""}${e.chrom ? "c" : ""}`;
}
const blank = () => ({ id: null, name: "", scale: "minor-penta", key: 9, use: "f", feel: "straight", events: [] });

export function renderLickEditor(root, { toast, ask }) {
  let draft = null;            // 편집 중인 릭
  let dur = 6, tech = { bend: 0, rel: false, h: false, p: false, sl: false, vib: false, chrom: false }, stack = false;
  let fretFrom = 0;
  const unplay = bindPlayButtons(root, id => LICKS.find(l => l.id === id), () => 80);

  const rowOf = d => [d.id || "MY-??", "my", d.scale, d.key, d.use, d.feel, d.events.map(toToken).join(" ") || "-:q", "", d.name];
  const ticksOf = d => d.events.reduce((a, e) => a + e.dur, 0);

  function listHtml() {
    const rows = loadMyLicks();
    return `<div class="panel">
      <div class="btn-row" style="justify-content:space-between;align-items:center"><h3 class="panel-title" style="margin:0">내 릭 ${rows.length}개</h3><button class="btn primary small" type="button" data-act="new">+ 새 릭</button></div>
      <div class="lk-list">${rows.map(r => `<div class="lk-row" data-open="${esc(r[0])}"><div class="lk-row-main"><b>${esc(r[0])}</b><span>${esc(r[8] || "(이름 없음)")}</span><small>${esc(keyName(r[3], "major"))} · ${esc(scaleNameOf(r[2]))}</small></div>
        <div class="lk-row-flags"><button type="button" class="flag-btn" data-act="edit" data-id="${esc(r[0])}">편집</button><button type="button" class="flag-btn del" data-act="del" data-id="${esc(r[0])}">삭제</button></div></div>`).join("") || `<p class="muted">아직 없음. "새 릭"으로 유튜브·교재에서 배운 릭을 입력해 두면 키 이동·도수·위치 정보와 함께 연습할 수 있음</p>`}</div>
    </div>`;
  }

  function editorHtml() {
    const d = draft;
    const pcs = new Set(stepsOf(d.scale).map(x => (d.key + x) % 12));
    const grid = [];
    for (let s = 1; s <= 6; s++) {
      const cells = [];
      for (let f = fretFrom; f <= Math.min(17, fretFrom + 12); f++) {
        const pc = (TUNING[s - 1] + f) % 12;
        cells.push(`<button type="button" class="fc ${pcs.has(pc) ? "in" : ""} ${pc === d.key ? "root" : ""}" data-pos="${s}-${f}">${f}</button>`);
      }
      grid.push(`<div class="fr"><span class="fs">${s}</span>${cells.join("")}</div>`);
    }
    return `<div class="panel ed">
      <div class="ed-head"><b>${esc(d.id || "새 릭")}</b><input id="edName" type="text" maxlength="40" placeholder="이름(예: 강좌 3강 엔딩 릭)" value="${esc(d.name)}"></div>
      <div class="ed-row"><label>스케일</label><select id="edScale">${SCALE_OPTS.filter(id => SCALES[id] || id === "mixed-blues").map(id => `<option value="${id}" ${id === d.scale ? "selected" : ""}>${esc(scaleNameOf(id))}</option>`).join("")}</select></div>
      <div class="ed-row"><label>키</label><div class="root-grid key7 ed-keys" id="edKey">${KEY_LIST.map(pc => `<button type="button" data-key="${pc}" class="${pc === d.key ? "sel" : ""}">${esc(keyName(pc, "major"))}</button>`).join("")}</div></div>
      <div class="ed-row"><label>용도</label><div class="seg wide-seg ed-wrap" id="edUse">${Object.entries(USE_NAMES).map(([k, n]) => `<button type="button" data-v="${k}" class="${k === d.use ? "sel" : ""}">${n}</button>`).join("")}</div></div>
      <div class="ed-row"><label>느낌</label><div class="seg wide-seg" id="edFeel">${Object.entries(FEEL_NAMES).map(([k, n]) => `<button type="button" data-v="${k}" class="${k === d.feel ? "sel" : ""}">${n}</button>`).join("")}</div></div>
      <div class="tab-wrap score-wrap" id="edScore" data-key="${d.key}"></div>
      <div class="ed-warn" id="edWarn"></div>
      <div class="ed-row"><label>길이</label><div class="seg wide-seg ed-wrap" id="edDur">${DURS.map(([t, , n]) => `<button type="button" data-t="${t}" class="${t === dur ? "sel" : ""}">${n}</button>`).join("")}</div></div>
      <div class="ed-row"><label>기법</label><div class="ed-techs" id="edTech">
        ${[["bend", "벤딩"], ["rel", "릴리스"], ["h", "해머온"], ["p", "풀오프"], ["sl", "슬라이드"], ["vib", "비브라토"], ["chrom", "경과음"]].map(([k, n]) => `<button type="button" data-tech="${k}" class="${tech[k] ? "on" : ""}">${n}${k === "bend" && tech.bend ? ` ${["", "½", "full", "1½"][tech.bend]}` : ""}</button>`).join("")}
        <button type="button" data-stack="1" class="${stack ? "on" : ""}">동시음</button>
      </div><p class="muted small" style="margin:4px 0 0">기법은 다음에 넣는 음 하나에만 적용(벤딩은 누를 때마다 ½ → full → 1½ → 없음). 동시음을 켜면 다음 음이 앞 음과 같이 울림</p></div>
      <div class="ed-board"><div class="ed-shift"><button type="button" data-shift="-5">◀</button><span>${fretFrom}~${Math.min(17, fretFrom + 12)}프렛</span><button type="button" data-shift="5">▶</button></div>${grid.join("")}
        <p class="muted small" style="margin:6px 0 0">진한 칸 = 고른 스케일 음, 초록 = 근음. 칸을 누르면 지금 길이·기법으로 음이 추가됨</p></div>
      <div class="ed-actions">
        <button class="btn small" type="button" data-act="rest">쉼표</button>
        <button class="btn small" type="button" data-act="undo">되돌리기</button>
        <button class="btn small" type="button" data-act="clear">모두 지우기</button>
        <button class="btn small" type="button" data-act="play">▶ 듣기</button>
      </div>
      <div class="ed-actions">
        <button class="btn primary" type="button" data-act="save">저장</button>
        <button class="btn ghost" type="button" data-act="cancel">닫기</button>
      </div>
    </div>`;
  }

  function preview() {
    const el = root.querySelector("#edScore"); if (!el) return;
    el.dataset.key = draft.key;
    const l = buildLick(rowOf(draft));
    paintScore(el, l);
    const errs = draft.events.length ? validate(l) : [];
    const t = ticksOf(draft);
    root.querySelector("#edWarn").innerHTML = `<span class="muted small">${(t / 48).toFixed(2).replace(/\.00$/, "")}마디 / 최대 4마디</span>${errs.length ? `<div class="notice small">확인 필요: ${esc(errs.join(", "))} — 스케일 밖 음은 "경과음"을 켜고 넣으면 표시됨(저장은 가능)</div>` : ""}`;
  }

  function draw() {
    root.innerHTML = draft ? editorHtml() : listHtml();
    if (draft) preview();
    else root.querySelectorAll("[data-open]").forEach(() => {});
  }

  function addEvent(ev) {
    if (ticksOf(draft) + (ev.rest || !stack ? ev.dur : 0) > MAX_TICKS) { toast("최대 4마디까지 입력할 수 있음"); return; }
    draft.events.push(ev);
  }

  root.onclick = async e => {
    const t = e.target;
    const act = t.closest("[data-act]");
    if (!draft) {
      if (act && act.dataset.act === "new") { draft = { ...blank(), id: nextMyId() }; draw(); return; }
      if (act && act.dataset.act === "edit") {
        const r = loadMyLicks().find(x => x[0] === act.dataset.id); if (!r) return;
        const l = buildLick(r);
        draft = { id: r[0], name: r[8] || "", scale: r[2], key: r[3], use: r[4], feel: r[5], events: r[6] === "-:q" ? [] : l.events.map(({ at, ...rest }) => rest) };
        draw(); return;
      }
      if (act && act.dataset.act === "del") {
        const k = await ask("내 릭 삭제", `<p>${esc(act.dataset.id)}을 지움. 되돌릴 수 없음</p>`, [{ key: "ok", label: "삭제", kind: "danger" }, { key: "no", label: "취소" }]);
        if (k === "ok") { deleteMyLick(act.dataset.id); draw(); }
        return;
      }
      const row = t.closest("[data-open]");
      if (row) {
        const open = root.querySelector(".lk-open");
        if (open && open.dataset.for === row.dataset.open) { open.remove(); return; }
        if (open) open.remove();
        const l = LICKS.find(x => x.id === row.dataset.open); if (!l) return;
        const div = document.createElement("div"); div.className = "lk-open"; div.dataset.for = l.id;
        div.innerHTML = lickCardHtml(l); row.after(div); paintScores(div, id => LICKS.find(x => x.id === id));
      }
      return;
    }
    // 편집기
    const pos = t.closest("[data-pos]");
    if (pos) {
      const [s, f] = pos.dataset.pos.split("-").map(Number);
      const last = draft.events[draft.events.length - 1];
      if (stack && last && !last.rest) { if (!last.notes.some(n => n.s === s)) last.notes.push({ s, f }); }
      else addEvent({ dur, notes: [{ s, f }], bend: tech.bend, rel: tech.rel, h: tech.h, p: tech.p, sl: tech.sl, vib: tech.vib, chrom: tech.chrom, rest: false });
      tech = { bend: 0, rel: false, h: false, p: false, sl: false, vib: false, chrom: false };
      stack = false;
      draw(); return;
    }
    const k = t.closest("#edKey [data-key]"); if (k) { draft.key = Number(k.dataset.key); draw(); return; }
    const u = t.closest("#edUse [data-v]"); if (u) { draft.use = u.dataset.v; draw(); return; }
    const fe = t.closest("#edFeel [data-v]"); if (fe) { draft.feel = fe.dataset.v; draw(); return; }
    const du = t.closest("#edDur [data-t]"); if (du) { dur = Number(du.dataset.t); draw(); return; }
    const te = t.closest("[data-tech]");
    if (te) { const n = te.dataset.tech; if (n === "bend") tech.bend = (tech.bend + 1) % 4; else tech[n] = !tech[n]; draw(); return; }
    if (t.closest("[data-stack]")) { stack = !stack; draw(); return; }
    const sh = t.closest("[data-shift]"); if (sh) { fretFrom = Math.max(0, Math.min(5, fretFrom + Number(sh.dataset.shift))); draw(); return; }
    if (!act) return;
    const a = act.dataset.act;
    if (a === "rest") { addEvent({ dur, rest: true, notes: [] }); draw(); }
    else if (a === "undo") { draft.events.pop(); draw(); }
    else if (a === "clear") { draft.events = []; draw(); }
    else if (a === "play") { if (!draft.events.length) return; try { await playLick(realize(buildLick(rowOf(draft))), 80); } catch (_) { toast("소리를 켤 수 없음"); } }
    else if (a === "save") {
      if (!draft.events.some(x => !x.rest)) { toast("음을 하나 이상 넣어야 저장할 수 있음"); return; }
      saveMyLick(rowOf(draft)); toast(`${draft.id} 저장함`); stopLick(); draft = null; draw();
    } else if (a === "cancel") { stopLick(); draft = null; draw(); }
  };
  root.onchange = e => {
    if (!draft) return;
    if (e.target.id === "edScale") { draft.scale = e.target.value; draw(); }
  };
  root.oninput = e => { if (draft && e.target.id === "edName") draft.name = e.target.value; };
  draw();
  return () => { unplay(); stopLick(); };
}
