// 간단한 TAB 그리기 (악보 단계 전까지 쓰는 기본형)
// events: [{ at, dur, notes:[{s,f}], bend, rel, h, p, sl, vib, chrom, rest }], chords: [{ name, at }]
// 시간은 틱(4분음표 = 12), 마디 = 48틱. 박 번호와 마디선 표시

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BEND = { 1: "½", 2: "full", 3: "1½" };

export function tabSvg(events, { chords = [], ticks = 48, active = -1 } = {}) {
  const bars = Math.max(1, Math.ceil(ticks / 48));
  const total = bars * 48;
  const w = 440, left = 24, right = 8, top = 48, sh = 22, h = top + sh * 5 + 34;
  const inner = w - left - right;
  const xOf = t => left + 12 + (t / total) * (inner - 22);
  const yOf = s => top + (s - 1) * sh;
  let o = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="TAB">`;
  o += `<text x="6" y="${top + sh * 1.2}" font-size="13" fill="#8f9bad" font-weight="700">T</text><text x="6" y="${top + sh * 2.5}" font-size="13" fill="#8f9bad" font-weight="700">A</text><text x="6" y="${top + sh * 3.8}" font-size="13" fill="#8f9bad" font-weight="700">B</text>`;
  for (let s = 1; s <= 6; s++) o += `<line x1="${left}" y1="${yOf(s)}" x2="${w - right}" y2="${yOf(s)}" stroke="#4a5566" stroke-width="1.2"/>`;
  for (let b = 0; b <= bars; b++) {
    const x = b === bars ? w - right : b === 0 ? left : xOf(b * 48) - (xOf(6) - xOf(0)) / 2;
    o += `<line x1="${x}" y1="${top}" x2="${x}" y2="${yOf(6)}" stroke="#8f9bad" stroke-width="${b === bars ? 2.4 : 1.4}"/>`;
  }
  // 박 번호
  for (let t = 0; t < total; t += 12) o += `<text x="${xOf(t)}" y="${h - 10}" font-size="12" text-anchor="middle" fill="${t % 48 === 0 ? "#c9d1db" : "#5f6c80"}">${(t % 48) / 12 + 1}</text>`;
  // 코드 이름
  for (const c of chords) o += `<text x="${xOf(c.at)}" y="16" font-size="15" font-weight="700" fill="#78a9ff">${esc(c.name)}</text>`;
  let prev = null;
  events.forEach((e, i) => {
    const x = xOf(e.at);
    if (e.rest) { o += `<text x="${x}" y="${yOf(3.5) + 5}" font-size="16" text-anchor="middle" fill="#5f6c80">·</text>`; prev = null; return; }
    const on = i === active;
    for (const n of e.notes) {
      const y = yOf(n.s), label = String(n.f);
      const bw = label.length > 1 ? 21 : 13;
      o += `<rect x="${x - bw / 2}" y="${y - 10}" width="${bw}" height="20" rx="3" fill="${on ? "#ffcf5c" : "#0f151f"}"/>`;
      o += `<text x="${x}" y="${y + 6}" font-size="17" font-weight="700" text-anchor="middle" fill="${on ? "#1d1600" : e.chrom ? "#ffb86b" : "#e7edf4"}" data-ev="${i}">${label}</text>`;
    }
    const n0 = e.notes[0], y0 = yOf(n0.s);
    if (e.bend) {
      o += `<path d="M${x + 8} ${y0 - 4} q 12 -2 12 -${18 + (n0.s - 1) * 0}" fill="none" stroke="#a6f36b" stroke-width="1.6"/><path d="M${x + 16} ${y0 - 20} l4 -6 l4 6 z" fill="#a6f36b"/>`;
      o += `<text x="${x + 20}" y="${y0 - 26}" font-size="12" fill="#a6f36b">${BEND[e.bend]}</text>`;
    }
    if (e.rel) o += `<text x="${x}" y="${y0 - 12}" font-size="11" text-anchor="middle" fill="#a6f36b">R</text>`;
    if ((e.h || e.p || e.sl) && prev) {
      const px = xOf(prev.at);
      if (e.sl) o += `<line x1="${px + 9}" y1="${y0 + (n0.f > prev.notes[0].f ? 5 : -5)}" x2="${x - 9}" y2="${y0 + (n0.f > prev.notes[0].f ? -5 : 5)}" stroke="#ff9f43" stroke-width="1.6"/>`;
      else o += `<path d="M${px} ${y0 - 10} Q ${(px + x) / 2} ${y0 - 22} ${x} ${y0 - 10}" fill="none" stroke="#c9a0ff" stroke-width="1.4"/><text x="${(px + x) / 2}" y="${y0 - 20}" font-size="11" text-anchor="middle" fill="#c9a0ff">${e.h ? "h" : "p"}</text>`;
    }
    if (e.vib) o += `<text x="${x + 2}" y="${top - 8}" font-size="15" fill="#6be3e0">∿∿</text>`;
    prev = e;
  });
  return o + "</svg>";
}
