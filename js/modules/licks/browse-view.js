// 릭 모듈 메뉴(v2.10.0)
//  릭 홈: 기본 릭 모음 · 장르 8개 · 전체 릭 목록 · 내 릭
//  기본 릭 모음: 기존 릭을 난이도 순서로 → 릭을 누르면 세션 전 설정
//  장르: 한 화면에서 기타리스트 + 난이도 고르기 → 그 아래 릭 목록
//  전체 릭 목록: 분류·기타리스트·난이도·검색으로 걸러 보기
import { LICKS, GENRES, DIFF_NAMES, genreLicks, basicLicksSorted, allLicks, realize, playerOf, lickDifficulty, USE_NAMES } from "./lick-core.js";
import { LICK_LEVELS, LICK_GENRES } from "../../data/catalog.js";
import { getSetting, setSetting } from "../../core/storage.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LEVEL_NAME = Object.fromEntries(LICK_LEVELS.map(l => [l.id, l.name.replace(/^L\d+\s*/, "")]));
const GENRE = Object.fromEntries(GENRES.map(g => [g.id, g]));
const dots = d => "●".repeat(d) + "○".repeat(3 - d);

// 릭 한 줄(누르면 세션 전 설정으로)
function rowHtml(l) {
  const r = realize(l);
  const p = playerOf(l);
  const where = p ? `${p.genreName} · ${p.short || p.name}` : l.custom ? "내 릭" : LEVEL_NAME[l.level] || "";
  const d = lickDifficulty(l);
  return `<button class="list-item lk-pick" type="button" data-pick="${esc(l.id)}">
      <div class="txt"><b>${esc(l.id)} <span class="lk-pick-t">${esc(r.title)}</span></b><span>${esc(where)} · ${esc(USE_NAMES[l.use] || "")} · ${l.bars}마디</span></div>
      <span class="tag" title="난이도 ${esc(DIFF_NAMES[d])}">${dots(d)}</span>
      <div class="chev">›</div>
    </button>`;
}
// 릭 고르기 → 세션 전 설정 화면(m/licks/<레벨>/lick-one). 뒤로 가면 고른 목록으로
export function pickLick(l, go, from) {
  setSetting("lk1.pick", l.id);
  setSetting("lk.from", from);
  go(`m/licks/${l.genreLick ? l.level : "basic"}/lick-one`);
}
// 화면(#view)은 모든 페이지가 같이 쓰므로 onclick 하나로 처리(리스너가 쌓이지 않게)
function handlePick(e, go, from) {
  const b = e.target.closest("[data-pick]"); if (!b) return false;
  const l = allLicks().find(x => x.id === b.dataset.pick);
  if (l) pickLick(l, go, from);
  return true;
}

