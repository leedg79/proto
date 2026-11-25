// 기타 지판 SVG (가로형, 1번 현이 위)
// positions: [{ s, f, label }], strings: 강조할 현 목록 (빈 배열이면 전체)

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function fretboardSvg(positions = [], { maxFret = 15, strings = [], labels = false } = {}) {
  const w = 680, h = 236, left = 44, right = 16, top = 26, bottom = 40;
  const fw = (w - left - right) / maxFret;
  const sh = (h - top - bottom) / 5;
  const focus = strings.length ? new Set(strings) : null;
  const yOf = s => top + (s - 1) * sh;
  const xOf = f => (f === 0 ? left - 2 : left + (f - 0.5) * fw);
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="기타 지판 정답 위치">`;

  // 강조 현 배경
  if (focus) {
    for (const s of focus) out += `<rect x="${left}" y="${yOf(s) - sh / 2 + 2}" width="${w - left - right}" height="${sh - 4}" rx="6" fill="#a6f36b" fill-opacity=".07"/>`;
  }
  // 포지션 마크
  for (const f of [3, 5, 7, 9, 15]) if (f <= maxFret) out += `<circle cx="${left + (f - 0.5) * fw}" cy="${top + 2.5 * sh}" r="4" fill="#ffffff" fill-opacity=".09"/>`;
  if (maxFret >= 12) {
    const x = left + 11.5 * fw;
    out += `<circle cx="${x}" cy="${top + 1.5 * sh}" r="4" fill="#ffffff" fill-opacity=".09"/><circle cx="${x}" cy="${top + 3.5 * sh}" r="4" fill="#ffffff" fill-opacity=".09"/>`;
  }
  // 프렛
  for (let f = 0; f <= maxFret; f++) {
    const x = left + f * fw;
    out += `<line x1="${x}" y1="${top - 4}" x2="${x}" y2="${h - bottom + 4}" stroke="${f === 0 ? "#c9d1db" : "#3c485c"}" stroke-width="${f === 0 ? 4 : 1.4}"/>`;
    if (f > 0 && [1, 3, 5, 7, 9, 12, 15].includes(f)) out += `<text x="${left + (f - 0.5) * fw}" y="${h - 10}" font-size="17" text-anchor="middle" fill="#8f9bad">${f}</text>`;
  }
  // 현
  for (let s = 1; s <= 6; s++) {
    const on = !focus || focus.has(s);
    out += `<line x1="${left}" y1="${yOf(s)}" x2="${w - right}" y2="${yOf(s)}" stroke="${on ? "#aab5c3" : "#4a5566"}" stroke-width="${1 + (s - 1) * 0.32}"/>`;
    out += `<text x="16" y="${yOf(s) + 6}" font-size="17" text-anchor="middle" fill="${on ? "#dfe5ec" : "#5f6c80"}" font-weight="${on && focus ? 700 : 400}">${s}</text>`;
  }
  // 정답 점
  for (const p of positions) {
    const x = xOf(p.f), y = yOf(p.s);
    out += `<circle cx="${x}" cy="${y}" r="15" fill="#a6f36b" stroke="#10180a" stroke-width="1.5" data-pos="${p.s}-${p.f}"/>`;
    if (labels && p.label) out += `<text x="${x}" y="${y + 5}" font-size="13" font-weight="700" text-anchor="middle" fill="#10180a">${esc(p.label)}</text>`;
  }
  return out + "</svg>";
}
