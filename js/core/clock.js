// 세션 시간 계산 (순수 함수, 화면·저장소와 무관)
// 원칙: "1초마다 더하기"를 쓰지 않고 시각(타임스탬프)의 차이로 계산함
// 실제 연습시간 = 실행 구간(segments)의 길이 합. 일시정지 구간은 자동으로 빠짐

export const SCHEMA_VERSION = 1;

export function newSessionId(now, rand = Math.random) {
  const d = new Date(now);
  const p = n => String(n).padStart(2, "0");
  const tail = Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
  return `s_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${tail}`;
}

// 기기 시간대 기준 날짜 키 (YYYY-MM-DD)
export function localDateKey(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 시간대 오프셋을 포함한 ISO 문자열 (예: 2026-11-25T12:03:10+09:00)
export function localIso(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

// 진행 중 세션 생성 (시작 버튼을 누른 순간에만 호출)
export function createSession({ module, level, task, type }, now, rand) {
  return {
    schema: SCHEMA_VERSION,
    id: newSessionId(now, rand),
    module, level, task, type,
    status: "running",
    startedAt: now,
    segments: [{ start: now, end: null }],
    pauses: [],
    completedUnits: 0,
    lastSeenAt: now
  };
}

export function activeMs(s, now) {
  let total = 0;
  for (const seg of s.segments) {
    const end = seg.end == null ? now : seg.end;
    total += Math.max(0, end - seg.start);
  }
  return total;
}

export function pausedMs(s, now) {
  let total = 0;
  for (const p of s.pauses) {
    const to = p.to == null ? now : p.to;
    total += Math.max(0, to - p.from);
  }
  return total;
}

// reason: "user"(사용자 일시정지) | "auto"(앱 이탈) | "restore"(앱 재실행 복구)
export function pause(s, now, reason = "user") {
  if (s.status !== "running") return s;
  const segments = s.segments.map((seg, i) =>
    i === s.segments.length - 1 && seg.end == null ? { ...seg, end: Math.max(seg.start, now) } : seg
  );
  return {
    ...s,
    status: "paused",
    segments,
    pauses: [...s.pauses, { from: now, to: null, reason }],
    lastSeenAt: now
  };
}

export function resume(s, now) {
  if (s.status !== "paused") return s;
  const pauses = s.pauses.map((p, i) =>
    i === s.pauses.length - 1 && p.to == null ? { ...p, to: Math.max(p.from, now) } : p
  );
  return {
    ...s,
    status: "running",
    pauses,
    segments: [...s.segments, { start: now, end: null }],
    lastSeenAt: now
  };
}

export function addUnit(s, n = 1) {
  return { ...s, completedUnits: Math.max(0, s.completedUnits + n) };
}

export function touch(s, now) {
  return { ...s, lastSeenAt: now };
}

// 앱이 강제 종료됐다가 다시 열린 경우:
// 실행 중이었다면 마지막으로 살아 있던 시각(lastSeenAt)에 일시정지된 것으로 처리
// (꺼져 있던 시간은 연습시간에 넣지 않음)
export function recover(s, now) {
  if (!s || s.status !== "running") return s;
  const at = Math.min(Math.max(s.lastSeenAt || s.startedAt, lastSegmentStart(s)), now);
  return pause(s, at, "restore");
}

function lastSegmentStart(s) {
  const seg = s.segments[s.segments.length - 1];
  return seg ? seg.start : s.startedAt;
}

// 세션 종료 → 저장용 기록
export function finish(s, now) {
  const closed = s.status === "running" ? pause(s, now, "end") : s;
  // 종료 직전 일시정지 구간은 종료 시각에 닫음 (일시정지 상태에서 종료한 경우)
  const pauses = closed.pauses
    .map(p => (p.to == null ? { ...p, to: Math.max(p.from, now) } : p))
    .filter(p => p.reason !== "end" && p.to > p.from);
  const active = activeMs(closed, now);
  return {
    schema: SCHEMA_VERSION,
    id: s.id,
    date: localDateKey(s.startedAt),
    module: s.module,
    level: s.level,
    task: s.task,
    type: s.type,
    startedAt: localIso(s.startedAt),
    endedAt: localIso(now),
    startedAtMs: s.startedAt,
    endedAtMs: now,
    activeSec: Math.round(active / 1000),
    pauses: pauses.map(p => ({ from: localIso(p.from), to: localIso(p.to), reason: p.reason })),
    completedUnits: s.completedUnits
  };
}

export function formatDuration(sec, { long = false } = {}) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (long) {
    if (h) return `${h}시간 ${m}분`;
    if (m) return `${m}분 ${s}초`;
    return `${s}초`;
  }
  const p = n => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// 학습일지용 짧은 표기 (예: 1시간 5분, 12분, 40초)
export function formatShort(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m) return `${m}분`;
  return sec ? `${sec}초` : "0분";
}
