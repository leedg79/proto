// 릭 활용 과제 3개
// LickMove(키·구간 옮기기): 원래 릭을 보고 "C 키 · 7~11프렛 근처"에서 치기 → 시간이 끝나거나 확인하면 옮긴 악보·지판 공개. 10개 = 1회
// LickVary(변형하기): 원래 릭 + 변형 지시(리듬 밀기·앞부분만·끝음 바꾸기 등) → 확인 때 변형 악보·소리. 10개 = 1회
// LickBacking(백킹 주고받기): 릭의 코드 반주 위에서 앱이 릭을 치면(듣기) 다음 마디에 같은 릭으로 답하기. 릭 4개 = 1회

import { licksFor, realize, LICKS } from "./lick-core.js";
import { lickCardHtml, paintScores, paintScore, bindPlayButtons, bindFlagButtons } from "./lick-card.js";
import { setFlag } from "./lick-flags.js";
import { moveTo, makeVariation, variationTypes, VARIATIONS, callResponse } from "./apply-core.js";
import { regionRange, REGIONS, shuffle, clampTime, TIME_MIN, TIME_MAX, TIME_DEFAULT } from "../scales/drill-core.js";
import { scoreSvg } from "../../render/score.js";
import { playLick, stopLick } from "../../audio/lick-player.js";
import { startBacking, stopBacking, isBackingRunning, setBackingBpm, preload } from "../../audio/backing-player.js";
import { KEY_LIST, keyName } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { lickSeq, pcsTarget, followTarget, midiAt } from "../../eval/targets.js";
import { SCALES } from "../../theory/scales.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FLATS = [5, 10, 3, 8, 1, 6];
const VTYPES = [["random", "무작위"], ...Object.entries(VARIATIONS).map(([k, v]) => [k, v.split(":")[0]])];
const poolOf = s0 => { const p = licksFor(s0.level, s0.topics || []); return p.length ? p : licksFor(s0.level); };

