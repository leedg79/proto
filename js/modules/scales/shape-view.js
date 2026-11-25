// S1 Shape Learning: 블록(모드는 포지션)을 차례로, 표시 방식(전체/근음만/이름만)을 바꿔 가며 모양을 익힘
// 모든 블록(포지션) 1사이클 = 완료 1회

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, pickKey } from "./common.js";
import { mountSegPlayer, clearStore } from "./seg-player.js";
import { commonHtml, bindCommon, readCommon } from "./drill-settings.js";
import * as D from "./drill-core.js";

const KEY = "fretlab:sh1";
export const clearFinder = () => clearStore(KEY);

export function settingsHtml() {
  return `<div class="field"><label>키</label>${keyPickerHtml("shKey", "sh.key")}</div>
    ${commonHtml("sh")}
    <p class="muted small" style="margin:4px 0 0">블록 1부터 차례로(Modes는 포지션 7개). 모든 블록을 마치면 완료 1회, 주제를 여러 개 고르면 사이클마다 다음 스케일</p>`;
}
export function bindSettings(root) { bindPicker(root, "shKey"); bindCommon(root, "sh"); }
export function readSettings(root) {
  const key = Number(readSel(root, "shKey"));
  setSetting("sh.key", key);
  return { key, ...readCommon(root, "sh") };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const list = scales.length ? scales : ["minor-penta"];
  return mountSegPlayer(container, api, {
    storeKey: KEY, bpmKey: "sh.bpm", hint: o.hint, perBeat: o.per, bpm: o.bpm || getSetting("sh.bpm", 60),
    newParams: n => ({ scaleId: list[n % list.length], rootPc: pickKey(o.key ?? -1) }),
    build: p => {
      const b = D.shapeSegments(p.rootPc, p.scaleId, o.dir || "updown");
      b.segments.forEach(sg => { sg.subHidden = sg.sub; });
      return b;
    },
    doneText: b => `${b.word} ${b.segments.length}개 1사이클 완료`,
    foot: "블록 모양을 익힘."
  });
}
