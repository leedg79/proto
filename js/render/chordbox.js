// 코드 다이어그램 (세로형: 왼쪽 6번 현 → 오른쪽 1번 현, 위가 헤드 쪽)
// voicing.notes: [{ s, f, label }], voicing.frets: [1번현..6번현] (null = 치지 않음)

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function chordBoxSvg(v, { rows = 5 } = {}) {
  const fretted = v.notes.filter(n => n.f > 0).map(n => n.f);
  const hi = fretted.length ? Math.max(...fretted) : 0;
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const start = hi <= rows ? 1 : lo;
  const nRows = Math.max(rows, hi - start + 1);
  const left = 26, top = 30, sp = 19, rh = 23;
  const w = left + sp * 5 + 16, h = top + rh * nRows + 10;
  const xOf = s => left + (6 - s) * sp;
  let o = `<svg viewBox="0 0 ${w} ${h}" class="chordbox" role="img" aria-label="코드 다이어그램 ${esc(v.key)}">`;
  // 프렛 줄
  for (let r = 0; r <= nRows; r++) {
    const y = top + r * rh;
    const nut = r === 0 && start === 1;
    o += `<line x1="${left}" y1="${y}" x2="${left + sp * 5}" y2="${y}" stroke="${nut ? "#dfe5ec" : "#3c485c"}" stroke-width="${nut ? 4 : 1.3}"/>`;
  }
  // 현
  for (let s = 1; s <= 6; s++) o += `<line x1="${xOf(s)}" y1="${top}" x2="${xOf(s)}" y2="${top + rh * nRows}" stroke="#8c98a7" stroke-width="${0.9 + (s - 1) * 0.18}"/>`;
  // 시작 프렛 표시
  if (start > 1) o += `<text x="${left - 8}" y="${top + rh * 0.5 + 4}" font-size="12" text-anchor="end" fill="#c9d1db" font-weight="700">${start}</text>`;
  // 개방·뮤트 표시
  for (let s = 1; s <= 6; s++) {
    const f = v.frets[s - 1];
    const x = xOf(s), y = top - 12;
    if (f == null) o += `<text x="${x}" y="${y + 4}" font-size="12" text-anchor="middle" fill="#7d8a9c">×</text>`;
    else if (f === 0) {
      const n = v.notes.find(q => q.s === s);
      const root = n && n.label === "R";
      o += `<circle cx="${x}" cy="${y}" r="5.5" fill="none" stroke="${root ? "#a6f36b" : "#c9d1db"}" stroke-width="1.6"/>`;
    }
  }
  // 누르는 음
  for (const n of v.notes) {
    if (n.f === 0) continue;
    const x = xOf(n.s), y = top + (n.f - start + 0.5) * rh;
    const root = n.label === "R";
    o += `<circle cx="${x}" cy="${y}" r="8.6" fill="${root ? "#a6f36b" : "#dfe5ec"}"/>`;
    o += `<text x="${x}" y="${y + 3.4}" font-size="${n.label.length > 2 ? 7 : 9}" font-weight="700" text-anchor="middle" fill="#10180a">${esc(n.label)}</text>`;
  }
  return o + "</svg>";
}

export function chordGrid(voicings) {
  return `<div class="chord-grid">${voicings.map(v => `
    <figure class="chord-cell">${chordBoxSvg(v)}<figcaption>${esc(v.detail)}</figcaption></figure>`).join("")}</div>`;
}
