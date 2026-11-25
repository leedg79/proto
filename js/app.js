// FRET LAB 1단계: 화면 라우터와 화면 구성
import { MODULES, findModule, findLevel, findTask, moduleName, levelName, taskName, SESSION_TYPES, MODULE_ORDER, topicsFor, topicLabel } from "./data/catalog.js";
import * as Store from "./core/storage.js";
import * as S from "./core/session.js";
import { formatDuration, formatShort, localDateKey } from "./core/clock.js";
import * as J from "./core/journal.js";
import * as B from "./core/backup.js";
import * as Metro from "./audio/metronome.js";
import * as NoteFinder from "./modules/notes/finder-view.js";
import * as RandomChord from "./modules/chords/random-view.js";
import * as BpmChord from "./modules/chords/bpm-view.js";
import * as PlaySession from "./modules/chords/play-view.js";
import { KEYS as PLAY_KEYS, STYLES as PLAY_STYLES } from "./modules/chords/play-core.js";
import * as ScaleShape from "./modules/scales/shape-view.js";
import * as ScaleRoot from "./modules/scales/root-view.js";
import * as ScaleRootCycle from "./modules/scales/rootcycle-view.js";
import * as ScaleStart from "./modules/scales/start-view.js";
import * as ScaleMode from "./modules/scales/mode-view.js";
import * as ScaleTransition from "./modules/scales/transition-view.js";
import { renderDictionary } from "./modules/chords/dictionary-view.js";

const APP_VERSION = "1.7.0";

// 구현된 과제의 연습 화면 (모듈/과제 → 화면 모듈)
// 화면 모듈: settingsHtml, bindSettings, readSettings, mount, clearFinder
const CONTENT = {
  "notes/note-finder": NoteFinder,
  "chords/random-chord": RandomChord,
  "chords/bpm-chord": BpmChord,
  "chords/play-session": PlaySession,
  "scales/shape-learning": ScaleShape,
  "scales/shape-root": ScaleRoot,
  "scales/root-cycle": ScaleRootCycle,
  "scales/start-note": ScaleStart,
  "scales/mode-switch": ScaleMode,
  "scales/neck-transition": ScaleTransition
};
// S6(화성 적용)는 반주 음원 단계에서 구현
const NOT_YET = new Set(["scales/s6"]);
const contentFor = (mod, task, level) => (NOT_YET.has(`${mod}/${level}`) ? null : CONTENT[`${mod}/${task}`] || null);
function clearContent() { Object.values(CONTENT).forEach(c => c.clearFinder && c.clearFinder()); }

// ───────────── 공용 도우미 ─────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $("#view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const modColor = id => `var(--m-${MODULE_ORDER.includes(id) ? id : "notes"})`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = n => String(n).padStart(2, "0");

let cleanup = [];
function onCleanup(fn) { cleanup.push(fn); }
function runCleanup() { cleanup.forEach(fn => { try { fn(); } catch (_) {} }); cleanup = []; }

function go(hash, { replace = false } = {}) {
  const target = "#/" + hash.replace(/^#?\/?/, "");
  if (replace) { history.replaceState(null, "", target); render(); }
  else if (location.hash === target) render();
  else location.hash = target;
}

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

// 선택형 대화상자: actions = [{key, label, kind}] → 누른 key 반환 (바깥 누르면 null)
function ask(title, bodyHtml, actions) {
  return new Promise(resolve => {
    const m = $("#modal");
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;
    const box = $("#modalActions");
    box.innerHTML = actions.map(a => `<button class="btn ${a.kind || ""} wide" data-k="${esc(a.key)}" type="button">${esc(a.label)}</button>`).join("");
    const close = v => { m.classList.add("hidden"); m.onclick = null; resolve(v); };
    box.onclick = e => { const b = e.target.closest("button[data-k]"); if (b) close(b.dataset.k); };
    m.onclick = e => { if (e.target === m) close(null); };
    m.classList.remove("hidden");
  });
}

// ───────────── 화면 꺼짐 방지 ─────────────
let wakeLock = null;
async function holdScreen(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (_) { wakeLock = null; }
}

// ───────────── 메트로놈 상태 (세션 공통) ─────────────
const metro = {
  on: false,
  resumeAfterPause: false,
  bpm: Store.getSetting("bpm", 90),
  beats: Store.getSetting("beats", 4)
};
async function metroStart() {
  try {
    await Metro.startMetronome({ bpm: metro.bpm, beatsPerBar: metro.beats });
    metro.on = true;
  } catch (e) {
    metro.on = false;
    toast("소리를 켤 수 없음: " + e.message);
  }
}
function metroStop() {
  Metro.stopMetronome();
  metro.on = false;
}

// ───────────── 라우팅 ─────────────
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  return parts;
}

function parentOf(parts) {
  const [a, b, c, d] = parts;
  if (a === "m") {
    if (d) return `m/${b}/${c}`;
    if (c) return `m/${b}`;
    return "";
  }
  if (a === "session") {
    const s = S.getActive();
    return s ? `m/${s.module}/${s.level}` : "";
  }
  if (a === "journal") {
    if (b === "d") { const [y, m] = c.split("-"); return `journal/m/${y}-${m}`; }
    if (b === "m") return `journal/y/${c.split("-")[0]}`;
    return "";
  }
  if (a === "log") return "journal";
  return "";
}

function setTop(title, parts) {
  $("#topTitle").innerHTML = title ? esc(title) : "<b>FRET</b> LAB";
  const back = $("#backBtn");
  const isHome = parts.length === 0;
  back.classList.toggle("invisible", isHome);
  back.onclick = () => go(parentOf(parts));
}

function render() {
  runCleanup();
  const parts = parseRoute();
  const [a, b, c, d] = parts;
  let title = "";
  try {
    if (!a) title = renderHome();
    else if (a === "m" && b && c && d) title = renderTask(b, c, d);
    else if (a === "m" && b && c) title = renderTasks(b, c);
    else if (a === "m" && b) title = renderLevels(b);
    else if (a === "session") title = renderSession();
    else if (a === "done" && b) title = renderDone(b);
    else if (a === "journal") title = renderJournal(b, c);
    else if (a === "log") title = renderLog(b);
    else if (a === "data") title = renderData();
    else { go("", { replace: true }); return; }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty-state">화면을 표시하지 못함: ${esc(e.message)}</div>`;
  }
  if (title === null) return; // 다른 화면으로 이동 처리됨
  setTop(title, parts);
  updateDock();
  window.scrollTo(0, 0);
}