// ── 문제형(옮기기·변형) 공용 ──
function promptTask({ p, storeKey, kind }) {
  return {
    clearFinder: () => makeStore(storeKey).clear(),
    settingsHtml() {
      const t = clampTime(getSetting(`${p}.time`, 20));
      return `${kind === "move" ? `<div class="field"><label>옮길 구간</label>${segHtml(`${p}Region`, REGIONS, getSetting(`${p}.region`, "random"))}</div>` : `<div class="field"><label>변형 종류</label>${segHtml(`${p}Type`, VTYPES, getSetting(`${p}.type`, "random"))}</div>`}
        <div class="field" style="margin-top:14px"><label for="${p}Time">제한시간 <b id="${p}TimeOut">${t}초</b></label>
        <input id="${p}Time" type="range" min="${TIME_MIN}" max="${TIME_MAX}" step="1" value="${t}"></div>
        <p class="muted small" style="margin:4px 0 0">${kind === "move" ? "릭을 보고 다른 키·구간에서 같은 모양으로 치기. 모양(근음 위치·도수)은 그대로, 위치만 옮김" : "릭을 보고 지시대로 바꿔 치기. 확인 때 변형 악보와 소리가 나옴"}. 10개 = 완료 1회</p>`;
    },
    bindSettings(root) {
      if (kind === "move") bindPicker(root, `${p}Region`); else bindPicker(root, `${p}Type`);
      const r = root.querySelector(`#${p}Time`);
      r.oninput = () => { root.querySelector(`#${p}TimeOut`).textContent = r.value + "초"; };
    },
    readSettings(root) {
      const timeLimit = clampTime(root.querySelector(`#${p}Time`).value);
      const region = kind === "move" ? readSel(root, `${p}Region`, "v") || "random" : null;
      const vtype = kind === "vary" ? readSel(root, `${p}Type`, "v") || "random" : null;
      setSetting(`${p}.time`, timeLimit); if (region) setSetting(`${p}.region`, region); if (vtype) setSetting(`${p}.type`, vtype);
      return { timeLimit, region, vtype };
    },
    mount(container, api) {
      const s0 = api.getActive();
      const o = s0.options || {};
      const store = makeStore(storeKey);
      const makeDeck = () => shuffle(poolOf(s0)).slice(0, 10).map(l => {
        if (kind === "move") {
          const region = regionRange(o.region || "random");
          let key = KEY_LIST[Math.floor(Math.random() * 12)];
          if (key === l.key) key = KEY_LIST[(KEY_LIST.indexOf(key) + 5) % 12];
          return { id: l.id, key, region };
        }
        return { id: l.id, type: pickType(l, st ? st.vtype : o.vtype || "random") };
      });
      // 고른 변형 종류를 이 릭에 쓸 수 없으면(예: 옥타브 이동이 지판 밖) 무작위
      const pickType = (l, want) => { const types = variationTypes(realize(l)); return types.includes(want) ? want : types[Math.floor(Math.random() * types.length)]; };
      let st = null;
      st = store.load(s0.id) || { deck: makeDeck(), idx: -1, done: 0, units: 0, timeLimit: clampTime(o.timeLimit || 20), cur: null, vtype: o.vtype || "random" };
      const unplay = bindPlayButtons(container, id => LICKS.find(x => x.id === id), () => 80);

      container.innerHTML = `
        <div class="nf">
          <div class="nf-meta"><span id="apNo"></span><span id="apProg"></span></div>
          <div class="prompt-card" id="apCard"><div class="prompt-caption">${kind === "move" ? "MOVE THIS LICK" : "VARY THIS LICK"}</div>
            <div class="prompt-main ap-main" id="apMain">-</div><div class="prompt-sub" id="apSub"></div></div>
          ${kind === "vary" ? `<div class="field" style="margin-top:10px"><label>변형 종류 (바로 바뀜)</label>${segHtml("apType", VTYPES, st.vtype || "random")}</div>` : ""}
          <div id="apOrig"></div>
          <div class="timer-wrap"><div class="timer-track"><div id="apBar"></div></div><div class="timer-text" id="apTimer">0.0</div></div>
          <div class="ctl-dock">
          <div class="nf-actions"><button class="btn primary wide" id="apReveal" type="button">정답 확인</button><button class="btn primary wide hidden" id="apNext" type="button">다음 →</button></div>
          </div>
          <div id="apAnswer"></div>
        </div>`;
      const $ = s => container.querySelector(s);
      const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
      const persist = () => store.save(s0.id, st);
      const item = () => st.deck[Math.max(0, st.idx)];
      function next() {
        if (!running()) return;
        let { deck, idx, done } = st;
        if (idx + 1 >= deck.length) { deck = makeDeck(); idx = -1; done = 0; }
        st = { ...st, deck, idx: idx + 1, done, cur: { start: api.elapsedMs(), revealed: false } };
        persist(); draw(); evalPrompt();
      }
      // 연주 평가: 옮기기 = 옮긴 릭의 음을 순서대로(옥타브 무관), 변형 = 릭의 스케일 안에서 쳤는지
      function evalPrompt() {
        const it = item();
        if (!api.eval || !it || !st.cur || st.cur.revealed) return;
        const l = LICKS.find(x => x.id === it.id), r = realize(l);
        if (kind === "move") {
          const t = moveTo(r, it.key, it.region);
          api.eval.prompt({ ...lickSeq(`${l.id} → ${keyName(it.key, "major")} 키`, t.events, true), repeat: true });
        } else {
          const pcs = SCALES[r.scale] ? SCALES[r.scale].steps.map(x => r.key + x) : r.notes.map(n => n.midi);
          api.eval.prompt({ ...pcsTarget(`${l.id} 변형 · ${VARIATIONS[it.type].split(":")[0]}`, pcs), cover: false });
        }
      }
      function reveal(timedOut) {
        if (!st.cur || st.cur.revealed) return;
        if (api.eval) api.eval.end();
        const done = st.done + 1, complete = done >= st.deck.length;
        st = { ...st, done, units: st.units + (complete ? 1 : 0), cur: { ...st.cur, revealed: true, timedOut } };
        persist();
        if (complete) { api.addUnit(1); api.toast(`10개 완료 · 이번 세션 ${st.units}회`); }
        draw();
      }
      function draw() {
        const it = item(); if (!st.cur || !it) return;
        const l = LICKS.find(x => x.id === it.id);
        const r = realize(l);
        $("#apNo").textContent = `${st.idx + 1}/${st.deck.length}`;
        $("#apProg").textContent = `${st.done}/10 · 완료 ${st.units}회`;
        $("#apMain").textContent = kind === "move" ? `${keyName(it.key, "major")} 키` : VARIATIONS[it.type].split(":")[0];
        $("#apSub").textContent = kind === "move" ? `${it.region.label} 근처에서 · 원래 ${keyName(l.key, "major")} 키 ${r.blockName}` : VARIATIONS[it.type].split(":")[1].trim();
        $("#apOrig").innerHTML = `<div class="muted small" style="margin:8px 0 4px">원래 릭 ${esc(l.id)} · ${esc(r.title)} · 도수 ${esc(r.notes.map(n => n.deg).join(" "))}</div><div class="tab-wrap score-wrap" id="apOrigScore"></div>`;
        scoreSvg($("#apOrigScore"), r.events, { chords: r.chords, ticks: r.ticks, flats: FLATS.includes(r.key) });
        $("#apReveal").classList.toggle("hidden", st.cur.revealed);
        $("#apNext").classList.toggle("hidden", !st.cur.revealed);
        const ans = $("#apAnswer");
        if (!st.cur.revealed) { ans.innerHTML = ""; return; }
        const target = kind === "move" ? moveTo(r, it.key, it.region) : makeVariation(r, it.type);
        ans.innerHTML = `<div class="answer-title">${kind === "move" ? `${esc(keyName(it.key, "major"))} 키 · ${target.events.flatMap(e => e.notes.map(n => n.f)).reduce((a, f) => Math.min(a, f), 99)}~${target.events.flatMap(e => e.notes.map(n => n.f)).reduce((a, f) => Math.max(a, f), 0)}프렛` : esc(VARIATIONS[it.type])}${st.cur.timedOut ? ' <span class="tag">시간 종료</span>' : ""}</div>
          <div class="lick-play-row"><button type="button" class="btn small primary" id="apPlay">▶ 듣기</button></div>
          <div class="tab-wrap score-wrap" id="apAnsScore"></div>`;
        scoreSvg($("#apAnsScore"), target.events, { chords: target.chords, ticks: target.ticks || r.ticks, flats: FLATS.includes(target.key) });
        $("#apPlay").onclick = async () => {
          try { await playLick({ ...target, feel: r.feel, ticks: target.ticks || r.ticks }, 80, { onEvent: i => { scoreSvg($("#apAnsScore"), target.events, { chords: target.chords, ticks: target.ticks || r.ticks, flats: FLATS.includes(target.key), active: i }); } }); } catch (_) { api.toast("소리를 켤 수 없음"); }
        };
      }
      function tick() {
        const on = running();
        if (on && !st.cur) next();
        const live = st.cur && !st.cur.revealed;
        const rem = live ? Math.max(0, st.timeLimit * 1000 - (api.elapsedMs() - st.cur.start)) : 0;
        $("#apTimer").textContent = (rem / 1000).toFixed(1);
        $("#apBar").style.width = (live ? (rem / (st.timeLimit * 1000)) * 100 : 0) + "%";
        $("#apReveal").disabled = !on; $("#apNext").disabled = !on;
        if (on && live && rem <= 0) reveal(true);
      }
      if (kind === "vary") $("#apType").onclick = e => {
        const b = e.target.closest("button[data-v]"); if (!b) return;
        $("#apType").querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
        const vtype = b.dataset.v;
        setSetting(`${p}.type`, vtype);
        // 지금 문제와 남은 문제의 변형 종류를 바로 바꿈
        const deck = st.deck.map((it, i) => (i >= Math.max(0, st.idx) ? { ...it, type: pickType(LICKS.find(x => x.id === it.id), vtype) } : it));
        st = { ...st, vtype, deck }; persist(); draw();
      };
      $("#apReveal").onclick = () => reveal(false);
      $("#apNext").onclick = () => { stopLick(); next(); };
      draw(); tick(); evalPrompt();
      const timer = setInterval(tick, 100);
      return () => { clearInterval(timer); unplay(); stopLick(); if (api.eval) api.eval.end(); };
    }
  };
}

