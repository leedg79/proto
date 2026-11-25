// 릭 표시(좋음 / 삭제 후보): 기기에 저장, 목록을 글로 복사해 Claude에게 전달
import { LICKS } from "./lick-core.js";

const KEY = "fretlab:lickflags";
export function getFlags() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { return {}; } }
export function setFlag(id, v) {
  const f = getFlags();
  if (!v || f[id] === v) delete f[id]; else f[id] = v;
  localStorage.setItem(KEY, JSON.stringify(f));
  return f[id] || null;
}
export function clearFlags() { localStorage.removeItem(KEY); }

export function flagsText(f = getFlags()) {
  const ids = LICKS.map(l => l.id);
  const del = ids.filter(id => f[id] === "del"), good = ids.filter(id => f[id] === "good");
  return `[FRET LAB 릭 표시]\n삭제 후보(${del.length}): ${del.join(", ") || "-"}\n좋음(${good.length}): ${good.join(", ") || "-"}`;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (_) { return false; }
}
