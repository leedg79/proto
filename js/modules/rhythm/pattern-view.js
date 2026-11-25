// Rhythm 패턴 연습 화면(R1 스트로크, R2 컴핑·핑거스타일·퍼커시브 공용)
// 화면: 리듬 악보(또는 TAB), 칸 표(손 흐름·지금 칸), 코드 진행표, 지금·다음 코드 운지, 설명
// 방식: 시범 듣기 → 같이 치기(시범 소리 작게) → 혼자 치기(시범 소리 없음). 같이·혼자 치기 8마디 = 완료 1회 → 다음 패턴

import * as R from "./rhythm-core.js";
import { CHORD_SETS } from "./rhythm-data.js";
import { rhythmSvg } from "../../render/rhythm.js";
import { scoreSvg } from "../../render/score.js";
import { chordBoxSvg } from "../../render/chordbox.js";
import { startRhythm, stopRhythm, setRhythmBpm, setRhythmLevel, isRhythmRunning } from "../../audio/rhythm-player.js";
import { progVoicings } from "../chords/comping-core.js";
import { keyName } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, keyPickerHtml, makeStore, pickKey } from "../scales/common.js";

export const MODES = [["listen", "시범 듣기"], ["along", "같이 치기"], ["solo", "혼자 치기"]];
const MODE_LEVEL = { listen: 0.9, along: 0.28, solo: 0 };
const BARS_PER_UNIT = 8;
const BACKINGS = [["click", "클릭"], ["drums", "드럼"], ["band", "드럼+베이스"]];
const ORDERS = [["seq", "순서대로"], ["rand", "무작위"]];
const BPM_MIN = 40, BPM_MAX = 180;
const clampBpm = v => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(v) || 80)));

const KIND_INFO = {
  strum: { store: "fretlab:rhs1", inst: "acoustic", defBacking: "click", defBpm: 70, chordSet: true },
  comp: { store: "fretlab:rhc1", inst: "acoustic", defBacking: "band", defBpm: 85, chordSet: false },
  finger: { store: "fretlab:rhf1", inst: "acoustic", defBacking: "click", defBpm: 65, chordSet: true },
  perc: { store: "fretlab:rhp1", inst: "acoustic", defBacking: "click", defBpm: 80, chordSet: true }
};

// 패턴 칸 표
export function gridHtml(p, { now = -1, showAir = true, hide = false } = {}) {
  const rows = [];
  const labels = R.countLabels(p.grid);
  for (let b = 0; b < p.bars; b++) {
    const cells = [];
    for (let k = 0; k < p.grid; k++) {
      const i = b * p.grid + k;
      const hit = R.isHitCell(p, i);
      let txt = hide ? "" : R.cellText(p, i);
      const air = !hit && p.tokens[i] === ".";
      if (!hide && air && showAir && (p.kind === "strum" || p.kind === "comp") && !p.opts.pluck) txt = R.dirOf(p, i) === "up" ? "↑" : "↓";
      const cls = ["rg-c", hit && !hide ? "hit" : "", air && !hide ? "air" : "", p.tokens[i] === "r" && !hide ? "rest" : "", R.isAccent(p, i) && !hide ? "acc" : "", k % (p.grid / 4) === 0 ? "rg-beat" : "", i === now ? "now" : "", txt.length > 2 ? "long" : ""].filter(Boolean).join(" ");
      cells.push(`<span class="${cls}" data-i="${i}">${esc(txt)}</span>`);
    }
    const lab = labels.map((x, k) => `<span class="rg-l ${k % (p.grid / 4) === 0 ? "rg-beat" : ""}">${x}</span>`).join("");
    rows.push(`<div class="rgrid" style="grid-template-columns:repeat(${p.grid},minmax(0,1fr))">${cells.join("")}</div><div class="rgrid lab" style="grid-template-columns:repeat(${p.grid},minmax(0,1fr))">${lab}</div>`);
  }
  return `<div class="rgrid-wrap">${rows.join("")}</div>`;
}

export const PERC_LEGEND = "K 엄지로 몸통(킥) · S 손바닥으로 줄 때리기(슬랩) · T 손가락으로 몸통 두드리기(탭) · P 팜뮤트 근음 · ↓↑ 스트럼 · x 뮤트";
export const FINGER_LEGEND = "p 엄지(근음 베이스) · p' 엄지(교대 베이스) · i 검지(3번 줄) · m 중지(2번 줄) · a 약지(1번 줄)";

const lcm = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return (a * b) / g(a, b); };