// ───────────── 홈 ─────────────
const ICON = {
  journal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M9 3v4M15 3v4"/></svg>',
  data: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>'
};

function renderHome() {
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Guitar Practice System</div>
      <h1>무엇을 연습할까요</h1>
    </div>
    <div class="today" id="today"><span class="muted">오늘 연습</span> <b>-</b></div>
    <div class="module-grid">
      ${MODULES.map((m, i) => `
        <button class="module-card ${i === MODULES.length - 1 ? "wide" : ""}" type="button" data-mod="${m.id}" style="--mc:${modColor(m.id)}">
          <span class="bar"></span>
          <span><strong>${esc(m.name)}</strong><small>${esc(m.sub)}</small></span>
          <span class="meta">${m.levels.length} LEVELS</span>
        </button>`).join("")}
    </div>
    <div class="tool-row">
      <button class="tool-card" type="button" data-go="journal">${ICON.journal}<div><b>학습일지</b><span>연·월·일 기록</span></div></button>
      <button class="tool-card" type="button" data-go="data">${ICON.data}<div><b>데이터 관리</b><span>백업 · 복원</span></div></button>
    </div>
    <div id="homeNotice"></div>`;
  view.onclick = e => {
    const m = e.target.closest("[data-mod]");
    if (m) return go(`m/${m.dataset.mod}`);
    const g = e.target.closest("[data-go]");
    if (g) go(g.dataset.go);
  };
  Store.getAllSessions().then(list => {
    const today = localDateKey(Date.now());
    const d = J.summarizeDay(list, today);
    const el = $("#today");
    if (el) el.innerHTML = `<span class="muted">오늘 연습</span> <b>${formatShort(d.totals.sec)}</b> <span class="muted">· 완료 ${d.totals.units}회 · 세션 ${d.totals.sessions}개</span>`;
    const last = Store.getSetting("lastBackupAt", 0);
    const stale = list.length > 0 && (!last || Date.now() - last > 7 * 864e5);
    const n = $("#homeNotice");
    if (n && stale) {
      n.innerHTML = `<div class="notice">${last ? `마지막 백업 후 ${Math.floor((Date.now() - last) / 864e5)}일이 지났음` : "아직 백업한 적이 없음"}. 기록은 이 기기에만 저장되므로 주기적으로 JSON 백업을 권장함<br><button class="btn small warn" type="button" data-go="data">백업하러 가기</button></div>`;
    }
  });
  return "";
}

// ───────────── 레벨 선택 ─────────────
function renderLevels(modId) {
  const m = findModule(modId);
  if (!m) { go("", { replace: true }); return null; }
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">${esc(m.name)} · 레벨 선택</div>
      <h1>${esc(m.name)}</h1>
      <p>${esc(m.sub)}</p>
    </div>
    <div class="list">
      ${m.levels.map(l => `
        <button class="list-item" type="button" data-lvl="${l.id}">
          <div class="txt"><b>${esc(l.name)}</b><span>${esc(l.desc)}</span></div>
          <div class="chev">›</div>
        </button>`).join("")}
    </div>`;
  view.onclick = e => { const b = e.target.closest("[data-lvl]"); if (b) go(`m/${modId}/${b.dataset.lvl}`); };
  return m.name;
}

