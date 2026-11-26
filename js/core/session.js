// 공통 세션 관리자
// - 세션은 사용자가 시작 버튼을 눌러야만 시작됨
// - 세션 화면에서 "연습 시작"을 눌러야 시간이 흐름
// - 세션 화면을 벗어나거나(다른 화면·다른 앱·화면 잠금·새로고침) 앱이 꺼지면 자동 종료:
//   완료 1회 이상이면 기록, 아니면 기록하지 않음

import * as C from "./clock.js";
import { addRecord } from "../eval/eval-core.js";
import { loadActive, saveActive, putSession } from "./storage.js";

const HEARTBEAT_MS = 5000;

let state = null;
let listeners = new Set();
let heartbeat = null;
let autoPausedNotice = false;
let now = () => Date.now();

export function _setClockForTest(fn) { now = fn; }

function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

function commit(next) {
  state = next;
  saveActive(state);
  syncHeartbeat();
  emit();
}

function syncHeartbeat() {
  const running = state && state.status === "running";
  if (running && !heartbeat) {
    heartbeat = setInterval(() => {
      if (state && state.status === "running") {
        state = C.touch(state, now());
        saveActive(state);
      }
    }, HEARTBEAT_MS);
  } else if (!running && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

// 자동 종료 기록은 먼저 localStorage에 적어 두고(앱이 바로 꺼져도 남게) 저장이 끝나면 지움
const PENDING = "fretlab:pendingRecords";
const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING) || "[]"); } catch (_) { return []; } };
async function flushPending() {
  const list = readPending();
  for (const r of list) { try { await putSession(r); } catch (e) { console.error(e); return; } }
  localStorage.removeItem(PENDING);
}
let lastAutoEnd = null;   // { saved, record, units } 자동 종료 결과(화면 안내용)

// 자동 종료: 완료 1회 이상이면 기록, 아니면 버림
export async function autoEnd(reason = "leave") {
  if (!state) return null;
  const s = state;
  if (s.completedUnits >= 1) {
    const record = C.finish(s, now());
    state = null; saveActive(null); syncHeartbeat();
    lastAutoEnd = { saved: true, record, reason };
    try { localStorage.setItem(PENDING, JSON.stringify([...readPending(), record])); } catch (_) {}
    await flushPending();
    emit();
    return lastAutoEnd;
  }
  state = null; saveActive(null); syncHeartbeat();
  lastAutoEnd = { saved: false, record: null, reason, units: 0 };
  emit();
  return lastAutoEnd;
}
export function consumeAutoEnd() { const v = lastAutoEnd; lastAutoEnd = null; return v; }

export async function initSessions() {
  await flushPending();
  const saved = loadActive();
  if (saved) {
    // 앱이 꺼졌다 다시 열림: 마지막으로 살아 있던 시각에 멈춘 것으로 보고 자동 종료
    state = C.recover(saved, now());
    await autoEnd("restore");
  }
  syncHeartbeat();

  // 앱 이탈(다른 앱·화면 잠금·새로고침) → 자동 종료
  const onHide = () => { if (state) autoEnd("hide"); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
    else emit();
  });
  window.addEventListener("pagehide", onHide);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getActive() { return state; }

export function elapsedMs() {
  return state ? C.activeMs(state, now()) : 0;
}

export function elapsedSec() {
  return state ? C.activeMs(state, now()) / 1000 : 0;
}

export function consumeAutoPauseNotice() {
  const v = autoPausedNotice && state && state.status === "paused";
  autoPausedNotice = false;
  return v;
}

export function peekAutoPauseNotice() {
  return autoPausedNotice && state && state.status === "paused";
}

export function startSession(meta) {
  if (state) throw new Error("이미 진행 중인 세션이 있음");
  autoPausedNotice = false;
  commit(C.createSession(meta, now(), Math.random, { ready: true }));
  return state;
}

export function beginPractice() {
  if (!state) return;
  commit(C.begin(state, now()));
}

export function updateSessionMeta(meta) {
  if (!state) return;
  commit(C.updateMeta(state, meta));
}

export function pauseSession() {
  if (!state) return;
  commit(C.pause(state, now(), "user"));
}

export function resumeSession() {
  if (!state) return;
  autoPausedNotice = false;
  commit(C.resume(state, now()));
}

export function addCompletedUnit(n = 1) {
  if (!state) return;
  commit(C.addUnit(state, n));
}

export function recordEval(r) {
  if (!state) return;
  commit(C.addEval(state, r, addRecord));
}

export async function endSession() {
  if (!state) return null;
  const record = C.finish(state, now());
  await putSession(record);   // 저장이 끝난 뒤에만 진행 중 세션을 지움
  autoPausedNotice = false;
  commit(null);
  return record;
}

export function discardSession() {
  autoPausedNotice = false;
  commit(null);
}