export function makePatternTask(kind) {
  const info = KIND_INFO[kind];
  const P = `rh.${kind}`;                                  // 설정 저장 키
  const I = `rh${kind[0].toUpperCase()}${kind.slice(1)}`;   // 화면 요소 id
  const store = makeStore(info.store);

  function settingsHtml() {
    const bpm = clampBpm(getSetting(`${P}.bpm`, info.defBpm));
    return `
      ${info.chordSet
        ? `<div class="field"><label>코드 진행</label>${segHtml(`${I}Set`, CHORD_SETS.map(c => [c[0], c[1]]), getSetting(`${P}.set`, kind === "strum" ? "g-c-d" : "c-am-f-g"))}</div>
           <div class="field" style="margin-top:14px"><label>반주</label>${segHtml(`${I}Back`, BACKINGS, getSetting(`${P}.back`, info.defBacking))}</div>`
        : `<div class="field"><label>키</label>${keyPickerHtml(`${I}Key`, `${P}.key`)}</div>
           <div class="field" style="margin-top:14px"><label>클릭</label>${segHtml(`${I}Click`, [["on", "드럼·베이스 + 클릭"], ["off", "드럼·베이스만"]], getSetting(`${P}.click`, "off"))}</div>`}
      <div class="field" style="margin-top:14px"><label>패턴 순서</label>${segHtml(`${I}Order`, ORDERS, getSetting(`${P}.order`, "seq"))}</div>
      <div class="field" style="margin-top:14px">
        <label for="${I}Bpm">BPM <b id="${I}BpmOut">${bpm}</b></label>
        <input id="${I}Bpm" type="range" min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="${bpm}">
      </div>
      <p class="muted small" style="margin:4px 0 0">고른 주제의 패턴을 하나씩 연습함. 시범 듣기 → 같이 치기(시범 소리 작게) → 혼자 치기 순서로. 같이·혼자 치기로 ${BARS_PER_UNIT}마디를 치면 완료 1회, 다음 패턴으로 넘어감</p>`;
  }
  function bindSettings(root) {
    [`${I}Set`, `${I}Back`, `${I}Key`, `${I}Click`, `${I}Order`].forEach(id => bindPicker(root, id));
    const r = root.querySelector(`#${I}Bpm`);
    r.oninput = () => { root.querySelector(`#${I}BpmOut`).textContent = r.value; };
  }
  function readSettings(root) {
    const o = { bpm: clampBpm(root.querySelector(`#${I}Bpm`).value), order: readSel(root, `${I}Order`, "v") || "seq" };
    setSetting(`${P}.bpm`, o.bpm); setSetting(`${P}.order`, o.order);
    if (info.chordSet) {
      o.set = readSel(root, `${I}Set`, "v") || "g-c-d"; o.back = readSel(root, `${I}Back`, "v") || info.defBacking;
      setSetting(`${P}.set`, o.set); setSetting(`${P}.back`, o.back);
    } else {
      o.key = Number(readSel(root, `${I}Key`)); o.click = readSel(root, `${I}Click`, "v") || "off";
      setSetting(`${P}.key`, o.key); setSetting(`${P}.click`, o.click);
    }
    return o;
  }

  function mount(container, api) {
    const s0 = api.getActive();
    const o = s0.options || {};
    const pool = R.patternsFor(kind, s0.topics);
    const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let st = store.load(s0.id) || {
      order: (o.order === "rand" ? shuffle(pool) : pool).map(p => p.id), n: 0, units: 0, mode: "listen",
      bpm: clampBpm(o.bpm || info.defBpm), set: o.set || "g-c-d", back: o.back || info.defBacking, key: pickKey(o.key ?? -1), click: o.click || "off"
    };
    const persist = () => store.save(s0.id, st);
    let p, events = [], chords, voicings, loopBars, counted = 0, bar = -1, playing = false, stepEls = null, lastOn = [];

    container.innerHTML = `
      <div class="nf rh">
        <div class="nf-meta"><span id="rhNo"></span><span id="rhProg"></span></div>
        <div class="rh-head"><b id="rhName"></b><small id="rhTopic" class="muted"></small></div>
        <div class="score-wrap" id="rhScore"></div>
        <div id="rhGrid"></div>
        <p class="muted small" id="rhLegend" style="margin:6px 0 0"></p>
        <div class="jam-chart" id="rhChart"></div>
        <div class="cmp-now">
          <div><small>지금</small><div id="rhNow" class="cmp-box"></div></div>
          <div><small>다음</small><div id="rhNext" class="cmp-box"></div></div>
        </div>
        <p class="small rh-tip" id="rhTip"></p>
        ${segHtml("rhMode", MODES, st.mode)}
        <div class="jam-state muted small" id="rhState">정지</div>
        <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="rhPlay" type="button">시작</button></div>
        <div class="btn-row" style="gap:8px;margin-top:8px">
          <button class="btn small" id="rhPrev" type="button">← 이전 패턴</button>
          <button class="btn small" id="rhNextP" type="button">다음 패턴 →</button>
        </div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button><button type="button" data-bpm="-1">−1</button>
          <div class="bpm-val"><b id="rhBpm">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="1">+1</button><button type="button" data-bpm="5">+5</button>
        </div></div>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };

    function load() {
      p = R.patternById(st.order[st.n % st.order.length]) || pool[0];
      if (kind === "comp") {
        const pv = progVoicings(p.opts.prog, st.key, p.opts.voicing);
        chords = pv.bars.map(b => b.name);
        voicings = pv.voicings.map((v, i) => (v ? R.withBass({ ...v, name: pv.bars[i].name }) : null));
      } else {
        chords = R.chordSet(st.set);
        voicings = chords.map(R.chordVoicing);
      }
      loopBars = lcm(chords.length, p.bars);
      events = kind === "strum" || kind === "comp" ? R.soundEvents(p) : [];
      counted = 0; bar = -1;
    }
    const vAt = i => voicings[((i % voicings.length) + voicings.length) % voicings.length];
    const nameAt = i => chords[((i % chords.length) + chords.length) % chords.length];

    function drawScore() {
      const el = $("#rhScore");
      stepEls = null;
      if (kind === "perc") { el.innerHTML = ""; el.classList.add("hidden"); return; }
      el.classList.remove("hidden");
      if (kind === "finger") {
        const cur = vAt(Math.max(0, bar));
        if (!scoreSvg(el, R.fingerTabEvents(p, cur, Math.max(0, bar)), { ticks: 48, chords: [{ name: cur.name, at: 0 }] })) el.textContent = "악보를 그릴 수 없음";
        return;
      }
      const names = Array.from({ length: p.bars }, (_, b) => nameAt(Math.max(0, bar) - (Math.max(0, bar) % p.bars) + b));
      const res = rhythmSvg(el, p, { chords: names });
      if (!res) { el.textContent = "악보를 그릴 수 없음"; return; }
      // 칸 번호 → 음표 그림 요소
      stepEls = new Map();
      el.querySelectorAll("[data-step]").forEach(g => { const k = Number(g.dataset.step); stepEls.set(k, [...(stepEls.get(k) || []), g]); });
    }
    function drawChords() {
      $("#rhChart").innerHTML = chords.map((c, i) => `<div class="jam-bar ${bar >= 0 && i === bar % chords.length ? "now" : ""}"><small>${i + 1}</small><b>${esc(c)}</b></div>`).join("");
      const cur = Math.max(0, bar);
      const box = (v, name) => (v ? `<figure class="chord-cell" data-midis="${v.notes.map(n => n.midi).join(",")}">${chordBoxSvg(v)}<figcaption>${esc(name)}</figcaption></figure>` : `<div class="muted small">${esc(name)}</div>`);
      $("#rhNow").innerHTML = box(vAt(cur), nameAt(cur));
      $("#rhNext").innerHTML = box(vAt(cur + 1), nameAt(cur + 1));
    }
    function drawAll() {
      $("#rhNo").textContent = `${(st.n % st.order.length) + 1}/${st.order.length} · ${p.id}`;
      $("#rhName").textContent = p.name;
      const sub = kind === "comp" ? ` · ${keyName(st.key, "major")} 키 · ${chords.length}마디 진행` : "";
      $("#rhTopic").textContent = `${R.TOPIC_NAMES[p.topic] || p.topic}${p.opts.swing ? " · 셔플" : ""}${sub}`;
      $("#rhTip").textContent = p.tip;
      $("#rhLegend").textContent = kind === "perc" ? R_LEGEND.perc : kind === "finger" ? R_LEGEND.finger : p.opts.pluck ? "● 손가락으로 뜯기" : "↓ 다운 · ↑ 업 · 흐린 화살표 = 허공 스트로크 · x 뮤트(칙) · P 팜뮤트 · ∅ 끊기 · 진한 칸 = 강세";
      drawProg();
      drawScore();
      $("#rhGrid").innerHTML = gridHtml(p);
      drawChords();
    }
    function drawProg() { $("#rhProg").textContent = `${st.mode === "listen" ? "듣기" : `${counted}/${BARS_PER_UNIT}마디`} · 완료 ${st.units}회`; }

    function onStep(b, step) {
      const i = (b % p.bars) * p.grid + step;
      container.querySelectorAll(".rg-c.now").forEach(x => x.classList.remove("now"));
      const c = container.querySelector(`.rg-c[data-i="${i}"]`);
      if (c) c.classList.add("now");
      if (stepEls) {
        // 지금 울리는 음 = 지금 칸 이전의 마지막 사건(끊기면 없음)
        let last = null;
        for (const e of events) if (e.i <= i) last = e;
        lastOn.forEach(x => x.classList.remove("on"));
        lastOn = last && last.type !== "rest" ? stepEls.get(last.i) || [] : [];
        lastOn.forEach(x => x.classList.add("on"));
      }
    }

    function onBar(b, loop) {
      bar = b;
      if (playing && st.mode !== "listen" && (loop > 0 || b > 0 || counted > 0)) {
        counted++;
        if (counted >= BARS_PER_UNIT) {
          st = { ...st, units: st.units + 1, n: st.n + 1 }; persist();
          api.addUnit(1); api.toast(`${p.name} ${BARS_PER_UNIT}마디 완료 · 이번 세션 ${st.units}회`);
          stop(); load(); drawAll(); return;
        }
      }
      $("#rhState").textContent = `${b + 1}마디 · ${nameAt(b)}`;
      drawProg();
      if (kind === "finger" || p.bars > 1 || chords.length > 1) drawScore();
      drawChords();
    }
    async function play() {
      if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
      $("#rhPlay").textContent = "음원 불러오는 중…";
      const backing = kind === "comp"
        ? { prog: p.opts.prog, key: st.key, style: p.opts.style }
        : st.back === "click" ? null : { prog: { bars: chords.map(() => "I"), style: p.opts.swing ? "shuffle" : "straight" }, custom: R.customBars(chords), key: 0, style: p.opts.swing ? "shuffle" : "straight" };
      try {
        counted = 0;
        await startRhythm({
          bpm: st.bpm, loopBars, countIn: 4, swing: !!p.opts.swing, grid: p.grid,
          click: kind === "comp" ? st.click === "on" : st.back !== "band",
          backing, noBass: kind !== "comp" && st.back === "drums", inst: p.opts.inst || info.inst,
          barEvents: b => R.barEvents(p, b, vAt(b), vAt(b + 1)),
          onCount: left => { $("#rhState").textContent = `준비 ${left}`; },
          onBar, onStep
        });
        setRhythmLevel("guitar", MODE_LEVEL[st.mode]);
        playing = true; $("#rhPlay").textContent = "멈춤";
      } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#rhPlay").textContent = "시작"; }
    }
    function stop() {
      stopRhythm(); playing = false; bar = -1; counted = 0;
      $("#rhPlay").textContent = "시작"; $("#rhState").textContent = "정지";
      container.querySelectorAll(".rg-c.now").forEach(x => x.classList.remove("now"));
      lastOn.forEach(x => x.classList.remove("on")); lastOn = [];
      drawProg(); drawChords();
    }
    function go(d) { stop(); st = { ...st, n: (st.n + d + st.order.length) % st.order.length }; persist(); load(); drawAll(); }

    $("#rhPlay").onclick = () => (isRhythmRunning() ? stop() : play());
    $("#rhPrev").onclick = () => go(-1);
    $("#rhNextP").onclick = () => go(1);
    $("#rhMode").onclick = e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      $("#rhMode").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
      st = { ...st, mode: b.dataset.v }; persist();
      setRhythmLevel("guitar", MODE_LEVEL[st.mode]);
      counted = 0; drawProg();
    };
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b) return;
      st = { ...st, bpm: clampBpm(st.bpm + Number(b.dataset.bpm)) };
      setSetting(`${P}.bpm`, st.bpm); setRhythmBpm(st.bpm); $("#rhBpm").textContent = st.bpm; persist();
    });
    const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
    load(); drawAll(); persist();
    return () => { clearInterval(watch); stopRhythm(); };
  }

  return { settingsHtml, bindSettings, readSettings, mount, clearFinder: () => store.clear() };
}

const R_LEGEND = { perc: PERC_LEGEND, finger: FINGER_LEGEND };
