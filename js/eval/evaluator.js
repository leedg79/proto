// 연주 평가 실행기 (세션 하나에 하나)
// 마이크 소리 → 음 높이(YIN)·크로마·어택 → 지금 문제(target)를 판정하고 세션 기록에 넣음
// 화면(모듈)은 평가가 꺼져 있어도 prompt / end / expect 를 그냥 부르면 됨(꺼져 있으면 아무것도 안 함)
import { openMic, closeMic, listen, isMicOpen, micInfo, micHandle, listenerCount } from "../audio/mic.js";
import { getAudioContext } from "../audio/context.js";
import { getSetting } from "../core/storage.js";
import { yin, nearestNote, chroma, dbToMag } from "./pitch-core.js";
import * as E from "./eval-core.js";

let on = false;
let cur = null;          // 진행 중 시도
let pendingTarget = null;
let sink = null;         // 기록 함수(세션)
let analyser = null, poll = null, offListen = null;
let held = null, cand = null, candN = 0, onsetSince = false;
let lastText = "";
let lastNote = null;
const subs = new Set();
const now = () => { try { return getAudioContext().currentTime; } catch (_) { return performance.now() / 1000; } };

export const isOn = () => on;
export const lastFeedback = () => lastText;
export const heard = () => lastNote;
export function setSink(fn) { sink = fn; }
export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(text, kind = "") { if (text != null) lastText = text; for (const f of subs) { try { f({ text: lastText, kind }); } catch (_) {} } }

function record(r) {
  if (sink) sink(r);
  const tm = r.timeMs != null ? ` · ${(r.timeMs / 1000).toFixed(1)}초` : r.meanMs != null ? ` · 오차 ${r.meanMs}ms` : "";
  const ms = r.mistakes && r.mistakes.length ? ` · 실수: ${r.mistakes.slice(0, 2).join(", ")}${r.mistakes.length > 2 ? " 외" : ""}` : "";
  emit(`${r.ok ? "통과" : "미통과"} · ${r.label} · 정확도 ${Math.round((r.score || 0) * 100)}%${tm}${ms}`, r.ok ? "ok" : "bad");
}

// ── 대상 ──
// 박 대상(timing·follow): 반주가 박을 미리 예약하므로 예약된 박은 공용 목록(sched)에 모아 두고,
// 시도를 마감할 때 그 시도 구간 [시작 − 50ms, 다음 시도 시작 − 50ms) 안의 박만 씀
const timed = c => c && (c.target.kind === "timing" || c.target.kind === "follow");
let sched = [];
let closeTimer = null;
function withExpected(c, until = Infinity) {
  if (!timed(c)) return c;
  const ex = sched.filter(e => e.t >= c.t0 - 0.05 && e.t < until);
  return { ...c, expected: ex };
}
function flushClosing() { if (closeTimer) { clearTimeout(closeTimer.id); const c = closeTimer.c; closeTimer = null; if (c && !c.reported) { const keep = cur; cur = withExpected(c, c.until); settle(); cur = keep; } } }
export function prompt(target) {
  pendingTarget = target;
  if (!on) return;
  flushClosing();
  const t = now();
  const before = lastText;
  if (cur && !cur.reported) { cur = withExpected(cur, t - 0.05); settle(); }
  cur = { ...E.startAttempt(target, t), reported: false };
  sched = sched.filter(e => e.t > t - 10);
  // 방금 앞 시도 결과를 냈으면 그 결과를 그대로 보여 줌
  if (lastText === before) emit(`평가 중 · ${target.label}`, "");
}
export function end() {
  pendingTarget = null;
  if (!on || !cur || cur.reported) { cur = null; return; }
  if (timed(cur)) {
    // 마지막 박 뒤 어택·음 높이가 늦게 들어오는 몫을 기다렸다가 마감
    flushClosing();
    const c = { ...cur, until: now() + 0.05 };
    cur = null;
    closeTimer = { c, id: setTimeout(() => { closeTimer = null; const keep = cur; cur = withExpected(c, c.until); if (!c.reported) settle(); cur = keep; }, 400) };
    return;
  }
  settle();
  cur = null;
}
// 박 위치(타이밍 대상): t = 오디오 시각(없으면 지금)
export function expect(label = "", t = null, extra = {}) {
  if (!on) return;
  const tt = t ?? now();
  const last = sched[sched.length - 1];
  if (last && Math.abs(last.t - tt) < 0.03) return;   // 같은 순간에 여러 줄(핑거링·화음)은 어택 1번
  sched.push({ t: tt, label, ...extra });
}
// 안내 문구만 표시(판정 없음)
export function info(text) { if (on) emit(text, ""); }
// 모듈이 직접 판정한 결과(테크닉 등)
export function report(r) { if (on) record(r); }

function settle() {
  const r = E.finishAttempt(cur, now(), { minNotes: 3 });
  cur = { ...cur, reported: true };
  // 아무 소리도 없던 타이밍 대상(박 0개)은 기록하지 않음
  if ((r.kind === "timing" || r.kind === "follow") && !r.total) return;
  record(r);
}

