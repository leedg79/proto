// JSON 백업·복원 (순수 함수 + 파일 내보내기 도우미)

import { SCHEMA_VERSION, localIso } from "./clock.js";

export const BACKUP_APP = "fret-lab";

export function buildBackup(records, settings, now) {
  return {
    app: BACKUP_APP,
    schema: SCHEMA_VERSION,
    exportedAt: localIso(now),
    count: records.length,
    sessions: records,
    settings: settings || {}
  };
}

export function backupFileName(now) {
  const d = new Date(now);
  const p = n => String(n).padStart(2, "0");
  return `fretlab-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

const REQUIRED = ["id", "date", "module", "level", "task", "startedAt", "endedAt", "activeSec", "completedUnits"];

export function validateRecord(r) {
  if (!r || typeof r !== "object") return "기록 형식이 아님";
  for (const k of REQUIRED) if (r[k] === undefined || r[k] === null) return `필수 항목 누락: ${k}`;
  if (typeof r.id !== "string" || !r.id) return "id 오류";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return "date 형식 오류";
  if (!Number.isFinite(r.activeSec) || r.activeSec < 0) return "activeSec 오류";
  if (!Number.isInteger(r.completedUnits) || r.completedUnits < 0) return "completedUnits 오류";
  return null;
}

// 예전 버전 백업도 읽을 수 있게 값 보정
function normalize(r) {
  const out = { ...r };
  if (!Number.isFinite(out.startedAtMs)) out.startedAtMs = Date.parse(out.startedAt) || 0;
  if (!Number.isFinite(out.endedAtMs)) out.endedAtMs = Date.parse(out.endedAt) || 0;
  if (!Array.isArray(out.pauses)) out.pauses = [];
  if (!Array.isArray(out.topics)) out.topics = [];
  if (!out.options || typeof out.options !== "object") out.options = {};
  if (!out.schema) out.schema = 1;
  delete out.selfRating;
  return out;
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: "JSON 파일을 읽을 수 없음" };
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.sessions)) {
    return { ok: false, error: "FRET LAB 백업 파일이 아님" };
  }
  if (typeof data.schema === "number" && data.schema > SCHEMA_VERSION) {
    return { ok: false, error: `더 새로운 버전(schema ${data.schema})의 백업이라 이 앱에서 복원할 수 없음` };
  }
  const records = [];
  const rejected = [];
  data.sessions.forEach((r, i) => {
    const err = validateRecord(r);
    if (err) rejected.push({ index: i, error: err });
    else records.push(normalize(r));
  });
  return { ok: true, records, rejected, settings: data.settings || {}, exportedAt: data.exportedAt || "" };
}

// 병합: 같은 id는 백업 파일 쪽으로 교체, 새 id는 추가
export function mergePlan(existing, incoming) {
  const ids = new Set(existing.map(r => r.id));
  let added = 0, replaced = 0;
  for (const r of incoming) (ids.has(r.id) ? replaced++ : added++);
  return { added, replaced, total: existing.length + added };
}
