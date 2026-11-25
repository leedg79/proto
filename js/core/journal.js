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
    add(ensure(l.tasks, r.task), r);
  }
  out.sessions.sort((a, b) => (a.startedAtMs || 0) - (b.startedAtMs || 0));
  return out;
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