function onNote(midi, t) {
  lastNote = { midi, name: E.noteName(midi), t };
  if (closeTimer && closeTimer.c.target.kind === "follow") closeTimer.c = { ...E.feedNote(closeTimer.c, midi, t).a, reported: false };
  if (!cur || cur.reported) { emit(null); return; }
  const k = cur.target.kind;
  if (k === "follow") { cur = { ...E.feedNote(cur, midi, t).a, reported: false }; emit(`들린 음 ${E.noteName(midi)} · ${cur.target.label}`); return; }
  if (k !== "note" && k !== "set" && k !== "seq") { emit(null); return; }
  const r = E.feedNote(cur, midi, t);
  cur = { ...r.a, reported: false };
  if (r.event === "ok" && (k === "note" || k === "seq")) {
    settle();
    // 반복 대상(릭 익히기 등): 다 친 뒤 같은 대상으로 다시 시작
    if (cur.target.repeat) cur = { ...E.startAttempt(cur.target, now()), reported: false };
    return;
  }
  if (r.event === "wrong") emit(`틀림 · ${E.noteName(midi)} · ${cur.target.label}`, "bad");
  else if (k === "seq" && r.event === "progress") emit(`${cur.idx}/${cur.target.midis.length}음 · ${cur.target.label}`, "");
  else if (k === "set") emit(`${cur.covered.length}/${new Set(cur.target.pcs.map(p => ((p % 12) + 12) % 12)).size}음 · 밖 ${cur.wrong.length} · ${cur.target.label}`, "");
  else emit(null);
}
function onChroma(ch, t, loud) {
  if (!cur || cur.reported || cur.target.kind !== "chord") return;
  const r = E.feedChroma(cur, ch, t, loud);
  cur = { ...r.a, reported: false };
  if (r.event === "ok") settle();
  else if (r.event === "wrong") emit(`다시 · ${cur.wrong[cur.wrong.length - 1]} · ${cur.target.label}`, "bad");
}
function onOnset(t) {
  onsetSince = true;
  if (closeTimer) closeTimer.c = { ...E.feedOnset(closeTimer.c, t - getSetting("tech.latency", 0.06)), reported: false };
  if (!cur || cur.reported || (cur.target.kind !== "timing" && cur.target.kind !== "follow")) return;
  const lat = getSetting("tech.latency", 0.06);
  cur = { ...E.feedOnset(cur, t - lat), reported: false };
}

// ── 마이크 ──
const micOpts = () => {
  const ratio = { low: 6, mid: 4, high: 2.8 }[getSetting("tech.sens", "mid")] || 4;
  return { floor: getSetting("tech.floor", 2e-6), ratio, deviceId: getSetting("audio.input", "") };
};
let attached = null, reopening = false;
// 마이크가 다시 열리면(입력 장치 변경·다른 화면이 닫고 엶) 분석기를 새 입력에 다시 연결
function attach() {
  const m = micHandle();
  if (!m) {
    if (!reopening) { reopening = true; openMic(micOpts()).catch(() => {}).finally(() => { reopening = false; }); }
    return false;
  }
  if (attached === m) return true;
  const ctx = getAudioContext();
  try { analyser && analyser.disconnect(); } catch (_) {}
  analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;
  m.src.connect(analyser);
  if (offListen) offListen();
  offListen = listen({ onOnset });
  attached = m;
  return true;
}

export async function enable() {
  if (on) return true;
  await openMic(micOpts());
  const ctx = getAudioContext();
  attach();
  const buf = new Float32Array(2048), fbuf = new Float32Array(2048);
  poll = setInterval(() => {
    if (window.__fretlabEvalInject || !attach()) return;
    analyser.getFloatTimeDomainData(buf);
    const r = yin(buf, ctx.sampleRate);
    const t = ctx.currentTime;
    const loud = r.rms > 0.004;
    if (cur && !cur.reported && cur.target.kind === "chord") {
      analyser.getFloatFrequencyData(fbuf);
      onChroma(chroma(dbToMag(fbuf), ctx.sampleRate, analyser.fftSize), t, loud);
    }
    if (!loud) { held = null; cand = null; candN = 0; return; }
    const nn = r.clarity > 0.82 ? nearestNote(r.freq) : null;
    if (!nn || nn.midi < 28 || nn.midi > 90) { cand = null; candN = 0; return; }
    if (cand === nn.midi) candN++; else { cand = nn.midi; candN = 1; }
    if (candN >= 2 && (held !== nn.midi || onsetSince)) { held = nn.midi; onsetSince = false; onNote(nn.midi, t - getSetting("tech.latency", 0.06)); }
  }, 25);
  on = true;
  if (pendingTarget) prompt(pendingTarget);
  emit(pendingTarget ? `평가 중 · ${pendingTarget.label}` : "평가 켜짐 · 문제가 나오면 판정 시작", "");
  return true;
}

export function disable({ keepMic = false } = {}) {
  flushClosing();
  if (cur && !cur.reported && on) { cur = withExpected(cur, Infinity); settle(); }
  sched = [];
  cur = null;
  on = false;
  if (poll) clearInterval(poll); poll = null;
  if (offListen) offListen(); offListen = null;
  try { analyser && analyser.disconnect(); } catch (_) {}
  analyser = null; attached = null; held = null; cand = null;
  // 다른 화면(테크닉 판정 등)이 마이크를 듣고 있으면 닫지 않음
  if (!keepMic && isMicOpen() && listenerCount() === 0) closeMic();
  emit("평가 꺼짐", "");
}

export const inputLabel = () => { const i = micInfo(); return i ? i.label || "기본 입력" : ""; };

// ── 테스트용: 마이크 없이 감지 결과를 넣음 ──
// window.__fretlabEvalInject = true 로 실제 분석을 멈추고 아래 함수로 넣음
export const _test = {
  note: midi => onNote(midi, now()),
  chroma: ch => onChroma(ch, now(), true),
  onset: (t = null) => onOnset((t ?? now()) + getSetting("tech.latency", 0.06)),
  enableFake() { on = true; if (pendingTarget) prompt(pendingTarget); emit("평가 켜짐(테스트)"); },
  current: () => (cur ? withExpected(cur, Infinity) : null),
  flush: () => flushClosing()
};
if (typeof window !== "undefined") window.__fretlabEval = _test;