export const LickMove = promptTask({ p: "lm", storeKey: "fretlab:lm1", kind: "move" });
export const LickVary = promptTask({ p: "lv", storeKey: "fretlab:lv1", kind: "vary" });

// ── 백킹 주고받기 ──
export const LickBacking = {
  clearFinder: () => makeStore("fretlab:lb1").clear(),
  settingsHtml() {
    return `<div class="field"><label>키</label>${segHtml("lbKey", [["orig", "릭 원래 키"], ["random", "무작위 키"]], getSetting("lb.key", "orig"))}</div>
      <p class="muted small" style="margin:4px 0 0">릭에 맞는 코드 반주가 돌고, 앞 마디에서 앱이 릭을 치면(듣기) 다음 마디에 같은 릭으로 답함. 한 릭을 두 번 주고받으면 다음 릭. 릭 4개 = 완료 1회</p>`;
  },
  bindSettings(root) { bindPicker(root, "lbKey"); },
  readSettings(root) { const key = readSel(root, "lbKey", "v") === "random" ? "random" : "orig"; setSetting("lb.key", key); return { key }; },
  mount(container, api) {
    const s0 = api.getActive();
    const o = s0.options || {};
    const store = makeStore("fretlab:lb1");
    const pool = poolOf(s0);
    const pickKeyFor = l => (o.key === "random" ? KEY_LIST[Math.floor(Math.random() * 12)] : l.key);
    let st = store.load(s0.id) || { order: shuffle(pool.map(l => l.id)), idx: 0, done: 0, units: 0, bpm: 80, keys: {} };
    let rounds = 0, playing = false, phase = "", r = null;
    const cur = () => { const id = st.order[st.idx % st.order.length]; if (st.keys[id] === undefined) st.keys[id] = pickKeyFor(LICKS.find(x => x.id === id)); return realize(LICKS.find(x => x.id === id), st.keys[id]); };

    container.innerHTML = `
      <div class="nf">
        <div class="nf-meta"><span id="lbNo"></span><span id="lbProg"></span></div>
        <div class="lb-phase" id="lbPhase">준비</div>
        <div id="lbCard"></div>
        <div class="jam-state muted small" id="lbState">정지</div>
        <div class="ctl-dock">
        <div class="nf-actions" style="margin-top:8px"><button class="btn primary wide" id="lbPlay" type="button" data-autostart>반주 시작</button></div>
        <div class="bf-controls"><div class="bpm-row">
          <button type="button" data-bpm="-5">−5</button>
          <div class="bpm-val"><b id="lbBpm">${st.bpm}</b><span>BPM</span></div>
          <button type="button" data-bpm="5">+5</button>
          <button type="button" class="btn small" id="lbSkip">다음 릭</button>
        </div></div>
        </div>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
    const persist = () => store.save(s0.id, st);
    bindFlagButtons(container, (id, v) => { setFlag(id, v); draw(); });
    function draw() {
      r = cur();
      $("#lbNo").textContent = `릭 ${st.done % 4 + 1}/4`;
      $("#lbProg").textContent = `완료 ${st.units}회`;
      $("#lbCard").innerHTML = lickCardHtml(LICKS.find(x => x.id === r.id), { key: r.key });
      paintScores($("#lbCard"), id => LICKS.find(x => x.id === id));
      const btn = container.querySelector("#lbCard [data-play]"); if (btn) btn.remove();
    }
    function setPhase(p) { phase = p; $("#lbPhase").textContent = p === "call" ? "듣기 · 앱이 연주" : p === "resp" ? "내 차례 · 같은 릭으로 답하기" : "준비"; $("#lbPhase").className = "lb-phase " + p; }
    async function play() {
      if (!running()) { api.toast("세션을 재개한 뒤 시작할 수 있음"); return; }
      $("#lbPlay").textContent = "음원 불러오는 중…";
      try {
        await preload();
        const plan = callResponse(r);
        rounds = 0;
        await startBacking({
          custom: plan.custom, style: plan.style, key: r.key, bpm: st.bpm,
          onBarTime: (bar, loop, time) => {
            if (bar === 0) playLick(r, st.bpm, { startAt: time, keep: true, onEvent: i => { const el = container.querySelector("#lbCard [data-score]"); if (el && i >= 0) paintScore(el, LICKS.find(x => x.id === r.id), i); } });
            // 연주 평가: 응답 차례(뒤 절반)에 같은 릭을 제때·맞는 음으로 쳤는지
            if (bar === plan.bars && api.eval) {
              api.eval.prompt(followTarget(`${r.id} 응답`));
              const spb = 60 / st.bpm;
              r.events.forEach((e, i) => { if (e.notes && e.notes.length) api.eval.expect(`${i + 1}번째 음`, time + (e.at / 12) * spb, { midis: [...e.notes.map(n => midiAt(n.s, n.f)), ...Array.from({ length: Math.ceil(e.bend || 0) }, (_, k) => midiAt(e.notes[0].s, e.notes[0].f) + k + 1)] }); });
            }
          },
          onBar: (bar, loop) => {
            const half = plan.bars;
            if (bar === 0) { setPhase("call"); if (loop > 0) { rounds++; if (rounds >= 2) { advance(); return; } } }
            if (bar === half) setPhase("resp");
            $("#lbState").textContent = `${bar + 1}마디 · ${plan.custom[bar].segs.map(x => x.name).join(" / ")}`;
          },
          onBeat: (b, counting, left) => { if (counting) $("#lbState").textContent = `준비 ${left}`; }
        });
        playing = true; $("#lbPlay").textContent = "멈춤";
      } catch (e) { api.toast("소리를 켤 수 없음: " + e.message); $("#lbPlay").textContent = "반주 시작"; }
    }
    function stop() { stopBacking(); stopLick(); if (playing && api.eval) api.eval.end(); playing = false; setPhase(""); $("#lbPlay").textContent = "반주 시작"; $("#lbState").textContent = "정지"; }
    function advance() {
      stop();
      const done = st.done + 1, complete = done % 4 === 0;
      st = { ...st, idx: st.idx + 1, done, units: st.units + (complete ? 1 : 0) };
      persist();
      if (complete) { api.addUnit(1); api.toast(`릭 4개 주고받기 완료 · 이번 세션 ${st.units}회`); }
      draw();
      if (running()) play();
    }
    $("#lbPlay").onclick = () => (isBackingRunning() ? stop() : play());
    $("#lbSkip").onclick = () => { const was = playing; stop(); st = { ...st, idx: st.idx + 1 }; persist(); draw(); if (was) play(); };
    container.querySelector(".bf-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-bpm]"); if (!b) return;
      st = { ...st, bpm: Math.max(50, Math.min(160, st.bpm + Number(b.dataset.bpm))) }; persist(); $("#lbBpm").textContent = st.bpm;
      if (playing) { stop(); play(); }
    });
    const watch = setInterval(() => { if (playing && !running()) stop(); }, 300);
    draw(); setPhase("");
    return () => { clearInterval(watch); stopBacking(); stopLick(); };
  }
};
