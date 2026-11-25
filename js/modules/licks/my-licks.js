// 내 릭 저장소: 기기(localStorage)에 [번호, "my", 스케일, 키, 용도, 느낌, 음 목록, 코드, 이름] 형식으로 저장
import { setCustomLicks } from "./lick-core.js";

const KEY = "fretlab:mylicks";
export function loadMyLicks() { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
function persist(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); setCustomLicks(rows); }
export function saveMyLick(row) {
  const rows = loadMyLicks();
  const i = rows.findIndex(r => r[0] === row[0]);
  if (i >= 0) rows[i] = row; else rows.push(row);
  persist(rows);
}
export function deleteMyLick(id) { persist(loadMyLicks().filter(r => r[0] !== id)); }
export function nextMyId() {
  const n = loadMyLicks().reduce((m, r) => Math.max(m, Number(String(r[0]).replace(/\D/g, "")) || 0), 0) + 1;
  return "MY-" + String(n).padStart(2, "0");
}
// 백업 복원: 번호가 같으면 백업 쪽으로 바꾸고 없는 것은 추가
export function mergeMyLicks(rows) {
  if (!Array.isArray(rows)) return 0;
  const cur = loadMyLicks();
  for (const r of rows) { if (!Array.isArray(r) || r[1] !== "my") continue; const i = cur.findIndex(x => x[0] === r[0]); if (i >= 0) cur[i] = r; else cur.push(r); }
  persist(cur);
  return rows.length;
}
setCustomLicks(loadMyLicks());
