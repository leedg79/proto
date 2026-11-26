// 학습일지 집계 (순수 함수)
// 연습시간(activeSec)과 완료 횟수(completedUnits)는 항상 따로 집계함

function blank() {
  return { sec: 0, units: 0, sessions: 0 };
}

function add(acc, r) {
  acc.sec += r.activeSec || 0;
  acc.units += r.completedUnits || 0;
  acc.sessions += 1;
  return acc;
}

function ensure(obj, key, make = blank) {
  if (!obj[key]) obj[key] = make();
  return obj[key];
}

export function yearOf(r) { return Number(r.date.slice(0, 4)); }
export function monthOf(r) { return Number(r.date.slice(5, 7)); }

// 연간: 모듈별 누적 + 월별 합계
export function summarizeYear(records, year) {
  const out = { year, totals: blank(), modules: {}, months: Array.from({ length: 12 }, () => ({ ...blank(), modules: {} })) };
  for (const r of records) {
    if (yearOf(r) !== year) continue;
    add(out.totals, r);
    add(ensure(out.modules, r.module), r);
    const mo = out.months[monthOf(r) - 1];
    add(mo, r);
    add(ensure(mo.modules, r.module), r);
  }
  return out;
}

// 월간: 모듈 및 레벨별 누적 + 일별 합계
export function summarizeMonth(records, year, month) {
  const out = { year, month, totals: blank(), modules: {}, days: {} };
  for (const r of records) {
    if (yearOf(r) !== year || monthOf(r) !== month) continue;
    add(out.totals, r);
    const m = ensure(out.modules, r.module, () => ({ ...blank(), levels: {} }));
    add(m, r);
    add(ensure(m.levels, r.level), r);
    const d = ensure(out.days, r.date, () => ({ ...blank(), modules: {} }));
    add(d, r);
    add(ensure(d.modules, r.module), r);
  }
  return out;
}

// 일간: 모듈·레벨·세부 과제별 + 해당 날짜 세션 목록
export function summarizeDay(records, dateKey) {
  const out = { date: dateKey, totals: blank(), modules: {}, sessions: [] };
  for (const r of records) {
    if (r.date !== dateKey) continue;
    out.sessions.push(r);
    add(out.totals, r);
    const m = ensure(out.modules, r.module, () => ({ ...blank(), levels: {} }));
    add(m, r);
    const l = ensure(m.levels, r.level, () => ({ ...blank(), tasks: {} }));
    add(l, r);
    const t = ensure(l.tasks, r.task, () => ({ ...blank(), topics: {} }));
    add(t, r);
    // 학습 주제 조합별 (여러 주제를 섞은 세션은 그 조합으로 집계)
    const key = topicKey(r.topics);
    if (key) add(ensure(t.topics, key), r);
  }
  out.sessions.sort((a, b) => (a.startedAtMs || 0) - (b.startedAtMs || 0));
  return out;
}

export function topicKey(topics) {
  return Array.isArray(topics) && topics.length ? [...topics].sort().join("+") : "";
}

export function yearsWithData(records) {
  return [...new Set(records.map(yearOf))].sort((a, b) => a - b);
}

// 달력 칸 배치 (일요일 시작). null = 빈칸
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function dateKey(year, month, day) {
  const p = n => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}`;
}

// ── 홈 연습량 그래프 (화성학 / 테크닉 / 총량, 분 단위) ──
export const HARMONY = ["notes", "chords", "scales", "ear"];
export const TECHNIQUE = ["rhythm", "technique", "licks"];
const shiftKey = (key, d) => { const [y, m, dd] = key.split("-").map(Number); const t = new Date(y, m - 1, dd + d); return dateKey(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
// range "week": 오늘 포함 최근 7일(하루 1점), "month": 최근 28일을 7일씩 4점
export function practiceSeries(records, todayKey, range = "week") {
  const days = range === "month" ? 28 : 7, size = range === "month" ? 7 : 1;
  const start = shiftKey(todayKey, -(days - 1));
  const pts = [];
  for (let i = 0; i < days / size; i++) {
    const from = shiftKey(start, i * size), to = shiftKey(start, i * size + size - 1);
    const [, fm, fd] = from.split("-").map(Number);
    const label = size === 1 ? WEEKDAY[new Date(...from.split("-").map((v, k) => (k === 1 ? Number(v) - 1 : Number(v)))).getDay()] : `${fm}/${fd}~`;
    pts.push({ from, to, label, harmony: 0, technique: 0, total: 0 });
  }
  for (const r of records) {
    if (!r.date || r.date < start || r.date > todayKey) continue;
    const p = pts.find(x => r.date >= x.from && r.date <= x.to);
    if (!p) continue;
    const min = (r.activeSec || 0) / 60;
    p.total += min;
    if (HARMONY.includes(r.module)) p.harmony += min;
    else if (TECHNIQUE.includes(r.module)) p.technique += min;
  }
  for (const p of pts) for (const k of ["harmony", "technique", "total"]) p[k] = Math.round(p[k]);
  return pts;
}
