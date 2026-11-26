// Ear Lab 화면(E1~E4 공용): 듣기 → 답하기 → 정답 확인(다시 듣기·비교 듣기) → 다음 문제
import * as E from "./ear-core.js";
import { unlockAudio, getAudioContext } from "../../audio/context.js";
import { loadInstrument, playNote, strum, masterOut } from "../../audio/sampler.js";
import { playLick, stopLick } from "../../audio/lick-player.js";
import { scoreSvg } from "../../render/score.js";
import { rhythmSvg } from "../../render/rhythm.js";
import { TUNING, SPELLINGS } from "../../theory/notes.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { esc, segHtml, bindPicker, readSel, makeStore } from "../scales/common.js";

const INSTS = [["guitar", "일렉"], ["acoustic", "어쿠스틱"], ["bass", "베이스"]];
const PER_UNIT = { note: 24, interval: 24, melodic: 10, harmonic: 10, chord: 10, phrase: 5 };

const SETTINGS = {
  note: [
    ["range", "음역", E.RANGE_NAMES, "all"],
    ["naturals", "음", [["all", "반음 포함 12음"], ["nat", "자연음 7음"]], "all"],
    ["ref", "기준음", [["c", "C(도) 먼저 들려주기"], ["none", "기준음 없이"]], "c"],
    ["inst", "음색", INSTS, "guitar"]
  ],
  interval: [["dir", "방향", E.DIRECTIONS, "up"], ["inst", "음색", INSTS, "guitar"]],
  melodic: [
    ["scale", "스케일", [["major", "메이저"], ["minor", "마이너"]], "major"],
    ["len", "음 개수", [["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]], "4"],
    ["leaps", "움직임", [["step", "순차 위주"], ["leap", "도약 포함"]], "step"],
    ["rhythm", "리듬도 맞히기", [["off", "음높이만"], ["on", "리듬까지"]], "off"],
    ["key", "키", [["c", "C 고정"], ["rand", "무작위"]], "rand"]
  ],
  harmonic: [["kind", "문제 종류", E.HARM_KINDS, "mix"], ["inst", "음색", INSTS, "acoustic"]],
  chord: [["style", "들려주기", [["block", "동시에"], ["arp", "펼친 뒤 동시에"]], "block"], ["inst", "음색", INSTS, "acoustic"]],
  phrase: [
    ["len", "채보할 음 수", [["4", "앞 4음"], ["6", "앞 6음"], ["8", "앞 8음"], ["0", "전체"]], "4"],
    ["bpm", "속도", [["60", "60"], ["80", "80"], ["100", "100"]], "80"],
    ["ref", "기준음", [["root", "키 근음 먼저"], ["none", "없이"]], "root"]
  ]
};
const INTRO = {
  note: "들려주는 한 음의 이름을 고름. 기준음을 켜면 C를 먼저 들려줌",
  interval: "두 음 사이의 음정을 고름",
  melodic: "으뜸화음 뒤에 나오는 짧은 선율을 계이름(도수)으로 순서대로 입력",
  harmonic: "세 음 화음을 듣고 자리바꿈 또는 맨 위 음을 고름",
  chord: "코드 종류(또는 진행)를 고름",
  phrase: "릭을 듣고 지판에서 음을 순서대로 눌러 채보. 음높이만 맞으면 어느 자리에서 눌러도 정답"
};

export function makeEarTask(kind) {
  const P = `ear${kind}`;
  const store = makeStore(`fretlab:ear-${kind}`);
  const defs = SETTINGS[kind];

  function settingsHtml() {
    return defs.map(([k, label, opts, def], i) => `<div class="field" ${i ? 'style="margin-top:14px"' : ""}><label>${label}</label>${segHtml(`${P}_${k}`, opts, String(getSetting(`ear.${kind}.${k}`, def)))}</div>`).join("") +
      `<p class="muted small" style="margin:4px 0 0">${INTRO[kind]}. ${PER_UNIT[kind]}${kind === "phrase" ? "개" : "문제"} = 완료 1회</p>`;
  }
  function bindSettings(root) { defs.forEach(([k]) => bindPicker(root, `${P}_${k}`)); }
  function readSettings(root) {
    const o = {};
    for (const [k, , , def] of defs) { o[k] = readSel(root, `${P}_${k}`, "v") || def; setSetting(`ear.${kind}.${k}`, o[k]); }
    return o;
  }

  function mount(container, api) {
    const s0 = api.getActive();
    const o = { ...Object.fromEntries(defs.map(([k, , , d]) => [k, getSetting(`ear.${kind}.${k}`, d)])), ...(s0.options || {}) };
    let st = store.load(s0.id) || { no: 0, answered: 0, correct: 0, units: 0, q: null, done: false, input: [], result: null };
    const persist = () => store.save(s0.id, st);

    container.innerHTML = `
      <div class="nf ear">
        <div class="nf-meta"><span id="eaNo"></span><span id="eaProg"></span></div>
        <div class="prompt-card">
          <div class="prompt-caption" id="eaCap">LISTEN</div>
          <div class="prompt-sub" id="eaAsk" style="font-size:15px;color:var(--text)"></div>
        </div>
        <div class="btn-row" style="gap:8px;margin-top:10px">
          <button class="btn primary" id="eaPlay" type="button" data-autostart>듣기</button>
          <button class="btn" id="eaPlay2" type="button"></button>
        </div>
        <div id="eaInput" class="ear-input"></div>
        <div id="eaFeedback" class="ear-feedback hidden"></div>
        <div class="nf-actions" style="margin-top:10px"><button class="btn primary wide hidden" id="eaNext" type="button">다음 문제 →</button></div>
      </div>`;
    const $ = s => container.querySelector(s);
    const running = () => { const s = api.getActive(); return !!s && s.status === "running"; };
    const inst = () => (kind === "phrase" ? "guitar" : o.inst || "guitar");

    function newQ() {
      const prev = st.q;
      let q;
      if (kind === "note") q = E.notePrompt({ range: o.range, naturals: o.naturals === "nat" }, Math.random, prev && prev.midi);
      else if (kind === "interval") q = E.intervalPrompt(s0.topics, { dir: o.dir }, Math.random, prev && prev.answer);
      else if (kind === "melodic") q = E.melodyPrompt({ len: Number(o.len), scale: o.scale, leaps: o.leaps === "leap", key: o.key === "c" ? 0 : null, rhythm: o.rhythm === "on" });
      else if (kind === "harmonic") q = E.harmPrompt({ kind: o.kind });
      else if (kind === "chord") q = E.chordPrompt(s0.topics, Math.random, prev && prev.answer);
      else {
        const pool = E.phrasePool(s0.topics);
        let l = pool[Math.floor(Math.random() * pool.length)];
        if (prev && pool.length > 1 && l.id === prev.lickId) l = pool[(pool.indexOf(l) + 1) % pool.length];
        const t = E.phraseTargets(l, Number(o.len));
        q = { lickId: l.id, key: l.key, answer: t.map(x => x.midi).join(","), targets: t.map(x => x.midi) };
      }
      if (kind === "melodic" && q.rhythm) q.rhyChoices = o.rhythm === "on" ? E.rhythmChoices(q.rhythm) : null;
      st = { ...st, no: st.no + 1, q, done: false, input: [], result: null, rhyPick: null };
      persist();
    }

    // ── 소리 ──
    async function sound(slow = false) {
      if (!running()) { api.toast("연습을 시작(재개)한 뒤 들을 수 있음"); return; }
      await unlockAudio();
      const ctx = getAudioContext();
      stopLick();
      const q = st.q;
      if (kind === "phrase") {
        const l = (await import("../licks/lick-core.js")).lickById(q.lickId);
        const cut = E.phraseCut(l, Number(o.len));
        let lead = 0;
        if (o.ref === "root") { await loadInstrument("guitar"); playNote("guitar", 45 + ((q.key - 45) % 12 + 12) % 12, ctx.currentTime + 0.05, 1.1, { gain: 0.6 }); lead = 1.3; }
        setTimeout(() => playLick(cut, Number(o.bpm) * (slow ? 0.6 : 1), { countIn: 0 }), lead * 1000);
        return;
      }
      await loadInstrument(inst());
      const t0 = ctx.currentTime + 0.08, out = masterOut(ctx);
      if (kind === "note") {
        let t = t0;
        if (o.ref === "c") { playNote(inst(), 60, t, 1, { gain: 0.6, out }); t += 1.3; }
        playNote(inst(), q.midi, t, 1.6, { gain: 0.7, out });
      } else if (kind === "interval") {
        const [a, b] = q.notes, gap = slow ? 1.4 : 0.9;
        if (q.dir === "harm" && !slow) { playNote(inst(), a, t0, 1.8, { gain: 0.6, out }); playNote(inst(), b, t0, 1.8, { gain: 0.6, out }); }
        else { playNote(inst(), a, t0, gap * 1.1, { gain: 0.65, out }); playNote(inst(), b, t0 + gap, 1.4, { gain: 0.65, out }); }
      } else if (kind === "melodic") {
        const triad = [0, 2, 4].map(k => E.degreeMidi(k, q.tonic, q.scale) - 12);   // 으뜸화음(한 옥타브 아래)
        strum(inst(), triad, t0, 1.2, { gain: 0.45, out });
        const spb = (slow ? 60 / 50 : 60 / 80) / 2;                 // 8분음표 길이(초)
        const start = t0 + 1.6;
        q.midis.forEach((m, i) => { const r = q.rhythm[i]; playNote(inst(), m, start + r.at * spb, r.len * spb * 0.95 + 0.1, { gain: 0.7, out }); });
      } else if (kind === "harmonic" || kind === "chord") {
        const blocks = q.kind === "prog" ? q.chords : [q.midis];
        const arp = slow || o.style === "arp";
        let t = t0;
        for (const ms of blocks) {
          if (arp) { ms.forEach((m, i) => playNote(inst(), m, t + i * 0.32, 2.2, { gain: 0.5, out })); t += ms.length * 0.32 + 0.2; }
          strum(inst(), ms, t, q.kind === "prog" ? 1.05 : 2, { gain: 0.5, spread: 0.02, out });
          t += q.kind === "prog" ? 1.15 : 2.2;
        }
      }
    }
    async function playMidi(m) { await unlockAudio(); await loadInstrument(inst()); playNote(inst(), m, getAudioContext().currentTime + 0.03, 1.2, { gain: 0.7, out: masterOut(getAudioContext()) }); }

    // ── 화면 ──
    const PLAY2 = { note: "", interval: "느리게(펼쳐) 듣기", melodic: "느리게 듣기", harmonic: "펼쳐 듣기", chord: "펼쳐 듣기", phrase: "느리게 듣기" };
    function drawHead() {
      $("#eaNo").textContent = `문제 ${st.no}`;
      const rate = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
      $("#eaProg").textContent = `${st.answered % PER_UNIT[kind]}/${PER_UNIT[kind]} · 정답률 ${rate}% · 완료 ${st.units}회`;
      const q = st.q;
      const ask = {
        note: () => "이 음의 이름은?",
        interval: () => `두 음의 음정은? (${q.dir === "up" ? "상행" : q.dir === "down" ? "하행" : "동시"})`,
        melodic: () => `${q.scale === "minor" ? "마이너" : "메이저"} · ${q.midis.length}음 선율을 도수로 입력${o.key === "c" ? " (C 키)" : ""}`,
        harmonic: () => (q.kind === "inversion" ? "이 화음의 자리바꿈은?" : "이 화음의 맨 위 음은? (근음 기준)"),
        chord: () => (q.kind === "prog" ? "이 진행은? (메이저 키, 마디마다 한 코드)" : "이 코드의 종류는?"),
        phrase: () => `들리는 음 ${q.targets.length}개를 순서대로 지판에서 누름`
      }[kind]();
      $("#eaAsk").textContent = ask;
      $("#eaCap").textContent = st.done ? (st.result && st.result.ok ? "CORRECT" : "ANSWER") : "LISTEN";
      $("#eaPlay2").textContent = PLAY2[kind];
      $("#eaPlay2").classList.toggle("hidden", !PLAY2[kind]);
      $("#eaNext").classList.toggle("hidden", !st.done);
    }
    function choiceButtons(list) {
      return `<div class="ear-choices">${list.map(c => `<button type="button" class="btn ear-c" data-v="${esc(c.v)}">${esc(c.label)}</button>`).join("")}</div>`;
    }
    function drawInput() {
      const q = st.q, el = $("#eaInput");
      if (kind === "note") el.innerHTML = choiceButtons(E.noteChoices(o.naturals === "nat"));
      else if (kind === "interval") el.innerHTML = choiceButtons(E.intervalsFor(s0.topics).map(i => ({ v: i.id, label: i.name })));
      else if (kind === "harmonic" || kind === "chord") el.innerHTML = choiceButtons(q.choices);
      else if (kind === "melodic") {
        el.innerHTML = `<div class="ear-seq" id="eaSeq"></div>
          <div class="ear-choices deg">${E.DEGREE_KEYS.map(k => `<button type="button" class="btn ear-d" data-k="${k}">${esc(E.degreeLabel(k, q.scale))}</button>`).join("")}</div>
          <div class="btn-row" style="gap:8px;margin-top:8px"><button class="btn small" id="eaBack" type="button">← 하나 지우기</button><button class="btn small" id="eaClear" type="button">모두 지우기</button><button class="btn small primary" id="eaCheck" type="button">확인</button></div>`;
      } else {
        const frets = 18;
        el.innerHTML = `<div class="ear-seq" id="eaSeq"></div>
          <div class="ear-fb-wrap"><div class="ear-fb" style="grid-template-columns:28px repeat(${frets},38px)">
            ${[1, 2, 3, 4, 5, 6].map(s => `<span class="ear-fs">${s}</span>${Array.from({ length: frets }, (_, f) => `<button type="button" class="ear-ff ${[3, 5, 7, 9, 12, 15, 17].includes(f) ? "ear-dot" : ""}" data-s="${s}" data-f="${f}">${f}</button>`).join("")}`).join("")}
          </div></div>
          <div class="btn-row" style="gap:8px;margin-top:8px"><button class="btn small" id="eaBack" type="button">← 하나 지우기</button><button class="btn small" id="eaClear" type="button">모두 지우기</button><button class="btn small primary" id="eaCheck" type="button">확인</button></div>`;
      }
      drawSeq();
      lockInput();
    }
    function drawSeq() {
      const el = $("#eaSeq"); if (!el) return;
      const q = st.q;
      const items = kind === "melodic" ? st.input.map(k => E.degreeLabel(k, q.scale)) : st.input.map(m => E.midiName(m));
      const total = kind === "melodic" ? q.seq.length : q.targets.length;
      el.innerHTML = Array.from({ length: total }, (_, i) => `<span class="${items[i] ? "on" : ""}">${items[i] ? esc(items[i]) : "·"}</span>`).join("");
    }
    function lockInput() { $("#eaInput").querySelectorAll("button").forEach(b => { b.disabled = st.done; }); }

    function finish(ok, html) {
      st = { ...st, done: true, answered: st.answered + 1, correct: st.correct + (ok ? 1 : 0), result: { ok, html } };
      if (st.answered % PER_UNIT[kind] === 0) { st.units += 1; api.addUnit(1); api.toast(`${PER_UNIT[kind]}${kind === "phrase" ? "개" : "문제"} 완료 · 완료 ${st.units}회`); }
      persist(); drawFeedback(); drawHead(); lockInput();
    }
    function drawFeedback() {
      const el = $("#eaFeedback");
      if (!st.done || !st.result) { el.classList.add("hidden"); el.innerHTML = ""; return; }
      el.classList.remove("hidden");
      el.innerHTML = `<div class="ear-verdict ${st.result.ok ? "ok" : "ng"}">${st.result.ok ? "정답" : "오답"}</div>${st.result.html}`;
      if (kind === "phrase") {
        const box = el.querySelector("#eaAnsScore");
        if (box) import("../licks/lick-core.js").then(L => { const l = L.lickById(st.q.lickId); const cut = E.phraseCut(l, Number(o.len)); scoreSvg(box, cut.events, { ticks: cut.ticks, chords: l.chords }); });
      }
      el.querySelectorAll("[data-play]").forEach(b => { b.onclick = () => playMidi(Number(b.dataset.play)); });
    }
    function drawRhythmPick() {
      const q = st.q, el = $("#eaInput");
      el.innerHTML = `<p class="small" style="margin:8px 0 4px">음높이 정답. 이제 리듬을 고름</p><div class="ear-rhy">${q.rhyChoices.map((r, i) => `<button type="button" class="ear-rh" data-i="${i}"><div class="score-wrap" id="eaR${i}"></div></button>`).join("")}</div>`;
      q.rhyChoices.forEach((r, i) => rhythmSvg(el.querySelector(`#eaR${i}`), E.rhythmPattern(r), { arrows: false, width: 420 }));
      el.querySelectorAll(".ear-rh").forEach(b => b.onclick = () => {
        const r = q.rhyChoices[Number(b.dataset.i)];
        const ok = E.rhythmSig(r) === E.rhythmSig(q.rhythm);
        el.querySelectorAll(".ear-rh").forEach((x, i) => { x.disabled = true; if (E.rhythmSig(q.rhyChoices[i]) === E.rhythmSig(q.rhythm)) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        finish(ok, `<p class="small">${ok ? "음높이·리듬 모두 맞음" : "음높이는 맞았고 리듬이 다름. 초록 테두리가 정답 리듬"}</p>`);
      });
    }

    function answerChoice(v) {
      const q = st.q;
      if (st.done) return;
      const ok = String(v) === String(q.answer);
      let html = "";
      if (kind === "note") html = `<p>정답: <b>${esc(E.noteName(q.answer))}</b> (${esc(E.midiName(q.midi))})</p><div class="btn-row" style="gap:8px"><button class="btn small" data-play="${q.midi}">정답 음</button>${ok ? "" : `<button class="btn small" data-play="${q.midi + ((((Number(v) - q.answer) % 12) + 18) % 12) - 6}">내가 고른 음</button>`}</div>`;
      else if (kind === "interval") html = `<p>정답: <b>${esc(q.interval.name)}</b> · ${esc(E.midiName(q.notes[0]))} → ${esc(E.midiName(q.notes[1]))}</p><p class="muted small">기억법: ${esc(q.interval.hint)}</p>`;
      else if (kind === "chord") html = q.kind === "prog" ? `<p>정답: <b>${esc(q.choices.find(c => c.v === q.answer).label)}</b> · 키 ${esc(SPELLINGS[q.key][0])}</p>` : `<p>정답: <b>${esc(SPELLINGS[q.root][0])} ${esc(q.choices.find(c => c.v === q.answer).label)}</b></p>`;
      else if (kind === "harmonic") html = `<p>정답: <b>${esc(q.choices.find(c => c.v === q.answer).label)}</b> · ${esc(SPELLINGS[q.midis[0] % 12][0])} 위로 ${q.midis.map(E.midiName).map(esc).join(" ")} (${q.quality === "maj" ? "메이저" : "마이너"})</p>`;
      $("#eaInput").querySelectorAll(".ear-c").forEach(b => { b.classList.toggle("right", b.dataset.v === String(q.answer)); if (b.dataset.v === String(v) && !ok) b.classList.add("wrong"); });
      finish(ok, html);
    }
    function check() {
      const q = st.q;
      if (kind === "melodic") {
        if (st.input.length !== q.seq.length) { api.toast(`${q.seq.length}음을 모두 입력해야 함`); return; }
        const r = E.checkSequence(q.seq, st.input);
        if (r.ok && q.rhyChoices) { drawRhythmPick(); return; }
        const tonicName = SPELLINGS[q.tonicPc][0];
        finish(r.ok, `<p>정답: <b>${q.seq.map(k => esc(E.degreeLabel(k, q.scale))).join(" · ")}</b></p><p class="small">키 ${esc(tonicName)} ${q.scale === "minor" ? "마이너" : "메이저"} · ${q.midis.map(E.midiName).map(esc).join(" ")}${r.ok ? "" : ` · ${r.firstWrong + 1}번째 음부터 다름`}</p>`);
      } else {
        if (st.input.length !== q.targets.length) { api.toast(`${q.targets.length}음을 모두 입력해야 함`); return; }
        const r = E.checkSequence(q.targets, st.input);
        finish(r.ok, `<p>정답: <b>${q.targets.map(E.midiName).map(esc).join(" · ")}</b></p><p class="small">${r.ok ? "모든 음이 맞음" : `${r.firstWrong + 1}번째 음부터 다름 (맞은 음 ${r.correctCount}/${q.targets.length})`} · 릭 ${esc(q.lickId)}</p><div class="score-wrap" id="eaAnsScore"></div>`);
      }
    }

    $("#eaInput").addEventListener("click", e => {
      if (st.done) return;
      const c = e.target.closest(".ear-c"); if (c) { answerChoice(c.dataset.v); return; }
      const d = e.target.closest(".ear-d");
      if (d) { if (st.input.length < st.q.seq.length) { st.input = [...st.input, Number(d.dataset.k)]; persist(); drawSeq(); playMidi(E.degreeMidi(Number(d.dataset.k), st.q.tonic, st.q.scale)); } return; }
      const f = e.target.closest(".ear-ff");
      if (f) { const m = TUNING[Number(f.dataset.s) - 1] + Number(f.dataset.f); if (st.input.length < st.q.targets.length) { st.input = [...st.input, m]; persist(); drawSeq(); playMidi(m); } return; }
      if (e.target.closest("#eaBack")) { st.input = st.input.slice(0, -1); persist(); drawSeq(); }
      else if (e.target.closest("#eaClear")) { st.input = []; persist(); drawSeq(); }
      else if (e.target.closest("#eaCheck")) check();
    });
    $("#eaPlay").onclick = () => sound(false);
    $("#eaPlay2").onclick = () => sound(true);
    $("#eaNext").onclick = () => { newQ(); drawAll(); sound(false); };
    function drawAll() { drawHead(); drawInput(); drawFeedback(); }
    if (!st.q) newQ();
    drawAll();
    return () => stopLick();
  }

  return { settingsHtml, bindSettings, readSettings, mount, clearFinder: () => store.clear() };
}
