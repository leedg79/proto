// S2 Root Cycle: 스케일은 그대로, 근음만 4도·반음·무작위 순으로 바꿔 지금 손 위치에서 가장 가까운 모양으로 이어 침
// 12개 근음 1순환 = 완료 1회

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, pickKey } from "./common.js";
import { mountSegPlayer, clearStore } from "./seg-player.js";
import { commonHtml, bindCommon, readCommon } from "./drill-settings.js";
import * as D from "./drill-core.js";

const KEY = "fretlab:rc1";
export const clearFinder = () => clearStore(KEY);

export function settingsHtml() {
  const ord = getSetting("rc.order", "fourths");
  return `<div class="field"><label>순서</label>${segHtml("rcOrder", D.ROOT_ORDERS, ord)}</div>
    <div class="field" style="margin-top:14px"><label>첫 근음</label>${keyPickerHtml("rcKey", "rc.key")}</div>
    ${commonHtml("rc")}
    <p class="muted small" style="margin:4px 0 0">구간마다 새 근음이 제시됨. 지금 손 위치에서 가장 가까운 모양으로 이어 치기. 12개 근음 = 완료 1회(무작위 순서에서는 첫 근음 설정을 쓰지 않음)</p>`;
}
export function bindSettings(root) { bindPicker(root, "rcOrder"); bindPicker(root, "rcKey"); bindCommon(root, "rc"); }
export function readSettings(root) {
  const order = ["fourths", "chromatic", "random"].includes(readSel(root, "rcOrder", "v")) ? readSel(root, "rcOrder", "v") : "fourths";
  const key = Number(readSel(root, "rcKey"));
  setSetting("rc.order", order); setSetting("rc.key", key);
  return { order, key, ...readCommon(root, "rc") };
}

export function mount(container, api) {
  const s0 = api.getActive();
  const o = s0.options || {};
  const scales = (s0.topics || []).filter(t => SCALES[t]);
  const list = scales.length ? scales : ["minor-penta"];
  return mountSegPlayer(container, api, {
    storeKey: KEY, bpmKey: "rc.bpm", hint: o.hint, perBeat: o.per, bpm: o.bpm || getSetting("rc.bpm", 60),
    newParams: n => ({ scaleId: list[n % list.length], roots: D.rootOrder(o.order || "fourths", pickKey(o.key ?? -1)) }),
    build: p => {
      const b = D.rootSegments(p.scaleId, p.roots, o.dir || "updown");
      b.segments.forEach(sg => { sg.subHidden = `${SCALES[p.scaleId].name} · 가까운 모양으로`; sg.hideWide = true; });
      return b;
    },
    doneText: () => "12개 근음 1순환 완료",
    foot: "큰 글자 = 이번 근음."
  });
}
