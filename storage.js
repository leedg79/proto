// 저장소 계층
// - 완료된 세션 기록: IndexedDB (사용 불가 시 localStorage로 대체)
// - 진행 중 세션·설정: localStorage (작고, 앱이 갑자기 꺼져도 즉시 남아야 하므로)
// 화면 코드는 이 파일의 함수만 사용함. 추후 클라우드·네이티브 저장으로 바꿀 때 이 파일만 교체하면 됨

const DB_NAME = "fretlab";
const DB_VERSION = 1;
const STORE = "sessions";
const LS_PREFIX = "fretlab:";
const LS_FALLBACK_SESSIONS = LS_PREFIX + "sessions-fallback";

let dbPromise = null;
let useFallback = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: "id" });
        st.createIndex("date", "date");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("indexedDB blocked"));
  });
  return dbPromise;
}

export async function initStorage() {
  try {
    await openDb();
    useFallback = false;
  } catch (_) {
    useFallback = true;
  }
  return { backend: useFallback ? "localStorage" : "IndexedDB" };
}

export function storageBackend() {
  return useFallback ? "localStorage" : "IndexedDB";
}

function tx(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(st)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fbRead() {
  try { return JSON.parse(localStorage.getItem(LS_FALLBACK_SESSIONS) || "[]"); } catch (_) { return []; }
}
function fbWrite(list) {
  localStorage.setItem(LS_FALLBACK_SESSIONS, JSON.stringify(list));
}

export async function getAllSessions() {
  if (useFallback) return fbRead().sort(byStart);
  const list = await tx("readonly", st => reqP(st.getAll()));
  return (list || []).sort(byStart);
}

function byStart(a, b) {
  return (a.startedAtMs || 0) - (b.startedAtMs || 0);
}

export async function putSession(rec) {
  return putMany([rec]);
}

export async function putMany(recs) {
  if (useFallback) {
    const map = new Map(fbRead().map(r => [r.id, r]));
    for (const r of recs) map.set(r.id, r);
    fbWrite([...map.values()]);
    return recs.length;
  }
  await tx("readwrite", st => { for (const r of recs) st.put(r); });
  return recs.length;
}

export async function deleteSession(id) {
  if (useFallback) {
    fbWrite(fbRead().filter(r => r.id !== id));
    return;
  }
  await tx("readwrite", st => { st.delete(id); });
}

export async function clearSessions() {
  if (useFallback) { fbWrite([]); return; }
  await tx("readwrite", st => { st.clear(); });
}

// 진행 중 세션
export function loadActive() {
  try {
    const raw = localStorage.getItem(LS_PREFIX + "active");
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
export function saveActive(s) {
  if (s) localStorage.setItem(LS_PREFIX + "active", JSON.stringify(s));
  else localStorage.removeItem(LS_PREFIX + "active");
}

// 설정
export function getSetting(key, def) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + "set:" + key);
    return raw == null ? def : JSON.parse(raw);
  } catch (_) { return def; }
}
export function setSetting(key, value) {
  localStorage.setItem(LS_PREFIX + "set:" + key, JSON.stringify(value));
}

// 브라우저에 "이 데이터는 지우지 말라"고 요청 (지원하는 경우에만)
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (_) {}
  return false;
}
