// 스케일 지판 (가로형, 1번 현이 위). 프렛 구간(from~to)만 확대해서 그릴 수 있음
// notes: [{ s, f, label, kind }] kind: "root" | "note" | "active" | "ghost" | "ghostRoot" | "target"

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STYLE = {
  root:      { fill: "#a6f36b", stroke: "#10180a", text: "#10180a", r: 1 },
  note:      { fill: "#dfe5ec", stroke: "#10180a", text: "#10180a", r: 1 },
  active:    { fill: "#ffcf5c", stroke: "#fff", text: "#1d1600", r: 1.18 },
  target:    { fill: "#a6f36b", stroke: "#10180a", text: "#10180a", r: 1 },
  ghost:     { fill: "none", stroke: "#5f6c80", text: "#7d8a9c", r: 0.82 },
  ghostRoot: { fill: "none", stroke: "#a6f36b", text: "#a6f36b", r: 0.82 }
};

export function scaleBoardSvg(notes, { from = 0, to = 15, strings = [], labels = true, path = null } = {}) {
  const frets = to - from + 1;           // 그릴 칸 수 (from=0이면 개방현 칸 포함)
  const w = 680, left = 44, right = 16, top = 26, bottom = 40;
  const fw = (w - left - right) / Math.max(1, from === 0 ? frets - 1 : frets);
  const h = 236;
  const sh = (h - top - bottom) / 5;
  const focus = strings.length ? new Set(strings) : null;
  const xOfFret = f => (from === 0 ? (f === 0 ? left - 2 : left + (f - 0.5) * fw) : left + (f - from + 0.5) * fw);
  const lineX = k => left + k * fw; // k번째 프렛 줄
  const nLines = from === 0 ? frets - 1 : frets;
  const yOf = s => top + (s - 1) * sh;
  const R = Math.min(15, fw * 0.42);
  let o = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="스케일 지판">`;
  if (focus) for (const s of focus) o += `<rect x="${left}" y="${yOf(s) - sh / 2 + 2}" width="${w - left - right}" height="${sh - 4}" rx="6" fill="#a6f36b" fill-opacity=".07"/>`;
  // 포지션 마크
  const marks = [3, 5, 7, 9, 15, 17];
  for (let f = Math.max(1, from); f <= to; f++) {
    const x = xOfFret(f);
    if (marks.includes(f)) o += `<circle cx="${x}" cy="${top + 2.5 * sh}" r="4" fill="#fff" fill-opacity=".09"/>`;
    if (f === 12) o += `<circle cx="${x}" cy="${top + 1.5 * sh}" r="4" fill="#fff" fill-opacity=".09"/><circle cx="${x}" cy="${top + 3.5 * sh}" r="4" fill="#fff" fill-opacity=".09"/>`;
    if ([1, 3, 5, 7, 9, 12, 15, 17].includes(f) || from > 0) o += `<text x="${x}" y="${h - 10}" font-size="17" text-anchor="middle" fill="#8f9bad">${f}</text>`;
  }
  for (let k = 0; k <= nLines; k++) {
    const nut = from === 0 && k === 0;
    o += `<line x1="${lineX(k)}" y1="${top - 4}" x2="${lineX(k)}" y2="${h - bottom + 4}" stroke="${nut ? "#c9d1db" : "#3c485c"}" stroke-width="${nut ? 4 : 1.4}"/>`;
  }
  for (let s = 1; s <= 6; s++) {
    const on = !focus || focus.has(s);
    o += `<line x1="${left}" y1="${yOf(s)}" x2="${w - right}" y2="${yOf(s)}" stroke="${on ? "#aab5c3" : "#4a5566"}" stroke-width="${1 + (s - 1) * 0.32}"/>`;
    o += `<text x="16" y="${yOf(s) + 6}" font-size="17" text-anchor="middle" fill="${on ? "#dfe5ec" : "#5f6c80"}">${s}</text>`;
  }
  // 경로 선 (음 순서대로)
  if (path && path.length > 1) {
    const pts = path.filter(p => p.f >= from && p.f <= to).map(p => `${xOfFret(p.f).toFixed(1)},${yOf(p.s).toFixed(1)}`).join(" ");
    o += `<polyline points="${pts}" fill="none" stroke="#78a9ff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".85" data-path="1"/>`;
  }
  // 흐린 음 먼저, 강조 음 나중에
  const rank = { ghost: 0, ghostRoot: 1, note: 2, root: 3, target: 4, active: 5 };
  for (const n of [...notes].sort((a, b) => rank[a.kind] - rank[b.kind])) {
    if (n.f < from || n.f > to) continue;
    const st = STYLE[n.kind] || STYLE.note;
    const x = xOfFret(n.f), y = yOf(n.s), r = R * st.r;
    o += `<circle cx="${x}" cy="${y}" r="${r}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${n.kind.startsWith("ghost") ? 1.6 : 1.4}" data-pos="${n.s}-${n.f}" data-kind="${n.kind}"/>`;
    if (labels && n.label) o += `<text x="${x}" y="${y + r * 0.36}" font-size="${Math.min(14, r * (n.label.length > 1 ? 0.95 : 1.15))}" font-weight="700" text-anchor="middle" fill="${st.text}">${esc(n.label)}</text>`;
  }
  return o + "</svg>";
}
