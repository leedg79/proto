// S1·S2·S4 공용 설정 화면 조각: 방향, 박당 음 수, BPM, 표시 방식

import * as BC from "./block-core.js";
import { HINTS, hintOk } from "./seg-player.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { bindPicker, readSel, segHtml } from "./common.js";

const DIRS = [["updown", "상행→하행"], ["up", "상행"], ["down", "하행"]];

export function commonHtml(p) {
  const bpm = BC.clampBpm(getSetting(`${p}.bpm`, BC.BPM_DEFAULT));
  return `
    <div class="field" style="margin-top:14px"><label>표시 방식</label>${segHtml(`${p}Hint`, HINTS, hintOk(getSetting(`${p}.hint`, "all")))}
      <p class="muted small" style="margin:6px 0 0">익숙해지면 근음만 → 이름만으로. 근음만·이름만은 구간마다 끝에 확인 마디(정답 모양)가 붙음</p></div>
    <div class="field" style="margin-top:14px"><label>방향</label>${segHtml(`${p}Dir`, DIRS, getSetting(`${p}.dir`, "updown"))}</div>
    <div class="field" style="margin-top:14px"><label>박당 음 수</label>${segHtml(`${p}Per`, [[1, "4분음표(1음)"], [2, "8분음표(2음)"]], getSetting(`${p}.per`, 1))}</div>
    <div class="field" style="margin-top:14px">
      <label for="${p}Bpm">BPM <b id="${p}BpmOut">${bpm}</b></label>
      <input id="${p}Bpm" type="range" min="${BC.BPM_MIN}" max="${BC.BPM_MAX}" step="1" value="${bpm}">
    </div>`;
}

export function bindCommon(root, p) {
  [`${p}Hint`, `${p}Dir`, `${p}Per`].forEach(id => bindPicker(root, id));
  const r = root.querySelector(`#${p}Bpm`);
  r.oninput = () => { root.querySelector(`#${p}BpmOut`).textContent = r.value; };
}

export function readCommon(root, p) {
  const hint = hintOk(readSel(root, `${p}Hint`, "v"));
  const dir = ["updown", "up", "down"].includes(readSel(root, `${p}Dir`, "v")) ? readSel(root, `${p}Dir`, "v") : "updown";
  const per = Number(readSel(root, `${p}Per`, "v")) === 2 ? 2 : 1;
  const bpm = BC.clampBpm(root.querySelector(`#${p}Bpm`).value);
  setSetting(`${p}.hint`, hint); setSetting(`${p}.dir`, dir); setSetting(`${p}.per`, per); setSetting(`${p}.bpm`, bpm);
  return { hint, dir, per, bpm };
}
