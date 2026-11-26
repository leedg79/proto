// 릭 익히기: 고른 하위 분류의 릭을 하나씩 보고(TAB·지판·도수·코드 관계) 연습
// 릭 10개를 넘기면 완료 1회. 좋음 / 삭제 후보 표시는 바로 저장
import { licksFor, LICKS } from "./lick-core.js";
import { lickCardHtml, bindFlagButtons, bindPlayButtons, paintScores } from "./lick-card.js";
import { setFlag } from "./lick-flags.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";
import { KEY_LIST } from "../../theory/scales.js";
import * as Metro from "../../audio/metronome.js";
import { lickSeq } from "../../eval/targets.js";
import { realize } from "./lick-core.js";

const store = makeStore("fretlab:lk1");
export const clearFinder = () => store.clear();
const KEYS = [["orig", "원래 키"], ["random", "무작위 키"]];
const ORDERS = [["seq", "번호순"], ["random", "무작위"]];

export function settingsHtml() {
  return `
    <div class="field"><label>키</label>${segHtml("lkKey", KEYS, getSetting("lk.key", "orig"))}
      <p class="muted small" style="margin:6px 0 0">무작위 키는 같은 모양을 수평 이동해서 보여 줌(근음 위치·도수는 그대로)</p></div>
    <div class="field" style="margin-top:14px"><label>순서</label>${segHtml("lkOrder", ORDERS, getSetting("lk.order", "seq"))}</div>
    <p class="muted small" style="margin:4px 0 0">릭을 하나씩 보며 TAB·지판·도수로 익힘. 메트로놈을 켜고 느린 템포부터 반복. 릭 10개 = 완료 1회. 어색한 릭은 "삭제 후보", 좋은 릭은 "좋음"으로 표시해 두면 목록·표시 화면에서 한 번에 복사할 수 있음</p>`;
}
export function bindSettings(root) { bindPicker(root, "lkKey"); bindPicker(root, "lkOrder"); }
export function readSettings(root) {
  const key = readSel(root, "lkKey", "v") === "random" ? "random" : "orig";
  const order = readSel(root, "lkOrder", "v") === "random" ? "random" : "seq";
  setSetting("lk.key", key); setSetting("lk.order", order);
  return { key, order };
}

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const pool = licksFor(s0.level, s0.topics || []);
  const list = pool.length ? pool : licksFor(s0.level);
  const makeOrder = () => (o.order === "random" ? shuffle(list.map(l => l.id)) : list.map(l => l.id));
  const keyFor = id => (o.key === "random" ? KEY_LIST[Math.floor(Math.random() * 12)] : LICKS.find(l => l.id === id).key);
  let st = store.load(s0.id) || { order: makeOrder(), idx: 0, seen: 1, units: 0, keys: {}, bpm: 60 };
  if (!st.keys[st.order[st.idx]]) st.keys[st.order[st.idx]] = keyFor(st.order[st.idx]);
  let metro = false;

  container.innerHTML = `
    <div class="nf lk">
      <div class="nf-meta"><span id="lkNo"></span><span id="lkProg"></span></div>
      <div id="lkCard"></div>
      <div class="nf-actions lk-nav">
        <button class="btn" id="lkPrev" type="button">← 이전</button>
        <button class="btn primary" id="lkNext" type="button">다음 릭 →</button>
      </div>
      <div class="bf-controls"><div class="bpm-row">
        <button type="button" data-bpm="-5">−5</button>
        <div class="bpm-val"><b id="lkBpm">${st.bpm}</b><span>BPM</span></div>
        <button type="button" data-bpm="5">+5</button>
        <button type="button" class="btn small" id="lkMetro">메트로놈 켜기</button>
      </div></div>
      <p class="muted small nf-foot">듣기는 아래 BPM으로 재생. TAB 위 숫자 = 프렛, 초록 화살표 = 벤딩, 보라 호 = 해머온·풀오프, 주황 선 = 슬라이드, ∿ = 비브라토, 주황 숫자 = 경과음</p>
    </div>`;
  const $ = s => container.querySelector(s);
  const persist = () => store.save(s0.id, st);
  function draw() {
    const id = st.order[st.idx];
    const l = LICKS.find(x => x.id === id);
    $("#lkNo").textContent = `${st.idx + 1}/${st.order.length}`;
    $("#lkProg").textContent = `이번 묶음 ${st.seen % 10 || (st.seen ? 10 : 0)}/10 · 완료 ${st.units}회`;
    $("#lkCard").innerHTML = lickCardHtml(l, { key: st.keys[id] ?? l.key });
    paintScores($("#lkCard"), x => LICKS.find(y => y.id === x));
    $("#lkPrev").disabled = st.idx === 0;
    // 연주 평가: 화면의 릭을 TAB 순서대로 쳤는지(다 치면 같은 릭으로 다시 평가 시작)
    if (api.eval) { const r = realize(l, st.keys[id] ?? l.key); api.eval.prompt({ ...lickSeq(`${l.id}${l.name ? " " + l.name : ""}`, r.events), repeat: true }); }
  }
  $("#lkNext").onclick = () => {
    const s = api.getActive(); if (!s || s.status !== "running") { api.toast("세션을 재개한 뒤 넘길 수 있음"); return; }
    let { idx, order } = st;
    idx++;
    if (idx >= order.length) { order = makeOrder(); idx = 0; }
    const seen = st.seen + 1;
    let units = st.units;
    if ((seen - 1) % 10 === 0) { units++; api.addUnit(1); api.toast(`릭 10개 완료 · 이번 세션 ${units}회`); }
    const keys = { ...st.keys };
    if (keys[order[idx]] === undefined || o.key === "random") keys[order[idx]] = keyFor(order[idx]);
    st = { ...st, idx, order, seen, units, keys };
    persist(); unplay(); draw();
    container.scrollIntoView({ block: "start" });
  };
  $("#lkPrev").onclick = () => { if (st.idx > 0) { st = { ...st, idx: st.idx - 1 }; persist(); draw(); } };
  bindFlagButtons(container, (id, v) => { setFlag(id, v); draw(); });
  const unplay = bindPlayButtons(container, id => LICKS.find(x => x.id === id), () => st.bpm);
  container.querySelector(".bf-controls").addEventListener("click", async e => {
    const b = e.target.closest("[data-bpm]");
    if (b) { st = { ...st, bpm: Math.min(200, Math.max(30, st.bpm + Number(b.dataset.bpm))) }; $("#lkBpm").textContent = st.bpm; Metro.setMetronomeBpm(st.bpm); persist(); return; }
    if (e.target.id === "lkMetro") {
      if (metro) { Metro.stopMetronome(); metro = false; }
      else { try { await Metro.startMetronome({ bpm: st.bpm, beatsPerBar: 4 }); metro = true; } catch (err) { api.toast("소리를 켤 수 없음"); } }
      $("#lkMetro").textContent = metro ? "메트로놈 끄기" : "메트로놈 켜기";
    }
  });
  const watch = setInterval(() => { const s = api.getActive(); if (metro && (!s || s.status !== "running")) { Metro.stopMetronome(); metro = false; $("#lkMetro").textContent = "메트로놈 켜기"; } }, 300);
  draw();
  return () => { clearInterval(watch); unplay(); if (metro) Metro.stopMetronome(); if (api.eval) api.eval.end(); };
}
