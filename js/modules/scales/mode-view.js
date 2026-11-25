// S4 Mode Switch: 근음은 그대로, 모드만 바꿔 같은 위치(6번 줄 근음 포지션)에서 침
// 밝은 순서로 바꾸면 이웃한 모드끼리 한 음만 다름. 바뀐 음은 주황
// 선택한 모드 1순환 = 완료 1회

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, pickKey } from "./common.js";
import { mountSegPlayer, clearStore } from "./seg-player.js";
import { commonHtml, bindCommon, readCommon } from "./drill-settings.js";
import * as D from "./drill-core.js";

const KEY = "fretlab:md1";
export const clearFinder = () => clearStore(KEY);

export function settingsHtml() {
  return `<div class="field"><label>근음</label>${keyPickerHtml("mdKey", "md.key")}</div>
    <div class="field" style="margin-top:14px"><label>순서</label>${segHtml("mdOrder", D.MODE_ORDERS, getSetting("md.order", "bright"))}</div>
    ${commonHtml("md")}
    <p class="muted small" style="margin:4px 0 0">고른 모드를 같은 근음 위치에서 차례로. 앞 모드와 달라진 음은 주황으로 표시. 1순환 = 완료 1회, 근음이 무작위면 순환마다 새 근음</p>`;
}
export function bindSettings(root) { bindPicker(root, "mdKey"); bindPicker(root, "mdOrder"); bindCommon(root, "md"); }
export function readSettings(root) {
  const key = Number(readSel(root, "mdKey"));
  const order = ["bright", "dark", "random"].includes(readSel(root, "mdOrder", "v")) ? readSel(root, "mdOrder", "v") : "bright";
  setSetting("md.key", key); setSetting("md.order", order);
  return { key, order, ...readCommon(root, "md") };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const modes = (s0.topics || []).filter(t => SCALES[t] && SCALES[t].mode);
  const list = modes.length ? modes : D.BRIGHTNESS;
  return mountSegPlayer(container, api, {
    storeKey: KEY, bpmKey: "md.bpm", hint: o.hint, perBeat: o.per, bpm: o.bpm || getSetting("md.bpm", 60),
    newParams: () => ({ rootPc: pickKey(o.key ?? -1), modes: D.modeOrder(list, o.order || "bright") }),
    build: p => {
      const b = D.modeSegments(p.rootPc, p.modes, o.dir || "updown");
      b.segments.forEach(sg => { sg.subHidden = sg.sub; });
      return b;
    },
    doneText: b => `모드 ${b.segments.length}개 1순환 완료`,
    foot: "주황 = 앞 모드와 달라진 음."
  });
}