// ───────────── 과제 선택 ─────────────
function renderTasks(modId, lvlId) {
  const m = findModule(modId), l = findLevel(modId, lvlId);
  if (!m || !l) { go(`m/${modId}`, { replace: true }); return null; }
  view.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">${esc(m.name)} · ${esc(l.name)} · 과제 선택</div>
      <h1>${esc(l.name)}</h1>
      <p>${esc(l.desc)}</p>
    </div>
    <div class="list">
      ${l.tasks.map(t => `
        <button class="list-item" type="button" data-task="${t.id}">
          <div class="txt"><b>${esc(t.name)}</b><span>${esc(t.unit.label)}</span></div>
          <span class="tag">${esc(SESSION_TYPES[t.type] || t.type)}</span>
          <div class="chev">›</div>
        </button>`).join("")}
    </div>`;
  view.onclick = e => { const b = e.target.closest("[data-task]"); if (b) go(`m/${modId}/${lvlId}/${b.dataset.task}`); };
  return m.name;
}

// ───────────── 과제 화면(시작 전) ─────────────
function renderTask(modId, lvlId, taskId) {
  const m = findModule(modId), l = findLevel(modId, lvlId), t = findTask(modId, lvlId, taskId);
  if (!m || !l || !t) { go(`m/${modId}/${lvlId}`, { replace: true }); return null; }
  const active = S.getActive();
  if (active && active.module === modId && active.level === lvlId && active.task === taskId) {
    go("session", { replace: true });
    return null;
  }
  const otherActive = !!active;
  if (t.reference && modId === "chords") {
    view.innerHTML = `
      <div class="session-layout">
        <div class="panel session-head span-all">
          <div class="crumbs">${esc(m.name)} · ${esc(l.name)}</div>
          <h1>${esc(t.name)}</h1>
          <div class="tag-row"><span class="tag">참고 기능 · 기록 없음</span></div>
        </div>
        <div class="span-all" id="dictArea" style="display:grid;gap:14px"></div>
      </div>`;
    renderDictionary($("#dictArea"), { level: lvlId });
    return m.name;
  }
  const content = contentFor(modId, taskId, lvlId);
  const topics = topicsFor(modId, lvlId, taskId);
  const topicKey = `topics:${modId}/${lvlId}/${taskId}`;
  const savedTopics = Store.getSetting(topicKey, null);
  const usable = topics.filter(tp => !tp.pending);
  const selected = new Set((savedTopics || [usable[0] && usable[0].id]).filter(id => usable.some(t => t.id === id)));
  view.innerHTML = `
    <div class="session-layout">
      <div class="panel session-head span-all">
        <div class="crumbs">${esc(m.name)} · ${esc(l.name)}</div>
        <h1>${esc(t.name)}</h1>
        <div class="btn-row" style="gap:6px;flex-wrap:wrap">
          <span class="tag accent">${esc(SESSION_TYPES[t.type] || t.type)}</span>
          <span class="tag">${esc(t.unit.label)}</span>
        </div>
      </div>
      ${topics.length ? `<div class="panel span-all" id="topicPanel">
        <div class="topic-head"><h3 class="panel-title">학습 주제</h3><button type="button" class="btn small ghost" id="topicAll">전체 선택</button></div>
        <div class="topic-list">${topics.map(tp => `<label class="topic ${tp.pending ? "pending" : ""}"><input type="checkbox" value="${esc(tp.id)}" ${selected.has(tp.id) ? "checked" : ""} ${tp.pending ? "disabled" : ""}><span>${esc(tp.name)}${tp.pending ? ` <small>${esc(tp.pending)}</small>` : ""}</span></label>`).join("")}</div>
        <p class="muted small" style="margin:10px 0 0">1개만 고르거나 여러 개를 골라 섞어 연습할 수 있음</p>
      </div>` : ""}
      ${content ? `<div class="panel span-all"><h3 class="panel-title">세션 설정</h3>${content.settingsHtml(lvlId)}</div>` : `<div class="panel placeholder span-all">
        ${t.reference
          ? `<b>참고 기능</b><br>Chord Dictionary는 연습 세션이 아니라 참고 기능이라 기록하지 않음. 사전 화면은 ${m.stage}단계에서 구현 예정임`
          : `<b>학습 콘텐츠 준비 중</b><br>이 과제의 실제 연습 화면은 개발 ${m.stage}단계에서 구현됨. 지금은 학습 주제를 골라 세션 시작·일시정지·종료와 기록·학습일지를 사용할 수 있음`}
      </div>`}
      ${t.reference ? "" : `
      <div class="span-all">
        ${otherActive ? `<div class="autopause" style="margin-bottom:10px">다른 세션이 진행 중임: ${esc(moduleName(active.module))} · ${esc(taskName(active.module, active.level, active.task))}</div>` : ""}
        <button class="btn primary wide" id="startBtn" type="button" style="min-height:58px;font-size:18px">세션 시작</button>
        <p class="muted small" style="text-align:center;margin:8px 0 0">시작 버튼을 눌러야 시간 측정이 시작됨</p>
      </div>`}
    </div>`;
  if (content) content.bindSettings(view);
  const readTopics = () => $$("#topicPanel input:checked").map(i => i.value);
  if ($("#topicAll")) {
    const syncAll = () => { $("#topicAll").textContent = readTopics().length === usable.length ? "전체 해제" : "전체 선택"; };
    $("#topicAll").onclick = () => {
      const all = readTopics().length !== usable.length;
      $$("#topicPanel input:not([disabled])").forEach(i => { i.checked = all; });
      syncAll();
    };
    $("#topicPanel").addEventListener("change", syncAll);
    syncAll();
  }
  const btn = $("#startBtn");
  if (btn) btn.onclick = async () => {
    const chosen = readTopics();
    if (usable.length && !chosen.length) { toast("학습 주제를 1개 이상 선택해야 함"); return; }
    if (topics.length) Store.setSetting(topicKey, chosen);
    const options = content ? content.readSettings(view) : {};
    if (S.getActive()) {
      const cur = S.getActive();
      const k = await ask("진행 중인 세션이 있음", `<p>${esc(moduleName(cur.module))} · ${esc(taskName(cur.module, cur.level, cur.task))} 세션이 아직 종료되지 않았음. 한 번에 하나의 세션만 진행할 수 있음</p>`, [
        { key: "goto", label: "진행 중 세션으로 이동", kind: "primary" },
        { key: "end", label: "그 세션을 종료·기록하고 새로 시작" },
        { key: "cancel", label: "취소", kind: "ghost" }
      ]);
      if (k === "goto") return go("session");
      if (k !== "end") return;
      metroStop();
      await S.endSession();
    }
    clearContent();
    S.startSession({ module: modId, level: lvlId, task: taskId, type: t.type, options, topics: chosen });
    holdScreen(true);
    go("session", { replace: true });
  };
  return m.name;
}

// ───────────── 진행 중 세션 화면 ─────────────
function renderSession() {
  const s0 = S.getActive();
  if (!s0) { go("", { replace: true }); return null; }
  const m = findModule(s0.module);
  const t = findTask(s0.module, s0.level, s0.task);
  const unitLabel = t ? t.unit.label : "";
  const content = contentFor(s0.module, s0.task, s0.level);
  const unitsPanel = `
        <div class="panel">
          <div class="units">
            <div><div class="lbl">완료 횟수</div><div class="count" id="unitCount">0</div></div>
            <div class="lbl" style="text-align:right">${esc(unitLabel)}<br>${content ? "자동 판정 · " : ""}연습시간과 별도로 집계</div>
          </div>
        </div>`;
  const metroPanel = `
        <div class="panel" id="metroPanel">
          <div class="metro-top"><h3>METRONOME</h3><button class="switch" id="metroSwitch" type="button">OFF</button></div>
          <div class="bpm-row">
            <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
            <div class="bpm-val"><b id="bpmVal">${metro.bpm}</b><span>BPM</span></div>
            <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
          </div>
          <div class="beats" id="beatDots"></div>
          <div class="metro-opts">박자
            <div class="seg" id="beatSeg">${[2, 3, 4, 6].map(n => `<button type="button" data-beats="${n}" class="${n === metro.beats ? "sel" : ""}">${n}/4</button>`).join("")}</div>
          </div>
        </div>`;
  const head = `
      <div class="panel session-head span-all">
        <div class="crumbs">${esc(moduleName(s0.module))} · ${esc(levelName(s0.module, s0.level))}</div>
        <h1>${esc(taskName(s0.module, s0.level, s0.task))}</h1>
        <div class="tag-row"><span class="tag accent">${esc(SESSION_TYPES[s0.type] || s0.type)}</span>${(s0.topics || []).map(id => `<span class="tag">${esc(topicLabel(s0.module, s0.level, s0.task, [id]))}</span>`).join("")}</div>
      </div>
      <div class="autopause span-all hidden" id="autoNote">앱을 벗어나 자동으로 일시정지됐음. 벗어나 있던 시간은 연습시간에 포함되지 않음. 재개를 누르면 이어서 측정함</div>`;
  view.innerHTML = content ? `
    <div class="session-layout content-layout">
      ${head}
      <div class="panel status-bar span-all">
        <div class="status-time"><div class="state-label" id="stateLabel">RUNNING</div><div class="mid-time" id="bigTime">00:00</div></div>
        <button class="btn warn" id="pauseBtn" type="button">일시정지</button>
        <button class="btn danger" id="endBtn" type="button">종료</button>
      </div>
      <div class="panel content-panel" id="contentArea"></div>
      <div style="display:grid;gap:12px;align-content:start">${unitsPanel}</div>
    </div>` : `
    <div class="session-layout">
      ${head}
      <div>
        <div class="panel clock-panel">
          <div class="state-label" id="stateLabel">RUNNING</div>
          <div class="big-time" id="bigTime">00:00</div>
          <div class="clock-sub" id="clockSub">실제 연습시간 (일시정지 제외)</div>
        </div>
        <div class="controls" style="margin-top:12px">
          <button class="btn warn" id="pauseBtn" type="button">일시정지</button>
          <button class="btn danger" id="endBtn" type="button">종료</button>
        </div>
      </div>
      <div style="display:grid;gap:12px">
        ${unitsPanel}
        ${metroPanel}
        <div class="panel placeholder">
          <b>학습 콘텐츠는 ${m ? m.stage : "-"}단계에서 구현 예정</b><br>
          지금은 아래 시험용 버튼으로 완료 기록을 확인할 수 있음. 실제 과제가 붙으면 이 버튼은 자동 판정으로 바뀜
          <div style="margin-top:10px"><button class="btn small" id="unitBtn" type="button">완료 1회 기록 (시험용)</button></div>
        </div>
      </div>
    </div>`;

  if (content) {
    onCleanup(content.mount($("#contentArea"), {
      getActive: S.getActive,
      elapsedMs: S.elapsedMs,
      addUnit: n => S.addCompletedUnit(n),
      toast
    }));
  }

  const hasMetro = !!$("#metroPanel");
  const drawDots = () => {
    if (!hasMetro) return;
    $("#beatDots").innerHTML = Array.from({ length: metro.beats }, (_, i) => `<span class="beat ${i === 0 ? "accent" : ""}" data-i="${i}"></span>`).join("");
  };
  drawDots();
  Metro.onMetronomeBeat(inBar => {
    const dots = $$("#beatDots .beat");
    dots.forEach((d, i) => d.classList.toggle("on", i === inBar));
  });

  const paint = () => {
    const s = S.getActive();
    if (!s) return;
    const running = s.status === "running";
    $("#bigTime").textContent = formatDuration(S.elapsedSec());
    const lab = $("#stateLabel");
    lab.textContent = running ? "RUNNING" : "PAUSED";
    lab.className = "state-label " + (running ? "running" : "paused");
    $("#pauseBtn").textContent = running ? "일시정지" : "재개";
    $("#pauseBtn").className = "btn " + (running ? "warn" : "primary");
    $("#unitCount").textContent = s.completedUnits;
    $("#autoNote").classList.toggle("hidden", !S.peekAutoPauseNotice());
    if (!hasMetro) return;
    const sw = $("#metroSwitch");
    sw.textContent = metro.on ? "ON" : "OFF";
    sw.classList.toggle("on", metro.on);
    $("#bpmVal").textContent = metro.bpm;
  };
  paint();
  const tick = setInterval(paint, 250);
  onCleanup(() => clearInterval(tick));
  onCleanup(S.subscribe(() => { if (S.getActive()) paint(); }));

  $("#pauseBtn").onclick = async () => {
    const s = S.getActive();
    if (s.status === "running") {
      metro.resumeAfterPause = metro.on;
      metroStop();
      S.pauseSession();
      holdScreen(false);
    } else {
      S.resumeSession();
      holdScreen(true);
      if (metro.resumeAfterPause) await metroStart();
      metro.resumeAfterPause = false;
      paint();
    }
  };
  if ($("#unitBtn")) $("#unitBtn").onclick = () => { S.addCompletedUnit(1); toast("완료 1회 기록함"); };
  $("#endBtn").onclick = async () => {
    const s = S.getActive();
    const sec = S.elapsedSec();
    const k = await ask("세션 종료", `<p>실제 연습시간 <b>${formatDuration(sec)}</b>, 완료 <b>${s.completedUnits}회</b>로 기록함</p>`, [
      { key: "save", label: "종료하고 기록", kind: "primary" },
      { key: "discard", label: "기록하지 않고 버리기", kind: "danger" },
      { key: "cancel", label: "계속 연습", kind: "ghost" }
    ]);
    if (k === "save") {
      metroStop(); holdScreen(false);
      try {
        const rec = await S.endSession();
        clearContent();
        Store.requestPersistence();
        go(`done/${rec.id}`, { replace: true });
      } catch (e) {
        toast("저장 실패: " + e.message);
      }
    } else if (k === "discard") {
      const k2 = await ask("기록 버리기", "<p>이 세션의 연습시간과 완료 횟수가 저장되지 않음. 되돌릴 수 없음</p>", [
        { key: "yes", label: "버리기", kind: "danger" }, { key: "no", label: "취소", kind: "ghost" }
      ]);
      if (k2 === "yes") {
        const back = `m/${s.module}/${s.level}`;
        metroStop(); holdScreen(false);
        S.discardSession();
        clearContent();
        go(back, { replace: true });
      }
    }
  };
  if (hasMetro) $("#metroSwitch").onclick = async () => {
    if (metro.on) metroStop();
    else {
      if (S.getActive().status !== "running") { toast("세션을 재개한 뒤 메트로놈을 켤 수 있음"); return; }
      await metroStart();
    }
    paint();
  };
  if (hasMetro) $("#metroPanel").addEventListener("click", e => {
    const b = e.target.closest("[data-bpm]");
    if (b) {
      metro.bpm = Math.max(30, Math.min(300, metro.bpm + Number(b.dataset.bpm)));
      Store.setSetting("bpm", metro.bpm);
      Metro.setMetronomeBpm(metro.bpm);
      paint();
    }
    const bt = e.target.closest("[data-beats]");
    if (bt) {
      metro.beats = Number(bt.dataset.beats);
      Store.setSetting("beats", metro.beats);
      Metro.setMetronomeBeats(metro.beats);
      $$("#beatSeg button").forEach(x => x.classList.toggle("sel", x === bt));
      drawDots();
    }
  });
  return m ? m.name : "세션";
}

// ───────────── 종료 결과 ─────────────
function renderDone(id) {
  view.innerHTML = `<div class="empty-state">기록을 불러오는 중</div>`;
  Store.getAllSessions().then(list => {
    const r = list.find(x => x.id === id);
    if (!r) { view.innerHTML = `<div class="empty-state">기록을 찾을 수 없음</div>`; return; }
    const pauseSec = r.pauses.reduce((a, p) => a + (Date.parse(p.to) - Date.parse(p.from)) / 1000, 0);
    view.innerHTML = `
      <div class="page-head"><div class="eyebrow">Session Complete</div><h1>세션 기록 완료</h1>
        <p>${esc(moduleName(r.module))} · ${esc(levelName(r.module, r.level))} · ${esc(taskName(r.module, r.level, r.task))}${r.topics && r.topics.length ? `<br>${esc(topicLabel(r.module, r.level, r.task, r.topics))}` : ""}</p></div>
      <div class="result-grid">
        <div class="stat"><div class="k">실제 연습시간</div><div class="v">${formatDuration(r.activeSec)}</div></div>
        <div class="stat"><div class="k">완료 횟수</div><div class="v">${r.completedUnits}회</div></div>
        <div class="stat"><div class="k">일시정지</div><div class="v">${r.pauses.length}회</div></div>
        <div class="stat"><div class="k">일시정지 시간</div><div class="v">${formatDuration(pauseSec)}</div></div>
      </div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn primary" type="button" id="again">같은 과제 다시</button>
        <button class="btn" type="button" id="toDay">오늘 학습일지</button>
      </div>`;
    $("#again").onclick = () => go(`m/${r.module}/${r.level}/${r.task}`);
    $("#toDay").onclick = () => go(`journal/d/${r.date}`);
  });
  return "세션 완료";
}

// ───────────── 학습일지 ─────────────
function journalTabs(sel, y, m, d) {
  return `<div class="tabs">
    <button type="button" class="${sel === "y" ? "sel" : ""}" data-jt="journal/y/${y}">연간</button>
    <button type="button" class="${sel === "m" ? "sel" : ""}" data-jt="journal/m/${y}-${pad(m)}">월간</button>
    <button type="button" class="${sel === "d" ? "sel" : ""}" data-jt="journal/d/${y}-${pad(m)}-${pad(d)}">일간</button>
    <button type="button" class="${sel === "log" ? "sel" : ""}" data-jt="log">기록</button>
  </div>`;
}

function figs(acc) {
  return `<span class="figs"><b>${formatShort(acc.sec)}</b> · 완료 <b>${acc.units}</b>회</span>`;
}

function moduleRows(mods) {
  const max = Math.max(1, ...MODULE_ORDER.map(id => (mods[id] ? mods[id].sec : 0)));
  return `<div class="mod-rows">${MODULE_ORDER.map(id => {
    const a = mods[id] || { sec: 0, units: 0 };
    return `<div class="mod-row" style="--c:${modColor(id)}">
      <div class="name"><span class="dot"></span>${esc(moduleName(id))}</div>
      <div class="track"><i style="width:${(a.sec / max) * 100}%"></i></div>
      <div class="num"><b>${formatShort(a.sec)}</b> · ${a.units}회</div>
    </div>`;
  }).join("")}</div>`;
}

function summaryStats(t) {
  return `<div class="summary">
    <div class="stat"><div class="k">연습시간</div><div class="v">${formatShort(t.sec)}</div></div>
    <div class="stat"><div class="k">완료 횟수</div><div class="v">${t.units}회</div></div>
    <div class="stat"><div class="k">세션</div><div class="v">${t.sessions}개</div></div>
  </div>`;
}

function renderJournal(kind, arg) {
  const now = new Date();
  if (!kind) { go(`journal/m/${now.getFullYear()}-${pad(now.getMonth() + 1)}`, { replace: true }); return null; }
  view.innerHTML = `<div class="empty-state">학습일지를 불러오는 중</div>`;
  Store.getAllSessions().then(list => {
    view.onclick = e => {
      const t = e.target.closest("[data-jt]"); if (t) return go(t.dataset.jt);
    };
    if (kind === "y") drawYear(list, Number(arg) || now.getFullYear());
    else if (kind === "m") { const [y, m] = (arg || "").split("-").map(Number); drawMonth(list, y || now.getFullYear(), m || now.getMonth() + 1); }
    else if (kind === "d") drawDay(list, arg || localDateKey(Date.now()));
  });
  return "학습일지";
}

function drawYear(list, y) {
  const s = J.summarizeYear(list, y);
  const now = new Date();
  const dm = y === now.getFullYear() ? now.getMonth() + 1 : 1;
  view.innerHTML = `
    ${journalTabs("y", y, dm, 1)}
    <div class="period"><button type="button" data-jt="journal/y/${y - 1}" aria-label="이전 해">‹</button><h2>${y}년</h2><button type="button" data-jt="journal/y/${y + 1}" aria-label="다음 해">›</button></div>
    ${summaryStats(s.totals)}
    <div class="section-title">모듈별 누적</div>
    ${moduleRows(s.modules)}
    <div class="section-title">월별</div>
    <div class="months">${s.months.map((mo, i) => {
      const total = Math.max(1, mo.sec);
      return `<button type="button" class="month-cell ${mo.sessions ? "" : "empty"}" data-jt="journal/m/${y}-${pad(i + 1)}">
        <div class="mn">${i + 1}월</div>
        <div class="mt">${mo.sessions ? `${formatShort(mo.sec)} · ${mo.units}회` : "기록 없음"}</div>
        <div class="stack">${MODULE_ORDER.filter(id => mo.modules[id]).map(id => `<i style="--c:${modColor(id)};width:${(mo.modules[id].sec / total) * 100}%"></i>`).join("")}</div>
      </button>`;
    }).join("")}</div>`;
}

function drawMonth(list, y, m) {
  const s = J.summarizeMonth(list, y, m);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const todayKey = localDateKey(Date.now());
  const cells = J.monthGrid(y, m);
  const firstDay = Object.keys(s.days).sort()[0];
  const dSel = todayKey.startsWith(`${y}-${pad(m)}`) ? Number(todayKey.slice(8)) : (firstDay ? Number(firstDay.slice(8)) : 1);
  view.innerHTML = `
    ${journalTabs("m", y, m, dSel)}
    <div class="period"><button type="button" data-jt="journal/m/${prev}" aria-label="이전 달">‹</button>
      <h2><span data-jt="journal/y/${y}" role="link" style="cursor:pointer">${y}년</span> ${m}월</h2>
      <button type="button" data-jt="journal/m/${next}" aria-label="다음 달">›</button></div>
    <div class="cal">
      ${WEEK.map((w, i) => `<div class="wd ${i === 0 ? "sun" : ""}">${w}</div>`).join("")}
      ${cells.map(d => {
        if (!d) return `<div class="day blank"></div>`;
        const key = J.dateKey(y, m, d);
        const info = s.days[key];
        return `<button type="button" class="day ${info ? "has" : ""} ${key === todayKey ? "today" : ""}" data-jt="journal/d/${key}">
          <span class="dn">${d}</span>
          ${info ? `<span class="dm">${info.sec >= 60 ? Math.round(info.sec / 60) + "분" : info.sec + "초"}</span>
          <span class="dots">${MODULE_ORDER.filter(id => info.modules[id]).map(id => `<span class="dot" style="--c:${modColor(id)}"></span>`).join("")}</span>` : ""}
        </button>`;
      }).join("")}
    </div>
    <div class="section-title">${m}월 합계</div>
    ${summaryStats(s.totals)}
    <div class="section-title">모듈 · 레벨별 누적</div>
    ${s.totals.sessions ? `<div class="tree">${MODULE_ORDER.filter(id => s.modules[id]).map(id => {
      const mo = s.modules[id];
      return `<div class="tree-mod" style="--c:${modColor(id)}">
        <div class="hd"><span style="display:flex;gap:8px;align-items:center"><span class="dot"></span>${esc(moduleName(id))}</span>${figs(mo)}</div>
        ${Object.entries(mo.levels).sort().map(([lid, la]) => `<div class="tree-level"><div class="lh"><span>${esc(levelName(id, lid))}</span>${figs(la)}</div></div>`).join("")}
      </div>`;
    }).join("")}</div>` : `<div class="empty-state">이 달에는 기록이 없음</div>`}`;
}

function shiftDate(key, delta) {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + delta).getTime());
}

function drawDay(list, key) {
  const s = J.summarizeDay(list, key);
  const [y, m, d] = key.split("-").map(Number);
  const wd = WEEK[new Date(y, m - 1, d).getDay()];
  view.innerHTML = `
    ${journalTabs("d", y, m, d)}
    <div class="period"><button type="button" data-jt="journal/d/${shiftDate(key, -1)}" aria-label="전날">‹</button>
      <h2><span data-jt="journal/m/${y}-${pad(m)}" role="link" style="cursor:pointer">${m}월</span> ${d}일 (${wd})</h2>
      <button type="button" data-jt="journal/d/${shiftDate(key, 1)}" aria-label="다음 날">›</button></div>
    ${summaryStats(s.totals)}
    <div class="section-title">모듈 · 레벨 · 과제별</div>
    ${s.totals.sessions ? `<div class="tree">${MODULE_ORDER.filter(id => s.modules[id]).map(id => {
      const mo = s.modules[id];
      return `<div class="tree-mod" style="--c:${modColor(id)}">
        <div class="hd"><span style="display:flex;gap:8px;align-items:center"><span class="dot"></span>${esc(moduleName(id))}</span>${figs(mo)}</div>
        ${Object.entries(mo.levels).sort().map(([lid, la]) => `<div class="tree-level">
          <div class="lh"><span>${esc(levelName(id, lid))}</span>${figs(la)}</div>
          ${Object.entries(la.tasks).map(([tid, ta]) => `<div class="tree-task"><span>${esc(taskName(id, lid, tid))} · ${ta.sessions}세션</span>${figs(ta)}</div>
            ${Object.entries(ta.topics || {}).map(([k, tpa]) => `<div class="tree-topic"><span>${esc(topicLabel(id, lid, tid, k.split("+")))}</span>${figs(tpa)}</div>`).join("")}`).join("")}
        </div>`).join("")}
      </div>`;
    }).join("")}</div>
    <div class="section-title">세션</div>
    ${s.sessions.map(logItem).join("")}` : `<div class="empty-state">이 날에는 기록이 없음</div>`}`;
  bindLogDelete();
}

// ───────────── 텍스트 학습일지 ─────────────
function hm(iso) { return iso ? iso.slice(11, 16) : "--:--"; }

function logItem(r) {
  const pauseSec = r.pauses.reduce((a, p) => a + Math.max(0, (Date.parse(p.to) - Date.parse(p.from)) / 1000), 0);
  const reasons = { user: "직접", auto: "앱 이탈", restore: "앱 재실행" };
  return `<details class="log-item" style="--c:${modColor(r.module)}">
    <summary>
      <span class="t">${hm(r.startedAt)}</span>
      <span class="m"><span style="display:inline-flex;gap:6px;align-items:center"><span class="dot"></span>${esc(moduleName(r.module))}</span>
        <small>${esc(levelName(r.module, r.level))} · ${esc(taskName(r.module, r.level, r.task))}${r.topics && r.topics.length ? " · " + esc(topicLabel(r.module, r.level, r.task, r.topics)) : ""}</small></span>
      <span class="r">${formatDuration(r.activeSec)}<small>완료 ${r.completedUnits}회</small></span>
    </summary>
    <div class="log-detail">
      <dl class="kv">
        <dt>세션 ID</dt><dd class="mono small">${esc(r.id)}</dd>
        <dt>날짜</dt><dd>${esc(r.date)}</dd>
        <dt>모듈</dt><dd>${esc(moduleName(r.module))}</dd>
        <dt>레벨</dt><dd>${esc(levelName(r.module, r.level))}</dd>
        <dt>과제</dt><dd>${esc(taskName(r.module, r.level, r.task))}</dd>
        ${r.topics && r.topics.length ? `<dt>학습 주제</dt><dd>${esc(topicLabel(r.module, r.level, r.task, r.topics))}</dd>` : ""}
        <dt>세션 유형</dt><dd>${esc(SESSION_TYPES[r.type] || r.type || "-")}</dd>
        <dt>시작</dt><dd>${esc(r.startedAt.replace("T", " ").slice(0, 19))}</dd>
        <dt>종료</dt><dd>${esc(r.endedAt.replace("T", " ").slice(0, 19))}</dd>
        <dt>실제 연습</dt><dd>${formatDuration(r.activeSec)} (${r.activeSec}초)</dd>
        <dt>일시정지</dt><dd>${r.pauses.length}회 · ${formatDuration(pauseSec)}${r.pauses.length ? `<br><span class="muted small">${r.pauses.map(p => `${hm(p.from)}~${hm(p.to)} ${reasons[p.reason] || p.reason}`).join(", ")}</span>` : ""}</dd>
        <dt>완료 횟수</dt><dd>${r.completedUnits}회</dd>
        ${r.options && r.options.timeLimit ? `<dt>설정</dt><dd>제한시간 ${r.options.timeLimit}초</dd>` : ""}
        ${r.options && r.options.bpm ? `<dt>설정</dt><dd>${r.options.style ? `${esc((PLAY_KEYS.find(k => k.pc === r.options.key) || {}).name || "")} 장조 · ${esc((PLAY_STYLES[r.options.style] || {}).name || r.options.style)} · ` : ""}시작 BPM ${r.options.bpm}</dd>` : ""}
      </dl>
      <div style="margin-top:12px"><button class="btn small danger" type="button" data-del="${esc(r.id)}">이 기록 삭제</button></div>
    </div>
  </details>`;
}

function bindLogDelete() {
  $$("[data-del]").forEach(b => b.onclick = async e => {
    e.preventDefault();
    const k = await ask("기록 삭제", "<p>이 세션 기록을 삭제함. 백업 파일이 없으면 되돌릴 수 없음</p>", [
      { key: "del", label: "삭제", kind: "danger" }, { key: "no", label: "취소", kind: "ghost" }
    ]);
    if (k === "del") { await Store.deleteSession(b.dataset.del); toast("삭제함"); render(); }
  });
}

function renderLog(filter) {
  view.innerHTML = `<div class="empty-state">기록을 불러오는 중</div>`;
  Store.getAllSessions().then(list => {
    const now = new Date();
    const sel = filter && MODULE_ORDER.includes(filter) ? filter : "all";
    const rows = list.filter(r => sel === "all" || r.module === sel).sort((a, b) => b.startedAtMs - a.startedAtMs);
    const groups = new Map();
    for (const r of rows) { if (!groups.has(r.date)) groups.set(r.date, []); groups.get(r.date).push(r); }
    view.innerHTML = `
      ${journalTabs("log", now.getFullYear(), now.getMonth() + 1, now.getDate())}
      <div class="filters">
        <button type="button" class="chip ${sel === "all" ? "sel" : ""}" data-jt="log">전체 ${list.length}</button>
        ${MODULE_ORDER.map(id => `<button type="button" class="chip ${sel === id ? "sel" : ""}" data-jt="log/${id}">${esc(moduleName(id))}</button>`).join("")}
      </div>
      ${rows.length ? [...groups.entries()].map(([date, items]) => {
        const [y, m, d] = date.split("-").map(Number);
        const tot = items.reduce((a, r) => a + r.activeSec, 0);
        return `<div class="log-day"><h3>${y}.${pad(m)}.${pad(d)} (${WEEK[new Date(y, m - 1, d).getDay()]}) · ${formatShort(tot)}</h3>${items.map(logItem).join("")}</div>`;
      }).join("") : `<div class="empty-state" style="margin-top:14px">기록이 없음</div>`}`;
    view.onclick = e => { const t = e.target.closest("[data-jt]"); if (t) go(t.dataset.jt); };
    bindLogDelete();
  });
  return "학습일지";
}

// ───────────── 데이터 관리 ─────────────
function renderData() {
  view.innerHTML = `<div class="empty-state">불러오는 중</div>`;
  Store.getAllSessions().then(async list => {
    const last = Store.getSetting("lastBackupAt", 0);
    let persisted = "확인 불가";
    try { if (navigator.storage && navigator.storage.persisted) persisted = (await navigator.storage.persisted()) ? "보호됨" : "일반"; } catch (_) {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    view.innerHTML = `
      <div class="page-head"><div class="eyebrow">Data</div><h1>데이터 관리</h1>
        <p>기록은 이 기기 안에만 저장됨. 기기 변경·앱 삭제에 대비해 JSON 파일로 백업해 둘 것</p></div>
      <div class="panel data-block">
        <h3>백업</h3>
        <p>세션 기록 ${list.length}개 · 마지막 백업 ${last ? new Date(last).toLocaleString("ko-KR") : "없음"}</p>
        <button class="btn primary wide" id="exportBtn" type="button" ${list.length ? "" : "disabled"}>JSON 백업 파일 만들기</button>
      </div>
      <div class="panel data-block">
        <h3>복원</h3>
        <p>FRET LAB 백업 파일(.json)을 선택하면 내용을 확인한 뒤 복원함</p>
        <input type="file" id="importFile" accept="application/json,.json" class="hidden">
        <button class="btn wide" id="importBtn" type="button">백업 파일 선택</button>
      </div>
      <div class="panel data-block">
        <h3>저장 상태</h3>
        <dl class="kv small">
          <dt>저장 방식</dt><dd>${esc(Store.storageBackend())}</dd>
          <dt>삭제 보호</dt><dd>${esc(persisted)}</dd>
          <dt>실행 방식</dt><dd>${standalone ? "홈 화면 앱" : "브라우저 탭"}${standalone ? "" : ' <span class="muted">(iPhone은 홈 화면에 추가해 실행해야 기록이 오래 보존됨)</span>'}</dd>
          <dt>앱 버전</dt><dd>${APP_VERSION}</dd>
        </dl>
      </div>
      <div class="panel data-block">
        <h3>모든 기록 삭제</h3>
        <p>이 기기의 세션 기록을 모두 지움. 먼저 백업할 것</p>
        <button class="btn danger wide" id="wipeBtn" type="button" ${list.length ? "" : "disabled"}>모든 기록 삭제</button>
      </div>`;

    $("#exportBtn").onclick = () => exportBackup(list);
    $("#importBtn").onclick = () => $("#importFile").click();
    $("#importFile").onchange = async e => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) await importBackup(await f.text(), list);
    };
    $("#wipeBtn").onclick = async () => {
      const k = await ask("모든 기록 삭제", `<p>세션 기록 ${list.length}개를 모두 삭제함. 되돌릴 수 없음</p>`, [
        { key: "backup", label: "먼저 백업하기", kind: "primary" },
        { key: "wipe", label: "삭제", kind: "danger" },
        { key: "no", label: "취소", kind: "ghost" }
      ]);
      if (k === "backup") return exportBackup(list);
      if (k !== "wipe") return;
      const k2 = await ask("정말 삭제할까요", "<p>마지막 확인임</p>", [{ key: "yes", label: "모두 삭제", kind: "danger" }, { key: "no", label: "취소", kind: "ghost" }]);
      if (k2 === "yes") { await Store.clearSessions(); toast("모든 기록을 삭제함"); render(); }
    };
  });
  return "데이터 관리";
}

async function exportBackup(list) {
  const now = Date.now();
  const data = B.buildBackup(list, { bpm: metro.bpm, beats: metro.beats }, now);
  const text = JSON.stringify(data, null, 2);
  const name = B.backupFileName(now);
  const file = new File([text], name, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "FRET LAB 백업" });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    Store.setSetting("lastBackupAt", now);
    toast(`백업 파일을 만들었음 (${list.length}개 기록)`);
    if (parseRoute()[0] === "data") render();
  } catch (e) {
    if (e && e.name === "AbortError") toast("백업을 취소함");
    else toast("백업 실패: " + (e && e.message));
  }
}

async function importBackup(text, existing) {
  const p = B.parseBackup(text);
  if (!p.ok) { await ask("복원할 수 없음", `<p>${esc(p.error)}</p>`, [{ key: "ok", label: "확인" }]); return; }
  const plan = B.mergePlan(existing, p.records);
  const body = `
    <p>백업 시각 ${esc(p.exportedAt || "알 수 없음")} · 기록 ${p.records.length}개${p.rejected.length ? ` · 형식 오류로 제외 ${p.rejected.length}개` : ""}</p>
    <div class="radio-row">
      <label><input type="radio" name="mode" value="merge" checked><span><b>합치기</b><br>현재 기록 유지 + 새 기록 ${plan.added}개 추가, 같은 기록 ${plan.replaced}개는 백업 내용으로 교체 → 총 ${plan.total}개</span></label>
      <label><input type="radio" name="mode" value="replace"><span><b>전체 교체</b><br>현재 기록 ${existing.length}개를 지우고 백업의 ${p.records.length}개로 바꿈</span></label>
    </div>`;
  const k = await ask("백업 복원", body, [{ key: "go", label: "복원", kind: "primary" }, { key: "no", label: "취소", kind: "ghost" }]);
  if (k !== "go") return;
  const mode = (document.querySelector('#modal input[name="mode"]:checked') || {}).value || "merge";
  try {
    if (mode === "replace") await Store.clearSessions();
    await Store.putMany(p.records);
    if (p.settings) {
      if (Number.isFinite(p.settings.bpm)) { metro.bpm = p.settings.bpm; Store.setSetting("bpm", metro.bpm); }
      if (Number.isFinite(p.settings.beats)) { metro.beats = p.settings.beats; Store.setSetting("beats", metro.beats); }
    }
    toast(mode === "replace" ? `전체 교체 완료 (${p.records.length}개)` : `합치기 완료 (총 ${plan.total}개)`);
    render();
  } catch (e) {
    toast("복원 실패: " + e.message);
  }
}

// ───────────── 하단 진행 중 세션 표시 ─────────────
let dockTimer = null;
function updateDock() {
  const dock = $("#sessionDock");
  const s = S.getActive();
  const onSession = parseRoute()[0] === "session";
  const show = !!s && !onSession;
  dock.classList.toggle("hidden", !show);
  clearInterval(dockTimer);
  if (!show) return;
  const paint = () => {
    const cur = S.getActive();
    if (!cur) { dock.classList.add("hidden"); clearInterval(dockTimer); return; }
    dock.classList.toggle("paused", cur.status !== "running");
    $("#dockText").textContent = `${cur.status === "running" ? "진행 중" : "일시정지"} · ${moduleName(cur.module)} · ${taskName(cur.module, cur.level, cur.task)}`;
    $("#dockTime").textContent = formatDuration(S.elapsedSec());
  };
  paint();
  dockTimer = setInterval(paint, 500);
}

// ───────────── 시작 ─────────────
async function boot() {
  await Store.initStorage();
  S.initSessions();
  S.subscribe(s => {
    // 자동 일시정지 등으로 실행이 멈추면 메트로놈·화면 유지도 멈춤
    if (!s || s.status !== "running") {
      if (metro.on) { metro.resumeAfterPause = true; metroStop(); }
      holdScreen(false);
    }
    updateDock();
  });
  document.addEventListener("visibilitychange", () => {
    const s = S.getActive();
    if (document.visibilityState === "visible" && s && s.status === "running") holdScreen(true);
  });
  $("#homeBtn").onclick = () => go("");
  const dock = $("#sessionDock");
  dock.onclick = () => go("session");
  dock.onkeydown = e => { if (e.key === "Enter") go("session"); };
  window.addEventListener("hashchange", render);
  if (!location.hash) history.replaceState(null, "", "#/");
  // 앱을 다시 열었을 때 진행 중 세션이 있으면 그 화면으로
  if (S.getActive() && S.peekAutoPauseNotice() && parseRoute().length === 0) history.replaceState(null, "", "#/session");
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();

// 테스트에서 상태 확인용
window.__fretlab = { S, Store, Metro, version: APP_VERSION };
