// Scales 과제 공용: 키 선택, 상태 저장, 블록 이름

import { KEY_LIST, keyName, SCALES } from "../../theory/scales.js";
import { getSetting } from "../../core/storage.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 키 선택 (-1 = 매번 무작위)
export function keyPickerHtml(id, settingKey, { allowRandom = true } = {}) {
  const cur = getSetting(settingKey, allowRandom ? -1 : 9);
  const opts = [...(allowRandom ? [[-1, "무작위"]] : []), ...KEY_LIST.map(pc => [pc, keyName(pc, "major")])];
  return `<div class="root-grid key7" id="${id}">${opts.map(([pc, n]) => `<button type="button" data-key="${pc}" class="${pc === cur ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>`;
}

export function bindPicker(root, id) {
  const el = root.querySelector("#" + id);
  if (el) el.onclick = e => { const b = e.target.closest("button[data-key],button[data-v]"); if (!b) return; el.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b)); };
}

export function segHtml(id, options, cur) {
  return `<div class="seg wide-seg" id="${id}">${options.map(([v, n]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? "sel" : ""}">${esc(n)}</button>`).join("")}</div>`;
}

export function readSel(root, id, attr = "key") {
  const b = root.querySelector(`#${id} .sel`);
  return b ? b.dataset[attr === "key" ? "key" : "v"] : null;
}

export function unitWord(scaleId) {
  return SCALES[scaleId] && SCALES[scaleId].mode ? "포지션" : "블록";
}

export function makeStore(key) {
  return {
    load(id) { try { const d = JSON.parse(localStorage.getItem(key) || "null"); return d && d.sessionId === id ? d.st : null; } catch (_) { return null; } },
    save(id, st) { localStorage.setItem(key, JSON.stringify({ sessionId: id, st })); },
    clear() { localStorage.removeItem(key); }
  };
}

export function pickKey(setting, rand = Math.random) {
  return setting >= 0 ? setting : KEY_LIST[Math.floor(rand() * 12)];
}
