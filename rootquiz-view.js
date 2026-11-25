// 근음 문제형 과제 2개 (지판을 보여 주지 않고 지시 → 연주 → 확인)
// ShapeRoot(근음 위치 익히기): 고른 구간에서 근음을 무작위로 바꿔 제시
// RootCycle(근음 이동하며 익히기): 고른 구간에서 근음을 4도·반음 순서로 이동
// 12개 근음 = 완료 1회, 주제를 여러 개 고르면 묶음마다 다음 스케일

import { SCALES } from "../../theory/scales.js";
import { getSetting, setSetting } from "../../core/storage.js";
import { keyPickerHtml, bindPicker, readSel, segHtml, pickKey } from "./common.js";
import { mountPromptDrill, regionTimeHtml, bindRegionTime, readRegionTime, clearStore } from "./prompt-drill.js";
import * as D from "./drill-core.js";

function make({ p, storeKey, cycle }) {
  return {
    clearFinder: () => clearStore(storeKey),
    settingsHtml() {
      return `${cycle ? `<div class="field"><label>순서</label>${segHtml(`${p}Order`, D.ROOT_ORDERS.filter(o => o[0] !== "random"), getSetting(`${p}.order`, "fourths"))}</div>
        <div class="field" style="margin-top:14px"><label>첫 근음</label>${keyPickerHtml(`${p}Key`, `${p}.key`)}</div>` : ""}
        ${regionTimeHtml(p)}
        <p class="muted small" style="margin:4px 0 0">${cycle ? "근음을 4도(또는 반음)씩 옮기며 같은 구간에서 스케일 치기" : "근음을 무작위로 바꿔 같은 구간에서 스케일 치기"}. 문제 중에는 지판에 음을 표시하지 않음. 시간이 끝나거나 정답 확인을 누르면 모양 공개. 12개 근음 = 완료 1회</p>`;
    },
    bindSettings(root) {
      if (cycle) { bindPicker(root, `${p}Order`); bindPicker(root, `${p}Key`); }
      bindRegionTime(root, p);
    },
    readSettings(root) {
      const out = readRegionTime(root, p);
      if (cycle) {
        const order = readSel(root, `${p}Order`, "v") === "chromatic" ? "chromatic" : "fourths";
        const key = Number(readSel(root, `${p}Key`));
        setSetting(`${p}.order`, order); setSetting(`${p}.key`, key);
        Object.assign(out, { order, key });
      }
      return out;
    },
    mount(container, api) {
      const s0 = api.getActive();
      const o = s0.options || {};
      const scales = (s0.topics || []).filter(t => SCALES[t]);
      const list = scales.length ? scales : ["minor-penta"];
      return mountPromptDrill(container, api, {
        storeKey, timeKey: `${p}.time`, timeLimit: o.timeLimit,
        makeDeck: n => D.rootDeck({ scaleId: list[n % list.length], order: cycle ? o.order || "fourths" : "random", startPc: pickKey(o.key ?? -1), regionId: o.region || "5-9" }),
        doneText: () => "12개 근음 완료",
        caption: cycle ? "NEXT ROOT" : "PLAY THIS SCALE"
      });
    }
  };
}

export const ShapeRoot = make({ p: "sr", storeKey: "fretlab:sr2", cycle: false });
export const RootCycle = make({ p: "rq", storeKey: "fretlab:rq2", cycle: true });
