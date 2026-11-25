// 근음 위치 익히기 (지판을 보여 주지 않고 지시 → 연주 → 확인)
// 고른 구간에서 근음을 무작위 / 4도 순환 / 반음 순환으로 바꿔 제시 (예전 "근음 이동하며 익히기"를 순서 옵션으로 합침)
// 12개 근음 = 완료 1회, 주제를 여러 개 고르면 묶음마다 다음 스케일

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, pickKey } from "./common.js";
import { mountPromptDrill, regionTimeHtml, bindRegionTime, readRegionTime, clearStore } from "./prompt-drill.js";
import * as D from "./drill-core.js";

function make({ p, storeKey }) {
  return {
    clearFinder: () => clearStore(storeKey),
    settingsHtml() {
      return `<div class="field"><label>근음 순서</label>${segHtml(`${p}Order`, D.ROOT_ORDERS, getSetting(`${p}.order`, "random"))}</div>
        <div class="field" style="margin-top:14px"><label>첫 근음 (4도·반음 순환일 때)</label>${keyPickerHtml(`${p}Key`, `${p}.key`)}</div>
        ${regionTimeHtml(p)}
        <p class="muted small" style="margin:4px 0 0">근음을 무작위 또는 4도·반음씩 옮기며 같은 구간에서 스케일 치기. 문제 중에는 지판에 음을 표시하지 않음. 시간이 끝나거나 정답 확인을 누르면 모양 공개. 12개 근음 = 완료 1회</p>`;
    },
    bindSettings(root) {
      bindPicker(root, `${p}Order`); bindPicker(root, `${p}Key`);
      bindRegionTime(root, p);
    },
    readSettings(root) {
      const out = readRegionTime(root, p);
      const v = readSel(root, `${p}Order`, "v");
      const order = ["fourths", "chromatic"].includes(v) ? v : "random";
      const key = Number(readSel(root, `${p}Key`));
      setSetting(`${p}.order`, order); setSetting(`${p}.key`, key);
      Object.assign(out, { order, key });
      return out;
    },
    mount(container, api) {
      const s0 = api.getActive();
      const o = s0.options || {};
      const scales = (s0.topics || []).filter(t => SCALES[t]);
      const list = scales.length ? scales : ["minor-penta"];
      return mountPromptDrill(container, api, {
        storeKey, timeKey: `${p}.time`, timeLimit: o.timeLimit,
        makeDeck: n => D.rootDeck({ scaleId: list[n % list.length], order: o.order || "random", startPc: pickKey(o.key ?? -1), regionId: o.region || "5-9" }),
        doneText: () => "12개 근음 완료",
        caption: o.order && o.order !== "random" ? "NEXT ROOT" : "PLAY THIS SCALE"
      });
    }
  };
}

export const ShapeRoot = make({ p: "sr", storeKey: "fretlab:sr3" });
