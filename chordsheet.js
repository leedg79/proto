// 코드표: 화면용 HTML 표와 저장용 SVG → PNG

import { chordBoxSvg } from "./chordbox.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 화면용: 섹션마다 8마디(4마디씩 2줄)
export function sheetHtml(plan, { current = -1, topicName = id => id } = {}) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    const bars = plan.bars.slice(r * 4, r * 4 + 4);
    const first = bars[0];
    const label = first.barInSection === 1 ? `<span class="sec">${esc(first.section)}</span><small>${esc(topicName(first.topic))}</small>` : "";
    rows.push(`<div class="sheet-row"><div class="sheet-label">${label}</div>${bars.map((b, i) => {
      const idx = r * 4 + i;
      return `<div class="sheet-bar ${b.chords.length > 1 ? "two" : ""} ${idx === current ? "now" : ""} ${idx < current ? "past" : ""}" data-bar="${idx}">${b.chords.map(c => `<span class="sheet-chord"><b>${esc(c.name)}</b><small>${esc(c.roman)}</small></span>`).join("")}</div>`;
    }).join("")}</div>`);
  }
  return `<div class="sheet">${rows.join("")}</div>`;
}

// 저장용 SVG (흰 바탕 인쇄형)
export function sheetSvg(plan, { title = "FRET LAB Play Session", meta = "", topicName = id => id } = {}) {
  const W = 1200, padX = 56, labelW = 120, barW = (W - padX * 2 - labelW) / 4, rowH = 92, top = 150;
  const voicings = [];
  const seen = new Set();
  for (const b of plan.bars) for (const c of b.chords) {
    const k = c.name + "|" + c.voicing.key;
    if (!seen.has(k)) { seen.add(k); voicings.push(c); }
  }
  const cols = 8, cellW = (W - padX * 2) / cols, cellH = 210;
  const vTop = top + rowH * 8 + 70;
  const H = vTop + Math.ceil(voicings.length / cols) * cellH + 50;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">`;
  o += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  o += `<text x="${padX}" y="70" font-size="38" font-weight="800" fill="#111">${esc(title)}</text>`;
  o += `<text x="${padX}" y="110" font-size="20" fill="#555">${esc(meta)}</text>`;
  for (let r = 0; r < 8; r++) {
    const y = top + r * rowH;
    const bars = plan.bars.slice(r * 4, r * 4 + 4);
    if (bars[0].barInSection === 1) {
      o += `<text x="${padX}" y="${y + 40}" font-size="28" font-weight="800" fill="#2f6b12">${esc(bars[0].section)}</text>`;
      o += `<text x="${padX}" y="${y + 66}" font-size="13" fill="#777">${esc(topicName(bars[0].topic))}</text>`;
    }
    bars.forEach((b, i) => {
      const x = padX + labelW + i * barW;
      o += `<line x1="${x}" y1="${y + 12}" x2="${x}" y2="${y + rowH - 12}" stroke="#222" stroke-width="2"/>`;
      const w = barW / b.chords.length;
      b.chords.forEach((c, j) => {
        o += `<text x="${x + 16 + j * w}" y="${y + 46}" font-size="${c.name.length > 7 ? 22 : 28}" font-weight="700" fill="#111">${esc(c.name)}</text>`;
        o += `<text x="${x + 16 + j * w}" y="${y + 72}" font-size="14" fill="#888">${esc(c.roman)}</text>`;
      });
    });
    o += `<line x1="${padX + labelW + 4 * barW}" y1="${y + 12}" x2="${padX + labelW + 4 * barW}" y2="${y + rowH - 12}" stroke="#222" stroke-width="${r % 2 ? 4 : 2}"/>`;
  }
  o += `<text x="${padX}" y="${vTop - 22}" font-size="20" font-weight="700" fill="#111">사용한 운지</text>`;
  voicings.forEach((c, i) => {
    const x = padX + (i % cols) * cellW, y = vTop + Math.floor(i / cols) * cellH;
    o += `<text x="${x + cellW / 2}" y="${y + 18}" font-size="16" font-weight="700" text-anchor="middle" fill="#111">${esc(c.name)}</text>`;
    const box = chordBoxSvg(c.voicing).replace('<svg ', `<svg x="${x + 8}" y="${y + 26}" width="${cellW - 16}" height="${cellH - 40}" `);
    o += lightBox(box);
  });
  return o + "</svg>";
}

// 다이어그램 색을 흰 바탕용으로
function lightBox(svg) {
  return svg.replace(/#3c485c/g, "#9aa3ad").replace(/#8c98a7/g, "#444").replace(/#dfe5ec/g, "#222").replace(/#c9d1db/g, "#222")
    .replace(/fill="#10180a"/g, 'fill="#ffffff"').replace(/#a6f36b/g, "#2f6b12").replace(/#7d8a9c/g, "#777");
}

// SVG → PNG 파일 (아이폰: 공유 시트, 그 외: 내려받기)
export async function savePng(svg, fileName) {
  const img = new Image();
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("이미지 변환 실패")); img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = img.width * 2;
  canvas.height = img.height * 2;
  const g = canvas.getContext("2d");
  g.scale(2, 2);
  g.drawImage(img, 0, 0);
  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: fileName });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  return blob.size;
}