export function renderLickHome(view, { go }) {
  const basicN = LICKS.filter(l => !l.custom).length;
  const myN = LICKS.filter(l => l.custom).length;
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Licks · 메뉴</div>
      <h1>Licks</h1>
      <p>기본 릭 · 장르별 기타리스트 스타일 · 전체 목록</p>
    </div>
    <div class="list">
      <button class="list-item" type="button" data-go="m/licks/basic"><div class="txt"><b>기본 릭 모음</b><span>펜타·메이저/마이너·모드·진행·코드톤·블루스 형식 ${basicN}개 · 난이도 순서</span></div><div class="chev">›</div></button>
    </div>
    <h3 class="sub-h">장르별</h3>
    <div class="list">
      ${LICK_GENRES.map(([id, name]) => {
        const g = GENRE[id];
        const n = genreLicks({ genre: id }).length;
        return `<button class="list-item" type="button" data-go="m/licks/g-${id}"><div class="txt"><b>${esc(name)}</b><span>${g ? g.players.map(p => esc(p.short || p.name)).join(" · ") : ""}</span></div>${n ? `<span class="tag">${n}개</span>` : `<span class="tag muted">준비 중</span>`}<div class="chev">›</div></button>`;
      }).join("")}
    </div>
    <h3 class="sub-h">그 밖</h3>
    <div class="list">
      <button class="list-item" type="button" data-go="m/licks/all"><div class="txt"><b>전체 릭 목록</b><span>모든 릭을 한 목록에서 골라 바로 연습 · 분류·기타리스트·난이도로 걸러 보기</span></div><span class="tag">${allLicks().length}개</span><div class="chev">›</div></button>
      <button class="list-item" type="button" data-go="m/licks/l7"><div class="txt"><b>내 릭</b><span>유튜브·교재에서 배운 릭을 직접 입력해 연습${myN ? ` · ${myN}개` : ""}</span></div><div class="chev">›</div></button>
    </div>`;
  view.onclick = e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
  return "Licks";
}

export function renderLickBasic(view, { go }) {
  const list = basicLicksSorted();
  const groups = [1, 2, 3].map(d => ({ d, items: list.filter(l => lickDifficulty(l) === d) })).filter(g => g.items.length);
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Licks · 기본 릭 모음</div>
      <h1>기본 릭 모음</h1>
      <p>쉬운 릭부터 난이도 순서. 릭을 누르면 연습 방식·마이크를 정하고 세션을 시작함</p>
    </div>
    <details class="panel lk-old">
      <summary>분류별 연습 · 키 옮기기 · 주고받기 · 변형 · 목록 표시</summary>
      <div class="list" style="margin-top:10px">
        ${LICK_LEVELS.filter(l => l.id !== "l7").map(l => `<button class="list-item" type="button" data-go="m/licks/${l.id}"><div class="txt"><b>${esc(l.name)}</b><span>${esc(l.desc)}</span></div><div class="chev">›</div></button>`).join("")}
      </div>
    </details>
    ${groups.map(g => `
      <h3 class="sub-h">${esc(DIFF_NAMES[g.d])} <small class="muted">${dots(g.d)} · ${g.items.length}개</small></h3>
      <div class="list">${g.items.map(rowHtml).join("")}</div>`).join("")}`;
  view.onclick = e => { if (handlePick(e, go, "m/licks/basic")) return; const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
  return "기본 릭 모음";
}

export function renderLickGenre(view, genreId, { go }) {
  const g = GENRE[genreId];
  const name = (LICK_GENRES.find(([id]) => id === genreId) || [])[1] || genreId;
  if (!g) { view.innerHTML = `<div class="empty-state">장르를 찾을 수 없음</div>`; return name; }
  const key = `lk.g.${genreId}`;
  let sel = getSetting(key, { player: g.players[0] ? g.players[0].id : "", diff: 1 });
  if (!g.players.some(p => p.id === sel.player)) sel = { ...sel, player: g.players[0] ? g.players[0].id : "" };
  function draw() {
    const list = genreLicks({ genre: genreId, player: sel.player, diff: sel.diff });
    const p = g.players.find(x => x.id === sel.player);
    view.innerHTML = `
      <div class="page-head">
        <div class="eyebrow">Licks · ${esc(name)}</div>
        <h1>${esc(name)}</h1>
        <p>기타리스트와 난이도를 고르면 아래에 릭 목록이 나옴</p>
      </div>
      <div class="panel lk-genre-pick">
        <div class="field"><label>기타리스트</label>
          <div class="seg wrap-seg" id="lkPlayer">${g.players.map(x => { const n = genreLicks({ genre: genreId, player: x.id }).length; return `<button type="button" data-player="${esc(x.id)}" class="${x.id === sel.player ? "sel" : ""}">${esc(x.short || x.name)}${n ? ` <small>${n}</small>` : ""}</button>`; }).join("")}</div></div>
        <div class="field" style="margin-top:12px"><label>난이도</label>
          <div class="seg" id="lkDiff">${[1, 2, 3].map(d => { const n = genreLicks({ genre: genreId, player: sel.player, diff: d }).length; return `<button type="button" data-diff="${d}" class="${d === Number(sel.diff) ? "sel" : ""}">${DIFF_NAMES[d]}${n ? ` <small>${n}</small>` : ""}</button>`; }).join("")}</div></div>
      </div>
      <h3 class="sub-h">${esc(p ? p.name : "")} · ${esc(DIFF_NAMES[sel.diff])}</h3>
      <div class="list" id="lkList">${list.length ? list.map(rowHtml).join("") : `<div class="panel muted lk-empty">준비 중 · 악보를 받으면 이 자리에 릭이 들어감</div>`}</div>`;
  }
  view.onclick = e => {
    if (handlePick(e, go, `m/licks/g-${genreId}`)) return;
    const pb = e.target.closest("[data-player]");
    if (pb) { sel = { ...sel, player: pb.dataset.player }; setSetting(key, sel); draw(); return; }
    const db = e.target.closest("[data-diff]");
    if (db) { sel = { ...sel, diff: Number(db.dataset.diff) }; setSetting(key, sel); draw(); }
  };
  draw();
  return name;
}

export function renderLickAll(view, { go }) {
  let f = getSetting("lk.all", { cat: "all", player: "", diff: 0, q: "" });
  const CATS = [["all", "전체"], ["basic", "기본 릭"], ["my", "내 릭"], ...LICK_GENRES];
  function filtered() {
    const q = (f.q || "").trim().toLowerCase();
    return allLicks().filter(l => {
      if (f.cat === "basic" && (l.genreLick || l.custom)) return false;
      if (f.cat === "my" && !l.custom) return false;
      if (!["all", "basic", "my"].includes(f.cat) && l.genre !== f.cat) return false;
      if (f.player && l.player !== f.player) return false;
      if (f.diff && lickDifficulty(l) !== Number(f.diff)) return false;
      if (q && !(`${l.id} ${l.name || ""} ${realize(l).title}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }
  function drawList() {
    const list = filtered();
    view.querySelector("#lkAllN").textContent = `${list.length}개`;
    view.querySelector("#lkAllList").innerHTML = list.length ? list.slice(0, 300).map(rowHtml).join("") : `<div class="panel muted lk-empty">해당하는 릭이 없음</div>`;
  }
  function draw() {
    const g = GENRE[f.cat];
    view.innerHTML = `
      <div class="page-head">
        <div class="eyebrow">Licks · 전체 릭 목록</div>
        <h1>전체 릭 목록</h1>
        <p>마음에 드는 릭을 골라 바로 연습</p>
      </div>
      <div class="panel lk-all-filter">
        <div class="field"><label>분류</label><select id="lkCat">${CATS.map(([id, n]) => `<option value="${esc(id)}" ${id === f.cat ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        ${g ? `<div class="field" style="margin-top:10px"><label>기타리스트</label><select id="lkPl"><option value="">전체</option>${g.players.map(p => `<option value="${esc(p.id)}" ${p.id === f.player ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>` : ""}
        <div class="field" style="margin-top:10px"><label>난이도</label><div class="seg" id="lkAllDiff">${[[0, "전체"], [1, "초급"], [2, "중급"], [3, "고급"]].map(([d, n]) => `<button type="button" data-d="${d}" class="${Number(f.diff) === d ? "sel" : ""}">${n}</button>`).join("")}</div></div>
        <div class="field" style="margin-top:10px"><label for="lkQ">검색</label><input id="lkQ" type="search" placeholder="번호·이름 (예: MP-01)" value="${esc(f.q || "")}"></div>
      </div>
      <h3 class="sub-h">목록 <small class="muted" id="lkAllN"></small></h3>
      <div class="list" id="lkAllList"></div>`;
    view.querySelector("#lkCat").onchange = e => { f = { ...f, cat: e.target.value, player: "" }; setSetting("lk.all", f); draw(); };
    if (view.querySelector("#lkPl")) view.querySelector("#lkPl").onchange = e => { f = { ...f, player: e.target.value }; setSetting("lk.all", f); drawList(); };
    view.querySelector("#lkAllDiff").onclick = e => { const b = e.target.closest("[data-d]"); if (!b) return; f = { ...f, diff: Number(b.dataset.d) }; setSetting("lk.all", f); view.querySelectorAll("#lkAllDiff button").forEach(x => x.classList.toggle("sel", x === b)); drawList(); };
    view.querySelector("#lkQ").oninput = e => { f = { ...f, q: e.target.value }; setSetting("lk.all", f); drawList(); };
    drawList();
  }
  view.onclick = e => { handlePick(e, go, "m/licks/all"); };
  draw();
  return "전체 릭 목록";
}
