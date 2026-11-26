// 홈 연습량 꺾은선 그래프 (SVG 문자열)
const W = 326, H = 124, L = 28, R = 10, T = 8, B = 20;
const COL = { total: "#f1f4fa", harmony: "#78a9ff", technique: "#ffb86b" };
function niceMax(v) {
  if (v <= 30) return 30;
  if (v <= 60) return 60;
  const step = v <= 180 ? 30 : 60;
  return Math.ceil(v / step) * step;
}
export function practiceChartSvg(pts) {
  const max = niceMax(Math.max(1, ...pts.map(p => p.total)));
  const n = pts.length;
  const X = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
  const Y = v => T + (H - T - B) * (1 - v / max);
  const line = k => `<polyline points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(" ")}" fill="none" stroke="${COL[k]}" stroke-width="${k === "total" ? 2.6 : 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const grid = [0, max / 2, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#243150"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#7c87a0" font-family="ui-monospace, monospace">${Math.round(v)}</text>`).join("");
  const labels = pts.map((p, i) => `<text x="${X(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${i === n - 1 ? "#f1f4fa" : "#a4aec4"}" font-weight="${i === n - 1 ? 700 : 400}">${p.label}</text>`).join("");
  const last = pts[n - 1];
  const dots = ["total", "harmony", "technique"].map(k => `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(last[k]).toFixed(1)}" r="${k === "total" ? 4 : 3.5}" fill="${COL[k]}"/>`).join("");
  return `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="연습량 꺾은선 그래프: 총량, 화성학, 테크닉(분)">${grid}${line("harmony")}${line("technique")}${line("total")}${dots}${labels}</svg>`;
}
export const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);
