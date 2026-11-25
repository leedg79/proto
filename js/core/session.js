// 공통 세션 관리자
// - 세션은 사용자가 시작 버튼을 눌러야만 시작됨
// - 진행 중 세션은 상태가 바뀔 때마다 즉시 저장 → 화면 이동·앱 재실행에도 유지
// - 앱을 벗어나면(다른 앱 전환, 화면 잠금) 자동 일시정지, 돌아오면 사용자가 재개

import * as C from "./clock.js";
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

export function initSessions() {
  const saved = loadActive();
  if (saved) {
    const recovered = C.recover(saved, now());
    if (recovered !== saved) autoPausedNotice = true;
    state = recovered;
    saveActive(state);
  }
  syncHeartbeat();

  // 앱 이탈 시 자동 일시정지
  const onHide = () => {
    if (state && state.status === "running") {
      autoPausedNotice = true;
      commit(C.pause(state, now(), "auto"));
    }
  };
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
  commit(C.createSession(meta, now()));
  return state;
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
