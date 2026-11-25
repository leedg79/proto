// 모드 전환(문제형): 근음은 그대로, 모드만 순서대로 바꿔 같은 구간에서 치기
// 문제 중에는 지판에 음을 표시하지 않음. 확인 때 모양과 앞 모드에서 달라진 음(주황) 공개
// 고른 모드 1순환 = 완료 1회, 근음이 무작위면 순환마다 새 근음

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, pickKey } from "./common.js";
import { mountPromptDrill, regionTimeHtml, bindRegionTime, readRegionTime, clearStore } from "./prompt-drill.js";
import * as D from "./drill-core.js";

const KEY = "fretlab:md2";
export const clearFinder = () => clearStore(KEY);

export function settingsHtml() {
  return `<div class="field"><label>근음</label>${keyPickerHtml("mdKey", "md.key")}</div>
    <div class="field" style="margin-top:14px"><label>순서</label>${segHtml("mdOrder", D.MODE_ORDERS, getSetting("md.order", "bright"))}</div>
    ${regionTimeHtml("md")}
    <p class="muted small" style="margin:4px 0 0">밝은 순서(Lydian → Locrian)로 바꾸면 이웃한 모드끼리 한 음만 다름. 확인 때 달라진 음은 주황. 고른 모드 1순환 = 완료 1회</p>`;
}
export function bindSettings(root) { bindPicker(root, "mdKey"); bindPicker(root, "mdOrder"); bindRegionTime(root, "md"); }
export function readSettings(root) {
  const key = Number(readSel(root, "mdKey"));
  const order = ["bright", "dark", "random"].includes(readSel(root, "mdOrder", "v")) ? readSel(root, "mdOrder", "v") : "bright";
  setSetting("md.key", key); setSetting("md.order", order);
  return { key, order, ...readRegionTime(root, "md") };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const modes = (s0.topics || []).filter(t => SCALES[t] && SCALES[t].mode);
  const list = modes.length ? modes : D.BRIGHTNESS;
  return mountPromptDrill(container, api, {
    storeKey: KEY, timeKey: "md.time", timeLimit: o.timeLimit,
    makeDeck: () => D.modeDeck({ rootPc: pickKey(o.key ?? -1), modes: D.modeOrder(list, o.order || "bright"), regionId: o.region || "5-9" }),
    doneText: d => `모드 ${d.length}개 1순환 완료`,
    caption: "SWITCH MODE"
  });
}
